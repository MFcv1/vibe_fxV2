/*
 * Spiral Stream : une helice de cartes autour d'un axe vertical, qui s'ecoule.
 *
 * Chaque carte parcourt le meme chemin, decalee d'une fraction de tour. Comme
 * le chemin est periodique et que les cartes se relaient exactement, la boucle
 * se ferme sans raccord.
 */

import {
    cornerRadius, TAU, pct, card, cameraFor, paddingScale, clamp, applyTilt, VIEW_HEIGHT,
} from './_helpers.js';
import { ease, steppedProgress } from '../engine/math.js';

/*
 * Hauteur traversee par l'helice. Elle etait presque trois fois le cadre : les
 * cartes s'espacaient tellement qu'on lisait un eparpillement, pas une spirale.
 */
const HEIGHT = 2.6;

export const spiralStream = {
    id: 'spiral-stream',
    name: 'Spiral Stream',
    category: '3d',
    slots: 12,
    loop: 28,
    params: [
        { t: 'section', label: 'POSITION' },
        {
            t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
        },
        {
            t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 10, step: 0.5, def: 3, unit: '%', dec: 1,
        },
        {
            t: 'slider', k: 'turns', label: 'Spiral turns', min: 0.5, max: 8, step: 0.25, def: 3.75, unit: '', dec: 2,
        },
        {
            t: 'slider', k: 'count', label: 'Card count', min: 4, max: 64, step: 1, def: 24, unit: '',
        },
        {
            t: 'slider', k: 'spiralSize', label: 'Spiral size', min: 10, max: 150, step: 1, def: 62, unit: '%',
        },
        {
            t: 'slider', k: 'taper', label: 'Taper', min: -100, max: 100, step: 1, def: 0, unit: '%',
        },
        {
            t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 80, step: 1, def: 33, unit: '%',
        },
        {
            t: 'slider', k: 'backFade', label: 'Back fade', min: 0, max: 100, step: 1, def: 55, unit: '%',
        },
        {
            t: 'slider', k: 'perspective', label: 'Perspective', min: 0, max: 100, step: 1, def: 20, unit: '%',
        },
        {
            t: 'slider', k: 'ringTilt', label: 'Ring tilt', min: -60, max: 60, step: 1, def: 0, unit: '°',
        },
        {
            t: 'slider', k: 'cardGap', label: 'Card gap', min: 0, max: 100, step: 1, def: 28, unit: '%',
        },
        {
            t: 'slider', k: 'scalePulse', label: 'Scale pulse', min: 0, max: 100, step: 1, def: 0, unit: '%',
        },
        { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' },
        {
            t: 'choice', k: 'direction', label: 'Direction', options: [['down', 'Downward'], ['up', 'Upward']], def: 'down',
        },
        {
            t: 'choice', k: 'motion', label: 'Motion', options: [['continuous', 'Continuous'], ['pulse', 'Fast–slow–fast'], ['step', 'Step per card']], def: 'continuous',
        },
        { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' },
        {
            t: 'choice', k: 'cardStyle', label: 'Card style', options: [['curved', 'Curved (3D bend)'], ['upright', 'Upright (flat)']], def: 'curved',
        },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.round(P.count);
        const scale = paddingScale(P.padding);
        // Un rayon trop large fait balayer les cartes d'un bord a l'autre et on
        // ne lit plus l'helice : elle doit tenir dans le tiers central.
        const R = pct(P.spiralSize) * 0.62 * scale;
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5 * scale;
        const dir = P.direction === 'up' ? -1 : 1;
        const span = HEIGHT * (1 + pct(P.cardGap) * 0.6);

        let phase = ctx.t;
        if (P.motion === 'step') phase = steppedProgress(ctx.t, n, P.easing) / n;
        else if (P.motion === 'pulse') {
            // Vite au debut, lent au milieu, vite a la fin — sans casser la
            // continuite de la boucle : la vitesse revient a sa valeur de depart.
            phase = ctx.t + Math.sin(ctx.t * TAU) / TAU * 0.55;
        }

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            let s = (i / n + phase * dir) % 1;
            if (s < 0) s += 1;
            const eased = P.motion === 'step' ? s : ease(P.easing, s) * 0.15 + s * 0.85;
            const angle = eased * P.turns * TAU;
            const y = (0.5 - eased) * span;
            const radius = R * clamp(1 - pct(P.taper) * eased, 0.05, 3);
            const pulse = 1 + Math.sin(eased * TAU) * pct(P.scalePulse) * 0.5;

            const x = Math.sin(angle) * radius;
            const z = Math.cos(angle) * radius;
            let right = [Math.cos(angle), 0, -Math.sin(angle)];
            if (P.cardStyle === 'upright') right = [1, 0, 0];

            const tilt = P.ringTilt;
            const c0 = applyTilt([x, y, z], tilt);
            const r0 = applyTilt([x + right[0], y, z + right[2]], tilt);
            const u0 = applyTilt([x, y + 1, z], tilt);

            quads.push(card(ctx, i, P.cardRatio, c0,
                [r0[0] - c0[0], r0[1] - c0[1], r0[2] - c0[2]],
                [u0[0] - c0[0], u0[1] - c0[1], u0[2] - c0[2]],
                halfH * pulse,
                {
                    radius: cornerRadius(P),
                    fade: pct(P.backFade) * clamp((R - z) / (2 * R || 1), 0, 1),
                }));
        }
        return { camera: cameraFor(P.perspective, 1), quads };
    },
};
