'use client';

import React, { useCallback, useRef } from 'react';
import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useVibeOsAudio } from '../audio/AudioProvider';
import styles from './layout.module.css';

/*
 * Barre de lecture du mode ecoute (72px), sous la legende de format.
 *
 * Trois zones sur la largeur: identite a gauche, commandes CENTREES avec
 * l'avancement juste dessous, volume a droite. C'est la largeur qui porte la
 * barre d'avancement - la hauteur est le seul axe qui coute quelque chose au
 * telephone, donc le seul qu'on economise.
 *
 * Un seul objet plein dans toute la barre: le disque de lecture. Le reste est
 * en trait et ne s'eclaircit qu'au survol.
 *
 * Tout est branche sur le lecteur global: cette barre ne detient aucun etat de
 * lecture, elle le pilote.
 *
 * Le coeur « garder ce morceau » de la maquette n'est PAS repris ici: il
 * n'aurait rien ou ranger tant que la fiche du morceau choisi ne voyage pas
 * jusqu'a la page publication. Un bouton qui ne range rien est un faux bouton.
 */

const formatTemps = (secondes) => {
    const total = Math.max(0, Math.floor(Number(secondes) || 0));
    const minutes = Math.floor(total / 60);
    const reste = total % 60;
    return `${minutes}:${String(reste).padStart(2, '0')}`;
};

function Rail({ valeur, max, onSeek, label, className }) {
    const railRef = useRef(null);
    const ratio = max > 0 ? Math.max(0, Math.min(1, valeur / max)) : 0;

    const depuisEvenement = (clientX) => {
        const boite = railRef.current?.getBoundingClientRect();
        if (!boite || !boite.width) return null;
        return Math.max(0, Math.min(1, (clientX - boite.left) / boite.width));
    };

    return (
        <span
            ref={railRef}
            className={className}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={Math.round(max) || 0}
            aria-valuenow={Math.round(valeur) || 0}
            onPointerDown={(event) => {
                const part = depuisEvenement(event.clientX);
                if (part !== null) onSeek(part * max);
            }}
            onKeyDown={(event) => {
                if (event.key === 'ArrowRight') { event.preventDefault(); onSeek(Math.min(max, valeur + max * 0.05)); }
                if (event.key === 'ArrowLeft') { event.preventDefault(); onSeek(Math.max(0, valeur - max * 0.05)); }
            }}
        >
            <span className={styles.railFill} style={{ width: `${ratio * 100}%` }} />
            <span className={styles.railTete} style={{ left: `${ratio * 100}%` }} />
        </span>
    );
}

export default function PreviewPlayerBar({ piste }) {
    const audio = useVibeOsAudio();
    const { track, isPlaying, progress, volume, shuffle, repeat } = audio;

    const duree = progress.duration || track?.duration || 0;
    const muet = volume === 0;
    const volumePrecedent = useRef(0.7);

    const basculerSon = useCallback(() => {
        if (volume > 0) {
            volumePrecedent.current = volume;
            audio.setVolume(0);
        } else {
            audio.setVolume(volumePrecedent.current || 0.7);
        }
    }, [audio, volume]);

    if (!track) {
        return (
            <div className={styles.playerBar} data-vide="true" data-testid="vibeos-preview-player">
                <p className={styles.playerVide}>Choisis un morceau à droite pour l’écouter en regardant ton post.</p>
            </div>
        );
    }

    return (
        <div className={styles.playerBar} data-testid="vibeos-preview-player">
            <div className={styles.playerIdent}>
                {piste?.pochetteUrl
                    ? <img className={styles.playerArt} src={piste.pochetteUrl} alt="" />
                    : <span className={styles.playerArtVide} aria-hidden="true" />}
                <span className={styles.playerTxt}>
                    <span className={styles.playerTitre}>{track.title}</span>
                    <span className={styles.playerSous}>{track.artist || 'Artiste inconnu'}</span>
                </span>
            </div>

            <div className={styles.playerCentre}>
                <div className={styles.playerCmd}>
                    <button
                        type="button"
                        className={styles.pbtn}
                        data-trait="true"
                        aria-pressed={shuffle}
                        aria-label="Lecture aléatoire"
                        onClick={audio.toggleShuffle}
                    >
                        <Shuffle size={17} />
                    </button>
                    <button type="button" className={styles.pbtn} aria-label="Morceau précédent" onClick={audio.previous}>
                        <SkipBack size={17} fill="currentColor" />
                    </button>
                    <button
                        type="button"
                        className={styles.pbtn}
                        data-principal="true"
                        aria-label={isPlaying ? 'Mettre en pause' : 'Lire'}
                        onClick={audio.toggle}
                    >
                        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    </button>
                    <button type="button" className={styles.pbtn} aria-label="Morceau suivant" onClick={audio.next}>
                        <SkipForward size={17} fill="currentColor" />
                    </button>
                    <button
                        type="button"
                        className={styles.pbtn}
                        data-trait="true"
                        aria-pressed={repeat}
                        aria-label="Répéter le morceau"
                        onClick={audio.toggleRepeat}
                    >
                        <Repeat size={17} />
                    </button>
                </div>

                <div className={styles.playerScrub}>
                    <time data-numeric>{formatTemps(progress.currentTime)}</time>
                    <Rail
                        className={styles.rail}
                        valeur={progress.currentTime}
                        max={duree}
                        onSeek={audio.seek}
                        label="Position dans le morceau"
                    />
                    <time data-numeric>{formatTemps(duree)}</time>
                </div>
            </div>

            <div className={styles.playerOutils}>
                <button
                    type="button"
                    className={styles.obtn}
                    aria-label={muet ? 'Rétablir le son' : 'Couper le son'}
                    onClick={basculerSon}
                >
                    {muet ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <Rail
                    className={styles.railVolume}
                    valeur={volume}
                    max={1}
                    onSeek={audio.setVolume}
                    label="Volume"
                />
            </div>
        </div>
    );
}
