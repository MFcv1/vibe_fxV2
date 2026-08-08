"use client";

import React from 'react';
import { Clapperboard, Music2, Pause, Play, Plus } from 'lucide-react';
import { getRightsLabel } from '@/features/vibefx-studio/soundtrack/services/soundtrackRights';
import { IconButton, Spinner } from '../primitives';
import { formatTime, getTrackArtist, getTrackHue } from './useVibeOsSoundtrack';
import styles from './soundtrack.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

/*
 * Le badge de licence reste la donnee de `soundtrackRights` (source unique),
 * mais l'UI VibeOS est en francais simple: on traduit les statuts que le
 * catalogue video laisse en anglais ou en jargon, sans jamais inventer un
 * statut plus rassurant que la realite.
 */
const RIGHTS_FR = {
    'verified-free': 'Libre',
    'cleared-social': 'OK réseaux',
    'credit-required': 'Crédit requis',
    'user-declared': 'Déclarée par toi',
    'licensed-project': 'Sous licence',
    'ai-generated': 'IA sous licence',
    'needs-review': 'À vérifier',
    review: 'À vérifier',
    blocked: 'Bloquée',
};

const rightsBadge = (track = {}) => (
    RIGHTS_FR[track.rightsStatus] || getRightsLabel(track.rightsStatus)
);

/* Pochette generee: les manifests audio n'en fournissent pas, mais une grille
   Spotify sans pochette n'est plus une grille. Teinte stable par piste. */
export function Artwork({ track, size = 40, className }) {
    const hue = getTrackHue(track);
    return (
        <span
            className={cx(styles.artwork, className)}
            style={{
                width: size,
                height: size,
                '--vo-art-hue': hue,
            }}
            aria-hidden="true"
        >
            <Music2 size={Math.max(12, Math.round(size * 0.34))} />
        </span>
    );
}

/* Pochette-mosaique des vues bibliotheque: 4 teintes des premieres pistes. */
export function ArtworkMosaic({ tracks = [], size = 132 }) {
    const cells = tracks.slice(0, 4);
    return (
        <span className={styles.mosaic} style={{ width: size, height: size }} aria-hidden="true">
            {cells.length ? cells.map((track) => (
                <span key={track.id} style={{ '--vo-art-hue': getTrackHue(track) }} />
            )) : <span style={{ '--vo-art-hue': 220 }} />}
        </span>
    );
}

function Equalizer() {
    return (
        <span className={styles.equalizer} aria-hidden="true">
            <i />
            <i />
            <i />
        </span>
    );
}

export function TrackRow({
    track,
    index = null,
    playing = false,
    paused = false,
    busy = false,
    inLibrary = true,
    onPlay,
    onAdd,
    onUseInVideo,
}) {
    const artist = getTrackArtist(track);
    const rights = rightsBadge(track);

    return (
        <div
            className={cx(styles.row, playing && styles.rowPlaying)}
            data-testid="vibeos-soundtrack-row"
            data-track-id={track.id}
        >
            <span className={styles.rowIndex} data-numeric>
                {playing && !paused ? <Equalizer /> : index !== null ? index + 1 : ''}
            </span>

            <button
                type="button"
                className={styles.rowPlay}
                onClick={() => onPlay?.(track)}
                aria-label={playing && !paused ? `Mettre en pause ${track.title}` : `Lire ${track.title}`}
            >
                <Artwork track={track} size={40} />
                <span className={styles.rowPlayIcon}>
                    {playing && !paused ? <Pause size={14} /> : <Play size={14} />}
                </span>
            </button>

            <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{track.title || 'Piste sans titre'}</span>
                <span className={styles.rowArtist}>{artist}</span>
            </span>

            <span className={styles.rowRights} title={track.license || rights}>{rights}</span>
            <span className={styles.rowDuration} data-numeric>{formatTime(track.duration)}</span>

            <span className={styles.rowActions}>
                {busy ? <Spinner label="Traitement en cours" /> : (
                    <>
                        {!inLibrary && onAdd ? (
                            <IconButton label={`Ajouter ${track.title} à ma bibliothèque`} onClick={() => onAdd(track)}>
                                <Plus size={15} />
                            </IconButton>
                        ) : null}
                        {onUseInVideo ? (
                            <IconButton label={`Utiliser ${track.title} dans VibeCut`} onClick={() => onUseInVideo(track)}>
                                <Clapperboard size={15} />
                            </IconButton>
                        ) : null}
                    </>
                )}
            </span>
        </div>
    );
}

export function TrackList({
    tracks = [],
    numbered = true,
    currentTrackId = '',
    isPlaying = false,
    busyId = '',
    inLibrary = true,
    onPlay,
    onAdd,
    onUseInVideo,
    testId,
}) {
    return (
        <div className={styles.list} data-testid={testId}>
            {tracks.map((track, index) => (
                <TrackRow
                    key={track.id}
                    track={track}
                    index={numbered ? index : null}
                    playing={currentTrackId === track.id}
                    paused={currentTrackId === track.id && !isPlaying}
                    busy={busyId === track.id}
                    inLibrary={inLibrary}
                    onPlay={onPlay}
                    onAdd={onAdd}
                    onUseInVideo={onUseInVideo}
                />
            ))}
        </div>
    );
}

/* Carte de la vue Accueil: pochette carree + titre + bouton play en survol. */
export function TrackCard({ track, playing = false, isPlaying = false, onPlay }) {
    return (
        <article className={styles.card} data-testid="vibeos-soundtrack-card">
            <button
                type="button"
                className={styles.cardButton}
                onClick={() => onPlay?.(track)}
                aria-label={playing && isPlaying ? `Mettre en pause ${track.title}` : `Lire ${track.title}`}
            >
                <span className={styles.cardArt}>
                    <Artwork track={track} size={140} className={styles.cardArtInner} />
                    <span className={styles.cardPlay}>
                        {playing && isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </span>
                </span>
                <span className={styles.cardTitle}>{track.title || 'Piste sans titre'}</span>
                <span className={styles.cardArtist}>{getTrackArtist(track)}</span>
            </button>
        </article>
    );
}
