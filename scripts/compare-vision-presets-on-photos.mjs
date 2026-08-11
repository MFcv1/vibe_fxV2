/*
 * Comparer les presets sur de VRAIES photos, avec des chiffres.
 *
 * L'audit synthetique (`audit-vision-presets.mjs`) dit ce qu'un preset fait a
 * des couleurs choisies. Il ne dit pas ce qu'il fait a une photo, ou les
 * couleurs ne sont pas distribuees uniformement: un ciel occupe un tiers du
 * cadre, la peau quelques pourcents.
 *
 * Trois mesures decisives ici :
 *
 * - ECRETAGE. Combien de pixels sont pousses a 0 ou a 255 sur un canal. C'est
 *   de la matiere DETRUITE, irrecuperable. Un preset concu pour du RAW se
 *   permet d'ecraser les noirs parce que le RAW a de la reserve; sur un JPEG
 *   deja developpe, il bouche.
 * - FORCE. De combien le preset deplace la photo. Un chiffre eleve n'est ni
 *   bon ni mauvais, mais il dit a quel point le look s'impose.
 * - DERIVE DES TEINTES. Ou partent le ciel, la vegetation et la peau. C'est ce
 *   qui donne son identite a un look.
 *
 *   node scripts/compare-vision-presets-on-photos.mjs <photo...>
 */

import sharp from 'sharp';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import { VISION_PRESETS, getPresetLut } from '../src/features/vibefx-studio/utils/visionPresets.js';

const files = process.argv.slice(2);
if (!files.length) {
    console.error('\nUsage: node scripts/compare-vision-presets-on-photos.mjs <photo...>\n');
    process.exit(1);
}

/* Familles de couleurs reperees par teinte, pour suivre ou elles partent. */
function hueOf(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return null;
    const d = max - min;
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h: h * 360, s: d / max, l: (max + min) / 510 };
}

const FAMILIES = [
    ['ciel', (p) => p.h >= 180 && p.h <= 250 && p.s > 0.12],
    ['vegetation', (p) => p.h >= 60 && p.h < 160 && p.s > 0.12],
    ['peau / bois', (p) => p.h >= 10 && p.h < 50 && p.s > 0.12 && p.l > 0.2],
];

/* Un echantillon suffit largement et evite de brasser 9 Mpx par preset. */
const STRIDE = 7;

const results = new Map();

for (const file of files) {
    const image = sharp(file).rotate();
    const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;

    /* Pixels echantillonnes, une seule fois, partages par tous les presets. */
    const idx = [];
    for (let i = 0; i < n; i += STRIDE) idx.push(i);

    const rgba = new Uint8ClampedArray(idx.length * 4);
    for (let k = 0; k < idx.length; k += 1) {
        const i = idx[k];
        rgba[k * 4] = data[i * 3];
        rgba[k * 4 + 1] = data[i * 3 + 1];
        rgba[k * 4 + 2] = data[i * 3 + 2];
        rgba[k * 4 + 3] = 255;
    }

    /* Ecretage deja present dans l'original: on ne comptera que ce qu'on AJOUTE. */
    let baseClipped = 0;
    for (let k = 0; k < idx.length; k += 1) {
        for (let c = 0; c < 3; c += 1) {
            const v = rgba[k * 4 + c];
            if (v === 0 || v === 255) { baseClipped += 1; break; }
        }
    }

    for (const preset of VISION_PRESETS) {
        const out = Uint8ClampedArray.from(rgba);
        applyLut3dToData(out, getPresetLut(preset.id), LUT_SIZE, 1);

        let clipped = 0;
        let move = 0;
        const fam = FAMILIES.map(() => ({ dh: 0, ds: 0, dl: 0, count: 0 }));

        for (let k = 0; k < idx.length; k += 1) {
            let isClipped = false;
            for (let c = 0; c < 3; c += 1) {
                const v = out[k * 4 + c];
                move += Math.abs(v - rgba[k * 4 + c]);
                if (v === 0 || v === 255) isClipped = true;
            }
            if (isClipped) clipped += 1;

            const before = hueOf(rgba[k * 4], rgba[k * 4 + 1], rgba[k * 4 + 2]);
            if (!before) continue;
            const after = hueOf(out[k * 4], out[k * 4 + 1], out[k * 4 + 2]);
            if (!after) continue;
            for (let f = 0; f < FAMILIES.length; f += 1) {
                if (!FAMILIES[f][1](before)) continue;
                let dh = after.h - before.h;
                if (dh > 180) dh -= 360;
                if (dh < -180) dh += 360;
                fam[f].dh += dh;
                fam[f].ds += after.s - before.s;
                fam[f].dl += after.l - before.l;
                fam[f].count += 1;
            }
        }

        if (!results.has(preset.id)) results.set(preset.id, []);
        results.get(preset.id).push({
            file,
            move: move / (idx.length * 3),
            clipAdded: (100 * (clipped - baseClipped)) / idx.length,
            clipTotal: (100 * clipped) / idx.length,
            fam: fam.map((f) => (f.count
                ? {
                    dh: f.dh / f.count,
                    ds: (100 * f.ds) / f.count,
                    dl: (100 * f.dl) / f.count,
                    share: (100 * f.count) / idx.length,
                }
                : null)),
        });
    }
}

console.log(`\n${files.length} photo(s) analysee(s), 1 pixel sur ${STRIDE}.\n`);

for (const preset of VISION_PRESETS) {
    const rows = results.get(preset.id);
    const avg = (fn) => rows.reduce((s, r) => s + fn(r), 0) / rows.length;

    console.log('='.repeat(70));
    console.log(`${preset.label}  (${preset.id})`);
    console.log('='.repeat(70));
    console.log(`  force du look        ${avg((r) => r.move).toFixed(2)}/255 de deplacement moyen`);
    console.log(
        `  ecretage AJOUTE      ${avg((r) => r.clipAdded).toFixed(2)} % des pixels`
        + `   (total apres preset: ${avg((r) => r.clipTotal).toFixed(2)} %)`,
    );
    for (let f = 0; f < FAMILIES.length; f += 1) {
        const withFam = rows.filter((r) => r.fam[f]);
        if (!withFam.length) continue;
        const m = (key) => withFam.reduce((s, r) => s + r.fam[f][key], 0) / withFam.length;
        const sign = (v, d = 1) => (v > 0 ? `+${v.toFixed(d)}` : v.toFixed(d));
        console.log(
            `  ${FAMILIES[f][0].padEnd(20)} teinte ${sign(m('dh')).padStart(7)}°`
            + `  sat ${sign(m('ds')).padStart(6)}%`
            + `  lum ${sign(m('dl')).padStart(6)}%`
            + `   (${m('share').toFixed(0)} % du cadre)`,
        );
    }
    console.log('');
}
