"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clapperboard, Copy, Eye, ImageIcon, LayoutGrid, MoreHorizontal, Music, Play, Sparkles, Trash2 } from 'lucide-react';
import { Card, IconButton, useToast } from '../primitives';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';
import styles from './home.module.css';

/*
 * Accueil incubateur (plan §5.1): un hall d'accueil, pas un dashboard.
 * Reprendre le projet courant, choisir un espace, rouvrir un projet recent.
 */

const SPACES = [
    {
        href: '/creer/layout-visuel',
        icon: LayoutGrid,
        title: 'Layout',
        desc: 'Compose tes visuels : formats, modèles et templates prêts à poster.',
        visual: (
            <span className={styles.vLayout} aria-hidden="true">
                <span /><span /><span />
            </span>
        ),
    },
    {
        href: '/creer/studio',
        icon: Sparkles,
        title: 'Studio',
        desc: 'Ambiances, grain, effets et fonds générés en un clic.',
        visual: <span className={styles.vStudio} aria-hidden="true" />,
    },
    {
        href: '/creer/vision',
        icon: Eye,
        title: 'Vision',
        desc: 'Sublime tes photos de téléphone, sans jamais les casser.',
        visual: <span className={styles.vVision} aria-hidden="true" />,
    },
    {
        href: '/creer/son',
        icon: Music,
        title: 'Soundtrack',
        desc: 'Trouve ta musique : recherche, imports et bibliothèque.',
        visual: (
            <span className={styles.vSound} aria-hidden="true">
                <span /><span /><span /><span /><span /><span />
            </span>
        ),
    },
    {
        href: '/video',
        icon: Clapperboard,
        title: 'VibeCut',
        desc: 'Monte tes vidéos : rapide, guidé ou avancé.',
        visual: (
            <span className={styles.vCut} aria-hidden="true">
                <span /><span /><span />
            </span>
        ),
    },
];

function formatRelativeDate(timestamp) {
    if (!timestamp) return '';
    const deltaMs = Date.now() - timestamp;
    const minutes = Math.round(deltaMs / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.round(hours / 24);
    if (days === 1) return 'hier';
    if (days < 30) return `il y a ${days} jours`;
    return new Date(timestamp).toLocaleDateString('fr-FR');
}

function RecentCard({ recent, onOpen, onDuplicate, onDelete }) {
    const [menuOpen, setMenuOpen] = useState(false);

    /* Ferme le menu au clic ailleurs. */
    useEffect(() => {
        if (!menuOpen) return undefined;
        const close = () => setMenuOpen(false);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [menuOpen]);

    return (
        <div className={styles.recentCard}>
            <button
                type="button"
                className={styles.recentThumb}
                onClick={() => onOpen(recent.id)}
                title={`Ouvrir « ${recent.title} »`}
            >
                {recent.thumbnail ? <img src={recent.thumbnail} alt="" /> : <ImageIcon size={20} />}
            </button>
            <div className={styles.recentMetaRow}>
                <span className={styles.recentText}>
                    <span className={styles.recentTitle}>{recent.title}</span>
                    <span className={styles.recentDate}>{formatRelativeDate(recent.updatedAt)}</span>
                </span>
                <IconButton
                    label="Actions du projet"
                    onClick={(event) => {
                        event.stopPropagation();
                        setMenuOpen((current) => !current);
                    }}
                >
                    <MoreHorizontal size={15} />
                </IconButton>
            </div>
            {menuOpen ? (
                <div className={styles.recentMenu} role="menu" onClick={(event) => event.stopPropagation()}>
                    <button type="button" role="menuitem" className={styles.recentMenuItem} onClick={() => { setMenuOpen(false); onDuplicate(recent.id); }}>
                        <Copy size={14} />
                        Dupliquer
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        className={`${styles.recentMenuItem} ${styles.recentMenuItemDanger}`}
                        onClick={() => {
                            setMenuOpen(false);
                            if (window.confirm(`Supprimer « ${recent.title} » ? Cette action est définitive.`)) {
                                onDelete(recent.id);
                            }
                        }}
                    >
                        <Trash2 size={14} />
                        Supprimer
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export default function HomeScreen() {
    const { project, recents, openProject, duplicateProject, removeProject } = useVibeOsProject();
    const { push } = useToast();

    const handleOpen = async (id) => {
        const opened = await openProject(id);
        if (!opened) {
            push('Impossible de rouvrir ce projet.', { tone: 'danger' });
        }
    };

    const handleDuplicate = async (id) => {
        const copy = await duplicateProject(id);
        push(copy ? 'Projet dupliqué.' : 'La duplication a échoué.', { tone: copy ? 'success' : 'danger' });
    };

    const handleDelete = async (id) => {
        await removeProject(id);
        push('Projet supprimé.');
    };

    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <h1 className={styles.heroTitle}>Que veux-tu créer aujourd&apos;hui ?</h1>
                <p className={styles.heroSubtitle}>
                    VibeOS réunit tes espaces de création : visuels, ambiances, photos, musique et vidéo.
                </p>
            </header>

            {project ? (
                <Card as={Link} interactive href="/creer/layout-visuel" className={styles.resumeCard} data-testid="vibeos-resume">
                    <span className={styles.resumeThumb} aria-hidden="true">
                        {project.thumbnail ? <img src={project.thumbnail} alt="" /> : <ImageIcon size={18} />}
                    </span>
                    <span className={styles.resumeBody}>
                        <span className={styles.resumeTitle}>Reprendre « {project.title} »</span>
                        <span className={styles.resumeMeta}>Modifié {formatRelativeDate(project.updatedAt)}</span>
                    </span>
                    <span className={styles.resumeAction}>
                        <Play size={14} />
                        Reprendre
                    </span>
                </Card>
            ) : null}

            <section className={styles.section} aria-label="Espaces de création">
                <div className={styles.spaces}>
                    {SPACES.map((space) => {
                        const Icon = space.icon;
                        return (
                            <Card as={Link} interactive href={space.href} key={space.href} className={styles.spaceCard}>
                                <span className={styles.spaceStage}>{space.visual}</span>
                                <span className={styles.spaceBody}>
                                    <span className={styles.spaceText}>
                                        <span className={styles.spaceTitle}>
                                            <Icon size={15} />
                                            {space.title}
                                        </span>
                                        <span className={styles.spaceDesc}>{space.desc}</span>
                                    </span>
                                    <ArrowRight size={16} className={styles.spaceArrow} />
                                </span>
                            </Card>
                        );
                    })}
                </div>
            </section>

            {recents.length > 0 ? (
                <section className={styles.section} aria-label="Projets récents">
                    <h2 className={styles.sectionTitle}>Projets récents</h2>
                    <div className={styles.recents}>
                        {recents.map((recent) => (
                            <RecentCard
                                key={recent.id}
                                recent={recent}
                                onOpen={handleOpen}
                                onDuplicate={handleDuplicate}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </section>
            ) : null}
        </main>
    );
}
