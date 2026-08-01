export const MEDIA_TYPES = Object.freeze({
    VIDEO: 'video',
    IMAGE: 'image',
});

export const DEFAULT_IMAGE_DURATION_SECONDS = 4;
export const MIN_IMAGE_DURATION_SECONDS = 0.5;
export const MAX_IMAGE_DURATION_SECONDS = 60;

export const IMAGE_MOTION_PRESETS = Object.freeze([
    {
        id: 'none',
        name: 'Fixe',
        description: 'Cadre stable',
        start: { scale: 1, x: 0, y: 0 },
        end: { scale: 1, x: 0, y: 0 },
    },
    {
        id: 'zoom-in',
        name: 'Zoom avant',
        description: 'Approche douce',
        start: { scale: 1, x: 0, y: 0 },
        end: { scale: 1.14, x: 0, y: 0 },
    },
    {
        id: 'zoom-out',
        name: 'Zoom arriere',
        description: 'Ouverture progressive',
        start: { scale: 1.14, x: 0, y: 0 },
        end: { scale: 1, x: 0, y: 0 },
    },
    {
        id: 'pan-left',
        name: 'Pan gauche',
        description: 'Glissement lateral',
        start: { scale: 1.12, x: 0.055, y: 0 },
        end: { scale: 1.12, x: -0.055, y: 0 },
    },
    {
        id: 'pan-right',
        name: 'Pan droite',
        description: 'Glissement lateral',
        start: { scale: 1.12, x: -0.055, y: 0 },
        end: { scale: 1.12, x: 0.055, y: 0 },
    },
    {
        id: 'drift-up',
        name: 'Montee',
        description: 'Mouvement vertical',
        start: { scale: 1.1, x: 0, y: 0.045 },
        end: { scale: 1.14, x: 0, y: -0.045 },
    },
]);

const IMAGE_MOTION_BY_ID = new Map(IMAGE_MOTION_PRESETS.map((preset) => [preset.id, preset]));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finiteNumber = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export function normalizeMediaType(source = {}) {
    if (source.mediaType === MEDIA_TYPES.IMAGE || source.mediaType === MEDIA_TYPES.VIDEO) {
        return source.mediaType;
    }
    const mimeType = String(source.mimeType || source.type || source.file?.type || '').toLowerCase();
    return mimeType.startsWith('image/') ? MEDIA_TYPES.IMAGE : MEDIA_TYPES.VIDEO;
}

export function isImageMedia(source = {}) {
    return normalizeMediaType(source) === MEDIA_TYPES.IMAGE;
}

export function normalizeImageDuration(value, fallback = DEFAULT_IMAGE_DURATION_SECONDS) {
    return clamp(
        finiteNumber(value, fallback),
        MIN_IMAGE_DURATION_SECONDS,
        MAX_IMAGE_DURATION_SECONDS
    );
}

/*
 * Intensite du mouvement (lot L3, 2026-07-30).
 *
 * Un seul facteur applique a l'ECART start -> end. C'est volontairement la
 * formule la plus pauvre possible, parce que c'est celle que le renderer peut
 * ecrire a l'identique dans son expression `zoompan`: la parite apercu/export
 * est alors garantie par construction, pas par surveillance.
 * Le cadrage de DEPART ne bouge pas: baisser l'intensite raccourcit la course,
 * il ne recadre pas la photo.
 */
export const MIN_IMAGE_MOTION_INTENSITY = 0;
export const MAX_IMAGE_MOTION_INTENSITY = 1;
export const DEFAULT_IMAGE_MOTION_INTENSITY = 1;

export function normalizeImageMotionIntensity(value, fallback = DEFAULT_IMAGE_MOTION_INTENSITY) {
    return clamp(
        finiteNumber(value, fallback),
        MIN_IMAGE_MOTION_INTENSITY,
        MAX_IMAGE_MOTION_INTENSITY
    );
}

export function normalizeImageMotion(motion = 'none') {
    const requested = typeof motion === 'string' ? motion : motion?.preset;
    const preset = IMAGE_MOTION_BY_ID.get(requested) || IMAGE_MOTION_BY_ID.get('none');
    const custom = typeof motion === 'object' && motion ? motion : {};
    const normalizeFrame = (frame, presetFrame) => ({
        scale: clamp(finiteNumber(frame?.scale, presetFrame.scale), 1, 2),
        x: clamp(finiteNumber(frame?.x, presetFrame.x), -0.35, 0.35),
        y: clamp(finiteNumber(frame?.y, presetFrame.y), -0.35, 0.35),
    });

    return {
        preset: preset.id,
        easing: custom.easing === 'linear' ? 'linear' : 'ease-in-out',
        intensity: normalizeImageMotionIntensity(custom.intensity),
        start: normalizeFrame(custom.start, preset.start),
        end: normalizeFrame(custom.end, preset.end),
    };
}

export function resolveImageMotionFrame(motion, progress = 0) {
    const normalized = normalizeImageMotion(motion);
    const rawProgress = clamp(finiteNumber(progress, 0), 0, 1);
    // `smoothstep`. Le renderer porte la MEME courbe depuis le lot L3
    // (`buildImageMotionFilter`): un zoom qui part doucement ici partait sec
    // a l'export, et ce defaut existait depuis l'origine.
    const easedProgress = normalized.easing === 'linear'
        ? rawProgress
        : rawProgress * rawProgress * (3 - 2 * rawProgress);
    const travel = easedProgress * normalized.intensity;
    const mix = (start, end) => start + (end - start) * travel;

    return {
        preset: normalized.preset,
        intensity: normalized.intensity,
        progress: easedProgress,
        scale: mix(normalized.start.scale, normalized.end.scale),
        x: mix(normalized.start.x, normalized.end.x),
        y: mix(normalized.start.y, normalized.end.y),
    };
}

/*
 * Transformation de cadrage d'une photo animee, telle que l'apercu la pose.
 *
 * Extraite de `VideoEngine.drawFilteredSource` au lot L3 pour que le test de
 * parite mesure le code de PRODUCTION et non une copie: ce module n'a aucun
 * import, il se charge donc tel quel dans un Chromium de test.
 *
 * Un point source (u, v) atterrit en X = s*(u - w/2) + w/2 + x*w, donc l'apercu
 * echantillonne u = X/s + (w - w/s)/2 - (x/s)*w. C'est cette derniere forme que
 * l'expression `zoompan` du renderer doit reproduire — le `/s` sur le decalage
 * inclus, sans lui un panoramique voyage ~11 % trop loin a l'export.
 */
export function applyImageMotionTransform(ctx, motion, progress, width, height) {
    const frame = resolveImageMotionFrame(motion, progress);
    ctx.translate(width / 2 + frame.x * width, height / 2 + frame.y * height);
    ctx.scale(frame.scale, frame.scale);
    ctx.translate(-width / 2, -height / 2);
    return frame;
}
