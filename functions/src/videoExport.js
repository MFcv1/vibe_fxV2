"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onTaskDispatched } = require("firebase-functions/v2/tasks");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { getFunctions } = require("firebase-admin/functions");
const crypto = require("crypto");
const { shouldEnforceAppCheck } = require("./appCheck");
const { RENDER_PROFILES, selectRenderProfile } = require("./videoRenderProfiles");

const REGION = "europe-west9";
const TASK_QUEUE_REGION = "europe-west1";
const ENFORCE_EXPORT_APP_CHECK = shouldEnforceAppCheck("ENFORCE_EXPORT_APP_CHECK");
const EXPORT_SIGNING_SECRET = defineSecret("EXPORT_SIGNING_SECRET");
const EXPORT_JOBS_COLLECTION = "videoExportJobs";
const EXPORT_TASK_QUEUE_FUNCTION = "processVideoExportJob";
const EXPORT_TASK_QUEUE_RESOURCE = `locations/${TASK_QUEUE_REGION}/functions/${EXPORT_TASK_QUEUE_FUNCTION}`;
const TERMINAL_STATUSES = new Set(["ready", "failed", "cancelled"]);
const RETRYABLE_STATUSES = new Set(["failed", "cancelled"]);
const MAX_MANIFEST_BYTES = 750 * 1024;
const EXPORT_QUOTAS = Object.freeze({
  maxManifestBytes: MAX_MANIFEST_BYTES,
  maxDurationSeconds: 15 * 60,
  maxClips: 240,
  maxAudioTracks: 8,
  maxWidth: 3840,
  maxHeight: 3840,
  maxPixels: 3840 * 2160,
  maxFps: 60,
  maxVideoBitrate: 60_000_000,
  maxAudioBitrate: 320_000,
  maxSourceBytes: 6 * 1024 * 1024 * 1024,
});
const DOWNLOAD_URL_TTL_MS = 15 * 60 * 1000;
/*
 * Transitions minutees acceptees a la validation serveur. Doit rester identique a
 * SERVER_XFADE_TRANSITION_MAP (render-service/src/server.js et exportManifest.js) :
 * scripts/smoke-vibecut-transition-parity.mjs echoue si les trois divergent.
 */
const SERVER_XFADE_TRANSITIONS = new Set([
  "fade",
  "crossfade",
  "dip-black",
  "dip-white",
  "film-dissolve",
  "desat-fade",
  "swipe-left",
  "swipe-right",
  "push-up",
  "push-down",
  "wipe-left",
  "blinds-open",
  "iris-open",
  "iris-close",
  "pixel-cut",
  "blur-cut",
  // Lot B3a (2026-08-02) : voir exportManifest.js. Huit re-affectations et dix
  // cibles xfade natives nouvelles. La validation serveur doit les accepter,
  // sinon un montage legitime serait refuse au pre-vol.
  "smooth-cut",
  "non-additive-dissolve",
  "whip-pan",
  "flash",
  "intro-cinematic-bars",
  "outro-cinematic-fade",
  "outro-neon-close",
  "outro-signal-collapse",
  "wipe-right",
  "wipe-up",
  "wipe-down",
  "push-right",
  "swipe-up",
  "swipe-down",
  "bars-close",
  "iris-black",
  "frame-black",
  "squeeze-h",
  // Lot B3b (2026-08-03) : voir exportManifest.js. Ces transitions-la n'ont pas
  // de cible xfade native qui rende leur effet - il vient d'un sous-graphe de
  // filtres natifs rampes, declare dans SERVER_TRANSITION_EFFECTS.
  "blur-dissolve",
  "cross-blur",
  "motion-blur",
  "cross-zoom",
  "snap-zoom",
  "parallax-zoom",
  "additive-dissolve",
  "rgb-split",
  "chromatic",
  "intro-title-scan",
  "intro-neon-doors",
  "strobe-cut",
  "intro-grid-reveal",
  "glitch",
  "light-leak",
]);
/*
 * Effets du lot B3b. Table TRIPLIQUEE a l'identique avec exportManifest.js et
 * render-service/src/server.js ; scripts/smoke-vibecut-transition-parity.mjs
 * echoue si les trois divergent. La validation Functions n'a pas besoin des
 * valeurs pour accepter un manifeste, mais les porter ici est ce qui garantit
 * qu'un id ajoute d'un seul cote soit attrape.
 */
const SERVER_TRANSITION_EFFECTS = Object.freeze({
  "blur-dissolve": Object.freeze({effect: "blur", amount: 0.013, curve: "ramp"}),
  "cross-blur": Object.freeze({effect: "blur", amount: 0.026, curve: "bell"}),
  "motion-blur": Object.freeze({effect: "motion-blur", amount: 0.030, curve: "bell"}),
  "cross-zoom": Object.freeze({effect: "zoom", amount: 0.50, curve: "ramp", pan: 0}),
  "snap-zoom": Object.freeze({effect: "zoom", amount: 1.10, curve: "cubic", pan: 0}),
  "parallax-zoom": Object.freeze({effect: "zoom", amount: 0.34, curve: "ramp", pan: 0.8}),
  "additive-dissolve": Object.freeze({effect: "lift", amount: 0.30, curve: "bell"}),
  "rgb-split": Object.freeze({effect: "rgb-split", amount: 0.018, curve: "bell"}),
  "chromatic": Object.freeze({effect: "chromatic", amount: 0.022, curve: "bell"}),
  "intro-title-scan": Object.freeze({effect: "edge-bar", axis: "x", edges: 1, amount: 0.55, width: 0.055}),
  "intro-neon-doors": Object.freeze({effect: "edge-bar", axis: "x", edges: 2, amount: 0.5, width: 0.05}),
  "strobe-cut": Object.freeze({effect: "strobe", cycles: 7}),
  "intro-grid-reveal": Object.freeze({effect: "grid-reveal", cols: 8, rows: 5}),
  "glitch": Object.freeze({effect: "glitch", bands: 16, amount: 0.035, curve: "bell", shift: 0.010}),
  "light-leak": Object.freeze({effect: "light-leak", amount: 0.62, radius: 0.85, tint: "0xffb432"}),
});
const TRANSITION_EFFECT_STEPS = 12;
const SUPPORTED_SERVER_TRANSITIONS = new Set(["cut", ...SERVER_XFADE_TRANSITIONS]);
const SUPPORTED_SERVER_FIT_MODES = new Set(["cover", "contain"]);
const SUPPORTED_SERVER_TEXT_ANIMATIONS = new Set(["none", "fade"]);
const SUPPORTED_SERVER_MEDIA_TYPES = new Set(["video", "image"]);
const SUPPORTED_SERVER_MOTION_ACCENTS = new Set(["none", "shake", "pulse", "leak", "grain", "softness"]);
const SUPPORTED_SERVER_IMAGE_MOTIONS = new Set([
  "none", "zoom-in", "zoom-out", "pan-left", "pan-right", "drift-up",
  "drift-down", "orbit", "bounce", "rotate", "appear", "glitch",
]);
const DEFAULT_FILTERS = Object.freeze({
  exposure: 0,
  brightness: 100,
  contrast: 100,
  pivot: 50,
  saturation: 100,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  hue: 0,
  shadows: 0,
  midtones: 0,
  highlights: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
});
const BILLING_TELEMETRY_DAYS = 31;
const BILLING_TABLE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const RENDERER_COST_ASSUMPTIONS = Object.freeze({
  cpuSecondUsd: 0.000024,
  memoryGibSecondUsd: 0.0000025,
  requestUsd: 0.0000004,
  storageGibMonthUsd: 0.026,
  egressGibUsd: 0.12,
  usdToEur: 0.92,
});

