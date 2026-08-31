/*
 * SMESH (Still) — un champ de couleur fige, sans derive temporelle.
 *
 * Meme principe que Flow — des sources ponderees par l'inverse de la distance —
 * mais melange en RGB, avec un exposant reglable (Mixing) qui decide si les
 * couleurs se fondent ou restent en plaques nettes, et une ondulation propre
 * sur chaque axe.
 */

import { hexToRgb, smoothstep, fract } from '../color.js';
import { spotAt } from './flow.js';
import { bandWeight } from '../color.js';

export const STILL_FIELD = {
  positions: 2, waveX: 100, waveXShift: 60, waveY: 100, waveYShift: 21,
  mixing: 93, grain: 0, rotation: 270,
};

/* Bruit de valeur 2D deterministe, pour le grain de melange. */
const hash2 = (x, y) => {
  let a = fract(x * 0.3183099) + 0.1;
  let b = fract(y * 0.3678794) + 0.1;
  const k = a * (a + 19.19) + b * (b + 19.19);
  a += k; b += k;
  return fract(a * b);
};

function valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy), b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uy;
}

export function paintStill(ctx, w, h, colors, divs, field = STILL_FIELD) {
  const f = { ...STILL_FIELD, ...(field ?? {}) };
  const n = colors.length;
  const rgb = colors.map(hexToRgb);
  const weights = colors.map((_, i) => bandWeight(n, divs, i));

  const waveX = f.waveX / 100;
  const shiftX = f.waveXShift / 100;
  const waveY = f.waveY / 100;
  const shiftY = f.waveYShift / 100;
  const mixing = Math.pow(Math.max(0, Math.min(1, f.mixing / 100)), 0.7);
  const grain = f.grain / 100;
  const angle = ((f.rotation % 360) * Math.PI) / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);

  /* Le curseur Positions choisit simplement un autre jeu de sources. */
  const seed = 25 + 0.33 * f.positions;
  const centers = colors.map((_, i) => spotAt(i, seed));
  const falloff = (2 - mixing) / 2;

  const unit = Math.min(w, h);
  const ratioX = w / unit;
  const ratioY = h / unit;

  const img = ctx.createImageData(w, h);
  const px = img.data;

  for (let y = 0; y < h; y++) {
    const ny = 0.5 - (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const nx = ((x + 0.5) / w - 0.5) * ratioX;
      const my = ny * ratioY;
      let u = cos * nx - sin * my + 0.5;
      let v = sin * nx + cos * my + 0.5;

      const noise = grain > 0 ? 0.4 * grain * (valueNoise(u * 1000, v * 1000) - 0.5) : 0;
      const inner = 1 - smoothstep(Math.hypot(u - 0.5, v - 0.5));
      for (let k = 1; k <= 2; k++) {
        u += (waveX * inner) / k * Math.cos(Math.PI * 2 * shiftX + k * 2 * smoothstep(v));
        v += (waveY * inner) / k * Math.cos(Math.PI * 2 * shiftY + k * 2 * smoothstep(u));
      }

      let r = 0, g = 0, b = 0, total = 0;
      for (let i = 0; i < n; i++) {
        const dx = u - (centers[i][0] + noise);
        const dy = v - (centers[i][1] + noise);
        let pull = 1 / (Math.pow(dx * dx + dy * dy, falloff) + 0.001);
        /*
         * Pres d'une source, on durcit le contraste ; loin, Mixing decide.
         * C'est ce qui donne des plaques nettes a fort Mixing.
         */
        const near = 8 * Math.min(1, pull);
        pull = Math.pow(pull, near + (1 - near) * mixing) * weights[i];
        r += rgb[i][0] * pull;
        g += rgb[i][1] * pull;
        b += rgb[i][2] * pull;
        total += pull;
      }
      const inv = 1 / Math.max(1e-4, total);
      const o = (y * w + x) * 4;
      px[o] = r * inv; px[o + 1] = g * inv; px[o + 2] = b * inv; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
