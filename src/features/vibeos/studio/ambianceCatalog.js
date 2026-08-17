/*
 * Les ambiances du Studio VibeOS (plan §5.4, point 1).
 *
 * Une ambiance = un BUNDLE coherent: filtres + grain + vignettage + un fond
 * genere assorti. Le format est celui de `PRESET_CATEGORIES.profiles`
 * (`{ name, desc, filters }`), enrichi de trois champs seulement:
 *   - `family` / `strength` : ce que `scoreProfileForImage` lit pour classer une
 *     ambiance en fonction de la photo (et ce que « Surprends-moi » pondere) ;
 *   - `recommendedIntensity` : la position de depart du curseur ;
 *   - `background` : la palette mesh assortie, proposee a la composition.
 *
 * Aucun moteur n'est ecrit ici. Les valeurs de filtres sont consommees telles
 * quelles par `renderStudio` (via `useCanvasRenderer`), exactement comme les
 * profils de l'ancien Studio.
 *
 * Six ambiances sont curees depuis `PRESET_CATEGORIES` (Argentique, Monochrome,
 * Cyberpunk, Soft & Dreamy) ; quatre sont des combinaisons nouvelles.
 */

import { PRESET_CATEGORIES } from '../../vibefx-studio/data/constants';

/* Profil source dans PRESET_CATEGORIES: on part de SES filtres, on ne les
   reinvente pas. Retourne {} si le profil a disparu du catalogue amont. */
function preset(categoryId, profileName) {
    const category = PRESET_CATEGORIES.find((item) => item.id === categoryId);
    const profile = category?.profiles?.find((item) => item.name === profileName);
    return profile?.filters ? { ...profile.filters } : {};
}

