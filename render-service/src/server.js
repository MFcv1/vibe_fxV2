import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT || 8080);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;
let storageClient = null;
/*
 * Table de correspondance transition VibeCut -> transition native `xfade` de FFmpeg.
 * Source unique de verite cote renderer. Elle doit rester identique a
 * SERVER_RENDER_CAPABILITIES.timedTransitions (exportManifest.js) et au jeu lu par
 * functions/src/videoExport.js : scripts/smoke-vibecut-transition-parity.mjs le verifie.
 * Toute entree ajoutee ici doit exister dans le build FFmpeg deploye
 * (`ffmpeg -h filter=xfade`) ET etre rendue a l'identique par VideoEngine.renderTransition.
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

const SERVER_XFADE_TRANSITIONS = new Set(Object.keys(SERVER_XFADE_TRANSITION_MAP));
const SUPPORTED_SERVER_TRANSITIONS = new Set(['cut', ...SERVER_XFADE_TRANSITIONS]);
const SUPPORTED_SERVER_FIT_MODES = new Set(['cover', 'contain']);
const SUPPORTED_SERVER_TEXT_ANIMATIONS = new Set(['none', 'fade']);
const SUPPORTED_SERVER_MEDIA_TYPES = new Set(['video', 'image']);
const SUPPORTED_SERVER_IMAGE_MOTIONS = new Set(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'drift-up']);
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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return sendJson(res, 200, { ok: true, service: 'vibecut-render-service' });
    }

    /*
     * VERIFICATION DE L'IMAGE DEPLOYEE (lot L6).
     *
     * Le lot L1 a livre 15 transitions minutees, chacune mappee sur une cible
     * native du filtre `xfade`. Rien ne garantit qu'un build FFmpeg donne les
     * expose TOUTES: une cible absente ferait echouer le rendu entier, ou - pire
     * - le ferait retomber silencieusement sur `fade`.
     *
     * Verifier « `ffmpeg -h filter=xfade` dans l'image deployee » etait jusqu'ici
     * une etape MANUELLE de la feuille de route. Elle devient un point de
     * controle interrogeable: on peut donc la rejouer apres chaque rollout, et
     * un test automatise peut la lire.
     *
     * Lecture seule, aucun rendu, aucun cout de calcul: sans authentification,
     * comme /health.
     */
    if (req.method === 'GET' && req.url === '/capabilities') {
      const report = await describeRendererCapabilities();
      return sendJson(res, report.ok ? 200 : 503, report);
    }

    if (req.method === 'POST' && req.url === '/render') {
      const { raw, data } = await readJsonBody(req);
      verifyRendererRequest(req, raw);
      const manifest = data.manifest || data;
      const validation = validateManifest(manifest);
      if (validation.errors.length) {
        return sendJson(res, 400, { status: 'failed', errors: validation.errors });
      }
      if (!data.bucket || !data.outputStoragePath) {
        return sendJson(res, 400, { status: 'failed', errors: ['bucket and outputStoragePath are required.'] });
      }

      const result = await renderJob({
        jobId: data.jobId || manifest.project?.id || `job-${Date.now()}`,
        bucketName: data.bucket,
        outputStoragePath: data.outputStoragePath,
        manifest,
      });

      return sendJson(res, 200, {
        status: 'ready',
        mode: 'cloud-run-ffmpeg',
        jobId: data.jobId || manifest.project?.id || null,
        warnings: [...validation.warnings, ...result.warnings],
        output: result.output,
        elapsedMs: result.elapsedMs,
        phaseMs: result.phaseMs || null,
        service: result.service || null,
        revision: result.revision || null,
        region: result.region || null,
        allocatedVcpu: result.allocatedVcpu || null,
        allocatedMemoryGib: result.allocatedMemoryGib || null,
      });
    }

    return sendJson(res, 404, { error: 'not-found' });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      status: 'failed',
      error: error.code || 'render-service-error',
      message: error.message || 'Unexpected renderer error',
    });
  }
});

if (isMainModule()) {
  server.listen(PORT, () => {
    console.log(`VibeCut render service listening on ${PORT}`);
  });
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function verifyRendererRequest(req, rawBody) {
  const verifyMode = getRendererVerifyMode();
  if (verifyMode === 'hmac') {
    verifySignature(req, rawBody);
    return;
  }
  if (verifyMode === 'platform-iam') {
    if (process.env.EXPORT_RENDERER_PRIVATE_IAM_CONFIRMED !== 'true') {
      const error = new Error('EXPORT_RENDERER_PRIVATE_IAM_CONFIRMED=true is required for platform-iam verification mode.');
      error.statusCode = 500;
      throw error;
    }
    return;
  }
  const error = new Error(`Unsupported EXPORT_RENDERER_VERIFY_MODE: ${verifyMode}`);
  error.statusCode = 500;
  throw error;
}

function getRendererVerifyMode() {
  return String(process.env.EXPORT_RENDERER_VERIFY_MODE || 'hmac').trim().toLowerCase();
}

function verifySignature(req, rawBody) {
  const secret = String(process.env.EXPORT_SIGNING_SECRET || '').trim();
  if (!secret) {
    const error = new Error('EXPORT_SIGNING_SECRET is required.');
    error.statusCode = 500;
    throw error;
  }
  const timestamp = Number(req.headers['x-vibecut-timestamp']);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > SIGNATURE_TOLERANCE_MS) {
    const error = new Error('Renderer signature timestamp is invalid.');
    error.statusCode = 401;
    throw error;
  }
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const received = String(req.headers['x-vibecut-signature'] || '').trim();
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    const error = new Error('Invalid renderer signature.');
    error.statusCode = 401;
    throw error;
  }
}

