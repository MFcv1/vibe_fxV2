/*
 * TROIS PLANS ENCHAINES, en MP4 reel. Le test que le lot B3b ne pouvait pas se
 * permettre de sauter.
 *
 * Une transition ISOLEE ne revele pas les deux defauts les plus probables de ce
 * lot, parce que sur deux plans ils n'existent tout simplement pas :
 *
 *  1. UN REPERE DE TEMPS FAUX. Les filtres poses sur la queue du plan sortant
 *     sont rampes par `sendcmd`, dont les horodatages sont sur le PTS de
 *     l'entree concernee. Sur la premiere coupe, la fenetre commence a
 *     `duree(A) - d` ; sur la deuxieme, elle commence a `duree(A) + duree(B) - 2d`.
 *     Se tromper de repere fait tomber l'effet HORS de la fenetre a la deuxieme
 *     coupe - et la deuxieme coupe rendrait alors un simple fondu, sans que rien
 *     ne le signale.
 *
 *  2. UNE IMAGE PERDUE AU RECOLLAGE. Quatre effets sont confines a leur fenetre
 *     par un decoupage `split` / `trim` / `concat`. Avec des bornes en SECONDES,
 *     la mesure du 2026-08-03 perdait une image sur 102 : tout le montage se
 *     decalait d'un trentieme de seconde et l'audio se desynchronisait. Les
 *     bornes sont donc en numeros d'image, et c'est ici qu'on le verifie.
 *
 * Le test compte donc les images du montage, et compare CHACUNE des deux coupes a
 * ce qu'un fondu simple aurait donne au meme instant. Les deux doivent s'en
 * ecarter, et s'en ecarter comparablement.
 *
 * La commande FFmpeg est construite par `buildFfmpegArgs` du renderer, pas
 * reecrite ici.
 *
 * VIBECUT_CHAIN_SHOT_DIR=<dossier> conserve les MP4 pour inspection.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { SERVER_TRANSITION_EFFECTS, buildFfmpegArgs } from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const ffmpeg = resolveFfmpeg();
assert.ok(ffmpeg, "FFmpeg introuvable (ffmpeg-static ou VIBECUT_FFMPEG_PATH)");

const WIDTH = 320;
const HEIGHT = 320;
const FPS = 30;
const CLIP_DURATION = 1.6;
const TRANSITION_DURATION = 0.6;
const CLIP_COUNT = 3;
const EXPECTED_DURATION = CLIP_DURATION * CLIP_COUNT - TRANSITION_DURATION * (CLIP_COUNT - 1);
const EXPECTED_FRAMES = Math.round(EXPECTED_DURATION * FPS);

/*
 * Ecart minimal, sur 0-255, entre la coupe rendue et le meme instant en fondu
 * simple. Il ne dit pas « l'effet est joli », il dit « l'effet a eu lieu ». Un
 * repere de temps faux ramene cet ecart a zero.
 */
const MIN_EFFECT_GAP = 2;

/*
 * Ecart maximal TOLERE hors de toute fenetre de transition. Ces images n'ont
 * traverse aucun filtre ; il ne reste que le reencodage H.264, dont le chemin
 * differe legerement quand le flux a ete decoupe puis recolle (pire mesure :
 * 1,54 sur `rgb-split`). Le seuil reste tres loin de ce qu'un effet deplace
 * produit - la sentinelle du 2026-08-03 mesure alors plus de 20.
 */
const MAX_QUIET_GAP = 3;

const keepDir = process.env.VIBECUT_CHAIN_SHOT_DIR || null;
const workDir = keepDir || (await mkdtemp(path.join(os.tmpdir(), "vibecut-chain-")));
await mkdir(workDir, { recursive: true });

