"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Columns2, Download, ImageOff, ImagePlus, Images, Redo2, RotateCcw, ShieldCheck, Sparkles, Undo2, Upload,
} from 'lucide-react';
import Link from 'next/link';
import {
    Badge, Button, Collapsible, IconButton, Segmented, Sheet, Slider,
} from '../primitives';
import { visionBoundsFor } from '../../vibefx-studio/utils/visionColorScience';
import BeforeAfter, { COMPARE_MODES } from '../shared/BeforeAfter';
import PipelineSourceNote from '../project/PipelineSourceNote';
import useVisionEditor from './useVisionEditor';
import { describeSignals } from './autoEnhance';
import styles from './vision.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

/*
 * Reglages fins: exactement les cles supportees par le moteur Vision v3
 * (utils/visionColorScience.VISION_SUPPORTED_FILTER_KEYS).
 *
 * Les BORNES ne sont plus ecrites ici. Elles viennent du moteur
 * (`visionBoundsFor`), et elles changent avec les garde-fous: actifs, le
 * contraste s'arrete a 125 parce que c'est la que le moteur l'arrete de toute
 * facon. Avant, l'interface proposait d'aller jusqu'a 180 et le moteur ramenait
 * a 125 en silence — un tiers de la course ne faisait rien.
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
            { key: 'temperature', label: 'Température' },
            { key: 'saturation', label: 'Saturation', unit: '%' },
            { key: 'vibrance', label: 'Éclat des couleurs' },
            { key: 'skinSaturation', label: 'Teintes de peau' },
            { key: 'skySaturation', label: 'Ciel' },
            { key: 'foliageSaturation', label: 'Verdure' },
            { key: 'warmSaturation', label: 'Tons chauds' },
        ],
    },
    {
        id: 'texture',
        title: 'Matière',
        controls: [
            { key: 'clarity', label: 'Relief' },
            { key: 'sharpness', label: 'Netteté' },
            { key: 'dehaze', label: 'Voile atmosphérique' },
            { key: 'grain', label: 'Grain' },
            { key: 'vignette', label: 'Vignettage' },
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
        startAdjusting, stopAdjusting, isAdjusting, adjustBaseline, presetDrivenKeys, activePresetLabel,
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
    const isMono = (filters.saturation ?? 100) === 0;

    /*
     * Les reglages qui ne sont plus au repos remontent EN HAUT du panneau, dans
     * leur propre section. Sans ca, il faut parcourir seize curseurs pour
     * retrouver les trois qui ont bouge — et on ne voit pas ce qu'un preset
     * vient de poser.
     */
    const boundsOf = useCallback(
        (key) => visionBoundsFor(key, { safe: safeSmartphone, mono: isMono }),
        [safeSmartphone, isMono],
    );

    /*
     * L'ordre est GELE pendant qu'on tient un curseur: on classe d'apres l'etat
     * du panneau au DEBUT du geste (`adjustBaseline`). Sinon le curseur qu'on
     * bouge sauterait dans « Modifiés » au premier cran, sous le doigt, et le
     * geste serait coupe net.
     */
    const classement = isAdjusting && adjustBaseline ? adjustBaseline : filters;

    const remontes = useMemo(() => {
        const out = [];
        for (const group of ADVANCED_GROUPS) {
            for (const control of group.controls) {
                const bounds = boundsOf(control.key);
                if (!bounds) continue;
                /*
                 * Un reglage que le PRESET pilote reste en haut tant que le
                 * preset est actif, quelle que soit sa valeur — meme ramene au
                 * repos. Sinon il redescend des qu'on le remet a zero puis
                 * remonte des qu'on y retouche: le panneau saute sous la main a
                 * chaque aller-retour, et on perd de vue les reglages du preset
                 * au moment precis ou on est en train de les regler.
                 */
                if (presetDrivenKeys.has(control.key)) {
                    out.push({ ...control, group: group.title });
                    continue;
                }
                const value = classement[control.key] ?? bounds.neutre;
                if (value !== bounds.neutre) out.push({ ...control, group: group.title });
            }
        }
        return out;
    }, [classement, boundsOf, presetDrivenKeys]);

    const remontesKeys = useMemo(() => new Set(remontes.map((c) => c.key)), [remontes]);

    /* Un curseur se rend pareil ou qu'il soit: dans « Modifiés » en haut, ou
       dans son groupe d'origine. Seul le rappel du groupe change. */
    const renderSlider = (control, groupe = null) => {
        const bounds = boundsOf(control.key);
        if (!bounds) return null;
        const pilote = presetDrivenKeys.has(control.key);
        return (
            <Slider
                key={control.key}
                label={groupe ? `${control.label} · ${groupe}` : control.label}
                value={filters[control.key] ?? bounds.neutre}
                onChange={(value) => setFilters(control.key, value)}
                min={bounds.min}
                max={bounds.max}
                neutral={bounds.neutre}
                defaultValue={bounds.neutre}
                accent={pilote}
                accentTitle={pilote ? `Réglage posé par le preset « ${activePresetLabel} »` : null}
                onInteractStart={startAdjusting}
                onInteractEnd={stopAdjusting}
                formatValue={(value) => `${value}${control.unit || ''}`}
            />
        );
    };

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

                    {remontes.length ? (
                        <section className={styles.block} data-testid="vibeos-vision-modifies">
                            <h3 className={styles.blockTitle}>
                                Modifiés
                                <span className={styles.blockCount}>{remontes.length}</span>
                            </h3>
                            {remontes.map((control) => renderSlider(control, control.group))}
                        </section>
                    ) : null}

                    {ADVANCED_GROUPS.map((group) => {
                        const restants = group.controls.filter((c) => !remontesKeys.has(c.key));
                        if (!restants.length) return null;
                        return (
                            <section key={group.id} className={styles.block}>
                                <h3 className={styles.blockTitle}>{group.title}</h3>
                                {restants.map((control) => renderSlider(control))}
                            </section>
                        );
                    })}

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
