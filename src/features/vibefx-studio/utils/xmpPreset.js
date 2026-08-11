/*
 * Lecture d'un preset Lightroom / Camera Raw (`.xmp`).
 *
 * Un `.xmp` n'a rien de mysterieux: c'est du XML ou chaque reglage est un
 * attribut `crs:*` avec sa valeur. Ce module le traduit en objet exploitable.
 *
 * Il sert a DEUX choses, et il faut bien les distinguer:
 *
 * 1. Recuperer les reglages SPATIAUX — clarte, texture, nettete, grain,
 *    vignetage, voile. Une Hald CLUT ne peut pas les capturer, puisqu'ils
 *    dependent des pixels voisins ou de la position dans l'image. Ils sont
 *    traduits vers les cles que le pipeline sait deja appliquer.
 *
 * 2. Donner une lecture HUMAINE du preset (« contraste -50, hautes lumieres
 *    -30, bleu decale de -38 deg »), pour comprendre et documenter ce qu'on
 *    importe au lieu d'avoir une table opaque.
 *
 * La couleur, elle, ne vient PAS d'ici: elle vient de la Hald CLUT, qui est
 * exacte. Reimplementer la chaine de traitement d'Adobe a partir de ces
 * valeurs donnerait forcement un resultat different, ne serait-ce que parce
 * qu'elle s'applique a du RAW lineaire et nous a du JPEG deja developpe.
 */

const NUMERIC = /^[-+]?\d*\.?\d+$/;

/* Les valeurs peuvent etre des attributs XML ou des elements enfants selon
   l'outil qui a ecrit le fichier: on accepte les deux formes. */
function readRawValues(xml) {
    const values = {};
    const attribute = /crs:([A-Za-z0-9_]+)\s*=\s*"([^"]*)"/g;
    let match = attribute.exec(xml);
    while (match) {
        values[match[1]] = match[2];
        match = attribute.exec(xml);
    }
    const element = /<crs:([A-Za-z0-9_]+)>([^<]*)<\/crs:\1>/g;
    match = element.exec(xml);
    while (match) {
        if (!(match[1] in values)) values[match[1]] = match[2];
        match = element.exec(xml);
    }
    return values;
}

/* Les courbes sont des <rdf:Seq> de chaines « x, y ». */
function readCurve(xml, name) {
    const block = new RegExp(`<crs:${name}>([\\s\\S]*?)</crs:${name}>`).exec(xml);
    if (!block) return null;
    const points = [];
    const item = /<rdf:li>\s*([-\d.]+)\s*,\s*([-\d.]+)\s*<\/rdf:li>/g;
    let match = item.exec(block[1]);
    while (match) {
        points.push([Number(match[1]), Number(match[2])]);
        match = item.exec(block[1]);
    }
    return points.length ? points : null;
}

const HSL_BANDS = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'];

const number = (values, key, fallback = 0) => {
    const raw = values[key];
    if (raw === undefined || !NUMERIC.test(String(raw).trim())) return fallback;
    return Number(raw);
};

/*
 * Traduit les reglages spatiaux du `.xmp` vers les cles du moteur.
 *
 * Les echelles ne sont pas les memes: Lightroom va de -100 a +100 sur la
 * clarte, notre `clarity` est borne a [-25, 30] par `normalizeVisionFilters`.
 * On convertit proportionnellement puis on laisse le bornage faire son travail
 * — mieux vaut un effet un peu plus doux qu'un rendu casse.
 */
function toSpatialFilters(values) {
    const clarity = number(values, 'Clarity2012');
    const texture = number(values, 'Texture');
    const dehaze = number(values, 'Dehaze');
    const sharpness = number(values, 'Sharpness');
    const grain = number(values, 'GrainAmount');
    const vignette = number(values, 'PostCropVignetteAmount');

    const filters = {};
    /* Clarte et texture agissent toutes deux sur le micro-contraste; le moteur
       n'a qu'un seul reglage, on les combine en ponderant la texture moitie
       moins (elle est plus fine que la clarte). */
    const microContrast = clarity + texture * 0.5;
    if (microContrast) filters.clarity = Math.round(microContrast * 0.3);
    if (dehaze > 0) filters.dehaze = Math.round(dehaze * 0.35);
    if (sharpness) filters.sharpness = Math.round(sharpness * 0.35);
    if (grain) filters.grain = Math.round(grain * 0.42);
    /* Le vignetage Lightroom est signe (negatif = sombre). Le moteur n'assombrit
       que dans un sens: un vignetage clair n'est pas transposable. */
    if (vignette < 0) filters.vignette = Math.round(Math.min(60, -vignette) * 0.5);

    return filters;
}

