/*
 * PARITE DU MOUVEMENT PHOTO, APERCU <-> EXPORT, mesuree sur un vrai MP4.
 *
 * Gate du lot L3 (2026-07-30). Deux ecarts de parite ont deja vecu dans ce
 * projet parce que les badges de capacite disaient le contraire de ce que le
 * renderer faisait. Une capacite declaree ne prouve rien; deux images comparees,
 * si. Ce test compare donc, pour plusieurs mouvements et plusieurs intensites :
 *
 *   - ce que l'EXPORT produit : un MP4 rendu par la commande que le renderer de
 *     production construit lui-meme (`buildFfmpegArgs`), puis decode. Une
 *     interpolation lineaire ou une intensite ignoree cote serveur y seraient
 *     attrapees ;
 *   - ce que l'APERCU montre : `mediaModel.applyImageMotionTransform`, chargee
 *     telle quelle dans Chromium — c'est la fonction que `VideoEngine` appelle.
 *
 * Trois assertions, pas une :
 *   1. PARITE       - les deux images coincident, aux seuils justifies ci-dessous.
 *   2. EFFET REEL   - baisser l'intensite change VRAIMENT l'export. Sans cela,
 *                     deux cotes qui ignorent tous les deux l'intensite seraient
 *                     « en parite » et le test ne vaudrait rien.
 *   3. SENTINELLE   - un apercu volontairement remis en interpolation LINEAIRE
 *                     doit sortir des seuils. Si cette assertion cesse d'echouer,
 *                     c'est le test qui est devenu aveugle, pas le code qui est
 *                     devenu bon.
 *
 * VIBECUT_MOTION_SHOT_DIR=<dossier> conserve MP4 et paires d'images comparees.
 * VIBECUT_MOTION_REPORT_ONLY=1 mesure tout sans echouer (reglage de seuils).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

import { buildFfmpegArgs } from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const ffmpeg = resolveFfmpeg();
assert.ok(ffmpeg, "FFmpeg introuvable (ffmpeg-static ou VIBECUT_FFMPEG_PATH)");

const SIZE = 320;
const FPS = 30;
const DURATION = 2;
const FRAME_COUNT = DURATION * FPS;
// Debut, montee, milieu, fin de course. Le milieu est le point ou le smoothstep
// s'ecarte le plus d'une droite: c'est la que la correction de courbe se voit.
const SAMPLE_FRAMES = [3, 12, 30, 48, 59];

const shotDir = process.env.VIBECUT_MOTION_SHOT_DIR || null;
const reportOnly = process.env.VIBECUT_MOTION_REPORT_ONLY === "1";

/*
 * Seuils, sur 0-255.
 *
 * `meanFrame` (couleur moyenne de l'image) reste tres bas partout : les deux
 * cotes montrent la meme portion de la meme photo au meme instant.
 * `meanPixel` est plus tolerant, pour trois raisons structurelles et bornees :
 *   - `zoompan` positionne sa fenetre sur des pixels ENTIERS, le canvas non ;
 *   - la taille de la fenetre est elle aussi entiere, donc le zoom effectif
 *     s'ecarte du zoom demande de moins de 0,3 % ;
 *   - le reechantillonnage bilineaire de FFmpeg n'est pas celui de Chromium, et
 *     le motif de test est volontairement contraste pour ne rien pardonner
 *     a la GEOMETRIE.
 * Un decalage d'un pixel sur ce motif coute deja ~10 de meanPixel : le seuil
 * detecte donc un vrai deplacement, pas un arrondi.
 *
 * Mesure du 2026-07-30 apres correction : le pire cas observe est 7,3. Les
 * seuils sont poses juste au-dessus, avec la marge d'une machine a l'autre —
 * pas au niveau de ce que le code produisait avant.
 */
const TOLERANCE = { meanFrame: 4, meanPixel: 12 };

/*
 * Au moins deux mouvements, et l'intensite prise a ses trois crans nommes.
 *
 * Le dernier cas est une course AMPLIFIEE (course laterale de 0,56 au lieu de
 * 0,11), et il n'est pas decoratif: aux amplitudes des presets, l'ecart entre
 * une progression lissee et une progression lineaire vaut environ 2 pixels,
 * soit MOINS que le bruit de reechantillonnage. Autrement dit, a ces
 * amplitudes-la, aucun seuil sur l'image entiere ne peut distinguer les deux
 * courbes. Le cas amplifie donne au test le levier qui lui manque: c'est
 * exactement le meme chemin de code, avec cinq fois la course.
 *
 * Sa fenetre reste dans le cadre. C'est une contrainte reelle, decouverte en
 * ecrivant ce test: `zoompan` BORNE sa fenetre a l'image, le canvas non. Un
 * mouvement qui sort du cadre diverge donc franchement entre apercu et export.
 * La condition a tenir est |x| <= (zoom - 1) / 2, et les six presets livres la
 * respectent (le plus tendu est `drift-up`: 0,045 pour une limite de 0,05).
 */
