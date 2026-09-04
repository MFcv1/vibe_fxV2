/*
 * Famille Signature — nos propres animations.
 *
 * Les neuf autres familles reprennent le catalogue de reference et gardent ses
 * comptes exacts. Celle-ci ajoute ce qui manque pour une story ou un reel de
 * 2026 : des mouvements courts, francs, avec du temps de lecture — la ou un
 * defilement continu finit par ressembler a un diaporama.
 *
 * Deux principes tenus partout ici :
 *  - un TEMPS D'ARRET sur chaque image, sinon rien n'est lisible au defilement ;
 *  - une entree qui depasse legerement sa cible avant de se poser, parce qu'un
 *    mouvement qui s'arrete pile sur sa valeur a l'air mecanique.
 */

import {
    TAU, pct, card, cameraFor, paddingScale, clamp, hash, VIEW_HEIGHT,
} from './_helpers.js';
import { ease } from '../engine/math.js';

const RATIO_FRAME = {
    t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'frame', frame: true,
};
const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };
const PADDING = (def = 6) => ({
    t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def, unit: '%', dec: 1,
});
const RADIUS = (def = 3) => ({
    t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 14, step: 0.5, def, unit: '%', dec: 1,
});
const HOLD = (def) => ({
    t: 'slider', k: 'hold', label: 'Hold', min: 0, max: 85, step: 1, def, unit: '%',
});
const EASING = (def) => ({ t: 'easing', k: 'easing', label: 'Easing', def });

// Ou en est-on dans le passage d'une image a la suivante.
function beat(t, n, hold, easing) {
    const raw = t * n;
    const index = Math.floor(raw);
    const local = raw - index;
    const h = pct(hold);
    const move = ease(easing, clamp((local - h) / (1 - h || 1), 0, 1));
    return { index, local, move };
}

const spun = (a) => ({ right: [Math.cos(a), Math.sin(a), 0], up: [-Math.sin(a), Math.cos(a), 0] });

export const beatPunch = {
    id: 'beat-punch',
    name: 'Beat Punch',
    category: 'signature',
    slots: 6,
    loop: 6,
    params: [
        PADDING(4), RADIUS(4),
        { t: 'slider', k: 'punch', label: 'Punch', min: 0, max: 100, step: 1, def: 52, unit: '%' },
        { t: 'slider', k: 'drift', label: 'Drift', min: 0, max: 60, step: 1, def: 14, unit: '%' },
        HOLD(58), EASING('overshoot'), RATIO_FRAME, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const half = VIEW_HEIGHT * 0.5 * scale;
        const { index, local, move } = beat(ctx.t, n, P.hold, P.easing);

        /*
         * L'image entrante arrive plus grande que le cadre et se pose dessus.
         * Pendant le temps d'arret elle continue de deriver tres lentement :
         * une image parfaitement fixe entre deux coupes fige toute la sequence.
         */
        const drift = 1 + pct(P.drift) * 0.12 * local;
        const punch = 1 + pct(P.punch) * 0.55 * (1 - move);
        const quads = [];
        quads.push(card(ctx, index, P.cardRatio, [0, 0, 0], [1, 0, 0], [0, 1, 0],
            half * drift, { radius: pct(P.cornerRadius) * 6, alpha: 1 - clamp((move - 0.5) / 0.5, 0, 1) }));
        if (move > 0) {
            quads.push(card(ctx, index + 1, P.cardRatio, [0, 0, 0.02], [1, 0, 0], [0, 1, 0],
                half * punch, { radius: pct(P.cornerRadius) * 6, alpha: clamp(move * 2.2, 0, 1) }));
        }
        return { camera: cameraFor(8), quads };
    },
};

