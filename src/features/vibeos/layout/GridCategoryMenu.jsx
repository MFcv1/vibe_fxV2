"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import styles from './layout.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

/*
 * Selecteur de famille de grilles, dans le panneau.
 *
 * Il remplace le titre fixe: le panneau montre les grilles de la famille
 * choisie, sans passer par la bibliotheque. C'est la vue de travail; la
 * bibliotheque reste la vue de decouverte (apercus 4:5 + 1:1 et recherche).
 */
export default function GridCategoryMenu({ categories, value, onChange }) {
    const [open, setOpen] = useState(false);
    const hostRef = useRef(null);
    const active = categories.find((category) => category.id === value) || categories[0];

    useEffect(() => {
        if (!open) return undefined;
        const closeOnOutside = (event) => {
            if (!hostRef.current?.contains(event.target)) setOpen(false);
        };
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        window.addEventListener('pointerdown', closeOnOutside);
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            window.removeEventListener('pointerdown', closeOnOutside);
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    return (
        <div className={styles.gridCategoryMenu} ref={hostRef}>
            <button
                type="button"
                className={styles.gridCategoryButton}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                data-testid="vibeos-grid-category"
            >
                {/* Le compte reste dans le menu deroulant: dans un panneau de
                    230px, la pastille mangeait le nom de la famille. */}
                <span>{active.label}</span>
                <ChevronDown size={13} className={cx(styles.gridCategoryChevron, open && styles.gridCategoryChevronOpen)} />
            </button>
            {open ? (
                <div className={styles.gridCategoryList} role="listbox" aria-label="Famille de grilles">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            role="option"
                            aria-selected={category.id === value}
                            className={cx(
                                styles.gridCategoryOption,
                                category.id === value && styles.gridCategoryOptionActive,
                            )}
                            onClick={() => {
                                onChange(category.id);
                                setOpen(false);
                            }}
                        >
                            {category.label}
                            {category.id === value ? <Check size={13} /> : null}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
