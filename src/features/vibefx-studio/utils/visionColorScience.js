const IDENTITY_CURVE = [0, 64, 128, 192, 255];
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export const VISION_SUPPORTED_FILTER_KEYS = [
    /* Identifiant du preset applique en LUT 3D (voir `visionPresets.js`).
       Ce n'est pas un reglage borne comme les autres: c'est une reference vers
       une transformation compilee, appliquee AVANT les reglages manuels. */
    'presetId',
    'brightness',
    'contrast',
    'saturation',
    'sepia',
    'blur',
    'grain',
    'grainSize',
    'grainRoughness',
    'vignette',
    'tintColor',
    'tintIntensity',
    'filterIntensity',
    'highlights',
    'shadows',
    'vibrance',
    'skinSaturation',
    'warmSaturation',
    'skySaturation',
    'foliageSaturation',
    'temperature',
    'texture',
    'clarity',
    'sharpness',
    'dehaze',
    'toneCurveMaster',
    'toneCurveR',
    'toneCurveG',
    'toneCurveB',
    'shadowTint',
    'shadowTintIntensity',
    'highlightTint',
    'highlightTintIntensity',
    'halation',
    'halationColor',
    'fadedBlacks',
    'hueRotate',
    'safeSmartphone',
    'profileStrength',
];

/*
 * Les bornes des garde-fous smartphone, en UN SEUL endroit.
 *
 * Elles etaient ecrites en dur dans `normalizeVisionFilters`, et l'interface
 * proposait ses propres bornes, plus larges. Resultat: un tiers de la course du
 * curseur ne faisait RIEN — on poussait « Contraste » jusqu'a 180 alors que le
 * moteur ramenait a 125, sans que rien ne l'indique. Ca se lit comme un bug, et
 * c'en etait un.
 *
 * `neutre` est la valeur au repos: c'est elle que l'interface aligne au milieu
 * de la course, pour que tous les curseurs a zero soient sur la meme verticale.
 * Quand `neutre` vaut `min`, le reglage est additif (grain, nettete...) et sa
 * position de repos est a gauche — c'est normal, et c'est visible.
 */
