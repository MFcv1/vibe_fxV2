/*
 * Smoke test du preset Vision « Powlisher ».
 *
 * Il verifie les neuf cibles chiffrees de `docs/audit-preset-powlisher-2026-08-11.md`
 * (section 7), mesurees sur 19 photos de @powl_d. Ce sont les memes mesures que
 * celles de l'audit, rejouees sur la fonction du preset: si quelqu'un retouche
 * une courbe ou une bande de teinte et casse le rendu, ca se voit ici.
 *
 * Il verifie aussi que la LUT 3D reproduit bien la fonction pure: c'est le point
 * ou une erreur d'indexation passerait sinon inapercue.
 */

import {
    VISION_PRESETS,
    getPresetLut,
    getPresetTransform,
} from '../src/features/vibefx-studio/utils/visionPresets.js';
import { readFileSync } from 'node:fs';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import {
    buildHaldIdentity,
    haldImageSize,
    haldToLut3d,
    lutFromBase64,
    lutToBase64,
    measureHaldDeviation,
} from '../src/features/vibefx-studio/utils/haldClut.js';
import { parseXmpPreset, verifierDomaineSpatial } from '../src/features/vibefx-studio/utils/xmpPreset.js';
import { visionBoundsFor } from '../src/features/vibefx-studio/utils/visionColorScience.js';

let failures = 0;
const results = [];

function check(label, value, min, max, unit = '') {
    const ok = value >= min && value <= max;
    if (!ok) failures += 1;
    results.push({ ok, label, value, min, max, unit });
}

/* ---------- utilitaires couleur (independants du module teste) ---------- */

function hslToRgb(h, s, l) {
    if (s <= 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hk = (((h % 360) + 360) % 360) / 360;
    const f = (t) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };
    return [f(hk + 1 / 3), f(hk), f(hk - 1 / 3)];
}

function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    return [h, s, l];
}

const transform = getPresetTransform('powlisher');
if (!transform) {
    console.error('ECHEC: preset « powlisher » introuvable.');
    process.exit(1);
}

/* ---------- 1. rampe neutre ---------- */

const neutral = (l) => {
    const out = transform([l, l, l]);
    return { rg: (out[0] - out[1]) * 255, bg: (out[2] - out[1]) * 255, out };
};

const deepShadow = neutral(0.05);
check('neutres L0-10% : R-G ~ 0', deepShadow.rg, -1, 1);
check('neutres L0-10% : B-G ~ 0', deepShadow.bg, -1, 1);

const midR = [neutral(0.45).rg, neutral(0.55).rg];
check('neutres L40-60% : R-G (olive)', Math.min(...midR), -6, -3);

const highB = neutral(0.72).bg;
check('neutres L70-75% : B-G (creme)', highB, -14, -10);

/* ---------- 2. placement des teintes ---------- */

const probe = (h, s, l) => rgbToHsl(...transform(hslToRgb(h, s, l)));

const skies = [probe(205, 0.45, 0.65), probe(215, 0.55, 0.55), probe(230, 0.65, 0.45)];
check('ciel : teinte min', Math.min(...skies.map((p) => p[0])), 178, 192);
check('ciel : teinte max', Math.max(...skies.map((p) => p[0])), 178, 196);

const foliage = [probe(105, 0.5, 0.38), probe(115, 0.45, 0.42)];
check('feuillage : teinte', Math.min(...foliage.map((p) => p[0])), 85, 105);
check('feuillage : saturation', Math.max(...foliage.map((p) => p[1])), 0, 0.35);

const skin = [probe(25, 0.4, 0.65), probe(28, 0.45, 0.45)];
check('peau : teinte min', Math.min(...skin.map((p) => p[0])), 27, 36);
check('peau : teinte max', Math.max(...skin.map((p) => p[0])), 27, 36);
check('peau : saturation', Math.max(...skin.map((p) => p[1])), 0.31, 0.55);

