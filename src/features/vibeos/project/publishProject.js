"use client";

/*
 * Derniere etape du pipeline (plan §4.3): le projet VibeOS -> la charge utile de
 * publication.
 *
 * On rend le projet complet (composition -> Vision -> Studio) puis on
 * reconstitue EXACTEMENT la charge utile que l'ancien studio envoyait a
 * `PublicationsManager` (`normalizeVibeFxDraft` la lit sans modification).
 * Le decoupage panorama passe par `buildSocialImages`, le module partage
 * extrait de `VibeFxStudio.jsx`.
 */

import { FORMATS, TEMPLATES } from '../../vibefx-studio/data/constants';
import { buildSocialImages, canvasToBlob } from '../../vibefx-studio/utils/socialExport';
import { renderProjectFinalCanvas } from './pipeline';

function resolveFormat(project) {
    return FORMATS.find((format) => format.id === project?.format) || FORMATS[0];
}

function resolveTemplate(project) {
    const template = project?.template;
    if (typeof template === 'object' && template) {
        return { id: template.id || 'custom', label: template.label || 'Personnalisé' };
    }
    const found = TEMPLATES.find((item) => item.id === template);
    return found ? { id: found.id, label: found.label } : { id: 'minimal', label: 'Standard' };
}

function slugifyTitle(title) {
    const slug = String(title || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'vibefx-export';
}

export async function buildPublicationPayload(project, { caption = '' } = {}) {
    const rendered = await renderProjectFinalCanvas(project);
    if (!rendered) return null;

    const { canvas, width, height, stages } = rendered;
    const format = resolveFormat(project);
    const template = resolveTemplate(project);
    const socialImages = await buildSocialImages(canvas, format);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.95);
    const background = project.background || {};
    const geometry = project.geometry || {};

    return {
        source: 'vibeos',
        /* Trace du chemin reellement parcouru: utile en support et dans les
           smokes ("la publication vient bien de la composition + Vision"). */
        pipeline: stages,
        name: slugifyTitle(project.title),
        mimeType: 'image/jpeg',
        width,
        height,
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        blob,
        socialImages,
        caption,
        format,
        template,
        imagesCount: (project.images || []).length,
        settings: {
            view: 'layout',
            overlayMode: project.overlayMode || 'landscape',
            padding: geometry.padding,
            gap: geometry.gap,
            customLayoutGap: geometry.customLayoutGap,
            radius: geometry.radius,
            layoutBgColor: background.color,
            layoutBgBlur: background.blur,
            layoutBgTexture: background.grain,
            layoutBgGradient: Boolean(background.mesh?.enabled),
            layoutBgMeshColors: background.mesh?.colors || [],
            layoutSmoothBlur: background.smoothBlur,
            texts: project.texts || [],
            assets: project.assets || [],
            slotConfigs: project.slots || {},
            vision: project.vision || null,
            studio: project.studio
                ? { presetRef: project.studio.presetRef, intensity: project.studio.intensity }
                : null,
        },
        createdAt: new Date().toISOString(),
    };
}
