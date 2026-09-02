"use client";

/*
 * Persistance de la composition Layout dans le projet VibeOS (plan §4.3 et §7).
 *
 * Regle du plan: on stocke des **Blobs**, jamais des dataURLs - IndexedDB les
 * accepte nativement et une photo de telephone en base64 pese ~33% de plus.
 * Ce module ne fait que traduire dans les deux sens:
 *   etat de l'editeur  <->  enregistrement du projet
 * Aucun moteur de rendu n'est touche ici.
 */

import { DEFAULT_CUSTOM_TEMPLATE, FORMATS, TEMPLATES } from '../../vibefx-studio/data/constants';
import { applyVisionStage, canvasToImage, visionRevision } from '../project/pipeline';

let idCounter = 0;
const nextId = (prefix) => {
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
};

/* Un Blob a partir de n'importe quelle source d'image deja chargee
   (objectURL, dataURL, fichier distant). Cache par src: une image importee
   n'est relue qu'une fois, meme si la sauvegarde se declenche cent fois. */
export async function srcToBlob(src, cache) {
    if (!src) return null;
    if (cache?.has(src)) return cache.get(src);
    try {
        const response = await fetch(src);
        const blob = await response.blob();
        cache?.set(src, blob);
        return blob;
    } catch {
        return null;
    }
}

