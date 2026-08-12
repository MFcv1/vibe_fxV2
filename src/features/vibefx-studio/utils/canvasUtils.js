// ═══════════════════════════════════════════════════════════
//  CANVAS UTILITIES — Vision Pro Colorimetry Engine v3
//
//  v2 → v3 Changelog:
//  - Fused pixel ops (4× getImageData → 1×) = perf ×4
//  - Physical blackbody temperature model (Tanner Helland)
//  - Added: Highlights, Shadows, Vibrance, Dehaze
//  - Added: Clarity (spatial high-pass), Sharpness (unsharp mask)
//  - Improved grain: 512px, Box-Muller gaussian
// ═══════════════════════════════════════════════════════════

// ── Improved Noise Pattern (512px, Box-Muller Gaussian) ──
import { normalizeVisionFilters } from './visionColorScience';

/*
 * La mire de grain.
 *
 * ELLE ETAIT INVISIBLE, et c'est mesure: a fond (grain 42), elle ajoutait
 * +0,12/255 de bruit a une photo qui en porte deja 6,5 — cinquante fois moins
 * que le bruit propre du capteur. Le curseur bougeait, l'image ne bougeait pas.
 *
 * Deux causes cumulees: le canal alpha de la mire etait tire au hasard entre 0
 * et 70/255 (donc la mire etait deja transparente aux trois quarts), PUIS le
 * rendu la posait avec un `globalAlpha` de grain/100 * 0,5. Les deux
 * attenuations se multipliaient.
 *
 * La mire est desormais OPAQUE: c'est le rendu qui dose, en un seul endroit
 * (voir `studioRenderer`, etage Grain). Le bruit reste gaussien d'ecart-type 50
 * autour du gris moyen, ce qui donne un grain de film et non du bruit
 * numerique.
 */
export const createNoisePattern = () => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const idata = ctx.createImageData(size, size);
    const data = idata.data;
    for (let i = 0; i < data.length; i += 4) {
        const u1 = Math.random() || 0.0001;
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const val = Math.max(0, Math.min(255, Math.round(128 + z * 50)));
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
    }
    ctx.putImageData(idata, 0, 0);
    return canvas;
};

export const NOISE_PATTERN_CANVAS = createNoisePattern();

// ── Tone Curve LUT Builder ───────────────────────────────
export function buildCurveLUT(points) {
    if (!points || points.length !== 5) {
        const lut = new Uint8Array(256);
        for (let i = 0; i < 256; i++) lut[i] = i;
        return lut;
    }
    const xs = [0, 64, 128, 192, 255];
    const ys = points;
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        let seg = 0;
        for (let s = 0; s < 4; s++) {
            if (i >= xs[s] && i <= xs[s + 1]) { seg = s; break; }
        }
        if (i > xs[4]) seg = 3;
        const x0 = xs[seg], x1 = xs[seg + 1];
        const y0 = ys[seg], y1 = ys[seg + 1];
        const t = x1 === x0 ? 0 : (i - x0) / (x1 - x0);
        const t2 = t * t;
        const t3 = t2 * t;
        const h = 3 * t2 - 2 * t3;
        const val = y0 + (y1 - y0) * h;
        lut[i] = Math.max(0, Math.min(255, Math.round(val)));
    }
    return lut;
}

// ── Physical Temperature (Tanner Helland Blackbody) ──────
function blackbodyToRGB(kelvin) {
    const t = kelvin / 100;
    let r, g, b;
    if (t <= 66) {
        r = 255;
        g = Math.max(0, Math.min(255, 99.4708 * Math.log(t) - 161.1196));
    } else {
        r = Math.max(0, Math.min(255, 329.6987 * Math.pow(t - 60, -0.1332)));
        g = Math.max(0, Math.min(255, 288.1222 * Math.pow(t - 60, -0.0755)));
    }
    if (t >= 66) b = 255;
    else if (t <= 19) b = 0;
    else b = Math.max(0, Math.min(255, 138.5177 * Math.log(t - 10) - 305.0448));
    return { r, g, b };
}

