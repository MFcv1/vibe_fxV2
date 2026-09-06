"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    createFolderId, deleteFolderDeep, deletePhoto, listFolders, listPhotos, putFolder, putPhoto,
} from './libraryDb';
import {
    buildPhotoRecord, buildScoutRecord, deviceLabel, makePreview, PREVIEW_MAX,
} from './photoImport';
import { isHeicFile } from './heicImport';
import {
    directoryNameOf, sanitizeFolderName, suggestFolderName, uniqueFolderName,
} from './folderNaming';
import { checkImport, quotaState } from './libraryQuota';
import {
    countAttached, forgetFile, isScoutFolder, isScoutPhoto, reattachFiles, rememberFile,
    SCOUT_FOLDER_KIND, SCOUT_QUOTA, sourceFileOf,
} from './libraryScout';

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

/*
 * Cache d'adresses d'affichage.
 *
 * Il etait indexe sur le SEUL identifiant de photo, et c'est ce qui produisait
 * les vignettes en point d'interrogation :
 *
 * 1. il est MODULE, donc partage par la grille, le carrousel et le panneau
 *    « Ajouter une photo ». Quand un ecran revoquait l'adresse d'une photo,
 *    l'autre continuait d'afficher une adresse morte, et rien ne le faisait se
 *    redessiner ;
 * 2. il n'etait jamais invalide quand l'image changeait. Une photo rapatriee du
 *    compte ou dont la vignette venait d'etre refaite gardait l'adresse de
 *    l'ANCIEN fichier.
 *
 * On garde donc le cache - sans lui, chaque rendu de la grille recreerait une
 * URL par vignette - mais l'entree porte desormais le fichier qui l'a produite.
 * Si le fichier change, l'adresse change; s'il ne change pas, l'adresse est
 * stable. Et on ne revoque plus une adresse tant qu'un autre ecran peut encore
 * l'afficher : la revocation n'a lieu qu'a la suppression de la photo.
 */
const thumbUrls = new Map(); // id -> { blob, url }
const fullUrls = new Map();

function urlFromCache(cache, id, blob) {
    const known = cache.get(id);
    if (known && known.blob === blob) return known.url;
    /* Le fichier a change: l'ancienne adresse ne designe plus cette photo. On
       la revoque, mais seulement parce qu'on en pose une nouvelle dans la
       foulee - jamais pour laisser un trou. */
    if (known) URL.revokeObjectURL(known.url);
    const url = URL.createObjectURL(blob);
    cache.set(id, { blob, url });
    return url;
}

export function thumbUrl(photo) {
    if (!photo) return null;
    /* Photo encore dans le nuage: on affiche l'apercu distant tel quel, il n'y a
       pas de Blob local a transformer en URL. */
    const blob = photo.thumbBlob || photo.blob;
    if (!blob) return photo.previewUrl || null;
    return urlFromCache(thumbUrls, photo.id, blob);
}

export function fullUrl(photo) {
    if (!photo) return null;
    /* Une photo en cours de tri n'a pas d'original en base - c'est justement ce
       qui la rend legere. Le carrousel affiche donc son apercu 1600 px, qui est
       fait pour ca. Sans ce recours, l'ecran plein serait vide. */
    if (!photo.blob && photo.scout) return thumbUrl(photo);
    if (!photo.blob) return photo.originalUrl || photo.previewUrl || null;
    return urlFromCache(fullUrls, photo.id, photo.blob);
}

/*
 * L'adresse de secours d'une photo: sa copie dans le compte.
 *
 * Une adresse d'objet peut mourir pour des raisons qui ne sont pas des bugs -
 * le fichier d'origine deplace sur le disque, un onglet qui a repris la main
 * apres une mise en veille. L'ecran s'en sert quand une vignette refuse de se
 * charger, plutot que d'afficher un point d'interrogation.
 */
export function fallbackUrl(photo) {
    if (!photo) return null;
    return photo.previewUrl || photo.originalUrl || null;
}

