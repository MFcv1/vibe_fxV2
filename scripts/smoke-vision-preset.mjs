/*
 * Smoke test du preset Vision « Powlisher ».
 *
 * Il verifie les neuf cibles chiffrees de `docs/audit-preset-powlisher-2026-08-11.md`
 * (section 7), mesurees sur 19 photos de @powl_d. Ce sont les memes mesures que
 * celles de l'audit, rejouees sur la fonction du preset: si quelqu'un retouche
 * une courbe ou une bande de teinte et casse le rendu, ca se voit ici.
 *
 * Il verifie aussi que la LUT 3D reproduit bien la fonction pure: c'est le point
 * ou une erreur d'indexation passerait sinon inapercue.
 */

import {
    VISION_PRESETS,
    VISION_PRESET_BY_ID,
    getPresetLut,
    getPresetTransform,
} from '../src/features/vibefx-studio/utils/visionPresets.js';
import { readFileSync } from 'node:fs';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import {
    buildHaldIdentity,
    haldImageSize,
    haldToLut3d,
    lutFromBase64,
    lutToBase64,
    measureHaldDeviation,
} from '../src/features/vibefx-studio/utils/haldClut.js';
import { parseXmpPreset, verifierDomaineSpatial } from '../src/features/vibefx-studio/utils/xmpPreset.js';
import { visionBoundsFor } from '../src/features/vibefx-studio/utils/visionColorScience.js';
import {
    applyDegradeBas,
    applyFusedPixelOps,
    applyLightroomAutoTone,
    applyLightroomVignette,
} from '../src/features/vibefx-studio/utils/canvasUtils.js';
import {
    buildPresetCollections,
    filterAndGroupPresets,
    resolvePresetCollection,
} from '../src/features/vibeos/vision/presetCollections.js';
import {
    GRAIN_ATTENUATION,
    GRAIN_NOISE_TABLE,
    grainPoserDelta,
    grainEchelle,
    grainGrosseurCalibree,
    grainGrosseurCible,
    grainPourRendu,
    grainSigma,
    grainTransfertDecode,
    grainValeurEn,
    grainTransfertEncode,
} from '../src/features/vibefx-studio/utils/grainField.js';

let failures = 0;
const results = [];

function check(label, value, min, max, unit = '') {
    const ok = value >= min && value <= max;
    if (!ok) failures += 1;
    results.push({ ok, label, value, min, max, unit });
}

/* ---------- utilitaires couleur (independants du module teste) ---------- */

function hslToRgb(h, s, l) {
    if (s <= 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hk = (((h % 360) + 360) % 360) / 360;
    const f = (t) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };
    return [f(hk + 1 / 3), f(hk), f(hk - 1 / 3)];
}

function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    return [h, s, l];
}

const transform = getPresetTransform('powlisher');
if (!transform) {
    console.error('ECHEC: preset « powlisher » introuvable.');
    process.exit(1);
}

/* ---------- 1. rampe neutre ---------- */

const neutral = (l) => {
    const out = transform([l, l, l]);
    return { rg: (out[0] - out[1]) * 255, bg: (out[2] - out[1]) * 255, out };
};

const deepShadow = neutral(0.05);
check('neutres L0-10% : R-G ~ 0', deepShadow.rg, -1, 1);
check('neutres L0-10% : B-G ~ 0', deepShadow.bg, -1, 1);

const midR = [neutral(0.45).rg, neutral(0.55).rg];
check('neutres L40-60% : R-G (olive)', Math.min(...midR), -6, -3);

const highB = neutral(0.72).bg;
check('neutres L70-75% : B-G (creme)', highB, -14, -10);

/* ---------- 2. placement des teintes ---------- */

const probe = (h, s, l) => rgbToHsl(...transform(hslToRgb(h, s, l)));

const skies = [probe(205, 0.45, 0.65), probe(215, 0.55, 0.55), probe(230, 0.65, 0.45)];
check('ciel : teinte min', Math.min(...skies.map((p) => p[0])), 178, 192);
check('ciel : teinte max', Math.max(...skies.map((p) => p[0])), 178, 196);

const foliage = [probe(105, 0.5, 0.38), probe(115, 0.45, 0.42)];
check('feuillage : teinte', Math.min(...foliage.map((p) => p[0])), 85, 105);
check('feuillage : saturation', Math.max(...foliage.map((p) => p[1])), 0, 0.35);

const skin = [probe(25, 0.4, 0.65), probe(28, 0.45, 0.45)];
check('peau : teinte min', Math.min(...skin.map((p) => p[0])), 27, 36);
check('peau : teinte max', Math.max(...skin.map((p) => p[0])), 27, 36);
check('peau : saturation', Math.max(...skin.map((p) => p[1])), 0.31, 0.55);

/* ---------- 3. hautes lumieres et noirs ---------- */

/*
 * Hautes lumieres cremeuses.
 *
 * L'audit mesure S ~ 0.06 a 90-95% de luminance, mais c'est une MOYENNE sur tous
 * les pixels de la bande, tres majoritairement neutres. Redemander ce chiffre a
 * une sonde volontairement saturee n'aurait aucun sens: en HSL, la saturation
 * explose quand la luminance approche 1, et un ecart R/B de 4/255 suffit deja a
 * la faire monter a 0.19. On teste donc les deux choses qui, elles, sont
 * intrinseques au preset:
 *   - une haute lumiere presque neutre le reste,
 *   - une couleur perd une part nette de sa saturation en montant.
 */
const brightNeutralSat = probe(40, 0.12, 0.92)[1];
check('haute lumiere neutre reste neutre', brightNeutralSat, 0, 0.16);

const satMid = probe(40, 0.35, 0.50)[1];
const satHigh = probe(40, 0.35, 0.92)[1];
check('perte de saturation en montant', satHigh / satMid, 0, 0.70, ' ratio');

const white = transform([1, 1, 1]);
check('point blanc sous 255', Math.max(...white) * 255, 235, 254.4);

const black = transform([0, 0, 0]);
check('noirs denses (pas de matte)', Math.max(...black) * 255, 0, 3);

/* ---------- 4. la LUT reproduit la fonction pure ---------- */

const lut = getPresetLut('powlisher');
if (!lut) {
    console.error('ECHEC: LUT « powlisher » non compilee.');
    process.exit(1);
}
check('taille de la LUT', lut.length, LUT_SIZE ** 3 * 3, LUT_SIZE ** 3 * 3);

let maxDelta = 0;
const samples = [];
for (let i = 0; i < 512; i += 1) {
    /* Echantillonnage deterministe, hors des nœuds de la grille pour que
       l'interpolation trilineaire soit reellement sollicitee. */
    const r = ((i * 37) % 251) / 250;
    const g = ((i * 91) % 251) / 250;
    const b = ((i * 143) % 251) / 250;
    samples.push([r, g, b]);
}
const data = new Uint8ClampedArray(samples.length * 4);
samples.forEach(([r, g, b], i) => {
    data[i * 4] = Math.round(r * 255);
    data[i * 4 + 1] = Math.round(g * 255);
    data[i * 4 + 2] = Math.round(b * 255);
    data[i * 4 + 3] = 255;
});
applyLut3dToData(data, lut, LUT_SIZE, 1);
samples.forEach(([r, g, b], i) => {
    const expected = transform([r, g, b]);
    for (let c = 0; c < 3; c += 1) {
        maxDelta = Math.max(maxDelta, Math.abs(expected[c] * 255 - data[i * 4 + c]));
    }
});
check('ecart LUT vs fonction pure', maxDelta, 0, 4, '/255');

/* L'identite doit rester l'identite quand l'intensite vaut 0. */
const untouched = new Uint8ClampedArray([12, 200, 77, 255]);
applyLut3dToData(untouched, lut, LUT_SIZE, 0);
check('intensite 0 = image intacte', Math.abs(untouched[1] - 200), 0, 0);

/* ---------- 5. le registre ---------- */

check('au moins un preset expose', VISION_PRESETS.length, 1, 999);
/* Un preset est valide s'il sait produire une LUT, par l'un des deux chemins:
   une fonction pure ecrite a la main, ou une table importee de Lightroom. */
const malformed = VISION_PRESETS.filter(
    (p) => !p.id || !p.label
        || (typeof p.transform !== 'function' && typeof p.getLut !== 'function'),
);
check('presets complets (id/label/table)', malformed.length, 0, 0);
/* Chaque preset declare doit reellement produire une LUT de la bonne taille. */
const badLut = VISION_PRESETS.filter((p) => {
    const table = getPresetLut(p.id);
    return !table || table.length !== LUT_SIZE ** 3 * 3;
});
check('chaque preset produit sa LUT', badLut.length, 0, 0);

/* La famille Premium Adobe « Style : cinéma II » va de CN11 à CN18. */
const cinema = ['cn01', 'cn02', 'cn03', 'cn04', 'cn05', 'cn06', 'cn07', 'cn08', 'cn09', 'cn10'];
const cinemaMissing = cinema.filter((id) => !VISION_PRESET_BY_ID[id]);
check('cinéma : CN01 à CN10 présents', cinemaMissing.length, 0, 0);
const cinemaBadNoiseReduction = cinema.slice(1).filter((id) => {
    const spatial = VISION_PRESET_BY_ID[id]?.spatialFilters;
    return spatial?.sharpness !== 40
        || spatial?.noiseReductionLuminance !== 20
        || spatial?.noiseReductionColor !== 50;
});
check('cinéma : CN02 à CN10 portent la matière Lightroom 40/20/50', cinemaBadNoiseReduction.length, 0, 0);

const cinemaII = ['cn11', 'cn12', 'cn13', 'cn14', 'cn15', 'cn16', 'cn17', 'cn18'];
const cinemaIIMissing = cinemaII.filter((id) => !VISION_PRESET_BY_ID[id]);
check('cinéma II : CN11 à CN18 présents', cinemaIIMissing.length, 0, 0);
const cinemaIIBadNoiseReduction = cinemaII.filter((id) => {
    const spatial = VISION_PRESET_BY_ID[id]?.spatialFilters;
    return spatial?.noiseReductionLuminance !== 20 || spatial?.noiseReductionColor !== 50;
});
check('cinéma II : réduction du bruit Lightroom 20/50 relevée partout', cinemaIIBadNoiseReduction.length, 0, 0);
const presetCollections = buildPresetCollections(VISION_PRESETS);
const cinemaCollection = presetCollections.find((item) => item.id === 'cinema');
const cinemaIICollection = presetCollections.find((item) => item.id === 'cinema-ii');
const importedCollectionCounts = {
    futuriste: 12,
    'inspire-d-un-film': 12,
    'noir-et-blanc': 12,
    vintage: 10,
    'architecture-urbaine': 10,
    paysage: 10,
    'style-de-vie': 8,
    voyage: 10,
    'voyage-ii': 8,
    printemps: 12,
    ete: 11,
    automne: 12,
    hiver: 10,
    'portrait-peau-foncee': 15,
    'portrait-peau-intermediaire': 11,
    'portrait-peau-claire': 11,
    'portrait-audacieux': 12,
    'portrait-groupe': 8,
    'portrait-noir-et-blanc': 12,
    'auto-retro': 11,
};
check('bibliothèque : collection Cinéma complète', cinemaCollection?.count ?? -1, 10, 10);
check('bibliothèque : collection Cinéma II complète', cinemaIICollection?.count ?? -1, 8, 8);
check('bibliothèque : 261 presets exposés', VISION_PRESETS.length, 261, 261);
for (const [collectionId, expectedCount] of Object.entries(importedCollectionCounts)) {
    const collection = presetCollections.find((item) => item.id === collectionId);
    check(
        `bibliothèque : collection ${collection?.label || collectionId} complète`,
        collection?.count ?? -1,
        expectedCount,
        expectedCount,
    );
}
check(
    'bibliothèque : Cinéma précède Cinéma II',
    presetCollections.findIndex((item) => item.id === 'cinema')
        < presetCollections.findIndex((item) => item.id === 'cinema-ii') ? 1 : 0,
    1,
    1,
);
check(
    'bibliothèque : aucun preset ne reste dans Imports',
    presetCollections.some((item) => item.id === 'imports') ? 1 : 0,
    0,
    0,
);
check(
    'bibliothèque : un import peut déclarer sa collection',
    resolvePresetCollection({ collection: { id: 'portrait', label: 'Portraits' } }).id === 'portrait' ? 1 : 0,
    1,
    1,
);
const searchedCinemaII = filterAndGroupPresets(VISION_PRESETS, { collectionId: 'cinema-ii', query: 'CN17' });
check('bibliothèque : filtre collection + recherche', searchedCinemaII[0]?.presets.length ?? 0, 1, 1);

/* Les presets Style : Noir et blanc doivent embarquer la conversion N&B dans
   leur Hald. Une capture faite sans appliquer réellement le preset laisse les
   couleurs d'origine intactes : c'est précisément la régression vue le
   2026-08-31. On sonde plusieurs couleurs très saturées ; les virages sépia,
   rose, vert ou bleu restent autorisés, mais jamais une chroma de photo couleur. */
const bwIds = Array.from({ length: 12 }, (_, index) => `bw${String(index + 1).padStart(2, '0')}`);
const bwColorProbes = [
    [230, 40, 30], [30, 210, 50], [30, 80, 230],
    [230, 210, 30], [210, 30, 200], [30, 220, 220],
];
const bwTooColorful = bwIds.filter((id) => {
    const table = getPresetLut(id);
    if (!table) return true;
    return bwColorProbes.some((probeRgb) => {
        const pixel = new Uint8ClampedArray([...probeRgb, 255]);
        applyLut3dToData(pixel, table, LUT_SIZE, 1);
        return Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2]) > 40;
    });
});
check('BW01 à BW12 : aucune couleur d’origine ne traverse la LUT', bwTooColorful.length, 0, 0);

const bwNeutral = (id) => {
    const pixel = new Uint8ClampedArray([128, 128, 128, 255]);
    applyLut3dToData(pixel, getPresetLut(id), LUT_SIZE, 1);
    return pixel;
};
const bw01Neutral = bwNeutral('bw01');
const bw02Neutral = bwNeutral('bw02');
const bw03Neutral = bwNeutral('bw03');
const bw04Neutral = bwNeutral('bw04');
const bw11Neutral = bwNeutral('bw11');
const bw12Neutral = bwNeutral('bw12');
check('BW01 : neutre gris', Math.max(...bw01Neutral.slice(0, 3)) - Math.min(...bw01Neutral.slice(0, 3)), 0, 2);
check('BW02 : virage sépia', bw02Neutral[0] - bw02Neutral[2], 15, 35);
check('BW03 : virage rosé', bw03Neutral[0] - bw03Neutral[2], 20, 40);
check('BW04 : virage vert', bw04Neutral[1] - bw04Neutral[2], 12, 30);
check('BW11 : virage brun chaud', bw11Neutral[0] - bw11Neutral[2], 8, 20);
check('BW12 : virage bleu', bw12Neutral[2] - bw12Neutral[0], 15, 35);

/* Une Hald ne peut pas capturer un effet qui dépend de la position ou des
   pixels voisins. Les XMP Premium embarqués dans Lightroom sont donc la source
   de vérité. BW01 à BW12 ne déclarent aucun PostCropVignetteAmount. */
const bwSpatial = Object.fromEntries(
    bwIds.map((id) => [id, VISION_PRESET_BY_ID[id]?.spatialFilters || {}]),
);
check(
    'BW01 à BW12 : aucun vignettage absent des XMP Adobe',
    bwIds.filter((id) => (
        !Object.hasOwn(bwSpatial[id], 'vignette')
        && !Object.hasOwn(bwSpatial[id], 'vignetteLightroomV2')
    )).length,
    12,
    12,
);
check(
    'BW01 à BW09 : aucun grain Lightroom',
    bwIds.slice(0, 9).filter((id) => bwSpatial[id].grain === 0).length,
    9,
    9,
);
check(
    'BW10 à BW12 : grain Lightroom 75/10/60',
    bwIds.slice(9).filter((id) => (
        bwSpatial[id].grain === 75
        && bwSpatial[id].grainSize === 10
        && bwSpatial[id].grainRoughness === 60
    )).length,
    3,
    3,
);
check(
    'BW01 à BW04 : clarté et texture -10',
    bwIds.slice(0, 4).filter((id) => (
        bwSpatial[id].clarity === -10 && bwSpatial[id].texture === -10
    )).length,
    4,
    4,
);
check(
    'BW05 à BW06 : clarté +10 sans texture',
    bwIds.slice(4, 6).filter((id) => (
        bwSpatial[id].clarity === 10 && bwSpatial[id].texture === 0
    )).length,
    2,
    2,
);
check(
    'BW07 à BW09 : texture +20 sans clarté ni voile',
    bwIds.slice(6, 9).filter((id) => (
        bwSpatial[id].clarity === 0
        && bwSpatial[id].texture === 20
        && bwSpatial[id].dehaze === 0
    )).length,
    3,
    3,
);

const vintageIds = Array.from({ length: 10 }, (_, index) => `vn${String(index + 1).padStart(2, '0')}`);
const vintageSpatial = Object.fromEntries(
    vintageIds.map((id) => [id, VISION_PRESET_BY_ID[id]?.spatialFilters || {}]),
);
check(
    'Vintage VN01/03/04/05/06/07 : grain Adobe 22/17/50',
    ['vn01', 'vn03', 'vn04', 'vn05', 'vn06', 'vn07'].filter((id) => (
        vintageSpatial[id].grain === 22
        && vintageSpatial[id].grainSize === 17
        && vintageSpatial[id].grainRoughness === 50
    )).length,
    6,
    6,
);
check(
    'Vintage VN02/VN10 : grain Adobe 18/16/50',
    ['vn02', 'vn10'].filter((id) => (
        vintageSpatial[id].grain === 18
        && vintageSpatial[id].grainSize === 16
        && vintageSpatial[id].grainRoughness === 50
    )).length,
    2,
    2,
);
check(
    'Vintage VN08/VN09 : grain Adobe 27/17/50',
    ['vn08', 'vn09'].filter((id) => (
        vintageSpatial[id].grain === 27
        && vintageSpatial[id].grainSize === 17
        && vintageSpatial[id].grainRoughness === 50
    )).length,
    2,
    2,
);
check(
    'Vintage VN06 : texture -15 et correction du voile +14',
    vintageSpatial.vn06.texture === -15 && vintageSpatial.vn06.dehaze === 14 ? 1 : 0,
    1,
    1,
);

