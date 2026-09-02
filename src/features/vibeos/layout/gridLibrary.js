/*
 * Bibliotheque de grilles editoriales du Layout VibeOS.
 *
 * Une grille n'est pas une liste de rectangles ecrite a la main: c'est un
 * ARBRE de rangees et de colonnes (`rows` / `cols`) compile en zones
 * normalisees (x, y, w, h dans [0,1]) par `compileGridSpec`. Deux raisons:
 *
 * 1. Les compositions "magazine" (une grande image + une colonne de details,
 *    un escalier, un bento) s'ecrivent en trois lignes au lieu de vingt
 *    coordonnees a recalculer a la main des qu'un poids bouge.
 * 2. Instagram publie en 4:5 ET en 1:1. Une meme grille etiree d'un format a
 *    l'autre ecrase la composition, donc CHAQUE grille porte deux variantes
 *    (`portrait` et `square`) avec le MEME nombre de zones et le meme ordre de
 *    lecture: changer de format re-compile la grille au lieu de la deformer,
 *    et chaque photo reste dans sa zone (les ids sont stables par index).
 *
 * Un enfant marque `void: true` ne produit pas de zone: c'est du vide
 * assume (marge editoriale, bandeau de titre), le fond du visuel s'y voit.
 * Les gouttieres ne sont PAS dans la geometrie: le moteur
 * (`layoutRenderer.renderTemplateSlots`) creuse lui-meme `customLayoutGap`
 * entre les zones, donc les rectangles pavent exactement la surface.
 */

/* Le moteur refuse une zone sous 8% (utils/customLayout.MIN_ZONE_SIZE):
   aucune variante ne descend sous ce seuil. */
const MIN_ZONE_SIZE = 0.08;

const round = (value) => Math.round(value * 10000) / 10000;

function walkSpec(node, rect, out) {
    const children = node.rows || node.cols;
    if (!children || !children.length) {
        out.push(rect);
        return;
    }
    const vertical = Boolean(node.rows);
    const total = children.reduce((sum, child) => sum + (child.f ?? 1), 0) || 1;
    let offset = 0;
    children.forEach((child) => {
        const share = (child.f ?? 1) / total;
        const childRect = vertical
            ? { x: rect.x, y: rect.y + (offset * rect.h), w: rect.w, h: rect.h * share }
            : { x: rect.x + (offset * rect.w), y: rect.y, w: rect.w * share, h: rect.h };
        offset += share;
        if (child.void) return;
        if (child.rows || child.cols) {
            walkSpec(child, childRect, out);
            return;
        }
        out.push({ ...childRect, label: child.l });
    });
}

/* Compile un arbre en rectangles normalises, dans l'ordre de lecture. */
export function compileGridSpec(spec) {
    const out = [];
    walkSpec(spec, { x: 0, y: 0, w: 1, h: 1 }, out);
    return out.map((rect) => ({
        x: round(Math.max(0, Math.min(1 - MIN_ZONE_SIZE, rect.x))),
        y: round(Math.max(0, Math.min(1 - MIN_ZONE_SIZE, rect.y))),
        w: round(Math.max(MIN_ZONE_SIZE, Math.min(1, rect.w))),
        h: round(Math.max(MIN_ZONE_SIZE, Math.min(1, rect.h))),
        label: rect.label,
    }));
}

/* ---------------------------------------------------------------------------
 * Ecriture des grilles
 * z() = une zone image, v() = du vide, rf()/cf() = un bloc rangees/colonnes.
 * Le premier argument est le poids relatif dans son parent.
 * ------------------------------------------------------------------------- */
const z = (f = 1, l = undefined) => ({ f, l });
const v = (f = 1) => ({ f, void: true });
const R = (...children) => ({ rows: children });
const C = (...children) => ({ cols: children });
const rf = (f, ...children) => ({ f, rows: children });
const cf = (f, ...children) => ({ f, cols: children });

