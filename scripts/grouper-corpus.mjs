/*
 * Regroupe les photos d'un corpus par RENDU, pas par sujet, et sort une planche
 * par groupe.
 *
 *   node scripts/grouper-corpus.mjs [--profil <json>] [--k 4] [--sortie <dossier>]
 *
 * Le piege, et la raison d'etre du choix de variables ici: les statistiques
 * globales d'une photo sont dominees par ce qu'il y a DANS le cadre. Un coucher
 * de soleil et une facade en contre-jour se ressemblent chiffres en main sans
 * partager le moindre reglage. On ne groupe donc PAS sur la couleur moyenne,
 * mais sur ce qui decrit le developpement:
 *
 *  - le pied et le point blanc (ou le photographe pose ses extremes),
 *  - le contraste (p95 - p05),
 *  - le niveau de chroma et son etalement (un creux de saturation se voit la),
 *  - le virage des ombres (a*, b* sous L=25),
 *  - le virage des hautes lumieres RELATIF aux medians — en relatif, parce
 *    qu'en absolu c'est le sujet qui parle (un ciel tire le b* vers le bleu, du
 *    sable vers le jaune, sans qu'aucun reglage ait change).
 *
 * La distance au centre du corpus sert a repérer les intrus: une photo tres
 * loin de tout le monde n'a probablement pas le meme traitement.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (nom, defaut) => {
    const i = args.indexOf(`--${nom}`);
    return i >= 0 ? args[i + 1] : defaut;
};

const cheminProfil = opt('profil', 'docs/lightroom/profil-corpus.json');
const K = Number(opt('k', 4));
const sortie = opt('sortie', path.join(os.homedir(), 'Desktop', 'powlisher-analyse'));

const { dossier, profils } = JSON.parse(fs.readFileSync(cheminProfil, 'utf8'));

/* Les variables de LOOK. Nom lisible -> valeur tiree du profil. */
const VARIABLES = {
    pied: (p) => p.pied,
    pointBlanc: (p) => p.pointBlanc,
    contraste: (p) => p.p95 - p.p05,
    chroma: (p) => p.chromaMoy,
    etalementChroma: (p) => p.chromaEcart / Math.max(1, p.chromaMoy),
    ombresA: (p) => p.ombresA,
    ombresB: (p) => p.ombresB,
    hautesArel: (p) => p.hautesA - p.mediansA,
    hautesBrel: (p) => p.hautesB - p.mediansB,
};
const noms = Object.keys(VARIABLES);

/* Centrage-reduction: sans ca, le point blanc (echelle 0-255) ecraserait le
 * virage des ombres (echelle +/-10) et le groupement ne dirait plus que
 * « claire » ou « sombre ». */
const brut = profils.map((p) => noms.map((n) => VARIABLES[n](p)));
const moy = noms.map((_, j) => brut.reduce((s, l) => s + l[j], 0) / brut.length);
const ect = noms.map((_, j) => {
    const v = brut.reduce((s, l) => s + (l[j] - moy[j]) ** 2, 0) / brut.length;
    return Math.sqrt(v) || 1;
});
const X = brut.map((l) => l.map((v, j) => (v - moy[j]) / ect[j]));

const dist2 = (a, b) => a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0);

/* k-moyennes, depart k-means++ et plusieurs essais: sur un corpus de cette
 * taille un mauvais tirage donne un groupe vide et un resultat different a
 * chaque lancement. On garde le meilleur des 20. */
function kmeans(X, k, essais = 20) {
    let meilleur = null;
    for (let e = 0; e < essais; e += 1) {
        const centres = [X[Math.floor(Math.random() * X.length)].slice()];
        while (centres.length < k) {
            const d = X.map((x) => Math.min(...centres.map((c) => dist2(x, c))));
            const total = d.reduce((s, v) => s + v, 0) || 1;
            let r = Math.random() * total;
            let idx = 0;
            while (r > d[idx] && idx < d.length - 1) { r -= d[idx]; idx += 1; }
            centres.push(X[idx].slice());
        }
        let attrib = new Array(X.length).fill(-1);
        for (let iter = 0; iter < 100; iter += 1) {
            let bouge = false;
            X.forEach((x, i) => {
                let best = 0, bd = Infinity;
                centres.forEach((c, ci) => { const d = dist2(x, c); if (d < bd) { bd = d; best = ci; } });
                if (attrib[i] !== best) { attrib[i] = best; bouge = true; }
            });
            centres.forEach((c, ci) => {
                const membres = X.filter((_, i) => attrib[i] === ci);
                if (!membres.length) return;
                for (let j = 0; j < c.length; j += 1) c[j] = membres.reduce((s, m) => s + m[j], 0) / membres.length;
            });
            if (!bouge) break;
        }
        const inertie = X.reduce((s, x, i) => s + dist2(x, centres[attrib[i]]), 0);
        if (!meilleur || inertie < meilleur.inertie) meilleur = { centres, attrib, inertie };
    }
    return meilleur;
}

