"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useCanvasRenderer from '../../vibefx-studio/hooks/useCanvasRenderer';
import useExport from '../../vibefx-studio/hooks/useExport';
import { DEFAULT_FILTERS } from '../../vibefx-studio/hooks/useStudioFilters';
import { normalizeVisionFilters } from '../../vibefx-studio/utils/visionColorScience';
import { measureVisionImageData } from '../../vibefx-studio/utils/visionMetrics';
import {
    getImageRecommendationSignals,
    renderVisionProfilePreview,
    scoreProfileForImage,
} from '../../vibefx-studio/utils/visionRecommendation';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';
import { srcToBlob } from '../layout/layoutPersistence';
import { VISION_LOOKS } from './visionLooks';
import { buildAutoEnhancement, guardLookForImage } from './autoEnhance';

/*
 * Orchestration de l'ecran Vision VibeOS.
 *
 * Comme pour Layout, tous les moteurs sont IMPORTES: rendu (`useCanvasRenderer`
 * en vue photo), export (`useExport`), mesure d'image (`visionMetrics`),
 * garde-fous et bornes (`normalizeVisionFilters`), tri des looks
 * (`scoreProfileForImage`) et vignettes (`renderVisionProfilePreview`).
 * Ce hook ne contient que de l'etat d'ecran et le lien avec le projet commun.
 */

const METRICS_SAMPLE_WIDTH = 320;
const PREVIEW_QUEUE_DELAY_MS = 24;
const HISTORY_LIMIT = 30;
const PERSIST_DEBOUNCE_MS = 1200;
/* Vision travaille sur la photo elle-meme, pas sur un format social: on passe
   un format neutre aux moteurs (ils ne s'en servent que pour le decoupage
   panorama, sans objet ici). */
const PHOTO_FORMAT = { id: 'photo' };

/* Mesure de la photo source, sur une version reduite: la science ne change pas,
   le cout oui (plan §7, perf des apercus). */
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

