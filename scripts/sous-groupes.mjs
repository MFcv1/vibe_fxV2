/*
 * Cherche des sous-traitements A L'INTERIEUR de chaque famille de sujet.
 *
 *   node scripts/sous-groupes.mjs [--racine <par-sujet>]
 *
 * L'idee: si le photographe a plusieurs reglages pour un meme type de sujet,
 * ses photos d'architecture doivent se couper en tas NETS plutot que former un
 * nuage continu.
 *
 * On essaie 2, 3 et 4 tas — pas seulement 2. Une premiere version ne testait que
 * la coupure en deux, ce qui revenait a supposer la reponse: un reglage « fort /
 * leger » aurait ete vu, mais un jeu de trois ou quatre reglages serait passe
 * pour un nuage sans structure. Le nombre de tas est justement ce qu'on cherche,
 * il ne peut pas etre pose d'avance.
 *
 * Pour departager les k, on mesure la SILHOUETTE de chaque photo: sa distance
 * moyenne aux photos de son propre tas, comparee a sa distance moyenne au tas
 * voisin le plus proche. Proche de 1, la photo est bien chez elle; proche de 0,
 * elle est a la frontiere; negative, elle est du mauvais cote. La silhouette
 * moyenne dit donc si les tas EXISTENT, ce qu'aucune mesure interne au
 * decoupage ne sait faire — l'inertie, elle, s'ameliore toujours quand k monte,
 * meme sur du bruit pur.
 *
 * Les seuils d'usage: au-dessus de 0,50 la structure est franche, entre 0,25 et
 * 0,50 elle est faible, en dessous de 0,25 il n'y a rien a voir et le nuage est
 * continu.
 *
 * LE PIEGE, ET LE GARDE-FOU. Une famille se coupe TOUJOURS en deux si on le lui
 * demande — l'algorithme rend une reponse meme quand il n'y a rien a trouver.
 * Et une coupure dans `architecture` s'explique aussi bien par deux reglages
 * que par deux meteos: plein soleil contre ciel couvert. Rien, dans une seule
 * famille, ne permet de trancher.
 *
 * Le depart entre les deux se fait en regardant les AUTRES familles. Une
 * meteo ne coupe pas les cabines d'avion, et un reglage, si. Donc:
 *
 *   - on note, pour chaque famille, la DIRECTION qui separe ses deux moities
 *     (quelles variables, dans quel sens, de combien d'ecarts internes);
 *   - on compare ces directions entre familles. Deux familles qui se coupent
 *     selon la meme direction designent un vrai second traitement. Une
 *     direction isolee est du decor ou de la lumiere, et on la laisse tomber.
 *
 * On centre-reduit A L'INTERIEUR de chaque famille: ce qui est commun au sujet
 * disparait, et il ne reste que ce qui varie d'une photo a l'autre du meme
 * sujet — c'est-a-dire, precisement, ce qu'on cherche.
 */

import fs from 'node:fs';
import path from 'node:path';
import { profil } from './profil-corpus.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const racine = opt('racine', `${process.env.HOME}/Desktop/powlisher-biblio/par-sujet`);
const MIN_PHOTOS = 14;   // en dessous, une coupure en deux ne veut rien dire

const VARIABLES = {
    pied: (p) => p.pied,
    pointBlanc: (p) => p.pointBlanc,
    contraste: (p) => p.p95 - p.p05,
    expo: (p) => p.median,
    chroma: (p) => p.chromaMoy,
    ombresA: (p) => p.ombresA,
    ombresB: (p) => p.ombresB,
    hautesArel: (p) => p.hautesA - p.mediansA,
    hautesBrel: (p) => p.hautesB - p.mediansB,
};
const noms = Object.keys(VARIABLES);

const dist2 = (a, b) => a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0);

