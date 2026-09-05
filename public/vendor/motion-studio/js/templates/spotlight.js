/*
 * Famille projecteur : une seule image porte le cadre a la fois, et l'animation
 * est le passage de relais d'une image a la suivante.
 */

import {
    cornerRadius, pct, card, cameraFor, paddingScale, clamp, zoomedUv, VIEW_HEIGHT,
} from './_helpers.js';
import { ease } from '../engine/math.js';

const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };
const PADDING = {
    t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
};
const RADIUS = {
    t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 3, unit: '%', dec: 1,
};
const EASING = { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' };

export const centerStage = {
    id: 'center-stage',
    name: 'Center Stage',
    category: 'spotlight',
    slots: 3,
    loop: 7,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'travel', label: 'Travel distance', min: 0, max: 150, step: 1, def: 60, unit: '%' },
        { t: 'slider', k: 'ghost', label: 'Ghost trail', min: 0, max: 100, step: 1, def: 40, unit: '%' },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 20, max: 120, step: 1, def: 86, unit: '%' },
        EASING, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5 * scale;
        const travel = pct(P.travel) * VIEW_HEIGHT * ctx.frameAspect * 0.6;
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const move = ease(P.easing, clamp((local - 0.35) / 0.65, 0, 1));

        const quads = [];
        const ghost = pct(P.ghost);
        // La carte sortante traine derriere elle quelques copies de plus en plus
        // pales : c'est le "ghost trail", fabrique en repetant la meme carte a
        // des positions intermediaires.
        const taps = ghost > 0.02 ? 5 : 0;
        for (let k = taps; k >= 1; k -= 1) {
            const back = move - (k / taps) * 0.18;
            if (back <= 0) continue;
            quads.push(card(ctx, index, P.cardRatio,
                [-back * travel, 0, -0.01 * k], [1, 0, 0], [0, 1, 0], halfH,
                { radius: cornerRadius(P), alpha: ghost * (1 - k / (taps + 1)) * 0.5, castShadow: false }));
        }
        quads.push(card(ctx, index, P.cardRatio, [-move * travel, 0, 0], [1, 0, 0], [0, 1, 0], halfH,
            { radius: cornerRadius(P), alpha: 1 - clamp((move - 0.6) / 0.4, 0, 1) }));
        quads.push(card(ctx, index + 1, P.cardRatio, [(1 - move) * travel, 0, 0.01], [1, 0, 0], [0, 1, 0], halfH,
            { radius: cornerRadius(P), alpha: clamp(move / 0.5, 0, 1) }));
        return { camera: cameraFor(10), quads };
    },
};

export const focusShift = {
    id: 'focus-shift',
    name: 'Focus Shift',
    category: 'spotlight',
    slots: 4,
    loop: 10,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'railSize', label: 'Rail size', min: 10, max: 50, step: 1, def: 26, unit: '%' },
        { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 15, step: 0.5, def: 2.5, unit: '%', dec: 1 },
        EASING, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const W = VIEW_HEIGHT * ctx.frameAspect * scale;
        const H = VIEW_HEIGHT * scale;
        const gap = W * pct(P.gap);
        const railW = W * pct(P.railSize);
        const mainW = W - railW - gap;

        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const move = ease(P.easing, clamp((local - 0.45) / 0.55, 0, 1));

        const quads = [];
        // Le grand cadre a gauche echange son image avec un fondu ; le rail de
        // droite fait remonter ses vignettes d'un cran au meme moment.
        const big = (i, alpha) => {
            const m = ctx.cardAt(i, mainW / H);
            return {
                p: [
                    [-W / 2, H / 2, 0], [-W / 2 + mainW, H / 2, 0],
                    [-W / 2 + mainW, -H / 2, 0], [-W / 2, -H / 2, 0],
                ],
                tex: m.tex,
                uvRect: m.uvRect,
                aspect: mainW / H,
                radius: cornerRadius(P),
                alpha,
            };
        };
        quads.push(big(index, 1));
        if (move > 0) quads.push(big(index + 1, move));

        const rows = Math.max(2, n - 1);
        const rowH = (H - gap * (rows - 1)) / rows;
        /*
         * On indexe le rail par sa course totale et non par la position dans la
         * boucle : sinon, au passage du dernier cran, l'increment de `index` et
         * le decalage des rangees se cumulaient au lieu de s'annuler, et le rail
         * sautait de deux vignettes.
         */
        const travel = index + move;
        const firstRow = Math.floor(travel) - 1;
        for (let k = 0; k < rows + 2; k += 1) {
            const idx = firstRow + k;
            const y = H / 2 - rowH / 2 - (idx - travel) * (rowH + gap);
            if (y > H / 2 + rowH || y < -H / 2 - rowH) continue;
            const m = ctx.cardAt(idx + 1, railW / rowH);
            quads.push({
                p: [
                    [W / 2 - railW, y + rowH / 2, 0], [W / 2, y + rowH / 2, 0],
                    [W / 2, y - rowH / 2, 0], [W / 2 - railW, y - rowH / 2, 0],
                ],
                tex: m.tex,
                uvRect: m.uvRect,
                aspect: railW / rowH,
                radius: cornerRadius(P),
            });
        }
        return { camera: cameraFor(8), quads };
    },
};

