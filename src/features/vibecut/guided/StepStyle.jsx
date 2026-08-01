"use client";

import React from 'react';
import { Check } from 'lucide-react';
import { Segmented } from '../primitives';
import { RECIPE_FORMATS, STYLE_RECIPES } from '../data/styleRecipes';
import PresetFilmstrip from './PresetFilmstrip';
import styles from './guided.module.css';

/*
 * Etape 2 - Format et style.
 * La decision principale est le style: il fixe d'un coup la duree des photos,
 * les mouvements, l'enchainement et la colorimetrie. Le format reste un reglage
 * secondaire, pre-rempli par le style et modifiable a tout moment.
 */

export default function StepStyle({
    styleId, onStyleChange, sequencePreset, onFormatChange, thumbnails = [],
}) {
    return (
        <>
            <section className={styles.panelSection} aria-labelledby="vibecut-guided-format-title">
                <div className={styles.panelSectionHead}>
                    <h3 className={styles.sectionTitle} id="vibecut-guided-format-title">Format</h3>
                    <p className={styles.sectionHint}>
                        {RECIPE_FORMATS.find((format) => format.value === sequencePreset)?.description || ''}
                    </p>
                </div>
                <Segmented
                    label="Format de la vidéo"
                    value={sequencePreset}
                    onChange={onFormatChange}
                    options={RECIPE_FORMATS.map(({ value, label }) => ({ value, label }))}
                />
            </section>

            <section className={styles.panelSection} aria-labelledby="vibecut-guided-style-title">
                <div className={styles.panelSectionHead}>
                    <h3 className={styles.sectionTitle} id="vibecut-guided-style-title">Style visuel</h3>
                    <p className={styles.sectionHint}>
                        Chaque vignette joue le rythme et l’enchaînement de son style
                    </p>
                </div>

                <div className={styles.styleGrid} role="radiogroup" aria-labelledby="vibecut-guided-style-title">
                    {STYLE_RECIPES.map((recipe, index) => {
                        const isActive = recipe.id === styleId;
                        return (
                            <button
                                key={recipe.id}
                                type="button"
                                role="radio"
                                aria-checked={isActive}
                                onClick={() => onStyleChange(recipe.id)}
                                className={[styles.styleCard, isActive ? styles.styleCardActive : ''].filter(Boolean).join(' ')}
                                style={{ '--vc-stagger': index }}
                                data-testid={`vibecut-guided-style-${recipe.id}`}
                            >
                                <PresetFilmstrip
                                    recipe={recipe}
                                    thumbnails={thumbnails}
                                    index={index}
                                >
                                    {isActive ? (
                                        <span className={styles.styleCheck}><Check size={13} /></span>
                                    ) : null}
                                </PresetFilmstrip>

                                <span className={styles.styleBody}>
                                    <span className={styles.styleName}>{recipe.name}</span>
                                    <span className={styles.styleDescription}>{recipe.description}</span>
                                    <span className={styles.styleBest}>{recipe.bestFor}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <p className={styles.note}>
                    Un style règle la durée des photos, le mouvement de caméra, l’enchaînement entre
                    scènes et les couleurs. Tes vidéos gardent leur durée d’origine.
                </p>
            </section>
        </>
    );
}