function kMoyennes(X, k, essais = 40) {
    let best = null;
    for (let e = 0; e < essais; e += 1) {
        const centres = [X[Math.floor(Math.random() * X.length)].slice()];
        while (centres.length < k) {
            const d = X.map((x) => Math.min(...centres.map((c) => dist2(x, c))));
            const total = d.reduce((s, v) => s + v, 0) || 1;
            let r = Math.random() * total, idx = 0;
            while (r > d[idx] && idx < d.length - 1) { r -= d[idx]; idx += 1; }
            centres.push(X[idx].slice());
        }
        const attrib = new Array(X.length).fill(-1);
        for (let it = 0; it < 80; it += 1) {
            let bouge = false;
            X.forEach((x, i) => {
                let b = 0, bd = Infinity;
                centres.forEach((c, ci) => { const d = dist2(x, c); if (d < bd) { bd = d; b = ci; } });
                if (attrib[i] !== b) { attrib[i] = b; bouge = true; }
            });
            centres.forEach((c, ci) => {
                const m = X.filter((_, i) => attrib[i] === ci);
                if (!m.length) return;
                for (let j = 0; j < c.length; j += 1) c[j] = m.reduce((s, v) => s + v[j], 0) / m.length;
            });
            if (!bouge) break;
        }
        if (new Set(attrib).size < k) continue;
        const inertie = X.reduce((s, x, i) => s + dist2(x, centres[attrib[i]]), 0);
        if (!best || inertie < best.inertie) best = { centres, attrib, inertie };
    }
    return best;
}

/* Silhouette moyenne. Le seul chiffre ici qui puisse repondre « il n'y a pas de
 * tas »: l'inertie, elle, baisse mecaniquement a chaque tas ajoute. */
function silhouette(X, attrib, k) {
    const groupes = Array.from({ length: k }, (_, g) => X.map((_, i) => i).filter((i) => attrib[i] === g));
    let somme = 0;
    for (let i = 0; i < X.length; i += 1) {
        const mien = groupes[attrib[i]];
        if (mien.length < 2) continue;
        const a = mien.filter((j) => j !== i)
            .reduce((s, j) => s + Math.sqrt(dist2(X[i], X[j])), 0) / (mien.length - 1);
        let b = Infinity;
        for (let g = 0; g < k; g += 1) {
            if (g === attrib[i] || !groupes[g].length) continue;
            const d = groupes[g].reduce((s, j) => s + Math.sqrt(dist2(X[i], X[j])), 0) / groupes[g].length;
            if (d < b) b = d;
        }
        somme += (b - a) / Math.max(a, b);
    }
    return somme / X.length;
}

const familles = fs.readdirSync(racine)
    .filter((f) => fs.statSync(path.join(racine, f)).isDirectory()).sort();

