/*
 * Famille defile : une file de cartes qui glisse devant nous, avec une carte de
 * tete mise en avant.
 *
 * Le squelette est toujours le meme — une position continue dans la file, un
 * ecart signe par rapport au centre — et chaque template en tire sa mise en
 * scene : rotation des cotes pour Cover Flow, courbure 3D pour les bandes,
 * mise a l'echelle pour Carousel Flow.
 */

import {
    TAU, pct, card, cameraFor, paddingScale, clamp, zoomedUv, VIEW_HEIGHT,
} from './_helpers.js';
import { ease, steppedProgress } from '../engine/math.js';

const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };
const RATIO_FRAME = {
    t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'frame', frame: true,
};
const PADDING = {
    t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
};
const RADIUS = {
    t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 3, unit: '%', dec: 1,
};
const EASING = { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' };

/*
 * Position continue de la file. En mode "arret au centre", elle marque un temps
 * sur chaque carte au lieu de glisser sans fin.
 */
function railPhase(ctx, stopAtCenter, easing) {
    const n = Math.max(1, ctx.slots);
    return stopAtCenter ? steppedProgress(ctx.t, n, easing || 'custom') : ctx.t * n;
}

/*
 * Renvoie, pour chaque carte, son ecart signe par rapport au centre de la file,
 * ramene dans [-n/2, n/2] pour que la file boucle sans fin.
 */
function railOffsets(count, phase) {
    const out = [];
    for (let i = 0; i < count; i += 1) {
        let d = i - phase;
        d = ((d % count) + count) % count;
        if (d > count / 2) d -= count;
        out.push({ i, d });
    }
    return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
}

export const coverFlow = {
    id: 'cover-flow',
    name: 'Cover Flow',
    category: 'flow',
    slots: 5,
    loop: 12,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 10, max: 90, step: 1, def: 46, unit: '%' },
        { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 30, step: 0.5, def: 4, unit: '%', dec: 1 },
        { t: 'slider', k: 'sideTilt', label: 'Side tilt', min: 0, max: 85, step: 1, def: 40, unit: '°' },
        { t: 'slider', k: 'flowAngle', label: 'Flow angle', min: -45, max: 45, step: 1, def: 0, unit: '°' },
        EASING, RATIO,
        { t: 'choice', k: 'direction', label: 'Direction', options: [['rl', 'Right → left'], ['lr', 'Left → right']], def: 'rl' },
        { t: 'choice', k: 'motion', label: 'Motion', options: [['stop', 'Stop at center'], ['continuous', 'Continuous']], def: 'stop' },
    ],
    build(ctx) { return coverFlowBuild(ctx, false); },
};

export const coverFlowVertical = {
    id: 'cover-flow-vertical',
    name: 'Cover Flow Vertical',
    category: 'flow',
    slots: 5,
    loop: 12,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 10, max: 90, step: 1, def: 46, unit: '%' },
        { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 30, step: 0.5, def: 4, unit: '%', dec: 1 },
        { t: 'slider', k: 'sideTilt', label: 'Side tilt', min: 0, max: 85, step: 1, def: 40, unit: '°' },
        EASING, RATIO,
        { t: 'choice', k: 'direction', label: 'Direction', options: [['bt', 'Bottom → top'], ['tb', 'Top → bottom']], def: 'bt' },
        { t: 'choice', k: 'motion', label: 'Motion', options: [['stop', 'Stop at center'], ['continuous', 'Continuous']], def: 'stop' },
    ],
    build(ctx) { return coverFlowBuild(ctx, true); },
};

