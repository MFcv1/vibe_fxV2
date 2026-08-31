"use client";

import React, { useEffect } from 'react';
import { Sheet } from '../primitives';
import styles from './generators.module.css';

const GRADIENT_EMBED_SRC = '/vendor/gradient-builder/index.html?embed=vibefx';

/*
 * Gradient Builder — app embarquee (public/vendor/gradient-builder), meme
 * principe que LumenSheet : iframe plein ecran + protocole postMessage. Elle
 * rend une image de fond, donc elle passe par le meme emplacement de projet
 * que Lumen.
 */
export default function GradientSheet({ open, onClose, onUseBackground }) {
    useEffect(() => {
        if (!open) return undefined;
        const handleMessage = async (event) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data || {};
            if (data.source !== 'gradient-builder') return;
            if (data.type === 'gradient:use-background') {
                const applied = await onUseBackground?.({
                    dataUrl: data.payload?.dataUrl,
                    styleName: data.payload?.title || 'Gradient',
                    mode: 'gradient',
                    generator: 'gradient',
                });
                if (applied !== false) onClose?.();
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [open, onClose, onUseBackground]);

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title="Gradient"
            immersive
        >
            <div className={`${styles.gradientFrame} ${styles.immersiveFrame}`}>
                <iframe
                    title="Gradient Builder"
                    src={GRADIENT_EMBED_SRC}
                    sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-modals"
                />
            </div>
        </Sheet>
    );
}