const resultats = [];
for (const fam of familles) {
    const d = path.join(racine, fam);
    const fichiers = fs.readdirSync(d).filter((f) => /\.(jpe?g|png)$/i.test(f));
    if (fichiers.length < MIN_PHOTOS) { resultats.push({ fam, n: fichiers.length, trop_peu: true }); continue; }

    const ps = [];
    for (const f of fichiers) ps.push({ f, p: await profil(path.join(d, f)) });

    const brut = ps.map(({ p }) => noms.map((n) => VARIABLES[n](p)));
    const moy = noms.map((_, j) => brut.reduce((s, l) => s + l[j], 0) / brut.length);
    const ect = noms.map((_, j) => Math.sqrt(brut.reduce((s, l) => s + (l[j] - moy[j]) ** 2, 0) / brut.length) || 1);
    const X = brut.map((l) => l.map((v, j) => (v - moy[j]) / ect[j]));

    /* On essaie 2, 3 et 4 tas et on garde celui dont la silhouette est la
     * meilleure — c'est le nombre de tas que les photos portent vraiment, pas
     * celui qu'on avait envie de trouver. */
    const essais = [];
    for (const kk of [2, 3, 4]) {
        if (X.length < kk * 4) break;
        const r = kMoyennes(X, kk);
        if (!r) continue;
        essais.push({ k: kk, ...r, sil: silhouette(X, r.attrib, kk) });
    }
    if (!essais.length) { resultats.push({ fam, n: fichiers.length, trop_peu: true }); continue; }
    const meilleur = essais.reduce((a, b) => (b.sil > a.sil ? b : a));

    /* La direction ne se lit proprement qu'entre DEUX tas: on la calcule donc
     * toujours sur la coupure en deux, quel que soit le k retenu, pour que la
     * comparaison d'une famille a l'autre reste possible. */
    const k = essais.find((e) => e.k === 2) || meilleur;
    const c0 = k.centres[0], c1 = k.centres[1];
    const n0 = k.attrib.filter((a) => a === 0).length;
    /* La direction de coupure, en ecarts internes. Orientee pour que le plus
     * petit tas soit toujours le « +1 »: sans ca, deux familles coupees a
     * l'identique pourraient rendre des directions opposees selon le tirage. */
    const signe = n0 <= X.length - n0 ? -1 : 1;
    const direction = noms.map((_, j) => signe * (c0[j] - c1[j]));
    const norme = Math.hypot(...direction) || 1;

    /* Separation: distance entre les deux centres rapportee a la dispersion
     * interne. En dessous de ~1,5 les deux tas se touchent — la coupure existe
     * sur le papier mais pas dans les photos. */
    const separation = norme / Math.sqrt(noms.length);

    resultats.push({
        fam,
        n: fichiers.length,
        silhouettes: essais.map((e) => ({ k: e.k, sil: +e.sil.toFixed(3) })),
        meilleurK: meilleur.k,
        meilleureSil: +meilleur.sil.toFixed(3),
        taillesMeilleur: Array.from({ length: meilleur.k },
            (_, g) => meilleur.attrib.filter((a) => a === g).length).sort((a, b) => b - a),
        tailles: [Math.min(n0, X.length - n0), Math.max(n0, X.length - n0)],
        separation: +separation.toFixed(2),
        direction: direction.map((v) => v / norme),
        principales: noms
            .map((n, j) => ({ n, v: direction[j] }))
            .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 3),
        petit: ps.filter((_, i) => k.attrib[i] === (n0 <= X.length - n0 ? 0 : 1)).map((x) => x.f),
    });
    process.stderr.write(`${fam} `);
}
process.stderr.write('\n');

console.log('famille        n | silhouette a 2 / 3 / 4 tas | meilleur    tailles      verdict');
for (const r of resultats) {
    if (r.trop_peu) { console.log(`${r.fam.padEnd(13)}${String(r.n).padStart(3)} | trop peu de photos`); continue; }
    const sils = [2, 3, 4].map((k) => {
        const e = r.silhouettes.find((x) => x.k === k);
        return (e ? e.sil.toFixed(2) : '—').padStart(7);
    }).join('');
    const verdict = r.meilleureSil >= 0.5 ? 'STRUCTURE FRANCHE'
        : r.meilleureSil >= 0.25 ? 'structure faible'
            : 'nuage continu, aucun sous-groupe';
    console.log(`${r.fam.padEnd(13)}${String(r.n).padStart(3)} |${sils}    |  k=${r.meilleurK}  ${r.taillesMeilleur.join('/').padEnd(12)} ${verdict}`);
}

/* La comparaison entre familles: deux directions qui pointent du meme cote
 * (cosinus proche de 1) decrivent la meme coupure. */
const vrais = resultats.filter((r) => !r.trop_peu);
console.log('\nles memes coupures reviennent-elles d\'une famille a l\'autre ? (1,00 = coupure identique)');
console.log('              ' + vrais.map((r) => r.fam.slice(0, 6).padStart(7)).join(''));
for (const a of vrais) {
    console.log(a.fam.padEnd(14) + vrais.map((b) => {
        const cos = a.direction.reduce((s, v, j) => s + v * b.direction[j], 0);
        return (a === b ? '   .' : cos.toFixed(2)).padStart(7);
    }).join(''));
}

fs.writeFileSync(`${process.env.HOME}/Desktop/powlisher-biblio/sous-groupes.json`, JSON.stringify(resultats, null, 1));
