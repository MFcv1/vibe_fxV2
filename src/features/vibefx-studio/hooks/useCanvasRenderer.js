import { useCallback, useEffect, useRef } from 'react';
import { renderLayoutBackground, renderLayoutImageTexture, renderTemplateSlots, renderLayoutTexture, renderSlotSelection, renderGuides } from '../engine/layoutRenderer';
import { renderAssets, renderAssetSelection } from '../engine/assetRenderer';
import { renderTexts, renderTextSelection } from '../engine/textRenderer';
import { renderStudio } from '../engine/studioRenderer';

/* L'apercu Vision/Studio occupe au plus environ 1000 px sur cette interface.
   Calculer 3 Mpx ne montrait aucun detail supplementaire, mais bloquait le
   thread principal au moment exact ou les premieres cartes de presets doivent
   apparaitre. L'export conserve evidemment la resolution originale. */
const MAX_INTERACTIVE_PREVIEW_MEGAPIXELS = 1.25;

/*
 * Resolution de calcul PENDANT qu'on bouge un curseur.
 *
 * Le probleme mesure: l'apercu Vision est calcule a la resolution de la photo
 * (1,9 Mpx pour une photo de telephone) alors qu'il est AFFICHE sur ~550 px de
 * large. A chaque cran de curseur, on faisait donc tourner toute la science des
 * couleurs sur quatre fois plus de pixels que ce que l'ecran montre — d'ou la
 * sensation de latence.
 *
 * Pendant le geste on divise donc la resolution par deux (quatre fois moins de
 * pixels), et on repasse en pleine resolution des que le doigt se leve. La
 * qualite 'low' fait le reste: elle saute les operations qui lisent les pixels
 * voisins (relief, nettete, voile, grain), les plus couteuses de toutes.
 *
 * L'export, lui, n'est pas concerne: il rend dans son propre canvas a la taille
 * reelle (`useExport`), toujours en qualite 'high'.
 */
const INTERACTIVE_SCALE = 0.5;

const capCanvasDimensions = ({ width, height }, maxMegapixels = MAX_INTERACTIVE_PREVIEW_MEGAPIXELS) => {
    const pixels = width * height;
    const maxPixels = maxMegapixels * 1000000;
    if (!width || !height || pixels <= maxPixels) {
        return { width, height, scale: 1, capped: false };
    }

    const scale = Math.sqrt(maxPixels / pixels);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        scale,
        capped: true,
    };
};

/**
 * useCanvasRenderer — Orchestrateur du pipeline de rendu canvas.
 * Assemble les renderers layout/studio/text/asset en un pipeline unifié.
 */
