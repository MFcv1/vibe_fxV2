/*
 * Catalogue de mouvements - couche PRESENTATION.
 * `engineId` doit correspondre a un preset de IMAGE_MOTION_PRESETS (mediaModel.js).
 * `availability: 'planned'` = pas encore dans le moteur (phase P6), on ne le propose
 * jamais comme applicable: la bibliotheque doit rester honnete.
 */

export const MOTION_GROUPS = [
    { id: 'camera', label: 'Caméra' },
    { id: 'depth', label: 'Profondeur' },
    { id: 'accent', label: 'Accent' },
];

export const MOTION_CATALOG = [
    {
        id: 'none',
        engineId: 'none',
        group: 'camera',
        name: 'Fixe',
        description: 'Cadre stable, aucun mouvement',
        availability: 'available',
        motionPreview: { from: { scale: 1, x: 0, y: 0 }, to: { scale: 1, x: 0, y: 0 } },
    },
    {
        id: 'zoom-in',
        engineId: 'zoom-in',
        group: 'camera',
        name: 'Zoom avant',
        description: 'Approche progressive du sujet',
        availability: 'available',
        motionPreview: { from: { scale: 1, x: 0, y: 0 }, to: { scale: 1.16, x: 0, y: 0 } },
    },
    {
        id: 'zoom-out',
        engineId: 'zoom-out',
        group: 'camera',
        name: 'Zoom arrière',
        description: 'Ouverture progressive du cadre',
        availability: 'available',
        motionPreview: { from: { scale: 1.16, x: 0, y: 0 }, to: { scale: 1, x: 0, y: 0 } },
    },
    {
        id: 'pan-left',
        engineId: 'pan-left',
        group: 'camera',
        name: 'Panoramique gauche',
        description: 'Glissement latéral vers la gauche',
        availability: 'available',
        motionPreview: { from: { scale: 1.12, x: 6, y: 0 }, to: { scale: 1.12, x: -6, y: 0 } },
    },
    {
        id: 'pan-right',
        engineId: 'pan-right',
        group: 'camera',
        name: 'Panoramique droite',
        description: 'Glissement latéral vers la droite',
        availability: 'available',
        motionPreview: { from: { scale: 1.12, x: -6, y: 0 }, to: { scale: 1.12, x: 6, y: 0 } },
    },
    {
        id: 'drift-up',
        engineId: 'drift-up',
        group: 'camera',
        name: 'Montée douce',
        description: 'Mouvement vertical ascendant',
        availability: 'available',
        motionPreview: { from: { scale: 1.1, x: 0, y: 5 }, to: { scale: 1.14, x: 0, y: -5 } },
    },
    {
        id: 'drift-down',
        engineId: 'drift-down',
        group: 'camera',
        name: 'Descente douce',
        description: 'Mouvement vertical descendant',
        availability: 'available',
        motionPreview: { from: { scale: 1.14, x: 0, y: -5 }, to: { scale: 1.1, x: 0, y: 5 } },
    },
    {
        id: 'orbit',
        engineId: 'orbit',
        group: 'depth',
        name: 'Orbite',
        description: 'Trajet courbe autour du sujet',
        availability: 'available',
        motionPreview: { from: { scale: 1.16, x: -5, y: 0 }, to: { scale: 1.16, x: 5, y: 0 } },
    },
    {
        id: 'rotate',
        engineId: 'rotate',
        group: 'depth',
        name: 'Rotation',
        description: 'Légère bascule de l’image',
        availability: 'available',
        motionPreview: { from: { scale: 1.12, x: 0, y: 0, rotate: -3 }, to: { scale: 1.12, x: 0, y: 0, rotate: 3 } },
    },
    {
        id: 'appear',
        engineId: 'appear',
        group: 'accent',
        name: 'Apparition',
        description: 'Entrée en fondu, l’image se pose',
        availability: 'available',
        motionPreview: { from: { scale: 1.06, x: 0, y: 0, opacity: 0 }, to: { scale: 1, x: 0, y: 0, opacity: 1 } },
    },
    {
        id: 'bounce',
        engineId: 'bounce',
        group: 'accent',
        name: 'Rebond',
        description: 'Arrivée qui dépasse puis se pose',
        availability: 'available',
        motionPreview: { from: { scale: 1.18, x: 0, y: 5 }, to: { scale: 1.04, x: 0, y: 0 } },
    },
    {
        id: 'glitch',
        engineId: 'glitch',
        group: 'accent',
        name: 'Glitch',
        description: 'Décrochages horizontaux brefs',
        availability: 'available',
        motionPreview: { from: { scale: 1.08, x: 0, y: 0 }, to: { scale: 1.08, x: 3, y: 0 } },
    },
];

export function getAvailableMotions() {
    return MOTION_CATALOG.filter((motion) => motion.availability === 'available');
}

export function getMotionById(id) {
    return MOTION_CATALOG.find((motion) => motion.id === id) || null;
}
