/*
 * L'ENVELOPPE DES MOUVEMENTS - gate du lot B3, sans navigateur et sans rendu.
 *
 * Deux choses que `smoke-vibecut-motion-preview-parity` ne peut PAS attraper,
 * parce qu'il ne mesure que quelques images de quelques mouvements :
 *
 *  1. PROBLEME I, SUR TOUTE LA TRAJECTOIRE. `zoompan` borne sa fenetre a
 *     l'image, le canvas non : un mouvement dont le cadre sort du cadre diverge
 *     franchement entre apercu et export (74/255 mesures sur un cas volontaire).
 *     La condition |x| et |y| <= (zoom - 1) / 2 etait jusqu'ici verifiee A LA
 *     MAIN sur les deux extremites. Ca suffisait tant qu'un mouvement etait une
 *     DROITE : le pire point est alors forcement un bout. Ce n'est plus vrai au
 *     lot B3 - le bombement de l'orbite culmine AU MILIEU, et le depassement du
 *     rebond va AU-DELA de sa cible. Un preset peut donc etre sage aux deux
 *     bouts et sortir du cadre en route. On echantillonne donc la trajectoire
 *     entiere, a plusieurs intensites.
 *  2. LA CONCORDANCE DES TROIS TABLES. Les cadrages de chaque preset sont
 *     ecrits QUATRE fois : `mediaModel.js` (l'apercu), `exportManifest.js` (le
 *     manifeste), `functions/src/videoExport.js` (le pre-vol) et
 *     `render-service/src/server.js` (le rendu). Une divergence donnerait un
 *     mouvement different de celui que l'apercu montre, en silence. Le meme
 *     principe que `smoke-vibecut-transition-parity`, applique aux mouvements.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { IMAGE_MOTION_PRESETS, IMAGE_MOTION_ACCENTS, resolveImageMotionFrame, rotationCoverage } = await import(
  path.join(root, "src/features/vibefx-studio/video/model/mediaModel.js")
);

/* 1. LES QUATRE TABLES DISENT-ELLES LA MEME CHOSE ? ------------------------- */

const serverSource = await readFile(path.join(root, "render-service/src/server.js"), "utf8");
const manifestSource = await readFile(
  path.join(root, "src/features/vibefx-studio/video/export/exportManifest.js"),
  "utf8",
);
const functionsSource = await readFile(path.join(root, "functions/src/videoExport.js"), "utf8");

const engineIds = IMAGE_MOTION_PRESETS.map((preset) => preset.id);

/*
 * On lit les listes autorisees telles qu'elles sont ECRITES, sans importer les
 * modules: `server.js` et `videoExport.js` ne sont pas chargeables ici (l'un est
 * un service, l'autre du code Functions).
 */
