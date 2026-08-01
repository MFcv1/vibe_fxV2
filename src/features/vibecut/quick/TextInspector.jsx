"use client";

import React from 'react';
import { Bold, Italic, Trash2 } from 'lucide-react';
import { Button } from '../primitives';
import styles from './quick.module.css';

/*
 * Inspecteur de texte: simple mais complet.
 * Contenu, taille, couleur, style, position en 9 points, animations et duree.
 * Le positionnement fin se fait a la souris sur l'apercu, avec magnetisme sur le
 * centre et la regle des tiers.
 */

const COLORS = ['#ffffff', '#0b0b0d', '#ffd166', '#ff6b6b', '#5b7cfa', '#3ecf8e'];

const POSITIONS = [
    { id: 'tl', x: 0.2, y: 0.16, label: 'Haut gauche' },
    { id: 'tc', x: 0.5, y: 0.16, label: 'Haut centre' },
    { id: 'tr', x: 0.8, y: 0.16, label: 'Haut droite' },
    { id: 'ml', x: 0.2, y: 0.5, label: 'Milieu gauche' },
    { id: 'mc', x: 0.5, y: 0.5, label: 'Centre' },
    { id: 'mr', x: 0.8, y: 0.5, label: 'Milieu droite' },
    { id: 'bl', x: 0.2, y: 0.84, label: 'Bas gauche' },
    { id: 'bc', x: 0.5, y: 0.84, label: 'Bas centre' },
    { id: 'br', x: 0.8, y: 0.84, label: 'Bas droite' },
];

const ANIMATIONS = [
    { value: 'none', label: 'Aucune' },
    { value: 'fade', label: 'Fondu' },
    { value: 'slide-up', label: 'Glissement' },
    { value: 'scale', label: 'Zoom' },
    { value: 'typewriter', label: 'Machine à écrire' },
    { value: 'blur-in', label: 'Flou' },
];

