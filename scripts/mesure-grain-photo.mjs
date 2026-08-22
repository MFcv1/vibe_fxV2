/*
 * LE GRAIN SUR UNE VRAIE PHOTO, canal par canal.
 *
 *   node scripts/mesure-grain-photo.mjs <sa-photo-developpee.png> \
 *     --grain 25 [--taille 25] [--blocs 40]
 *
 * POURQUOI CET INSTRUMENT EXISTE
 *
 * La mire A dit tout sur des aplats parfaits. Une photo, non: son ciel a un
 * degrade, sa matiere a du detail, et son JPEG a son propre bruit. Le seul
 * moyen honnete de comparer, c'est de faire subir EXACTEMENT le meme traitement
 * aux deux cotes.
 *
 * On procede donc ainsi:
 *
 *   1. on floute SA photo tres large — le grain disparait, l'image reste;
 *   2. on choisit les blocs les plus PLATS de cette version floutee (un ciel,
 *      un mur): la ou il n'y a rien d'autre que du grain a mesurer;
 *   3. son grain = sa photo moins SON PROPRE flou, dans ces blocs;
 *   4. notre grain = notre etage pose sur la version floutee, moins SON PROPRE
 *      flou — le meme geste exactement.
 *
 * Le point 4 n'est pas un detail: soustraire le flou de SA photo a NOTRE image
 * donnerait notre grain entier d'un cote et son grain ampute de sa part lente
 * de l'autre. Les deux cotes doivent passer par le meme flou, chacun le sien.
 *
 * PIEGE PAYE EN TEMPS, a ne pas reintroduire: le rayon du flou doit etre LARGE.
 * Retirer la tendance locale sur 3 px sous-estime un grain de 2,4 px — une
 * partie du grain entre dans la moyenne et se retrouve soustraite. Le rayon par
 * defaut ci-dessous est de 12 px, verifie stable.
 *
 * LE BRUIT DE FOND DE SA CHAINE. Le JPEG d'origine a son propre bruit, et sa
 * chaine l'amplifie: il s'ajoute a son grain et gonfle SA colonne, jamais la
 * notre. Pour le retirer, developper la MEME photo avec un preset qui ne pose
 * AUCUN grain (CN01 par exemple) et le passer en `--sansgrain <photo.png>`: le
 * script lit alors les MEMES blocs dessus et retire ce plancher en quadrature.
 * Sur `photo-test-2` il vaut ~1/255, ce qui suffit a expliquer la plus grande
 * part des 5 % qu'on croyait etre un ecart de notre grain.
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
const readArg = (n, d = null) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const photoPath = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);
const grain = Number(readArg('grain', '25'));
const taille = Number(readArg('taille', String(GRAIN_TAILLE_DEFAUT)));
const rayon = Number(readArg('rayon', '12'));
const sansGrainPath = readArg('sansgrain');
const nbBlocs = Number(readArg('blocs', '40'));
/* Un plancher de luminosite: les blocs les plus plats d'une photo sont souvent
   des noirs bouches, ou il ne reste plus rien a mesurer. */
const clairMin = Number(readArg('clair', '60'));
const BLOC = 64;

if (!photoPath) {
    console.error('\nUsage: node scripts/mesure-grain-photo.mjs <sa-photo.png> --grain 25 [--taille 25]\n');
    process.exit(1);
}

const { data: sien, info } = await sharp(photoPath).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
/* Le flou large: assez pour effacer un grain de quelques pixels, pas assez pour
   deplacer un ciel. C'est la meme image de depart pour les deux cotes. */
const lisse = await sharp(photoPath).removeAlpha().blur(rayon).raw().toBuffer();

/* Notre etage de grain, appele et non recopie, pose sur la version lissee. */
const PIXEL = new Float64Array(3);
const notre = Buffer.from(lisse);
{
    const echelle = grainEchelle(taille, W);
    const sigma = grainSigma(grain, taille, W);
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const i = (y * W + x) * 3;
            const luma = (notre[i] * 77 + notre[i + 1] * 150 + notre[i + 2] * 29) >> 8;
            const delta = grainValeurEn(x, y, echelle) * sigma * GRAIN_ATTENUATION[luma];
            grainPoserDelta(notre[i], notre[i + 1], notre[i + 2], delta, PIXEL);
            for (let c = 0; c < 3; c += 1) notre[i + c] = Math.round(PIXEL[c]);
        }
    }
}

