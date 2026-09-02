"use client";

import React from 'react';
import { Sheet } from '../primitives';
import InstagramPublicationPreview, { InstagramStoryPreview } from './InstagramPublicationPreview';
import styles from './layout.module.css';

export default function InstaPreviewSheet({ open, onClose, slides = [], format, loading = false, error = '' }) {
    if (!open) return null;
    const isStory = format?.id === 'story';
    const sliceCount = format?.id === 'pano-3' ? 3 : (format?.id === 'pano-2' ? 2 : 1);
    const galleryItems = slides.map((slide, index) => ({
        id: `${format?.id || 'format'}-${slide.index ?? index}`,
        preview: slide.url,
        width: slide.width,
        height: slide.height,
    }));

    return (
        <Sheet open={open} onClose={onClose} title="Aperçu Instagram" wide>
            <div className={styles.previewAuditHead}>
                <div><strong>{format?.label || 'Format Instagram'}</strong><span>{format?.w || 0}×{format?.h || 0} px</span></div>
                <span className={styles.previewReady}>{sliceCount > 1 ? `${sliceCount} slides 4:5` : (isStory ? 'Story 9:16' : 'Feed compatible')}</span>
            </div>
            <p className={styles.sheetIntro}>{sliceCount > 1 ? 'Fais glisser l’image dans l’iPhone : ce sont les vraies tranches JPEG qui seront publiées.' : 'Le rendu pleine définition est replacé dans la preview iPhone de Seconde Vie.'}</p>
            {loading ? <div className={styles.previewState}>Préparation du rendu Instagram…</div> : null}
            {error ? <div className={`${styles.previewState} ${styles.previewStateError}`}>{error}</div> : null}
            {!loading && !error && galleryItems.length ? (
                <div className={styles.referencePhoneStage}>
                    {isStory
                        ? <InstagramStoryPreview item={galleryItems[0]} expanded />
                        : <InstagramPublicationPreview key={`${format?.id}-${galleryItems.length}`} galleryItems={galleryItems} name="Ton visuel VibeFX" expanded />}
                </div>
            ) : null}
        </Sheet>
    );
}
