"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Film, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Card, IconButton } from '../primitives';
import { formatProjectDate, formatProjectDuration } from '../services/projectLibrary';
import styles from './home.module.css';

function ProjectCard({ project, onDelete }) {
    const [confirming, setConfirming] = useState(false);
    const sceneLabel = project.sceneCount === 0
        ? 'Vide'
        : `${project.sceneCount} scène${project.sceneCount > 1 ? 's' : ''}`;

    return (
        <Card interactive className={styles.projectCard} data-testid={`vibecut-project-card-${project.id}`}>
            <div className={styles.projectPoster}>
                {project.poster ? (
                    <img src={project.poster} alt="" />
                ) : (
                    <span className={styles.projectPosterEmpty}>
                        <Film size={22} />
                    </span>
                )}
                {project.sceneCount > 0 ? (
                    <span className={styles.projectDuration} data-numeric="true">
                        {formatProjectDuration(project.durationSeconds)}
                    </span>
                ) : null}
            </div>

            <div className={styles.projectBody}>
                <div style={{ minWidth: 0 }}>
                    <p className={styles.projectName}>{project.name}</p>
                    <p className={styles.projectMeta}>
                        {sceneLabel} · {formatProjectDate(project.savedAt)}
                    </p>
                </div>

                <div className={styles.projectActions}>
                    {confirming ? (
                        <>
                            <IconButton
                                label="Confirmer la suppression"
                                onClick={() => { setConfirming(false); onDelete?.(project.id); }}
                                data-testid={`vibecut-project-delete-confirm-${project.id}`}
                            >
                                <Check size={16} />
                            </IconButton>
                            <IconButton label="Annuler" onClick={() => setConfirming(false)}>
                                <X size={16} />
                            </IconButton>
                        </>
                    ) : (
                        <>
                            <Link
                                href={`/video/avance?project=${encodeURIComponent(project.id)}`}
                                className={styles.iconAction}
                                title="Ouvrir en montage avancé"
                                aria-label="Ouvrir en montage avancé"
                                data-testid={`vibecut-project-open-advanced-${project.id}`}
                            >
                                <SlidersHorizontal size={16} />
                            </Link>
                            <IconButton
                                label="Supprimer le projet"
                                onClick={() => setConfirming(true)}
                                data-testid={`vibecut-project-delete-${project.id}`}
                            >
                                <Trash2 size={16} />
                            </IconButton>
                        </>
                    )}
                </div>
            </div>

            {confirming ? null : (
                <Link
                    href={`/video/rapide?project=${encodeURIComponent(project.id)}`}
                    className={styles.projectOpen}
                    aria-label={`Ouvrir ${project.name}`}
                    data-testid={`vibecut-project-open-${project.id}`}
                />
            )}
        </Card>
    );
}

export default function RecentProjects({ projects = [], onDelete }) {
    return (
        <div className={styles.projectGrid} data-testid="vibecut-recent-projects">
            {projects.map((project) => (
                <ProjectCard key={project.id} project={project} onDelete={onDelete} />
            ))}
        </div>
    );
}