export function validateManifest(manifest = {}) {
  const errors = [];
  const warnings = [];
  if (manifest.version !== 1) errors.push('Unsupported manifest version.');
  if (!Array.isArray(manifest.clips) || manifest.clips.length === 0) errors.push('Manifest must contain at least one clip.');
  if (manifest.render?.format !== 'mp4') errors.push('Render format must be mp4.');
  if (manifest.render?.videoCodec !== 'h264') errors.push('Video codec must be h264.');
  if (manifest.render?.audioCodec !== 'aac') warnings.push('Audio codec should be aac.');
  if (!manifest.clips?.every((clip) => clip.sourceStoragePath)) {
    errors.push('Every clip needs a sourceStoragePath for Cloud Run rendering.');
  }

  const coverage = validateRendererCoverage(manifest);
  errors.push(...coverage.errors);
  warnings.push(...coverage.warnings);
  return { errors, warnings };
}

export function validateRendererCoverage(manifest = {}) {
  const errors = [];
  const warnings = [];
  const clips = manifest.clips || [];
  const fitMode = manifest.render?.fitMode || 'cover';

  validateTransitionCoverage(manifest.transitions || [], clips, errors);

  validateTextOverlayCoverage(manifest.textOverlays || [], errors);

  clips.forEach((clip, index) => {
    const label = clip.name || clip.id || `clip-${index + 1}`;
    const mediaType = clip.mediaType || 'video';
    if (!SUPPORTED_SERVER_MEDIA_TYPES.has(mediaType)) {
      errors.push(`Media type is not supported by server renderer: ${label}.${mediaType}.`);
    }
    if (mediaType === 'image' && !SUPPORTED_SERVER_IMAGE_MOTIONS.has(clip.motion?.preset || 'none')) {
      errors.push(`Image motion is not supported by server renderer: ${label}.${clip.motion?.preset || 'none'}.`);
    }
    const speed = Number(clip.speed ?? 1);
    if (Number.isFinite(speed) && Math.abs(speed - 1) > 0.001) {
      errors.push(`Clip speed is not rendered by server renderer: ${label}.`);
    }
    if (!SUPPORTED_SERVER_FIT_MODES.has(clip.fitMode || fitMode)) {
      errors.push(`Fit mode is not supported by server renderer: ${label}.`);
    }
    validateColorFilterCoverage(clip.filters || {}, label, errors);
  });

  if (!errors.length) {
    warnings.push('Server renderer coverage: video trims, photo scenes with Ken Burns motion, concat/xfade adjacent timed transitions, cover/contain fit, orientation rotation, basic text fade overlays, FFmpeg color filters, source clip audio, external audio mix and MP4 encode.');
  }

  return { errors: Array.from(new Set(errors)), warnings: Array.from(new Set(warnings)) };
}

function validateTransitionCoverage(transitions = [], clips = [], errors) {
  const adjacentPairs = new Set();
  for (let index = 0; index < clips.length - 1; index += 1) {
    const fromId = clips[index]?.id;
    const toId = clips[index + 1]?.id;
    if (fromId && toId) adjacentPairs.add(`${fromId}->${toId}`);
  }

  transitions.forEach((transition) => {
    const type = transition.type || 'transition';
    const duration = Number(transition.duration || 0);
    const pairKey = `${transition.fromItemId || ''}->${transition.toItemId || ''}`;
    const placement = transition.params?.placement;
    const isCutPlacement = placement === 'cut' || placement === undefined;

    if (!SUPPORTED_SERVER_TRANSITIONS.has(type)) {
      errors.push(`Transition not rendered by server renderer: ${type}.`);
      return;
    }
    if (duration <= 0) return;
    if (!SERVER_XFADE_TRANSITIONS.has(type)) {
      errors.push(`Timed transition not rendered by server renderer: ${type}.`);
      return;
    }
    if (!isCutPlacement || !adjacentPairs.has(pairKey)) {
      errors.push(`Non-adjacent transition not rendered by server renderer: ${type} ${pairKey}.`);
    }
  });
}

function validateTextOverlayCoverage(textOverlays = [], errors) {
  textOverlays.forEach((text, index) => {
    const label = text.id || `text-${index + 1}`;
    if (!String(text.content || '').trim()) {
      errors.push(`Text overlay content is empty: ${label}.`);
    }
    if (Number(text.endTime || 0) <= Number(text.startTime || 0)) {
      errors.push(`Text overlay timing is invalid: ${label}.`);
    }
    const animation = text.animation || 'fade';
    const animationOut = text.animationOut || 'fade';
    if (!SUPPORTED_SERVER_TEXT_ANIMATIONS.has(animation)) {
      errors.push(`Text animation is not rendered by server renderer: ${animation}.`);
    }
    if (!SUPPORTED_SERVER_TEXT_ANIMATIONS.has(animationOut)) {
      errors.push(`Text outro animation is not rendered by server renderer: ${animationOut}.`);
    }
  });
}

function validateColorFilterCoverage(filters = {}, label, errors) {
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (DEFAULT_FILTERS[key] === undefined && Number(value) !== 0) {
      errors.push(`Color filter is not supported by server renderer: ${label}.${key}.`);
    }
  });
}

