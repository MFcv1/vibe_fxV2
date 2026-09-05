/*
 * Famille mur : une grille de cartes plaquee sur un cylindre, qui defile.
 *
 * La boucle est sans couture par construction : le mur avance exactement d'un
 * nombre entier de cartes egal au nombre de slots pendant un tour, et la
 * texture d'une case ne depend que de sa coordonnee logique. A t = 1 l'image est
 * donc identique a t = 0, sans fondu ni raccord.
 */

import {
    cornerRadius, pct, card, cameraFor, paddingScale, clamp, hash, waypointProgress, VIEW_HEIGHT,
} from './_helpers.js';
import { rotX } from '../engine/math.js';

const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };

const WALL_PARAMS = (zoomDef, gapDef) => [
    {
        t: 'slider', k: 'zoom', label: 'Zoom', min: 0, max: 100, step: 1, def: zoomDef, unit: '%',
    },
    {
        t: 'slider', k: 'tilt', label: 'Tilt', min: -45, max: 45, step: 1, def: 0, unit: '°',
    },
    {
        t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 30, step: 0.5, def: 13, unit: '%', dec: 1,
    },
    {
        t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 10, step: 0.5, def: 0.5, unit: '%', dec: 1,
    },
    {
        t: 'slider', k: 'curvature', label: 'Curvature (concave ⟷ convex)', min: -100, max: 100, step: 1, def: -100, unit: '%',
    },
    {
        t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 30, step: 0.25, def: gapDef, unit: '%', dec: 2,
    },
    {
        t: 'slider', k: 'edgeFade', label: 'Edge fade', min: 0, max: 100, step: 1, def: 0, unit: '%',
    },
    RATIO,
];

const MOTION_3 = {
    t: 'choice',
    k: 'motion',
    label: 'Motion',
    options: [['continuous', 'Continuous'], ['waypoints', 'Waypoints'], ['waypoints-nozoom', 'Waypoints (no zoom)']],
    def: 'continuous',
};

/*
 * Projette un point du plan du mur (u horizontal, v vertical) sur le cylindre.
 * `k` va de -1 (concave, les bords viennent vers nous) a +1 (convexe).
 */
function bend(u, v, k) {
    const strength = Math.abs(k);
    if (strength < 0.02) return [u, v, 0];
    // A -100% le mur doit visiblement s'enrouler autour du spectateur, pas
    // seulement se bomber : le rayon descend donc jusqu'a l'ordre de grandeur du
    // cadre lui-meme.
    const R = 1.9 / (strength + 0.045);
    const a = u / R;
    const z = (R - R * Math.cos(a)) * (k < 0 ? 1 : -1);
    return [R * Math.sin(a), v, z];
}

