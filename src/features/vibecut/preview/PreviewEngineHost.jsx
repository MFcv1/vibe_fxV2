"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import { EXPORT_PRESETS, PlaybackEngine } from '@/features/vibefx-studio/video/engine/VideoEngine';
import { drawTextOverlays } from '@/features/vibefx-studio/video/engine/textOverlayRenderer';
import { resolveTimelineRenderPlan } from '@/features/vibefx-studio/video/model/timelineModel';
import { setPlayheadTime } from './playheadClock';
import styles from './preview.module.css';

/*
 * UN SEUL moteur d'apercu pour tout VibeCut (phase 4).
 *
 * Avant, chaque ecran creait puis detruisait son `PlaybackEngine` (constat n° 8
 * de plan.md § 2): passer du montage rapide au montage avance rechargeait tous
 * les medias, decodage video compris. Le moteur et son canvas vivent desormais
 * dans le layout, donc au-dessus des routes.
 *
 * Le canvas est cree en imperatif (`document.createElement`) et DEPLACE d'un
 * ecran a l'autre. Un portail React ne conviendrait pas: changer de conteneur
 * demonte les enfants et en remonte de nouveaux, on obtiendrait donc un canvas
 * neuf a chaque navigation - exactement ce qu'on veut eviter.
 */

const PreviewStageContext = createContext(null);

const SNAP_TARGETS = [0.5, 1 / 3, 2 / 3];
const SNAP_TOLERANCE = 0.018;

function snapAxis(value) {
    for (const target of SNAP_TARGETS) {
        if (Math.abs(value - target) < SNAP_TOLERANCE) return { value: target, snapped: target };
    }
    return { value, snapped: null };
}

/*
 * Reperes de positionnement facon Canva: centre et regle des tiers.
 * On ne dessine que les axes reellement magnetises, plus une boite autour du
 * texte deplace: assez pour se reperer, sans quadriller l'image en permanence.
 */
function drawTextGuides(canvas, { x, y, snapX, snapY, box }) {
    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    context.save();
    // Le canvas est rendu en pleine resolution puis reduit en CSS: les traits
    // doivent etre epais dans l'espace canvas pour rester nets a l'ecran.
    context.lineWidth = Math.max(3, width * 0.005);

    context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    context.setLineDash([width / 70, width / 70]);
    SNAP_TARGETS.forEach((target) => {
        context.beginPath();
        context.moveTo(target * width, 0);
        context.lineTo(target * width, height);
        context.moveTo(0, target * height);
        context.lineTo(width, target * height);
        context.stroke();
    });

    context.setLineDash([]);
    context.strokeStyle = '#5b7cfa';
    if (snapX !== null) {
        context.beginPath();
        context.moveTo(snapX * width, 0);
        context.lineTo(snapX * width, height);
        context.stroke();
    }
    if (snapY !== null) {
        context.beginPath();
        context.moveTo(0, snapY * height);
        context.lineTo(width, snapY * height);
        context.stroke();
    }

    if (box) {
        context.strokeStyle = 'rgba(91, 124, 250, 0.9)';
        context.setLineDash([width / 120, width / 120]);
        context.strokeRect(
            x * width - box.width / 2,
            y * height - box.height / 2,
            box.width,
            box.height,
        );
    }
    context.restore();
}

/*
 * Le canvas d'apercu vit HORS de React, en singleton de module.
 *
 * Ni `useState` ni `useRef` ne conviennent: la surface VibeCut n'a qu'un seul
 * apercu a la fois, et le but de la phase 4 est justement qu'il survive aux
 * montages et demontages de composants. Un singleton dit exactement cela.
 */
let sharedCanvas = null;

function getSharedPreviewCanvas() {
    if (typeof document === 'undefined') return null;
    if (!sharedCanvas) {
        sharedCanvas = document.createElement('canvas');
        sharedCanvas.className = styles.canvas;
        sharedCanvas.dataset.testid = 'vibecut-preview-canvas';
        sharedCanvas.dataset.empty = 'true';
        sharedCanvas.dataset.dragging = 'false';
    }
    return sharedCanvas;
}