/* Un bloc est PLAT si la version lissee y varie peu: c'est la qu'il n'y a rien
   d'autre que du grain. */
const blocs = [];
for (let by = 0; by + BLOC <= H; by += BLOC) {
    for (let bx = 0; bx + BLOC <= W; bx += BLOC) {
        let s = 0;
        let ss = 0;
        const base = [0, 0, 0];
        for (let y = by; y < by + BLOC; y += 1) {
            for (let x = bx; x < bx + BLOC; x += 1) {
                const i = (y * W + x) * 3;
                const l = 0.299 * lisse[i] + 0.587 * lisse[i + 1] + 0.114 * lisse[i + 2];
                s += l; ss += l * l;
                for (let c = 0; c < 3; c += 1) base[c] += lisse[i + c];
            }
        }
        const n = BLOC * BLOC;
        blocs.push({ bx, by, relief: Math.sqrt(Math.max(0, ss / n - (s / n) ** 2)), base: base.map((v) => v / n) });
    }
}
blocs.sort((a, b) => a.relief - b.relief);
const choisis = blocs
    .filter((b) => 0.299 * b.base[0] + 0.587 * b.base[1] + 0.114 * b.base[2] >= clairMin)
    .slice(0, nbBlocs);
if (!choisis.length) {
    console.error(`\nAucun bloc plat au-dessus de la luminosite ${clairMin}. Baisse --clair.\n`);
    process.exit(1);
}

/*
 * La GROSSEUR du grain dans un bloc: 1 + 2 x la somme des autocorrelations du
 * residu, la meme definition que `mesure-taille-grain.mjs`. Elle vaut 1,0 pour
 * un bruit tire pixel par pixel et grandit avec la taille des grains. Sans
 * elle, on ne mesure que la FORCE, et une force juste avec une grosseur fausse
 * ne se voit pas dans un ecart-type.
 */
function grosseur(image, flou, bloc) {
    const n = BLOC * BLOC;
    let somme = 0;
    for (let y = bloc.by; y < bloc.by + BLOC; y += 1) {
        for (let x = bloc.bx; x < bloc.bx + BLOC; x += 1) {
            const i = (y * W + x) * 3;
            somme += 0.299 * (image[i] - flou[i]) + 0.587 * (image[i + 1] - flou[i + 1])
                + 0.114 * (image[i + 2] - flou[i + 2]);
        }
    }
    const m = somme / n;
    const val = (x, y) => {
        const i = (y * W + x) * 3;
        return 0.299 * (image[i] - flou[i]) + 0.587 * (image[i + 1] - flou[i + 1])
            + 0.114 * (image[i + 2] - flou[i + 2]) - m;
    };
    let variance = 0;
    for (let y = bloc.by; y < bloc.by + BLOC; y += 1) {
        for (let x = bloc.bx; x < bloc.bx + BLOC; x += 1) variance += val(x, y) ** 2;
    }
    variance /= n;
    if (variance <= 0) return 0;
    let cumul = 0;
    for (let dx = 1; dx <= 8; dx += 1) {
        let c = 0;
        let k = 0;
        for (let y = bloc.by; y < bloc.by + BLOC; y += 1) {
            for (let x = bloc.bx; x + dx < bloc.bx + BLOC; x += 1) { c += val(x, y) * val(x + dx, y); k += 1; }
        }
        cumul += (c / k) / variance;
    }
    return 1 + 2 * cumul;
}

/* L'ecart-type du residu (image moins SON propre flou), canal par canal. */
function residu(image, flou, bloc) {
    const somme = [0, 0, 0];
    const carres = [0, 0, 0];
    for (let y = bloc.by; y < bloc.by + BLOC; y += 1) {
        for (let x = bloc.bx; x < bloc.bx + BLOC; x += 1) {
            const i = (y * W + x) * 3;
            for (let c = 0; c < 3; c += 1) {
                const d = image[i + c] - flou[i + c];
                somme[c] += d;
                carres[c] += d * d;
            }
        }
    }
    const n = BLOC * BLOC;
    return [0, 1, 2].map((c) => Math.sqrt(Math.max(0, carres[c] / n - (somme[c] / n) ** 2)));
}

