/*
 * AUDIT DES REGLAGES AVANCES — est-ce que chaque curseur fait quelque chose ?
 *
 *   node scripts/audit-reglages-avances.mjs
 *   node scripts/audit-reglages-avances.mjs --photo ~/Desktop/devimage/unsplash/x.jpg
 *   node scripts/audit-reglages-avances.mjs --planche /tmp/audit.png
 *
 * POURQUOI IL EXISTE. Un reglage peut etre branche dans l'interface, borne dans
 * le moteur, present dans la doc — et ne RIEN faire a l'ecran. C'est arrive au
 * grain (il plafonnait a 0,9/255) et a la texture (pas branchee du tout). La
 * seule preuve qui vaut, c'est de rendre l'image avec et sans, et de compter
 * les pixels qui ont bouge.
 *
 * POURQUOI UN NAVIGATEUR. Les etages spatiaux du moteur (clarte, texture,
 * nettete, halation, vignetage) s'appuient sur `ctx.filter = 'blur(Npx)'` et
 * sur les modes de fusion du canvas, qui n'existent que dans un navigateur.
 * Mesurer une reimplementation Node donnerait un chiffre sur du code que
 * personne n'execute. On sert `src/` en statique et on appelle `renderStudio`,
 * exactement ce que l'ecran /creer/vision appelle.
 *
 * LA MIRE. Une photo ne contient pas forcement de ciel, de peau, de feuillage
 * ni de hautes lumieres pres du blanc — or plusieurs reglages ne mordent QUE
 * la-dessus (`skySaturation`, `halation`, `getSkinProtection`...). Un audit sur
 * une seule photo declarerait morts des reglages qui n'avaient rien a manger.
 * La mire par defaut porte donc, en un seul cadre: rampe de gris, noirs
 * profonds, blancs speculaires, peaux, ciel, feuillage, tons chauds, un voile
 * brumeux, et une zone de detail (reseaux sinusoidaux + aretes franches) pour
 * les effets spatiaux. `--photo` ajoute une vraie photo a cote.
 *
 * CE QUI EST MESURE, pour chaque reglage et chaque valeur:
 *   - ecart moyen |delta| sur RVB, en 1/255;
 *   - ecart max;
 *   - part des pixels qui bougent d'au moins 1/255.
 * Le verdict compare a la meme mesure faite au repos: en dessous de MORT_SEUIL,
 * le curseur ne fait rien de visible.
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chromium } from '@playwright/test';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const lire = (nom, defaut = null) => {
    const i = args.indexOf(`--${nom}`);
    return i === -1 ? defaut : args[i + 1];
};
const photo = lire('photo');
const planche = lire('planche');
/*
 * `--preset <id>` rejoue tout l'audit AVEC un preset actif, exactement comme
 * l'ecran /creer/vision quand une vignette est selectionnee. C'est le cas qui
 * manquait: l'audit ne mesurait que la photo nue, donc un curseur devenu inerte
 * sous LUT passait inapercu.
 */
const preset = lire('preset');
/*
 * `--nuit` ajoute une MIRE DE NUIT: la meme matiere, exposee trois diaphragmes
 * plus bas, enseignes gardees vives. Elle existe parce que plusieurs reglages
 * sont ponderes PAR LA LUMINANCE du pixel (`getSafeTemperatureWeight` tombe a
 * zero sous 14/255) et que la luminosite est un MULTIPLICATEUR: sur une scene
 * de nuit ils rendent une fraction de ce qu'ils rendent sur la mire claire.
 * Un audit qui ne regarde qu'une mire moyenne ne peut pas voir ca.
 */
const avecNuit = args.includes('--nuit');
/* `--repos-seul` saute tous les essais: on ne veut que le controle du repos. */
const reposSeul = args.includes('--repos-seul');
const seulement = lire('seulement'); /* filtre sur le nom d'un reglage */

if (photo && !existsSync(photo)) {
    console.error(`\nECHEC: photo introuvable: ${photo}\n`);
    process.exit(1);
}

