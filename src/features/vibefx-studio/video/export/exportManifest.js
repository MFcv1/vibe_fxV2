export const EXPORT_MANIFEST_VERSION = 1;
export const EXPORT_ENGINE_VERSION = 'vibecut-export-manifest-1';

export const EXPORT_QUALITY_MODES = {
    preview: {
        id: 'preview',
        label: 'Preview 720p',
        crf: 21,
        preset: 'veryfast',
        audioBitrate: 160_000,
        maxVideoBitrate: 8_000_000,
        sizeMultiplier: 0.62,
    },
    pro: {
        id: 'pro',
        label: 'Export Pro',
        crf: 17,
        preset: 'slow',
        audioBitrate: 256_000,
        maxVideoBitrate: 40_000_000,
        sizeMultiplier: 1,
    },
    master: {
        id: 'master',
        label: 'Master',
        crf: 15,
        preset: 'slow',
        audioBitrate: 320_000,
        maxVideoBitrate: 60_000_000,
        sizeMultiplier: 1.45,
    },
    quickServer: {
        id: 'quickServer',
        label: 'Rapide serveur',
        crf: 19,
        preset: 'medium',
        audioBitrate: 192_000,
        maxVideoBitrate: 22_000_000,
        sizeMultiplier: 0.78,
    },
};

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

const EXPORT_COST_ASSUMPTIONS = {
    cloudRunVcpu: 2,
    cloudRunMemoryGib: 2,
    cpuSecondUsd: 0.000024,
    memoryGibSecondUsd: 0.0000025,
    storageGibMonthUsd: 0.026,
    usdToEur: 0.92,
};

/*
 * Transitions minutees rendues par le serveur, avec leur equivalent natif `xfade`.
 * Source unique de verite applicative : render-service/src/server.js et
 * functions/src/videoExport.js portent la meme table, et
 * scripts/smoke-vibecut-transition-parity.mjs verifie qu'elles ne divergent pas.
 * Une entree n'a le droit d'etre ici que si VideoEngine.renderTransition la rend
 * comme `xfade` la rend : sinon l'apercu ment sur l'export.
 */
export const SERVER_XFADE_TRANSITION_MAP = Object.freeze({
    fade: 'fade',
    crossfade: 'fade',
    'dip-black': 'fadeblack',
    'dip-white': 'fadewhite',
    'film-dissolve': 'dissolve',
    'desat-fade': 'fadegrays',
    'swipe-left': 'smoothleft',
    'swipe-right': 'smoothright',
    'push-up': 'slideup',
    'push-down': 'slidedown',
    'wipe-left': 'wipeleft',
    'blinds-open': 'vertopen',
    'iris-open': 'circleopen',
    'iris-close': 'circleclose',
    'pixel-cut': 'pixelize',
    'blur-cut': 'hblur',
});

const SERVER_TIMED_TRANSITION_IDS = Object.freeze(Object.keys(SERVER_XFADE_TRANSITION_MAP));

export const SERVER_RENDER_CAPABILITIES = Object.freeze({
    // v4 (lot L3) : le mouvement photo est rendu avec la meme courbe et la meme
    // intensite que l'apercu. Ces deux drapeaux sont DECLARATIFS ; ce qui les
    // prouve est `scripts/smoke-vibecut-motion-preview-parity.mjs`, qui compare
    // un MP4 reel a l'apercu image par image.
    version: 4,
    mediaTypes: Object.freeze(['video', 'image']),
    imageMotions: Object.freeze(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'drift-up']),
    imageMotionEasing: Object.freeze(['ease-in-out']),
    imageMotionIntensity: true,
    transitions: Object.freeze(['cut', ...SERVER_TIMED_TRANSITION_IDS]),
    timedTransitions: SERVER_TIMED_TRANSITION_IDS,
    fitModes: Object.freeze(['cover', 'contain']),
    textAnimations: Object.freeze(['none', 'fade']),
    textStyles: Object.freeze(['none', 'box', 'outline']),
    audioFades: true,
    clipSpeeds: Object.freeze([1]),
    renderProfiles: Object.freeze(['browser-preview', 'server-cpu']),
});

