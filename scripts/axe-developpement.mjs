/*
 * L'AXE. Ses 324 photos ne forment pas des groupes, elles forment un nuage —
 * `variantes.mjs` l'avait etabli. Mais un nuage a une direction principale, et
 * c'est elle qui permet d'en tirer des presets echelonnes au lieu de presets
 * arbitraires.
 *
 *   node scripts/axe-developpement.mjs [--part 0.2]
 *
 * LA PRECAUTION QUI FAIT TOUT: chaque photo est d'abord CENTREE SUR SA FAMILLE.
 * On retranche la mediane de sa famille de sujet a chacune de ses variables.
 * Sans ca, la premiere direction du nuage serait « jour contre nuit », c'est-a-
 * dire le sujet, et le preset qu'on en tirerait aurait appris le decor. Apres
 * centrage il ne reste que ce qui varie D'UNE PHOTO A L'AUTRE DANS UNE MEME
 * FAMILLE, et ca, aucun sujet ne peut l'expliquer.
 *
 * LA VERIFICATION: on regarde ensuite de quelles familles sont faits les deux
 * poles. Si un pole etait un sujet deguise, il serait peuple par une ou deux
 * familles. S'il est peuple par les DIX, c'est un choix de developpement.
 *
 * Sortie: `axe.json` et deux listes de photos, `pole-doux.json` et
 * `pole-net.json`, a donner a `mesurer-variante.mjs`.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BIBLIO = path.join(os.homedir(), 'Desktop', 'powlisher-biblio');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? Number(args[i + 1]) : d; };
const PART = opt('part', 0.2);      // taille de chaque pole
/* `--sur couleur` cherche l'axe des TEINTES au lieu de l'axe des NIVEAUX. Les
 * deux existent et ils sont independants: on peut poser ses noirs haut ou bas
 * sans rien changer a la temperature, et inversement. Chercher les deux dans le
 * meme calcul revient a demander a une seule direction de porter deux
 * questions, et c'est ce qui produit un axe illisible. */
const SUR = (process.argv.includes('--sur') ? process.argv[process.argv.indexOf('--sur') + 1] : 'ton');
const MIN_FAM = opt('min', 12);     // en dessous, la mediane de famille est du bruit

const lui = JSON.parse(fs.readFileSync(path.join(BIBLIO, 'profils-lui.json'), 'utf8'));

/* UNIQUEMENT DES VARIABLES DE TONALITE. Aucune couleur.
 *
 * C'est la correction du 2026-08-27, et elle vient d'un preset rate. La premiere
 * version de cet axe melait la tonalite et la couleur — reflets a\*, reflets b\*,
 * hautes a\*, chroma. Le pole `doux` etait donc DEFINI, en partie, par « ses
 * reflets sont chauds et colores ». Mesurer ensuite la couleur de ce pole ne
 * pouvait rendre qu'une chose: que ses reflets etaient chauds et colores. Le
 * raisonnement tournait en rond, et le preset qui en est sorti saturait les murs
 * ocres d'une cour marocaine jusqu'au rouge.
 *
 * L'axe se definit donc sur la seule question tonale — jusqu'ou il retient ses
 * hautes lumieres — et la couleur devient une DECOUVERTE faite sur les poles,
 * pas une hypothese qui a servi a les former. Si les deux bouts se revelent
 * quand meme de couleurs differentes, alors c'est vrai.
 */
const V = {
    pied: (p) => p.pied,
    median: (p) => p.median,
    pointBlanc: (p) => p.pointBlanc,
    contraste: (p) => p.p95 - p.p05,
    refletLuma: (p) => p.refletLuma,
    partOmbres: (p) => p.partOmbres,
    partHautes: (p) => p.partHautes,
    texture: (p) => p.texture,
};

/* Mesurees APRES coup sur les poles, jamais utilisees pour les former. */
const COULEUR = {
    chroma: (p) => p.chromaMoy,
    lumiereA: (p) => p.lumiereA,
    lumiereB: (p) => p.lumiereB,
    refletA: (p) => p.refletA,
    refletB: (p) => p.refletB,
    ombresA: (p) => p.ombresA,
    ombresB: (p) => p.ombresB,
    mediansA: (p) => p.mediansA,
    mediansB: (p) => p.mediansB,
    hautesA: (p) => p.hautesA,
    hautesB: (p) => p.hautesB,
};

/* Selon la question posee, l'un des deux jeux forme l'axe et l'autre est mesure
 * apres coup. Jamais les deux ensemble. */
const AXE = SUR === 'couleur' ? COULEUR : V;
const APRES = SUR === 'couleur' ? V : COULEUR;
const noms = Object.keys(AXE);
const nomsCouleur = Object.keys(APRES);
const med = (xs) => { const t = xs.filter(Number.isFinite).sort((a, b) => a - b); return t.length ? (t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2) : NaN; };

const rows = [];
for (const [fam, ps] of Object.entries(lui)) {
    if (ps.length < MIN_FAM) continue;
    const m = Object.fromEntries(noms.map((n) => [n, med(ps.map(AXE[n]))]));
    for (const p of ps) {
        rows.push({
            fam,
            f: p.fichier,
            brut: Object.fromEntries([...noms.map((n) => [n, AXE[n](p)]), ...nomsCouleur.map((n) => [n, APRES[n](p)])]),
            c: Object.fromEntries(noms.map((n) => [n, AXE[n](p) - m[n]])),
        });
    }
}

