"use client";

import {
    collection, deleteDoc, doc, onSnapshot, setDoc,
} from 'firebase/firestore';
import {
    deleteObject, getBlob, getDownloadURL, ref, uploadBytes,
} from 'firebase/storage';
import { auth, db, firebaseReady, storage } from '@/lib/firebase';

/*
 * La Room dans le compte utilisateur.
 *
 * Jusqu'ici la Room ne vivait que dans IndexedDB, donc dans UN navigateur : la
 * file preparee sur le portable etait introuvable sur le fixe, et vider les
 * donnees du site suffisait a la perdre. Ce module lui donne le meme traitement
 * qu'a la bibliotheque : l'image dans Storage, la fiche dans Firestore, sous
 * `users/{uid}`.
 *
 * Ce qui part : le RENDU tel quel (JPEG qualite 0.95, fabrique par
 * `buildSocialImages`), plus sa place dans le carrousel. Pas de vignette
 * separee, contrairement a la bibliotheque : la Room affiche une dizaine
 * d'images, pas plusieurs centaines, et c'est l'image finale qu'on veut voir.
 */

const ITEMS = 'roomItems';

/*
 * Plafond d'envoi. Plus haut que celui de la bibliotheque (25 Mo) parce qu'un
 * rendu de Room est deja un export social pleine definition : un panorama en
 * 4592x8160 depasse regulierement les 25 Mo, et le laisser de cote serait
 * perdre precisement l'image que l'utilisateur veut retrouver ailleurs.
 */
export const MAX_ROOM_BYTES = 40 * 1024 * 1024;

export function roomCloudReady() {
    return Boolean(firebaseReady && db && storage);
}

/* Le compte a utiliser, ou `null`. Le contournement d'authentification de
   developpement fabrique un utilisateur qui n'existe pas cote Firebase: ecrire
   sous son identifiant serait refuse par les regles. */
export function roomCloudUid(user) {
    if (!user?.uid || !roomCloudReady()) return null;
    if (auth?.currentUser?.uid !== user.uid) return null;
    return user.uid;
}

function prune(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const out = {};
        Object.entries(value).forEach(([key, item]) => {
            if (item === undefined) return;
            out[key] = item;
        });
        return out;
    }
    return value === undefined ? null : value;
}

export function roomStoragePath(uid, itemId, file = 'image.jpg') {
    return `users/${uid}/room/${itemId}/${file}`;
}

/*
 * Envoie une image: le fichier d'abord, la fiche ENSUITE. Cet ordre compte -
 * une fiche ecrite avant son image pointerait, le temps d'une coupure reseau,
 * vers un fichier qui n'existe pas, et l'autre appareil afficherait un trou.
 */
export async function pushRoomItem(uid, item) {
    if (!item.blob) throw new Error('Image de Room sans fichier local.');
    if (item.blob.size > MAX_ROOM_BYTES) {
        const error = new Error('Image trop lourde pour la sauvegarde.');
        error.code = 'too-big';
        throw error;
    }

    const path = roomStoragePath(uid, item.id);
    await uploadBytes(ref(storage, path), item.blob, {
        contentType: item.blob.type || 'image/jpeg',
    });
    const url = await getDownloadURL(ref(storage, path));

    await setDoc(doc(db, 'users', uid, ITEMS, item.id), prune({
        ownerUid: uid,
        order: item.order || 0,
        bytes: item.blob.size || 0,
        width: item.width || 0,
        height: item.height || 0,
        source: item.source || 'layout',
        sourceLabel: item.sourceLabel || 'Rendu',
        formatLabel: item.formatLabel || null,
        projectTitle: item.projectTitle || null,
        createdAt: item.createdAt || Date.now(),
        path,
        url,
        updatedAt: Date.now(),
    }), { merge: true });

    return { path, url };
}

/* L'ordre change souvent - a chaque glisser-deposer - et n'a pas besoin de
   retoucher au fichier. On n'ecrit donc que la fiche. */
export async function pushRoomOrder(uid, items) {
    await Promise.all(items.map((item) => setDoc(
        doc(db, 'users', uid, ITEMS, item.id),
        { order: item.order || 0, updatedAt: Date.now() },
        { merge: true },
    )));
}

export async function deleteRoomItemRemote(uid, item) {
    const path = item?.cloud?.path || roomStoragePath(uid, item.id);
    await deleteObject(ref(storage, path)).catch(() => null);
    await deleteDoc(doc(db, 'users', uid, ITEMS, item.id)).catch(() => null);
}

export function subscribeRoom(uid, { onItems, onError }) {
    return onSnapshot(
        collection(db, 'users', uid, ITEMS),
        (snapshot) => onItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        onError,
    );
}

/* Rapatrie l'image d'un element qui n'existe que dans le compte: le chemin
   Storage d'abord (SDK authentifie, regles owner-scoped), l'URL en repli. */
export async function fetchRoomBlob(url, path = null) {
    if (path && storage) {
        try { return await getBlob(ref(storage, path)); } catch { /* repli */ }
    }
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.blob();
}
