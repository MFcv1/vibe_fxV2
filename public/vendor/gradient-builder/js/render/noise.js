/*
 * CNOISE (Noise) — huit taches ovales posees a des places fixes, puis un flou
 * large qui les fait fusionner. La composition ne bouge pas : ce sont l'angle,
 * l'etirement et l'ecartement qui la font varier.
 */

import { hexToRgb, mix } from '../color.js';

export const NOISE_FIELD = { angle: 32, stretch: 62, spread: 55 };

/* [x, y, largeur, hauteur, opacite, index couleur, eclaircissement, rotation] */
const BLOBS = [
  [-0.10, 0.16, 0.45, 0.105, 0.65, 2, 0, 7],
  [-0.20, -0.30, 0.50, 0.105, 0.90, 0, 0, 6],
  [0.35, -0.32, 0.35, 0.080, 0.60, 0, 0.4, -8],
  [-0.35, 0.28, 0.40, 0.095, 0.80, 0, 0, -6],
  [0.30, 0.34, 0.30, 0.080, 0.50, 1, 0, 10],
  [0.15, 0.04, 0.55, 0.100, 0.95, 2, 0, -3],
  [-0.05, -0.12, 0.55, 0.105, 0.95, 1, 0.1, 5],
  [0.25, -0.09, 0.50, 0.120, 1.00, 3, 0.9, -4],
];

const BLUR_RATIO = 0.0416;

let scratch = null;

export function paintNoise(ctx, w, h, colors, field = NOISE_FIELD) {
  if (!colors.length) return;
  const f = { ...NOISE_FIELD, ...(field ?? {}) };
  const angle = (Number(f.angle) || 0) / 180 * Math.PI;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const stretch = 0.55 + ((Number(f.stretch) || 0) / 100) * 1.1;
  const spread = 0.5 + ((Number(f.spread) || 0) / 100) * 1.2;
  /* La premiere couleur est le fond ; les taches piochent dans les suivantes. */
  const ink = colors.length > 1 ? colors.slice(1) : colors;

  const diagonal = Math.hypot(w, h);
  const blur = BLUR_RATIO * diagonal;
  const pad = Math.ceil(blur * 3.2);

  scratch = scratch ?? document.createElement('canvas');
  scratch.width = w + 2 * pad;
  scratch.height = h + 2 * pad;
  const layer = scratch.getContext('2d');
  layer.clearRect(0, 0, scratch.width, scratch.height);
  layer.fillStyle = colors[0];
  layer.fillRect(0, 0, scratch.width, scratch.height);

  for (const blob of BLOBS) {
    let color = ink[blob[5] % ink.length];
    if (blob[6]) color = mix(color, '#FFFFFF', blob[6]);
    const rx = blob[2] * stretch * 0.832 * diagonal;
    const ry = blob[3] * spread * 0.555 * diagonal;
    const offset = blob[1] * spread;
    const cx = pad + (0.5 + blob[0] * cos - offset * sin) * w;
    const cy = pad + (0.5 + blob[0] * sin + offset * cos) * h;

    layer.save();
    layer.translate(cx, cy);
    layer.rotate(((Number(f.angle) || 0) + (blob[7] || 0)) / 180 * Math.PI);
    layer.scale(rx, ry);
    const [r, g, b] = hexToRgb(color);
    const grad = layer.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(${r},${g},${b},${blob[4]})`);
    grad.addColorStop(0.55, `rgba(${r},${g},${b},${(blob[4] * 0.85).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    layer.fillStyle = grad;
    layer.beginPath();
    layer.arc(0, 0, 1, 0, Math.PI * 2);
    layer.fill();
    layer.restore();
  }

  ctx.save();
  ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.drawImage(scratch, -pad, -pad);
  ctx.restore();
  ctx.filter = 'none';
}
