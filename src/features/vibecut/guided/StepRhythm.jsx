"use client";

import React from 'react';
import {
    buildMontagePlan,
    MOTION_INTENSITIES,
    MOTION_MOODS,
    RHYTHMS,
} from '../data/styleRecipes';
import { MotionPreview } from './LookPreview';
import BeatStrip from './BeatStrip';
import styles from './guided.module.css';

/*
 * Etape 3 - Rythme et mouvements.
 * Decision principale: le rythme, qui donne la duree de chaque photo et la
 * longueur des enchainements. Les mouvements sont le reglage secondaire, et ils
 * ne concernent que les photos: le moteur ne les applique pas encore aux videos,
 * donc on ne les propose pas quand il n'y a aucune photo.
 */

export default function StepRhythm({
    scenes,
    plan,
    rhythmId,
    onRhythmChange,
    motionMoodId,
    onMotionMoodChange,
    motionIntensityId,
    onMotionIntensityChange,
}) {
    const hasImages = plan.imageCount > 0;
    // Aucun mouvement selectionne: regler son intensite n'aurait aucun effet.
    const hasMotion = hasImages && plan.motionPattern.some((motion) => motion && motion !== 'none');

    return (
        <>
            <section className={styles.panelSection} aria-labelledby="vibecut-guided-rhythm-title">
                <div className={styles.panelSectionHead}>
                    <h3 className={styles.sectionTitle} id="vibecut-guided-rhythm-title">Rythme</h3>
                    <p className={styles.sectionHint} data-testid="vibecut-guided-estimate">
                        Durée estimée : <span data-numeric="true">{plan.estimatedDuration} s</span>
                    </p>
                </div>

                {/*
                  * Lot L5: la FORME du montage, pas seulement son intervalle de
                  * durees. Deux presets peuvent annoncer « 2,7 à 4,6 s » et
                  * produire des montages opposés - « Récit » raccourcit ses
                  * plans, « Reel dynamique » les fait alterner. Ici ça se voit.
                  */}
                <BeatStrip plan={plan} />
                <p className={styles.beatLegend} data-testid="vibecut-guided-beatlegend">
                    <span>Largeur d’un bloc = durée du plan</span>
                    <span>Traits = coupes fondues</span>
                    {plan.videoCount > 0 ? <span>Blocs gris = vidéos, durée d’origine conservée</span> : null}
                </p>

                <div className={styles.choiceRow} role="radiogroup" aria-labelledby="vibecut-guided-rhythm-title">
                    {RHYTHMS.map((rhythm) => {
                        const isActive = rhythm.id === rhythmId;
                        // Chaque carte annonce le resultat reel de son choix, pas une
                        // promesse abstraite: la duree affichee est celle qui sera appliquee.
                        const preview = buildMontagePlan({
                            scenes,
                            styleId: plan.styleId,
                            rhythmId: rhythm.id,
                            motionMoodId,
                            sequencePreset: plan.sequencePreset,
                        });
                        return (
                            <button
                                key={rhythm.id}
                                type="button"
                                role="radio"
                                aria-checked={isActive}
                                onClick={() => onRhythmChange(rhythm.id)}
                                className={[styles.choiceCard, isActive ? styles.choiceCardActive : ''].filter(Boolean).join(' ')}
                                data-testid={`vibecut-guided-rhythm-${rhythm.id}`}
                            >
                                <span className={styles.choiceName}>{rhythm.name}</span>
                                <span className={styles.choiceDescription}>{rhythm.description}</span>
                                {/*
                                  * La même forme, comprimée. C'est la démonstration
                                  * visuelle de la formule du lot L2: le rythme
                                  * change la cadence, le preset garde la forme.
                                  */}
                                <BeatStrip
                                    plan={preview}
                                    compact
                                    testId={`vibecut-guided-beatstrip-${rhythm.id}`}
                                />
                                <span className={styles.choiceValue}>
                                    {/*
                                      * Depuis le lot L2 il n'y a plus UNE duree par photo mais une
                                      * partition: on annonce l'amplitude que ce rythme produira,
                                      * ce qui rend visible que le style garde sa forme quand le
                                      * rythme change.
                                      */}
                                    {hasImages ? (
                                        <>
                                            <span data-numeric="true">
                                                {preview.shortestImage === preview.longestImage
                                                    ? `${preview.shortestImage} s`
                                                    : `${preview.shortestImage} à ${preview.longestImage} s`}
                                            </span> par photo
                                        </>
                                    ) : (
                                        <>
                                            Montage de <span data-numeric="true">{preview.estimatedDuration} s</span>
                                        </>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className={styles.panelSection} aria-labelledby="vibecut-guided-motion-title">
                <div className={styles.panelSectionHead}>
                    <h3 className={styles.sectionTitle} id="vibecut-guided-motion-title">Mouvements de caméra</h3>
                    <p className={styles.sectionHint}>
                        {hasImages
                            ? `Appliqués à tes ${plan.imageCount} photo${plan.imageCount > 1 ? 's' : ''}`
                            : 'Aucune photo dans ce montage'}
                    </p>
                </div>

                <div className={styles.motionRow} role="radiogroup" aria-labelledby="vibecut-guided-motion-title">
                    {MOTION_MOODS.map((mood, index) => {
                        const isActive = mood.id === motionMoodId;
                        return (
                            <button
                                key={mood.id}
                                type="button"
                                role="radio"
                                aria-checked={isActive}
                                disabled={!hasImages}
                                onClick={() => onMotionMoodChange(mood.id)}
                                className={[styles.motionCard, isActive ? styles.motionCardActive : ''].filter(Boolean).join(' ')}
                                style={{ '--vc-stagger': index }}
                                data-testid={`vibecut-guided-motion-${mood.id}`}
                            >
                                <MotionPreview
                                    pattern={mood.pattern || plan.recipe.motionScore}
                                    look={plan.recipe.look}
                                    index={index}
                                />
                                <span className={styles.choiceName}>{mood.name}</span>
                                <span className={styles.choiceDescription}>{mood.description}</span>
                            </button>
                        );
                    })}
                </div>

                {/*
                  * Intensite du mouvement (lot L3). Trois crans nommes, pas un
                  * curseur: une decision lisible par ecran. Le meme facteur est
                  * applique par l'apercu et par l'export, sur le meme ecart de
                  * cadrage - c'est la meme formule des deux cotes.
                  */}
                <div className={styles.panelSectionHead} id="vibecut-guided-intensity-title">
                    <h4 className={styles.subsectionTitle}>Intensité du mouvement</h4>
                    <p className={styles.sectionHint}>
                        {plan.intensity.name} · {Math.round(plan.motionIntensity * 100)} %
                    </p>
                </div>

                <div
                    className={styles.choiceRow}
                    role="radiogroup"
                    aria-labelledby="vibecut-guided-intensity-title"
                >
                    {MOTION_INTENSITIES.map((level) => {
                        const isActive = level.id === motionIntensityId;
                        return (
                            <button
                                key={level.id}
                                type="button"
                                role="radio"
                                aria-checked={isActive}
                                disabled={!hasMotion}
                                onClick={() => onMotionIntensityChange(level.id)}
                                className={[styles.choiceCard, isActive ? styles.choiceCardActive : ''].filter(Boolean).join(' ')}
                                data-testid={`vibecut-guided-intensity-${level.id}`}
                            >
                                <span className={styles.choiceName}>{level.name}</span>
                                <span className={styles.choiceDescription}>{level.description}</span>
                                <span className={styles.choiceValue}>
                                    <span data-numeric="true">{Math.round(level.value * 100)} %</span> de la course
                                </span>
                            </button>
                        );
                    })}
                </div>

                <p className={styles.note}>
                    Ces six mouvements et leur intensité sont rendus à l’identique dans l’aperçu
                    et dans l’export serveur. Les mouvements sur vidéo (orbite, parallaxe,
                    rotation) arrivent plus tard : « Bientôt ».
                </p>
            </section>
        </>
    );
}
