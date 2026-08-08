"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Pause, Play } from 'lucide-react';
import {
    PREVIEW_MODES,
    clamp01,
    getPreviewController,
    releaseScrub,
    scrubTo,
} from './previewController';
import styles from './library.module.css';

/*
 * Le grand apercu - lot B1. C'est le second des deux moments d'une
 * bibliotheque, et il demande l'outil inverse du premier:
 *
 *   AUDITIONNER 38 entrees  -> il faut de la VITESSE  -> hover scrub (LibraryCard)
 *   JUGER une entree retenue -> il faut de la PRECISION -> cet ecran-ci
 *
 * Trois commandes, et rien de plus:
 *
 * 1. LE CURSEUR DE TEMPS. Le canvas est deja dessine a partir d'une progression
 *    0 -> 1: pouvoir s'arreter a l'instant exact ne coute donc rien de plus.
 *
 * 2. LA BASCULE BOUCLE. Elle rend la main a l'horloge partagee.
 *
 * 3. LE BYPASS. On maintient la touche B (ou le bouton) et l'apercu montre le
 *    rendu SANS l'effet, EN PLEIN CADRE. C'est la comparaison avant/apres, en
 *    sequence plutot qu'en surface: c'est ainsi que travaillent les etalonneurs,
 *    et c'est la bonne forme pour une difference qui est temporelle.
 *
 * Le separateur deplaçable a ete ECARTE apres recherche (DaVinci, Final Cut,
 * CapCut). Il reste le bon outil pour la colorimetrie - une difference spatiale
 * sur une image figee - et il est range pour une future bibliotheque de looks.
 * Ne pas le reintroduire ici.
 */

const BYPASS_KEY = 'b';
/* Rafraichissement du transport: 8 fois par seconde suffit a lire un temps, et
 * ca evite de recopier la progression a 60 Hz pour un libelle. */
const TRANSPORT_INTERVAL_MS = 125;

function formatSeconds(value) {
    return `${(Math.round((Number(value) || 0) * 100) / 100).toFixed(2)} s`;
}

