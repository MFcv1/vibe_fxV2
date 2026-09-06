"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
    cloudReady, cloudUid, deleteFolderRemote, deletePhotoRemote, fetchBlob,
    pushFolder, pushPhoto, subscribeLibrary,
} from './libraryCloud';
import { makePreview } from './photoImport';

/*
 * Sauvegarde automatique de la bibliotheque dans le compte utilisateur.
 *
 * Trois principes tenus ici:
 *
 * 1. LE LOCAL FAIT AUTORITE POUR L'AFFICHAGE. La bibliotheque marche sans
 *    compte et sans reseau; ce hook ne fait qu'ajouter une copie distante. Rien
 *    dans l'ecran n'attend une reponse du serveur.
 * 2. UN ENVOI A LA FOIS. Deux cents photos envoyees en parallele saturent le
 *    lien montant et font ramer l'import lui-meme, qui est justement en train
 *    de decoder des images. La file avance photo par photo.
 * 3. ON N'ECRIT PAS EN BOUCLE. L'ecoute Firestore renvoie ce qu'on vient
 *    d'ecrire; on ne touche donc l'etat local que si la fiche distante apporte
 *    vraiment quelque chose de nouveau.
 */

/* Trois echecs d'affilee: on arrete. Continuer, c'est empiler des requetes qui
   echouent - et si c'est un probleme de droits, elles echoueront toutes. */
const MAX_FAILURES = 3;

/*
 * Combien de temps une photo supprimee reste « interdite de retour ».
 *
 * Supprimer efface la fiche locale ET la fiche distante, mais deux choses
 * peuvent la ressusciter dans la seconde qui suit: un envoi deja en vol qui se
 * termine et reecrit la fiche, et l'ecoute Firestore qui recoit un instantane
 * pris avant la suppression. C'est ce qui faisait revenir les doublons au
 * rechargement de la page. Une minute couvre tres largement les deux.
 */
const TOMBSTONE_MS = 60000;

function remoteToLocal(remote) {
    return {
        id: remote.id,
        folderId: remote.folderId || null,
        name: remote.name || 'photo',
        blob: null,
        thumbBlob: null,
        bytes: remote.bytes || 0,
        type: remote.type || '',
        width: remote.width || 0,
        height: remote.height || 0,
        ratio: remote.ratio || 1,
        thumbWidth: remote.thumbWidth || 0,
        thumbHeight: remote.thumbHeight || 0,
        addedAt: remote.addedAt || Date.now(),
        takenAt: remote.takenAt || null,
        exif: remote.exif || null,
        preset: remote.preset || null,
        favorite: Boolean(remote.favorite),
        fromRoomId: remote.fromRoomId || null,
        previewUrl: remote.previewUrl || null,
        originalUrl: remote.originalUrl || null,
        /* Pas de fichier local: la photo vit dans le compte, on la rapatrie a
           l'ouverture ou a la retouche (voir `hydrate`). */
        remote: true,
        cloud: {
            state: 'synced',
            previewPath: remote.previewPath || null,
            originalPath: remote.originalPath || null,
            originalSkipped: Boolean(remote.originalSkipped),
            syncedAt: remote.updatedAt || Date.now(),
        },
    };
}

