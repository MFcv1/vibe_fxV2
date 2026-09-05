/*
 * Famille grille : les cartes occupent des cases fixes du cadre, et c'est leur
 * apparition, leur retournement ou leur defilement qui fait l'animation.
 *
 * Les revelations passent par le plan de coupe du shader plutot que par une
 * mise a l'echelle : l'image reste immobile pendant que son bord avance, ce qui
 * est le mouvement attendu d'un volet.
 */

import {
    cornerRadius, TAU, pct, card, cameraFor, paddingScale, clamp, hash, VIEW_HEIGHT,
} from './_helpers.js';
import { ease } from '../engine/math.js';

const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };
const PADDING = {
    t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
};
const RADIUS = {
    t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 3, unit: '%', dec: 1,
};
const GAP = {
    t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 15, step: 0.5, def: 3, unit: '%', dec: 1,
};
const EASING = { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' };

/*
 * Repartition des cases : on cherche le decoupage dont la case est la plus
 * proche du carre pour le format demande, ce qui evite les grilles a une seule
 * colonne sur un cadre vertical.
 */
export function gridDims(n, frameAspect) {
    let best = [1, n];
    let bestScore = Infinity;
    for (let cols = 1; cols <= n; cols += 1) {
        const rows = Math.ceil(n / cols);
        if (cols * rows - n > Math.max(1, Math.floor(n / 3))) continue;
        const cellAspect = (frameAspect / cols) / (1 / rows);
        const score = Math.abs(Math.log(cellAspect));
        if (score < bestScore) { bestScore = score; best = [cols, rows]; }
    }
    return best;
}

/*
 * Rend les cases d'une grille qui remplit le cadre, gap compris.
 */
function cells(ctx, n, gapPct, padPct) {
    const scale = paddingScale(padPct);
    const [cols, rows] = gridDims(n, ctx.frameAspect);
    const W = VIEW_HEIGHT * ctx.frameAspect * scale;
    const H = VIEW_HEIGHT * scale;
    const gx = (W / cols) * pct(gapPct);
    const gy = (H / rows) * pct(gapPct);
    const cw = (W - gx * (cols - 1)) / cols;
    const ch = (H - gy * (rows - 1)) / rows;
    const out = [];
    for (let i = 0; i < n; i += 1) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        out.push({
            i,
            c,
            r,
            cols,
            rows,
            x: -W / 2 + cw / 2 + c * (cw + gx),
            y: H / 2 - ch / 2 - r * (ch + gy),
            halfW: cw / 2,
            halfH: ch / 2,
        });
    }
    return out;
}

function flat(ctx, cell, index, radius, extra = {}) {
    const media = ctx.cardAt(index, cell.halfW / cell.halfH);
    const s = extra.scale === undefined ? 1 : extra.scale;
    const hw = cell.halfW * s;
    const hh = cell.halfH * s;
    const z = extra.z || 0;
    return {
        p: [
            [cell.x - hw, cell.y + hh, z], [cell.x + hw, cell.y + hh, z],
            [cell.x + hw, cell.y - hh, z], [cell.x - hw, cell.y - hh, z],
        ],
        tex: media.tex,
        uvRect: media.uvRect,
        aspect: cell.halfW / cell.halfH,
        radius,
        ...extra,
    };
}

