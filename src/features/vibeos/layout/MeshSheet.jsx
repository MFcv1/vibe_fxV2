"use client";

import React, { useState } from 'react';
import { Shuffle, Check, Trash2 } from 'lucide-react';
import { Button, Sheet } from '../primitives';
import styles from './layout.module.css';

/*
 * Fond Mesh gradient. Le rendu FINAL est fait par le moteur canvas existant
 * (renderLayoutMeshBackground) — ce sheet ne fait que choisir les 4 couleurs,
 * comme l'ancien Mesh Studio dont on reprend les palettes.
 */

const PRESET_PALETTES = [
    { name: 'Braise de minuit', colors: ['#f12711', '#f5af19', '#ff4b1f', '#0a0a0a'] },
    { name: 'Aurore boréale', colors: ['#10b981', '#3b82f6', '#06b6d4', '#171717'] },
    { name: 'Cyber rose', colors: ['#ec4899', '#8b5cf6', '#3b82f6', '#0a0a0a'] },
    { name: 'Espace profond', colors: ['#0f2027', '#203a43', '#2c5364', '#050505'] },
    { name: 'Sable chaud', colors: ['#e8b339', '#c2703d', '#8a4f2d', '#141210'] },
    { name: 'Menthe fraîche', colors: ['#3ecf8e', '#7ce7c4', '#1c7a56', '#0b0f0d'] },
];

function meshPreviewStyle(colors) {
    return {
        background: `radial-gradient(65% 80% at 22% 25%, ${colors[1]} 0%, transparent 70%),`
            + `radial-gradient(60% 75% at 80% 30%, ${colors[2]} 0%, transparent 70%),`
            + `radial-gradient(75% 85% at 55% 88%, ${colors[3]} 0%, transparent 72%),`
            + `${colors[0]}`,
    };
}

export default function MeshSheet({ open, onClose, initialColors, isActive, onApply, onRemove }) {
    const [colors, setColors] = useState(initialColors || PRESET_PALETTES[0].colors);

    const setColorAt = (index, value) => {
        setColors((prev) => prev.map((c, i) => (i === index ? value : c)));
    };

    const shuffle = () => {
        setColors((prev) => [...prev].sort(() => Math.random() - 0.5));
    };

    return (
        <Sheet open={open} onClose={onClose} title="Fond Mesh gradient">
            <div className={styles.meshPreview} style={meshPreviewStyle(colors)} aria-hidden="true" />

            <div className={styles.rowSplit}>
                <span className={styles.rowLabel}>Couleurs</span>
                <span style={{ display: 'inline-flex', gap: 8 }}>
                    {colors.map((color, index) => (
                        <input
                            key={index}
                            type="color"
                            className={styles.colorInput}
                            value={color}
                            aria-label={`Couleur ${index + 1}`}
                            onChange={(event) => setColorAt(index, event.target.value)}
                        />
                    ))}
                </span>
            </div>
            <Button variant="ghost" size="sm" icon={<Shuffle size={13} />} onClick={shuffle}>
                Mélanger les couleurs
            </Button>

            <div className={styles.paletteList} aria-label="Palettes prêtes">
                {PRESET_PALETTES.map((palette) => (
                    <button
                        key={palette.name}
                        type="button"
                        className={styles.paletteRow}
                        onClick={() => setColors(palette.colors)}
                    >
                        <span className={styles.paletteSwatches}>
                            {palette.colors.map((color) => (
                                <span key={color} style={{ background: color }} />
                            ))}
                        </span>
                        {palette.name}
                    </button>
                ))}
            </div>

            <Button variant="primary" size="lg" block icon={<Check size={15} />} onClick={() => { onApply(colors); onClose(); }}>
                Utiliser comme fond
            </Button>
            {isActive ? (
                <Button variant="danger" block icon={<Trash2 size={14} />} onClick={() => { onRemove(); onClose(); }}>
                    Retirer le fond Mesh
                </Button>
            ) : null}
        </Sheet>
    );
}
