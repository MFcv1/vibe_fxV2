import { resolveActiveTransition } from '../model/timelineModel';
import {
    applyImageMotionTransform,
    DEFAULT_IMAGE_DURATION_SECONDS,
    drawImageAccent,
    isImageMedia,
    normalizeImageDuration,
} from '../model/mediaModel';
import { isXfadeTransition, renderXfadeTransition } from './xfadeTransitions';

/**
 * VideoEngine — Moteur video natif navigateur
 * <video> element pour le decode + Canvas pour le rendu
 */

export function isWebCodecsSupported() {
    return typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined';
}

export const SOCIAL_IMPORT_FPS = 30;
export const HIGH_FPS_IMPORT_THRESHOLD = 50;
export const MIN_MEDIA_DURATION_SECONDS = 1 / 120;
export const MAX_MEDIA_DURATION_SECONDS = 6 * 60 * 60;
export const MEDIA_DURATION_RESOLVE_TIMEOUT_MS = 4500;

export function normalizeMediaDuration(value, fallback = null) {
    const duration = Number(value);
    if (!Number.isFinite(duration)) return fallback;
    if (duration < MIN_MEDIA_DURATION_SECONDS || duration > MAX_MEDIA_DURATION_SECONDS) return fallback;
    return duration;
}

export async function resolveFiniteMediaDuration(
    video,
    { fileName = 'media', timeoutMs = MEDIA_DURATION_RESOLVE_TIMEOUT_MS } = {}
) {
    const immediateDuration = normalizeMediaDuration(video?.duration);
    if (immediateDuration !== null) return immediateDuration;

    const duration = await new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const events = ['durationchange', 'loadeddata', 'timeupdate', 'progress'];

        const finish = (value = null) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            events.forEach((eventName) => video?.removeEventListener?.(eventName, checkDuration));
            resolve(value);
        };
        const checkDuration = () => {
            const nextDuration = normalizeMediaDuration(video?.duration);
            if (nextDuration !== null) finish(nextDuration);
        };

        events.forEach((eventName) => video?.addEventListener?.(eventName, checkDuration));
        timer = setTimeout(() => finish(null), Math.max(250, Number(timeoutMs) || MEDIA_DURATION_RESOLVE_TIMEOUT_MS));

        // Some WebM files report Infinity until a far seek forces the browser to
        // parse the final cluster. The resolved value is still validated above.
        try {
            video.currentTime = Number.MAX_SAFE_INTEGER;
        } catch {
            // The timeout below converts an unsupported seek into a recoverable import error.
        }
        checkDuration();
    });

    if (duration === null) {
        const error = new Error(`Duree video illisible pour ${fileName}. Convertissez le fichier en MP4 H.264 ou WebM avec une duree explicite.`);
        error.code = 'media-duration-invalid';
        throw error;
    }

    try {
        video.currentTime = 0;
    } catch {
        // Reset is best effort; metadata remains usable even when the browser rejects it.
    }
    return duration;
}

export function loadVideoFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        let settled = false;
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        const fail = (error) => {
            if (settled) return;
            settled = true;
            URL.revokeObjectURL(url);
            reject(error);
        };

        video.onloadedmetadata = async () => {
            try {
                const duration = await resolveFiniteMediaDuration(video, { fileName: file.name });
                let frameRateInfo = { fps: null, rawFps: null, status: 'unavailable' };
                let displayMetadata = {
                    rotation: 0,
                    width: null,
                    height: null,
                    frameRate: null,
                    frameRateStatus: 'unavailable',
                    source: 'browser',
                };

                try {
                    [frameRateInfo, displayMetadata] = await Promise.all([
                        estimateVideoFrameRate(video),
                        readVideoDisplayMetadata(file),
                    ]);
                } catch (error) {
                    console.warn('Video metadata detection failed:', error);
                }

                const metadataFrameRate = Number.isFinite(displayMetadata.frameRate) ? displayMetadata.frameRate : null;
                const sourceFrameRate = metadataFrameRate || (Number.isFinite(frameRateInfo.fps) ? frameRateInfo.fps : null);
                const socialFpsNormalized = false;
                const orientationRotation = normalizeOrientationRotation(displayMetadata.rotation);
                const displaySize = getDisplaySizeFromRotation(
                    video.videoWidth,
                    video.videoHeight,
                    orientationRotation,
                    displayMetadata
                );

                settled = true;
                resolve({
                    file, url,
                    name: file.name,
                    duration,
                    width: video.videoWidth,
                    height: video.videoHeight,
                    displayWidth: displaySize.width,
                    displayHeight: displaySize.height,
                    orientationRotation,
                    orientationSource: displayMetadata.source,
                    type: file.type,
                    size: file.size,
                    sourceFrameRate,
                    sourceFrameRateRaw: Number.isFinite(frameRateInfo.rawFps) ? frameRateInfo.rawFps : null,
                    sourceFrameRateStatus: metadataFrameRate ? displayMetadata.frameRateStatus : frameRateInfo.status,
                    importFrameRate: sourceFrameRate,
                    importFrameRateMode: 'source',
                    socialFpsNormalized,
                    videoElement: video,
                });
            } catch (error) {
                fail(error);
            }
        };

        video.onerror = () => fail(new Error(`Impossible de charger: ${file.name}`));
        video.src = url;
    });
}

export function loadImageFile(file, { duration = DEFAULT_IMAGE_DURATION_SECONDS } = {}) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        let settled = false;

        const fail = (error) => {
            if (settled) return;
            settled = true;
            URL.revokeObjectURL(url);
            reject(error);
        };
        const succeed = () => {
            if (settled) return;
            const width = Number(image.naturalWidth || image.width || 0);
            const height = Number(image.naturalHeight || image.height || 0);
            if (!width || !height) {
                fail(new Error(`Dimensions image illisibles pour ${file.name}.`));
                return;
            }
            settled = true;
            resolve({
                file,
                url,
                name: file.name,
                duration: normalizeImageDuration(duration),
                width,
                height,
                displayWidth: width,
                displayHeight: height,
                orientationRotation: 0,
                orientationSource: 'browser-image',
                mediaType: 'image',
                type: file.type,
                size: file.size,
                imageElement: image,
            });
        };

        image.onload = succeed;
        image.onerror = () => fail(new Error(`Impossible de charger l'image: ${file.name}`));
        image.src = url;
        image.decode?.().then(succeed).catch(() => {
            // onload remains the compatibility fallback for browsers without decode support.
        });
    });
}

async function readVideoDisplayMetadata(file) {
    if (!file || !/\.mp4$/i.test(file.name || '')) {
        return { rotation: 0, width: null, height: null, frameRate: null, frameRateStatus: 'unavailable', source: 'browser' };
    }

    try {
        const firstChunkSize = Math.min(file.size, 4 * 1024 * 1024);
        const firstChunk = await file.slice(0, firstChunkSize).arrayBuffer();
        const parsedChunk = parseMp4DisplayMetadata(firstChunk);
        if (parsedChunk.source === 'mp4-tkhd') return parsedChunk;

        if (file.size <= 256 * 1024 * 1024 && file.size > firstChunkSize) {
            return parseMp4DisplayMetadata(await file.arrayBuffer());
        }
    } catch (error) {
        console.warn('MP4 display metadata parse failed:', error);
    }

    return { rotation: 0, width: null, height: null, frameRate: null, frameRateStatus: 'unavailable', source: 'browser' };
}

function parseMp4DisplayMetadata(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const decoder = new TextDecoder('ascii');
    const readType = (offset) => decoder.decode(new Uint8Array(arrayBuffer, offset, 4));
    const readFixed16 = (offset) => view.getInt32(offset, false) / 65536;
    const readUnsignedFixed16 = (offset) => view.getUint32(offset, false) / 65536;

    const readBoxes = (start, end) => {
        const boxes = [];
        let offset = start;
        while (offset + 8 <= end) {
            let size = view.getUint32(offset, false);
            const type = readType(offset + 4);
            let header = 8;
            if (size === 1 && offset + 16 <= end) {
                size = Number(view.getBigUint64(offset + 8, false));
                header = 16;
            } else if (size === 0) {
                size = end - offset;
            }
            if (!size || !Number.isFinite(size) || size < header || offset + size > end) break;
            boxes.push({ type, start: offset, end: offset + size, header });
            offset += size;
        }
        return boxes;
    };

    const children = (box) => readBoxes(box.start + box.header, box.end);
    const rootBoxes = readBoxes(0, arrayBuffer.byteLength);
    const moov = rootBoxes.find((box) => box.type === 'moov');
    if (!moov) return { rotation: 0, width: null, height: null, source: 'browser' };

    for (const trak of children(moov).filter((box) => box.type === 'trak')) {
        const trakChildren = children(trak);
        const mdia = trakChildren.find((box) => box.type === 'mdia');
        const hdlr = mdia ? children(mdia).find((box) => box.type === 'hdlr') : null;
        const handlerType = hdlr && hdlr.start + hdlr.header + 12 <= hdlr.end
            ? readType(hdlr.start + hdlr.header + 8)
            : '';
        if (handlerType && handlerType !== 'vide') continue;

        const tkhd = trakChildren.find((box) => box.type === 'tkhd');
        if (!tkhd) continue;
        const content = tkhd.start + tkhd.header;
        const version = view.getUint8(content);
        const matrixOffset = version === 1 ? content + 52 : content + 40;
        if (matrixOffset + 44 > tkhd.end) continue;

        const a = readFixed16(matrixOffset);
        const b = readFixed16(matrixOffset + 4);
        const c = readFixed16(matrixOffset + 12);
        const d = readFixed16(matrixOffset + 16);
        const width = readUnsignedFixed16(matrixOffset + 36);
        const height = readUnsignedFixed16(matrixOffset + 40);
        const frameRateInfo = readMp4FrameRate(children, mdia, view);
        let rotation = 0;

        if (Math.abs(a) < 0.01 && Math.abs(d) < 0.01 && Math.abs(b) > 0.9 && Math.abs(c) > 0.9) {
            rotation = b > 0 && c < 0 ? 90 : 270;
        } else if (a < -0.9 && d < -0.9) {
            rotation = 180;
        }

        return { rotation, width, height, ...frameRateInfo, source: 'mp4-tkhd' };
    }

    return { rotation: 0, width: null, height: null, frameRate: null, frameRateStatus: 'unavailable', source: 'browser' };
}

function readMp4FrameRate(children, mdia, view) {
    if (!mdia) return { frameRate: null, frameRateStatus: 'unavailable' };
    const mdiaChildren = children(mdia);
    const mdhd = mdiaChildren.find((box) => box.type === 'mdhd');
    const minf = mdiaChildren.find((box) => box.type === 'minf');
    const stbl = minf ? children(minf).find((box) => box.type === 'stbl') : null;
    const stts = stbl ? children(stbl).find((box) => box.type === 'stts') : null;
    if (!mdhd || !stts) return { frameRate: null, frameRateStatus: 'unavailable' };
    return readMp4FrameRateFromBoxes(mdhd, stts, view);
}

