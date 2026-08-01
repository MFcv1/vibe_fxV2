import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

loadDotEnvLocal();

const projectId = requiredEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
const apiKey = requiredEnv('NEXT_PUBLIC_FIREBASE_API_KEY');
const storageBucket = requiredEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
const appId = requiredEnv('NEXT_PUBLIC_FIREBASE_APP_ID');
const appCheckDebugToken = requiredEnv('FIREBASE_APPCHECK_DEBUG_TOKEN');
const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || 'europe-west9';
const corpusDir = requiredEnv('VIBECUT_MVP_CORPUS_DIR');
const outputFile = requiredEnv('VIBECUT_MVP_LIVE_OUTPUT');
const timeoutMs = Number(process.env.VIBECUT_LIVE_TIMEOUT_MS || 20 * 60 * 1000);
const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const exportId = `mvp-live-${timestamp}`;
const sourceFiles = [
  {
    id: 'city-pov',
    path: path.join(corpusDir, 'sources', 'pexels-5129237-city.mp4'),
  },
  {
    id: 'coastal-city',
    path: path.join(corpusDir, 'sources', 'pexels-11779328-coastal-60fps.mp4'),
  },
];

await main();

async function main() {
  const accessToken = getGcloudAccessToken();
  const appCheckToken = await exchangeAppCheckToken();
  const auth = await signInAnonymously();
  const baseManifest = JSON.parse(await readFile(path.join(corpusDir, 'cloud-smoke-manifest.json'), 'utf8'));
  const uploads = [];

  for (const source of sourceFiles) {
    const storagePath = `users/${auth.uid}/exports/${exportId}/sources/video/${path.basename(source.path)}`;
    const metadata = await uploadToStorage({ accessToken, sourcePath: source.path, storagePath });
    uploads.push({ ...source, ...metadata });
  }

  const manifest = structuredClone(baseManifest);
  manifest.project.id = exportId;
  manifest.project.name = 'VibeCut MVP — orchestration live';
  manifest.clips = manifest.clips.map((clip) => {
    const upload = uploads.find((item) => item.id === clip.id);
    assert.ok(upload, `Upload absent pour ${clip.id}`);
    return {
      ...clip,
      sourceStoragePath: upload.storagePath,
      metadata: {
        ...clip.metadata,
        sourceSizeBytes: upload.sizeBytes,
      },
    };
  });

  const createResult = await callCallable({
    functionName: 'createVideoExportJob',
    idToken: auth.idToken,
    appCheckToken,
    data: { manifest },
  });
  assert.ok(createResult.jobId, 'createVideoExportJob doit retourner un jobId.');
  assert.equal(createResult.orchestration, 'cloudRunJobs');
  assert.equal(createResult.renderProfile, 'cpu-pro60');

  const readyJob = await waitForReady({
    accessToken,
    jobId: createResult.jobId,
  });
  assert.equal(readyJob.status, 'ready');
  assert.equal(readyJob.rendererResult?.mode, 'cloud-run-job-ffmpeg');
  assert.equal(readyJob.rendererResult?.renderProfile, 'cpu-pro60');

  const download = await callCallable({
    functionName: 'getVideoExportDownloadUrl',
    idToken: auth.idToken,
    appCheckToken,
    data: { jobId: createResult.jobId },
  });
  assert.ok(download.downloadUrl, 'URL de téléchargement absente.');
  assert.equal(download.downloadMode, 'vibecut-proxy');
  const response = await fetch(download.downloadUrl);
  assert.equal(response.ok, true, `Téléchargement MP4 impossible (${response.status}).`);
  const output = Buffer.from(await response.arrayBuffer());
  assert.ok(output.length > 1024 * 1024, 'MP4 live trop petit.');
  await writeFile(outputFile, output);

  console.log(JSON.stringify({
    ok: true,
    projectId,
    jobId: createResult.jobId,
    orchestration: createResult.orchestration,
    renderProfile: createResult.renderProfile,
    outputFile,
    outputBytes: output.length,
    downloadMode: download.downloadMode,
    status: readyJob.status,
    renderer: {
      mode: readyJob.rendererResult?.mode,
      elapsedMs: readyJob.rendererResult?.elapsedMs,
      phaseMs: readyJob.rendererResult?.phaseMs,
      executionName: readyJob.rendererResult?.executionName,
    },
    costEstimate: readyJob.costEstimate || null,
  }, null, 2));
}

function getGcloudAccessToken() {
  const environment = {
    ...process.env,
    CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Users/matthis/.local/bin/python3.11',
  };
  return execFileSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
    env: environment,
  }).trim();
}

async function exchangeAppCheckToken() {
  const response = await fetch(
    `https://firebaseappcheck.googleapis.com/v1/projects/${projectId}/apps/${appId}:exchangeDebugToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ debugToken: appCheckDebugToken }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!payload.token) {
    throw new Error(`App Check debug exchange failed (${response.status}).`);
  }
  return payload.token;
}

async function signInAnonymously() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!payload.idToken || !payload.localId) {
    throw new Error(`Firebase anonymous sign-in failed (${response.status}).`);
  }
  return { uid: payload.localId, idToken: payload.idToken };
}

async function uploadToStorage({ accessToken, sourcePath, storagePath }) {
  const source = await readFile(sourcePath);
  const sourceStat = await stat(sourcePath);
  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${storageBucket}/o?uploadType=media&name=${encodeURIComponent(storagePath)}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'video/mp4',
        'content-length': String(source.length),
      },
      body: source,
    },
  );
  if (!response.ok) {
    throw new Error(`Storage upload failed (${response.status}).`);
  }
  return { storagePath, sizeBytes: sourceStat.size };
}

async function callCallable({ functionName, idToken, appCheckToken, data }) {
  const response = await fetch(`https://${region}-${projectId}.cloudfunctions.net/${functionName}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
      'x-firebase-appcheck': appCheckToken,
    },
    body: JSON.stringify({ data }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(`${functionName} failed (${response.status}): ${payload.error?.message || 'unknown'}`);
  }
  return payload.result || {};
}

async function waitForReady({ accessToken, jobId }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = await readFirestoreDocument({ accessToken, documentPath: `videoExportJobs/${jobId}` });
    if (job.status === 'ready') return job;
    if (job.status === 'failed') {
      throw new Error(`Export failed: ${job.error?.message || 'unknown'}`);
    }
    if (job.status === 'cancelled') throw new Error('Export cancelled.');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Timeout waiting for ${jobId}.`);
}

async function readFirestoreDocument({ accessToken, documentPath }) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error(`Firestore read failed (${response.status}).`);
  const document = await response.json();
  return parseFirestoreFields(document.fields || {});
}

function parseFirestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, parseFirestoreValue(value)]));
}

function parseFirestoreValue(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.mapValue !== undefined) return parseFirestoreFields(value.mapValue.fields || {});
  if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(parseFirestoreValue);
  return null;
}

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    const text = readFileSync(envPath, 'utf8');
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const separator = trimmed.indexOf('=');
      if (separator <= 0) return;
      const name = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[name] === undefined) process.env[name] = value;
    });
  } catch {
    // requiredEnv supplies the actionable error.
  }
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