export default function useLibrarySync(library) {
    const { user } = useAuth();
    const {
        photos, folders, status, upsertPhoto, upsertFolder, patchPhoto,
    } = library;

    const [failures, setFailures] = useState(0);
    /* id -> instant de suppression. Voir `TOMBSTONE_MS`. */
    const tombstonesRef = useRef(new Map());
    const [lastError, setLastError] = useState('');
    const runningRef = useRef(false);
    const photosRef = useRef(photos);
    const foldersRef = useRef(folders);

    /*
     * Une photo qu'on vient de supprimer ne doit ni remonter, ni redescendre.
     *
     * Declaree ICI, avant tout ce qui la lit: la file d'envoi l'appelle pendant
     * le rendu, et une declaration plus bas faisait planter l'ecran entier
     * (`enterre is not defined`).
     */
    const enterre = useCallback((id) => {
        const at = tombstonesRef.current.get(id);
        if (!at) return false;
        if (Date.now() - at < TOMBSTONE_MS) return true;
        tombstonesRef.current.delete(id);
        return false;
    }, []);

    useEffect(() => { photosRef.current = photos; }, [photos]);
    useEffect(() => { foldersRef.current = folders; }, [folders]);

    const uid = cloudUid(user);
    const enabled = Boolean(uid) && cloudReady();

    /* ---------- Descente: ce que le compte contient deja ---------- */

    useEffect(() => {
        if (!enabled || status !== 'ready') return undefined;
        return subscribeLibrary(uid, {
            onFolders: (remoteFolders) => {
                remoteFolders.forEach((remote) => {
                    const local = foldersRef.current.find((folder) => folder.id === remote.id);
                    if (local) return;
                    upsertFolder({
                        id: remote.id,
                        name: remote.name || 'Dossier',
                        createdAt: remote.createdAt || Date.now(),
                        updatedAt: remote.updatedAt || Date.now(),
                        source: remote.source || 'files',
                        coverId: remote.coverId || null,
                        cloud: { syncedAt: remote.updatedAt || Date.now() },
                    });
                });
            },
            onPhotos: (remotePhotos) => {
                remotePhotos.forEach((remote) => {
                    /* Supprimee a l'instant: l'instantane peut avoir ete pris
                       avant, on ne la fait pas revenir. */
                    if (enterre(remote.id)) return;
                    const local = photosRef.current.find((photo) => photo.id === remote.id);
                    if (!local) {
                        upsertPhoto(remoteToLocal(remote));
                        return;
                    }
                    /* Deja ici: on ne recopie rien, on note juste que la copie
                       distante existe si le local l'ignorait. */
                    if (local.cloud?.state !== 'synced') {
                        patchPhoto(local.id, {
                            previewUrl: remote.previewUrl || local.previewUrl || null,
                            originalUrl: remote.originalUrl || local.originalUrl || null,
                            cloud: {
                                state: 'synced',
                                previewPath: remote.previewPath || null,
                                originalPath: remote.originalPath || null,
                                originalSkipped: Boolean(remote.originalSkipped),
                                syncedAt: remote.updatedAt || Date.now(),
                            },
                        });
                    }
                });
            },
            onError: (error) => {
                setLastError(error?.message || 'Lecture du compte impossible.');
                setFailures((current) => current + 1);
            },
        });
    }, [enabled, uid, status, upsertFolder, upsertPhoto, patchPhoto, enterre]);

    /* ---------- Montee: ce qui n'est pas encore parti ---------- */

    const pending = useMemo(
        () => photos.filter((photo) => photo.blob && !photo.scout && photo.cloud?.state !== 'synced'),
        [photos],
    );

    useEffect(() => {
        if (!enabled || runningRef.current) return;
        if (failures >= MAX_FAILURES) return;
        /* Le registre des suppressions se lit ICI, dans un effet, et pas dans le
           calcul de `pending`: une reference ne se lit pas pendant le rendu. */
        const next = pending.find((photo) => !enterre(photo.id));
        /* Un dossier de tri reste sur l'appareil: rien de ce qu'il contient
           n'a d'original a envoyer, et l'utilisateur n'a pas encore dit qu'il
           voulait garder ces photos. Voir `libraryScout.js`. */
        const staleFolder = folders.find((folder) => (
            !folder.localOnly
            && (folder.cloud?.syncedAt || 0) < (folder.updatedAt || folder.createdAt || 0)
        ));
        if (!next && !staleFolder) return;

        runningRef.current = true;
        (async () => {
            try {
                if (staleFolder) {
                    await pushFolder(uid, staleFolder);
                    await upsertFolder({ ...staleFolder, cloud: { syncedAt: Date.now() } });
                }
                if (next) {
                    const result = await pushPhoto(uid, next);
                    await patchPhoto(next.id, {
                        previewUrl: result.previewUrl,
                        originalUrl: result.originalUrl,
                        cloud: { state: 'synced', ...result, syncedAt: Date.now() },
                    });
                }
                setFailures(0);
                setLastError('');
            } catch (error) {
                setFailures((current) => current + 1);
                setLastError(error?.message || 'Sauvegarde impossible.');
                if (next) {
                    await patchPhoto(next.id, {
                        cloud: { ...(next.cloud || {}), state: 'error', error: error?.message || 'échec' },
                    });
                }
            } finally {
                runningRef.current = false;
            }
        })();
    }, [enabled, uid, pending, folders, failures, patchPhoto, upsertFolder, enterre]);

    /* ---------- Suppressions ---------- */

    const forgetPhotos = useCallback(async (ids) => {
        /* La pierre tombale se pose MEME sans compte: elle protege aussi de
           l'envoi en vol, qui n'a pas encore fini d'ecrire. */
        const now = Date.now();
        (ids || []).forEach((id) => tombstonesRef.current.set(id, now));
        if (!enabled) return;
        for (const id of ids) {
            const photo = photosRef.current.find((item) => item.id === id) || { id };
            await deletePhotoRemote(uid, photo);
        }
    }, [enabled, uid]);

    const forgetFolder = useCallback(async (folderId, photoIds = []) => {
        if (!enabled) return;
        await forgetPhotos(photoIds);
        await deleteFolderRemote(uid, folderId);
    }, [enabled, uid, forgetPhotos]);

    /* ---------- Rapatriement ---------- */

    /*
     * Redescend le fichier d'origine d'une photo qui n'existe que dans le
     * compte, et le range dans IndexedDB: la fois suivante, elle s'ouvre sans
     * reseau. Renvoie la photo telle qu'elle est apres coup, jamais `null` sans
     * raison - l'appelant doit pouvoir dire honnetement "indisponible".
     */
    const hydrate = useCallback(async (photo) => {
        if (!photo) return null;
        if (photo.blob) return photo;

        /* L'URL de l'original peut avoir expire alors que l'apercu reste
           disponible. On tente les deux, dans cet ordre, afin que Retoucher ne
           reste jamais bloque sur une seule URL distante devenue invalide. */
        const sources = [
            { url: photo.originalUrl, path: photo.cloud?.originalPath },
            { url: photo.previewUrl, path: photo.cloud?.previewPath },
        ].filter((source, index, list) => (
            (source.url || source.path)
            && list.findIndex((item) => item.url === source.url && item.path === source.path) === index
        ));
        let blob = null;
        for (const source of sources) {
            blob = await fetchBlob(source.url, source.path).catch(() => null);
            if (blob) break;
        }
        if (!blob) return photo;

        const next = {
            ...photo,
            blob,
            remote: false,
        };

        /* Vision peut ouvrir le Blob des maintenant. La regeneration de la
           vignette et la copie IndexedDB continuent en arriere-plan: sur
           Safari, decoder puis reecrire un JPEG plein format avant le
           changement de page pouvait prendre plusieurs secondes et donnait
           l'impression que le bouton Retoucher ne fonctionnait pas. */
        void (async () => {
            const preview = photo.thumbBlob ? null : await makePreview(blob);
            await upsertPhoto({
                ...next,
                thumbBlob: preview?.thumbBlob || photo.thumbBlob || blob,
                thumbWidth: preview?.thumbWidth || photo.thumbWidth || 0,
                thumbHeight: preview?.thumbHeight || photo.thumbHeight || 0,
            });
        })().catch(() => {});
        return next;
    }, [upsertPhoto]);

    /* ---------- Ce qu'on en montre ---------- */

    const banner = useMemo(() => {
        if (!enabled) return null;
        if (failures >= MAX_FAILURES) {
            return {
                tone: 'danger',
                label: `Sauvegarde en pause : ${lastError}`,
                icon: <CloudOff size={13} />,
            };
        }
        if (pending.length) {
            return {
                tone: 'busy',
                label: `Sauvegarde dans ton compte · ${pending.length} photo${pending.length > 1 ? 's' : ''} en attente`,
                icon: <RefreshCw size={13} className="vo-spin" />,
            };
        }
        return null;
    }, [enabled, failures, lastError, pending.length]);

    /* Chiffre affichable ailleurs: combien de photos sont a l'abri. */
    const syncedCount = useMemo(
        () => photos.filter((photo) => photo.cloud?.state === 'synced').length,
        [photos],
    );

    return {
        enabled, banner, pending: pending.length, syncedCount,
        forgetPhotos, forgetFolder, hydrate,
    };
}