/* ---------- 3. hautes lumieres et noirs ---------- */

/*
 * Hautes lumieres cremeuses.
 *
 * L'audit mesure S ~ 0.06 a 90-95% de luminance, mais c'est une MOYENNE sur tous
 * les pixels de la bande, tres majoritairement neutres. Redemander ce chiffre a
 * une sonde volontairement saturee n'aurait aucun sens: en HSL, la saturation
 * explose quand la luminance approche 1, et un ecart R/B de 4/255 suffit deja a
 * la faire monter a 0.19. On teste donc les deux choses qui, elles, sont
 * intrinseques au preset:
 *   - une haute lumiere presque neutre le reste,
 *   - une couleur perd une part nette de sa saturation en montant.
 */
const brightNeutralSat = probe(40, 0.12, 0.92)[1];
check('haute lumiere neutre reste neutre', brightNeutralSat, 0, 0.16);

const satMid = probe(40, 0.35, 0.50)[1];
const satHigh = probe(40, 0.35, 0.92)[1];
check('perte de saturation en montant', satHigh / satMid, 0, 0.70, ' ratio');

const white = transform([1, 1, 1]);
check('point blanc sous 255', Math.max(...white) * 255, 235, 254.4);

const black = transform([0, 0, 0]);
check('noirs denses (pas de matte)', Math.max(...black) * 255, 0, 3);

/* ---------- 4. la LUT reproduit la fonction pure ---------- */

const lut = getPresetLut('powlisher');
if (!lut) {
    console.error('ECHEC: LUT « powlisher » non compilee.');
    process.exit(1);
}
check('taille de la LUT', lut.length, LUT_SIZE ** 3 * 3, LUT_SIZE ** 3 * 3);

let maxDelta = 0;
const samples = [];
for (let i = 0; i < 512; i += 1) {
    /* Echantillonnage deterministe, hors des nœuds de la grille pour que
       l'interpolation trilineaire soit reellement sollicitee. */
    const r = ((i * 37) % 251) / 250;
    const g = ((i * 91) % 251) / 250;
    const b = ((i * 143) % 251) / 250;
    samples.push([r, g, b]);
}
const data = new Uint8ClampedArray(samples.length * 4);
samples.forEach(([r, g, b], i) => {
    data[i * 4] = Math.round(r * 255);
    data[i * 4 + 1] = Math.round(g * 255);
    data[i * 4 + 2] = Math.round(b * 255);
    data[i * 4 + 3] = 255;
});
applyLut3dToData(data, lut, LUT_SIZE, 1);
samples.forEach(([r, g, b], i) => {
    const expected = transform([r, g, b]);
    for (let c = 0; c < 3; c += 1) {
        maxDelta = Math.max(maxDelta, Math.abs(expected[c] * 255 - data[i * 4 + c]));
    }
});
check('ecart LUT vs fonction pure', maxDelta, 0, 4, '/255');

/* L'identite doit rester l'identite quand l'intensite vaut 0. */
const untouched = new Uint8ClampedArray([12, 200, 77, 255]);
applyLut3dToData(untouched, lut, LUT_SIZE, 0);
check('intensite 0 = image intacte', Math.abs(untouched[1] - 200), 0, 0);

/* ---------- 5. le registre ---------- */

check('au moins un preset expose', VISION_PRESETS.length, 1, 99);
/* Un preset est valide s'il sait produire une LUT, par l'un des deux chemins:
   une fonction pure ecrite a la main, ou une table importee de Lightroom. */
const malformed = VISION_PRESETS.filter(
    (p) => !p.id || !p.label
        || (typeof p.transform !== 'function' && typeof p.getLut !== 'function'),
);
check('presets complets (id/label/table)', malformed.length, 0, 0);
/* Chaque preset declare doit reellement produire une LUT de la bonne taille. */
const badLut = VISION_PRESETS.filter((p) => {
    const table = getPresetLut(p.id);
    return !table || table.length !== LUT_SIZE ** 3 * 3;
});
check('chaque preset produit sa LUT', badLut.length, 0, 0);

