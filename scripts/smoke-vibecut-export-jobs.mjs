import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const exportDir = path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "export");
/*
 * Surface export, apres la phase 7 (2026-08-01).
 *
 * Le panneau de l'ancien front est supprime. Les garanties ci-dessous portent
 * toujours sur la SURFACE, pas sur un fichier: on lit donc le controleur, le
 * module de telechargement (nom horodate, URL signee, destination PC - deplaces
 * du panneau plutot que perdus) et les deux feuilles du nouveau front.
 *
 * Les libelles d'assertion disent encore « ExportVideoPanel » par continuite
 * avec l'historique des exigences; ils designent desormais cette surface.
 */
const controllerPath = path.join(exportDir, "useExportController.js");
const extraSurfacePaths = [
  path.join(exportDir, "exportDownload.js"),
  path.join(process.cwd(), "src", "features", "vibecut", "adapters", "useExportDownload.js"),
  path.join(process.cwd(), "src", "features", "vibecut", "quick", "ExportSheet.jsx"),
  path.join(process.cwd(), "src", "features", "vibecut", "advanced", "ExportProSheet.jsx"),
];
const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-export-jobs-"));

try {
  const panelSource = [
    await readFile(controllerPath, "utf8"),
    ...(await Promise.all(extraSurfacePaths.map((file) => readFile(file, "utf8")))),
  ].join("\n");
  assert.equal(
    /startVideoExportJob\(\{[\s\S]*?mode:\s*['"]localMock['"]/m.test(panelSource),
    false,
    "ExportVideoPanel must not force localMock when starting Export Pro",
  );
  assert.equal(
    /retryVideoExportJob\(\{[\s\S]*?mode:\s*['"]localMock['"]/m.test(panelSource),
    false,
    "ExportVideoPanel must not force localMock when retrying Export Pro",
  );
  assert.equal(
    /validateExportManifest\([^)]*\{[^}]*mode:\s*['"]localMock['"]/m.test(panelSource),
    false,
    "ExportVideoPanel preflight must use the configured export mode",
  );
  assert.match(
    panelSource,
    /showDirectoryPicker/,
    "ExportVideoPanel must expose File System Access API destination support",
  );
  assert.match(
    panelSource,
    /vibecut-export-destination-v1/,
    "ExportVideoPanel must persist the desktop destination preference",
  );
  assert.match(
    panelSource,
    /function buildExportFileName/,
    "ExportVideoPanel must generate deterministic MP4 file names",
  );
  assert.match(
    panelSource,
    /function resolveExportOutputDownloadUrl/,
    "ExportVideoPanel must regenerate Storage download URLs when only storagePath is available",
  );
  assert.match(
    panelSource,
    /retryVideoExportJob\(\{[\s\S]*jobId:\s*job\?\.id/,
    "ExportVideoPanel must pass jobId to retry existing Firebase jobs from the server manifest",
  );
  assert.match(
    panelSource,
    /resolveOutputMediaMetadata/,
    "ExportVideoPanel must use the shared output media metadata normalizer",
  );
  assert.match(
    panelSource,
    /data-testid=\{label === 'Codec' \? 'export-output-codec'/,
    "ExportVideoPanel must expose the real output codec for UI tests",
  );
  assert.match(
    panelSource,
    /label === 'Container' \? 'export-output-container'/,
    "ExportVideoPanel must expose the real output container for UI tests",
  );
  assert.match(
    panelSource,
    /label === 'MIME' \? 'export-output-mime'/,
    "ExportVideoPanel must expose the real output MIME type for UI tests",
  );
  assert.equal(
    /\['Codec',\s*['"]H\.264\/AAC['"]\]/.test(panelSource),
    false,
    "ExportVideoPanel must not hardcode H.264/AAC in the render modal grid",
  );

  const renderServiceSource = await readFile(path.join(exportDir, "exportRenderService.js"), "utf8");
  assert.match(
    renderServiceSource,
    /projectName:\s*data\.projectName \|\| manifest\?\.project\?\.name/,
    "Firebase render results must preserve the project name returned by Functions",
  );
  assert.match(
    renderServiceSource,
    /render:\s*data\.render \|\| manifest\?\.render/,
    "Firebase render results must preserve render codec/resolution metadata",
  );
  assert.match(
    renderServiceSource,
    /estimates:\s*data\.estimates \|\| manifest\?\.estimates/,
    "Firebase render results must preserve export estimates for the modal",
  );

  const jobServiceSource = await readFile(path.join(exportDir, "exportJobService.js"), "utf8");
  assert.match(
    jobServiceSource,
    /manifestSummary\.project\?\.name/,
    "Firestore job normalization must recover project names from manifestSummary after refresh",
  );
  assert.match(
    jobServiceSource,
    /manifestSummary\.sourceSizeBytes/,
    "Firestore job normalization must recover source size estimates from manifestSummary after refresh",
  );

  const files = [
    ["exportManifest.js", "exportManifest.mjs"],
    ["exportStorageService.js", "exportStorageService.mjs"],
    ["exportRenderService.js", "exportRenderService.mjs"],
    ["exportJobService.js", "exportJobService.mjs"],
  ];

  for (const [sourceName, targetName] of files) {
    let source = await readFile(path.join(exportDir, sourceName), "utf8");
    source = source
      .replaceAll("./exportStorageService", "./exportStorageService.mjs")
      .replaceAll("./exportRenderService", "./exportRenderService.mjs");
    await writeFile(path.join(tempDir, targetName), source, "utf8");
  }

  const { buildExportManifest } = await import(pathToFileURL(path.join(tempDir, "exportManifest.mjs")).href);
  const { startVideoExportJob } = await import(pathToFileURL(path.join(tempDir, "exportJobService.mjs")).href);

  const manifest = buildExportManifest({
    projectName: "Job Smoke",
    generatedAt: "2026-06-03T10:00:00.000Z",
    preset: { width: 1080, height: 1920, fps: 30 },
    exportFps: 30,
    qualityMode: "preview",
    renderPlan: {
      totalDuration: 2,
      clips: [
        { id: "clip-a", name: "Clip A", url: "blob:clip-a", start: 0, duration: 2, trimStart: 0, trimEnd: 2, speed: 1, volume: 100 },
      ],
      allTransitions: [],
      textOverlays: [],
      audioTracks: [],
    },
  });

  const updates = [];
  const finalJob = await startVideoExportJob({
    manifest,
    mode: "localMock",
    onUpdate: (job) => updates.push({ status: job.status, phase: job.phase, progress: job.progress }),
  });

  assert.equal(finalJob.status, "ready");
  assert.equal(finalJob.output.mockOnly, true);
  assert.equal(finalJob.progress, 100);
  assert.ok(updates.some((update) => update.phase === "preparing_sources"));
  assert.ok(updates.some((update) => update.phase === "queueing"));
  assert.ok(updates.some((update) => update.phase === "rendering"));
  assert.ok(updates.some((update) => update.phase === "encoding"));
  assert.ok(updates.some((update) => update.phase === "finalizing"));
  assert.ok(finalJob.logs.some((log) => log.message.includes("Aucun MP4 reel")));

  const abortController = new AbortController();
  const cancelPromise = startVideoExportJob({
    manifest,
    mode: "localMock",
    signal: abortController.signal,
  });
  abortController.abort();
  const cancelledJob = await cancelPromise;
  assert.equal(cancelledJob.status, "cancelled");
  assert.equal(cancelledJob.error.code, "job-cancelled");

  console.log("smoke-vibecut-export-jobs: ok");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