/*
 * DEUX SEUILS, ET PAS UN SEUL — parce qu'un effet LOCAL a une moyenne minuscule
 * sans etre invisible pour autant.
 *
 * La halation l'a montre: a 32, elle ne pese que 0,13/255 en moyenne, mais elle
 * deplace 40/255 sur 11,8 % de l'image — un halo franc autour des neons. Juger
 * a la moyenne seule l'aurait declaree morte, et on aurait « repare » un
 * reglage qui marche.
 *
 * Un reglage est donc considere vivant s'il passe l'un des deux: un ecart moyen
 * visible sur toute l'image, OU un ecart franc sur une part non negligeable.
 */
const MORT_SEUIL = 0.02;
const FAIBLE_SEUIL = 0.3;
const LOCAL_ECART = 8;      /* 8/255 sur un contour, ca se voit */
const LOCAL_PART = 0.01;    /* ...a condition que ca touche au moins 1 % du cadre */

/*
 * Ce qu'on teste, dans l'ordre du panneau /creer/vision, puis les reglages
 * supportes par le moteur mais absents du panneau (un preset importe depuis
 * Lightroom peut les poser: c'est `xmpPreset.js` qui les remplit).
 */
const REGLAGES = [
    /* --- Lumiere --- */
    { cle: 'brightness', label: 'Luminosité', panneau: true, sur: [85, 92, 108, 115], libre: [60, 140] },
    { cle: 'contrast', label: 'Contraste', panneau: true, sur: [80, 90, 112, 125], libre: [60, 180] },
    { cle: 'highlights', label: 'Hautes lumières', panneau: true, sur: [-45, -20, 20, 35], libre: [-50, 50] },
    { cle: 'shadows', label: 'Ombres', panneau: true, sur: [-35, -15, 20, 45], libre: [-50, 50] },
    /* --- Couleur --- */
    { cle: 'temperature', label: 'Température', panneau: true, sur: [-22, -10, 10, 22], libre: [-30, 30] },
    { cle: 'saturation', label: 'Saturation', panneau: true, sur: [45, 80, 110, 120], libre: [0, 180] },
    { cle: 'vibrance', label: 'Éclat des couleurs', panneau: true, sur: [-45, -20, 20, 45], libre: [-50, 50] },
    { cle: 'skinSaturation', label: 'Teintes de peau', panneau: true, sur: [-20, -10, 8, 15], libre: [-30, 30] },
    { cle: 'skySaturation', label: 'Ciel', panneau: true, sur: [-35, -15, 1, 12, 25], libre: [-40, 40] },
    { cle: 'foliageSaturation', label: 'Verdure', panneau: true, sur: [-35, -15, 11, 22], libre: [-40, 40] },
    { cle: 'warmSaturation', label: 'Tons chauds', panneau: true, sur: [-35, -15, 9, 18], libre: [-40, 40] },
    /* --- Matiere --- */
    { cle: 'texture', label: 'Texture', panneau: true, sur: [-50, -20, 20, 50], libre: [-100, 100] },
    { cle: 'clarity', label: 'Relief (clarté)', panneau: true, sur: [-30, -10, 15, 30], libre: [-100, 100] },
    { cle: 'sharpness', label: 'Netteté', panneau: true, sur: [10, 25, 40, 60], libre: [150] },
    { cle: 'dehaze', label: 'Voile atmosphérique', panneau: true, sur: [10, 20, 35], libre: [50] },
    { cle: 'grain', label: 'Grain', panneau: true, sur: [5, 15, 25, 40], libre: [100] },
    { cle: 'vignette', label: 'Vignettage', panneau: true, sur: [3, 8, 20, 30], libre: [100] },
    /* --- Supportes par le moteur, hors panneau --- */
    { cle: 'sepia', label: 'Sépia', panneau: false, sur: [6, 12], libre: [] },
    { cle: 'blur', label: 'Flou', panneau: false, sur: [1, 2], libre: [] },
    { cle: 'hueRotate', label: 'Rotation de teinte', panneau: false, sur: [-12, 12], libre: [] },
    { cle: 'fadedBlacks', label: 'Noirs levés (matte)', panneau: false, sur: [4, 8], libre: [] },
    { cle: 'halation', label: 'Halation', panneau: false, sur: [10, 32], libre: [] },
    { cle: 'tintIntensity', label: 'Teinte globale', panneau: false, sur: [5, 10], libre: [], avec: { tintColor: '#ff8800' } },
    { cle: 'shadowTintIntensity', label: 'Teinte des ombres', panneau: false, sur: [9, 18], libre: [], avec: { shadowTint: '#0044aa' } },
    { cle: 'highlightTintIntensity', label: 'Teinte des hautes lumières', panneau: false, sur: [6, 12], libre: [], avec: { highlightTint: '#ffcc55' } },
    { cle: 'filterIntensity', label: "Dosage global de l'effet", panneau: false, sur: [50], libre: [], avec: { saturation: 130, contrast: 120 }, base: { saturation: 130, contrast: 120 } },
    { cle: 'toneCurveMaster', label: 'Courbe maître', panneau: false, sur: [[10, 90, 128, 170, 245]], libre: [] },
    { cle: 'toneCurveR', label: 'Courbe rouge', panneau: false, sur: [[0, 90, 128, 170, 255]], libre: [] },
    { cle: 'toneCurveG', label: 'Courbe verte', panneau: false, sur: [[0, 90, 128, 170, 255]], libre: [] },
    { cle: 'toneCurveB', label: 'Courbe bleue', panneau: false, sur: [[0, 90, 128, 170, 255]], libre: [] },
];

