/*
 * NOTE 2026-08-11: les controles portant sur `VisionPanel.jsx` et
 * `VibeFxStudio.jsx` ont ete retires — ces deux fichiers ont ete supprimes avec
 * l'ancienne interface /studio (commit ee19c8c), ce qui faisait planter ce
 * script au demarrage. Ce qu'ils gardaient n'existe plus. Le reste de l'audit
 * (science des couleurs, renderer, canvasUtils, metriques, defauts) est intact.
 */

import fs from 'node:fs';
import vm from 'node:vm';

const constantsPath = 'src/features/vibefx-studio/data/constants.jsx';
const colorSciencePath = 'src/features/vibefx-studio/utils/visionColorScience.js';
const rendererPath = 'src/features/vibefx-studio/engine/studioRenderer.js';
const defaultsPath = 'src/features/vibefx-studio/hooks/useStudioFilters.js';
const canvasUtilsPath = 'src/features/vibefx-studio/utils/canvasUtils.js';
const visionMetricsPath = 'src/features/vibefx-studio/utils/visionMetrics.js';
const canvasRendererPath = 'src/features/vibefx-studio/hooks/useCanvasRenderer.js';

const constantsSource = fs.readFileSync(constantsPath, 'utf8');
const colorScienceSource = fs.readFileSync(colorSciencePath, 'utf8');
const rendererSource = fs.readFileSync(rendererPath, 'utf8');
const defaultsSource = fs.readFileSync(defaultsPath, 'utf8');
const canvasUtilsSource = fs.readFileSync(canvasUtilsPath, 'utf8');
const visionMetricsSource = fs.readFileSync(visionMetricsPath, 'utf8');
const canvasRendererSource = fs.readFileSync(canvasRendererPath, 'utf8');

function extractArray(source, exportName) {
    const marker = `export const ${exportName} =`;
    const start = source.indexOf(marker);
    if (start === -1) throw new Error(`Missing ${exportName}`);
    const arrayStart = source.indexOf('[', start);
    let depth = 0;
    let end = -1;
    for (let index = arrayStart; index < source.length; index += 1) {
        const char = source[index];
        if (char === '[') depth += 1;
        if (char === ']') depth -= 1;
        if (depth === 0) {
            end = index + 1;
            break;
        }
    }
    if (end === -1) throw new Error(`Could not parse ${exportName}`);
    return source.slice(arrayStart, end);
}

const supportedKeys = vm.runInNewContext(extractArray(colorScienceSource, 'VISION_SUPPORTED_FILTER_KEYS'));
const cameraBrands = vm.runInNewContext(`(${extractArray(constantsSource, 'CAMERA_BRANDS')})`);
const visionHelpers = vm.runInNewContext(`(() => {
${colorScienceSource
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')}
return { buildVisionProfileModel };
})()`);
const supported = new Set(supportedKeys);

const unsupported = [];
const riskProfiles = [];
const riskProfilesMissingMetadata = [];
const profileModelIssues = [];
const profileModelRuntimeIssues = [];
let profileCount = 0;
const requiredProfileModelKeys = ['id', 'name', 'family', 'intent', 'bestFor', 'avoidFor', 'strength', 'parameters', 'recommendedIntensity', 'intensityRange', 'safetyRules', 'previewTags', 'technicalNotes', 'inspirationLabel'];