const CASES = [
  { motion: "zoom-in", intensity: 1, label: "zoom-in · Marque 100 %" },
  { motion: "zoom-in", intensity: 0.4, label: "zoom-in · Discret 40 %" },
  { motion: "zoom-out", intensity: 0.7, label: "zoom-out · Naturel 70 %" },
  { motion: "pan-right", intensity: 1, label: "pan-right · Marque 100 %" },
  { motion: "pan-right", intensity: 0.4, label: "pan-right · Discret 40 %" },
  { motion: "drift-up", intensity: 0.7, label: "drift-up · Naturel 70 %" },
  {
    motion: "pan-right",
    intensity: 1,
    start: { scale: 1.6, x: -0.28, y: 0 },
    end: { scale: 1.6, x: 0.28, y: 0 },
    label: "course amplifiee (levier de la sentinelle)",
  },
];
const SENTINEL_CASE = CASES[CASES.length - 1];

const mediaModelSource = await readFile(
  path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "model", "mediaModel.js"),
  "utf8",
);
assert.ok(
  !/^import\s/m.test(mediaModelSource),
  "mediaModel.js doit rester sans import pour etre charge tel quel dans le navigateur",
);
assert.match(
  mediaModelSource,
  /export function applyImageMotionTransform/,
  "l'apercu doit exposer applyImageMotionTransform: c'est le code mesure ici",
);

const workDir = shotDir || (await mkdtemp(path.join(os.tmpdir(), "vibecut-motion-")));
await mkdir(workDir, { recursive: true });

