"use client";

import React from 'react';
import { Film, ImagePlus, Trash2, Upload } from 'lucide-react';
import { Button, Spinner } from '../primitives';
import SceneIllustration, { getSceneVariantForKey } from '../media/SceneIllustration';
import styles from './guided.module.css';

/*
 * Etape 1 - Medias.
 * La seule decision de l'ecran: quels fichiers entrent dans la video.
 * L'ordre, les durees et les effets viennent apres.
 */

function formatSeconds(value) {
    const safe = Math.max(0, Number(value) || 0);
    return safe >= 10 ? `${Math.round(safe)} s` : `${Math.round(safe * 10) / 10} s`;
}

export default function StepMedia({
    scenes,
    isImporting,
    isDropActive,
    onPickMedia,
    onRemoveScene,
}) {
    const hasScenes = scenes.length > 0;

    /*
     * Tant qu'il n'y a rien, la zone de depot occupe l'ecran: c'est la seule
     * chose a faire. Des qu'il y a des scenes, ce sont elles qu'on veut voir en
     * premier, et l'ajout redevient une simple action.
     */
    if (!hasScenes) {
        return (
            <div
                className={[styles.dropZone, isDropActive ? styles.dropZoneActive : ''].filter(Boolean).join(' ')}
                data-testid="vibecut-guided-drop-zone"
            >
                <span className={styles.dropIcon}>
                    {isImporting ? <Spinner /> : <Upload size={22} />}
                </span>
                <h2 className={styles.dropTitle}>Dépose tes photos et tes vidéos</h2>
                <p className={styles.dropHint}>
                    Chaque fichier devient une scène. VibeCut s’occupe ensuite des durées, des
                    mouvements et des enchaînements — tout reste modifiable après.
                </p>
                <Button
                    variant="primary"
                    size="lg"
                    icon={<ImagePlus size={18} />}
                    onClick={onPickMedia}
                    data-testid="vibecut-guided-import"
                >
                    Choisir des médias
                </Button>
                <p className={styles.dropFormats}>JPG, PNG, WebP, MP4, WebM, MOV</p>
            </div>
        );
    }

    return (
        <>
            <section className={styles.panelSection} aria-labelledby="vibecut-guided-medias-title">
                <div className={styles.panelSectionHead}>
                    <h3 className={styles.sectionTitle} id="vibecut-guided-medias-title">
                        {scenes.length} scène{scenes.length > 1 ? 's' : ''}
                    </h3>
                    <p className={styles.sectionHint}>Dans l’ordre d’import</p>
                </div>
                <div className={styles.mediaGrid} data-testid="vibecut-guided-media-grid">
                        {scenes.map((scene) => (
                            <div
                                key={scene.id}
                                className={styles.mediaCard}
                                style={{ '--vc-stagger': scene.index }}
                                data-testid={`vibecut-guided-media-${scene.index}`}
                            >
                                <span className={styles.mediaThumb}>
                                    {scene.thumbnail ? (
                                        <img src={scene.thumbnail} alt="" />
                                    ) : (
                                        <SceneIllustration variant={getSceneVariantForKey(scene.id)} />
                                    )}
                                    <span className={styles.mediaIndex}>{scene.index + 1}</span>
                                    <button
                                        type="button"
                                        className={styles.mediaRemove}
                                        onClick={() => onRemoveScene(scene.id)}
                                        aria-label={`Retirer la scène ${scene.index + 1}`}
                                        title={`Retirer la scène ${scene.index + 1}`}
                                        data-testid={`vibecut-guided-media-remove-${scene.index}`}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </span>
                                <span className={styles.mediaFooter}>
                                    <span className={styles.mediaName}>{scene.name}</span>
                                    <span className={styles.mediaDuration} data-numeric="true">
                                        {scene.isImage ? <ImagePlus size={12} /> : <Film size={12} />}
                                        {' '}
                                        {formatSeconds(scene.duration)}
                                    </span>
                                </span>
                            </div>
                    ))}
                </div>
            </section>

            <div
                className={[styles.addZone, isDropActive ? styles.dropZoneActive : ''].filter(Boolean).join(' ')}
                data-testid="vibecut-guided-drop-zone"
            >
                <span className={styles.addZoneIcon}>
                    {isImporting ? <Spinner /> : <Upload size={16} />}
                </span>
                <span className={styles.addZoneText}>
                    Glisse d’autres fichiers ici, ou choisis-les sur ton appareil.
                </span>
                <Button
                    variant="secondary"
                    icon={<ImagePlus size={16} />}
                    onClick={onPickMedia}
                    data-testid="vibecut-guided-import"
                >
                    Ajouter des médias
                </Button>
            </div>
        </>
    );
}