function getTemperatureMultipliers(temperature) {
    if (!temperature || temperature === 0) return null;
    const kelvin = Math.max(2000, Math.min(12000, 6500 - temperature * 35));
    const target = blackbodyToRGB(kelvin);
    const neutral = blackbodyToRGB(6500);
    let rM = target.r / (neutral.r || 1);
    let gM = target.g / (neutral.g || 1);
    let bM = target.b / (neutral.b || 1);
    const mx = Math.max(rM, gM, bM);
    if (mx > 0) { rM /= mx; gM /= mx; bM /= mx; }
    const s = 0.5;
    return { rMul: 1 + (rM - 1) * s, gMul: 1 + (gM - 1) * s, bMul: 1 + (bM - 1) * s };
}

// ── Hex to RGB ───────────────────────────────────────────
function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}

const clampChannel = (value) => Math.max(0, Math.min(255, value));

const smoothstep = (edge0, edge1, value) => {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
};

function getHueDegrees(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    if (d === 0) return 0;
    let h;
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    return h < 0 ? h + 360 : h;
}

function getHueRangeMask(hue, center, radius) {
    const distance = Math.abs(((hue - center + 540) % 360) - 180);
    return 1 - smoothstep(radius * 0.58, radius, distance);
}

function getSkinProtection(r, g, b, lum, chroma) {
    if (lum < 35 || lum > 235 || chroma < 16) return 1;
    const hue = getHueDegrees(r, g, b);
    const hueWeight = hue >= 15 && hue <= 55 ? 1 : hue >= 350 || hue <= 70 ? 0.55 : 0;
    const channelShape = r > g && g >= b ? 1 : 0.35;
    return 1 - 0.5 * hueWeight * channelShape;
}

function getSafeTemperatureWeight(lum, chroma) {
    const neutralWeight = Math.max(0.28, smoothstep(8, 42, chroma));
    const highlightPurity = 1 - smoothstep(218, 252, lum) * 0.82;
    const shadowPurity = smoothstep(14, 42, lum);
    return Math.max(0, Math.min(1, neutralWeight * highlightPurity * shadowPurity));
}

function getSafeHalationWeight(lum, chroma) {
    const highlightWeight = smoothstep(198, 246, lum);
    const colorSignal = smoothstep(14, 64, chroma);
    const neutralSpecularGuard = 1 - (1 - colorSignal) * smoothstep(226, 252, lum) * 0.88;
    return Math.max(0, Math.min(1, highlightWeight * Math.max(0.12, colorSignal) * neutralSpecularGuard));
}

function getSelectiveSaturationMask(range, r, g, b, lum, chroma) {
    if (chroma < 10) return 0;
    const hue = getHueDegrees(r, g, b);
    if (range === 'skin') {
        const hueMask = getHueRangeMask(hue, 34, 36);
        const lumaMask = smoothstep(36, 72, lum) * (1 - smoothstep(228, 248, lum));
        const channelShape = r >= g * 0.86 && r >= b * 1.02 && g >= b * 0.76 ? 1 : 0.35;
        return hueMask * lumaMask * channelShape;
    }
    if (range === 'warm') {
        const redMask = Math.max(getHueRangeMask(hue, 12, 34), getHueRangeMask(hue, 358, 24));
        const orangeMask = getHueRangeMask(hue, 34, 32);
        const hueMask = Math.max(redMask, orangeMask);
        const lumaMask = smoothstep(32, 68, lum) * (1 - smoothstep(224, 250, lum));
        const chromaMask = smoothstep(24, 54, chroma);
        const skinShape = r >= g * 0.84 && r >= b * 1.02 && g >= b * 0.72 && lum > 46 && lum < 224;
        const skinLike = skinShape && hue >= 16 && hue <= 55 ? 0.12 : skinShape && hue > 10 ? 0.35 : 1;
        return hueMask * lumaMask * chromaMask * skinLike;
    }
    if (range === 'sky') {
        const hueMask = getHueRangeMask(hue, 210, 38);
        const lumaMask = smoothstep(58, 110, lum) * (1 - smoothstep(238, 255, lum));
        return hueMask * lumaMask;
    }
    if (range === 'foliage') {
        const hueMask = getHueRangeMask(hue, 112, 54);
        const lumaMask = smoothstep(28, 70, lum) * (1 - smoothstep(224, 250, lum));
        return hueMask * lumaMask;
    }
    return 0;
}

