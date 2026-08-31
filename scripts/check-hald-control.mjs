/*
 * Controle de l'aller-retour Lightroom, AVANT toute capture de preset.
 *
 * On fait passer la mire neutre dans Lightroom SANS lui appliquer le moindre
 * reglage, et on la reexporte. Si Lightroom rendait exactement ce qu'on lui a
 * donne, le fichier ressorti serait identique a la mire d'origine.
 *
 * Ce script mesure l'ecart. S'il est gros, c'est que la chaine Lightroom
 * modifie les couleurs toute seule (profil applique a l'import, espace
 * colorimetrique d'export autre que sRGB, nettete de sortie...). Dans ce cas
 * TOUTES les captures de presets seraient fausses, sans que rien ne le
 * signale : il faut regler ca avant de capturer quoi que ce soit.
 *
 *   node scripts/check-hald-control.mjs presets-lightroom/controle.png
 */

import fs from 'node:fs';
import sharp from 'sharp';
import { haldImageSize, measureHaldDeviation } from '../src/features/vibefx-studio/utils/haldClut.js';

const file = process.argv[2];
const level = Number(process.argv[3] || 8);

if (!file) {
    console.error('\nUsage: node scripts/check-hald-control.mjs <mire-reexportee.png> [niveau]\n');
    process.exit(1);
}
if (!fs.existsSync(file)) {
    console.error(`\nECHEC: fichier introuvable: ${file}\n`);
    process.exit(1);
}

const expectedSize = haldImageSize(level);
const image = sharp(file);
const meta = await image.metadata();

/*
 * La mire de production est en blocs de 4x4 : chaque couleur du cube occupe
 * un carre, afin que les traitements de voisinage de Lightroom ne contaminent
 * pas la couleur suivante. Le controle doit lire exactement comme l'importeur,
 * sinon il rejette a tort nos exports 2048x2048 en attendant l'ancienne mire
 * 512x512.
 */
const detectedBlock = meta.width && meta.width % expectedSize === 0
    ? meta.width / expectedSize
    : 0;
const block = Number.isInteger(detectedBlock) && detectedBlock >= 1 ? detectedBlock : 0;

console.log(`\nFichier    : ${file}`);
console.log(
    `Dimensions : ${meta.width}x${meta.height}`
    + ` (mire niveau ${level}, blocs ${block || 'invalides'})`,
);
console.log(`Format     : ${meta.format}, ${meta.space}, ${meta.depth}`);

if (!block || meta.height !== expectedSize * block) {
    console.error(
        '\nECHEC: la mire a ete redimensionnee a l\'export. Reexporte en « taille d\'origine »,'
        + '\nsans redimensionnement ni nettete de sortie.\n',
    );
    process.exit(1);
}

const { data } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
let pixels = data;
if (block > 1) {
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
                    const source = ((sy * block + y) * meta.width + (sx * block + x)) * 3;
                    for (let c = 0; c < 3; c += 1) acc[c] += data[source + c];
                }
            }
            const target = (sy * expectedSize + sx) * 3;
            for (let c = 0; c < 3; c += 1) pixels[target + c] = Math.round(acc[c] / count);
        }
    }
    console.log(
        `Lecture     : coeur ${to - from}x${to - from} moyenne de chaque bloc ${block}x${block}`,
    );
}
const { mean, max } = measureHaldDeviation(pixels, level);

console.log(`\nEcart a l'identite : moyen ${mean.toFixed(3)}/255, max ${max}/255`);

if (max <= 2) {
    console.log('\nVERDICT: parfait. Lightroom ne decale pas les couleurs. On peut capturer.\n');
    process.exit(0);
}
if (max <= 8) {
    console.log(
        '\nVERDICT: acceptable. Un leger decalage existe, a noter dans la doc :'
        + '\nil se retrouvera dans chaque preset capture.\n',
    );
    process.exit(0);
}
console.log(
    '\nVERDICT: STOP. Le decalage est trop gros pour capturer quoi que ce soit.'
    + '\nA verifier, dans cet ordre :'
    + '\n  - l\'espace colorimetrique d\'export : il doit etre sRGB, pas AdobeRGB ni ProPhoto ;'
    + '\n  - un profil ou un reglage automatique applique a l\'import ;'
    + '\n  - la nettete de sortie, qui doit etre desactivee ;'
    + '\n  - le redimensionnement, qui doit etre desactive.\n',
);
process.exit(1);
