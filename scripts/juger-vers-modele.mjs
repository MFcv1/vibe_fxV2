/*
 * « Ce preset rapproche-t-il une photo ordinaire du modele ? »
 *
 *   node scripts/juger-vers-modele.mjs --presets ambre,powlisher-cine --n 3
 *
 * C'est le test qui manquait au projet. Jusqu'ici un preset se verifiait de deux
 * facons: ses cibles internes (le smoke) et l'oeil du porteur du projet. Entre
 * les deux, rien ne disait « le rendu ressemble-t-il a ce qu'on visait ».
 *
 * LE PRINCIPE. On applique le preset a des photos NEUTRES — pas aux siennes,
 * qui portent deja son traitement et donneraient une double couche — puis on
 * profile le resultat avec le meme instrument qui a profile le modele. Si le
 * preset marche, les mesures de sortie doivent s'etre deplacees depuis celles du
 * tas neutre VERS celles du modele.
 *
 * ON MESURE DES ANGLES DE CONTENU, pas des moyennes globales: la teinte de la
 * peau, celle du feuillage, celle du ciel. Une moyenne globale bouge des qu'on
 * change de sujet; ces trois-la sont ancrees sur des choses reelles et
 * comparables d'une photo a l'autre. Ce sont aussi les trois qu'on regarde en
 * premier quand on juge un rendu a l'oeil.
 *
 * LA NOTE. Pour chaque grandeur, on rapporte le chemin parcouru:
 *
 *     0 %   le preset n'a rien fait, la sortie est restee sur le tas neutre
 *   100 %   la sortie est tombee exactement sur le modele
 *   >100 %  il a depasse — un exces se lit ici avant de se voir a l'ecran
 *
 * Les photos de test sont tirees du tas neutre par sujet, les memes pour tous
 * les presets compares.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { profil } from './profil-corpus.mjs';
import { getPresetLut, VISION_PRESET_BY_ID } from '../src/features/vibefx-studio/utils/visionPresets.js';
import { applyLut3dToData, LUT_SIZE } from '../src/features/vibefx-studio/utils/lut3d.js';

const BIBLIO = path.join(os.homedir(), 'Desktop', 'powlisher-biblio');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ids = opt('presets', 'ambre').split(',').filter(Boolean);
const PAR_FAMILLE = Number(opt('n', 3));
const MODELE = opt('modele', path.join(os.homedir(), 'Desktop', 'lumierejaune'));

for (const id of ids) if (!VISION_PRESET_BY_ID[id]) { console.error(`preset inconnu: ${id}`); process.exit(1); }

const med = (xs) => { const t = xs.filter(Number.isFinite).sort((a, b) => a - b); return t.length ? (t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2) : NaN; };

/* Les grandeurs jugees. Trois angles de contenu, plus trois reperes de
 * tonalite — un preset peut poser les bonnes teintes et rater completement la
 * densite, et ca se verrait tout de suite a l'oeil. */
const G = {
    'peau °': (p) => (p.peauPart > 8 ? p.peauTeinte : NaN),
    'vert °': (p) => (p.vertPart > 8 ? p.vertTeinte : NaN),
    'ciel °': (p) => (p.cielPart > 3 ? p.cielTeinte : NaN),
    'chroma': (p) => p.chromaMoy,
    'pt blanc': (p) => p.pointBlanc,
    'contraste': (p) => p.p95 - p.p05,
    'reflets b*': (p) => p.refletB,
    'ombres b*': (p) => p.ombresB,
};
const noms = Object.keys(G);
/* Deux grandeurs ne sont PAS a la portee d'un preset, et il faut le dire plutot
 * que de courir apres:
 *  - `reflets b*` est pris sur le 1 % le plus lumineux du cadre. Chez le modele
 *    ce sont des couchants et des lampes: leur teinte est dans la SCENE. Un
 *    preset qui l'atteindrait poserait ce jaune sur tous les blancs, ce qui est
 *    exactement le « denature » qu'on cherche a eviter.
 *  - `chroma` est une moyenne globale, donc menee par le contenu: le modele
 *    contient des couchants et une voiture bleue.
 * Les deux restent affichees — elles disent la direction — mais elles sortent
 * de la note. */
