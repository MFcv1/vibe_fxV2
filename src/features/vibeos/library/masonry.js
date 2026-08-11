"use client";

/*
 * Masonry en colonnes, calcule en JavaScript.
 *
 * Pourquoi pas `column-count` en CSS: les colonnes CSS remplissent la premiere
 * colonne avant la suivante, donc l'ordre chronologique se lit de haut en bas
 * puis de gauche a droite - illisible pour une photothèque. Ici on place chaque
 * photo dans la colonne la plus courte, en gardant l'ordre de la liste: la
 * lecture reste "de gauche a droite, ligne apres ligne" et les bas de colonnes
 * restent alignes.
 *
 * Le resultat est une liste de rectangles absolus. Les tuiles sont donc
 * positionnees en `transform`, ce qui rend le changement de densite fluide:
 * chaque photo glisse vers sa nouvelle place au lieu d'un saut de reflow.
 */

export const DENSITY_MIN = 2;
export const DENSITY_MAX = 8;

/* Nombre de colonnes reellement utilisable a cette largeur: sur telephone, une
   densite de 8 donnerait des vignettes de 40px. */
export function resolveColumns(density, containerWidth) {
    if (!containerWidth) return density;
    const maxByWidth = Math.max(1, Math.floor(containerWidth / 120));
    return Math.max(1, Math.min(density, maxByWidth));
}

/*
 * @param items  [{ id, ratio }] - ratio = largeur / hauteur
 * @returns { rects: Map<id, {x, y, width, height}>, height }
 */
export function layoutMasonry(items, { containerWidth, columns, gap = 8 }) {
    const rects = new Map();
    if (!containerWidth || !columns || !items.length) return { rects, height: 0 };

    const columnWidth = (containerWidth - gap * (columns - 1)) / columns;
    const tops = new Array(columns).fill(0);

    items.forEach((item) => {
        /* Colonne la plus courte; a egalite, la plus a gauche - c'est ce qui
           preserve l'ordre de lecture sur la premiere rangee. */
        let target = 0;
        for (let i = 1; i < columns; i += 1) {
            if (tops[i] < tops[target] - 0.5) target = i;
        }
        const ratio = item.ratio && Number.isFinite(item.ratio) ? item.ratio : 1;
        /* Bornes: une panoramique tres large ou un tres long portrait ne doit pas
           casser la rangee. */
        const safeRatio = Math.min(3, Math.max(0.4, ratio));
        const height = Math.round(columnWidth / safeRatio);
        rects.set(item.id, {
            x: Math.round(target * (columnWidth + gap)),
            y: Math.round(tops[target]),
            width: Math.round(columnWidth),
            height,
        });
        tops[target] += height + gap;
    });

    return { rects, height: Math.max(0, Math.max(...tops) - gap) };
}
