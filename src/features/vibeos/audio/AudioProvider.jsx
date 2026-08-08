"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/*
 * Audio global VibeOS (plan §3.5 et §5.5).
 *
 * L'element <audio> vit ICI, dans le layout /creer: il survit aux navigations
 * internes, donc la musique continue de jouer pendant qu'on cree. C'est aussi
 * pour cette raison que la FILE de lecture vit ici et pas dans l'ecran
 * Soundtrack: si l'enchainement automatique dependait de la page /creer/son,
 * la lecture s'arreterait en fin de piste des qu'on part composer un visuel.
 *
 * Deux precautions importantes:
 *  - la source est RESOLUE a la demande (`resolveSource`), parce que les URLs
 *    d'objet de la bibliotheque locale sont revoquees quand l'ecran Soundtrack
 *    est demonte. Quand le resolveur rend un Blob, le provider fabrique sa
 *    PROPRE URL d'objet et en garde la propriete jusqu'a la piste suivante.
 *  - la file est stockee en ref ET en state: la ref sert aux callbacks (pas de
 *    peremption), le state sert a l'affichage.
 */

const AudioContextVo = createContext(null);

const DEFAULT_VOLUME = 0.7;

export function VibeOsAudioProvider({ children }) {
    const audioRef = useRef(null);
    const ownedUrlRef = useRef('');
    const queueRef = useRef([]);
    const resolverRef = useRef(null);
    const shuffleRef = useRef(false);
    const playTrackRef = useRef(null);
    const requestIdRef = useRef(0);

    const [track, setTrack] = useState(null); // { id, title, artist, artworkUrl, duration }
    const [isPlaying, setIsPlaying] = useState(false);
    const [status, setStatus] = useState('idle'); // idle | loading | playing | paused | error
    const [error, setError] = useState('');
    const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
    const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
    const [shuffle, setShuffle] = useState(false);
    const [queueLength, setQueueLength] = useState(0);

    useEffect(() => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.volume = DEFAULT_VOLUME;
        audioRef.current = audio;

        const onTime = () => setProgress({ currentTime: audio.currentTime, duration: audio.duration || 0 });
        const onPlay = () => {
            setIsPlaying(true);
            setStatus('playing');
        };
        const onPause = () => {
            setIsPlaying(false);
            setStatus((current) => (current === 'error' ? current : 'paused'));
        };
        const onEnded = () => {
            setIsPlaying(false);
            playTrackRef.current?.stepQueue(1, { auto: true });
        };

        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('loadedmetadata', onTime);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.pause();
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('loadedmetadata', onTime);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.src = '';
            if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current);
            ownedUrlRef.current = '';
            audioRef.current = null;
        };
    }, []);

    /* La file et le resolveur sont pousses par l'ecran Soundtrack a chaque
       changement de bibliotheque. Rien d'autre ne les ecrit. */
    const setQueue = useCallback((entries = []) => {
        queueRef.current = Array.isArray(entries) ? entries.filter((entry) => entry?.id) : [];
        setQueueLength(queueRef.current.length);
    }, []);

    const setSourceResolver = useCallback((resolver) => {
        resolverRef.current = typeof resolver === 'function' ? resolver : null;
    }, []);

    const setVolume = useCallback((next) => {
        const clamped = Math.max(0, Math.min(1, Number(next) || 0));
        setVolumeState(clamped);
        if (audioRef.current) audioRef.current.volume = clamped;
    }, []);

    const toggleShuffle = useCallback(() => {
        setShuffle((current) => {
            shuffleRef.current = !current;
            return !current;
        });
    }, []);

    const playTrack = useCallback(async (entry) => {
        const audio = audioRef.current;
        if (!audio || !entry?.id) return;

        requestIdRef.current += 1;
        const requestId = requestIdRef.current;

        setTrack({
            id: entry.id,
            title: entry.title || 'Piste sans titre',
            artist: entry.artist || '',
            artworkUrl: entry.artworkUrl || '',
            duration: Number(entry.duration) || 0,
        });
        setStatus('loading');
        setError('');
        setProgress({ currentTime: 0, duration: Number(entry.duration) || 0 });

        let source = '';
        try {
            source = resolverRef.current ? await resolverRef.current(entry) : (entry.src || '');
        } catch {
            source = '';
        }
        /* Une resolution lente ne doit pas ecraser un clic plus recent. */
        if (requestIdRef.current !== requestId) return;

        if (!source) {
            setStatus('error');
            setIsPlaying(false);
            setError('Fichier audio indisponible. Reimporte la piste ou reconnecte le dossier.');
            return;
        }

        if (ownedUrlRef.current) {
            URL.revokeObjectURL(ownedUrlRef.current);
            ownedUrlRef.current = '';
        }
        if (typeof source !== 'string') {
            ownedUrlRef.current = URL.createObjectURL(source);
            audio.src = ownedUrlRef.current;
        } else {
            audio.src = source;
        }
        audio.volume = volume;

        try {
            await audio.play();
        } catch {
            /* Lecture refusee (politique autoplay du navigateur): l'utilisateur
               relancera lui-meme, on ne transforme pas ca en erreur bloquante. */
            if (requestIdRef.current === requestId) setStatus('paused');
        }
    }, [volume]);

    /* Deplacement dans la file. `auto` = fin de piste: on ne boucle pas si la
       file est vide, mais on boucle bien d'un bout a l'autre sinon. */
    const stepQueue = useCallback((direction, { auto = false } = {}) => {
        const queue = queueRef.current;
        if (!queue.length) {
            if (!auto) return;
            setStatus('idle');
            return;
        }
        const currentId = track?.id;
        if (shuffleRef.current && queue.length > 1) {
            const candidates = queue.filter((entry) => entry.id !== currentId);
            const next = candidates[Math.floor(Math.random() * candidates.length)];
            if (next) playTrack(next);
            return;
        }
        const index = queue.findIndex((entry) => entry.id === currentId);
        const nextIndex = index >= 0
            ? (index + direction + queue.length) % queue.length
            : 0;
        const next = queue[nextIndex];
        if (next) playTrack(next);
    }, [playTrack, track?.id]);

    /* Le handler `ended` de l'element audio est pose une seule fois au montage:
       il passe par cette ref pour toujours voir la derniere version de la file. */
    useEffect(() => {
        playTrackRef.current = { stepQueue };
    }, [stepQueue]);

    const next = useCallback(() => stepQueue(1), [stepQueue]);
    const previous = useCallback(() => stepQueue(-1), [stepQueue]);

    const toggle = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !track) return;
        if (audio.paused) {
            audio.play().catch(() => {});
        } else {
            audio.pause();
        }
    }, [track]);

    const seek = useCallback((time) => {
        const audio = audioRef.current;
        if (!audio) return;
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        audio.currentTime = Math.max(0, Math.min(Number(time) || 0, duration || Number(time) || 0));
        setProgress((current) => ({ ...current, currentTime: audio.currentTime }));
    }, []);

    const stop = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        requestIdRef.current += 1;
        audio.pause();
        audio.src = '';
        if (ownedUrlRef.current) {
            URL.revokeObjectURL(ownedUrlRef.current);
            ownedUrlRef.current = '';
        }
        setTrack(null);
        setStatus('idle');
        setError('');
        setProgress({ currentTime: 0, duration: 0 });
    }, []);

    const value = useMemo(() => ({
        track,
        isPlaying,
        status,
        error,
        progress,
        volume,
        setVolume,
        shuffle,
        toggleShuffle,
        queueLength,
        setQueue,
        setSourceResolver,
        playTrack,
        toggle,
        seek,
        next,
        previous,
        stop,
    }), [
        track, isPlaying, status, error, progress, volume, setVolume, shuffle, toggleShuffle,
        queueLength, setQueue, setSourceResolver, playTrack, toggle, seek, next, previous, stop,
    ]);

    return <AudioContextVo.Provider value={value}>{children}</AudioContextVo.Provider>;
}

export function useVibeOsAudio() {
    const context = useContext(AudioContextVo);
    if (!context) throw new Error('useVibeOsAudio doit etre utilise sous <VibeOsAudioProvider>');
    return context;
}
