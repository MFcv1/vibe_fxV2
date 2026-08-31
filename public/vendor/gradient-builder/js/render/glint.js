/*
 * GLINT — le soleil qui scintille sur l'eau.
 *
 * La scene est un degrade vertical, un horizon, puis une nappe de lumiere qui
 * descend vers l'observateur. Sur cette nappe on sème des centaines de petites
 * ellipses : plus on approche du bas, plus les vagues sont grandes et espacees,
 * exactement comme une perspective. Une texture de toile en « soft-light »
 * casse le lisse du degrade.
 */

import { mix, hexToRgb, bandCenters, rampStops, clamp } from '../color.js';

export const GLINT_FIELD = { scale: 50, horizon: 0.44 };

const TEXTURE_SIZE = 128;
const MAX_SPARKS = 4200;
const SUN_X = 0.5;          // colonne ou le soleil se reflete
const HAZE = 0.016;
const SHEET = 0.11;         // hauteur de la nappe de lumiere
const BRIGHTNESS = [[0.95, 1], [0.9, 1], [0.82, 0.96], [0.7, 0.9], [0.55, 0.78], [0.4, 0.62]];
const WEIGHTS = [3, 7, 17, 30, 39, 4];
const SOFTNESS = [0.55, 0.68, 0.8, 0.9];
const HARD_STOP = 3;

/* Suite pseudo-aleatoire reproductible : la mer est toujours la meme. */
const seeded = (seed) => {
  let s = seed | 0;
  return () => {
    s = (s + 1831565813) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* Nombre de rangees de vagues. */
const rowCount = (scale) => Math.round(14 + (clamp(scale, 0, 100) / 100) * 22);
/* Proximite d'une rangee : 0 au loin, 1 au premier plan. */
const nearness = (row, rows) => 0.02 + 0.98 * Math.pow(1 - (row + 0.5) / rows, 1.5);

/* Chaque rangee a son propre rythme d'ondulation. */
function rowTraits(row) {
  const rnd = seeded(40503 ^ Math.imul(row + 1, 2654435761));
  return {
    amp: rnd(), freq: 1 + Math.floor(rnd() * 4), phase: rnd() * Math.PI * 2,
    thick: rnd(), opacityA: rnd(), opacityB: rnd(),
    driftFreq: 2 + Math.floor(rnd() * 4), driftPhase: rnd() * Math.PI * 2,
  };
}

/* Hauteur d'une rangee a l'abscisse t, horizon compris. */
function rowHeight(row, rows, horizon, t) {
  const near = nearness(row, rows);
  const traits = rowTraits(row);
  const sway = (0.004 + traits.amp * 0.016) * Math.pow(near, 1.2);
  return horizon + (1 - horizon - 0.004) * near + sway * Math.sin(t * Math.PI * 2 * traits.freq + traits.phase);
}

/* Densite des reflets : maximale sous le soleil, elle s'evase vers le bas. */
function beamAt(x, near) {
  const width = 0.085 + 0.42 * Math.pow(near, 1.15);
  const off = Math.abs(x - SUN_X) / width;
  return 0.24 + 0.76 * Math.exp(-Math.pow(off, 2.1));
}

/* Tirage pondere de la classe de brillance d'un reflet. */
function pickBrightness(rnd, density) {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let ticket = rnd() * total * (1 - 0.5 * density);
  for (let i = 0; i < WEIGHTS.length; i++) {
    if (ticket < WEIGHTS[i]) return i;
    ticket -= WEIGHTS[i];
  }
  return WEIGHTS.length - 1;
}

/* Six tons pour l'eau, du plus clair au plus profond. */
function waterTones(colors) {
  const n = colors.length;
  const light = colors[0];
  const mid = colors[Math.min(n - 1, Math.round((n - 1) * 0.6))];
  const deep = colors[n - 1];
  return [
    mix('#FFFFFF', light, 0.12), mix('#FFFFFF', light, 0.42),
    mix(light, mid, 0.25), mix(light, mid, 0.5), mix(light, mid, 0.72), mix(mid, deep, 0.4),
  ];
}

/* Toile fine, tramee et bruitee : la matiere du tirage. */
let weave = null;
function weaveTexture() {
  if (weave) return weave;
  const size = TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const px = img.data;
  const rnd = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v) };
  const cell = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x % cell) / cell;
      const v = (y % cell) / cell;
      const warpUp = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const su = Math.sin(u * Math.PI);
      const sv = Math.sin(v * Math.PI);
      let value = warpUp ? (sv - 0.5) * 0.9 + (su - 0.5) * 0.25 : (su - 0.5) * 0.9 + (sv - 0.5) * 0.25;
      value += (rnd(x, y) - 0.5) * 0.35;
      value += (rnd(Math.floor(x / 8), y) - 0.5) * 0.18;
      const grey = Math.max(0, Math.min(255, 128 + value * 34));
      const o = (y * size + x) * 4;
      px[o] = px[o + 1] = px[o + 2] = grey;
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  weave = canvas;
  return canvas;
}