export default function useCanvasRenderer({
    canvasRef, images, view,
    // Layout
    activeFormat, activeTemplate, overlayMode,
    padding, gap, customLayoutGap, radius,
    layoutBgColor, layoutBgBlur, layoutBgGradient, layoutBgMeshColors, layoutLumenBackground, layoutBgTexture, layoutSmoothBlur,
    layoutTextures, activeTextureId, layoutTextureOpacity,
    selectedSlotIndex, slotConfigs,
    slotRects, bgCanvasRef,
    // Text & Assets
    texts, assets, activeTextId, activeAssetId,
    isDraggingText, activeGuides,
    // Studio
    cropRatio, cropPos, cropScale, isCropping,
    filters,
    /* Loupe de l'apercu: { zoom, cx, cy }. Ne recadre rien, ne sort jamais a
       l'export — voir `renderStudio`. */
    viewport,
    // Animation
    isDragging, requestRef,
    setSlotRectsState,
}) {
    // Prerender Background for Layout
    useEffect(() => {
        if (view === 'layout' && images.length > 0 && layoutBgBlur) {
            const W = activeFormat.w;
            const H = activeFormat.h;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = W;
            tempCanvas.height = H;
            const ctx = tempCanvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, W, H);
            const img = images[0];
            const imgRatio = img.width / img.height;
            const targetRatio = W / H;
            let sw, sh, sx, sy;
            if (targetRatio > imgRatio) { sw = img.width; sh = img.width / targetRatio; sx = 0; sy = (img.height - sh) / 2; }
            else { sh = img.height; sw = img.height * targetRatio; sy = 0; sx = (img.width - sw) / 2; }
            ctx.filter = 'blur(60px) brightness(0.8)';
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
            bgCanvasRef.current = tempCanvas;
        } else {
            bgCanvasRef.current = null;
        }
    }, [images, activeFormat, layoutBgBlur, view, bgCanvasRef]);

    const getCanvasDimensions = useCallback(() => {
        if (view === 'layout') return { width: activeFormat.w, height: activeFormat.h };
        if (!images.length) return { width: 0, height: 0 };

        const img = images[0];
        let sWidth = img.width;
        let sHeight = img.height;
        if (cropRatio !== 'original') {
            const [rW, rH] = cropRatio.split(':').map(Number);
            const targetRatio = rW / rH;
            if (img.width / img.height > targetRatio) { sHeight = img.height; sWidth = sHeight * targetRatio; }
            else { sWidth = img.width; sHeight = sWidth / targetRatio; }
        }
        return { width: Math.ceil(sWidth), height: Math.ceil(sHeight) };
    }, [images, view, activeFormat, cropRatio]);

    const getPreviewCanvasDimensions = useCallback(() => {
        const dimensions = getCanvasDimensions();
        if (view === 'studio' || view === 'vision-pro') {
            return capCanvasDimensions(dimensions);
        }
        return { ...dimensions, scale: 1, capped: false };
    }, [getCanvasDimensions, view]);

    const renderPipeline = useCallback((targetCanvas, w, h, isPreview, quality = 'high', overrides = {}) => {
        const ctx = targetCanvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        if (view === 'layout') {
            // Collect slot rects for hit detection
            const slotRectsArray = [];

            const layoutOpts = {
                images, slotConfigs, radius,
                layoutBgBlur, layoutBgColor, activeTemplate,
                slotRects: slotRectsArray,
                isPreview,
            };

            // 1. Background
            renderLayoutBackground(ctx, w, h, {
                images, layoutBgColor, layoutBgBlur, layoutBgGradient, layoutBgMeshColors, layoutLumenBackground,
                bgCanvas: bgCanvasRef.current, activeTemplate,
            });
            renderLayoutImageTexture(ctx, w, h, {
                layoutTextures, activeTextureId, layoutTextureOpacity, activeTemplate,
            });

            const hasCustomSlots = activeTemplate.id === 'custom' && activeTemplate.customLayout?.zones?.length > 0;
            const hasGeneratedLayoutBackground = layoutBgGradient || Boolean(layoutLumenBackground?.image) || layoutTextures?.length > 0;
            const hasTextsOrAssets = (texts && texts.length > 0) || (assets && assets.length > 0);
            if (images.length === 0 && !hasCustomSlots && !hasGeneratedLayoutBackground && !hasTextsOrAssets) {
                slotRects.current = [];
                if (setSlotRectsState && isPreview) {
                    setSlotRectsState({ rects: [], width: w, height: h });
                }
                return;
            }

            // 2. Template slots
            if (images.length > 0 || hasCustomSlots) {
                renderTemplateSlots(ctx, w, h, {
                ...layoutOpts,
                activeTemplate, padding, gap, customLayoutGap, overlayMode,
            });

            }
            // 3. Texture overlay
            renderLayoutTexture(ctx, w, h, { layoutBgTexture, activeTemplate });

            // 3.5 True Smooth Blur Overlay (Layered Vercel implementation)
            if (layoutSmoothBlur && layoutSmoothBlur.enabled) {
                // Set layers precision (limit slightly to prevent GPU crash during live dragging)
                // If dragging, we can limit it dynamically using isDraggingText, etc., but 15 is safe on canvas usually
                let P = Math.min(30, Math.max(5, layoutSmoothBlur.precision || 10));

                // Copy current canvas as base for all blurred layers
                const baseCanvas = document.createElement('canvas');
                baseCanvas.width = w; baseCanvas.height = h;
                const baseCtx = baseCanvas.getContext('2d');
                baseCtx.drawImage(targetCanvas, 0, 0);

                const easings = {
                    linear: t => t,
                    sine: t => 1 - Math.cos((t * Math.PI) / 2),
                    quad: t => t * t,
                    cubic: t => t * t * t,
                    quart: t => t * t * t * t,
                    quint: t => t * t * t * t * t,
                    expo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
                    circ: t => 1 - Math.sqrt(1 - t * t),
                };

                const preset = layoutSmoothBlur.preset || 'linear';
                const type = layoutSmoothBlur.easeType || 'in';
                const reverse = layoutSmoothBlur.reverse || false;
                const maxBlur = layoutSmoothBlur.blur || 64;
                const heightPct = (layoutSmoothBlur.height || 50) / 100;
                const dir = layoutSmoothBlur.direction || 'down';

                let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
                if (dir === 'up') { y0 = h; y1 = 0; }
                else if (dir === 'down') { y0 = 0; y1 = h; }
                else if (dir === 'left') { x0 = w; x1 = 0; }
                else if (dir === 'right') { x0 = 0; x1 = w; }

                const baseEase = easings[preset] || easings.linear;
                const ease = (t) => {
                    if (preset === 'linear') return reverse ? 1 - t : t;
                    let val = 0;
                    if (type === 'in') val = baseEase(t);
                    else if (type === 'out') val = 1 - baseEase(1 - t);
                    else if (type === 'inOut') val = t < 0.5 ? baseEase(t * 2) / 2 : 1 - baseEase((1 - t) * 2) / 2;
                    return reverse ? 1 - val : val;
                };

                const step = 1 / P;

                for (let i = 0; i < P; i++) {
                    const progress = i / (P - 1);
                    const easedProgress = Math.max(0, Math.min(1, ease(progress)));
                    const currentBlur = easedProgress * maxBlur;

                    if (currentBlur <= 0) continue; // Layer 0 is already just targetCanvas as is!

                    // Create sub-layer
                    const layerCanvas = document.createElement('canvas');
                    layerCanvas.width = w; layerCanvas.height = h;
                    const lCtx = layerCanvas.getContext('2d');

                    // Apply blur to base
                    lCtx.filter = `blur(${currentBlur}px)`;
                    lCtx.drawImage(baseCanvas, 0, 0);
                    lCtx.filter = 'none';

                    // Compute Stops
                    const maskScale = heightPct;
                    let p1 = Math.max(0, (i * step - 2 * step)) * maskScale;
                    let p2 = Math.max(0, (i * step)) * maskScale;
                    let p3 = Math.min(1, (i * step + step)) * maskScale;
                    let p4 = Math.min(1, (i * step + 3 * step)) * maskScale;

                    if (i === P - 1) {
                        p3 = heightPct;
                        p4 = 1;
                    }

                    // Strict sequential enforcement for canvas gradients to avoid DOMException
                    const s1 = Math.max(0, Math.min(1, p1));
                    const s2 = Math.max(s1, Math.min(1, p2));
                    const s3 = Math.max(s2, Math.min(1, p3));
                    const s4 = Math.max(s3, Math.min(1, p4));

                    // Apply mask
                    lCtx.globalCompositeOperation = 'destination-in';
                    const grad = lCtx.createLinearGradient(x0, y0, x1, y1);
                    grad.addColorStop(s1, 'rgba(0,0,0,0)');

                    if (s2 > s1) grad.addColorStop(s2, 'rgba(0,0,0,1)');
                    else grad.addColorStop(Math.min(1, s1 + 0.00001), 'rgba(0,0,0,1)');

                    if (s3 > s2) grad.addColorStop(s3, 'rgba(0,0,0,1)');
                    else grad.addColorStop(Math.min(1, Math.max(s2, s1) + 0.00002), 'rgba(0,0,0,1)');

                    if (s4 > s3) grad.addColorStop(s4, 'rgba(0,0,0,0)');
                    else grad.addColorStop(Math.min(1, Math.max(s3, s2) + 0.00003), 'rgba(0,0,0,0)');

                    lCtx.fillStyle = grad;
                    lCtx.fillRect(0, 0, w, h);

                    // Draw back on top of layout
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(layerCanvas, 0, 0);
                }
            }

            // 4. Slot selection
            if (isPreview && selectedSlotIndex !== null) {
                renderSlotSelection(ctx, { selectedSlotIndex, slotRects: slotRectsArray, canvasWidth: w });
            }

            // 5. Assets
            renderAssets(ctx, w, h, { assets });

            // Asset selection
            if (isPreview && activeAssetId) {
                renderAssetSelection(ctx, w, h, { assets, activeAssetId });
            }

            // 6. Texts
            renderTexts(ctx, w, h, { texts });

            // Text selection
            if (isPreview && activeTextId) {
                renderTextSelection(ctx, w, h, { texts, activeTextId });
            }

            // 7. Guides
            if (isPreview && isDraggingText && activeGuides.length > 0) {
                renderGuides(ctx, h, { activeGuides });
            }

            // Sync slotRects ref
            slotRects.current = slotRectsArray;
            /* Seul l'apercu est publie a React: le canvas d'export a d'autres
               dimensions, et l'interface pose ses reperes sur l'apercu. */
            if (setSlotRectsState && isPreview) {
                setSlotRectsState({ rects: slotRectsArray, width: w, height: h });
            }

        } else {
            // Studio
            slotRects.current = [];
            if (setSlotRectsState) {
                setSlotRectsState({ rects: [], width: 0, height: 0 });
            }
            renderStudio(ctx, targetCanvas, w, h, isPreview, quality, {
                images, cropRatio, cropPos, cropScale, isCropping,
                filters: overrides.filters || filters, view,
                /* La loupe de l'apercu. `renderStudio` l'ignore hors apercu, donc
                   un export ne peut pas la recevoir par accident. */
                viewport: overrides.viewport || viewport,
            });
        }
    }, [images, filters, view, activeFormat, activeTemplate, overlayMode, padding, gap, customLayoutGap, radius,
        layoutBgColor, layoutBgBlur, layoutBgGradient, layoutBgMeshColors, layoutLumenBackground, layoutBgTexture, layoutSmoothBlur, layoutTextures, activeTextureId, layoutTextureOpacity, selectedSlotIndex, slotConfigs,
        texts, activeTextId, isDraggingText, activeGuides, assets, activeAssetId,
        cropRatio, cropPos, cropScale, isCropping, bgCanvasRef, setSlotRectsState, slotRects, viewport]);

    const renderCanvas = useCallback(() => {
        const canRenderEmpty = view === 'layout' && (
            activeTemplate.id === 'custom' ||
            layoutBgGradient ||
            Boolean(layoutLumenBackground?.image) ||
            (layoutTextures && layoutTextures.length > 0) ||
            (texts && texts.length > 0) ||
            (assets && assets.length > 0)
        );
        if ((!images.length && !canRenderEmpty) || !canvasRef.current) {
            slotRects.current = [];
            if (setSlotRectsState) {
                setSlotRectsState({ rects: [], width: 0, height: 0 });
            }
            return;
        }
        const canvas = canvasRef.current;
        let { width, height } = getPreviewCanvasDimensions();
        if (width === 0 || height === 0) {
            slotRects.current = [];
            if (setSlotRectsState) {
                setSlotRectsState({ rects: [], width: 0, height: 0 });
            }
            return;
        }

        /*
         * Geste en cours: on calcule moins de pixels, mais on FIGE d'abord la
         * taille affichee. Le canvas etant dimensionne par sa resolution
         * interne (`width: auto` cote CSS), baisser celle-ci ferait retrecir
         * l'apercu a l'ecran a chaque prise en main d'un curseur.
         */
        const interacting = isDragging || isDraggingText;
        const adaptive = view === 'vision-pro' || view === 'studio';
        if (interacting && adaptive) {
            if (!canvas.style.width && canvas.clientWidth > 0) {
                canvas.style.width = `${canvas.clientWidth}px`;
                canvas.style.height = `${canvas.clientHeight}px`;
            }
            width = Math.max(1, Math.round(width * INTERACTIVE_SCALE));
            height = Math.max(1, Math.round(height * INTERACTIVE_SCALE));
        } else if (canvas.style.width) {
            canvas.style.width = '';
            canvas.style.height = '';
        }

        /* Reaffecter `width` reinitialise tout le canvas: on ne le fait que si
           la taille a reellement change, sinon c'est une realloc par frame. */
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;

        /*
         * QUALITE PENDANT LE GESTE, et ce choix a ete corrige apres coup.
         *
         * La qualite 'low' saute les operations qui lisent les pixels voisins:
         * relief, nettete, voile et grain. Dans Layout, ou l'on fait glisser une
         * image ou un texte, c'est le bon compromis — ces effets ne sont pas
         * l'objet du geste.
         *
         * Dans Vision, c'est l'INVERSE: le geste porte precisement sur ces
         * reglages. Passer en 'low' rendait « Relief » et « Grain » sans effet
         * visible tant qu'on tenait le curseur, alors que « Vignettage », qui
         * n'a pas de garde de qualite, reagissait — d'ou l'impression que deux
         * curseurs sur trois ne faisaient rien. On garde donc 'high' ici, et la
         * fluidite vient de la resolution divisee par deux (quatre fois moins de
         * pixels), pas du saut d'etapes.
         */
        const quality = interacting && view !== 'vision-pro' ? 'low' : 'high';
        renderPipeline(canvas, width, height, true, quality);
    }, [activeTemplate, images, getPreviewCanvasDimensions, renderPipeline, isDragging, isDraggingText, view, setSlotRectsState, slotRects, canvasRef, assets, layoutBgGradient, layoutLumenBackground?.image, layoutTextures, texts]);

    // Animation loop
    useEffect(() => {
        requestRef.current = requestAnimationFrame(renderCanvas);
        return () => cancelAnimationFrame(requestRef.current);
    }, [renderCanvas, requestRef]);

    return { getCanvasDimensions, getPreviewCanvasDimensions, renderPipeline, renderCanvas };
}