function estimateJobCostServer({ elapsedMs, allocatedVcpu, allocatedMemoryGib, outputBytes }) {
  const billableSeconds = Math.ceil(finiteNumber(elapsedMs, 0) / 100) / 10;
  const vcpu = finiteNumber(allocatedVcpu, Number(process.env.EXPORT_RENDERER_ALLOCATED_VCPU || 2));
  const memGib = finiteNumber(allocatedMemoryGib, Number(process.env.EXPORT_RENDERER_ALLOCATED_MEMORY_GIB || 2));
  const outputGib = finiteNumber(outputBytes, 0) / (1024 ** 3);
  const computeCpuUsd = billableSeconds * vcpu * RENDERER_COST_ASSUMPTIONS.cpuSecondUsd;
  const computeMemUsd = billableSeconds * memGib * RENDERER_COST_ASSUMPTIONS.memoryGibSecondUsd;
  const requestUsd = RENDERER_COST_ASSUMPTIONS.requestUsd;
  const storageUsd = outputGib * RENDERER_COST_ASSUMPTIONS.storageGibMonthUsd;
  const egressUsd = outputGib * RENDERER_COST_ASSUMPTIONS.egressGibUsd;
  const totalUsd = computeCpuUsd + computeMemUsd + requestUsd + storageUsd + egressUsd;
  return {
    billableSeconds,
    estimatedComputeCost: Math.round((computeCpuUsd + computeMemUsd) * 1e6) / 1e6,
    estimatedStorageCost: Math.round((storageUsd + egressUsd) * 1e6) / 1e6,
    estimatedRequestCost: Math.round(requestUsd * 1e6) / 1e6,
    estimatedTotalCost: Math.round(totalUsd * 1e6) / 1e6,
    estimatedTotalCostEur: Math.round(totalUsd * RENDERER_COST_ASSUMPTIONS.usdToEur * 1e6) / 1e6,
    currency: "USD",
    assumptions: {
      vcpu,
      memGib,
      cpuSecondUsd: RENDERER_COST_ASSUMPTIONS.cpuSecondUsd,
      memoryGibSecondUsd: RENDERER_COST_ASSUMPTIONS.memoryGibSecondUsd,
    },
  };
}

let cachedBigQueryClient = null;

function assertAuthenticated(request) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Connexion utilisateur requise.");
  }
  return uid;
}

async function assertExportAdmin(request) {
  const email = request.auth?.token?.email?.toLowerCase();
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const hasVerifiedAdminEmail = Boolean(email && adminEmails.includes(email));
  let hasAdminAccessDoc = false;
  if (email) {
    const snapshot = await admin.firestore().collection("admins").doc(email).get();
    hasAdminAccessDoc = snapshot.exists && snapshot.data()?.status === "active";
  }
  const isAdmin = request.auth?.token?.admin === true || hasVerifiedAdminEmail || hasAdminAccessDoc;
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Acces admin requis.");
  }
}

function requireJobId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError("invalid-argument", "jobId invalide.");
  }
  return value;
}

function jsonByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value || {}), "utf8");
}

function validatePositiveNumber(value, field, errors) {
  if (!Number.isFinite(value) || value <= 0) {
    errors.push(`${field} invalide`);
  }
}

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function billingEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function parseBillingExportTable() {
  const fullTable = billingEnv("CLOUD_BILLING_EXPORT_TABLE", "BILLING_EXPORT_TABLE");
  if (fullTable) {
    const parts = fullTable.split(".").map((item) => item.trim()).filter(Boolean);
    if (parts.length === 3 && parts.every((part) => BILLING_TABLE_ID_PATTERN.test(part))) {
      return { projectId: parts[0], datasetId: parts[1], tableId: parts[2] };
    }
    throw new HttpsError("failed-precondition", "CLOUD_BILLING_EXPORT_TABLE doit etre au format project.dataset.table.");
  }

  const projectId = billingEnv("CLOUD_BILLING_EXPORT_PROJECT_ID", "BILLING_EXPORT_PROJECT_ID");
  const datasetId = billingEnv("CLOUD_BILLING_EXPORT_DATASET", "BILLING_EXPORT_DATASET");
  const tableId = billingEnv("CLOUD_BILLING_EXPORT_TABLE_ID", "BILLING_EXPORT_TABLE_ID");
  if (!projectId && !datasetId && !tableId) return null;
  if (![projectId, datasetId, tableId].every((part) => BILLING_TABLE_ID_PATTERN.test(part))) {
    throw new HttpsError("failed-precondition", "Configuration Billing Export BigQuery invalide.");
  }
  return { projectId, datasetId, tableId };
}

function getBillingProjectFilter() {
  return billingEnv("CLOUD_BILLING_EXPORT_TARGET_PROJECT_ID", "BILLING_EXPORT_TARGET_PROJECT_ID", "GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT");
}

function getBigQueryClient() {
  if (!cachedBigQueryClient) {
    // Loaded lazily so local tests without Billing Export configuration keep working.
    const { BigQuery } = require("@google-cloud/bigquery");
    cachedBigQueryClient = new BigQuery();
  }
  return cachedBigQueryClient;
}

function formatBillingTableName(table) {
  return `\`${table.projectId}.${table.datasetId}.${table.tableId}\``;
}

function assertCloudBillingRow(row = {}) {
  return {
    usageDate: row.usageDate?.value || row.usageDate || null,
    service: String(row.service || "Unknown"),
    sku: String(row.sku || "Unknown"),
    projectId: String(row.projectId || ""),
    location: String(row.location || ""),
    currency: String(row.currency || ""),
    cost: finiteNumber(row.cost, 0),
    credits: finiteNumber(row.credits, 0),
    netCost: finiteNumber(row.netCost, 0),
  };
}

