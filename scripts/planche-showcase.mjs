/*
 * La planche a regarder pour REVALIDER `powlisher-showcase` — avec ses effets.
 *
 *   node scripts/planche-showcase.mjs [photo...] [--sortie <prefixe>]
 *
 * POURQUOI CE SCRIPT EXISTE, alors que `planche-presets.mjs` est deja la.
 * Celui-la applique la LUT SEULE, et il le dit lui-meme. Or les trois reglages
 * qu'il faut revalider — grain 8, vignetage 3, relief 14 — ne sont PAS dans la
 * LUT: ce sont des effets spatiaux, poses par le moteur canvas. Une planche de
 * LUT ne peut donc pas repondre a la question posee.
 *
 * COMMENT. On ne reimplemente rien: on lance le VRAI moteur
 * (`engine/studioRenderer.js`) dans un vrai Chromium, via Playwright, en
 * servant `src/` en statique. Ce qui est regarde ici est exactement ce que
 * l'app affiche — meme LUT, meme grain, meme vignetage, meme clarte.
 *
 * DEUX PLANCHES, parce qu'elles ne repondent pas a la meme question:
 *
 *   -cadre.png  l'image entiere, reduite pour tenir a l'ecran. C'est la planche
 *               du VIGNETAGE et du look general. Elle ment sur le grain (une
 *               reduction moyenne le bruit), et c'est assumé.
 *   -1a1.png    un carre de 460 px pris au centre du rendu PLEINE RESOLUTION,
 *               sans le moindre redimensionnement. C'est la planche du GRAIN et
 *               du RELIEF. Un pixel de la planche = un pixel du rendu.
 *
 * Les effets sont toujours appliques a la resolution native de la photo, comme
 * dans l'app. Rien n'est reduit avant le rendu.
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { VISION_PRESET_BY_ID } from '../src/features/vibefx-studio/utils/visionPresets.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const lireArg = (nom, defaut = null) => {
    const i = args.indexOf(`--${nom}`);
    return i === -1 ? defaut : args[i + 1];
};
const sortie = lireArg('sortie', 'tmp-planche-showcase');
const photos = args.filter((v, i) => {
    if (v.startsWith('--')) return false;
    if (i > 0 && args[i - 1] === '--sortie') return false;
    return true;
});

const PHOTOS_DEFAUT = [
    'lambo-garage-jaune.jpg', 'lambo-garage-orange.jpg',
    'lambo-rue-orange.jpg', 'lambo-salle-sombre.jpg',
].map((n) => path.join(process.env.HOME, 'Desktop/devimage/unsplash', n));

const fichiers = (photos.length ? photos : PHOTOS_DEFAUT).filter((f) => {
    if (existsSync(f)) return true;
    console.error(`Introuvable, ignoree: ${f}`);
    return false;
});

if (!fichiers.length) {
    console.error('\nAucune photo. Usage: node scripts/planche-showcase.mjs <photo...>');
    console.error('Photos de test: Unsplash, PEU retouchees (~/Desktop/devimage/).\n');
    process.exit(1);
}

/*
 * Les effets sont LUS dans le preset, jamais recopies ici: une planche qui
 * montre autre chose que ce que l'app applique ne sert a rien.
 */
const PRESET_ID = 'powlisher-showcase';
const BASE = { presetId: PRESET_ID, filterIntensity: 100 };
const SPATIAL = VISION_PRESET_BY_ID[PRESET_ID].spatialFilters;

const COLONNES_CADRE = [
    ['originale', null],
    ['LUT seule', { ...BASE }],
    [`preset actuel (vignetage ${SPATIAL.vignette})`, { ...BASE, ...SPATIAL }],
    ['vignetage 3 (avant)', { ...BASE, ...SPATIAL, vignette: 3 }],
    ['vignetage 15', { ...BASE, ...SPATIAL, vignette: 15 }],
];