export const swipeStack = {
    id: 'swipe-stack',
    name: 'Swipe Stack',
    category: 'signature',
    slots: 6,
    loop: 8,
    params: [
        PADDING(8), RADIUS(5),
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 30, max: 100, step: 1, def: 72, unit: '%' },
        { t: 'slider', k: 'peek', label: 'Stack peek', min: 0, max: 20, step: 0.5, def: 5, unit: '%', dec: 1 },
        { t: 'slider', k: 'flick', label: 'Flick angle', min: 0, max: 60, step: 1, def: 22, unit: '°' },
        HOLD(45), EASING('snappy'), RATIO,
        { t: 'choice', k: 'side', label: 'Flick to', options: [['alt', 'Alternate'], ['left', 'Left'], ['right', 'Right']], def: 'alt' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const half = pct(P.cardSize) * VIEW_HEIGHT * 0.5 * scale;
        const peek = pct(P.peek) * VIEW_HEIGHT;
        const { index, move } = beat(ctx.t, n, P.hold, P.easing);

        // On dessine du fond vers le dessus : la carte de tete part sur le cote
        // en pivotant, les suivantes remontent d'un cran.
        const quads = [];
        const dir = P.side === 'left' ? -1 : P.side === 'right' ? 1 : (index % 2 ? -1 : 1);
        for (let k = Math.min(n, 4) - 1; k >= 0; k -= 1) {
            const depth = Math.max(k - move, 0);
            const isTop = k === 0;
            const x = isTop ? dir * move * VIEW_HEIGHT * ctx.frameAspect * 0.95 : 0;
            const a = isTop ? dir * move * (P.flick * Math.PI) / 180 : 0;
            const { right, up } = spun(a);
            quads.push(card(ctx, index + k, P.cardRatio, [x, -depth * peek, -depth * 0.02],
                right, up, half * (1 - depth * 0.045),
                {
                    radius: pct(P.cornerRadius) * 6,
                    fade: depth * 0.07,
                    // La carte de tete reste opaque presque jusqu'''au bout : la
                    // voir se diluer des le debut du geste laissait apparaitre
                    // la pile a travers elle.
                    alpha: isTop ? 1 - clamp((move - 0.82) / 0.18, 0, 1) : 1,
                }));
        }
        return { camera: cameraFor(12), quads };
    },
};

