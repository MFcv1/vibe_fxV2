"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { renderTransition } from '@/features/vibefx-studio/video/engine/VideoEngine';
import { prefersReducedMotion, subscribeToPreviewTicker } from './previewTicker';
import {
    PREVIEW_MODES,
    getPreviewController,
    transitionLoopPhase,
} from './previewController';
import { resolveFrozenPair } from './librarySourceFreeze';
import styles from './library.module.css';

/*
 * Apercu d'une transition, dessine par LE MOTEUR LUI-MEME.
 *
 * `renderTransition` est la fonction que l'apercu du montage appelle. La carte
 * de bibliotheque ne montre donc pas une imitation CSS de la transition, elle
 * montre la transition. Pour les 33 transitions minutees, c'est aussi ce que
 * l'export rendra: la parite est verrouillee par
 * `test:vibecut-xfade-preview-parity`, et une carte ne peut plus deriver de son
 * rendu sans que ce test le voie.
 *
 * PIEGE EVITE: une `requestAnimationFrame` par carte donnerait quarante boucles.
 * Toutes les cartes s'abonnent a une horloge unique, et seules celles qui sont
 * VISIBLES dessinent - une bibliotheque qui defile ne doit pas payer le rendu de
 * ce qui est hors champ.
 *
 * ---------------------------------------------------------------------------
 * LOT B1 - LE TEMPS N'EST PLUS TOUJOURS L'HORLOGE
 *
 * Le composant ne decide plus seul de sa progression: il la lit du `controller`
 * (voir `previewController.js`). Selon le mode, le temps vient de l'horloge
 * partagee (boucle), du pointeur ou des fleches (scrub), ou il est arrete au
 * point culminant (freeze).
 *
 * Le `controller` est un objet MUTABLE, pas un etat React: le survol ecrit
 * dedans et appelle `render()`, sans jamais declencher de rendu React. C'est le
 * correctif du bug 3 rejoue ici.
 *
 * BYPASS: quand il est arme, on dessine la COUPE FRANCHE - le plan sortant
 * jusqu'a la moitie, l'entrant ensuite. C'est litteralement « ce que ca donne
 * sans la transition », en plein cadre, et c'est la forme juste de l'avant/apres
 * pour une difference qui est temporelle et non spatiale.
 * ---------------------------------------------------------------------------
 */

const HOLD_SECONDS = 0.7;

