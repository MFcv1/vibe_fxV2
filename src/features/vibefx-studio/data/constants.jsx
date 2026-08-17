import React from 'react';
import { Smartphone, Square, Columns, Box, StickyNote, Layers, LayoutTemplate, Grid, Maximize, Film, Contrast, Monitor, Sparkles, SplitSquareVertical } from 'lucide-react';

export const FORMATS = [
    { id: 'insta-port', label: 'Portrait (4:5)', w: 1080, h: 1350, ratio: 4 / 5, icon: <Smartphone size={16} /> },
    { id: 'insta-sq', label: 'Carré (1:1)', w: 1080, h: 1080, ratio: 1 / 1, icon: <Square size={16} /> },
    { id: 'story', label: 'Story / Réel (9:16)', w: 1080, h: 1920, ratio: 9 / 16, icon: <Smartphone size={16} className="h-5" /> },
    { id: 'insta-land', label: 'Paysage (16:9)', w: 1080, h: 566, ratio: 1.91 / 1, icon: <Smartphone size={16} className="rotate-90" /> },
    { id: 'pano-2', label: 'Pano x2', w: 2160, h: 1350, ratio: 8 / 5, icon: <Columns size={16} /> },
    { id: 'pano-3', label: 'Pano x3', w: 3240, h: 1350, ratio: 12 / 5, icon: <Columns size={16} /> },
];

export const TEMPLATES = [
    { id: 'minimal', label: 'Standard', icon: <Box size={18} />, slots: 1 },
    { id: 'polaroid', label: 'Polaroïd', icon: <StickyNote size={18} />, slots: 1 },
    { id: 'pip', label: 'Pic-in-Pic', icon: <Layers size={18} />, slots: 2 },
    { id: 'split', label: 'Double (2)', icon: <SplitSquareVertical size={18} />, slots: 2 },
    { id: 'filmstrip', label: 'Pellicule (3)', icon: <Columns size={18} className="rotate-90" />, slots: 3 },
    { id: 'mosaic', label: 'Mosaïque (3)', icon: <LayoutTemplate size={18} />, slots: 3 },
    { id: 'grid4', label: 'Grille (4)', icon: <Grid size={18} />, slots: 4 },
    { id: 'cinema', label: 'Cinéma', icon: <Maximize size={18} />, slots: 1 },
];