const aTester = reposSeul
    ? []
    : (seulement
        ? REGLAGES.filter((r) => r.cle.toLowerCase().includes(seulement.toLowerCase()))
        : REGLAGES);

/* Les essais, mis a plat: un par (reglage, valeur, garde-fous). */
const essais = [];
for (const reglage of aTester) {
    for (const valeur of reglage.sur) {
        essais.push({ cle: reglage.cle, label: reglage.label, valeur, safe: true, avec: reglage.avec, base: reglage.base });
    }
    for (const valeur of reglage.libre || []) {
        essais.push({ cle: reglage.cle, label: reglage.label, valeur, safe: false, avec: reglage.avec, base: reglage.base });
    }
}

/*
 * Les valeurs au repos sont LUES dans le source du hook, jamais recopiees ici:
 * une copie divergerait en silence, et l'audit comparerait a un repos qui
 * n'existe nulle part dans l'app.
 */
const DEFAUTS = (() => {
    const source = readFileSync(path.join(RACINE, 'src/features/vibefx-studio/hooks/useStudioFilters.js'), 'utf8');
    const debut = source.indexOf('{', source.indexOf('export const DEFAULT_FILTERS ='));
    let profondeur = 0;
    for (let i = debut; i < source.length; i += 1) {
        if (source[i] === '{') profondeur += 1;
        if (source[i] === '}') profondeur -= 1;
        if (profondeur === 0) return vm.runInNewContext(`(${source.slice(debut, i + 1)})`);
    }
    throw new Error('DEFAULT_FILTERS introuvable dans useStudioFilters.js');
})();

/*
 * Le preset actif, tel que l'ecran le pose vraiment: son identifiant POUR LA LUT
 * plus ses `spatialFilters` (grain, vignetage, relief, marqueurs d'ordre), que
 * `applyPreset` fusionne dans les reglages. Sans eux on mesurerait un demi-etat
 * qui n'existe dans aucune session.
 */
let presetSpatials = {};
if (preset) {
    const { VISION_PRESETS } = await import('../src/features/vibefx-studio/utils/visionPresets.js');
    const trouve = VISION_PRESETS.find((p) => p.id === preset);
    if (!trouve) {
        console.error(`\nECHEC: preset inconnu: ${preset}\n`);
        process.exit(1);
    }
    presetSpatials = { ...(trouve.spatialFilters || {}) };
    console.log(`\nPRESET ACTIF: ${trouve.label} [${preset}]`);
    console.log(`  spatialFilters: ${JSON.stringify(presetSpatials)}`);
}

/* ── Serveur statique: le moteur, la mire, la photo ─────────────────────── */
const MIME = { '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const serveur = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<!doctype html><meta charset="utf-8"><title>audit</title>');
        return;
    }
    if (url === '/__photo' && photo) {
        res.writeHead(200, { 'content-type': MIME[path.extname(photo).toLowerCase()] || 'image/jpeg' });
        res.end(readFileSync(photo));
        return;
    }
    const brut = path.join(RACINE, url);
    const cible = brut.startsWith(RACINE) && existsSync(brut) && !brut.endsWith('/') ? brut
        : (existsSync(`${brut}.js`) ? `${brut}.js` : null);
    if (!cible) { res.writeHead(404).end('non'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(cible)] || 'application/octet-stream' });
    res.end(readFileSync(cible));
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('  [page]', m.text()); });
page.on('pageerror', (e) => console.error('  [page]', e.message));
await page.goto(`http://127.0.0.1:${serveur.address().port}/`);

