"use client";

import React, { useCallback, useMemo } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { getServerRenderCapabilityStatus } from '@/features/vibefx-studio/video/export/exportManifest';
import { Badge, Button, Collapsible } from '../primitives';
import {
    MIN_TRANSITION_DURATION,
    clampTransitionDuration,
    getMaxTransitionDuration,
} from '../adapters/useTimeline';
import { getAvailableMotions } from '../data/motionCatalog';
import { TRANSITION_CATALOG } from '../data/transitionCatalog';
import TextInspector from '../quick/TextInspector';
import styles from './advanced.module.css';

/*
 * Inspecteur contextuel du montage avance.
 *
 * Regle tenue partout: on n'expose que ce que l'un des deux moteurs rend, et on
 * dit LEQUEL. La vitesse est le cas limite - l'apercu la joue, le renderer
 * serveur non (`clipSpeeds: [1]`) - elle porte donc son badge et le pre-vol de
 * l'export la refuse explicitement.
 */

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const ROTATIONS = [0, 90, 180, 270];

const COLOR_CONTROLS = [
    { key: 'exposure', label: 'Exposition', min: -100, max: 100, neutral: 0 },
    { key: 'contrast', label: 'Contraste', min: 0, max: 200, neutral: 100 },
    { key: 'saturation', label: 'Saturation', min: 0, max: 200, neutral: 100 },
    { key: 'temperature', label: 'Température', min: -100, max: 100, neutral: 0 },
    { key: 'vignette', label: 'Vignettage', min: 0, max: 100, neutral: 0 },
    { key: 'grain', label: 'Grain', min: 0, max: 100, neutral: 0 },
];

const MOTION_INTENSITY_MIN = 0;
const MOTION_INTENSITY_MAX = 100;

function formatSeconds(value = 0) {
    return `${(Math.round((Number(value) || 0) * 100) / 100).toFixed(2)} s`;
}

function EmptyInspector() {
    return (
        <div className={styles.inspectorEmpty} data-testid="vibecut-inspector-empty">
            <p className={styles.inspectorEmptyTitle}>Rien de sélectionné</p>
            <p className={styles.inspectorEmptyBody}>
                Clique un élément de la timeline pour régler son mouvement, sa vitesse,
                sa colorimétrie ou son son.
            </p>
        </div>
    );
}

/*
 * Transition vers le plan suivant.
 *
 * C'etait le trou du montage avance: la piste Transitions existait, mais aucun
 * controle ne permettait d'en poser une. On la regle donc la ou on regle le
 * plan qui la precede, comme dans le montage rapide, en passant par la meme
 * action `applyTransition`.
 *
 * Les 15 transitions minutees rendues par le serveur viennent en premier; les
 * autres restent proposables mais annoncent qu'elles ne survivront pas a
 * l'export Pro. On n'en cache aucune, on ne ment sur aucune.
 */
