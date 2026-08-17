/*
 * Presets Vision — definitions et compilation en LUT 3D.
 *
 * Un preset est ecrit ici comme une FONCTION PURE sRGB -> sRGB. Elle peut etre
 * aussi couteuse qu'on veut: elle n'est evaluee que 35937 fois, une seule fois,
 * a la compilation de la LUT (voir `lut3d.js`). Le rendu, lui, ne voit qu'une
 * table.
 *
 * Le premier preset, `powlisher`, est une reconstruction mesuree du rendu des
 * photos de @powl_d. La methode et les chiffres sont dans
 * `docs/audit-preset-powlisher-2026-08-11.md`. En resume de ce que les mesures
 * ont donne sur 19 photos:
 *   - le bleu descend a mesure que la luminance monte (B-G: 0 -> -12/255),
 *   - les tons moyens virent olive (R-G ~ -5/255 vers 40-60% de luminance),
 *   - les noirs restent neutres et denses (aucun matte),
 *   - le ciel atterrit a 178-194 deg (cyan), jamais dans le bleu,
 *   - le feuillage tombe a 85-105 deg avec S <= 0.35,
 *   - la peau est preservee (27-36 deg, S 0.31-0.49),
 *   - la saturation s'effondre dans les hautes lumieres,
 *   - le point blanc reste sous 255 (epaule marquee, quasi aucun ecretage).
 */

/* Extension explicite: ce module est aussi importe tel quel par le smoke test
   Node (`scripts/smoke-vision-preset.mjs`), ou la resolution ESM l'exige. */
import { buildLut3d, LUT_SIZE } from './lut3d.js';
import { IMPORTED_PRESETS } from './presets/index.js';

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

/* Interpolation lineaire sur des points de controle [x, y] tries. */
function evalCurve(points, x) {
    if (x <= points[0][0]) return points[0][1];
    const lastIndex = points.length - 1;
    if (x >= points[lastIndex][0]) return points[lastIndex][1];
    for (let i = 1; i <= lastIndex; i += 1) {
        const [x1, y1] = points[i];
        if (x <= x1) {
            const [x0, y0] = points[i - 1];
            const span = x1 - x0;
            const t = span > 0 ? (x - x0) / span : 0;
            return y0 + (y1 - y0) * t;
        }
    }
    return points[lastIndex][1];
}

const smoothstep = (edge0, edge1, x) => {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

/* ---------- HSL ---------- */

function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    return [h, s, l];
}

function hueToRgb(p, q, t) {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
}

