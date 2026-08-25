/*
 * Trie une moisson brute en bibliotheque exploitable.
 *
 *   node scripts/trier-biblio.mjs [--source <dossier>] [--sortie <dossier>]
 *
 * Trois questions, dans cet ordre — l'ordre compte, chacune nettoie l'entree de
 * la suivante :
 *
 *  1. EST-CE UNE PHOTO ? Un fil X est plein de captures d'ecran, de courriers,
 *     d'infographies. Elles n'ont pas ete developpees, donc les faire entrer
 *     dans une moyenne de couleur la fausse. On les reconnait a trois choses
 *     qu'une photo n'a presque jamais : des aplats (pixels voisins strictement
 *     identiques), du blanc NEUTRE en grande quantite (un fond de document),
 *     et peu de couleurs distinctes.
 *
 *  2. EST-CE UN DOUBLON ? Il republie. Deux fois la meme image, c'est un vote
 *     double dans toutes les statistiques qui suivent.
 *
 *  3. PORTE-T-ELLE LE MEME TRAITEMENT ? On mesure l'ecart de chaque photo a la
 *     MEDIANE du lot, pas a la moyenne, et on echelonne par l'ecart absolu
 *     median. La raison est concrete : la moyenne et l'ecart-type sont eux-memes
 *     tires par les intrus qu'on cherche a debusquer — avec eux, dix captures
 *     d'ecran suffisent a rendre « normal » ce qui ne l'est pas. La mediane, non.
 *
 * Seules les RETENUES sont copiees dans la bibliotheque. Les ecartees ne sont ni
 * copiees ni supprimees : elles restent dans la moisson brute, qui est le filet
 * de securite si le tri se trompe. Le motif de chaque rejet est consigne dans
 * `tri.json`, donc une decision se relit sans rouvrir les images. Les planches sont la pour que l'oeil tranche
 * apres le chiffre — c'est la regle du projet, les mesures seules ne suffisent
 * pas (docs/presets-valides.md).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { profil } from './profil-corpus.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const racine = opt('sortie', path.join(os.homedir(), 'Desktop', 'powlisher-biblio'));
const source = opt('source', path.join(racine, 'brut'));
const SEUIL_ECART = Number(opt('seuil', 3.5)); // en ecarts medians

/* --- seuils « ce n'est pas une photo », calibres sur la moisson --- */
const NON_PHOTO = {
    dominante: 8,       // % du cadre occupe par UNE couleur exacte : le fond d'un document
    dominanteLuma: 24,  // ... et seulement si cet aplat est CLAIR (sinon c'est une nuit)
    neutreExact: 10,    // % de pixels ou r = v = b : de l'interface, pas de la lumiere
    blancNeutre: 18,  // % de pixels clairs ET sans couleur
    couleurs: 150,    // plancher: en dessous, ce n'est plus une image continue
    pixelsMin: 480 * 360,
};

/* La part de pixels identiques a leur voisin (`partPlate`) a ete ESSAYEE ici et
 * retiree : une vraie photo lissee — ciel de nuit, degrade, forte compression —
 * en affiche 30 a 50 %, autant qu'une capture d'ecran. Elle reste mesuree dans
 * le profil, elle ne decide plus rien. */

const fichiers = fs.readdirSync(source)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();

if (!fichiers.length) { console.error(`Rien a trier dans ${source}`); process.exit(1); }

/* Empreinte 8x8 en niveaux de gris : deux versions du meme cliche donnent la
 * meme, meme si l'une a ete recompressee. */
async function empreinte(fichier) {
    const { data } = await sharp(fichier).greyscale().resize(8, 8, { fit: 'fill' })
        .raw().toBuffer({ resolveWithObject: true });
    const moy = data.reduce((s, v) => s + v, 0) / data.length;
    return [...data].map((v) => (v > moy ? '1' : '0')).join('');
}

console.error(`${fichiers.length} images a trier...`);
const items = [];
for (const [i, f] of fichiers.entries()) {
    const chemin = path.join(source, f);
    try {
        const p = await profil(chemin);
        items.push({ fichier: f, chemin, p, hash: await empreinte(chemin) });
    } catch (e) {
        items.push({ fichier: f, chemin, erreur: String(e.message) });
    }
    if ((i + 1) % 50 === 0) process.stderr.write(`${i + 1} `);
}
process.stderr.write('\n');

/* --- 1. photo ou pas --- */
for (const it of items) {
    if (it.erreur) { it.motif = 'illisible'; continue; }
    const { p } = it;
    const raisons = [];
    if (p.largeur * p.hauteur < NON_PHOTO.pixelsMin) raisons.push('trop petite');
    if (p.partDominante > NON_PHOTO.dominante && p.dominanteLuma > NON_PHOTO.dominanteLuma) raisons.push(`aplat clair ${p.partDominante}%`);
    if (p.partNeutreExact > NON_PHOTO.neutreExact) raisons.push(`neutre ${p.partNeutreExact}%`);
    if (p.partBlancNeutre > NON_PHOTO.blancNeutre) raisons.push(`fond blanc ${p.partBlancNeutre}%`);
    if (p.couleurs < NON_PHOTO.couleurs) raisons.push(`${p.couleurs} couleurs`);
    if (raisons.length) { it.motif = 'pas-une-photo'; it.detail = raisons.join(', '); }
}

