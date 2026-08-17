/*
 * Les mires d'EFFETS — celles qui servent a mesurer ce qu'une Hald CLUT ne peut
 * pas capturer.
 *
 *   node scripts/make-mire-effets.mjs [dossier]
 *
 * A NE PAS CONFONDRE avec `make-hald-clut.mjs`. La Hald capture la COULEUR: une
 * fois chaque couleur, un pixel ne regarde jamais ses voisins. Ces mires-ci
 * capturent l'inverse: tout ce qui depend des pixels VOISINS (grain, clarte,
 * texture, nettete) ou de la POSITION dans l'image (vignetage). Une Hald y est
 * aveugle par construction.
 *
 * POURQUOI QUATRE MIRES ET PAS UNE
 *
 * Chaque effet a besoin d'un fond qui le rend LISIBLE, et ces fonds
 * s'excluent:
 *   - le grain ne se mesure que sur un aplat parfaitement uni (toute variation
 *     a l'interieur d'un carre EST le grain, il n'y a rien d'autre);
 *   - le vignetage ne se mesure que sur une image pleine et unie, sinon on ne
 *     sait pas si un pixel sombre l'est a cause du coin ou du motif;
 *   - la clarte / texture / nettete ne se mesurent que sur des BORDS, donc sur
 *     tout le contraire d'un aplat;
 *   - le voile ne se mesure que sur une image deja delavee.
 *
 * POURQUOI 1620x1080
 *
 * C'est l'ordre de grandeur d'une image PUBLIEE. Le grain et la nettete sont
 * des effets qui dependent de la RESOLUTION: le meme reglage sur une image de
 * 6000 px et sur la meme reduite a 1080 ne donne pas le meme rendu visible
 * (reduire une image MOYENNE son grain). Calibrer a la taille ou l'on publie
 * evite d'etalonner sur une taille qu'on n'utilise jamais.
 * Corollaire cote Lightroom: exporter en « Taille reelle », JAMAIS redimensionne.
 *
 * POURQUOI DES CARRES LARGES AVEC DES MARGES
 *
 * Les effets spatiaux bavent sur quelques pixels au bord d'un aplat. On mesure
 * donc le COEUR du carre (voir le script de mesure), et il faut de la marge
 * pour que ce coeur soit intact.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const outputDir = process.argv[2] || 'presets-lightroom/mires-effets';

const W = 1620;
const H = 1080;

fs.mkdirSync(outputDir, { recursive: true });

function newBuffer(fill = 0) {
    return Buffer.alloc(W * H * 3, fill);
}

function setPixel(buf, x, y, r, g, b) {
    const i = (y * W + x) * 3;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
}

function fillRect(buf, x0, y0, w, h, [r, g, b]) {
    for (let y = y0; y < y0 + h; y += 1) {
        if (y < 0 || y >= H) continue;
        for (let x = x0; x < x0 + w; x += 1) {
            if (x < 0 || x >= W) continue;
            setPixel(buf, x, y, r, g, b);
        }
    }
}

async function writePng(name, buf) {
    const file = path.join(outputDir, name);
    await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
        .png({ compressionLevel: 9 })
        .toFile(file);
    console.log(`  ${file}`);
}

/* ─────────────────────────────────────────────────────────────
 * MIRE A — APLATS. Pour le GRAIN.
 *
 * 24 carres de 220x220 parfaitement unis. Sur un aplat uni, l'ecart-type
 * mesure a l'interieur du carre EST le grain, sans rien a soustraire.
 *
 * Les niveaux vont du noir au blanc parce que le grain de Lightroom N'EST PAS
 * uniforme en luminance: il est plus fort dans les tons moyens et s'efface
 * dans les hautes lumieres. Un seul gris moyen donnerait un seul chiffre, et
 * on recopierait une courbe par son unique point du milieu.
 *
 * Les carres colores sont la pour repondre a une deuxieme question: le grain
 * est-il pose sur la luminance seule, ou sur les trois canaux separement ?
 * (On le lit en comparant l'ecart-type par canal sur un rouge sature.)
 * ───────────────────────────────────────────────────────────── */
