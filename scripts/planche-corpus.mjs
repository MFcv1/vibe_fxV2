/*
 * Planche-contact du corpus: toutes les images sur une seule page, numerotees.
 *
 *   node scripts/planche-corpus.mjs [dossier]
 *
 * A quoi ca sert: le corpus est le materiau du preset, et on le trie a l'oeil.
 * Ouvrir 24 fichiers un par un pour juger d'un equilibre (assez de ciel ? trop
 * d'interieurs sombres ?) est impraticable — sur une planche, ca se voit en
 * deux secondes.
 *
 * Les numeros affiches sont ceux du manifeste, donc ceux que citent l'audit et
 * les mesures. C'est le point: pouvoir dire « img12 » et savoir de quoi on parle.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dir = process.argv[2] || 'docs/lightroom/corpus-powlisher';
const manifestPath = path.join(dir, 'manifeste.json');

if (!fs.existsSync(manifestPath)) {
    console.error(`\nAucun manifeste dans ${dir}. Lance d'abord:\n  node scripts/fetch-powlisher-corpus.mjs\n`);
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const images = manifest.images.filter((image) => fs.existsSync(path.join(dir, image.name)));

if (!images.length) {
    console.error(`\nAucune image dans ${dir}.\n`);
    process.exit(1);
}

const CELL = 340;
const PAD = 10;
const LABEL = 34;
const COLS = 6;

const rows = Math.ceil(images.length / COLS);
const width = COLS * (CELL + PAD) + PAD;
const height = rows * (CELL + LABEL + PAD) + PAD;
const layers = [];

for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    const thumb = await sharp(path.join(dir, image.name))
        .rotate()
        .resize(CELL, CELL, { fit: 'contain', background: { r: 16, g: 16, b: 18 } })
        .jpeg({ quality: 88 })
        .toBuffer();

    const x = PAD + (i % COLS) * (CELL + PAD);
    const y = PAD + Math.floor(i / COLS) * (CELL + LABEL + PAD);
    layers.push({ input: thumb, left: x, top: y });

    const numero = (image.name.match(/img(\d+)/) || [null, '??'])[1];
    const sujet = image.sujet.replace(/[<&]/g, '').slice(0, 32);
    const svg = `<svg width="${CELL}" height="${LABEL}">`
        + `<rect width="${CELL}" height="${LABEL}" fill="#0e0e10"/>`
        + `<text x="6" y="22" font-family="Helvetica" font-size="17" fill="#e8e8ee">img${numero}</text>`
        + `<text x="${CELL - 6}" y="22" font-family="Helvetica" font-size="13" fill="#6a6a75"`
        + ` text-anchor="end">${sujet}</text></svg>`;
    layers.push({ input: Buffer.from(svg), left: x, top: y + CELL });
}

const target = path.join(dir, 'PLANCHE-CONTACT.jpg');
await sharp({ create: { width, height, channels: 3, background: { r: 10, g: 10, b: 12 } } })
    .composite(layers)
    .jpeg({ quality: 88 })
    .toFile(target);

console.log(`\nPlanche : ${target}`);
console.log(`  ${images.length} image(s), ${width}x${height}\n`);
