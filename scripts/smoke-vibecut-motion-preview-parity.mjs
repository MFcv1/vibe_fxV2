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
/*
 * POINTS DE MESURE DES ACCENTS, et ils ne sont pas ceux des mouvements.
 *
 * Un accent oscille: si les images echantillonnees tombent sur ses passages a
 * ZERO, il est invisible et le test ne prouve rien. C'est exactement ce qui
 * s'est produit au premier jet - la secousse etait a 7,5 Hz, soit 4 images par
 * cycle a 30 images/s, et trois des cinq points tombaient pile sur un zero.
 * Deux sentinelles sont passees inapercues avant que ce ne soit vu.
 * Ces images-ci sont rapprochees et couvrent plusieurs phases.
 */
const ACCENT_FRAMES = [1, 5, 9, 13, 17, 21];
// Fondu d'entree: 30 % de 60 images. Les points doivent tomber DEDANS.
const FADE_FRAMES = [0, 3, 6, 9, 12, 15, 18, 30];
// Rognage du cas video: la course doit se mesurer sur le segment, pas la source.
const VIDEO_TRIM_START = 0.5;

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
  /*
   * LOT B3. Les trois nouveaux, et chacun couvre une chose que les six
   * precedents ne couvraient pas :
   *  - `drift-down` est une DROITE, comme les six d'avant: il verifie qu'ajouter
   *    un preset ne casse rien;
   *  - `orbit` a un BOMBEMENT - une trajectoire courbe. Une droite cote export
   *    passerait par le milieu au lieu de contourner, et se verrait ici;
   *  - `bounce` DEPASSE sa cible avant de se poser. Un `smoothstep` cote export
   *    accosterait sans depasser: c'est l'image a mi-course qui le dit.
   * Chacun est mesure a deux intensites, parce que le bombement et le
   * depassement sont mis a l'echelle par l'intensite - une des deux ecritures
   * pourrait l'oublier.
   */
  { motion: "drift-down", intensity: 1, label: "drift-down · Marque 100 %" },
  { motion: "orbit", intensity: 1, label: "orbit · Marque 100 % (bombement plein)" },
  { motion: "orbit", intensity: 0.4, label: "orbit · Discret 40 % (bombement reduit)" },
  { motion: "bounce", intensity: 1, label: "bounce · Marque 100 % (depassement plein)" },
  { motion: "bounce", intensity: 0.7, label: "bounce · Naturel 70 %" },
  /*
   * ROTATION. Le premier mouvement qui n'est pas un recadrage: il passe par un
   * filtre DIFFERENT de chaque cote (`rotate` contre `ctx.rotate`), et c'est
   * justement pour ca qu'il doit etre mesure. Deux choses peuvent diverger:
   * l'ORDRE des operations (recadrer puis tourner, et non l'inverse) et le zoom
   * de COUVERTURE qui remplit les coins - lequel depend du format.
   */
  { motion: "rotate", intensity: 1, label: "rotation · Marque 100 %" },
  { motion: "rotate", intensity: 0.4, label: "rotation · Discret 40 %" },
  /*
   * APPARITION. Le seul mouvement qui touche a l'OPACITE. Les images
   * echantillonnees par defaut (3, 12, 30, 48, 59) sont presque toutes APRES la
   * fin du fondu (30 % de 60 images = image 18): sans points rapproches, le
   * test ne verrait que la partie deja opaque et ne prouverait rien du fondu.
   */
  { motion: "appear", intensity: 1, label: "apparition · Marque 100 %" },
  /*
   * LOT B3 - LE MOUVEMENT SUR UNE VIDEO.
   *
   * Le recadrage anime etait reserve aux photos par un garde dont rien ne
   * justifiait la presence. Ce cas prouve qu'il est bien pose sur un clip
   * `mediaType: 'video'`, et surtout que la course se mesure sur le segment
   * ROGNE et non sur la source entiere: `trimStart` vaut 0,5 s ici, donc un
   * calcul reste sur `duration` decalerait tout le mouvement d'un quart de sa
   * course.
   *
   * La source est une video dont TOUTES les images sont identiques. Ce n'est pas
   * un contournement: ce qui est mesure ici est la GEOMETRIE du recadrage, et
   * un contenu constant est le seul moyen de la comparer au pixel pres sans
   * demander a l'apercu de decoder la meme image que FFmpeg au meme instant -
   * ce qui mesurerait la synchronisation du decodeur, pas le mouvement.
   */
  /*
   * LES ACCENTS (effets pendant le plan). Ils n'ont pas de trajet: ils
   * OSCILLENT pendant tout le plan, a une frequence en HERTZ. Trois choses a
   * prouver, et chacune a son cas:
   *  - une secousse posee sur un plan FIXE (le cas le plus courant): elle doit
   *    exister alors que le mouvement, lui, ne demande aucun zoompan;
   *  - une secousse COMPOSEE avec un mouvement: les deux s'additionnent;
   *  - la respiration, dont le zoom ne doit jamais repasser sous son cadrage.
   * L'intensite reduite verifie que l'amplitude suit bien le reglage.
   */
  /*
   * GLITCH (2026-08-04). Le premier mouvement dont la valeur est un ESCALIER et
   * non une courbe, et c'est exactement ce qui le rend fragile: sur une courbe
   * lisse, lire l'instant un poil trop tot coute une fraction de pixel; sur un
   * escalier, ca coute UN SAUT ENTIER. Le decrochage est donc calcule en
   * SECONDES des deux cotes (`on/fps` au rendu, `progression x duree` a
   * l'apercu), les deux seules ecritures qui coincident.
   *
   * Les cinq images echantillonnees tombent, a 30 im/s sur 2 s, sur les paliers
   * 1, 4, 11, 18 et 22 - soit les trois valeurs non nulles du motif (-0,7 a
   * l'image 12, +1 a la 48, +0,45 a la 59) ET deux paliers a zero (images 3 et
   * 30). Ces deux-la portent autant que les autres: ils prouvent qu'entre deux
   * decrochages le cadre ne bouge PAS. Aucun de ces cinq points ne tombe a moins
   * de 0,13 palier d'une frontiere.
   */
  { motion: "glitch", intensity: 1, label: "glitch · Marque 100 %" },
  { motion: "glitch", intensity: 0.4, label: "glitch · Discret 40 %" },
  { motion: "none", intensity: 1, accent: "shake", label: "secousse sur plan FIXE" },
  { motion: "none", intensity: 1, accent: "shake", accentIntensity: 0.4, label: "secousse a 40 %" },
  { motion: "zoom-in", intensity: 1, accent: "shake", label: "secousse COMPOSEE avec un zoom avant" },
  { motion: "none", intensity: 1, accent: "pulse", label: "respiration sur plan FIXE" },
  /*
   * LES ACCENTS D'IMAGE (2026-08-04). Ils ne passent PAS par `zoompan` : ils
   * modifient l'image apres le recadrage, par une chaine de filtres a l'export
   * et par un filtre de contexte + des calques a l'apercu. Chacun couvre une
   * mecanique que les deux precedents ne couvraient pas :
   *  - `leak` est une expression CONTINUE des deux cotes (halo qui traverse et
   *    respire) : c'est le seul des trois dont la parite peut etre exacte ;
   *  - `softness` est un ESCALIER cote export (`gblur` n'accepte pas
   *    d'expression pour son sigma, et `sendcmd` est proscrit) contre un flou
   *    continu cote apercu - l'ecart de quantification est ce qui est mesure ;
   *  - `grain` est le seul effet du produit dont la parite ne PEUT PAS etre
   *    exacte : FFmpeg tire son bruit par pixel avec son propre generateur.
   *    Il est donc juge sur la QUANTITE de bruit et non sur les pixels.
   */
  { motion: "none", intensity: 1, accent: "leak", label: "fuite de lumiere sur plan FIXE" },
  { motion: "none", intensity: 1, accent: "leak", accentIntensity: 0.4, label: "fuite de lumiere a 40 %" },
  { motion: "none", intensity: 1, accent: "softness", label: "flou anime sur plan FIXE" },
  { motion: "none", intensity: 1, accent: "grain", label: "grain sur plan FIXE" },
  { motion: "zoom-in", intensity: 1, accent: "leak", label: "fuite de lumiere COMPOSEE avec un zoom" },
  {
    motion: "pan-right",
    intensity: 1,
    video: true,
    label: "pan-right sur VIDEO (rognee a 0,5 s)",
  },
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

  /*
   * La meme image, encodee en video. Contenu constant: seule la geometrie du
   * recadrage differencie deux instants, ce qui est exactement ce qu'on mesure.
   * Plus longue que la fenetre utile, pour que le rognage ait un sens.
   */
  const sourceVideo = path.join(workDir, "source.mp4");
  await runFfmpeg([
    "-loop", "1", "-framerate", String(FPS), "-i", sourceImage,
    "-t", String(VIDEO_TRIM_START + DURATION + 0.5),
    "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", "-an",
    sourceVideo,
  ]);

  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({
    type: "module",
    /*
     * LES TROIS FONCTIONS DE PRODUCTION, et pas seulement la transformation de
     * cadrage. Depuis les accents d'image (halo, grain, flou anime), l'apercu
     * n'est plus « une transformation puis un dessin » : il pose aussi un
     * FILTRE avant le dessin et des CALQUES apres. Un banc d'essai qui n'en
     * appellerait qu'une comparerait un apercu que personne ne voit.
     */
    content: `${mediaModelSource}\nwindow.__vibecutMotion = applyImageMotionTransform;\nwindow.__vibecutAccentDraw = drawImageAccent;\n`,
  });
  await page.waitForFunction(() => Boolean(window.__vibecutMotion));
  await page.evaluate(
    async ([data, size, duration]) => {
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
      window.__duration = duration;
    },
    [`data:image/png;base64,${sourcePng.toString("base64")}`, SIZE, DURATION],
  );

  const report = [];
  const accentReport = [];
  const grainReport = [];
  const exportedByCase = new Map();

  for (const testCase of CASES) {
    const key = caseKey(testCase);
    const outputFile = path.join(workDir, `${key}.mp4`);
    const args = buildFfmpegArgs({
      manifest: makeManifest(testCase),
      videoInputs: [{ clip: makeClip(testCase), file: testCase.video ? sourceVideo : sourceImage }],
      audioInputs: [],
      outputFile,
      warnings: [],
    });

    /*
     * Le renderer doit demander la COURBE et l'INTENSITE, pas seulement un
     * zoompan quelconque. On lit sa commande avant de la lancer.
     */
    const filterComplex = readFilterComplex(args);
    /*
     * UN ACCENT D'IMAGE NE DOIT PAS DEMANDER DE ZOOMPAN, et c'est une exigence
     * et non une tolerance: sur un plan fixe, un recadrage a l'identique coute
     * un reechantillonnage complet pour ne rien changer. On verifie donc son
     * ABSENCE, et a la place la presence du filtre propre a l'accent.
     */
    const IMAGE_ACCENT_FILTER = {
      leak: /geq=/,
      grain: /noise=alls=/,
      softness: /gblur=sigma=/,
    };
    const imageAccentPattern = IMAGE_ACCENT_FILTER[testCase.accent];
    if (imageAccentPattern) {
      assert.match(
        filterComplex,
        imageAccentPattern,
        `${testCase.label}: le filtre de l'accent est absent de la commande`,
      );
      if (testCase.motion === "none") {
        assert.doesNotMatch(
          filterComplex,
          /zoompan=/,
          `${testCase.label}: un accent d'image sur un plan fixe ne doit pas construire de zoompan`,
        );
      }
    } else {
      assert.match(filterComplex, /zoompan=/, `${testCase.label}: aucun zoompan demande`);
    }
    /*
     * LOT B3 - la courbe attendue depend du preset. `bounce` DEPASSE sa cible
     * (back-out), les autres accostent (smoothstep). Exiger le smoothstep
     * partout reviendrait a interdire le rebond; ne rien exiger du tout
     * laisserait passer une interpolation lineaire, qui est exactement le defaut
     * que cette assertion existe pour attraper depuis le lot L3.
     */
    if (testCase.accent && !imageAccentPattern) {
      // L'accent doit etre DEMANDE, pas seulement tolere: sans ce controle, un
      // renderer qui l'ignorerait rendrait un plan fixe et l'ecart passerait
      // sous les seuils sur les images ou l'oscillation repasse par zero.
      /*
       * Les accents d'IMAGE sont exclus: leur oscillation n'est pas toujours
       * dans une expression. `softness` la resout a l'avance, un palier a la
       * fois - il n'y a donc aucun sinus a trouver dans sa commande, et
       * l'exiger interdirait la seule ecriture qui marche. Leur presence est
       * verifiee juste au-dessus, par le filtre qui leur est propre.
       */
      const wanted = testCase.accent === "pulse" ? /cos\(2\*PI\*/ : /sin\(2\*PI\*/;
      assert.match(
        filterComplex,
        wanted,
        `${testCase.label}: aucune oscillation dans l'expression: l'accent n'est pas rendu`,
      );
    }
    if (testCase.motion === "none") {
      // Pas de trajet: il n'y a pas de courbe a verifier, seulement l'accent.
    } else {
    if (testCase.motion === "appear") {
      assert.match(
        filterComplex,
        /fade=t=in:start_frame=0:nb_frames=\d+/,
        `${testCase.label}: aucun fondu d'entree demande: l'apparition serait rendue opaque`,
      );
    }
    if (testCase.motion === "rotate") {
      assert.match(
        filterComplex,
        /rotate=angle=/,
        `${testCase.label}: aucune bascule demandee: le mouvement serait rendu fixe`,
      );
      // Le zoom de couverture doit etre applique, sinon coins noirs a l'export.
      assert.match(
        filterComplex,
        /abs\(cos\(/,
        `${testCase.label}: aucun zoom de couverture: la bascule laisserait des coins vides`,
      );
    }
    const expectedCurve = testCase.motion === "bounce"
      ? { pattern: /pow\(\(min\(on\/\d+,1\)\)-1,3\)/, label: "le depassement (back-out)" }
      : { pattern: /\(3-2\*\(min\(on\//, label: "le smoothstep" };
    assert.match(
      filterComplex,
      expectedCurve.pattern,
      `${testCase.label}: la commande doit porter ${expectedCurve.label}, pas une interpolation lineaire`,
    );
    }
    // Le bombement de l'orbite doit etre DEMANDE, pas seulement tolere.
    if (testCase.motion === "orbit") {
      assert.match(
        filterComplex,
        /sin\(PI\*/,
        `${testCase.label}: aucun bombement dans l'expression: l'orbite serait rendue en ligne droite`,
      );
    }
    /*
     * LE DECROCHAGE doit etre DEMANDE. Sans ce controle, un `glitch` que le
     * renderer aurait oublie de poser resterait invisible: ses deux cadrages
     * etant identiques, la commande construirait quand meme un `zoompan` valide
     * et le test ne verrait qu'un plan fixe des deux cotes.
     */
    if (testCase.motion === "glitch") {
      assert.match(
        filterComplex,
        /mod\(floor\(/,
        `${testCase.label}: aucun palier dans l'expression: le decrochage ne serait pas rendu du tout`,
      );
    }
    if (testCase.intensity < 1) {
      assert.ok(
        filterComplex.includes(`${testCase.intensity}*`),
        `${testCase.label}: l'intensite doit apparaitre dans l'expression zoompan`,
      );
    }

    await runFfmpeg(args);
    const exported = await extractFrames(
      outputFile,
      testCase.accent ? ACCENT_FRAMES : (testCase.motion === "appear" ? FADE_FRAMES : SAMPLE_FRAMES),
    );
    exportedByCase.set(key, exported);

    let frames = SAMPLE_FRAMES;
    if (testCase.accent) frames = ACCENT_FRAMES;
    else if (testCase.motion === "appear") frames = FADE_FRAMES;

    /*
     * L'ACCENT: ON COMPARE L'AMPLITUDE DU MOUVEMENT, pas seulement les images.
     *
     * Un accent ne deplace le cadre que de +-3,8 px sur 320. C'est SOUS le
     * seuil de geometrie (12/255) qu'il faut tolerer pour le reechantillonnage:
     * un renderer qui diviserait l'amplitude par deux resterait donc « en
     * parite » image par image. Mesure du 2026-08-04: la sentinelle qui halve
     * l'amplitude n'a effectivement pas ete vue.
     *
     * On mesure donc, de chaque cote, de COMBIEN l'image bouge entre ses
     * propres echantillons - l'ecart maximal entre deux d'entre eux - et on
     * compare ces deux amplitudes. Un accent absent, plus faible, plus fort ou
     * a la mauvaise frequence les fait diverger, la ou la comparaison image par
     * image reste aveugle.
     */
    /*
     * LE GLITCH PASSE PAR LA MEME MESURE, et pour la meme raison. Ses deux
     * cadrages etant identiques, TOUT ce qui bouge dans ce plan vient du
     * decrochage: si le renderer le divisait par deux ou l'oubliait, la
     * comparaison image par image resterait dans ses tolerances - un cadre fixe
     * des deux cotes est parfaitement « en parite ». C'est l'AMPLITUDE entre les
     * echantillons qui le dit, pas leur ressemblance.
     */
    /*
     * LE GRAIN NE PASSE PAS PAR LA COMPARAISON D'IMAGES, et ce n'est pas une
     * facilite : FFmpeg (`noise`) tire un nombre aleatoire par pixel et par
     * image avec SON generateur. Aucun canvas ne reproduira cette suite, et
     * comparer les pixels reviendrait a comparer deux tirages de des.
     *
     * Ce qui est prouvable, et ce qui compte pour l'utilisateur, c'est que les
     * deux cotes ajoutent la MEME QUANTITE de grain. On mesure donc l'ECART-TYPE
     * des pixels de chaque cote et on compare l'AUGMENTATION par rapport a la
     * meme image sans grain. Une des deux ecritures qui oublierait le grain, le
     * doublerait ou le diviserait par deux se verrait immediatement.
     */
    if (testCase.accent === "grain") {
      const stddev = (buffer) => {
        let sum = 0;
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          sum += buffer[i];
          sumSquares += buffer[i] * buffer[i];
        }
        const mean = sum / buffer.length;
        return Math.sqrt(Math.max(0, sumSquares / buffer.length - mean * mean));
      };
      const at = frames[0] / FPS / DURATION;
      const plain = await renderPreview(page, { ...testCase, accent: null }, at, "ease-in-out");
      const base = stddev(plain);
      const exportGain = stddev(exported[0]) - base;
      const previewGain = stddev(await renderPreview(page, testCase, at, "ease-in-out")) - base;
      grainReport.push({
        case: testCase.label,
        grainExport: round3(exportGain),
        grainApercu: round3(previewGain),
      });
      assert.ok(
        reportOnly || exportGain > 1,
        `${testCase.label}: l'export n'ajoute aucun grain (ecart-type +${exportGain.toFixed(2)}).`,
      );
      const grainRatio = exportGain / Math.max(0.001, previewGain);
      assert.ok(
        reportOnly || (grainRatio > 0.5 && grainRatio < 2),
        `${testCase.label}: les deux cotes n'ajoutent pas la meme quantite de grain - `
        + `export +${exportGain.toFixed(2)}, apercu +${previewGain.toFixed(2)} `
        + `(rapport ${grainRatio.toFixed(2)}).`,
      );
    } else if (testCase.accent || testCase.motion === "glitch") {
      const spread = (list) => {
        let widest = 0;
        for (let a = 0; a < list.length; a += 1) {
          for (let b = a + 1; b < list.length; b += 1) {
            widest = Math.max(widest, compare(list[a], list[b]).meanPixel);
          }
        }
        return widest;
      };
      const previews = [];
      for (const frame of frames) {
        previews.push(await renderPreview(page, testCase, frame / FPS / DURATION, "ease-in-out"));
      }
      const exportSpread = spread(exported);
      const previewSpread = spread(previews);
      accentReport.push({
        case: testCase.label,
        amplitudeExport: round3(exportSpread),
        amplitudeApercu: round3(previewSpread),
      });

      /*
       * PLANCHER D'EXISTENCE par accent. Le halo est un effet DOUX : son
       * amplitude vaut ~3 la ou une secousse en fait 12. Exiger 4 pour tout le
       * monde reviendrait a refuser un effet correct parce qu'il est discret.
       * Ce qui compte est qu'il BOUGE de facon mesurable, pas qu'il crie.
       */
      const FLOOR = { leak: 1, softness: 1.5 };
      const floor = FLOOR[testCase.accent] ?? 4;
      assert.ok(
        reportOnly || exportSpread > floor,
        `${testCase.label}: l'export ne bouge pas (amplitude ${exportSpread.toFixed(1)} <= ${floor}). `
        + "L'accent n'est pas rendu du tout.",
      );
      const ratio = exportSpread / Math.max(0.001, previewSpread);
      /*
       * BANDE ELARGIE POUR LE FLOU ANIME, et c'est un ECART STRUCTUREL mesure,
       * pas un seuil monte pour faire passer le test.
       *
       * Le sigma est le MEME des deux cotes (aucun facteur correctif n'a ete
       * introduit) ; ce qui differe est le NOYAU. Chromium approxime la
       * gaussienne du `blur()` CSS par une suite de flous de boite, et cette
       * approximation s'ecarte le plus aux PETITS sigmas - or celui-ci culmine a
       * 1,9 px sur le banc d'essai. C'est le meme ecart, deja documente et
       * borne, que le noyau de `blur-cut` (probleme G de todo.md).
       *
       * Deux corrections ont ete faites AVANT d'elargir quoi que ce soit, et
       * chacune a ete mesuree :
       *   - bords rabattus comme FFmpeg (etirement du bord) : 0,59 -> 0,74 ;
       *   - apercu quantifie sur les memes 24 paliers que l'export : sans effet
       *     mesurable, ce qui a ecarte la quantification comme cause.
       * Mesure du 2026-08-04 : rapport 0,74. La bande est posee a 0,65-1,45.
       */
      const BAND = testCase.accent === "softness"
        ? { low: 0.65, high: 1.45 }
        : { low: 0.75, high: 1.33 };
      assert.ok(
        reportOnly || (ratio > BAND.low && ratio < BAND.high),
        `${testCase.label}: l'accent n'a pas la meme AMPLITUDE des deux cotes - `
        + `export ${exportSpread.toFixed(1)}, apercu ${previewSpread.toFixed(1)} (rapport ${ratio.toFixed(2)}, `
        + `bande ${BAND.low}-${BAND.high}). `
        + "Amplitude, frequence ou intensite divergent entre le renderer et l'apercu.",
      );
    }

    for (const [index, frame] of frames.entries()) {
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
      /*
       * LE GRAIN EST EXCLU DE LA COMPARAISON PIXEL A PIXEL, et seulement de
       * celle-la. Les deux cotes tirent des suites aleatoires DIFFERENTES : sur
       * une image bruitee des deux cotes mais differemment, `meanPixel` mesure
       * la difference de deux tirages, pas une erreur. `meanFrame` reste exige -
       * il porte sur la couleur MOYENNE, que le grain ne doit pas deplacer, et
       * c'est exactement ce qu'un grain mal centre casserait.
       */
      const skipPixel = testCase.accent === "grain";
      assert.ok(
        measure.meanFrame <= TOLERANCE.meanFrame,
        `${testCase.label} @ image ${frame}: cadrage global hors tolerance (${measure.meanFrame.toFixed(1)} > ${TOLERANCE.meanFrame})`,
      );
      assert.ok(
        skipPixel || measure.meanPixel <= TOLERANCE.meanPixel,
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
  console.log(JSON.stringify({
    accents: accentReport, grain: grainReport, samples: report.length, worstPixelGaps: worst, sentinelRejectedAt: round3(sentinel.meanPixel) }, null, 2));
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
      // La DUREE est indispensable aux accents: leur frequence est en hertz.
      const withEasing = { ...motion, easing: easingMode };
      window.__vibecutMotion(ctx, withEasing, t, size, size, window.__duration);
      ctx.drawImage(window.__source, 0, 0, size, size);
      ctx.restore();
      // Flou, halo et grain sont poses APRES le dessin, hors du recadrage.
      window.__vibecutAccentDraw(ctx, withEasing, t, size, size, window.__duration);
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
  if (testCase.accent) {
    motion.accent = testCase.accent;
    motion.accentIntensity = testCase.accentIntensity ?? 1;
  }
  return motion;
}

function caseKey(testCase) {
  const amplified = testCase.start || testCase.end ? "-amplifie" : "";
  const accent = testCase.accent ? `-${testCase.accent}${Math.round((testCase.accentIntensity ?? 1) * 100)}` : "";
  const media = testCase.video ? "-video" : "";
  return `${testCase.motion}-${Math.round(testCase.intensity * 100)}${amplified}${accent}${media}`;
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

function extractFrames(file, wanted = SAMPLE_FRAMES) {
  const selects = wanted.map((frame) => `eq(n\\,${frame})`).join("+");
  return runFfmpegRaw([
    "-i", file,
    "-vf", `select='${selects}'`,
    "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]).then((buffer) => {
    const frameBytes = SIZE * SIZE * 3;
    assert.equal(
      buffer.length,
      frameBytes * wanted.length,
      `${buffer.length / frameBytes} images extraites, ${wanted.length} attendues`,
    );
    return wanted.map((_, index) => buffer.subarray(index * frameBytes, (index + 1) * frameBytes));
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
  if (testCase.video) {
    return {
      id: "clip-a",
      name: "clip-a",
      mediaType: "video",
      sourceStoragePath: "sources/clip-a.mp4",
      duration: VIDEO_TRIM_START + DURATION,
      trimStart: VIDEO_TRIM_START,
      trimEnd: VIDEO_TRIM_START + DURATION,
      speed: 1,
      volume: 0,
      fitMode: "cover",
      filters: {},
      motion: motionOf(testCase),
    };
  }
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
