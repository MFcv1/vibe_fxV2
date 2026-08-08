"use client";

import React from 'react';
import Link from 'next/link';
import { Hammer } from 'lucide-react';
import { Badge, EmptyState } from '../primitives';

/*
 * Ecran provisoire d'un espace en construction (phase A du plan).
 * Chaque espace le remplace par son vrai ecran dans sa phase (B a E).
 */
export default function SpacePlaceholder({ title, phase, children }) {
    return (
        <main
            style={{
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                width: '100%',
                maxWidth: 620,
                margin: '0 auto',
                padding: 'var(--vo-space-10) var(--vo-space-6)',
                gap: 'var(--vo-space-4)',
            }}
        >
            <EmptyState
                icon={<Hammer size={20} />}
                title={title}
                action={(
                    <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                        <Badge tone="accent">Arrive en phase {phase}</Badge>
                        <Link
                            href="/creer"
                            style={{ color: 'var(--vo-accent)', fontSize: 'var(--vo-text-sm)', fontWeight: 550 }}
                        >
                            Retour à l&apos;accueil
                        </Link>
                    </span>
                )}
            >
                {children}
            </EmptyState>
        </main>
    );
}
