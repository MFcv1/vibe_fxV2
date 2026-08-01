/*
 * Recettes de montage - couche DOMAINE de la creation guidee.
 *
 * Ce module est volontairement PUR: aucune dependance, aucun React, aucun import.
 * Il decrit ce qu'un preset produit sur un ensemble de scenes, et rien d'autre.
 * L'application au projet passe par `adapters/useGuidedMontage.js`.
 *
 * ---------------------------------------------------------------------------
 * CE QUI A CHANGE AU LOT L2 (2026-07-30), ET POURQUOI
 *
 * Avant, un style tenait en trois nombres et une teinte: une duree unique pour
 * toutes les photos, UNE transition repetee a l'identique sur toutes les coupes,
 * un look. Trois des quatre styles etaient donc le meme fondu enchaine a trois
 * vitesses - d'ou le constat du porteur du projet: « seul Cinema doux ressort ».
 *
 * Un preset est desormais une PARTITION:
 *
 *   1. beat        - des POIDS par plan, pas une duree fixe. Un montage reel a un
 *                    plan d'ouverture qui respire, un ventre rapide, une fin qui
 *                    tient. `openingHold` / `closingHold` traitent a part le tout
 *                    premier et le tout dernier plan.
 *   2. transitionScore - une SEQUENCE de transitions, plus un accent tous les N
 *                    plans. La coupe n° 1 et la coupe n° 12 ne sont plus
 *                    identiques. `openingTransition` / `closingTransition`
 *                    permettent d'ouvrir et de fermer autrement que le corps.
 *   3. motionScore - une choregraphie, pas un modulo sur trois mouvements.
 *   4. look        - inchange, deja rendu des deux cotes.
 *   5. titleStyle  - traitement du titre. PORTE ICI, PAS ENCORE APPLIQUE (L5).
 *   6. audioProfile- fondus musique. PORTE ICI, PAS ENCORE APPLIQUE (L5).
 *   7. sequencePreset - format recommande.
 *
 * La synergie rythme <-> style demandee est cette formule, et rien d'autre:
 *
 *     duree(scene i) = beatBase(rythme) x beatPattern[i](preset) x holds
 *
 * `beatBase` vient du RYTHME, `beatPattern` vient du PRESET. Changer de rythme
 * accelere le montage sans effacer le caractere long/court du preset, ce qu'un
 * simple multiplicateur global ne savait pas faire.
 * ---------------------------------------------------------------------------
 *
 * Regle de parite: on ne propose ici que ce que le moteur ET le rendu serveur
 * savent faire.
 *   - mouvements: sous-ensemble de SERVER_RENDER_CAPABILITIES.imageMotions
 *   - transitions: sous-ensemble de SERVER_RENDER_CAPABILITIES.timedTransitions,
 *     les 15 transitions livrees au lot L1 et rendues a l'identique par
 *     `engine/xfadeTransitions.js`. Les 27 transitions « maison » du moteur
 *     (glitch, rgb-split, light-leak, intros/outros) n'ont pas d'equivalent
 *     exportable et ne sont JAMAIS employees par un preset guide.
 *   - colorimetrie: rendue des deux cotes.
 * `scripts/smoke-vibecut-style-recipes.mjs` verrouille cette parite.
 */

/* Bornes du moteur (mediaModel.js). Dupliquees ici pour garder le module pur,
 * et verifiees par le smoke contre la source. */
export const MIN_RECIPE_IMAGE_DURATION = 0.5;
export const MAX_RECIPE_IMAGE_DURATION = 60;

