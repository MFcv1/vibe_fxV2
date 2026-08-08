"use client";

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Button, useToast } from '../primitives';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';
import { buildPublicationPayload } from '../project/publishProject';
import { setPendingPublication } from '../project/publishHandoff';
import styles from './shell.module.css';

/*
 * « Publier » (plan §3.5 et §4.3, phase F).
 *
 * Le bouton rend le projet en suivant le pipeline (composition -> Vision ->
 * Studio), depose le resultat dans le relais, puis ouvre `/publier` : la page
 * qui monte le composeur de publication EXISTANT. Rien de la publication n'est
 * reecrit ici.
 */
export default function PublishButton() {
    const router = useRouter();
    const { project } = useVibeOsProject();
    const { push } = useToast();
    const [isPreparing, setIsPreparing] = useState(false);

    const hasSomethingToPublish = Boolean(
        project?.composition?.blob || (project?.images || []).length,
    );

    const handlePublish = useCallback(async () => {
        if (!project || isPreparing) return;
        setIsPreparing(true);
        try {
            const payload = await buildPublicationPayload(project);
            if (!payload) {
                push('Il n’y a encore rien à publier : compose un visuel ou importe une photo.');
                return;
            }
            setPendingPublication(payload);
            router.push('/publier');
        } catch {
            push('La préparation de la publication a échoué. Réessaie dans un instant.');
        } finally {
            setIsPreparing(false);
        }
    }, [project, isPreparing, push, router]);

    return (
        <Button
            variant="primary"
            size="sm"
            icon={<Send size={13} />}
            onClick={handlePublish}
            disabled={!hasSomethingToPublish || isPreparing}
            title="Préparer la publication de ce projet"
            /* Le libelle disparait sur mobile: le bouton garde un nom accessible. */
            aria-label="Publier"
            data-testid="vibeos-publish"
        >
            <span className={styles.publishLabel}>
                {isPreparing ? 'Préparation…' : 'Publier'}
            </span>
        </Button>
    );
}