export const CUSTOM_LAYOUT_PRESETS = [
    {
        id: 'catalog-cf1',
        label: 'Catalogue CF1',
        description: 'Grande image, bande detail et vignettes.',
        zones: [
            { id: 'custom-hero', label: 'Hero', x: 0, y: 0, w: 0.625, h: 0.625, imageIndex: 0 },
            { id: 'custom-copy', label: 'Texte / fiche', x: 0.625, y: 0, w: 0.375, h: 0.625, imageIndex: 1 },
            { id: 'custom-thumb-1', label: 'Detail 1', x: 0, y: 0.625, w: 0.25, h: 0.1875, imageIndex: 2 },
            { id: 'custom-thumb-2', label: 'Detail 2', x: 0.25, y: 0.625, w: 0.25, h: 0.1875, imageIndex: 3 },
            { id: 'custom-thumb-3', label: 'Detail 3', x: 0.5, y: 0.625, w: 0.25, h: 0.1875, imageIndex: 4 },
            { id: 'custom-thumb-4', label: 'Detail 4', x: 0.75, y: 0.625, w: 0.25, h: 0.1875, imageIndex: 5 },
            { id: 'custom-price', label: 'Prix / focus', x: 0, y: 0.8125, w: 0.5, h: 0.1875, imageIndex: 6 },
            { id: 'custom-wide', label: 'Ambiance', x: 0.5, y: 0.8125, w: 0.5, h: 0.1875, imageIndex: 7 },
        ],
    },
    {
        id: 'split-feature',
        label: 'Feature + 4',
        description: 'Une image forte et quatre blocs secondaires.',
        zones: [
            { id: 'custom-main', label: 'Image principale', x: 0, y: 0, w: 1, h: 0.6, imageIndex: 0 },
            { id: 'custom-a', label: 'Bloc A', x: 0, y: 0.6, w: 0.5, h: 0.2, imageIndex: 1 },
            { id: 'custom-b', label: 'Bloc B', x: 0.5, y: 0.6, w: 0.5, h: 0.2, imageIndex: 2 },
            { id: 'custom-c', label: 'Bloc C', x: 0, y: 0.8, w: 0.5, h: 0.2, imageIndex: 3 },
            { id: 'custom-d', label: 'Bloc D', x: 0.5, y: 0.8, w: 0.5, h: 0.2, imageIndex: 4 },
        ],
    },
    {
        id: 'editorial-grid',
        label: 'Editorial 6',
        description: 'Grille propre pour moodboard ou carrousel.',
        zones: [
            { id: 'custom-e1', label: 'Zone 1', x: 0, y: 0, w: 0.5, h: 1 / 3, imageIndex: 0 },
            { id: 'custom-e2', label: 'Zone 2', x: 0.5, y: 0, w: 0.5, h: 1 / 3, imageIndex: 1 },
            { id: 'custom-e3', label: 'Zone 3', x: 0, y: 1 / 3, w: 0.5, h: 1 / 3, imageIndex: 2 },
            { id: 'custom-e4', label: 'Zone 4', x: 0.5, y: 1 / 3, w: 0.5, h: 1 / 3, imageIndex: 3 },
            { id: 'custom-e5', label: 'Zone 5', x: 0, y: 2 / 3, w: 0.5, h: 1 / 3, imageIndex: 4 },
            { id: 'custom-e6', label: 'Zone 6', x: 0.5, y: 2 / 3, w: 0.5, h: 1 / 3, imageIndex: 5 },
        ],
    },
];

export const DEFAULT_CUSTOM_LAYOUT_GAP = 12;

export const DEFAULT_CUSTOM_TEMPLATE = {
    id: 'custom',
    label: 'Personnalise',
    icon: <LayoutTemplate size={18} />,
    slots: 0,
    customLayout: {
        version: 1,
        presetId: 'manual',
        zones: [],
    },
};

export const CUSTOM_SHAPE_LIBRARY = [
    { id: 'wide', label: 'Large', description: 'Bloc image horizontal', w: 0.44, h: 0.2 },
    { id: 'portrait', label: 'Portrait', description: 'Bloc image vertical', w: 0.26, h: 0.36 },
    { id: 'square', label: 'Carre', description: 'Bloc image carre', w: 0.24, h: 0.24 },
    { id: 'banner', label: 'Bandeau', description: 'Bande detail ou prix', w: 0.62, h: 0.14 },
    { id: 'micro', label: 'Mini', description: 'Vignette compacte', w: 0.18, h: 0.16 },
];

export const FONT_OPTIONS = [
    { label: 'Inter (Moderne)', value: 'Inter' },
    { label: 'Montserrat (Géométrique)', value: 'Montserrat' },
    { label: 'Lato (Clean)', value: 'Lato' },
    { label: 'Oswald (Compact)', value: 'Oswald' },
    { label: 'Playfair Display (Élégant)', value: '"Playfair Display"' },
    { label: 'Merriweather (Classique)', value: 'Merriweather' },
    { label: 'Courier Prime (Rétro)', value: '"Courier Prime"' },
    { label: 'Abril Fatface (Gras)', value: '"Abril Fatface"' },
    { label: 'Caveat (Manuscrit)', value: 'Caveat' },
    { label: 'Dancing Script (Cursif)', value: '"Dancing Script"' },
    { label: 'Shadows Into Light (Marker)', value: '"Shadows Into Light"' },
    { label: 'Nothing You Could Do (Signature)', value: '"Nothing You Could Do"' },
    { label: 'Covered By Your Grace (Hand)', value: '"Covered By Your Grace"' },
    { label: 'Cinzel (Editorial)', value: 'Cinzel' },
    { label: 'Prata (Luxe)', value: 'Prata' },
];

