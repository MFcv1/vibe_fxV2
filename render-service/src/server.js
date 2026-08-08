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

  /*
   * Lot B3a (2026-08-02). Voir exportManifest.js pour le detail : huit entrees
   * du catalogue passent de « aperçu uniquement » a une cible xfade native, et
   * dix cibles nouvelles entrent au catalogue. Toutes existent dans le build
   * FFmpeg de reference (`ffmpeg -h filter=xfade` : les 46 cibles natives).
   *
   * ATTENTION : cette table n'est effective qu'apres un rollout Cloud Run. Tant
   * que la revision deployee est anterieure, le renderer en production ignore
   * ces cles et retombe sur `fade`.
   */
  'smooth-cut': 'fade',
  'non-additive-dissolve': 'fade',
  'whip-pan': 'slideleft',
  flash: 'fadewhite',
  'intro-cinematic-bars': 'horzopen',
  'outro-cinematic-fade': 'fadeblack',
  'outro-neon-close': 'vertclose',
  'outro-signal-collapse': 'squeezev',

  'wipe-right': 'wiperight',
  'wipe-up': 'wipeup',
  'wipe-down': 'wipedown',
  'push-right': 'slideright',
  'swipe-up': 'smoothup',
  'swipe-down': 'smoothdown',
  'bars-close': 'horzclose',
  'iris-black': 'circlecrop',
  'frame-black': 'rectcrop',
  'squeeze-h': 'squeezeh',

  /*
   * Lot B3b (2026-08-03). Ces entrees-la n'ont PAS de cible native qui rende
   * leur effet : la cible nommee ici n'est que la JOINTURE, l'effet lui-meme
   * vient du sous-graphe declare dans SERVER_TRANSITION_EFFECTS.
   */
  'blur-dissolve': 'fade',
  'cross-blur': 'fade',
  'motion-blur': 'fade',
  'cross-zoom': 'fade',
  'snap-zoom': 'fade',
  'parallax-zoom': 'fade',
  'additive-dissolve': 'fade',
  'rgb-split': 'fade',
  'chromatic': 'fade',
  'intro-title-scan': 'wiperight',
  'intro-neon-doors': 'vertopen',
  'strobe-cut': 'fade',
  'intro-grid-reveal': 'fade',
  'glitch': 'fade',
  'light-leak': 'fade',
});

/*
 * Lot B3b (2026-08-03) - les 15 dernieres transitions.
 *
 * Aucune cible `xfade` native ne rend ces effets-la. La voie
 * `xfade=transition=custom:expr=` les rendrait toutes, mais elle a ete MESUREE
 * le 2026-08-02 a 8,6 s pour une transition de 0,6 s en 1080p contre 0,2 s en
 * natif - un facteur ~40 inherent a l'evaluateur d'expressions de FFmpeg. Sur un
 * service facture a la seconde, elle est ecartee.
 *
 * La voie retenue applique de VRAIS FILTRES NATIFS, rampes dans le temps, sur la
 * QUEUE du plan sortant et la TETE du plan entrant, puis joint par un `xfade`
 * natif. Un « fondu floute », c'est exactement ca : un flou qui monte, un fondu,
 * un flou qui redescend.
 *
 * Cette table est PUREMENT DECLARATIVE, et c'est volontaire : les memes nombres
 * sont lus par le renderer (buildTransitionSubgraph, plus bas) ET par l'apercu
 * canvas (engine/xfadeTransitions.js). Aucune constante d'effet n'est ecrite
 * deux fois, donc l'apercu ne peut pas deriver de l'export par recopie fautive.
 * Comme SERVER_XFADE_TRANSITION_MAP, elle est TRIPLIQUEE a l'identique dans
 * exportManifest.js et functions/src/videoExport.js :
 * scripts/smoke-vibecut-transition-parity.mjs echoue si les trois divergent.
 *
 * Les longueurs sont des FRACTIONS de la largeur du cadre, jamais des pixels :
 * l'apercu tourne a 320 px et l'export a 1920 px, un nombre de pixels en dur
 * donnerait deux effets differents.
 */
export const SERVER_TRANSITION_EFFECTS = Object.freeze({
  /*
   * Groupe 1 - flous. `blur-dissolve` et `cross-blur` sont DELIBEREMENT separes
   * par leur COURBE autant que par leur intensite, et pas seulement par un nom :
   *  - `ramp` : A part net et se floute, B arrive floue et se resout. A aucun
   *    instant les deux ne sont flous en meme temps.
   *  - `bell` : les deux culminent ENSEMBLE au milieu, deux fois plus fort. Il y
   *    a donc un instant ou toute l'image est illisible, ce que `ramp` ne fait
   *    jamais. C'est la difference qu'on voit a l'ecran, pas une nuance de reglage.
   */
  'blur-dissolve': Object.freeze({ effect: 'blur', amount: 0.013, curve: 'ramp' }),
  'cross-blur': Object.freeze({ effect: 'blur', amount: 0.026, curve: 'bell' }),
  'motion-blur': Object.freeze({ effect: 'motion-blur', amount: 0.030, curve: 'bell' }),

  /*
   * Groupe 2 - zooms. `zoompan` a ete verifie sur une entree VIDEO le 2026-08-03
   * (etape 0 du plan) : il ne fige pas le contenu, il ne duplique pas d'image,
   * et son compteur `on` est exact a l'image pres. Il rampe par EXPRESSION, pas
   * par `sendcmd` : la courbe est donc continue, pas en escalier.
   *
   * `pan` est une FRACTION de la course maximale autorisee, jamais un decalage
   * absolu : le decalage vaut pan x (zoom - 1) / 2, ce qui satisfait le probleme I
   * (|x| <= (zoom - 1) / 2) PAR CONSTRUCTION et pas par surveillance. Un panoramique
   * ne peut donc pas faire sortir la fenetre du cadre, quelle que soit l'amplitude.
   */
  'cross-zoom': Object.freeze({ effect: 'zoom', amount: 0.50, curve: 'ramp', pan: 0 }),
  'snap-zoom': Object.freeze({ effect: 'zoom', amount: 1.10, curve: 'cubic', pan: 0 }),
  'parallax-zoom': Object.freeze({ effect: 'zoom', amount: 0.34, curve: 'ramp', pan: 0.8 }),

  /*
   * Groupe 3 - lumiere, et groupe 4 - numerique. Tous POSES APRES LA JOINTURE :
   * une aberration d'objectif ou une fuite de lumiere s'applique a l'image finie,
   * pas separement aux deux plans. Consequence heureuse, le cout est divise par
   * deux (une passe au lieu de deux) et l'apercu n'a qu'un seul calque a poser.
   *
   * `lift` : un voile blanc a opacite rampee. C'est un melange lineaire vers le
   * blanc, donc EXACT des deux cotes et dans les deux espaces colorimetriques
   * (la conversion YUV <-> RGB est affine).
   */
  'additive-dissolve': Object.freeze({ effect: 'lift', amount: 0.30, curve: 'bell' }),
  'rgb-split': Object.freeze({ effect: 'rgb-split', amount: 0.018, curve: 'bell' }),
  'chromatic': Object.freeze({ effect: 'chromatic', amount: 0.022, curve: 'bell' }),

  /*
   * Groupe 5 - ouvertures de sequence. Decision du porteur du projet du
   * 2026-08-03 : elles restent des transitions et sont rendues a l'export comme
   * les autres, mais la bibliotheque dit desormais qu'elles sont pensees pour le
   * DEBUT d'une sequence (famille « Ouverture & fin », mention a l'application).
   *
   * Les barres lumineuses sont des `drawbox` a position exprimee en t : bord net,
   * donc reproductible au pixel pres par un fillRect, contrairement a un halo.
   * Elles ont perdu leurs couleurs neon au passage - la direction artistique
   * (plan.md § 4.2) les interdit.
   */
  'intro-title-scan': Object.freeze({ effect: 'edge-bar', axis: 'x', edges: 1, amount: 0.55, width: 0.055 }),
  'intro-neon-doors': Object.freeze({ effect: 'edge-bar', axis: 'x', edges: 2, amount: 0.5, width: 0.05 }),

  /*
   * Les trois qui REMPLACENT la jointure.
   *
   * `xfade` melange les deux plans ; ces trois-la doivent CHOISIR entre eux image
   * par image (stroboscope, coupe franche du glitch) ou composer B sur A avec un
   * masque (revelation par blocs). La jointure est donc refaite a la main : les
   * deux flux sont alignes par `tpad` (A prolonge par sa derniere image, B
   * precede de sa premiere), puis composes par un `overlay` dont la condition
   * `enable` est evaluee PAR IMAGE - donc sans `sendcmd`, et sans surcout hors
   * de la fenetre.
   *
   * `cycles` : nombre de battements du stroboscope sur la fenetre. Exprime en
   * NOMBRE et pas en frequence, pour que la formule ne depende que de q : un
   * stroboscope de 0,35 s et un de 1 s ont alors le meme caractere, et surtout
   * l'apercu n'a pas besoin de connaitre la duree pour tomber juste.
   */
  'strobe-cut': Object.freeze({ effect: 'strobe', cycles: 7 }),
  'intro-grid-reveal': Object.freeze({ effect: 'grid-reveal', cols: 8, rows: 5 }),
  'glitch': Object.freeze({ effect: 'glitch', bands: 16, amount: 0.035, curve: 'bell', shift: 0.010 }),

  /*
   * `light-leak` reste une jointure normale : un halo chaud pose APRES le fondu.
   * Le degrade est genere une seule fois en 256x256 puis reboucle (`loop`), donc
   * `geq` ne tourne pas par image ; seule son opacite est rampee.
   */
  'light-leak': Object.freeze({ effect: 'light-leak', amount: 0.62, radius: 0.85, tint: '0xffb432' }),
});

/*
 * `sendcmd` change une option A DES INSTANTS DONNES : la rampe est un escalier,
 * pas une droite. Douze paliers sur la fenetre suffisent (un palier toutes les
 * 50 ms sur une transition de 0,6 s).
 *
 * L'apercu canvas applique EXACTEMENT LA MEME QUANTIFICATION
 * (`quantizeProgress`) : sans elle, comparer les deux a q=0,4 comparerait le
 * palier 4 (q=0,333) cote FFmpeg a la valeur continue 0,4 cote canvas, et
 * l'ecart serait pris pour une erreur de courbe.
 */
export const TRANSITION_EFFECT_STEPS = 12;

export function resolveTransitionEffect(type) {
  return SERVER_TRANSITION_EFFECTS[type] || null;
}

/*
 * Les deux seules courbes du lot, ecrites une fois.
 *  - `ramp` : cote A elle monte (0 -> 1), cote B elle descend (1 -> 0).
 *  - `bell` : sin(PI*q), identique des deux cotes, nulle aux extremites.
 */