export function isServerRenderCapabilitySupported(kind, value) {
    const capabilityMap = {
        transition: SERVER_RENDER_CAPABILITIES.transitions,
        timedTransition: SERVER_RENDER_CAPABILITIES.timedTransitions,
        fitMode: SERVER_RENDER_CAPABILITIES.fitModes,
        textAnimation: SERVER_RENDER_CAPABILITIES.textAnimations,
        textStyle: SERVER_RENDER_CAPABILITIES.textStyles,
        clipSpeed: SERVER_RENDER_CAPABILITIES.clipSpeeds,
        renderProfile: SERVER_RENDER_CAPABILITIES.renderProfiles,
        mediaType: SERVER_RENDER_CAPABILITIES.mediaTypes,
        imageMotion: SERVER_RENDER_CAPABILITIES.imageMotions,
    };
    const values = capabilityMap[kind] || [];
    if (kind === 'clipSpeed') {
        const speed = finiteNumber(value, 1);
        return values.some(candidate => Math.abs(candidate - speed) <= 0.001);
    }
    return values.includes(value);
}

export function getServerRenderCapabilityStatus(kind, value) {
    const supported = isServerRenderCapabilitySupported(kind, value);
    return {
        supported,
        status: supported ? 'ready' : 'preview-only',
        label: supported ? 'Export Pro' : 'Apercu uniquement',
    };
}

const SUPPORTED_SERVER_TRANSITIONS = new Set(SERVER_RENDER_CAPABILITIES.transitions);
const SERVER_XFADE_TRANSITIONS = new Set(SERVER_RENDER_CAPABILITIES.timedTransitions);
const SUPPORTED_SERVER_FIT_MODES = new Set(SERVER_RENDER_CAPABILITIES.fitModes);
const SUPPORTED_SERVER_TEXT_ANIMATIONS = new Set(SERVER_RENDER_CAPABILITIES.textAnimations);

function normalizeMediaType(source = {}) {
    if (source.mediaType === 'image' || source.mediaType === 'video') return source.mediaType;
    const mimeType = String(source.mimeType || source.type || source.file?.type || '').toLowerCase();
    return mimeType.startsWith('image/') ? 'image' : 'video';
}

function normalizeImageMotion(motion = 'none') {
    const presetName = typeof motion === 'string' ? motion : motion?.preset;
    const preset = SERVER_RENDER_CAPABILITIES.imageMotions.includes(presetName) ? presetName : 'none';
    const presetFrames = {
        none: [{ scale: 1, x: 0, y: 0 }, { scale: 1, x: 0, y: 0 }],
        'zoom-in': [{ scale: 1, x: 0, y: 0 }, { scale: 1.14, x: 0, y: 0 }],
        'zoom-out': [{ scale: 1.14, x: 0, y: 0 }, { scale: 1, x: 0, y: 0 }],
        'pan-left': [{ scale: 1.12, x: 0.055, y: 0 }, { scale: 1.12, x: -0.055, y: 0 }],
        'pan-right': [{ scale: 1.12, x: -0.055, y: 0 }, { scale: 1.12, x: 0.055, y: 0 }],
        'drift-up': [{ scale: 1.1, x: 0, y: 0.045 }, { scale: 1.14, x: 0, y: -0.045 }],
    }[preset];
    const custom = typeof motion === 'object' && motion ? motion : {};
    const normalizeFrame = (frame, fallback) => ({
        scale: clamp(finiteNumber(frame?.scale, fallback.scale), 1, 2),
        x: clamp(finiteNumber(frame?.x, fallback.x), -0.35, 0.35),
        y: clamp(finiteNumber(frame?.y, fallback.y), -0.35, 0.35),
    });
    return {
        preset,
        easing: custom.easing === 'linear' ? 'linear' : 'ease-in-out',
        /*
         * Intensite du mouvement (lot L3). Le renderer applique exactement le
         * meme facteur a l'ecart start -> end que `resolveImageMotionFrame`:
         * elle DOIT donc voyager dans le manifeste, sinon l'export rejouerait
         * un mouvement plein la ou l'apercu en montre un discret.
         */
        intensity: clamp(finiteNumber(custom.intensity, 1), 0, 1),
        start: normalizeFrame(custom.start, presetFrames[0]),
        end: normalizeFrame(custom.end, presetFrames[1]),
    };
}

function finiteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function isoNow(value = null) {
    return value || new Date().toISOString();
}

function compactObject(object = {}) {
    return Object.fromEntries(
        Object.entries(object).filter(([, value]) => value !== undefined)
    );
}

function sourceSizeBytes(source = {}) {
    return Math.max(0, Math.round(finiteNumber(source.sourceSizeBytes ?? source.size ?? source.file?.size, 0)));
}

function normalizeFilters(filters = {}) {
    return {
        ...DEFAULT_FILTERS,
        ...(filters || {}),
    };
}

function resolveLocalPreviewUrl(source = {}) {
    return source.localPreviewUrl || source.url || source.previewUrl || null;
}

function resolveStoragePath(source = {}) {
    return source.sourceStoragePath || source.storagePath || source.storage?.path || null;
}

function resolveSourceHash(source = {}) {
    const file = source.file || {};
    return [
        source.id || source.sourceId || '',
        source.name || file.name || '',
        file.size || source.size || '',
        file.lastModified || source.lastModified || '',
        resolveStoragePath(source) || resolveLocalPreviewUrl(source) || '',
    ].join(':');
}

export function resolveExportQualityPreset({ qualityMode = 'pro', width = 1920, height = 1080, fps = 30 } = {}) {
    const base = EXPORT_QUALITY_MODES[qualityMode] || EXPORT_QUALITY_MODES.pro;
    const pixels = Math.max(1, finiteNumber(width, 1920) * finiteNumber(height, 1080));
    const normalizedFps = clamp(Math.round(finiteNumber(fps, 30)), 1, 60);
    const bitsPerPixelFrame = base.id === 'master' ? 0.36 : base.id === 'preview' ? 0.16 : 0.26;
    const targetBitrate = Math.round(
        Math.min(base.maxVideoBitrate, Math.max(4_000_000, pixels * normalizedFps * bitsPerPixelFrame))
    );

    return {
        qualityMode: base.id,
        qualityLabel: base.label,
        crf: base.crf,
        preset: base.preset,
        targetBitrate,
        audioBitrate: base.audioBitrate,
        sizeMultiplier: base.sizeMultiplier,
    };
}

export function estimateExportSize(manifest = {}) {
    const duration = finiteNumber(manifest.project?.duration, 0);
    const videoBitrate = finiteNumber(manifest.render?.targetBitrate, 12_000_000);
    const audioBitrate = finiteNumber(manifest.render?.audioBitrate, 256_000);
    const sizeMultiplier = finiteNumber(manifest.render?.sizeMultiplier, 1);
    const bytes = Math.max(0, Math.round(((videoBitrate + audioBitrate) * duration / 8) * sizeMultiplier));

    return {
        bytes,
        megabytes: bytes / 1024 / 1024,
        label: `${(bytes / 1024 / 1024).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} Mo`,
    };
}