function loadImageFromBlob(blob, name) {
    return new Promise((resolve) => {
        if (!blob) {
            resolve(null);
            return;
        }
        const url = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onload = () => {
            img.name = name || '';
            resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

/* Identifiant stable porte par l'element Image lui-meme (comme `isSlotSpecific`
   et `slotId` que pose deja l'ancien moteur d'import). */
function ensureImageId(img) {
    if (!img) return null;
    if (!img.vibeosId) img.vibeosId = nextId('img');
    return img.vibeosId;
}

export function hasStoredComposition(project) {
    if (!project) return false;
    return Boolean(
        (project.images && project.images.length)
        || (project.texts && project.texts.length)
        || (project.assets && project.assets.length)
        || (project.background?.textures && project.background.textures.length)
        || project.background?.lumen
        || (typeof project.template === 'object' && project.template?.zones?.length),
    );
}

/*
 * Etat de l'editeur -> enregistrement projet. Asynchrone: la conversion des
 * images en Blobs passe par fetch().
 */
export async function snapshotComposition(state, cache) {
    const {
        activeFormat, activeTemplate, overlayMode,
        images, slotConfigs, texts, assets,
        padding, gap, radius, customLayoutGap,
        layoutBgColor, layoutBgBlur, layoutBgTexture,
        layoutBgGradient, layoutBgMeshColors,
        layoutTextures, activeTextureId, layoutTextureOpacity,
        layoutLumenBackground, layoutSmoothBlur,
    } = state;

    /* Images du projet + celles qui ne vivraient que dans une zone. */
    const orderedImages = [...images];
    Object.values(slotConfigs || {}).forEach((config) => {
        if (config?.image && !orderedImages.includes(config.image)) orderedImages.push(config.image);
    });

    const serializedImages = [];
    for (const img of orderedImages) {
        const id = ensureImageId(img);
        /* Une image affichee dans Layout peut etre le rendu Vision. On persiste
           toujours son original, sinon chaque sauvegarde cuirait le preset une
           fois de plus et rendrait tout retour en arriere impossible. */
        const blob = img.vibeosSourceBlob || await srcToBlob(img.src, cache);
        if (!blob) continue;
        serializedImages.push({
            id,
            name: img.name || '',
            slotId: img.isSlotSpecific ? img.slotId : null,
            blob,
        });
    }

    const slots = {};
    Object.entries(slotConfigs || {}).forEach(([slotId, config]) => {
        if (!config) return;
        slots[slotId] = {
            imageId: config.image?.vibeosId || null,
            /* Case videe a la main: sans ce drapeau, la reprise la remplirait a
               nouveau avec l'image "naturelle" de sa position. */
            imageCleared: 'image' in config && !config.image,
            imageName: config.imageName || null,
            zoom: config.zoom ?? 1,
            x: config.x ?? 0,
            y: config.y ?? 0,
            border: config.border ?? 0,
            blur: config.blur ?? 0,
            bgColor: config.bgColor || null,
        };
    });

    const textures = [];
    for (const texture of layoutTextures || []) {
        const blob = await srcToBlob(texture.src, cache);
        if (!blob) continue;
        textures.push({ id: texture.id, name: texture.name || '', blob });
    }

    let lumen = null;
    if (layoutLumenBackground?.src) {
        const blob = await srcToBlob(layoutLumenBackground.src, cache);
        if (blob) {
            lumen = {
                id: layoutLumenBackground.id,
                name: layoutLumenBackground.name || '',
                mode: layoutLumenBackground.mode || null,
                styleName: layoutLumenBackground.styleName || null,
                seed: layoutLumenBackground.seed ?? null,
                designCode: layoutLumenBackground.designCode ?? null,
                blob,
            };
        }
    }

    return {
        format: activeFormat.id,
        template: activeTemplate.id === 'custom'
            ? {
                id: 'custom',
                label: activeTemplate.label,
                presetId: activeTemplate.customLayout?.presetId || 'manual',
                /* Miroirs / rotation des photos et retouches manuelles: sans
                   eux la grille se recompile a plat a la reouverture. */
                transform: activeTemplate.customLayout?.transform || null,
                dirty: Boolean(activeTemplate.customLayout?.dirty),
                zones: activeTemplate.customLayout?.zones || [],
            }
            : activeTemplate.id,
        overlayMode,
        images: serializedImages,
        slots,
        texts: (texts || []).map((text) => ({ ...text })),
        assets: (assets || []).map((asset) => ({ ...asset })),
        geometry: { padding, gap, radius, customLayoutGap, linkedMargins: state.linkedMargins !== false },
        background: {
            color: layoutBgColor,
            blur: layoutBgBlur,
            grain: layoutBgTexture,
            textures,
            activeTextureId,
            textureOpacity: layoutTextureOpacity,
            mesh: { enabled: Boolean(layoutBgGradient), colors: [...(layoutBgMeshColors || [])] },
            lumen,
            smoothBlur: layoutSmoothBlur ? { ...layoutSmoothBlur } : null,
        },
    };
}

/*
 * Enregistrement projet -> etat de l'editeur. Les Blobs redeviennent des
 * elements Image (objectURL), exactement ce que consomment les moteurs.
 */
export async function restoreComposition(project, { applyVision = false } = {}) {
    if (!project) return null;

    const imagesById = new Map();
    const images = [];
    for (const record of project.images || []) {
        const original = await loadImageFromBlob(record.blob, record.name);
        if (!original) continue;
        let img = original;
        if (applyVision) {
            const visionCanvas = applyVisionStage(original, project);
            const treated = visionCanvas ? await canvasToImage(visionCanvas, record.name) : null;
            if (treated) {
                treated.vibeosOriginalSrc = original.src;
                img = treated;
            }
        }
        /* Le rendu courant peut changer; le Blob source ne change jamais. */
        img.vibeosSourceBlob = record.blob;
        img.vibeosVisionRevision = visionRevision(project.vision);
        img.vibeosId = record.id;
        if (record.slotId !== null && record.slotId !== undefined) {
            img.isSlotSpecific = true;
            img.slotId = record.slotId;
        }
        imagesById.set(record.id, img);
        images.push(img);
    }

    const slotConfigs = {};
    Object.entries(project.slots || {}).forEach(([slotId, stored]) => {
        const img = stored.imageId ? imagesById.get(stored.imageId) : null;
        slotConfigs[slotId] = {
            zoom: stored.zoom ?? 1,
            x: stored.x ?? 0,
            y: stored.y ?? 0,
            border: stored.border ?? 0,
            blur: stored.blur ?? 0,
            ...(stored.bgColor ? { bgColor: stored.bgColor } : {}),
            ...(img ? { image: img, imageSrc: img.src, imageName: stored.imageName || img.name } : {}),
            ...(!img && stored.imageCleared ? { image: null, imageSrc: null } : {}),
        };
    });

    const textures = [];
    for (const record of project.background?.textures || []) {
        const img = await loadImageFromBlob(record.blob, record.name);
        if (!img) continue;
        textures.push({ id: record.id, name: record.name, image: img, src: img.src });
    }

    let lumen = null;
    const storedLumen = project.background?.lumen;
    if (storedLumen?.blob) {
        const img = await loadImageFromBlob(storedLumen.blob, storedLumen.name);
        if (img) {
            lumen = {
                id: storedLumen.id || nextId('lumen'),
                src: img.src,
                name: storedLumen.name || 'Lumen shader',
                image: img,
                width: img.width,
                height: img.height,
                aspect: img.width / Math.max(1, img.height),
                mode: storedLumen.mode,
                styleName: storedLumen.styleName,
                seed: storedLumen.seed,
                designCode: storedLumen.designCode,
            };
        }
    }

    const format = FORMATS.find((item) => item.id === project.format) || null;

    let template = null;
    if (typeof project.template === 'object' && project.template?.id === 'custom') {
        const zones = project.template.zones || [];
        template = {
            ...DEFAULT_CUSTOM_TEMPLATE,
            label: project.template.label || DEFAULT_CUSTOM_TEMPLATE.label,
            slots: zones.length,
            customLayout: {
                version: 1,
                presetId: project.template.presetId || 'manual',
                transform: project.template.transform || null,
                dirty: Boolean(project.template.dirty),
                zones,
            },
        };
    } else if (typeof project.template === 'string') {
        template = TEMPLATES.find((item) => item.id === project.template) || null;
    }

    return {
        format,
        template,
        overlayMode: project.overlayMode || 'landscape',
        images,
        slotConfigs,
        texts: project.texts || [],
        assets: project.assets || [],
        geometry: project.geometry || null,
        background: {
            color: project.background?.color,
            blur: project.background?.blur,
            grain: project.background?.grain,
            textures,
            activeTextureId: project.background?.activeTextureId ?? textures[0]?.id ?? null,
            textureOpacity: project.background?.textureOpacity,
            meshEnabled: Boolean(project.background?.mesh?.enabled),
            meshColors: project.background?.mesh?.colors || null,
            lumen,
            smoothBlur: project.background?.smoothBlur || null,
        },
    };
}

export { nextId as createLayoutId };