const browser = await chromium.launch();
try {
  // Motif contraste et sans couleur: le yuv420p de l'export ne peut donc pas
  // introduire d'ecart de chrominance, et la moindre erreur de cadrage se voit.
  const sourceImage = path.join(workDir, "source.png");
  await runFfmpeg([
    "-f", "lavfi", "-i", `testsrc2=s=${SIZE}x${SIZE}:d=1`,
    "-vf", "hue=s=0", "-frames:v", "1", sourceImage,
  ]);
  const sourcePng = await readFile(sourceImage);

  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({
    type: "module",
    content: `${mediaModelSource}\nwindow.__vibecutMotion = applyImageMotionTransform;\n`,
  });
  await page.waitForFunction(() => Boolean(window.__vibecutMotion));
  await page.evaluate(
    async ([data, size]) => {
      window.__source = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = data;
      });
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      document.body.appendChild(canvas);
      window.__ctx = canvas.getContext("2d", { willReadFrequently: true });
    },
    [`data:image/png;base64,${sourcePng.toString("base64")}`, SIZE],
  );

  const report = [];
  const exportedByCase = new Map();

  for (const testCase of CASES) {
    const key = caseKey(testCase);
    const outputFile = path.join(workDir, `${key}.mp4`);
    const args = buildFfmpegArgs({
      manifest: makeManifest(testCase),
      videoInputs: [{ clip: makeClip(testCase), file: sourceImage }],
      audioInputs: [],
      outputFile,
      warnings: [],
    });

    /*
     * Le renderer doit demander la COURBE et l'INTENSITE, pas seulement un
     * zoompan quelconque. On lit sa commande avant de la lancer.
     */
    const filterComplex = readFilterComplex(args);
    assert.match(filterComplex, /zoompan=/, `${testCase.label}: aucun zoompan demande`);
    assert.match(
      filterComplex,
      /\(3-2\*\(min\(on\//,
      `${testCase.label}: la commande doit porter le smoothstep, pas une interpolation lineaire`,
    );
    if (testCase.intensity < 1) {
      assert.ok(
        filterComplex.includes(`${testCase.intensity}*`),
        `${testCase.label}: l'intensite doit apparaitre dans l'expression zoompan`,
      );
    }

    await runFfmpeg(args);
    const exported = await extractFrames(outputFile);
    exportedByCase.set(key, exported);

    for (const [index, frame] of SAMPLE_FRAMES.entries()) {
      // Instant reel de l'image n dans la timeline: c'est ce que l'apercu
      // afficherait au meme moment de la lecture.
      const progress = frame / FPS / DURATION;
      const actual = await renderPreview(page, testCase, progress, "ease-in-out");
      const measure = compare(exported[index], actual);
      report.push({ case: testCase.label, frame, progress: round3(progress), ...measure });

      if (shotDir) {
        await writeFile(path.join(shotDir, `${key}-f${frame}-export.png`), await rgbToPng(exported[index]));
        await writeFile(path.join(shotDir, `${key}-f${frame}-apercu.png`), await rgbToPng(actual));
      }

      if (reportOnly) {
        console.log(`${testCase.label.padEnd(26)} n=${String(frame).padStart(2)}  meanFrame=${measure.meanFrame.toFixed(1).padStart(5)}  meanPixel=${measure.meanPixel.toFixed(1).padStart(5)}`);
        continue;
      }
      assert.ok(
        measure.meanFrame <= TOLERANCE.meanFrame,
        `${testCase.label} @ image ${frame}: cadrage global hors tolerance (${measure.meanFrame.toFixed(1)} > ${TOLERANCE.meanFrame})`,
      );
      assert.ok(
        measure.meanPixel <= TOLERANCE.meanPixel,
        `${testCase.label} @ image ${frame}: geometrie hors tolerance (${measure.meanPixel.toFixed(1)} > ${TOLERANCE.meanPixel})`,
      );
    }
  }

  /*
   * 2. EFFET REEL. Deux cotes qui ignoreraient tous les deux l'intensite
   *    seraient parfaitement « en parite ». On exige donc que l'export a 40 %
   *    soit visiblement different de l'export a 100 %, au milieu de la course.
   */
  for (const motion of ["zoom-in", "pan-right"]) {
    const full = exportedByCase.get(`${motion}-100`);
    const discreet = exportedByCase.get(`${motion}-40`);
    assert.ok(full && discreet, `${motion}: les deux intensites doivent avoir ete rendues`);
    // En fin de course: c'est la que 40 % et 100 % sont le plus eloignes.
    const last = SAMPLE_FRAMES.length - 1;
    const gap = compare(full[last], discreet[last]).meanPixel;
    assert.ok(
      gap > 12,
      `${motion}: l'intensite ne change pas l'export (ecart ${gap.toFixed(1)} en fin de course)`,
    );
    report.push({ case: `${motion}: 100 % vs 40 %`, frame: SAMPLE_FRAMES[last], intensityGap: round3(gap) });
  }

  /*
   * 3. SENTINELLE. Le defaut corrige par le lot L3 etait exactement celui-la:
   *    une progression lineaire cote export contre un smoothstep cote apercu.
   *    On rejoue l'apercu en lineaire et on exige que le test le REFUSE.
   *    L'image 12 tombe a p = 0,2, ou le smoothstep s'ecarte le plus d'une
   *    droite (0,096 de progression).
   */
  const sentinelFrame = SAMPLE_FRAMES.indexOf(12);
  const linear = await renderPreview(page, SENTINEL_CASE, SAMPLE_FRAMES[sentinelFrame] / FPS / DURATION, "linear");
  const sentinel = compare(exportedByCase.get(caseKey(SENTINEL_CASE))[sentinelFrame], linear);
  assert.ok(
    sentinel.meanPixel > TOLERANCE.meanPixel,
    `sentinelle aveugle: un apercu LINEAIRE passe les seuils (${sentinel.meanPixel.toFixed(1)} <= ${TOLERANCE.meanPixel}). `
    + "Le test ne prouve plus rien tant que ce n'est pas corrige.",
  );
  report.push({ case: "sentinelle apercu lineaire", frame: SAMPLE_FRAMES[sentinelFrame], rejectedAt: round3(sentinel.meanPixel) });

  const worst = report
    .filter((entry) => typeof entry.meanPixel === "number")
    .sort((a, b) => b.meanPixel - a.meanPixel)
    .slice(0, 5);
  console.log(JSON.stringify({ samples: report.length, worstPixelGaps: worst, sentinelRejectedAt: round3(sentinel.meanPixel) }, null, 2));
  if (shotDir) console.log(`MP4 et images conserves dans ${workDir}`);
  console.log(`smoke-vibecut-motion-preview-parity: ok (${CASES.length} cas x ${SAMPLE_FRAMES.length} images)`);
} finally {
  await browser.close();
  if (!shotDir) await rm(workDir, { recursive: true, force: true });
}

/*
 * L'apercu, rendu par le code de production: `applyImageMotionTransform` pose la
 * transformation, le dessin qui suit est le `cover` de `VideoEngine` reduit a son
 * cas trivial (source carree, cadre carre), ou il vaut exactement ce drawImage.
 */
function renderPreview(page, testCase, progress, easing) {
  return page.evaluate(
    ([motion, t, size, easingMode]) => {
      const ctx = window.__ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = "none";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, size, size);
      ctx.clip();
      window.__vibecutMotion(ctx, { ...motion, easing: easingMode }, t, size, size);
      ctx.drawImage(window.__source, 0, 0, size, size);
      ctx.restore();
      const data = ctx.getImageData(0, 0, size, size).data;
      const rgb = new Array((data.length / 4) * 3);
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        rgb[j] = data[i];
        rgb[j + 1] = data[i + 1];
        rgb[j + 2] = data[i + 2];
      }
      return rgb;
    },
    [motionOf(testCase), progress, SIZE, easing],
  ).then((rgb) => Buffer.from(rgb));
}

