import {
    applyFilmGrain,
    applyDegradeBas,
    applyLightroomVignette,
    applyFusedPixelOps,
    applyClarity,
    applyTexture,
    applySharpness,
    applyHalation,
    applyPerceptualIntensityBlend,
    applySmartphoneOutputGuards,
    applySafeGlobalTint
} from '../utils/canvasUtils';
import { normalizeVisionFilters } from '../utils/visionColorScience';
import { applyLut3d, LUT_SIZE } from '../utils/lut3d';
import { getPresetLut } from '../utils/visionPresets';

/**
 * renderStudio - Rendu du mode Studio/Vision (crop et filtres).
 * Pipeline Vision Pro v3 - 10 etapes, fused pixel ops.
 */
/*
 * `viewport` est la LOUPE de l'apercu: { zoom, cx, cy }, cx/cy dans [0,1]. Elle
 * ne recadre RIEN — l'export ne la recoit jamais — elle choisit seulement quelle
 * portion de l'image on regarde, et a quelle echelle.
 *
 * Elle existe parce qu'un effet de matiere ne se juge pas sur une image reduite:
 * a « Adapter », le grain d'une photo de 9180 px dessinee sur 800 px est moyenne
 * par 11, donc invisible. Lightroom repond a ca par le zoom 100 %, ou chaque
 * pixel de l'image vaut un pixel de l'ecran. On fait pareil.
 */
export function renderStudio(ctx, targetCanvas, w, h, isPreview, quality, {
    images, cropRatio, cropPos, cropScale, isCropping,
    filters, viewport
}) {
    const img = images[0];
    /*
     * DEUX mesures, et les confondre est un bug qu'on a deja fait deux fois.
     *
     * `grandCoteImage` est le GRAND COTE de l'image FINALE (recadrage compris):
     * c'est lui qui fixe la grosseur et la force du grain.
     *
     * LE GRAND COTE, PAS LA LARGEUR — et c'est mesure. Une mire de 2160x3240
     * exportee de Lightroom en PORTRAIT rend exactement le meme grain que la
     * meme mire en paysage 3240x2160: 12,62 contre 12,64 (2026-08-22). Si
     * Lightroom lisait la largeur, la version portrait aurait rendu 15,73. Une
     * photo verticale de 9180x16320 compte donc comme une image de 16320, pas
     * de 9180 — et l'ecart valait 47 % sur le grain.
     *
     * `grandCoteRendu` est le grand cote auquel cette image ENTIERE serait
     * dessinee au zoom courant. Le rapport des deux dit ce que l'affichage fait
     * perdre. A « Adapter » il suit le canvas; a 100 % il vaut
     * `grandCoteImage`, et le grain apparait a sa vraie force.
     */
    let grandCoteImage = Math.max(w, h);
    let grandCoteRendu = Math.max(w, h);

    if (img) {
        let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

        if (cropRatio !== 'original' || cropScale !== 1.0 || cropPos.x !== 0 || cropPos.y !== 0) {
            const effectiveRatio = cropRatio === 'original'
                ? (img.width / img.height)
                : (() => { const [rW, rH] = cropRatio.split(':').map(Number); return rW / rH; })();

            let baseSWidth, baseSHeight;
            const imgRatio = img.width / img.height;
            if (imgRatio > effectiveRatio) { baseSHeight = img.height; baseSWidth = baseSHeight * effectiveRatio; }
            else { baseSWidth = img.width; baseSHeight = baseSWidth / effectiveRatio; }

            const effectiveScale = Math.max(0.5, cropScale);
            sWidth = baseSWidth / effectiveScale;
            sHeight = baseSHeight / effectiveScale;
            const maxSx = img.width - sWidth;
            const maxSy = img.height - sHeight;
            const targetSx = maxSx * 0.5 - cropPos.x;
            const targetSy = maxSy * 0.5 - cropPos.y;
            sx = Math.max(0, Math.min(targetSx, maxSx));
            sy = Math.max(0, Math.min(targetSy, maxSy));
        }

        grandCoteImage = Math.max(sWidth, sHeight);
        grandCoteRendu = Math.max(w, h);

        /* La loupe, apres le recadrage et seulement a l'apercu. */
        const zoom = isPreview && viewport?.zoom > 1 ? viewport.zoom : 1;
        if (zoom > 1) {
            const zWidth = sWidth / zoom;
            const zHeight = sHeight / zoom;
            /* cx/cy disent OU on regarde, en fraction de la marge disponible:
               0 = bord gauche/haut, 1 = bord droit/bas, 0,5 = centre. */
            sx += (sWidth - zWidth) * Math.min(1, Math.max(0, viewport.cx ?? 0.5));
            sy += (sHeight - zHeight) * Math.min(1, Math.max(0, viewport.cy ?? 0.5));
            sWidth = zWidth;
            sHeight = zHeight;
            grandCoteRendu = Math.max(w, h) * zoom;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, w, h);

        if (isPreview && isCropping) {
            renderCropGrid(ctx, w, h);
        }
    }


    // ═══════════════════════════════════════════════════════
    applyFiltersPro(ctx, targetCanvas, w, h, quality, filters, grandCoteImage, grandCoteRendu);
}

