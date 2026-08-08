import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "export", "exportManifest.js");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-export-manifest-"));
const tempModulePath = path.join(tempDir, "exportManifest.mjs");

try {
  const source = await readFile(sourcePath, "utf8");
  await writeFile(tempModulePath, source, "utf8");

  const {
    buildExportManifest,
    estimateExportSize,
    getServerRenderCapabilityStatus,
    isServerRenderCapabilitySupported,
    resolveExportQualityPreset,
    SERVER_RENDER_CAPABILITIES,
    validateExportManifest,
    validateExportRenderCoverage,
  } = await import(pathToFileURL(tempModulePath).href);

  // v3 (lot L1): les transitions minutees ne sont plus 'fade'/'crossfade' seules.
  // v4 (lot L3): le mouvement photo porte une intensite et la meme courbe lissee
  // que l'apercu. Prouve par scripts/smoke-vibecut-motion-preview-parity.mjs.
  assert.equal(SERVER_RENDER_CAPABILITIES.version, 4);
  assert.equal(SERVER_RENDER_CAPABILITIES.imageMotionIntensity, true);
  assert.ok(SERVER_RENDER_CAPABILITIES.timedTransitions.length >= 48, "les 48 transitions du catalogue sont minutees depuis le lot B3b");
  assert.equal(isServerRenderCapabilitySupported("timedTransition", "iris-open"), true);
  assert.equal(isServerRenderCapabilitySupported("timedTransition", "blur-cut"), true);
  assert.equal(isServerRenderCapabilitySupported("mediaType", "image"), true);
  assert.equal(isServerRenderCapabilitySupported("imageMotion", "zoom-in"), true);
  assert.equal(isServerRenderCapabilitySupported("timedTransition", "crossfade"), true);
  // Lot B3b (2026-08-03): `cross-zoom` est rendu par un sous-graphe de filtres
  // natifs. Le temoin negatif porte donc sur un id qui n'existe nulle part.
  assert.equal(isServerRenderCapabilitySupported("timedTransition", "cross-zoom"), true);
  assert.equal(isServerRenderCapabilitySupported("timedTransition", "transition-inexistante"), false);
  assert.equal(isServerRenderCapabilitySupported("textAnimation", "fade"), true);
  assert.equal(isServerRenderCapabilitySupported("textAnimation", "neon-scan"), false);
  assert.deepEqual(getServerRenderCapabilityStatus("transition", "crossfade"), {
    supported: true,
    status: "ready",
    label: "Export Pro",
  });
  // `glitch` est rendu depuis le lot B3b; le temoin « preview-only » porte
  // desormais sur la VITESSE de clip, la derniere capacite que le serveur n'a pas.
  assert.equal(getServerRenderCapabilityStatus("transition", "glitch").status, "ready");
  assert.equal(getServerRenderCapabilityStatus("clipSpeed", 2).status, "preview-only");

  const manifest = buildExportManifest({
    projectId: "project-1",
    projectName: "Smoke Export",
    userId: "user-1",
    sequencePreset: "instagram-reel",
    exportFps: 60,
    qualityMode: "pro",
    fitMode: "cover",
    generatedAt: "2026-06-03T10:00:00.000Z",
    preset: { width: 1080, height: 1920, fps: 30 },
    renderPlan: {
      totalDuration: 4,
      clips: [
        {
          id: "clip-a",
          name: "Clip A",
          url: "blob:clip-a",
          start: 0,
          duration: 4,
          trimStart: 0,
          trimEnd: 4,
          speed: 1,
          volume: 80,
          orientationRotation: 90,
          size: 1024 * 1024,
          filters: { exposure: 10, contrast: 120, saturation: 130 },
        },
      ],
      allTransitions: [
        { id: "tr-1", type: "crossfade", start: 1, duration: 0.5, fromItemId: "clip-a", toItemId: "clip-b", params: { placement: "cut" } },
      ],
      textOverlays: [
        { id: "txt-1", content: "Smoke", startTime: 0, endTime: 2, x: 0.5, y: 0.5, fontSize: 72, bold: true, animation: "scale" },
      ],
      audioTracks: [
        { id: "music-1", name: "Music", url: "blob:music", startTime: 0, duration: 4, endTime: 4, volume: 70, size: 512 * 1024 },
      ],
    },
    rightsManifest: [
      { id: "music-1", title: "Music", license: "test-license", socialUse: true, commercialUse: true },
    ],
  });

  assert.equal(manifest.version, 1);
  assert.equal(manifest.render.format, "mp4");
  assert.equal(manifest.render.videoCodec, "h264");
  assert.equal(manifest.render.audioCodec, "aac");
  assert.equal(manifest.render.fps, 60);
  assert.equal(manifest.render.crf, 17);
  assert.equal(manifest.clips[0].orientationRotation, 90);
  assert.equal(manifest.clips[0].filters.contrast, 120);
  assert.equal(manifest.textOverlays[0].content, "Smoke");
  assert.ok(manifest.audit.sourceHashes[0].includes("clip-a"));
  assert.ok(manifest.estimates.outputSize.bytes > 0);
  assert.ok(manifest.estimates.sourceSize.bytes > 0);
  assert.ok(manifest.estimates.cost.eur > 0);
  assert.ok(estimateExportSize(manifest).bytes > 0);
  assert.equal(resolveExportQualityPreset({ qualityMode: "master", width: 1080, height: 1920, fps: 60 }).crf, 15);

  const coverage = validateExportRenderCoverage(manifest);
  assert.equal(coverage.supported, false, "current server renderer must block unsupported visual/audio layers");
  assert.ok(coverage.blockingErrors.some((error) => error.includes("Animation texte")));
  assert.ok(coverage.blockingErrors.some((error) => error.includes("Transition")));

  const simpleServerManifest = buildExportManifest({
    projectName: "Simple Server",
    generatedAt: "2026-06-03T10:00:00.000Z",
    preset: { width: 1080, height: 1920, fps: 30 },
    exportFps: 30,
    renderPlan: {
      totalDuration: 2,
      clips: [
        {
          id: "clip-simple",
          name: "Clip Simple",
          sourceStoragePath: "users/user-1/exports/export-1/sources/video/01-simple.mp4",
          start: 0,
          duration: 2,
          trimStart: 0,
          trimEnd: 2,
          speed: 1,
          volume: 0,
          orientationRotation: 270,
        },
      ],
      allTransitions: [],
      textOverlays: [],
      audioTracks: [],
    },
  });
  const simpleCoverage = validateExportRenderCoverage(simpleServerManifest);
  assert.equal(simpleCoverage.supported, true, "simple silent video with rotation should remain server-exportable");
  assert.ok(simpleCoverage.supportedFeatures.some((feature) => feature.includes("external audio")));

  const transitionServerManifest = buildExportManifest({
    projectName: "Transition Server",
    generatedAt: "2026-06-03T10:00:00.000Z",
    preset: { width: 1080, height: 1920, fps: 30 },
    exportFps: 30,
    renderPlan: {
      totalDuration: 3.5,
      clips: [
        {
          id: "clip-a",
          name: "Clip A",
          sourceStoragePath: "users/user-1/exports/export-1/sources/video/01-a.mp4",
          start: 0,
          duration: 2,
          trimStart: 0,
          trimEnd: 2,
          speed: 1,
          volume: 0,
        },
        {
          id: "clip-b",
          name: "Clip B",
          sourceStoragePath: "users/user-1/exports/export-1/sources/video/02-b.mp4",
          start: 1.5,
          duration: 2,
          trimStart: 0,
          trimEnd: 2,
          speed: 1,
          volume: 0,
        },
      ],
      allTransitions: [
        { id: "tr-adjacent", type: "crossfade", duration: 0.5, fromItemId: "clip-a", toItemId: "clip-b", params: { placement: "cut" } },
      ],
      textOverlays: [],
      audioTracks: [],
    },
  });
  const transitionCoverage = validateExportRenderCoverage(transitionServerManifest);
  assert.equal(transitionCoverage.supported, true, "adjacent crossfade should be server-exportable");
  assert.ok(transitionCoverage.supportedFeatures.some((feature) => feature.includes("fade/crossfade")));

  const nonAdjacentTransitionManifest = {
    ...transitionServerManifest,
    transitions: [
      { id: "tr-free", type: "fade", duration: 0.5, fromItemId: "clip-a", toItemId: "clip-missing", params: { placement: "free" } },
    ],
  };
  const nonAdjacentTransitionCoverage = validateExportRenderCoverage(nonAdjacentTransitionManifest);
  assert.equal(nonAdjacentTransitionCoverage.supported, false);
  assert.ok(nonAdjacentTransitionCoverage.blockingErrors.some((error) => error.includes("non adjacente")));

  const externalAudioServerManifest = buildExportManifest({
    projectName: "External Audio Server",
    generatedAt: "2026-06-03T10:00:00.000Z",
    preset: { width: 1080, height: 1920, fps: 30 },
    exportFps: 30,
    renderPlan: {
      totalDuration: 3,
      clips: [
        {
          id: "clip-simple",
          name: "Clip Simple",
          sourceStoragePath: "users/user-1/exports/export-1/sources/video/01-simple.mp4",
          start: 0,
          duration: 3,
          trimStart: 0,
          trimEnd: 3,
          speed: 1,
          volume: 0,
        },
      ],
      allTransitions: [],
      textOverlays: [],
      audioTracks: [
        {
          id: "music-simple",
          name: "Music Simple",
          sourceStoragePath: "users/user-1/exports/export-1/sources/audio/music.mp3",
          startTime: 0.5,
          duration: 2,
          trimStart: 0,
          trimEnd: 2,
          volume: 65,
        },
      ],
    },
  });
  const externalAudioCoverage = validateExportRenderCoverage(externalAudioServerManifest);
  assert.equal(externalAudioCoverage.supported, true, "external audio track with trim/start/volume should be server-exportable");

  const textServerManifest = buildExportManifest({
    projectName: "Text Server",
    generatedAt: "2026-06-03T10:00:00.000Z",
    preset: { width: 1080, height: 1920, fps: 30 },
    exportFps: 30,
    renderPlan: {
      totalDuration: 3,
      clips: [
        {
          id: "clip-simple",
          name: "Clip Simple",
          sourceStoragePath: "users/user-1/exports/export-1/sources/video/01-simple.mp4",
          start: 0,
          duration: 3,
          trimStart: 0,
          trimEnd: 3,
          speed: 1,
          volume: 0,
        },
      ],
      allTransitions: [],
      textOverlays: [
        {
          id: "text-simple",
          content: "SERVER TEXT",
          startTime: 0.25,
          endTime: 2.5,
          x: 0.5,
          y: 0.35,
          fontSize: 72,
          color: "#ffffff",
          animation: "fade",
          animationOut: "fade",
        },
      ],
      audioTracks: [],
    },
  });
  const textCoverage = validateExportRenderCoverage(textServerManifest);
  assert.equal(textCoverage.supported, true, "basic fade text should be server-exportable");

  const photoServerManifest = buildExportManifest({
    projectName: "Photo Ken Burns",
    generatedAt: "2026-06-03T10:00:00.000Z",
    preset: { width: 1080, height: 1920, fps: 60 },
    exportFps: 60,
    renderPlan: {
      totalDuration: 4,
      clips: [
        {
          id: "photo-scene",
          name: "Photo Scene",
          mediaType: "image",
          mimeType: "image/jpeg",
          sourceStoragePath: "users/user-1/exports/export-1/sources/image/01-photo.jpg",
          duration: 4,
          trimStart: 0,
          trimEnd: 4,
          speed: 1,
          motion: "zoom-in",
        },
      ],
      allTransitions: [],
      textOverlays: [],
      audioTracks: [],
    },
  });
  assert.equal(photoServerManifest.clips[0].mediaType, "image");
  assert.equal(photoServerManifest.clips[0].motion.preset, "zoom-in");
  assert.equal(validateExportRenderCoverage(photoServerManifest).supported, true, "Ken Burns photo scene should be server-exportable");

  const colorServerManifest = buildExportManifest({
    projectName: "Color Server",
    generatedAt: "2026-06-03T10:00:00.000Z",
    preset: { width: 1080, height: 1920, fps: 30 },
    exportFps: 30,
    renderPlan: {
      totalDuration: 3,
      clips: [
        {
          id: "clip-color",
          name: "Clip Color",
          sourceStoragePath: "users/user-1/exports/export-1/sources/video/01-color.mp4",
          start: 0,
          duration: 3,
          trimStart: 0,
          trimEnd: 3,
          speed: 1,
          volume: 0,
          filters: {
            exposure: 12,
            brightness: 96,
            contrast: 124,
            saturation: 118,
            vibrance: 20,
            temperature: -12,
            tint: 5,
            hue: 18,
            shadows: -8,
            midtones: 4,
            highlights: 10,
            fade: 6,
            vignette: 12,
            grain: 8,
          },
        },
      ],
      allTransitions: [],
      textOverlays: [],
      audioTracks: [],
    },
  });
  const colorCoverage = validateExportRenderCoverage(colorServerManifest);
  assert.equal(colorCoverage.supported, true, "known FFmpeg color filters should be server-exportable");

  const unsupportedColorManifest = {
    ...colorServerManifest,
    clips: [
      {
        ...colorServerManifest.clips[0],
        filters: {
          ...colorServerManifest.clips[0].filters,
          unsupportedCurve: 1,
        },
      },
    ],
  };
  const unsupportedColorCoverage = validateExportRenderCoverage(unsupportedColorManifest);
  assert.equal(unsupportedColorCoverage.supported, false);
  assert.ok(unsupportedColorCoverage.blockingErrors.some((error) => error.includes("unsupportedCurve")));

  const localAudit = validateExportManifest(manifest, { mode: "localMock" });
  assert.equal(localAudit.status, "warning", "localMock should warn when sources are not uploaded to Storage");
  assert.ok(localAudit.warnings.some((warning) => warning.includes("non uploadee")));

  const serverAudit = validateExportManifest(manifest, { mode: "firebase" });
  assert.equal(serverAudit.status, "blocked", "firebase mode must require server source paths");
  assert.ok(serverAudit.errors.some((error) => error.includes("Source serveur manquante")));

  console.log("smoke-vibecut-export-manifest: ok");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
