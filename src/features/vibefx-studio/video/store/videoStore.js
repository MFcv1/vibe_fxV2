import { create } from 'zustand';
import { buildTimelineModel, clampVolumePercent, doesTrackAllowOverlap, findTimelineItemOverlap, getDefaultTracks, getIntroOffset, getSequencePlacement, getTimelineTrackRole, getTrackForItemType, isTrackLocked as isTimelineTrackLocked } from '../model/timelineModel';
import { isImageMedia, normalizeImageDuration, normalizeImageMotion, normalizeMediaType } from '../model/mediaModel';

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const SEQUENCE_TRACK_ID = 'sequence-main';
const normalizeClipFrameRate = (value) => {
    const frameRate = Number(value);
    return Number.isFinite(frameRate) && frameRate > 0 ? frameRate : null;
};
const MAX_CLIP_DURATION_SECONDS = 6 * 60 * 60;
const normalizeClipDuration = (value, fallback = null) => {
    const duration = Number(value);
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_CLIP_DURATION_SECONDS) return fallback;
    return duration;
};
const normalizeOrientationRotation = (value) => (
    ((Math.round((Number(value) || 0) / 90) * 90) % 360 + 360) % 360
);

// Snapshot keys for undo/redo
const SNAPSHOT_KEYS = ['clips', 'transitions', 'transitionItems', 'textOverlays', 'audioTracks', 'tracks', 'selectedClipId', 'selectedTextId', 'selectedTransitionId', 'selectedAudioTrackId', 'sequencePreset'];