export function estimateExportDuration(manifest = {}) {
    const duration = finiteNumber(manifest.project?.duration, 0);
    const mode = manifest.render?.qualityMode || 'pro';
    const fps = finiteNumber(manifest.render?.fps, 30);
    const modeMultiplier = mode === 'master' ? 3.6 : mode === 'preview' ? 0.75 : mode === 'quickServer' ? 1.2 : 2.4;
    const fpsMultiplier = fps >= 60 ? 1.45 : 1;
    const seconds = Math.max(12, Math.round(duration * modeMultiplier * fpsMultiplier + 8));

    return {
        seconds,
        label: seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)} min`,
    };
}

export function estimateExportCost(manifest = {}, assumptions = EXPORT_COST_ASSUMPTIONS) {
    const renderSeconds = finiteNumber(manifest.estimates?.renderTime?.seconds, 0);
    const outputBytes = finiteNumber(manifest.estimates?.outputSize?.bytes, 0);
    const computeUsd = renderSeconds * (
        assumptions.cloudRunVcpu * assumptions.cpuSecondUsd +
        assumptions.cloudRunMemoryGib * assumptions.memoryGibSecondUsd
    );
    const storageUsdPerDay = outputBytes > 0
        ? (outputBytes / (1024 ** 3)) * assumptions.storageGibMonthUsd / 30
        : 0;
    const usd = computeUsd + storageUsdPerDay;
    const eur = usd * assumptions.usdToEur;

    return {
        renderSeconds,
        outputSizeBytes: outputBytes,
        usd,
        eur,
        label: eur > 0 ? `${eur.toFixed(eur >= 1 ? 2 : 4)} EUR est.` : '0 EUR est.',
    };
}

export function estimateSourceSize(manifest = {}) {
    const bytes = [
        ...(manifest.clips || []).map((clip) => finiteNumber(clip.metadata?.sourceSizeBytes ?? clip.sourceSizeBytes, 0)),
        ...(manifest.audioTracks || []).map((track) => finiteNumber(track.sourceSizeBytes, 0)),
    ].reduce((sum, value) => sum + value, 0);

    return {
        bytes,
        megabytes: bytes / 1024 / 1024,
        label: bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} Mo` : 'Inconnue',
    };
}

