"use client";

import React, { useState } from 'react';
import {
    ArrowUpRight, Blend, CircleDotDashed, Sparkles, Trash2,
} from 'lucide-react';
import { Button } from '../primitives';
import GradientSheet from '../shared/GradientSheet';
import LumenSheet from '../shared/LumenSheet';
import useStudioGenerators from './useStudioGenerators';
import styles from './studio.module.css';

const MODULES = [
    {
        id: 'gradient',
        index: '01',
        title: 'Gradient',
        description: 'Compose des dégradés précis, des formes et des affiches graphiques.',
        meta: '28 moteurs · Export animé',
        icon: Blend,
    },
    {
        id: 'lumen',
        index: '02',
        title: 'Lumen',
        description: 'Sculpte la lumière, la matière et des shaders vivants en temps réel.',
        meta: 'Shader studio · Temps réel',
        icon: CircleDotDashed,
    },
];

export default function StudioScreen() {
    const [openModule, setOpenModule] = useState(null);
    const {
        activeGenerator,
        activeName,
        applyGeneratedBackground,
        clearGeneratedBackground,
    } = useStudioGenerators();

    return (
        <main className={styles.screen} data-testid="vibeos-studio-screen">
            <div className={styles.ambient} aria-hidden="true" />

            <header className={styles.hero}>
                <div className={styles.eyebrow}>
                    <Sparkles size={14} aria-hidden="true" />
                    <span>Studio créatif</span>
                </div>
                <h1 className={styles.title}>Crée tes fonds, en grand.</h1>
                <p className={styles.intro}>
                    Deux outils complets, chacun dans son propre espace. Choisis une matière,
                    ouvre l’éditeur et utilise le résultat dans ton projet VibeOS.
                </p>

                {activeGenerator ? (
                    <div className={styles.activeBar} data-testid="vibeos-studio-active-background">
                        <span className={styles.activePulse} aria-hidden="true" />
                        <span className={styles.activeCopy}>
                            <strong>{activeName || 'Fond généré'}</strong>
                            <span>{activeGenerator === 'gradient' ? 'Gradient' : 'Lumen'} est actif dans le projet</span>
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 size={13} />}
                            onClick={clearGeneratedBackground}
                        >
                            Retirer
                        </Button>
                    </div>
                ) : null}
            </header>

            <section className={styles.moduleGrid} aria-label="Éditeurs créatifs">
                {MODULES.map((module) => {
                    const Icon = module.icon;
                    const active = activeGenerator === module.id;
                    return (
                        <button
                            key={module.id}
                            type="button"
                            className={styles.moduleCard}
                            data-active={active ? 'true' : 'false'}
                            data-testid={`vibeos-studio-module-${module.id}`}
                            aria-label={`Ouvrir ${module.title} en plein écran`}
                            onClick={() => setOpenModule(module.id)}
                        >
                            <span className={styles.moduleVisual} aria-hidden="true">
                                {module.id === 'gradient' ? (
                                    <span className={styles.gradientScene}>
                                        <span className={styles.gradientGlowA} />
                                        <span className={styles.gradientGlowB} />
                                        <span className={styles.gradientGlowC} />
                                        <span className={styles.gradientHandleA} />
                                        <span className={styles.gradientHandleB} />
                                        <span className={styles.gradientHandleC} />
                                    </span>
                                ) : (
                                    <span className={styles.lumenScene}>
                                        <span className={styles.lumenHalo} />
                                        <span className={styles.lumenBody} />
                                        <span className={styles.lumenRay} />
                                        <span className={styles.lumenGrid} />
                                    </span>
                                )}
                                <span className={styles.visualChrome}>
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </span>

                            <span className={styles.moduleBody}>
                                <span className={styles.moduleTopline}>
                                    <span className={styles.moduleIndex}>{module.index}</span>
                                    {active ? <span className={styles.activeBadge}>Actif</span> : null}
                                </span>
                                <span className={styles.moduleTitleRow}>
                                    <span className={styles.moduleIcon}><Icon size={18} /></span>
                                    <strong>{module.title}</strong>
                                    <ArrowUpRight className={styles.moduleArrow} size={19} />
                                </span>
                                <span className={styles.moduleDescription}>{module.description}</span>
                                <span className={styles.moduleMeta}>{module.meta}</span>
                            </span>
                        </button>
                    );
                })}
            </section>

            <p className={styles.footerHint}>
                Les éditeurs s’ouvrent en plein écran. Échap te ramène au Studio.
            </p>

            <GradientSheet
                open={openModule === 'gradient'}
                onClose={() => setOpenModule(null)}
                onUseBackground={applyGeneratedBackground}
            />
            <LumenSheet
                open={openModule === 'lumen'}
                onClose={() => setOpenModule(null)}
                onUseBackground={applyGeneratedBackground}
                immersive
            />
        </main>
    );
}
