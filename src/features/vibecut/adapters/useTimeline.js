"use client";

/*
 * Adaptateur timeline multipiste (phase 4).
 *
 * Seule couche du nouveau front qui connait le store video. Elle expose le
 * modele canonique `timelineModel.buildTimelineModel` tel quel - pistes et
 * elements deja places dans le temps - plus les actions d'edition.
 *
 * Ce que le modele autorise, et donc ce que l'interface a le droit de proposer:
 * - piste video: les clips sont poses BOUT A BOUT, leur debut est CALCULE. On
 *   ne peut donc pas les deplacer librement, seulement les REORDONNER et les
 *   rogner. Proposer un deplacement libre mentirait sur le modele.
 * - pistes texte, musique et transitions libres: le debut est une donnee, le
 *   deplacement et le redimensionnement sont reels.
 */

import { useCallback, useMemo } from 'react';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import {
    DEFAULT_SNAP_THRESHOLD_SECONDS,
    buildTimelineModel,
    buildTimelineSnapPoints,
    getTimelineTrackRole,
    snapTimeToPoints,
} from '@/features/vibefx-studio/video/model/timelineModel';
import { isImageMedia } from '@/features/vibefx-studio/video/model/mediaModel';
import { MAX_TRANSITION_SHARE } from '../data/styleRecipes';

export const MOVABLE_ITEM_TYPES = new Set(['text', 'audio', 'transition']);

export const MIN_TRANSITION_DURATION = 0.2;

/*
 * Plafond d'une transition de coupe.
 *
 * `resolveCutTransitionOverlap` du modele accepte jusqu'a 100 % du plus court
 * des deux plans: une transition pouvait donc devorer un plan entier. La regle
 * des 45 % existait deja, mais seulement dans les presets guides. On reutilise
 * LA MEME constante pour qu'il n'y ait qu'une regle dans tout le produit.
 */
export function getMaxTransitionDuration(outgoingDuration = 0, incomingDuration = 0) {
    const shortest = Math.min(
        Number(outgoingDuration) || 0,
        Number(incomingDuration) || Number(outgoingDuration) || 0,
    );
    const ceiling = Math.max(0, shortest) * MAX_TRANSITION_SHARE;
    return Math.max(MIN_TRANSITION_DURATION, Math.round(ceiling * 100) / 100);
}

export function clampTransitionDuration(duration, outgoingDuration, incomingDuration) {
    const max = getMaxTransitionDuration(outgoingDuration, incomingDuration);
    return Math.min(max, Math.max(MIN_TRANSITION_DURATION, Number(duration) || 0));
}

/* Les pistes, dans l'ordre du modele, avec un libelle d'interface. */
export const TRACK_LABELS = {
    sequence: 'Volets',
    video: 'Vidéo',
    transition: 'Transitions',
    effect: 'Effets',
    text: 'Texte',
    'clip-audio': 'Son des clips',
    music: 'Musique',
};

export function isItemMovable(item = {}) {
    if (!MOVABLE_ITEM_TYPES.has(item.type)) return false;
    // Le son embarque d'un clip suit son clip: il n'a pas d'existence propre.
    if (item.type === 'audio' && item.params?.embedded) return false;
    // Une transition de coupe est calee sur la jointure de deux clips.
    if (item.type === 'transition' && item.params?.editable === false) return false;
    return true;
}

export function useTimelineModel() {
    const clips = useVideoStore((state) => state.clips);
    const transitions = useVideoStore((state) => state.transitions);
    const transitionItems = useVideoStore((state) => state.transitionItems);
    const textOverlays = useVideoStore((state) => state.textOverlays);
    const audioTracks = useVideoStore((state) => state.audioTracks);
    const tracks = useVideoStore((state) => state.tracks);
    const totalDuration = useVideoStore((state) => state.totalDuration);

    const model = useMemo(() => buildTimelineModel({
        clips, transitions, transitionItems, textOverlays, audioTracks, tracks, totalDuration,
    }), [audioTracks, clips, textOverlays, totalDuration, tracks, transitionItems, transitions]);

    /*
     * Points de magnetisme. La tete de lecture en est volontairement exclue
     * (`currentTime: 0`): la recalculer a chaque frame de lecture rendrait la
     * liste instable et re-rendrait la timeline 60 fois par seconde.
     */
    const snapPoints = useMemo(() => buildTimelineSnapPoints({
        clips, transitions, transitionItems, textOverlays, audioTracks, totalDuration, currentTime: 0,
    }), [audioTracks, clips, textOverlays, totalDuration, transitionItems, transitions]);

    const lanes = useMemo(() => model.tracks.map((track) => {
        const role = getTimelineTrackRole(track);
        return {
            ...track,
            role,
            label: TRACK_LABELS[role] || track.name || role,
            items: model.items.filter((item) => item.trackId === track.id),
        };
    }), [model.items, model.tracks]);

    const displayLanes = useMemo(() => buildDisplayLanes(lanes), [lanes]);

    return {
        ...model, lanes, displayLanes, snapPoints, totalDuration, clipCount: clips.length,
    };
}

