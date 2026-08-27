/*
 * Verifie une famille du TAS NEUTRE, et n'en ecarte que ce qui n'est pas une
 * photo.
 *
 *   node scripts/verifier-neutre.mjs --familles coucher-mer,coucher-ville
 *
 * POURQUOI CE SCRIPT EXISTE, et pourquoi il ne fait PAS ce que fait
 * `trier-biblio.mjs`. Ce dernier pose trois questions a une moisson: est-ce une
 * photo, est-ce un doublon, porte-t-elle le meme traitement ? La troisieme est
 * juste pour SON corpus — on y cherche un traitement commun — et elle serait une
 * faute ici. Dans le tas neutre, l'heterogeneite est la QUALITE recherchee:
 * c'est parce que des centaines de retouches individuelles s'annulent que le tas
 * ne porte aucun traitement en propre. Ecarter les photos « atypiques » du tas
 * neutre reviendrait a lui fabriquer un style, donc a mesurer un ecart contre
 * une cible qu'on aurait soi-meme deplacee.
 *
 * On ne garde donc que la question 1: EST-CE UNE PHOTO ? La recherche Commons
 * est une recherche de mots-cles sur des fichiers documentaires, et elle rend
 * des cartes, des schemas, des couvertures de livre et des captures d'ecran.
 * Ces images n'ont pas ete developpees; les faire entrer dans une moyenne de
 * couleur la fausse.
 *
 * CE QU'IL NE PEUT PAS FAIRE. Il ne sait pas si la photo montre vraiment un
 * couchant. Aucun seuil ne separe honnetement « couchant » de « pas couchant »
 * sans filtrer sur la chaleur — et filtrer un tas neutre sur la chaleur, c'est
 * le biaiser vers la reponse qu'on veut mesurer, l'exacte symetrie de l'erreur
 * du 2026-08-27. Cette question-la se tranche a l'oeil, sur la planche.
 *
 * IL ECARTE AUSSI LES QUASI-DOUBLONS. `trier-biblio.mjs` ne connait que
 * l'egalite exacte d'empreinte; ca ne suffit pas ici. Une planche du
 * 2026-08-27 ter a montre vingt vues de la MEME ville depuis la MEME colline
 * dans `coucher-ville` — un seul auteur, une seule seance, televersee en lot.
 * Le tas neutre ne tient que parce que des centaines de retouches
 * INDIVIDUELLES s'annulent; vingt fichiers d'une meme main, c'est un seul vote
 * compte vingt fois, et c'est son traitement a lui qui devient la reference.
 * On compare donc les empreintes a distance de Hamming, pas a l'identique.
 *
 * Les ecartees ne sont pas supprimees: elles vont dans `<famille>/_ecarte/`.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { profil } from './profil-corpus.mjs';

const BIBLIO = path.join(os.homedir(), 'Desktop', 'powlisher-biblio');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const FAMILLES = opt('familles', '').split(',').filter(Boolean);
/* CE SEUIL NE PORTE PLUS LE GROS DU TRAVAIL. Le vrai remede aux lots d'un meme
 * auteur est le plafond par televerseur, applique a la moisson
 * (`moissonner-neutre.mjs`). Il ne reste ici qu'a rattraper le meme fichier
 * televerse deux fois sous deux noms.
 *
 * L'empreinte moyenne 8x8 de `trier-biblio.mjs` a ete essayee et ne convient
 * pas a ce tas: sur des couchants, qui ont TOUS un ciel clair en haut et un sol
 * sombre en bas, elle ne decrit presque plus rien et ecartait 20 photos sans
 * rapport sur 44. On prend un dHash 16x16 — 256 bits de gradients — et un seuil
 * calibre sous le plancher des paires distinctes mesure sur `coucher-ville`
 * (p01 = 92). */
const SEUIL_DOUBLON = Number(opt('doublon', 60));

async function empreinte(fichier) {
    const N = 16;
    const { data } = await sharp(fichier).greyscale().resize(N + 1, N, { fit: 'fill' })
        .raw().toBuffer({ resolveWithObject: true });
    let bits = 0n, k = 0;
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) {
        if (data[y * (N + 1) + x] < data[y * (N + 1) + x + 1]) bits |= 1n << BigInt(k);
        k += 1;
    }
    return bits;
}
const hamming = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };

