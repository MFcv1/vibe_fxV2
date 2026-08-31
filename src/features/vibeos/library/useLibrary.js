"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    createFolderId, deleteFolderDeep, deletePhoto, listFolders, listPhotos, putFolder, putPhoto,
} from './libraryDb';
import { buildPhotoRecord, deviceLabel, makePreview, PREVIEW_MAX } from './photoImport';
import { sanitizeFolderName, suggestFolderName, uniqueFolderName } from './folderNaming';
import { checkImport, quotaState } from './libraryQuota';

/*
 * Etat de la bibliotheque: dossiers, photos, import, filtres, tri, quota.
 *
 * L'unite visible est le DOSSIER: un import produit un dossier, et la grille de
 * photos n'est plus qu'une vue A L'INTERIEUR d'un dossier. Une photo sans
 * dossier n'existe pas - la migration IndexedDB v1 -> v2 en adopte d'ailleurs
 * toutes les anciennes (voir `libraryDb.js`).
 *
 * Les URLs d'objet sont mises en cache par identifiant de photo. Sans ce cache,
 * chaque rendu de la grille recreerait une URL par vignette et le navigateur
 * garderait chaque Blob en memoire jusqu'a la fermeture de l'onglet.
 */

const thumbUrls = new Map();
const fullUrls = new Map();

export function thumbUrl(photo) {
    if (!photo) return null;
    /* Photo encore dans le nuage: on affiche l'apercu distant tel quel, il n'y a
       pas de Blob local a transformer en URL. */
    if (!photo.thumbBlob && !photo.blob) return photo.previewUrl || null;
    if (!thumbUrls.has(photo.id)) {
        thumbUrls.set(photo.id, URL.createObjectURL(photo.thumbBlob || photo.blob));
    }
    return thumbUrls.get(photo.id);
}

export function fullUrl(photo) {
    if (!photo) return null;
    if (!photo.blob) return photo.originalUrl || photo.previewUrl || null;
    if (!fullUrls.has(photo.id)) {
        fullUrls.set(photo.id, URL.createObjectURL(photo.blob));
    }
    return fullUrls.get(photo.id);
}

function releaseUrls(id) {
    [thumbUrls, fullUrls].forEach((cache) => {
        const url = cache.get(id);
        if (url) URL.revokeObjectURL(url);
        cache.delete(id);
    });
}

/* Seule la vignette est liberee: la pleine resolution peut etre affichee au
   meme instant par le carrousel, la revoquer la ferait disparaitre. */
function releaseThumbUrl(id) {
    const url = thumbUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    thumbUrls.delete(id);
}

export const SORTS = [
    { id: 'added', label: 'Ajout récent' },
    { id: 'taken', label: 'Prise de vue' },
    { id: 'name', label: 'Nom' },
];

const COVER_COUNT = 3;