/* Longues trainees le long des vagues, dessinees avant les reflets. */
function streaks(w, h, scale, horizon) {
  const rows = rowCount(scale);
  const out = [];
  const steps = 64;
  for (let row = 0; row < rows; row++) {
    const near = nearness(row, rows);
    if (near < 0.1) continue;
    const traits = rowTraits(row);
    const fade = Math.min(1, Math.max(0, (near - 0.1) / 0.25));
    const thickness = h * (0.012 + 0.022 * traits.thick) * (0.2 + 0.9 * near);
    const shadow = [];
    const light = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = rowHeight(row, rows, horizon, t) * h;
      shadow.push([t * w, y + thickness * 0.55]);
      light.push([t * w, y - thickness * 0.22]);
    }
    out.push({
      shadow, light, shadowWidth: thickness * 1.15, lightWidth: thickness * 0.65,
      shadowAlpha: (0.09 + 0.08 * traits.opacityA) * fade,
      lightAlpha: (0.07 + 0.07 * traits.opacityB) * fade,
    });
  }
  return out;
}

/* Les reflets : semes le long de chaque vague, tries par intensite. */
function sparks(w, h, scale, horizon) {
  const unit = Math.min(w, h);
  const amount = clamp(scale, 0, 100);
  const rows = rowCount(amount);
  const density = 0.35 + (amount / 100) * 0.85;
  const size = unit * 0.012;
  const gap = (unit * 0.0075) / density;
  const perRow = Math.round(36 + (amount / 100) * 64);
  const rnd = seeded(20973 ^ Math.round(amount * 2654435));
  const out = [];

  const add = (x, y, rx, ry, alpha, tone, soft) => {
    if (out.length >= MAX_SPARKS) return;
    let band = soft;
    if (band == null) {
      const pick = 0.5 + rnd() * 0.32;
      band = pick < 0.6 ? 0 : pick < 0.74 ? 1 : 2;
    }
    out.push({ x: x * w, y: y * h, rx, ry, a: alpha, ci: tone, sb: band });
  };

  for (let row = 0; row < rows && out.length < MAX_SPARKS; row++) {
    const near = nearness(row, rows);
    const traits = rowTraits(row);
    let x = rnd() * 0.03;
    let placed = 0;
    while (x < 1 && out.length < MAX_SPARKS && placed < perRow) {
      const drift = 0.5 + 0.5 * Math.sin(x * Math.PI * 2 * traits.driftFreq + traits.driftPhase);
      const beam = beamAt(x, near);
      const grow = 0.55 + rnd() * rnd() * 0.85 + (rnd() < 0.07 ? rnd() * 0.35 : 0);
      const rx = Math.max(0.4, size * grow * (0.34 + 0.62 * Math.pow(near, 0.9)));
      const stride = (0.95 + (1 - drift) * 0.9 + rnd() * 0.45) / density;

      if (rnd() < beam * (0.9 + 0.1 * drift)) {
        const y = rowHeight(row, rows, horizon, x) + (rnd() - 0.5) * (size / unit) * 1.3 * near;
        if (y > horizon && y < 0.995) {
          const tone = pickBrightness(rnd, Math.min(1, beam * (0.55 + 0.45 * (1 - near))));
          const [low, high] = BRIGHTNESS[tone];
          const alpha = Math.min(1, (low + rnd() * (high - low)) * (0.42 + 0.58 * beam) * (0.85 + 0.15 * drift));
          const stretch = Math.min(2.1, (1.05 + 1.1 * Math.pow(1 - near, 2)) * (0.88 + rnd() * 0.35));
          const ry = rx * stretch;
          /* Les reflets les plus vifs portent un halo, puis un eclat dur. */
          if (tone <= 2) {
            const halo = 1.7 + rnd() * 0.6;
            add(x, y, rx * halo, ry * halo, alpha * (0.14 + rnd() * 0.1), tone, 0);
          }
          add(x, y, rx, ry, alpha, tone);
          if (tone <= 1 && beam > 0.7 && rnd() < 0.32) {
            const spike = rx * (0.36 + rnd() * 0.2);
            add(x, y, spike * 0.36, spike * (2.6 + rnd() * 1.8), Math.min(1, alpha * 0.85), 0, 0);
            add(x, y, spike, spike * (1.1 + rnd() * 0.3), Math.min(1, alpha * 1.4 + 0.18), 0, HARD_STOP);
          }
          placed++;
        }
      }
      x += Math.max(gap, 2 * rx * stride) / w;
    }
  }

  /* Une poussiere de reflets ternes, partout, pour remplir le fond. */
  const dust = Math.round((0.15 + 0.85 * (amount / 100)) * rows * 16);
  for (let i = 0; i < dust && out.length < MAX_SPARKS; i++) {
    const near = 0.02 + 0.98 * Math.pow(rnd(), 1.5);
    const y = horizon + (1 - horizon - 0.01) * near;
    if (y <= horizon) continue;
    const x = rnd();
    const beam = beamAt(x, near);
    if (rnd() > beam * 0.85) continue;
    const tone = 4 + (rnd() < 0.3 ? 1 : 0);
    const [low, high] = BRIGHTNESS[tone];
    const rx = Math.max(0.35, size * (0.15 + 0.55 * near) * (0.4 + rnd() * 0.6));
    const alpha = Math.min(0.72, (low + rnd() * (high - low)) * 0.8 * (0.4 + 0.6 * beam));
    add(x, y, rx, rx * Math.min(1.9, 1 + (1 - near) * 1.1), alpha, tone);
  }

  return out.sort((a, b) => a.a - b.a);
}

