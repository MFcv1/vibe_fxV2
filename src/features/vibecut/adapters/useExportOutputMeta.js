"use client";

/*
 * Format REEL du fichier produit: conteneur, codec, type MIME.
 *
 * Phase 7 (2026-08-01): l'ancien panneau d'export affichait ces trois valeurs et
 * a ete supprime. `resolveOutputMediaMetadata` s'est alors retrouve importe par
 * le controleur sans etre appele nulle part - autrement dit, le nouveau front
 * annoncait « MP4 » sans jamais relire ce que le rendu avait vraiment produit.
 *
 * C'est exactement le genre d'ecart que ce projet traque: on ne dit pas
 * « H.264/AAC » en dur, on lit le manifeste et la sortie du job. Une simulation
 * locale doit d'ailleurs annoncer « simulation », pas un faux MP4.
 */

import { useMemo } from 'react';
import { resolveOutputMediaMetadata } from '@/features/vibefx-studio/video/export/exportMediaMetadata';

export default function useExportOutputMeta({ job, manifest, activeMode }) {
    return useMemo(() => {
        const meta = resolveOutputMediaMetadata({
            render: job?.render || manifest?.render || {},
            output: job?.output || {},
            activeMode,
        });
        // L'ordre est celui que l'ancien panneau utilisait: on ne reeduque pas
        // l'utilisateur sur une information qu'il lisait deja.
        return [
            { label: 'Container', value: meta.container },
            { label: 'Codec', value: meta.codec },
            { label: 'MIME', value: meta.contentType },
        ];
    }, [activeMode, job, manifest]);
}
