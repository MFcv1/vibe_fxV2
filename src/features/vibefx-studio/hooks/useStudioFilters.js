import { useState } from 'react';

export const DEFAULT_FILTERS = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sepia: 0,
    blur: 0,
    grain: 0,
    vignette: 0,
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
