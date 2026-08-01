"use client";

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ImagePlus, RotateCcw } from 'lucide-react';
import {
    IMAGE_MOTION_PRESETS,
    MAX_IMAGE_DURATION_SECONDS,
    MIN_IMAGE_DURATION_SECONDS,
} from '@/features/vibefx-studio/video/model/mediaModel';
import { getServerRenderCapabilityStatus } from '@/features/vibefx-studio/video/export/exportManifest';
import { Badge, Button, EmptyState } from '../primitives';
import { useSceneActions, useScenes } from '../adapters/useScenes';
import useVibeCutProject from '../adapters/useVibeCutProject';
import { MOTION_CATALOG, MOTION_GROUPS } from '../data/motionCatalog';
import MotionPreview from './MotionPreview';
import useLibraryImages from './useLibraryImages';
import styles from './library.module.css';

/*
 * Bibliotheque de mouvements (phase 5).
 *
 * Comme la bibliotheque de transitions, chaque vignette est dessinee par la
 * transformation de PRODUCTION (`applyImageMotionTransform`), sur une photo
 * reelle du projet. Ce qu'on regle ici est donc ce que l'export produira - le
 * lot L3 a mis la parite du mouvement au niveau du pixel, cet ecran ne la casse
 * pas en reimplementant la formule dans son coin.
 *
 * -------------------------------------------------------------------------
 * DEUX LIMITES ASSUMEES, ET DITES A L'ECRAN
 *
 * 1. COURBE. Le renderer ecrit `smoothstep` en dur dans son expression
 *    `zoompan` (lot L3). Une courbe LINEAIRE existe dans le modele d'apercu
 *    mais ne survivrait pas a l'export: elle est donc affichee et DESACTIVEE,
 *    marquee « Bientôt », comme les mouvements que le moteur ne rend pas.
 *    L'alternative - la proposer avec un badge - aurait cree une dette de
 *    parite de plus, exactement ce que les lots L1 a L3 ont passe trois
 *    sessions a resorber.
 *
 * 2. FENETRE DE CADRAGE (probleme I). `zoompan` borne sa fenetre a l'image, le
 *    canvas non: une trajectoire dont la fenetre sort du cadre diverge
 *    franchement entre apercu et export (74/255 mesures). La condition a tenir
 *    est |x| <= (zoom - 1) / 2. L'editeur de trajectoire la fait respecter au
 *    lieu de la documenter: on ne peut pas construire ici un mouvement
 *    inexportable.
 * -------------------------------------------------------------------------
 */

const MOTION_PRESET_FRAMES = new Map(IMAGE_MOTION_PRESETS.map((preset) => [preset.id, preset]));

/*
 * Probleme I, applique. Le decalage maximal admissible pour un zoom donne est
 * (zoom - 1) / 2: au-dela, la fenetre echantillonnee sort de l'image, et FFmpeg
 * la ramene dans le cadre alors que le canvas ne le fait pas.
 */
export function maxOffsetForScale(scale) {
    return Math.max(0, (Math.max(1, Number(scale) || 1) - 1) / 2);
}

function clampFrame(frame) {
    const scale = Math.min(2, Math.max(1, Number(frame?.scale) || 1));
    const limit = maxOffsetForScale(scale);
    const bound = (value) => Math.max(-limit, Math.min(limit, Number(value) || 0));
    return { scale: Math.round(scale * 1000) / 1000, x: bound(frame?.x), y: bound(frame?.y) };
}

function frameFromPreset(presetId) {
    const preset = MOTION_PRESET_FRAMES.get(presetId) || MOTION_PRESET_FRAMES.get('none');
    return { start: clampFrame(preset.start), end: clampFrame(preset.end) };
}

function formatOffset(value) {
    return `${(Number(value) * 100).toFixed(1)} %`;
}

