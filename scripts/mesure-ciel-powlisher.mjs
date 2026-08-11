/*
 * La regle du ciel de powlisher, mesuree — et le score des presets face a elle.
 *
 * Pourquoi un outil de plus : `audit-vision-presets.mjs` mesure des couleurs
 * choisies, `compare-vision-presets-on-photos.mjs` mesure des familles de
 * teintes sur une photo entiere. Aucun des deux ne repond a la question qui
 * decide de V2 : « que devient LE CIEL, y compris les pixels que le preset
 * desature jusqu'au blanc ? »
 *
 * C'est exactement la ou les deux mesures precedentes se sont trompees (voir
 * docs/lightroom/corpus-powlisher/README.md) : en ne comptant que les pixels
 * restes bleus, on effacait de la mesure ceux qui partent au blanc — c'est-a-dire
 * l'essentiel d'un ciel voile. Ici, la part partie au blanc est mesuree ET
 * affichee a cote de la teinte : c'est la seule facon de ne pas se refaire
 * prendre.
 *
 * ZONE CLAIRE : les 45 % du haut du cadre, pixels de luminosite >= 0.55. C'est
 * une approximation du ciel qui ne suppose aucune segmentation, donc
 * reproductible. Elle ramene les chiffres publies dans le README du corpus
 * (img32 95 % de blanc, img16 1 %, teintes a +-1.5 deg pres).
 *
 * SATURATION : `(max - min) / max`, la meme que `compare-vision-presets...`.
 * Ce n'est pas celle de HSL : sur un pixel clair, HSL gonfle la saturation d'un
 * gris a peine teinte (un ciel pale y sort a 0.36 quand l'oeil voit du blanc).
 * Toutes les cibles du corpus sont exprimees dans cette mesure-ci.
 *
 *   node scripts/mesure-ciel-powlisher.mjs            # le corpus, par groupe
 *   node scripts/mesure-ciel-powlisher.mjs --paire    # img47 -> img48 + presets
 */

import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import { VISION_PRESETS, getPresetLut } from '../src/features/vibefx-studio/utils/visionPresets.js';

const DIR = 'docs/lightroom/corpus-powlisher';

/* Groupes de lumiere : le controle qui manquait quand une seule photo decidait. */
const GROUPES = [
    ['ciel franc', [16, 18, 35, 36, 37, 40, 45]],
    ['ciel voile', [13, 32, 33]],
    ['heure doree', [11, 39, 41, 43, 46]],
    ['nuit', [28, 29, 30, 31]],
];

const ZONE_TOP = 0.45;
const ZONE_LUM = 0.55;
const SEUIL_BLANC = 0.10;

function fichier(id) {
    const suffixe = id === 47 || id === 48 ? 'paire' : 'reference';
    return `${DIR}/img${String(id).padStart(2, '0')}-${suffixe}.jpg`;
}

function hsv(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = d / max;
    let h;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
    return [h, s, l];
}

const mediane = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};

/* Les pixels de la zone claire, echantillonnes une fois et reutilises. */
async function zoneClaire(file) {
    const { data, info } = await sharp(file).rotate().removeAlpha().raw()
        .toBuffer({ resolveWithObject: true });
    const rows = Math.floor(info.height * ZONE_TOP);
    const pixels = [];
    for (let y = 0; y < rows; y += 2) {
        for (let x = 0; x < info.width; x += 2) {
            const i = (y * info.width + x) * 3;
            const [, , l] = hsv(data[i], data[i + 1], data[i + 2]);
            if (l >= ZONE_LUM) pixels.push(data[i], data[i + 1], data[i + 2]);
        }
    }
    return new Uint8Array(pixels);
}

/*
 * La mesure. `blanc` est la part de la zone claire partie sous le seuil : c'est
 * elle qui distingue « il laisse le ciel partir au blanc » de « il le tient en
 * teal », et c'est elle qu'on oubliait.
 */
