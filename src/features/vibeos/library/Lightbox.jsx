"use client";

import React, {
    useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import {
    Calendar, ChevronLeft, ChevronRight, Download, Smartphone, Trash2, Wand2, X,
} from 'lucide-react';
import { describeExif } from './exif';
import { deviceLabel } from './photoImport';
import { fullUrl, thumbUrl } from './useLibrary';
import styles from './library.module.css';

/*
 * Carrousel plein ecran de la bibliotheque.
 *
 * Ce qu'on cherche ici n'est pas "une modale qui affiche une image" mais la
 * sensation d'une table lumineuse: la photo se pose, ses voisines restent
 * visibles en retrait, et le fond est la grille elle-meme, reculee et floutee.
 *
 * Cinq points qui font tout le rendu :
 *
 * 1. **Rail a largeur variable.** Chaque diapositive fait la taille de SA
 *    photo (au plus 70% de la hauteur et 50% de la largeur de la scene). Un
 *    portrait laisse donc voir large de ses voisines, un panoramique les
 *    repousse presque hors champ. Un carrousel a colonnes fixes ne fait jamais
 *    ca, et ca se voit immediatement.
 * 2. **Une voisine visible de chaque cote, pas deux.** Les diapositives a deux
 *    crans restent montees - il faut bien qu'il y ait quelque chose a montrer
 *    quand le rail part - mais elles sont transparentes. Elles se revelent
 *    PENDANT le glissement, parce que la reserve suit `visual`, qui bascule des
 *    le debut du geste.
 * 3. **Une seule transformation animee.** Le rail entier se deplace en
 *    `translate3d`; les voisines changent d'echelle et d'opacite par simple
 *    transition CSS declenchee par `data-active`. Rien n'est recalcule image
 *    par image, donc rien ne peut faire tomber la cadence.
 * 4. **Fondu puis zoom a l'ouverture.** Pas de vol depuis la tuile: la photo
 *    arrive centree, a 90%, et se deplie. Les voisines suivent 90 ms plus
 *    tard, l'habillage 180 ms plus tard. Ce decalage est ce qui donne
 *    l'impression que l'interface suit la photo au lieu d'arriver avec elle.
 * 5. **Les animations d'entree ne vivent que pendant l'entree.** Passe 700 ms
 *    on repasse en `idle`, sinon chaque changement de photo rejouerait le zoom
 *    (le selecteur `data-active` se remettrait a matcher) et le carrousel
 *    "sauterait" a chaque fleche.
 * 6. **Geste au doigt sur le DOM.** Pendant un glissement on ecrit le
 *    `transform` directement sur le noeud; React ne reprend la main qu'a la
 *    fin du geste.
 */

/* Meme famille de courbe que les apparitions CSS: le rail ne doit pas se poser
   plus sec que les photos qu'il porte. */
const EXPO = 'cubic-bezier(0.25, 1, 0.5, 1)';
/* Le renvoi vers la tuile est un trajet, pas une disparition: il part et il
   arrive, donc il s'amortit aux deux bouts. */
const FLIGHT = 'cubic-bezier(0.45, 0, 0.15, 1)';
const SLIDE_MS = 620;
const CLOSE_MS = 620;
/* Duree pendant laquelle les animations d'ouverture restent accrochees. Doit
   couvrir la plus tardive (fleches: 460 + 660 ms). */
const ENTER_MS = 1200;

/* Geometrie de la scene. Mesures relevees sur la reference: la photo courante
   occupe 70% de la hauteur utile, et jamais plus de la moitie de la largeur -
   c'est ce rapport qui laisse voir une voisine de chaque cote.
   Sur telephone ce reglage n'a plus de sens: une photo a la moitie de la
   largeur d'un ecran de 390 px serait une vignette. La photo y prend donc
   presque tout, et les voisines ne font plus qu'affleurer. */
const NARROW = 860;
const MAX_H = 0.70;
const MAX_W = 0.50;
const MAX_H_NARROW = 0.68;
const MAX_W_NARROW = 0.84;
const SLIDE_GAP = 44;
const SLIDE_GAP_NARROW = 18;
/* Deux photos de marge de chaque cote: une pour le voisin visible, une pour
   que le glissement ait deja quelque chose a montrer derriere. */
const WINDOW = 2;
const SWIPE_RATIO = 0.16;
/* Sous cette bande, en bas de l'ecran, la frise remonte. */
const STRIP_ZONE = 150;

function formatDate(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

function slideGap(stageW) {
    return stageW < NARROW ? SLIDE_GAP_NARROW : SLIDE_GAP;
}

function slideSize(photo, stageW, stageH) {
    const ratio = photo?.width && photo?.height ? photo.width / photo.height : 1;
    const narrow = stageW < NARROW;
    const maxH = stageH * (narrow ? MAX_H_NARROW : MAX_H);
    const maxW = stageW * (narrow ? MAX_W_NARROW : MAX_W);
    let width = maxH * ratio;
    let height = maxH;
    if (width > maxW) {
        width = maxW;
        height = maxW / ratio;
    }
    return { width: Math.round(width), height: Math.round(height) };
}

/* Chaque diapositive est montee avec la photo pour cle: l'etat "pleine
   resolution prete" repart donc de zero d'une photo a l'autre, sans effet de
   synchronisation. */
/*
 * Une diapositive.
 *
 * Qui charge quoi, et pourquoi ca compte:
 *
 * - **la photo centrale** monte sa pleine resolution par-dessus l'apercu;
 * - **les voisines s'arretent a l'apercu** (1600 px). Elles sont affichees a
 *   ~500 px CSS: l'apercu les rend deja nettes, et charger trois originaux en
 *   meme temps a fait tomber Safari sur des PNG de 10 Mo - il rendait des
 *   images cassees, avec le cadre gris et le point d'interrogation par-dessus
 *   la photo. C'est ce qu'on prenait pour un « contour blanc ».
 *
 * L'original porte `alt=""`: s'il echoue quand meme, le navigateur ne doit
 * RIEN dessiner - l'apercu en dessous suffit, et le nom de la photo est deja
 * porte par le dialogue.
 */
function Slide({ photo, position, distance, width, height, onNeedPixels }) {
    const [fullState, setFullState] = useState('idle'); // idle | ready | failed
    const centre = distance < 0.5;

    /* L'apercu stocke peut dater d'avant le passage a 1600 px: on le refait
       demander ici aussi, sinon les voisines resteraient molles pour toujours. */
    const askForPixels = useCallback((event) => {
        const img = event.currentTarget;
        const dpr = typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1);
        const needed = Math.round(Math.max(width, height) * dpr);
        if (img.naturalWidth && Math.max(img.naturalWidth, img.naturalHeight) < needed * 0.85) {
            onNeedPixels?.(photo, needed);
        }
    }, [width, height, onNeedPixels, photo]);

    return (
        <div
            className={styles.slide}
            style={{ width, height, '--d': distance }}
            data-active={centre ? 'true' : 'false'}
            data-slide-index={position}
        >
            <div className={styles.slideEnter} data-enter>
                <div className={styles.slideFrame}>
                    <img
                        src={thumbUrl(photo)}
                        alt=""
                        aria-hidden="true"
                        className={styles.slideThumb}
                        onLoad={askForPixels}
                    />
                    {centre ? (
                        <img
                            src={fullUrl(photo)}
                            alt=""
                            aria-hidden="true"
                            className={styles.slideFull}
                            data-ready={fullState === 'ready' ? 'true' : 'false'}
                            data-failed={fullState === 'failed' ? 'true' : 'false'}
                            onLoad={() => setFullState('ready')}
                            onError={() => setFullState('failed')}
                        />
                    ) : null}
                    <span className={styles.slideShade} aria-hidden="true" />
                </div>
            </div>
        </div>
    );
}

export default function Lightbox({
    photos, index, onIndexChange, onClose, onCloseStart, onEdit, onDelete,
    getTileRect, onNeedPixels, opening = false,
}) {
    const photo = photos[index] || null;
    const trackRef = useRef(null);
    const stageRef = useRef(null);
    const dragRef = useRef(null);
    const slidingRef = useRef(false);
    const timersRef = useRef([]);

    const [stage, setStage] = useState({ width: 0, height: 0 });
    const [state, setState] = useState('open'); // open | idle | closing
    /* Photo visee pendant un glissement. Le fondu des voisines doit accompagner
       le mouvement du rail, donc il bascule des le DEBUT du geste, alors que
       `index` ne change qu'a la fin. Un simple etat derive suffit: pas besoin
       de le resynchroniser, il retombe sur `index` quand le glissement se
       termine. */
    const [pending, setPending] = useState(null);
    const visual = pending ?? index;
    const [strip, setStrip] = useState(false);

    /* Minuteries centralisees: a la fermeture, aucun rappel ne doit survivre au
       demontage (sinon on appelle onIndexChange sur un carrousel disparu). */
    const later = useCallback((fn, delay) => {
        const id = window.setTimeout(fn, delay);
        timersRef.current.push(id);
        return id;
    }, []);

    useEffect(() => () => {
        timersRef.current.forEach((id) => window.clearTimeout(id));
        timersRef.current = [];
    }, []);

    /* Taille reelle de la scene: c'est elle qui dicte la taille de chaque
       diapositive, donc elle doit etre mesuree, jamais devinee. */
    const attachStage = useCallback((node) => {
        stageRef.current = node;
        if (!node) return;
        setStage({ width: node.clientWidth, height: node.clientHeight });
        const observer = new ResizeObserver((entries) => {
            const box = entries[0].contentRect;
            setStage({ width: box.width, height: box.height });
        });
        observer.observe(node);
        node.__voObserver = observer;
    }, []);

    useEffect(() => () => {
        stageRef.current?.__voObserver?.disconnect();
    }, []);

    /* Fenetre de diapositives + position de chacune sur le rail. */
    const layout = useMemo(() => {
        if (!stage.width || !stage.height || !photos.length) return null;
        const from = Math.max(0, index - WINDOW);
        const to = Math.min(photos.length - 1, index + WINDOW);
        const items = [];
        let x = 0;
        for (let i = from; i <= to; i += 1) {
            const size = slideSize(photos[i], stage.width, stage.height);
            items.push({ position: i, photo: photos[i], x, ...size });
            x += size.width + slideGap(stage.width);
        }
        return { items };
    }, [photos, index, stage.width, stage.height]);

    /* Decalage du rail qui met la diapositive `i` au centre exact de la scene. */
    const offsetFor = useCallback((i) => {
        const item = layout?.items.find((entry) => entry.position === i);
        if (!item) return 0;
        return (stage.width - item.width) / 2 - item.x;
    }, [layout, stage.width]);

    const setTrackX = useCallback((x, animate) => {
        const node = trackRef.current;
        if (!node) return;
        node.style.transition = animate ? `transform ${SLIDE_MS}ms ${EXPO}` : 'none';
        node.style.transform = `translate3d(${x}px, -50%, 0)`;
    }, []);

    const centreOf = (item) => item.x + item.width / 2;

    /*
     * Distance au centre de chaque diapositive, ecrite EN FRACTION pendant un
     * geste. C'est ce qui fait que les voisines suivent le doigt en continu -
     * elles grandissent et s'eclaircissent au fur et a mesure - au lieu de
     * basculer d'un palier a l'autre quand l'index change.
     */
    const writeDistances = useCallback((shift) => {
        const track = trackRef.current;
        if (!track || !layout) return;
        const camera = stage.width / 2 - (offsetFor(index) + shift);
        const current = layout.items.find((item) => item.position === index);
        const neighbour = layout.items.find((item) => item.position === index + 1)
            || layout.items.find((item) => item.position === index - 1);
        const pitch = current && neighbour
            ? Math.abs(centreOf(neighbour) - centreOf(current))
            : (current?.width || stage.width || 1) + slideGap(stage.width);
        [...track.children].forEach((node) => {
            const item = layout.items.find(
                (entry) => entry.position === Number(node.dataset.slideIndex),
            );
            if (!item) return;
            node.style.setProperty('--d', String(Math.abs(camera - centreOf(item)) / (pitch || 1)));
        });
    }, [layout, offsetFor, index, stage.width]);

    /* Fin du geste: distances entieres, transitions rendues. Il FAUT les
       reecrire a la main - React ne reecrirait pas une valeur qu'il croit
       inchangee, et la fraction du geste resterait collee dans le DOM. */
    const restDistances = useCallback((centre) => {
        const track = trackRef.current;
        if (!track) return;
        track.removeAttribute('data-dragging');
        [...track.children].forEach((node) => {
            node.style.setProperty(
                '--d',
                String(Math.abs(Number(node.dataset.slideIndex) - centre)),
            );
        });
    }, []);

    /* Recentrage instantane a chaque changement de photo ou de taille. */
    useLayoutEffect(() => {
        if (!layout) return;
        setTrackX(offsetFor(index), false);
        slidingRef.current = false;
    }, [layout, index, offsetFor, setTrackX]);

    /*
     * Ouverture: la photo est CUEILLIE sur sa tuile.
     *
     * Symetrique de la fermeture. Sans ca, la photo apparaissait au centre et
     * la tuile qu'on venait de cliquer n'avait plus aucun rapport avec elle -
     * on perdait le lien entre le geste et son resultat.
     *
     * Seule la photo centrale fait ce trajet; les voisines montent en fondu par
     * CSS, 150 ms plus tard (elles n'ont pas de tuile d'origine dans le geste
     * de l'utilisateur).
     *
     * L'effet attend `layout`: au tout premier rendu la scene n'est pas encore
     * mesuree, donc AUCUNE diapositive n'existe. Un effet a dependances vides
     * ne trouverait rien et le trajet ne se jouerait jamais.
     */
    const flownRef = useRef(false);
    useLayoutEffect(() => {
        if (flownRef.current || !layout) return;
        const active = trackRef.current?.querySelector(
            `[data-slide-index="${index}"] [data-enter]`,
        );
        const origin = photo ? getTileRect?.(photo.id) : null;
        flownRef.current = true;
        if (!active || !origin?.width) return;
        const to = active.getBoundingClientRect();
        if (!to.width) return;
        const scale = origin.width / to.width;
        const dx = (origin.left + origin.width / 2) - (to.left + to.width / 2);
        const dy = (origin.top + origin.height / 2) - (to.top + to.height / 2);
        active.animate(
            [
                { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`, opacity: 0.55 },
                { transform: 'none', opacity: 1 },
            ],
            { duration: 780, easing: FLIGHT, fill: 'backwards' },
        );
    }, [layout, index, photo, getTileRect]);

    /* Passe l'entree, on redevient un carrousel ordinaire: sinon le zoom
       d'ouverture se rejouerait a chaque photo. */
    useEffect(() => {
        const id = window.setTimeout(() => {
            setState((current) => (current === 'open' ? 'idle' : current));
        }, ENTER_MS);
        return () => window.clearTimeout(id);
    }, []);

    const slideTo = useCallback((next) => {
        if (slidingRef.current || state === 'closing') return;
        if (next < 0 || next >= photos.length || next === index) return;
        setState((current) => (current === 'open' ? 'idle' : current));
        /* Saut lointain (frise): bascule directe. Glisser sur dix photos
           n'aurait aucun sens. */
        if (Math.abs(next - index) !== 1 || !layout) {
            onIndexChange(next);
            return;
        }
        slidingRef.current = true;
        setPending(next);
        restDistances(next);
        setTrackX(offsetFor(next), true);
        later(() => {
            setPending(null);
            onIndexChange(next);
        }, SLIDE_MS);
    }, [state, photos.length, index, layout, offsetFor, setTrackX, onIndexChange, later, restDistances]);

    /* ---------- Fermeture ---------- */
    /*
     * La photo est RENVOYEE a sa tuile, elle ne s'efface pas sur place.
     *
     * La position d'arrivee ne peut pas etre lue sur la tuile: a cet instant la
     * grille est encore agrandie et en train de revenir, donc son rectangle a
     * l'ecran est faux. `getTileRect` la calcule depuis la masonry et depuis la
     * position de la grille relevee AU MOMENT DE L'OUVERTURE, quand elle etait
     * encore a l'echelle 1. C'est exact, et ca ne depend d'aucune animation en
     * cours.
     *
     * L'echelle du trajet est uniforme (calculee sur la largeur): une tuile
     * n'a pas toujours exactement le rapport de sa photo - la masonry borne les
     * formats extremes - et une echelle a deux axes deformerait la photo en
     * plein vol.
     */
    const close = useCallback(() => {
        if (state === 'closing') return;
        setState('closing');
        /* La grille repart vers sa taille normale MAINTENANT, pas quand le
           carrousel aura disparu: les deux mouvements doivent se croiser. */
        onCloseStart?.();

        const frame = trackRef.current?.querySelector(
            `[data-slide-index="${index}"] [data-enter]`,
        );
        if (frame) {
            const from = frame.getBoundingClientRect();
            const target = photo ? getTileRect?.(photo.id) : null;
            /* Tuile hors champ (on a navigue loin dans la collection): un
               trajet vers un point invisible ne veut rien dire, on se contente
               de reculer sur place. */
            const reachable = target && target.width && from.width
                && target.top < window.innerHeight && target.top + target.height > 0;
            const keyframes = reachable
                ? (() => {
                    const scale = target.width / from.width;
                    const dx = (target.left + target.width / 2) - (from.left + from.width / 2);
                    const dy = (target.top + target.height / 2) - (from.top + from.height / 2);
                    return [
                        { transform: 'none', opacity: 1 },
                        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`, opacity: 0.9 },
                    ];
                })()
                : [
                    { transform: 'none', opacity: 1 },
                    { transform: 'scale(0.93) translate3d(0, 14px, 0)', opacity: 0 },
                ];
            frame.animate(keyframes, {
                duration: reachable ? CLOSE_MS : 320,
                easing: reachable ? FLIGHT : 'cubic-bezier(0.4, 0, 1, 1)',
                fill: 'forwards',
            });
        }

        later(() => onClose(), CLOSE_MS);
    }, [state, onClose, onCloseStart, later, index, photo, getTileRect]);

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
        if (slidingRef.current || state === 'closing') return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        dragRef.current = {
            startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, axis: null,
        };
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
            const shift = atEdge ? drag.dx * 0.3 : drag.dx;
            trackRef.current?.setAttribute('data-dragging', 'true');
            setTrackX(offsetFor(index) + shift, false);
            writeDistances(shift);
        } else if (drag.axis === 'y' && stageRef.current) {
            const progress = Math.min(1, Math.abs(drag.dy) / 420);
            stageRef.current.style.transition = 'none';
            stageRef.current.style.transform = `translate3d(0, ${drag.dy}px, 0) scale(${1 - progress * 0.12})`;
        }
    };

    const onPointerUp = (event) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;

        trackRef.current?.removeAttribute('data-dragging');

        if (!drag.axis) {
            /* Simple clic: sur une voisine on y va, ailleurs on ferme - comme
               dans Photos. Sur la photo courante, rien. */
            const slide = event.target?.closest?.('[data-slide-index]');
            if (!slide) { close(); return; }
            const target = Number(slide.dataset.slideIndex);
            if (Number.isFinite(target) && target !== index) slideTo(target);
            return;
        }

        if (drag.axis === 'y') {
            /* Assez loin vers le haut ou le bas: on ferme. */
            if (Math.abs(drag.dy) > 140) { close(); return; }
            if (stageRef.current) {
                stageRef.current.style.transition = `transform ${SLIDE_MS}ms ${EXPO}`;
                stageRef.current.style.transform = 'none';
            }
            return;
        }

        const current = layout?.items.find((entry) => entry.position === index);
        const threshold = (current?.width || stage.width || window.innerWidth) * SWIPE_RATIO;
        if (drag.dx <= -threshold && index < photos.length - 1) slideTo(index + 1);
        else if (drag.dx >= threshold && index > 0) slideTo(index - 1);
        else {
            restDistances(index);
            setTrackX(offsetFor(index), true);
        }
    };

    /* La frise n'est pas dans la reference: elle ne s'invite que quand la
       souris descend la chercher. */
    const onRootPointerMove = (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        setStrip(event.clientY > window.innerHeight - STRIP_ZONE);
    };

    const exifLine = useMemo(() => describeExif(photo?.exif).join(' · '), [photo]);

    if (!photo) return null;

    const facts = [
        { key: 'device', icon: <Smartphone size={11} />, label: deviceLabel(photo) },
        photo.preset ? { key: 'preset', icon: <Wand2 size={11} />, label: photo.preset.label } : null,
        photo.takenAt ? { key: 'date', icon: <Calendar size={11} />, label: formatDate(photo.takenAt) } : null,
        exifLine ? { key: 'exif', icon: null, label: exifLine } : null,
    ].filter(Boolean);

    return (
        <div
            className={styles.lightbox}
            role="dialog"
            aria-modal="true"
            aria-label={photo.name}
            data-state={state}
            data-strip={strip ? 'true' : 'false'}
            /* L'ecart entre diapositives vit dans une variable CSS et non en
               style direct sur le rail: le rail, lui, recoit son `transform`
               a la main pendant les gestes, et React ne doit rien y ecrire. */
            style={{ '--vo-slide-gap': `${slideGap(stage.width)}px` }}
            onPointerMove={onRootPointerMove}
        >
            <div className={styles.lightboxBackdrop} aria-hidden="true" />

            <header className={styles.lightboxBar}>
                <span className={styles.lightboxCount} data-numeric>
                    {index + 1} / {photos.length}
                </span>
                <div className={styles.lightboxActions}>
                    <button
                        type="button"
                        className={styles.lightboxButton}
                        onClick={() => onEdit(photo)}
                        disabled={opening}
                        aria-busy={opening ? 'true' : undefined}
                        data-testid="vibeos-library-lightbox-edit"
                    >
                        <Wand2 size={13} />
                        {opening ? 'Ouverture…' : 'Retoucher'}
                    </button>
                    <a
                        className={styles.lightboxIcon}
                        href={fullUrl(photo)}
                        download={photo.name}
                        aria-label="Télécharger la photo"
                        title="Télécharger"
                    >
                        <Download size={15} />
                    </a>
                    <button
                        type="button"
                        className={styles.lightboxIcon}
                        onClick={() => onDelete(photo)}
                        aria-label="Supprimer la photo"
                        title="Supprimer"
                    >
                        <Trash2 size={15} />
                    </button>
                    <button
                        type="button"
                        className={styles.lightboxIcon}
                        onClick={close}
                        aria-label="Fermer"
                        title="Fermer (Échap)"
                    >
                        <X size={15} />
                    </button>
                </div>
            </header>

            <div
                ref={attachStage}
                className={styles.lightboxStage}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                data-testid="vibeos-library-lightbox"
            >
                <div ref={trackRef} className={styles.lightboxTrack}>
                    {layout?.items.map((item) => (
                        <Slide
                            key={item.photo.id}
                            photo={item.photo}
                            position={item.position}
                            distance={Math.abs(item.position - visual)}
                            width={item.width}
                            height={item.height}
                            onNeedPixels={onNeedPixels}
                        />
                    ))}
                </div>
            </div>

            {index > 0 ? (
                <button
                    type="button"
                    className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
                    onClick={() => slideTo(index - 1)}
                    aria-label="Photo précédente"
                >
                    <ChevronLeft size={20} />
                </button>
            ) : null}
            {index < photos.length - 1 ? (
                <button
                    type="button"
                    className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
                    onClick={() => slideTo(index + 1)}
                    aria-label="Photo suivante"
                >
                    <ChevronRight size={20} />
                </button>
            ) : null}

            <div className={styles.filmstrip} aria-label="Toutes les photos" role="group">
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
                            if (node && itemIndex === index && strip) {
                                node.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
                            }
                        }}
                    >
                        <img src={thumbUrl(item)} alt="" />
                    </button>
                ))}
            </div>

            <footer className={styles.metaBar}>
                <div className={styles.metaFacts}>
                    {facts.map((fact, factIndex) => (
                        <React.Fragment key={fact.key}>
                            {factIndex > 0 ? <span className={styles.metaSep} aria-hidden="true">·</span> : null}
                            <span className={styles.metaFact}>
                                {fact.icon}
                                {fact.label}
                            </span>
                        </React.Fragment>
                    ))}
                </div>
                <span className={styles.metaFile}>{photo.name}</span>
            </footer>
        </div>
    );
}
