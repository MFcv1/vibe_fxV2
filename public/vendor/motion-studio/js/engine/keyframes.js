/*
 * Animation des reglages dans la boucle.
 *
 * Une piste est la liste des valeurs qu'un reglage doit prendre a certains
 * instants. Entre deux points on interpole ; apres le dernier, on repart vers le
 * premier — la piste est donc CIRCULAIRE, comme la boucle elle-meme. C'est ce
 * qui garantit qu'un reglage anime ne casse pas le raccord de fin de boucle.
 *
 * Les cles sont prefixees : `p.<nom>` pour un reglage du template, `bg.<nom>`
 * pour une couleur de fond.
 */

export const trackKey = (scope, name) => `${scope}.${name}`;

const isColor = (v) => typeof v === 'string' && v.startsWith('#');

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbToHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))
    .toString(16).padStart(2, '0')).join('')}`;

function blend(a, b, m) {
    if (isColor(a) && isColor(b)) {
        const x = hexToRgb(a);
        const y = hexToRgb(b);
        return rgbToHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * m));
    }
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * m;
    return m < 0.5 ? a : b;
}

/*
 * Valeur d'une piste a l'instant `t` (entre 0 et 1).
 */
export function sampleTrack(keys, t) {
    if (!keys?.length) return undefined;
    if (keys.length === 1) return keys[0].v;

    const sorted = keys;
    let before = sorted[sorted.length - 1];
    let after = sorted[0];
    let span = 1 - before.t + after.t;
    let local = t >= before.t ? t - before.t : 1 - before.t + t;

    for (let i = 0; i < sorted.length - 1; i += 1) {
        if (t >= sorted[i].t && t <= sorted[i + 1].t) {
            before = sorted[i];
            after = sorted[i + 1];
            span = after.t - before.t;
            local = t - before.t;
            break;
        }
    }
    if (span <= 0) return after.v;
    // Adoucissement aux extremites : une valeur animee ne doit pas repartir
    // avec une cassure de vitesse au passage d'un point.
    const m = local / span;
    return blend(before.v, after.v, m * m * (3 - 2 * m));
}

/*
 * Rend les reglages effectifs a l'instant `t` : les valeurs figees, remplacees
 * par leur piste quand il y en a une.
 */
export function resolve(state, t) {
    const tracks = state.tracks;
    if (!tracks || !Object.keys(tracks).length) return state;

    const params = { ...state.params };
    const background = { ...state.background };
    Object.entries(tracks).forEach(([key, keys]) => {
        const value = sampleTrack(keys, t);
        if (value === undefined) return;
        const [scope, name] = [key.slice(0, key.indexOf('.')), key.slice(key.indexOf('.') + 1)];
        if (scope === 'p') params[name] = value;
        else if (scope === 'bg') background[name] = value;
    });
    return { ...state, params, background };
}

// Ajoute ou retire un point a l'instant courant.
export function toggle(tracks, key, t, value) {
    const next = { ...tracks };
    const keys = (next[key] || []).slice();
    const at = keys.findIndex((k) => Math.abs(k.t - t) < 0.005);
    if (at >= 0) {
        keys.splice(at, 1);
        if (keys.length) next[key] = keys; else delete next[key];
        return next;
    }
    keys.push({ t, v: value });
    keys.sort((a, b) => a.t - b.t);
    next[key] = keys;
    return next;
}

export const hasKeyAt = (tracks, key, t) => Boolean(
    tracks?.[key]?.some((k) => Math.abs(k.t - t) < 0.005),
);
