/*
 * Compare QUELQUES presets seulement, cote a cote, sur des photos choisies.
 *
 *   node scripts/planche-duel.mjs --presets powlisher,powlisher-cine \
 *        --dossier ~/Desktop/powlisher-biblio/neutre --par-famille 1
 *
 * `planche-presets.mjs` montre TOUS les presets: c'est ce qu'il faut pour
 * choisir, mais avec dix colonnes chaque vignette devient trop petite pour
 * juger un virage de couleur. Ici on en met deux ou trois, assez grandes pour
 * qu'un ciel menthe ou un rouge hors gamut se voie.
 *
 * Les photos viennent du tas NEUTRE, pas du corpus du photographe: repasser un
 * preset sur une photo deja developpee etale deux fois le meme traitement et ne
 * dit rien de ce que le preset fera sur les photos de l'utilisateur.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { getPresetLut, VISION_PRESET_BY_ID } from '../src/features/vibefx-studio/utils/visionPresets.js';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const ids = opt('presets', 'powlisher,powlisher-cine').split(',').filter(Boolean);
const dossier = opt('dossier', path.join(os.homedir(), 'Desktop', 'powlisher-biblio', 'neutre'));
const parFamille = Number(opt('par-familles', opt('par-famille', 1)));
const familles = (opt('familles', 'architecture,auto,mer,rue,paysage')).split(',');
const H = Number(opt('hauteur', 300));
const sortie = opt('sortie', path.join(os.homedir(), 'Desktop', 'powlisher-biblio', 'DUEL.jpg'));

for (const id of ids) if (!VISION_PRESET_BY_ID[id]) { console.error(`preset inconnu: ${id}`); process.exit(1); }

const colonnes = [null, ...ids];
const lignes = [];
for (const fam of familles) {
    const d = path.join(dossier, fam);
    if (!fs.existsSync(d)) continue;
    const fichiers = fs.readdirSync(d).filter((x) => /\.jpe?g$/i.test(x)).sort().slice(0, parFamille);
    for (const f of fichiers) {
        const src = sharp(path.join(d, f)).rotate().resize({ height: H }).removeAlpha();
        const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
        const cellules = [];
        const n = info.width * info.height;
        for (const id of colonnes) {
            /* `applyLut3dToData` avance de QUATRE octets par pixel et prend la
             * taille de la LUT en troisieme argument. Lui passer un buffer a
             * trois canaux, ou oublier la taille, ne leve aucune erreur: ca
             * rend une image cisaillee en diagonale et deux fois trop sombre. */
            const rgba = Buffer.alloc(n * 4);
            for (let k = 0; k < n; k += 1) {
                rgba[k * 4] = data[k * 3];
                rgba[k * 4 + 1] = data[k * 3 + 1];
                rgba[k * 4 + 2] = data[k * 3 + 2];
                rgba[k * 4 + 3] = 255;
            }
            if (id) applyLut3dToData(rgba, getPresetLut(id), LUT_SIZE, 1);
            const rgb = Buffer.alloc(n * 3);
            for (let k = 0; k < n; k += 1) {
                rgb[k * 3] = rgba[k * 4];
                rgb[k * 3 + 1] = rgba[k * 4 + 1];
                rgb[k * 3 + 2] = rgba[k * 4 + 2];
            }
            cellules.push(await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } })
                .jpeg({ quality: 92 }).toBuffer());
        }
        lignes.push({ cellules, w: info.width, h: info.height, fam });
    }
}

const largeur = Math.max(...lignes.map((l) => l.w * colonnes.length));
const hauteur = lignes.reduce((s, l) => s + l.h, 0);
const comp = [];
let y = 0;
for (const l of lignes) {
    l.cellules.forEach((c, i) => comp.push({ input: c, left: i * l.w, top: y }));
    y += l.h;
}
await sharp({ create: { width: largeur, height: hauteur, channels: 3, background: '#111' } })
    .composite(comp).jpeg({ quality: 92 }).toFile(sortie);

console.log(`colonnes : originale | ${ids.join(' | ')}`);
console.log(`lignes   : ${lignes.map((l) => l.fam).join(', ')}`);
console.log(`-> ${sortie}`);