export async function renderJob({ jobId, bucketName, outputStoragePath, manifest }) {
  const startedAt = Date.now();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `vibecut-${sanitizeName(jobId)}-`));
  const storage = await getStorageClient();
  const bucket = storage.bucket(bucketName);

  try {
    const downloadStart = Date.now();
    const videoInputs = [];
    for (const [index, clip] of manifest.clips.entries()) {
      const destination = path.join(workDir, `clip-${String(index + 1).padStart(2, '0')}${path.extname(clip.sourceStoragePath) || '.mp4'}`);
      await bucket.file(clip.sourceStoragePath).download({ destination });
      const streams = await probeMediaStreams(destination);
      videoInputs.push({ clip, file: destination, hasAudioStream: clip.mediaType === 'image' ? false : streams.hasAudio });
    }

    const audioInputs = [];
    for (const [index, track] of (manifest.audioTracks || []).entries()) {
      if (!track.sourceStoragePath) continue;
      const destination = path.join(workDir, `audio-${String(index + 1).padStart(2, '0')}${path.extname(track.sourceStoragePath) || '.m4a'}`);
      await bucket.file(track.sourceStoragePath).download({ destination });
      audioInputs.push({ track, file: destination });
    }
    const downloadMs = Date.now() - downloadStart;

    const ffmpegStart = Date.now();
    const outputFile = path.join(workDir, 'output.mp4');
    const warnings = [];
    const args = buildFfmpegArgs({ manifest, videoInputs, audioInputs, outputFile, warnings });
    await runCommand('ffmpeg', args);
    const ffmpegMs = Date.now() - ffmpegStart;

    const stat = await fs.stat(outputFile);

    const uploadStart = Date.now();
    await bucket.upload(outputFile, {
      destination: outputStoragePath,
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          product: 'vibecut',
          role: 'export-output',
          jobId,
        },
      },
    });
    const uploadMs = Date.now() - uploadStart;

    const totalElapsedMs = Date.now() - startedAt;
    const service = process.env.K_SERVICE || process.env.EXPORT_RENDERER_SERVICE || 'vibecut-render-service';
    const revision = process.env.K_REVISION || null;
    const region = process.env.FUNCTION_REGION || process.env.EXPORT_RENDERER_REGION || null;
    const allocatedVcpu = Number(process.env.EXPORT_RENDERER_ALLOCATED_VCPU || 2);
    const allocatedMemoryGib = Number(process.env.EXPORT_RENDERER_ALLOCATED_MEMORY_GIB || 2);

    return {
      elapsedMs: totalElapsedMs,
      phaseMs: {
        downloadMs,
        ffmpegMs,
        uploadMs,
      },
      service,
      revision,
      region,
      allocatedVcpu,
      allocatedMemoryGib,
      warnings,
      output: {
        storagePath: outputStoragePath,
        sizeBytes: stat.size,
        downloadUrl: null,
      },
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getStorageClient() {
  if (storageClient) return storageClient;
  const { Storage } = await import('@google-cloud/storage');
  storageClient = new Storage();
  return storageClient;
}

export function buildFfmpegArgs({ manifest, videoInputs, audioInputs, outputFile, warnings }) {
  const render = manifest.render || {};
  const width = clampInt(render.width, 1, 4096, 1920);
  const height = clampInt(render.height, 1, 4096, 1080);
  const fps = clampInt(render.fps, 1, 60, 30);
  const crf = clampInt(render.crf, 12, 28, 17);
  const preset = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'].includes(render.preset)
    ? render.preset
    : 'slow';
  const audioBitrate = Math.round(Number(render.audioBitrate || 256000) / 1000);
  const outputDuration = Math.max(0.1, Number(manifest.project?.duration || 0));
  const args = ['-hide_banner', '-y'];

  videoInputs.forEach(({ clip, file }) => {
    const trimStart = Math.max(0, Number(clip.trimStart || 0));
    const trimEnd = Math.max(trimStart + 0.1, Number(clip.trimEnd || clip.duration || trimStart + 0.1));
    if (clip.mediaType === 'image') {
      args.push('-loop', '1', '-t', String(trimEnd - trimStart), '-i', file);
    } else {
      args.push('-ss', String(trimStart), '-t', String(trimEnd - trimStart), '-i', file);
    }
  });
  audioInputs.forEach(({ file }) => args.push('-i', file));

  const filterParts = [];
  videoInputs.forEach(({ clip }, index) => {
    const rotation = rotationFilter(clip.orientationRotation);
    const colorFilters = buildColorFilterChain(clip.filters || {});
    const imageMotion = buildImageMotionFilter(clip, width, height, fps);
    filterParts.push(`[${index}:v]fps=${fps},${rotation ? `${rotation},` : ''}${fitFilter(clip.fitMode || render.fitMode, width, height)},${imageMotion ? `${imageMotion},` : ''}${colorFilters ? `${colorFilters},` : ''}format=yuv420p,setpts=PTS-STARTPTS[v${index}]`);
  });
  const videoLabel = buildVideoCompositeLabel({ videoInputs, transitions: manifest.transitions || [], filterParts });
  const finalVideoLabel = appendTextOverlayFilters({
    filterParts,
    inputLabel: videoLabel,
    textOverlays: manifest.textOverlays || [],
    width,
    height,
  });
  const audioLabels = [];
  const clipTimelineSegments = buildClipTimelineSegments({ videoInputs, transitions: manifest.transitions || [] });
  videoInputs.forEach(({ clip, hasAudioStream }, index) => {
    const volume = clampNumber(Number(clip.volume ?? 100) / 100, 0, 2, 1);
    if (volume <= 0) return;
    if (!hasAudioStream) {
      warnings.push(`Clip source audio requested but no audio stream was detected: ${clip.name || clip.id || `clip-${index + 1}`}.`);
      return;
    }
    const duration = clipTimelineSegments[index]?.duration || getClipRenderDuration(clip);
    const delayMs = Math.max(0, Math.round((clipTimelineSegments[index]?.start || 0) * 1000));
    filterParts.push(`[${index}:a]atrim=start=0:end=${formatNumber(duration)},asetpts=PTS-STARTPTS,volume=${formatNumber(volume)},adelay=${delayMs}:all=1[aclip${index}]`);
    audioLabels.push(`[aclip${index}]`);
  });
  audioInputs.forEach(({ track }, index) => {
    const inputIndex = videoInputs.length + index;
    const trimStart = Math.max(0, Number(track.trimStart || 0));
    const trimEnd = Math.max(trimStart + 0.1, Number(track.trimEnd || track.duration || trimStart + 0.1));
    const delayMs = Math.max(0, Math.round(Number(track.startTime || 0) * 1000));
    const volume = clampNumber(Number(track.volume ?? 100) / 100, 0, 2, 1);
    // Fondus: memes bornes que `resolveAudioFadeVolume` cote apercu.
    const span = Math.max(0.1, trimEnd - trimStart);
    const fadeIn = clampNumber(Number(track.fadeIn || 0), 0, span / 2, 0);
    const fadeOut = clampNumber(Number(track.fadeOut || 0), 0, span / 2, 0);
    const fadeParts = [];
    if (fadeIn > 0) fadeParts.push(`afade=t=in:st=0:d=${formatNumber(fadeIn)}`);
    if (fadeOut > 0) fadeParts.push(`afade=t=out:st=${formatNumber(span - fadeOut)}:d=${formatNumber(fadeOut)}`);
    const fadeChain = fadeParts.length > 0 ? `,${fadeParts.join(',')}` : '';
    filterParts.push(`[${inputIndex}:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS,volume=${volume}${fadeChain},adelay=${delayMs}:all=1[aext${index}]`);
    audioLabels.push(`[aext${index}]`);
  });
  if (audioLabels.length === 1) {
    filterParts.push(`${audioLabels[0]}anull[aout]`);
  } else if (audioLabels.length > 1) {
    filterParts.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[aout]`);
  }

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', finalVideoLabel);
  if (audioLabels.length) {
    args.push('-map', '[aout]');
  } else {
    args.push('-an');
    warnings.push('No source or external audio track was rendered by the FFmpeg MVP.');
  }
  args.push(
    ...buildVideoEncoderArgs({ render, crf, preset }),
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', `${audioBitrate}k`,
    '-movflags', '+faststart',
    '-t', String(outputDuration),
    outputFile
  );
  return args;
}

export function buildVideoEncoderArgs({ render = {}, crf = 17, preset = 'slow' } = {}) {
  const accelerator = String(
    process.env.VIBECUT_FFMPEG_ACCELERATOR ||
    render.acceleration ||
    'cpu'
  ).trim().toLowerCase();
  if (accelerator === 'nvidia' || accelerator === 'gpu') {
    return [
      '-c:v', 'h264_nvenc',
      '-preset', 'p5',
      '-tune', 'hq',
      '-rc', 'vbr',
      '-cq', String(crf),
      '-b:v', '0',
    ];
  }
  return [
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', String(crf),
  ];
}

function buildVideoCompositeLabel({ videoInputs, transitions = [], filterParts }) {
  if (videoInputs.length <= 1) return '[v0]';

  let currentLabel = '[v0]';
  let currentDuration = getClipRenderDuration(videoInputs[0].clip);

  for (let index = 1; index < videoInputs.length; index += 1) {
    const previousClip = videoInputs[index - 1].clip;
    const nextClip = videoInputs[index].clip;
    const nextLabel = `[v${index}]`;
    const outputLabel = `[vseq${index}]`;
    const transition = findAdjacentTransition(transitions, previousClip.id, nextClip.id);
    const nextDuration = getClipRenderDuration(nextClip);
    const transitionDuration = transition
      ? getSafeTransitionDuration(transition, currentDuration, nextDuration)
      : 0;

    if (transition && transitionDuration > 0) {
      const offset = Math.max(0, currentDuration - transitionDuration);
      const xfadeName = resolveXfadeTransitionName(transition.type);
      filterParts.push(`${currentLabel}${nextLabel}xfade=transition=${xfadeName}:duration=${formatNumber(transitionDuration)}:offset=${formatNumber(offset)}${outputLabel}`);
      currentDuration += nextDuration - transitionDuration;
    } else {
      filterParts.push(`${currentLabel}${nextLabel}concat=n=2:v=1:a=0${outputLabel}`);
      currentDuration += nextDuration;
    }
    currentLabel = outputLabel;
  }

  return currentLabel;
}

function buildClipTimelineSegments({ videoInputs, transitions = [] }) {
  if (!videoInputs.length) return [];
  const segments = [{ start: 0, duration: getClipRenderDuration(videoInputs[0].clip) }];
  let currentDuration = segments[0].duration;

  for (let index = 1; index < videoInputs.length; index += 1) {
    const previousClip = videoInputs[index - 1].clip;
    const nextClip = videoInputs[index].clip;
    const nextDuration = getClipRenderDuration(nextClip);
    const transition = findAdjacentTransition(transitions, previousClip.id, nextClip.id);
    const transitionDuration = transition ? getSafeTransitionDuration(transition, currentDuration, nextDuration) : 0;
    const start = Math.max(0, currentDuration - transitionDuration);
    segments.push({ start, duration: nextDuration });
    currentDuration += nextDuration - transitionDuration;
  }

  return segments;
}

/*
 * Repli volontaire sur `fade` pour tout id inconnu: un identifiant absent du build
 * FFmpeg deploye ferait echouer le rendu entier, un fondu simple degrade proprement.
 */
export function resolveXfadeTransitionName(type) {
  return SERVER_XFADE_TRANSITION_MAP[type] || 'fade';
}

function findAdjacentTransition(transitions = [], fromId, toId) {
  if (!fromId || !toId) return null;
  return transitions.find((transition) => {
    const type = transition.type || 'transition';
    const placement = transition.params?.placement;
    return transition.fromItemId === fromId
      && transition.toItemId === toId
      && (placement === 'cut' || placement === undefined)
      && SERVER_XFADE_TRANSITIONS.has(type)
      && Number(transition.duration || 0) > 0;
  }) || null;
}

function getClipRenderDuration(clip = {}) {
  const trimStart = Math.max(0, Number(clip.trimStart || 0));
  const trimEnd = Math.max(trimStart + 0.1, Number(clip.trimEnd || clip.duration || trimStart + 0.1));
  return Math.max(0.1, trimEnd - trimStart);
}

function getSafeTransitionDuration(transition, currentDuration, nextDuration) {
  return Math.min(
    Number(transition.duration || 0),
    Math.max(0, currentDuration - 0.05),
    Math.max(0, nextDuration - 0.05)
  );
}

function appendTextOverlayFilters({ filterParts, inputLabel, textOverlays = [], width, height }) {
  let currentLabel = inputLabel;
  textOverlays.forEach((text, index) => {
    const nextLabel = `[vtext${index}]`;
    filterParts.push(`${currentLabel}${buildDrawTextFilter(text, width, height)}${nextLabel}`);
    currentLabel = nextLabel;
  });
  return currentLabel;
}

function buildDrawTextFilter(text = {}, width, height) {
  const start = Math.max(0, Number(text.startTime || 0));
  const end = Math.max(start + 0.1, Number(text.endTime || start + 0.1));
  const duration = Math.max(0.1, end - start);
  const fadeIn = text.animation === 'none' ? 0 : Math.min(0.35, duration / 4);
  const fadeOut = text.animationOut === 'none' ? 0 : Math.min(0.35, duration / 4);
  const alpha = buildTextAlphaExpression({ start, end, fadeIn, fadeOut });
  const fontSize = clampInt(Number(text.fontSize || 48) * (width / 1920), 12, Math.round(height * 0.18), 48);
  const x = clampNumber(Number(text.x ?? 0.5), 0, 1, 0.5);
  const y = clampNumber(Number(text.y ?? 0.5), 0, 1, 0.5);
  const xExpr = `w*${formatNumber(x)}-text_w/2`;
  const yExpr = `h*${formatNumber(y)}-text_h/2`;
  const fontColor = normalizeDrawTextColor(text.color || '#ffffff');
  const escapedText = escapeDrawText(String(text.content || '').slice(0, 240));
  // Fond ou contour: meme rendu que l'apercu navigateur (voir
  // `engine/textOverlayRenderer.js`), pour que l'export soit fidele.
  const boxStyle = text.boxStyle === 'box' || text.boxStyle === 'outline' ? text.boxStyle : 'none';
  const boxColor = normalizeDrawTextColor(text.boxColor || '#000000');
  const outlineWidth = boxStyle === 'outline'
    ? Math.max(2, Math.round(fontSize * 0.05))
    : (text.bold ? Math.max(1, Math.round(fontSize * 0.035)) : 0);

  const options = [
    `text='${escapedText}'`,
    `x='${xExpr}'`,
    `y='${yExpr}'`,
    `fontsize=${fontSize}`,
    `fontcolor=${fontColor}`,
    `alpha='${alpha}'`,
    `enable='between(t,${formatNumber(start)},${formatNumber(end)})'`,
    `line_spacing=${Math.round(fontSize * 0.22)}`,
    `borderw=${outlineWidth}`,
    `bordercolor=${boxStyle === 'outline' ? boxColor : '0x00000099'}`,
  ];

  if (boxStyle === 'box') {
    options.push('box=1', `boxcolor=${boxColor}@0.78`, `boxborderw=${Math.round(fontSize * 0.3)}`);
  } else {
    options.push(
      'shadowcolor=0x00000088',
      `shadowx=${Math.max(1, Math.round(fontSize * 0.04))}`,
      `shadowy=${Math.max(1, Math.round(fontSize * 0.04))}`,
    );
  }
  return `drawtext=${options.join(':')}`;
}

function buildColorFilterChain(filters = {}) {
  const grade = normalizeColorFilters(filters);
  const filtersOut = [];
  const exposureMultiplier = Math.pow(2, grade.exposure / 100);
  const pivotCompensation = 100 + ((50 - grade.pivot) * Math.max(0, grade.contrast - 100) * 0.018);
  const brightnessPercent = clampNumber(grade.brightness * exposureMultiplier * (pivotCompensation / 100), 0, 260, 100);
  const brightness = clampNumber((brightnessPercent - 100) / 220, -1, 1, 0);
  const contrast = clampNumber(grade.contrast / 100, 0, 2.6, 1);
  const saturation = clampNumber((grade.saturation + grade.vibrance * 0.58) / 100, 0, 2.6, 1);

  if (Math.abs(brightness) > 0.0001 || Math.abs(contrast - 1) > 0.0001 || Math.abs(saturation - 1) > 0.0001) {
    filtersOut.push(`eq=brightness=${formatNumber(brightness)}:contrast=${formatNumber(contrast)}:saturation=${formatNumber(saturation)}`);
  }
  if (Math.abs(grade.hue) > 0.0001) {
    filtersOut.push(`hue=h=${formatNumber(grade.hue)}`);
  }

  const balance = buildColorBalance(grade);
  if (balance) filtersOut.push(balance);

  const fade = clampNumber(grade.fade / 100, 0, 1, 0);
  if (fade > 0) {
    const lift = formatNumber(fade * 0.08);
    filtersOut.push(`colorlevels=rimin=${lift}:gimin=${lift}:bimin=${lift}`);
  }
  if (grade.vignette > 0) {
    const angle = formatNumber(Math.PI / 4 + (grade.vignette / 100) * 0.35);
    filtersOut.push(`vignette=angle=${angle}:eval=frame`);
  }
  if (grade.grain > 0) {
    filtersOut.push(`noise=alls=${clampInt(grade.grain / 2, 1, 50, 1)}:allf=t+u`);
  }

  return filtersOut.join(',');
}

function normalizeColorFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_FILTERS).map(([key, defaultValue]) => {
      const rawValue = Number(filters[key] ?? defaultValue);
      const value = Number.isFinite(rawValue) ? rawValue : defaultValue;
      if (key === 'brightness' || key === 'contrast' || key === 'saturation') return [key, clampNumber(value, 0, 200, defaultValue)];
      if (key === 'hue') return [key, clampNumber(value, -180, 180, defaultValue)];
      if (key === 'fade' || key === 'vignette' || key === 'grain') return [key, clampNumber(value, 0, 100, defaultValue)];
      if (key === 'pivot') return [key, clampNumber(value, 0, 100, defaultValue)];
      return [key, clampNumber(value, -100, 100, defaultValue)];
    })
  );
}

function buildColorBalance(grade) {
  const temperature = clampNumber(grade.temperature / 500, -0.2, 0.2, 0);
  const tint = clampNumber(grade.tint / 650, -0.15, 0.15, 0);
  const shadows = clampNumber(grade.shadows / 700, -0.14, 0.14, 0);
  const midtones = clampNumber(grade.midtones / 850, -0.12, 0.12, 0);
  const highlights = clampNumber(grade.highlights / 700, -0.14, 0.14, 0);
  const values = {
    rs: shadows + temperature - tint * 0.25,
    gs: shadows + tint,
    bs: shadows - temperature - tint * 0.25,
    rm: midtones + temperature - tint * 0.2,
    gm: midtones + tint,
    bm: midtones - temperature - tint * 0.2,
    rh: highlights + temperature - tint * 0.15,
    gh: highlights + tint,
    bh: highlights - temperature - tint * 0.15,
  };
  const options = Object.entries(values)
    .map(([key, value]) => [key, clampNumber(value, -1, 1, 0)])
    .filter(([, value]) => Math.abs(value) > 0.0001)
    .map(([key, value]) => `${key}=${formatNumber(value)}`);
  return options.length ? `colorbalance=${options.join(':')}` : '';
}

function buildTextAlphaExpression({ start, end, fadeIn, fadeOut }) {
  const startValue = formatNumber(start);
  const endValue = formatNumber(end);
  const fadeInEnd = formatNumber(start + fadeIn);
  const fadeOutStart = formatNumber(end - fadeOut);
  if (fadeIn > 0 && fadeOut > 0) {
    return `if(lt(t,${fadeInEnd}),(t-${startValue})/${formatNumber(fadeIn)},if(gt(t,${fadeOutStart}),(${endValue}-t)/${formatNumber(fadeOut)},1))`;
  }
  if (fadeIn > 0) {
    return `if(lt(t,${fadeInEnd}),(t-${startValue})/${formatNumber(fadeIn)},1)`;
  }
  if (fadeOut > 0) {
    return `if(gt(t,${fadeOutStart}),(${endValue}-t)/${formatNumber(fadeOut)},1)`;
  }
  return '1';
}

function escapeDrawText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function normalizeDrawTextColor(value = '#ffffff') {
  const color = String(value || '').trim();
  const longHex = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (longHex) return `0x${longHex[1].toLowerCase()}`;
  const shortHex = color.match(/^#?([0-9a-fA-F]{3})$/);
  if (shortHex) {
    const expanded = shortHex[1].split('').map((char) => `${char}${char}`).join('');
    return `0x${expanded.toLowerCase()}`;
  }
  return '0xffffff';
}

function fitFilter(fitMode, width, height) {
  if (fitMode === 'contain') {
    return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
  }
  return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
}

/*
 * Mouvement de photo (Ken Burns), lot L3 du 2026-07-30.
 *
 * Trois choses tenues ici, et chacune corrige un ecart mesure contre l'apercu
 * (`mediaModel.applyImageMotionTransform`), pas un ecart suppose:
 *
 *  1. COURBE. L'apercu lisse la progression (`smoothstep`, p^2*(3-2p)); cette
 *     expression etait strictement lineaire depuis l'origine. Un zoom partait
 *     donc doucement a l'ecran et sec a l'export. Le `smoothstep` est ecrit
 *     dans l'expression, pas approche.
 *  2. INTENSITE. L'ecart start -> end est multiplie par `motion.intensity`.
 *     Meme formule des deux cotes: la parite ne depend d'aucune surveillance.
 *  3. DECALAGE DIVISE PAR LE ZOOM. L'apercu translate l'image APRES l'avoir
 *     agrandie, donc son decalage vaut x/zoom en coordonnees source. Ecrire
 *     `-(x)*iw` faisait voyager les panoramiques ~11 % trop loin a l'export
 *     (zoom 1,12). `zoom` est disponible dans les expressions x et y.
 *
 * Reste un ecart structurel non reductible: `zoompan` positionne la fenetre sur
 * des pixels ENTIERS, le canvas non. Le test de parite le borne.
 */
function buildImageMotionFilter(clip = {}, width, height, fps) {
  if ((clip.mediaType || 'video') !== 'image') return '';
  const motion = normalizeImageMotionForRender(clip.motion);
  if (motion.preset === 'none' || motion.intensity <= 0) return '';
  const duration = getClipRenderDuration(clip);
  const frameCount = Math.max(2, Math.round(duration * fps));
  const progress = `min(on/${frameCount - 1},1)`;
  // smoothstep: p*p*(3-2*p), evalue une fois et reutilise par les trois axes.
  const eased = `(${progress})*(${progress})*(3-2*(${progress}))`;
  const travel = motion.intensity >= 1 ? eased : `${formatNumber(motion.intensity)}*${eased}`;
  const interpolate = (start, end) => `${formatNumber(start)}+(${formatNumber(end - start)})*${travel}`;
  const zoom = interpolate(motion.start.scale, motion.end.scale);
  const x = interpolate(motion.start.x, motion.end.x);
  const y = interpolate(motion.start.y, motion.end.y);
  return `zoompan=z='${zoom}':x='(iw-iw/zoom)/2-(${x})*iw/zoom':y='(ih-ih/zoom)/2-(${y})*ih/zoom':d=1:s=${width}x${height}:fps=${fps}`;
}

function normalizeImageMotionForRender(motion = {}) {
  const presets = {
    none: { start: { scale: 1, x: 0, y: 0 }, end: { scale: 1, x: 0, y: 0 } },
    'zoom-in': { start: { scale: 1, x: 0, y: 0 }, end: { scale: 1.14, x: 0, y: 0 } },
    'zoom-out': { start: { scale: 1.14, x: 0, y: 0 }, end: { scale: 1, x: 0, y: 0 } },
    'pan-left': { start: { scale: 1.12, x: 0.055, y: 0 }, end: { scale: 1.12, x: -0.055, y: 0 } },
    'pan-right': { start: { scale: 1.12, x: -0.055, y: 0 }, end: { scale: 1.12, x: 0.055, y: 0 } },
    'drift-up': { start: { scale: 1.1, x: 0, y: 0.045 }, end: { scale: 1.14, x: 0, y: -0.045 } },
  };
  const presetName = SUPPORTED_SERVER_IMAGE_MOTIONS.has(motion?.preset) ? motion.preset : 'none';
  const preset = presets[presetName];
  const normalizeFrame = (frame, fallback) => ({
    scale: clampNumber(Number(frame?.scale), 1, 2, fallback.scale),
    x: clampNumber(Number(frame?.x), -0.35, 0.35, fallback.x),
    y: clampNumber(Number(frame?.y), -0.35, 0.35, fallback.y),
  });
  return {
    preset: presetName,
    // Absente du manifeste = mouvement plein, comme avant le lot L3.
    intensity: clampNumber(Number(motion?.intensity), 0, 1, 1),
    start: normalizeFrame(motion?.start, preset.start),
    end: normalizeFrame(motion?.end, preset.end),
  };
}

function rotationFilter(value) {
  const rotation = ((Math.round(Number(value || 0) / 90) * 90) % 360 + 360) % 360;
  if (rotation === 90) return 'transpose=1';
  if (rotation === 180) return 'hflip,vflip';
  if (rotation === 270) return 'transpose=2';
  return '';
}

async function probeMediaStreams(file) {
  try {
    const stdout = await runCommandCapture('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_streams',
      file,
    ]);
    const data = JSON.parse(stdout || '{}');
    const streams = Array.isArray(data.streams) ? data.streams : [];
    return {
      hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
      hasVideo: streams.some((stream) => stream.codec_type === 'video'),
    };
  } catch {
    return { hasAudio: false, hasVideo: false };
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-6000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      const error = new Error(`FFmpeg failed with code ${code}: ${stderr}`);
      error.statusCode = 500;
      return reject(error);
    });
  });
}

/*
 * Ce que l'image DEPLOYEE sait reellement faire (lot L6).
 *
 * On interroge FFmpeg lui-meme plutot que de declarer une liste: une liste
 * declaree dirait ce qu'on espere, pas ce qui est installe. `ffmpeg -h
 * filter=xfade` ecrit ses transitions sur stdout ou stderr selon les builds, on
 * lit donc les deux.
 *
 * =========================================================================
 * SUBTILITE A CONNAITRE AVANT DE MODIFIER CETTE FONCTION (decidee 2026-08-01)
 *
 * `GET /capabilities` est SANS AUTHENTIFICATION, et le service Cloud Run est
 * PUBLIC (`allUsers` a `roles/run.invoker`). N'importe qui sur Internet peut
 * donc lire cette reponse. Seul `/render` est protege, par signature HMAC.
 *
 * Consequence: **la reponse ne doit contenir AUCUNE empreinte de version ni
 * aucun texte d'erreur brut.** Une banniere « FFmpeg 6.0, compile avec ... »
 * renseigne gratuitement quelqu'un qui cherche les CVE applicables a ce build
 * precis; un `stderr` recopie tel quel peut fuiter des chemins internes.
 *
 * La version EST toujours relevee, mais elle part dans les JOURNAUX Cloud Run
 * (`console.log` ci-dessous), pas dans la reponse HTTP. Pour la retrouver:
 *
 *   gcloud run services logs read vibecut-render-service \
 *     --region europe-west9 --project vibefx-v2 --limit 50 | grep capabilities
 *
 * Ce que la reponse publique doit contenir, et rien de plus: de quoi repondre
 * a UNE question — « ce build rend-il les 15 transitions du lot L1, oui ou
 * non, et si non lesquelles manquent ». Les noms de transitions sont deja
 * publics (ils sont dans l'interface), donc les exposer ne coute rien.
 *
 * Si un jour le service passe en Cloud Run PRIVE (IAM), cette precaution
 * devient facultative — mais la retirer ne rapporterait rien non plus.
 * =========================================================================
 */
async function describeRendererCapabilities() {
  const wanted = [...new Set(Object.values(SERVER_XFADE_TRANSITION_MAP))].sort();
  // Detail complet, destine aux JOURNAUX uniquement. Jamais renvoye au client.
  const privateDiagnostics = { ffmpeg: null, failures: [] };
  const report = {
    ok: false,
    service: 'vibecut-render-service',
    // La revision est deja lisible par quiconque appelle le service: elle
    // n'ajoute aucune information exploitable, et elle est indispensable pour
    // savoir QUELLE image on vient d'interroger apres un rollout.
    revision: process.env.K_REVISION || null,
    capabilitiesVersion: 4,
    xfade: { required: wanted, missing: wanted, available: null },
    // Un COMPTEUR, pas les messages: « 1 erreur » suffit a faire echouer le
    // pre-vol, et le detail est dans les journaux.
    errorCount: 0,
  };

  try {
    const version = await runCommandCapture('ffmpeg', ['-version']).catch((error) => String(error));
    privateDiagnostics.ffmpeg = String(version).split('\n')[0] || null;
  } catch (error) {
    privateDiagnostics.failures.push(`ffmpeg -version: ${error.message}`);
  }

  try {
    /*
     * `-h filter=...` sort en code 0 mais ecrit parfois sur stderr; on ne peut
     * donc pas se contenter de stdout. `runCommandCapture` rejette sur code != 0,
     * d'ou le repli qui recupere quand meme le texte de l'erreur.
     */
    const help = await runCommandCapture('ffmpeg', ['-hide_banner', '-h', 'filter=xfade'])
      .catch((error) => String(error.message || error));
    const text = String(help);
    /*
     * Les noms de transitions apparaissent comme des constantes de l'option
     * `transition`. On teste chaque cible ATTENDUE par delimiteur de mot plutot
     * que d'essayer de parser toute la sortie: le format de `-h filter` varie
     * d'une version a l'autre, la presence d'un nom, non.
     */
    const available = wanted.filter((name) => new RegExp(`\\b${name}\\b`).test(text));
    report.xfade.available = available;
    report.xfade.missing = wanted.filter((name) => !available.includes(name));
    if (!text.includes('xfade')) {
      privateDiagnostics.failures.push('Le filtre xfade est absent de ce build FFmpeg.');
    }
  } catch (error) {
    privateDiagnostics.failures.push(`ffmpeg -h filter=xfade: ${error.message}`);
  }

  report.errorCount = privateDiagnostics.failures.length;
  report.ok = report.errorCount === 0 && report.xfade.missing.length === 0;

  // Le detail va dans les journaux Cloud Run, jamais dans la reponse HTTP.
  console.log('[capabilities]', JSON.stringify({
    ok: report.ok,
    revision: report.revision,
    ffmpeg: privateDiagnostics.ffmpeg,
    missing: report.xfade.missing,
    failures: privateDiagnostics.failures,
  }));

  return report;
}

function runCommandCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout = `${stdout}${chunk.toString('utf8')}`.slice(-2 * 1024 * 1024);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-6000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve(stdout);
      const error = new Error(`${command} failed with code ${code}: ${stderr}`);
      error.statusCode = 500;
      return reject(error);
    });
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        const error = new Error('Request body too large.');
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve({ raw, data: raw ? JSON.parse(raw) : {} });
      } catch {
        const error = new Error('Invalid JSON body.');
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function clampInt(value, min, max, fallback) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, '');
}

function sanitizeName(value) {
  return String(value || 'job').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 80);
}
