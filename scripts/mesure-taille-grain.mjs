/*
 * De quelle TAILLE sont les grains de Lightroom — et des notres.
 *
 *   node scripts/mesure-taille-grain.mjs <mire-A-avec-grain.png> [...] \
 *     [--valeur 50]
 *
 * POURQUOI CETTE MESURE EXISTE, A COTE DE `mesure-grain-lightroom.mjs`
 *
 * L'autre script mesure la FORCE du grain (son ecart-type) et conclut que notre
 * echelle est celle de Lightroom: sigma = 0,367 x la valeur du curseur, a 15,
 * 50 et 100. C'est vrai, et ca ne suffit pas.
 *
 * Deux bruits de meme ecart-type ne se ressemblent pas s'ils n'ont pas la meme
 * GROSSEUR de grain. Le notre est tire pixel par pixel (`applyFilmGrain`): il
 * fait 1 pixel, toujours. Lightroom a un sous-reglage « Taille » (25 par
 * defaut, 40 sur CN17) qu'aucune mesure d'ecart-type ne voit passer.
 *
 * Constate le 2026-08-20 sur une vraie photo (CN14, grain 25, 9180 px de
 * large): son grain y pese 3,99/255 avec des grains d'environ 1,5 px, la ou
 * notre loi en poserait 9,2/255 en grains de 1 px. Deux choses s'y melangent —
 * la Taille de son curseur, et la RESOLUTION de l'image — d'ou les deux series
 * de mires que ce script sait lire.
 *
 * CE QU'IL MESURE, ET POURQUOI C'EST EXACT ICI
 *
 * La mire A porte 24 carres UNIS. Dans le coeur d'un carre, il n'y a rien
 * d'autre que du grain: le bruit est donc « pixel moins moyenne du carre »,
 * sans le moindre filtre. C'est important — sur une photo il faut soustraire un
 * flou pour enlever le contenu, et ce filtre mange une part du bruit qu'on
 * cherche justement a mesurer.
 *
 * De ce bruit exact on tire deux nombres:
 *
 *   - l'ECART-TYPE, comparable a 0,367 x la valeur du curseur;
 *   - l'AUTOCORRELATION a dx = 1, 2, 3... : la ressemblance entre un pixel et
 *     son voisin de droite. Du bruit blanc (le notre) donne 0. Un grain etale
 *     sur 3 px donne encore 0,5 a dx = 2.
 *
 * La « longueur de correlation » resume ces nombres: 1 + 2 x la somme des
 * autocorrelations. Elle vaut 1,0 pour du bruit d'un pixel — c'est la valeur
 * que rend notre moteur aujourd'hui — et grandit avec la grosseur du grain.
 *
 * LA GEOMETRIE EST DEDUITE, PAS SUPPOSEE
 *
 * La mire A fait 1620x1080. La meme mire agrandie x4 (6480x4320) sert a mesurer
 * l'effet de la RESOLUTION: le script lit l'echelle dans la largeur du fichier,
 * pour qu'une mire grand format ne demande aucun argument de plus.
 */

import sharp from 'sharp';
/*
 * Le moteur est APPELE, pas recopie. `grainField.js` n'importe rien, donc Node
 * le charge tel quel: la mesure et le rendu ne peuvent pas diverger.
 */
import {
    GRAIN_ATTENUATION,
    GRAIN_SIGMA_PAR_UNITE,
    grainEchelle,
    grainGrosseurCalibree,
    grainSigma,
    grainValeurEn,
} from '../src/features/vibefx-studio/utils/grainField.js';

const args = process.argv.slice(2);
const readArg = (name, fallback = null) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const valeur = Number(readArg('valeur', '50'));
const fichiers = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));

/*
 * Une entree « nous:<taille>:<largeur> » ne lit pas un fichier: elle fabrique un
 * aplat uni a cette largeur et y pose NOTRE grain. C'est la seule facon de
 * comparer les deux moteurs sur le meme instrument — et un aplat suffit,
 * puisque sur un uni tout ce qui varie est le grain.
 */
function notreMire(taille, largeur, valeurGrain) {
    const w = largeur;
    const h = Math.round((largeur * 2) / 3);
    const echelle = grainEchelle(taille, w);
    const grosseur = grainGrosseurCalibree(taille, w, echelle);
    const sigma = grainSigma(valeurGrain, taille, w);
    const data = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const delta = grainValeurEn(x, y, echelle, undefined, grosseur) * sigma * GRAIN_ATTENUATION[128];
            const v = Math.max(0, Math.min(255, Math.round(128 + delta)));
            const i = (y * w + x) * 3;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
        }
    }
    return { data, w, h, canaux: 3 };
}

