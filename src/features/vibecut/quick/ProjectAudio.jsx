"use client";

import React from 'react';
import { AlertTriangle, Music, Plus, ShieldCheck, Trash2, Volume2, VolumeX } from 'lucide-react';
import { getTrackRightsIssues } from '@/features/vibefx-studio/video/data/musicRights';
import { Badge, Button, IconButton } from '../primitives';
import styles from './quick.module.css';

/*
 * Bloc musique, au niveau projet (pas de la scene selectionnee).
 * Affiche l'etat reel des droits: c'est ce qui autorise ou bloque l'export,
 * autant le montrer ici plutot que de laisser l'utilisateur le decouvrir au
 * moment d'exporter.
 */

export default function ProjectAudio({ tracks = [], actions, onAdd }) {
    return (
        <div className={styles.group} data-testid="vibecut-project-audio">
            <div className={styles.groupHead}>
                <h3 className={styles.groupTitle}>Musique</h3>
                {tracks.length > 0 ? (
                    <span className={styles.groupValue}>{tracks.length} piste{tracks.length > 1 ? 's' : ''}</span>
                ) : null}
            </div>

            {tracks.length === 0 ? (
                <Button variant="secondary" block icon={<Plus size={16} />} onClick={onAdd} data-testid="vibecut-add-music">
                    Ajouter une musique
                </Button>
            ) : (
                <>
                    {tracks.map((track) => {
                        const { issues } = getTrackRightsIssues(track);
                        const muted = Number(track.volume) === 0;
                        return (
                            <div key={track.id} className={styles.audioTrack} data-testid={`vibecut-audio-track-${track.id}`}>
                                <div className={styles.audioHead}>
                                    <span className={styles.audioIcon}><Music size={14} /></span>
                                    <span className={styles.audioName}>{track.name}</span>
                                    <IconButton
                                        label={muted ? 'Réactiver le son' : 'Couper le son'}
                                        onClick={() => actions.updateMusic(track.id, { volume: muted ? 70 : 0 })}
                                        data-testid={`vibecut-audio-mute-${track.id}`}
                                    >
                                        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                                    </IconButton>
                                    <IconButton
                                        label="Retirer la musique"
                                        onClick={() => actions.removeMusic(track.id)}
                                        data-testid={`vibecut-audio-remove-${track.id}`}
                                    >
                                        <Trash2 size={15} />
                                    </IconButton>
                                </div>

                                <input
                                    type="range"
                                    className={styles.slider}
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={Number(track.volume) || 0}
                                    onChange={(event) => actions.updateMusic(track.id, { volume: Number(event.target.value) })}
                                    aria-label={`Volume de ${track.name}`}
                                    data-testid={`vibecut-audio-volume-${track.id}`}
                                />

                                <div className={styles.audioRow}>
                                    <label className={styles.fieldLabel}>
                                        Début dans le morceau
                                        <input
                                            type="range"
                                            className={styles.slider}
                                            min={0}
                                            max={Math.max(0, (Number(track.sourceDuration) || 0) - 1)}
                                            step={0.5}
                                            value={Number(track.trimStart) || 0}
                                            onChange={(event) => actions.updateMusic(track.id, { trimStart: Number(event.target.value) })}
                                            disabled={!track.sourceDuration}
                                            data-testid={`vibecut-audio-trim-${track.id}`}
                                        />
                                    </label>
                                    <label className={styles.fieldLabel}>
                                        Fondu de sortie
                                        <input
                                            type="range"
                                            className={styles.slider}
                                            min={0}
                                            max={4}
                                            step={0.25}
                                            value={Number(track.fadeOut) || 0}
                                            onChange={(event) => actions.updateMusic(track.id, { fadeOut: Number(event.target.value) })}
                                            data-testid={`vibecut-audio-fade-${track.id}`}
                                        />
                                    </label>
                                </div>
                                <span className={styles.groupNote} data-numeric="true">
                                    Départ {(Number(track.trimStart) || 0).toFixed(1)} s · fondu {(Number(track.fadeOut) || 0).toFixed(2)} s
                                </span>

                                {issues.length > 0 ? (
                                    <Badge tone="warning" icon={<AlertTriangle size={12} />}>
                                        Droits incomplets : {issues[0].toLowerCase()}
                                    </Badge>
                                ) : (
                                    <Badge tone="accent" icon={<ShieldCheck size={12} />}>
                                        Droits déclarés · export autorisé
                                    </Badge>
                                )}
                            </div>
                        );
                    })}
                    <Button variant="ghost" size="sm" icon={<Plus size={15} />} onClick={onAdd} data-testid="vibecut-add-music">
                        Ajouter une autre piste
                    </Button>
                </>
            )}
        </div>
    );
}
