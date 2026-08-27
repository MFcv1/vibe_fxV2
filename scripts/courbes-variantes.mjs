/*
 * Les courbes de tonalite des variantes, tirees de leur transport mesure.
 *
 *   node scripts/courbes-variantes.mjs
 *
 * UNE SEULE correction s'applique au transport brut, et ce n'est pas un choix
 * de gout: l'appariement de quantiles force 255 -> 255, parce que les deux
 * fonctions de repartition finissent a 1. Ca fabrique un mur vertical entre le
 * dernier point mesure et le blanc. On le remplace par le PLAFOND de la
 * variante — la ou son propre transport pose deja le tres clair (entree 248),
 * prolonge d'un pas. Meme correction que celle appliquee au tronc le 2026-08-25.
 *
 * CE QUI A ETE ESSAYE PUIS JETE. `doux` coute -1,15 EV au gris moyen et `nuit`
 * -1,11: ce sont des registres shootes sous-exposes. Trois facons de leur rendre
 * cette exposition ont ete construites — gain global, gain s'eteignant dans les
 * hautes lumieres, epaule filmique en lumiere lineaire — et les trois fabriquent
 * la meme chose: un PLATEAU dans les clairs suivi d'un saut vers le plafond,
 * parce qu'on demande a une courbe de monter au milieu et de ne pas monter en
 * haut. Un plateau comprime, et ce qui est comprime bande. On garde donc le
 * transport tel qu'il est mesure: sa pente decroit regulierement du noir au
 * blanc, et c'est la seule forme dont on soit sur qu'elle ne bande pas.
 *
 * Le prix est dit, pas cache: ces deux presets assombrissent d'une exposition.
 * C'est leur registre, et c'est ce que leurs `bestFor` annoncent.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BIBLIO = path.join(os.homedir(), 'Desktop', 'powlisher-biblio');
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const srgb = (l) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.max(0, l) ** (1 / 2.4) - 0.055);
const tr = JSON.parse(fs.readFileSync(path.join(BIBLIO, 'transport.json'), 'utf8'));
const lire = (n) => JSON.parse(fs.readFileSync(path.join(BIBLIO, `variante-${n}.json`), 'utf8')).ton;

const VARIANTES = { net: lire('net'), doux: lire('doux'), chaud: lire('chaud'), froid: lire('froid'), mer: lire('mer'), nuit: lire('ville-nuit'), ambre: lire('lumierejaune') };
const PAS = 16;
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* LA PENTE MINIMALE N'EST PAS UN GOUT, C'EST LE PAS DE LA TABLE.
 *
 * La LUT a 33 noeuds par axe: son pas d'entree vaut huit niveaux. Une portion
 * de courbe dont la pente tombe sous 1/8 fait donc tenir plus de huit niveaux
 * d'entree dans un seul niveau de sortie — la difference n'existe plus, et
 * aucune interpolation ne la fera revenir. C'est la seule borne qu'on puisse
 * poser sans invoquer un gout.
 *
 * Le transport brut de `doux` tombe a 0,06 dans les noirs (16 -> 4, 32 -> 5):
 * tout le bas de l'image y devient un seul niveau. */
const PENTE_MIN = 1 / 8;

for (const [nom, ton] of Object.entries(VARIANTES)) {
    const plafond = Math.min(252, Math.round(ton[248] + (ton[248] - ton[240]) * (255 - 248) / 8));

    /* Le rendu d'exposition s'ETEINT DANS LES HAUTES LUMIERES: rendre la lumiere
     * partout remonterait aussi le plafond, et le plafond est ce qui definit la
     * variante. Le gain vaut k au gris moyen de sa courbe et 1 a son plafond —
     * deux valeurs mesurees. C'est la paire Exposition + Hautes lumieres de
     * Lightroom. */
    const Ymid = lin(ton[128]);
    const Ytop = lin(ton[248]);
    const construire = (ev) => {
        const k = 2 ** ev;
        const gain = (Y) => 1 + (k - 1) * (1 - smoothstep(Ymid, Ytop, Y));
        const pts = [];
        for (let x = 0; x <= 240; x += PAS) { const Y = lin(ton[x]); pts.push([x, Math.min(252, Math.round(srgb(Y * gain(Y))))]); }
        pts.push([248, ton[248]], [255, plafond]);
        return pts;
    };
    const pireP = (pts) => Math.min(...pts.slice(1).map(([x, y], i) => (y - pts[i][1]) / (x - pts[i][0])));

    /* On cherche le PLUS PETIT rendu d'exposition qui suffise: la variante garde
     * le maximum de ce qu'elle a mesure. */
    let ev = 0;
    while (pireP(construire(ev)) < PENTE_MIN && ev < 1.5) ev += 0.02;
    const pts = construire(ev);

    const gris = pts.find((p) => p[0] === 128)[1];
    console.log(`=== ${nom}   plafond ${plafond}   gris moyen ${gris} (tronc 117, ${Math.log2(lin(gris) / lin(tr.tronc.ton[128])).toFixed(2)} EV)`
        + `   rendu ${ev.toFixed(2)} EV   pente mini ${pireP(pts).toFixed(2)}`);
    console.log('  ' + pts.map(([a, b]) => `${a}>${b}`).join('  '));
    console.log('  ' + pts.map(([a, b]) => `[${(a / 255).toFixed(4)}, ${(b / 255).toFixed(4)}]`).join(', '));
}
