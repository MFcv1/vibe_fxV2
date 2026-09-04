/*
 * Registre des templates : les 62 animations, rangees en 9 familles.
 *
 * Un template n'est qu'un objet `{id, name, category, slots, loop, params,
 * build(ctx)}`. `build` rend une liste de quads 3D pour un temps donne ; le
 * moteur ne sait rien d'autre. En ajouter un ne demande donc jamais de toucher
 * au renderer.
 */

import { showcaseStream, coverRing, coverRingVertical } from './rings.js';
import {
    sphereWall, sphereCascade, totemWall, parallaxTotem,
} from './walls.js';
import { cardGlobe, orbitGlobe } from './globes.js';
import { cardTunnel } from './tunnel.js';
import { spiralStream } from './spiral.js';
import { depthStackScroll } from './depth.js';
import {
    orbitShowcase, orbitBloom, orbitCarousel, photoOrbit, focusOrbit,
    vortexSpin, wheelSpin, wheelSpinBottom,
} from './orbits.js';
import {
    cardTotem, filmStrip, wheelCarousel, coverFlow, coverFlowVertical,
    carouselFlow, diagonalCarousel, focusSlider, mosaicMarquee, heroReel,
} from './flow.js';
import {
    gridReveal, spotlightZoom, flipGrid, popGrid,
    tickerLoop, tickerTilt, columnDrift, feedScroll,
} from './grids.js';
import {
    centerStage, focusShift, deckPeel, zoomParallax,
} from './spotlight.js';
import {
    diagonalWipe, stripeReveal, splitReveal, mosaicWipe,
} from './wipes.js';
import {
    stackSlide, cascadeDrop, cascadeDeck, imageTrail,
    posterBurst, cardToss, positionDance,
} from './stacks.js';
import { isoCascade, isoFocus, isoOrbit } from './iso.js';
import {
    tripleScene, collageReel, fanShuffle, gridZoomStrip, spreadRows, spreadColumns,
} from './multiscene.js';

export const TEMPLATES = [
    // 3D & Perspective
    showcaseStream, sphereWall, cardGlobe, orbitGlobe, sphereCascade, totemWall,
    parallaxTotem, cardTunnel, spiralStream, depthStackScroll, coverRing, coverRingVertical,
    // Multiscene
    tripleScene, collageReel, fanShuffle, gridZoomStrip, spreadRows, spreadColumns,
    // Isometric
    isoCascade, isoFocus, isoOrbit,
    // Orbit
    orbitShowcase, orbitBloom, orbitCarousel, photoOrbit, focusOrbit,
    vortexSpin, wheelSpin, wheelSpinBottom,
    // Carousel & Flow
    cardTotem, filmStrip, wheelCarousel, coverFlow, coverFlowVertical,
    carouselFlow, diagonalCarousel, focusSlider, mosaicMarquee, heroReel,
    // Grid
    gridReveal, spotlightZoom, flipGrid, popGrid,
    tickerLoop, tickerTilt, columnDrift, feedScroll,
    // Spotlight & Focus
    centerStage, focusShift, deckPeel, zoomParallax,
    // Reveal & Wipe
    diagonalWipe, stripeReveal, splitReveal, mosaicWipe,
    // Stack & Scatter
    stackSlide, cascadeDrop, cascadeDeck, imageTrail,
    posterBurst, cardToss, positionDance,
];

export const CATEGORIES = [
    { id: '3d', label: '3D & Perspective' },
    { id: 'multiscene', label: 'Multiscene' },
    { id: 'iso', label: 'Isometric' },
    { id: 'orbit', label: 'Orbit' },
    { id: 'flow', label: 'Carousel & Flow' },
    { id: 'grid', label: 'Grid' },
    { id: 'spotlight', label: 'Spotlight & Focus' },
    { id: 'wipe', label: 'Reveal & Wipe' },
    { id: 'stack', label: 'Stack & Scatter' },
];

export const byId = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

/* Valeurs par defaut d'un template, lues directement dans son schema. */
export function defaultParams(template) {
    const out = {};
    template.params.forEach((p) => {
        if (p.t === 'section' || p.t === 'shadow') return;
        out[p.k] = p.def;
    });
    return out;
}
