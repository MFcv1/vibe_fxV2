/*
 * Card Tunnel : quatre parois de cartes qui forment un couloir, et une camera
 * qui avance dedans.
 *
 * Les cartes ne bougent pas d'une paroi a l'autre : c'est leur position en
 * profondeur qui defile, et l'indice de texture est calcule a partir de la
 * coordonnee logique de la case. La boucle se referme donc exactement.
 */

import {
    pct, card, cameraFor, clamp, VIEW_HEIGHT,
} from './_helpers.js';

const SPAN = 16;      // profondeur du couloir, en unites monde
const NEAR = 1.8;     // les cartes filent jusqu'au ras de la camera

// Les quatre parois : normale rentrante, axe de largeur (le long du couloir) et
// axe de hauteur (dans le plan de la paroi).
const WALLS = [
    { axis: [-1, 0, 0], up: [0, 1, 0] },   // gauche
    { axis: [1, 0, 0], up: [0, 1, 0] },    // droite
    { axis: [0, 1, 0], up: [1, 0, 0] },    // plafond
    { axis: [0, -1, 0], up: [1, 0, 0] },   // sol
];

export const cardTunnel = {
    id: 'card-tunnel',
    name: 'Card Tunnel',
    category: '3d',
    slots: 8,
    loop: 20,
    params: [
        {
            t: 'slider', k: 'cornerRadius', label: 'Corner radius', min: 0, max: 10, step: 0.5, def: 1.5, unit: '%', dec: 1,
        },
        {
            t: 'slider', k: 'tunnelSize', label: 'Tunnel size', min: 30, max: 200, step: 1, def: 90, unit: '%',
        },
        {
            t: 'slider', k: 'cardLength', label: 'Card length', min: 15, max: 120, step: 1, def: 55, unit: '%',
        },
        {
            t: 'slider', k: 'gap', label: 'Gap', min: 0, max: 60, step: 1, def: 10, unit: '%',
        },
        {
            t: 'slider', k: 'depthFade', label: 'Depth fade', min: 0, max: 100, step: 1, def: 45, unit: '%',
        },
        {
            t: 'choice', k: 'direction', label: 'Direction', options: [['forward', 'Forward'], ['backward', 'Backward']], def: 'forward',
        },
    ],
    build(ctx) {
        const { P } = ctx;
        // Le couloir doit deborder du cadre a son extremite proche : sinon on
        // voit ses quatre aretes et il se lit comme une pile de cadres, pas
        // comme un tunnel qu'on traverse.
        const half = pct(P.tunnelSize) * VIEW_HEIGHT * 0.78;
        const len = pct(P.cardLength) * VIEW_HEIGHT;
        const step = len * (1 + pct(P.gap));
        const slots = Math.max(1, ctx.slots);

        const dir = P.direction === 'backward' ? -1 : 1;
        const offset = ctx.t * slots * step * dir;
        const cells = clamp(Math.ceil(SPAN / step) + 2, 3, 60);
        // La premiere case doit tomber au ras de la camera, pas derriere elle :
        // sinon le couloir demarre trop loin et se lit comme une boite posee au
        // milieu du cadre.
        const baseCell = Math.floor((offset + NEAR) / step);

        const quads = [];
        WALLS.forEach((wall, w) => {
            for (let c = 0; c < cells; c += 1) {
                const cell = baseCell - c;
                const z = cell * step - offset;
                if (z > NEAR || z < -SPAN) continue;

                // Centre de la carte : au milieu de sa paroi, a la profondeur z.
                const center = [
                    wall.axis[0] * half,
                    wall.axis[1] * half,
                    z - len / 2,
                ];
                // La largeur de la carte court le long du couloir ; sa hauteur
                // traverse toute la paroi, sinon les quatre faces ne se
                // rejoindraient pas dans les angles et le couloir serait ouvert.
                const right = [0, 0, 1];
                const up = wall.up;
                const halfW = len / 2;
                const halfH = half;

                const depth = clamp(-z / SPAN, 0, 1);
                const texIndex = ((cell * 4 + w) % slots + slots) % slots;
                const c2 = ctx.cardAt(texIndex, halfW / halfH);
                quads.push({
                    p: [
                        [center[0] - right[0] * halfW + up[0] * halfH,
                            center[1] - right[1] * halfW + up[1] * halfH,
                            center[2] - right[2] * halfW + up[2] * halfH],
                        [center[0] + right[0] * halfW + up[0] * halfH,
                            center[1] + right[1] * halfW + up[1] * halfH,
                            center[2] + right[2] * halfW + up[2] * halfH],
                        [center[0] + right[0] * halfW - up[0] * halfH,
                            center[1] + right[1] * halfW - up[1] * halfH,
                            center[2] + right[2] * halfW - up[2] * halfH],
                        [center[0] - right[0] * halfW - up[0] * halfH,
                            center[1] - right[1] * halfW - up[1] * halfH,
                            center[2] - right[2] * halfW - up[2] * halfH],
                    ],
                    tex: c2.tex,
                    uvRect: c2.uvRect,
                    aspect: halfW / halfH,
                    radius: pct(P.cornerRadius) * 6,
                    fade: pct(P.depthFade) * depth,
                    castShadow: false,
                });
            }
        });
        return { camera: cameraFor(46, 1), quads };
    },
};