/**
 * renderCropGrid — Dessine la grille de crop (rule of thirds).
 */
function renderCropGrid(ctx, w, h) {
    const baseLW = Math.max(2, Math.min(w, h) * 0.003);
    ctx.beginPath();
    const x1 = w * 0.333; const x2 = w * 0.666;
    const y1 = h * 0.333; const y2 = h * 0.666;
    ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
    ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
    ctx.moveTo(0, y1); ctx.lineTo(w, y1);
    ctx.moveTo(0, y2); ctx.lineTo(w, y2);
    ctx.lineCap = 'square';
    ctx.lineWidth = baseLW * 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.lineWidth = baseLW * 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
}

/**
 * applyFiltersPro — Vision Pro v3 pipeline.
 *
 * Pipeline Order:
 *  1. CSS Filters (brightness, contrast, saturation, hue-rotate, sepia, blur)
 *  2. Fused Pixel Ops (curves + temperature + highlights/shadows + dehaze +
 *     faded blacks + split toning + vibrance) — SINGLE getImageData pass
 *  3. Legacy Tint (backward compat overlay tint)
 *  4. Clarity (spatial high-pass mid-frequency boost)
 *  5. Sharpness (unsharp mask, small radius)
 *  6. Halation (glow around highlights — CineStill)
 *  7. Vignette (radial gradient)
 *  8. Grain (noise pattern)
 *  9. Intensity Blend (original/filtered mix)
 */