check('CN12 : Netteté Lightroom relevée', VISION_PRESET_BY_ID.cn12?.spatialFilters?.sharpness ?? -1, 40, 40);
check('CN15 : Netteté Lightroom relevée', VISION_PRESET_BY_ID.cn15?.spatialFilters?.sharpness ?? -1, 40, 40);
check('CN18 : Grain Lightroom relevé', VISION_PRESET_BY_ID.cn18?.spatialFilters?.grain ?? -1, 20, 20);
check('CN18 : Taille du grain relevée', VISION_PRESET_BY_ID.cn18?.spatialFilters?.grainSize ?? -1, 40, 40);
check('CN18 : Cassure du grain relevée', VISION_PRESET_BY_ID.cn18?.spatialFilters?.grainRoughness ?? -1, 50, 50);
check('CN18 : Netteté Lightroom relevée', VISION_PRESET_BY_ID.cn18?.spatialFilters?.sharpness ?? -1, 40, 40);

/* ---------- 6. import Lightroom : Hald CLUT ---------- */

/*
 * La chaine d'import doit tenir un aller-retour exact: une mire neutre passee
 * dans un preset puis relue doit redonner ce preset. C'est la garantie que
 * `import-lightroom-preset.mjs` ne produira pas un preset faux en silence.
 */
const HALD_LEVEL = 6; /* cube 36 — assez pour tester, rapide */
const identity = buildHaldIdentity(HALD_LEVEL);
check('mire Hald : taille image', identity.size, haldImageSize(HALD_LEVEL), haldImageSize(HALD_LEVEL));
check('mire Hald : octets', identity.data.length, identity.cube ** 3 * 3, identity.cube ** 3 * 3);

/* Une mire neutre relue doit redonner l'identite. */
const identityLut = haldToLut3d(identity.data, HALD_LEVEL, LUT_SIZE);
let identityError = 0;
for (let i = 0; i < identityLut.length; i += 3) {
    const cell = i / 3;
    const r = cell % LUT_SIZE;
    const g = Math.floor(cell / LUT_SIZE) % LUT_SIZE;
    const b = Math.floor(cell / (LUT_SIZE * LUT_SIZE));
    identityError = Math.max(identityError, Math.abs(identityLut[i] - (r / (LUT_SIZE - 1)) * 255));
    identityError = Math.max(identityError, Math.abs(identityLut[i + 1] - (g / (LUT_SIZE - 1)) * 255));
    identityError = Math.max(identityError, Math.abs(identityLut[i + 2] - (b / (LUT_SIZE - 1)) * 255));
}
check('mire neutre relue = identite', identityError, 0, 2, '/255');

/* Une mire neutre doit etre detectee comme « preset non applique ». */
check('mire neutre detectee comme telle', measureHaldDeviation(identity.data, HALD_LEVEL).max, 0, 1);

/* Aller-retour complet: on applique le preset a la mire, on relit, on compare. */
const processed = new Uint8Array(identity.data.length);
const haldPixel = [0, 0, 0];
for (let i = 0; i < identity.data.length; i += 3) {
    haldPixel[0] = identity.data[i] / 255;
    haldPixel[1] = identity.data[i + 1] / 255;
    haldPixel[2] = identity.data[i + 2] / 255;
    const out = transform(haldPixel);
    processed[i] = Math.round(Math.max(0, Math.min(1, out[0])) * 255);
    processed[i + 1] = Math.round(Math.max(0, Math.min(1, out[1])) * 255);
    processed[i + 2] = Math.round(Math.max(0, Math.min(1, out[2])) * 255);
}
check('mire traitee detectee comme traitee', measureHaldDeviation(processed, HALD_LEVEL).max, 2, 255);

const importedLut = haldToLut3d(processed, HALD_LEVEL, LUT_SIZE);
let roundTripMax = 0;
for (let i = 0; i < lut.length; i += 1) {
    roundTripMax = Math.max(roundTripMax, Math.abs(lut[i] - importedLut[i]));
}
check('aller-retour Hald -> LUT', roundTripMax, 0, 12, '/255');

/* La LUT doit survivre au passage en base64 (c'est ainsi qu'elle est stockee). */
const decoded = lutFromBase64(lutToBase64(lut));
let base64Error = 0;
for (let i = 0; i < lut.length; i += 1) {
    base64Error = Math.max(base64Error, Math.abs(lut[i] - decoded[i]));
}
check('LUT intacte apres base64', base64Error, 0, 0);

/* ---------- 7. import Lightroom : lecture du .xmp ---------- */

const sampleXmp = `<?xpacket begin="\ufeff"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   crs:Contrast2012="-50"
   crs:Highlights2012="-30"
   crs:Clarity2012="20"
   crs:Texture="10"
   crs:LuminanceSmoothing="20"
   crs:ColorNoiseReduction="50"
   crs:GrainAmount="24"
   crs:GrainSize="40"
   crs:GrainFrequency="0"
   crs:Dehaze="-10"
   crs:PostCropVignetteAmount="-40"
   crs:PostCropVignetteMidpoint="35"
   crs:PostCropVignetteRoundness="20"
   crs:PostCropVignetteFeather="70"
   crs:PostCropVignetteHighlightContrast="15"
   crs:HueAdjustmentBlue="-38"
   crs:SaturationAdjustmentGreen="-55">
   <crs:Name><rdf:Alt><rdf:li xml:lang="x-default">CN11</rdf:li></rdf:Alt></crs:Name>
   <crs:Group><rdf:Alt><rdf:li xml:lang="x-default">Cinéma II</rdf:li></rdf:Alt></crs:Group>
   <crs:ToneCurvePV2012>
    <rdf:Seq><rdf:li>0, 0</rdf:li><rdf:li>128, 132</rdf:li><rdf:li>255, 243</rdf:li></rdf:Seq>
   </crs:ToneCurvePV2012>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>`;

const parsed = parseXmpPreset(sampleXmp);
check('.xmp : nom lu', parsed.name === 'CN11' ? 1 : 0, 1, 1);
check('.xmp : groupe lu', parsed.group === 'Cinéma II' ? 1 : 0, 1, 1);
check('.xmp : contraste', parsed.basic.contrast, -50, -50);
check('.xmp : hautes lumières', parsed.basic.highlights, -30, -30);
check('.xmp : teinte du bleu', parsed.hsl.blue.hue, -38, -38);
check('.xmp : saturation du vert', parsed.hsl.green.saturation, -55, -55);
check('.xmp : courbe maître', parsed.curves.master?.length || 0, 3, 3);
/* Les reglages spatiaux sont le vrai apport du .xmp: une Hald CLUT ne les voit pas. */
check('.xmp : grain transposé', parsed.spatialFilters.grain || 0, 1, 60);
check('.xmp : vignetage transposé', parsed.spatialFilters.vignette || 0, 1, 60);
check('.xmp : voile négatif transposé', parsed.spatialFilters.dehaze, -10, -10);
check('.xmp : milieu du vignetage transposé', parsed.spatialFilters.vignetteMidpoint, 35, 35);
check('.xmp : arrondi du vignetage transposé', parsed.spatialFilters.vignetteRoundness, 20, 20);
check('.xmp : contour du vignetage transposé', parsed.spatialFilters.vignetteFeather, 70, 70);
check('.xmp : hautes lumières du vignetage transposées', parsed.spatialFilters.vignetteHighlights, 15, 15);
check('.xmp : clarté transposée', parsed.spatialFilters.clarity || 0, 1, 40);
check('.xmp : réduction de bruit luminance transposée', parsed.spatialFilters.noiseReductionLuminance || 0, 20, 20);
check('.xmp : réduction de bruit couleur transposée', parsed.spatialFilters.noiseReductionColor || 0, 50, 50);
check('.xmp : taille du grain transposée', parsed.spatialFilters.grainSize ?? -1, 40, 40);
check('.xmp : cassure du grain à zéro transposée', parsed.spatialFilters.grainRoughness ?? -1, 0, 0);
check('.xmp : résumé lisible', parsed.summary.length, 3, 99);

let rejected = 0;
try {
    parseXmpPreset('<xml>pas un preset</xml>');
} catch {
    rejected = 1;
}
check('.xmp : fichier invalide rejeté', rejected, 1, 1);

/* ---------- ce que l'import doit AVOUER (2026-08-19) ----------
 *
 * Deux reglages du .xmp etaient jetes en silence et trois autres recopies dans
 * des zones ou notre moteur s'ecarte du sien: un preset s'installait, la
 * couleur etait juste, et le rendu etait faux sans qu'une ligne le dise. Ces
 * verifications gardent l'aveu, pas la correction — le moteur, lui, n'a pas
 * change.
 */
check(
    'domaine : un preset sage ne declenche aucune alerte',
    verifierDomaineSpatial({ grain: 15, sharpness: 40, vignette: 12 }).length, 0, 0,
);
check(
    'domaine : vignetage POSITIF désormais pris en charge',
    verifierDomaineSpatial({ vignette: 25, vignetteLighten: true }, { PostCropVignetteAmount: '25' }).length, 0, 0,
);
check(
    'domaine : voile NEGATIF conserve mais controle visuel signale',
    verifierDomaineSpatial({ dehaze: -20 }, { Dehaze: '-20' }).length, 1, 1,
);
check(
    'domaine : voile positif signale (echelle non calibree)',
    verifierDomaineSpatial({ dehaze: 30 }).length, 1, 1,
);
check(
    'domaine : nettete >= 80 signalee',
    verifierDomaineSpatial({ sharpness: 100 }).length, 1, 1,
);
check(
    'domaine : texture signale le halo sur les aretes',
    verifierDomaineSpatial({ texture: 25 }).length, 1, 1,
);
check(
    'domaine : les alertes remontent par parseXmpPreset',
    Array.isArray(parsed.spatialAlertes) ? 1 : 0, 1, 1,
);

/* ---------- effets Lightroom qui ne doivent plus etre perdus ---------- */
const fakeContext = (pixels) => {
    let current = new Uint8ClampedArray(pixels);
    return {
        getImageData: () => ({ data: new Uint8ClampedArray(current) }),
        putImageData: (imageData) => { current = new Uint8ClampedArray(imageData.data); },
        pixels: () => current,
    };
};

const gray = [128, 128, 128, 255];
const fogContext = fakeContext(gray);
applyFusedPixelOps(fogContext, 1, 1, { safeSmartphone: false, dehaze: -10 });
check('voile negatif : il agit et eclaircit le gris', fogContext.pixels()[0], 129, 255);

const clearContext = fakeContext(gray);
applyFusedPixelOps(clearContext, 1, 1, { safeSmartphone: false, dehaze: 10 });
check('voile positif : il agit en sens inverse', clearContext.pixels()[0], 0, 127);

const vignetteSource = new Uint8ClampedArray(9 * 5 * 4);
for (let i = 0; i < vignetteSource.length; i += 4) {
    vignetteSource[i] = 192;
    vignetteSource[i + 1] = 192;
    vignetteSource[i + 2] = 192;
    vignetteSource[i + 3] = 255;
}
const implicitDefaults = fakeContext(vignetteSource);
const explicitDefaults = fakeContext(vignetteSource);
applyLightroomVignette(implicitDefaults, 9, 5, 40);
applyLightroomVignette(explicitDefaults, 9, 5, 40, {
    midpoint: 50, roundness: 0, feather: 50, highlights: 0,
});
let defaultDifference = 0;
for (let i = 0; i < vignetteSource.length; i += 1) {
    defaultDifference += Math.abs(implicitDefaults.pixels()[i] - explicitDefaults.pixels()[i]);
}
check('vignetage : les valeurs par defaut gardent le chemin historique exact', defaultDifference, 0, 0);

const shapedVignette = fakeContext(vignetteSource);
applyLightroomVignette(shapedVignette, 9, 5, 40, {
    midpoint: 35, roundness: 20, feather: 70, highlights: 15,
});
let shapedDifference = 0;
for (let i = 0; i < vignetteSource.length; i += 1) {
    shapedDifference += Math.abs(implicitDefaults.pixels()[i] - shapedVignette.pixels()[i]);
}
check('vignetage : les quatre sous-reglages modifient vraiment le rendu', shapedDifference, 1, Number.MAX_SAFE_INTEGER);

