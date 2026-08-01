/*
 * Transitions minutees rendues A L'IDENTIQUE des deux cotes.
 *
 * Cote export, chacune est une transition native `xfade` de FFmpeg
 * (cf. SERVER_XFADE_TRANSITION_MAP). Ce module en est la contrepartie canvas :
 * c'est lui qui garantit que l'apercu montre ce que l'export produira.
 *
 * Deux regles tirees de la mesure du filtre `xfade` (2026-07-30, lot L1) :
 *
 * 1. `xfade` progresse de facon STRICTEMENT LINEAIRE. Le reste de
 *    VideoEngine.renderTransition applique un `easeInOut` : ces transitions-ci ne
 *    doivent donc jamais y passer, sinon l'apercu et l'export ne sont pas en phase.
 * 2. Les fondus par une couleur (`fadeblack`, `fadewhite`) et `fadegrays` ne sont
 *    pas symetriques : l'image sortante disparait sur les 20 premiers pour cent,
 *    l'image entrante revient sur tout le reste. Les courbes plus bas sont
 *    RELEVEES sur des rendus FFmpeg reels, canal par canal — pas devinees.
 *
 * Trois ecarts residuels sont assumes et documentes sur place : le grain de
 * `dissolve` (tire au hasard par pixel cote FFmpeg), le noyau de flou de `hblur`,
 * et les coefficients de luminance de `fadegrays` (Rec.709 dans le navigateur,
 * Rec.601 dans FFmpeg). Tout le reste est mesure a moins de 4/255 d'ecart.
 * La mesure est refaite a chaque execution de
 * scripts/smoke-vibecut-xfade-preview-parity.mjs, qui compare cette
 * implementation image par image a ce que `xfade` produit.
 */

import { SERVER_XFADE_TRANSITION_MAP } from '../export/exportManifest.js';

export const XFADE_TRANSITION_IDS = Object.freeze(Object.keys(SERVER_XFADE_TRANSITION_MAP));

/*
 * Largeurs de bord adouci, relevees sur les images de reference FFmpeg (les
 * balayages `smooth*` ont une zone de degrade tres large, pas un bord net) et
 * verifiees par smoke-vibecut-xfade-preview-parity.
 */
const SOFT_EDGE = 0.42;
const CIRCLE_SOFT_EDGE = 0.34;
const VERTICAL_SOFT_EDGE = 0.22;
const DISSOLVE_STEPS = 16;
const DISSOLVE_MASK_SIZE = 256;

/*
 * COURBES MESUREES, pas devinees.
 *
 * Relevees le 2026-07-30 en rendant `xfade` avec un plan rouge pur et un plan
 * vert pur, puis en lisant les moyennes RVB image par image : sur `fadeblack`,
 * le canal rouge donne directement le poids du plan sortant et le canal vert
 * celui du plan entrant. `fadewhite` donne EXACTEMENT les memes deux courbes,
 * la couleur occupant le complement — d'ou une seule paire de tables ici.
 *
 * Le plan sortant s'eteint sur les 20 premiers pour cent ; le plan entrant
 * remonte sur tout le reste, en accelerant d'abord puis en se calmant. C'est
 * cette asymetrie qui donne son caractere au passage par le noir, et c'est
 * precisement ce qu'une interpolation symetrique ratait.
 *
 * Pas d'echantillonnage : 0,05. Interpolation lineaire entre deux points.
 */
