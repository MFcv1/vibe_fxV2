"use client";

/*
 * Adaptateur projet: fait le lien entre le store video existant et la bibliotheque
 * de projets locale. C'est le seul endroit du nouveau front qui connait le store.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import { createProjectId, loadProject, saveProject } from '../services/projectLibrary';

const AUTOSAVE_DELAY_MS = 1200;

export function useVibeCutProject() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedId = searchParams.get('project');

    /*
     * L'identifiant du projet est fige au montage. La sauvegarde automatique
     * ancre ensuite l'URL sur ce projet (`?project=...`) pour rendre le lien
     * partageable, et cet ancrage ne doit surtout pas etre relu comme une
     * navigation: sinon le montage serait recharge depuis IndexedDB en pleine
     * edition, remettant lecture et selection a zero.
     */
    const [initialProjectId] = useState(() => requestedId);
    const projectIdRef = useRef(initialProjectId || null);
    const [projectId, setProjectId] = useState(initialProjectId || null);
    const [status, setStatus] = useState(initialProjectId ? 'loading' : 'ready');
    const [saveState, setSaveState] = useState('idle');
    const [warnings, setWarnings] = useState([]);

    const restoreProject = useVideoStore((state) => state.restoreProject);
    const projectName = useVideoStore((state) => state.projectName);
    const setProjectName = useVideoStore((state) => state.setProjectName);

    // Chargement initial
    useEffect(() => {
        if (!initialProjectId) {
            // Nouveau brouillon: on repart d'un projet vide pour ne pas heriter
            // du montage precedent laisse dans le store. Le format social vertical
            // est le defaut du montage rapide.
            restoreProject({ sequencePreset: 'instagram-reel' });
            return undefined;
        }
        let active = true;
        loadProject(initialProjectId)
            .then((restored) => {
                if (!active) return;
                if (!restored) {
                    setStatus('missing');
                    return;
                }
                restoreProject(restored.state);
                setWarnings(restored.warnings || []);
                projectIdRef.current = initialProjectId;
                setProjectId(initialProjectId);
                setStatus('ready');
            })
            .catch(() => {
                if (active) setStatus('error');
            });
        return () => { active = false; };
    }, [initialProjectId, restoreProject]);

    // Sauvegarde automatique debouncee des que le montage change
    useEffect(() => {
        if (status !== 'ready') return undefined;
        let timer = null;
        const unsubscribe = useVideoStore.subscribe((state, previous) => {
            const changed = state.clips !== previous.clips
                || state.transitions !== previous.transitions
                || state.transitionItems !== previous.transitionItems
                || state.textOverlays !== previous.textOverlays
                || state.audioTracks !== previous.audioTracks
                || state.tracks !== previous.tracks
                || state.sequencePreset !== previous.sequencePreset
                || state.projectName !== previous.projectName;
            if (!changed || state.clips.length === 0) return;

            window.clearTimeout(timer);
            timer = window.setTimeout(async () => {
                try {
                    setSaveState('saving');
                    const id = projectIdRef.current || createProjectId();
                    const isNew = !projectIdRef.current;
                    await saveProject({ id, state: useVideoStore.getState() });
                    projectIdRef.current = id;
                    setProjectId(id);
                    setSaveState('saved');
                    if (isNew) {
                        router.replace(`${window.location.pathname}?project=${encodeURIComponent(id)}`, { scroll: false });
                    }
                } catch {
                    setSaveState('error');
                }
            }, AUTOSAVE_DELAY_MS);
        });
        return () => {
            window.clearTimeout(timer);
            unsubscribe();
        };
    }, [router, status]);

    /*
     * Sauvegarde immediate. Elle doit ancrer l'URL exactement comme la sauvegarde
     * automatique: sinon, appeler `saveNow` juste avant elle lui vole la creation
     * du projet, et le lien reste sans `?project=` alors que le projet existe.
     */
    const saveNow = useCallback(async () => {
        if (!useVideoStore.getState().clips.length) return null;
        setSaveState('saving');
        try {
            const id = projectIdRef.current || createProjectId();
            const isNew = !projectIdRef.current;
            await saveProject({ id, state: useVideoStore.getState() });
            projectIdRef.current = id;
            setProjectId(id);
            setSaveState('saved');
            if (isNew) {
                router.replace(`${window.location.pathname}?project=${encodeURIComponent(id)}`, { scroll: false });
            }
            return id;
        } catch {
            setSaveState('error');
            return null;
        }
    }, [router]);

    const renameCurrentProject = useCallback((name) => {
        setProjectName(String(name || '').trim() || 'Projet sans titre');
    }, [setProjectName]);

    return {
        projectId,
        projectName,
        status,
        saveState,
        warnings,
        saveNow,
        renameCurrentProject,
    };
}

export default useVibeCutProject;
