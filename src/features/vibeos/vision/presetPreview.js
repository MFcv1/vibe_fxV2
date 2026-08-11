"use client";

/*
 * Vignettes des presets.
 *
 * L'ancien rendu (`renderVisionProfilePreview`) refaisait, pour CHACUN des 12
 * looks: un `drawImage` depuis l'image pleine resolution (jusqu'a 4000 px) vers
 * 384x232, puis quatre passes pixel successives, puis un encodage JPEG complet.
 * C'est ce qui rendait l'ecran saccade a chaque changement de photo.
 *
 * Ici:
 *   - la source est reduite UNE SEULE FOIS dans un canvas hors-ecran partage,
 *     et toutes les vignettes partent de ces ~90 000 pixels ;
 *   - chaque vignette ne fait plus qu'une passe (la LUT du preset) ;
 *   - on ne passe plus par `toDataURL`: le canvas est rendu tel quel, ce qui
 *     evite un encodage JPEG par vignette.
 */

import { applyLut3dToData, LUT_SIZE } from '../../vibefx-studio/utils/lut3d';
import { getPresetLut } from '../../vibefx-studio/utils/visionPresets';

export const PREVIEW_WIDTH = 384;
export const PREVIEW_HEIGHT = 232;
export const PREVIEW_ASPECT_RATIO = `${PREVIEW_WIDTH} / ${PREVIEW_HEIGHT}`;

/*
 * Reduit la photo une fois, en respectant le cadrage centre des vignettes.
 * Le resultat est destine a etre reutilise par tous les presets.
 */
export function buildPreviewSource(image) {
    if (!image || typeof document === 'undefined') return null;
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
    return ctx.getImageData(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
}

/*
 * Rend la vignette d'un preset a partir de la source reduite.
 * Renvoie une data URL, ou `null` si le preset est introuvable.
 */
export function renderPresetPreview(sourceImageData, presetId) {
    if (!sourceImageData || typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    /* Copie: `applyLut3dToData` travaille en place, on ne touche pas a la source
       partagee entre vignettes. */
    const copy = new ImageData(
        new Uint8ClampedArray(sourceImageData.data),
        PREVIEW_WIDTH,
        PREVIEW_HEIGHT,
    );
    const lut = getPresetLut(presetId);
    if (lut) applyLut3dToData(copy.data, lut, LUT_SIZE, 1);
    ctx.putImageData(copy, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.82);
}
