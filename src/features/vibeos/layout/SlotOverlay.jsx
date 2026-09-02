"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, ImagePlus, Maximize, Minus, Plus, Trash2 } from 'lucide-react';
import styles from './layout.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

/*
 * Couche posee EXACTEMENT sur l'apercu, une boite par case de la mise en page.
 *
 * Ce qu'on y fait:
 * - case vide: « Importer » au survol (appareil ou bibliotheque);
 * - case pleine: poignee a gauche pour echanger deux photos, corbeille rouge a
 *   droite pour la vider, et barre de zoom en bas;
 * - case SELECTIONNEE: on deplace la photo dans son cadre a la souris et on
 *   zoome a la molette.
 *
 * Les cases non selectionnees restent transparentes aux evenements: c'est le
 * canvas, dessous, qui gere la selection, les textes et les stickers. Le
 * glisser-deposer est fait a la main (pointer events) plutot qu'en HTML5 drag,
 * qui n'atteindrait pas une cible `pointer-events: none` et ignorerait le
 * tactile.
 */
export default function SlotOverlay({
    slots = [], canvasWidth = 0, canvasHeight = 0, selectedSlotId = null,
    onImport, onSwap, onSelect, onRemove, onZoom, onPan, onResetFraming,
}) {
    const [drag, setDrag] = useState(null);
    const [panning, setPanning] = useState(null);
    const [layerSize, setLayerSize] = useState({ width: 0, height: 0 });
    const layerRef = useRef(null);
    const dragRef = useRef(null);
    const panRef = useRef(null);

    /* Taille reelle de la couche a l'ecran: elle decide des commandes qu'une
       case peut porter sans etre encombree. */
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(([entry]) => {
            const box = entry.contentRect;
            setLayerSize((previous) => (
                previous.width === box.width && previous.height === box.height
                    ? previous
                    : { width: box.width, height: box.height }
            ));
        });
        observer.observe(layer);
        return () => observer.disconnect();
    }, []);

    const slotAtPoint = useCallback((clientX, clientY) => {
        const layer = layerRef.current;
        if (!layer || !canvasWidth || !canvasHeight) return null;
        const box = layer.getBoundingClientRect();
        const x = ((clientX - box.left) / box.width) * canvasWidth;
        const y = ((clientY - box.top) / box.height) * canvasHeight;
        const hit = slots.find((slot) => (
            x >= slot.x && x <= slot.x + slot.w && y >= slot.y && y <= slot.y + slot.h
        ));
        return hit ? hit.id : null;
    }, [canvasHeight, canvasWidth, slots]);

    /* --- Echange de deux cases --- */
    useEffect(() => {
        if (!drag) return undefined;
        const move = (event) => {
            const overId = slotAtPoint(event.clientX, event.clientY);
            setDrag((current) => (current
                ? { ...current, x: event.clientX, y: event.clientY, overId }
                : current));
        };
        const finish = (event) => {
            const target = slotAtPoint(event.clientX, event.clientY);
            const source = dragRef.current;
            setDrag(null);
            dragRef.current = null;
            if (source !== null && target !== null && target !== source) onSwap?.(source, target);
        };
        const cancel = () => {
            setDrag(null);
            dragRef.current = null;
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', cancel);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', cancel);
        };
    }, [drag, onSwap, slotAtPoint]);

    /* --- Deplacement de la photo DANS sa case --- */
    useEffect(() => {
        if (!panning) return undefined;
        const move = (event) => {
            const state = panRef.current;
            const layer = layerRef.current;
            if (!state || !layer) return;
            const box = layer.getBoundingClientRect();
            /* Pixels ecran -> pixels canvas -> pourcentage de la case, comme le
               moteur qui pose le decalage (`cfg.x * (largeur case / 100)`). */
            const scaleX = canvasWidth / Math.max(1, box.width);
            const scaleY = canvasHeight / Math.max(1, box.height);
            const deltaX = ((event.clientX - state.x) * scaleX / state.slotW) * 100;
            const deltaY = ((event.clientY - state.y) * scaleY / state.slotH) * 100;
            panRef.current = { ...state, x: event.clientX, y: event.clientY };
            onPan?.(state.slotId, deltaX, deltaY);
        };
        const finish = () => {
            panRef.current = null;
            setPanning(null);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', finish);
        };
    }, [panning, canvasWidth, canvasHeight, onPan]);

    if (!slots.length || !canvasWidth || !canvasHeight) return null;

    const toPercent = (slot) => ({
        left: `${(slot.x / canvasWidth) * 100}%`,
        top: `${(slot.y / canvasHeight) * 100}%`,
        width: `${(slot.w / canvasWidth) * 100}%`,
        height: `${(slot.h / canvasHeight) * 100}%`,
    });

    const stop = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <div className={styles.slotLayer} ref={layerRef} data-testid="vibeos-slot-layer">
            {slots.map((slot, index) => {
                const isTarget = drag && drag.overId === slot.id && drag.fromId !== slot.id;
                const isSource = drag && drag.fromId === slot.id;
                const isSelected = slot.hasImage && slot.id === selectedSlotId;
                const zoomPercent = Math.round((slot.zoom ?? 1) * 100);
                /* Une petite case ne porte que l'essentiel: sinon les commandes
                   se marchent dessus et cachent la photo. */
                const screenW = canvasWidth ? (slot.w / canvasWidth) * layerSize.width : 0;
                const screenH = canvasHeight ? (slot.h / canvasHeight) * layerSize.height : 0;
                const isCompact = screenW < 104 || screenH < 84;
                /* Case selectionnee: barre de cadrage. Trop petite pour porter
                   la valeur, elle garde au moins le moins et le plus. */
                const showZoomBar = isSelected && screenW >= 88 && screenH >= 72;
                const compactZoomBar = screenW < 132 || screenH < 104;
                return (
                    <div
                        key={slot.id}
                        className={cx(
                            styles.slotBox,
                            slot.hasImage ? styles.slotBoxFilled : styles.slotBoxEmpty,
                            isSelected && styles.slotBoxSelected,
                            isCompact && styles.slotBoxCompact,
                            isTarget && styles.slotBoxTarget,
                            isSource && styles.slotBoxSource,
                        )}
                        style={toPercent(slot)}
                        onWheel={isSelected ? (event) => {
                            event.preventDefault();
                            onZoom?.(slot.id, event.deltaY < 0 ? 1.08 : 1 / 1.08);
                        } : undefined}
                        onDoubleClick={isSelected ? () => onResetFraming?.(slot.id) : undefined}
                        onPointerDown={isSelected ? (event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            panRef.current = {
                                slotId: slot.id, x: event.clientX, y: event.clientY,
                                slotW: slot.w, slotH: slot.h,
                            };
                            setPanning(slot.id);
                        } : undefined}
                    >
                        {slot.hasImage ? (
                            <>
                                <button
                                    type="button"
                                    className={styles.slotGrip}
                                    aria-label={`Déplacer la photo de « ${slot.label} »`}
                                    title="Glisse vers une autre case pour échanger les photos"
                                    onPointerDown={(event) => {
                                        stop(event);
                                        dragRef.current = slot.id;
                                        setDrag({
                                            fromId: slot.id, overId: slot.id, x: event.clientX, y: event.clientY, src: slot.src,
                                        });
                                        onSelect?.(slot.id);
                                    }}
                                >
                                    <GripVertical size={13} />
                                </button>
                                <button
                                    type="button"
                                    className={styles.slotTrash}
                                    aria-label={`Retirer la photo de « ${slot.label} »`}
                                    title="Retirer cette photo"
                                    data-testid={`vibeos-slot-remove-${index}`}
                                    onPointerDown={stop}
                                    onClick={(event) => {
                                        stop(event);
                                        onRemove?.(slot.id);
                                    }}
                                >
                                    <Trash2 size={13} />
                                </button>
                                {showZoomBar ? (
                                <div className={styles.slotZoomBar} onPointerDown={stop}>
                                    <button
                                        type="button"
                                        aria-label={`Dézoomer « ${slot.label} »`}
                                        onClick={() => onZoom?.(slot.id, 1 / 1.15)}
                                        disabled={zoomPercent <= 100}
                                    >
                                        <Minus size={12} />
                                    </button>
                                    {compactZoomBar ? null : (
                                        <button
                                            type="button"
                                            className={styles.slotZoomValue}
                                            aria-label={`Recadrer « ${slot.label} » à 100 %`}
                                            title="Revenir au cadrage d'origine"
                                            onClick={() => onResetFraming?.(slot.id)}
                                        >
                                            {zoomPercent > 100 ? `${zoomPercent}%` : <Maximize size={11} />}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        aria-label={`Zoomer « ${slot.label} »`}
                                        onClick={() => onZoom?.(slot.id, 1.15)}
                                    >
                                        <Plus size={12} />
                                    </button>
                                </div>
                                ) : null}
                            </>
                        ) : (
                            <button
                                type="button"
                                className={styles.slotEmptyButton}
                                onClick={() => onImport?.(slot.id)}
                                data-testid={`vibeos-slot-import-${index}`}
                            >
                                <span className={styles.slotImportPill}>
                                    <ImagePlus size={14} />
                                    Importer
                                </span>
                                <span className={styles.slotEmptyLabel}>{slot.label}</span>
                            </button>
                        )}
                    </div>
                );
            })}
            {drag ? (
                <span
                    className={styles.slotDragGhost}
                    style={{ left: drag.x, top: drag.y }}
                    aria-hidden="true"
                >
                    {drag.src ? <img src={drag.src} alt="" /> : null}
                </span>
            ) : null}
        </div>
    );
}
