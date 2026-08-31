/*
 * Gradient Builder — reconstruction de l'ecran Studio de feralui.dev/gradients
 * pour VibeOS. App autonome, sans dependance : elle tourne dans une iframe et
 * renvoie le fond choisi au parent par postMessage.
 */

import { TYPE_NAMES, DOCK, FAMILY_ICONS } from './data/types.js';
import { bandCenters, bounds, inkForPalette, lightness, mix, sample } from './color.js';
import { loadNames, nameOf, grade } from './names.js';
import { render, renderTo, handles, grainTexture, loadShapes, loadCities, READY, ANIMATED, GPU_TYPES, FIELD_DEFAULTS } from './render/index.js';
import { el, segment, dial, fieldRow, group, schedule, unschedule } from './ui/controls.js';
import { toCss, toJson, toSvg, recordCanvas, pickVideoFormat, download, fileName, SIZES, VECTOR_TYPES } from './export.js';
import { TILE_SHAPES } from './render/glassy.js';
import { CITIES, CITY_LABELS } from './render/skyline.js';

/* ------------------------------------------------------------------ etat */

const state = {
  mode: 'studio',
  tab: 0,                    // 0 Design · 1 Text · 2 Image
  family: 0,                 // index dans DOCK
  type: 'FLOW',
  presetId: 'p44',
  title: 'Iridescent cloud',
  stops: ['#EAF4FC', '#1E50A2', '#F09199', '#895B8A'],
  divs: null,                // coupures entre bandes, null = reparties egalement
  spots: null,               // anneaux poses a la main
  active: 0,                 // couleur selectionnee
  flow: { ...FIELD_DEFAULTS.flow, speed: 30 },
  speed: 0,                  // vitesse des types sans reglage propre
  sky: { ...FIELD_DEFAULTS.sky },
  aurora: { ...FIELD_DEFAULTS.aurora },
  still: { ...FIELD_DEFAULTS.still },
  noise: { ...FIELD_DEFAULTS.noise },
  ring: { ...FIELD_DEFAULTS.ring },
  pixel: { ...FIELD_DEFAULTS.pixel },
  glassy: { ...FIELD_DEFAULTS.glassy },
  glint: { ...FIELD_DEFAULTS.glint },
  mist: { ...FIELD_DEFAULTS.mist },
  city: 'sanfrancisco',
  formSelected: false,
  horizon: 0.42,
  scale: 50,                 // finesse des pavages (Beehive, Blocks, Balls)
  ballStyle: 'convex',
  stripe: { ...FIELD_DEFAULTS.stripe },
  bars: { ...FIELD_DEFAULTS.BARS },
  form: null,                // forme SVG posee, pour le type Forms
  lines: null,               // arrangement de traits, pour le type Lines
  arrangementId: null,
  time: 20.75,
  playing: false,
  soften: 0,
  grain: 6,
  tags: false,
  texts: [],                 // boites de texte posees sur le canvas
  activeText: 0,
  images: [],                // logos ou photos poses sur le canvas
  activeImage: 0,
  dark: false,
};

const GRAIN_STRENGTH = 0.5;   // conversion curseur -> opacite du grain

let PRESETS = null;

const dom = {
  root: document.getElementById('jg-root'),
  modes: document.getElementById('jg-modes'),
  theme: document.getElementById('jg-theme'),
  themeKnob: document.getElementById('jg-theme-knob'),
  panel: document.getElementById('jg-panel'),
  studio: document.getElementById('jg-studio'),
  page: document.getElementById('jg-page'),
  surface: document.getElementById('jg-canvas-surface'),
  canvas: document.getElementById('jg-canvas'),
  grain: document.getElementById('jg-grain'),
  bandsTrack: document.getElementById('jg-bands-track'),
  bandsFill: document.getElementById('jg-bands-fill'),
  bandsActive: document.getElementById('jg-bands-active'),
  bandsHint: document.getElementById('jg-bands-hint'),
  title: document.getElementById('jg-title'),
  subtitle: document.getElementById('jg-subtitle'),
  textLayer: document.getElementById('jg-text-layer'),
  imageLayer: document.getElementById('jg-image-layer'),
  tags: document.getElementById('jg-tags'),
  scrim: document.getElementById('jg-sheet-scrim'),
  sheet: document.getElementById('jg-sheet'),
  sheetTitle: document.getElementById('jg-sheet-title'),
  sheetBody: document.getElementById('jg-sheet-body'),
};

/* --------------------------------------------------------------- rendu */

let drawHandle = 0;
let idleHandle = 0;

/* Un passage brouillon immediat, puis la pleine resolution une fois calme. */
function draw({ draft = false } = {}) {
  unschedule(drawHandle);
  clearTimeout(idleHandle);
  drawHandle = schedule(() => {
    if (!state.playing) render(dom.canvas, state, { draft, dpr: Math.min(2, window.devicePixelRatio || 1) });
    paintChrome();
    syncAnimation();
    if (draft && !state.playing) idleHandle = setTimeout(() => draw({ draft: false }), 140);
  });
}

/*
 * Boucle d'animation. Elle ne tourne que pour les types rendus par le GPU :
 * un champ calcule pixel par pixel ne tiendrait pas la cadence, et un onglet
 * masque ne recoit de toute facon pas de frames.
 */
let animHandle = 0;
let animLast = 0;

/* Le curseur Speed du type courant, ou 0 si le type ne bouge pas. */
function currentSpeed() {
  if (!ANIMATED.has(state.type)) return 0;
  const bucket = { SKY: 'sky', AURORA: 'aurora', FLOW: 'flow' }[state.type];
  if (bucket) return state[bucket]?.speed ?? 0;
  /* Un trait ne bouge que s'il a du sway : sinon l'horloge ne changerait rien. */
  if (state.type === 'LINE' && !(state.lines ?? []).some((l) => (l.sway ?? 0) > 0)) return 0;
  return state.speed ?? 0;
}

function syncAnimation() {
  const speed = currentSpeed();
  const wanted = speed > 0 && !document.hidden;
  if (!wanted) {
    unschedule(animHandle);
    animHandle = 0;
    if (state.playing) { state.playing = false; draw(); }
    return;
  }
  if (state.playing) return;
  state.playing = true;
  animLast = performance.now();

  /*
   * Le GPU tient la pleine resolution a 60 images/s ; un champ calcule pixel
   * par pixel ne le pourrait pas, donc il tourne en resolution reduite et a
   * cadence bridee — c'est exactement le compromis de l'original.
   */
  const gpu = GPU_TYPES.has(state.type);
  const minFrame = gpu ? 0 : 1000 / 24;
  let lastFrame = 0;

  const step = (now) => {
    if (!state.playing) return;
    const rate = currentSpeed() / 100;
    state.time += ((now - animLast) / 1000) * rate * 1.6;
    animLast = now;
    if (now - lastFrame >= minFrame) {
      lastFrame = now;
      render(dom.canvas, state, { draft: !gpu, dpr: Math.min(2, window.devicePixelRatio || 1) });
    }
    animHandle = requestAnimationFrame(step);
  };
  animHandle = requestAnimationFrame(step);
}

document.addEventListener('visibilitychange', () => { state.playing = false; syncAnimation(); });

/* Tout ce qui entoure le canvas et depend des couleurs. */
function paintChrome() {
  const stops = state.stops;
  const veil = state.dark ? 'rgba(18, 16, 14, 0.42)' : 'rgba(255, 253, 250, 0.42)';
  const base = state.dark ? '#191713' : '#f6f3ee';
  const at = [
    ['80% 70% at 15% 12%', 55], ['80% 70% at 85% 16%', 55],
    ['90% 80% at 24% 88%', 58], ['100% 85% at 84% 84%', 60],
  ];
  const layers = at.map(([pos, fade], i) => `radial-gradient(${pos}, ${stops[i % stops.length]}, transparent ${fade}%)`);
  dom.root.style.setProperty('--jg-grad', `linear-gradient(${veil}, ${veil}), ${layers.join(', ')}, ${base}`);

  const centers = bandCenters(stops.length, state.divs);
  dom.bandsFill.style.background = `linear-gradient(90deg in oklab, ${stops.map((c, i) => `${c} ${centers[i].toFixed(1)}%`).join(', ')})`;

  const edges = bounds(stops.length, state.divs);
  const left = edges[state.active] * 100;
  dom.bandsActive.style.left = `${left}%`;
  dom.bandsActive.style.width = `${(edges[state.active + 1] - edges[state.active]) * 100}%`;

  dom.canvas.style.filter = state.soften > 0 ? `blur(${state.soften}px)` : 'none';
  /* Le curseur va jusqu'a 40 ; l'opacite reelle reste discrete (40% -> .20). */
  dom.grain.style.opacity = String((state.grain / 100) * GRAIN_STRENGTH);
  dom.bandsHint.innerHTML = bandsHint();
  dom.title.textContent = state.title;
  dom.subtitle.textContent = `· ${TYPE_NAMES[state.type]}`;
  drawImages();
  drawTexts();
  drawHandles();
  drawFormFrame();
  drawTags();
}

/* Chaque type explique ses bandes a sa maniere. */
function bandsHint() {
  if (state.type === 'LINE') {
    return 'First colour is the paper · drag the grabbers to balance the rest along each line';
  }
  if (state.type === 'SKY') {
    return 'Four tones cast the sky: lightest crests the clouds, darkest floods the deep · tap a band to pick it';
  }
  if (state.type === 'AURORA') {
    return 'Lightest tone burns the core of the ribbon, darkest is the night · tap a band to pick it';
  }
  if (handles(state)) {
    return 'Bands set how far each colour reaches'
      + '<span class="jg-bands-hint-extra"> · the rings on the canvas place it</span>';
  }
  return 'Drag the grabbers to balance the colours · tap a band to pick it';
}

/* -------------------------------------------------------- images posees */

export const IMAGE_DEFAULTS = { src: '', x: 50, y: 50, sizePct: 30, rotate: 0, opacity: 100, blend: 'normal' };