export const splitSlide = {
    id: 'split-slide',
    name: 'Split Slide',
    category: 'signature',
    slots: 5,
    loop: 7,
    params: [
        // Rayon nul par defaut : les bandes sont a fond perdu, un arrondi y
        // creuse une encoche noire au milieu du cadre au lieu d'adoucir un coin.
        PADDING(0), RADIUS(0),
        { t: 'slider', k: 'bands', label: 'Bands', min: 2, max: 8, step: 1, def: 3, unit: '' },
        { t: 'slider', k: 'stagger', label: 'Stagger', min: 0, max: 100, step: 1, def: 38, unit: '%' },
        HOLD(42), EASING('slowdown'),
        { t: 'choice', k: 'axis', label: 'Axis', options: [['h', 'Horizontal'], ['v', 'Vertical']], def: 'h' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const bands = Math.max(2, Math.round(P.bands));
        const scale = paddingScale(P.padding);
        const W = VIEW_HEIGHT * ctx.frameAspect * scale;
        const H = VIEW_HEIGHT * scale;
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const h = pct(P.hold);
        const radius = pct(P.cornerRadius) * 6;
        const vertical = P.axis === 'v';

        /*
         * Le cadre est decoupe en bandes qui glissent en sens alterne. Chaque
         * bande porte sa tranche d'image et non l'image entiere : c'est ce qui
         * fait qu'on lit un decoupage, et pas plusieurs copies qui se croisent.
         */
        const quads = [];
        for (let k = 0; k < bands; k += 1) {
            const delay = (k / Math.max(1, bands - 1)) * pct(P.stagger) * (1 - h) * 0.8;
            const m = ease(P.easing, clamp((local - h - delay) / ((1 - h) * 0.8 || 1), 0, 1));
            const dir = k % 2 ? -1 : 1;
            const bw = vertical ? W / bands : W;
            const bh = vertical ? H : H / bands;
            const cx = vertical ? -W / 2 + bw / 2 + k * bw : 0;
            const cy = vertical ? 0 : H / 2 - bh / 2 - k * bh;

            const band = (idx, shift, alpha) => {
                const media = ctx.cardAt(idx, W / H);
                const u0 = vertical ? (k / bands) : 0;
                const v0 = vertical ? 0 : (k / bands);
                const uw = vertical ? 1 / bands : 1;
                const vh = vertical ? 1 : 1 / bands;
                const x = cx + (vertical ? 0 : shift);
                const y = cy + (vertical ? shift : 0);
                return {
                    p: [
                        [x - bw / 2, y + bh / 2, 0], [x + bw / 2, y + bh / 2, 0],
                        [x + bw / 2, y - bh / 2, 0], [x - bw / 2, y - bh / 2, 0],
                    ],
                    tex: media.tex,
                    uvRect: [
                        media.uvRect[0] + u0 * media.uvRect[2],
                        media.uvRect[1] + v0 * media.uvRect[3],
                        media.uvRect[2] * uw, media.uvRect[3] * vh,
                    ],
                    aspect: bw / bh,
                    radius: 0,
                    alpha,
                    frameMask: [W / bh / 2, H / bh / 2, -cx / bh, (0 - cy) / bh, radius * (Math.min(W, H) / bh)],
                };
            };
            const travel = (vertical ? H : W) * 1.05;
            quads.push(band(index, dir * m * travel, 1));
            if (m > 0) quads.push(band(index + 1, dir * (m - 1) * travel, 1));
        }
        return { camera: cameraFor(8), quads };
    },
};

export const kineticWave = {
    id: 'kinetic-wave',
    name: 'Kinetic Wave',
    category: 'signature',
    slots: 9,
    loop: 8,
    params: [
        PADDING(5), RADIUS(3),
        { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 12, step: 0.5, def: 2, unit: '%', dec: 1 },
        { t: 'slider', k: 'amplitude', label: 'Wave depth', min: 0, max: 100, step: 1, def: 55, unit: '%' },
        { t: 'slider', k: 'angle', label: 'Wave angle', min: 0, max: 180, step: 1, def: 35, unit: '°' },
        HOLD(30), EASING('smooth'),
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const cols = Math.max(1, Math.round(Math.sqrt(n)));
        const rows = Math.ceil(n / cols);
        const scale = paddingScale(P.padding);
        const W = VIEW_HEIGHT * ctx.frameAspect * scale;
        const H = VIEW_HEIGHT * scale;
        const gap = pct(P.gap);
        const cw = W / cols;
        const ch = H / rows;
        const raw = ctx.t * 1;
        const a = (P.angle * Math.PI) / 180;
        const radius = pct(P.cornerRadius) * 6;

        /*
         * Une onde traverse la grille en diagonale : chaque tuile se retourne a
         * son passage et revient avec l'image suivante. Le retard d'une tuile
         * depend de sa projection sur l'axe de l'onde, ce qui donne un front net
         * plutot qu'un scintillement desordonne.
         */
        const quads = [];
        for (let i = 0; i < n; i += 1) {
            const c = i % cols;
            const r = Math.floor(i / cols);
            const px = (c + 0.5) / cols - 0.5;
            const py = (r + 0.5) / rows - 0.5;
            const along = (px * Math.cos(a) + py * Math.sin(a) + 1) / 2;
            const local = (raw - along * 0.55 + 1) % 1;
            const m = ease(P.easing, clamp((local - pct(P.hold)) / 0.35, 0, 1));
            // Au milieu du retournement la tuile est vue par la tranche.
            const turn = Math.cos(m * Math.PI);
            const squash = Math.max(Math.abs(turn), 0.03);
            const cycle = Math.floor(raw - along * 0.55 + 1);
            const face = turn >= 0 ? cycle : cycle + 1;

            const x = -W / 2 + cw / 2 + c * cw;
            const y = H / 2 - ch / 2 - r * ch;
            const hw = (cw * (1 - gap)) / 2 * squash;
            const hh = (ch * (1 - gap)) / 2;
            const z = (1 - Math.abs(turn)) * pct(P.amplitude) * 0.5;
            const media = ctx.cardAt(face * n + i, (cw * (1 - gap)) / (ch * (1 - gap)));
            quads.push({
                p: [
                    [x - hw, y + hh, z], [x + hw, y + hh, z],
                    [x + hw, y - hh, z], [x - hw, y - hh, z],
                ],
                tex: media.tex,
                uvRect: media.uvRect,
                aspect: cw / ch,
                radius,
            });
        }
        return { camera: cameraFor(14), quads };
    },
};

export const pushCut = {
    id: 'push-cut',
    name: 'Push Cut',
    category: 'signature',
    slots: 5,
    loop: 6,
    params: [
        PADDING(0), RADIUS(0),
        { t: 'slider', k: 'recede', label: 'Outgoing scale', min: 0, max: 60, step: 1, def: 22, unit: '%' },
        HOLD(55), EASING('snappy'),
        {
            t: 'choice',
            k: 'direction',
            label: 'Direction',
            options: [['left', '← Left'], ['right', 'Right →'], ['up', '↑ Up'], ['alt', 'Alternate']],
            def: 'left',
        },
        RATIO_FRAME,
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const half = VIEW_HEIGHT * 0.5 * scale;
        const { index, move } = beat(ctx.t, n, P.hold, P.easing);

        /*
         * La coupe poussee : l'image sortante recule legerement pendant que
         * l'entrante la chasse. Ce petit recul est ce qui donne la profondeur —
         * sans lui, deux plans qui glissent cote a cote restent plats.
         */
        const dirs = {
            left: [-1, 0], right: [1, 0], up: [0, 1], alt: index % 2 ? [1, 0] : [-1, 0],
        };
        const [dx, dy] = dirs[P.direction] || dirs.left;
        const travel = VIEW_HEIGHT * (dx ? ctx.frameAspect : 1) * 1.02;
        const out = 1 - pct(P.recede) * 0.45 * move;

        const quads = [
            card(ctx, index, P.cardRatio,
                [dx * move * travel * 0.35, dy * move * travel * 0.35, 0],
                [1, 0, 0], [0, 1, 0], half * out,
                { radius: pct(P.cornerRadius) * 6, fade: move * 0.25 }),
            card(ctx, index + 1, P.cardRatio,
                [-dx * (1 - move) * travel, -dy * (1 - move) * travel, 0.02],
                [1, 0, 0], [0, 1, 0], half,
                { radius: pct(P.cornerRadius) * 6 }),
        ];
        return { camera: cameraFor(8), quads };
    },
};

export const depthPop = {
    id: 'depth-pop',
    name: 'Depth Pop',
    category: 'signature',
    slots: 4,
    loop: 9,
    params: [
        PADDING(9), RADIUS(4),
        { t: 'slider', k: 'depth', label: 'Depth', min: 0, max: 100, step: 1, def: 46, unit: '%' },
        { t: 'slider', k: 'sway', label: 'Sway', min: 0, max: 60, step: 1, def: 22, unit: '%' },
        { t: 'slider', k: 'echo', label: 'Back echo', min: 0, max: 100, step: 1, def: 45, unit: '%' },
        HOLD(52), EASING('natural'), RATIO_FRAME, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const half = VIEW_HEIGHT * 0.5 * scale;
        const { index, local, move } = beat(ctx.t, n, P.hold, P.easing);

        /*
         * Un plan detache du fond, qui oscille doucement : le "faux 3D" qu'on
         * voit partout sur les reels. L'echo derriere est la meme image, plus
         * grande et delavee, ce qui creuse la profondeur sans deuxieme photo.
         */
        const sway = Math.sin(ctx.t * TAU) * pct(P.sway) * 0.13;
        const pop = pct(P.depth) * 0.5;
        const quads = [];
        const echo = pct(P.echo);
        if (echo > 0.02) {
            quads.push(card(ctx, index, P.cardRatio, [-sway * 0.35, 0, -pop], [1, 0, 0], [0, 1, 0],
                half * 1.24, {
                    radius: pct(P.cornerRadius) * 6,
                    fade: 0.55,
                    alpha: echo,
                    castShadow: false,
                }));
        }
        quads.push(card(ctx, index, P.cardRatio, [sway, 0, 0], [1, 0, 0], [0, 1, 0],
            half * (1 - move * 0.12), {
                radius: pct(P.cornerRadius) * 6,
                alpha: 1 - clamp((move - 0.6) / 0.4, 0, 1),
            }));
        if (move > 0) {
            quads.push(card(ctx, index + 1, P.cardRatio, [sway, 0, 0.02], [1, 0, 0], [0, 1, 0],
                half * (0.86 + 0.14 * move), {
                    radius: pct(P.cornerRadius) * 6,
                    alpha: clamp(move * 2, 0, 1),
                }));
        }
        void local; void hash;
        return { camera: cameraFor(26), quads };
    },
};
