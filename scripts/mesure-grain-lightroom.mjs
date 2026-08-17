/*
 * Combien vaut vraiment le grain de Lightroom, et combien vaut le notre.
 *
 *   node scripts/mesure-grain-lightroom.mjs \
 *     --reference <mire-A-exportee-sans-rien.png> \
 *     --lightroom <mire-A-exportee-avec-grain.png> \
 *     --valeur 15 \
 *     [--planche <sortie.png>]
 *
 * POURQUOI CETTE MESURE EXISTE
 *
 * Le chiffre « le grain de Lightroom est 8x plus fort que le notre a valeur
 * egale » vient d'une mesure faite sur la mire HALD, dont les pastilles font
 * 4x4 pixels de couleurs sans aucun rapport entre voisines. Dans un carre
 * aussi petit, la bavure entre voisins se melange au grain et le gonfle. Le
 * chiffre etait donc suspect, et le doute etait justifie.
 *
 * Ici la mire A porte des carres de 220x220 UNIS. A l'interieur du coeur d'un
 * tel carre, il n'y a rien d'autre que du grain: l'ecart-type EST le grain.
 *
 * DEUX PRECAUTIONS DE MESURE
 *
 * 1. On lit le COEUR des carres (marge de 30 px), jamais leurs bords: tout
 *    effet spatial bave sur quelques pixels au bord d'un aplat.
 * 2. Le bruit s'ajoute EN QUADRATURE. Le grain seul vaut
 *    sqrt(total^2 - base^2), jamais la difference brute des ecarts-types.
 *
 * NOTRE COTE: une reproduction fidele, en Node, de l'etage Grain du renderer
 * (`studioRenderer.js`, etage 8) — mire de bruit gaussienne 512x512 d'ecart-type
 * 50 autour de 128, opaque, repetee, posee en fusion `overlay` avec un
 * `globalAlpha` de (grain / 100) * 0,28. La formule `overlay` est celle du
 * canvas. Elle est reproduite ici et non appelee, parce que le renderer est du
 * code navigateur; toute divergence future serait un ecart a corriger.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
/*
 * Le coefficient est LU dans le moteur, jamais recopie ici: sinon la mesure et
 * le rendu pourraient diverger sans que rien ne le signale.
 *
 * Il est lu dans le TEXTE du module et non importe, parce que `canvasUtils.js`
 * est du code navigateur dont les imports n'ont pas d'extension: Node refuse de
 * le charger. Lire la source est laid mais fiable — si la constante disparait,
 * le script s'arrete au lieu de mesurer avec une valeur perimee.
 */
const CANVAS_UTILS = 'src/features/vibefx-studio/utils/canvasUtils.js';
const SOURCE_MOTEUR = fs.readFileSync(CANVAS_UTILS, 'utf8');
const constanteDuMoteur = (nom) => {
    const trouve = SOURCE_MOTEUR.match(new RegExp(`${nom}\\s*=\\s*([0-9.]+)`));
    if (!trouve) {
        console.error(`\nECHEC: ${nom} introuvable dans ${CANVAS_UTILS}.\n`);
        process.exit(1);
    }
    return Number(trouve[1]);
};
const GRAIN_SIGMA_PAR_UNITE = constanteDuMoteur('GRAIN_SIGMA_PAR_UNITE');
const GRAIN_BORD = constanteDuMoteur('GRAIN_BORD');
const GRAIN_BORD_EXPOSANT = constanteDuMoteur('GRAIN_BORD_EXPOSANT');

const ATTENUATION = (() => {
    const table = new Float32Array(256);
    for (let v = 0; v < 256; v += 1) {
        const distance = Math.min(v, 255 - v);
        table[v] = distance >= GRAIN_BORD ? 1 : (distance / GRAIN_BORD) ** GRAIN_BORD_EXPOSANT;
    }
    return table;
})();

const args = process.argv.slice(2);
const readArg = (name, fallback = null) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : args[i + 1];
};

const referencePath = readArg('reference');
const lightroomPath = readArg('lightroom');
const valeur = Number(readArg('valeur', '15'));
const planchePath = readArg('planche');

