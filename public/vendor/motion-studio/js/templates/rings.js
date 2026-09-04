/*
 * Famille anneau : des cartes tangentes a un cercle, tournant autour de son axe.
 *
 * Showcase Stream montre l'anneau entier, incline, en ovale. Cover Ring utilise
 * un rayon enorme et decale l'anneau pour que sa carte de tete tombe pile a
 * l'origine : on ne voit alors qu'un arc tres doux, une carte a la fois.
 */

import {
    TAU, pct, card, cameraFor, paddingScale, depthFade, applyTilt, applyRoll, VIEW_HEIGHT,
} from './_helpers.js';
import { steppedProgress, ease } from '../engine/math.js';

const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };

/*
 * Table d'abscisse curviligne d'une ellipse : pour une fraction du perimetre,
 * elle rend l'angle correspondant.
 *
 * Sans elle, on espacerait les cartes a angle constant — et sur une ellipse, un
 * angle constant donne des cartes tassees aux extremites du petit axe et
 * ecartees sur le grand. C'est exactement le trou qu'on voyait sur les cotes de
 * l'anneau. A pas d'arc constant, l'anneau se referme.
 */
function arcTable(rx, rz, steps = 256) {
    const cum = new Float64Array(steps + 1);
    let prevX = 0;
    let prevZ = rz;
    for (let k = 1; k <= steps; k += 1) {
        const a = (k / steps) * TAU;
        const x = Math.sin(a) * rx;
        const z = Math.cos(a) * rz;
        cum[k] = cum[k - 1] + Math.hypot(x - prevX, z - prevZ);
        prevX = x;
        prevZ = z;
    }
    return cum;
}

function angleAtArc(cum, fraction) {
    const steps = cum.length - 1;
    const target = (((fraction % 1) + 1) % 1) * cum[steps];
    let lo = 0;
    let hi = steps;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= target) lo = mid; else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    return ((lo + (target - cum[lo]) / span) / steps) * TAU;
}

/*
 * Coeur commun. `vertical` bascule l'anneau dans le plan vertical.
 */
function buildRing(ctx, opts) {
    const { P } = ctx;
    const n = Math.max(2, opts.count);
    const scale = paddingScale(P.padding ?? 0);
    const R = pct(opts.ringSize) * 1.15 * scale;
    const Rz = R * (opts.opening === undefined ? 1 : 0.3 + pct(opts.opening) * 0.9);
    const halfH = pct(opts.cardSize) * VIEW_HEIGHT * 0.5 * scale;

    const phase = opts.stepped
        ? steppedProgress(ctx.t, n, opts.easing || 'custom')
        : ctx.t * n;
    const dir = opts.reverse ? -1 : 1;

    const quads = [];
    let near = -Infinity;
    let far = Infinity;
    const raw = [];
    const cum = arcTable(R, Rz);

    for (let i = 0; i < n; i += 1) {
        const a = angleAtArc(cum, (i - phase * dir) / n);
        const sin = Math.sin(a);
        const cos = Math.cos(a);
        // Position sur l'ellipse, puis le decalage qui amene la tete a l'origine.
        const px = sin * R;
        const pz = cos * Rz + opts.offsetZ;
        // Tangente a l'ellipse : c'est elle qui oriente la carte.
        const tx = cos * R;
        const tz = -sin * Rz;
        raw.push({ i, a, px, pz, tx, tz });
        near = Math.max(near, pz);
        far = Math.min(far, pz);
    }

    raw.forEach(({ i, px, pz, tx, tz }) => {
        let center = opts.vertical ? [0, px, pz] : [px, 0, pz];
        let right = opts.vertical ? [0, tx, tz] : [tx, 0, tz];
        let up = opts.vertical ? [0, 0, 0] : [0, 1, 0];
        if (opts.vertical) {
            // Anneau vertical : la carte reste face a l'anneau, le haut suit sa
            // tangente et la largeur reste horizontale.
            right = [1, 0, 0];
            up = [0, tx, tz];
            center = [0, px, pz];
        }

        const tilt = opts.tilt || 0;
        const roll = opts.roll || 0;
        const tf = (p) => applyRoll(applyTilt(p, tilt), roll);
        const c0 = tf(center);
        const r0 = tf([center[0] + right[0], center[1] + right[1], center[2] + right[2]]);
        const u0 = tf([center[0] + up[0], center[1] + up[1], center[2] + up[2]]);

        quads.push(card(ctx, i, P.cardRatio, c0,
            [r0[0] - c0[0], r0[1] - c0[1], r0[2] - c0[2]],
            [u0[0] - c0[0], u0[1] - c0[1], u0[2] - c0[2]],
            halfH,
            {
                radius: pct(P.cornerRadius ?? 0) * 6,
                fade: depthFade(pz, near, far, P.backFade ?? 0),
            }));
    });

    return quads;
}

