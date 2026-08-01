/*
 * PARITE APERCU <-> EXPORT, mesuree.
 *
 * Pour chaque transition minutee declaree exportable, on compare image par image :
 *   - ce que FFmpeg produit avec le filtre `xfade` (l'export reel) ;
 *   - ce que `xfadeTransitions.js` dessine sur un canvas Chromium (l'apercu).
 *
 * C'est le seul test qui puisse attraper le defaut qui a vecu jusqu'au 2026-07-30 :
 * les badges de capacite disaient « rendu par le serveur » alors que le renderer
 * ecrivait `xfade=transition=fade` en dur. Une declaration de capacite ne prouve
 * rien ; deux images comparees, si.
 *
 * Deux mesures par point de comparaison, sur 0-255 :
 *   - `meanFrame`  : ecart entre les couleurs MOYENNES des deux images. Il dit si
 *                    le melange global (poids de A et de B) est le bon.
 *   - `meanPixel`  : ecart moyen pixel a pixel. Il dit si la GEOMETRIE est la bonne.
 * Le second est volontairement plus tolerant : le bord adouci d'un balayage ou le
 * grain d'une dissolution ne peuvent pas coincider au pixel pres entre un shader
 * FFmpeg et un canvas 2D. Les seuils par transition sont justifies ci-dessous.
 *
 * VIBECUT_XFADE_SHOT_DIR=<dossier> ecrit les paires d'images comparees en PNG.
 * VIBECUT_XFADE_REPORT_ONLY=1 mesure tout sans echouer: sert a regler une courbe
 * ou a constater l'ampleur d'un ecart avant de decider d'un seuil.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const ffmpeg = resolveFfmpeg();
assert.ok(ffmpeg, "FFmpeg introuvable (ffmpeg-static ou VIBECUT_FFMPEG_PATH)");

const SIZE = 320;
const FPS = 50;
const SAMPLES = [0.2, 0.4, 0.6, 0.8];
const shotDir = process.env.VIBECUT_XFADE_SHOT_DIR || null;
const reportOnly = process.env.VIBECUT_XFADE_REPORT_ONLY === "1";

/*
 * Seuils. « fade » et les glissements sont des operations exactes des deux cotes :
 * on les tient serres. Les bords adoucis et les effets a noyau (flou, grain,
 * blocs) ont un ecart structurel assume, borne mais non nul.
 */
const TOLERANCES = {
  // Exactes des deux cotes: melange lineaire et translations entieres.
  fade: { meanFrame: 4, meanPixel: 3, why: "melange lineaire, identique des deux cotes" },
  fadeblack: { meanFrame: 3, meanPixel: 2, why: "courbes de melange RELEVEES sur FFmpeg, pas approchees" },
  fadewhite: { meanFrame: 3, meanPixel: 2, why: "memes courbes relevees que fadeblack" },
  wipeleft: { meanFrame: 4, meanPixel: 4, why: "bord net, au pixel d'arrondi pres" },
  slideup: { meanFrame: 4, meanPixel: 12, why: "translation entiere; l'arrondi decale la grille d'un pixel" },
  slidedown: { meanFrame: 4, meanPixel: 12, why: "idem slideup" },

  // Bords adoucis: la largeur du degrade est relevee a l'oeil sur les images de
  // reference, elle ne peut pas coincider avec le shader au pixel pres.
  smoothleft: { meanFrame: 14, meanPixel: 14, why: "largeur du degre de balayage approchee" },
  smoothright: { meanFrame: 14, meanPixel: 14, why: "idem smoothleft" },
  vertopen: { meanFrame: 13, meanPixel: 14, why: "ouverture centrale a bord adouci" },
  circleopen: { meanFrame: 20, meanPixel: 22, why: "iris a bord tres etale, rayon en diagonale approche" },
  circleclose: { meanFrame: 20, meanPixel: 22, why: "idem circleopen" },

  /*
   * Ecarts structurels assumes, chacun pour une raison identifiee — ils sont
   * bornes ici pour qu'une DERIVE soit detectee, pas pour pretendre a l'exactitude.
   */
  hblur: {
    meanFrame: 5,
    meanPixel: 30,
    why: "melange exact (meanFrame bas) mais noyau de flou canvas != noyau FFmpeg",
  },
  pixelize: {
    meanFrame: 30,
    meanPixel: 50,
    why: "taille et alignement des blocs approches; la quantification decale aussi la moyenne",
  },
  dissolve: {
    meanFrame: 4,
    meanPixel: 60,
    why: "grain tire au hasard par pixel cote FFmpeg, non reproductible: seul le melange moyen (meanFrame) est comparable, et il l'est de pres",
  },
  fadegrays: {
    meanFrame: 24,
    meanPixel: 55,
    why: "le grayscale() du navigateur utilise les coefficients Rec.709, FFmpeg le Rec.601: sur un rouge sature l'export est plus clair que l'apercu. Ecart de teinte, pas de geometrie ni de rythme",
  },
};