function fitRgbToGamut(r, g, b) {
    const avg = (r + g + b) / 3;
    if (avg <= 0 || avg >= 255) {
        return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b) };
    }
    const dr = r - avg;
    const dg = g - avg;
    const db = b - avg;
    const maxDelta = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db), 0.0001);
    const positiveRoom = 255 - avg;
    const negativeRoom = avg;
    const scale = Math.max(0, Math.min(1, positiveRoom / maxDelta, negativeRoom / maxDelta));
    if (scale >= 1) return { r, g, b };
    return {
        r: avg + dr * scale,
        g: avg + dg * scale,
        b: avg + db * scale,
    };
}

function applyAdaptiveSaturation(r, g, b, saturation, safeSmartphone) {
    if (saturation === 100) return { r, g, b };
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;
    const avg = (r + g + b) / 3;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (saturation === 0) return { r: lum, g: lum, b: lum };

    const satDelta = (saturation - 100) / 100;
    const currentSat = maxC > 0 ? chroma / maxC : 0;
    let amount = satDelta;

    if (safeSmartphone && satDelta > 0) {
        const highSatCeiling = 1 - Math.pow(currentSat, 1.35) * 0.82;
        const neutralProtection = smoothstep(5, 36, chroma);
        const highlightProtection = 1 - smoothstep(220, 252, lum) * 0.72;
        const shadowProtection = smoothstep(14, 44, lum);
        const skinProtection = getSkinProtection(r, g, b, lum, chroma);
        amount *= Math.max(0.08, highSatCeiling) * neutralProtection * highlightProtection * shadowProtection * skinProtection;
    }

    let next = {
        r: avg + (r - avg) * (1 + amount),
        g: avg + (g - avg) * (1 + amount),
        b: avg + (b - avg) * (1 + amount),
    };

    if (safeSmartphone && satDelta > 0) {
        next = fitRgbToGamut(next.r, next.g, next.b);
    }

    return next;
}

function applySelectiveSaturation(r, g, b, amount, range, safeSmartphone) {
    if (!amount) return { r, g, b };
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const mask = getSelectiveSaturationMask(range, r, g, b, lum, chroma);
    if (mask <= 0.001) return { r, g, b };

    const avg = (r + g + b) / 3;
    const currentSat = maxC > 0 ? chroma / maxC : 0;
    let scaledAmount = (amount / 100) * mask;

    if (safeSmartphone && scaledAmount > 0) {
        const highSatCeiling = 1 - Math.pow(currentSat, 1.35) * 0.86;
        const highlightProtection = 1 - smoothstep(220, 252, lum) * 0.72;
        const shadowProtection = smoothstep(14, 44, lum);
        scaledAmount *= Math.max(0.06, highSatCeiling) * highlightProtection * shadowProtection;
    }

    let next = {
        r: avg + (r - avg) * (1 + scaledAmount),
        g: avg + (g - avg) * (1 + scaledAmount),
        b: avg + (b - avg) * (1 + scaledAmount),
    };

    if (safeSmartphone && scaledAmount > 0) {
        next = fitRgbToGamut(next.r, next.g, next.b);
    }

    return next;
}

