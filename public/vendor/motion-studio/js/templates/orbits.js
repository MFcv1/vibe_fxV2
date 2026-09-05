/*
 * Famille orbite : des cartes qui tournent autour d'un centre en restant face a
 * nous, la ou la famille anneau les posait tangentes au cercle.
 *
 * Deux plans possibles : l'orbite couchee dans la profondeur (les cartes
 * passent derriere le centre) ou l'orbite dans le plan de l'ecran (elles
 * tournent comme les chiffres d'une horloge). Le reste — pulsation en passant
 * devant, fondu de l'arriere, arrets par carte — est commun.
 */

import {
    cornerRadius, TAU, pct, card, cameraFor, paddingScale, clamp, applyTilt, VIEW_HEIGHT,
} from './_helpers.js';
import { ease, steppedProgress } from '../engine/math.js';

const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };
const PADDING = {
    t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
};
const RADIUS = {
    t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 10, step: 0.5, def: 3, unit: '%', dec: 1,
};
const DIRECTION = {
    t: 'choice', k: 'direction', label: 'Direction', options: [['cw', 'Clockwise'], ['ccw', 'Counter-clockwise']], def: 'cw',
};

/*
 * "Fast–slow–fast" : la vitesse ondule sans jamais s'annuler ni casser la
 * boucle, parce qu'on ajoute a la progression une sinusoide de periode 1.
 */
function orbitPhase(motion, t, count, easing) {
    if (motion === 'step') return steppedProgress(t, count, easing || 'custom') / count;
    if (motion === 'pulse') return t + Math.sin(t * TAU) / TAU * 0.5;
    return t;
}

function buildOrbit(ctx, o) {
    const { P } = ctx;
    const n = Math.max(1, o.count);
    const scale = paddingScale(P.padding ?? 0);
    const rx = o.rx * scale;
    const ry = o.ry * scale;
    const halfH = pct(o.cardSize) * VIEW_HEIGHT * 0.5 * scale;
    const dir = o.reverse ? -1 : 1;
    const spread = o.spread === undefined ? 1 : pct(o.spread);

    const quads = [];
    for (let i = 0; i < n; i += 1) {
        const a = ((i / n) * spread - o.phase * dir) * TAU;
        const sin = Math.sin(a);
        const cos = Math.cos(a);

        // Dans le plan ecran, la deuxieme composante est verticale ; couchee en
        // profondeur, elle part vers le fond.
        const px = sin * rx;
        const secondary = cos * ry;
        const raw = o.screenPlane ? [px, secondary, 0] : [px, 0, secondary];
        if (o.lean) {
            // "Lean to centre" : les cartes se relevent d'autant plus qu'elles
            // sont loin de l'axe.
            raw[1] += -secondary * o.lean * 0.35;
        }
        if (o.bloom) {
            // La corolle : chaque carte s'ecarte du centre le long de son propre
            // rayon, ce qui ouvre l'anneau au lieu de le laisser plat.
            raw[0] += sin * rx * o.bloom;
            raw[1] += cos * ry * o.bloom * 0.8;
        }
        if (o.curve) raw[1] += (1 - cos) * o.curve * 0.5;

        const center = applyTilt(raw, o.tilt || 0);
        // La pulsation : la carte grossit quand elle passe devant.
        const front = o.screenPlane ? (sin + 1) / 2 : (secondary + ry) / (2 * ry || 1);
        const pulse = 1 + (front - 0.5) * pct(o.pulse || 0);
        const depth = o.screenPlane ? 0 : center[2];

        quads.push(card(ctx, i, P.cardRatio, center,
            o.tangent ? [cos, 0, -sin] : [1, 0, 0],
            [0, 1, 0],
            halfH * clamp(pulse, 0.05, 4),
            {
                radius: pct(P.cornerRadius ?? 0) * 6,
                fade: pct(o.backFade || 0) * clamp((depth + ry) / (2 * ry || 1), 0, 1) * (o.screenPlane ? 0 : 1),
            }));
    }
    return quads;
}

