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
        recommendedIntensity: 85,
        transform: powlisherTransform,
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