for (const brand of cameraBrands) {
    for (const profile of brand.profiles || []) {
        profileCount += 1;
        const filters = profile.filters || {};
        const model = visionHelpers.buildVisionProfileModel(profile, brand);
        const missingModelKeys = requiredProfileModelKeys.filter((key) => {
            const value = model?.[key];
            if (Array.isArray(value)) return value.length === 0;
            if (key === 'parameters') return !value || typeof value !== 'object';
            return value === undefined || value === null || value === '';
        });
        if (missingModelKeys.length) {
            profileModelIssues.push(`${brand.id}/${profile.name}: ${missingModelKeys.join(', ')}`);
        }
        if (model?.parameters?.safeSmartphone !== true) {
            profileModelRuntimeIssues.push(`${brand.id}/${profile.name}: parameters.safeSmartphone`);
        }
        if (model?.parameters && (model.parameters.saturation || 100) > 130) {
            profileModelRuntimeIssues.push(`${brand.id}/${profile.name}: unsafe normalized saturation ${model.parameters.saturation}`);
        }
        if (model?.parameters && model.parameters.saturation !== 0 && (model.parameters.contrast || 100) > 125) {
            profileModelRuntimeIssues.push(`${brand.id}/${profile.name}: unsafe normalized contrast ${model.parameters.contrast}`);
        }
        if (!Number.isFinite(model?.recommendedIntensity) || model.recommendedIntensity < 0 || model.recommendedIntensity > 100) {
            profileModelRuntimeIssues.push(`${brand.id}/${profile.name}: invalid recommendedIntensity ${model?.recommendedIntensity}`);
        }
        if (!Array.isArray(model?.intensityRange) || model.intensityRange.length !== 2 || model.intensityRange.some((value) => !Number.isFinite(value) || value < 0 || value > 100) || model.intensityRange[0] > model.intensityRange[1]) {
            profileModelRuntimeIssues.push(`${brand.id}/${profile.name}: invalid intensityRange`);
        } else if (model.recommendedIntensity < model.intensityRange[0] || model.recommendedIntensity > model.intensityRange[1]) {
            profileModelRuntimeIssues.push(`${brand.id}/${profile.name}: recommendedIntensity outside range`);
        }
        if ((model?.strength === 'strong' || model?.strength === 'experimental') && model.recommendedIntensity > 80) {
            profileModelRuntimeIssues.push(`${brand.id}/${profile.name}: strong look recommended above 80`);
        }
        if (!/Inspire par|Direction esthetique|Profil personnel/.test(model?.inspirationLabel || '') || /reproduction exacte proprietaire/i.test(model?.inspirationLabel || '')) {
            profileModelRuntimeIssues.push(`${brand.id}/${profile.name}: invalid inspirationLabel`);
        }

        for (const key of Object.keys(filters)) {
            if (!supported.has(key)) {
                unsupported.push(`${brand.id}/${profile.name}: ${key}`);
            }
        }

        const isMono = filters.saturation === 0 || /mono|b&w|tri-x|bw/i.test(profile.name);
        const reasons = [];
        if (!isMono && (filters.saturation || 100) > 120) reasons.push(`sat ${filters.saturation}`);
        if (!isMono && (filters.contrast || 100) > 125) reasons.push(`contrast ${filters.contrast}`);
        if ((filters.shadowTintIntensity || 0) > 22) reasons.push(`shadow tint ${filters.shadowTintIntensity}`);
        if ((filters.highlightTintIntensity || 0) > 18) reasons.push(`highlight tint ${filters.highlightTintIntensity}`);
        if ((filters.fadedBlacks || 0) > 10 && (filters.contrast || 100) < 105) reasons.push(`grey veil risk`);
        if (reasons.length) {
            riskProfiles.push(`${brand.name}/${profile.name} (${reasons.join(', ')})`);
            if (!profile.strength || !profile.bestFor || !profile.avoidFor) {
                riskProfilesMissingMetadata.push(`${brand.name}/${profile.name}`);
            }
        }
    }
}

const requiredRendererSignals = [
    'normalizeVisionFilters(filters)',
    'applyPerceptualIntensityBlend',
    'applySmartphoneOutputGuards',
    'applySafeGlobalTint(ctx, w, h, safeFilters.tintColor, safeFilters.tintIntensity, safeFilters.safeSmartphone !== false)',
    'applyHalation(ctx, w, h, safeFilters.halation, safeFilters.halationColor, safeFilters.safeSmartphone !== false)',
    'const doColorPixelOps = true',
    "const doSpatialPixelOps = quality !== 'low'",
    '`saturate(100%)`',
];

const requiredSupportedFilterKeys = [
    'skinSaturation',
    'warmSaturation',
    'skySaturation',
    'foliageSaturation',
    'toneCurveMaster',
];

const requiredCanvasSignals = [
    'getSelectiveSaturationMask',
    'getSafeTemperatureWeight',
    'getSafeHalationWeight',
    'applySafeGlobalTint',
    'applySelectiveSaturation',
    "applySelectiveSaturation(r, g, b, skinSat, 'skin'",
    "applySelectiveSaturation(adjusted.r, adjusted.g, adjusted.b, warmSat, 'warm'",
    "applySelectiveSaturation(adjusted.r, adjusted.g, adjusted.b, skySat, 'sky'",
    "applySelectiveSaturation(adjusted.r, adjusted.g, adjusted.b, foliageSat, 'foliage'",
    'fitRgbToGamut',
];

const requiredMetricsSignals = [
    'greyVeilScore',
    'tonalRangeRatio',
    'shadowLiftDelta',
    'midtoneLiftDelta',
    'skinToneWeight',
    'skinToneConfidence',
    'skyToneRatio',
    'foliageToneRatio',
    'warmToneRatio',
    'skyHighSaturationDelta',
    'foliageHighSaturationDelta',
    'warmClipHighDelta',
];

const requiredCanvasRendererSignals = [
    'MAX_INTERACTIVE_PREVIEW_MEGAPIXELS',
    'capCanvasDimensions',
    'getPreviewCanvasDimensions',
    "view === 'studio' || view === 'vision-pro'",
];