export const PRESET_CATEGORIES = [
    {
        id: 'argentique', label: 'Argentique', sub: 'Film Look', icon: <Film size={18} />, color: 'text-amber-500',
        profiles: [
            { name: 'Portra 400', desc: 'Peaux naturelles, chaleur douce', filters: { brightness: 110, contrast: 105, saturation: 110, sepia: 15, blur: 0, grain: 9, vignette: 1, tintColor: '#f3e5ab', tintIntensity: 15 } },
            { name: 'Gold 200', desc: 'Vacances, doré et contrasté', filters: { brightness: 105, contrast: 115, saturation: 130, sepia: 25, blur: 0, grain: 15, vignette: 2, tintColor: '#ffd700', tintIntensity: 10 } },
            { name: 'Fuji Superia', desc: 'Verts profonds, ombres froides', filters: { brightness: 100, contrast: 110, saturation: 115, sepia: 0, blur: 0, grain: 11, vignette: 2, tintColor: '#a8e6cf', tintIntensity: 20 } },
            { name: 'CineStill 800T', desc: 'Nuit, néons, halo', filters: { brightness: 105, contrast: 95, saturation: 110, sepia: 0, blur: 2, grain: 17, vignette: 4, tintColor: '#004968', tintIntensity: 30 } }
        ]
    },
    {
        id: 'bw', label: 'Monochrome', sub: 'Noir & Blanc', icon: <Contrast size={18} />, color: 'text-neutral-500',
        profiles: [
            { name: 'Tri-X 400', desc: 'Contrasté, grain fort, reportage', filters: { brightness: 105, contrast: 145, saturation: 0, sepia: 0, blur: 0, grain: 24, vignette: 3, tintColor: '#ffffff', tintIntensity: 0 } },
            { name: 'Ilford HP5', desc: 'Gris doux, grain moyen, polyvalent', filters: { brightness: 100, contrast: 115, saturation: 0, sepia: 0, blur: 0, grain: 13, vignette: 1, tintColor: '#ffffff', tintIntensity: 0 } },
            { name: 'Film Noir', desc: 'Dramatique, ombres écrasées', filters: { brightness: 90, contrast: 160, saturation: 0, sepia: 0, blur: 1, grain: 19, vignette: 9, tintColor: '#000000', tintIntensity: 0 } }
        ]
    },
    {
        id: 'cyber', label: 'Cyberpunk', sub: 'Néon & Digital', icon: <Monitor size={18} />, color: 'text-cyan-500',
        profiles: [
            { name: 'Blade Runner', desc: 'Teal & Orange cinématique', filters: { brightness: 110, contrast: 130, saturation: 140, sepia: 0, blur: 0, grain: 8, vignette: 4, tintColor: '#008080', tintIntensity: 35 } },
            { name: 'Matrix', desc: 'Matrice verte, contraste digital', filters: { brightness: 100, contrast: 140, saturation: 80, sepia: 0, blur: 0, grain: 19, vignette: 2, tintColor: '#00ff00', tintIntensity: 15 } }
        ]
    },
    {
        id: 'soft', label: 'Soft & Dreamy', sub: 'Douceur', icon: <Sparkles size={18} />, color: 'text-pink-400',
        profiles: [{ name: 'Orton Effect', desc: 'Glow magique', filters: { brightness: 115, contrast: 120, saturation: 110, sepia: 0, blur: 4, grain: 4, vignette: 2, tintColor: '#fff5e6', tintIntensity: 10 } }]
    }
];

