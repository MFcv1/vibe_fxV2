"use client";

/*
 * Recuperation du MP4 rendu, pour les deux feuilles d'export du nouveau front.
 *
 * Reprend, a la phase 7, les comportements que portait le panneau d'export de
 * l'ancien front avant sa suppression: nom de fichier horodate, regeneration de
 * l'URL signee au clic, et enregistrement direct dans un dossier du PC. La
 * logique elle-meme vit dans `export/exportDownload.js`; cet adaptateur ne fait
 * que la rendre utilisable depuis React, comme tous les autres adaptateurs.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { triggerBrowserDownload } from '@/features/vibefx-studio/video/export/useExportController';
import {
    buildExportFileName,
    chooseExportDirectory,
    persistDestinationPreference,
    readDestinationPreference,
    resolveExportOutputDownloadUrl,
    saveExportToDirectory,
    supportsDirectoryPicker,
} from '@/features/vibefx-studio/video/export/exportDownload';

export default function useExportDownload({ job, projectName }) {
    const directoryHandleRef = useRef(null);
    const [state, setState] = useState({ status: 'idle', message: '' });
    /*
     * La preference est lue une fois, en paresseux: `readDestinationPreference`
     * touche `window`, donc elle ne doit pas etre appelee au rendu serveur.
     */
    const [destination, setDestination] = useState(() => (
        typeof window === 'undefined' ? { mode: 'downloads', label: '' } : readDestinationPreference()
    ));

    const canChooseFolder = useMemo(
        () => (typeof window === 'undefined' ? false : supportsDirectoryPicker()),
        [],
    );

    const chooseFolder = useCallback(async () => {
        const handle = await chooseExportDirectory();
        if (!handle) {
            setState({
                status: 'idle',
                message: canChooseFolder ? 'Choix de dossier annulé.' : 'Ce navigateur ne sait pas enregistrer dans un dossier.',
            });
            return null;
        }
        directoryHandleRef.current = handle;
        setDestination({ mode: 'folder', label: handle.name || 'Dossier choisi' });
        setState({ status: 'idle', message: `Dossier choisi : ${handle.name || 'PC'}.` });
        return handle;
    }, [canChooseFolder]);

    const useDownloadsFolder = useCallback(() => {
        directoryHandleRef.current = null;
        persistDestinationPreference('downloads');
        setDestination({ mode: 'downloads', label: '' });
        setState({ status: 'idle', message: '' });
    }, []);

    /*
     * `target` explicite plutot que la preference seule: le bouton « Enregistrer
     * dans un dossier » doit pouvoir demander le dossier meme si la preference
     * courante est le telechargement standard.
     */
    const download = useCallback(async (target = destination.mode) => {
        const fileName = buildExportFileName({ projectName, jobId: job?.id });
        setState({ status: 'loading', message: '' });
        try {
            const url = await resolveExportOutputDownloadUrl(job || {});

            if (target === 'folder') {
                let handle = directoryHandleRef.current;
                if (!handle) handle = await chooseFolder();
                if (!handle) {
                    setState({ status: 'idle', message: 'Enregistrement annulé.' });
                    return;
                }
                await saveExportToDirectory({ directoryHandle: handle, url, fileName });
                setState({ status: 'idle', message: `Enregistré : ${fileName}` });
                return;
            }

            triggerBrowserDownload(url, fileName);
            persistDestinationPreference('downloads');
            setState({ status: 'idle', message: `Téléchargement lancé : ${fileName}` });
        } catch (error) {
            setState({ status: 'error', message: error?.message || 'Téléchargement impossible.' });
        }
    }, [chooseFolder, destination.mode, job, projectName]);

    return { state, destination, canChooseFolder, download, chooseFolder, useDownloadsFolder };
}
