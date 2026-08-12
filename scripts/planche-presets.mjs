/*
 * Une PLANCHE a regarder: chaque photo passee dans tous les presets, cote a
 * cote, dans un seul fichier.
 *
 * Pourquoi cet outil existe. `compare-vision-presets-on-photos.mjs` donne des
 * chiffres (ecretage, force, derive des teintes) et `audit-vision-presets.mjs`
 * mesure des couleurs choisies. Aucun des deux ne repond a la seule question qui
 * a fait supprimer trois presets: « est-ce que ca a l'air bien ? »
 *
 * Trois defauts ont ete attrapes A L'OEIL et par aucune mesure: le trait
 * diagonal de l'ancien `powlisher-v2` dans un ciel voile, le ciel menthe de
 * `powlisher` sur une photo deja cyan, et le ciel KAKI du premier jet de
 * `powlisher-showcase`. D'ou cette planche, a ouvrir avant de livrer.
 *
 * OU TROUVER DES PHOTOS DE TEST. Unsplash (https://unsplash.com) — des photos de
 * qualite, souvent PEU retouchees, et libres d'usage. C'est important: les
 * photos du corpus `@powl_d` sont deja ses edits finis, donc les repasser dans
 * un preset revient a etaler deux fois le meme traitement. Pour juger un preset,
 * il faut une entree honnete. Telecharger 3-4 photos du sujet vise (voiture,
 * ciel, portrait...), les poser dans un dossier hors du depot, et lancer:
 *
 *   node scripts/planche-presets.mjs ~/Desktop/devimage/*.jpg
 *   node scripts/planche-presets.mjs --sortie /tmp/planche.png photo1.jpg photo2.jpg
 *
 * LIMITE, et elle est importante: cette planche montre la LUT seule. Les effets
 * qu'un preset porte en plus (grain, vignetage, relief) sont appliques par le
 * moteur canvas dans le navigateur, pas ici. Pour les voir, il faut ouvrir
 * l'app. La planche sert a juger la COULEUR.
 */

import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import { VISION_PRESETS, getPresetLut } from '../src/features/vibefx-studio/utils/visionPresets.js';

const args = process.argv.slice(2);
const sortieIndex = args.indexOf('--sortie');
const sortie = sortieIndex !== -1 ? args[sortieIndex + 1] : 'planche-presets.png';
const files = args.filter((value, index) => {
    if (index === sortieIndex || index === sortieIndex + 1) return false;
    return !value.startsWith('--');
});

if (!files.length) {
    console.error('\nUsage: node scripts/planche-presets.mjs [--sortie fichier.png] <photo...>');
    console.error('Photos de test: unsplash.com — qualite, peu retouchees, libres d\'usage.\n');
    process.exit(1);
}

const LARGEUR = 420;
const MARGE = 8;

async function rendu(file, presetId) {
    const { data, info } = await sharp(file).rotate().removeAlpha()
        .resize({ width: LARGEUR, fit: 'inside' })
        .raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    const rgba = new Uint8ClampedArray(n * 4);
    for (let k = 0; k < n; k += 1) {
        rgba[k * 4] = data[k * 3];
        rgba[k * 4 + 1] = data[k * 3 + 1];
        rgba[k * 4 + 2] = data[k * 3 + 2];
        rgba[k * 4 + 3] = 255;
    }
    if (presetId) applyLut3dToData(rgba, getPresetLut(presetId), LUT_SIZE, 1);
    const rgb = Buffer.alloc(n * 3);
    for (let k = 0; k < n; k += 1) {
        rgb[k * 3] = rgba[k * 4];
        rgb[k * 3 + 1] = rgba[k * 4 + 1];
        rgb[k * 3 + 2] = rgba[k * 4 + 2];
    }
    return { rgb, width: info.width, height: info.height };
}

const colonnes = [null, ...VISION_PRESETS.map((p) => p.id)];
const lignes = [];

for (const file of files) {
    if (!existsSync(file)) {
        console.error(`Introuvable, ignoree: ${file}`);
        continue;
    }
    const tuiles = [];
    for (const presetId of colonnes) tuiles.push(await rendu(file, presetId));
    lignes.push(tuiles);
}

if (!lignes.length) {
    console.error('\nAucune photo lisible.\n');
    process.exit(1);
}

const largeurTotale = colonnes.length * (LARGEUR + MARGE) - MARGE;
const hauteurs = lignes.map((tuiles) => Math.max(...tuiles.map((t) => t.height)));
const hauteurTotale = hauteurs.reduce((a, h) => a + h + MARGE, 0) - MARGE;

const composite = [];
let top = 0;
lignes.forEach((tuiles, i) => {
    tuiles.forEach((tuile, j) => {
        composite.push({
            input: tuile.rgb,
            raw: { width: tuile.width, height: tuile.height, channels: 3 },
            left: j * (LARGEUR + MARGE),
            top,
        });
    });
    top += hauteurs[i] + MARGE;
});

await sharp({
    create: {
        width: largeurTotale, height: hauteurTotale, channels: 3, background: '#0c0c0c',
    },
}).composite(composite).png().toFile(sortie);

console.log(`\nPlanche ecrite: ${sortie}`);
console.log(`Colonnes, de gauche a droite : originale, ${VISION_PRESETS.map((p) => p.label).join(', ')}`);
console.log('Rappel: la LUT seule. Grain, vignetage et relief s\'appliquent dans l\'app.\n');
