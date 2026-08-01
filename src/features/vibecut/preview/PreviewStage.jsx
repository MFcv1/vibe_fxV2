"use client";

import React, { useCallback } from 'react';
import { usePreviewStageMount } from './PreviewEngineHost';
import styles from './preview.module.css';

/*
 * Emplacement d'apercu.
 *
 * Depuis la phase 4, ce composant ne cree plus rien: il declare seulement OU le
 * canvas unique du layout doit venir se poser. Le `PlaybackEngine` vit au-dessus
 * des routes (`PreviewEngineHost`), donc changer de mode ne recharge plus les
 * medias.
 */

export default function PreviewStage({ className }) {
    const mount = usePreviewStageMount();
    const setMountNode = mount?.setMountNode;

    const attach = useCallback((node) => {
        setMountNode?.(node);
    }, [setMountNode]);

    return (
        <div
            ref={attach}
            className={`${styles.stage} ${className || ''}`}
            data-testid="vibecut-preview-stage"
        />
    );
}
