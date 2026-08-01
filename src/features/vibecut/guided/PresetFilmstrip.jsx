"use client";

import React from 'react';
import { getMotionById } from '../data/motionCatalog';
import { getStyleTempo, lookToCssFilter, lookToOverlays } from '../data/styleRecipes';
import { StylePreview } from './LookPreview';
import styles from './guided.module.css';

/*
 * Vignette de preset batie sur les MINIATURES REELLES du projet (lot L4).
 *
 * A l'etape 2, les medias sont deja importes et leurs miniatures extraites: une
 * illustration SVG generique de montagne ne dit alors plus rien de ce que le
 * preset fera des photos de l'utilisateur. Trois panneaux tires de ses propres
 * images, teintes par le look du preset, enchaines par la VRAIE transition du
 * preset et a son VRAI tempo, montrent le montage qu'il va obtenir.
 *
 * Trois panneaux et pas deux: une partition (lot L2) a une sequence et des
 * accents. Avec deux plans, « Mixed media » (balayage, poussee, coupe) et
 * « Reel dynamique » (coupe seche) auraient montre la meme unique jointure.
 *
 * REPLI: tant qu'aucune miniature n'est disponible - l'extraction est
 * asynchrone, et l'utilisateur peut revenir a l'etape 2 avant qu'elle finisse -
 * on rend la vignette SVG de la phase 3. Cet etat existe deja et ne disparait
 * pas: une carte vide serait un mensonge de plus qu'une illustration generique.
 */

const PANEL_COUNT = 3;

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

export default function PresetFilmstrip({ recipe, thumbnails = [], index = 0, children }) {
    const available = thumbnails.filter(Boolean);

    /*
     * Repli assume. `StylePreview` porte deja la boucle permanente, le tempo reel
     * et le look: on ne perd que les photos de l'utilisateur.
     */
    if (available.length === 0) {
        return (
            <StylePreview recipe={recipe} motionPattern={recipe.motionScore} index={index}>
                {children}
            </StylePreview>
        );
    }

    const tempo = getStyleTempo(recipe);
    const filter = lookToCssFilter(recipe.look || {});
    const overlays = lookToOverlays(recipe.look || {});
    const motionScore = recipe.motionScore?.length ? recipe.motionScore : ['none'];

    return (
        <span
            className={styles.filmStage}
            style={{ '--vc-cycle': `${tempo.cycleSeconds}s` }}
            data-pace={tempo.pace}
            data-testid="vibecut-preset-filmstrip"
            data-source="thumbnails"
            aria-hidden="true"
        >
            {Array.from({ length: PANEL_COUNT }, (_, panel) => {
                /*
                 * Decalage par carte: deux presets voisins ne doivent pas montrer
                 * la meme photo au meme instant, sinon seul le look les separe.
                 */
                const source = available[(panel + index) % available.length];
                const motionId = motionScore[panel % motionScore.length];
                return (
                    <span
                        key={panel}
                        className={styles.filmPanel}
                        data-panel={panel}
                        style={{
                            filter,
                            /*
                             * Le delai est pose EN LIGNE, pas dans la feuille:
                             * un `animation-delay` isole y serait annule par tout
                             * raccourci `animation` declare plus bas (piege connu,
                             * plan.md § 4.7). En ligne, il gagne toujours - sauf
                             * contre le `!important` de `prefers-reduced-motion`,
                             * qui doit continuer a tout arreter.
                             */
                            animationDelay: `calc(var(--vc-cycle) * ${-panel} - var(--vc-stagger, 0) * 0.4s)`,
                            ...motionVariables(motionId),
                        }}
                    >
                        <img src={source} alt="" className={styles.filmImage} />
                    </span>
                );
            })}

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