check('bornes : voile negatif LF03 accepte en mode sur', visionBoundsFor('dehaze').min, -30, -30);
check('saisons : texture negative TM03 conservee', VISION_PRESET_BY_ID.tm03?.spatialFilters?.texture, -30, -30);
check('saisons : clarte negative TM03 conservee', VISION_PRESET_BY_ID.tm03?.spatialFilters?.clarity, -30, -30);
check('saisons : vignette TM07 normalisee en force positive', VISION_PRESET_BY_ID.tm07?.spatialFilters?.vignette, 32, 32);
check('saisons : vignette positive SP01 garde son sens clair', VISION_PRESET_BY_ID.sp01?.spatialFilters?.vignetteLighten ? 1 : 0, 1, 1);
check('saisons : clarté TM03 utilise le profil photo Lightroom', VISION_PRESET_BY_ID.tm03?.spatialFilters?.presetClarityScale, 0.18, 0.18);
check('saisons : texture TM03 protège les arêtes', VISION_PRESET_BY_ID.tm03?.spatialFilters?.presetTextureEdgeAware ? 1 : 0, 1, 1);
check('saisons : clarte TM09 non tronquee', VISION_PRESET_BY_ID.tm09?.spatialFilters?.clarity, 35, 35);
check('bornes : vignette TM07 acceptee en mode sur', visionBoundsFor('vignette').max, 32, 32);
check('bornes : clarte TM09 acceptee en mode sur', visionBoundsFor('clarity').max, 35, 35);
check('portraits : clarte PB03 non tronquee', VISION_PRESET_BY_ID.pb03?.spatialFilters?.clarity, -33, -33);
check('portraits : voile PM11 non tronque', VISION_PRESET_BY_ID.pm11?.spatialFilters?.dehaze, 39, 39);
check('auto retro : les onze presets demandent le calcul adaptatif',
    Array.from({ length: 11 }, (_, i) => `ar${String(i + 1).padStart(2, '0')}`)
        .filter((id) => VISION_PRESET_BY_ID[id]?.spatialFilters?.presetAutoTone).length,
    11,
    11,
);
const autoToneContext = fakeContext(new Uint8ClampedArray([
    18, 20, 24, 255, 232, 228, 220, 255,
]));
applyLightroomAutoTone(autoToneContext, 2, 1);
check('auto retro : le calcul adaptatif agit sur une plage sombre/claire',
    autoToneContext.pixels().some((value, index) => index % 4 !== 3 && value !== [18, 20, 24, 232, 228, 220][index - Math.floor(index / 4)]) ? 1 : 0,
    1,
    1,
);
const saisonIds = [
    ...Array.from({ length: 12 }, (_, i) => `sp${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 11 }, (_, i) => `sm${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 12 }, (_, i) => `tm${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 10 }, (_, i) => `wn${String(i + 1).padStart(2, '0')}`),
];
check(
    'saisons : aucun grain Lightroom oublie sur les 45 presets',
    saisonIds.filter((id) => VISION_PRESET_BY_ID[id]?.spatialFilters?.grain !== 0).length,
    0,
    0,
);
check('bornes : milieu du vignetage expose', visionBoundsFor('vignetteMidpoint').neutre, 50, 50);

/* ---------- la clarte NEGATIVE, calee le 2026-08-19 ----------
 *
 * Elle n'avait ete mesuree qu'au positif. Son dosage lineaire donnait a -100
 * exactement l'image floue (amplification 0,012 contre 0,476 chez Lightroom).
 * On garde ici la LOI, lue dans le moteur: une regression rendrait a nouveau
 * un adoucissement destructeur, et aucune mesure de couleur ne le verrait.
 */
const canvasSource = readFileSync(
    new URL('../src/features/vibefx-studio/utils/canvasUtils.js', import.meta.url), 'utf8',
);
check('réduction du bruit : moteur spatial présent', /export function applyNoiseReduction\b/.test(canvasSource) ? 1 : 0, 1, 1);
const kNeg = Number(/CLARITY_K_NEG = ([\d.]+)/.exec(canvasSource)?.[1]);
const expNeg = Number(/CLARITY_EXPOSANT_NEG = ([\d.]+)/.exec(canvasSource)?.[1]);
check('clarté : le dosage négatif est une loi de puissance', Number.isFinite(kNeg) && Number.isFinite(expNeg) ? 1 : 0, 1, 1);
check('clarté : amplification à -50 (Lightroom 0,706)', 1 - kNeg * 50 ** expNeg, 0.68, 0.73);
check('clarté : amplification à -100 (Lightroom 0,496)', 1 - kNeg * 100 ** expNeg, 0.47, 0.53);
check(
    'clarté : le négatif applique bien la loi, pas la ligne',
    /clarity > 0[\s\S]{0,120}CLARITY_K_NEG/.test(canvasSource) ? 1 : 0, 1, 1,
);

/* ---------- powlisher-ciel : le ciel converge au lieu d'etre tourne ----------
 *
 * Trois choses a garder, et la troisieme est celle qui a coute une version.
 *
 *  1. Un ciel bleu atterrit dans SA fenetre (190-199°), au lieu de passer
 *     dessous dans le menthe comme le fait la rotation fixe de V1.
 *  2. Un ciel DEJA dans la fenetre n'est presque pas bouge — c'est ce qui
 *     distingue « placer une couleur » de « la pousser ».
 *  3. Aucune regle ne depend de la teinte d'un pixel qui n'en a plus. Dans un
 *     voile quasi blanc, la teinte est du bruit; une regle qui s'y fie trace un
 *     trait de contour en plein degrade. C'est ce qui est arrive a la version
 *     precedente, et ca ne se voyait dans AUCUNE moyenne — d'ou ce test.
 */

const ciel = getPresetTransform('powlisher-ciel');
if (!ciel) {
    console.error('ECHEC: preset « powlisher-ciel » introuvable.');
    process.exit(1);
}

const cielProbe = (h, s, l) => rgbToHsl(...ciel(hslToRgb(h, s, l)));
const chroma = ([r, g, b]) => {
    const max = Math.max(r, g, b);
    return max <= 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

/* 1. Un vrai ciel bleu tombe dans sa fenetre. Les trois sondes couvrent un ciel
   de bord de mer (205°), un ciel de plein midi (215°) et un bleu profond de
   zenith (230°) — sur la photo temoin, l'entree mesuree est a 214°. */
const cieux = [cielProbe(205, 0.55, 0.60), cielProbe(215, 0.60, 0.55), cielProbe(230, 0.65, 0.45)];
check('ciel : teinte min', Math.min(...cieux.map((p) => p[0])), 188, 199);
check('ciel : teinte max', Math.max(...cieux.map((p) => p[0])), 188, 202);
/* Et il garde sa couleur: converger n'est pas delaver. */
check('ciel : reste un bleu franc', Math.min(chroma(ciel(hslToRgb(215, 0.60, 0.55)))), 0.35, 1);

/* La ou V1 le pousse sous sa propre fenetre. C'est le defaut corrige, fige. */
const cielV1 = rgbToHsl(...transform(hslToRgb(215, 0.60, 0.55)));
check('V1 poussait le ciel trop bas', cielV1[0], 150, 188);
check('ciel : redresse vs V1', cielProbe(215, 0.60, 0.55)[0] - cielV1[0], 8, 40, '°');

/* 2. Un ciel deja pose dans sa fenetre ne doit presque plus bouger. */
for (const [nom, depart] of [['190°', 190], ['195°', 195], ['199°', 199]]) {
    const bouge = Math.abs(cielProbe(depart, 0.45, 0.62)[0] - depart);
    check(`ciel deja juste (${nom}) : ne bouge plus`, bouge, 0, 8, '°');
}

/*
 * 3. LE TEST DE L'ARTEFACT, et il vaut une explication parce qu'il est né d'un
 * bug qu'aucune moyenne n'attrapait.
 *
 * Le regime teste est celui d'un VOILE: des pixels quasi neutres (chroma 0,015 a
 * 0,05) dont la teinte bruite de 10 a 40° d'un pixel a l'autre. C'est ce qui se
 * passe reellement dans un ciel blanchi ou une brume d'horizon. Deux pixels que
 * l'oeil voit identiques doivent le rester en sortie: si le preset les separe
 * PLUS que l'entree ne les separait, il dessine un contour la ou la photo etait
 * lisse — le fameux trait diagonal de la version precedente.
 *
 * On mesure donc une amplification (ecart de sortie / ecart d'entree), et on la
 * compare a celle de `powlisher`, qui sert de plancher: la regle du ciel a le
 * droit d'exister, pas d'ajouter du contour.
 *
 *   powlisher                 3,03×   (jamais montre de trait)
 *   la version supprimee      7,32×   (le trait etait visible a l'ecran)
 */
function amplificationVoile(fn) {
    let max = 0;
    for (let l = 0.55; l <= 0.95; l += 0.05) {
        for (const s of [0.015, 0.03, 0.05]) {
            for (let h = 150; h <= 280; h += 5) {
                for (const ecartTeinte of [10, 20, 40]) {
                    const a = hslToRgb(h, s, l);
                    const b = hslToRgb(h + ecartTeinte, s, l);
                    const fa = fn(a);
                    const fb = fn(b);
                    let dIn = 0;
                    let dOut = 0;
                    for (let c = 0; c < 3; c += 1) {
                        dIn = Math.max(dIn, Math.abs(a[c] - b[c]) * 255);
                        dOut = Math.max(dOut, Math.abs(fa[c] - fb[c]) * 255);
                    }
                    if (dIn >= 1) max = Math.max(max, dOut / dIn);
                }
            }
        }
    }
    return max;
}
const voileV1 = amplificationVoile(transform);
const voileCiel = amplificationVoile(ciel);
check('voile : powlisher, niveau de reference', voileV1, 0, 4, '×');
check('voile : la regle du ciel n\'ajoute pas de contour', voileCiel - voileV1, 0, 0.3, '×');

/* 4. Hors du ciel, c'est powlisher au bit pres: on ajoute, on ne remplace pas. */
const horsCiel = [
    ['feuillage', [105, 0.50, 0.38]],
    ['feuillage clair', [115, 0.45, 0.42]],
    ['peau claire', [25, 0.40, 0.65]],
    ['peau matte', [28, 0.45, 0.45]],
    ['gris moyen', [0, 0, 0.50]],
    ['turquoise peu profond', [165, 0.45, 0.55]],
    ['rouge sombre', [8, 0.55, 0.25]],
];
let ecartHorsCiel = 0;
for (const [, [h, s, l]] of horsCiel) {
    const a = transform(hslToRgb(h, s, l));
    const b = ciel(hslToRgb(h, s, l));
    for (let c = 0; c < 3; c += 1) ecartHorsCiel = Math.max(ecartHorsCiel, Math.abs(a[c] - b[c]) * 255);
}
check('hors ciel = powlisher (vert/peau/gris)', ecartHorsCiel, 0, 0, '/255');

/* Les signatures communes tiennent. */
check('ciel : point blanc identique', Math.abs(Math.max(...ciel([1, 1, 1])) - Math.max(...white)) * 255, 0, 0, '/255');
check('ciel : noirs denses', Math.max(...ciel([0, 0, 0])) * 255, 0, 3);

/* 5. Bandes. Une rampe qui traverse tout le domaine de la regle, rendue par la
   LUT reelle — c'est la, et pas dans la fonction pure, qu'une marche apparait. */
const cielLut = getPresetLut('powlisher-ciel');
const rampe = new Uint8ClampedArray(256 * 4);
for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    /* Du ciel profond du zenith au voile blanc de l'horizon. */
    rampe[i * 4] = 40 + (214 - 40) * t;
    rampe[i * 4 + 1] = 100 + (226 - 100) * t;
    rampe[i * 4 + 2] = 170 + (232 - 170) * t;
    rampe[i * 4 + 3] = 255;
}
applyLut3dToData(rampe, cielLut, LUT_SIZE, 1);
let sautCiel = 0;
for (let i = 1; i < 256; i += 1) {
    for (let c = 0; c < 3; c += 1) {
        sautCiel = Math.max(sautCiel, Math.abs(rampe[i * 4 + c] - rampe[(i - 1) * 4 + c]));
    }
}
check('ciel : pas de bandes sur un degrade', sautCiel, 0, 5, '/255');

/* ---------- powlisher-showcase : le clair-obscur ----------
 *
 * Les cibles viennent de ses trois photos de voiture (img05/06/07), mesurees:
 *   - part des pixels sous 40/255 : 48, 52, 69 %
 *   - 1 % le plus clair           : 183, 170, 137 /255
 *   - chroma sujet / decor        : 0,69/0,33 · 1,00/0,47 · 0,76/0,20
 *     soit un ecart de x2,1 a x3,8
 *
 * Une LUT ne peut pas garantir la premiere ligne: elle depend de la SCENE, pas
 * du reglage — une voiture photographiee a midi restera claire. Ce qui se teste
 * ici, c'est ce qui appartient vraiment au preset: le plafond des hautes
 * lumieres, et l'ecart de saturation entre le sujet et le decor.
 */

const showcase = getPresetTransform('powlisher-showcase');
if (!showcase) {
    console.error('ECHEC: preset « powlisher-showcase » introuvable.');
    process.exit(1);
}

/* 1. Le plafond des hautes lumieres. C'est la signature tonale du look. */
check('showcase : point blanc bride', Math.max(...showcase([1, 1, 1])) * 255, 175, 195);
check('showcase : noirs denses', Math.max(...showcase([0, 0, 0])) * 255, 0, 3);
/* Et il assombrit vraiment: un gris moyen descend nettement. */
check('showcase : tons moyens creuses', showcase([0.5, 0.5, 0.5])[1] * 255, 85, 115);

/* 2. Le creux de saturation, le mecanisme central.
   Sonde « decor »: une tole/un beton legerement colore. Sonde « sujet »: le
   jaune de la voiture, mesure a 31-37° et chroma 0,61-0,88. */
const decorIn = hslToRgb(35, 0.30, 0.42);
const sujetIn = hslToRgb(45, 0.85, 0.55);
const decorOut = chroma(showcase(decorIn));
const sujetOut = chroma(showcase(sujetIn));
/* Les bornes sont celles de SES photos, pas un pourcentage choisi: son decor
   vit entre 0,20 et 0,47 de chroma, son sujet entre 0,69 et 1,00. */
check('showcase : decor dans sa fourchette', decorOut, 0.15, 0.50);
check('showcase : sujet dans la sienne', sujetOut, 0.65, 1.00);
/* Et c'est l'ECART qui fait le look — x2,1 a x3,8 chez lui. */
check('showcase : ecart sujet/decor', sujetOut / decorOut, 2.0, 8, '×');
/* Le sujet ne doit pas etre lave au passage. */
check('showcase : le sujet n\'est pas lave', sujetOut / chroma(sujetIn), 0.85, 1.5, ' ratio');

/*
 * 3. Un gris reste un gris — au niveau de `powlisher`, pas mieux, pas pire.
 * Le melange vers l'ocre ne touche que ce qui a ete vide, donc jamais un
 * neutre; ce qui reste vient du virage split, commun a toute la famille.
 */
const grisShowcase = chroma(showcase([0.45, 0.45, 0.45]));
const grisV1 = chroma(transform([0.45, 0.45, 0.45]));
check('showcase : les gris restent au niveau V1', grisShowcase - grisV1, -0.02, 0.02);

/* 4. Le bleu n'est pas ocre, et il suit la regle du ciel corrigee. Un ciel
   delave reste une image; un ciel kaki, ou un ciel a 163°, est un bug — les
   deux se sont produits ici avant d'etre corriges. */
const cielShowcase = rgbToHsl(...showcase(hslToRgb(210, 0.45, 0.60)));
check('showcase : le ciel reste bleu', cielShowcase[0], 188, 250, '°');

/* 5. Aucun contour ajoute dans un voile: on se compare au niveau de
   `powlisher`, qui sert de plancher a toute la famille. */
check('showcase : n\'ajoute pas de contour', amplificationVoile(showcase) - voileV1, -4, 0.6, '×');

/* 6. Bandes sur un degrade sombre, la ou une courbe creusee les revele. */
const showcaseLut = getPresetLut('powlisher-showcase');
const rampeSombre = new Uint8ClampedArray(256 * 4);
for (let i = 0; i < 256; i += 1) {
    rampeSombre[i * 4] = i;
    rampeSombre[i * 4 + 1] = Math.round(i * 0.92);
    rampeSombre[i * 4 + 2] = Math.round(i * 0.78);
    rampeSombre[i * 4 + 3] = 255;
}
applyLut3dToData(rampeSombre, showcaseLut, LUT_SIZE, 1);
let sautShowcase = 0;
for (let i = 1; i < 256; i += 1) {
    for (let c = 0; c < 3; c += 1) {
        sautShowcase = Math.max(sautShowcase, Math.abs(rampeSombre[i * 4 + c] - rampeSombre[(i - 1) * 4 + c]));
    }
}
check('showcase : pas de bandes', sautShowcase, 0, 5, '/255');

/* ---------- les effets non-LUT portes par un preset ----------
 *
 * Un preset peut embarquer des reglages qu'une table de couleurs ne peut pas
 * contenir (grain, vignetage, relief: ils dependent des pixels voisins ou de la
 * position). Encore faut-il qu'ils soient REELLEMENT applicables: si un preset
 * demande un grain de 60 alors que les garde-fous plafonnent a 42, le moteur
 * ramene a 42 en silence et le preset ne rend pas ce qu'il annonce.
 */
const horsLut = VISION_PRESETS.filter((p) => p.spatialFilters);
check('au moins un preset porte des effets', horsLut.length, 1, 999);
let horsBornes = 0;
for (const preset of horsLut) {
    for (const [key, value] of Object.entries(preset.spatialFilters)) {
        /* Marqueurs de profil du moteur, pas des curseurs numériques. */
        if ([
            'vignetteLightroomV2',
            'vignetteLighten',
            'presetSpatialBeforeLut',
            'presetClarityScale',
            'presetTextureEdgeAware',
            'presetAutoTone',
        ].includes(key)) continue;
        const bounds = visionBoundsFor(key, { safe: true });
        if (!bounds || value < bounds.min || value > bounds.max) horsBornes += 1;
    }
}
check('effets des presets dans les garde-fous', horsBornes, 0, 0);


/* ---------- le grain, et l'espace ou Lightroom le pose ---------- */
/*
 * Ces verifications rejouent les mesures faites sur ses exports (mire A, 1620
 * px, Grain 50, Taille 25 — `scripts/mesure-grain-canaux.mjs`, 2026-08-22).
 * Chaque nombre attendu vient d'un fichier sorti de Lightroom, pas d'un rendu
 * de reference fabrique par nous: si quelqu'un touche a la loi du grain, c'est
 * a LUI que le resultat est compare.
 */

/* Les tables de transfert doivent rendre la fonction exacte. C'est ce qui
   permet de remplacer neuf `Math.pow` par pixel sans y perdre. */
{
    let pireEnc = 0;
    let pireDec = 0;
    for (let i = 0; i <= 20000; i += 1) {
        const l = i / 20000;
        const attendu = grainTransfertEncode(l);
        /* on passe par le meme chemin que le moteur: encode puis decode */
        const aller = grainTransfertDecode(attendu);
        pireEnc = Math.max(pireEnc, Math.abs(aller - l) * 255);
        const c = -0.9 + (i / 20000) * 2.8;
        pireDec = Math.max(pireDec, Math.abs(grainTransfertEncode(grainTransfertDecode(c)) - c) * 255);
    }
    check('grain : aller-retour de la courbe exact', Math.max(pireEnc, pireDec), 0, 0.01, '/255');
}

/*
 * Un pixel NEUTRE doit ressortir a `valeur + delta`, au bit pres: les lignes
 * des deux matrices somment a 1. C'est ce qui garantit que la calibration sur
 * les gris — x1,00, verifiee deux fois — ne bouge pas d'un cheveu.
 */
{
    const sortie = new Float64Array(3);
    let pire = 0;
    for (let v = 0; v <= 255; v += 1) {
        for (const delta of [-40, -7.3, -0.4, 0.4, 7.3, 40]) {
            grainPoserDelta(v, v, v, delta, sortie);
            const attendu = Math.max(0, Math.min(255, v + delta));
            for (let c = 0; c < 3; c += 1) pire = Math.max(pire, Math.abs(sortie[c] - attendu));
        }
    }
    check('grain : les neutres sont un point fixe', pire, 0, 0, '/255');
}

/*
 * Et la vraie mesure: sur les 24 aplats de la mire A, l'ecart-type que NOTRE
 * grain pose, canal par canal, contre celui que LIGHTROOM pose. Le champ de
 * bruit est le vrai (`GRAIN_NOISE_TABLE`), la force la vraie, l'attenuation la
 * vraie: seule la geometrie de la mire est recopiee ici.
 */
{
    const MIRE_A = [
        // [nom, base RGB, sigma R/G/B mesures sur son export a Grain 50]
        ['gris 8', [8, 8, 8], [9.27, 9.27, 9.27]],
        ['gris 24', [24, 24, 24], [16.84, 16.84, 16.84]],
        ['gris 128', [128, 128, 128], [18.35, 18.35, 18.35]],
        ['gris 224', [224, 224, 224], [17.62, 17.62, 17.62]],
        ['gris 247', [247, 247, 247], [9.22, 9.19, 9.21]],
        ['rouge', [200, 40, 40], [21.21, 25.54, 19.69]],
        ['vert', [40, 170, 60], [29.18, 18.54, 22.50]],
        ['bleu', [40, 70, 200], [29.47, 18.60, 18.78]],
        ['cyan', [40, 190, 200], [32.12, 18.45, 18.31]],
        ['magenta', [200, 50, 190], [20.06, 26.15, 18.88]],
        ['jaune', [220, 200, 40], [18.56, 18.22, 27.69]],
        ['peau claire', [222, 176, 148], [17.94, 18.25, 18.29]],
        ['peau mate', [166, 120, 94], [18.83, 18.33, 18.43]],
        ['ciel', [92, 140, 186], [20.85, 18.37, 18.46]],
        ['feuillage', [58, 96, 62], [19.80, 18.43, 18.67]],
        ['beton', [176, 168, 150], [18.35, 18.30, 18.33]],
    ];
    const N = 65536; // un quart de la table de bruit: deterministe, et assez
    const sigma = grainSigma(50, 25, 1620); // Grain 50, Taille 25, mire de 1620 px
    const sortie = new Float64Array(3);
    let pireGris = 0;
    let pireCouleur = 0;
    for (const [nom, base, attendu] of MIRE_A) {
        const luma = (base[0] * 77 + base[1] * 150 + base[2] * 29) >> 8;
        const force = sigma * GRAIN_ATTENUATION[luma];
        const somme = [0, 0, 0];
        const carres = [0, 0, 0];
        for (let i = 0; i < N; i += 1) {
            grainPoserDelta(base[0], base[1], base[2], GRAIN_NOISE_TABLE[i] * force, sortie);
            for (let c = 0; c < 3; c += 1) {
                const v = Math.round(sortie[c]);
                somme[c] += v;
                carres[c] += v * v;
            }
        }
        for (let c = 0; c < 3; c += 1) {
            const m = somme[c] / N;
            const nous = Math.sqrt(Math.max(0, carres[c] / N - m * m));
            const ecart = Math.abs(100 * (nous / attendu[c] - 1));
            if (nom.startsWith('gris')) pireGris = Math.max(pireGris, ecart);
            else pireCouleur = Math.max(pireCouleur, ecart);
        }
    }
    check('grain : ecart a Lightroom sur les GRIS', pireGris, 0, 2.5, '%');
    check('grain : ecart a Lightroom sur les COULEURS', pireCouleur, 0, 3, '%');
}


/*
 * La FORCE du grain, a chaque couple (Taille, largeur) que Lightroom a
 * reellement exporte. Chaque nombre attendu est l'ecart-type lu dans un de ses
 * fichiers, jamais un rendu de reference fabrique par nous.
 */
{
    const MESURES = [
        // [Taille, largeur, son ecart-type a Grain 50] — un export Lightroom chacun
        [25, 810, 21.73],
        [10, 1080, 22.09], [25, 1080, 20.69], [40, 1080, 19.22], [100, 1080, 13.86],
        [0, 1620, 22.91], [10, 1620, 18.37], [25, 1620, 18.37], [40, 1620, 15.68],
        [50, 1620, 14.08], [100, 1620, 9.37],
        [10, 3240, 18.50], [25, 3240, 12.64], [40, 3240, 9.53],
        [10, 6480, 13.63], [25, 6480, 8.15], [40, 6480, 6.83],
        [25, 9720, 6.91],
    ];
    let pire = 0;
    for (const [taille, largeur, sien] of MESURES) {
        pire = Math.max(pire, Math.abs(100 * (grainSigma(50, taille, largeur) / sien - 1)));
    }
    check('grain : force, 18 exports Lightroom', pire, 0, 0.5, '%');
    check('grain : force Taille 40 sur photo 50 MP', grainEchelle(40, 8160), 2.754, 2.755);
    check('grain : force Taille 40 sur photo 200 MP', grainEchelle(40, 16320), 3.323, 3.325);

    /*
     * La CASSURE, son troisieme curseur. Elle valait 50 partout et n'avait
     * jamais ete mesuree — un preset qui l'aurait changee aurait fausse le
     * grain de 72 % sans que rien ne le signale.
     */
    let pireCassure = 0;
    for (const [cassure, sien] of [[0, 31.65], [50, 18.37], [100, 18.23]]) {
        pireCassure = Math.max(pireCassure, Math.abs(100 * (grainSigma(50, 25, 1620, cassure) / sien - 1)));
    }
    check('grain : Cassure, 3 exports Lightroom', pireCassure, 0, 0.5, '%');
    check('grain : Cassure 0 pose bien pres du double',
        grainSigma(50, 25, 1620, 0) / grainSigma(50, 25, 1620, 50), 1.6, 1.8, '×');
    check('grain : Cassure 100 grossit les grains',
        grainGrosseurCible(1, 100) / grainGrosseurCible(1, 50), 1.4, 1.7, '×');

    /*
     * Le rapport entre deux Tailles GRANDIT avec l'image: sur une petite image
     * les Tailles basses se confondent (elles butent sur le pixel), sur une
     * grande elles s'ecartent. C'est ce qu'aucun PRODUIT ne peut rendre, et la
     * raison d'etre de la surface. Fige ici pour qu'un retour au produit se
     * voie tout de suite.
     */
    const rapport = (largeur) => grainSigma(50, 10, largeur) / grainSigma(50, 25, largeur);
    check('grain : Tailles 10 et 25 confondues en petit format', rapport(1080), 1.0, 1.12, '×');
    check('grain : ...et separees en grand format', rapport(6480), 1.5, 1.8, '×');

    /*
     * L'echelle ne doit pas RECULER quand l'image grandit: une image plus
     * grande ne peut pas porter un grain plus fin. On tolere 1 %, parce que le
     * rang Taille 10 mesure 18,37 a 1620 px et 18,50 a 3240 — un creux de
     * 0,7 % qui est du bruit de mesure (son grain est un tirage aleatoire), et
     * qu'on prefere garder la mesure plutot que de retoucher un fichier.
     */
    let pireRecul = 0;
    for (const taille of [0, 10, 25, 40, 50, 100]) {
        let avant = 0;
        for (let largeur = 600; largeur <= 12000; largeur += 100) {
            const e = grainEchelle(taille, largeur);
            if (avant > 0) pireRecul = Math.max(pireRecul, 100 * (1 - e / avant));
            avant = e;
        }
    }
    check('grain : l\'echelle ne recule pas quand l\'image grandit', pireRecul, 0, 1, '%');
}
/*
 * ── LE RECADRAGE ─────────────────────────────────────────────────────────
 *
 * Le grain se calcule sur la largeur de l'image FINALE, recadrage compris —
 * pas sur celle du fichier d'origine, ni sur celle du canvas. Un recadrage
 * serre rend donc l'image plus petite, donc le grain plus fin et plus fort,
 * exactement comme chez lui.
 *
 * Ca n'avait jamais ete verifie. Deux choses le sont ici: la LOI, et le
 * CABLAGE — c'est-a-dire que le moteur passe bien la largeur echantillonnee
 * (`sWidth`) et non celle du canvas. Le cablage se lit dans la source parce que
 * `studioRenderer.js` est du code navigateur que Node ne peut pas charger.
 */
{
    /* La loi: recadrer de moitie doit donner exactement le grain d'une image
       deux fois plus etroite. */
    const pleine = grainSigma(25, 25, 6480);
    const recadree = grainSigma(25, 25, 3240);
    check('recadrage : un cadre 2x plus serre renforce le grain',
        recadree / pleine, 1.5, 1.9, '×');
    /* Et rendue 1:1, cette image recadree porte exactement ce grain-la — la
       largeur du fichier d'origine n'entre nulle part. */
    check('recadrage : rendu 1:1, c\'est bien ce grain',
        Math.abs(grainPourRendu(25, 25, 3240, 3240).sigma - recadree), 0, 1e-12);
    /* Reduite a l'ecran, elle en montre MOINS: c'est ce que montre son ecran a
       lui, et c'est pour ca que Vision a un zoom. */
    check('recadrage : reduite a l\'ecran, elle en montre moins',
        grainPourRendu(25, 25, 3240, 800).sigma / recadree, 0.2, 0.95, '×');

    /* Le cablage: `largeurImage` doit etre la portion ECHANTILLONNEE. */
    const moteur = readFileSync(
        new URL('../src/features/vibefx-studio/engine/studioRenderer.js', import.meta.url),
        'utf8',
    );
    const nrPos = moteur.lastIndexOf('applyNoiseReduction(');
    const clarityPos = moteur.lastIndexOf('applyClarity(');
    const sharpPos = moteur.lastIndexOf('applySharpness(');
    check('réduction du bruit : appliquée avant clarté et netteté',
        nrPos >= 0 && nrPos < clarityPos && nrPos < sharpPos ? 1 : 0, 1, 1);
    check('recadrage : le moteur prend le grand cote echantillonne',
        /grandCoteImage\s*=\s*Math\.max\(sWidth,\s*sHeight\)/.test(moteur) ? 1 : 0, 1, 1);
    /*
     * LE GRAND COTE, PAS LA LARGEUR. Mesure: une mire de 2160x3240 exportee en
     * PORTRAIT rend 12,62, exactement comme la meme mire en paysage 3240x2160
     * (12,64). Si Lightroom lisait la largeur, elle aurait rendu 15,73. Une
     * photo verticale de 9180x16320 compte donc comme une image de 16320 —
     * l'ecart valait 47 % sur le grain.
     */
    check('portrait : une image verticale compte par son grand cote',
        Math.abs(grainSigma(50, 25, 3240) - 12.64), 0, 0.1, '/255');
    check('portrait : le moteur lit bien le grand cote',
        /grandCoteImage\s*=\s*Math\.max\(w,\s*h\)/.test(moteur) ? 1 : 0, 1, 1);

    check('recadrage : et il le transmet au grain',
        /applyFilmGrain\([^)]*grandCoteImage,\s*grandCoteRendu\b/.test(moteur) ? 1 : 0, 1, 1);
}


/*
 * La GROSSEUR de nos grains contre la sienne. La force et la grosseur ne sont
 * pas le meme nombre au-dela de 2 px — c'est la mesure du 2026-08-22 — et ce
 * test garde la table qui les separe. La metrique est celle de
 * `mesure-taille-grain.mjs`: 1 + 2 x la somme des autocorrelations.
 */
{
    const N = 256;
    const longueurDuChamp = (echelle, grosseur = null) => {
        const v = new Float64Array(N * N);
        for (let y = 0; y < N; y += 1) {
            for (let x = 0; x < N; x += 1) {
                v[y * N + x] = grainValeurEn(x, y, echelle, undefined, grosseur);
            }
        }
        let somme = 0;
        for (let i = 0; i < v.length; i += 1) somme += v[i];
        const m = somme / v.length;
        for (let i = 0; i < v.length; i += 1) v[i] -= m;
        let total = 0;
        for (let dx = 1; dx <= 8; dx += 1) {
            let sxy = 0;
            let sxx = 0;
            for (let y = 0; y < N; y += 1) {
                for (let x = 0; x < N - dx; x += 1) {
                    const a = v[y * N + x];
                    sxy += a * v[y * N + x + dx];
                    sxx += a * a;
                }
            }
            total += Math.max(0, sxx > 0 ? sxy / sxx : 0);
        }
        return 1 + 2 * total;
    };
    /* [echelle, sa grosseur mesuree sur l'export Lightroom correspondant] */
    const SIENNE = [[1.0, 1.02], [1.1716, 1.12], [1.4533, 1.44], [1.96, 1.96], [2.254, 2.44], [2.6585, 3.35]];
    let pire = 0;
    for (const [echelle, sienne] of SIENNE) {
        pire = Math.max(pire, Math.abs(100 * (longueurDuChamp(echelle) / sienne - 1)));
    }
    check('grain : grosseur des grains, 6 exports', pire, 0, 6, '%');
    const e8160 = grainEchelle(40, 8160);
    const e16320 = grainEchelle(40, 16320);
    const e10_8160 = grainEchelle(10, 8160);
    const e10_16320 = grainEchelle(10, 16320);
    check('grain CN14 : force photo 50 MP', grainSigma(25, 10, 8160), 6.0, 6.2, '/255');
    check('grain CN14 : force photo 200 MP', grainSigma(25, 10, 16320), 4.0, 4.2, '/255');
    check('grain CN14 : grosseur photo 50 MP',
        longueurDuChamp(e10_8160, grainGrosseurCalibree(10, 8160, e10_8160)), 1.3, 1.5, 'px');
    check('grain CN14 : grosseur photo 200 MP',
        longueurDuChamp(e10_16320, grainGrosseurCalibree(10, 16320, e10_16320)), 2.15, 2.45, 'px');
    check('grain : grosseur photo 50 MP',
        longueurDuChamp(e8160, grainGrosseurCalibree(40, 8160, e8160)), 3.6, 4.1, 'px');
    check('grain : grosseur photo 200 MP',
        longueurDuChamp(e16320, grainGrosseurCalibree(40, 16320, e16320)), 6.3, 7.3, 'px');

    /* Le champ doit garder un ecart-type de 1 QUEL QUE SOIT le pas: aux pas
       entiers et demi-entiers le reseau se cale sur la grille des pixels et le
       gonflait jusqu'a 13 %. C'est ce que `eviterResonance` empeche. */
    let pireSigma = 0;
    for (let echelle = 1.0; echelle <= 5.0; echelle += 0.05) {
        let somme = 0;
        let carres = 0;
        for (let y = 0; y < N; y += 1) {
            for (let x = 0; x < N; x += 1) {
                const val = grainValeurEn(x, y, echelle);
                somme += val;
                carres += val * val;
            }
        }
        const n = N * N;
        const sigma = Math.sqrt(Math.max(0, carres / n - (somme / n) ** 2));
        pireSigma = Math.max(pireSigma, Math.abs(100 * (sigma - 1)));
    }
    check('grain : le champ garde sa force a tous les pas', pireSigma, 0, 3, '%');
}

/* ---------- powlisher-cine : les mesures de 324 photos, figees ----------
 *
 * Ce preset n'a pas ete regle a la main: chaque nombre qu'il porte vient d'une
 * mesure sur 324 photos de @powl_d rangees par sujet, comparees a 374 photos
 * neutres des memes sujets (Wikimedia Commons). Ce qui est verifie ici, ce sont
 * donc les MESURES, pas un gout.
 *
 * Les deux dernieres verifications sont des garde-fous poses apres des defauts
 * reellement vus a l'ecran, pas des precautions theoriques:
 *
 *   - le blanc doit rester neutre. Une premiere version prolongeait la derive
 *     verte de l'etalonnage jusque dans les blancs, et un grand ciel a
 *     contre-jour virait au vert-gris.
 *   - un degrade doit rester un degrade. La toute premiere version tirait les
 *     teintes VERS des attracteurs, ce qui fait converger deux teintes voisines
 *     et fabrique une bande visible dans un ciel. Le mecanisme a ete remplace
 *     par des rotations d'angle fixe, facon panneau TSL de Lightroom, qui ne
 *     peuvent pas croiser deux couleurs.
 */

const cine = getPresetTransform('powlisher-cine');
if (!cine) {
    console.error('ECHEC: preset « powlisher-cine » introuvable.');
    process.exit(1);
}

function versLab(rgb) {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [R, G, B] = rgb.map(lin);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function teinteLab(rgb) {
    const [, A, B] = versLab(rgb);
    let h = Math.atan2(B, A) * 180 / Math.PI;
    return h < 0 ? h + 360 : h;
}

{
    /* Le bleu part vers le teal, ET l'effet S'EFFACE quand le bleu est franc.
     *
     * Une premiere version de ce smoke visait une valeur unique, -11,8 degres,
     * qui est la rotation TSL mesuree. Elle echouait a -29,8: la rotation TOTALE
     * d'un bleu, c'est la rotation TSL PLUS l'effet de l'etalonnage, et
     * l'etalonnage est un decalage fixe en a et b. Son effet angulaire est donc
     * inversement proportionnel a la chroma — enorme sur un bleu pale, negligeable
     * sur un bleu franc:
     *
     *   ciel pale (chroma 27)     -47°
     *   ciel moyen (chroma 37)    -30°
     *   ciel franc (chroma 55)     -7°
     *   bleu profond (chroma 66)   +4°
     *
     * Ce n'est pas un defaut, c'est ce que fait aussi l'etalonnage de Lightroom.
     * Et c'est la propriete qu'on cherchait: un ciel DEJA bleu-cyan est presque
     * intact, la ou l'ancien `powlisher` le poussait au menthe. On fige donc les
     * deux bouts plutot qu'un chiffre au milieu. */
    const cielMoyen = [0.42, 0.60, 0.85];
    const rotPale = ((teinteLab(cine(cielMoyen)) - teinteLab(cielMoyen) + 540) % 360) - 180;
    check('cine : un ciel pale part vers le teal', rotPale, -50, -12, '°');

    const bleuFranc = [0.12, 0.30, 0.72];
    const rotFranc = ((teinteLab(cine(bleuFranc)) - teinteLab(bleuFranc) + 540) % 360) - 180;
    check('cine : un bleu franc est presque intact', Math.abs(rotFranc), 0, 10, '°');

    /* L'etalonnage sur un gris moyen: derive verte (a* negatif) et jaune
     * (b* positif). Mesure sur huit familles, toutes du meme signe. */
    const [, aGris, bGris] = versLab(cine([0.5, 0.5, 0.5]));
    check('cine : la lumiere derive au vert', aGris, -6, -0.5, ' a*');
    check('cine : la lumiere derive au jaune', bGris, 2, 10, ' b*');

    /* Les hautes lumieres n'ecretent jamais. Sur les 324 photos, la mediane de
     * pixels a 255 est de 0,00 % dans les DOUZE familles. */
    const blanc = cine([1, 1, 1]).map((v) => Math.round(v * 255));
    check('cine : le blanc ne monte pas a 255', Math.max(...blanc), 200, 250);

    /* ... et il reste neutre: pas de ciel vert-gris. */
    check('cine : le blanc reste neutre', Math.abs(blanc[0] - blanc[2]), 0, 5);

    /* Un degrade de ciel reste un degrade: aucun pas de sortie ne doit depasser
     * de beaucoup le pas d'entree. Une convergence de teintes se verrait ici
     * comme un pic. */
    let pireEntree = 0, pireSortie = 0, prevIn = null, prevOut = null;
    for (let k = 0; k <= 40; k += 1) {
        const f = k / 40;
        const dedans = [0.15 + 0.55 * f, 0.35 + 0.45 * f, 0.65 + 0.30 * f];
        const dehors = cine(dedans);
        if (prevIn) {
            pireEntree = Math.max(pireEntree, Math.max(...dedans.map((v, i) => Math.abs(v - prevIn[i]) * 255)));
            pireSortie = Math.max(pireSortie, Math.max(...dehors.map((v, i) => Math.abs(v - prevOut[i]) * 255)));
        }
        prevIn = dedans; prevOut = dehors;
    }
    check('cine : un degrade de ciel ne fait pas de bande', pireSortie / pireEntree, 0, 1.7, '×');
}

/* ---------- la famille cine : quatre variantes mesurees le 2026-08-26 -------
 *
 * Elles sortent du meme materiau que le tronc et des memes instruments. Ce qui
 * est fige ici, ce sont les proprietes qui les rendent UTILISABLES, plus l'ordre
 * de l'axe — parce qu'une variante qui doublerait le tronc ne servirait a rien,
 * et qu'une variante qui ecreterait le degraderait.
 */
{
    const famille = {
        'powlisher-cine-net': { plafond: 245 },
        'powlisher-chaud': { plafond: 226 },
        'powlisher-froid': { plafond: 235 },
        'powlisher-mer': { plafond: 252 },
        'powlisher-nuit-1': { plafond: 213 },
        'powlisher-nuit-2': { plafond: 195 },
    };
    const chroma = (rgb) => Math.hypot(...versLab(rgb).slice(1));

    for (const [id, attendu] of Object.entries(famille)) {
        const f = getPresetTransform(id);
        if (!f) { console.error(`ECHEC: preset « ${id} » introuvable.`); process.exit(1); }
        const court = id.replace('powlisher-', '').replace('cine-', '');

        /* Le point blanc de chaque variante, celui que son propre transport a
         * mesure. C'est le nombre qui la distingue le plus des autres. */
        const blanc = f([1, 1, 1]).map((v) => Math.round(v * 255));
        check(`${court} : plafond mesure`, Math.max(...blanc), attendu.plafond - 4, attendu.plafond + 4);

        /* Aucune n'ecrete: c'est la regle la plus ferme du corpus (0,00 % de
         * pixels a 255 dans les douze familles). */
        check(`${court} : n'ecrete pas`, Math.max(...blanc), 0, 254);

        /* Le blanc ne vire pas au VERT-GRIS — le defaut vu sur un ciel a
         * contre-jour. La creme de `doux` vit dans ses hautes lumieres, pas dans
         * son blanc: un blanc reste blanc dans les quatre. */
        check(`${court} : le blanc ne verdit pas`, blanc[1] - (blanc[0] + blanc[2]) / 2, -4, 2);
        check(`${court} : le blanc reste blanc`, Math.abs(blanc[0] - blanc[2]), 0, 5);

        /* Une rampe grise reste croissante: une courbe qui redescend, meme d'un
         * niveau, fabrique un plat, et un plat bande. */
        let monotone = true;
        let precedent = -1;
        for (let k = 0; k <= 255; k += 1) {
            const y = versLab(f([k / 255, k / 255, k / 255]))[0];
            if (y < precedent - 1e-9) monotone = false;
            precedent = y;
        }
        check(`${court} : rampe grise croissante`, monotone ? 1 : 0, 1, 1);

        /* Un degrade de ciel reste un degrade. */
        let pireEntree = 0, pireSortie = 0, prevIn = null, prevOut = null;
        for (let k = 0; k <= 40; k += 1) {
            const t = k / 40;
            const dedans = [0.15 + 0.55 * t, 0.35 + 0.45 * t, 0.65 + 0.30 * t];
            const dehors = f(dedans);
            if (prevIn) {
                pireEntree = Math.max(pireEntree, Math.max(...dedans.map((v, i) => Math.abs(v - prevIn[i]) * 255)));
                pireSortie = Math.max(pireSortie, Math.max(...dehors.map((v, i) => Math.abs(v - prevOut[i]) * 255)));
            }
            prevIn = dedans; prevOut = dehors;
        }
        check(`${court} : un degrade ne fait pas de bande`, pireSortie / pireEntree, 0, 1.7, '×');

        /* Et aucune n'ajoute de contour dans un voile: meme borne que le reste
         * du projet, le niveau de `powlisher` plus une demi-unite. */
        check(`${court} : n'ajoute pas de contour`, amplificationVoile(f) - voileV1, -4, 0.6, '×');
    }

    /* AUCUNE VARIANTE N'AJOUTE DE SATURATION. C'est le garde-fou pose apres le
     * preset rate du 2026-08-26: mesuree teinte par teinte, la chroma de ses
     * cinq poles tombe entre 0,77 et 1,23, et le tronc lui-meme est a 0,85 /
     * 0,83 / 0,99. Un jour ou quelqu'un relachera un gain a 2, ce test le dira
     * avant qu'une cour marocaine ne parte au rouge.
     *
     * On mesure sur des couleurs de photo, pas sur les coins du cube: une ocre,
     * un feuillage, un ciel, une peau. */
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    for (const id of Object.keys(famille)) {
        const f = getPresetTransform(id);
        const pire = Math.max(...echantillons.map((rgb) => chroma(f(rgb)) / chroma(rgb)));
        /* 1,3 et pas 1,0: `mer` mesure 1,23 dans son tiers clair, et c'est la
         * seule augmentation de tout le corpus — elle survit au test teinte par
         * teinte sur trois tiers de photos independants. La borne laisse passer
         * une mesure, pas un gain relache. */
        check(`${id.replace('powlisher-', '')} : n'ajoute pas de saturation`, pire, 0, 1.3, '×');
    }

    /* L'AXE DES COULEURS EST ORDONNE. C'est la raison d'etre de `chaud` et
     * `froid`: deux bouts d'une meme mesure, pas deux essais separes. Le jaune
     * pose sur un gris clair les separe de plus de 5 unites b*. */
    const jauneDe = (id) => versLab(getPresetTransform(id)([0.85, 0.85, 0.85]))[2];
    check('axe couleur : chaud est plus jaune que le tronc',
        jauneDe('powlisher-chaud') - jauneDe('powlisher-cine'), 1, 8, ' b*');
    check('axe couleur : froid est moins jaune que le tronc',
        jauneDe('powlisher-cine') - jauneDe('powlisher-froid'), 1, 8, ' b*');

    /* Et leur lumiere ne tire pas au vert du meme tout: c'est l'autre moitie de
     * ce que la mesure a trouve. */
    const vertDe = (id) => versLab(getPresetTransform(id)([0.5, 0.5, 0.5]))[1];
    check('axe couleur : froid est le plus vert de la famille',
        vertDe('powlisher-chaud') - vertDe('powlisher-froid'), 1, 8, ' a*');

    /* `mer` ouvre la ou les autres retiennent: c'est la seule famille du corpus
     * dont le point blanc depasse celui du tas neutre. */
    const blancDe = (id) => Math.max(...getPresetTransform(id)([1, 1, 1])) * 255;
    check('mer : le plafond le plus haut de la famille',
        blancDe('powlisher-mer') - blancDe('powlisher-cine-net'), 5, 25);

    /* `nuit` vide les ombres de leur couleur (chroma mesuree a 0,54 du tas
     * neutre) — c'est ce qui rend une nuit lisible au lieu d'un confetti. */
    const ombreColoree = [0.22, 0.16, 0.26];
    check('nuit : les ombres perdent leur couleur',
        chroma(getPresetTransform('powlisher-nuit-2')(ombreColoree)) / chroma(getPresetTransform('powlisher-cine')(ombreColoree)),
        0, 1.0, '×');

    /* LES DEUX DENSITES DE NUIT SONT ORDONNEES, ET LEUR COULEUR EST IDENTIQUE.
     * C'est la definition de ce qui a ete corrige le 2026-08-28: `nuit 1` n'est
     * pas un autre look, c'est le meme pose plus haut. Si un jour leur couleur
     * divergeait, ce serait deux presets sans rapport portant le meme nom. */
    const grisDe = (id, v) => versLab(getPresetTransform(id)([v, v, v]))[0];
    check('nuit : la version 1 est posee plus haut que la 2',
        grisDe('powlisher-nuit-1', 0.5) - grisDe('powlisher-nuit-2', 0.5), 4, 12, ' L');
    const teinteGris = (id) => versLab(getPresetTransform(id)([0.5, 0.5, 0.5])).slice(1);
    const [a1, b1] = teinteGris('powlisher-nuit-1');
    const [a2, b2] = teinteGris('powlisher-nuit-2');
    check('nuit : les deux densites portent la meme couleur', Math.hypot(a1 - a2, b1 - b2), 0, 1.5, ' Lab');
}

