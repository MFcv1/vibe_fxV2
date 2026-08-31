/*
 * PRISM — la lumiere qui traverse un prisme.
 *
 * On balaye des colonnes verticales de part et d'autre du centre. La position
 * de chaque colonne vient d'une fonction en escalier bruitee, si bien que leurs
 * largeurs ne sont jamais regulieres. Chaque colonne recoit un degrade vertical
 * qui porte : un coeur incandescent au milieu, deux reflets secondaires qui
 * derivent, et un blanchiment vers les bords haut et bas.
 */

import { sampleRgb, smoothstep, fract } from '../color.js';

export const PRISM_FIELD = { count: 11, gap: 0, envelope: 'ramp' };

const BASE_TIME = 20.75;
const OPEN = 0.6;        // duree de l'ouverture du faisceau
const FLOOR = 0.18;      // part basse de la palette gardee pour le fond
const STEPS = 96;        // crans du degrade vertical
const SCROLL = 1.4;      // vitesse de defilement des colonnes
const TAU = Math.PI * 2;

const toward = (rgb, target, k) => [
  rgb[0] + (target[0] - rgb[0]) * k,
  rgb[1] + (target[1] - rgb[1]) * k,
  rgb[2] + (target[2] - rgb[2]) * k,
];

export function paintPrism(ctx, w, h, colors, divs, field = PRISM_FIELD, time = BASE_TIME) {
  const count = Math.max(3, Math.round((field ?? PRISM_FIELD).count));
  const back = sampleRgb(colors, divs, 0);
  const far = sampleRgb(colors, divs, 1);
  const hot = toward(far, [255, 255, 255], 0.55);

  const core = 0.26 + 0.035 * Math.sin(time * 0.5);
  const opening = Math.min(1, Math.max(0, (time - BASE_TIME + OPEN) / OPEN));
  const front = 1 - (1 - opening) ** 3;

  /* Position d'une colonne : une rampe reguliere que deux sinus font boiter. */
  const jitter = (t) => count * 0.055 * (0.8 * Math.sin(t * 7.3) + 0.45 * Math.sin(t * 17 + 1.7));
  const index = (t) => t * 2 * count + jitter(t) - time * SCROLL;
  /* Inversion par dichotomie : `index` n'est pas analytiquement inversible. */
  const positionOf = (target) => {
    let low = 0, high = 0.5;
    for (let i = 0; i < 26; i++) {
      const mid = (low + high) / 2;
      if (index(mid) < target) low = mid; else high = mid;
    }
    return (low + high) / 2;
  };

  const first = Math.floor(index(0));
  const last = Math.floor(index(0.5));

  for (let band = first; band <= last; band++) {
    const left = band <= index(0) ? 0 : positionOf(band);
    const right = band + 1 >= index(0.5) ? 0.5 : positionOf(band + 1);
    if (right - left <= 0) continue;

    const depth = Math.min(1, left + right);          // 0 au centre, 1 au bord
    const wobble = 0.5 + 0.5 * Math.sin(band * 1.05 + 0.6);
    const scatter = fract(band * 0.618 + 0.23);
    const pick = Math.max(0, Math.min(1,
      depth * 0.62 + (0.62 * wobble + 0.38 * scatter) * 0.34 + 0.05 * Math.sin(time * 0.22 + band * 0.9)));
    const tone = sampleRgb(colors, divs, FLOOR + (1 - FLOOR) * pick);
    const pale = toward(tone, [255, 255, 255], 0.32);

    /* Deux reflets secondaires qui montent le long de la colonne. */
    const seed = fract(band * 0.7548 + 0.11);
    const flareA = fract(seed + time * 0.3);
    const flareB = fract(seed + 0.47 + time * 0.3);
    const atA = flareA * 0.56;
    const atB = flareB * 0.56;
    const liveA = smoothstep(flareA / 0.14) * (1 - smoothstep((flareA - 0.8) / 0.2));
    const liveB = smoothstep(flareB / 0.14) * (1 - smoothstep((flareB - 0.8) / 0.2));

    const glow = (1 - depth) ** 7 * (0.92 + 0.08 * Math.sin(time * 1.3)) * (1 + 1.5 * (1 - opening) ** 2);
    const ripple = band * 2.1;
    const dim = 1 - 0.15 * smoothstep((depth - 0.8) / 0.2);
    const reveal = opening >= 1 ? 1 : 1 - smoothstep((depth - front) / 0.12);
    const wave = opening >= 1 ? 0 : 0.9 * (1 - opening) * Math.exp(-((depth - front) ** 2) / 0.01);
    const base = toward(back, tone, 0.34 * reveal);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    for (let s = 0; s < STEPS; s++) {
      const v = s / (STEPS - 1);
      const off = Math.abs(v - 0.5);                  // distance a l'axe du faisceau
      const shape = 0.1 + 0.9 * smoothstep((off - core * 0.1) / (core * (0.6 + 0.28 * depth)));
      const breathe = 1 + 0.07 * Math.sin(v * TAU * 1.7 + ripple);
      const strength = (shape * breathe + wave) * dim * reveal;

      let rgb = toward(base, tone, Math.min(1, strength));
      if (strength > 1) rgb = toward(rgb, [255, 255, 255], Math.min(1, (strength - 1) * 0.8));
      rgb = toward(rgb, [255, 255, 255], 0.26 * smoothstep((off - 0.3) / 0.18) * Math.min(1, strength));

      const spotA = liveA * Math.exp(-((off - atA) ** 2) / 0.011);
      const spotB = liveB * Math.exp(-((off - atB) ** 2) / 0.011);
      rgb = toward(rgb, pale, Math.min(1, 0.6 * (spotA + 0.5 * spotB) * (0.5 + 0.5 * shape)) * reveal);

      const heat = glow * (Math.exp(-(off * off) / 0.006) + 0.7 * Math.exp(-((off - 0.05) ** 2) / 0.0006));
      if (heat > 0.004) rgb = toward(rgb, hot, Math.min(1, heat * 1.35));

      grad.addColorStop(v, `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`);
    }

    ctx.fillStyle = grad;
    /* La colonne et sa symetrique : le faisceau est toujours centre. */
    ctx.fillRect(w / 2 + left * w, 0, (right - left) * w, h);
    ctx.fillRect(w / 2 - right * w, 0, (right - left) * w, h);
  }
}
