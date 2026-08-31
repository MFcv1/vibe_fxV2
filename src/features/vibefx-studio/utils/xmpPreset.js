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
 * PLUS AUCUNE CONVERSION depuis le 2026-08-16, et c'est le changement important
 * de cette fonction. Nos echelles SONT celles de Lightroom, mesure a l'appui
 * (`docs/lightroom/4-synchro-effets.md`): grain, vignetage, clarte, nettete et
 * texture veulent dire la meme chose des deux cotes. Le nombre du `.xmp` se
 * recopie donc tel quel.
 *
 * Ce qui etait fait avant — clarte x0,3, nettete x0,35, grain x0,42, vignetage
 * x0,5 — datait d'un moteur dont les echelles n'avaient rien a voir avec les
 * siennes. Garder ces facteurs aujourd'hui rendrait chaque preset importe par
 * `.xmp` trois fois trop doux, sans que rien ne le signale.
 *
 * Le bornage reste le garde-fou: `normalizeVisionFilters` ramene ce qui sort de
 * la plage sure, et c'est lui qui decide, pas cette fonction.
 */
function toSpatialFilters(values) {
    const filters = {};
    const copier = (cle, xmpKey) => {
        const valeur = number(values, xmpKey);
        if (valeur) filters[cle] = valeur;
    };
    /* Taille et cassure ont des valeurs neutres non nulles (25 et 50). Leur
       valeur 0 est donc un vrai reglage, pas une absence de reglage. */
    const copierMemeZero = (cle, xmpKey) => {
        if (!(xmpKey in values)) return;
        filters[cle] = number(values, xmpKey);
    };

    copier('clarity', 'Clarity2012');
    /* La texture a son propre etage depuis le 2026-08-16. Avant, elle etait
       melangee a la clarte faute de reglage dedie — deux effets d'echelles
       differentes empiles sur un seul curseur. */
    copier('texture', 'Texture');
    copier('noiseReductionLuminance', 'LuminanceSmoothing');
    copier('noiseReductionColor', 'ColorNoiseReduction');
    copier('sharpness', 'Sharpness');
    copier('grain', 'GrainAmount');
    copierMemeZero('grainSize', 'GrainSize');
    copierMemeZero('grainRoughness', 'GrainFrequency');

    /* Le voile n'est PAS calibre: Lightroom l'estime a partir du contenu de
       l'image, donc aucune mire ne le capture (cf. 4-synchro-effets.md). On
       recopie le nombre faute de mieux, en sachant que c'est le seul de la
       liste dont l'echelle n'a pas ete verifiee. */
    const dehaze = number(values, 'Dehaze');
    if (dehaze !== 0) filters.dehaze = dehaze;

    /* Le vignetage Lightroom est signe: negatif = sombre, positif = clair.
       Le moteur stocke l'intensite en valeur absolue et garde le sens dans un
       marqueur distinct afin de ne pas changer les anciens looks VibeFX. */
    const vignette = number(values, 'PostCropVignetteAmount');
    if (vignette !== 0) {
        filters.vignette = Math.abs(vignette);
        filters.vignetteLightroomV2 = true;
        if (vignette > 0) filters.vignetteLighten = true;
    }
    copierMemeZero('vignetteMidpoint', 'PostCropVignetteMidpoint');
    copierMemeZero('vignetteRoundness', 'PostCropVignetteRoundness');
    copierMemeZero('vignetteFeather', 'PostCropVignetteFeather');
    copierMemeZero('vignetteHighlights', 'PostCropVignetteHighlightContrast');

    return filters;
}

/*
 * CE QUE L'IMPORT NE SAIT PAS REPRODUIRE — et qu'il doit DIRE.
 *
 * Ajoutee le 2026-08-19, apres l'audit de fiabilite
 * (`docs/lightroom/5-audit-fiabilite-2026-08-19.md`). Deux reglages du `.xmp`
 * etaient jetes en silence par `toSpatialFilters`, et trois autres recopies
 * dans des zones ou notre moteur s'ecarte du sien. Le preset s'installait, la
 * couleur etait juste, et le rendu etait faux sans qu'aucune ligne ne le dise —
 * c'est exactement le mode de panne que tout ce chantier cherche a eviter.
 *
 * Cette fonction ne corrige rien et ne borne rien: elle ECRIT ce qu'un humain
 * doit savoir avant de juger le preset a l'oeil. Elle prend les valeurs FINALES
 * (`.xmp` ou releve a l'ecran passe en ligne de commande), parce que c'est ce
 * qui atterrit dans le preset qui compte, pas d'ou ca vient.
 */
export function verifierDomaineSpatial(spatial = {}, valeursXmp = null) {
    const alertes = [];
    const nombre = (v) => (Number.isFinite(v) ? v : 0);

    const clarity = nombre(spatial.clarity);
    if (clarity < 0) {
        alertes.push(`clarte NEGATIVE (${clarity}) : calee sur Lightroom le 2026-08-19, mais notre masque flou a UN seul rayon est plat la ou le sien mord moins sur les grandes structures — jusqu'a 6 % d'ecart a -100. A regarder a l'oeil.`);
    }

    const dehaze = nombre(spatial.dehaze);
    if (dehaze !== 0) {
        alertes.push(`voile ${dehaze} : il est reproduit dans les deux sens, mais son echelle reste la seule non calibree sur photo (11,8/255 d'ecart mesure a +50). Lightroom l'estime depuis le contenu; controle visuel obligatoire.`);
    }
    if (dehaze > 35 || dehaze < -20) {
        alertes.push(`voile ${dehaze} hors garde-fou (-20 a +35) : il sera borne en mode smartphone sur.`);
    }

    const sharpness = nombre(spatial.sharpness);
    if (sharpness >= 80) {
        alertes.push(`nettete ${sharpness} : au-dela de 80 la sienne raidit aussi les LARGES structures (x1,58 a 150) et la notre non. A 40, la valeur qu'il pose par defaut, l'ecart est nul.`);
    }

    const texture = nombre(spatial.texture);
    if (Math.abs(texture) > 0 || Math.abs(clarity) > 0) {
        alertes.push('texture / clarte : le profil Lightroom protege les aretes franches et applique le detail avant la conversion couleur. Le moteur sait le faire pour les imports calibres; controle visuel obligatoire pour un ancien preset sans marqueur de profil.');
    }

    return alertes;
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
    push('netteté', 'Sharpness');
    push('réduction du bruit luminance', 'LuminanceSmoothing');
    push('réduction du bruit couleur', 'ColorNoiseReduction');
    push('grain', 'GrainAmount');
    push('taille du grain', 'GrainSize');
    push('cassure du grain', 'GrainFrequency');
    push('milieu du vignettage', 'PostCropVignetteMidpoint');
    push('arrondi du vignettage', 'PostCropVignetteRoundness');
    push('contour progressif du vignettage', 'PostCropVignetteFeather');
    push('hautes lumières du vignettage', 'PostCropVignetteHighlightContrast');
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
        /* Ce que le moteur ne saura PAS reproduire, pour que l'import le dise. */
        spatialAlertes: verifierDomaineSpatial(toSpatialFilters(values), values),
        /* Ce qu'on affiche a un humain. */
        summary: toSummary(values, curves),
        /* Tout le reste, brut, si on doit y revenir. */
        raw: values,
    };
}
