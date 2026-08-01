"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import { Button } from '../primitives';
import PreviewStage from '../preview/PreviewStage';
import TransportBar from '../preview/TransportBar';
import useMediaImport from '../adapters/useMediaImport';
import useVibeCutProject from '../adapters/useVibeCutProject';
import useGuidedMontage from '../adapters/useGuidedMontage';
import { useSceneActions, useScenes } from '../adapters/useScenes';
import {
    applyTitleCasing,
    buildMontagePlan,
    getDefaultGuidedChoices,
    getStyleRecipe,
    RECIPE_FORMATS,
    resolveAudioProfile,
    resolveTitleOverlayStyle,
} from '../data/styleRecipes';
import MusicSheet from '../quick/MusicSheet';
import ExportSheet from '../quick/ExportSheet';
import StepMedia from './StepMedia';
import StepStyle from './StepStyle';
import StepRhythm from './StepRhythm';
import StepSound from './StepSound';
import StepFinish from './StepFinish';
import styles from './guided.module.css';

/*
 * Creation guidee.
 *
 * Cinq etapes, une decision par ecran, retour arriere toujours possible.
 * Le montage est regenere a chaque changement de choix, donc l'apercu de droite
 * montre en permanence le resultat reel - pas une simulation. Le projet est le
 * meme que celui des deux autres modes: c'est le meme `?project=`, la meme
 * sauvegarde automatique, et rien n'est verrouille a la sortie.
 */

const STEPS = [
    {
        id: 'medias',
        name: 'Médias',
        title: 'Ajoute tes photos et tes vidéos',
        subtitle: 'Commence par les fichiers. Le reste se règle ensuite, en quatre écrans.',
    },
    {
        id: 'style',
        name: 'Format & style',
        title: 'Choisis le rendu de ta vidéo',
        subtitle: 'Un style fixe d’un coup les durées, les mouvements, les fondus et les couleurs.',
    },
    {
        id: 'rythme',
        name: 'Rythme & mouvements',
        title: 'Règle le tempo du montage',
        subtitle: 'Le rythme donne la durée de chaque photo et la longueur des enchaînements.',
    },
    {
        id: 'son',
        name: 'Son & textes',
        title: 'Ajoute une musique et un titre',
        subtitle: 'Les deux sont facultatifs et modifiables plus tard.',
    },
    {
        id: 'final',
        name: 'Finaliser',
        title: 'Ton montage est prêt',
        subtitle: 'Vérifie le résultat, exporte-le, ou continue dans un autre mode.',
    },
];

const SAVE_LABELS = {
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    error: 'Enregistrement impossible',
};

