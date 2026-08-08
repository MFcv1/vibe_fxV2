"use client";

import React, { useState } from 'react';
import { Clapperboard, Pause, Play, Shuffle, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import { IconButton } from '../primitives';
import { Artwork } from './TrackList';
import { formatTime } from './useVibeOsSoundtrack';
import styles from './soundtrack.module.css';

/*
 * Lecteur fixe (plan §5.5): barre de 72px en bas sur desktop, mini-barre
 * au-dessus de la tab bar sur mobile avec ouverture en Sheet plein ecran.
 * L'etat vient entierement du provider audio global: cette barre n'est qu'un
 * jeu de commandes, la lecture ne lui appartient pas.
 */

function Transport({ audio, size = 'md' }) {
    return (
        <div className={styles.transport}>
            <IconButton label="Piste précédente" onClick={audio.previous}>
                <SkipBack size={16} />
            </IconButton>
            <button
                type="button"
                className={styles.playButton}
                onClick={audio.toggle}
                aria-label={audio.isPlaying ? 'Mettre en pause' : 'Lire'}
                data-testid="vibeos-soundtrack-play"
                data-size={size}
            >
                {audio.isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <IconButton label="Piste suivante" onClick={audio.next}>
                <SkipForward size={16} />
            </IconButton>
            <IconButton
                label={audio.shuffle ? 'Lecture aléatoire activée' : 'Lecture aléatoire'}
                active={audio.shuffle}
                onClick={audio.toggleShuffle}
            >
                <Shuffle size={15} />
            </IconButton>
        </div>
    );
}

function Seekbar({ audio, id }) {
    const duration = audio.progress.duration || audio.track?.duration || 0;
    return (
        <div className={styles.seek}>
            <span data-numeric>{formatTime(audio.progress.currentTime)}</span>
            <input
                id={id}
                type="range"
                className={styles.seekInput}
                min={0}
                max={Math.max(1, Math.round(duration))}
                step={1}
                value={Math.min(Math.round(audio.progress.currentTime), Math.max(1, Math.round(duration)))}
                onChange={(event) => audio.seek(Number(event.target.value))}
                aria-label="Position dans la piste"
            />
            <span data-numeric>{formatTime(duration)}</span>
        </div>
    );
}

export default function PlayerBar({ audio, currentTrack, onUseInVideo }) {
    const [expanded, setExpanded] = useState(false);
    const track = audio.track;
    if (!track) return null;

    return (
        <>
            <footer className={styles.player} data-testid="vibeos-soundtrack-player">
                <div className={styles.playerTrack}>
                    <Artwork track={currentTrack || track} size={44} />
                    <span className={styles.playerMeta}>
                        <span className={styles.playerTitle}>{track.title}</span>
                        <span className={styles.playerArtist}>{track.artist}</span>
                    </span>
                </div>

                <div className={styles.playerCenter}>
                    <Transport audio={audio} />
                    <Seekbar audio={audio} id="vibeos-seek-desktop" />
                </div>

                <div className={styles.playerTrailing}>
                    <span className={styles.volume}>
                        <Volume2 size={15} />
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(audio.volume * 100)}
                            onChange={(event) => audio.setVolume(Number(event.target.value) / 100)}
                            aria-label="Volume"
                            className={styles.volumeInput}
                        />
                    </span>
                    {currentTrack && onUseInVideo ? (
                        <button
                            type="button"
                            className={styles.useInVideo}
                            onClick={() => onUseInVideo(currentTrack)}
                        >
                            <Clapperboard size={14} />
                            Utiliser dans VibeCut
                        </button>
                    ) : null}
                </div>

                {/* Mobile: une seule ligne tapable qui ouvre le lecteur complet. */}
                <button
                    type="button"
                    className={styles.playerMobile}
                    onClick={() => setExpanded(true)}
                    data-testid="vibeos-soundtrack-mini"
                >
                    <Artwork track={currentTrack || track} size={36} />
                    <span className={styles.playerMeta}>
                        <span className={styles.playerTitle}>{track.title}</span>
                        <span className={styles.playerArtist}>{track.artist}</span>
                    </span>
                    <span
                        className={styles.playerMobilePlay}
                        role="presentation"
                        onClick={(event) => {
                            event.stopPropagation();
                            audio.toggle();
                        }}
                    >
                        {audio.isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </span>
                </button>
            </footer>

            {expanded ? (
                <div className={styles.fullPlayer} role="dialog" aria-modal="true" aria-label="Lecteur">
                    <div className={styles.fullPlayerHead}>
                        <IconButton label="Fermer le lecteur" onClick={() => setExpanded(false)}>
                            <X size={18} />
                        </IconButton>
                    </div>
                    <Artwork track={currentTrack || track} size={220} className={styles.fullPlayerArt} />
                    <p className={styles.fullPlayerTitle}>{track.title}</p>
                    <p className={styles.fullPlayerArtist}>{track.artist}</p>
                    <Seekbar audio={audio} id="vibeos-seek-mobile" />
                    <Transport audio={audio} size="lg" />
                    {currentTrack && onUseInVideo ? (
                        <button
                            type="button"
                            className={styles.useInVideo}
                            onClick={() => onUseInVideo(currentTrack)}
                        >
                            <Clapperboard size={14} />
                            Utiliser dans VibeCut
                        </button>
                    ) : null}
                </div>
            ) : null}
        </>
    );
}
