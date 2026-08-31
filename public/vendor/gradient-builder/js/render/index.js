/*
 * Aiguillage de rendu + finition (flou, grain).
 *
 * Le canvas est peint a une resolution "brouillon" pendant qu'on manipule un
 * reglage, puis repeint en pleine resolution des que la main se leve : les
 * champs par pixel (Flow, Stripes, Bars) coutent trop cher pour tourner a
 * chaque frame en 1600px.
 */

import { paintFlow, FLOW_FIELD, FLOW_TIME, flowHandles } from './flow.js';
import { paintMesh, paintLinear, paintIos, paintRadial, paintConic, paintWaves, meshHandles } from './fields.js';
import { paintStripes, paintBars, STRIPE_FIELD, BARS_FIELD, COLS_FIELD, PRISM_FIELD } from './strips.js';
import { paintSky, SKY_FIELD } from './sky.js';
import { paintAurora, AURORA_FIELD } from './aurora.js';
import { paintLines } from './lines.js';
import { paintShapes, loadShapes, SHAPES_FIELD } from './shapes.js';
import { paintStill, STILL_FIELD } from './still.js';
import { paintRetro } from './retro.js';
import { paintNoise, NOISE_FIELD } from './noise.js';
import { paintPrism } from './prism.js';
import { paintHive, paintCubes, paintBalls } from './tiles.js';
import { paintRings, RING_FIELD } from './rings.js';
import { paintArch } from './arch.js';
import { paintPixel, PIXEL_FIELD } from './pixel.js';
import { paintGlassy, GLASSY_FIELD } from './glassy.js';
import { paintGlint, GLINT_FIELD } from './glint.js';
import { paintMist, MIST_FIELD } from './mist.js';
import { paintSkyline, loadCities } from './skyline.js';

export { loadCities };

export { loadShapes };

export const MAX_RENDER = 1600;   // plafond de resolution, meme a l'export
export const DRAFT_MAX = 260;     // resolution pendant une manipulation

/* Types dont le moteur est ecrit. Les autres retombent sur la rampe lineaire. */
export const READY = new Set([
  'FLOW', 'SKY', 'AURORA', 'AIR', 'SMESH', 'RETRO', 'IOS', 'SHAPES', 'LINE',
  'LINEAR', 'STRIPE', 'BARS', 'COLS', 'PRISM', 'WAVE', 'CIRCLE', 'ANGULAR', 'CNOISE',
  'RING', 'BEEHIVE', 'BALLS', 'CUBE', 'ARCH', 'PIXEL',
  'GLASSY', 'GLINT', 'MIST', 'SKYLINE',
]);

/* Types rendus par le GPU : ils tournent a pleine cadence sans cout notable. */
export const GPU_TYPES = new Set(['SKY', 'AURORA']);

/* Types dont le dessin evolue avec le temps. Les autres ignorent l'horloge. */
export const ANIMATED = new Set([
  'SKY', 'AURORA', 'FLOW', 'RETRO', 'STRIPE', 'BARS', 'COLS', 'PRISM', 'LINE', 'PIXEL', 'GLASSY',
]);

/* Resolution de travail pendant l'animation, par type. */
export const PLAY_MAX = 460;

export const FIELD_DEFAULTS = {
  flow: FLOW_FIELD,
  form: SHAPES_FIELD,
  sky: SKY_FIELD,
  aurora: AURORA_FIELD,
  still: STILL_FIELD,
  noise: NOISE_FIELD,
  ring: RING_FIELD,
  pixel: PIXEL_FIELD,
  glassy: GLASSY_FIELD,
  glint: GLINT_FIELD,
  mist: MIST_FIELD,
  stripe: STRIPE_FIELD,
  BARS: BARS_FIELD,
  COLS: COLS_FIELD,
  PRISM: PRISM_FIELD,
};

/* Les champs par pixel ne gagnent rien a depasser la taille d'affichage. */
const PER_PIXEL = new Set(['FLOW', 'STRIPE', 'BARS', 'COLS', 'SMESH', 'RETRO']);

/* Les traits ont besoin de resolution : en dessous, les fins deviennent baveux. */
const VECTOR = new Set(['LINE', 'SHAPES', 'SKYLINE', 'GLASSY']);

