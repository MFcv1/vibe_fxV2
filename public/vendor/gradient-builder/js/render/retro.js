/*
 * RETRO — l'affiche imprimee : un fond domine par la couleur la plus claire,
 * sur lequel quelques taches gaussiennes debordent. Le plan est bouscule par
 * deux octaves de bruit, ce qui donne le bord un peu sale d'une impression.
 */

import { hexToOklab, oklabToRgb, bandWeight } from '../color.js';
import { lightness } from '../color.js';

const SPOTS = [[16, 82], [78, 26], [88, 84], [24, 16], [50, 55], [62, 100]];
const DRIFT = 0.1;        // amplitude de la derive des taches
const WARP = 0.5;         // force du bruit qui deforme le plan
const NOISE_SCALE = 2;
const BASE_WEIGHT = 0.85; // poids du fond face aux taches
const SPOT_GAIN = 4;
const SPREAD = 0.15;      // rayon des taches
const TIME_RATE = 0.22;

const hash = (x, y, seed) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

function smoothNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, seed, octaves) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * smoothNoise(x * freq, y * freq, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export function paintRetro(ctx, w, h, colors, divs, time = 20.75) {
  const n = colors.length;
  const labs = colors.map(hexToOklab);

  /* La couleur la plus claire tient le fond ; les autres sont des taches. */
  let paper = 0;
  for (let i = 1; i < n; i++) if (lightness(colors[i]) > lightness(colors[paper])) paper = i;

  const centers = colors.map((_, i) => {
    const home = SPOTS[i % SPOTS.length];
    const phase = i * 1.7;
    return [
      home[0] / 100 + DRIFT * Math.sin(time * 0.9 + phase),
      home[1] / 100 + DRIFT * Math.cos(time * 0.72 + phase * 1.3),
    ];
  });
  const weights = colors.map((_, i) => bandWeight(n, divs, i));
  const sharp = 1 / (2 * SPREAD * SPREAD);
  const drift = time * TIME_RATE;

  const img = ctx.createImageData(w, h);
  const px = img.data;

  for (let y = 0; y < h; y++) {
    const v0 = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u0 = (x + 0.5) / w;
      const nx = fbm(u0 * NOISE_SCALE + drift, v0 * NOISE_SCALE, 11, 3);
      const ny = fbm(u0 * NOISE_SCALE + 3.7, v0 * NOISE_SCALE + drift, 23, 3);
      const u = u0 + WARP * (nx - 0.5);
      const v = v0 + WARP * (ny - 0.5);

      let L = labs[paper][0] * BASE_WEIGHT;
      let A = labs[paper][1] * BASE_WEIGHT;
      let B = labs[paper][2] * BASE_WEIGHT;
      let total = BASE_WEIGHT;

      for (let i = 0; i < n; i++) {
        if (i === paper) continue;
        const dx = u - centers[i][0];
        const dy = v - centers[i][1];
        const k = weights[i] * SPOT_GAIN * Math.exp(-(dx * dx + dy * dy) * sharp);
        L += labs[i][0] * k;
        A += labs[i][1] * k;
        B += labs[i][2] * k;
        total += k;
      }

      const inv = 1 / total;
      const rgb = oklabToRgb(L * inv, A * inv, B * inv);
      const o = (y * w + x) * 4;
      px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