export const CAMERA_BRANDS = [
    {
        id: 'fujifilm', name: 'Fujifilm', color: 'from-green-900 to-green-700', desc: 'Nostalgie & Film',
        profiles: [
            { name: 'Classic Chrome', desc: 'Docu/Street, blues→cyan, warm highlights', filters: { brightness: 105, contrast: 110, saturation: 85, blur: 0, grain: 9, vignette: 2, temperature: 5, fadedBlacks: 5, toneCurveMaster: [10, 60, 128, 200, 245], toneCurveR: [0, 64, 128, 200, 255], toneCurveB: [0, 70, 128, 180, 255], shadowTint: '#1a3333', shadowTintIntensity: 15, highlightTint: '#ffeebb', highlightTintIntensity: 10 } },
            { name: 'Velvia', desc: 'Paysages, couleurs explosives, noirs profonds', family: 'Landscape Vivid Safe', strength: 'strong', bestFor: 'paysages ternes, ciel propre, feuillage peu sature', avoidFor: 'verts deja neon, HDR smartphone tres sature, portraits', filters: { brightness: 100, contrast: 125, saturation: 145, blur: 0, grain: 6, vignette: 1, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 50, 128, 210, 255], toneCurveG: [0, 60, 128, 215, 255], toneCurveR: [0, 50, 128, 210, 255] } },
            { name: 'Astia', desc: 'Soft portrait, skin tones naturels', filters: { brightness: 105, contrast: 95, saturation: 110, blur: 0, grain: 8, vignette: 1, temperature: 5, fadedBlacks: 0, toneCurveMaster: [15, 75, 128, 190, 250] } },
            { name: 'PRO Neg. Std', desc: 'Studio portrait, tons neutres', filters: { brightness: 100, contrast: 105, saturation: 95, blur: 0, grain: 3, vignette: 1, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 68, 128, 188, 248], shadowTint: '#1a1a22', shadowTintIntensity: 8 } },
            { name: 'PRO Neg. Hi', desc: 'Portrait contrasté', filters: { brightness: 100, contrast: 118, saturation: 95, blur: 0, grain: 9, vignette: 2, temperature: 0, fadedBlacks: 5, toneCurveMaster: [15, 60, 128, 200, 255] } },
            { name: 'Eterna', desc: 'Ciné, ombres riches, teintes froides', filters: { brightness: 100, contrast: 105, saturation: 95, blur: 0, grain: 6, vignette: 1, temperature: -8, fadedBlacks: 0, toneCurveMaster: [0, 65, 128, 185, 242], shadowTint: '#1a2830', shadowTintIntensity: 20, highlightTint: '#e8eef5', highlightTintIntensity: 8 } },
            { name: 'Eterna Bleach Bypass', desc: 'Métallique, contrasté, désaturé', family: 'Film Soft', strength: 'strong', bestFor: 'architecture, scenes industrielles, ciel couvert', avoidFor: 'portraits doux, images deja contrastees ou sous-exposees', filters: { brightness: 105, contrast: 140, saturation: 40, blur: 0, grain: 15, vignette: 3, temperature: -10, fadedBlacks: 0, toneCurveMaster: [0, 40, 128, 220, 255], highlightTint: '#e6f2ff', highlightTintIntensity: 15 } },
            { name: 'Classic Neg.', desc: 'Superia 90s, HL chauds, ombres froides', family: 'Chrome Street', strength: 'experimental', bestFor: 'street, voyage, contre-jours moderes', avoidFor: 'peaux critiques, blancs speculaires, photos deja teintees', filters: { brightness: 100, contrast: 120, saturation: 95, blur: 0, grain: 13, vignette: 2, temperature: 0, fadedBlacks: 0, toneCurveMaster: [12, 55, 128, 210, 245], toneCurveG: [0, 60, 128, 190, 255], shadowTint: '#002233', shadowTintIntensity: 25, highlightTint: '#ffddaa', highlightTintIntensity: 20 } },
            { name: 'Nostalgic Neg.', desc: 'Vintage 70s, dorures chaudes', filters: { brightness: 105, contrast: 110, saturation: 105, blur: 0, grain: 8, vignette: 2, temperature: 12, fadedBlacks: 0, toneCurveMaster: [0, 58, 128, 200, 250], toneCurveR: [0, 62, 128, 200, 255], highlightTint: '#ffcc88', highlightTintIntensity: 18, shadowTint: '#2a1800', shadowTintIntensity: 12 } },
            { name: 'Provia', desc: 'Standard référence équilibré', filters: { brightness: 100, contrast: 105, saturation: 105, blur: 0, grain: 4, vignette: 1, temperature: 0, fadedBlacks: 0 } },
            { name: 'Reala Ace', desc: 'Naturel fidèle, skin tones parfaits', filters: { brightness: 105, contrast: 100, saturation: 100, blur: 0, grain: 6, vignette: 1, temperature: -2, fadedBlacks: 5, toneCurveMaster: [5, 65, 128, 192, 252] } },
            { name: 'Acros', desc: 'Monochrome contrasté, grain fin', filters: { brightness: 100, contrast: 130, saturation: 0, blur: 0, grain: 8, vignette: 3, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 50, 128, 205, 255] } },
        ]
    },
    {
        id: 'kodak', name: 'Kodak', color: 'from-yellow-700 to-amber-600', desc: 'Chaleur & Portra',
        profiles: [
            { name: 'Portra 400', desc: 'Peaux parfaites, teintes chaudes', filters: { brightness: 105, contrast: 95, saturation: 95, blur: 0, grain: 11, vignette: 1, temperature: 8, fadedBlacks: 8, toneCurveMaster: [10, 70, 128, 190, 250], toneCurveR: [0, 68, 128, 196, 255] } },
            { name: 'Portra 160', desc: 'Studio fin, pastel lumineux', filters: { brightness: 102, contrast: 100, saturation: 100, blur: 0, grain: 4, vignette: 1, temperature: 5, fadedBlacks: 0, toneCurveMaster: [0, 70, 128, 192, 252], toneCurveR: [0, 66, 128, 194, 255], shadowTint: '#1a1510', shadowTintIntensity: 8 } },
            { name: 'Portra 800', desc: 'Low-light, grain fort, chaud', filters: { brightness: 100, contrast: 115, saturation: 98, blur: 0, grain: 19, vignette: 2, temperature: 15, fadedBlacks: 10, shadowTint: '#4a3000', shadowTintIntensity: 15 } },
            { name: 'Ektar 100', desc: 'Vivid, paysages, contraste+', family: 'Landscape Vivid Safe', strength: 'experimental', bestFor: 'paysage plat, ciel propre, couleurs faibles', avoidFor: 'peaux, rouges/oranges proches clipping, JPEG deja sature', filters: { brightness: 100, contrast: 135, saturation: 140, blur: 0, grain: 4, vignette: 2, temperature: 0, fadedBlacks: 0, toneCurveR: [0, 60, 128, 205, 255], toneCurveB: [0, 60, 128, 205, 255] } },
            { name: 'Gold 200', desc: 'Classique 90s, doré et chaud', family: 'Film Soft', strength: 'strong', bestFor: 'golden hour, vacances, scenes peu saturees', avoidFor: 'interieur tungsten, peau rouge, blancs chauds deja domines', filters: { brightness: 105, contrast: 110, saturation: 125, blur: 0, grain: 13, vignette: 2, temperature: 20, fadedBlacks: 12, highlightTint: '#ffd700', highlightTintIntensity: 15 } },
            { name: 'UltraMax 400', desc: 'Punchy, froids/bleus saturés', family: 'Landscape Vivid Safe', strength: 'strong', bestFor: 'exterieur lumineux, ciel bleu terne, scene voyage', avoidFor: 'ciels deja cyan, peau froide, basse lumiere bruitee', filters: { brightness: 100, contrast: 125, saturation: 130, blur: 0, grain: 17, vignette: 2, temperature: -10, fadedBlacks: 0, toneCurveB: [0, 68, 128, 200, 255] } },
            { name: 'ColorPlus 200', desc: 'Budget vintage, jaune/vert', filters: { brightness: 95, contrast: 120, saturation: 110, blur: 0, grain: 15, vignette: 3, temperature: 15, fadedBlacks: 5, shadowTint: '#1a2200', shadowTintIntensity: 15 } },
            { name: 'Ektachrome E100', desc: 'Diapo pure, bleus parfaits', filters: { brightness: 105, contrast: 115, saturation: 115, blur: 0, grain: 3, vignette: 1, temperature: -5, fadedBlacks: 0, toneCurveMaster: [0, 60, 128, 200, 255], toneCurveB: [0, 64, 128, 210, 255] } },
            { name: 'Vision3 500T', desc: 'Cinéma tungstène, teintes froides', filters: { brightness: 100, contrast: 110, saturation: 105, blur: 0, grain: 9, vignette: 2, temperature: -15, fadedBlacks: 0, halation: 20, halationColor: '#ff3300', toneCurveMaster: [0, 55, 128, 200, 250], shadowTint: '#0a1520', shadowTintIntensity: 15 } },
            { name: 'Tri-X 400', desc: 'N&B dramatique reportage', filters: { brightness: 105, contrast: 145, saturation: 0, blur: 0, grain: 24, vignette: 4, temperature: 0, fadedBlacks: 5, toneCurveMaster: [0, 45, 128, 220, 255] } },
        ]
    },
    {
        id: 'cinestill', name: 'CineStill', color: 'from-blue-900 to-indigo-800', desc: 'Cinéma, Halation & Néons',
        profiles: [
            { name: '800T Tungsten', desc: 'Nuit urbaine, halation, froid intense', filters: { brightness: 100, contrast: 110, saturation: 110, blur: 0, grain: 9, vignette: 3, temperature: -20, fadedBlacks: 0, shadowTint: '#001a2b', shadowTintIntensity: 18, halation: 45, halationColor: '#ff2200', toneCurveMaster: [0, 52, 128, 205, 250] } },
            { name: '800T Daylight', desc: 'Look CineStill filtré chaud', filters: { brightness: 100, contrast: 108, saturation: 108, blur: 0, grain: 8, vignette: 2, temperature: -5, fadedBlacks: 0, halation: 30, halationColor: '#ff4400', toneCurveMaster: [0, 58, 128, 200, 252] } },
            { name: '50D Daylight', desc: 'Cinéma jour, grain fin, chaud', filters: { brightness: 105, contrast: 105, saturation: 110, blur: 0, grain: 8, vignette: 2, temperature: 10, fadedBlacks: 5, halation: 15, halationColor: '#ff6600', highlightTint: '#fff0d0', highlightTintIntensity: 10 } },
            { name: '400D', desc: 'Polyvalent, neutre chaud', filters: { brightness: 100, contrast: 110, saturation: 105, blur: 0, grain: 13, vignette: 2, temperature: 5, fadedBlacks: 5, halation: 25 } },
            { name: 'VistaVision', desc: 'Scope ciné, ombres profondes', filters: { brightness: 100, contrast: 112, saturation: 100, blur: 0, grain: 6, vignette: 4, temperature: -3, fadedBlacks: 0, shadowTint: '#12121c', shadowTintIntensity: 20, halation: 20, toneCurveMaster: [0, 55, 128, 205, 252] } },
        ]
    },
    {
        id: 'hasselblad', name: 'Hasselblad', color: 'from-neutral-700 to-neutral-500', desc: 'HNCS Moyen Format',
        profiles: [
            { name: 'HNCS Natural', desc: 'La référence vraie couleur, lisse', filters: { brightness: 100, contrast: 105, saturation: 95, blur: 0, grain: 0, vignette: 1, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 62, 128, 194, 255] } },
            { name: 'HNCS Portrait', desc: 'Skin tones protégés, douceur', filters: { brightness: 102, contrast: 100, saturation: 100, blur: 0, grain: 0, vignette: 1, temperature: 3, fadedBlacks: 0, toneCurveMaster: [0, 66, 128, 194, 255], toneCurveR: [0, 64, 128, 192, 252] } },
            { name: 'HNCS Landscape', desc: 'Micro-contraste, verts saturés', filters: { brightness: 100, contrast: 115, saturation: 110, blur: 0, grain: 0, vignette: 2, temperature: -2, fadedBlacks: 0, toneCurveG: [0, 60, 128, 200, 255] } },
            { name: 'Phocus B&W', desc: 'Mono 16-bit lissé, pur', filters: { brightness: 100, contrast: 110, saturation: 0, blur: 0, grain: 4, vignette: 0, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 62, 128, 194, 255] } },
            { name: 'Film Curve', desc: 'S-curve analogique contrastée', filters: { brightness: 100, contrast: 108, saturation: 100, blur: 0, grain: 4, vignette: 2, temperature: 2, fadedBlacks: 0, toneCurveMaster: [0, 45, 128, 210, 252], shadowTint: '#1a150e', shadowTintIntensity: 10 } },
        ]
    },
    {
        id: 'sony', name: 'Sony', color: 'from-orange-700 to-red-600', desc: 'Creative Looks & Cine',
        profiles: [
            { name: 'S-Cinetone', desc: 'VENICE ciné, tons chair sublimés', filters: { brightness: 100, contrast: 108, saturation: 98, blur: 0, grain: 3, vignette: 1, temperature: -3, fadedBlacks: 0, toneCurveMaster: [0, 60, 128, 192, 245], toneCurveR: [0, 62, 128, 195, 252], shadowTint: '#10121a', shadowTintIntensity: 12, highlightTint: '#ffeedd', highlightTintIntensity: 6 } },
            { name: 'ST (Standard)', desc: 'Neutre et fidèle', filters: { brightness: 100, contrast: 105, saturation: 105, blur: 0, grain: 2, vignette: 1, temperature: 0, fadedBlacks: 0 } },
            { name: 'FL (Film)', desc: 'Contrasté, ciels et verts boostés', filters: { brightness: 100, contrast: 125, saturation: 95, blur: 0, grain: 8, vignette: 2, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 50, 128, 205, 255], toneCurveB: [0, 60, 128, 210, 255], toneCurveG: [0, 60, 128, 210, 255] } },
            { name: 'PT (Portrait)', desc: 'Portrait, tons chair soyeux', filters: { brightness: 102, contrast: 102, saturation: 98, blur: 0, grain: 2, vignette: 1, temperature: 3, fadedBlacks: 0, toneCurveMaster: [0, 65, 128, 192, 252], toneCurveR: [0, 62, 128, 195, 255] } },
            { name: 'IN (Instant)', desc: 'Vintage chaud, tons dorés', filters: { brightness: 102, contrast: 108, saturation: 95, blur: 0, grain: 6, vignette: 2, temperature: 10, fadedBlacks: 0, toneCurveMaster: [0, 60, 128, 195, 248], shadowTint: '#2a1a08', shadowTintIntensity: 18, highlightTint: '#ffe8cc', highlightTintIntensity: 12 } },
            { name: 'SH (Soft Highkey)', desc: 'Lumineux, hautes lumières douces', filters: { brightness: 108, contrast: 100, saturation: 100, blur: 0, grain: 2, vignette: 0, temperature: -3, fadedBlacks: 0, toneCurveMaster: [0, 72, 138, 205, 255], highlightTint: '#f0f5ff', highlightTintIntensity: 8 } },
            { name: 'VV2 (Vivid 2)', desc: 'Pop colors intenses', family: 'Landscape Vivid Safe', strength: 'strong', bestFor: 'contenu social colore, produits ternes, daylight', avoidFor: 'teintes peau, neon, couleurs deja poussees', filters: { brightness: 105, contrast: 120, saturation: 125, blur: 0, grain: 2, vignette: 2, temperature: 5, fadedBlacks: 0, toneCurveMaster: [0, 45, 128, 215, 255] } },
            { name: 'BW (Monochrome)', desc: 'N&B dramatique', filters: { brightness: 100, contrast: 130, saturation: 0, blur: 0, grain: 8, vignette: 2, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 55, 128, 200, 255] } },
        ]
    },
    {
        id: 'leica', name: 'Leica', color: 'from-red-700 to-red-900', desc: 'Looks & M-Monochrom',
        profiles: [
            { name: 'M11 Natural', desc: 'Rendu natif modéré', filters: { brightness: 100, contrast: 105, saturation: 100, blur: 0, grain: 4, vignette: 2, temperature: 0, fadedBlacks: 0 } },
            { name: 'Classic (CLS)', desc: 'Analogique ciné, soft sat, chaud', family: 'Chrome Street', strength: 'strong', bestFor: 'street, scenes contrastees mais propres, editorial', avoidFor: 'portraits doux, ombres deja bouchees, basse lumiere', filters: { brightness: 95, contrast: 130, saturation: 85, blur: 0, grain: 13, vignette: 4, temperature: 10, fadedBlacks: 5, toneCurveMaster: [0, 45, 128, 200, 250], shadowTint: '#1a110a', shadowTintIntensity: 20 } },
            { name: 'Contemporary (CNT)', desc: 'Portrait moderne, couleurs vives', filters: { brightness: 102, contrast: 108, saturation: 110, blur: 0, grain: 3, vignette: 1, temperature: 3, fadedBlacks: 0, toneCurveMaster: [0, 58, 128, 198, 255], toneCurveR: [0, 60, 128, 200, 255], shadowTint: '#1a1018', shadowTintIntensity: 10, highlightTint: '#fff5ee', highlightTintIntensity: 6 } },
            { name: 'Brass (BRS)', desc: 'Golden hour glow', family: 'Film Soft', strength: 'strong', bestFor: 'golden hour legere, produits chauds, ambiance luxe', avoidFor: 'peaux rouges, interieurs tungsten, blancs neutres requis', filters: { brightness: 105, contrast: 110, saturation: 120, blur: 0, grain: 8, vignette: 3, temperature: 25, fadedBlacks: 5, highlightTint: '#ffcc66', highlightTintIntensity: 25 } },
            { name: 'Chrome (CHR)', desc: 'Couleurs muettes élégantes', filters: { brightness: 100, contrast: 115, saturation: 60, blur: 0, grain: 9, vignette: 2, temperature: -5, fadedBlacks: 0, toneCurveMaster: [10, 55, 128, 205, 245] } },
            { name: 'Teal (TEL)', desc: 'Cyan-blue cinématique nuit', family: 'Cinema Night', strength: 'strong', bestFor: 'nuit urbaine, neons, scenes froides', avoidFor: 'portraits daylight, ciels cyan, blancs propres', filters: { brightness: 105, contrast: 120, saturation: 90, blur: 0, grain: 11, vignette: 3, temperature: -15, fadedBlacks: 5, shadowTint: '#002b33', shadowTintIntensity: 30, highlightTint: '#ccffff', highlightTintIntensity: 10 } },
            { name: 'Vivid (VIV)', desc: 'Haut contraste et saturation', family: 'Landscape Vivid Safe', strength: 'strong', bestFor: 'paysages plats, details urbains, rendu social punchy', avoidFor: 'portraits, rouges/oranges clippees, ciel cyan', filters: { brightness: 100, contrast: 125, saturation: 130, blur: 0, grain: 6, vignette: 2, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 40, 128, 220, 255] } },
            { name: 'Sepia (SEP)', desc: 'Vintage brun/jaune', family: 'Editorial Matte', strength: 'experimental', bestFor: 'objet, archive, ambiance volontairement vintage', avoidFor: 'peaux, blancs propres, photos deja jaunes ou basses lumieres', filters: { brightness: 95, contrast: 125, saturation: 0, blur: 0, grain: 17, vignette: 5, temperature: 0, fadedBlacks: 15, shadowTint: '#331a00', shadowTintIntensity: 60, highlightTint: '#ffea80', highlightTintIntensity: 40 } },
            { name: 'M-Monochrom', desc: 'Sans CFA, tonal range absolu', filters: { brightness: 105, contrast: 120, saturation: 0, blur: 0, grain: 8, vignette: 3, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 55, 128, 195, 255] } },
            { name: 'Monochrom High Contrast', desc: 'B&W HC, ombres écrasées', filters: { brightness: 90, contrast: 160, saturation: 0, blur: 0, grain: 15, vignette: 6, temperature: 0, fadedBlacks: 0, toneCurveMaster: [0, 30, 128, 230, 255] } },
        ]
    }
];