function PreviewEngineHost({ mountNode }) {
    const engineRef = useRef(null);
    const lastStoreUpdateRef = useRef(0);
    const dragRef = useRef(null);

    const clips = useVideoStore((state) => state.clips);
    const transitions = useVideoStore((state) => state.transitions);
    const transitionItems = useVideoStore((state) => state.transitionItems);
    const textOverlays = useVideoStore((state) => state.textOverlays);
    const audioTracks = useVideoStore((state) => state.audioTracks);
    const tracks = useVideoStore((state) => state.tracks);
    const totalDuration = useVideoStore((state) => state.totalDuration);
    const isPlaying = useVideoStore((state) => state.isPlaying);
    const playbackSpeed = useVideoStore((state) => state.playbackSpeed);
    const sequencePreset = useVideoStore((state) => state.sequencePreset);
    const setCurrentTime = useVideoStore((state) => state.setCurrentTime);
    const setIsPlaying = useVideoStore((state) => state.setIsPlaying);
    const setPreviewCanvas = useVideoStore((state) => state.setPreviewCanvas);
    const setPreviewEngine = useVideoStore((state) => state.setPreviewEngine);

    const preset = EXPORT_PRESETS[sequencePreset] || EXPORT_PRESETS['instagram-reel'];

    const plan = useMemo(() => resolveTimelineRenderPlan({
        clips, transitions, transitionItems, textOverlays, audioTracks, tracks, totalDuration,
    }), [audioTracks, clips, textOverlays, totalDuration, tracks, transitionItems, transitions]);

    const renderClips = plan.clips;
    const renderTransitions = plan.allTransitions;
    const renderAudio = plan.audioTracks;
    const hasContent = plan.hasVisibleContent;

    // Deplacement du canvas d'un ecran a l'autre, sans le recreer.
    useEffect(() => {
        const canvas = getSharedPreviewCanvas();
        if (!canvas) return undefined;
        if (!mountNode) {
            canvas.remove();
            return undefined;
        }
        mountNode.appendChild(canvas);
        return () => {
            if (canvas.parentNode === mountNode) canvas.remove();
        };
    }, [mountNode]);

    // Moteur unique, monte avec le canvas et jamais reconstruit.
    useEffect(() => {
        const canvas = getSharedPreviewCanvas();
        if (!canvas) return undefined;
        const engine = new PlaybackEngine(canvas);
        engineRef.current = engine;
        setPreviewCanvas(canvas);
        setPreviewEngine(engine);
        return () => {
            setPreviewCanvas(null);
            setPreviewEngine(null);
            engine.dispose();
            engineRef.current = null;
        };
    }, [setPreviewCanvas, setPreviewEngine]);

    const drawFrame = useCallback(async (time) => {
        const engine = engineRef.current;
        const canvas = getSharedPreviewCanvas();
        if (!engine || !canvas) return;
        const state = useVideoStore.getState();
        const currentPlan = resolveTimelineRenderPlan(state);
        if (currentPlan.clips.length === 0) {
            const context = canvas.getContext('2d');
            context.fillStyle = '#000000';
            context.fillRect(0, 0, canvas.width, canvas.height);
            return;
        }
        await engine.seekAndDraw(currentPlan.clips, currentPlan.transitions, time, currentPlan.allTransitions);
        drawTextOverlays(canvas, currentPlan.textOverlays, time, state.selectedTextId);
        const drag = dragRef.current;
        if (drag) {
            drawTextGuides(canvas, {
                x: drag.x,
                y: drag.y,
                snapX: drag.snapX,
                snapY: drag.snapY,
                box: drag.box,
            });
        }
    }, []);

    useEffect(() => {
        const canvas = getSharedPreviewCanvas();
        if (canvas) canvas.dataset.empty = hasContent ? 'false' : 'true';
    }, [hasContent]);

    // Chargement des medias puis rendu de la frame courante
    useEffect(() => {
        const engine = engineRef.current;
        if (!engine || renderClips.length === 0) return undefined;
        let cancelled = false;
        Promise.allSettled([
            ...renderClips.map((clip) => engine.loadClip(clip)),
            ...renderAudio.map((track) => engine.loadAudioTrack(track)),
        ]).then(() => {
            if (cancelled) return;
            drawFrame(useVideoStore.getState().currentTime);
        });
        return () => { cancelled = true; };
    }, [drawFrame, renderAudio, renderClips]);

    // Lecture
    useEffect(() => {
        const engine = engineRef.current;
        if (!engine || renderClips.length === 0) return undefined;
        if (!isPlaying) {
            engine.stopPlayback();
            return undefined;
        }
        engine.startPlayback(
            plan.playbackClips,
            transitions,
            () => useVideoStore.getState().currentTime,
            (time, options = {}) => {
                // Le curseur suit la cadence reelle du moteur...
                setPlayheadTime(time);
                // ...tandis que le store reste throttle pour ne pas re-rendre
                // le storyboard, la timeline et l'inspecteur a chaque frame.
                const now = performance.now();
                if (options.force || now - lastStoreUpdateRef.current >= 90) {
                    lastStoreUpdateRef.current = now;
                    setCurrentTime(time);
                }
                const canvas = getSharedPreviewCanvas();
                if (canvas && options.rendered !== false) {
                    const state = useVideoStore.getState();
                    const currentPlan = resolveTimelineRenderPlan(state);
                    drawTextOverlays(canvas, currentPlan.textOverlays, time, state.selectedTextId);
                }
            },
            totalDuration,
            playbackSpeed,
            renderAudio,
            renderTransitions,
            { onEnded: () => setIsPlaying(false) },
        );
        return () => engine.stopPlayback();
    }, [isPlaying, plan.playbackClips, playbackSpeed, renderAudio, renderClips.length, renderTransitions, setCurrentTime, setIsPlaying, totalDuration, transitions]);

    // Rendu sur seek / edition
    useEffect(() => {
        if (!getSharedPreviewCanvas()) return undefined;
        drawFrame(useVideoStore.getState().currentTime);
        setPlayheadTime(useVideoStore.getState().currentTime);
        return useVideoStore.subscribe((state, previous) => {
            if (state.isPlaying) return;
            // Hors lecture, le store redevient la source du curseur (seek, undo,
            // suppression de scene qui raccourcit la timeline...).
            if (state.currentTime !== previous.currentTime) setPlayheadTime(state.currentTime);
            const changed = state.currentTime !== previous.currentTime
                || state.clips !== previous.clips
                || state.transitionItems !== previous.transitionItems
                || state.transitions !== previous.transitions
                || state.textOverlays !== previous.textOverlays
                || state.audioTracks !== previous.audioTracks
                || state.selectedTextId !== previous.selectedTextId
                || state.sequencePreset !== previous.sequencePreset;
            if (changed) {
                requestAnimationFrame(() => drawFrame(state.currentTime));
            }
        });
    }, [drawFrame]);

    // Mise a l'echelle sur le conteneur de l'ecran courant
    useEffect(() => {
        const canvas = getSharedPreviewCanvas();
        if (!canvas || !mountNode) return undefined;

        const resize = () => {
            const rect = mountNode.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const ratio = preset.width / preset.height;
            let width = rect.width;
            let height = width / ratio;
            if (height > rect.height) {
                height = rect.height;
                width = height * ratio;
            }
            canvas.width = Math.round(preset.width);
            canvas.height = Math.round(preset.height);
            canvas.style.width = `${Math.round(width)}px`;
            canvas.style.height = `${Math.round(height)}px`;
            canvas.style.aspectRatio = `${preset.width} / ${preset.height}`;
            if (!useVideoStore.getState().isPlaying) {
                drawFrame(useVideoStore.getState().currentTime);
            }
        };

        const observer = new ResizeObserver(resize);
        observer.observe(mountNode);
        resize();
        return () => observer.disconnect();
    }, [drawFrame, mountNode, preset.height, preset.width]);

    /* ---------- Selection et deplacement du texte a la souris ---------- */

    const getCanvasPoint = useCallback((event) => {
        const canvas = getSharedPreviewCanvas();
        if (!canvas) return { x: 0.5, y: 0.5 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        };
    }, []);

    const findTextAtPoint = useCallback((point, time) => {
        const canvas = getSharedPreviewCanvas();
        if (!canvas) return null;
        const state = useVideoStore.getState();
        const overlays = resolveTimelineRenderPlan(state).textOverlays;
        const context = canvas.getContext('2d');
        for (let index = overlays.length - 1; index >= 0; index -= 1) {
            const overlay = overlays[index];
            if (time < overlay.startTime || time > overlay.endTime) continue;
            const fontSize = Math.round((overlay.fontSize || 48) * (canvas.width / 1920));
            context.save();
            context.font = `${overlay.italic ? 'italic' : 'normal'} ${overlay.bold ? '700' : '400'} ${fontSize}px "${overlay.font || 'Inter'}", sans-serif`;
            const measured = context.measureText(overlay.content || '').width;
            context.restore();
            const halfWidth = Math.max(measured, fontSize) / 2 / canvas.width;
            const halfHeight = (fontSize * 0.75) / canvas.height;
            if (Math.abs(point.x - (overlay.x ?? 0.5)) <= halfWidth + 0.02
                && Math.abs(point.y - (overlay.y ?? 0.5)) <= halfHeight + 0.02) {
                return {
                    overlay,
                    box: { width: Math.max(measured, fontSize) + fontSize * 0.5, height: fontSize * 1.6 },
                };
            }
        }
        return null;
    }, []);

    useEffect(() => {
        const canvas = getSharedPreviewCanvas();
        if (!canvas) return undefined;

        const handlePointerDown = (event) => {
            const state = useVideoStore.getState();
            if (state.isPlaying) return;
            const point = getCanvasPoint(event);
            const currentPlan = resolveTimelineRenderPlan(state);
            const hit = findTextAtPoint(point, state.currentTime);

            if (!hit) {
                // Clic hors texte: on selectionne la scene affichee a cet instant,
                // pour ne jamais retomber sur un inspecteur vide.
                const active = currentPlan.clips.find((clip) => {
                    const start = Number(clip.start ?? clip.startTime ?? 0);
                    return state.currentTime >= start - 0.001
                        && state.currentTime <= start + Number(clip.duration || 0) + 0.001;
                });
                if (state.selectedTextId) state.setSelectedTextId(null);
                if (active) state.setSelectedClipId(active.sourceId || active.id);
                return;
            }

            state.setSelectedTextId(hit.overlay.id);
            state.setSelectedClipId(null);
            dragRef.current = {
                id: hit.overlay.id,
                offsetX: point.x - (hit.overlay.x ?? 0.5),
                offsetY: point.y - (hit.overlay.y ?? 0.5),
                x: hit.overlay.x ?? 0.5,
                y: hit.overlay.y ?? 0.5,
                snapX: null,
                snapY: null,
                box: hit.box,
            };
            canvas.dataset.dragging = 'true';
            canvas.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        };

        const handlePointerMove = (event) => {
            const drag = dragRef.current;
            if (!drag) return;
            const point = getCanvasPoint(event);
            const nextX = snapAxis(Math.max(0.04, Math.min(0.96, point.x - drag.offsetX)));
            const nextY = snapAxis(Math.max(0.04, Math.min(0.96, point.y - drag.offsetY)));
            drag.x = nextX.value;
            drag.y = nextY.value;
            drag.snapX = nextX.snapped;
            drag.snapY = nextY.snapped;
            useVideoStore.getState().updateTextOverlay(drag.id, { x: drag.x, y: drag.y });
        };

        const endDrag = (event) => {
            if (!dragRef.current) return;
            const { id, x, y } = dragRef.current;
            dragRef.current = null;
            canvas.dataset.dragging = 'false';
            canvas.releasePointerCapture?.(event.pointerId);
            // Position finale ecrite une seule fois dans l'historique.
            useVideoStore.getState().updateTextOverlay(id, { x, y }, { history: true });
            drawFrame(useVideoStore.getState().currentTime);
        };

        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);
        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            canvas.removeEventListener('pointermove', handlePointerMove);
            canvas.removeEventListener('pointerup', endDrag);
            canvas.removeEventListener('pointercancel', endDrag);
        };
    }, [drawFrame, findTextAtPoint, getCanvasPoint]);

    return null;
}

export function PreviewEngineProvider({ children }) {
    const [mountNode, setMountNode] = useState(null);
    const value = useMemo(() => ({ setMountNode }), []);
    return (
        <PreviewStageContext.Provider value={value}>
            {children}
            <PreviewEngineHost mountNode={mountNode} />
        </PreviewStageContext.Provider>
    );
}

export function usePreviewStageMount() {
    return useContext(PreviewStageContext);
}

export default PreviewEngineProvider;