function buildWall(ctx, opts) {
    const { P } = ctx;
    const scale = paddingScale(P.padding);
    const cardH = (0.10 + pct(P.zoom) * 0.5) * VIEW_HEIGHT * scale;
    const sample = ctx.card(0, P.cardRatio);
    const cardW = cardH * sample.aspect;
    const gap = pct(P.gap);
    const stepX = cardW * (1 + gap * 2);
    const stepY = cardH * (1 + gap * 2);
    const k = P.curvature / 100;

    const viewW = VIEW_HEIGHT * ctx.frameAspect;
    const cols = clamp(Math.ceil(viewW / stepX) + 5, 3, 26);
    const rows = clamp(Math.ceil(VIEW_HEIGHT / stepY) + 5, 3, 26);
    const halfCols = Math.floor(cols / 2);
    const halfRows = Math.floor(rows / 2);

    const slots = Math.max(1, ctx.slots);
    let phase = ctx.t;
    if (opts.motion === 'waypoints' || opts.motion === 'waypoints-nozoom') {
        phase = waypointProgress(ctx.t, slots);
    }
    const step = opts.vertical ? stepY : stepX;

    /*
     * Combien de cartes le mur parcourt pendant une boucle. Ce nombre doit etre
     * un multiple du nombre de slots : une case prend alors, en fin de boucle,
     * la place d'une case qui portait deja la meme image, et le raccord devient
     * invisible. Un multiple non entier ferait sauter l'image a chaque tour.
     */
    const laneTravel = (lane) => {
        if (!opts.parallax) return slots;
        const spread = pct(P.parallaxDepth) * 2;
        const t = lane / 4 - 0.5;                 // -0.5 (devant) .. +0.5 (fond)
        return slots * clamp(Math.round(2 - t * spread * 2), 1, 4);
    };

    const offsetFor = (lane) => {
        const travel = laneTravel(lane) * step;
        return opts.alternate
            // "Alternate" ne change pas de sens d'un coup : le mur va et vient
            // sur une demi-course, ce qui reste une boucle fermee.
            ? Math.sin(phase * Math.PI * 2) * travel * 0.5
            : phase * travel * opts.sign;
    };

    const quads = [];
    for (let c = 0; c < cols; c += 1) {
        const lane = opts.parallax ? ((c % 5) + 5) % 5 : 0;
        const offset = offsetFor(lane);
        const depth = opts.parallax ? (lane / 4 - 0.5) * pct(P.parallaxDepth) * 2.6 : 0;
        const sizeScale = opts.parallax
            ? 1 + (hash(lane, 3) - 0.5) * pct(P.sizeVariation) * 1.2
            : 1;

        const baseCol = opts.vertical ? -halfCols : Math.floor(offset / stepX) - halfCols;
        const baseRow = opts.vertical ? Math.floor(offset / stepY) - halfRows : -halfRows;
        const col = baseCol + c;

        for (let r = 0; r < rows; r += 1) {
            const row = baseRow + r;
            // Les colonnes impaires descendent d'une demi-carte : c'est ce qui
            // donne les totems verticaux plutot qu'une grille alignee.
            const brick = opts.brick && Math.abs(col % 2) === 1 ? stepY * 0.5 : 0;

            let u = col * stepX - (opts.vertical ? 0 : offset);
            const v = -(row * stepY + brick) + (opts.vertical ? offset : 0);
            if (opts.parallax) {
                /*
                 * La dispersion est tiree sur `row` ramene au nombre de slots,
                 * pas sur `row` absolu : la course d'une colonne vaut toujours
                 * un multiple du nombre de slots, donc une case retrouve en fin
                 * de boucle exactement le meme decalage qu'au depart.
                 */
                const seedRow = ((row % slots) + slots) % slots;
                u += (hash(col * 7 + seedRow, 11) - 0.5) * pct(P.scatter) * stepX * 0.9;
            }

            const h = cardH * 0.5 * sizeScale;
            const p0 = bend(u, v, k);
            const px = bend(u + 0.01, v, k);
            const center = [p0[0], p0[1], p0[2] + depth];
            const right = [px[0] - p0[0], 0, px[2] - p0[2]];

            const tilt = (P.tilt * Math.PI) / 180;
            const tf = (p) => (tilt ? rotX(p, tilt) : p);
            const c0 = tf(center);
            const r0 = tf([center[0] + right[0], center[1], center[2] + right[2]]);
            const u0 = tf([center[0], center[1] + 1, center[2]]);

            const edge = pct(P.edgeFade) * clamp((Math.abs(u) / (viewW * 0.55)) - 0.55, 0, 1) * 2;
            const texIndex = ((col * 3 + row * 5) % slots + slots) % slots;

            quads.push(card(ctx, texIndex, P.cardRatio, c0,
                [r0[0] - c0[0], r0[1] - c0[1], r0[2] - c0[2]],
                [u0[0] - c0[0], u0[1] - c0[1], u0[2] - c0[2]],
                h,
                { radius: cornerRadius(P), fade: clamp(edge, 0, 1) }));
        }
    }
    return quads;
}

const wallCamera = () => cameraFor(28, 1);

