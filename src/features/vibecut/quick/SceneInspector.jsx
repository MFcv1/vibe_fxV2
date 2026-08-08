"use client";

import React, { useMemo } from 'react';
import { Blend, Check, Columns2, Grid2x2, Moon, MoveHorizontal, Scissors, Shuffle, Sun, Trash2, Type, Waves, Zap, ZoomIn } from 'lucide-react';
import { Button, Collapsible } from '../primitives';
import SceneIllustration, { getSceneVariantForKey } from '../media/SceneIllustration';
import { getServerRenderCapabilityStatus } from '@/features/vibefx-studio/video/export/exportManifest';
import { getAvailableMotions } from '../data/motionCatalog';
import { IMAGE_MOTION_ACCENTS } from '@/features/vibefx-studio/video/model/mediaModel';
import { TRANSITION_CATALOG } from '../data/transitionCatalog';
import useFavorites from '../adapters/useFavorites';
import { MAX_SCENE_DURATION, MIN_SCENE_DURATION } from '../adapters/useScenes';
import styles from './quick.module.css';

/*
 * Inspecteur contextuel du montage rapide: duree, mouvement, transition sortante,
 * volume, titre. Un seul endroit pour regler la scene selectionnee.
 */

const PREVIEW_ICONS = {
    dissolve: Blend,
    slide: MoveHorizontal,
    zoom: ZoomIn,
    blur: Waves,
    glitch: Shuffle,
    bars: Columns2,
    grid: Grid2x2,
    flash: Zap,
    'dip-white': Sun,
    'dip-black': Moon,
};

// Sous-ensemble volontairement court: le montage rapide doit rester lisible.
// La bibliotheque complete vit dans /video/transitions.
/*
 * Les six raccourcis du montage rapide sont tous EXPORTABLES depuis le lot L1.
 * Avant, quatre des six (`blur-dissolve`, `whip-pan`, `cross-zoom`, `flash`)
 * n'existaient qu'a l'apercu: on mettait donc en avant ce que l'export ne savait
 * pas rendre. Elles restent accessibles dans la bibliotheque complete, marquees
 * « Apercu uniquement » par le badge de capacite.
 */
const QUICK_TRANSITION_IDS = ['crossfade', 'dip-black', 'film-dissolve', 'swipe-left', 'push-up', 'blur-cut'];

/*
 * LOT B1 - ces six raccourcis deviennent LES FAVORIS DE L'UTILISATEUR.
 *
 * C'est la seconde moitie du besoin exprime: « pouvoir les mettre en favori, et
 * donc les utiliser dans les modes EN CONNAISSANCE DE CAUSE ». On juge une fois,
 * en grand, dans la bibliotheque; on retrouve ensuite ses preferes ici, ou il n'y
 * a pas la place d'afficher des apercus.
 *
 * Repli sur les six d'origine tant qu'aucun favori n'est pose: un utilisateur qui
 * n'est jamais alle dans la bibliotheque ne doit pas tomber sur une liste vide.
 * Plafond a huit pour que le montage rapide reste lisible - la bibliotheque
 * complete est a un clic.
 */
const QUICK_TRANSITION_LIMIT = 8;

function MotionCard({ motion, active, onSelect, sceneKey }) {
    const from = motion.motionPreview?.from || {};
    const to = motion.motionPreview?.to || {};
    const style = {
        '--from-scale': from.scale ?? 1,
        '--to-scale': to.scale ?? 1,
        '--from-x': `${from.x ?? 0}%`,
        '--to-x': `${to.x ?? 0}%`,
        '--from-y': `${from.y ?? 0}%`,
        '--to-y': `${to.y ?? 0}%`,
        '--from-rotate': `${from.rotate ?? 0}deg`,
        '--to-rotate': `${to.rotate ?? 0}deg`,
    };
    return (
        <button
            type="button"
            onClick={() => onSelect(motion.id)}
            aria-pressed={active}
            title={motion.description}
            data-testid={`vibecut-motion-${motion.id}`}
            className={[styles.motionCard, active ? styles.motionCardActive : ''].filter(Boolean).join(' ')}
        >
            <span className={styles.motionArt} style={style}>
                <span className={styles.motionFrame}>
                    <SceneIllustration
                        variant={getSceneVariantForKey(`${sceneKey}-${motion.id}`)}
                        style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                </span>
                {active ? <span className={styles.motionCheck}><Check size={11} /></span> : null}
            </span>
            <span className={styles.motionLabel}>{motion.name}</span>
        </button>
    );
}

