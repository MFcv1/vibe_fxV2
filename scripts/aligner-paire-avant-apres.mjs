/*
 * Aligne les deux captures d'ecran d'une paire « Avant / Apres » publiee par
 * @powl_d, et en sort deux images RECADREES ET SUPERPOSEES, pretes a mesurer.
 *
 *   node scripts/aligner-paire-avant-apres.mjs <avant.jpg> <apres.jpg> <prefixe-sortie>
 *
 * Pourquoi ce script existe: la source n'est pas un couple de fichiers exportes,
 * ce sont deux captures de l'ecran de Lightroom mobile. Le cadre de l'image n'y
 * tombe pas au meme endroit d'une capture a l'autre (quelques dizaines de pixels
 * de decalage vertical, et un peu d'echelle). Mesurer sans aligner reviendrait a
 * comparer le ciel d'une image au toit de l'autre.
 *
 * L'alignement se fait sur le GRADIENT (la structure), jamais sur la couleur:
 * c'est justement la couleur qui change entre les deux, elle ne peut pas servir
 * de reference. Recherche pyramidale sur (dx, dy, echelle).
 *
 * La bande haute de la zone image est exclue de la recherche: c'est la que
 * Lightroom pose le mot « Avant » sur l'une et sa barre d'icones sur l'autre.
 */

import sharp from 'sharp';

const [avantPath, apresPath, prefixe] = process.argv.slice(2);
if (!avantPath || !apresPath || !prefixe) {
    console.error('usage: node scripts/aligner-paire-avant-apres.mjs <avant> <apres> <prefixe-sortie>');
    process.exit(1);
}

/* La zone image de l'ecran, mesuree sur les captures (943x2048):
 * au-dessus, la barre d'etat du telephone; en dessous le fond gris de Lightroom
 * d'outils de Lightroom, identiques au pixel pres d'une capture a l'autre. */
const BOITE = { x: 0, y: 133, w: 943, h: 1574 };
/* Hauteur, dans la boite, ou vivent les surcouches (« Avant », icones). */
const SURCOUCHE = 120;

async function charger(p) {
    const { data, info } = await sharp(p)
        .extract({ left: BOITE.x, top: BOITE.y, width: BOITE.w, height: BOITE.h })
        .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height };
}

/* Luminance, puis reduction par moyenne de blocs (pas de reechantillonnage
 * malin: on cherche une position, pas une texture). */
function luma(img) {
    const out = new Float32Array(img.w * img.h);
    for (let i = 0, j = 0; j < out.length; i += 3, j += 1) {
        out[j] = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
    }
    return { p: out, w: img.w, h: img.h };
}

function reduire(g, f) {
    const w = Math.floor(g.w / f), h = Math.floor(g.h / f);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            let s = 0;
            for (let dy = 0; dy < f; dy += 1) for (let dx = 0; dx < f; dx += 1) s += g.p[(y * f + dy) * g.w + x * f + dx];
            out[y * w + x] = s / (f * f);
        }
    }
    return { p: out, w, h };
}

/* Sobel: c'est la structure, insensible a un decalage de niveau ou de teinte. */
function gradient(g) {
    const out = new Float32Array(g.w * g.h);
    for (let y = 1; y < g.h - 1; y += 1) {
        for (let x = 1; x < g.w - 1; x += 1) {
            const i = y * g.w + x;
            const gx = g.p[i - g.w + 1] + 2 * g.p[i + 1] + g.p[i + g.w + 1]
                - g.p[i - g.w - 1] - 2 * g.p[i - 1] - g.p[i + g.w - 1];
            const gy = g.p[i + g.w - 1] + 2 * g.p[i + g.w] + g.p[i + g.w + 1]
                - g.p[i - g.w - 1] - 2 * g.p[i - g.w] - g.p[i - g.w + 1];
            out[i] = Math.hypot(gx, gy);
        }
    }
    return { p: out, w: g.w, h: g.h };
}

const ech = (g, x, y) => {
    if (x < 0 || y < 0 || x >= g.w - 1 || y >= g.h - 1) return null;
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const a = g.p[y0 * g.w + x0], b = g.p[y0 * g.w + x0 + 1];
    const c = g.p[(y0 + 1) * g.w + x0], d = g.p[(y0 + 1) * g.w + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
};

/* Correlation normalisee entre le gradient de l'avant et celui de l'apres
 * transporte par (dx, dy, s). s applique autour du centre de la boite. */
function score(ga, gb, dx, dy, s, hautExclue, pas) {
    const cx = ga.w / 2, cy = ga.h / 2;
    let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let y = hautExclue; y < ga.h - 2; y += pas) {
        for (let x = 2; x < ga.w - 2; x += pas) {
            const A = ga.p[y * ga.w + x];
            const B = ech(gb, cx + (x - cx) * s + dx, cy + (y - cy) * s + dy);
            if (B === null) continue;
            n += 1; sa += A; sb += B; saa += A * A; sbb += B * B; sab += A * B;
        }
    }
    if (n < 100) return -1;
    const va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
    if (va <= 0 || vb <= 0) return -1;
    return (sab / n - (sa / n) * (sb / n)) / Math.sqrt(va * vb);
}

const imgA = await charger(avantPath);
const imgB = await charger(apresPath);
const lA = luma(imgA), lB = luma(imgB);

