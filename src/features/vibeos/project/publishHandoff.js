"use client";

/*
 * Passage de relais entre VibeOS et le flux de publication existant.
 *
 * Le bouton « Publier » du bandeau rend le projet (composition -> Vision ->
 * Studio, cf. `pipeline.js`) puis depose ici la charge utile, dans EXACTEMENT
 * le format que `PublicationsManager` attend deja (`normalizeVibeFxDraft`).
 * La page `/publier` la reprend et monte le composeur inchange : la publication
 * n'est pas reecrite, elle est rebranchee.
 *
 * Pourquoi un singleton de module et pas sessionStorage: la charge utile
 * contient des Blobs et un dataURL PNG pleine resolution, que sessionStorage ne
 * sait pas stocker. Consequence assumee et documentee: le relais survit a une
 * navigation client, pas a un rechargement complet de la page - meme limite que
 * le pont « Utiliser dans VibeCut » (`video/store/videoStore.js`).
 */

let pending = null;

export function setPendingPublication(payload) {
    pending = payload || null;
}

/* Lecture unique: la charge utile est consommee par la page /publier. */
export function takePendingPublication() {
    const payload = pending;
    pending = null;
    return payload;
}

export function hasPendingPublication() {
    return Boolean(pending);
}
