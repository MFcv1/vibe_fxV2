"use client";

import React, { useCallback, useRef, useState } from 'react';
import { Blend, Image as ImageIcon, Move, Plus, Type, Video } from 'lucide-react';
import SceneIllustration, { getSceneVariantForKey } from '../media/SceneIllustration';
import { getMotionById } from '../data/motionCatalog';
import styles from './quick.module.css';

/*
 * Storyboard: grandes cartes de scenes, reordonnables au glisser-deposer.
 *
 * Le deplacement utilise les pointer events plutot que l'API drag-and-drop HTML5:
 * cela fonctionne au doigt, se teste vraiment (la souris synthetique de Playwright
 * ne declenche pas les evenements `drag*`), et permet de faire suivre la carte
 * sous le curseur avec les voisines qui s'ecartent.
 */

const DRAG_THRESHOLD_PX = 5;

function formatDuration(seconds = 0) {
    const safe = Math.max(0, Number(seconds) || 0);
    return safe >= 10 ? `${safe.toFixed(0)} s` : `${safe.toFixed(1)} s`;
}

function SceneCard({ scene, textCount, drag, onPointerDown, cardRef }) {
    const motion = scene.motionPreset ? getMotionById(scene.motionPreset) : null;
    const showMotion = Boolean(motion && motion.id !== 'none');
    const isDragged = drag?.index === scene.index;
    // Les cartes situees entre la position d'origine et la cible s'ecartent.
    let shift = 0;
    if (drag && !isDragged) {
        const { index, targetIndex } = drag;
        if (index < targetIndex && scene.index > index && scene.index <= targetIndex) shift = -1;
        if (index > targetIndex && scene.index >= targetIndex && scene.index < index) shift = 1;
    }

    return (
        <button
            ref={cardRef}
            type="button"
            onPointerDown={(event) => onPointerDown(event, scene)}
            aria-pressed={scene.selected}
            data-testid={`vibecut-scene-${scene.index}`}
            data-selected={scene.selected ? 'true' : 'false'}
            data-dragging={isDragged ? 'true' : 'false'}
            className={[
                styles.sceneCard,
                scene.selected ? styles.sceneCardActive : '',
                isDragged ? styles.sceneCardDragging : '',
                shift !== 0 ? styles.sceneCardShifted : '',
            ].filter(Boolean).join(' ')}
            style={{
                transform: isDragged
                    ? `translateX(${drag.offsetX}px) scale(1.03)`
                    : shift !== 0 ? `translateX(${shift * (drag.slotWidth || 0)}px)` : undefined,
            }}
        >
            <span className={styles.sceneThumb}>
                {scene.thumbnail ? (
                    <img src={scene.thumbnail} alt="" draggable={false} />
                ) : (
                    <SceneIllustration
                        variant={getSceneVariantForKey(scene.id)}
                        style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                )}
                <span className={styles.sceneIndex}>{scene.index + 1}</span>
                <span className={styles.sceneKind} aria-hidden="true">
                    {scene.isImage ? <ImageIcon size={12} /> : <Video size={12} />}
                </span>
                <span className={styles.sceneDuration} data-numeric="true" data-testid={`vibecut-scene-${scene.index}-duration`}>
                    {formatDuration(scene.duration)}
                </span>
            </span>
            <span className={styles.sceneFooter}>
                <span className={styles.sceneName}>{scene.name}</span>
                {textCount > 0 ? (
                    <span className={styles.sceneText} title={`${textCount} texte${textCount > 1 ? 's' : ''} sur cette scène`}>
                        <Type size={11} />
                    </span>
                ) : null}
                {showMotion ? (
                    <span className={styles.sceneMotion} title={`Mouvement : ${motion.name}`}>
                        <Move size={11} />
                    </span>
                ) : null}
            </span>
        </button>
    );
}

