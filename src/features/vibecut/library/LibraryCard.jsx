"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { Check, Star } from 'lucide-react';
import {
    getPreviewController,
    progressFromPointer,
    releaseScrub,
    scrubTo,
} from './previewController';
import styles from './library.module.css';

/*
 * Une vignette de bibliotheque - lot B1.
 *
 * ---------------------------------------------------------------------------
 * LE HOVER SCRUB, ET POURQUOI C'EST LUI QU'ON A CHOISI
 *
 * La position HORIZONTALE du pointeur sur la vignette EST le curseur de temps.
 * Aucun clic, aucun bouton lecture: on balaye la grille et on a auditionne
 * trente-huit transitions en quelques secondes. C'est le « Hover Scrub Preview »
 * de DaVinci Resolve et le « skimming » de Final Cut Pro.
 *
 * C'est ce qui a remplace l'avant/apres a separateur deplacable: un separateur
 * compare deux etats d'un MEME INSTANT coupes dans l'ESPACE, alors qu'un
 * mouvement et une transition sont des differences dans le TEMPS. Sur un
 * mouvement il aurait donne une image cassee en deux; sur une transition, deux
 * moities identiques pendant 80 % de la duree.
 *
 * AU REPOS, la vignette se fige au POINT CULMINANT de son effet, jamais a
 * l'instant 0: une grille figee a t=0 serait trente-huit fois la meme image.
 *
 * EQUIVALENT CLAVIER: les fleches gauche/droite scrubent la vignette qui a le
 * focus. Sans ca l'ecran serait inutilisable sans souris. La navigation d'une
 * carte a l'autre reste au Tab - detourner les fleches pour ca aurait retire le
 * seul acces clavier au temps, qui est la fonction centrale de l'ecran.
 * ---------------------------------------------------------------------------
 */

const KEYBOARD_STEP = 0.08;

export default function LibraryCard({
    entry,
    controlKey,
    index = 0,
    selected = false,
    favorite = false,
    onSelect,
    onToggleFavorite,
    renderPreview,
    peak = 0.5,
    testId,
}) {
    /*
     * Le controleur est lu DU REGISTRE au moment ou l'on s'en sert, jamais
     * pendant le rendu: la carte et son canvas partagent ainsi le meme objet
     * sans se le passer en prop. Le decalage de boucle en est derive, donc la
     * grille respire au lieu de battre a l'unisson (plan.md § 4.5).
     */
    const control = useCallback(() => getPreviewController(controlKey, { peak }), [controlKey, peak]);

    const frameRef = useRef(null);
    const trackRef = useRef(null);
    const scrubRef = useRef(peak);

    /*
     * Le liseré de progression est ecrit DIRECTEMENT dans le DOM. Le passer par
     * un `setState` relancerait un rendu React a la cadence du pointeur, sur une
     * grille de quarante cartes: c'est le bug 3 (playhead saccade) rejoue.
     */
    const paint = useCallback((progress, active) => {
        const track = trackRef.current;
        if (!track) return;
        track.style.setProperty('--vc-scrub', `${Math.round(progress * 1000) / 10}%`);
        track.dataset.active = active ? 'true' : 'false';
    }, []);

    const handleScrub = useCallback((progress) => {
        scrubRef.current = scrubTo(control(), progress);
        paint(scrubRef.current, true);
    }, [control, paint]);

    const handleRelease = useCallback(() => {
        const controller = control();
        releaseScrub(controller);
        scrubRef.current = controller.peak;
        paint(controller.peak, false);
    }, [control, paint]);

    const handlePointer = useCallback((event) => {
        // Un pointeur grossier (tactile) n'a pas de survol: le scrub y serait un
        // piege qui avalerait le tap. On laisse alors la boucle tourner.
        if (event.pointerType === 'touch') return;
        handleScrub(progressFromPointer(event, frameRef.current));
    }, [handleScrub]);

    const handleKeyDown = useCallback((event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? KEYBOARD_STEP : -KEYBOARD_STEP;
        handleScrub(scrubRef.current + delta);
    }, [handleScrub]);

    // Une carte demontee pendant un survol laisserait son controleur en scrub.
    useEffect(() => () => releaseScrub(control()), [control]);

    const badge = entry.badge || null;

    return (
        <article
            className={[
                styles.card,
                selected ? styles.cardActive : '',
                entry.dimmed ? styles.cardPlanned : '',
            ].filter(Boolean).join(' ')}
            style={{ '--vc-card-index': Math.min(index, 11) }}
            data-testid={testId}
            data-selected={selected ? 'true' : 'false'}
            data-favorite={favorite ? 'true' : 'false'}
            {...(entry.dataAttributes || {})}
        >
            <button
                type="button"
                className={styles.cardSelect}
                aria-pressed={selected}
                onClick={() => onSelect?.(entry)}
                onPointerEnter={handlePointer}
                onPointerMove={handlePointer}
                onPointerLeave={handleRelease}
                onBlur={handleRelease}
                onKeyDown={handleKeyDown}
                data-testid={testId ? `${testId}-select` : undefined}
            >
                <span className={styles.cardFrame} ref={frameRef}>
                    {renderPreview(controlKey)}
                    {/*
                      * Le liseré ne s'allume que pendant le scrub. Le faire suivre
                      * la boucle couterait une ecriture DOM par image et par
                      * carte, pour une information que l'animation donne deja.
                      */}
                    <span className={styles.cardTrack} ref={trackRef} data-active="false" aria-hidden="true">
                        <span className={styles.cardTrackFill} />
                    </span>
                </span>
                <span className={styles.cardBody}>
                    <span className={styles.cardName}>{entry.name}</span>
                    <span className={styles.cardDescription}>{entry.description}</span>
                </span>
            </button>

            {badge ? (
                <span
                    className={[styles.cardBadge, badge.tone === 'accent' ? styles.cardBadgeReady : ''].filter(Boolean).join(' ')}
                    data-testid={testId ? `${testId}-badge` : undefined}
                >
                    {badge.label}
                </span>
            ) : null}

            {/*
              * L'etoile est un FRERE du bouton de selection, jamais un bouton
              * imbrique dans un bouton: c'etait le bug 11, HTML invalide et clic
              * qui declenchait les deux actions a la fois.
              */}
            <button
                type="button"
                className={styles.cardStar}
                aria-pressed={favorite}
                aria-label={favorite ? `Retirer ${entry.name} des favoris` : `Ajouter ${entry.name} aux favoris`}
                onClick={() => onToggleFavorite?.(entry.id)}
                data-testid={testId ? `${testId}-star` : undefined}
            >
                <Star size={14} fill={favorite ? 'currentColor' : 'none'} />
            </button>

            {selected ? (
                <span className={styles.cardCheck} aria-hidden="true"><Check size={13} /></span>
            ) : null}
        </article>
    );
}