export const VISION_SAFE_BOUNDS = {
    brightness: { min: 85, max: 115, neutre: 100 },
    contrast: { min: 80, max: 125, monoMax: 145, neutre: 100 },
    saturation: { min: 45, max: 120, neutre: 100 },
    vibrance: { min: -45, max: 45, neutre: 0 },
    skinSaturation: { min: -20, max: 15, neutre: 0 },
    warmSaturation: { min: -35, max: 18, neutre: 0 },
    skySaturation: { min: -35, max: 25, neutre: 0 },
    foliageSaturation: { min: -35, max: 22, neutre: 0 },
    temperature: { min: -22, max: 22, neutre: 0 },
    highlights: { min: -45, max: 35, neutre: 0 },
    shadows: { min: -35, max: 45, neutre: 0 },
    /*
     * Clarte et nettete sont a l'echelle de Lightroom depuis le 2026-08-16.
     * Pour la clarte, le dosage collait deja au sien; c'est le rayon qui a
     * change, pas la signification du nombre. Pour la nettete, l'echelle va
     * desormais jusqu'a 150 comme la sienne, et 40 est ce qu'il pose par defaut
     * sur tout preset: le plafond « sur » doit donc au moins le permettre.
     */
    /*
     * La texture est a l'echelle de Lightroom des DEUX cotes depuis le
     * 2026-08-17: le negatif a enfin ete mesure, et il tourne sur le meme couple
     * de rayons que le positif, avec son dosage propre (voir `applyTexture`).
     * La borne basse s'ouvre donc, symetrique du plafond sur.
     */
    texture: { min: -50, max: 50, neutre: 0 },
    /*
     * La borne basse passe de -25 a -30 le 2026-08-19, en meme temps que le
     * dosage negatif de la clarte est cale sur Lightroom (`applyClarity`). Le
     * negatif est desormais BEAUCOUP plus doux a curseur egal — -25 adoucissait
     * de moitie, il n'enleve plus que 17 % du detail — donc la course peut
     * s'ouvrir jusqu'a -30 (0,80 d'amplification, soit un adoucissement franc
     * mais sain) et devenir symetrique du plafond.
     */
    clarity: { min: -30, max: 30, neutre: 0 },
    sharpness: { min: 0, max: 60, neutre: 0 },
    dehaze: { min: 0, max: 35, neutre: 0 },
    /*
     * L'echelle du grain est celle de LIGHTROOM depuis le 2026-08-15 (mesure:
     * ecart-type = 0,367 x valeur, constant du noir au blanc).
     *
     * LE PLAFOND EST 100, LE SIEN, depuis le 2026-08-20. Il etait a 40 — « un
     * grain de film credible vit entre 8 et 25 » — mais un garde-fou n'a de
     * sens que contre un defaut qu'on ne peut pas rattraper: une peau orange,
     * un ciel fluo, des noirs bouches. Du grain trop fort se voit tout de suite
     * et se retire d'un geste. Surtout, le plafond ecretait EN SILENCE un
     * preset importe qui aurait porte plus de 40, ce qui est exactement ce que
     * cette chaine d'import doit eviter. La course du curseur est donc celle de
     * son panneau, cran pour cran.
     */
    grain: { min: 0, max: 100, neutre: 0 },
    /*
     * La GROSSEUR des grains, a l'echelle de Lightroom (son sous-reglage
     * « Taille », 25 par defaut). Elle ne fait rien tant que `grain` vaut 0:
     * c'est un reglage DU grain, pas un reglage a part. La loi et les mesures
     * sont dans `grainField.js`.
     */
    grainSize: { min: 0, max: 100, neutre: 25 },
    /*
     * La CASSURE, le troisieme curseur de son panneau Grain. A 0 elle pose
     * 1,72x plus de grain, a 100 elle grossit les grains de moitie sans changer
     * la force. Mesuree le 2026-08-22; la loi est dans `grainField.js`.
     */
    grainRoughness: { min: 0, max: 100, neutre: 50 },
    vignette: { min: 0, max: 30, neutre: 0 },
    /*
     * AJOUTES LE 2026-08-17. Ces huit bornes existaient deja, mais ECRITES EN
     * DUR dans `normalizeVisionFilters` juste en dessous — donc invisibles pour
     * une interface, qui proposait alors ses propres chiffres. Mesure faite ce
     * jour-la sur /creer/studio: pousser « Sepia » a 100 rendait exactement la
     * meme image qu'a 12, « Flou » a 10 la meme qu'a 2, « Grain » a 100 la meme
     * qu'a 40, « Vignettage » a 100 la meme qu'a 30. Les valeurs sont donc
     * inchangees: c'est leur EMPLACEMENT qui change, pour que le panneau puisse
     * les lire au lieu de les inventer.
     */
    sepia: { min: 0, max: 12, monoMax: 25, neutre: 0 },
    blur: { min: 0, max: 2, neutre: 0 },
    hueRotate: { min: -12, max: 12, neutre: 0 },
    fadedBlacks: { min: 0, max: 8, monoMax: 12, neutre: 0 },
    halation: { min: 0, max: 32, neutre: 0 },
    tintIntensity: { min: 0, max: 10, monoMax: 18, neutre: 0 },
    shadowTintIntensity: { min: 0, max: 18, monoMax: 28, neutre: 0 },
    highlightTintIntensity: { min: 0, max: 12, monoMax: 22, neutre: 0 },
};

/*
 * Bornes hors garde-fous. Plus larges, mais pas infinies: au-dela, le moteur ne
 * produit plus une photo, il produit un artefact.
 */
