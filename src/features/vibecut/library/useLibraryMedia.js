"use client";

/*
 * LES DEUX SOURCES QUE LES VIGNETTES DES BIBLIOTHEQUES ENCHAINENT (lot B2).
 *
 * Remplace `useLibraryImages`, qui ne savait lire que des miniatures - donc des
 * IMAGES FIXES. Une transition entre deux photos se lit a peu pres ; un
 * mouvement de camera sur une photo se lit mal ; une transition entre deux rushs
 * qui bougent vraiment, c'est autre chose. D'ou cette chaine, dans cet ordre :
 *
 *   1. les VIDEOS du projet courant      - le vrai sujet : le rush de l'auteur
 *   2. les PHOTOS du projet courant      - a defaut, ses images
 *   3. les CLIPS DE DEMONSTRATION        - pour que l'ecran vive avant tout import
 *   4. le REPLI DESSINE                  - si meme les clips ne chargent pas
 *
 * Chaque etage se replie sur le suivant SANS jamais laisser la vignette vide :
 * une video qui ne charge pas, un projet vide, un reseau coupe donnent toujours
 * quelque chose a montrer. Le repli dessine, lui, ne peut pas echouer.
 *
 * TROIS PIEGES, chacun deja paye ailleurs dans ce projet :
 *
 *  - LE TEMPS NE PASSE PAS PAR REACT (bugs 3, 41-43). Une video qui avance ne
 *    declenche aucun rendu : les vignettes lisent l'element `<video>` a chaque
 *    tour de l'horloge partagee. Le seul `setState` ici est le changement
 *    d'ETAGE, qui arrive une fois.
 *  - UNE SEULE PAIRE DE SOURCES pour tout l'ecran. Quarante-huit vignettes ne
 *    decodent pas quarante-huit videos : elles dessinent toutes les deux memes
 *    elements. C'est la meme economie que l'horloge unique de `previewTicker`.
 *  - LES SOURCES SONT MUETTES ET EN BOUCLE. Une bibliotheque qui se met a
 *    parler en arrivant dessus serait insupportable, et le son n'apprend rien
 *    sur une transition.
 *
 * `version()` dit aux vignettes que les PIXELS ont change alors que la
 * progression, elle, n'a pas bouge. Sans lui, une vignette figee (mode FREEZE,
 * `prefers-reduced-motion`) garderait eternellement la premiere image de la
 * video : son cache de rendu est indexe sur la progression seule.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    FALLBACK_HEIGHT,
    FALLBACK_WIDTH,
    paintFallbackScene,
} from './libraryFallbackScene';
import { getPlayableDemoClips } from './libraryMediaManifest';
import { selectProjectSources } from './librarySourceOrder';

/* Dessine une fois par session: deux canvas, partages par toutes les vignettes. */
let fallbackCache = null;

function drawFallbackScene(index) {
    const canvas = document.createElement('canvas');
    canvas.width = FALLBACK_WIDTH;
    canvas.height = FALLBACK_HEIGHT;
    paintFallbackScene(canvas.getContext('2d'), index);
    return canvas;
}

const STATIC_VERSION = () => 0;

function getFallbackMedia() {
    if (typeof document === 'undefined') {
        return { from: null, to: null, real: false, ready: false, kind: 'none', version: STATIC_VERSION };
    }
    if (!fallbackCache) {
        fallbackCache = {
            from: drawFallbackScene(0),
            to: drawFallbackScene(1),
            real: false,
            ready: true,
            kind: 'drawn',
            version: STATIC_VERSION,
        };
    }
    return fallbackCache;
}

function loadImage(src) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

/*
 * Charge une video et la rend PRETE A DESSINER.
 *
 * On attend `loadeddata` et non `canplay` : `canplay` promet qu'on pourra lire,
 * pas qu'une image est disponible, et un `drawImage` sur une video sans image
 * decodee ne leve pas d'erreur - il dessine du vide. La vignette resterait noire
 * sans que rien ne le signale.
 *
 * Le delai de garde evite qu'un fichier absent laisse l'ecran sur son repli
 * indefiniment sans jamais tomber a l'etage suivant.
 */
function loadVideo(src, timeoutMs = 6000) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = src;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';

        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('error', onFail);
            resolve(value);
        };
        const onReady = () => {
            // `play()` peut etre refuse malgre `muted` selon la politique du
            // navigateur: on garde la video quand meme, la premiere image est
            // deja mieux qu'un repli, et le scrub reste pilotable a la main.
            video.play().catch(() => {});
            finish(video);
        };
        const onFail = () => finish(null);
        const timer = setTimeout(onFail, timeoutMs);

        video.addEventListener('loadeddata', onReady);
        video.addEventListener('error', onFail);
        video.load();
    });
}