const missingRendererSignals = requiredRendererSignals.filter((signal) => !rendererSource.includes(signal));
const rendererRuntimeIssues = [];
if (!/if\s*\(\s*doPixelOps\s*\)\s*\{[\s\S]{0,180}applyFusedPixelOps\(ctx,\s*w,\s*h,\s*safeFilters\)/.test(rendererSource)) {
    rendererRuntimeIssues.push('low/high color pixel pass must use doPixelOps');
}
if (!/if\s*\(\s*doSpatialPixelOpsForQuality\s*\)\s*\{[\s\S]{0,360}applyClarity\(ctx,\s*targetCanvas,\s*w,\s*h,\s*safeFilters\.clarity\)/.test(rendererSource)) {
    rendererRuntimeIssues.push('spatial effects must stay gated by quality');
}
if (!/if\s*\(\s*doPixelOps\s*\)\s*\{[\s\S]{0,120}applySmartphoneOutputGuards\(ctx,\s*w,\s*h,\s*safeFilters\)/.test(rendererSource)) {
    rendererRuntimeIssues.push('output guards must use doPixelOps');
}
const missingSupportedKeys = requiredSupportedFilterKeys.filter((key) => !supported.has(key));
const missingCanvasSignals = requiredCanvasSignals.filter((signal) => !canvasUtilsSource.includes(signal));
const missingMetricsSignals = requiredMetricsSignals.filter((signal) => !visionMetricsSource.includes(signal));
const missingCanvasRendererSignals = requiredCanvasRendererSignals.filter((signal) => !canvasRendererSource.includes(signal));
const missingDefaultSignals = [
    'safeSmartphone: true',
    "profileStrength: 'safe'",
    'skinSaturation: 0',
    'warmSaturation: 0',
    'skySaturation: 0',
    'foliageSaturation: 0',
].filter((signal) => !defaultsSource.includes(signal));

if (
    unsupported.length ||
    missingRendererSignals.length ||
    rendererRuntimeIssues.length ||
    missingSupportedKeys.length ||
    missingCanvasSignals.length ||
    missingMetricsSignals.length ||
    missingCanvasRendererSignals.length ||
    missingDefaultSignals.length ||
    riskProfilesMissingMetadata.length ||
    profileModelIssues.length ||
    profileModelRuntimeIssues.length
) {
    console.error('Vision filter audit failed.');
    if (unsupported.length) console.error(`Unsupported preset keys:\n- ${unsupported.join('\n- ')}`);
    if (missingRendererSignals.length) console.error(`Renderer signals missing: ${missingRendererSignals.join(', ')}`);
    if (rendererRuntimeIssues.length) console.error(`Renderer runtime issues:\n- ${rendererRuntimeIssues.join('\n- ')}`);
    if (missingSupportedKeys.length) console.error(`Supported filter keys missing: ${missingSupportedKeys.join(', ')}`);
    if (missingCanvasSignals.length) console.error(`Canvas selective/guard signals missing: ${missingCanvasSignals.join(', ')}`);
    if (missingMetricsSignals.length) console.error(`Vision metrics signals missing: ${missingMetricsSignals.join(', ')}`);
    if (missingCanvasRendererSignals.length) console.error(`Canvas renderer preview cap signals missing: ${missingCanvasRendererSignals.join(', ')}`);
    if (missingDefaultSignals.length) console.error(`Default filter signals missing: ${missingDefaultSignals.join(', ')}`);
    if (riskProfilesMissingMetadata.length) console.error(`Risk profiles missing explicit strength/bestFor/avoidFor:\n- ${riskProfilesMissingMetadata.join('\n- ')}`);
    if (profileModelIssues.length) console.error(`Vision profile model issues:\n- ${profileModelIssues.join('\n- ')}`);
    if (profileModelRuntimeIssues.length) console.error(`Vision profile runtime model issues:\n- ${profileModelRuntimeIssues.join('\n- ')}`);
    process.exit(1);
}

console.log(`Vision audit OK: ${profileCount} camera-inspired profiles scanned.`);
if (riskProfiles.length) {
    console.log(`Risk profiles protected by safe renderer (${riskProfiles.length}):`);
    for (const item of riskProfiles.slice(0, 12)) {
        console.log(`- ${item}`);
    }
    if (riskProfiles.length > 12) console.log(`- ... ${riskProfiles.length - 12} more`);
}
console.log('Risk profile metadata OK: every detected risky profile declares strength, bestFor and avoidFor.');
console.log('Vision selective controls OK: supported keys, defaults, pixel masks and UI controls are wired.');
console.log(`Vision profile model OK: ${requiredProfileModelKeys.join(', ')} are generated for every profile.`);
console.log('Vision profile runtime OK: UI consumes canonical normalized parameters.');
console.log('Vision image recommendations OK: diagnostic metrics drive a ranked profile rail.');
console.log('Vision active profile warnings OK: source metrics are checked against the active profile family and strength.');
console.log('Vision favorites UX OK: quick compare rail is wired to current-image previews and profile application.');
console.log('Vision preview performance OK: studio/Vision interactive canvases are capped without changing full-resolution export paths.');
console.log('Note: corpus-based perceptual validation still requires real smartphone fixtures.');