const useVideoStore = create((set, get) => ({
    // === PROJECT ===
    projectName: 'Untitled',
    setProjectName: (name) => set({ projectName: name }),
    restoreProject: (project = {}) => {
        const clips = Array.isArray(project.clips) ? project.clips : [];
        const transitions = project.transitions && typeof project.transitions === 'object' ? project.transitions : {};
        const transitionItems = Array.isArray(project.transitionItems) ? project.transitionItems : [];
        const totalDuration = computeTotalDuration(clips, transitions, transitionItems);
        set({
            projectName: project.projectName || 'Untitled',
            clips,
            transitions,
            transitionItems,
            textOverlays: Array.isArray(project.textOverlays) ? project.textOverlays : [],
            audioTracks: Array.isArray(project.audioTracks) ? project.audioTracks : [],
            tracks: Array.isArray(project.tracks) && project.tracks.length ? project.tracks : getDefaultTracks(),
            sequencePreset: project.sequencePreset || 'youtube',
            totalDuration,
            currentTime: 0,
            isPlaying: false,
            selectedClipId: clips[0]?.id || null,
            selectedTextId: null,
            selectedTransitionId: null,
            selectedAudioTrackId: null,
            activePanel: null,
            timelineEditNotice: null,
            _history: [],
            _future: [],
            _historyIndex: -1,
            _historyTransaction: null,
        });
        return clips.length > 0;
    },

    // === CANONICAL TIMELINE MODEL ===
    tracks: getDefaultTracks(),
    timelineEditNotice: null,
    clearTimelineEditNotice: () => set({ timelineEditNotice: null }),
    notifyTimelineEditRejected: (code = 'timeline-rejected', message = 'Edition timeline ignoree.') => rejectTimelineEdit(set, code, message),
    setTrackState: (id, updates) => set((s) => ({
        tracks: s.tracks.map(track => track.id === id ? { ...track, ...updates } : track),
    })),
    addTimelineTrack: (role = 'text') => {
        const state = get();
        const tracks = Array.isArray(state.tracks) && state.tracks.length ? state.tracks : getDefaultTracks();
        const nextTrack = makeNextTimelineTrack(tracks, role);
        if (!nextTrack) {
            rejectTimelineEdit(set, 'track-create-unsupported', 'Type de piste non supporte.');
            return null;
        }
        pushHistory(state);
        set({
            tracks: [...tracks, nextTrack],
            timelineEditNotice: null,
        });
        return nextTrack.id;
    },
    removeTimelineTrack: (id) => {
        const state = get();
        const tracks = Array.isArray(state.tracks) && state.tracks.length ? state.tracks : getDefaultTracks();
        const target = tracks.find(track => track.id === id);
        if (!target) return false;
        if (isDefaultTimelineTrack(id)) {
            rejectTimelineEdit(set, 'track-system', 'Piste principale protegee.');
            return false;
        }
        const trackItems = state.getTimelineModel().items.filter(item => item.trackId === id);
        if (trackItems.length > 0) {
            rejectTimelineEdit(set, 'track-not-empty', 'Supprimez les elements de cette piste avant de retirer la timeline.');
            return false;
        }
        pushHistory(state);
        set((s) => ({
            tracks: s.tracks.filter(track => track.id !== id),
            selectedTextId: s.textOverlays.some(text => text.id === s.selectedTextId && text.trackId === id) ? null : s.selectedTextId,
            selectedTransitionId: s.transitionItems.some(item => item.id === s.selectedTransitionId && item.trackId === id) ? null : s.selectedTransitionId,
            selectedAudioTrackId: s.audioTracks.some(track => track.id === s.selectedAudioTrackId && track.trackId === id) ? null : s.selectedAudioTrackId,
            timelineEditNotice: null,
        }));
        return true;
    },
    addTextTrack: () => {
        return get().addTimelineTrack('text');
    },
    getTimelineModel: () => {
        const s = get();
        return buildTimelineModel({
            clips: s.clips,
            transitions: s.transitions,
            transitionItems: s.transitionItems,
            textOverlays: s.textOverlays,
            audioTracks: s.audioTracks,
            tracks: s.tracks,
            totalDuration: s.totalDuration,
        });
    },
    updateTimelineItem: (id, updates, options = {}) => {
        const state = get();
        const timelineItem = state.getTimelineModel().items.find(item => item.id === id);
        if (!timelineItem) return;
        if (isTimelineTrackLocked(state.tracks, timelineItem.trackId)) {
            rejectTimelineEdit(set, 'track-locked', 'Piste verrouillee: deplacement ignore.');
            return;
        }

        const normalizedUpdates = {
            ...updates,
            ...normalizeTimelineItemUpdates(timelineItem, updates, state.totalDuration),
        };

        if (timelineItem.type === 'transition') {
            get().updateTransitionItem(id, normalizedUpdates, { history: options.history });
            return;
        }
        if (timelineItem.type === 'text') {
            get().updateTextOverlay(id, normalizedUpdates, { history: options.history });
            return;
        }
        if (timelineItem.type === 'audio') {
            get().updateAudioTrack(id, normalizedUpdates, { history: options.history });
            return;
        }
        if (timelineItem.type === 'video') {
            get().updateClip(id, pickClipTimelineUpdates(normalizedUpdates), { history: options.history });
        }
    },
    snapEnabled: false,
    setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
    beginHistoryTransaction: (label = 'timeline-edit') => {
        const state = get();
        if (state._historyTransaction) return;
        const snapshot = createSnapshot(state);
        pushHistory(state, { force: true });
        set({ _historyTransaction: { label, startedAt: Date.now(), snapshot } });
    },
    commitHistoryTransaction: () => {
        const state = get();
        if (!state._historyTransaction) return;
        if (isSnapshotUnchanged(state, state._historyTransaction.snapshot)) {
            const history = state._history.slice(0, -1);
            set({
                _historyTransaction: null,
                _history: history,
                _historyIndex: history.length - 1,
            });
            return;
        }
        set({ _historyTransaction: null });
    },

    // === CLIPS ===
    clips: [],
    selectedClipId: null,
    setSelectedClipId: (id) => set({ selectedClipId: id }),
    filterPreviewBypassClipId: null,
    setFilterPreviewBypassClipId: (id) => set({ filterPreviewBypassClipId: id }),

    addClip: (clipData) => {
        const state = get();
        if (isTimelineTrackLocked(state.tracks, 'video-main')) {
            rejectTimelineEdit(set, 'track-locked', 'Piste video verrouillee: import ignore.');
            return false;
        }
        const safeDuration = normalizeClipDuration(clipData?.duration);
        if (safeDuration === null) {
            rejectTimelineEdit(set, 'media-duration-invalid', `Import refuse pour ${clipData?.name || 'ce media'}: duree absente ou invalide.`);
            return false;
        }
        pushHistory(state);
        set((s) => {
            const newClip = {
                id: clipData.id || uid(),
                name: clipData.name || 'Clip',
                file: clipData.file,
                url: clipData.url,
                mediaType: normalizeMediaType(clipData),
                mimeType: clipData.mimeType || clipData.type || clipData.file?.type || null,
                assetId: clipData.assetId || clipData.id || null,
                duration: safeDuration,
                originalDuration: safeDuration,
                width: Number.isFinite(Number(clipData.width)) ? Number(clipData.width) : null,
                height: Number.isFinite(Number(clipData.height)) ? Number(clipData.height) : null,
                displayWidth: Number.isFinite(Number(clipData.displayWidth)) ? Number(clipData.displayWidth) : null,
                displayHeight: Number.isFinite(Number(clipData.displayHeight)) ? Number(clipData.displayHeight) : null,
                orientationRotation: Number.isFinite(Number(clipData.orientationRotation)) ? normalizeOrientationRotation(clipData.orientationRotation) : 0,
                orientationSource: clipData.orientationSource || 'browser',
                importSessionId: clipData.importSessionId || null,
                trimStart: 0,
                trimEnd: safeDuration,
                thumbnails: clipData.thumbnails || [],
                sourceFrameRate: normalizeClipFrameRate(clipData.sourceFrameRate),
                sourceFrameRateRaw: normalizeClipFrameRate(clipData.sourceFrameRateRaw),
                sourceFrameRateStatus: clipData.sourceFrameRateStatus || 'unknown',
                importFrameRate: normalizeClipFrameRate(clipData.importFrameRate),
                importFrameRateMode: clipData.importFrameRateMode || 'source',
                socialFpsNormalized: clipData.socialFpsNormalized === true,
                speed: 1,
                volume: isImageMedia(clipData) ? 0 : 100,
                motion: isImageMedia(clipData) ? normalizeImageMotion(clipData.motion || 'none') : null,
                filters: {
                    exposure: 0,
                    brightness: 100,
                    contrast: 100,
                    pivot: 50,
                    saturation: 100,
                    vibrance: 0,
                    temperature: 0,
                    tint: 0,
                    hue: 0,
                    shadows: 0,
                    midtones: 0,
                    highlights: 0,
                    fade: 0,
                    vignette: 0,
                    grain: 0,
                },
                waveform: clipData.waveform || (isImageMedia(clipData)
                    ? { status: 'unavailable', peaks: [], reason: 'image-source' }
                    : { status: 'pending', peaks: [] }),
            };
            const clips = [...s.clips, newClip];
            const totalDuration = computeTotalDuration(clips, s.transitions, s.transitionItems);
            return { clips, totalDuration, currentTime: clamp(s.currentTime, 0, totalDuration), timelineEditNotice: null };
        });
        return true;
    },

    applyClipRotationToImportSession: (clipId) => {
        const state = get();
        if (isTimelineTrackLocked(state.tracks, 'video-main')) {
            rejectTimelineEdit(set, 'track-locked', 'Piste video verrouillee: rotation session ignoree.');
            return 0;
        }
        const sourceClip = state.clips.find(c => c.id === clipId);
        const importSessionId = sourceClip?.importSessionId;
        if (!sourceClip || !importSessionId) return 0;
        const sessionClips = state.clips.filter(c => c.importSessionId === importSessionId);
        if (sessionClips.length < 2) return 0;
        const orientationRotation = normalizeOrientationRotation(sourceClip.orientationRotation);
        pushHistory(state);
        set((s) => ({
            clips: s.clips.map(c => c.importSessionId === importSessionId
                ? { ...c, orientationRotation, orientationSource: 'session-manual' }
                : c
            ),
            timelineEditNotice: null,
        }));
        return sessionClips.length;
    },

    /*
     * Applique une PARTITION de montage: une duree et un mouvement par scene, et
     * une transition par coupe.
     *
     * Action ADDITIVE, volontairement distincte de `applyGuidedTemplate` juste
     * en dessous: cette derniere est encore lue par l'ancien front
     * (/studio?workspace=video) jusqu'a la phase 7 et ne doit pas bouger.
     * Elle applique une duree UNIQUE et une transition UNIQUE; celle-ci applique
     * une partition. Les deux cohabitent jusqu'a la bascule.
     *
     * `score` = {
     *   sequencePreset,
     *   scenes: [{ duration, motion }]   // indexe comme state.clips
     *   cuts:   [{ index, type, duration }]  // index = coupe entre i et i+1
     *   lookPatch,
     * }
     * Une seule ecriture, donc une seule entree d'historique et un seul recalcul
     * de timeline: rejouer un preset pendant que l'utilisateur change d'avis
     * reste instantane.
     */
    applyMontageScore: (score = {}) => {
        const state = get();
        if (!state.clips.length) return false;
        if (isTimelineTrackLocked(state.tracks, 'video-main') || isTimelineTrackLocked(state.tracks, 'transition-main')) {
            rejectTimelineEdit(set, 'track-locked', 'Deverrouille les pistes Video et Transitions pour creer le montage guide.');
            return false;
        }
        const sceneScores = Array.isArray(score.scenes) ? score.scenes : [];
        const cutScores = Array.isArray(score.cuts) ? score.cuts : [];
        const lookPatch = score.lookPatch && typeof score.lookPatch === 'object' ? score.lookPatch : {};
        pushHistory(state);
        set((s) => {
            const clips = s.clips.map((clip, index) => {
                const sceneScore = sceneScores[index] || null;
                // La duree d'une video n'est jamais reecrite: on ne peut pas
                // etirer une source. Seules les photos ont une duree libre.
                const imageUpdates = isImageMedia(clip) && sceneScore
                    ? (() => {
                        const duration = normalizeImageDuration(sceneScore.duration);
                        return {
                            duration,
                            originalDuration: duration,
                            trimStart: 0,
                            trimEnd: duration,
                            motion: normalizeImageMotion(sceneScore.motion || 'none'),
                        };
                    })()
                    : {};
                return {
                    ...clip,
                    ...imageUpdates,
                    filters: {
                        ...(clip.filters || {}),
                        ...lookPatch,
                    },
                };
            });
            // Les transitions posees a la main hors coupe sont preservees.
            const freeTransitions = s.transitionItems.filter((item) => (item.params?.placement || 'free') !== 'cut');
            const cutTransitions = cutScores.reduce((items, cut) => {
                const fromClip = clips[cut?.index];
                const toClip = clips[cut?.index + 1];
                const duration = Number(cut?.duration) || 0;
                if (!fromClip || !toClip || !cut?.type || cut.type === 'cut' || duration <= 0) return items;
                items.push(makeCutTransitionItem(fromClip.id, toClip.id, {
                    type: cut.type,
                    duration,
                    name: cut.name || cut.type,
                }, { preserveId: false }));
                return items;
            }, []);
            const transitionItems = [...freeTransitions, ...cutTransitions];
            return {
                clips,
                transitions: {},
                transitionItems,
                totalDuration: computeTotalDuration(clips, {}, transitionItems),
                currentTime: 0,
                isPlaying: false,
                sequencePreset: score.sequencePreset || s.sequencePreset,
                selectedClipId: clips[0]?.id || null,
                selectedTransitionId: null,
                activePanel: null,
                timelineEditNotice: null,
            };
        });
        return true;
    },

    /*
     * Ancien chemin guide: une duree unique et une transition unique pour tout le
     * montage. Encore lu par l'ancien front jusqu'a la phase 7 - ne pas modifier.
     * Le nouveau front passe par `applyMontageScore` ci-dessus.
     */
    applyGuidedTemplate: (template = {}) => {
        const state = get();
        if (!state.clips.length) return false;
        if (isTimelineTrackLocked(state.tracks, 'video-main') || isTimelineTrackLocked(state.tracks, 'transition-main')) {
            rejectTimelineEdit(set, 'track-locked', 'Deverrouille les pistes Video et Transitions pour creer le montage guide.');
            return false;
        }
        const imageDuration = normalizeImageDuration(template.imageDuration);
        const motionPattern = Array.isArray(template.motionPattern) && template.motionPattern.length
            ? template.motionPattern
            : ['zoom-in', 'pan-right', 'zoom-out', 'pan-left'];
        const lookPatch = template.lookPatch && typeof template.lookPatch === 'object' ? template.lookPatch : {};
        const transition = template.transition?.type === 'crossfade'
            ? {
                type: 'crossfade',
                duration: clamp(Number(template.transition.duration) || 0.35, 0.1, 1.5),
                name: template.transition.name || 'Fondu',
                params: { placement: 'cut' },
            }
            : null;
        pushHistory(state);
        set((s) => {
            const clips = s.clips.map((clip, index) => {
                const imageUpdates = isImageMedia(clip)
                    ? {
                        duration: imageDuration,
                        originalDuration: imageDuration,
                        trimStart: 0,
                        trimEnd: imageDuration,
                        motion: normalizeImageMotion(motionPattern[index % motionPattern.length]),
                    }
                    : {};
                return {
                    ...clip,
                    ...imageUpdates,
                    filters: {
                        ...(clip.filters || {}),
                        ...lookPatch,
                    },
                };
            });
            const freeTransitions = s.transitionItems.filter((item) => (item.params?.placement || 'free') !== 'cut');
            const cutTransitions = transition
                ? clips.slice(0, -1).map((clip, index) => (
                    makeCutTransitionItem(clip.id, clips[index + 1].id, transition, { preserveId: false })
                ))
                : [];
            const transitionItems = [...freeTransitions, ...cutTransitions];
            const totalDuration = computeTotalDuration(clips, {}, transitionItems);
            return {
                clips,
                transitions: {},
                transitionItems,
                totalDuration,
                currentTime: 0,
                isPlaying: false,
                sequencePreset: template.sequencePreset || s.sequencePreset,
                selectedClipId: clips[0]?.id || null,
                selectedTransitionId: null,
                activePanel: null,
                timelineEditNotice: null,
            };
        });
        return true;
    },

    removeClip: (id) => {
        const state = get();
        if (isTimelineTrackLocked(state.tracks, 'video-main')) {
            rejectTimelineEdit(set, 'track-locked', 'Piste video verrouillee: suppression ignoree.');
            return;
        }
        pushHistory(state);
        set((s) => {
            const clips = s.clips.filter(c => c.id !== id);
            const transitions = { ...s.transitions };
            Object.keys(transitions).forEach(key => {
                const [fromId, toId] = key.split('->');
                if (!clips.find(c => c.id === fromId) || !clips.find(c => c.id === toId)) {
                    delete transitions[key];
                }
            });
            const transitionItems = removeTransitionItemsForMissingClips(s.transitionItems, clips);
            const totalDuration = computeTotalDuration(clips, transitions, transitionItems);
            return {
                clips,
                transitions,
                transitionItems,
                totalDuration,
                currentTime: clamp(s.currentTime, 0, totalDuration),
                selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
                selectedTransitionId: s.selectedTransitionId && transitionItems.some(item => item.id === s.selectedTransitionId) ? s.selectedTransitionId : null,
                timelineEditNotice: null,
            };
        });
    },

    reorderClips: (fromIndex, toIndex) => {
        const state = get();
        if (isTimelineTrackLocked(state.tracks, 'video-main')) {
            rejectTimelineEdit(set, 'track-locked', 'Piste video verrouillee: reorder ignore.');
            return;
        }
        pushHistory(state);
        set((s) => {
            const cutTransitions = s.clips.slice(0, -1).map((clip, index) => (
                getCutTransitionForPair(s.transitions, s.transitionItems, clip.id, s.clips[index + 1].id)
            ));
            const clips = [...s.clips];
            const [moved] = clips.splice(fromIndex, 1);
            clips.splice(toIndex, 0, moved);
            const transitions = {};
            const transitionItems = reassignCutTransitionSlots(s.transitionItems, cutTransitions, clips);
            const totalDuration = computeTotalDuration(clips, transitions, transitionItems);
            return {
                clips,
                transitions,
                transitionItems,
                selectedTransitionId: s.selectedTransitionId && transitionItems.some(item => item.id === s.selectedTransitionId) ? s.selectedTransitionId : null,
                totalDuration,
                currentTime: clamp(s.currentTime, 0, totalDuration),
                timelineEditNotice: null,
            };
        });
    },

    updateClip: (id, updates, options = {}) => {
        const state = get();
        if (isTimelineTrackLocked(state.tracks, getClipUpdateTrackId(updates))) {
            rejectTimelineEdit(set, 'track-locked', 'Piste verrouillee: edition clip ignoree.');
            return;
        }
        if (options.history) pushHistory(state);
        set((s) => {
        const clips = s.clips.map((clip) => {
            if (clip.id !== id) return clip;
            return { ...clip, ...normalizeClipUpdates(clip, updates) };
        });
        const totalDuration = computeTotalDuration(clips, s.transitions, s.transitionItems);
        return { clips, totalDuration, currentTime: clamp(s.currentTime, 0, totalDuration), timelineEditNotice: null };
        });
    },

    splitClip: (id, atTime) => {
        const state = get();
        if (isTimelineTrackLocked(state.tracks, 'video-main')) {
            rejectTimelineEdit(set, 'track-locked', 'Piste video verrouillee: split ignore.');
            return;
        }
        pushHistory(state);
        set((s) => {
            const idx = s.clips.findIndex(c => c.id === id);
            if (idx === -1) return s;
            const clip = s.clips[idx];
            if (atTime <= clip.trimStart || atTime >= clip.trimEnd) return s;

            const clipBId = uid();
            const clipA = { ...clip, trimEnd: atTime };
            const clipB = { ...clip, id: clipBId, name: clip.name + ' (2)', trimStart: atTime };

            const clips = [...s.clips];
            clips.splice(idx, 1, clipA, clipB);

            const transitions = { ...s.transitions };
            if (idx < s.clips.length - 1) {
                const nextClip = s.clips[idx + 1];
                const oldKey = `${id}->${nextClip.id}`;
                if (transitions[oldKey]) {
                    transitions[`${clipBId}->${nextClip.id}`] = transitions[oldKey];
                    delete transitions[oldKey];
                }
            }
            const transitionItems = s.transitionItems.map(item => {
                if ((item.params?.placement || 'free') !== 'cut') return item;
                if (item.fromItemId === id && s.clips[idx + 1]?.id === item.toItemId) {
                    return {
                        ...item,
                        id: item.id === `cut-${id}-${item.toItemId}` ? `cut-${clipBId}-${item.toItemId}` : item.id,
                        fromItemId: clipBId,
                        params: {
                            ...(item.params || {}),
                            legacyKey: `${clipBId}->${item.toItemId}`,
                            placement: 'cut',
                        },
                    };
                }
                return item;
            });

            const totalDuration = computeTotalDuration(clips, transitions, transitionItems);
            return {
                clips,
                transitions,
                transitionItems,
                totalDuration,
                currentTime: clamp(s.currentTime, 0, totalDuration),
                selectedClipId: clipBId,
                timelineEditNotice: null,
            };
        });
    },

    // === TRANSITIONS (between adjacent clips) ===
    transitions: {},
    transitionItems: [],
    selectedTransitionId: null,
    setSelectedTransitionId: (id) => set({ selectedTransitionId: id }),

    setTransition: (fromId, toId, transition) => {
        const state = get();
        if (isTimelineTrackLocked(state.tracks, getTrackForItemType('transition'))) {
            rejectTimelineEdit(set, 'track-locked', 'Piste transition verrouillee: changement ignore.');
            return;
        }
        pushHistory(state);
        set((s) => {
            const key = `${fromId}->${toId}`;
            const transitions = { ...s.transitions };
            delete transitions[key];
            const transitionItems = upsertCutTransitionItem(s.transitionItems, fromId, toId, transition);
            const totalDuration = computeTotalDuration(s.clips, transitions, transitionItems);
            return {
                transitions,
                transitionItems,
                totalDuration,
                currentTime: clamp(s.currentTime, 0, totalDuration),
                timelineEditNotice: null,
            };
        });
    },

    addTransitionItem: (transition) => {
        const state = get();
        const explicitTrackId = transition.trackId;
        const sequencePlacement = getSequencePlacement(transition);
        const trackId = explicitTrackId || (sequencePlacement ? SEQUENCE_TRACK_ID : resolveTimelineTrackForRange(state, 'transition', transition));
        const nextTracks = sequencePlacement
            ? state.tracks
            : ensureTimelineTrack(state.tracks, trackId ? makeTimelineTrackFromRole('transition', state.tracks, trackId) : null);
        if (isTimelineTrackLocked(nextTracks, trackId)) {
            rejectTimelineEdit(set, 'track-locked', 'Piste transition verrouillee: ajout ignore.');
            return;
        }
        const duration = Math.max(0.1, transition.duration || transition.defaultDuration || 0.5);
        const maxEnd = Math.max(0.1, state.totalDuration || 0.1);
        const startTime = resolveTransitionStartTime(transition, sequencePlacement, duration, maxEnd, state.currentTime);
        const id = transition.id || uid();
        const nextItem = {
            id,
            type: transition.type,
            start: startTime,
            trackId,
            fromItemId: transition.fromItemId || null,
            toItemId: transition.toItemId || null,
            params: {
                ...(transition.params || {}),
                ...(sequencePlacement ? { placement: sequencePlacement, sequenceSlot: sequencePlacement, singleton: true } : {}),
            },
            name: transition.name || transition.type || 'Transition',
            icon: transition.icon || '*',
            category: transition.category || 'basic',
            startTime,
            endTime: startTime + duration,
            duration,
        };
        const transitionItemsForValidation = sequencePlacement
            ? replaceSequenceTransitionItem(state.transitionItems, nextItem, sequencePlacement)
            : [...state.transitionItems, nextItem];
        if (hasDisallowedItemOverlap(nextTracks, transitionItemsForValidation, trackId)) {
            rejectTimelineEdit(set, 'track-overlap', 'Overlap interdit sur cette piste: transition ignoree.');
            return;
        }
        pushHistory(state);
        set((s) => ({
            tracks: nextTracks,
            transitionItems: transitionItemsForValidation,
            selectedTransitionId: id,
            totalDuration: computeStoreTotalDuration(s, transitionItemsForValidation),
            currentTime: clamp(s.currentTime, 0, computeStoreTotalDuration(s, transitionItemsForValidation)),
            timelineEditNotice: null,
        }));
    },

    updateTransitionItem: (id, updates, options = {}) => {
        const state = get();
        const target = state.transitionItems.find(item => item.id === id);
        if (!target) return;
        if (isTimelineTrackLocked(state.tracks, target.trackId || getTrackForItemType('transition'))) {
            rejectTimelineEdit(set, 'track-locked', 'Piste transition verrouillee: edition ignoree.');
            return;
        }
        const nextTransitionItems = state.transitionItems.map((item) => {
            if (item.id !== id) return item;
            const next = { ...item, ...updates };
            const sequencePlacement = getSequencePlacement(next);
            const previousDuration = Math.max(0.1, Number(item.duration ?? ((item.endTime ?? 0) - (item.startTime ?? item.start ?? 0))) || 0.1);
            const requestedDuration = Object.prototype.hasOwnProperty.call(updates, 'duration')
                ? Number(updates.duration)
                : Number(next.duration ?? ((next.endTime ?? 0) - (next.startTime ?? next.start ?? 0)));

            if (sequencePlacement) {
                const duration = Math.max(0.1, Number.isFinite(requestedDuration) ? requestedDuration : previousDuration);
                const startTime = sequencePlacement === 'intro' ? 0 : Math.max(0, (state.totalDuration || previousDuration) - previousDuration);
                return {
                    ...next,
                    start: startTime,
                    startTime,
                    endTime: startTime + duration,
                    duration,
                    trackId: SEQUENCE_TRACK_ID,
                    fromItemId: next.fromItemId || null,
                    toItemId: next.toItemId || null,
                    params: {
                        ...(next.params || {}),
                        placement: sequencePlacement,
                        sequenceSlot: sequencePlacement,
                        singleton: true,
                    },
                };
            }

            const maxEnd = Math.max(0.1, state.totalDuration || 0.1);
            const requestedStart = Object.prototype.hasOwnProperty.call(updates, 'start') || Object.prototype.hasOwnProperty.call(updates, 'startTime')
                ? (updates.start ?? updates.startTime)
                : (next.start ?? next.startTime);
            const startTime = clamp(requestedStart || 0, 0, Math.max(0, maxEnd - 0.1));
            let endTime = next.endTime;
            let duration = next.duration;

            if (Object.prototype.hasOwnProperty.call(updates, 'duration') && !Object.prototype.hasOwnProperty.call(updates, 'endTime')) {
                duration = Math.max(0.1, updates.duration || 0.1);
                endTime = startTime + duration;
            } else {
                endTime = Math.max(startTime + 0.1, endTime || startTime + (duration || 0.5));
                duration = Math.max(0.1, endTime - startTime);
            }

            endTime = Math.min(maxEnd, endTime);
            duration = Math.max(0.1, endTime - startTime);
            return {
                ...next,
                start: startTime,
                startTime,
                endTime,
                duration,
                trackId: next.trackId || getTrackForItemType('transition'),
                fromItemId: next.fromItemId || null,
                toItemId: next.toItemId || null,
                params: next.params || {},
            };
        });
        const shouldValidateOverlap = (target.params?.placement || 'free') !== 'cut';
        if (shouldValidateOverlap && hasDisallowedItemOverlap(state.tracks, nextTransitionItems, target.trackId || getTrackForItemType('transition'))) {
            rejectTimelineEdit(set, 'track-overlap', 'Overlap interdit sur cette piste: transition restauree.');
            return;
        }
        if (options.history) pushHistory(state);
        set((s) => {
            const totalDuration = computeStoreTotalDuration(s, nextTransitionItems);
            return {
                transitionItems: nextTransitionItems,
                totalDuration,
                currentTime: clamp(s.currentTime, 0, totalDuration),
                timelineEditNotice: null,
            };
        });
    },

    removeTransitionItem: (id) => {
        const state = get();
        const target = state.transitionItems.find(item => item.id === id);
        if (target && isTimelineTrackLocked(state.tracks, target.trackId || getTrackForItemType('transition'))) {
            rejectTimelineEdit(set, 'track-locked', 'Piste transition verrouillee: suppression ignoree.');
            return;
        }
        pushHistory(state);
        set((s) => {
            const sequencePlacement = getSequencePlacement(target);
            const linkedTextId = target.params?.linkedTextId || (sequencePlacement ? `sequence-${sequencePlacement}-text` : null);
            const transitionItems = s.transitionItems.filter(item => item.id !== id);
            const textOverlays = sequencePlacement
                ? s.textOverlays.filter(text => text.id !== linkedTextId && text.params?.sequenceSlot !== sequencePlacement)
                : s.textOverlays;
            const totalDuration = computeStoreTotalDuration(s, transitionItems);
            return {
                transitionItems,
                textOverlays,
                selectedTransitionId: s.selectedTransitionId === id ? null : s.selectedTransitionId,
                selectedTextId: sequencePlacement && !textOverlays.some(text => text.id === s.selectedTextId) ? null : s.selectedTextId,
                totalDuration,
                currentTime: clamp(s.currentTime, 0, totalDuration),
                timelineEditNotice: null,
            };
        });
    },

    removeTransition: (fromId, toId) => {
        const state = get();
        if (isTimelineTrackLocked(state.tracks, getTrackForItemType('transition'))) {
            rejectTimelineEdit(set, 'track-locked', 'Piste transition verrouillee: suppression ignoree.');
            return;
        }
        pushHistory(state);
        set((s) => {
            const key = `${fromId}->${toId}`;
            const transitions = { ...s.transitions };
            delete transitions[key];
            const transitionItems = removeCutTransitionItem(s.transitionItems, fromId, toId);
            const totalDuration = computeTotalDuration(s.clips, transitions, transitionItems);
            return {
                transitions,
                transitionItems,
                selectedTransitionId: s.selectedTransitionId && transitionItems.some(item => item.id === s.selectedTransitionId) ? s.selectedTransitionId : null,
                totalDuration,
                currentTime: clamp(s.currentTime, 0, totalDuration),
                timelineEditNotice: null,
            };
        });
    },

    // === AUDIO TRACKS ===
    audioTracks: [],
    selectedAudioTrackId: null,
    setSelectedAudioTrackId: (id) => set({ selectedAudioTrackId: id }),
    addAudioTrack: (track) => {
        const state = get();
        const explicitTrackId = track.trackId;
        const trackId = explicitTrackId || resolveTimelineTrackForRange(state, 'music', track);
        const nextTracks = ensureTimelineTrack(state.tracks, trackId ? makeTimelineTrackFromRole('music', state.tracks, trackId) : null);
        if (isTimelineTrackLocked(nextTracks, trackId)) {
            rejectTimelineEdit(set, 'track-locked', 'Piste audio verrouillee: ajout ignore.');
            return;
        }
        const id = track.id || uid();
        const nextTrack = normalizeAudioTrack(track, {
            id,
            trackId,
            totalDuration: state.totalDuration,
        });
        const nextAudioTracks = [...state.audioTracks, nextTrack];
        if (hasDisallowedItemOverlap(nextTracks, nextAudioTracks, trackId)) {
            rejectTimelineEdit(set, 'track-overlap', 'Overlap interdit sur cette piste: audio ignore.');
            return;
        }
        pushHistory(state);
        set(() => ({
            tracks: nextTracks,
            audioTracks: nextAudioTracks,
            selectedAudioTrackId: id,
            timelineEditNotice: null,
        }));
    },
    removeAudioTrack: (id) => {
        const state = get();
        const target = state.audioTracks.find(track => track.id === id);
        if (target && isTimelineTrackLocked(state.tracks, target.trackId || getTrackForItemType('audio'))) {
            rejectTimelineEdit(set, 'track-locked', 'Piste audio verrouillee: suppression ignoree.');
            return;
        }
        pushHistory(state);
        set((s) => ({
            audioTracks: s.audioTracks.filter(t => t.id !== id),
            selectedAudioTrackId: s.selectedAudioTrackId === id ? null : s.selectedAudioTrackId,
            timelineEditNotice: null,
        }));
    },
    updateAudioTrack: (id, updates, options = {}) => {
        const state = get();
        const target = state.audioTracks.find(track => track.id === id);
        if (target && isTimelineTrackLocked(state.tracks, target.trackId || getTrackForItemType('audio'))) {
            rejectTimelineEdit(set, 'track-locked', 'Piste audio verrouillee: edition ignoree.');
            return;
        }
        const nextAudioTracks = state.audioTracks.map((track) => {
            if (track.id !== id) return track;
            return normalizeAudioTrack({ ...track, ...updates }, {
                id: track.id,
                trackId: updates.trackId || track.trackId || getTrackForItemType('audio'),
                totalDuration: state.totalDuration,
            });
        });
        const nextTrackId = updates.trackId || target?.trackId || getTrackForItemType('audio');
        if (hasDisallowedItemOverlap(state.tracks, nextAudioTracks, nextTrackId)) {
            rejectTimelineEdit(set, 'track-overlap', 'Overlap interdit sur cette piste: audio restaure.');
            return;
        }
        if (options.history) pushHistory(state);
        set({ audioTracks: nextAudioTracks, timelineEditNotice: null });
    },

    // === TEXT OVERLAYS ===
    textOverlays: [],
    selectedTextId: null,
    setSelectedTextId: (id) => set({ selectedTextId: id }),

    addTextOverlay: (text) => {
        const state = get();
        const targetTrack = resolveTextTrackForOverlay(state, text);
        const trackId = targetTrack.id;
        const nextTracks = ensureTimelineTrack(state.tracks, targetTrack);
        if (isTimelineTrackLocked(nextTracks, trackId)) {
            rejectTimelineEdit(set, 'track-locked', 'Piste texte verrouillee: ajout ignore.');
            return;
        }
        const id = text.id || uid();
        const nextText = normalizeTextOverlay(text, {
            id,
            trackId,
            totalDuration: state.totalDuration,
        });
        const nextTextOverlays = [...state.textOverlays, nextText];
        if (hasDisallowedItemOverlap(nextTracks, nextTextOverlays, trackId)) {
            rejectTimelineEdit(set, 'track-overlap', 'Overlap interdit sur cette piste: texte ignore.');
            return;
        }
        pushHistory(state);
        set(() => ({
            tracks: nextTracks,
            textOverlays: nextTextOverlays,
            selectedTextId: id,
            timelineEditNotice: null,
        }));
    },
    removeTextOverlay: (id) => {
        const state = get();
        const target = state.textOverlays.find(text => text.id === id);
        if (target && isTimelineTrackLocked(state.tracks, target.trackId || getTrackForItemType('text'))) {
            rejectTimelineEdit(set, 'track-locked', 'Piste texte verrouillee: suppression ignoree.');
            return;
        }
        pushHistory(state);
        set((s) => ({
            textOverlays: s.textOverlays.filter(t => t.id !== id),
            selectedTextId: s.selectedTextId === id ? null : s.selectedTextId,
            timelineEditNotice: null,
        }));
    },
    updateTextOverlay: (id, updates, options = {}) => {
        const state = get();
        const target = state.textOverlays.find(text => text.id === id);
        if (target && isTimelineTrackLocked(state.tracks, target.trackId || getTrackForItemType('text'))) {
            rejectTimelineEdit(set, 'track-locked', 'Piste texte verrouillee: edition ignoree.');
            return;
        }
        const nextTextOverlays = state.textOverlays.map((text) => {
            if (text.id !== id) return text;
            return normalizeTextOverlay({ ...text, ...updates }, {
                id: text.id,
                trackId: updates.trackId || text.trackId || getTrackForItemType('text'),
                totalDuration: state.totalDuration,
            });
        });
        const nextTrackId = updates.trackId || target?.trackId || getTrackForItemType('text');
        if (hasDisallowedItemOverlap(state.tracks, nextTextOverlays, nextTrackId)) {
            rejectTimelineEdit(set, 'track-overlap', 'Overlap interdit sur cette piste: texte restaure.');
            return;
        }
        if (options.history) pushHistory(state);
        set({ textOverlays: nextTextOverlays, timelineEditNotice: null });
    },

    // === PLAYBACK ===
    isPlaying: false,
    currentTime: 0,
    totalDuration: 0,
    playbackSpeed: 1,

    setIsPlaying: (v) => set({ isPlaying: v }),
    setCurrentTime: (t) => set((s) => ({ currentTime: clamp(t, 0, s.totalDuration || 0) })),
    setPlaybackSpeed: (s) => set({ playbackSpeed: s }),

    play: () => set({ isPlaying: true }),
    pause: () => set({ isPlaying: false }),
    togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
    seekTo: (time) => set((s) => ({ currentTime: clamp(time, 0, s.totalDuration || 0) })),

    // === TIMELINE ===
    zoom: 1,
    scrollX: 0,
    setZoom: (z) => set({ zoom: Math.max(0.03, Math.min(10, z)) }),
    setScrollX: (x) => set({ scrollX: x }),

    // === EXPORT ===
    previewCanvas: null,
    setPreviewCanvas: (canvas) => set({ previewCanvas: canvas }),
    previewEngine: null,
    setPreviewEngine: (engine) => set({ previewEngine: engine }),
    sequencePreset: 'youtube',
    setSequencePreset: (p) => set({ sequencePreset: p, exportPreset: p }),
    exportFormat: 'mp4',
    exportPreset: 'youtube',
    exportFrameRate: 'auto',
    exportProgress: 0,
    isExporting: false,
    setExportFormat: (f) => set({ exportFormat: f }),
    setExportPreset: (p) => set({ exportPreset: p, sequencePreset: p }),
    setExportFrameRate: (fps) => set({ exportFrameRate: fps }),
    setExportProgress: (p) => set({ exportProgress: p }),
    setIsExporting: (v) => set({ isExporting: v }),

    // === ACTIVE PANEL ===
    activePanel: null,
    setActivePanel: (p) => set((s) => ({ activePanel: s.activePanel === p ? null : p })),

    // === UNDO / REDO ===
    _history: [],
    _future: [],
    _historyIndex: -1,
    _maxHistory: 50,
    _historyTransaction: null,

    undo: () => {
        const s = get();
        if (s._history.length === 0) return;
        const snapshot = s._history[s._history.length - 1];
        const history = s._history.slice(0, -1);
        const future = [createSnapshot(s), ...s._future].slice(0, s._maxHistory);
        set({
            ...snapshot,
            _history: history,
            _future: future,
            _historyIndex: history.length - 1,
            _historyTransaction: null,
            totalDuration: computeTotalDuration(snapshot.clips, snapshot.transitions, snapshot.transitionItems),
        });
    },

    redo: () => {
        const s = get();
        if (s._future.length === 0) return;
        const snapshot = s._future[0];
        if (!snapshot) return;
        const history = [...s._history, createSnapshot(s)].slice(-s._maxHistory);
        set({
            ...snapshot,
            _history: history,
            _future: s._future.slice(1),
            _historyIndex: history.length - 1,
            _historyTransaction: null,
            totalDuration: computeTotalDuration(snapshot.clips, snapshot.transitions, snapshot.transitionItems),
        });
    },

    canUndo: () => get()._history.length > 0,
    canRedo: () => get()._future.length > 0,
}));

