"use client";

import React, { useCallback, useState } from 'react';
import { AlertTriangle, Check, Download, FolderDown, RotateCcw, X } from 'lucide-react';
import { useVideoExportController } from '@/features/vibefx-studio/video/export/useExportController';
import useExportDownload from '../adapters/useExportDownload';
import useExportOutputMeta from '../adapters/useExportOutputMeta';
import { Button, IconButton, Progress, Spinner } from '../primitives';
import styles from './quick.module.css';

/*
 * Export du montage rapide: on reutilise le controleur d'export existant
 * (manifeste, job serveur, telemetrie) et on n'expose que l'essentiel.
 * Les reglages professionnels restent dans le montage avance.
 */

export default function ExportSheet({ open, onClose }) {
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
            aria-label="Exporter la vidéo"
            data-testid="vibecut-export-sheet"
            onClick={(event) => { if (event.target === event.currentTarget && !controller.isExporting) onClose(); }}
        >
            <div className={styles.sheet}>
                <div className={styles.sheetHead}>
                    <h2 className={styles.sheetTitle}>Exporter</h2>
                    <IconButton label="Fermer" onClick={onClose} disabled={controller.isExporting}>
                        <X size={16} />
                    </IconButton>
                </div>

                <div className={styles.sheetBody}>
                    <div className={styles.sheetRow}>
                        <span>Format</span>
                        <span className={styles.sheetRowValue}>
                            {controller.preset?.name} · {controller.preset?.width}×{controller.preset?.height}
                        </span>
                    </div>
                    <div className={styles.sheetRow}>
                        <span>Images par seconde</span>
                        <span className={styles.sheetRowValue} data-numeric="true">{controller.exportFps} fps</span>
                    </div>
                    <div className={styles.sheetRow}>
                        <span>Durée</span>
                        <span className={styles.sheetRowValue} data-numeric="true">
                            {Math.round(controller.totalDuration)} s
                        </span>
                    </div>
                    <div className={styles.sheetRow}>
                        <span>Son</span>
                        <span className={styles.sheetRowValue}>
                            {controller.shouldMixAudio ? 'Clips et musique' : 'Aucun'}
                        </span>
                    </div>

                    {blockers.length > 0 ? (
                        <p className={styles.sheetError} role="alert" data-testid="vibecut-export-blocker">
                            {blockers[0]}
                        </p>
                    ) : warnings.length > 0 ? (
                        <p className={styles.groupNote} data-testid="vibecut-export-warning">{warnings[0]}</p>
                    ) : null}

                    {isDone ? (
                        <div className={styles.exportMeta} data-testid="vibecut-export-output-meta">
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
                        <div className={styles.exportDone} data-testid="vibecut-export-done">
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
                        <p className={styles.sheetError} role="alert" data-testid="vibecut-export-failed">
                            {job?.error?.message || job?.stepLabel || 'L’export a échoué.'}
                        </p>
                    ) : null}

                    {downloadState.status === 'error' ? (
                        <p className={styles.sheetError} role="alert" data-testid="vibecut-download-error">
                            <AlertTriangle size={14} /> {downloadState.message}
                        </p>
                    ) : null}

                    {controller.isExporting || controller.exportMessage ? (
                        <div className={styles.sheetProgress} data-testid="vibecut-export-progress">
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
                            data-testid="vibecut-export-retry"
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
                                data-testid="vibecut-export-download"
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
                                    data-testid="vibecut-export-save-folder"
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
                            data-testid="vibecut-export-start"
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