const resultats = await page.evaluate(async ({
    essais, avecPhoto, veutPlanche, DEFAUTS, preset, presetSpatials, avecNuit,
}) => {
    const { renderStudio } = await import('/src/features/vibefx-studio/engine/studioRenderer.js');
    /* Recopie de `DEFAULT_FILTERS` (hooks/useStudioFilters.js). On ne l'importe
       pas: ce module importe React, que le navigateur ne sait pas resoudre ici.
       `smoke-vision-defaults` ci-dessous verifie qu'elle ne derive pas. */
    const DEFAULT_FILTERS = DEFAUTS;

    /* ── La mire des reglages ────────────────────────────────────────────
       Tout ce que les differents etages du moteur savent reconnaitre doit
       exister quelque part dans ce cadre, sinon l'audit mesure l'absence de
       matiere et pas l'absence d'effet. */
    const L = 1200;
    const H = 800;
    const mire = document.createElement('canvas');
    mire.width = L;
    mire.height = H;
    const m = mire.getContext('2d', { willReadFrequently: true });

    /* Bande 1 — rampe de gris continue, du noir absolu au blanc absolu.
       C'est elle qui porte luminosite, contraste, courbes, noirs leves, et les
       hautes lumieres speculaires dont la halation a besoin. */
    const rampe = m.createLinearGradient(0, 0, L, 0);
    for (let i = 0; i <= 20; i += 1) {
        const v = Math.round((i / 20) * 255);
        rampe.addColorStop(i / 20, `rgb(${v},${v},${v})`);
    }
    m.fillStyle = rampe;
    m.fillRect(0, 0, L, 100);

    /* Bande 2 — pastilles de couleurs que le moteur traite SPECIFIQUEMENT.
       Les teintes viennent de `applySelectiveSaturation` (peau, chaud, ciel,
       feuillage) et de `getSkinProtection`. */
    const pastilles = [
        ['#e8b89a', 'peau claire'], ['#c98c63', 'peau moyenne'], ['#8d5a3b', 'peau foncée'],
        ['#5b8fd6', 'ciel'], ['#8fc4e8', 'ciel pâle'], ['#2f5f9e', 'ciel profond'],
        ['#4f8a3a', 'feuillage'], ['#7fbe4f', 'feuillage clair'], ['#2c5a24', 'feuillage sombre'],
        ['#d97a2b', 'orange chaud'], ['#c0392b', 'rouge'], ['#e8c84a', 'jaune'],
        ['#7d4fa8', 'violet'], ['#3aa89a', 'turquoise'], ['#9aa0a6', 'gris neutre'],
        ['#141414', 'noir profond'], ['#f4f4f4', 'blanc'], ['#ffffff', 'blanc pur'],
        /* Deux hautes lumieres COLOREES: sans elles, la halation paraissait
           morte alors qu'elle est faite pour ca. Son garde-fou eteint volontai-
           rement le halo sur un blanc speculaire neutre (`getSafeHalationWeight`
           tombe a 0,014 sur du blanc pur); ce qu'elle vise, c'est un neon. */
        ['#fff05a', 'néon jaune'], ['#a8f0ff', 'néon cyan'],
    ];
    const largeurPastille = L / pastilles.length;
    pastilles.forEach(([couleur], i) => {
        m.fillStyle = couleur;
        m.fillRect(i * largeurPastille, 100, largeurPastille + 1, 140);
    });

    /* Bande 3 — zone de DETAIL, pour les effets spatiaux. Trois reseaux
       sinusoidaux (8, 24 et 64 px de periode: fin, moyen, large) et des aretes
       franches. Un sinus ne contient qu'une echelle: l'amplification lue est
       donc bien celle de cette echelle-la (meme raison que la mire C). */
    const detail = m.createImageData(L, 220);
    for (let y = 0; y < 220; y += 1) {
        for (let x = 0; x < L; x += 1) {
            const i = (y * L + x) * 4;
            let v;
            if (x < L / 4) v = 128 + 60 * Math.sin((2 * Math.PI * x) / 8);
            else if (x < L / 2) v = 128 + 60 * Math.sin((2 * Math.PI * x) / 24);
            else if (x < (3 * L) / 4) v = 128 + 60 * Math.sin((2 * Math.PI * x) / 64);
            else v = (Math.floor(x / 40) % 2 === 0) ? 30 : 225; /* aretes franches */
            detail.data[i] = detail.data[i + 1] = detail.data[i + 2] = v;
            detail.data[i + 3] = 255;
        }
    }
    m.putImageData(detail, 0, 240);

    /* Bande 4 — un VOILE: contraste ecrase autour d'un gris clair, avec des
       formes dedans. C'est la seule matiere sur laquelle « voile atmospherique »
       a quelque chose a retirer. */
    const voile = m.createLinearGradient(0, 460, 0, 620);
    voile.addColorStop(0, '#cdd6dd');
    voile.addColorStop(1, '#aab6c0');
    m.fillStyle = voile;
    m.fillRect(0, 460, L, 160);
    for (let i = 0; i < 14; i += 1) {
        m.fillStyle = `rgba(${120 + i * 4},${128 + i * 3},${136 + i * 3},1)`;
        m.fillRect(20 + i * 84, 480, 60, 120);
    }

    /* Bande 5 — un degrade radial plein cadre en bas: matiere continue pour le
       vignetage, qui depend de la POSITION et pas du contenu. */
    const fond = m.createLinearGradient(0, 620, L, 800);
    fond.addColorStop(0, '#6b7a8f');
    fond.addColorStop(0.5, '#b8a68c');
    fond.addColorStop(1, '#4a5d6b');
    m.fillStyle = fond;
    m.fillRect(0, 620, L, 180);

    /* La photo optionnelle, chargee a cote. */
    let photoImg = null;
    if (avecPhoto) {
        photoImg = new Image();
        await new Promise((ok, ko) => { photoImg.onload = ok; photoImg.onerror = ko; photoImg.src = '/__photo'; });
    }

    const sources = [{ nom: 'mire', el: mire, w: L, h: H }];

    /* La MIRE DE NUIT: trois diaphragmes en dessous, en lumiere LINEAIRE (pas en
       sRVB, sinon on ecrase les ombres au lieu de les exposer moins), enseignes
       laissees vives. On obtient une mediane vers 25/255 avec des speculaires:
       la distribution d'une rue de nuit. */
    if (avecNuit) {
        const nuit = document.createElement('canvas');
        nuit.width = L;
        nuit.height = H;
        const n = nuit.getContext('2d', { willReadFrequently: true });
        n.drawImage(mire, 0, 0);
        const img = n.getImageData(0, 0, L, H);
        const d = img.data;
        const versLin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
        const versSrgb = (x) => {
            const v = Math.max(0, Math.min(1, x));
            return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
        };
        const gain = 2 ** -3;
        for (let i = 0; i < d.length; i += 4) {
            for (let c = 0; c < 3; c += 1) d[i + c] = versSrgb(versLin(d[i + c]) * gain);
        }
        n.putImageData(img, 0, 0);
        /* Les deux enseignes restent vives: une rue de nuit n'est pas une image
           uniformement sombre, elle est sombre AVEC des sources de lumiere. */
        n.fillStyle = '#fff05a';
        n.fillRect(L - 2 * largeurPastille, 100, largeurPastille + 1, 140);
        n.fillStyle = '#a8f0ff';
        n.fillRect(L - largeurPastille, 100, largeurPastille + 1, 140);
        sources.push({ nom: 'mire-nuit', el: nuit, w: L, h: H });
    }

    if (photoImg) {
        /* La photo est ramenee a la meme echelle que la mire: les effets de
           detail dependent de la taille des pixels, et on veut comparer des
           chiffres comparables. Jamais en dessous, jamais au-dessus. */
        const echelle = Math.min(1, 1600 / Math.max(photoImg.width, photoImg.height));
        const pw = Math.round(photoImg.width * echelle);
        const ph = Math.round(photoImg.height * echelle);
        const c = document.createElement('canvas');
        c.width = pw; c.height = ph;
        c.getContext('2d').drawImage(photoImg, 0, 0, pw, ph);
        sources.push({ nom: 'photo', el: c, w: pw, h: ph });
    }

    const rendre = (source, filters) => {
        const canvas = document.createElement('canvas');
        canvas.width = source.w;
        canvas.height = source.h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        renderStudio(ctx, canvas, source.w, source.h, false, 'high', {
            images: [source.el], cropRatio: 'original', cropPos: { x: 0, y: 0 }, cropScale: 1,
            isCropping: false, filters,
        });
        return { data: ctx.getImageData(0, 0, source.w, source.h).data, canvas };
    };

    const comparer = (a, b) => {
        let somme = 0;
        let max = 0;
        let touches = 0;
        let n = 0;
        for (let i = 0; i < a.length; i += 4) {
            let pire = 0;
            for (let c = 0; c < 3; c += 1) {
                const d = Math.abs(a[i + c] - b[i + c]);
                somme += d;
                if (d > pire) pire = d;
            }
            if (pire > max) max = pire;
            if (pire >= 1) touches += 1;
            n += 1;
        }
        return { moyenne: somme / (n * 3), max, partTouchee: touches / n };
    };

    const sortie = [];
    const vignettes = [];

    /*
     * LE CONTROLE DU REPOS, et c'est le plus important de ce fichier.
     *
     * Au repos, aucun reglage n'est actif: le moteur doit rendre la photo TELLE
     * QUELLE. Si ce n'est pas le cas, tout le reste devient faux — la
     * comparaison avant/apres montre un ecart que personne n'a demande, et
     * chaque curseur se mesure depuis une image deja modifiee.
     *
     * On compare donc la source BRUTE (dessinee sans moteur) au rendu au repos.
     * Deux repos, parce que l'ecran et le moteur ne sont pas d'accord: le
     * moteur pose `filterIntensity` a 100, mais l'ecran Vision envoie son etat
     * `intensity`, qui vaut 80 au demarrage.
     */
    const repos = [];
    for (const source of sources) {
        const brut = document.createElement('canvas');
        brut.width = source.w;
        brut.height = source.h;
        const bctx = brut.getContext('2d', { willReadFrequently: true });
        bctx.drawImage(source.el, 0, 0, source.w, source.h);
        const reference = bctx.getImageData(0, 0, source.w, source.h).data;
        for (const [nom, dosage] of [['moteur (100)', 100], ['écran Vision (80)', 80]]) {
            const rendu = rendre(source, { ...DEFAULT_FILTERS, filterIntensity: dosage });
            repos.push({ source: source.nom, dosage: nom, ...comparer(reference, rendu.data) });
        }
    }

    for (const source of sources) {
        const bases = new Map();
        const baseDe = (extra) => {
            const cle = JSON.stringify(extra || null);
            if (!bases.has(cle)) {
                bases.set(cle, rendre(source, { ...DEFAULT_FILTERS, ...(extra || {}) }).data);
            }
            return bases.get(cle);
        };

        for (const essai of essais) {
            const commun = {
                ...DEFAULT_FILTERS, safeSmartphone: essai.safe,
                ...(preset ? { presetId: preset, ...presetSpatials } : {}),
                ...(essai.avec || {}),
            };
            const filters = { ...commun, [essai.cle]: essai.valeur };
            /* Le repos de reference porte les MEMES reglages d'accompagnement:
               sinon on mesurerait aussi l'effet de la couleur de teinte ou du
               look que `filterIntensity` est cense doser. */
            const repos = {
                ...DEFAULT_FILTERS, safeSmartphone: essai.safe,
                ...(preset ? { presetId: preset, ...presetSpatials } : {}),
                ...(essai.base || essai.avec || {}),
            };
            const reposCle = { ...repos };
            const b = (() => {
                const cle = JSON.stringify(reposCle);
                if (!bases.has(cle)) bases.set(cle, rendre(source, reposCle).data);
                return bases.get(cle);
            })();
            void baseDe;
            const rendu = rendre(source, filters);
            const stats = comparer(b, rendu.data);
            sortie.push({
                source: source.nom, cle: essai.cle, label: essai.label,
                valeur: Array.isArray(essai.valeur) ? 'courbe' : essai.valeur,
                safe: essai.safe, ...stats,
            });
            if (veutPlanche && source.nom === 'mire') {
                vignettes.push({ cle: essai.cle, valeur: essai.valeur, url: rendu.canvas.toDataURL('image/png') });
            }
        }
    }

    return { sortie, repos, mireUrl: veutPlanche ? mire.toDataURL('image/png') : null };
}, {
    essais, avecPhoto: Boolean(photo), veutPlanche: Boolean(planche), DEFAUTS,
    preset, presetSpatials, avecNuit,
});

