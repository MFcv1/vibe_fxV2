"use client";

/*
 * Bibliotheque photo VibeOS - persistance IndexedDB.
 *
 * Base separee de `vibeos` (les projets) volontairement: la bibliotheque a son
 * propre cycle de vie. Supprimer un projet ne doit jamais faire disparaitre les
 * photos importees, et faire evoluer le schema de l'une ne doit pas forcer une
 * migration de l'autre.
 *
 * Deux magasins:
 * - `photos`: la photo pleine resolution (Blob), sa vignette (Blob), ses EXIF
 *   et le dossier qui la contient. Jamais de dataURL: une photo de telephone en
 *   base64 pese ~33% de plus et sature le quota.
 * - `folders`: les dossiers d'import. Un import = un dossier, comme sur un OS.
 *   C'est la seule unite que l'utilisateur deplace, renomme ou supprime en bloc.
 * - `tombstones`: les photos supprimees. Voir plus bas - c'est ce magasin qui
 *   empeche une suppression de se faire annuler par le compte.
 */

const DB_NAME = 'vibeos-library';
const DB_VERSION = 3;
const PHOTOS_STORE = 'photos';
const FOLDERS_STORE = 'folders';
const TOMBSTONES_STORE = 'tombstones';

/* Dossier d'accueil des photos importees AVANT l'arrivee des dossiers. Elles
   ne peuvent pas rester sans parent: l'ecran ne montre que des dossiers. */
export const LEGACY_FOLDER_ID = 'fd-import-initial';
const LEGACY_FOLDER_NAME = 'Photos importées';

/*
 * Migration v1 -> v2: chaque photo deja stockee rejoint le dossier de reprise,
 * et ce dossier n'est cree que s'il y a vraiment une photo a y mettre - une
 * bibliotheque vide ne doit pas gagner un dossier fantome.
 */
function adoptOrphans(tx) {
    const photos = tx.objectStore(PHOTOS_STORE);
    const folders = tx.objectStore(FOLDERS_STORE);
    let adopted = 0;
    let oldest = Date.now();
    photos.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
            if (!adopted) return;
            folders.put({
                id: LEGACY_FOLDER_ID,
                name: LEGACY_FOLDER_NAME,
                createdAt: oldest,
                updatedAt: Date.now(),
                source: 'files',
                coverId: null,
            });
            return;
        }
        const photo = cursor.value;
        if (!photo.folderId) {
            oldest = Math.min(oldest, photo.addedAt || Date.now());
            adopted += 1;
            cursor.update({ ...photo, folderId: LEGACY_FOLDER_ID });
        }
        cursor.continue();
    };
}

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB indisponible'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = request.result;
            const tx = request.transaction;
            const fresh = !db.objectStoreNames.contains(PHOTOS_STORE);
            if (fresh) {
                const store = db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
                store.createIndex('addedAt', 'addedAt');
                store.createIndex('device', 'exif.device');
                store.createIndex('folderId', 'folderId');
            } else {
                const store = tx.objectStore(PHOTOS_STORE);
                if (!store.indexNames.contains('folderId')) store.createIndex('folderId', 'folderId');
            }
            if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
                const folders = db.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
                folders.createIndex('createdAt', 'createdAt');
            }
            if (!db.objectStoreNames.contains(TOMBSTONES_STORE)) {
                db.createObjectStore(TOMBSTONES_STORE, { keyPath: 'id' });
            }
            if (!fresh && event.oldVersion < 2) adoptOrphans(tx);
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

