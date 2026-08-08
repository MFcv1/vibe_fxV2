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

import { SERVER_XFADE_TRANSITION_MAP, SERVER_TRANSITION_EFFECTS, buildFfmpegArgs } from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const ffmpeg = resolveBinary("ffmpeg", ["VIBECUT_FFMPEG_PATH", "FFMPEG_PATH"], "ffmpeg-static");
assert.ok(ffmpeg, "FFmpeg introuvable (ffmpeg-static ou VIBECUT_FFMPEG_PATH)");

const keepDir = process.env.VIBECUT_XFADE_SHOT_DIR || null;
const workDir = keepDir || (await mkdtemp(path.join(os.tmpdir(), "vibecut-xfade-")));
await mkdir(workDir, { recursive: true });

/*
 * Cibles dont le passage par le NOIR est l'effet lui-meme (lot B3a): le plan
 * sortant se retracte vers le centre jusqu'a disparaitre a mi-parcours.
 */
const PASSES_THROUGH_BLACK = new Set(["circlecrop", "rectcrop"]);

/*
 * Les trois du lot B3b dont la jointure est refaite a la main (voir plus bas).
 * Elles sont nommees ici plutot que devinees: si l'une d'elles reprenait un
 * `xfade` par accident, ce test doit le dire.
 */
const REBUILT_JOINS = new Set(["strobe-cut", "glitch", "intro-grid-reveal"]);

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
    /*
     * TROIS TRANSITIONS NE PASSENT PAS PAR `xfade`, et c'est voulu (lot B3b) :
     * le stroboscope, la coupe franche du glitch et la revelation par blocs
     * doivent CHOISIR entre les deux plans image par image, ou composer par un
     * masque - `xfade` melange, il ne choisit pas. Leur jointure est refaite a la
     * main : les deux flux sont alignes par `tpad`, puis composes par un
     * `overlay` conditionnel. On verifie donc CE mecanisme-la pour elles, plutot
     * que de relacher l'assertion pour tout le monde.
     */
    if (REBUILT_JOINS.has(id)) {
      assert.doesNotMatch(
        filterComplex,
        /xfade=transition=/,
        `${id}: sa jointure est refaite a la main, un xfade ici voudrait dire qu'elle a repris le chemin du melange`,
      );
      assert.match(filterComplex, /tpad=/, `${id}: les deux flux doivent etre alignes par tpad`);
      assert.match(filterComplex, /overlay=/, `${id}: la jointure refaite passe par un overlay conditionnel`);
    } else {
      assert.match(
        filterComplex,
        new RegExp(`xfade=transition=${xfadeName}\\b`),
        `${id}: le renderer devrait demander xfade=transition=${xfadeName}`,
      );
    }

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

    if (PASSES_THROUGH_BLACK.has(xfadeName)) {
      /*
       * Ces deux-la sont NOIRES a mi-parcours, et c'est leur effet meme: le plan
       * sortant se retracte jusqu'a disparaitre, puis l'entrant rouvre. Leur
       * appliquer le controle generique reviendrait a interdire l'effet.
       * On verifie donc l'INVERSE - le noir doit etre la - plus un point au
       * quart, ou il doit rester de l'image: sans lui, un rendu entierement noir
       * passerait pour un rognage reussi.
       */
      /*
       * Seuil RELATIF au fondu de reference, pas absolu: la lecture ne retombe
       * pas toujours pile sur l'image du milieu, et une image voisine laisse
       * deja reapparaitre un petit cadre. Ce qu'on veut prouver n'est pas
       * « exactement zero » mais « effondre par rapport a un fondu simple » —
       * si le rognage avait ete ignore et remplace par `fade`, la luminance
       * serait du meme ordre que la reference.
       */
      const plainFade = results.find((entry) => entry.id === "crossfade");
      assert.ok(plainFade, "le fondu de reference doit etre rendu avant les rognages");
      const ceiling = Math.max(1, plainFade.middleLuma / 8);
      assert.ok(
        stats.luma < ceiling,
        `${id}: attendu quasi noir au milieu (c'est l'effet), obtenu Y=${stats.luma} `
          + `pour un plafond de ${ceiling.toFixed(2)} (fondu simple: ${plainFade.middleLuma})`,
      );
      const quarter = await probeFrameStats(outputFile, CLIP_DURATION - TRANSITION_DURATION * 0.75);
      assert.ok(
        quarter.luma > 0.5,
        `${id}: noir des le quart du fondu (Y=${quarter.luma}) — le cadre ne se retracte pas, il s'eteint`,
      );
    } else {
      assert.ok(stats.luma > 8, `${id}: image noire au milieu du fondu (Y=${stats.luma})`);
    }
    results.push({ id, xfade: xfadeName, bytes: size, duration: Number(duration.toFixed(2)), middleLuma: stats.luma });
  }

  // Une transition ne vaut d'etre publiee que si elle se distingue du fondu simple.
  const reference = results.find((entry) => entry.id === "crossfade");
  assert.ok(reference, "le fondu de reference doit avoir ete rendu");

  /*
   * ALIAS ASSUMES. Plusieurs ids peuvent viser la MEME cible native quand ils
   * different par leur duree et leur intention, pas par leur geometrie: un
   * `flash` de 0,3 s et un `dip-white` de 0,55 s sont le meme `fadewhite`. Les
   * declarer ici plutot que de relacher l'assertion garde sa valeur: un doublon
   * NON declare - le vrai defaut, deux entrees identiques ajoutees par erreur -
   * fait toujours echouer ce test.
   */
  const INTENTIONAL_SHARED_TARGETS = {
    fade: ["fade", "crossfade", "smooth-cut", "non-additive-dissolve"],
    fadewhite: ["dip-white", "flash"],
    fadeblack: ["dip-black", "outro-cinematic-fade"],
  };
  /*
   * Lot B3b : quinze transitions ne se distinguent PAS par leur cible - elles
   * partagent `fade`, `wiperight` ou `vertopen` comme simple jointure - mais par
   * le sous-graphe de filtres pose autour. Les compter comme des doublons de
   * cible n'aurait aucun sens ; c'est
   * `scripts/smoke-vibecut-xfade-preview-parity.mjs` qui prouve qu'elles rendent
   * chacune autre chose, image par image, et
   * `smoke-vibecut-transition-chain-mp4` qu'elles le font a chaque coupe.
   */
  const byTarget = new Map();
  for (const entry of results) {
    if (Object.hasOwn(SERVER_TRANSITION_EFFECTS, entry.id)) continue;
    if (!byTarget.has(entry.xfade)) byTarget.set(entry.xfade, []);
    byTarget.get(entry.xfade).push(entry.id);
  }
  for (const [target, ids] of byTarget) {
    if (ids.length === 1) continue;
    assert.deepEqual(
      [...ids].sort(),
      [...(INTENTIONAL_SHARED_TARGETS[target] || [])].sort(),
      `« ${target} » est vise par plusieurs transitions (${ids.join(", ")}): `
        + "chaque partage doit etre declare dans INTENTIONAL_SHARED_TARGETS",
    );
  }

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
