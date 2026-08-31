/*
 * RING (Rings) — des anneaux concentriques vus comme des ondes a la surface.
 *
 * On peint des disques du plus grand au plus petit ; chacun porte un degrade
 * radial qui reste sombre jusqu'au disque precedent puis s'eclaircit d'un coup
 * sur sa lisiere. Par-dessus, un trait conique fait courir la lumiere le long
 * de chaque anneau, une passe floue en « screen » ajoute le halo, et un
 * vignetage referme la scene.
 */

import { mix, hexToRgb } from '../color.js';

export const RING_FIELD = { count: 12, dirX: 0, dirY: 0, melt: 0, glow: 100, sweep: 100 };

const MIN_RINGS = 5;
const MAX_RINGS = 24;
const OFFSET_X = 0.96393;   // amplitude du deplacement du centre
const OFFSET_Y = 0.523675;

/* Les six tons de la scene, deduits de la palette. */
function ringPalette(colors) {
  const list = colors || [];
  if (list.length >= 6) {
    return { glow: list[0], veil: list[1], body: list[2], depth: list[3], shadow: list[4], rim: list[5] };
  }
  const glow = list[0] ?? '#FF9FCB';
  const body = list[1] ?? list[0] ?? '#2170D5';
  const depth = list[2] ?? mix(body, '#000000', 0.42);
  const shadow = list[3] ?? list[list.length - 1] ?? mix(depth, '#000000', 0.72);
  return { glow, veil: mix(glow, '#FFFFFF', 0.68), body, depth, shadow, rim: mix(body, '#FFFFFF', 0.24) };
}

/* Teintes d'un anneau donne : le fond passe de l'ombre au corps vers l'exterieur. */
function ringTones(palette, index, count) {
  const t = count <= 1 ? 0 : index / (count - 1);
  const deep = t < 0.58
    ? mix(palette.shadow, palette.depth, t / 0.58)
    : mix(palette.depth, palette.body, Math.min(1, (t - 0.58) / 0.25));
  const dark = t > 0.83 ? mix(deep, palette.depth, (t - 0.83) * 0.7) : deep;
  const mid = mix(dark, palette.rim, 0.32 + Math.sin(t * Math.PI) * 0.34);
  const edge = mix(mid, palette.veil, 0.1 + Math.sin(t * Math.PI) * 0.12);
  return { dark, mid, edge };
}

let glowCanvas = null;
let sweepCanvas = null;
const layer = (which, w, h) => {
  let canvas = which === 'glow' ? glowCanvas : sweepCanvas;
  if (!canvas) { canvas = document.createElement('canvas'); if (which === 'glow') glowCanvas = canvas; else sweepCanvas = canvas; }
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);
  return ctx;
};