const DEFINITIONS = [
    /* ---------- Curees depuis PRESET_CATEGORIES ---------- */
    {
        id: 'peau-naturelle',
        label: 'Peau naturelle',
        hint: 'Portraits, lumière douce',
        source: 'Portra 400 · Argentique',
        family: 'Portrait Skin',
        strength: 'safe',
        recommendedIntensity: 85,
        filters: {
            ...preset('argentique', 'Portra 400'),
            /* Les tons chauds passent en split-toning: plus doux et plus fidele
               qu'une teinte globale, et ca survit aux garde-fous. */
            tintIntensity: 8,
            highlightTint: '#ffe6c2',
            highlightTintIntensity: 10,
            skinSaturation: -4,
            temperature: 6,
        },
        background: { label: 'Sable doux', colors: ['#1a1512', '#e2b98a', '#a9714a', '#0d0b09'] },
    },
    {
        id: 'ete-dore',
        label: 'Été doré',
        hint: 'Vacances, fin de journée',
        source: 'Gold 200 · Argentique',
        family: 'Film Soft',
        strength: 'strong',
        recommendedIntensity: 75,
        filters: {
            ...preset('argentique', 'Gold 200'),
            tintIntensity: 8,
            highlightTint: '#ffd27a',
            highlightTintIntensity: 12,
            temperature: 16,
            fadedBlacks: 6,
        },
        background: { label: 'Braise de minuit', colors: ['#120c05', '#f5af19', '#f12711', '#0a0a0a'] },
    },
    {
        id: 'vert-foret',
        label: 'Vert forêt',
        hint: 'Nature, verdure, extérieur',
        source: 'Fuji Superia · Argentique',
        family: 'Landscape Vivid Safe',
        strength: 'strong',
        recommendedIntensity: 80,
        filters: {
            ...preset('argentique', 'Fuji Superia'),
            tintIntensity: 8,
            foliageSaturation: 14,
            shadowTint: '#0d1f1a',
            shadowTintIntensity: 14,
            temperature: -6,
        },
        background: { label: 'Menthe fraîche', colors: ['#081310', '#3ecf8e', '#1c7a56', '#040807'] },
    },
    {
        id: 'nuit-neon',
        label: 'Nuit néon',
        hint: 'Ville la nuit, enseignes',
        source: 'CineStill 800T · Argentique',
        family: 'Cinema Night',
        strength: 'strong',
        recommendedIntensity: 75,
        filters: {
            ...preset('argentique', 'CineStill 800T'),
            tintIntensity: 9,
            shadowTint: '#00243b',
            shadowTintIntensity: 18,
            highlightTint: '#ffb27a',
            highlightTintIntensity: 12,
            halation: 30,
            halationColor: '#ff2200',
            shadows: 12,
            temperature: -14,
        },
        background: { label: 'Espace profond', colors: ['#050505', '#203a43', '#2c5364', '#0f2027'] },
    },
    {
        id: 'noir-charbon',
        label: 'Noir charbon',
        hint: 'Noir et blanc contrasté',
        source: 'Tri-X 400 · Monochrome',
        family: 'Monochrome Rich',
        strength: 'strong',
        recommendedIntensity: 85,
        filters: {
            ...preset('bw', 'Tri-X 400'),
            shadowTint: '#12100c',
            shadowTintIntensity: 20,
        },
        background: { label: 'Cendres', colors: ['#0b0b0d', '#4a4a52', '#26262c', '#050506'] },
    },
    {
        id: 'ville-cyan',
        label: 'Ville cyan',
        hint: 'Cinéma, teal & orange',
        source: 'Blade Runner · Cyberpunk',
        family: 'Cinema Night',
        strength: 'experimental',
        recommendedIntensity: 65,
        filters: {
            ...preset('cyber', 'Blade Runner'),
            /* La teinte globale a 35 serait ramenee a 10 par les garde-fous:
               le teal & orange vit dans le split-toning, qui a plus de marge. */
            tintIntensity: 6,
            tintColor: '#008080',
            shadowTint: '#00343d',
            shadowTintIntensity: 18,
            highlightTint: '#ffb37a',
            highlightTintIntensity: 12,
            temperature: -10,
            vibrance: 16,
        },
        background: { label: 'Cyber rose', colors: ['#07070a', '#3b82f6', '#8b5cf6', '#0a0a0a'] },
    },

    /* ---------- Combinaisons nouvelles ---------- */
    {
        id: 'polaroid-delave',
        label: 'Polaroïd délavé',
        hint: 'Noirs levés, souvenir papier',
        source: 'Combinaison VibeOS',
        family: 'Editorial Matte',
        strength: 'strong',
        recommendedIntensity: 70,
        filters: {
            brightness: 106,
            contrast: 92,
            saturation: 88,
            sepia: 10,
            blur: 0,
            grain: 11,
            vignette: 1,
            tintColor: '#f7e9d2',
            tintIntensity: 8,
            temperature: 10,
            fadedBlacks: 8,
            shadows: 18,
            highlights: -12,
            shadowTint: '#2a2016',
            shadowTintIntensity: 16,
            highlightTint: '#fff2dc',
            highlightTintIntensity: 12,
        },
        background: { label: 'Papier ancien', colors: ['#15120d', '#d8c3a0', '#8a7455', '#0b0906'] },
    },
    {
        id: 'vhs-chaud',
        label: 'VHS chaud',
        hint: 'Cassette, grain épais',
        source: 'Combinaison VibeOS',
        family: 'Chrome Street',
        strength: 'experimental',
        recommendedIntensity: 60,
        filters: {
            brightness: 104,
            contrast: 116,
            saturation: 118,
            sepia: 0,
            blur: 1,
            grain: 16,
            vignette: 3,
            tintColor: '#ff5ad0',
            tintIntensity: 9,
            temperature: 12,
            hueRotate: -6,
            fadedBlacks: 6,
            shadowTint: '#2b0033',
            shadowTintIntensity: 16,
            highlightTint: '#ffe2b0',
            highlightTintIntensity: 10,
            halation: 22,
            halationColor: '#ff3b00',
        },
        background: { label: 'Magenta cathodique', colors: ['#0d0311', '#ff5ad0', '#7a2bff', '#050208'] },
    },
    {
        id: 'eclat-doux',
        label: 'Éclat doux',
        hint: 'Halo léger, peaux lumineuses',
        source: 'Orton · Soft & Dreamy',
        family: 'Portrait Skin',
        strength: 'safe',
        recommendedIntensity: 70,
        filters: {
            ...preset('soft', 'Orton Effect'),
            /* Le flou de l'Orton d'origine (4px) est ramene dans la plage tenue
               par le pipeline; la douceur vient surtout des hautes lumieres. */
            blur: 2,
            /* L'ecart avec « Peau naturelle » doit se voir: ici on part sur un
               rendu clair, pastel et aere (noirs leves, saturation retenue),
               la ou Portra reste chaud et contraste. */
            contrast: 94,
            saturation: 90,
            sepia: 0,
            tintIntensity: 6,
            tintColor: '#ffffff',
            temperature: 0,
            highlights: 22,
            shadows: 24,
            fadedBlacks: 7,
            clarity: -18,
            grain: 4,
            vignette: 1,
            highlightTint: '#fff3e0',
            highlightTintIntensity: 12,
        },
        background: { label: 'Aube laiteuse', colors: ['#131018', '#f0c7d8', '#9aa6e0', '#08070c'] },
    },
    {
        id: 'brume-matin',
        label: 'Brume matin',
        hint: 'Froid, calme, minimal',
        source: 'Combinaison VibeOS',
        family: 'Natural Clean',
        strength: 'safe',
        recommendedIntensity: 80,
        filters: {
            brightness: 104,
            contrast: 96,
            saturation: 82,
            sepia: 0,
            blur: 0,
            grain: 4,
            vignette: 1,
            tintColor: '#dbe9f5',
            tintIntensity: 6,
            temperature: -12,
            highlights: -8,
            shadows: 14,
            clarity: -6,
            dehaze: 0,
            fadedBlacks: 5,
            shadowTint: '#16222b',
            shadowTintIntensity: 14,
            highlightTint: '#eef6ff',
            highlightTintIntensity: 10,
        },
        background: { label: 'Aurore boréale', colors: ['#060a0c', '#06b6d4', '#3b82f6', '#0b1114'] },
    },
];

/*
 * Forme finale consommee par l'ecran. `vision` reproduit la forme minimale que
 * `scoreProfileForImage` interroge (famille + force), pour reutiliser le tri de
 * Vision sans le reimplementer.
 */
export const AMBIANCES = DEFINITIONS.map((definition) => ({
    ...definition,
    vision: {
        family: definition.family,
        strength: definition.strength,
        previewTags: [definition.hint],
    },
}));

export const AMBIANCE_BY_ID = new Map(AMBIANCES.map((ambiance) => [ambiance.id, ambiance]));

/* Les parametres que « Surprends-moi » a le droit de bousculer de ±10%.
   Volontairement courte: on veut une variation credible, pas un autre look. */
export const JITTERABLE_KEYS = [
    'brightness',
    'contrast',
    'saturation',
    'grain',
    'vignette',
    'temperature',
];
