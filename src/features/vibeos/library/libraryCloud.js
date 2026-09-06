"use client";

import {
    collection, deleteDoc, doc, onSnapshot, setDoc,
} from 'firebase/firestore';
import {
    deleteObject, getBlob, getDownloadURL, ref, uploadBytes,
} from 'firebase/storage';
import { auth, db, firebaseReady, storage } from '@/lib/firebase';

/*
 * Sauvegarde de la bibliotheque dans le compte utilisateur.
 *
 * Ce qui part, et pourquoi:
 * - l'ORIGINAL, parce que le but est de ne plus jamais reimporter une photo
 *   depuis l'appareil pour la retoucher: sans lui, on ne peut pas exporter en
 *   pleine resolution depuis un autre poste;
 * - l'APERCU 1600 px a cote, parce que sans lui la grille redescendrait des
 *   fichiers de 8 Mo par tuile pour afficher des vignettes. C'est l'apercu qui
 *   s'affiche; l'original n'est rapatrie qu'a l'ouverture ou a la retouche.
 *
 * Ce qui ne part pas: les fichiers au-dela de `MAX_ORIGINAL_BYTES`. Leur apercu
 * est sauvegarde, l'original reste sur l'appareil, et la photo le dit
 * (`originalSkipped`). Mieux vaut une limite annoncee qu'un import qui echoue
 * au bout de trois minutes.
 */

export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

const FOLDERS = 'libraryFolders';
const PHOTOS = 'libraryPhotos';

export function cloudReady() {
    return Boolean(firebaseReady && db && storage);
}

/* Le compte a utiliser, ou `null`. Le contournement d'authentification de
   developpement fabrique un utilisateur qui n'existe pas cote Firebase: ecrire
   sous son identifiant serait refuse par les regles, donc on ne tente rien. */
export function cloudUid(user) {
    if (!user?.uid || !cloudReady()) return null;
    if (auth?.currentUser?.uid !== user.uid) return null;
    return user.uid;
}

/* Firestore refuse `undefined`. Un EXIF partiel en contient toujours. */
function prune(value) {
    if (Array.isArray(value)) return value.map(prune);
    if (value && typeof value === 'object') {
        const out = {};
        Object.entries(value).forEach(([key, item]) => {
            if (item === undefined) return;
            out[key] = prune(item);
        });
        return out;
    }
    return value === undefined ? null : value;
}

function extensionOf(photo) {
    const fromName = String(photo.name || '').split('.').pop();
    if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/i.test(fromName)) return fromName.toLowerCase();
    const fromType = String(photo.type || '').split('/').pop();
    return fromType || 'jpg';
}

export function photoStoragePath(uid, photoId, file) {
    return `users/${uid}/library/${photoId}/${file}`;
}

/* ---------- Ecriture ---------- */

export async function pushFolder(uid, folder) {
    await setDoc(doc(db, 'users', uid, FOLDERS, folder.id), prune({
        name: folder.name,
        createdAt: folder.createdAt || Date.now(),
        updatedAt: folder.updatedAt || Date.now(),
        source: folder.source || 'files',
        coverId: folder.coverId || null,
        ownerUid: uid,
    }), { merge: true });
}

/*
 * Envoie une photo: apercu, puis original, puis la fiche. Cet ordre compte -
 * la fiche Firestore est ecrite EN DERNIER, donc un envoi coupe en cours de
 * route ne laisse jamais une fiche qui pointe vers un fichier absent.
 */
