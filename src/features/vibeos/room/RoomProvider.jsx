"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

function itemFromRecord(record) {
    return {
        id: record.id,
        width: record.width,
        height: record.height,
        source: record.source,
        sourceLabel: record.sourceLabel,
        formatLabel: record.formatLabel,
        projectTitle: record.projectTitle,
        createdAt: record.createdAt,
        url: URL.createObjectURL(record.blob),
    };
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

    const trackUrls = useCallback((nextItems) => {
        const seen = new Set();
        nextItems.forEach((item) => {
            seen.add(item.id);
            urlsRef.current.set(item.id, item.url);
        });
        urlsRef.current.forEach((url, id) => {
            if (seen.has(id)) return;
            URL.revokeObjectURL(url);
            urlsRef.current.delete(id);
        });
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [records, storedValidatedAt] = await Promise.all([
                listRoomItems(),
                readRoomValidatedAt(),
            ]);
            if (cancelled) return;
            const loaded = records.map(itemFromRecord);
            trackUrls(loaded);
            setItems(loaded);
            setValidatedAt(storedValidatedAt || null);
            setStatus('ready');
        })();
        return () => {
            cancelled = true;
        };
    }, [trackUrls]);

    /* Les object URLs ne survivent pas au demontage du provider. */
    useEffect(() => () => {
        urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
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
    }, []);

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
        const addedItems = records.map(itemFromRecord);
        addedItems.forEach((item) => urlsRef.current.set(item.id, item.url));
        setItems((current) => [...current, ...addedItems]);
        invalidate();
        return { added: addedItems.length, total: existing.length + addedItems.length };
    }, [invalidate]);

    const removeItem = useCallback(async (id) => {
        await deleteRoomItem(id);
        const next = itemsRef.current.filter((item) => item.id !== id);
        itemsRef.current = next;
        setItems(next);
        const url = urlsRef.current.get(id);
        if (url) {
            URL.revokeObjectURL(url);
            urlsRef.current.delete(id);
        }
        await persistOrder(next);
        invalidate();
    }, [invalidate, persistOrder]);

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
        await clearRoomItems();
        urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        urlsRef.current.clear();
        itemsRef.current = [];
        setItems([]);
        await writeRoomValidatedAt(null);
        setValidatedAt(null);
    }, []);

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
        addFromCanvas,
        removeItem,
        moveItem,
        clear,
        validateOrder,
    }), [items, status, validatedAt, addFromCanvas, removeItem, moveItem, clear, validateOrder]);

    return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
    const context = useContext(RoomContext);
    if (!context) throw new Error('useRoom doit etre utilise sous <VibeOsRoomProvider>');
    return context;
}