const COLONNES_1A1 = [
    ['LUT seule', { ...BASE }],
    [`+ grain ${SPATIAL.grain}`, { ...BASE, grain: SPATIAL.grain }],
    [`+ relief ${SPATIAL.clarity}`, { ...BASE, clarity: SPATIAL.clarity }],
    ['preset complet', { ...BASE, ...SPATIAL }],
];

/*
 * Serveur statique minimal. Le moteur ecrit ses imports SANS extension
 * (`from './visionColorScience'`), ce que Node tolere et pas le navigateur:
 * on rajoute donc `.js` quand le fichier nu n'existe pas.
 */
const MIME = {
    '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.json': 'application/json', '.html': 'text/html',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

const serveur = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<!doctype html><meta charset="utf-8"><title>planche</title>');
        return;
    }
    const photoIndex = url.match(/^\/__photo\/(\d+)$/);
    const cible = photoIndex
        ? fichiers[Number(photoIndex[1])]
        : (() => {
            const brut = path.join(RACINE, url);
            if (!brut.startsWith(RACINE)) return null;
            if (existsSync(brut)) return brut;
            return existsSync(`${brut}.js`) ? `${brut}.js` : null;
        })();
    if (!cible || !existsSync(cible)) {
        res.writeHead(404).end('non');
        return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(cible).toLowerCase()] || 'application/octet-stream' });
    res.end(readFileSync(cible));
});

await new Promise((resolve) => serveur.listen(0, '127.0.0.1', resolve));
const port = serveur.address().port;

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('  [page]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`);

await page.evaluate(async () => {
    const [{ renderStudio }] = await Promise.all([
        import('/src/features/vibefx-studio/engine/studioRenderer.js'),
    ]);
    window.__renderStudio = renderStudio;
    window.__rendu = async (src, filters) => {
        const img = new Image();
        await new Promise((ok, ko) => {
            img.onload = ok; img.onerror = () => ko(new Error(`image illisible: ${src}`));
            img.src = src;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!filters) {
            ctx.drawImage(img, 0, 0);
        } else {
            renderStudio(ctx, canvas, img.width, img.height, false, 'high', {
                images: [img],
                cropRatio: 'original',
                cropPos: { x: 0, y: 0 },
                cropScale: 1,
                isCropping: false,
                filters,
            });
        }
        return canvas.toDataURL('image/png');
    };
});

const dataUrlVersBuffer = (url) => Buffer.from(url.split(',')[1], 'base64');

console.log(`\n${fichiers.length} photo(s), ${COLONNES_CADRE.length + COLONNES_1A1.length} rendus chacune.`);

const rendus = [];
for (const [index, fichier] of fichiers.entries()) {
    const src = `/__photo/${index}`;
    const ligne = { nom: path.basename(fichier), cadre: [], carre: [] };
    for (const [, filters] of COLONNES_CADRE) {
        ligne.cadre.push(dataUrlVersBuffer(await page.evaluate(
            ([s, f]) => window.__rendu(s, f), [src, filters],
        )));
    }
    for (const [, filters] of COLONNES_1A1) {
        ligne.carre.push(dataUrlVersBuffer(await page.evaluate(
            ([s, f]) => window.__rendu(s, f), [src, filters],
        )));
    }
    rendus.push(ligne);
    console.log(`  ${ligne.nom} — rendue`);
}

await navigateur.close();
serveur.close();

/*
 * Ce que le vignetage coute vraiment, en niveaux sur 255 — parce que « monter
 * le vignetage » est un choix d'oeil, mais qu'il se decide mieux avec l'ordre
 * de grandeur sous les yeux. Mesure sur le rendu PLEINE RESOLUTION: la moyenne
 * de toute l'image, et celle du coin (un huitieme de cote), la ou il agit.
 */
async function luminances(buf) {
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const coin = { w: Math.round(info.width / 8), h: Math.round(info.height / 8) };
    let totale = 0;
    let angle = 0;
    for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
            const i = (y * info.width + x) * 3;
            const luma = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) / 256;
            totale += luma;
            if (x < coin.w && y < coin.h) angle += luma;
        }
    }
    return { totale: totale / (info.width * info.height), angle: angle / (coin.w * coin.h) };
}