const COLOR_FADE_FROM = [
    1, 0.794, 0.447, 0.135, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const COLOR_FADE_TO = [
    0, 0, 0.004, 0.012, 0.027, 0.057, 0.094, 0.141, 0.196, 0.264, 0.341,
    0.419, 0.506, 0.588, 0.667, 0.739, 0.8, 0.849, 0.898, 0.947, 1,
];

/*
 * `fadegrays` : le plan sortant perd sa couleur sur les 20 premiers pour cent
 * (meme courbe que le poids de `fadeblack`, soit un smoothstep sur 1-t), et le
 * plan entrant la retrouve bien plus tot qu'une symetrie ne le laisserait croire
 * — d'ou cette table, decomposee canal par canal a partir du meme releve.
 */
const GRAY_RECOLOR_TO = [
    0, 0, 0, 0, 0.049, 0.167, 0.285, 0.384, 0.482, 0.575, 0.668,
    0.747, 0.826, 0.88, 0.934, 0.964, 0.993, 1, 1, 1, 1,
];

// Deux ardoises distinctes: les masques travaillent en pleine taille, la
// pixellisation en taille reduite. Les melanger ferait recreer un canvas a
// chaque image, la taille des blocs changeant en continu.
const scratchCanvases = { mask: null, blocks: null };
let dissolveMasks = null;

export function isXfadeTransition(type) {
    return Object.hasOwn(SERVER_XFADE_TRANSITION_MAP, type);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} from - image sortante
 * @param {CanvasImageSource} to - image entrante
 * @param {number} t - progression LINEAIRE, 0 a 1
 * @param {string} type - id VibeCut (cle de SERVER_XFADE_TRANSITION_MAP)
 * @param {number} w
 * @param {number} h
 */
export function renderXfadeTransition(ctx, from, to, t, type, w, h) {
    const progress = clamp(t, 0, 1);
    // Aux deux extremites il n'y a plus de fondu: evite les bords adoucis qui
    // depasseraient du cadre sur la toute premiere / derniere image.
    if (progress <= 0) {
        ctx.globalAlpha = 1;
        ctx.drawImage(from, 0, 0, w, h);
        return undefined;
    }
    if (progress >= 1) {
        ctx.globalAlpha = 1;
        ctx.drawImage(to, 0, 0, w, h);
        return undefined;
    }

    switch (SERVER_XFADE_TRANSITION_MAP[type] || 'fade') {
        case 'fadeblack':
            return drawColorFade(ctx, from, to, progress, w, h, '0,0,0');
        case 'fadewhite':
            return drawColorFade(ctx, from, to, progress, w, h, '255,255,255');
        case 'fadegrays':
            return drawGrayFade(ctx, from, to, progress, w, h);
        case 'dissolve':
            return drawDissolve(ctx, from, to, progress, w, h);
        case 'smoothleft':
            return drawSoftWipe(ctx, from, to, progress, w, h, 'left');
        case 'smoothright':
            return drawSoftWipe(ctx, from, to, progress, w, h, 'right');
        case 'slideup':
            return drawSlide(ctx, from, to, progress, w, h, 'up');
        case 'slidedown':
            return drawSlide(ctx, from, to, progress, w, h, 'down');
        case 'wipeleft':
            return drawHardWipeLeft(ctx, from, to, progress, w, h);
        case 'vertopen':
            return drawVerticalOpen(ctx, from, to, progress, w, h);
        case 'circleopen':
            return drawCircle(ctx, from, to, progress, w, h, 'open');
        case 'circleclose':
            return drawCircle(ctx, from, to, progress, w, h, 'close');
        case 'pixelize':
            return drawPixelize(ctx, from, to, progress, w, h);
        case 'hblur':
            return drawHorizontalBlur(ctx, from, to, progress, w, h);
        case 'fade':
        default:
            return drawLinearFade(ctx, from, to, progress, w, h);
    }
}

/* ---------- fondus ---------- */

function drawLinearFade(ctx, from, to, t, w, h) {
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    ctx.globalAlpha = t;
    ctx.drawImage(to, 0, 0, w, h);
    ctx.globalAlpha = 1;
}

/*
 * Les deux poids ne se recouvrent quasiment pas (le sortant est nul des t=0,2,
 * l'entrant negligeable avant) : empiler les deux dessins sur l'aplat de couleur
 * suffit, sans avoir a composer les poids a la main.
 */
function drawColorFade(ctx, from, to, t, w, h, rgb) {
    const weightFrom = sampleCurve(COLOR_FADE_FROM, t);
    const weightTo = sampleCurve(COLOR_FADE_TO, t);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.fillRect(0, 0, w, h);
    if (weightFrom > 0.002) {
        ctx.globalAlpha = weightFrom;
        ctx.drawImage(from, 0, 0, w, h);
    }
    if (weightTo > 0.002) {
        ctx.globalAlpha = weightTo;
        ctx.drawImage(to, 0, 0, w, h);
    }
    ctx.globalAlpha = 1;
}

/*
 * Melange lineaire (luminance mesuree lineaire) mais les deux images perdent puis
 * retrouvent leur couleur: A est grise des t≈0,2, B reste grise jusqu'a t≈0,25
 * puis se recolore progressivement.
 */
function drawGrayFade(ctx, from, to, t, w, h) {
    const colorFrom = smoothstep(0.8, 1, 1 - t);
    const colorTo = sampleCurve(GRAY_RECOLOR_TO, t);
    ctx.globalAlpha = 1;
    ctx.filter = `grayscale(${(1 - colorFrom).toFixed(3)})`;
    ctx.drawImage(from, 0, 0, w, h);
    ctx.globalAlpha = t;
    ctx.filter = `grayscale(${(1 - colorTo).toFixed(3)})`;
    ctx.drawImage(to, 0, 0, w, h);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
}

/*
 * FFmpeg tire un bruit par pixel: non reproductible a l'identique. On approche
 * avec des masques binaires pre-calcules, dont la densite suit la progression.
 * Le grain est fige d'une lecture a l'autre, ce qui est preferable ici: un bruit
 * different a chaque image ferait scintiller l'apercu.
 */
function drawDissolve(ctx, from, to, t, w, h) {
    const masks = getDissolveMasks();
    const index = Math.round(clamp(t, 0, 1) * (masks.length - 1));
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    const layer = getScratchCanvas(w, h);
    if (!layer) return drawLinearFade(ctx, from, to, t, w, h);
    const layerCtx = layer.ctx;
    layerCtx.globalCompositeOperation = 'source-over';
    layerCtx.clearRect(0, 0, w, h);
    layerCtx.drawImage(to, 0, 0, w, h);
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.imageSmoothingEnabled = false;
    layerCtx.drawImage(masks[index], 0, 0, w, h);
    layerCtx.imageSmoothingEnabled = true;
    layerCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer.canvas, 0, 0);
    return undefined;
}