function releaseUrls(id) {
    [thumbUrls, fullUrls].forEach((cache) => {
        const entry = cache.get(id);
        if (entry) URL.revokeObjectURL(entry.url);
        cache.delete(id);
    });
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
    /*
     * Miroir de `photos` lisible hors rendu.
     *
     * Il existe pour une raison precise: React peut REJOUER un reducteur d'etat
     * (StrictMode, rendu concurrent). Calculer dans le reducteur une valeur
     * RELATIVE - "l'inverse du favori actuel" - puis l'ecrire dans IndexedDB
     * donne alors deux resultats differents a l'ecran et en base, et c'est
     * l'ecran qui a raison. Toute bascule lit donc l'etat ici, calcule une
     * valeur ABSOLUE, et pousse la meme aux deux endroits.
     */
    const photosRef = useRef([]);

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

    useEffect(() => { photosRef.current = photos; }, [photos]);

    /* ---------- Quota ---------- */

    /*
     * Le quota ne compte QUE la vraie bibliotheque.
     *
     * Une photo en cours de tri n'a pas d'original stocke et ne part pas dans
     * le compte: la faire peser sur le plafond bloquerait l'utilisateur des le
     * premier gros dossier, pour un espace qu'il n'occupe pas. Le tri a son
     * propre plafond, qui protege l'onglet et pas la facture (`SCOUT_QUOTA`).
     */
    const kept = useMemo(() => photos.filter((photo) => !isScoutPhoto(photo)), [photos]);
    const scoutPhotos = useMemo(() => photos.filter(isScoutPhoto), [photos]);
    const usedBytes = useMemo(
        () => kept.reduce((sum, photo) => sum + (photo.bytes || 0), 0),
        [kept],
    );
    const scoutBytes = useMemo(
        () => scoutPhotos.reduce((sum, photo) => sum + (photo.bytes || 0), 0),
        [scoutPhotos],
    );
    const quota = useMemo(
        () => quotaState({ photoCount: kept.length, bytes: usedBytes }),
        [kept.length, usedBytes],
    );

    /* ---------- Dossiers ---------- */

    const takenNames = useMemo(() => folders.map((folder) => folder.name), [folders]);

    const createFolder = useCallback(async ({
        name, source = 'manual', kind = 'library', sourceDir = null,
    } = {}) => {
        const finalName = uniqueFolderName(sanitizeFolderName(name) || suggestFolderName({ taken: takenNames }), takenNames);
        const folder = {
            id: createFolderId(),
            name: finalName,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source,
            kind,
            /* Un dossier de tri ne monte jamais dans le compte: la
               synchronisation le saute sur ce seul drapeau. */
            localOnly: kind === SCOUT_FOLDER_KIND,
            /* Le nom du dossier du disque d'ou viennent les fichiers. Il ne
               sert qu'a une chose, mais elle compte: apres un rechargement, on
               peut DIRE quel dossier redonner, au lieu de laisser l'utilisateur
               chercher dans son Finder. */
            sourceDir: sourceDir || null,
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
        removedIds.forEach(forgetFile);
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
            file.type.startsWith('image/') || isHeicFile(file)
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
        let skippedHeic = 0;
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
                if (isHeicFile(kept[index])) skippedHeic += 1;
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

        return {
            added, skipped, skippedHeic, folderId, message: gate.message, rejected: gate.rejected,
        };
    }, [photos.length, usedBytes, folders, takenNames, createFolder]);

    /* ---------- Tri ---------- */

    /*
     * Le tri avance par paquets a l'ecran.
     *
     * L'import normal pousse chaque photo dans l'etat des qu'elle est prete:
     * c'est juste, on veut voir le dossier se remplir. Mais a sept cents
     * photos, sept cents rendus d'une grille en maconnerie qui grossit a chaque
     * fois font ramer l'onglet - au moment precis ou il decode des images. On
     * ecrit donc chaque fiche dans IndexedDB tout de suite (rien n'est perdu si
     * on ferme), et on ne previent l'ecran que par paquets.
     */
    const SCOUT_FLUSH = 12;
    const scoutCancel = useRef(false);
    /*
     * Les poignees de fichiers vivent hors de React (voir `libraryScout.js`):
     * les rattacher ne declenche donc aucun rendu. Ce compteur est le signal
     * explicite qui dit a l'ecran de recompter ce qui est pret a importer.
     */
    const [scoutTick, setScoutTick] = useState(0);

    const cancelScout = useCallback(() => { scoutCancel.current = true; }, []);

    const scoutFiles = useCallback(async (fileList, options = {}) => {
        const files = Array.from(fileList || []).filter((file) => (
            file.type.startsWith('image/') || isHeicFile(file)
        ));
        if (!files.length) return { added: 0, skipped: 0, folderId: null, message: '' };

        const gate = checkImport({
            photoCount: scoutPhotos.length,
            bytes: scoutBytes,
            files,
            quota: SCOUT_QUOTA,
            scope: 'scout',
        });
        if (!gate.ok) {
            return { added: 0, skipped: 0, folderId: null, blocked: true, message: gate.message };
        }
        const accepted = files.slice(0, gate.accepted);

        /* Un depot dans un tri deja ouvert le complete; sinon on en ouvre un. */
        const existing = options.folderId
            ? folders.find((item) => item.id === options.folderId && isScoutFolder(item))
            : null;
        const folder = existing || await createFolder({
            name: options.folderName || suggestFolderName({ files, taken: takenNames }),
            source: options.source || 'files',
            kind: SCOUT_FOLDER_KIND,
            sourceDir: directoryNameOf(accepted),
        });

        scoutCancel.current = false;
        setImportState({ done: 0, total: accepted.length, folderName: folder.name, mode: 'scout' });

        let added = 0;
        let skipped = 0;
        let cover = null;
        let pending = [];

        /*
         * Horodatage decroissant, un cran par fichier.
         *
         * Sans lui, chaque fiche prend l'heure de la fin de son decodage, et la
         * grille - triee du plus recent au plus ancien - presente le dossier a
         * l'ENVERS: on commence son tri par la derniere photo. Un cran par
         * fichier fait tenir l'ordre du dossier choisi, qui est celui que
         * l'utilisateur a sous les yeux dans le Finder.
         */
        const stamp = Date.now();

        const flush = () => {
            if (!pending.length || !mountedRef.current) return;
            const batch = pending;
            pending = [];
            setPhotos((current) => [...batch.reverse(), ...current]);
        };

        for (let index = 0; index < accepted.length; index += 1) {
            if (scoutCancel.current) break;
            const file = accepted[index];
            const record = await buildScoutRecord(file, { folderId: folder.id, addedAt: stamp - index });
            if (record) {
                await putPhoto(record);
                /* La poignee vers le fichier reste en memoire: c'est elle qui
                   permettra de lire l'original si la photo est gardee. */
                rememberFile(record.id, file);
                added += 1;
                if (!cover) cover = record.id;
                pending.push(record);
                if (pending.length >= SCOUT_FLUSH) flush();
            } else {
                skipped += 1;
            }
            if (mountedRef.current) {
                setImportState({
                    done: index + 1, total: accepted.length, folderName: folder.name, mode: 'scout',
                });
            }
        }
        flush();
        setScoutTick((current) => current + 1);

        const next = { ...folder, updatedAt: Date.now(), coverId: folder.coverId || cover };
        await putFolder(next);
        if (mountedRef.current) {
            setFolders((current) => current.map((item) => (item.id === folder.id ? next : item)));
            setImportState(null);
        }
        return {
            added,
            skipped,
            folderId: folder.id,
            folderName: folder.name,
            stopped: scoutCancel.current,
            message: gate.message,
        };
    }, [scoutPhotos.length, scoutBytes, takenNames, folders, createFolder]);

    /*
     * Fin du tri: les favorites entrent pour de vrai.
     *
     * C'est ici, et seulement ici, que le fichier d'origine est relu sur le
     * disque, converti si besoin et stocke - donc envoye dans le compte par la
     * synchronisation. Le dossier de tri n'est pas touche: on peut refaire une
     * passe, ou le supprimer quand on est sur de soi.
     *
     * Les photos dont la poignee a ete perdue (onglet recharge) sont comptees a
     * part plutot qu'ignorees: l'ecran doit pouvoir dire combien il en manque et
     * demander le dossier source, pas importer un lot silencieusement incomplet.
     */
    const promoteFavorites = useCallback(async (folderId, options = {}) => {
        /*
         * Une photo deja importee ne repart pas.
         *
         * Sans cette marque, rouvrir un tri et reappuyer sur "Importer" - le
         * geste le plus naturel du monde quand on hesite - creerait un second
         * exemplaire de chaque photo, dans un second dossier. La marque est
         * portee par la photo de tri, donc elle survit a la fermeture de
         * l'onglet, comme le favori lui-meme.
         */
        const source = photos.filter((photo) => (
            photo.folderId === folderId && isScoutPhoto(photo)
            && photo.favorite && !photo.promotedTo
        ));
        if (!source.length) return { added: 0, missing: 0, folderId: null };

        const ready = source.filter((photo) => sourceFileOf(photo));
        const missing = source.length - ready.length;
        if (!ready.length) return { added: 0, missing, folderId: null };

        const gate = checkImport({
            photoCount: kept.length,
            bytes: usedBytes,
            files: ready.map((photo) => ({ size: photo.source?.size || 0 })),
        });
        if (!gate.ok) return { added: 0, missing, folderId: null, blocked: true, message: gate.message };
        const batch = ready.slice(0, gate.accepted);

        /*
         * Une deuxieme fournee rejoint la premiere.
         *
         * Un tri interrompu puis repris - parce que les poignees de fichiers
         * ont ete perdues au rechargement, ce qui est le cas normal - c'est UN
         * lot pour l'utilisateur. En creant un dossier a chaque appel, on lui
         * en fabriquait deux (« ... gardees » et « ... gardees 2 ») qu'il ne
         * pouvait plus reunir. La destination est deja connue: les photos deja
         * parties portent son identifiant.
         */
        const comptes = new Map();
        photos.forEach((photo) => {
            if (photo.folderId !== folderId || !isScoutPhoto(photo) || !photo.promotedTo) return;
            comptes.set(photo.promotedTo, (comptes.get(photo.promotedTo) || 0) + 1);
        });
        const dejaVu = [...comptes.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => folders.find((item) => item.id === id))
            .find(Boolean);

        const folder = dejaVu || await createFolder({
            name: options.folderName || `${options.baseName || 'Favoris'}`,
            source: 'favorites',
            kind: 'library',
        });

        setImportState({ done: 0, total: batch.length, folderName: folder.name, mode: 'promote' });
        let added = 0;
        let failed = 0;
        let cover = null;

        for (let index = 0; index < batch.length; index += 1) {
            const photo = batch[index];
            const file = sourceFileOf(photo);
            const record = file ? await buildPhotoRecord(file, { folderId: folder.id }) : null;
            if (record) {
                /* La photo entre deja aimee: le tri qu'on vient de faire ne doit
                   pas etre a refaire dans la bibliotheque. */
                const full = { ...record, favorite: true, takenAt: photo.takenAt || record.takenAt };
                await putPhoto(full);
                const marked = { ...photo, promotedTo: folder.id };
                await putPhoto(marked);
                added += 1;
                if (!cover) cover = full.id;
                if (mountedRef.current) {
                    setPhotos((current) => [
                        full,
                        ...current.map((item) => (item.id === photo.id ? marked : item)),
                    ]);
                }
            } else {
                failed += 1;
            }
            if (mountedRef.current) {
                setImportState({
                    done: index + 1, total: batch.length, folderName: folder.name, mode: 'promote',
                });
            }
        }

        /* La couverture d'un dossier deja rempli ne change pas: on complete un
           lot, on ne le rebaptise pas. */
        const next = { ...folder, updatedAt: Date.now(), coverId: folder.coverId || cover };
        await putFolder(next);
        if (mountedRef.current) {
            setFolders((current) => current.map((item) => (item.id === folder.id ? next : item)));
            setImportState(null);
        }
        return {
            added, failed, missing, folderId: folder.id, folderName: folder.name, message: gate.message,
        };
    }, [photos, folders, kept.length, usedBytes, createFolder]);

    /*
     * Deplacer des photos d'un dossier a un autre.
     *
     * Rendu necessaire par le defaut ci-dessus: deux fournees d'un meme tri
     * avaient atterri dans deux dossiers, et il n'existait aucun geste pour les
     * reunir - a part tout resupprimer et tout reimporter. Le fichier ne bouge
     * pas d'un octet, seule l'etiquette de rangement change.
     */
    const movePhotos = useCallback(async (ids, folderId) => {
        const cible = folders.find((item) => item.id === folderId);
        if (!cible || !ids?.length) return { moved: 0, folderName: '' };
        const aDeplacer = new Set(ids);
        const suivantes = [];
        for (const photo of photosRef.current) {
            if (!aDeplacer.has(photo.id) || photo.folderId === folderId) continue;
            const next = { ...photo, folderId };
            await putPhoto(next);
            suivantes.push(next);
        }
        if (!suivantes.length) return { moved: 0, folderName: cible.name };
        const parId = new Map(suivantes.map((photo) => [photo.id, photo]));
        if (mountedRef.current) {
            setPhotos((current) => current.map((photo) => parId.get(photo.id) || photo));
        }
        photosRef.current = photosRef.current.map((photo) => parId.get(photo.id) || photo);
        const next = { ...cible, updatedAt: Date.now() };
        await putFolder(next);
        if (mountedRef.current) {
            setFolders((current) => current.map((item) => (item.id === folderId ? next : item)));
        }
        return { moved: suivantes.length, folderName: cible.name, photos: suivantes };
    }, [folders]);

    /* Aimer / ne plus aimer. Ecrit dans IndexedDB, donc le tri survit a la
       fermeture de l'onglet - c'est toute la promesse du mode. */
    /* Re-relie un tri a ses fichiers apres un rechargement d'onglet. */
    const reattachScout = useCallback((folderId, fileList) => {
        const files = Array.from(fileList || []);
        const target = photos.filter((photo) => photo.folderId === folderId && isScoutPhoto(photo));
        const result = reattachFiles(target, files);
        /* Le dossier qui a marche est retenu: la prochaine fois, l'ecran peut le
           NOMMER au lieu de dire « redonne-moi le dossier source ». C'est la
           difference entre une consigne et une devinette. */
        const dir = result.matched ? directoryNameOf(files) : '';
        const folder = dir ? folders.find((item) => item.id === folderId) : null;
        if (folder && folder.sourceDir !== dir) {
            /* Ecriture directe plutot que par `upsertFolder`: celui-ci est
               declare plus bas dans ce hook, et le citer dans le tableau de
               dependances le lirait AVANT son initialisation - la faute qui a
               deja fait planter cet ecran une fois. */
            const next = { ...folder, sourceDir: dir };
            void putFolder(next);
            setFolders((current) => current.map((item) => (item.id === folderId ? next : item)));
        }
        setScoutTick((current) => current + 1);
        return result;
    }, [photos, folders]);

    const toggleFavorite = useCallback(async (id) => {
        const current = photosRef.current.find((photo) => photo.id === id);
        if (!current) return null;
        /* Valeur absolue, decidee UNE fois: voir `photosRef`. */
        const next = { ...current, favorite: !current.favorite };
        setPhotos((list) => list.map((photo) => (photo.id === id ? next : photo)));
        photosRef.current = photosRef.current.map((photo) => (photo.id === id ? next : photo));
        await putPhoto(next);
        return next;
    }, []);

    const removePhoto = useCallback(async (id) => {
        await deletePhoto(id);
        releaseUrls(id);
        forgetFile(id);
        setPhotos((current) => current.filter((photo) => photo.id !== id));
    }, []);

    const removeAll = useCallback(async (ids) => {
        for (const id of ids) {
            await deletePhoto(id);
            releaseUrls(id);
            forgetFile(id);
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
        /* Plus de revocation manuelle ici: elle laissait un trou entre le
           moment ou l'adresse mourait et celui ou l'ecran se redessinait - et
           les autres ecrans, eux, ne se redessinaient jamais. Le cache change
           d'adresse tout seul parce que la vignette a change de fichier. */
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
                const scout = isScoutFolder(folder);
                return {
                    ...folder,
                    count: inside.length,
                    bytes: inside.reduce((sum, photo) => sum + (photo.bytes || 0), 0),
                    covers,
                    syncedCount: synced,
                    errorCount: pending,
                    scout,
                    favoriteCount: inside.reduce((total, photo) => total + (photo.favorite ? 1 : 0), 0),
                    /* Combien de photos peuvent encore etre importees pour de
                       vrai. Calcule seulement pour un tri: ailleurs, l'original
                       est deja en base et la question ne se pose pas. */
                    attachedCount: scout ? countAttached(inside) : inside.length,
                };
            })
            .filter((folder) => (needle ? folder.name.toLowerCase().includes(needle) : true))
            .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        /* `scoutTick` est volontaire: `countAttached` lit des poignees de
           fichiers qui vivent hors de React, donc rien d'autre ne peut
           signaler que ce compte a change. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folders, photosByFolder, search, scoutTick]);

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

    const activeScout = isScoutFolder(activeFolder);

    /*
     * Les doublons du dossier ouvert.
     *
     * Deux photos issues du MEME rendu ont exactement les memes dimensions et
     * le meme poids a l'octet pres. Deux photos differentes qui tomberaient sur
     * ces trois valeurs, ca n'arrive pas avec des JPEG: un pixel de difference
     * change le poids compresse. C'est donc une identite fiable, et elle marche
     * meme sur les photos rangees avant que `fromRoomId` existe.
     *
     * On garde UN exemplaire par groupe, et le meilleur: celui qui est deja
     * sauvegarde dans le compte d'abord, celui qui a son fichier d'origine
     * ensuite, le plus ancien enfin. On ne supprime jamais une photo unique.
     */
    const duplicates = useMemo(() => {
        if (!activeFolderId || activeScout) return { ids: [], groupes: 0 };
        const groupes = new Map();
        folderPhotos.forEach((photo) => {
            const cle = `${photo.width || 0}x${photo.height || 0}:${photo.bytes || 0}`;
            if (!cle.endsWith(':0')) {
                if (!groupes.has(cle)) groupes.set(cle, []);
                groupes.get(cle).push(photo);
            }
        });
        const score = (photo) => (
            (photo.cloud?.state === 'synced' ? 4 : 0)
            + (photo.blob ? 2 : 0)
            + (photo.fromRoomId ? 1 : 0)
        );
        const ids = [];
        let doubles = 0;
        groupes.forEach((liste) => {
            if (liste.length < 2) return;
            doubles += 1;
            const trie = [...liste].sort((a, b) => (
                score(b) - score(a) || (a.addedAt || 0) - (b.addedAt || 0)
            ));
            trie.slice(1).forEach((photo) => ids.push(photo.id));
        });
        return { ids, groupes: doubles };
    }, [activeFolderId, activeScout, folderPhotos]);

    /*
     * Etat du tri ouvert: combien de favorites, et combien sont encore reliees
     * a leur fichier. C'est ce couple qui pilote le bandeau de fin de tri.
     */
    const scoutState = useMemo(() => {
        if (!activeScout) return null;
        const favorites = folderPhotos.filter((photo) => photo.favorite);
        const waiting = favorites.filter((photo) => !photo.promotedTo);
        return {
            total: folderPhotos.length,
            favorites: favorites.length,
            /* Deja passees dans la bibliotheque: elles ne repartiront pas. */
            done: favorites.length - waiting.length,
            /* Gardees, pas encore importees, et dont le fichier repond. */
            ready: countAttached(waiting),
            /* Gardees, pas encore importees, mais dont le fichier manque. */
            lost: waiting.length - countAttached(waiting),
            attached: countAttached(folderPhotos),
        };
        /* `scoutTick` est volontaire: `countAttached` lit des poignees de
           fichiers qui vivent hors de React, donc rien d'autre ne peut
           signaler que ce compte a change. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeScout, folderPhotos, scoutTick]);

    return {
        photos, folders, folderCards, folderPhotos, visible, status, importState,
        devices, presets, quota, usedBytes, takenNames,
        activeScout, scoutState, duplicates,
        scoutFiles, cancelScout, promoteFavorites, toggleFavorite, reattachScout,
        activeFolderId, setActiveFolderId, activeFolder,
        search, setSearch,
        deviceFilter, setDeviceFilter,
        presetFilter, setPresetFilter,
        sort, setSort,
        importFiles, createFolder, renameFolder, removeFolder,
        removePhoto, removeAll, movePhotos, patchPhoto, upsertPhoto, upsertFolder, ensurePreview,
    };
}
