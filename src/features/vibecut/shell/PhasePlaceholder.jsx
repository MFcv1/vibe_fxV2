"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Hammer } from 'lucide-react';
import { Button, EmptyState } from '../primitives';
import styles from './shell.module.css';

/*
 * Ecran d'attente honnete pendant la reconstruction.
 * Les liens de l'accueil ne doivent jamais tomber sur une 404, mais on n'affiche
 * pas non plus une fausse interface: on nomme l'ecran et ce qu'il contiendra.
 */

export default function PhasePlaceholder({ title, summary, features = [] }) {
    return (
        <div className={styles.placeholder} data-testid="vibecut-phase-placeholder">
            <EmptyState icon={<Hammer size={22} />} title={title}>
                {summary}
            </EmptyState>

            {features.length > 0 ? (
                <ul className={styles.placeholderList}>
                    {features.map((feature) => (
                        <li key={feature}>{feature}</li>
                    ))}
                </ul>
            ) : null}

            <Link href="/video">
                <Button variant="secondary" icon={<ArrowLeft size={16} />}>
                    Retour à l’accueil VibeCut
                </Button>
            </Link>
        </div>
    );
}
