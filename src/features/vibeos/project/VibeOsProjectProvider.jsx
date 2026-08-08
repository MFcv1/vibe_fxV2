"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createEmptyProject, createProjectId, normalizeProject, projectToRecentMeta } from './projectModel';
import {
    deleteProject as dbDeleteProject,
    getCurrentProjectId,
    listRecentProjects,
    loadProject,
    saveProject,
    setCurrentProjectId,
} from './projectDb';

/*
 * Le projet commun qui circule entre les pages /creer (plan §4.3).
 * - `project` : le projet courant (null tant que rien n'est charge/cree).
 * - `updateProject(patch)` : merge superficiel + updatedAt, autosauvegarde
 *   debouncee 800ms dans IndexedDB.
 * - `recents` : metadonnees des 8 derniers projets pour l'accueil.
 */

const AUTOSAVE_DELAY_MS = 800;

const ProjectContext = createContext(null);

export function VibeOsProjectProvider({ children }) {
    const [project, setProject] = useState(null);
    const [recents, setRecents] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | ready
    const saveTimerRef = useRef(null);
    const projectRef = useRef(null);

    useEffect(() => {
        projectRef.current = project;
    }, [project]);

    const refreshRecents = useCallback(async () => {
        const projects = await listRecentProjects();
        setRecents(projects.map(projectToRecentMeta));
    }, []);

    /* Chargement initial: projet courant + recents. Pas de creation implicite -
       c'est l'accueil qui decide (bouton Reprendre / choix d'un espace). */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const currentId = await getCurrentProjectId();
            const stored = currentId ? await loadProject(currentId) : null;
            if (cancelled) return;
            if (stored) setProject(normalizeProject(stored));
            await refreshRecents();
            if (!cancelled) setStatus('ready');
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshRecents]);

    const scheduleSave = useCallback((nextProject) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            saveTimerRef.current = null;
            await saveProject(nextProject);
            refreshRecents();
        }, AUTOSAVE_DELAY_MS);
    }, [refreshRecents]);

    /* Sauvegarde immediate a la fermeture de l'onglet si un debounce est en vol. */
    useEffect(() => {
        const flush = () => {
            if (saveTimerRef.current && projectRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
                saveProject(projectRef.current);
            }
        };
        window.addEventListener('pagehide', flush);
        return () => {
            window.removeEventListener('pagehide', flush);
            flush();
        };
    }, []);

    const updateProject = useCallback((patch) => {
        setProject((current) => {
            if (!current) return current;
            const next = {
                ...current,
                ...(typeof patch === 'function' ? patch(current) : patch),
                updatedAt: Date.now(),
            };
            scheduleSave(next);
            return next;
        });
    }, [scheduleSave]);

    const createProject = useCallback(async (overrides = {}) => {
        const fresh = createEmptyProject(overrides);
        setProject(fresh);
        await saveProject(fresh);
        await setCurrentProjectId(fresh.id);
        refreshRecents();
        return fresh;
    }, [refreshRecents]);

    const openProject = useCallback(async (id) => {
        const stored = await loadProject(id);
        if (!stored) return null;
        const normalized = normalizeProject(stored);
        setProject(normalized);
        await setCurrentProjectId(normalized.id);
        return normalized;
    }, []);

    const duplicateProject = useCallback(async (id) => {
        const stored = await loadProject(id);
        if (!stored) return null;
        const copy = normalizeProject({
            ...stored,
            id: createProjectId(),
            title: `${stored.title || 'Sans titre'} (copie)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        await saveProject(copy);
        await refreshRecents();
        return copy;
    }, [refreshRecents]);

    const removeProject = useCallback(async (id) => {
        await dbDeleteProject(id);
        if (projectRef.current?.id === id) {
            setProject(null);
            await setCurrentProjectId(null);
        }
        await refreshRecents();
    }, [refreshRecents]);

    /* Garantit un projet courant avant d'entrer dans un espace de creation. */
    const ensureProject = useCallback(async () => {
        if (projectRef.current) return projectRef.current;
        return createProject();
    }, [createProject]);

    const value = useMemo(() => ({
        project,
        recents,
        status,
        updateProject,
        createProject,
        openProject,
        duplicateProject,
        removeProject,
        ensureProject,
    }), [project, recents, status, updateProject, createProject, openProject, duplicateProject, removeProject, ensureProject]);

    return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useVibeOsProject() {
    const context = useContext(ProjectContext);
    if (!context) throw new Error('useVibeOsProject doit etre utilise sous <VibeOsProjectProvider>');
    return context;
}
