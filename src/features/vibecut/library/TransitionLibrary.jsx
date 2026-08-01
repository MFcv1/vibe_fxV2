"use client";

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ImagePlus } from 'lucide-react';
import { getServerRenderCapabilityStatus } from '@/features/vibefx-studio/video/export/exportManifest';
import { Badge, Button, EmptyState } from '../primitives';
import { useSceneActions, useScenes } from '../adapters/useScenes';
import useVibeCutProject from '../adapters/useVibeCutProject';
import {
    MIN_TRANSITION_DURATION,
    clampTransitionDuration,
    getMaxTransitionDuration,
} from '../adapters/useTimeline';
import { TRANSITION_CATALOG, TRANSITION_GROUPS } from '../data/transitionCatalog';
import TransitionPreview from './TransitionPreview';
import useLibraryImages from './useLibraryImages';
import styles from './library.module.css';

/*
 * Bibliotheque de transitions (phase 5).
 *
 * Trois regles portent cet ecran:
 *
 *  1. CE QU'ON MONTRE EST CE QUI SERA RENDU. Chaque carte est dessinee par
 *     `renderTransition` du moteur, sur DEUX SCENES REELLES du projet courant.
 *     Aucune imitation CSS: une carte ne peut pas deriver de son rendu.
 *  2. LA COMPATIBILITE EXPORT EST LUE, JAMAIS ECRITE EN DUR. Elle vient de
 *     `getServerRenderCapabilityStatus`, donc les 15 transitions minutees du lot
 *     L1 portent « Export Pro » et les 27 autres « Aperçu uniquement ».
 *  3. UN SEUL CHEMIN D'ECRITURE. Appliquer passe par `sceneActions.applyTransition`
 *     et `applyTransitionToAll`, exactement comme le montage rapide et
 *     l'inspecteur du montage avance. Pas de second chemin cree ici.
 */

function formatSeconds(value = 0) {
    return `${(Math.round((Number(value) || 0) * 100) / 100).toFixed(2)} s`;
}

