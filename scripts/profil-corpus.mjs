/*
 * Portrait chiffre d'un corpus de photos, image par image.
 *
 *   node scripts/profil-corpus.mjs [dossier] [--json <sortie>]
 *
 * Pourquoi ce script alors que `mesure-ciel-powlisher.mjs` existe deja: celui-la
 * ne regarde QUE le ciel, sur les quelques photos qui en ont assez. Il a suffi a
 * poser une cible, pas a decrire un look. Ici on sort de chaque image un vecteur
 * complet — pied de courbe, point blanc, virage des ombres et des hautes
 * lumieres, chroma par bande de luminosite, histogramme de teinte pondere — pour
 * pouvoir ensuite REGROUPER les photos par rendu et ecarter celles qui ne
 * portent pas le meme traitement.
 *
 * Deux familles de mesures, a ne pas confondre:
 *  - LOOK    : ce que le developpement fait, aussi independant que possible du
 *              sujet (virage split-tone, pied/point blanc, niveau de chroma).
 *  - CONTENU : ce qu'il y a dans le cadre (part de ciel, de peau, de vert,
 *              scene de nuit). Sert a expliquer un groupe, jamais a le former.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const ANALYSE_MAX = 512; // cote max pour les stats: la teinte moyenne ne bouge pas, le temps si

function srgbToLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/* sRGB -> Lab D65. */
function rgbToLab(r, g, b) {
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function rgbToHsv(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return [h, max === 0 ? 0 : d / max, max / 255];
}

function percentile(hist, total, p) {
    let acc = 0;
    const cible = total * p;
    for (let i = 0; i < hist.length; i += 1) {
        acc += hist[i];
        if (acc >= cible) return i;
    }
    return hist.length - 1;
}

export async function profil(fichier) {
    const img = sharp(fichier).rotate();
    const meta = await img.metadata();
    const { data, info } = await img
        .resize(ANALYSE_MAX, ANALYSE_MAX, { fit: 'inside', withoutEnlargement: true })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const n = info.width * info.height;
    const lumaHist = new Array(256).fill(0);
    const teinteHist = new Array(36).fill(0); // ponderee par chroma
    // bandes de luminosite Lab: ombres L<25, medians 25-75, hautes L>75
    const bandes = [
        { nom: 'ombres', n: 0, a: 0, b: 0, c: 0 },
        { nom: 'medians', n: 0, a: 0, b: 0, c: 0 },
        { nom: 'hautes', n: 0, a: 0, b: 0, c: 0 },
    ];
    let sommeC = 0, sommeC2 = 0;

    /* --- LA LUMIERE ---------------------------------------------------------
     * La couleur d'une lumiere ne se lit pas sur les zones colorees: un mur
     * ocre reste ocre sous n'importe quelle lampe. Elle se lit sur ce qui
     * DEVRAIT etre gris — un mur blanc, un ciel voile, une carrosserie claire.
     * On moyenne donc a* et b* des pixels clairs ET presque neutres: leur ecart
     * a zero est la teinte de la lumiere, et rien d'autre.
     *
     * Seuils: L > 55 et C < 12. Une premiere version demandait L > 80 et C < 8,
     * ce qui ne trouvait AUCUN pixel sur ses photos — elles sont sombres et il
     * ne laisse presque rien monter dans les clairs. Un critere trop pur ne
     * mesure rien du tout. */
    let lumN = 0, lumA = 0, lumB = 0;

    /* --- LES REFLETS --------------------------------------------------------
     * Le 1 % le plus lumineux du cadre: une carrosserie, un plan d'eau, une
     * vitre. On ne peut pas savoir ou est ce seuil avant d'avoir tout lu, donc
     * on accumule a* et b* PAR NIVEAU de luminance et on fera la moyenne sur
     * les niveaux du haut une fois l'histogramme complet. Ca evite une
     * deuxieme lecture de l'image. */
    const aParLuma = new Float64Array(256), bParLuma = new Float64Array(256);

    /* --- LA COURBE DE SATURATION --------------------------------------------
     * La chroma par tranche de luminosite. Un chiffre global de chroma ne
     * distingue pas « ombres videes, medians gonfles » de « tout uniformement
     * tiede », alors que ce sont deux rendus tres differents. */
    const chromaBande = new Float64Array(8), nBande = new Float64Array(8);

    /* --- LA SATURATION TEINTE PAR TEINTE ------------------------------------
     * Douze secteurs de 30 degres, l'equivalent du panneau TSL: combien de
     * rouge, d'orange, de jaune, de vert, de cyan, de bleu, et a quelle
     * intensite. C'est ici que se voit un traitement qui retient les verts et
     * laisse filer les oranges. */
    const chromaTeinte = new Float64Array(12), nTeinte = new Float64Array(12);

    /* --- LA TEXTURE ---------------------------------------------------------
     * Ecart moyen entre pixels voisins, rapporte a la luminosite locale. Monte
     * avec la clarte et la nettete, descend avec le voile et le flou. */
    let sommeGrad = 0, nGrad = 0;
    let ecretes = 0, boues = 0;
    /* Indices « est-ce seulement une photo ? ». Une capture d'ecran de document
     * ou une infographie a des aplats, du blanc neutre en fond et peu de
     * couleurs distinctes; une photo n'a presque jamais deux pixels voisins
     * rigoureusement identiques. */
    let plats = 0, blancsNeutres = 0, neutresExacts = 0, nonNoirs = 0;
    /* Deux signaux qu'une photo ne produit pour ainsi dire jamais, et qu'une
     * capture d'ecran produit toujours : une couleur EXACTE qui occupe une
     * grosse part du cadre (le fond), et des pixels rigoureusement neutres
     * (r = v = b). Sur une photo, le bruit du capteur et le developpement
     * suffisent a rendre chaque pixel unique et legerement teinte. */
    const compte = new Map();
    const palette = new Uint8Array(32768); // couleurs distinctes sur 5 bits par canal
    // familles de contenu
    const fam = {
        ciel: { n: 0, hue: 0, sat: 0 },
        peau: { n: 0, hue: 0, sat: 0 },
        vert: { n: 0, hue: 0, sat: 0 },
    };

    for (let i = 0; i < data.length; i += 3) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        lumaHist[luma] += 1;
        if (r >= 254 && g >= 254 && b >= 254) ecretes += 1;
        if (r <= 2 && g <= 2 && b <= 2) boues += 1;

        const [L, A, B] = rgbToLab(r, g, b);
        const C = Math.hypot(A, B);
        sommeC += C;
        sommeC2 += C * C;

        if (L > 55 && C < 12) { lumN += 1; lumA += A; lumB += B; }
        aParLuma[luma] += A;
        bParLuma[luma] += B;
        const bl = Math.min(7, luma >> 5);
        chromaBande[bl] += C; nBande[bl] += 1;
        if (i >= 3) {
            const gauche = 0.2126 * data[i - 3] + 0.7152 * data[i - 2] + 0.0722 * data[i - 1];
            sommeGrad += Math.abs(luma - gauche) / Math.max(16, (luma + gauche) / 2);
            nGrad += 1;
        }
        const bande = L < 25 ? bandes[0] : L > 75 ? bandes[2] : bandes[1];
        bande.n += 1; bande.a += A; bande.b += B; bande.c += C;

        if (i >= 3 && r === data[i - 3] && g === data[i - 2] && b === data[i - 1]) plats += 1;
        if (luma > 240 && C < 4) blancsNeutres += 1;
        palette[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)] = 1;
        /* On EXCLUT le noir ecrase de ces deux comptages. Premiere version du
         * tri: elle rejetait comme « capture d'ecran » trois vraies photos de
         * cabine d'avion, sur un aplat de 32 a 41 %. Cet aplat, c'etait du noir
         * bouche a r = v = b = 0, c'est-a-dire exactement la signature qu'on
         * cherche a reproduire. Un fond de document, lui, est clair ou gris. */
        if (luma > 2) {
            if (luma < 253 && r === g && g === b) neutresExacts += 1;
            nonNoirs += 1;
            const cle = (r << 16) | (g << 8) | b;
            compte.set(cle, (compte.get(cle) || 0) + 1);
        }

        const [h, s, v] = rgbToHsv(r, g, b);
        if (s > 0.08) teinteHist[Math.floor(h / 10) % 36] += C;
        if (C >= 6) {
            /* Secteur en teinte LAB, pas HSV: c'est la teinte perceptive, celle
             * ou « orange » et « jaune » ne se melangent pas comme en HSV. */
            let hl = Math.atan2(B, A) * 180 / Math.PI;
            if (hl < 0) hl += 360;
            const ht = Math.floor(hl / 30) % 12;
            chromaTeinte[ht] += C; nTeinte[ht] += 1;
        }

        // ciel: bleu franc, pas trop sombre
        if (h >= 160 && h <= 250 && s > 0.15 && v > 0.35) { fam.ciel.n += 1; fam.ciel.hue += h; fam.ciel.sat += s; }
        // peau: orange doux, saturation moderee
        if (h >= 10 && h <= 45 && s > 0.15 && s < 0.6 && v > 0.3) { fam.peau.n += 1; fam.peau.hue += h; fam.peau.sat += s; }
        // vert / feuillage
        if (h >= 60 && h <= 160 && s > 0.12) { fam.vert.n += 1; fam.vert.hue += h; fam.vert.sat += s; }
    }

    for (const f of Object.values(fam)) {
        if (f.n) { f.hue /= f.n; f.sat /= f.n; }
        f.part = f.n / n;
    }
    for (const b of bandes) {
        if (b.n) { b.a /= b.n; b.b /= b.n; b.c /= b.n; }
        b.part = b.n / n;
    }

    /* On retient aussi la LUMINOSITE de la couleur dominante. Elle fait toute la
     * difference entre un fond de document et une photo de nuit: les deux
     * offrent un grand aplat d'une seule couleur exacte, mais celui du document
     * est clair et celui de la nuit est sombre. Sans cette distinction, le tri
     * rejetait les vues de New York et de Shanghai de nuit. */
    let dominante = 0, dominanteCle = 0;
    for (const [cle, v] of compte) if (v > dominante) { dominante = v; dominanteCle = cle; }
    const dominanteLuma = Math.round(
        0.2126 * ((dominanteCle >> 16) & 255)
        + 0.7152 * ((dominanteCle >> 8) & 255)
        + 0.0722 * (dominanteCle & 255));

    let couleurs = 0;
    for (let k = 0; k < palette.length; k += 1) couleurs += palette[k];

    const moyC = sommeC / n;
    const ecartC = Math.sqrt(Math.max(0, sommeC2 / n - moyC * moyC));

    /* Les reflets: tout ce qui est au-dessus du 99e percentile de luminance. */
    const seuilReflet = percentile(lumaHist, n, 0.99);
    let refN = 0, refA = 0, refB = 0, refL = 0;
    for (let v = seuilReflet; v < 256; v += 1) {
        refN += lumaHist[v]; refA += aParLuma[v]; refB += bParLuma[v]; refL += lumaHist[v] * v;
    }

    return {
        fichier: path.basename(fichier),
        largeur: meta.width,
        hauteur: meta.height,
        // --- LOOK ---
        pied: percentile(lumaHist, n, 0.01),
        p05: percentile(lumaHist, n, 0.05),
        median: percentile(lumaHist, n, 0.5),
        p95: percentile(lumaHist, n, 0.95),
        pointBlanc: percentile(lumaHist, n, 0.99),
        maxLuma: lumaHist.findLastIndex((v) => v > 0),
        partEcretee: +(100 * ecretes / n).toFixed(3),
        partBouchee: +(100 * boues / n).toFixed(3),
        partPlate: +(100 * plats / n).toFixed(1),
        partBlancNeutre: +(100 * blancsNeutres / n).toFixed(1),
        couleurs,
        partDominante: +(100 * dominante / Math.max(1, nonNoirs)).toFixed(1),
        dominanteLuma,
        partNeutreExact: +(100 * neutresExacts / Math.max(1, nonNoirs)).toFixed(1),
        chromaMoy: +moyC.toFixed(2),
        chromaEcart: +ecartC.toFixed(2),
        ombresA: +bandes[0].a.toFixed(2), ombresB: +bandes[0].b.toFixed(2), ombresC: +bandes[0].c.toFixed(2),
        mediansA: +bandes[1].a.toFixed(2), mediansB: +bandes[1].b.toFixed(2), mediansC: +bandes[1].c.toFixed(2),
        hautesA: +bandes[2].a.toFixed(2), hautesB: +bandes[2].b.toFixed(2), hautesC: +bandes[2].c.toFixed(2),
        partOmbres: +(100 * bandes[0].part).toFixed(1),
        partHautes: +(100 * bandes[2].part).toFixed(1),
        teinteHist: teinteHist.map((v) => +(v / (sommeC || 1)).toFixed(4)),
        // --- LUMIERE, REFLETS, TEXTURE ---
        lumiereA: +(lumN ? lumA / lumN : 0).toFixed(2),
        lumiereB: +(lumN ? lumB / lumN : 0).toFixed(2),
        lumierePart: +(100 * lumN / n).toFixed(1),
        refletA: +(refN ? refA / refN : 0).toFixed(2),
        refletB: +(refN ? refB / refN : 0).toFixed(2),
        refletLuma: Math.round(refN ? refL / refN : 0),
        texture: +(nGrad ? 100 * sommeGrad / nGrad : 0).toFixed(2),
        chromaParBande: [...chromaBande].map((v, i) => +(nBande[i] ? v / nBande[i] : 0).toFixed(1)),
        chromaParTeinte: [...chromaTeinte].map((v, i) => +(nTeinte[i] ? v / nTeinte[i] : 0).toFixed(1)),
        partParTeinte: [...nTeinte].map((v) => +(100 * v / n).toFixed(2)),
        // --- CONTENU ---
        cielPart: +(100 * fam.ciel.part).toFixed(1),
        cielTeinte: +fam.ciel.hue.toFixed(1),
        cielSat: +fam.ciel.sat.toFixed(3),
        peauPart: +(100 * fam.peau.part).toFixed(1),
        peauTeinte: +fam.peau.hue.toFixed(1),
        peauSat: +fam.peau.sat.toFixed(3),
        vertPart: +(100 * fam.vert.part).toFixed(1),
        vertTeinte: +fam.vert.hue.toFixed(1),
        vertSat: +fam.vert.sat.toFixed(3),
    };
}

