"use client";

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { srcToBlob } from '../layout/layoutPersistence';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';

/*
 * Le nouveau Studio ne monte plus le lourd éditeur photo. Il ne porte que le
 * contrat commun des mini-apps : une image générée entre dans le fond du projet
 * sous forme de Blob IndexedDB, jamais de dataURL persistée.
 */
export default function useStudioGenerators() {
    const { project, status, updateProject, ensureProject } = useVibeOsProject();
    const blobCacheRef = useRef(new Map());

    useEffect(() => {
        if (status === 'ready' && !project) ensureProject();
    }, [ensureProject, project, status]);

    const lumen = project?.background?.lumen || null;
    const activeGenerator = useMemo(() => {
        if (!lumen) return null;
        if (lumen.generator === 'gradient' || lumen.mode === 'gradient') return 'gradient';
        return 'lumen';
    }, [lumen]);

    const applyGeneratedBackground = useCallback(async (payload) => {
        if (!payload?.dataUrl) return false;
        await ensureProject();
        const blob = await srcToBlob(payload.dataUrl, blobCacheRef.current);
        if (!blob) return false;

        const generator = payload.generator === 'gradient' ? 'gradient' : 'lumen';
        const name = payload.styleName || payload.title || payload.mode
            || (generator === 'gradient' ? 'Gradient' : 'Fond Lumen');

        updateProject((current) => ({
            background: {
                ...(current.background || {}),
                mesh: null,
                blur: false,
                lumen: {
                    id: `${generator}-${Date.now()}`,
                    generator,
                    name,
                    mode: payload.mode || null,
                    styleName: payload.styleName || payload.title || null,
                    seed: payload.seed ?? null,
                    designCode: payload.designCode ?? null,
                    blob,
                },
            },
        }));
        return true;
    }, [ensureProject, updateProject]);

    const clearGeneratedBackground = useCallback(() => {
        updateProject((current) => ({
            background: {
                ...(current.background || {}),
                mesh: null,
                lumen: null,
            },
        }));
    }, [updateProject]);

    return {
        activeGenerator,
        activeName: lumen?.name || null,
        applyGeneratedBackground,
        clearGeneratedBackground,
    };
}
