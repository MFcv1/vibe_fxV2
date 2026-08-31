"use client";

/*
 * Vignettes des presets.
 *
 * L'ancien rendu (`renderVisionProfilePreview`) refaisait, pour CHACUN des 12
 * looks: un `drawImage` depuis l'image pleine resolution (jusqu'a 4000 px) vers
 * 384x232, puis quatre passes pixel successives, puis un encodage JPEG complet.
 * C'est ce qui rendait l'ecran saccade a chaque changement de photo.
 *
 * Ici la source est reduite UNE SEULE FOIS dans un canvas hors-ecran partage,
 * puis chaque vignette passe dans LE MEME moteur que l'apercu principal.
 * C'est volontairement un peu plus couteux qu'une LUT seule: une vignette qui
 * oublierait le grain, la texture, la clarte, le voile ou le vignetage ferait
 * choisir un rendu qui n'est pas celui du preset — exactement le contraire de
 * ce que montre Lightroom.
 */

import { applyFiltersPro } from '../../vibefx-studio/engine/studioRenderer';
import { DEFAULT_FILTERS } from '../../vibefx-studio/hooks/useStudioFilters';

/* Une carte fait environ 160 x 97 px dans le rail. 192 x 116 garde une petite
   marge pour les ecrans denses sans faire travailler le pipeline sur 5,8 fois
   plus de pixels que ce qui est affiche. La fidelite du moteur ne change pas:
   seuls les pixels de travail sont moins nombreux. */
export const PREVIEW_WIDTH = 192;
export const PREVIEW_HEIGHT = 116;
export const PREVIEW_ASPECT_RATIO = `${PREVIEW_WIDTH} / ${PREVIEW_HEIGHT}`;
export const PREVIEW_ENGINE_VERSION = 'vision-full-v2-192';

/*
 * Reduit la photo une fois, en respectant le cadrage centre des vignettes.
 * Le resultat est destine a etre reutilise par tous les presets.
 */
export function buildPreviewSource(image) {
    if (!image || typeof document === 'undefined') return null;
    const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    const sourceW = image.naturalWidth || image.width;
    const sourceH = image.naturalHeight || image.height;
    if (!sourceW || !sourceH) return null;

    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const sourceRatio = sourceW / sourceH;
    const targetRatio = PREVIEW_WIDTH / PREVIEW_HEIGHT;
    let sx = 0;
    let sy = 0;
    let sw = sourceW;
    let sh = sourceH;
    if (sourceRatio > targetRatio) {
        sw = sourceH * targetRatio;
        sx = (sourceW - sw) / 2;
    } else {
        sh = sourceW / targetRatio;
        sy = (sourceH - sh) / 2;
    }
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

    /* On garde les pixels bruts: chaque vignette repart de cette copie sans
       redemander un `getImageData` au canvas. */
    const source = {
        imageData: ctx.getImageData(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT),
        /* Le grain Lightroom depend de la taille de la photo, pas seulement de
           la taille de la vignette affichee. Sans cette mesure, un fichier de
           50 MP recevrait le grain d'une image de 192 px dans les cartes. */
        sourceLongEdge: Math.max(sourceW, sourceH),
    };
    globalThis.__visionPreviewMetrics?.push({
        type: 'source',
        ms: performance.now() - startedAt,
    });
    return source;
}

/*
 * Rend la vignette d'un preset a partir de la source reduite.
 * Renvoie une Promise de Blob JPEG, ou `null` si le preset est introuvable.
 */
export function renderPresetPreview(source, preset) {
    if (!source?.imageData || !preset?.id || typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    /* Copie: le moteur travaille en place, on ne touche jamais a la source
       partagee entre les cartes. */
    const copy = new ImageData(
        new Uint8ClampedArray(source.imageData.data),
        PREVIEW_WIDTH,
        PREVIEW_HEIGHT,
    );
    ctx.putImageData(copy, 0, 0);

    const filters = {
        ...DEFAULT_FILTERS,
        ...(preset.spatialFilters || {}),
        presetId: preset.id,
        filterIntensity: preset.recommendedIntensity || 85,
        safeSmartphone: true,
    };
    const renderStartedAt = performance.now();
    applyFiltersPro(
        ctx,
        canvas,
        PREVIEW_WIDTH,
        PREVIEW_HEIGHT,
        'high',
        filters,
        source.sourceLongEdge,
        Math.max(PREVIEW_WIDTH, PREVIEW_HEIGHT),
    );
    const renderMs = performance.now() - renderStartedAt;

    return new Promise((resolve) => {
        const encodeStartedAt = performance.now();
        canvas.toBlob((blob) => {
            globalThis.__visionPreviewMetrics?.push({
                type: 'preset',
                presetId: preset.id,
                hasSpatialEffects: Boolean(preset.spatialFilters
                    && Object.keys(preset.spatialFilters).length),
                renderMs,
                encodeMs: performance.now() - encodeStartedAt,
            });
            resolve(blob);
        }, 'image/jpeg', 0.82);
    });
}
