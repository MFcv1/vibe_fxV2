"use client";

import React, { useMemo, useRef, useState } from 'react';
import {
    Columns2, Download, ImageOff, ImagePlus, Images, Redo2, RotateCcw, ShieldCheck, Sparkles, Undo2, Upload,
} from 'lucide-react';
import Link from 'next/link';
import {
    Badge, Button, Collapsible, IconButton, Segmented, Sheet, Slider,
} from '../primitives';
import BeforeAfter, { COMPARE_MODES } from '../shared/BeforeAfter';
import PipelineSourceNote from '../project/PipelineSourceNote';
import useVisionEditor from './useVisionEditor';
import { describeSignals } from './autoEnhance';
import styles from './vision.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

/* Reglages fins: exactement les cles supportees par le moteur Vision v3
   (utils/visionColorScience.VISION_SUPPORTED_FILTER_KEYS). */
const ADVANCED_GROUPS = [
    {
        id: 'light',
        title: 'Lumière',
        controls: [
            { key: 'brightness', label: 'Luminosité', min: 60, max: 140, defaultValue: 100, unit: '%' },
            { key: 'contrast', label: 'Contraste', min: 60, max: 180, defaultValue: 100, unit: '%' },
            { key: 'highlights', label: 'Hautes lumières', min: -50, max: 50, defaultValue: 0 },
            { key: 'shadows', label: 'Ombres', min: -50, max: 50, defaultValue: 0 },
        ],
    },
    {
        id: 'color',
        title: 'Couleur',
        controls: [
            { key: 'temperature', label: 'Température', min: -30, max: 30, defaultValue: 0 },
            { key: 'saturation', label: 'Saturation', min: 0, max: 180, defaultValue: 100, unit: '%' },
            { key: 'vibrance', label: 'Éclat des couleurs', min: -50, max: 50, defaultValue: 0 },
            { key: 'skinSaturation', label: 'Teintes de peau', min: -30, max: 30, defaultValue: 0 },
            { key: 'skySaturation', label: 'Ciel', min: -40, max: 40, defaultValue: 0 },
            { key: 'foliageSaturation', label: 'Verdure', min: -40, max: 40, defaultValue: 0 },
            { key: 'warmSaturation', label: 'Tons chauds', min: -40, max: 40, defaultValue: 0 },
        ],
    },
    {
        id: 'texture',
        title: 'Matière',
        controls: [
            { key: 'clarity', label: 'Relief', min: -30, max: 40, defaultValue: 0 },
            { key: 'sharpness', label: 'Netteté', min: 0, max: 50, defaultValue: 0 },
            { key: 'dehaze', label: 'Voile atmosphérique', min: 0, max: 50, defaultValue: 0 },
            { key: 'grain', label: 'Grain', min: 0, max: 80, defaultValue: 0 },
            { key: 'vignette', label: 'Vignettage', min: 0, max: 60, defaultValue: 0 },
        ],
    },
];