if (!referencePath || !lightroomPath) {
    console.error(
        '\nUsage: node scripts/mesure-grain-lightroom.mjs --reference <png> --lightroom <png>'
        + ' [--valeur 15] [--planche <sortie.png>]\n',
    );
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
const MARGE = 30; // on ne lit que le coeur: 160x160 par carre

const NOMS = [
    'gris 8', 'gris 24', 'gris 48', 'gris 72', 'gris 96', 'gris 112',
    'gris 128', 'gris 144', 'gris 168', 'gris 192', 'gris 224', 'gris 247',
    'rouge', 'vert', 'bleu', 'cyan', 'magenta', 'jaune',
    'peau claire', 'peau mate', 'ciel', 'feuillage', 'gris froid', 'beton',
];

function coeurDuCarre(index) {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    return {
        x: GAP_X + col * (SIZE + GAP_X) + MARGE,
        y: GAP_Y + row * (SIZE + GAP_Y) + MARGE,
        w: SIZE - 2 * MARGE,
        h: SIZE - 2 * MARGE,
    };
}

const LUMA = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/* Moyenne et ecart-type de la luminance dans une zone. */
function statsZone(data, zone) {
    let somme = 0;
    let sommeCarres = 0;
    let n = 0;
    for (let y = zone.y; y < zone.y + zone.h; y += 1) {
        for (let x = zone.x; x < zone.x + zone.w; x += 1) {
            const i = (y * W + x) * 3;
            const l = LUMA(data[i], data[i + 1], data[i + 2]);
            somme += l;
            sommeCarres += l * l;
            n += 1;
        }
    }
    const moyenne = somme / n;
    const variance = Math.max(0, sommeCarres / n - moyenne * moyenne);
    return { moyenne, ecartType: Math.sqrt(variance) };
}

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

// ── Notre moteur, etage Grain, reproduit ──────────────────────────────────
function mireDeBruit(taille = 512, graine = 20260815) {
    // PRNG deterministe (mulberry32) : la mesure doit etre rejouable.
    let a = graine >>> 0;
    const random = () => {
        a += 0x6d2b79f5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Ecarts gaussiens centres, d'ecart-type 1: c'est la forme que prend la
    // table du moteur (`GRAIN_NOISE_TABLE`), mise a l'echelle a l'usage.
    const buf = new Float32Array(taille * taille);
    for (let i = 0; i < buf.length; i += 1) {
        const u1 = random() || 0.0001;
        const u2 = random();
        buf[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    return { buf, taille };
}

function notreGrain(source, grain) {
    const sortie = Buffer.from(source);
    if (!grain) return sortie;
    const sigma = GRAIN_SIGMA_PAR_UNITE * grain;
    const { buf, taille } = mireDeBruit();
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const i = (y * W + x) * 3;
            const luma = (sortie[i] * 77 + sortie[i + 1] * 150 + sortie[i + 2] * 29) >> 8;
            // Le meme ecart sur les trois canaux : le grain est monochrome.
            const delta = buf[(y % taille) * taille + (x % taille)] * sigma * ATTENUATION[luma];
            for (let c = 0; c < 3; c += 1) {
                sortie[i + c] = Math.max(0, Math.min(255, Math.round(sortie[i + c] + delta)));
            }
        }
    }
    return sortie;
}

/*
 * L'ANCIEN etage, garde pour pouvoir montrer ce qui a change: bruit pose en
 * fusion `overlay`, qui s'eteint quand le pixel approche 0 ou 255.
 */
function ancienGrain(source, grain) {
    const sortie = Buffer.from(source);
    if (!grain) return sortie;
    const alpha = (grain / 100) * 0.28;
    const { buf, taille } = mireDeBruit();
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const s = Math.max(0, Math.min(255, Math.round(128 + buf[(y % taille) * taille + (x % taille)] * 50))) / 255;
            const i = (y * W + x) * 3;
            for (let c = 0; c < 3; c += 1) {
                const b = sortie[i + c] / 255;
                const overlay = b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
                const out = b * (1 - alpha) + overlay * alpha;
                sortie[i + c] = Math.max(0, Math.min(255, Math.round(out * 255)));
            }
        }
    }
    return sortie;
}

/* Le grain seul: le bruit s'ajoute en quadrature, jamais en soustraction brute. */
const grainSeul = (total, base) => Math.sqrt(Math.max(0, total * total - base * base));

// ── Mesure ────────────────────────────────────────────────────────────────
const refData = await lireRaw(referencePath);
const lrData = await lireRaw(lightroomPath);
const nousData = notreGrain(refData, valeur);
const ancienData = ancienGrain(refData, valeur);

console.log(`\nMire A — 24 aplats unis, coeur de ${SIZE - 2 * MARGE}x${SIZE - 2 * MARGE} px lu par carre.`);
console.log(`Reference : ${referencePath}`);
console.log(`Lightroom : ${lightroomPath}  (Grain ${valeur})`);
console.log(`Nous      : moteur reproduit  (Grain ${valeur})\n`);

const lignes = [];
let sommeLr = 0;
let sommeNous = 0;
let sommeEcartMoyenne = 0;

