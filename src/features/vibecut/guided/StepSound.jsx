"use client";

import React from 'react';
import { Music, Plus, ShieldCheck, Trash2, Type } from 'lucide-react';
import { Badge, Button, IconButton } from '../primitives';
import { describeTitleStyle } from '../data/styleRecipes';
import styles from './guided.module.css';

/*
 * Etape 4 - Son et textes.
 * Deux ajouts facultatifs, tous deux reellement rendus a l'export:
 * une musique (avec sa declaration de droits, exigee par le manifeste d'export)
 * et un titre d'ouverture sur la premiere scene.
 *
 * Depuis le lot L5, le PRESET habille les deux: taille, position, lisibilite et
 * casse du titre, fondus d'entree et de sortie de la musique. L'ecran annonce ce
 * traitement, parce qu'un reglage applique sans etre dit se lit comme un bug.
 */

export default function StepSound({
    audioTracks,
    onOpenMusic,
    onRemoveMusic,
    titleOverlay,
    titleDraft,
    onTitleDraftChange,
    onAddTitle,
    onRemoveTitle,
    titleStyle = null,
    audioProfile = null,
    styleName = '',
}) {
    const titleTreatment = describeTitleStyle(titleStyle);
    return (
        <>
            <section className={styles.panelSection} aria-labelledby="vibecut-guided-music-title">
                <div className={styles.panelSectionHead}>
                    <h3 className={styles.sectionTitle} id="vibecut-guided-music-title">Musique</h3>
                    <p className={styles.sectionHint}>Facultatif</p>
                </div>

                <div className={styles.blockList} data-testid="vibecut-guided-music">
                    {audioTracks.map((track) => (
                        <div key={track.id} className={styles.block}>
                            <div className={styles.blockHead}>
                                <span className={styles.blockIcon}><Music size={16} /></span>
                                <span className={styles.blockText}>
                                    <span className={styles.blockTitle}>{track.name}</span>
                                    <span className={styles.blockHint}>{track.license || 'Licence non précisée'}</span>
                                </span>
                                <Badge tone="accent" icon={<ShieldCheck size={12} />}>Droits déclarés</Badge>
                                <IconButton
                                    label={`Retirer la musique ${track.name}`}
                                    onClick={() => onRemoveMusic(track.id)}
                                    data-testid={`vibecut-guided-music-remove-${track.id}`}
                                >
                                    <Trash2 size={15} />
                                </IconButton>
                            </div>
                        </div>
                    ))}

                    {audioTracks.length === 0 ? (
                        <div className={styles.block}>
                            <div className={styles.blockHead}>
                                <span className={styles.blockIcon}><Music size={16} /></span>
                                <span className={styles.blockText}>
                                    <span className={styles.blockTitle}>Ajouter une musique</span>
                                    <span className={styles.blockHint} data-testid="vibecut-guided-audio-profile">
                                        {audioProfile
                                            ? `${styleName} pose ${audioProfile.fadeIn} s de fondu d’entrée et `
                                                + `${audioProfile.fadeOut} s de fondu de sortie.`
                                            : 'Un fondu de sortie d’une seconde est ajouté automatiquement.'}
                                    </span>
                                </span>
                                <Button
                                    variant="secondary"
                                    icon={<Plus size={16} />}
                                    onClick={onOpenMusic}
                                    data-testid="vibecut-guided-add-music"
                                >
                                    Choisir un fichier
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>

            <section className={styles.panelSection} aria-labelledby="vibecut-guided-title-title">
                <div className={styles.panelSectionHead}>
                    <h3 className={styles.sectionTitle} id="vibecut-guided-title-title">Titre d’ouverture</h3>
                    <p className={styles.sectionHint}>Facultatif</p>
                </div>

                <div className={styles.block}>
                    <div className={styles.blockHead}>
                        <span className={styles.blockIcon}><Type size={16} /></span>
                        <span className={styles.blockText}>
                            <span className={styles.blockTitle}>
                                {titleOverlay ? 'Titre affiché sur la première scène' : 'Ajouter un titre'}
                            </span>
                            <span className={styles.blockHint} data-testid="vibecut-guided-title-treatment">
                                {titleTreatment
                                    ? `${styleName} l’habille : ${titleTreatment}. Tout se règle ensuite `
                                        + 'dans le montage rapide.'
                                    : 'Apparaît en fondu au début de la vidéo.'}
                            </span>
                        </span>
                    </div>

                    <div className={styles.titleField}>
                        {/*
                          * Le champ porte le texte BRUT, pas le texte rendu: c'est
                          * lui qui permet a la mise en capitales d'un preset de
                          * rester reversible quand on change d'avis.
                          */}
                        <input
                            className={styles.textInput}
                            value={titleDraft}
                            placeholder="Le titre de ta vidéo"
                            aria-label="Titre d’ouverture"
                            onChange={(event) => onTitleDraftChange(event.target.value)}
                            data-testid="vibecut-guided-title-input"
                        />
                        {titleOverlay ? (
                            <Button
                                variant="ghost"
                                icon={<Trash2 size={16} />}
                                onClick={() => onRemoveTitle(titleOverlay.id)}
                                data-testid="vibecut-guided-title-remove"
                            >
                                Retirer
                            </Button>
                        ) : (
                            <Button
                                variant="secondary"
                                icon={<Plus size={16} />}
                                onClick={onAddTitle}
                                disabled={!titleDraft.trim()}
                                data-testid="vibecut-guided-title-add"
                            >
                                Ajouter
                            </Button>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
