/*
 * Audit chiffre des presets de Vision.
 *
 * Trois mesures, dans cet ordre d'importance :
 *
 * 1. BANDES. Le risque numero un d'une LUT : un grand degrade lisse (un ciel)
 *    qui ressort en marches d'escalier. On passe un degrade parfait dans le
 *    preset et on regarde le plus gros saut entre deux pixels voisins. Un
 *    degrade neutre monte de 1/255 par pas ; un preset qui contraste peut
 *    monter a 2 ou 3 sans que ca se voie. Au-dela de ~4, ca se voit.
 * 2. AXE DES GRIS. Ce que le preset fait a une couleur neutre : sa dominante.
 *    Un gris moyen qui vire de plus de ~6/255 sur un canal, c'est un parti
 *    pris fort et assume.
 * 3. COULEURS TEMOINS. Ce que le preset fait au ciel, a la peau, au feuillage.
 *    C'est la qu'on voit la personnalite d'un look.
 *
 *   node scripts/audit-vision-presets.mjs [id...]
 */

import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import { VISION_PRESETS, getPresetLut } from '../src/features/vibefx-studio/utils/visionPresets.js';

/* ---------- utilitaires ---------- */

function applyToColor(lut, [r, g, b]) {
    const data = new Uint8ClampedArray([r, g, b, 255]);
    applyLut3dToData(data, lut, LUT_SIZE, 1);
    return [data[0], data[1], data[2]];
}

function toHsl([r, g, b]) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
    return { h: h * 360, s, l };
}

function signed(n, digits = 0) {
    const v = n.toFixed(digits);
    return n > 0 ? `+${v}` : v;
}

/* ---------- 1. bandes ---------- */

/*
 * Un degrade lisse de `from` vers `to` sur 256 pas, passe dans le preset.
 * On renvoie le plus gros ecart entre deux pixels voisins, par canal.
 */
function bandingOn(lut, from, to, steps = 256) {
    const data = new Uint8ClampedArray(steps * 4);
    for (let i = 0; i < steps; i += 1) {
        const t = i / (steps - 1);
        data[i * 4] = from[0] + (to[0] - from[0]) * t;
        data[i * 4 + 1] = from[1] + (to[1] - from[1]) * t;
        data[i * 4 + 2] = from[2] + (to[2] - from[2]) * t;
        data[i * 4 + 3] = 255;
    }
    applyLut3dToData(data, lut, LUT_SIZE, 1);
    let max = 0;
    for (let i = 1; i < steps; i += 1) {
        for (let c = 0; c < 3; c += 1) {
            const jump = Math.abs(data[i * 4 + c] - data[(i - 1) * 4 + c]);
            if (jump > max) max = jump;
        }
    }
    return max;
}

const GRADIENTS = [
    ['ciel bleu clair -> profond', [186, 220, 240], [40, 92, 150]],
    ['ciel couchant', [252, 216, 168], [96, 128, 176]],
    ['gris noir -> blanc', [8, 8, 8], [248, 248, 248]],
    ['peau ombre -> lumiere', [120, 88, 72], [242, 214, 194]],
];

/* ---------- 2 et 3. temoins ---------- */

const GREYS = [
    ['gris sombre', [64, 64, 64]],
    ['gris moyen', [128, 128, 128]],
    ['gris clair', [200, 200, 200]],
];

const SWATCHES = [
    ['ciel', [110, 165, 215]],
    ['mer', [40, 110, 130]],
    ['peau claire', [232, 190, 165]],
    ['peau matte', [175, 130, 100]],
    ['feuillage', [95, 125, 60]],
    ['herbe seche', [190, 170, 105]],
    ['pierre blanche', [225, 220, 210]],
    ['rouge', [190, 60, 50]],
];

/* ---------- rapport ---------- */

const wanted = process.argv.slice(2);
const presets = VISION_PRESETS.filter((p) => !wanted.length || wanted.includes(p.id));

for (const preset of presets) {
    const lut = getPresetLut(preset.id);
    console.log(`\n${'='.repeat(66)}\n${preset.label}  (${preset.id})\n${'='.repeat(66)}`);

    console.log('\nBANDES — plus gros saut entre deux pixels voisins d\'un degrade');
    let worst = 0;
    for (const [name, from, to] of GRADIENTS) {
        const jump = bandingOn(lut, from, to);
        if (jump > worst) worst = jump;
        console.log(`  ${name.padEnd(28)} ${jump}/255`);
    }
    console.log(`  -> pire cas ${worst}/255 : ${worst <= 3 ? 'invisible' : worst <= 5 ? 'a surveiller' : 'BANDES VISIBLES'}`);

    console.log('\nAXE DES GRIS — dominante du preset');
    for (const [name, rgb] of GREYS) {
        const out = applyToColor(lut, rgb);
        const d = out.map((v, i) => v - rgb[i]);
        console.log(
            `  ${name.padEnd(28)} ${rgb[0]} -> ${out.join(',').padEnd(12)}`
            + `  R${signed(d[0])} V${signed(d[1])} B${signed(d[2])}`,
        );
    }

    console.log('\nCOULEURS TEMOINS — teinte (deg), saturation (%), luminosite (%)');
    for (const [name, rgb] of SWATCHES) {
        const out = applyToColor(lut, rgb);
        const a = toHsl(rgb);
        const b = toHsl(out);
        let dh = b.h - a.h;
        if (dh > 180) dh -= 360;
        if (dh < -180) dh += 360;
        console.log(
            `  ${name.padEnd(16)} ${String(rgb.join(',')).padEnd(14)} -> ${String(out.join(',')).padEnd(14)}`
            + `  teinte ${signed(dh, 1).padStart(7)}°`
            + `  sat ${signed((b.s - a.s) * 100, 1).padStart(6)}%`
            + `  lum ${signed((b.l - a.l) * 100, 1).padStart(6)}%`,
        );
    }
}

console.log('');