export default function VisionScreen() {
    const editor = useVisionEditor();
    const {
        image, metrics, signals, sourceKind,
        filters, setFilters,
        intensity, setIntensity,
        presets, previews, activePresetId,
        autoMessage, isLoadingImage,
        canvasRef, handleImageUpload, detachComposition, clearImage,
        autoEnhance, applyPreset, resetFilters,
        undo, redo, canUndo, canRedo,
        exportController,
    } = editor;

    /* Comparaison: elle reste allumee tant qu'on ne l'eteint pas, et le mode
       choisi (rideau / cote a cote / maintien) est un reglage a part entiere. */
    const [isComparing, setIsComparing] = useState(false);
    const [compareMode, setCompareMode] = useState('slider');
    const importRef = useRef(null);

    const {
        exportName, setExportName, exportFormat, setExportFormat,
        exportQuality, setExportQuality, estimatedSize,
        isExportModalOpen, setIsExportModalOpen, handleDownload, performExport,
    } = exportController;

    const signalTags = useMemo(() => (signals ? describeSignals(signals) : []), [signals]);
    const safeSmartphone = filters.safeSmartphone !== false;

    return (
        <div className={styles.screen} data-testid="vibeos-vision-screen">
            {/* ---------- Aperçu ---------- */}
            <section className={styles.stage} aria-label="Aperçu de la photo">
                {image ? (
                    <>
                        <div className={styles.stageActions}>
                            {/* Les modes vivent sur la meme ligne que les autres
                                actions de l'apercu, a gauche des fleches. */}
                            {isComparing ? (
                                <Segmented
                                    label="Mode de comparaison"
                                    value={compareMode}
                                    onChange={setCompareMode}
                                    options={COMPARE_MODES}
                                    className={styles.compareModes}
                                />
                            ) : null}
                            <IconButton label="Annuler" disabled={!canUndo} onClick={undo}>
                                <Undo2 size={15} />
                            </IconButton>
                            <IconButton label="Rétablir" disabled={!canRedo} onClick={redo}>
                                <Redo2 size={15} />
                            </IconButton>
                            <IconButton
                                label={isComparing ? 'Masquer la comparaison' : "Comparer avec l'original"}
                                active={isComparing}
                                onClick={() => setIsComparing((current) => !current)}
                                data-testid="vibeos-vision-compare-toggle"
                            >
                                <Columns2 size={15} />
                            </IconButton>
                            <IconButton
                                label="Changer de photo"
                                onClick={() => importRef.current?.click()}
                                data-testid="vibeos-vision-change-photo"
                            >
                                <ImagePlus size={15} />
                            </IconButton>
                            <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={handleDownload}>
                                Exporter
                            </Button>
                        </div>

                        <div className={styles.canvasWrap}>
                            <BeforeAfter
                                beforeSrc={image.src}
                                ratio={(image.naturalWidth || image.width) / (image.naturalHeight || image.height)}
                                mode={compareMode}
                                active={isComparing}
                                testId="vibeos-vision-compare"
                            >
                                <canvas ref={canvasRef} className={styles.canvas} />
                            </BeforeAfter>
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyStage}>
                        <h2 className={styles.emptyStageTitle}>Choisis une photo</h2>
                        <p className={styles.emptyStageBody}>
                            Importe une photo de téléphone : Vision l&apos;analyse et te propose
                            des améliorations qui ne la cassent jamais.
                        </p>
                        <div className={styles.emptyActions}>
                            <Button
                                variant="primary"
                                size="lg"
                                icon={<Upload size={15} />}
                                onClick={() => importRef.current?.click()}
                            >
                                Importer une photo
                            </Button>
                            <Button
                                as={Link}
                                href="/creer/bibliotheque"
                                variant="secondary"
                                size="lg"
                                icon={<Images size={15} />}
                            >
                                Ouvrir la bibliothèque
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            {/* ---------- Panneau ---------- */}
            <aside className={styles.panel} aria-label="Réglages Vision">
                <input
                    ref={importRef}
                    type="file"
                    accept="image/*"
                    className={styles.hiddenInput}
                    onChange={handleImageUpload}
                    data-testid="vibeos-vision-input"
                />

                <section className={styles.block}>
                    <PipelineSourceNote
                        kind={sourceKind}
                        stage="vision"
                        testId="vibeos-vision-source"
                    />
                    {/* Sortie de secours: la composition Layout est prioritaire sur
                        la photo, donc sans ce bouton on ne pouvait plus revenir a
                        une simple photo une fois une composition publiee. */}
                    {image ? (
                        <div className={styles.sourceActions}>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<ImagePlus size={13} />}
                                onClick={() => importRef.current?.click()}
                            >
                                Changer de photo
                            </Button>
                            {/* Deselection, pas suppression: la photo reste dans
                                la bibliotheque, on vide juste l'apercu. */}
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<ImageOff size={13} />}
                                onClick={clearImage}
                                title="Vide l'aperçu — la photo reste dans ta bibliothèque"
                                data-testid="vibeos-vision-clear"
                            >
                                Retirer
                            </Button>
                            {sourceKind === 'composition' ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={<RotateCcw size={13} />}
                                    onClick={detachComposition}
                                    data-testid="vibeos-vision-detach"
                                >
                                    Quitter la composition
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                    <Button
                        variant="primary"
                        size="lg"
                        block
                        icon={<Sparkles size={16} />}
                        disabled={!image || !metrics || isLoadingImage}
                        onClick={autoEnhance}
                        data-testid="vibeos-vision-auto"
                    >
                        Améliorer ma photo
                    </Button>
                    {autoMessage ? (
                        <p className={styles.autoMessage} data-testid="vibeos-vision-message">{autoMessage}</p>
                    ) : (
                        <p className={styles.blockHint}>
                            Un bouton, une analyse : lumière, relief, couleurs et teints sont corrigés
                            en gardant la photo naturelle.
                        </p>
                    )}
                    {signalTags.length ? (
                        <div className={styles.tagRow}>
                            {signalTags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                        </div>
                    ) : null}
                    <Slider
                        label="Intensité"
                        value={intensity}
                        onChange={setIntensity}
                        min={0}
                        max={100}
                        defaultValue={80}
                        formatValue={(value) => `${value}%`}
                    />
                </section>

                {/* Presets */}
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3 className={styles.blockTitle}>Presets</h3>
                        <span className={styles.blockHint}>
                            {activePresetId ? 'Reclique pour comparer' : 'Le look de base'}
                        </span>
                    </div>
                    <div className={styles.lookGrid} data-testid="vibeos-vision-presets">
                        {presets.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                className={cx(
                                    styles.lookCard,
                                    preset.id === activePresetId && styles.lookCardActive,
                                )}
                                onClick={() => applyPreset(preset)}
                                title={preset.description}
                                aria-pressed={preset.id === activePresetId}
                            >
                                <span className={styles.lookThumb}>
                                    {previews[preset.id]
                                        ? <img src={previews[preset.id]} alt="" />
                                        : <span className={styles.lookThumbEmpty} />}
                                </span>
                                <span className={styles.lookLabel}>{preset.label}</span>
                                <span className={styles.lookHint}>{preset.hint}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Réglages avancés */}
                <Collapsible title="Réglages avancés" defaultOpen={false} testId="vibeos-vision-advanced">
                    <section className={styles.block}>
                        <div className={styles.rowSplit}>
                            <span className={styles.rowLabel}>
                                <ShieldCheck size={13} /> Garde-fous smartphone
                            </span>
                            <Segmented
                                label="Garde-fous smartphone"
                                value={safeSmartphone ? 'on' : 'off'}
                                onChange={(value) => setFilters('safeSmartphone', value === 'on')}
                                options={[
                                    { value: 'on', label: 'Actifs' },
                                    { value: 'off', label: 'Libres' },
                                ]}
                            />
                        </div>
                        <p className={styles.blockHint}>
                            Actifs, ils empêchent les peaux orange, les ciels fluo et les noirs bouchés.
                            À couper seulement si tu sais ce que tu fais.
                        </p>
                    </section>

                    {ADVANCED_GROUPS.map((group) => (
                        <section key={group.id} className={styles.block}>
                            <h3 className={styles.blockTitle}>{group.title}</h3>
                            {group.controls.map((control) => (
                                <Slider
                                    key={control.key}
                                    label={control.label}
                                    value={filters[control.key] ?? control.defaultValue}
                                    onChange={(value) => setFilters(control.key, value)}
                                    min={control.min}
                                    max={control.max}
                                    defaultValue={control.defaultValue}
                                    formatValue={(value) => `${value}${control.unit || ''}`}
                                />
                            ))}
                        </section>
                    ))}

                    <section className={styles.block}>
                        <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={resetFilters}>
                            Tout remettre à zéro
                        </Button>
                    </section>
                </Collapsible>
            </aside>

            {/* ---------- Sheets ---------- */}

            <Sheet
                open={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                title="Exporter la photo"
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
                    <Slider
                        label="Qualité"
                        value={exportQuality}
                        onChange={setExportQuality}
                        min={40}
                        max={100}
                        defaultValue={90}
                        formatValue={(value) => `${value}%`}
                    />
                ) : null}
                <p className={styles.exportEstimate}>
                    Poids estimé : <span data-numeric>{estimatedSize || '—'}</span>
                </p>
                <Button variant="primary" size="lg" block icon={<Download size={15} />} onClick={performExport}>
                    Télécharger
                </Button>
            </Sheet>
        </div>
    );
}