function TransitionToNextPanel({ scene, scenes, sceneActions, defaultOpen = false, focusKey = 'none' }) {
    const options = useMemo(() => {
        const decorated = TRANSITION_CATALOG.map((entry) => ({
            ...entry,
            status: getServerRenderCapabilityStatus('timedTransition', entry.engineId || entry.id),
        }));
        return {
            exportable: decorated.filter((entry) => entry.status.supported),
            previewOnly: decorated.filter((entry) => !entry.status.supported),
        };
    }, []);

    const current = scene.transitionToNext;
    const activeId = current?.type || null;
    const nextScene = scenes.find((entry) => entry.id === scene.nextSceneId) || null;
    const maxDuration = getMaxTransitionDuration(scene.duration, nextScene?.duration ?? scene.duration);
    const duration = Math.min(maxDuration, Number(current?.duration) || 0.6);

    const apply = useCallback((entry) => {
        if (!entry) {
            sceneActions.applyTransition(scene, null);
            return;
        }
        sceneActions.applyTransition(scene, {
            engineId: entry.engineId || entry.id,
            name: entry.name,
            group: entry.group,
            // Une transition ne peut pas devorer le plan: meme plafond que les
            // presets guides, une seule regle dans tout le produit.
            duration: clampTransitionDuration(
                current?.duration || entry.defaultDuration || 0.6,
                scene.duration,
                nextScene?.duration ?? scene.duration,
            ),
        });
    }, [current?.duration, nextScene?.duration, scene, sceneActions]);

    const renderOption = (entry) => (
        <button
            key={entry.id}
            type="button"
            className={styles.transitionOption}
            aria-pressed={activeId === (entry.engineId || entry.id)}
            onClick={() => apply(entry)}
            data-testid={`vibecut-adv-transition-${entry.id}`}
        >
            <span className={styles.transitionName}>{entry.name}</span>
            {entry.status.supported ? null : (
                <span className={styles.transitionFlag}>Aperçu</span>
            )}
        </button>
    );

    return (
        <Collapsible
            key={`transition-${focusKey}`}
            title="Transition"
            defaultOpen={defaultOpen}
            value={<Badge tone="neutral">{current?.name || 'Coupe franche'}</Badge>}
            testId="vibecut-inspector-transition-next"
        >
            <p className={styles.sectionHint}>
                S’applique à la coupe entre ce plan et le plan {scene.index + 2}.
            </p>
            <div className={styles.transitionList}>
                <button
                    type="button"
                    className={styles.transitionOption}
                    aria-pressed={!current}
                    onClick={() => apply(null)}
                    data-testid="vibecut-adv-transition-none"
                >
                    <span className={styles.transitionName}>Coupe franche</span>
                </button>
                {options.exportable.map(renderOption)}
            </div>

            <p className={styles.groupLabel}>Aperçu uniquement</p>
            <div className={styles.transitionList}>
                {options.previewOnly.map(renderOption)}
            </div>

            {current ? (
                <>
                    <label className={styles.sliderRow}>
                        <span className={styles.sliderLabel}>
                            Durée
                            <span className={styles.sliderValue} data-numeric="true">{formatSeconds(duration)}</span>
                        </span>
                        <input
                            type="range"
                            min={MIN_TRANSITION_DURATION}
                            max={maxDuration}
                            step={0.05}
                            value={duration}
                            onChange={(event) => sceneActions.applyTransition(scene, {
                                engineId: current.type,
                                name: current.name,
                                duration: clampTransitionDuration(
                                    Number(event.target.value),
                                    scene.duration,
                                    nextScene?.duration ?? scene.duration,
                                ),
                            })}
                            aria-label="Durée de la transition"
                            data-testid="vibecut-adv-transition-duration"
                        />
                    </label>
                    <p className={styles.note} data-testid="vibecut-transition-ceiling">
                        Maximum {formatSeconds(maxDuration)} : une transition ne prend jamais plus de
                        45 % du plus court des deux plans, sinon il ne resterait plus rien à voir.
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sceneActions.applyTransitionToAll(scenes, {
                            engineId: current.type,
                            name: current.name,
                            duration,
                        })}
                        data-testid="vibecut-adv-transition-all"
                    >
                        Appliquer à toutes les coupes
                    </Button>
                </>
            ) : null}
        </Collapsible>
    );
}