function readMp4FrameRateFromBoxes(mdhd, stts, view) {
    const content = mdhd.start + mdhd.header;
    const version = view.getUint8(content);
    const timescale = version === 1 ? view.getUint32(content + 20, false) : view.getUint32(content + 12, false);
    const duration = version === 1 ? Number(view.getBigUint64(content + 24, false)) : view.getUint32(content + 16, false);
    const timelineSeconds = timescale > 0 ? duration / timescale : 0;
    if (!timelineSeconds) return { frameRate: null, frameRateStatus: 'unavailable' };

    const sttsContent = stts.start + stts.header;
    const entryCount = view.getUint32(sttsContent + 4, false);
    let sampleCount = 0;
    let offset = sttsContent + 8;
    for (let index = 0; index < entryCount && offset + 8 <= stts.end; index += 1) {
        sampleCount += view.getUint32(offset, false);
        offset += 8;
    }
    if (!sampleCount) return { frameRate: null, frameRateStatus: 'unavailable' };

    const fps = normalizeDetectedFrameRate(sampleCount / timelineSeconds);
    return {
        frameRate: fps,
        frameRateStatus: fps ? (entryCount === 1 ? 'metadata-cfr' : 'metadata-average') : 'unavailable',
    };
}

export function normalizeOrientationRotation(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return ((Math.round(numeric / 90) * 90) % 360 + 360) % 360;
}

function getDisplaySizeFromRotation(width, height, rotation, metadata = {}) {
    const rawWidth = Number(width) || Number(metadata.width) || 0;
    const rawHeight = Number(height) || Number(metadata.height) || 0;
    const metaWidth = Number(metadata.width);
    const metaHeight = Number(metadata.height);
    if (Number.isFinite(metaWidth) && metaWidth > 0 && Number.isFinite(metaHeight) && metaHeight > 0) {
        return { width: metaWidth, height: metaHeight };
    }
    return rotation === 90 || rotation === 270
        ? { width: rawHeight, height: rawWidth }
        : { width: rawWidth, height: rawHeight };
}

export async function estimateVideoFrameRate(video, options = {}) {
    if (!video || typeof video.requestVideoFrameCallback !== 'function') {
        return { fps: null, rawFps: null, status: 'unsupported', sampleFrames: 0, sampleSeconds: 0 };
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const sampleSeconds = Math.min(options.sampleSeconds || 0.42, Math.max(0.18, duration - 0.08 || 0.42));
    const timeoutMs = options.timeoutMs || 1100;
    const originalTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const originalMuted = video.muted;
    const wasPaused = video.paused;

    let timer = null;
    let callbackId = null;
    let done = false;

    const finishSeek = () => new Promise((resolve) => {
        const timeout = window.setTimeout(resolve, 240);
        video.onseeked = () => {
            window.clearTimeout(timeout);
            resolve();
        };
    });

    const finish = async (status, resolve, frames, firstMediaTime, lastMediaTime) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        if (callbackId && typeof video.cancelVideoFrameCallback === 'function') {
            video.cancelVideoFrameCallback(callbackId);
        }
        video.pause();
        const measuredSeconds = Math.max(0, (lastMediaTime ?? 0) - (firstMediaTime ?? 0));
        const rawFps = frames > 1 && measuredSeconds > 0 ? (frames - 1) / measuredSeconds : null;
        const fps = normalizeDetectedFrameRate(rawFps);

        if (Number.isFinite(originalTime) && Number.isFinite(video.duration)) {
            try {
                video.currentTime = Math.min(originalTime, Math.max(0, video.duration - 0.05));
            } catch {
                // Best-effort restore only; import metadata must not fail on seek quirks.
            }
        }
        video.muted = originalMuted;
        if (!wasPaused) {
            try {
                await video.play();
            } catch {
                video.pause();
            }
        }

        resolve({
            fps,
            rawFps,
            status: fps ? status : 'unavailable',
            sampleFrames: frames,
            sampleSeconds: measuredSeconds,
        });
    };

    video.muted = true;
    video.playsInline = true;

    if (duration > sampleSeconds + 0.1) {
        video.currentTime = Math.min(Math.max(0, duration * 0.04), Math.max(0, duration - sampleSeconds - 0.08));
        await finishSeek();
    }

    return new Promise((resolve) => {
        let frames = 0;
        let firstMediaTime = null;
        let lastMediaTime = null;
        let previousMediaTime = null;

        const onFrame = (_now, metadata = {}) => {
            if (done) return;
            const mediaTime = Number.isFinite(metadata.mediaTime) ? metadata.mediaTime : video.currentTime;
            if (previousMediaTime !== null && Math.abs(mediaTime - previousMediaTime) < 0.0005) {
                callbackId = video.requestVideoFrameCallback(onFrame);
                return;
            }
            previousMediaTime = mediaTime;
            frames += 1;
            if (firstMediaTime === null) firstMediaTime = mediaTime;
            lastMediaTime = mediaTime;

            if ((lastMediaTime - firstMediaTime) >= sampleSeconds || frames >= 36) {
                finish('estimated', resolve, frames, firstMediaTime, lastMediaTime);
                return;
            }
            callbackId = video.requestVideoFrameCallback(onFrame);
        };

        callbackId = video.requestVideoFrameCallback(onFrame);
        timer = window.setTimeout(() => finish(frames > 1 ? 'estimated' : 'timeout', resolve, frames, firstMediaTime, lastMediaTime), timeoutMs);
        video.play().catch(() => finish('blocked', resolve, frames, firstMediaTime, lastMediaTime));
    });
}

function normalizeDetectedFrameRate(rawFps) {
    if (!Number.isFinite(rawFps) || rawFps <= 0) return null;
    if (rawFps >= 55 && rawFps <= 66) return 60;
    if (rawFps >= 47 && rawFps < 55) return 50;
    if (rawFps >= 28 && rawFps <= 32) return 30;
    if (rawFps >= 23 && rawFps <= 25.5) return 24;
    return Math.round(rawFps);
}

export async function extractThumbnails(videoUrl, duration, count = 8, thumbHeight = 60, displayMetadata = {}) {
    const safeDuration = normalizeMediaDuration(duration);
    if (safeDuration === null) {
        const error = new Error('Extraction des miniatures ignoree: duree media invalide.');
        error.code = 'media-duration-invalid';
        throw error;
    }
    const safeCount = Math.max(1, Math.min(24, Math.round(Number(count) || 8)));
    const safeThumbHeight = Math.max(24, Math.min(320, Math.round(Number(thumbHeight) || 60)));
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = reject;
    });

    const rotation = normalizeOrientationRotation(displayMetadata.orientationRotation ?? displayMetadata.rotation);
    const displaySize = getDisplaySizeFromRotation(video.videoWidth, video.videoHeight, rotation, {
        width: displayMetadata.displayWidth,
        height: displayMetadata.displayHeight,
    });
    const aspect = displaySize.width && displaySize.height
        ? displaySize.width / displaySize.height
        : video.videoWidth / video.videoHeight;
    const thumbWidth = Math.max(1, Math.round(safeThumbHeight * (Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9)));

    const canvas = document.createElement('canvas');
    canvas.width = thumbWidth;
    canvas.height = safeThumbHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Extraction des miniatures indisponible: canvas non initialise.');

    const thumbnails = [];
    const interval = safeDuration / safeCount;

    for (let i = 0; i < safeCount; i++) {
        const time = i * interval + interval / 2;
        video.currentTime = Math.max(0, Math.min(time, Math.max(0, safeDuration - 0.1)));
        await waitForVideoSeek(video);
        drawSourceCover(ctx, video, thumbWidth, safeThumbHeight, displayMetadata);
        thumbnails.push(canvas.toDataURL('image/jpeg', 0.6));
    }

    return thumbnails;
}

function waitForVideoSeek(video, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
        let timer = null;
        const cleanup = () => {
            if (timer) clearTimeout(timer);
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('error', handleError);
        };
        const handleSeeked = () => {
            cleanup();
            resolve();
        };
        const handleError = () => {
            cleanup();
            reject(new Error('Impossible de lire une frame pour la miniature.'));
        };
        video.addEventListener('seeked', handleSeeked, { once: true });
        video.addEventListener('error', handleError, { once: true });
        timer = setTimeout(() => {
            cleanup();
            reject(new Error('Delai depasse pendant la creation des miniatures.'));
        }, timeoutMs);
    });
}

export async function extractFrame(videoUrl, time, width, height) {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = reject;
    });

    video.currentTime = time;
    await new Promise((resolve) => { video.onseeked = resolve; });

    const canvas = document.createElement('canvas');
    canvas.width = width || video.videoWidth;
    canvas.height = height || video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas;
}

export function createVideoPlayer(url) {
    const video = document.createElement('video');
    video.src = url;
    video.muted = false;
    video.preload = 'auto';
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    return video;
}

// === TRANSITION RENDERING ===

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
    return t * t * t;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/*
 * Volume effectif d'une piste audio a un instant donne, fondus compris.
 * Le meme calcul est reproduit cote serveur par `afade`, pour que l'apercu et
 * l'export sonnent pareil.
 */
function resolveAudioFadeVolume(track = {}, globalTime = 0) {
    const base = clampMediaVolume(track.volume ?? 100);
    const start = Number(track.startTime) || 0;
    const end = Number(track.endTime) || start + (Number(track.duration) || 0);
    const span = Math.max(0.001, end - start);
    const fadeIn = Math.max(0, Math.min(Number(track.fadeIn) || 0, span / 2));
    const fadeOut = Math.max(0, Math.min(Number(track.fadeOut) || 0, span / 2));
    const elapsed = globalTime - start;
    let factor = 1;
    if (fadeIn > 0 && elapsed < fadeIn) factor = Math.max(0, elapsed / fadeIn);
    if (fadeOut > 0 && elapsed > span - fadeOut) {
        factor = Math.min(factor, Math.max(0, (span - elapsed) / fadeOut));
    }
    return base * factor;
}

function clampMediaVolume(volume = 100) {
    return clamp((Number(volume) || 0) / 100, 0, 1);
}

function configureCanvasQuality(ctx) {
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
}

function deterministicUnit(seed) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

function normalizeFilters(filters = {}) {
    return {
        exposure: clamp(filters.exposure ?? 0, -100, 100),
        brightness: clamp(filters.brightness ?? 100, 0, 200),
        contrast: clamp(filters.contrast ?? 100, 0, 200),
        pivot: clamp(filters.pivot ?? 50, 0, 100),
        saturation: clamp(filters.saturation ?? 100, 0, 200),
        vibrance: clamp(filters.vibrance ?? 0, -100, 100),
        temperature: clamp(filters.temperature ?? 0, -100, 100),
        tint: clamp(filters.tint ?? 0, -100, 100),
        hue: clamp(filters.hue ?? 0, -180, 180),
        shadows: clamp(filters.shadows ?? 0, -100, 100),
        midtones: clamp(filters.midtones ?? 0, -100, 100),
        highlights: clamp(filters.highlights ?? 0, -100, 100),
        fade: clamp(filters.fade ?? 0, 0, 100),
        vignette: clamp(filters.vignette ?? 0, 0, 100),
        grain: clamp(filters.grain ?? 0, 0, 100),
    };
}

function buildFilterString(filters = {}) {
    const grade = normalizeFilters(filters);
    const exposureMultiplier = Math.pow(2, grade.exposure / 100);
    const pivotCompensation = 100 + ((50 - grade.pivot) * Math.max(0, grade.contrast - 100) * 0.018);
    const brightness = clamp(grade.brightness * exposureMultiplier * (pivotCompensation / 100), 0, 260);
    const saturation = clamp(grade.saturation + grade.vibrance * 0.58, 0, 260);
    return [
        `brightness(${brightness.toFixed(2)}%)`,
        `contrast(${grade.contrast}%)`,
        `saturate(${saturation.toFixed(2)}%)`,
        `hue-rotate(${grade.hue}deg)`,
    ].join(' ');
}

