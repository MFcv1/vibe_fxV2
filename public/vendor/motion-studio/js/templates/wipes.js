/*
 * Famille balayage : l'image suivante ne bouge pas, c'est son masque qui
 * s'ouvre. Tout passe donc par le plan de coupe du shader — une carte est
 * rognee, jamais redimensionnee, sinon le contenu glisserait avec le bord.
 */

import {
    cornerRadius, pct, cameraFor, paddingScale, clamp, hash, VIEW_HEIGHT,
} from './_helpers.js';
import { ease } from '../engine/math.js';

const PADDING = {
    t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
};
const RADIUS = {
    t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 3, unit: '%', dec: 1,
};
const EASING = { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' };

// Une plaque plein cadre, eventuellement rognee par un demi-plan.
function plate(ctx, index, box, extra = {}) {
    const m = ctx.cardAt(index, box.w / box.h);
    return {
        p: [
            [box.x - box.w / 2, box.y + box.h / 2, extra.z || 0],
            [box.x + box.w / 2, box.y + box.h / 2, extra.z || 0],
            [box.x + box.w / 2, box.y - box.h / 2, extra.z || 0],
            [box.x - box.w / 2, box.y - box.h / 2, extra.z || 0],
        ],
        tex: m.tex,
        uvRect: m.uvRect,
        aspect: box.w / box.h,
        ...extra,
    };
}

function frameBox(ctx, padding) {
    const scale = paddingScale(padding);
    return {
        x: 0, y: 0, w: VIEW_HEIGHT * ctx.frameAspect * scale, h: VIEW_HEIGHT * scale,
    };
}

export const diagonalWipe = {
    id: 'diagonal-wipe',
    name: 'Diagonal Wipe',
    category: 'wipe',
    slots: 3,
    loop: 8,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'angle', label: 'Edge angle', min: -80, max: 80, step: 1, def: -20, unit: '°' },
        { t: 'slider', k: 'glow', label: 'Edge glow', min: 0, max: 100, step: 1, def: 60, unit: '%' },
        EASING,
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const box = frameBox(ctx, P.padding);
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const open = ease(P.easing, clamp((raw - index - 0.25) / 0.75, 0, 1));

        // La normale du plan de coupe porte l'angle du bord ; l'offset la fait
        // traverser toute la carte, coins compris.
        const a = ((P.angle - 90) * Math.PI) / 180;
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        const reach = (Math.abs(nx) + Math.abs(ny)) * 0.5 + 0.02;
        const radius = cornerRadius(P);

        return {
            camera: cameraFor(8),
            quads: [
                plate(ctx, index, box, { radius }),
                plate(ctx, index + 1, box, {
                    radius,
                    z: 0.01,
                    clip: [-nx, -ny, -reach + open * reach * 2, 0.004],
                    glow: pct(P.glow) * (open > 0.02 && open < 0.98 ? 1 : 0),
                }),
            ],
        };
    },
};

