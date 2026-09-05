"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bold, Columns2, Download, Eraser, FlipHorizontal2, FlipVertical2, ImagePlus, Images, Italic,
    LayoutGrid, LayoutTemplate, Layers, Maximize2, Plus, Redo2, Shuffle, Smartphone, Sparkles,
    Sticker, Trash2, Type, Undo2, Upload, Waves, X,
} from 'lucide-react';
import {
    CUSTOM_LAYOUT_PRESETS, CUSTOM_SHAPE_LIBRARY, FONT_OPTIONS, FORMATS, TEMPLATES,
} from '../../vibefx-studio/data/constants';
import { buildSocialImages } from '../../vibefx-studio/utils/socialExport';
import {
    Button, Collapsible, IconButton, Progress, Segmented, Sheet, Slider, Tile, TileGrid, useToast,
} from '../primitives';
import { useRoom } from '../room/RoomProvider';
import useLayoutEditor from './useLayoutEditor';
import TemplateSheet from './TemplateSheet';
import TemplatePreviewSvg from './TemplatePreviewSvg';
import MeshSheet from '../shared/MeshSheet';
import LumenSheet from '../shared/LumenSheet';
import SmoothBlurSheet from '../shared/SmoothBlurSheet';
import GridCategoryMenu from './GridCategoryMenu';
import GridLibrarySheet from './GridLibrarySheet';
import {
    DEFAULT_GRID_ID, DEFAULT_GRID_TRANSFORM, gridPreviewZones, findGridPreset, pickGridVariant,
} from './gridLibrary';
import { GRID_CATEGORIES, GRID_COUNT, catalogGrid, gridsInCategory } from './gridCatalog';
import SlotImportSheet from './SlotImportSheet';
import SlotOverlay from './SlotOverlay';
import ZoneOverlay from './ZoneOverlay';
import InstaPreviewSheet from './InstaPreviewSheet';
import styles from './layout.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

const SHAPE_DATA_TYPE = 'application/vibefx-shape';

/*
 * Boite exacte du canvas affiche, en pixels, relative a son conteneur.
 * Les couches posees par-dessus (zones custom, comparaison avant/apres)
 * doivent tomber au pixel pres sur le canvas, dont la taille depend du format
 * ET de la place disponible: on la mesure plutot que de la deviner.
 */
