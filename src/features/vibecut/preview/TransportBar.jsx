"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { Pause, Play } from 'lucide-react';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import { getPlayheadTime, subscribePlayhead } from './playheadClock';
import styles from './preview.module.css';

function formatTimecode(seconds = 0) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    const rest = Math.floor(safe % 60);
    const centis = Math.floor((safe % 1) * 100);
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

export default function TransportBar() {
    const scrubRef = useRef(null);
    const fillRef = useRef(null);
    const handleRef = useRef(null);
    const timecodeRef = useRef(null);

    const isPlaying = useVideoStore((state) => state.isPlaying);
    const totalDuration = useVideoStore((state) => state.totalDuration);
    const playbackSpeed = useVideoStore((state) => state.playbackSpeed);
    const togglePlay = useVideoStore((state) => state.togglePlay);
    const seekTo = useVideoStore((state) => state.seekTo);

    const hasContent = totalDuration > 0;

    /*
     * Curseur pilote directement dans le DOM, jamais par un rendu React.
     *
     * Le moteur ne peut pas tiquer plus vite que la cadence du media: une source
     * a 24 ou 30 images/s ne donne que 24 a 30 positions par seconde, ce qui se
     * voit. On avance donc le curseur a l'ecran a 60 fps avec l'horloge murale,
     * et on le recale en continu sur le temps reel du moteur: doux quand l'ecart
     * est faible, saut immediat quand l'utilisateur deplace la tete de lecture.
     */
    useEffect(() => {
        const write = (time) => {
            const clamped = totalDuration > 0 ? Math.max(0, Math.min(totalDuration, time)) : 0;
            const ratio = totalDuration > 0 ? clamped / totalDuration : 0;
            const percent = `${ratio * 100}%`;
            if (fillRef.current) fillRef.current.style.width = percent;
            if (handleRef.current) handleRef.current.style.left = percent;
            if (timecodeRef.current) timecodeRef.current.textContent = formatTimecode(clamped);
            if (scrubRef.current) scrubRef.current.setAttribute('aria-valuenow', String(Math.round(clamped * 100) / 100));
        };

        let target = getPlayheadTime();
        let display = target;
        let frame = null;
        let lastFrameTime = null;

        const unsubscribe = subscribePlayhead((time) => {
            target = time;
            if (!isPlaying) {
                display = time;
                write(time);
            }
        });

        if (!isPlaying) {
            write(target);
            return () => unsubscribe();
        }

        const speed = Number(playbackSpeed) > 0 ? Number(playbackSpeed) : 1;
        const loop = (now) => {
            if (lastFrameTime !== null) {
                display += ((now - lastFrameTime) / 1000) * speed;
                const drift = target - display;
                // Ecart important = seek ou fin de clip: on rejoint sans glisser.
                if (Math.abs(drift) > 0.3) display = target;
                else display += drift * 0.2;
                write(display);
            }
            lastFrameTime = now;
            frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);

        return () => {
            unsubscribe();
            if (frame) cancelAnimationFrame(frame);
        };
    }, [isPlaying, playbackSpeed, totalDuration]);

    const seekFromEvent = useCallback((event) => {
        const track = scrubRef.current;
        if (!track || !hasContent) return;
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        seekTo(ratio * totalDuration);
    }, [hasContent, seekTo, totalDuration]);

    const handlePointerDown = useCallback((event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        seekFromEvent(event);
    }, [seekFromEvent]);

    const handlePointerMove = useCallback((event) => {
        if (event.buttons !== 1) return;
        seekFromEvent(event);
    }, [seekFromEvent]);

    const handleKeyDown = useCallback((event) => {
        if (!hasContent) return;
        const step = event.shiftKey ? 1 : 1 / 30;
        const current = getPlayheadTime();
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            seekTo(Math.min(totalDuration, current + step));
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            seekTo(Math.max(0, current - step));
        }
    }, [hasContent, seekTo, totalDuration]);

    return (
        <div className={styles.transport} data-testid="vibecut-transport">
            <button
                type="button"
                className={styles.playButton}
                onClick={togglePlay}
                disabled={!hasContent}
                aria-label={isPlaying ? 'Pause' : 'Lecture'}
                title={isPlaying ? 'Pause (espace)' : 'Lecture (espace)'}
                data-testid="vibecut-play-toggle"
            >
                {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
            </button>

            <span className={styles.time} data-numeric="true" data-testid="vibecut-timecode">
                <span className={styles.timeCurrent} ref={timecodeRef}>{formatTimecode(0)}</span>
                {' / '}
                {formatTimecode(totalDuration)}
            </span>

            <div
                ref={scrubRef}
                className={styles.scrub}
                role="slider"
                tabIndex={0}
                aria-label="Position de lecture"
                aria-valuemin={0}
                aria-valuemax={Math.round(totalDuration * 100) / 100}
                aria-valuenow={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onKeyDown={handleKeyDown}
            >
                <span className={styles.scrubTrack}>
                    <span className={styles.scrubFill} ref={fillRef} />
                </span>
                <span className={styles.scrubHandle} ref={handleRef} />
            </div>
        </div>
    );
}
