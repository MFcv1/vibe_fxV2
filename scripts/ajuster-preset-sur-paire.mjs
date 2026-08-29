/*
 * Ajuste un preset complet — courbe, virage, melangeur, regle du ciel — sur UNE
 * paire avant/apres alignee, en retirant d'abord le MASQUE LOCAL de la photo.
 *
 *   node scripts/ajuster-preset-sur-paire.mjs <prefixe-de-la-paire> [--plat 7]
 *
 * POURQUOI RETIRER LE MASQUE D'ABORD. Sur sa photo de nuit, il a assombri le
 * ciel et le sol au masquage (voir docs/paires-avant-apres-powlisher-*.md): la
 * meme couleur d'entree sort a L* 64,8 en haut du cadre et a L* 2,8 en bas.
 * Mesurer la couleur a travers ca, c'est mesurer un assombrissement local et le
 * prendre pour un virage. On estime donc le masque — l'ecart d'exposition,
 * cellule par cellule, entre son rendu et un preset de reference — on le
 * ramene a son PLATEAU (la zone qu'il n'a pas touchee), et on corrige son rendu
 * de cet ecart avant d'ajuster quoi que ce soit.
 *
 * L'estimation du masque depend du preset de reference, donc on boucle: on part
 * de `powV2`, on ajuste, on re-estime le masque avec le resultat, on rajuste.
 */

import sharp from 'sharp';
import { VISION_PRESET_BY_ID } from '../src/features/vibefx-studio/utils/visionPresets.js';

