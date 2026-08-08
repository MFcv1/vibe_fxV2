"use client";

import React, { useMemo, useRef, useState } from 'react';
import {
    Bold, Download, ImagePlus, Italic, LayoutTemplate, Maximize2, Plus, Trash2, Type, Upload, X,
} from 'lucide-react';
import {
    CUSTOM_LAYOUT_PRESETS, FONT_OPTIONS, FORMATS, TEMPLATES,
} from '../../vibefx-studio/data/constants';
import {
    Button, Collapsible, IconButton, Progress, Segmented, Sheet, Slider, Tile, TileGrid,
} from '../primitives';
import useLayoutEditor from './useLayoutEditor';
import TemplateSheet from './TemplateSheet';
import TemplatePreviewSvg from './TemplatePreviewSvg';
import styles from './layout.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

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
        slotModel, hasRenderableOutput, isProcessing, loadingProgress,
        canvasRef, handlePointerDown, handlePointerMove, handlePointerUp,
        handleImageUpload, handleSlotImageUpload, handleRemoveImage,
        addText, updateActiveText, deleteActiveText, currentText,
        applyCustomPreset, applyThemedTemplate,
        exportController,
    } = editor;

    const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false);
    const [isDropTarget, setIsDropTarget] = useState(false);
    const globalImportRef = useRef(null);

    const {
        exportName, setExportName, exportFormat, setExportFormat,
        exportQuality, setExportQuality, estimatedSize,
        isExportModalOpen, setIsExportModalOpen, handleDownload, performExport,
    } = exportController;

    const isCustomTemplate = activeTemplate.id === 'custom';
    const appliedThemedId = activeTemplate.customLayout?.presetId;
    const backgroundMode = layoutBgBlur ? 'blur' : 'color';

    const bgOptions = useMemo(() => ([
        { value: 'color', label: 'Couleur' },
        { value: 'blur', label: "Flou de l'image" },
    ]), []);

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDropTarget(false);
        const files = Array.from(event.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
        if (files.length) handleImageUpload(makeFileEvent(files));
    };

    const handleFullscreen = () => {
        canvasRef.current?.requestFullscreen?.();
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
                            <IconButton label="Plein écran" onClick={handleFullscreen}>
                                <Maximize2 size={15} />
                            </IconButton>
                            <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={handleDownload}>
                                Exporter
                            </Button>
                        </div>
                        <div className={styles.canvasWrap}>
                            <canvas
                                ref={canvasRef}
                                className={styles.canvas}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            />
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
                                {!slot.imageSrc ? <span className={styles.blockHint}>vide</span> : null}
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
                            onChange={(value) => setLayoutBgBlur(value === 'blur')}
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