export function paintGlint(ctx, w, h, colors, divs, field = GLINT_FIELD) {
  const f = { ...GLINT_FIELD, ...(field ?? {}) };
  const horizon = f.horizon ?? 0.44;

  /* Le ciel et l'eau en un seul degrade. */
  const stops = bandCenters(colors.length, divs).map((c) => c / 100);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  rampStops(colors, stops).forEach(([c, p]) => sky.addColorStop(p, c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const cloth = (alpha) => {
    const pattern = ctx.createPattern(weaveTexture(), 'repeat');
    if (!pattern) return;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };
  cloth(1);

  const tones = waterTones(colors);
  const asRgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})` };

  /* Une brume juste sous l'horizon, pour asseoir la ligne. */
  const hazeTop = horizon * h;
  const haze = ctx.createLinearGradient(0, hazeTop, 0, hazeTop + h * HAZE);
  const hazeTone = mix(colors[Math.min(colors.length - 1, Math.round((colors.length - 1) * 0.55))], '#000000', 0.05);
  haze.addColorStop(0, asRgba(hazeTone, 0.16));
  haze.addColorStop(1, asRgba(hazeTone, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, hazeTop, w, h * HAZE);

  /* La nappe de lumiere, floue, qui descend du soleil. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, hazeTop - h * 0.004, w, h * (SHEET + 0.01));
  ctx.clip();
  ctx.filter = `blur(${(h * 0.006).toFixed(1)}px)`;
  ctx.translate(SUN_X * w, hazeTop);
  const reach = 0.46 * w;
  ctx.scale(1, (SHEET * h) / reach);
  const sheet = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
  sheet.addColorStop(0, asRgba(tones[0], 0.5));
  sheet.addColorStop(0.35, asRgba(tones[1], 0.22));
  sheet.addColorStop(1, asRgba(tones[2], 0));
  ctx.fillStyle = sheet;
  ctx.fillRect(-2 * w, -2 * h, 4 * w, 4 * h);
  ctx.restore();

  /* Les trainees : une ombre epaisse, puis un filet clair au-dessus. */
  const draw = (points, color, width, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  };
  ctx.save();
  ctx.filter = `blur(${(h * 0.005).toFixed(1)}px)`;
  ctx.lineCap = 'round';
  const dark = mix(colors[colors.length - 1], '#000000', 0.22);
  const lanes = streaks(w, h, f.scale, horizon);
  for (const lane of lanes) draw(lane.shadow, dark, lane.shadowWidth, lane.shadowAlpha);
  for (const lane of lanes) draw(lane.light, tones[2], lane.lightWidth, lane.lightAlpha);
  ctx.restore();

  /* Les reflets eux-memes. */
  const rgbTones = tones.map(hexToRgb);
  for (const spark of sparks(w, h, f.scale, horizon)) {
    const [r, g, b] = rgbTones[spark.ci];
    const solid = SOFTNESS[spark.sb] ?? SOFTNESS[0];
    ctx.save();
    ctx.translate(spark.x, spark.y);
    ctx.scale(1, spark.ry / spark.rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, spark.rx);
    grad.addColorStop(0, `rgba(${r},${g},${b},${spark.a})`);
    grad.addColorStop(solid, `rgba(${r},${g},${b},${spark.a})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, spark.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  cloth(0.4);
}
