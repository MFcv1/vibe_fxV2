/*
 * Exports : PNG, SVG, CSS, JSON, video.
 *
 * PNG et video partent du rendu canvas. SVG sort de vrais chemins quand le type
 * s'y prete (lineaire, radial, conique, formes, ville), sinon il embarque le
 * rendu en image — c'est dit dans le panneau. CSS approche le degrade avec les
 * gradients natifs du navigateur ; JSON rend la composition telle quelle.
 */

import { bandCenters, rampStops, mix } from './color.js';

/* Types dont on sait sortir un vrai vecteur. */
export const VECTOR_TYPES = new Set(['LINEAR', 'CIRCLE', 'ANGULAR', 'SHAPES', 'SKYLINE', 'BARS', 'COLS', 'STRIPE']);

export const SIZES = [
  { label: 'Paysage', w: 1600, h: 1000 },
  { label: 'Carre', w: 1080, h: 1080 },
  { label: 'Story', w: 1080, h: 1920 },
  { label: 'HD', w: 1920, h: 1080 },
];

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (v) => String(v || 'gradient').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ------------------------------------------------------------------ CSS */

/*
 * Le CSS ne rejoue pas le moteur : il en donne l'equivalent le plus proche avec
 * les gradients natifs. Les champs (Flow, Mesh, Still…) deviennent une pile de
 * `radial-gradient`, ce qui est exactement la technique du fond de page.
 */
export function toCss(state, { selector = '.gradient' } = {}) {
  const { stops, divs, type } = state;
  const centers = bandCenters(stops.length, divs);
  const list = stops.map((c, i) => `${c} ${centers[i].toFixed(1)}%`).join(', ');
  const lines = [];

  if (type === 'LINEAR') {
    lines.push(`background: linear-gradient(180deg in oklab, ${list});`);
  } else if (type === 'CIRCLE') {
    lines.push(`background: radial-gradient(62% 62% at 50% 50% in oklab, ${list});`);
  } else if (type === 'ANGULAR') {
    lines.push(`background: conic-gradient(from 120deg in oklab, ${list}, ${stops[0]});`);
  } else if (type === 'IOS') {
    lines.push(`background: linear-gradient(135deg in oklab, ${list});`);
  } else {
    const spots = [
      ['80% 70% at 15% 12%', 55], ['80% 70% at 85% 16%', 55],
      ['90% 80% at 24% 88%', 58], ['100% 85% at 84% 84%', 60],
      ['70% 65% at 50% 50%', 52],
    ];
    const layers = stops.map((c, i) => {
      const [at, fade] = spots[i % spots.length];
      return `  radial-gradient(${at}, ${c} 0%, transparent ${fade}%)`;
    });
    lines.push(`background:\n${layers.join(',\n')},\n  ${stops[0]};`);
  }

  if (state.soften > 0) lines.push(`filter: blur(${state.soften}px);`);
  const css = [`${selector} {`, ...lines.map((l) => `  ${l}`), '}'].join('\n');

  if (state.grain > 0) {
    /* Le grain est une couche a part : un `::after` en fondu « overlay ». */
    return `${css}\n\n${selector}::after {\n  content: "";\n  position: absolute;\n  inset: 0;\n`
      + `  background-image: var(--grain-texture);\n  background-size: 256px 256px;\n`
      + `  mix-blend-mode: overlay;\n  opacity: ${(state.grain / 200).toFixed(3)};\n  pointer-events: none;\n}`;
  }
  return css;
}

/* ----------------------------------------------------------------- JSON */

export function toJson(state) {
  const keep = {
    type: state.type,
    title: state.title,
    stops: [...state.stops],
    divs: state.divs ? [...state.divs] : null,
    finish: { soften: state.soften, grain: state.grain },
  };
  const fields = { flow: 'FLOW', sky: 'SKY', aurora: 'AURORA', stripe: 'STRIPE', bars: 'BARS', still: 'SMESH', noise: 'CNOISE', ring: 'RING', pixel: 'PIXEL', glassy: 'GLASSY', glint: 'GLINT', mist: 'MIST' };
  for (const [key, owner] of Object.entries(fields)) {
    if (state.type === owner || (owner === 'BARS' && (state.type === 'COLS' || state.type === 'PRISM'))) keep.field = { ...state[key] };
  }
  if (state.form) keep.form = { ...state.form };
  if (state.lines) keep.lines = state.lines.map((l) => ({ ...l }));
  if (state.type === 'SKYLINE') keep.city = state.city;
  if (state.spots) keep.spots = state.spots.map((p) => [...p]);
  if (state.texts.length) {
    keep.texts = state.texts.map(({ element, ...rest }) => rest);
  }
  return JSON.stringify(keep, null, 2);
}