/*
 * Projection d'AFFICHAGE: sept pistes de modele -> quatre rangees reelles.
 *
 * Le modele canonique garde ses sept pistes - c'est le contrat d'export, et
 * l'ancien front s'en sert jusqu'a la phase 7. Mais trois d'entre elles ne sont
 * pas des pistes de montage: une transition n'existe QUE par rapport a une
 * coupe, la colorimetrie est un attribut du plan, et le son d'un plan suit son
 * plan. DaVinci et Premiere les rendent donc SUR le plan, pas a cote.
 *
 * Les replier ici, et seulement ici, evite d'inventer un second modele.
 */
export function buildDisplayLanes(lanes = []) {
    const byRole = new Map(lanes.map((lane) => [lane.role, lane]));
    const video = byRole.get('video');
    const transitionLane = byRole.get('transition');
    const effectLane = byRole.get('effect');
    const clipAudioLane = byRole.get('clip-audio');

    /*
     * Masquer une piste repliee doit vraiment la masquer: sinon la bascule de
     * la barre d'outils serait un bouton mort (plan.md § 4.2). C'est aussi ce
     * que fait le plan de rendu, qui ignore une piste d'effets invisible.
     */
    const showTransitions = transitionLane?.visible !== false;
    const showEffects = effectLane?.visible !== false;
    const transitionItems = showTransitions ? (transitionLane?.items || []) : [];
    const effectItems = showEffects ? (effectLane?.items || []) : [];
    const clipAudioItems = clipAudioLane?.items || [];

    /* Un plan porte ce qui le decrit: sa transition de sortie, ses badges, son son. */
    const clips = (video?.items || []).map((item, index) => {
        const clipId = item.sourceId || item.id;
        const source = item.source || {};
        // `fromItemId` vit dans `params` cote modele, pas a la racine.
        const transitionAfter = transitionItems.find(
            (entry) => (entry.params?.fromItemId || entry.fromItemId) === clipId,
        ) || null;
        const speed = Number(source.speed) > 0 ? Number(source.speed) : 1;
        const volume = Number(source.volume ?? 100);
        const motionPreset = source.motion?.preset || 'none';
        // Une photo n'a pas de son: ni badge de volume, ni forme d'onde.
        const isImage = isImageMedia(source);

        const badges = [];
        if (effectItems.some((entry) => (entry.params?.clipId || entry.sourceId) === clipId)) {
            badges.push({ id: 'color', label: 'Colorimétrie', section: 'color' });
        }
        if (motionPreset && motionPreset !== 'none') {
            badges.push({ id: 'motion', label: 'Mouvement', section: 'motion' });
        }
        if (Math.abs(speed - 1) > 0.001) {
            badges.push({ id: 'speed', label: `Vitesse ${speed}×`, section: 'speed' });
        }
        if (!isImage && Math.abs(volume - 100) > 0.5) {
            badges.push({ id: 'audio', label: `Volume ${Math.round(volume)} %`, section: 'audio' });
        }

        return {
            ...item,
            index,
            clipId,
            isImage,
            transitionAfter,
            badges,
            linkedAudio: clipAudioItems.find(
                (entry) => (entry.params?.clipId || entry.sourceId) === clipId,
            ) || null,
        };
    });

    const rows = [];
    const sequence = byRole.get('sequence');
    // La rangee des volets ne s'affiche que si elle porte quelque chose: une
    // rangee vide en permanence n'apprend rien et coute de la hauteur.
    if (sequence && sequence.items.length > 0) {
        rows.push({ ...sequence, kind: 'sequence', clips: [] });
    }
    // Le son des plans est replie sur la rangee video: son etat "muet" doit
    // donc y remonter, sinon la bascule de la barre d'outils n'aurait aucun
    // effet visible.
    if (video) rows.push({ ...video, kind: 'video', clips, mutedAudio: Boolean(clipAudioLane?.muted) });
    const text = byRole.get('text');
    if (text) rows.push({ ...text, kind: 'text', clips: [] });
    const music = byRole.get('music');
    if (music) rows.push({ ...music, kind: 'music', clips: [] });

    return rows;
}

