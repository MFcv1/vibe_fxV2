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
/* ==========================================================================
 * powlisher-cine — le tronc, mesure au lieu d'etre vise
 * ==========================================================================
 *
 * Ce preset ne partage pas la methode des `powlisher*` qui le precedent. Ceux-la
 * ont ete regles pour ATTEINDRE quelques cibles choisies a la main (le ciel a
 * 195 degres, la peau entre 27 et 36). Celui-ci est la mediane d'un deplacement
 * MESURE.
 *
 * Le materiau, le 2026-08-24: 324 photos de `@powl_d` publiees entre mai et
 * aout 2026 — donc un seul et meme traitement, sans melange d'epoques —
 * rangees a la main en douze familles de sujet. En face, 461 photos des MEMES
 * sujets par des centaines d'auteurs differents (Wikimedia Commons).
 *
 * Pourquoi ce tas d'en face. On ne voit jamais ses fichiers de depart, donc on
 * ne peut pas apprendre « entree -> sortie ». Mais en comparant sa densite de
 * couleurs a celle d'un tas qui montre les memes scenes SANS porter son
 * traitement, on obtient la direction du deplacement. « Neutre » ne veut pas
 * dire « non retouche », ce qui serait introuvable: ca veut dire non correle a
 * lui — des centaines de retouches individuelles qui s'annulent en moyenne.
 *
 * Et pourquoi douze familles plutot qu'un seul tas: ce qui survit a douze
 * sujets sans rapport ne PEUT PAS etre du decor. Une cabine d'avion, un bord de
 * mer et une facade n'ont aucune raison commune de rendre les memes gris. Ce
 * qui se repete de l'un a l'autre est le traitement, et rien d'autre. C'est la
 * seule raison pour laquelle les chiffres ci-dessous ont le droit d'exister.
 *
 * Mesures hors depot: ~/Desktop/powlisher-biblio/ (`transport.json`,
 * `densites-lui.json`). Ce ne sont pas nos photos, elles ne sont pas versionnees.
 */

/* La courbe maitre, appariee quantile a quantile entre les deux tas.
 *
 * Elle assombrit tout le bas (64 -> 45, 128 -> 117), redevient neutre vers 170,
 * puis RETIENT le haut (192 -> 184, 224 -> 203, 240 -> 218).
 *
 * Le dernier point est a nous, pas a la mesure: l'appariement de quantiles
 * force 255 -> 255 parce que les deux fonctions de repartition finissent a 1,
 * ce qui fabriquait un mur vertical entre 240 et 255. On le remplace par une
 * epaule qui finit a 232 — dans la fourchette de ses points blancs reels
 * (215 a 245 selon la famille, mediane 228), et surtout SANS ecretage, qui est
 * la regle la plus ferme de tout le corpus: 0,00 % de pixels a 255 dans les
 * douze familles. */
/* En unites 0-1, comme toutes les courbes de ce fichier: `evalCurve` travaille
 * dans l'espace du moteur, pas en 0-255. Les valeurs mesurees etaient en
 * 0-255 (0 -> 0, 64 -> 45, 128 -> 117, 192 -> 184, 224 -> 203, 255 -> 232) et
 * sont divisees par 255 ici. Ecrite d'abord en 0-255, elle sortait un blanc a
 * 112 sur 255 — l'image entiere ecrasee d'un facteur 2,3. */
const CINE_CURVE = [
    [0.0000, 0.0000], [0.0627, 0.0275], [0.1255, 0.0745],
    [0.1882, 0.1255], [0.2510, 0.1765], [0.3137, 0.2471],
    [0.3765, 0.3059], [0.4392, 0.3765], [0.5020, 0.4588],
    [0.5647, 0.5255], [0.6275, 0.6196], [0.6902, 0.6863],
    [0.7529, 0.7216], [0.8157, 0.7529], [0.8784, 0.7961],
    [0.9412, 0.8471], [1.0000, 0.9098],
];

/* --- sRGB <-> Lab (D65) ---------------------------------------------------
 * Le travail de couleur se fait en Lab et pas en TSL, contrairement aux presets
 * precedents. Raison: on veut agir sur la CHROMA et la teinte perceptives. En
 * TSL, un jaune et un bleu de meme « saturation » n'ont pas du tout le meme
 * poids visuel, et une regle unique appliquee aux deux en abime un pour servir
 * l'autre. Toutes les mesures du corpus sont d'ailleurs en Lab. */
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055);