console.log('\nAssombrissement par rapport a « LUT seule », en niveaux /255 :');
console.log('  (les colonnes portent aussi grain et relief, qui eclaircissent un peu;');
console.log('   un coin deja noir reste a 0,00 — le vignetage MULTIPLIE, il ne soustrait pas.)');
console.log('  photo                      colonne              image entiere   coin');
for (const ligne of rendus) {
    const base = await luminances(ligne.cadre[1]);
    for (let j = 2; j < COLONNES_CADRE.length; j += 1) {
        const mesure = await luminances(ligne.cadre[j]);
        console.log(`  ${ligne.nom.padEnd(26)} ${COLONNES_CADRE[j][0].padEnd(20)} `
            + `${(base.totale - mesure.totale).toFixed(2).padStart(9)}   ${(base.angle - mesure.angle).toFixed(2).padStart(6)}`);
    }
}

const MARGE = 10;
const BANDEAU = 30;
const FOND = '#0c0c0c';

function etiquettes(labels, largeurTuile, largeurTotale) {
    const textes = labels.map((label, i) => `<text x="${i * (largeurTuile + MARGE) + 10}" y="20"
        font-family="sans-serif" font-size="15" fill="#e8e8e8">${label}</text>`).join('');
    return Buffer.from(`<svg width="${largeurTotale}" height="${BANDEAU}">${textes}</svg>`);
}

async function composer(colonnes, tuilesParLigne, largeurTuile, fichierSortie, transformer) {
    const lignes = [];
    for (const ligne of rendus) {
        lignes.push(await Promise.all(tuilesParLigne(ligne).map(transformer)));
    }
    const hauteurs = lignes.map((t) => t[0].info.height);
    const largeurTotale = colonnes.length * (largeurTuile + MARGE) - MARGE;
    const hauteurTotale = BANDEAU + hauteurs.reduce((a, h) => a + h + MARGE, 0) - MARGE;

    const composite = [{ input: etiquettes(colonnes.map(([l]) => l), largeurTuile, largeurTotale), top: 0, left: 0 }];
    let top = BANDEAU;
    lignes.forEach((tuiles, i) => {
        tuiles.forEach((tuile, j) => {
            composite.push({ input: tuile.data, left: j * (largeurTuile + MARGE), top });
        });
        top += hauteurs[i] + MARGE;
    });

    await sharp({
        create: {
            width: largeurTotale, height: hauteurTotale, channels: 3, background: FOND,
        },
    }).composite(composite).png().toFile(fichierSortie);
    console.log(`Planche ecrite: ${fichierSortie}`);
}

const LARGEUR_CADRE = 460;
const COTE_CARRE = 460;

await composer(
    COLONNES_CADRE, (l) => l.cadre, LARGEUR_CADRE, `${sortie}-cadre.png`,
    async (buf) => {
        const data = await sharp(buf).resize({ width: LARGEUR_CADRE, fit: 'inside' }).png().toBuffer();
        return { data, info: await sharp(data).metadata() };
    },
);

await composer(
    COLONNES_1A1, (l) => l.carre, COTE_CARRE, `${sortie}-1a1.png`,
    async (buf) => {
        const meta = await sharp(buf).metadata();
        const cote = Math.min(COTE_CARRE, meta.width, meta.height);
        const data = await sharp(buf).extract({
            left: Math.round((meta.width - cote) / 2),
            top: Math.round((meta.height - cote) / 2),
            width: cote, height: cote,
        }).png().toBuffer();
        return { data, info: await sharp(data).metadata() };
    },
);

console.log('\nLa planche « cadre » juge le VIGNETAGE et le look.');
console.log('La planche « 1a1 » juge le GRAIN et le RELIEF: 1 pixel = 1 pixel, jamais reduite.\n');
