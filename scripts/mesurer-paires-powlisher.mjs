/*
 * Mesure ce que fait son traitement, sur des paires « Avant / Apres » ALIGNEES
 * (voir aligner-paire-avant-apres.mjs). C'est la seule source du projet ou l'on
 * connait l'ENTREE et la SORTIE de la meme image: tout le reste est statistique.
 *
 *   node scripts/mesurer-paires-powlisher.mjs <prefixe...>
 *
 * Methode: on ne mesure pas au pixel. Deux captures d'ecran rejouees ont du
 * bruit JPEG et, sur une des paires, un recadrage a rattraper — au pixel, chaque
 * contour fabrique une fausse couleur. On decoupe donc en BLOCS de 8x8, on
 * garde ceux qui sont plats des DEUX cotes (l'ecart-type interne borne), et on
 * compare des moyennes de blocs. Un bloc plat mal aligne de 1 px reste juste.
 *
 * Sortie: la reponse tonale canal par canal (mediane de l'apres pour chaque
 * niveau de l'avant), puis le residu en teinte/saturation par bande.
 */

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const PLAT = 7;        /* ecart-type interne max, en niveaux, pour garder un bloc */
const BLOC = 8;

export async function blocs(prefixe, plat = PLAT) {
    const A = await sharp(`${prefixe}-avant.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const B = await sharp(`${prefixe}-apres.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = A.info.width, H = A.info.height;
    const out = [];
    for (let by = 0; by + BLOC <= H; by += BLOC) {
        for (let bx = 0; bx + BLOC <= W; bx += BLOC) {
            const ma = [0, 0, 0], mb = [0, 0, 0], va = [0, 0, 0], vb = [0, 0, 0];
            let hors = false;
            for (let y = 0; y < BLOC; y += 1) for (let x = 0; x < BLOC; x += 1) {
                const i = ((by + y) * W + bx + x) * 3;
                for (let k = 0; k < 3; k += 1) {
                    const a = A.data[i + k], b = B.data[i + k];
                    ma[k] += a; mb[k] += b; va[k] += a * a; vb[k] += b * b;
                }
                if (B.data[i] === 0 && B.data[i + 1] === 0 && B.data[i + 2] === 0
                    && A.data[i] > 12) hors = true;   /* pixel hors cadre de l'apres */
            }
            if (hors) continue;
            const n = BLOC * BLOC;
            let uni = true;
            for (let k = 0; k < 3; k += 1) {
                ma[k] /= n; mb[k] /= n;
                const sa = Math.sqrt(Math.max(0, va[k] / n - ma[k] * ma[k]));
                const sb = Math.sqrt(Math.max(0, vb[k] / n - mb[k] * mb[k]));
                if (sa > plat || sb > plat) uni = false;
            }
            if (!uni) continue;
            out.push({ a: ma, b: mb, x: (bx + BLOC / 2) / W, y: (by + BLOC / 2) / H });
        }
    }
    return out;
}

const mediane = (xs) => { const t = [...xs].sort((p, q) => p - q); return t.length ? t[t.length >> 1] : null; };

function courbes(bl) {
    /* Pour chaque canal, la mediane de la sortie par tranche d'entree de 8. */
    const tables = [0, 1, 2].map(() => Array.from({ length: 32 }, () => []));
    for (const { a, b } of bl) for (let k = 0; k < 3; k += 1) tables[k][Math.min(31, Math.floor(a[k] / 8))].push(b[k]);
    return tables.map((t) => t.map((xs) => (xs.length >= 12 ? [mediane(xs), xs.length] : null)));
}

/* Le module sert aussi de bibliotheque (`verifier-powlishermain.mjs` en
 * importe `blocs`): on ne joue la sortie texte que si on est le programme. */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
for (const prefixe of process.argv.slice(2)) {
    const bl = await blocs(prefixe);
    console.log(`\n=== ${prefixe.split('/').pop()}  ${bl.length} blocs plats`);
    const c = courbes(bl);
    console.log('  in    R  ->  out (n)        G  ->  out (n)        B  ->  out (n)');
    for (let i = 0; i < 32; i += 1) {
        const cellules = c.map((t) => (t[i] ? `${t[i][0].toFixed(1).padStart(6)} (${String(t[i][1]).padStart(5)})` : '        —     '));
        if (c.every((t) => !t[i])) continue;
        console.log(`${String(i * 8 + 4).padStart(5)}   ${cellules.join('  ')}`);
    }
}
}