const manifestSource = await readFile(appPath("export", "exportManifest.js"), "utf8");
const xfadeSource = await readFile(appPath("engine", "xfadeTransitions.js"), "utf8");
const transitionMap = extractTransitionMap(manifestSource);
const targets = [...new Set(Object.values(transitionMap))];

if (shotDir) await mkdir(shotDir, { recursive: true });

// Deux plans francs et structures: les erreurs de geometrie ne peuvent pas se cacher.
const sourceA = `color=c=0x902020:s=${SIZE}x${SIZE}:r=${FPS}:d=2,drawgrid=w=40:h=40:t=3:c=0xffffff@0.85`;
const sourceB = `color=c=0x2030c0:s=${SIZE}x${SIZE}:r=${FPS}:d=2,drawgrid=w=64:h=64:t=5:c=0xffe000@0.9`;
const [pngA, pngB] = await Promise.all([renderStillPng(sourceA), renderStillPng(sourceB)]);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({ type: "module", content: buildBrowserModule(manifestSource, xfadeSource) });
  await page.waitForFunction(() => Boolean(window.__vibecutXfade));
  await page.evaluate(
    async ([a, b, size]) => {
      const load = (data) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = data;
      });
      window.__sources = { a: await load(a), b: await load(b) };
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      document.body.appendChild(canvas);
      window.__canvas = canvas;
      window.__ctx = canvas.getContext("2d", { willReadFrequently: true });
    },
    [`data:image/png;base64,${pngA.toString("base64")}`, `data:image/png;base64,${pngB.toString("base64")}`, SIZE],
  );

  const report = [];
  for (const target of targets) {
    const id = Object.keys(transitionMap).find((key) => transitionMap[key] === target);
    const expectedFrames = await renderXfadeFrames(target);
    const tolerance = TOLERANCES[target];
    assert.ok(tolerance, `aucun seuil declare pour la transition ${target}`);

    for (const [index, progress] of SAMPLES.entries()) {
      const actual = Buffer.from(await page.evaluate(
        ([transitionId, t, size]) => {
          const ctx = window.__ctx;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
          ctx.filter = "none";
          ctx.clearRect(0, 0, size, size);
          window.__vibecutXfade(ctx, window.__sources.a, window.__sources.b, t, transitionId, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          const rgb = new Array((data.length / 4) * 3);
          for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
            rgb[j] = data[i];
            rgb[j + 1] = data[i + 1];
            rgb[j + 2] = data[i + 2];
          }
          return rgb;
        },
        [id, progress, SIZE],
      ));

      const expected = expectedFrames[index];
      const measure = compare(expected, actual);
      report.push({ id, xfade: target, progress, ...measure });

      if (shotDir) {
        await writeFile(path.join(shotDir, `${target}-${progress}-export.png`), await rgbToPng(expected));
        await writeFile(path.join(shotDir, `${target}-${progress}-apercu.png`), await rgbToPng(actual));
      }

      if (reportOnly) {
        console.log(`${target.padEnd(12)} p=${progress}  meanFrame=${measure.meanFrame.toFixed(1).padStart(5)}  meanPixel=${measure.meanPixel.toFixed(1).padStart(5)}`);
      } else {
        assert.ok(
          measure.meanFrame <= tolerance.meanFrame,
          `${id} @ ${progress}: melange global hors tolerance (${measure.meanFrame.toFixed(1)} > ${tolerance.meanFrame}) — ${tolerance.why}`,
        );
        assert.ok(
          measure.meanPixel <= tolerance.meanPixel,
          `${id} @ ${progress}: geometrie hors tolerance (${measure.meanPixel.toFixed(1)} > ${tolerance.meanPixel}) — ${tolerance.why}`,
        );
      }
    }
  }

  const worst = [...report].sort((a, b) => b.meanPixel - a.meanPixel).slice(0, 5);
  console.log(JSON.stringify({ samples: report.length, worstPixelGaps: worst }, null, 2));
  if (shotDir) console.log(`paires d'images ecrites dans ${shotDir}`);
  console.log(`smoke-vibecut-xfade-preview-parity: ok (${targets.length} transitions x ${SAMPLES.length} points)`);
} finally {
  await browser.close();
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

/*
 * Le fondu occupe [1 s, 2 s]. A 50 images/s, l'image n = 50 + round(progress*50)
 * tombe exactement sur la progression voulue.
 */
function renderXfadeFrames(target) {
  const selects = SAMPLES.map((progress) => `eq(n\\,${FPS + Math.round(progress * FPS)})`).join("+");
  return runFfmpegRaw([
    "-f", "lavfi", "-i", sourceA,
    "-f", "lavfi", "-i", sourceB,
    "-filter_complex",
    `[0:v]format=rgba[a];[1:v]format=rgba[b];[a][b]xfade=transition=${target}:duration=1:offset=1[x];[x]select='${selects}',setpts=N/TB[out]`,
    "-map", "[out]", "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]).then((buffer) => {
    const frameBytes = SIZE * SIZE * 3;
    assert.equal(
      buffer.length,
      frameBytes * SAMPLES.length,
      `${target}: ${buffer.length / frameBytes} images extraites, ${SAMPLES.length} attendues`,
    );
    return SAMPLES.map((_, index) => buffer.subarray(index * frameBytes, (index + 1) * frameBytes));
  });
}

function renderStillPng(source) {
  return runFfmpegRaw(["-f", "lavfi", "-i", source, "-frames:v", "1", "-f", "image2", "-c:v", "png", "-"]);
}

function rgbToPng(rgb) {
  return runFfmpegRaw([
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${SIZE}x${SIZE}`, "-i", "-",
    "-frames:v", "1", "-f", "image2", "-c:v", "png", "-",
  ], rgb);
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
    child.on("close", (code) => (code === 0
      ? resolve(Buffer.concat(chunks))
      : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-1200)}`))));
    if (stdin) {
      child.stdin.end(Buffer.from(stdin));
    }
  });
}