export const VISION_FREE_BOUNDS = {
    brightness: { min: 60, max: 140, neutre: 100 },
    contrast: { min: 60, max: 180, neutre: 100 },
    saturation: { min: 0, max: 180, neutre: 100 },
    vibrance: { min: -50, max: 50, neutre: 0 },
    skinSaturation: { min: -30, max: 30, neutre: 0 },
    warmSaturation: { min: -40, max: 40, neutre: 0 },
    skySaturation: { min: -40, max: 40, neutre: 0 },
    foliageSaturation: { min: -40, max: 40, neutre: 0 },
    temperature: { min: -30, max: 30, neutre: 0 },
    highlights: { min: -50, max: 50, neutre: 0 },
    shadows: { min: -50, max: 50, neutre: 0 },
    texture: { min: -100, max: 100, neutre: 0 },
    clarity: { min: -100, max: 100, neutre: 0 },
    sharpness: { min: 0, max: 150, neutre: 0 },
    dehaze: { min: 0, max: 50, neutre: 0 },
    grain: { min: 0, max: 100, neutre: 0 },
    grainSize: { min: 0, max: 100, neutre: 25 },
    grainRoughness: { min: 0, max: 100, neutre: 50 },
    vignette: { min: 0, max: 100, neutre: 0 },
    /*
     * Hors garde-fous, `normalizeVisionFilters` ne borne RIEN (elle sort avant).
     * Ces plafonds ne sont donc pas appliques par le moteur: ils disent a
     * l'interface jusqu'ou il est raisonnable de laisser aller la course en
     * mode creatif. Ils reprennent ce que le panneau Studio proposait deja.
     */
    sepia: { min: 0, max: 100, neutre: 0 },
    blur: { min: 0, max: 10, neutre: 0 },
    hueRotate: { min: -180, max: 180, neutre: 0 },
    fadedBlacks: { min: 0, max: 40, neutre: 0 },
    halation: { min: 0, max: 60, neutre: 0 },
    tintIntensity: { min: 0, max: 100, neutre: 0 },
    shadowTintIntensity: { min: 0, max: 100, neutre: 0 },
    highlightTintIntensity: { min: 0, max: 100, neutre: 0 },
};