export const orbitShowcase = {
    id: 'orbit-showcase',
    name: 'Orbit Showcase',
    category: 'orbit',
    slots: 12,
    loop: 12,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'pulse', label: 'Pulse strength', min: 0, max: 200, step: 1, def: 60, unit: '%' },
        { t: 'slider', k: 'ringWidth', label: 'Ring width', min: 10, max: 160, step: 1, def: 64, unit: '%' },
        { t: 'slider', k: 'ringDepth', label: 'Ring depth', min: 0, max: 120, step: 1, def: 26, unit: '%' },
        { t: 'slider', k: 'ringTilt', label: 'Ring tilt', min: -70, max: 70, step: 1, def: 0, unit: '°' },
        { t: 'slider', k: 'spread', label: 'Spread', min: 20, max: 100, step: 1, def: 100, unit: '%' },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 60, step: 1, def: 22, unit: '%' },
        { t: 'slider', k: 'perspective', label: 'Perspective', min: 0, max: 100, step: 1, def: 55, unit: '%' },
        { t: 'slider', k: 'backFade', label: 'Back fade', min: 0, max: 100, step: 1, def: 45, unit: '%' },
        DIRECTION,
        { t: 'choice', k: 'motion', label: 'Motion', options: [['linear', 'Linear'], ['pulse', 'Fast–slow–fast']], def: 'linear' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        return {
            camera: cameraFor(P.perspective),
            quads: buildOrbit(ctx, {
                count: ctx.slots,
                rx: pct(P.ringWidth) * 1.6,
                ry: pct(P.ringDepth) * 1.6,
                cardSize: P.cardSize,
                tilt: P.ringTilt,
                spread: P.spread,
                pulse: P.pulse,
                backFade: P.backFade,
                reverse: P.direction === 'ccw',
                phase: orbitPhase(P.motion, ctx.t, ctx.slots),
            }),
        };
    },
};

export const orbitBloom = {
    id: 'orbit-bloom',
    name: 'Orbit Bloom',
    category: 'orbit',
    slots: 12,
    loop: 12,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'pulse', label: 'Pulse strength', min: 0, max: 200, step: 1, def: 60, unit: '%' },
        { t: 'slider', k: 'lean', label: 'Lean to centre', min: -100, max: 100, step: 1, def: 0, unit: '%' },
        { t: 'slider', k: 'ringWidth', label: 'Ring width', min: 10, max: 160, step: 1, def: 50, unit: '%' },
        { t: 'slider', k: 'ringDepth', label: 'Ring depth', min: 0, max: 120, step: 1, def: 25, unit: '%' },
        { t: 'slider', k: 'ringTilt', label: 'Ring tilt', min: -70, max: 70, step: 1, def: -29, unit: '°' },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 60, step: 1, def: 24, unit: '%' },
        { t: 'slider', k: 'perspective', label: 'Perspective', min: 0, max: 100, step: 1, def: 55, unit: '%' },
        { t: 'slider', k: 'backFade', label: 'Back fade', min: 0, max: 100, step: 1, def: 45, unit: '%' },
        { t: 'slider', k: 'curve', label: 'Curve (out / in)', min: -100, max: 100, step: 1, def: 0, unit: '%' },
        DIRECTION,
        { t: 'choice', k: 'motion', label: 'Motion', options: [['linear', 'Linear'], ['pulse', 'Fast–slow–fast']], def: 'linear' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        return {
            camera: cameraFor(P.perspective),
            quads: buildOrbit(ctx, {
                count: ctx.slots,
                rx: pct(P.ringWidth) * 1.6,
                ry: pct(P.ringDepth) * 1.6,
                cardSize: P.cardSize,
                tilt: P.ringTilt,
                pulse: P.pulse,
                backFade: P.backFade,
                lean: pct(P.lean),
                curve: pct(P.curve),
                bloom: 0.55,
                tangent: true,
                reverse: P.direction === 'ccw',
                phase: orbitPhase(P.motion, ctx.t, ctx.slots),
            }),
        };
    },
};