/* ---------- 6. import Lightroom : Hald CLUT ---------- */

/*
 * La chaine d'import doit tenir un aller-retour exact: une mire neutre passee
 * dans un preset puis relue doit redonner ce preset. C'est la garantie que
 * `import-lightroom-preset.mjs` ne produira pas un preset faux en silence.
 */
const HALD_LEVEL = 6; /* cube 36 — assez pour tester, rapide */
const identity = buildHaldIdentity(HALD_LEVEL);
check('mire Hald : taille image', identity.size, haldImageSize(HALD_LEVEL), haldImageSize(HALD_LEVEL));
check('mire Hald : octets', identity.data.length, identity.cube ** 3 * 3, identity.cube ** 3 * 3);

/* Une mire neutre relue doit redonner l'identite. */
const identityLut = haldToLut3d(identity.data, HALD_LEVEL, LUT_SIZE);
let identityError = 0;
for (let i = 0; i < identityLut.length; i += 3) {
    const cell = i / 3;
    const r = cell % LUT_SIZE;
    const g = Math.floor(cell / LUT_SIZE) % LUT_SIZE;
    const b = Math.floor(cell / (LUT_SIZE * LUT_SIZE));
    identityError = Math.max(identityError, Math.abs(identityLut[i] - (r / (LUT_SIZE - 1)) * 255));
    identityError = Math.max(identityError, Math.abs(identityLut[i + 1] - (g / (LUT_SIZE - 1)) * 255));
    identityError = Math.max(identityError, Math.abs(identityLut[i + 2] - (b / (LUT_SIZE - 1)) * 255));
}
check('mire neutre relue = identite', identityError, 0, 2, '/255');

/* Une mire neutre doit etre detectee comme « preset non applique ». */
check('mire neutre detectee comme telle', measureHaldDeviation(identity.data, HALD_LEVEL).max, 0, 1);

/* Aller-retour complet: on applique le preset a la mire, on relit, on compare. */
const processed = new Uint8Array(identity.data.length);
const haldPixel = [0, 0, 0];
for (let i = 0; i < identity.data.length; i += 3) {
    haldPixel[0] = identity.data[i] / 255;
    haldPixel[1] = identity.data[i + 1] / 255;
    haldPixel[2] = identity.data[i + 2] / 255;
    const out = transform(haldPixel);
    processed[i] = Math.round(Math.max(0, Math.min(1, out[0])) * 255);
    processed[i + 1] = Math.round(Math.max(0, Math.min(1, out[1])) * 255);
    processed[i + 2] = Math.round(Math.max(0, Math.min(1, out[2])) * 255);
}
check('mire traitee detectee comme traitee', measureHaldDeviation(processed, HALD_LEVEL).max, 2, 255);

const importedLut = haldToLut3d(processed, HALD_LEVEL, LUT_SIZE);
let roundTripMax = 0;
for (let i = 0; i < lut.length; i += 1) {
    roundTripMax = Math.max(roundTripMax, Math.abs(lut[i] - importedLut[i]));
}
check('aller-retour Hald -> LUT', roundTripMax, 0, 12, '/255');

/* La LUT doit survivre au passage en base64 (c'est ainsi qu'elle est stockee). */
const decoded = lutFromBase64(lutToBase64(lut));
let base64Error = 0;
for (let i = 0; i < lut.length; i += 1) {
    base64Error = Math.max(base64Error, Math.abs(lut[i] - decoded[i]));
}
check('LUT intacte apres base64', base64Error, 0, 0);

/* ---------- 7. import Lightroom : lecture du .xmp ---------- */