export function transitionEffectCurve(curve, progress, side) {
  const q = Math.min(1, Math.max(0, Number(progress) || 0));
  if (curve === 'bell') return Math.sin(Math.PI * q);
  const value = side === 'b' ? 1 - q : q;
  if (curve === 'cubic') return value * value * value;
  return value;
}

/*
 * La meme courbe, ecrite en expression FFmpeg. `q` est deja une sous-expression
 * bornee a [0,1]. Les deux ecritures doivent rester d'accord : c'est
 * scripts/smoke-vibecut-xfade-preview-parity.mjs qui le prouve, en comparant les
 * images et non les formules.
 */
function transitionEffectCurveExpr(curve, qExpr, side) {
  if (curve === 'bell') return `sin(PI*(${qExpr}))`;
  const value = side === 'b' ? `(1-(${qExpr}))` : `(${qExpr})`;
  if (curve === 'cubic') return `pow(${value},3)`;
  return value;
}

const SERVER_XFADE_TRANSITIONS = new Set(Object.keys(SERVER_XFADE_TRANSITION_MAP));
const SUPPORTED_SERVER_TRANSITIONS = new Set(['cut', ...SERVER_XFADE_TRANSITIONS]);
const SUPPORTED_SERVER_FIT_MODES = new Set(['cover', 'contain']);
const SUPPORTED_SERVER_TEXT_ANIMATIONS = new Set(['none', 'fade']);
const SUPPORTED_SERVER_MEDIA_TYPES = new Set(['video', 'image']);
/*
 * LOT B3 - trois mouvements de plus. Cette liste est un VERROU: un id absent
 * fait refuser l'export ("Image motion is not supported by server renderer"),
 * pas retomber silencieusement sur un cadre fixe. C'est voulu - une photo rendue
 * immobile alors que l'interface annonce un mouvement serait invisible.
 * Consequence: tout ajout ici exige un rollout Cloud Run.
 */
