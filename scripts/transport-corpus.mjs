/*
 * La DIRECTION du traitement: ce qu'il faut faire a un tas neutre pour qu'il
 * ressemble au sien.
 *
 *   node scripts/transport-corpus.mjs [--lui <json>] [--neutre <json>]
 *
 * `densite-corpus.mjs` dit ou chaque tas POSE ses couleurs. Ce script apparie
 * les deux, sujet par sujet, et en tire le deplacement. Le principe est celui
 * de l'appariement de quantiles: si 30 % des pixels clairs du tas neutre sont
 * en dessous de 70 degres et que 30 % des siens sont en dessous de 85, alors
 * son traitement emmene 70 vers 85. On refait ca pour chaque niveau, et la
 * suite des reponses EST la recette.
 *
 * Trois precautions, chacune pour une erreur qu'on peut faire ici:
 *
 *  - APPARIER LES SUJETS. On compare ses bords de mer a des bords de mer. Sans
 *    ca on mesure la difference de decor, qui est enorme, et le traitement, qui
 *    est petit, disparait dedans.
 *
 *  - DEROULER LE CERCLE AU BON ENDROIT. Les teintes sont un cercle: pour les
 *    apparier il faut le couper quelque part, et le point de coupe change le
 *    resultat. On coupe la ou les DEUX tas sont le plus vides — un desert
 *    partage ne contient presque aucun pixel, donc l'erreur qu'on y commet ne
 *    coute presque rien.
 *
 *  - AMORTIR. Le deplacement brut amene chaque photo exactement sur SA moyenne
 *    a lui, ce qui reviendrait a effacer la photo de depart: tous les ciels
 *    deviendraient le meme bleu. C'est l'erreur qui a tue `powlisher-v2`. Le
 *    preset n'applique donc qu'une fraction du chemin — il TIRE VERS au lieu de
 *    POSER SUR, ce qui est exactement le mecanisme de `powlisher-ciel`, le seul
 *    variant que le porteur du projet ait valide sur ce point.
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const base = `${process.env.HOME}/Desktop/powlisher-biblio`;
const lui = JSON.parse(fs.readFileSync(opt('lui', `${base}/densites-lui.json`), 'utf8'));
const neutre = JSON.parse(fs.readFileSync(opt('neutre', `${base}/densites-neutre.json`), 'utf8'));
const MIN_PHOTOS = 15;   // en dessous, la densite du tas neutre est du bruit

const BINS = 72, PAS = 360 / BINS;

const cdf = (d) => {
    const total = d.reduce((s, v) => s + v, 0) || 1;
    let acc = 0;
    return d.map((v) => (acc += v) / total);
};

/* Le point de coupe: la case ou la somme des deux densites est minimale. */
function coupe(a, b) {
    let best = 0, min = Infinity;
    for (let i = 0; i < BINS; i += 1) {
        const v = a[(i - 1 + BINS) % BINS] + a[i] + a[(i + 1) % BINS]
            + b[(i - 1 + BINS) % BINS] + b[i] + b[(i + 1) % BINS];
        if (v < min) { min = v; best = i; }
    }
    return best;
}

/* Appariement de quantiles: pour chaque case du tas neutre, la case du sien qui
 * porte la meme fraction cumulee. Rendu en DEPLACEMENT (degres signes), parce
 * qu'un deplacement se lit et s'amortit, la ou une destination absolue ne dit
 * pas d'ou elle vient. */
function transportTeinte(dNeutre, dLui) {
    const c = coupe(dNeutre, dLui);
    const roule = (d) => Array.from({ length: BINS }, (_, i) => d[(c + i) % BINS]);
    const cn = cdf(roule(dNeutre)), cl = cdf(roule(dLui));
    const out = new Array(BINS).fill(0);
    for (let i = 0; i < BINS; i += 1) {
        let j = 0;
        while (j < BINS - 1 && cl[j] < cn[i]) j += 1;
        let delta = (j - i) * PAS;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        out[(c + i) % BINS] = +delta.toFixed(1);
    }
    return out;
}

/* Meme appariement sur la luminosite: c'est la courbe de tonalite. Elle n'est
 * PAS dans la table de couleur — une table 3D peut la porter, mais la lire a
 * part permet de voir ou il pose ses noirs et son point blanc. */