function loadImageFromBlob(blob, name) {
    return new Promise((resolve) => {
        if (!blob) {
            resolve(null);
            return;
        }
        const img = new window.Image();
        img.onload = () => {
            img.name = name || '';
            resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(blob);
    });
}

export default function useVisionEditor() {
    const { project, status, updateProject, ensureProject } = useVibeOsProject();

    const [image, setImage] = useState(null);
    const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
    const [intensity, setIntensity] = useState(80);
    const [activeLookId, setActiveLookId] = useState(null);
    const [autoMessage, setAutoMessage] = useState(null);
    const [previews, setPreviews] = useState({});
    const [isLoadingImage, setIsLoadingImage] = useState(false);

    const canvasRef = useRef(null);
    const bgCanvasRef = useRef(null);
    const slotRects = useRef([]);
    const requestRef = useRef(null);

    const images = useMemo(() => (image ? [image] : []), [image]);

    /* Filtres reellement envoyes au moteur: l'intensite pilote le melange
       lineaire deja implemente par le pipeline (`filterIntensity`). */
    const appliedFilters = useMemo(() => ({
        ...filters,
        safeSmartphone: filters.safeSmartphone !== false,
        filterIntensity: intensity,
    }), [filters, intensity]);

    const { getCanvasDimensions, renderPipeline } = useCanvasRenderer({
        canvasRef, images, view: 'vision-pro',
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
        cropRatio: 'original', cropPos: { x: 0, y: 0 }, cropScale: 1, isCropping: false,
        filters: appliedFilters,
        isDragging: false, requestRef,
        setSlotRectsState: null,
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

    const hydrationRef = useRef('idle');
    useEffect(() => {
        if (hydrationRef.current !== 'idle') return;
        if (status !== 'ready' || !project) return;
        hydrationRef.current = 'running';
        Promise.resolve().then(async () => {
            setIsLoadingImage(true);
            try {
                const record = (project.images || [])[0];
                const loaded = record?.blob ? await loadImageFromBlob(record.blob, record.name) : null;
                if (loaded) setImage(loaded);
                const storedVision = project.vision || {};
                if (storedVision.filters) setFilters(storedVision.filters);
                if (typeof storedVision.intensity === 'number') setIntensity(storedVision.intensity);
                if (storedVision.profileId) setActiveLookId(storedVision.profileId);
            } finally {
                hydrationRef.current = 'done';
                setIsLoadingImage(false);
            }
        });
    }, [status, project]);

    /* Import direct depuis l'ecran Vision. */
    const handleImageUpload = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsLoadingImage(true);
        const img = new window.Image();
        img.onload = () => {
            img.name = file.name;
            setImage(img);
            setIsLoadingImage(false);
        };
        img.onerror = () => setIsLoadingImage(false);
        img.src = URL.createObjectURL(file);
        event.target.value = '';
    }, []);

    /* ---- Analyse de la photo (une mesure par photo) ---- */
    const metrics = useMemo(() => (image ? measureSourceImage(image) : null), [image]);

    const signals = useMemo(
        () => (metrics ? getImageRecommendationSignals(metrics) : null),
        [metrics],
    );

    /* ---- Les 12 looks, tries pour CETTE photo ---- */
    const looks = useMemo(() => {
        if (!signals) {
            return VISION_LOOKS.map((look) => ({ ...look, score: 0, reason: look.hint, discouraged: false }));
        }
        return VISION_LOOKS
            .map((look) => {
                const { score, reason } = scoreProfileForImage(look, signals);
                return { ...look, score, reason, discouraged: score < 0 };
            })
            .sort((a, b) => {
                if (a.discouraged !== b.discouraged) return a.discouraged ? 1 : -1;
                return b.score - a.score;
            });
    }, [signals]);

    /* Vignettes rendues sur la VRAIE photo, une par une pour ne pas bloquer
       l'interface (file d'attente, comme l'ancien panneau). */
    useEffect(() => {
        if (!image) return undefined;
        let cancelled = false;
        const queue = [...VISION_LOOKS];
        const runNext = () => {
            if (cancelled) return;
            const look = queue.shift();
            if (!look) return;
            const dataUrl = renderVisionProfilePreview(image, look);
            if (cancelled) return;
            if (dataUrl) setPreviews((current) => ({ ...current, [look.id]: dataUrl }));
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
    }, [image]);

    /* ---- Historique (meme forme que Layout: 30 etats) ---- */
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isRestoringRef = useRef(false);

    const pushHistory = useCallback((nextFilters, nextIntensity, nextLookId) => {
        if (isRestoringRef.current) return;
        setHistory((previous) => {
            const trimmed = previous.slice(0, historyIndex + 1);
            trimmed.push({ filters: nextFilters, intensity: nextIntensity, lookId: nextLookId });
            if (trimmed.length > HISTORY_LIMIT) trimmed.shift();
            setHistoryIndex(Math.min(HISTORY_LIMIT - 1, trimmed.length - 1));
            return trimmed;
        });
    }, [historyIndex]);

    const commit = useCallback((nextFilters, nextIntensity, nextLookId, message = null) => {
        setFilters(nextFilters);
        setIntensity(nextIntensity);
        setActiveLookId(nextLookId);
        if (message !== null) setAutoMessage(message);
        pushHistory(nextFilters, nextIntensity, nextLookId);
    }, [pushHistory]);

    const restore = useCallback((entry) => {
        if (!entry) return;
        isRestoringRef.current = true;
        setFilters(entry.filters);
        setIntensity(entry.intensity);
        setActiveLookId(entry.lookId);
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

    const autoEnhance = useCallback(() => {
        if (!metrics) return;
        const enhancement = buildAutoEnhancement(metrics);
        commit(enhancement.filters, 80, null, enhancement.message);
    }, [metrics, commit]);

    const applyLook = useCallback((look) => {
        if (!look) return;
        const base = {
            ...DEFAULT_FILTERS,
            ...look.filters,
            safeSmartphone: filters.safeSmartphone !== false,
        };
        /* Bornes absolues du moteur PUIS garde-fou lie a cette photo. */
        const nextFilters = guardLookForImage(normalizeVisionFilters(base), signals || {}, metrics || {});
        commit(nextFilters, look.recommendedIntensity || 80, look.id, `Look « ${look.label} » — ${look.bestFor}.`);
    }, [commit, filters.safeSmartphone, signals, metrics]);

    const updateFilter = useCallback((key, value) => {
        setFilters((current) => {
            const next = { ...current, [key]: value };
            pushHistory(next, intensity, activeLookId);
            return next;
        });
    }, [pushHistory, intensity, activeLookId]);

    const resetFilters = useCallback(() => {
        commit({ ...DEFAULT_FILTERS }, 80, null, null);
        setAutoMessage(null);
    }, [commit]);

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
                    vision: { profileId: activeLookId, intensity, filters },
                };
                /* Photo importee directement depuis Vision: elle rejoint le
                   projet (Blob), pour que Layout et l'accueil la retrouvent. */
                if (!(project.images || []).length) {
                    const blob = await srcToBlob(image.src, blobCacheRef.current);
                    if (blob) {
                        patch.images = [{ id: `vision-${Date.now()}`, name: image.name || '', slotId: null, blob }];
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
    }, [filters, intensity, activeLookId, image]);

    return {
        image, images, metrics, signals,
        filters, appliedFilters, setFilters: updateFilter,
        intensity, setIntensity,
        looks, previews, activeLookId,
        autoMessage,
        isLoadingImage,
        canvasRef,
        handleImageUpload,
        autoEnhance, applyLook, resetFilters,
        undo, redo,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        exportController,
    };
}