console.log(`\n${path.basename(photoPath)} — ${W}x${H}, Grain ${grain}, Taille ${taille}`);
console.log(`Les ${choisis.length} blocs de ${BLOC}x${BLOC} les plus plats au-dessus de la luminosite ${clairMin}, flou de ${rayon} px.\n`);
console.log('bloc      couleur du bloc     LUI  sigma RGB      NOUS sigma RGB      ecart %');
console.log('─'.repeat(88));

/* Le plancher de bruit de SA chaine, lu sur les memes blocs d'une version de la
   MEME photo developpee sans grain. */
let plancher = null;
if (sansGrainPath) {
    const brut = await sharp(sansGrainPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (brut.info.width !== W || brut.info.height !== H) {
        console.error('\nECHEC: la photo --sansgrain n\'a pas la taille de l\'autre.\n');
        process.exit(1);
    }
    plancher = { image: brut.data, flou: await sharp(sansGrainPath).removeAlpha().blur(rayon).raw().toBuffer() };
}

/* Le meme flou, sur NOTRE image: c'est ce qui rend les deux colonnes
   comparables. */
const flouNotre = await sharp(notre, { raw: { width: W, height: H, channels: 3 } })
    .blur(rayon).raw().toBuffer();

const cumul = { lui: [0, 0, 0], nous: [0, 0, 0] };
for (const bloc of choisis.slice(0, 12)) {
    const a = residu(sien, lisse, bloc);
    const b = residu(notre, flouNotre, bloc);
    console.log(
        `${String(bloc.bx).padStart(5)},${String(bloc.by).padStart(5)} `
        + bloc.base.map((v) => v.toFixed(0).padStart(5)).join('') + '   '
        + a.map((v) => v.toFixed(2).padStart(6)).join(' ') + '   '
        + b.map((v) => v.toFixed(2).padStart(6)).join(' ') + '   '
        + a.map((v, c) => `${(100 * (b[c] / v - 1)).toFixed(0)}`.padStart(5)).join(' '),
    );
}
for (const bloc of choisis) {
    const a = residu(sien, lisse, bloc);
    const b = residu(notre, flouNotre, bloc);
    for (let c = 0; c < 3; c += 1) { cumul.lui[c] += a[c]; cumul.nous[c] += b[c]; }
}
console.log('─'.repeat(88));
const moy = (t) => t.map((v) => v / choisis.length);
const lui = moy(cumul.lui);
const nous = moy(cumul.nous);
let grossLui = 0;
let grossNous = 0;
for (const bloc of choisis) {
    grossLui += grosseur(sien, lisse, bloc);
    grossNous += grosseur(notre, flouNotre, bloc);
}
console.log(
    `MOYENNE des ${choisis.length} blocs`.padEnd(26)
    + lui.map((v) => v.toFixed(2).padStart(6)).join(' ') + '   '
    + nous.map((v) => v.toFixed(2).padStart(6)).join(' ') + '   '
    + lui.map((v, c) => `${(100 * (nous[c] / v - 1)).toFixed(0)}`.padStart(5)).join(' '),
);
if (plancher) {
    const sol = [0, 0, 0];
    for (const bloc of choisis) {
        const p = residu(plancher.image, plancher.flou, bloc);
        for (let c = 0; c < 3; c += 1) sol[c] += p[c];
    }
    const fond = moy(sol);
    const luiSeul = lui.map((v, c) => Math.sqrt(Math.max(0, v * v - fond[c] * fond[c])));
    console.log(
        'son bruit de fond'.padEnd(26)
        + fond.map((v) => v.toFixed(2).padStart(6)).join(' '),
    );
    console.log(
        'SON GRAIN SEUL'.padEnd(26)
        + luiSeul.map((v) => v.toFixed(2).padStart(6)).join(' ') + '   '
        + nous.map((v) => v.toFixed(2).padStart(6)).join(' ') + '   '
        + luiSeul.map((v, c) => `${(100 * (nous[c] / v - 1)).toFixed(0)}`.padStart(5)).join(' '),
    );
    console.log('\n(le bruit de fond se retire EN QUADRATURE: deux bruits s\'ajoutent en carres.)');
}
console.log(
    `\nGROSSEUR des grains       ${(grossLui / choisis.length).toFixed(2)} chez lui`
    + `   ${(grossNous / choisis.length).toFixed(2)} chez nous`
    + `   (1,00 = un pixel)`,
);
console.log('\nRappel: sans --sansgrain, le bruit de sa chaine est dans SA colonne et pas dans la notre.\n');
