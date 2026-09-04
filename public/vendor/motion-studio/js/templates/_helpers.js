/*
 * Briques communes aux templates.
 *
 * Convention de monde : la camera vise l'origine et cadre exactement 2 unites de
 * hauteur au plan z = 0. Donc "hauteur de carte = 21% du cadre" s'ecrit
 * simplement `0.21 * 2`. Toutes les tailles en pourcentage suivent cette regle,
 * ce qui rend les reglages comparables d'un template a l'autre.
 */

import {
    TAU, clamp, quadFromAxes, norm3, cross3, scale3, add3, rotX, rotY, rotZ,
} from '../engine/math.js';

export const VIEW_HEIGHT = 2;

/*
 * Le champ de vision suit le reglage "Perspective" : 0% = presque
 * orthographique, 100% = grand angle marque. La distance suit pour garder le
 * sujet a la meme taille, sinon changer la perspective changerait aussi le
 * cadrage.
 *
 * La courbe est en racine et non lineaire : c'est la seule facon d'obtenir, au
 * reglage par defaut de la reference (18%), l'ecart de taille marque entre la
 * carte de devant et celles du fond. Une rampe lineaire donnait un teleobjectif
 * qui aplatissait tout l'anneau.
 */
export function cameraFor(perspectivePct, framing = 1) {
    const fov = 20 + Math.sqrt(clamp(perspectivePct, 0, 100) / 100) * 52;
    const rad = (fov * Math.PI) / 180;
    const dist = (VIEW_HEIGHT / 2) / Math.tan(rad / 2) / framing;
    return { fov, dist };
}

export const pct = (v) => v / 100;

// Facteur d'echelle du reglage Padding : il resserre toute la scene.
export const paddingScale = (paddingPct) => clamp(1 - pct(paddingPct) * 2, 0.1, 1);

/*
 * Fabrique un quad a partir d'un centre et de deux axes. `halfH` est la
 * demi-hauteur ; la largeur decoule du ratio de la carte.
 */
export function card(ctx, index, ratioKey, center, right, up, halfH, extra = {}) {
    const c = ctx.card(index, ratioKey);
    return {
        p: quadFromAxes(center, norm3(right), norm3(up), halfH * c.aspect, halfH),
        tex: c.tex,
        uvRect: c.uvRect,
        aspect: c.aspect,
        ...extra,
    };
}

/*
 * Repere tangent pour une carte posee sur une surface : `normal` sort de la
 * surface, `up` est redresse vers le haut du monde quand c'est possible.
 */
export function tangentBasis(normal, worldUp = [0, 1, 0]) {
    const n = norm3(normal);
    let right = cross3(worldUp, n);
    if (Math.hypot(right[0], right[1], right[2]) < 1e-4) right = cross3([0, 0, 1], n);
    right = norm3(right);
    const up = norm3(cross3(n, right));
    return { right, up, normal: n };
}

/*
 * Fondu de profondeur : une carte loin derriere se dilue dans le fond. On
 * normalise sur l'etendue reelle de la scene pour que le reglage se comporte
 * pareil quelle que soit la taille de l'anneau ou de la sphere.
 */
export function depthFade(z, near, far, amount) {
    if (amount <= 0) return 0;
    const t = clamp((z - far) / ((near - far) || 1), 0, 1);
    return pct(amount) * (1 - t);
}

export const applyTilt = (p, tiltDeg) => (tiltDeg ? rotX(p, (tiltDeg * Math.PI) / 180) : p);
export const applyRoll = (p, deg) => (deg ? rotZ(p, (deg * Math.PI) / 180) : p);
export const applySpin = (p, deg) => (deg ? rotY(p, (deg * Math.PI) / 180) : p);

/*
 * Zoom "Ken Burns" : on retrecit la fenetre de texture au lieu d'agrandir le
 * quad.
 *
 * C'est la seule facon d'obtenir un fondu enchaine exact entre deux plans : si
 * le zoom passait par la geometrie, le plan sortant deborderait du plan entrant
 * et resterait visible tout autour, y compris a la fin du fondu.
 */
export function zoomedUv(uvRect, zoom, panX = 0, panY = 0) {
    const z = Math.max(zoom, 0.05);
    const w = uvRect[2] / z;
    const h = uvRect[3] / z;
    const freeX = uvRect[2] - w;
    const freeY = uvRect[3] - h;
    return [
        uvRect[0] + freeX * (0.5 + clamp(panX, -0.5, 0.5)),
        uvRect[1] + freeY * (0.5 + clamp(panY, -0.5, 0.5)),
        w, h,
    ];
}

// Bruit deterministe : un template disperse doit disperser toujours pareil,
// sinon l'export ne correspondrait plus a l'apercu.
export function hash(i, seed = 0) {
    const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

// Sens de defilement commun a la plupart des templates.
export function directionSign(dir, t) {
    if (dir === 'right' || dir === 'down' || dir === 'backward' || dir === 'ccw' || dir === 'top-bottom') return -1;
    if (dir === 'alternate') return Math.cos(t * TAU) >= 0 ? 1 : -1;
    return 1;
}

/*
 * "Waypoints" : au lieu de tourner en continu, la scene marque un temps sur
 * chaque position. Rend une progression 0..1 qui s'arrete et repart.
 */
export function waypointProgress(t, stops, hold = 0.45) {
    const raw = t * stops;
    const i = Math.floor(raw);
    const local = raw - i;
    const move = clamp((local - hold) / (1 - hold), 0, 1);
    const eased = move * move * (3 - 2 * move);
    return (i + eased) / stops;
}

export {
    TAU, clamp, quadFromAxes, norm3, cross3, scale3, add3, rotX, rotY, rotZ,
};