const sampleXmp = `<?xpacket begin="\ufeff"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   crs:Contrast2012="-50"
   crs:Highlights2012="-30"
   crs:Clarity2012="20"
   crs:Texture="10"
   crs:GrainAmount="24"
   crs:PostCropVignetteAmount="-40"
   crs:HueAdjustmentBlue="-38"
   crs:SaturationAdjustmentGreen="-55">
   <crs:Name><rdf:Alt><rdf:li xml:lang="x-default">CN11</rdf:li></rdf:Alt></crs:Name>
   <crs:Group><rdf:Alt><rdf:li xml:lang="x-default">Cinéma II</rdf:li></rdf:Alt></crs:Group>
   <crs:ToneCurvePV2012>
    <rdf:Seq><rdf:li>0, 0</rdf:li><rdf:li>128, 132</rdf:li><rdf:li>255, 243</rdf:li></rdf:Seq>
   </crs:ToneCurvePV2012>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>`;

const parsed = parseXmpPreset(sampleXmp);
check('.xmp : nom lu', parsed.name === 'CN11' ? 1 : 0, 1, 1);
check('.xmp : groupe lu', parsed.group === 'Cinéma II' ? 1 : 0, 1, 1);
check('.xmp : contraste', parsed.basic.contrast, -50, -50);
check('.xmp : hautes lumières', parsed.basic.highlights, -30, -30);
check('.xmp : teinte du bleu', parsed.hsl.blue.hue, -38, -38);
check('.xmp : saturation du vert', parsed.hsl.green.saturation, -55, -55);
check('.xmp : courbe maître', parsed.curves.master?.length || 0, 3, 3);
/* Les reglages spatiaux sont le vrai apport du .xmp: une Hald CLUT ne les voit pas. */
check('.xmp : grain transposé', parsed.spatialFilters.grain || 0, 1, 60);
check('.xmp : vignetage transposé', parsed.spatialFilters.vignette || 0, 1, 60);
check('.xmp : clarté transposée', parsed.spatialFilters.clarity || 0, 1, 40);
check('.xmp : résumé lisible', parsed.summary.length, 3, 99);

let rejected = 0;
try {
    parseXmpPreset('<xml>pas un preset</xml>');
} catch {
    rejected = 1;
}
check('.xmp : fichier invalide rejeté', rejected, 1, 1);

/* ---------- ce que l'import doit AVOUER (2026-08-19) ----------
 *
 * Deux reglages du .xmp etaient jetes en silence et trois autres recopies dans
 * des zones ou notre moteur s'ecarte du sien: un preset s'installait, la
 * couleur etait juste, et le rendu etait faux sans qu'une ligne le dise. Ces
 * verifications gardent l'aveu, pas la correction — le moteur, lui, n'a pas
 * change.
 */
check(
    'domaine : un preset sage ne declenche aucune alerte',
    verifierDomaineSpatial({ grain: 15, sharpness: 40, vignette: 12 }).length, 0, 0,
);
check(
    'domaine : vignetage POSITIF signale (il est jete)',
    verifierDomaineSpatial({}, { PostCropVignetteAmount: '25' }).length, 1, 1,
);
check(
    'domaine : voile NEGATIF signale (il est jete)',
    verifierDomaineSpatial({}, { Dehaze: '-20' }).length, 1, 1,
);
check(
    'domaine : voile positif signale (echelle non calibree)',
    verifierDomaineSpatial({ dehaze: 30 }).length, 1, 1,
);
check(
    'domaine : nettete >= 80 signalee',
    verifierDomaineSpatial({ sharpness: 100 }).length, 1, 1,
);
check(
    'domaine : texture signale le halo sur les aretes',
    verifierDomaineSpatial({ texture: 25 }).length, 1, 1,
);
check(
    'domaine : les alertes remontent par parseXmpPreset',
    Array.isArray(parsed.spatialAlertes) ? 1 : 0, 1, 1,
);

