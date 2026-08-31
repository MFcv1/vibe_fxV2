/*
 * Types paves : Beehive (nid d'abeille), Blocks (cubes isometriques) et
 * Balls (spheres).
 *
 * Une meme mecanique : une grille reguliere, une couleur prise dans la palette
 * selon la diagonale de la cellule, un grain leger pour casser la regularite,
 * puis un relief pose par-dessus — biseau pour les hexagones, faces pour les
 * cubes, lumiere et ombre pour les spheres.
 */

import { sampleRgb, rgbCss, rampStops, bandCenters } from '../color.js';

const DEFAULT_SIZE = 50;
const MIN_COLS = 6;
const MAX_COLS = 40;
const BEVEL = 0.11;        // force du biseau des hexagones
const CUBE_SHADE = 0.86;   // taille de la face superieure d'un cube
const HEX_GRAIN = 14;      // bruit de couleur entre cellules
const CUBE_GRAIN = 5;

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* Bruit deterministe par cellule. */
const cellNoise = (x, y, seed) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

/* Geometrie d'un nid d'abeille a pointes horizontales. */
const hiveGeometry = (size = DEFAULT_SIZE) => {
  const s = 4 + 0.06 * clamp01(size / 100) * 100;
  return { s, w: 1.5 * s, vsp: Math.sqrt(3) * s };
};

/* Geometrie d'un pavage a pointes verticales (les cubes). */
const cubeGeometry = (size = DEFAULT_SIZE) => {
  const s = 4 + 0.06 * clamp01(size / 100) * 100;
  return { s, w: Math.sqrt(3) * s, vsp: 1.5 * s };
};

const ballGeometry = (size = DEFAULT_SIZE) => {
  const cols = Math.round(MIN_COLS + ((MAX_COLS - MIN_COLS) / 100) * clamp01(size / 100) * 100);
  const step = 100 / cols;
  return { cols, step, r: step * 0.47, vsp: step * 0.866 };
};

/* Cellules du nid d'abeille, colorees le long de la diagonale. */
function hiveCells(colors, divs, geo) {
  const out = [];
  const cols = Math.ceil(100 / geo.w) + 2;
  const rows = Math.ceil(100 / geo.vsp) + 2;
  for (let c = -1; c <= cols; c++) {
    for (let r = -1; r <= rows; r++) {
      const cx = c * geo.w;
      const cy = r * geo.vsp + (c & 1 ? geo.vsp / 2 : 0);
      const rgb = sampleRgb(colors, divs, clamp01((cx / 100 + cy / 100) / 2));
      const jitter = Math.round((cellNoise(c, r, 7) - 0.5) * 2 * HEX_GRAIN);
      out.push({ cx, cy, rgb: rgb.map((v) => clamp255(v + jitter)), col: c, row: r });
    }
  }
  return out;
}

function cubeCells(colors, divs, geo) {
  const out = [];
  const rows = Math.ceil(100 / geo.vsp) + 2;
  const cols = Math.ceil(100 / geo.w) + 2;
  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const cx = c * geo.w + (r & 1 ? geo.w / 2 : 0);
      const cy = r * geo.vsp;
      const rgb = sampleRgb(colors, divs, clamp01((cx / 100 + cy / 100) / 2));
      const jitter = Math.round((cellNoise(c, r, 11) - 0.5) * 2 * CUBE_GRAIN);
      out.push({ cx, cy, rgb: rgb.map((v) => clamp255(v + jitter)), col: c, row: r });
    }
  }
  return out;
}

/* Trois orientations de biseau, tirees au sort par cellule. */
const BEVELS = [[0, 0, 0, 1], [0, 0, 1, 0.3], [1, 0, 0, 0.9]];
const bevelOf = (col, row) => Math.min(2, Math.floor(cellNoise(col, row, 3) * 3));

/* Le canvas travaille en unites de 100 : on met la grille a l'echelle. */
function withGrid(ctx, w, h, paint) {
  ctx.save();
  const k = Math.max(w, h) / 100;
  ctx.translate((w - 100 * k) / 2, (h - 100 * k) / 2);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  paint();
  ctx.restore();
}

/* ------------------------------------------------------------- Beehive */