/* Mouvements applicables aux photos, tous rendus par le serveur. */
export const RECIPE_MOTIONS = ['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'drift-up'];

/*
 * Transitions employables par un preset. `cut` n'est pas une transition minutee
 * mais l'absence de transition: une coupe franche. Toutes les autres sont des
 * ids de SERVER_RENDER_CAPABILITIES.timedTransitions.
 */
export const RECIPE_TRANSITIONS = [
    'cut',
    'crossfade',
    'dip-black',
    'dip-white',
    'film-dissolve',
    'desat-fade',
    'swipe-left',
    'swipe-right',
    'push-up',
    'push-down',
    'wipe-left',
    'blinds-open',
    'iris-open',
    'iris-close',
    'pixel-cut',
    'blur-cut',
];

/* Noms lisibles, pour le recapitulatif et les puces du storyboard. */
export const TRANSITION_NAMES = Object.freeze({
    cut: 'Coupe franche',
    crossfade: 'Fondu enchaîné',
    'dip-black': 'Passage au noir',
    'dip-white': 'Passage au blanc',
    'film-dissolve': 'Dissolution film',
    'desat-fade': 'Fondu désaturé',
    'swipe-left': 'Balayage vers la gauche',
    'swipe-right': 'Balayage vers la droite',
    'push-up': 'Poussée vers le haut',
    'push-down': 'Poussée vers le bas',
    'wipe-left': 'Volet vers la gauche',
    'blinds-open': 'Ouverture centrale',
    'iris-open': 'Iris ouvrant',
    'iris-close': 'Iris fermant',
    'pixel-cut': 'Coupe pixellisée',
    'blur-cut': 'Coupe floutée',
});

/*
 * Etat neutre complet de la colorimetrie.
 * Un look doit ecraser TOUS les reglages, pas seulement les siens: sinon,
 * changer de preset laisserait la vignette du precedent sur les scenes.
 */
export const NEUTRAL_LOOK = Object.freeze({
    exposure: 0,
    brightness: 100,
    contrast: 100,
    pivot: 50,
    saturation: 100,
    vibrance: 0,
    temperature: 0,
    tint: 0,
    hue: 0,
    shadows: 0,
    midtones: 0,
    highlights: 0,
    fade: 0,
    vignette: 0,
    grain: 0,
});

/* ---------- Rythme ---------- */

/*
 * Le rythme ne porte plus qu'une CADENCE DE BASE et l'ampleur des fondus. La
 * forme du montage (quel plan respire, lequel réattaque) appartient au preset.
 */
export const RHYTHMS = Object.freeze([
    {
        id: 'calme',
        name: 'Calme',
        description: 'Plans longs, on laisse le temps de regarder',
        durationFactor: 1.35,
        transitionFactor: 1.3,
    },
    {
        id: 'equilibre',
        name: 'Équilibré',
        description: 'La cadence prévue par le style',
        durationFactor: 1,
        transitionFactor: 1,
    },
    {
        id: 'soutenu',
        name: 'Soutenu',
        description: 'Plans courts, énergie des réseaux sociaux',
        durationFactor: 0.68,
        transitionFactor: 0.7,
    },
]);

/* ---------- Mouvements ---------- */

/*
 * Le premier choix laisse la choregraphie du preset intacte: c'est elle qui fait
 * une partie de son caractere. Les trois autres sont des surcharges explicites.
 */
export const MOTION_MOODS = Object.freeze([
    {
        id: 'style',
        name: 'Celui du style',
        description: 'La chorégraphie prévue par le preset',
        pattern: null,
    },
    {
        id: 'aucun',
        name: 'Aucun',
        description: 'Photos parfaitement fixes',
        pattern: Object.freeze(['none']),
    },
    {
        id: 'doux',
        name: 'Doux',
        description: 'Zooms lents, alternés d’une photo à l’autre',
        pattern: Object.freeze(['zoom-in', 'zoom-out']),
    },
    {
        id: 'varie',
        name: 'Varié',
        description: 'Zooms et panoramiques qui alternent',
        pattern: Object.freeze(['zoom-in', 'pan-right', 'zoom-out', 'pan-left', 'drift-up']),
    },
]);

/* ---------- Intensite du mouvement (lot L3) ---------- */

/*
 * TROIS CRANS NOMMES, pas un curseur continu: le parcours guide tient a une
 * decision lisible par ecran, et un curseur y ferait entrer un reglage sans
 * repere. Le curseur continu appartient au montage avance.
 *
 * La valeur multiplie l'ECART start -> end du mouvement, des DEUX cotes:
 * `mediaModel.resolveImageMotionFrame` pour l'apercu, l'expression `zoompan` du
 * renderer pour l'export. Meme formule, donc parite par construction.
 * Le cadrage de depart ne bouge pas: baisser l'intensite raccourcit la course,
 * il ne recadre pas la photo.
 *
 * Chaque preset porte l'un de ces trois crans exactement - jamais une valeur
 * intermediaire qui ne pourrait pas s'afficher.
 */
export const MOTION_INTENSITIES = Object.freeze([
    {
        id: 'discret',
        name: 'Discret',
        description: 'Le cadre bouge à peine',
        value: 0.4,
    },
    {
        id: 'naturel',
        name: 'Naturel',
        description: 'Le mouvement se voit sans se remarquer',
        value: 0.7,
    },
    {
        id: 'marque',
        name: 'Marqué',
        description: 'Course complète, énergie assumée',
        value: 1,
    },
]);

/* ---------- Presets ---------- */

/*
 * Six presets, pas douze. Chacun doit etre reconnaissable en une seconde et
 * justifier son existence par une INTENTION distincte, pas par une variation de
 * reglage. « Cinema » est le seul des quatre anciens styles qui plaisait: sa
 * colorimetrie et sa lenteur sont conservees telles quelles, seule sa structure
 * s'enrichit.
 */
export const STYLE_RECIPES = Object.freeze([
    {
        id: 'reel',
        name: 'Reel dynamique',
        description: 'Plans courts et irréguliers, coupes franches, accents balayés',
        bestFor: 'Reels, TikTok, Shorts',
        sequencePreset: 'instagram-reel',
        beat: { base: 2.2, pattern: [1, 0.7, 0.7, 1], openingHold: 1.15, closingHold: 1.2 },
        transitionScore: ['cut'],
        accentEvery: 4,
        accentTransition: 'swipe-left',
        transitionBeatRatio: 0.16,
        motionScore: ['zoom-in', 'zoom-out'],
        motionIntensity: 1,
        motionContinuity: 'alternate',
        look: { contrast: 112, saturation: 112, vibrance: 10, midtones: 3 },
        titleStyle: { size: 'large', position: 'center', boxStyle: 'box', casing: 'upper' },
        audioProfile: { fadeIn: 0.2, fadeOut: 0.8 },
    },
    {
        id: 'cinema',
        name: 'Cinéma',
        description: 'Plans longs qui respirent, fondus amples, passage au noir en fin de chapitre',
        bestFor: 'Voyage, portrait, récit',
        sequencePreset: 'instagram-reel',
        beat: { base: 4, pattern: [1.4, 1, 1, 1.2], openingHold: 1.2, closingHold: 1.35 },
        transitionScore: ['crossfade'],
        accentEvery: 5,
        accentTransition: 'dip-black',
        transitionBeatRatio: 0.22,
        motionScore: ['zoom-in', 'zoom-in', 'zoom-out'],
        motionIntensity: 0.7,
        motionContinuity: 'sustain',
        look: { contrast: 104, saturation: 92, fade: 8, vignette: 14, shadows: -4 },
        titleStyle: { size: 'medium', position: 'bottom', boxStyle: 'none', casing: 'none' },
        audioProfile: { fadeIn: 1.2, fadeOut: 1.8 },
    },
    {
        id: 'souvenir',
        name: 'Souvenirs',
        description: 'Cadence posée, dissolutions argentiques, lumière chaude',
        bestFor: 'Famille, vacances, rétrospective',
        sequencePreset: 'instagram-reel',
        beat: { base: 3.2, pattern: [1.2, 1, 1], openingHold: 1.15, closingHold: 1.3 },
        transitionScore: ['film-dissolve'],
        accentEvery: 4,
        accentTransition: 'dip-white',
        transitionBeatRatio: 0.2,
        motionScore: ['pan-right', 'drift-up', 'pan-left'],
        motionIntensity: 0.7,
        motionContinuity: 'alternate',
        look: { temperature: 22, saturation: 106, fade: 10, vignette: 8, highlights: 4 },
        titleStyle: { size: 'medium', position: 'top', boxStyle: 'outline', casing: 'none' },
        audioProfile: { fadeIn: 1, fadeOut: 1.6 },
    },
    {
        id: 'produit',
        name: 'Produit',
        description: 'Métronomique, coupes nettes, respiration floutée tous les trois plans',
        bestFor: 'Produit, food, immobilier',
        sequencePreset: 'instagram-post',
        beat: { base: 2.4, pattern: [1], openingHold: 1.1, closingHold: 1.15 },
        transitionScore: ['cut'],
        accentEvery: 3,
        accentTransition: 'blur-cut',
        transitionBeatRatio: 0.12,
        motionScore: ['zoom-in'],
        motionIntensity: 0.4,
        motionContinuity: 'sustain',
        look: { contrast: 106, brightness: 103, saturation: 104, highlights: 5 },
        titleStyle: { size: 'small', position: 'bottom', boxStyle: 'box', casing: 'none' },
        audioProfile: { fadeIn: 0.4, fadeOut: 1 },
    },
    {
        id: 'mixed',
        name: 'Mixed media',
        description: 'Syncopé, balayages et poussées qui changent de sens, accents pixellisés',
        bestFor: 'Collage, mode, contenu éditorial',
        sequencePreset: 'instagram-reel',
        beat: { base: 2.2, pattern: [1, 0.6, 1.3, 0.6], openingHold: 1.1, closingHold: 1.25 },
        transitionScore: ['swipe-left', 'push-up', 'cut', 'swipe-right'],
        accentEvery: 4,
        accentTransition: 'pixel-cut',
        transitionBeatRatio: 0.15,
        motionScore: ['zoom-in', 'pan-left', 'drift-up', 'zoom-out'],
        motionIntensity: 1,
        motionContinuity: 'alternate',
        look: { contrast: 116, saturation: 118, vibrance: 14, shadows: -6 },
        titleStyle: { size: 'large', position: 'top', boxStyle: 'box', casing: 'upper' },
        audioProfile: { fadeIn: 0.2, fadeOut: 0.6 },
    },
    {
        /*
         * Le seul preset dont la STRUCTURE raconte quelque chose: des plans qui
         * raccourcissent, donc une tension qui monte. C'est ce qui justifie le
         * mot « preset » plutot que « filtre ».
         */
        id: 'recit',
        name: 'Récit',
        description: 'Plans qui raccourcissent, iris à l’ouverture et à la fermeture',
        bestFor: 'Histoire, avant/après, présentation',
        sequencePreset: 'instagram-reel',
        beat: { base: 3.4, pattern: [1.6, 1.2, 1, 0.8], openingHold: 1.1, closingHold: 1.4 },
        transitionScore: ['crossfade'],
        openingTransition: 'iris-open',
        closingTransition: 'iris-close',
        accentEvery: 0,
        accentTransition: null,
        transitionBeatRatio: 0.18,
        motionScore: ['zoom-in'],
        motionIntensity: 0.7,
        motionContinuity: 'sustain',
        look: { temperature: -10, contrast: 103, saturation: 97, shadows: -3 },
        titleStyle: { size: 'large', position: 'center', boxStyle: 'none', casing: 'none' },
        audioProfile: { fadeIn: 1, fadeOut: 2 },
    },
]);

/* ---------- Formats ---------- */

export const RECIPE_FORMATS = Object.freeze([
    { value: 'instagram-reel', label: '9:16', description: 'Reels, TikTok, Shorts' },
    { value: 'portrait', label: '4:5', description: 'Fil Instagram vertical' },
    { value: 'instagram-post', label: '1:1', description: 'Publication carrée' },
    { value: 'youtube', label: '16:9', description: 'YouTube, site web' },
]);

/* ---------- Acces ---------- */

export function getStyleRecipe(id) {
    return STYLE_RECIPES.find((recipe) => recipe.id === id) || null;
}

export function getRhythm(id) {
    return RHYTHMS.find((rhythm) => rhythm.id === id) || null;
}

export function getMotionMood(id) {
    return MOTION_MOODS.find((mood) => mood.id === id) || null;
}

export function getMotionIntensity(id) {
    return MOTION_INTENSITIES.find((level) => level.id === id) || null;
}

/*
 * Cran par defaut d'un preset: celui que sa `motionIntensity` designe.
 * Tant que l'utilisateur n'a rien choisi, changer de preset change donc le cran,
 * puisque l'intensite fait partie du caractere du preset. Des qu'il a choisi,
 * son choix tient - meme regle que le rythme depuis le lot L2.
 */
export function getRecipeMotionIntensityId(recipe) {
    const style = typeof recipe === 'string' ? getStyleRecipe(recipe) : recipe;
    const wanted = Number(style?.motionIntensity);
    if (!Number.isFinite(wanted)) return MOTION_INTENSITIES[MOTION_INTENSITIES.length - 1].id;
    return MOTION_INTENSITIES.reduce((closest, level) => (
        Math.abs(level.value - wanted) < Math.abs(closest.value - wanted) ? level : closest
    ), MOTION_INTENSITIES[0]).id;
}

export function getTransitionName(type) {
    return TRANSITION_NAMES[type] || 'Transition';
}

/* Reglages de depart d'un parcours guide: ceux du premier preset. */
export function getDefaultGuidedChoices(styleId = STYLE_RECIPES[0].id) {
    const recipe = getStyleRecipe(styleId) || STYLE_RECIPES[0];
    return {
        styleId: recipe.id,
        sequencePreset: recipe.sequencePreset,
        rhythmId: 'equilibre',
        motionMoodId: 'style',
        // `null` = « celui du preset ». Une fois pose par l'utilisateur, il tient.
        motionIntensityId: null,
    };
}

/* ---------- Construction du plan ---------- */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round2 = (value) => Math.round(value * 100) / 100;

/*
 * Part maximale d'un plan qu'une transition a le droit de manger.
 *
 * Sans ce garde-fou, « Cinema » en rythme soutenu se faisait silencieusement
 * rogner son fondu de 0,9 s et perdait son caractere sans que rien ne le dise.
 * Ici la transition est bornee par le PLUS COURT des deux plans qu'elle relie,
 * et le plan annonce la duree effectivement retenue.
 */
export const MAX_TRANSITION_SHARE = 0.45;

/* Duree brute d'une scene, avant bornage. Les videos gardent la leur. */
function resolveSceneDuration(scene, index, count, beat, beatBase) {
    if (!scene?.isImage) return Math.max(0, Number(scene?.duration) || 0);
    const pattern = beat.pattern.length ? beat.pattern : [1];
    let weight = pattern[index % pattern.length];
    if (index === 0) weight *= beat.openingHold;
    if (count > 1 && index === count - 1) weight *= beat.closingHold;
    return clamp(beatBase * weight, MIN_RECIPE_IMAGE_DURATION, MAX_RECIPE_IMAGE_DURATION);
}

/*
 * Transition SORTANTE de la scene `index`, c'est-a-dire la coupe entre `index`
 * et `index + 1`. L'ordre de priorite est: ouverture, fermeture, accent, puis la
 * sequence de base. Un accent qui tomberait sur la premiere ou la derniere coupe
 * cede donc la place a l'ouverture/fermeture, qui sont plus intentionnelles.
 */
function resolveCutType(recipe, cutIndex, cutCount) {
    if (cutIndex === 0 && recipe.openingTransition) return recipe.openingTransition;
    if (cutIndex === cutCount - 1 && recipe.closingTransition) return recipe.closingTransition;
    const accentEvery = Number(recipe.accentEvery) || 0;
    if (accentEvery > 0 && recipe.accentTransition && (cutIndex + 1) % accentEvery === 0) {
        return recipe.accentTransition;
    }
    const score = recipe.transitionScore?.length ? recipe.transitionScore : ['cut'];
    return score[cutIndex % score.length];
}

/*
 * Construit le montage que la creation guidee va appliquer.
 *
 * `scenes` : [{ isImage, duration }] - la forme exposee par `useScenes`, reduite
 * a ce dont la recette a besoin. La duree d'une VIDEO est lue (on ne peut pas
 * etirer une source); celle d'une PHOTO est produite, jamais lue - c'est ce qui
 * rend l'application idempotente et interdit la boucle
 * « appliquer -> les durees changent -> le plan change -> appliquer ».
 */
export function buildMontagePlan({
    scenes = [],
    styleId,
    rhythmId,
    motionMoodId,
    motionIntensityId,
    sequencePreset,
} = {}) {
    const recipe = getStyleRecipe(styleId) || STYLE_RECIPES[0];
    const rhythm = getRhythm(rhythmId) || RHYTHMS[1];
    const mood = getMotionMood(motionMoodId) || MOTION_MOODS[0];
    const intensity = getMotionIntensity(motionIntensityId)
        || getMotionIntensity(getRecipeMotionIntensityId(recipe))
        || MOTION_INTENSITIES[MOTION_INTENSITIES.length - 1];

    const beat = {
        pattern: recipe.beat?.pattern?.length ? [...recipe.beat.pattern] : [1],
        openingHold: Number(recipe.beat?.openingHold) || 1,
        closingHold: Number(recipe.beat?.closingHold) || 1,
    };
    const beatBase = (Number(recipe.beat?.base) || 3) * rhythm.durationFactor;

    // Le motif de mouvements du preset, sauf surcharge explicite par l'etape 3.
    const motionPattern = mood.pattern ? [...mood.pattern] : [...recipe.motionScore];

    const count = scenes.length;
    const durations = scenes.map((scene, index) => (
        resolveSceneDuration(scene, index, count, beat, beatBase)
    ));

    /*
     * Les mouvements sont indexes sur la place de la PHOTO dans la suite des
     * photos, pas sur celle de la scene: intercaler une video ne doit pas
     * decaler la choregraphie.
     */
    let imageRank = 0;
    const planScenes = scenes.map((scene, index) => {
        const isImage = Boolean(scene?.isImage);
        const motion = isImage ? motionPattern[imageRank % motionPattern.length] : null;
        if (isImage) imageRank += 1;
        return {
            index,
            isImage,
            duration: round2(durations[index]),
            motion,
            // Portee PAR SCENE: c'est cette valeur qui part dans le clip, donc
            // dans le manifeste, donc dans le `zoompan` du renderer.
            motionIntensity: isImage && motion && motion !== 'none' ? intensity.value : null,
        };
    });

    const cutCount = Math.max(0, count - 1);
    const cuts = [];
    for (let cutIndex = 0; cutIndex < cutCount; cutIndex += 1) {
        const type = resolveCutType(recipe, cutIndex, cutCount);
        if (type === 'cut') {
            cuts.push({ index: cutIndex, type: 'cut', name: TRANSITION_NAMES.cut, duration: 0 });
            continue;
        }
        const shortest = Math.min(durations[cutIndex], durations[cutIndex + 1]);
        const wanted = beatBase * (Number(recipe.transitionBeatRatio) || 0.18) * rhythm.transitionFactor;
        // Garde-fou: jamais plus de 45 % du plus court des deux plans adjacents.
        const duration = round2(clamp(wanted, 0.1, Math.max(0.1, shortest * MAX_TRANSITION_SHARE)));
        cuts.push({
            index: cutIndex,
            type,
            name: TRANSITION_NAMES[type] || 'Transition',
            duration,
            isAccent: type === recipe.accentTransition
                || type === recipe.openingTransition
                || type === recipe.closingTransition,
        });
    }

    const look = { ...NEUTRAL_LOOK, ...recipe.look };
    const imageCount = planScenes.filter((scene) => scene.isImage).length;
    const timedCuts = cuts.filter((cut) => cut.type !== 'cut');
    // Somme des durees ARRONDIES: ce sont elles qui seront ecrites dans le
    // projet, donc c'est d'elles que depend la duree reelle du montage.
    const rawDuration = planScenes.reduce((total, scene) => total + scene.duration, 0);
    // Chaque fondu fait se chevaucher deux scenes: le montage raccourcit d'autant.
    const overlap = timedCuts.reduce((total, cut) => total + cut.duration, 0);
    const imageDurations = planScenes.filter((scene) => scene.isImage).map((scene) => scene.duration);

    return {
        recipe,
        rhythm,
        mood,
        intensity,
        styleId: recipe.id,
        rhythmId: rhythm.id,
        motionMoodId: mood.id,
        motionIntensityId: intensity.id,
        sequencePreset: sequencePreset || recipe.sequencePreset,

        scenes: planScenes,
        cuts,
        motionPattern,
        motionIntensity: intensity.value,
        look,
        titleStyle: recipe.titleStyle || null,
        audioProfile: recipe.audioProfile || null,

        sceneCount: count,
        imageCount,
        videoCount: count - imageCount,
        transitionCount: timedCuts.length,
        cutCount: cuts.length - timedCuts.length,
        transitionTypes: [...new Set(timedCuts.map((cut) => cut.type))],
        shortestImage: imageDurations.length ? round2(Math.min(...imageDurations)) : 0,
        longestImage: imageDurations.length ? round2(Math.max(...imageDurations)) : 0,
        estimatedDuration: round2(Math.max(0, rawDuration - overlap)),
    };
}

/* ---------- Lot L5: titre et musique reellement appliques ---------- */

/*
 * `titleStyle` et `audioProfile` etaient PORTES par le modele de preset depuis
 * le lot L2 sans etre appliques (probleme H de todo.md): un preset annoncait un
 * traitement de titre qui ne changeait rien. Les deux resolveurs ci-dessous
 * ferment cet ecart.
 *
 * REGLE DE PARITE, tenue ici comme ailleurs: on ne traduit un preset qu'en
 * proprietes que l'apercu ET le renderer serveur rendent tous les deux.
 *   - taille, position, gras          -> `drawtext` (fontsize, x/y, fontfile)
 *   - `boxStyle` 'none'|'box'|'outline' -> SERVER_RENDER_CAPABILITIES.textStyles
 *     ('box=1' et 'borderw', livres avec les extensions moteur)
 *   - `casing`                        -> transformation du CONTENU, donc rendue
 *     des deux cotes par construction
 *   - fondus audio                    -> SERVER_RENDER_CAPABILITIES.audioFades
 *     ('afade'), livres avec les extensions moteur
 * Aucune propriete inventee, aucun reglage « apercu seulement ».
 */

/*
 * Le facteur d'echelle du rendu vaut `fontSize x largeur/1920`: en 9:16 un titre
 * a 64 pt ne fait que 36 px de haut. Les trois crans partent donc plus haut que
 * les valeurs par defaut du montage rapide, tout en restant dans les bornes du
 * curseur de taille (20 a 160).
 */
export const TITLE_SIZES = Object.freeze({ small: 56, medium: 80, large: 112 });

/* Memes ancrages que la grille 9 points de l'inspecteur de texte. */
export const TITLE_POSITIONS = Object.freeze({ top: 0.16, center: 0.5, bottom: 0.84 });

/*
 * Traduit le `titleStyle` d'un preset en proprietes d'incrustation de texte.
 * Le resultat est destine a etre fusionne tel quel dans un overlay: c'est la
 * source unique du traitement de titre d'un preset.
 */
export function resolveTitleOverlayStyle(titleStyle) {
    const style = titleStyle || {};
    const boxStyle = ['none', 'box', 'outline'].includes(style.boxStyle) ? style.boxStyle : 'none';
    return {
        fontSize: TITLE_SIZES[style.size] || TITLE_SIZES.medium,
        x: 0.5,
        y: TITLE_POSITIONS[style.position] ?? TITLE_POSITIONS.bottom,
        bold: true,
        boxStyle,
        // Le fond n'est lu que si `boxStyle` en demande un; on le pose quand meme
        // pour qu'un passage 'none' -> 'box' n'herite pas d'une couleur orpheline.
        boxColor: '#000000',
    };
}

/*
 * Casse du titre. C'est le CONTENU qui change, pas un reglage de rendu: le
 * renderer recoit donc exactement la chaine que l'apercu affiche, et la parite
 * est vraie par construction plutot que par surveillance.
 */
export function applyTitleCasing(content, titleStyle) {
    const text = String(content ?? '');
    return titleStyle?.casing === 'upper' ? text.toLocaleUpperCase('fr-FR') : text;
}

/*
 * Fondus musique d'un preset, bornes par la duree reelle du montage.
 *
 * Sans bornage, « Recit » (2 s de fondu de sortie) poserait sur un montage de
 * 3 s un fondu qui commence avant la fin du fondu d'entree: la musique ne serait
 * jamais a plein volume. On ne laisse donc jamais les deux fondus depasser la
 * moitie du morceau chacun.
 */
export function resolveAudioProfile(audioProfile, totalDuration = 0) {
    const profile = audioProfile || {};
    const duration = Math.max(0, Number(totalDuration) || 0);
    const ceiling = duration > 0 ? duration * 0.4 : Infinity;
    const bound = (value, fallback) => {
        const wanted = Number.isFinite(Number(value)) ? Number(value) : fallback;
        return round2(clamp(wanted, 0, Math.max(0, ceiling)));
    };
    return {
        fadeIn: bound(profile.fadeIn, 0),
        fadeOut: bound(profile.fadeOut, 1),
    };
}

/*
 * Resume lisible du traitement de titre, pour le recapitulatif. Le parcours
 * guide ne montre pas les reglages un par un - il annonce ce que le preset a
 * decide, en francais.
 */
const TITLE_SIZE_LABELS = Object.freeze({ small: 'Discret', medium: 'Moyen', large: 'Grand' });
const TITLE_POSITION_LABELS = Object.freeze({ top: 'en haut', center: 'centré', bottom: 'en bas' });
const TITLE_BOX_LABELS = Object.freeze({ none: 'sans fond', box: 'sur bloc', outline: 'avec contour' });

export function describeTitleStyle(titleStyle) {
    if (!titleStyle) return '';
    const parts = [
        TITLE_SIZE_LABELS[titleStyle.size] || TITLE_SIZE_LABELS.medium,
        TITLE_POSITION_LABELS[titleStyle.position] || TITLE_POSITION_LABELS.bottom,
        TITLE_BOX_LABELS[titleStyle.boxStyle] || TITLE_BOX_LABELS.none,
    ];
    if (titleStyle.casing === 'upper') parts.push('en capitales');
    return parts.join(' · ');
}

/* ---------- Lot L5: partition visible ---------- */

/*
 * Projection du plan en blocs proportionnels, pour la pellicule de l'etape 3.
 *
 * Le lot L2 a remplace « toutes les photos durent 3,24 s » par une partition -
 * mais l'ecran continuait d'annoncer un intervalle chiffre (« 2,72 a 4,57 s »),
 * ce qui ne montre NI la forme du montage NI ou tombent les accents. Ici chaque
 * plan devient une largeur, chaque transition une jointure, et la forme se lit
 * d'un coup d'oeil: l'ouverture qui respire, le ventre, la fin qui tient.
 *
 * Fonction PURE, donc testable sans navigateur - comme tout ce module.
 */
export function buildBeatStrip(plan) {
    if (!plan?.scenes?.length) return { blocks: [], joints: [], totalWeight: 0 };
    const totalWeight = plan.scenes.reduce((total, scene) => total + Math.max(0.01, scene.duration), 0);
    const blocks = plan.scenes.map((scene) => ({
        index: scene.index,
        duration: scene.duration,
        isImage: scene.isImage,
        motion: scene.motion,
        // Part de la largeur totale, en pourcentage: c'est ce que le style CSS lit.
        share: round2((Math.max(0.01, scene.duration) / totalWeight) * 100),
    }));
    const joints = (plan.cuts || []).map((cut) => ({
        index: cut.index,
        type: cut.type,
        name: cut.name,
        duration: cut.duration,
        isTimed: cut.type !== 'cut',
        isAccent: Boolean(cut.isAccent),
        // Position de la jointure: fin cumulee du plan qui la precede.
        offset: round2(
            (blocks.slice(0, cut.index + 1).reduce((total, block) => total + block.share, 0)),
        ),
    }));
    return { blocks, joints, totalWeight: round2(totalWeight) };
}

/* ---------- Apercu du look (presentation) ---------- */

/*
 * Traduction APPROCHEE d'un look en filtre CSS, pour les vignettes de choix de
 * preset uniquement. Le rendu qui fait foi reste celui du canvas et de FFmpeg;
 * ici on cherche seulement a rendre les presets distinguables d'un coup d'oeil.
 * `fade` et `vignette` ne sont pas des filtres CSS: ils sont renvoyes a part pour
 * etre dessines en calques.
 */
export function lookToCssFilter(look = {}) {
    const grade = { ...NEUTRAL_LOOK, ...look };
    const brightness = (grade.brightness / 100) * (1 + grade.exposure / 200);
    const contrast = grade.contrast / 100;
    const saturate = (grade.saturation + grade.vibrance * 0.58) / 100;
    const warmth = clamp(Math.abs(grade.temperature) / 100, 0, 1) * 0.45;
    const parts = [
        `brightness(${round2(brightness)})`,
        `contrast(${round2(contrast)})`,
        `saturate(${round2(Math.max(0, saturate))})`,
    ];
    if (grade.hue !== 0) parts.push(`hue-rotate(${Math.round(grade.hue)}deg)`);
    if (warmth > 0.001) {
        parts.push(`sepia(${round2(warmth)})`);
        // Le sepia refroidit la saturation: on la rend, sinon les looks chauds
        // ressortent ternes au lieu de ressortir chauds.
        parts.push(`saturate(${round2(1 + warmth * 0.6)})`);
        if (grade.temperature < 0) parts.push('hue-rotate(-32deg)');
    }
    return parts.join(' ');
}

/*
 * Tempo d'un preset, pour ses vignettes de demonstration.
 *
 * `cycleSeconds` est la duree REELLE du plan median du preset: la vignette bat
 * donc au rythme que le preset produira. `pace` decrit la longueur du fondu par
 * rapport a cette duree, ce qui donne des demonstrations distinctes: coupe
 * franche, fondu court, fondu moyen, fondu ample.
 */
export function getStyleTempo(recipe) {
    const style = typeof recipe === 'string' ? getStyleRecipe(recipe) : recipe;
    if (!style) return { pace: 'soft', cycleSeconds: 3 };
    const pattern = style.beat?.pattern?.length ? style.beat.pattern : [1];
    const averageWeight = pattern.reduce((total, weight) => total + weight, 0) / pattern.length;
    const cycleSeconds = round2(clamp((style.beat?.base || 3) * averageWeight, 1.2, 5));
    const score = style.transitionScore?.length ? style.transitionScore : ['cut'];
    // Le corps du preset donne le ton; l'accent est trop rare pour representer.
    if (score.every((type) => type === 'cut')) return { pace: 'cut', cycleSeconds };
    const ratio = Number(style.transitionBeatRatio) || 0.18;
    if (ratio < 0.15) return { pace: 'fast', cycleSeconds };
    if (ratio < 0.2) return { pace: 'soft', cycleSeconds };
    return { pace: 'long', cycleSeconds };
}

export function lookToOverlays(look = {}) {
    const grade = { ...NEUTRAL_LOOK, ...look };
    return {
        fade: round2(clamp(grade.fade / 100, 0, 1) * 0.24),
        vignette: round2(clamp(grade.vignette / 100, 0, 1) * 0.7),
    };
}

/*
 * Resume lisible du montage. Source de verite unique de ce qui est annonce a
 * l'utilisateur dans l'etape « Finaliser », et de ce que les tests verifient.
 *
 * `applied` est l'etat REEL du projet apres generation. Quand il est fourni, il
 * l'emporte sur les valeurs esperees par le plan: le recapitulatif decrit alors
 * le montage tel qu'il est, pas tel qu'on voulait le produire.
 */
export function describeMontagePlan(plan, applied = null) {
    if (!plan) return [];
    const sceneCount = applied?.sceneCount ?? plan.sceneCount;
    const duration = applied?.totalDuration ?? plan.estimatedDuration;
    const transitionCount = applied?.transitionCount ?? plan.transitionCount;
    const transitionTypes = applied?.transitionTypes ?? plan.transitionTypes;

    const rows = [
        { id: 'scenes', label: 'Scènes', value: `${sceneCount}`, numeric: true },
        { id: 'duration', label: 'Durée', value: `${round2(duration)} s`, numeric: true },
        { id: 'style', label: 'Style', value: plan.recipe.name },
        { id: 'rhythm', label: 'Rythme', value: plan.rhythm.name },
    ];
    if (plan.imageCount > 0) {
        /*
         * Une seule duree par photo n'a plus de sens: c'est justement ce que le
         * lot L2 a supprime. On annonce l'amplitude reelle de la partition.
         */
        const shortest = applied?.shortestImage ?? plan.shortestImage;
        const longest = applied?.longestImage ?? plan.longestImage;
        rows.push({
            id: 'imageDuration',
            label: 'Durée des photos',
            value: shortest === longest
                ? `${round2(shortest)} s`
                : `${round2(shortest)} à ${round2(longest)} s`,
            numeric: true,
        });
        /*
         * Le recapitulatif annonce aussi l'intensite depuis le lot L3: c'est un
         * reglage que l'utilisateur a pu poser trois ecrans plus tot, et qui
         * change reellement ce que l'export produit.
         */
        const hasMotion = plan.motionPattern.some((motion) => motion && motion !== 'none');
        rows.push({
            id: 'motion',
            label: 'Mouvements',
            value: hasMotion ? `${plan.mood.name} · ${plan.intensity.name}` : plan.mood.name,
        });
    }
    rows.push({
        id: 'transition',
        label: 'Transitions',
        value: transitionCount > 0 && transitionTypes?.length
            ? `${transitionCount} sur ${plan.sceneCount - 1} coupes · ${transitionTypes.map(getTransitionName).join(', ')}`
            : 'Coupes franches',
    });
    return rows;
}
