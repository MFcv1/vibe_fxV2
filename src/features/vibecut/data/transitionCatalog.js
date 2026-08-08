/*
 * Catalogue de transitions - couche PRESENTATION.
 * `engineId` doit exister dans TRANSITIONS (VideoEngine.js). La compatibilite
 * export serveur est lue a l'execution via getServerRenderCapabilityStatus, jamais
 * codee en dur ici: aperçu et export doivent toujours dire la meme chose.
 */

export const TRANSITION_GROUPS = [
    { id: 'essential', label: 'Essentielles', hint: 'Les valeurs sûres, lisibles partout' },
    { id: 'soft', label: 'Douces', hint: 'Fondus et flous progressifs' },
    { id: 'dynamic', label: 'Dynamiques', hint: 'Mouvement marqué, rythme social' },
    { id: 'wipe', label: 'Glissements & volets', hint: 'Balayages, poussées et iris — tous exportables' },
    { id: 'light', label: 'Lumière', hint: 'Flashs et fuites lumineuses' },
    { id: 'stylized', label: 'Stylisées', hint: 'Effets numériques assumés' },
    { id: 'sequence', label: 'Ouverture & fin', hint: 'Intro et outro de séquence' },
];

/*
 * `peak` - LE POINT CULMINANT, ajoute au lot B1.
 *
 * Au repos, une vignette se fige a cet instant-la plutot qu'a l'instant 0: un
 * fondu enchaine a t=0 ne ressemble a rien, et une grille figee au depart serait
 * trente-huit fois la MEME image. Le milieu convient a presque tout; les
 * transitions qui passent par un aplat uniforme (noir, blanc, flash) s'arretent
 * plus tot, sinon leur vignette ne montrerait qu'un cadre vide.
 */
export const TRANSITION_PEAK_DEFAULT = 0.5;

/*
 * `usage` - A QUOI SERT L'ENTREE, ajoute au lot B3b (2026-08-03).
 *
 * Decision du porteur du projet : les ouvertures de sequence restent des
 * transitions et sont rendues a l'export comme les autres, mais la bibliotheque
 * doit DIRE qu'elles sont pensees pour le debut (ou la fin) d'un montage. Elles
 * fonctionnent au milieu, simplement ce n'est pas ce pour quoi elles sont faites,
 * et rien ne le laissait deviner.
 *
 * Deux rognages par le noir (`iris-black`, `frame-black`) n'en portent pas : ils
 * marchent aussi bien au milieu d'un montage qu'a ses extremites.
 */
export const TRANSITION_USAGES = Object.freeze({
    opening: Object.freeze({ id: 'opening', label: 'Ouverture', hint: 'Pensée pour démarrer une séquence' }),
    closing: Object.freeze({ id: 'closing', label: 'Fin', hint: 'Pensée pour terminer une séquence' }),
});