function srgbToLinear(value) {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value) {
    const v = Math.max(0, Math.min(1, value));
    const srgb = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return srgb * 255;
}

export function applyPerceptualIntensityBlend(ctx, w, h, originalCanvas, intensity) {
    if (!originalCanvas || intensity >= 100) return;
    const amount = Math.max(0, Math.min(1, intensity / 100));
    if (amount <= 0) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(originalCanvas, 0, 0);
        return;
    }

    const current = ctx.getImageData(0, 0, w, h);
    const original = originalCanvas.getContext('2d').getImageData(0, 0, w, h);
    const cd = current.data;
    const od = original.data;

    for (let i = 0; i < cd.length; i += 4) {
        cd[i] = linearToSrgb(srgbToLinear(od[i]) * (1 - amount) + srgbToLinear(cd[i]) * amount);
        cd[i + 1] = linearToSrgb(srgbToLinear(od[i + 1]) * (1 - amount) + srgbToLinear(cd[i + 1]) * amount);
        cd[i + 2] = linearToSrgb(srgbToLinear(od[i + 2]) * (1 - amount) + srgbToLinear(cd[i + 2]) * amount);
    }

    ctx.putImageData(current, 0, 0);
}

export function applySafeGlobalTint(ctx, w, h, tintColor, tintIntensity, safeSmartphone = true) {
    if (!tintIntensity || tintIntensity <= 0) return;

    if (!safeSmartphone) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = tintColor;
        ctx.globalAlpha = tintIntensity / 100;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        return;
    }

    const tintRgb = hexToRgb(tintColor || '#ffffff');
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    const baseAmount = Math.max(0, Math.min(0.18, tintIntensity / 100));

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        const colorSignal = smoothstep(10, 58, chroma);
        const neutralProtection = Math.max(0.08, colorSignal);
        const highlightPurity = 1 - smoothstep(218, 252, lum) * 0.9;
        const shadowPurity = smoothstep(14, 44, lum);
        const skinProtection = getSkinProtection(r, g, b, lum, chroma);
        const amount = baseAmount * neutralProtection * highlightPurity * shadowPurity * skinProtection;

        if (amount <= 0.001) continue;

        d[i] = linearToSrgb(srgbToLinear(r) * (1 - amount) + srgbToLinear(tintRgb.r) * amount);
        d[i + 1] = linearToSrgb(srgbToLinear(g) * (1 - amount) + srgbToLinear(tintRgb.g) * amount);
        d[i + 2] = linearToSrgb(srgbToLinear(b) * (1 - amount) + srgbToLinear(tintRgb.b) * amount);
    }

    ctx.putImageData(imageData, 0, 0);
}

export function applySmartphoneOutputGuards(ctx, w, h, filters = {}) {
    const safeFilters = normalizeVisionFilters(filters);
    if (safeFilters.safeSmartphone === false || safeFilters.saturation === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const minC = Math.min(r, g, b);
        const shadowFloor = 5.5 * (1 - smoothstep(18, 56, lum));

        if (shadowFloor > 0 && minC < shadowFloor) {
            const lift = shadowFloor - minC;
            r += lift;
            g += lift;
            b += lift;
        }

        d[i] = clampChannel(r);
        d[i + 1] = clampChannel(g);
        d[i + 2] = clampChannel(b);
    }

    ctx.putImageData(imageData, 0, 0);
}

