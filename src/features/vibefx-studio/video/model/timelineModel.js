const DEFAULT_TRACKS = [
    { id: 'sequence-main', type: 'transition', laneRole: 'sequence', name: 'Volets', locked: false, muted: false, visible: true, allowOverlap: true, order: 5 },
    { id: 'video-main', type: 'video', laneRole: 'video', name: 'Video', locked: false, muted: false, visible: true, allowOverlap: false, order: 10 },
    { id: 'transition-main', type: 'transition', laneRole: 'transition', name: 'Transitions', locked: false, muted: false, visible: true, allowOverlap: false, order: 20 },
    { id: 'effect-main', type: 'effect', laneRole: 'effect', name: 'Effets', locked: false, muted: false, visible: true, allowOverlap: true, order: 30 },
    { id: 'text-main', type: 'text', laneRole: 'text', name: 'Texte', locked: false, muted: false, visible: true, allowOverlap: false, order: 40 },
    { id: 'audio-main', type: 'audio', laneRole: 'clip-audio', name: 'Audio clips', locked: false, muted: false, visible: true, allowOverlap: true, order: 50 },
    { id: 'music-main', type: 'audio', laneRole: 'music', name: 'Musique', locked: false, muted: false, visible: true, allowOverlap: false, order: 60 },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const DEFAULT_FILTERS = {
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
};
export const DEFAULT_SNAP_THRESHOLD_SECONDS = 0.08;
export const MAX_TIMELINE_DURATION_SECONDS = 6 * 60 * 60;
export const MAX_SNAP_GRID_POINTS = 3600;

export function normalizeTimelineDuration(value, fallback = 0) {
    const duration = finiteNumber(value, fallback);
    if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, finiteNumber(fallback, 0));
    return Math.min(duration, MAX_TIMELINE_DURATION_SECONDS);
}

export function clampVolumePercent(volume = 100) {
    return clamp(finiteNumber(volume, 100), 0, 100);
}

export function getSequencePlacement(item = {}) {
    const placement = item?.params?.placement;
    if (placement === 'intro' || placement === 'outro') return placement;
    const category = item?.category || item?.params?.sequenceSlot;
    if (category === 'intro' || String(item?.type || '').startsWith('intro-')) return 'intro';
    if (category === 'outro' || String(item?.type || '').startsWith('outro-')) return 'outro';
    return null;
}

export function isSequenceTransition(item = {}) {
    return Boolean(getSequencePlacement(item));
}

export function getIntroOffset(transitionItems = []) {
    const intro = transitionItems.find(item => getSequencePlacement(item) === 'intro');
    if (!intro) return 0;
    return Math.max(0, finiteNumber(intro.duration ?? ((intro.endTime ?? 0) - (intro.startTime ?? intro.start ?? 0)), 0));
}

export function getDefaultTracks() {
    return DEFAULT_TRACKS.map(track => ({ ...track }));
}

export function getTrackById(tracks = [], id) {
    return tracks.find(track => track.id === id) || DEFAULT_TRACKS.find(track => track.id === id) || null;
}

export function isTrackVisible(tracks = [], id) {
    return getTrackById(tracks, id)?.visible !== false;
}

export function isTrackMuted(tracks = [], id) {
    return getTrackById(tracks, id)?.muted === true;
}

export function isTrackLocked(tracks = [], id) {
    return getTrackById(tracks, id)?.locked === true;
}

export function doesTrackAllowOverlap(tracks = [], id) {
    return getTrackById(tracks, id)?.allowOverlap === true;
}

export function getTrackForItemType(type) {
    if (type === 'transition') return 'transition-main';
    if (type === 'text') return 'text-main';
    if (type === 'audio') return 'music-main';
    if (type === 'effect') return 'effect-main';
    return 'video-main';
}

export function getTimelineTrackRole(track = {}) {
    if (track.laneRole) return track.laneRole;
    if (track.id === 'audio-main') return 'clip-audio';
    if (track.id === 'music-main') return 'music';
    if (track.type === 'transition') return 'transition';
    if (track.type === 'effect') return 'effect';
    if (track.type === 'text') return 'text';
    if (track.type === 'video') return 'video';
    return 'unknown';
}

function normalizeClipFilters(filters = {}) {
    return {
        ...DEFAULT_FILTERS,
        ...(filters || {}),
    };
}

function hasActiveClipFilters(filters = {}) {
    const normalized = normalizeClipFilters(filters);
    return Object.entries(DEFAULT_FILTERS).some(([key, defaultValue]) => finiteNumber(normalized[key], defaultValue) !== defaultValue);
}

function getClipPlaybackDuration(clip = {}) {
    const speed = Math.max(0.01, finiteNumber(clip.speed, 1) || 1);
    const sourceDuration = normalizeTimelineDuration(clip.duration, finiteNumber(clip.trimEnd, 0));
    const trimStart = clamp(finiteNumber(clip.trimStart, 0), 0, sourceDuration);
    const trimEnd = clamp(finiteNumber(clip.trimEnd, sourceDuration), trimStart, sourceDuration);
    return normalizeTimelineDuration((trimEnd - trimStart) / speed, 0);
}

function getCutTransitionConfiguredDuration(transition = null) {
    if (!transition) return 0;
    return Math.max(0.1, finiteNumber(transition.duration, 0.5));
}

function resolveCutTransitionOverlap(transition = null, currentDuration = 0, nextDuration = currentDuration) {
    if (!transition) return 0;
    const configuredDuration = getCutTransitionConfiguredDuration(transition);
    const availableDuration = Math.max(0, Math.min(
        finiteNumber(currentDuration, 0),
        finiteNumber(nextDuration, currentDuration)
    ));
    return Math.min(configuredDuration, availableDuration);
}

