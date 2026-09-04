/*
 * Export video.
 *
 * Deux chemins, dans cet ordre :
 *
 * 1. WebCodecs. On encode nous-memes chaque image et on l'emballe en MP4. Rien
 *    ne depend de l'horloge : l'export va aussi vite que la machine, la video a
 *    exactement le nombre d'images demande, et aucune n'est sautee.
 *
 * 2. MediaRecorder, seulement si WebCodecs manque. Celui-la enregistre en temps
 *    reel : il donne un WebM, il dure aussi longtemps que la boucle, et il peut
 *    sauter des images. C'est un filet de secours, pas le chemin normal.
 */

import { buildMp4 } from './mp4.js';

export const hasWebCodecs = () => typeof VideoEncoder !== 'undefined'
    && typeof VideoFrame !== 'undefined';

const WEBM_CANDIDATES = [
    ['video/webm;codecs=vp9', 'WebM (VP9)', 'webm'],
    ['video/webm;codecs=vp8', 'WebM (VP8)', 'webm'],
    ['video/webm', 'WebM', 'webm'],
];

export function availableFormats() {
    const out = [];
    if (hasWebCodecs()) out.push(['mp4', 'MP4 (H.264)', 'mp4']);
    if (typeof MediaRecorder !== 'undefined') {
        const found = WEBM_CANDIDATES.find(([mime]) => MediaRecorder.isTypeSupported(mime));
        if (found) out.push(['webm', found[1], 'webm', found[0]]);
    }
    return out;
}

// Definition demandee -> taille du rendu, en respectant le ratio du cadre.
export function exportSize(frameRatio, shortSide) {
    const long = Math.round(shortSide * Math.max(frameRatio, 1 / frameRatio));
    const w = frameRatio >= 1 ? long : shortSide;
    const h = frameRatio >= 1 ? shortSide : long;
    // Les encodeurs H.264 veulent des dimensions paires.
    return [w - (w % 2), h - (h % 2)];
}

/*
 * Niveaux H.264, du plus leger au plus lourd : taille d'image maximale en
 * macroblocs, et debit de macroblocs par seconde.
 */
const AVC_LEVELS = [
    ['1f', 3600, 108_000],       // 3.1
    ['28', 8192, 245_760],       // 4.0
    ['2a', 8704, 522_240],       // 4.2
    ['32', 22_080, 589_824],     // 5.0
    ['33', 36_864, 983_040],     // 5.1
    ['34', 36_864, 2_073_600],   // 5.2
    ['3c', 139_264, 4_177_920],  // 6.0
    ['3d', 139_264, 8_355_840],  // 6.1
    ['3e', 139_264, 16_711_680], // 6.2
];

function baseConfig(width, height, fps) {
    return {
        width,
        height,
        framerate: fps,
        // Un debit genereux : ces boucles sont pleines d'aplats nets et de bords
        // francs, que la compression abime tres vite.
        bitrate: targetBitrate(width, height, fps),
        avc: { format: 'avc' },
        latencyMode: 'quality',
    };
}

/*
 * Le niveau H.264 le plus leger qui tienne la definition demandee — et que ce
 * navigateur sache reellement encoder. Le calcul theorique ne suffit pas : en
 * 8K un niveau existe sur le papier sans qu'aucun encodeur de la machine ne le
 * prenne. On sonde donc, plutot que de laisser `configure()` echouer en plein
 * export.
 */
export async function pickCodec(width, height, fps) {
    const mbs = Math.ceil(width / 16) * Math.ceil(height / 16);
    const rate = mbs * fps;
    const usable = AVC_LEVELS.filter(([, maxMb, maxRate]) => mbs <= maxMb && rate <= maxRate);
    for (const [level] of usable) {
        const codec = `avc1.6400${level}`;
        const probe = await VideoEncoder.isConfigSupported({
            codec, ...baseConfig(width, height, fps),
        });
        if (probe.supported) return codec;
    }
    return null;
}

// Debit vise, en bits par seconde. Sert aussi au recapitulatif de la modale,
// pour que le poids annonce soit celui qu'on utilise vraiment.
export const targetBitrate = (width, height, fps) => Math.min(
    120_000_000, Math.round(width * height * fps * 0.14),
);

export async function encodeMp4({
    drawFrame, canvas, width, height, fps, duration, loops = 1, onProgress, signal,
}) {
    // Les boucles enchainees rejouent le meme parcours : on encode simplement
    // plus d'images, la position dans la boucle repart de zero a chaque tour.
    const perLoop = Math.max(1, Math.round(duration * fps));
    const total = perLoop * Math.max(1, loops);
    const samples = [];
    let description = null;
    let failure = null;

    const encoder = new VideoEncoder({
        output: (chunk, meta) => {
            if (meta?.decoderConfig?.description && !description) {
                description = new Uint8Array(meta.decoderConfig.description);
            }
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            samples.push({ data, key: chunk.type === 'key' });
        },
        error: (e) => { failure = e; },
    });

    const codec = await pickCodec(width, height, fps);
    if (!codec) {
        encoder.close();
        throw new Error(`ce navigateur ne sait pas encoder du H.264 en ${width}×${height}`);
    }
    encoder.configure({ codec, ...baseConfig(width, height, fps) });

    for (let i = 0; i < total; i += 1) {
        if (signal?.aborted) break;
        if (failure) throw failure;
        drawFrame((i % perLoop) / perLoop);
        const frame = new VideoFrame(canvas, {
            timestamp: Math.round((i / fps) * 1_000_000),
            duration: Math.round(1_000_000 / fps),
        });
        // Une image cle toutes les deux secondes : la lecture reste fluide au
        // scrub, et la boucle demarre toujours sur une image complete.
        encoder.encode(frame, { keyFrame: i % Math.max(1, Math.round(fps * 2)) === 0 });
        frame.close();
        onProgress?.((i + 1) / total * 0.9);
        // On laisse l'encodeur respirer plutot que de saturer sa file.
        if (encoder.encodeQueueSize > 8) {
            await new Promise((r) => { encoder.ondequeue = r; });
        }
    }

    await encoder.flush();
    encoder.close();
    if (failure) throw failure;
    if (!description) throw new Error("l'encodeur n'a pas fourni d'en-tete H.264");
    onProgress?.(1);

    return {
        blob: buildMp4({
            samples, width, height, fps, description,
        }),
        exact: true,
    };
}

export async function recordWebm({
    canvas, drawFrame, duration, fps, mime, loops = 1, onProgress, signal,
}) {
    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const chunks = [];
    const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: Math.min(90_000_000, canvas.width * canvas.height * fps * 0.12),
    });
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    const perLoop = Math.max(1, Math.round(duration * fps));
    const total = perLoop * Math.max(1, loops);
    const frameMs = 1000 / fps;
    const done = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start();

    const started = performance.now();
    for (let i = 0; i < total; i += 1) {
        if (signal?.aborted) break;
        drawFrame((i % perLoop) / perLoop);
        track.requestFrame();
        onProgress?.((i + 1) / total);
        const wait = started + (i + 1) * frameMs - performance.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }

    recorder.stop();
    track.stop();
    await done;
    const realMs = performance.now() - started;
    return {
        blob: new Blob(chunks, { type: mime.split(';')[0] }),
        exact: realMs <= duration * loops * 1000 * 1.25,
    };
}

export function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