/*
 * Bascules des pistes repliees. Elles restent PILOTABLES - masquer les
 * transitions, contourner la colorimetrie, couper le son des plans sont de
 * vraies capacites du modele - mais depuis la barre d'outils, pas depuis une
 * rangee qui n'existe plus.
 */
export const FOLDED_TRACK_TOGGLES = [
    { role: 'transition', key: 'visible', label: 'Afficher les transitions' },
    { role: 'effect', key: 'visible', label: 'Appliquer la colorimétrie' },
    { role: 'clip-audio', key: 'muted', label: 'Son des plans', invert: true },
];

/* Selection courante, sous la forme d'un seul identifiant d'element de timeline. */
export function useTimelineSelection() {
    const selectedClipId = useVideoStore((state) => state.selectedClipId);
    const selectedTextId = useVideoStore((state) => state.selectedTextId);
    const selectedTransitionId = useVideoStore((state) => state.selectedTransitionId);
    const selectedAudioTrackId = useVideoStore((state) => state.selectedAudioTrackId);

    return useMemo(() => ({
        selectedClipId,
        selectedTextId,
        selectedTransitionId,
        selectedAudioTrackId,
        selectedItemId: selectedTextId || selectedTransitionId || selectedAudioTrackId || selectedClipId || null,
    }), [selectedAudioTrackId, selectedClipId, selectedTextId, selectedTransitionId]);
}

export function useSnapEnabled() {
    return useVideoStore((state) => state.snapEnabled);
}

