"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLayoutState } from '../../vibefx-studio/hooks/useLayoutState';
import useLayoutHelpers from '../../vibefx-studio/hooks/useLayoutHelpers';
import useCanvasRenderer from '../../vibefx-studio/hooks/useCanvasRenderer';
import useCanvasEvents from '../../vibefx-studio/hooks/useCanvasEvents';
import useImageUpload from '../../vibefx-studio/hooks/useImageUpload';
import useExport from '../../vibefx-studio/hooks/useExport';
import { DEFAULT_CUSTOM_LAYOUT_GAP, DEFAULT_CUSTOM_TEMPLATE, FORMATS, TEMPLATES } from '../../vibefx-studio/data/constants';
import {
    createCustomZone, normalizeCustomZones, updateCustomTemplateZones,
} from '../../vibefx-studio/utils/customLayout';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';
import { canvasToBlob } from '../project/pipeline';
import { hasStoredComposition, restoreComposition, snapshotComposition } from './layoutPersistence';

/*
 * Composition des moteurs EXISTANTS de vibefx-studio pour l'ecran Layout VibeOS
 * (plan §4.2: la logique metier est importee, jamais reecrite). Ce hook ne
 * contient que de l'orchestration: le pipeline de rendu, les evenements canvas,
 * l'upload et l'export sont exactement ceux de l'ancien onglet Layout - c'est
 * ce qui garantit la parite d'export au pixel pres.
 */

const THUMBNAIL_WIDTH = 256;
const PERSIST_DEBOUNCE_MS = 1500;
const HISTORY_LIMIT = 30;
const DEFAULT_LAYOUT_MESH_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#050505'];
/* Meme etat initial que VibeFxStudio.jsx (parite de comportement). */
const DEFAULT_SMOOTH_BLUR_STATE = {
    enabled: false,
    direction: 'down',
    height: 54,
    precision: 35,
    blur: 64,
    preset: 'linear',
    easeType: 'in',
    reverse: false,
};

const mapTextsWithIds = (texts = []) => {
    const stamp = Date.now();
    return texts.map((text, index) => ({ id: stamp + index, ...text }));
};

