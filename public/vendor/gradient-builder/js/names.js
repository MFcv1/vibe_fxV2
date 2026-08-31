/*
 * Nom de couleur. Un teinte exacte du nuancier traditionnel garde son nom ;
 * sinon on en fabrique un a partir de la famille de teinte et du ton.
 */

import { hsl, lightness } from './color.js';

let TABLE = null;
const cache = new Map();

export async function loadNames() {
  if (TABLE) return TABLE;
  const res = await fetch(new URL('./data/colornames.json', import.meta.url));
  const data = await res.json();
  TABLE = { byHex: new Map(data.named.map((c) => [c.hex.toUpperCase(), c])), fallback: data.fallback };
  return TABLE;
}

function family(hex) {
  const [h, s, l] = hsl(hex);
  if (s < 0.13) return 'Grey';
  if (h >= 12 && h < 48 && l < 0.62 && s < 0.72) return 'Brown';
  if (h >= 255 && h < 330) return 'Purple';
  if (h >= 48 && h < 170) return (h < 68 && l > 0.5) ? 'Yellow' : 'Green';
  if (h >= 170 && h < 255) return 'Blue';
  return 'Red';
}

function tone(hex) {
  const l = lightness(hex);
  const [, s] = hsl(hex);
  if (l > 0.83) return 'pale';
  if (l > 0.66 || s < 0.2) return 'soft';
  if (l < 0.23) return 'night';
  if (l < 0.4) return 'deep';
  return 'clear';
}

export function nameOf(hex) {
  const key = hex.toUpperCase();
  if (cache.has(key)) return cache.get(key);
  if (!TABLE) return { name: key, kanji: '', romaji: '' };
  const exact = TABLE.byHex.get(key);
  if (exact) { cache.set(key, exact); return exact; }
  const pool = TABLE.fallback[family(key)][tone(key)];
  const seed = parseInt(key.slice(1), 16);
  const made = { name: pool[seed % pool.length], kanji: '', romaji: `BESPOKE-${key.slice(1)}` };
  cache.set(key, made);
  return made;
}

/* Note WCAG de la couleur face a l'encre la plus lisible. */
const relLum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

export function grade(hex) {
  const l = relLum(hex);
  const best = Math.max((l + 0.05) / 0.05, 1.05 / (l + 0.05));
  if (best >= 7) return 'AAA';
  if (best >= 4.5) return 'AA';
  if (best >= 3) return 'AA+';
  return '—';
}
