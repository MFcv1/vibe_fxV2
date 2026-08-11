/*
 * La validation qui compte vraiment : sur une VRAIE photo.
 *
 * On applique le preset a la photo d'origine avec notre moteur, et on compare
 * pixel a pixel avec la meme photo passee dans Lightroom avec le meme preset.
 *
 * L'ecart ne sera jamais nul et il ne DOIT pas l'etre : Lightroom developpe
 * depuis du RAW lineaire, nous depuis un JPEG deja developpe. La question
 * n'est pas « est-ce zero » mais « est-ce assez petit pour que ce soit le meme
 * look ». Reperes utiles, sur 255 :
 *   <= 2   invisible
 *   3 a 5  invisible en pratique sur une photo
 *   6 a 10 visible en comparant cote a cote, pas isolement
 *   > 10   ce n'est plus le meme rendu
 *
 * L'ecart maximum, lui, est presque toujours localise sur des zones brulees ou
 * bouchees, la ou le JPEG n'a plus la matiere que le RAW avait. C'est pour ca
 * qu'on affiche aussi le 99e centile, bien plus parlant que le max.
 *
 *   node scripts/compare-preset-vs-lightroom.mjs <origine> <version-lightroom> <presetId>
 */

import sharp from 'sharp';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import { getPresetLut, VISION_PRESET_BY_ID } from '../src/features/vibefx-studio/utils/visionPresets.js';

const [source, reference, presetId] = process.argv.slice(2);

if (!source || !reference || !presetId) {
    console.error(
        '\nUsage: node scripts/compare-preset-vs-lightroom.mjs <origine> <version-lightroom> <presetId>\n',
    );
    process.exit(1);
}
if (!VISION_PRESET_BY_ID[presetId]) {
    console.error(`\nPreset inconnu: ${presetId}\n`);
    process.exit(1);
}

/*
 * `.rotate()` sans argument applique l'orientation EXIF. Indispensable ici: un
 * JPEG de telephone est souvent stocke en paysage avec une balise « tourne-moi »,
 * et Lightroom, lui, ecrit la rotation dans les pixels a l'export. Sans ca les
 * deux images n'ont meme pas les memes dimensions.
 */
const srcImage = sharp(source).rotate();
const refImage = sharp(reference).rotate();
const srcMeta = await srcImage.png().toBuffer({ resolveWithObject: true }).then((r) => r.info);
const refMeta = await refImage.png().toBuffer({ resolveWithObject: true }).then((r) => r.info);

console.log(`\nOrigine    : ${source} (${srcMeta.width}x${srcMeta.height})`);
console.log(`Lightroom  : ${reference} (${refMeta.width}x${refMeta.height})`);
console.log(`Preset     : ${VISION_PRESET_BY_ID[presetId].label}`);

if (srcMeta.width !== refMeta.width || srcMeta.height !== refMeta.height) {
    console.error(
        '\nECHEC: les deux images n\'ont pas la meme taille. Reexporte depuis Lightroom'
        + '\nen « Taille reelle », sans redimensionnement.\n',
    );
    process.exit(1);
}

const { data: src } = await srcImage.removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { data: ref } = await refImage.removeAlpha().raw().toBuffer({ resolveWithObject: true });

/* Notre rendu, exactement comme dans l'app : la LUT du preset, a pleine force. */
const pixelCount = src.length / 3;
const ours = new Uint8ClampedArray(pixelCount * 4);
for (let i = 0; i < pixelCount; i += 1) {
    ours[i * 4] = src[i * 3];
    ours[i * 4 + 1] = src[i * 3 + 1];
    ours[i * 4 + 2] = src[i * 3 + 2];
    ours[i * 4 + 3] = 255;
}
applyLut3dToData(ours, getPresetLut(presetId), LUT_SIZE, 1);

/* Ecart par canal, plus l'histogramme qui donne les centiles. */
const histogram = new Int32Array(256);
let sum = 0;
let max = 0;
for (let i = 0; i < pixelCount; i += 1) {
    for (let c = 0; c < 3; c += 1) {
        const d = Math.abs(ours[i * 4 + c] - ref[i * 3 + c]);
        sum += d;
        histogram[d] += 1;
        if (d > max) max = d;
    }
}
const total = pixelCount * 3;
const mean = sum / total;

function percentile(p) {
    const target = total * p;
    let seen = 0;
    for (let d = 0; d < 256; d += 1) {
        seen += histogram[d];
        if (seen >= target) return d;
    }
    return 255;
}

/* Le meme calcul entre l'origine et Lightroom : de combien le preset change la photo. */
let effectSum = 0;
for (let i = 0; i < pixelCount; i += 1) {
    for (let c = 0; c < 3; c += 1) effectSum += Math.abs(src[i * 3 + c] - ref[i * 3 + c]);
}
const effect = effectSum / total;

console.log('\nECART entre notre rendu et Lightroom');
console.log(`  moyen            ${mean.toFixed(2)}/255`);
console.log(`  median           ${percentile(0.5)}/255`);
console.log(`  90e centile      ${percentile(0.9)}/255`);
console.log(`  99e centile      ${percentile(0.99)}/255`);
console.log(`  max              ${max}/255  (zones brulees ou bouchees)`);

console.log('\nA COMPARER A');
console.log(`  effet du preset  ${effect.toFixed(2)}/255  (ecart entre la photo d'origine et Lightroom)`);
console.log(`  -> notre rendu reproduit ${(100 * (1 - mean / effect)).toFixed(1)} % de l'effet du preset`);

const verdict = mean <= 2 ? 'identique a l\'oeil'
    : mean <= 5 ? 'meme rendu, ecart invisible en pratique'
        : mean <= 10 ? 'meme look, ecart visible en comparant cote a cote'
            : 'CE N\'EST PLUS LE MEME RENDU';
console.log(`\nVERDICT: ${verdict}.\n`);
