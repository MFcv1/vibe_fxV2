/*
 * Persistance IndexedDB du projet VibeOS.
 * - store `projects` : projets complets, cle = id (les images pourront y vivre
 *   en Blob des la phase B - IndexedDB les accepte nativement).
 * - store `meta` : petites cles/valeurs, dont `currentProjectId`.
 * Toute erreur IndexedDB (quota, navigation privee) degrade en no-op: l'app
 * fonctionne alors en memoire seule, sans jamais bloquer la creation.
 */

const DB_NAME = 'vibeos';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const META_STORE = 'meta';
const CURRENT_PROJECT_KEY = 'currentProjectId';
export const RECENTS_LIMIT = 8;

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB indisponible'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
                const store = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
                store.createIndex('updatedAt', 'updatedAt');
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE);
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

async function withStore(storeName, mode, run) {
    const db = await openDb();
    try {
        const tx = db.transaction(storeName, mode);
        const result = await run(tx.objectStore(storeName));
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

export async function saveProject(project) {
    try {
        await withStore(PROJECTS_STORE, 'readwrite', (store) => requestToPromise(store.put(project)));
        return true;
    } catch {
        return false;
    }
}

export async function loadProject(id) {
    try {
        return await withStore(PROJECTS_STORE, 'readonly', (store) => requestToPromise(store.get(id)));
    } catch {
        return null;
    }
}

export async function deleteProject(id) {
    try {
        await withStore(PROJECTS_STORE, 'readwrite', (store) => requestToPromise(store.delete(id)));
        return true;
    } catch {
        return false;
    }
}

export async function listRecentProjects(limit = RECENTS_LIMIT) {
    try {
        const projects = await withStore(PROJECTS_STORE, 'readonly', (store) => requestToPromise(store.getAll()));
        return (projects || [])
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, limit);
    } catch {
        return [];
    }
}

export async function getCurrentProjectId() {
    try {
        return await withStore(META_STORE, 'readonly', (store) => requestToPromise(store.get(CURRENT_PROJECT_KEY)));
    } catch {
        return null;
    }
}

export async function setCurrentProjectId(id) {
    try {
        await withStore(META_STORE, 'readwrite', (store) => requestToPromise(store.put(id, CURRENT_PROJECT_KEY)));
        return true;
    } catch {
        return false;
    }
}
