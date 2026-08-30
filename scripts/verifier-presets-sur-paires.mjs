/*
 * Confronte les presets a la seule verite terrain du projet: les trois paires
 * AVANT / APRES publiees par @powl_d (voir l'en-tete de `powlishermain` dans
 * visionPresets.js).
 *
 *   node scripts/verifier-presets-sur-paires.mjs <dossier-des-paires-alignees>
 *
 * DEUX tableaux, et il faut les deux.
 *
 *  - SANS exposition libre: le preset est applique tel quel. C'est ce qu'on voit
 *    dans l'app, et c'est le chiffre qui compte pour juger `powV2`.
 *  - AVEC exposition libre: chaque candidat recoit le gain lineaire qui
 *    minimise son ecart, et on ne compare plus que la COULEUR. Utile parce que
 *    ses trois retouches sont a -1,85, -0,22 et -0,56 EV — son curseur, pas un
 *    preset — et que sans ce reglage le classement mesurerait surtout qui
 *    assombrit.
 *
 * L'ecart est un dE76 median sur des blocs de 8x8 plats, pas sur des pixels: les
 * deux captures ont du bruit JPEG et l'une des trois est recadree.
 *
 * Le temoin `aucun` (exposition seule) est la mesure a battre: c'est tout ce que
 * le traitement fait de couleur.
 */

import { blocs } from './mesurer-paires-powlisher.mjs';
import { VISION_PRESET_BY_ID } from '../src/features/vibefx-studio/utils/visionPresets.js';

const dossier = process.argv[2];
if (!dossier) { console.error('usage: node scripts/verifier-presets-sur-paires.mjs <dossier>'); process.exit(1); }

const CANDIDATS = ['powV2', 'powV3', 'powV4', 'powV5', 'powV6', 'powV7', 'powV8', 'powV9', 'powV10', 'powV11', 'powV12', 'powlishermain', 'powlisher', 'powlisher-ciel', 'powlisher-cine', 'ambre'];
/* Une des trois paires est recadree puis reechantillonnee: ses blocs doivent
 * rester plats pour rester justes. Les deux autres sont alignees au pixel. */
const PLAT = { p1: 7, p2: 22, p3: 22 };

const s2l = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const l2s = (v) => { const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, c * 255)); };
const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
function lab(r, g, b) {
    const R = s2l(r), G = s2l(g), B = s2l(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const fx = fLab(X), fy = fLab(Y), fz = fLab(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const Ylin = (c) => 0.2126 * s2l(c[0]) + 0.7152 * s2l(c[1]) + 0.0722 * s2l(c[2]);
const med = (xs) => { const t = [...xs].sort((a, b) => a - b); return t.length ? t[t.length >> 1] : NaN; };

const paires = {};
for (const p of ['p1', 'p2', 'p3']) paires[p] = await blocs(`${dossier}/${p}`, PLAT[p]);

/* Ecart median d'un candidat sur une paire, exposition libre. */
/* Le degrade du bas ne vit pas dans la LUT: il depend de la LIGNE. On le rejoue
 * ici comme le moteur, sinon `powV6` et `powV7` seraient juges sur la moitie de
 * ce qu'ils font. La loi est dans `applyDegradeBas` (canvasUtils.js). */
function gainDegrade(y, force) {
    if (!force) return 1;
    const t = Math.max(0, Math.min(1, (y - 0.5) / 0.5));
    return 1 + (2 ** (-4 * Math.min(100, force) / 100) - 1) * (t * t * (3 - 2 * t));
}

function ecart(bl, fn, exposition, degrade = 0) {
    const sortie = bl.map(({ a, b, y }) => {
        let t = fn ? fn(a.map((v) => v / 255)).map((v) => v * 255) : a.slice();
        const g = gainDegrade(y, degrade);
        if (g !== 1) t = t.map((v) => l2s(s2l(v) * g));
        return { t, b };
    });
    const k = exposition
        ? med(sortie.filter(({ t, b }) => Ylin(t) > 0.002 && Ylin(b) > 0.002)
            .map(({ t, b }) => Ylin(b) / Ylin(t)))
        : 1;
    const dE = [];
    for (const { t, b } of sortie) {
        const A = lab(...t.map((v) => l2s(s2l(v) * k)));
        const B = lab(...b);
        dE.push(Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]));
    }
    return { k, dE: med(dE), n: dE.length };
}

for (const exposition of [false, true]) {
    console.log(exposition
        ? '\n\nAVEC exposition libre — la COULEUR seule (chaque candidat recoit le gain qui l\'arrange)'
        : 'SANS exposition libre — le preset applique tel quel, c\'est ce qu\'on voit dans l\'app');
    console.log('  (p1 station de nuit, p2 brouillard, p3 restaurant)\n');
    console.log(`preset            p1      p2      p3    moyenne${exposition ? '   expo libre (EV)' : ''}`);
    const lignes = [];
    for (const id of ['aucun', ...CANDIDATS]) {
        const fn = id === 'aucun' ? null : VISION_PRESET_BY_ID[id]?.transform;
        if (id !== 'aucun' && !fn) { console.log(`${id}: absent`); continue; }
        const deg = VISION_PRESET_BY_ID[id]?.spatialFilters?.degradeBas || 0;
        const r = ['p1', 'p2', 'p3'].map((p) => ecart(paires[p], fn, exposition, deg));
        const moy = r.reduce((s, x) => s + x.dE, 0) / 3;
        lignes.push([id, moy]);
        console.log(`${id.padEnd(16)}${r.map((x) => x.dE.toFixed(2).padStart(6)).join('  ')}   ${moy.toFixed(2).padStart(5)}    `
            + (exposition ? r.map((x) => Math.log2(x.k).toFixed(2).padStart(6)).join(' ') : ''));
    }
    lignes.sort((a, b) => a[1] - b[1]);
    console.log(`\nclassement: ${lignes.map(([id, m]) => `${id} ${m.toFixed(2)}`).join('  <  ')}`);
    const temoin = lignes.find(([id]) => id === 'aucun')[1];
    for (const id of ['powV2', 'powlishermain']) {
        const v = lignes.find(([x]) => x === id);
        if (v) console.log(`part de l'ecart reprise par ${id}: ${((1 - v[1] / temoin) * 100).toFixed(1)} %`);
    }
}