/* Le meme objet `motion` est envoye au manifeste et a l'apercu: c'est le point
 * de depart commun dont depend toute la parite. */
function motionOf(testCase) {
  const motion = { preset: testCase.motion, easing: "ease-in-out", intensity: testCase.intensity };
  if (testCase.start) motion.start = testCase.start;
  if (testCase.end) motion.end = testCase.end;
  return motion;
}

function caseKey(testCase) {
  const amplified = testCase.start || testCase.end ? "-amplifie" : "";
  return `${testCase.motion}-${Math.round(testCase.intensity * 100)}${amplified}`;
}

function compare(expected, actual) {
  assert.equal(expected.length, actual.length, "tailles d'image differentes");
  let totalDiff = 0;
  const sumExpected = [0, 0, 0];
  const sumActual = [0, 0, 0];
  for (let i = 0; i < expected.length; i += 1) {
    totalDiff += Math.abs(expected[i] - actual[i]);
    sumExpected[i % 3] += expected[i];
    sumActual[i % 3] += actual[i];
  }
  const pixels = expected.length / 3;
  const meanFrame = Math.max(
    ...[0, 1, 2].map((channel) => Math.abs(sumExpected[channel] - sumActual[channel]) / pixels),
  );
  return { meanPixel: totalDiff / expected.length, meanFrame };
}

function extractFrames(file) {
  const selects = SAMPLE_FRAMES.map((frame) => `eq(n\\,${frame})`).join("+");
  return runFfmpegRaw([
    "-i", file,
    "-vf", `select='${selects}'`,
    "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]).then((buffer) => {
    const frameBytes = SIZE * SIZE * 3;
    assert.equal(
      buffer.length,
      frameBytes * SAMPLE_FRAMES.length,
      `${buffer.length / frameBytes} images extraites, ${SAMPLE_FRAMES.length} attendues`,
    );
    return SAMPLE_FRAMES.map((_, index) => buffer.subarray(index * frameBytes, (index + 1) * frameBytes));
  });
}

function rgbToPng(rgb) {
  return runFfmpegRaw([
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${SIZE}x${SIZE}`, "-i", "-",
    "-frames:v", "1", "-f", "image2", "-c:v", "png", "-",
  ], rgb);
}

function makeManifest(testCase) {
  return {
    version: 1,
    project: { id: "motion-local", name: "motion local", duration: DURATION, preset: "square" },
    render: {
      width: SIZE,
      height: SIZE,
      fps: FPS,
      format: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      // Quasi sans perte: on mesure la geometrie, pas le codec.
      crf: 12,
      targetBitrate: 8_000_000,
      audioBitrate: 128_000,
      qualityMode: "preview",
      fitMode: "cover",
    },
    clips: [makeClip(testCase)],
    transitions: [],
    textOverlays: [],
    audioTracks: [],
  };
}

function makeClip(testCase) {
  return {
    id: "photo-a",
    name: "photo-a",
    mediaType: "image",
    sourceStoragePath: "sources/photo-a.png",
    duration: DURATION,
    trimStart: 0,
    trimEnd: DURATION,
    speed: 1,
    volume: 0,
    fitMode: "cover",
    filters: {},
    motion: motionOf(testCase),
  };
}

function readFilterComplex(args) {
  const index = args.indexOf("-filter_complex");
  assert.ok(index >= 0, "la commande du renderer doit contenir un -filter_complex");
  return args[index + 1];
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function runFfmpeg(args) {
  return runFfmpegRaw(args).then(() => undefined);
}

function runFfmpegRaw(args, stdin = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
      stdio: [stdin ? "pipe" : "ignore", "pipe", "pipe"],
    });
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => (code === 0
      ? resolve(Buffer.concat(chunks))
      : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-1200)}`))));
    if (stdin) child.stdin.end(Buffer.from(stdin));
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
