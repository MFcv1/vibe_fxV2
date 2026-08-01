"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Magnet, Maximize2, Scissors, ZoomIn, ZoomOut } from 'lucide-react';
import { Badge, IconButton } from '../primitives';
import { subscribePlayhead } from '../preview/playheadClock';
import { getTransitionById } from '../data/transitionCatalog';
import {
    FOLDED_TRACK_TOGGLES,
    clampTransitionDuration,
    getMaxTransitionDuration,
    isItemMovable,
    useSnapEnabled,
    useTimelineActions,
    useTimelineModel,
    useTimelineSelection,
} from '../adapters/useTimeline';
import styles from './advanced.module.css';

/*
 * Timeline V2 du montage avance.
 *
 * Quatre rangees, pas sept. Le modele canonique garde ses sept pistes - c'est le
 * contrat d'export - mais trois d'entre elles ne sont pas des pistes de montage:
 * une transition n'existe QUE par rapport a une coupe, la colorimetrie est un
 * attribut du plan, le son d'un plan suit son plan. DaVinci et Premiere les
 * rendent donc SUR le plan. Le repliement vit dans `adapters/useTimeline`.
 *
 * Geometrie des plans: le modele fait deja se CHEVAUCHER deux plans reunis par
 * une transition (`cursor += duree - overlap`). L'ancienne vue dessinait chaque
 * plan en absolu avec un fond opaque, donc le plan suivant recouvrait la queue
 * du precedent: un plan de 4 s se lisait 2,6 s a l'ecran pendant que
 * l'inspecteur annoncait 4,00 s. On dessine desormais les plans JOINTIFS au
 * MILIEU de la transition, et la pastille de transition a cheval sur la
 * jointure - la convention des outils de montage.
 *
 * Toutes les interactions sont en pointer events et en `transform` local; RIEN
 * n'est ecrit dans le store avant le relachement.
 */

const HEAD_WIDTH = 176;
const MIN_PX_PER_SECOND = 4;
const MAX_PX_PER_SECOND = 480;
const MIN_ITEM_DURATION = 0.2;

const LANE_HEIGHTS = {
    video: 72,
    music: 38,
    text: 34,
    sequence: 28,
};

const AUDIO_KINDS = new Set(['music']);

const BADGE_GLYPHS = {
    color: '◐',
    motion: '▲',
    speed: '⏩',
    audio: '♪',
};

const FOLD_GLYPHS = {
    transition: '⧓',
    effect: '◐',
    'clip-audio': '♪',
};

/*
 * `setPointerCapture` leve si le pointeur n'est plus actif (relachement hors
 * fenetre, evenement synthetique...). Une exception dans un handler
 * `pointerdown` interromprait l'interaction entiere: on capture sans casser.
 */
function capturePointer(element, pointerId) {
    try {
        element?.setPointerCapture?.(pointerId);
    } catch {
        /* pointeur deja relache: le glissement fonctionne sans capture. */
    }
}

function releasePointer(element, pointerId) {
    try {
        element?.releasePointerCapture?.(pointerId);
    } catch {
        /* rien a relacher. */
    }
}

function laneHeight(kind) {
    return LANE_HEIGHTS[kind] || 36;
}

function formatTimecode(seconds = 0) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    const rest = Math.floor(safe % 60);
    const centis = Math.floor((safe % 1) * 100);
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/* Pas de graduation lisible: on ne descend jamais sous ~64 px entre deux reperes. */
function resolveTickStep(pxPerSecond) {
    const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    return candidates.find((step) => step * pxPerSecond >= 64) || 600;
}

function itemLabel(item, index) {
    const source = item.source || {};
    if (item.type === 'video') return `Plan ${index + 1} · ${source.name || 'sans nom'}`;
    if (item.type === 'text') return `Texte ${index + 1} · ${String(item.params?.content || '').slice(0, 24) || 'sans texte'}`;
    if (item.type === 'audio') return `Musique ${index + 1} · ${source.name || 'sans nom'}`;
    if (item.type === 'transition') return `Volet ${index + 1} · ${source.name || item.params?.transitionType || 'fondu'}`;
    return `Élément ${index + 1}`;
}