function declaredSet(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `liste introuvable: ${marker}`);
  const open = source.indexOf("[", start);
  const close = source.indexOf("]", open);
  return new Set([...source.slice(open, close).matchAll(/['"]([a-z-]+)['"]/g)].map((m) => m[1]));
}

const declared = {
  "render-service/src/server.js": declaredSet(serverSource, "const SUPPORTED_SERVER_IMAGE_MOTIONS"),
  "functions/src/videoExport.js": declaredSet(functionsSource, "const SUPPORTED_SERVER_IMAGE_MOTIONS"),
  "exportManifest.js": declaredSet(manifestSource, "imageMotions:"),
};

for (const [file, ids] of Object.entries(declared)) {
  for (const id of engineIds) {
    assert.ok(
      ids.has(id),
      `« ${id} » existe dans mediaModel.js mais MANQUE dans ${file}. `
      + "Un mouvement absent d'une seule des tables fait refuser l'export (serveur) "
      + "ou retomber sur un cadre fixe (manifeste) - c'est voulu, completez la table.",
    );
  }
  for (const id of ids) {
    assert.ok(
      engineIds.includes(id),
      `« ${id} » est autorise dans ${file} mais n'existe pas dans mediaModel.js`,
    );
  }
}

/*
 * Les CADRAGES eux-memes, pas seulement les ids. Un preset dont le serveur
 * aurait garde un ancien zoom rendrait un mouvement different sans que rien ne
 * le dise.
 */
function frameOf(source, id, side) {
  const key = /^[a-z]+$/.test(id) ? `${id}:` : `'${id}':`;
  const at = source.indexOf(key, source.indexOf("const presets = {"));
  if (at < 0) return null;
  const line = source.slice(at, source.indexOf("\n", at));
  const part = line.split(side === "start" ? "start:" : "end:")[1];
  if (!part) return null;
  /*
   * On s'arrete a l'ACCOLADE FERMANTE du cadrage. Sans cette borne, la lecture
   * deborde sur le cadrage suivant present sur la meme ligne et rapporte son
   * `scale` a la place - ce qui faisait echouer le controle de concordance sur
   * des tables pourtant identiques.
   */
  const block = part.slice(0, part.indexOf("}") + 1);
  const nums = [...block.matchAll(/(scale|x|y|rotate):\s*(-?[\d.]+)/g)];
  return Object.fromEntries(nums.map((m) => [m[1], Number(m[2])]));
}

for (const preset of IMAGE_MOTION_PRESETS) {
  for (const side of ["start", "end"]) {
    const server = frameOf(serverSource, preset.id, side);
    assert.ok(server, `cadrage ${side} de « ${preset.id} » introuvable dans server.js`);
    for (const axis of ["scale", "x", "y", "rotate"]) {
      if (axis === "rotate" && !preset[side].rotate && !server[axis]) continue;
      assert.equal(
        server[axis],
        preset[side][axis],
        `« ${preset.id} » ${side}.${axis}: le renderer dit ${server[axis]}, l'apercu ${preset[side][axis]}. `
        + "Les deux tables ont diverge: l'export ne rendra pas ce que l'apercu montre.",
      );
    }
  }
}

/* 2. PROBLEME I, SUR TOUTE LA TRAJECTOIRE ---------------------------------- */

const STEPS = 200;
const INTENSITIES = [1, 0.7, 0.4, 0.15];
const report = [];

for (const preset of IMAGE_MOTION_PRESETS) {
  let worstRatio = 0;
  let worstAt = null;
  let minScale = Infinity;

  for (const intensity of INTENSITIES) {
    for (let step = 0; step <= STEPS; step += 1) {
      const progress = step / STEPS;
      const frame = resolveImageMotionFrame({ preset: preset.id, intensity }, progress);
      minScale = Math.min(minScale, frame.scale);

      /*
       * Le zoom ne doit JAMAIS passer sous 1: une photo reduite ne remplit plus
       * le cadre et laisse un bord. Le depassement du rebond rend ce controle
       * necessaire - il traverse sa cible.
       */
      assert.ok(
        frame.scale >= 0.9995,
        `« ${preset.id} » descend a un zoom de ${frame.scale.toFixed(4)} `
        + `(intensite ${intensity}, progression ${progress.toFixed(3)}): la photo ne remplit plus le cadre.`,
      );

      /*
       * UNE BASCULE LAISSE DES COINS VIDES si l'image n'est pas assez agrandie.
       * On verifie donc, pour trois formats, que le zoom de couverture est bien
       * applique - un coin noir a l'export serait invisible pour la comparaison
       * de cadrage, qui ne regarde que x, y et le zoom.
       */
      if (frame.rotate) {
        for (const [w, h] of [[1920, 1080], [1080, 1920], [1080, 1080]]) {
          const cover = rotationCoverage(frame.rotate, w, h);
          assert.ok(
            cover >= 1,
            `« ${preset.id} »: couverture ${cover} sous 1 a ${frame.rotate.toFixed(2)} deg`,
          );
          assert.ok(
            frame.scale * cover >= 1,
            `« ${preset.id} »: l'agrandissement ne couvre pas la bascule en ${w}x${h}`,
          );
        }
      }

      const limit = (frame.scale - 1) / 2;
      const reach = Math.max(Math.abs(frame.x), Math.abs(frame.y));
      // A zoom 1 il n'y a aucune marge, donc aucun decalage n'est permis.
      if (reach <= 1e-9) continue;
      assert.ok(
        limit > 1e-9,
        `« ${preset.id} » decale de ${reach.toFixed(4)} a un zoom de 1: aucune marge (probleme I).`,
      );
      const ratio = reach / limit;
      if (ratio > worstRatio) {
        worstRatio = ratio;
        worstAt = { intensity, progress: Number(progress.toFixed(3)) };
      }
      assert.ok(
        ratio <= 1 + 1e-9,
        `PROBLEME I - « ${preset.id} » sort du cadre: decalage ${reach.toFixed(4)} pour une limite de `
        + `${limit.toFixed(4)} (intensite ${intensity}, progression ${progress.toFixed(3)}). `
        + "zoompan borne sa fenetre a l'image, le canvas non: l'apercu et l'export divergeraient franchement.",
      );
    }
  }

  report.push({
    preset: preset.id,
    margeUtilisee: `${(worstRatio * 100).toFixed(1)} %`,
    pire: worstAt,
    zoomMini: Number(minScale.toFixed(4)),
  });
}

/* 3. LES ACCENTS ----------------------------------------------------------- */

/*
 * Un accent OSCILLE pendant tout le plan: il decale le cadre en permanence, donc
 * il consomme la marge du probleme I a chaque image. Un accent pose sur un plan
 * FIXE est le cas critique - a zoom 1 la marge est nulle - et c'est pourquoi la
 * secousse s'octroie son propre zoom. On le verifie ici sur des durees
 * differentes, la frequence etant en hertz.
 */
const accentIds = IMAGE_MOTION_ACCENTS.map((accent) => accent.id);
/*
 * `SERVER_MOTION_ACCENTS` est un OBJET, pas un tableau: on lit ses cles. Les
 * lire plutot que la liste `SUPPORTED_...` qui en derive garantit qu'un accent
 * declare autorise a bien une implementation en face.
 */
const serverAccentBlock = serverSource.slice(
  serverSource.indexOf("const SERVER_MOTION_ACCENTS"),
  serverSource.indexOf("const SUPPORTED_SERVER_MOTION_ACCENTS"),
);
const serverAccents = new Set(
  [...serverAccentBlock.matchAll(/^\s{2}([a-z]+):/gm)].map((match) => match[1]),
);
for (const id of accentIds) {
  assert.ok(
    serverAccents.has(id),
    `accent « ${id} » absent de SERVER_MOTION_ACCENTS: le renderer refusera l'export`,
  );
}

const accentReport = [];
for (const accent of IMAGE_MOTION_ACCENTS) {
  if (accent.id === "none") continue;
  let worstRatio = 0;
  let minScale = Infinity;
  for (const duration of [1, 2, 5, 12]) {
    for (const intensity of INTENSITIES) {
      for (const preset of ["none", "zoom-in", "orbit", "bounce"]) {
        for (let step = 0; step <= STEPS; step += 1) {
          const frame = resolveImageMotionFrame(
            { preset, intensity: 1, accent: accent.id, accentIntensity: intensity },
            step / STEPS,
            duration,
          );
          minScale = Math.min(minScale, frame.scale);
          assert.ok(
            frame.scale >= 0.9995,
            `accent « ${accent.id} » sur « ${preset} »: zoom ${frame.scale.toFixed(4)} sous 1`,
          );
          /*
       * UNE BASCULE LAISSE DES COINS VIDES si l'image n'est pas assez agrandie.
       * On verifie donc, pour trois formats, que le zoom de couverture est bien
       * applique - un coin noir a l'export serait invisible pour la comparaison
       * de cadrage, qui ne regarde que x, y et le zoom.
       */
      if (frame.rotate) {
        for (const [w, h] of [[1920, 1080], [1080, 1920], [1080, 1080]]) {
          const cover = rotationCoverage(frame.rotate, w, h);
          assert.ok(
            cover >= 1,
            `« ${preset.id} »: couverture ${cover} sous 1 a ${frame.rotate.toFixed(2)} deg`,
          );
          assert.ok(
            frame.scale * cover >= 1,
            `« ${preset.id} »: l'agrandissement ne couvre pas la bascule en ${w}x${h}`,
          );
        }
      }

      const limit = (frame.scale - 1) / 2;
          const reach = Math.max(Math.abs(frame.x), Math.abs(frame.y));
          if (reach <= 1e-9) continue;
          const ratio = reach / Math.max(1e-9, limit);
          worstRatio = Math.max(worstRatio, ratio);
          assert.ok(
            ratio <= 1 + 1e-9,
            `PROBLEME I - accent « ${accent.id} » sur « ${preset} » sort du cadre: `
            + `decalage ${reach.toFixed(4)} pour une limite de ${limit.toFixed(4)} `
            + `(duree ${duration}s, intensite ${intensity}, progression ${(step / STEPS).toFixed(3)}).`,
          );
        }
      }
    }
  }
  accentReport.push({
    accent: accent.id,
    margeUtilisee: `${(worstRatio * 100).toFixed(1)} %`,
    zoomMini: Number(minScale.toFixed(4)),
  });
}

console.log(JSON.stringify({
  accents: accentReport,
  presets: IMAGE_MOTION_PRESETS.length,
  tablesVerifiees: Object.keys(declared).length + 1,
  echantillons: (STEPS + 1) * INTENSITIES.length,
  enveloppe: report,
}, null, 2));
console.log(
  `smoke-vibecut-motion-envelope: ok (${IMAGE_MOTION_PRESETS.length} presets x `
  + `${INTENSITIES.length} intensites x ${STEPS + 1} points)`,
);