/* ---------- la clarte NEGATIVE, calee le 2026-08-19 ----------
 *
 * Elle n'avait ete mesuree qu'au positif. Son dosage lineaire donnait a -100
 * exactement l'image floue (amplification 0,012 contre 0,476 chez Lightroom).
 * On garde ici la LOI, lue dans le moteur: une regression rendrait a nouveau
 * un adoucissement destructeur, et aucune mesure de couleur ne le verrait.
 */
const canvasSource = readFileSync(
    new URL('../src/features/vibefx-studio/utils/canvasUtils.js', import.meta.url), 'utf8',
);
const kNeg = Number(/CLARITY_K_NEG = ([\d.]+)/.exec(canvasSource)?.[1]);
const expNeg = Number(/CLARITY_EXPOSANT_NEG = ([\d.]+)/.exec(canvasSource)?.[1]);
check('clarté : le dosage négatif est une loi de puissance', Number.isFinite(kNeg) && Number.isFinite(expNeg) ? 1 : 0, 1, 1);
check('clarté : amplification à -50 (Lightroom 0,706)', 1 - kNeg * 50 ** expNeg, 0.68, 0.73);
check('clarté : amplification à -100 (Lightroom 0,496)', 1 - kNeg * 100 ** expNeg, 0.47, 0.53);
check(
    'clarté : le négatif applique bien la loi, pas la ligne',
    /clarity > 0[\s\S]{0,120}CLARITY_K_NEG/.test(canvasSource) ? 1 : 0, 1, 1,
);

/* ---------- powlisher-ciel : le ciel converge au lieu d'etre tourne ----------
 *
 * Trois choses a garder, et la troisieme est celle qui a coute une version.
 *
 *  1. Un ciel bleu atterrit dans SA fenetre (190-199°), au lieu de passer
 *     dessous dans le menthe comme le fait la rotation fixe de V1.
 *  2. Un ciel DEJA dans la fenetre n'est presque pas bouge — c'est ce qui
 *     distingue « placer une couleur » de « la pousser ».
 *  3. Aucune regle ne depend de la teinte d'un pixel qui n'en a plus. Dans un
 *     voile quasi blanc, la teinte est du bruit; une regle qui s'y fie trace un
 *     trait de contour en plein degrade. C'est ce qui est arrive a la version
 *     precedente, et ca ne se voyait dans AUCUNE moyenne — d'ou ce test.
 */

const ciel = getPresetTransform('powlisher-ciel');
if (!ciel) {
    console.error('ECHEC: preset « powlisher-ciel » introuvable.');
    process.exit(1);
}