/* Resume lisible, pour la documentation du preset importe. */
function toSummary(values, curves) {
    const lines = [];
    const push = (label, key, unit = '') => {
        const value = number(values, key, null);
        if (value === null || value === 0) return;
        lines.push(`${label} ${value > 0 ? '+' : ''}${value}${unit}`);
    };

    push('exposition', 'Exposure2012', ' IL');
    push('contraste', 'Contrast2012');
    push('hautes lumières', 'Highlights2012');
    push('ombres', 'Shadows2012');
    push('blancs', 'Whites2012');
    push('noirs', 'Blacks2012');
    push('texture', 'Texture');
    push('clarté', 'Clarity2012');
    push('voile', 'Dehaze');
    push('vibrance', 'Vibrance');
    push('saturation', 'Saturation');

    const hsl = [];
    for (const band of HSL_BANDS) {
        const hue = number(values, `HueAdjustment${band}`);
        const sat = number(values, `SaturationAdjustment${band}`);
        const lum = number(values, `LuminanceAdjustment${band}`);
        if (!hue && !sat && !lum) continue;
        const parts = [];
        if (hue) parts.push(`T${hue > 0 ? '+' : ''}${hue}`);
        if (sat) parts.push(`S${sat > 0 ? '+' : ''}${sat}`);
        if (lum) parts.push(`L${lum > 0 ? '+' : ''}${lum}`);
        hsl.push(`${band.toLowerCase()} ${parts.join('/')}`);
    }
    if (hsl.length) lines.push(`mélangeur — ${hsl.join(', ')}`);

    if (curves.master) lines.push(`courbe maître ${curves.master.length} points`);
    if (curves.red || curves.green || curves.blue) lines.push('courbes RVB par canal');

    return lines;
}

/*
 * Analyse un `.xmp` et renvoie tout ce qu'on sait en tirer.
 * Ne jette pas sur un fichier partiel: un preset Lightroom ne contient QUE les
 * reglages qu'il modifie, l'absence d'une cle est normale.
 */
export function parseXmpPreset(xml, { fallbackName = 'Preset importé' } = {}) {
    if (typeof xml !== 'string' || !xml.includes('crs:')) {
        throw new Error("Ce fichier ne ressemble pas a un preset Camera Raw / Lightroom (aucun attribut `crs:`).");
    }

    const values = readRawValues(xml);
    const nameMatch = /<crs:Name>[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/.exec(xml)
        || /crs:Name\s*=\s*"([^"]+)"/.exec(xml);
    const groupMatch = /<crs:Group>[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/.exec(xml);

    const curves = {
        master: readCurve(xml, 'ToneCurvePV2012'),
        red: readCurve(xml, 'ToneCurvePV2012Red'),
        green: readCurve(xml, 'ToneCurvePV2012Green'),
        blue: readCurve(xml, 'ToneCurvePV2012Blue'),
    };

    const hsl = {};
    for (const band of HSL_BANDS) {
        hsl[band.toLowerCase()] = {
            hue: number(values, `HueAdjustment${band}`),
            saturation: number(values, `SaturationAdjustment${band}`),
            luminance: number(values, `LuminanceAdjustment${band}`),
        };
    }

    return {
        name: (nameMatch?.[1] || fallbackName).trim(),
        group: groupMatch?.[1]?.trim() || null,
        processVersion: values.ProcessVersion || null,
        cameraProfile: values.CameraProfile || null,
        basic: {
            exposure: number(values, 'Exposure2012'),
            contrast: number(values, 'Contrast2012'),
            highlights: number(values, 'Highlights2012'),
            shadows: number(values, 'Shadows2012'),
            whites: number(values, 'Whites2012'),
            blacks: number(values, 'Blacks2012'),
            vibrance: number(values, 'Vibrance'),
            saturation: number(values, 'Saturation'),
        },
        hsl,
        curves,
        colorGrading: {
            shadowHue: number(values, 'SplitToningShadowHue'),
            shadowSaturation: number(values, 'SplitToningShadowSaturation'),
            shadowLuminance: number(values, 'ColorGradeShadowLum'),
            midtoneHue: number(values, 'ColorGradeMidtoneHue'),
            midtoneSaturation: number(values, 'ColorGradeMidtoneSat'),
            midtoneLuminance: number(values, 'ColorGradeMidtoneLum'),
            highlightHue: number(values, 'SplitToningHighlightHue'),
            highlightSaturation: number(values, 'SplitToningHighlightSaturation'),
            highlightLuminance: number(values, 'ColorGradeHighlightLum'),
            balance: number(values, 'SplitToningBalance'),
            blending: number(values, 'ColorGradeBlending', 50),
        },
        /* Ce qui part vers le moteur tel quel. */
        spatialFilters: toSpatialFilters(values),
        /* Ce qu'on affiche a un humain. */
        summary: toSummary(values, curves),
        /* Tout le reste, brut, si on doit y revenir. */
        raw: values,
    };
}
