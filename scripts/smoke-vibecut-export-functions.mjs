import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const videoExport = require("../functions/src/videoExport.js");
const functionsSource = await readFile(path.join(process.cwd(), "functions", "src", "videoExport.js"), "utf8");
const functionsIndexSource = await readFile(path.join(process.cwd(), "functions", "index.js"), "utf8");

const uid = "user-export-smoke";

function makeManifest(overrides = {}) {
  return {
    version: 1,
    project: {
      id: "project-smoke",
      name: "Function Smoke",
      duration: 12,
      preset: "reel",
    },
    render: {
      width: 1080,
      height: 1920,
      fps: 30,
      format: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      targetBitrate: 24_000_000,
      audioBitrate: 192_000,
      qualityMode: "pro",
      fitMode: "cover",
    },
    clips: [
      {
        id: "clip-a",
        sourceStoragePath: `users/${uid}/exports/job-a/sources/video/clip-a.mp4`,
        duration: 6,
        trimStart: 0,
        trimEnd: 6,
        volume: 0,
        metadata: { sourceSizeBytes: 26 * 1024 * 1024 },
      },
      {
        id: "clip-b",
        sourceStoragePath: `users/${uid}/exports/job-a/sources/video/clip-b.mp4`,
        duration: 6,
        trimStart: 0,
        trimEnd: 6,
        volume: 0,
        metadata: { sourceSizeBytes: 24 * 1024 * 1024 },
      },
    ],
    transitions: [],
    textOverlays: [],
    audioTracks: [],
    estimates: {
      cost: { eur: 0.0042, label: "0.0042 EUR est." },
    },
    ...overrides,
  };
}

assert.equal(typeof videoExport.getVideoExportDownloadUrl, "function");
assert.equal(typeof videoExport.getVideoExportAdminTelemetry, "function");
assert.equal(typeof videoExport.processVideoExportJob, "function");
assert.equal(typeof videoExport.processStoredVideoExportJob, "function");
assert.equal(typeof videoExport.validateExportManifest, "function");
assert.equal(typeof videoExport.buildManifestSummary, "function");
assert.equal(typeof videoExport.summarizeAdminExportJobs, "function");
assert.match(functionsSource, /x-vibecut-timestamp/, "Functions renderer call must send a timestamped signature header");
assert.match(functionsSource, /\$\{timestamp\}\.\$\{body\}/, "Functions renderer signature must bind timestamp and body");
assert.match(functionsSource, /const retryVideoExportJob[\s\S]*executeRendererForJob/, "retry callable must relaunch the renderer, not only create a queued job");
assert.match(functionsSource, /onTaskDispatched/, "Functions must define a task queue worker for async export rendering");
assert.match(functionsSource, /EXPORT_RENDER_ORCHESTRATION/, "Functions must expose an explicit export orchestration mode");
assert.match(functionsSource, /shouldUseTaskQueueOrchestration/, "Functions must gate task queue mode behind explicit configuration");
assert.match(functionsSource, /getFunctions\(\)\.taskQueue\(EXPORT_TASK_QUEUE_RESOURCE\)\.enqueue/, "Functions must enqueue Cloud Tasks through the Admin SDK with an explicit supported region");
assert.match(
  functionsSource,
  /orchestration: shouldUseCloudRunJobsOrchestration\(\) \? "cloudRunJobs" : "taskQueue"/,
  "Callable responses must identify task queue or Cloud Run Jobs orchestration when enabled",
);
assert.match(functionsSource, /const processVideoExportJob = onTaskDispatched/, "Functions must expose processVideoExportJob as a task queue handler");
assert.match(functionsSource, /await processStoredVideoExportJob\(\{ jobId, uid \}\)/, "Task queue handler must process the stored Firestore job by id and uid");
assert.match(functionsSource, /TERMINAL_STATUSES\.has\(data\.status\)[\s\S]*skipped: true/, "Task queue worker must not rerender terminal jobs");
assert.match(functionsIndexSource, /exports\.processVideoExportJob = videoExport\.processVideoExportJob/, "Functions index must export the task queue worker");
assert.match(functionsSource, /crypto\.timingSafeEqual/, "Download proxy tokens must use constant-time signature comparison");