function transitionName(item) {
    const engineId = item?.params?.transitionType || item?.type;
    return getTransitionById(engineId)?.name || item?.name || engineId || 'Transition';
}

/*
 * Les plans sont poses bout a bout, jointifs au MILIEU de leur transition.
 * Chaque plan garde ainsi la moitie de la duree du fondu, et aucun plan n'en
 * recouvre un autre: la largeur dessinee redevient lisible.
 */
function layoutClips(clips = []) {
    let previousEdge = null;
    return clips.map((clip) => {
        const outgoing = Number(clip.transitionAfter?.duration) || 0;
        const displayStart = previousEdge === null ? clip.start : previousEdge;
        const edge = clip.start + clip.duration - outgoing / 2;
        previousEdge = edge;
        return {
            ...clip,
            displayStart,
            displayDuration: Math.max(0.04, edge - displayStart),
        };
    });
}

function Waveform({ peaks, className }) {
    if (!Array.isArray(peaks) || peaks.length === 0) return null;
    // Une trentaine de barres suffit: au-dela on dessine du bruit illisible.
    const step = Math.max(1, Math.floor(peaks.length / 34));
    const sampled = peaks.filter((_, index) => index % step === 0).slice(0, 34);
    return (
        <span className={className} aria-hidden="true">
            {sampled.map((peak, index) => (
                <span
                    key={index}
                    className={styles.waveBar}
                    style={{ height: `${Math.max(8, Math.min(100, Number(peak) * 100))}%` }}
                />
            ))}
        </span>
    );
}