function mesurer(rgb) {
    const n = rgb.length / 3;
    if (!n) return null;
    let blanc = 0;
    const hues = [];
    const sats = [];
    for (let i = 0; i < rgb.length; i += 3) {
        const [h, s] = hsv(rgb[i], rgb[i + 1], rgb[i + 2]);
        if (s < SEUIL_BLANC) { blanc += 1; continue; }
        if (h >= 150 && h <= 270) { hues.push(h); sats.push(s); }
    }
    return {
        n,
        blanc: (100 * blanc) / n,
        hue: mediane(hues),
        sat: mediane(sats),
        bleus: (100 * hues.length) / n,
    };
}

function applique(presetId, rgb) {
    const data = new Uint8ClampedArray((rgb.length / 3) * 4);
    for (let k = 0; k < rgb.length / 3; k += 1) {
        data[k * 4] = rgb[k * 3];
        data[k * 4 + 1] = rgb[k * 3 + 1];
        data[k * 4 + 2] = rgb[k * 3 + 2];
        data[k * 4 + 3] = 255;
    }
    applyLut3dToData(data, getPresetLut(presetId), LUT_SIZE, 1);
    const out = new Uint8Array(rgb.length);
    for (let k = 0; k < rgb.length / 3; k += 1) {
        out[k * 3] = data[k * 4];
        out[k * 3 + 1] = data[k * 4 + 1];
        out[k * 3 + 2] = data[k * 4 + 2];
    }
    return out;
}

const ligne = (nom, m) => `  ${nom.padEnd(24)} `
    + `blanc ${m.blanc.toFixed(0).padStart(3)} %`
    + `   teinte ${m.hue === null ? '    -  ' : `${m.hue.toFixed(1).padStart(6)}°`}`
    + `   sat ${m.sat === null ? '  -  ' : m.sat.toFixed(2).padStart(5)}`;

/* ---------- mode paire : la seule verite terrain ---------- */

async function modePaire() {
    for (const id of [47, 48]) {
        if (!existsSync(fichier(id))) {
            console.error(`\nManque ${fichier(id)} — lancer node scripts/fetch-powlisher-corpus.mjs\n`);
            process.exit(1);
        }
    }

    const brut = await zoneClaire(fichier(47));
    const sien = await zoneClaire(fichier(48));

    console.log('\nLA PAIRE — img47 (son brut iPhone) -> img48 (son edit final)');
    console.log('Ciel pale et couvert. C\'est le seul endroit ou on connait son entree ET sa sortie.\n');
    console.log(ligne('son brut (img47)', mesurer(brut)));
    console.log(ligne('SA CIBLE (img48)', mesurer(sien)));
    console.log('');
    for (const preset of VISION_PRESETS) {
        console.log(ligne(`${preset.id} sur son brut`, mesurer(applique(preset.id, brut))));
    }
    console.log('\nLire : sur ce ciel-la, il DESATURE (part au blanc qui monte fort) sans');
    console.log('tourner au cyan. Un preset qui garde la saturation et tombe sous 190° rate sa regle.\n');
}

/* ---------- mode corpus : ou ses couleurs atterrissent ---------- */

async function modeCorpus() {
    console.log('\nLE CORPUS — ou le ciel de ses photos ATTERRIT (ce sont deja ses edits).');
    console.log(`Zone claire = ${ZONE_TOP * 100} % du haut, luminosite >= ${ZONE_LUM}. Blanc = saturation < ${SEUIL_BLANC}.\n`);

    for (const [nom, ids] of GROUPES) {
        console.log(`${nom}`);
        const dispo = ids.filter((id) => existsSync(fichier(id)));
        if (!dispo.length) { console.log('  (aucune photo trouvee)\n'); continue; }
        for (const id of dispo) {
            const m = mesurer(await zoneClaire(fichier(id)));
            if (m) console.log(ligne(`img${id}`, m));
        }
        console.log('');
    }

    console.log('Sa regle, lisible en deux lignes du tableau :');
    console.log('  ciel voile -> il le laisse partir au BLANC (75-95 %), sans le rendre bleu.');
    console.log('  ciel franc -> teal tenu a 188-199°, saturation forte (0.32-0.49).\n');
}

if (process.argv.includes('--paire')) await modePaire();
else await modeCorpus();
