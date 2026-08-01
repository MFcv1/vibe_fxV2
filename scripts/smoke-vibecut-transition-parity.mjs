/*
 * Parite des transitions minutees, sur quatre fronts a la fois :
 *   1. la table du renderer (render-service/src/server.js)
 *   2. la table applicative (exportManifest.js -> SERVER_RENDER_CAPABILITIES)
 *   3. la validation Functions (functions/src/videoExport.js)
 *   4. le moteur d'apercu (VideoEngine.renderTransition)
 * plus une verification que chaque cible `xfade` existe vraiment dans le build FFmpeg
 * local. Le lot L1 de docs/vibecut-styles-roadmap-2026-07-30.md repose entierement
 * sur ces quatre listes : si l'une derive, l'apercu ment sur l'export.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  SERVER_XFADE_TRANSITION_MAP as RENDERER_MAP,
  resolveXfadeTransitionName,
  validateManifest as validateRendererManifest,
} from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const functionsExport = require("../functions/src/videoExport.js");
const uid = "user-transition-parity";
const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-transition-parity-"));

try {
  const manifestModule = await importAppModule(
    path.join("src", "features", "vibefx-studio", "video", "export", "exportManifest.js"),
  );
  const { SERVER_XFADE_TRANSITION_MAP: APP_MAP, SERVER_RENDER_CAPABILITIES, validateExportRenderCoverage } = manifestModule;

  // 1. Les deux tables sont identiques, cle par cle et valeur par valeur.
  assert.deepEqual(
    APP_MAP,
    RENDERER_MAP,
    "la table xfade de exportManifest.js et celle du renderer doivent etre identiques",
  );

  const ids = Object.keys(RENDERER_MAP);
  assert.ok(ids.length >= 16, `au moins 16 transitions minutees attendues, ${ids.length} trouvees`);
  assert.deepEqual(
    [...SERVER_RENDER_CAPABILITIES.timedTransitions],
    ids,
    "SERVER_RENDER_CAPABILITIES.timedTransitions doit lister exactement les cles de la table xfade",
  );
  assert.deepEqual(
    [...SERVER_RENDER_CAPABILITIES.transitions],
    ["cut", ...ids],
    "SERVER_RENDER_CAPABILITIES.transitions doit valoir 'cut' + les transitions minutees",
  );

  // 2. Chaque cible xfade existe dans le build FFmpeg local.
  const availableXfade = readLocalXfadeNames();
  Object.entries(RENDERER_MAP).forEach(([id, xfadeName]) => {
    assert.ok(
      availableXfade.has(xfadeName),
      `xfade=${xfadeName} (${id}) est absent du build FFmpeg local`,
    );
  });
  assert.equal(resolveXfadeTransitionName("id-inconnu"), "fade", "repli attendu sur fade");

  // 3. Le moteur d'apercu route chaque id vers son implementation calquee sur xfade.
  const engineSource = await readFile(
    path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "engine", "VideoEngine.js"),
    "utf8",
  );
  assert.match(
    engineSource,
    /if \(isXfadeTransition\(type\)\)[\s\S]{0,200}renderXfadeTransition/,
    "VideoEngine.renderTransition doit deleguer les transitions exportables avant d'appliquer son easeInOut",
  );
  const xfadeSource = await readFile(
    path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "engine", "xfadeTransitions.js"),
    "utf8",
  );
  new Set(Object.values(RENDERER_MAP)).forEach((xfadeName) => {
    assert.match(
      xfadeSource,
      new RegExp(`case '${xfadeName}'`),
      `xfadeTransitions.js ne rend pas '${xfadeName}' : l'apercu mentirait sur l'export`,
    );
  });

  // 4. Les trois validations acceptent chaque id, et refusent un id hors table.
  const accepted = ids.map((id) => {
    const manifest = makeManifest(id);
    const coverage = validateExportRenderCoverage(manifest);
    const functionErrors = functionsExport.validateExportManifest(manifest, { uid });
    const renderer = validateRendererManifest(manifest);
    assert.equal(coverage.supported, true, `${id}: couverture client refusee (${coverage.blockingErrors.join(" / ")})`);
    assert.equal(functionErrors.length, 0, `${id}: Functions refuse (${functionErrors.join(" / ")})`);
    assert.equal(renderer.errors.length, 0, `${id}: renderer refuse (${renderer.errors.join(" / ")})`);
    return { id, xfade: RENDERER_MAP[id] };
  });

  const unknown = makeManifest("light-leak");
  assert.equal(validateExportRenderCoverage(unknown).supported, false, "une transition hors table doit rester refusee cote client");
  assert.ok(functionsExport.validateExportManifest(unknown, { uid }).length > 0, "une transition hors table doit rester refusee cote Functions");
  assert.ok(validateRendererManifest(unknown).errors.length > 0, "une transition hors table doit rester refusee cote renderer");

  console.log(JSON.stringify({ transitionParity: accepted }, null, 2));
  console.log("smoke-vibecut-transition-parity: ok");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

/*
 * Les modules de src/ sont du JS standard, mais Node refuse de les charger tels quels
 * depuis un script .mjs du depot (extension .js + package non-type-module). On recopie
 * le source en .mjs dans un dossier temporaire, comme smoke-vibecut-export-coverage-parity.
 */
async function importAppModule(relativePath) {
  const source = await readFile(path.join(process.cwd(), relativePath), "utf8");
  const target = path.join(tempDir, `${path.basename(relativePath, ".js")}.mjs`);
  await writeFile(target, source, "utf8");
  return import(pathToFileURL(target).href);
}

function readLocalXfadeNames() {
  const ffmpegPath = process.env.VIBECUT_FFMPEG_PATH || process.env.FFMPEG_PATH || resolveFfmpegStatic();
  assert.ok(ffmpegPath, "aucun binaire FFmpeg disponible pour verifier les noms xfade");
  const result = spawnSync(ffmpegPath, ["-hide_banner", "-h", "filter=xfade"], { encoding: "utf8" });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const names = new Set();
  output.split("\n").forEach((line) => {
    const match = /^\s{5}(\w+)\s+-?\d+\s+\.\.FV/.exec(line);
    if (match) names.add(match[1]);
  });
  assert.ok(names.size > 20, `liste xfade illisible (${names.size} entrees)`);
  return names;
}

function resolveFfmpegStatic() {
  try {
    return require("ffmpeg-static");
  } catch {
    return null;
  }
}

function makeManifest(transitionType) {
  return {
    version: 1,
    project: { id: "transition-parity", name: "Transition parity", duration: 5.5, preset: "instagram-reel" },
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
    clips: [clip("clip-a"), clip("clip-b")],
    transitions: [
      {
        id: "transition-a",
        type: transitionType,
        duration: 0.5,
        fromItemId: "clip-a",
        toItemId: "clip-b",
        params: { placement: "cut" },
      },
    ],
    textOverlays: [],
    audioTracks: [],
    estimates: { cost: { eur: 0.001, label: "0.0010 EUR est." } },
  };
}

function clip(id) {
  return {
    id,
    name: id,
    sourceStoragePath: `users/${uid}/exports/transition-parity/sources/video/${id}.mp4`,
    duration: 3,
    trimStart: 0,
    trimEnd: 3,
    speed: 1,
    volume: 80,
    fitMode: "cover",
    filters: {},
    metadata: { sourceSizeBytes: 12 * 1024 * 1024 },
  };
}
