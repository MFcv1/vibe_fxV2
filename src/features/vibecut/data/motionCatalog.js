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
        engineId: null,
        group: 'camera',
        name: 'Descente douce',
        description: 'Mouvement vertical descendant',
        availability: 'planned',
        motionPreview: { from: { scale: 1.14, x: 0, y: -5 }, to: { scale: 1.1, x: 0, y: 5 } },
    },
    {
        id: 'orbit',
        engineId: null,
        group: 'depth',
        name: 'Orbite',
        description: 'Rotation circulaire autour du sujet',
        availability: 'planned',
        motionPreview: { from: { scale: 1.12, x: -5, y: 4 }, to: { scale: 1.12, x: 5, y: -4 } },
    },
    {
        id: 'parallax',
        engineId: null,
        group: 'depth',
        name: 'Parallaxe',
        description: 'Plans avant et arrière à vitesses différentes',
        availability: 'planned',
        motionPreview: { from: { scale: 1.08, x: -4, y: 0 }, to: { scale: 1.2, x: 4, y: 0 } },
    },
    {
        id: 'rotate',
        engineId: null,
        group: 'depth',
        name: 'Rotation',
        description: 'Légère bascule de l’image',
        availability: 'planned',
        motionPreview: { from: { scale: 1.12, x: 0, y: 0, rotate: -3 }, to: { scale: 1.12, x: 0, y: 0, rotate: 3 } },
    },
    {
        id: 'appear',
        engineId: null,
        group: 'accent',
        name: 'Apparition',
        description: 'Entrée en fondu et léger agrandissement',
        availability: 'planned',
        motionPreview: { from: { scale: 0.94, x: 0, y: 0, opacity: 0 }, to: { scale: 1, x: 0, y: 0, opacity: 1 } },
    },
    {
        id: 'bounce',
        engineId: null,
        group: 'accent',
        name: 'Rebond',
        description: 'Arrivée avec rebond élastique',
        availability: 'planned',
        motionPreview: { from: { scale: 0.9, x: 0, y: 6 }, to: { scale: 1.04, x: 0, y: 0 } },
    },
    {
        id: 'glitch',
        engineId: null,
        group: 'accent',
        name: 'Glitch',
        description: 'Décalage numérique bref',
        availability: 'planned',
        motionPreview: { from: { scale: 1.05, x: -3, y: 0 }, to: { scale: 1.05, x: 3, y: 0 } },
    },
];

export function getAvailableMotions() {
    return MOTION_CATALOG.filter((motion) => motion.availability === 'available');
}

export function getMotionById(id) {
    return MOTION_CATALOG.find((motion) => motion.id === id) || null;
}
