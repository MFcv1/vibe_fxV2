import { useState } from 'react';

export const DEFAULT_FILTERS = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sepia: 0,
    blur: 0,
    grain: 0,
    /* La grosseur des grains, a l'echelle de Lightroom (son sous-reglage
       « Taille »). 25 est SA valeur par defaut, et celle sur laquelle notre
       grain a ete calibre: voir `grainField.js`. */
    grainSize: 25,
    grainRoughness: 50,
    noiseReductionLuminance: 0,
    noiseReductionColor: 0,
    vignette: 0,
    vignetteMidpoint: 50,
    vignetteRoundness: 0,
    vignetteFeather: 50,
    vignetteHighlights: 0,
    /* Active les profils radiaux mesures a -10/-17/-25/-30 pour les imports
       Lightroom. Faux par defaut pour ne pas modifier les looks historiques
       deja valides visuellement. */
    vignetteLightroomV2: false,
    /* Lightroom accepte aussi un montant positif, qui eclaircit les bords.
       Le curseur historique VibeFX reste un assombrissement par defaut. */
    vignetteLighten: false,
    presetSpatialBeforeLut: false,
    presetClarityScale: 1,
    presetTextureEdgeAware: false,
    presetAutoTone: false,
    lightroomExposure: 0,
    lightroomContrast: 0,
    lightroomHighlights: 0,
    lightroomShadows: 0,
    lightroomWhites: 0,
    lightroomBlacks: 0,
    /* Le degrade du bas (2026-08-29). Au repos c'est 0: il n'existe que si un
       preset le pose ou si l'utilisateur le monte. Sans cette entree,
       `withoutPresetSpatials` remettait la cle a `undefined` au lieu de 0 —
       le moteur le normalisait quand meme, mais le panneau ne savait pas quoi
       afficher. */
    degradeBas: 0,
    tintColor: '#ffffff',
    tintIntensity: 0,
    filterIntensity: 100,
    // Vision Pro v3
    highlights: 0,
    shadows: 0,
    vibrance: 0,
    skinSaturation: 0,
    warmSaturation: 0,
    skySaturation: 0,
    foliageSaturation: 0,
    temperature: 0,
    texture: 0,
    clarity: 0,
    sharpness: 0,
    dehaze: 0,
    safeSmartphone: true,
    profileStrength: 'safe',
};

export const useStudioFilters = () => {
    const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });

    const resetFilters = () => {
        setFilters({ ...DEFAULT_FILTERS });
    };

    return { filters, setFilters, resetFilters };
};
