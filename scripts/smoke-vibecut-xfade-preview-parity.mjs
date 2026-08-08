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

/*
 * Le cote FFmpeg est construit PAR LE CODE DU RENDERER, pas reecrit ici. Le lot
 * L1 a corrige exactement ce defaut : un test qui reecrit le graphe ne prouve
 * rien sur le graphe que la production emet.
 */
import { buildTransitionSubgraph } from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const ffmpeg = resolveFfmpeg();
assert.ok(ffmpeg, "FFmpeg introuvable (ffmpeg-static ou VIBECUT_FFMPEG_PATH)");

const SIZE = 320;
const FPS = 50;
const SAMPLES = [0.2, 0.4, 0.6, 0.8];
// Nombre de paliers de la rampe `sendcmd`, recopie de TRANSITION_EFFECT_STEPS.
const EFFECT_STEPS = 12;
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
  wiperight: { meanFrame: 4, meanPixel: 4, why: "idem wipeleft, sens inverse" },
  wipeup: { meanFrame: 4, meanPixel: 4, why: "idem wipeleft, sur l'axe vertical" },
  wipedown: { meanFrame: 4, meanPixel: 4, why: "idem wipeup, sens inverse" },
  slideup: { meanFrame: 4, meanPixel: 12, why: "translation entiere; l'arrondi decale la grille d'un pixel" },
  slidedown: { meanFrame: 4, meanPixel: 12, why: "idem slideup" },
  slideleft: { meanFrame: 4, meanPixel: 12, why: "idem slideup, sur l'axe horizontal" },
  slideright: { meanFrame: 4, meanPixel: 12, why: "idem slideleft, sens inverse" },

  /*
   * Lot B3a. Rognages et compressions: la geometrie est EXACTE des deux cotes
   * (courbe de rayon et facteur d'echelle releves sur FFmpeg, pas approches).
   * Ne subsiste que l'echantillonnage du bord — un cercle anticrenele cote
   * canvas contre un bord dur cote FFmpeg.
   */
  circlecrop: {
    meanFrame: 3,
    meanPixel: 4,
    extraSamples: [0.06, 0.12, 0.3, 0.44, 0.7, 0.94],
    why: "rayon = |1-2t|^3 x hypot(w/2,h/2), releve; reste le crenelage du bord du cercle",
  },
  rectcrop: {
    meanFrame: 3,
    meanPixel: 4,
    extraSamples: [0.06, 0.12, 0.3, 0.44, 0.7, 0.94],
    why: "demi-cote = |1-2t|, releve; bord droit, a l'arrondi pres",
  },
  squeezeh: {
    meanFrame: 8,
    meanPixel: 12,
    extraSamples: [0.06, 0.3, 0.5, 0.7, 0.94],
    why: "echelle lineaire en 1-t, relevee; le reechantillonnage vertical du plan comprime differe du sien",
  },
  squeezev: {
    meanFrame: 8,
    meanPixel: 12,
    extraSamples: [0.06, 0.3, 0.5, 0.7, 0.94],
    why: "idem squeezeh, sur la largeur",
  },

  // Bords adoucis: la largeur du degrade est relevee a l'oeil sur les images de
  // reference, elle ne peut pas coincider avec le shader au pixel pres.
  smoothleft: { meanFrame: 14, meanPixel: 14, why: "largeur du degre de balayage approchee" },
  smoothright: { meanFrame: 14, meanPixel: 14, why: "idem smoothleft" },
  smoothup: { meanFrame: 14, meanPixel: 14, why: "smoothleft sur l'axe vertical" },
  smoothdown: { meanFrame: 14, meanPixel: 14, why: "smoothright sur l'axe vertical" },
  vertopen: { meanFrame: 13, meanPixel: 14, why: "ouverture centrale a bord adouci" },
  vertclose: { meanFrame: 13, meanPixel: 14, why: "vertopen a rebours: les volets entrent par les deux bords" },
  horzopen: { meanFrame: 13, meanPixel: 14, why: "vertopen sur l'axe vertical" },
  horzclose: { meanFrame: 13, meanPixel: 14, why: "vertclose sur l'axe vertical" },
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

/*
 * SEUILS DU LOT B3b, par ID.
 *
 * Ces transitions-la ne sont pas une cible `xfade` : plusieurs partagent `fade`
 * comme jointure et ne se distinguent que par leur sous-graphe. Un seuil par
 * cible ne pourrait donc rien dire d'elles, d'ou cette seconde table, consultee
 * AVANT celle des cibles.
 */