/* Les images gardent leur rapport : seule leur largeur est pilotee. */
function drawImages() {
  dom.imageLayer.innerHTML = '';
  state.images.forEach((img, index) => {
    if (!img.src) return;
    const node = el('img', 'jg-img-item', { src: img.src, alt: '' });
    img.element = node;   // l'export redessine ce meme element
    node.style.left = `${img.x}%`;
    node.style.top = `${img.y}%`;
    node.style.width = `${img.sizePct}%`;
    node.style.opacity = String(img.opacity / 100);
    node.style.mixBlendMode = img.blend;
    node.style.transform = `translate(-50%, -50%) rotate(${img.rotate}deg)`;
    if (index === state.activeImage && state.tab === 2) node.dataset.selected = 'true';
    node.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      state.activeImage = index;
      node.setPointerCapture(event.pointerId);
      const move = (ev) => {
        const rect = dom.surface.getBoundingClientRect();
        img.x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
        img.y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
        node.style.left = `${img.x}%`;
        node.style.top = `${img.y}%`;
      };
      const up = () => {
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        if (state.tab === 2) buildPanel();
      };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
    });
    dom.imageLayer.appendChild(node);
  });
}

/* -------------------------------------------------------- textes poses */

/* Valeurs par defaut d'une boite de texte, alignees sur celles des presets. */
export const TEXT_DEFAULTS = {
  content: '', x: 50, y: 50, sizePct: 9.6, letter: 0, bold: false,
  ink: 'auto', align: 'center', rotate: 0,
  family: "'Inter', system-ui, sans-serif",
};

/* Les petites mentions d'angle de poster sont plus fines et espacees. */
const MARK_DEFAULTS = { ...TEXT_DEFAULTS, sizePct: 2, letter: 0.34, bold: false };

export const makeText = (over = {}, base = TEXT_DEFAULTS) => ({ ...base, ...over });

/*
 * Chaque boite est un noeud pose sur le canvas. On les recrée a chaque rendu :
 * il y en a au plus une poignee, et ca evite de synchroniser deux listes.
 */
function drawTexts() {
  dom.textLayer.innerHTML = '';
  const ink = inkForPalette(state.stops);
  state.texts.forEach((t, index) => {
    if (!t.content) return;
    const node = el('div', 'jg-text-overlay');
    node.style.left = `${t.x}%`;
    node.style.top = `${t.y}%`;
    node.style.fontFamily = t.family;
    node.style.fontWeight = t.bold ? '700' : '400';
    node.style.letterSpacing = `${t.letter}em`;
    node.style.fontSize = `${(t.sizePct / 100) * dom.surface.clientHeight}px`;
    node.style.color = t.ink === 'auto' ? ink : t.ink;
    node.style.textAlign = t.align;
    node.style.transform = `translate(${t.align === 'left' ? '0' : t.align === 'right' ? '-100%' : '-50%'}, -50%) rotate(${t.rotate ?? 0}deg)`;
    node.dataset.draggable = 'true';
    if (index === state.activeText && state.tab === 1) node.dataset.selected = 'true';
    node.title = 'Glissez pour deplacer';
    node.appendChild(el('span', 'jg-text-content', { text: t.content }));
    node.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      state.activeText = index;
      node.setPointerCapture(event.pointerId);
      const move = (ev) => {
        const rect = dom.surface.getBoundingClientRect();
        t.x = Math.max(1, Math.min(99, ((ev.clientX - rect.left) / rect.width) * 100));
        t.y = Math.max(1, Math.min(99, ((ev.clientY - rect.top) / rect.height) * 100));
        node.style.left = `${t.x}%`;
        node.style.top = `${t.y}%`;
      };
      const up = () => {
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        if (state.tab === 1) buildPanel();
      };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
    });
    dom.textLayer.appendChild(node);
  });
}

/* Reprend les textes d'un preset : un titre, puis ses mentions d'angle. */
function textsFromPreset(preset) {
  if (Array.isArray(preset.texts) && preset.texts.length) return preset.texts.map((t) => makeText(t));
  const out = [];
  if (preset.title) out.push(makeText(preset.title));
  if (Array.isArray(preset.marks)) for (const mark of preset.marks) out.push(makeText(mark, MARK_DEFAULTS));
  return out;
}

/* -------------------------------------------- cadre de forme (type Forms) */

let formLayer = null;

/*
 * Cadre pose sur le canvas : on tire dedans pour deplacer, sur un coin pour
 * redimensionner, sur la poignee du haut pour pivoter.
 */
function drawFormFrame() {
  if (!formLayer) {
    formLayer = el('div');
    formLayer.style.cssText = 'position:absolute;inset:0;z-index:3;pointer-events:none';
    dom.surface.appendChild(formLayer);
  }
  formLayer.innerHTML = '';
  if (state.type !== 'SHAPES' || !state.formSelected || !state.form) return;

  const shape = PRESETS?.shapes?.[state.form.id];
  if (!shape) return;
  const rect = dom.surface.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height) * (state.form.size / 100);
  const boxW = size * (state.form.stretchX / 100);
  const boxH = size * (shape.height / shape.width) * (state.form.stretchY / 100);

  const frame = el('div', 'jg-shape-controls');
  frame.style.cssText = `left:${state.form.x}%;top:${state.form.y}%;width:${boxW}px;height:${boxH}px;`
    + `transform:translate(-50%,-50%) rotate(${state.form.rotate}deg) skewX(${state.form.skew ?? 0}deg);pointer-events:auto`;

  /* Deplacement : on suit le pointeur en pourcentage du canvas. */
  frame.addEventListener('pointerdown', (event) => {
    if (event.target !== frame) return;
    event.preventDefault();
    frame.setPointerCapture(event.pointerId);
    const move = (ev) => {
      const box = dom.surface.getBoundingClientRect();
      state.form = {
        ...state.form,
        x: Math.max(0, Math.min(100, ((ev.clientX - box.left) / box.width) * 100)),
        y: Math.max(0, Math.min(100, ((ev.clientY - box.top) / box.height) * 100)),
      };
      drawFormFrame();
      draw({ draft: true });
    };
    const up = () => { frame.removeEventListener('pointermove', move); frame.removeEventListener('pointerup', up); draw(); };
    frame.addEventListener('pointermove', move);
    frame.addEventListener('pointerup', up);
  });

  /* Coins : la taille suit la distance au centre. */
  for (const corner of ['nw', 'ne', 'sw', 'se']) {
    const handle = el('span', `jg-shape-scale jg-shape-scale--${corner}`);
    handle.style.pointerEvents = 'auto';
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      const box = dom.surface.getBoundingClientRect();
      const unit = Math.min(box.width, box.height);
      const cx = box.left + (state.form.x / 100) * box.width;
      const cy = box.top + (state.form.y / 100) * box.height;
      const start = Math.max(1, Math.hypot(event.clientX - cx, event.clientY - cy));
      const from = state.form.size;
      const move = (ev) => {
        const now = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        state.form = { ...state.form, size: Math.max(8, Math.min(400, from * (now / start))) };
        drawFormFrame();
        draw({ draft: true });
      };
      const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); buildPanel(); draw(); };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      void unit;
    });
    frame.appendChild(handle);
  }

  /* Poignee haute : rotation autour du centre. */
  const spin = el('span', 'jg-shape-rotate');
  spin.style.pointerEvents = 'auto';
  spin.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    spin.setPointerCapture(event.pointerId);
    const box = dom.surface.getBoundingClientRect();
    const cx = box.left + (state.form.x / 100) * box.width;
    const cy = box.top + (state.form.y / 100) * box.height;
    const move = (ev) => {
      const angle = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
      state.form = { ...state.form, rotate: Math.round(angle) };
      drawFormFrame();
      draw({ draft: true });
    };
    const up = () => { spin.removeEventListener('pointermove', move); spin.removeEventListener('pointerup', up); buildPanel(); draw(); };
    spin.addEventListener('pointermove', move);
    spin.addEventListener('pointerup', up);
  });
  frame.appendChild(spin);
  frame.appendChild(el('span', 'jg-shape-grid'));
  frame.dataset.active = 'true';
  formLayer.appendChild(frame);
}

/* ------------------------------------------------------- anneaux poses */

let ringLayer = null;

function drawHandles() {
  const spots = handles(state);
  if (!ringLayer) {
    ringLayer = el('div', 'jg-mesh-handles');
    ringLayer.style.cssText = 'position:absolute;inset:0;z-index:3;pointer-events:none';
    dom.surface.appendChild(ringLayer);
  }
  ringLayer.innerHTML = '';
  if (!spots) return;
  spots.forEach(([x, y], i) => {
    const ring = el('button', 'jg-mesh-handle', { type: 'button', title: `${nameOf(state.stops[i]).name} — deplacer` });
    ring.style.cssText = `position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);width:26px;height:26px;`
      + 'border-radius:50%;pointer-events:auto;padding:3px;background:rgba(255,255,255,.42);'
      + 'box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.9),0 2px 8px -2px rgba(0,0,0,.35);'
      + 'backdrop-filter:blur(4px);cursor:grab;touch-action:none';
    const dot = el('i');
    dot.style.cssText = `display:block;width:100%;height:100%;border-radius:50%;background:${state.stops[i]}`;
    ring.appendChild(dot);
    ring.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      ring.setPointerCapture(event.pointerId);
      state.active = i;
      const move = (ev) => {
        const rect = dom.surface.getBoundingClientRect();
        const px = ((ev.clientX - rect.left) / rect.width) * 100;
        const py = ((ev.clientY - rect.top) / rect.height) * 100;
        const next = (state.spots ? [...state.spots] : handles(state).map((p) => [...p]));
        next[i] = [Math.max(0, Math.min(100, px)), Math.max(0, Math.min(100, py))];
        state.spots = next;
        draw({ draft: true });
      };
      const up = () => {
        ring.removeEventListener('pointermove', move);
        ring.removeEventListener('pointerup', up);
        draw();
      };
      ring.addEventListener('pointermove', move);
      ring.addEventListener('pointerup', up);
    });
    ringLayer.appendChild(ring);
  });
}

/* --------------------------------------------------------- etiquettes */

let tagLayer = null;

