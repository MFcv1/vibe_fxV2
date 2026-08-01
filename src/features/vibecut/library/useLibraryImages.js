"use client";

/*
 * Charge les deux images que les vignettes des bibliotheques enchainent.
 *
 * Ce sont les miniatures REELLES du projet courant, comme les cartes de preset du
 * lot L4. Quand le projet est vide - ou que l'extraction des miniatures n'est pas
 * finie - on retombe sur deux scenes dessinees au canvas, pour que l'ecran reste
 * demonstratif sans jamais pretendre montrer des medias qui n'existent pas.
 *
 * Le repli est DESSINE et non charge: `renderXfadeTransition` a besoin de sources
 * dessinables immediatement, et faire transiter une illustration React par un
 * `data:image/svg+xml` imposerait `react-dom/server` dans un composant client
 * pour un resultat identique.
 *
 * Le repli est aussi DERIVE, jamais ecrit depuis un effet: seul le chargement
 * asynchrone des vraies miniatures pose un etat. Une bibliotheque qui commencerait
 * par un rendu vide avant de se remplir ferait clignoter quarante vignettes.
 */

import { useEffect, useMemo, useState } from 'react';

const FALLBACK_WIDTH = 480;
const FALLBACK_HEIGHT = 300;

/*
 * Deux scenes franchement differentes - un ciel chaud, une nuit froide - parce
 * qu'une transition entre deux images qui se ressemblent ne se voit pas. Aucun
 * asset externe, conformement a la regle de la phase 1.
 */
const FALLBACK_SCENES = [
    { sky: ['#f6b26b', '#e06c4f'], ground: '#3a2440', disc: '#fff0d0', discY: 0.56 },
    { sky: ['#2b3a67', '#101528'], ground: '#0a0d18', disc: '#c9d6ff', discY: 0.32 },
];

/* Dessine une fois par session: deux canvas, partages par toutes les vignettes. */
let fallbackCache = null;

function drawFallbackScene(index) {
    const canvas = document.createElement('canvas');
    canvas.width = FALLBACK_WIDTH;
    canvas.height = FALLBACK_HEIGHT;
    const ctx = canvas.getContext('2d');
    const scene = FALLBACK_SCENES[index % FALLBACK_SCENES.length];

    const sky = ctx.createLinearGradient(0, 0, 0, FALLBACK_HEIGHT);
    sky.addColorStop(0, scene.sky[0]);
    sky.addColorStop(1, scene.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FALLBACK_WIDTH, FALLBACK_HEIGHT);

    ctx.fillStyle = scene.disc;
    ctx.beginPath();
    ctx.arc(FALLBACK_WIDTH * 0.68, FALLBACK_HEIGHT * scene.discY, FALLBACK_HEIGHT * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = scene.ground;
    ctx.beginPath();
    ctx.moveTo(0, FALLBACK_HEIGHT);
    ctx.lineTo(0, FALLBACK_HEIGHT * 0.72);
    ctx.lineTo(FALLBACK_WIDTH * 0.32, FALLBACK_HEIGHT * 0.52);
    ctx.lineTo(FALLBACK_WIDTH * 0.58, FALLBACK_HEIGHT * 0.74);
    ctx.lineTo(FALLBACK_WIDTH * 0.78, FALLBACK_HEIGHT * 0.6);
    ctx.lineTo(FALLBACK_WIDTH, FALLBACK_HEIGHT * 0.78);
    ctx.lineTo(FALLBACK_WIDTH, FALLBACK_HEIGHT);
    ctx.closePath();
    ctx.fill();

    return canvas;
}

function getFallbackImages() {
    if (typeof document === 'undefined') return { from: null, to: null, real: false, ready: false };
    if (!fallbackCache) {
        fallbackCache = { from: drawFallbackScene(0), to: drawFallbackScene(1), real: false, ready: true };
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

export default function useLibraryImages(scenes = []) {
    const thumbnails = useMemo(
        () => scenes.map((scene) => scene.thumbnail).filter(Boolean),
        [scenes],
    );

    const [loaded, setLoaded] = useState(null);

    useEffect(() => {
        if (thumbnails.length === 0) return undefined;
        let cancelled = false;

        /*
         * Une seule photo: on l'enchaine avec une scene de repli plutot qu'avec
         * elle-meme - une transition entre deux images identiques ne montre rien.
         */
        const wanted = thumbnails.length >= 2 ? [thumbnails[0], thumbnails[1]] : [thumbnails[0]];
        Promise.all(wanted.map(loadImage)).then(([from, to]) => {
            if (cancelled || !from) return;
            setLoaded({ from, to: to || getFallbackImages().to, real: true, ready: true });
        });

        return () => { cancelled = true; };
    }, [thumbnails]);

    /*
     * Tant que les vraies miniatures ne sont pas chargees, on rend le repli: la
     * bibliotheque est immediatement demonstrative, et se remplace ensuite par
     * les images de l'utilisateur.
     */
    return useMemo(() => {
        if (loaded && thumbnails.length > 0) return loaded;
        return getFallbackImages();
    }, [loaded, thumbnails.length]);
}
