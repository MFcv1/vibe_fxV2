"use client";

import React from 'react';
import { Sheet } from '../primitives';
import styles from './generators.module.css';

const MOTION_EMBED_SRC = '/vendor/motion-studio/index.html?embed=vibefx';

/*
 * Motion Studio — troisieme app embarquee du Studio (public/vendor/motion-studio),
 * meme principe que Gradient et Lumen : iframe plein ecran dans un Sheet.
 *
 * Difference avec les deux autres : Motion produit une video, pas une image de
 * fond. Il n'y a donc pas de protocole postMessage ni d'emplacement de projet a
 * remplir — l'app enregistre son fichier et le rend a l'utilisateur. C'est aussi
 * pour ca que l'iframe a besoin de `allow-downloads`.
 */
export default function MotionSheet({ open, onClose }) {
    return (
        <Sheet
            open={open}
            onClose={onClose}
            title="Motion"
            immersive
        >
            <div className={`${styles.gradientFrame} ${styles.immersiveFrame}`}>
                <iframe
                    title="Motion Studio"
                    src={MOTION_EMBED_SRC}
                    sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
                />
            </div>
        </Sheet>
    );
}