function drawTags() {
  if (!tagLayer) {
    tagLayer = el('div');
    tagLayer.style.cssText = 'position:absolute;inset:0;z-index:3;pointer-events:none';
    dom.surface.appendChild(tagLayer);
  }
  tagLayer.innerHTML = '';
  tagLayer.hidden = !state.tags;
  if (!state.tags) return;
  const spots = handles(state) ?? state.stops.map((_, i) => [82, 18 + i * 16]);
  state.stops.forEach((hex, i) => {
    const [x, y] = spots[i] ?? [82, 18 + i * 16];
    const tag = el('span');
    tag.style.cssText = `position:absolute;left:${Math.min(96, x)}%;top:${y}%;transform:translate(-50%,-50%);`
      + 'display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:999px;'
      + 'background:rgba(255,255,255,.9);color:#2a2622;font-size:11.5px;font-weight:600;letter-spacing:.03em;'
      + 'box-shadow:0 2px 10px -4px rgba(0,0,0,.35);white-space:nowrap';
    const dot = el('i');
    dot.style.cssText = `width:14px;height:14px;border-radius:50%;background:${hex};box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)`;
    tag.append(dot, el('span', null, { text: nameOf(hex).name }),
      el('span', null, { text: hex.toUpperCase() }));
    tag.lastChild.style.cssText = 'opacity:.5;font-weight:500';
    tagLayer.appendChild(tag);
  });
}

/* ------------------------------------------------------------- panneau */

function buildPanel() {
  dom.panel.innerHTML = '';
  dom.panel.appendChild(segment({
    items: [{ label: 'Design' }, { label: 'Text' }, { label: 'Image' }],
    active: state.tab,
    variant: 'jg-seg--tabs',
    onSelect: (i) => { state.tab = i; buildPanel(); },
  }));
  const body = el('div', 'jg-tab-wrap');
  const panel = el('div', 'jg-tabpanel');
  body.appendChild(panel);
  dom.panel.appendChild(body);
  if (state.tab === 0) buildDesignTab(panel);
  else if (state.tab === 1) buildTextTab(panel);
  else buildImageTab(panel);
}

function buildDesignTab(panel) {
  panel.appendChild(typeGroup());

  const spots = handles(state);
  if (spots) panel.appendChild(colourSpotsGroup());

  if (state.type === 'SHAPES') {
    panel.appendChild(silhouettesGroup());
    panel.appendChild(colourwaysGroup());
    panel.appendChild(backdropGroup());
    panel.appendChild(transformGroup());
    panel.appendChild(formTreatmentGroup());
    panel.appendChild(coloursGroup('Fine tune colours'));
    panel.appendChild(finishGroup());
    return;
  }

  if (state.type === 'LINE') {
    panel.appendChild(arrangementsGroup());
    panel.appendChild(lineColoursGroup());
  } else {
    const presets = presetsGroup();
    if (presets) panel.appendChild(presets);
  }

  const field = fieldGroup();
  if (field) panel.appendChild(field);

  panel.appendChild(coloursGroup());
  panel.appendChild(finishGroup());
}

