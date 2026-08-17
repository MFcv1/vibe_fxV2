/*
 * La validation qui compte vraiment : sur une VRAIE photo.
 *
 * On applique le preset a la photo d'origine avec notre moteur, et on compare
 * pixel a pixel avec la meme photo passee dans Lightroom avec le meme preset.
 *
 * L'ecart ne sera jamais nul et il ne DOIT pas l'etre : Lightroom developpe
 * depuis du RAW lineaire, nous depuis un JPEG deja developpe. La question
 * n'est pas « est-ce zero » mais « est-ce assez petit pour que ce soit le meme
 * look ». Reperes utiles, sur 255 :
 *   <= 2   invisible
 *   3 a 5  invisible en pratique sur une photo
 *   6 a 10 visible en comparant cote a cote, pas isolement
 *   > 10   ce n'est plus le meme rendu
 *
 * L'ecart maximum, lui, est presque toujours localise sur des zones brulees ou
 * bouchees, la ou le JPEG n'a plus la matiere que le RAW avait. C'est pour ca
 * qu'on affiche aussi le 99e centile, bien plus parlant que le max.
 *
 *   node scripts/compare-preset-vs-lightroom.mjs <origine> <version-lightroom> <presetId>
 */

import sharp from 'sharp';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import { getPresetLut, VISION_PRESET_BY_ID } from '../src/features/vibefx-studio/utils/visionPresets.js';

const argv = process.argv.slice(2);
const plancheIndex = argv.indexOf('--planche');
const planche = plancheIndex === -1 ? null : argv[plancheIndex + 1];
const [source, reference, presetId] = argv.filter((v, i) => (
    !v.startsWith('--') && i !== plancheIndex + 1
));

if (!source || !reference || !presetId) {
    console.error(
        '\nUsage: node scripts/compare-preset-vs-lightroom.mjs <origine> <version-lightroom> <presetId>'
        + ' [--planche <sortie.png>]\n',
    );
    process.exit(1);
}
if (!VISION_PRESET_BY_ID[presetId]) {
    console.error(`\nPreset inconnu: ${presetId}\n`);
    process.exit(1);
}

/*
 * `.rotate()` sans argument applique l'orientation EXIF. Indispensable ici: un
 * JPEG de telephone est souvent stocke en paysage avec une balise « tourne-moi »,
 * et Lightroom, lui, ecrit la rotation dans les pixels a l'export. Sans ca les
 * deux images n'ont meme pas les memes dimensions.
 */
const srcImage = sharp(source).rotate();
const refImage = sharp(reference).rotate();
const srcMeta = await srcImage.png().toBuffer({ resolveWithObject: true }).then((r) => r.info);
const refMeta = await refImage.png().toBuffer({ resolveWithObject: true }).then((r) => r.info);

console.log(`\nOrigine    : ${source} (${srcMeta.width}x${srcMeta.height})`);
console.log(`Lightroom  : ${reference} (${refMeta.width}x${refMeta.height})`);
console.log(`Preset     : ${VISION_PRESET_BY_ID[presetId].label}`);

if (srcMeta.width !== refMeta.width || srcMeta.height !== refMeta.height) {
    console.error(
        '\nECHEC: les deux images n\'ont pas la meme taille. Reexporte depuis Lightroom'
        + '\nen « Taille reelle », sans redimensionnement.\n',
    );
    process.exit(1);
}

const { data: src } = await srcImage.removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { data: ref } = await refImage.removeAlpha().raw().toBuffer({ resolveWithObject: true });

/* Notre rendu, exactement comme dans l'app : la LUT du preset, a pleine force. */
const pixelCount = src.length / 3;
const ours = new Uint8ClampedArray(pixelCount * 4);
for (let i = 0; i < pixelCount; i += 1) {
    ours[i * 4] = src[i * 3];
    ours[i * 4 + 1] = src[i * 3 + 1];
    ours[i * 4 + 2] = src[i * 3 + 2];
    ours[i * 4 + 3] = 255;
}
applyLut3dToData(ours, getPresetLut(presetId), LUT_SIZE, 1);

/* Ecart par canal, plus l'histogramme qui donne les centiles. */
const histogram = new Int32Array(256);
let sum = 0;
let max = 0;
for (let i = 0; i < pixelCount; i += 1) {
    for (let c = 0; c < 3; c += 1) {
        const d = Math.abs(ours[i * 4 + c] - ref[i * 3 + c]);
        sum += d;
        histogram[d] += 1;
        if (d > max) max = d;
    }
}
const total = pixelCount * 3;
const mean = sum / total;

function percentile(p) {
    const target = total * p;
    let seen = 0;
    for (let d = 0; d < 256; d += 1) {
        seen += histogram[d];
        if (seen >= target) return d;
    }
    return 255;
}

/* Le meme calcul entre l'origine et Lightroom : de combien le preset change la photo. */
let effectSum = 0;
for (let i = 0; i < pixelCount; i += 1) {
    for (let c = 0; c < 3; c += 1) effectSum += Math.abs(src[i * 3 + c] - ref[i * 3 + c]);
}
const effect = effectSum / total;

console.log('\nECART entre notre rendu et Lightroom');
console.log(`  moyen            ${mean.toFixed(2)}/255`);
console.log(`  median           ${percentile(0.5)}/255`);
console.log(`  90e centile      ${percentile(0.9)}/255`);
console.log(`  99e centile      ${percentile(0.99)}/255`);
console.log(`  max              ${max}/255  (zones brulees ou bouchees)`);

