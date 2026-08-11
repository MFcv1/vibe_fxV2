"use client";

/*
 * Bibliotheque photo VibeOS - persistance IndexedDB.
 *
 * Base separee de `vibeos` (les projets) volontairement: la bibliotheque a son
 * propre cycle de vie. Supprimer un projet ne doit jamais faire disparaitre les
 * photos importees, et faire evoluer le schema de l'une ne doit pas forcer une
 * migration de l'autre.
 *
 * Un enregistrement = la photo pleine resolution (Blob), sa vignette (Blob) et
 * ses metadonnees EXIF. Jamais de dataURL: une photo de telephone en base64
 * pese ~33% de plus et sature le quota.
 */

const DB_NAME = 'vibeos-library';
const DB_VERSION = 1;
const PHOTOS_STORE = 'photos';

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB indisponible'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
                const store = db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
                store.createIndex('addedAt', 'addedAt');
                store.createIndex('device', 'exif.device');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withStore(mode, run) {
    const db = await openDb();
    try {
        const tx = db.transaction(PHOTOS_STORE, mode);
        const result = await run(tx.objectStore(PHOTOS_STORE));
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
        return result;
    } finally {
        db.close();
    }
}

export function createPhotoId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `ph-${crypto.randomUUID()}`;
    }
    return `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function putPhoto(photo) {
    try {
        await withStore('readwrite', (store) => requestToPromise(store.put(photo)));
        return true;
    } catch {
        return false;
    }
}

export async function getPhoto(id) {
    try {
        return await withStore('readonly', (store) => requestToPromise(store.get(id)));
    } catch {
        return null;
    }
}

/* Les plus recentes d'abord. La bibliotheque personnelle reste de l'ordre de
   quelques centaines de photos: un getAll suffit, pas besoin de curseur. */
export async function listPhotos() {
    try {
        const all = await withStore('readonly', (store) => requestToPromise(store.getAll()));
        return (all || []).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    } catch {
        return [];
    }
}

export async function deletePhoto(id) {
    try {
        await withStore('readwrite', (store) => requestToPromise(store.delete(id)));
        return true;
    } catch {
        return false;
    }
}

export async function clearPhotos() {
    try {
        await withStore('readwrite', (store) => requestToPromise(store.clear()));
        return true;
    } catch {
        return false;
    }
}

/* Poids total occupe, pour l'afficher honnetement a l'utilisateur. */
export function totalBytes(photos) {
    return (photos || []).reduce((sum, photo) => sum + (photo.bytes || 0), 0);
}

export function formatBytes(bytes) {
    if (!bytes) return '0 Mo';
    const mo = bytes / (1024 * 1024);
    if (mo < 1) return `${Math.round(bytes / 1024)} Ko`;
    if (mo < 1024) return `${mo.toFixed(mo < 10 ? 1 : 0)} Mo`;
    return `${(mo / 1024).toFixed(1)} Go`;
}
