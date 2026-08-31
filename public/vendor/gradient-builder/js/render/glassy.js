/*
 * GLASSY — une grille de tuiles de verre posees sur un fond flou.
 *
 * Le fond est peint a part : trois nappes de couleur, puis un gros flou. Chaque
 * tuile redecoupe ce fond avec un leger decalage — c'est ce decalage qui imite
 * la refraction. Par-dessus viennent le voile blanc du verre, le reflet en
 * haut, l'ombre en bas, et le liseré de bord.
 */

import { sample, sampleRgb, rgbCss, rgba, clamp, smoothstep } from '../color.js';

export const GLASSY_FIELD = {
  scale: 50, cover: 100, rings: 50, weave: 50, refract: 55, shape: 'square', warp: 0, blocks: 50,
};

const REFRACT = 0.08;        // decalage maximal du fond dans une tuile
const FILM_BASE = 0.06;      // voile blanc de fond
const FILM_PAPER = 0.12;     // voile ajoute la ou le fond est clair
const FILM_JITTER = 0.05;
const FILM_HIGH = 0.24;
const SHADE_LOW = 0.14;
const FILM_PULSE = 0.02;
const SHEEN = 0.22;          // reflet superieur
const EDGE_LIGHT = 0.16;
const TINT = 0.06;
const FOOT = 0.06;           // ombre au pied de la tuile
const RIM = 0.42;
const BACK_ALPHA = 0.48;
const BACK_BLUR = 0.4;
const DROP_ALPHA = 0.17;
const DROP_BLUR = 0.085;
const DROP_OFFSET = 0.05;
const BREATHE = 0.006;
const OPEN = 0.9;            // duree d'apparition des tuiles
const OPEN_SPREAD = 0.24;
const BASE_TIME = 20.75;

const clamp01 = (v) => clamp(v, 0, 1);
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v) };

/* ------------------------------------------------------ formes de tuile */

/* Polygone aux angles adoucis. */
function roundPoly(points, radius) {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const cur = points[i];
    const prev = points[(i + n - 1) % n];
    const next = points[(i + 1) % n];
    const inX = cur[0] - prev[0], inY = cur[1] - prev[1];
    const outX = next[0] - cur[0], outY = next[1] - cur[1];
    const inLen = Math.hypot(inX, inY) || 1;
    const outLen = Math.hypot(outX, outY) || 1;
    const a = Math.min(radius, inLen / 2) / inLen;
    const b = Math.min(radius, outLen / 2) / outLen;
    d += `${i === 0 ? 'M' : 'L'}${(cur[0] - inX * a).toFixed(2)} ${(cur[1] - inY * a).toFixed(2)}`
      + `Q${cur[0].toFixed(2)} ${cur[1].toFixed(2)} ${(cur[0] + outX * b).toFixed(2)} ${(cur[1] + outY * b).toFixed(2)}`;
  }
  return `${d}Z`;
}

export const TILE_SHAPES = ['square', 'circle', 'hex', 'clover', 'flower', 'scallop', 'heart', 'star', 'leaf', 'drop'];

