"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAiLaunchSettings } from '@/hooks/useAiLaunchSettings';


// --- DATA ---
import { DEFAULT_CUSTOM_LAYOUT_GAP, FORMATS, TEMPLATES, FONT_OPTIONS, PRESET_CATEGORIES, CAMERA_BRANDS } from './data/constants';

// --- COMPOSANTS ---
import VisionPanel from './components/panels/VisionPanel';
import StylePanel from './components/panels/StylePanel';
import MeshGradientPro from './components/panels/MeshGradientPopup';
import SmoothBlurPopup from './components/panels/SmoothBlurPopup';
import Header from './components/Header';
import CanvasWorkspace from './components/canvas/CanvasWorkspace';
import LayoutSidebar from './components/sidebar/LayoutSidebar';
import ExportModal from './components/modals/ExportModal';
import InstaPreviewModal from './components/modals/InstaPreviewModal';
import CompareModal from './components/modals/CompareModal';
import LumenShaderModal from './components/modals/LumenShaderModal';
import AssetLibrary from './components/library/AssetLibrary';
import AssetLibraryModal from './components/modals/AssetLibraryModal';
import StudioAiRail from './components/ai/StudioAiRail';
import SoundtrackPage from './soundtrack/SoundtrackPage';
import { useSoundtrackController } from './soundtrack/hooks/useSoundtrackController';
import useVideoStore from './video/store/videoStore';
import { buildTrackRightsManifest } from './video/data/musicRights';

// --- HOOKS ---
import useExport from './hooks/useExport';
import useImageUpload from './hooks/useImageUpload';
import useLayoutHelpers from './hooks/useLayoutHelpers';
import useCanvasEvents from './hooks/useCanvasEvents';
import useCanvasRenderer from './hooks/useCanvasRenderer';
import { DEFAULT_FILTERS } from './hooks/useStudioFilters';
import { compareVisionMetrics, measureVisionImageData } from './utils/visionMetrics';
import { createCustomZone, normalizeCustomZones, updateCustomTemplateZones } from './utils/customLayout';

const VISION_DIAGNOSTIC_SAMPLE_MAX_SIDE = 420;
const VISION_DIAGNOSTIC_WARN_MS = 650;
const VISION_DIAGNOSTIC_WARN_MEGAPIXELS = 20;
const DEFAULT_LAYOUT_MESH_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#050505'];

const getPerfNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

const canvasToBlob = (canvas, mimeType = 'image/png', quality = 0.92) =>
    new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });

const serializeSlotConfigs = (configs) => Object.fromEntries(
    Object.entries(configs || {}).map(([slotId, config]) => {
        const serializableConfig = { ...(config || {}) };
        delete serializableConfig.image;
        return [slotId, serializableConfig];
    })
);

const buildSocialImages = async (exportCanvas, activeFormat) => {
    const slices = activeFormat?.id === 'pano-2' ? 2 : activeFormat?.id === 'pano-3' ? 3 : 1;
    if (slices <= 1) {
        return [{
            url: exportCanvas.toDataURL('image/png'),
            blob: await canvasToBlob(exportCanvas, 'image/png'),
            width: exportCanvas.width,
            height: exportCanvas.height,
            index: 0,
        }];
    }

    const sliceWidth = exportCanvas.width / slices;
    const slides = [];
    for (let index = 0; index < slices; index += 1) {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = sliceWidth;
        sliceCanvas.height = exportCanvas.height;
        const sliceCtx = sliceCanvas.getContext('2d');
        sliceCtx.drawImage(exportCanvas, index * sliceWidth, 0, sliceWidth, exportCanvas.height, 0, 0, sliceWidth, exportCanvas.height);
        slides.push({
            url: sliceCanvas.toDataURL('image/png'),
            blob: await canvasToBlob(sliceCanvas, 'image/png'),
            width: sliceCanvas.width,
            height: sliceCanvas.height,
            index,
        });
    }
    return slides;
};

const measureCanvasVisionSnapshot = (canvas) => {
    if (!canvas?.width || !canvas?.height) return null;
    const ratio = Math.min(1, VISION_DIAGNOSTIC_SAMPLE_MAX_SIDE / Math.max(canvas.width, canvas.height));
    const width = Math.max(1, Math.round(canvas.width * ratio));
    const height = Math.max(1, Math.round(canvas.height * ratio));
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = width;
    sampleCanvas.height = height;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) return null;
    sampleCtx.drawImage(canvas, 0, 0, width, height);
    return {
        metrics: measureVisionImageData(sampleCtx.getImageData(0, 0, width, height), { step: 2 }),
        sample: {
            width,
            height,
            ratio,
            step: 2,
        },
    };
};

const buildVisionPerformanceInfo = ({ width, height, previewWidth, previewHeight, previewScale, isPreviewCapped, sourceRenderMs, sourceMeasureMs, renderedMeasureMs, totalMs, sample }) => {
    const megapixels = width && height ? (width * height) / 1000000 : 0;
    const previewMegapixels = previewWidth && previewHeight ? (previewWidth * previewHeight) / 1000000 : 0;
    return {
        width,
        height,
        megapixels: Number(megapixels.toFixed(2)),
        previewWidth: previewWidth || width,
        previewHeight: previewHeight || height,
        previewMegapixels: Number(previewMegapixels.toFixed(2)),
        previewScale: Number((previewScale || 1).toFixed(3)),
        isPreviewCapped: Boolean(isPreviewCapped),
        sourceRenderMs: Math.round(sourceRenderMs),
        sourceMeasureMs: Math.round(sourceMeasureMs),
        renderedMeasureMs: Math.round(renderedMeasureMs),
        diagnosticMs: Math.round(totalMs),
        sampleWidth: sample?.width || 0,
        sampleHeight: sample?.height || 0,
        sampleRatio: Number((sample?.ratio || 0).toFixed(3)),
        sampleStep: sample?.step || 0,
    };
};

const buildVisionDiagnosticWarnings = (delta, performanceInfo) => {
    if (!delta) return [];
    const warnings = [];
    if (delta.greyVeilRisk) warnings.push('voile gris');
    if (!delta.greyVeilRisk && delta.tonalRangeRatio < 0.72 && delta.shadowLiftDelta > 10) warnings.push('range compresse');
    if (delta.channelClipHighDelta > 0.04) warnings.push('hautes lumieres clippees');
    if (delta.channelClipLowDelta > 0.08) warnings.push('noirs ecrases');
    if (delta.highSaturationDelta > 0.16) warnings.push('saturation excessive');
    if (delta.skyHighSaturationDelta > 0.2 || delta.skyClipHighDelta > 0.04) warnings.push('ciel a verifier');
    if (delta.foliageHighSaturationDelta > 0.2 || delta.foliageClipHighDelta > 0.04) warnings.push('verts a verifier');
    if (delta.warmHighSaturationDelta > 0.2 || delta.warmClipHighDelta > 0.04) warnings.push('rouges/oranges a verifier');
    if (delta.protectedNeutralBiasDelta > 24) warnings.push('neutres teintes');
    if (delta.skinHueShiftDeg > 24 || Math.abs(delta.skinSaturationDelta) > 0.18) warnings.push('peau a verifier');
    if (performanceInfo?.diagnosticMs > VISION_DIAGNOSTIC_WARN_MS) warnings.push('diagnostic lent');
    if (performanceInfo?.megapixels > VISION_DIAGNOSTIC_WARN_MEGAPIXELS) warnings.push('image lourde');
    return warnings;
};