const sd = Object.fromEntries(noms.map((n) => {
    const xs = rows.map((r) => r.c[n]).filter(Number.isFinite);
    const mo = xs.reduce((a, b) => a + b, 0) / xs.length;
    return [n, Math.sqrt(xs.reduce((a, b) => a + (b - mo) ** 2, 0) / xs.length) || 1];
}));
const X = rows.map((r) => noms.map((n) => (Number.isFinite(r.c[n]) ? r.c[n] : 0) / sd[n]));

/* Puissance iteree: la matrice fait 18x18, il n'y a aucune raison de sortir une
 * bibliotheque pour ca. */
function direction(M) {
    const d = M[0].length;
    let v = Array.from({ length: d }, (_, i) => Math.sin(i + 1));
    for (let it = 0; it < 400; it += 1) {
        const w = new Array(d).fill(0);
        for (const x of M) { let s = 0; for (let i = 0; i < d; i += 1) s += x[i] * v[i]; for (let i = 0; i < d; i += 1) w[i] += s * x[i]; }
        const nn = Math.hypot(...w); v = w.map((x) => x / nn);
    }
    return v;
}
const v1 = direction(X);
/* Le signe d'un vecteur propre est arbitraire: on le fixe pour que le cote
 * POSITIF soit celui ou les reflets sont RETENUS (luminance des reflets basse),
 * c'est-a-dire `-doux`. */
const reference = SUR === 'couleur' ? 'refletB' : 'refletLuma';
const s = (SUR === 'couleur' ? v1[noms.indexOf(reference)] > 0 : v1[noms.indexOf(reference)] < 0) ? 1 : -1;
rows.forEach((r, i) => { r.t = s * X[i].reduce((a, y, k) => a + y * v1[k], 0); });

const varTot = X.reduce((a, x) => a + x.reduce((b, y) => b + y * y, 0), 0);
const varAxe = rows.reduce((a, r) => a + r.t * r.t, 0);

const tri = [...rows].sort((a, b) => a.t - b.t);
const n = tri.length;
const net = tri.slice(0, Math.round(PART * n));
const doux = tri.slice(n - Math.round(PART * n));
const tronc = tri.slice(Math.round(0.4 * n), Math.round(0.6 * n));

const compo = (g) => { const c = {}; g.forEach((r) => { c[r.fam] = (c[r.fam] || 0) + 1; }); return c; };
const resume = (g) => Object.fromEntries([...noms, ...nomsCouleur].map((nm) => [nm, +med(g.map((r) => r.brut[nm])).toFixed(2)]));

const [nomBas, nomHaut] = SUR === 'couleur' ? ['froid', 'chaud'] : ['net', 'doux'];
fs.writeFileSync(path.join(BIBLIO, `pole-${nomBas}.json`), JSON.stringify(net.map((r) => ({ fam: r.fam, f: r.f }))));
fs.writeFileSync(path.join(BIBLIO, `pole-${nomHaut}.json`), JSON.stringify(doux.map((r) => ({ fam: r.fam, f: r.f }))));
fs.writeFileSync(path.join(BIBLIO, `axe-${SUR}.json`), JSON.stringify({
    photos: n,
    partDeVariance: +(100 * varAxe / varTot).toFixed(1),
    poids: Object.fromEntries(noms.map((nm, i) => [nm, +(s * v1[i]).toFixed(3)])),
    poles: { [nomBas]: { n: net.length, familles: compo(net), medianes: resume(net) },
        tronc: { n: tronc.length, familles: compo(tronc), medianes: resume(tronc) },
        [nomHaut]: { n: doux.length, familles: compo(doux), medianes: resume(doux) } },
}, null, 1));

console.log(`${n} photos, ${Object.keys(compo(rows)).length} familles — l'axe porte ${(100 * varAxe / varTot).toFixed(1)} % de la variation intra-famille`);
console.log('poids: ' + noms.map((nm, i) => [nm, s * v1[i]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8)
    .map(([nm, x]) => `${nm} ${x.toFixed(2)}`).join('  '));
const pad = (x, k) => String(x).padStart(k);
console.log(pad('', 12) + [nomBas, 'tronc', nomHaut].map((k) => pad(k, 10)).join(''));
for (const nm of noms) console.log(pad(nm, 12) + [net, tronc, doux].map((g) => pad(med(g.map((r) => r.brut[nm])).toFixed(1), 10)).join(''));
console.log(`  --- ${SUR === 'couleur' ? 'tonalite' : 'couleur'}, mesuree APRES coup, jamais utilisee pour former les poles ---`);
for (const nm of nomsCouleur) console.log(pad(nm, 12) + [net, tronc, doux].map((g) => pad(med(g.map((r) => r.brut[nm])).toFixed(2), 10)).join(''));
console.log(`\nfamilles ${nomBas} :`, JSON.stringify(compo(net)));
console.log(`familles ${nomHaut}:`, JSON.stringify(compo(doux)));
