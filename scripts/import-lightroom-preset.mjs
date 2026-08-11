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
} from '../src/features/vibefx-studio/utils/haldClut.js';
import { parseXmpPreset } from '../src/features/vibefx-studio/utils/xmpPreset.js';

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

if (meta.width !== expectedSize || meta.height !== expectedSize) {
    fail(
        `la mire fait ${meta.width}x${meta.height}, or un niveau ${level} attend ${expectedSize}x${expectedSize}.`,
        'C\'est presque toujours un redimensionnement a l\'export. Dans Lightroom, exporte en\n'
        + '« taille d\'origine », sans redimensionnement ni nettete de sortie.\n'
        + `Si tu as genere la mire a un autre niveau, precise-le avec --level.`,
    );
}

const { data: pixels } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });

const deviation = measureHaldDeviation(pixels, level);
if (deviation.max <= 1) {
    fail(
        'cette mire est identique a la mire neutre : aucun preset ne lui a ete applique.',
        'Dans Lightroom, verifie que le preset est bien actif sur l\'image AVANT d\'exporter.',
    );
}

const lut = haldToLut3d(pixels, level, LUT_SIZE);

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
console.log(`\nPresets enregistres : ${sorted.join(', ')}`);
console.log('\nVerifie avec :  npm run test:vision-preset\n');
