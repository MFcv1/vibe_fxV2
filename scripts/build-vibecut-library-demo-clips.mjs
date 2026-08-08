/*
 * GENERE LES CLIPS DE DEMONSTRATION DES BIBLIOTHEQUES (lot B2).
 *
 * POURQUOI GENERER PLUTOT QUE TELECHARGER.
 * Le plan du lot prevoyait 3-4 clips pris chez Mixkit ou Pexels. Deux raisons
 * ont fait choisir autrement, et elles sont a relire avant de revenir en arriere :
 *
 *  1. DROITS. Le projet bloque deja l'export d'une musique sans declaration de
 *     droits explicite. Poser du rush tiers dans une page servie a tous les
 *     visiteurs demande au minimum une licence lue et validee par le porteur du
 *     projet. Un clip que nous produisons n'a pas ce probleme du tout.
 *  2. COHERENCE. Ces clips remplacent le REPLI DESSINE. En rejouant exactement
 *     les memes scenes (`libraryFallbackScene.js`), l'ecran a le meme aspect
 *     qu'il y ait ou non un clip charge : on ne voit pas l'etage changer sous
 *     ses pieds.
 *
 * Si le porteur du projet veut du vrai rush, c'est un changement de DONNEES :
 * deposer les fichiers, ajouter leur entree dans `libraryMediaManifest.js` avec
 * licence et URL d'origine. Aucun code ne bouge.
 *
 * COMMENT. Chromium dessine les images avec LE CODE DE PRODUCTION - le meme
 * module que le repli - et FFmpeg les encode. Recopier le dessin ici aurait
 * garanti que les deux divergent a la premiere retouche.
 *
 *   node scripts/build-vibecut-library-demo-clips.mjs
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FPS = 30;
const SECONDS = 2;
const FRAMES = FPS * SECONDS;
/*
 * 720p, comme demande par le plan. La scene est dessinee en 640x400 : on encode
 * plus grand pour que les vignettes, qui zooment jusqu'a 116 %, ne montrent pas
 * les pixels du dessin.
 */
const OUT_WIDTH = 1280;
const OUT_HEIGHT = 720;
/* Plafond decide dans le plan du lot: ~1,5 Mo pour l'ensemble des clips. */
const TOTAL_BUDGET_BYTES = 1_500_000;

const OUTPUTS = [
  { index: 0, file: "couchant.mp4" },
  { index: 1, file: "nuit.mp4" },
  { index: 2, file: "aube.mp4" },
  { index: 3, file: "orage.mp4" },
];

const ffmpeg = resolveFfmpeg();
assert.ok(ffmpeg, "FFmpeg introuvable (ffmpeg-static ou VIBECUT_FFMPEG_PATH)");

const sceneSource = await readFile(
  path.join(root, "src/features/vibecut/library/libraryFallbackScene.js"),
  "utf8",
);

const outDir = path.join(root, "public/assets/vibecut-demo");
const workDir = path.join(root, ".vibecut-demo-frames");
await mkdir(outDir, { recursive: true });
await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: OUT_WIDTH, height: OUT_HEIGHT } });

/*
 * Le module de production est injecte TEL QUEL, en retirant seulement les mots
 * cles de module (la page n'est pas un module ES). Rien d'autre n'est reecrit :
 * si le dessin change, les clips changent avec lui a la prochaine generation.
 */
const inlined = sceneSource.replace(/^export\s+/gm, "");
await page.setContent("<canvas id=\"c\"></canvas>");
await page.addScriptTag({ content: inlined });

const written = [];
for (const output of OUTPUTS) {
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const png = await page.evaluate(
      ({ index, phase, width, height }) => {
        const canvas = document.getElementById("c");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // La scene est peinte a sa taille native dans une ardoise, puis posee
        // avec le mouvement. Repeindre la scene a chaque image ferait retirer
        // 2200 grains par image pour un resultat identique.
        const base = document.createElement("canvas");
        base.width = FALLBACK_WIDTH;
        base.height = FALLBACK_HEIGHT;
        paintFallbackScene(base.getContext("2d"), index);

        const { zoom, offsetX, offsetY } = fallbackClipTransform(phase, index);
        const drawWidth = width * zoom;
        const drawHeight = height * zoom;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
          base,
          (width - drawWidth) / 2 + offsetX * width,
          (height - drawHeight) / 2 + offsetY * height,
          drawWidth,
          drawHeight,
        );
        return canvas.toDataURL("image/png").slice("data:image/png;base64,".length);
      },
      { index: output.index, phase: frame / FRAMES, width: OUT_WIDTH, height: OUT_HEIGHT },
    );
    const name = String(frame).padStart(4, "0");
    await writeFile(path.join(workDir, `${output.index}-${name}.png`), Buffer.from(png, "base64"));
  }

  const target = path.join(outDir, output.file);
  await run(ffmpeg, [
    "-y",
    "-framerate", String(FPS),
    "-i", path.join(workDir, `${output.index}-%04d.png`),
    // `faststart` met l'index en tete: la lecture demarre sans avoir telecharge
    // tout le fichier, ce qui compte pour un media charge paresseusement.
    "-movflags", "+faststart",
    "-c:v", "libx264",
    "-preset", "veryslow",
    "-crf", "30",
    "-pix_fmt", "yuv420p",
    // H.264 exige des dimensions paires; 1280x720 les a deja, la garde est pour
    // le jour ou quelqu'un changera la taille.
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-an",
    target,
  ]);
  const size = (await stat(target)).size;
  written.push({ file: output.file, bytes: size });
}

await browser.close();
await rm(workDir, { recursive: true, force: true });

const total = written.reduce((sum, item) => sum + item.bytes, 0);
console.log(JSON.stringify({ clips: written, totalBytes: total, budgetBytes: TOTAL_BUDGET_BYTES }, null, 2));
assert.ok(
  total <= TOTAL_BUDGET_BYTES,
  `Les clips pesent ${total} octets pour un plafond de ${TOTAL_BUDGET_BYTES}. `
  + "Baisser la definition ou monter le CRF plutot que relever le plafond.",
);
console.log(`build-vibecut-library-demo-clips: ok (${written.length} clips, ${(total / 1024).toFixed(0)} Ko)`);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800)))));
  });
}

function resolveFfmpeg() {
  if (process.env.VIBECUT_FFMPEG_PATH) return process.env.VIBECUT_FFMPEG_PATH;
  try {
    const found = require("ffmpeg-static");
    return typeof found === "string" ? found : found?.default || null;
  } catch {
    return null;
  }
}