function ClipPanels({ item, actions, motions, scene, scenes, sceneActions, focusSection = null }) {
    const focusKey = focusSection || 'none';
    const clip = item.source || {};
    const isImage = (clip.mediaType || clip.type) === 'image' || String(clip.type || '').startsWith('image');
    const motion = clip.motion || { preset: 'none', intensity: 1 };
    const intensityPercent = Math.round((Number(motion.intensity ?? 1)) * 100);
    const speed = Number(clip.speed) > 0 ? Number(clip.speed) : 1;
    const speedStatus = getServerRenderCapabilityStatus('clipSpeed', speed);
    const filters = useMemo(() => clip.filters || {}, [clip.filters]);

    const setFilter = useCallback((key, value) => {
        actions.setClipFilters(clip.id, { ...filters, [key]: value });
    }, [actions, clip.id, filters]);

    const resetFilters = useCallback(() => {
        const next = { ...filters };
        COLOR_CONTROLS.forEach((control) => { next[control.key] = control.neutral; });
        actions.setClipFilters(clip.id, next, { history: true });
    }, [actions, clip.id, filters]);

    const hasGrade = COLOR_CONTROLS.some((control) => (
        Number(filters[control.key] ?? control.neutral) !== control.neutral
    ));

    return (
        <>
            {isImage ? (
                <Collapsible
                    key={`motion-${focusKey}`}
                    title="Mouvement"
                    defaultOpen={focusSection ? focusSection === 'motion' : true}
                    testId="vibecut-inspector-motion"
                >
                    <p className={styles.sectionHint}>
                        Anime la photo pendant toute sa durée à l’écran.
                    </p>
                    <div className={styles.motionGrid}>
                        {motions.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                className={styles.motionChip}
                                aria-pressed={motion.preset === entry.engineId}
                                /*
                                 * On n'etale PAS l'ancien mouvement: `start` et
                                 * `end` y survivraient au changement de preset,
                                 * et la photo continuerait de zoomer alors que
                                 * l'interface annoncerait « Fixe ».
                                 */
                                onClick={() => actions.setClipMotion(clip.id, {
                                    preset: entry.engineId,
                                    easing: motion.easing,
                                    intensity: motion.intensity,
                                })}
                                data-testid={`vibecut-adv-motion-${entry.id}`}
                            >
                                {entry.name}
                            </button>
                        ))}
                    </div>

                    <label className={styles.sliderRow}>
                        <span className={styles.sliderLabel}>
                            Intensité du mouvement
                            <span className={styles.sliderValue} data-numeric="true" data-testid="vibecut-motion-intensity-value">
                                {intensityPercent} %
                            </span>
                        </span>
                        <input
                            type="range"
                            min={MOTION_INTENSITY_MIN}
                            max={MOTION_INTENSITY_MAX}
                            step={5}
                            value={intensityPercent}
                            disabled={motion.preset === 'none'}
                            onChange={(event) => actions.setClipMotion(clip.id, {
                                preset: motion.preset,
                                easing: motion.easing,
                                intensity: Number(event.target.value) / 100,
                            }, { history: false })}
                            aria-label="Intensité du mouvement"
                            data-testid="vibecut-motion-intensity"
                        />
                    </label>
                    <p className={styles.note}>
                        {motion.preset === 'none'
                            ? 'Choisis d’abord un mouvement : l’intensité n’a rien à régler sur un plan fixe.'
                            : 'L’intensité raccourcit la course du mouvement sans recadrer la photo. L’export applique exactement le même facteur.'}
                    </p>
                </Collapsible>
            ) : null}

            <Collapsible
                key={`transform-${focusKey}`}
                title="Transformation"
                defaultOpen={focusSection === 'transform'}
                testId="vibecut-inspector-transform"
            >
                <p className={styles.sectionHint}>Oriente l’image dans le cadre.</p>
                <div className={styles.chipRow}>
                    {ROTATIONS.map((angle) => (
                        <button
                            key={angle}
                            type="button"
                            className={styles.chip}
                            aria-pressed={(Number(clip.orientationRotation) || 0) === angle}
                            onClick={() => actions.setClipRotation(clip.id, angle)}
                            data-testid={`vibecut-rotation-${angle}`}
                        >
                            {angle}°
                        </button>
                    ))}
                </div>
                <p className={styles.note}>Rotation appliquée à l’aperçu et à l’export serveur.</p>
            </Collapsible>

            <Collapsible
                key={`speed-${focusKey}`}
                title="Vitesse"
                defaultOpen={focusSection === 'speed'}
                value={<Badge tone={speedStatus.supported ? 'neutral' : 'warning'}>{speedStatus.label}</Badge>}
                testId="vibecut-inspector-speed"
            >
                <p className={styles.sectionHint}>Accélère ou ralentit la lecture de ce plan.</p>
                <div className={styles.chipRow}>
                    {SPEEDS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            className={styles.chip}
                            aria-pressed={Math.abs(speed - value) < 0.001}
                            onClick={() => actions.setClipSpeed(clip.id, value)}
                            data-testid={`vibecut-speed-${String(value).replace('.', '-')}`}
                        >
                            {value}×
                        </button>
                    ))}
                </div>
                {!speedStatus.supported ? (
                    <p className={styles.warning} data-testid="vibecut-speed-warning">
                        Le renderer serveur ne change pas encore la vitesse : l’export Pro sera refusé
                        tant qu’un clip n’est pas à 1×.
                    </p>
                ) : null}
            </Collapsible>

            <Collapsible
                key={`color-${focusKey}`}
                title="Colorimétrie"
                defaultOpen={focusSection === 'color'}
                value={hasGrade ? (
                    <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={resetFilters} data-testid="vibecut-color-reset">
                        Neutre
                    </Button>
                ) : null}
                testId="vibecut-inspector-color"
            >
                <p className={styles.sectionHint}>Étalonne l’image de ce plan seulement.</p>
                {COLOR_CONTROLS.map((control) => (
                    <label key={control.key} className={styles.sliderRow}>
                        <span className={styles.sliderLabel}>
                            {control.label}
                            <span className={styles.sliderValue} data-numeric="true">
                                {Math.round(Number(filters[control.key] ?? control.neutral))}
                            </span>
                        </span>
                        <input
                            type="range"
                            min={control.min}
                            max={control.max}
                            value={Number(filters[control.key] ?? control.neutral)}
                            onChange={(event) => setFilter(control.key, Number(event.target.value))}
                            aria-label={control.label}
                            data-testid={`vibecut-color-${control.key}`}
                        />
                    </label>
                ))}
                <p className={styles.note}>Rendu par `eq`, `colorbalance`, `vignette` et `noise` à l’export.</p>
            </Collapsible>

            {scene?.nextSceneId ? (
                <TransitionToNextPanel
                    scene={scene}
                    scenes={scenes}
                    sceneActions={sceneActions}
                    defaultOpen={focusSection === 'transition'}
                    focusKey={focusSection || 'none'}
                />
            ) : null}

            <Collapsible
                key={`clip-audio-${focusSection || 'none'}`}
                title="Son du plan"
                defaultOpen={focusSection === 'audio'}
                testId="vibecut-inspector-clip-audio"
            >
                <p className={styles.sectionHint}>Volume du son enregistré avec ce plan.</p>
                <label className={styles.sliderRow}>
                    <span className={styles.sliderLabel}>
                        Volume
                        <span className={styles.sliderValue} data-numeric="true">
                            {Math.round(Number(clip.volume ?? 100))} %
                        </span>
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Number(clip.volume ?? 100)}
                        onChange={(event) => actions.setClipVolume(clip.id, Number(event.target.value))}
                        aria-label="Volume du plan"
                        data-testid="vibecut-clip-volume"
                    />
                </label>
            </Collapsible>
        </>
    );
}

