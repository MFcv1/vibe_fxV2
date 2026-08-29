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
import { normalizeVisionFilters } from './visionColorScience.js';
import {
    GRAIN_ATTENUATION,
    GRAIN_NOISE_SIZE,
    GRAIN_NOISE_TABLE,
    GRAIN_CASSURE_DEFAUT,
    GRAIN_TAILLE_DEFAUT,
    grainPoserDelta,
    grainPourRendu,
    grainValeurEn,
} from './grainField.js';

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

// ═══════════════════════════════════════════════════════════
//  GRAIN — additif, d'amplitude constante, cale sur Lightroom
// ═══════════════════════════════════════════════════════════
/*
 * MESURE DU 2026-08-15, mire A (24 aplats unis de 220x220), Lightroom cloud.
 *
 * Ecart-type du grain de Lightroom, sur la luminance, en /255 :
 *
 *   valeur du curseur |  15   |  50   |  100
 *   ------------------+-------+-------+-------
 *   gris 24           |  5,50 | 16,84 | 28,81   (ecrete par le noir)
 *   gris 72           |  5,53 | 18,40 | 35,92
 *   gris 128          |  5,52 | 18,35 | 36,67
 *   gris 192          |  5,58 | 18,54 | 35,66
 *   gris 224          |  5,51 | 17,62 | 30,67   (ecrete par le blanc)
 *
 * Deux faits, et le second compte plus que le premier :
 *
 * 1. C'EST UNE DROITE. 5,52/15 = 0,368 ; 18,35/50 = 0,367 ; 36,67/100 = 0,367.
 *    Son curseur est proportionnel, sans courbe cachee.
 *
 * 2. C'EST UN PLAT. L'amplitude ne bouge pas du noir au blanc. Les baisses aux
 *    deux extremites ne sont pas un dosage: c'est l'ECRETAGE d'une gaussienne
 *    contre 0 et contre 255 (une gaussienne d'ecart-type s tronquee a sa
 *    moyenne rend ~0,63 s, et on mesure bien 3,48 pour 5,52).
 *
 * Notre ancien etage posait le bruit en fusion `overlay`, qui par construction
 * n'a plus d'effet quand le pixel approche 0 ou 255 : notre grain valait 2,07
 * au ton moyen mais 0,45 dans les ombres et 0,57 dans les hautes lumieres. Une
 * CLOCHE, la ou Lightroom pose un PLAT. Le grain disparaissait donc exactement
 * la ou un grain de film se voit — les ciels et les ombres lisses. Le facteur
 * d'echelle (x2,66 au ton moyen) n'etait que la moitie visible du probleme.
 *
 * D'ou cet etage : un bruit gaussien monochrome ADDITIF, d'ecart-type
 * GRAIN_SIGMA_PAR_UNITE x valeur, ecrete. Monochrome parce que c'est mesure :
 * la correlation entre canaux vaut 1,00 chez Lightroom.
 *
 * CE QUE « MONOCHROME » NE VEUT PAS DIRE : le meme ecart sur les trois canaux
 * de SORTIE. Sur des couleurs saturees, Lightroom en donne davantage, et de
 * facon inegale entre canaux — parce qu'il ajoute son bruit AVANT de revenir en
 * sRVB. Depuis le 2026-08-22 on fait le meme detour (`grainPoserDelta`), et
 * l'ecart tombe de 27 % a 1,8 % au pire sur les 24 aplats de la mire A.
 */
/*
 * La loi du grain — sa force ET sa grosseur — vit dans `grainField.js`, qui
 * n'importe rien et se charge donc aussi bien dans un navigateur que dans Node.
 * C'est ce qui permet aux scripts de mesure d'appeler LE code du rendu au lieu
 * d'en recopier une version qui derive en silence.
 */

/*
 * `taille` est le sous-reglage « Taille » de Lightroom (25 par defaut). Avec le
 * GRAND COTE de l'IMAGE FINALE (`grandCoteImage`), il donne la grosseur des grains —
 * et cette grosseur pilote a son tour l'ecart-type, parce qu'un grain deux fois
 * plus gros bruite deux fois moins chaque pixel. Le detail des mesures, et la
 * raison pour laquelle un apercu doit montrer MOINS de grain qu'un export, sont
 * dans `grainField.js`.
 */
/* Un seul tampon de sortie, reutilise a chaque pixel: pas d'allocation dans
   une boucle qui tourne des dizaines de millions de fois. */
const PIXEL = new Float64Array(3);