const proxySecret = "test-only-secret-with-at-least-32-characters";
const proxyClaims = {
  jobId: "job-proxy-a",
  uid,
  storagePath: `users/${uid}/exports/job-proxy-a/outputs/export.mp4`,
  expiresAt: Date.now() + 60_000,
};
const proxyToken = videoExport.buildProxyDownloadToken(proxyClaims, proxySecret);
assert.deepEqual(videoExport.verifyProxyDownloadToken(proxyToken, proxySecret), proxyClaims);
assert.throws(
  () => videoExport.verifyProxyDownloadToken(`${proxyToken.slice(0, -1)}x`, proxySecret),
  /Signature|invalide/,
);
assert.match(functionsSource, /EXPORT_RENDERER_AUTH_MODE/, "Functions renderer call must expose an explicit renderer auth mode");
assert.match(functionsSource, /function resolveRendererAuthRequirements/, "Functions must centralize renderer auth mode parsing");
assert.match(functionsSource, /mode === "hmac"\)[\s\S]*needsHmac: true[\s\S]*needsOidc: false/, "Functions hmac mode must send HMAC only");
assert.match(functionsSource, /mode === "hmac\+oidc"\)[\s\S]*needsHmac: true[\s\S]*needsOidc: true/, "Functions hmac+oidc mode must send both HMAC and OIDC");
assert.match(functionsSource, /mode === "oidc"\)[\s\S]*needsHmac: false[\s\S]*needsOidc: true/, "Functions oidc mode must send OIDC without requiring the HMAC secret");
assert.match(functionsSource, /metadata\.google\.internal\/computeMetadata\/v1\/instance\/service-accounts\/default\/identity/, "Functions must be ready to fetch a Cloud Run OIDC identity token from the metadata server");
assert.match(functionsSource, /Metadata-Flavor["']:\s*["']Google/, "Functions OIDC metadata call must use the required Metadata-Flavor header");
assert.match(functionsSource, /headers\.authorization = `Bearer \$\{await fetchRendererIdentityToken\(rendererBaseUrl\)\}`/, "Functions must attach an OIDC bearer token when renderer auth mode requires it");
assert.match(functionsSource, /authRequirements\.needsHmac[\s\S]*x-vibecut-signature/, "Functions must sign renderer requests when HMAC is required");
assert.match(functionsSource, /authRequirements\.needsOidc[\s\S]*fetchRendererIdentityToken/, "Functions must attach OIDC only when requested by auth mode");
assert.match(functionsSource, /function isJobCancellationRequested/, "Functions must re-read the Firestore job before marking renderer output ready");
assert.match(functionsSource, /await isJobCancellationRequested\(ref\)[\s\S]*status: "cancelled"[\s\S]*cancelledOutput/, "Renderer completion must preserve cancelled jobs instead of overwriting them as ready");
assert.match(functionsSource, /ignoredAfterCancel: true/, "Cancelled renderer outputs must be marked as ignored after cancel");
assert.match(functionsSource, /function markJobRenderingUnlessCancelled/, "Functions must guard the queued-to-rendering transition against cancellation races");
assert.match(functionsSource, /runTransaction[\s\S]*status: "rendering"/, "Functions must use a Firestore transaction before marking a job as rendering");
assert.match(functionsSource, /function markJobFailedUnlessCancelled/, "Functions must guard renderer failure writes against cancellation races");
assert.match(functionsSource, /Erreur renderer ignoree apres annulation/, "Renderer errors after cancellation must be logged without changing the job to failed");
assert.equal(
  /catch \(error\) \{[\s\S]{0,400}status: "failed"/.test(functionsSource),
  false,
  "Renderer catch blocks must not write failed directly without checking cancellation",
);

assert.match(functionsSource, /const getVideoExportAdminTelemetry = onCall/, "Functions must expose an admin export telemetry callable");
assert.match(functionsSource, /await assertExportAdmin\(request\)/, "Admin export telemetry must require an admin claim/email/doc");
assert.match(functionsSource, /scope: "admin-global"/, "Admin export telemetry must identify its global scope");
assert.match(functionsSource, /hasStoragePath: Boolean\(data\.output\.storagePath\)/, "Admin telemetry must expose storage path presence without leaking raw paths");
assert.match(functionsSource, /hasDownloadUrl: Boolean\(data\.output\.downloadUrl\)/, "Admin telemetry must expose download URL presence without leaking signed URLs");

assert.deepEqual(videoExport.validateExportManifest(makeManifest(), { uid }), []);

const externalAudioManifest = makeManifest({
  audioTracks: [
    {
      id: "music-a",
      sourceStoragePath: `users/${uid}/exports/job-a/sources/audio/music-a.mp3`,
      duration: 10,
      trimStart: 0,
      trimEnd: 10,
      startTime: 1,
      volume: 65,
    },
  ],
});
assert.deepEqual(
  videoExport.validateExportManifest(externalAudioManifest, { uid }),
  [],
  "server functions should allow external audio once renderer mix support exists",
);

const crossfadeManifest = makeManifest({
  project: {
    id: "project-smoke",
    name: "Function Smoke",
    duration: 11.5,
    preset: "reel",
  },
  transitions: [
    { id: "tr-a-b", type: "crossfade", duration: 0.5, fromItemId: "clip-a", toItemId: "clip-b", params: { placement: "cut" } },
  ],
});
assert.deepEqual(
  videoExport.validateExportManifest(crossfadeManifest, { uid }),
  [],
  "server functions should allow adjacent crossfade transitions once renderer xfade support exists",
);

const nonAdjacentTransitionErrors = videoExport.validateExportManifest(makeManifest({
  transitions: [
    { id: "tr-free", type: "fade", duration: 0.5, fromItemId: "clip-a", toItemId: "clip-missing", params: { placement: "free" } },
  ],
}), { uid });
assert.ok(nonAdjacentTransitionErrors.some((error) => error.includes("non adjacente")));

const wrongOwnerErrors = videoExport.validateExportManifest(makeManifest({
  clips: [
    {
      id: "clip-a",
      sourceStoragePath: "users/other-user/exports/job-a/sources/video/clip-a.mp4",
      duration: 3,
      trimStart: 0,
      trimEnd: 3,
      volume: 0,
    },
  ],
}), { uid });
assert.ok(wrongOwnerErrors.some((error) => error.includes("owner-scoped")));

const wrongFolderErrors = videoExport.validateExportManifest(makeManifest({
  clips: [
    {
      id: "clip-a",
      sourceStoragePath: `users/${uid}/exports/job-a/sources/audio/clip-a.mp4`,
      duration: 3,
      trimStart: 0,
      trimEnd: 3,
      volume: 0,
    },
  ],
}), { uid });
assert.ok(wrongFolderErrors.some((error) => error.includes("sources/video")));

const audioPathErrors = videoExport.validateExportManifest(makeManifest({
  audioTracks: [
    {
      id: "music-a",
      sourceStoragePath: `users/${uid}/exports/job-a/sources/video/music-a.mp3`,
      duration: 10,
      trimStart: 0,
      trimEnd: 10,
    },
  ],
}), { uid });
assert.ok(audioPathErrors.some((error) => error.includes("sources/audio")));

const supportedTextManifest = makeManifest({
  textOverlays: [{
    id: "text-a",
    content: "Supported",
    startTime: 0,
    endTime: 3,
    x: 0.5,
    y: 0.35,
    fontSize: 72,
    color: "#ffffff",
    animation: "fade",
    animationOut: "fade",
  }],
});
assert.deepEqual(
  videoExport.validateExportManifest(supportedTextManifest, { uid }),
  [],
  "server functions should allow basic fade text overlays once drawtext support exists",
);

const unsupportedRendererErrors = videoExport.validateExportManifest(makeManifest({
  textOverlays: [{
    id: "text-a",
    content: "Blocked",
    startTime: 0,
    endTime: 3,
    animation: "scale",
    animationOut: "fade",
  }],
}), { uid });
assert.ok(unsupportedRendererErrors.some((error) => error.includes("animation texte")));

const sourceClipAudioManifest = makeManifest({
  clips: [
    {
      id: "clip-a",
      sourceStoragePath: `users/${uid}/exports/job-a/sources/video/clip-a.mp4`,
      duration: 3,
      trimStart: 0,
      trimEnd: 3,
      volume: 80,
    },
  ],
});
assert.deepEqual(
  videoExport.validateExportManifest(sourceClipAudioManifest, { uid }),
  [],
  "server functions should allow source clip audio once renderer mix support exists",
);

const colorManifest = makeManifest({
  clips: [
    {
      id: "clip-color",
      sourceStoragePath: `users/${uid}/exports/job-a/sources/video/clip-color.mp4`,
      duration: 3,
      trimStart: 0,
      trimEnd: 3,
      volume: 0,
      filters: {
        exposure: 10,
        brightness: 96,
        contrast: 125,
        saturation: 115,
        vibrance: 20,
        temperature: -10,
        tint: 5,
        hue: 15,
        shadows: -8,
        midtones: 3,
        highlights: 8,
        fade: 6,
        vignette: 12,
        grain: 8,
      },
    },
  ],
});
assert.deepEqual(
  videoExport.validateExportManifest(colorManifest, { uid }),
  [],
  "server functions should allow known FFmpeg color filters",
);

const unsupportedColorErrors = videoExport.validateExportManifest(makeManifest({
  clips: [
    {
      id: "clip-color",
      sourceStoragePath: `users/${uid}/exports/job-a/sources/video/clip-color.mp4`,
      duration: 3,
      trimStart: 0,
      trimEnd: 3,
      volume: 0,
      filters: {
        unsupportedCurve: 1,
      },
    },
  ],
}), { uid });
assert.ok(unsupportedColorErrors.some((error) => error.includes("unsupportedCurve")));

const quotaErrors = videoExport.validateExportManifest(makeManifest({
  project: { duration: videoExport.EXPORT_QUOTAS.maxDurationSeconds + 1 },
  render: {
    width: 4096,
    height: 4096,
    fps: videoExport.EXPORT_QUOTAS.maxFps + 1,
    format: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    targetBitrate: videoExport.EXPORT_QUOTAS.maxVideoBitrate + 1,
    audioBitrate: videoExport.EXPORT_QUOTAS.maxAudioBitrate + 1,
  },
}), { uid });
assert.ok(quotaErrors.some((error) => error.includes("duree export")));
assert.ok(quotaErrors.some((error) => error.includes("resolution export")));
assert.ok(quotaErrors.some((error) => error.includes("fps export")));
assert.ok(quotaErrors.some((error) => error.includes("bitrate video")));
assert.ok(quotaErrors.some((error) => error.includes("bitrate audio")));

const summary = videoExport.buildManifestSummary(makeManifest(), `users/${uid}/exports/job-a/manifest/export-manifest.json`);
assert.equal(summary.manifestVersion, 1);
assert.equal(summary.clipsCount, 2);
assert.equal(summary.audioTracksCount, 0);
assert.equal(summary.manifestStoragePath, `users/${uid}/exports/job-a/manifest/export-manifest.json`);
assert.equal(summary.project.duration, 12);
assert.equal(summary.sourceSizeBytes, 50 * 1024 * 1024);

const adminSummary = videoExport.summarizeAdminExportJobs([
  {
    status: "ready",
    output: { sizeBytes: 10 * 1024 * 1024 },
    manifestSummary: { sourceSizeBytes: 50 * 1024 * 1024, estimatedCostEur: 0.004 },
    rendererResult: { elapsedMs: 12000 },
  },
  {
    status: "failed",
    output: null,
    manifestSummary: { sourceSizeBytes: 10 * 1024 * 1024, estimatedCostEur: 0.001 },
    rendererResult: { elapsedMs: 6000 },
  },
]);
assert.equal(adminSummary.totalJobs, 2);
assert.equal(adminSummary.statusCounts.ready, 1);
assert.equal(adminSummary.statusCounts.failed, 1);
assert.equal(adminSummary.outputSizeBytes, 10 * 1024 * 1024);
assert.equal(adminSummary.sourceSizeBytes, 60 * 1024 * 1024);
assert.equal(adminSummary.estimatedCostEur, 0.005);
assert.equal(adminSummary.averageElapsedMs, 9000);

console.log("smoke-vibecut-export-functions: ok");