// ═══════════════════════════════════════════════════════════
//  FUSED PIXEL OPS — Single getImageData/putImageData pass
//  Merges: Curves + Highlights/Shadows + Temperature +
//          Dehaze + Faded Blacks + Split Toning + Vibrance
// ═══════════════════════════════════════════════════════════
export function applyFusedPixelOps(ctx, w, h, filters) {
    const safeFilters = normalizeVisionFilters(filters);
    const hasCustomCurve = (c) => c && (c[0] !== 0 || c[1] !== 64 || c[2] !== 128 || c[3] !== 192 || c[4] !== 255);

    const needsCurves = hasCustomCurve(safeFilters.toneCurveR) || hasCustomCurve(safeFilters.toneCurveG) ||
        hasCustomCurve(safeFilters.toneCurveB) || hasCustomCurve(safeFilters.toneCurveMaster);
    const temp = safeFilters.temperature || 0;
    const faded = safeFilters.fadedBlacks || 0;
    const shTintInt = safeFilters.shadowTintIntensity || 0;
    const hlTintInt = safeFilters.highlightTintIntensity || 0;
    const hl = safeFilters.highlights || 0;
    const sh = safeFilters.shadows || 0;
    const vib = safeFilters.vibrance || 0;
    const skinSat = safeFilters.skinSaturation || 0;
    const warmSat = safeFilters.warmSaturation || 0;
    const skySat = safeFilters.skySaturation || 0;
    const foliageSat = safeFilters.foliageSaturation || 0;
    const dh = safeFilters.dehaze || 0;
    const sat = safeFilters.saturation !== undefined ? safeFilters.saturation : 100;

    if (!needsCurves && temp === 0 && faded === 0 && shTintInt === 0 &&
        hlTintInt === 0 && hl === 0 && sh === 0 && vib === 0 && skinSat === 0 &&
        warmSat === 0 && skySat === 0 && foliageSat === 0 && dh === 0 && sat === 100) return;

    // ── Pre-compute outside the pixel loop ──
    const lutR = buildCurveLUT(safeFilters.toneCurveR);
    const lutG = buildCurveLUT(safeFilters.toneCurveG);
    const lutB = buildCurveLUT(safeFilters.toneCurveB);
    const lutM = buildCurveLUT(safeFilters.toneCurveMaster);
    const tempMul = getTemperatureMultipliers(temp);
    const lift = faded * 2.55;
    const shRgb = hexToRgb(safeFilters.shadowTint || '#000000');
    const hlRgb = hexToRgb(safeFilters.highlightTint || '#ffffff');
    const hlAmt = hl / 100;
    const shAmt = sh / 100;
    const vibAmt = vib / 100;
    const dhAmt = dh / 100;
    const safeSmartphone = safeFilters.safeSmartphone !== false;

    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];

        // 1. Tone Curves
        if (needsCurves) {
            r = lutR[lutM[r]];
            g = lutG[lutM[g]];
            b = lutB[lutM[b]];
        }

        // 2. Highlights / Shadows
        if (hl !== 0 || sh !== 0) {
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const ln = lum / 255;
            if (hl !== 0) {
                const w2 = ln * ln;
                const shift = -hlAmt * 80 * w2;
                r += shift; g += shift; b += shift;
            }
            if (sh !== 0) {
                const w2 = (1 - ln) * (1 - ln);
                const shift = shAmt * 80 * w2;
                r += shift; g += shift; b += shift;
            }
        }

        // 3. Temperature (physical blackbody)
        if (tempMul) {
            const sourceR = r;
            const sourceG = g;
            const sourceB = b;
            const shiftedR = r * tempMul.rMul;
            const shiftedG = g * tempMul.gMul;
            const shiftedB = b * tempMul.bMul;
            if (safeSmartphone) {
                const lum = 0.299 * sourceR + 0.587 * sourceG + 0.114 * sourceB;
                const chroma = Math.max(sourceR, sourceG, sourceB) - Math.min(sourceR, sourceG, sourceB);
                const tempWeight = getSafeTemperatureWeight(lum, chroma);
                r = sourceR + (shiftedR - sourceR) * tempWeight;
                g = sourceG + (shiftedG - sourceG) * tempWeight;
                b = sourceB + (shiftedB - sourceB) * tempWeight;
            } else {
                r = shiftedR;
                g = shiftedG;
                b = shiftedB;
            }
        }

        // 4. Dehaze
        if (dh > 0) {
            const minCh = Math.min(r, g, b);
            const haze = minCh * dhAmt * 0.4;
            r -= haze; g -= haze; b -= haze;
            r += (r - 128) * dhAmt * 0.15;
            g += (g - 128) * dhAmt * 0.15;
            b += (b - 128) * dhAmt * 0.15;
        }

        // 5. Faded Blacks
        if (faded > 0) {
            r = r + (lift - r * lift / 255);
            g = g + (lift - g * lift / 255);
            b = b + (lift - b * lift / 255);
        }

        // 6. Split Toning
        if (shTintInt > 0 || hlTintInt > 0) {
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const chroma = Math.max(r, g, b) - Math.min(r, g, b);
            const neutralMask = safeSmartphone ? smoothstep(8, 42, chroma) : 1;
            const monoMask = sat === 0 ? 0.45 : 1;
            if (shTintInt > 0) {
                const shadowPurity = safeSmartphone ? smoothstep(18, 62, lum) : 1;
                const sw = (1 - lum / 255) * (shTintInt / 100) * 0.5 * Math.max(neutralMask, 0.18 * monoMask) * shadowPurity;
                r += (shRgb.r - r) * sw;
                g += (shRgb.g - g) * sw;
                b += (shRgb.b - b) * sw;
            }
            if (hlTintInt > 0) {
                const highlightPurity = safeSmartphone ? 1 - smoothstep(224, 252, lum) * 0.82 : 1;
                const hw = (lum / 255) * (hlTintInt / 100) * 0.5 * Math.max(neutralMask, 0.16 * monoMask) * highlightPurity;
                r += (hlRgb.r - r) * hw;
                g += (hlRgb.g - g) * hw;
                b += (hlRgb.b - b) * hw;
            }
        }

        // 7. Vibrance (smart saturation — protects already-saturated colors)
        if (vib !== 0) {
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const chroma = maxC - minC;
            const curSat = maxC > 0 ? (maxC - minC) / maxC : 0;
            const avg = (r + g + b) / 3;
            let vs = vibAmt * (1 - curSat) * 0.7;
            if (safeSmartphone && vibAmt > 0) {
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const neutralProtection = smoothstep(6, 34, chroma);
                const highlightProtection = 1 - smoothstep(220, 252, lum) * 0.62;
                const shadowProtection = smoothstep(14, 42, lum);
                const skinProtection = getSkinProtection(r, g, b, lum, chroma);
                vs *= neutralProtection * highlightProtection * shadowProtection * skinProtection;
            }
            r += (r - avg) * vs;
            g += (g - avg) * vs;
            b += (b - avg) * vs;
        }

        if (sat !== 100) {
            const adjusted = applyAdaptiveSaturation(r, g, b, sat, safeSmartphone);
            r = adjusted.r;
            g = adjusted.g;
            b = adjusted.b;
        }

        if (skinSat !== 0 || warmSat !== 0 || skySat !== 0 || foliageSat !== 0) {
            let adjusted = applySelectiveSaturation(r, g, b, skinSat, 'skin', safeSmartphone);
            adjusted = applySelectiveSaturation(adjusted.r, adjusted.g, adjusted.b, warmSat, 'warm', safeSmartphone);
            adjusted = applySelectiveSaturation(adjusted.r, adjusted.g, adjusted.b, skySat, 'sky', safeSmartphone);
            adjusted = applySelectiveSaturation(adjusted.r, adjusted.g, adjusted.b, foliageSat, 'foliage', safeSmartphone);
            r = adjusted.r;
            g = adjusted.g;
            b = adjusted.b;
        }

        if (safeSmartphone) {
            const fitted = fitRgbToGamut(r, g, b);
            r = fitted.r;
            g = fitted.g;
            b = fitted.b;
        }

        d[i] = clampChannel(r);
        d[i + 1] = clampChannel(g);
        d[i + 2] = clampChannel(b);
    }

    ctx.putImageData(imageData, 0, 0);
}