export const stripeReveal = {
    id: 'stripe-reveal',
    name: 'Stripe Reveal',
    category: 'wipe',
    slots: 3,
    loop: 8,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'strips', label: 'Strips', min: 2, max: 24, step: 1, def: 7, unit: '' },
        EASING,
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const strips = Math.max(2, Math.round(P.strips));
        const box = frameBox(ctx, P.padding);
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const radius = cornerRadius(P);

        const quads = [plate(ctx, index, box, { radius })];
        const sh = box.h / strips;
        for (let k = 0; k < strips; k += 1) {
            /*
             * Chaque bande decouvre l'image suivante avec un retard croissant,
             * et une bande sur deux part du bord oppose : c'est ce qui donne le
             * peigne caracteristique.
             */
            /*
             * Le decalage et la duree doivent tenir dans le cycle : 0.1 + 0.35 +
             * 0.45 = 0.9. Au-dela, les dernieres bandes n'etaient pas tout a
             * fait ouvertes a la fin du tour, et la boucle sautait.
             */
            const delay = (k / Math.max(1, strips - 1)) * 0.35;
            const open = ease(P.easing, clamp((local - 0.1 - delay) / 0.45, 0, 1));
            const fromLeft = k % 2 === 0;
            const y = box.y + box.h / 2 - sh / 2 - k * sh;
            const m = ctx.cardAt(index + 1, box.w / box.h);
            // La bande ne porte pas d'arrondi propre : elle herite du masque du
            // cadre entier, exprime dans son repere (hauteur d'une bande = 1).
            const frameMask = [
                box.w / sh / 2,
                box.h / sh / 2,
                0,
                (y - box.y) / sh,
                radius * (Math.min(box.w, box.h) / sh),
            ];
            // La bande porte le cadrage de l'image entiere, pas le sien : sinon
            // chaque bande montrerait toute l'image compressee.
            const v0 = m.uvRect[1] + (k / strips) * m.uvRect[3];
            quads.push({
                p: [
                    [box.x - box.w / 2, y + sh / 2, 0.01], [box.x + box.w / 2, y + sh / 2, 0.01],
                    [box.x + box.w / 2, y - sh / 2, 0.01], [box.x - box.w / 2, y - sh / 2, 0.01],
                ],
                tex: m.tex,
                uvRect: [m.uvRect[0], v0, m.uvRect[2], m.uvRect[3] / strips],
                aspect: box.w / sh,
                radius: 0,
                frameMask,
                clip: [fromLeft ? 1 : -1, 0, -0.5 + open, 0.003],
            });
        }
        return { camera: cameraFor(8), quads };
    },
};

export const splitReveal = {
    id: 'split-reveal',
    name: 'Split Reveal',
    category: 'wipe',
    slots: 4,
    loop: 8,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'ratio', label: 'Split ratio', min: 10, max: 90, step: 1, def: 50, unit: '%' },
        { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 12, step: 0.5, def: 2, unit: '%', dec: 1 },
        EASING, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const box = frameBox(ctx, P.padding);
        const gap = box.w * pct(P.gap);
        const leftW = (box.w - gap) * pct(P.ratio);
        const rightW = box.w - gap - leftW;
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const radius = cornerRadius(P);

        // Les deux volets ne partent pas ensemble : le gauche mene, le droit
        // suit d'un quart de temps. C'est ce decalage qui fait la lecture.
        const openL = ease(P.easing, clamp((local - 0.15) / 0.5, 0, 1));
        const openR = ease(P.easing, clamp((local - 0.35) / 0.5, 0, 1));
        const panel = (x, w, idx, open, dirn) => {
            const m = ctx.cardAt(idx, w / box.h);
            return {
                p: [
                    [x - w / 2, box.h / 2, 0.01], [x + w / 2, box.h / 2, 0.01],
                    [x + w / 2, -box.h / 2, 0.01], [x - w / 2, -box.h / 2, 0.01],
                ],
                tex: m.tex,
                uvRect: m.uvRect,
                aspect: w / box.h,
                radius,
                clip: open >= 1 ? null : [0, dirn, -0.5 + open, 0.003],
            };
        };
        const lx = -box.w / 2 + leftW / 2;
        const rx = box.w / 2 - rightW / 2;
        return {
            camera: cameraFor(8),
            quads: [
                panel(lx, leftW, index * 2, 1, 1),
                panel(rx, rightW, index * 2 + 1, 1, 1),
                panel(lx, leftW, index * 2 + 2, openL, 1),
                panel(rx, rightW, index * 2 + 3, openR, -1),
            ],
        };
    },
};

