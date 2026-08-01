"use client";

import React, { useCallback, useState } from 'react';
import { AlertTriangle, Check, Download, FolderDown, RotateCcw, X } from 'lucide-react';
import { useVideoExportController } from '@/features/vibefx-studio/video/export/useExportController';
import useExportDownload from '../adapters/useExportDownload';
import useExportOutputMeta from '../adapters/useExportOutputMeta';
import { Badge, Button, IconButton, Progress, Spinner } from '../primitives';
import styles from './advanced.module.css';

/*
 * Export professionnel du montage avance.
 *
 * Meme controleur d'export que le montage rapide (manifeste, job serveur,
 * telemetrie), mais les reglages qui y sont volontairement caches sont ici
 * exposes: cadence jusqu'a 60 images/s, niveau de qualite, conteneur.
 * Le pre-vol reel du controleur reste seul juge de ce qui est exportable.
 */

const FPS_OPTIONS = [
    { value: 'auto', label: 'Auto' },
    { value: '24', label: '24' },
    { value: '25', label: '25' },
    { value: '30', label: '30' },
    { value: '50', label: '50' },
    { value: '60', label: '60' },
];

const QUALITY_OPTIONS = [
    { value: 'preview', label: 'Brouillon' },
    { value: 'pro', label: 'Pro' },
    { value: 'master', label: 'Master' },
];