function coverFlowBuild(ctx, vertical) {
    const { P } = ctx;
    const n = Math.max(1, ctx.slots);
    const scale = paddingScale(P.padding);
    const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5 * scale;
    const sample = ctx.card(0, P.cardRatio);
    const stepSize = (vertical ? halfH * 2 : halfH * 2 * sample.aspect) * (1 + pct(P.gap)) * 0.62;
    const back = P.direction === 'lr' || P.direction === 'tb' ? -1 : 1;
    const phase = railPhase(ctx, P.motion === 'stop', P.easing) * back;
    const tilt = (P.sideTilt * Math.PI) / 180;
    const flow = ((P.flowAngle || 0) * Math.PI) / 180;

    const quads = railOffsets(n, phase).map(({ i, d }) => {
        // Au centre la carte est de face ; des qu'elle s'ecarte, elle pivote de
        // "Side tilt" et recule, ce qui produit le degrade classique du cover
        // flow sans avoir a trier quoi que ce soit d'autre que la profondeur.
        const away = clamp(Math.abs(d), 0, 1);
        const sign = Math.sign(d) || 0;
        const angle = -sign * tilt * away;
        const along = d * stepSize + sign * away * stepSize * 0.35;
        const z = -away * halfH * 1.15;

        const centre = vertical
            ? [Math.sin(flow) * along, along, z]
            : [along, Math.sin(flow) * along, z];
        const right = vertical
            ? [1, 0, 0]
            : [Math.cos(angle), 0, Math.sin(angle)];
        const up = vertical
            ? [0, Math.cos(angle), Math.sin(angle)]
            : [0, 1, 0];

        return card(ctx, i, P.cardRatio, centre, right, up, halfH, {
            radius: pct(P.cornerRadius) * 6,
            fade: 0.35 * away,
        });
    });
    return { camera: cameraFor(30), quads };
}

export const carouselFlow = {
    id: 'carousel-flow',
    name: 'Carousel Flow',
    category: 'flow',
    slots: 5,
    loop: 10,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'sideScale', label: 'Side card scale', min: 0.3, max: 1, step: 0.01, def: 0.82, unit: '', dec: 2 },
        { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 30, step: 0.5, def: 5, unit: '%', dec: 1 },
        EASING,
        { t: 'choice', k: 'direction', label: 'Direction', options: [['h', 'Horizontal'], ['v', 'Vertical']], def: 'h' },
        RATIO_FRAME, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const vertical = P.direction === 'v';
        const halfH = (vertical ? 0.94 : 0.94) * scale;
        const sample = ctx.card(0, P.cardRatio);
        const stepSize = (vertical ? halfH * 2 : halfH * 2 * sample.aspect) * (1 + pct(P.gap));
        const phase = steppedProgress(ctx.t, n, P.easing) ;

        const quads = railOffsets(n, phase).map(({ i, d }) => {
            const away = clamp(Math.abs(d), 0, 1);
            // La carte de tete garde sa taille pleine, les voisines retombent a
            // "Side card scale" : l'interpolation se fait sur l'ecart, pas sur
            // un index, pour que la transition soit continue.
            const s = 1 - (1 - P.sideScale) * away;
            const along = d * stepSize;
            const centre = vertical ? [0, -along, -away * 0.05] : [along, 0, -away * 0.05];
            return card(ctx, i, P.cardRatio, centre, [1, 0, 0], [0, 1, 0], halfH * s, {
                radius: pct(P.cornerRadius) * 6,
                fade: 0.25 * away,
            });
        });
        return { camera: cameraFor(16), quads };
    },
};

function curvedStrip(ctx, vertical) {
    const { P } = ctx;
    const n = Math.max(1, ctx.slots);
    const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5;
    const sample = ctx.card(0, P.cardRatio);
    const stepSize = (vertical ? halfH * 2 : halfH * 2 * sample.aspect) * (1 + pct(P.gap) * 2);
    const phase = railPhase(ctx, P.motion === 'stop', P.easing);
    const curve = pct(P.curve);

    const quads = railOffsets(n, phase).map(({ i, d }) => {
        const along = d * stepSize;
        /*
         * La courbe 3D : plus la carte s'eloigne du centre, plus elle recule et
         * se couche. C'est un arc, pas une rotation rigide — chaque carte reste
         * plane, mais la bande entiere se lit comme un ruban.
         */
        const away = Math.abs(along);
        const z = -away * away * curve * 0.55;
        const lean = -Math.sign(along) * away * curve * 0.85;
        const centre = vertical ? [0, -along, z] : [along, 0, z];
        const right = vertical ? [1, 0, 0] : [Math.cos(lean), 0, Math.sin(lean)];
        const up = vertical ? [0, Math.cos(lean), Math.sin(lean)] : [0, 1, 0];
        return card(ctx, i, P.cardRatio, centre, right, up, halfH, {
            radius: pct(P.cornerRadius) * 6,
            fade: clamp(away * curve * 0.35, 0, 0.6),
        });
    });
    return { camera: cameraFor(32), quads };
}

