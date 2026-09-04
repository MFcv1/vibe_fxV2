/*
 * Famille sphere : des cartes tangentes reparties sur un globe qui tourne.
 *
 * La repartition suit la spirale de Fibonacci — c'est ce qui donne des cartes
 * regulierement espacees jusqu'aux poles, la ou une grille latitude/longitude
 * les entasserait. Les cartes ne sont pas eliminees quand elles passent
 * derriere : on les voit par transparence de dos, comme sur la reference.
 */

import {
    TAU, pct, card, cameraFor, tangentBasis, clamp, waypointProgress, VIEW_HEIGHT,
} from './_helpers.js';
import { rotX, rotY } from '../engine/math.js';

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/*
 * Rotation du globe pour un sens donne. "Alternate" ne coupe pas le mouvement :
 * le globe balance d'un demi-tour dans un sens puis dans l'autre.
 */
function globeSpin(direction, t, waypoints, stops) {
    if (direction === 'alternate') return Math.sin(t * TAU) * Math.PI;
    const phase = waypoints ? waypointProgress(t, stops) : t;
    return phase * TAU * (direction === 'right' ? -1 : 1);
}

function buildGlobe(ctx, opts) {
    const { P } = ctx;
    const R = pct(P.globeSize) * 1.0;
    const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.25;
    const sample = ctx.card(0, P.cardRatio);
    const halfW = halfH * sample.aspect;

    /*
     * Combien de cartes tiennent sur la sphere : surface du globe divisee par
     * l'emprise d'une carte, gap compris.
     *
     * Le facteur de tassement est bas volontairement. Une sphere saturee de
     * petites cartes se lit comme une boule de mosaique ; la reference garde des
     * cartes espacees qu'on distingue encore une a une, surtout quand elles sont
     * grandes.
     */
    const cell = (halfW * 2) * (halfH * 2) * ((1 + pct(P.gap) * 2) ** 2);
    const count = clamp(Math.round(((4 * Math.PI * R * R) / Math.max(cell, 1e-4)) * 0.52), 6, 200);

    const spin = opts.spin;
    const tilt = (P.tilt * Math.PI) / 180;

    const quads = [];
    for (let i = 0; i < count; i += 1) {
        const y = 1 - (i / (count - 1 || 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = GOLDEN * i;
        let n = [Math.cos(theta) * r, y, Math.sin(theta) * r];
        n = rotY(n, spin);
        if (tilt) n = rotX(n, tilt);

        const { right, up } = tangentBasis(n);
        const center = [n[0] * R, n[1] * R, n[2] * R];
        // Fondu selon la face : une carte de dos se dilue dans le fond.
        const facing = clamp((n[2] + 1) / 2, 0, 1);
        quads.push(card(ctx, i, P.cardRatio, center, right, up, halfH, {
            radius: pct(P.cornerRadius) * 6,
            fade: pct(P.backFade) * (1 - facing),
        }));
    }
    return quads;
}

const GLOBE_PARAMS = (globeDef, cardDef, tiltDef) => [
    {
        t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 10, step: 0.5, def: 1, unit: '%', dec: 1,
    },
    {
        t: 'slider', k: 'globeSize', label: 'Globe size', min: 20, max: 140, step: 1, def: globeDef, unit: '%',
    },
    {
        t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 60, step: 1, def: cardDef, unit: '%',
    },
    {
        t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 20, step: 0.25, def: 2.5, unit: '%', dec: 2,
    },
    {
        t: 'slider', k: 'backFade', label: 'Back fade', min: 0, max: 100, step: 1, def: 55, unit: '%',
    },
    {
        t: 'slider', k: 'tilt', label: 'Tilt', min: -90, max: 90, step: 1, def: tiltDef, unit: '°',
    },
    { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' },
];

const DIRECTION = {
    t: 'choice',
    k: 'direction',
    label: 'Direction',
    options: [['left', 'Left'], ['right', 'Right'], ['alternate', 'Alternate']],
    def: 'left',
};

export const cardGlobe = {
    id: 'card-globe',
    name: 'Card Globe',
    category: '3d',
    slots: 12,
    loop: 20,
    params: [
        ...GLOBE_PARAMS(70, 20, 0),
        {
            t: 'choice', k: 'motion', label: 'Motion', options: [['continuous', 'Continuous'], ['waypoints', 'Waypoints'], ['waypoints-nozoom', 'Waypoints (no zoom)']], def: 'continuous',
        },
        DIRECTION,
    ],
    build(ctx) {
        const { P } = ctx;
        return {
            camera: cameraFor(24, 1),
            quads: buildGlobe(ctx, {
                spin: globeSpin(P.direction, ctx.t, P.motion !== 'continuous', ctx.slots),
            }),
        };
    },
};

export const orbitGlobe = {
    id: 'orbit-globe',
    name: 'Orbit Globe',
    category: '3d',
    slots: 12,
    loop: 20,
    params: [
        ...GLOBE_PARAMS(50, 28, 27),
        {
            t: 'choice', k: 'motion', label: 'Motion', options: [['continuous', 'Continuous'], ['waypoints', 'Waypoints']], def: 'continuous',
        },
        DIRECTION,
    ],
    build(ctx) {
        const { P } = ctx;
        return {
            camera: cameraFor(32, 1),
            quads: buildGlobe(ctx, {
                spin: globeSpin(P.direction, ctx.t, P.motion === 'waypoints', ctx.slots),
            }),
        };
    },
};
