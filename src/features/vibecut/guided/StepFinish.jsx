"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Download, Music, Type } from 'lucide-react';
import { Button } from '../primitives';
import { describeMontagePlan, describeTitleStyle } from '../data/styleRecipes';
import BeatStrip from './BeatStrip';
import styles from './guided.module.css';


/*
 * Etape 5 - Finaliser.
 * Le recapitulatif annonce l'etat REEL du projet (lu dans le montage apres
 * generation), pas les intentions du plan. Ensuite, trois sorties: exporter tout
 * de suite, ou continuer dans l'un des deux autres modes sur le meme projet.
 */

export default function StepFinish({
    plan,
    scenes,
    totalDuration,
    formatLabel,
    audioTracks,
    titleOverlay,
    projectQuery,
    onOpenExport,
}) {
    /*
     * Le recapitulatif est relu du montage lui-meme. C'est la seule facon
     * d'annoncer ce qui a vraiment ete applique - et donc de detecter une
     * generation partielle au lieu de la masquer.
     */
    const imageDurations = scenes.filter((scene) => scene.isImage).map((scene) => Number(scene.duration) || 0);
    const posedTransitions = scenes.map((scene) => scene.transitionToNext).filter(Boolean);
    const applied = {
        sceneCount: scenes.length,
        totalDuration: Number(totalDuration) || 0,
        // Une seule duree par photo n'a plus de sens depuis le lot L2: la
        // partition en produit une par plan. On relit l'amplitude obtenue.
        shortestImage: imageDurations.length ? Math.min(...imageDurations) : plan.shortestImage,
        longestImage: imageDurations.length ? Math.max(...imageDurations) : plan.longestImage,
        transitionCount: posedTransitions.length,
        transitionTypes: [...new Set(posedTransitions.map((transition) => transition.type).filter(Boolean))],
    };
    const rows = describeMontagePlan(plan, applied);

    return (
        <>
            <section className={styles.panelSection} aria-labelledby="vibecut-guided-summary-title">
                <div className={styles.panelSectionHead}>
                    <h3 className={styles.sectionTitle} id="vibecut-guided-summary-title">Ton montage</h3>
                    <p className={styles.sectionHint}>{formatLabel}</p>
                </div>

                <div className={styles.summary} data-testid="vibecut-guided-summary">
                    {rows.map((row, index) => (
                        <div
                            key={row.id}
                            className={styles.summaryRow}
                            style={{ '--vc-stagger': index }}
                            data-testid={`vibecut-guided-summary-${row.id}`}
                        >
                            <span className={styles.summaryLabel}>{row.label}</span>
                            <span className={styles.summaryValue} data-numeric={row.numeric ? 'true' : undefined}>
                                {row.value}
                            </span>
                        </div>
                    ))}
                    <div className={styles.summaryRow} style={{ '--vc-stagger': rows.length }}>
                        <span className={styles.summaryLabel}>Musique</span>
                        <span className={styles.summaryValue} data-testid="vibecut-guided-summary-music">
                            {audioTracks.length > 0 ? (
                                <>
                                    <Music size={13} /> {audioTracks[0].name}
                                    {/* Lot L5: les fondus posés par le preset sont relus du projet. */}
                                    {' · fondus '}
                                    <span data-numeric="true">
                                        {Number(audioTracks[0].fadeIn ?? 0)}/{Number(audioTracks[0].fadeOut ?? 0)} s
                                    </span>
                                </>
                            ) : 'Aucune'}
                        </span>
                    </div>
                    <div className={styles.summaryRow} style={{ '--vc-stagger': rows.length + 1 }}>
                        <span className={styles.summaryLabel}>Titre</span>
                        <span className={styles.summaryValue} data-testid="vibecut-guided-summary-title">
                            {titleOverlay ? (
                                <>
                                    <Type size={13} /> {titleOverlay.content}
                                    {plan.titleStyle ? ` · ${describeTitleStyle(plan.titleStyle)}` : ''}
                                </>
                            ) : 'Aucun'}
                        </span>
                    </div>
                </div>

                {/*
                  * Lot L5: la forme du montage, relue du projet applique et non du
                  * plan espere. C'est le meme dessin qu'a l'etape 3, donc on verifie
                  * d'un coup d'oeil que ce qui etait annonce a bien ete produit.
                  */}
                <BeatStrip
                    plan={{
                        scenes: scenes.map((scene, index) => ({
                            index,
                            duration: Number(scene.duration) || 0,
                            isImage: scene.isImage,
                            motion: scene.motionPreset,
                        })),
                        cuts: scenes.slice(0, -1).map((scene, index) => ({
                            index,
                            type: scene.transitionToNext?.type || 'cut',
                            name: scene.transitionToNext?.name || 'Coupe franche',
                            duration: scene.transitionToNext?.duration || 0,
                        })),
                    }}
                    testId="vibecut-guided-summary-beatstrip"
                />

                <p className={styles.exportNote} data-testid="vibecut-guided-export-note">
                    <span className={styles.exportNoteIcon}><Check size={13} /></span>
                    <span>
                        Tout ce qui vient d’être appliqué — durées, mouvements, fondus, colorimétrie,
                        musique et titre — est rendu à l’identique par l’export serveur.
                    </span>
                </p>
            </section>

            <section className={styles.panelSection} aria-labelledby="vibecut-guided-next-title">
                <div className={styles.panelSectionHead}>
                    <h3 className={styles.sectionTitle} id="vibecut-guided-next-title">Et maintenant</h3>
                </div>

                <Button
                    variant="primary"
                    size="lg"
                    icon={<Download size={18} />}
                    onClick={onOpenExport}
                    data-testid="vibecut-guided-open-export"
                >
                    Exporter la vidéo
                </Button>

                <div className={styles.handoff}>
                    <Link
                        href={`/video/rapide${projectQuery}`}
                        className={styles.handoffCard}
                        style={{ '--vc-stagger': 0 }}
                        data-testid="vibecut-guided-open-quick"
                    >
                        <span className={styles.handoffTitle}>
                            Ouvrir en montage rapide <ArrowRight size={15} />
                        </span>
                        <span className={styles.handoffHint}>
                            Réordonner les scènes, ajuster une durée, changer une transition, ajouter du texte.
                        </span>
                    </Link>
                    <Link
                        href={`/video/avance${projectQuery}`}
                        className={styles.handoffCard}
                        style={{ '--vc-stagger': 1 }}
                        data-testid="vibecut-guided-open-advanced"
                    >
                        <span className={styles.handoffTitle}>
                            Ouvrir en montage avancé <ArrowRight size={15} />
                        </span>
                        <span className={styles.handoffHint}>
                            Timeline multipiste, inspecteur détaillé, colorimétrie par plan et export
                            jusqu’à 60 images par seconde.
                        </span>
                    </Link>
                </div>
            </section>
        </>
    );
}