export const GRID_CATEGORIES = [
    { id: 'editorial', label: 'Éditorial', hint: 'Une image forte qui commande le reste.' },
    { id: 'asym', label: 'Asymétrique', hint: 'Grands et petits formats qui se répondent.' },
    { id: 'gallery', label: 'Galerie', hint: 'Séries régulières, planches et moodboards.' },
    { id: 'bands', label: 'Bandes & duos', hint: 'Triptyques, pellicules, diptyques décalés.' },
    { id: 'narrative', label: 'Narratif', hint: 'Rythme, vide assumé, lecture guidée.' },
    { id: 'classics', label: 'Classiques', hint: 'Les grilles historiques du studio.' },
];

/* Chaque entree: deux variantes de MEME longueur, portrait 4:5 et carre 1:1. */
const GRID_DEFINITIONS = [
    /* ---------------- Éditorial ---------------- */
    {
        id: 'hero-column',
        label: 'Une + colonne',
        category: 'editorial',
        description: 'Une image plein cadre à gauche, deux respirations à droite.',
        specs: {
            portrait: C(z(62, 'Image maîtresse'), rf(38, z(1, 'Détail haut'), z(1, 'Détail bas'))),
            square: C(z(60, 'Image maîtresse'), rf(40, z(1, 'Détail haut'), z(1, 'Détail bas'))),
        },
    },
    {
        id: 'hero-band',
        label: 'Une + bande',
        category: 'editorial',
        description: 'Grande ouverture, puis une bande de trois plans serrés.',
        specs: {
            portrait: R(z(70, 'Ouverture'), cf(30, z(), z(), z())),
            square: R(z(66, 'Ouverture'), cf(34, z(), z(), z())),
        },
    },
    {
        id: 'masthead',
        label: 'Manchette',
        category: 'editorial',
        description: 'Deux vignettes en tête, l’image de fond occupe la page.',
        specs: {
            portrait: R(cf(26, z(64, 'Amorce'), z(36)), z(74, 'Image principale')),
            square: R(cf(30, z(62, 'Amorce'), z(38)), z(70, 'Image principale')),
        },
    },
    {
        id: 'editorial-l',
        label: 'L éditorial',
        category: 'editorial',
        description: 'Un L : deux images empilées et une verticale pleine hauteur.',
        specs: {
            portrait: C(rf(64, z(58), z(42)), z(36, 'Verticale')),
            square: C(rf(62, z(55), z(45)), z(38, 'Verticale')),
        },
    },
    {
        id: 'title-band',
        label: 'Bandeau titre',
        category: 'editorial',
        description: 'Une bande vide en haut pour le titre, quatre images dessous.',
        specs: {
            portrait: R(v(18), rf(82, cf(1, z(), z()), cf(1, z(), z()))),
            square: R(v(16), rf(84, cf(1, z(), z()), cf(1, z(), z()))),
        },
    },

    /* ---------------- Asymétrique ---------------- */
    {
        id: 'golden',
        label: 'Nombre d’or',
        category: 'asym',
        description: 'Découpe en 62/38 dans les deux sens : jamais deux blocs égaux.',
        specs: {
            portrait: R(cf(62, z(62, 'Image maîtresse'), rf(38, z(), z())), cf(38, z(38), z(62))),
            square: R(cf(60, z(62, 'Image maîtresse'), rf(38, z(), z())), cf(40, z(38), z(62))),
        },
    },
    {
        id: 'stair',
        label: 'Escalier',
        category: 'asym',
        description: 'Trois rangées dont l’appui bascule d’un côté à l’autre.',
        specs: {
            portrait: R(cf(1, z(62), z(38)), cf(1, z(38), z(62)), cf(1, z(62), z(38))),
            square: R(cf(1.1, z(64), z(36)), cf(1, z(36), z(64)), cf(0.9, z(60), z(40))),
        },
    },
    {
        id: 'pillars',
        label: 'Colonnes',
        category: 'asym',
        description: 'Trois colonnes, celle du centre pleine hauteur.',
        specs: {
            portrait: C(rf(34, z(62), z(38)), z(32, 'Colonne centrale'), rf(34, z(38), z(62))),
            square: C(rf(34, z(56), z(44)), z(32, 'Colonne centrale'), rf(34, z(44), z(56))),
        },
    },
    {
        id: 'corner',
        label: 'Angle fort',
        category: 'asym',
        description: 'Le poids en haut à gauche, la respiration en bas à droite.',
        specs: {
            portrait: R(cf(62, z(66, 'Angle'), rf(34, z(), z())), cf(38, z(36), z(64))),
            square: R(cf(58, z(64, 'Angle'), rf(36, z(), z())), cf(42, z(38), z(62))),
        },
    },
    {
        id: 'bento',
        label: 'Bento',
        category: 'asym',
        description: 'Deux blocs miroirs : petit-petit-grand, puis grand-petit-petit.',
        specs: {
            portrait: R(cf(52, rf(56, z(), z()), z(44)), cf(48, z(44), rf(56, z(), z()))),
            square: R(cf(50, rf(58, z(), z()), z(42)), cf(50, z(42), rf(58, z(), z()))),
        },
    },

    /* ---------------- Galerie ---------------- */
    {
        id: 'gallery-6',
        label: 'Galerie 6',
        category: 'gallery',
        description: 'Six plans égaux : 2×3 en portrait, 3×2 en carré.',
        specs: {
            portrait: R(cf(1, z(), z()), cf(1, z(), z()), cf(1, z(), z())),
            square: R(cf(1, z(), z(), z()), cf(1, z(), z(), z())),
        },
    },
    {
        id: 'gallery-9',
        label: 'Galerie 9',
        category: 'gallery',
        description: 'La planche 3×3, comme un mini profil Instagram.',
        /* Decoupe volontairement identique dans les deux formats: seule la
           proportion des cases suit le cadre. */
        uniform: true,
        specs: {
            portrait: R(cf(1, z(), z(), z()), cf(1, z(), z(), z()), cf(1, z(), z(), z())),
            square: R(cf(1, z(), z(), z()), cf(1, z(), z(), z()), cf(1, z(), z(), z())),
        },
    },
    {
        id: 'contact-12',
        label: 'Planche contact',
        category: 'gallery',
        description: 'Douze vignettes façon planche contact argentique.',
        specs: {
            portrait: R(
                cf(1, z(), z(), z()), cf(1, z(), z(), z()),
                cf(1, z(), z(), z()), cf(1, z(), z(), z()),
            ),
            square: R(
                cf(1, z(), z(), z(), z()),
                cf(1, z(), z(), z(), z()),
                cf(1, z(), z(), z(), z()),
            ),
        },
    },
    {
        id: 'mosaic-5',
        label: 'Mosaïque 5',
        category: 'gallery',
        description: 'Deux images larges au-dessus d’un triptyque serré.',
        specs: {
            portrait: R(cf(58, z(58), z(42)), cf(42, z(), z(), z())),
            square: R(cf(56, z(56), z(44)), cf(44, z(), z(), z())),
        },
    },
    {
        id: 'grid-frame',
        label: 'Passe-partout',
        category: 'gallery',
        description: 'Quatre images cadrées par une marge, comme un tirage encadré.',
        specs: {
            portrait: R(v(11), cf(78, v(6), rf(88, cf(1, z(), z()), cf(1, z(), z())), v(6)), v(11)),
            square: R(v(9), cf(82, v(6), rf(88, cf(1, z(), z()), cf(1, z(), z())), v(6)), v(9)),
        },
    },

    /* ---------------- Bandes & duos ---------------- */
    {
        id: 'triptych-v',
        label: 'Triptyque vertical',
        category: 'bands',
        description: 'Trois verticales pleine hauteur : très graphique en 4:5.',
        /* Decoupe volontairement identique dans les deux formats: seule la
           proportion des cases suit le cadre. */
        uniform: true,
        specs: {
            portrait: C(z(), z(), z()),
            square: C(z(), z(), z()),
        },
    },
    {
        id: 'strip-4',
        label: 'Pellicule 4',
        category: 'bands',
        description: 'Quatre bandes panoramiques empilées.',
        /* Decoupe volontairement identique dans les deux formats: seule la
           proportion des cases suit le cadre. */
        uniform: true,
        specs: {
            portrait: R(z(), z(), z(), z()),
            square: R(z(), z(), z(), z()),
        },
    },
    {
        id: 'pano-duo',
        label: 'Panorama + duo',
        category: 'bands',
        description: 'Un panoramique en tête, deux plans en dessous.',
        specs: {
            portrait: R(z(52, 'Panorama'), cf(48, z(), z())),
            square: R(z(50, 'Panorama'), cf(50, z(), z())),
        },
    },
    {
        id: 'diptych-offset',
        label: 'Diptyque décalé',
        category: 'bands',
        description: 'Deux images côte à côte, décalées : le vide fait la respiration.',
        specs: {
            portrait: C(rf(52, z(84), v(16)), rf(48, v(16), z(84))),
            square: C(rf(52, z(82), v(18)), rf(48, v(18), z(82))),
        },
    },

    /* ---------------- Narratif ---------------- */
    {
        id: 'crescendo',
        label: 'Crescendo',
        category: 'narrative',
        description: 'Une ouverture, un duo, un trio : le regard descend.',
        specs: {
            portrait: R(z(44, 'Ouverture'), cf(30, z(), z()), cf(26, z(), z(), z())),
            square: R(z(42, 'Ouverture'), cf(32, z(), z()), cf(26, z(), z(), z())),
        },
    },
    {
        id: 'focus-band',
        label: 'Focus central',
        category: 'narrative',
        description: 'Une image centrale encadrée de deux frises de trois vignettes.',
        specs: {
            portrait: R(cf(17, z(), z(), z()), z(66, 'Sujet'), cf(17, z(), z(), z())),
            square: R(cf(19, z(), z(), z()), z(62, 'Sujet'), cf(19, z(), z(), z())),
        },
    },
    {
        id: 'margin-story',
        label: 'Marge éditoriale',
        category: 'narrative',
        description: 'Deux images en diagonale, beaucoup de vide autour.',
        specs: {
            portrait: R(cf(54, z(76), v(24)), v(7), cf(39, v(24), z(76))),
            square: R(cf(52, z(74), v(26)), v(6), cf(42, v(26), z(74))),
        },
    },
    {
        id: 'zigzag',
        label: 'Zigzag',
        category: 'narrative',
        description: 'Trois images qui alternent de bord, le fond fait la marge.',
        specs: {
            portrait: R(cf(1, z(70), v(30)), cf(1, v(30), z(70)), cf(1, z(70), v(30))),
            square: R(cf(1.05, z(72), v(28)), cf(1, v(28), z(72)), cf(0.95, z(68), v(32))),
        },
    },
    {
        id: 'polyptych',
        label: 'Polyptyque 8',
        category: 'narrative',
        description: 'Huit plans en trois temps : maîtresse, duo, trio.',
        specs: {
            portrait: R(
                cf(40, z(58, 'Image maîtresse'), rf(42, z(), z())),
                cf(32, z(40), z(60)),
                cf(28, z(), z(), z()),
            ),
            square: R(
                cf(38, z(56, 'Image maîtresse'), rf(44, z(), z())),
                cf(34, z(42), z(58)),
                cf(28, z(), z(), z()),
            ),
        },
    },
];

