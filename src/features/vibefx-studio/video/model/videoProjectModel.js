export const VIDEO_PROJECT_SNAPSHOT_VERSION = 1;

const PROJECT_KEYS = [
    'projectName',
    'clips',
    'transitions',
    'transitionItems',
    'textOverlays',
    'audioTracks',
    'tracks',
    'sequencePreset',
];

export function createVideoProjectSnapshot(state = {}, { savedAt = new Date().toISOString() } = {}) {
    const project = Object.fromEntries(PROJECT_KEYS.map((key) => [key, state[key]]));
    return {
        version: VIDEO_PROJECT_SNAPSHOT_VERSION,
        id: 'vibecut-local-current',
        savedAt,
        projectName: state.projectName || 'Untitled',
        project: {
            ...project,
            clips: (state.clips || []).map(serializeMediaSource),
            audioTracks: (state.audioTracks || []).map(serializeMediaSource),
        },
    };
}

export function restoreVideoProjectSnapshot(snapshot = {}, { createObjectUrl } = {}) {
    if (snapshot.version !== VIDEO_PROJECT_SNAPSHOT_VERSION || !snapshot.project) {
        throw new Error('Sauvegarde VibeCut incompatible.');
    }
    if (typeof createObjectUrl !== 'function') {
        throw new Error('Creation URL locale indisponible.');
    }
    const project = snapshot.project;
    const warnings = [];
    const clips = (project.clips || []).map((clip) => restoreMediaSource(clip, createObjectUrl, warnings));
    const audioTracks = (project.audioTracks || []).map((track) => restoreMediaSource(track, createObjectUrl, warnings));
    return {
        state: {
            ...project,
            clips,
            audioTracks,
        },
        warnings,
        savedAt: snapshot.savedAt || null,
    };
}

function serializeMediaSource(source = {}) {
    const persistentUrl = isPersistentUrl(source.url) ? source.url : null;
    return {
        ...source,
        file: null,
        sourceBlob: source.file instanceof Blob ? source.file : source.sourceBlob || null,
        url: persistentUrl,
        localPreviewUrl: isPersistentUrl(source.localPreviewUrl) ? source.localPreviewUrl : null,
        thumbnails: (source.thumbnails || []).filter(isPersistentThumbnail).slice(0, 8),
        waveform: source.waveform?.status === 'ready'
            ? source.waveform
            : { status: 'pending', peaks: [] },
    };
}

function restoreMediaSource(source = {}, createObjectUrl, warnings) {
    const sourceBlob = source.sourceBlob || null;
    const restoredUrl = sourceBlob ? createObjectUrl(sourceBlob) : source.url || source.localPreviewUrl || null;
    if (!restoredUrl) {
        warnings.push(`${source.name || source.id || 'media'}: source locale absente`);
    }
    const mediaType = source.mediaType || (String(source.mimeType || sourceBlob?.type || '').startsWith('image/') ? 'image' : 'video');
    return {
        ...source,
        file: sourceBlob,
        sourceBlob: null,
        url: restoredUrl,
        localPreviewUrl: restoredUrl,
        thumbnails: mediaType === 'image' && restoredUrl
            ? [restoredUrl]
            : (source.thumbnails || []),
    };
}

function isPersistentUrl(value) {
    if (!value || typeof value !== 'string') return false;
    return !value.startsWith('blob:');
}

function isPersistentThumbnail(value) {
    return typeof value === 'string' && !value.startsWith('blob:');
}
