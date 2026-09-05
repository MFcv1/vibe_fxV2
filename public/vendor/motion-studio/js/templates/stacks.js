/*
 * Famille pile et dispersion : les cartes arrivent, s'empilent, se jettent ou
 * changent de place. Le mouvement est ici dans le plan de l'ecran, avec une
 * rotation propre a chaque carte plutot qu'une camera qui bouge.
 */

import {
    cornerRadius, TAU, pct, card, cameraFor, paddingScale, clamp, hash, VIEW_HEIGHT,
} from './_helpers.js';
import { ease, steppedProgress } from '../engine/math.js';

const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };
const RATIO_FRAME = {
    t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'frame', frame: true,
};
const PADDING = {
    t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
};
const RADIUS = {
    t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 3, unit: '%', dec: 1,
};
const EASING = { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' };

// Axes d'une carte tournee d'un angle dans le plan de l'ecran.
const spun = (a) => ({ right: [Math.cos(a), Math.sin(a), 0], up: [-Math.sin(a), Math.cos(a), 0] });

export const stackSlide = {
    id: 'stack-slide',
    name: 'Stack Slide',
    category: 'stack',
    slots: 4,
    loop: 8,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'inset', label: 'Card inset', min: 0, max: 20, step: 0.5, def: 4, unit: '%', dec: 1 },
        { t: 'slider', k: 'depthScale', label: 'Depth scale', min: 0.6, max: 1, step: 0.01, def: 0.95, unit: '', dec: 2 },
        EASING, RATIO_FRAME, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = VIEW_HEIGHT * 0.5 * scale;
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const move = ease(P.easing, clamp((raw - index - 0.3) / 0.7, 0, 1));
        const inset = pct(P.inset) * VIEW_HEIGHT;

        const quads = [];
        // Du fond vers le dessus : chaque carte remonte d'un cran pendant que
        // celle du dessus s'en va par la droite.
        for (let k = n - 1; k >= 0; k -= 1) {
            const d = Math.max(k - move, 0);
            const s = P.depthScale ** d;
            const x = k === 0 ? move * halfH * 3.2 * ctx.frameAspect : 0;
            quads.push(card(ctx, index + k, P.cardRatio, [x, -d * inset, -d * 0.02],
                [1, 0, 0], [0, 1, 0], halfH * s,
                {
                    radius: cornerRadius(P),
                    fade: d * 0.07,
                    alpha: k === 0 ? 1 - clamp((move - 0.75) / 0.25, 0, 1) : 1,
                }));
        }
        return { camera: cameraFor(10), quads };
    },
};

export const cascadeDrop = {
    id: 'cascade-drop',
    name: 'Cascade Drop',
    category: 'stack',
    slots: 4,
    loop: 7,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'rotation', label: 'Rotation', min: 0, max: 300, step: 1, def: 100, unit: '%' },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 20, max: 120, step: 1, def: 78, unit: '%' },
        RATIO_FRAME, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5 * scale;
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;

        const quads = [];
        // Trois cartes en vol a tout instant : celle qui tombe, celle qui est en
        // place, celle qui glisse en dessous. Une chute avec rebond, pas un
        // simple fondu.
        for (let k = 2; k >= 0; k -= 1) {
            const t = clamp(local + k - 1, -1, 1.4);
            if (t < -0.05) continue;
            const fall = ease('bounce', clamp(t, 0, 1));
            const y = (1 - fall) * VIEW_HEIGHT * 1.3;
            const a = (1 - fall) * pct(P.rotation) * 0.6;
            const { right, up } = spun(a);
            quads.push(card(ctx, index - k + 1, P.cardRatio, [0, y, -k * 0.02],
                right, up, halfH,
                { radius: cornerRadius(P), fade: k * 0.06 }));
        }
        return { camera: cameraFor(10), quads };
    },
};