export function paintHive(ctx, w, h, colors, divs, size = DEFAULT_SIZE) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  const geo = hiveGeometry(size);
  const half = (Math.sqrt(3) / 2) * geo.s;
  const quarter = geo.s / 2;

  withGrid(ctx, w, h, () => {
    const hex = (cell) => {
      ctx.beginPath();
      ctx.moveTo(cell.cx + geo.s, cell.cy);
      ctx.lineTo(cell.cx + quarter, cell.cy - half);
      ctx.lineTo(cell.cx - quarter, cell.cy - half);
      ctx.lineTo(cell.cx - geo.s, cell.cy);
      ctx.lineTo(cell.cx - quarter, cell.cy + half);
      ctx.lineTo(cell.cx + quarter, cell.cy + half);
      ctx.closePath();
    };
    ctx.lineWidth = 0.35;
    for (const cell of hiveCells(colors, divs, geo)) {
      const flat = rgbCss(cell.rgb);
      hex(cell);
      ctx.fillStyle = flat;
      ctx.strokeStyle = flat;
      ctx.fill();
      ctx.stroke();

      /* Biseau : un degrade clair-sombre traverse la cellule en diagonale. */
      const [x0, y0, x1, y1] = BEVELS[bevelOf(cell.col, cell.row)];
      const grad = ctx.createLinearGradient(
        cell.cx - geo.s + x0 * 2 * geo.s, cell.cy - half + y0 * 2 * half,
        cell.cx - geo.s + x1 * 2 * geo.s, cell.cy - half + y1 * 2 * half,
      );
      grad.addColorStop(0, `rgba(255,255,255,${BEVEL})`);
      grad.addColorStop(0.48, 'rgba(255,255,255,0)');
      grad.addColorStop(0.58, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${BEVEL})`);
      hex(cell);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  });
}

/* --------------------------------------------------------------- Blocks */

export function paintCubes(ctx, w, h, colors, divs, size = DEFAULT_SIZE) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  const geo = cubeGeometry(size);

  withGrid(ctx, w, h, () => {
    const hex = (x, y, k) => {
      const dx = (geo.w / 2) * k;
      const dy = (geo.s / 2) * k;
      const top = geo.s * k;
      ctx.beginPath();
      ctx.moveTo(x, y - top);
      ctx.lineTo(x + dx, y - dy);
      ctx.lineTo(x + dx, y + dy);
      ctx.lineTo(x, y + top);
      ctx.lineTo(x - dx, y + dy);
      ctx.lineTo(x - dx, y - dy);
      ctx.closePath();
    };

    for (const cell of cubeCells(colors, divs, geo)) {
      hex(cell.cx, cell.cy, 1);
      ctx.fillStyle = rgbCss(cell.rgb);
      ctx.fill();

      /* Volume : haut eclaire, bas dans l'ombre. */
      const shade = ctx.createLinearGradient(cell.cx, cell.cy - geo.s, cell.cx, cell.cy + geo.s);
      shade.addColorStop(0, 'rgba(255,255,255,0.20)');
      shade.addColorStop(0.46, 'rgba(255,255,255,0)');
      shade.addColorStop(0.56, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.24)');
      hex(cell.cx, cell.cy, 1);
      ctx.fillStyle = shade;
      ctx.fill();

      /* Face superieure, plus petite, qui creuse le cube. */
      const inner = ctx.createLinearGradient(cell.cx, cell.cy - geo.s * CUBE_SHADE, cell.cx, cell.cy + geo.s * CUBE_SHADE);
      inner.addColorStop(0, 'rgba(0,0,0,0.34)');
      inner.addColorStop(0.52, 'rgba(0,0,0,0.06)');
      inner.addColorStop(1, 'rgba(255,255,255,0.14)');
      hex(cell.cx, cell.cy, CUBE_SHADE);
      ctx.fillStyle = inner;
      ctx.fill();

      const rim = ctx.createLinearGradient(cell.cx, cell.cy - geo.s * CUBE_SHADE, cell.cx, cell.cy + geo.s * CUBE_SHADE);
      rim.addColorStop(0, 'rgba(255,255,255,0.40)');
      rim.addColorStop(0.55, 'rgba(255,255,255,0.10)');
      rim.addColorStop(1, 'rgba(255,255,255,0)');
      hex(cell.cx, cell.cy, CUBE_SHADE);
      ctx.strokeStyle = rim;
      ctx.lineWidth = geo.s * 0.07;
      ctx.stroke();
    }
  });
}

/* ---------------------------------------------------------------- Balls */

export function paintBalls(ctx, w, h, colors, divs, size = DEFAULT_SIZE, style = 'convex') {
  /* Le fond est le degrade lui-meme : les billes le refractent. */
  const stops = bandCenters(colors.length, divs).map((c) => c / 100);
  const back = ctx.createLinearGradient(0, 0, w, h);
  rampStops(colors, stops).forEach(([c, p]) => back.addColorStop(p, c));
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, w, h);

  const geo = ballGeometry(size);
  const centers = [];
  const rows = Math.ceil(100 / geo.vsp) + 1;
  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= geo.cols; c++) {
      centers.push({ cx: c * geo.step + (r & 1 ? geo.step / 2 : 0) + geo.step / 2, cy: r * geo.vsp + geo.vsp / 2 });
    }
  }

  withGrid(ctx, w, h, () => {
    const balls = centers.map((p) => ({ ...p, r: geo.r }));
    const wide = centers.map((p) => ({ ...p, r: geo.step * 0.55 }));

    /* Une source lumineuse decalee dans la bille, exprimee en fraction du rayon. */
    const light = (ball, radius, ox, oy, spread) => {
      const x = ball.cx + (ox - 0.5) * 2 * radius;
      const y = ball.cy + (oy - 0.5) * 2 * radius;
      return ctx.createRadialGradient(x, y, 0, x, y, spread * 2 * radius);
    };
    const pass = (mode, list, make) => {
      ctx.globalCompositeOperation = mode;
      for (const ball of list) {
        ctx.fillStyle = make(ball, ball.r);
        ctx.beginPath();
        ctx.arc(ball.cx, ball.cy, ball.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (style === 'concave') {
      pass('overlay', wide, (b, r) => {
        const g = light(b, r, 0.5, 0.5, 0.74);
        g.addColorStop(0, 'rgba(0,0,0,0.16)');
        g.addColorStop(0.54, 'rgba(0,0,0,0.03)');
        g.addColorStop(0.88, 'rgba(0,0,0,0)');
        return g;
      });
      pass('overlay', wide, (b, r) => {
        const g = light(b, r, 0.3, 0.24, 0.78);
        g.addColorStop(0, 'rgba(0,0,0,0.30)');
        g.addColorStop(0.44, 'rgba(0,0,0,0.08)');
        g.addColorStop(0.8, 'rgba(0,0,0,0)');
        return g;
      });
      pass('screen', wide, (b, r) => {
        const g = light(b, r, 0.73, 0.78, 0.82);
        g.addColorStop(0, 'rgba(255,255,255,0.30)');
        g.addColorStop(0.52, 'rgba(255,255,255,0.06)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        return g;
      });
    } else {
      /* Ombre portee, legerement decalee vers le bas a droite. */
      const shadow = centers.map((p) => ({ cx: p.cx + geo.step * 0.08, cy: p.cy + geo.step * 0.12, r: geo.r * 0.95 }));
      pass('source-over', shadow, (b, r) => {
        const g = light(b, r, 0.5, 0.5, 0.5);
        g.addColorStop(0, 'rgba(0,0,0,0.20)');
        g.addColorStop(0.62, 'rgba(0,0,0,0.144)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        return g;
      });
      pass('overlay', balls, (b, r) => {
        const g = light(b, r, 0.3, 0.3, 0.8);
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(0.22, 'rgba(255,255,255,0.15)');
        g.addColorStop(0.46, 'rgba(0,0,0,0)');
        g.addColorStop(0.78, 'rgba(0,0,0,0.28)');
        g.addColorStop(1, 'rgba(0,0,0,0.44)');
        return g;
      });
      /* Le petit eclat sec, en haut a gauche. */
      pass('screen', balls, (b, r) => {
        const g = light(b, r, 0.32, 0.28, 0.12);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.4)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        return g;
      });
    }
    ctx.globalCompositeOperation = 'source-over';
  });
}
