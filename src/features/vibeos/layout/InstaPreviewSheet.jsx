"use client";

import React, { useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react';
import { Sheet } from '../primitives';
import styles from './layout.module.css';

/*
 * Apercu Instagram: le visuel exporte, replace dans un vrai contexte de feed
 * (post, story ou carrousel panorama). Purement visuel - aucune donnee reelle,
 * aucun compte, c'est une maquette de verification avant publication.
 */

export default function InstaPreviewSheet({ open, onClose, previewUrl, format }) {
    const [slide, setSlide] = useState(0);

    if (!open) return null;

    const isStory = format?.id === 'story';
    const panoSlices = format?.id === 'pano-3' ? 3 : (format?.id === 'pano-2' ? 2 : 0);
    const ratio = format?.ratio || 1;

    return (
        <Sheet open={open} onClose={onClose} title="Aperçu Instagram">
            <p className={styles.sheetIntro}>
                Ce que verront les gens dans leur fil. {panoSlices
                    ? 'Ton panorama est découpé en carrousel, fais défiler.'
                    : 'Vérifie que rien d’important ne tombe dans les bords.'}
            </p>

            <div className={styles.phone}>
                <div className={styles.phoneScreen}>
                    {isStory ? (
                        <div className={styles.storyView}>
                            {previewUrl ? <img src={previewUrl} alt="Aperçu de la story" /> : null}
                            <div className={styles.storyBar}><span /></div>
                            <div className={styles.storyFoot}>Envoyer un message</div>
                        </div>
                    ) : (
                        <div className={styles.postView}>
                            <div className={styles.postHead}>
                                <span className={styles.postAvatar} aria-hidden="true" />
                                <span className={styles.postAuthor}>ton_compte</span>
                                <MoreHorizontal size={16} className={styles.postMore} />
                            </div>
                            <div
                                className={styles.postMedia}
                                style={{ aspectRatio: panoSlices ? '4 / 5' : String(ratio) }}
                            >
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt="Aperçu de la publication"
                                        style={panoSlices ? {
                                            width: `${panoSlices * 100}%`,
                                            transform: `translateX(${-slide * (100 / panoSlices)}%)`,
                                        } : undefined}
                                        className={panoSlices ? styles.postMediaPano : undefined}
                                    />
                                ) : null}
                                {panoSlices && slide > 0 ? (
                                    <button
                                        type="button"
                                        className={`${styles.panoNav} ${styles.panoNavPrev}`}
                                        aria-label="Image précédente"
                                        onClick={() => setSlide((current) => current - 1)}
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                ) : null}
                                {panoSlices && slide < panoSlices - 1 ? (
                                    <button
                                        type="button"
                                        className={`${styles.panoNav} ${styles.panoNavNext}`}
                                        aria-label="Image suivante"
                                        onClick={() => setSlide((current) => current + 1)}
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                ) : null}
                            </div>
                            <div className={styles.postActions}>
                                <Heart size={18} />
                                <MessageCircle size={18} />
                                <Send size={18} />
                                {panoSlices ? (
                                    <span className={styles.panoDots}>
                                        {Array.from({ length: panoSlices }, (_, index) => (
                                            <span key={index} data-active={index === slide ? 'true' : 'false'} />
                                        ))}
                                    </span>
                                ) : null}
                                <Bookmark size={18} className={styles.postSave} />
                            </div>
                            <p className={styles.postCaption}>
                                <strong>ton_compte</strong> Ta légende apparaîtra ici.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Sheet>
    );
}