export function normalizeTransitionItem(item = {}, totalDuration = 0) {
    const start = finiteNumber(item.start ?? item.startTime, 0);
    const rawDuration = finiteNumber(item.duration ?? ((item.endTime ?? 0) - start), 0.5);
    const duration = clamp(rawDuration, 0.1, Math.max(0.1, totalDuration || rawDuration || 0.1));
    const maxStart = Math.max(0, (totalDuration || start + duration) - duration);
    const normalizedStart = clamp(start, 0, maxStart);

    return {
        id: item.id,
        type: item.type || 'fade',
        start: normalizedStart,
        duration,
        fromItemId: item.fromItemId || null,
        toItemId: item.toItemId || null,
        trackId: item.trackId || getTrackForItemType('transition'),
        params: item.params || {},
        name: item.name || item.type || 'Transition',
        icon: item.icon || '*',
        category: item.category || 'basic',
        source: item,
    };
}

export function normalizeTransitionItems(transitionItems = [], totalDuration = 0) {
    return transitionItems
        .filter(item => item?.id && item?.type)
        .map(item => normalizeTransitionItem(item, totalDuration))
        .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

function isCutTransitionItem(item = {}) {
    return (item.params?.placement || 'free') === 'cut';
}

function findInputCutTransitionBetween(transitionItems = [], current = {}, next = {}) {
    const currentIds = new Set([current.id, current.sourceId].filter(Boolean));
    const nextIds = new Set([next.id, next.sourceId].filter(Boolean));
    return transitionItems.find((transition) => (
        transition?.fromItemId
        && transition?.toItemId
        && isCutTransitionItem(transition)
        && currentIds.has(transition.fromItemId)
        && nextIds.has(transition.toItemId)
    )) || null;
}

function getCutTransitionForPair({ transitions = {}, transitionItems = [], current = {}, next = {}, key = '' } = {}) {
    return findInputCutTransitionBetween(transitionItems, current, next) || (key ? transitions[key] : null);
}

export function resolveTimelineTransitions({ clips = [], transitions = {}, transitionItems = [], totalDuration = 0 } = {}) {
    const resolved = [];
    let cursor = getIntroOffset(transitionItems);

    clips.forEach((clip, index) => {
        const duration = getClipPlaybackDuration(clip);
        const nextClip = clips[index + 1];
        const key = nextClip ? `${clip.id}->${nextClip.id}` : '';
        const transition = nextClip ? getCutTransitionForPair({ transitions, transitionItems, current: clip, next: nextClip, key }) : null;
        const transitionDuration = getCutTransitionConfiguredDuration(transition);
        const transitionOverlap = resolveCutTransitionOverlap(transition, duration, getClipPlaybackDuration(nextClip));

        if (transition && nextClip) {
            resolved.push(normalizeTransitionItem({
                id: transition.id || `cut-${clip.id}-${nextClip.id}`,
                type: transition.type || 'crossfade',
                start: cursor + Math.max(0, duration - transitionOverlap),
                duration: transitionDuration,
                fromItemId: clip.id,
                toItemId: nextClip.id,
                trackId: transition.trackId || getTrackForItemType('transition'),
                params: {
                    ...(transition.params || {}),
                    legacyKey: key,
                    placement: 'cut',
                },
                name: transition.name || transition.type || 'Transition',
                icon: transition.icon || '*',
                category: transition.category || 'basic',
            }, totalDuration));
        }

        cursor += duration - transitionOverlap;
    });

    normalizeTransitionItems(transitionItems, totalDuration).forEach((item) => {
        if (isCutTransitionItem(item)) return;
        const sequencePlacement = getSequencePlacement(item);
        if (sequencePlacement === 'intro') {
            resolved.push({
                ...item,
                start: 0,
                params: {
                    ...(item.params || {}),
                    placement: 'intro',
                    sequenceSlot: 'intro',
                },
            });
            return;
        }
        if (sequencePlacement === 'outro') {
            const duration = Math.max(0.1, finiteNumber(item.duration, 0.5));
            const start = Math.max(0, (totalDuration || item.start + duration) - duration);
            resolved.push({
                ...item,
                start,
                params: {
                    ...(item.params || {}),
                    placement: 'outro',
                    sequenceSlot: 'outro',
                },
            });
            return;
        }
        resolved.push({
            ...item,
            params: {
                ...(item.params || {}),
                placement: item.params?.placement || 'free',
            },
        });
    });

    return resolved.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

export function resolveActiveTransition(transitionItems = [], globalTime = 0, totalDuration = 0) {
    const time = finiteNumber(globalTime, 0);
    return normalizeTransitionItems(transitionItems, totalDuration)
        .filter(item => time >= item.start && time <= item.start + item.duration)
        .at(-1) || null;
}

export function buildTimelineSnapPoints({
    clips = [],
    transitions = {},
    transitionItems = [],
    textOverlays = [],
    audioTracks = [],
    totalDuration = 0,
    currentTime = 0,
} = {}) {
    const safeTotalDuration = normalizeTimelineDuration(totalDuration, 0);
    const points = new Map();
    const addPoint = (time, type = 'marker', label = '') => {
        const normalized = finiteNumber(time, 0);
        if (normalized < -0.001 || normalized > safeTotalDuration + 0.001) return;
        const key = normalized.toFixed(3);
        if (!points.has(key)) {
            points.set(key, {
                time: Math.max(0, Math.min(safeTotalDuration, normalized)),
                type,
                label: label || `${normalized.toFixed(2)}s`,
            });
        }
    };

    addPoint(0, 'start', 'Timeline start');
    if (safeTotalDuration > 0) addPoint(safeTotalDuration, 'end', 'Timeline end');
    if (currentTime > 0 && currentTime < safeTotalDuration) addPoint(currentTime, 'playhead', 'Playhead');

    let cursor = getIntroOffset(transitionItems);
    clips.forEach((clip, index) => {
        const duration = getClipPlaybackDuration(clip);
        const clipLabel = clip.name || `Clip ${index + 1}`;

        addPoint(cursor, 'clip-start', `${clipLabel} in`);
        addPoint(cursor + duration, 'clip-end', `${clipLabel} out`);

        const nextClip = clips[index + 1];
        const key = nextClip ? `${clip.id}->${nextClip.id}` : '';
        const transition = nextClip ? getCutTransitionForPair({ transitions, transitionItems, current: clip, next: nextClip, key }) : null;
        cursor += duration - resolveCutTransitionOverlap(transition, duration, getClipPlaybackDuration(nextClip));
    });

    resolveTimelineTransitions({ clips, transitions, transitionItems, totalDuration: safeTotalDuration })
        .filter(transition => transition.params?.placement !== 'cut')
        .forEach((transition) => {
            const label = transition.name || transition.id || transition.type || 'transition';
            addPoint(transition.start, 'transition-start', `${label} in`);
            addPoint(transition.start + transition.duration, 'transition-end', `${label} out`);
        });

    textOverlays.forEach((text, index) => {
        const start = finiteNumber(text.startTime ?? text.start, 0);
        const end = finiteNumber(text.endTime, start + finiteNumber(text.duration, 0));
        const label = text.content || text.name || `Texte ${index + 1}`;
        addPoint(start, 'text-start', `${label} in`);
        addPoint(end, 'text-end', `${label} out`);
    });

    audioTracks.forEach((track, index) => {
        const start = finiteNumber(track.startTime ?? track.start, 0);
        const end = finiteNumber(track.endTime, start + finiteNumber(track.duration, 0));
        const label = track.name || `Audio ${index + 1}`;
        addPoint(start, 'audio-start', `${label} in`);
        addPoint(end, 'audio-end', `${label} out`);
    });

    const gridStepSeconds = Math.max(1, Math.ceil(safeTotalDuration / MAX_SNAP_GRID_POINTS));
    for (let second = gridStepSeconds; second < safeTotalDuration; second += gridStepSeconds) {
        addPoint(second, 'second', `${second}s`);
    }

    return [...points.values()].sort((a, b) => a.time - b.time);
}

export function snapTimeToPoints(time, points = [], threshold = DEFAULT_SNAP_THRESHOLD_SECONDS) {
    const normalized = finiteNumber(time, 0);
    let best = null;

    points.forEach((point) => {
        const distance = Math.abs(point.time - normalized);
        if (distance > threshold) return;
        if (!best || distance < best.distance) {
            best = { ...point, distance };
        }
    });

    if (!best) {
        return { time: normalized, snapped: false, point: null, delta: 0 };
    }

    return {
        time: best.time,
        snapped: true,
        point: best,
        delta: best.time - normalized,
    };
}

export function snapTimelineRange({
    start = 0,
    end = 0,
    mode = 'move',
    points = [],
    threshold = DEFAULT_SNAP_THRESHOLD_SECONDS,
    totalDuration = 0,
    minDuration = 0.1,
} = {}) {
    const safeStart = finiteNumber(start, 0);
    const safeEnd = Math.max(safeStart + minDuration, finiteNumber(end, safeStart + minDuration));
    const maxEnd = Math.max(minDuration, totalDuration || safeEnd);
    const duration = Math.max(minDuration, safeEnd - safeStart);

    if (mode === 'resize-left') {
        const snapped = snapTimeToPoints(safeStart, points, threshold);
        const nextStart = clamp(snapped.time, 0, safeEnd - minDuration);
        return { start: nextStart, end: safeEnd, snap: snapped.snapped ? snapped : null };
    }

    if (mode === 'resize-right') {
        const snapped = snapTimeToPoints(safeEnd, points, threshold);
        const nextEnd = clamp(snapped.time, safeStart + minDuration, maxEnd);
        return { start: safeStart, end: nextEnd, snap: snapped.snapped ? snapped : null };
    }

    const snappedStart = snapTimeToPoints(safeStart, points, threshold);
    const snappedEnd = snapTimeToPoints(safeEnd, points, threshold);
    const chosen = snappedStart.snapped && snappedEnd.snapped
        ? (snappedStart.distance <= snappedEnd.distance ? snappedStart : snappedEnd)
        : (snappedStart.snapped ? snappedStart : snappedEnd);
    const delta = chosen.snapped ? chosen.delta : 0;
    const nextStart = clamp(safeStart + delta, 0, Math.max(0, maxEnd - duration));

    return {
        start: nextStart,
        end: nextStart + duration,
        snap: chosen.snapped ? chosen : null,
    };
}

export function buildTimelineModel({
    clips = [],
    transitions = {},
    transitionItems = [],
    textOverlays = [],
    audioTracks = [],
    tracks = getDefaultTracks(),
    totalDuration = 0,
} = {}) {
    const providedTracks = Array.isArray(tracks) ? tracks : [];
    const providedTrackById = new Map(providedTracks.map(track => [track.id, track]));
    const defaultIds = new Set(DEFAULT_TRACKS.map(track => track.id));
    const normalizedTracks = [
        ...DEFAULT_TRACKS.map(track => ({
            ...track,
            ...(providedTrackById.get(track.id) || {}),
        })),
        ...providedTracks.filter(track => track?.id && !defaultIds.has(track.id)),
    ].map(track => ({
        locked: false,
        muted: false,
        visible: true,
        allowOverlap: false,
        order: 0,
        ...track,
    }));

    const items = [];
    let cursor = getIntroOffset(transitionItems);

    clips.forEach((clip, index) => {
        const speed = finiteNumber(clip.speed, 1) || 1;
        const trimStart = finiteNumber(clip.trimStart, 0);
        const trimEnd = finiteNumber(clip.trimEnd, clip.duration || 0);
        const duration = getClipPlaybackDuration(clip);

        items.push({
            id: clip.id,
            trackId: clip.trackId || 'video-main',
            type: 'video',
            sourceId: clip.id,
            start: cursor,
            duration,
            trimStart,
            trimEnd,
            zIndex: index,
            params: { speed, volume: clampVolumePercent(clip.volume), filters: clip.filters || {} },
            source: clip,
        });

        items.push({
            id: `${clip.id}:audio`,
            trackId: 'audio-main',
            type: 'audio',
            sourceId: clip.id,
            start: cursor,
            duration,
            trimStart,
            trimEnd,
            zIndex: index,
            params: {
                clipId: clip.id,
                embedded: true,
                speed,
                volume: clampVolumePercent(clip.volume),
            },
            source: clip,
        });

        if (hasActiveClipFilters(clip.filters)) {
            const filters = normalizeClipFilters(clip.filters);
            items.push({
                id: `${clip.id}:effect:filters`,
                trackId: getTrackForItemType('effect'),
                type: 'effect',
                sourceId: clip.id,
                start: cursor,
                duration,
                trimStart,
                trimEnd,
                zIndex: index,
                params: {
                    effectType: 'clip-filters',
                    clipId: clip.id,
                    filters,
                },
                source: clip,
            });
        }

        const nextClip = clips[index + 1];
        const key = nextClip ? `${clip.id}->${nextClip.id}` : '';
        const transition = nextClip ? getCutTransitionForPair({ transitions, transitionItems, current: clip, next: nextClip, key }) : null;
        cursor += duration - resolveCutTransitionOverlap(transition, duration, getClipPlaybackDuration(nextClip));
    });

    resolveTimelineTransitions({ clips, transitions, transitionItems, totalDuration }).forEach(item => {
        const placement = item.params?.placement || 'free';
        items.push({
            id: item.id,
            trackId: item.trackId,
            type: 'transition',
            sourceId: item.id,
            start: item.start,
            duration: item.duration,
            trimStart: 0,
            trimEnd: item.duration,
            zIndex: 0,
            params: {
                transitionType: item.type,
                fromItemId: item.fromItemId,
                toItemId: item.toItemId,
                editable: placement !== 'cut',
                ...item.params,
            },
            source: item.source,
        });
    });

    textOverlays.forEach((text, index) => {
        const start = finiteNumber(text.startTime, 0);
        const end = finiteNumber(text.endTime, start + 0.1);
        items.push({
            id: text.id,
            trackId: text.trackId || 'text-main',
            type: 'text',
            sourceId: text.id,
            start,
            duration: Math.max(0.1, end - start),
            trimStart: 0,
            trimEnd: Math.max(0.1, end - start),
            zIndex: index,
            params: { content: text.content, x: text.x, y: text.y },
            source: text,
        });
    });

    audioTracks.forEach((track, index) => {
        const start = finiteNumber(track.startTime, 0);
        const end = finiteNumber(track.endTime, start + finiteNumber(track.duration, 0.1));
        items.push({
            id: track.id,
            trackId: track.trackId || 'music-main',
            type: 'audio',
            sourceId: track.id,
            start,
            duration: Math.max(0.1, end - start),
            trimStart: 0,
            trimEnd: Math.max(0.1, end - start),
            zIndex: index,
            params: { volume: clampVolumePercent(track.volume), rightsStatus: track.rightsStatus },
            source: track,
        });
    });

    return {
        tracks: normalizedTracks.sort((a, b) => a.order - b.order),
        items: items.sort((a, b) => a.start - b.start || a.zIndex - b.zIndex),
    };
}

function timelineItemToRenderSource(item) {
    const source = item.source || {};
    const startTime = item.start;
    const endTime = item.start + item.duration;
    return {
        ...source,
        id: item.id,
        trackId: item.trackId,
        type: item.type,
        sourceId: item.sourceId,
        mediaType: source.type,
        start: startTime,
        startTime,
        endTime,
        duration: item.duration,
        trimStart: item.trimStart,
        trimEnd: item.trimEnd,
        zIndex: item.zIndex,
        volume: item.params?.volume ?? source.volume,
        params: item.params || {},
    };
}

export function resolveTimelineRenderPlan({
    clips = [],
    transitions = {},
    transitionItems = [],
    textOverlays = [],
    audioTracks = [],
    tracks = getDefaultTracks(),
    totalDuration = 0,
} = {}) {
    const model = buildTimelineModel({
        clips,
        transitions,
        transitionItems,
        textOverlays,
        audioTracks,
        tracks,
        totalDuration,
    });
    const itemsForTrack = (type, trackId) => (
        model.items
            .filter(item => item.type === type && item.trackId === trackId)
            .map(timelineItemToRenderSource)
    );
    const videoClips = isTrackVisible(tracks, 'video-main') ? itemsForTrack('video', 'video-main') : [];
    const visibleTransitionTrackIds = new Set(
        model.tracks
            .filter(track => track.type === 'transition' && isTrackVisible(tracks, track.id))
            .map(track => track.id)
    );
    const timelineTransitions = model.items
        .filter(item => item.type === 'transition' && visibleTransitionTrackIds.has(item.trackId))
        .map(timelineItemToRenderSource);
    const editableTimelineTransitions = timelineTransitions.filter(item => item.params?.placement !== 'cut');
    const visibleEffectTrackIds = new Set(
        model.tracks
            .filter(track => track.type === 'effect' && isTrackVisible(tracks, track.id))
            .map(track => track.id)
    );
    const effectItems = model.items
        .filter(item => item.type === 'effect' && visibleEffectTrackIds.has(item.trackId))
        .map(timelineItemToRenderSource);
    const visibleTextTrackIds = new Set(
        model.tracks
            .filter(track => track.type === 'text' && isTrackVisible(tracks, track.id))
            .map(track => track.id)
    );
    const textItems = model.items
        .filter(item => item.type === 'text' && visibleTextTrackIds.has(item.trackId))
        .map(timelineItemToRenderSource);
    const clipAudioTrackIds = new Set(
        model.tracks
            .filter(track => getTimelineTrackRole(track) === 'clip-audio' && isTrackVisible(tracks, track.id))
            .map(track => track.id)
    );
    const clipAudioItems = model.items
        .filter(item => item.type === 'audio' && clipAudioTrackIds.has(item.trackId))
        .map(timelineItemToRenderSource);
    const musicTrackIds = new Set(
        model.tracks
            .filter(track => getTimelineTrackRole(track) === 'music' && isTrackVisible(tracks, track.id) && !isTrackMuted(tracks, track.id))
            .map(track => track.id)
    );
    const musicItems = model.items
        .filter(item => item.type === 'audio' && musicTrackIds.has(item.trackId))
        .map(timelineItemToRenderSource);
    const allTransitions = resolveTimelineTransitions({ clips, transitions, transitionItems, totalDuration })
        .filter(item => visibleTransitionTrackIds.has(item.trackId));
    const playbackClips = isTrackMuted(tracks, 'audio-main')
        ? videoClips.map(clip => ({ ...clip, volume: 0 }))
        : videoClips;

    return {
        model,
        clips: videoClips,
        playbackClips,
        transitions,
        transitionItems: editableTimelineTransitions,
        allTransitions,
        effectItems,
        textOverlays: textItems,
        audioClipItems: clipAudioItems,
        audioTracks: musicItems,
        hasVisibleVideo: videoClips.length > 0,
        hasVisibleContent: videoClips.length > 0 || textItems.length > 0,
    };
}

function getItemEnd(item = {}) {
    const start = finiteNumber(item.start ?? item.startTime, 0);
    const duration = finiteNumber(item.duration ?? ((item.endTime ?? 0) - start), 0);
    return start + duration;
}

function hasClipAtTime(clips = [], time = 0) {
    return clips.some((clip) => {
        const start = finiteNumber(clip.start ?? clip.startTime, 0);
        const end = getItemEnd(clip);
        return time >= start - 0.001 && time <= end + 0.001;
    });
}

function findCutTransitionBetween(transitionItems = [], current = {}, next = {}) {
    const currentIds = new Set([current.id, current.sourceId].filter(Boolean));
    const nextIds = new Set([next.id, next.sourceId].filter(Boolean));
    return transitionItems.find((transition) => {
        if (!transition?.fromItemId || !transition?.toItemId) return false;
        const placement = transition.params?.placement || 'cut';
        return placement === 'cut' && currentIds.has(transition.fromItemId) && nextIds.has(transition.toItemId);
    }) || null;
}

export function findTimelineItemOverlap(items = [], { tolerance = 0.001 } = {}) {
    const ranges = items
        .map((item) => {
            const start = finiteNumber(item.start ?? item.startTime, 0);
            const duration = finiteNumber(item.duration ?? ((item.endTime ?? 0) - start), 0);
            return {
                id: item.id,
                trackId: item.trackId || getTrackForItemType(item.type),
                start,
                end: start + duration,
                item,
            };
        })
        .filter(range => range.id && range.trackId && range.end > range.start)
        .sort((a, b) => a.trackId.localeCompare(b.trackId) || a.start - b.start || a.end - b.end);

    for (let index = 0; index < ranges.length - 1; index += 1) {
        const current = ranges[index];
        const next = ranges[index + 1];
        if (current.trackId !== next.trackId) continue;
        if (next.start < current.end - tolerance) {
            return {
                trackId: current.trackId,
                current: current.item,
                next: next.item,
                overlap: current.end - next.start,
            };
        }
    }

    return null;
}

export function findTransitionItemOverlap(transitionItems = [], totalDuration = 0, options = {}) {
    const editableTransitions = normalizeTransitionItems(transitionItems, totalDuration)
        .filter(item => item.params?.placement !== 'cut');
    return findTimelineItemOverlap(editableTransitions, options);
}

function getPlanItemsForOverlapValidation(plan = {}) {
    if (Array.isArray(plan?.model?.items)) return plan.model.items;

    return [
        ...(plan?.transitionItems || []).map(item => ({
            ...item,
            trackId: item.trackId || getTrackForItemType('transition'),
            type: 'transition',
        })),
        ...(plan?.audioTracks || []).map(item => ({
            ...item,
            trackId: item.trackId || getTrackForItemType('audio'),
            type: 'audio',
        })),
        ...(plan?.audioClipItems || []).map(item => ({
            ...item,
            trackId: item.trackId || 'audio-main',
            type: 'audio',
        })),
        ...(plan?.textOverlays || []).map(item => ({
            ...item,
            trackId: item.trackId || getTrackForItemType('text'),
            type: 'text',
        })),
        ...(plan?.effectItems || []).map(item => ({
            ...item,
            trackId: item.trackId || getTrackForItemType('effect'),
            type: 'effect',
        })),
    ];
}

function formatTrackOverlapError(overlap = {}, track = {}) {
    const first = overlap.current?.name || overlap.current?.content || overlap.current?.id || 'item';
    const second = overlap.next?.name || overlap.next?.content || overlap.next?.id || 'item';

    if (track.id === 'transition-main') {
        return `Overlap transition sur ${overlap.trackId}: ${first} / ${second}.`;
    }
    if (track.type === 'audio') {
        return `Overlap audio interdit sur ${overlap.trackId}: ${first} / ${second}.`;
    }
    return `Overlap interdit sur piste ${track.name || overlap.trackId}: ${first} / ${second}.`;
}

function findDisallowedTrackOverlap(plan = {}, tracks = [], options = {}) {
    const blockedTrackIds = new Set(
        tracks
            .filter(track => track?.id && track.id !== 'video-main' && track.allowOverlap !== true)
            .map(track => track.id)
    );
    if (blockedTrackIds.size === 0) return null;

    const items = getPlanItemsForOverlapValidation(plan)
        .filter(item => blockedTrackIds.has(item.trackId || getTrackForItemType(item.type)));
    const overlap = findTimelineItemOverlap(items, options);
    if (!overlap) return null;
    return {
        ...overlap,
        track: tracks.find(track => track.id === overlap.trackId) || { id: overlap.trackId },
    };
}

function validateRenderItems(items = [], {
    label = 'item',
    totalDuration = 0,
    tolerance = 0.001,
    requireSourceClip = false,
    sourceClips = [],
} = {}) {
    const errors = [];
    const warnings = [];
    const duration = finiteNumber(totalDuration, 0);
    const clipsById = new Map(sourceClips.map(clip => [clip.sourceId || clip.id, clip]));

    items.forEach((item, index) => {
        const itemLabel = item.name || item.id || `${label}-${index + 1}`;
        const start = finiteNumber(item.start ?? item.startTime, NaN);
        const itemDuration = finiteNumber(item.duration ?? ((item.endTime ?? 0) - start), NaN);
        const end = start + itemDuration;

        if (!item.id) errors.push(`${label} sans id: ${itemLabel}.`);
        if (!item.trackId) errors.push(`${label} sans trackId: ${itemLabel}.`);
        if (!Number.isFinite(start) || start < -tolerance) errors.push(`Start ${label} invalide: ${itemLabel}.`);
        if (!Number.isFinite(itemDuration) || itemDuration <= 0) errors.push(`Duree ${label} invalide: ${itemLabel}.`);
        if (duration > 0 && start >= duration - tolerance) errors.push(`${label} hors timeline: ${itemLabel}.`);
        if (duration > 0 && end > duration + tolerance) warnings.push(`${label} tronque par la duree timeline: ${itemLabel}.`);

        if (requireSourceClip) {
            const sourceId = item.sourceId || item.params?.clipId;
            const sourceClip = clipsById.get(sourceId);
            if (!sourceId || !sourceClip) {
                errors.push(`${label} sans clip source actif: ${itemLabel}.`);
            } else {
                const sourceStart = finiteNumber(sourceClip.start ?? sourceClip.startTime, 0);
                const sourceEnd = getItemEnd(sourceClip);
                if (Math.abs(sourceStart - start) > tolerance || Math.abs(sourceEnd - end) > tolerance) {
                    warnings.push(`${label} desynchronise de son clip source: ${itemLabel}.`);
                }
            }
        }
    });

    return { errors, warnings };
}

export function validateTimelineRenderPlan({ plan = null, totalDuration = 0, frameDuration = 1 / 30 } = {}) {
    const errors = [];
    const warnings = [];
    const duration = finiteNumber(totalDuration, 0);
    const tolerance = Math.max(0.001, finiteNumber(frameDuration, 1 / 30) * 0.5);
    const clips = [...(plan?.clips || [])].sort((a, b) => (
        finiteNumber(a.start ?? a.startTime, 0) - finiteNumber(b.start ?? b.startTime, 0)
    ));
    const canonicalCutTransitions = (plan?.allTransitions || [])
        .filter(transition => (transition.params?.placement || 'cut') === 'cut');
    const legacyTransitions = plan?.transitions || {};
    const trackRules = plan?.model?.tracks || plan?.tracks || getDefaultTracks();

    if (!clips.length) {
        errors.push('Aucun clip video visible: export noir probable.');
    }

    clips.forEach((clip, index) => {
        const label = clip.name || clip.id || `clip-${index + 1}`;
        const start = finiteNumber(clip.start ?? clip.startTime, NaN);
        const itemDuration = finiteNumber(clip.duration, NaN);
        const end = start + itemDuration;
        const trimStart = finiteNumber(clip.trimStart, 0);
        const trimEnd = finiteNumber(clip.trimEnd, trimStart);

        if (!clip.url) errors.push(`Clip video sans URL: ${label}.`);
        if (!Number.isFinite(start) || start < -tolerance) errors.push(`Start video invalide: ${label}.`);
        if (!Number.isFinite(itemDuration) || itemDuration <= 0) errors.push(`Duree video invalide: ${label}.`);
        if (trimEnd <= trimStart) errors.push(`Trim video invalide: ${label}.`);
        if (duration > 0 && start >= duration - tolerance) errors.push(`Clip video hors timeline: ${label}.`);
        if (duration > 0 && end > duration + tolerance) warnings.push(`Clip video coupe par la duree timeline: ${label}.`);
    });

    if (clips.length > 0) {
        const firstStart = finiteNumber(clips[0].start ?? clips[0].startTime, 0);
        const introOffset = getIntroOffset(plan?.allTransitions || plan?.transitionItems || []);
        if (firstStart > introOffset + tolerance) errors.push(`Trou video avant le premier clip: ${firstStart.toFixed(2)}s.`);

        for (let index = 0; index < clips.length - 1; index += 1) {
            const current = clips[index];
            const next = clips[index + 1];
            const currentEnd = getItemEnd(current);
            const nextStart = finiteNumber(next.start ?? next.startTime, 0);
            const gap = nextStart - currentEnd;
            const overlap = currentEnd - nextStart;
            const transition = findCutTransitionBetween(canonicalCutTransitions, current, next)
                || legacyTransitions[`${current.id}->${next.id}`];
            const transitionDuration = finiteNumber(transition?.duration, 0);

            if (gap > tolerance) {
                errors.push(`Trou video entre ${current.name || current.id} et ${next.name || next.id}: ${gap.toFixed(2)}s.`);
            }
            if (overlap > tolerance && overlap > transitionDuration + tolerance) {
                errors.push(`Overlap video non couvert entre ${current.name || current.id} et ${next.name || next.id}: ${overlap.toFixed(2)}s.`);
            }
            if (transition && Math.abs(overlap - transitionDuration) > Math.max(0.05, tolerance * 2)) {
                warnings.push(`Overlap transition different de sa duree entre ${current.name || current.id} et ${next.name || next.id}.`);
            }
        }
    }

    const blockedTrackOverlap = findDisallowedTrackOverlap(plan || {}, trackRules, { tolerance });
    if (blockedTrackOverlap) {
        errors.push(formatTrackOverlapError(blockedTrackOverlap, blockedTrackOverlap.track));
    }

    (plan?.allTransitions || plan?.transitionItems || []).forEach((transition) => {
        const start = finiteNumber(transition.start ?? transition.startTime, 0);
        const durationValue = finiteNumber(transition.duration ?? ((transition.endTime ?? 0) - start), 0);
        const end = start + durationValue;
        const label = transition.name || transition.id || transition.type || 'transition';
        if (durationValue <= 0) errors.push(`Duree transition invalide: ${label}.`);
        if (start < -tolerance || end > duration + tolerance) errors.push(`Transition hors timeline: ${label}.`);
        if (!isSequenceTransition(transition) && clips.length > 0 && !hasClipAtTime(clips, start + durationValue / 2)) {
            warnings.push(`Transition sans clip actif a son timestamp: ${label}.`);
        }
    });

    (plan?.audioTracks || []).forEach((track) => {
        const start = finiteNumber(track.start ?? track.startTime, 0);
        const end = getItemEnd(track);
        const label = track.name || track.id || 'audio';
        if (!track.url) errors.push(`Piste audio sans URL: ${label}.`);
        if (end <= start) errors.push(`Duree audio invalide: ${label}.`);
        if (duration > 0 && start >= duration - tolerance) errors.push(`Piste audio hors timeline: ${label}.`);
        if (duration > 0 && end > duration + tolerance) warnings.push(`Piste audio tronquee a l'export: ${label}.`);
    });

    const clipAudioAudit = validateRenderItems(plan?.audioClipItems || [], {
        label: 'Audio clip',
        totalDuration: duration,
        tolerance,
        requireSourceClip: true,
        sourceClips: clips,
    });
    errors.push(...clipAudioAudit.errors);
    warnings.push(...clipAudioAudit.warnings);

    const effectAudit = validateRenderItems(plan?.effectItems || [], {
        label: 'Effet clip',
        totalDuration: duration,
        tolerance,
        requireSourceClip: true,
        sourceClips: clips,
    });
    errors.push(...effectAudit.errors);
    warnings.push(...effectAudit.warnings);

    return { errors, warnings };
}

export function buildExportFrameSchedule({ totalDuration = 0, fps = 30 } = {}) {
    const duration = finiteNumber(totalDuration, 0);
    const normalizedFps = finiteNumber(fps, 0);
    const frameDuration = normalizedFps > 0 ? 1 / normalizedFps : 0;
    const rawFrames = duration > 0 && normalizedFps > 0
        ? Math.ceil(Math.max(0, duration * normalizedFps - 1e-9))
        : 0;
    const totalFrames = rawFrames > 0 ? Math.max(1, rawFrames) : 0;
    const lastFrameTime = totalFrames > 0 ? Math.min(duration, (totalFrames - 1) * frameDuration) : 0;

    return {
        totalDuration: duration,
        fps: normalizedFps,
        frameDuration,
        totalFrames,
        expectedDuration: totalFrames * frameDuration,
        lastFrameTime,
    };
}

export function getNearestExportFrameSample({ frameSchedule = null, time = 0, label = '' } = {}) {
    const schedule = frameSchedule || buildExportFrameSchedule();
    const frameDuration = finiteNumber(schedule.frameDuration, 0);
    const totalFrames = Math.max(0, Math.floor(finiteNumber(schedule.totalFrames, 0)));
    const targetTime = finiteNumber(time, 0);

    if (frameDuration <= 0 || totalFrames <= 0) {
        return {
            index: -1,
            time: 0,
            targetTime,
            delta: 0,
            label,
        };
    }

    const index = clamp(Math.round(targetTime / frameDuration), 0, totalFrames - 1);
    const frameTime = Math.min(finiteNumber(schedule.totalDuration, targetTime), index * frameDuration);

    return {
        index,
        time: frameTime,
        targetTime,
        delta: frameTime - targetTime,
        label,
    };
}

export function validateExportFrameCoverage({ frameSchedule = null, transitionItems = [], totalDuration = 0 } = {}) {
    const errors = [];
    const warnings = [];
    const samples = [];
    const schedule = frameSchedule || buildExportFrameSchedule({ totalDuration });
    const frameDuration = finiteNumber(schedule.frameDuration, 0);
    const totalFrames = Math.max(0, Math.floor(finiteNumber(schedule.totalFrames, 0)));
    const duration = finiteNumber(totalDuration || schedule.totalDuration, 0);

    if (duration <= 0 || totalFrames <= 0 || frameDuration <= 0) {
        errors.push('Plan de frames export invalide: aucun timestamp a verifier.');
        return { errors, warnings, samples };
    }

    samples.push(getNearestExportFrameSample({ frameSchedule: schedule, time: 0, label: 'timeline-start' }));
    samples.push(getNearestExportFrameSample({ frameSchedule: schedule, time: Math.max(0, duration - frameDuration), label: 'timeline-end' }));

    normalizeTransitionItems(transitionItems, duration).forEach((transition) => {
        const start = finiteNumber(transition.start, 0);
        const transitionDuration = finiteNumber(transition.duration, 0);
        const end = start + transitionDuration;
        const label = transition.name || transition.id || transition.type || 'transition';
        const mid = start + transitionDuration / 2;
        const midpointSample = getNearestExportFrameSample({
            frameSchedule: schedule,
            time: mid,
            label: `transition:${label}:mid`,
        });
        samples.push(midpointSample);

        const firstIndexInside = Math.ceil((start - 0.000001) / frameDuration);
        const lastIndexInside = Math.floor((end + 0.000001) / frameDuration);
        const clampedFirst = clamp(firstIndexInside, 0, totalFrames - 1);
        const clampedLast = clamp(lastIndexInside, 0, totalFrames - 1);
        const hasFrameInside = clampedFirst <= clampedLast
            && clampedFirst * frameDuration >= start - 0.000001
            && clampedFirst * frameDuration <= end + 0.000001;

        if (!hasFrameInside) {
            errors.push(`Transition sans frame export planifiee: ${label}. Augmentez sa duree ou le FPS.`);
        } else if (transitionDuration < frameDuration) {
            warnings.push(`Transition plus courte qu'une frame export: ${label}.`);
        }

        if (Math.abs(midpointSample.delta) > frameDuration / 2 + 0.000001) {
            warnings.push(`Timestamp transition peu precis a l'export: ${label}.`);
        }
    });

    return { errors, warnings, samples };
}

export function validateExportTimeline({ clips = [], audioTracks = [], transitionItems = [], totalDuration = 0, fps = 30, mimeType = '' } = {}) {
    const errors = [];
    const warnings = [];
    const normalizedFps = finiteNumber(fps, 0);
    const normalizedDuration = finiteNumber(totalDuration, 0);
    const frameSchedule = buildExportFrameSchedule({ totalDuration, fps });

    if (!clips.length) errors.push('Ajoutez au moins un clip video avant export.');
    if (!normalizedDuration || normalizedDuration <= 0) errors.push('La duree de timeline est invalide.');
    if (!normalizedFps || normalizedFps < 12 || normalizedFps > 60) errors.push(`FPS invalide: ${fps}.`);
    if (!mimeType) errors.push('Aucun codec MediaRecorder compatible trouve.');
    if (normalizedDuration > 0 && normalizedFps > 0 && frameSchedule.totalFrames <= 0) errors.push('Plan de frames export invalide.');
    if (frameSchedule.totalFrames > 36_000) warnings.push('Export navigateur long: risque memoire/performance eleve.');

    clips.forEach((clip) => {
        const speed = finiteNumber(clip.speed, 1);
        const trimStart = finiteNumber(clip.trimStart, 0);
        const trimEnd = finiteNumber(clip.trimEnd, clip.duration || 0);
        const volume = finiteNumber(clip.volume, 100);
        if (speed <= 0 || speed > 4) errors.push(`Vitesse invalide sur ${clip.name || clip.id}.`);
        if (trimEnd <= trimStart) errors.push(`Trim invalide sur ${clip.name || clip.id}.`);
        if (volume < 0 || volume > 100) warnings.push(`Volume clip borne automatiquement: ${clip.name || clip.id}.`);
    });

    audioTracks.forEach((track) => {
        const start = finiteNumber(track.startTime, 0);
        const end = finiteNumber(track.endTime, start + finiteNumber(track.duration, 0));
        const volume = finiteNumber(track.volume, 100);
        if (!track.url) errors.push(`Piste audio sans URL: ${track.name || track.id}.`);
        if (end <= start) errors.push(`Duree audio invalide: ${track.name || track.id}.`);
        if (volume < 0 || volume > 100) warnings.push(`Volume audio borne automatiquement: ${track.name || track.id}.`);
    });

    normalizeTransitionItems(transitionItems, normalizedDuration).forEach((transition) => {
        if (transition.start + transition.duration > normalizedDuration + 0.001) {
            errors.push(`Transition hors timeline: ${transition.name}.`);
        }
    });

    return { errors, warnings };
}

export function validateExportAudioMix({ playbackClips = [], audioTracks = [], shouldMixAudio = false, totalDuration = 0 } = {}) {
    const errors = [];
    const warnings = [];
    const duration = finiteNumber(totalDuration, 0);
    const activeClipAudio = playbackClips
        .map((clip) => {
            const start = finiteNumber(clip.start, 0);
            const itemDuration = finiteNumber(clip.duration, 0);
            return {
                id: clip.id,
                label: clip.name || clip.id || 'clip',
                kind: 'clip',
                start,
                end: start + itemDuration,
                duration: itemDuration,
                volume: finiteNumber(clip.volume, 100),
            };
        })
        .filter(source => source.duration > 0 && source.end > source.start);
    const activeMusicAudio = audioTracks.map((track) => {
        const start = finiteNumber(track.startTime ?? track.start, 0);
        const itemDuration = finiteNumber(track.duration, finiteNumber(track.endTime, start) - start);
        const end = finiteNumber(track.endTime, start + itemDuration);
        return {
            id: track.id,
            label: track.name || track.id || 'audio',
            kind: 'music',
            url: track.url,
            start,
            end,
            duration: Math.max(0, end - start),
            volume: finiteNumber(track.volume, 100),
        };
    });
    const activeSources = [...activeClipAudio, ...activeMusicAudio]
        .filter(source => duration <= 0 || (source.start < duration && source.end > 0));
    const audibleSources = activeSources.filter(source => source.volume > 0 && source.end > source.start);

    if (shouldMixAudio && activeSources.length === 0) {
        errors.push('Mix audio demande sans source audio active.');
    }
    if (shouldMixAudio && audibleSources.length === 0) {
        warnings.push('Export audio muet: toutes les sources audio actives sont a volume 0 ou hors duree.');
    }

    activeMusicAudio.forEach((track) => {
        if (!track.url) errors.push(`Piste audio sans URL: ${track.label}.`);
        if (track.end <= track.start) errors.push(`Duree audio invalide: ${track.label}.`);
        if (duration > 0 && track.start >= duration) errors.push(`Piste audio hors timeline: ${track.label}.`);
        if (duration > 0 && track.end > duration) warnings.push(`Piste audio tronquee a l'export: ${track.label}.`);
        if (track.volume <= 0) warnings.push(`Piste audio muette a l'export: ${track.label}.`);
        if (track.volume < 0 || track.volume > 100) warnings.push(`Volume audio borne automatiquement: ${track.label}.`);
    });

    activeClipAudio.forEach((clip) => {
        if (clip.volume <= 0) warnings.push(`Audio clip muet a l'export: ${clip.label}.`);
        if (clip.volume < 0 || clip.volume > 100) warnings.push(`Volume clip borne automatiquement: ${clip.label}.`);
    });

    return { errors: uniqueMessages(errors), warnings: uniqueMessages(warnings) };
}

function uniqueMessages(messages = []) {
    return Array.from(new Set(messages.filter(Boolean)));
}