await navigateur.close();
serveur.close();

/* ── Rapport ────────────────────────────────────────────────────────────── */
const f2 = (v) => v.toFixed(2).padStart(6);
const pct = (v) => `${(v * 100).toFixed(1).padStart(5)} %`;

const verdictDe = (lignes) => {
    const pire = Math.max(...lignes.map((l) => l.moyenne));
    const local = lignes.some((l) => l.max >= LOCAL_ECART && l.partTouchee >= LOCAL_PART);
    if (pire >= FAIBLE_SEUIL) return { texte: 'OK', rang: 2 };
    if (local) return { texte: 'OK (effet local)', rang: 2 };
    if (pire < MORT_SEUIL) return { texte: 'MORT', rang: 0 };
    return { texte: 'quasi nul', rang: 1 };
};

console.log('\n\n╔══ CONTRÔLE DU REPOS ═══════════════════════════════════════');
console.log("║  Rien n'est réglé: le rendu doit être la photo telle quelle.");
for (const l of resultats.repos) {
    const ok = l.moyenne < MORT_SEUIL;
    console.log(
        `  ${ok ? '✓' : '✗'} ${l.source.padEnd(11)} dosage ${l.dosage.padEnd(18)} `
        + `moy ${f2(l.moyenne)}   max ${String(l.max).padStart(3)}   ${pct(l.partTouchee)} des pixels`,
    );
}