/* ---------- geometrie ---------- */

/*
 * `smoothleft`: l'image entrante est devoilee depuis le bord DROIT, le bord du
 * balayage progressant vers la gauche. `smoothright` est son miroir.
 * Le bord est adouci sur SOFT_EDGE de la largeur.
 */
function drawSoftWipe(ctx, from, to, t, w, h, direction) {
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    const reveal = t * (1 + SOFT_EDGE);
    const stops = direction === 'left'
        ? [[1 - reveal, 0], [1 - reveal + SOFT_EDGE, 1]]
        : [[reveal - SOFT_EDGE, 1], [reveal, 0]];
    paintMasked(ctx, to, w, h, makeHorizontalMask(ctx, w, stops));
}

/* `slideup` / `slidedown`: l'image entrante pousse la sortante hors cadre. */
function drawSlide(ctx, from, to, t, w, h, direction) {
    const offset = Math.round(t * h);
    ctx.globalAlpha = 1;
    if (direction === 'up') {
        ctx.drawImage(from, 0, -offset, w, h);
        ctx.drawImage(to, 0, h - offset, w, h);
    } else {
        ctx.drawImage(from, 0, offset, w, h);
        ctx.drawImage(to, 0, -h + offset, w, h);
    }
}

/* `wipeleft`: bord net, l'image entrante est devoilee depuis la droite. */
function drawHardWipeLeft(ctx, from, to, t, w, h) {
    const edge = Math.round((1 - t) * w);
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(edge, 0, w - edge, h);
    ctx.clip();
    ctx.drawImage(to, 0, 0, w, h);
    ctx.restore();
}

/* `vertopen`: ouverture depuis l'axe vertical central, vers les deux bords. */
function drawVerticalOpen(ctx, from, to, t, w, h) {
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    // L'ouverture doit etre totale a t=1, bord adouci compris: d'ou le depassement.
    const inner = 0.5 - t * (0.5 + VERTICAL_SOFT_EDGE);
    const outer = inner + VERTICAL_SOFT_EDGE;
    paintMasked(ctx, to, w, h, makeHorizontalMask(ctx, w, [
        [inner, 0],
        [outer, 1],
        [1 - outer, 1],
        [1 - inner, 0],
    ]));
}

/* `circleopen` / `circleclose`: iris circulaire a bord adouci. */
function drawCircle(ctx, from, to, t, w, h, mode) {
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    const maxRadius = Math.hypot(w, h) / 2;
    const radial = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, maxRadius);
    if (mode === 'open') {
        const edge = t * (1 + CIRCLE_SOFT_EDGE);
        radial.addColorStop(0, 'rgba(255,255,255,1)');
        radial.addColorStop(clamp(edge - CIRCLE_SOFT_EDGE, 0, 0.999), 'rgba(255,255,255,1)');
        radial.addColorStop(clamp(edge, 0.001, 1), 'rgba(255,255,255,0)');
        radial.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
        const edge = 1 - t * (1 + CIRCLE_SOFT_EDGE);
        radial.addColorStop(0, 'rgba(255,255,255,0)');
        radial.addColorStop(clamp(edge, 0, 0.999), 'rgba(255,255,255,0)');
        radial.addColorStop(clamp(edge + CIRCLE_SOFT_EDGE, 0.001, 1), 'rgba(255,255,255,1)');
        radial.addColorStop(1, 'rgba(255,255,255,1)');
    }
    paintMasked(ctx, to, w, h, radial);
}

