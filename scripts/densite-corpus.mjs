/*
 * Ou un corpus POSE ses couleurs, bande de luminosite par bande de luminosite.
 *
 *   node scripts/densite-corpus.mjs <dossier|arbre-de-familles> [--json <sortie>]
 *
 * Ce que ce script mesure, et pourquoi c'est la bonne chose a mesurer.
 *
 * On ne dispose que des SORTIES du photographe, jamais de ses fichiers de
 * depart. Impossible, donc, d'apprendre une correspondance « entree -> sortie ».
 * Mais un developpement laisse une trace observable sur la seule sortie: il
 * cree des ATTRACTEURS. Certaines teintes se peuplent, d'autres se vident. Un
 * ciel qui atterrit toujours entre 184 et 193 degres laisse un pic a cet
 * endroit et un desert entre 200 et 220, la ou un ciel non traite se serait
 * pose. La forme de cette densite EST la signature du traitement.
 *
 * Deux precautions qui changent le resultat:
 *
 *  - on separe par BANDE DE LUMINOSITE. Un virage cinematique ne fait pas la
 *    meme chose aux ombres et aux hautes lumieres; tout melanger revient a
 *    moyenner deux traitements opposes et a n'en decrire aucun.
 *  - on pondere par la CHROMA. Un pixel presque gris a une teinte, mais elle ne
 *    veut rien dire: c'est du bruit d'arrondi. Le ponderer comme un pixel
 *    franchement colore noierait les vrais pics.
 *
 * La densite seule ne donne pas la direction du deplacement — pour ca il faut
 * la comparer a celle d'un tas neutre. C'est l'etape suivante; ce script
 * fabrique la moitie qu'on peut mesurer sans rien telecharger.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BINS = 72;            // 5 degres par case
const BANDES = [
    { nom: 'ombres', min: 0, max: 64 },
    { nom: 'bas-medians', min: 64, max: 128 },
    { nom: 'haut-medians', min: 128, max: 192 },
    { nom: 'hautes', min: 192, max: 256 },
];
const CHROMA_MIN = 6;       // en dessous, la teinte est du bruit

function srgbToLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function rgbToLab(r, g, b) {
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function vide() {
    return BANDES.map(() => ({
        teinte: new Float64Array(BINS),   // poids = chroma
        chroma: new Float64Array(BINS),   // chroma cumulee, pour la moyenne par case
        n: 0,
        sommeChroma: 0,
    }));
}

async function accumule(fichier, acc, luma) {
    const { data, info } = await sharp(fichier).rotate()
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    for (let i = 0; i < data.length; i += 3) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        luma[Math.round(y)] += 1;
        const [, A, B] = rgbToLab(r, g, b);
        const C = Math.hypot(A, B);
        if (C < CHROMA_MIN) continue;
        let bande = 0;
        while (bande < BANDES.length - 1 && y >= BANDES[bande].max) bande += 1;
        let h = Math.atan2(B, A) * 180 / Math.PI;   // teinte Lab, pas HSV
        if (h < 0) h += 360;
        const bin = Math.min(BINS - 1, Math.floor(h / (360 / BINS)));
        acc[bande].teinte[bin] += C;
        acc[bande].chroma[bin] += C;
        acc[bande].n += 1;
        acc[bande].sommeChroma += C;
    }
    return n;
}

/* Les pics de la densite: une case qui domine ses voisines et pese assez pour
 * ne pas etre un accident. Le lissage circulaire evite qu'un pic large ne se
 * presente comme trois pics etroits. */
function pics(densite, minPart = 0.04) {
    const total = densite.reduce((s, v) => s + v, 0) || 1;
    const lisse = densite.map((_, i) => (
        densite[(i - 1 + BINS) % BINS] + 2 * densite[i] + densite[(i + 1) % BINS]
    ) / 4);
    const out = [];
    for (let i = 0; i < BINS; i += 1) {
        const g = lisse[(i - 1 + BINS) % BINS], d = lisse[(i + 1) % BINS];
        if (lisse[i] > g && lisse[i] >= d) {
            const part = lisse[i] * 4 / total;
            if (part >= minPart) out.push({ deg: Math.round(i * (360 / BINS) + 2.5), part: +part.toFixed(3) });
        }
    }
    return out.sort((a, b) => b.part - a.part).slice(0, 3);
}

function percentile(hist, total, p) {
    let acc = 0;
    for (let i = 0; i < hist.length; i += 1) { acc += hist[i]; if (acc >= total * p) return i; }
    return 255;
}

const racine = process.argv[2] || `${process.env.HOME}/Desktop/powlisher-biblio/par-sujet`;
const iJson = process.argv.indexOf('--json');
const sortie = iJson >= 0 ? process.argv[iJson + 1] : `${process.env.HOME}/Desktop/powlisher-biblio/densites.json`;

const estArbre = fs.readdirSync(racine).some((f) => fs.statSync(path.join(racine, f)).isDirectory());
const familles = estArbre
    ? fs.readdirSync(racine).filter((f) => fs.statSync(path.join(racine, f)).isDirectory()).sort()
    : [null];

const resultat = {};
for (const fam of familles) {
    const d = fam ? path.join(racine, fam) : racine;
    const fichiers = fs.readdirSync(d).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (!fichiers.length) continue;
    const acc = vide();
    const luma = new Array(256).fill(0);
    let pixels = 0;
    for (const f of fichiers) pixels += await accumule(path.join(d, f), acc, luma);
    resultat[fam || 'tout'] = {
        photos: fichiers.length,
        luma: {
            pied: percentile(luma, pixels, 0.01),
            p50: percentile(luma, pixels, 0.5),
            p99: percentile(luma, pixels, 0.99),
            /* L'histogramme complet, pas seulement trois reperes: c'est lui qui
             * portera la courbe de tonalite, obtenue en appariant les quantiles
             * du tas neutre a ceux du sien. Trois percentiles ne suffisent pas
             * a decrire une courbe. */
            hist: luma.map((v) => +(v / pixels).toFixed(7)),
        },
        bandes: acc.map((a, i) => ({
            nom: BANDES[i].nom,
            partPixels: +(a.n / pixels).toFixed(3),
            chromaMoy: +(a.sommeChroma / Math.max(1, a.n)).toFixed(1),
            pics: pics(a.teinte),
            densite: [...a.teinte].map((v) => +(v / (a.sommeChroma || 1)).toFixed(5)),
        })),
    };
    process.stderr.write(`${fam || 'tout'} `);
}
process.stderr.write('\n');

fs.writeFileSync(sortie, JSON.stringify(resultat));

console.log('famille        n   pied p50 p99 | bande          part  chroma  attracteurs (teinte Lab, poids)');
for (const [fam, r] of Object.entries(resultat)) {
    for (const [i, b] of r.bandes.entries()) {
        console.log(
            (i === 0 ? fam.padEnd(13) + String(r.photos).padStart(3)
                + String(r.luma.pied).padStart(6) + String(r.luma.p50).padStart(4) + String(r.luma.p99).padStart(4)
                : ' '.repeat(30)) + ' | '
            + b.nom.padEnd(13) + String(b.partPixels).padStart(5) + String(b.chromaMoy).padStart(7) + '  '
            + b.pics.map((p) => `${p.deg}° (${(p.part * 100).toFixed(0)}%)`).join('  '),
        );
    }
}
console.log(`\n-> ${sortie}`);
