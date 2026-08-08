"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Music2, Pause, Play } from 'lucide-react';
import { useVibeOsAudio } from '../audio/AudioProvider';
import { IconButton } from '../primitives';
import styles from './shell.module.css';

/*
 * Mini-lecteur du header (plan §3.5): n'apparait que si une piste est chargee.
 * Clic sur le titre -> retour a la page Soundtrack; play/pause sur place.
 */
export default function MiniPlayer() {
    const { track, isPlaying, toggle } = useVibeOsAudio();
    const router = useRouter();

    if (!track) return null;

    return (
        <div className={styles.miniPlayer} data-testid="vibeos-mini-player">
            <span className={styles.miniPlayerArt} aria-hidden="true">
                {track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <Music2 size={13} />}
            </span>
            <button
                type="button"
                className={styles.miniPlayerTitle}
                title={`${track.title} — ouvrir Soundtrack`}
                onClick={() => router.push('/creer/son')}
            >
                {track.title}
            </button>
            <IconButton label={isPlaying ? 'Mettre en pause' : 'Lire'} onClick={toggle}>
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </IconButton>
        </div>
    );
}