export const mosaicWipe = {
    id: 'mosaic-wipe',
    name: 'Mosaic Wipe',
    category: 'wipe',
    slots: 4,
    loop: 8,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'rows', label: 'Rows', min: 1, max: 12, step: 1, def: 4, unit: '' },
        { t: 'slider', k: 'cols', label: 'Columns', min: 1, max: 12, step: 1, def: 4, unit: '' },
        { t: 'slider', k: 'stagger', label: 'Stagger', min: 0, max: 100, step: 1, def: 60, unit: '%' },
        { t: 'slider', k: 'speedVar', label: 'Speed Variation', min: 0, max: 100, step: 1, def: 0, unit: '%' },
        EASING,
        { t: 'choice', k: 'style', label: 'Style', options: [['grid', 'Grid'], ['blinds', 'Blinds']], def: 'grid' },
        {
            t: 'choice',
            k: 'pattern',
            label: 'Pattern',
            options: [['normal', 'Normal'], ['diag', 'Diagonal'], ['radial', 'Radial'], ['spiral', 'Spiral'], ['random', 'Random']],
            def: 'normal',
        },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const rows = Math.max(1, Math.round(P.rows));
        const cols = Math.max(1, Math.round(P.cols));
        const box = frameBox(ctx, P.padding);
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const radius = cornerRadius(P);

        const quads = [plate(ctx, index, box, { radius })];
        const cw = box.w / cols;
        const ch = box.h / rows;
        const m = ctx.cardAt(index + 1, box.w / box.h);

        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                // L'ordre d'ouverture des tuiles : le motif ne change que le
                // rang de chacune, la mecanique reste la meme.
                let rank;
                if (P.pattern === 'diag') rank = (r + c) / (rows + cols - 2 || 1);
                else if (P.pattern === 'radial') {
                    const dx = (c - (cols - 1) / 2) / (cols || 1);
                    const dy = (r - (rows - 1) / 2) / (rows || 1);
                    rank = Math.hypot(dx, dy) * 1.6;
                } else if (P.pattern === 'spiral') {
                    const a = Math.atan2(r - (rows - 1) / 2, c - (cols - 1) / 2);
                    rank = ((a + Math.PI) / (Math.PI * 2) + Math.hypot(r, c) * 0.05) % 1;
                } else if (P.pattern === 'random') rank = hash(r * 31 + c, 9);
                else rank = (r * cols + c) / (rows * cols - 1 || 1);

                // Meme contrainte que pour les bandes : depart + decalage
                // maximal + duree doivent rester sous un cycle complet.
                const delay = clamp(rank, 0, 1) * pct(P.stagger) * 0.4;
                const speed = 1 + (hash(r * 17 + c, 4) - 0.5) * pct(P.speedVar);
                const open = ease(P.easing, clamp(((local - 0.08 - delay) * speed) / 0.45, 0, 1));
                if (open <= 0) continue;

                const x = -box.w / 2 + cw / 2 + c * cw;
                const y = box.h / 2 - ch / 2 - r * ch;
                // Meme principe que pour les bandes : la tuile herite du cadre.
                const frameMask = [
                    box.w / ch / 2,
                    box.h / ch / 2,
                    -x / ch,
                    (y - box.y) / ch,
                    radius * (Math.min(box.w, box.h) / ch),
                ];
                quads.push({
                    p: [
                        [x - cw / 2, y + ch / 2, 0.01], [x + cw / 2, y + ch / 2, 0.01],
                        [x + cw / 2, y - ch / 2, 0.01], [x - cw / 2, y - ch / 2, 0.01],
                    ],
                    tex: m.tex,
                    uvRect: [
                        m.uvRect[0] + (c / cols) * m.uvRect[2], m.uvRect[1] + (r / rows) * m.uvRect[3],
                        m.uvRect[2] / cols, m.uvRect[3] / rows,
                    ],
                    aspect: cw / ch,
                    radius: 0,
                    frameMask,
                    // "Blinds" ouvre chaque tuile comme un store, du haut vers le
                    // bas ; "Grid" la fait apparaitre par la gauche.
                    clip: open >= 1 ? null
                        : P.style === 'blinds' ? [0, 1, -0.5 + open, 0.003] : [1, 0, -0.5 + open, 0.003],
                });
            }
        }
        return { camera: cameraFor(8), quads };
    },
};