export async function pushPhoto(uid, photo) {
    const previewBlob = photo.thumbBlob || photo.blob;
    if (!previewBlob) throw new Error('Photo sans fichier local.');

    const previewPath = photoStoragePath(uid, photo.id, 'preview.webp');
    await uploadBytes(ref(storage, previewPath), previewBlob, {
        contentType: previewBlob.type || 'image/webp',
    });
    const previewUrl = await getDownloadURL(ref(storage, previewPath));

    let originalPath = null;
    let originalUrl = null;
    let originalSkipped = false;
    if (photo.blob && photo.blob.size <= MAX_ORIGINAL_BYTES) {
        originalPath = photoStoragePath(uid, photo.id, `original.${extensionOf(photo)}`);
        await uploadBytes(ref(storage, originalPath), photo.blob, {
            contentType: photo.blob.type || photo.type || 'image/jpeg',
        });
        originalUrl = await getDownloadURL(ref(storage, originalPath));
    } else if (photo.blob) {
        originalSkipped = true;
    }

    const record = prune({
        ownerUid: uid,
        folderId: photo.folderId || null,
        name: photo.name,
        bytes: photo.bytes || 0,
        type: photo.type || '',
        width: photo.width || 0,
        height: photo.height || 0,
        ratio: photo.ratio || 1,
        thumbWidth: photo.thumbWidth || 0,
        thumbHeight: photo.thumbHeight || 0,
        addedAt: photo.addedAt || Date.now(),
        takenAt: photo.takenAt || null,
        exif: photo.exif || null,
        preset: photo.preset || null,
        favorite: Boolean(photo.favorite),
        /* D'ou vient cette photo, quand elle vient de la Room. C'est ce lien qui
           evite de reimporter la meme image dans le meme dossier — y compris
           depuis un autre appareil, puisqu'il voyage avec la fiche. */
        fromRoomId: photo.fromRoomId || null,
        previewPath,
        previewUrl,
        originalPath,
        originalUrl,
        originalSkipped,
        updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'users', uid, PHOTOS, photo.id), record, { merge: true });
    return { previewPath, previewUrl, originalPath, originalUrl, originalSkipped };
}

/*
 * Change quelques champs d'une fiche deja dans le compte, sans toucher aux
 * fichiers.
 *
 * Deplacer une photo d'un dossier a l'autre ne change pas un pixel: repasser
 * par `pushPhoto` renverrait l'apercu ET l'original - plusieurs megaoctets - pour
 * ecrire un identifiant de dossier. Ici on n'ecrit que la fiche.
 */
export async function patchPhotoRemote(uid, photoId, fields) {
    await setDoc(
        doc(db, 'users', uid, PHOTOS, photoId),
        prune({ ...fields, updatedAt: Date.now() }),
        { merge: true },
    );
}

/*
 * Supprime la photo du compte.
 *
 * Les fichiers Storage pardonnent l'echec: un objet deja absent, c'est le
 * resultat voulu. La FICHE Firestore, non - et elle ne l'avalait plus
 * silencieusement qu'a un prix: l'appelant croyait la suppression faite, la
 * marquait comme telle, et la photo revenait a la session suivante. Une erreur
 * ici doit remonter pour que la suppression reste une tache a finir.
 */
export async function deletePhotoRemote(uid, photo) {
    const paths = [
        photo?.cloud?.previewPath || photoStoragePath(uid, photo.id, 'preview.webp'),
        photo?.cloud?.originalPath || null,
    ].filter(Boolean);
    await Promise.all(paths.map((path) => deleteObject(ref(storage, path)).catch(() => null)));
    await deleteDoc(doc(db, 'users', uid, PHOTOS, photo.id));
}

export async function deleteFolderRemote(uid, folderId) {
    await deleteDoc(doc(db, 'users', uid, FOLDERS, folderId)).catch(() => null);
}

/* ---------- Lecture ---------- */

export function subscribeLibrary(uid, { onFolders, onPhotos, onError }) {
    const stopFolders = onSnapshot(
        collection(db, 'users', uid, FOLDERS),
        (snapshot) => onFolders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        onError,
    );
    const stopPhotos = onSnapshot(
        collection(db, 'users', uid, PHOTOS),
        (snapshot) => onPhotos(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        onError,
    );
    return () => { stopFolders(); stopPhotos(); };
}

/* Rapatrie le fichier d'origine d'une photo qui n'existe que dans le compte. */
export async function fetchBlob(url, storagePath = null) {
    /* Le chemin Storage est la source la plus durable : il passe par le SDK,
       l'utilisateur Firebase et les règles owner-scoped. L'URL avec token
       reste le repli pour les anciennes fiches qui ne portaient pas encore le
       chemin. Les deux requêtes exigent le CORS du bucket sur App Hosting. */
    if (storagePath && storage) {
        try {
            return await getBlob(ref(storage, storagePath));
        } catch {
            /* Une ancienne fiche ou un objet déplacé peut encore avoir une URL
               valide : on la tente avant de déclarer la photo absente. */
        }
    }
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.blob();
}
