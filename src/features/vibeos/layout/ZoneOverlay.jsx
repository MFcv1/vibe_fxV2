"use client";

import React, { useCallback, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import styles from './layout.module.css';

/*
 * Editeur de zones du modele personnalise, pose EXACTEMENT sur l'apercu.
 *
 * Les zones sont exprimees en fractions (0-1) de la zone utile du canvas
 * (canvas moins la marge `padding`), c'est la convention du moteur
 * `renderLayoutSlots`. On refait ici la meme conversion pour placer les
 * poignees HTML au bon endroit: aucune duplication de rendu, juste de la
 * geometrie d'interface.
 */

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export default function ZoneOverlay({
    zones, selectedZoneId, canvasWidth, canvasHeight, padding,
    onSelect, onUpdate, onDelete,
}) {
    const dragRef = useRef(null);

    const safeW = Math.max(1, canvasWidth - padding * 2);
    const safeH = Math.max(1, canvasHeight - padding * 2);
    const toPercent = (zone) => ({
        left: `${((padding + zone.x * safeW) / canvasWidth) * 100}%`,
        top: `${((padding + zone.y * safeH) / canvasHeight) * 100}%`,
        width: `${((zone.w * safeW) / canvasWidth) * 100}%`,
        height: `${((zone.h * safeH) / canvasHeight) * 100}%`,
    });

    /* Un seul gestionnaire pour deplacer et redimensionner: on capture le
       pointeur, on convertit les pixels ecran en fractions de zone utile. */
    const startGesture = useCallback((event, zone, mode) => {
        event.preventDefault();
        event.stopPropagation();
        const host = event.currentTarget.closest(`.${styles.zoneLayer}`);
        if (!host) return;
        const rect = host.getBoundingClientRect();
        /* Echelle ecran -> fraction: la couche fait la taille du canvas affiche,
           dont la zone utile represente safeW/canvasWidth. */
        const unitX = (rect.width * safeW) / canvasWidth;
        const unitY = (rect.height * safeH) / canvasHeight;
        dragRef.current = {
            mode,
            zoneId: zone.id,
            startX: event.clientX,
            startY: event.clientY,
            origin: { x: zone.x, y: zone.y, w: zone.w, h: zone.h },
            unitX: unitX || 1,
            unitY: unitY || 1,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        onSelect?.(zone.id);
    }, [canvasHeight, canvasWidth, onSelect, safeH, safeW]);

    const moveGesture = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = (event.clientX - drag.startX) / drag.unitX;
        const dy = (event.clientY - drag.startY) / drag.unitY;
        if (drag.mode === 'move') {
            onUpdate?.(drag.zoneId, {
                x: clamp01(drag.origin.x + dx),
                y: clamp01(drag.origin.y + dy),
            });
        } else {
            onUpdate?.(drag.zoneId, {
                w: clamp01(drag.origin.w + dx),
                h: clamp01(drag.origin.h + dy),
            });
        }
    }, [onUpdate]);

    const endGesture = useCallback((event) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    }, []);

    return (
        <div className={styles.zoneLayer} data-testid="vibeos-zone-layer">
            {zones.filter((zone) => !zone.hidden).map((zone, index) => {
                const isSelected = zone.id === selectedZoneId;
                return (
                    <div
                        key={zone.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Zone ${index + 1}${isSelected ? ' (sélectionnée)' : ''}`}
                        className={`${styles.zoneBox}${isSelected ? ` ${styles.zoneBoxActive}` : ''}`}
                        style={toPercent(zone)}
                        onPointerDown={(event) => startGesture(event, zone, 'move')}
                        onPointerMove={moveGesture}
                        onPointerUp={endGesture}
                        onPointerCancel={endGesture}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onSelect?.(zone.id);
                            }
                        }}
                    >
                        <span className={styles.zoneName}>{zone.label || `Zone ${index + 1}`}</span>
                        <button
                            type="button"
                            className={styles.zoneDelete}
                            aria-label={`Supprimer la zone ${index + 1}`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                onDelete?.(zone.id);
                            }}
                        >
                            <Trash2 size={11} />
                        </button>
                        <span
                            className={styles.zoneHandle}
                            role="presentation"
                            onPointerDown={(event) => startGesture(event, zone, 'resize')}
                            onPointerMove={moveGesture}
                            onPointerUp={endGesture}
                            onPointerCancel={endGesture}
                        />
                    </div>
                );
            })}
        </div>
    );
}
