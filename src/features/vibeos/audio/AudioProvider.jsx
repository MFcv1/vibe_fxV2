"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/*
 * Audio global VibeOS (plan §3.5).
 * L'element <audio> vit ICI, dans le layout /creer: il survit aux navigations
 * internes, donc la musique continue de jouer pendant qu'on cree. La page
 * Soundtrack (phase E) branchera sa bibliotheque dessus; le mini-lecteur du
 * shell n'affiche que l'etat expose par ce provider.
 */

const AudioContextVo = createContext(null);

export function VibeOsAudioProvider({ children }) {
    const audioRef = useRef(null);
    const [track, setTrack] = useState(null); // { id, title, artist, artworkUrl, srcUrl }
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });

    useEffect(() => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audioRef.current = audio;

        const onTime = () => setProgress({ currentTime: audio.currentTime, duration: audio.duration || 0 });
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => setIsPlaying(false);

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
            audioRef.current = null;
        };
    }, []);

    const playTrack = useCallback(async (nextTrack) => {
        const audio = audioRef.current;
        if (!audio || !nextTrack?.srcUrl) return;
        if (track?.id !== nextTrack.id) {
            audio.src = nextTrack.srcUrl;
            setTrack(nextTrack);
        }
        try {
            await audio.play();
        } catch {
            /* Lecture refusee (autoplay policy) - l'utilisateur relancera. */
        }
    }, [track?.id]);

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
        audio.currentTime = Math.max(0, Math.min(time, audio.duration || 0));
    }, []);

    const stop = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        audio.src = '';
        setTrack(null);
        setProgress({ currentTime: 0, duration: 0 });
    }, []);

    const value = useMemo(
        () => ({ track, isPlaying, progress, playTrack, toggle, seek, stop }),
        [track, isPlaying, progress, playTrack, toggle, seek, stop],
    );

    return <AudioContextVo.Provider value={value}>{children}</AudioContextVo.Provider>;
}

export function useVibeOsAudio() {
    const context = useContext(AudioContextVo);
    if (!context) throw new Error('useVibeOsAudio doit etre utilise sous <VibeOsAudioProvider>');
    return context;
}
