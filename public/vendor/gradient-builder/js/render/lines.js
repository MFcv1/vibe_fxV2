/*
 * LINE — des traits peints, pas un degrade.
 *
 * Chaque ligne est une forme parametree (serpent, boucle, spirale, gribouillis…)
 * echantillonnee en points, lissee en spline, puis tracee segment par segment
 * avec un degrade local : la couleur avance le long du trait. La premiere
 * couleur de la palette est le papier, les suivantes habillent les traits.
 */

import { sample } from '../color.js';

/* Generateur pseudo-aleatoire deterministe : meme graine, meme trait. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 1831565813) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const BASE_TIME = 20.75;

/* ------------------------------------------------------ formes de trait */

/* Chaque generateur rend des points dans un carre unite centre sur l'origine. */
const FORMS = {
  curve(line, rnd) {
    const waves = line.turns + 1;
    const depth = 0.08 + 0.26 * (line.curl / 100);
    const phase = rnd() * TAU;
    const swellPhase = rnd() * TAU;
    const ease = 0.9 + rnd() * 0.2;
    const steps = Math.max(24, waves * 10);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const belly = 0.6 + 0.4 * Math.sin(Math.PI * t);
      const swell = 1 + 0.18 * Math.sin(swellPhase + t * Math.PI * 1.3);
      pts.push([-0.5 + Math.pow(t, ease), depth * belly * swell * Math.sin(phase + t * Math.PI * waves)]);
    }
    return pts;
  },

  wave(line, rnd) {
    const depth = (0.06 + 0.22 * (line.curl / 100)) * (3 / Math.max(3, line.turns));
    const phase = rnd() * TAU;
    const swell = 0.1 + rnd() * 0.22;
    const swellFreq = 0.6 + rnd() * 1.2;
    const swellPhase = rnd() * TAU;
    const tilt = (rnd() - 0.5) * 0.18;
    const steps = Math.max(24, line.turns * 12);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const k = 1 + swell * Math.sin(swellPhase + t * TAU * swellFreq);
      pts.push([-0.5 + t, depth * k * Math.sin(phase + t * TAU * line.turns) + tilt * (t - 0.5)]);
    }
    return pts;
  },

  loop(line, rnd) {
    const turns = Math.max(1, line.turns);
    const pitch = 1 / turns;
    const wanted = 0.1 + 0.16 * (line.curl / 100);
    const radius = Math.min(wanted, pitch * 0.62);
    const way = rnd() < 0.5 ? 1 : -1;
    const drop = (rnd() - 0.5) * 0.16;
    const steps = turns * 28;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = -Math.PI / 2 + way * t * turns * TAU;
      pts.push([-0.5 + t + radius * Math.cos(a) * 0.9, radius * Math.sin(a) + (t - 0.5) * drop]);
    }
    /* On prolonge les deux bouts pour que les extremites sortent des boucles. */
    const extend = (from, to) => {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const len = Math.max(1e-6, Math.hypot(dx, dy));
      return [to[0] + (dx / len) * 0.07, to[1] + (dy / len) * 0.07];
    };
    pts.unshift(extend(pts[1], pts[0]));
    pts.push(extend(pts[pts.length - 2], pts[pts.length - 1]));
    return pts;
  },

  spiral(line, rnd) {
    const turns = line.turns;
    const inner = 0.05 + 0.13 * (1 - line.curl / 100);
    const outer = 0.48;
    const way = rnd() < 0.5 ? 1 : -1;
    const start = rnd() * TAU;
    const squash = 0.82 + rnd() * 0.36;
    const growth = 0.85 + rnd() * 0.4;
    const steps = turns * 22;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = start + way * t * turns * TAU;
      const r = inner + (outer - inner) * Math.pow(t, growth);
      pts.push([r * Math.cos(a), r * Math.sin(a) * squash]);
    }
    return pts;
  },

  bouncy(line, rnd) {
    const bounces = line.turns;
    const floor = 0.3;
    const height = 0.25 + 0.45 * (line.curl / 100);
    const jitter = Array.from({ length: bounces }, () => 0.82 + rnd() * 0.36);
    const steps = Math.max(28, bounces * 14);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const decay = 1 - 0.35 * t;
      const k = jitter[Math.min(bounces - 1, Math.floor(t * bounces))];
      const arc = Math.sin(Math.PI * bounces * t);
      const soft = 0.09;
      pts.push([-0.5 + t, floor - height * decay * k * (Math.sqrt(arc * arc + soft * soft) - soft)]);
    }
    return pts;
  },

  /* Marche au hasard tenue en laisse : elle repart toujours vers la sortie. */
  scribble(line, rnd) {
    const steps = 15 + line.turns * 5;
    const stride = 1.15 / steps;
    const chaos = line.curl / 100;
    const wander = 0.3 + 0.62 * chaos;
    const pull = 0.32 - 0.24 * chaos;
    const f1 = 1.2 + rnd() * 1.6;
    const f2 = 2.6 + rnd() * 2.4;
    const p1 = rnd() * TAU;
    const p2 = rnd() * TAU;
    let x = -0.42;
    let y = (rnd() - 0.5) * 0.25;
    let heading = (rnd() - 0.5) * 1.2;
    const pts = [[x, y]];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      heading += wander * (Math.sin(p1 + t * TAU * f1) + 0.6 * Math.sin(p2 + t * TAU * f2));
      const goal = -0.45 + 0.95 * t;
      let turn = Math.atan2(-y * 0.6, goal + 0.12 - x) - heading;
      while (turn > Math.PI) turn -= TAU;
      while (turn < -Math.PI) turn += TAU;
      heading += turn * pull;
      x += Math.cos(heading) * stride;
      y += Math.sin(heading) * stride;
      pts.push([x, y]);
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [px, py] of pts) {
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    }
    const k = 0.95 / Math.max(1e-6, Math.max(maxX - minX, maxY - minY));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return pts.map(([px, py]) => [(px - cx) * k, (py - cy) * k]);
  },

  zigzag(line, rnd) {
    const rows = line.turns + 1;
    const round = 0.2 + 0.28 * (line.curl / 100);
    const slant = (rnd() - 0.5) * 0.06;
    const pts = [];
    for (let i = 0; i < rows; i++) {
      const y = rows === 1 ? 0 : -0.5 + i / (rows - 1);
      const d = slant * (i % 2 === 0 ? 1 : -1);
      if (i % 2 === 0) pts.push([-0.54, y - d / 2], [0.54, y + d / 2]);
      else pts.push([0.54, y - d / 2], [-0.54, y + d / 2]);
    }
    return roundCorners(pts, round);
  },

  /* Aller-retour horizontal relie par des demi-tours, comme un serpentin. */
  snake(line, rnd) {
    const rows = line.turns + 1;
    const pitch = 0.24;
    const half = pitch / 2;
    const reach = 0.26;
    const bend = half * (0.75 + 0.5 * (line.curl / 100));
    const skew = (rnd() - 0.5) * 0.08;
    const pts = [];
    const top = -((rows - 1) * pitch) / 2;
    for (let i = 0; i < rows; i++) {
      const y = top + i * pitch;
      const way = i % 2 === 0 ? 1 : -1;
      for (let k = 0; k <= 3; k++) pts.push([way * (-reach + (2 * reach * k) / 3), y]);
      if (i < rows - 1) {
        const r = bend * (0.96 + rnd() * 0.08);
        for (let k = 1; k <= 5; k++) {
          const a = (Math.PI * k) / 6 - Math.PI / 2;
          pts.push([way * (reach + r * Math.cos(a)), y + half + half * Math.sin(a)]);
        }
      }
    }
    return pts.map(([x, y]) => [x, y + skew * x]);
  },

  worm(line, rnd) {
    const turns = Math.max(1, line.turns);
    const span = 0.4;
    const depth = (0.1 + 0.38 * (line.curl / 100)) * span * (2 / (1 + turns));
    const phase = (rnd() - 0.5) * 1.1;
    const swellPhase = rnd() * TAU;
    const steps = Math.max(18, turns * 8);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const k = 1 + 0.22 * Math.sin(swellPhase + t * Math.PI * 1.2);
      pts.push([-span / 2 + span * t, depth * k * Math.sin(phase + t * Math.PI * turns)]);
    }
    return pts;
  },

  /* Segment droit : c'est l'epaisseur du trait qui en fait une gelule. */
  pill(line) {
    const half = 0.004 + 0.2 * (line.curl / 100);
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push([-half + (2 * half * i) / 12, 0]);
    return pts;
  },

  ring(line, rnd) {
    const r = 0.15 + 0.16 * (line.curl / 100);
    const start = rnd() * TAU;
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const a = start + (i / 60) * TAU;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return pts;
  },

  sq(line) {
    const half = 0.13 + 0.14 * (line.curl / 100);
    const radius = half * 0.36;
    const straight = half - radius;
    const pts = [[0, -half]];
    const run = (x0, y0, x1, y1, n) => {
      for (let i = 1; i <= n; i++) pts.push([x0 + (x1 - x0) * (i / n), y0 + (y1 - y0) * (i / n)]);
    };
    const corner = (cx, cy, from) => {
      for (let i = 1; i <= 6; i++) {
        const a = from + (Math.PI / 2) * (i / 6);
        pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
      }
    };
    run(0, -half, straight, -half, 3);
    corner(straight, -straight, -Math.PI / 2);
    run(half, -straight, half, straight, 5);
    corner(straight, straight, 0);
    run(straight, half, -straight, half, 6);
    corner(-straight, straight, Math.PI / 2);
    run(-half, straight, -half, -straight, 5);
    corner(-straight, -straight, Math.PI);
    run(-straight, -half, 0, -half, 3);
    return pts;
  },

  arc(line, rnd) {
    const sweep = Math.PI * (0.6 + 1 * (line.curl / 100));
    const start = rnd() * TAU;
    const pts = [];
    for (let i = 0; i <= 36; i++) {
      const a = start + (i / 36) * sweep;
      pts.push([0.21 * Math.cos(a), 0.21 * Math.sin(a)]);
    }
    return pts;
  },
};

