/*
 * Famille multiscene : une meme boucle enchaine plusieurs mises en scene.
 *
 * Chaque template decrit ses scenes comme des POSES — pour chaque carte, une
 * position, une taille, une rotation — et l'animation n'est que l'interpolation
 * d'une pose vers la suivante, avec un temps d'arret sur chacune. La boucle se
 * referme parce que la derniere pose retourne vers la premiere.
 */

import {
    cornerRadius, TAU, pct, card, cameraFor, paddingScale, clamp, hash, VIEW_HEIGHT,
} from './_helpers.js';
import { ease } from '../engine/math.js';

const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };
const RATIO_FRAME = {
    t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'frame', frame: true,
};
const PADDING = (def = 6) => ({
    t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def, unit: '%', dec: 1,
});
const RADIUS = {
    t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 3, unit: '%', dec: 1,
};
const EASING = { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' };

/*
 * Ou en est-on dans l'enchainement : quelle scene, vers laquelle, et ou en est
 * la transition. `hold` est la part du temps passee immobile sur une scene.
 */
function sceneMix(t, count, easing, hold = 0.55) {
    const raw = t * count;
    const i = Math.floor(raw);
    const local = raw - i;
    const m = ease(easing, clamp((local - hold) / (1 - hold || 1), 0, 1));
    return { from: i % count, to: (i + 1) % count, m };
}

// Interpolation d'une pose vers une autre.
const mixPose = (a, b, m) => ({
    x: a.x + (b.x - a.x) * m,
    y: a.y + (b.y - a.y) * m,
    z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * m,
    s: a.s + (b.s - a.s) * m,
    a: (a.a || 0) + ((b.a || 0) - (a.a || 0)) * m,
    /*
     * L'opacite bascule plus vite que la position : au milieu d'un changement
     * de scene, une carte a mi-opacite laisse voir toutes celles de dessous et
     * l'image devient un magma. On veut qu'elle soit franchement la, ou
     * franchement partie.
     */
    alpha: (a.alpha === undefined ? 1 : a.alpha)
        + ((b.alpha === undefined ? 1 : b.alpha) - (a.alpha === undefined ? 1 : a.alpha))
        * clamp(m * m * (3 - 2 * m) * 1.6 - 0.3, 0, 1),
});

function poseQuads(ctx, poses, halfH, radius, ratioKey) {
    return poses.map((p, i) => {
        const c = Math.cos(p.a || 0);
        const s = Math.sin(p.a || 0);
        return card(ctx, i, ratioKey, [p.x, p.y, p.z || 0],
            [c, s, 0], [-s, c, 0], halfH * p.s,
            { radius, alpha: clamp(p.alpha === undefined ? 1 : p.alpha, 0, 1) });
    });
}

export const tripleScene = {
    id: 'triple-scene',
    name: 'Triple Scene',
    category: 'multiscene',
    slots: 12,
    loop: 12,
    params: [
        RADIUS, PADDING(2),
        { t: 'slider', k: 'heroSize', label: 'Hero size', min: 20, max: 100, step: 1, def: 58, unit: '%' },
        { t: 'slider', k: 'heroSpacing', label: 'Hero spacing', min: 0, max: 30, step: 1, def: 4, unit: '%' },
        { t: 'slider', k: 'columns', label: 'Columns', min: 2, max: 6, step: 1, def: 3, unit: '' },
        { t: 'slider', k: 'perColumn', label: 'Cards per column', min: 2, max: 10, step: 1, def: 6, unit: '' },
        { t: 'slider', k: 'cardGap', label: 'Card gap', min: 0, max: 12, step: 0.25, def: 1.5, unit: '%', dec: 2 },
        { t: 'slider', k: 'drift', label: 'Column drift', min: 0, max: 100, step: 1, def: 22, unit: '%' },
        { t: 'slider', k: 'rowTilt', label: 'Row tilt', min: 0, max: 100, step: 1, def: 17, unit: '%' },
        { t: 'slider', k: 'rowRise', label: 'Row rise', min: 0, max: 100, step: 1, def: 12, unit: '%' },
        EASING, RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const W = VIEW_HEIGHT * ctx.frameAspect * scale;
        const H = VIEW_HEIGHT * scale;
        const halfH = H * 0.5;
        const cols = Math.max(1, Math.round(P.columns));
        const { from, to, m } = sceneMix(ctx.t, 3, P.easing);

        /*
         * Trois scenes : la carte de tete seule, la grille en colonnes, la
         * grille inclinee. Chaque scene rend la pose de CHAQUE carte, meme
         * quand elle est invisible — c'est ce qui permet d'interpoler d'une
         * scene a l'autre sans faire apparaitre les cartes de nulle part.
         */
        const scenes = [
            // 1 — le heros seul, les autres cachees derriere lui.
            (i) => (i === 0
                ? { x: 0, y: 0, s: pct(P.heroSize) * 1.7, alpha: 1 }
                : { x: 0, y: 0, s: pct(P.heroSize) * 1.7 * 0.9, alpha: 0 }),
            // 2 — colonnes qui derivent, chacune a sa hauteur.
            (i) => {
                const c = i % cols;
                const r = Math.floor(i / cols);
                const gap = 1 + pct(P.cardGap) * 4;
                const cw = (W / cols);
                const ch = (H / Math.max(1, Math.round(P.perColumn))) * gap;
                const drift = (c % 2 ? 1 : -1) * pct(P.drift) * ch * 0.5;
                return {
                    x: -W / 2 + cw / 2 + c * cw,
                    y: H / 2 - ch / 2 - r * ch + drift,
                    s: (cw * 0.46) / halfH,
                    alpha: 1,
                };
            },
            // 3 — rangees qui montent et s'inclinent.
            (i) => {
                const rows = Math.ceil(n / cols);
                const r = Math.floor(i / cols);
                const c = i % cols;
                const cw = W / cols;
                const ch = H / rows;
                return {
                    x: -W / 2 + cw / 2 + c * cw + pct(P.heroSpacing) * cw * (r % 2 ? 1 : -1),
                    y: H / 2 - ch / 2 - r * ch + pct(P.rowRise) * ch * (c / cols - 0.5),
                    s: (cw * 0.44) / halfH,
                    a: (pct(P.rowTilt) * 0.35) * (r % 2 ? 1 : -1),
                    alpha: 1,
                };
            },
        ];

        const poses = [];
        for (let i = 0; i < n; i += 1) poses.push(mixPose(scenes[from](i), scenes[to](i), m));
        return {
            camera: cameraFor(8),
            quads: poseQuads(ctx, poses, halfH, cornerRadius(P), P.cardRatio),
        };
    },
};

export const collageReel = {
    id: 'collage-reel',
    name: 'Collage Reel',
    category: 'multiscene',
    slots: 8,
    loop: 18,
    params: [
        RADIUS, PADDING(2),
        { t: 'slider', k: 'heroSize', label: 'Hero size', min: 20, max: 100, step: 1, def: 52, unit: '%' },
        EASING, RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = VIEW_HEIGHT * 0.5 * scale;
        const { from, to, m } = sceneMix(ctx.t, 2, P.easing, 0.62);
        const hero = pct(P.heroSize);

        // Deux scenes : la couronne de cartes qui se chevauchent, et le heros
        // seul au centre pendant que la couronne se resserre derriere lui.
        const scenes = [
            (i) => {
                const a = (i / n) * TAU;
                return {
                    x: Math.sin(a) * halfH * 1.15 * ctx.frameAspect * 0.8,
                    y: Math.cos(a) * halfH * 1.1,
                    s: hero * 0.62,
                    a: -Math.sin(a) * 0.22,
                    alpha: 1,
                };
            },
            (i) => (i === 0
                ? { x: 0, y: 0, s: hero * 1.7, z: 0.1, alpha: 1 }
                : {
                    x: 0, y: 0, s: hero * 0.25, a: hash(i, 3) * 0.6, alpha: 0.25,
                }),
        ];

        const poses = [];
        for (let i = 0; i < n; i += 1) poses.push(mixPose(scenes[from](i), scenes[to](i), m));
        return {
            camera: cameraFor(8),
            quads: poseQuads(ctx, poses, halfH, cornerRadius(P), P.cardRatio),
        };
    },
};

export const fanShuffle = {
    id: 'fan-shuffle',
    name: 'Fan Shuffle',
    category: 'multiscene',
    slots: 18,
    loop: 17,
    params: [
        RADIUS,
        { t: 'slider', k: 'deckCards', label: 'Deck cards', min: 2, max: 12, step: 1, def: 6, unit: '' },
        { t: 'slider', k: 'fanSpread', label: 'Fan spread', min: 0, max: 40, step: 0.2, def: 7.8, unit: '%', dec: 1 },
        { t: 'slider', k: 'fanAngle', label: 'Fan angle', min: -90, max: 90, step: 1, def: -47, unit: '°' },
        { t: 'slider', k: 'columns', label: 'Columns', min: 2, max: 6, step: 1, def: 3, unit: '' },
        { t: 'slider', k: 'cardGap', label: 'Card gap', min: 0, max: 15, step: 0.25, def: 2.5, unit: '%', dec: 2 },
        { t: 'slider', k: 'rowShift', label: 'Row shift', min: 0, max: 150, step: 1, def: 77, unit: '%' },
        { t: 'slider', k: 'pullBack', label: 'Wall pull-back', min: 0, max: 150, step: 1, def: 80, unit: '%' },
        EASING, RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const halfH = VIEW_HEIGHT * 0.5;
        const cols = Math.max(1, Math.round(P.columns));
        const rows = Math.ceil(n / cols);
        const deck = Math.max(1, Math.round(P.deckCards));
        const { from, to, m } = sceneMix(ctx.t, 2, P.easing, 0.5);

        // Deux scenes : un jeu de cartes en eventail au centre, et un mur de
        // vignettes. Les cartes hors du paquet attendent derriere, invisibles.
        const scenes = [
            (i) => {
                const k = i % deck;
                const a = ((P.fanAngle * Math.PI) / 180) * (k / Math.max(1, deck - 1) - 0.5);
                return {
                    x: Math.sin(a) * pct(P.fanSpread) * halfH * 8,
                    y: -Math.abs(a) * halfH * 0.25,
                    s: 0.62,
                    a,
                    z: k * 0.01,
                    alpha: i < deck ? 1 : 0,
                };
            },
            (i) => {
                const c = i % cols;
                const r = Math.floor(i / cols);
                const cw = (VIEW_HEIGHT * ctx.frameAspect) / cols;
                const ch = VIEW_HEIGHT / rows;
                const gap = 1 - pct(P.cardGap);
                const shift = pct(P.rowShift) * cw * 0.25 * (r % 2 ? 1 : -1);
                const back = pct(P.pullBack) * 0.9;
                return {
                    x: (-VIEW_HEIGHT * ctx.frameAspect / 2 + cw / 2 + c * cw + shift) * back,
                    y: (VIEW_HEIGHT / 2 - ch / 2 - r * ch) * back,
                    s: (cw * gap * 0.5) / halfH * back,
                    alpha: 1,
                };
            },
        ];

        const poses = [];
        for (let i = 0; i < n; i += 1) poses.push(mixPose(scenes[from](i), scenes[to](i), m));
        return {
            camera: cameraFor(8),
            quads: poseQuads(ctx, poses, halfH, cornerRadius(P), P.cardRatio),
        };
    },
};

export const gridZoomStrip = {
    id: 'grid-zoom-strip',
    name: 'Grid Zoom Strip',
    category: 'multiscene',
    slots: 9,
    loop: 6,
    params: [
        PADDING(), RADIUS,
        { t: 'slider', k: 'zoom', label: 'Zoom', min: 1, max: 6, step: 0.1, def: 2, unit: '×', dec: 1 },
        { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 12, step: 0.5, def: 2, unit: '%', dec: 1 },
        { t: 'slider', k: 'fade', label: 'Fade', min: 0, max: 100, step: 1, def: 40, unit: '%' },
        EASING,
        { t: 'choice', k: 'direction', label: 'Direction', options: [['h', 'Horizontal'], ['v', 'Vertical']], def: 'h' },
        { t: 'choice', k: 'target', label: 'Zoom target', options: [['start', 'Start (card 1)'], ['center', 'Center (card 5)']], def: 'start' },
        { t: 'choice', k: 'movement', label: 'Movement', options: [['smooth', 'Smooth'], ['stepped', 'Stepped']], def: 'smooth' },
        RATIO_FRAME, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const cols = Math.max(1, Math.round(Math.sqrt(n)));
        const rows = Math.ceil(n / cols);

        /*
         * C'est une GRILLE qui plonge sur l'une de ses cases, pas une bande qui
         * defile — le nom prete a confusion. La camera se rapproche puis
         * repart, et la grille se recentre sur la case visee au sommet du zoom.
         */
        const W = VIEW_HEIGHT * ctx.frameAspect * scale;
        const H = VIEW_HEIGHT * scale;
        const gap = pct(P.gap);
        const cw = W / cols;
        const ch = H / rows;
        const halfW = (cw * (1 - gap)) / 2;
        const halfH = (ch * (1 - gap)) / 2;

        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const slide = P.movement === 'stepped'
            ? ease(P.easing, clamp((local - 0.45) / 0.55, 0, 1))
            : ease(P.easing, local);
        const zoomT = Math.sin(clamp(local / 0.9, 0, 1) * Math.PI);
        const zoom = 1 + (P.zoom - 1) * zoomT;

        // Case visee : la premiere, ou celle du centre.
        const target = P.target === 'center' ? Math.floor(n / 2) : 0;
        const focus = (index + target + Math.round(slide)) % n;
        const fc = focus % cols;
        const fr = Math.floor(focus / cols);
        const camX = (-W / 2 + cw / 2 + fc * cw) * zoomT;
        const camY = (H / 2 - ch / 2 - fr * ch) * zoomT;

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            const c = i % cols;
            const r = Math.floor(i / cols);
            const x = (-W / 2 + cw / 2 + c * cw - camX) * zoom;
            const y = (H / 2 - ch / 2 - r * ch - camY) * zoom;
            const media = ctx.cardAt(index * n + i, halfW / halfH);
            const off = i === focus ? 0 : 1;
            quads.push({
                p: [
                    [x - halfW * zoom, y + halfH * zoom, 0], [x + halfW * zoom, y + halfH * zoom, 0],
                    [x + halfW * zoom, y - halfH * zoom, 0], [x - halfW * zoom, y - halfH * zoom, 0],
                ],
                tex: media.tex,
                uvRect: media.uvRect,
                aspect: halfW / halfH,
                radius: cornerRadius(P),
                fade: pct(P.fade) * off * zoomT,
            });
        }
        return { camera: cameraFor(8), quads };
    },
};

