'use client';

import React from 'react';
import { Images } from 'lucide-react';
import styles from './layout.module.css';

/*
 * Colonne gauche de l'apercu immersif: les images du post, dans l'ordre ou
 * Instagram les fera defiler. Cliquer une vignette amene l'iPhone du centre
 * sur cette image.
 *
 * Ce que cette colonne NE fait pas encore: cocher/decocher une image et
 * reordonner. Tant qu'un post = un seul rendu decoupe en tranches (pano-2,
 * pano-3), masquer ou deplacer une tranche produirait un post casse. Ces deux
 * controles arrivent avec le modele multi-grilles, ou chaque vignette est une
 * grille autonome.
 */
export default function PostImagesRail({ items = [], activeIndex = 0, onSelect }) {
    if (!items.length) return null;

    return (
        <aside className={styles.postRail} aria-label="Images du post">
            <p className={styles.postRailHead}>
                <Images size={13} aria-hidden="true" />
                {items.length} image{items.length > 1 ? 's' : ''}
            </p>
            <ol className={styles.postRailList}>
                {items.map((item, index) => (
                    <li key={item.id || index}>
                        <button
                            type="button"
                            className={styles.postRailItem}
                            data-active={index === activeIndex}
                            aria-current={index === activeIndex ? 'true' : undefined}
                            onClick={() => onSelect?.(index)}
                        >
                            <span className={styles.postRailIndex} data-numeric>{index + 1}</span>
                            <span className={styles.postRailThumb}>
                                {item.preview ? <img src={item.preview} alt="" /> : null}
                            </span>
                        </button>
                    </li>
                ))}
            </ol>
        </aside>
    );
}