function pushHistory(state, options = {}) {
    if (state._historyTransaction && !options.force) return;
    const history = [...state._history, createSnapshot(state)].slice(-state._maxHistory);
    useVideoStore.setState({
        _history: history,
        _historyIndex: history.length - 1,
        _future: [],
    });
}

function rejectTimelineEdit(set, code, message) {
    set({
        timelineEditNotice: {
            id: `${code}-${Date.now()}`,
            level: 'warning',
            code,
            message,
        },
    });
}

function createSnapshot(state) {
    const snapshot = {};
    SNAPSHOT_KEYS.forEach(key => { snapshot[key] = state[key]; });
    return snapshot;
}

function isSnapshotUnchanged(state, snapshot) {
    if (!snapshot) return false;
    return SNAPSHOT_KEYS.every(key => state[key] === snapshot[key]);
}

function normalizeTimelineItemUpdates(item, updates = {}, totalDuration = 0) {
    const currentStart = Number.isFinite(Number(item.start)) ? Number(item.start) : 0;
    const currentDuration = Number.isFinite(Number(item.duration)) ? Math.max(0.1, Number(item.duration)) : 0.1;
    const maxEnd = Math.max(0.1, totalDuration || currentStart + currentDuration);
    const requestedStart = Object.prototype.hasOwnProperty.call(updates, 'start') || Object.prototype.hasOwnProperty.call(updates, 'startTime')
        ? (updates.start ?? updates.startTime)
        : currentStart;
    let startTime = clamp(Number(requestedStart) || 0, 0, Math.max(0, maxEnd - 0.1));
    let duration = currentDuration;

    if (Object.prototype.hasOwnProperty.call(updates, 'duration')) {
        duration = Math.max(0.1, Number(updates.duration) || 0.1);
    } else if (Object.prototype.hasOwnProperty.call(updates, 'endTime')) {
        duration = Math.max(0.1, (Number(updates.endTime) || startTime + currentDuration) - startTime);
    }

    let endTime = Object.prototype.hasOwnProperty.call(updates, 'endTime')
        ? Number(updates.endTime)
        : startTime + duration;
    if (!Number.isFinite(endTime)) endTime = startTime + duration;
    endTime = clamp(endTime, startTime + 0.1, maxEnd);
    duration = Math.max(0.1, endTime - startTime);
    startTime = Math.max(0, Math.min(startTime, Math.max(0, maxEnd - duration)));

    return {
        start: startTime,
        startTime,
        endTime,
        duration,
    };
}

