"use client";

/*
 * « Améliorer ma photo » : la correction automatique de l'ecran Vision.
 *
 * Elle ne reinvente aucune science: elle LIT les mesures de
 * `visionMetrics.measureVisionImageData` (luminosite moyenne, plage tonale,
 * peau, ciel, feuillage, saturation) et les signaux deja calcules par
 * `getImageRecommendationSignals`, puis compose des reglages qui repassent tous
 * par `normalizeVisionFilters` en mode `safeSmartphone` — c'est lui qui borne
 * chaque valeur dans la zone sure. Impossible, par construction, de sortir une
 * image cassee.
 */

import { DEFAULT_FILTERS } from '../../vibefx-studio/hooks/useStudioFilters';
import { normalizeVisionFilters } from '../../vibefx-studio/utils/visionColorScience';
import { getImageRecommendationSignals } from '../../vibefx-studio/utils/visionRecommendation';

const joinFr = (parts) => {
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
};

export function buildAutoEnhancement(metrics) {
    const signals = getImageRecommendationSignals(metrics || {});
    const observations = [];
    const actions = [];
    const filters = { ...DEFAULT_FILTERS, safeSmartphone: true, profileStrength: 'safe' };

    const meanLuma = metrics?.meanLuma ?? 128;

    /* 1. Exposition */
    if (signals.lowLight || meanLuma < 86) {
        filters.brightness = 109;
        filters.shadows = 26;
        filters.dehaze = 10;
        observations.push('un peu sombre');
        actions.push('relevé la lumière');
    } else if (meanLuma > 172) {
        filters.brightness = 96;
        filters.highlights = -18;
        observations.push('un peu trop claire');
        actions.push('récupéré les hautes lumières');
    }

    /* 2. Relief (image plate) */
    if (signals.flat) {
        filters.contrast = Math.max(filters.contrast, 110);
        filters.clarity = 16;
        filters.dehaze = Math.max(filters.dehaze, 12);
        observations.push('plate');
        actions.push('remis du relief');
    }

    /* 3. Zones sacrifiees */
    if ((metrics?.clippedHighlightRatio || 0) > 0.02) {
        filters.highlights = Math.min(filters.highlights, -14);
        actions.push('sauvé les blancs');
    }
    if ((metrics?.crushedBlackRatio || 0) > 0.06) {
        filters.shadows = Math.max(filters.shadows, 18);
        actions.push('rouvert les noirs');
    }

    /* 4. Couleur */
    if (signals.saturated) {
        filters.vibrance = -4;
        filters.skySaturation = -10;
        filters.foliageSaturation = -10;
        observations.push('déjà très colorée');
        actions.push('calmé les couleurs les plus criardes');
    } else if ((metrics?.averageSaturation ?? 0.3) < 0.24) {
        filters.vibrance = 20;
        observations.push('un peu fade');
        actions.push('ravivé les couleurs');
    } else {
        filters.vibrance = 10;
    }

    /* 5. Peau: protection prioritaire (plan §5.3) */
    if (signals.portrait) {
        filters.vibrance = Math.min(filters.vibrance, 12);
        filters.skinSaturation = 0;
        filters.warmSaturation = Math.min(filters.warmSaturation || 0, 0);
        observations.push('avec des visages');
        actions.push('protégé les teints');
    }

    /* 6. Nettete legere, toujours */
    filters.sharpness = 12;

    const observationText = observations.length ? `Photo ${joinFr(observations)}` : 'Photo déjà équilibrée';
    const actionText = actions.length ? joinFr(actions) : 'juste affiné la netteté';
    const message = `${observationText} — j’ai ${actionText}.`;

    return {
        filters: normalizeVisionFilters(filters),
        message,
        signals,
    };
}

/*
 * Garde-fou applique a un LOOK, en fonction de la photo.
 *
 * `normalizeVisionFilters` borne les reglages dans l'absolu, mais il ne
 * regarde pas l'image: un look contraste + vignette applique a une photo de
 * nuit deja sombre pouvait la fermer completement (mesure a 4/255 pendant les
 * tests du 2026-08-08). Ici on croise le look ET les signaux de la photo pour
 * garder une image lisible — c'est la promesse « impossible de rater ».
 */
export function guardLookForImage(lookFilters, signals = {}, metrics = {}) {
    const filters = { ...lookFilters };
    const meanLuma = metrics?.meanLuma ?? 128;

    if (signals.lowLight || meanLuma < 90) {
        filters.vignette = Math.min(filters.vignette ?? 0, 12);
        filters.shadows = Math.max(filters.shadows ?? 0, 16);
        filters.brightness = Math.max(filters.brightness ?? 100, 104);
        filters.contrast = Math.min(filters.contrast ?? 100, 120);
        filters.fadedBlacks = Math.max(filters.fadedBlacks ?? 0, 2);
    }

    if ((metrics?.clippedHighlightRatio || 0) > 0.04) {
        filters.brightness = Math.min(filters.brightness ?? 100, 104);
        filters.highlights = Math.min(filters.highlights ?? 0, -10);
    }

    if (signals.saturated) {
        filters.vibrance = Math.min(filters.vibrance ?? 0, 10);
        filters.skySaturation = Math.min(filters.skySaturation ?? 0, -6);
        filters.foliageSaturation = Math.min(filters.foliageSaturation ?? 0, -6);
    }

    if (signals.portrait) {
        filters.skinSaturation = Math.max(-6, Math.min(6, filters.skinSaturation ?? 0));
    }

    return normalizeVisionFilters(filters);
}

/* Etiquettes courtes de ce que l'analyse a vu, pour l'afficher sous la photo. */
export function describeSignals(signals = {}) {
    const tags = [];
    if (signals.portrait) tags.push('peau détectée');
    if (signals.landscape) tags.push('ciel / verdure');
    if (signals.lowLight) tags.push('basse lumière');
    if (signals.saturated) tags.push('déjà saturée');
    if (signals.flat) tags.push('image plate');
    if (signals.warm) tags.push('tons chauds');
    if (signals.neutralHeavy) tags.push('beaucoup de neutres');
    return tags;
}