export default function useLibrary() {
    const [photos, setPhotos] = useState([]);
    const [folders, setFolders] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | ready
    const [importState, setImportState] = useState(null); // { done, total, folderName }
    const [search, setSearch] = useState('');
    const [deviceFilter, setDeviceFilter] = useState('all');
    const [presetFilter, setPresetFilter] = useState('all');
    const [sort, setSort] = useState('added');
    const [activeFolderId, setActiveFolderId] = useState(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        (async () => {
            const [storedPhotos, storedFolders] = await Promise.all([listPhotos(), listFolders()]);
            if (!mountedRef.current) return;
            setPhotos(storedPhotos);
            setFolders(storedFolders);
            setStatus('ready');
        })();
        return () => {
            mountedRef.current = false;
        };
    }, []);

    /* ---------- Quota ---------- */

    const usedBytes = useMemo(
        () => photos.reduce((sum, photo) => sum + (photo.bytes || 0), 0),
        [photos],
    );
    const quota = useMemo(
        () => quotaState({ photoCount: photos.length, bytes: usedBytes }),
        [photos.length, usedBytes],
    );

    /* ---------- Dossiers ---------- */

    const takenNames = useMemo(() => folders.map((folder) => folder.name), [folders]);

    const createFolder = useCallback(async ({ name, source = 'manual' } = {}) => {
        const finalName = uniqueFolderName(sanitizeFolderName(name) || suggestFolderName({ taken: takenNames }), takenNames);
        const folder = {
            id: createFolderId(),
            name: finalName,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source,
            coverId: null,
        };
        await putFolder(folder);
        if (mountedRef.current) setFolders((current) => [folder, ...current]);
        return folder;
    }, [takenNames]);

    const renameFolder = useCallback(async (folderId, nextName) => {
        const clean = sanitizeFolderName(nextName);
        if (!clean) return null;
        const others = folders.filter((folder) => folder.id !== folderId).map((folder) => folder.name);
        const finalName = uniqueFolderName(clean, others);
        let updated = null;
        setFolders((current) => current.map((folder) => {
            if (folder.id !== folderId) return folder;
            updated = { ...folder, name: finalName, updatedAt: Date.now() };
            return updated;
        }));
        if (updated) await putFolder(updated);
        return updated;
    }, [folders]);

    const removeFolder = useCallback(async (folderId) => {
        const removedIds = await deleteFolderDeep(folderId);
        removedIds.forEach(releaseUrls);
        if (!mountedRef.current) return removedIds;
        const removed = new Set(removedIds);
        setPhotos((current) => current.filter((photo) => !removed.has(photo.id)));
        setFolders((current) => current.filter((folder) => folder.id !== folderId));
        setActiveFolderId((current) => (current === folderId ? null : current));
        return removedIds;
    }, []);

    /*
     * Import sequentiel et non bloquant: une photo decodee, stockee, affichee,
     * puis la suivante. Tout decoder en parallele fige l'onglet des qu'on depose
     * une dizaine de JPEG de 8 Mo.
     *
     * Le dossier est cree AVANT la premiere photo: on le voit apparaitre vide et
     * se remplir, plutot que d'attendre la fin d'un import de deux cents photos
     * devant un ecran qui ne bouge pas.
     */
    const importFiles = useCallback(async (fileList, options = {}) => {
        const files = Array.from(fileList || []).filter((file) => (
            file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)
        ));
        if (!files.length) return { added: 0, skipped: 0, folderId: null, message: '' };

        const gate = checkImport({ photoCount: photos.length, bytes: usedBytes, files });
        if (!gate.ok) {
            return { added: 0, skipped: 0, folderId: null, blocked: true, message: gate.message };
        }
        const kept = files.slice(0, gate.accepted);

        let folderId = options.folderId || null;
        let folderName = folders.find((folder) => folder.id === folderId)?.name || '';
        if (!folderId) {
            const folder = await createFolder({
                name: options.folderName || suggestFolderName({ files, taken: takenNames }),
                source: options.source || 'files',
            });
            folderId = folder.id;
            folderName = folder.name;
        }

        setImportState({ done: 0, total: kept.length, folderName });
        let added = 0;
        let skipped = 0;
        let cover = null;

        for (let index = 0; index < kept.length; index += 1) {
            const record = await buildPhotoRecord(kept[index], { folderId });
            if (record) {
                await putPhoto(record);
                added += 1;
                if (!cover) cover = record.id;
                if (mountedRef.current) {
                    setPhotos((current) => [record, ...current]);
                }
            } else {
                skipped += 1;
            }
            if (mountedRef.current) {
                setImportState({ done: index + 1, total: kept.length, folderName });
            }
        }

        /* Le dossier retient sa couverture et sa date de derniere activite. */
        const folder = folders.find((item) => item.id === folderId);
        const base = folder || { id: folderId, name: folderName, createdAt: Date.now(), source: options.source || 'files', coverId: null };
        const next = { ...base, updatedAt: Date.now(), coverId: base.coverId || cover };
        await putFolder(next);
        if (mountedRef.current) {
            setFolders((current) => (
                current.some((item) => item.id === folderId)
                    ? current.map((item) => (item.id === folderId ? next : item))
                    : [next, ...current]
            ));
            setImportState(null);
        }

        return { added, skipped, folderId, message: gate.message, rejected: gate.rejected };
    }, [photos.length, usedBytes, folders, takenNames, createFolder]);

    const removePhoto = useCallback(async (id) => {
        await deletePhoto(id);
        releaseUrls(id);
        setPhotos((current) => current.filter((photo) => photo.id !== id));
    }, []);

    const removeAll = useCallback(async (ids) => {
        for (const id of ids) {
            await deletePhoto(id);
            releaseUrls(id);
        }
        const removed = new Set(ids);
        setPhotos((current) => current.filter((photo) => !removed.has(photo.id)));
    }, []);

    /*
     * Refabrique la vignette d'une photo quand la tuile qui l'affiche demande
     * plus de pixels que ce qui est stocke.
     *
     * A la demande, jamais en masse: une migration au demarrage redecoderait
     * toute la bibliotheque - deux cents JPEG de 8 Mo - pour des tuiles que
     * l'utilisateur ne regardera peut-etre jamais. Ici, seule une tuile
     * reellement affichee et reellement trop grande declenche le travail, et
     * une seule fois: le resultat est ecrit dans IndexedDB.
     */
    const upgrading = useRef(new Set());
    const ensurePreview = useCallback(async (photo, neededSide) => {
        if (!photo || !photo.blob || upgrading.current.has(photo.id)) return;
        const stored = Math.max(photo.thumbWidth || 0, photo.thumbHeight || 0);
        const source = Math.max(photo.width || 0, photo.height || 0);
        /* Rien a gagner: soit la vignette est deja assez grande, soit la photo
           d'origine n'a pas plus de pixels a donner, soit on est au plafond. */
        if (stored && stored >= neededSide) return;
        if (stored >= Math.min(PREVIEW_MAX, source)) return;
        upgrading.current.add(photo.id);
        const preview = await makePreview(photo.blob, PREVIEW_MAX);
        if (!preview) return;
        const next = { ...photo, ...preview };
        await putPhoto(next);
        releaseThumbUrl(photo.id);
        if (!mountedRef.current) return;
        setPhotos((current) => current.map((item) => (item.id === photo.id ? next : item)));
    }, []);

    /* Mise a jour d'un champ de metadonnee (preset applique, favori, etat de
       sauvegarde). Utilisee aussi par la synchronisation cloud. */
    const patchPhoto = useCallback(async (id, patch) => {
        let next = null;
        setPhotos((current) => current.map((photo) => {
            if (photo.id !== id) return photo;
            next = { ...photo, ...patch };
            return next;
        }));
        if (next) await putPhoto(next);
        return next;
    }, []);

    /* Ecriture directe, pour la synchronisation: une photo venue du compte
       utilisateur doit rejoindre l'etat ET IndexedDB sans repasser par l'import. */
    const upsertPhoto = useCallback(async (photo) => {
        await putPhoto(photo);
        if (!mountedRef.current) return photo;
        setPhotos((current) => (
            current.some((item) => item.id === photo.id)
                ? current.map((item) => (item.id === photo.id ? photo : item))
                : [photo, ...current]
        ));
        return photo;
    }, []);

    const upsertFolder = useCallback(async (folder) => {
        await putFolder(folder);
        if (!mountedRef.current) return folder;
        setFolders((current) => (
            current.some((item) => item.id === folder.id)
                ? current.map((item) => (item.id === folder.id ? folder : item))
                : [folder, ...current]
        ));
        return folder;
    }, []);

    /* ---------- Vues ---------- */

    const photosByFolder = useMemo(() => {
        const map = new Map();
        photos.forEach((photo) => {
            const key = photo.folderId || 'sans-dossier';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(photo);
        });
        return map;
    }, [photos]);

    /*
     * Cartes de dossiers. Chaque carte porte ce qu'on lit dessus: le nombre de
     * photos, le poids, la date, et les vignettes de couverture - celle choisie
     * a l'import d'abord, les plus recentes ensuite.
     */
    const folderCards = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return folders
            .map((folder) => {
                const inside = photosByFolder.get(folder.id) || [];
                const sorted = [...inside].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
                const cover = folder.coverId ? inside.find((photo) => photo.id === folder.coverId) : null;
                const covers = [cover, ...sorted.filter((photo) => photo.id !== cover?.id)]
                    .filter(Boolean)
                    .slice(0, COVER_COUNT);
                const pending = inside.filter((photo) => photo.cloud?.state === 'error').length;
                const synced = inside.filter((photo) => photo.cloud?.state === 'synced').length;
                return {
                    ...folder,
                    count: inside.length,
                    bytes: inside.reduce((sum, photo) => sum + (photo.bytes || 0), 0),
                    covers,
                    syncedCount: synced,
                    errorCount: pending,
                };
            })
            .filter((folder) => (needle ? folder.name.toLowerCase().includes(needle) : true))
            .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    }, [folders, photosByFolder, search]);

    const activeFolder = useMemo(
        () => folders.find((folder) => folder.id === activeFolderId) || null,
        [folders, activeFolderId],
    );

    const folderPhotos = useMemo(
        () => (activeFolderId ? (photosByFolder.get(activeFolderId) || []) : photos),
        [activeFolderId, photosByFolder, photos],
    );

    const devices = useMemo(() => {
        const counts = new Map();
        folderPhotos.forEach((photo) => {
            const label = deviceLabel(photo);
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return [...counts.entries()]
            .map(([label, count]) => ({ id: label, label, count }))
            .sort((a, b) => b.count - a.count);
    }, [folderPhotos]);

    const presets = useMemo(() => {
        const counts = new Map();
        folderPhotos.forEach((photo) => {
            const label = photo.preset?.label;
            if (!label) return;
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return [...counts.entries()]
            .map(([label, count]) => ({ id: label, label, count }))
            .sort((a, b) => b.count - a.count);
    }, [folderPhotos]);

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const filtered = folderPhotos.filter((photo) => {
            if (deviceFilter !== 'all' && deviceLabel(photo) !== deviceFilter) return false;
            if (presetFilter === 'none' && photo.preset) return false;
            if (presetFilter !== 'all' && presetFilter !== 'none'
                && photo.preset?.label !== presetFilter) return false;
            if (!needle) return true;
            return [photo.name, deviceLabel(photo), photo.exif?.lens, photo.preset?.label]
                .filter(Boolean)
                .some((field) => field.toLowerCase().includes(needle));
        });
        const sorted = [...filtered];
        if (sort === 'taken') sorted.sort((a, b) => (b.takenAt || 0) - (a.takenAt || 0));
        else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        else sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        return sorted;
    }, [folderPhotos, search, deviceFilter, presetFilter, sort]);

    return {
        photos, folders, folderCards, folderPhotos, visible, status, importState,
        devices, presets, quota, usedBytes, takenNames,
        activeFolderId, setActiveFolderId, activeFolder,
        search, setSearch,
        deviceFilter, setDeviceFilter,
        presetFilter, setPresetFilter,
        sort, setSort,
        importFiles, createFolder, renameFolder, removeFolder,
        removePhoto, removeAll, patchPhoto, upsertPhoto, upsertFolder, ensurePreview,
    };
}