export const photoOrbit = {
    id: 'photo-orbit',
    name: 'Photo Orbit',
    category: 'orbit',
    slots: 8,
    loop: 18,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'pulse', label: 'Pulse strength', min: 0, max: 200, step: 1, def: 60, unit: '%' },
        { t: 'slider', k: 'ringWidth', label: 'Ring width', min: 10, max: 140, step: 1, def: 56, unit: '%' },
        { t: 'slider', k: 'ringHeight', label: 'Ring height', min: 10, max: 140, step: 1, def: 56, unit: '%' },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 70, step: 1, def: 26, unit: '%' },
        { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' },
        DIRECTION,
        { t: 'choice', k: 'motion', label: 'Motion', options: [['linear', 'Linear'], ['pulse', 'Fast–slow–fast'], ['step', 'Step per card']], def: 'linear' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        // Orbite dans le plan de l'ecran : rien ne part vers le fond, donc pas
        // de fondu de profondeur, et une focale longue pour rester plat.
        return {
            camera: cameraFor(12),
            quads: buildOrbit(ctx, {
                count: ctx.slots,
                screenPlane: true,
                rx: pct(P.ringWidth) * 1.3,
                ry: pct(P.ringHeight) * 1.3,
                cardSize: P.cardSize,
                pulse: P.pulse,
                reverse: P.direction === 'ccw',
                phase: orbitPhase(P.motion, ctx.t, ctx.slots, P.easing),
            }),
        };
    },
};

export const orbitCarousel = {
    id: 'orbit-carousel',
    name: 'Orbit Carousel',
    category: 'orbit',
    slots: 4,
    loop: 12,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'spread', label: 'Spread', min: 10, max: 150, step: 1, def: 70, unit: '%' },
        { t: 'slider', k: 'depthFade', label: 'Depth fade', min: 0, max: 100, step: 1, def: 60, unit: '%' },
        { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'frame', frame: true },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const r = pct(P.spread) * 1.5 * scale;
        const halfH = scale;
        const quads = [];
        for (let i = 0; i < n; i += 1) {
            const a = (i / n - ctx.t) * TAU;
            // De grandes cartes au format du cadre, qui se relaient en tournant
            // dans la profondeur : la plus proche cache les autres.
            const z = (Math.cos(a) - 1) * r;
            const x = Math.sin(a) * r * 0.55;
            const depth = clamp(-z / (2 * r || 1), 0, 1);
            quads.push(card(ctx, i, P.cardRatio, [x, 0, z], [1, 0, 0], [0, 1, 0], halfH, {
                radius: cornerRadius(P),
                fade: pct(P.depthFade) * depth,
            }));
        }
        return { camera: cameraFor(40), quads };
    },
};

export const focusOrbit = {
    id: 'focus-orbit',
    name: 'Focus Orbit',
    category: 'orbit',
    slots: 20,
    loop: 12,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'pulse', label: 'Pulse strength', min: 0, max: 200, step: 1, def: 60, unit: '%' },
        { t: 'slider', k: 'zoom', label: 'Zoom', min: 1, max: 6, step: 0.1, def: 2.4, unit: '×', dec: 1 },
        { t: 'slider', k: 'stops', label: 'Spin stops', min: 1, max: 12, step: 1, def: 5, unit: '' },
        { t: 'slider', k: 'ringSize', label: 'Ring size', min: 20, max: 150, step: 1, def: 72, unit: '%' },
        { t: 'slider', k: 'rotateY', label: 'Rotate Y', min: -60, max: 60, step: 1, def: 0, unit: '°' },
        { t: 'slider', k: 'perspective', label: 'Perspective', min: 0, max: 100, step: 1, def: 55, unit: '%' },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 4, max: 50, step: 1, def: 18, unit: '%' },
        { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' },
        DIRECTION,
        { t: 'choice', k: 'motion', label: 'Motion', options: [['smooth', 'Smooth'], ['pulse', 'Fast–slow–fast']], def: 'smooth' },
        { t: 'choice', k: 'zoomStyle', label: 'Zoom style', options: [['overlap', 'Overlap'], ['spotlight', 'Spotlight']], def: 'overlap' },
        { t: 'choice', k: 'cards', label: 'Cards', options: [['front', 'Face front'], ['follow', 'Follow rotation']], def: 'front' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const stops = Math.max(1, Math.round(P.stops));
        const scale = paddingScale(P.padding);
        const r = pct(P.ringSize) * 1.5 * scale;
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5 * scale;
        const dir = P.direction === 'ccw' ? -1 : 1;

        /*
         * L'anneau s'arrete `stops` fois par boucle, et a chaque arret la camera
         * plonge sur la carte de tete puis ressort. Les deux mouvements sont
         * tires du meme temps normalise, donc ils restent synchrones.
         */
        const raw = ctx.t * stops;
        const idx = Math.floor(raw);
        const local = raw - idx;
        const travel = ease(P.easing, clamp(local / 0.55, 0, 1));
        const step = Math.round(n / stops);
        const phase = ((idx * step) + travel * step) / n * dir;
        // Le zoom monte et redescend pendant le temps d'arret.
        const dwell = clamp((local - 0.55) / 0.45, 0, 1);
        const zoom = 1 + (P.zoom - 1) * Math.sin(dwell * Math.PI);

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            const a = (i / n - phase) * TAU;
            const x = Math.sin(a) * r;
            const y = Math.cos(a) * r;
            const front = (Math.cos(a) + 1) / 2;
            const pulse = 1 + (front - 0.5) * pct(P.pulse);
            const spot = P.zoomStyle === 'spotlight' ? (1 - front) * dwell * 0.75 : 0;
            const right = P.cards === 'follow'
                ? [Math.cos(a), Math.sin(a), 0]
                : [1, 0, 0];
            const up = P.cards === 'follow'
                ? [-Math.sin(a), Math.cos(a), 0]
                : [0, 1, 0];
            // L'anneau reste centre : le decaler d'un rayon sortait la moitie
            // des cartes du cadre.
            quads.push(card(ctx, i, P.cardRatio,
                [x * zoom, y * zoom, 0],
                right, up, halfH * clamp(pulse, 0.05, 4) * zoom,
                { radius: cornerRadius(P), fade: spot }));
        }
        return {
            camera: cameraFor(P.perspective),
            quads,
        };
    },
};