export default function MotionLibrary() {
    /*
     * Voir `TransitionLibrary`: la sauvegarde automatique est debouncee a 1,2 s,
     * et on applique ici pour repartir aussitot vers le montage. Sans flush, le
     * mouvement applique etait perdu au retour.
     */
    const { projectId, saveNow } = useVibeCutProject();
    const { scenes } = useScenes();
    const sceneActions = useSceneActions();
    const images = useLibraryImages(scenes);

    const [selectedId, setSelectedId] = useState('zoom-in');
    const [intensity, setIntensity] = useState(1);
    const [frames, setFrames] = useState(() => frameFromPreset('zoom-in'));
    const [sceneIndex, setSceneIndex] = useState(0);
    const [notice, setNotice] = useState(null);

    const catalog = useMemo(() => MOTION_CATALOG.map((entry) => ({
        ...entry,
        /*
         * Double condition, et c'est voulu: une entree doit exister dans le
         * MOTEUR (`availability`) ET dans les capacites serveur. Une entree qui
         * ne passerait qu'un des deux tests promettrait quelque chose.
         */
        status: entry.engineId
            ? getServerRenderCapabilityStatus('imageMotion', entry.engineId)
            : { supported: false, status: 'planned', label: 'Bientôt' },
    })), []);

    const selected = catalog.find((entry) => entry.id === selectedId) || catalog[0];
    const isApplicable = selected.availability === 'available' && selected.status.supported;

    // Seules les PHOTOS sont concernees: le moteur n'anime pas encore les videos.
    const photos = useMemo(() => scenes.filter((scene) => scene.isImage), [scenes]);
    const activeScene = photos[Math.min(sceneIndex, Math.max(0, photos.length - 1))] || null;

    /*
     * Choisir un mouvement reprend SES cadrages. On ne le fait pas depuis un
     * effet: c'est une consequence directe du clic, et un effet y ajouterait un
     * rendu en cascade. C'est aussi le correctif du bug 28 rejoue ici - on ne
     * garde jamais les cadrages du mouvement precedent, sinon la photo
     * continuerait de zoomer alors que l'interface annonce autre chose.
     */
    const handleSelect = useCallback((entry) => {
        setSelectedId(entry.id);
        setFrames(frameFromPreset(entry.engineId || 'none'));
        setNotice(null);
    }, []);

    const motion = useMemo(() => ({
        preset: selected.engineId || 'none',
        easing: 'ease-in-out',
        intensity,
        start: frames.start,
        end: frames.end,
    }), [frames.end, frames.start, intensity, selected.engineId]);

    const setFrame = useCallback((which, key, value) => {
        setFrames((current) => {
            const next = { ...current[which], [key]: Number(value) };
            return { ...current, [which]: clampFrame(next) };
        });
    }, []);

    const resetFrames = useCallback(() => {
        setFrames(frameFromPreset(selected.engineId || 'none'));
        setIntensity(1);
        setNotice(null);
    }, [selected.engineId]);

    const applyToScene = useCallback(() => {
        if (!activeScene || !isApplicable) return;
        sceneActions.setSceneMotion(activeScene.id, motion);
        setNotice(`${selected.name} appliqué à « ${activeScene.name} ».`);
        saveNow();
    }, [activeScene, isApplicable, motion, saveNow, sceneActions, selected.name]);

    const applyToAll = useCallback(() => {
        if (photos.length === 0 || !isApplicable) return;
        sceneActions.applyMotionToAllImages(scenes, motion);
        setNotice(`${selected.name} appliqué aux ${photos.length} photos du montage.`);
        saveNow();
    }, [isApplicable, motion, photos.length, saveNow, scenes, sceneActions, selected.name]);

    const setSceneSpeed = useCallback((seconds) => {
        if (!activeScene) return;
        sceneActions.setSceneDuration(activeScene, Number(seconds));
        saveNow();
    }, [activeScene, saveNow, sceneActions]);

    const projectQuery = projectId ? `?project=${encodeURIComponent(projectId)}` : '';
    const startLimit = maxOffsetForScale(frames.start.scale);
    const endLimit = maxOffsetForScale(frames.end.scale);

    const renderTrajectoryRow = (which, label, limit) => (
        <div className={styles.trajectoryBlock}>
            <h3 className={styles.subTitle}>{label}</h3>
            <label className={styles.field}>
                <span className={styles.fieldLabel}>
                    Zoom
                    <span className={styles.fieldValue} data-numeric="true">
                        {frames[which].scale.toFixed(2)}×
                    </span>
                </span>
                <input
                    type="range"
                    min={1}
                    max={1.6}
                    step={0.01}
                    value={frames[which].scale}
                    onChange={(event) => setFrame(which, 'scale', event.target.value)}
                    aria-label={`${label} — zoom`}
                    data-testid={`vibecut-motion-${which}-scale`}
                />
            </label>
            <label className={styles.field}>
                <span className={styles.fieldLabel}>
                    Décalage horizontal
                    <span className={styles.fieldValue} data-numeric="true">
                        {formatOffset(frames[which].x)}
                    </span>
                </span>
                <input
                    type="range"
                    min={-0.35}
                    max={0.35}
                    step={0.005}
                    value={frames[which].x}
                    disabled={limit === 0}
                    onChange={(event) => setFrame(which, 'x', event.target.value)}
                    aria-label={`${label} — décalage horizontal`}
                    data-testid={`vibecut-motion-${which}-x`}
                />
            </label>
            <label className={styles.field}>
                <span className={styles.fieldLabel}>
                    Décalage vertical
                    <span className={styles.fieldValue} data-numeric="true">
                        {formatOffset(frames[which].y)}
                    </span>
                </span>
                <input
                    type="range"
                    min={-0.35}
                    max={0.35}
                    step={0.005}
                    value={frames[which].y}
                    disabled={limit === 0}
                    onChange={(event) => setFrame(which, 'y', event.target.value)}
                    aria-label={`${label} — décalage vertical`}
                    data-testid={`vibecut-motion-${which}-y`}
                />
            </label>
            <p className={styles.note} data-testid={`vibecut-motion-${which}-limit`}>
                {limit === 0
                    ? 'Sans zoom, le cadre ne peut pas se décaler : il n’y a rien autour de l’image à aller chercher.'
                    : `Décalage borné à ±${formatOffset(limit)} par le zoom de ce cadrage. `
                        + 'Au-delà, la fenêtre sortirait de l’image et l’export ne montrerait plus la même chose que l’aperçu.'}
            </p>
        </div>
    );

    return (
        <div className={styles.screen} data-testid="vibecut-motion-library">
            <header className={styles.screenHead}>
                <div className={styles.screenTitles}>
                    <h1 className={styles.screenTitle}>Mouvements</h1>
                    <p className={styles.screenSubtitle}>
                        {images.real
                            ? 'Chaque vignette anime une photo de ton projet, avec la transformation du moteur.'
                            : 'Importe des photos pour régler les mouvements sur tes propres images.'}
                    </p>
                </div>
                <Link href={`/video/rapide${projectQuery}`} className={styles.screenAction} data-testid="vibecut-library-to-quick">
                    Retour au montage <ArrowRight size={15} />
                </Link>
            </header>

            <div className={styles.body}>
                <div className={styles.catalog} data-testid="vibecut-motion-catalog">
                    {MOTION_GROUPS.map((group) => {
                        const entries = catalog.filter((entry) => entry.group === group.id);
                        if (entries.length === 0) return null;
                        return (
                            <section key={group.id} className={styles.group} aria-labelledby={`vibecut-motion-group-${group.id}`}>
                                <div className={styles.groupHead}>
                                    <h2 className={styles.groupTitle} id={`vibecut-motion-group-${group.id}`}>
                                        {group.label}
                                    </h2>
                                </div>
                                <div className={styles.cardGrid}>
                                    {entries.map((entry) => {
                                        const available = entry.availability === 'available' && entry.status.supported;
                                        return (
                                            <button
                                                key={entry.id}
                                                type="button"
                                                className={[
                                                    styles.card,
                                                    entry.id === selectedId ? styles.cardActive : '',
                                                    available ? '' : styles.cardPlanned,
                                                ].filter(Boolean).join(' ')}
                                                aria-pressed={entry.id === selectedId}
                                                onClick={() => handleSelect(entry)}
                                                data-testid={`vibecut-motion-card-${entry.id}`}
                                                data-available={available ? 'true' : 'false'}
                                            >
                                                {/*
                                                  * Un mouvement « planned » n'a pas d'`engineId`: sa
                                                  * vignette montre donc un cadre FIXE, et le badge dit
                                                  * pourquoi. Lui inventer une animation CSS serait la
                                                  * promesse exacte que la regle interdit.
                                                  */}
                                                <MotionPreview
                                                    motion={{ preset: entry.engineId || 'none', intensity: 1 }}
                                                    image={images.from}
                                                    testId={`vibecut-motion-canvas-${entry.id}`}
                                                />
                                                <span className={styles.cardBody}>
                                                    <span className={styles.cardName}>{entry.name}</span>
                                                    <span className={styles.cardDescription}>{entry.description}</span>
                                                    <Badge tone={available ? 'accent' : 'warning'}>
                                                        {available ? 'Export Pro' : 'Bientôt'}
                                                    </Badge>
                                                </span>
                                                {entry.id === selectedId ? (
                                                    <span className={styles.cardCheck} aria-hidden="true"><Check size={13} /></span>
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>

                <aside className={styles.panel} aria-label="Régler et appliquer un mouvement">
                    <div className={styles.panelHead}>
                        <span className={styles.panelKind}>Mouvement</span>
                        <h2 className={styles.panelTitle} data-testid="vibecut-motion-selected">{selected.name}</h2>
                        <Badge tone={isApplicable ? 'accent' : 'warning'}>
                            {isApplicable ? 'Export Pro' : 'Bientôt'}
                        </Badge>
                    </div>

                    <MotionPreview
                        motion={motion}
                        image={images.from}
                        width={300}
                        height={188}
                        cycleSeconds={activeScene?.duration || 3}
                        testId="vibecut-motion-panel-canvas"
                    />

                    {!isApplicable ? (
                        <p className={styles.warning} data-testid="vibecut-motion-warning">
                            Ce mouvement demande une extension du moteur : il n’est ni joué dans l’aperçu ni
                            rendu à l’export. Il reste listé pour dire ce qui arrive, pas pour être appliqué.
                        </p>
                    ) : null}

                    {photos.length === 0 ? (
                        <EmptyState icon={<ImagePlus size={20} />} title="Aucune photo dans ce projet">
                            Les mouvements de caméra s’appliquent aux photos. Le moteur ne les applique pas
                            encore aux vidéos.
                        </EmptyState>
                    ) : (
                        <>
                            {isApplicable ? (
                                <>
                                    <label className={styles.field}>
                                        <span className={styles.fieldLabel}>
                                            Intensité
                                            <span className={styles.fieldValue} data-numeric="true">
                                                {Math.round(intensity * 100)} %
                                            </span>
                                        </span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            step={5}
                                            value={Math.round(intensity * 100)}
                                            onChange={(event) => setIntensity(Number(event.target.value) / 100)}
                                            aria-label="Intensité du mouvement"
                                            data-testid="vibecut-motion-intensity"
                                        />
                                    </label>
                                    <p className={styles.note}>
                                        L’intensité raccourcit la course sans recadrer la photo. L’export applique
                                        exactement le même facteur.
                                    </p>

                                    {renderTrajectoryRow('start', 'Cadrage de départ', startLimit)}
                                    {renderTrajectoryRow('end', 'Cadrage d’arrivée', endLimit)}

                                    <div className={styles.field}>
                                        <span className={styles.fieldLabel}>Courbe d’accélération</span>
                                        <div className={styles.chipRow}>
                                            <button
                                                type="button"
                                                className={`${styles.chip} ${styles.chipActive}`}
                                                aria-pressed="true"
                                                data-testid="vibecut-motion-curve-smooth"
                                            >
                                                Douce
                                            </button>
                                            {/*
                                              * Desactivee, pas cachee. Le renderer ecrit `smoothstep`
                                              * en dur: une courbe lineaire ne survivrait pas a
                                              * l'export. On dit ce qui manque au lieu de le masquer.
                                              */}
                                            <button
                                                type="button"
                                                className={styles.chip}
                                                aria-pressed="false"
                                                disabled
                                                title="Le renderer serveur lisse toujours la progression"
                                                data-testid="vibecut-motion-curve-linear"
                                            >
                                                Linéaire — Bientôt
                                            </button>
                                        </div>
                                        <p className={styles.note}>
                                            L’aperçu et l’export lissent tous les deux la progression
                                            (démarrage et arrivée adoucis). Une courbe libre demande une
                                            extension du renderer.
                                        </p>
                                    </div>

                                    <label className={styles.field}>
                                        <span className={styles.fieldLabel}>Vitesse
                                            <span className={styles.fieldValue} data-numeric="true">
                                                {(activeScene?.duration || 0).toFixed(2)} s
                                            </span>
                                        </span>
                                        <input
                                            type="range"
                                            min={MIN_IMAGE_DURATION_SECONDS}
                                            max={Math.min(12, MAX_IMAGE_DURATION_SECONDS)}
                                            step={0.1}
                                            value={activeScene?.duration || 4}
                                            onChange={(event) => setSceneSpeed(event.target.value)}
                                            aria-label="Vitesse du mouvement"
                                            data-testid="vibecut-motion-speed"
                                        />
                                    </label>
                                    <p className={styles.note}>
                                        La vitesse d’un mouvement est la durée du plan : la même course sur
                                        2 s se lit vive, sur 8 s elle se lit posée.
                                    </p>
                                </>
                            ) : null}

                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Photo</span>
                                <select
                                    className={styles.select}
                                    value={sceneIndex}
                                    onChange={(event) => setSceneIndex(Number(event.target.value))}
                                    data-testid="vibecut-motion-scene"
                                >
                                    {photos.map((scene, index) => (
                                        <option key={scene.id} value={index}>
                                            {index + 1}. {scene.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className={styles.actions}>
                                <Button
                                    variant="primary"
                                    onClick={applyToScene}
                                    disabled={!isApplicable}
                                    data-testid="vibecut-motion-apply"
                                >
                                    Appliquer à cette photo
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={applyToAll}
                                    disabled={!isApplicable}
                                    data-testid="vibecut-motion-apply-all"
                                >
                                    Appliquer aux {photos.length} photos
                                </Button>
                                <Button
                                    variant="ghost"
                                    icon={<RotateCcw size={14} />}
                                    onClick={resetFrames}
                                    data-testid="vibecut-motion-reset"
                                >
                                    Revenir au mouvement d’origine
                                </Button>
                            </div>

                            {notice ? (
                                <p className={styles.notice} role="status" data-testid="vibecut-motion-notice">
                                    {notice}
                                </p>
                            ) : null}
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}
