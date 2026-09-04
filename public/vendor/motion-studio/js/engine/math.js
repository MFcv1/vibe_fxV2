// Petite bibliotheque math : juste ce que le moteur consomme.
// Les matrices sont en column-major, comme WebGL les attend.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const fract = (v) => v - Math.floor(v);
export const smoothstep = (t) => t * t * (3 - 2 * t);

export function mat4() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0,
    ]);
}

export function lookAt(eye, target, up) {
    const z = norm3(sub3(eye, target));
    const x = norm3(cross3(up, z));
    const y = cross3(z, x);
    return new Float32Array([
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1,
    ]);
}

export function multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c += 1) {
        for (let r = 0; r < 4; r += 1) {
            out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
                + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
    }
    return out;
}

export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
export function norm3(a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
}

// Rotations appliquees a un point, dans l'ordre ou les templates en ont besoin.
export function rotY(p, a) {
    const c = Math.cos(a); const s = Math.sin(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
export function rotX(p, a) {
    const c = Math.cos(a); const s = Math.sin(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}
export function rotZ(p, a) {
    const c = Math.cos(a); const s = Math.sin(a);
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

/*
 * Construit les 4 coins d'une carte a partir d'un centre, d'une demi-largeur et
 * d'une demi-hauteur exprimees le long de deux axes. Ordre TL, TR, BR, BL, celui
 * qu'attend le renderer.
 */
export function quadFromAxes(center, right, up, halfW, halfH) {
    const rw = scale3(right, halfW);
    const uh = scale3(up, halfH);
    return [
        add3(center, add3(scale3(rw, -1), uh)),
        add3(center, add3(rw, uh)),
        add3(center, add3(rw, scale3(uh, -1))),
        add3(center, add3(scale3(rw, -1), scale3(uh, -1))),
    ];
}

// Les 12 courbes proposees par l'inspecteur (Cover Ring, Spiral Stream).
export const EASINGS = {
    linear: (t) => t,
    custom: (t) => t * t * (3 - 2 * t),
    smooth: (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2),
    natural: (t) => 1 - ((1 - t) ** 3),
    slowdown: (t) => 1 - ((1 - t) ** 4),
    snappy: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - ((-2 * t + 2) ** 4) / 2),
    accelerate: (t) => t * t * t,
    elastic: (t) => {
        if (t === 0 || t === 1) return t;
        return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    },
    bounce: (t) => {
        const n = 7.5625; const d = 2.75;
        if (t < 1 / d) return n * t * t;
        if (t < 2 / d) { const u = t - 1.5 / d; return n * u * u + 0.75; }
        if (t < 2.5 / d) { const u = t - 2.25 / d; return n * u * u + 0.9375; }
        const u = t - 2.625 / d; return n * u * u + 0.984375;
    },
    overshoot: (t) => {
        const c = 1.70158; const c3 = c + 1;
        return 1 + c3 * ((t - 1) ** 3) + c * ((t - 1) ** 2);
    },
    impulse: (t) => 1 - ((1 - t) ** 6),
    swing: (t) => 0.5 - Math.cos(t * Math.PI) / 2,
};

export const EASING_LABELS = [
    ['custom', 'Custom'], ['smooth', 'Smooth'], ['natural', 'Natural'],
    ['slowdown', 'Slow down'], ['snappy', 'Snappy'], ['accelerate', 'Accelerate'],
    ['elastic', 'Elastic'], ['bounce', 'Bounce'], ['overshoot', 'Overshoot'],
    ['impulse', 'Impulse'], ['swing', 'Swing'], ['linear', 'Linear'],
];

export function ease(name, t) {
    const fn = EASINGS[name] || EASINGS.custom;
    return fn(clamp(t, 0, 1));
}

/*
 * Avance "par carte" : le defilement marque un temps sur chaque carte au lieu de
 * tourner en continu. Rend une position fractionnaire dans la suite de cartes.
 */
export function steppedProgress(t, count, easing, hold = 0.35) {
    const raw = t * count;
    const index = Math.floor(raw);
    const local = raw - index;
    const move = clamp((local - hold) / (1 - hold), 0, 1);
    return index + ease(easing, move);
}