export const vortexSpin = {
    id: 'vortex-spin',
    name: 'Vortex Spin',
    category: 'orbit',
    slots: 8,
    loop: 20,
    params: [
        { t: 'section', label: 'POSITION' }, RADIUS,
        { t: 'slider', k: 'rings', label: 'Rings', min: 1, max: 6, step: 1, def: 3, unit: '' },
        { t: 'slider', k: 'ringSize', label: 'Ring size', min: 10, max: 100, step: 1, def: 34, unit: '%' },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 3, max: 40, step: 1, def: 15, unit: '%' },
        { t: 'slider', k: 'depth', label: 'Depth', min: 0, max: 100, step: 1, def: 50, unit: '%' },
        { t: 'slider', k: 'backFade', label: 'Back fade', min: 0, max: 100, step: 1, def: 35, unit: '%' },
        RATIO,
        { t: 'choice', k: 'cardStyle', label: 'Card style', options: [['curved', 'Curved'], ['flat', 'Flat']], def: 'curved' },
        { t: 'choice', k: 'direction', label: 'Direction', options: [['cw', 'Clockwise'], ['ccw', 'Counter-clockwise'], ['alt', 'Alternate']], def: 'cw' },
    ],
    build(ctx) {
        const { P } = ctx;
        const rings = Math.max(1, Math.round(P.rings));
        const per = Math.max(3, ctx.slots);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5;
        const spanZ = pct(P.depth) * 4;
        const quads = [];
        for (let ring = 0; ring < rings; ring += 1) {
            // Chaque anneau tourne dans le sens oppose au precedent : c'est ce
            // qui donne l'impression de vortex plutot que de manege.
            const flip = ring % 2 ? -1 : 1;
            const dir = P.direction === 'alt' ? Math.sin(ctx.t * TAU) : (P.direction === 'ccw' ? -1 : 1);
            const r = pct(P.ringSize) * 1.6 * (0.5 + (ring / Math.max(1, rings - 1 || 1)) * 0.9);
            const z = -(ring / Math.max(1, rings)) * spanZ;
            for (let i = 0; i < per; i += 1) {
                const a = (i / per + ctx.t * dir * flip) * TAU;
                const x = Math.sin(a) * r;
                const y = Math.cos(a) * r;
                quads.push(card(ctx, ring * per + i, P.cardRatio, [x, y, z],
                    P.cardStyle === 'curved' ? [Math.cos(a), Math.sin(a), 0] : [1, 0, 0],
                    P.cardStyle === 'curved' ? [-Math.sin(a), Math.cos(a), 0] : [0, 1, 0],
                    halfH,
                    {
                        radius: cornerRadius(P),
                        fade: pct(P.backFade) * (ring / Math.max(1, rings - 1 || 1)),
                    }));
            }
        }
        return { camera: cameraFor(34), quads };
    },
};

