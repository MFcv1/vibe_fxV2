"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { buildSocialImages } from '../../vibefx-studio/utils/socialExport';
import {
    clearRoomItems,
    createRoomItemId,
    deleteRoomItem,
    listRoomItems,
    putRoomItems,
    readRoomValidatedAt,
    writeRoomValidatedAt,
} from './roomDb';
import useRoomSync from './useRoomSync';
import { pushRoomOrder, roomCloudUid } from './roomCloud';

/*
 * La Room: la file d'attente d'un post.
 *
 * Layout et Vision savent fabriquer UNE image. La Room est l'endroit ou ces
 * images s'accumulent, dans l'ordre ou Instagram les fera defiler, jusqu'a ce
 * que le post soit complet. Elle survit a un changement de page et a une
 * fermeture d'onglet (IndexedDB), sans jamais rien envoyer au serveur.
 *
 * Ce que la Room stocke est un RENDU, pas des reglages: une image envoyee ne
 * bouge plus si on retouche ensuite le projet. C'est voulu - c'est ce qui
 * permet de cumuler plusieurs versions d'une meme photo dans un carrousel.
 *
 * Les URL d'affichage sont des object URLs crees ici et revoquees ici: aucun
 * composant n'a a s'en occuper.
 */

/*
 * Un carrousel Instagram affiche 10 images, et l'apercu iPhone s'arrete la.
 *
 * C'est un REPERE, plus un plafond. La Room sert aussi de reserve : on y
 * accumule des rendus, on compare des variantes d'une meme photo, on choisit
 * ensuite ce qui part dans le post. Bloquer a dix obligeait a jeter avant
 * d'avoir choisi. On garde donc le chiffre pour dire ce qui tient dans un
 * carrousel, et on ne refuse plus rien.
 */
export const ROOM_CAROUSEL_MAX = 10;

const RoomContext = createContext(null);

function itemFromRecord(record, url) {
    return {
        id: record.id,
        /* Venue du compte et pas encore rapatriee: elle s'affiche depuis son
           URL Storage. C'est ce qui permet de retrouver sa Room sur un autre
           appareil sans rien retelecharger. */
        remote: !record.blob,
        cloud: record.cloud || null,
        width: record.width,
        height: record.height,
        source: record.source,
        sourceLabel: record.sourceLabel,
        formatLabel: record.formatLabel,
        projectTitle: record.projectTitle,
        createdAt: record.createdAt,
        url,
    };
}

/* Seules les URLs fabriquees ici se revoquent; celles de Storage sont des
   adresses distantes, les revoquer n'aurait aucun sens. */
function isObjectUrl(url) {
    return typeof url === 'string' && url.startsWith('blob:');
}