const STRIP_PARAMS = (cardDef) => [
    { t: 'section', label: 'POSITION' }, RADIUS,
    { t: 'slider', k: 'cardSize', label: 'Card size', min: 8, max: 80, step: 1, def: cardDef, unit: '%' },
    { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 30, step: 0.5, def: 2.5, unit: '%', dec: 1 },
    { t: 'slider', k: 'curve', label: '3D curve (out / in)', min: -150, max: 150, step: 1, def: 70, unit: '%' },
    EASING, RATIO,
    { t: 'choice', k: 'motion', label: 'Motion', options: [['continuous', 'Continuous'], ['stop', 'Stop at center']], def: 'continuous' },
];

export const cardTotem = {
    id: 'card-totem',
    name: 'Card Totem',
    category: 'flow',
    slots: 6,
    loop: 12,
    params: STRIP_PARAMS(34),
    build(ctx) { return curvedStrip(ctx, true); },
};

export const filmStrip = {
    id: 'film-strip',
    name: 'Film Strip',
    category: 'flow',
    slots: 6,
    loop: 12,
    params: STRIP_PARAMS(32),
    build(ctx) { return curvedStrip(ctx, false); },
};

export const wheelCarousel = {
    id: 'wheel-carousel',
    name: 'Wheel Carousel',
    category: 'flow',
    slots: 6,
    loop: 9,
    params: [
        { t: 'section', label: 'POSITION' },
        { t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 5, unit: '%', dec: 1 },
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 20, max: 110, step: 1, def: 70, unit: '%' },
        { t: 'slider', k: 'wheelSize', label: 'Wheel size', min: 40, max: 220, step: 1, def: 105, unit: '%' },
        { t: 'slider', k: 'anticipation', label: 'Anticipation', min: 0, max: 60, step: 1, def: 20, unit: '%' },
        { t: 'slider', k: 'overshoot', label: 'Overshoot', min: 0, max: 60, step: 1, def: 10, unit: '%' },
        { t: 'slider', k: 'hold', label: 'Hold', min: 0, max: 80, step: 1, def: 33, unit: '%' },
        EASING,
        { t: 'choice', k: 'direction', label: 'Direction', options: [['cw', 'Clockwise'], ['ccw', 'Counter-clockwise']], def: 'cw' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        /*
         * Rayon moyen : assez grand pour que le voisin arrive par le cote et non
         * par le bas, assez petit pour qu'on le voie encore. Trop court, les
         * cartes tombaient sous le cadre ; trop long, il ne restait qu'une carte
         * seule au milieu.
         */
        const R = pct(P.wheelSize) * 1.55;
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5;
        const dir = P.direction === 'ccw' ? -1 : 1;

        /*
         * Le pas d'une carte se joue en trois temps : la roue recule un peu
         * (anticipation), part, puis depasse sa cible avant de s'y ranger
         * (overshoot). Un simple easing ne rendrait ni le premier ni le dernier.
         */
        const hold = pct(P.hold);
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const move = clamp((local - hold) / (1 - hold || 1), 0, 1);
        const eased = ease(P.easing, move);
        const anticip = -pct(P.anticipation) * Math.sin(clamp(move / 0.25, 0, 1) * Math.PI) * 0.25;
        const over = pct(P.overshoot) * Math.sin(clamp((move - 0.6) / 0.4, 0, 1) * Math.PI) * 0.25;
        const phase = index + eased + anticip + over;

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            const a = ((i - phase * dir) / n) * TAU;
            const x = Math.sin(a) * R;
            const y = Math.cos(a) * R - R;
            quads.push(card(ctx, i, P.cardRatio, [x, y, 0], [1, 0, 0], [0, 1, 0], halfH, {
                radius: pct(P.cornerRadius) * 6,
            }));
        }
        return { camera: cameraFor(12), quads };
    },
};