/* ---------- ambre : le modele designe a la main, mesure le 2026-08-27 --------
 *
 * `ambre` ne sort pas des poles du corpus mais d'un MODELE: dix photos choisies
 * a la main, etendues aux 60 plus proches du corpus (dix familles de sujet).
 * Ce qui est fige ici, c'est ce qui le distingue de tout le reste du fichier —
 * le split-tone — plus les garde-fous communs.
 */
{
    const ambre = getPresetTransform('ambre');
    const nuit1 = getPresetTransform('ambre-nuit-1');
    const nuit = getPresetTransform('ambre-nuit-2');
    if (!ambre || !nuit || !nuit1) { console.error('ECHEC: presets ambre introuvables.'); process.exit(1); }

    for (const [nom, f, plafond] of [['ambre', ambre, 245], ['ambre-nuit-1', nuit1, 209], ['ambre-nuit-2', nuit, 181]]) {
        const blanc = f([1, 1, 1]).map((v) => Math.round(v * 255));
        check(`${nom} : plafond mesure`, Math.max(...blanc), plafond - 4, plafond + 4);
        check(`${nom} : n'ecrete pas`, Math.max(...blanc), 0, 254);

        /* LE BLANC EST CREME, ET C'EST MESURE. Partout ailleurs dans ce fichier
         * un blanc reste blanc; ici les 10 % de pixels les plus lumineux du
         * modele portent b* +8,23 sur leurs quasi-gris (dispersion 1,27 sur six
         * familles). Ce qui reste interdit, c'est le VERT — le defaut vu sur un
         * ciel a contre-jour — et le a* mesure est a -0,36, donc neutre. */
        const [, aBlanc, bBlanc] = versLab(f([1, 1, 1]));
        check(`${nom} : le blanc est creme`, bBlanc, 6, 11, ' b*');
        check(`${nom} : le blanc ne verdit pas`, aBlanc, -2, 1, ' a*');

        let monotone = true;
        let precedent = -1;
        for (let k = 0; k <= 255; k += 1) {
            const y = versLab(f([k / 255, k / 255, k / 255]))[0];
            if (y < precedent - 1e-9) monotone = false;
            precedent = y;
        }
        check(`${nom} : rampe grise croissante`, monotone ? 1 : 0, 1, 1);

        /* Le split-tone ne peut pas creer de contour: une compression rapproche,
         * une bande separe. Meme borne que tout le projet. */
        check(`${nom} : n'ajoute pas de contour`, amplificationVoile(f) - voileV1, -4, 0.6, '×');

        /* Aucune saturation ajoutee, comme le reste du projet. */
        const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
        const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
        check(`${nom} : n'ajoute pas de saturation`,
            Math.max(...echantillons.map((rgb) => chromaDe(f(rgb)) / chromaDe(rgb))), 0, 1.3, '×');
    }

    /* LA SIGNATURE. Le jaune monte du bas vers le haut — c'est ce qui separe ce
     * preset du tronc, qui pose un voile a peu pres uniforme. Mesure sur trois
     * gris, un par tiers. */
    const b = (v) => versLab(ambre([v, v, v]))[2];
    check('ambre : le jaune monte des ombres aux clairs', b(0.85) - b(0.2), 2, 8, ' b*');
    const bTronc = (v) => versLab(cine([v, v, v]))[2];
    check('ambre : plus creuse que le voile du tronc',
        (b(0.85) - b(0.2)) - (bTronc(0.85) - bTronc(0.2)), 1, 8, ' b*');

    /* Les deux densites sont bien deux densites, et rien d'autre: leurs blancs
     * s'ecartent de 60 niveaux, leur couleur est la meme table. */
    check('ambre : les deux densites s\'ecartent',
        Math.max(...ambre([1, 1, 1])) * 255 - Math.max(...nuit([1, 1, 1])) * 255, 50, 80);
    /* Et la version 1 tombe bien ENTRE les deux, sans quoi elle ne serait pas un
     * point milieu mais un troisieme reglage. */
    const grisAmbre = (f) => versLab(f([0.5, 0.5, 0.5]))[0];
    check('ambre : la nuit 1 est entre ambre et la nuit 2',
        (grisAmbre(nuit1) - grisAmbre(nuit)) / (grisAmbre(ambre) - grisAmbre(nuit)), 0.35, 0.65, '');
}

