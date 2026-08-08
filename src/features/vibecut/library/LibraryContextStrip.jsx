"use client";

import React from 'react';
import { ArrowRight } from 'lucide-react';
import styles from './library.module.css';

/*
 * La bande de contexte - lot B1.
 *
 * Elle repond a une question que la bibliotheque posait sans y repondre: OU est-ce
 * que ca s'applique ? Sans elle, « Appliquer a cette coupe » est une action
 * abstraite - on ne sait pas de quelle coupe on parle, et on decouvre le resultat
 * une fois revenu dans le montage.
 *
 * Elle est volontairement muette sur le reste: pas de reglage, pas d'action. Elle
 * situe, elle ne commande pas.
 */

function Slot({ item, testId }) {
    if (!item) return null;
    return (
        <span className={styles.contextSlot} data-testid={testId}>
            {item.thumbnail ? (
                <img className={styles.contextThumb} src={item.thumbnail} alt="" />
            ) : (
                <span className={styles.contextThumb} aria-hidden="true" />
            )}
            <span className={styles.contextName}>{item.name}</span>
        </span>
    );
}

export default function LibraryContextStrip({
    label,
    left,
    center,
    right = null,
    testId = 'vibecut-library-context',
}) {
    return (
        <div className={styles.context} data-testid={testId}>
            <p className={styles.contextLabel}>{label}</p>
            <div className={styles.contextRow}>
                <Slot item={left} testId={`${testId}-left`} />
                <ArrowRight size={13} className={styles.contextArrow} aria-hidden="true" />
                <span className={styles.contextHere} data-testid={`${testId}-here`}>{center}</span>
                {right ? (
                    <>
                        <ArrowRight size={13} className={styles.contextArrow} aria-hidden="true" />
                        <Slot item={right} testId={`${testId}-right`} />
                    </>
                ) : null}
            </div>
        </div>
    );
}
