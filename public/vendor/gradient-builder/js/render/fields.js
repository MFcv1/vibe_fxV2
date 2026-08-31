/*
 * Types "champ" analytiques : Mesh (AIR), Radial, Conic, iOS, Waves.
 * Contrairement a Flow, ils s'ecrivent avec les gradients natifs du canvas.
 */

import {
  hexToRgb, mix, bounds, bandCenters, bandWeight, rampStops, lightness,
} from '../color.js';

/* ---------------------------------------------------------------- Mesh */

/* Emplacements et tailles de blob par defaut, en % du canvas. */
const MESH_SPOTS = [[16, 82], [78, 26], [88, 84], [24, 16], [50, 55], [62, 100]];
const MESH_SIZES = [[72, 58], [56, 72], [78, 62], [50, 44], [90, 76], [62, 50]];
const MESH_CORE = 22;   // % du rayon ou la couleur reste pleine
const MESH_EDGE = 72;   // % du rayon ou elle est completement fondue

/* Fond : la couleur la plus claire, eclaircie si la palette est sombre. */
function meshBase(colors) {
  const brightest = colors.reduce((best, c) => (lightness(c) > lightness(best) ? c : best), colors[0]);
  return lightness(brightest) < 0.5 ? mix(brightest, '#F7F4EE', 0.55) : brightest;
}

const blobScale = (weight) => Math.min(1.45, Math.max(0.55, Math.sqrt(weight)));

export function paintMesh(ctx, w, h, colors, divs, spots) {
  ctx.fillStyle = meshBase(colors);
  ctx.fillRect(0, 0, w, h);

  colors.forEach((color, i) => {
    const [px, py] = (spots && spots[i]) || MESH_SPOTS[i % MESH_SPOTS.length];
    const [sw, sh] = MESH_SIZES[i % MESH_SIZES.length];
    const k = blobScale(bandWeight(colors.length, divs, i));
    const cx = (px / 100) * w;
    const cy = (py / 100) * h;
    const rx = (sw / 100) * w * k;
    const ry = (sh / 100) * h * k;
    const [r, g, b] = hexToRgb(color);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(MESH_CORE / 100, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(MESH_EDGE / 100, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(-cx, (0 - cy) * (rx / ry), w, h * (rx / ry));
    ctx.restore();
  });
}

export const meshHandles = (count, spots) =>
  Array.from({ length: count }, (_, i) => (spots && spots[i]) || MESH_SPOTS[i % MESH_SPOTS.length]);

/* -------------------------------------------------------------- Linear */

export function paintLinear(ctx, w, h, colors, divs) {
  const stops = bandCenters(colors.length, divs).map((c) => c / 100);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  rampStops(colors, stops).forEach(([c, p]) => grad.addColorStop(p, c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/* ----------------------------------------------------------------- iOS */

export function paintIos(ctx, w, h, colors, divs) {
  const stops = bandCenters(colors.length, divs).map((c) => c / 100);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  rampStops(colors, stops, 6, true).forEach(([c, p]) => grad.addColorStop(p, c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const sheen = ctx.createRadialGradient(w * 0.12, h * 0.08, 0, w * 0.12, h * 0.08, Math.max(w, h) * 0.72);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.6, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
}

/* -------------------------------------------------------------- Radial */

const RADIAL = { cx: 0.5, cy: 0.5, r: 0.62 };

/* Les centres sont renormalises sur 0..0.88 pour laisser un bord plein. */
const spread = (list) => {
  const first = list[0];
  const span = Math.max(1e-6, list[list.length - 1] - first);
  return list.map((v) => ((v - first) / span) * 0.88);
};

export function paintRadial(ctx, w, h, colors, divs) {
  const centers = bandCenters(colors.length, divs).map((c) => c / 100);
  const radius = Math.min(w, h) * RADIAL.r;
  const grad = ctx.createRadialGradient(w * RADIAL.cx, h * RADIAL.cy, 0, w * RADIAL.cx, h * RADIAL.cy, radius);
  rampStops(colors, spread(centers), 6, true).forEach(([c, p]) => grad.addColorStop(p, c));
  grad.addColorStop(1, colors[colors.length - 1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/* --------------------------------------------------------------- Conic */

/* La palette est mirroir pour que le raccord a 360 degres soit invisible. */
export function paintConic(ctx, w, h, colors, divs) {
  const centers = bandCenters(colors.length, divs).map((c) => c / 100);
  const wheel = [...colors, ...[...colors.slice(0, -1)].reverse()];
  const at = [
    ...centers.map((c) => c * 0.5),
    ...[...centers.slice(0, -1)].reverse().map((c) => 1 - c * 0.5),
  ];
  const grad = ctx.createConicGradient((120 * Math.PI) / 180, w / 2, h / 2);
  rampStops(wheel, at).forEach(([c, p]) => grad.addColorStop(p, c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/* --------------------------------------------------------------- Waves */

const WAVE_SEGMENTS = 96;
const WAVE_OVERHANG = 8;
const WAVE_BLUR = 0.022;
const lighten = (hex) => mix(hex, '#FFFFFF', 0.22);
const darken = (hex) => mix(hex, '#1C1C2E', 0.14);

/* Crete d'une vague : une sinusoide principale plus une harmonique. */
function wavePoints(level, index) {
  const belly = Math.min(1, 4 * level * (1 - level) + 0.5);
  const amp = (index % 2 === 0 ? 0.046 : 0.035) * belly;
  const amp2 = amp * 0.16;
  const freq = 0.75 + (index % 3) * 0.3;
  const freq2 = freq * 2.15;
  const phase = index * 1.9 + 0.6;
  const phase2 = phase + Math.PI / 2 + index * 0.8;
  const pts = [];
  for (let i = -WAVE_OVERHANG; i <= WAVE_SEGMENTS + WAVE_OVERHANG; i++) {
    const u = i / WAVE_SEGMENTS;
    pts.push([u, level + amp * Math.sin(u * Math.PI * 2 * freq + phase) + amp2 * Math.sin(u * Math.PI * 2 * freq2 + phase2)]);
  }
  return pts;
}

export function paintWaves(ctx, w, h, colors, divs) {
  const edges = bounds(colors.length, divs);
  const band = (i, top, bottom) => {
    const grad = ctx.createLinearGradient(0, top, 0, Math.max(bottom, top + 1));
    grad.addColorStop(0, lighten(colors[i]));
    grad.addColorStop(0.55, colors[i]);
    grad.addColorStop(1, darken(colors[i]));
    return grad;
  };

  ctx.fillStyle = band(0, 0, edges[1] * h);
  ctx.fillRect(0, 0, w, h);

  colors.slice(1).forEach((_, i) => {
    const pts = wavePoints(edges[i + 1], i);
    ctx.save();
    ctx.filter = `blur(${(h * WAVE_BLUR).toFixed(1)}px)`;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
    for (const [x, y] of pts) ctx.lineTo(x * w, y * h);
    ctx.lineTo(pts[pts.length - 1][0] * w, h * 1.2);
    ctx.lineTo(pts[0][0] * w, h * 1.2);
    ctx.closePath();
    ctx.fillStyle = band(i + 1, edges[i + 1] * h, edges[i + 2] * h);
    ctx.fill();
    ctx.restore();
  });
}