function wheel(ctx, o) {
    const { P } = ctx;
    const n = Math.max(1, ctx.slots);
    // La roue doit tenir dans le cadre : a 1.2 fois la hauteur visible, les
    // cartes sortaient toutes par les bords.
    const R = pct(P.wheelSize) * (o.radiusScale || 0.8);
    const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5;
    const dir = P.direction === 'ccw' ? -1 : 1;
    const turns = Math.max(0.25, P.rotations || 1);

    const spin = o.stepped
        ? steppedProgress(ctx.t, n * turns, P.easing || 'snappy') / (n * turns)
        : ctx.t;
    const base = spin * turns * TAU * dir;

    const quads = [];
    for (let i = 0; i < n; i += 1) {
        const a = (i / n) * TAU + base;
        const x = Math.sin(a) * R;
        const y = Math.cos(a) * R + o.centreY;
        let right = [1, 0, 0];
        let up = [0, 1, 0];
        if (P.spinStyle === 'wheel') {
            right = [Math.cos(a), -Math.sin(a), 0];
            up = [Math.sin(a), Math.cos(a), 0];
        } else if (P.spinStyle === 'self') {
            const s = -base * 2;
            right = [Math.cos(s), Math.sin(s), 0];
            up = [-Math.sin(s), Math.cos(s), 0];
        }
        // "3D flip" : la carte pivote sur son axe vertical, donc sa largeur
        // apparente se resserre puis se rouvre.
        const flip = P.spinStyle === 'flip' ? Math.abs(Math.cos(a * 2 + base * 2)) * 0.9 + 0.1 : 1;
        quads.push(card(ctx, i, P.cardRatio, [x, y, 0],
            [right[0] * flip, right[1] * flip, 0], up, halfH,
            { radius: cornerRadius(P) }));
    }
    return quads;
}

const WHEEL_TAIL = [
    { t: 'slider', k: 'rotations', label: 'Rotations / loop', min: 0.25, max: 4, step: 0.25, def: 1, unit: '', dec: 2 },
    DIRECTION, RATIO,
    { t: 'choice', k: 'movement', label: 'Movement', options: [['continuous', 'Continuous'], ['stepped', 'Stepped (tick)']], def: 'continuous' },
    { t: 'choice', k: 'spinStyle', label: 'Spin style', options: [['wheel', 'None (follow wheel)'], ['self', 'Self-rotate'], ['flip', '3D flip']], def: 'wheel' },
    { t: 'shadow' },
];

export const wheelSpin = {
    id: 'wheel-spin',
    name: 'Wheel Spin',
    category: 'orbit',
    slots: 8,
    loop: 14,
    params: [
        { t: 'section', label: 'POSITION' },
        { t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 5, unit: '%', dec: 1 },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 60, step: 1, def: 26, unit: '%' },
        { t: 'slider', k: 'wheelSize', label: 'Wheel size', min: 20, max: 180, step: 1, def: 92, unit: '%' },
        ...WHEEL_TAIL,
    ],
    build(ctx) {
        return {
            camera: cameraFor(10),
            quads: wheel(ctx, { centreY: 0, stepped: ctx.P.movement === 'stepped' }),
        };
    },
};

export const wheelSpinBottom = {
    id: 'wheel-spin-bottom',
    name: 'Wheel Spin Bottom',
    category: 'orbit',
    slots: 8,
    loop: 14,
    params: [
        { t: 'section', label: 'POSITION' },
        { t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 5, unit: '%', dec: 1 },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 60, step: 1, def: 20, unit: '%' },
        { t: 'slider', k: 'wheelSize', label: 'Wheel size', min: 20, max: 180, step: 1, def: 50, unit: '%' },
        { t: 'easing', k: 'easing', label: 'Easing', def: 'snappy' },
        ...WHEEL_TAIL,
    ],
    build(ctx) {
        // Le moyeu descend sous le cadre : on ne voit que l'arc du haut, les
        // cartes montent d'un cote et redescendent de l'autre.
        /*
         * Le rayon est bien plus grand ici que pour la roue centree : le moyeu
         * est hors cadre, et il faut que l'arc visible traverse largement le bas
         * de l'image. Au rayon de la roue centree, on ne voyait qu'un petit
         * anneau pose dans un coin.
         */
        const radiusScale = 1.9;
        const R = pct(ctx.P.wheelSize) * radiusScale;
        return {
            camera: cameraFor(10),
            quads: wheel(ctx, {
                centreY: -R * 0.86, radiusScale, stepped: ctx.P.movement === 'stepped',
            }),
        };
    },
};