/* ---------- couchant : mesure contre des COUCHANTS, le 2026-08-27 ter --------
 *
 * Ce qui est fige ici, c'est ce qui n'existait dans aucun autre preset du
 * projet: un a* qui DESCEND vers les hautes lumieres au lieu de revenir a zero.
 * C'est la trouvaille — le magenta retire d'un soleil orange — et c'est aussi
 * la chose la plus facile a casser, puisqu'elle frotte contre la regle « pas de
 * vert dans les blancs ». Les deux sont verifiees ensemble.
 */
{
    const couchant = getPresetTransform('couchant');
    if (!couchant) { console.error('ECHEC: preset couchant introuvable.'); process.exit(1); }

    const blanc = couchant([1, 1, 1]).map((v) => Math.round(v * 255));
    check('couchant : plafond mesure', Math.max(...blanc), 235, 243);
    check('couchant : n\'ecrete pas', Math.max(...blanc), 0, 254);

    const [, aBlanc, bBlanc] = versLab(couchant([1, 1, 1]));
    check('couchant : le blanc est creme', bBlanc, 6, 11, ' b*');
    /* La borne du projet, et ce preset s'y colle exprès: son releve brut donnait
     * -5,71, ramene a -1,90 en multipliant TOUTE la table par un seul facteur
     * (0,3327), ce qui garde la forme mesuree. Si ce test casse, c'est que
     * quelqu'un a relache le facteur, et le blanc verdit. */
    check('couchant : le blanc ne verdit pas', aBlanc, -2, 1, ' a*');
    /* Et le blanc reste un IVOIRE: le rouge devant le vert, comme `ambre`. */
    check('couchant : le blanc reste ivoire', blanc[0] - blanc[1], 0, 12, ' R-G');

    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = versLab(couchant([k / 255, k / 255, k / 255]))[0];
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('couchant : rampe grise croissante', monotone ? 1 : 0, 1, 1);

    check('couchant : n\'ajoute pas de contour', amplificationVoile(couchant) - voileV1, -4, 0.6, '×');

    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
    check('couchant : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chromaDe(couchant(rgb)) / chromaDe(rgb))), 0, 1.3, '×');

    /* LE SPLIT-TONE, comme `ambre`: le jaune monte du bas vers le haut. */
    const b = (v) => versLab(couchant([v, v, v]))[2];
    check('couchant : le jaune monte des ombres aux clairs', b(0.85) - b(0.2), 2, 8, ' b*');

    /* LA SIGNATURE PROPRE. Chez `ambre` le a* des blancs revient a zero (-0,36);
     * ici il descend. C'est la seule difference de couleur entre les deux
     * presets, et c'est tout le sujet: un couchant a un soleil orange dont on
     * retire le magenta. Si cet ecart s'annule, `couchant` n'est plus qu'un
     * `ambre` avec une autre courbe. */
    const a = (v) => versLab(couchant([v, v, v]))[1];
    check('couchant : le a* descend vers les clairs', a(0.25) - a(0.95), 0.4, 2.5, ' a*');
    const ambrePourCouchant = getPresetTransform('ambre');
    check('couchant : ses blancs sont plus froids que ceux d\'ambre',
        versLab(ambrePourCouchant([1, 1, 1]))[1] - aBlanc, 0.8, 3.5, ' a*');

    /* La courbe est le transport, et sa pente ne descend pas sous le pas
     * d'entree de la LUT (1/8). Mesuree sur la rampe rendue. */
    let penteMini = 9;
    for (let k = 8; k <= 247; k += 8) {
        const y0 = couchant([(k - 8) / 255, (k - 8) / 255, (k - 8) / 255])[0] * 255;
        const y1 = couchant([(k + 8) / 255, (k + 8) / 255, (k + 8) / 255])[0] * 255;
        penteMini = Math.min(penteMini, (y1 - y0) / 16);
    }
    check('couchant : aucune pente sous le pas de la LUT', penteMini, 0.125, 3);
}

/* ---------- powlishermain : le seul cale sur des avant/apres certains -------
 *
 * Ses cibles ne viennent pas d'un tas de photos finies mais de trois paires ou
 * l'on connait les deux bouts (voir l'en-tete du preset). Les chiffres figes ici
 * sont ceux de `scripts/mesurer-paires-powlisher.mjs` sur 43 691 blocs.
 */
{
    const main = getPresetTransform('powlishermain');
    if (!main) { console.error('ECHEC: powlishermain introuvable.'); process.exit(1); }

    /* 1. LA LUMIERE NE BOUGE PAS. C'est LA trouvaille de la mesure: ses trois
     * retouches ne sont, en lumiere lineaire, qu'un gain (-1,85 / -0,22 /
     * -0,56 EV), et la courbe qui reste une fois ce gain retire est l'identite.
     * Si quelqu'un glisse une courbe ici, ce test tombe. */
    let ecartL = 0;
    for (let k = 0; k <= 255; k += 1) {
        const gris = k / 255;
        ecartL = Math.max(ecartL, Math.abs(versLab(main([gris, gris, gris]))[0] - versLab([gris, gris, gris])[0]));
    }
    check('powlishermain : la luminosite ne bouge pas', ecartL, 0, 1.5, ' L*');

    /* 2. LE VIRAGE, tel qu'il a ete mesure sur une entree neutre. Ombres
     * vert-cyan, bas-tons orange, creme du milieu au blanc. */
    const virage = (v) => versLab(main([v, v, v]));
    check('powlishermain : ombres vert-cyan', virage(0.06)[1], -3, -1, ' a*');
    check('powlishermain : bas-tons orange', virage(0.32)[1], 2, 4.5, ' a*');
    check('powlishermain : le creme culmine au milieu', virage(0.45)[2], 7.5, 10, ' b*');
    check('powlishermain : le blanc est creme', virage(1)[2], 4.5, 7.5, ' b*');
    check('powlishermain : le blanc ne verdit pas', virage(1)[1], -2, 1, ' a*');
    check('powlishermain : le creme retombe vers le blanc',
        virage(0.45)[2] - virage(1)[2], 1.5, 4.5, ' b*');

    /* 3. LES VERTS TOMBENT (x0,40 a x0,53 mesures sur deux objets, dans deux
     * photos), LES ROUGES NON (x1,03 a x1,06 une fois le virage retire). */
    const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
    const vert = [0.30, 0.50, 0.25];
    check('powlishermain : le vert perd sa couleur', chromaDe(main(vert)) / chromaDe(vert), 0.45, 0.75, '×');
    const rouge = [0.80, 0.20, 0.20];
    check('powlishermain : le rouge garde la sienne', chromaDe(main(rouge)) / chromaDe(rouge), 0.9, 1.2, '×');

    /* 4. LE CIEL CONVERGE VERS 190-199 EN TSL. Son ciel de nuit part de 223 et
     * arrive a 192; c'est aussi la fenetre trouvee en 2026-08-12 sur son corpus
     * par une methode sans rapport. Deux bleus tres differents doivent tomber
     * dans la meme fenetre — c'est une convergence, pas une rotation fixe. */
    const teinteTsl = (rgb) => {
        const [r, g, b] = rgb;
        const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
        if (d <= 0) return 0;
        let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return (((h * 60) % 360) + 360) % 360;
    };
    check('powlishermain : le ciel de nuit arrive dans sa fenetre',
        teinteTsl(main([0.10, 0.12, 0.22])), 185, 205, '°');
    check('powlishermain : un ciel de jour arrive dans la meme',
        teinteTsl(main([0.35, 0.55, 0.85])), 182, 205, '°');
    /* Et un ciel DEJA cyan n'est pas repousse plus loin: c'est le defaut que
     * `powlisher-ciel` avait corrige, on ne le reintroduit pas. */
    const dejaCyan = [0.45, 0.70, 0.78];
    check('powlishermain : un ciel deja cyan ne part pas au menthe',
        Math.abs(teinteTsl(main(dejaCyan)) - teinteTsl(dejaCyan)), 0, 12, '°');

    /* 5. ON NE FAIT RIEN LA OU ON N'A RIEN MESURE. Entre 135 et 250 degres Lab
     * (verts francs, cyans) et au-dela de 308 (magentas, roses), les trois
     * photos sont muettes: le melangeur y est a l'identite. Un magenta ne doit
     * donc bouger que du virage. */
    const magenta = [0.70, 0.25, 0.60];
    check('powlishermain : le magenta n\'est pas tourne',
        Math.abs(teinteTsl(main(magenta)) - teinteTsl(magenta)), 0, 14, '°');

    /* 6. Les gardes communs a tout le projet. */
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = versLab(main([k / 255, k / 255, k / 255]))[0];
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powlishermain : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    check('powlishermain : n\'ecrete pas', Math.max(...main([1, 1, 1]).map((v) => Math.round(v * 255))), 0, 255);
    check('powlishermain : n\'ajoute pas de contour', amplificationVoile(main) - voileV1, -4, 0.6, '×');
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powlishermain : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chromaDe(main(rgb)) / chromaDe(rgb))), 0, 1.3, '×');
}