export default function TimelineView({ scenes = [], sceneActions = null, onFocusSection = null }) {
    const scrollerRef = useRef(null);
    const surfaceRef = useRef(null);
    const playheadRef = useRef(null);
    const dragRef = useRef(null);

    const { lanes, displayLanes, snapPoints, totalDuration, clipCount } = useTimelineModel();
    const actions = useTimelineActions();
    const selection = useTimelineSelection();
    const snapEnabled = useSnapEnabled();

    const [pxPerSecond, setPxPerSecond] = useState(48);
    const [drag, setDrag] = useState(null);
    const [snapHint, setSnapHint] = useState(null);
    const userZoomedRef = useRef(false);

    const duration = Math.max(totalDuration, 1);
    const contentWidth = Math.max(320, duration * pxPerSecond + 120);

    const videoLane = useMemo(
        () => displayLanes.find((lane) => lane.kind === 'video') || null,
        [displayLanes],
    );
    const videoItems = videoLane?.items || [];
    const laidOutClips = useMemo(() => layoutClips(videoLane?.clips || []), [videoLane]);

    const fitToViewport = useCallback(() => {
        const scroller = scrollerRef.current;
        if (!scroller || totalDuration <= 0) return;
        const available = scroller.clientWidth - HEAD_WIDTH - 48;
        if (available <= 0) return;
        setPxPerSecond(Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, available / totalDuration)));
    }, [totalDuration]);

    useEffect(() => {
        if (userZoomedRef.current || totalDuration <= 0) return;
        fitToViewport();
    }, [fitToViewport, totalDuration]);

    /* ---------- Tete de lecture, hors React ---------- */
    useLayoutEffect(() => {
        const write = (time) => {
            const node = playheadRef.current;
            if (!node) return;
            const clamped = Math.max(0, Math.min(duration, Number(time) || 0));
            node.style.transform = `translateX(${clamped * pxPerSecond}px)`;
            node.setAttribute('aria-valuenow', String(Math.round(clamped * 100) / 100));
            const label = node.querySelector('[data-playhead-time]');
            if (label) label.textContent = formatTimecode(clamped);
        };
        return subscribePlayhead(write);
    }, [duration, pxPerSecond]);

    /* ---------- Zoom ---------- */
    const zoomBy = useCallback((factor) => {
        userZoomedRef.current = true;
        setPxPerSecond((current) => Math.min(
            MAX_PX_PER_SECOND,
            Math.max(MIN_PX_PER_SECOND, current * factor),
        ));
    }, []);

    /* ---------- Scrub sur la reglette ---------- */
    const timeFromEvent = useCallback((event) => {
        const surface = surfaceRef.current;
        if (!surface) return 0;
        const rect = surface.getBoundingClientRect();
        const x = event.clientX - rect.left;
        return Math.max(0, Math.min(duration, x / pxPerSecond));
    }, [duration, pxPerSecond]);

    const handleRulerPointerDown = useCallback((event) => {
        capturePointer(event.currentTarget, event.pointerId);
        actions.seekTo(timeFromEvent(event));
    }, [actions, timeFromEvent]);

    const handleRulerPointerMove = useCallback((event) => {
        if (event.buttons !== 1) return;
        actions.seekTo(timeFromEvent(event));
    }, [actions, timeFromEvent]);

    const handlePlayheadKeyDown = useCallback((event) => {
        const step = event.shiftKey ? 1 : 1 / 30;
        const current = Number(event.currentTarget.getAttribute('aria-valuenow')) || 0;
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            actions.seekTo(Math.min(duration, current + step));
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            actions.seekTo(Math.max(0, current - step));
        }
    }, [actions, duration]);

    /* ---------- Deplacement / redimensionnement ---------- */
    const applySnap = useCallback(
        (time) => actions.snapTime(time, snapPoints, snapEnabled),
        [actions, snapEnabled, snapPoints],
    );

    const startInteraction = useCallback((event, item, mode, laneKind, locked) => {
        if (locked) return;
        event.stopPropagation();
        actions.selectItem(item, { seek: true });
        if (mode === 'move' && laneKind === 'video') {
            dragRef.current = {
                mode: 'reorder',
                itemId: item.id,
                index: videoItems.findIndex((entry) => entry.id === item.id),
                originX: event.clientX,
                targetIndex: videoItems.findIndex((entry) => entry.id === item.id),
                offset: 0,
            };
        } else if (mode === 'move' && !isItemMovable(item)) {
            return;
        } else {
            dragRef.current = {
                mode,
                itemId: item.id,
                item,
                originX: event.clientX,
                start: item.start,
                duration: item.duration,
            };
        }
        setDrag({ ...dragRef.current });
        capturePointer(event.currentTarget, event.pointerId);
        event.preventDefault();
    }, [actions, videoItems]);

    /*
     * Poignee d'une transition de coupe. Tirer un bord change la DUREE de la
     * transition, pas le rognage du plan: la transition reste calee sur sa
     * jointure, qui est justement ce qui lui donne un sens.
     */
    const startTransitionDrag = useCallback((event, clip, edge) => {
        const transition = clip.transitionAfter;
        if (!transition || !videoLane || videoLane.locked) return;
        event.stopPropagation();
        const next = laidOutClips[clip.index + 1];
        actions.selectItem(transition, { seek: true });
        dragRef.current = {
            mode: 'transition',
            itemId: transition.id,
            clipId: clip.clipId,
            transition,
            edge,
            originX: event.clientX,
            duration: transition.duration,
            max: getMaxTransitionDuration(clip.duration, next?.duration ?? clip.duration),
        };
        setDrag({ ...dragRef.current });
        capturePointer(event.currentTarget, event.pointerId);
        event.preventDefault();
    }, [actions, laidOutClips, videoLane]);

    const handleInteractionMove = useCallback((event) => {
        const state = dragRef.current;
        if (!state) return;
        const deltaSeconds = (event.clientX - state.originX) / pxPerSecond;

        if (state.mode === 'transition') {
            const wanted = state.edge === 'right'
                ? state.duration + deltaSeconds
                : state.duration - deltaSeconds;
            const clamped = Math.min(state.max, Math.max(MIN_ITEM_DURATION, wanted));
            state.nextDuration = clamped;
            // On DIT pourquoi ca bloque, au lieu de laisser croire a un ecran fige.
            setSnapHint(clamped >= state.max - 0.001 && wanted > clamped
                ? `Maximum ${clamped.toFixed(2)} s (45 % du plan le plus court)`
                : null);
            setDrag({ ...state });
            return;
        }

        if (state.mode === 'reorder') {
            const dragged = videoItems[state.index];
            if (!dragged) return;
            const pointerTime = dragged.start + dragged.duration / 2 + deltaSeconds;
            let targetIndex = 0;
            videoItems.forEach((entry, position) => {
                if (position === state.index) return;
                if (entry.start + entry.duration / 2 < pointerTime) targetIndex += 1;
            });
            state.targetIndex = targetIndex;
            state.offset = event.clientX - state.originX;
            setDrag({ ...state });
            return;
        }

        if (state.mode === 'move') {
            const raw = Math.max(0, state.start + deltaSeconds);
            const snapped = applySnap(raw);
            state.nextStart = snapped.time;
            state.nextDuration = state.duration;
            setSnapHint(snapped.snapped ? snapped.point?.label || null : null);
        } else if (state.mode === 'resize-left') {
            const raw = Math.max(0, Math.min(state.start + state.duration - MIN_ITEM_DURATION, state.start + deltaSeconds));
            const snapped = applySnap(raw);
            const nextStart = Math.min(snapped.time, state.start + state.duration - MIN_ITEM_DURATION);
            state.nextStart = Math.max(0, nextStart);
            state.nextDuration = state.start + state.duration - state.nextStart;
            setSnapHint(snapped.snapped ? snapped.point?.label || null : null);
        } else if (state.mode === 'resize-right') {
            const raw = Math.max(state.start + MIN_ITEM_DURATION, state.start + state.duration + deltaSeconds);
            const snapped = applySnap(raw);
            state.nextStart = state.start;
            state.nextDuration = Math.max(MIN_ITEM_DURATION, snapped.time - state.start);
            setSnapHint(snapped.snapped ? snapped.point?.label || null : null);
        }
        setDrag({ ...state });
    }, [applySnap, pxPerSecond, videoItems]);

    const endInteraction = useCallback((event) => {
        const state = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        setSnapHint(null);
        releasePointer(event.currentTarget, event.pointerId);
        if (!state) return;

        if (state.mode === 'transition') {
            if (!Number.isFinite(state.nextDuration) || !sceneActions) return;
            const scene = scenes.find((entry) => entry.id === state.clipId);
            if (!scene) return;
            // Meme chemin d'ecriture que l'inspecteur: une seule action pose une
            // transition dans tout le produit.
            sceneActions.applyTransition(scene, {
                engineId: state.transition.params?.transitionType || state.transition.type,
                name: transitionName(state.transition),
                duration: Math.round(state.nextDuration * 100) / 100,
            });
            return;
        }

        if (state.mode === 'reorder') {
            if (state.targetIndex !== state.index && state.targetIndex >= 0) {
                actions.reorderClips(state.index, state.targetIndex);
            }
            return;
        }

        const item = state.item;
        if (!item || !Number.isFinite(state.nextStart)) return;

        if (item.type === 'video') {
            const source = item.source || {};
            const speed = Number(source.speed) > 0 ? Number(source.speed) : 1;
            if (state.mode === 'resize-right') {
                actions.trimClip(source, { trimEnd: item.trimStart + state.nextDuration * speed }, { history: true });
            } else if (state.mode === 'resize-left') {
                const consumed = (state.nextStart - state.start) * speed;
                actions.trimClip(source, { trimStart: item.trimStart + consumed }, { history: true });
            }
            return;
        }

        if (state.mode === 'move') {
            actions.moveItem(item, state.nextStart, { history: true });
        } else {
            actions.resizeItem(item, { start: state.nextStart, duration: state.nextDuration }, { history: true });
        }
    }, [actions, sceneActions, scenes]);

    const handleBadge = useCallback((clip, badge) => {
        actions.selectItem(clip, { seek: true });
        onFocusSection?.(badge.section);
    }, [actions, onFocusSection]);

    /* ---------- Rendu ---------- */
    const tickStep = resolveTickStep(pxPerSecond);
    const ticks = useMemo(() => {
        const values = [];
        for (let time = 0; time <= duration + 0.001; time += tickStep) values.push(Math.round(time * 100) / 100);
        return values;
    }, [duration, tickStep]);

    const dropIndex = drag?.mode === 'reorder' ? drag.targetIndex : null;

    const renderGenericItem = (item, index, lane) => {
        const isDragged = drag && drag.itemId === item.id;
        const start = isDragged && Number.isFinite(drag.nextStart) ? drag.nextStart : item.start;
        const itemDuration = isDragged && Number.isFinite(drag.nextDuration) ? drag.nextDuration : item.duration;
        const selected = selection.selectedItemId === item.id;

        return (
            <div
                key={item.id}
                className={styles.item}
                data-track-item-type={item.type}
                data-track-item-start={item.start.toFixed(3)}
                data-track-item-duration={item.duration.toFixed(3)}
                data-selected={selected ? 'true' : 'false'}
                data-dragging={isDragged ? 'true' : 'false'}
                style={{
                    left: `${start * pxPerSecond}px`,
                    width: `${Math.max(6, itemDuration * pxPerSecond)}px`,
                }}
            >
                <button
                    type="button"
                    className={styles.itemBody}
                    aria-label={itemLabel(item, index)}
                    title={itemLabel(item, index)}
                    data-testid={`vibecut-item-${item.type}-${index}`}
                    onPointerDown={(event) => startInteraction(event, item, 'move', lane.kind, lane.locked)}
                    onPointerMove={handleInteractionMove}
                    onPointerUp={endInteraction}
                    onPointerCancel={endInteraction}
                >
                    <span className={styles.itemLabel}>{itemLabel(item, index)}</span>
                </button>

                {isItemMovable(item) && !lane.locked ? (
                    <>
                        <span
                            className={`${styles.handle} ${styles.handleLeft}`}
                            aria-hidden="true"
                            data-testid={`vibecut-item-${item.type}-${index}-trim-start`}
                            onPointerDown={(event) => startInteraction(event, item, 'resize-left', lane.kind, lane.locked)}
                            onPointerMove={handleInteractionMove}
                            onPointerUp={endInteraction}
                            onPointerCancel={endInteraction}
                        />
                        <span
                            className={`${styles.handle} ${styles.handleRight}`}
                            aria-hidden="true"
                            data-testid={`vibecut-item-${item.type}-${index}-trim-end`}
                            onPointerDown={(event) => startInteraction(event, item, 'resize-right', lane.kind, lane.locked)}
                            onPointerMove={handleInteractionMove}
                            onPointerUp={endInteraction}
                            onPointerCancel={endInteraction}
                        />
                    </>
                ) : null}
            </div>
        );
    };

    const renderClip = (clip, lane) => {
        const index = clip.index;
        const isDragged = drag && drag.itemId === clip.id;
        const offset = isDragged && drag.mode === 'reorder' ? drag.offset : 0;
        const selected = selection.selectedClipId === clip.clipId
            && !selection.selectedTransitionId && !selection.selectedTextId;
        const trimmed = isDragged && Number.isFinite(drag.nextDuration) && drag.mode !== 'reorder'
            ? drag.nextDuration
            : clip.displayDuration;
        const label = itemLabel(clip, index);
        const muted = Boolean(lane.mutedAudio);

        return (
            <div
                key={clip.id}
                className={styles.clip}
                data-track-item-type="video"
                data-track-item-start={clip.start.toFixed(3)}
                data-track-item-duration={clip.duration.toFixed(3)}
                data-display-duration={clip.displayDuration.toFixed(3)}
                data-selected={selected ? 'true' : 'false'}
                data-dragging={isDragged ? 'true' : 'false'}
                style={{
                    left: `${clip.displayStart * pxPerSecond}px`,
                    width: `${Math.max(8, trimmed * pxPerSecond)}px`,
                    transform: offset ? `translateX(${offset}px)` : undefined,
                }}
            >
                <button
                    type="button"
                    className={styles.clipBody}
                    data-with-audio={clip.isImage ? 'false' : 'true'}
                    aria-label={label}
                    title={label}
                    data-testid={`vibecut-item-video-${index}`}
                    onPointerDown={(event) => startInteraction(event, clip, 'move', lane.kind, lane.locked)}
                    onPointerMove={handleInteractionMove}
                    onPointerUp={endInteraction}
                    onPointerCancel={endInteraction}
                >
                    {clip.source?.thumbnails?.[0] ? (
                        <img className={styles.clipThumb} src={clip.source.thumbnails[0]} alt="" />
                    ) : null}
                    <span className={styles.clipLabel}>{label}</span>
                </button>

                {/*
                 * Les badges sont des freres du bouton, jamais ses enfants: un
                 * bouton dans un bouton est du HTML invalide, et le clic sur le
                 * badge declencherait aussi celui du plan (bug 11).
                 */}
                {clip.badges.length > 0 ? (
                    <span className={styles.clipBadges}>
                        {clip.badges.map((badge) => (
                            <button
                                key={badge.id}
                                type="button"
                                className={styles.clipBadge}
                                aria-label={`${badge.label} du plan ${index + 1}`}
                                title={badge.label}
                                data-badge={badge.id}
                                data-testid={`vibecut-clip-${index}-badge-${badge.id}`}
                                onClick={() => handleBadge(clip, badge)}
                            >
                                <span aria-hidden="true">{BADGE_GLYPHS[badge.id] || '•'}</span>
                            </button>
                        ))}
                    </span>
                ) : null}

                {clip.isImage ? null : (
                    <span className={styles.clipAudio} data-muted={muted ? 'true' : 'false'}>
                        <Waveform peaks={clip.source?.waveform?.peaks} className={styles.clipWave} />
                    </span>
                )}

                {!lane.locked ? (
                    <>
                        <span
                            className={`${styles.handle} ${styles.handleLeft}`}
                            aria-hidden="true"
                            data-testid={`vibecut-item-video-${index}-trim-start`}
                            onPointerDown={(event) => startInteraction(event, clip, 'resize-left', lane.kind, lane.locked)}
                            onPointerMove={handleInteractionMove}
                            onPointerUp={endInteraction}
                            onPointerCancel={endInteraction}
                        />
                        <span
                            className={`${styles.handle} ${styles.handleRight}`}
                            aria-hidden="true"
                            data-testid={`vibecut-item-video-${index}-trim-end`}
                            onPointerDown={(event) => startInteraction(event, clip, 'resize-right', lane.kind, lane.locked)}
                            onPointerMove={handleInteractionMove}
                            onPointerUp={endInteraction}
                            onPointerCancel={endInteraction}
                        />
                    </>
                ) : null}
            </div>
        );
    };

    const renderTransition = (clip, lane) => {
        const transition = clip.transitionAfter;
        if (!transition) return null;
        const isDragged = drag?.mode === 'transition' && drag.itemId === transition.id;
        const live = isDragged && Number.isFinite(drag.nextDuration) ? drag.nextDuration : transition.duration;
        // La transition reste calee sur la jointure: elle s'etend a gauche du
        // point de coupe de la moitie de sa duree, comme dans un NLE.
        const cut = clip.start + clip.duration - transition.duration / 2;
        const left = cut - live / 2;
        const selected = selection.selectedTransitionId === transition.id;

        return (
            <div
                key={transition.id}
                className={styles.transition}
                data-track-item-type="transition"
                data-track-item-start={transition.start.toFixed(3)}
                data-track-item-duration={transition.duration.toFixed(3)}
                data-selected={selected ? 'true' : 'false'}
                data-dragging={isDragged ? 'true' : 'false'}
                style={{
                    left: `${left * pxPerSecond}px`,
                    width: `${Math.max(14, live * pxPerSecond)}px`,
                }}
            >
                <span
                    className={`${styles.transitionEdge} ${styles.transitionEdgeLeft}`}
                    aria-hidden="true"
                    data-testid={`vibecut-transition-${clip.index}-edge-start`}
                    onPointerDown={(event) => startTransitionDrag(event, clip, 'left')}
                    onPointerMove={handleInteractionMove}
                    onPointerUp={endInteraction}
                    onPointerCancel={endInteraction}
                />
                <button
                    type="button"
                    className={styles.transitionBody}
                    aria-label={`Transition entre le plan ${clip.index + 1} et le plan ${clip.index + 2} · ${transitionName(transition)} · ${live.toFixed(2)} s`}
                    title={`${transitionName(transition)} · ${live.toFixed(2)} s`}
                    data-testid={`vibecut-item-transition-${clip.index}`}
                    onClick={() => actions.selectItem(transition, { seek: true })}
                >
                    <span className={styles.transitionGlyph} aria-hidden="true">⧓</span>
                </button>
                <span
                    className={`${styles.transitionEdge} ${styles.transitionEdgeRight}`}
                    aria-hidden="true"
                    data-testid={`vibecut-transition-${clip.index}-edge-end`}
                    onPointerDown={(event) => startTransitionDrag(event, clip, 'right')}
                    onPointerMove={handleInteractionMove}
                    onPointerUp={endInteraction}
                    onPointerCancel={endInteraction}
                />
            </div>
        );
    };

    return (
        <section className={styles.timeline} data-testid="vibecut-timeline" aria-label="Timeline">
            <header className={styles.timelineBar}>
                <h2 className={styles.timelineTitle}>Timeline</h2>
                <Badge>{clipCount} plan{clipCount > 1 ? 's' : ''}</Badge>
                <span className={styles.timelineTotal} data-numeric="true" data-testid="vibecut-timeline-total">
                    {formatTimecode(totalDuration)}
                </span>

                <span className={styles.barSpacer} />

                {snapHint ? (
                    <span className={styles.snapHint} role="status" data-testid="vibecut-timeline-snap-hint">
                        {snapHint.startsWith('Maximum') ? snapHint : `Aligné sur ${snapHint}`}
                    </span>
                ) : null}

                {/*
                 * Les trois pistes repliees gardent leurs capacites: masquer les
                 * transitions, contourner la colorimetrie, couper le son des
                 * plans. Elles vivent ici plutot que dans une rangee qui
                 * n'existe plus.
                 */}
                <span className={styles.foldedToggles}>
                    {FOLDED_TRACK_TOGGLES.map((toggle) => {
                        const lane = lanes.find((entry) => entry.role === toggle.role);
                        if (!lane) return null;
                        const on = toggle.invert ? !lane.muted : lane.visible !== false;
                        return (
                            <IconButton
                                key={toggle.role}
                                label={toggle.label}
                                aria-pressed={on}
                                active={on}
                                className={styles.laneToggle}
                                onClick={() => actions.setTrackState(
                                    lane.id,
                                    toggle.invert ? { muted: on } : { visible: !on },
                                )}
                                data-testid={`vibecut-fold-${toggle.role}`}
                            >
                                <span className={styles.laneGlyph} aria-hidden="true">
                                    {FOLD_GLYPHS[toggle.role]}
                                </span>
                            </IconButton>
                        );
                    })}
                </span>

                <IconButton
                    label="Découper à la tête de lecture"
                    onClick={() => actions.splitAtPlayhead(
                        videoItems.find((item) => (item.sourceId || item.id) === selection.selectedClipId),
                    )}
                    disabled={!selection.selectedClipId}
                    data-testid="vibecut-timeline-split"
                >
                    <Scissors size={15} />
                </IconButton>
                <IconButton
                    label={snapEnabled ? 'Désactiver le magnétisme' : 'Activer le magnétisme'}
                    active={snapEnabled}
                    aria-pressed={snapEnabled}
                    onClick={() => actions.setSnapEnabled(!snapEnabled)}
                    data-testid="vibecut-timeline-snap"
                >
                    <Magnet size={15} />
                </IconButton>
                <IconButton label="Dézoomer la timeline" onClick={() => zoomBy(1 / 1.6)} data-testid="vibecut-timeline-zoom-out">
                    <ZoomOut size={15} />
                </IconButton>
                <IconButton label="Zoomer la timeline" onClick={() => zoomBy(1.6)} data-testid="vibecut-timeline-zoom-in">
                    <ZoomIn size={15} />
                </IconButton>
                <IconButton
                    label="Afficher tout le montage"
                    onClick={() => { userZoomedRef.current = false; fitToViewport(); }}
                    data-testid="vibecut-timeline-fit"
                >
                    <Maximize2 size={15} />
                </IconButton>
            </header>

            <div className={styles.timelineScroller} ref={scrollerRef} data-timeline-viewport="true">
                <div className={styles.timelineRows} style={{ width: `${HEAD_WIDTH + contentWidth}px` }}>
                    <div className={styles.ruler}>
                        <div className={styles.rulerHead} />
                        <div
                            ref={surfaceRef}
                            className={styles.rulerBody}
                            style={{ width: `${contentWidth}px` }}
                            onPointerDown={handleRulerPointerDown}
                            onPointerMove={handleRulerPointerMove}
                            data-testid="vibecut-timeline-ruler"
                        >
                            {ticks.map((time) => (
                                <span key={time} className={styles.tick} style={{ left: `${time * pxPerSecond}px` }}>
                                    <span className={styles.tickLabel} data-numeric="true">{formatTimecode(time)}</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    {displayLanes.map((lane, laneIndex) => (
                        <div
                            key={lane.id}
                            className={styles.lane}
                            data-track-area={lane.kind}
                            data-track-order={laneIndex}
                            data-track-locked={lane.locked ? 'true' : 'false'}
                        >
                            <div className={styles.laneHead} style={{ height: `${laneHeight(lane.kind)}px` }}>
                                <span className={styles.laneName}>{lane.label}</span>
                                <span className={styles.laneTools}>
                                    {AUDIO_KINDS.has(lane.kind) ? (
                                        <IconButton
                                            label={`Son de la piste ${lane.label}`}
                                            aria-pressed={!lane.muted}
                                            className={styles.laneToggle}
                                            onClick={() => actions.setTrackState(lane.id, { muted: !lane.muted })}
                                            data-testid={`vibecut-track-${lane.id}-mute`}
                                        >
                                            <span className={styles.laneGlyph} aria-hidden="true">{lane.muted ? '×' : '♪'}</span>
                                        </IconButton>
                                    ) : (
                                        <IconButton
                                            label={`Affichage de la piste ${lane.label}`}
                                            aria-pressed={lane.visible !== false}
                                            className={styles.laneToggle}
                                            onClick={() => actions.setTrackState(lane.id, { visible: lane.visible === false })}
                                            data-testid={`vibecut-track-${lane.id}-visible`}
                                        >
                                            <span className={styles.laneGlyph} aria-hidden="true">{lane.visible === false ? '◌' : '◉'}</span>
                                        </IconButton>
                                    )}
                                    <IconButton
                                        label={`Verrouillage de la piste ${lane.label}`}
                                        aria-pressed={Boolean(lane.locked)}
                                        className={styles.laneToggle}
                                        onClick={() => actions.setTrackState(lane.id, { locked: !lane.locked })}
                                        data-testid={`vibecut-track-${lane.id}-lock`}
                                    >
                                        <span className={styles.laneGlyph} aria-hidden="true">{lane.locked ? '■' : '□'}</span>
                                    </IconButton>
                                </span>
                            </div>

                            <div
                                className={styles.laneBody}
                                style={{ width: `${contentWidth}px`, height: `${laneHeight(lane.kind)}px` }}
                            >
                                {lane.kind === 'video' ? (
                                    <>
                                        {laidOutClips.map((clip) => renderClip(clip, lane))}
                                        {laidOutClips.map((clip) => renderTransition(clip, lane))}
                                        {dropIndex !== null ? (
                                            <span
                                                className={styles.dropIndicator}
                                                data-testid="vibecut-timeline-drop-indicator"
                                                style={{
                                                    left: `${(laidOutClips[dropIndex]
                                                        ? laidOutClips[dropIndex].displayStart
                                                        : duration) * pxPerSecond}px`,
                                                }}
                                            />
                                        ) : null}
                                    </>
                                ) : (
                                    lane.items.map((item, index) => renderGenericItem(item, index, lane))
                                )}
                            </div>
                        </div>
                    ))}

                    <div
                        ref={playheadRef}
                        className={styles.playhead}
                        role="slider"
                        tabIndex={0}
                        aria-label="Tête de lecture"
                        aria-valuemin={0}
                        aria-valuemax={Math.round(duration * 100) / 100}
                        aria-valuenow={0}
                        onKeyDown={handlePlayheadKeyDown}
                        data-testid="vibecut-timeline-playhead"
                        style={{ left: `${HEAD_WIDTH}px` }}
                    >
                        <span className={styles.playheadLabel} data-playhead-time data-numeric="true">
                            {formatTimecode(0)}
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
