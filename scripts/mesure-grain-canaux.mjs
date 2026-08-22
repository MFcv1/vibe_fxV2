/*
 * SON GRAIN, CANAL PAR CANAL — et le notre en face.
 *
 *   node scripts/mesure-grain-canaux.mjs \
 *     --reference <mire-A-exportee-SANS-RIEN.png> \
 *     --lightroom <mire-A-exportee-AVEC-GRAIN.png> \
 *     --valeur 50
 *
 * POURQUOI CET INSTRUMENT EXISTE
 *
 * `mesure-grain-lightroom.mjs` lit la LUMINANCE: un seul chiffre par carre.
 * C'est ce qu'il faut pour la force et pour la grosseur, mais ca cache
 * exactement la question qui restait ouverte — son grain est-il le meme sur les
 * trois canaux ?
 *
 * Ici on soustrait les deux exports PIXEL A PIXEL. La difference EST son champ
 * de grain: la mire est un aplat parfait, il n'y a rien d'autre dedans. On peut
 * donc lire trois choses qu'aucune moyenne ne donne:
 *
 *   - l'ecart-type de CHAQUE canal;
 *   - la CORRELATION entre canaux — 1,00 si c'est un seul bruit, 0,00 si c'est
 *     trois bruits tires separement. C'est elle qui a tranche;
 *   - la proportion de pixels ECRETES a 0 ou a 255, qui explique pourquoi deux
 *     canaux du meme carre ne portent pas le meme ecart-type.
 *
 * La colonne « nous » passe la mire de reference dans le VRAI etage de grain
 * (`grainField.js`, appele et non recopie), a la meme valeur de curseur.
 */

import path from 'node:path';
import sharp from 'sharp';
import {
    GRAIN_ATTENUATION,
    GRAIN_TAILLE_DEFAUT,
    grainEchelle,
    grainPoserDelta,
    grainSigma,
    grainValeurEn,
} from '../src/features/vibefx-studio/utils/grainField.js';

const args = process.argv.slice(2);
const readArg = (name, fallback = null) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : args[i + 1];
};
const referencePath = readArg('reference');
const lightroomPath = readArg('lightroom');
const valeur = Number(readArg('valeur', '50'));
const taille = Number(readArg('taille', String(GRAIN_TAILLE_DEFAUT)));

if (!referencePath || !lightroomPath) {
    console.error('\nUsage: node scripts/mesure-grain-canaux.mjs --reference <png> --lightroom <png> [--valeur 50]\n');
    process.exit(1);
}

// ── Geometrie de la mire A, recopiee de make-mire-effets.mjs ──────────────
const W = 1620;
const H = 1080;
const COLS = 6;
const ROWS = 4;
const SIZE = 220;
const GAP_X = Math.round((W - COLS * SIZE) / (COLS + 1));
const GAP_Y = Math.round((H - ROWS * SIZE) / (ROWS + 1));
const MARGE = 30;

const NOMS = [
    'gris 8', 'gris 24', 'gris 48', 'gris 72', 'gris 96', 'gris 112',
    'gris 128', 'gris 144', 'gris 168', 'gris 192', 'gris 224', 'gris 247',
    'rouge', 'vert', 'bleu', 'cyan', 'magenta', 'jaune',
    'peau claire', 'peau mate', 'ciel', 'feuillage', 'gris froid', 'beton',
];

const coeurDuCarre = (i) => ({
    x: GAP_X + (i % COLS) * (SIZE + GAP_X) + MARGE,
    y: GAP_Y + Math.floor(i / COLS) * (SIZE + GAP_Y) + MARGE,
    w: SIZE - 2 * MARGE,
    h: SIZE - 2 * MARGE,
});

async function lireRaw(file) {
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== W || info.height !== H) {
        console.error(
            `\nECHEC: ${path.basename(file)} fait ${info.width}x${info.height}, attendu ${W}x${H}.`
            + '\nReexporte depuis Lightroom en « Taille reelle », sans redimensionnement.\n',
        );
        process.exit(1);
    }
    return data;
}

/* Notre etage de grain, appele et non recopie. */
const PIXEL = new Float64Array(3);
function notreGrain(source) {
    const sortie = Buffer.from(source);
    const echelle = grainEchelle(taille, W);
    const sigma = grainSigma(valeur, taille, W);
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const i = (y * W + x) * 3;
            const luma = (sortie[i] * 77 + sortie[i + 1] * 150 + sortie[i + 2] * 29) >> 8;
            const delta = grainValeurEn(x, y, echelle) * sigma * GRAIN_ATTENUATION[luma];
            grainPoserDelta(sortie[i], sortie[i + 1], sortie[i + 2], delta, PIXEL);
            for (let c = 0; c < 3; c += 1) sortie[i + c] = Math.round(PIXEL[c]);
        }
    }
    return sortie;
}

/*
 * Statistiques du CHAMP DE GRAIN d'un carre: on soustrait la reference pixel a
 * pixel, donc rien a retirer en quadrature — la difference est le grain nu.
 */
