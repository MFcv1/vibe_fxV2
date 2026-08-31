/*
 * SHAPES (Forms) — une forme decoupee dans un degrade, posee sur du papier.
 *
 * La forme est un chemin SVG de la bibliotheque. On l'utilise comme masque :
 * un degrade diagonal est peint a travers, puis un second masque en biais fait
 * disparaitre progressivement un cote (le reglage Fade). Une passe floue en
 * mode « screen » ajoute le halo (Bloom).
 */

const FORM_DEFAULT = {
  id: 'clean-grid-four', x: 76, y: 52, size: 124, rotate: 0, fade: 78,
  stretchX: 100, stretchY: 100, skew: 0, bloom: 34, blur: 0,
};

let LIBRARY = null;
let ORDER = [];

export function loadShapes(shapes) {
  LIBRARY = shapes;
  ORDER = Object.keys(shapes);
}

export const shapeIds = () => ORDER;
export const SHAPES_FIELD = FORM_DEFAULT;

let scratch = null;

export function paintShapes(ctx, w, h, colors, form = FORM_DEFAULT, soften = 0) {
  const spec = { ...FORM_DEFAULT, ...(form ?? {}) };
  const shape = LIBRARY?.[spec.id] ?? LIBRARY?.['clean-grid-four'];
  if (!shape) { ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, w, h); return; }

  const path = new Path2D(shape.paths.map((p) => p.data).join(' '));
  /* La premiere couleur est le papier ; la forme prend les suivantes. */
  const ink = colors.length > 1 ? colors.slice(1) : colors;

  /*
   * Geometrie : la forme est posee comme une boite de largeur `size`, dont la
   * hauteur suit le rapport du dessin. Etirements et cisaillement viennent
   * ensuite. Tout se calcule dans le repere du dessin, pas dans celui du
   * canvas : c'est ce qui fait courir le degrade le long de la forme.
   */
  const size = Math.min(w, h) * (spec.size / 100);
  const cx = w * (spec.x / 100);
  const cy = h * (spec.y / 100);
  const scale = size / shape.width;
  const sx = scale * (spec.stretchX / 100);
  const sy = scale * (spec.stretchY / 100);
  const W = shape.width;
  const H = shape.height;

  scratch = scratch ?? document.createElement('canvas');
  if (scratch.width !== w) scratch.width = w;
  if (scratch.height !== h) scratch.height = h;
  const layer = scratch.getContext('2d');
  layer.clearRect(0, 0, w, h);

  /* Repere de la forme : position, rotation, cisaillement, etirement. */
  const frame = () => {
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.translate(cx, cy);
    layer.rotate((spec.rotate * Math.PI) / 180);
    layer.transform(1, 0, Math.tan((spec.skew * Math.PI) / 180), 1, 0, 0);
    layer.scale(sx, sy);
    layer.translate(-W / 2, -H / 2);
  };

  /* Corps : degrade en diagonale de la boite du dessin. */
  layer.save();
  frame();
  const body = layer.createLinearGradient(0, 0, W, H);
  ink.forEach((color, i) => body.addColorStop(ink.length === 1 ? 0 : i / (ink.length - 1), color));
  layer.fillStyle = body;
  layer.fill(path, 'evenodd');
  layer.restore();

  /*
   * Fondu directionnel : l'angle depend du rang de la forme dans la
   * bibliotheque, ce qui evite que toutes s'effacent du meme cote. Le balayage
   * traverse la boite du dessin de part en part.
   */
  const angle = ((-32 + (Math.max(0, ORDER.indexOf(spec.id)) % 6) * 31) * Math.PI) / 180;
  const ax = Math.cos(angle) / 2;
  const ay = Math.sin(angle) / 2;
  const fade = Math.max(0, Math.min(1, spec.fade / 100));
  const hold = 0.72 - fade * 0.24;
  const gone = hold + (1 - hold) * 0.62;

  layer.save();
  frame();
  layer.globalCompositeOperation = 'destination-in';
  const mask = layer.createLinearGradient((0.5 - ax) * W, (0.5 - ay) * H, (0.5 + ax) * W, (0.5 + ay) * H);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(hold, 'rgba(255,255,255,1)');
  mask.addColorStop(gone, `rgba(255,255,255,${(1 - fade * 0.32).toFixed(4)})`);
  mask.addColorStop(1, `rgba(255,255,255,${(0.5 * (1 - fade) + 0.025).toFixed(4)})`);
  layer.fillStyle = mask;
  layer.fill(path, 'evenodd');
  layer.restore();
  layer.setTransform(1, 0, 0, 1, 0, 0);

  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);

  const bloom = Math.max(0, Math.min(1, (spec.bloom ?? 0) / 100));
  if (bloom > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.12 + bloom * 0.24;
    ctx.filter = `blur(${Math.max(4, size * (0.014 + bloom * 0.024))}px)`;
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  }

  /* Les formes « soft- » gardent toujours un rien de flou sur leur bord. */
  const soft = spec.id.startsWith('soft-');
  const edge = Math.max(soft ? 1.2 : 0, size * (soft ? 0.006 : 0.0015) + soften * 0.18);
  ctx.save();
  ctx.filter = edge > 0 ? `blur(${edge}px)` : 'none';
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}