/* Les bornes qui s'appliquent vraiment, selon l'etat des garde-fous. */
export function visionBoundsFor(key, { safe = true, mono = false } = {}) {
    const table = safe ? VISION_SAFE_BOUNDS : VISION_FREE_BOUNDS;
    const bounds = table[key];
    if (!bounds) return null;
    const max = mono && bounds.monoMax !== undefined ? bounds.monoMax : bounds.max;
    return { min: bounds.min, max, neutre: bounds.neutre };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
/* Applique les bornes du tableau ci-dessus, pour qu'elles ne puissent pas
   diverger de ce que l'interface affiche. */
const clampSafe = (value, key, fallback, mono = false) => {
    const bounds = VISION_SAFE_BOUNDS[key];
    const max = mono && bounds.monoMax !== undefined ? bounds.monoMax : bounds.max;
    return clamp(value ?? fallback, bounds.min, max);
};
const isIdentityCurve = (curve) => !curve || curve.every((value, index) => value === IDENTITY_CURVE[index]);
const normalizeHexColor = (value, fallback) => HEX_COLOR_RE.test(value || '') ? value : fallback;
const slugifyVisionId = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'profile';

function normalizeToneCurve(curve) {
    if (!Array.isArray(curve) || curve.length !== 5) return undefined;
    let previous = 0;
    return curve.map((point, index) => {
        const base = IDENTITY_CURVE[index];
        const bounded = clamp(point, Math.max(0, base - 42), Math.min(255, base + 42));
        const monotone = Math.max(index === 0 ? 0 : previous, bounded);
        previous = monotone;
        return monotone;
    });
}

const classifyProfileFamily = (profile) => {
    const text = `${profile?.name || ''} ${profile?.desc || ''}`.toLowerCase();
    const filters = profile?.filters || {};

    if ((filters.saturation ?? 100) === 0 || text.includes('mono') || text.includes('b&w') || text.includes('tri-x') || text.includes('bw')) {
        return 'Monochrome Rich';
    }
    if (text.includes('portrait') || text.includes('skin') || text.includes('peau')) return 'Portrait Skin';
    if (text.includes('night') || text.includes('nuit') || text.includes('800t') || text.includes('neon') || text.includes('néon')) return 'Cinema Night';
    if (text.includes('landscape') || text.includes('paysage') || text.includes('velvia') || text.includes('vivid')) return 'Landscape Vivid Safe';
    if (text.includes('chrome') || text.includes('street') || text.includes('docu')) return 'Chrome Street';
    if (text.includes('cine') || text.includes('ciné') || text.includes('vision') || text.includes('eterna')) return 'Film Soft';
    if ((filters.fadedBlacks || 0) > 8 || text.includes('matte') || text.includes('vintage')) return 'Editorial Matte';
    return 'Natural Clean';
};

export function normalizeVisionFilters(filters = {}) {
    const next = { ...filters };
    const strength = next.profileStrength || 'balanced';
    const safe = next.safeSmartphone !== false;
    const isMono = (next.saturation ?? 100) === 0;

    if (next.filterIntensity === undefined) next.filterIntensity = 100;
    if (!safe) return next;

    next.brightness = clampSafe(next.brightness, 'brightness', 100);
    next.contrast = clampSafe(next.contrast, 'contrast', 100, isMono);
    next.sepia = clampSafe(next.sepia || 0, 'sepia', 0, isMono);
    next.blur = clampSafe(next.blur || 0, 'blur', 0);
    next.hueRotate = clampSafe(next.hueRotate || 0, 'hueRotate', 0);

    const saturation = next.saturation ?? 100;
    if (isMono) {
        next.saturation = 0;
    } else if (saturation > 120) {
        const excess = saturation - 120;
        next.saturation = strength === 'experimental' ? Math.min(saturation, 130) : 120;
        next.vibrance = clamp((next.vibrance || 0) + excess * 0.35, -20, 35);
    } else {
        next.saturation = clampSafe(saturation, 'saturation', 100);
    }

    next.vibrance = clampSafe(next.vibrance || 0, 'vibrance', 0);
    next.skinSaturation = clampSafe(next.skinSaturation || 0, 'skinSaturation', 0);
    next.warmSaturation = clampSafe(next.warmSaturation || 0, 'warmSaturation', 0);
    next.skySaturation = clampSafe(next.skySaturation || 0, 'skySaturation', 0);
    next.foliageSaturation = clampSafe(next.foliageSaturation || 0, 'foliageSaturation', 0);
    next.temperature = clampSafe(next.temperature || 0, 'temperature', 0);
    next.highlights = clampSafe(next.highlights || 0, 'highlights', 0);
    next.shadows = clampSafe(next.shadows || 0, 'shadows', 0);
    next.texture = clampSafe(next.texture || 0, 'texture', 0);
    next.clarity = clampSafe(next.clarity || 0, 'clarity', 0);
    next.sharpness = clampSafe(next.sharpness || 0, 'sharpness', 0);
    next.dehaze = clampSafe(next.dehaze || 0, 'dehaze', 0);
    next.tintIntensity = clampSafe(next.tintIntensity || 0, 'tintIntensity', 0, isMono);
    next.shadowTintIntensity = clampSafe(next.shadowTintIntensity || 0, 'shadowTintIntensity', 0, isMono);
    next.highlightTintIntensity = clampSafe(next.highlightTintIntensity || 0, 'highlightTintIntensity', 0, isMono);
    next.fadedBlacks = clampSafe(next.fadedBlacks || 0, 'fadedBlacks', 0, isMono);
    next.halation = clampSafe(next.halation || 0, 'halation', 0);
    next.vignette = clampSafe(next.vignette || 0, 'vignette', 0);
    next.grain = clampSafe(next.grain || 0, 'grain', 0, isMono);
    /* Au repos c'est 25, la valeur de Lightroom — pas 0, qui donnerait des
       grains PLUS FINS qu'un pixel et un bruit plus fort. */
    next.grainSize = clampSafe(
        next.grainSize === undefined || next.grainSize === null ? 25 : next.grainSize,
        'grainSize',
        25,
        isMono,
    );
    /* Au repos c'est 50, sa valeur par defaut — pas 0, qui poserait 1,72x plus
       de grain (mesure du 2026-08-22, voir `grainField.js`). */
    next.grainRoughness = clampSafe(
        next.grainRoughness === undefined || next.grainRoughness === null ? 50 : next.grainRoughness,
        'grainRoughness',
        50,
        isMono,
    );
    next.tintColor = normalizeHexColor(next.tintColor, '#ffffff');
    next.shadowTint = next.shadowTint ? normalizeHexColor(next.shadowTint, '#000000') : next.shadowTint;
    next.highlightTint = next.highlightTint ? normalizeHexColor(next.highlightTint, '#ffffff') : next.highlightTint;
    next.halationColor = next.halationColor ? normalizeHexColor(next.halationColor, '#ff4500') : next.halationColor;
    next.toneCurveMaster = normalizeToneCurve(next.toneCurveMaster);
    next.toneCurveR = normalizeToneCurve(next.toneCurveR);
    next.toneCurveG = normalizeToneCurve(next.toneCurveG);
    next.toneCurveB = normalizeToneCurve(next.toneCurveB);

    return next;
}

function analyzeVisionProfile(profile) {
    const filters = profile?.filters || {};
    const family = profile?.family || classifyProfileFamily(profile);
    const tags = [];
    const warnings = [];
    const isMono = (filters.saturation ?? 100) === 0 || family === 'Monochrome Rich';

    if (family.includes('Portrait')) tags.push('portrait safe');
    if (family.includes('Night')) tags.push('night');
    if (family.includes('Landscape')) tags.push('landscape');
    if (isMono) tags.push('mono');
    if ((filters.halation || 0) > 0) tags.push('halation');
    if ((filters.grain || 0) >= 35) tags.push('grain');

    const strongContrast = (filters.contrast || 100) > (isMono ? 145 : 125);
    const strongSaturation = !isMono && (filters.saturation || 100) > 120;
    const strongTint = (filters.tintIntensity || 0) > 12 || (filters.shadowTintIntensity || 0) > 22 || (filters.highlightTintIntensity || 0) > 18;
    const greyVeilRisk = (filters.fadedBlacks || 0) > 10 && (filters.contrast || 100) < 105;

    if (strongContrast) warnings.push('contraste fort');
    if (strongSaturation) warnings.push('saturation forte');
    if (strongTint) warnings.push('teinte forte');
    if (greyVeilRisk) warnings.push('risque voile');

    const explicitStrength = profile?.strength || profile?.profileStrength || filters.profileStrength;
    const strength = explicitStrength || (warnings.length > 1 || filters.profileStrength === 'experimental'
        ? 'experimental'
        : warnings.length === 1 || (filters.halation || 0) > 28 || (filters.grain || 0) > 45
            ? 'strong'
            : 'safe');

    return {
        family,
        strength,
        tags: tags.length ? tags : ['safe smartphone'],
        warnings,
        bestFor: profile?.bestFor || inferBestFor(family),
        avoidFor: profile?.avoidFor || inferAvoidFor(family, strength),
    };
}

export function describeVisionProfile(profile) {
    return buildVisionProfileModel(profile);
}

export function buildVisionProfileModel(profile, brand = null) {
    const filters = profile?.filters || {};
    const analysis = analyzeVisionProfile(profile);
    const normalizedParameters = normalizeVisionFilters({
        ...filters,
        safeSmartphone: true,
        profileStrength: profile?.strength || filters.profileStrength || analysis.strength,
    });
    const id = profile?.id || [brand?.id, slugifyVisionId(profile?.name)].filter(Boolean).join(':');
    const intensityGuidance = inferIntensityGuidance(analysis.family, analysis.strength);

    return {
        id,
        name: profile?.name || 'Profil Vision',
        family: analysis.family,
        intent: profile?.intent || inferIntent(analysis.family, analysis.strength),
        bestFor: analysis.bestFor,
        avoidFor: analysis.avoidFor,
        strength: analysis.strength,
        parameters: normalizedParameters,
        recommendedIntensity: profile?.recommendedIntensity || intensityGuidance.recommendedIntensity,
        intensityRange: profile?.intensityRange || intensityGuidance.intensityRange,
        safetyRules: profile?.safetyRules || inferSafetyRules(filters, analysis),
        previewTags: profile?.previewTags || buildPreviewTags(analysis, filters),
        technicalNotes: profile?.technicalNotes || inferTechnicalNotes(filters, analysis, normalizedParameters),
        inspirationLabel: profile?.inspirationLabel || inferInspirationLabel(profile, brand),
        tags: analysis.tags,
        warnings: analysis.warnings,
    };
}

function inferInspirationLabel(profile, brand) {
    if (brand?.name) return `Inspire par ${brand.name} - direction esthetique, pas reproduction exacte`;
    if (profile?.family === 'Custom Safe' || profile?.id?.startsWith?.('custom:')) return 'Profil personnel local - direction utilisateur';
    return 'Direction esthetique Vision - pas reproduction exacte';
}

function inferBestFor(family) {
    if (family === 'Portrait Skin') return 'portraits, selfies, lumiere douce';
    if (family === 'Cinema Night') return 'nuit, neons, scenes urbaines';
    if (family === 'Landscape Vivid Safe') return 'ciel, nature, voyage';
    if (family === 'Chrome Street') return 'rue, architecture, documentaire';
    if (family === 'Monochrome Rich') return 'reportage, contraste, textures';
    if (family === 'Editorial Matte') return 'editorial, mode, ambiance douce';
    if (family === 'Film Soft') return 'rendus cinema moderes';
    return 'JPEG smartphone polyvalents';
}

function inferAvoidFor(family, strength) {
    if (strength === 'experimental') return 'peaux critiques, photos deja clippees';
    if (family === 'Cinema Night') return 'portraits plein soleil, blancs speculaires';
    if (family === 'Landscape Vivid Safe') return 'verts deja neon, HDR tres sature';
    if (family === 'Editorial Matte') return 'images deja plates ou brumeuses';
    if (family === 'Monochrome Rich') return 'contenu ou la couleur porte le message';
    return 'images deja fortement filtrees';
}

function inferIntent(family, strength) {
    const prefix = strength === 'experimental' ? 'Look fort a doser' : strength === 'strong' ? 'Signature visible maitrisee' : 'Correction propre social-ready';
    if (family === 'Portrait Skin') return `${prefix}, priorite peau et blancs propres`;
    if (family === 'Cinema Night') return `${prefix}, ambiance nocturne avec neons preserves`;
    if (family === 'Landscape Vivid Safe') return `${prefix}, couleur paysage sans verts/cyans toxiques`;
    if (family === 'Chrome Street') return `${prefix}, rue documentaire avec saturation retenue`;
    if (family === 'Monochrome Rich') return `${prefix}, separation tonale noir et blanc`;
    if (family === 'Editorial Matte') return `${prefix}, noirs leves sans voile gris`;
    if (family === 'Film Soft') return `${prefix}, rolloff film doux`;
    return `${prefix}, amelioration polyvalente JPEG smartphone`;
}

function inferIntensityGuidance(family, strength) {
    if (strength === 'experimental') return { recommendedIntensity: 55, intensityRange: [35, 70] };
    if (strength === 'strong') return { recommendedIntensity: 70, intensityRange: [45, 80] };
    if (family === 'Portrait Skin') return { recommendedIntensity: 85, intensityRange: [60, 100] };
    if (family === 'Editorial Matte') return { recommendedIntensity: 75, intensityRange: [50, 90] };
    if (family === 'Cinema Night') return { recommendedIntensity: 80, intensityRange: [50, 95] };
    return { recommendedIntensity: 90, intensityRange: [60, 100] };
}

function inferSafetyRules(filters, analysis) {
    const rules = ['safeSmartphone default', 'linear-light intensity blend'];
    const isMono = (filters.saturation ?? 100) === 0 || analysis.family === 'Monochrome Rich';
    if (!isMono) rules.push('adaptive saturation ceiling');
    if ((filters.saturation || 100) > 120 || analysis.family === 'Landscape Vivid Safe') rules.push('chroma rolloff before clamp');
    if (analysis.family === 'Portrait Skin' || /portrait|skin|peau/i.test(`${analysis.bestFor} ${analysis.avoidFor}`)) rules.push('skin hue/saturation protection');
    if ((filters.shadowTintIntensity || 0) > 0 || (filters.highlightTintIntensity || 0) > 0 || filters.shadowTint || filters.highlightTint) rules.push('soft luminance masks for tonal tints');
    if ((filters.fadedBlacks || 0) > 0 || analysis.family === 'Editorial Matte') rules.push('grey veil watch');
    if ((filters.halation || 0) > 0) rules.push('highlight purity for halation');
    if ((filters.grain || 0) > 0) rules.push('grain after tone/color pass');
    if (analysis.strength !== 'safe') rules.push('explicit strong-look metadata');
    return Array.from(new Set(rules));
}

function buildPreviewTags(analysis, filters) {
    const tags = [...analysis.tags];
    if ((filters.temperature || 0) > 8) tags.push('warm');
    if ((filters.temperature || 0) < -8) tags.push('cool');
    if ((filters.fadedBlacks || 0) > 0) tags.push('matte');
    if ((filters.contrast || 100) >= 120) tags.push('contrast');
    if (analysis.warnings.length) tags.push('watch');
    return Array.from(new Set(tags)).slice(0, 5);
}

function inferTechnicalNotes(filters, analysis, normalizedParameters) {
    const notes = [];
    const originalSaturation = filters.saturation ?? 100;
    const normalizedSaturation = normalizedParameters.saturation ?? 100;
    const originalContrast = filters.contrast ?? 100;
    const normalizedContrast = normalizedParameters.contrast ?? 100;

    if (originalSaturation !== normalizedSaturation) notes.push(`saturation ${originalSaturation}->${normalizedSaturation}`);
    if (originalContrast !== normalizedContrast) notes.push(`contrast ${originalContrast}->${normalizedContrast}`);
    if (getCurveRisk(filters) !== 'none') notes.push(`curve risk ${getCurveRisk(filters)}`);
    if ((filters.shadowTintIntensity || 0) || (filters.highlightTintIntensity || 0)) notes.push('split toning masked');
    if ((filters.halation || 0) > 0) notes.push('halation late pass');
    if ((filters.grain || 0) > 0) notes.push('grain late pass');
    if (!notes.length) notes.push(`${analysis.family} balanced defaults`);
    return notes;
}

export function listUnsupportedVisionKeys(profileFilters = {}) {
    return Object.keys(profileFilters).filter((key) => !VISION_SUPPORTED_FILTER_KEYS.includes(key));
}

export function getCurveRisk(filters = {}) {
    const curves = [filters.toneCurveMaster, filters.toneCurveR, filters.toneCurveG, filters.toneCurveB].filter(Boolean);
    if (!curves.length || curves.every(isIdentityCurve)) return 'none';
    const maxDelta = curves.reduce((largest, curve) => {
        const local = curve.reduce((acc, value, index) => Math.max(acc, Math.abs(value - IDENTITY_CURVE[index])), 0);
        return Math.max(largest, local);
    }, 0);
    if (maxDelta > 35) return 'strong';
    if (maxDelta > 20) return 'medium';
    return 'low';
}
