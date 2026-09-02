"use client";

/*
 * Le pipeline de rendu VibeOS (plan §4.3), formalise a la phase F.
 *
 * ORDRE FIXE, une seule source de verite pour tout le produit :
 *
 *      photo  ->  filtres Vision  ->  composition Layout  ->  effets Studio  ->  export
 *
 * - Vision garde la photo brute comme source et ne cuit jamais ses reglages
 *   dans le Blob utilisateur.
 * - La **composition** est produite par l'ecran Layout avec les pixels Vision
 *   (moteurs
 *   `vibefx-studio/engine/layoutRenderer` via `useCanvasRenderer`), puis publiee
 *   dans le projet commun sous forme de Blob PNG pleine resolution
 *   (`project.composition`). Studio la recoit sans reposer Vision une seconde
 *   fois. Les anciennes compositions sans marqueur gardent l'ancien chainage.
 * - Les etages **Vision** et **Studio** appliquent leurs filtres avec le moteur
 *   existant `renderStudio` - exactement celui qu'utilisent les deux ecrans a
 *   l'aperçu. Aucun rendu n'est reecrit ici : ce module ne fait qu'enchainer.
 * - L'**export** (telechargement, publication) part du dernier etage.
 *
 * Un etage dont les filtres valent les valeurs par defaut, ou dont l'intensite
 * est nulle, est saute : la source traverse le pipeline sans etre recopiee, donc
 * sans perte.
 */

import { renderStudio } from '../../vibefx-studio/engine/studioRenderer';
import { DEFAULT_FILTERS } from '../../vibefx-studio/hooks/useStudioFilters';

export const PIPELINE_STAGES = ['composition', 'vision', 'studio', 'export'];

/* Cles qui ne decrivent pas un effet: elles pilotent le pipeline, pas le rendu. */
const NON_VISUAL_FILTER_KEYS = new Set(['safeSmartphone', 'filterIntensity']);

