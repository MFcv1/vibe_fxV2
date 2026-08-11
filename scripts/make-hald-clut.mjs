/*
 * Genere la mire Hald CLUT a faire passer dans Lightroom.
 *
 *   node scripts/make-hald-clut.mjs [dossier] [niveau]
 *
 * Marche a suivre, cote Lightroom:
 *   1. importer `hald-clut-neutre.png` (le fichier produit ici) ;
 *   2. lui appliquer le preset a capturer, et RIEN d'autre ;
 *   3. exporter en PNG, taille d'origine, SANS recadrage ni redimensionnement,
 *      sans nettete de sortie, sans filigrane ;
 *   4. `node scripts/import-lightroom-preset.mjs` avec le fichier exporte.
 *
 * L'etape 3 est la seule ou l'on peut se tromper: le moindre redimensionnement
 * melange des couleurs voisines et rend la table inutilisable. L'import le
 * detecte et refuse le fichier plutot que de produire un preset faux.
 *
 * POURQUOI LA MIRE EST EN BLOCS (defaut: 4x4 pixels par couleur)
 *
 * La version naive de cette mire met une couleur par pixel. Deux pixels
 * voisins y sont alors deux couleurs sans aucun rapport, ce qui n'arrive
 * jamais dans une photo. Tout traitement qui regarde le voisinage fait donc
 * baver les couleurs les unes sur les autres, et la table capturee est fausse.
 *
 * L'erreur est sournoise: elle est negligeable dans les tons clairs, et
 * ruineuse dans les noirs, ou les valeurs valent 4 ou 8 sur 255. Mesure sur
 * CN11, mire a un pixel: l'entree 26,17,14 ressortait a 5,24,6 — un vert
 * franc — la ou Lightroom donne 23,15,14. Les ombres des photos viraient au
 * vert, visiblement.
 *
 * En blocs de 4x4, la bavure se mange sur le bord du carre et le coeur reste
 * pur. Meme capture, meme preset, apres correction: l'ecart a Lightroom passe
 * de 4,53 a 2,67/255 au pixel, de 1,70 a 0,64/255 sur la couleur seule, et de
 * 8,06 a 1,32/255 dans les noirs.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { buildHaldIdentity, haldImageSize } from '../src/features/vibefx-studio/utils/haldClut.js';

const outputDir = process.argv[2] || 'presets-lightroom';
const level = Number(process.argv[3] || 8);
/*
 * Taille du carre occupe par chaque couleur.
 *
 * A 1, chaque couleur tient sur UN pixel, et deux pixels voisins sont deux
 * couleurs sans rapport. Tout traitement qui regarde le voisinage (nettete,
 * clarte, texture, reduction de bruit, et jusqu'au dematricage interne d'un
 * moteur) fait alors baver les couleurs les unes sur les autres. C'est
 * invisible dans les tons clairs, et catastrophique dans les noirs ou les
 * valeurs valent 4 ou 8 sur 255.
 *
 * A 4, chaque couleur occupe un carre de 4x4 : la bavure se mange sur les
 * bords et le centre reste pur. C'est le seul cout : une image 16 fois plus
 * grande, que Lightroom avale sans probleme.
 */
const blockSize = Number(process.argv[4] || 4);

if (!Number.isInteger(level) || level < 2 || level > 16) {
    console.error(`Niveau Hald invalide: ${process.argv[3]}. Attendu un entier entre 2 et 16 (8 recommande).`);
    process.exit(1);
}

const { data, size, cube } = buildHaldIdentity(level);
fs.mkdirSync(outputDir, { recursive: true });
const suffix = blockSize > 1 ? `-bloc${blockSize}` : '';
const target = path.join(outputDir, `hald-clut-neutre-niveau${level}${suffix}.png`);

