'use client';

import React from 'react';
import styles from './instagramPhone.module.css';

export const PHONE_WIDTH = 430;
export const PHONE_HEIGHT = 910;
export const SCREEN_WIDTH = 402;
export const SCREEN_HEIGHT = 874;

/* Copie VibeFX de secondevienextjsSSR/PublicationPhoneShell.jsx. */
export function ScaledStage({
    children,
    width,
    height,
    label,
    maxScale = 1,
    minScale = 0.4,
    maxWidth = '100%',
}) {
    const stageRef = React.useRef(null);
    const [scale, setScale] = React.useState(minScale);

    React.useLayoutEffect(() => {
        const stage = stageRef.current;
        if (!stage) return undefined;

        const updateScale = () => {
            const box = stage.getBoundingClientRect();
            const widthScale = box.width > 0 ? box.width / width : maxScale;
            const heightScale = box.height > 0 ? box.height / height : widthScale;
            setScale(Math.min(maxScale, Math.max(minScale, Math.min(widthScale, heightScale))));
        };

        updateScale();
        const observer = new ResizeObserver(updateScale);
        observer.observe(stage);
        return () => observer.disconnect();
    }, [height, maxScale, minScale, width]);

    return (
        <div ref={stageRef} className={styles.scaledStage} style={{ maxWidth }} aria-label={label}>
            <div className={styles.scaleBox} style={{ width: width * scale, height: height * scale }}>
                <div className={styles.scaleContent} style={{ width, height, transform: `scale(${scale})` }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export function ScaledPhone({ children, label = 'Apercu sur iPhone 17 Pro', maxScale = 0.82, expanded = false }) {
    return (
        <ScaledStage
            width={PHONE_WIDTH}
            height={PHONE_HEIGHT}
            label={label}
            maxScale={expanded ? 1 : maxScale}
            minScale={0.36}
            maxWidth={expanded ? '540px' : '360px'}
        >
            {children}
        </ScaledStage>
    );
}

export function PhoneChrome() {
    return (
        <>
            <div className={`${styles.sideButton} ${styles.silentButton}`} />
            <div className={`${styles.sideButton} ${styles.volumeUpButton}`} />
            <div className={`${styles.sideButton} ${styles.volumeDownButton}`} />
            <div className={`${styles.sideButton} ${styles.powerButton}`} />
            <div className={styles.phoneOuter} />
            <div className={styles.phoneMiddle} />
            <div className={styles.phoneInner} />
        </>
    );
}

export function StatusBar({ tone = 'dark' }) {
    const isDark = tone === 'dark';
    return (
        <div className={`${styles.statusBar} ${isDark ? styles.darkTone : styles.lightTone}`}>
            <span className={styles.statusTime}>9:41</span>
            <div className={styles.dynamicIsland} aria-hidden="true"><span /></div>
            <div className={styles.statusSignals} aria-hidden="true">
                <svg className={styles.cellular} viewBox="0 0 18 12"><path fill="currentColor" d="M1 9h2v3H1V9Zm4-3h2v6H5V6Zm4-3h2v9H9V3Zm4-3h2v12h-2V0Z" /></svg>
                <svg className={styles.wifi} viewBox="0 0 17 13"><path d="M1 4.7a11.4 11.4 0 0 1 15 0M3.6 7.5a7.5 7.5 0 0 1 9.8 0M6.3 10.1a3.4 3.4 0 0 1 4.4 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /><circle cx="8.5" cy="12" r="1" fill="currentColor" /></svg>
                <span className={styles.battery}><span /><i /></span>
            </div>
        </div>
    );
}

export function PhoneScreen({ children, background = 'white', text = '#0d0d0d', className = '' }) {
    return <div className={`${styles.phoneScreen} ${className}`} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, background, color: text }}>{children}</div>;
}

export function HomeIndicator({ tone = 'dark' }) {
    return <span className={`${styles.homeIndicator} ${tone === 'dark' ? styles.homeDark : styles.homeLight}`} />;
}
