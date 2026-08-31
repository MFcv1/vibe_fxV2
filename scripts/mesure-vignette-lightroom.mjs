/*
 * Compare une exportation Lightroom sans vignette a la meme image avec
 * vignette, apres avoir applique le moteur VibeFX a la premiere.
 *
 * Usage:
 * node scripts/mesure-vignette-lightroom.mjs sans.png avec.png \
 *   amount midpoint roundness feather highlights [rendu-vibefx.png]
 */

import sharp from 'sharp';
import {
    applyLightroomVignette,
    lightroomVignetteGainAtRadius,
    lightroomVignetteMeasuredGainAtRadius,
} from '../src/features/vibefx-studio/utils/canvasUtils.js';

const [sourcePath, targetPath, ...rawArgs] = process.argv.slice(2);
if (!sourcePath || !targetPath || rawArgs.length < 5) {
    console.error('Usage: node scripts/mesure-vignette-lightroom.mjs sans.png avec.png amount midpoint roundness feather highlights [sortie.png]');
    process.exit(2);
}

const [amount, midpoint, roundness, feather, highlights] = rawArgs.slice(0, 5).map(Number);
const outputPath = rawArgs[5] || null;
if ([amount, midpoint, roundness, feather, highlights].some((value) => !Number.isFinite(value))) {
    console.error('Les cinq reglages de vignette doivent etre numeriques.');
    process.exit(2);
}

const decode = async (path) => {
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data: new Uint8ClampedArray(data), info };
};

const source = await decode(sourcePath);
const target = await decode(targetPath);
if (source.info.width !== target.info.width || source.info.height !== target.info.height) {
    console.error('Les deux images doivent avoir les memes dimensions.');
    process.exit(2);
}

let rendered = new Uint8ClampedArray(source.data);
const ctx = {
    getImageData: () => ({ data: new Uint8ClampedArray(rendered) }),
    putImageData: (imageData) => { rendered = new Uint8ClampedArray(imageData.data); },
};

applyLightroomVignette(ctx, source.info.width, source.info.height, Math.abs(amount), {
    midpoint,
    roundness,
    feather,
    highlights,
    measuredProfile: true,
});

let absolute = 0;
let squared = 0;
let max = 0;
let count = 0;
const segments = {
    low: { absolute: 0, count: 0 },
    high: { absolute: 0, count: 0 },
};
for (let i = 0; i < rendered.length; i += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
        const delta = Math.abs(rendered[i + channel] - target.data[i + channel]);
        absolute += delta;
        squared += delta * delta;
        max = Math.max(max, delta);
        count += 1;
        const segment = source.data[i + channel] < 128 ? segments.low : segments.high;
        segment.absolute += delta;
        segment.count += 1;
    }
}

const mae = absolute / count;
const rmse = Math.sqrt(squared / count);
const srgbToLinear = (value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const inverseRadius = (gain) => {
    let low = 0;
    let high = 1.45;
    for (let iteration = 0; iteration < 24; iteration += 1) {
        const middle = (low + high) / 2;
        if (lightroomVignetteGainAtRadius(middle, Math.abs(amount)) > gain) low = middle;
        else high = middle;
    }
    return (low + high) / 2;
};

/* Profil radial observe. On n'utilise que les canaux 32..120: sous cette
   limite la protection des hautes lumieres ne brouille pas le gain spatial. */
const radial = Array.from({ length: 29 }, () => ({ sum: 0, count: 0 }));
const cx = (source.info.width - 1) / 2;
const cy = (source.info.height - 1) / 2;
for (let y = 0; y < source.info.height; y += 4) {
    const dy = (y - cy) / (source.info.height / 2);
    for (let x = 0; x < source.info.width; x += 4) {
        const dx = (x - cx) / (source.info.width / 2);
        const radius = Math.sqrt(dx * dx + dy * dy);
        const bin = Math.min(radial.length - 1, Math.round(radius / 0.05));
        const i = (y * source.info.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
            const before = source.data[i + channel];
            const after = target.data[i + channel];
            if (before < 32 || before > 120 || after > before) continue;
            const sourceLinear = srgbToLinear(before);
            if (sourceLinear <= 0) continue;
            radial[bin].sum += srgbToLinear(after) / sourceLinear;
            radial[bin].count += 1;
        }
    }
}
const radialProfile = radial.map((bin, index) => {
    if (!bin.count) return null;
    const observedGain = bin.sum / bin.count;
    return {
        radius: Number((index * 0.05).toFixed(2)),
        observedGain: Number(observedGain.toFixed(4)),
        effectiveRadius: Number(inverseRadius(observedGain).toFixed(4)),
        samples: bin.count,
    };
}).filter(Boolean);

const highlightForces = [];
if (midpoint === 50 && roundness === 0 && feather === 50) {
    for (let y = 0; y < source.info.height; y += 4) {
        const dy = (y - cy) / (source.info.height / 2);
        for (let x = 0; x < source.info.width; x += 4) {
            const dx = (x - cx) / (source.info.width / 2);
            const gain = lightroomVignetteMeasuredGainAtRadius(Math.sqrt(dx * dx + dy * dy), Math.abs(amount));
            if (gain < 0.18 || gain > 0.97) continue;
            const i = (y * source.info.width + x) * 4;
            for (let channel = 0; channel < 3; channel += 1) {
                const before = source.data[i + channel];
                const after = target.data[i + channel];
                if (before < 140 || before > 225 || after > before) continue;
                const sourceLinear = srgbToLinear(before);
                const weight = Math.max(0, Math.min(1, (sourceLinear - 0.216) / (0.502 - 0.216)));
                if (weight < 0.15 || gain >= 0.999) continue;
                const observed = srgbToLinear(after) / sourceLinear;
                const force = (observed / gain - 1) / ((1 - gain) * weight);
                if (Number.isFinite(force) && force >= -0.5 && force <= 3) highlightForces.push(force);
            }
        }
    }
}
highlightForces.sort((a, b) => a - b);
const fittedHighlightForce = highlightForces.length
    ? highlightForces[Math.floor(highlightForces.length / 2)]
    : null;
console.log(JSON.stringify({
    source: sourcePath,
    target: targetPath,
    size: `${source.info.width}x${source.info.height}`,
    settings: { amount, midpoint, roundness, feather, highlights },
    mae: Number(mae.toFixed(3)),
    rmse: Number(rmse.toFixed(3)),
    max,
    maeLow: Number((segments.low.absolute / segments.low.count).toFixed(3)),
    maeHigh: Number((segments.high.absolute / segments.high.count).toFixed(3)),
    fittedHighlightForce: fittedHighlightForce === null ? null : Number(fittedHighlightForce.toFixed(4)),
    radialProfile,
}, null, 2));

if (outputPath) {
    await sharp(Buffer.from(rendered), {
        raw: { width: source.info.width, height: source.info.height, channels: 4 },
    }).png().toFile(outputPath);
}