/* Chaque couleur repetee sur un carre blockSize x blockSize. */
const outSize = size * blockSize;
const pixels = blockSize === 1 ? Buffer.from(data) : Buffer.alloc(outSize * outSize * 3);
if (blockSize > 1) {
    for (let y = 0; y < outSize; y += 1) {
        const sy = Math.floor(y / blockSize);
        for (let x = 0; x < outSize; x += 1) {
            const sx = Math.floor(x / blockSize);
            const s = (sy * size + sx) * 3;
            const d = (y * outSize + x) * 3;
            pixels[d] = data[s];
            pixels[d + 1] = data[s + 1];
            pixels[d + 2] = data[s + 2];
        }
    }
}

await sharp(pixels, { raw: { width: outSize, height: outSize, channels: 3 } })
    /* Profil sRGB explicite: sans lui, l'editeur doit deviner l'espace du fichier. */
    .withMetadata({ icc: 'srgb' })
    .png({ compressionLevel: 9 })
    .toFile(target);

const readme = path.join(outputDir, 'LISEZ-MOI.md');
fs.writeFileSync(readme, `# Capturer un preset Lightroom

Ce dossier sert a importer un preset Lightroom dans Vibe_fx **sans approximer**
les calculs d'Adobe : on fait faire le travail a Lightroom, et on lit le
resultat.

## 1. La mire

\`${path.basename(target)}\` (${outSize}x${outSize}) contient **une fois chaque
couleur** d'une grille de ${cube}x${cube}x${cube}. Elle a l'air d'un damier bizarre : c'est
normal, ce n'est pas une photo.

Chaque couleur y occupe un carre de ${blockSize}x${blockSize} pixels. Ce n'est pas un detail :
avec une couleur par pixel, deux voisins sont deux couleurs sans rapport, et
tout traitement qui regarde le voisinage les fait baver l'une sur l'autre. Ca ne
se voit pas dans les tons clairs, et ca ruine les noirs. L'import ne lit que le
coeur de chaque carre.

## 2. Dans Lightroom

1. Importe la mire.
2. Applique le preset a capturer (CN11, CN17, un preset perso...) et **rien
   d'autre**. Pas de recadrage, pas de correction d'objectif, pas de reglage
   manuel par-dessus.
3. Exporte en **PNG**, **taille d'origine** (${outSize}x${outSize}), en **sRVB**,
   sans nettete de sortie, sans filigrane, sans redimensionnement.

> L'espace **sRVB** est obligatoire. Lightroom propose Adobe RVB par defaut :
> c'est un espace plus large, ou les memes chiffres RVB designent d'autres
> couleurs. La table serait fausse d'un bout a l'autre sans que rien ne le
> signale.

> Le redimensionnement est le seul vrai piege : il melange des couleurs
> voisines et rend la table fausse. L'import le detecte et refuse le fichier.

## 3. L'import

\`\`\`bash
node scripts/import-lightroom-preset.mjs \\
  --hald presets-lightroom/cn11.png \\
  --xmp  presets-lightroom/CN11.xmp \\
  --id   cn11 \\
  --label "CN11"
\`\`\`

\`--xmp\` est optionnel mais recommande : une Hald CLUT capture parfaitement la
**couleur**, mais elle ne peut rien dire de la clarte, de la texture, de la
nettete, du grain ni du vignetage — ces reglages dependent des pixels voisins
ou de la position dans l'image. Le \`.xmp\` va les chercher.

## Ou trouver les .xmp

- **macOS** : \`~/Library/Application Support/Adobe/CameraRaw/Settings\`
- **Windows** : \`%AppData%\\Adobe\\CameraRaw\\Settings\`

Dans Lightroom, tu peux aussi faire un clic droit sur un preset -> **Exporter**.
`, 'utf8');

console.log(`Mire ecrite       : ${target}`);
console.log(`  dimensions      : ${outSize}x${outSize} (cube ${cube}^3 = ${cube ** 3} couleurs`
    + `${blockSize > 1 ? `, ${blockSize}x${blockSize} pixels chacune` : ''})`);
console.log(`Marche a suivre   : ${readme}`);
