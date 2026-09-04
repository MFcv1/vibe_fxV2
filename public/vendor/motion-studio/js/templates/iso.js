/*
 * Famille isometrique : les cartes sont posees a plat sur un sol vu de
 * trois quarts.
 *
 * La camera est placee sur la diagonale et regarde l'origine avec une focale
 * tres longue : les fuyantes restent paralleles, ce qui est exactement ce que
 * l'oeil attend d'une vue isometrique. Les cartes, elles, ne sont pas deformees
 * a la main — elles sont vraiment couchees dans le plan du sol.
 */

import {
    TAU, pct, card, cameraFor, paddingScale, clamp, VIEW_HEIGHT,
} from './_helpers.js';
import { ease, steppedProgress } from '../engine/math.js';

const RATIO = { t: 'ratio', k: 'cardRatio', label: 'Card ratio', def: 'auto' };
const PADDING = {
    t: 'slider', k: 'padding', label: 'Padding', min: 0, max: 25, step: 0.5, def: 6, unit: '%', dec: 1,
};
const RADIUS = {
    t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 12, step: 0.5, def: 3, unit: '%', dec: 1,
};
const EASING = { t: 'easing', k: 'easing', label: 'Easing', def: 'custom' };

/*
 * `tilt` a 0 regarde le sol presque de face, a 100 le survole a la verticale.
 *
 * La distance reste fixe et la focale est calculee pour cadrer exactement deux
 * unites de hauteur, comme dans le reste du moteur : une carte d'une demi-unite
 * occupe donc partout la meme part du cadre, quelle que soit la famille.
 */
function isoCamera(tiltPct) {
    // L'elevation part de plus haut : trop rase, une carte posee au sol se
    // reduisait a un losange etire illisible.
    const el = 0.34 + pct(tiltPct) * 0.44;         // elevation, en tours
    const d = 9;
    const a = Math.PI / 4;
    const eye = [
        Math.sin(a) * d * Math.cos(el * Math.PI / 2),
        Math.sin(el * Math.PI / 2) * d,
        Math.cos(a) * d * Math.cos(el * Math.PI / 2),
    ];
    // Focale longue : les aretes paralleles le restent a l'ecran.
    const fov = 2 * Math.atan((VIEW_HEIGHT / 2) / d) * (180 / Math.PI);
    return { fov, dist: d, eye };
}

// Une carte couchee sur le sol, centree en (u, w) et flottant a la hauteur h.
const ground = (u, h, w) => [u, h, w];
/*
 * Les cotes de la carte suivent les DIAGONALES du sol, pas ses axes.
 *
 * La camera regarde a 45 degres : une carte alignee sur les axes du sol se
 * projette en losange pointu, alors que la reference montre des rectangles
 * arrondis dont le haut et le bas restent presque horizontaux. Tourner la carte
 * de 45 degres dans son plan suffit a retrouver cette lecture.
 */
const R2 = Math.SQRT1_2;
const GROUND_RIGHT = [R2, 0, -R2];
const GROUND_UP = [R2, 0, R2];

/*
 * Carte DEBOUT vue en isometrie.
 *
 * Sur la reference, Iso Cascade et Iso Focus ne posent pas leurs cartes a plat :
 * elles restent face a nous et sont CISAILLEES, ce qui les transforme en
 * parallelogrammes dresses. Une carte couchee au sol donnait des losanges tres
 * differents. Le reglage "Tilt" pilote la force du cisaillement.
 */
function shearedCard(ctx, index, ratioKey, cx, cy, halfH, shear, extra = {}) {
    const c = ctx.card(index, ratioKey);
    const hw = halfH * c.aspect;
    const skew = (y) => cx + y * shear;
    return {
        p: [
            [skew(cy + halfH) - hw, cy + halfH, 0], [skew(cy + halfH) + hw, cy + halfH, 0],
            [skew(cy - halfH) + hw, cy - halfH, 0], [skew(cy - halfH) - hw, cy - halfH, 0],
        ],
        tex: c.tex,
        uvRect: c.uvRect,
        aspect: c.aspect,
        ...extra,
    };
}

