/*
 * Importe un preset Lightroom dans Vibe_fx.
 *
 *   node scripts/import-lightroom-preset.mjs \
 *     --hald  presets-lightroom/cn11.png \
 *     --xmp   presets-lightroom/CN11.xmp \
 *     --id    cn11 \
 *     --label "CN11" \
 *     [--hint "Cinematique nuit"] [--level 8] [--force]
 *
 * `--hald` : la mire passee dans Lightroom avec le preset (voir
 *            `make-hald-clut.mjs`). C'est elle qui porte la COULEUR, exactement.
 * `--xmp`  : le fichier du preset. Optionnel, mais c'est le seul moyen de
 *            recuperer clarte / texture / nettete / grain / vignetage, qu'une
 *            Hald CLUT ne peut pas capturer.
 *
 * Les memes valeurs se passent a la main quand le preset n'a pas de `.xmp`
 * (c'est le cas des presets Premium d'Adobe), avec le nombre lu a l'ecran:
 * `--grain`, `--grainSize`, `--grainRoughness`, `--vignette`, `--clarity`, `--texture`,
 * `--sharpness`, `--dehaze`. `--grainSize` est le sous-reglage « Taille » du
 * grain: il ne se passe que si le preset s'ecarte de son defaut, 25.
 *
 * Ecrit un module dans `src/features/vibefx-studio/utils/presets/<id>.js` et
 * l'enregistre dans `presets/index.js`.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { LUT_SIZE } from '../src/features/vibefx-studio/utils/lut3d.js';
import {
    haldImageSize,
    haldToLut3d,
    lutToBase64,
    measureHaldDeviation,
    measureHaldRoughness,
    smoothHaldCube,
} from '../src/features/vibefx-studio/utils/haldClut.js';
import { parseXmpPreset, verifierDomaineSpatial } from '../src/features/vibefx-studio/utils/xmpPreset.js';

/* ---------- arguments ---------- */

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
    const token = process.argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = process.argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
        args[key] = true;
    } else {
        args[key] = next;
        i += 1;
    }
}

function fail(message, hint) {
    console.error(`\nECHEC: ${message}`);
    if (hint) console.error(`\n${hint}`);
    console.error('');
    process.exit(1);
}

if (!args.hald) {
    fail(
        'il manque --hald (la mire passee dans Lightroom).',
        'Genere-la d\'abord :\n  node scripts/make-hald-clut.mjs\n'
        + 'puis applique-lui le preset dans Lightroom et exporte en PNG taille d\'origine.',
    );
}
if (!args.id) fail('il manque --id (identifiant court du preset, ex. `cn11`).');
if (!/^[a-z0-9][a-z0-9-]*$/.test(String(args.id))) {
    fail(`--id invalide: « ${args.id} ». Attendu des minuscules, chiffres et tirets.`);
}

const level = Number(args.level || 8);
const expectedSize = haldImageSize(level);

/* ---------- lecture de la mire ---------- */

if (!fs.existsSync(args.hald)) fail(`fichier introuvable: ${args.hald}`);

const image = sharp(args.hald);
const meta = await image.metadata();

/*
 * Mire en blocs: chaque couleur occupe un carre de NxN pixels au lieu d'un seul.
 * On le detecte a la taille du fichier, et on ne lit que le CENTRE de chaque
 * carre.
 *
 * Pourquoi c'est indispensable, et pas un detail: sur une mire a un pixel par
 * couleur, deux pixels voisins sont deux couleurs sans rapport. Le moindre
 * traitement qui regarde le voisinage fait alors baver les couleurs les unes
 * sur les autres. C'est invisible dans les tons clairs et RUINEUX dans les
 * noirs, ou les valeurs valent 4 ou 8 sur 255. Mesure a l'appui sur CN11:
 * l'entree 26,17,14 ressortait a 5,24,6 (un vert franc) au lieu de 23,15,14.
 * En blocs de 4x4, la bavure se mange sur les bords et le centre reste pur.
 */
const detectedBlock = meta.width && meta.width % expectedSize === 0
    ? meta.width / expectedSize
    : 0;
const block = Number(args.bloc || detectedBlock || 1);

if (!Number.isInteger(block) || block < 1) fail(`--bloc invalide: ${args.bloc}`);