export const deckPeel = {
    id: 'deck-peel',
    name: 'Deck Peel',
    category: 'spotlight',
    slots: 4,
    loop: 9,
    params: [
        { t: 'section', label: 'POSITION' }, RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 15, max: 100, step: 1, def: 48, unit: '%' },
        { t: 'slider', k: 'peek', label: 'Stack peek', min: 0, max: 20, step: 0.5, def: 4, unit: '%', dec: 1 },
        EASING, RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5;
        const peek = pct(P.peek) * VIEW_HEIGHT;
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const move = ease(P.easing, clamp((local - 0.3) / 0.7, 0, 1));

        const quads = [];
        // On dessine la pile du fond vers le dessus ; la carte du dessus part en
        // glissant sur le cote et vient se remettre au fond.
        for (let k = n - 1; k >= 0; k -= 1) {
            const depth = k - move;
            const slide = k === 0 ? move : 0;
            const d = Math.max(depth, 0);
            const x = slide * halfH * 3.4;
            const y = -d * peek;
            const s = 1 - d * 0.055;
            const alpha = k === 0 ? 1 - clamp((move - 0.7) / 0.3, 0, 1) : 1;
            quads.push(card(ctx, index + k, P.cardRatio, [x, y, -d * 0.02],
                [1, 0, 0], [0, 1, 0], halfH * s,
                { radius: cornerRadius(P), alpha, fade: d * 0.08 }));
        }
        return { camera: cameraFor(12), quads };
    },
};

export const zoomParallax = {
    id: 'zoom-parallax',
    name: 'Zoom Parallax',
    category: 'spotlight',
    slots: 3,
    loop: 9,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'zoom', label: 'Zoom amount', min: 0, max: 60, step: 1, def: 12, unit: '%' },
        EASING,
        { t: 'choice', k: 'pan', label: 'Pan direction', options: [['alt', 'Alternate'], ['left', 'Left'], ['right', 'Right']], def: 'alt' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfW = VIEW_HEIGHT * ctx.frameAspect * 0.5 * scale;
        const halfH = VIEW_HEIGHT * 0.5 * scale;
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const cross = ease(P.easing, clamp((local - 0.78) / 0.22, 0, 1));

        /*
         * Les deux plans occupent exactement le meme rectangle : le zoom et le
         * balayage se font dans la texture. Le fondu est alors exact, et le plan
         * sortant ne deborde nulle part.
         */
        const plate = (i, progress, alpha, z) => {
            const dirSign = P.pan === 'left' ? -1 : P.pan === 'right' ? 1 : (i % 2 ? -1 : 1);
            const m = ctx.cardAt(i, halfW / halfH);
            const zoom = 1 + pct(P.zoom) * progress;
            const pan = dirSign * pct(P.zoom) * progress * 0.5;
            return {
                p: [
                    [-halfW, halfH, z], [halfW, halfH, z],
                    [halfW, -halfH, z], [-halfW, -halfH, z],
                ],
                tex: m.tex,
                uvRect: zoomedUv(m.uvRect, zoom, pan, 0),
                aspect: halfW / halfH,
                radius: cornerRadius(P),
                alpha,
            };
        };
        // Le plan entrant est explicitement devant : a profondeur egale l'ordre
        // de dessin n'etait pas garanti.
        const quads = [plate(index, local, 1, 0)];
        if (cross > 0) quads.push(plate(index + 1, local - 1, cross, 0.02));
        return { camera: cameraFor(8), quads };
    },
};
