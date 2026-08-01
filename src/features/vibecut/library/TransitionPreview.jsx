"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { renderTransition } from '@/features/vibefx-studio/video/engine/VideoEngine';
import { prefersReducedMotion, subscribeToPreviewTicker } from './previewTicker';
import styles from './library.module.css';

/*
 * Apercu A/B d'une transition, dessine par LE MOTEUR LUI-MEME.
 *
 * `renderTransition` est la fonction que l'apercu du montage appelle. La carte
 * de bibliotheque ne montre donc pas une imitation CSS de la transition, elle
 * montre la transition. Pour les 15 transitions minutees, c'est aussi ce que
 * l'export rendra: la parite est verrouillee par
 * `test:vibecut-xfade-preview-parity`, et une carte ne peut plus deriver de son
 * rendu sans que ce test le voie.
 *
 * PIEGE EVITE: une `requestAnimationFrame` par carte donnerait quarante boucles.
 * Toutes les cartes s'abonnent a une horloge unique, et seules celles qui sont
 * VISIBLES dessinent - une bibliotheque qui defile ne doit pas payer le rendu de
 * ce qui est hors champ.
 */

const HOLD_SECONDS = 0.7;

export default function TransitionPreview({
    type,
    images,
    duration = 0.8,
    width = 220,
    height = 138,
    testId,
}) {
    const canvasRef = useRef(null);
    const visibleRef = useRef(true);

    const draw = useCallback((from, to, progress) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !from || !to) return;
        const { width: w, height: h } = canvas;
        ctx.clearRect(0, 0, w, h);
        if (progress <= 0) {
            ctx.drawImage(from, 0, 0, w, h);
            return;
        }
        if (progress >= 1) {
            ctx.drawImage(to, 0, 0, w, h);
            return;
        }
        renderTransition(ctx, from, to, progress, type, w, h);
    }, [type]);

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

        /*
         * `prefers-reduced-motion`: une image FIXE au milieu de la transition, et
         * aucun abonnement. Le reglage arrete le mouvement, il ne doit pas vider
         * la carte de sa substance.
         */
        if (prefersReducedMotion()) {
            draw(images.from, images.to, 0.5);
            return undefined;
        }

        draw(images.from, images.to, 0);
        return subscribeToPreviewTicker((elapsed) => {
            if (!visibleRef.current) return;
            const span = Math.max(0.15, Number(duration) || 0.8);
            // A tenu · A -> B · B tenu · B -> A: la transition se lit dans les
            // deux sens, ce qui rend les directionnelles reellement lisibles.
            const cycle = (HOLD_SECONDS + span) * 2;
            const phase = elapsed % cycle;
            if (phase < HOLD_SECONDS) {
                draw(images.from, images.to, 0);
            } else if (phase < HOLD_SECONDS + span) {
                draw(images.from, images.to, (phase - HOLD_SECONDS) / span);
            } else if (phase < HOLD_SECONDS * 2 + span) {
                draw(images.from, images.to, 1);
            } else {
                draw(images.to, images.from, (phase - HOLD_SECONDS * 2 - span) / span);
            }
        });
    }, [draw, duration, images]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={styles.previewCanvas}
            data-testid={testId}
            data-transition={type}
            aria-hidden="true"
        />
    );
}