if (meta.width !== expectedSize * block || meta.height !== expectedSize * block) {
    fail(
        `la mire fait ${meta.width}x${meta.height}, or un niveau ${level}`
        + ` en blocs de ${block} attend ${expectedSize * block}x${expectedSize * block}.`,
        'C\'est presque toujours un redimensionnement a l\'export. Dans Lightroom, exporte en\n'
        + '« taille d\'origine », sans redimensionnement ni nettete de sortie.\n'
        + 'Si tu as genere la mire a un autre niveau, precise-le avec --level.',
    );
}

let pixels;
{
    const { data } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (block === 1) {
        pixels = data;
    } else {
        /*
         * On ecarte le bord du carre (c'est lui qui recoit la bavure des
         * voisins) et on MOYENNE ce qui reste. Ecarter le bord traite la
         * contamination ; moyenner traite le grain, qui lui est un bruit par
         * pixel qu'un simple centre ne reduirait pas. Avec des blocs de 4, il
         * reste 2x2 pixels utiles, soit un bruit divise par deux — gratuitement.
         */
        const margin = block >= 4 ? 1 : 0;
        const from = margin;
        const to = block - margin;
        const count = (to - from) ** 2;
        pixels = Buffer.alloc(expectedSize * expectedSize * 3);
        for (let sy = 0; sy < expectedSize; sy += 1) {
            for (let sx = 0; sx < expectedSize; sx += 1) {
                const acc = [0, 0, 0];
                for (let y = from; y < to; y += 1) {
                    for (let x = from; x < to; x += 1) {
                        const s = ((sy * block + y) * meta.width + (sx * block + x)) * 3;
                        acc[0] += data[s];
                        acc[1] += data[s + 1];
                        acc[2] += data[s + 2];
                    }
                }
                const d = (sy * expectedSize + sx) * 3;
                for (let c = 0; c < 3; c += 1) pixels[d + c] = Math.round(acc[c] / count);
            }
        }
        console.log(
            `\nMire en blocs de ${block}x${block}: lecture du coeur de chaque carre`
            + ` (${to - from}x${to - from} pixels moyennes, bord ecarte).`,
        );
    }
}

const deviation = measureHaldDeviation(pixels, level);
if (deviation.max <= 1) {
    fail(
        'cette mire est identique a la mire neutre : aucun preset ne lui a ete applique.',
        'Dans Lightroom, verifie que le preset est bien actif sur l\'image AVANT d\'exporter.',
    );
}

/*
 * Grain: un preset qui en contient bruite la mire, donc la table. On le mesure
 * et on le dit — un preset bruite capture sans lissage donne des bandes et un
 * rendu instable dans les degrades.
 */
const roughness = measureHaldRoughness(pixels, level);
const passes = args.lisser === true ? 1 : Number(args.lisser || 0);
const cleaned = passes > 0 ? smoothHaldCube(pixels, level, passes) : pixels;
const roughnessAfter = passes > 0 ? measureHaldRoughness(cleaned, level) : roughness;

const lut = haldToLut3d(cleaned, level, LUT_SIZE);

/* ---------- lecture du .xmp (optionnel) ---------- */

let xmp = null;
if (args.xmp) {
    if (!fs.existsSync(args.xmp)) fail(`fichier introuvable: ${args.xmp}`);
    try {
        xmp = parseXmpPreset(fs.readFileSync(args.xmp, 'utf8'), { fallbackName: args.label || args.id });
    } catch (error) {
        fail(`lecture du .xmp impossible: ${error.message}`);
    }
}

/* ---------- ecriture du module ---------- */

const label = args.label || xmp?.name || args.id;
const hint = args.hint || (xmp?.group ? `Lightroom — ${xmp.group}` : 'Preset importé de Lightroom');
const spatial = xmp?.spatialFilters || {};

