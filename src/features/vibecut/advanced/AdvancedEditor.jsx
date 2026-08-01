"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, Music, Redo2, Trash2, Type, Undo2, X } from 'lucide-react';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import { Button, IconButton, Segmented, Spinner } from '../primitives';
import PreviewStage from '../preview/PreviewStage';
import TransportBar from '../preview/TransportBar';
import useMediaImport from '../adapters/useMediaImport';
import useVibeCutProject from '../adapters/useVibeCutProject';
import { useSceneActions, useScenes } from '../adapters/useScenes';
import { useTimelineActions, useTimelineModel, useTimelineSelection } from '../adapters/useTimeline';
import MusicSheet from '../quick/MusicSheet';
import MediaLibrary from './MediaLibrary';
import Inspector from './Inspector';
import TimelineView from './TimelineView';
import ExportProSheet from './ExportProSheet';
import styles from './advanced.module.css';

/*
 * Montage avance: bibliotheque a gauche, apercu au centre, inspecteur a droite,
 * timeline multipiste en bas. Un seul bandeau d'ecran, les actions de l'ecran
 * vivent a cote de son titre (plan.md § 4.4).
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

export default function AdvancedEditor() {
    const mediaInputRef = useRef(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isMusicOpen, setIsMusicOpen] = useState(false);
    /*
     * Section d'inspecteur a ouvrir. Un badge de la timeline dit CE QU'IL
     * decrit: le cliquer doit donc amener au reglage correspondant, pas juste
     * selectionner le plan.
     */
    const [focusSection, setFocusSection] = useState(null);

    const { projectName, status, saveState, renameCurrentProject } = useVibeCutProject();
    const { importFiles, importState, clearImportState, accept } = useMediaImport();
    const { scenes, totalDuration } = useScenes();
    const sceneActions = useSceneActions();

    const { items } = useTimelineModel();
    const timelineActions = useTimelineActions();
    const selection = useTimelineSelection();

    const sequencePreset = useVideoStore((state) => state.sequencePreset);
    const setSequencePreset = useVideoStore((state) => state.setSequencePreset);
    const audioTracks = useVideoStore((state) => state.audioTracks);
    const undo = useVideoStore((state) => state.undo);
    const redo = useVideoStore((state) => state.redo);
    const canUndo = useVideoStore((state) => state._history.length > 0);
    const canRedo = useVideoStore((state) => state._future.length > 0);
    const timelineEditNotice = useVideoStore((state) => state.timelineEditNotice);
    const clearTimelineEditNotice = useVideoStore((state) => state.clearTimelineEditNotice);

    const selectedItem = useMemo(() => {
        if (!selection.selectedItemId) return null;
        return items.find((item) => {
            if (item.type === 'video') return (item.sourceId || item.id) === selection.selectedClipId;
            return item.id === selection.selectedItemId;
        }) || null;
    }, [items, selection.selectedClipId, selection.selectedItemId]);

    const libraryEntries = useMemo(() => {
        const fromScenes = scenes.map((scene) => ({
            id: scene.id,
            kind: scene.isImage ? 'image' : 'video',
            name: scene.name,
            duration: scene.duration,
            thumbnail: scene.thumbnail,
            timelineStart: scene.timelineStart,
            selected: scene.id === selection.selectedClipId,
        }));
        const fromAudio = audioTracks.map((track) => ({
            id: track.id,
            kind: 'audio',
            name: track.name || 'Musique',
            duration: Math.max(0, Number(track.endTime || 0) - Number(track.startTime || 0)),
            thumbnail: null,
            timelineStart: Number(track.startTime) || 0,
            selected: track.id === selection.selectedAudioTrackId,
        }));
        return [...fromScenes, ...fromAudio];
    }, [audioTracks, scenes, selection.selectedAudioTrackId, selection.selectedClipId]);

    const openMediaPicker = useCallback(() => mediaInputRef.current?.click(), []);

    const handleMediaInput = useCallback(async (event) => {
        const { files } = event.target;
        await importFiles(files);
        event.target.value = '';
    }, [importFiles]);

    const handleLibrarySelect = useCallback((entry) => {
        if (entry.kind === 'audio') {
            timelineActions.selectItem({ id: entry.id, type: 'audio', params: {} });
        } else {
            sceneActions.selectScene(entry.id, entry.timelineStart);
        }
    }, [sceneActions, timelineActions]);

    const handleMusicConfirm = useCallback(({ file, rights, sourceDuration }) => {
        sceneActions.addMusic({ file, rights, sourceDuration, totalDuration });
        setIsMusicOpen(false);
    }, [sceneActions, totalDuration]);

    const handleAddTitle = useCallback(() => {
        const scene = scenes.find((entry) => entry.id === selection.selectedClipId) || scenes[0];
        if (scene) sceneActions.addSceneTitle(scene);
    }, [sceneActions, scenes, selection.selectedClipId]);

    // Un import reussi n'a pas a rester affiche.
    useEffect(() => {
        if (importState.status !== 'done') return undefined;
        const timer = window.setTimeout(clearImportState, 4000);
        return () => window.clearTimeout(timer);
    }, [clearImportState, importState.status]);

    // Raccourcis: espace = lecture, suppression = retirer l'element selectionne.
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
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const hasScenes = scenes.length > 0;
    const isImporting = importState.status === 'importing';

    return (
        <div className={styles.editor} data-testid="vibecut-advanced-editor">
            <input
                ref={mediaInputRef}
                type="file"
                accept={accept}
                multiple
                hidden
                onChange={handleMediaInput}
                data-testid="vibecut-media-input"
            />

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

                <div className={styles.headerGroup}>
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

                <div className={styles.headerGroup}>
                    <IconButton
                        label="Ajouter un titre"
                        onClick={handleAddTitle}
                        disabled={!hasScenes}
                        data-testid="vibecut-add-title"
                    >
                        <Type size={16} />
                    </IconButton>
                    <IconButton
                        label="Ajouter une musique"
                        onClick={() => setIsMusicOpen(true)}
                        data-testid="vibecut-add-music"
                    >
                        <Music size={16} />
                    </IconButton>
                    <IconButton
                        label="Supprimer l’élément sélectionné"
                        onClick={() => timelineActions.removeItem(selectedItem)}
                        disabled={!selectedItem}
                        data-testid="vibecut-remove-item"
                    >
                        <Trash2 size={16} />
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
                        <IconButton label="Fermer le message d’import" onClick={clearImportState}>
                            <X size={15} />
                        </IconButton>
                    ) : null}
                </div>
            ) : null}

            {timelineEditNotice ? (
                <div className={`${styles.notice} ${styles.noticeError}`} role="alert" data-testid="vibecut-timeline-notice">
                    <span>{timelineEditNotice.message || 'Édition refusée.'}</span>
                    <span className={styles.noticeSpacer} />
                    <IconButton label="Fermer l’avertissement de piste" onClick={clearTimelineEditNotice}>
                        <X size={15} />
                    </IconButton>
                </div>
            ) : null}

            <div className={styles.body}>
                <MediaLibrary
                    entries={libraryEntries}
                    onSelect={handleLibrarySelect}
                    onImport={openMediaPicker}
                    isImporting={isImporting}
                />

                <div className={styles.stageColumn}>
                    {hasScenes ? null : (
                        <div className={styles.stageEmpty} data-testid="vibecut-advanced-empty">
                            <span className={styles.stageEmptyIcon}>
                                {isImporting ? <Spinner /> : <ImagePlus size={22} />}
                            </span>
                            <h2 className={styles.stageEmptyTitle}>Aucun média dans ce projet</h2>
                            <p className={styles.stageEmptyBody}>
                                Importe des photos et des vidéos : elles arrivent sur la piste vidéo,
                                prêtes à être découpées, déplacées et étalonnées.
                            </p>
                            <Button variant="primary" icon={<ImagePlus size={16} />} onClick={openMediaPicker}>
                                Choisir des médias
                            </Button>
                        </div>
                    )}
                    <PreviewStage className={hasScenes ? undefined : styles.stageHidden} />
                    <TransportBar />
                </div>

                <Inspector
                    item={selectedItem}
                    actions={timelineActions}
                    sceneActions={sceneActions}
                    scenes={scenes}
                    totalDuration={totalDuration}
                    focusSection={focusSection}
                />
            </div>

            <TimelineView
                scenes={scenes}
                sceneActions={sceneActions}
                onFocusSection={setFocusSection}
            />

            <MusicSheet
                open={isMusicOpen}
                onClose={() => setIsMusicOpen(false)}
                onConfirm={handleMusicConfirm}
            />
            <ExportProSheet open={isExportOpen} onClose={() => setIsExportOpen(false)} />
        </div>
    );
}