function hslToRgb(h, s, l) {
    if (s <= 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hk = (((h % 360) + 360) % 360) / 360;
    return [
        hueToRgb(p, q, hk + 1 / 3),
        hueToRgb(p, q, hk),
        hueToRgb(p, q, hk - 1 / 3),
    ];
}

/* ---------- Melangeur par bande de teinte ---------- */

/*
 * Memes ancres que le melangeur TSL de Lightroom. L'interpolation lineaire entre
 * ancres adjacentes reproduit son comportement et reste lisse par construction,
 * ce qui est indispensable pour que la LUT s'interpole proprement.
 * `hue` est en degres, `sat` et `lum` en pourcentage relatif.
 */
const BAND_ANCHORS = [
    { at: 0, hue: 4, sat: -10, lum: 0 },
    { at: 30, hue: 2, sat: -4, lum: 4 },
    { at: 60, hue: -3, sat: -28, lum: 3 },
    { at: 120, hue: -16, sat: -55, lum: 6 },
    { at: 180, hue: -1, sat: -20, lum: 0 },
    { at: 240, hue: -38, sat: -28, lum: -10 },
    { at: 270, hue: -18, sat: -30, lum: -5 },
    { at: 300, hue: -8, sat: -25, lum: -2 },
    { at: 360, hue: 4, sat: -10, lum: 0 },
];

function sampleBands(hue) {
    const h = (((hue % 360) + 360) % 360);
    for (let i = 1; i < BAND_ANCHORS.length; i += 1) {
        const next = BAND_ANCHORS[i];
        if (h <= next.at) {
            const previous = BAND_ANCHORS[i - 1];
            const span = next.at - previous.at;
            const t = span > 0 ? (h - previous.at) / span : 0;
            return {
                hue: previous.hue + (next.hue - previous.hue) * t,
                sat: previous.sat + (next.sat - previous.sat) * t,
                lum: previous.lum + (next.lum - previous.lum) * t,
            };
        }
    }
    return { hue: 0, sat: 0, lum: 0 };
}

/* ---------- Preset Powlisher ---------- */

/*
 * Courbe maitre, appliquee canal par canal.
 * Pied leger (noirs denses, jamais leves) et epaule franche: le point blanc sort
 * a 0.952, ce qui reproduit l'absence quasi totale d'ecretage mesuree, et le
 * `Hautes lumieres -30` lu directement dans sa video Lightroom.
 */
const MASTER_CURVE = [
    [0, 0],
    [0.06, 0.048],
    [0.15, 0.135],
    [0.30, 0.298],
    [0.50, 0.512],
    [0.68, 0.700],
    [0.82, 0.836],
    [0.92, 0.906],
    [1, 0.952],
];

/*
 * Virage split: ecart cible R-G et B-G, en unites 0-255, en fonction de la
 * luminance APRES courbe maitre. Ce sont directement les valeurs medianes
 * mesurees sur les pixels quasi neutres des 19 photos (section 3.1 de l'audit).
 */
const DELTA_R = [
    [0, 0], [0.10, -1.0], [0.20, -1.2], [0.30, -2.5], [0.45, -5.0],
    [0.55, -4.5], [0.70, -1.5], [0.80, 2.0], [0.90, 1.0], [1, 1.0],
];
const DELTA_B = [
    [0, 0], [0.10, -1.0], [0.20, -2.5], [0.30, -5.5], [0.45, -9.5],
    [0.55, -10.0], [0.70, -11.0], [0.75, -12.3], [0.80, -9.0],
    [0.90, -4.5], [1, -3.0],
];

/*
 * Desaturation des hautes lumieres. Les mesures montrent un effondrement
 * (S 0.42 -> 0.05 entre 40% et 95% de luminance), mais une partie est propre au
 * contenu des photos. On reste donc volontairement plus doux que la mesure brute,
 * pour ne pas tuer un coucher de soleil - ou la saturation haute est le sujet.
 */
function highlightSatFactor(l) {
    return 1 - 0.60 * smoothstep(0.68, 1.0, l);
}

/*
 * L'ordre reproduit celui de Lightroom:
 *   courbe -> melangeur TSL -> etalonnage (virage) -> effets.
 * Il compte vraiment: mettre le virage AVANT le melangeur laisse ce dernier
 * desaturer les neutres a peine colores qu'on vient de creer, et l'ecart B-G
 * vise dans les hautes lumieres retombe d'un quart.
 */
function powlisherTransform(input) {
    /* 1. Courbe maitre, canal par canal. */
    const r0 = evalCurve(MASTER_CURVE, input[0]);
    const g0 = evalCurve(MASTER_CURVE, input[1]);
    const b0 = evalCurve(MASTER_CURVE, input[2]);

    /* 2. Melangeur par bande de teinte.
       Tout est pondere par la saturation: un pixel quasi gris n'a pas de teinte
       definie, le decaler creerait une discontinuite que l'interpolation de la
       LUT transformerait en bandes. Les neutres sont traites a l'etape 4. */
    let [h, s, l] = rgbToHsl(r0, g0, b0);
    const satWeight = smoothstep(0, 0.12, s);
    if (satWeight > 0) {
        const band = sampleBands(h);
        h += band.hue * satWeight;
        s = clamp01(s * (1 + (band.sat / 100) * satWeight));
        l = clamp01(l * (1 + (band.lum / 100) * satWeight));
    }

    /* 3. Les hautes lumieres virent creme. */
    s = clamp01(s * highlightSatFactor(l));

    const mixed = hslToRgb(h, s, l);

    /* 4. Virage split pilote par la luminance, en dernier. */
    const luma = 0.2126 * mixed[0] + 0.7152 * mixed[1] + 0.0722 * mixed[2];
    return [
        clamp01(mixed[0] + evalCurve(DELTA_R, luma) / 255),
        clamp01(mixed[1]),
        clamp01(mixed[2] + evalCurve(DELTA_B, luma) / 255),
    ];
}

/* ==========================================================================
 * `powlisher-ciel` — powlisher, mais le ciel ARRIVE quelque part au lieu d'etre
 * tourne d'un angle fixe.
 *
 * VALIDE A L'OEIL PAR LE PORTEUR DU PROJET le 2026-08-12, sur ses propres
 * photos, a cote de `powlisher` et de CN17: « un ciel plus naturel sans perdre
 * le reste de powlisher ». Il est inscrit dans `docs/presets-valides.md`:
 * CE PRESET NE SE SUPPRIME PAS. Si un futur variant du ciel voit le jour, il
 * s'AJOUTE — il ne remplace pas celui-ci.
 *
 * LE DEFAUT DE V1, ET IL EST MESURABLE. V1 retire un angle fixe au bleu (-38°
 * au plus fort du melangeur). Un angle fixe ne sait pas ou il part ni ou il
 * arrive: un bleu profond et un bleu deja cyan recoivent le meme traitement, et
 * le second finit trop loin, dans le menthe. Sur une photo de crique
 * mediterraneenne (ciel a 214°, chroma 0,58), V1 pose le ciel a 185,2° —
 * en dessous de la fenetre 190-199° ou atterrissent TOUS ses ciels a lui.
 *
 * La preuve tient en une mesure: on applique le preset a SES PROPRES PHOTOS,
 * qui sont deja ses edits finis, donc deja a la bonne couleur. Un preset juste
 * ne devrait presque pas les bouger.
 *
 *   preset applique a ses photos        img16   img18   img35   img36   img37
 *   powlisher V1                        -21,3   -21,5   -17,9   -21,4   -31,1
 *   powlisher-ciel                       -6,1    -4,1    -1,8    -6,1    -9,4
 *
 * V1 leur retire encore 22° de moyenne. Il ne « place » pas le ciel, il le
 * pousse — et il le pousse a chaque passage.
 *
 * LA REGLE, DONC: le ciel CONVERGE vers la teinte ou les siens atterrissent.
 * Loin de la cible ca tire fort, pres de la cible ca ne fait presque rien. Le
 * meme mecanisme explique alors les deux faits que le corpus donnait ensemble et
 * qu'une rotation fixe ne pouvait pas reconcilier: ses ciels finissent tous dans
 * une fenetre etroite (190-199° sur cinq photos), alors que leurs entrees, elles,
 * n'ont aucune raison d'etre groupees.
 *
 * ATTENTION — LE PIEGE QUI A TUE LA TENTATIVE PRECEDENTE. Un premier essai
 * (`powlisher-v2`, supprime) declenchait sa regle du ciel sur la TEINTE d'un
 * pixel sans verifier que cette teinte veuille dire quelque chose. Dans un voile
 * quasi blanc, la teinte est du bruit: deux pixels que l'oeil voit identiques
 * peuvent etre a 40° l'un de l'autre. La regle basculait donc d'un pixel a
 * l'autre au milieu d'un degrade lisse, et dessinait un trait de contour en
 * plein ciel — parfaitement visible a l'ecran, invisible dans toutes les mesures
 * de moyennes. D'ou `CIEL_FIABLE` ci-dessous, et le test qui le garde.
 * ========================================================================== */

/*
 * La teinte visee: la mediane de ses cinq photos a ciel franc (190, 195, 190,
 * 199, 194). Ce n'est pas un reglage esthetique, c'est la ou ses ciels tombent.
 */
const CIEL_CIBLE = 195;

/*
 * Le domaine. Il commence JUSTE EN DESSOUS de la cible, et c'est voulu: un
 * turquoise d'eau peu profonde (160-172°) est deja plus cyan que la cible, le
 * pousser vers elle serait ajouter une transformation la ou on cherche
 * justement a en retirer. Bords larges, comme partout ici: la LUT interpole
 * entre ses nœuds, toute bascule doit etre continue.
 */
const CIEL_HUE_IN = [174, 192];
const CIEL_HUE_OUT = [258, 285];

/*
 * La force de convergence, selon la chroma `(max-min)/max` — pas la saturation
 * HSL, qui gonfle sur les pixels clairs et confond un ciel pale avec un ciel
 * franc. Un bleu franc est tire fort (0,85), un ciel delave a peine (0,35): il
 * est deja presque blanc, le tirer ne ferait que salir sa couleur.
 */
const CIEL_CHROMA = [0.10, 0.45];
const CIEL_PULL = [0.35, 0.85];

/*
 * LE GARDE-FOU. En dessous de cette chroma, un pixel n'a plus de teinte: c'est
 * un gris tres legerement colore, et sa teinte mesuree est du bruit de capteur.
 * Toute regle qui depend de la teinte doit donc s'y eteindre, sans quoi elle
 * trace un contour arbitraire dans le premier voile venu. C'est exactement ce
 * qui est arrive a la version precedente.
 */
const CIEL_FIABLE = [0.03, 0.12];

/*
 * Part du virage split retenue dans le bleu. Elle compte plus qu'il n'y parait:
 * les -12/255 de bleu du virage sont enormes RELATIVEMENT a la chroma d'un ciel
 * pale, et le font pivoter de plusieurs degres a eux seuls. Sans cette retenue,
 * la convergence est defaite en aval par le virage — sur un ciel delave, elle en
 * perd la moitie du benefice (img37: -9,4° avec, -16,1° sans).
 */
const CIEL_SPLIT_HOLD = 0.55;

/* La chroma du corpus: `(max - min) / max`. Voir CIEL_CHROMA. */
function chromaSat(r, g, b) {
    const max = Math.max(r, g, b);
    if (max <= 0) return 0;
    return (max - Math.min(r, g, b)) / max;
}

/*
 * La regle du ciel, isolee pour etre PARTAGEE.
 *
 * `powlisher-showcase` en avait besoin lui aussi: construit sur le melangeur de
 * V1, il faisait virer un ciel a 210° vers 163° — le meme defaut de cyan, qu'on
 * venait justement de corriger ailleurs. Son smoke l'a attrape. Plutot que de
 * recopier la regle, on la sort ici: une seule definition, un seul endroit ou la
 * corriger.
 *
 * Rend `bleu` (1 sur un ciel lisible, 0 ailleurs — et 0 des que la teinte n'est
 * plus une information) et `versCible`, le decalage de teinte a appliquer.
 */
function regleDuCiel(h, sv) {
    const teinteFiable = smoothstep(CIEL_FIABLE[0], CIEL_FIABLE[1], sv);
    const bleu = smoothstep(CIEL_HUE_IN[0], CIEL_HUE_IN[1], h)
        * (1 - smoothstep(CIEL_HUE_OUT[0], CIEL_HUE_OUT[1], h))
        * teinteFiable;
    const force = CIEL_PULL[0] + (CIEL_PULL[1] - CIEL_PULL[0])
        * smoothstep(CIEL_CHROMA[0], CIEL_CHROMA[1], sv);
    return { bleu, versCible: (CIEL_CIBLE - h) * force };
}

function powlisherCielTransform(input) {
    /* 1. Courbe maitre, canal par canal. Identique a V1. */
    const r0 = evalCurve(MASTER_CURVE, input[0]);
    const g0 = evalCurve(MASTER_CURVE, input[1]);
    const b0 = evalCurve(MASTER_CURVE, input[2]);

    let [h, s, l] = rgbToHsl(r0, g0, b0);

    /*
     * 2. Le domaine du ciel. `bleu` vaut 1 sur un bleu franc et lisible, et
     * tombe a 0 des que la teinte cesse d'etre une information — c'est le
     * facteur `teinteFiable` qui porte tout le correctif d'artefact.
     */
    const sv = chromaSat(r0, g0, b0);
    const { bleu, versCible } = regleDuCiel(h, sv);

    /*
     * 3. Melangeur par bande de teinte. Hors du bleu, c'est V1 mot pour mot.
     * Dans le bleu, la rotation fixe cede la place a la convergence — et les
     * deux se relaient continument, puisque `bleu` varie sans marche.
     * La ponderation par la saturation est celle de V1: elle protege l'axe des
     * gris, ou la teinte n'existe pas.
     */
    const satWeight = smoothstep(0, 0.12, s);
    if (satWeight > 0) {
        const band = sampleBands(h);
        h += satWeight * (band.hue * (1 - bleu) + versCible * bleu);
        s = clamp01(s * (1 + (band.sat / 100) * satWeight));
        l = clamp01(l * (1 + (band.lum / 100) * satWeight));
    }

    /* 4. Les hautes lumieres virent creme. Identique a V1. */
    s = clamp01(s * highlightSatFactor(l));

    const mixed = hslToRgb(h, s, l);

    /* 5. Virage split, en dernier — retenu dans le bleu, voir CIEL_SPLIT_HOLD. */
    const luma = 0.2126 * mixed[0] + 0.7152 * mixed[1] + 0.0722 * mixed[2];
    const splitWeight = 1 - CIEL_SPLIT_HOLD * bleu;
    return [
        clamp01(mixed[0] + (evalCurve(DELTA_R, luma) / 255) * splitWeight),
        clamp01(mixed[1]),
        clamp01(mixed[2] + (evalCurve(DELTA_B, luma) / 255) * splitWeight),
    ];
}

/* ==========================================================================
 * `powlisher-showcase` — le clair-obscur de ses photos de voiture.
 *
 * VALIDE le 2026-08-12 par le porteur du projet, teste sur des photos Unsplash
 * (voiture en ville). Il est inscrit dans `docs/presets-valides.md`: IL NE SE
 * SUPPRIME PAS, et un futur variant s'AJOUTE a cote au lieu de le remplacer.
 *
 * CE QUE LA MESURE DIT DE SES TROIS PHOTOS DE VOITURE (img05, img06, img07):
 *
 *   1. Elles sont SOMBRES. 48 %, 52 % et 69 % des pixels sont sous 40/255. La
 *      luminance mediane tombe a 42, 37 et 30/255. Ce ne sont pas des photos
 *      normales assombries: elles sont construites en clair-obscur.
 *   2. Les hautes lumieres sont BRIDEES. Le 1 % le plus clair plafonne a 183,
 *      170 et 137/255. Rien n'approche le blanc — c'est ce qui donne la
 *      sensation de pellicule plutot que de photo de telephone.
 *   3. LE SUJET EST LA SEULE CHOSE COLOREE. Chroma de la voiture 0,61 / 0,88 /
 *      0,81, contre 0,35 / 0,45 / 0,26 pour le decor — un ecart de x1,7 a x3,2.
 *      Le jaune ne saute pas aux yeux parce qu'il est sature: il saute aux yeux
 *      parce que TOUT LE RESTE a ete vide.
 *   4. Et c'est CHAUD SUR CHAUD, pas orange-et-teal. Sujet a 31-37°, decor a
 *      34-60°. Aucun contraste froid: murs, sol, rouille et herbe seche sont
 *      dans la meme famille ocre.
 *
 * CE QUE CE PRESET NE PEUT PAS FAIRE, ET IL FAUT LE SAVOIR. La lumiere —
 * voiture au soleil devant un hangar noir, flaque de lumiere au crepuscule —
 * c'est le lieu, l'heure et l'angle. Aucune table de couleurs ne la fabrique.
 * Sur une voiture photographiee a midi sur un parking, ce preset donnera une
 * photo sombre et desaturee, pas img07.
 *
 * LA LIMITE DU MECANISME, ET ELLE EST REELLE. Une LUT ne sait pas qu'il y a une
 * voiture dans le cadre: elle voit des couleurs. La regle se declenche donc sur
 * la SATURATION, pas sur le sujet. Ca tombe juste sur une voiture vive dans un
 * decor industriel terne — c'est exactement la situation visee. Sur une photo ou
 * le ciel ou un auvent rouge est l'element le plus sature, c'est LUI qui
 * recevra le projecteur. C'est un preset de SITUATION, pas un look universel.
 *
 * Il porte aussi des effets qu'une LUT ne peut pas contenir (grain, vignetage,
 * relief): voir `spatialFilters` dans son entree du registre.
 * ========================================================================== */

/*
 * La courbe du clair-obscur. Pied ecrase (0,30 -> 0,215) et epaule tres basse:
 * le point blanc sort a 0,74, soit 189/255 — dans la fourchette 137-183 mesuree
 * chez lui, et tres loin des 243 de `powlisher`.
 */
const SHOWCASE_CURVE = [
    [0, 0], [0.06, 0.026], [0.15, 0.082], [0.30, 0.215], [0.50, 0.395],
    [0.68, 0.545], [0.82, 0.648], [0.92, 0.706], [1, 0.74],
];

/*
 * LE MECANISME CENTRAL: le creux de saturation.
 *
 * On retire sa couleur a ce qui est MOYENNEMENT colore — le decor: beton, tole,
 * asphalte, herbe seche — et on laisse intact ce qui l'est deja beaucoup — le
 * sujet. C'est ce seul reglage qui produit l'ecart x1,7 a x3,2 mesure chez lui.
 *
 * Les bornes ne sont pas au juge: elles encadrent les deux populations
 * mesurees. Le decor vit entre 0,26 et 0,45 de chroma, le sujet entre 0,61 et
 * 0,88. Le creux couvre donc la premiere et s'arrete avant la seconde.
 */
const SHOWCASE_DRAIN_IN = [0.10, 0.26];   /* en dessous: un gris, on n'y touche pas */
const SHOWCASE_DRAIN_OUT = [0.52, 0.66];  /* au dessus: le sujet, on le laisse */
const SHOWCASE_DRAIN = 0.62;              /* part de chroma retiree au decor */
/* Et un soupcon de renfort sur le sujet, pour que le contraste vienne des deux
   cotes. Volontairement faible: la force du look vient du vidage, pas du gain. */
const SHOWCASE_BOOST = 0.10;

/*
 * L'ocre du decor. On MELANGE vers une couleur cible au lieu de tourner la
 * teinte: un pixel presque gris n'a pas de teinte a tourner, et la tourner
 * creerait la discontinuite qui dessine un contour apres interpolation de la
 * LUT (c'est la lecon qui a coute trois presets, voir `powlisher-ciel`).
 *
 * Le poids suit exactement le vidage: ce qu'on a decolore, on le reteint. Un
 * pixel qu'on n'a pas vide — le sujet, ou un vrai gris — n'est pas touche.
 */
const SHOWCASE_OCRE = 38;
const SHOWCASE_OCRE_FORCE = 0.42;

/*
 * ... SAUF sur le bleu, et ca s'est vu tout de suite a l'ecran. Son decor a lui
 * est chaud (beton, tole, rouille, herbe seche), donc l'ocre lui va. Mais sur
 * une photo avec du ciel, le meme melange peint le ciel en KAKI — un resultat
 * que ce photographe ne produit nulle part.
 *
 * Un ciel un peu delave reste une image; un ciel kaki est un bug visuel. On
 * retire donc l'ocre dans la bande bleue, sans toucher au vidage: le ciel perd
 * de la couleur comme le reste du decor, mais il reste bleu.
 *
 * Cette ponderation depend de la TEINTE, donc elle n'a le droit d'exister que
 * la ou la teinte veut dire quelque chose — c'est le cas: elle ne s'applique
 * qu'a l'interieur du vidage, qui demarre a 0,10 de chroma.
 */
const SHOWCASE_BLEU_IN = [172, 190];
const SHOWCASE_BLEU_OUT = [258, 280];

function powlisherShowcaseTransform(input) {
    /* 1. La courbe du clair-obscur, canal par canal. */
    const r0 = evalCurve(SHOWCASE_CURVE, input[0]);
    const g0 = evalCurve(SHOWCASE_CURVE, input[1]);
    const b0 = evalCurve(SHOWCASE_CURVE, input[2]);

    let [h, s, l] = rgbToHsl(r0, g0, b0);

    /* 2. Le melangeur par bande de teinte de `powlisher` — verts olive, peau
       preservee — PLUS la regle du ciel de `powlisher-ciel`. Sans elle, un ciel
       a 210° ressortait a 163°, dans le cyan que ce photographe ne produit
       jamais: le meme defaut que celui corrige par `powlisher-ciel`, et son
       smoke l'a attrape ici. */
    const svCiel = chromaSat(r0, g0, b0);
    const { bleu: cielBleu, versCible } = regleDuCiel(h, svCiel);
    const satWeight = smoothstep(0, 0.12, s);
    if (satWeight > 0) {
        const band = sampleBands(h);
        h += satWeight * (band.hue * (1 - cielBleu) + versCible * cielBleu);
        s = clamp01(s * (1 + (band.sat / 100) * satWeight));
        l = clamp01(l * (1 + (band.lum / 100) * satWeight));
    }

    /*
     * 3. Le creux de saturation. `vide` vaut 1 sur le decor, 0 sur un gris et 0
     * sur le sujet. La chroma est mesuree APRES la courbe, sur la couleur telle
     * qu'elle sera vue.
     */
    const sv = chromaSat(...hslToRgb(h, s, l));
    const vide = smoothstep(SHOWCASE_DRAIN_IN[0], SHOWCASE_DRAIN_IN[1], sv)
        * (1 - smoothstep(SHOWCASE_DRAIN_OUT[0], SHOWCASE_DRAIN_OUT[1], sv));
    const sujet = smoothstep(SHOWCASE_DRAIN_OUT[0], SHOWCASE_DRAIN_OUT[1], sv);

    s = clamp01(s * (1 - SHOWCASE_DRAIN * vide) * (1 + SHOWCASE_BOOST * sujet));

    /* 4. Les hautes lumieres virent creme, comme sur toute la famille. */
    s = clamp01(s * highlightSatFactor(l));

    let out = hslToRgb(h, s, l);

    /* 5. L'ocre, sur ce qu'on vient de vider — et seulement la, et jamais sur
       le bleu (sinon le ciel vire au kaki, voir SHOWCASE_BLEU_IN). */
    const luma = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
    const bleu = smoothstep(SHOWCASE_BLEU_IN[0], SHOWCASE_BLEU_IN[1], h)
        * (1 - smoothstep(SHOWCASE_BLEU_OUT[0], SHOWCASE_BLEU_OUT[1], h));
    const ocre = vide * SHOWCASE_OCRE_FORCE * (1 - bleu);
    if (ocre > 0) {
        const cible = hslToRgb(SHOWCASE_OCRE, 0.30, luma);
        out = [
            out[0] + (cible[0] - out[0]) * ocre,
            out[1] + (cible[1] - out[1]) * ocre,
            out[2] + (cible[2] - out[2]) * ocre,
        ];
    }

    /* 6. Virage split de la famille, en dernier — retenu dans le bleu comme sur
       `powlisher-ciel`, pour la meme raison: sur un pixel pale, ses -12/255 de
       bleu pesent enormement RELATIVEMENT a la chroma et defont la convergence
       en aval. */
    const luma2 = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
    /*
     * Retenue PLUS FORTE que sur `powlisher-ciel` (0,85 contre 0,55), et la
     * raison tient a la courbe: ce preset assombrit beaucoup, donc les memes
     * -12/255 de bleu pesent bien plus RELATIVEMENT a la chroma d'un pixel
     * sombre. Avec la retenue de `powlisher-ciel`, le ciel repartait a 185° au
     * lieu de 195 — la convergence etait defaite en aval, exactement le piege
     * documente plus haut.
     */
    const splitWeight = 1 - 0.85 * cielBleu;
    return [
        clamp01(out[0] + (evalCurve(DELTA_R, luma2) / 255) * splitWeight),
        clamp01(out[1]),
        clamp01(out[2] + (evalCurve(DELTA_B, luma2) / 255) * splitWeight),
    ];
}

/* ---------- Registre ---------- */

/*
 * Un preset arrive par l'un de deux chemins, et les deux finissent en LUT:
 *
 *  - `transform` : une fonction pure ecrite ici (cas de `powlisher`, reconstruit
 *    par mesure). Elle est compilee en LUT au premier usage.
 *  - `getLut`    : une table deja capturee, importee de Lightroom via une Hald
 *    CLUT (`scripts/import-lightroom-preset.mjs`). Rien a compiler: c'est le
 *    resultat mesure du moteur d'Adobe, pas une approximation.
 *
 * Cote rendu, les deux sont indiscernables — d'ou le fait qu'ajouter un preset
 * importe ne coute rien au moteur.
 */
export const VISION_PRESETS = [
    {
        id: 'powlisher',
        label: 'Powlisher',
        hint: 'Cinématique, ciel teal, peau chaude',
        description: 'Ciel tiré vers le teal, verts olive, peau préservée, hautes '
            + 'lumières crème et noirs denses. Reconstruit à partir de 19 photos.',
        bestFor: 'voyage, paysage, extérieur, portrait en lumière naturelle',
        avoidFor: 'photos déjà très filtrées ou aux blancs déjà écrêtés',
        /*
         * 100, comme tout preset: la definition d'un preset, c'est son rendu a
         * pleine force. Ce reglage etait a 85 sans justification nulle part, et
         * ca lui coutait sa signature — le ciel profond ressortait a 201° au
         * lieu de 193,7°, donc encore BLEU, hors de la fourchette teal 178-196°
         * que ce preset a ete reconstruit pour atteindre (et que son smoke
         * verifie, en appelant la fonction a pleine force).
         *
         * Le curseur reste offert a l'utilisateur: c'est un choix esthetique,
         * jamais un correctif technique. Baisser l'intensite ne reduit pas le
         * contraste, ca melange l'image traitee avec l'originale.
         */
        recommendedIntensity: 100,
        transform: powlisherTransform,
    },
    {
        id: 'powlisher-ciel',
        label: 'Powlisher Ciel',
        hint: 'Le bleu du ciel reste du bleu',
        description: 'Le rendu de Powlisher — sol chaud, verts olive, noirs denses — '
            + 'mais le ciel converge vers la teinte où atterrissent ses ciels à lui '
            + '(190–199°) au lieu d\'être tourné d\'un angle fixe. Un ciel déjà '
            + 'bleu-cyan n\'est donc presque pas touché, là où Powlisher le poussait '
            + 'au menthe.',
        bestFor: 'ciel bleu, mer, plein air, paysage, voyage',
        avoidFor: 'nuit et intérieur — sans ciel, c\'est `powlisher` tel quel',
        recommendedIntensity: 100,
        transform: powlisherCielTransform,
    },
    {
        id: 'powlisher-showcase',
        label: 'Powlisher Showcase',
        hint: 'Clair-obscur : le sujet garde sa couleur, le décor la perd',
        description: 'Le clair-obscur de ses photos de voiture : image sombre, hautes '
            + 'lumières bridées, et surtout le décor vidé de sa couleur pour que le '
            + 'sujet soit la seule chose colorée du cadre. Porte aussi son grain, son '
            + 'vignetage et son relief — ils ne peuvent pas tenir dans une LUT.',
        bestFor: 'voiture, moto, objet coloré dans un décor terne, lumière dure ou rasante',
        avoidFor: 'lumière plate de midi et scènes où tout est coloré — la règle '
            + 'choisit le plus saturé du cadre, pas le sujet',
        /*
         * Ce qu'une LUT ne peut pas contenir, parce que ca depend des pixels
         * VOISINS ou de la POSITION dans l'image. C'est le mecanisme deja
         * utilise par les presets importes de Lightroom.
         *
         *   grain 8     RECALE le 2026-08-15, quand l'echelle du grain est
         *               devenue celle de Lightroom. La valeur d'avant etait 20
         *               sur l'ancienne echelle, qui produisait un ecart-type de
         *               2,76/255 au ton moyen; 8 sur la nouvelle en produit
         *               2,94. C'est la MEME force au ton moyen.
         *
         *               Mais ce n'est pas le meme rendu, et il ne faut pas le
         *               pretendre: l'ancien etage s'eteignait dans les noirs et
         *               les blancs (une cloche), le nouveau pose un plat comme
         *               Lightroom. Le grain apparait donc maintenant dans les
         *               ciels et les ombres lisses, ou il n'y en avait pas.
         *
         *               REVALIDE A L'OEIL le 2026-08-16, a 1:1, sur quatre
         *               photos de voiture: il tient de la tole lisse au noir du
         *               pare-brise, sans tache ni bruit de couleur. Reserve
         *               honnete: aucune de ces quatre n'a de grand ciel, qui
         *               est justement le cas ou un grain plat se voit le plus.
         *
         *               Ce qui suit est le raisonnement d'origine, garde parce
         *               qu'il dit pourquoi la valeur est basse :
         *
         *               Le raisonnement initial: ses photos portent un grain
         *               d'ecart-type ~2,5/255, et 35 en produit 2,39 dans
         *               l'app. Mais ce ~2,5 a ete mesure sur ses JPEG publies
         *               reduits a 900 px de large, alors que notre grain est
         *               pose a la resolution de la photo. Reduire une image
         *               MOYENNE son grain: les deux chiffres ne sont donc pas
         *               comparables directement, et la cible etait trop haute.
         *
         *               A l'oeil, 35 passe sur une photo de voiture — ses
         *               cadres sont pleins de matiere (beton, asphalte,
         *               vegetation) qui masque le grain — mais se voit trop sur
         *               un paysage, ou un grand ciel lisse ne masque rien. Un
         *               preset doit tenir sur les deux: 20 (1,05/255 mesure).
         *               Le curseur reste offert, en tete du panneau.
         *   vignette 3  RECALE le 2026-08-16, quand l'echelle du vignetage est
         *               devenue celle de Lightroom. C'etait 22 sur l'ancienne
         *               echelle — et la mesure a montre que ce 22 ne faisait
         *               presque RIEN: un degrade circulaire multiplie en sRVB,
         *               qui n'atteignait sa pleine force qu'au-dela du cadre.
         *               Assombrissement moyen: 3,3/255. 3 sur la nouvelle
         *               echelle reproduit exactement ca.
         *
         *               MONTE A 8 le 2026-08-16, apres l'avoir regarde. Ce 3
         *               n'avait jamais ete juge a l'oeil pour ce qu'il FAIT,
         *               mais pour ce qu'il ne faisait pas: il reproduisait
         *               fidelement un reglage casse. Sur les quatre photos de
         *               la planche, 8 assombrit le coin de 15/255 la ou le
         *               fond est clair, et ne touche a rien la ou le coin est
         *               deja noir — le vignetage MULTIPLIE la lumiere, donc il
         *               n'a rien a retirer d'un noir. Le cadre se ferme sans
         *               que ca se lise comme un effet.
         *               Planche: `node scripts/planche-showcase.mjs`.
         *
         *               Le raisonnement d'origine: aucune surface uniforme dans
         *               ses trois photos ne permet de separer le vignetage de la
         *               scene elle-meme. Assez pour fermer le cadre, pas assez
         *               pour se voir comme un effet.
         *   clarity 14  le rendu « matiere » sur la tole et le beton. Revalide
         *               a l'oeil le 2026-08-16 sur le nouveau rayon (4x plus
         *               large): la matiere est la, aucun halo sur les contours
         *               de la voiture, qui etait le risque du rayon elargi.
         */
        spatialFilters: { grain: 8, vignette: 8, clarity: 14 },
        recommendedIntensity: 100,
        transform: powlisherShowcaseTransform,
    },
    ...IMPORTED_PRESETS,
];

export const VISION_PRESET_BY_ID = VISION_PRESETS.reduce((map, preset) => {
    map[preset.id] = preset;
    return map;
}, {});

/*
 * LUT compilees a la demande puis conservees: une compilation coute ~35937
 * evaluations (quelques millisecondes) et n'a lieu qu'une fois par session.
 */
const lutCache = new Map();

export function getPresetLut(presetId) {
    if (!presetId) return null;
    if (lutCache.has(presetId)) return lutCache.get(presetId);
    const preset = VISION_PRESET_BY_ID[presetId];
    if (!preset) return null;
    /* Preset importe: la table est deja la, il n'y a rien a compiler. */
    const lut = typeof preset.getLut === 'function'
        ? preset.getLut()
        : buildLut3d(preset.transform, LUT_SIZE);
    lutCache.set(presetId, lut);
    return lut;
}

/* Expose la fonction pure, pour les tests et les mesures de non-regression. */
export function getPresetTransform(presetId) {
    return VISION_PRESET_BY_ID[presetId]?.transform || null;
}