export function buildExportManifest({
    projectId = null,
    projectName = 'Untitled',
    userId = 'local-user',
    renderPlan = {},
    preset = {},
    sequencePreset = 'youtube',
    exportFps = 30,
    qualityMode = 'pro',
    fitMode = 'cover',
    renderSettings = {},
    rightsManifest = [],
    frameSchedule = null,
    generatedAt = null,
} = {}) {
    const width = Math.max(1, Math.round(finiteNumber(preset.width, 1920)));
    const height = Math.max(1, Math.round(finiteNumber(preset.height, 1080)));
    const fps = clamp(Math.round(finiteNumber(exportFps, preset.fps || 30)), 1, 60);
    const quality = resolveExportQualityPreset({ qualityMode, width, height, fps });
    const duration = finiteNumber(renderPlan.totalDuration ?? frameSchedule?.totalDuration, 0);
    const createdAt = isoNow(generatedAt);

    const clips = (renderPlan.clips || []).map((clip, index) => ({
        id: clip.id || `clip-${index + 1}`,
        sourceStoragePath: resolveStoragePath(clip),
        localPreviewUrl: resolveLocalPreviewUrl(clip),
        name: clip.name || clip.file?.name || `Clip ${index + 1}`,
        mediaType: normalizeMediaType(clip),
        mimeType: clip.mimeType || clip.type || clip.file?.type || null,
        assetId: clip.assetId || clip.id || null,
        startTime: finiteNumber(clip.start ?? clip.startTime, 0),
        duration: finiteNumber(clip.duration, 0),
        trimStart: finiteNumber(clip.trimStart, 0),
        trimEnd: finiteNumber(clip.trimEnd, clip.duration || 0),
        speed: finiteNumber(clip.speed, 1) || 1,
        volume: clamp(finiteNumber(clip.volume, 100), 0, 100),
        orientationRotation: finiteNumber(clip.orientationRotation, 0),
        crop: clip.crop || clip.params?.crop || null,
        fitMode: clip.fitMode || fitMode,
        filters: normalizeFilters(clip.filters || clip.params?.filters),
        motion: normalizeMediaType(clip) === 'image' ? normalizeImageMotion(clip.motion) : null,
        metadata: compactObject({
            width: clip.width,
            height: clip.height,
            displayWidth: clip.displayWidth,
            displayHeight: clip.displayHeight,
            sourceSizeBytes: sourceSizeBytes(clip),
            sourceFrameRate: clip.sourceFrameRate,
            importFrameRate: clip.importFrameRate,
            sourceFrameRateStatus: clip.sourceFrameRateStatus,
        }),
    }));

    const transitions = (renderPlan.allTransitions || []).map((transition) => ({
        id: transition.id,
        type: transition.type,
        startTime: finiteNumber(transition.start ?? transition.startTime, 0),
        duration: finiteNumber(transition.duration, 0),
        fromItemId: transition.fromItemId || null,
        toItemId: transition.toItemId || null,
        trackId: transition.trackId || null,
        params: transition.params || {},
    }));

    const textOverlays = (renderPlan.textOverlays || []).map((text) => ({
        id: text.id,
        content: text.content || '',
        startTime: finiteNumber(text.startTime, 0),
        endTime: finiteNumber(text.endTime, text.startTime || 0),
        x: finiteNumber(text.x, 0.5),
        y: finiteNumber(text.y, 0.5),
        font: text.font || 'Inter',
        fontSize: finiteNumber(text.fontSize, 48),
        color: text.color || '#ffffff',
        bold: text.bold === true,
        italic: text.italic === true,
        boxStyle: ['box', 'outline'].includes(text.boxStyle) ? text.boxStyle : 'none',
        boxColor: text.boxColor || '#000000',
        animation: text.animation || 'fade',
        animationOut: text.animationOut || 'fade',
        trackId: text.trackId || null,
    }));

    const audioTracks = (renderPlan.audioTracks || []).map((track, index) => ({
        id: track.id || `audio-${index + 1}`,
        sourceStoragePath: resolveStoragePath(track),
        localPreviewUrl: resolveLocalPreviewUrl(track),
        name: track.name || `Audio ${index + 1}`,
        startTime: finiteNumber(track.startTime ?? track.start, 0),
        duration: finiteNumber(track.duration, 0),
        trimStart: finiteNumber(track.trimStart, 0),
        trimEnd: finiteNumber(track.trimEnd, track.duration || 0),
        volume: clamp(finiteNumber(track.volume, 100), 0, 100),
        fadeIn: Math.max(0, finiteNumber(track.fadeIn, 0)),
        fadeOut: Math.max(0, finiteNumber(track.fadeOut, 0)),
        sourceSizeBytes: sourceSizeBytes(track),
        trackId: track.trackId || null,
        rightsId: track.rightsId || track.id || null,
    }));

    const manifest = {
        version: EXPORT_MANIFEST_VERSION,
        project: {
            id: projectId || `local-${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}`,
            name: projectName || 'Untitled',
            userId,
            duration,
            preset: sequencePreset,
            createdAt,
        },
        render: {
            width,
            height,
            fps,
            format: 'mp4',
            videoCodec: 'h264',
            audioCodec: 'aac',
            qualityMode: quality.qualityMode,
            qualityLabel: quality.qualityLabel,
            crf: quality.crf,
            preset: quality.preset,
            targetBitrate: quality.targetBitrate,
            audioBitrate: quality.audioBitrate,
            sizeMultiplier: quality.sizeMultiplier,
            fitMode,
            ...compactObject(renderSettings),
        },
        clips,
        transitions,
        textOverlays,
        audioTracks,
        rightsManifest,
        audit: {
            sourceHashes: [
                ...clips.map(resolveSourceHash),
                ...audioTracks.map(resolveSourceHash),
            ],
            engineVersion: EXPORT_ENGINE_VERSION,
            generatedAt: createdAt,
        },
    };

    const estimates = {
        outputSize: estimateExportSize(manifest),
        renderTime: estimateExportDuration(manifest),
    };
    const manifestWithEstimates = {
        ...manifest,
        estimates,
    };

    return {
        ...manifestWithEstimates,
        estimates: {
            ...estimates,
            sourceSize: estimateSourceSize(manifestWithEstimates),
            cost: estimateExportCost(manifestWithEstimates),
        },
    };
}

