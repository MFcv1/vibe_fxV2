/**
 * smoke-vibecut-k1-live-anon.mjs
 * Export K1 live end-to-end smoke : sign-in anonyme REST, upload Storage,
 * createVideoExportJob, attente ready, vérification cout estimé dans Firestore.
 *
 * Ne nécessite pas de service account : utilise uniquement le token firebase-tools
 * pour Storage/Firestore admin, et l'API REST Firebase Identity pour l'auth utilisateur.
 *
 * Usage (depuis la racine du projet) :
 *   node scripts/smoke-vibecut-k1-live-anon.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stat, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

// ── Config ──────────────────────────────────────────────────────────────────
const defaultK1Dir = "C:\\Users\\pcpor\\OneDrive\\Bureau\\K1";
const k1Dir        = process.env.VIBECUT_K1_DIR || defaultK1Dir;
const ADC_PATH     = "C:\\Users\\pcpor\\AppData\\Roaming\\firebase\\matthis_fradin2_gmail.com_application_default_credentials.json";
// App Check debug token: secret local obligatoire, jamais de valeur dans le dépôt.
const APPCHECK_DEBUG_TOKEN = process.env.FIREBASE_APPCHECK_DEBUG_TOKEN || "";

loadDotEnvLocal();

const API_KEY      = requiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY");
const PROJECT_ID   = requiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const STORAGE_BUCKET = requiredEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
const REGION       = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "europe-west9";
const APP_ID_WEB   = "1:663698546037:web:cbeb8e828df3a41455c73c";
const TIMEOUT_MS   = Number(process.env.VIBECUT_LIVE_TIMEOUT_MS || 20 * 60 * 1000);
const timestamp    = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const exportId     = `k1-anon-${timestamp}`;

console.log(`\n=== VibeCut K1 live smoke (anonymous) ===`);
console.log(`exportId: ${exportId}  region: ${REGION}  bucket: ${STORAGE_BUCKET}\n`);

// ── Step 1 : get access token for Storage/Firestore REST (from ADC) ─────────
const accessToken = await getAccessToken();
console.log("✓ Access token obtained (for Storage/Firestore admin REST)");

// ── Step 1b : get App Check token via debug token exchange ──────────────────
const appCheckToken = await getAppCheckToken();
console.log("✓ App Check token obtained (debug exchange)");

// ── Step 2 : Firebase anonymous sign-in ──────────────────────────────────────
const { uid: anonUid, idToken } = await signInAnonymously();
console.log(`✓ Firebase anonymous user: ${anonUid}`);

// ── Step 3 : build manifest ──────────────────────────────────────────────────
const sourceA = path.join(k1Dir, "MVI_0126.MP4");
const sourceB = path.join(k1Dir, "MVI_0117.MP4");
await assertSource(sourceA);
await assertSource(sourceB);

const uploadA = await uploadToStorage(sourceA, `users/${anonUid}/exports/${exportId}/sources/video/MVI_0126.MP4`);
const uploadB = await uploadToStorage(sourceB, `users/${anonUid}/exports/${exportId}/sources/video/MVI_0117.MP4`);
console.log(`✓ Sources uploaded: ${Math.round(uploadA.size / 1024 / 1024)}MB + ${Math.round(uploadB.size / 1024 / 1024)}MB`);

const manifest = await buildManifest([
  { ...uploadA, id: "k1-a" },
  { ...uploadB, id: "k1-b" },
], anonUid);
console.log(`✓ Manifest built (${manifest.clips.length} clips, ${manifest.project.duration}s)`);

// ── Step 4 : createVideoExportJob ────────────────────────────────────────────
console.log("→ Calling createVideoExportJob …");
const createResult = await callCallable("createVideoExportJob", { manifest }, idToken);
const jobId = createResult.jobId;
assert.ok(jobId, "createVideoExportJob doit retourner un jobId");
console.log(`✓ Job created: ${jobId}  status: ${createResult.status}`);

// ── Step 5 : wait for ready ──────────────────────────────────────────────────
console.log("→ Waiting for job to be ready …");
const readyJob = createResult.status === "ready"
  ? createResult
  : await waitForReady(jobId, anonUid);
console.log(`✓ Job ready!  output: ${readyJob.output?.sizeBytes ? Math.round(readyJob.output.sizeBytes / 1024) + "KB" : "sizeBytes absent"}`);

// ── Step 6 : read Firestore job doc for telemetry ────────────────────────────
const jobDoc = await readFirestoreDoc(`videoExportJobs/${jobId}`);
console.log("\n=== Telemetry écrite sur le job ===");

const fields = {
  status:                  jobDoc.status,
  estimatedComputeCost:    jobDoc.estimatedComputeCost,
  estimatedStorageCost:    jobDoc.estimatedStorageCost,
  estimatedRequestCost:    jobDoc.estimatedRequestCost,
  estimatedTotalCost:      jobDoc.estimatedTotalCost,
  estimatedTotalCostEur:   jobDoc.estimatedTotalCostEur,
  "rendererResult.elapsedMs":       jobDoc.rendererResult?.elapsedMs,
  "rendererResult.phaseMs":         JSON.stringify(jobDoc.rendererResult?.phaseMs || null),
  "rendererResult.service":         jobDoc.rendererResult?.service,
  "rendererResult.revision":        jobDoc.rendererResult?.revision,
  "rendererResult.region":          jobDoc.rendererResult?.region,
  "rendererResult.allocatedVcpu":   jobDoc.rendererResult?.allocatedVcpu,
  "rendererResult.allocatedMemGib": jobDoc.rendererResult?.allocatedMemoryGib,
  "output.sizeBytes":               jobDoc.output?.sizeBytes,
  devRun:                           jobDoc.devRun,
  source:                           jobDoc.source,
};

let allOk = true;
for (const [key, value] of Object.entries(fields)) {
  const ok = value != null && value !== undefined;
  console.log(`  ${ok ? "✓" : "✗"} ${key}: ${JSON.stringify(value ?? "ABSENT")}`);
  if (!ok && ["estimatedTotalCostEur", "rendererResult.elapsedMs", "status"].includes(key)) {
    allOk = false;
  }
}

// ── Step 7 : call admin telemetry callable pour vérifier vue dev ─────────────
console.log("\n=== Vérification via getVideoExportAdminTelemetry (compte dev matthis) ===");
try {
  const devIdToken = await signInWithEmailLink();
  if (devIdToken) {
    const adminResult = await callCallable("getVideoExportAdminTelemetry", { limit: 10 }, devIdToken);
    const found = (adminResult.jobs || []).find((j) => j.id === jobId);
    if (found) {
      console.log(`✓ Job visible dans la vue admin: estimatedTotalCostEur=${found.estimatedTotalCostEur}`);
    } else {
      console.log(`⚠ Job ${jobId} absent de la vue admin (peut-être hors fenêtre limit:10)`);
    }
    console.log(`  summary.totalJobs: ${adminResult.summary?.totalJobs}`);
    console.log(`  cloudBilling.status: ${adminResult.cloudBilling?.status}`);
  }
} catch (e) {
  console.log(`⚠ Vue admin non vérifiable sans idToken dev: ${e.message}`);
}

console.log(`\n${allOk ? "✓ smoke-vibecut-k1-live-anon: ok" : "✗ smoke-vibecut-k1-live-anon: champs manquants"}`);
console.log(`\nJob Firestore: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data/videoExportJobs/${jobId}`);
console.log(`Backoffice: https://vibefx-v2-web--vibefx-v2.europe-west4.hosted.app/backoffice`);

if (!allOk) process.exit(1);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken() {
  const adc = JSON.parse(readFileSync(ADC_PATH, "utf8"));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     adc.client_id,
      client_secret: adc.client_secret,
      refresh_token: adc.refresh_token,
      grant_type:    "refresh_token",
    }),
  });
  const payload = await response.json();
  if (!payload.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(payload)}`);
  return payload.access_token;
}

async function signInAnonymously() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) }
  );
  const payload = await response.json();
  if (!payload.idToken) throw new Error(`Anonymous sign-in failed: ${JSON.stringify(payload)}`);
  return { uid: payload.localId, idToken: payload.idToken };
}

async function signInWithEmailLink() {
  // On ne peut pas signer par mot de passe ici sans le stocker.
  // On retourne null — la vérification admin est optionnelle dans ce smoke.
  return null;
}

async function uploadToStorage(filePath, storagePath) {
  const fileStat = await stat(filePath);
  const fileBuffer = readFileSync(filePath);
  const encodedPath = encodeURIComponent(storagePath);
  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodedPath}`,
    {
      method: "POST",
      headers: {
        "authorization": `Bearer ${accessToken}`,
        "content-type": "video/mp4",
        "content-length": String(fileBuffer.length),
      },
      body: fileBuffer,
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Storage upload failed ${response.status}: ${text.slice(0, 300)}`);
  }
  return { storagePath, size: fileStat.size, name: path.basename(filePath) };
}

async function buildManifest(uploads, userId) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-k1-anon-manifest-"));
  try {
    const source = await readFile(path.join(
      process.cwd(), "src", "features", "vibefx-studio", "video", "export", "exportManifest.js"
    ), "utf8");
    const tempPath = path.join(tempDir, "exportManifest.mjs");
    await writeFile(tempPath, source, "utf8");
    const { buildExportManifest, validateExportManifest, validateExportRenderCoverage } =
      await import(pathToFileURL(tempPath).href);

    const clips = uploads.map((u, i) => ({
      id: u.id,
      name: u.name,
      sourceStoragePath: u.storagePath,
      start: i === 0 ? 0 : 2.5,
      duration: 3,
      trimStart: 0,
      trimEnd: 3,
      speed: 1,
      volume: 80,
      orientationRotation: 270,
      size: u.size,
      metadata: { sourceSizeBytes: u.size },
    }));

    const manifest = buildExportManifest({
      projectId: exportId,
      projectName: "K1 live anon smoke",
      userId,
      sequencePreset: "instagram-reel",
      exportFps: 30,
      qualityMode: "pro",
      fitMode: "cover",
      generatedAt: new Date().toISOString(),
      preset: { width: 1080, height: 1920, fps: 30 },
      renderPlan: {
        totalDuration: 5.5,
        clips,
        allTransitions: [{
          id: "k1-xfade",
          type: "crossfade",
          start: 2.5,
          duration: 0.5,
          fromItemId: clips[0].id,
          toItemId: clips[1].id,
          params: { placement: "cut" },
        }],
        textOverlays: [{
          id: "k1-title",
          content: "VIBE K1",
          startTime: 0.3,
          endTime: 2.0,
          x: 0.5,
          y: 0.18,
          fontSize: 64,
          color: "#ffffff",
          animation: "fade",
          animationOut: "fade",
        }],
        audioTracks: [],
      },
    });

    const coverage = validateExportRenderCoverage(manifest);
    assert.equal(coverage.supported, true, `Manifest non couvert: ${(coverage.blockingErrors || []).join(", ")}`);
    const validation = validateExportManifest(manifest, { mode: "firebase", allowClientUpload: false });
    assert.equal(validation.status, "ready", `Manifest invalide: ${validation.errors.join(", ")}`);
    return manifest;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function callCallable(fnName, data, idToken) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${fnName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${idToken}`,
      "content-type": "application/json",
      ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(`${fnName} failed ${response.status}: ${JSON.stringify(payload.error || payload).slice(0, 400)}`);
  }
  return payload.result || {};
}

async function getAppCheckToken() {
  if (!APPCHECK_DEBUG_TOKEN) return null;
  const r = await fetch(
    `https://firebaseappcheck.googleapis.com/v1/projects/${PROJECT_ID}/apps/${APP_ID_WEB}:exchangeDebugToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ debug_token: APPCHECK_DEBUG_TOKEN }),
    }
  );
  const p = await r.json();
  if (p.token) return p.token;
  console.log("⚠ App Check debug token exchange failed:", JSON.stringify(p).slice(0, 200));
  return null;
}

async function waitForReady(jobId, _uid) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const doc = await readFirestoreDoc(`videoExportJobs/${jobId}`);
    if (doc.status === "ready")    return doc;
    if (doc.status === "failed")   throw new Error(`Job failed: ${doc.error?.message || "?"}`);
    if (doc.status === "cancelled") throw new Error("Job cancelled");
    console.log(`  … status: ${doc.status}  (${Math.round((Date.now() - startedAt) / 1000)}s)`);
    await sleep(5000);
  }
  throw new Error(`Timeout waiting for job ${jobId}`);
}

async function readFirestoreDoc(docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const response = await fetch(url, {
    headers: { "authorization": `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firestore read failed ${response.status}: ${text.slice(0, 300)}`);
  }
  const doc = await response.json();
  return parseFirestoreFields(doc.fields || {});
}

function parseFirestoreFields(fields) {
  const result = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}

function parseFirestoreValue(val) {
  if (val.stringValue  !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return Number(val.integerValue);
  if (val.doubleValue  !== undefined) return Number(val.doubleValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue    !== undefined) return null;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.mapValue     !== undefined) return parseFirestoreFields(val.mapValue.fields || {});
  if (val.arrayValue   !== undefined) return (val.arrayValue.values || []).map(parseFirestoreValue);
  return null;
}

async function assertSource(filePath) {
  const s = await stat(filePath);
  assert.ok(s.size > 5 * 1024 * 1024, `${filePath} trop petit pour un smoke réel`);
}

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  } catch { /* optional */ }
}

function requiredEnv(...names) {
  for (const name of names) {
    const v = String(process.env[name] || "").trim();
    if (v) return v;
  }
  throw new Error(`Variable env requise manquante: ${names.join(" / ")}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