export default function useLayoutEditor() {
    const { project, status, updateProject, ensureProject } = useVibeOsProject();

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
    const [layoutBgGradient, setLayoutBgGradient] = useState(false);
    const [layoutBgMeshColors, setLayoutBgMeshColors] = useState(DEFAULT_LAYOUT_MESH_COLORS);
    const [layoutLumenBackground, setLayoutLumenBackground] = useState(null);
    const [layoutSmoothBlur, setLayoutSmoothBlur] = useState({ ...DEFAULT_SMOOTH_BLUR_STATE });
    const [layoutTextures, setLayoutTextures] = useState([]);
    const [activeTextureId, setActiveTextureId] = useState(null);
    const [layoutTextureOpacity, setLayoutTextureOpacity] = useState(60);
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

    /* Retire l'image d'une zone sans toucher aux autres (miroir de
       VibeFxStudio.handleRemoveSlotImage, version zone-only). */
    const handleRemoveSlotImage = useCallback((slotId) => {
        setSlotConfigs((prev) => {
            if (!prev[slotId]) return prev;
            const config = { ...prev[slotId] };
            delete config.image;
            delete config.imageSrc;
            delete config.imageName;
            return { ...prev, [slotId]: config };
        });
    }, [setSlotConfigs]);

    /* ---- Textures du fond (moteur renderLayoutImageTexture, inchange) ---- */

    const handleTextureUpload = useCallback((event) => {
        const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
        if (!files.length) return;
        files.forEach((file, index) => {
            const img = new window.Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                const textureId = `texture-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
                setLayoutTextures((prev) => [
                    ...prev,
                    { id: textureId, image: img, src: objectUrl, name: file.name || `Texture ${prev.length + 1}` },
                ]);
                setActiveTextureId(textureId);
            };
            img.src = objectUrl;
        });
        event.target.value = '';
    }, []);

    const removeTexture = useCallback((textureId) => {
        setLayoutTextures((prev) => {
            const next = prev.filter((texture) => texture.id !== textureId);
            setActiveTextureId((current) => (current === textureId ? (next[0]?.id ?? null) : current));
            return next;
        });
    }, []);

    /* ---- Zones du modele personnalise (utils/customLayout.js, inchange) ---- */

    /* Ajout d'une zone (clic sur une forme, ou glisser-deposer sur l'apercu):
       meme sequence que VibeFxStudio.handleAddCustomZone. */
    const addCustomZone = useCallback((shape, position = null) => {
        const zoneIndex = activeTemplate.customLayout?.zones?.length || 0;
        const created = createCustomZone(shape, zoneIndex, position);
        const nextZone = {
            ...created,
            homeX: created.x, homeY: created.y, homeW: created.w, homeH: created.h,
        };
        setActiveTemplate((previousTemplate) => {
            if (previousTemplate.id !== 'custom') return previousTemplate;
            const zones = [...(previousTemplate.customLayout?.zones || []), nextZone];
            return updateCustomTemplateZones(
                {
                    ...previousTemplate,
                    customLayout: { ...previousTemplate.customLayout, presetId: 'manual' },
                },
                normalizeCustomZones(zones, nextZone.id),
            );
        });
        setSelectedSlotIndex(nextZone.id);
        setActiveTextId(null);
    }, [activeTemplate, setActiveTemplate, setSelectedSlotIndex, setActiveTextId]);

    /* Deplacement / redimension d'une zone: reprise litterale de
       VibeFxStudio.handleUpdateCustomZone (clamps + memoire "home" + reflow). */
    const updateCustomZone = useCallback((zoneId, patch) => {
        if (!zoneId) return;
        setActiveTemplate((previousTemplate) => {
            if (previousTemplate.id !== 'custom') return previousTemplate;
            const currentZones = previousTemplate.customLayout?.zones || [];
            const zoneToUpdate = currentZones.find((zone) => zone.id === zoneId);
            if (!zoneToUpdate) return previousTemplate;

            const updatedZone = { ...zoneToUpdate, ...patch };
            if ('w' in patch) {
                const targetW = Math.max(0.08, Math.min(1, patch.w));
                updatedZone.w = targetW;
                if (updatedZone.x + targetW > 1) updatedZone.x = Math.max(0, 1 - targetW);
            }
            if ('h' in patch) {
                const targetH = Math.max(0.08, Math.min(1, patch.h));
                updatedZone.h = targetH;
                if (updatedZone.y + targetH > 1) updatedZone.y = Math.max(0, 1 - targetH);
            }
            if ('x' in patch) updatedZone.x = Math.max(0, Math.min(1 - updatedZone.w, patch.x));
            if ('y' in patch) updatedZone.y = Math.max(0, Math.min(1 - updatedZone.h, patch.y));

            const homePatch = {
                homeX: updatedZone.x, homeY: updatedZone.y,
                homeW: updatedZone.w, homeH: updatedZone.h,
            };
            const zones = currentZones.map((zone) => (
                zone.id === zoneId ? { ...zone, ...updatedZone, ...homePatch, hidden: false } : zone
            ));
            return updateCustomTemplateZones(previousTemplate, normalizeCustomZones(zones, zoneId));
        });
    }, [setActiveTemplate]);

    const deleteCustomZone = useCallback((zoneId) => {
        if (!zoneId) return;
        setActiveTemplate((previousTemplate) => {
            if (previousTemplate.id !== 'custom') return previousTemplate;
            const zones = (previousTemplate.customLayout?.zones || []).filter((zone) => zone.id !== zoneId);
            return updateCustomTemplateZones(previousTemplate, zones);
        });
        setSelectedSlotIndex((current) => (current === zoneId ? null : current));
        setSlotConfigs((previous) => {
            const next = { ...previous };
            delete next[zoneId];
            return next;
        });
    }, [setActiveTemplate, setSelectedSlotIndex, setSlotConfigs]);

    const clearCustomZones = useCallback(() => {
        setActiveTemplate((previousTemplate) => {
            if (previousTemplate.id !== 'custom') return previousTemplate;
            return {
                ...previousTemplate,
                slots: 0,
                customLayout: { ...previousTemplate.customLayout, presetId: 'manual', zones: [] },
            };
        });
        setSelectedSlotIndex(null);
    }, [setActiveTemplate, setSelectedSlotIndex]);

    /* ---- Fonds generes (meme sequence que VibeFxStudio) ---- */

    const applyLayoutMesh = useCallback((colors) => {
        const nextColors = colors?.length ? colors : DEFAULT_LAYOUT_MESH_COLORS;
        setLayoutBgMeshColors(nextColors);
        setLayoutBgGradient(true);
        setLayoutLumenBackground(null);
        setLayoutBgBlur(false);
        setLayoutBgColor(nextColors[0] || '#000000');
    }, [setLayoutBgBlur, setLayoutBgColor]);

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
        };
        img.src = payload.dataUrl;
    }, [setLayoutBgBlur, setLayoutBgColor]);

    const clearGeneratedBackground = useCallback(() => {
        setLayoutBgGradient(false);
        setLayoutLumenBackground(null);
    }, []);

    /* ---- Historique undo/redo (miroir de VibeFxStudio, champs layout) ---- */
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isRestoringHistoryRef = useRef(false);
    const prevSavedStateRef = useRef(null);

    const captureState = useCallback(() => ({
        images: images.map((img) => img),
        activeFormat,
        activeTemplate,
        overlayMode,
        texts: texts.map((t) => ({ ...t })),
        assets: assets.map((a) => ({ ...a })),
        padding, gap, customLayoutGap, radius,
        layoutBgColor, layoutBgBlur, layoutBgTexture, layoutBgGradient,
        layoutBgMeshColors: [...layoutBgMeshColors],
        slotConfigs: Object.fromEntries(Object.entries(slotConfigs).map(([k, v]) => [k, { ...v }])),
        layoutLumenBackground: layoutLumenBackground ? { ...layoutLumenBackground } : null,
        layoutSmoothBlur: layoutSmoothBlur ? { ...layoutSmoothBlur } : null,
        layoutTextures: layoutTextures.map((texture) => texture),
        activeTextureId,
        layoutTextureOpacity,
    }), [images, activeFormat, activeTemplate, overlayMode, texts, assets,
        padding, gap, customLayoutGap, radius,
        layoutBgColor, layoutBgBlur, layoutBgTexture, layoutBgGradient,
        layoutBgMeshColors, slotConfigs, layoutLumenBackground, layoutSmoothBlur,
        layoutTextures, activeTextureId, layoutTextureOpacity]);

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
        setLayoutSmoothBlur(state.layoutSmoothBlur || { ...DEFAULT_SMOOTH_BLUR_STATE });
        setLayoutTextures(state.layoutTextures || []);
        setActiveTextureId(state.activeTextureId ?? null);
        setLayoutTextureOpacity(state.layoutTextureOpacity ?? 60);
    }, [setActiveFormat, setActiveTemplate, setOverlayMode, setTexts, setAssets,
        setPadding, setGap, setRadius, setLayoutBgColor, setLayoutBgBlur,
        setLayoutBgTexture, setSlotConfigs]);

    const isStateEqual = useCallback((a, b) => {
        if (!a || !b) return false;
        if (a.images?.length !== b.images?.length) return false;
        if (a.activeFormat?.id !== b.activeFormat?.id) return false;
        if (a.activeTemplate?.id !== b.activeTemplate?.id) return false;
        if (JSON.stringify(a.activeTemplate?.customLayout || null) !== JSON.stringify(b.activeTemplate?.customLayout || null)) return false;
        if (a.overlayMode !== b.overlayMode) return false;
        if (a.padding !== b.padding || a.gap !== b.gap || a.customLayoutGap !== b.customLayoutGap || a.radius !== b.radius) return false;
        if (a.layoutBgColor !== b.layoutBgColor || a.layoutBgBlur !== b.layoutBgBlur || a.layoutBgTexture !== b.layoutBgTexture || a.layoutBgGradient !== b.layoutBgGradient) return false;
        if (JSON.stringify(a.layoutBgMeshColors) !== JSON.stringify(b.layoutBgMeshColors)) return false;
        if (JSON.stringify(a.texts) !== JSON.stringify(b.texts)) return false;
        if (JSON.stringify(a.assets) !== JSON.stringify(b.assets)) return false;
        if (a.layoutLumenBackground?.id !== b.layoutLumenBackground?.id) return false;
        if (JSON.stringify(a.layoutSmoothBlur) !== JSON.stringify(b.layoutSmoothBlur)) return false;
        if (a.layoutTextures?.length !== b.layoutTextures?.length) return false;
        if (a.activeTextureId !== b.activeTextureId) return false;
        if (a.layoutTextureOpacity !== b.layoutTextureOpacity) return false;
        const keysA = Object.keys(a.slotConfigs || {});
        const keysB = Object.keys(b.slotConfigs || {});
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            const confA = a.slotConfigs[key];
            const confB = b.slotConfigs[key];
            if (!confB) return false;
            if (confA.zoom !== confB.zoom || confA.x !== confB.x || confA.y !== confB.y) return false;
            if (confA.border !== confB.border || confA.blur !== confB.blur) return false;
            if (confA.imageName !== confB.imageName) return false;
        }
        return true;
    }, []);

    useEffect(() => {
        const initialState = captureState();
        prevSavedStateRef.current = initialState;
        /* setState differe (micro-timeout) pour ne pas cascader dans l'effet. */
        const timer = setTimeout(() => {
            setHistory([initialState]);
            setHistoryIndex(0);
        }, 0);
        return () => clearTimeout(timer);
        /* Etat initial capture une seule fois. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isRestoringHistoryRef.current) return undefined;
        const currentState = captureState();
        if (isStateEqual(currentState, prevSavedStateRef.current)) return undefined;
        const timer = setTimeout(() => {
            setHistory((prev) => {
                const nextHistory = prev.slice(0, historyIndex + 1);
                nextHistory.push(currentState);
                if (nextHistory.length > HISTORY_LIMIT) nextHistory.shift();
                return nextHistory;
            });
            setHistoryIndex((prev) => Math.min(HISTORY_LIMIT - 1, prev + 1));
            prevSavedStateRef.current = currentState;
        }, 400);
        return () => clearTimeout(timer);
    }, [captureState, isStateEqual, historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex <= 0) return;
        const nextIndex = historyIndex - 1;
        const targetState = history[nextIndex];
        isRestoringHistoryRef.current = true;
        prevSavedStateRef.current = targetState;
        setHistoryIndex(nextIndex);
        restoreState(targetState);
        setTimeout(() => { isRestoringHistoryRef.current = false; }, 50);
    }, [historyIndex, history, restoreState]);

    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const nextIndex = historyIndex + 1;
        const targetState = history[nextIndex];
        isRestoringHistoryRef.current = true;
        prevSavedStateRef.current = targetState;
        setHistoryIndex(nextIndex);
        restoreState(targetState);
        setTimeout(() => { isRestoringHistoryRef.current = false; }, 50);
    }, [historyIndex, history, restoreState]);

    /* Cmd/Ctrl+Z et Shift+Cmd/Ctrl+Z, sauf pendant une saisie clavier. */
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            event.preventDefault();
            if (event.shiftKey) redo(); else undo();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

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

    /* ---- Projet commun: garantir un projet, relire, sauvegarder ---- */

    useEffect(() => {
        ensureProject();
        /* Une seule fois a l'entree de l'ecran. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /*
     * Reprise d'un projet: les images reviennent des Blobs IndexedDB (plan §7).
     * Tant que cette relecture n'est pas terminee, on n'ecrit RIEN dans le
     * projet - sinon un ecran encore vide ecraserait la composition enregistree.
     */
    const hydrationRef = useRef('idle');
    const [isHydrating, setIsHydrating] = useState(false);

    useEffect(() => {
        if (hydrationRef.current !== 'idle') return;
        if (status !== 'ready') return;
        if (!project) return;
        if (!hasStoredComposition(project)) {
            hydrationRef.current = 'done';
            return;
        }
        hydrationRef.current = 'running';
        /* Micro-tache: la relecture est asynchrone, elle ne doit pas declencher
           de rendu en cascade depuis le corps de l'effet. */
        Promise.resolve().then(async () => {
            setIsHydrating(true);
            try {
                const restored = await restoreComposition(project);
                if (!restored) return;
                if (restored.format) setActiveFormat(restored.format);
                if (restored.template) setActiveTemplate(restored.template);
                setOverlayMode(restored.overlayMode);
                setImages(restored.images);
                setSlotConfigs(restored.slotConfigs);
                setTexts(restored.texts);
                setAssets(restored.assets);
                if (restored.geometry) {
                    setPadding(restored.geometry.padding ?? 40);
                    setGap(restored.geometry.gap ?? 20);
                    setRadius(restored.geometry.radius ?? 0);
                    setCustomLayoutGap(restored.geometry.customLayoutGap ?? DEFAULT_CUSTOM_LAYOUT_GAP);
                }
                const background = restored.background || {};
                if (background.color !== undefined) setLayoutBgColor(background.color);
                if (background.blur !== undefined) setLayoutBgBlur(background.blur);
                if (background.grain !== undefined) setLayoutBgTexture(background.grain);
                setLayoutTextures(background.textures || []);
                setActiveTextureId(background.activeTextureId ?? null);
                if (background.textureOpacity !== undefined) setLayoutTextureOpacity(background.textureOpacity);
                setLayoutBgGradient(background.meshEnabled);
                if (background.meshColors?.length) setLayoutBgMeshColors(background.meshColors);
                setLayoutLumenBackground(background.lumen);
                if (background.smoothBlur) setLayoutSmoothBlur(background.smoothBlur);
            } finally {
                hydrationRef.current = 'done';
                setIsHydrating(false);
            }
        });
    }, [status, project, setActiveFormat, setActiveTemplate, setOverlayMode, setSlotConfigs,
        setTexts, setAssets, setPadding, setGap, setRadius, setLayoutBgColor, setLayoutBgBlur,
        setLayoutBgTexture]);

    /*
     * Sauvegarde debouncee: composition complete (images en Blobs, zones,
     * textes, stickers, fond) + vignette 256px pour l'accueil.
     */
    const persistTimer = useRef(null);
    const blobCacheRef = useRef(new Map());
    useEffect(() => {
        if (!project || hydrationRef.current !== 'done') return undefined;
        if (!hasRenderableOutput) return undefined;
        if (persistTimer.current) clearTimeout(persistTimer.current);
        persistTimer.current = setTimeout(async () => {
            persistTimer.current = null;
            try {
                const patch = await snapshotComposition({
                    activeFormat, activeTemplate, overlayMode,
                    images, slotConfigs, texts, assets,
                    padding, gap, radius, customLayoutGap,
                    layoutBgColor, layoutBgBlur, layoutBgTexture,
                    layoutBgGradient, layoutBgMeshColors,
                    layoutTextures, activeTextureId, layoutTextureOpacity,
                    layoutLumenBackground, layoutSmoothBlur,
                }, blobCacheRef.current);

                const { width, height } = getCanvasDimensions();
                if (width && height) {
                    /* Un seul rendu pleine resolution sert deux usages: la
                       vignette de l'accueil ET la composition publiee dans le
                       projet - premier etage du pipeline (plan §4.3), que
                       Vision et Studio prennent en entree. */
                    const fullCanvas = document.createElement('canvas');
                    fullCanvas.width = width;
                    fullCanvas.height = height;
                    renderPipeline(fullCanvas, width, height, false, 'high');

                    const thumbCanvas = document.createElement('canvas');
                    thumbCanvas.width = THUMBNAIL_WIDTH;
                    thumbCanvas.height = Math.max(1, Math.round((THUMBNAIL_WIDTH * height) / width));
                    thumbCanvas.getContext('2d').drawImage(fullCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
                    patch.thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);

                    /* PNG: la composition traverse le reste du pipeline sans
                       perte de qualite (plan §7, parite d'export). */
                    const compositionBlob = await canvasToBlob(fullCanvas, 'image/png');
                    if (compositionBlob) {
                        patch.composition = {
                            blob: compositionBlob,
                            width,
                            height,
                            updatedAt: Date.now(),
                        };
                    }
                }
                updateProject(patch);
            } catch {
                /* Sauvegarde non bloquante: l'edition continue en memoire. */
            }
        }, PERSIST_DEBOUNCE_MS);
        return () => {
            if (persistTimer.current) clearTimeout(persistTimer.current);
        };
        /* project omis volontairement: la sauvegarde repond aux changements
           d'edition, pas aux reecritures du store qu'elle provoque elle-meme. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images, activeFormat, activeTemplate, overlayMode, padding, gap, radius, customLayoutGap,
        layoutBgColor, layoutBgBlur, layoutBgTexture, layoutBgGradient, layoutBgMeshColors,
        layoutTextures, activeTextureId, layoutTextureOpacity,
        layoutLumenBackground, layoutSmoothBlur, texts, assets, slotConfigs, hasRenderableOutput]);

    return {
        /* etat */
        ...layoutState,
        images, setImages,
        customLayoutGap, setCustomLayoutGap,
        isProcessing, loadingProgress, isHydrating,
        slotModel, hasRenderableOutput,
        /* refs + events canvas */
        canvasRef,
        handlePointerDown, handlePointerMove, handlePointerUp,
        /* helpers */
        ...helpers,
        /* imports */
        handleImageUpload, handleReplaceImageUpload, handleSlotImageUpload,
        handleRemoveImage, handleRemoveSlotImage,
        /* templates */
        applyCustomPreset, applyThemedTemplate,
        /* zones du modele personnalise */
        addCustomZone, updateCustomZone, deleteCustomZone, clearCustomZones,
        /* textures du fond */
        layoutTextures, activeTextureId, setActiveTextureId,
        layoutTextureOpacity, setLayoutTextureOpacity,
        handleTextureUpload, removeTexture,
        /* fonds generes */
        layoutBgGradient, layoutBgMeshColors, applyLayoutMesh,
        layoutLumenBackground, applyLumenBackground,
        clearGeneratedBackground,
        layoutSmoothBlur, setLayoutSmoothBlur,
        /* historique */
        undo, redo,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        /* export */
        exportController,
    };
}
