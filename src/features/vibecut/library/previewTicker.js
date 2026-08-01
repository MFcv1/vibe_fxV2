"use client";

/*
 * Horloge partagee des bibliotheques (phase 5).
 *
 * Les deux bibliotheques affichent des dizaines de vignettes qui tournent en
 * boucle permanente (decision produit du 2026-07-30). Une `requestAnimationFrame`
 * PAR vignette ferait quarante boucles concurrentes: une seule horloge les sert
 * toutes, et elle s'arrete d'elle-meme des qu'il n'y a plus personne a servir.
 *
 * Meme philosophie que `preview/playheadClock.js`: le dessin vit HORS de React.
 * Un abonne qui redessinerait via un `setState` reprovoquerait un rendu React a
 * 60 images par seconde, ce que la timeline avait deja paye au bug 3.
 */

const subscribers = new Set();
let frame = null;
let startedAt = 0;

function tick(now) {
    frame = null;
    if (subscribers.size === 0) return;
    const elapsed = (now - startedAt) / 1000;
    subscribers.forEach((callback) => {
        try {
            callback(elapsed);
        } catch {
            /*
             * Une vignette qui echoue ne doit pas arreter l'horloge des autres:
             * le catch est deliberement muet, la vignette fautive reste noire.
             */
        }
    });
    frame = window.requestAnimationFrame(tick);
}

export function subscribeToPreviewTicker(callback) {
    if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};
    subscribers.add(callback);
    if (frame === null) {
        startedAt = window.performance.now();
        frame = window.requestAnimationFrame(tick);
    }
    return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0 && frame !== null) {
            window.cancelAnimationFrame(frame);
            frame = null;
        }
    };
}

/*
 * `prefers-reduced-motion` doit arreter les vignettes comme il arrete les
 * animations CSS: une boucle en JavaScript ne serait pas couverte par la regle
 * de `vibecut.css`, et le reglage d'accessibilite deviendrait a moitie vrai.
 */
export function prefersReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