/* ---------- powV2 : la meme source, mais la courbe en plus ------------------
 *
 * `powlishermain` fige la COULEUR mesuree sur les trois paires et refuse de
 * toucher a la lumiere. `powV2` ajoute la meilleure courbe commune aux trois.
 * Ce bloc verifie donc ce que l'autre ne pouvait pas: la forme de la courbe, et
 * le fait qu'elle ne detruise rien.
 */
{
    const v2 = getPresetTransform('powV2');
    const main2 = getPresetTransform('powlishermain');
    if (!v2 || !main2) { console.error('ECHEC: powV2 introuvable.'); process.exit(1); }
    const gris = (f, v) => versLab(f([v, v, v]));

    /* 1. LA COURBE EXISTE, et c'est ce qui le separe de `powlishermain`. */
    check('powV2 : il assombrit, la ou powlishermain ne bougeait pas',
        gris(main2, 0.5)[0] - gris(v2, 0.5)[0], 3, 9, ' L*');

    /* 2. LE POINT NOIR EST MESURE, pas choisi: ses trois photos posent leur
     * tranche L* 0-5 a 2,4 / 3,2 / 0,1. Un facteur commun aux trois canaux ne
     * peut pas eclaircir un pixel deja noir, donc le noir pur reste noir — et
     * c'est justement ce qui evite un gain qui explose pres de zero. */
    check('powV2 : le noir pur reste noir', Math.max(...v2([0, 0, 0])) * 255, 0, 1);

    /* 3. IL NE DETRUIT RIEN. La droite libre, meilleure de 0,7 en dE76, envoyait
     * a zero tout ce qui est sous L* 9,5 et effacait le volant d'une des trois
     * photos. La pente de la courbe ne descend nulle part sous le pas de la LUT. */
    let penteMini = 9;
    for (let k = 8; k <= 247; k += 8) {
        const y0 = versLab(v2([(k - 8) / 255, (k - 8) / 255, (k - 8) / 255]))[0];
        const y1 = versLab(v2([(k + 8) / 255, (k + 8) / 255, (k + 8) / 255]))[0];
        penteMini = Math.min(penteMini, (y1 - y0) / (versLab([(k + 8) / 255, (k + 8) / 255, (k + 8) / 255])[0]
            - versLab([(k - 8) / 255, (k - 8) / 255, (k - 8) / 255])[0]));
    }
    check('powV2 : aucune pente ecrasee dans la courbe', penteMini, 0.3, 2);

    /* 4. LES HAUTES LUMIERES SONT RETENUES, jamais brulees. */
    const blanc = v2([1, 1, 1]).map((v) => Math.round(v * 255));
    check('powV2 : plafond mesure', Math.max(...blanc), 234, 244);
    check('powV2 : n\'ecrete pas', Math.max(...blanc), 0, 254);
    check('powV2 : le blanc est creme', gris(v2, 1)[2], 4, 8, ' b*');
    check('powV2 : le blanc ne verdit pas', gris(v2, 1)[1], -2.5, 1, ' a*');

    /* 5. LA COULEUR EST CELLE DE LA FAMILLE. Meme signature que
     * `powlishermain`, reajustee sous la courbe: ombres vert-cyan, bas-tons
     * orange, creme du milieu au blanc, verts affaiblis, ciel qui converge. */
    check('powV2 : ombres vert-cyan', gris(v2, 0.10)[1], -4, -1, ' a*');
    check('powV2 : bas-tons orange', gris(v2, 0.40)[1], 1.8, 4.5, ' a*');
    check('powV2 : le creme culmine au milieu', gris(v2, 0.55)[2], 6, 9, ' b*');
    const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
    const vert = [0.30, 0.50, 0.25];
    check('powV2 : le vert perd sa couleur', chromaDe(v2(vert)) / chromaDe(vert), 0.4, 0.75, '×');
    const teinteTsl = (rgb) => {
        const [r, g, b] = rgb;
        const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
        if (d <= 0) return 0;
        const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return (((h * 60) % 360) + 360) % 360;
    };
    check('powV2 : le ciel arrive dans sa fenetre', teinteTsl(v2([0.35, 0.55, 0.85])), 182, 205, '°');
    const dejaCyan = [0.45, 0.70, 0.78];
    check('powV2 : un ciel deja cyan ne part pas au menthe',
        Math.abs(teinteTsl(v2(dejaCyan)) - teinteTsl(dejaCyan)), 0, 12, '°');
    const magenta = [0.70, 0.25, 0.60];
    check('powV2 : le magenta n\'est pas tourne',
        Math.abs(teinteTsl(v2(magenta)) - teinteTsl(magenta)), 0, 14, '°');

    /* 6. Les gardes communs. */
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = versLab(v2([k / 255, k / 255, k / 255]))[0];
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powV2 : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    check('powV2 : n\'ajoute pas de contour', amplificationVoile(v2) - voileV1, -4, 0.6, '×');
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powV2 : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chromaDe(v2(rgb)) / chromaDe(rgb))), 0, 1.3, '×');
}

/* ---------- powV3 : la meme couleur, une autre densite ----------------------
 *
 * La regle de la famille (`ambre` / `ambre-nuit-1` / `ambre-nuit-2`) est qu'une
 * declinaison de densite ne touche PAS a la couleur: c'est le style, et ce n'est
 * pas lui qu'on corrige. Ce bloc verifie exactement ca, plus la courbe de nuit.
 */
{
    const v2 = getPresetTransform('powV2');
    const v3 = getPresetTransform('powV3');
    if (!v3) { console.error('ECHEC: powV3 introuvable.'); process.exit(1); }

    /* 1. IL EST PLUS SOMBRE, et c'est tout ce qui le distingue. */
    const gris = (f, v) => versLab(f([v, v, v]));
    check('powV3 : plus sombre que powV2 dans les medians',
        gris(v2, 0.5)[0] - gris(v3, 0.5)[0], 3, 9, ' L*');
    const blanc = v3([1, 1, 1]).map((v) => Math.round(v * 255));
    check('powV3 : plafond mesure', Math.max(...blanc), 200, 212);
    check('powV3 : n\'ecrete pas', Math.max(...blanc), 0, 254);

    /* 2. SA COULEUR EST CELLE DE powV2. On compare a NIVEAU DE SORTIE EGAL:
     * pour chaque gris, on cherche l'entree de powV2 qui sort au meme L* que
     * powV3, et on veut la meme teinte. Sinon on mesurerait la courbe une
     * seconde fois et pas la couleur. */
    let ecartCouleur = 0;
    for (let k = 24; k <= 232; k += 8) {
        const cible = gris(v3, k / 255);
        let meilleur = null;
        for (let j = 0; j <= 255; j += 1) {
            const c = gris(v2, j / 255);
            const d = Math.abs(c[0] - cible[0]);
            if (!meilleur || d < meilleur.d) meilleur = { d, a: c[1], b: c[2] };
        }
        if (meilleur.d > 1) continue;
        ecartCouleur = Math.max(ecartCouleur, Math.hypot(meilleur.a - cible[1], meilleur.b - cible[2]));
    }
    check('powV3 : sa couleur est celle de powV2', ecartCouleur, 0, 1.2, ' a*b*');

    /* 3. Les gardes communs, comme partout. */
    let penteMini = 9;
    for (let k = 8; k <= 247; k += 8) {
        const bas = versLab([(k - 8) / 255, (k - 8) / 255, (k - 8) / 255])[0];
        const haut = versLab([(k + 8) / 255, (k + 8) / 255, (k + 8) / 255])[0];
        penteMini = Math.min(penteMini,
            (gris(v3, (k + 8) / 255)[0] - gris(v3, (k - 8) / 255)[0]) / (haut - bas));
    }
    check('powV3 : aucune pente ecrasee dans la courbe', penteMini, 0.3, 2);
    check('powV3 : le noir pur reste noir', Math.max(...v3([0, 0, 0])) * 255, 0, 1);
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = gris(v3, k / 255)[0];
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powV3 : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    check('powV3 : n\'ajoute pas de contour', amplificationVoile(v3) - voileV1, -4, 0.6, '×');
    const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powV3 : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chromaDe(v3(rgb)) / chromaDe(rgb))), 0, 1.3, '×');
}

/* ---------- powV4 : sa photo de nuit, couleur remesuree dessus ---------------
 *
 * `powV3` reprend la couleur de `powV2` et n'en change que la densite. `powV4`
 * remesure la couleur elle-meme sur la seule paire de nuit, une fois son masque
 * local retire. Ce bloc fige ce qui l'en distingue — sinon rien n'empecherait
 * de le ramener silencieusement sur les valeurs de la famille.
 */
{
    const v2 = getPresetTransform('powV2');
    const v4 = getPresetTransform('powV4');
    if (!v4) { console.error('ECHEC: powV4 introuvable.'); process.exit(1); }
    const gris = (f, v) => versLab(f([v, v, v]));

    /* 1. C'EST UN REGISTRE DE NUIT: il assombrit, plafond retenu. */
    check('powV4 : plus sombre que powV2 dans les medians',
        gris(v2, 0.5)[0] - gris(v4, 0.5)[0], 3, 9, ' L*');
    const blanc = v4([1, 1, 1]).map((v) => Math.round(v * 255));
    check('powV4 : plafond mesure', Math.max(...blanc), 198, 212);
    check('powV4 : n\'ecrete pas', Math.max(...blanc), 0, 254);

    /* 2. LA TROUVAILLE: ses bas-tons de nuit sont MOINS CHAUDS que ceux de ses
     * deux photos de jour. Mesure b* +2,96 a L 30 contre +4,67 pour `powV2`.
     * On compare a niveau de sortie egal, sinon on mesurerait la courbe. */
    const bAuNiveau = (f, cibleL) => {
        let best = null;
        for (let k = 0; k <= 255; k += 1) {
            const c = gris(f, k / 255);
            const d = Math.abs(c[0] - cibleL);
            if (!best || d < best.d) best = { d, b: c[2], a: c[1] };
        }
        return best;
    };
    const n4 = bAuNiveau(v4, 30), n2 = bAuNiveau(v2, 30);
    check('powV4 : ses bas-tons de nuit sont moins chauds', n2.b - n4.b, 0.8, 3.5, ' b*');

    /* 3. SON CIEL EST PLUS SOURD. Chroma mesuree 0,611 contre 0,85 sur 1 183
     * blocs de ciel — mais il atterrit dans la meme fenetre de teinte. */
    const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
    const cielJour = [0.35, 0.55, 0.85];
    check('powV4 : son ciel est plus sourd que celui de powV2',
        chromaDe(v4(cielJour)) / chromaDe(v2(cielJour)), 0.55, 0.95, '×');
    const teinteTsl = (rgb) => {
        const [r, g, b] = rgb;
        const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
        if (d <= 0) return 0;
        const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return (((h * 60) % 360) + 360) % 360;
    };
    check('powV4 : son ciel arrive dans la meme fenetre', teinteTsl(v4(cielJour)), 182, 205, '°');
    const dejaCyan = [0.45, 0.70, 0.78];
    check('powV4 : un ciel deja cyan ne part pas au menthe',
        Math.abs(teinteTsl(v4(dejaCyan)) - teinteTsl(dejaCyan)), 0, 12, '°');

    /* 4. Les gardes communs. */
    let penteMini = 9;
    for (let k = 8; k <= 247; k += 8) {
        const bas = versLab([(k - 8) / 255, (k - 8) / 255, (k - 8) / 255])[0];
        const haut = versLab([(k + 8) / 255, (k + 8) / 255, (k + 8) / 255])[0];
        penteMini = Math.min(penteMini,
            (gris(v4, (k + 8) / 255)[0] - gris(v4, (k - 8) / 255)[0]) / (haut - bas));
    }
    check('powV4 : aucune pente ecrasee dans la courbe', penteMini, 0.3, 2);
    check('powV4 : le noir pur reste noir', Math.max(...v4([0, 0, 0])) * 255, 0, 1);
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = gris(v4, k / 255)[0];
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powV4 : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    check('powV4 : n\'ajoute pas de contour', amplificationVoile(v4) - voileV1, -4, 0.6, '×');
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powV4 : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chromaDe(v4(rgb)) / chromaDe(rgb))), 0, 1.3, '×');

    /* 5. ET `powV3` N'A PAS BOUGE. La fabrique est desormais partagee par trois
     * presets; ce controle attrape le jour ou l'un deballerait sur l'autre.
     * Les valeurs sont RELEVEES sur la version d'avant le partage, pas
     * calculees de tete: la premiere ecriture de ce test en portait une
     * inventee, et c'est le test lui-meme qui l'a signalee. */
    const v3 = getPresetTransform('powV3');
    let derive = 0;
    for (const rgb of [[0.2, 0.3, 0.5], [0.8, 0.2, 0.2], [0.5, 0.5, 0.5], [1, 1, 1], [0.1, 0.12, 0.22]]) {
        const o = v3(rgb).map((v) => Math.round(v * 255));
        const attendu = { '0.2,0.3,0.5': [0, 65, 79], '0.8,0.2,0.2': [165, 14, 20],
            '0.5,0.5,0.5': [107, 95, 86], '1,1,1': [204, 198, 186],
            '0.1,0.12,0.22': [0, 29, 39] }[rgb.join(',')];
        if (attendu) derive = Math.max(derive, Math.max(...o.map((v, i) => Math.abs(v - attendu[i]))));
    }
    check('powV3 n\'a pas bouge en accueillant powV4', derive, 0, 1);
}

/* ---------- powV5 : la couleur de powV4, au niveau de son image -------------
 *
 * `powV4` prend son NIVEAU sur la zone que le masque ne touche pas; `powV5` le
 * prend sur le cadre entier, c'est-a-dire sur ce que l'oeil voit. Seule la
 * courbe les separe — ce bloc le verifie, et fige la chute.
 */
{
    const v4 = getPresetTransform('powV4');
    const v5 = getPresetTransform('powV5');
    if (!v5) { console.error('ECHEC: powV5 introuvable.'); process.exit(1); }
    const gris = (f, v) => versLab(f([v, v, v]));

    /* 1. IL DESCEND TRES BAS, et c'est le geste entier. */
    check('powV5 : bien plus sombre que powV4', gris(v4, 0.5)[0] - gris(v5, 0.5)[0], 8, 18, ' L*');
    const blanc = v5([1, 1, 1]).map((v) => Math.round(v * 255));
    check('powV5 : plafond mesure', Math.max(...blanc), 120, 142);
    check('powV5 : n\'ecrete pas', Math.max(...blanc), 0, 254);

    /* 2. SA COULEUR EST CELLE DE powV4, a niveau de sortie egal — sinon on
     * mesurerait la courbe une seconde fois. Meme controle que powV3/powV2. */
    let ecartCouleur = 0;
    for (let k = 40; k <= 248; k += 8) {
        const cible = gris(v5, k / 255);
        let meilleur = null;
        for (let j = 0; j <= 255; j += 1) {
            const c = gris(v4, j / 255);
            const d = Math.abs(c[0] - cible[0]);
            if (!meilleur || d < meilleur.d) meilleur = { d, a: c[1], b: c[2] };
        }
        if (meilleur.d > 1) continue;
        ecartCouleur = Math.max(ecartCouleur, Math.hypot(meilleur.a - cible[1], meilleur.b - cible[2]));
    }
    check('powV5 : sa couleur est celle de powV4', ecartCouleur, 0, 1.2, ' a*b*');

    /* 3. Les gardes communs. Malgre la chute, rien n'est ecrase ni ecrete. */
    let penteMini = 9;
    for (let k = 8; k <= 247; k += 8) {
        const bas = versLab([(k - 8) / 255, (k - 8) / 255, (k - 8) / 255])[0];
        const haut = versLab([(k + 8) / 255, (k + 8) / 255, (k + 8) / 255])[0];
        penteMini = Math.min(penteMini,
            (gris(v5, (k + 8) / 255)[0] - gris(v5, (k - 8) / 255)[0]) / (haut - bas));
    }
    check('powV5 : aucune pente ecrasee dans la courbe', penteMini, 0.28, 2);
    check('powV5 : le noir pur reste noir', Math.max(...v5([0, 0, 0])) * 255, 0, 1);
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = gris(v5, k / 255)[0];
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powV5 : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    check('powV5 : n\'ajoute pas de contour', amplificationVoile(v5) - voileV1, -4, 0.6, '×');
    const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powV5 : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chromaDe(v5(rgb)) / chromaDe(rgb))), 0, 1.3, '×');

    /* 4. ET `powV4` N'A PAS BOUGE. Valeurs RELEVEES avant l'ajout, pas ecrites
     * de tete: la premiere version de ce controle-la, pour powV3, portait un
     * chiffre invente et a echoue alors que le code etait juste. */
    let derive = 0;
    for (const [rgb, attendu] of [[[0.2, 0.3, 0.5], [22, 63, 74]], [[0.8, 0.2, 0.2], [172, 0, 13]],
        [[0.5, 0.5, 0.5], [108, 98, 90]], [[1, 1, 1], [210, 204, 192]]]) {
        const o = v4(rgb).map((v) => Math.round(v * 255));
        derive = Math.max(derive, Math.max(...o.map((v, i) => Math.abs(v - attendu[i]))));
    }
    check('powV4 n\'a pas bouge en accueillant powV5', derive, 0, 1);
}

