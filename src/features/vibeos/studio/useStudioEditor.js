"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useCanvasRenderer from '../../vibefx-studio/hooks/useCanvasRenderer';
import useCanvasEvents from '../../vibefx-studio/hooks/useCanvasEvents';
import useExport from '../../vibefx-studio/hooks/useExport';
import { DEFAULT_FILTERS } from '../../vibefx-studio/hooks/useStudioFilters';
import { measureVisionImageData } from '../../vibefx-studio/utils/visionMetrics';
import {
    getImageRecommendationSignals,
    renderVisionProfilePreview,
    scoreProfileForImage,
} from '../../vibefx-studio/utils/visionRecommendation';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';
import { applyVisionStage, canvasToImage, resolveProjectSource } from '../project/pipeline';
import { srcToBlob } from '../layout/layoutPersistence';
import { AMBIANCES, AMBIANCE_BY_ID, JITTERABLE_KEYS } from './ambianceCatalog';
import { deleteCustomStyle, loadCustomStyles, saveCustomStyle } from './customStyles';

/*
 * Orchestration de l'ecran Studio VibeOS (plan §5.4).
 *
 * Comme Layout et Vision, tous les moteurs sont IMPORTES: rendu
 * (`useCanvasRenderer` en vue studio, c'est-a-dire `renderStudio`), evenements
 * pointeur du recadrage (`useCanvasEvents`), export (`useExport`), mesure
 * d'image (`visionMetrics`), signaux et vignettes (`visionRecommendation`).
 * Ce hook ne contient que de l'etat d'ecran, le catalogue d'ambiances et le
 * lien avec le projet commun.
 */

const METRICS_SAMPLE_WIDTH = 320;
const PREVIEW_QUEUE_DELAY_MS = 24;
const HISTORY_LIMIT = 30;
const VARIANT_LIMIT = 6;
const PERSIST_DEBOUNCE_MS = 1200;
/* Le Studio travaille sur la photo, pas sur un format social: format neutre. */
const PHOTO_FORMAT = { id: 'photo' };

export const CROP_RATIOS = [
    { value: 'original', label: 'Photo' },
    { value: '1:1', label: 'Carré' },
    { value: '4:5', label: '4:5' },
    { value: '9:16', label: '9:16' },
    { value: '16:9', label: '16:9' },
];

function measureSourceImage(image) {
    if (!image?.width || !image?.height) return null;
    const width = Math.min(METRICS_SAMPLE_WIDTH, image.width);
    const height = Math.max(1, Math.round((width * image.height) / image.width));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, width, height);
    try {
        return measureVisionImageData(ctx.getImageData(0, 0, width, height), { step: 2 });
    } catch {
        return null;
    }
}

/* Filtres complets d'une ambiance: on repart TOUJOURS des defauts du moteur,
   pour qu'une ambiance n'herite jamais des reglages de la precedente. */
function ambianceFilters(ambiance) {
    return { ...DEFAULT_FILTERS, ...(ambiance?.filters || {}) };
}

/* Tirage pondere par les signaux de la photo (plan §5.4, « Surprends-moi »).
   Le score vient de `scoreProfileForImage`, deja partage avec Vision. */
