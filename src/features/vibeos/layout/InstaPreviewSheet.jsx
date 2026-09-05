"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { Sheet } from '../primitives';
import InstagramPublicationPreview, { InstagramStoryPreview } from './InstagramPublicationPreview';
import PostImagesRail from './PostImagesRail';
import PreviewPlayerBar from './PreviewPlayerBar';
import PreviewSoundPanel from './PreviewSoundPanel';
import styles from './layout.module.css';

const CLE_MODE = 'vibeos.apercu.mode';

/*
 * Apercu en plein cadre (mode `immersive` de Sheet): le bandeau VibeOS reste
 * visible, tout le dessous est donne a l'apercu. Trois colonnes: les images du
 * post a gauche, l'iPhone au centre, l'ambiance sonore a droite.
 *
 * Le mode immersive n'a pas d'en-tete de sheet: le titre et son filet de
 * separation disparaissent, il ne reste que le bouton fermer flottant.
 */
export default function InstaPreviewSheet({ open, onClose, slides = [], format, loading = false, error = '' }) {
    const [activeIndex, setActiveIndex] = useState(0);
    /* « grand » = le telephone prend toute la hauteur, la barre n'est pas
       rendue du tout. « ecoute » = 72px pour les commandes. La preference est
       retenue: c'est un choix de confort, pas une question a reposer. */
    const [mode, setMode] = useState(() => {
        /* Lu a l'initialisation plutot que dans un effet: pas de rendu en
           cascade, et pas de clignotement « grand » avant « ecoute ». Le sheet
           n'est jamais visible au rendu serveur, donc aucun risque de
           divergence d'hydratation. */
        if (typeof window === 'undefined') return 'grand';
        try {
            const enregistre = window.localStorage.getItem(CLE_MODE);
            return enregistre === 'ecoute' || enregistre === 'grand' ? enregistre : 'grand';
        } catch {
            return 'grand';
        }
    });
    const [pisteChoisie, setPisteChoisie] = useState(null);

    const choisirMode = useCallback((suivant) => {
        setMode(suivant);
        try {
            window.localStorage.setItem(CLE_MODE, suivant);
        } catch {
            /* Sans stockage, la preference ne vit que le temps de la session. */
        }
    }, []);

    const isStory = format?.id === 'story';
    const sliceCount = format?.id === 'pano-3' ? 3 : (format?.id === 'pano-2' ? 2 : 1);

    const galleryItems = useMemo(() => slides.map((slide, index) => ({
        id: `${format?.id || 'format'}-${slide.index ?? index}`,
        preview: slide.url,
        width: slide.width,
        height: slide.height,
    })), [format?.id, slides]);

    /* Changer de format rejoue le rendu: on revient a la premiere image. Reset
       pendant le rendu (pattern React officiel) plutot que dans un effet, qui
       provoquerait un rendu en cascade. */
    const stageKey = `${format?.id || 'format'}-${galleryItems.length}`;
    const [lastStageKey, setLastStageKey] = useState(stageKey);
    if (lastStageKey !== stageKey) {
        setLastStageKey(stageKey);
        setActiveIndex(0);
    }

    if (!open) return null;

    const ready = !loading && !error && galleryItems.length > 0;
    const caption = [
        format?.label || 'Format Instagram',
        `${format?.w || 0}×${format?.h || 0} px`,
        sliceCount > 1 ? `${sliceCount} slides 4:5` : (isStory ? 'Story 9:16' : 'Feed compatible'),
    ].join(' · ');

    return (
        <Sheet open={open} onClose={onClose} title="Aperçu Instagram" immersive>
            <div className={styles.previewStageGrid}>
                {ready && !isStory
                    ? <PostImagesRail items={galleryItems} activeIndex={activeIndex} onSelect={setActiveIndex} />
                    : <div className={styles.postRailPlaceholder} aria-hidden="true" />}

                <div className={styles.previewStageMain}>
                    <div className={styles.modeBascule} role="group" aria-label="Mode d'affichage">
                        <button
                            type="button"
                            aria-pressed={mode === 'grand'}
                            onClick={() => choisirMode('grand')}
                        >
                            Grand
                        </button>
                        <button
                            type="button"
                            aria-pressed={mode === 'ecoute'}
                            onClick={() => choisirMode('ecoute')}
                        >
                            Écoute
                        </button>
                    </div>
                    <div className={styles.previewStagePhone}>
                        {loading ? <div className={styles.previewState}>Préparation du rendu Instagram…</div> : null}
                        {error ? <div className={`${styles.previewState} ${styles.previewStateError}`}>{error}</div> : null}
                        {ready ? (
                            isStory
                                ? <InstagramStoryPreview key={`story-${format?.id}-${mode}`} item={galleryItems[0]} expanded />
                                : (
                                    /* `mode` fait partie de la cle: passer en ecoute retire 72px a
                                       l'emplacement du telephone, et ScaledStage ne mesure sa boite
                                       qu'au montage puis via son observateur. Remonter le composant
                                       garantit une echelle juste, sans course entre le rendu et
                                       l'observateur - c'est ce qui faisait deborder le telephone
                                       par-dessus la barre de lecture. */
                                    <InstagramPublicationPreview
                                        key={`${format?.id}-${galleryItems.length}-${mode}`}
                                        galleryItems={galleryItems}
                                        name="Ton visuel VibeFX"
                                        activeIndex={activeIndex}
                                        onActiveIndexChange={setActiveIndex}
                                        expanded
                                    />
                                )
                        ) : null}
                    </div>
                    {ready ? <p className={styles.previewStageCaption}>{caption}</p> : null}
                    {mode === 'ecoute' ? <PreviewPlayerBar piste={pisteChoisie} /> : null}
                </div>

                <PreviewSoundPanel onPisteJouee={setPisteChoisie} />
            </div>
        </Sheet>
    );
}