export const LINE_FORMS = Object.keys(FORMS);

/* Coupe les angles vifs d'une polyligne, pour le zigzag. */
function roundCorners(pts, amount) {
  if (pts.length < 3 || amount <= 0) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const k = Math.min(0.5, amount);
    out.push([cx + (px - cx) * k, cy + (py - cy) * k]);
    out.push([cx + (nx - cx) * k, cy + (ny - cy) * k]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/* -------------------------------------------------------- echantillonnage */

/* Spline Catmull-Rom centripete : passe par les points sans les depasser. */
function smooth(points, per = 8) {
  if (points.length < 2) return points.slice();
  const pad = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < pad.length - 2; i++) {
    const p0 = pad[i - 1], p1 = pad[i], p2 = pad[i + 1], p3 = pad[i + 2];
    const gap = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
    const t0 = 0;
    const t1 = t0 + gap(p0, p1);
    const t2 = t1 + gap(p1, p2);
    const t3 = t2 + gap(p2, p3);
    for (let s = 0; s < per; s++) {
      const t = t1 + ((t2 - t1) * s) / per;
      const a1x = ((t1 - t) * p0[0] + (t - t0) * p1[0]) / (t1 - t0);
      const a1y = ((t1 - t) * p0[1] + (t - t0) * p1[1]) / (t1 - t0);
      const a2x = ((t2 - t) * p1[0] + (t - t1) * p2[0]) / (t2 - t1);
      const a2y = ((t2 - t) * p1[1] + (t - t1) * p2[1]) / (t2 - t1);
      const a3x = ((t3 - t) * p2[0] + (t - t2) * p3[0]) / (t3 - t2);
      const a3y = ((t3 - t) * p2[1] + (t - t2) * p3[1]) / (t3 - t2);
      const b1x = ((t2 - t) * a1x + (t - t0) * a2x) / (t2 - t0);
      const b1y = ((t2 - t) * a1y + (t - t0) * a2y) / (t2 - t0);
      const b2x = ((t3 - t) * a2x + (t - t1) * a3x) / (t3 - t1);
      const b2y = ((t3 - t) * a2y + (t - t1) * a3y) / (t3 - t1);
      out.push([((t2 - t) * b1x + (t - t1) * b2x) / (t2 - t1), ((t2 - t) * b1y + (t - t1) * b2y) / (t2 - t1)]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/* Re-repartit les points a intervalle d'arc constant. */
function resample(points, count) {
  if (points.length < 2) return points.slice();
  const run = [0];
  for (let i = 1; i < points.length; i++) {
    run.push(run[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  const total = run[run.length - 1];
  if (total <= 1e-9) return Array.from({ length: count }, () => [...points[0]]);
  const out = [];
  let seg = 1;
  for (let i = 0; i < count; i++) {
    const target = (total * i) / (count - 1);
    while (seg < run.length - 1 && run[seg] < target) seg++;
    const span = run[seg] - run[seg - 1];
    const k = span > 1e-9 ? (target - run[seg - 1]) / span : 0;
    out.push([
      points[seg - 1][0] + (points[seg][0] - points[seg - 1][0]) * k,
      points[seg - 1][1] + (points[seg][1] - points[seg - 1][1]) * k,
    ]);
  }
  return out;
}

/* Normalise la forme : centree, amplitude appliquee. */
function outline(line) {
  if (line.pts && line.pts.length >= 2) return line.pts;
  const rnd = seeded(line.seed * 7919 + line.turns * 131 + 17);
  const raw = (FORMS[line.form] ?? FORMS.curve)(line, rnd);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of raw) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const stretch = 0.4 + 1.2 * (line.amp / 100);
  return raw.map(([x, y]) => [x - cx, (y - cy) * stretch]);
}

/* Passe du carre unite aux pixels : echelle, rotation, position. */
function place(line, w, h, [x, y]) {
  const size = Math.min(w, h) * (line.scale / 100);
  const a = (line.rotate * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return [(x * cos - y * sin) * size + (line.x / 100) * w, (x * sin + y * cos) * size + (line.y / 100) * h];
}

/*
 * Points finaux : position, avancement le long du trait (t) et demi-epaisseur.
 * Le `sway` fait onduler la ligne perpendiculairement, en fonction du temps.
 */
export function sampleLine(line, w, h, time = BASE_TIME, count = 240) {
  const shape = outline(line);
  if (shape.length < 2) return [];
  const path = resample(smooth(shape, 8), count).map((p) => place(line, w, h, p));

  const nx = new Array(path.length);
  const ny = new Array(path.length);
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.max(1e-6, Math.hypot(dx, dy));
    nx[i] = -dy / len;
    ny[i] = dx / len;
  }

  const swayAmp = (line.sway / 100) * 0.022 * Math.min(w, h) * (line.scale / 100);
  const ph1 = ((line.seed % 977) / 977) * TAU;
  const ph2 = ((line.seed % 641) / 641) * TAU;
  const halfWidth = ((line.width / 100) * 0.18 * Math.min(w, h) * (line.scale / 100)) * 0.5;
  const taper = line.taper / 100;

  return path.map(([x, y], i) => {
    const t = path.length === 1 ? 0 : i / (path.length - 1);
    const belly = Math.min(1, 4 * t * (1 - t) + 0.3);
    const wobble = (at) => Math.sin(at * 1.1 + ph1 + t * 3) + 0.35 * Math.sin(at * 2.3 + ph2 + t * 5);
    /* Le sway est relatif au temps de reference : a l'arret, rien ne bouge. */
    const offset = swayAmp * belly * (wobble(time) - wobble(BASE_TIME));
    const ends = Math.min(1, Math.min(t, 1 - t) / 0.25);
    const width = halfWidth * (1 - taper * (1 - ends) * (1 - ends));
    return { x: x + nx[i] * offset, y: y + ny[i] * offset, t, w: Math.max(0.6, width) };
  });
}

/* ------------------------------------------------------------- couleurs */

/*
 * La premiere couleur est le papier. Les bornes de bandes sont renormalisees
 * sur les couleurs restantes pour que la barre du bas reste juste.
 */
function inkPalette(colors, divs) {
  if (colors.length <= 2) return { stops: colors.slice(Math.min(1, colors.length - 1)), divs: null };
  const stops = colors.slice(1);
  if (!divs || divs.length !== colors.length - 1) return { stops, divs: null };
  const first = divs[0];
  const span = Math.max(1e-6, 1 - first);
  return { stops, divs: divs.slice(1).map((d) => Math.min(0.999, Math.max(0.001, (d - first) / span))) };
}

/* Position dans la palette pour un point du trait (aller-retour + decalage). */
function colorAt(line, t) {
  const forward = line.reverse ? 1 - t : t;
  let u = ((forward * (line.span ?? 100)) / 100 + line.shift / 100) / 2 % 1;
  if (u < 0) u += 1;
  return 1 - Math.abs(1 - 2 * u);
}

/* Trace un morceau de spline entre deux indices. */
function strokeSpan(ctx, pts, from, to) {
  ctx.beginPath();
  ctx.moveTo(pts[from].x, pts[from].y);
  if (to - from < 2) { ctx.lineTo(pts[to].x, pts[to].y); return; }
  for (let i = from + 1; i < to; i++) {
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
  }
  ctx.lineTo(pts[to].x, pts[to].y);
}

/* ---------------------------------------------------------------- rendu */

let scratch = null;

export function paintLines(ctx, w, h, colors, divs, lines, time = BASE_TIME, draft = false) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  if (!lines || !lines.length) return;

  const palette = inkPalette(colors, divs);
  scratch = scratch ?? document.createElement('canvas');
  if (scratch.width !== w) scratch.width = w;
  if (scratch.height !== h) scratch.height = h;
  const layer = scratch.getContext('2d');
  const step = draft ? 3 : 1;

  for (const line of lines) {
    const pts = sampleLine(line, w, h, time, draft ? 132 : 240);
    if (pts.length < 2) continue;

    layer.save();
    layer.clearRect(0, 0, w, h);
    layer.lineCap = 'round';
    layer.lineJoin = 'round';

    /*
     * Un segment a la fois, avec un degrade aligne sur lui : c'est ce qui fait
     * courir la couleur le long du trait au lieu de le teinter d'un seul ton.
     */
    for (let i = 0; i < pts.length - 1; i += step) {
      const j = Math.min(pts.length - 1, i + step);
      const a = pts[i];
      const b = pts[j];
      const width = a.w + b.w + 2;
      const half = width / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.max(1e-6, Math.hypot(dx, dy));
      const ux = dx / len;
      const uy = dy / len;
      const slope = (b.t - a.t) / len;
      const grad = layer.createLinearGradient(a.x - ux * half, a.y - uy * half, b.x + ux * half, b.y + uy * half);
      grad.addColorStop(0, sample(palette.stops, palette.divs, colorAt(line, Math.max(0, Math.min(1, a.t - slope * half)))));
      grad.addColorStop(1, sample(palette.stops, palette.divs, colorAt(line, Math.max(0, Math.min(1, b.t + slope * half)))));
      layer.strokeStyle = grad;
      layer.lineWidth = width;
      strokeSpan(layer, pts, i, j);
      layer.stroke();
    }
    layer.restore();

    /* Ombre portee et flou se posent au moment du report sur le canvas final. */
    const shadow = Math.max(0, Math.min(1, (line.shadow ?? 0) / 100));
    const blur = ((line.blur ?? 0) / 100) * 0.05 * Math.min(w, h);
    ctx.save();
    if (shadow > 0.01) {
      const unit = Math.min(w, h);
      ctx.shadowColor = `rgba(24,12,28,${(0.16 + 0.26 * shadow).toFixed(3)})`;
      ctx.shadowBlur = unit * 0.028 * shadow;
      ctx.shadowOffsetX = unit * 0.006 * shadow;
      ctx.shadowOffsetY = unit * 0.012 * shadow;
    }
    if (blur > 0.2) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  }
}