try {
  const files = [];
  const colors = ["0x902020", "0x2030c0", "0x208040"];
  for (let index = 0; index < CLIP_COUNT; index += 1) {
    const file = path.join(workDir, `source-${index}.mp4`);
    await runFfmpeg([
      "-f", "lavfi",
      "-i", `color=c=${colors[index]}:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${CLIP_DURATION},drawgrid=w=40:h=40:t=3:c=0xffffff@0.85`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-an", file,
    ]);
    files.push(file);
  }

  // Les deux instants a examiner: le milieu de chaque coupe, sur la timeline finale.
  const cutMiddles = [
    CLIP_DURATION - TRANSITION_DURATION / 2,
    CLIP_DURATION * 2 - TRANSITION_DURATION * 1.5,
  ];

  /*
   * Instants HORS de toute fenetre de transition : le montage doit y etre
   * strictement intact. C'est ce qui attrape une fenetre de temps posee au
   * mauvais endroit - defaut que les deux assertions precedentes laissaient
   * passer, puisque l'effet a bien lieu, simplement pas la ou il faut.
   * Verifie par sentinelle le 2026-08-03.
   */
  const quietMoments = [0.30, CLIP_DURATION + 0.30];

  const reference = await renderChain("crossfade", files);
  assert.equal(
    reference.frames,
    EXPECTED_FRAMES,
    `crossfade: ${reference.frames} images rendues, ${EXPECTED_FRAMES} attendues`,
  );
  const referenceFrames = await Promise.all(cutMiddles.map((at) => grabFrame(reference.file, at)));
  const referenceQuiet = await Promise.all(quietMoments.map((at) => grabFrame(reference.file, at)));

  const report = [];
  for (const id of Object.keys(SERVER_TRANSITION_EFFECTS)) {
    const rendered = await renderChain(id, files);

    // 1. Le montage garde EXACTEMENT sa longueur.
    assert.equal(
      rendered.frames,
      EXPECTED_FRAMES,
      `${id}: ${rendered.frames} images rendues, ${EXPECTED_FRAMES} attendues. `
      + "Une image perdue decale tout le montage et desynchronise l'audio.",
    );

    // 2. Les DEUX coupes portent l'effet, pas seulement la premiere.
    const gaps = [];
    for (const [index, at] of cutMiddles.entries()) {
      const frame = await grabFrame(rendered.file, at);
      gaps.push(meanAbsDiff(frame, referenceFrames[index]));
    }
    gaps.forEach((gap, index) => {
      assert.ok(
        gap >= MIN_EFFECT_GAP,
        `${id}: la coupe ${index + 1} est indiscernable d'un fondu simple (ecart ${gap.toFixed(2)}/255). `
        + "C'est la signature d'une fenetre de temps placee au mauvais endroit.",
      );
    });

    /*
     * 3. Les deux coupes sont affectees COMPARABLEMENT. Le cas qu'on cherche est
     * l'effet qui marche a la premiere coupe et se degrade a la seconde : le
     * total resterait au-dessus du seuil, mais le rapport s'effondrerait.
     */
    const ratio = Math.min(...gaps) / Math.max(...gaps);
    assert.ok(
      ratio >= 0.25,
      `${id}: la deuxieme coupe est bien moins marquee que la premiere `
      + `(${gaps.map((gap) => gap.toFixed(1)).join(" contre ")}/255). Repere de temps suspect.`,
    );

    /*
     * 4. HORS FENETRE, rien ne bouge. Le seuil est serre parce qu'il n'y a
     * strictement rien a expliquer : ces images-la n'ont traverse aucun filtre.
     * Seul le reencodage les separe du fondu de reference.
     */
    const quietGaps = [];
    for (const [index, at] of quietMoments.entries()) {
      const frame = await grabFrame(rendered.file, at);
      quietGaps.push(meanAbsDiff(frame, referenceQuiet[index]));
    }
    quietGaps.forEach((gap, index) => {
      assert.ok(
        gap <= MAX_QUIET_GAP,
        `${id}: l'image a ${quietMoments[index]} s est modifiee (${gap.toFixed(2)}/255) alors qu'elle est HORS de toute transition. `
        + "C'est la signature d'une fenetre de temps posee au mauvais endroit.",
      );
    });

    report.push({
      id,
      frames: rendered.frames,
      cutGaps: gaps.map((gap) => Number(gap.toFixed(2))),
      quietGaps: quietGaps.map((gap) => Number(gap.toFixed(2))),
    });
  }

  console.log(JSON.stringify({ chainRenders: report }, null, 2));
  if (keepDir) console.log(`MP4 conserves dans ${workDir}`);
  console.log(`smoke-vibecut-transition-chain-mp4: ok (${report.length} effets x ${CLIP_COUNT} plans)`);
} finally {
  if (!keepDir) await rm(workDir, { recursive: true, force: true });
}

async function renderChain(type, files) {
  const file = path.join(workDir, `chain-${type}.mp4`);
  const clips = files.map((_, index) => makeClip(`clip-${index}`));
  const args = buildFfmpegArgs({
    manifest: {
      version: 1,
      project: { id: "chain", name: "chain", duration: EXPECTED_DURATION, preset: "square" },
      render: {
        width: WIDTH,
        height: HEIGHT,
        fps: FPS,
        format: "mp4",
        videoCodec: "h264",
        audioCodec: "aac",
        targetBitrate: 4_000_000,
        audioBitrate: 128_000,
        qualityMode: "preview",
        fitMode: "cover",
      },
      clips,
      transitions: clips.slice(1).map((clip, index) => ({
        id: `transition-${index}`,
        type,
        duration: TRANSITION_DURATION,
        fromItemId: clips[index].id,
        toItemId: clip.id,
        params: { placement: "cut" },
      })),
      textOverlays: [],
      audioTracks: [],
    },
    videoInputs: files.map((source, index) => ({ clip: clips[index], file: source })),
    audioInputs: [],
    outputFile: file,
    warnings: [],
  });
  await runFfmpeg(args);
  return { file, frames: await countFrames(file) };
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

function countFrames(file) {
  return runFfmpegCapture([
    "-i", file, "-map", "0:v:0", "-c", "copy", "-f", "null", "-",
  ], true).then((stderr) => {
    const matches = [...stderr.matchAll(/frame=\s*(\d+)/g)];
    assert.ok(matches.length, `impossible de compter les images de ${file}`);
    return Number(matches[matches.length - 1][1]);
  });
}

function grabFrame(file, at) {
  return runFfmpegCapture([
    "-ss", String(at), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]);
}

function meanAbsDiff(a, b) {
  assert.equal(a.length, b.length, "tailles d'image differentes");
  let total = 0;
  for (let index = 0; index < a.length; index += 1) total += Math.abs(a[index] - b[index]);
  return total / a.length;
}

function runFfmpeg(args) {
  return runFfmpegCapture(args, true).then(() => undefined);
}

function runFfmpegCapture(args, wantStderr = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-v", "error", "-stats", "-y", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg ${code}: ${stderr.slice(-1500)}`));
      return resolve(wantStderr ? stderr : Buffer.concat(chunks));
    });
  });
}

function resolveFfmpeg() {
  if (process.env.VIBECUT_FFMPEG_PATH) return process.env.VIBECUT_FFMPEG_PATH;
  try {
    return require("ffmpeg-static");
  } catch {
    return null;
  }
}
