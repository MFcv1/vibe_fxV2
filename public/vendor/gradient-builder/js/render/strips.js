/*
 * Types "bandes" : Stripes, Bars, Columns, Prism.
 * Rendus pixel par pixel : les transitions sont adoucies par une fonction de
 * lissage plutot que par un flou, ce qui garde les aretes nettes a l'export.
 */

import { hexToOklab, oklabToRgb, bounds, sampleRgb } from '../color.js';

export const STRIPE_FIELD = { angle: 0, softness: 14, wave: 12 };
export const BARS_FIELD = { count: 7, gap: -20, envelope: 'ramp' };
export const COLS_FIELD = { count: 18, gap: -20, envelope: 'ramp' };
export const PRISM_FIELD = { count: 11, gap: 0, envelope: 'ramp' };

const TAU = Math.PI * 2;
const STRIPE_WAVE_FREQ = 2.4;
const BAR_TIME = 1.6;
const BAR_FLOOR = 0.12;   // part basse de la rampe couleur reservee au pied
const BAR_JITTER = 0.11;

/* Transition douce entre deux bornes (equivalent GLSL smoothstep). */
function step(edge0, edge1, x) {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/* ------------------------------------------------------------- Stripes */

export function paintStripes(ctx, w, h, colors, divs, field = STRIPE_FIELD, time = 20.75) {
  const n = colors.length;
  const labs = colors.map(hexToOklab);
  const edges = bounds(n, divs);
  const angle = (field.angle / 180) * Math.PI;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  const norm = Math.abs(sin) + Math.abs(cos) || 1;
  const soft = (field.softness / 100) * 0.5;
  const wave = (field.wave / 100) * 0.35;

  const img = ctx.createImageData(w, h);
  const px = img.data;
  for (let y = 0; y < h; y++) {
    const dy = (y + 0.5) / h - 0.5;
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w - 0.5;
      const across = -dx * cos + dy * sin;
      const along = 0.5 + (dx * sin + dy * cos) / norm
        + wave * Math.sin(across * STRIPE_WAVE_FREQ * Math.PI * 2 + time);

      let L = labs[0][0], A = labs[0][1], B = labs[0][2];
      for (let i = 1; i < n; i++) {
        const k = step(edges[i] - soft, edges[i] + soft, along);
        L += (labs[i][0] - L) * k;
        A += (labs[i][1] - A) * k;
        B += (labs[i][2] - B) * k;
      }
      const rgb = oklabToRgb(L, A, B);
      const o = (y * w + x) * 4;
      px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* -------------------------------------------------------- Bars/Columns */

/*
 * Hauteur de chaque barre. L'enveloppe donne la silhouette d'ensemble (plate,
 * en rampe, ou en S), a laquelle s'ajoute une houle de trois sinusoides pour
 * que deux barres voisines ne soient jamais identiques.
 */
function envelope(count, shape, time) {
  const drift = 0.3 * Math.sin(time * 0.27 + 0.8);
  return Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    let base;
    if (shape === 'flat') base = 0.82;
    else if (shape === 'ramp') base = 0.14 + (0.9 - 0.14) * t;
    else {
      const s = t * t * t * (t * (t * 6 - 15) + 10);
      base = 0.14 + (0.9 - 0.14) * s;
    }
    const swell = 0.5 * Math.sin(t * TAU * 0.5 + time * 0.55)
      + 0.32 * Math.sin(t * TAU * 0.95 - time * 0.38 + 1.7)
      + 0.12 * Math.sin(t * TAU * 1.7 + time * 0.8 + 0.5)
      + drift;
    return Math.max(0.05, Math.min(1, base + BAR_JITTER * swell));
  });
}

export function paintBars(ctx, w, h, colors, divs, field = BARS_FIELD, time = 20.75) {
  const t = time * BAR_TIME;
  const count = Math.max(1, Math.round(field.count));
  const gap = Math.max(-0.5, Math.min(0.9, field.gap / 100));
  const heights = envelope(count, field.envelope, t);

  /* Rampe de couleur precalculee sur 256 crans, du pied au sommet. */
  const LUT = 256;
  const ramp = new Array(LUT);
  for (let i = 0; i < LUT; i++) ramp[i] = sampleRgb(colors, divs, BAR_FLOOR + (1 - BAR_FLOOR) * (i / (LUT - 1)));
  const floor = sampleRgb(colors, divs, 0);

  const img = ctx.createImageData(w, h);
  const px = img.data;
  const slot = w / count;
  const half = gap / 2;
  const feather = Math.max(0.5, slot * 0.006);
  const shadeAmount = gap > 0 ? 0.035 : 0.06;

  /* Colonne de pixels prete a l'emploi pour chaque barre. */
  const columns = new Array(count);
  const tops = new Array(count);
  for (let i = 0; i < count; i++) {
    const shade = shadeAmount * (i % 2 === 0 ? -1 : 1) * (0.7 + 0.3 * Math.sin(t * 0.5 + i * 1.7));
    const offset = 0.04 * Math.sin(t * 0.45 + i * 0.9);
    const top = (1 - heights[i]) * h;
    const span = Math.max(1, h - top);
    tops[i] = top;

    const strip = new Uint8ClampedArray(h * 3);
    for (let y = Math.max(0, Math.floor(top - 0.5)); y < h; y++) {
      let u = (y + 0.5 - top) / span + offset;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const c = ramp[(u * (LUT - 1)) | 0];
      let [r, g, b] = c;
      if (shade > 0) { r += (255 - r) * shade; g += (255 - g) * shade; b += (255 - b) * shade; }
      else { r *= 1 + shade; g *= 1 + shade; b *= 1 + shade; }
      strip[y * 3] = r; strip[y * 3 + 1] = g; strip[y * 3 + 2] = b;
    }
    columns[i] = strip;
  }

  const [br, bg, bb] = floor;
  const weight = new Float64Array(3);
  const which = new Int32Array(3);

  for (let x = 0; x < w; x++) {
    const cx = x + 0.5;
    const home = Math.min(count - 1, Math.floor(cx / slot));
    let hits = 0;
    for (let i = home - 1; i <= home + 1; i++) {
      if (i < 0 || i >= count) continue;
      const left = (i + half) * slot;
      const right = (i + 1 - half) * slot;
      const cover = step(left - feather, left + feather, cx) * (1 - step(right - feather, right + feather, cx));
      if (cover > 0.001) { weight[hits] = cover; which[hits] = i; hits++; }
    }
    for (let y = 0; y < h; y++) {
      let r = br, g = bg, b = bb;
      for (let k = 0; k < hits; k++) {
        const i = which[k];
        if (y + 0.5 >= tops[i]) {
          const strip = columns[i];
          const o = y * 3;
          const a = weight[k];
          r += (strip[o] - r) * a;
          g += (strip[o + 1] - g) * a;
          b += (strip[o + 2] - b) * a;
        }
      }
      const o = (y * w + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
