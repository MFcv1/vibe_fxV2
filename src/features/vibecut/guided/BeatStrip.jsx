"use client";

import React, { useMemo } from 'react';
import { buildBeatStrip } from '../data/styleRecipes';
import styles from './guided.module.css';

/*
 * Pellicule de battement (lot L5).
 *
 * Le lot L2 a fait du preset une PARTITION, mais l'etape 3 continuait de la
 * resumer par un intervalle chiffre - « 2,72 a 4,57 s par photo ». Deux presets
 * de forme opposee peuvent afficher le meme intervalle: « Recit », dont les
 * plans raccourcissent, et « Reel dynamique », dont ils alternent, ne se
 * distinguaient donc pas du tout sur cet ecran.
 *
 * Ici chaque plan est un bloc dont la LARGEUR est sa duree, et chaque coupe
 * minutee une jointure dont la largeur est la sienne. La forme du montage se lit
 * sans lire un seul chiffre, et changer de rythme la comprime sans la deformer -
 * ce qui est exactement ce que la formule du lot L2 promet.
 *
 * `buildBeatStrip` est pur et vit dans `styleRecipes.js`: la geometrie se teste
 * sans navigateur.
 */

export default function BeatStrip({ plan, compact = false, testId = 'vibecut-guided-beatstrip' }) {
    const strip = useMemo(() => buildBeatStrip(plan), [plan]);

    if (strip.blocks.length === 0) return null;

    return (
        /*
         * `span` et non `div`: la version compacte vit DANS le bouton d'une carte
         * de rythme, et un bouton n'accepte que du contenu phrastique. Un `div`
         * y serait du HTML invalide - exactement le defaut corrige au bug 11.
         */
        <span
            className={[styles.beatStrip, compact ? styles.beatStripCompact : ''].filter(Boolean).join(' ')}
            data-testid={testId}
            data-block-count={strip.blocks.length}
            role="img"
            aria-label={
                `Forme du montage : ${strip.blocks.length} plans, `
                + `${strip.joints.filter((joint) => joint.isTimed).length} coupes fondues`
            }
        >
            {strip.blocks.map((block) => (
                <span
                    key={block.index}
                    className={styles.beatBlock}
                    style={{ flexGrow: block.share }}
                    data-index={block.index}
                    data-share={block.share}
                    data-motion={block.motion || 'none'}
                    /*
                     * Une VIDEO garde sa duree d'origine: le preset ne la produit
                     * pas. On la marque, sinon la pellicule laisserait croire que
                     * la partition l'a choisie.
                     */
                    data-kind={block.isImage ? 'image' : 'video'}
                    title={`Plan ${block.index + 1} · ${block.duration} s`}
                />
            ))}

            {strip.joints.filter((joint) => joint.isTimed).map((joint) => (
                <span
                    key={joint.index}
                    className={[styles.beatJoint, joint.isAccent ? styles.beatJointAccent : ''].filter(Boolean).join(' ')}
                    style={{ left: `${joint.offset}%` }}
                    data-cut={joint.index}
                    data-accent={joint.isAccent ? 'true' : 'false'}
                    title={`${joint.name} · ${joint.duration} s`}
                />
            ))}
        </span>
    );
}