function pickClipTimelineUpdates(updates = {}) {
    const allowedKeys = ['duration', 'trimStart', 'trimEnd', 'speed', 'volume', 'filters', 'motion', 'trackId'];
    return Object.fromEntries(
        allowedKeys
            .filter(key => Object.prototype.hasOwnProperty.call(updates, key))
            .map(key => [key, updates[key]])
    );
}

function normalizeClipUpdates(clip = {}, updates = {}) {
    const next = { ...updates };
    const currentDuration = normalizeClipDuration(clip.duration, normalizeClipDuration(clip.trimEnd, 0)) || 0;
    const requestedDuration = Object.prototype.hasOwnProperty.call(updates, 'duration')
        ? normalizeClipDuration(updates.duration)
        : currentDuration;
    const duration = requestedDuration || currentDuration;

    if (Object.prototype.hasOwnProperty.call(updates, 'duration')) {
        next.duration = isImageMedia(clip) ? normalizeImageDuration(duration) : duration;
        if (isImageMedia(clip) && !Object.prototype.hasOwnProperty.call(updates, 'trimEnd')) {
            next.trimEnd = next.duration;
        }
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'originalDuration')) {
        next.originalDuration = normalizeClipDuration(updates.originalDuration, clip.originalDuration || duration);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'trimStart')) {
        next.trimStart = clamp(Number.isFinite(Number(updates.trimStart)) ? Number(updates.trimStart) : 0, 0, duration);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'trimEnd')) {
        const trimStart = Number(next.trimStart ?? clip.trimStart ?? 0);
        const safeTrimEnd = Number.isFinite(Number(updates.trimEnd)) ? Number(updates.trimEnd) : duration;
        next.trimEnd = clamp(safeTrimEnd, Math.min(duration, trimStart), duration);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'speed')) {
        const speed = Number(updates.speed);
        next.speed = Number.isFinite(speed) && speed > 0 ? clamp(speed, 0.1, 16) : 1;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'volume')) {
        next.volume = clampVolumePercent(updates.volume);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'motion')) {
        next.motion = isImageMedia(clip) ? normalizeImageMotion(updates.motion) : null;
    }
    return next;
}