// ═══════════════════════════════════════════════════════════
//  CLARITY — Spatial high-pass mid-frequency boost
// ═══════════════════════════════════════════════════════════
export function applyClarity(ctx, canvas, w, h, clarity) {
    if (!clarity || clarity === 0) return;

    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = w;
    blurCanvas.height = h;
    const blurCtx = blurCanvas.getContext('2d');
    const radius = Math.max(15, Math.min(w, h) * 0.025);
    blurCtx.filter = `blur(${radius}px)`;
    blurCtx.drawImage(canvas, 0, 0);

    const origData = ctx.getImageData(0, 0, w, h);
    const blurData = blurCtx.getImageData(0, 0, w, h);
    const od = origData.data;
    const bd = blurData.data;
    const amount = clarity / 100;

    for (let i = 0; i < od.length; i += 4) {
        od[i] = Math.max(0, Math.min(255, od[i] + (od[i] - bd[i]) * amount));
        od[i + 1] = Math.max(0, Math.min(255, od[i + 1] + (od[i + 1] - bd[i + 1]) * amount));
        od[i + 2] = Math.max(0, Math.min(255, od[i + 2] + (od[i + 2] - bd[i + 2]) * amount));
    }

    ctx.putImageData(origData, 0, 0);
}

// ═══════════════════════════════════════════════════════════
//  SHARPNESS — Unsharp mask (small radius)
// ═══════════════════════════════════════════════════════════
export function applySharpness(ctx, canvas, w, h, sharpness) {
    if (!sharpness || sharpness === 0) return;

    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = w;
    blurCanvas.height = h;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.filter = `blur(1.5px)`;
    blurCtx.drawImage(canvas, 0, 0);

    const origData = ctx.getImageData(0, 0, w, h);
    const blurData = blurCtx.getImageData(0, 0, w, h);
    const od = origData.data;
    const bd = blurData.data;
    const amount = sharpness / 50;

    for (let i = 0; i < od.length; i += 4) {
        od[i] = Math.max(0, Math.min(255, od[i] + (od[i] - bd[i]) * amount));
        od[i + 1] = Math.max(0, Math.min(255, od[i + 1] + (od[i + 1] - bd[i + 1]) * amount));
        od[i + 2] = Math.max(0, Math.min(255, od[i + 2] + (od[i + 2] - bd[i + 2]) * amount));
    }

    ctx.putImageData(origData, 0, 0);
}