export default function LibraryStage({
    renderPreview,
    peak = 0.5,
    durationSeconds = 1,
    bypassHint,
    canBypass = true,
    testId = 'vibecut-library-stage',
}) {
    /*
     * Controleur lu du REGISTRE au moment de s'en servir, jamais pendant le
     * rendu (voir `previewController.js`). La cle est celle de l'ecran: le grand
     * apercu a son propre temps, independant de celui des vignettes.
     */
    const controlKey = `stage:${testId}`;
    const control = useCallback(() => getPreviewController(controlKey, { peak }), [controlKey, peak]);

    const stageRef = useRef(null);

    const [looping, setLooping] = useState(true);
    const [bypassing, setBypassing] = useState(false);
    const [progress, setProgress] = useState(() => clamp01(peak));

    /*
     * ------------------------------------------------------------------
     * LE CURSEUR EST UN CHAMP CONTROLE, ET C'EST UN CORRECTIF, PAS UN GOUT.
     *
     * Le premier jet ecrivait `slider.value` directement pendant la boucle,
     * pour eviter des rendus React. Effet de bord decouvert au test: React
     * garde une trace de la derniere valeur d'un champ, et une ecriture
     * directe la met a jour SANS declencher `onChange`. Amener ensuite le
     * curseur exactement sur la valeur que la boucle venait d'y laisser ne
     * produisait donc AUCUN evenement - le curseur restait mort une fois sur
     * deux, silencieusement.
     *
     * Le transport est rafraichi huit fois par seconde, pas soixante: c'est
     * assez pour lire un temps, et ca ne coute qu'un rendu de ce panneau. Le
     * dessin des canvas, lui, reste entierement hors de React.
     * ------------------------------------------------------------------
     */
    useEffect(() => {
        if (!looping) return undefined;
        const timer = window.setInterval(() => {
            /*
             * On RELIT ce que le canvas vient de dessiner au lieu de recalculer
             * le temps de notre cote: deux horloges donneraient deux verites, et
             * le libelle finirait par mentir sur ce qui est a l'ecran.
             */
            const canvas = stageRef.current?.querySelector('canvas');
            const shown = Number(canvas?.dataset?.previewProgress);
            if (Number.isFinite(shown)) setProgress(shown);
        }, TRANSPORT_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [looping]);

    const handleSlider = useCallback((event) => {
        const next = clamp01(Number(event.target.value) / 1000);
        setLooping(false);
        setProgress(next);
        scrubTo(control(), next);
    }, [control]);

    const applyLoop = useCallback((next) => {
        const controller = control();
        if (next) releaseScrub(controller);
        else {
            // On s'arrete LA OU ON EST, pas au debut: mettre en pause un apercu
            // qui saute a l'instant 0 fait perdre ce qu'on regardait.
            const canvas = stageRef.current?.querySelector('canvas');
            const shown = Number(canvas?.dataset?.previewProgress);
            scrubTo(controller, Number.isFinite(shown) ? shown : controller.peak);
        }
        setLooping(next);
    }, [control]);

    /*
     * La bascule lit le MODE DU CONTROLEUR, pas l'etat React. Deux clics plus
     * rapides qu'un rendu retomberaient sinon deux fois dans la meme branche,
     * puisque le second lirait encore l'ancien `looping`.
     */
    const toggleLoop = useCallback(() => {
        applyLoop(control().mode !== PREVIEW_MODES.LOOP);
    }, [applyLoop, control]);

    const armBypass = useCallback((on) => {
        if (!canBypass) return;
        const controller = control();
        if (controller.bypass === on) return;
        controller.bypass = on;
        setBypassing(on);
        /*
         * On redessine TOUJOURS, sans regarder le mode. En boucle l'horloge
         * l'aurait fait a la trame suivante, mais attendre laisse un decalage
         * visible sur une touche qu'on presse et relache vite; a l'arret, il n'y
         * a personne pour le faire et le bypass n'aurait aucun effet.
         */
        controller.render();
    }, [canBypass, control]);

    /*
     * La touche est ecoutee sur la fenetre - un bypass qu'il faut d'abord aller
     * cliquer pour armer ne sert a rien. On ignore les champs de saisie, sinon
     * taper « b » dans la recherche declencherait la comparaison.
     */
    useEffect(() => {
        if (!canBypass) return undefined;
        /*
         * PIEGE: le premier jet ignorait tout `INPUT`. Or le curseur de temps EN
         * EST UN: apres l'avoir deplace, il garde le focus, et le bypass ne
         * repondait plus - exactement au moment ou l'on veut comparer. On
         * n'ignore donc que les champs ou l'on TAPE vraiment.
         */
        const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);
        const isTyping = (target) => {
            if (target?.isContentEditable) return true;
            const tag = target?.tagName;
            if (tag === 'TEXTAREA') return true;
            if (tag !== 'INPUT') return false;
            return TEXT_INPUT_TYPES.has(String(target.type || 'text').toLowerCase());
        };
        const down = (event) => {
            if (event.key?.toLowerCase() !== BYPASS_KEY || event.repeat) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (isTyping(event.target)) return;
            event.preventDefault();
            armBypass(true);
        };
        const up = (event) => {
            if (event.key?.toLowerCase() !== BYPASS_KEY) return;
            armBypass(false);
        };
        // Un `blur` de fenetre pendant la touche laisserait le bypass arme.
        const cancel = () => armBypass(false);
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('blur', cancel);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', cancel);
        };
    }, [armBypass, canBypass]);

    useEffect(() => () => armBypass(false), [armBypass]);

    return (
        <div className={styles.stage} ref={stageRef} data-testid={testId}>
            <div
                className={styles.stageFrame}
                data-bypassing={bypassing ? 'true' : 'false'}
                data-testid={`${testId}-frame`}
            >
                {renderPreview(controlKey)}
                {bypassing ? (
                    <span className={styles.stageFlag} data-testid={`${testId}-bypass-flag`}>
                        Sans l’effet
                    </span>
                ) : null}
            </div>

            <div className={styles.transport}>
                <button
                    type="button"
                    className={styles.transportButton}
                    aria-pressed={looping}
                    aria-label={looping ? 'Mettre l’aperçu en pause' : 'Relancer la boucle de l’aperçu'}
                    onClick={toggleLoop}
                    data-testid={`${testId}-loop`}
                >
                    {looping ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <input
                    type="range"
                    className={styles.transportSlider}
                    min={0}
                    max={1000}
                    step={1}
                    value={Math.round(progress * 1000)}
                    onChange={handleSlider}
                    aria-label="Position dans l’aperçu"
                    data-testid={`${testId}-time`}
                />
                <span
                    className={styles.transportTime}
                    data-numeric="true"
                    data-testid={`${testId}-timecode`}
                >
                    {formatSeconds(progress * durationSeconds)}
                </span>
            </div>

            {canBypass ? (
                <div className={styles.bypassRow}>
                    <button
                        type="button"
                        className={styles.bypassButton}
                        aria-pressed={bypassing}
                        onPointerDown={() => armBypass(true)}
                        onPointerUp={() => armBypass(false)}
                        onPointerLeave={() => armBypass(false)}
                        onPointerCancel={() => armBypass(false)}
                        data-testid={`${testId}-bypass`}
                    >
                        <Eye size={14} />
                        Voir sans l’effet
                        <kbd className={styles.kbd}>B</kbd>
                    </button>
                    <p className={styles.bypassHint}>
                        {bypassHint || 'Maintiens la touche B : l’aperçu montre le rendu sans l’effet, en plein cadre.'}
                    </p>
                </div>
            ) : null}
        </div>
    );
}