function normalizeAudioTrack(track = {}, { id = track.id || uid(), trackId = track.trackId || getTrackForItemType('audio'), totalDuration = 0 } = {}) {
    const maxEnd = Math.max(0.1, totalDuration || track.endTime || track.duration || 10);
    const requestedStart = Number(track.startTime ?? track.start ?? 0);
    const startTime = clamp(Number.isFinite(requestedStart) ? requestedStart : 0, 0, Math.max(0, maxEnd - 0.1));
    const requestedEnd = Number(track.endTime ?? (startTime + Number(track.duration ?? 10)));
    const endTime = Math.min(maxEnd, Math.max(startTime + 0.1, Number.isFinite(requestedEnd) ? requestedEnd : startTime + 0.1));
    const duration = Math.max(0.1, endTime - startTime);

    return {
        id,
        name: track.name || 'Audio',
        url: track.url,
        file: track.file || null,
        volume: clampVolumePercent(track.volume ?? 100),
        trimStart: Math.max(0, Number(track.trimStart) || 0),
        fadeIn: Math.max(0, Number(track.fadeIn) || 0),
        fadeOut: Math.max(0, Number(track.fadeOut) || 0),
        trackId,
        ...track,
        id,
        trackId,
        startTime,
        endTime,
        duration,
        volume: clampVolumePercent(track.volume ?? 100),
    };
}