async function mireAplats() {
    // Fond a 100 et non a 128: un carre a 128 se confondrait avec lui, et on
    // croirait la mire trouee. La mesure lit des coordonnees, pas des contours.
    const buf = newBuffer(100);
    const cols = 6;
    const rows = 4;
    const size = 220;
    const gapX = Math.round((W - cols * size) / (cols + 1));
    const gapY = Math.round((H - rows * size) / (rows + 1));

    const patches = [
        // Rangee 1-2 : l'echelle des gris, du noir au blanc.
        [8, 8, 8], [24, 24, 24], [48, 48, 48], [72, 72, 72], [96, 96, 96], [112, 112, 112],
        [128, 128, 128], [144, 144, 144], [168, 168, 168], [192, 192, 192], [224, 224, 224], [247, 247, 247],
        // Rangee 3 : couleurs saturees (grain par canal ?).
        [200, 40, 40], [40, 170, 60], [40, 70, 200], [40, 190, 200], [200, 50, 190], [220, 200, 40],
        // Rangee 4 : les couleurs qui comptent vraiment sur une photo.
        [222, 176, 148], // peau claire
        [166, 120, 94], // peau mate
        [92, 140, 186], // ciel
        [58, 96, 62], // feuillage
        [150, 150, 152], // gris neutre legerement froid
        [176, 168, 150], // beton / sable
    ];

    patches.forEach((color, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = gapX + col * (size + gapX);
        const y = gapY + row * (size + gapY);
        fillRect(buf, x, y, size, size, color);
    });

    await writePng('mire-A-aplats.png', buf);
}

/* ─────────────────────────────────────────────────────────────
 * MIRE B — BANDES UNIES PLEIN CADRE. Pour le VIGNETAGE.
 *
 * Le vignetage depend de la POSITION: il assombrit en s'eloignant du centre.
 * Il lui faut donc une image pleine et unie, sinon on ne sait jamais si un
 * pixel est sombre a cause du coin ou a cause du motif.
 *
 * Trois bandes horizontales (64, 128, 192) plutot qu'un gris unique, pour
 * repondre a la question qui change tout dans le code: le vignetage
 * MULTIPLIE-t-il la valeur du pixel (une bande claire perd alors beaucoup plus
 * qu'une bande sombre) ou SOUSTRAIT-il une constante ? Notre moteur, lui,
 * multiplie (`globalCompositeOperation = 'multiply'`).
 *
 * Chaque bande traverse toute la largeur: a un rayon donne, on dispose de
 * centaines de pixels a des angles differents — de quoi lire aussi la FORME
 * (cercle ou ellipse suivant le cadre).
 * ───────────────────────────────────────────────────────────── */
async function mireVignette() {
    const buf = newBuffer(128);
    const bandes = [64, 128, 192];
    const bandH = Math.round(H / bandes.length);
    bandes.forEach((v, index) => {
        const y = index * bandH;
        const h = index === bandes.length - 1 ? H - y : bandH;
        fillRect(buf, 0, y, W, h, [v, v, v]);
    });
    await writePng('mire-B-vignette.png', buf);
}

/* ─────────────────────────────────────────────────────────────
 * MIRE C — BORDS ET RESEAUX. Pour CLARTE, TEXTURE, NETTETE.
 *
 * Ces trois-la sont le MEME geste — accentuer un ecart local — a trois
 * echelles differentes, et c'est exactement ce qui les distingue:
 *   - la nettete travaille sur un rayon de ~1 px : elle ne mord que sur les
 *     details les plus fins;
 *   - la texture sur quelques pixels;
 *   - la clarte sur des dizaines de pixels : elle ne touche presque pas un
 *     detail fin, mais creuse les grands volumes.
 *
 * Six zones de 540x540, du plus fin au plus large, pour que la mesure separe
 * les trois au lieu de les confondre:
 *   1. barres 40 px, contraste maximal    -> nettete + texture
 *   2. barres 40 px, faible contraste      -> les effets sont-ils proportionnels
 *                                             au contraste local ou plafonnes ?
 *   3. bord doux etale sur 120 px          -> le halo de la CLARTE se voit ici,
 *                                             et nulle part ailleurs
 *   4. reseau sinusoidal periode 8 px      -> nettete
 *   5. reseau sinusoidal periode 24 px     -> texture
 *   6. reseau sinusoidal periode 64 px     -> clarte
 *
 * Un reseau sinusoidal plutot que des barres nettes pour les trois derniers:
 * une barre nette contient TOUTES les frequences a la fois (c'est ce que dit
 * sa decomposition de Fourier), donc elle ne separe rien. Un sinus n'en
 * contient qu'une seule: l'amplification lue est celle de CETTE echelle-la.
 * ───────────────────────────────────────────────────────────── */