/* ------------------------------------------------------------------ SVG */

/* Degrade SVG a partir des centres de bande. */
function svgStops(stops, divs, steps = 6) {
  const centers = bandCenters(stops.length, divs).map((c) => c / 100);
  return rampStops(stops, centers, steps)
    .map(([color, at]) => `      <stop offset="${(at * 100).toFixed(2)}%" stop-color="${color}"/>`)
    .join('\n');
}

/* Rendu vectoriel quand le type s'y prete, sinon l'image du canvas. */
export function toSvg(state, w, h, rasterUrl, shapes, cities) {
  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  const grain = state.grain > 0
    ? `\n  <filter id="${id}n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3"/>`
      + `<feColorMatrix type="saturate" values="0"/></filter>`
      + `\n  <rect width="${w}" height="${h}" filter="url(#${id}n)" opacity="${(state.grain / 200).toFixed(3)}"`
      + ` style="mix-blend-mode:overlay"/>`
    : '';
  const texts = state.texts.filter((t) => t.content).map((t) => {
    const px = (t.sizePct / 100) * h;
    const anchor = t.align === 'left' ? 'start' : t.align === 'right' ? 'end' : 'middle';
    const lines = String(t.content).split('\n');
    const spans = lines.map((line, i) => `<tspan x="${((t.x / 100) * w).toFixed(1)}"`
      + ` dy="${i === 0 ? ((-(lines.length - 1) / 2) * px * 1.2).toFixed(1) : (px * 1.2).toFixed(1)}">${esc(line)}</tspan>`).join('');
    return `\n  <text x="${((t.x / 100) * w).toFixed(1)}" y="${((t.y / 100) * h).toFixed(1)}"`
      + ` font-family="${esc(t.family)}" font-size="${px.toFixed(1)}" font-weight="${t.bold ? 700 : 400}"`
      + ` letter-spacing="${(t.letter * px).toFixed(2)}" text-anchor="${anchor}" dominant-baseline="middle"`
      + ` fill="${t.ink === 'auto' ? '#2A2622' : t.ink}"`
      + `${t.rotate ? ` transform="rotate(${t.rotate} ${((t.x / 100) * w).toFixed(1)} ${((t.y / 100) * h).toFixed(1)})"` : ''}>${spans}</text>`;
  }).join('');

  if (state.type === 'LINEAR') {
    return `${head}\n  <defs>\n    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">\n`
      + `${svgStops(state.stops, state.divs)}\n    </linearGradient>\n  </defs>`
      + `\n  <rect width="${w}" height="${h}" fill="url(#${id})"/>${grain}${texts}\n</svg>`;
  }
  if (state.type === 'CIRCLE') {
    return `${head}\n  <defs>\n    <radialGradient id="${id}" cx="0.5" cy="0.5" r="0.62">\n`
      + `${svgStops(state.stops, state.divs)}\n    </radialGradient>\n  </defs>`
      + `\n  <rect width="${w}" height="${h}" fill="url(#${id})"/>${grain}${texts}\n</svg>`;
  }
  if (state.type === 'SHAPES' && shapes && state.form && shapes[state.form.id]) {
    const shape = shapes[state.form.id];
    const size = Math.min(w, h) * (state.form.size / 100);
    const scale = size / shape.width;
    const sx = scale * (state.form.stretchX / 100);
    const sy = scale * (state.form.stretchY / 100);
    const paths = shape.paths.map((p) => `<path d="${p.data}" fill="url(#${id})"${p.windingRule === 'EVENODD' ? ' fill-rule="evenodd"' : ''}/>`).join('');
    const ink = state.stops.length > 1 ? state.stops.slice(1) : state.stops;
    const body = ink.map((c, i) => `      <stop offset="${((ink.length === 1 ? 0 : i / (ink.length - 1)) * 100).toFixed(1)}%" stop-color="${c}"/>`).join('\n');
    return `${head}\n  <defs>\n    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">\n${body}\n    </linearGradient>\n  </defs>`
      + `\n  <rect width="${w}" height="${h}" fill="${state.stops[0]}"/>`
      + `\n  <g transform="translate(${(w * (state.form.x / 100)).toFixed(1)} ${(h * (state.form.y / 100)).toFixed(1)})`
      + ` rotate(${state.form.rotate}) skewX(${state.form.skew ?? 0}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`
      + ` translate(${(-shape.width / 2).toFixed(1)} ${(-shape.height / 2).toFixed(1)})">${paths}</g>${grain}${texts}\n</svg>`;
  }
  if (state.type === 'SKYLINE' && cities && cities[state.city]) {
    const city = cities[state.city];
    const inner = /translate\(([-\d.]+),([-\d.]+)\)\s*scale\(([\d.]+)\)/.exec(city.t ?? '');
    const gain = { sanfrancisco: 1, newyork: 1, paris: 1.18, london: 1.32, sydney: 1.15 }[state.city] ?? 1;
    let scale = (w / city.w) * gain;
    if (city.h * scale < h * 0.22) scale = Math.min((h * 0.22) / city.h, (w / city.w) * 1.5);
    const topY = Math.max(h - city.h * scale, h * 0.3);
    const tx = (w - city.w * scale) / 2;
    const place = `translate(${tx.toFixed(1)} ${topY.toFixed(1)}) scale(${scale.toFixed(4)})`
      + (inner ? ` translate(${inner[1]} ${inner[2]}) scale(${inner[3]})` : '');
    const layers = city.layers.map((layer) => {
      const tone = mix(state.stops[state.stops.length - 1], mix(state.stops[state.stops.length - 1], '#12100E', 0.45), 0.28 + 0.62 * layer.z);
      return `<g fill="${tone}">${layer.p.map((p) => `<path d="${p.d}"${p.e ? ' fill-rule="evenodd"' : ''}/>`).join('')}</g>`;
    }).join('');
    return `${head}\n  <defs>\n    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">\n`
      + `${svgStops(state.stops, state.divs)}\n    </linearGradient>\n  </defs>`
      + `\n  <rect width="${w}" height="${h}" fill="url(#${id})"/>`
      + `\n  <g transform="${place}">${layers}</g>${grain}${texts}\n</svg>`;
  }

  /* Types calcules pixel par pixel : le rendu part en image dans le SVG. */
  return `${head}\n  <image href="${rasterUrl}" width="${w}" height="${h}"/>\n</svg>`;
}

