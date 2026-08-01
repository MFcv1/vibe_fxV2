"use client";

/*
 * Adaptateur bibliotheque de projets.
 * Regle d'architecture VibeCut: aucun composant d'interface ne parle directement
 * a IndexedDB ni au store video. Tout passe par un adaptateur comme celui-ci.
 */

import { useCallback, useEffect, useState } from 'react';
import {
    createEmptyProject,
    deleteProject as deleteStoredProject,
    listProjects,
    renameProject as renameStoredProject,
} from '../services/projectLibrary';

export function useProjectLibrary() {
    const [projects, setProjects] = useState([]);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        try {
            const next = await listProjects();
            setProjects(next);
            setStatus('ready');
            setError(null);
            return next;
        } catch (cause) {
            setStatus('error');
            setError(cause?.message || 'Lecture des projets impossible.');
            return [];
        }
    }, []);

    useEffect(() => {
        let active = true;
        listProjects()
            .then((next) => {
                if (!active) return;
                setProjects(next);
                setStatus('ready');
            })
            .catch((cause) => {
                if (!active) return;
                setStatus('error');
                setError(cause?.message || 'Lecture des projets impossible.');
            });
        return () => { active = false; };
    }, []);

    const createProject = useCallback(async (options) => {
        const created = await createEmptyProject(options);
        await refresh();
        return created;
    }, [refresh]);

    const renameProject = useCallback(async (id, name) => {
        await renameStoredProject(id, name);
        await refresh();
    }, [refresh]);

    const removeProject = useCallback(async (id) => {
        await deleteStoredProject(id);
        await refresh();
    }, [refresh]);

    return {
        projects,
        status,
        error,
        isLoading: status === 'loading',
        isEmpty: status === 'ready' && projects.length === 0,
        refresh,
        createProject,
        renameProject,
        removeProject,
    };
}

export default useProjectLibrary;