export function tilePath(shape, w, h, radius) {
  const unit = Math.min(w, h);
  const f = (v) => v.toFixed(2);

  if (shape === 'circle') {
    return `M${f(w / 2)} 0A${f(w / 2)} ${f(h / 2)} 0 1 1 ${f(w / 2)} ${f(h)}A${f(w / 2)} ${f(h / 2)} 0 1 1 ${f(w / 2)} 0Z`;
  }
  if (shape === 'hex') {
    return roundPoly([[w * 0.5, 0], [w, h * 0.25], [w, h * 0.75], [w * 0.5, h], [0, h * 0.75], [0, h * 0.25]], unit * 0.12);
  }
  if (shape === 'heart') {
    return `M${f(w * 0.5)} ${f(h * 0.9)}C${f(w * 0.13)} ${f(h * 0.66)} ${f(w * 0.02)} ${f(h * 0.42)} ${f(w * 0.08)} ${f(h * 0.26)}`
      + `C${f(w * 0.13)} ${f(h * 0.12)} ${f(w * 0.27)} ${f(h * 0.05)} ${f(w * 0.38)} ${f(h * 0.09)}`
      + `C${f(w * 0.44)} ${f(h * 0.11)} ${f(w * 0.48)} ${f(h * 0.15)} ${f(w * 0.5)} ${f(h * 0.2)}`
      + `C${f(w * 0.52)} ${f(h * 0.15)} ${f(w * 0.56)} ${f(h * 0.11)} ${f(w * 0.62)} ${f(h * 0.09)}`
      + `C${f(w * 0.73)} ${f(h * 0.05)} ${f(w * 0.87)} ${f(h * 0.12)} ${f(w * 0.92)} ${f(h * 0.26)}`
      + `C${f(w * 0.98)} ${f(h * 0.42)} ${f(w * 0.87)} ${f(h * 0.66)} ${f(w * 0.5)} ${f(h * 0.9)}Z`;
  }
  if (shape === 'star') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 1 : 0.5;
      pts.push([w / 2 + Math.cos(a) * (w / 2) * r, h / 2 + Math.sin(a) * (h / 2) * r]);
    }
    return roundPoly(pts, unit * 0.06);
  }
  if (shape === 'clover') {
    const l = f(w * 0.28), r = f(w * 0.72), t = f(h * 0.28), b = f(h * 0.72);
    const rx = f(w * 0.22), ry = f(h * 0.22);
    return `M${l} ${t}A${rx} ${ry} 0 1 1 ${r} ${t}A${rx} ${ry} 0 1 1 ${r} ${b}A${rx} ${ry} 0 1 1 ${l} ${b}A${rx} ${ry} 0 1 1 ${l} ${t}Z`;
  }
  if (shape === 'flower' || shape === 'scallop') {
    const lobes = shape === 'flower' ? 6 : 12;
    const reach = shape === 'flower' ? 0.32 : 0.42;
    const bulge = shape === 'flower' ? 0.19 : 0.13;
    const sweep = shape === 'flower' ? 1 : 0;
    const rx = f(bulge * w), ry = f(bulge * h);
    let d = '';
    for (let i = 0; i <= lobes; i++) {
      const a = -Math.PI / 2 + ((i % lobes) * Math.PI * 2) / lobes;
      const x = f(w / 2 + Math.cos(a) * reach * w);
      const y = f(h / 2 + Math.sin(a) * reach * h);
      d += i === 0 ? `M${x} ${y}` : `A${rx} ${ry} 0 ${sweep} 1 ${x} ${y}`;
    }
    return `${d}Z`;
  }
  if (shape === 'leaf') {
    return `M${f(w * 0.14)} ${f(h * 0.86)}A${f(w * 0.54)} ${f(h * 0.54)} 0 0 1 ${f(w * 0.86)} ${f(h * 0.14)}`
      + `A${f(w * 0.54)} ${f(h * 0.54)} 0 0 1 ${f(w * 0.14)} ${f(h * 0.86)}Z`;
  }
  if (shape === 'drop') {
    return `M${f(w * 0.5)} ${f(h * 0.05)}C${f(w * 0.63)} ${f(h * 0.24)} ${f(w * 0.87)} ${f(h * 0.4)} ${f(w * 0.87)} ${f(h * 0.61)}`
      + `A${f(w * 0.37)} ${f(h * 0.34)} 0 1 1 ${f(w * 0.13)} ${f(h * 0.61)}`
      + `C${f(w * 0.13)} ${f(h * 0.4)} ${f(w * 0.37)} ${f(h * 0.24)} ${f(w * 0.5)} ${f(h * 0.05)}Z`;
  }
  const r = Math.min(radius, w / 2, h / 2);
  return `M${f(r)} 0H${f(w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(h - r)}`
    + `A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)}H${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)}V${f(r)}`
    + `A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z`;
}

/* ------------------------------------------------------------- grille */

/* Nombre de tuiles et taille de cellule, deduits des curseurs. */
function tileGrid(w, h, scale, weave, rings, cover) {
  const unit = Math.min(w, h) / (4 + 0.09 * clamp(scale, 0, 100));
  const cellW = unit * (0.6 + 0.008 * clamp(weave, 0, 100));
  const cellH = unit * (0.6 + 0.008 * clamp(rings, 0, 100));
  const fill = 0.42 + 0.0068 * clamp(cover, 0, 100);
  const cols = Math.max(3, Math.round((w * fill) / cellW));
  const rows = Math.max(3, Math.round((h * fill) / cellH));
  return { cols, rows, tw: cellW, th: cellH, x0: (w - cols * cellW) / 2, y0: (h - rows * cellH) / 2 };
}