export function loadImageFromBlob(blob, name) {
    return new Promise((resolve) => {
        if (!blob) {
            resolve(null);
            return;
        }
        const img = new window.Image();
        img.onload = () => {
            img.name = name || '';
            resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(blob);
    });
}

export function canvasToBlob(canvas, mimeType = 'image/png', quality = 0.92) {
    return new Promise((resolve) => {
        if (!canvas || typeof canvas.toBlob !== 'function') {
            resolve(null);
            return;
        }
        canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });
}

/* Un canvas redevient un element Image (c'est ce que consomment les moteurs, et
   ce dont l'UI a besoin pour l'affichage « avant/apres »). PNG: aucune perte
   entre deux etages du pipeline. */
export async function canvasToImage(canvas, name = '') {
    const blob = await canvasToBlob(canvas, 'image/png');
    return loadImageFromBlob(blob, name);
}

/* Un etage sert-il a quelque chose ? Sinon on ne recopie pas l'image. */
export function isNeutralFilterSet(filters, intensity = 100) {
    if (!filters) return true;
    if (Number(intensity) <= 0) return true;
    return Object.entries(filters).every(([key, value]) => {
        if (NON_VISUAL_FILTER_KEYS.has(key)) return true;
        /* Cle hors du jeu par defaut (ex. `halation`, ajoute par le Studio):
           elle ne compte comme neutre que si elle vaut zero. */
        if (!(key in DEFAULT_FILTERS)) return !value;
        return value === DEFAULT_FILTERS[key];
    });
}

/*
 * Un etage du pipeline: la source + un jeu de filtres -> un canvas.
 * On passe par `renderStudio`, le moteur des ecrans Vision et Studio, avec les
 * memes options qu'eux (pas de recadrage, qualite haute, hors apercu).
 */
export function renderFilterStage(sourceImage, filters, options = {}) {
    const { intensity = 100, safeSmartphone = true } = options;
    if (!sourceImage || typeof document === 'undefined') return null;
    const width = sourceImage.naturalWidth || sourceImage.width;
    const height = sourceImage.naturalHeight || sourceImage.height;
    if (!width || !height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    renderStudio(ctx, canvas, width, height, false, 'high', {
        images: [sourceImage],
        cropRatio: 'original',
        cropPos: { x: 0, y: 0 },
        cropScale: 1,
        isCropping: false,
        filters: {
            ...DEFAULT_FILTERS,
            ...filters,
            safeSmartphone,
            filterIntensity: intensity,
        },
    });
    return canvas;
}

/*
 * L'entree du pipeline pour Vision et Studio : la composition si le Layout en a
 * publie une, sinon la photo du projet. `kind` sert a l'ecran pour le dire
 * honnetement a l'utilisateur.
 */
export async function resolveProjectSource(project) {
    if (!project) return { image: null, kind: null };

    const composition = project.composition;
    if (composition?.blob) {
        const image = await loadImageFromBlob(composition.blob, 'composition');
        if (image) return { image, kind: 'composition' };
    }

    const record = (project.images || [])[0];
    if (record?.blob) {
        const image = await loadImageFromBlob(record.blob, record.name);
        if (image) return { image, kind: 'photo' };
    }

    return { image: null, kind: null };
}

/* Vision est maintenant un reglage de PHOTO: cet acces ignore volontairement
   la composition Layout. Il permet de revenir dans Vision sans retraiter le
   texte, les stickers et les marges deja composes. */
export async function resolveProjectPhotoSource(project) {
    const record = (project?.images || [])[0];
    if (!record?.blob) return { image: null, kind: null };
    const image = await loadImageFromBlob(record.blob, record.name);
    return { image, kind: image ? 'photo' : null };
}

/* Identite du rendu Vision. Les projets anciens n'ont pas `updatedAt` : leur
   signature reste tout de meme deterministe a partir des reglages stockes. */
export function visionRevision(vision = {}) {
    if (vision.updatedAt) return `vision-${vision.updatedAt}`;
    return JSON.stringify({
        presetId: vision.presetId || null,
        intensity: typeof vision.intensity === 'number' ? vision.intensity : 80,
        filters: vision.filters || null,
    });
}

export function compositionIncludesCurrentVision(project) {
    return Boolean(
        project?.composition?.visionRevision
        && project.composition.visionRevision === visionRevision(project.vision),
    );
}

export function shouldApplyVisionToSource(project, sourceKind) {
    return sourceKind !== 'composition' || !compositionIncludesCurrentVision(project);
}

/* Etage Vision applique a une source deja resolue. Rend `null` si l'etage est
   neutre: l'appelant garde alors sa source telle quelle. */
export function applyVisionStage(sourceImage, project) {
    const vision = project?.vision || {};
    const intensity = typeof vision.intensity === 'number' ? vision.intensity : 80;
    /*
     * Un preset est une LUT posee en amont des reglages manuels: il ne modifie
     * AUCUNE cle de `filters`. Le jeu de filtres peut donc etre parfaitement
     * neutre alors que le look, lui, est bien la — d'ou ce test separe. Sans
     * lui, l'etage Vision etait purement et simplement saute, et le preset ne
     * descendait ni jusqu'au Studio ni jusqu'a l'export.
     */
    const hasPreset = Boolean(vision.presetId);
    if (Number(intensity) <= 0) return null;
    if (!hasPreset && isNeutralFilterSet(vision.filters, intensity)) return null;
    return renderFilterStage(sourceImage, {
        ...vision.filters,
        presetId: vision.presetId,
    }, {
        intensity,
        safeSmartphone: vision.filters?.safeSmartphone !== false,
    });
}

/* Etage Studio, meme contrat. Le mode creatif du Studio est ce qui debraye les
   garde-fous smartphone: on le respecte ici aussi. */
export function applyStudioStage(sourceImage, project) {
    const studio = project?.studio || {};
    const intensity = typeof studio.intensity === 'number' ? studio.intensity : 80;
    if (isNeutralFilterSet(studio.filters, intensity)) return null;
    return renderFilterStage(sourceImage, studio.filters, {
        intensity,
        safeSmartphone: studio.creativeMode !== true,
    });
}

/*
 * Le rendu final du projet : composition deja traitee -> Studio. Pour un ancien
 * projet ou une photo sans composition, Vision est encore applique ici.
 * C'est ce que telecharge « Exporter » depuis l'accueil et ce que publie le
 * bouton « Publier » du bandeau.
 */
export async function renderProjectFinalCanvas(project) {
    const { image, kind } = await resolveProjectSource(project);
    if (!image) return null;

    const stages = [kind === 'composition' ? 'composition' : 'photo'];

    let current = image;
    const visionCanvas = shouldApplyVisionToSource(project, kind)
        ? applyVisionStage(current, project)
        : null;
    if (visionCanvas) {
        current = visionCanvas;
        stages.push('vision');
    }
    const studioCanvas = applyStudioStage(current, project);
    if (studioCanvas) {
        current = studioCanvas;
        stages.push('studio');
    }

    /* La source peut encore etre un element Image (aucun etage actif): on la
       normalise en canvas pour que l'appelant ait toujours la meme chose. */
    let canvas = current;
    if (!(typeof HTMLCanvasElement !== 'undefined' && current instanceof HTMLCanvasElement)) {
        canvas = document.createElement('canvas');
        canvas.width = current.naturalWidth || current.width;
        canvas.height = current.naturalHeight || current.height;
        canvas.getContext('2d').drawImage(current, 0, 0);
    }

    return { canvas, width: canvas.width, height: canvas.height, stages, sourceKind: kind };
}