/*
 * Les reglages spatiaux releves A LA MAIN dans les panneaux Effets et Detail.
 *
 * Ils existent parce que les presets Premium d'Adobe ne s'exportent PAS en
 * `.xmp`: pour eux, le releve a l'ecran est la seule source. Sans ce relevé, un
 * preset importe rend une couleur juste et un rendu INCOMPLET, sans que rien ne
 * le signale — CN17 pose un Grain 15 qu'aucune table de couleurs ne peut
 * porter.
 *
 * Ces valeurs sont a l'echelle de Lightroom, et notre moteur l'est aussi depuis
 * le 2026-08-15 (mesure dans `docs/lightroom/4-synchro-effets.md`): on recopie
 * le nombre affiche, sans le convertir.
 *
 * Ils priment sur le `.xmp` quand les deux existent: on a regarde l'ecran.
 *
 * `--grainRoughness` est sa « Cassure » (50 par defaut; a 0 elle pose 1,72x plus
 * de grain, a 100 elle grossit les grains de moitie — RELEVE-LA A CHAQUE IMPORT).
 * `--grainSize` est le sous-reglage « Taille » du grain, sous le triangle de son
 * panneau Effets. Il ne se releve QUE si un preset s'ecarte de son defaut (25):
 * c'est la valeur sur laquelle tout est calibre. Il change la GROSSEUR des
 * grains, donc aussi leur force apparente — un grain deux fois plus gros bruite
 * deux fois moins chaque pixel (mesures dans `grainField.js`).
 */
['grain', 'grainSize', 'grainRoughness', 'vignette', 'clarity', 'sharpness', 'dehaze', 'texture'].forEach((cle) => {
    const brut = args[cle];
    if (brut === undefined || brut === true) return;
    const valeur = Number(brut);
    if (!Number.isFinite(valeur)) fail(`--${cle} attend un nombre, recu « ${brut} ».`);
    spatial[cle] = valeur;
});
const presetDir = path.join('src', 'features', 'vibefx-studio', 'utils', 'presets');
const modulePath = path.join(presetDir, `${args.id}.js`);

if (fs.existsSync(modulePath) && !args.force) {
    fail(`${modulePath} existe deja. Relance avec --force pour l'ecraser.`);
}

fs.mkdirSync(presetDir, { recursive: true });

const summaryComment = xmp?.summary?.length
    ? xmp.summary.map((line) => ` *   - ${line}`).join('\n')
    : ' *   (aucun .xmp fourni : reglages Lightroom inconnus)';

const moduleSource = `/*
 * ${label} — preset importe de Lightroom.
 *
 * GENERE PAR \`scripts/import-lightroom-preset.mjs\`. Ne pas editer a la main:
 * relancer l'import si le preset change dans Lightroom.
 *
 * La couleur vient d'une Hald CLUT passee dans Lightroom: ce n'est pas une
 * approximation des calculs d'Adobe, c'est leur resultat mesure sur toute la
 * grille RVB (ecart moyen a l'identite: ${deviation.mean.toFixed(1)}/255, max ${deviation.max}/255).
 *
 * Reglages lus dans le .xmp:
${summaryComment}
 *
 * Source Hald : ${path.basename(args.hald)} (niveau ${level}, cube ${level * level})
 * Importe le  : ${new Date().toISOString().slice(0, 10)}
 */

import { lutFromBase64 } from '../haldClut.js';

const LUT_BASE64 = '${lutToBase64(lut)}';

let cached = null;

export const preset = {
    id: '${args.id}',
    label: ${JSON.stringify(label)},
    hint: ${JSON.stringify(hint)},
    description: ${JSON.stringify(
        `Capturé depuis Lightroom par table de conversion complète.${xmp?.summary?.length ? ` Réglages : ${xmp.summary.join(' · ')}.` : ''}`,
    )},
    bestFor: ${JSON.stringify(args.bestFor || 'à définir après essai sur tes photos')},
    avoidFor: ${JSON.stringify(args.avoidFor || 'photos déjà fortement filtrées')},
    recommendedIntensity: ${Number(args.intensity || 100)},
    /* Reglages que la table ne peut pas porter (ils dependent des pixels
       voisins ou de la position dans l'image), lus dans le .xmp. */
    spatialFilters: ${JSON.stringify(spatial)},
    /* La table elle-meme, decodee au premier usage. */
    getLut() {
        if (!cached) cached = lutFromBase64(LUT_BASE64);
        return cached;
    },
};

export default preset;
`;

fs.writeFileSync(modulePath, moduleSource, 'utf8');

