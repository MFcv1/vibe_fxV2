"use client";

/*
 * Adaptateur scenes: expose le montage sous la forme que l'interface manipule
 * (une liste de scenes ordonnees avec leur place sur la timeline), et les actions
 * correspondantes. Les composants n'appellent jamais le store directement.
 */

import { useCallback, useMemo } from 'react';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import { resolveTimelineRenderPlan } from '@/features/vibefx-studio/video/model/timelineModel';
import {
    MAX_IMAGE_DURATION_SECONDS,
    MIN_IMAGE_DURATION_SECONDS,
    isImageMedia,
} from '@/features/vibefx-studio/video/model/mediaModel';

export const MIN_SCENE_DURATION = MIN_IMAGE_DURATION_SECONDS;
export const MAX_SCENE_DURATION = MAX_IMAGE_DURATION_SECONDS;

function resolveSceneDuration(clip) {
    const trimStart = Number(clip.trimStart) || 0;
    const trimEnd = Number.isFinite(Number(clip.trimEnd)) ? Number(clip.trimEnd) : Number(clip.duration) || 0;
    const speed = Number(clip.speed) > 0 ? Number(clip.speed) : 1;
    return Math.max(0, (trimEnd - trimStart) / speed);
}

export function useScenes() {
    const clips = useVideoStore((state) => state.clips);
    const transitions = useVideoStore((state) => state.transitions);
    const transitionItems = useVideoStore((state) => state.transitionItems);
    const textOverlays = useVideoStore((state) => state.textOverlays);
    const audioTracks = useVideoStore((state) => state.audioTracks);
    const tracks = useVideoStore((state) => state.tracks);
    const totalDuration = useVideoStore((state) => state.totalDuration);
    const selectedClipId = useVideoStore((state) => state.selectedClipId);

    const plan = useMemo(() => resolveTimelineRenderPlan({
        clips, transitions, transitionItems, textOverlays, audioTracks, tracks, totalDuration,
    }), [audioTracks, clips, textOverlays, totalDuration, tracks, transitionItems, transitions]);

    const scenes = useMemo(() => clips.map((clip, index) => {
        const planClip = plan.clips.find((item) => (item.sourceId || item.id) === clip.id);
        const nextClip = clips[index + 1] || null;
        const transitionToNext = nextClip
            ? plan.allTransitions.find((item) => (
                item.params?.placement === 'cut'
                && item.fromItemId === clip.id
                && item.toItemId === nextClip.id
            )) || null
            : null;

        return {
            id: clip.id,
            index,
            name: clip.name || `Scène ${index + 1}`,
            isImage: isImageMedia(clip),
            thumbnail: clip.thumbnails?.[0] || null,
            duration: resolveSceneDuration(clip),
            sourceDuration: Number(clip.duration) || 0,
            trimStart: Number(clip.trimStart) || 0,
            trimEnd: Number.isFinite(Number(clip.trimEnd)) ? Number(clip.trimEnd) : Number(clip.duration) || 0,
            volume: Number.isFinite(Number(clip.volume)) ? Number(clip.volume) : 100,
            motionPreset: clip.motion?.preset || (isImageMedia(clip) ? 'none' : null),
            timelineStart: Number(planClip?.start ?? planClip?.startTime ?? 0),
            selected: clip.id === selectedClipId,
            nextSceneId: nextClip?.id || null,
            transitionToNext: transitionToNext
                ? {
                    id: transitionToNext.id,
                    type: transitionToNext.params?.transitionType || transitionToNext.type,
                    duration: Number(transitionToNext.duration) || 0.5,
                    name: transitionToNext.name || null,
                }
                : null,
        };
    }), [clips, plan.allTransitions, plan.clips, selectedClipId]);

    return { scenes, totalDuration, plan };
}