function releaseVideo(node) {
    if (!node || typeof node.pause !== 'function') return;
    try {
        node.pause();
        node.removeAttribute('src');
        node.load();
    } catch {
        /* Un element deja detache n'a pas besoin d'etre libere. */
    }
}

/*
 * La version des pixels.
 *
 * Pour une video, `currentTime` change a chaque image decodee : c'est exactement
 * le signal cherche. On le quantifie au millieme pour qu'une valeur flottante
 * instable ne fasse pas redessiner quarante-huit vignettes pour rien.
 */
function videoVersion(nodes) {
    return () => {
        let sum = 0;
        for (const node of nodes) {
            if (node && typeof node.currentTime === 'number') sum += Math.round(node.currentTime * 1000);
        }
        return sum;
    };
}

async function resolveSource(source) {
    if (!source) return null;
    const node = source.kind === 'video' ? await loadVideo(source.src) : await loadImage(source.src);
    return node ? { ...source, node } : null;
}

export default function useLibraryMedia(scenes = []) {
    /*
     * La selection est derivee des scenes, pas d'un etat : c'est elle qui sert de
     * cle d'effet. Une chaine stable evite de relancer le chargement a chaque
     * rendu de l'ecran.
     */
    const wanted = useMemo(() => selectProjectSources(scenes), [scenes]);
    const wantedKey = useMemo(
        () => wanted.map((item) => `${item.kind}:${item.src}`).join('|'),
        [wanted],
    );

    const [resolved, setResolved] = useState(null);
    const ownedRef = useRef([]);

    useEffect(() => {
        let cancelled = false;
        const owned = [];

        async function run() {
            /*
             * ETAGES 1 et 2 - le projet. On ne descend a l'etage suivant que si
             * le projet ne donne RIEN d'utilisable, jamais pour completer une
             * paire a moitie chargee : melanger un rush de l'auteur avec un clip
             * de demonstration donnerait une comparaison qui ne veut rien dire.
             */
            const fromProject = (await Promise.all(wanted.map(resolveSource))).filter(Boolean);
            if (cancelled) return;

            if (fromProject.length >= 2) {
                fromProject.forEach((item) => { if (item.kind === 'video') owned.push(item.node); });
                ownedRef.current = owned;
                const videos = fromProject.filter((item) => item.kind === 'video').map((item) => item.node);
                setResolved({
                    from: fromProject[0].node,
                    to: fromProject[1].node,
                    real: true,
                    ready: true,
                    kind: fromProject.every((item) => item.kind === 'video') ? 'video' : 'mixed',
                    version: videos.length ? videoVersion(videos) : STATIC_VERSION,
                });
                return;
            }

            /*
             * Une seule source utilisable: on l'enchaine avec une scene de repli
             * plutot qu'avec elle-meme. Regle heritee de `useLibraryImages`, et
             * toujours vraie.
             */
            if (fromProject.length === 1) {
                const only = fromProject[0];
                if (only.kind === 'video') owned.push(only.node);
                ownedRef.current = owned;
                setResolved({
                    from: only.node,
                    to: getFallbackMedia().to,
                    real: true,
                    ready: true,
                    kind: only.kind === 'video' ? 'mixed' : 'photo',
                    version: only.kind === 'video' ? videoVersion([only.node]) : STATIC_VERSION,
                });
                return;
            }

            /*
             * ETAGE 3 - les clips de demonstration. C'est ce qui fait qu'un
             * visiteur qui n'a rien importe voit quand meme des vignettes
             * VIVANTES. Ils ne sont charges qu'ici : un projet qui a ses propres
             * medias ne paie jamais leur telechargement.
             */
            const clips = getPlayableDemoClips();
            if (clips.length >= 2) {
                const nodes = await Promise.all(clips.slice(0, 2).map((clip) => loadVideo(clip.file)));
                if (cancelled) {
                    nodes.forEach(releaseVideo);
                    return;
                }
                if (nodes[0] && nodes[1]) {
                    nodes.forEach((node) => owned.push(node));
                    ownedRef.current = owned;
                    setResolved({
                        from: nodes[0],
                        to: nodes[1],
                        real: false,
                        ready: true,
                        kind: 'demo',
                        version: videoVersion(nodes),
                    });
                    return;
                }
                nodes.forEach(releaseVideo);
            }

            // ETAGE 4 - le repli dessine. Il ne peut pas echouer.
            if (!cancelled) setResolved(null);
        }

        run();

        return () => {
            cancelled = true;
            owned.forEach(releaseVideo);
            ownedRef.current = [];
        };
    }, [wanted, wantedKey]);

    /*
     * Tant que rien n'est resolu, on rend le repli DESSINE: la bibliotheque est
     * immediatement demonstrative et se remplace ensuite. Une bibliotheque qui
     * commencerait par un rendu vide ferait clignoter quarante-huit vignettes.
     */
    return useMemo(() => resolved || getFallbackMedia(), [resolved]);
}
