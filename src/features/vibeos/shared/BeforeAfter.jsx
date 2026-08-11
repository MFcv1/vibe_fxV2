"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './beforeAfter.module.css';

/*
 * Avant / apres - la vraie interface de comparaison.
 *
 * L'ancienne version (maintenir un bouton pour remplacer le canvas par l'image
 * d'origine) avait trois defauts de fond, corriges ici :
 *   - le bouton perdait l'appui des que le curseur en sortait, donc l'apercu
 *     restait bloque sur "avant";
 *   - `display: none` sur le canvas provoquait un saut de mise en page a chaque
 *     appui, d'ou l'effet de clignotement;
 *   - on ne pouvait comparer qu'en tout-ou-rien, jamais une zone precise.
 *
 * Ici, l'original est superpose au rendu, EXACTEMENT au meme endroit, et revele
 * par un `clip-path`. Rien n'est demonte, rien ne saute.
 *
 * Trois modes :
 *   - `slider`  : rideau deplacable a la souris, au doigt ou aux fleches;
 *   - `split`   : les deux images cote a cote, pour juger la couleur globale;
 *   - `hold`    : appui maintenu n'importe ou sur la photo = original.
 *
 * Pendant un glissement, la position est ecrite directement sur le noeud DOM
 * (variable CSS), sans passer par React: c'est ce qui rend le rideau fluide
 * meme sur une photo de 8000 px.
 */

export const COMPARE_MODES = [
    { value: 'slider', label: 'Rideau' },
    { value: 'split', label: 'Côte à côte' },
    { value: 'hold', label: 'Maintien' },
];

const clamp = (value) => Math.max(0, Math.min(100, value));

export default function BeforeAfter({
    beforeSrc,
    /* Rapport largeur/hauteur de la photo. Sans lui, le cadre ne serait borne
       que par la largeur disponible : une photo verticale s'etalerait sur toute
       la scene et deborderait en hauteur (elle avait l'air « passee en
       paysage »). Avec lui, le cadre epouse exactement la photo, et l'original
       superpose tombe au pixel pres. */
    ratio = null,
    mode = 'slider',
    active = true,
    defaultPosition = 50,
    beforeLabel = 'Avant',
    afterLabel = 'Après',
    children,
    testId = 'vibeos-before-after',
}) {
    const stackRef = useRef(null);
    const draggingRef = useRef(false);
    const positionRef = useRef(defaultPosition);
    const [position, setPosition] = useState(defaultPosition);
    const [holding, setHolding] = useState(false);

    /* Ecriture directe: aucune passe de rendu React pendant le geste. */
    const write = useCallback((next) => {
        positionRef.current = next;
        if (stackRef.current) {
            stackRef.current.style.setProperty('--ba-position', `${next}%`);
        }
    }, []);

    useEffect(() => {
        write(positionRef.current);
    }, [write, mode, active]);

    const positionFromEvent = useCallback((event) => {
        const rect = stackRef.current?.getBoundingClientRect();
        if (!rect?.width) return positionRef.current;
        return clamp(((event.clientX - rect.left) / rect.width) * 100);
    }, []);

    const onPointerDown = (event) => {
        if (!active) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (mode === 'hold') {
            setHolding(true);
            return;
        }
        if (mode !== 'slider') return;
        draggingRef.current = true;
        write(positionFromEvent(event));
    };

    const onPointerMove = (event) => {
        if (!draggingRef.current) return;
        write(positionFromEvent(event));
    };

    const endGesture = () => {
        setHolding(false);
        if (!draggingRef.current) return;
        draggingRef.current = false;
        /* On ne resynchronise React qu'a la fin du geste. */
        setPosition(positionRef.current);
    };

    const onKeyDown = (event) => {
        if (mode !== 'slider') return;
        const step = event.shiftKey ? 10 : 2;
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            const next = clamp(positionRef.current - step);
            write(next);
            setPosition(next);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            const next = clamp(positionRef.current + step);
            write(next);
            setPosition(next);
        }
    };

    /* Un appui interrompu hors de la fenetre (Cmd+Tab, alerte du navigateur) ne
       doit jamais laisser la comparaison bloquee sur "avant". */
    useEffect(() => {
        const release = () => {
            draggingRef.current = false;
            setHolding(false);
        };
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        window.addEventListener('blur', release);
        return () => {
            window.removeEventListener('pointerup', release);
            window.removeEventListener('pointercancel', release);
            window.removeEventListener('blur', release);
        };
    }, []);

    const showBefore = active && beforeSrc && (mode !== 'hold' || holding);
    const effectiveMode = !active ? 'off' : mode;

    return (
        <div
            ref={stackRef}
            className={styles.stack}
            data-mode={effectiveMode}
            data-holding={holding ? 'true' : 'false'}
            data-testid={testId}
            style={{
                '--ba-position': `${position}%`,
                '--ba-ratio': ratio && Number.isFinite(ratio) ? String(ratio) : 'auto',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onDoubleClick={() => { write(50); setPosition(50); }}
        >
            {/* Le rendu courant: passe tel quel par l'ecran appelant (canvas). */}
            <div className={styles.after}>{children}</div>

            {showBefore ? (
                <img
                    src={beforeSrc}
                    alt="Photo d'origine"
                    className={styles.before}
                    draggable={false}
                    data-testid={`${testId}-before`}
                />
            ) : null}

            {active && mode === 'slider' && beforeSrc ? (
                <div
                    className={styles.handle}
                    role="slider"
                    tabIndex={0}
                    aria-label="Position du rideau avant/après"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(position)}
                    onKeyDown={onKeyDown}
                >
                    <span className={styles.handleLine} />
                    <span className={styles.handleGrip} aria-hidden="true">
                        <span /><span />
                    </span>
                </div>
            ) : null}

            {active && beforeSrc && mode !== 'hold' ? (
                <>
                    <span className={`${styles.tag} ${styles.tagBefore}`}>{beforeLabel}</span>
                    <span className={`${styles.tag} ${styles.tagAfter}`}>{afterLabel}</span>
                </>
            ) : null}

            {active && mode === 'hold' && beforeSrc ? (
                <span className={styles.holdHint}>
                    {holding ? beforeLabel : 'Maintiens le clic pour voir l’original'}
                </span>
            ) : null}
        </div>
    );
}