/* ---------- powV6 : le degrade du bas, un effet de POSITION mesure ----------
 *
 * Premier effet spatial du projet dont la forme ET la force sortent d'une
 * mesure. Il existe parce que le vignetage ne pouvait PAS repondre au probleme:
 * sur la photo qui l'a motive, `powV5` seul fait 5,41 de dE76 et `powV5` plus
 * vignetage fait 5,46 a 5,99 selon la dose — le vignetage, radial, assombrit le
 * haut du cadre, qui etait deja juste. Le degrade fait 3,03.
 */
{
    /* Un contexte de canvas minimal: l'effet ne fait que lire et reecrire des
     * pixels, il n'a besoin de rien d'autre. */
    const faireCtx = (w, h, valeur) => {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i += 1) {
            data[i * 4] = valeur; data[i * 4 + 1] = valeur;
            data[i * 4 + 2] = valeur; data[i * 4 + 3] = 255;
        }
        const image = { data, width: w, height: h };
        return { image, getImageData: () => image, putImageData: () => {} };
    };
    const versLin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    /* 401 lignes, pas 101: sur une image minuscule la pente REELLE du degrade
     * suffit a faire 4/255 entre deux lignes, et le test ne dirait plus rien de
     * la quantification. A 401 comme a 1 200 lignes, la mesure donne 1/255. */
    const W = 8, H = 401;
    const lire = (ctx, y) => ctx.image.data[(y * W) * 4];

    /* 1. AU REPOS, IL NE FAIT RIEN. */
    const repos = faireCtx(W, H, 180);
    applyDegradeBas(repos, W, H, 0);
    check('dégradé : à 0 il ne fait rien', Math.abs(lire(repos, H - 1) - 180), 0, 0);

    /* 2. LE HAUT ET LE MILIEU NE BOUGENT PAS: la rampe part du milieu du cadre.
     * C'est ce qui le distingue d'un vignetage, et c'est la raison d'etre de
     * l'effet — le haut de la photo mesuree etait deja juste. */
    const ctx = faireCtx(W, H, 180);
    applyDegradeBas(ctx, W, H, 66);
    check('dégradé : le haut du cadre ne bouge pas', Math.abs(lire(ctx, 0) - 180), 0, 0);
    check('dégradé : le milieu du cadre ne bouge pas', Math.abs(lire(ctx, (H - 1) / 2) - 180), 0, 1);

    /* 3. LE BAS TOMBE DE CE QU'ON A MESURE. L'echelle est: 100 = quatre
     * diaphragmes; le reglage de `powV6` vaut 66, soit -2,64. */
    const chute = Math.log2(versLin(lire(ctx, H - 1)) / versLin(180));
    check('dégradé : le bas tombe de la valeur mesurée', chute, -2.85, -2.45, ' diaph');

    /* 4. LA RAMPE EST MONOTONE ET LISSE: aucune ligne plus claire que celle du
     * dessus, et aucun saut visible d'une ligne a l'autre. */
    let monotone = true;
    let sautMax = 0;
    for (let y = 1; y < H; y += 1) {
        const v = lire(ctx, y), p = lire(ctx, y - 1);
        if (v > p) monotone = false;
        sautMax = Math.max(sautMax, p - v);
    }
    check('dégradé : la rampe ne remonte jamais', monotone ? 1 : 0, 1, 1);
    /* Ce test a servi: la premiere version quantifiait le gain en 64 paliers et
     * posait 4/255 de marche, sans que ca baisse quand l'image grandissait —
     * une bande. Le gain est desormais calcule ligne par ligne. */
    check('dégradé : aucune marche de quantification', sautMax, 0, 2, ' /255');

    /* 5. IL EST BORNE COTE MOTEUR, comme tous les reglages du projet. */
    const bornes = visionBoundsFor('degradeBas');
    check('dégradé : borné côté moteur', bornes && bornes.max > 0 ? 1 : 0, 1, 1);

    /* 6. powV6 PORTE LE REGLAGE MESURE, et sa couleur est exactement celle de
     * `powV5`: seul l'effet spatial les separe. */
    const p6 = VISION_PRESETS.find((p) => p.id === 'powV6');
    check('powV6 : porte le dégradé mesuré', p6?.spatialFilters?.degradeBas ?? 0, 66, 66);
    const v5 = getPresetTransform('powV5');
    let ecart = 0;
    for (const rgb of [[0.2, 0.3, 0.5], [0.8, 0.2, 0.2], [0.5, 0.5, 0.5], [1, 1, 1]]) {
        const a = p6.transform(rgb), b = v5(rgb);
        ecart = Math.max(ecart, Math.max(...a.map((v, i) => Math.abs(v - b[i]) * 255)));
    }
    check('powV6 : sa couleur est celle de powV5, au bit près', ecart, 0, 0);
}

/* ---------- powV7 : les hautes lumieres relevees, et la borne qui l'arrete ---
 *
 * Ce bloc fige ce qui distingue `powV7` de `powV6`: un releve des hautes
 * lumieres, ne au constat que son image etait 22,6 L* plus claire que la notre
 * a un niveau d'entree de 75-85 (les LED de la station) alors que l'ecart
 * n'etait que de 1,0 a 55-65.
 */
{
    const v6 = getPresetTransform('powV6');
    const v7 = getPresetTransform('powV7');
    if (!v7) { console.error('ECHEC: powV7 introuvable.'); process.exit(1); }
    const gris = (f, v) => versLab(f([v, v, v]));

    /* 1. LE RELEVE EXISTE, ET IL NE TOUCHE QUE LE HAUT. C'est tout l'objet du
     * preset: une epaule globale releverait aussi les medians. */
    /* Valeur relevee: 24,95 L*. La fourchette encadre la mesure, elle ne la
     * precede pas — meme regle que partout dans ce fichier. */
    check('powV7 : les hautes lumières remontent', gris(v7, 0.82)[0] - gris(v6, 0.82)[0], 18, 32, ' L*');
    check('powV7 : les médians ne bougent presque pas',
        Math.abs(gris(v7, 0.40)[0] - gris(v6, 0.40)[0]), 0, 3, ' L*');
    check('powV7 : les ombres ne bougent pas',
        Math.abs(gris(v7, 0.12)[0] - gris(v6, 0.12)[0]), 0, 2, ' L*');

    /* 2. LA BORNE QUI L'ARRETE. Laisse libre, le releve montait a une pente de
     * 3,62 L* par L* et faisait ECHOUER le test d'amplification (3,71x contre
     * 3,63 autorise): une pente de p amplifie le bruit de p. Ce test-la est la
     * raison pour laquelle l'ecart des LED s'arrete a +9,3 au lieu de +4,1. */
    let penteMax = 0;
    for (let k = 8; k <= 247; k += 8) {
        const bas = versLab([(k - 8) / 255, (k - 8) / 255, (k - 8) / 255])[0];
        const haut = versLab([(k + 8) / 255, (k + 8) / 255, (k + 8) / 255])[0];
        penteMax = Math.max(penteMax,
            (gris(v7, (k + 8) / 255)[0] - gris(v7, (k - 8) / 255)[0]) / (haut - bas));
    }
    check('powV7 : la pente reste sous la borne', penteMax, 0, 2.4);
    check('powV7 : n\'ajoute pas de contour', amplificationVoile(v7) - voileV1, -4, 0.6, '×');

    /* 3. Les gardes communs. */
    let penteMini = 9;
    for (let k = 8; k <= 247; k += 8) {
        const bas = versLab([(k - 8) / 255, (k - 8) / 255, (k - 8) / 255])[0];
        const haut = versLab([(k + 8) / 255, (k + 8) / 255, (k + 8) / 255])[0];
        penteMini = Math.min(penteMini,
            (gris(v7, (k + 8) / 255)[0] - gris(v7, (k - 8) / 255)[0]) / (haut - bas));
    }
    check('powV7 : aucune pente écrasée', penteMini, 0.25, 3);
    check('powV7 : le noir pur reste noir', Math.max(...v7([0, 0, 0])) * 255, 0, 1);
    check('powV7 : n\'écrête pas', Math.max(...v7([1, 1, 1]).map((v) => Math.round(v * 255))), 0, 254);
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = gris(v7, k / 255)[0];
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powV7 : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powV7 : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chromaDe(v7(rgb)) / chromaDe(rgb))), 0, 1.3, '×');

    /* 4. SON DEGRADE TIENT DANS LE PLAFOND. Il vaut 80 et non 82, la valeur
     * brute de l'ajustement: au-dela du plafond le moteur ramene EN SILENCE, et
     * le preset n'annoncerait pas ce qu'il rend. Le controle general au-dessus
     * l'a attrape; celui-ci nomme le cas. */
    const p7 = VISION_PRESETS.find((p) => p.id === 'powV7');
    const borne = visionBoundsFor('degradeBas', { safe: true });
    check('powV7 : son dégradé tient dans le plafond du mode sûr',
        p7.spatialFilters.degradeBas <= borne.max ? 1 : 0, 1, 1);

    /* 5. ET `powV6` N'A PAS BOUGE. Valeurs RELEVEES en executant le preset,
     * pas ecrites de tete: c'est la troisieme fois de la serie que ce genre de
     * controle echoue parce que le chiffre attendu avait ete devine. La regle
     * est dans `docs/pieges-connus.md`. */
    let derive = 0;
    for (const [rgb, attendu] of [[[0.2, 0.3, 0.5], [0, 42, 51]], [[0.8, 0.2, 0.2], [110, 4, 5]],
        [[0.5, 0.5, 0.5], [64, 62, 59]], [[1, 1, 1], [141, 129, 119]]]) {
        const o = v6(rgb).map((v) => Math.round(v * 255));
        derive = Math.max(derive, Math.max(...o.map((v, i) => Math.abs(v - attendu[i]))));
    }
    check('powV6 n\'a pas bougé en accueillant powV7', derive, 0, 1);
}

/* ---------- powV8 : la luminance par teinte, et le sol degris -----------------
 *
 * Ce bloc fige le levier ajoute au melangeur pour ce preset — la LUMINANCE par
 * teinte, le troisieme curseur de celui de Lightroom — et le controle qui l'a
 * impose: ses rouges sont 1,5 fois plus lumineux que les notres, alors que son
 * ciel bleu est a 0,99. Une courbe aurait touche les deux.
 */
{
    const v7 = getPresetTransform('powV7');
    const v8 = getPresetTransform('powV8');
    if (!v8) { console.error('ECHEC: powV8 introuvable.'); process.exit(1); }
    const L = (f, c) => versLab(f(c))[0];
    const C = (f, c) => Math.hypot(...versLab(f(c)).slice(1));
    const rouge = [0.80, 0.14, 0.13];

    /* 1. LE ROUGE MONTE. Valeur relevee: x1,514. */
    check('powV8 : le rouge gagne en lumière', L(v8, rouge) / L(v7, rouge), 1.35, 1.70, '×');
    check('powV8 : le rouge gagne en couleur', C(v8, rouge) / C(v7, rouge), 1.15, 1.60, '×');

    /* 2. ET RIEN D'AUTRE NE MONTE. C'est ce qui separe une luminance PAR TEINTE
     * d'une courbe: le gris et le ciel ne doivent pas bouger d'un pouce. Sans
     * ce controle, on ne saurait pas si le levier fait ce qu'il annonce. */
    check('powV8 : le gris ne bouge pas', Math.abs(L(v8, [0.5, 0.5, 0.5]) - L(v7, [0.5, 0.5, 0.5])), 0, 0.5, ' L*');
    check('powV8 : le ciel ne bouge pas',
        Math.abs(L(v8, [0.35, 0.55, 0.85]) - L(v7, [0.35, 0.55, 0.85])), 0, 0.5, ' L*');

    /* 3. LE SOL SE DEGRISE: le virage descend dans les ombres (a* -1,02 mesure
     * sur 1 568 blocs de sortie a L 0-4). */
    /* Valeur relevee: -3,23. C'est fort, et c'est le prix du sol: l'ancre L=5
     * a ete resolue pour rendre au sol ce que le fondu vers le noir lui prenait.
     * Sur une autre photo, ce vert se verra dans les ombres — c'est dans la
     * reserve du preset. */
    check('powV8 : les ombres virent plus au vert-cyan',
        versLab(v8([0.10, 0.10, 0.10]))[1] - versLab(v7([0.10, 0.10, 0.10]))[1], -4.5, -1.5, ' a*');

    /* 4. Les gardes communs. La luminance par teinte est sous le meme garde-fou
     * de chroma que le reste: un pixel sans teinte fiable ne change pas de
     * niveau, sinon la regle trace un contour la ou la photo etait lisse. */
    check('powV8 : n\'ajoute pas de contour', amplificationVoile(v8) - voileV1, -4, 0.6, '×');
    check('powV8 : le noir pur reste noir', Math.max(...v8([0, 0, 0])) * 255, 0, 1);
    check('powV8 : n\'écrête pas', Math.max(...v8([1, 1, 1]).map((v) => Math.round(v * 255))), 0, 254);
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = L(v8, [k / 255, k / 255, k / 255]);
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powV8 : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powV8 : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => C(v8, rgb) / Math.hypot(...versLab(rgb).slice(1)))), 0, 1.3, '×');

    /* 5. ET `powV7` N'A PAS BOUGE. Le troisieme terme du melangeur vaut 1 par
     * defaut, donc aucune table a deux valeurs ne change. Valeurs RELEVEES. */
    let derive = 0;
    for (const [rgb, attendu] of [[[0.2, 0.3, 0.5], [0, 45, 57]], [[0.8, 0.2, 0.2], [116, 0, 0]],
        [[0.5, 0.5, 0.5], [67, 61, 56]], [[1, 1, 1], [225, 220, 208]]]) {
        const o = v7(rgb).map((v) => Math.round(v * 255));
        derive = Math.max(derive, Math.max(...o.map((v, i) => Math.abs(v - attendu[i]))));
    }
    check('powV7 n\'a pas bougé en accueillant powV8', derive, 0, 1);
}

/* ---------- powV9 : le sol degris, et l'ordre des leviers ---------------------
 *
 * Ce bloc fige ce qui separe `powV9` de `powV8`: les deux secteurs CHAUDS du
 * melangeur, tournes et desatures pour que le sol de beton mouille tombe sur le
 * gris-bleu du sien (teinte Lab 123 contre sa cible 122, au lieu de 90).
 *
 * Il fige aussi ce qui NE devait pas bouger — le rouge et le ciel — parce que
 * c'est la seule facon de savoir que la correction a porte la ou il fallait.
 */
{
    const v8 = getPresetTransform('powV8');
    const v9 = getPresetTransform('powV9');
    if (!v9) { console.error('ECHEC: powV9 introuvable.'); process.exit(1); }
    const teinte = (f, c) => {
        const [, a, b] = versLab(f(c));
        return ((Math.atan2(b, a) * 180 / Math.PI) + 360) % 360;
    };
    const chroma = (f, c) => Math.hypot(...versLab(f(c)).slice(1));

    /* 1. LE CHAUD TOURNE VERS LE VERT. Valeur relevee sur un beton chaud:
     * +46 degres. C'est fort, et c'est assume — voir la reserve du preset. */
    const beton = [0.32, 0.30, 0.28];
    check('powV9 : le sol chaud vire au gris-vert', teinte(v9, beton) - teinte(v8, beton), 30, 60, '°');
    /* Sa CHROMA, elle, ne baisse pas: 1,33x releve. Les gains de secteur sont
     * pourtant plus bas que ceux de `powV8` (0,50 et 0,65 contre 0,91 et 1,17),
     * mais la rotation amene la couleur sur un secteur voisin et le virage
     * s'ajoute par-dessus. Ce qui change sur le sol est la TEINTE, pas la
     * quantite de couleur — le test le dit tel quel plutot que l'inverse. */
    check('powV9 : sa chroma ne s\'effondre pas', chroma(v9, beton) / chroma(v8, beton), 0.8, 1.8, '×');

    /* 2. LE ROUGE ET LE CIEL NE BOUGENT PAS. Sans ce controle, on ne saurait
     * pas si la correction a porte sur le sol ou sur toute l'image. */
    const rouge = [0.80, 0.14, 0.13];
    check('powV9 : le rouge ne bouge pas',
        Math.abs(versLab(v9(rouge))[0] - versLab(v8(rouge))[0]), 0, 1, ' L*');
    check('powV9 : le ciel ne bouge pas',
        Math.abs(teinte(v9, [0.35, 0.55, 0.85]) - teinte(v8, [0.35, 0.55, 0.85])), 0, 5, '°');

    /* 3. LE GARDE-FOU DU PROJET N'A PAS BOUGE, et c'est le point du lot: resolu
     * APRES le virage, le melangeur demande la moitie de ce qu'il demandait
     * avant, et l'amplification dans un voile reste ou elle etait. */
    check('powV9 : n\'ajoute pas de contour', amplificationVoile(v9) - voileV1, -4, 0.6, '×');

    /* 4. Les gardes communs. */
    check('powV9 : le noir pur reste noir', Math.max(...v9([0, 0, 0])) * 255, 0, 1);
    check('powV9 : n\'écrête pas', Math.max(...v9([1, 1, 1]).map((v) => Math.round(v * 255))), 0, 254);
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = versLab(v9([k / 255, k / 255, k / 255]))[0];
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powV9 : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powV9 : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chroma(v9, rgb) / Math.hypot(...versLab(rgb).slice(1)))), 0, 1.3, '×');

    /* 5. ET `powV8` N'A PAS BOUGE. Valeurs RELEVEES. */
    let derive = 0;
    for (const [rgb, attendu] of [[[0.2, 0.3, 0.5], [0, 45, 57]], [[0.8, 0.2, 0.2], [163, 16, 12]],
        [[0.5, 0.5, 0.5], [66, 61, 56]], [[1, 1, 1], [225, 220, 208]]]) {
        const o = v8(rgb).map((v) => Math.round(v * 255));
        derive = Math.max(derive, Math.max(...o.map((v, i) => Math.abs(v - attendu[i]))));
    }
    check('powV8 n\'a pas bougé en accueillant powV9', derive, 0, 1);
}

