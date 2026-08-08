"use client";

import React, { useRef, useState } from 'react';
import {
    Columns2, Crop, Dices, Download, Redo2, RotateCcw, Save, ShieldCheck, Trash2, Undo2, Upload,
} from 'lucide-react';
import {
    Badge, Button, Collapsible, IconButton, Segmented, Sheet, Slider,
} from '../primitives';
import MeshSheet, { meshPreviewStyle } from '../shared/MeshSheet';
import LumenSheet from '../shared/LumenSheet';
import PipelineSourceNote from '../project/PipelineSourceNote';
import useStudioEditor, { CROP_RATIOS } from './useStudioEditor';
import styles from './studio.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

/* Reglages manuels: les memes cles que l'ancien StylePanel, regroupees par
   intention plutot que par nom technique. */
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
            { key: 'saturation', label: 'Saturation', min: 0, max: 180, defaultValue: 100, unit: '%' },
            { key: 'vibrance', label: 'Éclat des couleurs', min: -50, max: 50, defaultValue: 0 },
            { key: 'temperature', label: 'Température', min: -30, max: 30, defaultValue: 0 },
            { key: 'sepia', label: 'Sépia', min: 0, max: 100, defaultValue: 0, unit: '%' },
        ],
    },
    {
        id: 'texture',
        title: 'Matière et effets',
        controls: [
            { key: 'clarity', label: 'Relief', min: -30, max: 40, defaultValue: 0 },
            { key: 'sharpness', label: 'Netteté', min: 0, max: 50, defaultValue: 0 },
            { key: 'blur', label: 'Flou', min: 0, max: 10, defaultValue: 0, unit: ' px' },
            { key: 'grain', label: 'Grain', min: 0, max: 100, defaultValue: 0 },
            { key: 'vignette', label: 'Vignettage', min: 0, max: 100, defaultValue: 0 },
            { key: 'halation', label: 'Halo des lumières', min: 0, max: 60, defaultValue: 0 },
        ],
    },
];

