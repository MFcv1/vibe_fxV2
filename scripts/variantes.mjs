/*
 * Combien de VARIANTES utilisables peut-on tirer de chaque famille ?
 *
 *   node scripts/variantes.mjs [--racine <par-sujet>] [--min 24]
 *
 * Question posee ici, et qui n'est PAS celle de `sous-groupes.mjs`. Celui-la
 * demandait « le photographe a-t-il plusieurs reglages ? » — question de verite,
 * dont la reponse est non: ses photos forment un nuage continu. Celui-ci demande
 * « en combien de presets distincts et utilisables peut-on decouper ce nuage ? »
 * — question de fabrication, dont la reponse peut tres bien etre trois, meme sur
 * un nuage continu. Trois points echelonnes sur un degrade sont trois presets
 * differents, et ils ont l'avantage d'etre coherents entre eux par construction.
 *
 * Deux seuls criteres, parce que ce sont les deux seuls qui comptent quand on
 * fabrique:
 *
 *  1. LA DIFFERENCE SE VOIT-ELLE. Deux groupes qui donneraient deux presets
 *     indiscernables ne servent a rien. On mesure l'ecart entre groupes dans les
 *     unites du reglage — points de luminance, unites de chroma, unites de a et b —
 *     et pas en distance abstraite, pour pouvoir dire « 18 points de point blanc »
 *     plutot que « 1,2 ecart-type ».
 *
 *  2. EST-CE UN TRAITEMENT OU UN DECOR. C'est le vrai piege. Si une famille se
 *     coupe parce qu'un tas a du ciel et l'autre pas, le preset qu'on en tirerait
 *     aurait appris le SUJET: il ajouterait du bleu partout, y compris la ou il
 *     n'y a pas de ciel. On mesure donc aussi l'ecart de CONTENU entre les
 *     groupes (part de ciel, de vert, de peau, part d'ombres et de hautes
 *     lumieres). Quand le contenu explique la coupure aussi bien que le
 *     traitement, la variante est refusee.
 *
 * Les deux ecarts sont ramenes a la dispersion interne de la famille, donc
 * comparables entre eux: un rapport traitement/contenu de 2 veut dire que la
 * coupure separe deux fois mieux les developpements que les sujets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { profil } from './profil-corpus.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const racine = opt('racine', `${process.env.HOME}/Desktop/powlisher-biblio/par-sujet`);
const MIN = Number(opt('min', 24));

/* Ce que le DEVELOPPEMENT fait. Une premiere version n'en gardait que neuf, tous
 * des resumes grossiers, dont trois seulement parlaient de couleur: impossible d'y
 * lire « la lumiere rend plus chaud », qui est pourtant la premiere chose qu'on
 * voit sur ses photos. On mesure donc aussi la teinte de la lumiere, celle des
 * reflets, la forme de la courbe de saturation et la texture. */
const TRAITEMENT = {
    // ou se posent les extremes et l'exposition
    pied: (p) => p.pied,
    pointBlanc: (p) => p.pointBlanc,
    expo: (p) => p.median,
    contraste: (p) => p.p95 - p.p05,
    // la couleur de la lumiere: la teinte de ce qui devrait etre gris
    lumiereA: (p) => p.lumiereA,
    lumiereB: (p) => p.lumiereB,
    // les reflets: le 1 % le plus lumineux du cadre
    refletA: (p) => p.refletA,
    refletB: (p) => p.refletB,
    refletLuma: (p) => p.refletLuma,
    // le virage chaud/froid entre les deux bouts de la courbe
    ombresA: (p) => p.ombresA,
    ombresB: (p) => p.ombresB,
    hautesArel: (p) => p.hautesA - p.mediansA,
    hautesBrel: (p) => p.hautesB - p.mediansB,
    // la saturation: son niveau, et sa REPARTITION entre ombres et clairs
    chroma: (p) => p.chromaMoy,
    penteChroma: (p) => (p.chromaParBande[6] + p.chromaParBande[7]) / 2
        - (p.chromaParBande[0] + p.chromaParBande[1]) / 2,
    texture: (p) => p.texture,
};
/* Ce que la photo CONTIENT. Aucune de ces variables n'est un reglage: elles
 * decrivent le cadre. Si elles separent les groupes aussi bien que les
 * reglages, la coupure parle du sujet. */
const CONTENU = {
    ciel: (p) => p.cielPart,
    vert: (p) => p.vertPart,
    peau: (p) => p.peauPart,
    partOmbres: (p) => p.partOmbres,
    partHautes: (p) => p.partHautes,
};

const nomsT = Object.keys(TRAITEMENT), nomsC = Object.keys(CONTENU);
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