// ═══════════════════════════════════════════════════════════
//  HALATION — CineStill signature glow (unchanged from v2)
// ═══════════════════════════════════════════════════════════
export function applyHalation(ctx, w, h, halation, halationColor, safeSmartphone = true) {
    if (!halation || halation === 0) return;
    const haloRgb = hexToRgb(halationColor || '#ff4500');
    const imageData = ctx.getImageData(0, 0, w, h);
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');
    const maskData = maskCtx.createImageData(w, h);
    const threshold = 200;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > threshold) {
            const chroma = Math.max(r, g, b) - Math.min(r, g, b);
            const strength = safeSmartphone
                ? getSafeHalationWeight(lum, chroma)
                : (lum - threshold) / (255 - threshold);
            maskData.data[i] = haloRgb.r;
            maskData.data[i + 1] = haloRgb.g;
            maskData.data[i + 2] = haloRgb.b;
            maskData.data[i + 3] = Math.floor(strength * 255);
        }
    }
    maskCtx.putImageData(maskData, 0, 0);
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = w;
    blurCanvas.height = h;
    const blurCtx = blurCanvas.getContext('2d');
    const blurRadius = Math.max(10, Math.min(w, h) * 0.03) * (halation / 50);
    blurCtx.filter = `blur(${blurRadius}px)`;
    blurCtx.drawImage(maskCanvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, halation / 60);
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.restore();
}
