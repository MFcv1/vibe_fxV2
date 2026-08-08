/*
 * DROITS DES CLIPS DE DEMONSTRATION DES BIBLIOTHEQUES (lot B2).
 *
 * Le projet exige deja une declaration de droits explicite pour toute piste
 * audio, et BLOQUE l'export sans elle (`musicRights`). Poser des videos dans
 * l'interface sans provenance serait exactement le laxisme qu'on a refuse sur la
 * musique - avec en plus le fait que ces clips-la sont servis a tous les
 * visiteurs, pas seulement a celui qui les a importes.
 *
 * Ce manifeste est donc la SOURCE DE VERITE : un clip qui n'y figure pas n'est
 * pas charge, et `smoke-vibecut-library-media.mjs` verifie que chaque entree a
 * son fichier, sa licence et sa source.
 *
 * PROVENANCE DES QUATRE CLIPS ACTUELS - a lire avant d'en ajouter.
 * Ils ne viennent pas d'une banque d'images : ils sont GENERES par
 * `scripts/build-vibecut-library-demo-clips.mjs`, qui rejoue les quatre scenes
 * dessinees du repli (`libraryFallbackScene.js`) dans un Chromium sans fenetre,
 * y ajoute un mouvement lent, et encode le resultat. Consequence : ils sont
 * entierement a nous, aucune licence tierce n'est en jeu, et ils sont
 * REPRODUCTIBLES - la meme commande redonne les memes fichiers.
 *
 * Si le porteur du projet prefere du vrai rush (Mixkit, Pexels), c'est un
 * changement de DONNEES et non de code : deposer les fichiers dans
 * `public/assets/vibecut-demo/`, ajouter leur entree ici avec licence et URL
 * d'origine, et le smoke fait le reste.
 */

export const LIBRARY_DEMO_CLIPS = Object.freeze([
    Object.freeze({
        id: 'demo-couchant',
        file: '/assets/vibecut-demo/couchant.mp4',
        label: 'Couchant sur les cretes',
        source: 'Genere par Vibe_fx V2',
        origin: 'scripts/build-vibecut-library-demo-clips.mjs',
        license: 'Propriete du projet - aucune licence tierce',
        rightsCleared: true,
    }),
    Object.freeze({
        id: 'demo-nuit',
        file: '/assets/vibecut-demo/nuit.mp4',
        label: 'Nuit froide sur le lac',
        source: 'Genere par Vibe_fx V2',
        origin: 'scripts/build-vibecut-library-demo-clips.mjs',
        license: 'Propriete du projet - aucune licence tierce',
        rightsCleared: true,
    }),
    Object.freeze({
        id: 'demo-aube',
        file: '/assets/vibecut-demo/aube.mp4',
        label: 'Aube claire sur l’estuaire',
        source: 'Genere par Vibe_fx V2',
        origin: 'scripts/build-vibecut-library-demo-clips.mjs',
        license: 'Propriete du projet - aucune licence tierce',
        rightsCleared: true,
    }),
    Object.freeze({
        id: 'demo-orage',
        file: '/assets/vibecut-demo/orage.mp4',
        label: 'Orage au-dessus des cretes',
        source: 'Genere par Vibe_fx V2',
        origin: 'scripts/build-vibecut-library-demo-clips.mjs',
        license: 'Propriete du projet - aucune licence tierce',
        rightsCleared: true,
    }),
]);

/*
 * Un clip non declare « droits verifies » n'est jamais servi. La regle est
 * ecrite ici plutot que dans le composant pour qu'elle vaille aussi pour le
 * smoke, et pour qu'ajouter un clip sans licence soit sans effet plutot que
 * silencieusement accepte.
 */
export function getPlayableDemoClips(clips = LIBRARY_DEMO_CLIPS) {
    return clips.filter((clip) => clip.rightsCleared && clip.file && clip.license);
}