/* ---------- enregistrement dans l'index ---------- */

const indexPath = path.join(presetDir, 'index.js');
const existing = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
const ids = new Set(
    [...existing.matchAll(/from '\.\/([a-z0-9-]+)\.js'/g)].map((m) => m[1]),
);
ids.add(args.id);
const sorted = [...ids].sort();

const indexSource = `/*
 * Presets importes de Lightroom.
 *
 * GENERE PAR \`scripts/import-lightroom-preset.mjs\`. Ne pas editer a la main.
 * Chaque entree porte une table de conversion capturee par Hald CLUT.
 */

${sorted.map((id) => `import ${id.replace(/-/g, '_')} from './${id}.js';`).join('\n')}

export const IMPORTED_PRESETS = [
${sorted.map((id) => `    ${id.replace(/-/g, '_')},`).join('\n')}
];
`;
fs.writeFileSync(indexPath, indexSource, 'utf8');

/* ---------- rapport ---------- */

console.log(`\nPreset « ${label} » importe.\n`);
console.log(`  module        : ${modulePath}`);
console.log(`  identifiant   : ${args.id}`);
console.log(`  table         : ${LUT_SIZE}^3 depuis un cube Hald de ${level * level}^3`);
console.log(`  ecart mesure  : moyen ${deviation.mean.toFixed(2)}/255, max ${deviation.max}/255`);
console.log(
    `  rugosite      : ${roughness.mean.toFixed(2)}/255`
    + (passes > 0 ? ` -> ${roughnessAfter.mean.toFixed(2)}/255 apres ${passes} lissage(s)` : ''),
);
if (roughnessAfter.mean > 3) {
    console.log('');
    console.log('  ATTENTION: la table capturee est BRUITEE, pas lisse. C\'est presque');
    console.log('  toujours du GRAIN dans le preset: il perturbe chaque pixel de la mire,');
    console.log('  donc chaque couleur de la table. Resultat: des bandes dans les ciels et');
    console.log('  un rendu instable dans les degrades.');
    console.log('  Reimporte avec  --lisser 1  (ou 2 si ca ne suffit pas), et recupere le');
    console.log('  grain a sa vraie place, en effet spatial, via le .xmp.');
}
if (xmp) {
    console.log(`  .xmp          : ${xmp.name}${xmp.group ? ` (${xmp.group})` : ''}`);
    if (xmp.summary.length) {
        console.log('  reglages lus  :');
        for (const line of xmp.summary) console.log(`      - ${line}`);
    }
    const spatialKeys = Object.keys(spatial);
    console.log(`  spatial       : ${spatialKeys.length ? spatialKeys.map((k) => `${k}=${spatial[k]}`).join(', ') : 'aucun'}`);
} else {
    console.log('  .xmp          : non fourni — clarte, texture, nettete, grain et');
    console.log('                  vignetage du preset ne seront PAS reproduits.');
}
/*
 * CE QUI NE SERA PAS REPRODUIT FIDELEMENT — ajoute le 2026-08-19.
 *
 * La couleur est exacte par construction (elle est mesuree sur la grille RVB).
 * Les effets spatiaux, eux, sont recopies dans un moteur dont on connait
 * maintenant les limites, reglage par reglage
 * (`docs/lightroom/5-audit-fiabilite-2026-08-19.md`). Les taire reviendrait a
 * livrer un preset faux qui a l'air juste: c'est le seul mode de panne que ce
 * chantier n'a pas le droit de laisser passer.
 *
 * On verifie les valeurs FINALES, pas celles du `.xmp`: un relevé passé en
 * ligne de commande (`--dehaze 40`) prime sur le fichier et compte autant.
 */
const alertes = verifierDomaineSpatial(spatial, xmp?.raw || null);
if (alertes.length) {
    console.log('\n  ATTENTION — ce que notre moteur ne rend PAS comme Lightroom :');
    for (const alerte of alertes) console.log(`      - ${alerte}`);
    console.log('  Juge ce preset a l\'oeil sur une vraie photo avant de t\'en servir :');
    console.log('      node scripts/planche-showcase.mjs');
}

console.log(`\nPresets enregistres : ${sorted.join(', ')}`);
console.log('\nVerifie avec :  npm run test:vision-preset\n');