const prefixe = process.argv[2];
if (!prefixe) { console.error('usage: node scripts/ajuster-preset-sur-paire.mjs <prefixe>'); process.exit(1); }
const iPlat = process.argv.indexOf('--plat');
const PLAT = iPlat > 0 ? Number(process.argv[iPlat + 1]) : 7;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const l2s = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const F = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const Fi = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
function lab(r, g, b) {
    const R = s2l(r), G = s2l(g), B = s2l(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const fx = F(X), fy = F(Y), fz = F(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function unlab(L, A, B) {
    const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
    const X = Fi(fx) * 0.95047, Y = Fi(fy), Z = Fi(fz) * 1.08883;
    return [clamp01(l2s(X * 3.2406 + Y * -1.5372 + Z * -0.4986)),
        clamp01(l2s(X * -0.9689 + Y * 1.8758 + Z * 0.0415)),
        clamp01(l2s(X * 0.0557 + Y * -0.2040 + Z * 1.0570))];
}
const Yl = (c) => 0.2126 * s2l(c[0]) + 0.7152 * s2l(c[1]) + 0.0722 * s2l(c[2]);
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fondu = (t, L) => {
    const x = clamp01(L / 100) * (t.length - 1);
    const i = Math.min(t.length - 2, Math.floor(x)); const u = x - i;
    return t[i] + (t[i + 1] - t[i]) * (u * u * (3 - 2 * u));
};
const med = (xs) => { const t = [...xs].sort((a, b) => a - b); return t.length ? t[t.length >> 1] : NaN; };
const pond = (xs) => {                      /* mediane ponderee */
    const t = [...xs].sort((a, b) => a[0] - b[0]);
    const tot = t.reduce((s, x) => s + x[1], 0); let acc = 0;
    for (const [v, w] of t) { acc += w; if (acc >= tot / 2) return v; }
    return t.length ? t[t.length - 1][0] : NaN;
};

/* ---------- le modele, identique a celui de powV2 ---------- */
let COURBE = [0, 3.91, 6.62, 10.40, 14.75, 19.35, 24.09, 28.89, 33.73, 38.60, 43.49,
    48.39, 53.30, 58.22, 63.14, 68.06, 72.99, 77.92, 82.86, 87.79, 92.73];
let VA = [0.13, -2.48, -3.68, -3.58, -2.33, -0.21, 1.50, 2.56, 3.22, 3.28, 2.97,
    2.67, 2.45, 2.18, 1.59, 0.70, -0.06, -0.37, -0.38, -0.36, -0.36];
let VB = [-0.15, 0.20, -0.69, -1.13, -0.05, 2.15, 4.67, 6.48, 7.00, 6.95, 7.01,
    6.96, 6.75, 6.58, 6.54, 6.63, 6.69, 6.50, 6.23, 6.06, 5.98];
let MEL = [[2.52, 1.028], [1.99, 1.063], [-0.88, 1.136], [-5.22, 1.079],
    [-5.83, 0.911], [0.24, 0.828], [-1.22, 0.716], [4.27, 0.483],
    [6.74, 0.356], [10.1, 0.60], [5.1, 0.80], [0, 1],
    [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1],
    [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1]];
let CIEL = { cible: 227.5, chroma: 0.85 };
const melange = (h) => {
    const x = ((((h - 7.5) % 360) + 360) % 360) / 15;
    const i = Math.floor(x); const t = x - i; const u = t * t * (3 - 2 * t);
    const a = MEL[i % 24], b = MEL[(i + 1) % 24];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
};
const bandeCiel = (h) => smoothstep(227.5, 262, h) * (1 - smoothstep(285, 308, h));

function tonalite(rgb) {
    const R = s2l(rgb[0]), G = s2l(rgb[1]), B = s2l(rgb[2]);
    const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    if (Y <= 1e-6) return rgb;
    const k = Fi((fondu(COURBE, 116 * F(Y) - 16) + 16) / 116) / Y;
    return [clamp01(l2s(R * k)), clamp01(l2s(G * k)), clamp01(l2s(B * k))];
}
function couleur(rgb) {
    let [L, A, B] = lab(...rgb);
    const c = Math.hypot(A, B); const w = smoothstep(4, 11, c);
    if (w > 0 && c > 1e-6) {
        let h = Math.atan2(B, A) * 180 / Math.PI; if (h < 0) h += 360;
        const [dh, gain] = melange(h); const ci = bandeCiel(h);
        const rot = dh * (1 - ci) + (CIEL.cible - h) * ci;
        const gc = gain * (1 - ci) + CIEL.chroma * ci;
        const hn = (h + rot * w) * Math.PI / 180; const cn = c * (1 + (gc - 1) * w);
        A = cn * Math.cos(hn); B = cn * Math.sin(hn);
    }
    return [L, A + fondu(VA, L), B + fondu(VB, L)];
}
const complet = (rgb) => couleur(tonalite(rgb));

/* ---------- les donnees ---------- */
const A = await sharp(`${prefixe}-avant.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const Bimg = await sharp(`${prefixe}-apres.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = A.info.width, H = A.info.height, BL = 8;
const blocs = [];
for (let by = 0; by + BL <= H; by += BL) {
    for (let bx = 0; bx + BL <= W; bx += BL) {
        const ma = [0, 0, 0], mb = [0, 0, 0], va = [0, 0, 0], vb = [0, 0, 0];
        for (let y = 0; y < BL; y += 1) for (let x = 0; x < BL; x += 1) {
            const i = ((by + y) * W + bx + x) * 3;
            for (let k = 0; k < 3; k += 1) {
                const a = A.data[i + k], b = Bimg.data[i + k];
                ma[k] += a; mb[k] += b; va[k] += a * a; vb[k] += b * b;
            }
        }
        const n = BL * BL; let plat = true;
        for (let k = 0; k < 3; k += 1) {
            ma[k] /= n; mb[k] /= n;
            if (Math.sqrt(Math.max(0, va[k] / n - ma[k] * ma[k])) > PLAT) plat = false;
            if (Math.sqrt(Math.max(0, vb[k] / n - mb[k] * mb[k])) > PLAT) plat = false;
        }
        if (!plat) continue;
        blocs.push({ x: (bx + BL / 2) / W, y: (by + BL / 2) / H,
            a: ma.map((v) => v / 255), b: mb.map((v) => v / 255) });
    }
}
console.log(`${blocs.length} blocs plats sur ${prefixe.split('/').pop()}`);

/* ---------- le masque ---------- */
const CY = 26, CX = 16;
function estimerMasque() {
    const cel = Array.from({ length: CY }, () => Array.from({ length: CX }, () => []));
    for (const o of blocs) {
        const yn = Yl(unlab(...complet(o.a))), yl = Yl(o.b);
        if (yn < 0.0015 || yl < 0.0015) continue;
        cel[Math.min(CY - 1, Math.floor(o.y * CY))][Math.min(CX - 1, Math.floor(o.x * CX))]
            .push(Math.log2(yl / yn));
    }
    const val = cel.map((r) => r.map((c) => (c.length < 6 ? null : med(c))));
    for (let it = 0; it < 8; it += 1) {
        for (let r = 0; r < CY; r += 1) for (let c = 0; c < CX; c += 1) if (val[r][c] === null) {
            const v = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
                .map(([p, q]) => val[p]?.[q]).filter((x) => x !== null && x !== undefined);
            if (v.length) val[r][c] = v.reduce((s, x) => s + x, 0) / v.length;
        }
    }
    /* lissage, puis plateau = 90e centile (la zone qu'il n'a pas masquee) */
    const liss = val.map((r, i) => r.map((_, j) => {
        let s = 0, n = 0;
        for (let p = -1; p <= 1; p += 1) for (let q = -1; q <= 1; q += 1) {
            const v = val[i + p]?.[j + q]; if (v !== null && v !== undefined) { s += v; n += 1; }
        }
        return n ? s / n : 0;
    }));
    const plat = [...liss.flat()].sort((a, b) => a - b);
    const plateau = plat[Math.floor(plat.length * 0.9)];
    return { liss, plateau };
}
const lireMasque = (m, x, y) => m.liss[Math.min(CY - 1, Math.floor(y * CY))][Math.min(CX - 1, Math.floor(x * CX))];

/* ---------- l'ajustement ----------
 *
 * SEUIL_MASQUE. La couleur ne s'ajuste QUE sur les blocs qu'on a peu corriges.
 * Rebrillanter de quatre diaphragmes un JPEG quasi noir ne restitue pas sa
 * couleur, ca fabrique du bruit amplifie — et le sol de cette photo, c'est
 * justement 4 diaphragmes. La courbe, elle, se cale sur les memes blocs: c'est
 * la zone dont on sait ce qu'elle mesure. */
const SEUIL_MASQUE = 1.0;
const NOIR = 2.4;
const courbeParam = (alpha, beta) => {
    const pied = Math.sqrt(Math.max(0, (2 * NOIR - beta) ** 2 - beta * beta));
    const t = [];
    for (let k = 0; k <= 20; k += 1) {
        const u = alpha * k * 5 + beta;
        t.push(Math.min(100, 0.5 * (u + Math.sqrt(u * u + pied * pied))));
    }
    return t;
};
const penteMini = (t) => { let m = 9; for (let k = 1; k <= 20; k += 1) m = Math.min(m, (t[k] - t[k - 1]) / 5); return m; };

let cible = blocs.map((o) => ({ ...o, c: lab(...o.b) }));
function score(pas = 1) {
    const d = [];
    for (let i = 0; i < cible.length; i += pas) {
        if (Math.abs(cible[i].retire) > SEUIL_MASQUE) continue;
        const o = complet(cible[i].a), c = cible[i].c;
        d.push(Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]));
    }
    return med(d);
}
function ajusteCourbe() {
    let best = null;
    for (let a = 0.60; a <= 1.201; a += 0.01) for (let b = -16; b <= 2.01; b += 0.5) {
        const t = courbeParam(a, b); if (penteMini(t) < 0.30) continue;
        const garde = COURBE; COURBE = t;
        const s = score(7); COURBE = garde;
        if (!best || s < best.s) best = { s, a, b, t };
    }
    COURBE = best.t.map((v) => +v.toFixed(2));
    return best;
}
function ajusteVirage() {
    const sa = Array.from({ length: 21 }, () => []), sb = Array.from({ length: 21 }, () => []);
    for (const o of cible) {
        if (Math.abs(o.retire) > SEUIL_MASQUE) continue;
        const t = tonalite(o.a); const [L, A2, B2] = lab(...t);
        if (Math.hypot(A2, B2) > 6) continue;
        const s = couleur(t); const k = Math.round(clamp01(L / 100) * 20);
        sa[k].push([o.c[1] - s[1], 1]); sb[k].push([o.c[2] - s[2], 1]);
    }
    const maj = (tab, seaux) => {
        const n = tab.slice();
        for (let k = 0; k <= 20; k += 1) if (seaux[k].length >= 12) n[k] = +(tab[k] + pond(seaux[k]) * 0.8).toFixed(2);
        const l = n.slice();
        for (let k = 1; k < 20; k += 1) l[k] = +((n[k - 1] + 2 * n[k] + n[k + 1]) / 4).toFixed(2);
        return l;
    };
    VA = maj(VA, sa); VB = maj(VB, sb);
}
function ajusteMelangeur() {
    ajusteMelangeur.compte = ajusteMelangeur.compte || Array(24).fill(0);
    const sec = Array.from({ length: 24 }, () => []); const cielPts = [];
    for (const o of cible) {
        if (Math.abs(o.retire) > SEUIL_MASQUE) continue;
        const t = tonalite(o.a); const [L, A2, B2] = lab(...t);
        const c = Math.hypot(A2, B2);
        if (c < 10 || L < 12 || o.c[0] < 12) continue;
        let h = Math.atan2(B2, A2) * 180 / Math.PI; if (h < 0) h += 360;
        const s = couleur(t);
        let dh = (Math.atan2(o.c[2], o.c[1]) - Math.atan2(s[2], s[1])) * 180 / Math.PI;
        if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
        const xc = Math.hypot(o.c[1], o.c[2]) / Math.max(1, Math.hypot(s[1], s[2]));
        if (bandeCiel(h) > 0.5) {
            let hs = Math.atan2(o.c[2], o.c[1]) * 180 / Math.PI; if (hs < 0) hs += 360;
            cielPts.push({ hs, xc }); continue;
        }
        if (bandeCiel(h) > 0.05) continue;
        sec[Math.round(((((h - 7.5) % 360) + 360) % 360) / 15) % 24].push({ dh, xc });
    }
    MEL = MEL.map((v, i) => {
        /* Un secteur qui ne tient qu'a quelques dizaines de blocs n'est pas
         * mesure: il garde la valeur du preset de reference. Sur cette photo
         * ca ecarte l'orange (44 blocs) et le jaune-vert (81). */
        const s = sec[i]; if (s.length < 150) return v;
        ajusteMelangeur.compte[i] = s.length;
        return [+(v[0] + med(s.map((e) => e.dh)) * 0.7).toFixed(2),
            +(v[1] * (1 + (med(s.map((e) => e.xc)) - 1) * 0.7)).toFixed(3)];
    });
    ajusteMelangeur.ciel = cielPts.length;
    if (cielPts.length >= 40) {
        CIEL = { cible: +med(cielPts.map((e) => e.hs)).toFixed(1),
            chroma: +(CIEL.chroma * med(cielPts.map((e) => e.xc))).toFixed(3) };
    }
}

let masque = null;
for (let tour = 1; tour <= 3; tour += 1) {
    masque = estimerMasque();
    /* on corrige SON rendu de l'ecart au plateau, en lumiere lineaire */
    cible = blocs.map((o) => {
        const retire = masque.plateau - lireMasque(masque, o.x, o.y);
        const corr = o.b.map((v) => clamp01(l2s(s2l(v) * 2 ** retire)));
        return { ...o, retire, c: lab(...corr) };
    });
    const c = ajusteCourbe(); ajusteVirage(); ajusteMelangeur();
    const gardes = cible.filter((o) => Math.abs(o.retire) <= SEUIL_MASQUE).length;
    console.log(`tour ${tour}: masque plateau ${masque.plateau.toFixed(2)} EV, `
        + `${gardes}/${cible.length} blocs peu masques, `
        + `courbe ${c.a.toFixed(2)} x L ${c.b >= 0 ? '+' : ''}${c.b.toFixed(1)}, `
        + `dE76 median sur la cible demasquee ${score(3).toFixed(2)}`);
}
console.log('\nCOURBE =', JSON.stringify(COURBE));
console.log('VA =', JSON.stringify(VA));
console.log('VB =', JSON.stringify(VB));
console.log('MEL =', JSON.stringify(MEL));
console.log('CIEL =', JSON.stringify(CIEL), ` (${ajusteMelangeur.ciel} blocs de ciel)`);
console.log('\nblocs par secteur du melangeur (teinte Lab):');
console.log('  ' + ajusteMelangeur.compte.map((n, i) => `${(i * 15 + 7.5)}:${n}`).filter((x) => !x.endsWith(':0')).join('  '));

/* ---------- l'ecart sur le CADRE ENTIER, masque compris ---------- */
{
    const d = [], dz = [];
    for (const o of blocs) {
        const s = complet(o.a), c = lab(...o.b);
        const e = Math.hypot(s[0] - c[0], s[1] - c[1], s[2] - c[2]);
        d.push(e);
        const m = masque.plateau - lireMasque(masque, o.x, o.y);
        if (Math.abs(m) <= SEUIL_MASQUE) dz.push(e);
    }
    console.log(`\ndE76 median CONTRE SON RENDU TEL QUEL (masque compris):`);
    console.log('  candidat        cadre entier   zone peu masquee');
    console.log(`  l'ajustement     ${med(d).toFixed(2).padStart(8)} ${med(dz).toFixed(2).padStart(15)}`);
    for (const id of ['powV2', 'powV3', 'powlishermain']) {
        const f = VISION_PRESET_BY_ID[id]?.transform; if (!f) continue;
        const e2 = [], ez2 = [];
        for (const o of blocs) {
            const s = lab(...f(o.a)), c = lab(...o.b);
            const e = Math.hypot(s[0] - c[0], s[1] - c[1], s[2] - c[2]);
            e2.push(e);
            if (Math.abs(masque.plateau - lireMasque(masque, o.x, o.y)) <= SEUIL_MASQUE) ez2.push(e);
        }
        console.log(`  ${id.padEnd(16)} ${med(e2).toFixed(2).padStart(7)} ${med(ez2).toFixed(2).padStart(15)}`);
    }
    console.log(`  (${dz.length} blocs peu masques sur ${blocs.length})`);
}

/* ---------- controle couleur, en clair ---------- */
console.log('\n--- controle: ce que devient chaque famille de couleur ---');
const familles = [
    ['ciel de nuit', [0.10, 0.12, 0.22]], ['ciel de jour', [0.35, 0.55, 0.85]],
    ['rouge de la moto', [0.80, 0.14, 0.13]], ['rouge sombre', [0.45, 0.08, 0.08]],
    ['beton mouille', [0.32, 0.30, 0.29]], ['gris moyen', [0.5, 0.5, 0.5]],
    ['blanc de la marquise', [0.85, 0.84, 0.80]], ['lampe', [0.98, 0.95, 0.85]],
];
const tsl = (rgb) => { const [r, g, b] = rgb; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d <= 0) return 0;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (((h * 60) % 360) + 360) % 360; };
const ref = VISION_PRESET_BY_ID.powV2.transform;
console.log('  famille                entree        powV4          powV2         teinte TSL');
for (const [nom, rgb] of familles) {
    const o = unlab(...complet(rgb)), p = ref(rgb);
    const c255 = (v) => v.map((x) => String(Math.round(x * 255)).padStart(3)).join(',');
    console.log(`  ${nom.padEnd(20)} ${c255(rgb)}  ${c255(o)}  ${c255(p)}   ${tsl(rgb).toFixed(0)} -> ${tsl(o).toFixed(0)}`);
}
