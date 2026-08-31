"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useCanvasRenderer from '../../vibefx-studio/hooks/useCanvasRenderer';
import useExport from '../../vibefx-studio/hooks/useExport';
import { DEFAULT_FILTERS } from '../../vibefx-studio/hooks/useStudioFilters';
import { measureVisionImageData } from '../../vibefx-studio/utils/visionMetrics';
import { getImageRecommendationSignals } from '../../vibefx-studio/utils/visionRecommendation';
import { VISION_PRESETS } from '../../vibefx-studio/utils/visionPresets';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';
import { loadImageFromBlob, resolveProjectSource } from '../project/pipeline';
import { srcToBlob } from '../layout/layoutPersistence';
import { getPhoto as getLibraryPhoto, putPhoto as putLibraryPhoto } from '../library/libraryDb';
import {
    buildPreviewSource, PREVIEW_ENGINE_VERSION, renderPresetPreview,
} from './presetPreview';
import { buildAutoEnhancement } from './autoEnhance';
import { resolvePresetCollection } from './presetCollections';

/*
 * Orchestration de l'ecran Vision VibeOS.
 *
 * Comme pour Layout, tous les moteurs sont IMPORTES: rendu (`useCanvasRenderer`
 * en vue photo), export (`useExport`), mesure d'image (`visionMetrics`),
 * bornes des reglages manuels (`normalizeVisionFilters`) et vignettes de
 * presets (`presetPreview`, qui s'appuie sur la LUT 3D de `visionPresets`).
 * Ce hook ne contient que de l'etat d'ecran et le lien avec le projet commun.
 */

/* Cles que le preset s'approprie quand il en porte: elles ne peuvent pas vivre
   dans une LUT (elles dependent des pixels voisins ou de la position). */
const PRESET_SPATIAL_KEYS = [
    'texture', 'clarity', 'sharpness', 'noiseReductionLuminance',
    'noiseReductionColor', 'dehaze', 'grain', 'grainSize', 'grainRoughness',
    'vignette', 'vignetteMidpoint', 'vignetteRoundness', 'vignetteFeather',
    'vignetteHighlights', 'vignetteLightroomV2', 'vignetteLighten',
    'presetSpatialBeforeLut', 'presetClarityScale', 'presetTextureEdgeAware',
    'presetAutoTone',
    'lightroomExposure', 'lightroomContrast', 'lightroomHighlights',
    'lightroomShadows', 'lightroomWhites', 'lightroomBlacks',
    'degradeBas',
];

/* Les memes noms que dans le panneau des reglages: on annonce ce que le preset
   pose avec les mots que l'utilisateur voit ensuite bouger. */
const SPATIAL_LABELS = {
    texture: 'texture',
    clarity: 'relief',
    sharpness: 'netteté',
    noiseReductionLuminance: 'réduction du bruit luminance',
    noiseReductionColor: 'réduction du bruit couleur',
    dehaze: 'voile atmosphérique',
    grain: 'grain',
    grainSize: 'grosseur du grain',
    grainRoughness: 'cassure du grain',
    vignette: 'vignettage',
    vignetteMidpoint: 'milieu du vignettage',
    vignetteRoundness: 'arrondi du vignettage',
    vignetteFeather: 'contour progressif du vignettage',
    vignetteHighlights: 'hautes lumières du vignettage',
    vignetteLightroomV2: 'calibration Lightroom du vignettage',
    vignetteLighten: null,
    presetSpatialBeforeLut: null,
    presetClarityScale: null,
    presetTextureEdgeAware: null,
    presetAutoTone: null,
    lightroomExposure: 'exposition Lightroom',
    lightroomContrast: 'contraste Lightroom',
    lightroomHighlights: 'hautes lumières Lightroom',
    lightroomShadows: 'ombres Lightroom',
    lightroomWhites: 'blancs Lightroom',
    lightroomBlacks: 'noirs Lightroom',
    degradeBas: 'dégradé du bas',
};

const withoutPresetSpatials = (filters) => {
    const next = { ...filters };
    for (const key of PRESET_SPATIAL_KEYS) next[key] = DEFAULT_FILTERS[key];
    return next;
};

const METRICS_SAMPLE_WIDTH = 320;
const HISTORY_LIMIT = 30;
const PERSIST_DEBOUNCE_MS = 1200;
/* Vision travaille sur la photo elle-meme, pas sur un format social: on passe
   un format neutre aux moteurs (ils ne s'en servent que pour le decoupage
   panorama, sans objet ici). */
