"use client";

import React from 'react';
import Link from 'next/link';
import { Images, Layers, Sparkles } from 'lucide-react';
import styles from './pipelineSourceNote.module.css';

/*
 * Une ligne, toujours au meme endroit: sur QUOI l'ecran travaille.
 * C'est la partie visible du pipeline (plan §4.3) - sans elle, l'utilisateur ne
 * sait pas si son look s'applique a sa composition ou a une photo isolee.
 *
 * `kind`  : 'composition' | 'photo' | 'import' | null
 * `stage` : 'vision' | 'studio' - change seulement la phrase de fin.
 */
export default function PipelineSourceNote({ kind, stage = 'vision', visionApplied = false, testId }) {
    if (!kind) return null;

    const isComposition = kind === 'composition';
    const Icon = isComposition ? Layers : Images;

    let text;
    if (isComposition) {
        text = 'Tu travailles sur ta composition Mise en page.';
    } else if (kind === 'photo') {
        text = 'Tu travailles sur la photo de ton projet.';
    } else {
        text = 'Tu travailles sur la photo importée ici.';
    }

    return (
        <p className={styles.note} data-testid={testId} data-source-kind={kind}>
            <Icon size={13} />
            <span>
                {text}
                {stage === 'studio' && visionApplied ? (
                    <>
                        {' '}
                        <Sparkles size={11} aria-hidden="true" />
                        {' '}
                        Ton réglage Vision est déjà appliqué dessus.
                    </>
                ) : null}
                {isComposition ? (
                    <>
                        {' '}
                        <Link href="/creer/layout-visuel" className={styles.link}>
                            Modifier la composition
                        </Link>
                    </>
                ) : null}
            </span>
        </p>
    );
}