async function getCloudBillingTelemetry() {
  const table = parseBillingExportTable();
  if (!table) {
    return {
      status: "not_configured",
      source: "cloud-billing-bigquery",
      message: "Billing Export BigQuery non configure: cout Google reel indisponible.",
      generatedAt: new Date().toISOString(),
    };
  }

  const targetProjectId = getBillingProjectFilter();
  const tableName = formatBillingTableName(table);
  const query = `
    SELECT
      DATE(usage_start_time) AS usageDate,
      service.description AS service,
      sku.description AS sku,
      project.id AS projectId,
      location.location AS location,
      currency AS currency,
      SUM(cost) AS cost,
      SUM(IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0)) AS credits,
      SUM(cost) + SUM(IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0)) AS netCost
    FROM ${tableName}
    WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
      AND (@targetProjectId = "" OR project.id = @targetProjectId)
      AND (
        LOWER(service.description) LIKE "%cloud run%"
        OR LOWER(sku.description) LIKE "%cloud run%"
        OR LOWER(sku.description) LIKE "%run functions%"
      )
    GROUP BY usageDate, service, sku, projectId, location, currency
    ORDER BY usageDate DESC, netCost DESC
    LIMIT 500
  `;

  try {
    const [rows] = await getBigQueryClient().query({
      query,
      params: {
        days: BILLING_TELEMETRY_DAYS,
        targetProjectId,
      },
    });
    const normalizedRows = rows.map(assertCloudBillingRow);
    const currency = normalizedRows.find((row) => row.currency)?.currency || "EUR";
    const totalCost = normalizedRows.reduce((total, row) => total + row.cost, 0);
    const totalCredits = normalizedRows.reduce((total, row) => total + row.credits, 0);
    const totalNetCost = normalizedRows.reduce((total, row) => total + row.netCost, 0);
    const services = Array.from(normalizedRows.reduce((map, row) => {
      const current = map.get(row.service) || {
        service: row.service,
        cost: 0,
        credits: 0,
        netCost: 0,
        currency: row.currency || currency,
      };
      current.cost += row.cost;
      current.credits += row.credits;
      current.netCost += row.netCost;
      map.set(row.service, current);
      return map;
    }, new Map()).values()).sort((a, b) => b.netCost - a.netCost);

    return {
      status: "ready",
      source: "cloud-billing-bigquery",
      table: `${table.projectId}.${table.datasetId}.${table.tableId}`,
      targetProjectId: targetProjectId || null,
      days: BILLING_TELEMETRY_DAYS,
      currency,
      totalCost,
      totalCredits,
      totalNetCost,
      services,
      rows: normalizedRows,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("cloud_billing_export_telemetry_failed", {
      message: error.message || "BigQuery query failed",
      table: `${table.projectId}.${table.datasetId}.${table.tableId}`,
      targetProjectId: targetProjectId || null,
    });
    return {
      status: "error",
      source: "cloud-billing-bigquery",
      table: `${table.projectId}.${table.datasetId}.${table.tableId}`,
      targetProjectId: targetProjectId || null,
      message: error.message || "Lecture Billing Export BigQuery impossible.",
      generatedAt: new Date().toISOString(),
    };
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceSizeBytes(source = {}) {
  return Math.max(0, Math.round(finiteNumber(
    source.sourceSizeBytes ?? source.metadata?.sourceSizeBytes,
    0
  )));
}

function estimateManifestSourceBytes(manifest = {}) {
  return [
    ...(manifest.clips || []).map(sourceSizeBytes),
    ...(manifest.audioTracks || []).map(sourceSizeBytes),
  ].reduce((sum, value) => sum + value, 0);
}

function isSafeRelativeStoragePath(storagePath) {
  return typeof storagePath === "string" &&
    storagePath.length <= 1024 &&
    !storagePath.startsWith("/") &&
    !storagePath.includes("..") &&
    !storagePath.includes("//");
}

function validateOwnerSourceStoragePath({ storagePath, uid, mediaType, field, errors }) {
  if (!storagePath || typeof storagePath !== "string") {
    errors.push(`${field} requis pour le rendu serveur`);
    return;
  }
  if (!isSafeRelativeStoragePath(storagePath)) {
    errors.push(`${field} chemin Storage invalide`);
    return;
  }
  const typeFolder = mediaType === "audio" ? "audio" : mediaType === "image" ? "image" : "video";
  if (!uid) {
    if (!storagePath.includes(`/sources/${typeFolder}/`)) {
      errors.push(`${field} doit pointer vers sources/${typeFolder}`);
    }
    return;
  }
  const ownerPattern = new RegExp(`^users/${escapeRegExp(uid)}/exports/[^/]+/sources/${typeFolder}/[^/]+$`);
  if (!ownerPattern.test(storagePath)) {
    errors.push(`${field} doit rester owner-scoped dans users/{uid}/exports/{job}/sources/${typeFolder}/`);
  }
}

function isOwnerOutputStoragePath(uid, storagePath) {
  if (!uid || !isSafeRelativeStoragePath(storagePath)) return false;
  const ownerPattern = new RegExp(`^users/${escapeRegExp(uid)}/exports/[^/]+/outputs/[^/]+$`);
  return ownerPattern.test(storagePath);
}

function validateExportQuotas(manifest, errors) {
  const render = manifest.render || {};
  const project = manifest.project || {};
  const width = finiteNumber(render.width, 0);
  const height = finiteNumber(render.height, 0);
  const fps = finiteNumber(render.fps, 0);
  const duration = finiteNumber(project.duration, 0);
  const targetBitrate = finiteNumber(render.targetBitrate, 0);
  const audioBitrate = finiteNumber(render.audioBitrate, 0);
  const clips = Array.isArray(manifest.clips) ? manifest.clips : [];
  const audioTracks = Array.isArray(manifest.audioTracks) ? manifest.audioTracks : [];
  const sourceBytes = estimateManifestSourceBytes(manifest);

  if (duration > EXPORT_QUOTAS.maxDurationSeconds) {
    errors.push(`duree export limitee a ${EXPORT_QUOTAS.maxDurationSeconds}s`);
  }
  if (clips.length > EXPORT_QUOTAS.maxClips) {
    errors.push(`nombre de clips limite a ${EXPORT_QUOTAS.maxClips}`);
  }
  if (audioTracks.length > EXPORT_QUOTAS.maxAudioTracks) {
    errors.push(`nombre de pistes audio limite a ${EXPORT_QUOTAS.maxAudioTracks}`);
  }
  if (width > EXPORT_QUOTAS.maxWidth || height > EXPORT_QUOTAS.maxHeight || width * height > EXPORT_QUOTAS.maxPixels) {
    errors.push("resolution export au-dessus du quota MVP");
  }
  if (fps > EXPORT_QUOTAS.maxFps) {
    errors.push(`fps export limite a ${EXPORT_QUOTAS.maxFps}`);
  }
  if (targetBitrate > EXPORT_QUOTAS.maxVideoBitrate) {
    errors.push("bitrate video au-dessus du quota MVP");
  }
  if (audioBitrate > EXPORT_QUOTAS.maxAudioBitrate) {
    errors.push("bitrate audio au-dessus du quota MVP");
  }
  if (sourceBytes > EXPORT_QUOTAS.maxSourceBytes) {
    errors.push("taille source cumulee au-dessus du quota MVP");
  }
}

function validateColorFilterCoverage(filters = {}, label, errors) {
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (DEFAULT_FILTERS[key] === undefined && Number(value) !== 0) {
      errors.push(`filtre colorimetrie non supporte serveur: ${label}.${key}`);
    }
  });
}

function validateExportRenderCoverage(manifest, errors) {
  const clips = Array.isArray(manifest.clips) ? manifest.clips : [];
  const fitMode = manifest.render?.fitMode || "cover";

  validateServerTransitionCoverage(
    Array.isArray(manifest.transitions) ? manifest.transitions : [],
    clips,
    errors
  );

  validateTextOverlayCoverage(
    Array.isArray(manifest.textOverlays) ? manifest.textOverlays : [],
    errors
  );

  clips.forEach((clip, index) => {
    const label = clip.name || clip.id || `clip-${index + 1}`;
    const mediaType = clip.mediaType || "video";
    if (!SUPPORTED_SERVER_MEDIA_TYPES.has(mediaType)) {
      errors.push(`type media non rendu serveur: ${label}.${mediaType}`);
    }
    if (mediaType === "image" && !SUPPORTED_SERVER_IMAGE_MOTIONS.has(clip.motion?.preset || "none")) {
      errors.push(`mouvement photo non rendu serveur: ${label}.${clip.motion?.preset || "none"}`);
    }
    if (!SUPPORTED_SERVER_MOTION_ACCENTS.has(clip.motion?.accent || "none")) {
      errors.push(`accent de mouvement non rendu serveur: ${label}.${clip.motion?.accent}`);
    }
    const speed = finiteNumber(clip.speed, 1);
    if (Math.abs(speed - 1) > 0.001) {
      errors.push(`vitesse clip non rendue serveur: ${label}`);
    }
    if (!SUPPORTED_SERVER_FIT_MODES.has(clip.fitMode || fitMode)) {
      errors.push(`fit mode non supporte serveur: ${label}`);
    }
    validateColorFilterCoverage(clip.filters || {}, label, errors);
  });

}

function validateServerTransitionCoverage(transitions, clips, errors) {
  const adjacentPairs = new Set();
  for (let index = 0; index < clips.length - 1; index += 1) {
    const fromId = clips[index]?.id;
    const toId = clips[index + 1]?.id;
    if (fromId && toId) adjacentPairs.add(`${fromId}->${toId}`);
  }

  transitions.forEach((transition) => {
    const type = transition.type || "transition";
    const duration = finiteNumber(transition.duration, 0);
    const pairKey = `${transition.fromItemId || ""}->${transition.toItemId || ""}`;
    const placement = transition.params?.placement;
    const isCutPlacement = placement === "cut" || placement === undefined;

    if (!SUPPORTED_SERVER_TRANSITIONS.has(type)) {
      errors.push(`transition non rendue serveur: ${type}`);
      return;
    }
    if (duration <= 0) return;
    if (!SERVER_XFADE_TRANSITIONS.has(type)) {
      errors.push(`transition non rendue serveur avec duree: ${type}`);
      return;
    }
    if (!isCutPlacement || !adjacentPairs.has(pairKey)) {
      errors.push(`transition ${type} non adjacente non rendue serveur: ${pairKey}`);
    }
  });
}

function validateTextOverlayCoverage(textOverlays, errors) {
  textOverlays.forEach((text, index) => {
    const label = text.id || `text-${index + 1}`;
    if (!String(text.content || "").trim()) {
      errors.push(`texte vide non rendu serveur: ${label}`);
    }
    if (finiteNumber(text.endTime, 0) <= finiteNumber(text.startTime, 0)) {
      errors.push(`timing texte invalide: ${label}`);
    }
    const animation = text.animation || "fade";
    const animationOut = text.animationOut || "fade";
    if (!SUPPORTED_SERVER_TEXT_ANIMATIONS.has(animation)) {
      errors.push(`animation texte non rendue serveur: ${animation}`);
    }
    if (!SUPPORTED_SERVER_TEXT_ANIMATIONS.has(animationOut)) {
      errors.push(`animation sortie texte non rendue serveur: ${animationOut}`);
    }
  });
}

function validateExportManifest(manifest, context = {}) {
  const errors = [];
  const uid = context.uid || null;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["manifest requis"];
  }
  if (jsonByteSize(manifest) > EXPORT_QUOTAS.maxManifestBytes) {
    errors.push("manifest trop volumineux");
  }
  if (manifest.version !== 1) {
    errors.push("version manifeste non supportee");
  }

  const render = manifest.render || {};
  if (render.format !== "mp4") errors.push("format mp4 requis");
  if (render.videoCodec !== "h264") errors.push("codec video h264 requis");
  if (render.audioCodec !== "aac") errors.push("codec audio aac requis");
  validatePositiveNumber(render.width, "render.width", errors);
  validatePositiveNumber(render.height, "render.height", errors);
  validatePositiveNumber(render.fps, "render.fps", errors);

  const project = manifest.project || {};
  validatePositiveNumber(project.duration, "project.duration", errors);
  validateExportQuotas(manifest, errors);
  validateExportRenderCoverage(manifest, errors);

  if (!Array.isArray(manifest.clips) || !manifest.clips.length) {
    errors.push("au moins un clip est requis");
  } else {
    manifest.clips.forEach((clip, index) => {
      if (!clip || typeof clip !== "object") {
        errors.push(`clips[${index}] invalide`);
        return;
      }
      validateOwnerSourceStoragePath({
        storagePath: clip.sourceStoragePath,
        uid,
        mediaType: clip.mediaType === "image" ? "image" : "video",
        field: `clips[${index}].sourceStoragePath`,
        errors,
      });
      validatePositiveNumber(clip.duration, `clips[${index}].duration`, errors);
      if (finiteNumber(clip.trimEnd, 0) <= finiteNumber(clip.trimStart, 0)) {
        errors.push(`clips[${index}].trim invalide`);
      }
    });
  }

  if (Array.isArray(manifest.audioTracks)) {
    manifest.audioTracks.forEach((track, index) => {
      if (!track || typeof track !== "object") {
        errors.push(`audioTracks[${index}] invalide`);
        return;
      }
      validateOwnerSourceStoragePath({
        storagePath: track.sourceStoragePath,
        uid,
        mediaType: "audio",
        field: `audioTracks[${index}].sourceStoragePath`,
        errors,
      });
      validatePositiveNumber(track.duration, `audioTracks[${index}].duration`, errors);
      if (finiteNumber(track.trimEnd, 0) <= finiteNumber(track.trimStart, 0)) {
        errors.push(`audioTracks[${index}].trim invalide`);
      }
    });
  }

  return errors;
}