/* Etage grossier: 1/8, translation large et echelle large. */
let best = { dx: 0, dy: 0, s: 1, r: -1 };
{
    const f = 8;
    const ga = gradient(reduire(lA, f)), gb = gradient(reduire(lB, f));
    const haut = Math.ceil(SURCOUCHE / f);
    for (let s = 0.94; s <= 1.0601; s += 0.01) {
        for (let dy = -20; dy <= 20; dy += 1) {
            for (let dx = -12; dx <= 12; dx += 1) {
                const r = score(ga, gb, dx, dy, s, haut, 1);
                if (r > best.r) best = { dx, dy, s, r };
            }
        }
    }
    best = { dx: best.dx * f, dy: best.dy * f, s: best.s, r: best.r };
    console.log(`1/8  dx=${best.dx} dy=${best.dy} s=${best.s.toFixed(3)} r=${best.r.toFixed(4)}`);
}

/* Etage fin: 1/2 puis pleine resolution, fenetre etroite. */
for (const f of [2, 1]) {
    const ga = gradient(f === 1 ? lA : reduire(lA, f));
    const gb = gradient(f === 1 ? lB : reduire(lB, f));
    const haut = Math.ceil(SURCOUCHE / f);
    const pas = f === 1 ? 2 : 1;
    let loc = { dx: best.dx / f, dy: best.dy / f, s: best.s, r: -1 };
    const c = { ...loc };
    const dS = f === 2 ? 0.008 : 0.002, pS = f === 2 ? 0.002 : 0.0005;
    const dP = f === 2 ? 6 : 4;
    for (let s = c.s - dS; s <= c.s + dS + 1e-9; s += pS) {
        for (let dy = c.dy - dP; dy <= c.dy + dP; dy += 0.5) {
            for (let dx = c.dx - dP; dx <= c.dx + dP; dx += 0.5) {
                const r = score(ga, gb, dx, dy, s, haut, pas);
                if (r > loc.r) loc = { dx, dy, s, r };
            }
        }
    }
    best = { dx: loc.dx * f, dy: loc.dy * f, s: loc.s, r: loc.r };
    console.log(`1/${f}  dx=${best.dx.toFixed(1)} dy=${best.dy.toFixed(1)} s=${best.s.toFixed(4)} r=${best.r.toFixed(4)}`);
}

/* Le cadre utile.
 *
 * Deux choses le retrecissent:
 *  - Lightroom pose l'image sur un fond NOIR: une photo qui n'a pas le format
 *    de l'ecran laisse des bandes en haut et en bas. Ce fond n'est pas de la
 *    photo, et il pese lourd (des milliers de blocs a zero) — on le coupe.
 *  - la transformation trouvee ci-dessus fait sortir certains bords de l'apres
 *    hors de son image; on retient le rectangle qui reste dedans des deux cotes.
 */
function bandeNoire(img) {
    const noire = (y) => {
        let n = 0;
        for (let x = 0; x < img.w; x += 1) {
            const i = (y * img.w + x) * 3;
            if (Math.max(img.data[i], img.data[i + 1], img.data[i + 2]) <= 4) n += 1;
        }
        return n > img.w * 0.99;
    };
    /* La plus longue suite de lignes NON noires: c'est la photo. On ne part pas
     * du bord, parce que Lightroom pose « Avant » ou ses icones DANS la bande
     * noire du haut — un balayage naif s'y arrete des la premiere lettre. */
    let best = [0, 0], debut = null;
    for (let y = 0; y <= img.h; y += 1) {
        const photo = y < img.h && !noire(y);
        if (photo && debut === null) debut = y;
        if (!photo && debut !== null) {
            if (y - debut > best[1] - best[0]) best = [debut, y];
            debut = null;
        }
    }
    return best;
}

const cx = imgA.w / 2, cy = imgA.h / 2;
const versB = (x, y) => [cx + (x - cx) * best.s + best.dx, cy + (y - cy) * best.s + best.dy];
const [contHaut, contBas] = bandeNoire(imgA);
const marge = 6;
/* Bornes pour que l'echantillonnage de l'apres reste dans son image. */
const invX = (bx) => (bx - best.dx - cx) / best.s + cx;
const invY = (by) => (by - best.dy - cy) / best.s + cy;
const x0 = Math.max(marge, Math.ceil(invX(1)));
const x1 = Math.min(imgA.w - marge, Math.floor(invX(imgB.w - 2)));
const y0 = Math.max(contHaut + marge, SURCOUCHE + marge, Math.ceil(invY(1)));
const y1 = Math.min(contBas - marge, imgA.h - marge, Math.floor(invY(imgB.h - 2)));
const W = x1 - x0, H = y1 - y0;
if (W < 100 || H < 100) { console.error('cadre utile trop petit'); process.exit(1); }

const outA = Buffer.alloc(W * H * 3);
const outB = Buffer.alloc(W * H * 3);
const canal = [0, 1, 2].map((k) => {
    const g = new Float32Array(imgB.w * imgB.h);
    for (let j = 0; j < g.length; j += 1) g[j] = imgB.data[j * 3 + k];
    return { p: g, w: imgB.w, h: imgB.h };
});
for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
        const sx = x0 + x, sy = y0 + y;
        const i = (y * W + x) * 3, j = (sy * imgA.w + sx) * 3;
        outA[i] = imgA.data[j]; outA[i + 1] = imgA.data[j + 1]; outA[i + 2] = imgA.data[j + 2];
        const [bx, by] = versB(sx, sy);
        for (let k = 0; k < 3; k += 1) outB[i + k] = Math.round(ech(canal[k], bx, by) ?? 0);
    }
}
await sharp(outA, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${prefixe}-avant.png`);
await sharp(outB, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${prefixe}-apres.png`);
console.log(`-> ${prefixe}  cadre utile ${W}x${H} (x ${x0}..${x1}, y ${y0}..${y1}; bande noire ${contHaut}..${contBas})`);
