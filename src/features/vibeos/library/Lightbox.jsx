"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Trash2, Wand2, X } from 'lucide-react';
import { describeExif } from './exif';
import { deviceLabel } from './photoImport';
import { fullUrl, thumbUrl } from './useLibrary';
import styles from './library.module.css';

/*
 * Carrousel plein ecran de la bibliotheque.
 *
 * Quatre principes tenus a la lettre, parce que c'est ce qui separe un vrai
 * carrousel d'une modale qui affiche une image :
 *
 * 1. **Zoom partage (FLIP)** - a l'ouverture, la photo part exactement de la
 *    tuile cliquee et se deplie jusqu'a sa place finale; a la fermeture, elle y
 *    retourne. On mesure la position finale, on applique la transformation
 *    inverse, puis on l'annule: une seule animation composite, aucun reflow.
 *    L'animation porte sur le cadre de la photo (meme rapport que la tuile),
 *    donc l'echelle reste uniforme et l'image ne se deforme jamais.
 * 2. **Vignette d'abord** - la vignette est deja decodee, elle s'affiche donc
 *    au premier trait; la pleine resolution se fond par-dessus quand elle est
 *    prete. L'ouverture ne depend jamais du decodage d'un JPEG de 8 Mo.
 * 3. **Trois diapositives** - precedente, courante, suivante. Le rail glisse,
 *    puis l'index change une fois l'animation finie et le rail est recentre
 *    sans transition: le passage d'une photo a l'autre est continu.
 * 4. **Geste au doigt sur le DOM** - pendant un glissement, on ecrit le
 *    `transform` directement sur le noeud, sans passer par React. Le rendu
 *    React reprend la main seulement quand le geste est fini.
 */

const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const OPEN_MS = 420;
const SLIDE_MS = 340;
/* Le rail fait trois largeurs: la diapositive courante est au tiers du milieu. */
const BASE = -100 / 3;
const STEP = 100 / 3;
/* Part de la largeur a franchir pour changer de photo. */
const SWIPE_RATIO = 0.18;

function formatDate(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
}

/* Chaque diapositive est montee avec la photo pour cle (voir le rendu plus bas):
   l'etat "pleine resolution prete" repart donc naturellement a zero d'une photo
   a l'autre, sans effet de synchronisation. */
function Slide({ photo, frameRef = null, priority = false }) {
    const [fullReady, setFullReady] = useState(false);

    if (!photo) return <div className={styles.slide} aria-hidden="true" />;

    return (
        <div className={styles.slide}>
            <div
                ref={frameRef}
                className={styles.slideFrame}
                style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
            >
                <img src={thumbUrl(photo)} alt="" aria-hidden="true" className={styles.slideThumb} />
                <img
                    src={fullUrl(photo)}
                    alt={photo.name}
                    className={styles.slideFull}
                    data-ready={fullReady ? 'true' : 'false'}
                    loading={priority ? 'eager' : 'lazy'}
                    onLoad={() => setFullReady(true)}
                />
            </div>
        </div>
    );
}

