"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, Sheet, Spinner } from '../primitives';
import styles from './generators.module.css';

const LUMEN_EMBED_SRC = '/vendor/lumen/index.html?embed=vibefx';

/*
 * Lumen shader studio — meme app embarquee (public/vendor/lumen) et meme
 * protocole postMessage que l'ancien LumenShaderModal, habillage VibeOS.
 */
export default function LumenSheet({ open, onClose, onUseBackground, immersive = false }) {
    const iframeRef = useRef(null);
    const [isApplying, setIsApplying] = useState(false);

    const requestBackground = useCallback(() => {
        const target = iframeRef.current?.contentWindow;
        if (!target) return;
        setIsApplying(true);
        target.postMessage({ source: 'vibefx', type: 'vibefx:capture-lumen' }, window.location.origin);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const handleMessage = async (event) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data || {};
            if (data.source !== 'lumen-shaders') return;
            if (data.type === 'lumen:use-background') {
                const applied = await onUseBackground?.({
                    ...(data.payload || {}),
                    generator: 'lumen',
                });
                setIsApplying(false);
                if (applied !== false) onClose?.();
            }
            if (data.type === 'lumen:error') setIsApplying(false);
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [open, onClose, onUseBackground]);

    const handleClose = useCallback(() => {
        setIsApplying(false);
        onClose?.();
    }, [onClose]);

    return (
        <Sheet
            open={open}
            onClose={handleClose}
            title="Lumen"
            wide={!immersive}
            immersive={immersive}
            actions={(
                <Button
                    variant="primary"
                    size="sm"
                    icon={isApplying ? <Spinner label="Rendu en cours" /> : <Sparkles size={13} />}
                    disabled={isApplying}
                    onClick={requestBackground}
                >
                    {isApplying ? 'Rendu…' : 'Utiliser comme fond'}
                </Button>
            )}
        >
            <div className={`${styles.lumenFrame} ${immersive ? styles.immersiveFrame : ''}`}>
                <iframe
                    ref={iframeRef}
                    title="Lumen shader studio"
                    src={LUMEN_EMBED_SRC}
                    sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-modals"
                />
            </div>
        </Sheet>
    );
}
