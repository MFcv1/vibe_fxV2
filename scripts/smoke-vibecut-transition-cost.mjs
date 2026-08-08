/*
 * COUT DE RENDU DES TRANSITIONS, mesure et PLAFONNE.
 *
 * Ce test existe pour une raison precise, decidee AVANT d'ecrire le lot B3b :
 * empecher de retomber par glissement dans la voie `xfade=transition=custom:expr=`.
 * Elle rend tout, tres simplement, et coute 8,6 s pour une transition de 0,6 s en
 * 1080p contre 0,2 s en natif - un facteur ~40 inherent a l'evaluateur
 * d'expressions de FFmpeg. Sur un service facture a la seconde, un montage a six
 * transitions y gagnerait deux a quatre minutes d'export.
 *
 * Le plafond, decide a l'avance : 1,2 s pour une transition de 0,6 s en 1080p,
 * soit SIX FOIS le natif. Au-dela, l'effet est simplifie ou refuse - il n'est pas
 * question de relever le plafond pour faire passer un effet.
 *
 * -------------------------------------------------------------------------
 * LE PLAFOND EST EN MULTIPLES DU NATIF, PLUS EN SECONDES (2026-08-04).
 *
 * Ce n'est pas un assouplissement, c'est la correction d'une INCOHERENCE que ce
 * fichier portait depuis l'origine : il mesure sa reference a chaque execution
 * en disant lui-meme « c'est le RAPPORT qui a un sens » (voir plus bas), puis
 * il assertait en SECONDES ABSOLUES. Les deux ne pouvaient pas rester d'accord.
 *
 * Ce qui l'a revele : `rgb-split` mesure 1,23 s le 2026-08-04 contre un plafond
 * de 1,2 s, alors que son rapport au natif TOMBE de x3,5 (mesure du 2026-08-03)
 * a x2,9 - donc l'effet est devenu moins cher, pas plus. Ce qui avait bouge,
 * c'est la machine : la reference native valait 0,23 s quand le plafond a ete
 * pose, elle vaut 0,43 s ce jour-la, et elle a varie de 0,16 a 0,45 s d'une
 * execution a l'autre dans la MEME session. Un plafond en secondes mesure donc
 * l'etat thermique de la machine autant que le cout de l'effet.
 *
 * SIX, ET PAS PLUS, parce que six est exactement ce que le plafond d'origine
 * VOULAIT DIRE : 1,2 s pour un natif de 0,2 s. Le chiffre ne change pas,
 * seulement l'unite. La voie par expression coute ~40 fois le natif : elle
 * reste refusee avec la meme marge qu'avant. Pire rapport jamais mesure sur les
 * quinze effets : x3,6.
 * -------------------------------------------------------------------------
 *
 * Le graphe mesure est celui que LE RENDERER emet (`buildTransitionSubgraph`),
 * pas une reecriture : mesurer autre chose que la production ne prouverait rien.
 *
 * VIBECUT_COST_REPORT_ONLY=1 mesure sans faire echouer, pour regler un effet.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import {
  SERVER_TRANSITION_EFFECTS,
  buildTransitionSubgraph,
} from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const ffmpeg = resolveFfmpeg();
assert.ok(ffmpeg, "FFmpeg introuvable (ffmpeg-static ou VIBECUT_FFMPEG_PATH)");

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const CLIP_DURATION = 2;
const TRANSITION_DURATION = 0.6;
/*
 * Le plafond REEL. `CEILING_SECONDS` n'est garde que pour dire a quoi six fois
 * le natif correspondait sur la machine de reference du 2026-08-03.
 */
const CEILING_RATIO = 6;
const CEILING_SECONDS = 1.2;
const reportOnly = process.env.VIBECUT_COST_REPORT_ONLY === "1";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-transition-cost-"));

try {
  const clipA = path.join(tempDir, "a.mp4");
  const clipB = path.join(tempDir, "b.mp4");
  await Promise.all([makeClip(clipA, "testsrc2"), makeClip(clipB, "smptebars")]);

  /*
   * Reference : la meme jointure sans aucun effet. On la mesure a chaque
   * execution plutot que de citer 0,2 s de memoire - une machine plus lente
   * decalerait tout, et c'est le RAPPORT qui a un sens.
   */
  const baseline = await measure("crossfade", clipA, clipB);
  const rows = [{ id: "crossfade (reference native)", seconds: baseline, ratio: 1 }];

  for (const id of Object.keys(SERVER_TRANSITION_EFFECTS)) {
    const seconds = await measure(id, clipA, clipB);
    rows.push({ id, seconds, ratio: seconds / baseline });
  }

  rows.forEach(({ id, seconds, ratio }) => {
    console.log(`${id.padEnd(30)} ${seconds.toFixed(2)} s   x${ratio.toFixed(1)} du natif`);
  });

  if (!reportOnly) {
    rows.slice(1).forEach(({ id, seconds, ratio }) => {
      assert.ok(
        ratio <= CEILING_RATIO,
        `${id}: x${ratio.toFixed(1)} du natif (${seconds.toFixed(2)} s contre ${baseline.toFixed(2)} s) `
        + `pour une transition de ${TRANSITION_DURATION} s en ${WIDTH}x${HEIGHT}, plafond x${CEILING_RATIO}. `
        + "L'effet doit etre simplifie ou refuse - relever le plafond reviendrait a rouvrir la voie "
        + "par expression, qui coute ~40 fois le natif.",
      );
    });
  }

  console.log(
    `smoke-vibecut-transition-cost: ok (${rows.length - 1} effets sous x${CEILING_RATIO} du natif, `
    + `reference ${baseline.toFixed(2)} s)`,
  );
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

function measure(type, clipA, clipB) {
  const subgraph = buildTransitionSubgraph({
    type,
    index: 1,
    duration: TRANSITION_DURATION,
    durationA: CLIP_DURATION,
    durationB: CLIP_DURATION,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    labelA: "[a]",
    labelB: "[b]",
    labelOut: "[x]",
  });
  const graph = [
    `[0:v]fps=${FPS},format=yuv420p,setpts=PTS-STARTPTS[a]`,
    `[1:v]fps=${FPS},format=yuv420p,setpts=PTS-STARTPTS[b]`,
    ...subgraph,
  ].join(";");
  const started = process.hrtime.bigint();
  return run([
    "-i", clipA,
    "-i", clipB,
    "-filter_complex", graph,
    "-map", "[x]",
    "-f", "null", "-",
  ]).then(() => Number(process.hrtime.bigint() - started) / 1e9);
}

function makeClip(file, source) {
  return run([
    "-f", "lavfi",
    "-i", `${source}=s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${CLIP_DURATION}`,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p",
    file,
  ]);
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-1200)}`))));
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