const withMeta = (preset) => {
    const portraitZones = preset.specs
        ? compileGridSpec(preset.specs.portrait)
        : (preset.zones || []);
    return { ...preset, slots: portraitZones.length };
};

export const GRID_PRESETS = GRID_DEFINITIONS.map(withMeta);

/*
 * Les grilles historiques du studio (`CUSTOM_LAYOUT_PRESETS`) sont posees en
 * zones fixes, pas en arbre: elles entrent dans la bibliotheque telles quelles,
 * pour qu'un projet enregistre avec l'une d'elles se rouvre a l'identique.
 * Sans variantes de format, un changement de format ne les recompile pas.
 */
export const asFixedGrid = (preset, category = 'classics') => withMeta({
    id: preset.id,
    label: preset.label,
    category,
    description: preset.description || '',
    fixed: true,
    zones: preset.zones || [],
});

/* Les grilles proposees directement dans le panneau, sans ouvrir la
   bibliotheque: une de chaque famille, du plus simple au plus rythme. */
export const FEATURED_GRID_IDS = [
    'hero-column', 'hero-band', 'golden', 'bento', 'mosaic-5', 'crescendo',
];

export const DEFAULT_GRID_ID = 'hero-column';

export const DEFAULT_GRID_TRANSFORM = { flipX: false, flipY: false, shift: 0 };

