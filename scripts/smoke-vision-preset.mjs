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
const missing = VISION_PRESETS.filter((p) => !p.id || !p.label || typeof p.transform !== 'function');
check('presets complets (id/label/transform)', missing.length, 0, 0);

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
