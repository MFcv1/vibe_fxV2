/*
 * LA MIRE A, A N'IMPORTE QUELLE LARGEUR.
 *
 *   node scripts/make-mire-largeur.mjs <largeur> [<largeur>...] [--sortie <dossier>]
 *
 * POURQUOI ELLE EXISTE
 *
 * La grosseur du grain de Lightroom depend de la taille de l'image. Pour la
 * mesurer, il faut la MEME mire a plusieurs tailles — et il faut qu'elle soit
 * DESSINEE a cette taille, jamais redimensionnee: agrandir une mire au plus
 * proche voisin marche (les aplats restent unis), mais la REDUIRE melange les
 * bords des carres et fabrique des pixels qui n'existent dans aucun aplat.
 *
 * La geometrie est celle de la mire A (6x4 carres de 220 px sur 1620x1080),
 * mise a l'echelle. `mesure-taille-grain.mjs` la retrouve en lisant la largeur
 * du fichier, donc rien a lui passer de plus.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const iSortie = args.indexOf('--sortie');
const sortie = iSortie === -1 ? 'presets-lightroom/mires-effets' : args[iSortie + 1];
const largeurs = args.filter((a, i) => !a.startsWith('--') && (iSortie === -1 || i !== iSortie + 1))
    .map(Number).filter((n) => Number.isFinite(n) && n > 0);

if (!largeurs.length) {
    console.error('\nUsage: node scripts/make-mire-largeur.mjs <largeur> [...] [--sortie <dossier>]\n');
    process.exit(1);
}

/* La mire A de reference, dont tout le reste est une mise a l'echelle. */
const W0 = 1620;
const H0 = 1080;
const COLS = 6;
const ROWS = 4;
const SIZE0 = 220;
const FOND = 100;

const PATCHES = [
    [8, 8, 8], [24, 24, 24], [48, 48, 48], [72, 72, 72], [96, 96, 96], [112, 112, 112],
    [128, 128, 128], [144, 144, 144], [168, 168, 168], [192, 192, 192], [224, 224, 224], [247, 247, 247],
    [200, 40, 40], [40, 170, 60], [40, 70, 200], [40, 190, 200], [200, 50, 190], [220, 200, 40],
    [222, 176, 148], [166, 120, 94], [92, 140, 186], [58, 96, 62], [150, 150, 152], [176, 168, 150],
];

fs.mkdirSync(sortie, { recursive: true });
console.log(`\nMire A, dessinee a chaque taille (jamais redimensionnee) :`);

for (const W of largeurs) {
    const k = W / W0;
    const H = Math.round(H0 * k);
    const size = Math.round(SIZE0 * k);
    const gapX = Math.round((W - COLS * size) / (COLS + 1));
    const gapY = Math.round((H - ROWS * size) / (ROWS + 1));
    if (size < 60) {
        console.error(`  ${W} px : IGNOREE — des carres de ${size} px sont trop petits pour`
            + ' que leur coeur porte une mesure fiable.');
        continue;
    }
    const buf = Buffer.alloc(W * H * 3, FOND);
    PATCHES.forEach((couleur, index) => {
        const x0 = gapX + (index % COLS) * (size + gapX);
        const y0 = gapY + Math.floor(index / COLS) * (size + gapY);
        for (let y = y0; y < y0 + size && y < H; y += 1) {
            for (let x = x0; x < x0 + size && x < W; x += 1) {
                const i = (y * W + x) * 3;
                buf[i] = couleur[0];
                buf[i + 1] = couleur[1];
                buf[i + 2] = couleur[2];
            }
        }
    });
    const nom = `mire-A-${W}px.png`;
    await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
        .png({ compressionLevel: 9 })
        .toFile(path.join(sortie, nom));
    console.log(`  ${path.join(sortie, nom)}  (${W}x${H}, carres de ${size} px)`);
}
console.log('');
