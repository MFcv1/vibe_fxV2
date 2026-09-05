/*
 * Depth Stack Scroll : des cartes dispersees en profondeur qui defilent vers la
 * camera puis reviennent au fond.
 *
 * Le flou de profondeur n'existe pas dans le shader : il est fabrique en
 * empilant quelques copies legerement decalees et translucides de la meme
 * carte. C'est moins juste qu'un vrai flou gaussien, mais ca reste exact au
 * pixel entre l'apercu et l'export, ce qui est la propriete qui compte ici.
 */

import {
    cornerRadius, pct, card, cameraFor, clamp, hash, VIEW_HEIGHT,
} from './_helpers.js';

const SPAN = 9;      // profondeur parcourue
const NEAR = 1.35;   // ou la carte est la plus proche, juste avant la camera
const FADE_IN = 0.1; // part du trajet ou la carte apparait, puis disparait

export const depthStackScroll = {
    id: 'depth-stack-scroll',
    name: 'Depth Stack Scroll',
    category: '3d',
    slots: 12,
    loop: 14,
    params: [
        {
            t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 10, step: 0.5, def: 3, unit: '%', dec: 1,
        },
        {
            t: 'slider', k: 'cardSize', label: 'Card size', min: 5, max: 70, step: 1, def: 25, unit: '%',
        },
        {
            t: 'slider', k: 'count', label: 'Card count', min: 4, max: 64, step: 1, def: 24, unit: '',
        },
        {
            t: 'slider', k: 'depthGap', label: 'Depth gap', min: 0, max: 100, step: 1, def: 32, unit: '%',
        },
        {
            t: 'slider', k: 'spread', label: 'Spread', min: 0, max: 150, step: 1, def: 74, unit: '%',
        },
        {
            t: 'slider', k: 'wobble', label: 'Wobble', min: 0, max: 100, step: 1, def: 0, unit: '%',
        },
        {
            t: 'slider', k: 'depthFade', label: 'Depth fade', min: 0, max: 100, step: 1, def: 45, unit: '%',
        },
        {
            t: 'slider', k: 'depthBlur', label: 'Depth blur', min: 0, max: 100, step: 0.5, def: 0, unit: '%', dec: 1,
        },
        {
            t: 'choice', k: 'layout', label: 'Layout', options: [['fan', 'Fan'], ['scatter', 'Scatter']], def: 'fan',
        },
        {
            t: 'choice', k: 'direction', label: 'Direction', options: [['forward', 'Forward'], ['backward', 'Backward']], def: 'forward',
        },
        { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.round(P.count);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5;
        const dir = P.direction === 'backward' ? -1 : 1;
        const spread = pct(P.spread);
        const depthSpan = SPAN * (0.4 + pct(P.depthGap) * 1.2);

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            let s = (i / n + ctx.t * dir) % 1;
            if (s < 0) s += 1;
            // s = 0 au fond, 1 tout pres : les cartes viennent vers nous.
            const z = NEAR - (1 - s) * depthSpan;
            /*
             * Une carte ne doit jamais se teleporter du premier plan au fond :
             * elle s'efface juste avant de sortir du cadre et revient en fondu
             * tout au fond. C'est ce qui referme la boucle proprement.
             */
            const edgeAlpha = Math.min(s / FADE_IN, (1 - s) / FADE_IN, 1);

            let x; let y;
            if (P.layout === 'fan') {
                // Un eventail, pas un anneau : l'angle avance de l'angle d'or et
                // le rayon croit en racine, donc les cartes remplissent le cadre
                // au lieu de se ranger sur un cercle.
                const a = i * 2.39996;
                const r = Math.sqrt((i + 0.5) / n);
                x = Math.cos(a) * r * spread * 1.5;
                y = Math.sin(a) * r * spread * 1.0;
            } else {
                x = (hash(i, 1) - 0.5) * spread * 3.2;
                y = (hash(i, 2) - 0.5) * spread * 2.2;
            }
            if (P.wobble) {
                const w = pct(P.wobble) * 0.35;
                x += Math.sin(s * Math.PI * 4 + i) * w;
                y += Math.cos(s * Math.PI * 3 + i * 1.7) * w;
            }

            const depthT = clamp((NEAR - z) / depthSpan, 0, 1);
            const base = {
                radius: cornerRadius(P),
                fade: pct(P.depthFade) * depthT,
                alpha: clamp(edgeAlpha, 0, 1),
            };

            const blur = pct(P.depthBlur) * depthT;
            if (blur > 0.005) {
                const taps = 5;
                const spreadPx = blur * halfH * 0.5;
                for (let k = 0; k < taps; k += 1) {
                    const a = (k / taps) * Math.PI * 2;
                    quads.push(card(ctx, i, P.cardRatio,
                        [x + Math.cos(a) * spreadPx, y + Math.sin(a) * spreadPx, z],
                        [1, 0, 0], [0, 1, 0], halfH,
                        { ...base, alpha: base.alpha * 0.34, castShadow: false }));
                }
            }
            quads.push(card(ctx, i, P.cardRatio, [x, y, z], [1, 0, 0], [0, 1, 0], halfH, base));
        }
        return { camera: cameraFor(38, 1), quads };
    },
};