console.log('\nA COMPARER A');
console.log(`  effet du preset  ${effect.toFixed(2)}/255  (ecart entre la photo d'origine et Lightroom)`);
console.log(`  -> notre rendu reproduit ${(100 * (1 - mean / effect)).toFixed(1)} % de l'effet du preset`);

const verdict = mean <= 2 ? 'identique a l\'oeil'
    : mean <= 5 ? 'meme rendu, ecart invisible en pratique'
        : mean <= 10 ? 'meme look, ecart visible en comparant cote a cote'
            : 'CE N\'EST PLUS LE MEME RENDU';
console.log(`\nVERDICT: ${verdict}.\n`);

/*
 * LA PLANCHE. Un ecart moyen est un resume, et un resume peut cacher un defaut
 * localise: une bande dans un ciel, un contour, une teinte qui part sur une
 * seule matiere. D'ou deux choses a regarder.
 *
 *   Ligne 1  les trois images entieres, plus la CARTE DES ECARTS (x8, pour
 *            qu'un ecart de 3/255 soit visible). Un defaut de LUT s'y lit comme
 *            une forme: une zone, une bande, un aplat — pas comme du bruit.
 *   Ligne 2  la zone du PIRE ecart, a 1:1 et non redimensionnee, la ou il faut
 *            aller voir si le chiffre moyen ment.
 */
if (planche) {
    const { width: W, height: H } = srcMeta;

    /* La carte, en niveaux de gris, avant tout redimensionnement. */
    const carte = Buffer.alloc(W * H);
    /* Et le pire bloc, pour savoir ou couper la ligne du bas. */
    const BLOC = 128;
    const blocsX = Math.ceil(W / BLOC);
    const sommes = new Float64Array(blocsX * Math.ceil(H / BLOC));
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const i = y * W + x;
            const d = (Math.abs(ours[i * 4] - ref[i * 3])
                + Math.abs(ours[i * 4 + 1] - ref[i * 3 + 1])
                + Math.abs(ours[i * 4 + 2] - ref[i * 3 + 2])) / 3;
            carte[i] = Math.min(255, Math.round(d * 8));
            sommes[Math.floor(y / BLOC) * blocsX + Math.floor(x / BLOC)] += d;
        }
    }
    let pire = 0;
    for (let b = 1; b < sommes.length; b += 1) if (sommes[b] > sommes[pire]) pire = b;
    const COTE = Math.min(560, W, H);
    const centreX = (pire % blocsX) * BLOC + BLOC / 2;
    const centreY = Math.floor(pire / blocsX) * BLOC + BLOC / 2;
    const gauche = Math.max(0, Math.min(W - COTE, Math.round(centreX - COTE / 2)));
    const haut = Math.max(0, Math.min(H - COTE, Math.round(centreY - COTE / 2)));

    const notreRaw = Buffer.alloc(W * H * 3);
    for (let i = 0; i < pixelCount; i += 1) {
        notreRaw[i * 3] = ours[i * 4];
        notreRaw[i * 3 + 1] = ours[i * 4 + 1];
        notreRaw[i * 3 + 2] = ours[i * 4 + 2];
    }

    const brut = (data, channels = 3) => sharp(data, { raw: { width: W, height: H, channels } });
    const LARGEUR = 520;
    const reduire = (img) => img.resize({ width: LARGEUR, fit: 'inside' }).png().toBuffer();
    const couper = (img) => img.extract({
        left: gauche, top: haut, width: COTE, height: COTE,
    }).png().toBuffer();

    const haut1 = await Promise.all([
        reduire(brut(src)), reduire(brut(notreRaw)), reduire(brut(ref)), reduire(brut(carte, 1)),
    ]);
    const bas = await Promise.all([
        couper(brut(src)), couper(brut(notreRaw)), couper(brut(ref)), couper(brut(carte, 1)),
    ]);

    const MARGE = 10;
    const BANDEAU = 30;
    const hHaut = (await sharp(haut1[0]).metadata()).height;
    const colonne = Math.max(LARGEUR, COTE);
    const largeurTotale = 4 * (colonne + MARGE) - MARGE;
    const titres = ['origine', 'notre rendu', 'Lightroom', `ecart x8 (moyen ${mean.toFixed(2)}/255)`];
    const legende = Buffer.from(`<svg width="${largeurTotale}" height="${BANDEAU}">${
        titres.map((t, i) => `<text x="${i * (colonne + MARGE) + 8}" y="20" font-family="sans-serif"
            font-size="15" fill="#e8e8e8">${t}</text>`).join('')
    }</svg>`);
    const legende2 = Buffer.from(`<svg width="${largeurTotale}" height="${BANDEAU}"><text x="8" y="20"
        font-family="sans-serif" font-size="15" fill="#e8e8e8">zone du PIRE ecart, a 1:1 (x=${gauche}, y=${haut})</text></svg>`);

    await sharp({
        create: {
            width: largeurTotale,
            height: BANDEAU + hHaut + MARGE + BANDEAU + COTE,
            channels: 3,
            background: '#0c0c0c',
        },
    }).composite([
        { input: legende, top: 0, left: 0 },
        ...haut1.map((b, i) => ({ input: b, top: BANDEAU, left: i * (colonne + MARGE) })),
        { input: legende2, top: BANDEAU + hHaut + MARGE, left: 0 },
        ...bas.map((b, i) => ({
            input: b, top: BANDEAU + hHaut + MARGE + BANDEAU, left: i * (colonne + MARGE),
        })),
    ]).png().toFile(planche);

    console.log(`Planche ecrite: ${planche}`);
    console.log('La carte des ecarts est amplifiee x8: du NOIR = identique.\n');
}
