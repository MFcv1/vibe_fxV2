"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Scissors } from 'lucide-react';
import { PreviewEngineProvider } from '../preview/PreviewEngineHost';
import styles from './shell.module.css';

/*
 * Un seul bandeau superieur pour tout VibeCut.
 * Les actions propres a un ecran vivent DANS l'ecran (a cote de son titre),
 * jamais dans ce bandeau: c'est ce qui evitait les doubles headers et les
 * controles dupliques de l'ancienne interface.
 */

const ROUTE_LABELS = [
    { match: /^\/video\/rapide/, label: 'Montage rapide' },
    { match: /^\/video\/guide/, label: 'Création guidée' },
    { match: /^\/video\/avance/, label: 'Montage avancé' },
    { match: /^\/video\/transitions/, label: 'Transitions' },
    { match: /^\/video\/mouvements/, label: 'Mouvements' },
];

function resolveContextLabel(pathname = '') {
    return ROUTE_LABELS.find((entry) => entry.match.test(pathname))?.label || null;
}

export default function VibeCutShell({ children }) {
    const pathname = usePathname() || '';
    const contextLabel = resolveContextLabel(pathname);
    const isHome = !contextLabel;

    return (
        <PreviewEngineProvider>
            <div className={`vibecut ${styles.root}`} data-vibecut-shell="true" data-theme="dark">
                <header className={styles.topbar}>
                    <div className={styles.leading}>
                        {isHome ? (
                            <span className={styles.brand}>
                                <span className={styles.brandMark} aria-hidden="true">
                                    <Scissors size={14} />
                                </span>
                                VibeCut
                            </span>
                        ) : (
                            <Link href="/video" className={styles.brand} data-testid="vibecut-brand-home">
                                <span className={styles.brandMark} aria-hidden="true">
                                    <Scissors size={14} />
                                </span>
                                VibeCut
                            </Link>
                        )}
                    </div>

                    <div className={styles.center}>
                        {contextLabel ? (
                            <span className={styles.contextLabel}>
                                <span className={styles.contextName}>{contextLabel}</span>
                            </span>
                        ) : null}
                    </div>

                    <div className={styles.trailing}>
                        <Link
                            href="/studio"
                            className={styles.backLink}
                            data-testid="vibecut-back-studio"
                            title="Revenir au studio Vibe_fx"
                        >
                            <ArrowLeft size={16} />
                            <span className={styles.backLabel}>Studio</span>
                        </Link>
                    </div>
                </header>

                <div className={styles.content}>{children}</div>
            </div>
        </PreviewEngineProvider>
    );
}