const sources = [...new Set(resultats.sortie.map((l) => l.source))];
const morts = [];
const faibles = [];

for (const source of sources) {
    const lignes = resultats.sortie.filter((l) => l.source === source);
    console.log(`\n\n╔══ SOURCE: ${source.toUpperCase()} ${'═'.repeat(Math.max(0, 52 - source.length))}`);
    console.log('║  écart moyen et max en 1/255, part des pixels qui bougent d\'au moins 1/255');
    console.log(`║  MORT si l'écart moyen reste sous ${MORT_SEUIL} · « quasi nul » sous ${FAIBLE_SEUIL}`);

    for (const reglage of aTester) {
        const siennes = lignes.filter((l) => l.cle === reglage.cle);
        if (!siennes.length) continue;
        const verdict = verdictDe(siennes);
        const marque = verdict.rang === 0 ? '✗' : verdict.rang === 1 ? '~' : '✓';
        const zone = reglage.panneau ? '' : '  (hors panneau)';
        console.log(`\n  ${marque} ${reglage.label} [${reglage.cle}]${zone} — ${verdict.texte}`);
        for (const l of siennes) {
            const garde = l.safe ? 'sûr ' : 'libre';
            console.log(`      ${garde} ${String(l.valeur).padStart(6)}  moy ${f2(l.moyenne)}   max ${String(l.max).padStart(3)}   ${pct(l.partTouchee)} des pixels`);
        }
        if (source === 'mire') {
            if (verdict.rang === 0) morts.push(reglage);
            else if (verdict.rang === 1) faibles.push(reglage);
        }
    }
}

console.log('\n\n══ VERDICT ══════════════════════════════════════════════════');
if (!morts.length && !faibles.length) {
    console.log('  Tous les réglages testés font quelque chose de visible.');
} else {
    if (morts.length) {
        console.log('\n  NE FONT RIEN DU TOUT:');
        for (const r of morts) console.log(`    - ${r.label} [${r.cle}]${r.panneau ? '  ← visible dans le panneau' : ''}`);
    }
    if (faibles.length) {
        console.log('\n  BOUGENT, MAIS SOUS LE SEUIL DU VISIBLE:');
        for (const r of faibles) console.log(`    - ${r.label} [${r.cle}]${r.panneau ? '  ← visible dans le panneau' : ''}`);
    }
}
console.log('');

if (planche) {
    /* La planche n'est pas une preuve, c'est un moyen de regarder: on ecrit la
       mire nue, pour verifier a l'oeil qu'elle contient bien de quoi mordre. */
    if (resultats.mireUrl) {
        writeFileSync(planche, Buffer.from(resultats.mireUrl.split(',')[1], 'base64'));
        console.log(`Mire écrite: ${planche}\n`);
    }
}

process.exit(morts.some((r) => r.panneau) ? 1 : 0);