export default function TextInspector({ text, totalDuration, actions }) {
    const duration = Math.max(0.3, (text.endTime || 0) - (text.startTime || 0));
    const activePosition = POSITIONS.find((position) => (
        Math.abs(position.x - (text.x ?? 0.5)) < 0.03 && Math.abs(position.y - (text.y ?? 0.5)) < 0.03
    ));

    const update = (patch) => actions.updateText(text.id, patch, { history: true });

    return (
        <div className={styles.textPanel} data-testid="vibecut-text-inspector">
            <div className={styles.group}>
                <div className={styles.groupHead}>
                    <h2 className={styles.groupTitle}>Texte</h2>
                    <span className={styles.groupValue}>Déplace-le sur l’aperçu</span>
                </div>
                <textarea
                    className={styles.textArea}
                    value={text.content || ''}
                    rows={2}
                    onChange={(event) => actions.updateText(text.id, { content: event.target.value })}
                    placeholder="Ton texte (Entrée pour aller à la ligne)"
                    aria-label="Contenu du texte"
                    data-testid="vibecut-text-content"
                />
            </div>

            <div className={styles.group}>
                <div className={styles.groupHead}>
                    <h3 className={styles.groupTitle}>Taille</h3>
                    <span className={styles.groupValue} data-numeric="true">{Math.round(text.fontSize || 48)}</span>
                </div>
                <input
                    type="range"
                    className={styles.slider}
                    min={20}
                    max={160}
                    step={2}
                    value={Math.round(text.fontSize || 48)}
                    onChange={(event) => update({ fontSize: Number(event.target.value) })}
                    aria-label="Taille du texte"
                    data-testid="vibecut-text-size"
                />
                <div className={styles.inlineRow}>
                    <button
                        type="button"
                        aria-pressed={Boolean(text.bold)}
                        onClick={() => update({ bold: !text.bold })}
                        className={[styles.toggleButton, text.bold ? styles.toggleButtonActive : ''].filter(Boolean).join(' ')}
                        title="Gras"
                        aria-label="Gras"
                        data-testid="vibecut-text-bold"
                    >
                        <Bold size={15} />
                    </button>
                    <button
                        type="button"
                        aria-pressed={Boolean(text.italic)}
                        onClick={() => update({ italic: !text.italic })}
                        className={[styles.toggleButton, text.italic ? styles.toggleButtonActive : ''].filter(Boolean).join(' ')}
                        title="Italique"
                        aria-label="Italique"
                        data-testid="vibecut-text-italic"
                    >
                        <Italic size={15} />
                    </button>
                </div>
            </div>

            <div className={styles.group}>
                <h3 className={styles.groupTitle}>Couleur</h3>
                <div className={styles.swatchRow}>
                    {COLORS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            aria-label={`Couleur ${color}`}
                            aria-pressed={(text.color || '#ffffff').toLowerCase() === color}
                            onClick={() => update({ color })}
                            className={[
                                styles.swatch,
                                (text.color || '#ffffff').toLowerCase() === color ? styles.swatchActive : '',
                            ].filter(Boolean).join(' ')}
                            style={{ background: color }}
                            data-testid={`vibecut-text-color-${color.replace('#', '')}`}
                        />
                    ))}
                    <label className={styles.swatchCustom} title="Couleur personnalisée">
                        <input
                            type="color"
                            value={text.color || '#ffffff'}
                            onChange={(event) => update({ color: event.target.value })}
                            aria-label="Couleur personnalisée"
                        />
                    </label>
                </div>
            </div>

            <div className={styles.group}>
                <h3 className={styles.groupTitle}>Lisibilité</h3>
                <div className={styles.inlineRow}>
                    {[
                        { id: 'none', label: 'Aucun' },
                        { id: 'box', label: 'Bloc' },
                        { id: 'outline', label: 'Contour' },
                    ].map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={(text.boxStyle || 'none') === option.id}
                            onClick={() => update({ boxStyle: option.id })}
                            className={[
                                styles.chip,
                                (text.boxStyle || 'none') === option.id ? styles.chipActive : '',
                            ].filter(Boolean).join(' ')}
                            data-testid={`vibecut-text-box-${option.id}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {(text.boxStyle || 'none') !== 'none' ? (
                    <div className={styles.swatchRow}>
                        {['#000000', '#ffffff', '#5b7cfa', '#ff6b6b'].map((color) => (
                            <button
                                key={color}
                                type="button"
                                aria-label={`Couleur du fond ${color}`}
                                aria-pressed={(text.boxColor || '#000000').toLowerCase() === color}
                                onClick={() => update({ boxColor: color })}
                                className={[
                                    styles.swatch,
                                    (text.boxColor || '#000000').toLowerCase() === color ? styles.swatchActive : '',
                                ].filter(Boolean).join(' ')}
                                style={{ background: color }}
                                data-testid={`vibecut-text-boxcolor-${color.replace('#', '')}`}
                            />
                        ))}
                    </div>
                ) : null}
            </div>

            <div className={styles.group}>
                <h3 className={styles.groupTitle}>Position</h3>
                <div className={styles.positionGrid} role="group" aria-label="Position du texte">
                    {POSITIONS.map((position) => (
                        <button
                            key={position.id}
                            type="button"
                            title={position.label}
                            aria-label={position.label}
                            aria-pressed={activePosition?.id === position.id}
                            onClick={() => update({ x: position.x, y: position.y })}
                            className={[
                                styles.positionCell,
                                activePosition?.id === position.id ? styles.positionCellActive : '',
                            ].filter(Boolean).join(' ')}
                            data-testid={`vibecut-text-position-${position.id}`}
                        />
                    ))}
                </div>
                <p className={styles.groupNote}>
                    Sur l’aperçu, le texte s’aimante au centre et aux lignes des tiers.
                </p>
            </div>

            <div className={styles.group}>
                <div className={styles.groupHead}>
                    <h3 className={styles.groupTitle}>Durée d’affichage</h3>
                    <span className={styles.groupValue} data-numeric="true">{duration.toFixed(1)} s</span>
                </div>
                <input
                    type="range"
                    className={styles.slider}
                    min={0.5}
                    max={Math.max(1, Math.min(15, totalDuration - (text.startTime || 0)))}
                    step={0.1}
                    value={Number(duration.toFixed(1))}
                    onChange={(event) => update({ endTime: (text.startTime || 0) + Number(event.target.value) })}
                    aria-label="Durée d'affichage du texte"
                    data-testid="vibecut-text-duration"
                />
            </div>

            <div className={styles.group}>
                <h3 className={styles.groupTitle}>Animation</h3>
                <div className={styles.inlineRow}>
                    <label className={styles.fieldLabel}>
                        Entrée
                        <select
                            className={styles.select}
                            value={text.animation || 'fade'}
                            onChange={(event) => update({ animation: event.target.value })}
                            data-testid="vibecut-text-animation-in"
                        >
                            {ANIMATIONS.map((animation) => (
                                <option key={animation.value} value={animation.value}>{animation.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.fieldLabel}>
                        Sortie
                        <select
                            className={styles.select}
                            value={text.animationOut || 'fade'}
                            onChange={(event) => update({ animationOut: event.target.value })}
                            data-testid="vibecut-text-animation-out"
                        >
                            {ANIMATIONS.filter((animation) => animation.value !== 'typewriter').map((animation) => (
                                <option key={animation.value} value={animation.value}>{animation.label}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <Button
                variant="danger"
                block
                icon={<Trash2 size={16} />}
                onClick={() => actions.removeText(text.id)}
                data-testid="vibecut-text-remove"
            >
                Supprimer ce texte
            </Button>
        </div>
    );
}