export const diagonalCarousel = {
    id: 'diagonal-carousel',
    name: 'Diagonal Carousel',
    category: 'flow',
    slots: 6,
    loop: 12,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 10, max: 90, step: 1, def: 40, unit: '%' },
        { t: 'slider', k: 'overlap', label: 'Overlap', min: 0, max: 90, step: 1, def: 55, unit: '%' },
        EASING,
        {
            t: 'choice',
            k: 'direction',
            label: 'Direction',
            options: [['dr', 'Down-right ↘'], ['dl', 'Down-left ↙'], ['ur', 'Up-right ↗'], ['ul', 'Up-left ↖']],
            def: 'dr',
        },
        { t: 'choice', k: 'movement', label: 'Movement', options: [['continuous', 'Continuous'], ['stepped', 'Stepped (per card)']], def: 'continuous' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.5 * scale;
        const sample = ctx.card(0, P.cardRatio);
        const step = halfH * 2 * (1 - pct(P.overlap));
        const sx = P.direction.includes('l') ? -1 : 1;
        const sy = P.direction.startsWith('d') ? -1 : 1;
        const phase = P.movement === 'stepped'
            ? steppedProgress(ctx.t, n, P.easing)
            : ctx.t * n;

        const quads = railOffsets(n, phase).map(({ i, d }) => card(
            ctx, i, P.cardRatio,
            [d * step * sample.aspect * sx, d * step * sy, -Math.abs(d) * 0.02],
            [1, 0, 0], [0, 1, 0], halfH,
            { radius: pct(P.cornerRadius) * 6, fade: clamp(Math.abs(d) * 0.18, 0, 0.5) },
        ));
        return { camera: cameraFor(14), quads };
    },
};

export const focusSlider = {
    id: 'focus-slider',
    name: 'Focus Slider',
    category: 'flow',
    slots: 8,
    loop: 10,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 20, max: 120, step: 1, def: 82, unit: '%' },
        { t: 'slider', k: 'centerScale', label: 'Center scale', min: 100, max: 320, step: 1, def: 200, unit: '%' },
        { t: 'slider', k: 'zigzag', label: 'Zigzag offset', min: 0, max: 150, step: 1, def: 55, unit: '%' },
        { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 40, step: 0.5, def: 6, unit: '%', dec: 1 },
        { t: 'slider', k: 'slide', label: 'Slide portion', min: 20, max: 100, step: 1, def: 80, unit: '%' },
        EASING,
        { t: 'choice', k: 'direction', label: 'Direction', options: [['h', 'Horizontal'], ['v', 'Vertical']], def: 'h' },
        RATIO,
        { t: 'choice', k: 'zigzagMode', label: 'Zigzag mode', options: [['alt', 'Alternate (flip each step)'], ['fixed', 'Fixed']], def: 'alt' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const vertical = P.direction === 'v';
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.25 * scale;
        const sample = ctx.card(0, P.cardRatio);
        const stepSize = (vertical ? halfH * 2 : halfH * 2 * sample.aspect) * (1 + pct(P.gap)) * (P.slide / 100);
        const phase = steppedProgress(ctx.t, n, P.easing);
        const zig = pct(P.zigzag) * halfH;

        const quads = railOffsets(n, phase).map(({ i, d }) => {
            const away = clamp(Math.abs(d), 0, 1);
            // La carte de tete est nettement plus grande ; les autres passent en
            // quinconce, un cran au-dessus puis un cran en dessous.
            const s = 1 + (P.centerScale / 100 - 1) * (1 - away);
            const side = P.zigzagMode === 'fixed' ? 1 : (i % 2 ? 1 : -1);
            const cross = side * zig * away;
            const along = d * stepSize;
            const centre = vertical ? [cross, -along, 0] : [along, cross, 0];
            return card(ctx, i, P.cardRatio, centre, [1, 0, 0], [0, 1, 0], halfH * s, {
                radius: pct(P.cornerRadius) * 6,
                fade: 0.3 * away,
            });
        });
        return { camera: cameraFor(14), quads };
    },
};

