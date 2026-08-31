/*
 * FLOW — le champ de couleur par defaut.
 *
 * Chaque couleur est une "source" placee sur le plan ; chaque pixel prend la
 * moyenne des sources ponderee par l'inverse de la distance, calculee en OKLab.
 * Avant l'echantillonnage, les coordonnees passent dans deux plis sinusoidaux
 * (distortion) puis dans une rotation qui augmente vers les bords (swirl).
 */

import { hexToOklab, oklabToRgb, bandWeight, smoothstep, fract, clamp } from '../color.js';

export const FLOW_FIELD = { scale: 50, distortion: 60, swirl: 10 };
export const FLOW_TIME = 20.75;

const SPOT_PULL = 0.2;   // combien un point pose suit encore la derive du temps
const FALLOFF = 3.5;     // exposant de l'attenuation en distance

/* Position par defaut de la source d'indice `i` au temps `t`. */
export function spotAt(i, t) {
  const phase = i * 0.37;
  const fx = 0.6 + fract(i / 3) * 0.9;
  const fy = 0.8 + fract((i + 1) / 4);
  return [0.5 + 0.5 * Math.sin(t * fx + phase), 0.5 + 0.5 * Math.cos(t * fy + phase * 1.5)];
}

/*
 * `spots` (optionnel) : positions posees a la main, en pourcentage du canvas.
 * Elles sont ramenees dans l'espace du champ (donc divisees par le zoom) et
 * gardent une part de la derive temporelle pour ne pas figer la composition.
 */
export function paintFlow(ctx, w, h, colors, divs, field = FLOW_FIELD, time = FLOW_TIME, spots) {
  const n = colors.length;
  const labs = colors.map(hexToOklab);
  const warp = field.distortion / 100;
  const swirl = field.swirl / 100;
  const zoom = 0.4 + (field.scale / 100) * 1.2;

  const centers = colors.map((_, i) => {
    const placed = spots && spots[i];
    const drift = spotAt(i, time);
    if (!placed) return drift;
    const base = spotAt(i, FLOW_TIME);
    return [
      (placed[0] / 100 - 0.5) / zoom + 0.5 + (SPOT_PULL * (drift[0] - base[0])) / zoom,
      (placed[1] / 100 - 0.5) / zoom + 0.5 + (SPOT_PULL * (drift[1] - base[1])) / zoom,
    ];
  });

  const weights = colors.map((_, i) => bandWeight(n, divs, i));
  const img = ctx.createImageData(w, h);
  const px = img.data;

  for (let y = 0; y < h; y++) {
    const v0 = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      let u = ((x + 0.5) / w - 0.5) / zoom + 0.5;
      let v = (v0 - 0.5) / zoom + 0.5;

      const edge = smoothstep(Math.hypot(u - 0.5, v - 0.5));
      const inner = 1 - edge;

      for (let k = 1; k <= 2; k++) {
        u += ((warp * inner) / k) * Math.sin(time + k * 0.4 * smoothstep(v)) * Math.cos(0.2 * time + k * 2.4 * smoothstep(v));
        v += ((warp * inner) / k) * Math.cos(time + k * 2 * smoothstep(u));
      }

      const angle = 3 * swirl * edge;
      const cos = Math.cos(-angle), sin = Math.sin(-angle);
      const dx = u - 0.5, dy = v - 0.5;
      u = cos * dx - sin * dy + 0.5;
      v = sin * dx + cos * dy + 0.5;

      let L = 0, A = 0, B = 0, total = 0;
      for (let i = 0; i < n; i++) {
        const ex = u - centers[i][0];
        const ey = v - centers[i][1];
        const d2 = ex * ex + ey * ey;
        const pull = weights[i] / (Math.pow(d2, FALLOFF / 2) + 1e-4);
        L += labs[i][0] * pull;
        A += labs[i][1] * pull;
        B += labs[i][2] * pull;
        total += pull;
      }

      const inv = 1 / Math.max(1e-4, total);
      const rgb = oklabToRgb(L * inv, A * inv, B * inv);
      const o = (y * w + x) * 4;
      px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* Position ecran (en %) de chaque source, pour les anneaux draggables. */
export function flowHandles(count, field = FLOW_FIELD, time = FLOW_TIME, spots) {
  const zoom = 0.4 + (field.scale / 100) * 1.2;
  return Array.from({ length: count }, (_, i) => {
    const placed = spots && spots[i];
    if (placed) return [clamp(placed[0], 0, 100), clamp(placed[1], 0, 100)];
    const [x, y] = spotAt(i, time);
    return [clamp(((x - 0.5) * zoom + 0.5) * 100, 0, 100), clamp(((y - 0.5) * zoom + 0.5) * 100, 0, 100)];
  });
}