function normalizeTextOverlay(text = {}, { id = text.id || uid(), trackId = text.trackId || getTrackForItemType('text'), totalDuration = 0 } = {}) {
    const maxEnd = Math.max(0.1, totalDuration || text.endTime || 3);
    const requestedStart = Number(text.startTime ?? text.start ?? 0);
    const startTime = clamp(Number.isFinite(requestedStart) ? requestedStart : 0, 0, Math.max(0, maxEnd - 0.1));
    const requestedEnd = Number(text.endTime ?? (startTime + Number(text.duration ?? 3)));
    const endTime = Math.min(maxEnd, Math.max(startTime + 0.1, Number.isFinite(requestedEnd) ? requestedEnd : startTime + 0.1));

    return {
        id,
        content: text.content || 'Your Text',
        trackId,
        startTime,
        endTime,
        x: 0.5,
        y: 0.5,
        font: 'Inter',
        fontSize: 48,
        color: '#ffffff',
        bold: true,
        italic: false,
        // Lisibilite sur image claire: bloc de fond ou contour, rendus a
        // l'identique dans l'apercu et par FFmpeg a l'export.
        boxStyle: 'none',
        boxColor: '#000000',
        animation: 'fade',
        animationOut: 'fade',
        ...text,
        id,
        trackId,
        startTime,
        endTime,
    };
}

