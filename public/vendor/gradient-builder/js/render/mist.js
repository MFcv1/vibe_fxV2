/*
 * MIST — des cretes de montagne qui s'estompent dans la brume.
 *
 * Chaque crete est une ligne de bruit de valeur, tracee de plus en plus bas et
 * de plus en plus haute a mesure qu'elle se rapproche. Entre deux cretes, une
 * nappe elliptique de brume : c'est elle qui donne la profondeur. Plus une
 * crete est lointaine, plus sa couleur tire vers celle du ciel et plus son
 * contour est flou.
 */

import { mix, lightness, bandCenters, rampStops } from '../color.js';

export const MIST_FIELD = { haze: 50, height: 50, sharp: 55, sun: 64, drift: 55, seed: 7 };

const SAMPLES = 110;     // points par crete
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* Curseur 0-100 vers trois paliers : bas, milieu, haut. */
const dial = (v, low, mid, high) => (v <= 50 ? low + (mid - low) * (v / 50) : mid + (high - mid) * ((v - 50) / 50));

/* Nombre de cretes : de 3 au loin a 9 pour une scene dense. */
const ridgeCount = (scale) => 3 + (Math.max(0, Math.min(100, scale)) / 100) * 6;

const hash1 = (v) => { const t = Math.sin(v) * 43758.5453; return t - Math.floor(t) };

/* Bruit de valeur 1D lisse, la base du profil des cretes. */
function noise1(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const t = f * f * (3 - 2 * f);
  const at = (n) => hash1(n * 127.1 + seed * 311.7);
  return at(i) + (at(i + 1) - at(i)) * t;
}

/*
 * Profil d'une crete. `sharp` fait glisser la forme du sommet arrondi
 * (1 - x²) vers le sommet pointu (1 - |x|) : c'est ce qui separe une colline
 * d'un pic.
 */
function ridgeProfile(x, index, seed, sharp) {
  const freq = 1.7 + index * 0.33;
  const lane = index * 7.31 + 13.7;
  const peakiness = sharp / 100;
  const octave = (mul, off) => {
    const v = noise1(x * mul + seed, off) * 2 - 1;
    const pointed = 1 - Math.abs(v);
    const rounded = 1 - v * v;
    return rounded + (pointed - rounded) * peakiness;
  };
  const body = 0.52 * octave(freq, lane) + 0.3 * octave(freq * 2.15, lane + 1.77) + 0.18 * octave(freq * 4.4, lane + 3.31);
  const swell = 0.55 + 0.45 * Math.pow(noise1(x * 1.13 + seed * 0.51, lane + 5.2), 1.4);
  return Math.pow(Math.max(0, body), 1 + peakiness * 0.9) * swell;
}

/* Toute la scene : cretes, voiles de brume, soleil et ligne d'horizon. */
function buildScene(w, h, scale, horizonAt, field) {
  const f = { ...MIST_FIELD, ...(field ?? {}) };
  const count = ridgeCount(scale);
  const rows = Math.ceil(count - 0.001);
  const horizon = Math.max(0.14, Math.min(0.62, horizonAt)) * h;
  const depth = h - horizon;
  const relief = dial(f.height, 0.35, 1, 1.9);
  const thickness = dial(f.haze, 0.25, 1, 1.6);
  const seed = f.seed * 0.73;

  const ridges = [];
  for (let i = 0; i < rows; i++) {
    const t = Math.min(1, i / Math.max(1e-4, count - 1));
    const fade = Math.max(0, Math.min(1, count - i));
    const base = horizon + Math.pow((i + 1) / count, 1.3) * depth;
    const rise = (0.12 + 0.26 * t) * depth * relief * 1.35;
    const pts = [];
    for (let s = 0; s <= SAMPLES; s++) {
      const x = s / SAMPLES;
      pts.push([x * w, base - rise * ridgeProfile(x, i, seed, f.sharp)]);
    }
    ridges.push({ pts, top: base - rise, base, t, fade });
  }

  const veils = ridges.map((ridge, i) => {
    const gap = ridge.base - (i === 0 ? horizon : ridges[i - 1].base);
    const first = i === 0;
    return {
      cx: (i % 2 === 0 ? 0.32 : 0.68) * w + Math.sin(i * 2.1) * 0.06 * w,
      cy: ridge.base + (first ? gap * 0.22 : 0),
      rx: 0.62 * w,
      ry: first ? Math.max(0.085 * h, gap * 0.95) : Math.max(0.05 * h, gap * 0.6),
      a: Math.min(0.92, (0.62 - 0.34 * ridge.t) * thickness) * ridge.fade,
    };
  });

  return {
    ridges, veils, horizon,
    sun: { x: (f.sun / 100) * w, y: Math.max(0.1 * h, horizon - 0.11 * h), r: 0.052 * h },
  };
}

/* Chemin lisse passant par les points (Catmull-Rom converti en Bezier). */
function smoothPath(pts) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)}`
      + ` ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)}`
      + ` ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/* Le ciel : la deuxieme couleur de la palette, ou la premiere s'il n'y en a qu'une. */
const skyOf = (colors) => colors[1] ?? colors[0];

