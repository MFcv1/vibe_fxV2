"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
    cloudReady, cloudUid, deleteFolderRemote, deletePhotoRemote, fetchBlob,
    patchPhotoRemote, pushFolder, pushPhoto, subscribeLibrary,
} from './libraryCloud';
import {
    listTombstones, markTombstoneDone, purgeTombstones, putTombstones,
} from './libraryDb';
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
 * Une photo supprimee ne revient pas. Jamais.
 *
 * Le registre des suppressions n'est plus une minute de memoire vive: il est
 * ECRIT SUR LE DISQUE (magasin `tombstones`, voir `libraryDb.js`). C'est la
 * difference entre « ca tient tant que l'onglet reste ouvert » et « ca tient ».
 *
 * Une suppression, c'est trois gestes: la fiche locale, la fiche du compte, les
 * fichiers de Storage. Les deux derniers passent par le reseau et peuvent ne
 * pas avoir lieu - onglet ferme, connexion coupee, session pas encore
 * identifiee. Avant, l'ecoute du compte reinstallait alors tout ce que
 * l'utilisateur croyait avoir supprime: c'est le « je supprime les doublons, je
 * reviens, tout est revenu ».
 *
 * Maintenant la pierre tombale fait deux choses a la fois: elle INTERDIT le
 * retour des la premiere milliseconde, et elle reste une TACHE A FINIR tant que
 * la suppression distante n'est pas confirmee - cette session ou la suivante.
 */

/* Suppressions distantes menees de front. Quarante-neuf doublons a la file,
   c'est trois requetes chacun: en serie, l'utilisateur attendait une demi-
   minute devant un ecran fige. */
const DELETE_LANES = 4;

/* Echecs d'envoi tolerés pour UNE photo avant de la mettre de cote. Sans ce
   compteur par photo, un seul fichier illisible bloquait toute la file: c'est
   ce qui laissait « 46 photos en attente » pour toujours. */