export const cascadeDeck = {
    id: 'cascade-deck',
    name: 'Cascade Deck',
    category: 'stack',
    slots: 8,
    loop: 8,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 20, max: 120, step: 1, def: 80, unit: '%' },
        { t: 'slider', k: 'overlap', label: 'Overlap', min: 0, max: 95, step: 1, def: 70, unit: '%' },
        EASING,
        { t: 'choice', k: 'motion', label: 'Motion', options: [['one', 'One by one'], ['all', 'All together']], def: 'one' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.35 * scale;
        const sample = ctx.card(0, P.cardRatio);
        const step = halfH * 2 * sample.aspect * (1 - pct(P.overlap));

        /*
         * L'eventail est un rail sans fin : chaque carte traverse la pile de
         * droite a gauche et repart du debut. Un empilement a sens unique ne
         * bouclait pas — a la fin du tour, la scene ne ressemblait plus a celle
         * du depart.
         *
         * "All together" fait glisser tout l'eventail d'un bloc, "One by one"
         * le fait avancer d'une carte a la fois.
         */
        const phase = P.motion === 'all'
            ? ease(P.easing, ctx.t) * n
            : steppedProgress(ctx.t, n, P.easing);

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            let d = i - phase;
            d = ((d % n) + n) % n;
            if (d > n / 2) d -= n;
            // La carte s'efface juste avant le bout du rail, la ou elle
            // reapparait a l'autre extremite : le saut devient invisible.
            const out = clamp((Math.abs(d) / (n / 2) - 0.7) / 0.3, 0, 1);
            const a = -d * 0.05;
            const { right, up } = spun(a);
            quads.push(card(ctx, i, P.cardRatio, [d * step, 0, -d * 0.01], right, up, halfH, {
                radius: cornerRadius(P),
                alpha: 1 - out,
            }));
        }
        return { camera: cameraFor(10), quads };
    },
};

export const imageTrail = {
    id: 'image-trail',
    name: 'Image Trail',
    category: 'stack',
    slots: 12,
    loop: 10,
    params: [
        { t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 0, unit: '%', dec: 1 },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 50, step: 0.5, def: 19, unit: '%', dec: 1 },
        { t: 'slider', k: 'trail', label: 'Trail length', min: 3, max: 40, step: 1, def: 18, unit: '' },
        { t: 'slider', k: 'popFrom', label: 'Pop from', min: 0, max: 100, step: 1, def: 50, unit: '%' },
        EASING, RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const trail = Math.max(2, Math.round(P.trail));
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.9;
        const W = VIEW_HEIGHT * ctx.frameAspect;

        /*
         * Un curseur imaginaire suit une courbe de Lissajous fermee ; chaque
         * image de la trainee est sa position quelques instants plus tot. La
         * courbe se referme sur elle-meme, donc la boucle aussi.
         */
        const at = (u) => [
            Math.sin(u * TAU) * W * 0.34,
            Math.sin(u * TAU * 2 + 0.6) * VIEW_HEIGHT * 0.34,
        ];

        const quads = [];
        for (let k = trail - 1; k >= 0; k -= 1) {
            const age = k / trail;
            // Un tiers du parcours : la trainee traverse alors vraiment le
            // cadre au lieu de rester tassee autour du curseur.
            const [x, y] = at(ctx.t - age * 0.34);
            // La carte apparait en grandissant depuis "Pop from", puis s'efface.
            const grow = 1 - (1 - pct(P.popFrom)) * ease(P.easing, clamp(age * 3, 0, 1));
            quads.push(card(ctx, k, P.cardRatio, [x, y, -k * 0.004], [1, 0, 0], [0, 1, 0],
                halfH * clamp(grow, 0.02, 2),
                { radius: cornerRadius(P), alpha: clamp(1 - age, 0, 1) }));
        }
        return { camera: cameraFor(10), quads };
    },
};