for (let i = 0; i < NOMS.length; i += 1) {
    const zone = coeurDuCarre(i);
    const ref = statsZone(refData, zone);
    const lr = statsZone(lrData, zone);
    const nous = statsZone(nousData, zone);
    const ancien = statsZone(ancienData, zone);
    const gLr = grainSeul(lr.ecartType, ref.ecartType);
    const gNous = grainSeul(nous.ecartType, ref.ecartType);
    sommeLr += gLr;
    sommeNous += gNous;
    sommeEcartMoyenne += Math.abs(lr.moyenne - ref.moyenne);
    lignes.push({
        nom: NOMS[i],
        niveau: ref.moyenne,
        base: ref.ecartType,
        lr: gLr,
        nous: gNous,
        ancien: grainSeul(ancien.ecartType, ref.ecartType),
        rapport: gNous > 0.01 ? gLr / gNous : Infinity,
    });
}

const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 6) => (Number.isFinite(v) ? v.toFixed(2) : '  —').padStart(n);

console.log(`${pad('carre', 14)}${pad('niveau', 8)}${pad('base', 8)}${pad('LIGHTROOM', 11)}${pad('NOUS', 8)}rapport`);
console.log('─'.repeat(60));
lignes.forEach((l) => {
    console.log(
        pad(l.nom, 14)
        + num(l.niveau, 6) + '  '
        + num(l.base, 6) + '  '
        + num(l.lr, 7) + '    '
        + num(l.nous, 6) + '  '
        + (Number.isFinite(l.rapport) ? `x${l.rapport.toFixed(2)}` : '  —'),
    );
});

const moyLr = sommeLr / lignes.length;
const moyNous = sommeNous / lignes.length;
console.log('─'.repeat(60));
console.log(
    pad('MOYENNE', 14) + '        ' + '        '
    + num(moyLr, 7) + '    ' + num(moyNous, 6) + '  '
    + `x${(moyLr / moyNous).toFixed(2)}`,
);

/*
 * Le carre le plus parlant est le ton moyen: c'est la que les deux moteurs sont
 * le plus actifs, et c'est la matiere d'une photo ordinaire.
 */
const tonMoyen = lignes[6];
console.log(
    `\nSur le ton moyen (gris 128) : Lightroom ${tonMoyen.lr.toFixed(2)}/255,`
    + ` nous ${tonMoyen.nous.toFixed(2)}/255 — rapport x${tonMoyen.rapport.toFixed(2)}.`,
);

const deriveMoyenne = sommeEcartMoyenne / lignes.length;
console.log(
    `Derive de niveau introduite par le grain de Lightroom : ${deriveMoyenne.toFixed(2)}/255`
    + ' (elle doit rester petite: le grain ne doit pas eclaircir ni assombrir).',
);

// ── La planche a regarder ─────────────────────────────────────────────────
if (planchePath) {
    /*
     * Un chiffre ne dit pas si le grain SE VOIT. On extrait donc, a l'echelle
     * 1:1 et sans aucun redimensionnement (qui moyennerait le grain et
     * mentirait), le meme morceau de ton moyen des trois versions.
     */
    const zone = coeurDuCarre(6);
    const cote = 160;
    const extraire = async (data) => sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 3 } })
        .extract({ left: zone.x, top: zone.y, width: cote, height: cote })
        .raw()
        .toBuffer();

    const vignettes = [
        ['SANS RIEN', await extraire(refData)],
        [`LIGHTROOM ${valeur}`, await extraire(lrData)],
        [`NOUS ${valeur}`, await extraire(nousData)],
    ];

    const marge = 16;
    const hauteurTexte = 28;
    const largeur = vignettes.length * cote + (vignettes.length + 1) * marge;
    const hauteur = cote + 2 * marge + hauteurTexte;

    const composites = vignettes.map(([, buf], index) => ({
        input: buf,
        raw: { width: cote, height: cote, channels: 3 },
        left: marge + index * (cote + marge),
        top: marge + hauteurTexte,
    }));

    const etiquettes = vignettes
        .map(([nom], index) => {
            const x = marge + index * (cote + marge);
            return `<text x="${x}" y="${hauteurTexte - 8}" font-family="monospace" font-size="16" fill="#fff">${nom}</text>`;
        })
        .join('');
    composites.unshift({
        input: Buffer.from(
            `<svg width="${largeur}" height="${hauteur}">${etiquettes}</svg>`,
        ),
        left: 0,
        top: 0,
    });

    await sharp({
        create: {
            width: largeur, height: hauteur, channels: 3, background: { r: 24, g: 24, b: 24 },
        },
    })
        .composite(composites)
        .png()
        .toFile(planchePath);

    fs.mkdirSync(path.dirname(planchePath), { recursive: true });
    console.log(`\nPlanche a regarder (1:1, aucun redimensionnement) : ${planchePath}`);
}

console.log('');
