"use client";

import React from 'react';
import { Shuffle, Trash2 } from 'lucide-react';
import {
    SMOOTH_BLUR_LOOK_PRESETS,
    createDisabledSmoothBlurConfig,
    createRandomSmoothBlurConfig,
    normalizeSmoothBlurConfig,
} from '../../vibefx-shared/utils/smoothBlur';
import { Button, Segmented, Sheet, Slider } from '../primitives';
import styles from './layout.module.css';

/*
 * Flou lisse pro. Toute la science (limites, courbes, random safe) vit dans le
 * moteur partage vibefx-shared/utils/smoothBlur — ce sheet ne fait que piloter
 * la config; le rendu passe par le pipeline canvas existant.
 */

const DIRECTION_OPTIONS = [
    { value: 'down', label: 'Bas' },
    { value: 'up', label: 'Haut' },
    { value: 'left', label: 'Gauche' },
    { value: 'right', label: 'Droite' },
];

export default function SmoothBlurSheet({ open, onClose, config, onChange }) {
    const current = normalizeSmoothBlurConfig(config || {});

    const update = (patch) => {
        onChange(normalizeSmoothBlurConfig({ ...current, ...patch, enabled: true }));
    };

    return (
        <Sheet open={open} onClose={onClose} title="Flou pro">
            <p className={styles.sheetIntro}>
                Un dégradé de flou progressif, idéal pour poser une légende ou adoucir un bord.
            </p>

            <div className={styles.blockHead}>
                <h3 className={styles.blockTitle}>Looks rapides</h3>
            </div>
            <div className={styles.lookList}>
                {SMOOTH_BLUR_LOOK_PRESETS.map((look) => (
                    <button
                        key={look.id}
                        type="button"
                        className={styles.lookRow}
                        onClick={() => onChange(normalizeSmoothBlurConfig({ ...look.config, enabled: true }))}
                    >
                        <span className={styles.lookLabel}>{look.label}</span>
                        <span className={styles.lookDesc}>{look.description}</span>
                    </button>
                ))}
            </div>
            <Button
                variant="ghost"
                size="sm"
                icon={<Shuffle size={13} />}
                onClick={() => onChange(normalizeSmoothBlurConfig({ ...createRandomSmoothBlurConfig(), enabled: true }))}
            >
                Aléatoire (toujours propre)
            </Button>

            <div className={styles.rowSplit}>
                <span className={styles.rowLabel}>Direction</span>
                <Segmented
                    label="Direction du flou"
                    value={current.direction}
                    onChange={(value) => update({ direction: value })}
                    options={DIRECTION_OPTIONS}
                />
            </div>
            <Slider label="Hauteur de la zone" value={current.height} onChange={(v) => update({ height: v })} min={10} max={100} defaultValue={54} formatValue={(v) => `${v}%`} />
            <Slider label="Intensité du flou" value={current.blur} onChange={(v) => update({ blur: v })} min={4} max={120} defaultValue={64} formatValue={(v) => `${v}px`} />
            <Slider label="Finesse du dégradé" value={current.precision} onChange={(v) => update({ precision: v })} min={5} max={30} defaultValue={18} formatValue={(v) => `${v}`} />

            {current.enabled ? (
                <Button
                    variant="danger"
                    block
                    icon={<Trash2 size={14} />}
                    onClick={() => { onChange(createDisabledSmoothBlurConfig()); onClose(); }}
                >
                    Désactiver le flou pro
                </Button>
            ) : null}
        </Sheet>
    );
}