/*
 * Le module de l'apercu est charge TEL QUEL dans le navigateur: c'est bien le code
 * de production qui est mesure. Seul son import est resolu a la main, la table
 * etant recopiee depuis le source de exportManifest.js.
 */
function buildBrowserModule(manifest, xfade) {
  const mapLiteral = /export const SERVER_XFADE_TRANSITION_MAP = Object\.freeze\(\{[\s\S]*?\}\);/.exec(manifest);
  assert.ok(mapLiteral, "table SERVER_XFADE_TRANSITION_MAP introuvable dans exportManifest.js");
  const body = xfade.replace(/^import[^;]+;$/m, mapLiteral[0]);
  assert.ok(!/^import\s/m.test(body), "un import non resolu subsiste dans le module d'apercu");
  return `${body}\nwindow.__vibecutXfade = renderXfadeTransition;\n`;
}

function extractTransitionMap(manifest) {
  const block = /export const SERVER_XFADE_TRANSITION_MAP = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(manifest);
  assert.ok(block, "table SERVER_XFADE_TRANSITION_MAP introuvable");
  const map = {};
  for (const match of block[1].matchAll(/'?([\w-]+)'?:\s*'([\w-]+)'/g)) {
    map[match[1]] = match[2];
  }
  assert.ok(Object.keys(map).length >= 15, "table de transitions anormalement courte");
  return map;
}

function appPath(...segments) {
  return path.join(process.cwd(), "src", "features", "vibefx-studio", "video", ...segments);
}

function resolveFfmpeg() {
  if (process.env.VIBECUT_FFMPEG_PATH) return process.env.VIBECUT_FFMPEG_PATH;
  try {
    return require("ffmpeg-static");
  } catch {
    return null;
  }
}
