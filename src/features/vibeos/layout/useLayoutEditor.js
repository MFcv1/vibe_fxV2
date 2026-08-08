"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLayoutState } from '../../vibefx-studio/hooks/useLayoutState';
import useLayoutHelpers from '../../vibefx-studio/hooks/useLayoutHelpers';
import useCanvasRenderer from '../../vibefx-studio/hooks/useCanvasRenderer';
import useCanvasEvents from '../../vibefx-studio/hooks/useCanvasEvents';
import useImageUpload from '../../vibefx-studio/hooks/useImageUpload';
import useExport from '../../vibefx-studio/hooks/useExport';
import { DEFAULT_CUSTOM_LAYOUT_GAP, DEFAULT_CUSTOM_TEMPLATE, FORMATS, TEMPLATES } from '../../vibefx-studio/data/constants';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';

/*
 * Composition des moteurs EXISTANTS de vibefx-studio pour l'ecran Layout VibeOS
 * (plan §4.2: la logique metier est importee, jamais reecrite). Ce hook ne
 * contient que de l'orchestration: le pipeline de rendu, les evenements canvas,
 * l'upload et l'export sont exactement ceux de l'ancien onglet Layout - c'est
 * ce qui garantit la parite d'export au pixel pres.
 */

const THUMBNAIL_WIDTH = 256;
const THUMBNAIL_DEBOUNCE_MS = 1500;

const mapTextsWithIds = (texts = []) => {
    const stamp = Date.now();
    return texts.map((text, index) => ({ id: stamp + index, ...text }));
};