export const isoCascade = {
    id: 'iso-cascade',
    name: 'Iso Cascade',
    category: 'iso',
    slots: 10,
    loop: 10,
    params: [
        PADDING, RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 10, max: 100, step: 1, def: 42, unit: '%' },
        { t: 'slider', k: 'tilt', label: 'Tilt', min: 0, max: 100, step: 1, def: 70, unit: '%' },
        { t: 'slider', k: 'spacing', label: 'Spacing', min: 5, max: 120, step: 1, def: 40, unit: '%' },
        EASING, RATIO,
        { t: 'choice', k: 'motion', label: 'Motion', options: [['continuous', 'Continuous'], ['stepped', 'Stepped']], def: 'continuous' },
        {
            t: 'choice',
            k: 'direction',
            label: 'Direction',
            options: [['ur', 'Up-right'], ['dl', 'Down-left'], ['dr', 'Down-right'], ['ul', 'Up-left']],
            def: 'ur',
        },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const scale = paddingScale(P.padding);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.45 * scale;
        const step = halfH * 2 * (0.35 + pct(P.spacing) * 0.9);
        const shear = pct(P.tilt) * 0.5;
        const phase = P.motion === 'stepped'
            ? steppedProgress(ctx.t, n, P.easing)
            : ctx.t * n;

        // La file descend en diagonale a l'ecran ; le sens choisi ne fait que
        // retourner les deux composantes.
        const sx = P.direction.includes('r') ? 1 : -1;
        const sy = P.direction.startsWith('u') ? 1 : -1;

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            let d = i - phase;
            d = ((d % n) + n) % n;
            if (d > n / 2) d -= n;
            const along = d * step;
            quads.push(shearedCard(ctx, i, P.cardRatio,
                along * sx * 0.95, along * sy * 0.62, halfH, shear,
                {
                    radius: pct(P.cornerRadius) * 6,
                    alpha: clamp(1.8 - (Math.abs(d) / (n / 2)) * 1.8, 0, 1),
                }));
        }
        return { camera: cameraFor(6), quads };
    },
};

export const isoFocus = {
    id: 'iso-focus',
    name: 'Iso Focus',
    category: 'iso',
    slots: 10,
    loop: 12,
    params: [
        RADIUS,
        { t: 'slider', k: 'cardSize', label: 'Card size', min: 10, max: 100, step: 1, def: 42, unit: '%' },
        { t: 'slider', k: 'tilt', label: 'Tilt', min: 0, max: 100, step: 1, def: 20, unit: '%' },
        { t: 'slider', k: 'spacing', label: 'Spacing', min: 5, max: 120, step: 1, def: 20, unit: '%' },
        { t: 'slider', k: 'focusGap', label: 'Focus gap', min: 0, max: 200, step: 1, def: 85, unit: '%' },
        { t: 'slider', k: 'centerScale', label: 'Center scale', min: 50, max: 250, step: 1, def: 100, unit: '%' },
        EASING, RATIO,
        { t: 'choice', k: 'direction', label: 'Direction', options: [['dl', 'Down-left'], ['ur', 'Up-right']], def: 'dl' },
        { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const halfH = pct(P.cardSize) * VIEW_HEIGHT * 0.42;
        const step = halfH * 2 * (0.35 + pct(P.spacing) * 0.9);
        const gap = pct(P.focusGap) * halfH * 0.8;
        const shear = pct(P.tilt) * 0.5;
        const phase = steppedProgress(ctx.t, n, P.easing);
        const sx = P.direction === 'ur' ? 1 : -1;

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            let d = i - phase;
            d = ((d % n) + n) % n;
            if (d > n / 2) d -= n;
            // La carte de tete est ecartee de ses deux voisines et grossit :
            // c'est elle qu'on lit, la file reste derriere.
            const away = clamp(Math.abs(d), 0, 1);
            const along = d * step + Math.sign(d) * gap * away;
            const sc = 1 + (P.centerScale / 100 - 1) * (1 - away);
            quads.push(shearedCard(ctx, i, P.cardRatio,
                along * sx * 0.95, along * 0.62, halfH * sc, shear,
                {
                    radius: pct(P.cornerRadius) * 6,
                    alpha: clamp(1.8 - (Math.abs(d) / (n / 2)) * 1.8, 0, 1),
                }));
        }
        return { camera: cameraFor(6), quads };
    },
};

