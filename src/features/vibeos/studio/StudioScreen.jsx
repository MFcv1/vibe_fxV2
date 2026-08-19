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
import { visionBoundsFor } from '../../vibefx-studio/utils/visionColorScience';
import useStudioEditor, { CROP_RATIOS } from './useStudioEditor';
import styles from './studio.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

/*
 * Reglages manuels: les memes cles que l'ancien StylePanel, regroupees par
 * intention plutot que par nom technique.
 *
 * LES BORNES NE SONT PLUS ECRITES ICI, et ce n'est pas du rangement.
 *
 * Elles l'etaient, plus larges que celles du moteur, et la mesure du
 * 2026-08-17 (`scripts/smoke-reglages-avances.spec.cjs`, qui pousse les vrais
 * curseurs de la vraie page) a montre ce que ca donnait a l'ecran:
 *
 *   curseur     | course affichee | ce que le moteur retenait | image a fond
 *   ------------+-----------------+---------------------------+--------------
 *   Luminosité  |     60 – 140    |         85 – 115          | identique a 85
 *   Sépia       |      0 – 100    |          0 – 12           | identique a 12
 *   Flou        |      0 – 10     |          0 – 2            | identique a 2
 *   Grain       |      0 – 100    |          0 – 40           | identique a 40
 *   Vignettage  |      0 – 100    |          0 – 30           | identique a 30
 *
 * Autrement dit: la moitie de la course ne faisait rien, le nombre affiche
 * mentait, et « la luminosite ne marche pas » etait une observation JUSTE. Le
 * meme bug avait ete corrige sur /creer/vision le 2026-08-12; Studio etait
 * reste en arriere.
 *
 * Les bornes viennent donc du moteur (`visionBoundsFor`), et elles suivent le
 * mode creatif: garde-fous actifs, la course s'arrete la ou le moteur s'arrete;
 * en creatif, elle s'ouvre pour de vrai.
 */
const ADVANCED_GROUPS = [
    {
        id: 'light',
        title: 'Lumière',
        controls: [
            { key: 'brightness', label: 'Luminosité', unit: '%' },
            { key: 'contrast', label: 'Contraste', unit: '%' },
            { key: 'highlights', label: 'Hautes lumières' },
            { key: 'shadows', label: 'Ombres' },
        ],
    },
    {
        id: 'color',
        title: 'Couleur',
        controls: [
            { key: 'saturation', label: 'Saturation', unit: '%' },
            { key: 'vibrance', label: 'Éclat des couleurs' },
            { key: 'temperature', label: 'Température' },
            { key: 'sepia', label: 'Sépia', unit: '%' },
        ],
    },
    {
        id: 'texture',
        title: 'Matière et effets',
        controls: [
            { key: 'clarity', label: 'Relief' },
            { key: 'sharpness', label: 'Netteté' },
            { key: 'blur', label: 'Flou', unit: ' px' },
            { key: 'grain', label: 'Grain' },
            { key: 'vignette', label: 'Vignettage' },
            /* Le halo ne se declenche que sur des hautes lumieres COLOREES —
               un neon, un phare. Sur un blanc speculaire neutre son garde-fou
               l'eteint volontairement (`getSafeHalationWeight`). Ce n'est pas
               une panne, c'est ce qui evite les aureoles sur les nuages. */
            { key: 'halation', label: 'Halo des lumières' },
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

    /* Les bornes suivent le mode: « Créatif » coupe les garde-fous du moteur,
       donc la course s'ouvre en meme temps qu'eux — jamais avant. Le
       monochrome a ses propres plafonds (le grain et le contraste s'y voient
       moins), le moteur les expose via `mono`. */
    const isMono = (filters.saturation ?? 100) === 0;
    const boundsOf = React.useCallback(
        (key) => visionBoundsFor(key, { safe: !creativeMode, mono: isMono }),
        [creativeMode, isMono],
    );

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
                            {group.controls.map((control) => {
                                const bounds = boundsOf(control.key);
                                if (!bounds) return null;
                                return (
                                    <Slider
                                        key={control.key}
                                        label={control.label}
                                        value={filters[control.key] ?? bounds.neutre}
                                        onChange={(value) => setFilter(control.key, value)}
                                        min={bounds.min}
                                        max={bounds.max}
                                        neutral={bounds.neutre}
                                        defaultValue={bounds.neutre}
                                        formatValue={(value) => `${value}${control.unit || ''}`}
                                    />
                                );
                            })}
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
                            min={boundsOf('tintIntensity').min}
                            max={boundsOf('tintIntensity').max}
                            neutral={0}
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