/*
 * LES SEUILS SONT MESURES, PAS ESTIMES - et cette table a deja servi d'excuse.
 *
 * Une version anterieure de ce commentaire expliquait un `meanFrame` large par
 * la rasterisation de Chromium : « 1,1 a vide contre 5,3 sous charge, pour un
 * effet strictement identique ». C'ETAIT FAUX. Le 2026-08-03, deux executions
 * consecutives de ce script, sans rien changer entre les deux, ont rendu des
 * mesures IDENTIQUES AU DIXIEME sur les quinze transitions. Il n'y a pas de
 * bruit d'execution a absorber ici.
 *
 * Ce qui variait, c'etait le code mesure : le fichier de travail portait encore
 * le defaut injecte par `smoke-vibecut-transition-sentinels` (l'apercu lisait la
 * courbe en continu au lieu des douze paliers), laisse en place par une
 * execution interrompue. L'ecart n'etait donc pas du bruit mais une ERREUR
 * SYSTEMATIQUE, et elle se predisait au dixieme : sur `additive-dissolve`
 * (alpha = 0,30 x sin(PI q)), l'ecart attendu entre q continu et q quantifie
 * valait 6,5 / 1,1 / 9,1 aux points 0,4 / 0,6 / 0,8, contre 6,0 / 2,0 / 8,9
 * mesures. C'est ce que le seuil de 8 attrapait, et il avait raison.
 *
 * REGLE QUI EN DECOULE : ne jamais monter un seuil de cette table pour faire
 * passer le test. Mesurer deux fois d'abord ; si les deux mesures coincident,
 * l'ecart est un bug, pas du bruit.
 *
 * Les `meanFrame` ci-dessous ont donc ete RESSERRES le 2026-08-03 sur la mesure
 * reelle (environ 1,7 fois le pire point releve), et chaque entree porte cette
 * mesure. `meanPixel` reste la preuve de la GEOMETRIE - c'est lui qui attrape un
 * flou qui ne rampe pas, un decalage RVB inverse ou une bande deplacee.
 */
const EFFECT_TOLERANCES = {
  /*
   * Groupe 1 - flous. La rampe est une CHAINE de douze filtres a valeur
   * constante, chacun ouvert sur un douzieme de la fenetre : l'apercu applique la
   * meme quantification (`quantizeProgress`), donc les deux comparent la meme
   * intensite. Il ne reste que la forme du NOYAU - Chromium approche `blur()` par
   * trois passes de boite, `gblur` est recursif - et le bord rabattu, reconstruit
   * a la main cote canvas.
   */
  "blur-dissolve": { meanFrame: 4, meanPixel: 10, why: "noyau gaussien Chromium != gblur. Mesure du 2026-08-03: pire meanFrame 1,7, pire meanPixel 4,8" },
  "cross-blur": { meanFrame: 4, meanPixel: 10, why: "meme ecart de noyau, a deux fois l'intensite. Mesure du 2026-08-03: pire meanFrame 1,6, pire meanPixel 5,1" },
  "motion-blur": {
    meanFrame: 6,
    meanPixel: 21,
    why: "meme boite et memes decalages entiers qu'avgblur, mais l'apercu accumule en 8 bits (1/N par passe) et plafonne a 33 points. Mesure du 2026-08-03: pire meanFrame 3,6, pire meanPixel 17,0",
  },

  /*
   * Groupe 2 - zooms. La geometrie est EXACTE des deux cotes (meme fenetre de
   * iw/zoom, meme centre, meme borne de panoramique). Ne subsiste que le
   * reechantillonnage : swscale contre le lissage du canvas, sur un motif de
   * traits blancs durs qui est le pire cas possible.
   */
  "cross-zoom": { meanFrame: 4, meanPixel: 18, why: "geometrie exacte; reste le reechantillonnage. Mesure du 2026-08-03: pire meanFrame 2,0, pire meanPixel 14,4" },
  "snap-zoom": { meanFrame: 4, meanPixel: 18, why: "idem, courbe cubique et amplitude plus forte. Mesure du 2026-08-03: pire meanFrame 2,1, pire meanPixel 12,8" },
  "parallax-zoom": { meanFrame: 4, meanPixel: 18, why: "idem, avec panoramique borne a (zoom-1)/2. Mesure du 2026-08-03: pire meanFrame 2,2, pire meanPixel 11,2" },

  // Voile blanc: melange lineaire vers le blanc, exact dans les deux espaces.
  "additive-dissolve": { meanFrame: 5, meanPixel: 10, why: "melange lineaire vers le blanc, exact. Mesure du 2026-08-03: pire meanFrame 2,9, pire meanPixel 1,4" },

  /*
   * Groupe 4 - numerique. Tout est en `gbrp` des deux cotes : en `yuv420p` le
   * sous-echantillonnage de chroma etalerait les franges sur deux pixels et
   * l'apercu, qui travaille en RVB plein, ne pourrait pas le reproduire.
   */
  /*
   * Les trois qui recomposent l'image a partir de ses couches de couleur
   * isolees, en trois dessins additifs.
   */
  "rgb-split": { meanFrame: 4, meanPixel: 10, why: "translation entiere par couche, bords rabattus des deux cotes. Mesure du 2026-08-03: pire meanFrame 2,2, pire meanPixel 6,8" },
  "chromatic": { meanFrame: 4, meanPixel: 10, why: "seule la couche rouge est agrandie; reste son reechantillonnage. Mesure du 2026-08-03: pire meanFrame 2,2, pire meanPixel 6,7" },
  "glitch": { meanFrame: 4, meanPixel: 10, why: "memes bandes, memes decalages entiers; reste l'arrondi de geq. Mesure du 2026-08-03: pire meanFrame 1,8, pire meanPixel 6,4" },

  /*
   * Groupe 3 - lumiere, et groupe 5 - ouvertures. `strobe-cut` et
   * `intro-grid-reveal` sont EXACTS : l'un choisit un plan entier par image,
   * l'autre revele des blocs a bord net selon la meme fonction de seuil entiere.
   */
  "strobe-cut": {
    meanFrame: 4,
    meanPixel: 10,
    extraSamples: [0.3, 0.44, 0.66, 0.9],
    why: "choix plein cadre entre A et B: exact. Les points en plus verifient l'alternance, pas seulement une image. Mesure du 2026-08-03: pire meanFrame 1,7, pire meanPixel 1,5",
  },
  "intro-grid-reveal": { meanFrame: 4, meanPixel: 10, why: "memes blocs, meme fonction de seuil entiere. Mesure du 2026-08-03: pire meanFrame 1,3, pire meanPixel 1,3" },
  "light-leak": { meanFrame: 8, meanPixel: 10, why: "meme decroissance lineaire en rayon; reste l'agrandissement du halo genere en 256x256. Mesure du 2026-08-03: pire meanFrame 4,6, pire meanPixel 4,3" },
  "intro-title-scan": { meanFrame: 4, meanPixel: 12, why: "volet net + barre a bord net. Mesure du 2026-08-03: pire meanFrame 2,1, pire meanPixel 9,0" },
  "intro-neon-doors": {
    meanFrame: 16,
    meanPixel: 25,
    why: "les barres sont exactes, mais la jointure est `vertopen`, dont le bord adouci est deja tolere a 13/14 seul. Mesure du 2026-08-03: pire meanFrame 12,9, pire meanPixel 20,2",
  },
};

