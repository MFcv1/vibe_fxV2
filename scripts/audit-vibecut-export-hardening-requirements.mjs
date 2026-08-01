import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const files = {
  megaprompt: await read("docs/vibecut-export-production-hardening-megaprompt.md"),
  status: await read("docs/vibecut-export-hardening-status-2026-06-06.md"),
  runbook: await read("docs/vibecut-export-production-runbook-2026-06-06.md"),
  packageJson: await read("package.json"),
  liveGuard: await read("scripts/guard-vibecut-k1-live-smoke.mjs"),
  cloudOutputVerifier: await read("scripts/verify-vibecut-k1-cloud-output.mjs"),
  exportMediaMetadata: await read("src/features/vibefx-studio/video/export/exportMediaMetadata.js"),
  /*
   * Surface export, apres la phase 7 (2026-08-01): le panneau de l'ancien front
   * est supprime. La logique vit dans le controleur et dans `exportDownload.js`
   * (nomme, URL signee, destination PC), le rendu dans les DEUX feuilles du
   * nouveau front. On lit l'ensemble: les exigences portent sur la surface, pas
   * sur un fichier.
   */
  exportPanel: [
    await read("src/features/vibefx-studio/video/export/useExportController.js"),
    await read("src/features/vibefx-studio/video/export/exportDownload.js"),
    await read("src/features/vibecut/adapters/useExportDownload.js"),
    await read("src/features/vibecut/quick/ExportSheet.jsx"),
    await read("src/features/vibecut/advanced/ExportProSheet.jsx"),
  ].join("\n"),
  exportManifest: await read("src/features/vibefx-studio/video/export/exportManifest.js"),
  exportJobService: await read("src/features/vibefx-studio/video/export/exportJobService.js"),
  functionsExport: await read("functions/src/videoExport.js"),
  renderer: await read("render-service/src/server.js"),
  backoffice: await read("src/app/backoffice/BackofficeClient.jsx"),
};