export function VibeOsRoomProvider({ children }) {
    const [items, setItems] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | ready
    const [validatedAt, setValidatedAt] = useState(null);
    /* id -> object URL, pour revoquer exactement ce qui a ete cree. */
    const urlsRef = useRef(new Map());
    /* La file courante, lisible en dehors d'un rendu: les mutations calculent
       la liste suivante AVANT de la rendre, pour la persister telle quelle. */
    const itemsRef = useRef([]);
    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    /*
     * L'adresse d'affichage d'une image, fabriquee UNE SEULE FOIS par element.
     *
     * Elle etait refabriquee a chaque relecture de la file, et l'ancienne
     * revoquee dans la foulee. Deux relectures qui se chevauchent - ce qui
     * arrive a chaque envoi vers le compte, puisque chacun declenche une
     * notification - pouvaient alors se terminer dans le desordre : l'ecran
     * gardait des adresses que l'autre venait de revoquer, et les vignettes
     * devenaient des points d'interrogation. Une adresse par element, gardee
     * tant que l'element est la, supprime le probleme a la racine.
     */
    const urlFor = useCallback((record) => {
        const connue = urlsRef.current.get(record.id);
        /* Un rendu rapatrie depuis le compte remplace son adresse distante par
           son fichier local: c'est le seul cas ou l'adresse doit changer. */
        if (connue && !(record.blob && !isObjectUrl(connue))) return connue;
        if (connue && isObjectUrl(connue)) URL.revokeObjectURL(connue);
        const url = record.blob ? URL.createObjectURL(record.blob) : (record.cloud?.url || null);
        if (url) urlsRef.current.set(record.id, url);
        else urlsRef.current.delete(record.id);
        return url;
    }, []);

    /* Ne revoque QUE ce qui a quitte la file. */
    const trackUrls = useCallback((nextItems) => {
        const seen = new Set(nextItems.map((item) => item.id));
        urlsRef.current.forEach((url, id) => {
            if (seen.has(id)) return;
            if (isObjectUrl(url)) URL.revokeObjectURL(url);
            urlsRef.current.delete(id);
        });
    }, []);

    /* Relit la file depuis IndexedDB. La synchronisation s'en sert quand le
       compte a apporte quelque chose que cet appareil ne connaissait pas. */
    /* Deux relectures lancees coup sur coup peuvent se terminer dans le
       desordre. Seule la plus recente a le droit d'ecrire l'ecran. */
    const reloadSeq = useRef(0);
    const reload = useCallback(async () => {
        reloadSeq.current += 1;
        const moi = reloadSeq.current;
        const records = await listRoomItems();
        if (moi !== reloadSeq.current) return;
        const loaded = records.map((record) => itemFromRecord(record, urlFor(record)));
        trackUrls(loaded);
        itemsRef.current = loaded;
        setItems(loaded);
    }, [trackUrls, urlFor]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [records, storedValidatedAt] = await Promise.all([
                listRoomItems(),
                readRoomValidatedAt(),
            ]);
            if (cancelled) return;
            const loaded = records.map((record) => itemFromRecord(record, urlFor(record)));
            trackUrls(loaded);
            setItems(loaded);
            setValidatedAt(storedValidatedAt || null);
            setStatus('ready');
        })();
        return () => {
            cancelled = true;
        };
    }, [trackUrls, urlFor]);

    /* Sauvegarde de la file dans le compte: c'est elle qui fait qu'une Room
       preparee sur un appareil se retrouve sur l'autre. */
    const sync = useRoomSync({ status, reload });
    const { user } = useAuth();
    const uid = roomCloudUid(user);

    /* Les object URLs ne survivent pas au demontage du provider. */
    useEffect(() => () => {
        urlsRef.current.forEach((url) => { if (isObjectUrl(url)) URL.revokeObjectURL(url); });
        urlsRef.current.clear();
    }, []);

    /* Toute modification de la file invalide l'ordre deja valide: on ne laisse
       pas croire qu'un post relu est celui qu'on avait approuve. */
    const invalidate = useCallback(() => {
        setValidatedAt((current) => {
            if (current) writeRoomValidatedAt(null);
            return null;
        });
    }, []);

    /* Reecrit `order` pour tout le monde: c'est la seule verite de l'ordre. */
    const persistOrder = useCallback(async (nextItems, records) => {
        const byId = new Map((records || []).map((record) => [record.id, record]));
        const stored = records ? [] : await listRoomItems();
        stored.forEach((record) => byId.set(record.id, record));
        const rows = nextItems
            .map((item, index) => {
                const record = byId.get(item.id);
                return record ? { ...record, order: index } : null;
            })
            .filter(Boolean);
        await putRoomItems(rows);
        /* L'ordre est la seule chose que cet ecran modifie: il doit suivre le
           compte, sinon un carrousel reordonne ici reviendrait melange
           ailleurs. Les fichiers, eux, ne bougent pas. */
        if (uid) {
            const partis = rows.filter((row) => row.cloud?.state === 'synced');
            if (partis.length) await pushRoomOrder(uid, partis).catch(() => null);
        }
    }, [uid]);

    /*
     * Envoie un rendu dans la Room. Un panorama arrive decoupe en 2 ou 3
     * tranches - c'est `buildSocialImages`, exactement le decoupage de l'export
     * et de l'apercu Instagram, pour qu'une tranche vue ici soit la tranche
     * publiee.
     */
    const addFromCanvas = useCallback(async (canvas, meta = {}) => {
        if (!canvas) return { added: 0, reason: 'no-canvas' };
        const slides = await buildSocialImages(canvas, meta.format);
        const usable = slides.filter((slide) => slide.blob);
        if (!usable.length) return { added: 0, reason: 'no-render' };

        const existing = await listRoomItems();
        const kept = usable;

        const now = Date.now();
        const records = kept.map((slide, index) => ({
            id: createRoomItemId(),
            order: existing.length + index,
            blob: slide.blob,
            width: slide.width,
            height: slide.height,
            source: meta.source || 'layout',
            sourceLabel: meta.sourceLabel || 'Rendu',
            formatLabel: meta.formatLabel
                || (kept.length > 1 ? `${meta.format?.label || 'Panorama'} · tranche ${index + 1}` : meta.format?.label || null),
            projectTitle: meta.projectTitle || null,
            createdAt: now + index,
        }));

        await putRoomItems(records);
        const addedItems = records.map((record) => itemFromRecord(record, urlFor(record)));
        setItems((current) => [...current, ...addedItems]);
        invalidate();
        return { added: addedItems.length, total: existing.length + addedItems.length };
    }, [invalidate, urlFor]);

    const removeItem = useCallback(async (id) => {
        const rows = await listRoomItems();
        const cible = rows.find((row) => row.id === id);
        if (cible) await sync.forgetRemote(cible);
        await deleteRoomItem(id);
        const next = itemsRef.current.filter((item) => item.id !== id);
        itemsRef.current = next;
        setItems(next);
        const url = urlsRef.current.get(id);
        if (url) {
            if (isObjectUrl(url)) URL.revokeObjectURL(url);
            urlsRef.current.delete(id);
        }
        await persistOrder(next);
        invalidate();
    }, [invalidate, persistOrder, sync]);

    const moveItem = useCallback(async (fromIndex, toIndex) => {
        const current = itemsRef.current;
        if (fromIndex < 0 || fromIndex >= current.length) return;
        const target = Math.max(0, Math.min(current.length - 1, toIndex));
        if (target === fromIndex) return;
        const next = [...current];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(target, 0, moved);
        itemsRef.current = next;
        setItems(next);
        await persistOrder(next);
        invalidate();
    }, [invalidate, persistOrder]);

    const clear = useCallback(async () => {
        const rows = await listRoomItems();
        for (const row of rows) await sync.forgetRemote(row);
        await clearRoomItems();
        urlsRef.current.forEach((url) => { if (isObjectUrl(url)) URL.revokeObjectURL(url); });
        urlsRef.current.clear();
        itemsRef.current = [];
        setItems([]);
        await writeRoomValidatedAt(null);
        setValidatedAt(null);
    }, [sync]);

    /* « Valider l'ordre »: l'utilisateur dit que la file est le post. Rien ne
       part nulle part - c'est un feu vert, pas une publication. */
    const validateOrder = useCallback(async () => {
        const stamp = Date.now();
        setValidatedAt(stamp);
        await writeRoomValidatedAt(stamp);
        return stamp;
    }, []);

    const value = useMemo(() => ({
        items,
        count: items.length,
        status,
        /* Au-dela du carrousel Instagram: on le DIT, on ne l'empeche pas. */
        overCarousel: items.length > ROOM_CAROUSEL_MAX,
        validatedAt,
        /* Etat de la sauvegarde dans le compte, pour l'ecran Room. */
        syncEnabled: sync.enabled,
        syncBanner: sync.banner,
        addFromCanvas,
        removeItem,
        moveItem,
        clear,
        validateOrder,
    }), [items, status, validatedAt, sync.enabled, sync.banner,
        addFromCanvas, removeItem, moveItem, clear, validateOrder]);

    return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
    const context = useContext(RoomContext);
    if (!context) throw new Error('useRoom doit etre utilise sous <VibeOsRoomProvider>');
    return context;
}
