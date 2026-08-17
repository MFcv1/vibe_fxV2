/*
 * La planche du grain — celle qu'on REGARDE, sur une vraie photo.
 *
 *   node scripts/planche-grain.mjs <photo> [--sortie <png>] [--zone <x,y>]
 *
 * Elle repond a la seule question qu'aucun ecart-type ne couvre: est-ce que le
 * changement d'echelle du 2026-08-15 abime le rendu ?
 *
 * Trois versions du meme morceau de photo, a l'echelle 1:1, sans le moindre
 * redimensionnement — reduire une image MOYENNE son grain, donc une planche
 * redimensionnee mentirait sur exactement ce qu'elle est censee montrer:
 *
 *   1. sans grain
 *   2. ANCIEN moteur, grain 20   (fusion `overlay`, la valeur de
 *                                 `powlisher-showcase` avant recalage)
 *   3. NOUVEAU moteur, grain 8   (additif cale sur Lightroom, la valeur apres)
 *
 * Les deux derniers portent la MEME force au ton moyen (2,76 contre 2,94/255
 * d'ecart-type). Ce que la planche montre, c'est ce que les chiffres ne
 * peuvent pas dire: l'ancien s'eteignait dans les ombres et les hautes
 * lumieres, le nouveau non. Sur une carrosserie sombre ou un ciel clair, ca se
 * voit — et c'est la qu'il faut juger.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [photo, ...reste] = process.argv.slice(2);
const readArg = (name, fallback = null) => {
    const i = reste.indexOf(`--${name}`);
    return i === -1 ? fallback : reste[i + 1];
};

if (!photo) {
    console.error('\nUsage: node scripts/planche-grain.mjs <photo> [--sortie <png>] [--zone x,y]\n');
    process.exit(1);
}

const sortie = readArg('sortie', 'tmp-planche-grain.png');
const COTE = 420;

const CANVAS_UTILS = 'src/features/vibefx-studio/utils/canvasUtils.js';
const source = fs.readFileSync(CANVAS_UTILS, 'utf8');
const constante = (nom) => {
    const trouve = source.match(new RegExp(`${nom}\\s*=\\s*([0-9.]+)`));
    if (!trouve) {
        console.error(`\nECHEC: ${nom} introuvable dans ${CANVAS_UTILS}.\n`);
        process.exit(1);
    }
    return Number(trouve[1]);
};
const SIGMA = constante('GRAIN_SIGMA_PAR_UNITE');
const BORD = constante('GRAIN_BORD');
const EXPOSANT = constante('GRAIN_BORD_EXPOSANT');

const ATTENUATION = new Float32Array(256);
for (let v = 0; v < 256; v += 1) {
    const d = Math.min(v, 255 - v);
    ATTENUATION[v] = d >= BORD ? 1 : (d / BORD) ** EXPOSANT;
}

function bruit(taille = 512, graine = 20260815) {
    let a = graine >>> 0;
    const random = () => {
        a += 0x6d2b79f5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const buf = new Float32Array(taille * taille);
    for (let i = 0; i < buf.length; i += 1) {
        const u1 = random() || 0.0001;
        buf[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * random());
    }
    return { buf, taille };
}

const { buf, taille } = bruit();

function nouveau(data, w, h, grain) {
    const out = Buffer.from(data);
    const sigma = SIGMA * grain;
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const i = (y * w + x) * 3;
            const luma = (out[i] * 77 + out[i + 1] * 150 + out[i + 2] * 29) >> 8;
            const delta = buf[(y % taille) * taille + (x % taille)] * sigma * ATTENUATION[luma];
            for (let c = 0; c < 3; c += 1) out[i + c] = Math.max(0, Math.min(255, Math.round(out[i + c] + delta)));
        }
    }
    return out;
}

function ancien(data, w, h, grain) {
    const out = Buffer.from(data);
    const alpha = (grain / 100) * 0.28;
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const n = Math.max(0, Math.min(255, Math.round(128 + buf[(y % taille) * taille + (x % taille)] * 50))) / 255;
            const i = (y * w + x) * 3;
            for (let c = 0; c < 3; c += 1) {
                const b = out[i + c] / 255;
                const o = b <= 0.5 ? 2 * b * n : 1 - 2 * (1 - b) * (1 - n);
                out[i + c] = Math.max(0, Math.min(255, Math.round((b * (1 - alpha) + o * alpha) * 255)));
            }
        }
    }
    return out;
}

const image = sharp(photo).rotate();
const meta = await image.metadata();
const zone = readArg('zone');
const [zx, zy] = zone
    ? zone.split(',').map(Number)
    : [Math.round((meta.width - COTE) / 2), Math.round((meta.height - COTE) / 2)];

const morceau = await image
    .extract({ left: zx, top: zy, width: COTE, height: COTE })
    .removeAlpha()
    .raw()
    .toBuffer();

const versions = [
    ['SANS GRAIN', morceau],
    ['ANCIEN — grain 20', ancien(morceau, COTE, COTE, 20)],
    ['NOUVEAU — grain 8', nouveau(morceau, COTE, COTE, 8)],
];

const marge = 16;
const hTexte = 30;
const largeur = versions.length * COTE + (versions.length + 1) * marge;
const hauteur = COTE + 2 * marge + hTexte;

const etiquettes = versions
    .map(([nom], i) => `<text x="${marge + i * (COTE + marge)}" y="${hTexte - 9}" font-family="monospace" font-size="17" fill="#fff">${nom}</text>`)
    .join('');

await sharp({ create: { width: largeur, height: hauteur, channels: 3, background: { r: 20, g: 20, b: 20 } } })
    .composite([
        { input: Buffer.from(`<svg width="${largeur}" height="${hauteur}">${etiquettes}</svg>`), left: 0, top: 0 },
        ...versions.map(([, b], i) => ({
            input: b,
            raw: { width: COTE, height: COTE, channels: 3 },
            left: marge + i * (COTE + marge),
            top: marge + hTexte,
        })),
    ])
    .png()
    .toFile(sortie);

fs.mkdirSync(path.dirname(sortie), { recursive: true });
console.log(`\n${path.basename(photo)} — zone ${zx},${zy}, ${COTE}x${COTE} a l'echelle 1:1`);
console.log(`Planche : ${sortie}\n`);