if (!fichiers.length) {
    console.error(`
Usage: node scripts/mesure-taille-grain.mjs <mire-A-avec-grain.png> [...] [--valeur 50]

Passe autant de mires que tu veux comparer — une par valeur de « Taille »
relevee dans Lightroom. La mire de reference SANS grain peut etre passee aussi:
elle doit sortir a un ecart-type proche de 0.

Pour mesurer NOTRE grain sur le meme instrument, passe « nous:<taille>:<largeur> »
a la place d'un fichier. Exemple, la serie complete face a Lightroom:

  node scripts/mesure-taille-grain.mjs \\
    <taille-25/mire.png> nous:25:1620 nous:25:6480 --valeur 50
`);
    process.exit(1);
}

/* Geometrie de la mire A, a l'echelle 1. */
const W0 = 1620;
const H0 = 1080;
const COLS = 6;
const ROWS = 4;
const SIZE0 = 220;
const MARGE0 = 30; // on ne lit que le coeur: les effets spatiaux bavent au bord

const LUMA = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const DECALAGES = [1, 2, 3, 4, 5, 6];

async function lire(file) {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height, canaux: info.channels };
}

/* Le coeur du carre `index`, a l'echelle de CETTE mire. */
function coeur(index, echelle) {
    /* La geometrie est recalculee EXACTEMENT comme `make-mire-largeur.mjs` la
       dessine — carre arrondi d'abord, ecarts deduits ensuite — sinon les deux
       arrondis divergent d'un pixel ou deux sur une mire reduite. */
    const W = Math.round(W0 * echelle);
    const H = Math.round(H0 * echelle);
    const size = Math.round(SIZE0 * echelle);
    const gapX = Math.round((W - COLS * size) / (COLS + 1));
    const gapY = Math.round((H - ROWS * size) / (ROWS + 1));
    const marge = MARGE0 * echelle;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    return {
        x: gapX + col * (size + gapX) + marge,
        y: gapY + row * (size + gapY) + marge,
        w: size - 2 * marge,
        h: size - 2 * marge,
    };
}

/* Bruit d'un carre uni: pixel moins moyenne du carre. Aucun filtre — sur un
   aplat il n'y a rien d'autre a enlever, et un filtre mangerait le bruit. */
function bruitDuCarre({ data, w, canaux }, zone) {
    const n = zone.w * zone.h;
    const vals = new Float64Array(n);
    let somme = 0;
    for (let y = 0; y < zone.h; y += 1) {
        for (let x = 0; x < zone.w; x += 1) {
            const i = ((zone.y + y) * w + zone.x + x) * canaux;
            const v = LUMA(data[i], data[i + 1], data[i + 2]);
            vals[y * zone.w + x] = v;
            somme += v;
        }
    }
    const moyenne = somme / n;
    for (let i = 0; i < n; i += 1) vals[i] -= moyenne;
    /* L'ecart entre canaux au centre du carre: il dit si l'aplat est gris ou
       colore. Lightroom pose un grain PLUS FORT sur les couleurs saturees
       (22 a 23/255 sur le rouge, le vert, le bleu, contre 18,5 sur les gris,
       mesure du 2026-08-20), la ou le notre est monochrome. Melanger les deux
       dans une moyenne fait croire a un ecart de force qui n'en est pas un. */
    const c = ((zone.y + (zone.h >> 1)) * w + zone.x + (zone.w >> 1)) * canaux;
    const chroma = Math.max(data[c], data[c + 1], data[c + 2])
        - Math.min(data[c], data[c + 1], data[c + 2]);
    return { vals, moyenne, chroma, largeur: zone.w, hauteur: zone.h };
}

function ecartType({ vals }) {
    let s = 0;
    for (let i = 0; i < vals.length; i += 1) s += vals[i] * vals[i];
    return Math.sqrt(s / vals.length);
}

/* Autocorrelation horizontale a `dx`, normalisee: 0 = bruit d'un pixel. */
function autocorrelation({ vals, largeur, hauteur }, dx) {
    let sxy = 0;
    let sxx = 0;
    for (let y = 0; y < hauteur; y += 1) {
        for (let x = 0; x < largeur - dx; x += 1) {
            const a = vals[y * largeur + x];
            sxy += a * vals[y * largeur + x + dx];
            sxx += a * a;
        }
    }
    return sxx > 0 ? sxy / sxx : 0;
}

const num = (v, n = 6, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '  —').padStart(n);
const pad = (s, n) => String(s).padEnd(n);

console.log(`
Mire A — 24 aplats unis. Le bruit lu est « pixel moins moyenne du carre »,
sans aucun filtre: sur un aplat, tout ce qui varie EST le grain.

Notre moteur, pour comparaison: ecart-type ${(GRAIN_SIGMA_PAR_UNITE * valeur).toFixed(2)}/255 a Grain ${valeur},
longueur de correlation 1,00 (un bruit tire pixel par pixel).
`);