export const gridReveal = {
    id: 'grid-reveal',
    name: 'Grid Reveal',
    category: 'grid',
    slots: 4,
    loop: 6,
    params: [
        PADDING, RADIUS, GAP, EASING,
        { t: 'choice', k: 'order', label: 'Reveal order', options: [['rows', 'Rows'], ['cols', 'Columns'], ['diag', 'Diagonal']], def: 'rows' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const list = cells(ctx, n, P.gap, P.padding);
        const radius = cornerRadius(P);
        /*
         * La revelation se rejoue a chaque tour : l'image en place reste
         * visible, la suivante se decouvre par-dessus. A la fin du tour on
         * montre donc la serie suivante, et comme les series bouclent, la
         * derniere image du tour est celle du debut.
         */
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;

        const quads = [];
        list.forEach((cell) => {
            const rank = P.order === 'cols' ? cell.c
                : P.order === 'diag' ? cell.c + cell.r
                    : cell.r * cell.cols + cell.c;
            const total = P.order === 'cols' ? cell.cols
                : P.order === 'diag' ? cell.cols + cell.rows - 1
                    : list.length;
            const delay = (rank / Math.max(1, total)) * 0.55;
            const open = ease(P.easing, clamp((local - delay) / 0.45, 0, 1));
            quads.push(flat(ctx, cell, index * list.length + cell.i, radius));
            if (open > 0) {
                quads.push(flat(ctx, cell, (index + 1) * list.length + cell.i, radius, {
                    z: 0.01,
                    clip: open >= 1 ? null : [0, 1, open - 0.5, 0.01],
                }));
            }
        });
        return { camera: cameraFor(8), quads };
    },
};

export const spotlightZoom = {
    id: 'spotlight-zoom',
    name: 'Spotlight Zoom',
    category: 'grid',
    slots: 4,
    loop: 12,
    params: [
        PADDING, RADIUS, GAP,
        { t: 'slider', k: 'dim', label: 'Background dim', min: 0, max: 100, step: 1, def: 45, unit: '%' },
        EASING, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const list = cells(ctx, n, P.gap, P.padding);
        const raw = ctx.t * n;
        const active = Math.floor(raw);
        const local = raw - active;
        // La case active grandit jusqu'a couvrir le cadre, puis se range.
        const grow = ease(P.easing, Math.sin(clamp((local - 0.15) / 0.7, 0, 1) * Math.PI));

        const quads = list.map((cell) => {
            const isActive = cell.i === ((active % n) + n) % n;
            if (!isActive) {
                return flat(ctx, cell, cell.i, cornerRadius(P), {
                    fade: pct(P.dim) * grow,
                });
            }
            // On interpole la case vers le cadre entier : position et taille.
            const full = { halfW: (VIEW_HEIGHT * ctx.frameAspect) / 2, halfH: VIEW_HEIGHT / 2 };
            const target = {
                ...cell,
                x: cell.x * (1 - grow),
                y: cell.y * (1 - grow),
                halfW: cell.halfW + (full.halfW - cell.halfW) * grow,
                halfH: cell.halfH + (full.halfH - cell.halfH) * grow,
            };
            return flat(ctx, target, cell.i, cornerRadius(P) * (1 - grow * 0.7), { z: 0.05 });
        });
        return { camera: cameraFor(8), quads };
    },
};

export const flipGrid = {
    id: 'flip-grid',
    name: 'Flip Grid',
    category: 'grid',
    slots: 8,
    loop: 8,
    params: [
        PADDING, RADIUS, GAP, EASING,
        { t: 'choice', k: 'axis', label: 'Flip axis', options: [['h', 'Horizontal'], ['v', 'Vertical']], def: 'h' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const list = cells(ctx, n, P.gap, P.padding);
        const quads = [];
        list.forEach((cell) => {
            // Chaque case bascule a son tour ; a mi-course elle est vue par la
            // tranche, donc son epaisseur apparente tombe a zero et l'image
            // suivante repart de la.
            const delay = (cell.i / n) * 0.5;
            const local = clamp((ctx.t - delay) / 0.45, 0, 1);
            const turn = ease(P.easing, local) * Math.PI;
            const squash = Math.cos(turn);
            const face = squash >= 0 ? cell.i : cell.i + n;
            const s = Math.max(Math.abs(squash), 0.02);
            const cellFlipped = P.axis === 'v'
                ? { ...cell, halfH: cell.halfH * s }
                : { ...cell, halfW: cell.halfW * s };
            quads.push(flat(ctx, cellFlipped, face, cornerRadius(P)));
        });
        return { camera: cameraFor(8), quads };
    },
};

export const popGrid = {
    id: 'pop-grid',
    name: 'Pop Grid',
    category: 'grid',
    slots: 6,
    loop: 8,
    params: [
        PADDING, RADIUS, GAP,
        { t: 'slider', k: 'visible', label: 'Visible share', min: 10, max: 100, step: 1, def: 62, unit: '%' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const list = cells(ctx, n, P.gap, P.padding);
        const share = pct(P.visible);
        const quads = [];
        list.forEach((cell) => {
            // Chaque case a sa propre fenetre d'apparition dans la boucle ; leur
            // somme depasse 1, donc plusieurs sont visibles en meme temps.
            const start = (cell.i / n + hash(cell.i, 5) * 0.12) % 1;
            let local = ctx.t - start;
            if (local < 0) local += 1;
            const on = local < share;
            if (!on) return;
            const w = local / share;
            // Un rebond court a l'entree, une sortie nette.
            const s = w < 0.18 ? ease('overshoot', w / 0.18)
                : w > 0.86 ? 1 - ease('custom', (w - 0.86) / 0.14) : 1;
            quads.push(flat(ctx, cell, cell.i, cornerRadius(P), {
                scale: clamp(s, 0.02, 1.15),
            }));
        });
        return { camera: cameraFor(8), quads };
    },
};

/*
 * Bandes defilantes (Ticker Loop et Ticker Tilt) : plusieurs rangees de cartes
 * qui glissent, en sens contraire ou non. La boucle se referme parce qu'une
 * rangee avance d'un nombre entier de cartes par tour.
 */
function ticker(ctx, o) {
    const { P } = ctx;
    const halfH = pct(P.zoom) * VIEW_HEIGHT * 0.35;
    const sample = ctx.card(0, P.cardRatio);
    const cardW = halfH * sample.aspect;
    const gap = pct(P.rowGap);
    const stepX = cardW * 2 * (1 + gap);
    const stepY = halfH * 2 * (1 + gap);
    const vertical = P.orientation === 'v';
    const span = vertical ? VIEW_HEIGHT * ctx.frameAspect : VIEW_HEIGHT;
    const rows = clamp(Math.ceil(span / (vertical ? stepX * 2 : stepY)) + 1, 2, 9);
    const per = clamp(Math.ceil((vertical ? VIEW_HEIGHT : VIEW_HEIGHT * ctx.frameAspect) / stepX) + 3, 3, 22);
    const slots = Math.max(1, ctx.slots);

    let speed = ctx.t;
    if (P.movement === 'zoompulse') speed = ctx.t + Math.sin(ctx.t * TAU) / TAU * 0.4;
    if (P.movement === 'waypoints') speed = ease(P.easing || 'custom', (ctx.t * rows) % 1) / rows
        + Math.floor(ctx.t * rows) / rows;

    const quads = [];
    for (let r = 0; r < rows; r += 1) {
        const flip = o.flow === 'same' ? 1 : (o.flow === 'stagger' ? (r % 3 === 0 ? 1 : -1) : (r % 2 ? -1 : 1));
        const base = P.direction === 'right' ? -1 : 1;
        const travel = speed * slots * stepX * flip * base;
        const start = Math.floor(travel / stepX) - Math.floor(per / 2);
        const cross = (r - (rows - 1) / 2) * (vertical ? stepX * 2 : stepY);
        // Ticker Tilt fait pivoter chaque rangee autour de son axe, ce qui la
        // fait fuir vers le fond a une extremite.
        const lean = o.tilt ? (P.tilt * Math.PI) / 180 : 0;

        for (let k = 0; k < per; k += 1) {
            const idx = start + k;
            const along = idx * stepX - travel;
            const centre = vertical ? [cross, along, 0] : [along, cross, 0];
            if (lean) {
                centre[2] = -Math.abs(along) * Math.tan(Math.abs(lean)) * 0.28;
            }
            const right = lean && !vertical ? [Math.cos(lean), 0, Math.sin(lean)] : [1, 0, 0];
            const up = [0, 1, 0];
            const texIndex = ((idx + r * 3) % slots + slots) % slots;
            quads.push(card(ctx, texIndex, P.cardRatio, centre, right, up, halfH, {
                radius: cornerRadius(P),
            }));
        }
    }
    return quads;
}

export const tickerLoop = {
    id: 'ticker-loop',
    name: 'Ticker Loop',
    category: 'grid',
    slots: 12,
    loop: 12,
    params: [
        RADIUS,
        { t: 'slider', k: 'zoom', label: 'Zoom', min: 10, max: 100, step: 1, def: 45, unit: '%' },
        { t: 'slider', k: 'tilt', label: 'Tilt', min: -30, max: 30, step: 1, def: -6, unit: '°' },
        { t: 'slider', k: 'rowGap', label: 'Row gap', min: 0, max: 20, step: 0.5, def: 4, unit: '%', dec: 1 },
        { t: 'choice', k: 'movement', label: 'Movement', options: [['continuous', 'Continuous'], ['zoompulse', 'Zoom pulse'], ['waypoints', 'Zoom waypoints']], def: 'continuous' },
        { t: 'choice', k: 'orientation', label: 'Orientation', options: [['h', 'Horizontal'], ['v', 'Vertical']], def: 'h' },
        { t: 'choice', k: 'direction', label: 'Direction', options: [['opposed', 'Opposed'], ['same', 'Same way']], def: 'opposed' },
        RATIO,
    ],
    build(ctx) {
        const { P } = ctx;
        // Le "Tilt" de Ticker Loop incline le bloc entier, il ne creuse pas la
        // profondeur : c'est ce qui le distingue de Ticker Tilt.
        return {
            camera: cameraFor(8),
            quads: ticker(ctx, { flow: P.direction, tilt: false })
                .map((q) => {
                    const a = (P.tilt * Math.PI) / 180;
                    const c = Math.cos(a); const s = Math.sin(a);
                    return { ...q, p: q.p.map(([x, y, z]) => [x * c - y * s, x * s + y * c, z]) };
                }),
        };
    },
};

export const tickerTilt = {
    id: 'ticker-tilt',
    name: 'Ticker Tilt',
    category: 'grid',
    slots: 12,
    loop: 12,
    params: [
        RADIUS,
        { t: 'slider', k: 'zoom', label: 'Zoom', min: 10, max: 100, step: 1, def: 32, unit: '%' },
        { t: 'slider', k: 'tilt', label: 'Tilt', min: -60, max: 60, step: 1, def: 30, unit: '°' },
        { t: 'slider', k: 'perspective', label: 'Perspective', min: 0, max: 100, step: 1, def: 60, unit: '%' },
        { t: 'slider', k: 'rowGap', label: 'Row gap', min: 0, max: 20, step: 0.5, def: 4, unit: '%', dec: 1 },
        EASING,
        { t: 'choice', k: 'flow', label: 'Flow', options: [['opposed', 'Opposed'], ['same', 'Same way'], ['stagger', 'Staggered']], def: 'opposed' },
        { t: 'choice', k: 'direction', label: 'Direction', options: [['left', 'Left'], ['right', 'Right']], def: 'left' },
        RATIO,
    ],
    build(ctx) {
        const { P } = ctx;
        return {
            camera: cameraFor(P.perspective),
            quads: ticker(ctx, { flow: P.flow, tilt: true }),
        };
    },
};

export const columnDrift = {
    id: 'column-drift',
    name: 'Column Drift',
    category: 'grid',
    slots: 12,
    loop: 12,
    params: [PADDING, RADIUS, GAP, RATIO],
    build(ctx) {
        const { P } = ctx;
        const scale = paddingScale(P.padding);
        const slots = Math.max(1, ctx.slots);
        const W = VIEW_HEIGHT * ctx.frameAspect * scale;
        const cols = clamp(Math.round(W / (VIEW_HEIGHT * 0.34)), 2, 8);
        const gx = (W / cols) * pct(P.gap);
        const cw = (W - gx * (cols - 1)) / cols;
        const sample = ctx.card(0, P.cardRatio);
        const chH = cw / sample.aspect;
        const stepY = chH * (1 + pct(P.gap));
        const rows = Math.ceil((VIEW_HEIGHT * scale) / stepY) + 3;

        const quads = [];
        for (let c = 0; c < cols; c += 1) {
            /*
             * Chaque colonne derive d'un nombre entier de cartes different par
             * tour — un pour les unes, deux pour les autres — et alternativement
             * vers le haut ou vers le bas. Un nombre entier, sinon la boucle ne
             * se refermerait pas.
             */
            const speed = 1 + (c % 3);
            const dir = c % 2 ? -1 : 1;
            const travel = ctx.t * speed * slots * stepY * dir;
            const base = Math.floor(travel / stepY) - Math.floor(rows / 2);
            const x = -W / 2 + cw / 2 + c * (cw + gx);
            for (let r = 0; r < rows; r += 1) {
                const idx = base + r;
                const y = idx * stepY - travel;
                const texIndex = ((c * 5 + idx * 3) % slots + slots) % slots;
                const media = ctx.cardAt(texIndex, cw / chH);
                quads.push({
                    p: [
                        [x - cw / 2, y + chH / 2, 0], [x + cw / 2, y + chH / 2, 0],
                        [x + cw / 2, y - chH / 2, 0], [x - cw / 2, y - chH / 2, 0],
                    ],
                    tex: media.tex,
                    uvRect: media.uvRect,
                    aspect: cw / chH,
                    radius: cornerRadius(P),
                });
            }
        }
        return { camera: cameraFor(8), quads };
    },
};

export const feedScroll = {
    id: 'feed-scroll',
    name: 'Feed Scroll',
    category: 'grid',
    slots: 12,
    loop: 10,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 15, max: 100, step: 1, def: 52, unit: '%' },
        { t: 'slider', k: 'spacing', label: 'Spacing', min: 10, max: 200, step: 1, def: 70, unit: '%' },
        { t: 'slider', k: 'laneSpread', label: 'Lane spread', min: 0, max: 200, step: 1, def: 100, unit: '%' },
        { t: 'slider', k: 'flick', label: 'Flick length', min: 10, max: 100, step: 1, def: 55, unit: '%' },
        { t: 'slider', k: 'fadeIn', label: 'Fade in', min: 0, max: 100, step: 1, def: 50, unit: '%' },
        { t: 'slider', k: 'stagger', label: 'Stagger', min: 0, max: 100, step: 1, def: 0, unit: '%' },
        EASING,
        { t: 'choice', k: 'motion', label: 'Motion', options: [['flicks', 'Flicks'], ['steady', 'Steady']], def: 'flicks' },
        { t: 'choice', k: 'enter', label: 'Card enters by', options: [['fade', 'Fade'], ['slide', 'Slide']], def: 'fade' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const slots = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.35 * scale;
        // Un fil se lit parce qu'il est plein : a un ecart d'une carte entiere,
        // il ne restait que deux vignettes perdues dans le cadre.
        const stepY = halfH * 2 * (0.35 + pct(P.spacing) * 0.75);
        const lanes = ctx.frameAspect > 1.2 ? 3 : 1;
        const laneW = pct(P.laneSpread) * VIEW_HEIGHT * ctx.frameAspect * 0.28;

        /*
         * "Flicks" : le pouce donne des impulsions. La progression avance par
         * a-coups qui se calment, mais son total sur une boucle vaut exactement
         * `slots` cartes, ce qui referme le defilement.
         */
        const flicks = Math.max(1, Math.round(1 / clamp(pct(P.flick), 0.1, 1)));
        const progress = P.motion === 'steady'
            ? ctx.t
            : (Math.floor(ctx.t * flicks) + ease(P.easing, clamp((ctx.t * flicks) % 1 / 0.6, 0, 1))) / flicks;
        const travel = progress * slots * stepY;

        const count = Math.ceil((VIEW_HEIGHT * 1.4) / stepY) + 3;
        const base = Math.floor(travel / stepY) - 1;
        const quads = [];
        for (let k = -1; k < count; k += 1) {
            const idx = base + k;
            for (let lane = 0; lane < lanes; lane += 1) {
                const stag = pct(P.stagger) * stepY * (lane / Math.max(1, lanes - 1) - 0.5);
                const y = idx * stepY - travel + stag - VIEW_HEIGHT * 0.1;
                if (y > VIEW_HEIGHT * 1.1 || y < -VIEW_HEIGHT * 1.1) continue;
                const x = lanes === 1 ? 0 : (lane - (lanes - 1) / 2) * laneW;
                // L'entree : soit la carte apparait en fondu, soit elle glisse
                // depuis le bas du cadre.
                const nearBottom = clamp((y + VIEW_HEIGHT * 0.9) / (VIEW_HEIGHT * pct(P.fadeIn) * 0.9 + 0.001), 0, 1);
                const alpha = P.enter === 'fade' ? nearBottom : 1;
                const slide = P.enter === 'slide' ? (1 - nearBottom) * halfH * 1.2 : 0;
                const texIndex = ((idx * lanes + lane) % slots + slots) % slots;
                quads.push(card(ctx, texIndex, P.cardRatio, [x, y - slide, 0], [1, 0, 0], [0, 1, 0], halfH, {
                    radius: cornerRadius(P),
                    alpha,
                }));
            }
        }
        return { camera: cameraFor(8), quads };
    },
};
