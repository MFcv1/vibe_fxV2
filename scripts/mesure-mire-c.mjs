/*
 * Mesurer un reglage de DETAIL sur la mire C — nettete, texture, clarte.
 *
 *   node scripts/mesure-mire-c.mjs --reference <mire-C-sans-rien.png> \
 *     --lightroom <mire-C-reglage.png> [--label "Texture +50"]
 *
 * POURQUOI IL EXISTE. La nettete et la clarte ont ete calees en mesurant la
 * mire C a la main, une fois. Le prochain reglage (Texture) demande la meme
 * mesure, et celui d'apres aussi: autant que l'instrument soit un fichier
 * plutot qu'une suite de commandes retapees, et surtout qu'il dise TOUJOURS la
 * meme chose des memes pixels.
 *
 * CE QU'IL LIT. Les six zones de 540x540 posees par `make-mire-effets.mjs`:
 *
 *   ligne 1   barres 40 px fort contraste · barres 40 px faible · bord doux 120 px
 *   ligne 2   sinus 8 px · sinus 24 px · sinus 64 px
 *
 * Les trois SINUS sont le coeur de la mesure: un sinus ne contient qu'une seule
 * echelle, donc l'amplification qu'on y lit est bien celle de cette echelle-la.
 * Une barre nette, elle, contient toutes les frequences a la fois et ne separe
 * rien — c'est pour ca qu'elle ne sert ici que de temoin.
 *
 * L'amplification est le rapport des AMPLITUDES (ecart-type du profil), pas des
 * moyennes: un reglage de detail ne change pas la luminance moyenne d'une zone,
 * il en change le contraste local.
 *
 * PIEGE, et il a deja fait mentir une mesure: on ne lit que le COEUR de chaque
 * zone. Tout effet spatial bave sur ses voisins, et la zone d'a cote n'a rien a
 * voir. Au-dela d'un certain rayon, une mire finit par lire ses propres bords.
 */

import sharp from 'sharp';

const args = process.argv.slice(2);
const lire = (nom, defaut = null) => {
    const i = args.indexOf(`--${nom}`);
    return i === -1 ? defaut : args[i + 1];
};

const reference = lire('reference');
const lightroom = lire('lightroom');
const label = lire('label', '');

if (!reference || !lightroom) {
    console.error('\nUsage: node scripts/mesure-mire-c.mjs --reference <ref.png>'
        + ' --lightroom <mesure.png> [--label "Texture +50"]\n');
    process.exit(1);
}

const ZONE = 540;
/* Marge jetee de chaque cote: la bavure d'un effet large vient de la zone d'a cote. */
const MARGE = 70;

const ZONES = [
    { nom: 'barres 40 px, fort contraste', col: 0, row: 0, temoin: true },
    { nom: 'barres 40 px, faible contraste', col: 1, row: 0, temoin: true },
    { nom: 'bord doux 120 px', col: 2, row: 0, bord: true },
    { nom: 'sinus 8 px  (nettete)', col: 0, row: 1 },
    { nom: 'sinus 24 px (texture)', col: 1, row: 1 },
    { nom: 'sinus 64 px (clarte)', col: 2, row: 1 },
];

async function luminances(fichier) {
    const { data, info } = await sharp(fichier).removeAlpha().raw()
        .toBuffer({ resolveWithObject: true });
    if (info.width !== 3 * ZONE || info.height !== 2 * ZONE) {
        console.error(`\nECHEC: ${fichier} fait ${info.width}x${info.height}, attendu ${3 * ZONE}x${2 * ZONE}.`
            + '\nReexporte en « Taille reelle », sans redimensionnement.\n');
        process.exit(1);
    }
    const L = new Float32Array(info.width * info.height);
    for (let i = 0; i < L.length; i += 1) {
        L[i] = (data[i * 3] * 77 + data[i * 3 + 1] * 150 + data[i * 3 + 2] * 29) / 256;
    }
    return { L, w: info.width };
}

/*
 * Le profil horizontal d'une zone: chaque colonne moyennee sur les lignes. Les
 * zones sont invariantes en hauteur, donc moyenner les lignes divise le bruit
 * sans rien effacer du motif.
 */
function profil({ L, w }, { col, row }) {
    const x0 = col * ZONE + MARGE;
    const y0 = row * ZONE + MARGE;
    const cote = ZONE - 2 * MARGE;
    const p = new Float64Array(cote);
    for (let x = 0; x < cote; x += 1) {
        let s = 0;
        for (let y = 0; y < cote; y += 1) s += L[(y0 + y) * w + x0 + x];
        p[x] = s / cote;
    }
    return p;
}

const moyenne = (p) => p.reduce((a, v) => a + v, 0) / p.length;
const ecartType = (p) => {
    const m = moyenne(p);
    return Math.sqrt(p.reduce((a, v) => a + (v - m) ** 2, 0) / p.length);
};
/*
 * Pour le bord doux: la raideur de la transition, mesuree sur le profil LISSE.
 *
 * Le lissage n'est pas une coquetterie. Prendre le maximum d'une difference
 * pixel a pixel, c'est prendre le maximum du BRUIT: sur la mire de reference,
 * une telle mesure donnait 2,00 la ou la transition n'en vaut que 1,26 en
 * theorie. Un reglage qui ne fait qu'ajouter du bruit haute frequence aurait
 * alors l'air de raidir le bord, ce qui est faux.
 */
const penteMax = (p) => {
    const FENETRE = 5;
    const lisse = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 1) {
        let s = 0;
        let k = 0;
        for (let j = Math.max(0, i - FENETRE); j <= Math.min(p.length - 1, i + FENETRE); j += 1) {
            s += p[j];
            k += 1;
        }
        lisse[i] = s / k;
    }
    let max = 0;
    for (let i = 1; i < lisse.length; i += 1) max = Math.max(max, Math.abs(lisse[i] - lisse[i - 1]));
    return max;
};

const ref = await luminances(reference);
const lr = await luminances(lightroom);

console.log(`\nMIRE C — ${label || lightroom}`);
console.log(`  reference : ${reference}`);
console.log(`  mesure    : ${lightroom}\n`);
console.log('  zone                             amplitude ref   mesuree   amplification');

for (const zone of ZONES) {
    const pRef = profil(ref, zone);
    const pLr = profil(lr, zone);
    const mesure = zone.bord ? penteMax : ecartType;
    const a = mesure(pRef);
    const b = mesure(pLr);
    const suffixe = zone.temoin ? '  (temoin: toutes frequences melangees)' : '';
    console.log(`  ${zone.nom.padEnd(32)} ${a.toFixed(2).padStart(8)} ${b.toFixed(2).padStart(9)}`
        + `   ${(b / a).toFixed(3).padStart(8)}${suffixe}`);
    /* Un decalage de luminance moyenne signalerait autre chose qu'un effet de detail. */
    const derive = moyenne(pLr) - moyenne(pRef);
    if (Math.abs(derive) > 1.5) {
        console.log(`  ${''.padEnd(32)} ATTENTION: luminance moyenne decalee de ${derive.toFixed(2)}/255`);
    }
}

console.log('\n  Amplification > 1 : le reglage accentue. < 1 : il adoucit.');
console.log('  Les trois SINUS font foi, chacun pour son echelle. Les barres ne separent rien.\n');