const cielProbe = (h, s, l) => rgbToHsl(...ciel(hslToRgb(h, s, l)));
const chroma = ([r, g, b]) => {
    const max = Math.max(r, g, b);
    return max <= 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

/* 1. Un vrai ciel bleu tombe dans sa fenetre. Les trois sondes couvrent un ciel
   de bord de mer (205°), un ciel de plein midi (215°) et un bleu profond de
   zenith (230°) — sur la photo temoin, l'entree mesuree est a 214°. */
const cieux = [cielProbe(205, 0.55, 0.60), cielProbe(215, 0.60, 0.55), cielProbe(230, 0.65, 0.45)];
check('ciel : teinte min', Math.min(...cieux.map((p) => p[0])), 188, 199);
check('ciel : teinte max', Math.max(...cieux.map((p) => p[0])), 188, 202);
/* Et il garde sa couleur: converger n'est pas delaver. */
check('ciel : reste un bleu franc', Math.min(chroma(ciel(hslToRgb(215, 0.60, 0.55)))), 0.35, 1);

/* La ou V1 le pousse sous sa propre fenetre. C'est le defaut corrige, fige. */
const cielV1 = rgbToHsl(...transform(hslToRgb(215, 0.60, 0.55)));
check('V1 poussait le ciel trop bas', cielV1[0], 150, 188);
check('ciel : redresse vs V1', cielProbe(215, 0.60, 0.55)[0] - cielV1[0], 8, 40, '°');

/* 2. Un ciel deja pose dans sa fenetre ne doit presque plus bouger. */
for (const [nom, depart] of [['190°', 190], ['195°', 195], ['199°', 199]]) {
    const bouge = Math.abs(cielProbe(depart, 0.45, 0.62)[0] - depart);
    check(`ciel deja juste (${nom}) : ne bouge plus`, bouge, 0, 8, '°');
}

/*
 * 3. LE TEST DE L'ARTEFACT, et il vaut une explication parce qu'il est né d'un
 * bug qu'aucune moyenne n'attrapait.
 *
 * Le regime teste est celui d'un VOILE: des pixels quasi neutres (chroma 0,015 a
 * 0,05) dont la teinte bruite de 10 a 40° d'un pixel a l'autre. C'est ce qui se
 * passe reellement dans un ciel blanchi ou une brume d'horizon. Deux pixels que
 * l'oeil voit identiques doivent le rester en sortie: si le preset les separe
 * PLUS que l'entree ne les separait, il dessine un contour la ou la photo etait
 * lisse — le fameux trait diagonal de la version precedente.
 *
 * On mesure donc une amplification (ecart de sortie / ecart d'entree), et on la
 * compare a celle de `powlisher`, qui sert de plancher: la regle du ciel a le
 * droit d'exister, pas d'ajouter du contour.
 *
 *   powlisher                 3,03×   (jamais montre de trait)
 *   la version supprimee      7,32×   (le trait etait visible a l'ecran)
 */
function amplificationVoile(fn) {
    let max = 0;
    for (let l = 0.55; l <= 0.95; l += 0.05) {
        for (const s of [0.015, 0.03, 0.05]) {
            for (let h = 150; h <= 280; h += 5) {
                for (const ecartTeinte of [10, 20, 40]) {
                    const a = hslToRgb(h, s, l);
                    const b = hslToRgb(h + ecartTeinte, s, l);
                    const fa = fn(a);
                    const fb = fn(b);
                    let dIn = 0;
                    let dOut = 0;
                    for (let c = 0; c < 3; c += 1) {
                        dIn = Math.max(dIn, Math.abs(a[c] - b[c]) * 255);
                        dOut = Math.max(dOut, Math.abs(fa[c] - fb[c]) * 255);
                    }
                    if (dIn >= 1) max = Math.max(max, dOut / dIn);
                }
            }
        }
    }
    return max;
}
const voileV1 = amplificationVoile(transform);
const voileCiel = amplificationVoile(ciel);
check('voile : powlisher, niveau de reference', voileV1, 0, 4, '×');
check('voile : la regle du ciel n\'ajoute pas de contour', voileCiel - voileV1, 0, 0.3, '×');

/* 4. Hors du ciel, c'est powlisher au bit pres: on ajoute, on ne remplace pas. */
const horsCiel = [
    ['feuillage', [105, 0.50, 0.38]],
    ['feuillage clair', [115, 0.45, 0.42]],
    ['peau claire', [25, 0.40, 0.65]],
    ['peau matte', [28, 0.45, 0.45]],
    ['gris moyen', [0, 0, 0.50]],
    ['turquoise peu profond', [165, 0.45, 0.55]],
    ['rouge sombre', [8, 0.55, 0.25]],
];
let ecartHorsCiel = 0;
for (const [, [h, s, l]] of horsCiel) {
    const a = transform(hslToRgb(h, s, l));
    const b = ciel(hslToRgb(h, s, l));
    for (let c = 0; c < 3; c += 1) ecartHorsCiel = Math.max(ecartHorsCiel, Math.abs(a[c] - b[c]) * 255);
}
check('hors ciel = powlisher (vert/peau/gris)', ecartHorsCiel, 0, 0, '/255');

/* Les signatures communes tiennent. */
check('ciel : point blanc identique', Math.abs(Math.max(...ciel([1, 1, 1])) - Math.max(...white)) * 255, 0, 0, '/255');
check('ciel : noirs denses', Math.max(...ciel([0, 0, 0])) * 255, 0, 3);

/* 5. Bandes. Une rampe qui traverse tout le domaine de la regle, rendue par la
   LUT reelle — c'est la, et pas dans la fonction pure, qu'une marche apparait. */
const cielLut = getPresetLut('powlisher-ciel');
const rampe = new Uint8ClampedArray(256 * 4);
for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    /* Du ciel profond du zenith au voile blanc de l'horizon. */
    rampe[i * 4] = 40 + (214 - 40) * t;
    rampe[i * 4 + 1] = 100 + (226 - 100) * t;
    rampe[i * 4 + 2] = 170 + (232 - 170) * t;
    rampe[i * 4 + 3] = 255;
}
applyLut3dToData(rampe, cielLut, LUT_SIZE, 1);
let sautCiel = 0;
for (let i = 1; i < 256; i += 1) {
    for (let c = 0; c < 3; c += 1) {
        sautCiel = Math.max(sautCiel, Math.abs(rampe[i * 4 + c] - rampe[(i - 1) * 4 + c]));
    }
}
check('ciel : pas de bandes sur un degrade', sautCiel, 0, 5, '/255');