const manifestSource = await readFile(appPath("export", "exportManifest.js"), "utf8");
const xfadeSource = await readFile(appPath("engine", "xfadeTransitions.js"), "utf8");
const transitionMap = extractTransitionMap(manifestSource);
/*
 * On itere sur les IDS VibeCut, plus sur les cibles `xfade` (lot B3b). Une cible
 * ne suffit plus a designer une transition : `blur-dissolve`, `cross-blur` et
 * `motion-blur` joignent toutes les trois par `fade` et ne different que par les
 * filtres poses sur la queue de A et la tete de B.
 * Les ids qui partagent une cible SANS effet propre restent representes une
 * seule fois: leur rendu est identique par construction, les mesurer trois fois
 * ne prouverait rien de plus et triplerait la duree du test.
 */
const effectIds = Object.keys(extractEffectMap(manifestSource));
const nativeIds = [...new Set(Object.values(transitionMap))]
  .map((target) => Object.keys(transitionMap).find((id) => transitionMap[id] === target && !effectIds.includes(id)))
  .filter(Boolean);
const cases = [...nativeIds, ...effectIds];

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
  for (const id of cases) {
    const target = transitionMap[id];
    const tolerance = EFFECT_TOLERANCES[id] || TOLERANCES[target];
    assert.ok(tolerance, `aucun seuil declare pour la transition ${id} (cible ${target})`);
    /*
     * `extraSamples` densifie l'echantillonnage pour les transitions dont la
     * COURBE a ete derivee dans ce lot (rognages, compressions). Quatre points
     * suffisent a attraper une erreur de sens; il en faut davantage pour
     * attraper une erreur d'exposant ou de pente.
     */
    const samples = [...new Set([...SAMPLES, ...(tolerance.extraSamples || [])])].sort((a, b) => a - b);
    /*
     * PIEGE, paye une fois (2026-08-02): un point qui ne tombe pas sur une image
     * entiere fait comparer deux instants DIFFERENTS. `0,05 x 50 = 2,5` est
     * arrondi a l'image 3, soit t=0,06 cote FFmpeg contre 0,05 cote canvas — et
     * sur une courbe raide comme le rayon de `circlecrop` (derivee ~5), ce
     * centieme suffit a faire echouer un test pourtant juste.
     */
    for (const progress of samples) {
      assert.ok(
        Math.abs(progress * FPS - Math.round(progress * FPS)) < 1e-9,
        `${id}: le point ${progress} ne tombe pas sur une image (pas de ${1 / FPS})`,
      );
      /*
       * Second piege, propre au lot B3b: la rampe `sendcmd` est un ESCALIER de
       * 12 paliers. Un point d'echantillonnage pose pile sur une frontiere de
       * palier compare deux valeurs de flou differentes selon l'arrondi du PTS,
       * et le test devient instable sans raison lisible.
       */
      if (effectIds.includes(id)) {
        assert.ok(
          Math.abs(progress * EFFECT_STEPS - Math.round(progress * EFFECT_STEPS)) > 1e-6,
          `${id}: le point ${progress} tombe sur une frontiere de palier sendcmd (1/${EFFECT_STEPS})`,
        );
      }
    }
    const expectedFrames = await renderXfadeFrames(id, samples);

    for (const [index, progress] of samples.entries()) {
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
        await writeFile(path.join(shotDir, `${id}-${progress}-export.png`), await rgbToPng(expected));
        await writeFile(path.join(shotDir, `${id}-${progress}-apercu.png`), await rgbToPng(actual));
      }

      if (reportOnly) {
        console.log(`${id.padEnd(22)} p=${progress}  meanFrame=${measure.meanFrame.toFixed(1).padStart(5)}  meanPixel=${measure.meanPixel.toFixed(1).padStart(5)}`);
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
  console.log(`smoke-vibecut-xfade-preview-parity: ok (${cases.length} transitions dont ${effectIds.length} a sous-graphe, x ${SAMPLES.length} points)`);
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
function renderXfadeFrames(id, samples) {
  const selects = samples.map((progress) => `eq(n\\,${FPS + Math.round(progress * FPS)})`).join("+");
  /*
   * LE GRAPHE VIENT DU RENDERER. Pour les 33 transitions du lot B3a il rend une
   * seule ligne `xfade`; pour les 15 du lot B3b, tout le sous-graphe.
   */
  const subgraph = buildTransitionSubgraph({
    type: id,
    index: 1,
    duration: 1,
    durationA: 2,
    durationB: 2,
    width: SIZE,
    height: SIZE,
    fps: FPS,
    labelA: "[a]",
    labelB: "[b]",
    labelOut: "[x]",
  });
  return runFfmpegRaw([
    "-f", "lavfi", "-i", sourceA,
    "-f", "lavfi", "-i", sourceB,
    "-filter_complex",
    `[0:v]format=rgba[a];[1:v]format=rgba[b];${subgraph.join(";")};[x]select='${selects}',setpts=N/TB[out]`,
    "-map", "[out]", "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]).then((buffer) => {
    const frameBytes = SIZE * SIZE * 3;
    assert.equal(
      buffer.length,
      frameBytes * samples.length,
      `${id}: ${buffer.length / frameBytes} images extraites, ${samples.length} attendues`,
    );
    return samples.map((_, index) => buffer.subarray(index * frameBytes, (index + 1) * frameBytes));
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
  const mapLiteral = /export const SERVER_XFADE_TRANSITION_MAP = Object\.freeze\(\{[\s\S]*?\n\}\);/.exec(manifest);
  assert.ok(mapLiteral, "table SERVER_XFADE_TRANSITION_MAP introuvable dans exportManifest.js");
  const effectsLiteral = /export const SERVER_TRANSITION_EFFECTS = Object\.freeze\(\{[\s\S]*?\n\}\);/.exec(manifest);
  assert.ok(effectsLiteral, "table SERVER_TRANSITION_EFFECTS introuvable dans exportManifest.js");
  const stepsLiteral = /export const TRANSITION_EFFECT_STEPS = \d+;/.exec(manifest);
  assert.ok(stepsLiteral, "TRANSITION_EFFECT_STEPS introuvable dans exportManifest.js");
  const body = xfade.replace(
    /^import \{[\s\S]*?\} from '\.\.\/export\/exportManifest\.js';$/m,
    [mapLiteral[0], effectsLiteral[0], stepsLiteral[0]].join("\n"),
  );
  assert.ok(!/^import\s/m.test(body), "un import non resolu subsiste dans le module d'apercu");
  return `${body}\nwindow.__vibecutXfade = renderXfadeTransition;\n`;
}

function extractEffectMap(manifest) {
  const block = /export const SERVER_TRANSITION_EFFECTS = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(manifest);
  assert.ok(block, "table SERVER_TRANSITION_EFFECTS introuvable");
  const map = {};
  for (const match of block[1].matchAll(/'([\w-]+)':\s*Object\.freeze\(\{([^}]*)\}\)/g)) {
    map[match[1]] = match[2];
  }
  assert.ok(Object.keys(map).length > 0, "table d'effets vide");
  return map;
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