export default function Lightbox({
    photos, index, onIndexChange, onClose, onEdit, onDelete, getTileRect,
}) {
    const photo = photos[index] || null;
    const trackRef = useRef(null);
    const stageRef = useRef(null);
    const activeFrameRef = useRef(null);
    const backdropRef = useRef(null);
    const dragRef = useRef(null);
    const slidingRef = useRef(false);
    const [closing, setClosing] = useState(false);

    /* Position du rail, en pourcentage de sa largeur + un delta en pixels
       pendant le geste. */
    const setTrack = useCallback((percent, pixels = 0, animate = false) => {
        const track = trackRef.current;
        if (!track) return;
        track.style.transition = animate ? `transform ${SLIDE_MS}ms ${SPRING}` : 'none';
        track.style.transform = `translate3d(calc(${percent}% + ${pixels}px), 0, 0)`;
    }, []);

    /* Recentrage instantane a chaque changement de photo. */
    useEffect(() => {
        setTrack(BASE, 0, false);
        slidingRef.current = false;
    }, [index, setTrack]);

    const slideTo = useCallback((next) => {
        if (slidingRef.current) return;
        if (next < 0 || next >= photos.length || next === index) return;
        const delta = next - index;
        /* Voisin immediat: on fait glisser le rail. Saut lointain (frise): on
           bascule directement, glisser sur dix photos n'aurait aucun sens. */
        if (Math.abs(delta) !== 1) {
            onIndexChange(next);
            return;
        }
        slidingRef.current = true;
        setTrack(BASE - delta * STEP, 0, true);
        window.setTimeout(() => onIndexChange(next), SLIDE_MS);
    }, [index, photos.length, onIndexChange, setTrack]);

    /* ---------- Ouverture: zoom depuis la tuile ---------- */
    useLayoutEffect(() => {
        setTrack(BASE, 0, false);
        const frame = activeFrameRef.current;
        const backdrop = backdropRef.current;
        backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: OPEN_MS, easing: SPRING, fill: 'backwards',
        });
        if (!frame || !photo) return;
        const origin = getTileRect?.(photo.id);
        const target = frame.getBoundingClientRect();
        if (!origin || !target.width || !target.height) {
            frame.animate(
                [{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }],
                { duration: OPEN_MS, easing: SPRING, fill: 'backwards' },
            );
            return;
        }
        const scale = origin.width / target.width;
        const scaleY = origin.height / target.height;
        const dx = (origin.left + origin.width / 2) - (target.left + target.width / 2);
        const dy = (origin.top + origin.height / 2) - (target.top + target.height / 2);
        frame.animate(
            [
                { transform: `translate(${dx}px, ${dy}px) scale(${scale}, ${scaleY})` },
                { transform: 'none' },
            ],
            { duration: OPEN_MS, easing: SPRING, fill: 'backwards' },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---------- Fermeture: retour vers la tuile ---------- */
    const close = useCallback(() => {
        if (closing) return;
        setClosing(true);
        const frame = activeFrameRef.current;
        const backdrop = backdropRef.current;
        const origin = photo ? getTileRect?.(photo.id) : null;
        backdrop?.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 260, easing: SPRING, fill: 'forwards',
        });
        if (!frame) {
            onClose();
            return;
        }
        const target = frame.getBoundingClientRect();
        const keyframes = origin && target.width && target.height
            ? (() => {
                const scale = origin.width / target.width;
                const scaleY = origin.height / target.height;
                const dx = (origin.left + origin.width / 2) - (target.left + target.width / 2);
                const dy = (origin.top + origin.height / 2) - (target.top + target.height / 2);
                return [
                    { transform: 'none' },
                    { transform: `translate(${dx}px, ${dy}px) scale(${scale}, ${scaleY})` },
                ];
            })()
            : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.94)' }];
        const animation = frame.animate(keyframes, { duration: 300, easing: SPRING, fill: 'forwards' });
        animation.onfinish = () => onClose();
    }, [closing, onClose, photo, getTileRect]);

    /* ---------- Clavier ---------- */
    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            else if (event.key === 'ArrowRight') slideTo(index + 1);
            else if (event.key === 'ArrowLeft') slideTo(index - 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [close, slideTo, index]);

    /* Le fond de page ne doit pas defiler derriere le carrousel. */
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, []);

    /* ---------- Glissement ---------- */
    const onPointerDown = (event) => {
        if (slidingRef.current || closing) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        dragRef.current = { startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, axis: null };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        drag.dx = event.clientX - drag.startX;
        drag.dy = event.clientY - drag.startY;
        if (!drag.axis && Math.hypot(drag.dx, drag.dy) > 8) {
            drag.axis = Math.abs(drag.dx) > Math.abs(drag.dy) ? 'x' : 'y';
        }
        if (drag.axis === 'x') {
            /* Resistance aux extremites: on sent le bord de la collection. */
            const atEdge = (drag.dx > 0 && index === 0)
                || (drag.dx < 0 && index === photos.length - 1);
            setTrack(BASE, atEdge ? drag.dx * 0.3 : drag.dx, false);
        } else if (drag.axis === 'y' && stageRef.current) {
            const progress = Math.min(1, Math.abs(drag.dy) / 420);
            stageRef.current.style.transition = 'none';
            stageRef.current.style.transform = `translate3d(0, ${drag.dy}px, 0) scale(${1 - progress * 0.12})`;
            if (backdropRef.current) backdropRef.current.style.opacity = String(1 - progress * 0.7);
        }
    };

    const onPointerUp = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag || !drag.axis) return;
        if (drag.axis === 'y') {
            /* Assez loin vers le haut ou le bas: on ferme, comme dans Photos. */
            if (Math.abs(drag.dy) > 140) { close(); return; }
            if (stageRef.current) {
                stageRef.current.style.transition = `transform ${SLIDE_MS}ms ${SPRING}`;
                stageRef.current.style.transform = 'none';
            }
            if (backdropRef.current) backdropRef.current.style.opacity = '1';
            return;
        }
        const width = trackRef.current?.offsetWidth
            ? trackRef.current.offsetWidth / 3
            : window.innerWidth;
        const threshold = width * SWIPE_RATIO;
        if (drag.dx <= -threshold && index < photos.length - 1) slideTo(index + 1);
        else if (drag.dx >= threshold && index > 0) slideTo(index - 1);
        else setTrack(BASE, 0, true);
    };

    const exifLine = useMemo(() => describeExif(photo?.exif).join(' · '), [photo]);

    if (!photo) return null;

    return (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={photo.name}>
            <div ref={backdropRef} className={styles.lightboxBackdrop} onClick={close} />

            <header className={styles.lightboxBar}>
                <div className={styles.lightboxMeta}>
                    <span className={styles.lightboxName}>{photo.name}</span>
                    <span className={styles.lightboxSub}>
                        {[deviceLabel(photo), photo.exif?.lens, exifLine, formatDate(photo.takenAt)]
                            .filter(Boolean).join(' · ')}
                    </span>
                </div>
                <div className={styles.lightboxActions}>
                    <span className={styles.lightboxCount} data-numeric>
                        {index + 1} / {photos.length}
                    </span>
                    <button
                        type="button"
                        className={styles.lightboxButton}
                        onClick={() => onEdit(photo)}
                        data-testid="vibeos-library-lightbox-edit"
                    >
                        <Wand2 size={14} />
                        Retoucher
                    </button>
                    <a
                        className={styles.lightboxIcon}
                        href={fullUrl(photo)}
                        download={photo.name}
                        aria-label="Télécharger la photo"
                        title="Télécharger"
                    >
                        <Download size={16} />
                    </a>
                    <button
                        type="button"
                        className={styles.lightboxIcon}
                        onClick={() => onDelete(photo)}
                        aria-label="Supprimer la photo"
                        title="Supprimer"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button
                        type="button"
                        className={styles.lightboxIcon}
                        onClick={close}
                        aria-label="Fermer"
                        title="Fermer (Échap)"
                    >
                        <X size={16} />
                    </button>
                </div>
            </header>

            <div
                ref={stageRef}
                className={styles.lightboxStage}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                data-testid="vibeos-library-lightbox"
            >
                <div ref={trackRef} className={styles.lightboxTrack}>
                    <Slide key={photos[index - 1]?.id || 'prev'} photo={photos[index - 1]} />
                    <Slide key={photo.id} photo={photo} frameRef={activeFrameRef} priority />
                    <Slide key={photos[index + 1]?.id || 'next'} photo={photos[index + 1]} />
                </div>
            </div>

            {index > 0 ? (
                <button
                    type="button"
                    className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
                    onClick={() => slideTo(index - 1)}
                    aria-label="Photo précédente"
                >
                    <ChevronLeft size={22} />
                </button>
            ) : null}
            {index < photos.length - 1 ? (
                <button
                    type="button"
                    className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
                    onClick={() => slideTo(index + 1)}
                    aria-label="Photo suivante"
                >
                    <ChevronRight size={22} />
                </button>
            ) : null}

            <footer className={styles.filmstrip} aria-label="Toutes les photos">
                {photos.map((item, itemIndex) => (
                    <button
                        key={item.id}
                        type="button"
                        className={styles.filmstripItem}
                        data-active={itemIndex === index ? 'true' : 'false'}
                        onClick={() => slideTo(itemIndex)}
                        aria-label={item.name}
                        aria-current={itemIndex === index ? 'true' : undefined}
                        ref={(node) => {
                            /* La vignette active reste toujours visible dans la
                               frise, y compris apres une navigation clavier. */
                            if (node && itemIndex === index) {
                                node.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
                            }
                        }}
                    >
                        <img src={thumbUrl(item)} alt="" />
                    </button>
                ))}
            </footer>
        </div>
    );
}