/* ---------- powV10 : la pente, les blancs, et les fissures -------------------
 *
 * Ce bloc fige la raison d'etre du preset: la pente maximale de sa courbe. Elle
 * tombe de 2,19 a 1,58 — et comme une pente de p amplifie le bruit de p, c'est
 * elle qui faisait apparaitre des « fissures » autour des enseignes de la
 * station. Le meme changement remonte les blancs de 8 L*.
 */
{
    const v9 = getPresetTransform('powV9');
    const v10 = getPresetTransform('powV10');
    if (!v10) { console.error('ECHEC: powV10 introuvable.'); process.exit(1); }
    const gris = (f, v) => versLab(f([v, v, v]))[0];
    const pente = (f) => {
        let m = 0;
        for (let k = 8; k <= 247; k += 8) {
            const a = (k - 8) / 255, b = (k + 8) / 255;
            const d = versLab([b, b, b])[0] - versLab([a, a, a])[0];
            m = Math.max(m, (gris(f, b) - gris(f, a)) / d);
        }
        return m;
    };

    /* 1. LA PENTE BAISSE, et c'est tout l'objet du preset. Valeurs relevees:
     * 2,19 pour `powV9`, 1,58 ici. */
    check('powV10 : sa pente maximale baisse', pente(v10), 1.3, 1.8);
    check('powV10 : elle est plus douce que celle de powV9', pente(v9) - pente(v10), 0.35, 0.9);

    /* 2. LES BLANCS REMONTENT dans la zone des enseignes (entree L 72), sans
     * que les ombres ni les medians ne bougent: c'est un relevé, pas une
     * courbe plus claire. */
    const aL = (l) => {
        const t = (l + 16) / 116;
        const Y = t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787;
        return Y <= 0.0031308 ? Y * 12.92 : 1.055 * Y ** (1 / 2.4) - 0.055;
    };
    check('powV10 : les enseignes remontent', gris(v10, aL(72)) - gris(v9, aL(72)), 4, 12, ' L*');
    check('powV10 : les ombres ne bougent presque pas',
        Math.abs(gris(v10, aL(20)) - gris(v9, aL(20))), 0, 1.5, ' L*');

    /* 3. Les gardes communs. */
    check('powV10 : n\'ajoute pas de contour', amplificationVoile(v10) - voileV1, -4, 0.6, '×');
    check('powV10 : le noir pur reste noir', Math.max(...v10([0, 0, 0])) * 255, 0, 1);
    check('powV10 : n\'écrête pas', Math.max(...v10([1, 1, 1]).map((v) => Math.round(v * 255))), 0, 254);
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = gris(v10, k / 255);
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powV10 : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powV10 : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chromaDe(v10(rgb)) / chromaDe(rgb))), 0, 1.3, '×');

    /* 4. ET `powV9` N'A PAS BOUGE. Valeurs RELEVEES. */
    let derive = 0;
    for (const [rgb, attendu] of [[[0.2, 0.3, 0.5], [0, 46, 59]], [[0.8, 0.2, 0.2], [165, 10, 12]],
        [[0.5, 0.5, 0.5], [65, 61, 58]], [[1, 1, 1], [226, 220, 208]]]) {
        const o = v9(rgb).map((v) => Math.round(v * 255));
        derive = Math.max(derive, Math.max(...o.map((v, i) => Math.abs(v - attendu[i]))));
    }
    check('powV9 n\'a pas bougé en accueillant powV10', derive, 0, 1);
}

/* ---------- powV11 : le dernier point de blanc ------------------------------
 *
 * `powV10` laissait 3,5 L* sur les blancs des enseignes et j'avais mis tout
 * l'ecart sur le compte de son masque. Un cinquieme etait recuperable: sa
 * grille de recherche avait manque un meilleur point. Ce bloc fige le gain et
 * la borne qui l'encadre.
 */
{
    const v10 = getPresetTransform('powV10');
    const v11 = getPresetTransform('powV11');
    if (!v11) { console.error('ECHEC: powV11 introuvable.'); process.exit(1); }
    const gris = (f, v) => versLab(f([v, v, v]))[0];
    const aL = (l) => {
        const t = (l + 16) / 116;
        const Y = t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787;
        return Y <= 0.0031308 ? Y * 12.92 : 1.055 * Y ** (1 / 2.4) - 0.055;
    };
    const pente = (f) => {
        let m = 0;
        for (let k = 8; k <= 247; k += 8) {
            const a = (k - 8) / 255, b = (k + 8) / 255;
            const d = versLab([b, b, b])[0] - versLab([a, a, a])[0];
            m = Math.max(m, (gris(f, b) - gris(f, a)) / d);
        }
        return m;
    };

    /* 1. LES BLANCS MONTENT ENCORE UN PEU, et la pente reste douce. Valeurs
     * relevees: +2,0 L* a l'entree L 80, pente 1,64 contre 1,58. */
    check('powV11 : les blancs des enseignes montent', gris(v11, aL(80)) - gris(v10, aL(80)), 0.8, 4, ' L*');
    check('powV11 : sa pente reste douce', pente(v11), 1.4, 1.9);

    /* 2. ET RIEN D'AUTRE NE BOUGE: c'est un dernier cran sur le haut, pas une
     * courbe plus claire. */
    check('powV11 : les ombres ne bougent pas',
        Math.abs(gris(v11, aL(20)) - gris(v10, aL(20))), 0, 1, ' L*');
    check('powV11 : les médians ne bougent pas',
        Math.abs(gris(v11, aL(45)) - gris(v10, aL(45))), 0, 1, ' L*');

    /* 3. Les gardes communs. */
    check('powV11 : n\'ajoute pas de contour', amplificationVoile(v11) - voileV1, -4, 0.6, '×');
    check('powV11 : le noir pur reste noir', Math.max(...v11([0, 0, 0])) * 255, 0, 1);
    check('powV11 : n\'écrête pas', Math.max(...v11([1, 1, 1]).map((v) => Math.round(v * 255))), 0, 254);
    let monotone = true;
    let precedent = -1;
    for (let k = 0; k <= 255; k += 1) {
        const y = gris(v11, k / 255);
        if (y < precedent - 1e-9) monotone = false;
        precedent = y;
    }
    check('powV11 : rampe grise croissante', monotone ? 1 : 0, 1, 1);
    const chromaDe = (rgb) => Math.hypot(...versLab(rgb).slice(1));
    const echantillons = [[0.72, 0.52, 0.32], [0.34, 0.45, 0.24], [0.45, 0.62, 0.82], [0.80, 0.60, 0.48]];
    check('powV11 : n\'ajoute pas de saturation',
        Math.max(...echantillons.map((rgb) => chromaDe(v11(rgb)) / chromaDe(rgb))), 0, 1.3, '×');

    /* 4. LE MELANGEUR A DEUX JEUX, un sombre et un clair, et c'est ce qui a
     * degrise le blanc des enseignes. Le controle tient en deux couleurs de la
     * MEME famille de teinte: la claire doit gagner de la couleur, la sombre ne
     * doit pas bouger. Sans la seconde, on ne saurait pas si le jeu clair a bien
     * ete separe du sombre — et c'est justement leur confusion qui desaturait
     * les enseignes en meme temps que le sol. */
    const chromaDe2 = (f, c) => Math.hypot(...versLab(f(c)).slice(1));
    const enseigne = [0.86, 0.82, 0.70];
    const betonSombre = [0.34, 0.31, 0.26];
    check('powV11 : l\'enseigne claire regagne de la couleur',
        chromaDe2(v11, enseigne) / chromaDe2(v10, enseigne), 1.02, 1.15, '×');
    check('powV11 : le béton sombre ne bouge pas',
        chromaDe2(v11, betonSombre) / chromaDe2(v10, betonSombre), 0.98, 1.02, '×');
    const teinte = (f, c) => {
        const [, a, b] = versLab(f(c));
        return ((Math.atan2(b, a) * 180 / Math.PI) + 360) % 360;
    };
    check('powV11 : et il garde sa teinte de sol',
        Math.abs(teinte(v11, betonSombre) - teinte(v10, betonSombre)), 0, 2, '°');

    /* 4 bis. LE LETTRAGE DES ENSEIGNES NE MOUCHETTE PLUS.
     *
     * Le defaut, vu a l'ecran sur le logo « Synergy » de sa station: nos lettres
     * etaient granuleuses la ou les siennes sont lisses. La cause, mesuree: dans
     * un blanc, la chroma qui reste (7 a 13) vient du panneau rouge qui bave
     * dans le JPEG, et sa TEINTE est du bruit — deux pixels voisins de la meme
     * lettre pointent jusqu'a 92 degres l'un de l'autre. Or le melangeur donne
     * un gain de luminance de 1,569 entre 15 et 45 degres, et 1,000 au-dela:
     * deux voisins identiques sortaient 11,29 L* d'ecart.
     *
     * Le controle rejoue exactement ca: deux couleurs de MEME niveau et MEME
     * chroma, separees de 30 degres de teinte. Elles doivent sortir ensemble.
     * `powV10` sert de temoin: sans lui, un controle qui passe ne prouverait
     * pas qu'il mesure quelque chose. Valeurs RELEVEES: 0,01 et 11,29.
     */
    /* Lab -> sRGB, l'inverse de `versLab`, pour fabriquer les deux voisins. */
    const labVersRgb = (L, a, b) => {
        const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
        const f = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
        const X = f(fx) * 0.95047, Y = f(fy), Z = f(fz) * 1.08883;
        const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z,
            -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
            0.0557 * X - 0.2040 * Y + 1.0570 * Z];
        return lin.map((v) => {
            const u = Math.max(0, Math.min(1, v));
            return u <= 0.0031308 ? u * 12.92 : 1.055 * u ** (1 / 2.4) - 0.055;
        });
    };
    const voisin = (L, c, h) => labVersRgb(L, c * Math.cos(h * Math.PI / 180), c * Math.sin(h * Math.PI / 180));
    const ecartVoisins = (f) => Math.abs(versLab(f(voisin(59, 12, 25)))[0] - versLab(f(voisin(59, 12, 55)))[0]);
    check('powV11 : deux voisins d\'une lettre sortent ensemble', ecartVoisins(v11), 0, 0.5, ' L*');
    check('powV11 : et le témoin powV10, lui, les séparait', ecartVoisins(v10), 5, 20, ' L*');

    /* 5. ET `powV10` N'A PAS BOUGE. Valeurs RELEVEES. */
    let derive = 0;
    for (const [rgb, attendu] of [[[0.2, 0.3, 0.5], [0, 47, 60]], [[0.8, 0.2, 0.2], [169, 12, 13]],
        [[0.5, 0.5, 0.5], [70, 64, 60]], [[1, 1, 1], [206, 198, 187]]]) {
        const o = v10(rgb).map((v) => Math.round(v * 255));
        derive = Math.max(derive, Math.max(...o.map((v, i) => Math.abs(v - attendu[i]))));
    }
    check('powV10 n\'a pas bougé en accueillant powV11', derive, 0, 1);
}

/* ---------- powV12 : les taches du lettrage, et le poteau ------------------
 *
 * Deux defauts vus a l'ecran sur sa station de nuit, et un troisieme constat
 * qui dit ou s'arreter.
 *
 * 1. LES TACHES. Elles sont de BASSE frequence: entre pixels voisins `powV11`
 *    est propre, c'est en moyennes de blocs 4x4 que ca se voit. Dispersion
 *    relevee sur le lettrage: source 5,4 %, lui 8,0 %, `powV11` 12,4 %,
 *    `powV12` 9,6 %. Deux causes, toutes deux corrigees ici — le relevement
 *    des blancs etait MULTIPLICATIF (il multiplie donc aussi les ecarts) et il
 *    est maintenant additif; et la courbe amplifiait x1,29 au niveau du
 *    lettrage, ses trois noeuds L* 55/60/65 sont redresses.
 *
 * 2. LE POTEAU. `powV11` le poussait a 60,4 quand le sien est a 39,5, parce
 *    que sa bande de relevement ne se refermait qu'apres lui. Elle se referme
 *    avant: 11,7 L* repris.
 *
 * 3. CE QUI RESTE N'EST PAS REPRODUCTIBLE, et c'est montre deux fois: ce n'est
 *    pas une regle de teinte (a niveau egal il descend les warm-neutres MOINS
 *    que les autres teintes, sur les trois paires) et ce n'est pas un
 *    vignetage (plat du centre au bord sur le restaurant; non monotone avec le
 *    rayon sur la station). Ce sont des objets peints a la main.
 *
 * Toutes les valeurs ci-dessous sont RELEVEES.
 */
{
    const v12 = getPresetTransform('powV12');
    const v11b = getPresetTransform('powV11');
    if (!v12) { console.error('ECHEC: powV12 introuvable.'); process.exit(1); }
    const labVersRgb2 = (L, a, b) => {
        const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
        const f = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
        const X = f(fx) * 0.95047, Y = f(fy), Z = f(fz) * 1.08883;
        return [3.2406 * X - 1.5372 * Y - 0.4986 * Z,
            -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
            0.0557 * X - 0.2040 * Y + 1.0570 * Z].map((v) => {
            const u = Math.max(0, Math.min(1, v));
            return u <= 0.0031308 ? u * 12.92 : 1.055 * u ** (1 / 2.4) - 0.055;
        });
    };
    const coul = (L, c, h) => labVersRgb2(L, c * Math.cos(h * Math.PI / 180), c * Math.sin(h * Math.PI / 180));
    const clarte = (f, c) => versLab(f(c))[0];

    /* 1. LE POTEAU redescend. Sa couleur relevee: L* 70,7, chroma 15,6, 84°. */
    const poteau = coul(70.7, 15.6, 84);
    check('powV12 : le poteau blanc redescend', clarte(v11b, poteau) - clarte(v12, poteau), 9, 14, ' L*');
    check('powV12 : et le témoin powV11, lui, le gonflait', clarte(v11b, poteau), 58, 65, ' L*');

    /* 2. LA TACHE: l'amplification locale au niveau du lettrage. La source vaut
     *    1,00 par definition, lui 1,05. Relevé: powV11 1,83, powV12 1,28. */
    const ampli = (f) => Math.abs(clarte(f, coul(63, 12, 29)) - clarte(f, coul(57, 12, 29))) / 6;
    check('powV12 : amplification locale sur le lettrage', ampli(v12), 1.1, 1.4, '×');
    check('powV12 : et le témoin powV11 amplifiait plus', ampli(v11b), 1.6, 2.1, '×');

    /* 3. LE RELEVEMENT EST ADDITIF, donc il ne mouchette pas non plus sur la
     *    teinte: deux voisins que separe 30° de bruit sortent ensemble. */
    const ecart = Math.abs(clarte(v12, coul(59, 12, 25)) - clarte(v12, coul(59, 12, 55)));
    check('powV12 : deux voisins d\'une lettre sortent ensemble', ecart, 0, 0.5, ' L*');

    /* 3 bis. ET LA CORRECTION VA BIEN SUR LE LETTRAGE, PAS AILLEURS.
     *
     * Premiere version de `powV12`: la mesure disait « mieux », l'ecran disait
     * « aucune difference ». La carte des ecarts a tranche — le lettrage
     * bougeait de -0,60 L*, le CIEL de +5,28. La bande attrapait le ciel et
     * ratait les lettres. Le garde-fou de chroma se ferme donc a 12-20, ce qui
     * separe le lettrage (chroma 10) du ciel (chroma 20).
     *
     * Couleurs relevees dans la source: lettrage L* 62,1 / chroma 10,0 / 29°,
     * ciel L* 42,1 / chroma 32,3 / 283°.
     */
    const lettrage = coul(62.1, 10.0, 29);
    const cielNuit = coul(42.1, 32.3, 283);
    check('powV12 : le lettrage de l\'enseigne monte',
        clarte(v12, lettrage) - clarte(v11b, lettrage), 2, 4.5, ' L*');
    check('powV12 : et le ciel ne bouge pas',
        Math.abs(clarte(v12, cielNuit) - clarte(v11b, cielNuit)), 0, 0.5, ' L*');

    /* 3 ter. LE GAIN DE CHROMA NE RETOURNE PAS L'ORDRE. Un gain applique dans
     * une fenetre de chroma peut rendre un pixel PLUS colore qu'un pixel qui
     * l'etait davantage au depart: la fonction cesse d'etre croissante et trace
     * un contour. C'est ce qui a fait refuser un gain de 2,20 (chroma 12 sortait
     * a 26, chroma 20 restait a 20) au profit de 1,55. Relevé: 0,16. */
    let reculChroma = 0;
    let chromaPrec = -1;
    for (let c = 0; c <= 45; c += 0.25) {
        const [, a, b] = versLab(v12(coul(34, c, 29)));
        const sortie = Math.hypot(a, b);
        if (sortie < chromaPrec) reculChroma = Math.max(reculChroma, chromaPrec - sortie);
        chromaPrec = sortie;
    }
    check('powV12 : la chroma de sortie reste croissante', reculChroma, 0, 0.4);

    /* 4. ET LES GARDE-FOUS ORDINAIRES. Valeurs relevées. */
    let maxi = 0;
    let croissant = 1;
    let precedent = -1;
    for (let i = 0; i <= 255; i += 1) {
        const gris = [i / 255, i / 255, i / 255];
        maxi = Math.max(maxi, ...v12(gris).map((v) => Math.round(v * 255)));
        const L = versLab(v12(gris))[0];
        if (L < precedent - 1e-9) croissant = 0;
        precedent = L;
    }
    check('powV12 : n\'écrête pas', maxi, 0, 254);
    check('powV12 : rampe grise croissante', croissant, 1, 1);
    check('powV12 : le noir pur reste noir', Math.max(...v12([0, 0, 0]).map((v) => Math.round(v * 255))), 0, 1);
    check('powV12 : les ombres ne bougent pas', Math.abs(clarte(v12, coul(20, 0, 0)) - 10.13), 0, 0.5, ' L*');

    /* 5. ET `powV11` N'A PAS BOUGE. Valeurs RELEVEES. */
    let derive12 = 0;
    for (const [rgb, attendu] of [[[0.2, 0.3, 0.5], [0, 47, 61]], [[0.8, 0.2, 0.2], [169, 12, 13]],
        [[0.5, 0.5, 0.5], [70, 64, 60]], [[1, 1, 1], [211, 204, 192]]]) {
        const o = v11b(rgb).map((v) => Math.round(v * 255));
        derive12 = Math.max(derive12, Math.max(...o.map((v, i) => Math.abs(v - attendu[i]))));
    }
    check('powV11 n\'a pas bougé en accueillant powV12', derive12, 0, 1);
}

/* ---------- rapport ---------- */

console.log('\nSmoke preset Vision — cibles de docs/audit-preset-powlisher-2026-08-11.md §7\n');
for (const r of results) {
    const status = r.ok ? 'OK  ' : 'ECHEC';
    const value = typeof r.value === 'number' ? r.value.toFixed(2) : r.value;
    console.log(`  ${status} ${r.label.padEnd(38)} ${String(value).padStart(9)}${r.unit}   [${r.min} … ${r.max}]`);
}

if (failures > 0) {
    console.error(`\n${failures} verification(s) en echec.\n`);
    process.exit(1);
}
console.log(`\n${results.length} verifications passees.\n`);
