"use client";

/*
 * Styles perso du Studio (plan §5.4, « enregistrer comme style perso »).
 *
 * Stockage local volontairement simple: un tableau JSON dans localStorage, sous
 * `vibeos.studio.customStyles`. Pas de vignette embarquee — elle serait une
 * dataURL de plusieurs centaines de kilo-octets par style, et localStorage est
 * plafonne a ~5 Mo (plan §7). L'apercu est re-rendu sur la photo courante,
 * comme pour les ambiances.
 */

export const CUSTOM_STYLES_KEY = 'vibeos.studio.customStyles';
const MAX_CUSTOM_STYLES = 24;

function readRaw() {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_STYLES_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/* Meme forme que les ambiances, pour que l'ecran ne distingue que le badge. */
function hydrate(entry) {
    if (!entry || typeof entry !== 'object' || !entry.id) return null;
    return {
        id: entry.id,
        label: entry.label || 'Style perso',
        hint: entry.hint || 'Style enregistré',
        source: 'Style perso',
        family: entry.family || 'Natural Clean',
        strength: 'safe',
        recommendedIntensity: typeof entry.recommendedIntensity === 'number' ? entry.recommendedIntensity : 80,
        filters: entry.filters && typeof entry.filters === 'object' ? entry.filters : {},
        background: entry.background || null,
        custom: true,
        vision: { family: entry.family || 'Natural Clean', strength: 'safe', previewTags: ['style perso'] },
    };
}

export function loadCustomStyles() {
    return readRaw().map(hydrate).filter(Boolean);
}

function persist(styles) {
    if (typeof window === 'undefined') return styles;
    try {
        window.localStorage.setItem(CUSTOM_STYLES_KEY, JSON.stringify(styles));
    } catch {
        /* Quota plein ou stockage refuse: le style reste en memoire pour la
           session, on ne casse pas l'ecran pour autant. */
    }
    return styles;
}

export function saveCustomStyle({ label, filters, intensity, family }) {
    const entry = {
        id: `custom-${Date.now().toString(36)}`,
        label: (label || '').trim() || 'Style perso',
        hint: 'Style enregistré',
        family: family || 'Natural Clean',
        recommendedIntensity: intensity,
        filters,
    };
    const next = [entry, ...readRaw().filter((item) => item?.id !== entry.id)].slice(0, MAX_CUSTOM_STYLES);
    persist(next);
    return loadCustomStyles();
}

export function deleteCustomStyle(id) {
    persist(readRaw().filter((item) => item?.id !== id));
    return loadCustomStyles();
}