function MusicPanels({ item, onUpdate, onRemove }) {
    const track = item.source || {};
    return (
        <>
            <Collapsible title="Musique" testId="vibecut-inspector-music">
                <p className={styles.readout}>{track.name || 'Piste sans nom'}</p>
                <label className={styles.sliderRow}>
                    <span className={styles.sliderLabel}>
                        Volume
                        <span className={styles.sliderValue} data-numeric="true">
                            {Math.round(Number(track.volume ?? 70))} %
                        </span>
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Number(track.volume ?? 70)}
                        onChange={(event) => onUpdate({ volume: Number(event.target.value) })}
                        aria-label="Volume de la piste musicale"
                        data-testid="vibecut-music-volume"
                    />
                </label>
                <label className={styles.sliderRow}>
                    <span className={styles.sliderLabel}>
                        Fondu de sortie
                        <span className={styles.sliderValue} data-numeric="true">{formatSeconds(track.fadeOut ?? 0)}</span>
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.5}
                        value={Number(track.fadeOut ?? 0)}
                        onChange={(event) => onUpdate({ fadeOut: Number(event.target.value) })}
                        aria-label="Fondu de sortie de la musique"
                        data-testid="vibecut-music-fadeout"
                    />
                </label>
                <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={onRemove} data-testid="vibecut-music-remove">
                    Retirer la musique
                </Button>
            </Collapsible>
        </>
    );
}