/* ---- Type : familles puis grille du type ---- */
function typeGroup() {
  const g = group('Type');
  const dock = el('div', 'jg-type-dock', { 'data-armed': 'true' });
  const famSeg = segment({
    items: DOCK,
    active: state.family,
    variant: 'jg-seg--family',
    onSelect: (i) => { state.family = i; buildPanel(); },
    render: (button, item, i) => {
      const wrap = el('span', 'jg-fam');
      wrap.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${FAMILY_ICONS[item.label]}</svg>`;
      if (i === state.family) wrap.appendChild(el('span', 'jg-fam-name', { text: item.label }));
      button.appendChild(wrap);
    },
  });
  const viewport = el('div', 'jg-dock-viewport');
  const swap = el('div', 'jg-dock-swap', { 'data-dir': '1' });
  const types = DOCK[state.family].types;
  swap.appendChild(segment({
    items: types.map((t) => ({ label: TYPE_NAMES[t], id: t })),
    active: Math.max(0, types.indexOf(state.type)),
    variant: 'jg-dock-grid',
    onSelect: (_, item) => selectType(item.id),
  }));
  viewport.appendChild(swap);
  dock.append(famSeg, el('div', 'jg-dock-divider', { 'aria-hidden': 'true' }), viewport);
  g.appendChild(dock);
  schedule(() => { viewport.style.height = `${swap.offsetHeight}px`; });
  return g;
}

/* ---- Points de couleur : seulement pour les types a anneaux ---- */
function colourSpotsGroup() {
  const g = group('Colour spots');
  const row = el('div', 'jg-canvas-meta-actions jg-mesh-actions');
  const shuffle = el('button', 'jg-mini-btn', { type: 'button', text: 'Shuffle' });
  shuffle.addEventListener('click', () => {
    const spread = handles(state);
    state.spots = spread.map(() => [8 + Math.random() * 84, 8 + Math.random() * 84]);
    draw();
  });
  const reset = el('button', 'jg-mini-btn', { type: 'button', text: 'Reset' });
  reset.disabled = !state.spots;
  reset.addEventListener('click', () => { state.spots = null; buildPanel(); draw(); });
  row.append(shuffle, reset);
  g.appendChild(row);
  g.appendChild(el('p', 'jg-bands-hint', { text: 'Drag the rings on the canvas. Each ring pins its colour there.' }));
  return g;
}

/* ---- Presets du type ---- */
function presetsGroup() {
  const list = PRESETS?.panel?.[state.type] ?? [];
  if (!list.length) return null;
  const g = group('Presets', `for ${TYPE_NAMES[state.type].toLowerCase()}`);
  g.appendChild(chipRow(list, (preset) => preset.id === state.presetId, applyPreset));
  return g;
}

/* ---- Lines : les arrangements, puis les roues de couleur ---- */
function arrangementsGroup() {
  const list = PRESETS?.arrangements ?? [];
  if (!list.length) return group('Presets', 'arrangements');
  const g = group('Presets', 'arrangements, keep your colours');
  const row = el('div', 'jg-preset-imgs');
  for (const item of list) {
    const chip = el('button', 'jg-preset-img', { type: 'button' });
    chip.dataset.on = String(item.id === state.arrangementId);
    const thumb = el('canvas');
    thumb.width = 88; thumb.height = 88;
    chip.append(thumb, el('span', null, { text: item.name }));
    chip.addEventListener('click', () => applyArrangement(item));
    row.appendChild(chip);
    schedule(() => {
      const ctx = thumb.getContext('2d');
      paintArrangementThumb(ctx, 88, 88, item);
    });
  }
  g.appendChild(row);
  return g;
}

function lineColoursGroup() {
  const list = PRESETS?.panel?.LINE ?? [];
  if (!list.length) return group('Colours');
  const g = group('Colours', 'retint your arrangement');
  g.appendChild(chipRow(list, (preset) => preset.id === state.presetId, (preset) => {
    /* On garde l'arrangement : seule la palette change. */
    state.presetId = preset.id;
    state.title = preset.e;
    state.stops = [...preset.stops];
    state.divs = preset.divs ? [...preset.divs] : null;
    if (typeof preset.grain === 'number') state.grain = preset.grain;
  if (typeof preset.speed === 'number') {
    if (state.type === 'SKY') state.sky = { ...state.sky, speed: preset.speed };
    else if (state.type === 'AURORA') state.aurora = { ...state.aurora, speed: preset.speed };
    else if (state.type === 'FLOW') state.flow = { ...state.flow, speed: preset.speed };
    else state.speed = preset.speed;
  } else if (!ANIMATED.has(state.type)) state.speed = 0;
    if (typeof preset.soften === 'number') state.soften = preset.soften;
    buildPanel();
    syncBands();
    draw();
  }));
  return g;
}

function chipRow(list, isOn, onPick) {
  const row = el('div', 'jg-chiprow');
  for (const preset of list) {
    const chip = el('button', 'jg-chip', { type: 'button', title: preset.romaji || preset.e });
    chip.dataset.on = String(isOn(preset));
    const dot = el('span', 'jg-chip-dot');
    dot.style.background = wheel(preset.stops);
    chip.append(dot, el('span', 'jg-chip-label', { text: preset.e }));
    chip.addEventListener('click', () => onPick(preset));
    row.appendChild(chip);
  }
  return row;
}

/* ---- Forms : silhouettes, gammes, fond, transformation ---- */

const BACKDROPS = [
  ['Paper', '#FFFDF7'], ['Chalk', '#FAFBFF'], ['Cream', '#FFF8EE'], ['Mist', '#F2F4EF'],
  ['Blush', '#FFF2F3'], ['Lilac', '#F6F0FF'], ['Sky', '#EDF8FF'], ['Ink', '#15131B'],
  ['Navy', '#151A2C'], ['Moss', '#183028'], ['Plum', '#2A1634'], ['Clay', '#36241F'],
];

function silhouettesGroup() {
  const g = group('Silhouettes', 'from the SVG set');
  const grid = el('div', 'jg-shape-grid');
  const shapes = PRESETS?.shapes ?? {};
  for (const [id, shape] of Object.entries(shapes)) {
    const chip = el('button', 'jg-shape-chip', { type: 'button', title: id.replace(/^(clean|soft)-/, '').replace(/-/g, ' ') });
    chip.dataset.on = String(id === (state.form?.id ?? ''));
    chip.innerHTML = `<svg viewBox="0 0 ${shape.width} ${shape.height}" aria-hidden="true">`
      + shape.paths.map((p) => `<path d="${p.data}"${p.windingRule === 'EVENODD' ? ' fill-rule="evenodd"' : ''}/>`).join('')
      + '</svg>';
    chip.addEventListener('click', () => {
      state.form = { ...FIELD_DEFAULTS.form, ...(state.form ?? {}), id };
      buildPanel();
      draw();
    });
    grid.appendChild(chip);
  }
  g.appendChild(grid);
  return g;
}

function colourwaysGroup() {
  const list = PRESETS?.colorways ?? [];
  const g = group('Colourways', String(list.length));
  const grid = el('div', 'jg-shape-colorways');
  for (const way of list) {
    const chip = el('button', 'jg-shape-colorway', { type: 'button', title: way.name });
    chip.dataset.on = String(JSON.stringify(way.stops) === JSON.stringify(state.stops));
    const swatch = el('span', 'jg-shape-colorway-swatch');
    const slice = 100 / way.stops.length;
    swatch.style.background = `linear-gradient(90deg, ${way.stops.map((c, i) => `${c} ${(i * slice).toFixed(1)}% ${((i + 1) * slice).toFixed(1)}%`).join(', ')})`;
    chip.append(swatch, el('span', 'jg-shape-colorway-name', { text: way.name }));
    chip.addEventListener('click', () => {
      state.stops = [...way.stops];
      state.divs = null;
      state.title = way.name;
      state.presetId = null;
      buildPanel();
      syncBands();
      draw();
    });
    grid.appendChild(chip);
  }
  g.appendChild(grid);
  g.appendChild(el('p', 'jg-bands-hint', { text: 'La gamme habille la forme ; le fond reste celui choisi ci-dessous.' }));
  return g;
}

/* Le fond d'une composition Forms, c'est la premiere couleur de la palette. */
function backdropGroup() {
  const g = group(null);
  const head = el('div', 'jg-group-head');
  const match = el('button', 'jg-mini-btn', { type: 'button', text: 'Match set' });
  match.addEventListener('click', () => {
    /* Un papier tire de la palette : la teinte la plus claire, encore eclaircie. */
    const lightest = state.stops.slice(1).reduce((best, c) => (lightness(c) > lightness(best) ? c : best), state.stops[1] ?? state.stops[0]);
    setBackdrop(mix(lightest, '#FFFFFF', 0.82));
  });
  head.append(el('h4', null, { text: 'Backdrop' }), match);
  g.appendChild(head);

  const row = el('div', 'jg-shape-backdrops');
  for (const [name, hex] of BACKDROPS) {
    const swatch = el('button', 'jg-shape-backdrop', { type: 'button', title: `${name} · ${hex}`, 'aria-label': `Fond ${name}` });
    swatch.style.setProperty('--jg-backdrop', hex);
    swatch.dataset.on = String(hex.toUpperCase() === state.stops[0].toUpperCase());
    swatch.appendChild(el('span'));
    swatch.addEventListener('click', () => setBackdrop(hex));
    row.appendChild(swatch);
  }
  const custom = el('button', 'jg-shape-backdrop jg-shape-backdrop--custom', { type: 'button', title: 'Fond personnalise' });
  const picker = el('input', null, { type: 'color', value: state.stops[0], 'aria-label': 'Fond personnalise' });
  picker.addEventListener('input', () => setBackdrop(picker.value.toUpperCase()));
  const face = el('span', null, { text: '+' });
  custom.append(face, picker);
  row.appendChild(custom);
  g.appendChild(row);

  const value = el('div', 'jg-shape-backdrop-value');
  const dot = el('i');
  dot.style.background = state.stops[0];
  value.append(dot, el('span', 'jg-num', { text: state.stops[0].toUpperCase() }));
  g.appendChild(value);
  return g;
}

function setBackdrop(hex) {
  state.stops = state.stops.map((c, i) => (i === 0 ? hex : c));
  buildPanel();
  draw();
}

function transformGroup() {
  const g = group(null);
  g.className = 'jg-panel-group jg-shape-transform-card';
  const head = el('div', 'jg-group-head');
  const toggle = el('button', 'jg-mini-btn', { type: 'button', text: state.formSelected ? 'Selected' : 'Select form' });
  toggle.addEventListener('click', () => { state.formSelected = !state.formSelected; buildPanel(); paintChrome(); });
  head.append(el('h4', null, { text: 'Canvas transform' }), toggle);
  g.appendChild(head);

  const hint = el('div', 'jg-shape-gesture-hint');
  const text = el('span');
  text.append(el('strong', null, { text: 'Move directly on canvas' }),
    el('small', null, { text: 'Drag the form · corners scale · top handle rotates' }));
  hint.appendChild(text);
  g.appendChild(hint);

  const actions = el('div', 'jg-shape-quick-actions');
  const apply = (over) => { state.form = { ...FIELD_DEFAULTS.form, ...(state.form ?? {}), ...over }; buildPanel(); draw(); };
  const fit = el('button', 'jg-mini-btn', { type: 'button', text: 'Fit' });
  fit.addEventListener('click', () => apply({ x: 50, y: 50, size: 78, rotate: 0, skew: 0, stretchX: 100, stretchY: 100 }));
  const fill = el('button', 'jg-mini-btn', { type: 'button', text: 'Fill' });
  fill.addEventListener('click', () => apply({ x: 50, y: 50, size: 150, rotate: 0, skew: 0, stretchX: 100, stretchY: 100 }));
  const reset = el('button', 'jg-mini-btn', { type: 'button', text: 'Reset' });
  reset.addEventListener('click', () => apply({ ...FIELD_DEFAULTS.form }));
  actions.append(fit, fill, reset);
  g.appendChild(actions);
  return g;
}

function formTreatmentGroup() {
  const g = group('Form treatment');
  const rows = el('div', 'jg-finish-rows');
  const form = () => state.form ?? FIELD_DEFAULTS.form;
  const setForm = (key, value) => {
    state.form = { ...FIELD_DEFAULTS.form, ...(state.form ?? {}), [key]: value };
    draw({ draft: true });
  };
  rows.append(
    fieldRow('Edge fade', dial({ label: '', value: form().fade, format: (v) => `${v}%`, onInput: (v) => setForm('fade', v) })),
    fieldRow('Width', dial({ label: '', value: form().stretchX, min: 20, max: 200, format: (v) => `${v}%`, onInput: (v) => setForm('stretchX', v) })),
    fieldRow('Height', dial({ label: '', value: form().stretchY, min: 20, max: 200, format: (v) => `${v}%`, onInput: (v) => setForm('stretchY', v) })),
    fieldRow('Distort', dial({ label: '', value: form().skew ?? 0, min: -45, max: 45, format: (v) => `${v}°`, onInput: (v) => setForm('skew', v) })),
    fieldRow('Bloom', dial({ label: '', value: form().bloom ?? 34, format: (v) => `${v}%`, onInput: (v) => setForm('bloom', v) })),
  );
  g.appendChild(rows);
  return g;
}

/* ---- Reglages propres au type ---- */
function fieldGroup() {
  const rows = el('div', 'jg-finish-rows');

  if (state.type === 'FLOW') {
    const g = group('Field');
    rows.append(
      fieldRow('Scale', dialFor('flow', 'scale')),
      fieldRow('Distortion', dialFor('flow', 'distortion')),
      fieldRow('Swirl', dialFor('flow', 'swirl')),
      fieldRow('Speed', dialFor('flow', 'speed')),
    );
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'SKY') {
    const g = group('Weather');
    rows.append(
      fieldRow('Scale', dialFor('sky', 'scale')),
      fieldRow('Warp', dialFor('sky', 'distortion')),
      fieldRow('Wind', dialFor('sky', 'swirl')),
      fieldRow('Speed', dialFor('sky', 'speed')),
    );
    g.appendChild(rows);
    g.appendChild(directionRow('sky'));
    return g;
  }

  if (state.type === 'AURORA') {
    const g = group('Field');
    rows.append(
      fieldRow('Scale', dialFor('aurora', 'scale')),
      fieldRow('Fold', dialFor('aurora', 'distortion')),
      fieldRow('Drift', dialFor('aurora', 'swirl')),
      fieldRow('Speed', dialFor('aurora', 'speed')),
    );
    g.appendChild(rows);
    g.appendChild(directionRow('aurora'));
    return g;
  }

  if (state.type === 'STRIPE') {
    const g = group('Field');
    rows.append(
      fieldRow('Angle', dial({ label: '', value: state.stripe.angle, min: 0, max: 180, format: (v) => `${v}°`, onInput: (v) => setField('stripe', 'angle', v) })),
      fieldRow('Softness', dialFor('stripe', 'softness')),
      fieldRow('Wave', dialFor('stripe', 'wave')),
    );
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'GLASSY') {
    const g = group('Field');
    rows.append(
      fieldRow('Scale', dialFor('glassy', 'scale')),
      fieldRow('Cover', dialFor('glassy', 'cover')),
      fieldRow('Weave', dialFor('glassy', 'weave')),
      fieldRow('Refract', dialFor('glassy', 'refract')),
      fieldRow('Warp', dial({ label: '', value: state.glassy.warp ?? 0, min: -100, max: 100, format: (v) => `${v}%`, onInput: (v) => setField('glassy', 'warp', v) })),
    );
    g.appendChild(rows);
    g.appendChild(el('p', 'jg-subhead', { text: 'Tile' }));
    g.appendChild(shapePills(TILE_SHAPES, state.glassy.shape ?? 'square', (shape) => setField('glassy', 'shape', shape)));
    return g;
  }

  if (state.type === 'GLINT') {
    const g = group('Field');
    rows.append(
      fieldRow('Sparkle', dialFor('glint', 'scale')),
      fieldRow('Horizon', dial({ label: '', value: Math.round((state.glint.horizon ?? 0.44) * 100), min: 14, max: 70, format: (v) => `${v}%`, onInput: (v) => setField('glint', 'horizon', v / 100) })),
    );
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'MIST') {
    const g = group('Field');
    rows.append(
      fieldRow('Ridges', dial({ label: '', value: state.scale, format: (v) => `${v}%`, onInput: (v) => { state.scale = v; draw({ draft: true }); } })),
      fieldRow('Haze', dialFor('mist', 'haze')),
      fieldRow('Height', dialFor('mist', 'height')),
      fieldRow('Sharp', dialFor('mist', 'sharp')),
      fieldRow('Sun', dialFor('mist', 'sun')),
      fieldRow('Horizon', dial({ label: '', value: Math.round(state.horizon * 100), min: 14, max: 62, format: (v) => `${v}%`, onInput: (v) => { state.horizon = v / 100; draw({ draft: true }); } })),
    );
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'SKYLINE') {
    const g = group('City');
    g.appendChild(shapePills(CITIES, state.city, (city) => { state.city = city; buildPanel(); draw(); }, CITY_LABELS));
    return g;
  }

  if (state.type === 'RING') {
    const g = group('Field');
    rows.append(
      fieldRow('Count', dial({ label: '', value: state.ring.count, min: 5, max: 24, format: (v) => String(v), onInput: (v) => setField('ring', 'count', v) })),
      fieldRow('Melt', dialFor('ring', 'melt')),
      fieldRow('Glow', dialFor('ring', 'glow')),
      fieldRow('Sweep', dialFor('ring', 'sweep')),
    );
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'PIXEL') {
    const g = group('Field');
    rows.append(
      fieldRow('Scale', dial({ label: '', value: state.scale, format: (v) => `${v}%`, onInput: (v) => { state.scale = v; draw({ draft: true }); } })),
      fieldRow('Levels', dial({ label: '', value: state.pixel.levels, min: 2, max: 32, format: (v) => String(v), onInput: (v) => setField('pixel', 'levels', v) })),
      fieldRow('Jitter', dialFor('pixel', 'jitter')),
    );
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'BEEHIVE' || state.type === 'CUBE' || state.type === 'BALLS') {
    const g = group('Field');
    rows.appendChild(fieldRow('Scale', dial({
      label: '', value: state.scale, format: (v) => `${v}%`,
      onInput: (v) => { state.scale = v; draw({ draft: true }); },
    })));
    if (state.type === 'BALLS') {
      const styles = ['convex', 'concave'];
      rows.appendChild(fieldRow('Relief', segment({
        items: styles.map((label) => ({ label })),
        active: styles.indexOf(state.ballStyle),
        onSelect: (_, item) => { state.ballStyle = item.label; draw(); },
      })));
    }
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'PRISM') {
    const g = group('Field');
    rows.appendChild(fieldRow('Count', dial({
      label: '', value: state.bars.count, min: 3, max: 40, format: (v) => String(v),
      onInput: (v) => setField('bars', 'count', v),
    })));
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'SMESH') {
    const g = group('Field');
    rows.append(
      fieldRow('Positions', dial({ label: '', value: state.still.positions, min: 0, max: 24, format: (v) => String(v), onInput: (v) => setField('still', 'positions', v) })),
      fieldRow('Wave X', dialFor('still', 'waveX')),
      fieldRow('Wave Y', dialFor('still', 'waveY')),
      fieldRow('Mixing', dialFor('still', 'mixing')),
      fieldRow('Rotation', dial({ label: '', value: state.still.rotation, min: 0, max: 359, format: (v) => `${v}°`, onInput: (v) => setField('still', 'rotation', v) })),
    );
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'CNOISE') {
    const g = group('Field');
    rows.append(
      fieldRow('Angle', dial({ label: '', value: state.noise.angle, min: 0, max: 180, format: (v) => `${v}°`, onInput: (v) => setField('noise', 'angle', v) })),
      fieldRow('Stretch', dialFor('noise', 'stretch')),
      fieldRow('Spread', dialFor('noise', 'spread')),
    );
    g.appendChild(rows);
    return g;
  }

  if (state.type === 'BARS' || state.type === 'COLS') {
    const g = group('Field');
    rows.appendChild(fieldRow('Speed', dial({
      label: '', value: state.speed, format: (v) => `${v}%`,
      onInput: (v) => { state.speed = v; syncAnimation(); },
    })));
    rows.append(
      fieldRow('Count', dial({ label: '', value: state.bars.count, min: 2, max: 48, format: (v) => String(v), onInput: (v) => setField('bars', 'count', v) })),
      fieldRow('Gap', dial({ label: '', value: state.bars.gap, min: -50, max: 90, format: (v) => `${v}%`, onInput: (v) => setField('bars', 'gap', v) })),
    );
    const shapes = ['flat', 'ramp', 'curve'];
    rows.appendChild(fieldRow('Envelope', segment({
      items: shapes.map((label) => ({ label })),
      active: Math.max(0, shapes.indexOf(state.bars.envelope)),
      onSelect: (_, item) => setField('bars', 'envelope', item.label),
    })));
    g.appendChild(rows);
    return g;
  }

  return null;
}

const dialFor = (bucket, key) => dial({
  label: '',
  value: state[bucket][key] ?? 0,
  format: (v) => `${v}%`,
  onInput: (v) => setField(bucket, key, v),
});

/* Rangee de pastilles pour un choix a plusieurs valeurs nommees. */
function shapePills(values, active, onPick, labels) {
  const row = el('div', 'jg-pillrow');
  for (const value of values) {
    const pill = el('button', 'jg-pill', { type: 'button', text: labels?.[value] ?? value });
    pill.dataset.on = String(value === active);
    pill.addEventListener('click', () => onPick(value));
    row.appendChild(pill);
  }
  return row;
}

const DIRECTIONS = ['Up', 'Right', 'Down', 'Left'];

function directionRow(bucket) {
  const g = el('div');
  g.appendChild(el('p', 'jg-subhead', { text: 'Direction' }));
  g.appendChild(segment({
    items: DIRECTIONS.map((label) => ({ label })),
    active: state[bucket].dir ?? 0,
    onSelect: (i) => setField(bucket, 'dir', i),
  }));
  return g;
}

/* ---- Liste des couleurs ---- */
function coloursGroup(title = 'Colours') {
  const colors = group(null);
  const head = el('div', 'jg-group-head');
  head.append(el('h4', null, { text: title }), el('span', 'jg-dim jg-num', { text: String(state.stops.length) }));
  colors.appendChild(head);
  const stopsBox = el('div', 'jg-stops');
  state.stops.forEach((hex, i) => {
    const cell = el('div', 'jg-stop-cell');
    const row = el('div', 'jg-stop-row');
    row.dataset.on = String(i === state.active);
    const main = el('button', 'jg-stop-main', { type: 'button' });
    const dot = el('span', 'jg-stop-dot');
    dot.style.background = hex;
    const picker = el('input', 'jg-stop-swatch', { type: 'color', value: hex, 'aria-label': `Couleur ${i + 1}` });
    picker.addEventListener('input', () => setStop(i, picker.value.toUpperCase(), true));
    picker.addEventListener('change', () => setStop(i, picker.value.toUpperCase(), false));
    dot.appendChild(picker);
    const names = el('div', 'jg-stop-names');
    const meta = nameOf(hex);
    names.append(el('span', 'jg-stop-title', { text: meta.name }),
      el('span', 'jg-num', { text: `${hex.toUpperCase()} · ${grade(hex)}` }));
    main.append(dot, names);
    main.addEventListener('click', (event) => {
      if (event.target === picker) return;
      state.active = i; buildPanel(); paintChrome();
    });
    row.appendChild(main);
    if (state.stops.length > 2) {
      const remove = el('button', 'jg-icon-btn', { type: 'button', title: 'Retirer', 'aria-label': 'Retirer' });
      remove.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      remove.addEventListener('click', () => removeStop(i));
      row.appendChild(remove);
    }
    cell.appendChild(row);
    stopsBox.appendChild(cell);
  });
  colors.appendChild(stopsBox);
  const add = el('button', 'jg-add-stop', { type: 'button' });
  add.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Add colour</span>';
  add.addEventListener('click', addStop);
  colors.appendChild(add);
  return colors;
}

/* ---- Finition ---- */
function finishGroup() {
  const finish = group('Finish');
  const rows = el('div', 'jg-finish-rows');
  rows.append(
    fieldRow('Soften', dial({ label: '', value: state.soften, min: 0, max: 40, format: (v) => `${v}px`, onInput: (v) => { state.soften = v; paintChrome(); } })),
    fieldRow('Noise', dial({ label: '', value: state.grain, min: 0, max: 40, format: (v) => `${v}%`, onInput: (v) => { state.grain = v; paintChrome(); } })),
  );
  finish.appendChild(rows);
  return finish;
}

function buildTextTab(panel) {
  const list = group('Text boxes', state.texts.length ? `${state.texts.length}` : '');
  const box = el('div', 'jg-stops');
  state.texts.forEach((t, i) => {
    const cell = el('div', 'jg-stop-cell');
    const row = el('div', 'jg-stop-row');
    row.dataset.on = String(i === state.activeText);
    const main = el('button', 'jg-stop-main', { type: 'button' });
    const names = el('div', 'jg-stop-names');
    names.append(
      el('span', 'jg-stop-title', { text: (t.content || 'Vide').split('\n')[0].slice(0, 24) }),
      el('span', 'jg-num', { text: `${Math.round(t.sizePct)}% · ${t.align}` }),
    );
    main.appendChild(names);
    main.addEventListener('click', () => { state.activeText = i; buildPanel(); paintChrome(); });
    row.appendChild(main);
    const remove = el('button', 'jg-icon-btn', { type: 'button', title: 'Retirer', 'aria-label': 'Retirer' });
    remove.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    remove.addEventListener('click', () => {
      state.texts = state.texts.filter((_, k) => k !== i);
      state.activeText = Math.max(0, Math.min(state.activeText, state.texts.length - 1));
      buildPanel(); paintChrome();
    });
    row.appendChild(remove);
    cell.appendChild(row);
    box.appendChild(cell);
  });
  list.appendChild(box);
  const add = el('button', 'jg-add-stop', { type: 'button' });
  add.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Add text</span>';
  add.addEventListener('click', () => {
    state.texts = [...state.texts, makeText({ content: 'Texte', x: 50, y: 50 })];
    state.activeText = state.texts.length - 1;
    buildPanel(); paintChrome();
  });
  list.appendChild(add);
  panel.appendChild(list);

  const t = state.texts[state.activeText];
  if (!t) return;

  const content = group('Content');
  const input = el('textarea', 'jg-text-input', { rows: '2' });
  input.value = t.content;
  input.style.cssText = 'width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--jg-line);'
    + 'background:var(--jg-glass-fill);font:inherit;color:inherit;resize:vertical';
  input.addEventListener('input', () => { t.content = input.value; buildPanelSoon(); paintChrome(); });
  content.appendChild(input);
  panel.appendChild(content);

  const fonts = [
    { label: 'Inter', value: "'Inter', system-ui, sans-serif" },
    { label: 'Serif', value: "'Instrument Serif', Georgia, serif" },
    { label: 'Display', value: "'Playfair Display', Georgia, serif" },
    { label: 'Grotesk', value: "'Space Grotesk', system-ui, sans-serif" },
  ];
  const style = group('Style');
  const rows = el('div', 'jg-finish-rows');
  rows.append(
    fieldRow('Font', segment({
      items: fonts,
      active: Math.max(0, fonts.findIndex((f) => f.value === t.family)),
      onSelect: (_, item) => { t.family = item.value; paintChrome(); },
    })),
    fieldRow('Size', dial({ label: '', value: Math.round(t.sizePct), min: 1, max: 40, format: (v) => `${v}%`, onInput: (v) => { t.sizePct = v; paintChrome(); } })),
    fieldRow('Letter', dial({ label: '', value: Math.round(t.letter * 100), min: -10, max: 40, format: (v) => `${(v / 100).toFixed(2)}em`, onInput: (v) => { t.letter = v / 100; paintChrome(); } })),
    fieldRow('Rotate', dial({ label: '', value: Math.round(t.rotate ?? 0), min: -45, max: 45, format: (v) => `${v}°`, onInput: (v) => { t.rotate = v; paintChrome(); } })),
    fieldRow('Align', segment({
      items: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }],
      active: ['left', 'center', 'right'].indexOf(t.align),
      onSelect: (_, item) => { t.align = item.value; buildPanelSoon(); paintChrome(); },
    })),
    fieldRow('Ink', segment({
      items: [{ label: 'Auto', value: 'auto' }, { label: 'Light', value: '#FBF8F3' }, { label: 'Dark', value: '#2A2622' }],
      active: t.ink === 'auto' ? 0 : t.ink === '#FBF8F3' ? 1 : 2,
      onSelect: (_, item) => { t.ink = item.value; paintChrome(); },
    })),
  );
  const weight = el('button', 'jg-pill', { type: 'button', text: 'Bold' });
  weight.dataset.on = String(t.bold);
  weight.addEventListener('click', () => { t.bold = !t.bold; weight.dataset.on = String(t.bold); paintChrome(); });
  const pills = el('div', 'jg-pillrow');
  pills.appendChild(weight);
  style.append(rows, pills);
  panel.appendChild(style);

  const hint = group('Position');
  hint.appendChild(el('span', 'jg-dim', { text: 'Glissez le texte directement sur le canvas pour le placer.' }));
  panel.appendChild(hint);
}

/* Reconstruit le panneau apres la frappe, sans voler le focus a chaque touche. */
let panelSoon = 0;
function buildPanelSoon() {
  clearTimeout(panelSoon);
  panelSoon = setTimeout(() => buildPanel(), 600);
}

function buildImageTab(panel) {
  const list = group('Images', state.images.length ? String(state.images.length) : '');
  if (state.images.length) {
    const box = el('div', 'jg-stops');
    state.images.forEach((img, i) => {
      const cell = el('div', 'jg-stop-cell');
      const row = el('div', 'jg-stop-row');
      row.dataset.on = String(i === state.activeImage);
      const main = el('button', 'jg-stop-main', { type: 'button' });
      const thumb = el('span', 'jg-stop-dot');
      thumb.style.backgroundImage = `url(${img.src})`;
      thumb.style.backgroundSize = 'cover';
      thumb.style.backgroundPosition = 'center';
      const names = el('div', 'jg-stop-names');
      names.append(el('span', 'jg-stop-title', { text: img.name || `Image ${i + 1}` }),
        el('span', 'jg-num', { text: `${Math.round(img.sizePct)}% · ${img.blend}` }));
      main.append(thumb, names);
      main.addEventListener('click', () => { state.activeImage = i; buildPanel(); paintChrome(); });
      row.appendChild(main);
      const remove = el('button', 'jg-icon-btn', { type: 'button', title: 'Retirer', 'aria-label': 'Retirer' });
      remove.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      remove.addEventListener('click', () => {
        state.images = state.images.filter((_, k) => k !== i);
        state.activeImage = Math.max(0, Math.min(state.activeImage, state.images.length - 1));
        buildPanel(); paintChrome();
      });
      row.appendChild(remove);
      cell.appendChild(row);
      box.appendChild(cell);
    });
    list.appendChild(box);
  }

  /* Import : le fichier est garde en base64, pour survivre a l'export. */
  const add = el('button', 'jg-add-stop', { type: 'button' });
  add.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Add image or logo</span>';
  const file = el('input', null, { type: 'file', accept: 'image/*' });
  file.style.display = 'none';
  file.addEventListener('change', () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.images = [...state.images, { ...IMAGE_DEFAULTS, src: String(reader.result), name: chosen.name.replace(/\.[^.]+$/, '') }];
      state.activeImage = state.images.length - 1;
      buildPanel();
      paintChrome();
    };
    reader.readAsDataURL(chosen);
    file.value = '';
  });
  add.addEventListener('click', () => file.click());
  list.append(add, file);
  if (!state.images.length) {
    list.appendChild(el('p', 'jg-bands-hint', { text: 'Deposez un logo ou une photo pour le poser sur le degrade.' }));
  }
  panel.appendChild(list);

  const img = state.images[state.activeImage];
  if (!img) return;

  const place = group('Placement');
  const rows = el('div', 'jg-finish-rows');
  rows.append(
    fieldRow('Size', dial({ label: '', value: Math.round(img.sizePct), min: 2, max: 100, format: (v) => `${v}%`, onInput: (v) => { img.sizePct = v; paintChrome(); } })),
    fieldRow('Rotate', dial({ label: '', value: Math.round(img.rotate), min: -180, max: 180, format: (v) => `${v}°`, onInput: (v) => { img.rotate = v; paintChrome(); } })),
    fieldRow('Opacity', dial({ label: '', value: Math.round(img.opacity), format: (v) => `${v}%`, onInput: (v) => { img.opacity = v; paintChrome(); } })),
  );
  place.appendChild(rows);
  place.appendChild(el('p', 'jg-subhead', { text: 'Blend' }));
  place.appendChild(shapePills(['normal', 'multiply', 'screen', 'overlay', 'luminosity'], img.blend, (blend) => {
    img.blend = blend;
    buildPanelSoon();
    paintChrome();
  }));
  place.appendChild(el('p', 'jg-bands-hint', { text: 'Glissez l’image directement sur le canvas pour la placer.' }));
  panel.appendChild(place);
}

/* ---------------------------------------------------------- vignettes */

/* Roue de couleurs des chips presets : un camembert net, comme l'original. */
function wheel(colors) {
  const slice = 100 / colors.length;
  const parts = colors.map((c, i) => `${c} ${(i * slice).toFixed(2)}% ${((i + 1) * slice).toFixed(2)}%`);
  return `conic-gradient(from 180deg, ${parts.join(', ')})`;
}

/* --------------------------------------------------------- arrangements */

const defaultArrangement = () => (PRESETS?.arrangements ?? [])[0] ?? null;

function applyArrangement(item, rebuild = true) {
  if (!item) return;
  state.lines = item.lines.map((line) => ({ ...line }));
  state.arrangementId = item.id;
  if (rebuild) { buildPanel(); draw(); }
}

/* Vignette d'arrangement : les memes traits, en petit, sur la palette du moment. */
function paintArrangementThumb(ctx, w, h, item) {
  import('./render/lines.js').then(({ paintLines }) => {
    paintLines(ctx, w, h, state.stops, state.divs, item.lines, state.time, true);
  });
}

/* ------------------------------------------------------------- actions */

function selectType(type) {
  state.type = type;
  state.spots = null;
  const list = PRESETS?.panel?.[type] ?? [];
  if (list.length) applyPreset(list[0]);
  else { buildPanel(); syncBands(); draw(); }
}

function applyPreset(preset) {
  state.presetId = preset.id;
  state.title = preset.e;
  state.stops = [...preset.stops];
  state.divs = preset.divs ? [...preset.divs] : null;
  state.spots = null;
  state.active = Math.min(state.active, preset.stops.length - 1);
  state.type = preset.type ?? state.type;
  if (preset.flow) state.flow = { ...FIELD_DEFAULTS.flow, speed: 30, ...preset.flow };
  if (preset.sky) state.sky = { ...FIELD_DEFAULTS.sky, ...preset.sky };
  if (preset.aurora) state.aurora = { ...FIELD_DEFAULTS.aurora, ...preset.aurora };
  if (preset.stripe) state.stripe = { ...FIELD_DEFAULTS.stripe, ...preset.stripe };
  if (preset.mesh) state.still = { ...FIELD_DEFAULTS.still, ...preset.mesh };
  if (preset.noise) state.noise = { ...FIELD_DEFAULTS.noise, ...preset.noise };
  if (preset.ring) state.ring = { ...FIELD_DEFAULTS.ring, ...preset.ring };
  if (preset.mist) state.mist = { ...FIELD_DEFAULTS.mist, ...preset.mist };
  if (preset.city) state.city = preset.city;
  if (typeof preset.horizon === 'number') state.horizon = preset.horizon;
  if (typeof preset.cover === 'number' || typeof preset.refract === 'number' || typeof preset.weave === 'number') {
    state.glassy = {
      ...FIELD_DEFAULTS.glassy,
      scale: preset.scale ?? FIELD_DEFAULTS.glassy.scale,
      cover: preset.cover ?? FIELD_DEFAULTS.glassy.cover,
      rings: preset.rings ?? FIELD_DEFAULTS.glassy.rings,
      weave: preset.weave ?? FIELD_DEFAULTS.glassy.weave,
      refract: preset.refract ?? FIELD_DEFAULTS.glassy.refract,
      shape: preset.shape ?? FIELD_DEFAULTS.glassy.shape,
    };
  }
  if (typeof preset.scale === 'number') state.scale = preset.scale;
  if (preset.ballStyle) state.ballStyle = preset.ballStyle;
  if (preset.form) state.form = { ...FIELD_DEFAULTS.form, ...preset.form };
  if (Array.isArray(preset.lines)) { state.lines = preset.lines.map((l) => ({ ...l })); state.arrangementId = preset.id; }
  else if (state.type === 'LINE' && !state.lines) applyArrangement(defaultArrangement(), false);
  if (preset.bars) state.bars = { ...preset.bars };
  else if (state.type === 'COLS') state.bars = { ...FIELD_DEFAULTS.COLS };
  else if (state.type === 'BARS') state.bars = { ...FIELD_DEFAULTS.BARS };
  else if (state.type === 'PRISM') state.bars = { ...FIELD_DEFAULTS.PRISM };
  if (typeof preset.soften === 'number') state.soften = preset.soften;
  if (typeof preset.grain === 'number') state.grain = preset.grain;
  if (typeof preset.speed === 'number') {
    if (state.type === 'SKY') state.sky = { ...state.sky, speed: preset.speed };
    else if (state.type === 'AURORA') state.aurora = { ...state.aurora, speed: preset.speed };
    else if (state.type === 'FLOW') state.flow = { ...state.flow, speed: preset.speed };
    else state.speed = preset.speed;
  } else if (!ANIMATED.has(state.type)) state.speed = 0;
  const texts = textsFromPreset(preset);
  if (texts.length || preset.title || preset.texts) { state.texts = texts; state.activeText = 0; }
  buildPanel();
  syncBands();
  draw();
}

function setStop(index, hex, live) {
  state.stops = state.stops.map((c, i) => (i === index ? hex : c));
  state.title = 'Untitled blend';
  state.presetId = null;
  draw({ draft: live });
  if (!live) buildPanel();
}

function addStop() {
  const last = state.stops[state.stops.length - 1];
  const prev = state.stops[state.stops.length - 2] ?? last;
  state.stops = [...state.stops, mix(prev, last, 1.35)];
  state.divs = null;
  buildPanel();
  syncBands();
  draw();
}

function removeStop(index) {
  if (state.stops.length <= 2) return;
  state.stops = state.stops.filter((_, i) => i !== index);
  state.divs = null;
  state.spots = null;
  state.active = Math.min(state.active, state.stops.length - 1);
  buildPanel();
  syncBands();
  draw();
}

function setField(bucket, key, value) {
  state[bucket] = { ...state[bucket], [key]: value };
  draw({ draft: true });
}

function shuffleColors() {
  const next = [...state.stops];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  state.stops = next;
  state.title = 'Untitled blend';
  buildPanel();
  draw();
}

function rollPreset() {
  const list = PRESETS?.panel?.[state.type] ?? [];
  if (!list.length) return;
  applyPreset(list[Math.floor(Math.random() * list.length)]);
}

/* ---------------------------------------------------------- les bandes */

/* Les poignees suivent le nombre de couleurs : on les rebatit a chaque changement. */
function syncBands() { state.rebuildBands?.(); }

function mountBands() {
  const track = dom.bandsTrack;
  const rebuild = () => {
    track.querySelectorAll('.jg-bands-handle').forEach((n) => n.remove());
    const edges = bounds(state.stops.length, state.divs);
    for (let i = 1; i < edges.length - 1; i++) {
      const handle = el('div', 'jg-bands-handle', { tabindex: '0', role: 'slider', 'aria-label': `Coupure ${i}` });
      handle.style.left = `${edges[i] * 100}%`;
      handle.appendChild(el('i'));
      handle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);
        const move = (ev) => {
          const rect = track.getBoundingClientRect();
          const t = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
          const current = bounds(state.stops.length, state.divs).slice(1, -1);
          const min = i === 1 ? 0.02 : current[i - 2] + 0.02;
          const max = i === current.length ? 0.98 : current[i] - 0.02;
          current[i - 1] = Math.min(max, Math.max(min, t));
          state.divs = current;
          handle.style.left = `${current[i - 1] * 100}%`;
          draw({ draft: true });
        };
        const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); rebuild(); draw(); };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
      });
      track.appendChild(handle);
    }
  };
  track.addEventListener('click', (event) => {
    if (event.target.closest('.jg-bands-handle')) return;
    const rect = track.getBoundingClientRect();
    const t = (event.clientX - rect.left) / rect.width;
    const edges = bounds(state.stops.length, state.divs);
    const i = edges.findIndex((e, k) => k < edges.length - 1 && t >= e && t < edges[k + 1]);
    if (i >= 0) { state.active = i; buildPanel(); paintChrome(); }
  });
  state.rebuildBands = rebuild;
  rebuild();
}

/* -------------------------------------------------------------- entete */

function mountHeader() {
  const modes = [
    { id: 'studio', label: 'Studio' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'palette', label: 'Palette' },
    { id: 'saved', label: 'Saved' },
  ];
  dom.modes.innerHTML = '';
  for (const mode of modes) {
    const b = el('button', 'jg-mode', { type: 'button', text: mode.label });
    b.dataset.on = String(state.mode === mode.id);
    b.addEventListener('click', () => setMode(mode.id));
    dom.modes.appendChild(b);
  }
  dom.theme.addEventListener('click', () => {
    state.dark = !state.dark;
    dom.root.toggleAttribute('data-dark', state.dark);
    dom.theme.setAttribute('aria-checked', String(state.dark));
    dom.themeKnob.textContent = state.dark ? '☾' : '☀';
    paintChrome();
  });
  dom.themeKnob.textContent = '☀';
}

function setMode(mode) {
  state.mode = mode;
  dom.modes.querySelectorAll('.jg-mode').forEach((b, i) => {
    b.dataset.on = String(['studio', 'gallery', 'palette', 'saved'][i] === mode);
  });
  const studio = mode === 'studio';
  dom.studio.hidden = !studio;
  dom.page.hidden = studio;
  if (!studio) buildPage();
  else draw();
}

/* Gallery / Palette / Saved partagent la meme grille de cartes. */
function buildPage() {
  dom.page.innerHTML = '';
  const title = { gallery: 'Gallery', palette: 'Palette', saved: 'Saved' }[state.mode];
  const head = el('div', 'jg-group-head');
  head.appendChild(el('h4', null, { text: title }));
  dom.page.appendChild(head);

  const grid = el('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px';
  const items = state.mode === 'gallery' ? (PRESETS?.gallery ?? [])
    : state.mode === 'palette' ? (PRESETS?.colorways ?? [])
      : loadSaved();

  if (!items.length) {
    dom.page.appendChild(el('span', 'jg-dim', { text: 'Rien ici pour le moment.' }));
    return;
  }

  for (const item of items) {
    const card = el('button', 'jg-grad-card', { type: 'button' });
    card.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:0;border:0;background:none;text-align:left';
    const art = el('div');
    art.style.cssText = 'height:150px;border-radius:16px;box-shadow:var(--jg-shadow);overflow:hidden';
    const canvas = el('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    art.appendChild(canvas);
    const label = el('span');
    label.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:12.5px';
    label.append(el('strong', null, { text: item.e ?? item.name }),
      el('span', 'jg-dim', { text: item.type ? TYPE_NAMES[item.type] : `${item.stops.length} tons` }));
    card.append(art, label);
    card.addEventListener('click', () => {
      applyPreset({ ...item, e: item.e ?? item.name, type: item.type ?? state.type });
      setMode('studio');
    });
    grid.appendChild(card);
    schedule(() => {
      canvas.width = 210; canvas.height = 150;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const preview = { ...state, type: item.type ?? 'FLOW', stops: item.stops, divs: item.divs ?? null, spots: null, flow: { ...FIELD_DEFAULTS.flow, ...(item.flow ?? {}) } };
      import('./render/index.js').then(({ paint }) => paint(ctx, 210, 150, preview));
    });
  }
  dom.page.appendChild(grid);
}

/* ------------------------------------------------------------ sauvegarde */

const SAVE_KEY = 'gradient-builder:saved';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch { return []; }
}

function saveCurrent() {
  const list = loadSaved();
  list.unshift({
    id: `s${Date.now()}`, e: state.title, type: state.type,
    stops: [...state.stops], divs: state.divs, flow: { ...state.flow },
  });
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(list.slice(0, 60))); } catch { /* quota */ }
  flash(document.getElementById('jg-save'), 'Saved');
}

function flash(button, text) {
  const before = button.textContent;
  button.textContent = text;
  setTimeout(() => { button.textContent = before; }, 1200);
}

/* ---------------------------------------------------------------- export */

/* Le rendu d'export refait la scene a la taille demandee, grain compris. */
export function exportCanvas(width = 1600, height = 1000) {
  const base = renderTo(width, height, state);
  const out = document.createElement('canvas');
  out.width = width; out.height = height;
  const ctx = out.getContext('2d');
  if (state.soften > 0) ctx.filter = `blur(${(state.soften * width) / dom.surface.clientWidth}px)`;
  ctx.drawImage(base, 0, 0);
  ctx.filter = 'none';

  if (state.grain > 0) {
    const tile = document.createElement('canvas');
    tile.width = 256; tile.height = 256;
    const tctx = tile.getContext('2d');
    const img = tctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = (state.grain / 100) * GRAIN_STRENGTH;
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  /* Les images posees, avant le texte : le texte reste toujours lisible. */
  for (const img of state.images) {
    if (!img.src || !img.element) continue;
    const drawn = img.element;
    const natural = drawn.naturalWidth || drawn.width || 1;
    const ratio = (drawn.naturalHeight || drawn.height || 1) / natural;
    const iw = (img.sizePct / 100) * width;
    const ih = iw * ratio;
    ctx.save();
    ctx.globalAlpha = img.opacity / 100;
    ctx.globalCompositeOperation = img.blend === 'normal' ? 'source-over' : img.blend;
    ctx.translate((img.x / 100) * width, (img.y / 100) * height);
    if (img.rotate) ctx.rotate((img.rotate * Math.PI) / 180);
    ctx.drawImage(drawn, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  }

  for (const t of state.texts) {
    if (!t.content) continue;
    ctx.save();
    ctx.translate((t.x / 100) * width, (t.y / 100) * height);
    if (t.rotate) ctx.rotate((t.rotate * Math.PI) / 180);
    const px = (t.sizePct / 100) * height;
    ctx.font = `${t.bold ? '700' : '400'} ${px}px ${t.family}`;
    ctx.fillStyle = t.ink === 'auto' ? inkForPalette(state.stops) : t.ink;
    ctx.textAlign = t.align;
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = `${t.letter}em`;
    const lines = String(t.content).split('\n');
    const lead = px * 1.2;
    lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lead));
    ctx.restore();
  }
  return out;
}

/* ------------------------------------------------------- feuille export */

const EXPORT_FORMATS = ['PNG', 'SVG', 'CSS', 'JSON', 'Video'];
let exportFormat = 0;
let exportSize = 0;

function openSheet(title, build) {
  dom.sheetTitle.textContent = title;
  dom.sheetBody.innerHTML = '';
  build(dom.sheetBody);
  dom.scrim.hidden = false;
}

function closeSheet() { dom.scrim.hidden = true; }

function buildExportSheet(body) {
  body.appendChild(segment({
    items: EXPORT_FORMATS.map((label) => ({ label })),
    active: exportFormat,
    onSelect: (i) => { exportFormat = i; openSheet('Export', buildExportSheet); },
  }));

  const format = EXPORT_FORMATS[exportFormat];
  const raster = format === 'PNG' || format === 'SVG' || format === 'Video';

  if (raster) {
    const sizes = group('Taille');
    sizes.appendChild(segment({
      items: SIZES.map((s) => ({ label: s.label })),
      active: exportSize,
      onSelect: (i) => { exportSize = i; openSheet('Export', buildExportSheet); },
    }));
    sizes.appendChild(el('p', 'jg-sheet-note', { text: `${SIZES[exportSize].w} × ${SIZES[exportSize].h} px` }));
    body.appendChild(sizes);
  }

  if (format === 'PNG') {
    const preview = el('div', 'jg-sheet-preview');
    body.appendChild(preview);
    schedule(() => {
      const canvas = exportCanvas(420, 260);
      canvas.style.cssText = 'width:100%;height:100%';
      preview.appendChild(canvas);
    });
    body.appendChild(actionRow('Telecharger le PNG', () => {
      const { w, h } = SIZES[exportSize];
      exportCanvas(w, h).toBlob((blob) => download(blob, fileName(state, 'png')), 'image/png');
    }));
  }

  if (format === 'SVG') {
    const vector = VECTOR_TYPES.has(state.type);
    body.appendChild(el('p', 'jg-sheet-note', {
      text: vector
        ? 'Ce type sort en vrais chemins : le fichier reste modifiable dans Figma ou Illustrator.'
        : `Le type ${TYPE_NAMES[state.type]} est calcule pixel par pixel : le SVG embarque le rendu en image.`,
    }));
    body.appendChild(actionRow('Telecharger le SVG', () => {
      const { w, h } = SIZES[exportSize];
      const raster = VECTOR_TYPES.has(state.type) ? '' : exportCanvas(w, h).toDataURL('image/png');
      const svg = toSvg(state, w, h, raster, PRESETS?.shapes, PRESETS?.cities);
      download(new Blob([svg], { type: 'image/svg+xml' }), fileName(state, 'svg'));
    }));
  }

  if (format === 'CSS' || format === 'JSON') {
    const code = format === 'CSS' ? toCss(state) : toJson(state);
    const block = el('pre', 'jg-sheet-code', { text: code });
    body.appendChild(block);
    if (format === 'CSS') {
      body.appendChild(el('p', 'jg-sheet-note', {
        text: 'Le CSS donne l’equivalent le plus proche avec les gradients natifs — il ne rejoue pas le moteur.',
      }));
    }
    const row = el('div', 'jg-sheet-btns');
    const copy = el('button', 'jg-primary-btn', { type: 'button', text: 'Copier' });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code); flash(copy, 'Copie'); }
      catch { flash(copy, 'Refuse'); }
    });
    const save = el('button', 'jg-ghost-btn', { type: 'button', text: 'Telecharger' });
    save.addEventListener('click', () => {
      const type = format === 'CSS' ? 'text/css' : 'application/json';
      download(new Blob([code], { type }), fileName(state, format.toLowerCase()));
    });
    row.append(copy, save);
    body.appendChild(row);
  }

  if (format === 'Video') {
    const codec = pickVideoFormat();
    if (!codec) {
      body.appendChild(el('p', 'jg-sheet-note', { text: 'Ce navigateur ne sait pas enregistrer de video.' }));
      return;
    }
    const animated = ANIMATED.has(state.type);
    body.appendChild(el('p', 'jg-sheet-note', {
      text: animated
        ? `Enregistrement du canvas anime, en ${codec.label}. La vitesse suit le curseur Speed.`
        : `Le type ${TYPE_NAMES[state.type]} ne s’anime pas : la video sera une image fixe. Choisissez Sky ou Aurora pour un rendu vivant.`,
    }));
    const rows = el('div', 'jg-finish-rows');
    const settings = { seconds: 6, fps: 30 };
    rows.append(
      fieldRow('Duree', dial({ label: '', value: settings.seconds, min: 2, max: 20, format: (v) => `${v}s`, onInput: (v) => { settings.seconds = v; } })),
      fieldRow('Images/s', dial({ label: '', value: settings.fps, min: 12, max: 60, format: (v) => String(v), onInput: (v) => { settings.fps = v; } })),
    );
    body.appendChild(rows);
    const record = el('button', 'jg-primary-btn', { type: 'button', text: 'Enregistrer' });
    record.addEventListener('click', async () => {
      record.disabled = true;
      const label = record.textContent;
      try {
        const { blob, format: used } = await recordCanvas(dom.canvas, {
          seconds: settings.seconds,
          fps: settings.fps,
          onProgress: (p) => { record.textContent = `Enregistrement… ${Math.round(p * 100)}%`; },
        });
        download(blob, fileName(state, used.ext));
        record.textContent = label;
      } catch (error) {
        record.textContent = String(error.message || error);
      } finally {
        record.disabled = false;
      }
    });
    const row = el('div', 'jg-sheet-btns');
    row.appendChild(record);
    body.appendChild(row);
  }
}

function actionRow(label, run) {
  const row = el('div', 'jg-sheet-btns');
  const button = el('button', 'jg-primary-btn', { type: 'button', text: label });
  button.addEventListener('click', run);
  row.appendChild(button);
  return row;
}


/* ------------------------------------------------- pont avec VibeOS */

const EMBED = new URLSearchParams(location.search).get('embed');

function sendBackground() {
  const canvas = exportCanvas(1600, 1000);
  parent.postMessage({
    source: 'gradient-builder',
    type: 'gradient:use-background',
    payload: {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      colors: [...state.stops],
      gradientType: state.type,
      title: state.title,
    },
  }, location.origin);
}

window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.source !== 'vibefx') return;
  if (data.type === 'vibefx:capture-gradient') {
    try { sendBackground(); }
    catch (error) { parent.postMessage({ source: 'gradient-builder', type: 'gradient:error', message: String(error) }, location.origin); }
  }
});

/* ------------------------------------------------------------ demarrage */

function mountCanvasInteractions() {
  dom.tags.addEventListener('click', () => {
    state.tags = !state.tags;
    dom.tags.dataset.on = String(state.tags);
    dom.tags.querySelector('span span').textContent = state.tags ? 'Hide tags' : 'Show tags';
    drawTags();
  });

  document.getElementById('jg-expand').addEventListener('click', (event) => {
    event.stopPropagation();
    if (document.fullscreenElement) document.exitFullscreen();
    else dom.surface.requestFullscreen?.();
  });
  document.getElementById('jg-dice').addEventListener('click', rollPreset);
  document.getElementById('jg-shuffle').addEventListener('click', shuffleColors);
  document.getElementById('jg-save').addEventListener('click', saveCurrent);
  document.getElementById('jg-share').addEventListener('click', async () => {
    const url = new URL(location.href);
    url.searchParams.set('c', state.stops.map((c) => c.slice(1)).join('-'));
    url.searchParams.set('t', state.type);
    try { await navigator.clipboard.writeText(url.toString()); flash(document.getElementById('jg-share'), 'Copied'); }
    catch { /* clipboard refuse */ }
  });
  document.getElementById('jg-preview').addEventListener('click', () => dom.surface.requestFullscreen?.());
  document.getElementById('jg-export').addEventListener('click', () => {
    if (EMBED) sendBackground(); else openSheet('Export', buildExportSheet);
  });
  document.getElementById('jg-sheet-close').addEventListener('click', closeSheet);
  dom.scrim.addEventListener('click', (event) => { if (event.target === dom.scrim) closeSheet(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !dom.scrim.hidden) closeSheet(); });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    draw({ draft: true });
    resizeTimer = setTimeout(() => draw(), 200);
  });
}

/* Etat repris depuis l'URL partagee, si presente. */
function readShareUrl() {
  const params = new URLSearchParams(location.search);
  const c = params.get('c');
  const t = params.get('t');
  if (t && TYPE_NAMES[t]) state.type = t;
  if (c) {
    const list = c.split('-').filter((x) => /^[0-9a-f]{6}$/i.test(x)).map((x) => `#${x.toUpperCase()}`);
    if (list.length >= 2) { state.stops = list; state.title = 'Shared blend'; state.presetId = null; }
  }
}

async function boot() {
  await loadNames();
  const res = await fetch(new URL('./data/presets.json', import.meta.url));
  PRESETS = await res.json();
  loadShapes(PRESETS.shapes ?? {});
  loadCities(PRESETS.cities ?? {});
  readShareUrl();
  dom.grain.style.backgroundImage = `url(${grainTexture()})`;
  if (EMBED) document.getElementById('jg-export').textContent = 'Utiliser comme fond';
  mountHeader();
  mountBands();
  mountCanvasInteractions();
  buildPanel();
  draw();
  parent.postMessage({ source: 'gradient-builder', type: 'gradient:ready' }, location.origin);
}

boot();
