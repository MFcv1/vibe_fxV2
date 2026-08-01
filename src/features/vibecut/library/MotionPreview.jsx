"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { applyImageMotionTransform } from '@/features/vibefx-studio/video/model/mediaModel';
import { prefersReducedMotion, subscribeToPreviewTicker } from './previewTicker';
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
 */

const HOLD_SECONDS = 0.35;

export default function MotionPreview({
    motion,
    image,
    cycleSeconds = 3,
    width = 220,
    height = 138,
    testId,
}) {
    const canvasRef = useRef(null);
    const visibleRef = useRef(true);

    const draw = useCallback((progress) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !image) return;
        const { width: w, height: h } = canvas;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        applyImageMotionTransform(ctx, motion, progress, w, h);
        ctx.drawImage(image, 0, 0, w, h);
        ctx.restore();
    }, [image, motion]);

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

        if (prefersReducedMotion()) {
            // Mi-course: on montre le mouvement sans le jouer.
            draw(0.5);
            return undefined;
        }

        draw(0);
        return subscribeToPreviewTicker((elapsed) => {
            if (!visibleRef.current) return;
            const span = Math.max(0.6, Number(cycleSeconds) || 3);
            // Aller, tenue, retour: sans la tenue, un zoom avant enchainerait
            // directement sur son zoom arriere et se lirait comme un battement.
            const cycle = span * 2 + HOLD_SECONDS * 2;
            const phase = elapsed % cycle;
            if (phase < span) draw(phase / span);
            else if (phase < span + HOLD_SECONDS) draw(1);
            else if (phase < span * 2 + HOLD_SECONDS) draw(1 - (phase - span - HOLD_SECONDS) / span);
            else draw(0);
        });
    }, [cycleSeconds, draw, image]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={styles.previewCanvas}
            data-testid={testId}
            data-motion={motion?.preset || 'none'}
            aria-hidden="true"
        />
    );
}