export default function Inspector({
    item, actions, totalDuration, sceneActions, scenes = [], focusSection = null,
}) {
    const motions = useMemo(() => getAvailableMotions(), []);
    /*
     * Une transition selectionnee renvoie a la scene qui la PRECEDE: c'est elle
     * qui la porte, et `applyTransition` reste le chemin d'ecriture unique.
     */
    const clipId = item?.type === 'video'
        ? (item.sourceId || item.id)
        : item?.type === 'transition'
            ? (item.params?.fromItemId || item.fromItemId)
            : null;
    const scene = useMemo(
        () => (clipId ? scenes.find((entry) => entry.id === clipId) || null : null),
        [clipId, scenes],
    );

    if (!item) {
        return (
            <aside className={styles.inspector} data-testid="vibecut-advanced-inspector" aria-label="Inspecteur">
                <EmptyInspector />
            </aside>
        );
    }

    // On lisait « IMG_0161 » sans savoir de quel type d'objet il s'agissait.
    const KINDS = {
        video: 'Plan vidéo',
        text: 'Texte',
        transition: 'Transition',
        audio: 'Musique',
    };
    const kind = KINDS[item.type] || 'Élément';
    const detail = item.type === 'video'
        ? (item.source?.name || null)
        : item.type === 'transition'
            ? (scene?.transitionToNext?.name || null)
            : item.type === 'audio'
                ? (item.source?.name || null)
                : null;

    return (
        <aside className={styles.inspector} data-testid="vibecut-advanced-inspector" aria-label="Inspecteur">
            <header className={styles.inspectorHead}>
                <span className={styles.inspectorKind} data-testid="vibecut-inspector-kind">{kind}</span>
                <h2 className={styles.panelTitle} data-testid="vibecut-inspector-title">
                    {detail || kind}
                </h2>
                <span className={styles.inspectorTiming} data-numeric="true" data-testid="vibecut-inspector-timing">
                    {formatSeconds(item.duration)}
                </span>
            </header>

            <div className={styles.inspectorPanels}>
                {item.type === 'video' ? (
                    <ClipPanels
                        item={item}
                        actions={actions}
                        motions={motions}
                        scene={scene}
                        scenes={scenes}
                        sceneActions={sceneActions}
                        focusSection={focusSection}
                    />
                ) : null}

                {item.type === 'text' ? (
                    <TextInspector text={item.source} totalDuration={totalDuration} actions={sceneActions} />
                ) : null}

                {item.type === 'transition' && scene ? (
                    <TransitionToNextPanel
                        scene={scene}
                        scenes={scenes}
                        sceneActions={sceneActions}
                        defaultOpen
                        focusKey="selected"
                    />
                ) : null}

                {item.type === 'audio' && !item.params?.embedded ? (
                    <MusicPanels
                        item={item}
                        onUpdate={(updates) => sceneActions.updateMusic(item.id, updates)}
                        onRemove={() => sceneActions.removeMusic(item.id)}
                    />
                ) : null}
            </div>
        </aside>
    );
}
