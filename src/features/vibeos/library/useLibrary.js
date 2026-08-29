"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deletePhoto, listPhotos, putPhoto } from './libraryDb';
import { buildPhotoRecord, deviceLabel, makePreview, PREVIEW_MAX } from './photoImport';

/*
 * Etat de la bibliotheque: liste, import, filtres, tri.
 *
 * Les URLs d'objet sont mises en cache par identifiant de photo. Sans ce cache,
 * chaque rendu de la grille recreerait une URL par vignette et le navigateur
 * garderait chaque Blob en memoire jusqu'a la fermeture de l'onglet.
 */

const thumbUrls = new Map();
const fullUrls = new Map();

export function thumbUrl(photo) {
    if (!photo) return null;
    if (!thumbUrls.has(photo.id)) {
        thumbUrls.set(photo.id, URL.createObjectURL(photo.thumbBlob || photo.blob));
    }
    return thumbUrls.get(photo.id);
}

export function fullUrl(photo) {
    if (!photo) return null;
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

export default function useLibrary() {
    const [photos, setPhotos] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | ready
    const [importState, setImportState] = useState(null); // { done, total }
    const [search, setSearch] = useState('');
    const [deviceFilter, setDeviceFilter] = useState('all');
    const [presetFilter, setPresetFilter] = useState('all');
    const [sort, setSort] = useState('added');
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        (async () => {
            const stored = await listPhotos();
            if (!mountedRef.current) return;
            setPhotos(stored);
            setStatus('ready');
        })();
        return () => {
            mountedRef.current = false;
        };
    }, []);

    /*
     * Import sequentiel et non bloquant: une photo decodee, stockee, affichee,
     * puis la suivante. Tout decoder en parallele fige l'onglet des qu'on depose
     * une dizaine de JPEG de 8 Mo.
     */
    const importFiles = useCallback(async (fileList) => {
        const files = Array.from(fileList || []).filter((file) => (
            file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)
        ));
        if (!files.length) return { added: 0, skipped: 0 };

        setImportState({ done: 0, total: files.length });
        let added = 0;
        let skipped = 0;

        for (let index = 0; index < files.length; index += 1) {
            const record = await buildPhotoRecord(files[index]);
            if (record) {
                await putPhoto(record);
                added += 1;
                if (mountedRef.current) {
                    setPhotos((current) => [record, ...current]);
                }
            } else {
                skipped += 1;
            }
            if (mountedRef.current) {
                setImportState({ done: index + 1, total: files.length });
            }
        }

        if (mountedRef.current) setImportState(null);
        return { added, skipped };
    }, []);

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
        if (!photo || upgrading.current.has(photo.id)) return;
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

    /* Mise a jour d'un champ de metadonnee (preset applique, favori). */
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

    const devices = useMemo(() => {
        const counts = new Map();
        photos.forEach((photo) => {
            const label = deviceLabel(photo);
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return [...counts.entries()]
            .map(([label, count]) => ({ id: label, label, count }))
            .sort((a, b) => b.count - a.count);
    }, [photos]);

    const presets = useMemo(() => {
        const counts = new Map();
        photos.forEach((photo) => {
            const label = photo.preset?.label;
            if (!label) return;
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return [...counts.entries()]
            .map(([label, count]) => ({ id: label, label, count }))
            .sort((a, b) => b.count - a.count);
    }, [photos]);

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const filtered = photos.filter((photo) => {
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
    }, [photos, search, deviceFilter, presetFilter, sort]);

    return {
        photos, visible, status, importState,
        devices, presets,
        search, setSearch,
        deviceFilter, setDeviceFilter,
        presetFilter, setPresetFilter,
        sort, setSort,
        importFiles, removePhoto, removeAll, patchPhoto, ensurePreview,
    };
}
