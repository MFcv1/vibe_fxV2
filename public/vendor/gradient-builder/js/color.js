/*
 * Couleur : conversions sRGB <-> OKLab, melange, echantillonnage le long des
 * bandes. Tout le degrade est calcule en OKLab : c'est ce qui donne les
 * transitions sans zone grise au milieu.
 */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const fract = (v) => v - Math.floor(v);
export const smoothstep = (v) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  const v = (1 << 24) | (clamp(Math.round(r), 0, 255) << 16)
    | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255);
  return `#${v.toString(16).slice(1)}`;
}

const srgbToLinear = (c) => { const u = c / 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
const linearToSrgb = (v) => {
  const u = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
  return clamp(Math.round(u * 255), 0, 255);
};

export function hexToOklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(linearToSrgb);
}

/* Interpolation de deux couleurs dans OKLab -> [r,g,b] */
export function mixRgb(a, b, t) {
  const x = hexToOklab(a);
  const y = hexToOklab(b);
  return oklabToRgb(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

export const mix = (a, b, t) => rgbToHex(mixRgb(a, b, t));
export const rgbCss = ([r, g, b]) => `rgb(${r | 0},${g | 0},${b | 0})`;
export const rgba = (hex, alpha) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${alpha})`; };

/* ---------------------------------------------------------------- bandes */

/* Bornes par defaut : n couleurs -> n-1 coupures reparties egalement. */
export const evenDivs = (count) => Array.from({ length: Math.max(0, count - 1) }, (_, i) => (i + 1) / count);

/* Bornes completes, 0 et 1 inclus. */
export const bounds = (count, divs) => [0, ...(divs && divs.length === count - 1 ? divs : evenDivs(count)), 1];

/* Centre de chaque bande, en pourcentage. */
export function bandCenters(count, divs) {
  if (count <= 1) return [50];
  const b = bounds(count, divs);
  return Array.from({ length: count }, (_, i) => ((b[i] + b[i + 1]) / 2) * 100);
}

/* Largeur relative d'une bande, normalisee : 1 = part egale. */
export function bandWeight(count, divs, index) {
  const b = bounds(count, divs);
  return (b[index + 1] - b[index]) * count;
}

/* Couleur echantillonnee a la position t (0..1) le long des centres de bande. */
export function sampleRgb(colors, divs, t) {
  const centers = bandCenters(colors.length, divs).map((c) => c / 100);
  if (t <= centers[0]) return hexToRgb(colors[0]);
  if (t >= centers[centers.length - 1]) return hexToRgb(colors[colors.length - 1]);
  for (let i = 0; i < centers.length - 1; i++) {
    if (t >= centers[i] && t <= centers[i + 1]) {
      const k = (t - centers[i]) / Math.max(1e-6, centers[i + 1] - centers[i]);
      return mixRgb(colors[i], colors[i + 1], k);
    }
  }
  return hexToRgb(colors[colors.length - 1]);
}

export const sample = (colors, divs, t) => rgbToHex(sampleRgb(colors, divs, t));

/*
 * Liste de stops pour un gradient canvas. Canvas interpole en sRGB : on insere
 * `steps` couleurs intermediaires calculees en OKLab entre chaque paire pour
 * retrouver la meme courbe que le CSS `in oklab`.
 */
export function rampStops(colors, positions, steps = 6, smooth = false) {
  if (colors.length < 2) return colors.map((c, i) => [c, positions[i] ?? 0.5]);
  const out = [];
  for (let i = 0; i < colors.length - 1; i++) {
    out.push([colors[i], positions[i]]);
    for (let s = 1; s <= steps; s++) {
      const d = s / (steps + 1);
      const eased = smooth ? d * d * (3 - 2 * d) : d;
      out.push([mix(colors[i], colors[i + 1], eased), positions[i] + (positions[i + 1] - positions[i]) * d]);
    }
  }
  out.push([colors[colors.length - 1], positions[colors.length - 1]]);
  return out;
}

/* ------------------------------------------------------------- lisibilite */

export const INK_DARK = '#2A2622';
export const INK_LIGHT = '#FBF8F3';
const INK_SPLIT = 0.68;

/* Clarte perceptuelle (L d'OKLab) d'un triplet 0-255. */
export function lightnessRgb(r, g, b) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

export const lightness = (hex) => hexToOklab(hex)[0];
export const inkOn = (l) => (l < INK_SPLIT ? INK_LIGHT : INK_DARK);

export function inkForPalette(colors) {
  if (!colors.length) return INK_DARK;
  let sum = 0;
  for (const c of colors) sum += lightness(c);
  return inkOn(sum / colors.length);
}

/* Teinte, saturation, clarte HSL — sert au nommage des couleurs. */
export function hsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}
