/*
 * Le degrade de ciel de couchant, rendu A 1:1 et jamais redimensionne.
 *
 *   node scripts/ciel-couchant-1-1.mjs couchant,ambre,powlisher-cine
 *
 * POURQUOI CE CONTROLE A SON PROPRE SCRIPT. Un ciel de coucher est le gradient
 * le plus difficile de toute la photographie pour une LUT: il court de l'orange
 * a l'horizon au bleu au zenith, et il PASSE PAR LA CHROMA QUASI NULLE. C'est
 * exactement l'endroit ou un decalage de split-tone devient plus long que le
 * rayon de teinte et comprime les teintes voisines — et, si l'etage est mal
 * pose, l'endroit ou une bande apparait.
 *
 * ET UNE PLANCHE REDUITE MENT. Reduire une image MOYENNE ses pixels: une bande
 * de deux niveaux disparait au redimensionnement et se voit en plein sur
 * l'ecran de l'utilisateur. Ce script extrait donc un morceau de 900 x 600
 * pixels d'origine et le rend tel quel, sans aucun resize, par le vrai chemin de
 * rendu (LUT 3D, interpolation trilineaire, pleine force).
 *
 * IL CHOISIT SEUL SA PHOTO. Parmi les couchants neutres, il garde celles dont le
 * tiers haut est le plus LISSE (faible variation d'un pixel au suivant) tout en
 * gardant une grande etendue de luminosite. Un ciel lisse et etendu est
 * precisement celui qui revele une bande s'il y en a une; un ciel nuageux la
 * cacherait.
 *
 * A cote, la meme bande NON traitee: une bande deja presente dans le JPEG
 * d'origine n'est pas la faute du preset, et sans le temoin on l'accuserait.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { getPresetLut, VISION_PRESET_BY_ID } from '../src/features/vibefx-studio/utils/visionPresets.js';
import { applyLut3dToData, LUT_SIZE } from '../src/features/vibefx-studio/utils/lut3d.js';

const BIBLIO = path.join(os.homedir(), 'Desktop', 'powlisher-biblio');
const ids = (process.argv[2] || 'couchant').split(',').filter(Boolean);
for (const id of ids) if (!VISION_PRESET_BY_ID[id]) { console.error(`preset inconnu: ${id}`); process.exit(1); }
const SORTIE = process.argv[3] || BIBLIO;

const candidats = [];
for (const fam of ['coucher-mer', 'coucher-paysage', 'coucher-ville']) {
    const d = path.join(BIBLIO, 'neutre', fam);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => /\.(jpe?g|png|webp)$/i.test(x))) {
        const p = path.join(d, f);
        const m = await sharp(p).metadata();
        if (m.width < 1200 || m.height < 700) continue;
        const { data } = await sharp(p)
            .extract({ left: 0, top: 0, width: m.width, height: Math.floor(m.height / 3) })
            .resize(160, 60, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
        let saut = 0;
        for (let i = 1; i < data.length; i += 1) saut += Math.abs(data[i] - data[i - 1]);
        candidats.push({ p, rugosite: saut / data.length, etendue: Math.max(...data) - Math.min(...data), w: m.width, h: m.height });
    }
}
candidats.sort((a, b) => a.rugosite - b.rugosite || b.etendue - a.etendue);
const choisies = candidats.filter((c) => c.etendue > 40).slice(0, 3);
if (!choisies.length) { console.error('aucun ciel exploitable dans le tas neutre'); process.exit(1); }

for (const [k, c] of choisies.entries()) {
    const L = Math.max(0, Math.floor(c.w / 2) - 450);
    const H = Math.min(600, Math.floor(c.h / 2));
    const { data, info } = await sharp(c.p).extract({ left: L, top: 0, width: Math.min(900, c.w - L), height: H })
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const brut = (buf) => sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    const tuiles = [{ input: await brut(Buffer.from(data)), left: 0, top: 0 }];
    let x = info.width;
    for (const id of ids) {
        const buf = Buffer.from(data);
        applyLut3dToData(buf, getPresetLut(id), LUT_SIZE, 1);
        tuiles.push({ input: await brut(buf), left: x, top: 0 });
        x += info.width;
    }
    const cible = path.join(SORTIE, `CIEL-COUCHANT-1-1-${k + 1}.png`);
    await sharp({ create: { width: x, height: info.height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
        .composite(tuiles).png().toFile(cible);
    console.log(`${path.basename(c.p)} (rugosite ${c.rugosite.toFixed(2)}) -> ${cible}`);
}
console.log(`\ncolonnes: brut | ${ids.join(' | ')}   — a 1:1, aucun redimensionnement`);