export function findGridPreset(presetId) {
    if (!presetId) return null;
    return GRID_PRESETS.find((preset) => preset.id === presetId) || null;
}

export function gridPresetsByCategory(categoryId) {
    return GRID_PRESETS.filter((preset) => preset.category === categoryId);
}

/*
 * Quelle variante pour ce format? Le carre sert aussi de base aux formats
 * larges (paysage, panoramas), le portrait aux formats hauts (story).
 */
export function pickGridVariant(format) {
    const ratio = Number(format?.ratio) || 0.8;
    return ratio > 0.9 ? 'square' : 'portrait';
}

/* Miroirs et rotation des photos: appliques APRES la compilation, donc
   conserves quand la grille est recompilee pour un autre format. */
export function applyGridTransform(zones, transform = DEFAULT_GRID_TRANSFORM) {
    const { flipX = false, flipY = false, shift = 0 } = transform || {};
    if (!flipX && !flipY && !shift) return zones;
    const count = zones.length || 1;
    return zones.map((zone, index) => {
        const x = flipX ? round(1 - zone.x - zone.w) : zone.x;
        const y = flipY ? round(1 - zone.y - zone.h) : zone.y;
        return {
            ...zone,
            x,
            y,
            homeX: x,
            homeY: y,
            imageIndex: (((index + shift) % count) + count) % count,
        };
    });
}

