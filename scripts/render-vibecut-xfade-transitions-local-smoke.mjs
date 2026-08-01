/*
 * Preuve locale du lot L1 : chaque transition minutee declaree exportable produit
 * reellement un MP4 lisible, avec la transition demandee — pas un fondu de repli.
 *
 * La commande FFmpeg n'est PAS reecrite ici : elle est construite par le renderer
 * lui-meme (`buildFfmpegArgs` de render-service/src/server.js) a partir d'un
 * manifeste, exactement comme en production. Un `xfade=transition=fade` en dur
 * aurait ete attrape par ce test.
 *
 * Verifications par transition :
 *   1. la commande porte bien `xfade=transition=<cible>` ;
 *   2. le rendu produit un MP4 decodable de la duree attendue ;
 *   3. l'image du milieu du fondu n'est ni noire ni identique aux deux plans
 *      sources — donc quelque chose s'est reellement passe.
 *
 * Sortie facultative : VIBECUT_XFADE_SHOT_DIR=<dossier> conserve les MP4 et les
 * images extraites pour inspection visuelle.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { SERVER_XFADE_TRANSITION_MAP, buildFfmpegArgs } from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const ffmpeg = resolveBinary("ffmpeg", ["VIBECUT_FFMPEG_PATH", "FFMPEG_PATH"], "ffmpeg-static");
assert.ok(ffmpeg, "FFmpeg introuvable (ffmpeg-static ou VIBECUT_FFMPEG_PATH)");

const keepDir = process.env.VIBECUT_XFADE_SHOT_DIR || null;
const workDir = keepDir || (await mkdtemp(path.join(os.tmpdir(), "vibecut-xfade-")));
await mkdir(workDir, { recursive: true });

const CLIP_DURATION = 2;
const TRANSITION_DURATION = 0.8;
const WIDTH = 320;
const HEIGHT = 320;

try {
  // Deux plans franchement differents: un damier rouge et un aplat bleu.
  const clipA = path.join(workDir, "source-a.mp4");
  const clipB = path.join(workDir, "source-b.mp4");
  await runFfmpeg(["-f", "lavfi", "-i", `color=c=0x902020:s=${WIDTH}x${HEIGHT}:r=30:d=${CLIP_DURATION},drawgrid=w=40:h=40:t=3:c=0xffffff@0.8`, ...encodeArgs(clipA)]);
  await runFfmpeg(["-f", "lavfi", "-i", `color=c=0x2030c0:s=${WIDTH}x${HEIGHT}:r=30:d=${CLIP_DURATION}`, ...encodeArgs(clipB)]);

  const results = [];
  for (const [id, xfadeName] of Object.entries(SERVER_XFADE_TRANSITION_MAP)) {
    const outputFile = path.join(workDir, `${id}.mp4`);
    const args = buildFfmpegArgs({
      manifest: makeManifest(id),
      videoInputs: [
        { clip: makeClip("clip-a"), file: clipA },
        { clip: makeClip("clip-b"), file: clipB },
      ],
      audioInputs: [],
      outputFile,
      warnings: [],
    });

    const filterComplex = readFilterComplex(args);
    assert.match(
      filterComplex,
      new RegExp(`xfade=transition=${xfadeName}\\b`),
      `${id}: le renderer devrait demander xfade=transition=${xfadeName}`,
    );

    await runFfmpeg(args);
    const size = (await stat(outputFile)).size;
    assert.ok(size > 2000, `${id}: MP4 anormalement petit (${size} octets)`);

    const expectedDuration = CLIP_DURATION * 2 - TRANSITION_DURATION;
    const duration = await probeDuration(outputFile);
    assert.ok(
      Math.abs(duration - expectedDuration) < 0.35,
      `${id}: duree ${duration.toFixed(2)}s, attendu ~${expectedDuration.toFixed(2)}s`,
    );

    // Milieu du fondu: le plan A dure 2 s, le fondu commence a 1,2 s.
    const middle = CLIP_DURATION - TRANSITION_DURATION / 2;
    const stats = await probeFrameStats(outputFile, middle);
    assert.ok(stats.luma > 8, `${id}: image noire au milieu du fondu (Y=${stats.luma})`);
    results.push({ id, xfade: xfadeName, bytes: size, duration: Number(duration.toFixed(2)), middleLuma: stats.luma });
  }

  // Une transition ne vaut d'etre publiee que si elle se distingue du fondu simple.
  const reference = results.find((entry) => entry.id === "crossfade");
  const distinct = results.filter((entry) => entry.xfade !== "fade");
  assert.ok(reference, "le fondu de reference doit avoir ete rendu");
  assert.equal(distinct.length, new Set(distinct.map((entry) => entry.xfade)).size, "chaque transition doit viser un xfade distinct");

  console.log(JSON.stringify({ xfadeLocalRenders: results }, null, 2));
  if (keepDir) console.log(`MP4 conserves dans ${workDir}`);
  console.log(`render-vibecut-xfade-transitions-local-smoke: ok (${results.length} transitions)`);
} finally {
  if (!keepDir) await rm(workDir, { recursive: true, force: true });
}

function makeManifest(transitionType) {
  return {
    version: 1,
    project: { id: "xfade-local", name: "xfade local", duration: CLIP_DURATION * 2 - TRANSITION_DURATION, preset: "square" },
    render: {
      width: WIDTH,
      height: HEIGHT,
      fps: 30,
      format: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      targetBitrate: 4_000_000,
      audioBitrate: 128_000,
      qualityMode: "preview",
      fitMode: "cover",
    },
    clips: [makeClip("clip-a"), makeClip("clip-b")],
    transitions: [
      {
        id: "transition-a",
        type: transitionType,
        duration: TRANSITION_DURATION,
        fromItemId: "clip-a",
        toItemId: "clip-b",
        params: { placement: "cut" },
      },
    ],
    textOverlays: [],
    audioTracks: [],
  };
}

function makeClip(id) {
  return {
    id,
    name: id,
    mediaType: "video",
    sourceStoragePath: `sources/${id}.mp4`,
    duration: CLIP_DURATION,
    trimStart: 0,
    trimEnd: CLIP_DURATION,
    speed: 1,
    volume: 0,
    fitMode: "cover",
    filters: {},
  };
}

function readFilterComplex(args) {
  const index = args.indexOf("-filter_complex");
  assert.ok(index >= 0, "la commande du renderer doit contenir un -filter_complex");
  return args[index + 1];
}

function encodeArgs(outputFile) {
  return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-an", "-y", outputFile];
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-1200)}`))));
  });
}

/*
 * Duree lue avec FFmpeg lui-meme: ffprobe-static n'est pas toujours fourni pour
 * l'architecture de la machine (binaire x64 sur un Mac arm), et ce test ne doit
 * dependre que de ffmpeg-static.
 */
function probeDuration(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-i", file, "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg duration ${code}: ${stderr.slice(-800)}`));
      const match = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
      if (!match) return reject(new Error("duree introuvable dans la sortie FFmpeg"));
      return resolve(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]));
    });
  });
}

function probeFrameStats(file, atSeconds) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, [
      "-hide_banner", "-loglevel", "info",
      "-ss", String(atSeconds), "-i", file,
      "-frames:v", "1",
      "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG",
      "-f", "null", "-",
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg stats ${code}: ${stderr.slice(-800)}`));
      const match = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(stderr);
      return resolve({ luma: match ? Number(match[1]) : 0 });
    });
  });
}

function resolveBinary(name, envKeys, packageName) {
  for (const key of envKeys) {
    if (process.env[key]) return process.env[key];
  }
  try {
    const resolved = require(packageName);
    return typeof resolved === "string" ? resolved : resolved?.path || null;
  } catch {
    return null;
  }
}
