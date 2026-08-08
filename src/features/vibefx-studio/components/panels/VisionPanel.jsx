import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, ArrowLeft, Sliders, Palette, Film, Contrast, RotateCcw, ShieldCheck, AlertTriangle, EyeOff, Search, Star, Thermometer, Circle, Droplet, Sparkles, Crosshair, Wind, Sun, Sunrise, Sunset, Undo2, Redo2, Save, Trash2 } from 'lucide-react';
import { CAMERA_BRANDS } from '../../data/constants';
import { DEFAULT_FILTERS } from '../../hooks/useStudioFilters';
import { buildVisionProfileModel, normalizeVisionFilters } from '../../utils/visionColorScience';
/* Logique de recommandation partagee avec l'ecran Vision de VibeOS: elle a ete
   sortie de ce fichier vers utils/visionRecommendation.js, sans modification. */
import {
    PREVIEW_DISPLAY_ASPECT_RATIO,
    getImageRecommendationSignalTags,
    getImageRecommendationSignals,
    renderVisionProfilePreview,
    scoreProfileForImage,
} from '../../utils/visionRecommendation';
import ControlGroup from '../ui/ControlGroup';

const FAVORITES_STORAGE_KEY = 'vibefx.vision.favoriteProfiles';
const CUSTOM_PROFILES_STORAGE_KEY = 'vibefx.vision.customProfiles';
const COMPACT_PREVIEW_HEIGHT = 58;
const HISTORY_LIMIT = 30;
const CUSTOM_PROFILE_NAME_LIMIT = 36;
const TONE_CURVE_BASE = [0, 64, 128, 192, 255];

const snapshotEquals = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const normalizeCustomProfileName = (value, fallback) => {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim().slice(0, CUSTOM_PROFILE_NAME_LIMIT);
    return cleaned || fallback;
};
const isIdentityToneCurve = (curve) => !curve || curve.every((value, index) => value === TONE_CURVE_BASE[index]);

function getActiveProfileContentWarnings(profile, metrics = {}) {
    if (!profile?.vision || !metrics) return [];
    const signals = getImageRecommendationSignals(metrics);
    const family = profile.vision.family;
    const parameters = profile.vision.parameters || {};
    const warnings = [];

    if (signals.saturated && (family === 'Landscape Vivid Safe' || profile.vision.strength === 'strong' || profile.vision.strength === 'experimental')) {
        warnings.push('image deja saturee : surveiller verts/cyans');
    }
    if (signals.portrait && !['Portrait Skin', 'Natural Clean', 'Film Soft'].includes(family)) {
        warnings.push('peau detectee : dosage prudent');
    }
    if (signals.flat && family === 'Editorial Matte') {
        warnings.push('image plate : risque voile gris');
    }
    if (signals.lowLight && ['Landscape Vivid Safe', 'Chrome Street'].includes(family)) {
        warnings.push('basse lumiere : proteger ombres');
    }
    if (signals.neutralHeavy && ((parameters.shadowTintIntensity || 0) > 10 || (parameters.highlightTintIntensity || 0) > 8 || (parameters.tintIntensity || 0) > 6)) {
        warnings.push('neutres nombreux : teintes a controler');
    }

    return warnings.slice(0, 3);
}

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

function buildVisionSafetyActions({
    diagnosticWarnings = [],
    diagnosticDelta = null,
    activeContentWarnings = [],
    isActiveIntensityOutOfRange = false,
    clampedActiveIntensity = 100,
    currentFilters = {},
    activeVisionProfile = null,
}) {
    const text = [...diagnosticWarnings, ...activeContentWarnings].join(' ').toLowerCase();
    const actions = [];
    const addAction = (id, label, detail, patch) => {
        if (actions.some(action => action.id === id)) return;
        actions.push({ id, label, detail, patch });
    };

    if (isActiveIntensityOutOfRange) {
        addAction('dose', 'Dose sure', `${clampedActiveIntensity}%`, {
            filterIntensity: clampedActiveIntensity,
        });
    }

    if (
        /saturation|saturee|ciel|verts|rouges|oranges|cyans/.test(text)
        || (diagnosticDelta?.highSaturationDelta || 0) > 0.08
        || Math.max(
            diagnosticDelta?.skyHighSaturationDelta || 0,
            diagnosticDelta?.foliageHighSaturationDelta || 0,
            diagnosticDelta?.warmHighSaturationDelta || 0,
        ) > 0.12
    ) {
        addAction('chroma', 'Calmer chroma', 'sat zones', {
            saturation: Math.min(currentFilters?.saturation ?? 100, 110),
            vibrance: Math.min(currentFilters?.vibrance ?? 0, 18),
            skySaturation: Math.min(currentFilters?.skySaturation ?? 0, -10),
            foliageSaturation: Math.min(currentFilters?.foliageSaturation ?? 0, -10),
            warmSaturation: Math.min(currentFilters?.warmSaturation ?? 0, -8),
        });
    }

    if (/voile|range|plate/.test(text) || diagnosticDelta?.greyVeilRisk) {
        addAction('veil', 'Retirer voile', 'range utile', {
            fadedBlacks: Math.min(currentFilters?.fadedBlacks ?? 0, 3),
            contrast: Math.max(currentFilters?.contrast ?? 100, 106),
            shadows: Math.min(currentFilters?.shadows ?? 0, 18),
        });
    }

    if (/hautes|clip|blanc/.test(text) || (diagnosticDelta?.channelClipHighDelta || 0) > 0.025) {
        addAction('highlights', 'Sauver HL', 'rolloff', {
            highlights: Math.min(currentFilters?.highlights ?? 0, -14),
            brightness: Math.min(currentFilters?.brightness ?? 100, 104),
            halation: Math.min(currentFilters?.halation ?? 0, 10),
        });
    }

    if (/noirs|ombres|basse lumiere/.test(text) || (diagnosticDelta?.channelClipLowDelta || 0) > 0.05) {
        addAction('shadows', 'Ouvrir ombres', 'detail', {
            shadows: Math.max(currentFilters?.shadows ?? 0, 14),
            dehaze: Math.min(currentFilters?.dehaze ?? 0, 16),
            contrast: Math.min(currentFilters?.contrast ?? 100, 118),
        });
    }

    if (/peau/.test(text) || (diagnosticDelta?.skinHueShiftDeg || 0) > 18 || Math.abs(diagnosticDelta?.skinSaturationDelta || 0) > 0.12) {
        addAction('skin', 'Proteger peau', 'hue/sat', {
            skinSaturation: clampNumber(currentFilters?.skinSaturation ?? 0, -8, 6),
            warmSaturation: Math.min(currentFilters?.warmSaturation ?? 0, 0),
            filterIntensity: Math.min(currentFilters?.filterIntensity ?? 100, activeVisionProfile?.vision?.recommendedIntensity || 85),
        });
    }

    if (/neutres|teintes/.test(text) || (diagnosticDelta?.protectedNeutralBiasDelta || 0) > 18) {
        addAction('neutrals', 'Nettoyer neutres', 'tints', {
            tintIntensity: Math.min(currentFilters?.tintIntensity ?? 0, 4),
            shadowTintIntensity: Math.min(currentFilters?.shadowTintIntensity ?? 0, 8),
            highlightTintIntensity: Math.min(currentFilters?.highlightTintIntensity ?? 0, 6),
        });
    }

    return actions.slice(0, 4);
}

