/*
 * ARCH — une arche de lumiere posee sur un socle sombre.
 *
 * Le bas du cadre recoit deux halos elliptiques qui font monter la lumiere du
 * sol ; l'arche elle-meme est une demi-ellipse decoupee, remplie d'un degrade
 * radial ecrase, la palette lue a l'envers pour que le clair soit au centre.
 */

import { mix, bandCenters, hexToRgb } from '../color.js';

const FOOT = 0.04;        // hauteur du socle, en part de la scene
const SPRING = 0.58;      // hauteur du depart de l'arc
const MARGIN = 0.025;     // marge laterale
const GLOW_WIDE = 0.58;
const GLOW_TALL = 1.05;
const HALO_WIDE = 0.46;
const HALO_TALL = 0.7;
const NIGHT = '#0B0B10';

const alpha = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})` };

/* La palette a l'envers, resserree vers le centre de l'arche. */
function archStops(colors, divs) {
  const reversed = [...colors].reverse();
  const centers = bandCenters(colors.length, divs).map((c) => c / 100);
  return [
    [mix(reversed[0], '#FFFFFF', 0.16), 0],
    ...reversed.map((c, i) => [c, Math.min(0.995, 0.1 + centers[i] * 0.9)]),
  ].sort((a, b) => a[1] - b[1]);
}

export function paintArch(ctx, w, h, colors, divs) {
  const foot = h * FOOT;
  const spring = h * SPRING;
  const base = foot + spring;
  const left = w * MARGIN;
  const right = w * (1 - MARGIN);
  const halfSpan = (right - left) / 2;
  const span = right - left;
  const floor = h - base;
  const last = colors[colors.length - 1];
  const previous = colors[Math.max(0, colors.length - 2)];

  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, w, h);

  /* Deux nappes de lumiere au sol, l'une large et froide, l'autre serree. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, base, w, floor);
  ctx.clip();
  const pool = (wide, tall, stops) => {
    const radius = wide * w;
    ctx.save();
    ctx.translate(w / 2, base);
    ctx.scale(1, (tall * floor) / radius);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    stops(grad);
    ctx.fillStyle = grad;
    ctx.fillRect(-2 * w, -2 * h, 4 * w, 4 * h);
    ctx.restore();
  };
  pool(GLOW_WIDE, GLOW_TALL, (g) => {
    g.addColorStop(0, alpha(previous, 0.26));
    g.addColorStop(0.8, alpha(previous, 0));
  });
  pool(HALO_WIDE, HALO_TALL, (g) => {
    g.addColorStop(0, alpha(mix(last, '#FFFFFF', 0.35), 0.72));
    g.addColorStop(0.38, alpha(last, 0.28));
    g.addColorStop(0.72, alpha(last, 0));
  });
  ctx.restore();

  /* L'arche : une demi-ellipse decoupee, remplie d'un radial ecrase. */
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(w / 2, base, halfSpan, spring, 0, Math.PI, 0);
  ctx.closePath();
  ctx.clip();
  ctx.translate(w / 2, base);
  ctx.scale(1, spring / span);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.16 * span);
  archStops(colors, divs).forEach(([color, at]) => grad.addColorStop(at, color));
  ctx.fillStyle = grad;
  ctx.fillRect(-2 * w, -2 * h, 4 * w, 4 * h);
  ctx.restore();
}
