"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, Redo2, Undo2, Upload, X } from 'lucide-react';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import { Button, IconButton, Segmented, Spinner } from '../primitives';
import PreviewStage from '../preview/PreviewStage';
import TransportBar from '../preview/TransportBar';
import useMediaImport from '../adapters/useMediaImport';
import useVibeCutProject from '../adapters/useVibeCutProject';
import { useSceneActions, useScenes } from '../adapters/useScenes';
import Storyboard from './Storyboard';
import SceneInspector from './SceneInspector';
import TextInspector from './TextInspector';
import ProjectAudio from './ProjectAudio';
import MusicSheet from './MusicSheet';
import ExportSheet from './ExportSheet';
import styles from './quick.module.css';

/*
 * Montage rapide.
 * Un seul ecran: apercu au centre, inspecteur contextuel a droite, storyboard en bas.
 * Aucune timeline, aucune barre d'outils redondante.
 */

const FORMAT_OPTIONS = [
    { value: 'instagram-reel', label: '9:16' },
    { value: 'portrait', label: '4:5' },
    { value: 'instagram-post', label: '1:1' },
    { value: 'youtube', label: '16:9' },
];

const SAVE_LABELS = {
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    error: 'Enregistrement impossible',
};

export default function QuickEditor() {
    const mediaInputRef = useRef(null);
    const [isDropActive, setIsDropActive] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isMusicOpen, setIsMusicOpen] = useState(false);

    const { projectName, status, saveState, renameCurrentProject } = useVibeCutProject();
    const { importFiles, importState, clearImportState, accept } = useMediaImport();
    const { scenes, totalDuration } = useScenes();
    const actions = useSceneActions();

    const sequencePreset = useVideoStore((state) => state.sequencePreset);
    const setSequencePreset = useVideoStore((state) => state.setSequencePreset);
    const audioTracks = useVideoStore((state) => state.audioTracks);
    const textOverlays = useVideoStore((state) => state.textOverlays);
    const undo = useVideoStore((state) => state.undo);
    const redo = useVideoStore((state) => state.redo);
    // On s'abonne aux piles elles-memes: `canUndo()` est une fonction, elle ne
    // declencherait aucun rendu quand l'historique change.
    const canUndo = useVideoStore((state) => state._history.length > 0);
    const canRedo = useVideoStore((state) => state._future.length > 0);
    const selectedTextId = useVideoStore((state) => state.selectedTextId);
    const selectedScene = useMemo(() => scenes.find((scene) => scene.selected) || null, [scenes]);
    const selectedText = useMemo(
        () => textOverlays.find((text) => text.id === selectedTextId) || null,
        [selectedTextId, textOverlays],
    );

    /*
     * Le selecteur renvoie un booleen: le composant ne se re-rend que lorsque la
     * possibilite de couper change, pas a chaque avancee de la tete de lecture.
     */
    const sceneStart = selectedScene?.timelineStart ?? null;
    const sceneEnd = sceneStart !== null ? sceneStart + selectedScene.duration : null;
    const canSplit = useVideoStore((state) => (
        sceneStart !== null
        && state.currentTime > sceneStart + 0.2
        && state.currentTime < sceneEnd - 0.2
    ));

    const openMediaPicker = useCallback(() => mediaInputRef.current?.click(), []);

    const handleMediaInput = useCallback(async (event) => {
        const { files } = event.target;
        await importFiles(files);
        event.target.value = '';
    }, [importFiles]);

    const handleMusicConfirm = useCallback(({ file, rights, sourceDuration }) => {
        actions.addMusic({ file, rights, sourceDuration, totalDuration });
        setIsMusicOpen(false);
    }, [actions, totalDuration]);

    const handleDrop = useCallback(async (event) => {
        event.preventDefault();
        setIsDropActive(false);
        // Un glisser-deposer interne de scene ne doit pas declencher un import.
        if (!event.dataTransfer?.files?.length) return;
        await importFiles(event.dataTransfer.files);
    }, [importFiles]);

    const handleDragOver = useCallback((event) => {
        if (!event.dataTransfer?.types?.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setIsDropActive(true);
    }, []);

    const handleDragLeave = useCallback((event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setIsDropActive(false);
    }, []);

    // Un import reussi n'a pas a rester affiche: le storyboard parle de lui-meme.
    useEffect(() => {
        if (importState.status !== 'done') return undefined;
        const timer = window.setTimeout(clearImportState, 4000);
        return () => window.clearTimeout(timer);
    }, [clearImportState, importState.status]);

    // Raccourcis: espace = lecture, suppression = retirer la scene selectionnee.
    useEffect(() => {
        const onKeyDown = (event) => {
            const tag = event.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            const state = useVideoStore.getState();
            const meta = event.metaKey || event.ctrlKey;
            if (meta && event.code === 'KeyZ') {
                event.preventDefault();
                if (event.shiftKey) state.redo();
                else state.undo();
            } else if (event.code === 'Space') {
                event.preventDefault();
                state.togglePlay();
            } else if (event.code === 'Delete' || event.code === 'Backspace') {
                if (state.selectedTextId) {
                    event.preventDefault();
                    state.removeTextOverlay(state.selectedTextId);
                } else if (state.selectedClipId) {
                    event.preventDefault();
                    state.removeClip(state.selectedClipId);
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const hasScenes = scenes.length > 0;
    const isImporting = importState.status === 'importing';

    return (
        <div
            className={styles.editor}
            data-testid="vibecut-quick-editor"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <input ref={mediaInputRef} type="file" accept={accept} multiple hidden onChange={handleMediaInput} data-testid="vibecut-media-input" />

            <header className={styles.header}>
                <input
                    className={styles.projectName}
                    value={projectName === 'Untitled' ? '' : projectName}
                    placeholder="Projet sans titre"
                    onChange={(event) => renameCurrentProject(event.target.value)}
                    aria-label="Nom du projet"
                    data-testid="vibecut-project-name"
                />
                <span className={styles.saveState} data-testid="vibecut-save-state">
                    {status === 'loading' ? 'Ouverture…' : SAVE_LABELS[saveState] || ''}
                </span>

                <span className={styles.headerSpacer} />

                <div className={styles.historyGroup}>
                    <IconButton
                        label="Annuler la dernière action"
                        title="Annuler (Cmd+Z)"
                        onClick={undo}
                        disabled={!canUndo}
                        data-testid="vibecut-undo"
                    >
                        <Undo2 size={16} />
                    </IconButton>
                    <IconButton
                        label="Rétablir"
                        title="Rétablir (Cmd+Maj+Z)"
                        onClick={redo}
                        disabled={!canRedo}
                        data-testid="vibecut-redo"
                    >
                        <Redo2 size={16} />
                    </IconButton>
                </div>

                <Segmented
                    label="Format de la vidéo"
                    value={sequencePreset}
                    onChange={setSequencePreset}
                    options={FORMAT_OPTIONS}
                />
                <Button
                    variant="primary"
                    icon={<Download size={16} />}
                    onClick={() => setIsExportOpen(true)}
                    disabled={!hasScenes}
                    data-testid="vibecut-open-export"
                >
                    Exporter
                </Button>
            </header>

            {importState.status !== 'idle' ? (
                <div
                    className={[
                        styles.notice,
                        importState.status === 'error' ? styles.noticeError : styles.noticeProgress,
                    ].join(' ')}
                    role={importState.status === 'error' ? 'alert' : 'status'}
                    data-testid="vibecut-import-notice"
                    data-import-status={importState.status}
                >
                    {isImporting ? <Loader2 size={15} /> : null}
                    <span>
                        {isImporting
                            ? `Analyse des médias… ${importState.done}/${importState.total}`
                            : importState.message}
                    </span>
                    <span className={styles.noticeSpacer} />
                    {!isImporting ? (
                        <IconButton label="Fermer le message" onClick={clearImportState}>
                            <X size={15} />
                        </IconButton>
                    ) : null}
                </div>
            ) : null}

            {!hasScenes ? (
                <div className={styles.empty}>
                    <div
                        className={[styles.dropZone, isDropActive ? styles.dropZoneActive : ''].filter(Boolean).join(' ')}
                        data-testid="vibecut-drop-zone"
                    >
                        <span className={styles.dropIcon}>
                            {isImporting ? <Spinner /> : <Upload size={24} />}
                        </span>
                        <h2 className={styles.dropTitle}>Dépose tes photos et vidéos</h2>
                        <p className={styles.dropHint}>
                            Elles deviennent des scènes que tu réorganises à la souris. Tu règles ensuite la durée,
                            le mouvement et les transitions.
                        </p>
                        <Button
                            variant="primary"
                            size="lg"
                            icon={<ImagePlus size={18} />}
                            onClick={openMediaPicker}
                            data-testid="vibecut-import-button"
                        >
                            Choisir des médias
                        </Button>
                        <p className={styles.dropFormats}>JPG, PNG, WebP, MP4, WebM, MOV · jusqu’à 60 images/s</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className={styles.body}>
                        <div className={styles.stageColumn}>
                            <PreviewStage />
                            <TransportBar />
                        </div>
                        <aside className={styles.inspector} data-testid="vibecut-inspector">
                            {selectedText ? (
                                <TextInspector text={selectedText} totalDuration={totalDuration} actions={actions} />
                            ) : (
                                <SceneInspector
                                    scene={selectedScene}
                                    scenes={scenes}
                                    actions={actions}
                                    canSplit={canSplit}
                                />
                            )}
                            <ProjectAudio
                                tracks={audioTracks}
                                actions={actions}
                                onAdd={() => setIsMusicOpen(true)}
                            />
                        </aside>
                    </div>

                    <Storyboard
                        textOverlays={textOverlays}
                        scenes={scenes}
                        totalDuration={totalDuration}
                        onSelect={(scene) => actions.selectScene(scene.id, scene.timelineStart)}
                        onReorder={actions.reorderScenes}
                        onEditTransition={(scene) => actions.selectScene(scene.id, scene.timelineStart)}
                        onAddMedia={openMediaPicker}
                    />
                </>
            )}

            <MusicSheet
                open={isMusicOpen}
                onClose={() => setIsMusicOpen(false)}
                onConfirm={handleMusicConfirm}
            />
            <ExportSheet open={isExportOpen} onClose={() => setIsExportOpen(false)} />
        </div>
    );
}