/* ---------- powlisher-showcase : le clair-obscur ----------
 *
 * Les cibles viennent de ses trois photos de voiture (img05/06/07), mesurees:
 *   - part des pixels sous 40/255 : 48, 52, 69 %
 *   - 1 % le plus clair           : 183, 170, 137 /255
 *   - chroma sujet / decor        : 0,69/0,33 · 1,00/0,47 · 0,76/0,20
 *     soit un ecart de x2,1 a x3,8
 *
 * Une LUT ne peut pas garantir la premiere ligne: elle depend de la SCENE, pas
 * du reglage — une voiture photographiee a midi restera claire. Ce qui se teste
 * ici, c'est ce qui appartient vraiment au preset: le plafond des hautes
 * lumieres, et l'ecart de saturation entre le sujet et le decor.
 */

const showcase = getPresetTransform('powlisher-showcase');
if (!showcase) {
    console.error('ECHEC: preset « powlisher-showcase » introuvable.');
    process.exit(1);
}

/* 1. Le plafond des hautes lumieres. C'est la signature tonale du look. */
check('showcase : point blanc bride', Math.max(...showcase([1, 1, 1])) * 255, 175, 195);
check('showcase : noirs denses', Math.max(...showcase([0, 0, 0])) * 255, 0, 3);
/* Et il assombrit vraiment: un gris moyen descend nettement. */
check('showcase : tons moyens creuses', showcase([0.5, 0.5, 0.5])[1] * 255, 85, 115);

/* 2. Le creux de saturation, le mecanisme central.
   Sonde « decor »: une tole/un beton legerement colore. Sonde « sujet »: le
   jaune de la voiture, mesure a 31-37° et chroma 0,61-0,88. */
const decorIn = hslToRgb(35, 0.30, 0.42);
const sujetIn = hslToRgb(45, 0.85, 0.55);
const decorOut = chroma(showcase(decorIn));
const sujetOut = chroma(showcase(sujetIn));
/* Les bornes sont celles de SES photos, pas un pourcentage choisi: son decor
   vit entre 0,20 et 0,47 de chroma, son sujet entre 0,69 et 1,00. */
check('showcase : decor dans sa fourchette', decorOut, 0.15, 0.50);
check('showcase : sujet dans la sienne', sujetOut, 0.65, 1.00);
/* Et c'est l'ECART qui fait le look — x2,1 a x3,8 chez lui. */
check('showcase : ecart sujet/decor', sujetOut / decorOut, 2.0, 8, '×');
/* Le sujet ne doit pas etre lave au passage. */
check('showcase : le sujet n\'est pas lave', sujetOut / chroma(sujetIn), 0.85, 1.5, ' ratio');

