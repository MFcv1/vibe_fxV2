/*
 * Persistance de la Room: les rendus mis de cote pour un futur post.
 *
 * Une ligne = une image du carrousel, avec son Blob pleine definition (jamais
 * une dataURL, plan §7) et sa place dans l'ordre. Le store vit dans la base
 * `vibeos`, a cote des projets: meme duree de vie, meme confidentialite, rien
 * ne part au serveur tant que l'utilisateur ne publie pas.
 *
 * Comme pour les projets, toute erreur IndexedDB degrade en no-op: la Room
 * fonctionne alors le temps de la session, sans jamais bloquer l'ecran.
 */

import { ROOM_STORE, readMeta, requestToPromise, withStore, writeMeta } from '../project/projectDb';

const VALIDATED_KEY = 'roomValidatedAt';

export function createRoomItemId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* Toujours renvoye trie par `order`: c'est l'ordre du carrousel, et il ne doit
   jamais dependre de l'ordre de lecture d'IndexedDB. */
export async function listRoomItems() {
    try {
        const rows = await withStore(ROOM_STORE, 'readonly', (store) => requestToPromise(store.getAll()));
        return (rows || [])
            /*
             * Une fiche vaut si elle a de quoi montrer une image: un fichier
             * local, OU une adresse dans le compte. Le filtre ne gardait que le
             * premier cas — il datait de l'epoque ou la Room ne vivait que dans
             * ce navigateur — et il aurait rendu invisible tout ce qui arrive
             * d'un autre appareil.
             */
            .filter((row) => row?.blob || row?.cloud?.url)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch {
        return [];
    }
}

export async function putRoomItems(records) {
    if (!records?.length) return true;
    try {
        /* Toutes les requetes sont emises d'un coup, puis attendues ensemble:
           attendre l'une avant d'emettre la suivante laisserait la transaction
           se refermer toute seule entre deux tours. */
        await withStore(ROOM_STORE, 'readwrite', (store) => Promise.all(
            records.map((record) => requestToPromise(store.put(record))),
        ));
        return true;
    } catch {
        return false;
    }
}

export async function deleteRoomItem(id) {
    try {
        await withStore(ROOM_STORE, 'readwrite', (store) => requestToPromise(store.delete(id)));
        return true;
    } catch {
        return false;
    }
}

export async function clearRoomItems() {
    try {
        await withStore(ROOM_STORE, 'readwrite', (store) => requestToPromise(store.clear()));
        return true;
    } catch {
        return false;
    }
}

export function readRoomValidatedAt() {
    return readMeta(VALIDATED_KEY);
}

export function writeRoomValidatedAt(value) {
    return writeMeta(VALIDATED_KEY, value || null);
}
