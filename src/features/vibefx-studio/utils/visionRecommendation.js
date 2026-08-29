/*
 * Recommandation Vision partagee.
 *
 * Ce module ne contient RIEN de nouveau: c'est le code de recommandation qui
 * vivait dans `components/panels/VisionPanel.jsx`, sorti tel quel pour que
 * l'ancien panneau Vision et le nouvel ecran VibeOS (`/creer/vision`)
 * s'appuient sur exactement la meme science, sans duplication.
 *
 * - `getImageRecommendationSignals` lit les metriques de `visionMetrics.js`
 *   (peau, ciel, feuillage, basse lumiere, image plate...).
 * - `scoreProfileForImage` classe un profil pour CETTE photo, avec la raison.
 * - `renderVisionProfilePreview` rend la vignette d'un look sur la vraie photo.
 */

import { DEFAULT_FILTERS } from '../hooks/useStudioFilters';
import { normalizeVisionFilters } from './visionColorScience.js';
import {
    applyFusedPixelOps,
    applyPerceptualIntensityBlend,
    applySafeGlobalTint,
    applySmartphoneOutputGuards,
} from './canvasUtils';

export const PREVIEW_ASPECT_WIDTH = 96;
export const PREVIEW_ASPECT_HEIGHT = 58;
export const PREVIEW_RENDER_WIDTH = 384;
export const PREVIEW_RENDER_HEIGHT = Math.round((PREVIEW_RENDER_WIDTH * PREVIEW_ASPECT_HEIGHT) / PREVIEW_ASPECT_WIDTH);
export const PREVIEW_DISPLAY_ASPECT_RATIO = `${PREVIEW_ASPECT_WIDTH} / ${PREVIEW_ASPECT_HEIGHT}`;

export function getImageRecommendationSignals(metrics = {}) {
    const tonalRange = Math.max(0, (metrics.lumaP95 || 0) - (metrics.lumaP05 || 0));
    const lowLight = (metrics.meanLuma || 0) < 86 && (metrics.lumaP95 || 0) < 205;
    const portrait = (metrics.skinToneRatio || 0) > 0.035 || (metrics.skinToneConfidence || 0) > 0.018;
    const landscape = (metrics.skyToneRatio || 0) > 0.08 || (metrics.foliageToneRatio || 0) > 0.08;
    const saturated = (metrics.highSaturationRatio || 0) > 0.08 || (metrics.maxSaturation || 0) > 0.92;
    const flat = tonalRange > 0 && tonalRange < 118;
    const warm = (metrics.warmToneRatio || 0) > 0.08;
    const neutralHeavy = (metrics.protectedNeutralRatio || 0) > 0.22;

    return { tonalRange, lowLight, portrait, landscape, saturated, flat, warm, neutralHeavy };
}

export function getImageRecommendationSignalTags(signals = {}) {
    const tags = [];
    if (signals.portrait) tags.push('peau');
    if (signals.landscape) tags.push('ciel/verts');
    if (signals.lowLight) tags.push('basse lumiere');
    if (signals.saturated) tags.push('deja saturee');
    if (signals.flat) tags.push('image plate');
    if (signals.warm) tags.push('tons chauds');
    if (signals.neutralHeavy) tags.push('neutres');
    return tags.length ? tags : ['polyvalent'];
}

export function scoreProfileForImage(profile, signals) {
    const family = profile?.vision?.family || '';
    let score = family === 'Natural Clean' ? 10 : 0;
    const reasons = [];

    if (signals.portrait && family === 'Portrait Skin') {
        score += 42;
        reasons.push('peau detectee');
    }
    if (signals.landscape && family === 'Landscape Vivid Safe') {
        score += 40;
        reasons.push('ciel/verts');
    }
    if (signals.lowLight && family === 'Cinema Night') {
        score += 38;
        reasons.push('basse lumiere');
    }
    if (signals.saturated && ['Natural Clean', 'Chrome Street', 'Film Soft'].includes(family)) {
        score += 24;
        reasons.push('saturation deja haute');
    }
    if (signals.saturated && family === 'Landscape Vivid Safe') score -= 18;
    if (signals.flat && ['Natural Clean', 'Chrome Street'].includes(family)) {
        score += 22;
        reasons.push('image plate');
    }
    if (signals.flat && family === 'Editorial Matte') score -= 14;
    if (signals.warm && family === 'Film Soft') {
        score += 18;
        reasons.push('tons chauds');
    }
    if (signals.neutralHeavy && family === 'Natural Clean') {
        score += 14;
        reasons.push('neutres a preserver');
    }
    if (!signals.portrait && !signals.landscape && !signals.lowLight && family === 'Natural Clean') {
        score += 18;
        reasons.push('polyvalent');
    }
    if (profile?.vision?.strength === 'experimental') score -= 16;
    if (profile?.vision?.strength === 'strong' && signals.saturated) score -= 10;

    return {
        score,
        reason: reasons.slice(0, 2).join(' + ') || profile?.vision?.previewTags?.[0] || 'safe smartphone',
    };
}