// --- APP PRINCIPALE ---
function App({ onImportToPublication, onOpenPublications, initialView = 'studio' }) {
    const { aiInterfacesEnabled } = useAiLaunchSettings();
    // Phase 7: la bande-son envoie vers /video, elle ne change plus de vue interne.
    const router = useRouter();
    const [view, setView] = useState(initialView);
    const soundtrack = useSoundtrackController();
    const [images, setImages] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(true);

    // --- STATE LAYOUT (MAJ) ---
    const [activeFormat, setActiveFormat] = useState(FORMATS[0]);
    const [activeTemplate, setActiveTemplate] = useState(TEMPLATES[0]);
    const [overlayMode, setOverlayMode] = useState('landscape');
    const [activeAccordion, setActiveAccordion] = useState(null); // 'texts', 'geometry', 'texture', 'background'

    // Texts & Assets
    const [texts, setTexts] = useState([
        { id: 1, content: 'Vibe_fx', x: 0.5, y: 0.85, font: 'Inter', bold: true, italic: false, color: '#ffffff', tracking: 0, opacity: 100, rotate: 0, blend: 'source-over' }
    ]);
    const [assets, setAssets] = useState([]);
    const [activeTextId, setActiveTextId] = useState(null);
    const [activeAssetId, setActiveAssetId] = useState(null);
    const [isDraggingText, setIsDraggingText] = useState(false);
    const [isDraggingAsset, setIsDraggingAsset] = useState(false);
    const [activeGuides, setActiveGuides] = useState([]);

    // Layout Styles
    const [padding, setPadding] = useState(40);
    const [gap, setGap] = useState(20);
    const [customLayoutGap, setCustomLayoutGap] = useState(DEFAULT_CUSTOM_LAYOUT_GAP);
    const [radius, setRadius] = useState(0);
    const [layoutBgColor, setLayoutBgColor] = useState('#000000');
    const [layoutBgBlur, setLayoutBgBlur] = useState(true);
    const [layoutBgTexture, setLayoutBgTexture] = useState(15);
    const [layoutTextures, setLayoutTextures] = useState([]);
    const [activeTextureId, setActiveTextureId] = useState(null);
    const [layoutTextureOpacity, setLayoutTextureOpacity] = useState(70);
    const [layoutBgGradient, setLayoutBgGradient] = useState(false); // New Smart Background
    const [layoutBgMeshColors, setLayoutBgMeshColors] = useState(DEFAULT_LAYOUT_MESH_COLORS);
    const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
    const [slotConfigs, setSlotConfigs] = useState({});
    const [customEditMode, setCustomEditMode] = useState(false);
    const [slotRectsState, setSlotRectsState] = useState([]);
    const [isLayoutMeshPopupOpen, setIsLayoutMeshPopupOpen] = useState(false);
    const [isLayoutSmoothBlurPopupOpen, setIsLayoutSmoothBlurPopupOpen] = useState(false);
    const [isLumenShaderOpen, setIsLumenShaderOpen] = useState(false);
    const [layoutLumenBackground, setLayoutLumenBackground] = useState(null);

    // Smooth Blur
    const [layoutSmoothBlur, setLayoutSmoothBlur] = useState({
        enabled: false,
        direction: 'down',
        height: 54, // in %
        precision: 35,
        blur: 64, // in px
        preset: 'linear',
        easeType: 'in',
        reverse: false
    });

    // Studio State
    const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
    const [cropScale, setCropScale] = useState(1.0);
    const [isCropping, setIsCropping] = useState(false);
    const [cropRatio, setCropRatio] = useState('original');
    const [showGuidelines, setShowGuidelines] = useState(true);

    // System
    const [isDragging, setIsDragging] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragOffset = useRef({ x: 0, y: 0 });
    const textMetrics = useRef({ w: 0, h: 0 });

    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStatus, setLoadingStatus] = useState("");
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const [isInstaPreviewOpen, setIsInstaPreviewOpen] = useState(false);
    const [instaPreviewUrl, setInstaPreviewUrl] = useState(null);
    const [fileInfo, setFileInfo] = useState(null);
    const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
    const [isAiRailOpen, setIsAiRailOpen] = useState(false);

    // Filtres (Studio)
    const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
    const [visionCompareSplit, setVisionCompareSplit] = useState({ enabled: false, position: 50, beforeUrl: null });
    const [visionDiagnostics, setVisionDiagnostics] = useState({ status: 'idle' });

    const canvasRef = useRef(null);

    // --- UNDO / REDO HISTORY FOR LAYOUT ---
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isRestoringHistoryRef = useRef(false);
    const prevSavedStateRef = useRef(null);

    const captureState = useCallback(() => {
        return {
            images: images.map(img => img),
            activeFormat,
            activeTemplate,
            overlayMode,
            texts: texts.map(t => ({ ...t })),
            assets: assets.map(a => ({ ...a })),
            padding,
            gap,
            customLayoutGap,
            radius,
            layoutBgColor,
            layoutBgBlur,
            layoutBgTexture,
            layoutBgGradient,
            layoutBgMeshColors: [...layoutBgMeshColors],
            slotConfigs: Object.fromEntries(
                Object.entries(slotConfigs).map(([k, v]) => [
                    k,
                    { ...v }
                ])
            ),
            layoutLumenBackground: layoutLumenBackground ? { ...layoutLumenBackground } : null,
            layoutSmoothBlur: layoutSmoothBlur ? { ...layoutSmoothBlur } : null,
            filters: { ...filters },
        };
    }, [
        images,
        activeFormat,
        activeTemplate,
        overlayMode,
        texts,
        assets,
        padding,
        gap,
        customLayoutGap,
        radius,
        layoutBgColor,
        layoutBgBlur,
        layoutBgTexture,
        layoutBgGradient,
        layoutBgMeshColors,
        slotConfigs,
        layoutLumenBackground,
        layoutSmoothBlur,
        filters
    ]);

    const restoreState = useCallback((state) => {
        if (!state) return;
        setImages(state.images || []);
        setActiveFormat(state.activeFormat || FORMATS[0]);
        setActiveTemplate(state.activeTemplate || TEMPLATES[0]);
        setOverlayMode(state.overlayMode || 'landscape');
        setTexts(state.texts || []);
        setAssets(state.assets || []);
        setPadding(state.padding ?? 40);
        setGap(state.gap ?? 20);
        setCustomLayoutGap(state.customLayoutGap ?? DEFAULT_CUSTOM_LAYOUT_GAP);
        setRadius(state.radius ?? 0);
        setLayoutBgColor(state.layoutBgColor ?? '#000000');
        setLayoutBgBlur(state.layoutBgBlur ?? true);
        setLayoutBgTexture(state.layoutBgTexture ?? 15);
        setLayoutBgGradient(state.layoutBgGradient ?? false);
        setLayoutBgMeshColors(state.layoutBgMeshColors ?? DEFAULT_LAYOUT_MESH_COLORS);
        setSlotConfigs(state.slotConfigs || {});
        setLayoutLumenBackground(state.layoutLumenBackground || null);
        setLayoutSmoothBlur(state.layoutSmoothBlur || {
            enabled: false,
            direction: 'down',
            height: 54,
            precision: 35,
            blur: 64,
            preset: 'linear',
            easeType: 'in',
            reverse: false
        });
        setFilters(state.filters || { ...DEFAULT_FILTERS });
    }, []);

    const isStateEqual = useCallback((a, b) => {
        if (!a || !b) return false;
        if (a.images?.length !== b.images?.length) return false;
        if (a.activeFormat?.id !== b.activeFormat?.id) return false;
        if (a.activeTemplate?.id !== b.activeTemplate?.id) return false;
        if (JSON.stringify(a.activeTemplate?.customLayout || null) !== JSON.stringify(b.activeTemplate?.customLayout || null)) return false;
        if (a.overlayMode !== b.overlayMode) return false;
        if (a.padding !== b.padding) return false;
        if (a.gap !== b.gap) return false;
        if (a.customLayoutGap !== b.customLayoutGap) return false;
        if (a.radius !== b.radius) return false;
        if (a.layoutBgColor !== b.layoutBgColor) return false;
        if (a.layoutBgBlur !== b.layoutBgBlur) return false;
        if (a.layoutBgTexture !== b.layoutBgTexture) return false;
        if (a.layoutBgGradient !== b.layoutBgGradient) return false;
        if (JSON.stringify(a.layoutBgMeshColors) !== JSON.stringify(b.layoutBgMeshColors)) return false;
        if (JSON.stringify(a.texts) !== JSON.stringify(b.texts)) return false;
        if (JSON.stringify(a.assets) !== JSON.stringify(b.assets)) return false;
        if (a.layoutLumenBackground?.id !== b.layoutLumenBackground?.id) return false;
        if (JSON.stringify(a.layoutSmoothBlur) !== JSON.stringify(b.layoutSmoothBlur)) return false;
        if (JSON.stringify(a.filters) !== JSON.stringify(b.filters)) return false;

        const keysA = Object.keys(a.slotConfigs || {});
        const keysB = Object.keys(b.slotConfigs || {});
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            const confA = a.slotConfigs[key];
            const confB = b.slotConfigs[key];
            if (!confB) return false;
            if (confA.zoom !== confB.zoom) return false;
            if (confA.x !== confB.x) return false;
            if (confA.y !== confB.y) return false;
            if (confA.border !== confB.border) return false;
            if (confA.blur !== confB.blur) return false;
            if (confA.bgColor !== confB.bgColor) return false;
            if (confA.textContent !== confB.textContent) return false;
            if (confA.textColor !== confB.textColor) return false;
            if (confA.textFont !== confB.textFont) return false;
            if (confA.textSize !== confB.textSize) return false;
            if (confA.imageName !== confB.imageName) return false;
        }
        return true;
    }, []);

    // Save initial state
    useEffect(() => {
        const initialState = captureState();
        setHistory([initialState]);
        setHistoryIndex(0);
        prevSavedStateRef.current = initialState;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Monitor changes to save history (debounced)
    useEffect(() => {
        if (isRestoringHistoryRef.current) return;

        const currentState = captureState();
        if (isStateEqual(currentState, prevSavedStateRef.current)) return;

        const timer = setTimeout(() => {
            setHistory(prev => {
                const nextHistory = prev.slice(0, historyIndex + 1);
                nextHistory.push(currentState);
                if (nextHistory.length > 30) {
                    nextHistory.shift();
                }
                return nextHistory;
            });
            setHistoryIndex(prev => {
                const nextIndex = prev + 1;
                return Math.min(29, nextIndex);
            });
            prevSavedStateRef.current = currentState;
        }, 400);

        return () => clearTimeout(timer);
    }, [
        captureState,
        isStateEqual,
        historyIndex,
    ]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const nextIndex = historyIndex - 1;
            const targetState = history[nextIndex];

            isRestoringHistoryRef.current = true;
            prevSavedStateRef.current = targetState;
            setHistoryIndex(nextIndex);

            restoreState(targetState);

            setTimeout(() => {
                isRestoringHistoryRef.current = false;
            }, 50);
        }
    }, [historyIndex, history, restoreState]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            const targetState = history[nextIndex];

            isRestoringHistoryRef.current = true;
            prevSavedStateRef.current = targetState;
            setHistoryIndex(nextIndex);

            restoreState(targetState);

            setTimeout(() => {
                isRestoringHistoryRef.current = false;
            }, 50);
        }
    }, [historyIndex, history, restoreState]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (view !== 'layout' && view !== 'studio') return;

            const isZ = e.key?.toLowerCase() === 'z';
            const isY = e.key?.toLowerCase() === 'y';

            if (isZ && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if (isY && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, undo, redo]);
    const canvasContainerRef = useRef(null);
    const bgCanvasRef = useRef(null);
    const slotRects = useRef([]);
    const modalBeforeRef = useRef(null);
    const modalAfterRef = useRef(null);
    const requestRef = useRef();

    useEffect(() => {
        document.body.style.backgroundColor = isDarkMode ? '#0a0a0a' : '#f9fafb';
        document.body.style.color = isDarkMode ? 'white' : '#111827';
    }, [isDarkMode]);

    useEffect(() => {
        if (!aiInterfacesEnabled && view === 'library') {
            setView('studio');
        }
    }, [aiInterfacesEnabled, view]);

    // Sync images deletions from rail back to slotConfigs
    useEffect(() => {
        setSlotConfigs(prev => {
            let changed = false;
            const updated = { ...prev };
            for (const slotId of Object.keys(updated)) {
                const cfg = updated[slotId];
                if (cfg?.image && !images.includes(cfg.image)) {
                    const { image, imageSrc, imageName, ...rest } = cfg;
                    updated[slotId] = rest;
                    changed = true;
                }
            }
            return changed ? updated : prev;
        });
    }, [images]);

    // CHARGEMENT DES POLICES GOOGLE FONTS
    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Caveat:wght@400;700&family=Courier+Prime:wght@400;700&family=Dancing+Script:wght@400;700&family=Inter:wght@300;400;600;800&family=Lato:wght@300;400;700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Montserrat:wght@300;400;600;800&family=Oswald:wght@400;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Shadows+Into+Light&family=Cinzel:wght@400;700&family=Prata&family=Nothing+You+Could+Do&family=Covered+By+Your+Grace&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => { document.head.removeChild(link); };
    }, []);

    // --- HOOKS: LAYOUT HELPERS ---
    const {
        addText, addAsset,
        updateActiveAsset, deleteActiveAsset,
        updateActiveText, deleteActiveText,
        getActiveText, getActiveAsset,
        updateSlotConfig, moveLayoutImage,
        currentText, currentAsset,
    } = useLayoutHelpers({
        texts, setTexts, assets, setAssets,
        activeTextId, setActiveTextId,
        activeAssetId, setActiveAssetId,
        selectedSlotIndex, setSelectedSlotIndex,
        slotConfigs, setSlotConfigs,
        images, setImages
    });

    // --- HOOKS: CANVAS EVENTS ---
    const { handlePointerDown, handlePointerMove, handlePointerUp } = useCanvasEvents({
        canvasRef, view, images,
        texts, setTexts, assets, setAssets,
        activeTextId, setActiveTextId,
        activeAssetId, setActiveAssetId,
        selectedSlotIndex, setSelectedSlotIndex,
        slotRects,
        isDragging, setIsDragging,
        isDraggingText, setIsDraggingText,
        isDraggingAsset, setIsDraggingAsset,
        activeGuides, setActiveGuides,
        lastMousePos, dragOffset, textMetrics,
        isCropping,
        setCropPos,
        setActiveAccordion,
    });

    // --- HOOKS: CANVAS RENDERER ---
    const { getCanvasDimensions, getPreviewCanvasDimensions, renderPipeline } = useCanvasRenderer({
        canvasRef, images, view,
        activeFormat, activeTemplate, overlayMode,
        padding, gap, customLayoutGap, radius,
        layoutBgColor, layoutBgBlur, layoutBgGradient, layoutBgMeshColors, layoutLumenBackground, layoutBgTexture, layoutSmoothBlur,
        layoutTextures, activeTextureId, layoutTextureOpacity,
        selectedSlotIndex, slotConfigs,
        slotRects, bgCanvasRef,
        texts, assets, activeTextId, activeAssetId,
        isDraggingText, activeGuides,
        cropRatio, cropPos, cropScale, isCropping,
        filters,
        isDragging, requestRef,
        setSlotRectsState,
    });


    const layoutHasGeneratedBackground = view === 'layout' && (layoutBgGradient || Boolean(layoutLumenBackground?.image) || layoutTextures.length > 0);
    const hasRenderableOutput = images.length > 0 || layoutHasGeneratedBackground || (view === 'layout' && activeTemplate.id === 'custom');

    // --- HOOKS: EXPORT ---
    const {
        exportName, setExportName,
        exportFormat, setExportFormat,
        isExportModalOpen, setIsExportModalOpen,
        exportQuality, setExportQuality,
        estimatedSize,
        handleDownload,
        performExport,
    } = useExport({ images, canvasRef, getCanvasDimensions, renderPipeline, activeFormat, canExport: hasRenderableOutput });

    const { handleImageUpload, handleReplaceImageUpload } = useImageUpload({
        images, setImages, view, setView,
        setIsProcessing, setLoadingProgress,
        setExportName
    });

    const handleSlotImageUpload = useCallback((e, slotId) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setLoadingStatus("Processing image...");
        setLoadingProgress(10);

        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            setLoadingProgress(50);
            setSelectedSlotIndex(slotId);
            img.isSlotSpecific = true;
            img.slotId = slotId;
            setSlotConfigs(prev => ({
                ...prev,
                [slotId]: {
                    ...(prev[slotId] || { zoom: 1, x: 0, y: 0, border: 0, blur: 0 }),
                    image: img,
                    imageSrc: objectUrl,
                    imageName: file.name
                }
            }));
            setImages(prev => [...prev, img]);
            setIsProcessing(false);
            setLoadingProgress(0);
        };

        img.onerror = () => {
            setIsProcessing(false);
            setLoadingProgress(0);
            alert("Erreur lors du chargement de l'image.");
        };

        img.src = objectUrl;
    }, [setSelectedSlotIndex, setSlotConfigs, setImages]);

    const handleRemoveSlotImage = useCallback((slotId) => {
        const config = slotConfigs[slotId];
        let imgToRemove = config?.image;

        // If not explicitly defined in config, resolve from images array by slotId/template structure
        if (!imgToRemove && images.length > 0) {
            if (activeTemplate?.id === 'custom') {
                const zones = activeTemplate.customLayout?.zones || [];
                const zoneIndex = zones.findIndex(z => z.id === slotId);
                if (zoneIndex !== -1) {
                    const zone = zones[zoneIndex];
                    const imgIndex = zone.imageIndex !== undefined ? zone.imageIndex : zoneIndex;
                    imgToRemove = images[imgIndex % images.length];
                }
            } else {
                // For standard templates, slotId is the numerical index of the slot
                const numericSlotId = parseInt(slotId, 10);
                if (!isNaN(numericSlotId)) {
                    imgToRemove = images[numericSlotId % images.length];
                } else {
                    // Fallback to first image
                    imgToRemove = images[0];
                }
            }
        }

        setSlotConfigs(prev => {
            const next = { ...prev };
            if (next[slotId]) {
                const { image, imageSrc, imageName, ...rest } = next[slotId];
                next[slotId] = rest;
            }
            return next;
        });

        if (imgToRemove) {
            setImages(prev => prev.filter(img => img !== imgToRemove));
        }
    }, [slotConfigs, images, activeTemplate, setImages]);

    const handleFullscreen = () => { if (canvasRef.current?.requestFullscreen) canvasRef.current.requestFullscreen(); };

    const handleUpdateCustomZone = useCallback((zoneId, patch) => {
        if (!zoneId) return;
        setActiveTemplate((previousTemplate) => {
            if (previousTemplate.id !== 'custom') return previousTemplate;
            const currentZones = previousTemplate.customLayout?.zones || [];
            const zoneToUpdate = currentZones.find(z => z.id === zoneId);
            if (!zoneToUpdate) return previousTemplate;

            const updatedZone = { ...zoneToUpdate, ...patch };

            // Clamp and constrain x, y, w, h to keep within [0, 1] bounds
            if ('w' in patch) {
                const targetW = Math.max(0.08, Math.min(1, patch.w));
                updatedZone.w = targetW;
                if (updatedZone.x + targetW > 1) {
                    updatedZone.x = Math.max(0, 1 - targetW);
                }
            }
            if ('h' in patch) {
                const targetH = Math.max(0.08, Math.min(1, patch.h));
                updatedZone.h = targetH;
                if (updatedZone.y + targetH > 1) {
                    updatedZone.y = Math.max(0, 1 - targetH);
                }
            }
            if ('x' in patch) {
                updatedZone.x = Math.max(0, Math.min(1 - updatedZone.w, patch.x));
            }
            if ('y' in patch) {
                updatedZone.y = Math.max(0, Math.min(1 - updatedZone.h, patch.y));
            }

            const homePatch = {
                homeX: updatedZone.x,
                homeY: updatedZone.y,
                homeW: updatedZone.w,
                homeH: updatedZone.h,
            };

            const zones = currentZones.map((zone) => (
                zone.id === zoneId ? { ...zone, ...updatedZone, ...homePatch, hidden: false } : zone
            ));
            return updateCustomTemplateZones(
                previousTemplate,
                normalizeCustomZones(zones, zoneId)
            );
        });
    }, []);

    const handleDeleteCustomZone = useCallback((zoneId) => {
        if (!zoneId) return;
        setActiveTemplate((previousTemplate) => {
            if (previousTemplate.id !== 'custom') return previousTemplate;
            const zones = (previousTemplate.customLayout?.zones || []).filter((zone) => zone.id !== zoneId);
            return updateCustomTemplateZones(previousTemplate, zones);
        });
        setSelectedSlotIndex((current) => (current === zoneId ? null : current));
        setSlotConfigs((previousConfigs) => {
            const nextConfigs = { ...previousConfigs };
            delete nextConfigs[zoneId];
            return nextConfigs;
        });
    }, []);

    const handleAddCustomZone = useCallback((shape, position = null) => {
        const zoneIndex = activeTemplate.customLayout?.zones?.length || 0;
        const createdZone = createCustomZone(shape, zoneIndex, position);
        const nextZone = {
            ...createdZone,
            homeX: createdZone.x,
            homeY: createdZone.y,
            homeW: createdZone.w,
            homeH: createdZone.h,
        };
        setActiveTemplate((previousTemplate) => {
            if (previousTemplate.id !== 'custom') return previousTemplate;
            const zones = [
                ...(previousTemplate.customLayout?.zones || []),
                nextZone,
            ];
            return updateCustomTemplateZones(
                {
                    ...previousTemplate,
                    customLayout: {
                        ...previousTemplate.customLayout,
                        presetId: 'manual',
                    },
                },
                normalizeCustomZones(zones, nextZone.id)
            );
        });
        setCustomEditMode(true);
        setSelectedSlotIndex(nextZone.id);
        setActiveTextId(null);
    }, [activeTemplate.customLayout?.zones?.length]);

    const renderFinalCanvas = useCallback(() => {
        const { width, height } = getCanvasDimensions();
        if (!width || !height) return null;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = width;
        exportCanvas.height = height;
        renderPipeline(exportCanvas, width, height, false, 'high');
        return { exportCanvas, width, height };
    }, [getCanvasDimensions, renderPipeline]);

    useEffect(() => {
        if (!visionCompareSplit.enabled || view !== 'vision-pro' || !images.length) {
            if (visionCompareSplit.beforeUrl) {
                setVisionCompareSplit(current => ({ ...current, beforeUrl: null }));
            }
            return;
        }

        const { width, height } = getPreviewCanvasDimensions();
        if (!width || !height) return;

        const beforeCanvas = document.createElement('canvas');
        beforeCanvas.width = width;
        beforeCanvas.height = height;
        renderPipeline(beforeCanvas, width, height, true, 'high', {
            filters: { ...filters, filterIntensity: 0 },
        });
        const beforeUrl = beforeCanvas.toDataURL('image/jpeg', 0.9);
        setVisionCompareSplit(current => current.beforeUrl === beforeUrl ? current : { ...current, beforeUrl });
    }, [filters, getPreviewCanvasDimensions, images.length, renderPipeline, view, visionCompareSplit.beforeUrl, visionCompareSplit.enabled]);

    useEffect(() => {
        if (view !== 'vision-pro' || !images.length || !canvasRef.current) {
            setVisionDiagnostics({ status: 'idle' });
            return undefined;
        }

        let cancelled = false;
        const frameId = window.requestAnimationFrame(() => {
            try {
                const diagnosticStart = getPerfNow();
                const { width, height } = getCanvasDimensions();
                const previewDimensions = getPreviewCanvasDimensions();
                if (!width || !height || !previewDimensions.width || !previewDimensions.height) {
                    if (!cancelled) setVisionDiagnostics({ status: 'empty' });
                    return;
                }

                const sourceCanvas = document.createElement('canvas');
                sourceCanvas.width = previewDimensions.width;
                sourceCanvas.height = previewDimensions.height;
                const sourceRenderStart = getPerfNow();
                renderPipeline(sourceCanvas, previewDimensions.width, previewDimensions.height, true, 'high', {
                    filters: { ...filters, filterIntensity: 0 },
                });
                const sourceRenderMs = getPerfNow() - sourceRenderStart;

                const sourceMeasureStart = getPerfNow();
                const sourceSnapshot = measureCanvasVisionSnapshot(sourceCanvas);
                const sourceMeasureMs = getPerfNow() - sourceMeasureStart;

                const renderedMeasureStart = getPerfNow();
                const renderedSnapshot = measureCanvasVisionSnapshot(canvasRef.current);
                const renderedMeasureMs = getPerfNow() - renderedMeasureStart;
                if (!sourceSnapshot?.metrics || !renderedSnapshot?.metrics) {
                    if (!cancelled) setVisionDiagnostics({ status: 'empty' });
                    return;
                }

                const sourceMetrics = sourceSnapshot.metrics;
                const renderedMetrics = renderedSnapshot.metrics;
                const delta = compareVisionMetrics(sourceMetrics, renderedMetrics);
                const performanceInfo = buildVisionPerformanceInfo({
                    width,
                    height,
                    previewWidth: previewDimensions.width,
                    previewHeight: previewDimensions.height,
                    previewScale: previewDimensions.scale,
                    isPreviewCapped: previewDimensions.capped,
                    sourceRenderMs,
                    sourceMeasureMs,
                    renderedMeasureMs,
                    totalMs: getPerfNow() - diagnosticStart,
                    sample: renderedSnapshot.sample,
                });
                if (!cancelled) {
                    setVisionDiagnostics({
                        status: 'ready',
                        source: sourceMetrics,
                        rendered: renderedMetrics,
                        delta,
                        performance: performanceInfo,
                        warnings: buildVisionDiagnosticWarnings(delta, performanceInfo),
                        updatedAt: Date.now(),
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    setVisionDiagnostics({
                        status: 'error',
                        message: error?.message || 'Diagnostic indisponible',
                    });
                }
            }
        });

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frameId);
        };
    }, [filters, getCanvasDimensions, getPreviewCanvasDimensions, images.length, renderPipeline, view]);

    useEffect(() => {
        if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return undefined;
        window.__vibefxVisionQualityProbe = () => {
            if (!images.length) return null;
            const fullDimensions = getCanvasDimensions();
            const previewDimensions = getPreviewCanvasDimensions();
            if (!fullDimensions.width || !fullDimensions.height || !previewDimensions.width || !previewDimensions.height) return null;

            const renderQualityCanvas = (quality) => {
                const probeCanvas = document.createElement('canvas');
                probeCanvas.width = previewDimensions.width;
                probeCanvas.height = previewDimensions.height;
                renderPipeline(probeCanvas, previewDimensions.width, previewDimensions.height, true, quality);
                return probeCanvas;
            };

            const highCanvas = renderQualityCanvas('high');
            const lowCanvas = renderQualityCanvas('low');
            const highSnapshot = measureCanvasVisionSnapshot(highCanvas);
            const lowSnapshot = measureCanvasVisionSnapshot(lowCanvas);
            if (!highSnapshot || !lowSnapshot) return null;

            return {
                width: previewDimensions.width,
                height: previewDimensions.height,
                fullWidth: fullDimensions.width,
                fullHeight: fullDimensions.height,
                previewWidth: previewDimensions.width,
                previewHeight: previewDimensions.height,
                previewScale: previewDimensions.scale,
                isPreviewCapped: previewDimensions.capped,
                high: highSnapshot.metrics,
                low: lowSnapshot.metrics,
                delta: compareVisionMetrics(highSnapshot.metrics, lowSnapshot.metrics),
            };
        };

        return () => {
            if (window.__vibefxVisionQualityProbe) delete window.__vibefxVisionQualityProbe;
        };
    }, [getCanvasDimensions, getPreviewCanvasDimensions, images.length, renderPipeline]);

    const handleImportPublication = useCallback(async (aiCaption = '') => {
        if (!hasRenderableOutput || typeof onImportToPublication !== 'function') return;
        const rendered = renderFinalCanvas();
        if (!rendered) return;

        const { exportCanvas, width, height } = rendered;
        const socialImages = await buildSocialImages(exportCanvas, activeFormat);
        const blob = await canvasToBlob(exportCanvas, 'image/png');
        onImportToPublication({
            source: 'vibefx-layout',
            name: exportName,
            mimeType: 'image/png',
            width,
            height,
            dataUrl: exportCanvas.toDataURL('image/png'),
            blob,
            socialImages,
            caption: aiCaption,
            format: activeFormat,
            template: activeTemplate,
            imagesCount: images.length,
            settings: {
                view,
                overlayMode,
                padding,
                gap,
                customLayoutGap,
                radius,
                layoutBgColor,
                layoutBgBlur,
                layoutBgTexture,
                layoutTextures: layoutTextures.map(texture => ({
                    id: texture.id,
                    src: texture.src,
                    name: texture.name,
                })),
                activeTextureId,
                layoutTextureOpacity,
                layoutBgGradient,
                layoutBgMeshColors,
                layoutLumenBackground: layoutLumenBackground ? {
                    src: layoutLumenBackground.src,
                    name: layoutLumenBackground.name,
                    width: layoutLumenBackground.width,
                    height: layoutLumenBackground.height,
                    aspect: layoutLumenBackground.aspect,
                    mode: layoutLumenBackground.mode,
                    styleName: layoutLumenBackground.styleName,
                    seed: layoutLumenBackground.seed,
                    designCode: layoutLumenBackground.designCode,
                } : null,
                layoutSmoothBlur,
                texts,
                assets,
                slotConfigs: serializeSlotConfigs(slotConfigs),
                filters,
            },
            createdAt: new Date().toISOString(),
        });
    }, [
        activeFormat,
        activeTemplate,
        activeTextureId,
        assets,
        customLayoutGap,
        exportName,
        filters,
        gap,
        hasRenderableOutput,
        images.length,
        layoutBgBlur,
        layoutBgColor,
        layoutBgGradient,
        layoutBgMeshColors,
        layoutLumenBackground,
        layoutBgTexture,
        layoutSmoothBlur,
        layoutTextureOpacity,
        layoutTextures,
        onImportToPublication,
        overlayMode,
        padding,
        radius,
        renderFinalCanvas,
        slotConfigs,
        texts,
        view,
    ]);

    const resetImages = () => {
        // Ne pas vider le tableau images pour garder l'image à l'écran
        // setImages([]); 
        setTexts([]);
        setLayoutTextures([]);
        setActiveTextureId(null);
        setLayoutTextureOpacity(70);
        setLayoutBgGradient(false);
        setLayoutBgMeshColors(DEFAULT_LAYOUT_MESH_COLORS);
        setLayoutLumenBackground(null);
        setActiveTextId(null);
        setFilters({ ...DEFAULT_FILTERS });
        setVisionCompareSplit({ enabled: false, position: 50, beforeUrl: null });

        // Réinitialiser les sélections de presets
        setActiveCategory(null);
        setSelectedBrand(null);

        // Réinitialiser le crop
        setCropPos({ x: 0, y: 0 });
        setCropScale(1.0);
        setIsCropping(false);
        setCropRatio('original');

    };

    const isDraggable = (view === 'studio' && isCropping) || (view === 'layout');

    const openLayoutAccordion = useCallback((accordion) => {
        setView('layout');
        setSelectedSlotIndex(null);
        setActiveTextId(null);
        setActiveAccordion(accordion);
    }, []);

    const applyLayoutMesh = useCallback((colors) => {
        const nextColors = colors?.length ? colors : DEFAULT_LAYOUT_MESH_COLORS;
        setLayoutBgMeshColors(nextColors);
        setLayoutBgGradient(true);
        setLayoutLumenBackground(null);
        setLayoutBgBlur(false);
        setLayoutBgColor(nextColors[0] || '#000000');
        openLayoutAccordion('background');
        setIsLayoutMeshPopupOpen(false);
    }, [openLayoutAccordion]);

    const applyLumenBackground = useCallback((payload) => {
        if (!payload?.dataUrl) return;
        const img = new window.Image();
        img.onload = () => {
            setLayoutLumenBackground({
                id: `lumen-${Date.now()}`,
                src: payload.dataUrl,
                name: payload.styleName || payload.mode || 'Lumen shader',
                image: img,
                width: payload.width || img.width,
                height: payload.height || img.height,
                aspect: payload.aspect || (img.width / Math.max(1, img.height)),
                mode: payload.mode,
                styleName: payload.styleName,
                seed: payload.seed,
                designCode: payload.designCode,
                createdAt: new Date().toISOString(),
            });
            setLayoutBgGradient(false);
            setLayoutBgBlur(false);
            setLayoutBgColor('#000000');
            setView('layout');
            openLayoutAccordion('background');
            setIsLumenShaderOpen(false);
        };
        img.src = payload.dataUrl;
    }, [openLayoutAccordion]);

    const handleAssetImport = useCallback((imageUrl, type) => {
        // Build a list of URLs to try in order of priority
        const urlsToTry = [];

        // 1. If it's already a local /api/ URL, try it first
        if (imageUrl.startsWith('/api/')) {
            urlsToTry.push(imageUrl);
        }

        // 2. If it's a CDN URL, proxy it through our server
        if (imageUrl.includes('cdn.midjourney.com') || imageUrl.includes('midjourney.com')) {
            urlsToTry.push(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`);
            // Also try .png variant if URL ends with .webp
            if (imageUrl.includes('.webp')) {
                urlsToTry.push(`/api/proxy-image?url=${encodeURIComponent(imageUrl.replace('.webp', '.png'))}`);
            }
        }

        // 3. If we have the raw URL and it's not already queued
        if (!imageUrl.startsWith('/api/') && !imageUrl.includes('midjourney.com')) {
            urlsToTry.push(imageUrl);
        }

        let currentIndex = 0;

        const tryNext = () => {
            if (currentIndex >= urlsToTry.length) {
                console.error("All import URLs failed for:", imageUrl);
                alert("L'image n'a pas pu être importée. Essayez de rafraîchir la page.");
                return;
            }

            const url = urlsToTry[currentIndex];
            currentIndex++;

            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                if (type === 'background') {
                    setImages([img]);
                    setView('studio');
                } else if (type === 'overlay') {
                    setView('studio');
                } else if (type === 'slot') {
                    setImages(prev => [...prev, img]);
                    setView('layout');
                } else if (type === 'texture') {
                    const textureId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    setLayoutTextures(prev => [
                        ...prev,
                        {
                            id: textureId,
                            image: img,
                            src: img.src,
                            name: `Texture ${prev.length + 1}`,
                        },
                    ]);
                    setActiveTextureId(textureId);
                    setActiveAccordion('texture');
                    setView('layout');
                }
            };
            img.onerror = () => {
                console.warn(`Import attempt failed (${currentIndex}/${urlsToTry.length}):`, url);
                tryNext();
            };

            // Add cache-buster to avoid stale CORS cache
            const separator = url.includes('?') ? '&' : '?';
            img.src = `${url}${separator}vibe_cache=${Date.now()}`;
        };

        tryNext();
    }, [setImages, setView, setLayoutTextures, setActiveTextureId, setActiveAccordion]);

    const handleUseSoundtrackInVideo = useCallback((track, fileOrBlob) => {
        if (!track || !fileOrBlob) return;
        const url = URL.createObjectURL(fileOrBlob);
        const id = `soundtrack-${track.id}-${Date.now()}`;
        const videoRightsStatus = track.rightsStatus === 'verified-free'
            ? 'credit-required'
            : track.rightsStatus === 'needs-review'
                ? 'review'
                : track.rightsStatus;
        useVideoStore.getState().addAudioTrack({
            id,
            name: track.title,
            file: fileOrBlob,
            url,
            duration: track.duration || 10,
            startTime: useVideoStore.getState().currentTime || 0,
            source: 'soundtrack-local',
            provider: track.provider,
            sourceName: track.sourceName,
            sourceUrl: track.sourceUrl,
            license: track.license,
            licenseUrl: track.licenseUrl,
            attribution: track.attribution,
            rightsStatus: videoRightsStatus,
            commercialUse: track.commercialUse === true,
            socialUse: track.socialUse === true,
            contentIdWarning: track.contentIdWarning,
            licenseSnapshotVersion: track.licenseSnapshotVersion,
            acquiredAt: track.addedAt || new Date().toISOString(),
            waveform: track.waveform || { status: 'pending', peaks: [] },
            rightsManifest: buildTrackRightsManifest({ ...track, id, rightsStatus: videoRightsStatus }),
        });
        /*
         * PHASE 7: on NAVIGUE vers le nouveau front au lieu de changer de vue.
         *
         * `router.push` et non `window.location`: la navigation reste cote
         * client, donc le module Zustand survit - et la piste qu'on vient
         * d'ajouter au store juste au-dessus est bien la a l'arrivee. Un
         * rechargement complet de la page la perdrait.
         */
        router.push('/video/rapide');
    }, [router]);

    // --- COMPARE MODAL RENDERING ---
    useEffect(() => {
        if (isCompareModalOpen && modalBeforeRef.current && modalAfterRef.current && canvasRef.current && images.length > 0) {
            const { width, height } = getCanvasDimensions();
            if (!width || !height) return;

            // AFTER: render full-resolution result, even when the interactive preview is capped.
            modalAfterRef.current.width = width;
            modalAfterRef.current.height = height;
            renderPipeline(modalAfterRef.current, width, height, false, 'high');

            // BEFORE: Draw original first image at its native resolution to avoid stretching
            const img = images[0];
            modalBeforeRef.current.width = img.width;
            modalBeforeRef.current.height = img.height;
            const ctxB = modalBeforeRef.current.getContext('2d');
            ctxB.drawImage(img, 0, 0);
        }
    }, [isCompareModalOpen, images, getCanvasDimensions, renderPipeline]);

    const aiContext = useMemo(() => ({
        view,
        hasImage: images.length > 0,
        hasVideo: false,
        imageCount: images.length,
        activeFormat,
        activeTemplate,
        canvasReady: Boolean(canvasRef.current),
        timelineReady: false,
    }), [activeFormat, activeTemplate, images.length, view]);

    const aiMutators = useMemo(() => ({
        setTexts,
        setActiveTextId,
        setView,
        onSendToPublication: (caption) => handleImportPublication(caption),
    }), [handleImportPublication, setActiveTextId, setTexts, setView]);

    const activeConfig = selectedSlotIndex !== null ? (slotConfigs[selectedSlotIndex] || { zoom: 1, x: 0, y: 0, border: 0, blur: 0 }) : null;

    /*
     * PHASE 7 (2026-08-01): la vue 'video' n'existe plus ici. L'editeur video a
     * ses propres routes sous `/video`, et `/studio?workspace=video` y redirige
     * cote serveur (src/app/studio/page.js).
     */

    return (
        <div className={`min-h-screen flex flex-col h-screen overflow-hidden font-sans transition-colors duration-300 ${isDarkMode ? 'bg-black text-gray-300 selection:bg-indigo-900 selection:text-white' : 'bg-gray-50 text-gray-900 selection:bg-indigo-200 selection:text-indigo-900'}`}>
            <Header
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
                view={view}
                setView={setView}
                hasImages={hasRenderableOutput}
                onReset={resetImages}
                onExport={handleDownload}
                onImportPublication={typeof onImportToPublication === 'function' ? handleImportPublication : null}
                onOpenPublications={onOpenPublications}
                isAiRailOpen={aiInterfacesEnabled && isAiRailOpen}
                onToggleAiRail={aiInterfacesEnabled ? () => setIsAiRailOpen(current => !current) : null}
                aiInterfacesEnabled={aiInterfacesEnabled}
                soundtrack={soundtrack}
                onOpenSoundtrack={() => setView('soundtrack')}
            />

            <main className="flex-1 w-full flex overflow-hidden bg-grid-pattern">
                {view === 'library' ? (
                    <AssetLibrary
                        isDarkMode={isDarkMode}
                        onUseAsset={handleAssetImport}
                    />
                ) : view === 'soundtrack' ? (
                    <SoundtrackPage controller={soundtrack} onUseInVideo={handleUseSoundtrackInVideo} />
                ) : (
                    <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                        {/* CANVAS AREA */}
                        <CanvasWorkspace
                            isDarkMode={isDarkMode}
                            isDraggable={isDraggable}
                            canvasContainerRef={canvasContainerRef}
                            canvasRef={canvasRef}
                            images={images}
                            view={view}
                            isProcessing={isProcessing}
                            loadingStatus={loadingStatus}
                            loadingProgress={loadingProgress}
                            onOpenLibrarySelector={aiInterfacesEnabled ? () => {
                                setIsLibraryModalOpen(true);
                            } : null}
                            handlePointerDown={handlePointerDown}
                            handlePointerMove={handlePointerMove}
                            handlePointerUp={handlePointerUp}
                            handleImageUpload={handleImageUpload}
                            handleSlotImageUpload={handleSlotImageUpload}
                            handleReplaceImageUpload={handleReplaceImageUpload}
                            handleRemoveSlotImage={handleRemoveSlotImage}
                            handleFullscreen={handleFullscreen}
                            onCompareOpen={() => setIsCompareModalOpen(true)}
                            onInstaPreview={() => { setInstaPreviewUrl(canvasRef.current.toDataURL()); setIsInstaPreviewOpen(true); }}
                            selectedSlotIndex={selectedSlotIndex}
                            setSelectedSlotIndex={setSelectedSlotIndex}
                            activeTextId={activeTextId}
                            activeTemplate={activeTemplate}
                            isDraggingText={isDraggingText}
                            isCropping={isCropping}
                            setImages={setImages}
                            activeFormat={activeFormat}
                            showGuidelines={showGuidelines}
                            visionCompareSplit={visionCompareSplit}
                            customEditMode={customEditMode}
                            onAddCustomZone={handleAddCustomZone}
                            onDeleteCustomZone={handleDeleteCustomZone}
                            layoutHasGeneratedBackground={layoutHasGeneratedBackground}
                            slotRectsState={slotRectsState}
                            layoutQuickActions={{
                                layoutBgBlur,
                                layoutBgGradient,
                                layoutLumenBackground: Boolean(layoutLumenBackground?.image),
                                smoothBlurEnabled: Boolean(layoutSmoothBlur?.enabled),
                                activeAccordion,
                                onOpenMesh: () => setIsLayoutMeshPopupOpen(true),
                                onOpenLumen: () => setIsLumenShaderOpen(true),
                                onOpenSmoothBlur: () => setIsLayoutSmoothBlurPopupOpen(true),
                                onToggleBgBlur: () => {
                                    setLayoutBgBlur(current => !current);
                                    openLayoutAccordion('background');
                                },
                                onOpenAccordion: openLayoutAccordion,
                            }}
                            undo={undo}
                            redo={redo}
                            canUndo={historyIndex > 0}
                            canRedo={historyIndex < history.length - 1}
                            texts={texts}
                            assets={assets}
                        />

                        {/* SIDEBAR */}
                        <div className={`lg:col-span-4 flex flex-col h-full border-l backdrop-blur-md overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-black/80 border-neutral-800' : 'bg-white border-gray-200'}`}>

                            {/* VIEW: STUDIO */}
                            {view === 'studio' && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 relative">
                                    <StylePanel
                                        isDarkMode={isDarkMode}
                                        activeCategory={activeCategory}
                                        setActiveCategory={setActiveCategory}
                                        filters={filters}
                                        setFilters={setFilters}
                                        images={images}
                                    />
                                </div>
                            )}

                            {/* VIEW: LAYOUT */}
                            {view === 'layout' && (
                                <LayoutSidebar
                                    images={images}
                                    setImages={setImages}
                                    isDarkMode={isDarkMode}
                                    selectedSlotIndex={selectedSlotIndex}
                                    setSelectedSlotIndex={setSelectedSlotIndex}
                                    activeConfig={activeConfig}
                                    updateSlotConfig={updateSlotConfig}
                                    activeFormat={activeFormat}
                                    setActiveFormat={setActiveFormat}
                                    activeTemplate={activeTemplate}
                                    setActiveTemplate={setActiveTemplate}
                                    setActiveTextId={setActiveTextId}
                                    overlayMode={overlayMode}
                                    setOverlayMode={setOverlayMode}
                                    activeAccordion={activeAccordion}
                                    setActiveAccordion={setActiveAccordion}
                                    addText={addText}
                                    addAsset={addAsset}
                                    currentText={currentText}
                                    currentAsset={currentAsset}
                                    updateActiveText={updateActiveText}
                                    deleteActiveText={deleteActiveText}
                                    setTexts={setTexts}
                                    setActiveAssetId={setActiveAssetId}
                                    deleteActiveAsset={deleteActiveAsset}
                                    activeAssetId={activeAssetId}
                                    setAssets={setAssets}
                                    assets={assets}
                                    padding={padding}
                                    setPadding={setPadding}
                                    gap={gap}
                                    setGap={setGap}
                                    customLayoutGap={customLayoutGap}
                                    setCustomLayoutGap={setCustomLayoutGap}
                                    radius={radius}
                                    setRadius={setRadius}
                                    layoutBgBlur={layoutBgBlur}
                                    setLayoutBgBlur={setLayoutBgBlur}
                                    layoutBgColor={layoutBgColor}
                                    setLayoutBgColor={setLayoutBgColor}
                                    layoutBgTexture={layoutBgTexture}
                                    setLayoutBgTexture={setLayoutBgTexture}
                                    layoutTextures={layoutTextures}
                                    activeTextureId={activeTextureId}
                                    setActiveTextureId={setActiveTextureId}
                                    setLayoutTextures={setLayoutTextures}
                                    layoutTextureOpacity={layoutTextureOpacity}
                                    setLayoutTextureOpacity={setLayoutTextureOpacity}
                                    layoutSmoothBlur={layoutSmoothBlur}
                                    setLayoutSmoothBlur={setLayoutSmoothBlur}
                                    showGuidelines={showGuidelines}
                                    setShowGuidelines={setShowGuidelines}
                                    layoutLumenBackground={layoutLumenBackground}
                                    onOpenLumenBackground={() => setIsLumenShaderOpen(true)}
                                    onClearLumenBackground={() => setLayoutLumenBackground(null)}
                                    customEditMode={customEditMode}
                                    setCustomEditMode={setCustomEditMode}
                                    onUpdateCustomZone={handleUpdateCustomZone}
                                    onDeleteCustomZone={handleDeleteCustomZone}
                                    onAddCustomZone={handleAddCustomZone}
                                />
                            )}

                            {/* VIEW: VISION PRO */}
                            {view === 'vision-pro' && (
                                <VisionPanel
                                    isDarkMode={isDarkMode}
                                    selectedBrand={selectedBrand}
                                    setSelectedBrand={setSelectedBrand}
                                    images={images}
                                    filters={filters}
                                    setFilters={setFilters}
                                    visionCompareSplit={visionCompareSplit}
                                    setVisionCompareSplit={setVisionCompareSplit}
                                    visionDiagnostics={visionDiagnostics}
                                />
                            )}
                        </div>
                    </div>
                )}


                {/* MODALS */}
                <CompareModal
                    isDarkMode={isDarkMode}
                    isOpen={isCompareModalOpen}
                    onClose={() => setIsCompareModalOpen(false)}
                    modalBeforeRef={modalBeforeRef}
                    modalAfterRef={modalAfterRef}
                />
                <InstaPreviewModal
                    isDarkMode={isDarkMode}
                    isOpen={isInstaPreviewOpen}
                    previewUrl={instaPreviewUrl}
                    onClose={() => setIsInstaPreviewOpen(false)}
                    activeFormat={activeFormat}
                />
                <MeshGradientPro
                    isOpen={isLayoutMeshPopupOpen}
                    onClose={() => setIsLayoutMeshPopupOpen(false)}
                    isDarkMode={isDarkMode}
                    initialColors={layoutBgMeshColors}
                    onApply={applyLayoutMesh}
                />
                {isLayoutSmoothBlurPopupOpen ? (
                    <SmoothBlurPopup
                        images={images}
                        isOpen={isLayoutSmoothBlurPopupOpen}
                        onClose={() => setIsLayoutSmoothBlurPopupOpen(false)}
                        isDarkMode={isDarkMode}
                        initialConfig={layoutSmoothBlur}
                        previewCanvasRef={canvasRef}
                        onApply={(newConfig) => {
                            setLayoutSmoothBlur(newConfig);
                            openLayoutAccordion('background');
                        }}
                    />
                ) : null}
                <LumenShaderModal
                    isOpen={isLumenShaderOpen}
                    onClose={() => setIsLumenShaderOpen(false)}
                    onUseBackground={applyLumenBackground}
                />
                {aiInterfacesEnabled && <AssetLibraryModal
                    isDarkMode={isDarkMode}
                    isOpen={isLibraryModalOpen}
                    onClose={() => setIsLibraryModalOpen(false)}
                    onSelect={async (asset) => {
                        if (!asset || !asset.src) return;

                        try {
                            const response = await fetch(asset.src);
                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);

                            const img = new Image();
                            img.onload = () => {
                                // URL.revokeObjectURL(blobUrl);
                                setImages(prev => [...prev, img]);
                            };
                            img.onerror = () => {
                                // URL.revokeObjectURL(blobUrl);
                                console.error("Canvas image load failed");
                            };
                            img.src = blobUrl;

                        } catch (e) {
                            console.error("Fetch proxy fallback:", e);
                            const img = new Image();
                            img.crossOrigin = "anonymous";
                            img.onload = () => {
                                setImages(prev => [...prev, img]);
                            };
                            img.src = asset.src;
                        }
                    }}
                />}
                <ExportModal
                    isDarkMode={isDarkMode}
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    exportName={exportName}
                    setExportName={setExportName}
                    exportFormat={exportFormat}
                    setExportFormat={setExportFormat}
                    exportQuality={exportQuality}
                    setExportQuality={setExportQuality}
                    estimatedSize={estimatedSize}
                    onExport={performExport}
                />
            </main>
            {aiInterfacesEnabled && (
                <StudioAiRail
                    open={isAiRailOpen}
                    onClose={() => setIsAiRailOpen(false)}
                    view={view}
                    context={aiContext}
                    mutators={aiMutators}
                />
            )}
        </div>
    );
}

export default App;