/*
 * Zones pretes pour le moteur. Les ids sont stables (`<preset>-<n>`): les
 * photos deposees zone par zone (slotConfigs) et la selection survivent a un
 * changement de format.
 */
export function buildGridZones(preset, format, transform = DEFAULT_GRID_TRANSFORM) {
    if (!preset) return [];
    const rects = preset.specs
        ? compileGridSpec(preset.specs[pickGridVariant(format)] || preset.specs.portrait)
        : (preset.zones || []);
    const zones = rects.map((rect, index) => ({
        id: rect.id || `${preset.id}-${index + 1}`,
        label: rect.label || `Image ${index + 1}`,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        homeX: rect.x,
        homeY: rect.y,
        homeW: rect.w,
        homeH: rect.h,
        imageIndex: index,
    }));
    return applyGridTransform(zones, transform);
}

/* Apercu: memes rectangles que le rendu, sans passer par le moteur. */
export function gridPreviewZones(preset, variant = 'portrait') {
    if (!preset) return [];
    if (!preset.specs) return preset.zones || [];
    return compileGridSpec(preset.specs[variant] || preset.specs.portrait);
}

/* Miroir applique directement a des zones deja posees (grille modifiee a la
   main): l'operation est sa propre inverse, elle reste juste sans recompiler. */
export function mirrorZones(zones, axis = 'x') {
    return (zones || []).map((zone) => {
        if (axis === 'y') {
            const y = round(1 - zone.y - zone.h);
            return { ...zone, y, homeY: y };
        }
        const x = round(1 - zone.x - zone.w);
        return { ...zone, x, homeX: x };
    });
}

/* Fait tourner l'affectation des photos d'un cran dans la grille. */
export function rotateZoneImages(zones, step = 1) {
    const list = zones || [];
    const count = list.length || 1;
    return list.map((zone, index) => ({
        ...zone,
        imageIndex: ((((zone.imageIndex ?? index) + step) % count) + count) % count,
    }));
}
