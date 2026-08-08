"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { getServerRenderCapabilityStatus } from '@/features/vibefx-studio/video/export/exportManifest';
import { Badge, Button, EmptyState } from '../primitives';
import { useSceneActions, useScenes } from '../adapters/useScenes';
import useVibeCutProject from '../adapters/useVibeCutProject';
import {
    MIN_TRANSITION_DURATION,
    clampTransitionDuration,
    getMaxTransitionDuration,
} from '../adapters/useTimeline';
import {
    TRANSITION_CATALOG,
    TRANSITION_GROUPS,
    TRANSITION_USAGES,
    TRANSITION_PEAK_DEFAULT,
} from '../data/transitionCatalog';
import LibraryScreen from './LibraryScreen';
import LibraryStage from './LibraryStage';
import LibraryContextStrip from './LibraryContextStrip';
import TransitionPreview from './TransitionPreview';
import useLibraryMedia from './useLibraryMedia';
import styles from './library.module.css';

/*
 * Bibliotheque de transitions.
 *
 * Trois regles portent cet ecran, et le lot B1 n'en change aucune:
 *
 *  1. CE QU'ON MONTRE EST CE QUI SERA RENDU. Chaque carte est dessinee par
 *     `renderTransition` du moteur, sur DEUX SCENES REELLES du projet courant.
 *     Aucune imitation CSS: une carte ne peut pas deriver de son rendu.
 *  2. LA COMPATIBILITE EXPORT EST LUE, JAMAIS ECRITE EN DUR. Elle vient de
 *     `getServerRenderCapabilityStatus`. Depuis le lot B3b (2026-08-03) les
 *     QUARANTE-HUIT entrees sont rendues a l'export, donc l'avertissement
 *     n'apparait plus - mais il reviendrait de lui-meme si une capacite serveur
 *     disparaissait. Le badge et le filtre portent desormais l'USAGE (ouverture
 *     ou fin de sequence), la seule information qui partage encore le catalogue.
 *  3. UN SEUL CHEMIN D'ECRITURE. Appliquer passe par `sceneActions.applyTransition`
 *     et `applyTransitionToAll`, exactement comme le montage rapide et
 *     l'inspecteur du montage avance. Pas de second chemin cree ici.
 *
 * Ce que le lot B1 change: l'ossature (en-tete, filtres, grille, panneau) part
 * dans `LibraryScreen`, partagee avec la bibliotheque de mouvements. Ce fichier
 * ne fournit plus que ses DONNEES, sa facon de dessiner une vignette et le
 * contenu de son panneau.
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
     * la relecture (bug 33).
     */
    const { projectId, saveNow } = useVibeCutProject();
    const { scenes } = useScenes();
    const sceneActions = useSceneActions();
    const images = useLibraryMedia(scenes);

    const [selectedId, setSelectedId] = useState('crossfade');
    const [duration, setDuration] = useState(0.8);
    const [cutIndex, setCutIndex] = useState(0);
    const [notice, setNotice] = useState(null);

    /*
     * Le catalogue est decore une fois, avec le statut serveur REEL de chaque
     * entree, et mis a la forme que l'ossature commune attend.
     */
    const catalog = useMemo(() => {
        const groupOrder = new Map(TRANSITION_GROUPS.map((group, index) => [group.id, index]));
        return TRANSITION_CATALOG
            .map((entry) => {
                const status = getServerRenderCapabilityStatus('timedTransition', entry.engineId || entry.id);
                const usage = TRANSITION_USAGES[entry.usage] || null;
                /*
                 * LE BADGE A CHANGE DE ROLE AU LOT B3b.
                 *
                 * Il disait « Export Pro » ou « Aperçu uniquement ». Les quarante-huit
                 * entrees etant desormais rendues a l'export, le premier libelle serait
                 * sur toutes les cartes : un badge que tout le monde porte ne distingue
                 * rien et n'est plus qu'un ornement, ce que la direction artistique
                 * interdit (plan.md § 4.2).
                 *
                 * Il porte donc l'information qui, elle, VARIE : cette entree est-elle
                 * pensee pour ouvrir ou fermer une sequence ? C'est la reponse a la
                 * question produit tranchee le 2026-08-03 - les ouvertures restent des
                 * transitions, mais l'ecran doit dire ce pour quoi elles sont faites.
                 *
                 * L'avertissement d'export n'est pas supprime pour autant : si une
                 * regression retirait une transition des capacites du serveur, le badge
                 * « Aperçu uniquement » reviendrait de lui-meme, puisqu'il est lu a
                 * l'execution et jamais ecrit en dur.
                 */
                const badge = !status.supported
                    ? { tone: 'warning', label: 'Aperçu uniquement' }
                    : (usage ? { tone: 'neutral', label: usage.label } : null);
                return {
                    ...entry,
                    status,
                    usageInfo: usage,
                    peak: entry.peak ?? TRANSITION_PEAK_DEFAULT,
                    badge,
                    dataAttributes: {
                        'data-exportable': status.supported ? 'true' : 'false',
                        'data-usage': entry.usage || 'cut',
                    },
                };
            })
            /*
             * Les exportables d'abord DANS CHAQUE FAMILLE. Quinze des
             * quarante-huit entrees se degradent encore en fondu au rendu final
             * (elles etaient vingt-trois sur trente-huit avant le lot B3a):
             * l'ecran doit pousser vers ce qui survit a l'export, sans rien
             * cacher du reste. (Ce tri existait avant l'ossature commune; il
             * avait ete perdu au passage, et ca se voyait: les familles
             * ouvraient sur des entrees qu'on ne peut pas exporter.)
             */
            .sort((a, b) => (groupOrder.get(a.group) ?? 99) - (groupOrder.get(b.group) ?? 99)
                || Number(b.status.supported) - Number(a.status.supported));
    }, []);

    const exportableCount = useMemo(
        () => catalog.filter((entry) => entry.status.supported).length,
        [catalog],
    );
    /*
     * Compte CALCULE, jamais ecrit en dur : il a valu 15 au lot L1, 33 au lot
     * B3a, 48 depuis le lot B3b. Un nombre fige aurait menti entre deux lots.
     */
    const allExportable = exportableCount === catalog.length;

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
        /*
         * On le dit ICI, pas seulement dans un encadre du panneau: le moment ou
         * ca compte est celui ou la transition part dans le montage. La carte
         * porte deja le badge, mais un badge se regarde une fois; cette phrase-la
         * arrive quand la decision est prise.
         */
        setNotice(applyMessage(selected, `posée sur la coupe ${cutIndex + 1}`, cutIndex === 0));
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
        setNotice(applyMessage(selected, `posée sur les ${cuts.length} coupes du montage`, false));
        saveNow();
    }, [cuts.length, duration, saveNow, scenes, sceneActions, selected]);

    const clearCut = useCallback(() => {
        if (!activeCut) return;
        sceneActions.applyTransition(activeCut.scene, null);
        setNotice(`Coupe ${cutIndex + 1} remise en coupe franche.`);
        saveNow();
    }, [activeCut, cutIndex, saveNow, sceneActions]);

    const projectQuery = projectId ? `?project=${encodeURIComponent(projectId)}` : '';

    /*
     * LE GRAND APERCU joue la VRAIE coupe designee par la bande de contexte, et
     * les reglages sont LIVE: la duree tiree ci-dessous change immediatement ce
     * qui est a l'ecran, sans avoir a appliquer.
     */
    const stage = (
        <LibraryStage
            peak={selected.peak}
            durationSeconds={duration}
            bypassHint="Maintiens B : l’aperçu montre la coupe franche, sans la transition."
            testId="vibecut-transition-stage"
            renderPreview={(controlKey) => (
                <TransitionPreview
                    type={selected.engineId || selected.id}
                    images={images}
                    duration={duration}
                    peak={selected.peak}
                    controlKey={controlKey}
                    width={640}
                    height={400}
                    className={styles.stageCanvas}
                    testId="vibecut-transition-panel-canvas"
                />
            )}
        />
    );

    const panel = (
        <>
            <div className={styles.panelHead}>
                <div className={styles.panelTitles}>
                    <span className={styles.panelKind}>Transition</span>
                    <h2 className={styles.panelTitle} data-testid="vibecut-transition-selected">{selected.name}</h2>
                </div>
                {!selected.status.supported ? (
                    <Badge tone="warning">Aperçu uniquement</Badge>
                ) : (selected.usageInfo ? (
                    <Badge tone="neutral">{selected.usageInfo.label}</Badge>
                ) : null)}
            </div>

            {!selected.status.supported ? (
                <p className={styles.warning} data-testid="vibecut-transition-warning">
                    Le renderer serveur ne rend pas cette transition : elle jouera dans l’aperçu,
                    l’export Pro la remplacera par un fondu.
                </p>
            ) : null}

            {selected.usageInfo ? (
                <p className={styles.note} data-testid="vibecut-transition-usage-note">
                    {selected.usageInfo.hint}. Elle fonctionne sur n’importe quelle coupe,
                    mais c’est là qu’elle a du sens.
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
        </>
    );

    return (
        <LibraryScreen
            testId="vibecut-transition-library"
            mediaKind={images.kind}
            kind="transitions"
            title="Transitions"
            subtitle={images.real
                ? 'Survole une vignette et balaye : le pointeur déroule la transition sur tes propres plans.'
                : 'Importe des médias pour voir chaque transition sur tes propres images.'}
            backHref={`/video/rapide${projectQuery}`}
            groups={TRANSITION_GROUPS}
            entries={catalog}
            selectedId={selected.id}
            onSelect={handleSelect}
            cardTestId={(entry) => `vibecut-transition-card-${entry.id}`}
            panelLabel="Appliquer une transition"
            /*
             * LE FILTRE A CHANGE DE QUESTION AU LOT B3b.
             *
             * Il repondait a « montre-moi seulement ce qui finira vraiment dans
             * ma video ». Les quarante-huit entrees y repondant desormais, il ne
             * filtrait plus rien : un controle qui ne retire jamais rien est un
             * bouton mort, et la direction artistique les interdit
             * (plan.md § 4.2).
             *
             * Il pose donc la question qui, elle, partage encore le catalogue :
             * « lesquelles sont faites pour joindre deux plans, par opposition a
             * ouvrir ou fermer une sequence ? » Et si une regression retirait une
             * transition des capacites du serveur, le filtre d'export revient de
             * lui-meme - il est choisi a l'execution, pas ecrit en dur.
             */
            extraFilter={allExportable ? {
                id: 'cut-only',
                label: 'Entre deux plans',
                hint: `Les ${catalog.filter((entry) => !entry.usageInfo).length} transitions qui joignent deux plans, sans les ouvertures ni les fins de séquence.`,
                test: (entry) => !entry.usageInfo,
            } : {
                id: 'exportable',
                label: 'Export Pro',
                hint: `Les ${exportableCount} transitions que le serveur rend à l’identique de l’aperçu.`,
                test: (entry) => entry.status.supported,
            }}
            renderCardPreview={(entry, controlKey) => (
                <TransitionPreview
                    type={entry.engineId || entry.id}
                    images={images}
                    duration={entry.defaultDuration}
                    peak={entry.peak}
                    controlKey={controlKey}
                    testId={`vibecut-transition-canvas-${entry.id}`}
                />
            )}
            stage={stage}
            panel={panel}
            contextStrip={activeCut ? (
                <LibraryContextStrip
                    label="Cette transition s’applique ici"
                    left={{ name: activeCut.scene.name, thumbnail: activeCut.scene.thumbnail }}
                    center={selected.name}
                    right={{ name: activeCut.next?.name || 'suivant', thumbnail: activeCut.next?.thumbnail }}
                    testId="vibecut-transition-context"
                />
            ) : null}
        />
    );
}

/*
 * LE MESSAGE DU MOMENT OU L'ON APPLIQUE.
 *
 * Une carte porte un badge, mais un badge se regarde une fois. Ce message-la
 * arrive quand la decision est prise, et c'est la qu'il compte :
 *  - si le serveur ne rend pas la transition, il le dit ;
 *  - si c'est une OUVERTURE posee ailleurs qu'a la premiere coupe, il le dit
 *    aussi, sans l'interdire : le montage reste celui de l'utilisateur.
 */
function applyMessage(entry, where, isFirstCut) {
    const base = `${entry.name} ${where}.`;
    if (!entry.status.supported) {
        return `${base} À l’export, le serveur la remplacera par un fondu enchaîné.`;
    }
    if (entry.usage === 'opening' && !isFirstCut) {
        return `${base} Elle est pensée pour ouvrir une séquence : sur la première coupe, elle raconte mieux.`;
    }
    if (entry.usage === 'closing') {
        return `${base} Elle est pensée pour terminer une séquence.`;
    }
    return base;
}
