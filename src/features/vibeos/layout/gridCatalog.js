/*
 * Catalogue complet des grilles: les 24 grilles editoriales compilees
 * (`gridLibrary.js`, sans JSX pour rester testable en Node) plus les grilles
 * historiques du studio, rangees dans la famille "Classiques".
 *
 * Ce fichier existe pour que le PANNEAU et la BIBLIOTHEQUE affichent
 * exactement la meme liste: choisir une famille dans le panneau doit donner
 * les memes grilles que la famille correspondante dans la bibliotheque.
 */

import { CUSTOM_LAYOUT_PRESETS } from '../../vibefx-studio/data/constants';
import { GRID_CATEGORIES, GRID_PRESETS, asFixedGrid } from './gridLibrary';

export const ALL_GRIDS = [
    ...GRID_PRESETS,
    ...CUSTOM_LAYOUT_PRESETS.map((preset) => asFixedGrid(preset)),
];

export const GRID_COUNT = ALL_GRIDS.length;

/* Nombre de grilles par famille, calcule une fois (l'entete du panneau et le
   menu de familles l'affichent a chaque rendu). */
export const GRID_COUNT_BY_CATEGORY = GRID_CATEGORIES.reduce((counts, category) => ({
    ...counts,
    [category.id]: ALL_GRIDS.filter((grid) => grid.category === category.id).length,
}), {});

export function catalogGrid(presetId) {
    if (!presetId) return null;
    return ALL_GRIDS.find((grid) => grid.id === presetId) || null;
}

export function gridsInCategory(categoryId) {
    return ALL_GRIDS.filter((grid) => grid.category === categoryId);
}

export { GRID_CATEGORIES };