// Trois compositions de tuiles, comme les trois "Layout" de la reference :
// chaque entree est [colonne, ligne, largeur, hauteur] en unites de tuile.
const MOSAIC_LAYOUTS = [
    [[0, 0, 2, 2], [2, 0, 1, 1], [2, 1, 1, 1], [3, 0, 1, 2], [4, 0, 2, 2]],
    [[0, 0, 1, 2], [1, 0, 2, 1], [1, 1, 1, 1], [2, 1, 1, 1], [3, 0, 2, 2]],
    [[0, 0, 1, 1], [0, 1, 1, 1], [1, 0, 2, 2], [3, 0, 1, 2], [4, 0, 1, 1], [4, 1, 1, 1]],
];

export const mosaicMarquee = {
    id: 'mosaic-marquee',
    name: 'Mosaic Marquee',
    category: 'flow',
    slots: 10,
    loop: 12,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'cardHeight', label: 'Card height', min: 20, max: 100, step: 1, def: 55, unit: '%' },
        { t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 20, step: 0.5, def: 3, unit: '%', dec: 1 },
        RATIO,
        { t: 'choice', k: 'layout', label: 'Layout', options: [['1', 'Layout 1'], ['2', 'Layout 2'], ['3', 'Layout 3']], def: '1' },
        { t: 'choice', k: 'direction', label: 'Direction', options: [['left', 'Left'], ['right', 'Right']], def: 'left' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const layout = MOSAIC_LAYOUTS[Number(P.layout) - 1] || MOSAIC_LAYOUTS[0];
        const scale = paddingScale(P.padding);
        const unit = pct(P.cardHeight) * VIEW_HEIGHT * 0.5 * scale;
        const gap = unit * pct(P.gap) * 2;
        const patternW = (Math.max(...layout.map(([c, , w]) => c + w))) * (unit + gap);
        const slots = Math.max(1, ctx.slots);
        const sign = P.direction === 'right' ? -1 : 1;

        /*
         * La bande avance d'un nombre entier de motifs par tour, choisi pour que
         * le compte de tuiles parcourues soit un multiple du nombre de slots :
         * une tuile retrouve alors, en fin de boucle, la place d'une tuile qui
         * portait deja la meme image.
         */
        const perPattern = layout.length;
        const gcd = (a, b) => (b ? gcd(b, a % b) : a);
        const patternsPerLoop = slots / gcd(slots, perPattern);
        const offset = ctx.t * patternsPerLoop * patternW * sign;

        // Fenetre glissante de motifs, assez large pour deborder des deux cotes.
        const span = VIEW_HEIGHT * ctx.frameAspect;
        const reps = Math.ceil(span / patternW) + 2;
        const first = Math.floor(offset / patternW) - 1;
        const quads = [];
        for (let rep = first; rep < first + reps; rep += 1) {
            layout.forEach(([c, r, w, h], k) => {
                const x = (c + w / 2) * (unit + gap) + rep * patternW - offset - patternW / 2;
                const y = (0.5 - (r + h / 2) / 2) * (unit + gap) * 2;
                const halfW = (w * (unit + gap) - gap) / 2;
                const halfH = (h * (unit + gap) - gap) / 2;
                const media = ctx.cardAt(rep * perPattern + k, halfW / halfH);
                quads.push({
                    p: [
                        [x - halfW, y + halfH, 0], [x + halfW, y + halfH, 0],
                        [x + halfW, y - halfH, 0], [x - halfW, y - halfH, 0],
                    ],
                    tex: media.tex,
                    uvRect: media.uvRect,
                    aspect: halfW / halfH,
                    radius: pct(P.cornerRadius) * 6,
                });
            });
        }
        return { camera: cameraFor(10), quads };
    },
};