export default function GuidedFlow() {
    const mediaInputRef = useRef(null);
    const panelRef = useRef(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [furthestStep, setFurthestStep] = useState(0);
    // Sens du dernier deplacement: le contenu de l'etape entre du cote d'ou il vient.
    const [direction, setDirection] = useState('forward');
    const [isDropActive, setIsDropActive] = useState(false);
    const [isMusicOpen, setIsMusicOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    /*
     * `null` = « l'utilisateur n'a pas touche au champ ». On retombe alors sur le
     * texte du titre pose, ce qui remplit le champ a la reouverture d'un projet
     * sans avoir besoin d'ecrire un etat depuis un effet. Une chaine vide, elle,
     * est un choix: effacer le champ ne doit pas y faire revenir l'ancien titre.
     */
    const [titleDraft, setTitleDraft] = useState(null);
    const [choices, setChoices] = useState(() => getDefaultGuidedChoices());

    const { projectId, projectName, status, saveState, renameCurrentProject, saveNow } = useVibeCutProject();
    const { importFiles, importState, clearImportState, accept } = useMediaImport();
    const { scenes, totalDuration } = useScenes();
    const actions = useSceneActions();
    const { applyPlan } = useGuidedMontage();

    const audioTracks = useVideoStore((state) => state.audioTracks);
    const textOverlays = useVideoStore((state) => state.textOverlays);
    const setSequencePreset = useVideoStore((state) => state.setSequencePreset);

    const step = STEPS[stepIndex];
    const hasScenes = scenes.length > 0;
    /*
     * Lot L4: les vignettes de preset sont baties sur les miniatures reelles du
     * projet. L'extraction est asynchrone, donc cette liste peut etre vide un
     * instant - `PresetFilmstrip` retombe alors sur la vignette SVG.
     */
    const sceneThumbnails = useMemo(
        () => scenes.map((scene) => scene.thumbnail).filter(Boolean),
        [scenes],
    );
    const isImporting = importState.status === 'importing';
    const titleOverlay = textOverlays[0] || null;
    // Texte BRUT du titre: ce que l'utilisateur a tape, avant la casse du preset.
    const titleText = titleDraft ?? titleOverlay?.content ?? '';

    /*
     * Le plan est recalcule a chaque rendu utile, mais il n'est APPLIQUE que
     * lorsqu'un choix ou la liste des scenes change (voir plus bas): sinon
     * l'application modifierait les durees, ce qui recalculerait le plan, ce qui
     * relancerait l'application - une boucle.
     */
    const plan = useMemo(() => buildMontagePlan({
        scenes: scenes.map((scene) => ({ isImage: scene.isImage, duration: scene.duration })),
        styleId: choices.styleId,
        rhythmId: choices.rhythmId,
        motionMoodId: choices.motionMoodId,
        motionIntensityId: choices.motionIntensityId,
        sequencePreset: choices.sequencePreset,
    }), [choices, scenes]);

    // Generation: active des que l'utilisateur a quitte l'etape des medias.
    const isGenerating = furthestStep >= 1;
    const sceneSignature = scenes.map((scene) => scene.id).join(',');
    const appliedSignatureRef = useRef('');

    useEffect(() => {
        if (!isGenerating || !sceneSignature) return;
        const signature = `${choices.styleId}|${choices.rhythmId}|${choices.motionMoodId}`
            + `|${plan.motionIntensityId}|${choices.sequencePreset}#${sceneSignature}`;
        if (appliedSignatureRef.current === signature) return;
        appliedSignatureRef.current = signature;
        /*
         * Depuis le lot L2, le plan applique est celui qui connait les scenes: la
         * duree depend de la PLACE de la scene dans le montage (plan d'ouverture,
         * ventre, fin), donc on ne peut plus appliquer un plan calcule a vide.
         *
         * Ce n'est pas une boucle: la signature ne contient que les identifiants
         * des scenes, et `buildMontagePlan` ne LIT jamais la duree d'une photo -
         * il la produit. Appliquer ne peut donc pas changer le plan.
         */
        applyPlan(plan);
    }, [applyPlan, choices, isGenerating, plan, sceneSignature]);

    /* ---------- Import ---------- */

    const openMediaPicker = useCallback(() => mediaInputRef.current?.click(), []);

    const handleMediaInput = useCallback(async (event) => {
        const { files } = event.target;
        await importFiles(files);
        event.target.value = '';
    }, [importFiles]);

    const handleDrop = useCallback(async (event) => {
        event.preventDefault();
        setIsDropActive(false);
        if (!event.dataTransfer?.files?.length) return;
        await importFiles(event.dataTransfer.files);
    }, [importFiles]);

    const handleDragOver = useCallback((event) => {
        if (!event.dataTransfer?.types?.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setIsDropActive(true);
    }, []);

    const handleDragLeave = useCallback((event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setIsDropActive(false);
    }, []);

    useEffect(() => {
        if (importState.status !== 'done') return undefined;
        const timer = window.setTimeout(clearImportState, 4000);
        return () => window.clearTimeout(timer);
    }, [clearImportState, importState.status]);

    /* ---------- Choix ---------- */

    const handleStyleChange = useCallback((styleId) => {
        const recipe = getStyleRecipe(styleId);
        if (!recipe) return;
        /*
         * Un preset porte son format et sa chorégraphie: le choisir doit donner
         * exactement ce que sa vignette montre.
         *
         * Le RYTHME, lui, n'appartient plus au preset depuis le lot L2: c'est un
         * réglage orthogonal (la cadence de base), et le preset ne fournit que la
         * forme. Changer de preset ne doit donc pas écraser un rythme déjà choisi.
         */
        setChoices((current) => ({
            ...current,
            styleId: recipe.id,
            sequencePreset: recipe.sequencePreset,
            motionMoodId: 'style',
        }));
    }, []);

    const handleFormatChange = useCallback((value) => {
        setChoices((current) => ({ ...current, sequencePreset: value }));
        // Avant la generation, le format doit quand meme etre visible dans l'apercu.
        setSequencePreset(value);
    }, [setSequencePreset]);

    /* ---------- Son et textes ---------- */

    const handleMusicConfirm = useCallback(({ file, rights, sourceDuration }) => {
        const id = actions.addMusic({ file, rights, sourceDuration, totalDuration });
        /*
         * Lot L5: le preset pose ses fondus des l'ajout. `addMusic` en met un de
         * 1 s par defaut - c'est un garde-fou generique, pas une intention de
         * preset: « Recit » veut 2 s, « Mixed media » 0,6 s.
         */
        if (id) actions.updateMusic(id, resolveAudioProfile(plan.audioProfile, totalDuration));
        setIsMusicOpen(false);
    }, [actions, plan.audioProfile, totalDuration]);

    const handleAddTitle = useCallback(() => {
        const content = titleText.trim();
        if (!content || scenes.length === 0) return;
        /*
         * Lot L5: le titre nait deja au traitement du preset. La casse porte sur
         * le CONTENU, donc le renderer recoit exactement la chaine affichee.
         */
        const id = actions.addSceneTitle(scenes[0], applyTitleCasing(content, plan.titleStyle));
        if (id) actions.updateText(id, resolveTitleOverlayStyle(plan.titleStyle));
        /*
         * Le brouillon n'est PAS vide apres l'ajout: il reste la source du texte
         * BRUT. Sans lui, passer d'un preset en capitales a un preset sans casse
         * ne pourrait plus retrouver la casse d'origine - la mise en capitales
         * serait irreversible.
         */
    }, [actions, plan.titleStyle, scenes, titleText]);

    /*
     * Lot L5: le traitement de titre suit le preset.
     *
     * Changer de preset trois ecrans plus tard doit re-styler le titre deja pose,
     * sinon `titleStyle` ne serait applique qu'au premier ajout - une demi-mesure
     * de plus, alors que le probleme H portait justement sur un reglage declare
     * et jamais applique.
     *
     * Garde par signature, comme l'application du plan: sans elle, l'ecriture
     * relancerait le rendu, qui relancerait l'ecriture.
     */
    const titleTreatmentRef = useRef('');
    useEffect(() => {
        if (!titleOverlay) {
            titleTreatmentRef.current = '';
            return;
        }
        const raw = titleText.trim();
        if (!raw) return;
        const signature = `${choices.styleId}|${titleOverlay.id}|${raw}`;
        if (titleTreatmentRef.current === signature) return;
        titleTreatmentRef.current = signature;
        actions.updateText(titleOverlay.id, {
            ...resolveTitleOverlayStyle(plan.titleStyle),
            content: applyTitleCasing(raw, plan.titleStyle),
        });
    }, [actions, choices.styleId, plan.titleStyle, titleText, titleOverlay]);

    /* Meme regle pour les fondus musique: ils appartiennent au preset. */
    const audioTreatmentRef = useRef('');
    useEffect(() => {
        const track = audioTracks[0];
        if (!track) {
            audioTreatmentRef.current = '';
            return;
        }
        const signature = `${choices.styleId}|${track.id}|${Math.round(totalDuration * 100)}`;
        if (audioTreatmentRef.current === signature) return;
        audioTreatmentRef.current = signature;
        actions.updateMusic(track.id, resolveAudioProfile(plan.audioProfile, totalDuration));
    }, [actions, audioTracks, choices.styleId, plan.audioProfile, totalDuration]);

    /* ---------- Navigation ---------- */

    const goToStep = useCallback((index) => {
        const next = Math.max(0, Math.min(STEPS.length - 1, index));
        setStepIndex((current) => {
            setDirection(next < current ? 'back' : 'forward');
            return next;
        });
        setFurthestStep((current) => Math.max(current, next));
    }, []);

    /*
     * Changer d'etape doit toujours montrer le haut de la nouvelle etape. Sans
     * cela, on arrive au milieu de l'ecran suivant avec sa question deja hors
     * champ, parce que le panneau garde le defilement de l'etape precedente.
     */
    useEffect(() => {
        panelRef.current?.scrollTo({ top: 0 });
    }, [stepIndex]);

    const goNext = useCallback(() => {
        if (stepIndex === STEPS.length - 1) return;
        goToStep(stepIndex + 1);
    }, [goToStep, stepIndex]);

    // Le projet est ancre avant de quitter le parcours: le lien vers les autres
    // modes doit pointer sur un projet reellement enregistre.
    useEffect(() => {
        if (stepIndex !== STEPS.length - 1 || !hasScenes) return;
        saveNow();
    }, [hasScenes, saveNow, stepIndex]);

    const canContinue = stepIndex === 0 ? hasScenes : true;
    const projectQuery = projectId ? `?project=${encodeURIComponent(projectId)}` : '';
    const formatLabel = useMemo(() => {
        const format = RECIPE_FORMATS.find((entry) => entry.value === choices.sequencePreset);
        return format ? `${format.label} · ${format.description}` : '';
    }, [choices.sequencePreset]);

    return (
        <div
            className={styles.flow}
            data-testid="vibecut-guided-flow"
            data-step={step.id}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <input
                ref={mediaInputRef}
                type="file"
                accept={accept}
                multiple
                hidden
                onChange={handleMediaInput}
                data-testid="vibecut-guided-media-input"
            />

            <header className={styles.header}>
                <input
                    className={styles.projectName}
                    value={projectName === 'Untitled' ? '' : projectName}
                    placeholder="Projet sans titre"
                    onChange={(event) => renameCurrentProject(event.target.value)}
                    aria-label="Nom du projet"
                    data-testid="vibecut-guided-project-name"
                />
                <span className={styles.saveState} data-testid="vibecut-guided-save-state">
                    {status === 'loading' ? 'Ouverture…' : SAVE_LABELS[saveState] || ''}
                </span>
                <span className={styles.headerSpacer} />
                <span className={styles.stepCount} data-testid="vibecut-guided-step-count">
                    Étape {stepIndex + 1} sur {STEPS.length}
                </span>
            </header>

            <div className={styles.progress} data-testid="vibecut-guided-progress">
                <div
                    className={styles.progressBar}
                    style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
                />
            </div>

            {importState.status !== 'idle' ? (
                <div
                    className={[styles.notice, importState.status === 'error' ? styles.noticeError : ''].filter(Boolean).join(' ')}
                    role={importState.status === 'error' ? 'alert' : 'status'}
                    data-testid="vibecut-guided-import-notice"
                    data-import-status={importState.status}
                >
                    {isImporting ? <Loader2 size={15} /> : null}
                    <span>
                        {isImporting
                            ? `Analyse des médias… ${importState.done}/${importState.total}`
                            : importState.message}
                    </span>
                    <span className={styles.noticeSpacer} />
                    {!isImporting ? (
                        <button
                            type="button"
                            aria-label="Fermer le message d’import"
                            title="Fermer le message d’import"
                            onClick={clearImportState}
                        >
                            <X size={15} />
                        </button>
                    ) : null}
                </div>
            ) : null}

            <div className={styles.body}>
                <nav className={styles.rail} aria-label="Étapes de la création guidée">
                    {STEPS.map((entry, index) => {
                        const isActive = index === stepIndex;
                        const isDone = index < furthestStep && !isActive;
                        return (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() => goToStep(index)}
                                disabled={index > furthestStep}
                                aria-current={isActive ? 'step' : undefined}
                                className={[
                                    styles.railItem,
                                    isActive ? styles.railItemActive : '',
                                    isDone ? styles.railItemDone : '',
                                ].filter(Boolean).join(' ')}
                                data-testid={`vibecut-guided-rail-${entry.id}`}
                            >
                                <span className={styles.railBullet} aria-hidden="true">
                                    {isDone ? <Check size={13} /> : index + 1}
                                </span>
                                <span className={styles.railLabel}>{entry.name}</span>
                            </button>
                        );
                    })}
                </nav>

                <div ref={panelRef} className={styles.panel} data-testid="vibecut-guided-panel">
                    {/*
                      * `key` sur l'etape: le contenu est remonte a chaque changement,
                      * donc l'animation d'entree rejoue et indique le sens du deplacement.
                      */}
                    <div key={step.id} className={styles.stepBody} data-direction={direction}>
                    <div className={styles.panelHead}>
                        <h1 className={styles.panelTitle}>{step.title}</h1>
                        <p className={styles.panelSubtitle}>{step.subtitle}</p>
                    </div>

                    {step.id === 'medias' ? (
                        <StepMedia
                            scenes={scenes}
                            isImporting={isImporting}
                            isDropActive={isDropActive}
                            onPickMedia={openMediaPicker}
                            onRemoveScene={actions.removeScene}
                        />
                    ) : null}

                    {step.id === 'style' ? (
                        <StepStyle
                            styleId={choices.styleId}
                            onStyleChange={handleStyleChange}
                            sequencePreset={choices.sequencePreset}
                            onFormatChange={handleFormatChange}
                            thumbnails={sceneThumbnails}
                        />
                    ) : null}

                    {step.id === 'rythme' ? (
                        <StepRhythm
                            scenes={scenes.map((scene) => ({ isImage: scene.isImage, duration: scene.duration }))}
                            plan={plan}
                            rhythmId={choices.rhythmId}
                            onRhythmChange={(rhythmId) => setChoices((current) => ({ ...current, rhythmId }))}
                            motionMoodId={choices.motionMoodId}
                            onMotionMoodChange={(motionMoodId) => setChoices((current) => ({ ...current, motionMoodId }))}
                            motionIntensityId={plan.motionIntensityId}
                            onMotionIntensityChange={(motionIntensityId) => setChoices((current) => ({ ...current, motionIntensityId }))}
                        />
                    ) : null}

                    {step.id === 'son' ? (
                        <StepSound
                            audioTracks={audioTracks}
                            onOpenMusic={() => setIsMusicOpen(true)}
                            onRemoveMusic={actions.removeMusic}
                            titleOverlay={titleOverlay}
                            titleDraft={titleText}
                            onTitleDraftChange={setTitleDraft}
                            onAddTitle={handleAddTitle}
                            onRemoveTitle={actions.removeText}
                            titleStyle={plan.titleStyle}
                            audioProfile={resolveAudioProfile(plan.audioProfile, totalDuration)}
                            styleName={plan.recipe.name}
                        />
                    ) : null}

                    {step.id === 'final' ? (
                        <StepFinish
                            plan={plan}
                            scenes={scenes}
                            totalDuration={totalDuration}
                            formatLabel={formatLabel}
                            audioTracks={audioTracks}
                            titleOverlay={titleOverlay}
                            projectQuery={projectQuery}
                            onOpenExport={() => setIsExportOpen(true)}
                        />
                    ) : null}
                    </div>
                </div>

                {stepIndex > 0 ? (
                    <aside className={styles.previewColumn} data-testid="vibecut-guided-preview">
                        <div className={styles.previewHead}>
                            <h2 className={styles.previewTitle}>Aperçu</h2>
                            <span className={styles.previewMeta}>{formatLabel}</span>
                        </div>
                        <PreviewStage />
                        <TransportBar />
                    </aside>
                ) : null}
            </div>

            <footer className={styles.footer}>
                <Button
                    variant="ghost"
                    icon={<ArrowLeft size={16} />}
                    onClick={() => goToStep(stepIndex - 1)}
                    disabled={stepIndex === 0}
                    data-testid="vibecut-guided-back"
                >
                    Étape précédente
                </Button>
                <span className={styles.footerSpacer} />
                {stepIndex === 0 && !hasScenes ? (
                    <span className={styles.footerHint}>Ajoute au moins un média pour continuer</span>
                ) : null}
                {stepIndex < STEPS.length - 1 ? (
                    <Button
                        variant="primary"
                        iconEnd={<ArrowRight size={16} />}
                        onClick={goNext}
                        disabled={!canContinue}
                        data-testid="vibecut-guided-next"
                    >
                        {step.id === 'son' ? 'Voir le résultat' : 'Continuer'}
                    </Button>
                ) : null}
            </footer>

            <MusicSheet
                open={isMusicOpen}
                onClose={() => setIsMusicOpen(false)}
                onConfirm={handleMusicConfirm}
            />
            <ExportSheet open={isExportOpen} onClose={() => setIsExportOpen(false)} />
        </div>
    );
}
