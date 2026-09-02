"use client";

import React, { useMemo, useState } from 'react';
import { Sheet, SearchField, useToast } from '../primitives';
import { gridPreviewZones } from './gridLibrary';
import { ALL_GRIDS, GRID_CATEGORIES } from './gridCatalog';
import TemplatePreviewSvg from './TemplatePreviewSvg';
import styles from './layout.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/*
 * Bibliotheque de grilles: chaque carte montre la MEME grille dans les deux
 * formats de publication Instagram (4:5 et 1:1), pour qu'on choisisse en
 * sachant ce que ca donne des deux cotes. Le format actif est encadre.
 */
export default function GridLibrarySheet({
    open, onClose, onApply, activePresetId, activeFormat,
}) {
    const [categoryId, setCategoryId] = useState(GRID_CATEGORIES[0].id);
    const [query, setQuery] = useState('');
    const { push } = useToast();
    const isSquareFormat = (Number(activeFormat?.ratio) || 0.8) > 0.9;

    const visibleGrids = useMemo(() => {
        const search = normalize(query).trim();
        if (search) {
            return ALL_GRIDS.filter((grid) => (
                normalize(`${grid.label} ${grid.description} ${grid.slots} images`).includes(search)
            ));
        }
        return ALL_GRIDS.filter((grid) => grid.category === categoryId);
    }, [categoryId, query]);

    return (
        <Sheet open={open} onClose={onClose} title="Bibliothèque de grilles" wide>
            <p className={styles.sheetIntro}>
                {ALL_GRIDS.length} grilles éditoriales. Chacune existe en portrait 4:5 et en
                carré 1:1&nbsp;: changer de format recompose la grille au lieu de l&apos;étirer.
            </p>
            <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Chercher une grille (bento, planche, diptyque…)"
                label="Chercher une grille"
            />

            <div className={styles.templateBrowser}>
                {query ? null : (
                    <nav className={styles.templateCategories} aria-label="Familles de grilles">
                        {GRID_CATEGORIES.map((category) => (
                            <button
                                key={category.id}
                                type="button"
                                title={category.hint}
                                className={cx(
                                    styles.templateCategory,
                                    category.id === categoryId && styles.templateCategoryActive,
                                )}
                                onClick={() => setCategoryId(category.id)}
                            >
                                <span>{category.label}</span>
                            </button>
                        ))}
                    </nav>
                )}

                <div className={styles.templateGrid}>
                    {visibleGrids.map((grid) => {
                        const isApplied = grid.id === activePresetId;
                        return (
                            <button
                                key={grid.id}
                                type="button"
                                className={cx(styles.templateCard, isApplied && styles.templateCardActive)}
                                onClick={() => {
                                    onApply(grid);
                                    push(`Grille « ${grid.label} » appliquée.`, { tone: 'success' });
                                    onClose();
                                }}
                            >
                                <span className={styles.gridCardStages}>
                                    <span className={cx(styles.gridCardStage, !isSquareFormat && styles.gridCardStageActive)}>
                                        <TemplatePreviewSvg ratio={4 / 5} zones={gridPreviewZones(grid, 'portrait')} />
                                        <small>4:5</small>
                                    </span>
                                    <span className={cx(styles.gridCardStage, isSquareFormat && styles.gridCardStageActive)}>
                                        <TemplatePreviewSvg ratio={1} zones={gridPreviewZones(grid, 'square')} />
                                        <small>1:1</small>
                                    </span>
                                </span>
                                <span className={styles.templateCardLabel}>{grid.label}</span>
                                <span className={styles.templateCardSub}>
                                    {grid.slots} image{grid.slots > 1 ? 's' : ''} · {grid.description}
                                    {grid.fixed ? ' Grille figée : même découpe dans les deux formats.' : ''}
                                </span>
                            </button>
                        );
                    })}
                    {visibleGrids.length ? null : (
                        <p className={styles.sheetIntro}>Aucune grille ne correspond à « {query} ».</p>
                    )}
                </div>
            </div>
        </Sheet>
    );
}