export const posterBurst = {
    id: 'poster-burst',
    name: 'Poster Burst',
    category: 'stack',
    slots: 4,
    loop: 12,
    params: [
        RADIUS,
        { t: 'slider', k: 'hold', label: 'Hold time', min: 0, max: 80, step: 1, def: 30, unit: '%' },
        RATIO_FRAME,
        { t: 'choice', k: 'flow', label: 'Flow', options: [['one', 'One by one'], ['stagger', 'Staggered'], ['volley', 'Volley']], def: 'one' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const halfH = VIEW_HEIGHT * 0.46;
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const hold = pct(P.hold);
        const move = clamp((local - hold) / (1 - hold || 1), 0, 1);

        const quads = [];
        // L'affiche en place, puis la suivante qui jaillit du centre. En mode
        // "Volley" deux affiches entrent decalees, en "Staggered" l'entree part
        // legerement de cote.
        const entrants = P.flow === 'volley' ? 2 : 1;
        quads.push(card(ctx, index, P.cardRatio, [0, 0, 0], [1, 0, 0], [0, 1, 0], halfH, {
            radius: cornerRadius(P),
        }));
        for (let k = 0; k < entrants; k += 1) {
            const t = ease('overshoot', clamp((move - k * 0.18) / (1 - k * 0.18 || 1), 0, 1));
            if (t <= 0) continue;
            const side = P.flow === 'stagger' ? (index % 2 ? 1 : -1) : 0;
            quads.push(card(ctx, index + 1 + k, P.cardRatio,
                [side * (1 - t) * halfH, 0, 0.01 + k * 0.01], [1, 0, 0], [0, 1, 0],
                halfH * t,
                { radius: cornerRadius(P), alpha: clamp(t * 2, 0, 1) }));
        }
        return { camera: cameraFor(10), quads };
    },
};

export const cardToss = {
    id: 'card-toss',
    name: 'Card Toss',
    category: 'stack',
    slots: 8,
    loop: 12,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 70, step: 1, def: 26, unit: '%' },
        { t: 'slider', k: 'sizeVariation', label: 'Size variation', min: 0, max: 100, step: 1, def: 20, unit: '%' },
        { t: 'slider', k: 'throwHeight', label: 'Throw height', min: 0, max: 200, step: 1, def: 75, unit: '%' },
        { t: 'slider', k: 'spread', label: 'Horizontal spread', min: 0, max: 200, step: 1, def: 70, unit: '%' },
        { t: 'slider', k: 'spin', label: 'Spin', min: -90, max: 90, step: 1, def: 12, unit: '°' },
        RATIO,
        { t: 'choice', k: 'flow', label: 'Flow', options: [['one', 'One by one'], ['stagger', 'Staggered']], def: 'one' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.85 * scale;
        const W = VIEW_HEIGHT * ctx.frameAspect;

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            // Chaque carte est lancee sur une parabole : elle part d'un cote,
            // monte, retombe de l'autre. La trajectoire ne depend que de sa
            // progression, donc l'image de fin egale celle du debut.
            const delay = P.flow === 'stagger' ? hash(i, 2) * 0.7 : (i / n) * 0.85;
            let u = ctx.t - delay;
            if (u < 0) u += 1;
            if (u > 0.62) continue;
            const t = u / 0.62;
            const dir = i % 2 ? -1 : 1;
            const x = (-dir + 2 * dir * t) * pct(P.spread) * W * 0.5;
            const y = Math.sin(t * Math.PI) * pct(P.throwHeight) * VIEW_HEIGHT * 0.55 - VIEW_HEIGHT * 0.3;
            const a = ((P.spin * Math.PI) / 180) * (t * 4 - 2) * dir;
            const { right, up } = spun(a);
            const s = 1 + (hash(i, 6) - 0.5) * pct(P.sizeVariation);
            quads.push(card(ctx, i, P.cardRatio, [x, y, i * 0.004], right, up, halfH * s, {
                radius: cornerRadius(P),
                alpha: clamp(Math.min(t, 1 - t) * 8, 0, 1),
            }));
        }
        return { camera: cameraFor(10), quads };
    },
};

export const positionDance = {
    id: 'position-dance',
    name: 'Position Dance',
    category: 'stack',
    slots: 6,
    loop: 4,
    params: [
        PADDING,
        { t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 4, unit: '%', dec: 1 },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 8, max: 70, step: 1, def: 28, unit: '%' },
        { t: 'slider', k: 'spacing', label: 'Spacing', min: -50, max: 100, step: 1, def: 0, unit: '%' },
        EASING, RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(2, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5 * scale;
        const R = (0.34 + pct(P.spacing) * 0.3) * VIEW_HEIGHT;

        /*
         * Les cartes occupent n places sur un cercle et permutent d'une place a
         * la suivante a chaque temps. Comme la permutation est circulaire, apres
         * n temps chacune est revenue chez elle : la danse boucle.
         */
        const raw = ctx.t * n;
        const step = Math.floor(raw);
        const t = ease(P.easing, clamp((raw - step - 0.25) / 0.75, 0, 1));

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            const from = ((i + step) % n) / n;
            const to = ((i + step + 1) % n) / n;
            // On interpole l'angle par le chemin le plus court, sinon une carte
            // ferait tout le tour a rebours au passage du zero.
            let delta = to - from;
            if (delta > 0.5) delta -= 1;
            if (delta < -0.5) delta += 1;
            const a = (from + delta * t) * TAU;
            quads.push(card(ctx, i, P.cardRatio,
                [Math.sin(a) * R * ctx.frameAspect * 0.75, Math.cos(a) * R, i * 0.003],
                [1, 0, 0], [0, 1, 0], halfH,
                { radius: cornerRadius(P) }));
        }
        return { camera: cameraFor(10), quads };
    },
};