const SUPPORTED_SERVER_IMAGE_MOTIONS = new Set([
  'none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'drift-up',
  'drift-down', 'orbit', 'bounce', 'rotate', 'appear', 'glitch',
]);
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
     * Le lot L1 a livre 15 transitions minutees, le lot B3a en a porte le
     * total a 33, chacune mappee sur une cible
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
    if (!SUPPORTED_SERVER_MOTION_ACCENTS.has(clip.motion?.accent || 'none')) {
      errors.push(`Motion accent is not supported by server renderer: ${label}.${clip.motion?.accent}.`);
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
  const videoLabel = buildVideoCompositeLabel({ videoInputs, transitions: manifest.transitions || [], filterParts, width, height, fps });
  /*
   * OUVERTURE ET FIN DE SEQUENCE, posees AVANT les textes: leurs horodatages
   * viennent de la timeline, laquelle compte deja le temps de l'ouverture. Les
   * poser apres decalerait tous les textes d'autant.
   */
  const sequencedLabel = appendSequenceEdges({
    filterParts,
    inputLabel: videoLabel,
    transitions: manifest.transitions || [],
    mainDuration: computeMainDuration(manifest),
    width,
    height,
    fps,
  });
  const finalVideoLabel = appendTextOverlayFilters({
    filterParts,
    inputLabel: sequencedLabel,
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

/*
 * LE SOUS-GRAPHE D'UNE TRANSITION (lot B3b).
 *
 * Rend la liste COMPLETE des elements de filtergraph qui menent de `labelA` et
 * `labelB` a `labelOut`. Pour les 33 transitions du lot B3a c'est une seule
 * ligne `xfade` ; pour les 15 du lot B3b c'est une chaine sur A, une chaine sur
 * B, la jointure, puis parfois un calque.
 *
 * Trois reperes de temps, et se tromper de repere est l'erreur qui ne se voit
 * PAS sur une transition isolee (elle n'apparait qu'au milieu d'un montage) :
 *  - cote A, la fenetre est [durationA - duration, durationA] sur la timeline du
 *    COMPOSITE deja assemble (c'est lui qui porte la queue du plan sortant) ;
 *  - cote B, elle est [0, duration] sur le plan entrant, dont le PTS a ete remis
 *    a zero par `setpts=PTS-STARTPTS` ;
 *  - apres la jointure, elle est [durationA - duration, durationA] sur le
 *    composite joint, c'est-a-dire exactement l'`offset` du `xfade`.
 * `scripts/smoke-vibecut-transition-chain-mp4.mjs` rend TROIS plans enchaines
 * pour que ce reperage soit prouve et pas suppose.
 *
 * Chaque etiquette intermediaire est prefixee par l'index de la coupe : le
 * graphe enchaine plusieurs transitions, deux `[xa]` se telescoperaient.
 *
 * Exporte parce que scripts/smoke-vibecut-xfade-preview-parity.mjs construit le
 * cote FFmpeg AVEC CETTE FONCTION. Reecrire le graphe dans le test ne prouverait
 * rien : c'est exactement le defaut que le lot L1 a corrige.
 */
export function buildTransitionSubgraph({
  type,
  index = 1,
  duration,
  durationA,
  durationB = 0,
  width = 1920,
  height = 1080,
  fps = 30,
  labelA = '[v0]',
  labelB = '[v1]',
  labelOut = '[vseq1]',
}) {
  const xfadeName = resolveXfadeTransitionName(type);
  const effect = resolveTransitionEffect(type);
  const offset = Math.max(0, Number(durationA) - Number(duration));
  const joinLine = (from, to, out) => `${from}${to}xfade=transition=${xfadeName}:duration=${formatNumber(duration)}:offset=${formatNumber(offset)}${out}`;

  if (!effect) return [joinLine(labelA, labelB, labelOut)];

  const parts = [];
  const tag = (name) => `[b3b${index}${name}]`;
  const postChain = [];
  const geometry = {
    width,
    height,
    fps,
    duration,
    offset,
    durationA: Number(durationA),
    durationB: Number(durationB),
    index,
    tag,
  };

  /*
   * COTE A ET COTE B. Les flous sont rampes par PALIERS sur la queue du plan
   * sortant et la tete du plan entrant ; les zooms, pilotes par une expression,
   * s'appliquent en place et n'ont besoin d'aucune porte.
   */
  const stepped = STEPPED_SIDE_EFFECTS[effect.effect];
  let fromLabel = labelA;
  let toLabel = labelB;
  if (stepped) {
    parts.push(`${labelA}${steppedChain({ geometry, windowStart: offset, buildStep: (q) => stepped(effect, 'a', width, q) })}${tag('a')}`);
    parts.push(`${labelB}${steppedChain({ geometry, windowStart: 0, buildStep: (q) => stepped(effect, 'b', width, q) })}${tag('b')}`);
    fromLabel = tag('a');
    toLabel = tag('b');
  } else if (effect.effect === 'zoom') {
    parts.push(`${labelA}${zoomChain(effect, 'a', offset, geometry)}${tag('a')}`);
    parts.push(`${labelB}${zoomChain(effect, 'b', 0, geometry)}${tag('b')}`);
    fromLabel = tag('a');
    toLabel = tag('b');
  }
  if (effect.effect === 'edge-bar') postChain.push(edgeBarChain(effect, geometry));
  /*
   * LA JOINTURE. Trois transitions ne peuvent pas passer par `xfade` : il
   * MELANGE les deux plans, alors qu'il faut ici CHOISIR entre eux image par
   * image (stroboscope, coupe franche du glitch) ou composer B sur A par un
   * masque (revelation par blocs).
   */
  const custom = CUSTOM_JOIN_EFFECTS[effect.effect];
  const isolated = ISOLATED_POST_EFFECTS[effect.effect];
  const steppedPost = STEPPED_POST_EFFECTS[effect.effect];
  const needsPost = Boolean(postChain.length || isolated || steppedPost);
  const joined = needsPost ? tag('j') : labelOut;
  if (custom) {
    parts.push(...alignedPairParts(geometry, fromLabel, toLabel));
    parts.push(...custom(effect, geometry, tag('pa'), tag('pb'), joined));
  } else {
    parts.push(joinLine(fromLabel, toLabel, joined));
  }
  if (postChain.length) {
    parts.push(`${tag('j')}${postChain.join(',')}${labelOut}`);
    return parts;
  }
  if (isolated) {
    parts.push(...isolateWindow(geometry, joined, labelOut, isolated, effect));
    return parts;
  }
  if (steppedPost) {
    if (steppedPost.isolate) {
      /*
       * Ces effets-la changent d'espace colorimetrique ou apportent leur propre
       * source : leur fenetre est CONFINEE avant d'y poser la rampe, sans quoi
       * l'aller-retour `yuv420p -> gbrp` porterait sur tout le montage (1,1 s
       * mesurees pour une transition de 0,6 s en 1080p, quatre fois l'effet).
       */
      parts.push(...isolateWindow(
        geometry,
        joined,
        labelOut,
        (fx, local, inLabel, outLabel) => steppedPost.build(fx, local, inLabel, outLabel),
        effect,
      ));
      return parts;
    }
    parts.push(`${tag('j')}${steppedChain({ geometry, windowStart: offset, buildStep: (q) => steppedPost.build(effect, geometry, q) })}${labelOut}`);
  }
  return parts;
}

/*
 * CONFINER UN EFFET A SA FENETRE.
 *
 * Quatre des quinze effets ont besoin de sortir du `yuv420p` (decalage de
 * couches, aberration, glitch) ou d'apporter leur propre source (fuite de
 * lumiere). Poses tels quels avec une simple porte `enable`, ils font passer TOUT
 * le montage par une conversion d'espace colorimetrique - la porte empeche
 * l'effet, pas la conversion. Mesure du 2026-08-03 sur une transition de 0,6 s en
 * 1080p : l'aller-retour `yuv420p -> gbrp -> yuv420p` coute a lui seul 1,1 s,
 * quand l'effet lui-meme n'en coute que 0,3.
 *
 * On decoupe donc le flux en trois - avant, fenetre, apres - on ne traite que le
 * milieu, et on recolle. L'aberration chromatique tombe de 2,20 s a 1,02 s, le
 * glitch de 1,77 s a 0,85 s.
 *
 * DEUX PRECAUTIONS, chacune pour un defaut deja rencontre :
 *  - le decoupage se fait en NUMEROS D'IMAGE, pas en secondes. Avec des bornes en
 *    secondes, la mesure du 2026-08-03 perdait UNE image sur 102 - donc tout le
 *    montage decale d'un trentieme de seconde et l'audio desynchronise.
 *    `smoke-vibecut-transition-chain-mp4` compte les images d'un montage a trois
 *    plans pour que ce soit prouve et pas suppose ;
 *  - `setpts=PTS-STARTPTS` remet le temps de la fenetre a ZERO. Les effets
 *    confines raisonnent donc en temps LOCAL (0 -> duree), ce qui supprime au
 *    passage tout le calcul d'horodatage absolu et le piege qui va avec.
 *
 * Les effets qui travaillent en place et en `yuv420p` (voile blanc, barres
 * lumineuses) n'y passent PAS : le decoupage leur couterait plus cher que
 * l'effet.
 */
function isolateWindow(geometry, inLabel, outLabel, build, effect) {
  const local = { ...geometry, offset: 0, durationA: geometry.duration, durationB: 0 };
  return sliceWindow({
    geometry,
    inLabel,
    outLabel,
    windowStart: geometry.offset,
    streamDuration: geometry.durationA + geometry.durationB - geometry.duration,
    slug: 'w',
    segments: [{ start: 0, end: Math.max(1, Math.round(geometry.duration * geometry.fps)) }],
    buildSegment: (_, segIn, segOut) => build(effect, local, segIn, segOut),
  });
}

/*
 * RAMPER UN FILTRE SANS `sendcmd`.
 *
 * `sendcmd` etait la voie evidente, et elle est CONDAMNEE ici, pour deux raisons
 * mesurees le 2026-08-03 - la premiere par le test a trois plans, et par lui seul :
 *
 *  1. `sendcmd` ne parle pas au filtre qui le suit, il DIFFUSE a tous les filtres
 *     du graphe portant le nom vise. Un montage a deux coupes a quatre `sendcmd`
 *     et quatre `gblur`, et chacun des quatre pilotait les quatre. La commande
 *     « sigma 0 » qui clot la premiere coupe arrivait au milieu de la rampe de la
 *     deuxieme et l'ecrasait : la DEUXIEME COUPE rendait un fondu simple, sans
 *     que rien ne le signale (ecart-type 52,7 avec les deux coupes contre 42,9
 *     avec la deuxieme seule).
 *  2. La parade documentee - nommer l'instance, `gblur@b3b2a` - ne fonctionne PAS
 *     dans le build FFmpeg 6.0 de reference : la declaration est acceptee, la
 *     commande n'arrive jamais. Verifie en visant `gblur`, puis `gblur@z`, puis
 *     `@z` : seule la premiere agit.
 *
 * La rampe est donc une CHAINE de douze instances du meme filtre, chacune a
 * valeur constante et ouverte sur un douzieme de la fenetre par sa propre porte
 * `enable`. Une seule agit par image, les onze autres laissent passer. Aucune
 * commande ne circule, donc rien ne peut se telescoper, et la quantification
 * devient exactement celle que l'apercu modelise deja (`quantizeProgress`) au
 * lieu d'en dependre.
 *
 * Le decoupage en segments concatenes, essaye d'abord, a ete ABANDONNE apres
 * mesure : `concat` deduit le decalage de chaque segment de la duree du
 * precedent, et cette deduction derive - huit images de trop sur cent huit avec
 * treize segments par cote. Un recollage en TROIS morceaux reste exact et sert
 * encore a confiner les effets qui changent d'espace colorimetrique.
 *
 * Les bornes sont demi-ouvertes (`gte` et `lt`, jamais `between` qui est inclusif
 * des deux cotes) : sinon deux paliers s'appliqueraient a l'image de frontiere.
 */
function steppedChain({ geometry, windowStart, buildStep, steps = TRANSITION_EFFECT_STEPS }) {
  const { duration } = geometry;
  const links = [];
  for (let step = 0; step < steps; step += 1) {
    const filter = buildStep(step / steps);
    if (filter === 'null') continue;
    const from = windowStart + (step * duration) / steps;
    const to = windowStart + ((step + 1) * duration) / steps;
    const gate = step === steps - 1
      ? `gte(t,${formatTime(from)})*lte(t,${formatTime(to)})`
      : `gte(t,${formatTime(from)})*lt(t,${formatTime(to)})`;
    links.push(`${filter}:enable='${gate}'`);
  }
  return links.length ? links.join(',') : 'null';
}

/*
 * Machinerie commune : couper `[avant][fenetre...][apres]`, traiter la fenetre,
 * recoller. Les bornes sont en numeros d'image. Les tetes et queues vides ne sont
 * pas emises - `concat` bloquerait sur une entree sans image.
 */
function sliceWindow({ geometry, inLabel, outLabel, windowStart, streamDuration, slug, segments, buildSegment }) {
  const { fps, duration, tag } = geometry;
  const startFrame = Math.round(windowStart * fps);
  const frames = Math.max(1, Math.round(duration * fps));
  const endFrame = startFrame + frames;
  const hasHead = startFrame > 0;
  const hasTail = Number(streamDuration) > windowStart + duration + 1 / (2 * fps);

  const pieces = [];
  if (hasHead) pieces.push('head');
  segments.forEach((_, index) => pieces.push(`s${index}`));
  if (hasTail) pieces.push('tail');

  const parts = [`${inLabel}split=${pieces.length}${pieces.map((piece) => tag(`${slug}${piece}`)).join('')}`];
  const outputs = [];
  if (hasHead) {
    parts.push(`${tag(`${slug}head`)}trim=start_frame=0:end_frame=${startFrame},setpts=PTS-STARTPTS${tag(`${slug}head2`)}`);
    outputs.push(tag(`${slug}head2`));
  }
  segments.forEach((segment, index) => {
    const trimmed = tag(`${slug}s${index}t`);
    const done = tag(`${slug}s${index}d`);
    parts.push(`${tag(`${slug}s${index}`)}trim=start_frame=${startFrame + segment.start}:end_frame=${startFrame + segment.end},setpts=PTS-STARTPTS${trimmed}`);
    parts.push(...buildSegment(segment, trimmed, done, index));
    outputs.push(done);
  });
  if (hasTail) {
    parts.push(`${tag(`${slug}tail`)}trim=start_frame=${endFrame},setpts=PTS-STARTPTS${tag(`${slug}tail2`)}`);
    outputs.push(tag(`${slug}tail2`));
  }
  /*
   * PTS REGENERES apres le recollage. `concat` deduit le decalage de chaque
   * segment de la duree du precedent, et cette deduction DERIVE : mesure du
   * 2026-08-03 sur un montage a trois plans, treize segments par cote, quatre
   * cotes - huit images de trop sur cent huit, donc tout le montage faux et
   * l'audio desynchronise. Les bornes sont donc en NUMEROS D'IMAGE, jamais en
   * secondes, et le recollage se limite a TROIS morceaux - au-dela, la deduction
   * de `concat` derive quand meme (huit images de trop sur cent huit avec treize
   * morceaux par cote, mesure du 2026-08-03).
   *
   * `settb=1/fps` derriere : `concat` sort en base de temps 1/1000000 alors que
   * tous les autres flux sont en 1/fps (le filtre `fps=` de la normalisation de
   * chaque plan la fixe la), et `xfade` REFUSE deux entrees de bases differentes.
   * Sans lui, un montage melangeant une transition decoupee et une transition
   * simple ne se rend pas du tout. `settb` change la base sans toucher aux
   * instants, contrairement a un `fps=` qui, lui, retirait une image.
   */
  parts.push(`${outputs.join('')}concat=n=${outputs.length}:v=1:a=0,settb=1/${fps}${outLabel}`);
  return parts;
}

/*
 * ALIGNER LES DEUX FLUX SANS `xfade`.
 *
 * `xfade` fait deux choses a la fois : il aligne B sur la queue de A, et il les
 * melange. Les jointures qui CHOISISSENT plutot que de melanger n'ont besoin que
 * de la premiere. `tpad` s'en charge : A est prolonge par sa derniere image
 * jusqu'a la fin du montage, B est precede de sa premiere image jusqu'a `offset`.
 * Les deux flux ont alors la meme longueur et le meme repere de temps, et un
 * simple `overlay` conditionnel suffit.
 *
 * Les images clonees hors fenetre ne sont jamais visibles (la condition choisit
 * l'autre flux) : c'est du remplissage, pas du contenu.
 */
function alignedPairParts({ durationA, durationB, duration, tag }, labelA, labelB) {
  const offset = Math.max(0, durationA - duration);
  const total = durationA + durationB - duration;
  return [
    `${labelA}tpad=stop_duration=${formatNumber(Math.max(0, total - durationA))}:stop_mode=clone${tag('pa')}`,
    `${labelB}tpad=start_duration=${formatNumber(offset)}:start_mode=clone${tag('pb')}`,
  ];
}

/*
 * Condition « on montre B », evaluee par image par `overlay=enable=`. Hors
 * fenetre elle vaut 0 avant et 1 apres : la transition se termine donc sur B,
 * quelle que soit la formule du milieu.
 */
function windowedShowB(inner, { offset, duration }) {
  const start = formatTime(offset);
  const end = formatTime(offset + duration);
  return `if(gte(t,${end}),1,if(lt(t,${start}),0,${inner}))`;
}

function strobeJoin(effect, geometry, labelA, labelB, labelOut) {
  const { offset, duration } = geometry;
  const q = `clip((t-${formatTime(offset)})/${formatNumber(duration)},0,1)`;
  /*
   * Rapport cyclique CROISSANT : B n'apparait qu'une fraction q du temps. Au
   * debut il ne fait que clignoter, a la fin il est presque toujours la. C'est ce
   * qui donne l'impression d'un basculement et pas d'un simple clignotement.
   */
  const inner = `lt(mod((${q})*${formatNumber(effect.cycles)},1),(${q}))`;
  return [`${labelA}${labelB}overlay=x=0:y=0:enable='${windowedShowB(inner, geometry)}'${labelOut}`];
}

/*
 * GLITCH : la jointure n'est qu'une coupe FRANCHE au milieu de la fenetre. Les
 * bandes decalees et le decalage de couches viennent apres, confines a la
 * fenetre (voir glitchParts).
 */
function glitchJoin(effect, geometry, labelA, labelB, labelOut) {
  const cut = formatTime(geometry.offset + geometry.duration / 2);
  return [`${labelA}${labelB}overlay=x=0:y=0:enable='${windowedShowB(`gte(t,${cut})`, geometry)}'${labelOut}`];
}

/*
 * REVELATION PAR BLOCS.
 *
 * Le masque est genere en `cols x rows` PIXELS - quarante evaluations `geq` par
 * image, negligeable - puis agrandi en `neighbor` : chaque pixel devient un bloc
 * a bord net. Une expression evaluee a pleine resolution aurait coute le facteur
 * ~40 que tout ce lot cherche a eviter.
 *
 * Le seuil de chaque bloc est une fonction ENTIERE de ses coordonnees, donc
 * identique au bit pres cote apercu : jamais un tirage aleatoire, qui ne
 * coinciderait pas d'un cote a l'autre.
 */
function gridRevealJoin(effect, geometry, labelA, labelB, labelOut) {
  const { width, height, fps, offset, duration, durationA, durationB, tag } = geometry;
  const total = durationA + durationB - duration;
  const cells = effect.cols * effect.rows;
  const q = `clip((T-${formatTime(offset)})/${formatNumber(duration)},0,1)`;
  /*
   * Seuils DECALES D'UN DEMI-CRAN, pour deux raisons :
   *  - aucun seuil ne vaut 0, sinon le bloc concerne serait revele des q=0, donc
   *    AVANT le debut de la transition (trouve le 2026-08-03 par l'assertion
   *    « hors fenetre, rien ne bouge » du test a trois plans) ;
   *  - aucun seuil ne tombe JAMAIS pile sur une valeur de q echantillonnee, donc
   *    aucune comparaison ne depend d'une egalite entre deux flottants calcules
   *    par deux moteurs differents. Un bloc de plus ou de moins d'un cote suffit
   *    a faire sortir la mesure de parite de sa tolerance.
   */
  const threshold = `(mod(X*7+Y*11,${cells})+0.5)/${cells}`;
  return [
    `color=c=black:s=${effect.cols}x${effect.rows}:r=${fps}:d=${formatNumber(total)},format=gray,geq=lum='255*gte(${q},${threshold})',scale=${width}x${height}:flags=neighbor${tag('gm')}`,
    `${labelB}format=yuva420p${tag('gb')}`,
    `${tag('gb')}${tag('gm')}alphamerge${tag('gba')}`,
    `${labelA}${tag('gba')}overlay=x=0:y=0${labelOut}`,
  ];
}

/*
 * Effets rampes par PALIERS D'IMAGES, cote A et cote B (queue du plan sortant,
 * tete du plan entrant).
 */
const STEPPED_SIDE_EFFECTS = {
  blur: (effect, side, width, q) => gaussianBlurStep(effect, side, width, q),
  'motion-blur': (effect, side, width, q) => boxBlurStep(effect, side, width, q),
};

/*
 * Effets rampes par PALIERS D'IMAGES, poses APRES la jointure : une aberration
 * d'objectif ou un voile de lumiere s'applique a l'image finie, pas separement
 * aux deux plans. Le cout est divise par deux au passage.
 */
const STEPPED_POST_EFFECTS = {
  lift: { build: (effect, geometry, q) => whiteVeilStep(effect, q) },
  'rgb-split': {
    isolate: true,
    build: (effect, local, inLabel, outLabel) => [
      `${inLabel}format=gbrp,${steppedChain({ geometry: local, windowStart: 0, buildStep: (q) => rgbShiftStep(effect, local.width, q) })},format=yuv420p${outLabel}`,
    ],
  },
  glitch: {
    isolate: true,
    build: (effect, local, inLabel, outLabel) => glitchParts(effect, local, inLabel, outLabel),
  },
};

const CUSTOM_JOIN_EFFECTS = {
  strobe: strobeJoin,
  glitch: glitchJoin,
  'grid-reveal': gridRevealJoin,
};

/*
 * LES EFFETS CONFINES A LA FENETRE.
 *
 * Tous recoivent une geometrie LOCALE : `offset` vaut 0 et la fenetre couvre tout
 * le segment, puisque `isolateWindow` a deja remis son temps a zero. Aucun n'a
 * donc de porte `enable` ni d'horodatage absolu - il n'y a plus rien a se
 * tromper de repere.
 */

/*
 * DECALAGE RVB horizontal : le rouge part a gauche, le bleu a droite, le vert ne
 * bouge pas. `rgbashift` rabat les bords (`edge=smear`, son defaut) - l'apercu
 * doit faire pareil, un canvas laisserait une bande vide.
 */
/*
 * ABERRATION CHROMATIQUE RADIALE.
 *
 * `rgbashift` ne sait que TRANSLATER les couches, uniformement sur tout le cadre :
 * il ne peut pas produire une frange qui nait sur les bords et laisse le centre
 * propre. Il faut AGRANDIR une couche par rapport aux deux autres.
 *
 * Une seule couche est agrandie, pas trois : `extractplanes` isole le rouge,
 * `zoompan` ne travaille que sur lui, `mergeplanes` recompose. Trois `zoompan`
 * pleine resolution auraient coute trois fois plus pour un resultat identique -
 * seul l'ECART entre les couches se voit.
 *
 * ORDRE DES PLANS, verifie par mesure le 2026-08-03 et non deduit de la
 * documentation : avec `extractplanes=r+g+b`, la sortie 0 est le ROUGE, la 1 le
 * vert, la 2 le bleu, et `[vert][bleu][rouge]mergeplanes=0x001020:gbrp` est
 * l'identite exacte (255,128,0 rendu 255,128,0). Preuve : mettre la sortie 0 a
 * zero eteint le rouge, la sortie 1 eteint le vert.
 */
function chromaticParts(effect, geometry, inLabel, outLabel) {
  const { width, height, fps, duration, tag } = geometry;
  const q = `clip(on/${formatNumber(Math.max(1, duration * fps))},0,1)`;
  const spread = `${formatNumber(effect.amount)}*${transitionEffectCurveExpr(effect.curve, q, 'a')}`;
  return [
    `${inLabel}format=gbrp,extractplanes=r+g+b${tag('cr')}${tag('cg')}${tag('cb')}`,
    `${tag('cr')}zoompan=z='1+${spread}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${width}x${height}:fps=${fps}${tag('crz')}`,
    `${tag('cg')}${tag('cb')}${tag('crz')}mergeplanes=0x001020:gbrp,format=yuv420p${outLabel}`,
  ];
}

/*
 * FUITE LUMINEUSE.
 *
 * Le halo est un degrade radial a decroissance LINEAIRE - exactement ce qu'un
 * `createRadialGradient` a deux arrets donne cote apercu. Il est genere par `geq`
 * sur une image de 256x256, soit soixante-cinq mille evaluations par image : c'est
 * negligeable A CONDITION que ce soit confine a la fenetre, ce que fait
 * `isolateWindow`. Son opacite suit la meme expression continue, sa position
 * l'expression `x` de `overlay`.
 */
function lightLeakParts(effect, geometry, inLabel, outLabel) {
  const { width, height, fps, duration, tag } = geometry;
  const size = Math.max(2, Math.round(effect.radius * width) * 2);
  const q = `clip(t/${formatNumber(duration)},0,1)`;
  const bell = `sin(PI*clip(T/${formatNumber(duration)},0,1))`;
  return [
    `color=c=${effect.tint}:s=256x256:r=${fps}:d=${formatNumber(duration)},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${formatNumber(effect.amount * 255)}*${bell}*max(0,1-hypot(X-127.5,Y-127.5)/128)',scale=${size}x${size}${tag('lls')}`,
    `${inLabel}${tag('lls')}overlay=x='(${q})*(W+w)-w':y=${formatNumber(0.35 * height)}-${size}/2:eval=frame${outLabel}`,
  ];
}

/*
 * Effets dont la fenetre est ISOLEE en un seul segment, parce qu'ils sont
 * pilotes par une expression continue et non par des paliers.
 */
const ISOLATED_POST_EFFECTS = {
  chromatic: chromaticParts,
  'light-leak': lightLeakParts,
};

/*
 * LES FILTRES A VALEUR CONSTANTE, un par palier.
 *
 * Chacun rend la CHAINE a appliquer au segment d'images d'un palier donne. La
 * valeur ne bouge pas a l'interieur du segment : c'est ce qui rend la rampe
 * deterministe et ce qui la fait coincider exactement avec `quantizeProgress`
 * cote apercu.
 */

function gaussianBlurStep(effect, side, width, q) {
  const sigma = effect.amount * width * transitionEffectCurve(effect.curve, q, side);
  return sigma > 0.01 ? `gblur=sigma=${formatNumber(sigma)}` : 'null';
}

/*
 * Flou DIRECTIONNEL. `avgblur` fait une moyenne de boite sur 2*sizeX+1 pixels
 * horizontaux : l'apercu reproduit exactement cette boite, aux memes decalages
 * entiers. C'est ce qui distingue `motion-blur` de `cross-blur`, dont le flou
 * gaussien est isotrope.
 */
function boxBlurStep(effect, side, width, q) {
  const size = resolveBoxBlurSize(effect, width, transitionEffectCurve(effect.curve, q, side));
  return size > 1 ? `avgblur=sizeX=${size}:sizeY=0` : 'null';
}

/*
 * VOILE BLANC (`additive-dissolve`). `drawbox` melange lineairement vers sa
 * couleur ; la conversion YUV <-> RGB etant affine, le resultat est le meme
 * qu'un `fillRect` en `rgba(255,255,255,a)` sur un canvas. Exact des deux cotes,
 * et dans les deux espaces colorimetriques.
 */
function whiteVeilStep(effect, q) {
  const alpha = effect.amount * transitionEffectCurve(effect.curve, q, 'a');
  if (!(alpha > 0.0005)) return 'null';
  return `drawbox=x=0:y=0:w=iw:h=ih:t=fill:color=white@${alpha.toFixed(4)}`;
}

/*
 * DECALAGE RVB horizontal : le rouge part a gauche, le bleu a droite, le vert ne
 * bouge pas. `rgbashift` rabat les bords (`edge=smear`, son defaut) - l'apercu
 * doit faire pareil, un canvas laisserait une bande vide de la largeur du
 * decalage.
 *
 * Le passage en `gbrp` est fait UNE FOIS autour de la chaine, et seulement sur la
 * fenetre confinee. Pose sur tout le flux, l'aller-retour d'espace
 * colorimetrique coutait a lui seul 1,1 s pour une transition de 0,6 s en 1080p
 * (mesure du 2026-08-03), soit quatre fois l'effet lui-meme.
 */
function rgbShiftStep(effect, width, q) {
  const shift = resolveChannelShift(effect, width, transitionEffectCurve(effect.curve, q, 'a'));
  if (shift === 0) return 'null';
  return `rgbashift=rh=${-shift}:bh=${shift}`;
}

/*
 * GLITCH : bandes decalees puis leger decalage de couches, sur un palier.
 *
 * `displace` prend TROIS entrees (source, carte X, carte Y) - c'est sur cette
 * arite, et non sur la disponibilite du filtre, que le test du 2026-08-02 avait
 * echoue. Les cartes sont generees en 1 x bandes puis agrandies en `neighbor` :
 * seize evaluations `geq` au lieu de deux millions.
 *
 * SIGNE, mesure le 2026-08-03 et non suppose : `displace` lit
 * out(x) = in(x + carte - 128). Une carte SUPERIEURE a 128 fait glisser l'image
 * vers la GAUCHE, alors que l'apercu dessine la bande a un decalage de
 * DESTINATION. D'ou le moins : les deux ecritures sont inverses l'une de l'autre.
 *
 * Tout est en `gbrp`. En `yuv420p` le sous-echantillonnage de chroma etalerait
 * les franges sur deux pixels, et l'apercu, qui travaille en RVB plein, ne
 * pourrait pas le reproduire : mesure du 2026-08-03, l'ecart tombe de 23 a 4
 * sur 255.
 *
 * Le decalage de chaque bande est une formule FIXE de son indice - jamais un
 * tirage aleatoire, qui ne coinciderait pas d'un cote a l'autre.
 */
function glitchParts(effect, geometry, inLabel, outLabel) {
  const { width, height, fps, duration, tag } = geometry;
  const q = `clip(T/${formatNumber(duration)},0,1)`;
  const amplitude = `${formatNumber(effect.amount * width)}*${transitionEffectCurveExpr(effect.curve, q, 'a')}`;
  const band = `128-round((${amplitude})*sin(Y*2.399963+11))`;
  const colorShift = steppedChain({
    geometry,
    windowStart: 0,
    buildStep: (step) => rgbShiftStep({ ...effect, amount: effect.shift }, width, step),
  });
  return [
    `${inLabel}format=gbrp${tag('gsrc')}`,
    `color=c=black:s=1x${effect.bands}:r=${fps}:d=${formatNumber(duration)},format=gbrp,geq=r='${band}':g='${band}':b='${band}',scale=${width}x${height}:flags=neighbor${tag('gx')}`,
    `color=c=black:s=${width}x${height}:r=${fps}:d=${formatNumber(duration)},format=gbrp,geq=r='128':g='128':b='128'${tag('gy')}`,
    `${tag('gsrc')}${tag('gx')}${tag('gy')}displace=edge=smear,${colorShift},format=yuv420p${outLabel}`,
  ];
}

/*
 * ZOOM, par expression et non par palier : `zoompan` lit `on`, son compteur
 * d'images de sortie, verifie exact a l'image pres sur une entree VIDEO le
 * 2026-08-03 (etape 0 du plan). La courbe est donc CONTINUE - l'apercu ne doit
 * surtout pas la quantifier.
 *
 * Aucune porte n'est necessaire : hors de la fenetre la progression est ramenee a
 * 0 (cote A) ou a 1 (cote B), donc le zoom vaut exactement 1 et le filtre est un
 * recadrage a l'identique. Mesure : +0,05 s sur tout le montage, il ne vaut donc
 * pas la peine d'etre confine.
 *
 * La geometrie est celle, deja mesuree et deja employee par le mouvement des
 * photos (lot L3) : `zoompan` decoupe une fenetre de iw/zoom, en coordonnees
 * d'ENTREE.
 */
function zoomChain(effect, side, windowStart, { width, height, fps, duration }) {
  const frames = Math.max(1, duration * fps);
  const q = `clip((on-${formatNumber(windowStart * fps)})/${formatNumber(frames)},0,1)`;
  const curve = transitionEffectCurveExpr(effect.curve, q, side);
  const zoom = `1+${formatNumber(effect.amount)}*${curve}`;
  // pan = fraction de la course maximale : |x| <= (zoom-1)/2 est vrai par construction.
  const panFraction = Number(effect.pan || 0) * (side === 'b' ? 1 : -1);
  const pan = panFraction === 0 ? '0' : `${formatNumber(panFraction)}*(zoom-1)/2`;
  return `zoompan=z='${zoom}':x='(iw-iw/zoom)/2-(${pan})*iw/zoom':y='(ih-ih/zoom)/2':d=1:s=${width}x${height}:fps=${fps}`;
}

/* Le MEME entier des deux cotes : rgbashift ne decale que par pixels entiers. */
export function resolveChannelShift(effect, width, curveValue) {
  return Math.round(effect.amount * width * curveValue);
}

/*
 * Partagee mot pour mot avec l'apercu : la taille de boite doit etre le MEME
 * entier des deux cotes, sinon les deux moyennes portent sur deux largeurs
 * differentes.
 */
export function resolveBoxBlurSize(effect, width, curveValue) {
  return Math.max(1, Math.round(effect.amount * width * curveValue));
}

/*
 * BARRES LUMINEUSES suivant le bord d'un volet (`intro-title-scan`,
 * `intro-neon-doors`). `drawbox` evalue `x` PAR IMAGE : la position est une
 * expression en `t`, donc continue, et aucune commande ne circule - rien a
 * telescoper. Bord net des deux cotes : un `fillRect` le reproduit au pixel pres.
 */
function edgeBarChain(effect, { offset, duration, width }) {
  const barWidth = Math.max(1, Math.round(effect.width * width));
  const q = `clip((t-${formatTime(offset)})/${formatNumber(duration)},0,1)`;
  const gate = `enable='between(t,${formatTime(offset)},${formatTime(offset + duration)})'`;
  const color = `white@${Number(effect.amount).toFixed(4)}`;
  const box = (x) => `drawbox=x='${x}':y=0:w=${barWidth}:h=ih:t=fill:color=${color}:${gate}`;
  if (effect.edges === 2) {
    // Deux volets qui s'ouvrent depuis l'axe: une barre sur chaque bord interieur.
    return [
      box(`iw/2-(${q})*iw/2-${barWidth}/2`),
      box(`iw/2+(${q})*iw/2-${barWidth}/2`),
    ].join(',');
  }
  return box(`(${q})*iw-${barWidth}/2`);
}

function formatTime(value) {
  return Number(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function buildVideoCompositeLabel({ videoInputs, transitions = [], filterParts, width = 1920, height = 1080, fps = 30 }) {
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
      /*
       * Un sous-graphe, pas une ligne. Voir buildTransitionSubgraph : les
       * transitions du lot B3b posent des filtres sur la queue de A et la tete
       * de B avant la jointure, et parfois un calque apres.
       */
      filterParts.push(...buildTransitionSubgraph({
        type: transition.type,
        index,
        duration: transitionDuration,
        durationA: currentDuration,
        durationB: nextDuration,
        width,
        height,
        fps,
        labelA: currentLabel,
        labelB: nextLabel,
        labelOut: outputLabel,
      }));
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

/*
 * OUVERTURE ET FIN DE SEQUENCE A L'EXPORT (2026-08-04).
 *
 * Ce que l'apercu fait, et qu'il faut reproduire exactement : une ouverture est
 * une transition DEPUIS LE NOIR vers la premiere image du montage, et elle
 * OCCUPE SON PROPRE TEMPS en tete - elle allonge le montage au lieu de le
 * rogner. Une fin est la meme chose en miroir, vers le noir, en queue.
 *
 * COMMENT, ET POURQUOI PAS AUTREMENT.
 *
 * On ne peut pas reutiliser l'etiquette d'un plan pour en figer la premiere
 * image : dans un graphe FFmpeg une etiquette se consomme UNE fois, et le
 * composite l'a deja prise. On part donc du composite lui-meme, qu'on `split`.
 *
 * `tpad=stop_mode=clone` CLONE la derniere image du morceau qu'on lui donne :
 * c'est ce qui fabrique le gel, sans `reverse` - lequel bufferise tout le
 * montage en memoire pour retrouver une seule image.
 *
 * La longueur d'un `xfade` vaut `dureeA + dureeB - dureeTransition`. Avec deux
 * morceaux de duree `d` et une transition de duree `d`, le segment sort donc a
 * exactement `d` : l'ouverture ajoute sa duree, ni plus ni moins.
 *
 * `settb=1/fps` derriere le `concat` : `concat` sort en base 1/1000000 alors que
 * tout le reste est en 1/fps, et les filtres suivants refusent de melanger deux
 * bases differentes. Meme lecon qu'au lot B3b.
 */
/*
 * La duree du montage SANS son ouverture. Seule l'ouverture ajoute du temps: une
 * fin de sequence RECOUVRE la queue du dernier plan, elle ne s'ajoute pas
 * derriere (voir `appendSequenceEdges`).
 */
function computeMainDuration(manifest = {}) {
  const total = Number(manifest?.project?.duration) || 0;
  const intro = (manifest.transitions || []).find((item) => item?.params?.placement === 'intro');
  return Math.max(0.1, total - (intro ? Number(intro.duration) || 0 : 0));
}

function appendSequenceEdges({ filterParts, inputLabel, transitions = [], mainDuration, width, height, fps }) {
  const edgeOf = (slot) => transitions.find((item) => item?.params?.placement === slot) || null;
  const intro = edgeOf('intro');
  const outro = edgeOf('outro');
  if (!intro && !outro) return inputLabel;

  const introDuration = intro ? Math.max(0.1, Number(intro.duration) || 0.5) : 0;
  const outroDuration = outro ? Math.max(0.1, Number(outro.duration) || 0.5) : 0;
  const frame = 1 / fps;
  const tag = (name) => `[seq${name}]`;

  const pieces = ['main'];
  if (intro) pieces.push('head');
  if (outro) pieces.push('tail');
  filterParts.push(`${inputLabel}split=${pieces.length}${pieces.map((piece) => tag(piece)).join('')}`);

  const segments = [];

  if (intro) {
    // Premiere image, clonee pendant toute la duree de l'ouverture.
    filterParts.push(
      `${tag('head')}trim=start_frame=0:end_frame=1,setpts=PTS-STARTPTS,`
      + `tpad=stop_mode=clone:stop_duration=${formatNumber(Math.max(0, introDuration - frame))},`
      + `fps=${fps},setpts=PTS-STARTPTS${tag('headfreeze')}`,
    );
    filterParts.push(
      `color=c=black:s=${width}x${height}:r=${fps}:d=${formatNumber(introDuration)},`
      + `format=yuv420p,setpts=PTS-STARTPTS${tag('blackin')}`,
    );
    filterParts.push(...buildTransitionSubgraph({
      type: intro.type,
      index: 900,
      duration: introDuration,
      durationA: introDuration,
      durationB: introDuration,
      width,
      height,
      fps,
      labelA: tag('blackin'),
      labelB: tag('headfreeze'),
      labelOut: tag('intro'),
    }));
    segments.push(tag('intro'));
  }

  segments.push(tag('main'));

  if (outro) {
    /*
     * LA FIN RECOUVRE LA QUEUE, elle ne s'ajoute pas derriere.
     *
     * On coupe donc le montage en deux: tout sauf la derniere `d`, puis cette
     * derniere `d` que l'on eteint. Le total ne bouge pas - c'est ce qui
     * distingue une fermeture d'une ouverture, laquelle n'a rien avant elle et
     * doit creer son propre temps.
     *
     * Premier jet, corrige apres essai : la derniere image etait GELEE pendant
     * une seconde puis fondait. A l'ecran, le montage s'arretait avant de
     * s'eteindre.
     */
    const cutAt = Math.max(0, mainDuration - outroDuration);
    filterParts.push(
      `${tag('main')}trim=start=0:end=${formatTime(cutAt)},setpts=PTS-STARTPTS${tag('body')}`,
    );
    filterParts.push(
      `${tag('tail')}trim=start=${formatTime(cutAt)},setpts=PTS-STARTPTS,fps=${fps}${tag('tailpart')}`,
    );
    filterParts.push(
      `color=c=black:s=${width}x${height}:r=${fps}:d=${formatNumber(outroDuration)},`
      + `format=yuv420p,setpts=PTS-STARTPTS${tag('blackout')}`,
    );
    filterParts.push(...buildTransitionSubgraph({
      type: outro.type,
      index: 901,
      duration: outroDuration,
      durationA: outroDuration,
      durationB: outroDuration,
      width,
      height,
      fps,
      labelA: tag('tailpart'),
      labelB: tag('blackout'),
      labelOut: tag('outro'),
    }));
    segments[segments.length - 1] = tag('body');
    segments.push(tag('outro'));
  }

  const outLabel = tag('done');
  filterParts.push(`${segments.join('')}concat=n=${segments.length}:v=1:a=0,settb=1/${fps}${outLabel}`);
  return outLabel;
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
/*
 * LOT B3 - vaut pour les PHOTOS COMME POUR LES VIDEOS.
 *
 * Le garde `mediaType !== 'image'` qui ouvrait cette fonction n'avait pas de
 * raison technique: `zoompan` sur une entree video a ete mesure au lot B3b et
 * ne pose aucun probleme (pas de gel, aucune image dupliquee, compteur `on`
 * exact a l'image pres). Le nom `buildImageMotionFilter` est conserve pour ne
 * pas renommer quatre tables et trois tests d'un coup, mais il ne decrit plus
 * son perimetre.
 */
function buildImageMotionFilter(clip = {}, width, height, fps) {
  const motion = normalizeImageMotionForRender(clip.motion);
  const accent = SERVER_MOTION_ACCENTS[motion.accent];
  /*
   * Un accent d'IMAGE ne demande pas de `zoompan` : il ne touche pas au
   * cadrage. Le confondre avec un accent de cadrage ferait construire un
   * recadrage inutile sur un plan fixe - et surtout, la branche `shake`
   * ci-dessous ecraserait les expressions avec des valeurs qui n'existent pas
   * pour lui.
   */
  const hasAccent = Boolean(accent) && accent.kind !== 'image' && motion.accentIntensity > 0;
  const imageAccent = buildImageAccentChain(
    motion.accent,
    motion.accentIntensity,
    fps,
    getClipRenderDuration(clip),
    width,
    height,
  );
  /*
   * BUG TROUVE LE 2026-08-04 en ajoutant `glitch`. Ce garde portait
   * `&& motion.intensity > 0`, donc a intensite ZERO aucun `zoompan` n'etait
   * construit - alors que l'apercu, lui, garde le CADRAGE DE DEPART du preset.
   * Sur `zoom-out` (depart 1,14), `bounce` (1,18) ou `glitch` (1,08), l'apercu
   * montrait donc une image agrandie et l'export l'image entiere. Le defaut est
   * anterieur au glitch; il ne se voyait pas parce que personne n'avait mesure
   * la parite a intensite nulle.
   * Un `zoompan` a intensite zero est un recadrage CONSTANT, pas un surcout de
   * calcul: on le construit toujours des qu'un preset est choisi.
   */
  const hasTravel = motion.preset !== 'none';
  const hasRotation = Boolean(motion.start.rotate || motion.end.rotate) && motion.intensity > 0;
  const hasFade = motion.fadeInRatio > 0 && motion.intensity > 0;
  // Un accent SEUL suffit a demander un zoompan: une secousse sur un plan fixe
  // est un cas parfaitement legitime, et le plus courant.
  /*
   * Un accent d'image SEUL - un grain pose sur un plan fixe - est un cas
   * legitime et courant. Il sort donc sa chaine sans aucun `zoompan` : un
   * recadrage a l'identique coute un reechantillonnage pour rien.
   */
  if (!hasTravel && !hasAccent && !hasRotation && !hasFade) {
    return imageAccent ? imageAccent.replace(/^,/, '') : '';
  }
  const duration = getClipRenderDuration(clip);
  const frameCount = Math.max(2, Math.round(duration * fps));
  const progress = `min(on/${frameCount - 1},1)`;
  /*
   * LA COURBE. Deux formes, et elles doivent rester identiques a
   * `resolveImageMotionFrame` de mediaModel.js - c'est
   * `smoke-vibecut-motion-preview-parity` qui le prouve, en comparant des
   * IMAGES et non des formules.
   *
   *  - `smoothstep` : p*p*(3-2*p), la courbe de tous les mouvements depuis L3 ;
   *  - `overshoot`  : back-out, qui DEPASSE sa cible avant de se poser. C'est ce
   *    qui fait un rebond ; un smoothstep accoste sans jamais depasser.
   *
   * Les deux sont des polynomes, donc evaluables sans surcout par l'expression
   * `zoompan`. C'est le critere qui a fait retenir ces mouvements-la et ecarter
   * les autres.
   */
  const eased = motion.curve === 'overshoot'
    ? `(1+${formatNumber(OVERSHOOT_C3)}*pow((${progress})-1,3)+${formatNumber(OVERSHOOT_C1)}*pow((${progress})-1,2))`
    : `(${progress})*(${progress})*(3-2*(${progress}))`;
  const travel = motion.intensity >= 1 ? eased : `${formatNumber(motion.intensity)}*${eased}`;
  const interpolate = (start, end) => `${formatNumber(start)}+(${formatNumber(end - start)})*${travel}`;
  const zoom = interpolate(motion.start.scale, motion.end.scale);
  const x = interpolate(motion.start.x, motion.end.x);
  /*
   * LE BOMBEMENT de l'orbite, retranche a `y`. Sa PHASE suit la courbe et non
   * la course : a intensite reduite, un sinus pilote par la course n'aurait pas
   * fini son demi-tour a la fin du plan et laisserait le cadre devie. Seule son
   * amplitude suit l'intensite.
   */
  const baseY = interpolate(motion.start.y, motion.end.y);
  const arcY = motion.arc
    ? `(${baseY})-${formatNumber(motion.arc * motion.intensity)}*sin(PI*${eased})`
    : baseY;

  /*
   * L'ACCENT. Le temps est `on/fps` - des SECONDES ecoulees dans le plan - et
   * non la progression: c'est ce qui rend la frequence independante de la duree.
   */
  let zoomExpr = zoom;
  let xExpr = x;
  let yExpr = arcY;
  if (hasAccent) {
    const time = `(on/${formatNumber(fps)})`;
    const gain = motion.accentIntensity;
    if (motion.accent === 'shake') {
      const amount = formatNumber(accent.amplitude * gain);
      zoomExpr = `(${zoom})+${formatNumber(accent.zoomBoost * gain)}`;
      xExpr = `(${x})+${amount}*sin(2*PI*${formatNumber(accent.freqX)}*${time})`;
      yExpr = `(${arcY})+${amount}*sin(2*PI*${formatNumber(accent.freqY)}*${time}+${formatNumber(accent.phaseY)})`;
    } else if (motion.accent === 'pulse') {
      // (1-cos)/2 reste dans [0,1]: le zoom ne repasse jamais sous son cadrage
      // de base, donc l'image ne laisse jamais voir de bord.
      const amount = formatNumber(accent.amplitude * gain);
      zoomExpr = `(${zoom})+${amount}*(1-cos(2*PI*${formatNumber(accent.freq)}*${time}))/2`;
    }
  }

  /*
   * LE DECROCHAGE, ajoute APRES l'accent et jamais avant: les deux branches
   * ci-dessus REECRIVENT `xExpr` a partir de `x`, donc un terme pose avant elles
   * serait silencieusement perdu des qu'une secousse accompagne le mouvement.
   * Le temps est en SECONDES (`on/fps`), comme les accents, parce que la cadence
   * du decrochage est en hertz.
   */
  if (motion.jitter > 0 && motion.intensity > 0) {
    const glitch = glitchExpression(motion.jitter * motion.intensity, `(on/${formatNumber(fps)})`);
    xExpr = `(${xExpr})+${glitch}`;
  }

  /*
   * LA BASCULE. Une image tournee laisse des COINS VIDES: on l'agrandit d'abord
   * juste ce qu'il faut pour les remplir, puis on tourne. Le facteur depend du
   * FORMAT autant que de l'angle (3 degres coutent 9,2 % en 16:9, 5,1 % en
   * carre), et il est calcule ici a partir des dimensions de sortie reelles -
   * exactement comme `rotationCoverage` de mediaModel.js.
   *
   * L'ORDRE compte: on recadre (`zoompan`) PUIS on tourne (`rotate`), autour du
   * centre du cadre de sortie. L'apercu fait pareil; l'inverser ferait tourner
   * autour du point recadre et les deux divergeraient des qu'un panoramique
   * entre en jeu.
   */
  let chain = '';
  let outputSize = `${width}x${height}`;
  if (hasRotation) {
    /*
     * DEUX ECRITURES DU MEME ANGLE, et c'est obligatoire.
     *
     * `on` (numero d'image de la SORTIE) n'existe QUE dans `zoompan`. Le filtre
     * `rotate`, lui, connait `n` et `t`. Ecrire l'angle une seule fois avec
     * `on` et le donner aux deux fait echouer le graphe a la configuration -
     * « Failed to configure output pad on Parsed_rotate » - sans jamais dire
     * quelle variable manque. Mesure du 2026-08-04.
     *
     * On genere donc la meme formule deux fois, en changeant la seule variable
     * de temps. Le reste est identique, donc les deux restent d'accord.
     */
    const angleWith = (frameVar) => {
      const p = `min(${frameVar}/${frameCount - 1},1)`;
      const e = motion.curve === 'overshoot'
        ? `(1+${formatNumber(OVERSHOOT_C3)}*pow((${p})-1,3)+${formatNumber(OVERSHOOT_C1)}*pow((${p})-1,2))`
        : `(${p})*(${p})*(3-2*(${p}))`;
      const t = motion.intensity >= 1 ? e : `${formatNumber(motion.intensity)}*${e}`;
      const deg = `${formatNumber(motion.start.rotate)}+(${formatNumber(motion.end.rotate - motion.start.rotate)})*${t}`;
      return `(${deg})*PI/180`;
    };

    const angleForZoom = angleWith('on');
    const angleForRotate = angleWith('n');
    const cover = `max((${width}*abs(cos(${angleForZoom}))+${height}*abs(sin(${angleForZoom})))/${width},`
      + `(${width}*abs(sin(${angleForZoom}))+${height}*abs(cos(${angleForZoom})))/${height})`;

    /*
     * IL FAUT DE LA MATIERE AUTOUR DU CADRE, et c'est le vrai piege de la
     * bascule.
     *
     * Premier jet, faux: agrandir le zoom puis tourner. `zoompan` rend une image
     * DEJA ajustee au cadre - il n'y a rien au-dela de ses bords - donc la faire
     * tourner decouvre des coins noirs quel que soit le zoom. Mesure du
     * 2026-08-04: ecart de 4,6/255 sur la couleur moyenne, identique a 40 % et a
     * 100 % d'intensite, ce qui trahissait un defaut CONSTANT et non une erreur
     * d'angle.
     *
     * On fait donc rendre a `zoompan` un cadre PLUS GRAND (facteur K), on tourne
     * ce cadre-la, puis on recadre au centre. Les coins puisent alors dans la
     * matiere supplementaire.
     *
     * K est le facteur de couverture a l'angle MAXIMAL du mouvement: c'est le
     * plus petit qui suffise a tout instant.
     */
    const maxAngle = Math.max(Math.abs(motion.start.rotate), Math.abs(motion.end.rotate));
    const radians = (maxAngle * Math.PI) / 180;
    const K = Math.max(
      (width * Math.abs(Math.cos(radians)) + height * Math.abs(Math.sin(radians))) / width,
      (width * Math.abs(Math.sin(radians)) + height * Math.abs(Math.cos(radians))) / height,
    );
    const bigW = Math.round((width * K) / 2) * 2;
    const bigH = Math.round((height * K) / 2) * 2;

    /*
     * La fenetre source visible apres recadrage doit rester celle de l'apercu:
     * on divise donc le zoom par K (le cadre est K fois plus large) et les
     * decalages aussi, puisqu'ils s'expriment en fraction de ce cadre.
     */
    zoomExpr = `(${zoomExpr})*(${cover})/${formatNumber(K)}`;
    xExpr = `(${xExpr})/${formatNumber(K)}`;
    yExpr = `(${yExpr})/${formatNumber(K)}`;
    outputSize = `${bigW}x${bigH}`;
    // `crop` sans position recadre au CENTRE, ce qui est exactement le centre de
    // rotation. La couleur de remplissage n'est jamais visible.
    chain = `,rotate=angle='${angleForRotate}':ow=iw:oh=ih:fillcolor=black,crop=${width}:${height}`;
  }

  /*
   * L'APPARITION. En NUMEROS D'IMAGE et non en secondes: `fade` en secondes lit
   * les horodatages, qui ne sont remis a zero qu'apres cette chaine - et c'est
   * exactement le genre de decalage qui a coute une image au lot B3b. Le compte
   * d'images, lui, est celui que l'apercu utilise aussi.
   */
  if (hasFade) {
    const fadeFrames = Math.max(1, Math.round(frameCount * motion.fadeInRatio));
    chain += `,fade=t=in:start_frame=0:nb_frames=${fadeFrames}:color=black`;
  }

  return `zoompan=z='${zoomExpr}':x='(iw-iw/zoom)/2-(${xExpr})*iw/zoom':y='(ih-ih/zoom)/2-(${yExpr})*ih/zoom':d=1:s=${outputSize}:fps=${fps}${chain}${imageAccent}`;
}

/*
 * Constantes du back-out. Doivent rester identiques a OVERSHOOT_C1/C3 de
 * mediaModel.js.
 */
const OVERSHOOT_C1 = 1.70158;
const OVERSHOOT_C3 = OVERSHOOT_C1 + 1;

/*
 * LES ACCENTS - copie de IMAGE_MOTION_ACCENTS (mediaModel.js).
 *
 * Un accent n'est pas un trajet: il OSCILLE pendant tout le plan. Sa frequence
 * est en HERTZ et non en cycles par plan - une secousse doit trembler a la meme
 * vitesse sur 2 s et sur 10 s - d'ou le temps `on/fps` dans l'expression plutot
 * que la progression.
 *
 * `smoke-vibecut-motion-envelope.mjs` verifie que cette table dit la meme chose
 * que celle de l'apercu.
 */
const SERVER_MOTION_ACCENTS = {
  none: null,
  shake: { amplitude: 0.012, freqX: 3.7, freqY: 4.9, phaseY: 1.7, zoomBoost: 0.03 },
  pulse: { amplitude: 0.05, freq: 1.2, zoomBoost: 0 },
  /*
   * LES ACCENTS D'IMAGE - copie de IMAGE_MOTION_ACCENTS (mediaModel.js). Ils ne
   * touchent pas au cadrage, donc `zoomBoost` est nul et ils n'entrent pas dans
   * l'expression `zoompan` : ils sont une CHAINE DE FILTRES posee derriere.
   */
  leak: { kind: 'image', amount: 0.45, freq: 0.55, sweepFreq: 0.23, radius: 0.85, tint: '0xffb432', zoomBoost: 0 },
  grain: { kind: 'image', amount: 14, zoomBoost: 0 },
  softness: { kind: 'image', amount: 0.006, freq: 0.7, zoomBoost: 0 },
};

/*
 * LA CHAINE D'UN ACCENT D'IMAGE, posee APRES le recadrage.
 *
 * Trois mecaniques differentes, et c'est pour ca qu'ils n'ont pas pu etre
 * livres avec la secousse et la respiration :
 *
 *  - `grain` : un seul filtre `noise`, temporel. C'est le seul effet du produit
 *    dont la parite ne peut pas etre exacte - FFmpeg tire son bruit avec son
 *    propre generateur. Ce qui est prouve est la QUANTITE de bruit ajoutee.
 *  - `softness` : `gblur` n'accepte PAS d'expression pour `sigma`, et `sendcmd`
 *    est proscrit (il diffuse a tous les filtres du meme nom - lecon du lot
 *    B3b). On pose donc une CHAINE de flous a valeur constante, un par palier,
 *    gates par `enable` - exactement le procede de `steppedChain`, applique ici
 *    au plan entier plutot qu'a une fenetre de transition.
 *  - `leak` : un halo genere par `geq` puis pose en `overlay`, dont la position
 *    et l'opacite sont des EXPRESSIONS continues evaluees par image. Rien a
 *    quantifier, donc rien a paliers.
 */
const ACCENT_BLUR_STEPS = 24;

function buildImageAccentChain(accentId, gain, fps, duration, width, height) {
  const accent = SERVER_MOTION_ACCENTS[accentId];
  if (!accent || accent.kind !== 'image' || !(gain > 0)) return '';
  const time = `(on/${formatNumber(fps)})`;

  if (accentId === 'grain') {
    /*
     * `allf=t` : le bruit est retire A CHAQUE IMAGE. Sans lui il serait fige,
     * et un grain fige se lit comme une salissure d'ecran, pas comme du grain.
     */
    return `,noise=alls=${Math.round(accent.amount * gain)}:allf=t`;
  }

  if (accentId === 'softness') {
    /*
     * VINGT-QUATRE PALIERS et non douze. Douze suffisent pour une transition de
     * 0,6 s; sur un plan de plusieurs secondes, la meme quantification ferait
     * voir le flou avancer par a-coups. Les paliers dont le sigma arrondit a
     * zero ne produisent aucun maillon : la chaine reste courte aux instants ou
     * l'image est nette.
     */
    const links = [];
    for (let step = 0; step < ACCENT_BLUR_STEPS; step += 1) {
      const mid = (step + 0.5) / ACCENT_BLUR_STEPS;
      const breath = (1 - Math.cos(2 * Math.PI * accent.freq * mid * duration)) / 2;
      const sigma = accent.amount * gain * breath * width;
      if (sigma < 0.05) continue;
      const from = (step * duration) / ACCENT_BLUR_STEPS;
      const to = ((step + 1) * duration) / ACCENT_BLUR_STEPS;
      // Bornes demi-ouvertes: `between` est inclusif des deux cotes et ferait
      // appliquer deux paliers a l'image de frontiere.
      const gate = step === ACCENT_BLUR_STEPS - 1
        ? `gte(t,${formatTime(from)})*lte(t,${formatTime(to)})`
        : `gte(t,${formatTime(from)})*lt(t,${formatTime(to)})`;
      links.push(`gblur=sigma=${formatNumber(sigma)}:enable='${gate}'`);
    }
    return links.length ? `,${links.join(',')}` : '';
  }

  if (accentId === 'leak') {
    /*
     * POURQUOI `geq` SUR L'IMAGE et non un halo genere puis pose en `overlay`,
     * comme le fait la transition `light-leak`.
     *
     * L'`overlay` demande une DEUXIEME ENTREE, donc un vrai graphe avec des
     * etiquettes. Or la chaine d'un plan est ici une chaine LINEAIRE, assemblee
     * en une seule expression qui se termine par `[v<n>]`. Y injecter une
     * seconde source obligerait a changer le contrat de `buildImageMotionFilter`
     * et le decoupage de `filterParts` pour tous les plans, y compris ceux qui
     * n'ont aucun accent. `geq` fait la meme chose sans seconde entree.
     *
     * Le melange reproduit exactement le `source-over` du canvas :
     * resultat = source*(1-m) + teinte*m, avec m l'opacite locale du halo.
     * Un ajout pur (source + teinte*m) saturerait les zones deja claires et
     * l'apercu ne pourrait pas le suivre.
     */
    const radius = accent.radius * width;
    const centerY = 0.35 * height;
    const size = Math.max(2, Math.round(accent.radius * width) * 2);
    const breath = `(1-cos(2*PI*${formatNumber(accent.freq)}*T))/2`;
    const sweep = `mod(${formatNumber(accent.sweepFreq)}*T,1)`;
    const centerX = `((${sweep})*(${formatNumber(width)}+${size})-${size}/2)`;
    // Meme profil que le degrade radial du canvas: lineaire du centre au bord.
    const falloff = `max(0,1-hypot(X-${centerX},Y-${formatNumber(centerY)})/${formatNumber(radius)})`;
    const mix = `(${formatNumber(accent.amount * gain)}*${breath}*${falloff})`;
    return `,format=rgb24,geq=r='r(X,Y)*(1-${mix})+255*${mix}':`
      + `g='g(X,Y)*(1-${mix})+180*${mix}':`
      + `b='b(X,Y)*(1-${mix})+50*${mix}'`;
  }

  return '';
}

/*
 * LE DECROCHAGE du preset `glitch` - copie de GLITCH_RATE_HZ / GLITCH_PATTERN
 * (mediaModel.js), verifiee par `smoke-vibecut-motion-envelope.mjs`.
 *
 * 11,37 Hz n'est pas rond expres: une frontiere de palier qui tomberait
 * exactement sur un instant d'image ferait dependre `floor` du dernier bit du
 * calcul flottant, et les deux cotes liraient des paliers voisins - un ecart
 * d'un saut entier, pas d'une fraction de pixel.
 */
const GLITCH_RATE_HZ = 11.37;
const GLITCH_PATTERN = [0, 0, 1, 0, -0.7, 0, 0.45, 0];

/*
 * Le motif, ecrit en expression FFmpeg. Seuls les paliers NON NULS produisent
 * une branche: le motif etant a zero cinq fois sur huit, l'expression reste
 * courte et son cas par defaut est l'immobilite.
 */
function glitchExpression(amount, time) {
  const slot = `mod(floor((${time})*${formatNumber(GLITCH_RATE_HZ)}),${GLITCH_PATTERN.length})`;
  let expr = '0';
  for (let index = GLITCH_PATTERN.length - 1; index >= 0; index -= 1) {
    const value = GLITCH_PATTERN[index];
    if (!value) continue;
    expr = `if(eq(${slot},${index}),${formatNumber(amount * value)},${expr})`;
  }
  return expr;
}
const SUPPORTED_SERVER_MOTION_ACCENTS = new Set(Object.keys(SERVER_MOTION_ACCENTS));

function normalizeImageMotionForRender(motion = {}) {
  /*
   * COPIE de IMAGE_MOTION_PRESETS (mediaModel.js). Elle est dupliquee et non
   * importee - le renderer est un service separe - et c'est
   * `smoke-vibecut-motion-envelope.mjs` qui verifie que les deux tables disent
   * la meme chose, `arc` et `curve` compris. Une divergence ici rendrait un
   * mouvement DIFFERENT de celui que l'apercu montre, sans que rien ne le dise.
   */
  const presets = {
    none: { start: { scale: 1, x: 0, y: 0 }, end: { scale: 1, x: 0, y: 0 } },
    'zoom-in': { start: { scale: 1, x: 0, y: 0 }, end: { scale: 1.14, x: 0, y: 0 } },
    'zoom-out': { start: { scale: 1.14, x: 0, y: 0 }, end: { scale: 1, x: 0, y: 0 } },
    'pan-left': { start: { scale: 1.12, x: 0.055, y: 0 }, end: { scale: 1.12, x: -0.055, y: 0 } },
    'pan-right': { start: { scale: 1.12, x: -0.055, y: 0 }, end: { scale: 1.12, x: 0.055, y: 0 } },
    'drift-up': { start: { scale: 1.1, x: 0, y: 0.045 }, end: { scale: 1.14, x: 0, y: -0.045 } },
    'drift-down': { start: { scale: 1.14, x: 0, y: -0.045 }, end: { scale: 1.1, x: 0, y: 0.045 } },
    orbit: { start: { scale: 1.16, x: -0.05, y: 0 }, end: { scale: 1.16, x: 0.05, y: 0 }, arc: 0.045 },
    bounce: { start: { scale: 1.18, x: 0, y: 0.05 }, end: { scale: 1.04, x: 0, y: 0 }, curve: 'overshoot' },
    rotate: { start: { scale: 1, x: 0, y: 0, rotate: -3 }, end: { scale: 1, x: 0, y: 0, rotate: 3 } },
    appear: { start: { scale: 1.06, x: 0, y: 0 }, end: { scale: 1, x: 0, y: 0 }, fadeInRatio: 0.3 },
    glitch: { start: { scale: 1.08, x: 0, y: 0 }, end: { scale: 1.08, x: 0, y: 0 }, jitter: 0.03 },
  };
  const presetName = SUPPORTED_SERVER_IMAGE_MOTIONS.has(motion?.preset) ? motion.preset : 'none';
  const preset = presets[presetName];
  const normalizeFrame = (frame, fallback) => ({
    scale: clampNumber(Number(frame?.scale), 1, 2, fallback.scale),
    x: clampNumber(Number(frame?.x), -0.35, 0.35, fallback.x),
    y: clampNumber(Number(frame?.y), -0.35, 0.35, fallback.y),
    rotate: clampNumber(Number(frame?.rotate), -8, 8, fallback.rotate || 0),
  });
  return {
    preset: presetName,
    // Absente du manifeste = mouvement plein, comme avant le lot L3.
    intensity: clampNumber(Number(motion?.intensity), 0, 1, 1),
    start: normalizeFrame(motion?.start, preset.start),
    end: normalizeFrame(motion?.end, preset.end),
    /*
     * Relus du preset LOCAL, jamais du manifeste: la forme du trajet appartient
     * au mouvement, pas au reglage. Un manifeste qui pourrait les porter
     * permettrait de demander au serveur une trajectoire que l'apercu n'a jamais
     * dessinee.
     */
    arc: Number(preset.arc) || 0,
    curve: preset.curve === 'overshoot' ? 'overshoot' : 'smoothstep',
    /*
     * L'accent est un REGLAGE, pas une propriete du preset: il se compose avec
     * n'importe quel mouvement, donc il voyage dans le manifeste. Un id inconnu
     * retombe sur `none` plutot que de faire echouer le rendu - le pre-vol, lui,
     * le refuse en amont.
     */
    fadeInRatio: clampNumber(Number(preset.fadeInRatio), 0, 0.9, 0),
    jitter: clampNumber(Number(preset.jitter), 0, 0.2, 0),
    accent: SUPPORTED_SERVER_MOTION_ACCENTS.has(motion?.accent) ? motion.accent : 'none',
    accentIntensity: clampNumber(Number(motion?.accentIntensity), 0, 1, 1),
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
 * a UNE question — « ce build rend-il les cibles xfade attendues, oui ou
 * non, et si non lesquelles manquent ». Les noms de transitions sont deja
 * publics (ils sont dans l'interface), donc les exposer ne coute rien.
 *
 * Si un jour le service passe en Cloud Run PRIVE (IAM), cette precaution
 * devient facultative — mais la retirer ne rapporterait rien non plus.
 * =========================================================================
 */
async function describeRendererCapabilities() {
  const wanted = [...new Set(Object.values(SERVER_XFADE_TRANSITION_MAP))].sort();
  const wantedFilters = collectRequiredFilters();
  // Detail complet, destine aux JOURNAUX uniquement. Jamais renvoye au client.
  const privateDiagnostics = { ffmpeg: null, failures: [] };
  const report = {
    ok: false,
    service: 'vibecut-render-service',
    // La revision est deja lisible par quiconque appelle le service: elle
    // n'ajoute aucune information exploitable, et elle est indispensable pour
    // savoir QUELLE image on vient d'interroger apres un rollout.
    revision: process.env.K_REVISION || null,
    /*
     * v5 (lot B3b): les 15 dernieres transitions ne sont plus des cibles `xfade`
     * mais des sous-graphes de filtres natifs. Verifier les cibles ne dit donc
     * plus rien d'elles - il faut verifier les FILTRES.
     *
     * v6 (lot B3): les MOUVEMENTS PHOTO sont eux aussi une capacite du service,
     * et rien ne les verifiait. Un renderer d'avant le lot refuse `orbit`,
     * `bounce` et `drift-down` avec « Image motion is not supported » - un refus
     * d'export franc, mais que le pre-vol ne voyait pas venir. La liste est
     * relevee sur le VERROU lui-meme, jamais recopiee.
     */
    capabilitiesVersion: 7,
    xfade: { required: wanted, missing: wanted, available: null },
    filters: { required: wantedFilters, missing: wantedFilters },
    imageMotions: { supported: [...SUPPORTED_SERVER_IMAGE_MOTIONS].sort() },
    motionAccents: { supported: [...SUPPORTED_SERVER_MOTION_ACCENTS].sort() },
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

  /*
   * LES FILTRES DU LOT B3b.
   *
   * Depuis ce lot, quinze transitions ne sont plus une cible `xfade` mais un
   * SOUS-GRAPHE de filtres natifs. Verifier les cibles ne prouve donc plus rien
   * a leur sujet : un build ou `displace` ou `zoompan` manquerait passerait le
   * controle des cibles et ferait echouer le rendu entier en production.
   *
   * La liste n'est pas ecrite en dur : elle est RELEVEE sur les sous-graphes que
   * le renderer emet reellement. Ajouter un filtre a un effet l'ajoute
   * automatiquement au controle.
   */
  try {
    const filterHelp = await runCommandCapture('ffmpeg', ['-hide_banner', '-filters'])
      .catch((error) => String(error.message || error));
    const text = String(filterHelp);
    report.filters.missing = wantedFilters.filter((name) => !new RegExp(`\\s${name}\\s`).test(text));
  } catch (error) {
    privateDiagnostics.failures.push(`ffmpeg -filters: ${error.message}`);
  }

  report.errorCount = privateDiagnostics.failures.length;
  report.ok = report.errorCount === 0
    && report.xfade.missing.length === 0
    && report.filters.missing.length === 0;

  // Le detail va dans les journaux Cloud Run, jamais dans la reponse HTTP.
  console.log('[capabilities]', JSON.stringify({
    ok: report.ok,
    revision: report.revision,
    ffmpeg: privateDiagnostics.ffmpeg,
    missing: report.xfade.missing,
    missingFilters: report.filters.missing,
    failures: privateDiagnostics.failures,
  }));

  return report;
}

/*
 * Les noms de filtres FFmpeg employes par les sous-graphes de transition, RELEVES
 * sur ce que le renderer emet vraiment plutot qu'ecrits a la main : une liste
 * recopiee derive des que l'on ajoute un effet, et c'est precisement ce qu'un
 * point de controle ne doit pas faire.
 */
function collectRequiredFilters() {
  const names = new Set();
  Object.keys(SERVER_TRANSITION_EFFECTS).forEach((type) => {
    buildTransitionSubgraph({
      type,
      index: 1,
      duration: 0.6,
      durationA: 2,
      durationB: 2,
      width: 1920,
      height: 1080,
      fps: 30,
      labelA: '[a]',
      labelB: '[b]',
      labelOut: '[x]',
    }).forEach((part) => {
      part.split(/[;,]/).forEach((chunk) => {
        const match = /(?:^|\])\s*([a-z][a-z0-9_]*)\s*(?:=|$)/.exec(chunk.trim());
        if (match) names.add(match[1]);
      });
    });
  });
  return [...names].sort();
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