export const TRANSITION_CATALOG = [
    { id: 'crossfade', engineId: 'crossfade', group: 'essential', name: 'Fondu enchaîné', description: 'Passage transparent entre deux scènes', preview: 'dissolve', defaultDuration: 0.8 },
    { id: 'smooth-cut', engineId: 'smooth-cut', group: 'essential', name: 'Coupe adoucie', description: 'Coupe nette, transition très courte', preview: 'dissolve', defaultDuration: 0.45 },
    { id: 'dip-black', peak: 0.3, engineId: 'dip-black', group: 'essential', name: 'Passage au noir', description: 'Respiration cinéma entre deux séquences', preview: 'dip-black', defaultDuration: 0.65 },
    { id: 'dip-white', peak: 0.3, engineId: 'dip-white', group: 'essential', name: 'Passage au blanc', description: 'Rupture douce et lumineuse', preview: 'dip-white', defaultDuration: 0.55 },

    { id: 'film-dissolve', engineId: 'film-dissolve', group: 'soft', name: 'Dissolution film', description: 'Fondu naturel, rendu argentique', preview: 'dissolve', defaultDuration: 0.9 },
    { id: 'desat-fade', engineId: 'desat-fade', group: 'soft', name: 'Fondu désaturé', description: 'La couleur se retire puis revient', preview: 'dissolve', defaultDuration: 0.8 },
    { id: 'non-additive-dissolve', engineId: 'non-additive-dissolve', group: 'soft', name: 'Dissolution douce', description: 'Fondu long et regulier, sans surexposition', preview: 'dissolve', defaultDuration: 0.75 },
    { id: 'additive-dissolve', peak: 0.3, engineId: 'additive-dissolve', group: 'soft', name: 'Dissolution lumineuse', description: 'Fondu avec montée de lumière', preview: 'dip-white', defaultDuration: 0.65 },
    { id: 'blur-dissolve', engineId: 'blur-dissolve', group: 'soft', name: 'Fondu flouté', description: 'Flou progressif pendant le fondu', preview: 'blur', defaultDuration: 0.65 },
    { id: 'cross-blur', engineId: 'cross-blur', group: 'soft', name: 'Flou croisé', description: 'Les deux scènes se floutent ensemble', preview: 'blur', defaultDuration: 0.6 },

    { id: 'whip-pan', engineId: 'whip-pan', group: 'dynamic', name: 'Balayage rapide', description: 'La scène suivante chasse la précédente vers la gauche, très vite', preview: 'slide', defaultDuration: 0.42 },
    { id: 'squeeze-h', engineId: 'squeeze-h', group: 'dynamic', name: 'Compression verticale', description: 'La scène en cours s’écrase vers une ligne, la suivante est déjà derrière', preview: 'slide', defaultDuration: 0.6 },
    { id: 'motion-blur', engineId: 'motion-blur', group: 'dynamic', name: 'Flou de mouvement', description: 'Traînée directionnelle', preview: 'slide', defaultDuration: 0.5 },
    { id: 'cross-zoom', engineId: 'cross-zoom', group: 'dynamic', name: 'Zoom croisé', description: 'Zoom avant enchaîné sur la scène suivante', preview: 'zoom', defaultDuration: 0.55 },
    { id: 'snap-zoom', engineId: 'snap-zoom', group: 'dynamic', name: 'Zoom sec', description: 'Accélération brutale, très social', preview: 'zoom', defaultDuration: 0.45 },
    { id: 'parallax-zoom', engineId: 'parallax-zoom', group: 'dynamic', name: 'Zoom parallaxe', description: 'Zoom avec décalage de profondeur', preview: 'zoom', defaultDuration: 0.75 },

    /*
     * Famille livree au lot L1 (2026-07-30): chacune est une transition native
     * `xfade` de FFmpeg, rendue a l'identique dans l'apercu par
     * `engine/xfadeTransitions.js`. Ce sont les seules, avec les fondus
     * ci-dessus, qu'un preset guide a le droit d'employer.
     */
    { id: 'swipe-left', engineId: 'swipe-left', group: 'wipe', name: 'Balayage vers la gauche', description: 'Bord adouci, la scène suivante arrive par la droite', preview: 'slide', defaultDuration: 0.6 },
    { id: 'swipe-right', engineId: 'swipe-right', group: 'wipe', name: 'Balayage vers la droite', description: 'Le même balayage, en sens inverse', preview: 'slide', defaultDuration: 0.6 },
    { id: 'swipe-up', engineId: 'swipe-up', group: 'wipe', name: 'Balayage vers le haut', description: 'Bord adouci, la scène suivante monte depuis le bas', preview: 'slide', defaultDuration: 0.6 },
    { id: 'swipe-down', engineId: 'swipe-down', group: 'wipe', name: 'Balayage vers le bas', description: 'Bord adouci, la scène suivante descend depuis le haut', preview: 'slide', defaultDuration: 0.6 },
    { id: 'push-up', engineId: 'push-up', group: 'wipe', name: 'Poussée vers le haut', description: 'La scène suivante pousse la précédente hors cadre', preview: 'slide', defaultDuration: 0.55 },
    { id: 'push-down', engineId: 'push-down', group: 'wipe', name: 'Poussée vers le bas', description: 'Poussée inverse, lecture d’un retour en arrière', preview: 'slide', defaultDuration: 0.55 },
    { id: 'push-right', engineId: 'push-right', group: 'wipe', name: 'Poussée vers la droite', description: 'La scène suivante entre par la gauche et pousse la précédente', preview: 'slide', defaultDuration: 0.55 },
    { id: 'wipe-left', engineId: 'wipe-left', group: 'wipe', name: 'Volet vers la gauche', description: 'Bord net, coupe assumée', preview: 'slide', defaultDuration: 0.5 },
    { id: 'wipe-right', engineId: 'wipe-right', group: 'wipe', name: 'Volet vers la droite', description: 'Bord net, dévoilé depuis la gauche', preview: 'slide', defaultDuration: 0.5 },
    { id: 'wipe-up', engineId: 'wipe-up', group: 'wipe', name: 'Volet vers le haut', description: 'Bord net, dévoilé depuis le bas', preview: 'slide', defaultDuration: 0.5 },
    { id: 'wipe-down', engineId: 'wipe-down', group: 'wipe', name: 'Volet vers le bas', description: 'Bord net, dévoilé depuis le haut', preview: 'slide', defaultDuration: 0.5 },
    { id: 'blinds-open', engineId: 'blinds-open', group: 'wipe', name: 'Ouverture centrale', description: 'La scène suivante s’ouvre depuis l’axe vertical', preview: 'bars', defaultDuration: 0.7 },
    { id: 'bars-close', engineId: 'bars-close', group: 'wipe', name: 'Fermeture horizontale', description: 'Deux bandes se referment depuis le haut et le bas', preview: 'bars', defaultDuration: 0.7 },
    { id: 'iris-open', engineId: 'iris-open', group: 'wipe', name: 'Iris ouvrant', description: 'Cercle qui s’ouvre depuis le centre', preview: 'zoom', defaultDuration: 0.75 },
    { id: 'iris-close', engineId: 'iris-close', group: 'wipe', name: 'Iris fermant', description: 'Cercle qui se referme vers le centre', preview: 'zoom', defaultDuration: 0.75 },
    { id: 'pixel-cut', engineId: 'pixel-cut', group: 'wipe', name: 'Coupe pixellisée', description: 'Les deux images se pixellisent puis se retrouvent', preview: 'glitch', defaultDuration: 0.5 },
    { id: 'blur-cut', engineId: 'blur-cut', group: 'wipe', name: 'Coupe floutée', description: 'Flou horizontal qui monte puis redescend', preview: 'blur', defaultDuration: 0.5 },

    { id: 'flash', peak: 0.3, engineId: 'flash', group: 'light', name: 'Flash', description: 'Coupe sur un éclat lumineux', preview: 'flash', defaultDuration: 0.3 },
    { id: 'light-leak', peak: 0.3, engineId: 'light-leak', group: 'light', name: 'Fuite lumineuse', description: 'Halo chaud qui traverse l’image', preview: 'flash', defaultDuration: 0.8 },
    { id: 'strobe-cut', peak: 0.3, engineId: 'strobe-cut', group: 'light', name: 'Stroboscope', description: 'Alternance rapide, sur temps musical', preview: 'flash', defaultDuration: 0.35 },

    { id: 'glitch', engineId: 'glitch', group: 'stylized', name: 'Glitch', description: 'Rupture numérique brève', preview: 'glitch', defaultDuration: 0.4 },
    { id: 'rgb-split', engineId: 'rgb-split', group: 'stylized', name: 'Décalage RVB', description: 'Séparation des couches couleur', preview: 'glitch', defaultDuration: 0.45 },
    { id: 'chromatic', engineId: 'chromatic', group: 'stylized', name: 'Aberration chromatique', description: 'Dérive colorée sur les bords', preview: 'glitch', defaultDuration: 0.4 },

    { id: 'intro-cinematic-bars', usage: 'opening', engineId: 'intro-cinematic-bars', group: 'sequence', name: 'Ouverture cinéma', description: 'Bandes qui s’écartent au démarrage', preview: 'bars', defaultDuration: 1 },
    { id: 'intro-title-scan', usage: 'opening', engineId: 'intro-title-scan', group: 'sequence', name: 'Ouverture titre', description: 'Balayage horizontal sur le titre', preview: 'bars', defaultDuration: 1.2 },
    { id: 'intro-grid-reveal', usage: 'opening', engineId: 'intro-grid-reveal', group: 'sequence', name: 'Révélation mosaïque', description: 'L’image apparaît par blocs', preview: 'grid', defaultDuration: 0.9 },
    { id: 'intro-neon-doors', usage: 'opening', engineId: 'intro-neon-doors', group: 'sequence', name: 'Ouverture en volets', description: 'Deux volets qui s’ouvrent', preview: 'bars', defaultDuration: 1 },
    /*
     * `peak: 0.22` sur les deux rognages : a mi-parcours ils sont ENTIEREMENT
     * noirs (c'est leur principe), donc une vignette figee a 0,5 serait un carre
     * noir. On la fige la ou l'on voit encore le cadre se retracter.
     */
    { id: 'iris-black', peak: 0.22, engineId: 'iris-black', group: 'sequence', name: 'Iris au noir', description: 'L’image se referme en cercle sur le noir, la suivante rouvre', preview: 'dip-black', defaultDuration: 1 },
    { id: 'frame-black', peak: 0.22, engineId: 'frame-black', group: 'sequence', name: 'Cadre au noir', description: 'L’image se referme en rectangle sur le noir, la suivante rouvre', preview: 'dip-black', defaultDuration: 1 },
    { id: 'outro-cinematic-fade', usage: 'closing', peak: 0.3, engineId: 'outro-cinematic-fade', group: 'sequence', name: 'Fin cinéma', description: 'Fermeture progressive au noir', preview: 'dip-black', defaultDuration: 1 },
    { id: 'outro-neon-close', usage: 'closing', engineId: 'outro-neon-close', group: 'sequence', name: 'Fermeture en volets', description: 'Les volets se referment depuis les deux bords', preview: 'bars', defaultDuration: 1 },
    { id: 'outro-signal-collapse', usage: 'closing', engineId: 'outro-signal-collapse', group: 'sequence', name: 'Coupure signal', description: 'L’image se comprime latéralement jusqu’à disparaître', preview: 'glitch', defaultDuration: 0.9 },
];

export function getTransitionsByGroup(groupId) {
    return TRANSITION_CATALOG.filter((transition) => transition.group === groupId);
}

export function getTransitionById(id) {
    return TRANSITION_CATALOG.find((transition) => transition.id === id) || null;
}

export function getFeaturedTransitions(count = 8) {
    const featuredIds = [
        'crossfade', 'dip-black', 'blur-dissolve', 'whip-pan',
        'cross-zoom', 'flash', 'glitch', 'intro-cinematic-bars',
    ];
    return featuredIds
        .slice(0, count)
        .map((id) => getTransitionById(id))
        .filter(Boolean);
}