/* Couleur d'une crete selon sa distance : elle se noie dans le ciel. */
function ridgeTone(colors, t, haze) {
  const ground = colors.length > 2 ? colors.slice(2) : colors;
  const at = t * (ground.length - 1);
  const i = Math.floor(at);
  const local = mix(ground[i], ground[Math.min(ground.length - 1, i + 1)], at - i);
  return mix(local, skyOf(colors), Math.min(0.82, (1 - t) * dial(haze, 0.15, 0.42, 0.7)));
}

/* Le soleil : le ton le plus clair, encore eclairci. */
function sunTone(colors) {
  const brightest = colors.reduce((best, c) => (lightness(c) > lightness(best) ? c : best), colors[0]);
  return lightness(brightest) < 0.5 ? mix(brightest, '#F7F4EE', 0.72) : mix(brightest, '#FFFFFF', 0.35);
}

export function paintMist(ctx, w, h, colors, divs, field = MIST_FIELD, scale = 50, horizonAt = 0.42) {
  const f = { ...MIST_FIELD, ...(field ?? {}) };
  const scene = buildScene(w, h, scale, horizonAt, f);
  const sky = skyOf(colors);
  const [sr, sg, sb] = [0, 1, 2].map((i) => parseInt(sky.slice(1 + i * 2, 3 + i * 2), 16));

  /* Ciel : le degrade complet de la palette. */
  const stops = bandCenters(colors.length, divs).map((c) => c / 100);
  const backdrop = ctx.createLinearGradient(0, 0, 0, h);
  rampStops(colors, stops).forEach(([c, p]) => backdrop.addColorStop(p, c));
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, w, h);

  /* Le soleil et son halo. */
  const sun = sunTone(colors);
  const [dr, dg, db] = [0, 1, 2].map((i) => parseInt(sun.slice(1 + i * 2, 3 + i * 2), 16));
  const halo = ctx.createRadialGradient(scene.sun.x, scene.sun.y, 0, scene.sun.x, scene.sun.y, scene.sun.r * 3.4);
  halo.addColorStop(0, `rgba(${dr},${dg},${db},0.4)`);
  halo.addColorStop(1, `rgba(${dr},${dg},${db},0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(scene.sun.x - scene.sun.r * 3.4, scene.sun.y - scene.sun.r * 3.4, scene.sun.r * 6.8, scene.sun.r * 6.8);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(scene.sun.x, scene.sun.y, scene.sun.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  /* Les cretes, de la plus lointaine a la plus proche. */
  for (let i = 0; i < scene.ridges.length; i++) {
    const ridge = scene.ridges[i];
    const tone = ridgeTone(colors, ridge.t, f.haze);
    const body = ctx.createLinearGradient(0, ridge.top, 0, ridge.base);
    body.addColorStop(0, tone);
    body.addColorStop(0.45, mix(tone, sky, 0.16));
    body.addColorStop(1, mix(tone, sky, Math.min(0.98, (0.95 - 0.4 * ridge.t) * dial(f.haze, 0.85, 1, 1.12))));

    /* Les cretes du fond sont floues : c'est la profondeur de champ. */
    const soften = (1 - ridge.t) * (1 - ridge.t) * 0.006 * h;
    ctx.save();
    if (soften > 0.4) ctx.filter = `blur(${soften.toFixed(2)}px)`;
    ctx.globalAlpha = ridge.fade;
    ctx.fillStyle = body;
    ctx.fill(new Path2D(`${smoothPath(ridge.pts)}L${w},${h}L0,${h}Z`));

    /* Un filet clair sur l'arete, pour la detacher du fond. */
    ctx.globalAlpha = (0.2 + 0.22 * ridge.t) * ridge.fade;
    ctx.strokeStyle = mix(ridgeTone(colors, ridge.t, f.haze), sky, 0.8);
    ctx.lineWidth = Math.max(1, h * 0.0035);
    ctx.lineCap = 'round';
    ctx.stroke(new Path2D(smoothPath(ridge.pts)));
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.restore();

    /* La nappe de brume qui remplit la vallee devant la crete. */
    const veil = scene.veils[i];
    ctx.save();
    ctx.translate(veil.cx, veil.cy);
    ctx.scale(1, veil.ry / veil.rx);
    const fog = ctx.createRadialGradient(0, 0, 0, 0, 0, veil.rx);
    fog.addColorStop(0, `rgba(${sr},${sg},${sb},${(0.9 * veil.a).toFixed(3)})`);
    fog.addColorStop(0.55, `rgba(${sr},${sg},${sb},${(0.42 * veil.a).toFixed(3)})`);
    fog.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
    ctx.fillStyle = fog;
    ctx.fillRect(-veil.rx, -veil.rx, veil.rx * 2, veil.rx * 2);
    ctx.restore();
  }

  /* Un dernier voile au premier plan, pour fermer le bas du cadre. */
  const foreground = ctx.createLinearGradient(0, h * 0.86, 0, h);
  foreground.addColorStop(0, `rgba(${sr},${sg},${sb},0)`);
  foreground.addColorStop(1, `rgba(${sr},${sg},${sb},${dial(f.haze, 0.08, 0.26, 0.44).toFixed(3)})`);
  ctx.fillStyle = foreground;
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
}