function spreadBuild(ctx, vertical) {
    const { P } = ctx;
    const n = Math.max(1, ctx.slots);
    const lanes = Math.max(1, Math.round(vertical ? P.columns : P.rows));
    const per = Math.ceil(n / lanes);
    const scale = paddingScale(P.padding);
    const W = VIEW_HEIGHT * ctx.frameAspect * scale;
    const H = VIEW_HEIGHT * scale;
    const halfH = H * 0.5;
    const laneGap = pct(vertical ? P.columnGap : P.rowGap);
    const cardGap = pct(P.cardGap);
    const zoom = 0.6 + pct(P.cameraZoom) * 0.8;

    const laneSize = (vertical ? W : H) / lanes;
    const cellSize = (vertical ? H : W) / per;
    const { from, to, m } = sceneMix(ctx.t, 2, P.easing, 0.42);

    /*
     * Deux scenes : les cartes tassees en pile, puis etalees en rangees. Le
     * decalage par rangee ("Row delay") fait partir les rangees les unes apres
     * les autres, sans jamais depasser la duree de la transition.
     */
    const stackSize = pct(P.stackSize);
    const poses = [];
    for (let i = 0; i < n; i += 1) {
        const lane = Math.floor(i / per);
        const k = i % per;
        const laneT = lane / Math.max(1, lanes - 1 || 1);
        const delay = pct(P.laneDelay) * lane;
        const mm = clamp((m - delay) / (1 - delay || 1), 0, 1);

        const spreadPos = vertical
            ? {
                x: -W / 2 + laneSize / 2 + lane * laneSize + laneGap * laneSize * 0.2,
                y: H / 2 - cellSize / 2 - k * cellSize,
            }
            : {
                x: -W / 2 + cellSize / 2 + k * cellSize,
                y: H / 2 - laneSize / 2 - lane * laneSize - laneGap * laneSize * 0.2,
            };
        // "Column edges" range les piles au bord de leur rangee au lieu de tout
        // ramener sur un seul point.
        const anchor = P.stackStyle === 'edges'
            ? (vertical ? { x: spreadPos.x, y: 0 } : { x: 0, y: spreadPos.y })
            : { x: 0, y: 0 };
        const drift = pct(P.drift) * (laneT - 0.5) * cellSize;

        // Une pile se lit parce que ses cartes sont legerement decalees : en
        // les ramenant toutes sur le meme point, on ne voyait que celle du
        // dessus et la scene semblait vide.
        const fan = (k - (per - 1) / 2) * cellSize * 0.06;
        const stacked = {
            x: anchor.x + fan,
            y: anchor.y - fan * 0.8,
            // La pile part d'une taille deja lisible : a la moitie d'une case,
            // elle se reduisait a une vignette perdue dans un cadre vide.
            s: (cellSize * 0.5 * (0.9 + stackSize * 1.1)) / halfH,
            a: fan * 0.5,
            alpha: 1,
            z: i * 0.004,
        };
        const spread = {
            x: (spreadPos.x + (vertical ? 0 : drift)) * zoom,
            y: (spreadPos.y + (vertical ? drift : 0)) * zoom,
            s: (cellSize * 0.5 * (1 - cardGap)) / halfH * zoom,
            alpha: 1,
            z: 0,
        };
        poses.push(from === 0 ? mixPose(stacked, spread, mm) : mixPose(spread, stacked, mm));
    }
    void to;
    return {
        camera: cameraFor(8),
        quads: poseQuads(ctx, poses, halfH, cornerRadius(P), P.cardRatio),
    };
}