export function applyFilmGrain(ctx, w, h, grain, taille = GRAIN_TAILLE_DEFAUT,
    grandCoteImage = Math.max(w, h), grandCoteRendu = Math.max(w, h), cassure = GRAIN_CASSURE_DEFAUT) {
    if (!grain || grain <= 0) return;
    /* `grandCoteImage` est le GRAND COTE de l'image FINALE — pas sa largeur:
       une mire exportee en portrait rend le meme grain qu'en paysage, c'est
       mesure (voir `studioRenderer.js`). `grandCoteRendu` est celui auquel on
       la dessine (zoom compris). Un apercu « Adapter » montre donc
       le grain moyenne par la reduction, un zoom 100 % le montre entier —
       exactement comme l'ecran de Lightroom. Voir `grainPourRendu`. */
    const { echelle, sigma } = grainPourRendu(grain, taille, grandCoteImage, grandCoteRendu, cassure);
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    /* Sous le pixel il n'y a rien a interpoler: on garde le chemin direct, qui
       est aussi le plus rapide, et qui reste celui des rendus a la taille de
       reference. */
    const grainsFins = echelle <= 1;
    for (let y = 0; y < h; y += 1) {
        const ligne = (y % GRAIN_NOISE_SIZE) * GRAIN_NOISE_SIZE;
        for (let x = 0; x < w; x += 1) {
            const i = (y * w + x) * 4;
            // Attenuation lue sur la luminance, pour que le grain s'eteigne
            // dans un noir bouche ou un blanc brule comme il le fait chez lui.
            const luma = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
            const bruit = grainsFins
                ? GRAIN_NOISE_TABLE[ligne + (x % GRAIN_NOISE_SIZE)]
                : grainValeurEn(x, y, echelle, cassure);
            /* Le meme ecart sur les trois canaux — le grain est monochrome,
               c'est mesure — mais pose DANS SON ESPACE DE TRAVAIL, pas en
               sRVB. C'est le detour qui rend le grain plus fort sur les
               couleurs saturees, exactement comme chez lui, sans toucher aux
               gris. Voir `grainField.js`, section « l'espace ou il pose son
               grain ». */
            const delta = bruit * sigma * GRAIN_ATTENUATION[luma];
            grainPoserDelta(d[i], d[i + 1], d[i + 2], delta, PIXEL);
            d[i] = PIXEL[0];
            d[i + 1] = PIXEL[1];
            d[i + 2] = PIXEL[2];
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

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

/*
 * RAMENER UNE COULEUR DANS LE CUBE RVB SANS L'ECRETER.
 *
 * Ce que ca doit faire: quand un etage a pousse un canal au-dela de 0 ou 255,
 * reduire la CHROMA jusqu'a ce que tout rentre, plutot que de couper le canal
 * qui deborde — un ecretage par canal fait virer la teinte (un rouge qui sature
 * part vers l'orange).
 *
 * LE BUG CORRIGE LE 2026-08-17, et il ne se voyait pas dans les moyennes.
 *
 * L'ancienne version comparait la place disponible a `maxDelta`, le plus grand
 * ecart EN VALEUR ABSOLUE, et elle exigeait que cet ecart tienne des DEUX cotes
 * a la fois. Une couleur parfaitement valide pouvait donc etre desaturee sans
 * qu'aucun canal ne deborde. Exemple mesure, un neon jaune #fff05a:
 *
 *   avg = 195 · dr = +60 · dg = +45 · db = -105
 *   ancienne regle : min(60/105, 195/105) = 0,57  ->  R passe de 255 a 229
 *   la verite      : R a besoin de 60 de marge et en a 60; B descend de 105 et
 *                    en a 195. Rien ne deborde: il ne fallait RIEN faire.
 *
 * Consequence a l'ecran, et c'est la qu'elle etait vicieuse: cet etage ne
 * tourne que si un reglage de couleur n'est pas au repos (`applyFusedPixelOps`
 * sort avant, sinon). Mettre « Ciel » a 1 — un geste que personne ne considere
 * comme un reglage — deplacait donc 2,6 % de l'image, jusqu'a 45/255 sur les
 * couleurs vives, sans aucun rapport avec le ciel. L'image SAUTAIT au premier
 * cran, puis ne bougeait presque plus.
 *
 * La regle juste est par canal: chacun n'a besoin que de SA marge, du cote ou
 * il va. On garde `avg` comme pivot (c'est lui qui definit ce que « reduire la
 * chroma » veut dire ici) et on ne touche a rien tant que tout tient.
 */
function fitRgbToGamut(r, g, b) {
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
        return { r, g, b };
    }
    const avg = (r + g + b) / 3;
    /* Le pivot lui-meme est hors du cube: aucune reduction de chroma ne peut
       sauver la couleur, seule la coupe reste. */
    if (avg <= 0 || avg >= 255) {
        return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b) };
    }
    const dr = r - avg;
    const dg = g - avg;
    const db = b - avg;
    /* Pour un canal donne: s'il monte, il lui faut (255 - avg) de marge; s'il
       descend, avg. Le facteur retenu est le plus contraignant des trois. */
    const marge = (delta) => {
        if (delta > 0) return (255 - avg) / delta;
        if (delta < 0) return avg / -delta;
        return 1;
    };
    const scale = Math.max(0, Math.min(1, marge(dr), marge(dg), marge(db)));
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
//  VIGNETAGE — multiplicatif EN LUMIERE LINEAIRE, cale sur Lightroom
// ═══════════════════════════════════════════════════════════
/*
 * MESURE DU 2026-08-16, mire B (3 bandes unies plein cadre: 64, 128, 192).
 *
 * Trois bandes et pas un gris unique, pour trancher la question qui change tout
 * dans le code: le vignetage MULTIPLIE-t-il la valeur du pixel, ou SOUSTRAIT-il
 * une constante ? Reponse: il multiplie — mais pas la ou nous le faisions.
 *
 * A rayon egal, sous Vignette -100 :
 *
 *   bande |  ratio en sRVB  |  ratio en LINEAIRE
 *   ------+-----------------+--------------------
 *     64  |      0,291      |       0,123
 *    128  |      0,351      |       0,121
 *    192  |      0,430      |       0,162
 *
 * En sRVB les trois bandes donnent trois reponses differentes: ce n'est donc
 * pas la que la multiplication a lieu. En lumiere LINEAIRE elles se rejoignent.
 * C'est physique — un vignetage, c'est de la lumiere qui manque, et la lumiere
 * s'additionne en lineaire, pas dans l'encodage d'affichage.
 *
 * Notre ancien etage multipliait en sRVB, avec un degrade radial de 0,3 a 0,85
 * de la LARGEUR: assombrissement trop faible sur les bandes claires, trop fort
 * sur les sombres, et une forme circulaire sur une image rectangulaire.
 *
 * LA COORDONNEE. Le rayon est ELLIPTIQUE, normalise par la demi-largeur et la
 * demi-hauteur: r = sqrt((dx/(w/2))^2 + (dy/(h/2))^2). Le bord vaut donc 1 au
 * milieu des cotes et sqrt(2) dans les coins. C'est ce qui fait qu'un vignetage
 * suit le cadre au lieu de dessiner un cercle dans un rectangle.
 *
 * RESERVE: la bande 192 reste ~30 % au-dessus des deux autres. Le modele
 * multiplicatif lineaire n'est donc pas toute l'histoire dans les hautes
 * lumieres — Lightroom expose d'ailleurs un curseur « Hautes lumieres » qui
 * etait a 0 ici. Non reproduit.
 */

/* Gain a Vignette -100, mesure, de r = 0 a r = 1,45 par pas de 0,05. */
const VIGNETTE_GAIN_100 = [
    1.0000, 1.0000, 1.0000, 0.9999, 0.9993, 0.9981,
    0.9952, 0.9900, 0.9813, 0.9670, 0.9452, 0.9134,
    0.8697, 0.8123, 0.7405, 0.6545, 0.5562, 0.4483,
    0.3358, 0.2287, 0.1415, 0.0813, 0.0451, 0.0246,
    0.0141, 0.0090, 0.0063, 0.0047, 0.0037, 0.0037,
];
const VIGNETTE_PAS = 0.05;

/*
 * Le dosage n'est PAS proportionnel: il agit comme un EXPOSANT sur ce gain.
 * Mesure du rapport ln(gain a -50) / ln(gain a -100) entre r = 0,6 et r = 1,0 :
 * 0,586 · 0,581 · 0,576 · 0,573 · 0,572 · 0,569 · 0,565 — constant a 0,57.
 * L'exposant 0,81 ci-dessous passe exactement par ce point (0,5^0,81 = 0,570)
 * et par 1 a fond. Deux valeurs de curseur seulement ont ete exportees: la
 * courbe ENTRE les deux est une interpolation, pas une mesure.
 */
const VIGNETTE_DOSAGE_EXPOSANT = 0.81;

const SRGB_VERS_LINEAIRE = (() => {
    const table = new Float32Array(256);
    for (let v = 0; v < 256; v += 1) {
        const c = v / 255;
        table[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }
    return table;
})();

/*
 * Repasser en sRVB demande une puissance par canal et par pixel — trop cher en
 * plein ecran. On precalcule donc une table par PALIER de gain: 128 paliers
 * x 256 valeurs. L'erreur de quantification du gain est inferieure au 1/255
 * d'un pixel, et le cout tombe a une simple lecture.
 */
/*
 * LA PROTECTION DES HAUTES LUMIERES, elle aussi mesuree.
 *
 * Un gain purement multiplicatif laissait un ecart de 11,7/255 sur la bande
 * CLAIRE (192), contre 0,7 sur la bande moyenne et 2,2 sur la sombre: Lightroom
 * assombrit MOINS ce qui est deja clair. Ce n'est pas son curseur « Hautes
 * lumieres » — il etait a 0.
 *
 * Mesure du supplement de gain sur la bande 192, a trois rayons:
 *
 *   gain nominal g | 0,857 | 0,526 | 0,121
 *   supplement w   | 0,357 | 0,234 | 0,047
 *
 * w suit g: w = 0,42 x g reproduit les trois points (0,360 · 0,221 · 0,051).
 * Le gain effectif devient donc g x (1 + 0,42 x (1 - g) x L), ou L pese le
 * niveau du pixel: 0 jusqu'au ton moyen, 1 a partir du clair.
 *
 * RESERVE: une seule bande claire contraint ce terme. Sa progression entre le
 * ton moyen et le clair est une droite choisie, pas une mesure, et il est
 * plafonne au-dela faute de point.
 */
const VIGNETTE_HL_FORCE = 0.42;
const VIGNETTE_HL_DEBUT = 0.216; // lumiere lineaire du gris 128
const VIGNETTE_HL_FIN = 0.502; // lumiere lineaire du gris 192

const VIGNETTE_PALIERS = 128;
const VIGNETTE_LUT = (() => {
    const luts = [];
    for (let p = 0; p <= VIGNETTE_PALIERS; p += 1) {
        const gain = p / VIGNETTE_PALIERS;
        const lut = new Uint8Array(256);
        for (let v = 0; v < 256; v += 1) {
            const source = SRGB_VERS_LINEAIRE[v];
            const poidsHL = Math.max(0, Math.min(1,
                (source - VIGNETTE_HL_DEBUT) / (VIGNETTE_HL_FIN - VIGNETTE_HL_DEBUT)));
            const effectif = gain * (1 + VIGNETTE_HL_FORCE * (1 - gain) * poidsHL);
            const lin = source * effectif;
            const srgb = lin <= 0.0031308 ? lin * 12.92 : 1.055 * lin ** (1 / 2.4) - 0.055;
            lut[v] = Math.max(0, Math.min(255, Math.round(srgb * 255)));
        }
        luts.push(lut);
    }
    return luts;
})();

function gainVignette(r, dosage) {
    const position = r / VIGNETTE_PAS;
    const index = Math.floor(position);
    let base;
    if (index >= VIGNETTE_GAIN_100.length - 1) {
        base = VIGNETTE_GAIN_100[VIGNETTE_GAIN_100.length - 1];
    } else {
        const t = position - index;
        base = VIGNETTE_GAIN_100[index] * (1 - t) + VIGNETTE_GAIN_100[index + 1] * t;
    }
    return base ** dosage;
}

export function applyLightroomVignette(ctx, w, h, vignette) {
    if (!vignette || vignette <= 0) return;
    const dosage = (Math.min(100, vignette) / 100) ** VIGNETTE_DOSAGE_EXPOSANT;
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const demiW = w / 2;
    const demiH = h / 2;

    for (let y = 0; y < h; y += 1) {
        const dy = (y - cy) / demiH;
        const dy2 = dy * dy;
        for (let x = 0; x < w; x += 1) {
            const dx = (x - cx) / demiW;
            const r = Math.sqrt(dx * dx + dy2);
            const palier = Math.round(gainVignette(r, dosage) * VIGNETTE_PALIERS);
            const lut = VIGNETTE_LUT[palier];
            const i = (y * w + x) * 4;
            d[i] = lut[d[i]];
            d[i + 1] = lut[d[i + 1]];
            d[i + 2] = lut[d[i + 2]];
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

// ═══════════════════════════════════════════════════════════
//  DEGRADE DU BAS — l'assombrissement progressif du premier plan
// ═══════════════════════════════════════════════════════════
/*
 * POURQUOI CET EFFET EXISTE, et pourquoi ce n'est pas un vignetage.
 *
 * Mesure du 2026-08-29 sur la paire avant/apres de nuit de `@powl_d`. Une fois
 * la couleur et la courbe calees au plus pres (`powV5`), ce qui reste n'est pas
 * une erreur de couleur: c'est un DEGRADE VERTICAL. Ecart en diaphragmes entre
 * son rendu et le notre, du haut vers le bas du cadre:
 *
 *      +0,05   <- le plafond de la station: parfait
 *      +1,0    <- la station et la moto: il est plus CLAIR
 *      -1,1
 *      -2,5    <- le sol: il est BIEN plus sombre
 *
 * Notre vignetage ne peut pas repondre a ca: il est RADIAL, donc il
 * assombrirait aussi le haut, qui est deja juste. Mesure a l'appui — sur cette
 * photo, `powV5` seul fait 5,41 de dE76, et `powV5` plus vignetage fait 5,46 a
 * 5,99 quelle que soit la dose. Le vignetage EMPIRE le rendu.
 *
 * Le degrade, lui, le fait passer de 5,41 a 3,03.
 *
 * FORME. Un seul curseur, comme le vignetage. La rampe part du MILIEU du cadre
 * et descend jusqu'en bas, en smoothstep. Le point de depart a ete cherche: de
 * 0,40 a 0,60 de la hauteur, l'ecart obtenu va de 3,10 a 3,03 — la courbe est
 * plate, donc le milieu est aussi bon que le meilleur et ne coute rien. Un
 * parametre de moins.
 *
 * ECHELLE. 100 = quatre diaphragmes au bas du cadre. Le reglage mesure sur sa
 * photo vaut 66.
 *
 * La multiplication a lieu en lumiere LINEAIRE, comme le vignetage depuis le
 * 2026-08-16, et SANS la protection des hautes lumieres que celui-ci porte: un
 * degrade de Lightroom est un curseur d'exposition pose sur un masque, pas un
 * vignetage, et il n'epargne rien.
 */
const DEGRADE_DIAPHRAGMES = 4;

export function applyDegradeBas(ctx, w, h, force) {
    if (!force || force <= 0) return;
    const bas = 2 ** (-DEGRADE_DIAPHRAGMES * Math.min(100, force) / 100);
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    /*
     * UNE TABLE PAR LIGNE, et pas par palier de gain.
     *
     * La premiere version quantifiait le gain en 64 paliers, comme le fait le
     * vignetage. Mesure: 4/255 d'ecart entre deux lignes voisines sur un aplat,
     * et ce chiffre NE BAISSAIT PAS quand l'image grandissait (4/255 a 101
     * lignes comme a 1 200) — donc ce n'etait pas la pente du degrade, c'etait
     * la marche de la quantification. Une bande, exactement ce que le projet
     * refuse partout ailleurs.
     *
     * Ici le gain ne depend que de la LIGNE: il y en a donc au plus h valeurs
     * distinctes, et la moitie superieure du cadre n'en a qu'une (1, qu'on
     * saute). Calculer la table de la ligne coute 256 puissances et supprime la
     * quantification au lieu de la reduire.
     */
    const lut = new Uint8Array(256);
    for (let y = 0; y < h; y += 1) {
        const t = Math.max(0, Math.min(1, (y / Math.max(1, h - 1) - 0.5) / 0.5));
        if (t <= 0) continue;
        const gain = 1 + (bas - 1) * (t * t * (3 - 2 * t));
        for (let v = 0; v < 256; v += 1) {
            const lin = SRGB_VERS_LINEAIRE[v] * gain;
            const srgb = lin <= 0.0031308 ? lin * 12.92 : 1.055 * lin ** (1 / 2.4) - 0.055;
            lut[v] = Math.max(0, Math.min(255, Math.round(srgb * 255)));
        }
        for (let x = 0; x < w; x += 1) {
            const i = (y * w + x) * 4;
            d[i] = lut[d[i]];
            d[i + 1] = lut[d[i + 1]];
            d[i + 2] = lut[d[i + 2]];
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

// ═══════════════════════════════════════════════════════════
//  CLARITY — Spatial high-pass mid-frequency boost
// ═══════════════════════════════════════════════════════════
/*
 * LE RAYON DE LA CLARTE, mesure le 2026-08-16 sur la mire C.
 *
 * Notre DOSAGE etait deja juste — sur les reseaux sinusoidaux, Clarte 50 donne
 * 1,49 a 1,54 chez Lightroom et 1,50 chez nous; Clarte 100 donne 1,91 a 2,00
 * chez lui et 2,00 chez nous. Rien a recalibrer de ce cote.
 *
 * C'est le RAYON qui etait faux. Sur le bord doux etale sur 120 px — la seule
 * zone de la mire qui teste les GRANDES structures, celles que la clarte est
 * censee creuser — Lightroom amplifie x1,79 et nous ne faisions x1,03. Rien.
 * Avec un rayon de 2,5 % du petit cote (27 px a 1080), un bord de 120 px passe
 * entierement dans le flou: il n'y a plus de difference a amplifier.
 *
 *   rayon | bord doux | ecart moyen aux 6 zones
 *    27   |   1,03    |  0,213
 *    50   |   1,10    |  0,182
 *    80   |   1,22    |  0,155
 *   120   |   1,40    |  0,125
 *
 * 11 % du petit cote (119 px a 1080) est retenu. La cible de 1,79 n'est pas
 * atteinte, et il faut dire pourquoi plutot que de monter le rayon jusqu'a
 * l'atteindre: au-dela, le flou deborde sur les zones VOISINES de la mire, et
 * la mesure se met a lire ses propres bords. C'est un defaut de la mire, pas du
 * moteur — une prochaine version isolerait le bord doux sur une image entiere.
 */
const CLARITY_RAYON_RELATIF = 0.11;

/*
 * LE COTE NEGATIF DE LA CLARTE, mesure le 2026-08-19 — et il etait FAUX.
 *
 * La clarte n'avait ete calee qu'au POSITIF (2026-08-16). Le negatif, lui,
 * gardait le dosage lineaire d'origine (`amount = clarty / 100`), ce qui donne
 * a -100 exactement l'image floue: `pixel + (pixel - flou) x (-1) = flou`.
 * Notre curseur ne dosait pas un adoucissement, il effacait le detail.
 *
 *   curseur | amplification du detail, Lightroom | nous, AVANT
 *     -25   |         ~0,83 (interpole)          |    0,750
 *     -50   |   0,695 / 0,699 / 0,723 (8/24/64)  |    0,502
 *    -100   |   0,476 / 0,485 / 0,526            |    0,012
 *
 * Le sien SATURE, comme sa texture negative et comme sa nettete. En resolvant
 * le gain necessaire a partir de chaque reseau, on lit -0,305 / -0,301 / -0,277
 * a -50 et -0,524 / -0,515 / -0,474 a -100: la moyenne des trois donne une loi
 * de puissance propre, `0,01409 x N^0,777`.
 *
 * L'ECART ENTRE ECHELLES EST PLUS GRAND QUE POUR LA TEXTURE, et il faut le
 * dire: 5 % entre le 8 px et le 64 px (la texture negative tenait dans 0,5 %).
 * Son adoucissement mord un peu moins sur le tres large, alors que notre masque
 * flou a un seul rayon est PLAT au-dessus de son rayon. On cale donc sur la
 * moyenne des trois: +1,5 % sur le fin, -1,5 % sur le large. Corriger ce
 * residu-la demanderait un second rayon, comme la texture en a un — ce qui
 * remettrait en cause le positif, lui deja valide a 1 %.
 *
 * Le POSITIF n'est pas touche: il est mesure a 1,49-1,54 chez lui contre 1,50
 * chez nous, et son dosage lineaire n'a pas de raison de bouger.
 */
const CLARITY_K_NEG = 0.014088;
const CLARITY_EXPOSANT_NEG = 0.7769;

export function applyClarity(ctx, canvas, w, h, clarity) {
    if (!clarity || clarity === 0) return;

    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = w;
    blurCanvas.height = h;
    const blurCtx = blurCanvas.getContext('2d');
    const radius = Math.max(24, Math.min(w, h) * CLARITY_RAYON_RELATIF);
    blurCtx.filter = `blur(${radius}px)`;
    blurCtx.drawImage(canvas, 0, 0);

    const origData = ctx.getImageData(0, 0, w, h);
    const blurData = blurCtx.getImageData(0, 0, w, h);
    const od = origData.data;
    const bd = blurData.data;
    /* Positif: dosage lineaire, valide sur mire le 2026-08-16. Negatif: loi de
       puissance mesuree le 2026-08-19 (voir ci-dessus). */
    const amount = clarity > 0
        ? clarity / 100
        : -CLARITY_K_NEG * (-clarity) ** CLARITY_EXPOSANT_NEG;

    for (let i = 0; i < od.length; i += 4) {
        od[i] = Math.max(0, Math.min(255, od[i] + (od[i] - bd[i]) * amount));
        od[i + 1] = Math.max(0, Math.min(255, od[i + 1] + (od[i + 1] - bd[i + 1]) * amount));
        od[i + 2] = Math.max(0, Math.min(255, od[i + 2] + (od[i + 2] - bd[i + 2]) * amount));
    }

    ctx.putImageData(origData, 0, 0);
}

// ═══════════════════════════════════════════════════════════
//  TEXTURE — le micro-contraste de Lightroom
// ═══════════════════════════════════════════════════════════
/*
 * LA TEXTURE, calee le 2026-08-16 sur la mire C. Le reglage n'existait pas dans
 * le moteur: un preset qui en portait rendait moins de matiere que chez lui,
 * sans que rien ne le signale.
 *
 * CE QUE LA MESURE DIT. Amplification lue sur les trois reseaux sinusoidaux —
 * chacun ne contient qu'une seule echelle, donc chaque ligne est propre :
 *
 *   curseur | 8 px  | 24 px | 64 px | bord doux 120 px
 *     +50   | 1,175 | 1,120 | 1,096 |      1,174
 *    +100   | 1,272 | 1,187 | 1,150 |      1,272
 *
 * Deux choses s'y lisent, et aucune n'est un simple facteur:
 *
 * 1. LA FORME NE BOUGE PAS ENTRE 50 ET 100. Le rapport entre 8 px et 64 px vaut
 *    1,82 des deux cotes. C'est donc le meme filtre, plus ou moins dose.
 *
 * 2. CE N'EST PAS UN MASQUE FLOU A UN SEUL RAYON. Un unsharp mask classique
 *    laisserait passer 8 px et 24 px presque a l'identique, puis s'effondrerait.
 *    Ici l'exces d'amplification decroit LENTEMENT (0,175 -> 0,120 -> 0,096),
 *    en gros comme P^-0,34: le signe d'un effet multi-echelle. D'ou DEUX passes,
 *    une fine et une large, a gain egal — ce couple reproduit les six mesures a
 *    mieux que 5 %.
 *
 * 3. SON DOSAGE SATURE, comme celui de la nettete: doubler le curseur ne double
 *    pas l'effet (x1,56 seulement de 50 a 100), soit une loi en N^0,644.
 *
 * CE QUE LE MOTEUR DONNE APRES CALAGE, mesure par les memes scripts
 * (`rendu-mire-c.mjs` puis `mesure-mire-c.mjs`) :
 *
 *   curseur |  8 px         | 24 px         | 64 px
 *     50    | 1,176 / 1,175 | 1,120 / 1,120 | 1,096 / 1,096
 *    100    | 1,283 / 1,272 | 1,183 / 1,187 | 1,146 / 1,150
 *                                    (nous / Lightroom)
 *
 * RESIDU ASSUME, et il faut le dire: sur le bord doux etale sur 120 px, la
 * seule zone qui teste les tres grandes structures, il raidit x1,03 a 50 et
 * nous x1,07. On accentue donc un peu plus que lui ce qui est tres large —
 * l'echelle ou la texture n'est justement pas censee travailler. C'est le prix
 * du second rayon, celui qui permet de tenir les 64 px.
 *
 * Les rayons sont en PIXELS, pas en pourcentage du cadre: la texture de
 * Lightroom travaille a une echelle fixe, et c'est a 1620x1080 qu'on l'a
 * mesuree. (La clarte, elle, est en pourcentage — voir `applyClarity`. La
 * difference est mesuree, pas choisie.)
 *
 * LE NEGATIF, mesure le 2026-08-17 (les exports manquaient jusque-la: les
 * fichiers fournis etaient le positif exporte deux fois). Amplification lue par
 * les memes trois reseaux:
 *
 *   curseur | 8 px  | 24 px | 64 px
 *     -50   | 0,851 | 0,899 | 0,919
 *    -100   | 0,752 | 0,832 | 0,866
 *
 * ON CRAIGNAIT UNE AUTRE LOI, C'EST LE MEME FILTRE. La crainte etait legitime —
 * un adoucissement n'a aucune raison d'etre la symetrie d'un renforcement. Mais
 * en resolvant le gain a partir de CHACUN des trois reseaux, avec les deux
 * rayons deja en place, on retombe trois fois sur le meme nombre:
 *
 *   a(-50)  = -0,0765 | -0,0760 | -0,0762   (8 / 24 / 64 px)
 *   a(-100) = -0,1272 | -0,1264 | -0,1261
 *
 * Trois echelles, 0,5 % d'ecart entre elles: la signature spatiale ne change
 * pas de signe. Le couple 3 px / 40 px vaut donc pour les deux cotes, et seul
 * le DOSAGE differe.
 *
 * ET IL DIFFERE VRAIMENT, on ne pouvait pas le deviner. A curseur egal, le
 * negatif est plus FAIBLE que le positif (x0,84 a 50) mais il RATTRAPE en
 * montant (x0,90 a 100): sa saturation est moins forte, N^0,733 contre N^0,644.
 * Reprendre le dosage positif au signe pres aurait sur-adouci de 18 % a -50.
 *
 * Ce que le moteur donne, une fois cale, MESURE et non predit
 * (`rendu-mire-c.mjs` puis `mesure-mire-c.mjs`) — nous / Lightroom:
 *
 *   -50  | 0,849 / 0,851 | 0,905 / 0,899 | 0,918 / 0,919
 *  -100  | 0,742 / 0,752 | 0,836 / 0,832 | 0,867 / 0,866
 *
 * Ecart maximal 1,3 % (8 px a -100), du meme ordre que le 0,9 % deja assume au
 * positif. Les trois echelles suivent, ce qui confirme le couple de rayons.
 *
 * DEUX RESIDUS, et le second est plus gros qu'on ne le croyait.
 *
 * 1. Le bord doux de 120 px, deja connu: Lightroom n'y adoucit quasiment pas
 *    (0,995 a -50) la ou nous ne bougeons pas non plus (1,000). Cote negatif ce
 *    residu est donc benin — c'est au positif qu'il coute (x1,07 contre x1,03).
 *
 * 2. LES CONTOURS FRANCS, et celui-la n'avait jamais ete releve. Lightroom
 *    laisse les barres a fort contraste intactes des deux cotes (1,006 a +50,
 *    0,995 a -50, 0,991 a -100) alors qu'il travaille franchement les barres a
 *    faible contraste (1,146 / 0,881 / 0,804). Sa texture est donc EDGE-AWARE:
 *    elle lisse la matiere sans raboter les aretes. La notre ne l'est pas, et
 *    traite les deux pareil:
 *
 *      barres fort contraste | +50: 1,095 (lui 1,006) | -50: 0,916 (lui 0,995)
 *
 *    Ce n'est PAS une regression du negatif: le meme ecart existe au positif
 *    depuis le premier calage, il n'avait simplement pas ete mesure sur cette
 *    zone. Consequence concrete: sur une arete tres marquee — un toit sur le
 *    ciel, un poteau — notre texture positive laisse un halo qu'il n'a pas, et
 *    notre texture negative ramollit un contour qu'il garde net. C'est le
 *    prochain vrai chantier de la texture, et il demande un masque de contours,
 *    pas un coefficient.
 */
const TEXTURE_SIGMA_FIN = 3;
const TEXTURE_SIGMA_LARGE = 40;
const TEXTURE_K = 0.00727;
const TEXTURE_EXPOSANT = 0.644;
/* Cote negatif: meme couple de rayons, dosage propre (mesure du 2026-08-17). */
const TEXTURE_K_NEG = 0.004339;
const TEXTURE_EXPOSANT_NEG = 0.7325;

export function applyTexture(ctx, canvas, w, h, texture) {
    if (!texture) return;

    const amount = texture > 0
        ? TEXTURE_K * texture ** TEXTURE_EXPOSANT
        : -TEXTURE_K_NEG * (-texture) ** TEXTURE_EXPOSANT_NEG;

    /*
     * Les deux flous sont calcules AVANT d'ecrire quoi que ce soit, et les deux
     * ecarts se prennent sur l'image d'ORIGINE. Enchainer les passes ferait
     * passer la seconde sur une image deja accentuee: l'amplification lue ne
     * serait plus celle qu'on a ajustee sur la mire.
     */
    const flou = (sigma) => {
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = w;
        blurCanvas.height = h;
        const blurCtx = blurCanvas.getContext('2d');
        blurCtx.filter = `blur(${sigma}px)`;
        blurCtx.drawImage(canvas, 0, 0);
        return blurCtx.getImageData(0, 0, w, h).data;
    };
    const fin = flou(TEXTURE_SIGMA_FIN);
    const large = flou(TEXTURE_SIGMA_LARGE);

    const origData = ctx.getImageData(0, 0, w, h);
    const od = origData.data;
    for (let i = 0; i < od.length; i += 4) {
        for (let c = 0; c < 3; c += 1) {
            const v = od[i + c];
            const exces = (v - fin[i + c]) * amount + (v - large[i + c]) * amount;
            od[i + c] = Math.max(0, Math.min(255, v + exces));
        }
    }

    ctx.putImageData(origData, 0, 0);
}

// ═══════════════════════════════════════════════════════════
//  SHARPNESS — Unsharp mask (small radius)
// ═══════════════════════════════════════════════════════════
/*
 * LE DOSAGE DE LA NETTETE, cale le 2026-08-16 sur la mire C.
 *
 * L'echelle est celle de Lightroom: 0 a 150, et 40 est ce qu'il pose PAR DEFAUT
 * sur tout preset. Amplification mesuree sur le reseau sinusoidal de periode
 * 8 px, la ou la nettete travaille:
 *
 *   curseur | Lightroom | nous, avant (dosage = N / 50)
 *      40   |   1,22    |  1,29
 *     150   |   1,63    |  2,13
 *
 * Notre reponse etait donc trop forte, et de plus en plus a mesure qu'on monte:
 * un dosage lineaire ne colle pas, le sien SATURE. D'ou la loi en puissance
 * ci-dessous, qui passe par les deux points mesures (0,607 a 40, 1,672 a 150).
 * Entre les deux, c'est une interpolation, pas une mesure.
 *
 * Le rayon, lui, etait bon: la selectivite en frequence se superpose a la
 * sienne (1,12 contre 1,15 a 24 px, 1,02 contre 1,01 a 64 px).
 */
const SHARPNESS_K = 0.035;
const SHARPNESS_EXPOSANT = 0.766;

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
    const amount = SHARPNESS_K * sharpness ** SHARPNESS_EXPOSANT;

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
