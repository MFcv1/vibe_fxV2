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
    getPresetLut,
    getPresetTransform,
} from '../src/features/vibefx-studio/utils/visionPresets.js';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import {
    buildHaldIdentity,
    haldImageSize,
    haldToLut3d,
    lutFromBase64,
    lutToBase64,
    measureHaldDeviation,
} from '../src/features/vibefx-studio/utils/haldClut.js';
import { parseXmpPreset } from '../src/features/vibefx-studio/utils/xmpPreset.js';

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

check('au moins un preset expose', VISION_PRESETS.length, 1, 99);
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
   crs:GrainAmount="24"
   crs:PostCropVignetteAmount="-40"
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
check('.xmp : clarté transposée', parsed.spatialFilters.clarity || 0, 1, 40);
check('.xmp : résumé lisible', parsed.summary.length, 3, 99);

let rejected = 0;
try {
    parseXmpPreset('<xml>pas un preset</xml>');
} catch {
    rejected = 1;
}
check('.xmp : fichier invalide rejeté', rejected, 1, 1);

/* ---------- powlisher-ville : les cibles de la paire avant/apres ----------
 *
 * Mesurees sur img47 -> img48 du corpus (sa photo brute a cote de son edit),
 * zone par zone, en medianes. Voir le README du corpus.
 *
 * Ces verifications sont SEPAREES de celles de `powlisher`: les deux presets
 * vont dans des directions opposees sur le ciel, et c'est voulu.
 */

const ville = getPresetTransform('powlisher-ville');
if (!ville) {
    console.error('ECHEC: preset « powlisher-ville » introuvable.');
    process.exit(1);
}

const villeProbe = (h, s, l) => rgbToHsl(...ville(hslToRgb(h, s, l)));

/* Le ciel: teinte conservee, saturation ecrasee (mesure: 0.21 -> 0.04). */
const cielVille = villeProbe(213, 0.21, 0.79);
check('ville : ciel, teinte conservée', cielVille[0], 195, 220);
check('ville : ciel, saturation écrasée', cielVille[1], 0, 0.09);

/* Les neutres virent dore (mesure: teinte ~40 deg, saturation 0.05 -> 0.24). */
const neutreMoyen = villeProbe(0, 0, 0.30);
check('ville : neutre moyen, teinte dorée', neutreMoyen[0], 20, 55);
check('ville : neutre moyen, saturation', neutreMoyen[1], 0.12, 0.32);

const neutreClair = villeProbe(0, 0, 0.58);
check('ville : neutre clair, teinte dorée', neutreClair[0], 20, 55);
check('ville : neutre clair, saturation', neutreClair[1], 0.08, 0.28);

/* Les hautes lumieres sont LEVEES (0.58 -> 0.67, 0.83 -> 0.90). */
check('ville : hautes lumières levées', neutreClair[2], 0.62, 0.72);
check('ville : blancs levés', villeProbe(0, 0, 0.83)[2], 0.86, 0.94);

/* ... mais le point blanc ne touche pas 255, comme sur powlisher. */
check('ville : point blanc sous 255', ville([1, 1, 1])[0] * 255, 240, 254.4);

/* Les chauds existants sont renforces (0.23 -> 0.33). */
const chaudVille = villeProbe(40, 0.23, 0.19);
check('ville : chauds renforcés', chaudVille[1], 0.28, 0.42);
check('ville : chauds, teinte tenue', chaudVille[0], 30, 50);

/* Et powlisher V1 n'a pas bouge: les deux presets divergent bien sur le ciel. */
const cielV1 = rgbToHsl(...transform(hslToRgb(213, 0.21, 0.79)));
check('ville vs V1 : le ciel diverge', Math.abs(cielVille[0] - cielV1[0]), 15, 180);

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