/* ---------------------------------------------------------------- video */

/*
 * Enregistrement par `MediaRecorder` sur le flux du canvas. Le format depend du
 * navigateur : MP4 quand il sait, WebM sinon — l'appelant est prevenu.
 */
export function pickVideoFormat() {
  const candidates = [
    { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4', label: 'MP4 (H.264)' },
    { mime: 'video/mp4', ext: 'mp4', label: 'MP4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm', label: 'WebM (VP9)' },
    { mime: 'video/webm', ext: 'webm', label: 'WebM' },
  ];
  for (const option of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(option.mime)) return option;
  }
  return null;
}

export function recordCanvas(canvas, { seconds = 6, fps = 30, bitrate = 12_000_000, onProgress } = {}) {
  const format = pickVideoFormat();
  if (!format) return Promise.reject(new Error('Ce navigateur ne sait pas enregistrer de video.'));
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(fps);
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: bitrate });
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) };
    recorder.onerror = (event) => reject(event.error ?? new Error('enregistrement interrompu'));
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve({ blob: new Blob(chunks, { type: format.mime }), format });
    };
    recorder.start();
    const started = performance.now();
    const tick = () => {
      const done = (performance.now() - started) / (seconds * 1000);
      onProgress?.(Math.min(1, done));
      if (done >= 1) recorder.stop();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ------------------------------------------------------------ telechargement */

export function download(blobOrUrl, filename) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const fileName = (state, ext) => `${slug(state.title)}.${ext}`;