function useCanvasBox(canvasRef, wrapRef, watch) {
    const [box, setBox] = useState(null);

    const measure = useCallback(() => {
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) {
            setBox(null);
            return;
        }
        const canvasRect = canvas.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        setBox({
            left: canvasRect.left - wrapRect.left,
            top: canvasRect.top - wrapRect.top,
            width: canvasRect.width,
            height: canvasRect.height,
        });
    }, [canvasRef, wrapRef]);

    useEffect(() => {
        measure();
        const canvas = canvasRef.current;
        if (!canvas || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(canvas);
        window.addEventListener('resize', measure);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [measure, canvasRef, watch]);

    return box;
}

/* Silhouette proportionnelle d'un format (les tuiles montrent la vraie forme). */
function FormatShape({ ratio }) {
    const base = 30;
    const w = ratio >= 1 ? base : Math.max(14, Math.round(base * ratio));
    const h = ratio >= 1 ? Math.max(10, Math.round(base / ratio)) : base;
    return <span className={styles.formatShape} style={{ width: w, height: h }} />;
}

export default function LayoutScreen() {
    const editor = useLayoutEditor();
    const {
        images, activeFormat, setActiveFormat,
        activeTemplate, setActiveTemplate, overlayMode, setOverlayMode,
        texts, activeTextId, setActiveTextId,
        padding, setPadding, gap, radius, setRadius,
        customLayoutGap,
        linkedMargins, toggleLinkedMargins, setUniformMargin, setInnerGap,
        layoutBgColor, setLayoutBgColor,
        layoutBgBlur, setLayoutBgBlur,
        layoutBgTexture, setLayoutBgTexture,
        selectedSlotIndex, setSelectedSlotIndex,
        slotModel, reserveCount, hasRenderableOutput, isProcessing, loadingProgress, isHydrating,
        canvasRef, handlePointerDown, handlePointerMove, handlePointerUp,
        handleSlotImageUpload, handleRemoveSlotImage,
        slotGeometry, swapSlotImages, importImageIntoSlot, importBlobIntoSlot, importImagesIntoSlots,
        zoomSlot, panSlot, resetSlotFraming,
        addText, updateActiveText, deleteActiveText, currentText,
        assets, activeAssetId, setActiveAssetId,
        addAsset, updateActiveAsset, deleteActiveAsset, currentAsset,
        applyGridPreset, applyThemedTemplate, applyTemplateWithPhotos, transformGrid,
        addCustomZone, updateCustomZone, deleteCustomZone, clearCustomZones,
        layoutTextures, activeTextureId, setActiveTextureId,
        layoutTextureOpacity, setLayoutTextureOpacity,
        handleTextureUpload, removeTexture,
        layoutBgGradient, layoutBgMeshColors, applyLayoutMesh,
        layoutLumenBackground, applyLumenBackground, clearGeneratedBackground,
        layoutSmoothBlur, setLayoutSmoothBlur,
        updateSlotConfig, slotConfigs,
        undo, redo, canUndo, canRedo,
        exportController,
    } = editor;

    const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false);
    const [isMeshSheetOpen, setIsMeshSheetOpen] = useState(false);
    const [isLumenSheetOpen, setIsLumenSheetOpen] = useState(false);
    const [isSmoothBlurSheetOpen, setIsSmoothBlurSheetOpen] = useState(false);
    const [isDropTarget, setIsDropTarget] = useState(false);
    const [isComparing, setIsComparing] = useState(false);
    const [instaPreview, setInstaPreview] = useState(null);
    const [isSendingToRoom, setIsSendingToRoom] = useState(false);
    const [isZoneEditOpen, setIsZoneEditOpen] = useState(false);
    const [isGridLibraryOpen, setIsGridLibraryOpen] = useState(false);
    /* `null` = feuille fermee. `{ slotId }` = une case precise. `{ slotId: null }`
       = import general, qui remplit les cases vides dans l'ordre. */
    const [importTarget, setImportTarget] = useState(null);
    const globalImportRef = useRef(null);
    const textureImportRef = useRef(null);
    const canvasWrapRef = useRef(null);

    const {
        exportName, setExportName, exportFormat, setExportFormat,
        exportQuality, setExportQuality, estimatedSize,
        isExportModalOpen, setIsExportModalOpen, handleDownload, performExport, renderExportCanvas,
    } = exportController;

    const { addFromCanvas: addToRoom, isFull: isRoomFull } = useRoom();
    const toast = useToast();

    const isCustomTemplate = activeTemplate.id === 'custom';
    const customZones = useMemo(
        () => (isCustomTemplate ? (activeTemplate.customLayout?.zones || []) : []),
        [isCustomTemplate, activeTemplate],
    );
    const canvasBox = useCanvasBox(canvasRef, canvasWrapRef, `${activeFormat.id}-${hasRenderableOutput}`);
    const originalImageSrc = images[0]?.vibeosOriginalSrc || images[0]?.src || null;
    const appliedThemedId = activeTemplate.customLayout?.presetId;

    /* ---- Grilles editoriales (gridLibrary.js / gridCatalog.js) ---- */
    const gridVariant = pickGridVariant(activeFormat);
    const activeGridPreset = catalogGrid(appliedThemedId);
    const gridTransform = { ...DEFAULT_GRID_TRANSFORM, ...(activeTemplate.customLayout?.transform || {}) };
    const isGridEdited = Boolean(activeTemplate.customLayout?.dirty);
    /*
     * Le panneau montre TOUTE une famille, pas une selection figee: on choisit
     * la famille au-dessus des vignettes et on reste dans le panneau. La
     * bibliotheque garde son role de vue de decouverte (recherche + apercus
     * 4:5 et 1:1 cote a cote).
     */
    const [browsedCategory, setBrowsedCategory] = useState(null);
    /*
     * Famille affichee: celle de la grille active, sauf si on est en train d'en
     * parcourir une autre. Le choix manuel est attache a la grille active: des
     * qu'on applique une autre grille (panneau OU bibliotheque), la famille
     * suit cette grille. Rien n'est calcule dans un effet: tout se derive du
     * rendu, donc le panneau ne peut pas afficher une famille perimee.
     */
    const appliedGridCategory = activeGridPreset?.category || GRID_CATEGORIES[0].id;
    /* `browsedCategory` et `appliedThemedId` peuvent valoir undefined tous les
       deux (modele integre): comparer sans verifier l'objet lisait alors une
       propriete sur null. */
    const gridCategoryId = browsedCategory && browsedCategory.presetId === appliedThemedId
        ? browsedCategory.categoryId
        : appliedGridCategory;
    const browseGridCategory = useCallback((categoryId) => {
        setBrowsedCategory({ presetId: appliedThemedId, categoryId });
    }, [appliedThemedId]);
    const categoryGrids = useMemo(() => gridsInCategory(gridCategoryId), [gridCategoryId]);
    /*
     * Cases de l'apercu: le moteur publie leurs rectangles (pixels du canvas
     * d'apercu) a chaque rendu; on y accroche le libelle de la zone et la
     * vignette pour le glisser-deposer.
     */
    const overlaySlots = useMemo(() => {
        const labels = new Map(slotModel.map((slot) => [String(slot.id), slot]));
        return (slotGeometry.rects || []).map((rect, index) => {
            const known = labels.get(String(rect.id));
            return {
                id: rect.id,
                label: known?.label || `Image ${index + 1}`,
                src: known?.imageSrc || null,
                hasImage: Boolean(known?.imageSrc),
                zoom: slotConfigs[rect.id]?.zoom ?? 1,
                x: rect.x, y: rect.y, w: rect.w, h: rect.h,
            };
        });
    }, [slotGeometry, slotModel, slotConfigs]);
    const importSlotLabel = overlaySlots.find((slot) => slot.id === importTarget?.slotId)?.label || '';

    /* Quelle case se trouve sous ce point de l'ecran? (depot de fichiers) */
    const slotIdAtPoint = useCallback((clientX, clientY) => {
        if (!canvasBox || !slotGeometry.width || !slotGeometry.height) return null;
        const wrapRect = canvasWrapRef.current?.getBoundingClientRect();
        if (!wrapRect) return null;
        const x = ((clientX - wrapRect.left - canvasBox.left) / canvasBox.width) * slotGeometry.width;
        const y = ((clientY - wrapRect.top - canvasBox.top) / canvasBox.height) * slotGeometry.height;
        const hit = (slotGeometry.rects || []).find((rect) => (
            x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
        ));
        return hit ? hit.id : null;
    }, [canvasBox, slotGeometry]);

    const hasGeneratedBackground = layoutBgGradient || Boolean(layoutLumenBackground);
    const backgroundMode = hasGeneratedBackground ? 'generated' : (layoutBgBlur ? 'blur' : 'color');
    const smoothBlurOn = Boolean(layoutSmoothBlur?.enabled);
    const selectedSlotConfig = selectedSlotIndex !== null
        ? (slotConfigs[selectedSlotIndex] || { zoom: 1, x: 0, y: 0, border: 0, blur: 0 })
        : null;

    const marginModes = useMemo(() => ([
        { value: 'linked', label: 'Égales' },
        { value: 'free', label: 'Libres' },
    ]), []);

    const bgOptions = useMemo(() => ([
        { value: 'color', label: 'Couleur' },
        { value: 'blur', label: 'Flou' },
        { value: 'generated', label: 'Généré' },
    ]), []);

    const handleBackgroundMode = (value) => {
        if (value === 'color') {
            clearGeneratedBackground();
            setLayoutBgBlur(false);
        } else if (value === 'blur') {
            clearGeneratedBackground();
            setLayoutBgBlur(true);
        } else {
            /* « Généré » : on ouvre Mesh par défaut si rien n'est actif. */
            if (!hasGeneratedBackground) setIsMeshSheetOpen(true);
        }
    };

    /*
     * La selection d'une case ne doit pas coller: Echap la retire, un clic a
     * cote de l'apercu aussi, et le plein ecran s'ouvre toujours sans le
     * liseret (c'est une marque d'interface, pas une partie du visuel).
     */
    useEffect(() => {
        const clearOnEscape = (event) => {
            if (event.key === 'Escape') setSelectedSlotIndex(null);
        };
        window.addEventListener('keydown', clearOnEscape);
        return () => window.removeEventListener('keydown', clearOnEscape);
    }, [setSelectedSlotIndex]);

    const clearSelectionOutsideCanvas = (event) => {
        if (event.target.closest?.('canvas, button, input, [role="slider"], [data-testid="vibeos-slot-layer"], [data-testid="vibeos-zone-layer"]')) return;
        setSelectedSlotIndex(null);
    };

    /* Depot sur l'apercu: une forme de zone si on vient de la palette,
       sinon des fichiers images. */
    const handleDrop = (event) => {
        event.preventDefault();
        setIsDropTarget(false);
        const shapeId = event.dataTransfer?.getData(SHAPE_DATA_TYPE);
        if (shapeId && isCustomTemplate) {
            const shape = CUSTOM_SHAPE_LIBRARY.find((item) => item.id === shapeId);
            if (shape && canvasBox) {
                const safeLeft = canvasBox.left + (padding / activeFormat.w) * canvasBox.width;
                const safeTop = canvasBox.top + (padding / activeFormat.h) * canvasBox.height;
                const safeWidth = canvasBox.width * ((activeFormat.w - padding * 2) / activeFormat.w);
                const safeHeight = canvasBox.height * ((activeFormat.h - padding * 2) / activeFormat.h);
                const wrapRect = canvasWrapRef.current?.getBoundingClientRect();
                const localX = (event.clientX - (wrapRect?.left || 0) - safeLeft) / Math.max(1, safeWidth);
                const localY = (event.clientY - (wrapRect?.top || 0) - safeTop) / Math.max(1, safeHeight);
                addCustomZone(shape, {
                    x: Math.max(0, Math.min(1 - shape.w, localX - shape.w / 2)),
                    y: Math.max(0, Math.min(1 - shape.h, localY - shape.h / 2)),
                });
                return;
            }
        }
        const files = Array.from(event.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        /* Un fichier lache SUR une case va dans cette case; ailleurs, import
           global qui remplit les cases dans l'ordre de lecture. */
        const targetSlotId = files.length === 1 ? slotIdAtPoint(event.clientX, event.clientY) : null;
        if (targetSlotId !== null && targetSlotId !== undefined) {
            importImageIntoSlot(files[0], targetSlotId);
            return;
        }
        importImagesIntoSlots(files);
    };

    const handleFullscreen = () => {
        setSelectedSlotIndex(null);
        canvasRef.current?.requestFullscreen?.();
    };

    const openInstaPreview = async () => {
        const format = activeFormat;
        setInstaPreview({ format, slides: [], loading: true, error: '' });
        try {
            const exportCanvas = renderExportCanvas();
            if (!exportCanvas) throw new Error('Le rendu pleine définition n’est pas disponible.');
            const slides = await buildSocialImages(exportCanvas, format);
            if (!slides.length) throw new Error('Aucune image n’a pu être préparée.');
            setInstaPreview({ format, slides, loading: false, error: '' });
        } catch (error) {
            setInstaPreview({
                format,
                slides: [],
                loading: false,
                error: error?.message || 'Impossible de préparer l’aperçu Instagram.',
            });
        }
    };

    /*
     * « Room »: le rendu pleine definition part dans la file du post, a cote
     * des autres images deja preparees. Un panorama y entre decoupe en
     * tranches - exactement celles qu'Instagram recevra.
     */
    const sendToRoom = async () => {
        if (isSendingToRoom) return;
        setIsSendingToRoom(true);
        try {
            const exportCanvas = renderExportCanvas();
            if (!exportCanvas) throw new Error('Le rendu pleine définition n’est pas disponible.');
            const result = await addToRoom(exportCanvas, {
                format: activeFormat,
                source: 'layout',
                sourceLabel: 'Layout',
            });
            if (!result.added) {
                toast.push(
                    result.reason === 'full'
                        ? 'La Room est pleine : un carrousel Instagram s’arrête à 10 images.'
                        : 'Rien n’a pu être envoyé dans la Room.',
                    { tone: 'danger' },
                );
                return;
            }
            toast.push(
                `${result.added} image${result.added > 1 ? 's' : ''} dans la Room · ${result.total} au total`,
                { tone: 'success' },
            );
        } catch (error) {
            toast.push(error?.message || 'Envoi dans la Room impossible.', { tone: 'danger' });
        } finally {
            setIsSendingToRoom(false);
        }
    };

    /* « Comparer » = maintien: on relache, on revoit son montage. */
    const compareHandlers = {
        onPointerDown: () => setIsComparing(true),
        onPointerUp: () => setIsComparing(false),
        onPointerLeave: () => setIsComparing(false),
        onPointerCancel: () => setIsComparing(false),
    };

    return (
        <div className={styles.screen} data-testid="vibeos-layout-screen">
            {/* ---------- Aperçu ---------- */}
            <section
                className={cx(styles.stage, isDropTarget && styles.stageDrop)}
                aria-label="Aperçu du visuel"
                onDragOver={(event) => { event.preventDefault(); setIsDropTarget(true); }}
                onDragLeave={() => setIsDropTarget(false)}
                onDrop={handleDrop}
                onPointerDown={clearSelectionOutsideCanvas}
            >
                {hasRenderableOutput ? (
                    <>
                        <div className={styles.stageActions}>
                            <IconButton label="Annuler (Cmd+Z)" disabled={!canUndo} onClick={undo}>
                                <Undo2 size={15} />
                            </IconButton>
                            <IconButton label="Rétablir (Shift+Cmd+Z)" disabled={!canRedo} onClick={redo}>
                                <Redo2 size={15} />
                            </IconButton>
                            <IconButton
                                label="Comparer avec l'original (maintiens le clic)"
                                disabled={!originalImageSrc}
                                active={isComparing}
                                {...compareHandlers}
                            >
                                <Columns2 size={15} />
                            </IconButton>
                            <IconButton label="Aperçu Instagram" onClick={openInstaPreview}>
                                <Smartphone size={15} />
                            </IconButton>
                            <IconButton label="Plein écran" onClick={handleFullscreen}>
                                <Maximize2 size={15} />
                            </IconButton>
                            <Button
                                size="sm"
                                icon={<Layers size={13} />}
                                onClick={sendToRoom}
                                disabled={isSendingToRoom || isRoomFull}
                                title={isRoomFull
                                    ? 'La Room est pleine (10 images)'
                                    : 'Envoyer ce rendu dans la Room, la file du post'}
                                data-testid="vibeos-layout-send-room"
                            >
                                Room
                            </Button>
                            <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={handleDownload}>
                                Exporter
                            </Button>
                        </div>
                        <div className={styles.canvasWrap} ref={canvasWrapRef}>
                            <canvas
                                ref={canvasRef}
                                className={styles.canvas}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            />
                            {/* Comparaison: l'original brut, recadré dans le format. */}
                            {isComparing && originalImageSrc && canvasBox ? (
                                <div
                                    className={styles.compareOverlay}
                                    style={canvasBox}
                                    data-testid="vibeos-compare-overlay"
                                >
                                    <img src={originalImageSrc} alt="Photo d'origine" />
                                    <span className={styles.compareTag}>Original</span>
                                </div>
                            ) : null}
                            {/* Cases de la mise en page: import et échange de photos.
                                Masquee pendant l'edition des zones, qui a sa
                                propre couche de poignees. */}
                            {!isZoneEditOpen && canvasBox && overlaySlots.length ? (
                                <div className={styles.slotLayerHost} style={canvasBox}>
                                    <SlotOverlay
                                        slots={overlaySlots}
                                        canvasWidth={slotGeometry.width}
                                        canvasHeight={slotGeometry.height}
                                        selectedSlotId={selectedSlotIndex}
                                        onImport={(slotId) => setImportTarget({ slotId })}
                                        onSwap={swapSlotImages}
                                        onSelect={setSelectedSlotIndex}
                                        onRemove={handleRemoveSlotImage}
                                        onZoom={zoomSlot}
                                        onPan={panSlot}
                                        onResetFraming={resetSlotFraming}
                                    />
                                </div>
                            ) : null}
                            {/* Édition des zones du modèle personnalisé. */}
                            {isZoneEditOpen && isCustomTemplate && canvasBox ? (
                                <div className={styles.zoneLayerHost} style={canvasBox}>
                                    <ZoneOverlay
                                        zones={customZones}
                                        selectedZoneId={selectedSlotIndex}
                                        canvasWidth={activeFormat.w}
                                        canvasHeight={activeFormat.h}
                                        padding={padding}
                                        onSelect={setSelectedSlotIndex}
                                        onUpdate={updateCustomZone}
                                        onDelete={deleteCustomZone}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyStage}>
                        <h2 className={styles.emptyStageTitle}>Commence par tes images</h2>
                        <p className={styles.emptyStageBody}>
                            Importe une ou plusieurs photos, ou glisse-les ici. Tu choisiras ensuite
                            le format et l&apos;habillage.
                        </p>
                        <div className={styles.emptyStageActions}>
                            <Button variant="primary" size="lg" icon={<Upload size={15} />} onClick={() => globalImportRef.current?.click()}>
                                Importer des images
                            </Button>
                            <Button
                                variant="secondary"
                                size="lg"
                                icon={<Images size={15} />}
                                onClick={() => setImportTarget({ slotId: null })}
                                data-testid="vibeos-open-library-picker"
                            >
                                Depuis ma bibliothèque
                            </Button>
                        </div>
                    </div>
                )}
                {isProcessing ? (
                    <div className={styles.progressWrap}>
                        <Progress value={loadingProgress} label="Import en cours" />
                    </div>
                ) : null}
                {isHydrating ? (
                    <div className={styles.progressWrap}>
                        <Progress value={100} label="Reprise de ton projet" />
                    </div>
                ) : null}
            </section>

            {/* ---------- Panneau ---------- */}
            <aside className={styles.panel} aria-label="Réglages du visuel">
                {/* 1. Format */}
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3 className={styles.blockTitle}><span className={styles.blockStep}>1</span>Format</h3>
                        <span className={styles.blockHint}>{activeFormat.w}×{activeFormat.h}</span>
                    </div>
                    <TileGrid aria-label="Choix du format">
                        {FORMATS.map((format) => (
                            <Tile
                                key={format.id}
                                active={format.id === activeFormat.id}
                                visual={<FormatShape ratio={format.ratio} />}
                                label={format.label.replace(/ \(.+\)$/, '')}
                                hint={format.label.match(/\((.+)\)$/)?.[1]}
                                onClick={() => setActiveFormat(format)}
                            />
                        ))}
                    </TileGrid>
                </section>

                {/* 2. Modèle */}
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3 className={styles.blockTitle}><span className={styles.blockStep}>2</span>Modèle</h3>
                        <span className={styles.blockHint}>{activeTemplate.slots} zone{activeTemplate.slots > 1 ? 's' : ''}</span>
                    </div>
                    <TileGrid aria-label="Choix du modèle">
                        {TEMPLATES.map((template) => (
                            <Tile
                                key={template.id}
                                active={!isCustomTemplate && template.id === activeTemplate.id}
                                visual={<TemplatePreviewSvg builtinId={template.id} ratio={1.2} width="44px" />}
                                label={template.label}
                                onClick={() => applyTemplateWithPhotos(template)}
                            />
                        ))}
                        <Tile
                            active={isCustomTemplate}
                            visual={<LayoutTemplate size={20} />}
                            label="Personnalisé"
                            onClick={() => applyGridPreset(findGridPreset(DEFAULT_GRID_ID))}
                        />
                    </TileGrid>
                    {isCustomTemplate ? (
                        <div className={styles.gridPicker}>
                            <div className={styles.gridPickerHead}>
                                <GridCategoryMenu
                                    categories={GRID_CATEGORIES}
                                    value={gridCategoryId}
                                    onChange={browseGridCategory}
                                />
                                <button
                                    type="button"
                                    className={styles.gridLibraryLink}
                                    onClick={() => setIsGridLibraryOpen(true)}
                                    data-testid="vibeos-grid-library-open"
                                >
                                    <LayoutGrid size={13} />
                                    {GRID_COUNT} grilles
                                </button>
                            </div>
                            <TileGrid aria-label="Grilles éditoriales">
                                {categoryGrids.map((preset) => (
                                    <Tile
                                        key={preset.id}
                                        active={appliedThemedId === preset.id}
                                        visual={(
                                            <TemplatePreviewSvg
                                                zones={gridPreviewZones(preset, gridVariant)}
                                                ratio={activeFormat.ratio}
                                                width="44px"
                                            />
                                        )}
                                        label={preset.label}
                                        hint={`${preset.slots} images`}
                                        onClick={() => applyGridPreset(preset)}
                                    />
                                ))}
                            </TileGrid>
                            {/* Variantes d'une meme grille: on retourne la composition ou
                                on fait tourner les photos, sans rien redessiner. */}
                            <div className={styles.gridVariants}>
                                <span className={styles.gridVariantsLabel}>Variantes</span>
                                <IconButton
                                    label="Miroir horizontal"
                                    active={gridTransform.flipX}
                                    onClick={() => transformGrid({ flipX: !gridTransform.flipX })}
                                >
                                    <FlipHorizontal2 size={14} />
                                </IconButton>
                                <IconButton
                                    label="Miroir vertical"
                                    active={gridTransform.flipY}
                                    onClick={() => transformGrid({ flipY: !gridTransform.flipY })}
                                >
                                    <FlipVertical2 size={14} />
                                </IconButton>
                                <IconButton
                                    label="Décaler les photos d'une zone"
                                    onClick={() => transformGrid({ shift: gridTransform.shift + 1 })}
                                >
                                    <Shuffle size={14} />
                                </IconButton>
                            </div>
                            <p className={styles.gridPickerHint}>
                                <strong>{activeGridPreset?.label || activeTemplate.label}</strong>
                                {isGridEdited ? ' · retouchée à la main' : ''}
                                {' · '}
                                {activeGridPreset && !activeGridPreset.fixed && !isGridEdited
                                    ? 'se recompose en 4:5 et en 1:1.'
                                    : 'garde ce découpage dans tous les formats.'}
                            </p>
                        </div>
                    ) : null}
                </section>

                {/* 3. Images */}
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3 className={styles.blockTitle}>
                            <span className={styles.blockStep}>3</span>Images
                            {reserveCount > 0 ? (
                                <span className={styles.blockHint}>
                                    &nbsp;· {reserveCount} en réserve
                                </span>
                            ) : null}
                        </h3>
                        <button
                            type="button"
                            className={styles.slotImport}
                            onClick={() => setImportTarget({ slotId: null })}
                        >
                            <Plus size={13} />
                            Ajouter
                        </button>
                        <label className={styles.hiddenInput}>
                            <input
                                ref={globalImportRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className={styles.hiddenInput}
                                onChange={(event) => {
                                    importImagesIntoSlots(event.target.files);
                                    event.target.value = '';
                                }}
                                data-testid="vibeos-image-input"
                            />
                        </label>
                    </div>
                    <div className={styles.slotList} data-testid="vibeos-slot-list">
                        {slotModel.map((slot) => (
                            <div
                                key={slot.id}
                                className={cx(styles.slotItem, selectedSlotIndex === slot.id && styles.slotItemActive)}
                            >
                                <label className={styles.slotThumb} title={`Importer dans « ${slot.label} »`}>
                                    {slot.imageSrc ? <img src={slot.imageSrc} alt="" /> : <ImagePlus size={15} />}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className={styles.hiddenInput}
                                        onChange={(event) => handleSlotImageUpload(event, slot.id)}
                                    />
                                </label>
                                <button
                                    type="button"
                                    className={styles.slotLabel}
                                    onClick={() => setSelectedSlotIndex(selectedSlotIndex === slot.id ? null : slot.id)}
                                >
                                    {slot.label}
                                </button>
                                {slot.imageSrc ? (
                                    <IconButton
                                        label={`Retirer l'image de « ${slot.label} »`}
                                        onClick={() => handleRemoveSlotImage(slot.id)}
                                    >
                                        <X size={13} />
                                    </IconButton>
                                ) : <span className={styles.blockHint}>vide</span>}
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. Habillage */}
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3 className={styles.blockTitle}><span className={styles.blockStep}>4</span>Habillage</h3>
                    </div>
                    <Button
                        variant="secondary"
                        block
                        icon={<LayoutTemplate size={14} />}
                        onClick={() => setIsTemplateSheetOpen(true)}
                    >
                        Parcourir les templates
                    </Button>
                    {/* Marges: le mode « Égales » donne la meme respiration au bord
                        du visuel et entre les images - c'est ce qui fait qu'une
                        grille tombe juste sans reglage. */}
                    <div className={styles.rowSplit}>
                        <span className={styles.rowLabel}>Marges</span>
                        <Segmented
                            label="Réglage des marges"
                            value={linkedMargins ? 'linked' : 'free'}
                            onChange={(value) => toggleLinkedMargins(value === 'linked')}
                            options={marginModes}
                        />
                    </div>
                    {linkedMargins ? (
                        <Slider
                            label="Marge"
                            value={padding}
                            onChange={setUniformMargin}
                            min={0} max={150} defaultValue={24}
                            formatValue={(v) => `${v}px`}
                        />
                    ) : (
                        <>
                            <Slider
                                label="Marge extérieure"
                                value={padding}
                                onChange={setPadding}
                                min={0} max={150} defaultValue={24}
                                formatValue={(v) => `${v}px`}
                            />
                            <Slider
                                label="Écart entre les images"
                                value={isCustomTemplate ? customLayoutGap : gap}
                                onChange={setInnerGap}
                                min={0} max={150} defaultValue={24}
                                formatValue={(v) => `${v}px`}
                            />
                        </>
                    )}
                    <Slider label="Arrondi" value={radius} onChange={setRadius} min={0} max={100} defaultValue={0} formatValue={(v) => `${v}px`} />
                    <div className={styles.rowSplit}>
                        <span className={styles.rowLabel}>Fond</span>
                        <Segmented
                            label="Type de fond"
                            value={backgroundMode}
                            onChange={handleBackgroundMode}
                            options={bgOptions}
                        />
                    </div>
                    {backgroundMode === 'color' ? (
                        <div className={styles.rowSplit}>
                            <span className={styles.rowLabel}>Couleur du fond</span>
                            <input
                                type="color"
                                className={styles.colorInput}
                                value={layoutBgColor}
                                aria-label="Couleur du fond"
                                onChange={(event) => setLayoutBgColor(event.target.value)}
                            />
                        </div>
                    ) : null}
                    {backgroundMode === 'generated' || hasGeneratedBackground ? (
                        <div className={styles.generatedChoices}>
                            <Button
                                variant={layoutBgGradient ? 'primary' : 'secondary'}
                                size="sm"
                                icon={<Layers size={13} />}
                                onClick={() => setIsMeshSheetOpen(true)}
                            >
                                Mesh
                            </Button>
                            <Button
                                variant={layoutLumenBackground ? 'primary' : 'secondary'}
                                size="sm"
                                icon={<Sparkles size={13} />}
                                onClick={() => setIsLumenSheetOpen(true)}
                            >
                                Lumen
                            </Button>
                        </div>
                    ) : null}
                    <Button
                        variant={smoothBlurOn ? 'primary' : 'secondary'}
                        block
                        icon={<Waves size={14} />}
                        onClick={() => setIsSmoothBlurSheetOpen(true)}
                    >
                        {smoothBlurOn ? 'Flou pro activé — ajuster' : 'Flou pro'}
                    </Button>
                    <Slider label="Grain du fond" value={layoutBgTexture} onChange={setLayoutBgTexture} min={0} max={100} defaultValue={15} formatValue={(v) => `${v}%`} />
                </section>

                {/* Réglages avancés */}
                <Collapsible title="Réglages avancés" defaultOpen={false} testId="vibeos-layout-advanced">
                    <section className={styles.block}>
                        <div className={styles.blockHead}>
                            <h3 className={styles.blockTitle}><Type size={13} />Textes</h3>
                            <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={addText}>
                                Ajouter
                            </Button>
                        </div>
                        {texts.length > 0 ? (
                            <div className={styles.textList}>
                                {texts.map((text) => (
                                    <button
                                        key={text.id}
                                        type="button"
                                        className={cx(styles.textRow, text.id === activeTextId && styles.textRowActive)}
                                        onClick={() => setActiveTextId(text.id === activeTextId ? null : text.id)}
                                    >
                                        <span className={styles.textRowContent}>{text.content || 'Texte vide'}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.blockHint}>Aucun texte. Ajoute un titre ou une légende.</p>
                        )}
                        {currentText ? (
                            <div className={styles.textEditor}>
                                <input
                                    type="text"
                                    className={styles.textInput}
                                    value={currentText.content}
                                    aria-label="Contenu du texte"
                                    onChange={(event) => updateActiveText('content', event.target.value)}
                                />
                                <select
                                    className={styles.select}
                                    value={currentText.font}
                                    aria-label="Police"
                                    onChange={(event) => updateActiveText('font', event.target.value)}
                                >
                                    {FONT_OPTIONS.map((font) => (
                                        <option key={font.value} value={font.value}>{font.label}</option>
                                    ))}
                                </select>
                                <div className={styles.rowSplit}>
                                    <span style={{ display: 'inline-flex', gap: 4 }}>
                                        <IconButton
                                            label="Gras"
                                            active={Boolean(currentText.bold)}
                                            onClick={() => updateActiveText('bold', !currentText.bold)}
                                        >
                                            <Bold size={14} />
                                        </IconButton>
                                        <IconButton
                                            label="Italique"
                                            active={Boolean(currentText.italic)}
                                            onClick={() => updateActiveText('italic', !currentText.italic)}
                                        >
                                            <Italic size={14} />
                                        </IconButton>
                                    </span>
                                    <input
                                        type="color"
                                        className={styles.colorInput}
                                        value={currentText.color}
                                        aria-label="Couleur du texte"
                                        onChange={(event) => updateActiveText('color', event.target.value)}
                                    />
                                    <IconButton label="Supprimer le texte" onClick={deleteActiveText}>
                                        <Trash2 size={14} />
                                    </IconButton>
                                </div>
                                <Slider
                                    label="Taille"
                                    value={currentText.scale ?? 100}
                                    onChange={(value) => updateActiveText('scale', value)}
                                    min={20}
                                    max={300}
                                    defaultValue={100}
                                    formatValue={(v) => `${v}%`}
                                />
                            </div>
                        ) : null}
                    </section>

                    {/* Stickers: le moteur d'assets existant ne fournit qu'un
                        élément, le scotch — on l'expose tel quel plutôt que de
                        réécrire un moteur. */}
                    <section className={styles.block}>
                        <div className={styles.blockHead}>
                            <h3 className={styles.blockTitle}><Sticker size={13} />Stickers</h3>
                            <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => addAsset('tape')}>
                                Scotch
                            </Button>
                        </div>
                        {assets.length > 0 ? (
                            <div className={styles.textList}>
                                {assets.map((asset, index) => (
                                    <button
                                        key={asset.id}
                                        type="button"
                                        className={cx(styles.textRow, asset.id === activeAssetId && styles.textRowActive)}
                                        onClick={() => setActiveAssetId(asset.id === activeAssetId ? null : asset.id)}
                                    >
                                        <span className={styles.textRowContent}>Scotch {index + 1}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.blockHint}>
                                Aucun sticker. Ajoute un scotch, puis glisse-le sur l&apos;aperçu.
                            </p>
                        )}
                        {currentAsset ? (
                            <div className={styles.textEditor}>
                                <Slider
                                    label="Rotation"
                                    value={currentAsset.rotate ?? 0}
                                    onChange={(value) => updateActiveAsset('rotate', value)}
                                    min={-45} max={45} defaultValue={-5}
                                    formatValue={(v) => `${v}°`}
                                />
                                <Slider
                                    label="Opacité"
                                    value={currentAsset.opacity ?? 90}
                                    onChange={(value) => updateActiveAsset('opacity', value)}
                                    min={10} max={100} defaultValue={90}
                                    formatValue={(v) => `${v}%`}
                                />
                                <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={deleteActiveAsset}>
                                    Supprimer ce sticker
                                </Button>
                            </div>
                        ) : null}
                    </section>

                    {/* Éditeur de zones du modèle personnalisé */}
                    {isCustomTemplate ? (
                        <section className={styles.block}>
                            <div className={styles.blockHead}>
                                <h3 className={styles.blockTitle}><LayoutTemplate size={13} />Zones</h3>
                                <span className={styles.blockHint}>{customZones.length} zone{customZones.length > 1 ? 's' : ''}</span>
                            </div>
                            <Button
                                variant={isZoneEditOpen ? 'primary' : 'secondary'}
                                block
                                onClick={() => setIsZoneEditOpen((open) => !open)}
                                data-testid="vibeos-zone-edit-toggle"
                            >
                                {isZoneEditOpen ? 'Terminer le placement' : 'Déplacer et redimensionner'}
                            </Button>
                            <p className={styles.blockHint}>
                                Ajoute un bloc : clique une forme, ou glisse-la où tu veux sur l&apos;aperçu.
                            </p>
                            <div className={styles.shapeGrid}>
                                {CUSTOM_SHAPE_LIBRARY.map((shape) => (
                                    <button
                                        key={shape.id}
                                        type="button"
                                        draggable
                                        className={styles.shapeButton}
                                        title={shape.description}
                                        onDragStart={(event) => {
                                            event.dataTransfer.setData(SHAPE_DATA_TYPE, shape.id);
                                            event.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        onClick={() => {
                                            setIsZoneEditOpen(true);
                                            addCustomZone(shape, null);
                                        }}
                                    >
                                        <span
                                            className={styles.shapeGlyph}
                                            style={{ width: `${shape.w * 62}px`, height: `${shape.h * 62}px` }}
                                        />
                                        <span className={styles.shapeLabel}>{shape.label}</span>
                                    </button>
                                ))}
                            </div>
                            {selectedSlotIndex !== null && customZones.some((zone) => zone.id === selectedSlotIndex) ? (
                                <div className={styles.textEditor}>
                                    {(() => {
                                        const zone = customZones.find((item) => item.id === selectedSlotIndex);
                                        return (
                                            <>
                                                <Slider
                                                    label="Largeur"
                                                    value={Math.round(zone.w * 100)}
                                                    onChange={(value) => updateCustomZone(zone.id, { w: value / 100 })}
                                                    min={8} max={100} formatValue={(v) => `${v}%`}
                                                />
                                                <Slider
                                                    label="Hauteur"
                                                    value={Math.round(zone.h * 100)}
                                                    onChange={(value) => updateCustomZone(zone.id, { h: value / 100 })}
                                                    min={8} max={100} formatValue={(v) => `${v}%`}
                                                />
                                                <Slider
                                                    label="Position horizontale"
                                                    value={Math.round(zone.x * 100)}
                                                    onChange={(value) => updateCustomZone(zone.id, { x: value / 100 })}
                                                    min={0} max={100} formatValue={(v) => `${v}%`}
                                                />
                                                <Slider
                                                    label="Position verticale"
                                                    value={Math.round(zone.y * 100)}
                                                    onChange={(value) => updateCustomZone(zone.id, { y: value / 100 })}
                                                    min={0} max={100} formatValue={(v) => `${v}%`}
                                                />
                                                <Slider
                                                    label="Arrondi de la zone"
                                                    value={zone.radius !== undefined ? Math.round(zone.radius) : radius}
                                                    onChange={(value) => updateCustomZone(zone.id, { radius: value })}
                                                    min={0} max={100} formatValue={(v) => `${v}px`}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<Trash2 size={13} />}
                                                    onClick={() => deleteCustomZone(zone.id)}
                                                >
                                                    Supprimer cette zone
                                                </Button>
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : null}
                            {customZones.length > 0 ? (
                                <Button variant="ghost" size="sm" icon={<Eraser size={13} />} onClick={clearCustomZones}>
                                    Vider le canevas
                                </Button>
                            ) : null}
                        </section>
                    ) : null}

                    {/* Textures du fond (moteur existant : une texture active, opacité) */}
                    <section className={styles.block}>
                        <div className={styles.blockHead}>
                            <h3 className={styles.blockTitle}><Layers size={13} />Textures du fond</h3>
                            <label className={styles.slotImport}>
                                <Plus size={13} />
                                Importer
                                <input
                                    ref={textureImportRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className={styles.hiddenInput}
                                    onChange={handleTextureUpload}
                                    data-testid="vibeos-texture-input"
                                />
                            </label>
                        </div>
                        {layoutTextures.length > 0 ? (
                            <>
                                <div className={styles.textureGrid}>
                                    {layoutTextures.map((texture) => (
                                        <span
                                            key={texture.id}
                                            className={cx(
                                                styles.textureThumb,
                                                texture.id === activeTextureId && styles.textureThumbActive,
                                            )}
                                        >
                                            <button
                                                type="button"
                                                className={styles.textureSelect}
                                                aria-label={`Utiliser ${texture.name}`}
                                                aria-pressed={texture.id === activeTextureId}
                                                onClick={() => setActiveTextureId(texture.id)}
                                            >
                                                <img src={texture.src} alt="" />
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.importedRemove}
                                                aria-label={`Retirer ${texture.name}`}
                                                onClick={() => removeTexture(texture.id)}
                                            >
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <Slider
                                    label="Opacité de la texture"
                                    value={layoutTextureOpacity}
                                    onChange={setLayoutTextureOpacity}
                                    min={0} max={100} defaultValue={60}
                                    formatValue={(v) => `${v}%`}
                                />
                            </>
                        ) : (
                            <p className={styles.blockHint}>
                                Aucune texture. Importe un papier, un béton, un tissu : il passe sous tes images.
                            </p>
                        )}
                    </section>

                    {selectedSlotConfig ? (
                        <section className={styles.block}>
                            <h3 className={styles.blockTitle}>Zone sélectionnée</h3>
                            <p className={styles.blockHint}>Ajuste l&apos;image dans sa zone (clique une zone sur l&apos;aperçu pour en changer).</p>
                            <Slider
                                label="Zoom"
                                value={Math.round((selectedSlotConfig.zoom ?? 1) * 100)}
                                onChange={(v) => updateSlotConfig('zoom', v / 100)}
                                min={100} max={300} defaultValue={100}
                                formatValue={(v) => `${v}%`}
                            />
                            <Slider
                                label="Décalage horizontal"
                                value={selectedSlotConfig.x ?? 0}
                                onChange={(v) => updateSlotConfig('x', v)}
                                min={-100} max={100} defaultValue={0}
                            />
                            <Slider
                                label="Décalage vertical"
                                value={selectedSlotConfig.y ?? 0}
                                onChange={(v) => updateSlotConfig('y', v)}
                                min={-100} max={100} defaultValue={0}
                            />
                            <Slider
                                label="Bordure"
                                value={selectedSlotConfig.border ?? 0}
                                onChange={(v) => updateSlotConfig('border', v)}
                                min={0} max={40} defaultValue={0}
                                formatValue={(v) => `${v}px`}
                            />
                            <Slider
                                label="Flou de la zone"
                                value={selectedSlotConfig.blur ?? 0}
                                onChange={(v) => updateSlotConfig('blur', v)}
                                min={0} max={20} defaultValue={0}
                                formatValue={(v) => `${v}px`}
                            />
                        </section>
                    ) : null}

                    <section className={styles.block}>
                        <h3 className={styles.blockTitle}>Géométrie fine</h3>
                        {activeTemplate.id === 'filmstrip' ? (
                            <div className={styles.rowSplit}>
                                <span className={styles.rowLabel}>Orientation pellicule</span>
                                <Segmented
                                    label="Orientation"
                                    value={overlayMode}
                                    onChange={setOverlayMode}
                                    options={[
                                        { value: 'landscape', label: 'Paysage' },
                                        { value: 'portrait', label: 'Portrait' },
                                    ]}
                                />
                            </div>
                        ) : null}
                    </section>
                </Collapsible>
            </aside>

            {/* ---------- Sheets ---------- */}
            <SlotImportSheet
                open={importTarget !== null}
                targetsSlot={importTarget?.slotId !== null && importTarget?.slotId !== undefined}
                slotLabel={importSlotLabel}
                onClose={() => setImportTarget(null)}
                onPickDevice={importTarget && importTarget.slotId === null
                    ? () => globalImportRef.current?.click()
                    : undefined}
                onPickFile={(file) => {
                    if (importTarget?.slotId === null) importImagesIntoSlots([file]);
                    else importImageIntoSlot(file, importTarget?.slotId);
                }}
                onPickBlob={(blob, name) => {
                    if (importTarget?.slotId === null) {
                        importImagesIntoSlots([new File([blob], name, { type: blob.type || 'image/jpeg' })]);
                        return;
                    }
                    importBlobIntoSlot(blob, importTarget?.slotId, name);
                }}
            />

            <GridLibrarySheet
                open={isGridLibraryOpen}
                onClose={() => setIsGridLibraryOpen(false)}
                onApply={applyGridPreset}
                activePresetId={appliedThemedId}
                activeFormat={activeFormat}
            />

            <TemplateSheet
                open={isTemplateSheetOpen}
                onClose={() => setIsTemplateSheetOpen(false)}
                onApply={applyThemedTemplate}
                appliedTemplateId={appliedThemedId}
            />

            <MeshSheet
                open={isMeshSheetOpen}
                onClose={() => setIsMeshSheetOpen(false)}
                initialColors={layoutBgMeshColors}
                isActive={layoutBgGradient}
                onApply={applyLayoutMesh}
                onRemove={clearGeneratedBackground}
            />

            <LumenSheet
                open={isLumenSheetOpen}
                onClose={() => setIsLumenSheetOpen(false)}
                onUseBackground={applyLumenBackground}
            />

            <InstaPreviewSheet
                open={Boolean(instaPreview)}
                onClose={() => setInstaPreview(null)}
                slides={instaPreview?.slides}
                format={instaPreview?.format || activeFormat}
                loading={instaPreview?.loading}
                error={instaPreview?.error}
            />

            <SmoothBlurSheet
                open={isSmoothBlurSheetOpen}
                onClose={() => setIsSmoothBlurSheetOpen(false)}
                config={layoutSmoothBlur}
                onChange={setLayoutSmoothBlur}
            />

            <Sheet
                open={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                title="Exporter le visuel"
            >
                <div className={styles.exportRow}>
                    <span className={styles.rowLabel}>Nom du fichier</span>
                    <input
                        type="text"
                        className={styles.textInput}
                        value={exportName}
                        aria-label="Nom du fichier"
                        onChange={(event) => setExportName(event.target.value)}
                    />
                </div>
                <div className={styles.rowSplit}>
                    <span className={styles.rowLabel}>Format</span>
                    <Segmented
                        label="Format d'export"
                        value={exportFormat}
                        onChange={setExportFormat}
                        options={[
                            { value: 'jpg', label: 'JPG' },
                            { value: 'png', label: 'PNG' },
                            { value: 'webp', label: 'WebP' },
                        ]}
                    />
                </div>
                {exportFormat !== 'png' ? (
                    <Slider label="Qualité" value={exportQuality} onChange={setExportQuality} min={40} max={100} defaultValue={90} formatValue={(v) => `${v}%`} />
                ) : null}
                <p className={styles.exportEstimate}>
                    Poids estimé : <span data-numeric>{estimatedSize || '—'}</span>
                    {(activeFormat.id === 'pano-2' || activeFormat.id === 'pano-3') ? ' · export en tranches panorama' : ''}
                </p>
                <Button variant="primary" size="lg" block icon={<Download size={15} />} onClick={performExport}>
                    Télécharger
                </Button>
            </Sheet>
        </div>
    );
}