export default function useLayoutEditor() {
    const { project, updateProject, ensureProject } = useVibeOsProject();

    /* ---- Etat layout de l'ancien moteur, tel quel ---- */
    const layoutState = useLayoutState();
    const {
        activeFormat, setActiveFormat,
        activeTemplate, setActiveTemplate,
        overlayMode, setOverlayMode,
        texts, setTexts,
        assets, setAssets,
        activeTextId, setActiveTextId,
        activeAssetId, setActiveAssetId,
        padding, setPadding,
        gap, setGap,
        radius, setRadius,
        layoutBgColor, setLayoutBgColor,
        layoutBgBlur, setLayoutBgBlur,
        layoutBgTexture, setLayoutBgTexture,
        selectedSlotIndex, setSelectedSlotIndex,
        slotConfigs, setSlotConfigs,
    } = layoutState;

    /* L'ancien useLayoutState demarre avec un texte "Vibe_fx" de demonstration:
       le nouvel ecran demarre propre. */
    const didClearDemoText = useRef(false);
    useEffect(() => {
        if (didClearDemoText.current) return;
        didClearDemoText.current = true;
        setTexts([]);
    }, [setTexts]);

    /* ---- Etat complementaire (meme forme que VibeFxStudio.jsx) ---- */
    const [images, setImages] = useState([]);
    const [customLayoutGap, setCustomLayoutGap] = useState(DEFAULT_CUSTOM_LAYOUT_GAP);
    const [layoutBgGradient] = useState(false);
    const [layoutBgMeshColors] = useState(['#6366f1', '#a855f7', '#ec4899', '#050505']);
    const [layoutLumenBackground] = useState(null);
    const [layoutSmoothBlur] = useState(null);
    const [layoutTextures] = useState([]);
    const [activeTextureId] = useState(null);
    const [layoutTextureOpacity] = useState(60);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);

    /* Drag + interactions canvas */
    const [isDragging, setIsDragging] = useState(false);
    const [isDraggingText, setIsDraggingText] = useState(false);
    const [isDraggingAsset, setIsDraggingAsset] = useState(false);
    const [activeGuides, setActiveGuides] = useState([]);

    const canvasRef = useRef(null);
    const bgCanvasRef = useRef(null);
    const slotRects = useRef([]);
    const requestRef = useRef(null);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragOffset = useRef({ x: 0, y: 0 });
    const textMetrics = useRef({ w: 0, h: 0 });

    /* ---- Moteurs branches ---- */
    const { getCanvasDimensions, renderPipeline } = useCanvasRenderer({
        canvasRef, images, view: 'layout',
        activeFormat, activeTemplate, overlayMode,
        padding, gap, customLayoutGap, radius,
        layoutBgColor, layoutBgBlur, layoutBgGradient, layoutBgMeshColors, layoutLumenBackground, layoutBgTexture, layoutSmoothBlur,
        layoutTextures, activeTextureId, layoutTextureOpacity,
        selectedSlotIndex, slotConfigs,
        slotRects, bgCanvasRef,
        texts, assets, activeTextId, activeAssetId,
        isDraggingText, activeGuides,
        cropRatio: 'original', cropPos: { x: 0, y: 0 }, cropScale: 1, isCropping: false,
        filters: {},
        isDragging, requestRef,
        setSlotRectsState: null,
    });

    const { handlePointerDown, handlePointerMove, handlePointerUp } = useCanvasEvents({
        canvasRef, view: 'layout', images,
        texts, setTexts, assets, setAssets,
        activeTextId, setActiveTextId,
        activeAssetId, setActiveAssetId,
        selectedSlotIndex, setSelectedSlotIndex,
        slotRects,
        setActiveAccordion: null,
        isDragging, setIsDragging,
        isDraggingText, setIsDraggingText,
        isDraggingAsset, setIsDraggingAsset,
        activeGuides, setActiveGuides,
        lastMousePos, dragOffset, textMetrics,
        isCropping: false,
        setCropPos: () => {},
    });

    const helpers = useLayoutHelpers({
        texts, setTexts,
        assets, setAssets,
        activeTextId, setActiveTextId,
        activeAssetId, setActiveAssetId,
        selectedSlotIndex, setSelectedSlotIndex,
        slotConfigs, setSlotConfigs,
        images, setImages,
    });

    const exportController = useExport({
        images, canvasRef, getCanvasDimensions, renderPipeline, activeFormat,
        canExport: images.length > 0
            || activeTemplate.id === 'custom'
            || texts.length > 0
            || assets.length > 0,
    });
    const { setExportName } = exportController;

    const { handleImageUpload, handleReplaceImageUpload } = useImageUpload({
        images, setImages, view: 'layout', setView: () => {},
        setIsProcessing, setLoadingProgress,
        setExportName,
    });

    /* Import par slot - meme logique que VibeFxStudio.handleSlotImageUpload. */
    const handleSlotImageUpload = useCallback((event, slotId) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsProcessing(true);
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            setSelectedSlotIndex(slotId);
            img.isSlotSpecific = true;
            img.slotId = slotId;
            setSlotConfigs((prev) => ({
                ...prev,
                [slotId]: {
                    ...(prev[slotId] || { zoom: 1, x: 0, y: 0, border: 0, blur: 0 }),
                    image: img,
                    imageSrc: objectUrl,
                    imageName: file.name,
                },
            }));
            setImages((prev) => [...prev, img]);
            setIsProcessing(false);
        };
        img.onerror = () => setIsProcessing(false);
        img.src = objectUrl;
        event.target.value = '';
    }, [setSelectedSlotIndex, setSlotConfigs]);

    const handleRemoveImage = useCallback((index) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    }, []);

    /* ---- Application de templates ---- */

    const applyCustomPreset = useCallback((preset) => {
        setActiveTemplate({
            ...DEFAULT_CUSTOM_TEMPLATE,
            label: preset.label,
            slots: preset.zones.length,
            customLayout: { version: 1, presetId: preset.id, zones: preset.zones },
        });
        setSelectedSlotIndex(null);
        setActiveTextId(null);
    }, [setActiveTemplate, setSelectedSlotIndex, setActiveTextId]);

    /* Meme sequence que LayoutSidebar.applyThemedTemplate (orchestration UI). */
    const applyThemedTemplate = useCallback((themedTpl) => {
        if (themedTpl.formatId) {
            const fmt = FORMATS.find((f) => f.id === themedTpl.formatId);
            if (fmt) setActiveFormat(fmt);
        }
        if (themedTpl.zones) {
            setActiveTemplate({
                ...DEFAULT_CUSTOM_TEMPLATE,
                label: themedTpl.label,
                slots: themedTpl.zones.length,
                customLayout: { version: 1, presetId: themedTpl.id, zones: themedTpl.zones },
            });
        } else {
            const base = TEMPLATES.find((t) => t.id === (themedTpl.baseTemplateId || 'minimal'));
            setActiveTemplate(base || TEMPLATES[0]);
        }
        const layout = themedTpl.layout || {};
        if (layout.padding !== undefined) setPadding(layout.padding);
        if (layout.gap !== undefined) setGap(layout.gap);
        if (layout.radius !== undefined) setRadius(layout.radius);
        if (layout.customLayoutGap !== undefined) setCustomLayoutGap(layout.customLayoutGap);
        if (layout.bgColor !== undefined) setLayoutBgColor(layout.bgColor);
        if (layout.bgBlur !== undefined) setLayoutBgBlur(layout.bgBlur);
        if (layout.bgTexture !== undefined) setLayoutBgTexture(layout.bgTexture);
        setTexts(mapTextsWithIds(themedTpl.texts));
        setSelectedSlotIndex(null);
        setActiveTextId(null);
    }, [setActiveFormat, setActiveTemplate, setPadding, setGap, setRadius, setLayoutBgColor, setLayoutBgBlur, setLayoutBgTexture, setTexts, setSelectedSlotIndex, setActiveTextId]);

    /* ---- Modele des slots pour le bloc Images ---- */
    const slotModel = useMemo(() => {
        if (activeTemplate.id === 'custom') {
            const zones = (activeTemplate.customLayout?.zones || []).filter((zone) => !zone.hidden);
            return zones.map((zone, index) => {
                const config = slotConfigs[zone.id];
                const imgIndex = zone.imageIndex !== undefined ? zone.imageIndex : index;
                const fallback = images.length > 0 ? images[imgIndex % images.length] : null;
                return {
                    id: zone.id,
                    label: zone.label || `Zone ${index + 1}`,
                    imageSrc: config?.imageSrc || (config?.image || fallback)?.src || null,
                };
            });
        }
        const count = activeTemplate.slots || 1;
        return Array.from({ length: count }, (_, index) => {
            const config = slotConfigs[index];
            const fallback = images.length > 0 ? images[index % images.length] : null;
            return {
                id: index,
                label: `Image ${index + 1}`,
                imageSrc: config?.imageSrc || (config?.image || fallback)?.src || null,
            };
        });
    }, [activeTemplate, slotConfigs, images]);

    const hasRenderableOutput = images.length > 0
        || activeTemplate.id === 'custom'
        || texts.length > 0
        || assets.length > 0;

    /* ---- Projet commun: garantir un projet + synchroniser les metadonnees ---- */
    useEffect(() => {
        ensureProject();
        /* Une seule fois a l'entree de l'ecran. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* Vignette 256px + metadonnees legeres, debounce pour ne pas re-rendre en boucle.
       Les images elles-memes (Blobs IndexedDB) arrivent a la tranche B2. */
    const thumbnailTimer = useRef(null);
    useEffect(() => {
        if (!project || !hasRenderableOutput) return undefined;
        if (thumbnailTimer.current) clearTimeout(thumbnailTimer.current);
        thumbnailTimer.current = setTimeout(() => {
            thumbnailTimer.current = null;
            try {
                const { width, height } = getCanvasDimensions();
                if (!width || !height) return;
                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = THUMBNAIL_WIDTH;
                thumbCanvas.height = Math.max(1, Math.round((THUMBNAIL_WIDTH * height) / width));
                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = width;
                fullCanvas.height = height;
                renderPipeline(fullCanvas, width, height, false, 'low');
                thumbCanvas.getContext('2d').drawImage(fullCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
                updateProject({
                    format: activeFormat.id,
                    template: activeTemplate.id === 'custom'
                        ? { id: 'custom', presetId: activeTemplate.customLayout?.presetId }
                        : activeTemplate.id,
                    geometry: { padding, gap, radius, customLayoutGap },
                    thumbnail: thumbCanvas.toDataURL('image/jpeg', 0.7),
                });
            } catch {
                /* Vignette non bloquante. */
            }
        }, THUMBNAIL_DEBOUNCE_MS);
        return () => {
            if (thumbnailTimer.current) clearTimeout(thumbnailTimer.current);
        };
        /* project omis volontairement: la vignette repond aux changements d'edition,
           pas aux reecritures du store qu'elle provoque elle-meme. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images, activeFormat, activeTemplate, padding, gap, radius, customLayoutGap,
        layoutBgColor, layoutBgBlur, layoutBgTexture, texts, assets, slotConfigs, hasRenderableOutput]);

    return {
        /* etat */
        ...layoutState,
        images, setImages,
        customLayoutGap, setCustomLayoutGap,
        isProcessing, loadingProgress,
        slotModel, hasRenderableOutput,
        /* refs + events canvas */
        canvasRef,
        handlePointerDown, handlePointerMove, handlePointerUp,
        /* helpers */
        ...helpers,
        /* imports */
        handleImageUpload, handleReplaceImageUpload, handleSlotImageUpload, handleRemoveImage,
        /* templates */
        applyCustomPreset, applyThemedTemplate,
        /* export */
        exportController,
    };
}