export default function TransitionLibrary() {
    /*
     * `saveNow` est indispensable ICI. La sauvegarde automatique est debouncee a
     * 1,2 s, et une bibliotheque est precisement l'ecran ou l'on applique PUIS
     * l'on part aussitot: sans flush explicite, revenir au montage juste apres
     * avoir pose une transition la trouvait perdue. Trouve par le test, pas par
     * la relecture.
     */
    const { projectId, saveNow } = useVibeCutProject();
    const { scenes } = useScenes();
    const sceneActions = useSceneActions();
    const images = useLibraryImages(scenes);

    const [selectedId, setSelectedId] = useState('crossfade');
    const [duration, setDuration] = useState(0.8);
    const [cutIndex, setCutIndex] = useState(0);
    const [notice, setNotice] = useState(null);

    /*
     * Le catalogue est decore une fois, avec le statut serveur REEL de chaque
     * entree. Le tri met les exportables en tete de chaque famille: l'ecran
     * pousse vers ce qui survit a l'export sans cacher le reste.
     */
    const catalog = useMemo(() => TRANSITION_CATALOG.map((entry) => ({
        ...entry,
        status: getServerRenderCapabilityStatus('timedTransition', entry.engineId || entry.id),
    })), []);

    const selected = catalog.find((entry) => entry.id === selectedId) || catalog[0];

    // Les coupes du projet: une transition se pose entre deux plans, jamais dans le vide.
    const cuts = useMemo(
        () => scenes.filter((scene) => scene.nextSceneId).map((scene) => ({
            scene,
            next: scenes.find((entry) => entry.id === scene.nextSceneId) || null,
        })),
        [scenes],
    );
    const activeCut = cuts[Math.min(cutIndex, Math.max(0, cuts.length - 1))] || null;
    const maxDuration = activeCut
        ? getMaxTransitionDuration(activeCut.scene.duration, activeCut.next?.duration ?? activeCut.scene.duration)
        : 2;

    const handleSelect = useCallback((entry) => {
        setSelectedId(entry.id);
        setDuration(entry.defaultDuration || 0.8);
        setNotice(null);
    }, []);

    const applyToCut = useCallback(() => {
        if (!activeCut || !selected) return;
        sceneActions.applyTransition(activeCut.scene, {
            engineId: selected.engineId || selected.id,
            name: selected.name,
            group: selected.group,
            duration: clampTransitionDuration(
                duration,
                activeCut.scene.duration,
                activeCut.next?.duration ?? activeCut.scene.duration,
            ),
        });
        setNotice(`${selected.name} posée sur la coupe ${cutIndex + 1}.`);
        saveNow();
    }, [activeCut, cutIndex, duration, saveNow, sceneActions, selected]);

    const applyToAll = useCallback(() => {
        if (!selected || cuts.length === 0) return;
        sceneActions.applyTransitionToAll(scenes, {
            engineId: selected.engineId || selected.id,
            name: selected.name,
            group: selected.group,
            duration,
        });
        setNotice(`${selected.name} posée sur les ${cuts.length} coupes du montage.`);
        saveNow();
    }, [cuts.length, duration, saveNow, scenes, sceneActions, selected]);

    const clearCut = useCallback(() => {
        if (!activeCut) return;
        sceneActions.applyTransition(activeCut.scene, null);
        setNotice(`Coupe ${cutIndex + 1} remise en coupe franche.`);
        saveNow();
    }, [activeCut, cutIndex, saveNow, sceneActions]);

    const projectQuery = projectId ? `?project=${encodeURIComponent(projectId)}` : '';

    return (
        <div className={styles.screen} data-testid="vibecut-transition-library">
            <header className={styles.screenHead}>
                <div className={styles.screenTitles}>
                    <h1 className={styles.screenTitle}>Transitions</h1>
                    <p className={styles.screenSubtitle}>
                        {images.real
                            ? 'Chaque vignette enchaîne deux scènes de ton projet, dessinée par le moteur du montage.'
                            : 'Importe des médias pour voir chaque transition sur tes propres images.'}
                    </p>
                </div>
                <Link href={`/video/rapide${projectQuery}`} className={styles.screenAction} data-testid="vibecut-library-to-quick">
                    Retour au montage <ArrowRight size={15} />
                </Link>
            </header>

            <div className={styles.body}>
                <div className={styles.catalog} data-testid="vibecut-transition-catalog">
                    {TRANSITION_GROUPS.map((group) => {
                        const entries = catalog
                            .filter((entry) => entry.group === group.id)
                            .sort((a, b) => Number(b.status.supported) - Number(a.status.supported));
                        if (entries.length === 0) return null;
                        return (
                            <section key={group.id} className={styles.group} aria-labelledby={`vibecut-group-${group.id}`}>
                                <div className={styles.groupHead}>
                                    <h2 className={styles.groupTitle} id={`vibecut-group-${group.id}`}>{group.label}</h2>
                                    <p className={styles.groupHint}>{group.hint}</p>
                                </div>
                                <div className={styles.cardGrid}>
                                    {entries.map((entry) => (
                                        <button
                                            key={entry.id}
                                            type="button"
                                            className={[
                                                styles.card,
                                                entry.id === selectedId ? styles.cardActive : '',
                                            ].filter(Boolean).join(' ')}
                                            aria-pressed={entry.id === selectedId}
                                            onClick={() => handleSelect(entry)}
                                            data-testid={`vibecut-transition-card-${entry.id}`}
                                            data-exportable={entry.status.supported ? 'true' : 'false'}
                                        >
                                            <TransitionPreview
                                                type={entry.engineId || entry.id}
                                                images={images}
                                                duration={entry.defaultDuration}
                                                testId={`vibecut-transition-canvas-${entry.id}`}
                                            />
                                            <span className={styles.cardBody}>
                                                <span className={styles.cardName}>{entry.name}</span>
                                                <span className={styles.cardDescription}>{entry.description}</span>
                                                {/*
                                                  * Le badge dit LEQUEL des deux moteurs rend cette
                                                  * transition. Il est lu du manifeste, jamais ecrit
                                                  * en dur: l'apercu et l'export disent la meme chose
                                                  * par construction.
                                                  */}
                                                <Badge tone={entry.status.supported ? 'accent' : 'warning'}>
                                                    {entry.status.supported ? 'Export Pro' : 'Aperçu uniquement'}
                                                </Badge>
                                            </span>
                                            {entry.id === selectedId ? (
                                                <span className={styles.cardCheck} aria-hidden="true"><Check size={13} /></span>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>

                <aside className={styles.panel} aria-label="Appliquer une transition">
                    <div className={styles.panelHead}>
                        <span className={styles.panelKind}>Transition</span>
                        <h2 className={styles.panelTitle} data-testid="vibecut-transition-selected">{selected.name}</h2>
                        <Badge tone={selected.status.supported ? 'accent' : 'warning'}>
                            {selected.status.supported ? 'Export Pro' : 'Aperçu uniquement'}
                        </Badge>
                    </div>

                    <TransitionPreview
                        type={selected.engineId || selected.id}
                        images={images}
                        duration={duration}
                        width={300}
                        height={188}
                        testId="vibecut-transition-panel-canvas"
                    />

                    {!selected.status.supported ? (
                        <p className={styles.warning} data-testid="vibecut-transition-warning">
                            Le renderer serveur ne rend pas cette transition : elle jouera dans l’aperçu,
                            l’export Pro la remplacera par un fondu. Les transitions marquées « Export Pro »
                            sont rendues à l’identique des deux côtés.
                        </p>
                    ) : null}

                    {cuts.length === 0 ? (
                        <EmptyState icon={<ImagePlus size={20} />} title="Aucune coupe à traiter">
                            Une transition se pose entre deux plans. Importe au moins deux médias dans un
                            projet pour pouvoir en appliquer une.
                        </EmptyState>
                    ) : (
                        <>
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Coupe</span>
                                <select
                                    className={styles.select}
                                    value={cutIndex}
                                    onChange={(event) => setCutIndex(Number(event.target.value))}
                                    data-testid="vibecut-transition-cut"
                                >
                                    {cuts.map((cut, index) => (
                                        <option key={cut.scene.id} value={index}>
                                            {index + 1}. {cut.scene.name} → {cut.next?.name || 'suivant'}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>
                                    Durée
                                    <span className={styles.fieldValue} data-numeric="true">{formatSeconds(duration)}</span>
                                </span>
                                <input
                                    type="range"
                                    min={MIN_TRANSITION_DURATION}
                                    max={maxDuration}
                                    step={0.05}
                                    value={Math.min(duration, maxDuration)}
                                    onChange={(event) => setDuration(Number(event.target.value))}
                                    aria-label="Durée de la transition"
                                    data-testid="vibecut-transition-duration"
                                />
                            </label>
                            <p className={styles.note} data-testid="vibecut-transition-ceiling">
                                Maximum {formatSeconds(maxDuration)} sur cette coupe : une transition ne prend
                                jamais plus de 45 % du plus court des deux plans, sinon il ne resterait plus
                                rien à voir.
                            </p>

                            <div className={styles.actions}>
                                <Button variant="primary" onClick={applyToCut} data-testid="vibecut-transition-apply">
                                    Appliquer à cette coupe
                                </Button>
                                <Button variant="secondary" onClick={applyToAll} data-testid="vibecut-transition-apply-all">
                                    Appliquer aux {cuts.length} coupes
                                </Button>
                                <Button variant="ghost" onClick={clearCut} data-testid="vibecut-transition-clear">
                                    Remettre en coupe franche
                                </Button>
                            </div>

                            {notice ? (
                                <p className={styles.notice} role="status" data-testid="vibecut-transition-notice">
                                    {notice}
                                </p>
                            ) : null}

                            <p className={styles.note}>
                                {activeCut?.scene.transitionToNext
                                    ? `Cette coupe porte actuellement : ${activeCut.scene.transitionToNext.name} · `
                                        + `${formatSeconds(activeCut.scene.transitionToNext.duration)}.`
                                    : 'Cette coupe est actuellement une coupe franche.'}
                            </p>
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}