export default function StudioScreen() {
    const editor = useStudioEditor();
    const {
        image, sourceKind, visionApplied,
        filters, setFilter,
        intensity, setIntensity,
        ambiances, previews, activeAmbianceId, message,
        variants, applyVariant,
        customStyles, saveStyle, removeStyle,
        creativeMode, setCreativeMode,
        meshColors, lumenName, applyMeshBackground, applyLumenBackground, clearGeneratedBackground,
        cropRatio, setCropRatio, cropScale, setCropScale, setCropPos,
        isCropping, setIsCropping,
        canvasRef, canvasEvents,
        isLoadingImage,
        handleImageUpload,
        applyAmbiance, surpriseMe, resetFilters,
        undo, redo, canUndo, canRedo,
        exportController,
    } = editor;

    const [isComparing, setIsComparing] = useState(false);
    const [isMeshSheetOpen, setIsMeshSheetOpen] = useState(false);
    const [isLumenSheetOpen, setIsLumenSheetOpen] = useState(false);
    const [styleName, setStyleName] = useState('');
    const importRef = useRef(null);

    const {
        exportName, setExportName, exportFormat, setExportFormat,
        exportQuality, setExportQuality, estimatedSize,
        isExportModalOpen, setIsExportModalOpen, handleDownload, performExport,
    } = exportController;

    const activeAmbiance = ambiances.find((item) => item.id === activeAmbianceId) || null;
    const matchBackground = activeAmbiance?.background || null;

    /* Maintien du clic = photo d'origine, cadree comme le canvas. */
    const compareHandlers = {
        onPointerDown: () => setIsComparing(true),
        onPointerUp: () => setIsComparing(false),
        onPointerLeave: () => setIsComparing(false),
        onPointerCancel: () => setIsComparing(false),
    };

    return (
        <div className={styles.screen} data-testid="vibeos-studio-screen">
            {/* ---------- Aperçu ---------- */}
            <section className={styles.stage} aria-label="Aperçu de l'image">
                {image ? (
                    <>
                        <div className={styles.stageActions}>
                            <IconButton label="Annuler" disabled={!canUndo} onClick={undo}>
                                <Undo2 size={15} />
                            </IconButton>
                            <IconButton label="Rétablir" disabled={!canRedo} onClick={redo}>
                                <Redo2 size={15} />
                            </IconButton>
                            <IconButton
                                label="Comparer avec l'original (maintiens le clic)"
                                active={isComparing}
                                {...compareHandlers}
                            >
                                <Columns2 size={15} />
                            </IconButton>
                            <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={handleDownload}>
                                Exporter
                            </Button>
                        </div>
                        <div className={styles.canvasWrap}>
                            <canvas
                                ref={canvasRef}
                                className={cx(styles.canvas, isCropping && styles.canvasCropping, isComparing && styles.canvasHidden)}
                                onMouseDown={canvasEvents.handlePointerDown}
                                onMouseMove={canvasEvents.handlePointerMove}
                                onMouseUp={canvasEvents.handlePointerUp}
                                onMouseLeave={canvasEvents.handlePointerUp}
                                onTouchStart={canvasEvents.handlePointerDown}
                                onTouchMove={canvasEvents.handlePointerMove}
                                onTouchEnd={canvasEvents.handlePointerUp}
                            />
                            {isComparing ? (
                                <img
                                    src={image.src}
                                    alt="Image d'origine"
                                    className={styles.compareImage}
                                    data-testid="vibeos-studio-compare"
                                />
                            ) : null}
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyStage}>
                        <h2 className={styles.emptyStageTitle}>Choisis une image</h2>
                        <p className={styles.emptyStageBody}>
                            Importe une photo : le Studio te propose des ambiances complètes,
                            prêtes en un clic, rendues sur ta vraie image.
                        </p>
                        <Button
                            variant="primary"
                            size="lg"
                            icon={<Upload size={15} />}
                            onClick={() => importRef.current?.click()}
                        >
                            Importer une image
                        </Button>
                    </div>
                )}
            </section>

            {/* ---------- Panneau ---------- */}
            <aside className={styles.panel} aria-label="Réglages Studio">
                <input
                    ref={importRef}
                    type="file"
                    accept="image/*"
                    className={styles.hiddenInput}
                    onChange={handleImageUpload}
                    data-testid="vibeos-studio-input"
                />

                {/* Ambiances */}
                <section className={styles.block}>
                    <PipelineSourceNote
                        kind={sourceKind}
                        stage="studio"
                        visionApplied={visionApplied}
                        testId="vibeos-studio-source"
                    />
                    <div className={styles.blockHead}>
                        <h3 className={styles.blockTitle}>Ambiances</h3>
                        <span className={styles.blockHint}>{ambiances.length} en un clic</span>
                    </div>
                    <Button
                        variant="primary"
                        size="lg"
                        block
                        icon={<Dices size={16} />}
                        disabled={!image || isLoadingImage}
                        onClick={surpriseMe}
                        data-testid="vibeos-studio-surprise"
                    >
                        Surprends-moi
                    </Button>
                    {message ? (
                        <p className={styles.message} data-testid="vibeos-studio-message">{message}</p>
                    ) : (
                        <p className={styles.blockHint}>
                            Chaque ambiance est un ensemble complet : couleurs, grain, vignettage
                            et un fond assorti pour ta composition.
                        </p>
                    )}
                    <div className={styles.ambianceGrid} data-testid="vibeos-studio-ambiances">
                        {ambiances.map((ambiance) => (
                            <button
                                key={ambiance.id}
                                type="button"
                                className={cx(
                                    styles.ambianceCard,
                                    ambiance.id === activeAmbianceId && styles.ambianceCardActive,
                                )}
                                onClick={() => applyAmbiance(ambiance)}
                                title={ambiance.source}
                            >
                                <span className={styles.ambianceThumb}>
                                    {previews[ambiance.id]
                                        ? <img src={previews[ambiance.id]} alt="" />
                                        : <span className={styles.ambianceThumbEmpty} />}
                                </span>
                                <span className={styles.ambianceLabel}>{ambiance.label}</span>
                                <span className={styles.ambianceHint}>{ambiance.hint}</span>
                                {ambiance.custom ? (
                                    <span className={cx(styles.ambianceBadge, styles.ambianceBadgeCustom)}>Perso</span>
                                ) : ambiance.suits ? (
                                    <span className={styles.ambianceBadge}>Va bien ici</span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                    <Slider
                        label="Intensité"
                        value={intensity}
                        onChange={setIntensity}
                        min={0}
                        max={100}
                        defaultValue={80}
                        formatValue={(value) => `${value}%`}
                    />
                    {matchBackground ? (
                        <div className={styles.matchRow}>
                            <span className={styles.rowLabel}>
                                <span className={styles.matchSwatches} aria-hidden="true">
                                    {matchBackground.colors.map((color) => (
                                        <span key={color} style={{ background: color }} />
                                    ))}
                                </span>
                                Fond assorti : {matchBackground.label}
                            </span>
                            <Button size="sm" onClick={() => applyMeshBackground(matchBackground.colors)}>
                                Utiliser
                            </Button>
                        </div>
                    ) : null}
                </section>

                {/* Variantes */}
                {variants.length ? (
                    <section className={styles.block}>
                        <div className={styles.blockHead}>
                            <h3 className={styles.blockTitle}>Variantes</h3>
                            <span className={styles.blockHint}>tes {variants.length} derniers essais</span>
                        </div>
                        <div className={styles.variantRow} data-testid="vibeos-studio-variants">
                            {variants.map((variant) => (
                                <button
                                    key={variant.id}
                                    type="button"
                                    className={styles.variantCard}
                                    onClick={() => applyVariant(variant)}
                                    title={`Revenir à « ${variant.label} »`}
                                >
                                    <span className={styles.variantThumb}>
                                        {variant.thumb
                                            ? <img src={variant.thumb} alt="" />
                                            : <span className={styles.ambianceThumbEmpty} />}
                                    </span>
                                    <span className={styles.variantLabel}>{variant.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                ) : null}

                {/* Fond généré */}
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3 className={styles.blockTitle}>Fond généré</h3>
                    </div>
                    <p className={styles.blockHint}>
                        Le fond habille ta composition dans Mise en page — il n&apos;est pas
                        appliqué sur la photo elle-même.
                    </p>
                    <div className={styles.generatedChoices}>
                        <Button
                            variant={meshColors ? 'primary' : 'secondary'}
                            block
                            onClick={() => setIsMeshSheetOpen(true)}
                            data-testid="vibeos-studio-mesh"
                        >
                            Mesh
                        </Button>
                        <Button
                            variant={lumenName ? 'primary' : 'secondary'}
                            block
                            onClick={() => setIsLumenSheetOpen(true)}
                        >
                            Lumen
                        </Button>
                    </div>
                    {meshColors ? (
                        <div className={styles.meshCard} data-testid="vibeos-studio-mesh-preview">
                            <span className={styles.meshSwatch} style={meshPreviewStyle(meshColors)} aria-hidden="true" />
                            <div className={styles.rowSplit}>
                                <span className={styles.rowLabel}>Fond Mesh actif</span>
                                <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={clearGeneratedBackground}>
                                    Retirer
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {lumenName ? (
                        <div className={styles.rowSplit}>
                            <span className={styles.rowLabel}>Fond Lumen : {lumenName}</span>
                            <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={clearGeneratedBackground}>
                                Retirer
                            </Button>
                        </div>
                    ) : null}
                </section>

                {/* Réglages avancés */}
                <Collapsible title="Réglages avancés" defaultOpen={false} testId="vibeos-studio-advanced">
                    <section className={styles.block}>
                        <div className={styles.rowSplit}>
                            <span className={styles.rowLabel}>
                                <ShieldCheck size={13} /> Garde-fous smartphone
                            </span>
                            <Segmented
                                label="Garde-fous smartphone"
                                value={creativeMode ? 'off' : 'on'}
                                onChange={(value) => setCreativeMode(value === 'off')}
                                options={[
                                    { value: 'on', label: 'Actifs' },
                                    { value: 'off', label: 'Créatif' },
                                ]}
                            />
                        </div>
                        <p className={styles.blockHint}>
                            Actifs, ils empêchent les peaux orange et les noirs bouchés. En mode
                            créatif, les ambiances tapent aussi fort qu&apos;elles le veulent.
                        </p>
                    </section>

                    {/* Recadrage */}
                    <section className={styles.block}>
                        <div className={styles.blockHead}>
                            <h3 className={styles.blockTitle}><Crop size={13} /> Recadrage</h3>
                        </div>
                        <Segmented
                            label="Proportions"
                            value={cropRatio}
                            onChange={(value) => {
                                setCropRatio(value);
                                setCropPos({ x: 0, y: 0 });
                            }}
                            options={CROP_RATIOS}
                        />
                        <Slider
                            label="Zoom"
                            value={Math.round(cropScale * 100)}
                            onChange={(value) => setCropScale(value / 100)}
                            min={100}
                            max={300}
                            defaultValue={100}
                            formatValue={(value) => `${value}%`}
                        />
                        <div className={styles.rowSplit}>
                            <span className={styles.rowLabel}>Déplacer l&apos;image à la souris</span>
                            <Segmented
                                label="Déplacement du cadrage"
                                value={isCropping ? 'on' : 'off'}
                                onChange={(value) => setIsCropping(value === 'on')}
                                options={[
                                    { value: 'off', label: 'Non' },
                                    { value: 'on', label: 'Oui' },
                                ]}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<RotateCcw size={13} />}
                            onClick={() => {
                                setCropRatio('original');
                                setCropScale(1);
                                setCropPos({ x: 0, y: 0 });
                            }}
                        >
                            Recentrer
                        </Button>
                    </section>

                    {ADVANCED_GROUPS.map((group) => (
                        <section key={group.id} className={styles.block}>
                            <h3 className={styles.blockTitle}>{group.title}</h3>
                            {group.controls.map((control) => (
                                <Slider
                                    key={control.key}
                                    label={control.label}
                                    value={filters[control.key] ?? control.defaultValue}
                                    onChange={(value) => setFilter(control.key, value)}
                                    min={control.min}
                                    max={control.max}
                                    defaultValue={control.defaultValue}
                                    formatValue={(value) => `${value}${control.unit || ''}`}
                                />
                            ))}
                        </section>
                    ))}

                    <section className={styles.block}>
                        <div className={styles.rowSplit}>
                            <span className={styles.rowLabel}>Teinte</span>
                            <input
                                type="color"
                                className={styles.colorInput}
                                value={filters.tintColor || '#ffffff'}
                                aria-label="Couleur de la teinte"
                                onChange={(event) => setFilter('tintColor', event.target.value)}
                            />
                        </div>
                        <Slider
                            label="Force de la teinte"
                            value={filters.tintIntensity || 0}
                            onChange={(value) => setFilter('tintIntensity', value)}
                            min={0}
                            max={100}
                            defaultValue={0}
                            formatValue={(value) => `${value}%`}
                        />
                    </section>

                    {/* Styles perso */}
                    <section className={styles.block}>
                        <div className={styles.blockHead}>
                            <h3 className={styles.blockTitle}>Mes styles</h3>
                            <Badge>{customStyles.length}</Badge>
                        </div>
                        <p className={styles.blockHint}>
                            Enregistre les réglages actuels : le style rejoint le haut des
                            ambiances, sur cet appareil.
                        </p>
                        <div className={styles.saveStyleRow}>
                            <input
                                type="text"
                                className={styles.textInput}
                                value={styleName}
                                placeholder="Nom du style"
                                aria-label="Nom du style"
                                onChange={(event) => setStyleName(event.target.value)}
                                data-testid="vibeos-studio-style-name"
                            />
                            <Button
                                icon={<Save size={13} />}
                                disabled={!styleName.trim()}
                                onClick={() => {
                                    saveStyle(styleName);
                                    setStyleName('');
                                }}
                                data-testid="vibeos-studio-style-save"
                            >
                                Enregistrer
                            </Button>
                        </div>
                        {customStyles.length ? (
                            <div className={styles.styleList}>
                                {customStyles.map((style) => (
                                    <div key={style.id} className={styles.styleRow}>
                                        {style.label}
                                        <IconButton label={`Supprimer ${style.label}`} onClick={() => removeStyle(style.id)}>
                                            <Trash2 size={14} />
                                        </IconButton>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={resetFilters}>
                            Tout remettre à zéro
                        </Button>
                    </section>
                </Collapsible>
            </aside>

            {/* ---------- Sheets ---------- */}
            <MeshSheet
                open={isMeshSheetOpen}
                onClose={() => setIsMeshSheetOpen(false)}
                initialColors={meshColors}
                isActive={Boolean(meshColors)}
                onApply={applyMeshBackground}
                onRemove={clearGeneratedBackground}
            />

            <LumenSheet
                open={isLumenSheetOpen}
                onClose={() => setIsLumenSheetOpen(false)}
                onUseBackground={applyLumenBackground}
            />

            <Sheet
                open={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                title="Exporter l'image"
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