function fillGradeOverlay(ctx, color, alpha, composite = 'soft-light') {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = composite;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
}

function applyRangeAdjustment(ctx, value = 0, positiveColor = '#ffffff', negativeColor = '#000000', maxAlpha = 0.18, composite = 'soft-light') {
    const amount = clamp(value, -100, 100);
    if (amount === 0) return;
    fillGradeOverlay(
        ctx,
        amount > 0 ? positiveColor : negativeColor,
        Math.min(maxAlpha, Math.abs(amount) / 100 * maxAlpha),
        composite
    );
}

function applyPostFilters(ctx, filters = {}, w, h) {
    const grade = normalizeFilters(filters);
    const fade = grade.fade;
    if (fade > 0) {
        fillGradeOverlay(ctx, '#d8c7ad', Math.min(0.26, fade / 220), 'screen');
        fillGradeOverlay(ctx, '#111111', Math.min(0.12, fade / 520), 'source-over');
    }

    const temperature = grade.temperature;
    if (temperature !== 0) {
        fillGradeOverlay(
            ctx,
            temperature > 0 ? '#ffb36b' : '#5ea8ff',
            Math.min(0.28, Math.abs(temperature) / 260),
            temperature > 0 ? 'soft-light' : 'screen'
        );
    }

    const tint = grade.tint;
    if (tint !== 0) {
        fillGradeOverlay(
            ctx,
            tint > 0 ? '#d76bff' : '#5dff94',
            Math.min(0.20, Math.abs(tint) / 360),
            'soft-light'
        );
    }

    applyRangeAdjustment(ctx, grade.shadows, '#f7f2e8', '#050505', 0.18, grade.shadows > 0 ? 'screen' : 'multiply');
    applyRangeAdjustment(ctx, grade.midtones, '#f0f2ff', '#1b1825', 0.13, 'soft-light');
    applyRangeAdjustment(ctx, grade.highlights, '#ffffff', '#1b2430', 0.16, grade.highlights > 0 ? 'screen' : 'multiply');

    const vignette = grade.vignette;
    if (vignette > 0) {
        ctx.save();
        const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.72);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${vignette / 130})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    const grain = grade.grain;
    if (grain > 0) {
        ctx.save();
        ctx.globalAlpha = grain / 650;
        ctx.fillStyle = '#ffffff';
        const count = Math.round((w * h / 9000) * (grain / 20));
        for (let i = 0; i < count; i += 1) {
            ctx.fillRect(deterministicUnit(i + w * 0.13) * w, deterministicUnit(i + h * 0.17) * h, 1, 1);
        }
        ctx.restore();
    }
}

function drawSourceCover(ctx, source, w, h, clip = {}) {
    configureCanvasQuality(ctx);
    const sourceWidth = source?.videoWidth || source?.naturalWidth || source?.width || w;
    const sourceHeight = source?.videoHeight || source?.naturalHeight || source?.height || h;
    const rotation = normalizeOrientationRotation(clip?.orientationRotation ?? clip?.rotation);

    if (!sourceWidth || !sourceHeight || !Number.isFinite(sourceWidth / sourceHeight)) {
        ctx.drawImage(source, 0, 0, w, h);
        return;
    }

    if (rotation) {
        const displayWidth = rotation === 90 || rotation === 270 ? sourceHeight : sourceWidth;
        const displayHeight = rotation === 90 || rotation === 270 ? sourceWidth : sourceHeight;
        const scale = Math.max(w / displayWidth, h / displayHeight);
        const dx = (w - displayWidth * scale) / 2;
        const dy = (h - displayHeight * scale) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();

        if (rotation === 90) {
            ctx.translate(dx + displayWidth * scale, dy);
            ctx.rotate(Math.PI / 2);
        } else if (rotation === 180) {
            ctx.translate(dx + displayWidth * scale, dy + displayHeight * scale);
            ctx.rotate(Math.PI);
        } else {
            ctx.translate(dx, dy + displayHeight * scale);
            ctx.rotate(-Math.PI / 2);
        }
        ctx.scale(scale, scale);
        ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight);
        ctx.restore();
        return;
    }

    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = w / h;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (sourceAspect > targetAspect) {
        sw = sourceHeight * targetAspect;
        sx = (sourceWidth - sw) / 2;
    } else if (sourceAspect < targetAspect) {
        sh = sourceWidth / targetAspect;
        sy = (sourceHeight - sh) / 2;
    }

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
}

function getClipVisualDuration(clip = {}) {
    const trimStart = Number(clip.trimStart || 0);
    const trimEnd = Number(clip.trimEnd ?? clip.duration ?? trimStart);
    return Math.max(0.001, trimEnd - trimStart);
}

function getClipVisualProgress(clip = {}, localTime = 0) {
    const trimStart = Number(clip.trimStart || 0);
    const trimEnd = Number(clip.trimEnd ?? clip.duration ?? trimStart);
    const duration = Math.max(0.001, trimEnd - trimStart);
    return clamp((Number(localTime || 0) - trimStart) / duration, 0, 1);
}

function drawFilteredSource(ctx, source, clip, w, h, localTime = 0) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.filter = buildFilterString(clip?.filters);
    /*
     * Transformation posee par `mediaModel.applyImageMotionTransform`: c'est
     * elle que `smoke-vibecut-motion-preview-parity` compare au rendu FFmpeg.
     *
     * LOT B3 - elle s'applique aussi aux VIDEOS. Elle etait reservee aux photos
     * par un `isImageMedia` dont rien ne justifiait la presence: la
     * transformation est un simple recadrage anime, et `getClipVisualProgress`
     * mesure la course sur le segment rogne, ce qui vaut pour n'importe quel
     * media. Cote export, `zoompan` sur une entree video a ete mesure au lot
     * B3b - pas de gel, aucune image dupliquee, compteur `on` exact a l'image
     * pres. Le verrou n'attendait donc plus que d'etre leve.
     */
    /*
     * La DUREE du plan est passee pour les accents (secousse, respiration):
     * leur frequence est en hertz, donc ils ont besoin du temps ecoule et pas
     * seulement de la progression. Sans accent, elle n'a aucun effet.
     */
    applyImageMotionTransform(
        ctx,
        clip.motion,
        getClipVisualProgress(clip, localTime),
        w,
        h,
        getClipVisualDuration(clip),
    );
    drawSourceCover(ctx, source, w, h, clip);
    ctx.restore();
    /*
     * Les calques d'accent (halo, grain) sont poses HORS du recadrage et avant
     * les filtres de plan, exactement comme le renderer les pose apres son
     * `zoompan`. Les poser a l'interieur les ferait zoomer avec l'image.
     */
    drawImageAccent(
        ctx,
        clip.motion,
        getClipVisualProgress(clip, localTime),
        w,
        h,
        getClipVisualDuration(clip),
    );
    applyPostFilters(ctx, clip?.filters, w, h);
}

function makeFilteredFrame(source, clip, w, h, localTime = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    drawFilteredSource(ctx, source, clip, w, h, localTime);
    return canvas;
}

function drawScaledFrame(ctx, source, w, h, scale = 1, alpha = 1, rotation = 0) {
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
    ctx.restore();
}