function exportJobsRef() {
  return admin.firestore().collection(EXPORT_JOBS_COLLECTION);
}

function getExportRendererUrl() {
  return String(process.env.EXPORT_RENDERER_URL || "").trim();
}

function getExportRendererAuthMode() {
  return String(process.env.EXPORT_RENDERER_AUTH_MODE || "hmac").trim().toLowerCase();
}

function resolveRendererAuthRequirements(mode = getExportRendererAuthMode()) {
  if (mode === "hmac") return { needsHmac: true, needsOidc: false };
  if (mode === "hmac+oidc") return { needsHmac: true, needsOidc: true };
  if (mode === "oidc") return { needsHmac: false, needsOidc: true };
  throw new HttpsError("failed-precondition", `EXPORT_RENDERER_AUTH_MODE invalide: ${mode}`);
}

function getExportRenderOrchestrationMode() {
  return String(process.env.EXPORT_RENDER_ORCHESTRATION || "sync").trim().toLowerCase();
}

function shouldUseTaskQueueOrchestration() {
  return ["taskqueue", "cloudrunjobs"].includes(getExportRenderOrchestrationMode());
}

function shouldUseCloudRunJobsOrchestration() {
  return getExportRenderOrchestrationMode() === "cloudrunjobs";
}

function getCloudRunProjectId() {
  return String(
    process.env.EXPORT_RENDERER_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    admin.app().options.projectId ||
    ""
  ).trim();
}

function getCloudRunJobsRegion() {
  return String(process.env.EXPORT_RENDERER_JOBS_REGION || TASK_QUEUE_REGION).trim();
}

function getCloudRunApiBaseUrl() {
  return String(process.env.EXPORT_CLOUD_RUN_API_BASE_URL || "https://run.googleapis.com").replace(/\/+$/, "");
}

function cloudRunJobResource(profile) {
  const projectId = getCloudRunProjectId();
  if (!projectId) {
    throw new HttpsError("failed-precondition", "Projet Google Cloud introuvable pour Cloud Run Jobs.");
  }
  return `projects/${projectId}/locations/${getCloudRunJobsRegion()}/jobs/${profile.jobName}`;
}

async function getGoogleAccessToken() {
  const credential = admin.app().options.credential;
  if (!credential || typeof credential.getAccessToken !== "function") {
    throw new HttpsError("failed-precondition", "Credential Google Cloud sans jeton d'acces.");
  }
  const result = await credential.getAccessToken();
  const token = result?.access_token || result?.accessToken;
  if (!token) {
    throw new HttpsError("failed-precondition", "Jeton Google Cloud indisponible.");
  }
  return token;
}

