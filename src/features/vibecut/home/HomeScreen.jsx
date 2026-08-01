"use client";

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronRight, Film, Plus } from 'lucide-react';
import { Button, Card, EmptyState, Spinner } from '../primitives';
import useProjectLibrary from '../adapters/useProjectLibrary';
import { getAvailableMotions, MOTION_CATALOG } from '../data/motionCatalog';
import { getFeaturedTransitions } from '../data/transitionCatalog';
import { AdvancedMock, GuidedMock, QuickMock } from './ModeMockups';
import { MotionTile, TransitionTile } from './LibraryTiles';
import RecentProjects from './RecentProjects';
import styles from './home.module.css';

const MODES = [
    {
        id: 'rapide',
        href: '/video/rapide',
        title: 'Montage rapide',
        description: 'Assemble tes scènes, règle les durées et exporte. Sans timeline.',
        Mock: QuickMock,
    },
    {
        id: 'guide',
        href: '/video/guide',
        title: 'Création guidée',
        description: 'VibeCut te pose les bonnes questions et construit un premier montage.',
        Mock: GuidedMock,
    },
    {
        id: 'avance',
        href: '/video/avance',
        title: 'Montage avancé',
        description: 'Timeline multipiste, inspecteur, colorimétrie, export jusqu’à 60 fps.',
        Mock: AdvancedMock,
    },
];

// Les 8 mouvements mis en avant: d'abord ceux reellement applicables aujourd'hui.
const FEATURED_MOTIONS = [
    ...getAvailableMotions().filter((motion) => motion.id !== 'none'),
    ...MOTION_CATALOG.filter((motion) => motion.availability === 'planned'),
].slice(0, 8);

const FEATURED_TRANSITIONS = getFeaturedTransitions(8);

export default function HomeScreen() {
    const router = useRouter();
    const { projects, isLoading, isEmpty, error, createProject, removeProject } = useProjectLibrary();
    const [creating, setCreating] = useState(false);

    const handleCreate = useCallback(async () => {
        setCreating(true);
        try {
            const created = await createProject();
            router.push(`/video/rapide?project=${encodeURIComponent(created.id)}`);
        } catch {
            setCreating(false);
        }
    }, [createProject, router]);

    const handleDelete = useCallback(async (id) => {
        try {
            await removeProject(id);
        } catch {
            // L'erreur reste visible via l'etat de la bibliotheque au prochain refresh.
        }
    }, [removeProject]);

    return (
        <div className={styles.page} data-testid="vibecut-home">
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <h1 className={styles.heroTitle}>Créer une vidéo</h1>
                    <p className={styles.heroSubtitle}>
                        Choisis ta façon de travailler. Tes projets restent les mêmes d’un mode à l’autre.
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="lg"
                    className={styles.heroAction}
                    onClick={handleCreate}
                    disabled={creating}
                    icon={creating ? <Spinner /> : <Plus size={18} />}
                    data-testid="vibecut-new-project"
                >
                    Nouveau projet
                </Button>
            </section>

            <section className={styles.section} aria-labelledby="vibecut-modes-title">
                <div className={styles.sectionHead}>
                    <h2 className={styles.sectionTitle} id="vibecut-modes-title">Modes de montage</h2>
                </div>
                <div className={styles.modes}>
                    {MODES.map(({ id, href, title, description, Mock }) => (
                        <Card key={id} as={Link} href={href} interactive className={styles.modeCard} data-testid={`vibecut-mode-${id}`}>
                            <span className={styles.modeStage}>
                                <Mock />
                            </span>
                            <span className={styles.modeBody}>
                                <span>
                                    <span className={styles.modeTitle}>{title}</span>
                                    <span className={styles.modeDescription}>{description}</span>
                                </span>
                                <span className={styles.modeArrow} aria-hidden="true">
                                    <ArrowRight size={16} />
                                </span>
                            </span>
                        </Card>
                    ))}
                </div>
            </section>

            <section className={styles.libraries}>
                <div className={styles.section} aria-labelledby="vibecut-motions-title">
                    <div className={styles.sectionHead}>
                        <div>
                            <h2 className={styles.sectionTitle} id="vibecut-motions-title">Mouvements</h2>
                            <p className={styles.sectionHint}>Donne vie à tes photos et à tes plans fixes</p>
                        </div>
                        <Link href="/video/mouvements" className={styles.sectionLink} data-testid="vibecut-open-motions">
                            Tout voir <ChevronRight size={14} />
                        </Link>
                    </div>
                    <div className={styles.tileRow}>
                        {FEATURED_MOTIONS.map((motion, index) => (
                            <MotionTile key={motion.id} motion={motion} index={index} href="/video/mouvements" />
                        ))}
                    </div>
                </div>

                <div className={styles.section} aria-labelledby="vibecut-transitions-title">
                    <div className={styles.sectionHead}>
                        <div>
                            <h2 className={styles.sectionTitle} id="vibecut-transitions-title">Transitions</h2>
                            <p className={styles.sectionHint}>Enchaîne tes scènes avec la bonne intention</p>
                        </div>
                        <Link href="/video/transitions" className={styles.sectionLink} data-testid="vibecut-open-transitions">
                            Tout voir <ChevronRight size={14} />
                        </Link>
                    </div>
                    <div className={styles.tileRow}>
                        {FEATURED_TRANSITIONS.map((transition, index) => (
                            <TransitionTile key={transition.id} transition={transition} index={index} href="/video/transitions" />
                        ))}
                    </div>
                </div>
            </section>

            <section className={styles.section} aria-labelledby="vibecut-projects-title">
                <div className={styles.sectionHead}>
                    <h2 className={styles.sectionTitle} id="vibecut-projects-title">Projets récents</h2>
                    {projects.length > 0 ? (
                        <p className={styles.sectionHint}>
                            {projects.length} projet{projects.length > 1 ? 's' : ''} sur cet appareil
                        </p>
                    ) : null}
                </div>

                {error ? (
                    <p className={styles.errorNote} role="alert" data-testid="vibecut-projects-error">{error}</p>
                ) : isLoading ? (
                    <div className={styles.loadingGrid} data-testid="vibecut-projects-loading">
                        <span className={styles.skeleton} />
                        <span className={styles.skeleton} />
                        <span className={styles.skeleton} />
                    </div>
                ) : isEmpty ? (
                    <EmptyState
                        icon={<Film size={22} />}
                        title="Aucun projet pour l’instant"
                        action={(
                            <Button variant="primary" onClick={handleCreate} disabled={creating} icon={<Plus size={16} />}>
                                Créer mon premier projet
                            </Button>
                        )}
                    >
                        Tes projets sont enregistrés sur cet appareil et réapparaîtront ici automatiquement.
                    </EmptyState>
                ) : (
                    <RecentProjects projects={projects} onDelete={handleDelete} />
                )}
            </section>
        </div>
    );
}