export function useSceneActions() {
    const updateClip = useVideoStore((state) => state.updateClip);
    const removeClip = useVideoStore((state) => state.removeClip);
    const reorderClips = useVideoStore((state) => state.reorderClips);
    const splitClip = useVideoStore((state) => state.splitClip);
    const setSelectedClipId = useVideoStore((state) => state.setSelectedClipId);
    const setSelectedTextId = useVideoStore((state) => state.setSelectedTextId);
    const setTransition = useVideoStore((state) => state.setTransition);
    const removeTransition = useVideoStore((state) => state.removeTransition);
    const addTextOverlay = useVideoStore((state) => state.addTextOverlay);
    const updateTextOverlay = useVideoStore((state) => state.updateTextOverlay);
    const removeTextOverlay = useVideoStore((state) => state.removeTextOverlay);
    const addAudioTrack = useVideoStore((state) => state.addAudioTrack);
    const updateAudioTrack = useVideoStore((state) => state.updateAudioTrack);
    const removeAudioTrack = useVideoStore((state) => state.removeAudioTrack);
    const seekTo = useVideoStore((state) => state.seekTo);

    const selectScene = useCallback((sceneId, timelineStart = null) => {
        setSelectedClipId(sceneId);
        setSelectedTextId(null);
        if (timelineStart !== null) seekTo(Math.max(0, timelineStart + 0.01));
    }, [seekTo, setSelectedClipId, setSelectedTextId]);

    const setSceneDuration = useCallback((scene, seconds) => {
        const value = Math.max(MIN_SCENE_DURATION, Math.min(MAX_SCENE_DURATION, Number(seconds) || 0));
        if (scene.isImage) {
            updateClip(scene.id, { duration: value }, { history: true });
            return;
        }
        // Video: on ajuste le point de sortie, la source n'est jamais etiree.
        const maxEnd = scene.sourceDuration || scene.trimEnd;
        const trimEnd = Math.min(maxEnd, scene.trimStart + value);
        updateClip(scene.id, { trimEnd }, { history: true });
    }, [updateClip]);

    const setSceneMotion = useCallback((sceneId, motionPreset) => {
        updateClip(sceneId, { motion: motionPreset }, { history: true });
    }, [updateClip]);

    const setSceneVolume = useCallback((sceneId, volume) => {
        updateClip(sceneId, { volume: Math.max(0, Math.min(100, Number(volume) || 0)) });
    }, [updateClip]);

    const applyTransition = useCallback((scene, transition) => {
        if (!scene?.nextSceneId) return;
        if (!transition) {
            removeTransition(scene.id, scene.nextSceneId);
            return;
        }
        setTransition(scene.id, scene.nextSceneId, {
            type: transition.engineId || transition.type,
            duration: Number(transition.duration) || transition.defaultDuration || 0.5,
            name: transition.name,
            category: transition.group || 'basic',
            params: { placement: 'cut' },
        });
    }, [removeTransition, setTransition]);

    const applyTransitionToAll = useCallback((scenes, transition) => {
        scenes.forEach((scene) => {
            if (!scene.nextSceneId) return;
            if (!transition) {
                removeTransition(scene.id, scene.nextSceneId);
                return;
            }
            setTransition(scene.id, scene.nextSceneId, {
                type: transition.engineId || transition.type,
                duration: Number(transition.duration) || transition.defaultDuration || 0.5,
                name: transition.name,
                category: transition.group || 'basic',
                params: { placement: 'cut' },
            });
        });
    }, [removeTransition, setTransition]);

    const applyMotionToAllImages = useCallback((scenes, motionPreset) => {
        scenes.filter((scene) => scene.isImage).forEach((scene) => {
            updateClip(scene.id, { motion: motionPreset }, { history: true });
        });
    }, [updateClip]);

    const addSceneTitle = useCallback((scene, content = 'Ton titre') => {
        const start = Math.max(0, scene.timelineStart + 0.1);
        const visibleDuration = Math.max(1, Math.min(4, scene.duration - 0.2));
        const id = `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        addTextOverlay({
            id,
            content,
            startTime: start,
            endTime: start + visibleDuration,
            fontSize: 64,
            bold: true,
            color: '#ffffff',
            x: 0.5,
            y: 0.78,
            animation: 'fade',
            animationOut: 'fade',
        });
        // Le texte devient l'element selectionne, et la tete de lecture se place
        // dessus: sinon on ajoute un texte qu'on ne voit pas et qu'on ne peut
        // donc pas attraper a la souris sur l'apercu.
        setSelectedTextId(id);
        setSelectedClipId(null);
        // Milieu du texte: on evite de tomber en plein fondu d'entree, ou le
        // texte serait presque transparent et impossible a attraper.
        seekTo(start + visibleDuration / 2);
        return id;
    }, [addTextOverlay, seekTo, setSelectedClipId, setSelectedTextId]);

    /*
     * Ajout de musique.
     * Le manifeste de droits est obligatoire cote export: une piste incomplete
     * bloque le rendu. On exige donc une declaration explicite, et on refuse de
     * fabriquer des metadonnees a la place de l'utilisateur.
     */
    const addMusic = useCallback(({ file, rights, totalDuration: duration, sourceDuration } = {}) => {
        if (!file || !rights) return null;
        const id = `audio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        addAudioTrack({
            id,
            name: file.name.replace(/\.[^.]+$/, ''),
            file,
            url: URL.createObjectURL(file),
            startTime: 0,
            endTime: Math.max(1, duration || 10),
            volume: 70,
            trimStart: 0,
            fadeIn: 0,
            // Une musique qui s'arrete net en fin de video s'entend: 1 s de
            // fondu par defaut, ajustable dans le bloc Musique.
            fadeOut: 1,
            sourceDuration: Number(sourceDuration) || 0,
            sourceName: rights.sourceName,
            sourceUrl: rights.sourceUrl,
            license: rights.license,
            licenseUrl: rights.licenseUrl,
            attribution: rights.attribution || '',
            rightsStatus: rights.rightsStatus,
            socialUse: rights.socialUse === true,
            commercialUse: rights.commercialUse === true,
        });
        return id;
    }, [addAudioTrack]);

    /*
     * Decoupe la scene selectionnee a la position de lecture.
     * Le store attend un temps LOCAL au media (avant vitesse et trim), pas un
     * temps de timeline: on fait la conversion ici.
     */
    const splitSceneAtPlayhead = useCallback((scene) => {
        if (!scene) return false;
        const state = useVideoStore.getState();
        const time = state.currentTime;
        const start = scene.timelineStart;
        const end = start + scene.duration;
        if (time <= start + 0.2 || time >= end - 0.2) return false;
        const clip = state.clips.find((item) => item.id === scene.id);
        if (!clip) return false;
        const speed = Number(clip.speed) > 0 ? Number(clip.speed) : 1;
        const trimStart = Number(clip.trimStart) || 0;
        const trimEnd = Number.isFinite(Number(clip.trimEnd)) ? Number(clip.trimEnd) : Number(clip.duration) || 0;
        const localTime = Math.max(trimStart, Math.min(trimEnd, trimStart + (time - start) * speed));
        splitClip(scene.id, localTime);
        return true;
    }, [splitClip]);

    const selectText = useCallback((textId) => {
        setSelectedTextId(textId);
        setSelectedClipId(null);
    }, [setSelectedClipId, setSelectedTextId]);

    /*
     * Supprimer un texte ne doit pas laisser l'inspecteur vide: on rend la main
     * a la scene situee sous la tete de lecture.
     */
    const removeText = useCallback((textId) => {
        const state = useVideoStore.getState();
        const time = state.currentTime;
        removeTextOverlay(textId);
        const plan = resolveTimelineRenderPlan(useVideoStore.getState());
        const active = plan.clips.find((clip) => {
            const start = Number(clip.start ?? clip.startTime ?? 0);
            return time >= start - 0.001 && time <= start + Number(clip.duration || 0) + 0.001;
        }) || plan.clips[0];
        setSelectedTextId(null);
        setSelectedClipId(active ? (active.sourceId || active.id) : null);
    }, [removeTextOverlay, setSelectedClipId, setSelectedTextId]);

    return {
        selectText,
        removeText,
        updateText: updateTextOverlay,
        updateMusic: updateAudioTrack,
        removeMusic: removeAudioTrack,
        selectScene,
        splitSceneAtPlayhead,
        setSceneDuration,
        setSceneMotion,
        setSceneVolume,
        applyTransition,
        applyTransitionToAll,
        applyMotionToAllImages,
        addSceneTitle,
        addMusic,
        removeScene: removeClip,
        reorderScenes: reorderClips,
        splitScene: splitClip,
    };
}