console.log(`${pad('mire', 34)}${pad('taille img', 12)}${pad('ecart-type', 12)}${pad('autocorr dx=1..6', 40)}longueur`);
console.log('─'.repeat(108));

for (const entree of fichiers) {
    const synthetique = entree.startsWith('nous:');
    let img;
    let etiquette;
    let zones;

    if (synthetique) {
        /* « nous:<taille>:<largeur> » — notre propre grain, pose par le moteur. */
        const [, taille, largeur] = entree.split(':').map(Number);
        img = notreMire(taille, largeur || W0, valeur);
        etiquette = `NOUS  Taille ${taille}`;
        /* Un seul aplat, donc une seule zone: le coeur de l'image. */
        const cote = Math.min(img.w, img.h) - 20;
        zones = [{ x: 10, y: 10, w: cote, h: cote }];
    } else {
        img = await lire(entree);
        etiquette = entree.split('/').pop().slice(0, 32);
        /* Le facteur n'a plus a etre entier: `make-mire-largeur.mjs` dessine la
           mire A a n'importe quelle taille, et c'est ce qu'il faut pour
           mesurer EN DESSOUS de 1620 px (un export social fait 1080). La
           tolerance d'un pixel absorbe les arrondis de la geometrie. */
        const facteur = img.w / W0;
        if (Math.abs(img.h - H0 * facteur) > 1) {
            console.log(`${pad(etiquette, 34)}IGNOREE — ${img.w}x${img.h} n'a pas les proportions de la mire A (3:2).`);
            continue;
        }
        zones = Array.from({ length: COLS * ROWS }, (_, i) => coeur(i, facteur));
    }

    /* On moyenne sur les carres retenus: chacun donne la meme mesure, et la
       moyenne ecarte le hasard d'un carre particulier. */
    let sommeSigma = 0;
    let compte = 0;
    const sommeCorr = new Float64Array(DECALAGES.length);
    for (const zone of zones) {
        const b = bruitDuCarre(img, zone);
        /* Les deux extremes sont ECARTES: la gaussienne y est ecretee contre 0
           et 255, ce qui rabote l'ecart-type sans rien dire du grain. Les
           carres COLORES aussi, pour la raison dite dans `bruitDuCarre`. */
        if (b.moyenne < 40 || b.moyenne > 215) continue;
        if (b.chroma > 12) continue;
        sommeSigma += ecartType(b);
        DECALAGES.forEach((dx, k) => { sommeCorr[k] += autocorrelation(b, dx); });
        compte += 1;
    }
    const sigma = sommeSigma / compte;
    const corr = DECALAGES.map((_, k) => sommeCorr[k] / compte);

    /* Sous 0,05/255 il n'y a pas de grain a mesurer: l'autocorrelation d'un
       aplat parfaitement uni divise du bruit d'arrondi par du bruit d'arrondi
       et sort un nombre stable qui ne veut RIEN dire (0,60 sur la mire
       generee, dont l'ecart-type vaut 2,5e-11). On le dit au lieu de
       l'afficher. */
    if (sigma < 0.05) {
        console.log(
            `${pad(etiquette, 34)}${pad(`${img.w}x${img.h}`, 12)}`
            + `${num(sigma, 10)}  aucun grain mesurable (mire sans grain ?)`,
        );
        continue;
    }

    /* Longueur de correlation integrale: 1 pour du bruit d'un pixel, et elle
       grandit comme la grosseur du grain. */
    const longueur = 1 + 2 * corr.reduce((somme, v) => somme + Math.max(0, v), 0);

    console.log(
        `${pad(etiquette, 34)}${pad(`${img.w}x${img.h}`, 12)}`
        + `${num(sigma, 10)}  `
        + `${pad(corr.map((v) => num(v, 5, 2)).join(' '), 40)}`
        + `${num(longueur, 7)}`,
    );
}

console.log(`
COMMENT LIRE

  ecart-type          la FORCE du grain, en /255. A comparer a ${(GRAIN_SIGMA_PAR_UNITE * valeur).toFixed(2)} (nous, a Grain ${valeur}).
  autocorr dx=1..6    la ressemblance d'un pixel avec son voisin a 1, 2... px.
                      Notre grain donne 0,00 partout: il fait UN pixel.
  longueur            1,00 = grain d'un pixel. 2,00 = grains deux fois plus gros.

Un grain plus gros a le meme ecart-type SEULEMENT s'il est aussi plus contraste;
si l'ecart-type baisse quand la longueur monte, c'est que Lightroom etale la
meme quantite de grain sur plus de pixels — c'est ce qu'il faut reproduire.
`);