const PHOTO_FORMAT = { id: 'photo' };
const VISION_TEMPLATE = { id: 'minimal', slots: 1 };
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const CENTRED_CROP = { x: 0, y: 0 };

/* Cache de session partage entre les remounts React. Une Promise est placee
   dans le cache des le debut du rendu: le double montage du Strict Mode ne
   peut donc pas lancer deux fois le meme preset. */
const PREVIEW_CACHE_LIMIT = 420;
const previewCache = new Map();

function cachePreview(key, work) {
    previewCache.set(key, work);
    if (previewCache.size <= PREVIEW_CACHE_LIMIT) return;
    const oldestKey = previewCache.keys().next().value;
    const oldest = previewCache.get(oldestKey);
    previewCache.delete(oldestKey);
    Promise.resolve(oldest).then((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
    }).catch(() => {});
}

function previewPhotoKey(image) {
    return [
        image?.currentSrc || image?.src || 'photo',
        image?.naturalWidth || image?.width || 0,
        image?.naturalHeight || image?.height || 0,
    ].join('|');
}

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

export default function useVisionEditor() {
    const { project, status, updateProject, ensureProject } = useVibeOsProject();

    const [image, setImage] = useState(null);
    /* D'ou vient l'image de travail: 'composition' (le visuel compose dans Mise
       en page - premier etage du pipeline), 'photo' (la photo du projet) ou
       'import' (une photo deposee ici meme). */
    const [sourceKind, setSourceKind] = useState(null);
    const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
    const [intensity, setIntensity] = useState(80);
    const [activePresetId, setActivePresetId] = useState(null);
    const [autoMessage, setAutoMessage] = useState(null);
    const [previews, setPreviews] = useState({});
    const previewControllerRef = useRef(null);
    const pendingPreviewRequestsRef = useRef(new Map());
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    /*
     * Vrai pendant qu'un curseur est tenu. Le rendu passe alors en resolution
     * reduite et en qualite 'low' (voir `useCanvasRenderer`): c'est ce qui rend
     * le reglage fluide au lieu de saccade. On repasse en pleine qualite des que
     * le doigt se leve.
     */
    const [isAdjusting, setIsAdjusting] = useState(false);

    /*
     * LA LOUPE DE L'APERCU. Elle ne recadre rien: elle dit seulement quelle
     * portion de la photo on regarde, et a quelle echelle.
     *
     * Elle existe pour une raison precise: un effet de MATIERE ne se juge pas
     * sur une image reduite. A « Adapter », une photo de 9180 px dessinee sur
     * 800 en montre un pixel sur onze — son grain est moyenne, donc invisible,
     * et on croit que le reglage ne fait rien. Lightroom repond a ca par le zoom
     * 100 %, ou un pixel de la photo vaut un pixel d'ecran. C'est la seule facon
     * honnete de regarder un grain, une nettete ou une texture.
     */
    const [zoom, setZoom] = useState(1);
    const [zoomCentre, setZoomCentre] = useState({ cx: 0.5, cy: 0.5 });
    const viewport = useMemo(() => ({ zoom, cx: zoomCentre.cx, cy: zoomCentre.cy }),
        [zoom, zoomCentre]);

    const canvasRef = useRef(null);
    const bgCanvasRef = useRef(null);
    const slotRects = useRef([]);
    const requestRef = useRef(null);

    const images = useMemo(() => (image ? [image] : []), [image]);

    /* Filtres reellement envoyes au moteur: l'intensite pilote le melange
       lineaire deja implemente par le pipeline (`filterIntensity`). */
    const appliedFilters = useMemo(() => ({
        ...filters,
        presetId: activePresetId,
        safeSmartphone: filters.safeSmartphone !== false,
        filterIntensity: intensity,
    }), [filters, intensity, activePresetId]);

    const { getCanvasDimensions, renderPipeline } = useCanvasRenderer({
        canvasRef, images, view: 'vision-pro',
        activeFormat: PHOTO_FORMAT,
        activeTemplate: VISION_TEMPLATE,
        overlayMode: 'landscape',
        padding: 0, gap: 0, customLayoutGap: 0, radius: 0,
        layoutBgColor: '#000000', layoutBgBlur: false, layoutBgGradient: false,
        layoutBgMeshColors: EMPTY_ARRAY, layoutLumenBackground: null, layoutBgTexture: 0,
        layoutSmoothBlur: null, layoutTextures: EMPTY_ARRAY, activeTextureId: null, layoutTextureOpacity: 0,
        selectedSlotIndex: null, slotConfigs: EMPTY_OBJECT,
        slotRects, bgCanvasRef,
        texts: EMPTY_ARRAY, assets: EMPTY_ARRAY, activeTextId: null, activeAssetId: null,
        isDraggingText: false, activeGuides: EMPTY_ARRAY,
        cropRatio: 'original', cropPos: CENTRED_CROP, cropScale: 1, isCropping: false,
        filters: appliedFilters,
        viewport,
        isDragging: isAdjusting, requestRef,
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
                /* Entree du pipeline: la composition du Layout si elle existe,
                   sinon la photo du projet (plan §4.3). */
                const { image: loaded, kind } = await resolveProjectSource(project);
                if (loaded) {
                    setImage(loaded);
                    setSourceKind(kind);
                }
                const storedVision = project.vision || {};
                if (storedVision.filters) setFilters(storedVision.filters);
                if (typeof storedVision.intensity === 'number') setIntensity(storedVision.intensity);
                if (storedVision.presetId) setActivePresetId(storedVision.presetId);
            } finally {
                hydrationRef.current = 'done';
                setIsLoadingImage(false);
            }
        });
    }, [status, project]);

    /*
     * Import direct depuis l'ecran Vision.
     *
     * La photo importee remplace VRAIMENT la source du projet: la composition
     * publiee par Layout est effacee et la nouvelle photo devient l'image du
     * projet. Sans cela, la composition restait prioritaire dans
     * `resolveProjectSource` et reapparaissait au rechargement - c'est ce qui
     * donnait l'impression d'une photo impossible a enlever.
     */
    const handleImageUpload = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsLoadingImage(true);
        const img = new window.Image();
        img.onload = () => {
            img.name = file.name;
            setImage(img);
            setSourceKind('import');
            setIsLoadingImage(false);
            updateProject({
                composition: null,
                images: [{ id: `vision-${Date.now()}`, name: file.name, slotId: null, blob: file }],
                slots: {},
                thumbnail: null,
            });
        };
        img.onerror = () => setIsLoadingImage(false);
        img.src = URL.createObjectURL(file);
        event.target.value = '';
    }, [updateProject]);

    /*
     * Retire la photo de l'apercu. Ce n'est PAS une suppression: le fichier
     * reste dans la bibliotheque, on ne fait que vider l'espace de travail
     * (composition et image du projet), pour repartir d'une page blanche.
     */
    const clearImage = useCallback(() => {
        setImage(null);
        setSourceKind(null);
        setActivePresetId(null);
        setAutoMessage(null);
        setFilters({ ...DEFAULT_FILTERS });
        /* Sans ca, les vignettes resteraient celles de la photo qu'on vient de
           retirer. */
        setPreviews({});
        updateProject({ composition: null, images: [], slots: {}, thumbnail: null });
    }, [updateProject]);

    /*
     * Detache Vision de la composition Layout: on revient a la photo brute du
     * projet, ou a un ecran vide s'il n'y en a pas. C'est la sortie de secours
     * quand on veut repartir d'une photo au lieu d'un visuel deja compose.
     */
    const detachComposition = useCallback(async () => {
        updateProject({ composition: null });
        const record = (project?.images || [])[0];
        if (record?.blob) {
            const loaded = await loadImageFromBlob(record.blob, record.name);
            setImage(loaded);
            setSourceKind(loaded ? 'photo' : null);
        } else {
            setImage(null);
            setSourceKind(null);
        }
    }, [updateProject, project]);

    /* ---- Analyse de la photo (une mesure par photo) ---- */
    const metrics = useMemo(() => (image ? measureSourceImage(image) : null), [image]);

    const signals = useMemo(
        () => (metrics ? getImageRecommendationSignals(metrics) : null),
        [metrics],
    );

    /* ---- Les presets ---- */
    const presets = useMemo(() => VISION_PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        hint: preset.hint,
        description: preset.description,
        bestFor: preset.bestFor,
        avoidFor: preset.avoidFor,
        recommendedIntensity: preset.recommendedIntensity,
        collection: resolvePresetCollection(preset),
        /* Un preset importe de Lightroom peut porter des reglages que la LUT ne
           peut pas contenir (clarte, grain, vignetage...): ils dependent des
           pixels voisins ou de la position dans l'image. */
        spatialFilters: preset.spatialFilters || null,
    })), []);

    /*
     * Vignettes: la photo est reduite UNE fois, puis chaque preset est rendu
     * par le pipeline complet. Les effets spatiaux Lightroom ne peuvent pas
     * etre simules par la LUT seule (grain, texture, voile, vignetage...).
     */
    useEffect(() => {
        previewControllerRef.current?.cancel();
        if (!image) {
            previewControllerRef.current = null;
            const clearHandle = window.setTimeout(() => setPreviews({}), 0);
            return () => window.clearTimeout(clearHandle);
        }

        const source = buildPreviewSource(image);
        if (!source) return undefined;
        const photoKey = previewPhotoKey(image);
        const presetById = new Map(presets.map((preset) => [preset.id, preset]));
        const requested = new Map();
        const urgentQueue = [];
        const idleQueue = [];
        let cancelled = false;
        let running = false;
        let timer = null;
        let idleHandle = null;
        const resetHandle = window.setTimeout(() => {
            if (!cancelled) setPreviews({});
        }, 0);

        const cacheKey = (preset) => [
            PREVIEW_ENGINE_VERSION,
            photoKey,
            preset.id,
            preset.recommendedIntensity || 85,
        ].join('::');

        const publish = (presetId, url) => {
            if (cancelled || !url || requested.get(presetId) === undefined) return;
            setPreviews((current) => (
                current[presetId] === url ? current : { ...current, [presetId]: url }
            ));
        };

        const takeNext = (priority) => {
            const queue = priority === 'urgent' ? urgentQueue : idleQueue;
            while (queue.length) {
                const presetId = queue.shift();
                if (requested.get(presetId) === priority) return presetId;
            }
            return null;
        };

        const schedule = () => {
            if (cancelled || running || timer !== null || idleHandle !== null) return;
            if (urgentQueue.some((id) => requested.get(id) === 'urgent')) {
                /* Laisser le placeholder se peindre, puis servir le viewport sans
                   attendre une periode d'inactivite qui peut ne jamais venir. */
                timer = window.setTimeout(() => {
                    timer = null;
                    run('urgent');
                }, 0);
                return;
            }
            if (!idleQueue.some((id) => requested.get(id) === 'idle')) return;
            const callback = () => {
                idleHandle = null;
                run('idle');
            };
            if (typeof window.requestIdleCallback === 'function') {
                idleHandle = window.requestIdleCallback(callback, { timeout: 600 });
            } else {
                idleHandle = window.setTimeout(callback, 80);
            }
        };

        const run = async (preferredPriority) => {
            if (cancelled || running) return;
            const urgentId = takeNext('urgent');
            const presetId = urgentId || (preferredPriority === 'idle' ? takeNext('idle') : null);
            if (!presetId) {
                schedule();
                return;
            }
            const preset = presetById.get(presetId);
            if (!preset) {
                requested.delete(presetId);
                schedule();
                return;
            }
            running = true;
            const key = cacheKey(preset);
            let work = previewCache.get(key);
            if (!work) {
                work = Promise.resolve(renderPresetPreview(source, preset)).then((blob) => (
                    blob ? URL.createObjectURL(blob) : null
                ));
                cachePreview(key, work);
            }
            try {
                const url = await work;
                publish(presetId, url);
            } finally {
                requested.delete(presetId);
                running = false;
                schedule();
            }
        };

        const controller = {
            request(presetId, priority = 'idle') {
                const preset = presetById.get(presetId);
                if (!preset || cancelled) return;
                const cached = previewCache.get(cacheKey(preset));
                if (cached) {
                    requested.set(presetId, priority);
                    Promise.resolve(cached).then((url) => publish(presetId, url));
                    return;
                }
                const currentPriority = requested.get(presetId);
                if (currentPriority === 'urgent' || currentPriority === priority) return;
                requested.set(presetId, priority);
                (priority === 'urgent' ? urgentQueue : idleQueue).push(presetId);
                if (priority === 'urgent' && idleHandle !== null) {
                    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle);
                    else window.clearTimeout(idleHandle);
                    idleHandle = null;
                }
                schedule();
            },
            release(presetId) {
                requested.delete(presetId);
            },
            cancel() {
                cancelled = true;
                requested.clear();
                window.clearTimeout(resetHandle);
                if (timer !== null) window.clearTimeout(timer);
                if (idleHandle !== null) {
                    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle);
                    else window.clearTimeout(idleHandle);
                }
            },
        };
        previewControllerRef.current = controller;
        for (const [presetId, priority] of pendingPreviewRequestsRef.current) {
            controller.request(presetId, priority);
        }

        return () => controller.cancel();
    }, [image, presets]);

    const requestPresetPreview = useCallback((presetId, priority = 'idle') => {
        const pending = pendingPreviewRequestsRef.current;
        if (pending.get(presetId) !== 'urgent') pending.set(presetId, priority);
        previewControllerRef.current?.request(presetId, priority);
    }, []);

    const releasePresetPreview = useCallback((presetId) => {
        pendingPreviewRequestsRef.current.delete(presetId);
        previewControllerRef.current?.release(presetId);
    }, []);

    /* ---- Historique (meme forme que Layout: 30 etats) ---- */
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isRestoringRef = useRef(false);

    const pushHistory = useCallback((nextFilters, nextIntensity, nextPresetId) => {
        if (isRestoringRef.current) return;
        setHistory((previous) => {
            const trimmed = previous.slice(0, historyIndex + 1);
            trimmed.push({ filters: nextFilters, intensity: nextIntensity, presetId: nextPresetId });
            if (trimmed.length > HISTORY_LIMIT) trimmed.shift();
            setHistoryIndex(Math.min(HISTORY_LIMIT - 1, trimmed.length - 1));
            return trimmed;
        });
    }, [historyIndex]);

    const commit = useCallback((nextFilters, nextIntensity, nextPresetId, message = null) => {
        setFilters(nextFilters);
        setIntensity(nextIntensity);
        setActivePresetId(nextPresetId);
        if (message !== null) setAutoMessage(message);
        pushHistory(nextFilters, nextIntensity, nextPresetId);
    }, [pushHistory]);

    const restore = useCallback((entry) => {
        if (!entry) return;
        isRestoringRef.current = true;
        setFilters(entry.filters);
        setIntensity(entry.intensity);
        setActivePresetId(entry.presetId);
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

    /* « Améliorer ma photo » corrige la lumiere et le relief; le preset, lui,
       porte le look. Les deux se cumulent, donc on garde le preset en place. */
    const autoEnhance = useCallback(() => {
        if (!metrics) return;
        const enhancement = buildAutoEnhancement(metrics);
        commit(enhancement.filters, 80, activePresetId, enhancement.message);
    }, [metrics, commit, activePresetId]);

    /*
     * Appliquer un preset ne touche PAS aux reglages manuels: le preset est une
     * LUT posee avant eux dans le pipeline. Recliquer sur le preset actif le
     * retire, ce qui donne une comparaison immediate avec la photo d'origine.
     */
    const applyPreset = useCallback((preset) => {
        if (!preset) return;
        if (preset.id === activePresetId) {
            commit(withoutPresetSpatials(filters), intensity, null,
                'Preset retiré — tu vois la photo sans le look.');
            return;
        }
        /* On repart des valeurs par defaut sur les cles spatiales avant
           d'appliquer celles du preset: sinon le grain ou le vignetage du
           preset precedent resterait en place apres un changement. */
        const nextFilters = { ...withoutPresetSpatials(filters), ...(preset.spatialFilters || {}) };
        /* Un preset qui pose aussi des effets non-LUT le DIT: sinon on voit des
           reglages bouger dans le panneau sans comprendre qui les a touches. */
        const portes = Object.keys(preset.spatialFilters || {})
            .map((key) => (
                Object.prototype.hasOwnProperty.call(SPATIAL_LABELS, key)
                    ? SPATIAL_LABELS[key]
                    : key
            ))
            .filter(Boolean);
        const mention = portes.length ? ` Il pose aussi : ${portes.join(', ')}.` : '';
        commit(
            nextFilters,
            preset.recommendedIntensity || 85,
            preset.id,
            `Preset « ${preset.label} » — ${preset.bestFor}.${mention}`,
        );
    }, [commit, activePresetId, filters, intensity]);

    const updateFilter = useCallback((key, value) => {
        setFilters((current) => {
            const next = { ...current, [key]: value };
            pushHistory(next, intensity, activePresetId);
            return next;
        });
    }, [pushHistory, intensity, activePresetId]);

    const resetFilters = useCallback(() => {
        commit({ ...DEFAULT_FILTERS }, 80, null, null);
        setAutoMessage(null);
    }, [commit]);

    /*
     * On fige l'etat des reglages au DEBUT du geste. Le panneau s'en sert pour
     * garder son ordre pendant qu'on tient un curseur: sans ca, celui qu'on
     * bouge sauterait dans la section « Modifiés » au premier cran, sous le
     * doigt, et le geste serait coupe net.
     */
    const [adjustBaseline, setAdjustBaseline] = useState(null);
    const startAdjusting = useCallback(() => {
        setAdjustBaseline(filters);
        setIsAdjusting(true);
    }, [filters]);
    const stopAdjusting = useCallback(() => setIsAdjusting(false), []);

    /*
     * Les reglages que le preset actif pose lui-meme. L'interface les colore,
     * pour qu'on voie d'un coup d'oeil qu'un preset ne fait pas QUE de la
     * couleur: `powlisher-showcase` pose aussi son grain et son vignetage, qui
     * ne peuvent pas tenir dans une LUT.
     */
    const presetDrivenKeys = useMemo(() => {
        const preset = VISION_PRESETS.find((item) => item.id === activePresetId);
        return new Set(Object.keys(preset?.spatialFilters || {}));
    }, [activePresetId]);

    const activePresetLabel = useMemo(
        () => VISION_PRESETS.find((item) => item.id === activePresetId)?.label || '',
        [activePresetId],
    );

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
                    vision: {
                        presetId: activePresetId,
                        intensity,
                        filters,
                    },
                };
                /* Photo importee directement depuis Vision: elle rejoint le
                   projet (Blob), pour que Layout et l'accueil la retrouvent.
                   Une composition, elle, appartient au Layout: on ne la
                   reinjecte jamais comme photo source. */
                if (sourceKind === 'import' && !(project.images || []).length) {
                    const blob = await srcToBlob(image.src, blobCacheRef.current);
                    if (blob) {
                        patch.images = [{ id: `vision-${Date.now()}`, name: image.name || '', slotId: null, blob }];
                    }
                }
                updateProject(patch);

                /* La photo vient de la bibliotheque (identifiant `ph-...`): on y
                   reporte le preset applique, pour pouvoir ensuite filtrer la
                   grille par preset sans rouvrir chaque photo. */
                const record = (project.images || [])[0];
                if (record?.id?.startsWith('ph-')) {
                    const stored = await getLibraryPhoto(record.id);
                    if (stored) {
                        const preset = VISION_PRESETS.find((item) => item.id === activePresetId);
                        await putLibraryPhoto({
                            ...stored,
                            preset: preset ? { id: preset.id, label: preset.label } : null,
                        });
                    }
                }
            } catch {
                /* Sauvegarde non bloquante. */
            }
        }, PERSIST_DEBOUNCE_MS);
        return () => {
            if (persistTimer.current) clearTimeout(persistTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, intensity, activePresetId, image]);

    /*
     * Le hook ne connait qu'un MULTIPLICATEUR, pas un pourcentage. « 100 % » ne
     * veut rien dire ici: il veut dire « un pixel de la photo pour un pixel du
     * canvas », et ce rapport depend de la taille du canvas, donc de la fenetre.
     * C'est l'ecran qui traduit les deux — lui seul mesure le canvas.
     */
    const resetZoom = useCallback(() => {
        setZoom(1);
        setZoomCentre({ cx: 0.5, cy: 0.5 });
    }, []);
    /* Deplacer la loupe. `dx`/`dy` sont en fraction du canvas: on divise par le
       zoom, sinon le deplacement s'emballe des qu'on grossit. */
    const panZoom = useCallback((dx, dy) => {
        setZoomCentre((c) => ({
            cx: Math.min(1, Math.max(0, c.cx - dx)),
            cy: Math.min(1, Math.max(0, c.cy - dy)),
        }));
    }, []);

    return {
        zoom, setZoom, viewport, resetZoom, panZoom,
        image, images, metrics, signals, sourceKind,
        filters, appliedFilters, setFilters: updateFilter,
        intensity, setIntensity,
        presets, previews, requestPresetPreview, releasePresetPreview, activePresetId,
        autoMessage,
        isLoadingImage,
        canvasRef,
        handleImageUpload, detachComposition, clearImage,
        autoEnhance, applyPreset, resetFilters,
        startAdjusting, stopAdjusting, isAdjusting, adjustBaseline,
        presetDrivenKeys, activePresetLabel,
        undo, redo,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        exportController,
    };
}
