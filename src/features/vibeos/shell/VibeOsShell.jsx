"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clapperboard, Eye, Home, LayoutGrid, Music, Send, Sparkles } from 'lucide-react';
import { VibeOsAudioProvider } from '../audio/AudioProvider';
import { VibeOsProjectProvider } from '../project/VibeOsProjectProvider';
import { ToastProvider } from '../primitives';
import MiniPlayer from './MiniPlayer';
import PublishButton from './PublishButton';
import styles from './shell.module.css';

/*
 * Un seul bandeau superieur pour tout VibeOS (plan §3.5).
 * Les actions propres a un ecran vivent DANS l'ecran, jamais ici - c'est la
 * regle qui a supprime les doubles headers de l'ancienne interface.
 * Sur mobile, la navigation passe dans une tab bar basse fixe.
 */

const cx = (...values) => values.filter(Boolean).join(' ');

const SPACES = [
    { href: '/creer/layout-visuel', label: 'Layout', icon: LayoutGrid },
    { href: '/creer/studio', label: 'Studio', icon: Sparkles },
    { href: '/creer/vision', label: 'Vision', icon: Eye },
    { href: '/creer/son', label: 'Soundtrack', icon: Music },
    { href: '/video', label: 'VibeCut', icon: Clapperboard },
];

const MOBILE_TABS = [
    { href: '/creer', label: 'Accueil', icon: Home, exact: true },
    { href: '/creer/layout-visuel', label: 'Layout', icon: LayoutGrid },
    { href: '/creer/studio', label: 'Studio', icon: Sparkles },
    { href: '/creer/vision', label: 'Vision', icon: Eye },
    { href: '/creer/son', label: 'Son', icon: Music },
];

function isActivePath(pathname, href, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function VibeOsShell({ children }) {
    const pathname = usePathname() || '';

    return (
        <VibeOsProjectProvider>
            <VibeOsAudioProvider>
                <div className={`vibeos ${styles.root}`} data-vibeos-shell="true" data-theme="dark">
                    <ToastProvider>
                        <header className={styles.topbar}>
                            <div className={styles.leading}>
                                <Link href="/creer" className={styles.brand} data-testid="vibeos-brand-home">
                                    <span className={styles.brandMark} aria-hidden="true">
                                        <Sparkles size={14} />
                                    </span>
                                    VibeOS
                                </Link>
                            </div>

                            <div className={styles.center}>
                                <nav className={styles.nav} aria-label="Espaces de création">
                                    {SPACES.map((space) => {
                                        const Icon = space.icon;
                                        const active = isActivePath(pathname, space.href);
                                        return (
                                            <Link
                                                key={space.href}
                                                href={space.href}
                                                className={cx(styles.navItem, active && styles.navItemActive)}
                                                aria-current={active ? 'page' : undefined}
                                            >
                                                <Icon size={13} />
                                                {space.label}
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </div>

                            <div className={styles.trailing}>
                                <MiniPlayer />
                                <PublishButton />
                            </div>
                        </header>

                        <div className={styles.content}>{children}</div>

                        <nav className={styles.tabbar} aria-label="Navigation VibeOS">
                            {MOBILE_TABS.map((tab) => {
                                const Icon = tab.icon;
                                const active = isActivePath(pathname, tab.href, tab.exact);
                                return (
                                    <Link
                                        key={tab.href}
                                        href={tab.href}
                                        className={cx(styles.tabbarItem, active && styles.tabbarItemActive)}
                                        aria-current={active ? 'page' : undefined}
                                    >
                                        <Icon size={18} />
                                        {tab.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </ToastProvider>
                </div>
            </VibeOsAudioProvider>
        </VibeOsProjectProvider>
    );
}