/* Identiques a ceux de `trier-biblio.mjs`: ils ont ete calibres sur une vraie
 * moisson, et les recalibrer ici ferait diverger deux definitions du mot photo. */
const NON_PHOTO = {
    dominante: 8, dominanteLuma: 24, neutreExact: 10,
    blancNeutre: 18, couleurs: 150, pixelsMin: 480 * 360,
};

if (!FAMILLES.length) { console.error('usage: --familles a,b,c'); process.exit(1); }

for (const fam of FAMILLES) {
    const dossier = path.join(BIBLIO, 'neutre', fam);
    if (!fs.existsSync(dossier)) { console.error(`${fam}: absent`); continue; }
    const rebut = path.join(dossier, '_ecarte');
    const fichiers = fs.readdirSync(dossier).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();

    const gardes = [];
    for (const f of fichiers) {
        const chemin = path.join(dossier, f);
        let p;
        try { p = await profil(chemin); } catch { p = null; }
        const raisons = [];
        if (!p) raisons.push('illisible');
        else {
            if (p.largeur * p.hauteur < NON_PHOTO.pixelsMin) raisons.push('trop petite');
            if (p.partDominante > NON_PHOTO.dominante && p.dominanteLuma > NON_PHOTO.dominanteLuma) raisons.push(`aplat clair ${p.partDominante}%`);
            if (p.partNeutreExact > NON_PHOTO.neutreExact) raisons.push(`neutre ${p.partNeutreExact}%`);
            if (p.partBlancNeutre > NON_PHOTO.blancNeutre) raisons.push(`fond blanc ${p.partBlancNeutre}%`);
            if (p.couleurs < NON_PHOTO.couleurs) raisons.push(`${p.couleurs} couleurs`);
        }
        if (raisons.length) {
            fs.mkdirSync(rebut, { recursive: true });
            fs.renameSync(chemin, path.join(rebut, f));
            console.log(`  ecarte ${fam}/${f}: ${raisons.join(', ')}`);
        } else gardes.push(chemin);
    }

    /* Quasi-doublons: on garde le premier venu et on ecarte tout ce qui lui
     * ressemble de trop. Le premier n'est pas « le meilleur », il est
     * arbitraire — et c'est bien: choisir lequel garder sur un critere de
     * couleur reviendrait a trier le tas neutre sur son traitement. */
    const retenus = [];
    const empreintes = [];
    for (const chemin of gardes) {
        let h;
        try { h = await empreinte(chemin); } catch { continue; }
        const jumeau = empreintes.findIndex((e) => hamming(e, h) <= SEUIL_DOUBLON);
        if (jumeau >= 0) {
            fs.mkdirSync(rebut, { recursive: true });
            fs.renameSync(chemin, path.join(rebut, path.basename(chemin)));
            console.log(`  ecarte ${fam}/${path.basename(chemin)}: quasi-doublon de ${path.basename(retenus[jumeau])}`);
            continue;
        }
        empreintes.push(h); retenus.push(chemin);
    }
    gardes.length = 0; gardes.push(...retenus);

    /* La planche: 6 colonnes, vignettes de 260 px. L'oeil doit pouvoir dire en
     * deux secondes « ca, ce ne sont pas des couchants ». */
    const COL = 6, V = 260;
    const lignes = Math.ceil(gardes.length / COL);
    const tuiles = [];
    for (let i = 0; i < gardes.length; i += 1) {
        const buf = await sharp(gardes[i]).resize(V, V, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
        tuiles.push({ input: buf, left: (i % COL) * V, top: Math.floor(i / COL) * V });
    }
    const cible = path.join(BIBLIO, `NEUTRE-${fam}.jpg`);
    await sharp({ create: { width: COL * V, height: Math.max(1, lignes) * V, channels: 3, background: { r: 16, g: 16, b: 18 } } })
        .composite(tuiles).jpeg({ quality: 82 }).toFile(cible);
    console.log(`${fam}: ${gardes.length} gardees -> ${cible}`);
}