/* Trois nappes de couleur derriere le verre. */
function backdropSpots(grid, w, h, time, colors, divs, cover) {
  const cx = w / 2, cy = h / 2;
  const halfW = (grid.cols * grid.tw) / 2;
  const halfH = (grid.rows * grid.th) / 2;
  const k = 0.95 + 0.3 * clamp01(cover / 100);
  return [
    { x: cx + halfW * k * (0.4 + 0.03 * Math.sin(time * 0.42 + 2.1)), y: cy - halfH * k * (0.34 + 0.03 * Math.cos(time * 0.5 + 0.7)), rx: halfW * k * 0.56, ry: halfH * k * 0.6, c0: sampleRgb(colors, divs, 0.3), c1: sampleRgb(colors, divs, 0.55) },
    { x: cx - halfW * k * (0.26 + 0.03 * Math.sin(time * 0.5)), y: cy + halfH * k * (0.1 + 0.03 * Math.cos(time * 0.44 + 1.3)), rx: halfW * k * 0.75, ry: halfH * k * 0.8, c0: sampleRgb(colors, divs, 0.1), c1: sampleRgb(colors, divs, 0.42) },
    { x: cx + halfW * k * (0.06 + 0.03 * Math.cos(time * 0.38 + 0.4)), y: cy + halfH * k * (0.38 + 0.03 * Math.sin(time * 0.46 + 2.6)), rx: halfW * k * 0.52, ry: halfH * k * 0.46, c0: sampleRgb(colors, divs, 0), c1: sampleRgb(colors, divs, 0.18) },
  ];
}

/* Combien une position est-elle « papier » (loin des nappes) ? */
function paperAt(spots, x, y) {
  let cover = 0;
  for (const spot of spots) {
    const d = Math.hypot((x - spot.x) / spot.rx, (y - spot.y) / spot.ry);
    cover = Math.max(cover, clamp01((1 - d) / 0.5));
  }
  return 1 - cover;
}

