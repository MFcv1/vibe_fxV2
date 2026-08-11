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
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { buildHaldIdentity, haldImageSize } from '../src/features/vibefx-studio/utils/haldClut.js';

const outputDir = process.argv[2] || 'presets-lightroom';
const level = Number(process.argv[3] || 8);

if (!Number.isInteger(level) || level < 2 || level > 16) {
    console.error(`Niveau Hald invalide: ${process.argv[3]}. Attendu un entier entre 2 et 16 (8 recommande).`);
    process.exit(1);
}

const { data, size, cube } = buildHaldIdentity(level);
fs.mkdirSync(outputDir, { recursive: true });
const target = path.join(outputDir, `hald-clut-neutre-niveau${level}.png`);

await sharp(Buffer.from(data), { raw: { width: size, height: size, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(target);

const readme = path.join(outputDir, 'LISEZ-MOI.md');
fs.writeFileSync(readme, `# Capturer un preset Lightroom

Ce dossier sert a importer un preset Lightroom dans Vibe_fx **sans approximer**
les calculs d'Adobe : on fait faire le travail a Lightroom, et on lit le
resultat.

## 1. La mire

\`hald-clut-neutre-niveau${level}.png\` (${size}x${size}) contient **une fois chaque
couleur** d'une grille de ${cube}x${cube}x${cube}. Elle a l'air d'un damier bizarre : c'est
normal, ce n'est pas une photo.

## 2. Dans Lightroom

1. Importe la mire.
2. Applique le preset a capturer (CN11, CN17, un preset perso...) et **rien
   d'autre**. Pas de recadrage, pas de correction d'objectif, pas de reglage
   manuel par-dessus.
3. Exporte en **PNG**, **taille d'origine** (${size}x${size}), sans nettete de
   sortie, sans filigrane, sans redimensionnement.

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
console.log(`  dimensions      : ${size}x${size} (cube ${cube}^3 = ${cube ** 3} couleurs)`);
console.log(`Marche a suivre   : ${readme}`);
