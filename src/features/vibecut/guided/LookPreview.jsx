"use client";

import React from 'react';
import SceneIllustration, { getSceneVariant } from '../media/SceneIllustration';
import { getMotionById } from '../data/motionCatalog';
import { getStyleTempo, lookToCssFilter, lookToOverlays } from '../data/styleRecipes';
import styles from './guided.module.css';

/*
 * Vignettes de demonstration de la creation guidee.
 *
 * Chaque vignette joue DEUX plans qui s'enchainent, parce que c'est ce qu'un
 * montage fait: le mouvement du premier plan, l'enchainement, puis le mouvement
 * du second. Deux reglages voisins doivent donc se distinguer a l'oeil sans lire
 * une ligne de texte.
 *
 * Le media est une illustration SVG (aucun asset externe), la colorimetrie une
 * approximation CSS du look. C'est une demonstration, pas le rendu qui fait foi:
 * le vrai resultat est dans la colonne d'apercu, qui joue le montage.
 */

function motionVariables(motionId) {
    const motion = getMotionById(motionId);
    const frame = motion?.motionPreview;
    if (!frame) return {};
    return {
        '--from-scale': frame.from.scale ?? 1,
        '--from-x': `${frame.from.x ?? 0}%`,
        '--from-y': `${frame.from.y ?? 0}%`,
        '--to-scale': frame.to.scale ?? 1,
        '--to-x': `${frame.to.x ?? 0}%`,
        '--to-y': `${frame.to.y ?? 0}%`,
    };
}

/*
 * Deux plans qui s'enchainent.
 * `pace` decrit la longueur du fondu par rapport a la duree d'un plan, et
 * `cycleSeconds` la duree d'un plan: c'est ce couple qui donne son caractere a
 * la demonstration.
 */
function ScenePair({
    look,
    motionA,
    motionB,
    pace,
    cycleSeconds,
    variantA,
    variantB,
    stageClassName,
    artClassName,
    children,
}) {
    const filter = lookToCssFilter(look || {});
    const overlays = lookToOverlays(look || {});
    const artClass = artClassName || styles.styleArt;

    return (
        <span
            className={stageClassName || styles.styleStage}
            style={{ '--vc-cycle': `${cycleSeconds}s` }}
            data-pace={pace}
            aria-hidden="true"
        >
            <span className={artClass} style={{ filter, ...motionVariables(motionA) }}>
                <SceneIllustration variant={variantA} />
            </span>
            <span
                className={`${artClass} ${styles.styleArtB}`}
                style={{ filter, ...motionVariables(motionB) }}
            >
                <SceneIllustration variant={variantB} />
            </span>
            {overlays.fade > 0 ? (
                <span className={styles.styleFade} style={{ opacity: overlays.fade }} />
            ) : null}
            {overlays.vignette > 0 ? (
                <span
                    className={styles.styleVignette}
                    style={{ boxShadow: `inset 0 0 42px 12px rgba(0,0,0,${overlays.vignette})` }}
                />
            ) : null}
            {children}
        </span>
    );
}

/*
 * Vignette d'un style: elle joue la cadence REELLE du style et sa longueur de
 * fondu reelle. « Net et direct » coupe franchement ici parce qu'il coupera
 * franchement dans la video.
 */
export function StylePreview({ recipe, motionPattern = ['none'], index = 0, children }) {
    const tempo = getStyleTempo(recipe);
    return (
        <ScenePair
            look={recipe.look}
            motionA={motionPattern[0] || 'none'}
            motionB={motionPattern[1] || motionPattern[0] || 'none'}
            pace={tempo.pace}
            cycleSeconds={tempo.cycleSeconds}
            variantA={getSceneVariant(index)}
            variantB={getSceneVariant(index + 3)}
        >
            {children}
        </ScenePair>
    );
}

/*
 * Vignette d'un jeu de mouvements: elle montre DEUX mouvements consecutifs du
 * motif, pas deux fois le premier. C'est ce qui rend « Doux » (zoom avant puis
 * zoom arriere) distinguable de « Varie » (zoom avant puis panoramique) - sans
 * quoi les deux cartes s'animaient exactement pareil.
 */
export function MotionPreview({ pattern = ['none'], look = null, index = 0 }) {
    return (
        <ScenePair
            look={look}
            motionA={pattern[0] || 'none'}
            motionB={pattern[1] || pattern[0] || 'none'}
            pace="soft"
            cycleSeconds={2.6}
            variantA={getSceneVariant(index + 2)}
            variantB={getSceneVariant(index + 4)}
            stageClassName={styles.motionStage}
            artClassName={styles.motionArt}
        />
    );
}