async function callCloudRunApi(resourceName, action, body = {}) {
  const token = await getGoogleAccessToken();
  const url = `${getCloudRunApiBaseUrl()}/v2/${resourceName}:${action}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpsError("internal", `Cloud Run ${action} a echoue.`, {
      status: response.status,
      message: payload.error?.message || payload.message || "cloud-run-api-error",
    });
  }
  return payload;
}

async function claimCloudRunJobLaunch(ref, profile) {
  return admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    if (TERMINAL_STATUSES.has(data.status) || data.cloudRun?.launchClaimedAt) {
      return false;
    }
    transaction.set(ref, {
      status: "queued",
      phase: "launching",
      progress: 24,
      renderProfile: profile.id,
      cloudRun: {
        jobName: profile.jobName,
        region: getCloudRunJobsRegion(),
        launchClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      logs: admin.firestore.FieldValue.arrayUnion(publicLog(`Profil ${profile.id} selectionne; lancement Cloud Run Job.`)),
    }, { merge: true });
    return true;
  });
}

async function launchCloudRunJobForExport({ ref, data, jobId, uid, manifest }) {
  const profile = selectRenderProfile(manifest, {
    gpuEnabled: process.env.EXPORT_GPU_ENABLED === "true",
    explicitProfile: data.renderProfile,
  });
  const claimed = await claimCloudRunJobLaunch(ref, profile);
  if (!claimed) {
    return {
      jobId,
      status: data.status,
      phase: data.phase || data.status,
      progress: data.progress || 0,
      skipped: true,
    };
  }

  const bucketName = admin.storage().bucket().name;
  const resourceName = cloudRunJobResource(profile);
  const operation = await callCloudRunApi(resourceName, "run", {
    overrides: {
      taskCount: 1,
      timeout: "7200s",
      containerOverrides: [{
        env: [
          { name: "VIBECUT_EXPORT_JOB_ID", value: jobId },
          { name: "VIBECUT_EXPORT_UID", value: uid },
          { name: "FIREBASE_PROJECT_ID", value: getCloudRunProjectId() },
          { name: "STORAGE_BUCKET", value: bucketName },
          { name: "MANIFEST_STORAGE_PATH", value: data.manifestStoragePath },
          { name: "OUTPUT_STORAGE_PATH", value: data.outputStoragePath || buildOutputStoragePath(uid, jobId) },
          { name: "RENDER_PROFILE", value: profile.id },
          { name: "EXPORT_RENDERER_ALLOCATED_VCPU", value: String(profile.vcpu) },
          { name: "EXPORT_RENDERER_ALLOCATED_MEMORY_GIB", value: String(profile.memoryGib) },
        ],
      }],
    },
  });

  await ref.set({
    phase: "launched",
    progress: 28,
    cloudRun: {
      jobName: profile.jobName,
      jobResource: resourceName,
      operationName: operation.name || null,
      region: getCloudRunJobsRegion(),
      launchedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    logs: admin.firestore.FieldValue.arrayUnion(publicLog("Cloud Run Job lance; le worker prend la main sur le rendu.")),
  }, { merge: true });

  return {
    jobId,
    status: "queued",
    phase: "launched",
    progress: 28,
    renderProfile: profile.id,
    operationName: operation.name || null,
  };
}

async function cancelCloudRunExecution(executionName) {
  if (!executionName) return false;
  await callCloudRunApi(executionName, "cancel");
  return true;
}

function getExportSigningSecret() {
  return String(EXPORT_SIGNING_SECRET.value() || "").trim();
}

function buildRendererSignature(body, secret, timestamp = Date.now()) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function buildOutputStoragePath(uid, jobId) {
  return `users/${uid}/exports/${jobId}/outputs/export.mp4`;
}

function buildManifestStoragePath(uid, jobId) {
  return `users/${uid}/exports/${jobId}/manifest/export-manifest.json`;
}

async function createOutputDownloadUrl(storagePath, expiresInMs = 60 * 60 * 1000) {
  try {
    const [url] = await admin.storage().bucket().file(storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + expiresInMs,
    });
    return url;
  } catch {
    return null;
  }
}

function buildProxyDownloadToken({
  jobId,
  uid,
  storagePath,
  expiresAt = Date.now() + DOWNLOAD_URL_TTL_MS,
}, secretOverride = "") {
  const secret = String(secretOverride || getExportSigningSecret()).trim();
  if (!secret) {
    throw new Error("EXPORT_SIGNING_SECRET indisponible.");
  }
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    jobId: requireJobId(jobId),
    uid,
    storagePath,
    exp: expiresAt,
  }), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyProxyDownloadToken(token, secretOverride = "") {
  const secret = String(secretOverride || getExportSigningSecret()).trim();
  if (!secret || typeof token !== "string" || token.length > 4096) {
    throw new Error("Jeton de telechargement invalide.");
  }
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Jeton de telechargement invalide.");
  }
  const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest();
  let provided;
  try {
    provided = Buffer.from(parts[1], "base64url");
  } catch {
    throw new Error("Jeton de telechargement invalide.");
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error("Signature de telechargement invalide.");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new Error("Jeton de telechargement invalide.");
  }
  const expiresAt = finiteNumber(payload.exp, 0);
  if (
    payload.v !== 1 ||
    expiresAt <= Date.now() ||
    expiresAt > Date.now() + DOWNLOAD_URL_TTL_MS + 60_000
  ) {
    throw new Error("Jeton de telechargement expire ou invalide.");
  }
  const jobId = requireJobId(payload.jobId);
  const uid = payload.uid;
  if (
    typeof uid !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(uid) ||
    !isOwnerOutputStoragePath(uid, payload.storagePath)
  ) {
    throw new Error("Portee du jeton de telechargement invalide.");
  }
  return {
    jobId,
    uid,
    storagePath: payload.storagePath,
    expiresAt,
  };
}

function buildProxyDownloadUrl({ jobId, uid, storagePath, expiresAt }) {
  const token = buildProxyDownloadToken({ jobId, uid, storagePath, expiresAt });
  const serviceUrl = String(process.env.EXPORT_DOWNLOAD_SERVICE_URL || "").trim().replace(/\/+$/, "");
  if (!serviceUrl) {
    throw new HttpsError("failed-precondition", "Service de telechargement VibeCut non configure.");
  }
  return `${serviceUrl}/download?token=${encodeURIComponent(token)}`;
}

async function writeManifestToStorage(storagePath, manifest) {
  await admin.storage().bucket().file(storagePath).save(JSON.stringify(manifest), {
    resumable: false,
    contentType: "application/json",
    metadata: {
      cacheControl: "private, max-age=0, no-transform",
    },
  });
}

async function readManifestFromStorage(storagePath) {
  if (!isSafeRelativeStoragePath(storagePath)) {
    throw new HttpsError("failed-precondition", "Chemin manifeste Storage invalide.");
  }
  const [buffer] = await admin.storage().bucket().file(storagePath).download();
  return JSON.parse(buffer.toString("utf8"));
}

async function resolveJobManifest(data = {}) {
  if (data.manifest) return data.manifest;
  if (data.manifestStoragePath) return readManifestFromStorage(data.manifestStoragePath);
  throw new HttpsError("failed-precondition", "Manifest export absent du job source.");
}

function buildManifestSummary(manifest = {}, manifestStoragePath = null) {
  const clips = manifest.clips || [];
  const audioTracks = manifest.audioTracks || [];
  const sourceSizeBytes = estimateManifestSourceBytes(manifest);
  const estimatedCost = manifest.estimates?.cost || {};
  return {
    manifestVersion: manifest.version || null,
    manifestStoragePath,
    project: {
      id: manifest.project?.id || null,
      name: manifest.project?.name || "Untitled",
      duration: finiteNumber(manifest.project?.duration, 0),
      preset: manifest.project?.preset || null,
    },
    clipsCount: clips.length,
    audioTracksCount: audioTracks.length,
    transitionsCount: Array.isArray(manifest.transitions) ? manifest.transitions.length : 0,
    textOverlaysCount: Array.isArray(manifest.textOverlays) ? manifest.textOverlays.length : 0,
    sourceSizeBytes,
    estimatedCostEur: finiteNumber(estimatedCost.eur, 0),
    estimatedCostLabel: estimatedCost.label || null,
  };
}

function resolveExportPlanAccess(request) {
  return {
    status: "allowed_mvp_stub",
    creditsEnforced: false,
    plan: request.auth?.token?.plan || request.auth?.token?.stripeRole || "unknown",
    reason: "export_billing_gate_not_finalized",
  };
}

function logExportSecurityEvent(event, payload = {}) {
  logger.warn(event, {
    uid: payload.uid || null,
    jobId: payload.jobId || null,
    errorCount: payload.errorCount || 0,
    errors: (payload.errors || []).slice(0, 6),
  });
}

function publicLog(message, level = "info") {
  return {
    level,
    message,
    createdAt: admin.firestore.Timestamp.now(),
  };
}

async function callRenderService({ jobId, uid, manifest, outputStoragePath }) {
  const rendererUrl = getExportRendererUrl();
  const rendererAuthMode = getExportRendererAuthMode();
  const authRequirements = resolveRendererAuthRequirements(rendererAuthMode);
  if (!rendererUrl) {
    throw new HttpsError("failed-precondition", "EXPORT_RENDERER_URL manquant.");
  }
  const signingSecret = authRequirements.needsHmac ? getExportSigningSecret() : "";
  if (authRequirements.needsHmac && !signingSecret) {
    throw new HttpsError("failed-precondition", "Secret EXPORT_SIGNING_SECRET manquant.");
  }

  const bucketName = admin.app().options.storageBucket || process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new HttpsError("failed-precondition", "Bucket Storage Firebase manquant.");
  }

  const rendererBaseUrl = rendererUrl.replace(/\/+$/, "");
  const body = JSON.stringify({
    jobId,
    uid,
    bucket: bucketName,
    outputStoragePath,
    manifest,
  });
  const headers = {
    "content-type": "application/json",
  };
  if (authRequirements.needsHmac) {
    const timestamp = Date.now();
    headers["x-vibecut-timestamp"] = String(timestamp);
    headers["x-vibecut-signature"] = buildRendererSignature(body, signingSecret, timestamp);
  }
  if (authRequirements.needsOidc) {
    headers.authorization = `Bearer ${await fetchRendererIdentityToken(rendererBaseUrl)}`;
  }

  const response = await fetch(`${rendererBaseUrl}/render`, {
    method: "POST",
    headers,
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === "failed") {
    throw new HttpsError("failed-precondition", "Renderer Cloud Run a refuse le job Export Pro.", {
      status: response.status,
      renderer: data,
    });
  }
  return data;
}

async function fetchRendererIdentityToken(audience) {
  const tokenUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity" +
    `?audience=${encodeURIComponent(audience)}`;
  const response = await fetch(tokenUrl, {
    headers: {
      "Metadata-Flavor": "Google",
    },
  });
  if (!response.ok) {
    throw new HttpsError("failed-precondition", "Token OIDC renderer indisponible.", {
      status: response.status,
    });
  }
  const token = String(await response.text()).trim();
  if (!token) {
    throw new HttpsError("failed-precondition", "Token OIDC renderer vide.");
  }
  return token;
}

async function executeRendererForJob({ ref, jobId, uid, manifest, outputStoragePath, rendererUrlConfigured }) {
  const renderingClaimed = await markJobRenderingUnlessCancelled(ref);
  if (!renderingClaimed) {
    const cancelledLog = publicLog("Annulation detectee avant appel renderer Cloud Run.", "warning");
    await ref.set({
      status: "cancelled",
      phase: "cancelled",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      logs: admin.firestore.FieldValue.arrayUnion(cancelledLog),
    }, { merge: true });

    return {
      jobId,
      projectName: manifest.project?.name || "Untitled",
      render: manifest.render || null,
      estimates: manifest.estimates || null,
      status: "cancelled",
      phase: "cancelled",
      progress: 0,
      output: null,
      warnings: [],
      logs: [{
        level: cancelledLog.level,
        message: cancelledLog.message,
        at: cancelledLog.createdAt.toDate().toISOString(),
      }],
      rendererConfigured: rendererUrlConfigured,
    };
  }

  const rendererResult = await callRenderService({
    jobId,
    uid,
    manifest,
    outputStoragePath,
  });
  const renderedStoragePath = rendererResult.output?.storagePath || outputStoragePath;
  const output = {
    storagePath: renderedStoragePath,
    downloadUrl: rendererResult.output?.downloadUrl || await createOutputDownloadUrl(renderedStoragePath),
    sizeBytes: rendererResult.output?.sizeBytes || null,
    contentType: "video/mp4",
    mockOnly: false,
  };
  const warnings = rendererResult.warnings || [];
  const logs = [
    publicLog("Renderer Cloud Run termine.", "success"),
    ...warnings.map((warning) => publicLog(String(warning), "warning")),
  ];

  if (await isJobCancellationRequested(ref)) {
    const cancelledLog = publicLog("Renderer termine apres annulation: output ignore cote job utilisateur.", "warning");
    await ref.set({
      status: "cancelled",
      phase: "cancelled",
      progress: 100,
      cancelledOutput: output,
      rendererResult: {
        mode: rendererResult.mode || "cloud-run-ffmpeg",
        elapsedMs: rendererResult.elapsedMs || null,
        ignoredAfterCancel: true,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      logs: admin.firestore.FieldValue.arrayUnion(cancelledLog),
    }, { merge: true });

    return {
      jobId,
      projectName: manifest.project?.name || "Untitled",
      render: manifest.render || null,
      estimates: manifest.estimates || null,
      status: "cancelled",
      phase: "cancelled",
      progress: 100,
      output: null,
      cancelledOutput: output,
      warnings,
      logs: [{
        level: cancelledLog.level,
        message: cancelledLog.message,
        at: cancelledLog.createdAt.toDate().toISOString(),
      }],
      rendererConfigured: rendererUrlConfigured,
    };
  }

  const costEstimate = estimateJobCostServer({
    elapsedMs: rendererResult.elapsedMs,
    allocatedVcpu: rendererResult.allocatedVcpu,
    allocatedMemoryGib: rendererResult.allocatedMemoryGib,
    outputBytes: output.sizeBytes,
  });
  await ref.set({
    status: "ready",
    phase: "ready",
    progress: 100,
    output,
    warnings,
    rendererResult: {
      mode: rendererResult.mode || "cloud-run-ffmpeg",
      elapsedMs: rendererResult.elapsedMs || null,
      phaseMs: rendererResult.phaseMs || null,
      service: rendererResult.service || process.env.EXPORT_RENDERER_SERVICE || null,
      revision: rendererResult.revision || null,
      region: rendererResult.region || process.env.EXPORT_RENDERER_REGION || REGION,
      allocatedVcpu: rendererResult.allocatedVcpu || Number(process.env.EXPORT_RENDERER_ALLOCATED_VCPU || 2),
      allocatedMemoryGib: rendererResult.allocatedMemoryGib || Number(process.env.EXPORT_RENDERER_ALLOCATED_MEMORY_GIB || 2),
    },
    costEstimate,
    estimatedComputeCost: costEstimate.estimatedComputeCost,
    estimatedStorageCost: costEstimate.estimatedStorageCost,
    estimatedRequestCost: costEstimate.estimatedRequestCost,
    estimatedTotalCost: costEstimate.estimatedTotalCost,
    estimatedTotalCostEur: costEstimate.estimatedTotalCostEur,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    logs: admin.firestore.FieldValue.arrayUnion(...logs),
  }, { merge: true });

  return {
    jobId,
    projectName: manifest.project?.name || "Untitled",
    render: manifest.render || null,
    estimates: manifest.estimates || null,
    status: "ready",
    phase: "ready",
    progress: 100,
    output,
    warnings,
    logs: logs.map((log) => ({
      level: log.level,
      message: log.message,
      at: log.createdAt.toDate().toISOString(),
    })),
    rendererConfigured: rendererUrlConfigured,
  };
}

async function enqueueVideoExportTask({ jobId, uid }) {
  await getFunctions().taskQueue(EXPORT_TASK_QUEUE_RESOURCE).enqueue({
    jobId,
    uid,
  }, {
    dispatchDeadlineSeconds: 1800,
  });
}

async function processStoredVideoExportJob({ jobId, uid }) {
  const { ref, data } = await getOwnedJob(uid, jobId);
  if (TERMINAL_STATUSES.has(data.status)) {
    return {
      jobId,
      status: data.status,
      phase: data.phase || data.status,
      progress: data.progress || 0,
      skipped: true,
    };
  }

  const manifest = await resolveJobManifest(data);
  const validationErrors = validateExportManifest(manifest, { uid });
  if (validationErrors.length) {
    logExportSecurityEvent("video_export_worker_manifest_rejected", {
      uid,
      jobId,
      errorCount: validationErrors.length,
      errors: validationErrors,
    });
    await markJobFailedUnlessCancelled(ref, new HttpsError("invalid-argument", "Manifest Export Pro source invalide.", {
      errors: validationErrors,
    }));
    return {
      jobId,
      status: "failed",
      phase: "failed",
      progress: data.progress || 18,
      errors: validationErrors,
    };
  }

  const outputStoragePath = data.outputStoragePath || buildOutputStoragePath(uid, jobId);
  if (shouldUseCloudRunJobsOrchestration()) {
    try {
      return await launchCloudRunJobForExport({
        ref,
        data,
        jobId,
        uid,
        manifest,
      });
    } catch (error) {
      await markJobFailedUnlessCancelled(ref, error);
      throw error;
    }
  }
  const rendererUrlConfigured = Boolean(getExportRendererUrl());
  try {
    return await executeRendererForJob({
      ref,
      jobId,
      uid,
      manifest,
      outputStoragePath,
      rendererUrlConfigured,
    });
  } catch (error) {
    await markJobFailedUnlessCancelled(ref, error);
    throw error;
  }
}

async function isJobCancellationRequested(ref) {
  const snapshot = await ref.get();
  const data = snapshot.exists ? snapshot.data() || {} : {};
  return data.status === "cancelled" || data.phase === "cancelled" || data.cancelRequested === true;
}

async function markJobRenderingUnlessCancelled(ref) {
  return admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    if (data.status === "cancelled" || data.phase === "cancelled" || data.cancelRequested === true) {
      return false;
    }
    transaction.set(ref, {
      status: "rendering",
      phase: "rendering",
      progress: 35,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      logs: admin.firestore.FieldValue.arrayUnion(publicLog("Renderer Cloud Run appele.")),
    }, { merge: true });
    return true;
  });
}

async function markJobFailedUnlessCancelled(ref, error) {
  return admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    if (data.status === "cancelled" || data.phase === "cancelled" || data.cancelRequested === true) {
      transaction.set(ref, {
        status: "cancelled",
        phase: "cancelled",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        logs: admin.firestore.FieldValue.arrayUnion(publicLog("Erreur renderer ignoree apres annulation.", "warning")),
      }, { merge: true });
      return false;
    }
    transaction.set(ref, {
      status: "failed",
      phase: "failed",
      progress: 35,
      error: {
        code: error.code || "render-service-failed",
        message: error.message || "Erreur renderer Cloud Run.",
        details: error.details || null,
      },
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      logs: admin.firestore.FieldValue.arrayUnion(publicLog(error.message || "Erreur renderer Cloud Run.", "error")),
    }, { merge: true });
    return true;
  });
}

async function getOwnedJob(uid, jobId) {
  const ref = exportJobsRef().doc(jobId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Job export introuvable.");
  }
  const data = snapshot.data() || {};
  if (data.ownerUid !== uid) {
    throw new HttpsError("permission-denied", "Ce job export n'appartient pas a l'utilisateur connecte.");
  }
  return { ref, data };
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function publicAdminExportJob(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    uid: data.uid || data.ownerUid || null,
    devRun: data.devRun === true,
    source: data.source || null,
    status: data.status || "unknown",
    phase: data.phase || data.status || "unknown",
    progress: finiteNumber(data.progress, 0),
    render: data.render || null,
    output: data.output ? {
      sizeBytes: data.output.sizeBytes || null,
      contentType: data.output.contentType || null,
      mockOnly: data.output.mockOnly === true,
      hasStoragePath: Boolean(data.output.storagePath),
      hasDownloadUrl: Boolean(data.output.downloadUrl),
    } : null,
    manifestSummary: data.manifestSummary || null,
    estimates: data.estimates || null,
    billingGate: data.billingGate || null,
    retryOf: data.retryOf || null,
    retryCount: finiteNumber(data.retryCount, 0),
    renderer: data.renderer || null,
    rendererResult: data.rendererResult || null,
    costEstimate: data.costEstimate || null,
    estimatedComputeCost: data.estimatedComputeCost ?? null,
    estimatedGpuCost: data.estimatedGpuCost ?? data.costEstimate?.estimatedGpuCost ?? null,
    estimatedStorageCost: data.estimatedStorageCost ?? null,
    estimatedRequestCost: data.estimatedRequestCost ?? null,
    estimatedTotalCost: data.estimatedTotalCost ?? null,
    estimatedTotalCostEur: data.estimatedTotalCostEur ?? null,
    error: data.error ? {
      code: data.error.code || null,
      message: data.error.message || null,
    } : null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    completedAt: timestampToIso(data.completedAt),
    failedAt: timestampToIso(data.failedAt),
    cancelledAt: timestampToIso(data.cancelledAt),
  };
}

function summarizeAdminExportJobs(jobs = []) {
  const statusCounts = jobs.reduce((counts, job) => {
    counts[job.status] = (counts[job.status] || 0) + 1;
    return counts;
  }, {});
  const outputSizeBytes = jobs.reduce((total, job) => total + finiteNumber(job.output?.sizeBytes, 0), 0);
  const sourceSizeBytes = jobs.reduce((total, job) => total + finiteNumber(job.manifestSummary?.sourceSizeBytes, 0), 0);
  const serverEstimatedCostEur = jobs.reduce((total, job) => total + finiteNumber(job.estimatedTotalCostEur, 0), 0);
  const manifestEstimatedCostEur = jobs.reduce((total, job) => {
    return total + finiteNumber(job.estimates?.cost?.eur ?? job.manifestSummary?.estimatedCostEur, 0);
  }, 0);
  const estimatedCostEur = serverEstimatedCostEur > 0 ? serverEstimatedCostEur : manifestEstimatedCostEur;
  const elapsedMsValues = jobs
    .map((job) => finiteNumber(job.rendererResult?.elapsedMs, 0))
    .filter((value) => value > 0);
  const averageElapsedMs = elapsedMsValues.length
    ? Math.round(elapsedMsValues.reduce((total, value) => total + value, 0) / elapsedMsValues.length)
    : 0;
  const activeJobs = jobs.filter((job) => ["queued", "rendering", "finalizing"].includes(job.status)).length;
  const devRunJobs = jobs.filter((job) => job.devRun === true).length;

  return {
    totalJobs: jobs.length,
    activeJobs,
    devRunJobs,
    statusCounts,
    outputSizeBytes,
    sourceSizeBytes,
    estimatedCostEur,
    serverEstimatedCostEur,
    manifestEstimatedCostEur,
    averageElapsedMs,
  };
}

const createVideoExportJob = onCall(
  {
    region: REGION,
    enforceAppCheck: ENFORCE_EXPORT_APP_CHECK,
    secrets: [EXPORT_SIGNING_SECRET],
    timeoutSeconds: 3600,
    memory: "512MiB",
  },
  async (request) => {
    const uid = assertAuthenticated(request);
    const manifest = request.data?.manifest;
    const validationErrors = validateExportManifest(manifest, { uid });
    if (validationErrors.length) {
      logExportSecurityEvent("video_export_manifest_rejected", {
        uid,
        errorCount: validationErrors.length,
        errors: validationErrors,
      });
      throw new HttpsError("invalid-argument", "Manifest Export Pro invalide.", {
        errors: validationErrors,
      });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = exportJobsRef().doc();
    const outputStoragePath = buildOutputStoragePath(uid, ref.id);
    const manifestStoragePath = buildManifestStoragePath(uid, ref.id);
    const manifestSummary = buildManifestSummary(manifest, manifestStoragePath);
    const planAccess = resolveExportPlanAccess(request);
    const rendererUrlConfigured = Boolean(getExportRendererUrl());
    const renderProfile = selectRenderProfile(manifest, {
      gpuEnabled: process.env.EXPORT_GPU_ENABLED === "true",
    });
    await writeManifestToStorage(manifestStoragePath, manifest);
    const devRun = request.auth?.token?.email
      ? (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(request.auth.token.email.toLowerCase())
      : false;
    const job = {
      uid,
      ownerUid: uid,
      devRun,
      source: "firebase-callable",
      status: "queued",
      phase: "queueing",
      progress: 18,
      manifestVersion: manifest.version,
      manifestStoragePath,
      manifestSummary,
      render: manifest.render,
      renderProfile: renderProfile.id,
      outputStoragePath,
      estimates: manifest.estimates || null,
      billingGate: planAccess,
      renderer: {
        mode: shouldUseCloudRunJobsOrchestration() ? "cloud-run-job-ffmpeg" : "cloud-run-ffmpeg",
        urlConfigured: rendererUrlConfigured,
        service: shouldUseCloudRunJobsOrchestration()
          ? renderProfile.jobName
          : process.env.EXPORT_RENDERER_SERVICE || null,
        region: shouldUseCloudRunJobsOrchestration()
          ? getCloudRunJobsRegion()
          : process.env.EXPORT_RENDERER_REGION || REGION,
        allocatedVcpu: shouldUseCloudRunJobsOrchestration()
          ? renderProfile.vcpu
          : Number(process.env.EXPORT_RENDERER_ALLOCATED_VCPU || 2),
        allocatedMemoryGib: shouldUseCloudRunJobsOrchestration()
          ? renderProfile.memoryGib
          : Number(process.env.EXPORT_RENDERER_ALLOCATED_MEMORY_GIB || 2),
        accelerator: renderProfile.accelerator,
      },
      createdAt: now,
      updatedAt: now,
      logs: [
        publicLog("Job Export Pro cree et mis en file Cloud Run."),
        publicLog("Controle plan/credits MVP explicite: non facture tant que le billing export n est pas finalise.", "warning"),
      ],
    };

    await ref.set(job);

    if (shouldUseTaskQueueOrchestration()) {
      try {
        await enqueueVideoExportTask({ jobId: ref.id, uid });
      } catch (error) {
        await markJobFailedUnlessCancelled(ref, new HttpsError("failed-precondition", "Mise en file Cloud Tasks impossible.", {
          message: error.message || "enqueue failed",
        }));
        throw new HttpsError("failed-precondition", "Mise en file Cloud Tasks impossible.", {
          message: error.message || "enqueue failed",
        });
      }
      return {
        jobId: ref.id,
        projectName: manifest.project?.name || "Untitled",
        render: manifest.render || null,
        estimates: manifest.estimates || null,
        status: "queued",
        phase: "queueing",
        progress: 18,
        output: null,
        warnings: [],
        rendererConfigured: rendererUrlConfigured,
        orchestration: shouldUseCloudRunJobsOrchestration() ? "cloudRunJobs" : "taskQueue",
        renderProfile: renderProfile.id,
      };
    }

    try {
      return await executeRendererForJob({
        ref,
        jobId: ref.id,
        uid,
        manifest,
        outputStoragePath,
        rendererUrlConfigured,
      });
    } catch (error) {
      await markJobFailedUnlessCancelled(ref, error);
      throw error;
    }
  }
);

const cancelVideoExportJob = onCall(
  {
    region: REGION,
    enforceAppCheck: ENFORCE_EXPORT_APP_CHECK,
  },
  async (request) => {
    const uid = assertAuthenticated(request);
    const jobId = requireJobId(request.data?.jobId);
    const { ref, data } = await getOwnedJob(uid, jobId);
    if (TERMINAL_STATUSES.has(data.status)) {
      return {
        jobId,
        status: data.status,
        phase: data.phase || data.status,
        progress: data.progress || 0,
      };
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    let executionCancellation = {
      requested: false,
      succeeded: false,
      error: null,
    };
    if (data.cloudRun?.executionName) {
      executionCancellation.requested = true;
      try {
        executionCancellation.succeeded = await cancelCloudRunExecution(data.cloudRun.executionName);
      } catch (error) {
        executionCancellation.error = error.message || "cloud-run-cancel-failed";
        logger.warn("Cloud Run execution cancellation failed", {
          jobId,
          executionName: data.cloudRun.executionName,
          error: executionCancellation.error,
        });
      }
    }

    await ref.set({
      status: "cancelled",
      phase: "cancelled",
      cancelRequested: true,
      progress: data.progress || 0,
      cloudRunCancellation: executionCancellation,
      cancelledAt: now,
      updatedAt: now,
      logs: admin.firestore.FieldValue.arrayUnion({
        level: "info",
        message: "Job export annule par l'utilisateur.",
        createdAt: admin.firestore.Timestamp.now(),
      }),
    }, { merge: true });

    return {
      jobId,
      status: "cancelled",
      phase: "cancelled",
      progress: data.progress || 0,
      cloudRunCancellation: executionCancellation,
    };
  }
);

const retryVideoExportJob = onCall(
  {
    region: REGION,
    enforceAppCheck: ENFORCE_EXPORT_APP_CHECK,
    secrets: [EXPORT_SIGNING_SECRET],
    timeoutSeconds: 3600,
    memory: "512MiB",
  },
  async (request) => {
    const uid = assertAuthenticated(request);
    const jobId = requireJobId(request.data?.jobId);
    const { data } = await getOwnedJob(uid, jobId);
    if (!RETRYABLE_STATUSES.has(data.status)) {
      throw new HttpsError("failed-precondition", "Seuls les exports echoues ou annules peuvent etre relances.");
    }

    const manifest = await resolveJobManifest(data);
    const validationErrors = validateExportManifest(manifest, { uid });
    if (validationErrors.length) {
      logExportSecurityEvent("video_export_retry_manifest_rejected", {
        uid,
        jobId,
        errorCount: validationErrors.length,
        errors: validationErrors,
      });
      throw new HttpsError("invalid-argument", "Manifest Export Pro source invalide.", {
        errors: validationErrors,
      });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = exportJobsRef().doc();
    const manifestStoragePath = buildManifestStoragePath(uid, ref.id);
    const manifestSummary = buildManifestSummary(manifest, manifestStoragePath);
    const outputStoragePath = buildOutputStoragePath(uid, ref.id);
    const rendererUrlConfigured = Boolean(getExportRendererUrl());
    const renderProfile = selectRenderProfile(manifest, {
      gpuEnabled: process.env.EXPORT_GPU_ENABLED === "true",
    });
    await writeManifestToStorage(manifestStoragePath, manifest);
    await ref.set({
      uid,
      ownerUid: uid,
      status: "queued",
      phase: "queueing",
      progress: 18,
      manifestVersion: manifest.version,
      manifestStoragePath,
      manifestSummary,
      render: data.render || manifest.render,
      renderProfile: renderProfile.id,
      outputStoragePath,
      estimates: manifest.estimates || null,
      billingGate: resolveExportPlanAccess(request),
      retryOf: jobId,
      renderer: {
        mode: shouldUseCloudRunJobsOrchestration() ? "cloud-run-job-ffmpeg" : "cloud-run-ffmpeg",
        urlConfigured: rendererUrlConfigured,
        service: shouldUseCloudRunJobsOrchestration() ? renderProfile.jobName : null,
        region: shouldUseCloudRunJobsOrchestration() ? getCloudRunJobsRegion() : null,
        allocatedVcpu: renderProfile.vcpu,
        allocatedMemoryGib: renderProfile.memoryGib,
        accelerator: renderProfile.accelerator,
      },
      createdAt: now,
      updatedAt: now,
      logs: [{
        level: "info",
        message: `Relance du job export ${jobId}.`,
        createdAt: admin.firestore.Timestamp.now(),
      }],
    });

    if (shouldUseTaskQueueOrchestration()) {
      try {
        await enqueueVideoExportTask({ jobId: ref.id, uid });
      } catch (error) {
        await markJobFailedUnlessCancelled(ref, new HttpsError("failed-precondition", "Mise en file Cloud Tasks impossible.", {
          message: error.message || "enqueue failed",
        }));
        throw new HttpsError("failed-precondition", "Mise en file Cloud Tasks impossible.", {
          message: error.message || "enqueue failed",
        });
      }
      return {
        jobId: ref.id,
        projectName: manifest.project?.name || "Untitled",
        render: manifest.render || null,
        estimates: manifest.estimates || null,
        status: "queued",
        phase: "queueing",
        progress: 18,
        output: null,
        warnings: [],
        rendererConfigured: rendererUrlConfigured,
        retryOf: jobId,
        orchestration: shouldUseCloudRunJobsOrchestration() ? "cloudRunJobs" : "taskQueue",
        renderProfile: renderProfile.id,
      };
    }

    try {
      const result = await executeRendererForJob({
        ref,
        jobId: ref.id,
        uid,
        manifest,
        outputStoragePath,
        rendererUrlConfigured,
      });
      return {
        ...result,
        retryOf: jobId,
      };
    } catch (error) {
      await markJobFailedUnlessCancelled(ref, error);
      throw error;
    }
  }
);

const processVideoExportJob = onTaskDispatched(
  {
    region: TASK_QUEUE_REGION,
    retryConfig: {
      maxAttempts: 2,
      minBackoffSeconds: 30,
    },
    rateLimits: {
      maxConcurrentDispatches: 2,
    },
    secrets: [EXPORT_SIGNING_SECRET],
    timeoutSeconds: 1800,
    memory: "512MiB",
  },
  async (request) => {
    const jobId = requireJobId(request.data?.jobId);
    const uid = request.data?.uid;
    if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
      throw new HttpsError("invalid-argument", "uid invalide pour task export.");
    }
    await processStoredVideoExportJob({ jobId, uid });
  }
);

const getVideoExportDownloadUrl = onCall(
  {
    region: REGION,
    enforceAppCheck: ENFORCE_EXPORT_APP_CHECK,
    secrets: [EXPORT_SIGNING_SECRET],
  },
  async (request) => {
    const uid = assertAuthenticated(request);
    const jobId = requireJobId(request.data?.jobId);
    const { data } = await getOwnedJob(uid, jobId);
    if (data.status !== "ready") {
      throw new HttpsError("failed-precondition", "Le MP4 final n'est pas encore pret.");
    }

    const storagePath = data.output?.storagePath || data.outputStoragePath;
    if (!isOwnerOutputStoragePath(uid, storagePath)) {
      logExportSecurityEvent("video_export_download_path_rejected", {
        uid,
        jobId,
        errorCount: 1,
        errors: ["outputStoragePath owner scope invalide"],
      });
      throw new HttpsError("permission-denied", "Chemin output export invalide pour cet utilisateur.");
    }

    const expiresAt = Date.now() + DOWNLOAD_URL_TTL_MS;
    let downloadMode = "gcs-signed-url";
    let downloadUrl = await createOutputDownloadUrl(storagePath, DOWNLOAD_URL_TTL_MS);
    if (!downloadUrl) {
      downloadMode = "vibecut-proxy";
      downloadUrl = buildProxyDownloadUrl({
        jobId,
        uid,
        storagePath,
        expiresAt,
      });
    }

    return {
      jobId,
      storagePath,
      downloadUrl,
      downloadMode,
      expiresAt: new Date(expiresAt).toISOString(),
      sizeBytes: data.output?.sizeBytes || null,
      contentType: data.output?.contentType || "video/mp4",
    };
  }
);

const getVideoExportAdminTelemetry = onCall(
  {
    region: REGION,
    enforceAppCheck: false, // Admin-only via assertExportAdmin — App Check non requis
  },
  async (request) => {
    assertAuthenticated(request);
    await assertExportAdmin(request);
    const requestedLimit = finiteNumber(request.data?.limit, 100);
    const resultLimit = Math.max(1, Math.min(200, Math.round(requestedLimit)));
    const snapshot = await exportJobsRef()
      .orderBy("createdAt", "desc")
      .limit(resultLimit)
      .get();
    const jobs = snapshot.docs.map(publicAdminExportJob);
    const cloudBilling = await getCloudBillingTelemetry();

    return {
      scope: "admin-global",
      limit: resultLimit,
      jobs,
      summary: summarizeAdminExportJobs(jobs),
      cloudBilling,
      generatedAt: new Date().toISOString(),
    };
  }
);

module.exports = {
  createVideoExportJob,
  cancelVideoExportJob,
  retryVideoExportJob,
  processVideoExportJob,
  getVideoExportDownloadUrl,
  getVideoExportAdminTelemetry,
  validateExportManifest,
  EXPORT_QUOTAS,
  RENDER_PROFILES,
  selectRenderProfile,
  buildManifestSummary,
  summarizeAdminExportJobs,
  getCloudBillingTelemetry,
  parseBillingExportTable,
  processStoredVideoExportJob,
  buildProxyDownloadToken,
  verifyProxyDownloadToken,
  // Exportees pour que smoke-vibecut-transition-parity puisse comparer les trois
  // copies des tables au lieu de croire un commentaire.
  SERVER_XFADE_TRANSITIONS,
  SERVER_TRANSITION_EFFECTS,
  TRANSITION_EFFECT_STEPS,
};
