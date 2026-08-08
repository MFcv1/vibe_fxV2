"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { applyImageMotionTransform } from '@/features/vibefx-studio/video/model/mediaModel';
import { prefersReducedMotion, subscribeToPreviewTicker } from './previewTicker';
import {
    PREVIEW_MODES,
    getPreviewController,
    motionLoopProgress,
} from './previewController';
import { resolveFrozenPair } from './librarySourceFreeze';
import styles from './library.module.css';

/*
 * Apercu d'un mouvement, dessine par LA TRANSFORMATION DE PRODUCTION.
 *
 * `applyImageMotionTransform` vit dans `mediaModel.js` - le module sans aucun
 * import extrait au lot L3 pour que le test de parite charge le code de
 * production tel quel. La bibliotheque de mouvements l'appelle donc exactement
 * comme l'apercu du montage, et donc exactement comme le `zoompan` du renderer:
 * ce que la carte montre est ce que l'export produira.
 *
 * `intensity` et les cadrages traversent l'objet `motion` sans etre reinterpretes
 * ici: reimplementer la formule cote bibliotheque serait le meilleur moyen de la
 * voir deriver en silence, ce que le lot L3 a passe une session a corriger.
 *
 * ---------------------------------------------------------------------------
 * LOT B1 - meme pilotage du temps que `TransitionPreview` (voir
 * `previewController.js`): boucle, scrub au pointeur ou au clavier, ou arret sur
 * le point culminant.
 *
 * BYPASS: on rejoue la MEME transformation avec le mouvement neutre. C'est bien
 * « sans l'effet » - et ca reste dessine par le moteur, donc ca ne peut pas
 * mentir non plus. Ecrire un `drawImage` nu aurait introduit un second chemin de
 * rendu dans le composant dont tout l'interet est de n'en avoir qu'un.
 * ---------------------------------------------------------------------------
 */

const HOLD_SECONDS = 0.35;
const NEUTRAL_MOTION = { preset: 'none', intensity: 1 };

export default function MotionPreview({
    motion,
    image,
    /*
     * LOT B2 - la source peut etre une VIDEO qui tourne. Elle change de pixels
     * sans que la progression bouge, donc le cache de rendu doit la voir passer
     * ou la vignette resterait sur la premiere image du clip.
     */
    mediaVersion,
    cycleSeconds = 3,
    width = 220,
    height = 138,
    testId,
    controlKey = 'motion-preview',
    peak = 1,
    className,
}) {
    const canvasRef = useRef(null);
    const visibleRef = useRef(true);
    const elapsedRef = useRef(0);
    const lastKeyRef = useRef('');
    const frozenRef = useRef(null);

    const render = useCallback(() => {
        // Controleur lu du REGISTRE (voir `previewController.js`): la carte et ce
        // canvas partagent le meme objet sans se le passer en prop.
        const control = getPreviewController(controlKey, { peak });
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !image) return;

        // LOT B2 - meme regle que pour les transitions: hors boucle, on dessine
        // une copie figee (voir `librarySourceFreeze.js`).
        const live = control.mode === PREVIEW_MODES.LOOP;
        const source = resolveFrozenPair(frozenRef, { from: image, to: image }, live).from;

        let progress = control.progress;
        if (live) {
            if (!visibleRef.current) return;
            progress = motionLoopProgress(elapsedRef.current + control.offset, cycleSeconds, HOLD_SECONDS);
        }

        // Une vignette figee ne redessine pas soixante fois par seconde. Sur une
        // source fixe, `mediaVersion` ne bouge jamais et le cache se comporte
        // exactement comme avant le lot B2.
        const version = live && typeof mediaVersion === 'function' ? mediaVersion() : 'fige';
        const key = `${control.mode}|${progress.toFixed(4)}|${control.bypass ? 1 : 0}|${version}`;
        if (key === lastKeyRef.current) return;
        lastKeyRef.current = key;

        const { width: w, height: h } = canvas;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        /*
         * LA DUREE est passee depuis le lot du 2026-08-04: elle ne servait a rien
         * tant qu'aucune entree de la bibliotheque ne battait en HERTZ. Le
         * decrochage de `glitch` en depend - sans elle il sauterait a la cadence
         * d'un plan de 4 s quelle que soit la duree reglee, et la vignette
         * mentirait sur ce que l'export produira.
         */
        applyImageMotionTransform(
            ctx,
            control.bypass ? NEUTRAL_MOTION : motion,
            progress,
            w,
            h,
            cycleSeconds,
        );
        ctx.drawImage(source, 0, 0, w, h);
        ctx.restore();

        canvas.dataset.previewMode = control.mode;
        canvas.dataset.previewProgress = progress.toFixed(3);
        canvas.dataset.previewBypass = control.bypass ? 'true' : 'false';
    }, [controlKey, cycleSeconds, image, mediaVersion, motion, peak]);

    useEffect(() => {
        const control = getPreviewController(controlKey, { peak });
        control.render = render;
        return () => {
            if (control.render === render) control.render = () => {};
        };
    }, [controlKey, peak, render]);

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
        if (!image) return undefined;
        lastKeyRef.current = '';

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
    }, [controlKey, image, peak, render]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={[styles.previewCanvas, className].filter(Boolean).join(' ')}
            data-testid={testId}
            data-motion={motion?.preset || 'none'}
            aria-hidden="true"
        />
    );
}