export function paintRings(ctx, w, h, colors, field = RING_FIELD) {
  const f = { ...RING_FIELD, ...(field ?? {}) };
  const palette = ringPalette(colors);
  const count = Math.max(MIN_RINGS, Math.min(MAX_RINGS, Math.round(Number(f.count) || RING_FIELD.count)));
  const unit = w / 900;

  const cx = (0.5 + (2 * (f.dirX ?? 0) - 1) * OFFSET_X) * w;
  const cy = (0.5 + (2 * (f.dirY ?? 0) - 1) * OFFSET_Y) * h;

  /* Rayon du premier anneau : juste au-dela du bord le plus proche. */
  const inner = Math.hypot(Math.max(0, -cx, cx - w), Math.max(0, -cy, cy - h));
  const outer = Math.max(
    Math.hypot(cx, cy), Math.hypot(w - cx, cy),
    Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy),
  );
  const first = inner + (outer - inner) * 0.135;
  const step = (outer * 1.04 - first) / Math.max(1, count - 1);
  const radii = Array.from({ length: count }, (_, i) => first + step * i);

  const melt = Math.max(0, Math.min(1, (Number(f.melt) || 0) / 100));
  const glowGain = Math.max(0, Math.min(1, (Number(f.glow) || 0) / 100));
  const sweepGain = Math.max(0, Math.min(1, (Number(f.sweep) || 0) / 100));
  const blur = melt * step * 0.55;

  ctx.save();
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  /* Du plus grand au plus petit : chaque disque recouvre le precedent. */
  for (let i = count - 1; i >= 0; i--) {
    const radius = radii[i];
    const tone = ringTones(palette, i, count);
    const hole = i > 0 ? radii[i - 1] / radius : 0.55;
    const deep = mix(tone.dark, tone.mid, 0.22);
    const lip = mix(tone.mid, tone.edge, 0.3);
    const crest = mix(tone.edge, '#FFFFFF', 0.24);

    ctx.save();
    if (blur > 0.05) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    /* Les arrets doivent rester croissants, sinon le canvas refuse le degrade. */
    let last = 0;
    const at = (offset, color) => {
      const v = Math.max(last, Math.max(0, Math.min(1, offset)));
      last = v;
      grad.addColorStop(v, color);
    };
    at(0, deep);
    at(hole - 0.005, deep);
    at(hole + 0.55 * (1 - hole), mix(deep, lip, 0.55));
    at(0.988, lip);
    at(1, crest);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const conic = typeof ctx.createConicGradient === 'function';
  /* Lumiere rasante : elle demarre faible, culmine vers un quart de tour. */
  const sweepStroke = (target, color, soft) => {
    const pale = mix(color, '#FFFFFF', 0.24);
    const paler = mix(color, '#FFFFFF', 0.4);
    const palest = mix(color, '#FFFFFF', soft ? 0.5 : 0.62);
    const alpha = soft ? [0.08, 0.16, 0.3, 0.5, 0.66, 0.66] : [0.12, 0.24, 0.42, 0.66, 0.9, 0.9];
    const g = target.createConicGradient(0, cx, cy);
    const rgba = (hex) => { const [r, gg, b] = hexToRgb(hex); return (a) => `rgba(${r},${gg},${b},${a})`; };
    g.addColorStop(0, rgba(pale)(alpha[0]));
    g.addColorStop(16 / 360, rgba(pale)(alpha[1]));
    g.addColorStop(32 / 360, rgba(paler)(alpha[2]));
    g.addColorStop(50 / 360, rgba(palest)(alpha[3]));
    g.addColorStop(66 / 360, rgba(palest)(alpha[4]));
    g.addColorStop(84 / 360, rgba(palest)(alpha[5]));
    g.addColorStop(150 / 360, rgba(palest)(alpha[1]));
    g.addColorStop(320 / 360, rgba(pale)(0.04));
    g.addColorStop(359.9 / 360, rgba(pale)(alpha[0]));
    return g;
  };

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = glowGain;
  if (blur > 0.3) ctx.filter = `blur(${(blur * 0.7).toFixed(2)}px)`;
  for (let i = 0; i < count; i++) {
    const tone = ringTones(palette, i, count);
    ctx.strokeStyle = conic ? sweepStroke(ctx, tone.edge, false) : mix(tone.edge, '#FFFFFF', 0.5);
    ctx.lineWidth = Math.max(0.5, 1.8 * unit);
    ctx.beginPath();
    ctx.arc(cx, cy, radii[i], 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  /* Meme trace, epais et floute : c'est le halo. */
  const halo = layer('glow', w, h);
  for (let i = 0; i < count; i++) {
    const tone = ringTones(palette, i, count);
    halo.strokeStyle = conic ? sweepStroke(halo, tone.edge, true) : mix(tone.edge, '#FFFFFF', 0.34);
    halo.lineWidth = Math.max(0.5, 8 * unit);
    halo.beginPath();
    halo.arc(cx, cy, radii[i], 0, Math.PI * 2);
    halo.stroke();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = glowGain;
  ctx.filter = `blur(${(9 * unit + blur).toFixed(2)}px)`;
  ctx.drawImage(halo.canvas, 0, 0);
  ctx.restore();

  if (conic) {
    /* Balayage general, masque pour ne mordre que la peripherie. */
    const sweep = layer('sweep', w, h);
    const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})` };
    const body = palette.body;
    const gradient = sweep.createConicGradient(0, cx, cy);
    gradient.addColorStop(0, rgba(body, 0.02));
    gradient.addColorStop(10 / 360, rgba(body, 0.08));
    gradient.addColorStop(20 / 360, rgba(palette.rim, 0.2));
    gradient.addColorStop(32 / 360, rgba(mix(palette.rim, '#FFFFFF', 0.4), 0.44));
    gradient.addColorStop(45 / 360, rgba(mix(palette.veil, '#FFFFFF', 0.3), 0.66));
    gradient.addColorStop(56 / 360, rgba(mix(palette.glow, '#FFFFFF', 0.45), 0.82));
    gradient.addColorStop(68 / 360, rgba(mix(palette.glow, '#FFFFFF', 0.22), 0.94));
    gradient.addColorStop(84 / 360, rgba(mix(palette.glow, '#FFFFFF', 0.3), 0.94));
    gradient.addColorStop(359.9 / 360, rgba(body, 0.02));
    sweep.fillStyle = gradient;
    sweep.fillRect(0, 0, w, h);

    const reach = outer + 80 * unit;
    const mask = sweep.createRadialGradient(cx, cy, 0, cx, cy, reach);
    mask.addColorStop(0, 'rgba(255,255,255,0)');
    mask.addColorStop(0.32, 'rgba(255,255,255,0)');
    mask.addColorStop(0.54, 'rgba(255,255,255,1)');
    mask.addColorStop(1, 'rgba(255,255,255,1)');
    sweep.globalCompositeOperation = 'destination-in';
    sweep.fillStyle = mask;
    sweep.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = sweepGain;
    ctx.drawImage(sweep.canvas, 0, 0);
    ctx.restore();
  }

  /* Vignetage final, dans la couleur profonde. */
  const deepen = mix(palette.body, palette.depth, 0.5);
  const [r, g, b] = hexToRgb(deepen);
  ctx.save();
  ctx.globalAlpha = sweepGain;
  const vignette = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer * 1.083);
  vignette.addColorStop(0, `rgba(${r},${g},${b},0)`);
  vignette.addColorStop(0.72, `rgba(${r},${g},${b},0)`);
  vignette.addColorStop(0.86, `rgba(${r},${g},${b},0.26)`);
  vignette.addColorStop(1, `rgba(${r},${g},${b},0.44)`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