function pickWeightedAmbiance(list, signals, random = Math.random) {
    if (!list.length) return null;
    const weighted = list.map((ambiance) => ({
        ambiance,
        weight: Math.max(1, (signals ? scoreProfileForImage(ambiance, signals).score : 0) + 40),
    }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let ticket = random() * total;
    for (const entry of weighted) {
        ticket -= entry.weight;
        if (ticket <= 0) return entry.ambiance;
    }
    return weighted[weighted.length - 1].ambiance;
}

/* Jitter +-10% sur 3 parametres au maximum, en restant dans des bornes sensees. */
function jitterFilters(filters, random = Math.random) {
    const candidates = JITTERABLE_KEYS.filter((key) => typeof filters[key] === 'number');
    const picked = [...candidates].sort(() => random() - 0.5).slice(0, 3);
    const next = { ...filters };
    for (const key of picked) {
        const base = next[key];
        const factor = 1 + (random() * 0.2 - 0.1);
        const value = key === 'temperature'
            ? base + (random() * 8 - 4)
            : base * factor;
        next[key] = Math.round(Math.max(key === 'temperature' ? -30 : 0, value));
    }
    return { filters: next, changed: picked };
}

export default function useStudioEditor() {
    const { project, status, updateProject, ensureProject } = useVibeOsProject();

    const [image, setImage] = useState(null);
    /* 'composition' | 'photo' | 'import' - d'ou vient l'image de travail.
       `visionApplied` dit si l'etage Vision du pipeline a deja ete cuit dedans. */
    const [sourceKind, setSourceKind] = useState(null);
    const [visionApplied, setVisionApplied] = useState(false);
    const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
    const [intensity, setIntensity] = useState(80);
    const [activeAmbianceId, setActiveAmbianceId] = useState(null);
    const [creativeMode, setCreativeMode] = useState(false);
    const [message, setMessage] = useState(null);
    const [previews, setPreviews] = useState({});
    const [variants, setVariants] = useState([]);
    const [customStyles, setCustomStyles] = useState([]);
    const [isLoadingImage, setIsLoadingImage] = useState(false);

    /* Fond genere assorti: il appartient a la composition (projet), pas au
       rendu photo du Studio. On le lit et on l'ecrit, on ne le simule pas. */
    const [meshColors, setMeshColors] = useState(null);
    const [lumenName, setLumenName] = useState(null);

    /* Recadrage — memes noms d'etat que l'ancien Studio, memes moteurs. */
    const [cropRatio, setCropRatio] = useState('original');
    const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
    const [cropScale, setCropScale] = useState(1);
    const [isCropping, setIsCropping] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const canvasRef = useRef(null);
    const bgCanvasRef = useRef(null);
    const slotRects = useRef([]);
    const requestRef = useRef(null);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragOffset = useRef({ x: 0, y: 0 });
    const textMetrics = useRef({ w: 0, h: 0 });

    const images = useMemo(() => (image ? [image] : []), [image]);
    const safeSmartphone = !creativeMode;

    const appliedFilters = useMemo(() => ({
        ...filters,
        safeSmartphone,
        filterIntensity: intensity,
    }), [filters, safeSmartphone, intensity]);

    const { getCanvasDimensions, renderPipeline } = useCanvasRenderer({
        canvasRef, images, view: 'studio',
        activeFormat: PHOTO_FORMAT,
        activeTemplate: { id: 'minimal', slots: 1 },
        overlayMode: 'landscape',
        padding: 0, gap: 0, customLayoutGap: 0, radius: 0,
        layoutBgColor: '#000000', layoutBgBlur: false, layoutBgGradient: false,
        layoutBgMeshColors: [], layoutLumenBackground: null, layoutBgTexture: 0,
        layoutSmoothBlur: null, layoutTextures: [], activeTextureId: null, layoutTextureOpacity: 0,
        selectedSlotIndex: null, slotConfigs: {},
        slotRects, bgCanvasRef,
        texts: [], assets: [], activeTextId: null, activeAssetId: null,
        isDraggingText: false, activeGuides: [],
        cropRatio, cropPos, cropScale, isCropping,
        filters: appliedFilters,
        isDragging, requestRef,
        setSlotRectsState: null,
    });

    const canvasEvents = useCanvasEvents({
        canvasRef, view: 'studio', images,
        texts: [], setTexts: () => {}, assets: [], setAssets: () => {},
        activeTextId: null, setActiveTextId: () => {},
        activeAssetId: null, setActiveAssetId: () => {},
        selectedSlotIndex: null, setSelectedSlotIndex: () => {},
        slotRects, setActiveAccordion: () => {},
        isDragging, setIsDragging,
        isDraggingText: false, setIsDraggingText: () => {},
        isDraggingAsset: false, setIsDraggingAsset: () => {},
        activeGuides: [], setActiveGuides: () => {},
        lastMousePos, dragOffset, textMetrics,
        isCropping, setCropPos,
    });

    const exportController = useExport({
        images, canvasRef, getCanvasDimensions, renderPipeline,
        activeFormat: PHOTO_FORMAT,
        canExport: images.length > 0,
    });

    /* ---- Source: le projet commun, sinon un import direct ---- */

    useEffect(() => {
        ensureProject();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* localStorage n'existe pas au rendu serveur: on lit apres le montage, et
       hors du corps de l'effet (pas de rendu en cascade). */
    useEffect(() => {
        const timer = setTimeout(() => setCustomStyles(loadCustomStyles()), 0);
        return () => clearTimeout(timer);
    }, []);

    const hydrationRef = useRef('idle');
    useEffect(() => {
        if (hydrationRef.current !== 'idle') return;
        if (status !== 'ready' || !project) return;
        hydrationRef.current = 'running';
        Promise.resolve().then(async () => {
            setIsLoadingImage(true);
            try {
                /*
                 * Le Studio est le TROISIEME etage du pipeline (plan §4.3):
                 * il travaille sur la composition du Layout, deja passee par
                 * les filtres Vision. On cuit donc l'etage Vision dans l'image
                 * de travail; les effets du Studio s'appliquent par-dessus, et
                 * l'export du Studio est le rendu final.
                 */
                const { image: loaded, kind } = await resolveProjectSource(project);
                if (loaded) {
                    const visionCanvas = applyVisionStage(loaded, project);
                    const chained = visionCanvas ? await canvasToImage(visionCanvas, loaded.name) : null;
                    setImage(chained || loaded);
                    setSourceKind(kind);
                    setVisionApplied(Boolean(chained));
                }
                const stored = project.studio || {};
                if (stored.filters) setFilters(stored.filters);
                if (typeof stored.intensity === 'number') setIntensity(stored.intensity);
                if (stored.presetRef) setActiveAmbianceId(stored.presetRef);
                if (stored.creativeMode === true) setCreativeMode(true);
                if (Array.isArray(stored.variants)) setVariants(stored.variants.slice(0, VARIANT_LIMIT));
                const background = project.background || {};
                if (background.mesh?.enabled && background.mesh.colors?.length) setMeshColors(background.mesh.colors);
                if (background.lumen) setLumenName(background.lumen.name || 'Fond Lumen');
            } finally {
                hydrationRef.current = 'done';
                setIsLoadingImage(false);
            }
        });
    }, [status, project]);

    const handleImageUpload = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsLoadingImage(true);
        const img = new window.Image();
        img.onload = () => {
            img.name = file.name;
            setImage(img);
            setSourceKind('import');
            setVisionApplied(false);
            setCropRatio('original');
            setCropPos({ x: 0, y: 0 });
            setCropScale(1);
            setIsLoadingImage(false);
        };
        img.onerror = () => setIsLoadingImage(false);
        img.src = URL.createObjectURL(file);
        event.target.value = '';
    }, []);

    /* ---- Analyse de la photo ---- */
    const metrics = useMemo(() => (image ? measureSourceImage(image) : null), [image]);
    const signals = useMemo(
        () => (metrics ? getImageRecommendationSignals(metrics) : null),
        [metrics],
    );

    /* Les ambiances gardent l'ordre du catalogue (le Studio est un espace
       creatif: on ne reordonne pas les tuiles sous les doigts). Le score ne
       sert qu'a « Surprends-moi » et au badge « Va bien avec ta photo ». */
    const ambiances = useMemo(() => {
        const all = [...customStyles, ...AMBIANCES];
        if (!signals) return all.map((ambiance) => ({ ...ambiance, score: 0, suits: false }));
        const scored = all.map((ambiance) => ({
            ...ambiance,
            score: scoreProfileForImage(ambiance, signals).score,
        }));
        const best = Math.max(...scored.map((item) => item.score));
        return scored.map((ambiance) => ({ ...ambiance, suits: best > 0 && ambiance.score >= best - 4 }));
    }, [customStyles, signals]);

    /* Vignettes rendues sur la VRAIE photo, une par une (file d'attente: le plan
       §7 signale le cout des tuiles-apercus). Elles suivent le mode creatif,
       pour que la tuile montre exactement ce que fera le clic. */
    useEffect(() => {
        if (!image) return undefined;
        let cancelled = false;
        const queue = [...customStyles, ...AMBIANCES];
        const runNext = () => {
            if (cancelled) return;
            const ambiance = queue.shift();
            if (!ambiance) return;
            const dataUrl = renderVisionProfilePreview(image, { filters: ambianceFilters(ambiance) }, {
                safeSmartphone,
                filterIntensity: ambiance.recommendedIntensity || 80,
            });
            if (cancelled) return;
            if (dataUrl) setPreviews((current) => ({ ...current, [ambiance.id]: dataUrl }));
            setTimeout(runNext, PREVIEW_QUEUE_DELAY_MS);
        };
        const timer = setTimeout(() => {
            setPreviews({});
            runNext();
        }, PREVIEW_QUEUE_DELAY_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [image, safeSmartphone, customStyles]);

    /* ---- Historique (30 etats, meme forme que Layout et Vision) ---- */
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isRestoringRef = useRef(false);

    const pushHistory = useCallback((nextFilters, nextIntensity, nextId) => {
        if (isRestoringRef.current) return;
        setHistory((previous) => {
            const trimmed = previous.slice(0, historyIndex + 1);
            trimmed.push({ filters: nextFilters, intensity: nextIntensity, ambianceId: nextId });
            if (trimmed.length > HISTORY_LIMIT) trimmed.shift();
            setHistoryIndex(Math.min(HISTORY_LIMIT - 1, trimmed.length - 1));
            return trimmed;
        });
    }, [historyIndex]);

    /* Historique VISUEL, complementaire de l'undo (plan §5.4, point 4): les 6
       derniers etats reellement appliques, avec leur vignette. */
    const pushVariant = useCallback((label, nextFilters, nextIntensity, nextId) => {
        const thumb = image
            ? renderVisionProfilePreview(image, { filters: nextFilters }, { safeSmartphone, filterIntensity: nextIntensity })
            : null;
        setVariants((current) => [
            { id: `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, label, filters: nextFilters, intensity: nextIntensity, ambianceId: nextId, thumb },
            ...current,
        ].slice(0, VARIANT_LIMIT));
    }, [image, safeSmartphone]);

    const commit = useCallback((nextFilters, nextIntensity, nextId, nextMessage, variantLabel) => {
        setFilters(nextFilters);
        setIntensity(nextIntensity);
        setActiveAmbianceId(nextId);
        if (nextMessage !== undefined) setMessage(nextMessage);
        pushHistory(nextFilters, nextIntensity, nextId);
        if (variantLabel) pushVariant(variantLabel, nextFilters, nextIntensity, nextId);
    }, [pushHistory, pushVariant]);

    const restore = useCallback((entry) => {
        if (!entry) return;
        isRestoringRef.current = true;
        setFilters(entry.filters);
        setIntensity(entry.intensity);
        setActiveAmbianceId(entry.ambianceId);
        setTimeout(() => { isRestoringRef.current = false; }, 50);
    }, []);

    const undo = useCallback(() => {
        if (historyIndex <= 0) return;
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        restore(history[nextIndex]);
    }, [history, historyIndex, restore]);

    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        restore(history[nextIndex]);
    }, [history, historyIndex, restore]);

    /* ---- Actions ---- */

    const applyAmbiance = useCallback((ambiance) => {
        if (!ambiance) return;
        const nextFilters = ambianceFilters(ambiance);
        const nextIntensity = ambiance.recommendedIntensity || 80;
        commit(nextFilters, nextIntensity, ambiance.id, `Ambiance « ${ambiance.label} » — ${ambiance.hint}.`, ambiance.label);
    }, [commit]);

    const surpriseMe = useCallback(() => {
        const pool = [...customStyles, ...AMBIANCES];
        const picked = pickWeightedAmbiance(pool, signals);
        if (!picked) return;
        const { filters: jittered, changed } = jitterFilters(ambianceFilters(picked));
        const nextIntensity = picked.recommendedIntensity || 80;
        commit(
            jittered,
            nextIntensity,
            picked.id,
            `Tirage : « ${picked.label} », légèrement décalé (${changed.length} réglage${changed.length > 1 ? 's' : ''}).`,
            `${picked.label} ✦`,
        );
    }, [commit, customStyles, signals]);

    const applyVariant = useCallback((variant) => {
        if (!variant) return;
        commit(variant.filters, variant.intensity, variant.ambianceId, `Variante « ${variant.label} » réappliquée.`);
    }, [commit]);

    const updateFilter = useCallback((key, value) => {
        setFilters((current) => {
            const next = { ...current, [key]: value };
            pushHistory(next, intensity, activeAmbianceId);
            return next;
        });
    }, [pushHistory, intensity, activeAmbianceId]);

    const resetFilters = useCallback(() => {
        commit({ ...DEFAULT_FILTERS }, 80, null, null);
    }, [commit]);

    const saveStyle = useCallback((label) => {
        const ambiance = activeAmbianceId ? AMBIANCE_BY_ID.get(activeAmbianceId) : null;
        const next = saveCustomStyle({
            label,
            filters,
            intensity,
            family: ambiance?.family || 'Natural Clean',
        });
        setCustomStyles(next);
        return next[0] || null;
    }, [activeAmbianceId, filters, intensity]);

    const removeStyle = useCallback((id) => {
        setCustomStyles(deleteCustomStyle(id));
    }, []);

    /* ---- Fond genere assorti (il vit dans la composition, pas dans la photo) ---- */

    const applyMeshBackground = useCallback((colors) => {
        if (!colors?.length) return;
        setMeshColors(colors);
        setLumenName(null);
        updateProject({
            background: {
                ...(project?.background || {}),
                mesh: { enabled: true, colors: [...colors] },
                lumen: null,
                blur: false,
                color: colors[0],
            },
        });
    }, [project, updateProject]);

    const clearGeneratedBackground = useCallback(() => {
        setMeshColors(null);
        setLumenName(null);
        updateProject({
            background: { ...(project?.background || {}), mesh: null, lumen: null },
        });
    }, [project, updateProject]);

    const lumenCacheRef = useRef(new Map());
    const applyLumenBackground = useCallback(async (payload) => {
        if (!payload?.dataUrl) return;
        const blob = await srcToBlob(payload.dataUrl, lumenCacheRef.current);
        if (!blob) return;
        const name = payload.styleName || payload.mode || 'Fond Lumen';
        setLumenName(name);
        setMeshColors(null);
        updateProject({
            background: {
                ...(project?.background || {}),
                mesh: null,
                blur: false,
                lumen: {
                    id: `lumen-${Date.now()}`,
                    name,
                    mode: payload.mode || null,
                    styleName: payload.styleName || null,
                    seed: payload.seed ?? null,
                    designCode: payload.designCode ?? null,
                    blob,
                },
            },
        });
    }, [project, updateProject]);

    /* ---- Sauvegarde dans le projet commun ---- */
    const persistTimer = useRef(null);
    const blobCacheRef = useRef(new Map());
    useEffect(() => {
        if (!project || hydrationRef.current !== 'done' || !image) return undefined;
        if (persistTimer.current) clearTimeout(persistTimer.current);
        persistTimer.current = setTimeout(async () => {
            persistTimer.current = null;
            try {
                const patch = {
                    studio: {
                        presetRef: activeAmbianceId,
                        filters,
                        intensity,
                        creativeMode,
                        /* Les vignettes ne sont PAS enregistrees: ce sont des
                           dataURL, et elles se re-rendent en 20ms sur la photo
                           au retour sur la page (plan §7). */
                        variants: variants.map(({ thumb, ...rest }) => rest),
                    },
                };
                /* Comme pour Vision: seule une photo importee ici rejoint le
                   projet. La composition reste la propriete du Layout. */
                if (sourceKind === 'import' && !(project.images || []).length) {
                    const blob = await srcToBlob(image.src, blobCacheRef.current);
                    if (blob) {
                        patch.images = [{ id: `studio-${Date.now()}`, name: image.name || '', slotId: null, blob }];
                    }
                }
                updateProject(patch);
            } catch {
                /* Sauvegarde non bloquante. */
            }
        }, PERSIST_DEBOUNCE_MS);
        return () => {
            if (persistTimer.current) clearTimeout(persistTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, intensity, activeAmbianceId, creativeMode, variants, image]);

    /* Vignettes des variantes relues depuis le projet: on les re-rend une fois
       la photo disponible. */
    useEffect(() => {
        if (!image) return undefined;
        const timer = setTimeout(() => {
            setVariants((current) => {
                if (!current.some((variant) => !variant.thumb)) return current;
                return current.map((variant) => (variant.thumb ? variant : {
                    ...variant,
                    thumb: renderVisionProfilePreview(image, { filters: variant.filters }, {
                        safeSmartphone,
                        filterIntensity: variant.intensity,
                    }),
                }));
            });
        }, PREVIEW_QUEUE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [image, safeSmartphone]);

    return {
        image, images, metrics, signals, sourceKind, visionApplied,
        filters, appliedFilters, setFilter: updateFilter, setFilters,
        intensity, setIntensity,
        ambiances, previews, activeAmbianceId, message,
        variants, applyVariant,
        customStyles, saveStyle, removeStyle,
        creativeMode, setCreativeMode,
        meshColors, lumenName, applyMeshBackground, applyLumenBackground, clearGeneratedBackground,
        cropRatio, setCropRatio, cropScale, setCropScale, cropPos, setCropPos,
        isCropping, setIsCropping,
        canvasRef, canvasEvents,
        isLoadingImage,
        handleImageUpload,
        applyAmbiance, surpriseMe, resetFilters,
        undo, redo,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        exportController,
    };
}