function rgbToLab01(r, g, b) {
    const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function lab01ToRgb(L, A, B) {
    const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
    const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
    const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
    return [
        clamp01(linToSrgb(X * 3.2406 + Y * -1.5372 + Z * -0.4986)),
        clamp01(linToSrgb(X * -0.9689 + Y * 1.8758 + Z * 0.0415)),
        clamp01(linToSrgb(X * 0.0557 + Y * -0.2040 + Z * 1.0570)),
    ];
}

/* Les attracteurs de teinte, par bande de luminosite, en degres Lab.
 *
 * Mesures dans `densites-lui.json`: dans la bande haute, les DOUZE familles
 * posent leur pic entre 83 et 93 degres, avec un poids de 71 a 105 % — une mer,
 * un interieur de cafe, une moto et une cabine d'avion. Un second pic revient
 * vers 233-243 (le bleu) dans six familles.
 *
 * Les ombres, elles, sont vides ici volontairement: leurs pics vont de 23
 * degres en mer a 263 en avion. Aucun accord, donc aucun droit a bouger quoi
 * que ce soit — dans les ombres, ce qu'on mesure est de l'asphalte, de l'eau et
 * du feuillage, c'est-a-dire le sujet. */
/* --- LES ROTATIONS DE TEINTE, FACON PANNEAU TSL --------------------------
 *
 * POURQUOI CE MECANISME ET PAS L'AUTRE. La premiere version tirait chaque teinte
 * VERS un attracteur mesure. Ca marchait sur les chiffres et c'etait faux: un
 * attracteur fait CONVERGER deux teintes voisines, et sur un degrade lisse —
 * un ciel — la convergence se voit comme une bande. Le defaut a ete vu tout de
 * suite sur un ciel marocain.
 *
 * Aucun preset Lightroom ne peut produire ce defaut, parce qu'aucun ne contient
 * cette operation. Un preset Lightroom, c'est une courbe, des rotations de
 * bande d'un ANGLE FIXE, une saturation par plage et un etalonnage. Toutes ces
 * operations preservent l'ordre des couleurs: un bleu un peu plus clair reste un
 * bleu un peu plus clair. On s'y tient — d'autant que ses photos ont ete faites
 * dans Lightroom.
 *
 * Les angles: ecart entre la teinte moyenne de son tas et celle du tas neutre,
 * secteur par secteur, seulement la ou les huit familles s'accordent (mediane
 * superieure a la dispersion). Tout le reste rend zero, et zero veut dire
 * « il n'y touche pas ».
 *
 *   bleu    -6,7 degres dans les ombres, -11,3 puis -11,8 dans les clairs
 *   jaune   +5,1 dans les hautes lumieres
 *   vert    +2,2
 *   orange  +1,8 dans les hauts medians
 *
 * C'est tout. Ce sont des valeurs de vrai preset — le panneau TSL de Lightroom
 * plafonne vers 30 degres. L'ancien `powlisher` tournait le bleu bien plus fort,
 * et c'est de la que vient son ciel menthe. */
const CINE_ANCRES = [
    { h: 45, angle: 1.8, bas: 0.4 },     // orange
    { h: 75, angle: 5.1, bas: 0.2 },     // jaune
    { h: 135, angle: 2.2, bas: 1.0 },    // vert
    { h: 255, angle: -11.8, bas: 0.57 }, // bleu -> teal
];
/* Demi-largeur du fondu autour de chaque ancre. Un secteur a bord franc
 * fabriquerait exactement la bande qu'on vient de retirer. */
const CINE_LARGEUR = 45;

/* `bas` est la part de la rotation deja appliquee dans les ombres; elle monte
 * jusqu'a 1 dans les clairs, en fondu. */
const CINE_RAMPE_L = [12, 62];

/* Saturation par plage de luminosite (`transport.json`): il vide un peu les
 * ombres et les bas medians, ne touche pas les hauts medians, laisse respirer
 * les clairs. */
const CINE_CHROMA = [0.85, 0.83, 0.99, 1.11];

/* L'ETALONNAGE. Teinte posee sur ce qui devrait etre gris, mesuree en ECART au
 * tas neutre — sinon on prendrait le vernis des vieilles photos et des
 * peintures de Commons pour son geste. Huit familles, toutes du meme signe:
 *
 *            ombres   medians   clairs
 *   a*        -2,3     -2,2     -2,3      (constant: une derive verte)
 *   b*        +2,0     +5,6     +4,7      (jaune, maximal dans les medians)
 *
 * Ce n'est donc PAS un split-toning classique (ombres froides, clairs chauds):
 * c'est un voile jaune-vert uniforme. C'est ce qui fait la difference entre son
 * rendu et un filtre chaud ordinaire, qui lui partirait vers l'orange.
 *
 * LE DERNIER POINT DE CHAQUE TABLE N'EST PAS MESURE, il retombe vers zero.
 * La mesure ecarte les pixels au-dessus de L = 97 (a ce niveau la teinte n'est
 * plus fiable), donc on ne sait rien du sommet — et prolonger la derive verte
 * jusque dans les blancs a fait virer AU VERT-GRIS un grand ciel presque blanc,
 * vu tout de suite sur une photo a contre-jour. Un blanc reste blanc: c'est
 * aussi ce que font le film et Lightroom, dont les hautes lumieres convergent
 * vers le neutre.
 *
 * Les tables ont donc cinq points, poses a L = 0, 25, 50, 75 et 100. Les quatre
 * premiers portent la mesure, le cinquieme est l'epaule. */
const CINE_ETAL_A = [-2.3, -2.3, -2.2, -2.3, -0.3];
const CINE_ETAL_B = [2.0, 2.8, 5.6, 4.7, 0.8];

/* Fondu doux entre les valeurs d'une table, indexee par la luminosite Lab.
 * L'interpolation lineaire casse la pente a chaque point de passage, et l'oeil
 * voit ces cassures sur un grand degrade. */
function fonduParL(table, L) {
    const x = clamp01(L / 100) * (table.length - 1);
    const i = Math.min(table.length - 2, Math.floor(x));
    const t = x - i;
    return table[i] + (table[i + 1] - table[i]) * (t * t * (3 - 2 * t));
}

/* Poids en cloche autour d'une ancre: 1 au centre, 0 au bord, derivee nulle aux
 * deux bouts. */
function poidsAncre(h, centre) {
    const d = Math.abs(((h - centre + 540) % 360) - 180);
    if (d >= CINE_LARGEUR) return 0;
    return 0.5 * (1 + Math.cos(Math.PI * d / CINE_LARGEUR));
}

function rotationTeinte(h, L) {
    const monte = smoothstep(CINE_RAMPE_L[0], CINE_RAMPE_L[1], L);
    let rot = 0;
    for (const a of CINE_ANCRES) {
        const w = poidsAncre(h, a.h);
        if (w > 0) rot += a.angle * w * (a.bas + (1 - a.bas) * monte);
    }
    return rot;
}

function powlisherCineTransform(input) {
    /* 1. La tonalite, identique sur les trois canaux: la courbe dit ou il pose
     *    ses niveaux, pas un virage — celui-ci vient apres. */
    const r0 = evalCurve(CINE_CURVE, input[0]);
    const g0 = evalCurve(CINE_CURVE, input[1]);
    const b0 = evalCurve(CINE_CURVE, input[2]);

    let [L, A, B] = rgbToLab01(r0, g0, b0);

    /* 2. Saturation par plage de luminosite. */
    const gain = fonduParL(CINE_CHROMA, L);
    A *= gain;
    B *= gain;

    /* 3. Rotation de teinte, ponderee par la chroma. En dessous de quelques
     *    unites, un pixel n'a pas de teinte definie: la tourner fabriquerait,
     *    apres interpolation de la LUT, les bandes que ce projet a deja vues
     *    sur un ciel voile. */
    const chroma = Math.hypot(A, B);
    const aUneTeinte = smoothstep(3, 14, chroma);
    if (aUneTeinte > 0) {
        let h = Math.atan2(B, A) * 180 / Math.PI;
        if (h < 0) h += 360;
        const hNeuf = (h + rotationTeinte(h, L) * aUneTeinte) * Math.PI / 180;
        A = chroma * Math.cos(hNeuf);
        B = chroma * Math.sin(hNeuf);
    }

    /* 4. L'etalonnage: une teinte constante par plage, ajoutee a tout le monde.
     *    C'est ce que fait l'etalonnage de Lightroom, et c'est pour ca que ca ne
     *    peut pas creer de discontinuite: un decalage constant ne change jamais
     *    l'ordre de deux couleurs. */
    A += fonduParL(CINE_ETAL_A, L);
    B += fonduParL(CINE_ETAL_B, L);

    return lab01ToRgb(L, A, B);
}

/* ==========================================================================
 * LA FAMILLE CINE — deux axes, mesures separement
 * ==========================================================================
 *
 * `powlisher-cine` est la MEDIANE de ses 324 photos. Une mediane n'est pas un
 * look: c'est le point ou tous ses looks se rejoignent. Les presets ci-dessous
 * sont des points ailleurs sur le meme nuage.
 *
 * DEUX AXES, ET IL FAUT LES CHERCHER SEPAREMENT. Ses photos varient dans deux
 * directions independantes: ou il pose ses NIVEAUX, et quelle TEMPERATURE il
 * donne a sa lumiere. On peut poser ses noirs haut ou bas sans rien changer a
 * la couleur, et inversement. Chercher les deux dans un seul calcul demande a
 * une seule direction de porter deux questions, et rend un axe illisible.
 *
 * Chaque axe est calcule sur ses seules variables, apres avoir retranche a
 * chaque photo la mediane de SA famille de sujet — sans ce centrage, la
 * premiere direction serait « jour contre nuit », c'est-a-dire le sujet.
 *
 *   axe des NIVEAUX    45,1 % de la variation intra-famille   -> `-net`
 *   axe des COULEURS   33,6 %                                 -> `chaud`, `froid`
 *
 * LA VERIFICATION QUI COMPTE, sur les deux: les DIX familles peuplent les deux
 * poles. Un pole qui serait un sujet deguise serait peuple par une famille ou
 * deux; peuple par dix sujets sans rapport, il ne peut etre qu'un choix de
 * developpement.
 *
 * ------------------------------------------------------------------------
 * LE PRESET RATE DU 2026-08-26, ET LES DEUX ERREURS DE MESURE QU'IL A REVELEES
 * ------------------------------------------------------------------------
 *
 * Une premiere version de `-doux` saturait les murs ocres d'une cour marocaine
 * jusqu'au rouge. Le defaut n'etait pas dans le preset, il etait dans les deux
 * mesures qui l'avaient produit.
 *
 * 1. L'AXE SE MORDAIT LA QUEUE. Il etait calcule sur des variables de tonalite
 *    ET de couleur melangees — reflets a*, reflets b*, hautes a*, chroma. Le
 *    pole etait donc DEFINI par « ses reflets sont chauds et colores », et
 *    mesurer ensuite la couleur de ce pole ne pouvait rendre qu'une chose: que
 *    ses reflets etaient chauds et colores. L'axe se definit maintenant sur la
 *    seule tonalite, et la couleur est une DECOUVERTE faite apres coup.
 *
 * 2. LE RAPPORT DE CHROMA MESURAIT LE DECOR. Pris sur tous les pixels d'une
 *    bande claire, il repondait a « sa bande claire est-elle plus coloree que
 *    la leur ? » — et la reponse etait oui, parce qu'il photographie des
 *    couchants la ou le tas neutre a des ciels blancs. Pris TEINTE PAR TEINTE
 *    puis median, il repond a « pour un jaune donne, le pose-t-il plus
 *    sature ? », qui est la question qu'un preset peut executer.
 *
 *      pole `chaud`, bande claire:  2,03 en brut  ->  1,01 teinte par teinte
 *
 *    Le ×2 etait entierement du decor. **Aucun pole de son corpus n'augmente la
 *    saturation**: les cinq mesures tombent entre 0,77 et 1,23. C'est un look
 *    qui RETIRE de la couleur, jamais qui en ajoute — et le tronc, mesure
 *    autrement des le depart, disait deja la meme chose (0,85 / 0,83 / 0,99).
 *
 * 3. `-doux` A ETE ABANDONNE. Son transport coute -1,79 EV au gris moyen meme
 *    apres correction, et son pied ecrase plus de huit niveaux d'entree dans un
 *    seul niveau de sortie: le bas de l'image y perd une information qu'aucune
 *    interpolation ne fait revenir. Le registre chaud qu'il visait est rendu,
 *    lui, par `powlisher-chaud`, qui vient de l'axe des couleurs et ne coute
 *    que -0,77 EV.
 */

/* Le limiteur de chroma. Les gains mesures sont tous proches de 1 depuis la
 * correction, donc il n'agit presque jamais — mais il reste, parce qu'il est la
 * garantie qu'aucun reglage futur ne pourra pousser une couleur hors du gamut
 * sRGB, ou elle s'ecreterait canal par canal et deviendrait un aplat.
 * `c' = P (1 - exp(-c g / P))` rend le gain mesure sur les couleurs discretes
 * et sature vers P sur les franches — la Vibrance de Lightroom.
 *
 * P = 87 n'est pas choisi: c'est le 99,9e centile de la chroma Lab de ses 324
 * photos (mediane 11, 99e centile 58). Au-dela, il ne pose jamais de couleur. */
const CINE_CHROMA_PLAFOND = 87;

/* Les quatre secteurs de teinte que le tronc tourne — orange, jaune, vert,
 * bleu. Les variantes tournent LES MEMES, d'angles differents: un secteur
 * retenu pour l'une et pas pour l'autre viendrait de la difference de contenu
 * entre deux sous-ensembles, pas d'une difference de traitement.
 *
 * `bas` est la part de l'angle deja appliquee dans les ombres; elle monte a 1
 * dans les clairs. Elle vaut la mesure des ombres divisee par celle des clairs
 * quand les deux ont ete retenues, celle du tronc sinon. Un secteur dont deux
 * bandes se contredisent EN SIGNE est mis a zero: il decrit le cadre. */
function ancresCine(angles) {
    return [
        { h: 45, angle: angles.orange[0], bas: angles.orange[1] },
        { h: 75, angle: angles.jaune[0], bas: angles.jaune[1] },
        { h: 135, angle: angles.vert[0], bas: angles.vert[1] },
        { h: 255, angle: angles.bleu[0], bas: angles.bleu[1] },
    ];
}

/* L'etalonnage d'une variante: trois valeurs mesurees (ombres, medians, clairs)
 * etalees sur les cinq points du tronc, avec le meme cinquieme point qui
 * retombe vers zero — la mesure ecarte les pixels au-dessus de L = 97, et
 * prolonger une derive verte jusque dans les blancs a deja fait virer au
 * vert-gris un grand ciel a contre-jour. Le tronc pose ce point a un sixieme de
 * la valeur des clairs; on fait pareil. */
const etalCine = (ombres, medians, clairs) => [
    ombres, (ombres + medians) / 2, medians, clairs, +(clairs / 6).toFixed(2),
];

/* LES TABLES SONT INDEXEES PAR LE BLANC DE LA VARIANTE, PAS PAR L = 100.
 *
 * Le tronc plafonne a 232, soit L = 92,6, et pose son point d'epaule a L = 100:
 * l'epaule est donc a 108 % de son propre blanc, et un blanc reste blanc. Les
 * variantes plafonnent ailleurs — `nuit` a 195, soit L = 79. Indexee comme le
 * tronc, sa table lui donnait encore -2,7 en a* sur son propre blanc: le smoke
 * a vu le blanc virer au vert, exactement le defaut que l'epaule existe pour
 * empecher.
 *
 * Ce n'est pas un rattrapage: c'est ce que la mesure voulait dire. Les bandes
 * sont des TIERS DE PIXELS de chaque tas, pas des tranches de L — le tiers
 * clair de `nuit` a ete mesure sur des photos dont le point blanc est a 149,
 * donc sur le haut de SA plage, pas sur le haut de l'echelle. */
function construireCine({ courbe, ancres, chroma, etalA, etalB }) {
    const blanc = evalCurve(courbe, 1);
    const Lblanc = rgbToLab01(blanc, blanc, blanc)[0];
    const parRapportAuBlanc = (table, L) => fonduParL(table, L * 100 / Lblanc);

    return function transform(input) {
        const r0 = evalCurve(courbe, input[0]);
        const g0 = evalCurve(courbe, input[1]);
        const b0 = evalCurve(courbe, input[2]);

        let [L, A, B] = rgbToLab01(r0, g0, b0);

        /* 1. La chroma, par plage, avec son limiteur. */
        const c = Math.hypot(A, B);
        if (c > 1e-6) {
            const gain = parRapportAuBlanc(chroma, L);
            const cible = CINE_CHROMA_PLAFOND * (1 - Math.exp(-c * gain / CINE_CHROMA_PLAFOND));
            A *= cible / c;
            B *= cible / c;
        }

        /* 2. La rotation de teinte, ponderee par la chroma: en dessous de
         *    quelques unites un pixel n'a pas de teinte, et la tourner fabrique
         *    des bandes apres interpolation de la LUT. */
        const c2 = Math.hypot(A, B);
        const aUneTeinte = smoothstep(3, 14, c2);
        if (aUneTeinte > 0) {
            let h = Math.atan2(B, A) * 180 / Math.PI;
            if (h < 0) h += 360;
            let rot = 0;
            const monte = smoothstep(CINE_RAMPE_L[0], CINE_RAMPE_L[1], L);
            for (const a of ancres) {
                const w = poidsAncre(h, a.h);
                if (w > 0) rot += a.angle * w * (a.bas + (1 - a.bas) * monte);
            }
            const hNeuf = (h + rot * aUneTeinte) * Math.PI / 180;
            A = c2 * Math.cos(hNeuf);
            B = c2 * Math.sin(hNeuf);
        }

        /* 3. L'etalonnage: un decalage constant par plage, qui ne change jamais
         *    l'ordre de deux couleurs et ne peut donc pas creer de rupture. */
        A += parRapportAuBlanc(etalA, L);
        B += parRapportAuBlanc(etalB, L);

        return lab01ToRgb(L, A, B);
    };
}

/* Toutes les courbes portent la meme correction, et une seule: l'appariement de
 * quantiles force 255 -> 255 parce que les deux fonctions de repartition
 * finissent a 1, ce qui fabrique un mur vertical entre le dernier point mesure
 * et le blanc. On le remplace par le PLAFOND de la variante — la ou son propre
 * transport pose deja le tres clair (entree 248), prolonge d'un pas.
 * `scripts/courbes-variantes.mjs` les fabrique et verifie qu'aucune pente ne
 * tombe sous 1/8, le pas d'entree de la LUT. */

/* --- `-net` : le pole ouvert de l'axe des NIVEAUX ------------------------- */
/* Il leve tout (+0,88 EV au gris moyen) et retient le tres haut a 245. C'est la
 * reponse mesuree au seul defaut connu du tronc — « moins bon sur les tres forts
 * contrastes »: la ou le tronc ferme (192 -> 184, 224 -> 203), lui ouvre
 * (192 -> 214) puis pose une vraie epaule (224 -> 229, 248 -> 241). */
const NET_COURBE = [
    [0.0000, 0.0000], [0.0627, 0.0745], [0.1255, 0.1451], [0.1882, 0.2157],
    [0.2510, 0.2980], [0.3137, 0.3725], [0.3765, 0.4510], [0.4392, 0.5294],
    [0.5020, 0.6078], [0.5647, 0.6784], [0.6275, 0.7373], [0.6902, 0.7922],
    [0.7529, 0.8392], [0.8157, 0.8745], [0.8784, 0.8980], [0.9412, 0.9255],
    [0.9725, 0.9451], [1.0000, 0.9608],
];
const powlisherCineNetTransform = construireCine({
    courbe: NET_COURBE,
    etalA: etalCine(-1.47, -2.71, -1.56),
    etalB: etalCine(2.68, 3.34, 3.26),
    chroma: [0.959, 0.926, 0.987],
    /* Le vert est a zero: une seule bande le retenait, et dans l'autre sens que
     * le reste de la famille. Une bande seule ne suffit pas. */
    ancres: ancresCine({ orange: [1.92, 0.4], jaune: [4.18, 0.27], vert: [0, 1.0], bleu: [-12.07, 0.62] }),
});

/* --- `chaud` : le pole chaud de l'axe des COULEURS ------------------------ */
/* Le registre dore, mesure sur les 46 photos qui s'y posent — cinq familles de
 * sujet. Son etalonnage est le seul de toute la famille dont le a* atteigne
 * ZERO dans les clairs (+0,06): sa lumiere ne tire plus du tout au vert, la ou
 * le tronc est a -2,3 et `froid` a -4,1. Et son b* monte a +9,3, contre +4,7
 * pour le tronc. C'est la reponse mesuree a « je veux des couleurs plus
 * chaudes ».
 *
 * Sa chroma, elle, ne monte pas: 0,82 / 0,83 / 1,01. Chaud ne veut pas dire
 * sature — c'est precisement l'erreur qui avait ete commise. */
const CHAUD_COURBE = [
    [0.0000, 0.0000], [0.0627, 0.0078], [0.1255, 0.0353], [0.1882, 0.0706],
    [0.2510, 0.1137], [0.3137, 0.1608], [0.3765, 0.2235], [0.4392, 0.2863],
    [0.5020, 0.3569], [0.5647, 0.4392], [0.6275, 0.5098], [0.6902, 0.5765],
    [0.7529, 0.6353], [0.8157, 0.7020], [0.8784, 0.7569], [0.9412, 0.8118],
    [0.9725, 0.8510], [1.0000, 0.8863],
];
const powlisherChaudTransform = construireCine({
    courbe: CHAUD_COURBE,
    etalA: etalCine(-2.0, -0.72, 0.06),
    etalB: etalCine(0.81, 4.4, 9.31),
    chroma: [0.822, 0.827, 1.014],
    /* Le jaune est a zero: ses ombres disent +3,1 et ses medians -2,7. Deux
     * bandes qui se contredisent en signe decrivent le cadre, pas le geste. */
    ancres: ancresCine({ orange: [2.27, 0.4], jaune: [0, 0.2], vert: [5.8, 0.6], bleu: [-11.92, 0.51] }),
});

/* --- `froid` : l'autre bout du meme axe ----------------------------------- */
/* Sa courbe est la plus proche de l'identite de toute la famille (128 -> 128) et
 * son etalonnage le plus vert (-4,3 / -3,4 / -4,1 en a*), avec un b* qui passe
 * SOUS zero dans les ombres. Son bleu tourne de 16 degres. C'est le versant
 * mineral du look — celui que le tronc melange avec l'autre. */
const FROID_COURBE = [
    [0.0000, 0.0000], [0.0627, 0.0235], [0.1255, 0.0784], [0.1882, 0.1412],
    [0.2510, 0.2196], [0.3137, 0.2863], [0.3765, 0.3569], [0.4392, 0.4275],
    [0.5020, 0.5020], [0.5647, 0.5725], [0.6275, 0.6392], [0.6902, 0.6902],
    [0.7529, 0.7333], [0.8157, 0.7765], [0.8784, 0.8157], [0.9412, 0.8627],
    [0.9725, 0.8941], [1.0000, 0.9216],
];
const powlisherFroidTransform = construireCine({
    courbe: FROID_COURBE,
    etalA: etalCine(-4.28, -3.38, -4.07),
    etalB: etalCine(-1.0, 3.75, 0.6),
    chroma: [0.955, 0.772, 0.824],
    ancres: ancresCine({ orange: [0, 0.4], jaune: [0.89, 1.0], vert: [7.36, 1.0], bleu: [-15.97, 0.2] }),
});

/* --- `mer` : une famille de sujet entiere --------------------------------- */
/* La SEULE famille ou son point blanc est PLUS HAUT que celui du tas neutre
 * (+6). Sa courbe ouvre partout et plafonne a 252, et son bleu tourne de 15,9
 * degres contre 11,8 pour le tronc: le teal le plus profond de la famille. */
const MER_COURBE = [
    [0.0000, 0.0000], [0.0627, 0.0431], [0.1255, 0.0863], [0.1882, 0.1451],
    [0.2510, 0.2078], [0.3137, 0.2627], [0.3765, 0.3137], [0.4392, 0.3725],
    [0.5020, 0.4627], [0.5647, 0.5451], [0.6275, 0.6157], [0.6902, 0.6980],
    [0.7529, 0.7765], [0.8157, 0.8392], [0.8784, 0.8980], [0.9412, 0.9373],
    [0.9725, 0.9647], [1.0000, 0.9882],
];
const powlisherMerTransform = construireCine({
    courbe: MER_COURBE,
    etalA: etalCine(-3.17, -4.21, -2.21),
    etalB: etalCine(1.96, 4.95, 7.1),
    chroma: [0.828, 0.987, 1.227],
    /* L'orange est a zero: ses trois tiers se contredisent dessus (+1,9 dans les
     * medians, -5,4 dans les clairs). Un secteur qui se contredit decrit le
     * cadre, pas le traitement — et l'orange, c'est la peau. */
    ancres: ancresCine({ orange: [0, 0.4], jaune: [3.89, 0.62], vert: [9.75, 0.71], bleu: [-15.94, 0.57] }),
});

/* --- `nuit` : l'autre bout du corpus -------------------------------------- */
/* Trente photos de ville de nuit, contre quarante des memes villes par d'autres.
 * Son point blanc est 99 niveaux plus bas que le leur et son contraste 75 points
 * plus faible: la ou tout le monde brule ses lampadaires, lui les retient a 187.
 *
 * Sa chroma d'ombres N'A PAS PU ETRE MESUREE — dans une nuit, les ombres n'ont
 * pas assez de pixels colores pour qu'un rapport teinte par teinte veuille dire
 * quelque chose. On y reporte donc la valeur des medians plutot que d'inventer:
 * une mesure absente n'autorise pas un geste. */
const NUIT_COURBE = [
    [0.0000, 0.0000], [0.0627, 0.0392], [0.1255, 0.0745], [0.1882, 0.1098],
    [0.2510, 0.1451], [0.3137, 0.1843], [0.3765, 0.2275], [0.4392, 0.2706],
    [0.5020, 0.3176], [0.5647, 0.3647], [0.6275, 0.4078], [0.6902, 0.4667],
    [0.7529, 0.5294], [0.8157, 0.5961], [0.8784, 0.6510], [0.9412, 0.6980],
    [0.9725, 0.7333], [1.0000, 0.7647],
];
const powlisherNuitTransform = construireCine({
    courbe: NUIT_COURBE,
    etalA: etalCine(-3.86, -4.32, -2.65),
    etalB: etalCine(1.26, 0.45, 5.28),
    chroma: [0.803, 0.803, 0.873],
    ancres: ancresCine({ orange: [0, 0.4], jaune: [3.18, 0.2], vert: [0, 1.0], bleu: [-3.22, 0.57] }),
});

/* ==========================================================================
 * AMBRE — la lumiere chaude posee sur une image qui reste propre
 * ==========================================================================
 *
 * Ce preset ne vient pas des memes poles que la famille cine. Il vient d'un
 * MODELE: dix photos designees a la main par le porteur du projet
 * (~/Desktop/lumierejaune), toutes du meme registre — une source chaude
 * (couchant, lampe, vitrine) posee dans un cadre qui, lui, reste sobre.
 *
 * DIX PHOTOS NE SE MESURENT PAS. Un etalonnage tire de dix images est du bruit.
 * Mais dix images suffisent a designer une DIRECTION. On s'en est donc servi
 * comme d'une requete (`scripts/voisins-du-modele.mjs`): chaque photo du corpus
 * est decrite par son ecart a la mediane de SA famille de sujet — sans ce
 * centrage, « ressembler au modele » voudrait dire « etre une photo de
 * voiture », puisque la moitie du modele en est — et on garde les 60 plus
 * proches. Ils viennent de DIX familles (auto 19, interieur 10, mer 8,
 * architecture 5, ville-nuit 5, rue 5, moto 3, avion 2, paysage 2, portrait 1):
 * la ressemblance porte donc sur le traitement, pas sur le sujet.
 *
 * CE QUE LA MESURE A TROUVE, et qui n'est dans aucun autre preset du projet:
 *
 *   etalonnage    ombres      medians     clairs
 *   a*            -2,76       -1,18       -1,26
 *   b*            +1,05       +5,11       +8,38
 *
 * Le b* monte de +1 a +8 du bas vers le haut. C'est un SPLIT-TONE — ombres
 * neutres et legerement vertes, hautes lumieres franchement jaunes — la ou le
 * tronc `powlisher-cine` pose un voile jaune-vert a peu pres uniforme. C'est
 * exactement ce qu'on voit sur les dix photos: la chaleur est DANS la lumiere,
 * pas sur toute l'image.
 *
 * Et la chroma descend partout (0,91 / 0,81 / 0,89, mesuree teinte par teinte).
 * Le registre est sobre: ce qui donne l'impression de couleur, c'est le
 * contraste entre des ombres videes et une lumiere chaude, pas de la saturation.
 */

/* LA COURBE EST CALEE SUR LE MODELE, PAS SUR LE TRANSPORT.
 *
 * Le transport brut des 60 voisins coute -0,54 EV et plafonne a 225. Applique a
 * des photos ordinaires, il rendait un point blanc de 205 et un contraste de
 * 172, la ou le modele est a 218,5 et 181,5 — il DEPASSAIT la cible de 70 et
 * 173 % (`scripts/juger-vers-modele.mjs`). La raison est celle qu'on a deja
 * rencontree deux fois: un transport de quantiles emporte l'exposition du tas
 * qui l'a produit, et ces soixante photos sont sombres parce qu'elles sont
 * shootees a contre-jour, pas parce qu'un reglage les assombrit.
 *
 * On garde donc du transport sa FORME, et on cale ses deux reperes sur ce que
 * le modele fait vraiment: une seule puissance en lumiere lineaire,
 * `y = 1,11 x^0,865`, ajustee pour que le rendu de 36 photos neutres tombe sur
 * le point blanc ET le contraste du modele. Deux nombres, deux cibles mesurees,
 * aucun degre de liberte qui reste.
 *
 * Une puissance en lumiere lineaire ne peut ni s'inverser ni s'aplatir: sa pente
 * ne descend jamais sous 0,56 ici, quatre fois le pas d'entree de la LUT. C'est
 * ce qui la separe des trois rattrapages par morceaux essayes avant elle, qui
 * fabriquaient tous un plat quelque part.
 *
 * Le dernier point est a nous: l'appariement de quantiles force 255 -> 255, on
 * le remplace par la pente locale prolongee, soit 239 — donc aucun ecretage,
 * la regle la plus ferme du corpus. */
const AMBRE_COURBE = [
    [0.0000, 0.0000], [0.0627, 0.0588], [0.1255, 0.1059], [0.1882, 0.1569],
    [0.2510, 0.2196], [0.3137, 0.2824], [0.3765, 0.3333], [0.4392, 0.3922],
    [0.5020, 0.4627], [0.5647, 0.5451], [0.6275, 0.6118], [0.6902, 0.6824],
    [0.7529, 0.7373], [0.8157, 0.7922], [0.8784, 0.8275], [0.9412, 0.8706],
    [0.9725, 0.9059], [1.0000, 0.9373],
];

/* LES ROTATIONS: LES DOUZE SECTEURS, PAS QUATRE ANCRES.
 *
 * La famille cine tourne quatre secteurs, ceux que le tronc avait retenus. Ici
 * le releve parle dans neuf secteurs sur douze, et les reduire a quatre
 * reviendrait a jeter la moitie de ce qu'on a mesure — notamment le rouge
 * (+7,3 dans les clairs, ce qui est ce qui rend une brique et une peau chaudes
 * sans les rendre orange) et le jaune-vert a 105 degres (-3,8, ce qui EMPECHE
 * un feuillage eclaire de virer au citron).
 *
 * Douze valeurs fixes reparties sur le cercle, c'est le panneau Teinte de
 * Lightroom, qui en a huit. Rien d'exotique.
 *
 * Une table par bande de luminosite; zero veut dire « les bandes ne s'accordent
 * pas sur ce secteur », donc « on n'y touche pas ».
 * Secteurs centres sur 15, 45, 75 ... 345 degres Lab. */
const AMBRE_ROT = [
    /* ombres  */ [0, 0.98, 2.82, 0, 4.77, 3.45, 1.43, -10.89, -1.36, 0, 0, 0],
    /* medians */ [4.03, 3.45, 3.98, -5.74, 2.40, 2.98, 0, -6.64, -13.13, -1.78, 0, 0],
    /* clairs  */ [7.32, 3.30, 2.72, -3.83, 0, 0, 0, -7.44, -10.25, 1.10, 0, 0],
];

/* Interpolation periodique douce entre les douze valeurs. Le fondu en cosinus
 * sur deux secteurs voisins garde la derivee continue: une table a bord franc
 * fabriquerait la bande que ce projet a deja vue deux fois. */
function rotationAmbre(h, t) {
    const x = ((h % 360) + 360) % 360 / 30 - 0.5;
    const i = Math.floor(x);
    const f = x - i;
    const doux = f * f * (3 - 2 * f);
    const lire = (table, k) => table[((k % 12) + 12) % 12];
    const bande = (table) => lire(table, i) + (lire(table, i + 1) - lire(table, i)) * doux;
    /* `t` va de 0 dans les ombres a 1 dans les clairs; les medians sont au
     * milieu, comme les trois tiers de pixels qui les ont mesures. */
    const u = t * 2;
    return u <= 1
        ? bande(AMBRE_ROT[0]) + (bande(AMBRE_ROT[1]) - bande(AMBRE_ROT[0])) * u
        : bande(AMBRE_ROT[1]) + (bande(AMBRE_ROT[2]) - bande(AMBRE_ROT[1])) * (u - 1);
}

/* LE CINQUIEME POINT N'EST PAS UNE EPAULE ICI, IL EST MESURE.
 *
 * Partout ailleurs dans ce fichier, le point du haut retombe vers zero: la
 * mesure ecarte les pixels au-dessus de L = 97, on ne sait rien du sommet, et
 * prolonger une derive verte jusque dans les blancs a deja fait virer au
 * vert-gris un grand ciel a contre-jour.
 *
 * Ici on SAIT, parce qu'on est alle mesurer exprès: les 10 % de pixels les plus
 * lumineux, sur leurs seuls quasi-gris, portent a* -0,36 et b* +8,23 (dispersion
 * 1,01 et 1,27 sur six familles). Le a* est a zero — donc pas de vert dans les
 * blancs, la regle tient — mais le b* NE retombe pas: chez lui, un reflet est
 * creme, pas blanc. C'etait le defaut principal de la premiere version, qui
 * ramenait ce point a +1,4 et ne parcourait que 16 % du chemin vers le modele
 * sur la teinte des reflets.
 *
 * Un tiers clair contient un mur au soleil; ses 10 % du haut contiennent la
 * lampe. Les deux ne portent pas la meme teinte, et c'est la seconde qui fait
 * le rendu. */
const AMBRE_ETAL_A = [-2.76, -1.97, -1.18, -1.26, -0.36];
const AMBRE_ETAL_B = [1.05, 3.08, 5.11, 8.38, 8.23];
const AMBRE_CHROMA = [0.91, 0.805, 0.893];

/* Le meme etage de couleur sert aux deux densites: c'est un seul registre, pas
 * deux presets sans rapport. Seule la courbe change. */
function construireAmbre(courbe) {
    const v = evalCurve(courbe, 1);
    const Lblanc = rgbToLab01(v, v, v)[0];

    return function transform(input) {
        const r0 = evalCurve(courbe, input[0]);
        const g0 = evalCurve(courbe, input[1]);
        const b0 = evalCurve(courbe, input[2]);

        let [L, A, B] = rgbToLab01(r0, g0, b0);
        /* Comme toute la famille: les tables sont indexees par L rapporte au
         * blanc DE CE PRESET, parce que leurs bandes sont des tiers de pixels de
         * son propre tas et non des tranches de L absolues. */
        const t = clamp01(L / Lblanc) * 100;

        /* 1. Chroma, avec le meme limiteur doux que la famille cine. */
        const c = Math.hypot(A, B);
        if (c > 1e-6) {
            const gain = fonduParL(AMBRE_CHROMA, t);
            const cible = CINE_CHROMA_PLAFOND * (1 - Math.exp(-c * gain / CINE_CHROMA_PLAFOND));
            A *= cible / c;
            B *= cible / c;
        }

        /* 2. Rotation de teinte, ponderee par la chroma. */
        const c2 = Math.hypot(A, B);
        const aUneTeinte = smoothstep(3, 14, c2);
        if (aUneTeinte > 0) {
            let h = Math.atan2(B, A) * 180 / Math.PI;
            if (h < 0) h += 360;
            const hNeuf = (h + rotationAmbre(h, t / 100) * aUneTeinte) * Math.PI / 180;
            A = c2 * Math.cos(hNeuf);
            B = c2 * Math.sin(hNeuf);
        }

        /* 3. Le split-tone. C'est la signature: un decalage qui CHANGE avec la
         *    luminosite, la ou le tronc en pose un a peu pres constant.
         *
         *    A tres basse chroma, un decalage plus long que le rayon de teinte
         *    COMPRIME les teintes voisines vers sa propre direction. Ce n'est
         *    pas le defaut que ce projet a deja vu deux fois: une compression
         *    rapproche, une bande separe. Le test du voile le confirme —
         *    `ambre` amplifie les ecarts de 1,24x, contre 1,58x pour le tronc et
         *    3,03x pour `powlisher`, qui est le plancher du projet. Il ne
         *    dessine donc aucun contour, il fond. */
        A += fonduParL(AMBRE_ETAL_A, t);
        B += fonduParL(AMBRE_ETAL_B, t);

        return lab01ToRgb(L, A, B);
    };
}

/* LA SECONDE DENSITE. Le modele contient deux registres que la meme courbe ne
 * peut pas servir, et ils se separent sans ambiguite sur le point blanc:
 *
 *              photos   point blanc   contraste   chroma
 *   clair         7         234          208       13,9
 *   basse lumiere 3         161          129        8,4
 *
 * Trois photos ne suffisent pas a mesurer une recette de couleur — elle est
 * donc reprise telle quelle des 60 voisins, qui contiennent deja les familles
 * `interieur` et `ville-nuit`. Elles suffisent en revanche a fixer DEUX reperes
 * tonals, et c'est tout ce qu'on leur demande.
 *
 * Note: la cible de contraste du registre CLAIR (208) est, elle, inatteignable
 * sans pousser le blanc a 255. On ne la poursuit pas: l'ecretage est la regle
 * la plus ferme du corpus, et ce contraste-la vient des scenes — des
 * contre-jours — pas d'un reglage. `ambre` reste donc cale sur le modele
 * entier, ou les deux reperes tombent juste. */
const AMBRE_NUIT_COURBE = [
    [0.0000, 0.0000], [0.0627, 0.0588], [0.1255, 0.0980], [0.1882, 0.1373],
    [0.2510, 0.1882], [0.3137, 0.2353], [0.3765, 0.2745], [0.4392, 0.3176],
    [0.5020, 0.3647], [0.5647, 0.4235], [0.6275, 0.4706], [0.6902, 0.5176],
    [0.7529, 0.5529], [0.8157, 0.5922], [0.8784, 0.6118], [0.9412, 0.6431],
    [0.9725, 0.6667], [1.0000, 0.6863],
];

const ambreTransform = construireAmbre(AMBRE_COURBE);
const ambreNuitTransform = construireAmbre(AMBRE_NUIT_COURBE);

export const VISION_PRESETS = [
    {
        id: 'ambre',
        label: 'Ambre',
        hint: 'La lumière est chaude, le reste ne bouge pas',
        description: 'Tiré d\'un modèle de dix photos, étendu aux 60 plus proches de '
            + 'son corpus — dix familles de sujet, donc un traitement et non un sujet. '
            + 'Sa signature est un SPLIT-TONE : le jaune monte de +1 dans les ombres à '
            + '+8,4 dans les hautes lumières, au lieu du voile à peu près uniforme du '
            + 'tronc. La chaleur reste donc dans la lumière et ne déteint pas sur le '
            + 'reste du cadre. La couleur baisse partout (×0,81 à ×0,91) : ce qui donne '
            + 'l\'impression de richesse, c\'est l\'écart entre des ombres sobres et une '
            + 'lumière chaude, pas de la saturation. Douze secteurs de teinte réglés '
            + 'un par un, dont le rouge (+7,3 dans les clairs) et le jaune-vert (−3,8, '
            + 'qui empêche un feuillage éclairé de virer au citron).',
        bestFor: 'fin de journée, contre-jour, lampes et vitrines, intérieurs éclairés, '
            + 'peau — et toute photo propre qu\'on veut poser sans la déguiser',
        avoidFor: 'photos déjà écrêtées : sa courbe retient les blancs, elle ne les '
            + 'ressuscite pas',
        recommendedIntensity: 100,
        transform: ambreTransform,
    },
    {
        id: 'ambre-nuit',
        label: 'Ambre Nuit',
        hint: 'Le même registre, posé bas : rien ne dépasse 175',
        description: 'La déclinaison basse lumière du même modèle. Trois des dix '
            + 'photos forment un groupe à part, et elles se séparent sans ambiguïté : '
            + 'point blanc 161 contre 234, contraste 129 contre 208. Sa couleur est '
            + 'celle d\'`ambre`, au mot près — c\'est un seul regard à deux densités, '
            + 'pas deux presets sans rapport. Seule sa courbe change, calée sur ces '
            + 'deux repères : le blanc pur y atterrit à 175, donc une lampe ou une '
            + 'vitrine garde sa forme au lieu de percer un trou blanc.',
        bestFor: 'nuit, néons, vitrines, intérieurs sombres, contre-jours très durs — '
            + 'tout ce qui a une source de lumière franche dans un cadre sombre',
        avoidFor: 'plein jour : il pose l\'image bas, c\'est sa raison d\'être',
        recommendedIntensity: 100,
        transform: ambreNuitTransform,
    },
    {
        id: 'powlisher-cine',
        label: 'Powlisher Ciné',
        hint: 'Le tronc : lumière jaune-vert, reflets crème, blancs jamais brûlés',
        description: 'Le fond commun à 324 de ses photos, rangées en douze familles '
            + 'de sujet et comparées à 461 photos des mêmes sujets par d\'autres '
            + 'auteurs. Ce qui reste vrai d\'une cabine d\'avion à un bord de mer ne '
            + 'peut pas être du décor : lumière tirée vers le jaune-vert et non vers '
            + 'l\'orange doré, reflets crème, noirs denses, hautes lumières retenues '
            + 'et aucun écrêtage.',
        bestFor: 'tout — c\'est le repère de la famille, les variantes s\'y ajoutent',
        avoidFor: 'photos déjà écrêtées : la courbe retient les blancs, elle ne les '
            + 'ressuscite pas',
        recommendedIntensity: 100,
        transform: powlisherCineTransform,
    },
    {
        id: 'powlisher-cine-net',
        label: 'Powlisher Ciné Net',
        hint: 'Les deux bouts ouverts : ombres levées, blancs tenus',
        description: 'Le pôle OUVERT de son axe de niveaux, mesuré sur les 51 photos '
            + 'qui s\'y posent — dix familles de sujet, donc un choix de développement '
            + 'et pas un sujet. Il lève tout de presque une exposition et pose une '
            + 'vraie épaule à 245 : là où le tronc ferme, lui garde de la matière aux '
            + 'deux bouts.',
        bestFor: 'contre-jours, forts contrastes, photos sombres ou bouchées — c\'est '
            + 'le membre de la famille qui ne ferme rien',
        avoidFor: 'photos déjà claires et plates : il ouvre encore, il ne referme pas',
        recommendedIntensity: 100,
        transform: powlisherCineNetTransform,
    },
    {
        id: 'powlisher-chaud',
        label: 'Powlisher Chaud',
        hint: 'Le registre doré : lumière chaude, sans une once de saturation en plus',
        description: 'Le pôle chaud de son axe de couleurs, mesuré sur les 46 photos '
            + 'qui s\'y posent. C\'est le seul membre de la famille dont la lumière ne '
            + 'tire plus du tout au vert (a* à 0,06 dans les clairs, contre −2,3 pour '
            + 'le tronc) et dont le jaune monte à +9,3. Sa saturation, elle, ne monte '
            + 'pas : mesurée teinte par teinte, elle vaut 1,01 — chaud ne veut pas dire '
            + 'saturé.',
        bestFor: 'fin de journée, pierre et terre, intérieurs éclairés, peau — tout ce '
            + 'qu\'on veut voir doré plutôt que minéral',
        avoidFor: 'scènes déjà très jaunes : il ajoute du jaune, il n\'en enlève pas',
        recommendedIntensity: 100,
        transform: powlisherChaudTransform,
    },
    {
        id: 'powlisher-froid',
        label: 'Powlisher Froid',
        hint: 'Le versant minéral : vert dense, bleu profond, ombres froides',
        description: 'L\'autre bout du même axe, sur 51 photos. Sa courbe est la plus '
            + 'proche de l\'identité de toute la famille — elle ne déplace presque pas '
            + 'les niveaux — et tout son caractère est dans la couleur : l\'étalonnage '
            + 'le plus vert du lot, un jaune qui passe sous zéro dans les ombres, et un '
            + 'bleu tourné de 16 degrés vers le teal.',
        bestFor: 'béton, métal, forêt, brume, ciel — et toute photo trop jaune qu\'on '
            + 'veut refroidir sans la vider',
        avoidFor: 'portraits en lumière froide : il refroidit encore',
        recommendedIntensity: 100,
        transform: powlisherFroidTransform,
    },
    {
        id: 'powlisher-mer',
        label: 'Powlisher Mer',
        hint: 'Le teal le plus profond de la famille, et rien de bouché',
        description: 'Ses 37 photos de bord de mer contre 40 des mêmes rivages par '
            + 'd\'autres auteurs. La seule famille où son point blanc est PLUS HAUT '
            + 'que celui d\'en face : ici il ouvre au lieu de retenir, jusqu\'à 252. Son '
            + 'bleu tourne de 16 degrés vers le teal — le tronc n\'en tourne que 12 — '
            + 'et ses verts de 10.',
        bestFor: 'mer, piscine, ciel, tout ce qui est bleu et lumineux',
        avoidFor: 'portraits serrés : son secteur orange est laissé à zéro, il ne '
            + 'protège pas la peau, il l\'ignore',
        recommendedIntensity: 100,
        transform: powlisherMerTransform,
    },
    {
        id: 'powlisher-nuit',
        label: 'Powlisher Nuit',
        hint: 'Lampadaires retenus, nuit lisible',
        description: 'Ses 30 photos de ville de nuit contre 40 des mêmes villes par '
            + 'd\'autres. Son point blanc est 99 niveaux sous le leur et son contraste '
            + '75 points plus faible : là où tout le monde brûle ses lampadaires, il '
            + 'les tient à 187. La couleur baisse partout (×0,80), ce qui rend la nuit '
            + 'lisible au lieu d\'être un confetti de néons.',
        bestFor: 'ville de nuit, néons, intérieurs sombres, tout ce qui a des sources '
            + 'de lumière ponctuelles dans un cadre noir',
        avoidFor: 'plein jour : sa courbe est mesurée sur des scènes nocturnes et '
            + 'coûte une exposition',
        recommendedIntensity: 100,
        transform: powlisherNuitTransform,
    },
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