const HORS_NOTE = new Set(['reflets b*', 'chroma']);

/* Le modele, profile tel quel. */
const modele = [];
for (const f of fs.readdirSync(MODELE).filter((x) => /\.(jpe?g|png|webp)$/i.test(x)).sort()) {
    modele.push(await profil(path.join(MODELE, f)));
}

/* Les photos de test: le tas neutre, quelques-unes par famille, les memes pour
 * tout le monde. */
const racine = path.join(BIBLIO, 'neutre');
const photos = [];
for (const fam of fs.readdirSync(racine).filter((f) => fs.statSync(path.join(racine, f)).isDirectory()).sort()) {
    photos.push(...fs.readdirSync(path.join(racine, fam)).filter((x) => /\.jpe?g$/i.test(x)).sort()
        .slice(0, PAR_FAMILLE).map((x) => path.join(racine, fam, x)));
}

/* Chaque photo est rendue une fois par preset, dans un fichier temporaire que
 * `profil` peut relire — c'est le meme chemin que le rendu reel: LUT 3D,
 * interpolation trilineaire, pleine force. */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'juger-'));
const avant = [];
const apres = Object.fromEntries(ids.map((id) => [id, []]));

for (const ph of photos) {
    const { data, info } = await sharp(ph).rotate().resize(700, 700, { fit: 'inside', withoutEnlargement: true })
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const brut = path.join(tmp, 'brut.jpg');
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).jpeg({ quality: 95 }).toFile(brut);
    avant.push(await profil(brut));
    for (const id of ids) {
        const buf = Buffer.from(data);
        applyLut3dToData(buf, getPresetLut(id), LUT_SIZE, 1);
        const dest = path.join(tmp, `${id}.jpg`);
        await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).jpeg({ quality: 95 }).toFile(dest);
        apres[id].push(await profil(dest));
    }
}
fs.rmSync(tmp, { recursive: true, force: true });

const pad = (x, n) => String(x).padStart(n);
console.log(`\n${photos.length} photos neutres, modele de ${modele.length} photos\n`);
console.log(pad('', 12) + pad('neutre', 9) + pad('modele', 9) + ids.map((id) => pad(id.slice(0, 15), 17)).join(''));

const notes = Object.fromEntries(ids.map((id) => [id, []]));
for (const n of noms) {
    const depart = med(avant.map(G[n]));
    const but = med(modele.map(G[n]));
    const cellules = ids.map((id) => {
        const arrivee = med(apres[id].map(G[n]));
        if (!Number.isFinite(arrivee) || !Number.isFinite(but) || !Number.isFinite(depart)) return pad('—', 17);
        const chemin = Math.abs(but - depart) < 1e-6 ? NaN : 100 * (arrivee - depart) / (but - depart);
        if (Number.isFinite(chemin) && !HORS_NOTE.has(n)) notes[id].push(chemin);
        const marque = HORS_NOTE.has(n) ? '~' : '';
        return pad(`${arrivee.toFixed(1)} (${Number.isFinite(chemin) ? `${chemin.toFixed(0)} %${marque}` : '—'})`, 17);
    });
    console.log(pad(n, 12) + pad(depart.toFixed(1), 9) + pad(but.toFixed(1), 9) + cellules.join(''));
}

console.log('\n~ = hors note: grandeur menee par le contenu de la scene, pas par le preset.');
console.log('chemin parcouru vers le modele (0 % = rien fait, 100 % = pile dessus) :');
for (const id of ids) {
    const xs = notes[id];
    console.log(`  ${id.padEnd(20)} mediane ${pad(med(xs).toFixed(0) + ' %', 7)}`
        + `   ${xs.filter((x) => x >= 50 && x <= 150).length}/${xs.length} grandeurs notees entre 50 et 150 %`);
}