export const showcaseStream = {
    id: 'showcase-stream',
    name: 'Showcase Stream',
    category: '3d',
    slots: 12,
    loop: 16,
    params: [
        { t: 'section', label: 'POSITION' },
        {
            t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
        },
        {
            t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 10, step: 0.5, def: 3, unit: '%', dec: 1,
        },
        {
            t: 'slider', k: 'ringTilt', label: 'Ring tilt', min: -80, max: 80, step: 1, def: -28, unit: '°',
        },
        {
            t: 'slider', k: 'ringOpening', label: 'Ring opening', min: 0, max: 100, step: 1, def: 55, unit: '%',
        },
        {
            t: 'slider', k: 'ringSize', label: 'Ring size', min: 20, max: 200, step: 1, def: 80, unit: '%',
        },
        {
            t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 60, step: 1, def: 21, unit: '%',
        },
        {
            t: 'slider', k: 'backFade', label: 'Back fade', min: 0, max: 100, step: 1, def: 70, unit: '%',
        },
        {
            t: 'slider', k: 'perspective', label: 'Perspective', min: 0, max: 100, step: 1, def: 18, unit: '%',
        },
        RATIO,
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        return {
            camera: cameraFor(P.perspective, 1),
            quads: buildRing(ctx, {
                count: ctx.slots,
                ringSize: P.ringSize,
                opening: P.ringOpening,
                cardSize: P.cardSize,
                tilt: P.ringTilt,
                offsetZ: 0,
            }),
        };
    },
};

const COVER_COMMON = [
    { t: 'section', label: 'POSITION' },
    {
        t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
    },
    {
        t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 10, step: 0.5, def: 3, unit: '%', dec: 1,
    },
    {
        t: 'slider', k: 'cardSize', label: 'Card size', min: 10, max: 80, step: 1, def: 37, unit: '%',
    },
    {
        t: 'slider', k: 'ringSize', label: 'Ring size', min: 40, max: 300, step: 1, def: 131, unit: '%',
    },
];

const COVER_TAIL = [
    {
        t: 'slider', k: 'tilt', label: 'Tilt', min: -60, max: 60, step: 1, def: 0, unit: '°',
    },
    {
        t: 'slider', k: 'perspective', label: 'Perspective', min: 0, max: 100, step: 1, def: 55, unit: '%',
    },
    {
        t: 'slider', k: 'backFade', label: 'Back fade', min: 0, max: 100, step: 1, def: 55, unit: '%',
    },
    { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' },
    RATIO,
];

const MOTION_CHOICE = {
    t: 'choice',
    k: 'motion',
    label: 'Motion',
    options: [['step', 'Step per card'], ['continuous', 'Continuous']],
    def: 'step',
};

export const coverRing = {
    id: 'cover-ring',
    name: 'Cover Ring',
    category: '3d',
    slots: 8,
    loop: 14,
    params: [
        ...COVER_COMMON,
        ...COVER_TAIL,
        {
            t: 'choice', k: 'direction', label: 'Direction', options: [['cw', 'Clockwise'], ['ccw', 'Counter-clockwise']], def: 'cw',
        },
        MOTION_CHOICE,
    ],
    build(ctx) {
        const { P } = ctx;
        const R = pct(P.ringSize) * 1.15 * paddingScale(P.padding);
        return {
            camera: cameraFor(P.perspective, 1),
            quads: buildRing(ctx, {
                count: ctx.slots,
                ringSize: P.ringSize,
                opening: 100,
                cardSize: P.cardSize,
                tilt: P.tilt,
                offsetZ: -R,
                stepped: P.motion === 'step',
                easing: P.easing,
                reverse: P.direction === 'ccw',
            }),
        };
    },
};

export const coverRingVertical = {
    id: 'cover-ring-vertical',
    name: 'Cover Ring Vertical',
    category: '3d',
    slots: 8,
    loop: 14,
    params: [
        ...COVER_COMMON,
        {
            t: 'slider', k: 'rotate', label: 'Rotate', min: -45, max: 45, step: 1, def: 0, unit: '°',
        },
        ...COVER_TAIL,
        {
            t: 'choice', k: 'direction', label: 'Direction', options: [['bottom-top', 'Bottom → top'], ['top-bottom', 'Top → bottom']], def: 'bottom-top',
        },
        MOTION_CHOICE,
    ],
    build(ctx) {
        const { P } = ctx;
        const R = pct(P.ringSize) * 1.15 * paddingScale(P.padding);
        return {
            camera: cameraFor(P.perspective, 1),
            quads: buildRing(ctx, {
                count: ctx.slots,
                ringSize: P.ringSize,
                opening: 100,
                cardSize: P.cardSize,
                tilt: 0,
                roll: P.rotate,
                offsetZ: -R,
                vertical: true,
                stepped: P.motion === 'step',
                easing: P.easing,
                reverse: P.direction === 'top-bottom',
            }),
        };
    },
};

export { ease };