/* Le module s'importe (voir `trier-biblio.mjs`) autant qu'il se lance. */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await cli();

async function cli() {
const args = process.argv.slice(2);
const dossier = args.find((a) => !a.startsWith('--')) || 'docs/lightroom/corpus-powlisher';
const iJson = args.indexOf('--json');
const sortie = iJson >= 0 ? args[iJson + 1] : 'docs/lightroom/profil-corpus.json';

const fichiers = fs.readdirSync(dossier)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !/PLANCHE/i.test(f))
    .sort()
    .map((f) => path.join(dossier, f));

if (!fichiers.length) {
    console.error(`Aucune image dans ${dossier}`);
    process.exit(1);
}

const profils = [];
for (const f of fichiers) {
    profils.push(await profil(f));
    process.stderr.write('.');
}
process.stderr.write('\n');

fs.mkdirSync(path.dirname(sortie), { recursive: true });
fs.writeFileSync(sortie, JSON.stringify({ dossier, date: new Date().toISOString(), profils }, null, 1));

const col = (v, w) => String(v).padStart(w);
console.log('fichier            pied p50 p95 blanc ecret chroma | ombres a/b   hautes a/b  | ciel%  teinte  peau%  teinte  vert%  teinte');
for (const p of profils) {
    console.log(
        `${p.fichier.replace(/-reference|\.jpg|\.png/g, '').padEnd(18)}`
        + `${col(p.pied, 4)}${col(p.median, 4)}${col(p.p95, 4)}${col(p.pointBlanc, 6)}`
        + `${col(p.partEcretee, 6)}${col(p.chromaMoy, 7)} |`
        + `${col(p.ombresA, 6)}${col(p.ombresB, 6)}`
        + `${col(p.hautesA, 8)}${col(p.hautesB, 6)}  |`
        + `${col(p.cielPart, 6)}${col(p.cielTeinte, 8)}`
        + `${col(p.peauPart, 7)}${col(p.peauTeinte, 8)}`
        + `${col(p.vertPart, 7)}${col(p.vertTeinte, 8)}`,
    );
}
console.log(`\n${profils.length} images -> ${sortie}`);
}
