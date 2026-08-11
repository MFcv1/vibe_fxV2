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

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
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

    next.brightness = clamp(next.brightness ?? 100, 85, 115);
    next.contrast = clamp(next.contrast ?? 100, 80, isMono ? 145 : 125);
    next.sepia = clamp(next.sepia || 0, 0, isMono ? 25 : 12);
    next.blur = clamp(next.blur || 0, 0, 2);
    next.hueRotate = clamp(next.hueRotate || 0, -12, 12);

    const saturation = next.saturation ?? 100;
    if (isMono) {
        next.saturation = 0;
    } else if (saturation > 120) {
        const excess = saturation - 120;
        next.saturation = strength === 'experimental' ? Math.min(saturation, 130) : 120;
        next.vibrance = clamp((next.vibrance || 0) + excess * 0.35, -20, 35);
    } else {
        next.saturation = clamp(saturation, 45, 120);
    }

    next.vibrance = clamp(next.vibrance || 0, -45, 45);
    next.skinSaturation = clamp(next.skinSaturation || 0, -20, 15);
    next.warmSaturation = clamp(next.warmSaturation || 0, -35, 18);
    next.skySaturation = clamp(next.skySaturation || 0, -35, 25);
    next.foliageSaturation = clamp(next.foliageSaturation || 0, -35, 22);
    next.temperature = clamp(next.temperature || 0, -22, 22);
    next.highlights = clamp(next.highlights || 0, -45, 35);
    next.shadows = clamp(next.shadows || 0, -35, 45);
    next.clarity = clamp(next.clarity || 0, -25, 30);
    next.sharpness = clamp(next.sharpness || 0, 0, 35);
    next.dehaze = clamp(next.dehaze || 0, 0, 35);
    next.tintIntensity = clamp(next.tintIntensity || 0, 0, isMono ? 18 : 10);
    next.shadowTintIntensity = clamp(next.shadowTintIntensity || 0, 0, isMono ? 28 : 18);
    next.highlightTintIntensity = clamp(next.highlightTintIntensity || 0, 0, isMono ? 22 : 12);
    next.fadedBlacks = clamp(next.fadedBlacks || 0, 0, isMono ? 12 : 8);
    next.halation = clamp(next.halation || 0, 0, 32);
    next.vignette = clamp(next.vignette || 0, 0, 30);
    next.grain = clamp(next.grain || 0, 0, isMono ? 55 : 42);
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