const SPREAD_TAIL = [
    { t: 'slider', k: 'cardGap', label: 'Card gap', min: 0, max: 20, step: 0.5, def: 3, unit: '%', dec: 1 },
    { t: 'slider', k: 'stackSize', label: 'Stack size', min: 10, max: 150, step: 1, def: 50, unit: '%' },
    { t: 'slider', k: 'cameraZoom', label: 'Camera zoom', min: 0, max: 100, step: 1, def: 50, unit: '%' },
    { t: 'slider', k: 'drift', label: 'Drift', min: 0, max: 100, step: 1, def: 16, unit: '%' },
];

export const spreadRows = {
    id: 'spread-rows',
    name: 'Spread Rows',
    category: 'multiscene',
    slots: 12,
    loop: 8,
    params: [
        PADDING(), RADIUS,
        { t: 'slider', k: 'rows', label: 'Rows', min: 1, max: 6, step: 1, def: 3, unit: '' },
        { t: 'slider', k: 'rowGap', label: 'Row gap', min: 0, max: 20, step: 0.5, def: 3, unit: '%', dec: 1 },
        ...SPREAD_TAIL,
        { t: 'slider', k: 'laneDelay', label: 'Row delay', min: 0, max: 30, step: 1, def: 4, unit: '%' },
        EASING,
        { t: 'choice', k: 'stackStyle', label: 'Stack style', options: [['point', 'Single point'], ['edges', 'Row edges (odd rows)']], def: 'point' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) { return spreadBuild(ctx, false); },
};

export const spreadColumns = {
    id: 'spread-columns',
    name: 'Spread Columns',
    category: 'multiscene',
    slots: 12,
    loop: 8,
    params: [
        PADDING(), RADIUS,
        { t: 'slider', k: 'columns', label: 'Columns', min: 1, max: 6, step: 1, def: 3, unit: '' },
        { t: 'slider', k: 'columnGap', label: 'Column gap', min: 0, max: 20, step: 0.5, def: 3, unit: '%', dec: 1 },
        ...SPREAD_TAIL,
        { t: 'slider', k: 'laneDelay', label: 'Column delay', min: 0, max: 30, step: 1, def: 4, unit: '%' },
        EASING,
        { t: 'choice', k: 'stackStyle', label: 'Stack style', options: [['point', 'Single point'], ['edges', 'Column edges (odd columns)']], def: 'point' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) { return spreadBuild(ctx, true); },
};
