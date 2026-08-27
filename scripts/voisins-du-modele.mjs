/*
 * « Trouve-moi, dans tout son corpus, les photos qui ressemblent a CELLES-LA. »
 *
 *   node scripts/voisins-du-modele.mjs --modele ~/Desktop/lumierejaune --n 60
 *
 * POURQUOI CE SCRIPT. Le porteur du projet designe un rendu en montrant une
 * poignee d'images. Dix photos ne suffisent pas a mesurer quoi que ce soit — un
 * etalonnage tire de dix images est du bruit. Mais elles suffisent a definir une
 * DIRECTION, et son corpus de 324 photos contient forcement d'autres photos qui
 * vont dans la meme direction. On s'en sert donc comme d'une requete: le modele
 * dit ou regarder, le corpus fournit la matiere.
 *
 * LE CENTRAGE PAR FAMILLE, ENCORE. Chaque photo est decrite par son ecart a la
 * mediane de sa famille de sujet. Sans ca, « ressembler au modele » voudrait
 * dire « etre une photo de voiture », puisque la moitie du modele en est. Avec,
 * ca veut dire « etre developpee comme lui », ce qui est la question posee.
 *
 * LA VERIFICATION: on regarde de quelles familles est fait le resultat. Si les
 * voisins viennent de trois familles ou plus, la ressemblance porte sur le
 * traitement. S'ils viennent tous de la meme, elle portait sur le sujet, et le
 * groupe ne vaut rien.
 *
 * Sortie: `voisins-<nom>.json`, a donner a `mesurer-variante.mjs`, et une
 * planche pour verifier a l'oeil que les voisins ressemblent vraiment au modele.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { profil } from './profil-corpus.mjs';

const BIBLIO = path.join(os.homedir(), 'Desktop', 'powlisher-biblio');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const MODELE = opt('modele', path.join(os.homedir(), 'Desktop', 'lumierejaune'));
const N = Number(opt('n', 60));
const NOM = opt('nom', path.basename(MODELE));

/* Le vecteur de LOOK. Tonalite et couleur ensemble, cette fois — et c'est
 * legitime ici: on ne cherche pas un axe (ou melanger les deux fabrique une
 * question illisible), on cherche une ressemblance, et une ressemblance porte
 * sur tout ce qui se voit. */
const V = {
    pied: (p) => p.pied,
    pointBlanc: (p) => p.pointBlanc,
    contraste: (p) => p.p95 - p.p05,
    partOmbres: (p) => p.partOmbres,
    refletLuma: (p) => p.refletLuma,
    chroma: (p) => p.chromaMoy,
    lumiereA: (p) => p.lumiereA,
    lumiereB: (p) => p.lumiereB,
    refletA: (p) => p.refletA,
    refletB: (p) => p.refletB,
    ombresA: (p) => p.ombresA,
    ombresB: (p) => p.ombresB,
    hautesA: (p) => p.hautesA,
    hautesB: (p) => p.hautesB,
};
const noms = Object.keys(V);
const med = (xs) => { const t = xs.filter(Number.isFinite).sort((a, b) => a - b); return t.length ? (t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2) : NaN; };

const lui = JSON.parse(fs.readFileSync(path.join(BIBLIO, 'profils-lui.json'), 'utf8'));
const medianeFamille = {};
for (const [fam, ps] of Object.entries(lui)) medianeFamille[fam] = Object.fromEntries(noms.map((n) => [n, med(ps.map(V[n]))]));

/* Le modele: ses photos sont deja dans le corpus (il les a designees dedans),
 * on retrouve donc leur famille pour pouvoir les centrer comme les autres. */
const fichiersModele = fs.readdirSync(MODELE).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const dansCorpus = {};
for (const [fam, ps] of Object.entries(lui)) for (const p of ps) dansCorpus[p.fichier] = { fam, p };