/*
 * 3. Un gris reste un gris — au niveau de `powlisher`, pas mieux, pas pire.
 * Le melange vers l'ocre ne touche que ce qui a ete vide, donc jamais un
 * neutre; ce qui reste vient du virage split, commun a toute la famille.
 */
const grisShowcase = chroma(showcase([0.45, 0.45, 0.45]));
const grisV1 = chroma(transform([0.45, 0.45, 0.45]));
check('showcase : les gris restent au niveau V1', grisShowcase - grisV1, -0.02, 0.02);

/* 4. Le bleu n'est pas ocre, et il suit la regle du ciel corrigee. Un ciel
   delave reste une image; un ciel kaki, ou un ciel a 163°, est un bug — les
   deux se sont produits ici avant d'etre corriges. */
const cielShowcase = rgbToHsl(...showcase(hslToRgb(210, 0.45, 0.60)));
check('showcase : le ciel reste bleu', cielShowcase[0], 188, 250, '°');

/* 5. Aucun contour ajoute dans un voile: on se compare au niveau de
   `powlisher`, qui sert de plancher a toute la famille. */
check('showcase : n\'ajoute pas de contour', amplificationVoile(showcase) - voileV1, -4, 0.6, '×');

/* 6. Bandes sur un degrade sombre, la ou une courbe creusee les revele. */
const showcaseLut = getPresetLut('powlisher-showcase');
const rampeSombre = new Uint8ClampedArray(256 * 4);
for (let i = 0; i < 256; i += 1) {
    rampeSombre[i * 4] = i;
    rampeSombre[i * 4 + 1] = Math.round(i * 0.92);
    rampeSombre[i * 4 + 2] = Math.round(i * 0.78);
    rampeSombre[i * 4 + 3] = 255;
}
applyLut3dToData(rampeSombre, showcaseLut, LUT_SIZE, 1);
let sautShowcase = 0;
for (let i = 1; i < 256; i += 1) {
    for (let c = 0; c < 3; c += 1) {
        sautShowcase = Math.max(sautShowcase, Math.abs(rampeSombre[i * 4 + c] - rampeSombre[(i - 1) * 4 + c]));
    }
}
check('showcase : pas de bandes', sautShowcase, 0, 5, '/255');

/* ---------- les effets non-LUT portes par un preset ----------
 *
 * Un preset peut embarquer des reglages qu'une table de couleurs ne peut pas
 * contenir (grain, vignetage, relief: ils dependent des pixels voisins ou de la
 * position). Encore faut-il qu'ils soient REELLEMENT applicables: si un preset
 * demande un grain de 60 alors que les garde-fous plafonnent a 42, le moteur
 * ramene a 42 en silence et le preset ne rend pas ce qu'il annonce.
 */
const horsLut = VISION_PRESETS.filter((p) => p.spatialFilters);
check('au moins un preset porte des effets', horsLut.length, 1, 99);
let horsBornes = 0;
for (const preset of horsLut) {
    for (const [key, value] of Object.entries(preset.spatialFilters)) {
        const bounds = visionBoundsFor(key, { safe: true });
        if (!bounds || value < bounds.min || value > bounds.max) horsBornes += 1;
    }
}
check('effets des presets dans les garde-fous', horsBornes, 0, 0);

/* ---------- rapport ---------- */

console.log('\nSmoke preset Vision — cibles de docs/audit-preset-powlisher-2026-08-11.md §7\n');
for (const r of results) {
    const status = r.ok ? 'OK  ' : 'ECHEC';
    const value = typeof r.value === 'number' ? r.value.toFixed(2) : r.value;
    console.log(`  ${status} ${r.label.padEnd(38)} ${String(value).padStart(9)}${r.unit}   [${r.min} … ${r.max}]`);
}

if (failures > 0) {
    console.error(`\n${failures} verification(s) en echec.\n`);
    process.exit(1);
}
console.log(`\n${results.length} verifications passees.\n`);