const VisionPanel = ({
    isDarkMode,
    selectedBrand,
    setSelectedBrand,
    images,
    filters,
    setFilters,
    visionCompareSplit = { enabled: false, position: 50, beforeUrl: null },
    setVisionCompareSplit,
    visionDiagnostics = { status: 'idle' },
}) => {
    const [activeProfileName, setActiveProfileName] = useState(null);
    const [isComparingBefore, setIsComparingBefore] = useState(false);
    const [profileSearch, setProfileSearch] = useState('');
    const [familyFilter, setFamilyFilter] = useState('all');
    const [favoriteOnly, setFavoriteOnly] = useState(false);
    const [favoriteProfileIds, setFavoriteProfileIds] = useState([]);
    const [customProfiles, setCustomProfiles] = useState([]);
    const [visionMode, setVisionMode] = useState('simple');
    const [profilePreviews, setProfilePreviews] = useState({});
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [customProfileName, setCustomProfileName] = useState('');
    const compareIntensityRef = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const stored = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
            if (Array.isArray(stored)) setFavoriteProfileIds(stored.filter(item => typeof item === 'string'));
        } catch {
            setFavoriteProfileIds([]);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteProfileIds));
    }, [favoriteProfileIds]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const stored = JSON.parse(window.localStorage.getItem(CUSTOM_PROFILES_STORAGE_KEY) || '[]');
            if (Array.isArray(stored)) {
                setCustomProfiles(stored.filter(profile => profile?.id && profile?.name && profile?.filters));
            }
        } catch {
            setCustomProfiles([]);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(CUSTOM_PROFILES_STORAGE_KEY, JSON.stringify(customProfiles));
    }, [customProfiles]);

    useEffect(() => {
        if (!selectedBrand || !images.length) {
            setProfilePreviews({});
            return;
        }

        let cancelled = false;
        let renderTimer = null;
        const sourceImage = images[0];
        const timer = window.setTimeout(() => {
            const previewProfiles = [
                ...selectedBrand.profiles.map(profile => ({
                    ...profile,
                    profileId: `${selectedBrand.id}:${profile.name}`,
                    vision: buildVisionProfileModel(profile, selectedBrand),
                })),
                ...customProfiles.map(profile => ({
                    ...profile,
                    profileId: profile.id,
                    vision: buildVisionProfileModel(profile),
                })),
            ];
            const nextPreviews = {};
            let index = 0;
            setProfilePreviews({});

            const renderNextPreview = () => {
                if (cancelled || index >= previewProfiles.length) return;
                const profile = previewProfiles[index];
                index += 1;
                const profileId = profile.profileId;
                try {
                    const preview = renderVisionProfilePreview(sourceImage, profile);
                    if (preview) nextPreviews[profileId] = preview;
                } catch {
                    nextPreviews[profileId] = null;
                }
                if (!cancelled) setProfilePreviews({ ...nextPreviews });
                if (index < previewProfiles.length) {
                    renderTimer = window.setTimeout(renderNextPreview, 16);
                }
            };

            renderNextPreview();
        }, 30);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            if (renderTimer) window.clearTimeout(renderTimer);
        };
    }, [customProfiles, images, selectedBrand]);

    const groupedProfiles = useMemo(() => {
        if (!selectedBrand) return {};
        const groups = { Perso: [], Couleur: [], Monochrome: [], Cinema: [] };

        selectedBrand.profiles.forEach(profile => {
            const name = profile.name.toLowerCase();
            const desc = profile.desc.toLowerCase();
            const enrichedProfile = {
                ...profile,
                profileId: `${selectedBrand.id}:${profile.name}`,
                vision: buildVisionProfileModel(profile, selectedBrand),
            };

            if (name.includes('mono') || name.includes('b&w') || name.includes('acros') || name.includes('tri-x') || name.includes('bw')) {
                groups.Monochrome.push(enrichedProfile);
            } else if (name.includes('cin') || name.includes('eterna') || name.includes('800t') || name.includes('50d') || desc.includes('ciné') || name.includes('vistavision') || desc.includes('cinematic')) {
                groups.Cinema.push(enrichedProfile);
            } else {
                groups.Couleur.push(enrichedProfile);
            }
        });

        customProfiles.forEach(profile => {
            groups.Perso.push({
                ...profile,
                profileId: profile.id,
                isCustom: true,
                vision: buildVisionProfileModel(profile),
            });
        });

        return groups;
    }, [customProfiles, selectedBrand]);

    const favoriteSet = useMemo(() => new Set(favoriteProfileIds), [favoriteProfileIds]);
    const familyOptions = useMemo(() => {
        const families = new Set();
        Object.values(groupedProfiles).flat().forEach(profile => families.add(profile.vision.family));
        return ['all', ...Array.from(families).sort()];
    }, [groupedProfiles]);

    const visibleGroupedProfiles = useMemo(() => {
        const query = profileSearch.trim().toLowerCase();
        return Object.entries(groupedProfiles).reduce((acc, [category, profiles]) => {
            acc[category] = profiles.filter(profile => {
                const searchable = `${profile.name} ${profile.desc} ${profile.vision.family} ${profile.vision.intent} ${profile.vision.inspirationLabel} ${profile.vision.previewTags.join(' ')} ${profile.vision.bestFor} ${profile.vision.avoidFor} ${profile.vision.safetyRules.join(' ')} ${profile.vision.technicalNotes.join(' ')}`.toLowerCase();
                const matchesSearch = !query || searchable.includes(query);
                const matchesFamily = familyFilter === 'all' || profile.vision.family === familyFilter;
                const matchesFavorite = !favoriteOnly || favoriteSet.has(profile.profileId);
                return matchesSearch && matchesFamily && matchesFavorite;
            });
            return acc;
        }, {});
    }, [favoriteOnly, favoriteSet, familyFilter, groupedProfiles, profileSearch]);

    const visibleProfileCount = useMemo(() => Object.values(visibleGroupedProfiles).reduce((total, profiles) => total + profiles.length, 0), [visibleGroupedProfiles]);
    const activeVisionProfile = useMemo(() => (
        Object.values(groupedProfiles)
            .flat()
            .find(profile => profile.name === activeProfileName) || null
    ), [activeProfileName, groupedProfiles]);
    const favoriteCompareProfiles = useMemo(() => (
        Object.values(groupedProfiles)
            .flat()
            .filter(profile => favoriteSet.has(profile.profileId))
            .slice(0, 6)
    ), [favoriteSet, groupedProfiles]);
    const imageRecommendedProfiles = useMemo(() => {
        const sourceMetrics = visionDiagnostics?.source;
        if (!sourceMetrics) return [];
        const signals = getImageRecommendationSignals(sourceMetrics);
        return Object.values(groupedProfiles)
            .flat()
            .map(profile => ({
                ...profile,
                imageRecommendation: scoreProfileForImage(profile, signals),
            }))
            .filter(profile => profile.imageRecommendation.score > 12)
            .sort((a, b) => b.imageRecommendation.score - a.imageRecommendation.score)
            .slice(0, 4);
    }, [groupedProfiles, visionDiagnostics]);
    const imageRecommendationSignalTags = useMemo(() => (
        visionDiagnostics?.source
            ? getImageRecommendationSignalTags(getImageRecommendationSignals(visionDiagnostics.source))
            : []
    ), [visionDiagnostics]);
    const currentIntensity = filters?.filterIntensity !== undefined ? filters.filterIntensity : 100;
    const activeIntensityRange = activeVisionProfile?.vision?.intensityRange || null;
    const clampedActiveIntensity = activeIntensityRange
        ? Math.max(activeIntensityRange[0], Math.min(activeIntensityRange[1], currentIntensity))
        : currentIntensity;
    const isActiveIntensityOutOfRange = Boolean(activeIntensityRange && clampedActiveIntensity !== currentIntensity);
    const activeContentWarnings = useMemo(() => (
        activeVisionProfile?.vision && visionDiagnostics
            ? getActiveProfileContentWarnings(activeVisionProfile, visionDiagnostics.source)
            : []
    ), [activeVisionProfile, visionDiagnostics]);
    const activeContentSafeAlternative = useMemo(() => (
        activeContentWarnings.length
            ? imageRecommendedProfiles.find(profile => profile.profileId !== activeVisionProfile?.profileId) || null
            : null
    ), [activeContentWarnings.length, activeVisionProfile?.profileId, imageRecommendedProfiles]);
    const diagnosticMitigationIntensity = activeVisionProfile?.vision
        ? (isActiveIntensityOutOfRange
            ? clampedActiveIntensity
            : Math.min(currentIntensity, activeVisionProfile.vision.recommendedIntensity))
        : currentIntensity;
    const getCurrentSnapshot = () => ({
        filters: { ...(filters || DEFAULT_FILTERS) },
        activeProfileName,
    });

    const commitVisionChange = (nextFilters, nextActiveProfileName = activeProfileName) => {
        const currentSnapshot = getCurrentSnapshot();
        const nextSnapshot = {
            filters: { ...nextFilters },
            activeProfileName: nextActiveProfileName,
        };

        if (snapshotEquals(currentSnapshot, nextSnapshot)) return;

        setUndoStack((current) => {
            const nextStack = current.length && snapshotEquals(current[current.length - 1], currentSnapshot)
                ? current
                : [...current, currentSnapshot];
            return nextStack.slice(-HISTORY_LIMIT);
        });
        setRedoStack([]);
        setFilters(nextSnapshot.filters);
        setActiveProfileName(nextSnapshot.activeProfileName);
    };

    const handleUndo = () => {
        if (!undoStack.length) return;
        const previous = undoStack[undoStack.length - 1];
        setUndoStack(undoStack.slice(0, -1));
        setRedoStack([...redoStack, getCurrentSnapshot()].slice(-HISTORY_LIMIT));
        setFilters(previous.filters);
        setActiveProfileName(previous.activeProfileName);
    };

    const handleRedo = () => {
        if (!redoStack.length) return;
        const next = redoStack[redoStack.length - 1];
        setRedoStack(redoStack.slice(0, -1));
        setUndoStack([...undoStack, getCurrentSnapshot()].slice(-HISTORY_LIMIT));
        setFilters(next.filters);
        setActiveProfileName(next.activeProfileName);
    };

    const handleApplyProfile = (profile, options = {}) => {
        // Spread defaults first so new v3 params reset to neutral when switching profiles
        const activeIntensity = options.filterIntensity ?? (filters?.filterIntensity !== undefined ? filters.filterIntensity : 100);
        const profileParameters = profile?.vision?.parameters || profile?.parameters || profile?.filters || {};
        commitVisionChange(
            normalizeVisionFilters({ ...DEFAULT_FILTERS, ...profileParameters, safeSmartphone: true, filterIntensity: activeIntensity }),
            profile.name,
        );
    };

    const handleIntensityChange = (val) => {
        commitVisionChange({ ...filters, filterIntensity: val });
    };

    const updateVisionFilters = (patch) => {
        commitVisionChange(normalizeVisionFilters({ ...filters, ...patch, safeSmartphone: true }));
    };

    const applyVisionSafetyAction = (action) => {
        if (!action?.patch) return;
        commitVisionChange(normalizeVisionFilters({ ...filters, ...action.patch, safeSmartphone: true }), activeProfileName);
    };

    const updateToneCurvePoint = (index, offset) => {
        const currentCurve = filters?.toneCurveMaster || TONE_CURVE_BASE;
        const nextCurve = TONE_CURVE_BASE.map((base, pointIndex) => (
            pointIndex === index ? base + offset : (currentCurve[pointIndex] ?? base)
        ));
        updateVisionFilters({
            toneCurveMaster: isIdentityToneCurve(nextCurve) ? undefined : nextCurve,
        });
    };

    const resetToneCurve = () => {
        updateVisionFilters({ toneCurveMaster: undefined });
    };

    const handleReset = () => {
        commitVisionChange({ ...DEFAULT_FILTERS }, null);
        setIsComparingBefore(false);
        compareIntensityRef.current = null;
        setVisionCompareSplit?.({ enabled: false, position: 50, beforeUrl: null });
    };

    const handleSaveCustomProfile = () => {
        const nextIndex = customProfiles.length + 1;
        const id = `custom:${Date.now()}`;
        const fallbackName = `Profil perso ${nextIndex}`;
        const profileName = normalizeCustomProfileName(customProfileName, fallbackName);
        const savedProfile = {
            id,
            name: profileName,
            desc: 'Reglage Vision sauvegarde localement',
            family: 'Custom Safe',
            strength: 'normal',
            bestFor: 'retouches personnelles reutilisables sur images similaires',
            avoidFor: 'validation finale sans controle visuel sur nouvelle photo',
            filters: normalizeVisionFilters({ ...DEFAULT_FILTERS, ...filters, safeSmartphone: true }),
        };
        setCustomProfiles(current => [savedProfile, ...current].slice(0, 24));
        setFavoriteProfileIds(current => current.includes(id) ? current : [...current, id]);
        setProfileSearch('');
        setFamilyFilter('all');
        setFavoriteOnly(false);
        setCustomProfileName('');
    };

    const handleDeleteCustomProfile = (event, profile) => {
        event.stopPropagation();
        if (!profile?.isCustom) return;
        setCustomProfiles(current => current.filter(item => item.id !== profile.profileId));
        setFavoriteProfileIds(current => current.filter(item => item !== profile.profileId));
        if (activeProfileName === profile.name) setActiveProfileName(null);
    };

    const toggleSplitCompare = () => {
        if (!images.length || !setVisionCompareSplit) return;
        setVisionCompareSplit(current => ({
            enabled: !current.enabled,
            position: current.position || 50,
            beforeUrl: current.enabled ? null : current.beforeUrl,
        }));
    };

    const handleSplitPositionChange = (event) => {
        const position = Number(event.target.value);
        setVisionCompareSplit?.(current => ({
            ...current,
            enabled: true,
            position: Math.max(15, Math.min(85, position)),
        }));
    };

    const toggleFavorite = (profileId) => {
        setFavoriteProfileIds((current) => {
            if (current.includes(profileId)) return current.filter(item => item !== profileId);
            return [...current, profileId];
        });
    };

    const startCompareBefore = (event) => {
        if (!images.length || compareIntensityRef.current !== null) return;
        compareIntensityRef.current = filters?.filterIntensity !== undefined ? filters.filterIntensity : 100;
        setFilters({ ...filters, filterIntensity: 0 });
        setIsComparingBefore(true);
    };

    const stopCompareBefore = () => {
        if (compareIntensityRef.current === null) return;
        const restoreIntensity = compareIntensityRef.current;
        compareIntensityRef.current = null;
        setFilters((currentFilters) => ({ ...currentFilters, filterIntensity: restoreIntensity }));
        setIsComparingBefore(false);
    };

    const handleCompareKeyDown = (event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        startCompareBefore(event);
    };

    const handleCompareKeyUp = (event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        stopCompareBefore(event);
    };

    const getStrengthClass = (strength) => {
        if (strength === 'experimental') {
            return isDarkMode ? 'border-amber-500/70 bg-amber-500/10 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-700';
        }
        if (strength === 'strong') {
            return isDarkMode ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-200' : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700';
        }
        return isDarkMode ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
    };

    const modeButtonClass = (mode) => `min-h-8 flex-1 rounded-sm border px-3 text-[10px] font-mono uppercase tracking-widest transition ${visionMode === mode ? (isDarkMode ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-cyan-300 bg-cyan-50 text-cyan-700') : (isDarkMode ? 'border-neutral-800 bg-black text-neutral-500 hover:border-neutral-600 hover:text-neutral-300' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700')}`;
    const formatMetricPercent = (value) => `${Math.round(Math.max(0, value || 0) * 1000) / 10}%`;
    const formatMetricSigned = (value, digits = 1) => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(digits)}`;
    const diagnosticWarnings = useMemo(() => visionDiagnostics?.warnings || [], [visionDiagnostics]);
    const diagnosticDelta = visionDiagnostics?.delta;
    const diagnosticRendered = visionDiagnostics?.rendered;
    const diagnosticPerformance = visionDiagnostics?.performance;
    const diagnosticToneRange = diagnosticRendered
        ? Math.max(0, Math.round((diagnosticRendered.lumaP95 || 0) - (diagnosticRendered.lumaP05 || 0)))
        : 0;
    const diagnosticGreyVeilScore = Math.round(Math.max(0, Math.min(1, diagnosticDelta?.greyVeilScore || 0)) * 100);
    const diagnosticHueZoneHighSatDelta = Math.max(
        diagnosticDelta?.skyHighSaturationDelta || 0,
        diagnosticDelta?.foliageHighSaturationDelta || 0,
        diagnosticDelta?.warmHighSaturationDelta || 0,
    );
    const diagnosticImageSize = diagnosticPerformance
        ? `${diagnosticPerformance.megapixels.toFixed(1)}MP`
        : '0.0MP';
    const diagnosticSampleSize = diagnosticPerformance
        ? `${diagnosticPerformance.sampleWidth}x${diagnosticPerformance.sampleHeight}`
        : '0x0';
    const diagnosticPreviewSize = diagnosticPerformance
        ? `${diagnosticPerformance.previewMegapixels.toFixed(1)}MP${diagnosticPerformance.isPreviewCapped ? ' cap' : ''}`
        : '0.0MP';
    const diagnosticSafetyActions = useMemo(() => buildVisionSafetyActions({
        diagnosticWarnings,
        diagnosticDelta,
        activeContentWarnings,
        isActiveIntensityOutOfRange,
        clampedActiveIntensity,
        currentFilters: filters,
        activeVisionProfile,
    }), [
        activeContentWarnings,
        activeVisionProfile,
        clampedActiveIntensity,
        diagnosticDelta,
        diagnosticWarnings,
        filters,
        isActiveIntensityOutOfRange,
    ]);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 relative">
            {!selectedBrand ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <h2 className={`text-[10px] font-mono uppercase tracking-widest mb-3 flex items-center gap-2 ${isDarkMode ? 'text-neutral-500' : 'text-gray-400'}`}><Monitor size={14} className="text-indigo-500" /> Inspirations optiques</h2>
                    <p className={`mb-6 text-[11px] leading-relaxed ${isDarkMode ? 'text-neutral-500' : 'text-gray-500'}`}>
                        Looks inspires photo/cinema, adaptes au JPEG smartphone. Importe une image pour activer les profils.
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                        {CAMERA_BRANDS.map(brand => (
                            <button key={brand.id} onClick={() => setSelectedBrand(brand)} disabled={!images.length} className={`group relative h-16 w-full rounded-sm overflow-hidden border transition-all disabled:opacity-50 ${isDarkMode ? 'border-neutral-800 hover:border-neutral-600 bg-black' : 'border-gray-200 hover:border-gray-400 bg-white'}`}>
                                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${brand.color} opacity-80`} />
                                <div className={`absolute inset-0 bg-gradient-to-r ${brand.color} opacity-0 group-hover:opacity-10 transition duration-300`} />
                                <div className="absolute inset-0 pl-5 pr-4 flex items-center justify-between">
                                    <div className="text-left flex flex-col justify-center">
                                        <span className={`block font-bold text-sm tracking-wide transition duration-300 ${isDarkMode ? 'text-neutral-200 group-hover:text-white' : 'text-gray-800 group-hover:text-black'}`}>{brand.name}</span>
                                        <span className={`text-[10px] uppercase font-mono tracking-widest ${isDarkMode ? 'text-neutral-500' : 'text-gray-500'}`}>{brand.desc}</span>
                                    </div>
                                    <ArrowLeft size={14} className={`rotate-180 transition ${isDarkMode ? 'text-neutral-600 group-hover:text-neutral-300' : 'text-gray-300 group-hover:text-gray-600'}`} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300">
                    <button onClick={() => setSelectedBrand(null)} className={`mb-6 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest transition self-start ${isDarkMode ? 'text-neutral-500 hover:text-white' : 'text-gray-500 hover:text-black'}`}><ArrowLeft size={14} /> Retour</button>

                    <div className={`p-4 mb-6 border-l-2 flex flex-col gap-1 ${isDarkMode ? 'border-indigo-500 bg-gradient-to-r from-neutral-900 to-black' : 'border-indigo-500 bg-gradient-to-r from-gray-50 to-white'}`}>
                        <h2 className={`text-xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedBrand.name}</h2>
                        <p className={`text-[10px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-neutral-500' : 'text-gray-500'}`}>{selectedBrand.desc}</p>

                        <div className="flex flex-wrap gap-2 pt-4 mt-3">
                            <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                <ShieldCheck size={12} /> Safe smartphone
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' : 'border-cyan-200 bg-cyan-50 text-cyan-700'}`}>
                                Dosage linear-light
                            </span>
                        </div>

                        {visionDiagnostics?.status === 'ready' && (
                            <div
                                data-testid="vision-diagnostics"
                                className={`mt-4 rounded-sm border p-3 ${diagnosticWarnings.length ? (isDarkMode ? 'border-amber-500/40 bg-amber-500/10' : 'border-amber-200 bg-amber-50') : (isDarkMode ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50')}`}
                            >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <span className={`inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-neutral-300' : 'text-gray-700'}`}>
                                        {diagnosticWarnings.length ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
                                        Diagnostic image
                                    </span>
                                    <span
                                        data-testid="vision-diagnostics-status"
                                        className={`rounded-sm border px-2 py-1 text-[9px] font-mono uppercase tracking-widest ${diagnosticWarnings.length ? (isDarkMode ? 'border-amber-400/50 text-amber-200' : 'border-amber-300 text-amber-700') : (isDarkMode ? 'border-emerald-400/40 text-emerald-300' : 'border-emerald-300 text-emerald-700')}`}
                                    >
                                        {diagnosticWarnings.length ? 'A verifier' : 'OK safe'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        ['Clip hi', formatMetricPercent(diagnosticRendered?.channelClipHighRatio), formatMetricSigned((diagnosticDelta?.channelClipHighDelta || 0) * 100, 2)],
                                        ['Sat forte', formatMetricPercent(diagnosticRendered?.highSaturationRatio), formatMetricSigned((diagnosticDelta?.highSaturationDelta || 0) * 100, 2)],
                                        ['Zones hue', formatMetricSigned(diagnosticHueZoneHighSatDelta * 100, 2), `chaud ${formatMetricSigned((diagnosticDelta?.warmClipHighDelta || 0) * 100, 2)}`],
                                        ['Noirs', formatMetricPercent(diagnosticRendered?.channelClipLowRatio), formatMetricSigned((diagnosticDelta?.channelClipLowDelta || 0) * 100, 2)],
                                        ['Range', diagnosticToneRange, formatMetricSigned(diagnosticDelta?.tonalRangeDelta || 0, 1)],
                                        ['Voile', `${diagnosticGreyVeilScore}%`, `${Math.round((diagnosticDelta?.tonalRangeRatio || 1) * 100)}% rng`],
                                        ['Peau hue', `${Math.round(diagnosticDelta?.skinHueShiftDeg || 0)}deg`, formatMetricSigned(diagnosticDelta?.skinSaturationDelta || 0, 2)],
                                        ['Neutres', formatMetricSigned(diagnosticDelta?.protectedNeutralBiasDelta || 0, 1), formatMetricSigned(diagnosticDelta?.protectedNeutralChromaDelta || 0, 1)],
                                        ['Perf', `${diagnosticPerformance?.diagnosticMs || 0}ms`, diagnosticImageSize],
                                    ].map(([label, value, delta]) => (
                                        <div key={label} data-testid={label === 'Perf' ? 'vision-diagnostics-performance' : label === 'Voile' ? 'vision-diagnostics-grey-veil' : label === 'Zones hue' ? 'vision-diagnostics-hue-zones' : undefined} className={`rounded-sm border px-2 py-2 ${isDarkMode ? 'border-neutral-800 bg-black/40' : 'border-white bg-white/70'}`}>
                                            <div className={`text-[8px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-neutral-600' : 'text-gray-400'}`}>{label}</div>
                                            <div className={`mt-1 flex items-end justify-between gap-2 font-mono ${isDarkMode ? 'text-neutral-200' : 'text-gray-800'}`}>
                                                <span className="text-xs tabular-nums">{value}</span>
                                                <span className={`text-[9px] tabular-nums ${isDarkMode ? 'text-neutral-500' : 'text-gray-500'}`}>{delta}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {diagnosticPerformance && (
                                    <div data-testid="vision-diagnostics-performance-detail" className={`mt-2 text-[9px] font-mono uppercase tracking-wider ${isDarkMode ? 'text-neutral-600' : 'text-gray-400'}`}>
                                        Render src {diagnosticPerformance.sourceRenderMs}ms - preview {diagnosticPreviewSize} - sample {diagnosticSampleSize} - step {diagnosticPerformance.sampleStep}
                                    </div>
                                )}
                                {activeContentWarnings.length > 0 && (
                                    <div data-testid="vision-active-content-warnings" className={`mt-3 rounded-sm border p-2 ${isDarkMode ? 'border-amber-400/30 bg-amber-500/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                                        <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider">
                                            <AlertTriangle size={11} /> Profil actif vs image
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {activeContentWarnings.map(warning => (
                                                <span key={warning} className={`rounded-sm border px-1.5 py-1 text-[9px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-amber-400/30 bg-black/20' : 'border-amber-200 bg-white/70'}`}>
                                                    {warning}
                                                </span>
                                            ))}
                                        </div>
                                        {activeContentSafeAlternative && (
                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-[9px] font-mono uppercase tracking-wider">
                                                    Alternative sure - {activeContentSafeAlternative.name} {activeContentSafeAlternative.vision.recommendedIntensity}%
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleApplyProfile(activeContentSafeAlternative, { filterIntensity: activeContentSafeAlternative.vision.recommendedIntensity })}
                                                    data-testid="vision-apply-content-safe-alternative"
                                                    className={`min-h-7 rounded-sm border px-2 text-[9px] font-mono uppercase tracking-wider transition ${isDarkMode ? 'border-amber-300/50 text-amber-100 hover:bg-amber-400/10' : 'border-amber-300 bg-white/80 text-amber-800 hover:bg-white'}`}
                                                >
                                                    Essayer
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {diagnosticSafetyActions.length > 0 && (
                                    <div data-testid="vision-diagnostics-safety-actions" className={`mt-3 rounded-sm border p-2 ${isDarkMode ? 'border-cyan-500/25 bg-black/30 text-cyan-100' : 'border-cyan-200 bg-white/75 text-cyan-800'}`}>
                                        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider">
                                            <ShieldCheck size={11} /> Recettes correctives
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {diagnosticSafetyActions.map(action => (
                                                <button
                                                    key={action.id}
                                                    type="button"
                                                    onClick={() => applyVisionSafetyAction(action)}
                                                    data-testid={`vision-apply-safety-action-${action.id}`}
                                                    className={`min-h-10 rounded-sm border px-2 py-1.5 text-left transition active:scale-[0.98] ${isDarkMode ? 'border-cyan-500/25 bg-cyan-500/5 hover:border-cyan-400/50 hover:bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50/60 hover:bg-white'}`}
                                                >
                                                    <span className="block text-[9px] font-mono uppercase tracking-wider">{action.label}</span>
                                                    <span className={`mt-0.5 block text-[8px] font-mono uppercase tracking-wider ${isDarkMode ? 'text-cyan-300/70' : 'text-cyan-700/70'}`}>{action.detail}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {activeVisionProfile?.vision && (diagnosticWarnings.length > 0 || isActiveIntensityOutOfRange) && (
                                    <div data-testid="vision-diagnostics-mitigation" className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-sm border px-2.5 py-2 ${isDarkMode ? 'border-cyan-500/30 bg-black/30 text-cyan-200' : 'border-cyan-200 bg-white/70 text-cyan-700'}`}>
                                        <span className="text-[9px] font-mono uppercase tracking-wider">
                                            Mitigation rapide - intensite {diagnosticMitigationIntensity}%
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleIntensityChange(diagnosticMitigationIntensity)}
                                            data-testid="vision-apply-diagnostics-mitigation"
                                            className={`min-h-7 rounded-sm border px-2 text-[9px] font-mono uppercase tracking-wider transition ${isDarkMode ? 'border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/10' : 'border-cyan-300 text-cyan-700 hover:bg-cyan-50'}`}
                                        >
                                            Corriger
                                        </button>
                                    </div>
                                )}
                                {diagnosticWarnings.length > 0 && (
                                    <div data-testid="vision-diagnostics-warnings" className={`mt-3 flex flex-wrap gap-1.5 ${isDarkMode ? 'text-amber-200' : 'text-amber-700'}`}>
                                        {diagnosticWarnings.map(warning => (
                                            <span key={warning} className={`rounded-sm border px-1.5 py-1 text-[9px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-amber-400/40 bg-black/20' : 'border-amber-200 bg-white/70'}`}>
                                                {warning}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {visionDiagnostics?.status === 'error' && (
                            <div data-testid="vision-diagnostics" className={`mt-4 rounded-sm border p-3 text-[10px] font-mono uppercase tracking-widest ${isDarkMode ? 'border-neutral-800 bg-black/40 text-neutral-600' : 'border-gray-200 bg-white/70 text-gray-400'}`}>
                                Diagnostic image indisponible
                            </div>
                        )}

                        <div className={`pt-4 mt-3 border-t ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
                            <ControlGroup
                                label="Intensité globale"
                                icon={<Sliders size={14} className="text-indigo-400" />}
                                value={currentIntensity}
                                onChange={handleIntensityChange}
                                min={0}
                                max={100}
                                isDarkMode={isDarkMode}
                                testId="vision-intensity"
                            />
                            {activeVisionProfile?.vision && (
                                <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-sm border px-2.5 py-2 ${isDarkMode ? 'border-neutral-800 bg-black/40 text-neutral-500' : 'border-gray-200 bg-white/70 text-gray-500'}`}>
                                    <span data-testid="vision-recommended-intensity" className="text-[9px] font-mono uppercase tracking-wider">
                                        Dose conseillee {activeVisionProfile.vision.recommendedIntensity}% - plage {activeVisionProfile.vision.intensityRange[0]}-{activeVisionProfile.vision.intensityRange[1]}%
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleIntensityChange(activeVisionProfile.vision.recommendedIntensity)}
                                        data-testid="vision-apply-recommended-intensity"
                                        className={`min-h-7 rounded-sm border px-2 text-[9px] font-mono uppercase tracking-wider transition ${isDarkMode ? 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10' : 'border-cyan-200 text-cyan-700 hover:bg-cyan-50'}`}
                                    >
                                        Appliquer
                                    </button>
                                </div>
                            )}
                            {isActiveIntensityOutOfRange && (
                                <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-sm border px-2.5 py-2 ${isDarkMode ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                    <span data-testid="vision-intensity-range-warning" className="text-[9px] font-mono uppercase tracking-wider">
                                        Hors plage conseillee - revenir a {clampedActiveIntensity}%
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleIntensityChange(clampedActiveIntensity)}
                                        data-testid="vision-apply-safe-range-intensity"
                                        className={`min-h-7 rounded-sm border px-2 text-[9px] font-mono uppercase tracking-wider transition ${isDarkMode ? 'border-amber-400/50 text-amber-100 hover:bg-amber-500/10' : 'border-amber-300 text-amber-700 hover:bg-white/70'}`}
                                    >
                                        Ramener
                                    </button>
                                </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onPointerDown={startCompareBefore}
                                    onPointerUp={stopCompareBefore}
                                    onPointerCancel={stopCompareBefore}
                                    onPointerLeave={stopCompareBefore}
                                    onKeyDown={handleCompareKeyDown}
                                    onKeyUp={handleCompareKeyUp}
                                    onBlur={stopCompareBefore}
                                    disabled={!images.length}
                                    aria-pressed={isComparingBefore}
                                    data-testid="vision-before-hold"
                                    className={`inline-flex min-h-9 items-center gap-2 rounded-sm border px-3 text-[10px] font-mono uppercase tracking-widest transition disabled:opacity-50 ${isComparingBefore ? (isDarkMode ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-cyan-300 bg-cyan-50 text-cyan-700') : (isDarkMode ? 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-cyan-500 hover:text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-cyan-400 hover:text-black')}`}
                                >
                                    <EyeOff size={13} /> Avant
                                </button>
                                <button type="button" onClick={handleReset} className={`inline-flex min-h-9 items-center gap-2 rounded-sm border px-3 text-[10px] font-mono uppercase tracking-widest transition ${isDarkMode ? 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-indigo-500 hover:text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-400 hover:text-black'}`}>
                                    <RotateCcw size={13} /> Reset Vision
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUndo}
                                    disabled={!undoStack.length}
                                    data-testid="vision-undo"
                                    className={`inline-flex min-h-9 items-center gap-2 rounded-sm border px-3 text-[10px] font-mono uppercase tracking-widest transition disabled:opacity-40 ${isDarkMode ? 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-cyan-500 hover:text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-cyan-400 hover:text-black'}`}
                                >
                                    <Undo2 size={13} /> Undo
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRedo}
                                    disabled={!redoStack.length}
                                    data-testid="vision-redo"
                                    className={`inline-flex min-h-9 items-center gap-2 rounded-sm border px-3 text-[10px] font-mono uppercase tracking-widest transition disabled:opacity-40 ${isDarkMode ? 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-cyan-500 hover:text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-cyan-400 hover:text-black'}`}
                                >
                                    <Redo2 size={13} /> Redo
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveCustomProfile}
                                    disabled={!images.length}
                                    data-testid="vision-save-profile"
                                    className={`inline-flex min-h-9 items-center gap-2 rounded-sm border px-3 text-[10px] font-mono uppercase tracking-widest transition disabled:opacity-40 ${isDarkMode ? 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-emerald-500 hover:text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-400 hover:text-black'}`}
                                >
                                    <Save size={13} /> Sauver profil
                                </button>
                                <button
                                    type="button"
                                    onClick={toggleSplitCompare}
                                    disabled={!images.length}
                                    aria-pressed={visionCompareSplit.enabled}
                                    data-testid="vision-split-toggle"
                                    className={`inline-flex min-h-9 items-center gap-2 rounded-sm border px-3 text-[10px] font-mono uppercase tracking-widest transition disabled:opacity-50 ${visionCompareSplit.enabled ? (isDarkMode ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-cyan-300 bg-cyan-50 text-cyan-700') : (isDarkMode ? 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-cyan-500 hover:text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-cyan-400 hover:text-black')}`}
                                >
                                    <Sliders size={13} /> Split
                                </button>
                            </div>
                            <label className={`mt-3 flex min-h-10 items-center gap-2 rounded-sm border px-3 ${isDarkMode ? 'border-neutral-800 bg-black/50 text-neutral-300' : 'border-gray-200 bg-white/70 text-gray-700'}`}>
                                <Save size={13} className={isDarkMode ? 'text-neutral-500' : 'text-gray-400'} />
                                <input
                                    type="text"
                                    value={customProfileName}
                                    onChange={(event) => setCustomProfileName(event.target.value.slice(0, CUSTOM_PROFILE_NAME_LIMIT))}
                                    placeholder="Nom du profil personnel"
                                    maxLength={CUSTOM_PROFILE_NAME_LIMIT}
                                    disabled={!images.length}
                                    data-testid="vision-custom-profile-name"
                                    className={`min-w-0 flex-1 bg-transparent text-xs outline-none disabled:opacity-50 placeholder:text-neutral-600 ${isDarkMode ? 'text-neutral-200' : 'text-gray-800'}`}
                                    aria-label="Nom du profil personnel"
                                />
                                <span className={`text-[9px] font-mono tabular-nums ${isDarkMode ? 'text-neutral-600' : 'text-gray-400'}`}>
                                    {customProfileName.length}/{CUSTOM_PROFILE_NAME_LIMIT}
                                </span>
                            </label>
                            {visionCompareSplit.enabled && (
                                <div data-testid="vision-split-controls" className={`mt-3 rounded-sm border p-3 ${isDarkMode ? 'border-neutral-800 bg-black/50' : 'border-gray-200 bg-white/70'}`}>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <span className={`text-[10px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-neutral-500' : 'text-gray-500'}`}>Separateur avant/apres</span>
                                        <span className={`text-[10px] font-mono tabular-nums ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>{visionCompareSplit.position}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={15}
                                        max={85}
                                        value={visionCompareSplit.position}
                                        onChange={handleSplitPositionChange}
                                        data-testid="vision-split-range"
                                        className="w-full accent-cyan-400"
                                        aria-label="Position du separateur avant apres"
                                    />
                                </div>
                            )}
                        </div>

                        <div className={`pt-4 mt-3 border-t ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
                            <div className="mb-4 flex gap-2">
                                <button type="button" data-testid="vision-mode-simple" onClick={() => setVisionMode('simple')} className={modeButtonClass('simple')}>Simple</button>
                                <button type="button" data-testid="vision-mode-expert" onClick={() => setVisionMode('expert')} className={modeButtonClass('expert')}>Expert</button>
                            </div>

                            {visionMode === 'simple' ? (
                                <div data-testid="vision-simple-controls" className="space-y-1">
                                    <ControlGroup
                                        label="Chaleur"
                                        icon={<Thermometer size={14} />}
                                        value={filters?.temperature || 0}
                                        onChange={(v) => updateVisionFilters({ temperature: v })}
                                        min={-22}
                                        max={22}
                                        isDarkMode={isDarkMode}
                                        testId="vision-simple-warmth"
                                    />
                                    <ControlGroup
                                        label="Contraste"
                                        icon={<Contrast size={14} />}
                                        value={filters?.contrast !== undefined ? filters.contrast : 100}
                                        onChange={(v) => updateVisionFilters({ contrast: v })}
                                        min={80}
                                        max={125}
                                        isDarkMode={isDarkMode}
                                        testId="vision-simple-contrast"
                                    />
                                    <ControlGroup
                                        label="Peau"
                                        icon={<Circle size={14} />}
                                        value={filters?.vibrance || 0}
                                        onChange={(v) => updateVisionFilters({ vibrance: v })}
                                        min={-20}
                                        max={28}
                                        isDarkMode={isDarkMode}
                                        testId="vision-simple-skin"
                                    />
                                    <ControlGroup
                                        label="Grain"
                                        icon={<Droplet size={14} />}
                                        value={filters?.grain || 0}
                                        onChange={(v) => updateVisionFilters({ grain: v })}
                                        min={0}
                                        max={42}
                                        isDarkMode={isDarkMode}
                                        testId="vision-simple-grain"
                                    />
                                </div>
                            ) : (
                                <div data-testid="vision-expert-controls" className="space-y-1">
                                    <ControlGroup label="Lumiere" icon={<Sun size={14} />} value={filters?.brightness !== undefined ? filters.brightness : 100} onChange={(v) => updateVisionFilters({ brightness: v })} min={85} max={115} isDarkMode={isDarkMode} testId="vision-expert-brightness" />
                                    <ControlGroup label="Hautes lumieres" icon={<Sunrise size={14} />} value={filters?.highlights || 0} onChange={(v) => updateVisionFilters({ highlights: v })} min={-45} max={35} isDarkMode={isDarkMode} testId="vision-expert-highlights" />
                                    <ControlGroup label="Ombres" icon={<Sunset size={14} />} value={filters?.shadows || 0} onChange={(v) => updateVisionFilters({ shadows: v })} min={-35} max={45} isDarkMode={isDarkMode} testId="vision-expert-shadows" />
                                    <div data-testid="vision-expert-tone-curve" className={`mb-5 border-l-2 pl-3 ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <span className={`flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest ${isDarkMode ? 'text-neutral-400' : 'text-gray-600'}`}>
                                                <Sliders size={14} /> Courbe master
                                            </span>
                                            <button
                                                type="button"
                                                onClick={resetToneCurve}
                                                disabled={!filters?.toneCurveMaster}
                                                data-testid="vision-expert-curve-reset"
                                                className={`min-h-7 rounded-sm border px-2 text-[9px] font-mono uppercase tracking-widest transition disabled:opacity-40 ${isDarkMode ? 'border-neutral-800 bg-black text-neutral-500 hover:border-neutral-600 hover:text-neutral-200' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-800'}`}
                                            >
                                                Reset courbe
                                            </button>
                                        </div>
                                        <div className={`mb-3 grid grid-cols-5 gap-1.5 text-center text-[8px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-neutral-600' : 'text-gray-400'}`}>
                                            {['Noirs', 'Ombres', 'Mids', 'Hautes', 'Blancs'].map((label) => <span key={label}>{label}</span>)}
                                        </div>
                                        <div className="space-y-1">
                                            {[
                                                ['Noirs', 0, 0, 32, 'vision-expert-curve-blacks'],
                                                ['Ombres curve', 1, -24, 24, 'vision-expert-curve-shadows'],
                                                ['Mids curve', 2, -24, 24, 'vision-expert-curve-mids'],
                                                ['Hautes curve', 3, -24, 18, 'vision-expert-curve-highs'],
                                                ['Blancs', 4, -32, 0, 'vision-expert-curve-whites'],
                                            ].map(([label, index, min, max, testId]) => (
                                                <ControlGroup
                                                    key={testId}
                                                    label={label}
                                                    icon={<Contrast size={14} />}
                                                    value={(filters?.toneCurveMaster?.[index] ?? TONE_CURVE_BASE[index]) - TONE_CURVE_BASE[index]}
                                                    onChange={(v) => updateToneCurvePoint(index, v)}
                                                    min={min}
                                                    max={max}
                                                    isDarkMode={isDarkMode}
                                                    testId={testId}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <ControlGroup label="Saturation" icon={<Circle size={14} />} value={filters?.saturation !== undefined ? filters.saturation : 100} onChange={(v) => updateVisionFilters({ saturation: v })} min={45} max={120} isDarkMode={isDarkMode} testId="vision-expert-saturation" />
                                    <ControlGroup label="Vibrance" icon={<Palette size={14} />} value={filters?.vibrance || 0} onChange={(v) => updateVisionFilters({ vibrance: v })} min={-45} max={45} isDarkMode={isDarkMode} testId="vision-expert-vibrance" />
                                    <ControlGroup label="Peau sat" icon={<Circle size={14} />} value={filters?.skinSaturation || 0} onChange={(v) => updateVisionFilters({ skinSaturation: v })} min={-20} max={15} isDarkMode={isDarkMode} testId="vision-expert-skin-saturation" />
                                    <ControlGroup label="Rouge/orange" icon={<Circle size={14} />} value={filters?.warmSaturation || 0} onChange={(v) => updateVisionFilters({ warmSaturation: v })} min={-35} max={18} isDarkMode={isDarkMode} testId="vision-expert-warm-saturation" />
                                    <ControlGroup label="Ciel bleu" icon={<Sunrise size={14} />} value={filters?.skySaturation || 0} onChange={(v) => updateVisionFilters({ skySaturation: v })} min={-35} max={25} isDarkMode={isDarkMode} testId="vision-expert-sky-saturation" />
                                    <ControlGroup label="Verts" icon={<Palette size={14} />} value={filters?.foliageSaturation || 0} onChange={(v) => updateVisionFilters({ foliageSaturation: v })} min={-35} max={22} isDarkMode={isDarkMode} testId="vision-expert-foliage-saturation" />
                                    <ControlGroup label="Clarte" icon={<Sparkles size={14} />} value={filters?.clarity || 0} onChange={(v) => updateVisionFilters({ clarity: v })} min={-25} max={30} isDarkMode={isDarkMode} testId="vision-expert-clarity" />
                                    <ControlGroup label="Nettete" icon={<Crosshair size={14} />} value={filters?.sharpness || 0} onChange={(v) => updateVisionFilters({ sharpness: v })} min={0} max={35} isDarkMode={isDarkMode} testId="vision-expert-sharpness" />
                                    <ControlGroup label="Anti-brume" icon={<Wind size={14} />} value={filters?.dehaze || 0} onChange={(v) => updateVisionFilters({ dehaze: v })} min={0} max={35} isDarkMode={isDarkMode} testId="vision-expert-dehaze" />
                                    <ControlGroup label="Vignette" icon={<Droplet size={14} />} value={filters?.vignette || 0} onChange={(v) => updateVisionFilters({ vignette: v })} min={0} max={30} isDarkMode={isDarkMode} testId="vision-expert-vignette" />
                                    <ControlGroup label="Grain" icon={<Droplet size={14} />} value={filters?.grain || 0} onChange={(v) => updateVisionFilters({ grain: v })} min={0} max={42} isDarkMode={isDarkMode} testId="vision-expert-grain" />
                                    <ControlGroup label="Noirs leves" icon={<Contrast size={14} />} value={filters?.fadedBlacks || 0} onChange={(v) => updateVisionFilters({ fadedBlacks: v })} min={0} max={8} isDarkMode={isDarkMode} testId="vision-expert-faded-blacks" />
                                    <ControlGroup label="Halation" icon={<Sparkles size={14} />} value={filters?.halation || 0} onChange={(v) => updateVisionFilters({ halation: v, halationColor: filters?.halationColor || '#ff4500' })} min={0} max={32} isDarkMode={isDarkMode} testId="vision-expert-halation" />
                                    <ControlGroup label="Teinte ombres" icon={<Sunset size={14} />} value={filters?.shadowTintIntensity || 0} onChange={(v) => updateVisionFilters({ shadowTintIntensity: v, shadowTint: filters?.shadowTint || '#10243a' })} min={0} max={18} isDarkMode={isDarkMode} testId="vision-expert-shadow-tint" />
                                    <ControlGroup label="Teinte hautes" icon={<Sunrise size={14} />} value={filters?.highlightTintIntensity || 0} onChange={(v) => updateVisionFilters({ highlightTintIntensity: v, highlightTint: filters?.highlightTint || '#fff0d0' })} min={0} max={12} isDarkMode={isDarkMode} testId="vision-expert-highlight-tint" />
                                    <div className={`mt-3 grid grid-cols-3 gap-2 rounded-sm border p-3 ${isDarkMode ? 'border-neutral-800 bg-black/40' : 'border-gray-200 bg-white/70'}`}>
                                        {[
                                            ['Ombres', 'shadowTint', filters?.shadowTint || '#10243a', 'vision-expert-shadow-color'],
                                            ['Hautes', 'highlightTint', filters?.highlightTint || '#fff0d0', 'vision-expert-highlight-color'],
                                            ['Halo', 'halationColor', filters?.halationColor || '#ff4500', 'vision-expert-halation-color'],
                                        ].map(([label, key, value, testId]) => (
                                            <label key={key} className={`flex min-h-12 flex-col justify-between gap-2 rounded-sm border p-2 ${isDarkMode ? 'border-neutral-800 text-neutral-500' : 'border-gray-200 text-gray-500'}`}>
                                                <span className="text-[9px] font-mono uppercase tracking-widest">{label}</span>
                                                <input
                                                    type="color"
                                                    value={value}
                                                    onChange={(event) => updateVisionFilters({ [key]: event.target.value })}
                                                    data-testid={testId}
                                                    className="h-6 w-full cursor-pointer border-0 bg-transparent p-0"
                                                    aria-label={`Couleur ${label}`}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`mb-5 space-y-3 border-b pb-4 ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
                        <label className={`flex min-h-10 items-center gap-2 rounded-sm border px-3 ${isDarkMode ? 'border-neutral-800 bg-black text-neutral-300' : 'border-gray-200 bg-white text-gray-700'}`}>
                            <Search size={13} className={isDarkMode ? 'text-neutral-500' : 'text-gray-400'} />
                            <input
                                type="search"
                                value={profileSearch}
                                onChange={(event) => setProfileSearch(event.target.value)}
                                placeholder="Rechercher profil, usage, tag"
                                data-testid="vision-profile-search"
                                className={`min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-600 ${isDarkMode ? 'text-neutral-200' : 'text-gray-800'}`}
                            />
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {familyOptions.map(family => (
                                <button
                                    key={family}
                                    type="button"
                                    onClick={() => setFamilyFilter(family)}
                                    data-testid={`vision-family-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                                    data-active={familyFilter === family}
                                    className={`min-h-8 rounded-sm border px-2.5 text-[9px] font-mono uppercase tracking-wider transition ${familyFilter === family ? (isDarkMode ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-cyan-300 bg-cyan-50 text-cyan-700') : (isDarkMode ? 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300' : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700')}`}
                                >
                                    {family === 'all' ? 'Tous' : family}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setFavoriteOnly(value => !value)}
                                aria-pressed={favoriteOnly}
                                data-testid="vision-favorite-filter"
                                className={`inline-flex min-h-8 items-center gap-1.5 rounded-sm border px-2.5 text-[9px] font-mono uppercase tracking-wider transition ${favoriteOnly ? (isDarkMode ? 'border-yellow-400 bg-yellow-500/10 text-yellow-200' : 'border-yellow-300 bg-yellow-50 text-yellow-700') : (isDarkMode ? 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300' : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700')}`}
                            >
                                <Star size={11} fill={favoriteOnly ? 'currentColor' : 'none'} /> Favoris
                            </button>
                        </div>
                        <div className={`text-[10px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-neutral-600' : 'text-gray-400'}`}>{visibleProfileCount} profils visibles</div>
                        {imageRecommendedProfiles.length > 0 && (
                            <div data-testid="vision-image-recommendations-rail" className={`rounded-sm border p-2 ${isDarkMode ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/60'}`}>
                                <div className={`mb-2 flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-cyan-300/80' : 'text-cyan-700'}`}>
                                    <span className="inline-flex items-center gap-1.5"><Crosshair size={10} /> Recommandes image</span>
                                    <span>{imageRecommendedProfiles.length}</span>
                                </div>
                                {imageRecommendationSignalTags.length > 0 && (
                                    <div data-testid="vision-image-signal-tags" className="mb-2 flex flex-wrap gap-1.5">
                                        {imageRecommendationSignalTags.map(tag => (
                                            <span key={tag} className={`rounded-sm border px-1.5 py-1 text-[8px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-cyan-500/20 text-cyan-200/80' : 'border-cyan-200 bg-white/80 text-cyan-700'}`}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    {imageRecommendedProfiles.map(profile => (
                                        <button
                                            key={`image-recommendation-${profile.profileId}`}
                                            type="button"
                                            onClick={() => handleApplyProfile(profile, { filterIntensity: profile.vision.recommendedIntensity })}
                                            aria-label={`Appliquer recommandation image ${profile.name}`}
                                            data-testid={`vision-image-recommendation-${profile.profileId}`}
                                            data-active={activeProfileName === profile.name}
                                            className={`group min-h-16 rounded-sm border p-2 text-left transition active:scale-[0.98] ${activeProfileName === profile.name ? (isDarkMode ? 'border-cyan-400 bg-cyan-500/10' : 'border-cyan-300 bg-white') : (isDarkMode ? 'border-neutral-800 bg-black/30 hover:border-cyan-500/50 hover:bg-neutral-900/80' : 'border-gray-200 bg-white/70 hover:border-cyan-300')}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className={`truncate text-[10px] font-bold ${isDarkMode ? 'text-neutral-200 group-hover:text-white' : 'text-gray-800'}`}>{profile.name}</div>
                                                    <div className={`mt-1 truncate text-[8px] font-mono uppercase tracking-wider ${isDarkMode ? 'text-neutral-500' : 'text-gray-500'}`}>{profile.vision.family}</div>
                                                </div>
                                                <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-cyan-500/30 text-cyan-200' : 'border-cyan-200 text-cyan-700'}`}>
                                                    {profile.vision.recommendedIntensity}%
                                                </span>
                                            </div>
                                            <div className={`mt-2 text-[9px] font-mono uppercase tracking-wider ${isDarkMode ? 'text-cyan-300/70' : 'text-cyan-700/80'}`}>
                                                {profile.imageRecommendation.reason}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {favoriteCompareProfiles.length > 0 && (
                            <div data-testid="vision-favorite-compare-rail" className={`rounded-sm border p-2 ${isDarkMode ? 'border-neutral-800 bg-black/30' : 'border-gray-200 bg-white/70'}`}>
                                <div className={`mb-2 flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-neutral-500' : 'text-gray-400'}`}>
                                    <span className="inline-flex items-center gap-1.5"><Star size={10} fill="currentColor" /> Comparer favoris</span>
                                    <span>{favoriteCompareProfiles.length}/6</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {favoriteCompareProfiles.map(profile => (
                                        <button
                                            key={`favorite-compare-${profile.profileId}`}
                                            type="button"
                                            onClick={() => handleApplyProfile(profile)}
                                            aria-label={`Comparer favori ${profile.name}`}
                                            data-testid={`vision-favorite-compare-${profile.profileId}`}
                                            data-active={activeProfileName === profile.name}
                                            className={`group flex min-h-20 gap-2 rounded-sm border p-1.5 text-left transition active:scale-[0.98] ${activeProfileName === profile.name ? (isDarkMode ? 'border-cyan-400 bg-cyan-500/10' : 'border-cyan-300 bg-cyan-50') : (isDarkMode ? 'border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900/80' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')}`}
                                        >
                                            <div
                                                className={`w-20 shrink-0 overflow-hidden rounded-sm border ${isDarkMode ? 'border-neutral-800 bg-neutral-950' : 'border-gray-200 bg-gray-50'}`}
                                                style={{ height: COMPACT_PREVIEW_HEIGHT }}
                                            >
                                                {profilePreviews[profile.profileId] ? (
                                                    <img
                                                        src={profilePreviews[profile.profileId]}
                                                        alt=""
                                                        decoding="async"
                                                        draggable={false}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className={`flex h-full items-center px-2 text-[8px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-neutral-700' : 'text-gray-300'}`}>Preview</div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className={`truncate text-[10px] font-bold ${isDarkMode ? 'text-neutral-200 group-hover:text-white' : 'text-gray-800'}`}>{profile.name}</div>
                                                <div className={`mt-1 truncate text-[8px] font-mono uppercase tracking-wider ${isDarkMode ? 'text-neutral-500' : 'text-gray-500'}`}>{profile.vision.family}</div>
                                                <div className={`mt-2 inline-flex rounded-sm border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-gray-200 text-gray-500'}`}>
                                                    {profile.vision.recommendedIntensity}%
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6 pb-6">
                        {['Perso', 'Couleur', 'Monochrome', 'Cinema'].map(category => (
                            visibleGroupedProfiles[category].length > 0 && (
                                <div key={category} className="space-y-3">
                                    <h3 className={`text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 pb-2 border-b ${isDarkMode ? 'text-neutral-500 border-neutral-800' : 'text-gray-400 border-gray-200'}`}>
                                        {category === 'Perso' && <Save size={12} className="text-emerald-400" />}
                                        {category === 'Couleur' && <Palette size={12} className="text-indigo-400" />}
                                        {category === 'Monochrome' && <Contrast size={12} className="text-neutral-400" />}
                                        {category === 'Cinema' && <Film size={12} className="text-amber-400" />}
                                        {category === 'Cinema' ? 'Cinema' : category}
                                    </h3>
                                    <div className="space-y-2">
                                        {visibleGroupedProfiles[category].map((profile, idx) => (
                                            <div key={`${profile.profileId}-${idx}`} data-active={activeProfileName === profile.name} className={`relative border-b border-l-2 transition-all ${activeProfileName === profile.name ? (isDarkMode ? 'border-l-cyan-400 bg-cyan-500/10' : 'border-l-cyan-500 bg-cyan-50') : (isDarkMode ? 'border-l-transparent border-b-neutral-800 hover:border-l-indigo-500 hover:bg-neutral-900/80' : 'border-l-transparent border-b-gray-100 hover:border-l-indigo-500 hover:bg-gray-50')}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleFavorite(profile.profileId)}
                                                    aria-pressed={favoriteSet.has(profile.profileId)}
                                                    aria-label={`${favoriteSet.has(profile.profileId) ? 'Retirer des favoris' : 'Ajouter aux favoris'} ${profile.name}`}
                                                    data-testid={`vision-favorite-${profile.profileId}`}
                                                    className={`absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-sm border transition ${favoriteSet.has(profile.profileId) ? (isDarkMode ? 'border-yellow-400 bg-yellow-500/15 text-yellow-200' : 'border-yellow-300 bg-yellow-50 text-yellow-700') : (isDarkMode ? 'border-neutral-800 bg-black/50 text-neutral-500 hover:border-neutral-600 hover:text-neutral-200' : 'border-gray-200 bg-white/80 text-gray-400 hover:border-gray-400 hover:text-gray-700')}`}
                                                >
                                                    <Star size={13} fill={favoriteSet.has(profile.profileId) ? 'currentColor' : 'none'} />
                                                </button>
                                                {profile.isCustom && (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => handleDeleteCustomProfile(event, profile)}
                                                        aria-label={`Supprimer ${profile.name}`}
                                                        data-testid={`vision-delete-${profile.profileId}`}
                                                        className={`absolute right-12 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-sm border transition ${isDarkMode ? 'border-neutral-800 bg-black/50 text-neutral-500 hover:border-red-500 hover:text-red-300' : 'border-gray-200 bg-white/80 text-gray-400 hover:border-red-300 hover:text-red-600'}`}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => handleApplyProfile(profile)} className="group w-full p-3 pr-12 text-left transition-all active:scale-[0.98]">
                                                    <div
                                                        className={`mb-3 w-full overflow-hidden rounded-sm border ${isDarkMode ? 'border-neutral-800 bg-neutral-950' : 'border-gray-200 bg-gray-50'}`}
                                                        style={{ aspectRatio: PREVIEW_DISPLAY_ASPECT_RATIO }}
                                                    >
                                                        {profilePreviews[profile.profileId] ? (
                                                            <img
                                                                src={profilePreviews[profile.profileId]}
                                                                alt=""
                                                                data-testid={`vision-preview-${profile.profileId}`}
                                                                decoding="async"
                                                                draggable={false}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div data-testid={`vision-preview-pending-${profile.profileId}`} className={`flex h-full w-full items-center px-3 text-[9px] font-mono uppercase tracking-widest ${isDarkMode ? 'text-neutral-700' : 'text-gray-300'}`}>
                                                                Preview
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className={`font-bold text-xs tracking-wide transition ${isDarkMode ? 'text-neutral-300 group-hover:text-white' : 'text-gray-700 group-hover:text-black'}`}>{profile.name}</span>
                                                        <div className="flex items-center gap-1">
                                                            {activeProfileName === profile.name && <span className={`mr-1 rounded-sm border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-cyan-400/50 text-cyan-300' : 'border-cyan-300 text-cyan-700'}`}>Actif</span>}
                                                            {profile.vision.parameters.shadowTint && <div className="w-1.5 h-1.5 rounded-none ring-1 ring-black/50" style={{ backgroundColor: profile.vision.parameters.shadowTint }} />}
                                                            {(!profile.vision.parameters.shadowTint && profile.vision.parameters.highlightTint) && <div className="w-1.5 h-1.5 rounded-none ring-1 ring-black/50" style={{ backgroundColor: profile.vision.parameters.highlightTint }} />}
                                                        </div>
                                                    </div>
                                                    <p className={`text-[10px] font-mono leading-relaxed mt-1 ${isDarkMode ? 'text-neutral-500 group-hover:text-neutral-400' : 'text-gray-500 group-hover:text-gray-600'}`}>{profile.desc}</p>
                                                    <div data-testid={`vision-profile-inspiration-${profile.profileId}`} className={`mt-2 inline-flex rounded-sm border px-1.5 py-1 text-[9px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-cyan-500/20 text-cyan-300/80' : 'border-cyan-200 text-cyan-700'}`}>
                                                        {profile.vision.inspirationLabel}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                        <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-1 text-[9px] font-mono uppercase tracking-wider ${getStrengthClass(profile.vision.strength)}`}>
                                                            {profile.vision.strength === 'experimental' && <AlertTriangle size={10} />}
                                                            {profile.vision.strength}
                                                        </span>
                                                        <span className={`inline-flex rounded-sm border px-1.5 py-1 text-[9px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-gray-200 text-gray-500'}`}>{profile.vision.family}</span>
                                                        {profile.vision.previewTags.slice(0, 2).map(tag => (
                                                            <span key={tag} className={`inline-flex rounded-sm border px-1.5 py-1 text-[9px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-neutral-800 text-neutral-500' : 'border-gray-200 text-gray-500'}`}>{tag}</span>
                                                        ))}
                                                    </div>
                                                    <div className={`mt-3 grid gap-1 border-l pl-2 text-[10px] leading-relaxed ${isDarkMode ? 'border-neutral-800 text-neutral-500' : 'border-gray-200 text-gray-500'}`}>
                                                        <span data-testid={`vision-profile-intent-${profile.profileId}`}><strong className={isDarkMode ? 'text-neutral-400' : 'text-gray-600'}>Intent</strong> {profile.vision.intent}</span>
                                                        <span><strong className={isDarkMode ? 'text-neutral-400' : 'text-gray-600'}>OK</strong> {profile.vision.bestFor}</span>
                                                        <span><strong className={isDarkMode ? 'text-neutral-400' : 'text-gray-600'}>Eviter</strong> {profile.vision.avoidFor}</span>
                                                        <span data-testid={`vision-profile-safety-${profile.profileId}`}><strong className={isDarkMode ? 'text-neutral-400' : 'text-gray-600'}>Garde-fou</strong> {profile.vision.safetyRules.slice(0, 2).join(', ')}</span>
                                                        <span data-testid={`vision-profile-technical-${profile.profileId}`}><strong className={isDarkMode ? 'text-neutral-400' : 'text-gray-600'}>Tech</strong> {profile.vision.technicalNotes.slice(0, 2).join(', ')}</span>
                                                        <span data-testid={`vision-profile-intensity-${profile.profileId}`}><strong className={isDarkMode ? 'text-neutral-400' : 'text-gray-600'}>Dose</strong> {profile.vision.recommendedIntensity}% / {profile.vision.intensityRange[0]}-{profile.vision.intensityRange[1]}%</span>
                                                    </div>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        ))}
                        {visibleProfileCount === 0 && (
                            <div className={`border border-dashed p-4 text-[10px] font-mono uppercase tracking-widest ${isDarkMode ? 'border-neutral-800 text-neutral-600' : 'border-gray-200 text-gray-400'}`}>
                                Aucun profil visible
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisionPanel;
