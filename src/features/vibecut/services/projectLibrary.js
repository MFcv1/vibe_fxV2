/*
 * Bibliotheque de projets VibeCut (IndexedDB).
 *
 * Contrainte importante: l'ancien front ouvre la meme base en version 1 via
 * `videoProjectPersistence.js`. Un bump de version ferait echouer ses appels
 * (VersionError). On ouvre donc la base SANS numero de version et on cohabite
 * dans le meme object store avec deux prefixes de cle:
 *
 *   project:<id>  -> snapshot complet (meme format que createVideoProjectSnapshot)
 *   meta:<id>     -> fiche legere pour l'ecran d'accueil (nom, date, poster...)
 *
 * L'enregistrement historique `vibecut-local-current` est expose comme le projet
 * d'id `current`, sa fiche est reconstruite a la volee si elle manque.
 */

import {
    createVideoProjectSnapshot,
    restoreVideoProjectSnapshot,
} from '@/features/vibefx-studio/video/model/videoProjectModel';

const DATABASE_NAME = 'vibecut-local-projects';
const STORE_NAME = 'projects';
const LEGACY_PROJECT_ID = 'current';
const LEGACY_RECORD_KEY = 'vibecut-local-current';
const PROJECT_PREFIX = 'project:';
const META_PREFIX = 'meta:';

export const DEFAULT_PROJECT_NAME = 'Projet sans titre';

export function createProjectId() {
    const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10);
    return `p-${Date.now().toString(36)}-${random.slice(0, 8)}`;
}

function projectKey(id) {
    return id === LEGACY_PROJECT_ID ? LEGACY_RECORD_KEY : `${PROJECT_PREFIX}${id}`;
}

function metaKey(id) {
    return `${META_PREFIX}${id}`;
}

function isAvailable() {
    return typeof indexedDB !== 'undefined';
}

function openDatabase() {
    if (!isAvailable()) {
        return Promise.reject(new Error('Sauvegarde locale indisponible dans ce navigateur.'));
    }
    return new Promise((resolve, reject) => {
        // Pas de numero de version: on ouvre la base telle qu'elle est, et on la cree
        // en version 1 si elle n'existe pas encore.
        const request = indexedDB.open(DATABASE_NAME);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.close();
                reject(new Error('Sauvegarde locale VibeCut introuvable.'));
                return;
            }
            resolve(database);
        };
        request.onerror = () => reject(request.error || new Error('Ouverture de la sauvegarde locale impossible.'));
    });
}

function toPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Operation locale impossible.'));
    });
}

async function withStore(mode, run) {
    const database = await openDatabase();
    try {
        const store = database.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
        return await run(store);
    } finally {
        database.close();
    }
}

function pickPoster(clips = []) {
    for (const clip of clips) {
        const thumbnail = (clip.thumbnails || []).find((value) => (
            typeof value === 'string' && value.startsWith('data:')
        ));
        if (thumbnail) return thumbnail;
    }
    return null;
}

function computeDuration(snapshotProject = {}) {
    const clips = snapshotProject.clips || [];
    return clips.reduce((total, clip) => {
        const speed = Number(clip.speed) > 0 ? Number(clip.speed) : 1;
        const trimStart = Number(clip.trimStart) || 0;
        const trimEnd = Number.isFinite(Number(clip.trimEnd)) ? Number(clip.trimEnd) : Number(clip.duration) || 0;
        return total + Math.max(0, (trimEnd - trimStart) / speed);
    }, 0);
}

function buildMeta(id, snapshot) {
    const project = snapshot.project || {};
    const clips = project.clips || [];
    return {
        id: metaKey(id),
        projectId: id,
        kind: 'meta',
        name: snapshot.projectName || DEFAULT_PROJECT_NAME,
        savedAt: snapshot.savedAt || new Date().toISOString(),
        sceneCount: clips.length,
        durationSeconds: computeDuration(project),
        sequencePreset: project.sequencePreset || 'instagram-reel',
        poster: pickPoster(clips),
    };
}

function metaToProject(meta) {
    return {
        id: meta.projectId,
        name: meta.name || DEFAULT_PROJECT_NAME,
        savedAt: meta.savedAt || null,
        sceneCount: Number(meta.sceneCount) || 0,
        durationSeconds: Number(meta.durationSeconds) || 0,
        sequencePreset: meta.sequencePreset || 'instagram-reel',
        poster: meta.poster || null,
    };
}

/** Liste les projets pour l'accueil, du plus recent au plus ancien. */
export async function listProjects() {
    if (!isAvailable()) return [];
    return withStore('readonly', async (store) => {
        const keys = await toPromise(store.getAllKeys());
        const metaKeys = keys.filter((key) => typeof key === 'string' && key.startsWith(META_PREFIX));
        const metas = await Promise.all(metaKeys.map((key) => toPromise(store.get(key))));
        const projects = metas.filter(Boolean).map(metaToProject);

        // Projet historique de l'ancien front: on le referme dans la liste sans le
        // dupliquer si sa fiche existe deja.
        const hasLegacyMeta = projects.some((project) => project.id === LEGACY_PROJECT_ID);
        if (!hasLegacyMeta && keys.includes(LEGACY_RECORD_KEY)) {
            const legacy = await toPromise(store.get(LEGACY_RECORD_KEY));
            if (legacy?.project) {
                projects.push(metaToProject(buildMeta(LEGACY_PROJECT_ID, legacy)));
            }
        }

        return projects.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
    });
}

