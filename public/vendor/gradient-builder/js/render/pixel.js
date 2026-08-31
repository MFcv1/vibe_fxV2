/*
 * PIXEL — un quadrillage de tuiles unies, comme un patchwork.
 *
 * La valeur de chaque case vient de sa distance a un point chaud decale, puis
 * elle est quantifiee sur un petit nombre de paliers : c'est ce qui donne des
 * aplats francs plutot qu'un degrade. Un tramage leger casse les frontieres
 * entre paliers, et un filet clair/sombre dessine la grille.
 */

import { sample, rgbCss, sampleRgb, rgba, clamp } from '../color.js';

export const PIXEL_FIELD = { levels: 12, jitter: 20 };

const HOT_X = 0.82;         // point chaud, en fraction de la grille
const HOT_Y = 0.52;
const SPAN_X = 0.86;
const SPAN_Y = 0.64;
const SHEAR = 0.14;         // penchant du champ
const FLOOR_MIX = 0.22;     // part du degrade horizontal dans la valeur
const BREATH = 0.032;
const BREATH_RATE = 2.4;
const RIPPLE = 0.018;
const RIPPLE_RATE = 1.1;
const GRID_LIGHT = 0.12;
const GRID_DARK = 0.075;
const GRID_WIDTH = 0.014;
const DITHER_FLOOR = 30;    // en dessous, le tramage est remplace par du bruit
const DITHER_GAIN = 0.5;
const NOISE_GAIN = 0.09;

const clamp01 = (v) => clamp(v, 0, 1);
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v) };

/* Nombre de cases : le curseur Scale resserre la grille. */
const gridOf = (w, h, size) => {
  const step = Math.min(w, h) / Math.round(8 + 0.1 * clamp(size, 0, 100));
  const cols = Math.max(4, Math.round(w / step));
  const rows = Math.max(4, Math.round(h / step));
  return { cols, rows, cw: w / cols, ch: h / rows };
};

/* Valeur (0..1) d'une case, deja quantifiee. */
function cellValue(grid, row, col, time, levels, jitter) {
  const steps = Math.max(2, Math.round(levels));
  const u = (col + 0.5) / grid.cols;
  const v = (row + 0.5) / grid.rows;
  const hotX = HOT_X + 0.014 * Math.sin(time * 0.72);
  const hotY = HOT_Y + 0.01 * Math.cos(time * 0.58);
  const breathe = 1 + BREATH * Math.sin(time * BREATH_RATE);

  const shear = u + (v - hotY) * SHEAR + 0.028 * Math.sin(v * Math.PI * 1.15 + 0.35);
  const dx = Math.abs(shear - hotX) / (SPAN_X * breathe);
  const dy = Math.abs(v - hotY) / (SPAN_Y * breathe);
  const radial = 1 - clamp01(Math.max(dx, dy));
  const sweep = clamp01(u * 0.86 + (1 - Math.abs(v - hotY) * 2) * 0.14);
  const blend = clamp01(radial * (1 - FLOOR_MIX) + sweep * FLOOR_MIX);

  const grain = hash(row, col);
  let level = Math.round(blend * steps);

  /* Tramage : au-dela d'un seuil, une case sur deux bascule d'un palier. */
  const dither = (Math.max(0, jitter - DITHER_FLOOR) / (100 - DITHER_FLOOR)) * DITHER_GAIN;
  if (dither > 0) {
    const pick = hash(row * 3 + 17, col * 7 + 5);
    if (pick < dither) level += pick < dither / 2 ? -1 : 1;
  }

  const noise = (grain - 0.5) * NOISE_GAIN * (Math.min(jitter, DITHER_FLOOR) / 100);
  const ripple = RIPPLE * Math.sin(time * RIPPLE_RATE + grain * Math.PI * 2);
  return clamp01(level / steps + noise + ripple);
}

export function paintPixel(ctx, w, h, colors, divs, size = 50, field = PIXEL_FIELD, time = 20.75) {
  const f = { ...PIXEL_FIELD, ...(field ?? {}) };
  const grid = gridOf(w, h, size);

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const v = cellValue(grid, row, col, time, f.levels, f.jitter);
      ctx.fillStyle = rgbCss(sampleRgb(colors, divs, v));
      ctx.fillRect(Math.floor(col * grid.cw), Math.floor(row * grid.ch), Math.ceil(grid.cw) + 1, Math.ceil(grid.ch) + 1);
    }
  }

  /* Filet de grille : un liseré clair avant chaque coupe, un sombre apres. */
  const line = Math.max(0.65, Math.min(grid.cw, grid.ch) * GRID_WIDTH);
  ctx.fillStyle = `rgba(255,255,255,${GRID_LIGHT})`;
  for (let c = 1; c < grid.cols; c++) ctx.fillRect(Math.round(c * grid.cw) - line, 0, line, h);
  for (let r = 1; r < grid.rows; r++) ctx.fillRect(0, Math.round(r * grid.ch) - line, w, line);
  ctx.fillStyle = rgba(sample(colors, divs, 0), GRID_DARK);
  for (let c = 1; c < grid.cols; c++) ctx.fillRect(Math.round(c * grid.cw), 0, line, h);
  for (let r = 1; r < grid.rows; r++) ctx.fillRect(0, Math.round(r * grid.ch), w, line);
}