export const sphereWall = {
    id: 'sphere-wall',
    name: 'Sphere Wall',
    category: '3d',
    slots: 8,
    loop: 20,
    params: [
        ...WALL_PARAMS(20, 5),
        MOTION_3,
        {
            t: 'choice', k: 'direction', label: 'Direction', options: [['left', 'Left'], ['right', 'Right'], ['alternate', 'Alternate']], def: 'left',
        },
    ],
    build(ctx) {
        const { P } = ctx;
        const sign = P.direction === 'right' ? -1 : 1;
        return {
            camera: wallCamera(),
            quads: buildWall(ctx, {
                sign, motion: P.motion, vertical: false, alternate: P.direction === 'alternate',
            }),
        };
    },
};

export const sphereCascade = {
    id: 'sphere-cascade',
    name: 'Sphere Cascade',
    category: '3d',
    slots: 8,
    loop: 20,
    params: [
        ...WALL_PARAMS(20, 5),
        MOTION_3,
        {
            t: 'choice', k: 'direction', label: 'Direction', options: [['up', 'Up'], ['down', 'Down'], ['alternate', 'Alternate']], def: 'up',
        },
    ],
    build(ctx) {
        const { P } = ctx;
        const sign = P.direction === 'down' ? -1 : 1;
        return {
            camera: wallCamera(),
            quads: buildWall(ctx, {
                sign, motion: P.motion, vertical: true, alternate: P.direction === 'alternate',
            }),
        };
    },
};

export const totemWall = {
    id: 'totem-wall',
    name: 'Totem Wall',
    category: '3d',
    slots: 8,
    loop: 20,
    params: [
        ...WALL_PARAMS(33, 4.5),
        {
            t: 'choice', k: 'direction', label: 'Direction', options: [['up', 'Up'], ['down', 'Down'], ['alternate', 'Alternate']], def: 'up',
        },
    ],
    build(ctx) {
        const { P } = ctx;
        const sign = P.direction === 'down' ? -1 : 1;
        // Les colonnes sont decalees d'une demi-carte : c'est ce qui donne les
        // totems verticaux plutot qu'une grille alignee.
        return {
            camera: wallCamera(),
            quads: buildWall(ctx, {
                sign, vertical: true, brick: true, alternate: P.direction === 'alternate',
            }),
        };
    },
};

export const parallaxTotem = {
    id: 'parallax-totem',
    name: 'Parallax Totem',
    category: '3d',
    slots: 8,
    loop: 20,
    params: [
        {
            t: 'slider', k: 'zoom', label: 'Zoom', min: 0, max: 100, step: 1, def: 50, unit: '%',
        },
        {
            t: 'slider', k: 'scatter', label: 'Scatter', min: 0, max: 100, step: 1, def: 70, unit: '%',
        },
        {
            t: 'slider', k: 'sizeVariation', label: 'Size variation', min: 0, max: 100, step: 1, def: 30, unit: '%',
        },
        {
            t: 'slider', k: 'parallaxDepth', label: 'Parallax depth', min: 0, max: 100, step: 1, def: 50, unit: '%',
        },
        {
            t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 30, step: 0.5, def: 13, unit: '%', dec: 1,
        },
        {
            t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 10, step: 0.5, def: 0.5, unit: '%', dec: 1,
        },
        {
            t: 'slider', k: 'curvature', label: 'Curvature (concave ⟷ convex)', min: -100, max: 100, step: 1, def: -100, unit: '%',
        },
        {
            t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 30, step: 0.25, def: 6.75, unit: '%', dec: 2,
        },
        {
            t: 'slider', k: 'edgeFade', label: 'Edge fade', min: 0, max: 100, step: 1, def: 0, unit: '%',
        },
        RATIO,
        {
            t: 'choice', k: 'direction', label: 'Direction', options: [['up', 'Up'], ['down', 'Down']], def: 'up',
        },
        { t: 'slider', k: 'tilt', label: 'Tilt', min: -45, max: 45, step: 1, def: 0, unit: '°', hidden: true },
    ],
    build(ctx) {
        const { P } = ctx;
        const sign = P.direction === 'down' ? -1 : 1;
        return {
            camera: wallCamera(),
            quads: buildWall(ctx, { sign, vertical: true, parallax: true }),
        };
    },
};