/** Ecrit (ou met a jour) un projet et sa fiche. */
export async function saveProject({ id, state, name } = {}) {
    const projectId = id || createProjectId();
    const savedAt = new Date().toISOString();
    const snapshot = {
        ...createVideoProjectSnapshot({ ...state, projectName: name || state?.projectName || DEFAULT_PROJECT_NAME }, { savedAt }),
        id: projectKey(projectId),
    };
    const meta = buildMeta(projectId, snapshot);

    await withStore('readwrite', async (store) => {
        await toPromise(store.put(snapshot));
        await toPromise(store.put(meta));
    });

    return { id: projectId, meta: metaToProject(meta) };
}

/** Cree un projet vide (utilise par "Nouveau projet" sur l'accueil). */
export async function createEmptyProject({ name = DEFAULT_PROJECT_NAME, sequencePreset = 'instagram-reel' } = {}) {
    return saveProject({
        name,
        state: {
            projectName: name,
            clips: [],
            transitions: {},
            transitionItems: [],
            textOverlays: [],
            audioTracks: [],
            tracks: [],
            sequencePreset,
        },
    });
}

/** Relit un projet et rehydrate ses blobs en object URLs. */
export async function loadProject(id) {
    if (!id) return null;
    const record = await withStore('readonly', (store) => toPromise(store.get(projectKey(id))));
    if (!record) return null;
    const restored = restoreVideoProjectSnapshot(record, {
        createObjectUrl: (blob) => URL.createObjectURL(blob),
    });
    return { id, ...restored };
}

export async function renameProject(id, name) {
    const nextName = String(name || '').trim() || DEFAULT_PROJECT_NAME;
    await withStore('readwrite', async (store) => {
        const record = await toPromise(store.get(projectKey(id)));
        if (record) {
            await toPromise(store.put({ ...record, projectName: nextName }));
        }
        const meta = await toPromise(store.get(metaKey(id)));
        if (meta) {
            await toPromise(store.put({ ...meta, name: nextName }));
        } else if (record) {
            await toPromise(store.put({ ...buildMeta(id, record), name: nextName }));
        }
    });
    return nextName;
}

export async function deleteProject(id) {
    await withStore('readwrite', async (store) => {
        await toPromise(store.delete(projectKey(id)));
        await toPromise(store.delete(metaKey(id)));
    });
}

/* ------------------------------------------------------------------ *
 * Favoris des bibliotheques (lot B1).
 *
 * Stockes ICI, dans la meme base IndexedDB que les projets, sous une cle
 * dediee. PAS dans `localStorage`: le projet stocke deja tout le reste en
 * IndexedDB, et melanger les deux ferait DEUX sources de verite - c'est
 * exactement le risque note dans la feuille de route des bibliotheques.
 *
 * L'enregistrement porte `kind: 'favorites'` et une cle prefixee `favorites:`.
 * `listProjects()` ne lit que les cles `meta:`, il ne peut donc pas le
 * confondre avec un projet.
 * ------------------------------------------------------------------ */

const FAVORITES_KEY = 'favorites:v1';

/** Les deux bibliotheques ont leurs favoris propres: une transition n'est pas un mouvement. */
export const FAVORITE_KINDS = ['transitions', 'motions'];

function normalizeFavorites(record) {
    const pick = (value) => (Array.isArray(value)
        ? value.filter((id) => typeof id === 'string' && id.length > 0)
        : []);
    return {
        transitions: pick(record?.transitions),
        motions: pick(record?.motions),
    };
}

/** Relit les favoris. Un navigateur sans IndexedDB renvoie des listes vides, jamais une erreur. */
export async function loadFavorites() {
    if (!isAvailable()) return normalizeFavorites(null);
    try {
        const record = await withStore('readonly', (store) => toPromise(store.get(FAVORITES_KEY)));
        return normalizeFavorites(record);
    } catch {
        /*
         * Un favori est un confort, pas une donnee de production: son echec de
         * lecture ne doit jamais empecher la bibliotheque de s'afficher.
         */
        return normalizeFavorites(null);
    }
}

/** Ecrit les favoris. Renvoie ce qui a reellement ete ecrit. */
export async function saveFavorites(favorites) {
    const next = normalizeFavorites(favorites);
    if (!isAvailable()) return next;
    try {
        await withStore('readwrite', (store) => toPromise(store.put({
            id: FAVORITES_KEY,
            kind: 'favorites',
            ...next,
            savedAt: new Date().toISOString(),
        })));
    } catch {
        // Idem: on n'interrompt pas l'ecran pour un favori non ecrit.
    }
    return next;
}

export function formatProjectDuration(seconds = 0) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatProjectDate(value, now = new Date()) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `Aujourd'hui, ${time}`;
    if (date.toDateString() === yesterday.toDateString()) return `Hier, ${time}`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