async function withStores(names, mode, run) {
    const db = await openDb();
    try {
        const list = Array.isArray(names) ? names : [names];
        const tx = db.transaction(list, mode);
        const stores = list.map((name) => tx.objectStore(name));
        const result = await run(...stores);
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

function withStore(mode, run) {
    return withStores(PHOTOS_STORE, mode, run);
}

export function createPhotoId() {
    return `ph-${randomSuffix()}`;
}

export function createFolderId() {
    return `fd-${randomSuffix()}`;
}

function randomSuffix() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- Photos ---------- */

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

/* ---------- Dossiers ---------- */

export async function putFolder(folder) {
    try {
        await withStores(FOLDERS_STORE, 'readwrite', (store) => requestToPromise(store.put(folder)));
        return true;
    } catch {
        return false;
    }
}

export async function listFolders() {
    try {
        const all = await withStores(FOLDERS_STORE, 'readonly', (store) => requestToPromise(store.getAll()));
        return (all || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
        return [];
    }
}

/*
 * Supprime un dossier ET ses photos, dans une seule transaction: un dossier a
 * moitie supprime laisserait des photos orphelines, donc invisibles et
 * impossibles a effacer depuis l'ecran.
 */
export async function deleteFolderDeep(folderId) {
    try {
        return await withStores([FOLDERS_STORE, PHOTOS_STORE], 'readwrite', async (folders, photos) => {
            const removed = [];
            await new Promise((resolve, reject) => {
                const cursorRequest = photos.index('folderId').openCursor(IDBKeyRange.only(folderId));
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (!cursor) { resolve(); return; }
                    removed.push(cursor.value.id);
                    cursor.delete();
                    cursor.continue();
                };
                cursorRequest.onerror = () => reject(cursorRequest.error);
            });
            await requestToPromise(folders.delete(folderId));
            return removed;
        });
    } catch {
        return [];
    }
}


/* ---------- Suppressions ---------- */

/*
 * Les pierres tombales, et pourquoi elles sont ECRITES SUR LE DISQUE.
 *
 * Supprimer une photo, c'est trois gestes: retirer la fiche locale, retirer la
 * fiche du compte, retirer les fichiers de Storage. Les deux derniers passent
 * par le reseau. Si l'utilisateur ferme l'onglet, perd sa connexion, ou n'est
 * simplement pas encore identifie quand il clique, ils n'ont pas lieu - et a la
 * reouverture, l'ecoute du compte fait revenir tout ce qu'il croyait avoir
 * supprime. C'est exactement le « je supprime les doublons, je reviens, tout
 * est revenu » constate en usage.
 *
 * Une pierre tombale repond aux deux moities du probleme:
 * - `remoteDone: false` est une TACHE A FINIR. Tant qu'elle est la, la
 *   suppression distante sera retentee, cette session ou la suivante.
 * - sa seule presence INTERDIT LE RETOUR de la photo. La descente depuis le
 *   compte la refuse, meme si la fiche distante existe encore.
 *
 * Elles ne durent pas eternellement: une fois la suppression distante
 * confirmee, la pierre est gardee `TOMBSTONE_KEEP_MS` puis nettoyee. Assez
 * longtemps pour couvrir un cache Firestore qui traine, assez court pour ne pas
 * accumuler du bruit pendant des annees.
 */
export const TOMBSTONE_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/*
 * `entries` accepte un identifiant, ou un objet `{ id, previewPath,
 * originalPath }`.
 *
 * Les chemins Storage sont recopies ICI parce que la fiche locale, elle, va
 * disparaitre. Une pierre honoree la session suivante n'aurait plus de quoi
 * retrouver le fichier d'origine, et il resterait a payer dans le bucket sans
 * que rien ne le reference.
 */
export async function putTombstones(entries, { remoteDone = false } = {}) {
    if (!entries?.length) return true;
    try {
        const now = Date.now();
        const rows = entries.filter(Boolean).map((entry) => (
            typeof entry === 'string'
                ? { id: entry, at: now, remoteDone }
                : {
                    id: entry.id,
                    at: now,
                    remoteDone,
                    previewPath: entry.previewPath || null,
                    originalPath: entry.originalPath || null,
                }
        ));
        await withStores(TOMBSTONES_STORE, 'readwrite', (store) => Promise.all(
            rows.map((row) => requestToPromise(store.put(row))),
        ));
        return true;
    } catch {
        return false;
    }
}

export async function listTombstones() {
    try {
        const all = await withStores(TOMBSTONES_STORE, 'readonly', (store) => requestToPromise(store.getAll()));
        return all || [];
    } catch {
        return [];
    }
}

/* La date est celle de la CONFIRMATION, pas celle du clic: la pierre doit
   survivre trente jours a la suppression reellement passee, pas a l'intention.
   Ecriture directe, sans relire d'abord - une lecture suivie d'une ecriture
   dans la meme transaction se fait refermer la porte au nez sur Safari. */
export async function markTombstoneDone(row) {
    const base = typeof row === 'string' ? { id: row } : (row || {});
    if (!base.id) return false;
    try {
        await withStores(TOMBSTONES_STORE, 'readwrite', (store) => (
            requestToPromise(store.put({ ...base, at: Date.now(), remoteDone: true }))
        ));
        return true;
    } catch {
        return false;
    }
}

/* Lever une pierre: la photo est volontairement recreee sous la meme cle.
   Sans ce geste, reenregistrer une image de Room supprimee par erreur donnerait
   une photo invisible - ecrite en local, puis refusee a la remontee. */
export async function dropTombstones(ids) {
    if (!ids?.length) return true;
    try {
        await withStores(TOMBSTONES_STORE, 'readwrite', (store) => Promise.all(
            ids.filter(Boolean).map((id) => requestToPromise(store.delete(id))),
        ));
        return true;
    } catch {
        return false;
    }
}

/* Ne garde que ce qui sert encore: les taches non finies, et les suppressions
   recentes. */
export async function purgeTombstones(now = Date.now()) {
    try {
        const rows = await listTombstones();
        const perimes = rows
            .filter((row) => row.remoteDone && now - (row.at || 0) > TOMBSTONE_KEEP_MS)
            .map((row) => row.id);
        if (perimes.length) await dropTombstones(perimes);
        return perimes.length;
    } catch {
        return 0;
    }
}

/* ---------- Poids ---------- */

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
