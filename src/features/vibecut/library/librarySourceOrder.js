/*
 * L'ORDRE DE CHOIX DES SOURCES DES BIBLIOTHEQUES (lot B2).
 *
 * Module PUR, zero import - meme forme que `data/styleRecipes.js`, et pour la
 * meme raison : c'est la seule decision du lot qui puisse etre fausse sans que
 * l'ecran ait l'air casse. Une photo servie a la place d'une video disponible
 * donne une bibliotheque qui a l'air de marcher, et qui rate exactement ce que
 * le lot B2 devait apporter.
 *
 * Isole ici, `smoke-vibecut-library-media.mjs` le verifie sans navigateur et
 * sans React.
 */

/**
 * Les deux sources a enchainer, prises dans le projet courant.
 *
 * Les VIDEOS passent devant les photos, meme quand une photo arrive plus tot
 * dans le montage : le sujet du lot est d'avoir des vignettes qui bougent.
 * Deux plans DIFFERENTS, toujours - une transition entre une image et elle-meme
 * ne montre rien.
 *
 * @param {Array<{isImage?: boolean, mediaUrl?: string|null, thumbnail?: string|null}>} scenes
 * @returns {Array<{kind: 'video'|'photo', src: string}>} 0, 1 ou 2 sources
 */
export function selectProjectSources(scenes = []) {
    const videos = [];
    const photos = [];
    for (const scene of scenes) {
        if (!scene) continue;
        if (!scene.isImage && scene.mediaUrl) videos.push({ kind: 'video', src: scene.mediaUrl });
        else if (scene.thumbnail) photos.push({ kind: 'photo', src: scene.thumbnail });
    }
    const ordered = [...videos, ...photos];
    if (ordered.length === 0) return [];
    if (ordered.length === 1) return [ordered[0]];
    return [ordered[0], ordered[1]];
}