function paintBackdrop(ctx, w, h, colors, divs, spots) {
  ctx.fillStyle = rgbCss(sampleRgb(colors, divs, 1));
  ctx.fillRect(0, 0, w, h);
  for (const spot of spots) {
    const squash = Math.max(0.08, spot.ry / Math.max(1, spot.rx));
    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.scale(1, squash);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, spot.rx);
    const c0 = spot.c0.map((v) => v | 0);
    const c1 = spot.c1.map((v) => v | 0);
    grad.addColorStop(0, `rgba(${c0[0]},${c0[1]},${c0[2]},1)`);
    grad.addColorStop(0.5, `rgba(${c1[0]},${c1[1]},${c1[2]},0.95)`);
    grad.addColorStop(0.8, `rgba(${c1[0]},${c1[1]},${c1[2]},0.5)`);
    grad.addColorStop(1, `rgba(${c1[0]},${c1[1]},${c1[2]},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(-spot.rx, -spot.rx, spot.rx * 2, spot.rx * 2);
    ctx.restore();
  }
}

/* Liste des tuiles, avec leur voile et leur apparition. */
function tileList(grid, w, h, time, spots, refract) {
  const opened = clamp01((time - (BASE_TIME - OPEN)) / OPEN);
  const reachX = Math.max(1, ((grid.cols * grid.tw) / 2) * 1.2);
  const reachY = Math.max(1, ((grid.rows * grid.th) / 2) * 1.2);
  const out = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const x = grid.x0 + (c + 0.5) * grid.tw;
      const y = grid.y0 + (r + 0.5) * grid.th;
      const paper = paperAt(spots, x, y);
      const seed = hash(r + 29, c + 61);
      const pulse = FILM_PULSE * Math.sin(time * 1.1 + seed * Math.PI * 2);
      const gain = Math.pow(refract, 1.3);
      const luck = hash(r * 3 + 7, c * 5 + 31);
      const bright = smoothstep((luck - 0.62) / 0.38) * FILM_HIGH;
      const shade = smoothstep((0.38 - luck) / 0.38) * SHADE_LOW * (1 - paper * 0.7);
      const film = clamp01((FILM_BASE + FILM_PAPER * smoothstep((paper - 0.45) / 0.55)
        + (seed - 0.5) * 2 * FILM_JITTER + bright) * gain + pulse);

      let alpha = 1;
      if (opened < 1) {
        /* Les tuiles apparaissent du centre vers les bords, en desordre. */
        const distance = clamp01(Math.hypot((x - w / 2) / reachX, (y - h / 2) / reachY) * 0.75 + hash(r + 3, c + 17) * 0.25);
        alpha = smoothstep((opened - distance * (1 - OPEN_SPREAD)) / OPEN_SPREAD);
        if (alpha <= 0.01) continue;
      }
      out.push({ x: grid.x0 + c * grid.tw, y: grid.y0 + r * grid.th, r, c, paper, film, shade, alpha, pop: alpha });
    }
  }
  return out;
}

/* Deformation en boule : les tuiles du bord s'ecrasent vers le centre. */
function bulge(x, y, w, h, amount) {
  const strength = clamp(amount, -100, 100) / 100 * (amount >= 0 ? 0.6 : 0.45);
  if (Math.abs(strength) < 0.001) return { x, y, a: 1, b: 0, c: 0, d: 1 };
  const cx = w / 2, cy = h / 2;
  const reach = Math.max(1, Math.hypot(cx, cy));
  const dx = x - cx, dy = y - cy;
  const dist = Math.hypot(dx, dy);
  const t = (dist / reach) ** 2;
  const denom = 1 + strength * t;
  const along = clamp((1 + strength) / denom, 0.3, 1.8);
  const across = clamp(((1 + strength) * (1 - strength * t)) / (denom * denom), 0.22, 1.8);
  const ux = dist > 0.001 ? dx / dist : 1;
  const uy = dist > 0.001 ? dy / dist : 0;
  const skew = (across - along) * ux * uy;
  return {
    x: cx + dx * along, y: cy + dy * along,
    a: across * ux * ux + along * uy * uy, b: skew, c: skew, d: across * uy * uy + along * ux * ux,
  };
}

let backCanvas = null;
let dropCanvas = null;

export function paintGlassy(ctx, w, h, colors, divs, field = GLASSY_FIELD, time = BASE_TIME) {
  const f = { ...GLASSY_FIELD, ...(field ?? {}) };
  const refract = clamp(f.refract, 0, 100) / 50;
  const grid = tileGrid(w, h, f.scale, f.weave, f.rings, f.cover);
  const unit = Math.min(grid.tw, grid.th);

  /* Marge interieure : les tuiles ne se touchent pas tout a fait. */
  const inset = 0.115 - 0.09 * clamp01(f.scale / 100);
  const tileW = grid.tw * (1 - inset);
  const tileH = grid.th * (1 - inset);
  const padX = (grid.tw - tileW) / 2;
  const padY = (grid.th - tileH) / 2;
  const radius = Math.min(tileW, tileH) * (0.22 - 0.1 * clamp01(f.scale / 100));
  const shape = new Path2D(tilePath(f.shape ?? 'square', tileW, tileH, radius));

  const spots = backdropSpots(grid, w, h, time, colors, divs, f.cover);
  const tiles = tileList(grid, w, h, time, spots, refract);
  const ink = sample(colors, divs, 0);

  backCanvas = backCanvas ?? document.createElement('canvas');
  if (backCanvas.width !== w) backCanvas.width = w;
  if (backCanvas.height !== h) backCanvas.height = h;
  const back = backCanvas.getContext('2d');
  back.setTransform(1, 0, 0, 1, 0, 0);
  back.globalAlpha = 1;
  back.filter = 'none';
  paintBackdrop(back, w, h, colors, divs, spots);

  /* Le fond visible entre les tuiles : la meme image, tres floue. */
  ctx.fillStyle = rgbCss(sampleRgb(colors, divs, 1));
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = BACK_ALPHA;
  ctx.filter = `blur(${(2 * unit * BACK_BLUR).toFixed(1)}px)`;
  ctx.drawImage(backCanvas, 0, 0);
  ctx.restore();

  /* Ombre portee du pave de verre, seulement quand les tuiles sont larges. */
  const dropAlpha = DROP_ALPHA * smoothstep((88 - f.scale) / 34);
  if (dropAlpha > 0.005) {
    dropCanvas = dropCanvas ?? document.createElement('canvas');
    if (dropCanvas.width !== w) dropCanvas.width = w;
    if (dropCanvas.height !== h) dropCanvas.height = h;
    const drop = dropCanvas.getContext('2d');
    drop.setTransform(1, 0, 0, 1, 0, 0);
    drop.globalAlpha = 1;
    drop.filter = 'none';
    drop.clearRect(0, 0, w, h);
    for (const tile of tiles) {
      const grow = 0.82 + 0.18 * tile.pop;
      const at = bulge(tile.x + padX + tileW / 2, tile.y + padY + tileH / 2, w, h, f.warp ?? 0);
      drop.save();
      drop.translate(at.x, at.y + unit * DROP_OFFSET);
      drop.transform(at.a, at.b, at.c, at.d, 0, 0);
      drop.scale(grow, grow);
      drop.translate(-tileW / 2, -tileH / 2);
      drop.globalAlpha = tile.alpha * dropAlpha * (1 - tile.paper * 0.6);
      drop.fillStyle = ink;
      drop.fill(shape);
      drop.restore();
    }
    ctx.filter = `blur(${(2 * unit * DROP_BLUR).toFixed(1)}px)`;
    ctx.drawImage(dropCanvas, 0, 0);
    ctx.filter = 'none';
  }

  /* Habillage du verre, prepare une fois pour toutes les tuiles. */
  const sheenTop = Math.min(0.42, SHEEN * (0.55 + 0.45 * refract));
  const sheen = ctx.createLinearGradient(0, 0, 0, tileH);
  sheen.addColorStop(0, `rgba(255,255,255,${sheenTop.toFixed(3)})`);
  sheen.addColorStop(0.32, 'rgba(255,255,255,0.03)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  const tint = ctx.createLinearGradient(0, 0, tileW, tileH);
  tint.addColorStop(0, rgba(ink, 0));
  tint.addColorStop(0.55, rgba(ink, 0));
  tint.addColorStop(1, rgba(ink, TINT));
  const rim = ctx.createLinearGradient(0, 0, tileW, tileH);
  rim.addColorStop(0, `rgba(255,255,255,${RIM})`);
  rim.addColorStop(0.45, 'rgba(255,255,255,0.14)');
  rim.addColorStop(1, rgba(ink, 0.12));
  const foot = ctx.createLinearGradient(0, tileH * 0.72, 0, tileH);
  foot.addColorStop(0, rgba(ink, 0));
  foot.addColorStop(1, rgba(ink, FOOT));

  /* Combien du fond une tuile montre : moins que sa taille, donc grossi. */
  const zoom = Math.max(0.15, 1 - 0.0088 * clamp(f.blocks ?? 50, 0, 100));
  const sampleW = tileW * zoom;
  const sampleH = tileH * zoom;

  for (const tile of tiles) {
    const grow = 0.82 + 0.18 * tile.pop;
    const breathe = 1 + BREATHE * Math.sin(time * 1.1 + hash(tile.c + 5, tile.r + 43) * Math.PI * 2);
    const at = bulge(tile.x + padX + tileW / 2, tile.y + padY + tileH / 2, w, h, f.warp ?? 0);

    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.transform(at.a, at.b, at.c, at.d, 0, 0);
    ctx.scale(grow * breathe, grow / breathe);
    ctx.translate(-tileW / 2, -tileH / 2);
    ctx.globalAlpha = tile.alpha;
    ctx.clip(shape);

    /* Le decalage de prelevement : c'est lui qui fait la refraction. */
    const shiftX = unit * REFRACT * (hash(tile.c + 91, tile.r + 53) - 0.5) * 2;
    const shiftY = unit * REFRACT * (hash(tile.c + 17, tile.r + 71) - 0.5) * 2;
    const sx = clamp(tile.x + padX + (tileW - sampleW) / 2 - shiftX, 0, Math.max(0, w - sampleW));
    const sy = clamp(tile.y + padY + (tileH - sampleH) / 2 - shiftY, 0, Math.max(0, h - sampleH));
    ctx.drawImage(backCanvas, sx, sy, sampleW, sampleH, 0, 0, tileW, tileH);

    ctx.fillStyle = `rgba(255,255,255,${tile.film.toFixed(3)})`;
    ctx.fillRect(0, 0, tileW, tileH);
    if (tile.shade > 0.004) {
      ctx.fillStyle = rgba(ink, tile.shade);
      ctx.fillRect(0, 0, tileW, tileH);
    }
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, tileW, tileH);
    ctx.fillStyle = tint; ctx.fillRect(0, 0, tileW, tileH);
    ctx.fillStyle = foot; ctx.fillRect(0, 0, tileW, tileH);

    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.6, EDGE_LIGHT * refract * (0.18 + 0.82 * tile.paper)).toFixed(3)})`;
    ctx.lineWidth = unit * 0.11;
    ctx.stroke(shape);
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1, unit * 0.016);
    ctx.stroke(shape);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