export function validateExportManifest(manifest = {}, { mode = 'localMock', allowClientUpload = false } = {}) {
    const errors = [];
    const warnings = [];
    const render = manifest.render || {};
    const duration = finiteNumber(manifest.project?.duration, 0);
    const clips = manifest.clips || [];

    if (manifest.version !== EXPORT_MANIFEST_VERSION) errors.push('Version de manifeste export non supportee.');
    if (!clips.length) errors.push('Aucun media dans le manifeste.');
    if (duration <= 0) errors.push('Duree projet invalide dans le manifeste.');
    if (finiteNumber(render.width, 0) <= 0 || finiteNumber(render.height, 0) <= 0) errors.push('Resolution export invalide.');
    if (finiteNumber(render.fps, 0) < 12 || finiteNumber(render.fps, 0) > 60) errors.push(`FPS export invalide: ${render.fps}.`);
    if (render.format !== 'mp4') errors.push('Le manifeste pro doit cibler un MP4.');
    if (render.videoCodec !== 'h264' || render.audioCodec !== 'aac') warnings.push('Codec non standard pour les reseaux sociaux.');

    clips.forEach((clip) => {
        const label = clip.name || clip.id || 'clip';
        if (!clip.sourceStoragePath && mode !== 'localMock' && !allowClientUpload) errors.push(`Source serveur manquante pour ${label}.`);
        if (!clip.sourceStoragePath && mode === 'localMock') warnings.push(`Source ${label} non uploadee: le mock local validera seulement le workflow.`);
        if (!clip.localPreviewUrl && !clip.sourceStoragePath) errors.push(`Source originale introuvable pour ${label}.`);
        if (finiteNumber(clip.duration, 0) <= 0) errors.push(`Duree clip invalide: ${label}.`);
        if (finiteNumber(clip.trimEnd, 0) <= finiteNumber(clip.trimStart, 0)) errors.push(`Trim clip invalide: ${label}.`);
        if (!SERVER_RENDER_CAPABILITIES.mediaTypes.includes(clip.mediaType || 'video')) errors.push(`Type media invalide: ${label}.`);
        if (clip.fitMode === 'fill') warnings.push(`Fit fill deformant actif sur ${label}.`);
    });

    (manifest.audioTracks || []).forEach((track) => {
        const label = track.name || track.id || 'audio';
        if (!track.sourceStoragePath && mode !== 'localMock' && !allowClientUpload) errors.push(`Source audio serveur manquante pour ${label}.`);
        if (!track.localPreviewUrl && !track.sourceStoragePath) errors.push(`Source audio introuvable pour ${label}.`);
    });

    (manifest.rightsManifest || []).forEach((rights) => {
        const label = rights.title || rights.trackName || rights.name || rights.id || 'audio';
        if (rights.socialUse === false) errors.push(`Droits sociaux non confirmes: ${label}.`);
        if (!rights.license) warnings.push(`Licence audio non documentee: ${label}.`);
    });

    return {
        errors: Array.from(new Set(errors)),
        warnings: Array.from(new Set(warnings)),
        status: errors.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'ready',
    };
}