export default function TransitionPreview({
    type,
    images,
    duration = 0.8,
    width = 220,
    height = 138,
    testId,
    controlKey = 'transition-preview',
    peak = 0.5,
    className,
}) {
    const canvasRef = useRef(null);
    const visibleRef = useRef(true);
    const elapsedRef = useRef(0);
    const lastKeyRef = useRef('');
    // Copie des sources prise quand la vignette quitte la boucle (lot B2).
    const frozenRef = useRef(null);

    const render = useCallback(() => {
        /*
         * Le controleur est lu du REGISTRE, jamais tenu dans une `ref` lue au
         * rendu: c'est ce qui permet a la carte et a ce canvas de partager le
         * meme objet sans se le passer en prop (voir `previewController.js`).
         */
        const control = getPreviewController(controlKey, { peak });
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !images?.from || !images?.to) return;

        /*
         * LOT B2 - des que le temps n'est plus celui de l'horloge, on dessine une
         * COPIE de la source. Sans elle, un scrub sur un rush anime comparerait
         * deux instants differents du plan, et le bypass ne prouverait plus rien
         * (voir `librarySourceFreeze.js`).
         */
        const live = control.mode === PREVIEW_MODES.LOOP;
        const sources = resolveFrozenPair(frozenRef, images, live);

        let from = sources.from;
        let to = sources.to;
        let progress = control.progress;

        if (live) {
            if (!visibleRef.current) return;
            const phase = transitionLoopPhase(elapsedRef.current + control.offset, duration, HOLD_SECONDS);
            progress = phase.progress;
            // Le retour rejoue la transition en sens inverse: on echange les
            // deux plans plutot que d'inverser la progression, sans quoi une
            // directionnelle repartirait du mauvais bord.
            if (phase.reversed) {
                from = sources.to;
                to = sources.from;
            }
        }

        /*
         * Ne rien redessiner quand rien n'a change. Une vignette figee ne doit
         * pas payer soixante rendus canvas par seconde pour afficher deux fois
         * la meme image.
         *
         * LOT B2 - `images.version()` fait partie de la cle, et il le faut.
         * Quand la source est une VIDEO, les pixels changent sans que la
         * progression bouge : une vignette figee (mode FREEZE,
         * `prefers-reduced-motion`) garderait sinon eternellement la premiere
         * image du clip. Sur une source fixe, la version ne bouge jamais et le
         * cache se comporte exactement comme avant.
         */
        const mediaVersion = live && images.version ? images.version() : 'fige';
        const key = `${control.mode}|${progress.toFixed(4)}|${control.bypass ? 1 : 0}|${from === sources.to ? 1 : 0}|${mediaVersion}`;
        if (key === lastKeyRef.current) return;
        lastKeyRef.current = key;

        const { width: w, height: h } = canvas;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);

        if (control.bypass) {
            // Sans transition, il ne reste qu'une coupe franche.
            ctx.drawImage(progress < 0.5 ? from : to, 0, 0, w, h);
        } else if (progress <= 0) {
            ctx.drawImage(from, 0, 0, w, h);
        } else if (progress >= 1) {
            ctx.drawImage(to, 0, 0, w, h);
        } else {
            renderTransition(ctx, from, to, progress, type, w, h);
        }

        /*
         * Etat ECRIT DANS LE DOM, pas dans React: c'est ce que les tests lisent
         * pour verifier que le survol a bien pris la main, et ca ne coute aucun
         * rendu.
         */
        canvas.dataset.previewMode = control.mode;
        canvas.dataset.previewProgress = progress.toFixed(3);
        canvas.dataset.previewBypass = control.bypass ? 'true' : 'false';
    }, [controlKey, duration, images, peak, type]);

    // La carte redessine par ce point d'entree quand le pointeur bouge.
    useEffect(() => {
        const control = getPreviewController(controlKey, { peak });
        control.render = render;
        return () => {
            if (control.render === render) control.render = () => {};
        };
    }, [controlKey, peak, render]);

    /*
     * Ne dessiner que ce qui est a l'ecran. Une bibliotheque de quarante-deux
     * cartes qui defile ne doit pas payer le rendu de ce qui est hors champ.
     */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || typeof IntersectionObserver !== 'function') return undefined;
        const observer = new IntersectionObserver(
            ([entry]) => { visibleRef.current = entry.isIntersecting; },
            { rootMargin: '120px' },
        );
        observer.observe(canvas);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!images?.ready) return undefined;
        lastKeyRef.current = '';

        /*
         * `prefers-reduced-motion`: la vignette se fige au POINT CULMINANT de
         * l'effet, et on ne s'abonne pas a l'horloge. Le reglage arrete le
         * mouvement, il ne doit ni vider la carte de sa substance ni retirer le
         * scrub - qui, lui, reste pilote a la main.
         */
        const control = getPreviewController(controlKey, { peak });
        const reduced = prefersReducedMotion();
        control.reduced = reduced;
        if (reduced && control.mode === PREVIEW_MODES.LOOP) {
            control.mode = PREVIEW_MODES.FREEZE;
            control.progress = control.peak;
        }
        render();
        if (reduced) return undefined;

        return subscribeToPreviewTicker((elapsed) => {
            elapsedRef.current = elapsed;
            if (control.mode !== PREVIEW_MODES.LOOP) return;
            render();
        });
    }, [controlKey, images, peak, render]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={[styles.previewCanvas, className].filter(Boolean).join(' ')}
            data-testid={testId}
            data-transition={type}
            aria-hidden="true"
        />
    );
}
