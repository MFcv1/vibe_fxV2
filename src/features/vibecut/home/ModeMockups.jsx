"use client";

import React from 'react';
import { ChevronsRight } from 'lucide-react';
import styles from './home.module.css';
import SceneIllustration, { getSceneVariant } from '../media/SceneIllustration';

/*
 * Maquettes des trois modes: 100 % CSS, aucune image, aucun asset externe.
 * Elles s'animent au survol de la carte parente pour montrer ce que le mode fait,
 * et restent lisibles sans animation (prefers-reduced-motion).
 */

export function QuickMock() {
    return (
        <div className={`${styles.mock} ${styles.mockQuick}`} aria-hidden="true">
            <span className={styles.mockScene}>
                <SceneIllustration variant="beach" className={styles.sceneImage} />
                <span className={styles.mockSceneBadge}>1</span>
            </span>
            <span className={styles.mockLink}><ChevronsRight size={11} /></span>
            <span className={styles.mockScene}>
                <SceneIllustration variant="mountain" className={styles.sceneImage} />
                <span className={styles.mockSceneBadge}>2</span>
            </span>
            <span className={styles.mockLink}><ChevronsRight size={11} /></span>
            <span className={styles.mockScene}>
                <SceneIllustration variant="city" className={styles.sceneImage} />
                <span className={styles.mockSceneBadge}>3</span>
            </span>
        </div>
    );
}

export function GuidedMock() {
    return (
        <div className={`${styles.mock} ${styles.mockGuided}`} aria-hidden="true">
            <span className={styles.mockGuidedSteps}>
                <span className={styles.mockStep}>
                    <span className={`${styles.mockStepDot} ${styles.mockStepDotDone}`} />
                    <span className={styles.mockStepThumbs}>
                        <span><SceneIllustration variant="beach" className={styles.sceneImage} /></span>
                        <span><SceneIllustration variant="mountain" className={styles.sceneImage} /></span>
                        <span><SceneIllustration variant="forest" className={styles.sceneImage} /></span>
                    </span>
                </span>
                <span className={styles.mockStep}>
                    <span className={`${styles.mockStepDot} ${styles.mockStepDotDone}`} />
                    <span className={styles.mockStepBar} style={{ width: '62%' }} />
                </span>
                <span className={styles.mockStep}>
                    <span className={styles.mockStepDot} />
                    <span className={styles.mockStepBarFill} style={{ width: '76%' }} />
                </span>
                <span className={styles.mockStep}>
                    <span className={styles.mockStepDot} />
                    <span className={styles.mockStepBar} style={{ width: '40%' }} />
                </span>
            </span>
            <span className={styles.mockGuidedPreview}>
                <SceneIllustration variant="portrait" className={styles.sceneImage} />
                <span className={styles.mockGuidedPlay} />
            </span>
        </div>
    );
}

const ADVANCED_TRACKS = [
    [{ width: '32%', scene: 'beach' }, { width: '26%', scene: 'mountain' }, { width: '30%', scene: 'city' }],
    [{ width: '22%', scene: 'portrait' }, { width: '18%', scene: 'forest' }],
    [{ width: '74%', scene: null }],
];

export function AdvancedMock() {
    return (
        <div className={`${styles.mock} ${styles.mockAdvanced}`} aria-hidden="true">
            <span className={styles.mockRuler}>
                {Array.from({ length: 18 }).map((_, index) => (
                    <span
                        key={index}
                        className={styles.mockTick}
                        style={{ height: index % 4 === 0 ? '10px' : '5px' }}
                    />
                ))}
            </span>
            {ADVANCED_TRACKS.map((clips, trackIndex) => (
                <span key={trackIndex} className={styles.mockTrack}>
                    <span className={styles.mockTrackLabel} />
                    {clips.map((clip, clipIndex) => (
                        <span
                            key={clipIndex}
                            className={styles.mockClip}
                            style={{ width: clip.width, background: clip.scene ? 'transparent' : 'var(--vc-surface-3)' }}
                        >
                            {clip.scene ? (
                                <SceneIllustration variant={clip.scene} className={styles.sceneImage} />
                            ) : null}
                        </span>
                    ))}
                </span>
            ))}
            <span className={styles.mockPlayhead} />
        </div>
    );
}
