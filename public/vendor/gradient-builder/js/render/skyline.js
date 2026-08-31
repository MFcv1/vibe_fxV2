/*
 * SKYLINE — une ville en contre-jour sur un ciel degrade.
 *
 * Chaque ville est une pile de plans decoupes dans du SVG : le plan le plus
 * lointain est presque de la couleur du ciel, le plus proche presque noir.
 * La silhouette est calee en bas du cadre, et un halo de sol la decolle.
 */

import { mix, bandCenters, rampStops, hexToRgb } from '../color.js';

export const CITIES = ['sanfrancisco', 'newyork', 'paris', 'london', 'sydney'];
export const CITY_LABELS = {
  sanfrancisco: 'San Francisco', newyork: 'New York', paris: 'Paris',
  london: 'London', sydney: 'Sydney',
};

/* Largeur relative de chaque ville, pour qu'elles remplissent pareil. */
const WIDTH_GAIN = { sanfrancisco: 1, newyork: 1, paris: 1.18, london: 1.32, sydney: 1.15 };
const MIN_TOP = 0.3;      // la ville ne monte jamais au-dessus de ce niveau
const MIN_HEIGHT = 0.22;  // ni ne descend en dessous de cette hauteur
const MAX_GAIN = 1.5;
const GROUND = 0.24;      // hauteur du halo de sol

let LIBRARY = null;
export function loadCities(cities) { LIBRARY = cities }

/* Echelle et calage : la ville touche le bas, quitte a etre agrandie. */
function fit(w, h, city) {
  const def = LIBRARY[city];
  let scale = (w / def.w) * (WIDTH_GAIN[city] ?? 1);
  if (def.h * scale < h * MIN_HEIGHT) {
    scale = Math.min((h * MIN_HEIGHT) / def.h, (w / def.w) * MAX_GAIN);
  }
  const top = h - def.h * scale;
  return { scale, topY: Math.max(top, h * MIN_TOP), tx: (w - def.w * scale) / 2 };
}

/* La couleur d'un plan : du ciel (loin) vers l'encre (pres). */
const layerTone = (colors, z) => mix(colors[colors.length - 1], mix(colors[colors.length - 1], '#12100E', 0.45), 0.28 + 0.62 * z);

export function paintSkyline(ctx, w, h, colors, divs, city = 'sanfrancisco') {
  const name = LIBRARY && LIBRARY[city] ? city : 'sanfrancisco';
  const def = LIBRARY?.[name];

  /* Le ciel. */
  const stops = bandCenters(colors.length, divs).map((c) => c / 100);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  rampStops(colors, stops).forEach(([c, p]) => sky.addColorStop(p, c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  if (!def) return;

  const box = fit(w, h, name);
  /* Le SVG source porte sa propre transformation : on la rejoue. */
  const inner = /translate\(([-\d.]+),([-\d.]+)\)\s*scale\(([\d.]+)\)/.exec(def.t ?? '');

  const place = () => {
    ctx.translate(box.tx, box.topY);
    ctx.scale(box.scale, box.scale);
    if (inner) {
      ctx.translate(parseFloat(inner[1]), parseFloat(inner[2]));
      ctx.scale(parseFloat(inner[3]), parseFloat(inner[3]));
    }
  };

  for (const layer of def.layers) {
    ctx.save();
    place();
    ctx.fillStyle = layerTone(colors, layer.z);
    for (const path of layer.p) ctx.fill(new Path2D(path.d), path.e ? 'evenodd' : 'nonzero');
    ctx.restore();
  }

  /* Halo au sol : la ville ne flotte pas. */
  const height = def.h * box.scale * GROUND;
  const [r, g, b] = hexToRgb(colors[colors.length - 1]);
  const glow = ctx.createLinearGradient(0, h - height, 0, h);
  glow.addColorStop(0, `rgba(${r},${g},${b},0)`);
  glow.addColorStop(1, `rgba(${r},${g},${b},0.32)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, h - height, w, height);
}