/* `pixelize`: les deux images se pixellisent vers le milieu du fondu. */
function drawPixelize(ctx, from, to, t, w, h) {
    const strength = Math.min(t, 1 - t) * 2;
    const blocks = Math.max(1, Math.round(1 + strength * 48));
    const smallW = Math.max(1, Math.round(w / blocks));
    const smallH = Math.max(1, Math.round(h / blocks));
    const layer = getScratchCanvas(smallW, smallH, 'blocks');
    if (!layer) return drawLinearFade(ctx, from, to, t, w, h);
    const layerCtx = layer.ctx;
    layerCtx.globalCompositeOperation = 'source-over';
    layerCtx.globalAlpha = 1;
    layerCtx.clearRect(0, 0, smallW, smallH);
    layerCtx.drawImage(from, 0, 0, smallW, smallH);
    layerCtx.globalAlpha = t;
    layerCtx.drawImage(to, 0, 0, smallW, smallH);
    layerCtx.globalAlpha = 1;
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layer.canvas, 0, 0, smallW, smallH, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    return undefined;
}

/* `hblur`: flou horizontal qui monte puis redescend pendant le melange. */
function drawHorizontalBlur(ctx, from, to, t, w, h) {
    const strength = Math.min(t, 1 - t) * 2;
    const radius = strength * Math.max(2, w * 0.02);
    ctx.globalAlpha = 1;
    ctx.filter = radius > 0.5 ? `blur(${radius.toFixed(2)}px)` : 'none';
    ctx.drawImage(from, 0, 0, w, h);
    ctx.globalAlpha = t;
    ctx.drawImage(to, 0, 0, w, h);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
}

/* ---------- utilitaires ---------- */

function paintMasked(ctx, source, w, h, mask) {
    const layer = getScratchCanvas(w, h);
    if (!layer) {
        ctx.globalAlpha = 1;
        ctx.drawImage(source, 0, 0, w, h);
        return;
    }
    const layerCtx = layer.ctx;
    layerCtx.globalCompositeOperation = 'source-over';
    layerCtx.globalAlpha = 1;
    layerCtx.filter = 'none';
    layerCtx.clearRect(0, 0, w, h);
    layerCtx.drawImage(source, 0, 0, w, h);
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.fillStyle = mask;
    layerCtx.fillRect(0, 0, w, h);
    layerCtx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(layer.canvas, 0, 0);
}

/*
 * Masque horizontal gauche->droite. Les offsets sont donnes en fraction de
 * largeur et peuvent deborder de [0,1] (le balayage depasse volontairement le
 * cadre pour que le bord adouci sorte de l'image) : ils sont ramenes dans les
 * bornes, et l'ordre croissant est garanti par construction des appelants.
 */
function makeHorizontalMask(ctx, w, stops) {
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    let lastOffset = -1;
    stops.forEach(([offset, alpha]) => {
        const position = Math.max(clamp(offset, 0, 1), lastOffset);
        lastOffset = position;
        gradient.addColorStop(position, `rgba(255,255,255,${alpha})`);
    });
    return gradient;
}

function getScratchCanvas(w, h, slot = 'mask') {
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    const current = scratchCanvases[slot];
    if (current && current.canvas.width === width && current.canvas.height === height) return current;
    const canvas = createCanvas(width, height);
    if (!canvas) return null;
    const context = canvas.getContext('2d');
    if (!context) return null;
    scratchCanvases[slot] = { canvas, ctx: context };
    return scratchCanvases[slot];
}

function getDissolveMasks() {
    if (dissolveMasks) return dissolveMasks;
    const size = DISSOLVE_MASK_SIZE;
    const noise = new Float32Array(size * size);
    // Bruit deterministe: le grain doit etre le meme d'une lecture a l'autre.
    let seed = 0x9e3779b9;
    for (let i = 0; i < noise.length; i += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        noise[i] = seed / 0xffffffff;
    }
    dissolveMasks = [];
    for (let step = 0; step < DISSOLVE_STEPS; step += 1) {
        const threshold = step / (DISSOLVE_STEPS - 1);
        const canvas = createCanvas(size, size);
        if (!canvas) {
            dissolveMasks = [];
            return [];
        }
        const context = canvas.getContext('2d');
        const image = context.createImageData(size, size);
        for (let i = 0; i < noise.length; i += 1) {
            const opaque = noise[i] < threshold;
            image.data[i * 4] = 255;
            image.data[i * 4 + 1] = 255;
            image.data[i * 4 + 2] = 255;
            image.data[i * 4 + 3] = opaque ? 255 : 0;
        }
        context.putImageData(image, 0, 0);
        dissolveMasks.push(canvas);
    }
    return dissolveMasks;
}

function createCanvas(width, height) {
    if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

/* Lecture d'une courbe mesuree, echantillonnee a pas constant sur [0,1]. */
function sampleCurve(curve, t) {
    const position = clamp(t, 0, 1) * (curve.length - 1);
    const index = Math.min(curve.length - 2, Math.floor(position));
    const fraction = position - index;
    return curve[index] + (curve[index + 1] - curve[index]) * fraction;
}

function smoothstep(edge0, edge1, x) {
    const value = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return value * value * (3 - 2 * value);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