function resolveTextTrackForOverlay(state = {}, text = {}) {
    const tracks = Array.isArray(state.tracks) && state.tracks.length ? state.tracks : getDefaultTracks();
    const textTracks = getSortedTextTracks(tracks);
    const requestedTrackId = text.trackId;
    if (requestedTrackId) {
        return tracks.find(track => track.id === requestedTrackId) || makeTextTrack(textTracks.length + 1, requestedTrackId);
    }

    const { startTime, endTime } = getTextOverlayRange(text, state.totalDuration);
    const reusableTrack = textTracks
        .filter(track => !isTimelineTrackLocked(tracks, track.id))
        .find(track => !hasRangeOverlap(
            (state.textOverlays || []).filter(overlay => (overlay.trackId || getTrackForItemType('text')) === track.id),
            startTime,
            endTime
        ));

    return reusableTrack || makeNextTextTrack(textTracks);
}

function ensureTimelineTrack(tracks = [], track = {}) {
    if (!track?.id || tracks.some(existing => existing.id === track.id)) return tracks;
    return [...tracks, track];
}

const DEFAULT_TRACK_IDS = new Set(getDefaultTracks().map(track => track.id));
const TIMELINE_TRACK_SPECS = {
    transition: { type: 'transition', laneRole: 'transition', idPrefix: 'transition', baseName: 'Transitions', order: 20, allowOverlap: false },
    effect: { type: 'effect', laneRole: 'effect', idPrefix: 'effect', baseName: 'Effets', order: 30, allowOverlap: true },
    text: { type: 'text', laneRole: 'text', idPrefix: 'text', baseName: 'Texte', order: 40, allowOverlap: false },
    music: { type: 'audio', laneRole: 'music', idPrefix: 'music', baseName: 'Musique', order: 60, allowOverlap: false },
};

function normalizeTrackRole(role = 'text') {
    if (role === 'transitions') return 'transition';
    if (role === 'effects') return 'effect';
    if (role === 'audio') return 'music';
    return TIMELINE_TRACK_SPECS[role] ? role : null;
}

function isDefaultTimelineTrack(id = '') {
    return DEFAULT_TRACK_IDS.has(id);
}