function drawTransitionLabel(ctx, text, w, h, alpha = 1) {
    const fontSize = Math.max(18, Math.round(w * 0.042));
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0px';
    ctx.shadowColor = 'rgba(0,229,255,0.55)';
    ctx.shadowBlur = Math.round(fontSize * 0.55);
    ctx.fillStyle = '#f8f7ff';
    ctx.fillText(text, w / 2, h / 2);
    ctx.font = `500 ${Math.max(10, Math.round(fontSize * 0.28))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.shadowBlur = Math.round(fontSize * 0.25);
    ctx.fillStyle = 'rgba(0,229,255,0.9)';
    ctx.fillText('VIBE_CUT SEQUENCE', w / 2, h / 2 + fontSize * 0.78);
    ctx.restore();
}

function drawScanlines(ctx, w, h, alpha = 0.16, offset = 0) {
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let y = -6 + (offset % 12); y < h; y += 12) {
        ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
}

function drawSweepLine(ctx, w, h, position, color = 'rgba(0,229,255,0.85)') {
    ctx.save();
    const x = clamp(position, 0, 1) * w;
    const gradient = ctx.createLinearGradient(x - w * 0.08, 0, x + w * 0.08, 0);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.48, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillRect(x - w * 0.08, 0, w * 0.16, h);
    ctx.restore();
}

function getActiveTimelineTransition(transitionItems = [], globalTime) {
    /*
     * Les BORDS DE SEQUENCE sont exclus: ils ne joignent pas deux plans, ils
     * joignent un plan et le NOIR. Les laisser passer ici ferait rendre une
     * transition du dernier plan vers lui-meme, donc rien du tout.
     */
    return resolveActiveTransition(
        transitionItems.filter((transition) => {
            const placement = transition?.params?.placement || 'free';
            return placement !== 'cut' && placement !== 'intro' && placement !== 'outro';
        }),
        globalTime
    );
}

/* Le calque noir des bords de sequence, fabrique a la demande. */
function makeBlackFrame(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    return canvas;
}

/* Le bord actif a cet instant, ou null. */
function findSequenceEdgeAt(transitionItems = [], globalTime = 0, slot = null) {
    for (const item of transitionItems) {
        const placement = item?.params?.placement;
        if (placement !== 'intro' && placement !== 'outro') continue;
        if (slot && placement !== slot) continue;
        const start = Number(item.start ?? item.startTime ?? 0);
        const duration = Math.max(0.1, Number(item.duration) || 0.5);
        if (globalTime < start - 0.001 || globalTime > start + duration + 0.001) continue;
        return { item, placement, start, duration };
    }
    return null;
}

function getTransitionStart(transition) {
    return transition?.start ?? transition?.startTime ?? 0;
}

function hasResolvedVideoTiming(clips = []) {
    return clips.length > 0 && clips.every(clip => Number.isFinite(Number(clip.start ?? clip.startTime)) && Number.isFinite(Number(clip.duration)));
}

function getResolvedClipStart(clip) {
    return Number(clip.start ?? clip.startTime ?? 0);
}

function getResolvedClipDuration(clip) {
    return Math.max(0, Number(clip.duration) || 0);
}

function getTransitionEnd(transition) {
    const start = getTransitionStart(transition);
    const duration = Math.max(0, Number(transition?.duration) || 0);
    return start + duration;
}

function getCutTransitionBetween(transitionItems = [], fromId, toId) {
    if (!fromId || !toId) return null;
    return transitionItems.find((transition) => (
        transition?.fromItemId === fromId
        && transition?.toItemId === toId
        && (transition?.params?.placement === 'cut' || transition?.params?.placement === undefined)
    )) || null;
}

function getLegacyTransitionBetween(transitions = {}, fromId, toId, fallbackStart = 0) {
    const transition = transitions?.[`${fromId}->${toId}`];
    if (!transition) return null;
    const duration = Math.max(0, Number(transition.duration) || 0);
    return {
        ...transition,
        start: Number.isFinite(Number(transition.start ?? transition.startTime))
            ? Number(transition.start ?? transition.startTime)
            : fallbackStart,
        duration,
        fromItemId: fromId,
        toItemId: toId,
        params: {
            ...(transition.params || {}),
            placement: 'cut',
        },
    };
}

function getClipPlaybackDuration(clip) {
    const speed = Number(clip.speed) || 1;
    return Math.max(0, ((Number(clip.trimEnd) || 0) - (Number(clip.trimStart) || 0)) / speed);
}

function getClipLocalTime(clip, globalTime, timelineStart) {
    const speed = Number(clip.speed) || 1;
    const trimStart = Number(clip.trimStart) || 0;
    const trimEnd = Number.isFinite(Number(clip.trimEnd)) ? Number(clip.trimEnd) : trimStart;
    return clamp(trimStart + (globalTime - timelineStart) * speed, trimStart, Math.max(trimStart, trimEnd));
}

function getResolvedActiveClipAtTime(clips = [], transitions = {}, globalTime = 0, transitionItems = []) {
    const ordered = clips
        .map((clip, index) => ({
            clip,
            index,
            start: getResolvedClipStart(clip),
            duration: getResolvedClipDuration(clip),
        }))
        .map(item => ({ ...item, end: item.start + item.duration }))
        .sort((a, b) => a.start - b.start || a.index - b.index);

    for (let i = 0; i < ordered.length; i += 1) {
        const current = ordered[i];
        const next = ordered[i + 1];
        if (globalTime < current.start || globalTime >= current.end) continue;

        const canonicalTransition = next ? getCutTransitionBetween(transitionItems, current.clip.id, next.clip.id) : null;
        const transition = canonicalTransition || (
            next ? getLegacyTransitionBetween(transitions, current.clip.id, next.clip.id, next.start) : null
        );
        const transitionDur = Math.max(0, transition?.duration || 0);
        const transitionStart = transition && transitionDur > 0 && canonicalTransition
            ? clamp(getTransitionStart(transition), current.start, current.end)
            : transition && transitionDur > 0
                ? clamp(next?.start ?? current.end - transitionDur, current.start, current.end)
                : current.end;
        const transitionEnd = transition && transitionDur > 0
            ? Math.min(current.end, getTransitionEnd({ ...transition, start: transitionStart, duration: transitionDur }))
            : current.end;
        const inTransition = transition && transitionDur > 0 && globalTime >= transitionStart && globalTime <= transitionEnd;

        return {
            clip: current.clip,
            localTime: getClipLocalTime(current.clip, globalTime, current.start),
            transitionProgress: inTransition ? clamp((globalTime - transitionStart) / transitionDur, 0, 1) : -1,
            transition: inTransition ? transition : null,
            nextClip: inTransition ? next?.clip : null,
        };
    }

    return null;
}

/**
 * Renders a transition between two frames on the canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLVideoElement} fromPlayer - outgoing clip
 * @param {HTMLVideoElement} toPlayer - incoming clip
 * @param {number} progress - 0 to 1
 * @param {string} type - transition type id
 * @param {number} w - canvas width
 * @param {number} h - canvas height
 */
/*
 * Exportee depuis la phase 5: la bibliotheque de transitions (`/video/transitions`)
 * dessine ses apercus avec CETTE fonction, pas avec une imitation CSS. Une carte
 * de la bibliotheque montre donc exactement ce que l'apercu du montage jouera -
 * et, pour les transitions minutees (15 au lot L1, 33 depuis le lot B3a), ce
 * que l'export rendra.
 * Aucun changement de comportement: seule la visibilite du symbole change.
 */
export function renderTransition(ctx, fromPlayer, toPlayer, progress, type, w, h) {
    /*
     * Les transitions exportables passent par leur implementation calquee sur le
     * filtre `xfade` de FFmpeg, avec une progression LINEAIRE : c'est ce que le
     * serveur rend. Les autres gardent l'accelere/decelere historique — elles
     * restent « apercu uniquement ».
     */
    if (isXfadeTransition(type)) {
        renderXfadeTransition(ctx, fromPlayer, toPlayer, progress, type, w, h);
        return;
    }

    const p = easeInOut(progress);

    switch (type) {
        case 'fade':
        case 'crossfade':
        case 'film-dissolve':
        case 'smooth-cut':
        case 'non-additive-dissolve': {
            ctx.globalAlpha = 1;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.globalAlpha = p;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.globalAlpha = 1;
            break;
        }

        case 'additive-dissolve': {
            ctx.globalAlpha = 1;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = p;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            break;
        }

        case 'dip-black': {
            if (p < 0.5) {
                ctx.drawImage(fromPlayer, 0, 0, w, h);
                ctx.fillStyle = `rgba(0,0,0,${p * 2})`;
                ctx.fillRect(0, 0, w, h);
            } else {
                ctx.drawImage(toPlayer, 0, 0, w, h);
                ctx.fillStyle = `rgba(0,0,0,${(1 - p) * 2})`;
                ctx.fillRect(0, 0, w, h);
            }
            break;
        }

        case 'dip-white':
        case 'dip-color': {
            if (p < 0.5) {
                ctx.drawImage(fromPlayer, 0, 0, w, h);
                ctx.fillStyle = `rgba(255,255,255,${p * 2})`;
                ctx.fillRect(0, 0, w, h);
            } else {
                ctx.drawImage(toPlayer, 0, 0, w, h);
                ctx.fillStyle = `rgba(255,255,255,${(1 - p) * 2})`;
                ctx.fillRect(0, 0, w, h);
            }
            break;
        }

        case 'slide-left': {
            const offset = Math.round(p * w);
            ctx.drawImage(fromPlayer, -offset, 0, w, h);
            ctx.drawImage(toPlayer, w - offset, 0, w, h);
            break;
        }

        case 'slide-right': {
            const offset = Math.round(p * w);
            ctx.drawImage(fromPlayer, offset, 0, w, h);
            ctx.drawImage(toPlayer, -w + offset, 0, w, h);
            break;
        }

        case 'slide-up': {
            const offset = Math.round(p * h);
            ctx.drawImage(fromPlayer, 0, -offset, w, h);
            ctx.drawImage(toPlayer, 0, h - offset, w, h);
            break;
        }

        case 'slide-down': {
            const offset = Math.round(p * h);
            ctx.drawImage(fromPlayer, 0, offset, w, h);
            ctx.drawImage(toPlayer, 0, -h + offset, w, h);
            break;
        }

        case 'wipe-left': {
            const x = Math.round((1 - p) * w);
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, w - x, h);
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'wipe-right': {
            const x = Math.round(p * w);
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, 0, w - x, h);
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'wipe-circle': {
            const maxRadius = Math.sqrt(w * w + h * h) / 2;
            const radius = p * maxRadius;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'wipe-clock': {
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(w / 2, h / 2);
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + p * Math.PI * 2;
            ctx.arc(w / 2, h / 2, Math.max(w, h), startAngle, endAngle);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'wipe-up': {
            const y = Math.round((1 - p) * h);
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, w, h - y);
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'wipe-down': {
            const y = Math.round(p * h);
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, y, w, h - y);
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'wipe-diagonal': {
            const cover = p * (w + h);
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(clamp(cover, 0, w), 0);
            if (cover > w) ctx.lineTo(w, clamp(cover - w, 0, h));
            if (cover > h) ctx.lineTo(clamp(cover - h, 0, w), h);
            ctx.lineTo(0, clamp(cover, 0, h));
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'split-vertical': {
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(w / 2 - (w * p) / 2, 0, w * p, h);
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'split-horizontal': {
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, h / 2 - (h * p) / 2, w, h * p);
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'iris-diamond': {
            const rx = w * p;
            const ry = h * p;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(w / 2, h / 2 - ry);
            ctx.lineTo(w / 2 + rx, h / 2);
            ctx.lineTo(w / 2, h / 2 + ry);
            ctx.lineTo(w / 2 - rx, h / 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'venetian-blinds': {
            const strips = 12;
            const stripW = w / strips;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < strips; i += 1) {
                ctx.rect(i * stripW, 0, stripW * p, h);
            }
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'grid-flip': {
            const cols = 6;
            const rows = 5;
            const cellW = w / cols;
            const cellH = h / rows;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            for (let row = 0; row < rows; row += 1) {
                for (let col = 0; col < cols; col += 1) {
                    const order = (row + col) / (rows + cols - 2);
                    const local = clamp((p - order * 0.45) / 0.55, 0, 1);
                    if (local <= 0) continue;
                    const shrink = Math.abs(0.5 - local) * 2;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(col * cellW, row * cellH + (cellH * shrink) / 2, cellW, cellH * (1 - shrink * 0.82));
                    ctx.clip();
                    ctx.drawImage(toPlayer, 0, 0, w, h);
                    ctx.restore();
                }
            }
            break;
        }

        case 'zoom-in':
        case 'cross-zoom': {
            const scale = 1 + p * 0.5;
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.scale(scale, scale);
            ctx.globalAlpha = 1 - p;
            ctx.drawImage(fromPlayer, -w / 2, -h / 2, w, h);
            ctx.restore();
            ctx.globalAlpha = p;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.globalAlpha = 1;
            break;
        }

        case 'zoom-out': {
            const s = 1 - p * 0.3;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.save();
            ctx.globalAlpha = 1 - p;
            ctx.translate(w / 2, h / 2);
            ctx.scale(s, s);
            ctx.drawImage(fromPlayer, -w / 2, -h / 2, w, h);
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
        }

        case 'zoom-rotate': {
            const angle = p * Math.PI * 0.25;
            const s = 1 + p * 0.3;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.save();
            ctx.globalAlpha = 1 - p;
            ctx.translate(w / 2, h / 2);
            ctx.rotate(angle);
            ctx.scale(s, s);
            ctx.drawImage(fromPlayer, -w / 2, -h / 2, w, h);
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
        }

        case 'parallax-zoom': {
            drawScaledFrame(ctx, fromPlayer, w, h, 1 - p * 0.12, 1 - p * 0.55);
            drawScaledFrame(ctx, toPlayer, w, h, 1.18 - p * 0.18, p);
            break;
        }

        case 'snap-zoom': {
            drawScaledFrame(ctx, toPlayer, w, h, 1 + (1 - p) * 0.12, p);
            drawScaledFrame(ctx, fromPlayer, w, h, 1 + p * 1.25, 1 - p);
            ctx.fillStyle = `rgba(255,255,255,${0.35 * Math.sin(p * Math.PI)})`;
            ctx.fillRect(0, 0, w, h);
            break;
        }

        case 'spin-flash': {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            drawScaledFrame(ctx, fromPlayer, w, h, 1 + p * 0.32, 1 - p, p * Math.PI * 0.22);
            drawScaledFrame(ctx, toPlayer, w, h, 1 + (1 - p) * 0.32, p, -(1 - p) * Math.PI * 0.22);
            ctx.fillStyle = `rgba(255,255,255,${0.42 * Math.sin(p * Math.PI)})`;
            ctx.fillRect(0, 0, w, h);
            break;
        }

        case 'cube-left': {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            ctx.save();
            ctx.globalAlpha = 1 - p * 0.2;
            ctx.setTransform(1 - p * 0.25, 0.08 * p, 0, 1, -p * w, 0);
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 0.8 + p * 0.2;
            ctx.setTransform(0.75 + p * 0.25, -0.08 * (1 - p), 0, 1, w * (1 - p), 0);
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'glitch': {
            if (p < 0.5) {
                ctx.drawImage(fromPlayer, 0, 0, w, h);
            } else {
                ctx.drawImage(toPlayer, 0, 0, w, h);
            }
            // Glitch slices
            const sliceCount = 8;
            const sliceH = h / sliceCount;
            for (let i = 0; i < sliceCount; i++) {
                const offset = (deterministicUnit((i + 1) * 97 + Math.round(p * 1000)) - 0.5) * w * 0.15 * Math.sin(p * Math.PI);
                const src = p < 0.5 ? fromPlayer : toPlayer;
                ctx.drawImage(src, 0, i * sliceH, w, sliceH, offset, i * sliceH, w, sliceH);
            }
            break;
        }

        case 'pixel-scatter': {
            ctx.drawImage(p < 0.5 ? fromPlayer : toPlayer, 0, 0, w, h);
            const blockSize = Math.max(4, Math.round(20 * Math.sin(p * Math.PI)));
            const source = p < 0.5 ? toPlayer : fromPlayer;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(source, 0, 0, w, h);
            for (let x = 0; x < w; x += blockSize * 2) {
                for (let y = 0; y < h; y += blockSize * 2) {
                    if (deterministicUnit(x * 0.31 + y * 0.73 + Math.round(p * 1000)) < p) {
                        const jitterX = (deterministicUnit(x * 0.19 + y * 0.29) - 0.5) * 10;
                        const jitterY = (deterministicUnit(x * 0.41 + y * 0.11) - 0.5) * 10;
                        ctx.drawImage(tempCanvas, x, y, blockSize, blockSize, x + jitterX, y + jitterY, blockSize, blockSize);
                    }
                }
            }
            break;
        }

        case 'chromatic': {
            ctx.drawImage(p < 0.5 ? fromPlayer : toPlayer, 0, 0, w, h);
            const shift = Math.round(15 * Math.sin(p * Math.PI));
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.5 * Math.sin(p * Math.PI);
            ctx.drawImage(p < 0.5 ? fromPlayer : toPlayer, shift, 0, w, h);
            ctx.drawImage(p < 0.5 ? fromPlayer : toPlayer, -shift, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            break;
        }

        case 'rgb-split': {
            const source = p < 0.5 ? fromPlayer : toPlayer;
            const shift = Math.round((8 + w * 0.018) * Math.sin(p * Math.PI));
            ctx.globalAlpha = 1;
            ctx.drawImage(source, 0, 0, w, h);
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.45;
            ctx.drawImage(fromPlayer, -shift, 0, w, h);
            ctx.drawImage(toPlayer, shift, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = p;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.globalAlpha = 1;
            break;
        }

        case 'strobe-cut': {
            const flashes = Math.floor(p * 10);
            ctx.drawImage(flashes % 2 === 0 ? fromPlayer : toPlayer, 0, 0, w, h);
            ctx.fillStyle = `rgba(255,255,255,${0.18 * Math.sin(p * Math.PI)})`;
            ctx.fillRect(0, 0, w, h);
            break;
        }

        case 'blur-dissolve':
        case 'cross-blur':
        case 'motion-blur':
        case 'radial-blur': {
            // Canvas doesn't have native blur during compositing, simulate with crossfade
            ctx.globalAlpha = 1 - p;
            ctx.filter = `blur(${Math.round(p * 10)}px)`;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.filter = `blur(${Math.round((1 - p) * 10)}px)`;
            ctx.globalAlpha = p;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            break;
        }

        case 'whip-pan': {
            const dir = p < 0.5 ? fromPlayer : toPlayer;
            const offset = Math.round((p - 0.5) * w * 2.2);
            ctx.filter = `blur(${Math.round(10 * Math.sin(p * Math.PI))}px)`;
            ctx.drawImage(dir, -offset, 0, w, h);
            ctx.filter = 'none';
            ctx.globalAlpha = 0.38 * Math.sin(p * Math.PI);
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 12; i += 1) {
                const y = deterministicUnit(i * 19 + Math.round(p * 100)) * h;
                ctx.fillRect(0, y, w, 1);
            }
            ctx.globalAlpha = 1;
            break;
        }

        case 'neon-shutter': {
            const panels = 7;
            const panelW = w / panels;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            for (let i = 0; i < panels; i += 1) {
                const local = clamp((p - i * 0.045) / 0.7, 0, 1);
                if (local <= 0) continue;
                ctx.save();
                ctx.beginPath();
                ctx.rect(i * panelW, 0, panelW, h * local);
                ctx.clip();
                ctx.drawImage(toPlayer, 0, 0, w, h);
                ctx.restore();
                ctx.fillStyle = 'rgba(0,229,255,0.72)';
                ctx.fillRect(i * panelW, h * local - 2, panelW, 2);
            }
            break;
        }

        case 'scanline-sweep': {
            ctx.globalAlpha = 1;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.globalAlpha = p;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.globalAlpha = 1;
            drawScanlines(ctx, w, h, 0.18, Math.round(p * 60));
            drawSweepLine(ctx, w, h, p);
            break;
        }

        case 'ink-spread': {
            const dots = 18;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < dots; i += 1) {
                const x = deterministicUnit(i * 23.7) * w;
                const y = deterministicUnit(i * 41.3) * h;
                const radius = Math.max(w, h) * clamp((p - deterministicUnit(i * 11.1) * 0.35) / 0.65, 0, 1) * 0.34;
                ctx.moveTo(x + radius, y);
                ctx.arc(x, y, radius, 0, Math.PI * 2);
            }
            ctx.clip();
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.restore();
            break;
        }

        case 'flash': {
            if (p < 0.3) {
                ctx.drawImage(fromPlayer, 0, 0, w, h);
                ctx.fillStyle = `rgba(255,255,255,${p / 0.3})`;
                ctx.fillRect(0, 0, w, h);
            } else if (p < 0.5) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, w, h);
            } else {
                ctx.drawImage(toPlayer, 0, 0, w, h);
                ctx.fillStyle = `rgba(255,255,255,${(1 - p) / 0.5})`;
                ctx.fillRect(0, 0, w, h);
            }
            break;
        }

        case 'intro-neon-doors': {
            const open = easeOutCubic(p);
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, (w / 2) * (1 - open), h);
            ctx.fillRect(w - (w / 2) * (1 - open), 0, (w / 2) * (1 - open), h);
            ctx.fillStyle = 'rgba(0,229,255,0.85)';
            ctx.fillRect((w / 2) * (1 - open), 0, 2, h);
            ctx.fillStyle = 'rgba(155,92,255,0.85)';
            ctx.fillRect(w - (w / 2) * (1 - open) - 2, 0, 2, h);
            drawTransitionLabel(ctx, 'OPENING SIGNAL', w, h, 1 - p);
            break;
        }

        case 'intro-title-scan': {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = easeInCubic(p);
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.globalAlpha = 1;
            ctx.fillStyle = `rgba(0,0,0,${0.62 * (1 - p)})`;
            ctx.fillRect(0, 0, w, h);
            drawScanlines(ctx, w, h, 0.22, Math.round(p * 80));
            drawSweepLine(ctx, w, h, p, 'rgba(155,92,255,0.95)');
            drawTransitionLabel(ctx, 'INTRO REVEAL', w, h, Math.sin(p * Math.PI));
            break;
        }

        case 'intro-cinematic-bars': {
            ctx.drawImage(toPlayer, 0, 0, w, h);
            const bar = (h / 2) * (1 - easeOutCubic(p));
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, bar);
            ctx.fillRect(0, h - bar, w, bar);
            drawTransitionLabel(ctx, 'START', w, h, 1 - p);
            break;
        }

        case 'intro-grid-reveal': {
            const cols = 5;
            const rows = 8;
            const cellW = w / cols;
            const cellH = h / rows;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            for (let row = 0; row < rows; row += 1) {
                for (let col = 0; col < cols; col += 1) {
                    const order = deterministicUnit(row * 13 + col * 31);
                    if (p < order * 0.45) continue;
                    const local = clamp((p - order * 0.45) / 0.55, 0, 1);
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(col * cellW, row * cellH, cellW * local, cellH);
                    ctx.clip();
                    ctx.drawImage(toPlayer, 0, 0, w, h);
                    ctx.restore();
                }
            }
            break;
        }

        case 'outro-neon-close': {
            const close = easeInCubic(p);
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, (w / 2) * close, h);
            ctx.fillRect(w - (w / 2) * close, 0, (w / 2) * close, h);
            ctx.fillStyle = 'rgba(0,229,255,0.85)';
            ctx.fillRect((w / 2) * close, 0, 2, h);
            ctx.fillStyle = 'rgba(255,49,95,0.82)';
            ctx.fillRect(w - (w / 2) * close - 2, 0, 2, h);
            drawTransitionLabel(ctx, 'END FRAME', w, h, p);
            break;
        }

        case 'outro-cinematic-fade': {
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            const bar = (h / 2) * easeInCubic(p);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, bar);
            ctx.fillRect(0, h - bar, w, bar);
            ctx.fillStyle = `rgba(0,0,0,${p * 0.75})`;
            ctx.fillRect(0, 0, w, h);
            break;
        }

        case 'outro-signal-collapse': {
            const collapse = easeInCubic(p);
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            drawScanlines(ctx, w, h, 0.28 * p, Math.round(p * 100));
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, (h / 2) * collapse);
            ctx.fillRect(0, h - (h / 2) * collapse, w, (h / 2) * collapse);
            ctx.fillStyle = `rgba(0,229,255,${0.75 * Math.sin(p * Math.PI)})`;
            ctx.fillRect(0, h / 2 - 2, w, 4);
            if (p > 0.8) {
                ctx.fillStyle = `rgba(0,0,0,${(p - 0.8) / 0.2})`;
                ctx.fillRect(0, 0, w, h);
            }
            break;
        }

        case 'light-leak': {
            ctx.globalAlpha = 1;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.globalAlpha = p;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            // Warm light overlay
            const gradient = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.8);
            gradient.addColorStop(0, `rgba(255,180,50,${0.4 * Math.sin(p * Math.PI)})`);
            gradient.addColorStop(1, 'rgba(255,180,50,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
            break;
        }

        case 'burn': {
            if (p < 0.5) {
                ctx.drawImage(fromPlayer, 0, 0, w, h);
                const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * (1 - p));
                g.addColorStop(0, `rgba(200,80,0,${p})`);
                g.addColorStop(0.5, `rgba(100,20,0,${p * 0.5})`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            } else {
                ctx.drawImage(toPlayer, 0, 0, w, h);
                ctx.fillStyle = `rgba(0,0,0,${(1 - p) * 2})`;
                ctx.fillRect(0, 0, w, h);
            }
            break;
        }

        default: {
            // Default crossfade
            ctx.globalAlpha = 1;
            ctx.drawImage(fromPlayer, 0, 0, w, h);
            ctx.globalAlpha = p;
            ctx.drawImage(toPlayer, 0, 0, w, h);
            ctx.globalAlpha = 1;
        }
    }
}

/**
 * PlaybackEngine - Multi-clip canvas playback
 */
export class PlaybackEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        configureCanvasQuality(this.ctx);
        this.players = new Map();
        this.audioPlayers = new Map();
        this.audioSourceNodes = new Map();
        this.audioDestinationNodes = new Set();
        this.audioContext = null;
        this.animFrameId = null;
        this.videoFrameCallbackId = null;
        this.videoFrameCallbackPlayer = null;
        this.onTimeUpdate = null;
        this.isPlaying = false;
    }

    async loadClip(clip) {
        if (this.players.has(clip.id)) return;
        if (!clip?.url) throw new Error(`Media sans URL: ${clip?.name || clip?.id || 'media'}`);
        if (isImageMedia(clip)) {
            const image = new Image();
            image.decoding = 'async';
            await new Promise((resolve, reject) => {
                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    resolve();
                };
                const fail = () => {
                    if (settled) return;
                    settled = true;
                    reject(new Error(`Failed to load image clip: ${clip.name}`));
                };
                image.onload = finish;
                image.onerror = fail;
                image.src = clip.url;
                image.decode?.().then(finish).catch(() => {});
            });
            this.players.set(clip.id, image);
            return;
        }
        const video = createVideoPlayer(clip.url);
        video.playbackRate = clip.speed || 1;
        video.volume = clampMediaVolume(clip.volume);
        
        await new Promise((resolve, reject) => {
            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(); // Continue even if no canplay (video may still work)
                }
            }, 3000); // 3 second timeout
            
            const handleCanPlay = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    cleanup();
                    resolve();
                }
            };
            
            const handleLoadedData = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    cleanup();
                    resolve();
                }
            };
            
            const handleError = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    cleanup();
                    reject(new Error(`Failed to load video clip: ${clip.name}`));
                }
            };
            
            const cleanup = () => {
                video.removeEventListener('canplay', handleCanPlay);
                video.removeEventListener('loadeddata', handleLoadedData);
                video.removeEventListener('error', handleError);
            };
            
            video.addEventListener('canplay', handleCanPlay);
            video.addEventListener('loadeddata', handleLoadedData);
            video.addEventListener('error', handleError);
            video.load();
        });
        
        this.players.set(clip.id, video);
    }

    async loadAudioTrack(track) {
        if (!track?.url) throw new Error(`Piste audio sans URL: ${track?.name || track?.id || 'audio'}`);
        if (this.audioPlayers.has(track.id)) return;
        const audio = new Audio(track.url);
        audio.preload = 'auto';
        audio.volume = clampMediaVolume(track.volume ?? 100);

        await new Promise((resolve, reject) => {
            let resolved = false;
            let timeout = null;
            const done = () => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve();
            };
            const fail = () => {
                if (resolved) return;
                resolved = true;
                cleanup();
                reject(new Error(`Impossible de decoder la piste audio: ${track.name || track.id}`));
            };
            const cleanup = () => {
                window.clearTimeout(timeout);
                audio.removeEventListener('canplay', done);
                audio.removeEventListener('loadeddata', done);
                audio.removeEventListener('error', fail);
            };
            timeout = window.setTimeout(fail, 5000);
            audio.addEventListener('canplay', done);
            audio.addEventListener('loadeddata', done);
            audio.addEventListener('error', fail);
            audio.load();
        });

        this.audioPlayers.set(track.id, audio);
    }

    async loadAllClips(clips) {
        const results = await Promise.allSettled(clips.map(async (clip) => {
            await this.loadClip(clip);
            return clip;
        }));
        return results.map((result, index) => ({ ...result, media: clips[index] }));
    }

    async loadAllAudioTracks(audioTracks = []) {
        const results = await Promise.allSettled(audioTracks.map(async (track) => {
            await this.loadAudioTrack(track);
            return track;
        }));
        return results.map((result, index) => ({ ...result, media: audioTracks[index] }));
    }

    async waitForSeek(player, targetTime, tolerance = 0.015) {
        if (!player || !Number.isFinite(targetTime) || typeof player.currentTime !== 'number') return;
        const duration = Number.isFinite(player.duration) ? player.duration : targetTime;
        const safeTime = clamp(targetTime, 0, Math.max(0, duration - 0.001));
        if (Math.abs(player.currentTime - safeTime) <= tolerance && player.readyState >= 2) return;

        await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve();
            };
            const cleanup = () => {
                window.clearTimeout(timeout);
                player.removeEventListener('seeked', finish);
                player.removeEventListener('loadeddata', finish);
                player.removeEventListener('error', finish);
            };
            const timeout = window.setTimeout(finish, 1200);
            player.addEventListener('seeked', finish);
            player.addEventListener('loadeddata', finish);
            player.addEventListener('error', finish);
            try {
                player.currentTime = safeTime;
            } catch {
                finish();
            }
        });
    }

    getOrCreateAudioContext(AudioContextCtor) {
        if (!AudioContextCtor) return null;
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new AudioContextCtor();
        }
        return this.audioContext;
    }

    connectAudioToDestination(audioContext, destination) {
        if (!audioContext || !destination) return () => {};
        const connected = [];
        const connectPlayer = (player) => {
            if (!player || this.audioDestinationNodes.has(destination)) return;
            let source = this.audioSourceNodes.get(player);
            if (!source) {
                source = audioContext.createMediaElementSource(player);
                this.audioSourceNodes.set(player, source);
            }
            if (source.context !== audioContext) return;
            source.connect(destination);
            source.connect(audioContext.destination);
            connected.push(source);
        };

        this.players.forEach((player) => {
            if (typeof player.play === 'function') connectPlayer(player);
        });
        this.audioPlayers.forEach(connectPlayer);
        this.audioDestinationNodes.add(destination);

        return () => {
            connected.forEach((source) => {
                try { source.disconnect(destination); } catch { /* already disconnected */ }
                try { source.disconnect(audioContext.destination); } catch { /* already disconnected */ }
            });
            this.audioDestinationNodes.delete(destination);
        };
    }

    getActiveClipAtTime(clips, transitions, globalTime, transitionItems = []) {
        if (hasResolvedVideoTiming(clips)) {
            return getResolvedActiveClipAtTime(clips, transitions, globalTime, transitionItems);
        }

        let elapsed = 0;
        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const clipDur = getClipPlaybackDuration(clip);

            let transitionDur = 0;
            let transition = null;
            if (i < clips.length - 1) {
                const key = `${clip.id}->${clips[i + 1].id}`;
                transition = transitions[key];
                if (transition) transitionDur = transition.duration || 0;
            }

            const effectiveDur = clipDur - transitionDur;

            if (globalTime < elapsed + clipDur) {
                const localTime = clip.trimStart + (globalTime - elapsed) * (clip.speed || 1);

                let transitionProgress = -1;
                let nextClip = null;
                if (transition && globalTime >= elapsed + effectiveDur) {
                    transitionProgress = (globalTime - elapsed - effectiveDur) / transitionDur;
                    nextClip = clips[i + 1];
                }

                return { clip, localTime, transitionProgress, transition, nextClip };
            }

            elapsed += effectiveDur;
        }
        return null;
    }

    /*
     * LE BORD DE SEQUENCE: ouverture avant le premier plan, fin apres le
     * dernier. Rend `null` si l'instant demande n'est pas dans un de ces deux
     * temps - l'appelant retombe alors sur son noir habituel.
     *
     * Le plan de reference est TOUJOURS le premier (ouverture) ou le dernier
     * (fin), jamais « le plan actif »: par construction il n'y en a pas.
     */
    /*
     * Quel plan et quel instant un bord de sequence montre-t-il ? Extrait pour
     * que le CALAGE (asynchrone, dans `seekAndDraw`) et le DESSIN (synchrone,
     * dans `renderSequenceEdge`) lisent la meme reponse - deux calculs separes
     * auraient diverge a la premiere retouche.
     */
    resolveSequenceEdgeClip(clips = [], globalTime = 0, transitionItems = []) {
        if (!clips.length) return null;
        for (const item of transitionItems) {
            const slot = item?.params?.placement;
            if (slot !== 'intro' && slot !== 'outro') continue;
            const start = Number(item.start ?? item.startTime ?? 0);
            const duration = Math.max(0.1, Number(item.duration) || 0.5);
            if (globalTime < start - 0.001 || globalTime > start + duration + 0.001) continue;
            const clip = slot === 'intro' ? clips[0] : clips[clips.length - 1];
            const localTime = slot === 'intro'
                ? Number(clip.trimStart) || 0
                : Math.max(0, (Number(clip.trimEnd) || 0) - 0.05);
            return { slot, clip, localTime, start, duration };
        }
        return null;
    }

    renderSequenceEdge(clips = [], transitions = {}, globalTime = 0, transitionItems = []) {
        const edge = this.resolveSequenceEdgeClip(clips, globalTime, transitionItems);
        if (!edge || edge.slot !== 'intro') return null;
        const w = this.canvas.width;
        const h = this.canvas.height;
        {
            const { slot, clip, localTime, start, duration } = edge;
            const item = transitionItems.find((entry) => entry?.params?.placement === slot) || {};
            const player = this.players.get(clip.id);
            if (!player) return null;
            /*
             * REPOSITIONNER LE LECTEUR, et c'est ce qui manquait au premier jet.
             * Sans ce calage, une video jamais lue n'a AUCUNE image decodee a
             * donner et `drawImage` ne peint rien : la fin de sequence sortait
             * donc noire de bout en bout (mesure du 2026-08-04, cinq points,
             * luminance 0). L'ouverture, elle, semblait marcher - par accident,
             * parce que son plan venait d'etre charge et se trouvait deja au
             * debut.
             */
            if (!isImageMedia(clip) && Math.abs(player.currentTime - localTime) > 0.05) {
                player.currentTime = localTime;
            }
            const frame = makeFilteredFrame(player, clip, w, h, localTime);

            const black = document.createElement('canvas');
            black.width = w;
            black.height = h;
            const blackCtx = black.getContext('2d');
            blackCtx.fillStyle = '#000';
            blackCtx.fillRect(0, 0, w, h);

            const progress = clamp((globalTime - start) / duration, 0, 1);
            const from = slot === 'intro' ? black : frame;
            const to = slot === 'intro' ? frame : black;
            renderTransition(this.ctx, from, to, progress, item.type, w, h);
            return {
                rendered: true,
                reason: `sequence-${slot}`,
                clipId: clip.id,
                time: globalTime,
                mode: `sequence-${slot}`,
            };
        }
    }

    renderFrame(clips, transitions, globalTime, transitionItems = []) {
        configureCanvasQuality(this.ctx);
        const result = this.getActiveClipAtTime(clips, transitions, globalTime, transitionItems);
        if (!result) {
            /*
             * OUVERTURE ET FIN DE SEQUENCE (2026-08-04).
             *
             * Avant cette branche, tout instant sans plan actif etait peint en
             * NOIR. Or une ouverture occupe justement un temps ou aucun plan
             * n'existe encore - elle se joue AVANT le premier, c'est sa
             * definition. Le montage se decalait donc bien d'une seconde
             * (`getIntroOffset`), mais cette seconde restait noire: mesure du
             * 2026-08-04, cinq points echantillonnes dans l'ouverture, amplitude
             * 0,0.
             *
             * Une ouverture est une transition DEPUIS LE NOIR vers le premier
             * plan; une fin, une transition depuis le dernier plan VERS le noir.
             * On fabrique donc le cote manquant plutot que de renoncer a
             * dessiner.
             */
            const sequence = this.renderSequenceEdge(clips, transitions, globalTime, transitionItems);
            if (sequence) return sequence;
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            return { rendered: false, reason: 'no-active-clip', time: globalTime };
        }

        const { clip, localTime, transitionProgress, transition, nextClip } = result;
        const player = this.players.get(clip.id);
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (!player) {
            // Player not loaded yet - show black
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, w, h);
            return { rendered: false, reason: 'missing-player', clipId: clip.id, time: globalTime };
        }

        try {
            let renderMode = 'clip';
            let targetClipId = null;
            // Only seek if time difference is significant
            if (!isImageMedia(clip) && Math.abs(player.currentTime - localTime) > 0.05) {
                player.currentTime = localTime;
            }

            const timelineTransition = getActiveTimelineTransition(transitionItems, globalTime);
            if (timelineTransition) {
                const transitionStart = getTransitionStart(timelineTransition);
                const transitionDuration = Math.max(0.1, timelineTransition.duration || ((timelineTransition.endTime || 0) - transitionStart) || 0.5);
                const transitionEnd = timelineTransition.endTime || transitionStart + transitionDuration;
                const timelineProgress = clamp((globalTime - transitionStart) / transitionDuration, 0, 1);
                const targetResult = this.getActiveClipAtTime(clips, transitions, Math.min(transitionEnd, globalTime + transitionDuration), transitionItems);
                const targetPlayer = this.players.get(targetResult?.clip?.id) || player;
                const targetClip = targetResult?.clip || clip;
                const targetLocalTime = targetResult?.localTime ?? localTime;

                const fromFrame = makeFilteredFrame(player, clip, w, h, localTime);
                if (targetPlayer && !isImageMedia(targetClip) && Math.abs(targetPlayer.currentTime - targetLocalTime) > 0.05) {
                    targetPlayer.currentTime = targetLocalTime;
                }
                const toFrame = makeFilteredFrame(targetPlayer, targetClip, w, h, targetLocalTime);
                renderTransition(this.ctx, fromFrame, toFrame, timelineProgress, timelineTransition.type, w, h);
                renderMode = 'timeline-transition';
                targetClipId = targetClip.id || null;
            } else if (transitionProgress >= 0 && transitionProgress <= 1 && nextClip && transition) {
                const nextPlayer = this.players.get(nextClip.id);
                if (nextPlayer) {
                    const nextLocalTime = hasResolvedVideoTiming(clips)
                        ? getClipLocalTime(nextClip, globalTime, getResolvedClipStart(nextClip))
                        : nextClip.trimStart + transitionProgress * ((nextClip.trimEnd - nextClip.trimStart) / (nextClip.speed || 1)) * 0.1;
                    if (!isImageMedia(nextClip) && Math.abs(nextPlayer.currentTime - nextLocalTime) > 0.05) {
                        nextPlayer.currentTime = nextLocalTime;
                    }
                    // Render real transition using filtered frame snapshots.
                    const fromFrame = makeFilteredFrame(player, clip, w, h, localTime);
                    const toFrame = makeFilteredFrame(nextPlayer, nextClip, w, h, nextLocalTime);
                    renderTransition(this.ctx, fromFrame, toFrame, transitionProgress, transition.type, w, h);
                    renderMode = 'cut-transition';
                    targetClipId = nextClip.id || null;
                } else {
                    // Next clip not loaded, draw current
                    drawFilteredSource(this.ctx, player, clip, w, h, localTime);
                    renderMode = 'cut-transition-fallback';
                    targetClipId = nextClip.id || null;
                }
            } else {
                drawFilteredSource(this.ctx, player, clip, w, h, localTime);
            }

            /*
             * LA FIN DE SEQUENCE SE POSE PAR-DESSUS CE QUI VIENT D'ETRE DESSINE.
             *
             * Elle ne remplace pas le plan et n'ajoute pas de temps: elle
             * l'eteint PENDANT qu'il joue. Le premier jet gelait la derniere
             * image une seconde puis fondait - « elle se met quand tout est
             * termine, ca n'a pas de logique » (essai du porteur du projet,
             * 2026-08-04). C'etait exact: une fermeture ferme ce qui est en
             * train de se jouer.
             *
             * Elle est posee EN DERNIER, apres la transition de coupe eventuelle:
             * si le montage finit sur un fondu, c'est ce fondu-la qui doit
             * s'eteindre, pas le plan seul.
             */
            const outro = findSequenceEdgeAt(transitionItems, globalTime, 'outro');
            if (outro) {
                const current = document.createElement('canvas');
                current.width = w;
                current.height = h;
                current.getContext('2d').drawImage(this.canvas, 0, 0);
                const outroProgress = clamp((globalTime - outro.start) / outro.duration, 0, 1);
                renderTransition(this.ctx, current, makeBlackFrame(w, h), outroProgress, outro.item.type, w, h);
                renderMode = `${renderMode}+outro`;
            }

            return {
                rendered: true,
                reason: null,
                clipId: clip.id,
                targetClipId,
                localTime,
                mode: renderMode,
                time: globalTime,
            };
        } catch (err) {
            // Draw black if any canvas error occurs
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, w, h);
            console.warn('Canvas render error:', err);
            return {
                rendered: false,
                reason: 'canvas-render-error',
                error: err?.message || String(err),
                clipId: clip.id,
                time: globalTime,
            };
        }
    }

    getTimelineDuration(clips, transitions = {}) {
        if (!clips?.length) return 0;
        if (hasResolvedVideoTiming(clips)) {
            return Math.max(0, ...clips.map(clip => getResolvedClipStart(clip) + getResolvedClipDuration(clip)));
        }

        let total = 0;
        clips.forEach((clip, index) => {
            const speed = clip.speed || 1;
            const duration = Math.max(0, ((clip.trimEnd || 0) - (clip.trimStart || 0)) / speed);
            total += duration;
            if (index < clips.length - 1) {
                const transition = transitions[`${clip.id}->${clips[index + 1].id}`];
                if (transition) total -= transition.duration || 0;
            }
        });
        return Math.max(0, total);
    }

    async seekAndDraw(clips, transitions, globalTime, transitionItems = []) {
        const result = this.getActiveClipAtTime(clips, transitions, globalTime, transitionItems);
        if (!result) {
            /*
             * BORD DE SEQUENCE. On ATTEND le calage du lecteur avant de
             * dessiner: un `currentTime =` pose sans attente ne fournit pas
             * l'image tout de suite, et le scrub rendrait une image en retard -
             * ou rien du tout sur un plan jamais lu.
             */
            const edge = this.resolveSequenceEdgeClip(clips, globalTime, transitionItems);
            if (edge) await this.waitForSeek(this.players.get(edge.clip.id), edge.localTime);
            return this.renderFrame(clips, transitions, globalTime, transitionItems);
        }

        const { clip, localTime, transitionProgress, transition, nextClip } = result;
        const player = this.players.get(clip.id);
        await this.waitForSeek(player, localTime);

        const timelineTransition = getActiveTimelineTransition(transitionItems, globalTime);
        if (timelineTransition) {
            const start = getTransitionStart(timelineTransition);
            const duration = Math.max(0.1, timelineTransition.duration || 0.5);
            const targetTime = Math.min(start + duration, globalTime + duration);
            const targetResult = this.getActiveClipAtTime(clips, transitions, targetTime, transitionItems);
            const targetPlayer = this.players.get(targetResult?.clip?.id);
            await this.waitForSeek(targetPlayer, targetResult?.localTime ?? localTime);
        } else if (transitionProgress >= 0 && transitionProgress <= 1 && nextClip && transition) {
            const nextPlayer = this.players.get(nextClip.id);
            const nextLocalTime = hasResolvedVideoTiming(clips)
                ? getClipLocalTime(nextClip, globalTime, getResolvedClipStart(nextClip))
                : nextClip.trimStart + transitionProgress * ((nextClip.trimEnd - nextClip.trimStart) / (nextClip.speed || 1)) * 0.1;
            await this.waitForSeek(nextPlayer, nextLocalTime);
        }

        return this.renderFrame(clips, transitions, globalTime, transitionItems);
    }

    syncClipAudio(clips, transitions, globalTime, playbackSpeed = 1, transitionItems = []) {
        const activeResult = this.getActiveClipAtTime(clips, transitions, globalTime, transitionItems);
        this.players.forEach((player, id) => {
            const isActive = activeResult?.clip?.id === id;
            const clip = clips.find((item) => item.id === id);
            if (isImageMedia(clip)) return;
            if (!isActive) {
                player.pause();
                return;
            }
            const activeClip = activeResult.clip;
            player.volume = clampMediaVolume(activeClip.volume ?? 100);
            player.playbackRate = (activeClip.speed || 1) * playbackSpeed;
            if (Math.abs(player.currentTime - activeResult.localTime) > 0.18) {
                player.currentTime = activeResult.localTime;
            }
            if (player.paused) player.play().catch(() => {});
        });
    }

    syncExternalAudio(audioTracks = [], globalTime, playbackSpeed = 1) {
        this.audioPlayers.forEach((audio, id) => {
            const track = audioTracks.find(item => item.id === id);
            if (!track) {
                audio.pause();
                return;
            }
            const start = track.startTime || 0;
            const end = track.endTime || start + (track.duration || 0);
            const isActive = globalTime >= start && globalTime <= end;
            if (!isActive) {
                audio.pause();
                return;
            }

            // `trimStart` = point de depart DANS le morceau, distinct de `startTime`
            // qui est la position sur la timeline.
            const trimStart = Math.max(0, Number(track.trimStart) || 0);
            const localTime = Math.max(0, globalTime - start) + trimStart;
            audio.volume = clampMediaVolume(resolveAudioFadeVolume(track, globalTime));
            audio.playbackRate = playbackSpeed;
            if (Math.abs(audio.currentTime - localTime) > 0.18) {
                audio.currentTime = localTime;
            }
            if (audio.paused) audio.play().catch(() => {});
        });
    }

    getMediaDrivenTimelineTime(clips, transitions, currentTime, transitionItems = []) {
        if (!hasResolvedVideoTiming(clips)) return null;
        const activeResult = this.getActiveClipAtTime(clips, transitions, currentTime, transitionItems);
        const clip = activeResult?.clip;
        const player = clip ? this.players.get(clip.id) : null;
        if (!clip || isImageMedia(clip) || !player || player.paused || player.readyState < 2) return null;

        const timelineStart = getResolvedClipStart(clip);
        const trimStart = Number(clip.trimStart || 0);
        const speed = Number(clip.speed || 1);
        if (!Number.isFinite(timelineStart) || !Number.isFinite(speed) || speed <= 0) return null;

        const timelineTime = timelineStart + ((player.currentTime - trimStart) / speed);
        const timelineEnd = timelineStart + getResolvedClipDuration(clip);
        if (!Number.isFinite(timelineTime) || timelineTime < timelineStart - 0.08 || timelineTime > timelineEnd + 0.08) return null;
        return timelineTime;
    }

    hasActiveVideoWaitingForPlayback(clips, transitions, currentTime, transitionItems = []) {
        const activeResult = this.getActiveClipAtTime(clips, transitions, currentTime, transitionItems);
        if (isImageMedia(activeResult?.clip)) return false;
        const player = activeResult?.clip ? this.players.get(activeResult.clip.id) : null;
        return Boolean(player && (player.paused || player.readyState < 2));
    }

    resolveTimelineTimeFromMediaFrame(clips, transitions, currentTime, transitionItems, framePlayer, mediaTime) {
        if (!hasResolvedVideoTiming(clips) || !framePlayer || !Number.isFinite(mediaTime)) return null;
        const activeResult = this.getActiveClipAtTime(clips, transitions, currentTime, transitionItems);
        const clip = activeResult?.clip;
        if (!clip || isImageMedia(clip) || this.players.get(clip.id) !== framePlayer) return null;
        const timelineStart = getResolvedClipStart(clip);
        const trimStart = Number(clip.trimStart || 0);
        const speed = Number(clip.speed || 1);
        if (!Number.isFinite(timelineStart) || !Number.isFinite(speed) || speed <= 0) return null;
        const timelineTime = timelineStart + ((mediaTime - trimStart) / speed);
        const timelineEnd = timelineStart + getResolvedClipDuration(clip);
        if (!Number.isFinite(timelineTime) || timelineTime < timelineStart - 0.08 || timelineTime > timelineEnd + 0.08) return null;
        return timelineTime;
    }

    startPlayback(clips, transitions, getCurrentTime, setCurrentTime, totalDuration, playbackSpeed = 1, audioTracks = [], transitionItems = [], options = {}) {
        this.isPlaying = true;
        let lastTimestamp = null;
        let timelineTime = getCurrentTime();
        let lastRenderedTime = Number.NEGATIVE_INFINITY;
        const previewFrameRate = Number(options.previewFrameRate);
        const previewFrameDuration = Number.isFinite(previewFrameRate) && previewFrameRate > 0
            ? 1 / previewFrameRate
            : 0;
        this.syncClipAudio(clips, transitions, timelineTime, playbackSpeed, transitionItems);
        this.syncExternalAudio(audioTracks, timelineTime, playbackSpeed);

        const commitTime = (newTime) => {
            const safeTime = Math.min(Math.max(0, newTime), totalDuration);
            if (safeTime >= totalDuration - 0.001) {
                this.stopPlayback();
                setCurrentTime(totalDuration, { ended: true, force: true, rendered: false });
                options.onEnded?.();
                return false;
            }

            timelineTime = safeTime;
            const shouldRender = previewFrameDuration <= 0
                || lastRenderedTime === Number.NEGATIVE_INFINITY
                || safeTime - lastRenderedTime >= previewFrameDuration - 0.002;
            if (shouldRender) {
                this.renderFrame(clips, transitions, safeTime, transitionItems);
                lastRenderedTime = safeTime;
            }
            setCurrentTime(safeTime, { rendered: shouldRender });
            this.syncClipAudio(clips, transitions, safeTime, playbackSpeed, transitionItems);
            this.syncExternalAudio(audioTracks, safeTime, playbackSpeed);
            return true;
        };

        const absorbExternalSeek = () => {
            const externalTime = Number(getCurrentTime());
            if (!Number.isFinite(externalTime)) return false;
            const safeExternalTime = Math.min(Math.max(0, externalTime), totalDuration);
            if (Math.abs(safeExternalTime - timelineTime) < 0.12) return false;

            timelineTime = safeExternalTime;
            lastTimestamp = null;
            lastRenderedTime = Number.NEGATIVE_INFINITY;
            this.renderFrame(clips, transitions, timelineTime, transitionItems);
            setCurrentTime(timelineTime, { force: true, rendered: true });
            this.syncClipAudio(clips, transitions, timelineTime, playbackSpeed, transitionItems);
            this.syncExternalAudio(audioTracks, timelineTime, playbackSpeed);
            return true;
        };

        const scheduleFrameSyncedToVideo = () => {
            if (!this.isPlaying) return false;
            if (!hasResolvedVideoTiming(clips)) return false;
            const activeResult = this.getActiveClipAtTime(clips, transitions, timelineTime, transitionItems);
            const player = activeResult?.clip ? this.players.get(activeResult.clip.id) : null;
            if (isImageMedia(activeResult?.clip)) return false;
            if (!player || typeof player.requestVideoFrameCallback !== 'function') return false;
            this.videoFrameCallbackPlayer = player;
            this.videoFrameCallbackId = player.requestVideoFrameCallback((_now, metadata = {}) => {
                this.videoFrameCallbackId = null;
                if (!this.isPlaying) return;
                if (absorbExternalSeek()) {
                    scheduleNextFrame();
                    return;
                }
                const frameMediaTime = Number.isFinite(metadata.mediaTime) ? metadata.mediaTime : player.currentTime;
                const frameTimelineTime = this.resolveTimelineTimeFromMediaFrame(clips, transitions, timelineTime, transitionItems, player, frameMediaTime)
                    ?? this.getMediaDrivenTimelineTime(clips, transitions, timelineTime, transitionItems)
                    ?? timelineTime;
                if (commitTime(frameTimelineTime)) scheduleNextFrame();
            });
            return true;
        };

        const tick = (timestamp) => {
            if (!this.isPlaying) return;

            if (absorbExternalSeek()) {
                this.animFrameId = requestAnimationFrame(tick);
                return;
            }

            if (lastTimestamp !== null) {
                const delta = (timestamp - lastTimestamp) / 1000 * playbackSpeed;
                const timelineTimeFromVideo = this.getMediaDrivenTimelineTime(clips, transitions, timelineTime, transitionItems);
                const waitingForVideo = timelineTimeFromVideo === null && this.hasActiveVideoWaitingForPlayback(clips, transitions, timelineTime, transitionItems);
                const fallbackTime = waitingForVideo ? timelineTime : timelineTime + delta;
                if (!commitTime(timelineTimeFromVideo ?? fallbackTime)) return;
            }

            lastTimestamp = timestamp;
            this.animFrameId = requestAnimationFrame(tick);
        };

        const scheduleNextFrame = () => {
            if (absorbExternalSeek()) {
                this.animFrameId = requestAnimationFrame(tick);
                return;
            }
            if (scheduleFrameSyncedToVideo()) return;
            this.animFrameId = requestAnimationFrame(tick);
        };

        scheduleNextFrame();
    }

    stopPlayback() {
        this.isPlaying = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.videoFrameCallbackId !== null && this.videoFrameCallbackPlayer?.cancelVideoFrameCallback) {
            this.videoFrameCallbackPlayer.cancelVideoFrameCallback(this.videoFrameCallbackId);
        }
        this.videoFrameCallbackId = null;
        this.videoFrameCallbackPlayer = null;
        this.players.forEach((player) => { player.pause?.(); });
        this.audioPlayers.forEach(player => { player.pause(); });
    }

    seekTo(clips, transitions, time, transitionItems = []) {
        this.renderFrame(clips, transitions, time, transitionItems);
    }

    dispose() {
        this.stopPlayback();
        this.players.forEach((player) => {
            player.pause?.();
            player.removeAttribute?.('src');
        });
        this.audioPlayers.forEach((player) => {
            player.pause();
            player.src = '';
        });
        this.players.clear();
        this.audioPlayers.clear();
        this.audioSourceNodes.clear();
        this.audioContext?.close?.();
        this.audioContext = null;
    }
}

// === TRANSITIONS ===
export const TRANSITIONS = [
    { id: 'crossfade', name: 'Cross Dissolve', category: 'dissolve', icon: 'CD', defaultDuration: 0.8 },
    { id: 'film-dissolve', name: 'Film Dissolve', category: 'dissolve', icon: 'FD', defaultDuration: 0.9 },
    { id: 'smooth-cut', name: 'Smooth Cut', category: 'dissolve', icon: 'SC', defaultDuration: 0.45 },
    { id: 'non-additive-dissolve', name: 'Non-Additive Dissolve', category: 'dissolve', icon: 'ND', defaultDuration: 0.75 },
    { id: 'additive-dissolve', name: 'Additive Dissolve', category: 'dissolve', icon: 'AD', defaultDuration: 0.65 },
    { id: 'dip-black', name: 'Dip to Black', category: 'dissolve', icon: 'DB', defaultDuration: 0.65 },
    { id: 'dip-white', name: 'Dip to White', category: 'dissolve', icon: 'DW', defaultDuration: 0.55 },

    { id: 'blur-dissolve', name: 'Blur Dissolve', category: 'blur', icon: 'BD', defaultDuration: 0.65 },
    { id: 'cross-blur', name: 'Cross Blur', category: 'blur', icon: 'CB', defaultDuration: 0.6 },
    { id: 'motion-blur', name: 'Motion Blur', category: 'blur', icon: 'MB', defaultDuration: 0.5 },
    { id: 'whip-pan', name: 'Whip Pan', category: 'blur', icon: 'WP', defaultDuration: 0.42 },

    { id: 'cross-zoom', name: 'Cross Zoom', category: 'zoom', icon: 'CZ', defaultDuration: 0.55 },
    { id: 'parallax-zoom', name: 'Parallax Zoom', category: 'zoom', icon: 'PZ', defaultDuration: 0.75 },
    { id: 'snap-zoom', name: 'Snap Zoom', category: 'zoom', icon: 'SZ', defaultDuration: 0.45 },

    { id: 'light-leak', name: 'Light Leak', category: 'light', icon: 'LL', defaultDuration: 0.8 },
    { id: 'flash', name: 'Flash Cut', category: 'light', icon: 'FC', defaultDuration: 0.3 },
    { id: 'strobe-cut', name: 'Strobe Cut', category: 'light', icon: 'ST', defaultDuration: 0.35 },

    { id: 'glitch', name: 'Glitch Cut', category: 'stylized', icon: 'GC', defaultDuration: 0.4 },
    { id: 'rgb-split', name: 'RGB Split', category: 'stylized', icon: 'RGB', defaultDuration: 0.45 },
    { id: 'chromatic', name: 'Chromatic Shift', category: 'stylized', icon: 'CH', defaultDuration: 0.4 },

    { id: 'intro-neon-doors', name: 'Neon Doors', category: 'intro', icon: '\u25E7', defaultDuration: 1.0 },
    { id: 'intro-title-scan', name: 'Title Scan', category: 'intro', icon: '\u25AC', defaultDuration: 1.2 },
    { id: 'intro-cinematic-bars', name: 'Cine Open', category: 'intro', icon: '\u25AC', defaultDuration: 1.0 },
    { id: 'intro-grid-reveal', name: 'Grid Reveal', category: 'intro', icon: '\u25A6', defaultDuration: 0.9 },

    { id: 'outro-neon-close', name: 'Neon Close', category: 'outro', icon: '\u25E8', defaultDuration: 1.0 },
    { id: 'outro-cinematic-fade', name: 'Cine Fade', category: 'outro', icon: '\u25AC', defaultDuration: 1.0 },
    { id: 'outro-signal-collapse', name: 'Signal Collapse', category: 'outro', icon: '\u2501', defaultDuration: 0.9 },
];

export const TRANSITION_CATEGORIES = [
    { id: 'dissolve', name: 'Dissolve' },
    { id: 'blur', name: 'Blur' },
    { id: 'zoom', name: 'Zoom' },
    { id: 'light', name: 'Light' },
    { id: 'stylized', name: 'Stylized' },
    { id: 'intro', name: 'Intro' },
    { id: 'outro', name: 'Outro' },
];

export const EXPORT_PRESETS = {
    'tiktok': { name: 'TikTok', width: 1080, height: 1920, fps: 30, label: '9:16' },
    'youtube': { name: 'YouTube', width: 1920, height: 1080, fps: 30, label: '16:9' },
    'instagram-reel': { name: 'Reel', width: 1080, height: 1920, fps: 30, label: '9:16' },
    'instagram-post': { name: 'Post', width: 1080, height: 1080, fps: 30, label: '1:1' },
    'story': { name: 'Story', width: 1080, height: 1920, fps: 30, label: '9:16' },
    'landscape': { name: 'Landscape', width: 1920, height: 1080, fps: 30, label: '16:9' },
    'portrait': { name: 'Portrait', width: 1080, height: 1350, fps: 30, label: '4:5' },
};

export const TEXT_ANIMATIONS = [
    { id: 'none', name: 'None' },
    { id: 'fade', name: 'Fade In' },
    { id: 'typewriter', name: 'Typewriter' },
    { id: 'slide-up', name: 'Slide Up' },
    { id: 'slide-down', name: 'Slide Down' },
    { id: 'scale', name: 'Scale Pop' },
    { id: 'blur-in', name: 'Blur In' },
    { id: 'reveal-up', name: 'Reveal Up' },
    { id: 'wipe-mask', name: 'Wipe Mask' },
    { id: 'neon-scan', name: 'Neon Scan' },
    { id: 'tracking-in', name: 'Tracking In' },
    { id: 'letter-pop', name: 'Letter Pop' },
];

export function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export function formatTimeFull(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
