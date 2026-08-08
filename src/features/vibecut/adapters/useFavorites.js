"use client";

/*
 * Favoris des bibliotheques - lot B1.
 *
 * UNE SEULE SOURCE DE VERITE, et c'est la raison d'etre de ce module.
 * Les favoris sont lus a trois endroits (les deux bibliotheques, l'inspecteur du
 * montage avance, les raccourcis du montage rapide). Si chacun tenait son propre
 * etat, poser une etoile dans la bibliotheque ne se verrait pas dans le montage
 * ouvert a cote - le defaut exact que la feuille de route liste comme risque.
 *
 * D'ou le cache de module partage par tous les appelants, plus un jeu d'abonnes:
 * une ecriture previent toutes les instances montees, sans passer par un
 * contexte React que chaque ecran aurait a installer.
 *
 * Le stockage est IndexedDB (`services/projectLibrary.js`), pas `localStorage`:
 * le projet stocke deja tout le reste la, et deux stockages feraient deux
 * verites. Aucun composant ne touche IndexedDB directement: ils passent tous
 * par cet adaptateur, comme l'exige `plan.md` § 5.3.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { loadFavorites, saveFavorites } from '../services/projectLibrary';

const EMPTY = { transitions: [], motions: [] };

let cache = EMPTY;
let loadPromise = null;
const listeners = new Set();

function publish(next) {
    cache = next;
    listeners.forEach((listener) => {
        try {
            listener(next);
        } catch {
            // Un abonne demonte ne doit pas empecher les autres d'etre servis.
        }
    });
}

/*
 * `useSyncExternalStore` plutot qu'un `useState` + abonnement manuel: c'est le
 * primitif fait pour lire un magasin exterieur a React. Il evite le
 * `setState` synchrone dans un effet, qui declenche un rendu en cascade a chaque
 * montage - et une bibliotheque en monte une quarantaine d'un coup.
 */
function subscribe(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

function getSnapshot() {
    return cache;
}

function getServerSnapshot() {
    // Rien n'est lisible cote serveur: l'ecran part sans favori, puis se remplit.
    return EMPTY;
}

function ensureLoaded() {
    if (!loadPromise) {
        loadPromise = loadFavorites().then((loaded) => {
            publish(loaded);
            return loaded;
        });
    }
    return loadPromise;
}

/*
 * `kind` vaut 'transitions' ou 'motions'. Les deux bibliotheques ne partagent
 * pas leurs favoris: un fondu enchaine et un zoom avant ne se remplacent pas.
 */
export default function useFavorites(kind = 'transitions') {
    const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    useEffect(() => { ensureLoaded(); }, []);

    const ids = all[kind] || [];

    const isFavorite = useCallback(
        (id) => (cache[kind] || []).includes(id),
        [kind],
    );

    /*
     * `toggle` part de `cache`, jamais de l'etat React local: deux instances
     * montees en meme temps liraient sinon chacune une copie potentiellement
     * perimee, et la derniere ecriture ecraserait l'autre.
     */
    const toggle = useCallback((id) => {
        if (!id) return;
        const current = cache[kind] || [];
        const next = current.includes(id)
            ? current.filter((entry) => entry !== id)
            : [...current, id];
        const merged = { ...cache, [kind]: next };
        publish(merged);
        saveFavorites(merged);
    }, [kind]);

    return {
        favorites: ids,
        count: ids.length,
        isFavorite,
        toggle,
        /*
         * Trie une liste d'entrees en remontant les favoris, en conservant
         * l'ordre d'origine a l'interieur de chaque moitie. C'est ce qui sert
         * dans les DEUX modes de montage, ou il n'y a pas la place d'afficher
         * des apercus: on y retrouve ce qu'on a juge dans la bibliotheque.
         */
        sortFavoritesFirst: (entries = []) => [
            ...entries.filter((entry) => ids.includes(entry.id)),
            ...entries.filter((entry) => !ids.includes(entry.id)),
        ],
    };
}
