"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bold, Columns2, Download, Eraser, ImagePlus, Italic, LayoutTemplate, Layers, Maximize2,
    Plus, Redo2, Smartphone, Sparkles, Sticker, Trash2, Type, Undo2, Upload, Waves, X,
} from 'lucide-react';
import {
    CUSTOM_LAYOUT_PRESETS, CUSTOM_SHAPE_LIBRARY, FONT_OPTIONS, FORMATS, TEMPLATES,
} from '../../vibefx-studio/data/constants';
import {
    Button, Collapsible, IconButton, Progress, Segmented, Sheet, Slider, Tile, TileGrid,
} from '../primitives';
import useLayoutEditor from './useLayoutEditor';
import TemplateSheet from './TemplateSheet';
import TemplatePreviewSvg from './TemplatePreviewSvg';
import MeshSheet from './MeshSheet';
import LumenSheet from './LumenSheet';
import SmoothBlurSheet from './SmoothBlurSheet';
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

function makeFileEvent(files) {
    return { target: { files, value: '' } };
}

export default function LayoutScreen() {
    const editor = useLayoutEditor();
    const {
        images, activeFormat, setActiveFormat,
        activeTemplate, setActiveTemplate, overlayMode, setOverlayMode,
        texts, activeTextId, setActiveTextId,
        padding, setPadding, gap, setGap, radius, setRadius,
        customLayoutGap, setCustomLayoutGap,
        layoutBgColor, setLayoutBgColor,
        layoutBgBlur, setLayoutBgBlur,
        layoutBgTexture, setLayoutBgTexture,
        selectedSlotIndex, setSelectedSlotIndex,
        slotModel, hasRenderableOutput, isProcessing, loadingProgress, isHydrating,
        canvasRef, handlePointerDown, handlePointerMove, handlePointerUp,
        handleImageUpload, handleSlotImageUpload, handleRemoveImage, handleRemoveSlotImage,
        addText, updateActiveText, deleteActiveText, currentText,
        assets, activeAssetId, setActiveAssetId,
        addAsset, updateActiveAsset, deleteActiveAsset, currentAsset,
        applyCustomPreset, applyThemedTemplate,
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
    const [instaPreviewUrl, setInstaPreviewUrl] = useState(null);
    const [isZoneEditOpen, setIsZoneEditOpen] = useState(false);
    const globalImportRef = useRef(null);
    const textureImportRef = useRef(null);
    const canvasWrapRef = useRef(null);

    const {
        exportName, setExportName, exportFormat, setExportFormat,
        exportQuality, setExportQuality, estimatedSize,
        isExportModalOpen, setIsExportModalOpen, handleDownload, performExport,
    } = exportController;

    const isCustomTemplate = activeTemplate.id === 'custom';
    const customZones = useMemo(
        () => (isCustomTemplate ? (activeTemplate.customLayout?.zones || []) : []),
        [isCustomTemplate, activeTemplate],
    );
    const canvasBox = useCanvasBox(canvasRef, canvasWrapRef, `${activeFormat.id}-${hasRenderableOutput}`);
    const originalImageSrc = images[0]?.src || null;
    const appliedThemedId = activeTemplate.customLayout?.presetId;
    const hasGeneratedBackground = layoutBgGradient || Boolean(layoutLumenBackground);
    const backgroundMode = hasGeneratedBackground ? 'generated' : (layoutBgBlur ? 'blur' : 'color');
    const smoothBlurOn = Boolean(layoutSmoothBlur?.enabled);
    const selectedSlotConfig = selectedSlotIndex !== null
        ? (slotConfigs[selectedSlotIndex] || { zoom: 1, x: 0, y: 0, border: 0, blur: 0 })
        : null;

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
        if (files.length) handleImageUpload(makeFileEvent(files));
    };

    const handleFullscreen = () => {
        canvasRef.current?.requestFullscreen?.();
    };

    const openInstaPreview = () => {
        try {
            setInstaPreviewUrl(canvasRef.current?.toDataURL('image/jpeg', 0.92) || null);
        } catch {
            setInstaPreviewUrl(null);
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
                        <Button variant="primary" size="lg" icon={<Upload size={15} />} onClick={() => globalImportRef.current?.click()}>
                            Importer des images
                        </Button>
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
                                onClick={() => setActiveTemplate(template)}
                            />
                        ))}
                        <Tile
                            active={isCustomTemplate}
                            visual={<LayoutTemplate size={20} />}
                            label="Personnalisé"
                            onClick={() => applyCustomPreset(CUSTOM_LAYOUT_PRESETS[0])}
                        />
                    </TileGrid>
                    {isCustomTemplate ? (
                        <TileGrid aria-label="Préréglages personnalisés">
                            {CUSTOM_LAYOUT_PRESETS.map((preset) => (
                                <Tile
                                    key={preset.id}
                                    active={appliedThemedId === preset.id}
                                    visual={<TemplatePreviewSvg zones={preset.zones} ratio={1.2} width="44px" />}
                                    label={preset.label}
                                    onClick={() => applyCustomPreset(preset)}
                                />
                            ))}
                        </TileGrid>
                    ) : null}
                </section>

                {/* 3. Images */}
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3 className={styles.blockTitle}><span className={styles.blockStep}>3</span>Images</h3>
                        <label className={styles.slotImport}>
                            <Plus size={13} />
                            Ajouter
                            <input
                                ref={globalImportRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className={styles.hiddenInput}
                                onChange={handleImageUpload}
                                data-testid="vibeos-image-input"
                            />
                        </label>
                    </div>
                    <div className={styles.slotList}>
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
                    {images.length > 0 ? (
                        <div className={styles.importedStrip} aria-label="Images importées">
                            {images.map((img, index) => (
                                <span key={`${img.name || 'img'}-${index}`} className={styles.importedThumb}>
                                    <img src={img.src} alt={img.name || `Image ${index + 1}`} />
                                    <button
                                        type="button"
                                        className={styles.importedRemove}
                                        aria-label={`Retirer ${img.name || `l'image ${index + 1}`}`}
                                        onClick={() => handleRemoveImage(index)}
                                    >
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : null}
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
                    <Slider label="Marge" value={padding} onChange={setPadding} min={0} max={150} defaultValue={40} formatValue={(v) => `${v}px`} />
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
                        <Slider label="Écart entre zones" value={gap} onChange={setGap} min={0} max={100} defaultValue={20} formatValue={(v) => `${v}px`} />
                        {isCustomTemplate ? (
                            <Slider label="Écart (modèle personnalisé)" value={customLayoutGap} onChange={setCustomLayoutGap} min={0} max={80} defaultValue={12} formatValue={(v) => `${v}px`} />
                        ) : null}
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
                open={Boolean(instaPreviewUrl)}
                onClose={() => setInstaPreviewUrl(null)}
                previewUrl={instaPreviewUrl}
                format={activeFormat}
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