/*
 * Vignette d'un profil rendue sur la vraie photo.
 *
 * `options` a ete ajoute a la phase D pour l'ecran Studio, qui doit pouvoir
 * afficher une ambiance a son intensite reelle et, si l'utilisateur coupe les
 * garde-fous, sans le bornage smartphone. Les valeurs par defaut reproduisent
 * exactement le comportement d'origine (garde-fous actifs, intensite 100), donc
 * les appelants existants ne changent pas d'un pixel.
 */
export function renderVisionProfilePreview(sourceImage, profile, options = {}) {
    const { safeSmartphone = true, filterIntensity = 100 } = options;
    if (!sourceImage || typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_RENDER_WIDTH;
    canvas.height = PREVIEW_RENDER_HEIGHT;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const profileParameters = profile?.vision?.parameters || profile?.parameters || profile?.filters || {};
    const filters = normalizeVisionFilters({ ...DEFAULT_FILTERS, ...profileParameters, safeSmartphone, filterIntensity: 100 });
    const sourceW = sourceImage.naturalWidth || sourceImage.width;
    const sourceH = sourceImage.naturalHeight || sourceImage.height;
    if (!sourceW || !sourceH) return null;

    const sourceRatio = sourceW / sourceH;
    const targetRatio = PREVIEW_RENDER_WIDTH / PREVIEW_RENDER_HEIGHT;
    let sx = 0;
    let sy = 0;
    let sw = sourceW;
    let sh = sourceH;
    if (sourceRatio > targetRatio) {
        sw = sourceH * targetRatio;
        sx = (sourceW - sw) / 2;
    } else {
        sh = sourceW / targetRatio;
        sy = (sourceH - sh) / 2;
    }

    /* Copie non filtree, uniquement quand l'intensite demandee est partielle:
       c'est le meme melange lineaire que le pipeline de rendu. */
    let originalCanvas = null;
    if (filterIntensity < 100) {
        originalCanvas = document.createElement('canvas');
        originalCanvas.width = PREVIEW_RENDER_WIDTH;
        originalCanvas.height = PREVIEW_RENDER_HEIGHT;
        originalCanvas.getContext('2d')
            .drawImage(sourceImage, sx, sy, sw, sh, 0, 0, PREVIEW_RENDER_WIDTH, PREVIEW_RENDER_HEIGHT);
    }

    const hueRotate = filters.hueRotate || 0;
    ctx.filter = [
        `brightness(${filters.brightness}%)`,
        `contrast(${filters.contrast}%)`,
        'saturate(100%)',
        filters.sepia ? `sepia(${filters.sepia}%)` : '',
        hueRotate ? `hue-rotate(${hueRotate}deg)` : '',
    ].filter(Boolean).join(' ');
    ctx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, PREVIEW_RENDER_WIDTH, PREVIEW_RENDER_HEIGHT);
    ctx.filter = 'none';

    applyFusedPixelOps(ctx, PREVIEW_RENDER_WIDTH, PREVIEW_RENDER_HEIGHT, filters);

    if (filters.tintIntensity > 0) {
        applySafeGlobalTint(ctx, PREVIEW_RENDER_WIDTH, PREVIEW_RENDER_HEIGHT, filters.tintColor, filters.tintIntensity, filters.safeSmartphone !== false);
    }

    if (filters.vignette > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        const gradient = ctx.createRadialGradient(PREVIEW_RENDER_WIDTH / 2, PREVIEW_RENDER_HEIGHT / 2, PREVIEW_RENDER_WIDTH * 0.28, PREVIEW_RENDER_WIDTH / 2, PREVIEW_RENDER_HEIGHT / 2, PREVIEW_RENDER_WIDTH * 0.72);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0, ${filters.vignette / 100})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, PREVIEW_RENDER_WIDTH, PREVIEW_RENDER_HEIGHT);
        ctx.restore();
    }

    applySmartphoneOutputGuards(ctx, PREVIEW_RENDER_WIDTH, PREVIEW_RENDER_HEIGHT, filters);

    if (originalCanvas) {
        applyPerceptualIntensityBlend(ctx, PREVIEW_RENDER_WIDTH, PREVIEW_RENDER_HEIGHT, originalCanvas, filterIntensity);
    }

    return canvas.toDataURL('image/jpeg', 0.9);
}