function champ(ref, avec, zone) {
    const n = zone.w * zone.h;
    const s = [0, 0, 0];
    const ss = [0, 0, 0];
    const croise = [0, 0, 0]; // RG, RB, GB
    const ecrete = [0, 0, 0];
    for (let y = zone.y; y < zone.y + zone.h; y += 1) {
        for (let x = zone.x; x < zone.x + zone.w; x += 1) {
            const i = (y * W + x) * 3;
            const d0 = avec[i] - ref[i];
            const d1 = avec[i + 1] - ref[i + 1];
            const d2 = avec[i + 2] - ref[i + 2];
            s[0] += d0; s[1] += d1; s[2] += d2;
            ss[0] += d0 * d0; ss[1] += d1 * d1; ss[2] += d2 * d2;
            croise[0] += d0 * d1; croise[1] += d0 * d2; croise[2] += d1 * d2;
            for (let c = 0; c < 3; c += 1) {
                if (avec[i + c] === 0 || avec[i + c] === 255) ecrete[c] += 1;
            }
        }
    }
    const m = s.map((v) => v / n);
    const sigma = ss.map((v, c) => Math.sqrt(Math.max(0, v / n - m[c] * m[c])));
    const cov = [
        croise[0] / n - m[0] * m[1],
        croise[1] / n - m[0] * m[2],
        croise[2] / n - m[1] * m[2],
    ];
    const paires = [[0, 1], [0, 2], [1, 2]];
    const r = cov.map((v, k) => {
        const [a, b] = paires[k];
        return sigma[a] * sigma[b] > 0.01 ? v / (sigma[a] * sigma[b]) : NaN;
    });
    return { sigma, r, ecrete: ecrete.map((v) => (100 * v) / n) };
}

const refData = await lireRaw(referencePath);
const lrData = await lireRaw(lightroomPath);
const nousData = notreGrain(refData);

console.log(`\nMire A — champ de grain lu canal par canal, coeur de ${SIZE - 2 * MARGE} px par carre.`);
console.log(`Reference : ${referencePath}`);
console.log(`Lightroom : ${lightroomPath}  (Grain ${valeur}, Taille ${taille})`);
console.log('\nLe champ de grain = export AVEC moins export SANS, pixel a pixel.\n');

const num = (v, n = 6) => (Number.isFinite(v) ? v.toFixed(2) : '   —').padStart(n);
const pct = (v) => `${v.toFixed(1)}%`.padStart(6);

console.log(
    'carre         '
    + '  LIGHTROOM sigma RGB '
    + '   NOUS sigma RGB     '
    + ' ecart %           '
    + ' correlation R-G/R-B/G-B',
);
console.log('─'.repeat(112));

let pireGris = 0;
let pireCouleur = 0;
let pireCorrelation = 1;
const ecretes = [];

NOMS.forEach((nom, i) => {
    const zone = coeurDuCarre(i);
    const lr = champ(refData, lrData, zone);
    const nous = champ(refData, nousData, zone);
    const ecarts = lr.sigma.map((v, c) => (v > 0.05 ? (100 * (nous.sigma[c] / v - 1)) : NaN));
    const pire = Math.max(...ecarts.map((v) => (Number.isFinite(v) ? Math.abs(v) : 0)));
    if (nom.startsWith('gris ')) pireGris = Math.max(pireGris, pire);
    else pireCouleur = Math.max(pireCouleur, pire);
    lr.r.forEach((v) => { if (Number.isFinite(v)) pireCorrelation = Math.min(pireCorrelation, v); });
    lr.ecrete.forEach((v, c) => {
        if (v > 0.5) ecretes.push(`${nom} ${'RGB'[c]} : ${pct(v).trim()} chez lui, ${pct(nous.ecrete[c]).trim()} chez nous`);
    });
    console.log(
        nom.padEnd(14)
        + lr.sigma.map((v) => num(v)).join(' ') + '  '
        + nous.sigma.map((v) => num(v)).join(' ') + '  '
        + ecarts.map((v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}` : '  —').padStart(6)).join(' ') + '   '
        + lr.r.map((v) => num(v, 6)).join(' '),
    );
});

console.log('─'.repeat(112));
console.log(`\nEcart le pire sur les GRIS     : ${pireGris.toFixed(1)} %`);
console.log(`Ecart le pire sur les COULEURS : ${pireCouleur.toFixed(1)} %`);
console.log(`Correlation la plus basse chez Lightroom : ${pireCorrelation.toFixed(3)}`);
console.log(
    pireCorrelation > 0.9
        ? '  -> un seul bruit pour les trois canaux. Son grain EST monochrome.'
        : '  -> les canaux se decorrelent: son grain n\'est pas un bruit unique.',
);
if (ecretes.length) {
    console.log('\nCanaux qui ECRETENT (c\'est ce qui rend deux canaux du meme carre inegaux) :');
    ecretes.forEach((l) => console.log(`  ${l}`));
}
console.log('');