const { centres, attrib } = kmeans(X, K);

/* Intrus: distance au centre GLOBAL du corpus (l'origine, apres centrage). */
const distGlobale = X.map((x) => Math.sqrt(dist2(x, new Array(x.length).fill(0))));
const seuil = [...distGlobale].sort((a, b) => a - b)[Math.floor(distGlobale.length * 0.9)];

fs.mkdirSync(sortie, { recursive: true });

const groupes = [];
for (let g = 0; g < K; g += 1) {
    const membres = profils.map((p, i) => ({ p, i })).filter(({ i }) => attrib[i] === g);
    if (!membres.length) continue;
    const moyenne = (f) => membres.reduce((s, { p }) => s + f(p), 0) / membres.length;
    groupes.push({
        id: g,
        n: membres.length,
        fichiers: membres.map(({ p }) => p.fichier),
        pied: +moyenne((p) => p.pied).toFixed(1),
        pointBlanc: +moyenne((p) => p.pointBlanc).toFixed(1),
        contraste: +moyenne((p) => p.p95 - p.p05).toFixed(1),
        chroma: +moyenne((p) => p.chromaMoy).toFixed(1),
        ombresA: +moyenne((p) => p.ombresA).toFixed(2),
        ombresB: +moyenne((p) => p.ombresB).toFixed(2),
        hautesArel: +moyenne((p) => p.hautesA - p.mediansA).toFixed(2),
        hautesBrel: +moyenne((p) => p.hautesB - p.mediansB).toFixed(2),
        cielTeinte: +moyenne((p) => (p.cielPart > 5 ? p.cielTeinte : 0)).toFixed(1),
        intrus: membres.filter(({ i }) => distGlobale[i] > seuil).map(({ p }) => p.fichier),
    });
}

console.log(`\n${profils.length} photos, ${groupes.length} groupes\n`);
for (const g of groupes) {
    console.log(`--- groupe ${g.id} (${g.n} photos)`);
    console.log(`    pied ${g.pied}  blanc ${g.pointBlanc}  contraste ${g.contraste}  chroma ${g.chroma}`);
    console.log(`    ombres a ${g.ombresA} b ${g.ombresB}   hautes/medians a ${g.hautesArel} b ${g.hautesBrel}`);
    console.log(`    ${g.fichiers.map((f) => f.replace(/-reference\.jpg|\.jpg/g, '')).join(' ')}`);
    if (g.intrus.length) console.log(`    intrus possibles: ${g.intrus.map((f) => f.replace(/-reference\.jpg|\.jpg/g, '')).join(' ')}`);
}

/* Une planche par groupe: le chiffre propose un groupe, l'oeil le valide. */
const VIGN = 320, COLS = 5;
for (const g of groupes) {
    const lignes = Math.ceil(g.fichiers.length / COLS);
    const tuiles = await Promise.all(g.fichiers.map(async (f, i) => ({
        input: await sharp(path.join(dossier, f)).rotate()
            .resize(VIGN, VIGN, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer(),
        left: (i % COLS) * VIGN,
        top: Math.floor(i / COLS) * VIGN,
    })));
    const cible = path.join(sortie, `groupe-${g.id}-${g.n}photos.jpg`);
    await sharp({ create: { width: COLS * VIGN, height: lignes * VIGN, channels: 3, background: '#111' } })
        .composite(tuiles).jpeg({ quality: 90 }).toFile(cible);
}

fs.writeFileSync(path.join(sortie, 'groupes.json'), JSON.stringify(groupes, null, 1));
console.log(`\nPlanches et groupes.json -> ${sortie}`);