/* --- 2. doublons --- */
const vus = new Map();
for (const it of items) {
    if (it.motif || !it.hash) continue;
    if (vus.has(it.hash)) { it.motif = 'doublon'; it.detail = `de ${vus.get(it.hash)}`; continue; }
    vus.set(it.hash, it.fichier);
}

/* --- 3. ecart au traitement dominant --- */
const VARIABLES = {
    pied: (p) => p.pied,
    pointBlanc: (p) => p.pointBlanc,
    contraste: (p) => p.p95 - p.p05,
    chroma: (p) => p.chromaMoy,
    ombresA: (p) => p.ombresA,
    ombresB: (p) => p.ombresB,
    hautesArel: (p) => p.hautesA - p.mediansA,
    hautesBrel: (p) => p.hautesB - p.mediansB,
};
const noms = Object.keys(VARIABLES);
const gardes = items.filter((it) => !it.motif);

const med = (xs) => { const t = [...xs].sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };
const medianes = noms.map((n) => med(gardes.map((it) => VARIABLES[n](it.p))));
const eam = noms.map((n, j) => med(gardes.map((it) => Math.abs(VARIABLES[n](it.p) - medianes[j]))) || 1);

for (const it of gardes) {
    const z = noms.map((n, j) => (VARIABLES[n](it.p) - medianes[j]) / (1.4826 * eam[j]));
    it.ecart = +Math.sqrt(z.reduce((s, v) => s + v * v, 0) / z.length).toFixed(2);
    it.pire = noms[z.map((v, j) => [Math.abs(v), j]).sort((a, b) => b[0] - a[0])[0][1]];
}
/* L'ecart est MESURE pour tout le monde, mais il n'ecarte plus rien par defaut.
 * Essaye et retire le 2026-08-24: sur 138 photos rejetees, il y avait les
 * gratte-ciels de Shanghai au-dessus des nuages et un coucher de soleil sur mer
 * — c'est-a-dire exactement le genre d'images qu'on cherche. La raison est
 * structurelle: ce test compare une photo a la mediane du lot TOUS SUJETS
 * CONFONDUS. Une photo dans le brouillard a peu de chroma; le test la declare
 * atypique alors que c'est son sujet qui l'est, pas son developpement.
 *
 * L'ecart au traitement se mesure donc plus tard, A L'INTERIEUR d'une famille
 * de sujet, la ou la comparaison a un sens. `--ecarter-hors-cadre` retablit
 * l'ancien comportement pour qui veut le revoir. */
if (args.includes('--ecarter-hors-cadre')) {
    for (const it of gardes) {
        if (it.ecart > SEUIL_ECART) { it.motif = 'hors-cadre'; it.detail = `ecart ${it.ecart} (${it.pire})`; }
    }
}

/* --- copie --- */
const paniers = { retenues: [] };
for (const it of items) {
    const panier = it.motif ? `ecartees/${it.motif}` : 'retenues';
    (paniers[panier] ||= []).push(it);
}
const dossierRetenues = path.join(racine, 'retenues');
fs.rmSync(dossierRetenues, { recursive: true, force: true });
fs.rmSync(path.join(racine, 'ecartees'), { recursive: true, force: true }); // heritage d'une version precedente
fs.mkdirSync(dossierRetenues, { recursive: true });
for (const it of paniers.retenues) fs.copyFileSync(it.chemin, path.join(dossierRetenues, it.fichier));

/* --- planches --- */
const VIGN = 260, COLS = 8, MAX = 96;
async function planche(liste, cible) {
    if (!liste.length) return;
    const lot = liste.slice(0, MAX);
    const lignes = Math.ceil(lot.length / COLS);
    const tuiles = await Promise.all(lot.map(async (it, i) => ({
        input: await sharp(it.chemin).rotate().resize(VIGN, VIGN, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer(),
        left: (i % COLS) * VIGN, top: Math.floor(i / COLS) * VIGN,
    })));
    await sharp({ create: { width: COLS * VIGN, height: lignes * VIGN, channels: 3, background: '#111' } })
        .composite(tuiles).jpeg({ quality: 88 }).toFile(cible);
}
const retenues = paniers.retenues.slice().sort((a, b) => a.ecart - b.ecart);
await planche(retenues, path.join(racine, 'PLANCHE-retenues.jpg'));
/* Les rejets ont aussi leur planche: c'est la seule facon de voir d'un coup
 * d'oeil si le tri a jete une vraie photo — il l'a deja fait une fois. */
await planche(paniers['ecartees/hors-cadre'] || [], path.join(racine, 'CONTROLE-hors-cadre.jpg'));
await planche(paniers['ecartees/pas-une-photo'] || [], path.join(racine, 'CONTROLE-pas-une-photo.jpg'));

fs.writeFileSync(path.join(racine, 'tri.json'), JSON.stringify(
    items.map(({ chemin, p, ...reste }) => ({ ...reste, profil: p })), null, 1));

console.log(`\n${fichiers.length} images`);
for (const [panier, liste] of Object.entries(paniers)) {
    if (liste.length) console.log(`  ${String(liste.length).padStart(4)}  ${panier}`);
}
console.log(`\nles 10 plus proches du traitement dominant :`);
for (const it of retenues.slice(0, 10)) console.log(`   ${it.ecart}  ${it.fichier}`);
console.log(`\n-> ${racine}`);