export default function ExportProSheet({ open, onClose }) {
    const controller = useVideoExportController();

    const job = controller.activeExportJob;
    const isDone = job?.status === 'ready';
    const hasFailed = job?.status === 'failed';

    /*
     * Recuperation du fichier rendu. Phase 7: le nom horodate, la regeneration
     * de l'URL signee et l'enregistrement dans un dossier du PC viennent de
     * `useExportDownload` - ce sont les comportements que portait le panneau de
     * l'ancien front, deplaces plutot que perdus.
     */
    const downloader = useExportDownload({ job, projectName: controller.projectName });
    const outputMeta = useExportOutputMeta({
        job,
        manifest: controller.proExportManifest,
        activeMode: controller.exportRenderMode,
    });
    const downloadState = downloader.state;
    const handleDownload = useCallback(() => downloader.download('downloads'), [downloader]);
    const handleSaveToFolder = useCallback(() => downloader.download('folder'), [downloader]);

    if (!open) return null;

    const blockers = controller.proExportPreflight?.errors || [];
    const warnings = controller.proExportPreflight?.warnings || [];
    const canExport = controller.hasClips && blockers.length === 0 && !controller.isExporting;
    const isMockOnly = job?.output?.mockOnly === true;

    return (
        <div
            className={styles.sheetBackdrop}
            role="dialog"
            aria-modal="true"
            aria-label="Export professionnel"
            data-testid="vibecut-export-pro-sheet"
            onClick={(event) => { if (event.target === event.currentTarget && !controller.isExporting) onClose(); }}
        >
            <div className={styles.sheet}>
                <div className={styles.sheetHead}>
                    <h2 className={styles.sheetTitle}>Export professionnel</h2>
                    <IconButton label="Fermer la feuille d’export" onClick={onClose} disabled={controller.isExporting}>
                        <X size={16} />
                    </IconButton>
                </div>

                <div className={styles.sheetBody}>
                    <div className={styles.sheetRow}>
                        <span>Format</span>
                        <span className={styles.sheetRowValue} data-testid="vibecut-export-pro-format">
                            {controller.preset?.name} · {controller.preset?.width}×{controller.preset?.height}
                        </span>
                    </div>

                    <fieldset className={styles.fieldset}>
                        <legend className={styles.legend}>Images par seconde</legend>
                        <div className={styles.chipRow}>
                            {FPS_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={styles.chip}
                                    aria-pressed={String(controller.exportFrameRate) === option.value}
                                    onClick={() => controller.setExportFrameRate(option.value)}
                                    data-testid={`vibecut-export-fps-${option.value}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <p className={styles.note} data-testid="vibecut-export-effective-fps">
                            Cadence appliquée : <strong data-numeric="true">{controller.exportFps} fps</strong>
                            {' '}(plafond du pipeline : 60 fps)
                        </p>
                    </fieldset>

                    <fieldset className={styles.fieldset}>
                        <legend className={styles.legend}>Qualité</legend>
                        <div className={styles.chipRow}>
                            {QUALITY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={styles.chip}
                                    aria-pressed={controller.exportQualityMode === option.value}
                                    onClick={() => controller.setExportQualityMode(option.value)}
                                    data-testid={`vibecut-export-quality-${option.value}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <div className={styles.sheetRow}>
                        <span>Durée</span>
                        <span className={styles.sheetRowValue} data-numeric="true">
                            {Math.round(controller.totalDuration)} s
                        </span>
                    </div>
                    <div className={styles.sheetRow}>
                        <span>Son</span>
                        <span className={styles.sheetRowValue} data-testid="vibecut-export-audio-mix">
                            {controller.shouldMixAudio ? 'Clips et musique' : 'Aucun'}
                        </span>
                    </div>
                    <div className={styles.sheetRow}>
                        <span>Pré-vol</span>
                        <span
                            className={styles.sheetRowValue}
                            data-testid="vibecut-export-preflight"
                            data-preflight-status={blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ready'}
                        >
                            <Badge tone={blockers.length ? 'warning' : 'neutral'}>
                                {blockers.length ? 'bloqué' : warnings.length ? 'avertissement' : 'prêt'}
                            </Badge>
                        </span>
                    </div>

                    {blockers.length > 0 ? (
                        <p className={styles.sheetError} role="alert" data-testid="vibecut-export-pro-blocker">
                            {blockers[0]}
                        </p>
                    ) : warnings.length > 0 ? (
                        <p className={styles.note} data-testid="vibecut-export-pro-warning">{warnings[0]}</p>
                    ) : null}

                    {isDone ? (
                        <div className={styles.exportMeta} data-testid="vibecut-export-pro-output-meta">
                            {/*
                              * Format REEL du fichier produit, lu du manifeste et de la
                              * sortie du job - jamais « H.264/AAC » ecrit en dur. Une
                              * simulation locale annonce « simulation », pas un faux MP4.
                              */}
                            {outputMeta.map(({ label, value }) => (
                                <div key={label} className={styles.sheetRow}>
                                    <span>{label}</span>
                                    <span
                                        className={styles.sheetRowValue}
                                        data-testid={label === 'Codec' ? 'export-output-codec'
                                            : label === 'Container' ? 'export-output-container'
                                                : label === 'MIME' ? 'export-output-mime' : undefined}
                                    >
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {isDone ? (
                        <div className={styles.exportDone} data-testid="vibecut-export-pro-done">
                            <span className={styles.exportDoneIcon}><Check size={16} /></span>
                            <span>
                                <strong>Export terminé</strong>
                                <small>
                                    {isMockOnly
                                        ? 'Rendu simulé en local : aucun fichier n’est généré dans ce mode.'
                                        : 'Ta vidéo est prête à être téléchargée.'}
                                </small>
                            </span>
                        </div>
                    ) : null}

                    {hasFailed ? (
                        <p className={styles.sheetError} role="alert" data-testid="vibecut-export-pro-failed">
                            {job?.error?.message || job?.stepLabel || 'L’export a échoué.'}
                        </p>
                    ) : null}

                    {downloadState.status === 'error' ? (
                        <p className={styles.sheetError} role="alert">
                            <AlertTriangle size={14} /> {downloadState.message}
                        </p>
                    ) : null}

                    {controller.isExporting || controller.exportMessage ? (
                        <div className={styles.sheetProgress} data-testid="vibecut-export-pro-progress">
                            <div className={styles.sheetRow}>
                                <span className={styles.sheetRowValue}>
                                    {controller.exportMessage || 'Export en cours'}
                                </span>
                                <span className={styles.sheetRowValue} data-numeric="true">
                                    {controller.exportProgress} %
                                </span>
                            </div>
                            <Progress value={controller.exportProgress} label="Avancement de l'export" />
                        </div>
                    ) : null}
                </div>

                <div className={styles.sheetFoot}>
                    <Button variant="ghost" onClick={onClose} disabled={controller.isExporting}>
                        {isDone ? 'Fermer' : 'Annuler'}
                    </Button>

                    {hasFailed ? (
                        <Button
                            variant="secondary"
                            onClick={() => controller.retryProExport(job)}
                            icon={<RotateCcw size={16} />}
                            data-testid="vibecut-export-pro-retry"
                        >
                            Réessayer
                        </Button>
                    ) : null}

                    {isDone && !isMockOnly ? (
                        <>
                            <Button
                                variant="primary"
                                onClick={handleDownload}
                                disabled={downloadState.status === 'loading'}
                                icon={downloadState.status === 'loading' ? <Spinner /> : <Download size={16} />}
                                data-testid="vibecut-export-pro-download"
                            >
                                Télécharger la vidéo
                            </Button>
                            {/*
                              * Enregistrement direct dans un dossier du PC. Le bouton
                              * n'existe QUE si le navigateur sait le faire: un bouton
                              * mort serait interdit (plan.md § 4.2).
                              */}
                            {downloader.canChooseFolder ? (
                                <Button
                                    variant="secondary"
                                    onClick={handleSaveToFolder}
                                    disabled={downloadState.status === 'loading'}
                                    icon={<FolderDown size={16} />}
                                    data-testid="vibecut-export-pro-save-folder"
                                >
                                    {downloader.destination.mode === 'folder' && downloader.destination.label
                                        ? `Enregistrer dans ${downloader.destination.label}`
                                        : 'Enregistrer dans un dossier'}
                                </Button>
                            ) : null}
                        </>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={controller.handleExport}
                            disabled={!canExport}
                            icon={controller.isExporting ? <Spinner /> : <Download size={16} />}
                            data-testid="vibecut-export-pro-start"
                        >
                            {controller.isExporting
                                ? `Export ${controller.exportProgress} %`
                                : isDone ? 'Relancer l’export' : 'Lancer l’export'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