export function validateExportRenderCoverage(manifest = {}) {
    const blockingErrors = [];
    const degradedWarnings = [];
    const supportedFeatures = [
        'video trims',
        'photo scenes with deterministic Ken Burns motion',
        'multi-clip concat',
        'adjacent fade/crossfade transitions',
        'cover/contain fit',
        'orientation rotation 90/180/270',
        'basic text overlays fade/none',
        'FFmpeg color filters',
        'source clip audio volume mix',
        'external audio trim/start/volume mix',
        'constant FPS',
        'H.264/AAC MP4 encode',
    ];
    const unsupportedFeatures = [];
    const clips = manifest.clips || [];

    validateServerTransitionCoverage(manifest.transitions || [], clips, {
        unsupportedFeatures,
        blockingErrors,
    });

    (manifest.textOverlays || []).forEach((text) => {
        const label = text.content || text.id || 'texte';
        if (!String(text.content || '').trim()) {
            unsupportedFeatures.push('textOverlays');
            blockingErrors.push(`Texte vide non rendu serveur: ${label}.`);
        }
        if (finiteNumber(text.endTime, 0) <= finiteNumber(text.startTime, 0)) {
            unsupportedFeatures.push('textOverlays');
            blockingErrors.push(`Timing texte invalide: ${label}.`);
        }
        if (!SUPPORTED_SERVER_TEXT_ANIMATIONS.has(text.animation || 'fade')) {
            unsupportedFeatures.push('textAnimation');
            blockingErrors.push(`Animation texte non rendue serveur: ${text.animation}. Utilise fade ou none.`);
        }
        if (!SUPPORTED_SERVER_TEXT_ANIMATIONS.has(text.animationOut || 'fade')) {
            unsupportedFeatures.push('textAnimationOut');
            blockingErrors.push(`Animation sortie texte non rendue serveur: ${text.animationOut}. Utilise fade ou none.`);
        }
    });

    clips.forEach((clip) => {
        const label = clip.name || clip.id || 'clip';
        const speed = finiteNumber(clip.speed, 1) || 1;
        if (Math.abs(speed - 1) > 0.001) {
            unsupportedFeatures.push('clipSpeed');
            blockingErrors.push(`Vitesse clip non rendue serveur: ${label}.`);
        }
        if (!SUPPORTED_SERVER_FIT_MODES.has(clip.fitMode || manifest.render?.fitMode || 'cover')) {
            unsupportedFeatures.push('fitMode');
            blockingErrors.push(`Fit non rendu serveur sans deformation garantie: ${label}. Utilise cover ou contain.`);
        }
        if ((clip.mediaType || 'video') === 'image') {
            const motionPreset = clip.motion?.preset || 'none';
            if (!SERVER_RENDER_CAPABILITIES.imageMotions.includes(motionPreset)) {
                unsupportedFeatures.push('imageMotion');
                blockingErrors.push(`Mouvement photo non rendu serveur: ${label}.${motionPreset}.`);
            }
        }
        const unsupportedFilter = Object.entries(clip.filters || {}).find(([key, value]) => DEFAULT_FILTERS[key] === undefined && finiteNumber(value, 0) !== 0);
        if (unsupportedFilter) {
            unsupportedFeatures.push('colorFilters');
            blockingErrors.push(`Filtre colorimetrie non supporte serveur: ${label}.${unsupportedFilter[0]}.`);
        }
    });

    if (!blockingErrors.length) {
        degradedWarnings.push('Renderer serveur actuel couvre videos et scenes photo Ken Burns + transitions fade/crossfade adjacentes + textes fade + colorimetrie FFmpeg + audio source/musique externe.');
    }

    return {
        supported: blockingErrors.length === 0,
        blockingErrors: Array.from(new Set(blockingErrors)),
        degradedWarnings: Array.from(new Set(degradedWarnings)),
        supportedFeatures,
        unsupportedFeatures: Array.from(new Set(unsupportedFeatures)),
    };
}

function validateServerTransitionCoverage(transitions = [], clips = [], { unsupportedFeatures, blockingErrors }) {
    const transitionList = Array.isArray(transitions) ? transitions : [];
    const clipList = Array.isArray(clips) ? clips : [];
    if (!transitionList.length) return;

    const adjacentPairs = new Set();
    for (let index = 0; index < clipList.length - 1; index += 1) {
        const fromId = clipList[index]?.id;
        const toId = clipList[index + 1]?.id;
        if (fromId && toId) adjacentPairs.add(`${fromId}->${toId}`);
    }

    transitionList.forEach((transition) => {
        const type = transition.type || 'transition';
        const duration = finiteNumber(transition.duration, 0);
        const pairKey = `${transition.fromItemId || ''}->${transition.toItemId || ''}`;
        const placement = transition.params?.placement;
        const isCutPlacement = placement === 'cut' || placement === undefined;

        if (!SUPPORTED_SERVER_TRANSITIONS.has(type)) {
            unsupportedFeatures.push(`transition:${type}`);
            blockingErrors.push(`Transition non rendue serveur: ${type}. Utilise cut, fade ou crossfade.`);
            return;
        }
        if (duration <= 0) return;
        if (!SERVER_XFADE_TRANSITIONS.has(type)) {
            unsupportedFeatures.push(`transition:${type}`);
            blockingErrors.push(`Transition non rendue serveur avec duree: ${type}. Utilise fade ou crossfade.`);
            return;
        }
        if (!isCutPlacement || !adjacentPairs.has(pairKey)) {
            unsupportedFeatures.push(`transition:${type}`);
            blockingErrors.push(`Transition ${type} non adjacente non rendue serveur: ${pairKey}.`);
        }
    });
}