const ectype = (xs) => {
    const m = xs.reduce((s, v) => s + v, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length) || 1;
};

const familles = fs.readdirSync(racine)
    .filter((f) => fs.statSync(path.join(racine, f)).isDirectory()).sort();

const rapport = {};
for (const fam of familles) {
    const d = path.join(racine, fam);
    const fichiers = fs.readdirSync(d).filter((f) => /\.(jpe?g|png)$/i.test(f));
    if (fichiers.length < MIN) { rapport[fam] = { n: fichiers.length, trop_peu: true }; continue; }

    const ps = [];
    for (const f of fichiers) ps.push({ f, p: await profil(path.join(d, f)) });

    const brutT = ps.map(({ p }) => nomsT.map((n) => TRAITEMENT[n](p)));
    const brutC = ps.map(({ p }) => nomsC.map((n) => CONTENU[n](p)));
    const ectT = nomsT.map((_, j) => ectype(brutT.map((l) => l[j])));
    const ectC = nomsC.map((_, j) => ectype(brutC.map((l) => l[j])));
    const moyT = nomsT.map((_, j) => brutT.reduce((s, l) => s + l[j], 0) / brutT.length);
    const XT = brutT.map((l) => l.map((v, j) => (v - moyT[j]) / ectT[j]));

    const essais = [];
    for (const k of [2, 3, 4]) {
        if (fichiers.length < k * 8) break;
        const r = kMoyennes(XT, k);
        if (!r) continue;

        const groupes = Array.from({ length: k }, (_, g) => ps.map((_, i) => i).filter((i) => r.attrib[i] === g));
        const moyenne = (idx, brut, j) => idx.reduce((s, i) => s + brut[i][j], 0) / idx.length;

        /* Ecart maximal entre deux groupes, variable par variable. */
        let ecartT = 0, ecartC = 0, detail = [];
        for (let a = 0; a < k; a += 1) for (let b = a + 1; b < k; b += 1) {
            const dT = nomsT.map((_, j) => Math.abs(moyenne(groupes[a], brutT, j) - moyenne(groupes[b], brutT, j)) / ectT[j]);
            const dC = nomsC.map((_, j) => Math.abs(moyenne(groupes[a], brutC, j) - moyenne(groupes[b], brutC, j)) / ectC[j]);
            const nT = Math.hypot(...dT) / Math.sqrt(nomsT.length);
            const nC = Math.hypot(...dC) / Math.sqrt(nomsC.length);
            if (nT > ecartT) {
                ecartT = nT; ecartC = nC;
                detail = nomsT.map((n, j) => ({
                    n,
                    brut: +(moyenne(groupes[a], brutT, j) - moyenne(groupes[b], brutT, j)).toFixed(1),
                    z: dT[j],
                })).sort((x, y) => y.z - x.z).slice(0, 3);
            }
        }
        essais.push({
            k,
            tailles: groupes.map((g) => g.length).sort((a, b) => b - a),
            traitement: +ecartT.toFixed(2),
            contenu: +ecartC.toFixed(2),
            rapport: +(ecartT / Math.max(0.01, ecartC)).toFixed(2),
            detail,
            groupes: groupes.map((g) => g.map((i) => ps[i].f)),
        });
    }
    rapport[fam] = { n: fichiers.length, essais };
    process.stderr.write(`${fam} `);
}
process.stderr.write('\n');

console.log('famille        n   k  tailles        traitement  decor  rapport  ce qui separe le plus');
for (const [fam, r] of Object.entries(rapport)) {
    if (r.trop_peu) { console.log(`${fam.padEnd(13)}${String(r.n).padStart(3)}   — ${r.n} photos, trop peu pour decouper`); continue; }
    for (const [i, e] of r.essais.entries()) {
        const verdict = e.rapport < 1.2 ? '  ← DECOR, a refuser' : '';
        console.log(
            (i === 0 ? fam.padEnd(13) + String(r.n).padStart(3) : ' '.repeat(16))
            + String(e.k).padStart(4) + '  ' + e.tailles.join('/').padEnd(14)
            + String(e.traitement).padStart(7) + String(e.contenu).padStart(8) + String(e.rapport).padStart(8) + '   '
            + e.detail.map((d) => `${d.brut > 0 ? '+' : ''}${d.brut} ${d.n}`).join(', ') + verdict,
        );
    }
}

fs.writeFileSync(`${process.env.HOME}/Desktop/powlisher-biblio/variantes.json`, JSON.stringify(rapport, null, 1));
console.log('\ntraitement/decor : ecart entre groupes, en dispersion interne de la famille.');
console.log('rapport > 1,2 = la coupure separe les developpements mieux que les sujets.');