const requirements = [
  {
    id: "phase-1",
    label: "UI Export Pro branchee sur Firebase sans localMock force",
    status: "done",
    evidence: [
      ["status", /Phase 1[\s\S]*Done/],
      ["exportPanel", /resolveExportRenderMode\(\)/],
      ["packageJson", /smoke-vibecut-export-jobs\.mjs/],
    ],
    rejects: [["exportPanel", /mode:\s*['"]localMock['"]/]],
  },
  {
    id: "phase-2",
    label: "UX progression, logs, compatibilite et metadata output",
    status: "done_mvp",
    evidence: [
      ["status", /Phase 2[\s\S]*Done MVP/],
      ["status", /preparation\/upload\/queued\/rendering\/finalizing\/ready\/failed\/cancelled\/retrying/],
      ["exportManifest", /validateExportRenderCoverage/],
      ["exportPanel", /resolveOutputMediaMetadata/],
      ["exportMediaMetadata", /formatCodecLabel/],
      ["exportMediaMetadata", /formatToContentType/],
      ["exportMediaMetadata", /contentType\.startsWith\('image\/'\)/],
      ["packageJson", /smoke-vibecut-export-media-metadata\.mjs/],
    ],
  },
  {
    id: "phase-3",
    label: "Destination desktop/PC via download et File System Access API",
    status: "done_mvp",
    evidence: [
      ["status", /Phase 3[\s\S]*Done MVP/],
      ["exportPanel", /showDirectoryPicker/],
      ["exportPanel", /vibecut-\$\{safeProjectName\}-\$\{stamp\}/],
    ],
  },
  {
    id: "phase-4",
    label: "Functions quotas, paths owner-scoped, manifest Storage",
    status: "done_mvp",
    evidence: [
      ["status", /Phase 4[\s\S]*Done MVP/],
      ["functionsExport", /users\/\$\{uid\}\/exports/],
      ["functionsExport", /sources\/\$\{typeFolder\}/],
      ["functionsExport", /validateOwnerSourceStoragePath/],
      ["functionsExport", /getVideoExportDownloadUrl/],
    ],
  },
  {
    id: "phase-5",
    label: "Renderer serveur source de verite pour le palier supporte",
    status: "partial",
    evidence: [
      ["status", /Phase 5[\s\S]*Partial/],
      ["renderer", /buildFfmpegArgs/],
      ["renderer", /drawtext/],
      ["renderer", /xfade=transition=\$\{xfadeName\}/],
      ["renderer", /amix=inputs=/],
      ["renderer", /Text animation is not rendered/],
      ["packageJson", /smoke-vibecut-export-coverage-parity\.mjs/],
      ["status", /advanced text animation[\s\S]*neon-scan/],
    ],
  },
  {
    id: "phase-6",
    label: "Securite renderer HMAC/OIDC code prete, live IAM restant",
    status: "done_mvp_code_partial_live",
    evidence: [
      ["status", /Phase 6[\s\S]*Done MVP code \/ Partial live/],
      ["renderer", /x-vibecut-timestamp/],
      ["renderer", /SIGNATURE_TOLERANCE_MS/],
      ["renderer", /EXPORT_RENDERER_VERIFY_MODE/],
      ["renderer", /EXPORT_RENDERER_PRIVATE_IAM_CONFIRMED/],
      ["functionsExport", /EXPORT_RENDERER_AUTH_MODE/],
      ["functionsExport", /resolveRendererAuthRequirements/],
      ["runbook", /roles\/run\.invoker/],
    ],
  },
  {
    id: "phase-7",
    label: "Progress Firestore, retry/cancel durcis, task queue async prepare",
    status: "done_mvp",
    evidence: [
      ["status", /Phase 7[\s\S]*Done MVP/],
      ["functionsExport", /markJobRenderingUnlessCancelled/],
      ["functionsExport", /markJobFailedUnlessCancelled/],
      ["functionsExport", /EXPORT_RENDER_ORCHESTRATION/],
      ["functionsExport", /processVideoExportJob/],
      ["functionsExport", /onTaskDispatched/],
      ["exportJobService", /subscribeLatestVideoExportJob/],
      ["status", /EXPORT_RENDER_ORCHESTRATION=taskQueue/],
    ],
  },
  {
    id: "phase-8",
    label: "Backoffice couts et exports avec callable admin globale",
    status: "done_mvp",
    evidence: [
      ["status", /Phase 8[\s\S]*Done MVP/],
      ["functionsExport", /getVideoExportAdminTelemetry/],
      ["backoffice", /getVideoExportAdminTelemetry/],
      ["packageJson", /test:backoffice-export-telemetry/],
    ],
  },
  {
    id: "phase-9",
    label: "Smoke live final deux videos K1",
    status: "partial_live",
    evidence: [
      ["status", /Phase 9[\s\S]*Partial live/],
      ["status", /OK pour smoke live Cloud Run K1/],
      ["packageJson", /prepare-vibecut-k1-live-smoke\.mjs/],
      ["packageJson", /guard:vibecut-k1-live/],
      ["packageJson", /run-vibecut-k1-cloud-run-live-smoke\.mjs/],
      ["packageJson", /run-vibecut-k1-cloud-run-direct-smoke\.mjs/],
      ["liveGuard", /VIBECUT_LIVE_CONFIRM/],
      ["liveGuard", /VIBECUT_EXECUTE_LIVE[\s\S]*refuse/],
      ["liveGuard", /mutatesCloud[\s\S]*false/],
      ["packageJson", /verify:vibecut-k1-cloud-output/],
      ["cloudOutputVerifier", /VIBECUT_CLOUD_OUTPUT_FILE/],
      ["cloudOutputVerifier", /video codec must be/],
      ["cloudOutputVerifier", /sampled Cloud Run output frame range must not be detected as black/],
      ["status", /smoke:vibecut-k1-cloud-run-direct[\s\S]*verify:vibecut-k1-cloud-output[\s\S]*OK/],
      ["status", /Smoke callable Firebase K1[\s\S]*VIBECUT_FIREBASE_ID_TOKEN/],
      ["status", /MP4 finaux des fixtures pro supportees[\s\S]*non generes/],
    ],
  },
  {
    id: "phase-10",
    label: "Source de verite deploy documentee, secrets hors repo",
    status: "done_mvp",
    evidence: [
      ["status", /Phase 10[\s\S]*Done MVP/],
      ["runbook", /firebase functions:secrets:set EXPORT_SIGNING_SECRET/],
      ["runbook", /Ne pas executer ces commandes sans confirmation explicite/],
      ["runbook", /Tourner `EXPORT_SIGNING_SECRET`/],
    ],
  },
  {
    id: "final-gates",
    label: "Gates release beta complets",
    status: "blocked_local_and_live",
    evidence: [
      ["status", /npm run test:vibecut-export-local-mp4` : OK/],
      ["status", /npm run test:emulators[\s\S]*Java 21\+/],
      ["status", /Smoke callable Firebase K1[\s\S]*bloque/],
      ["status", /pas `Go release beta`/],
    ],
  },
];

assert.match(files.megaprompt, /Definition De Fini/, "megaprompt must remain the hardening source of truth");
assert.match(files.status, /pre-release hardening/, "status must keep the current pre-release verdict");
assert.doesNotMatch(files.status, /Statut global : `Go release beta`/, "status must not declare Go release beta");

const rows = [];

for (const requirement of requirements) {
  const missing = [];

  for (const [fileKey, pattern] of requirement.evidence) {
    if (!pattern.test(files[fileKey])) {
      missing.push(`${fileKey}: ${pattern}`);
    }
  }

  for (const [fileKey, pattern] of requirement.rejects ?? []) {
    if (pattern.test(files[fileKey])) {
      missing.push(`${fileKey}: forbidden ${pattern}`);
    }
  }

  assert.deepEqual(missing, [], `${requirement.id} evidence mismatch`);
  rows.push(`| ${requirement.id} | ${requirement.status} | ${requirement.label} |`);
}

console.log("audit-vibecut-export-hardening-requirements: ok");
console.log("| Requirement | Status | Scope |");
console.log("| --- | --- | --- |");
console.log(rows.join("\n"));
console.log("\nRelease beta remains blocked by documented local/live gates; this audit is non-mutating.");
