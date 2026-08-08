"use client";

/*
 * Les 12 looks du premier niveau de Vision (plan §5.3).
 *
 * Aucun rendu n'est invente ici: chaque look POINTE vers un profil existant de
 * `CAMERA_BRANDS`, resolu par `buildVisionProfileModel` (la science des
 * couleurs, les garde-fous et l'intensite recommandee viennent de la).
 * Ce fichier ne fait que deux choses:
 *   - choisir 12 profils bien repartis par famille (2 Naturel, 2 Peau,
 *     2 Paysage, 2 Nuit, 1 Rue, 1 N&B, 1 Editorial, 1 Cinema) ;
 *   - leur donner un nom francais evocateur, pour ne pas afficher des noms de
 *     pellicules a quelqu'un qui veut juste une belle photo.
 * La bibliotheque complete par marque reste accessible en reglages avances.
 */

import { CAMERA_BRANDS } from '../../vibefx-studio/data/constants';
import { buildVisionProfileModel } from '../../vibefx-studio/utils/visionColorScience';

const LOOK_DEFINITIONS = [
    { id: 'lumiere-juste', label: 'Lumière juste', hint: 'Propre et fidèle', brandId: 'hasselblad', profileName: 'HNCS Natural' },
    { id: 'net-neutre', label: 'Net et neutre', hint: 'Sans effet visible', brandId: 'fujifilm', profileName: 'Provia' },
    { id: 'peau-douce', label: 'Peau douce', hint: 'Portraits, selfies', brandId: 'fujifilm', profileName: 'Astia' },
    { id: 'portrait-chaleureux', label: 'Portrait chaleureux', hint: 'Teint doré', brandId: 'kodak', profileName: 'Portra 400' },
    { id: 'nature-vive', label: 'Nature vive', hint: 'Verts et reliefs', brandId: 'hasselblad', profileName: 'HNCS Landscape' },
    { id: 'ciel-profond', label: 'Ciel profond', hint: 'Paysages éclatants', brandId: 'fujifilm', profileName: 'Velvia' },
    { id: 'nuit-neon', label: 'Nuit néon', hint: 'Ville la nuit', brandId: 'cinestill', profileName: '800T Tungsten' },
    { id: 'bleu-de-nuit', label: 'Bleu de nuit', hint: 'Ambiance froide', brandId: 'leica', profileName: 'Teal (TEL)' },
    { id: 'rue-documentaire', label: 'Rue documentaire', hint: 'Street, voyage', brandId: 'fujifilm', profileName: 'Classic Chrome' },
    { id: 'noir-et-blanc', label: 'Noir et blanc fin', hint: 'Grain serré', brandId: 'fujifilm', profileName: 'Acros' },
    { id: 'souvenir-dore', label: 'Souvenir doré', hint: 'Vintage doux', brandId: 'fujifilm', profileName: 'Nostalgic Neg.' },
    { id: 'cinema-doux', label: 'Cinéma doux', hint: 'Ombres riches', brandId: 'fujifilm', profileName: 'Eterna' },
];

function resolveProfile(brandId, profileName) {
    const brand = CAMERA_BRANDS.find((item) => item.id === brandId);
    const profile = brand?.profiles?.find((item) => item.name === profileName);
    if (!brand || !profile) return null;
    return { brand, profile };
}

/* Les 12 looks, resolus une fois pour toutes au chargement du module. */
export const VISION_LOOKS = LOOK_DEFINITIONS.map((definition) => {
    const resolved = resolveProfile(definition.brandId, definition.profileName);
    if (!resolved) return null;
    const model = buildVisionProfileModel(resolved.profile, resolved.brand);
    return {
        ...definition,
        brandName: resolved.brand.name,
        sourceName: resolved.profile.name,
        /* `vision`: la forme attendue par scoreProfileForImage et par le rendu
           des vignettes (identique a celle de l'ancien panneau). */
        vision: model,
        filters: model.parameters,
        family: model.family,
        recommendedIntensity: model.recommendedIntensity,
        bestFor: model.bestFor,
        avoidFor: model.avoidFor,
    };
}).filter(Boolean);

/* Toute la bibliotheque, marque par marque, pour les reglages avances. */
export const VISION_BRAND_LIBRARY = CAMERA_BRANDS.map((brand) => ({
    id: brand.id,
    name: brand.name,
    desc: brand.desc,
    profiles: (brand.profiles || []).map((profile) => {
        const model = buildVisionProfileModel(profile, brand);
        return {
            id: model.id,
            label: profile.name,
            hint: profile.desc,
            vision: model,
            filters: model.parameters,
            family: model.family,
            recommendedIntensity: model.recommendedIntensity,
            bestFor: model.bestFor,
            avoidFor: model.avoidFor,
        };
    }),
}));