function getTracksByRole(tracks = [], role = 'text') {
    const normalizedRole = normalizeTrackRole(role);
    return tracks
        .filter(track => normalizeTrackRole(getTimelineTrackRole(track)) === normalizedRole)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function makeNextTimelineTrack(tracks = [], role = 'text') {
    const normalizedRole = normalizeTrackRole(role);
    if (!normalizedRole) return null;
    const roleTracks = getTracksByRole(tracks, normalizedRole);
    const usedIds = new Set(tracks.map(track => track.id));
    const spec = TIMELINE_TRACK_SPECS[normalizedRole];
    let index = Math.max(2, roleTracks.length + 1);
    while (usedIds.has(`${spec.idPrefix}-${index}`)) index += 1;
    return makeTimelineTrack(normalizedRole, index, `${spec.idPrefix}-${index}`);
}

function makeTimelineTrackFromRole(role = 'text', tracks = [], id = '') {
    const existing = tracks.find(track => track.id === id);
    if (existing) return existing;
    const normalizedRole = normalizeTrackRole(role);
    const roleTracks = getTracksByRole(tracks, normalizedRole);
    const spec = TIMELINE_TRACK_SPECS[normalizedRole];
    if (!spec) return null;
    const explicitIndex = Number(String(id).match(/-(\d+)$/)?.[1]);
    const index = Number.isFinite(explicitIndex) && explicitIndex > 0
        ? explicitIndex
        : Math.max(2, roleTracks.length + 1);
    return makeTimelineTrack(normalizedRole, index, id || `${spec.idPrefix}-${index}`);
}

function makeTimelineTrack(role = 'text', index = 1, id = '') {
    const spec = TIMELINE_TRACK_SPECS[role];
    if (!spec) return null;
    const normalizedIndex = Math.max(1, Number(index) || 1);
    return {
        id: id || (normalizedIndex === 1 ? `${spec.idPrefix}-main` : `${spec.idPrefix}-${normalizedIndex}`),
        type: spec.type,
        laneRole: spec.laneRole,
        name: normalizedIndex === 1 ? spec.baseName : `${spec.baseName} ${normalizedIndex}`,
        locked: false,
        muted: false,
        visible: true,
        allowOverlap: spec.allowOverlap,
        order: spec.order + (normalizedIndex - 1) * 0.1,
    };
}

function resolveTimelineTrackForRange(state = {}, role = 'text', item = {}) {
    const normalizedRole = normalizeTrackRole(role);
    const tracks = Array.isArray(state.tracks) && state.tracks.length ? state.tracks : getDefaultTracks();
    const roleTracks = getTracksByRole(tracks, normalizedRole);
    const { startTime, endTime } = getTimelineItemRange(item, state.totalDuration);
    const items = getTimelineItemsForRole(state, normalizedRole);
    const reusableTrack = roleTracks
        .filter(track => !isTimelineTrackLocked(tracks, track.id))
        .find(track => doesTrackAllowOverlap(tracks, track.id) || !hasRangeOverlap(
            items.filter(existing => (existing.trackId || getDefaultTrackIdForRole(normalizedRole)) === track.id),
            startTime,
            endTime
        ));

    return (reusableTrack || makeNextTimelineTrack(tracks, normalizedRole))?.id || null;
}

function getDefaultTrackIdForRole(role = 'text') {
    if (role === 'transition') return 'transition-main';
    if (role === 'effect') return 'effect-main';
    if (role === 'music') return 'music-main';
    if (role === 'text') return 'text-main';
    return getTrackForItemType(role);
}

function getTimelineItemsForRole(state = {}, role = 'text') {
    if (role === 'transition') return state.transitionItems || [];
    if (role === 'music') return state.audioTracks || [];
    if (role === 'text') return state.textOverlays || [];
    return [];
}

function getTimelineItemRange(item = {}, totalDuration = 0) {
    const maxEnd = Math.max(0.1, totalDuration || item.endTime || item.duration || 3);
    const requestedStart = Number(item.startTime ?? item.start ?? 0);
    const startTime = clamp(Number.isFinite(requestedStart) ? requestedStart : 0, 0, Math.max(0, maxEnd - 0.1));
    const requestedEnd = Number(item.endTime ?? (startTime + Number(item.duration ?? item.defaultDuration ?? 3)));
    const endTime = Math.min(maxEnd, Math.max(startTime + 0.1, Number.isFinite(requestedEnd) ? requestedEnd : startTime + 0.1));
    return { startTime, endTime };
}

function getSortedTextTracks(tracks = []) {
    const textTracks = getTracksByRole(tracks, 'text');
    if (textTracks.length) {
        return textTracks.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    }
    return getDefaultTracks().filter(track => track.type === 'text');
}

function makeNextTextTrack(textTracks = []) {
    return makeNextTimelineTrack(textTracks, 'text');
}

function makeTextTrack(index = 1, id = '') {
    return makeTimelineTrack('text', index, id);
}

function getTextOverlayRange(text = {}, totalDuration = 0) {
    const maxEnd = Math.max(0.1, totalDuration || text.endTime || 3);
    const requestedStart = Number(text.startTime ?? text.start ?? 0);
    const startTime = clamp(Number.isFinite(requestedStart) ? requestedStart : 0, 0, Math.max(0, maxEnd - 0.1));
    const requestedEnd = Number(text.endTime ?? (startTime + Number(text.duration ?? 3)));
    const endTime = Math.min(maxEnd, Math.max(startTime + 0.1, Number.isFinite(requestedEnd) ? requestedEnd : startTime + 0.1));
    return { startTime, endTime };
}

function hasRangeOverlap(items = [], startTime = 0, endTime = 0) {
    return items.some((item) => {
        const start = Number(item.startTime ?? item.start ?? 0);
        const end = Number(item.endTime ?? (start + Number(item.duration ?? 0)));
        return start < endTime - 0.001 && end > startTime + 0.001;
    });
}

function hasDisallowedItemOverlap(tracks = [], items = [], trackId = '') {
    if (!trackId || doesTrackAllowOverlap(tracks, trackId)) return false;
    return Boolean(findTimelineItemOverlap(
        items
            .filter(item => !getSequencePlacement(item))
            .filter(item => (item.trackId || '') === trackId),
        { tolerance: 0.001 }
    ));
}

function getClipUpdateTrackId(updates = {}) {
    const keys = Object.keys(updates || {});
    if (keys.length > 0 && keys.every(key => key === 'filters')) return 'effect-main';
    return 'video-main';
}

function makeCutTransitionItem(fromId, toId, transition = {}, { preserveId = true } = {}) {
    const id = preserveId && transition.id ? transition.id : `cut-${fromId}-${toId}`;
    const duration = Math.max(0.1, Number(transition.duration ?? transition.defaultDuration ?? 0.5) || 0.5);
    return {
        id,
        type: transition.type || 'crossfade',
        start: 0,
        startTime: 0,
        endTime: duration,
        duration,
        trackId: transition.trackId || getTrackForItemType('transition'),
        fromItemId: fromId,
        toItemId: toId,
        params: {
            ...(transition.params || {}),
            legacyKey: `${fromId}->${toId}`,
            placement: 'cut',
        },
        name: transition.name || transition.type || 'Transition',
        icon: transition.icon || '*',
        category: transition.category || 'basic',
    };
}

function upsertCutTransitionItem(items = [], fromId, toId, transition = {}) {
    const nextItem = makeCutTransitionItem(fromId, toId, transition);
    const replaced = items.map(item => isCutTransitionForPair(item, fromId, toId) ? { ...item, ...nextItem } : item);
    return replaced.some(item => isCutTransitionForPair(item, fromId, toId))
        ? replaced
        : [...items, nextItem];
}

function reassignCutTransitionSlots(items = [], cutTransitions = [], clips = []) {
    const freeItems = items.filter(item => (item.params?.placement || 'free') !== 'cut');
    const reassignedCuts = cutTransitions
        .map((transition, index) => {
            if (!transition || !clips[index + 1]) return null;
            return makeCutTransitionItem(clips[index].id, clips[index + 1].id, transition, { preserveId: false });
        })
        .filter(Boolean);
    return [...freeItems, ...reassignedCuts];
}

function removeCutTransitionItem(items = [], fromId, toId) {
    return items.filter(item => !isCutTransitionForPair(item, fromId, toId));
}

function removeTransitionItemsForMissingClips(items = [], clips = []) {
    const clipIds = new Set(clips.map(clip => clip.id).filter(Boolean));
    return items.filter(item => {
        if ((item.params?.placement || 'free') !== 'cut') return true;
        return clipIds.has(item.fromItemId) && clipIds.has(item.toItemId);
    });
}

function isCutTransitionForPair(item = {}, fromId, toId) {
    return (item.params?.placement || 'free') === 'cut'
        && item.fromItemId === fromId
        && item.toItemId === toId;
}

function getCutTransitionForPair(transitions = {}, transitionItems = [], fromId, toId) {
    return transitionItems.find(item => isCutTransitionForPair(item, fromId, toId))
        || transitions[`${fromId}->${toId}`]
        || null;
}

function getClipPlaybackDuration(clip = {}) {
    const sourceDuration = normalizeClipDuration(clip.duration, normalizeClipDuration(clip.trimEnd, 0)) || 0;
    const trimStart = clamp(Number.isFinite(Number(clip.trimStart)) ? Number(clip.trimStart) : 0, 0, sourceDuration);
    const trimEnd = clamp(Number.isFinite(Number(clip.trimEnd)) ? Number(clip.trimEnd) : sourceDuration, trimStart, sourceDuration);
    const rawSpeed = Number(clip.speed);
    const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : 1;
    return Math.min(MAX_CLIP_DURATION_SECONDS, Math.max(0, (trimEnd - trimStart) / speed));
}

function getCutTransitionConfiguredDuration(transition = null) {
    if (!transition) return 0;
    return Math.max(0.1, Number(transition.duration ?? transition.defaultDuration ?? 0.5) || 0.5);
}

function resolveCutTransitionOverlap(transition = null, currentDuration = 0, nextDuration = currentDuration) {
    if (!transition) return 0;
    const configuredDuration = getCutTransitionConfiguredDuration(transition);
    const availableDuration = Math.max(0, Math.min(Number(currentDuration) || 0, Number(nextDuration) || 0));
    return Math.min(configuredDuration, availableDuration);
}

function computeTotalDuration(clips, transitions = {}, transitionItems = []) {
    if (clips.length === 0) return 0;
    let total = getIntroOffset(transitionItems);
    clips.forEach((clip, i) => {
        const clipDur = getClipPlaybackDuration(clip);
        total += clipDur;
        if (i < clips.length - 1) {
            const tr = getCutTransitionForPair(transitions, transitionItems, clip.id, clips[i + 1].id);
            total -= resolveCutTransitionOverlap(tr, clipDur, getClipPlaybackDuration(clips[i + 1]));
        }
    });
    const outroDuration = transitionItems
        .filter(item => getSequencePlacement(item) === 'outro')
        .reduce((maxDuration, item) => Math.max(maxDuration, Number(item.duration) || 0), 0);
    total += outroDuration;
    return Number.isFinite(total) ? Math.min(MAX_CLIP_DURATION_SECONDS, Math.max(0, total)) : 0;
}

function computeStoreTotalDuration(state = {}, transitionItems = state.transitionItems || []) {
    return state.clips?.length
        ? computeTotalDuration(state.clips, state.transitions, transitionItems)
        : Math.max(0, normalizeClipDuration(state.totalDuration, 0));
}

function resolveTransitionStartTime(transition = {}, sequencePlacement = null, duration = 0.5, maxEnd = 0.1, currentTime = 0) {
    if (sequencePlacement === 'intro') return 0;
    if (sequencePlacement === 'outro') return Math.max(0, maxEnd - duration);
    return clamp(transition.startTime ?? currentTime ?? 0, 0, Math.max(0, maxEnd - duration));
}

function replaceSequenceTransitionItem(items = [], nextItem = {}, sequencePlacement = '') {
    return [
        ...items.filter(item => getSequencePlacement(item) !== sequencePlacement),
        nextItem,
    ];
}

export default useVideoStore;
