"use client";

import React from 'react';
import Link from 'next/link';
import {
    ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Blend, ChevronsUp, Columns2, Grid2x2,
    Layers, Moon, MoveHorizontal, RefreshCw, RotateCw, Shuffle, Square, Sun, Waves,
    Zap, ZoomIn, ZoomOut,
} from 'lucide-react';
import styles from './home.module.css';
import SceneIllustration, { getSceneVariant, getSceneVariantForKey } from '../media/SceneIllustration';

/* Glyphe statique par effet: on comprend l'effet avant meme de le survoler. */
const MOTION_GLYPHS = {
    none: Square,
    'zoom-in': ZoomIn,
    'zoom-out': ZoomOut,
    'pan-left': ArrowLeft,
    'pan-right': ArrowRight,
    'drift-up': ArrowUp,
    'drift-down': ArrowDown,
    orbit: RotateCw,
    parallax: Layers,
    rotate: RefreshCw,
    appear: Blend,
    bounce: ChevronsUp,
    glitch: Zap,
};

const TRANSITION_GLYPHS = {
    dissolve: Blend,
    slide: MoveHorizontal,
    zoom: ZoomIn,
    blur: Waves,
    glitch: Shuffle,
    bars: Columns2,
    grid: Grid2x2,
    flash: Zap,
    'dip-white': Sun,
    'dip-black': Moon,
};

/*
 * Vignettes d'aperçu des bibliotheques.
 * L'animation demarre au survol ou au focus clavier (jamais en boucle permanente:
 * une grille entierement animee empeche de lire l'interface), et disparait avec
 * prefers-reduced-motion.
 */

function toCssLength(value) {
    if (!value) return '0';
    return `${value}%`;
}

export function MotionTile({ motion, index = 0, href }) {
    const { motionPreview: preview = {} } = motion;
    const from = preview.from || {};
    const to = preview.to || {};
    const style = {
        '--from-scale': from.scale ?? 1,
        '--to-scale': to.scale ?? 1,
        '--from-x': toCssLength(from.x),
        '--to-x': toCssLength(to.x),
        '--from-y': toCssLength(from.y),
        '--to-y': toCssLength(to.y),
        '--from-rotate': `${from.rotate ?? 0}deg`,
        '--to-rotate': `${to.rotate ?? 0}deg`,
        '--from-opacity': from.opacity ?? 1,
        '--to-opacity': to.opacity ?? 1,
    };
    const isPlanned = motion.availability === 'planned';
    const Glyph = MOTION_GLYPHS[motion.id] || Square;

    const content = (
        <>
            <span className={styles.tileStage} style={style}>
                <span className={styles.motionFrame}>
                    <SceneIllustration variant={getSceneVariant(index)} className={styles.sceneImage} />
                </span>
                <span className={styles.tileGlyph} aria-hidden="true"><Glyph size={13} /></span>
                {isPlanned ? <span className={styles.tilePlanned}>Bientôt</span> : null}
            </span>
            <span className={styles.tileName}>{motion.name}</span>
        </>
    );

    if (href) {
        return (
            <Link href={href} className={styles.tile} title={motion.description} data-testid={`vibecut-motion-tile-${motion.id}`}>
                {content}
            </Link>
        );
    }

    return (
        <span className={styles.tile} title={motion.description} data-testid={`vibecut-motion-tile-${motion.id}`}>
            {content}
        </span>
    );
}

const TRANSITION_PREVIEWS = {
    dissolve: {},
    slide: { enterFrom: 'translateX(100%)', leaveTo: 'translateX(-40%)' },
    zoom: { enterFrom: 'scale(1.4)', leaveTo: 'scale(0.86)' },
    blur: { enterFilterFrom: 'blur(10px)', leaveFilterTo: 'blur(10px)' },
    glitch: { enterFrom: 'translateX(7%) skewX(-5deg)', leaveTo: 'translateX(-7%) skewX(5deg)' },
    bars: { enterFrom: 'scaleY(0.18)', leaveTo: 'scaleY(0.18)' },
    grid: { enterFrom: 'scale(1.12)', leaveTo: 'scale(0.94)' },
    flash: { overlay: 'rgba(255,255,255,0.92)' },
    'dip-white': { overlay: '#ffffff' },
    'dip-black': { overlay: '#000000' },
};

export function TransitionTile({ transition, index = 0, href }) {
    const preview = TRANSITION_PREVIEWS[transition.preview] || TRANSITION_PREVIEWS.dissolve;
    const style = {
        '--enter-from': preview.enterFrom || 'none',
        '--leave-to': preview.leaveTo || 'none',
        '--enter-filter-from': preview.enterFilterFrom || 'none',
        '--leave-filter-to': preview.leaveFilterTo || 'none',
    };
    const Glyph = TRANSITION_GLYPHS[transition.preview] || Blend;

    const content = (
        <>
            <span className={styles.tileStage} style={style}>
                <span className={`${styles.transitionLayer} ${styles.transitionLayerA}`}>
                    <SceneIllustration variant={getSceneVariant(index)} className={styles.sceneImage} />
                </span>
                <span className={`${styles.transitionLayer} ${styles.transitionLayerB}`}>
                    <SceneIllustration variant={getSceneVariantForKey(transition.id)} className={styles.sceneImage} />
                </span>
                {preview.overlay ? (
                    <span className={styles.transitionOverlay} style={{ background: preview.overlay }} />
                ) : null}
                <span className={styles.tileGlyph} aria-hidden="true"><Glyph size={13} /></span>
            </span>
            <span className={styles.tileName}>{transition.name}</span>
        </>
    );

    if (href) {
        return (
            <Link
                href={href}
                className={styles.tile}
                data-preview={transition.preview}
                title={transition.description}
                data-testid={`vibecut-transition-tile-${transition.id}`}
            >
                {content}
            </Link>
        );
    }

    return (
        <span
            className={styles.tile}
            data-preview={transition.preview}
            title={transition.description}
            data-testid={`vibecut-transition-tile-${transition.id}`}
        >
            {content}
        </span>
    );
}
