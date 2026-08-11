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
 * `powlisher-ville` — la seconde direction du meme photographe.
 *
 * Reconstruit depuis la SEULE paire avant/apres qu'il ait publiee: sa photo
 * brute d'iPhone a cote de son edit final (corpus img47 -> img48). On connait
 * donc son entree ET sa sortie sur la meme image, ce qui permet de mesurer sa
 * transformation au lieu de la deduire d'une photo finie.
 *
 * ATTENTION, et c'est important: son edit n'est PAS reproductible tel quel.
 * Pour une meme couleur d'entree, sa sortie varie de +/- 22,3/255 (contre 1,9 a
 * 4,8 sur une vraie paire Lightroom). Il l'explique lui-meme: il a fait passer
 * l'image par une IA generative pour « booster la resolution et le traitement ».
 * C'est spatial, donc hors de portee de toute table de couleurs.
 *
 * Ce preset ne copie donc pas son edit: il en reprend la DIRECTION
 * colorimetrique, mesuree zone par zone (medianes, pas moyennes, pour resister
 * a la dispersion de l'IA):
 *
 *   zone              L avant -> apres    teinte           saturation
 *   neutres sombres   0.14 -> 0.11        220° -> 150°     0.08 -> 0.15
 *   neutres moyens    0.30 -> 0.28        100° ->  42°     0.05 -> 0.24
 *   neutres clairs    0.58 -> 0.67         98° ->  40°     0.07 -> 0.20
 *   blancs            0.83 -> 0.90        204° ->  38°     0.05 -> 0.05
 *   chauds (murs)     0.19 -> 0.21         40° ->  39°     0.23 -> 0.33
 *   ciel              0.79 -> 0.87        213° -> 207°     0.21 -> 0.04
 *
 * En clair: il DORE tout ce qui est neutre, eclaircit les hautes lumieres,
 * renforce les chauds qui existent deja, et VIDE le ciel de sa couleur sans en
 * changer la teinte.
 *
 * C'est l'oppose de `powlisher`, qui lui tire le ciel vers le teal et garde les
 * neutres neutres. Les deux sont de lui, sur deux sujets differents: le paysage
 * pour l'un, la ville en lumiere basse pour l'autre.
 * ========================================================================== */

/*
 * Courbe maitre: ombres legerement creusees, hautes lumieres franchement
 * levees (0.58 -> 0.67 et 0.83 -> 0.90 sont les deux points mesures). L'epaule
 * reste sous 1.0: comme sur `powlisher`, le point blanc ne touche pas 255.
 */
const VILLE_CURVE = [
    [0, 0], [0.14, 0.11], [0.30, 0.28], [0.45, 0.47],
    [0.58, 0.67], [0.72, 0.80], [0.83, 0.90], [0.93, 0.965], [1, 0.99],
];

/*
 * Le dore applique aux NEUTRES, en points de saturation ajoutes selon la
 * luminance. Directement les mesures: rien dans les noirs (ou il met plutot un
 * soupcon de froid), +19 points dans les tons moyens, +13 dans les clairs, et
 * retour a zero sur les blancs — qu'il laisse blancs (0.05 -> 0.05).
 *
 * Le retour a zero en haut n'est pas un detail: c'est ce qui evite que les
 * ciels blancs et les murs eclaires virent au jaune sale.
 */
const VILLE_DORE = [
    [0, 0], [0.12, 0.03], [0.30, 0.26], [0.50, 0.30],
    [0.62, 0.30], [0.72, 0.24], [0.84, 0.08], [0.92, 0.01], [1, 0],
];

/*
 * Teinte visee pour le dore. On melange vers 33° et non vers les 40° mesures:
 * le pixel de depart garde une part de sa propre teinte, souvent plus froide,
 * et le resultat remonte. Vise a 40, on atterrit a 55 — mesure.
 */
const VILLE_TEINTE_DORE = 33;

/*
 * Un soupcon de froid dans les noirs (mesure: teinte 150°, saturation 0.08 ->
 * 0.15). C'est ce qui empeche l'image de devenir monochrome jaune une fois le
 * dore applique — le contraste chaud/froid tient tout le look.
 */
const VILLE_FROID = [
    [0, 0.06], [0.08, 0.05], [0.16, 0.02], [0.25, 0], [1, 0],
];
const VILLE_TEINTE_FROID = 155;

function villeTransform(input) {
    /* 1. Courbe maitre, canal par canal. */
    const r0 = evalCurve(VILLE_CURVE, input[0]);
    const g0 = evalCurve(VILLE_CURVE, input[1]);
    const b0 = evalCurve(VILLE_CURVE, input[2]);

    let [h, s, l] = rgbToHsl(r0, g0, b0);

    /*
     * 2. Le ciel: teinte conservee, saturation ecrasee (0.21 -> 0.04, soit
     * environ un cinquieme). C'est ce qu'il fait, et c'est l'inverse de
     * `powlisher`. Pondere par la saturation d'entree pour ne pas toucher aux
     * quasi-neutres, dont la teinte n'est pas definie.
     */
    const bleu = smoothstep(160, 185, h) * (1 - smoothstep(255, 275, h));
    if (bleu > 0 && l > 0.35) {
        const force = bleu * smoothstep(0.06, 0.16, s) * smoothstep(0.35, 0.55, l);
        s *= 1 - 0.80 * force;
    }

    /*
     * 3. Les chauds existants sont renforces (0.23 -> 0.33, soit +45 %), sans
     * bouger de teinte (40° -> 39°). Ce sont les murs au soleil et les reflets
     * sur la tole.
     */
    const chaud = smoothstep(12, 25, h) * (1 - smoothstep(62, 78, h));
    if (chaud > 0) {
        const force = chaud * smoothstep(0.08, 0.20, s);
        s = clamp01(s * (1 + 0.45 * force));
        /*
         * Et il les eclaircit legerement (0.19 -> 0.21), alors qu'il CREUSE les
         * neutres de la meme luminance (0.14 -> 0.11). La courbe maitre ne peut
         * pas faire les deux — elle ne voit que la luminance. D'ou ce relevage
         * ici, reserve aux pixels deja colores et chauds.
         */
        l = clamp01(l * (1 + 0.22 * force * (1 - smoothstep(0.35, 0.60, l))));
    }

    const mixed = hslToRgb(h, s, l);

    /*
     * 4. Le dore sur les neutres, en dernier — meme raison que le virage split
     * de `powlisher`: applique avant, l'etape 2 le desaturerait aussitot.
     *
     * On melange vers une couleur cible plutot que de decaler une teinte: un
     * pixel gris n'a pas de teinte a decaler, et le decaler creerait la
     * discontinuite qui donne des bandes apres interpolation de la LUT.
     * Le poids s'annule quand le pixel est deja colore (il a sa propre teinte,
     * on ne la remplace pas) et quand il est tres clair (les blancs restent
     * blancs).
     */
    const luma = 0.2126 * mixed[0] + 0.7152 * mixed[1] + 0.0722 * mixed[2];
    const [, satActuelle] = rgbToHsl(mixed[0], mixed[1], mixed[2]);
    const neutre = 1 - smoothstep(0.10, 0.30, satActuelle);

    const dore = evalCurve(VILLE_DORE, luma) * neutre;
    const froid = evalCurve(VILLE_FROID, luma) * neutre;

    let out = mixed;
    if (dore > 0) {
        const cible = hslToRgb(VILLE_TEINTE_DORE, 0.55, luma);
        out = [
            out[0] + (cible[0] - out[0]) * dore,
            out[1] + (cible[1] - out[1]) * dore,
            out[2] + (cible[2] - out[2]) * dore,
        ];
    }
    if (froid > 0) {
        const cible = hslToRgb(VILLE_TEINTE_FROID, 0.40, luma);
        out = [
            out[0] + (cible[0] - out[0]) * froid,
            out[1] + (cible[1] - out[1]) * froid,
            out[2] + (cible[2] - out[2]) * froid,
        ];
    }

    return [clamp01(out[0]), clamp01(out[1]), clamp01(out[2])];
}

/* ==========================================================================
 * `powlisher-v2` — le meme look, plus la regle du ciel qui manque a V1.
 *
 * V1 traite tous les bleus pareil. Le corpus dit qu'il n'en fait rien de tel:
 * son traitement du ciel depend de la SATURATION du bleu, et les deux cas sont
 * opposes (mesures dans docs/lightroom/corpus-powlisher/README.md, rejouables
 * par `node scripts/mesure-ciel-powlisher.mjs`):
 *
 *   ciel VOILE -> il le laisse partir au BLANC. 75 a 95 % de la zone claire
 *                 tombe sous s = 0.10 (img32, img33, img48). Il ne cherche
 *                 PAS a le rendre bleu.
 *   ciel FRANC -> teal tenu a 188-199°, saturation 0.32 a 0.49
 *                 (img16, img18, img35, img36, img40).
 *
 * V1 fait l'INVERSE sur un ciel voile: il garde la saturation et tourne a
 * 172°, un cyan qu'il ne produit sur aucune photo du corpus. La paire
 * avant/apres le chiffre sans ambiguite — c'est le seul endroit ou on connait
 * son entree ET sa sortie:
 *
 *   img47, son brut      blanc 41 %   teinte 212.7°   sat 0.21
 *   img48, SON edit      blanc 75 %   teinte 206.4°   sat 0.11
 *   powlisher V1         blanc 53 %   teinte 172.5°   sat 0.14   <- rate les deux
 *
 * La cause est le SEUIL, pas le principe: la ponderation `smoothstep(0, 0.12,
 * s)` sature des s = 0.12, si bien qu'un ciel pale d'hiver recoit exactement le
 * meme decalage qu'un ciel franc de Biarritz. Cette ponderation garde son autre
 * role — eviter les bandes pres du gris — donc on la garde telle quelle, et on
 * ajoute par-dessus une regle qui, elle, sait distinguer les deux ciels.
 *
 * Tout le reste de V1 est intact: meme courbe maitre, memes bandes de teinte,
 * meme virage split. Le feuillage, la peau, les noirs et le point blanc ne
 * bougent pas — c'est verifie separement dans le smoke.
 * ========================================================================== */

/*
 * La saturation qui sert d'arbitre est celle du corpus: (max - min) / max.
 *
 * Ce choix decide de tout, donc il merite sa justification. La saturation HSL
 * qu'utilise deja le melangeur gonfle enormement sur les pixels clairs: un ciel
 * pale ou l'oeil voit du blanc casse y ressort a 0.36, contre 0.21 ici. Elle ne
 * sait donc pas separer un ciel voile d'un ciel franc — c'est precisement le
 * piege dans lequel V1 est tombe. Toutes les cibles mesurees du corpus sont
 * exprimees dans cette mesure-ci.
 */
function chromaSat(r, g, b) {
    const max = Math.max(r, g, b);
    if (max <= 0) return 0;
    return (max - Math.min(r, g, b)) / max;
}

/*
 * Le domaine de la regle. Large en teinte (le cyan-bleu-indigo), a bords doux:
 * une bascule franche sur la teinte se verrait en bandes apres interpolation de
 * la LUT.
 */
const SKY_HUE_IN = [160, 182];
const SKY_HUE_OUT = [252, 272];

/*
 * Le seuil, c'est-a-dire le coeur du correctif. Sous 0.18 de chroma le ciel est
 * voile, au-dessus de 0.36 il est franc, et entre les deux on interpole. Les
 * bornes encadrent la mesure: son brut voile est a 0.21, ses ciels francs
 * atterrissent entre 0.32 et 0.49.
 */
const SKY_S_VOILE = 0.18;
const SKY_S_FRANC = 0.36;

/*
 * La regle ne vaut que dans la ZONE CLAIRE. Un bleu sombre — une ombre, un jean,
 * une nuit de Shanghai — n'est pas un ciel voile et doit garder sa couleur.
 */
const SKY_LUM = [0.46, 0.64];

/* Part du decalage de teinte annulee sur un ciel voile: il ne le tourne pas. */
const SKY_HUE_HOLD = 0.88;
/* Desaturation supplementaire d'un ciel voile: c'est lui qui « part au blanc ». */
const SKY_DESAT = 0.62;
/* Part du virage split neutralisee: sur un pixel pale, -12/255 de bleu suffit a
   le faire pivoter de plusieurs degres. C'est la moitie du -40° de V1. */
const SKY_SPLIT_HOLD = 0.70;

function powlisherV2Transform(input) {
    /* 1. Courbe maitre, canal par canal. Identique a V1. */
    const r0 = evalCurve(MASTER_CURVE, input[0]);
    const g0 = evalCurve(MASTER_CURVE, input[1]);
    const b0 = evalCurve(MASTER_CURVE, input[2]);

    let [h, s, l] = rgbToHsl(r0, g0, b0);

    /*
     * 2. La regle du ciel. `voile` vaut 1 sur un bleu pale et clair, 0 sur un
     * bleu franc, sur une autre teinte, ou dans les tons sombres. Tout est en
     * smoothstep: la LUT interpole entre ses nœuds, donc chaque bascule doit
     * etre continue sous peine de bandes dans un grand degrade de ciel.
     */
    const sv = chromaSat(r0, g0, b0);
    const dansLeBleu = smoothstep(SKY_HUE_IN[0], SKY_HUE_IN[1], h)
        * (1 - smoothstep(SKY_HUE_OUT[0], SKY_HUE_OUT[1], h));
    const franc = smoothstep(SKY_S_VOILE, SKY_S_FRANC, sv);
    const voile = dansLeBleu * (1 - franc) * smoothstep(SKY_LUM[0], SKY_LUM[1], l);

    /* 3. Melangeur par bande de teinte. La ponderation par la saturation est
       celle de V1, inchangee — elle protege les neutres des bandes. Seule
       nouveaute: sur un ciel voile, le decalage de teinte est retenu. */
    const satWeight = smoothstep(0, 0.12, s);
    if (satWeight > 0) {
        const band = sampleBands(h);
        h += band.hue * satWeight * (1 - SKY_HUE_HOLD * voile);
        s = clamp01(s * (1 + (band.sat / 100) * satWeight));
        l = clamp01(l * (1 + (band.lum / 100) * satWeight));
    }

    /* 4. Les hautes lumieres virent creme, et le ciel voile part au blanc. */
    s = clamp01(s * highlightSatFactor(l));
    s = clamp01(s * (1 - SKY_DESAT * voile));

    const mixed = hslToRgb(h, s, l);

    /* 5. Virage split, en dernier — retenu lui aussi sur un ciel voile. */
    const luma = 0.2126 * mixed[0] + 0.7152 * mixed[1] + 0.0722 * mixed[2];
    const splitWeight = 1 - SKY_SPLIT_HOLD * voile;
    return [
        clamp01(mixed[0] + (evalCurve(DELTA_R, luma) / 255) * splitWeight),
        clamp01(mixed[1]),
        clamp01(mixed[2] + (evalCurve(DELTA_B, luma) / 255) * splitWeight),
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
        id: 'powlisher-ville',
        label: 'Powlisher Ville',
        hint: 'Doré sur les neutres, ciel lavé',
        description: 'Dore les surfaces neutres (murs, tôle, béton), éclaircit les '
            + 'hautes lumières et vide le ciel de sa couleur. Mesuré sur la seule '
            + 'paire avant/après publiée par le photographe.',
        bestFor: 'ville, architecture, voiture, ciel couvert, lumière basse',
        avoidFor: 'ciel bleu franc et mer — c\'est `powlisher` qu\'il faut là',
        recommendedIntensity: 100,
        transform: villeTransform,
    },
    {
        id: 'powlisher-v2',
        label: 'Powlisher V2',
        hint: 'Powlisher, avec sa vraie règle du ciel',
        description: 'Le rendu de Powlisher — verts olive, peau préservée, hautes '
            + 'lumières crème — mais le ciel suit enfin sa règle : un ciel franc est '
            + 'tenu en teal, un ciel voilé part au blanc au lieu de virer au cyan.',
        bestFor: 'voyage, paysage, extérieur, et surtout les ciels couverts ou brumeux',
        avoidFor: 'photos déjà très filtrées ou aux blancs déjà écrêtés',
        recommendedIntensity: 100,
        transform: powlisherV2Transform,
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