export const heroReel = {
    id: 'hero-reel',
    name: 'Hero Reel',
    category: 'flow',
    slots: 7,
    loop: 10,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'lift', label: 'Active lift', min: 0, max: 5, step: 0.1, def: 1.8, unit: '', dec: 1 },
        { t: 'slider', k: 'activeScale', label: 'Active scale', min: 100, max: 200, step: 1, def: 108, unit: '%' },
        { t: 'slider', k: 'spacing', label: 'Card spacing', min: 0.5, max: 5, step: 0.1, def: 2, unit: '', dec: 1 },
        { t: 'slider', k: 'heroOpacity', label: 'Hero opacity', min: 0, max: 100, step: 1, def: 55, unit: '%' },
        { t: 'slider', k: 'kenBurns', label: 'Ken Burns', min: 0, max: 150, step: 1, def: 60, unit: '%' },
        { t: 'slider', k: 'hold', label: 'Hold', min: 0, max: 90, step: 1, def: 55, unit: '%' },
        EASING, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const hold = pct(P.hold);
        const raw = ctx.t * n;
        const index = Math.floor(raw);
        const local = raw - index;
        const move = ease(P.easing, clamp((local - hold) / (1 - hold || 1), 0, 1));
        const phase = index + move;

        const quads = [];
        /*
         * Le fond : la carte active en grand, adoucie, avec un lent zoom
         * (Ken Burns). Les deux plans se croisent en fondu pendant le
         * changement — un basculement sec ferait clignoter la boucle.
         */
        const heroPlate = (i, zoom, alpha, z) => {
            const m = ctx.cardAt(i, ctx.frameAspect);
            return {
                p: [
                    [-ctx.frameAspect, 1, z], [ctx.frameAspect, 1, z],
                    [ctx.frameAspect, -1, z], [-ctx.frameAspect, -1, z],
                ],
                tex: m.tex,
                uvRect: zoomedUv(m.uvRect, zoom, 0, 0),
                aspect: ctx.frameAspect,
                radius: 0,
                alpha,
                castShadow: false,
            };
        };
        const kb = pct(P.kenBurns) * 0.15;
        quads.push(heroPlate(index, 1 + kb * local, 1, -0.6));
        if (move > 0) quads.push(heroPlate(index + 1, 1 + kb * (local - 1), move, -0.58));
        /*
         * Le fond est d'abord compose opaque, puis attenue par un voile de la
         * couleur de fond. Attenuer chaque plan separement aurait laisse le plan
         * sortant transparaitre au travers du plan entrant pendant tout le
         * fondu.
         */
        quads.push({
            p: [
                [-ctx.frameAspect, 1, -0.55], [ctx.frameAspect, 1, -0.55],
                [ctx.frameAspect, -1, -0.55], [-ctx.frameAspect, -1, -0.55],
            ],
            tex: null,
            color: ctx.bgRgb,
            aspect: ctx.frameAspect,
            radius: 0,
            alpha: 1 - pct(P.heroOpacity),
            castShadow: false,
        });

        // Le rail : une file de vignettes en bas, celle de tete se souleve.
        const halfH = 0.2 * scale;
        const stepSize = halfH * 2 * P.spacing;
        railOffsets(n, phase).forEach(({ i, d }) => {
            const away = clamp(Math.abs(d), 0, 1);
            const s = 1 + (P.activeScale / 100 - 1) * (1 - away);
            const lift = (1 - away) * P.lift * halfH * 0.5;
            quads.push(card(ctx, i, 'auto', [d * stepSize, -0.62 + lift, 0.1],
                [1, 0, 0], [0, 1, 0], halfH * s,
                { radius: pct(P.cornerRadius) * 6, fade: 0.25 * away }));
        });
        return { camera: cameraFor(10), quads };
    },
};