const modele = [];
for (const f of fichiersModele) {
    if (dansCorpus[f]) { modele.push(dansCorpus[f]); continue; }
    /* Photo venue d'ailleurs: on la profile, et on la centre sur la famille
     * mediane faute de mieux — en le disant. */
    const p = await profil(path.join(MODELE, f));
    modele.push({ fam: null, p });
    process.stderr.write(`hors corpus, centre sur la mediane globale: ${f}\n`);
}

const medianeGlobale = Object.fromEntries(noms.map((n) => [n, med(Object.values(lui).flat().map(V[n]))]));
const centre = (fam, p) => Object.fromEntries(noms.map((n) => [n, V[n](p) - (fam ? medianeFamille[fam][n] : medianeGlobale[n])]));

/* L'echelle: l'ecart-type de chaque variable sur tout le corpus centre. Sans
 * elle, `pointBlanc` (des dizaines de niveaux) ecraserait `ombresA` (quelques
 * unites) et la ressemblance ne porterait que sur la tonalite. */
const tous = [];
for (const [fam, ps] of Object.entries(lui)) for (const p of ps) tous.push({ fam, f: p.fichier, c: centre(fam, p) });
const sd = Object.fromEntries(noms.map((n) => {
    const xs = tous.map((r) => r.c[n]).filter(Number.isFinite);
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return [n, Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1];
}));

const cible = Object.fromEntries(noms.map((n) => [n, med(modele.map(({ fam, p }) => centre(fam, p)[n]))]));
const distance = (c) => Math.hypot(...noms.map((n) => ((Number.isFinite(c[n]) ? c[n] : 0) - cible[n]) / sd[n]));

const classe = tous.map((r) => ({ ...r, d: distance(r.c) })).sort((a, b) => a.d - b.d);
const voisins = classe.slice(0, N);

const compo = {};
voisins.forEach((r) => { compo[r.fam] = (compo[r.fam] || 0) + 1; });

fs.writeFileSync(path.join(BIBLIO, `voisins-${NOM}.json`), JSON.stringify(voisins.map((r) => ({ fam: r.fam, f: r.f }))));

console.log(`modele: ${modele.length} photos — cible (ecart a la famille):`);
console.log('  ' + noms.map((n) => `${n} ${cible[n].toFixed(1)}`).join('  '));
console.log(`\n${N} voisins, distance ${voisins[0].d.toFixed(2)} a ${voisins[N - 1].d.toFixed(2)} (mediane du corpus ${med(classe.map((r) => r.d)).toFixed(2)})`);
console.log('familles:', JSON.stringify(compo), Object.keys(compo).length >= 3 ? '-> la ressemblance porte sur le traitement' : '-> ATTENTION: un seul sujet, la ressemblance est du decor');

/* La planche: on verifie a l'oeil que les voisins ressemblent au modele. */
const H = 190, W = 190, cols = 10;
const cellules = [];
for (const { fam, p } of modele.slice(0, cols)) {
    const src = fam ? path.join(BIBLIO, 'par-sujet', fam, p.fichier) : path.join(MODELE, p.fichier);
    cellules.push(await sharp(src).rotate().resize(W, H, { fit: 'cover' }).jpeg().toBuffer());
}
while (cellules.length < cols) cellules.push(await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).jpeg().toBuffer());
for (const r of voisins.slice(0, cols * 4)) {
    cellules.push(await sharp(path.join(BIBLIO, 'par-sujet', r.fam, r.f)).rotate().resize(W, H, { fit: 'cover' }).jpeg().toBuffer());
}
const lignes = Math.ceil(cellules.length / cols);
await sharp({ create: { width: W * cols, height: H * lignes, channels: 3, background: '#111' } })
    .composite(cellules.map((b, i) => ({ input: b, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
    .jpeg({ quality: 90 }).toFile(path.join(BIBLIO, `VOISINS-${NOM}.jpg`));
console.log(`\n-> ${path.join(BIBLIO, `voisins-${NOM}.json`)}`);
console.log(`-> planche: premiere ligne = le modele, les suivantes = les voisins`);
