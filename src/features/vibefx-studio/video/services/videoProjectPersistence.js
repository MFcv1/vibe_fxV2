import { createVideoProjectSnapshot, restoreVideoProjectSnapshot } from '../model/videoProjectModel';

const DATABASE_NAME = 'vibecut-local-projects';
const DATABASE_VERSION = 1;
const STORE_NAME = 'projects';
const CURRENT_PROJECT_ID = 'vibecut-local-current';

export async function saveCurrentVideoProject(state) {
    const snapshot = createVideoProjectSnapshot(state);
    const database = await openDatabase();
    await requestToPromise(
        database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(snapshot)
    );
    database.close();
    return snapshot;
}

export async function loadCurrentVideoProject() {
    const database = await openDatabase();
    const snapshot = await requestToPromise(
        database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(CURRENT_PROJECT_ID)
    );
    database.close();
    if (!snapshot) return null;
    return restoreVideoProjectSnapshot(snapshot, {
        createObjectUrl: (blob) => URL.createObjectURL(blob),
    });
}

export async function hasCurrentVideoProject() {
    const database = await openDatabase();
    const key = await requestToPromise(
        database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getKey(CURRENT_PROJECT_ID)
    );
    database.close();
    return Boolean(key);
}

function openDatabase() {
    if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('IndexedDB indisponible dans ce navigateur.'));
    }
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Ouverture sauvegarde locale impossible.'));
    });
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Operation IndexedDB impossible.'));
    });
}
