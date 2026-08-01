"use client";

/*
 * Import de medias: reutilise tel quel le pipeline existant du moteur
 * (lecture fichier, duree, orientation, miniatures, waveform) et n'ajoute
 * qu'un etat d'avancement lisible pour la nouvelle interface.
 */

import { useCallback, useState } from 'react';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import {
    extractThumbnails,
    loadImageFile,
    loadVideoFile,
} from '@/features/vibefx-studio/video/engine/VideoEngine';
import {
    buildUnavailableWaveform,
    extractAudioWaveform,
} from '@/features/vibefx-studio/video/utils/audioWaveform';

const ACCEPTED = 'video/*,image/*';

function newId() {
    return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10);
}

export function useMediaImport() {
    const addClip = useVideoStore((state) => state.addClip);
    const updateClip = useVideoStore((state) => state.updateClip);
    const [importState, setImportState] = useState({ status: 'idle', done: 0, total: 0, message: '' });

    const importFiles = useCallback(async (fileList) => {
        const files = Array.from(fileList || []).filter((file) => (
            file.type.startsWith('video/') || file.type.startsWith('image/')
        ));
        if (files.length === 0) {
            setImportState({ status: 'error', done: 0, total: 0, message: 'Aucune photo ni vidéo compatible dans la sélection.' });
            return { imported: 0, failed: [] };
        }

        setImportState({ status: 'importing', done: 0, total: files.length, message: '' });
        const failures = [];
        let imported = 0;
        const importSessionId = `import-${Date.now()}-${newId()}`;

        for (const file of files) {
            const isImage = file.type.startsWith('image/');
            try {
                const meta = isImage ? await loadImageFile(file) : await loadVideoFile(file);
                const clipId = newId();
                const added = addClip({
                    id: clipId,
                    file: meta.file,
                    url: meta.url,
                    name: meta.name.replace(/\.[^.]+$/, ''),
                    duration: meta.duration,
                    width: meta.width,
                    height: meta.height,
                    displayWidth: meta.displayWidth,
                    displayHeight: meta.displayHeight,
                    orientationRotation: meta.orientationRotation,
                    orientationSource: meta.orientationSource,
                    mediaType: isImage ? 'image' : 'video',
                    mimeType: meta.type || file.type,
                    assetId: clipId,
                    importSessionId,
                    thumbnails: isImage ? [meta.url] : [],
                    sourceFrameRate: meta.sourceFrameRate,
                    sourceFrameRateRaw: meta.sourceFrameRateRaw,
                    sourceFrameRateStatus: meta.sourceFrameRateStatus,
                    importFrameRate: meta.importFrameRate,
                    importFrameRateMode: meta.importFrameRateMode,
                    socialFpsNormalized: meta.socialFpsNormalized,
                    motion: isImage ? 'none' : null,
                });

                if (!added) {
                    URL.revokeObjectURL(meta.url);
                    failures.push(`${file.name} : durée illisible`);
                } else {
                    imported += 1;
                    if (!isImage) {
                        const thumbCount = meta.duration > 90 ? 4 : meta.duration > 30 ? 6 : 8;
                        extractThumbnails(meta.url, meta.duration, thumbCount, 96, meta)
                            .then((thumbnails) => updateClip(clipId, { thumbnails }))
                            .catch(() => {});
                        extractAudioWaveform(file)
                            .then((waveform) => updateClip(clipId, { waveform }))
                            .catch((error) => updateClip(clipId, { waveform: buildUnavailableWaveform(error?.message) }));
                    }
                }
            } catch (error) {
                failures.push(`${file.name} : ${error?.message || 'lecture impossible'}`);
            }
            setImportState((current) => ({ ...current, done: current.done + 1 }));
        }

        setImportState({
            status: failures.length > 0 ? (imported > 0 ? 'partial' : 'error') : 'done',
            done: files.length,
            total: files.length,
            message: failures.length > 0
                ? `${failures.length} fichier${failures.length > 1 ? 's ignorés' : ' ignoré'} · ${failures.join(' · ')}`
                : `${imported} média${imported > 1 ? 's ajoutés' : ' ajouté'}`,
        });

        return { imported, failed: failures };
    }, [addClip, updateClip]);

    const clearImportState = useCallback(() => {
        setImportState({ status: 'idle', done: 0, total: 0, message: '' });
    }, []);

    return { importFiles, importState, clearImportState, accept: ACCEPTED };
}

export default useMediaImport;
