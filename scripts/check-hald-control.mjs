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

console.log(`\nFichier    : ${file}`);
console.log(`Dimensions : ${meta.width}x${meta.height} (attendu ${expectedSize}x${expectedSize})`);
console.log(`Format     : ${meta.format}, ${meta.space}, ${meta.depth}`);

if (meta.width !== expectedSize || meta.height !== expectedSize) {
    console.error(
        '\nECHEC: la mire a ete redimensionnee a l\'export. Reexporte en « taille d\'origine »,'
        + '\nsans redimensionnement ni nettete de sortie.\n',
    );
    process.exit(1);
}

const { data: pixels } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
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