export function paint(ctx, w, h, state) {
  const { type, stops, divs, time } = state;
  const colors = stops;
  switch (type) {
    case 'FLOW': return paintFlow(ctx, w, h, colors, divs, state.flow ?? FLOW_FIELD, time, state.spots);
    case 'SKY': return paintSky(ctx, w, h, colors, divs, state.sky ?? SKY_FIELD, time);
    case 'AURORA': return paintAurora(ctx, w, h, colors, divs, state.aurora ?? AURORA_FIELD, time);
    case 'LINE': return paintLines(ctx, w, h, colors, divs, state.lines, time, state.draft === true);
    case 'SHAPES': return paintShapes(ctx, w, h, colors, state.form);
    case 'SMESH': return paintStill(ctx, w, h, colors, divs, state.still ?? STILL_FIELD);
    case 'RETRO': return paintRetro(ctx, w, h, colors, divs, time);
    case 'CNOISE': return paintNoise(ctx, w, h, colors, state.noise ?? NOISE_FIELD);
    case 'PRISM': return paintPrism(ctx, w, h, colors, divs, state.bars ?? PRISM_FIELD, time);
    case 'RING': return paintRings(ctx, w, h, colors, state.ring ?? RING_FIELD);
    case 'BEEHIVE': return paintHive(ctx, w, h, colors, divs, state.scale ?? 50);
    case 'CUBE': return paintCubes(ctx, w, h, colors, divs, state.scale ?? 50);
    case 'BALLS': return paintBalls(ctx, w, h, colors, divs, state.scale ?? 50, state.ballStyle ?? 'convex');
    case 'ARCH': return paintArch(ctx, w, h, colors, divs);
    case 'PIXEL': return paintPixel(ctx, w, h, colors, divs, state.scale ?? 50, state.pixel ?? PIXEL_FIELD, time);
    case 'GLASSY': return paintGlassy(ctx, w, h, colors, divs, state.glassy ?? GLASSY_FIELD, time);
    case 'GLINT': return paintGlint(ctx, w, h, colors, divs, state.glint ?? GLINT_FIELD);
    case 'MIST': return paintMist(ctx, w, h, colors, divs, state.mist ?? MIST_FIELD, state.scale ?? 50, state.horizon ?? 0.42);
    case 'SKYLINE': return paintSkyline(ctx, w, h, colors, divs, state.city ?? 'sanfrancisco');
    case 'AIR': return paintMesh(ctx, w, h, colors, divs, state.spots);
    case 'LINEAR': return paintLinear(ctx, w, h, colors, divs);
    case 'IOS': return paintIos(ctx, w, h, colors, divs);
    case 'CIRCLE': return paintRadial(ctx, w, h, colors, divs);
    case 'ANGULAR': return paintConic(ctx, w, h, colors, divs);
    case 'WAVE': return paintWaves(ctx, w, h, colors, divs);
    case 'STRIPE': return paintStripes(ctx, w, h, colors, divs, state.stripe ?? STRIPE_FIELD, time);
    case 'BARS': return paintBars(ctx, w, h, colors, divs, state.bars ?? BARS_FIELD, time);
    case 'COLS': return paintBars(ctx, w, h, colors, divs, state.bars ?? COLS_FIELD, time);
    default: return paintLinear(ctx, w, h, colors, divs);
  }
}

/* Anneaux deplacables sur le canvas, quand le type en a. */
export function handles(state) {
  if (state.type === 'FLOW') return flowHandles(state.stops.length, state.flow ?? FLOW_FIELD, state.time, state.spots);
  if (state.type === 'AIR') return meshHandles(state.stops.length, state.spots);
  return null;
}

/*
 * Peint dans le canvas visible. `draft` reduit la resolution interne : le
 * canvas est etire par le navigateur, ce qui adoucit au passage — c'est le
 * meme compromis que l'original.
 */
export function render(canvas, state, { draft = false, dpr = 1 } = {}) {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, Math.round(rect.width));
  const cssH = Math.max(1, Math.round(rect.height));

  let w, h;
  if (draft) {
    const k = Math.min(1, DRAFT_MAX / Math.max(cssW, cssH));
    w = Math.max(1, Math.round(cssW * k));
    h = Math.max(1, Math.round(cssH * k));
  } else {
    const target = PER_PIXEL.has(state.type) ? Math.min(MAX_RENDER, Math.max(cssW, cssH))
      : Math.min(MAX_RENDER, Math.max(cssW, cssH) * (VECTOR.has(state.type) ? Math.max(dpr, 1.5) : dpr));
    const k = target / Math.max(cssW, cssH);
    w = Math.max(1, Math.round(cssW * k));
    h = Math.max(1, Math.round(cssH * k));
  }

  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: PER_PIXEL.has(state.type) });
  state.draft = draft;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.clearRect(0, 0, w, h);
  paint(ctx, w, h, state);
  return { w, h };
}

/* Rendu hors ecran a taille libre, pour l'export et les vignettes. */
export function renderTo(w, h, state) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  paint(ctx, w, h, state);
  return canvas;
}

/* ---------------------------------------------------------------- grain */

let grainUrl = null;

/* Bruit monochrome 256px, tuile ensuite en CSS. */
export function grainTexture() {
  if (grainUrl) return grainUrl;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainUrl = canvas.toDataURL('image/png');
  return grainUrl;
}
