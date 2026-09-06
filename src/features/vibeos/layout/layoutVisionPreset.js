"use client";

import { renderStudio } from '../../vibefx-studio/engine/studioRenderer';
import { visionFiltersAreIdentity } from '../../vibefx-studio/utils/visionColorScience';

/*
 * Un preset commun a toutes les photos d'un modele.
 *
 * Le modele ne bouge pas: textes, cadres, marges et stickers sont composes
 * PAR-DESSUS les photos, et ne doivent rien recevoir. C'est exactement la
 * raison pour laquelle Vision ignore la composition aplatie
 * (`resolveProjectPhotoSource`): un preset pose sur le montage teinterait le
 * texte. On applique donc le preset aux PHOTOS SOURCES, une par une, et le
 * modele se redessine par-dessus comme d'habitude.
 *
 * Le moteur de mise en page dessine ce qu'on lui donne: `ctx.drawImage` accepte
 * un canvas aussi bien qu'une image. On lui passe donc, a la place de chaque
 * photo, un canvas ou le preset est deja cuit. Rien a changer dans le moteur.
 *
 * Une seule passe sert l'apercu ET l'export: les deux traversent le meme
 * `renderPipeline`, et le visuel final fait 1080 px de large. Filtrer a 2048 px
 * de grand cote couvre donc largement les deux, au lieu de faire passer quatre
 * photos de 24 millions de pixels dans le pipeline couleur a chaque rendu.
 */

const MAX_SIDE = 2048;

/* Une image filtree n'est refabriquee que si la photo ou le reglage change. */
const cache = new Map();
const CACHE_MAX = 24;

/*
 * Signature du reglage Vision. Vide = rien a appliquer, et c'est le cas normal:
 * sans preset ni curseur sorti du repos, le modele doit montrer les photos
 * telles quelles.
 */
export function visionSignature(vision) {
    if (!vision) return '';
    const filters = vision.filters || {};
    if (!vision.presetId && visionFiltersAreIdentity(filters)) return '';
    return JSON.stringify({
        p: vision.presetId || null,
        i: vision.intensity ?? 100,
        f: filters,
    });
}

function cle(img, signature) {
    /* `currentSrc` distingue deux photos differentes; la taille ecarte le cas
       ou deux entrees partagent une meme adresse d'objet. */
    return `${img.currentSrc || img.src || ''}|${img.naturalWidth || img.width}x${img.naturalHeight || img.height}|${signature}`;
}

function filtrer(img, vision, signature) {
    const source = { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
    if (!source.w || !source.h) return img;

    const echelle = Math.min(1, MAX_SIDE / Math.max(source.w, source.h));
    const w = Math.max(1, Math.round(source.w * echelle));
    const h = Math.max(1, Math.round(source.h * echelle));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img;

    renderStudio(ctx, canvas, w, h, false, 'high', {
        images: [img],
        cropRatio: 'original',
        cropPos: { x: 0, y: 0 },
        cropScale: 1,
        isCropping: false,
        filters: {
            ...(vision.filters || {}),
            presetId: vision.presetId || null,
            safeSmartphone: vision.filters?.safeSmartphone !== false,
            filterIntensity: vision.intensity ?? 100,
        },
    });
    return canvas;
}

/*
 * Rend une copie filtree d'une photo, ou la photo elle-meme si le reglage est
 * au repos. Les proprietes que le moteur de mise en page lit sur l'image
 * (`isSlotSpecific`, `slotId`) sont reportees: sans elles, une photo attachee a
 * une case precise se retrouverait dessinee n'importe ou.
 */
export function withVisionPreset(img, vision, signature) {
    if (!img || !signature) return img;
    const k = cle(img, signature);
    let sortie = cache.get(k);
    if (!sortie) {
        sortie = filtrer(img, vision, signature);
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(k, sortie);
    }
    if (sortie !== img) {
        sortie.isSlotSpecific = img.isSlotSpecific;
        sortie.slotId = img.slotId;
        sortie.name = img.name;
    }
    return sortie;
}

/* Les cases peuvent porter leur propre photo (`cfg.image`): elle doit recevoir
   le meme traitement, sinon une case echangee resterait sans preset. */
export function slotConfigsWithVisionPreset(slotConfigs, vision, signature) {
    if (!signature || !slotConfigs) return slotConfigs;
    let change = false;
    const sortie = {};
    Object.entries(slotConfigs).forEach(([id, cfg]) => {
        if (!cfg || !('image' in cfg) || !cfg.image) { sortie[id] = cfg; return; }
        const filtree = withVisionPreset(cfg.image, vision, signature);
        if (filtree === cfg.image) { sortie[id] = cfg; return; }
        change = true;
        sortie[id] = { ...cfg, image: filtree };
    });
    return change ? sortie : slotConfigs;
}
