"use client";

/*
 * FIGER LA SOURCE QUAND LE TEMPS N'EST PLUS CELUI DE L'HORLOGE (lot B2).
 *
 * Tant que les vignettes tournaient sur des IMAGES FIXES, « figer l'apercu »
 * n'avait aucun cout : arreter la progression suffisait a arreter l'image. Des
 * que la source est une VIDEO, les deux se separent - la progression s'arrete,
 * le rush continue - et trois choses cassent d'un coup :
 *
 *  1. LE SCRUB MENT. La position du pointeur est censee ETRE le temps de la
 *     transition. Si le rush avance aussi, deplacer le pointeur de 40 % a 60 %
 *     compare deux instants differents du plan : on ne voit plus l'effet, on
 *     voit l'effet PLUS le mouvement du rush.
 *  2. LE BYPASS MENT, et c'est le pire. Le bypass existe pour montrer « la meme
 *     image, sans l'effet ». Si le rush a avance entre les deux mesures, les
 *     deux etats different par l'effet ET par le contenu : l'avant/apres ne
 *     prouve plus rien.
 *  3. `prefers-reduced-motion` ne tiendrait plus sa promesse : le reglage
 *     couperait la boucle mais laisserait la video bouger.
 *
 * La regle est donc : quand le temps vient de l'UTILISATEUR (scrub) ou qu'il est
 * ARRETE (freeze), la vignette dessine une COPIE prise a l'instant ou elle a
 * quitte la boucle. Quand le temps revient a l'horloge, on relache la copie et
 * la source redevient vivante.
 *
 * C'est le test navigateur qui a impose ce module - l'assertion « le
 * relachement rend l'effet » du lot B1 s'est mise a echouer des que les clips de
 * demonstration sont arrives. Elle avait raison.
 */

/*
 * Une image ou un canvas sont DEJA fixes: les recopier ne servirait a rien et
 * couterait une allocation par survol. Seule une video a besoin d'etre figee.
 */
function isMoving(node) {
    return Boolean(node) && typeof HTMLVideoElement !== 'undefined' && node instanceof HTMLVideoElement;
}

function snapshot(node) {
    if (!isMoving(node)) return node;
    const width = node.videoWidth || node.clientWidth || 640;
    const height = node.videoHeight || node.clientHeight || 400;
    if (!width || !height) return node;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    try {
        canvas.getContext('2d').drawImage(node, 0, 0, width, height);
    } catch {
        // Une video pas encore decodee ne se recopie pas: on garde la source
        // vivante plutot que de figer une image noire.
        return node;
    }
    return canvas;
}

/**
 * Rend la paire de sources a dessiner.
 *
 * @param {{current: {from: any, to: any}|null}} ref memoire du composant
 * @param {{from: any, to: any}} media la paire vivante
 * @param {boolean} live vrai quand le temps vient de l'horloge partagee
 * @returns {{from: any, to: any}}
 */
export function resolveFrozenPair(ref, media, live) {
    if (live) {
        ref.current = null;
        return media;
    }
    if (!ref.current) {
        ref.current = { from: snapshot(media.from), to: snapshot(media.to) };
    }
    return ref.current;
}
