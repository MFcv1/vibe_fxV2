"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    deleteRoomItemRemote, fetchRoomBlob, MAX_ROOM_BYTES, pushRoomItem, roomCloudReady,
    roomCloudUid, subscribeRoom,
} from './roomCloud';
import { deleteRoomItem, listRoomItems, putRoomItems } from './roomDb';

/*
 * La Room suit le compte, pas le navigateur.
 *
 * Trois principes, les memes que pour la bibliotheque :
 *
 * 1. LE LOCAL FAIT AUTORITE POUR L'AFFICHAGE. La Room marche sans compte et
 *    sans reseau; ce hook ne fait qu'ajouter une copie distante. Aucun ecran
 *    n'attend une reponse du serveur.
 * 2. UN ENVOI A LA FOIS. Un rendu social pese plusieurs megaoctets; dix en
 *    parallele saturent le lien montant au moment ou l'utilisateur continue a
 *    travailler.
 * 3. ON N'ECRIT PAS EN BOUCLE. L'ecoute renvoie ce qu'on vient d'ecrire; on ne
 *    touche au local que si la fiche distante apporte vraiment du nouveau.
 *
 * Ce que ce hook NE fait pas : effacer une image locale au motif qu'elle est
 * absente du compte. Une suppression faite sur un autre appareil est repercutee
 * (voir plus bas), mais seulement pour des elements DEJA synchronises - jamais
 * pour un rendu qui n'a pas encore eu le temps de partir.
 */

const MAX_FAILURES = 3;

function recordFromRemote(remote) {
    return {
        id: remote.id,
        order: remote.order || 0,
        /* Pas de fichier local: l'image s'affiche depuis son URL, et n'est
           rapatriee que si on en a besoin (enregistrement en bibliotheque). */
        blob: null,
        /* Le poids sert a reconnaitre un rendu deja range en bibliotheque quand
           le lien `fromRoomId` manque (voir `roomToLibrary`). Sans lui, un
           element venu du compte serait toujours vu comme nouveau. */
        bytes: remote.bytes || 0,
        width: remote.width || 0,
        height: remote.height || 0,
        source: remote.source || 'layout',
        sourceLabel: remote.sourceLabel || 'Rendu',
        formatLabel: remote.formatLabel || null,
        projectTitle: remote.projectTitle || null,
        createdAt: remote.createdAt || Date.now(),
        cloud: {
            state: 'synced',
            path: remote.path || null,
            url: remote.url || null,
            syncedAt: remote.updatedAt || Date.now(),
        },
    };
}

export default function useRoomSync({ status, reload }) {
    const { user } = useAuth();
    const uid = roomCloudUid(user);
    const enabled = Boolean(uid) && status === 'ready';

    const [pendingCount, setPendingCount] = useState(0);
    const [failures, setFailures] = useState(0);
    const [lastError, setLastError] = useState('');
    const [tick, setTick] = useState(0);
    const runningRef = useRef(false);

    /* ---------- Descente: ce que le compte connait et pas cet appareil ---------- */

    useEffect(() => {
        if (!enabled) return undefined;
        return subscribeRoom(uid, {
            onItems: async (remotes) => {
                const locals = await listRoomItems();
                const parId = new Map(locals.map((row) => [row.id, row]));
                const aEcrire = [];

                remotes.forEach((remote) => {
                    const local = parId.get(remote.id);
                    if (!local) { aEcrire.push(recordFromRemote(remote)); return; }
                    /* Deja la: seul l'ordre peut avoir bouge ailleurs. */
                    const memeOrdre = (local.order || 0) === (remote.order || 0);
                    const memeUrl = (local.cloud?.url || null) === (remote.url || null);
                    if (memeOrdre && memeUrl) return;
                    aEcrire.push({
                        ...local,
                        order: remote.order || 0,
                        cloud: {
                            state: 'synced',
                            path: remote.path || null,
                            url: remote.url || null,
                            syncedAt: remote.updatedAt || Date.now(),
                        },
                    });
                });

                /* Supprime ailleurs: on suit, mais uniquement pour ce qui etait
                   deja parti. Un rendu encore en attente d'envoi n'est absent du
                   compte que parce qu'il n'y est pas ENCORE. */
                const vus = new Set(remotes.map((remote) => remote.id));
                const aSupprimer = locals
                    .filter((row) => row.cloud?.state === 'synced' && !vus.has(row.id))
                    .map((row) => row.id);

                if (!aEcrire.length && !aSupprimer.length) return;
                if (aEcrire.length) await putRoomItems(aEcrire);
                for (const id of aSupprimer) await deleteRoomItem(id);
                reload?.();
            },
            onError: (error) => {
                setLastError(error?.message || 'Lecture du compte impossible.');
                setFailures((current) => current + 1);
            },
        });
    }, [enabled, uid, reload]);

    /* ---------- Montee: ce qui n'est pas encore parti ---------- */

    useEffect(() => {
        if (!enabled || runningRef.current || failures >= MAX_FAILURES) return;
        let annule = false;
        (async () => {
            const rows = await listRoomItems();
            const attente = rows.filter((row) => row.blob && row.cloud?.state !== 'synced');
            if (annule) return;
            setPendingCount(attente.length);
            const next = attente[0];
            if (!next) return;

            runningRef.current = true;
            try {
                const result = await pushRoomItem(uid, next);
                await putRoomItems([{
                    ...next,
                    cloud: { state: 'synced', ...result, syncedAt: Date.now() },
                }]);
                setFailures(0);
                setLastError('');
            } catch (error) {
                if (error?.code === 'too-big') {
                    /* Inutile de reessayer indefiniment: on marque et on passe. */
                    await putRoomItems([{
                        ...next,
                        cloud: { state: 'too-big', syncedAt: null },
                    }]);
                    setLastError(`Une image depasse ${Math.round(MAX_ROOM_BYTES / (1024 * 1024))} Mo et reste sur cet appareil.`);
                } else {
                    setFailures((current) => current + 1);
                    setLastError(error?.message || 'Sauvegarde de la Room impossible.');
                }
            } finally {
                runningRef.current = false;
                if (!annule) setTick((current) => current + 1);
            }
        })();
        return () => { annule = true; };
    }, [enabled, uid, failures, tick]);

    /* Suppression locale demandee par l'utilisateur: on efface aussi la copie
       distante, sinon l'ecoute la ferait revenir a la prochaine ouverture. */
    const forgetRemote = useCallback(async (item) => {
        if (!enabled || !item) return;
        await deleteRoomItemRemote(uid, item).catch(() => null);
    }, [enabled, uid]);

    /* Rapatrie l'image d'un element venu du compte, quand on en a besoin en
       entier (enregistrement dans la bibliotheque). */
    const hydrate = useCallback(async (item) => {
        if (item?.blob) return item.blob;
        return fetchRoomBlob(item?.cloud?.url, item?.cloud?.path);
    }, []);

    const banner = useMemo(() => {
        if (!roomCloudReady() || !user) return null;
        if (!enabled) return null;
        if (failures >= MAX_FAILURES) return { tone: 'danger', label: lastError || 'Sauvegarde interrompue.' };
        if (lastError) return { tone: 'warn', label: lastError };
        if (pendingCount) return { tone: 'default', label: `Sauvegarde dans ton compte · ${pendingCount} image${pendingCount > 1 ? 's' : ''} en attente` };
        return null;
    }, [enabled, failures, lastError, pendingCount, user]);

    return { enabled, banner, forgetRemote, hydrate };
}