export const isoOrbit = {
    id: 'iso-orbit',
    name: 'Iso Orbit',
    category: 'iso',
    slots: 9,
    loop: 10,
    params: [
        { t: 'section', label: 'POSITION' }, PADDING, RADIUS,
        { t: 'slider', k: 'zoom', label: 'Zoom', min: 20, max: 200, step: 1, def: 85, unit: '%' },
        { t: 'slider', k: 'spacing', label: 'Spacing', min: 0, max: 100, step: 1, def: 18, unit: '%' },
        { t: 'slider', k: 'tilt', label: 'Tilt', min: 0, max: 100, step: 1, def: 55, unit: '%' },
        { t: 'slider', k: 'swing', label: 'Swing angle', min: 0, max: 180, step: 1, def: 30, unit: '°' },
        { t: 'slider', k: 'float', label: 'Float', min: 0, max: 20, step: 0.5, def: 2.5, unit: '%', dec: 1 },
        { t: 'choice', k: 'motion', label: 'Motion', options: [['swing', 'Swing'], ['spin', 'Full spin']], def: 'swing' },
        RATIO, { t: 'shadow' },
    ],
    build(ctx) {
        const { P } = ctx;
        const n = Math.max(1, ctx.slots);
        const cols = Math.max(1, Math.round(Math.sqrt(n)));
        const scale = paddingScale(P.padding);
        // La carte est dimensionnee pour que la grille entiere tienne dans le
        // cadre : sans ca, une grille 3x3 debordait de deux fois sa taille.
        const half = ((VIEW_HEIGHT * 0.62) / (cols * (1 + pct(P.spacing))))
            * (0.45 + pct(P.zoom) * 0.75) * scale;
        const step = half * 2 * (1 + pct(P.spacing));

        // "Swing" balance la grille d'un cote a l'autre, "Full spin" lui fait
        // faire le tour. Les deux reviennent a leur point de depart.
        const angle = P.motion === 'spin'
            ? ctx.t * TAU
            : Math.sin(ctx.t * TAU) * (P.swing * Math.PI) / 180;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        /*
         * Les cotes de la carte sont tournes d'un huitieme de tour par rapport a
         * la grille. La camera regarde le sol a 45 degres : sans ce quart de
         * decalage, chaque carte se projetait en losange pointu au lieu du
         * rectangle arrondi de la reference.
         */
        const ca = Math.cos(angle - Math.PI / 4);
        const sa = Math.sin(angle - Math.PI / 4);

        const quads = [];
        for (let i = 0; i < n; i += 1) {
            const cx = (i % cols) - (cols - 1) / 2;
            const cz = Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2;
            // La grille suit les memes diagonales que les cartes.
            const u = (cx + cz) * step * R2;
            const w = (cz - cx) * step * R2;
            // Chaque carte flotte a son propre rythme, decalees entre elles.
            const bob = Math.sin(ctx.t * TAU + i * 0.9) * pct(P.float) * half * 3;
            quads.push(card(ctx, i, P.cardRatio,
                ground(u * c - w * s, bob, u * s + w * c),
                [ca, 0, sa], [-sa, 0, -ca], half,
                { radius: pct(P.cornerRadius) * 6 }));
        }
        return { camera: isoCamera(P.tilt), quads };
    },
};