export default function Storyboard({
    scenes,
    totalDuration,
    textOverlays = [],
    onSelect,
    onReorder,
    onEditTransition,
    onAddMedia,
}) {
    const cardRefs = useRef(new Map());
    const pointerRef = useRef(null);
    const [drag, setDrag] = useState(null);

    // Un texte appartient a la scene sur laquelle il demarre: c'est la lecture
    // naturelle dans un storyboard, meme si le modele le stocke en temps absolu.
    const countTextsForScene = (scene) => textOverlays.filter((text) => {
        const start = Number(text.startTime) || 0;
        return start >= scene.timelineStart - 0.001 && start < scene.timelineStart + scene.duration - 0.001;
    }).length;

    const resolveTargetIndex = useCallback((clientX, fromIndex) => {
        const centers = scenes.map((scene) => {
            const node = cardRefs.current.get(scene.id);
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return rect.left + rect.width / 2;
        });
        let target = fromIndex;
        centers.forEach((center, index) => {
            if (center === null) return;
            if (index < fromIndex && clientX < center) target = Math.min(target, index);
            if (index > fromIndex && clientX > center) target = Math.max(target, index);
        });
        return target;
    }, [scenes]);

    const handlePointerDown = useCallback((event, scene) => {
        if (event.button !== 0) return;
        const node = cardRefs.current.get(scene.id);
        const rect = node?.getBoundingClientRect();
        pointerRef.current = {
            id: event.pointerId,
            scene,
            startX: event.clientX,
            moved: false,
            slotWidth: rect ? rect.width + 46 : 0,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }, []);

    const handlePointerMove = useCallback((event) => {
        const pointer = pointerRef.current;
        if (!pointer || event.pointerId !== pointer.id) return;
        const deltaX = event.clientX - pointer.startX;
        if (!pointer.moved && Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
        pointer.moved = true;
        const targetIndex = resolveTargetIndex(event.clientX, pointer.scene.index);
        setDrag({
            index: pointer.scene.index,
            targetIndex,
            offsetX: deltaX,
            slotWidth: pointer.slotWidth,
        });
    }, [resolveTargetIndex]);

    const handlePointerUp = useCallback((event) => {
        const pointer = pointerRef.current;
        if (!pointer || event.pointerId !== pointer.id) return;
        pointerRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);

        if (!pointer.moved) {
            // Simple clic: selection.
            onSelect(pointer.scene);
            setDrag(null);
            return;
        }
        const targetIndex = resolveTargetIndex(event.clientX, pointer.scene.index);
        setDrag(null);
        if (targetIndex !== pointer.scene.index) onReorder(pointer.scene.index, targetIndex);
    }, [onReorder, onSelect, resolveTargetIndex]);

    const handlePointerCancel = useCallback(() => {
        pointerRef.current = null;
        setDrag(null);
    }, []);

    return (
        <section className={styles.storyboard} data-testid="vibecut-storyboard">
            <div className={styles.storyboardHead}>
                <h2 className={styles.storyboardTitle}>Storyboard</h2>
                <span className={styles.storyboardMeta}>
                    {scenes.length} scène{scenes.length > 1 ? 's' : ''} · {Math.round(totalDuration)} s
                </span>
                {drag ? (
                    <span className={styles.storyboardMeta} data-testid="vibecut-drag-hint">
                        Position {drag.targetIndex + 1}
                    </span>
                ) : null}
            </div>

            <div
                className={styles.storyboardTrack}
                data-dragging={drag ? 'true' : 'false'}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
            >
                {scenes.map((scene, index) => (
                    <React.Fragment key={scene.id}>
                        <SceneCard
                            scene={scene}
                            textCount={countTextsForScene(scene)}
                            drag={drag}
                            onPointerDown={handlePointerDown}
                            cardRef={(node) => {
                                if (node) cardRefs.current.set(scene.id, node);
                                else cardRefs.current.delete(scene.id);
                            }}
                        />

                        {scene.nextSceneId ? (
                            <span className={styles.linkSlot}>
                                <button
                                    type="button"
                                    onClick={() => onEditTransition(scene)}
                                    className={[styles.linkButton, scene.transitionToNext ? styles.linkButtonSet : ''].filter(Boolean).join(' ')}
                                    title={scene.transitionToNext
                                        ? `Transition : ${scene.transitionToNext.name || scene.transitionToNext.type}`
                                        : 'Ajouter une transition'}
                                    aria-label={scene.transitionToNext ? 'Modifier la transition' : 'Ajouter une transition'}
                                    data-testid={`vibecut-transition-slot-${index}`}
                                    data-has-transition={scene.transitionToNext ? 'true' : 'false'}
                                >
                                    {scene.transitionToNext ? <Blend size={14} /> : <Plus size={14} />}
                                </button>
                                {scene.transitionToNext ? (
                                    <span className={styles.linkLabel}>
                                        {scene.transitionToNext.duration.toFixed(1)} s
                                    </span>
                                ) : null}
                            </span>
                        ) : null}
                    </React.Fragment>
                ))}

                <button
                    type="button"
                    className={styles.addScene}
                    onClick={onAddMedia}
                    data-testid="vibecut-add-media-card"
                >
                    <Plus size={18} />
                    Ajouter des médias
                </button>
            </div>
        </section>
    );
}