function applyFiltersPro(ctx, targetCanvas, w, h, quality, filters,
    grandCoteImage = Math.max(w, h), grandCoteRendu = Math.max(w, h)) {
    const safeFilters = normalizeVisionFilters(filters);
    const intensity = safeFilters.filterIntensity !== undefined ? safeFilters.filterIntensity : 100;
    if (intensity === 0) return;

    // Save original for intensity blending
    let originalCanvas = null;
    if (intensity < 100) {
        originalCanvas = document.createElement('canvas');
        originalCanvas.width = w;
        originalCanvas.height = h;
        originalCanvas.getContext('2d').drawImage(targetCanvas, 0, 0);
    }

    // ── Stage 1: CSS Filters ─────────────────────────────
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(targetCanvas, 0, 0);

    ctx.clearRect(0, 0, w, h);

    const hueRotate = safeFilters.hueRotate || 0;
    const doColorPixelOps = true;
    const doSpatialPixelOps = quality !== 'low';
    ctx.filter = [
        `brightness(${safeFilters.brightness}%)`,
        `contrast(${safeFilters.contrast}%)`,
        `saturate(100%)`,
        safeFilters.sepia ? `sepia(${safeFilters.sepia}%)` : '',
        (doSpatialPixelOps && safeFilters.blur) ? `blur(${safeFilters.blur}px)` : '',
        hueRotate ? `hue-rotate(${hueRotate}deg)` : ''
    ].filter(Boolean).join(' ');

    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';

    const doPixelOps = doColorPixelOps;
    const doSpatialPixelOpsForQuality = doSpatialPixelOps;

    // ── Stage 1.5: Preset (LUT 3D) ───────────────────────
    // Le preset pose le look de base; les reglages manuels des etapes suivantes
    // s'appliquent PAR-DESSUS. Une seule passe, cout constant quel que soit le
    // preset (voir `utils/lut3d.js`).
    const presetLut = getPresetLut(safeFilters.presetId);
    if (presetLut) {
        applyLut3d(ctx, w, h, presetLut, LUT_SIZE, 1);
    }

    if (doPixelOps) {
        // ── Stage 2: Fused Pixel Ops (single pass) ───────
        applyFusedPixelOps(ctx, w, h, safeFilters);
    }

    // ── Stage 3: Legacy Tint ─────────────────────────────
    if (safeFilters.tintIntensity > 0) {
        applySafeGlobalTint(ctx, w, h, safeFilters.tintColor, safeFilters.tintIntensity, safeFilters.safeSmartphone !== false);
    }

    if (doSpatialPixelOpsForQuality) {
        // ── Stage 4: Clarity ─────────────────────────────
        applyClarity(ctx, targetCanvas, w, h, safeFilters.clarity);

        // ── Stage 4 bis: Texture ─────────────────────────
        /*
         * Apres la clarte et avant la nettete: du plus large au plus fin, comme
         * dans Lightroom. La texture est arrivee le 2026-08-16 — jusque-la un
         * preset qui en portait rendait moins de matiere, en silence. Le detail
         * de la mesure est dans `applyTexture`.
         */
        applyTexture(ctx, targetCanvas, w, h, safeFilters.texture);

        // ── Stage 5: Sharpness ───────────────────────────
        applySharpness(ctx, targetCanvas, w, h, safeFilters.sharpness);

        // ── Stage 6: Halation ────────────────────────────
        applyHalation(ctx, w, h, safeFilters.halation, safeFilters.halationColor, safeFilters.safeSmartphone !== false);
    }

    // ── Stage 7: Vignette ────────────────────────────────
    /*
     * Depuis le 2026-08-16, l'echelle du vignetage est celle de Lightroom, et
     * la multiplication a lieu en lumiere LINEAIRE — pas en sRVB comme avant,
     * ou les bandes claires et sombres ne recevaient pas le meme traitement.
     * La mesure est dans `applyLightroomVignette`.
     */
    if (safeFilters.vignette > 0) {
        applyLightroomVignette(ctx, w, h, safeFilters.vignette);
    }

    // ── Stage 7 bis: Degrade du bas ──────────────────────
    /*
     * Ajoute le 2026-08-29. Ce n'est PAS un vignetage: sa rampe est verticale,
     * elle part du milieu du cadre et n'assombrit que le bas. Le vignetage,
     * radial, assombrit aussi le haut — sur la photo qui a motive cet effet, ca
     * faisait EMPIRER le rendu (5,41 sans, 5,46 a 5,99 avec, quelle que soit la
     * dose). La mesure est dans `applyDegradeBas`. Il vient apres le vignetage
     * parce que les deux sont des poids d'exposition et que leur ordre ne
     * change rien; il vient avant le grain, qui doit rester le dernier.
     */
    if (safeFilters.degradeBas > 0) {
        applyDegradeBas(ctx, w, h, safeFilters.degradeBas);
    }

    // ── Stage 8: Grain ───────────────────────────────────
    /*
     * Depuis le 2026-08-15, notre echelle EST celle de Lightroom: « Grain 15 »
     * veut dire la meme chose des deux cotes (ecart-type 5,5/255).
     *
     * Depuis le 2026-08-20, la GROSSEUR des grains l'est aussi: elle suit son
     * sous-reglage « Taille » ET la largeur de l'image, qui fait grossir son
     * grain quand la photo est grande. Sans ca, la meme valeur rendait un grain
     * jusqu'a 2,3 fois trop fort et trop fin sur une photo pleine resolution.
     * Les mesures sont dans `grainField.js`.
     */
    if (safeFilters.grain > 0 && quality !== 'low') {
        applyFilmGrain(ctx, w, h, safeFilters.grain, safeFilters.grainSize, grandCoteImage, grandCoteRendu,
            safeFilters.grainRoughness);
    }

    // ── Stage 9: Intensity Blend ─────────────────────────
    if (doPixelOps) {
        applySmartphoneOutputGuards(ctx, w, h, safeFilters);
    }

    if (intensity < 100 && originalCanvas) {
        applyPerceptualIntensityBlend(ctx, w, h, originalCanvas, intensity);
    }
}