async function mireDetails() {
    const buf = newBuffer(128);
    const zone = 540;

    const zoneAt = (col, row) => ({ x0: col * zone, y0: row * zone });

    // Zone 1 — barres verticales 40 px, noir / blanc.
    {
        const { x0, y0 } = zoneAt(0, 0);
        for (let x = 0; x < zone; x += 1) {
            const v = Math.floor(x / 40) % 2 === 0 ? 16 : 239;
            fillRect(buf, x0 + x, y0, 1, zone, [v, v, v]);
        }
    }
    // Zone 2 — memes barres, faible contraste (104 / 152).
    {
        const { x0, y0 } = zoneAt(1, 0);
        for (let x = 0; x < zone; x += 1) {
            const v = Math.floor(x / 40) % 2 === 0 ? 104 : 152;
            fillRect(buf, x0 + x, y0, 1, zone, [v, v, v]);
        }
    }
    // Zone 3 — bord doux : transition en cosinus etalee sur 120 px, entre 80 et 176.
    {
        const { x0, y0 } = zoneAt(2, 0);
        const centre = zone / 2;
        const largeur = 120;
        for (let x = 0; x < zone; x += 1) {
            const t = Math.max(0, Math.min(1, (x - (centre - largeur / 2)) / largeur));
            const doux = 0.5 - 0.5 * Math.cos(Math.PI * t);
            const v = Math.round(80 + doux * (176 - 80));
            fillRect(buf, x0 + x, y0, 1, zone, [v, v, v]);
        }
    }
    // Zones 4, 5, 6 — reseaux sinusoidaux de periode 8, 24, 64 px.
    [8, 24, 64].forEach((periode, index) => {
        const { x0, y0 } = zoneAt(index, 1);
        for (let x = 0; x < zone; x += 1) {
            const v = Math.round(128 + 50 * Math.sin((2 * Math.PI * x) / periode));
            const c = Math.max(0, Math.min(255, v));
            fillRect(buf, x0 + x, y0, 1, zone, [c, c, c]);
        }
    });

    await writePng('mire-C-details.png', buf);
}

/* ─────────────────────────────────────────────────────────────
 * MIRE D — IMAGE DELAVEE. Pour la CORRECTION DU VOILE.
 *
 * Le voile ne se mesure pas sur une image nette et contrastee: il n'y aurait
 * rien a corriger. Il lui faut ce qu'il est cense reparer — une image lavee,
 * a faible contraste, tirant vers le clair.
 *
 * Fond: degrade vertical de 196 (haut) a 146 (bas), comme un ciel brumeux.
 * Dessus: des carres dont le contraste a ete ECRASE a 22 % de leur ecart au
 * fond, et legerement desatures. On mesure alors deux choses d'un coup:
 *   - de combien le voile REDEPLOIE le contraste (l'ecart carre / fond);
 *   - de combien il remonte la SATURATION au passage (Lightroom le fait, et ce
 *     n'est pas dit dans le nom du curseur).
 * ───────────────────────────────────────────────────────────── */
async function mireVoile() {
    const buf = newBuffer(0);
    for (let y = 0; y < H; y += 1) {
        const v = Math.round(196 - (196 - 146) * (y / (H - 1)));
        fillRect(buf, 0, y, W, 1, [v, v, v]);
    }

    const sujets = [
        [40, 60, 110], // bleu sombre
        [150, 40, 40], // rouge
        [40, 110, 60], // vert
        [200, 190, 60], // jaune
        [24, 24, 24], // noir
        [250, 250, 250], // blanc
    ];
    const size = 200;
    const gapX = Math.round((W - sujets.length * size) / (sujets.length + 1));
    const y0 = Math.round((H - size) / 2);

    sujets.forEach((color, index) => {
        const x0 = gapX + index * (size + gapX);
        const fond = 196 - (196 - 146) * (y0 / (H - 1));
        // Contraste ecrase a 22 % et chroma reduite: c'est ce que fait la brume.
        const moyenne = (color[0] + color[1] + color[2]) / 3;
        const lave = color.map((c) => {
            const desature = moyenne + (c - moyenne) * 0.45;
            return Math.round(Math.max(0, Math.min(255, fond + (desature - fond) * 0.22)));
        });
        fillRect(buf, x0, y0, size, size, lave);
    });

    await writePng('mire-D-voile.png', buf);
}

console.log(`\nMires d'effets (${W}x${H}) :`);
await mireAplats();
await mireVignette();
await mireDetails();
await mireVoile();
console.log(
    '\nA faire passer dans Lightroom UN CURSEUR A LA FOIS, export PNG / Taille reelle /'
    + '\nsRVB / Nettete de sortie « Aucun ». Voir docs/lightroom/4-synchro-effets.md.\n',
);
