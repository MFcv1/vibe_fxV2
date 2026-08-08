"use client";

/*
 * Pilotage du temps des apercus de bibliotheque - lot B1.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CE MODULE EXISTE, ET POURQUOI IL N'EST PAS DANS L'ETAT REACT
 *
 * Le hover scrub redessine a CHAQUE mouvement de souris. Le passer par un
 * `setState` relancerait un rendu React a la cadence du pointeur, sur une grille
 * de quarante canvas: c'est exactement le bug 3 (playhead saccade), qui avait
 * deja coute une session.
 *
 * La progression vit donc dans un objet MUTABLE, tenu par une `ref`. Le pointeur
 * y ecrit, le canvas le relit. React n'est jamais prevenu, et il n'a pas a
 * l'etre: rien de ce qu'il rend ne depend de la position du curseur.
 * ---------------------------------------------------------------------------
 *
 * Trois modes, et un seul a la fois:
 *
 *   loop   - la vignette tourne en boucle (decision produit du 2026-07-30:
 *            on n'arrive jamais sur une grille morte).
 *   scrub  - quelqu'un tient le temps: le pointeur sur la vignette, les fleches
 *            au clavier, ou le curseur du grand apercu.
 *   freeze - arret sur le POINT CULMINANT de l'effet. C'est l'etat de repos
 *            quand la boucle est coupee (`prefers-reduced-motion`), et c'est ce
 *            qui evite qu'une grille figee soit 38 fois la meme image.
 */

export const PREVIEW_MODES = { LOOP: 'loop', SCRUB: 'scrub', FREEZE: 'freeze' };

export function clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(1, Math.max(0, number));
}

/*
 * Le point culminant par defaut est le milieu, mais il se regle par entree:
 * un passage au noir a mi-course est un cadre NOIR, ce qui ne dit rien de la
 * transition. Les catalogues portent donc leur propre `peak` quand le milieu
 * ne convient pas.
 */
export function createPreviewController({ peak = 0.5, offset = 0, reduced = false } = {}) {
    const start = clamp01(peak);
    return {
        mode: reduced ? PREVIEW_MODES.FREEZE : PREVIEW_MODES.LOOP,
        progress: start,
        peak: start,
        // Decalage du depart de boucle: sans lui, quarante vignettes battraient
        // a l'unisson et la grille se lirait comme un stroboscope.
        offset: Number(offset) || 0,
        bypass: false,
        reduced,
        /*
         * Installe par le composant d'apercu. Permet a la carte de redessiner
         * immediatement apres une ecriture, sans attendre l'horloge - et surtout
         * de rester utilisable quand l'horloge est coupee par
         * `prefers-reduced-motion`.
         */
        render: () => {},
    };
}

/*
 * ---------------------------------------------------------------------------
 * LE REGISTRE, ET POURQUOI LES CONTROLEURS NE VIVENT PAS DANS UNE `ref`
 *
 * Une vignette et son canvas sont DEUX composants (la carte tient le pointeur,
 * l'apercu tient le dessin). Il leur faut donc le meme controleur.
 *
 * Le faire naitre dans une `ref` de la carte obligeait a lire `ref.current`
 * pendant le rendu pour le passer en prop - ce que les regles React interdisent,
 * a juste titre: une valeur lue au rendu peut etre perimee.
 *
 * Les controleurs vivent donc dans un registre de module, adresse par une cle
 * stable, exactement comme `preview/playheadClock.js` tient le temps de lecture
 * hors de React. Les composants n'echangent qu'une CHAINE, et lisent le
 * controleur au moment ou ils s'en servent - jamais pendant le rendu.
 * ---------------------------------------------------------------------------
 */

const registry = new Map();

/*
 * Le decalage de boucle est DERIVE de la cle, pas transmis. Les deux composants
 * peuvent ainsi demander le meme controleur sans se coordonner, et la grille
 * respire quand meme au lieu de battre a l'unisson.
 */
function offsetFromKey(key) {
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) {
        hash = (hash * 31 + key.charCodeAt(index)) % 997;
    }
    return (hash % 12) * 0.41;
}

export function getPreviewController(key, { peak = 0.5, reduced = false } = {}) {
    const id = String(key || 'default');
    let controller = registry.get(id);
    if (!controller) {
        controller = createPreviewController({ peak, offset: offsetFromKey(id), reduced });
        registry.set(id, controller);
        return controller;
    }
    const nextPeak = clamp01(peak);
    if (controller.peak !== nextPeak) {
        controller.peak = nextPeak;
        // Une entree dont le point culminant change pendant qu'on la scrube ne
        // doit pas sauter sous le doigt.
        if (controller.mode !== PREVIEW_MODES.SCRUB) controller.progress = nextPeak;
    }
    return controller;
}

/** Le pointeur sur la vignette EST le curseur de temps: sa position X donne la progression. */
export function progressFromPointer(event, element) {
    const rect = element?.getBoundingClientRect?.();
    if (!rect || !rect.width) return 0;
    return clamp01((event.clientX - rect.left) / rect.width);
}

/**
 * Prend la main sur le temps et redessine tout de suite.
 * Renvoie la progression appliquee, pour que l'appelant puisse l'afficher.
 */
export function scrubTo(controller, progress) {
    if (!controller) return 0;
    controller.mode = PREVIEW_MODES.SCRUB;
    controller.progress = clamp01(progress);
    controller.render();
    return controller.progress;
}

/**
 * Rend la main. La boucle repart - sauf si le mouvement est coupe, auquel cas on
 * repose sur le point culminant plutot que sur un cadre vide.
 */
export function releaseScrub(controller) {
    if (!controller) return;
    controller.mode = controller.reduced ? PREVIEW_MODES.FREEZE : PREVIEW_MODES.LOOP;
    controller.progress = controller.peak;
    controller.render();
}

/*
 * Boucle d'une TRANSITION: A tenu, A vers B, B tenu, B vers A.
 * Le retour n'est pas une coquetterie: sans lui, une directionnelle (balayage,
 * poussee) ne se lirait que dans un sens et sauterait a chaque tour.
 */
export function transitionLoopPhase(elapsed, span, hold = 0.7) {
    const width = Math.max(0.15, Number(span) || 0.8);
    const cycle = (hold + width) * 2;
    const phase = ((elapsed % cycle) + cycle) % cycle;
    if (phase < hold) return { progress: 0, reversed: false };
    if (phase < hold + width) return { progress: (phase - hold) / width, reversed: false };
    if (phase < hold * 2 + width) return { progress: 1, reversed: false };
    return { progress: (phase - hold * 2 - width) / width, reversed: true };
}

/*
 * Boucle d'un MOUVEMENT: aller, tenue, retour, tenue.
 * Sans la tenue, un zoom avant enchainerait directement son zoom arriere et se
 * lirait comme un battement, pas comme un mouvement de camera.
 */
export function motionLoopProgress(elapsed, cycleSeconds, hold = 0.35) {
    const span = Math.max(0.6, Number(cycleSeconds) || 3);
    const cycle = span * 2 + hold * 2;
    const phase = ((elapsed % cycle) + cycle) % cycle;
    if (phase < span) return phase / span;
    if (phase < span + hold) return 1;
    if (phase < span * 2 + hold) return 1 - (phase - span - hold) / span;
    return 0;
}