export default function SceneInspector({ scene, scenes, actions, canSplit = false }) {
    const motions = useMemo(() => getAvailableMotions(), []);
    const { favorites } = useFavorites('transitions');
    const quickTransitions = useMemo(() => (
        (favorites.length > 0 ? favorites : QUICK_TRANSITION_IDS)
            .map((id) => TRANSITION_CATALOG.find((transition) => transition.id === id))
            .filter(Boolean)
            .slice(0, QUICK_TRANSITION_LIMIT)
            .map((transition) => ({
                /*
                 * Les six raccourcis d'origine sont tous exportables. Un favori,
                 * lui, peut ne pas l'etre: l'utilisateur a le droit de mettre en
                 * favori une transition « apercu uniquement ». On la lui rend
                 * donc - c'est son choix - mais on le DIT, avec la meme mention
                 * que l'inspecteur du montage avance. La regle du projet est de
                 * ne jamais proposer ce que l'export ne rend pas SANS mention
                 * explicite; la retirer en silence serait pire.
                 */
                ...transition,
                exportable: getServerRenderCapabilityStatus(
                    'timedTransition',
                    transition.engineId || transition.id,
                ).supported,
            }))
    ), [favorites]);

    if (!scene) {
        return (
            <p className={styles.inspectorEmpty}>
                Sélectionne une scène dans le storyboard pour régler sa durée, son mouvement et sa transition.
            </p>
        );
    }

    const activeTransitionId = scene.transitionToNext
        ? quickTransitions.find((transition) => transition.engineId === scene.transitionToNext.type)?.id || null
        : null;

    return (
        <>
            <div className={styles.group}>
                <div className={styles.groupHead}>
                    <h2 className={styles.groupTitle}>Scène {scene.index + 1}</h2>
                    <span className={styles.groupValue}>{scene.isImage ? 'Photo' : 'Vidéo'}</span>
                </div>
                <p className={styles.groupNote}>{scene.name}</p>
            </div>

            <div className={styles.group}>
                <div className={styles.groupHead}>
                    <h3 className={styles.groupTitle}>Durée</h3>
                    <span className={styles.groupValue} data-numeric="true" data-testid="vibecut-inspector-duration">
                        {scene.duration.toFixed(1)} s
                    </span>
                </div>
                <input
                    type="range"
                    className={styles.slider}
                    min={MIN_SCENE_DURATION}
                    max={scene.isImage ? 15 : Math.max(MIN_SCENE_DURATION, Math.min(MAX_SCENE_DURATION, scene.sourceDuration))}
                    step={0.1}
                    value={Number(scene.duration.toFixed(1))}
                    onChange={(event) => actions.setSceneDuration(scene, Number(event.target.value))}
                    aria-label="Durée de la scène en secondes"
                    data-testid="vibecut-duration-slider"
                />
                {!scene.isImage ? (
                    <p className={styles.groupNote}>
                        Raccourcir une vidéo coupe la fin du plan, la source n’est jamais étirée.
                    </p>
                ) : null}
            </div>

            <Collapsible
                title="Mouvement"
                defaultOpen
                testId="vibecut-section-motion"
                value={scenes.length > 1 ? (
                    <button
                        type="button"
                        className={styles.linkAction}
                        onClick={(event) => {
                            event.stopPropagation();
                            actions.applyMotionToAllImages(scenes, scene.motionPreset || 'none');
                        }}
                        data-testid="vibecut-motion-apply-all"
                    >
                        Appliquer à toutes
                    </button>
                ) : null}
            >
                <div className={styles.motionGrid}>
                    {motions.map((motion) => (
                        <MotionCard
                            key={motion.id}
                            motion={motion}
                            sceneKey={scene.id}
                            active={(scene.motionPreset || 'none') === motion.id}
                            onSelect={(id) => actions.setSceneMotion(scene, id)}
                        />
                    ))}
                </div>

                {/*
                  * L'ACCENT se COMPOSE avec le mouvement, il ne le remplace pas:
                  * une secousse sur un zoom avant est un cas courant. D'ou une
                  * rangee separee et non une carte de plus dans la grille.
                  */}
                <div className={styles.accentRow} data-testid="vibecut-accent-row">
                    <span className={styles.accentLabel}>Effet pendant le plan</span>
                    <div className={styles.accentChoices}>
                        {IMAGE_MOTION_ACCENTS.map((accent) => (
                            <button
                                key={accent.id}
                                type="button"
                                className={[
                                    styles.accentChip,
                                    (scene.motionAccent || 'none') === accent.id ? styles.accentChipActive : '',
                                ].filter(Boolean).join(' ')}
                                aria-pressed={(scene.motionAccent || 'none') === accent.id}
                                title={accent.description}
                                data-testid={`vibecut-accent-${accent.id}`}
                                onClick={() => actions.setSceneAccent(scene, accent.id)}
                            >
                                {accent.name}
                            </button>
                        ))}
                    </div>
                </div>
            </Collapsible>

            {scene.nextSceneId ? (
                <Collapsible
                    title={`Transition vers la scène ${scene.index + 2}`}
                    defaultOpen={false}
                    testId="vibecut-inspector-transition"
                    value={scene.transitionToNext ? (scene.transitionToNext.name || 'Active') : 'Coupe franche'}
                >
                    <p className={styles.groupNote} data-testid="vibecut-quick-transition-source">
                        {favorites.length > 0
                            ? 'Tes favoris de la bibliothèque de transitions.'
                            : 'Une sélection courte. Mets des favoris dans la bibliothèque pour les retrouver ici.'}
                    </p>
                    <div className={styles.transitionList}>
                        <button
                            type="button"
                            onClick={() => actions.applyTransition(scene, null)}
                            aria-pressed={!scene.transitionToNext}
                            className={[styles.transitionOption, !scene.transitionToNext ? styles.transitionOptionActive : ''].filter(Boolean).join(' ')}
                            data-testid="vibecut-transition-none"
                        >
                            <span className={styles.transitionIcon}><Columns2 size={14} /></span>
                            <span className={styles.transitionText}>
                                <span className={styles.transitionName}>Coupe franche</span>
                                <span className={styles.transitionHint}>Aucune transition</span>
                            </span>
                        </button>
                        {quickTransitions.map((transition) => {
                            const Icon = PREVIEW_ICONS[transition.preview] || Blend;
                            const active = activeTransitionId === transition.id;
                            return (
                                <button
                                    key={transition.id}
                                    type="button"
                                    onClick={() => actions.applyTransition(scene, {
                                        ...transition,
                                        duration: scene.transitionToNext?.duration || transition.defaultDuration,
                                    })}
                                    aria-pressed={active}
                                    className={[styles.transitionOption, active ? styles.transitionOptionActive : ''].filter(Boolean).join(' ')}
                                    data-testid={`vibecut-transition-${transition.id}`}
                                >
                                    <span className={styles.transitionIcon}><Icon size={14} /></span>
                                    <span className={styles.transitionText}>
                                        <span className={styles.transitionName}>
                                            {transition.name}
                                            {transition.exportable ? null : (
                                                <span className={styles.transitionFlag}>Aperçu</span>
                                            )}
                                        </span>
                                        <span className={styles.transitionHint}>{transition.description}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {scene.transitionToNext ? (
                        <>
                            <div className={styles.groupHead}>
                                <span className={styles.groupValue}>Durée de la transition</span>
                                <span className={styles.groupValue} data-numeric="true">
                                    {scene.transitionToNext.duration.toFixed(1)} s
                                </span>
                            </div>
                            <input
                                type="range"
                                className={styles.slider}
                                min={0.1}
                                max={1.5}
                                step={0.05}
                                value={scene.transitionToNext.duration}
                                onChange={(event) => actions.applyTransition(scene, {
                                    engineId: scene.transitionToNext.type,
                                    name: scene.transitionToNext.name,
                                    duration: Number(event.target.value),
                                })}
                                aria-label="Durée de la transition en secondes"
                                data-testid="vibecut-transition-duration"
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => actions.applyTransitionToAll(scenes, {
                                    engineId: scene.transitionToNext.type,
                                    name: scene.transitionToNext.name,
                                    duration: scene.transitionToNext.duration,
                                })}
                                data-testid="vibecut-transition-apply-all"
                            >
                                Appliquer à toutes les coupes
                            </Button>
                        </>
                    ) : null}
                </Collapsible>
            ) : null}

            {!scene.isImage ? (
                <div className={styles.group}>
                    <div className={styles.groupHead}>
                        <h3 className={styles.groupTitle}>Volume de la scène</h3>
                        <span className={styles.groupValue} data-numeric="true">{Math.round(scene.volume)} %</span>
                    </div>
                    <input
                        type="range"
                        className={styles.slider}
                        min={0}
                        max={100}
                        step={1}
                        value={scene.volume}
                        onChange={(event) => actions.setSceneVolume(scene.id, Number(event.target.value))}
                        aria-label="Volume de la scène"
                        data-testid="vibecut-volume-slider"
                    />
                </div>
            ) : null}

            <div className={styles.group}>
                <h3 className={styles.groupTitle}>Actions</h3>
                <Button
                    variant="secondary"
                    block
                    icon={<Scissors size={16} />}
                    disabled={!canSplit}
                    onClick={() => actions.splitSceneAtPlayhead(scene)}
                    title={canSplit
                        ? 'Couper la scène à la position de lecture'
                        : 'Place la tête de lecture à l’intérieur de la scène pour la couper'}
                    data-testid="vibecut-split-scene"
                >
                    Couper la scène ici
                </Button>
                <Button
                    variant="secondary"
                    block
                    icon={<Type size={16} />}
                    onClick={() => actions.addSceneTitle(scene, 'Ton titre')}
                    data-testid="vibecut-add-title"
                >
                    Ajouter un titre sur cette scène
                </Button>
                <Button
                    variant="danger"
                    block
                    icon={<Trash2 size={16} />}
                    onClick={() => actions.removeScene(scene.id)}
                    data-testid="vibecut-remove-scene"
                >
                    Supprimer la scène
                </Button>
            </div>
        </>
    );
}