const MAX_PHOTO_FAILURES = 3;

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
        photos, folders, status, upsertPhoto, upsertFolder, patchPhoto, removeAll,
    } = library;

    const [failures, setFailures] = useState(0);
    /* id -> { id, at, remoteDone }, charge depuis le disque au montage. */
    const tombstonesRef = useRef(new Map());
    const [tombsLoaded, setTombsLoaded] = useState(false);
    const [aEffacer, setAEffacer] = useState(0);
    const drainingRef = useRef(false);
    /* id -> nombre d'echecs d'envoi pour CETTE photo. Voir `MAX_PHOTO_FAILURES`. */
    const echecsRef = useRef(new Map());
    const [lastError, setLastError] = useState('');
    const runningRef = useRef(false);
    const photosRef = useRef(photos);
    const foldersRef = useRef(folders);

    /*
     * Une photo supprimee ne doit ni remonter, ni redescendre.
     *
     * Declaree ICI, avant tout ce qui la lit: la file d'envoi l'appelle pendant
     * le rendu, et une declaration plus bas faisait planter l'ecran entier
     * (`enterre is not defined`).
     */
    const enterre = useCallback((id) => tombstonesRef.current.has(id), []);

    useEffect(() => { photosRef.current = photos; }, [photos]);
    useEffect(() => { foldersRef.current = folders; }, [folders]);

    const uid = cloudUid(user);
    const enabled = Boolean(uid) && cloudReady();

    /* ---------- Le registre des suppressions ---------- */

    /* Il se lit AVANT d'ecouter le compte. Ecouter d'abord, ce serait laisser
       revenir, l'espace d'un instant, tout ce qui a ete supprime hors ligne. */
    useEffect(() => {
        let vivant = true;
        (async () => {
            await purgeTombstones();
            const rows = await listTombstones();
            if (!vivant) return;
            tombstonesRef.current = new Map(rows.map((row) => [row.id, row]));
            setAEffacer(rows.filter((row) => !row.remoteDone).length);
            setTombsLoaded(true);
        })();
        return () => { vivant = false; };
    }, []);

    /*
     * Finir les suppressions distantes qui n'ont pas eu lieu.
     *
     * Y compris celles decidees ailleurs: la synchronisation Room -> dossier
     * ecrit ses pierres tombales sans toucher au reseau, et c'est ici qu'elles
     * sont honorees. Plusieurs de front, sinon cinquante suppressions font
     * attendre une demi-minute.
     */
    const drainTombstones = useCallback(async () => {
        if (!enabled || drainingRef.current) return;
        const file = [...tombstonesRef.current.values()].filter((row) => !row.remoteDone);
        if (!file.length) return;
        drainingRef.current = true;
        setAEffacer(file.length);
        try {
            const lanes = Array.from({ length: Math.min(DELETE_LANES, file.length) }, async () => {
                for (;;) {
                    const row = file.shift();
                    if (!row) return;
                    /* La pierre porte les chemins Storage de la photo: la fiche
                       locale, elle, n'existe plus. */
                    const photo = photosRef.current.find((item) => item.id === row.id) || {
                        id: row.id,
                        cloud: { previewPath: row.previewPath, originalPath: row.originalPath },
                    };
                    try {
                        await deletePhotoRemote(uid, photo);
                    } catch (error) {
                        /* La pierre reste « a finir »: on reessaiera. Marquer
                           fait sur un echec, c'est reprogrammer le retour de la
                           photo pour dans trente jours. */
                        setLastError(error?.message || 'Suppression dans le compte impossible.');
                        continue;
                    }
                    const fait = { ...row, remoteDone: true, at: Date.now() };
                    tombstonesRef.current.set(row.id, fait);
                    await markTombstoneDone(fait);
                    setAEffacer((current) => Math.max(0, current - 1));
                }
            });
            await Promise.all(lanes);
        } finally {
            drainingRef.current = false;
        }
    }, [enabled, uid]);

    useEffect(() => {
        if (!enabled || !tombsLoaded) return;
        void drainTombstones();
    }, [enabled, tombsLoaded, drainTombstones]);

    /* ---------- Descente: ce que le compte contient deja ---------- */

    useEffect(() => {
        if (!enabled || status !== 'ready' || !tombsLoaded) return undefined;
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
                /*
                 * Supprimee ailleurs: on suit.
                 *
                 * Uniquement pour ce qui n'existe QUE dans le compte - pas de
                 * fichier local, donc rien a perdre. Une photo encore posee sur
                 * cet appareil n'est jamais effacee par le serveur: elle peut
                 * etre absente du compte simplement parce qu'elle n'y est pas
                 * ENCORE montee. Sans ce passage, supprimer sur le portable ne
                 * se voyait jamais sur le fixe.
                 */
                const vus = new Set(remotePhotos.map((remote) => remote.id));
                const fantomes = photosRef.current
                    .filter((photo) => photo.remote && !photo.blob && !vus.has(photo.id))
                    .map((photo) => photo.id);
                if (fantomes.length) void removeAll(fantomes);

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
    }, [enabled, uid, status, tombsLoaded, upsertFolder, upsertPhoto, patchPhoto, removeAll, enterre]);

    /* ---------- Montee: ce qui n'est pas encore parti ---------- */

    const pending = useMemo(
        () => photos.filter((photo) => (
            photo.blob && !photo.scout
            && photo.cloud?.state !== 'synced'
            /* Mise de cote apres trois echecs: elle ne doit plus retenir la
               file derriere elle. L'utilisateur peut la relancer a la main. */
            && photo.cloud?.state !== 'blocked'
        )),
        [photos],
    );

    /* Les photos qui ne partiront pas toutes seules. Affichees telles quelles:
       un compteur « en attente » qui n'avance plus est un mensonge. */
    const bloquees = useMemo(
        () => photos.filter((photo) => photo.cloud?.state === 'blocked'),
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
                const raison = error?.message || 'Sauvegarde impossible.';
                setLastError(raison);
                /*
                 * Un refus de droits concerne TOUTE la file: insister n'a pas de
                 * sens. Un fichier illisible ne concerne que lui: avant, il
                 * comptait quand meme dans le compteur global et faisait
                 * s'arreter la sauvegarde de toutes les autres photos apres
                 * trois essais. C'est ce qui figeait « 46 photos en attente ».
                 */
                const global = ['permission-denied', 'unauthenticated', 'storage/unauthorized']
                    .includes(error?.code);
                if (global) setFailures((current) => current + 1);
                if (next) {
                    const essais = (echecsRef.current.get(next.id) || 0) + 1;
                    echecsRef.current.set(next.id, essais);
                    const fini = !global && essais >= MAX_PHOTO_FAILURES;
                    await patchPhoto(next.id, {
                        cloud: {
                            ...(next.cloud || {}),
                            state: fini ? 'blocked' : 'error',
                            error: raison,
                        },
                    });
                }
            } finally {
                runningRef.current = false;
            }
        })();
    }, [enabled, uid, pending, folders, failures, patchPhoto, upsertFolder, enterre]);

    /* ---------- Suppressions ---------- */

    /*
     * Oublier des photos.
     *
     * La pierre tombale est posee et ECRITE tout de suite, meme sans compte et
     * meme hors ligne: c'est elle, et pas la reussite d'une requete, qui decide
     * qu'une photo ne revient pas. Le travail reseau part ensuite, en fond -
     * cinquante doublons ne doivent pas faire attendre l'utilisateur devant un
     * ecran fige, et s'il ferme l'onglet avant la fin, la session suivante
     * reprendra la ou on en est.
     */
    const forgetPhotos = useCallback(async (ids) => {
        const liste = (ids || []).filter(Boolean);
        if (!liste.length) return;
        const now = Date.now();
        const pierres = liste.map((id) => {
            const photo = photosRef.current.find((item) => item.id === id);
            return {
                id,
                at: now,
                remoteDone: false,
                previewPath: photo?.cloud?.previewPath || null,
                originalPath: photo?.cloud?.originalPath || null,
            };
        });
        pierres.forEach((row) => tombstonesRef.current.set(row.id, row));
        await putTombstones(pierres);
        setAEffacer((current) => current + liste.length);
        void drainTombstones();
    }, [drainTombstones]);

    const forgetFolder = useCallback(async (folderId, photoIds = []) => {
        await forgetPhotos(photoIds);
        if (!enabled) return;
        await deleteFolderRemote(uid, folderId);
    }, [enabled, uid, forgetPhotos]);

    /*
     * Repercuter un changement de dossier dans le compte.
     *
     * Seulement pour les photos qui y sont deja: une photo encore en attente
     * partira de toute facon avec son nouveau dossier. Et surtout, on n'ecrit
     * que la fiche - renvoyer l'image pour un changement d'etiquette serait
     * plusieurs megaoctets pour rien.
     */
    const moveRemote = useCallback(async (photos2 = []) => {
        if (!enabled) return;
        for (const photo of photos2) {
            if (photo?.cloud?.state !== 'synced') continue;
            await patchPhotoRemote(uid, photo.id, { folderId: photo.folderId || null })
                .catch(() => null);
        }
    }, [enabled, uid]);

    /* Relancer ce qui a ete mis de cote. Geste explicite: on remet le compteur
       d'echecs a zero, sinon la photo repartirait pour etre rebloquee aussitot. */
    const retryBlocked = useCallback(async () => {
        for (const photo of bloquees) {
            echecsRef.current.delete(photo.id);
            await patchPhoto(photo.id, { cloud: { ...(photo.cloud || {}), state: 'local', error: null } });
        }
        setFailures(0);
        setLastError('');
    }, [bloquees, patchPhoto]);

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
        /* Ce qui ne partira pas se dit AVANT ce qui est en cours: une photo mise
           de cote n'avance plus, et un compteur qui n'avance pas sans le dire
           est ce qui a fait perdre confiance dans cette barre. */
        if (bloquees.length) {
            return {
                tone: 'danger',
                label: `${bloquees.length} photo${bloquees.length > 1 ? 's' : ''} n’${bloquees.length > 1 ? 'ont' : 'a'} pas pu être sauvegardée${bloquees.length > 1 ? 's' : ''} : ${lastError}`,
                icon: <CloudOff size={13} />,
                action: { label: 'Réessayer', run: retryBlocked },
            };
        }
        if (pending.length) {
            return {
                tone: 'busy',
                label: `Sauvegarde dans ton compte · ${pending.length} photo${pending.length > 1 ? 's' : ''} en attente`,
                icon: <RefreshCw size={13} className="vo-spin" />,
            };
        }
        if (aEffacer) {
            return {
                tone: 'busy',
                label: `Suppression dans ton compte · ${aEffacer} photo${aEffacer > 1 ? 's' : ''} restante${aEffacer > 1 ? 's' : ''}`,
                icon: <RefreshCw size={13} className="vo-spin" />,
            };
        }
        return null;
    }, [enabled, failures, lastError, pending.length, bloquees.length, aEffacer, retryBlocked]);

    /* Chiffre affichable ailleurs: combien de photos sont a l'abri. */
    const syncedCount = useMemo(
        () => photos.filter((photo) => photo.cloud?.state === 'synced').length,
        [photos],
    );

    return {
        enabled, banner, pending: pending.length, blocked: bloquees.length, syncedCount,
        forgetPhotos, forgetFolder, hydrate, retryBlocked, drainTombstones, moveRemote,
    };
}
