/*
 * Passer la mire C dans NOTRE moteur, pour la mesurer comme on mesure la sienne.
 *
 *   node scripts/rendu-mire-c.mjs --texture 50 --sortie /tmp/nous-texture-50.png
 *   node scripts/rendu-mire-c.mjs --clarity 50 --sortie /tmp/nous-clarte-50.png
 *
 * Puis :
 *   node scripts/mesure-mire-c.mjs --reference <mire-C-details.png> \
 *     --lightroom /tmp/nous-texture-50.png --label "NOUS, texture 50"
 *
 * POURQUOI PASSER PAR UN NAVIGATEUR. Les effets spatiaux du moteur
 * (`applyClarity`, `applyTexture`, `applySharpness`) s'appuient sur le flou du
 * canvas — `ctx.filter = 'blur(Npx)'`, qui n'existe que dans un navigateur. Les
 * reimplementer en Node donnerait un chiffre sur du code que personne
 * n'execute. On sert donc `src/` en statique et on appelle le VRAI moteur dans
 * un Chromium: ce qui est mesure ici est ce que l'app affiche.
 *
 * La mire n'est JAMAIS redimensionnee: un effet de detail depend de la taille
 * des pixels, et la calibration a ete faite a 1620x1080.
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIRE_DEFAUT = 'presets-lightroom/mires-effets/mire-C-details.png';

const args = process.argv.slice(2);
const lire = (nom, defaut = null) => {
    const i = args.indexOf(`--${nom}`);
    return i === -1 ? defaut : args[i + 1];
};

const mire = lire('mire', MIRE_DEFAUT);
const sortie = lire('sortie', 'tmp-nous-mire-c.png');

/* Tout ce qui n'est ni --mire ni --sortie est un reglage passe au moteur. */
const filters = { filterIntensity: 100 };
for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    const cle = args[i].slice(2);
    if (cle === 'mire' || cle === 'sortie') { i += 1; continue; }
    const brut = args[i + 1];
    /* `--safeSmartphone false` desactive les garde-fous: sans ca, impossible de
       mesurer au-dela de la borne sure (texture 100, par exemple, est ramenee a
       50 par `normalizeVisionFilters`). */
    if (brut === 'true' || brut === 'false') {
        filters[cle] = brut === 'true';
        i += 1;
        continue;
    }
    const valeur = Number(brut);
    if (!Number.isFinite(valeur)) {
        console.error(`\nECHEC: --${cle} attend un nombre (ou true/false), recu « ${brut} ».\n`);
        process.exit(1);
    }
    filters[cle] = valeur;
    i += 1;
}

if (!existsSync(path.resolve(RACINE, mire))) {
    console.error(`\nECHEC: mire introuvable: ${mire}`);
    console.error('Fabrique-la avec:  npm run preset:mire-effets\n');
    process.exit(1);
}

const MIME = { '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const serveur = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<!doctype html><meta charset="utf-8"><title>mire</title>');
        return;
    }
    if (url === '/__mire') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(readFileSync(path.resolve(RACINE, mire)));
        return;
    }
    /* Le moteur ecrit ses imports sans extension: le navigateur, lui, l'exige. */
    const brut = path.join(RACINE, url);
    const cible = brut.startsWith(RACINE) && existsSync(brut) ? brut
        : (existsSync(`${brut}.js`) ? `${brut}.js` : null);
    if (!cible) { res.writeHead(404).end('non'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(cible)] || 'application/octet-stream' });
    res.end(readFileSync(cible));
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('  [page]', m.text()); });
await page.goto(`http://127.0.0.1:${serveur.address().port}/`);

const dataUrl = await page.evaluate(async (f) => {
    const { renderStudio } = await import('/src/features/vibefx-studio/engine/studioRenderer.js');
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = '/__mire'; });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    renderStudio(ctx, canvas, img.width, img.height, false, 'high', {
        images: [img], cropRatio: 'original', cropPos: { x: 0, y: 0 }, cropScale: 1,
        isCropping: false, filters: f,
    });
    return canvas.toDataURL('image/png');
}, filters);

await navigateur.close();
serveur.close();

const { writeFileSync } = await import('node:fs');
writeFileSync(sortie, Buffer.from(dataUrl.split(',')[1], 'base64'));

const regles = Object.entries(filters).filter(([k]) => k !== 'filterIntensity');
console.log(`\nMire rendue par NOTRE moteur: ${sortie}`);
console.log(`  reglages : ${regles.map(([k, v]) => `${k}=${v}`).join(', ') || 'aucun'}\n`);