export function useTimelineActions() {
    const updateTimelineItem = useVideoStore((state) => state.updateTimelineItem);
    const updateClip = useVideoStore((state) => state.updateClip);
    const removeClip = useVideoStore((state) => state.removeClip);
    const reorderClips = useVideoStore((state) => state.reorderClips);
    const splitClip = useVideoStore((state) => state.splitClip);
    const removeTextOverlay = useVideoStore((state) => state.removeTextOverlay);
    const removeAudioTrack = useVideoStore((state) => state.removeAudioTrack);
    const removeTransitionItem = useVideoStore((state) => state.removeTransitionItem);
    const setTrackState = useVideoStore((state) => state.setTrackState);
    const setSnapEnabled = useVideoStore((state) => state.setSnapEnabled);
    const setSelectedClipId = useVideoStore((state) => state.setSelectedClipId);
    const setSelectedTextId = useVideoStore((state) => state.setSelectedTextId);
    const setSelectedTransitionId = useVideoStore((state) => state.setSelectedTransitionId);
    const setSelectedAudioTrackId = useVideoStore((state) => state.setSelectedAudioTrackId);
    const beginHistoryTransaction = useVideoStore((state) => state.beginHistoryTransaction);
    const commitHistoryTransaction = useVideoStore((state) => state.commitHistoryTransaction);
    const seekTo = useVideoStore((state) => state.seekTo);

    /*
     * La selection est exclusive: un seul inspecteur a la fois.
     *
     * `effect` n'a pas d'inspecteur propre - un element de la piste Effets EST
     * la colorimetrie d'un clip. Le renvoyer vers son clip evite de vider
     * l'inspecteur au clic, ce qui donnait l'impression d'un element mort.
     *
     * `seek: true` amene la tete de lecture DANS l'element choisi quand elle
     * n'y est pas deja. Sans cela on reglait le mouvement ou la colorimetrie
     * d'un plan que l'apercu n'affichait pas: le reglage marchait, mais rien
     * ne le montrait.
     */
    const selectItem = useCallback((item, { seek = false } = {}) => {
        if (!item) {
            setSelectedClipId(null);
            setSelectedTextId(null);
            setSelectedTransitionId(null);
            setSelectedAudioTrackId(null);
            return;
        }
        const ownsClip = item.type === 'video'
            || item.type === 'effect'
            || (item.type === 'audio' && item.params?.embedded);
        const clipId = ownsClip ? (item.params?.clipId || item.sourceId || item.id) : null;
        const isMusic = item.type === 'audio' && !item.params?.embedded;
        setSelectedClipId(clipId);
        setSelectedTextId(item.type === 'text' ? item.id : null);
        setSelectedTransitionId(item.type === 'transition' ? item.id : null);
        setSelectedAudioTrackId(isMusic ? item.id : null);

        if (!seek) return;
        const start = Number(item.start) || 0;
        const end = start + (Number(item.duration) || 0);
        const current = useVideoStore.getState().currentTime;
        // Deja dedans: on ne bouge pas, sinon chaque clic perdrait la position.
        if (current >= start && current <= end) return;
        // Legerement en retrait du bord: pile sur la jointure, on afficherait
        // le plan voisin ou le milieu d'une transition.
        seekTo(Math.min(end, start + Math.min(0.15, (end - start) / 2)));
    }, [seekTo, setSelectedAudioTrackId, setSelectedClipId, setSelectedTextId, setSelectedTransitionId]);

    const moveItem = useCallback((item, start, { history = false } = {}) => {
        if (!isItemMovable(item)) return;
        updateTimelineItem(item.id, { start, duration: item.duration }, { history });
    }, [updateTimelineItem]);

    const resizeItem = useCallback((item, { start, duration }, { history = false } = {}) => {
        updateTimelineItem(item.id, { start, duration }, { history });
    }, [updateTimelineItem]);

    /*
     * Rognage d'un clip video. Le modele derive la duree de `trimEnd - trimStart`
     * divisee par la vitesse: on ecrit donc les points de coupe, jamais une duree
     * de timeline, sinon la source serait etiree.
     */
    const trimClip = useCallback((clip, { trimStart, trimEnd }, { history = false } = {}) => {
        const updates = {};
        if (Number.isFinite(trimStart)) updates.trimStart = Math.max(0, trimStart);
        if (Number.isFinite(trimEnd)) updates.trimEnd = trimEnd;
        if (isImageMedia(clip) && Number.isFinite(trimEnd)) {
            // Une photo n'a pas de source a rogner: sa duree EST son reglage.
            const from = updates.trimStart ?? (Number(clip.trimStart) || 0);
            updates.duration = Math.max(0, trimEnd - from);
        }
        updateClip(clip.id, updates, { history });
    }, [updateClip]);

    /* Decoupe a la tete de lecture: conversion temps timeline -> temps media. */
    const splitAtPlayhead = useCallback((item) => {
        if (!item || item.type !== 'video') return false;
        const state = useVideoStore.getState();
        const time = state.currentTime;
        const start = item.start;
        const end = start + item.duration;
        if (time <= start + 0.2 || time >= end - 0.2) return false;
        const clip = state.clips.find((entry) => entry.id === (item.sourceId || item.id));
        if (!clip) return false;
        const speed = Number(clip.speed) > 0 ? Number(clip.speed) : 1;
        const trimStart = Number(clip.trimStart) || 0;
        const trimEnd = Number.isFinite(Number(clip.trimEnd)) ? Number(clip.trimEnd) : Number(clip.duration) || 0;
        const localTime = Math.max(trimStart, Math.min(trimEnd, trimStart + (time - start) * speed));
        splitClip(clip.id, localTime);
        return true;
    }, [splitClip]);

    const removeItem = useCallback((item) => {
        if (!item) return;
        if (item.type === 'video') removeClip(item.sourceId || item.id);
        else if (item.type === 'text') removeTextOverlay(item.id);
        else if (item.type === 'audio' && !item.params?.embedded) removeAudioTrack(item.id);
        else if (item.type === 'transition') removeTransitionItem(item.id);
    }, [removeAudioTrack, removeClip, removeTextOverlay, removeTransitionItem]);

    const setClipMotion = useCallback((clipId, motion, { history = true } = {}) => {
        updateClip(clipId, { motion }, { history });
    }, [updateClip]);

    const setClipSpeed = useCallback((clipId, speed) => {
        updateClip(clipId, { speed }, { history: true });
    }, [updateClip]);

    const setClipVolume = useCallback((clipId, volume) => {
        updateClip(clipId, { volume });
    }, [updateClip]);

    const setClipFilters = useCallback((clipId, filters, { history = false } = {}) => {
        updateClip(clipId, { filters }, { history });
    }, [updateClip]);

    const setClipRotation = useCallback((clipId, orientationRotation) => {
        updateClip(clipId, { orientationRotation }, { history: true });
    }, [updateClip]);

    const snapTime = useCallback((time, points, enabled) => {
        if (!enabled) return { time, snapped: false, point: null };
        return snapTimeToPoints(time, points, DEFAULT_SNAP_THRESHOLD_SECONDS);
    }, []);

    return {
        selectItem,
        moveItem,
        resizeItem,
        trimClip,
        splitAtPlayhead,
        removeItem,
        reorderClips,
        setClipMotion,
        setClipSpeed,
        setClipVolume,
        setClipFilters,
        setClipRotation,
        setTrackState,
        setSnapEnabled,
        beginHistoryTransaction,
        commitHistoryTransaction,
        seekTo,
        snapTime,
    };
}

export default useTimelineModel;
