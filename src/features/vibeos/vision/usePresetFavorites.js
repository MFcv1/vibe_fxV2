"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { auth, db, firebaseReady } from '@/lib/firebase';

const FAVORITES = 'visionPresetFavorites';
const EMPTY_FAVORITES = new Set();

function cloudUid(user) {
    if (!user?.uid || !firebaseReady || !db) return null;
    if (auth?.currentUser?.uid !== user.uid) return null;
    return user.uid;
}

/*
 * Favoris Vision lies au compte Firebase.
 *
 * L'interface bascule l'etoile tout de suite, puis Firestore confirme par son
 * ecoute temps reel. Si l'ecriture echoue, l'etat precedent est restaure : on
 * ne montre jamais un favori comme enregistre quand il ne l'est pas.
 */
export default function usePresetFavorites() {
    const { user } = useAuth();
    const uid = cloudUid(user);
    const [favoriteState, setFavoriteState] = useState(() => ({ uid: null, ids: new Set() }));
    const [pendingIds, setPendingIds] = useState(() => new Set());
    const [error, setError] = useState('');
    const favoritesRef = useRef({ uid: null, ids: new Set() });
    const favoriteIds = favoriteState.uid === uid ? favoriteState.ids : EMPTY_FAVORITES;

    useEffect(() => {
        if (!uid) return undefined;

        return onSnapshot(
            collection(db, 'users', uid, FAVORITES),
            (snapshot) => {
                const next = new Set(snapshot.docs.map((item) => item.id));
                favoritesRef.current = { uid, ids: next };
                setFavoriteState({ uid, ids: next });
                setError('');
            },
            () => setError('Tes favoris ne peuvent pas être synchronisés pour le moment.'),
        );
    }, [uid]);

    const toggleFavorite = useCallback(async (presetId) => {
        const id = String(presetId || '').trim();
        if (!id || pendingIds.has(id)) return;

        const current = favoritesRef.current.uid === uid
            ? favoritesRef.current.ids
            : EMPTY_FAVORITES;
        const wasFavorite = current.has(id);
        const optimistic = new Set(current);
        if (wasFavorite) optimistic.delete(id);
        else optimistic.add(id);
        favoritesRef.current = { uid, ids: optimistic };
        setFavoriteState({ uid, ids: optimistic });
        setError('');

        /* Le contournement d'auth local reste testable en memoire, mais il
           n'ecrit jamais sous un faux uid. En production, StudioAuthGate exige
           un vrai compte avant d'afficher Vision. */
        if (!uid) return;

        setPendingIds((current) => new Set(current).add(id));
        try {
            const favoriteRef = doc(db, 'users', uid, FAVORITES, id);
            if (wasFavorite) await deleteDoc(favoriteRef);
            else {
                await setDoc(favoriteRef, {
                    ownerUid: uid,
                    presetId: id,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }
        } catch {
            const rollback = new Set(favoritesRef.current.ids);
            if (wasFavorite) rollback.add(id);
            else rollback.delete(id);
            favoritesRef.current = { uid, ids: rollback };
            setFavoriteState({ uid, ids: rollback });
            setError('Ce favori n’a pas été enregistré. Réessaie.');
        } finally {
            setPendingIds((current) => {
                const next = new Set(current);
                next.delete(id);
                return next;
            });
        }
    }, [pendingIds, uid]);

    return { favoriteIds, pendingIds, toggleFavorite, error };
}