function transportTon(hNeutre, hLui) {
    const cn = cdf(hNeutre), cl = cdf(hLui);
    const out = new Array(256);
    for (let v = 0; v < 256; v += 1) {
        let u = 0;
        while (u < 255 && cl[u] < cn[v]) u += 1;
        out[v] = u;
    }
    return out;
}

const familles = Object.keys(lui).filter((f) => neutre[f] && neutre[f].photos >= MIN_PHOTOS);
const ignorees = Object.keys(lui).filter((f) => !familles.includes(f));

const transports = {};
for (const fam of familles) {
    const L = lui[fam], N = neutre[fam];
    transports[fam] = {
        photos: { lui: L.photos, neutre: N.photos },
        ton: transportTon(N.luma.hist, L.luma.hist),
        bandes: L.bandes.map((b, i) => ({
            nom: b.nom,
            teinte: transportTeinte(N.bandes[i].densite, b.densite),
            gainChroma: +(b.chromaMoy / Math.max(1, N.bandes[i].chromaMoy)).toFixed(2),
        })),
    };
}

/* Le TRONC: la mediane des deplacements, famille par famille. Ce qui survit a
 * douze sujets differents ne peut pas etre du decor — un decor ne se repete pas
 * d'une cabine d'avion a un bord de mer, un traitement si. Ce qui ne survit pas
 * est laisse a la famille. */
const med = (xs) => { const t = [...xs].sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };
const tronc = {
    ton: Array.from({ length: 256 }, (_, v) => Math.round(med(familles.map((f) => transports[f].ton[v])))),
    bandes: lui[familles[0]].bandes.map((b, i) => ({
        nom: b.nom,
        teinte: Array.from({ length: BINS }, (_, k) => +med(familles.map((f) => transports[f].bandes[i].teinte[k])).toFixed(1)),
        /* L'ecart entre familles: la ou il est grand, le deplacement median ne
         * represente personne et le tronc ne doit pas s'en servir. */
        dispersion: Array.from({ length: BINS }, (_, k) => {
            const xs = familles.map((f) => transports[f].bandes[i].teinte[k]);
            return +Math.sqrt(xs.reduce((s, v) => s + (v - med(xs)) ** 2, 0) / xs.length).toFixed(1);
        }),
        gainChroma: +med(familles.map((f) => transports[f].bandes[i].gainChroma)).toFixed(2),
    })),
};

fs.writeFileSync(`${base}/transport.json`, JSON.stringify({ tronc, transports, ignorees }, null, 1));

console.log(`familles retenues : ${familles.join(', ')}`);
if (ignorees.length) console.log(`ignorees (tas neutre trop maigre) : ${ignorees.join(', ')}`);

console.log('\n--- LE TRONC : deplacement de teinte, en degres (- = vers le rouge/jaune, + = vers le bleu)');
console.log('bande          ' + [0, 45, 90, 135, 180, 225, 270, 315].map((d) => `${d}°`.padStart(8)).join(''));
for (const b of tronc.bandes) {
    const k = (d) => Math.round(d / PAS);
    console.log(b.nom.padEnd(15)
        + [0, 45, 90, 135, 180, 225, 270, 315].map((d) => {
            const v = b.teinte[k(d)], s = b.dispersion[k(d)];
            return (Math.abs(v) > s ? `${v > 0 ? '+' : ''}${v}` : '·').padStart(8);
        }).join(''));
}
console.log('(un point = les familles ne sont pas d\'accord, le tronc ne bouge pas cette teinte)');

console.log('\n--- LE TRONC : chroma');
for (const b of tronc.bandes) console.log(`${b.nom.padEnd(15)}x${b.gainChroma}`);

console.log('\n--- LE TRONC : tonalite (entree -> sortie)');
console.log('  ' + [0, 16, 32, 64, 96, 128, 160, 192, 224, 255].map((v) => String(v).padStart(5)).join(''));
console.log('  ' + [0, 16, 32, 64, 96, 128, 160, 192, 224, 255].map((v) => String(tronc.ton[v]).padStart(5)).join(''));

console.log('\n--- PAR FAMILLE : ou chacune pose ses extremes');
console.log('famille        photos   noir  blanc');
for (const fam of familles) {
    const t = transports[fam].ton;
    console.log(fam.padEnd(15) + `${transports[fam].photos.lui}/${transports[fam].photos.neutre}`.padStart(6)
        + String(t[8]).padStart(7) + String(t[247]).padStart(7));
}
console.log(`\n-> ${base}/transport.json`);
