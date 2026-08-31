/*
 * La validation qui compte vraiment : sur une VRAIE photo.
 *
 * On applique le preset a la photo d'origine avec notre moteur, et on compare
 * pixel a pixel avec la meme photo passee dans Lightroom avec le meme preset.
 *
 * L'ecart ne sera jamais nul et il ne DOIT pas l'etre : Lightroom developpe
 * depuis du RAW lineaire, nous depuis un JPEG deja developpe. La question
 * n'est pas « est-ce zero » mais « est-ce assez petit pour que ce soit le meme
 * look ». Reperes utiles, sur 255 :
 *   <= 2   invisible
 *   3 a 5  invisible en pratique sur une photo
 *   6 a 10 visible en comparant cote a cote, pas isolement
 *   > 10   ce n'est plus le meme rendu
 *
 * L'ecart maximum, lui, est presque toujours localise sur des zones brulees ou
 * bouchees, la ou le JPEG n'a plus la matiere que le RAW avait. C'est pour ca
 * qu'on affiche aussi le 99e centile, bien plus parlant que le max.
 *
 *   node scripts/compare-preset-vs-lightroom.mjs <origine> <version-lightroom> <presetId>
 *   ... [--planche <sortie.png>] [--sans-effets]
 *       [--effets-seuls '{"clarity":24,"dehaze":6}']
 *
 * ═══ IL PASSE PAR LE VRAI MOTEUR DEPUIS LE 2026-08-19 ═══
 *
 * Avant, il n'appliquait que la LUT du preset — donc la COULEUR. Or un preset
 * Lightroom porte aussi des effets qu'aucune table de couleurs ne contient
 * (grain, vignetage, nettete, texture, clarte, voile). Comparer sans eux
 * mesurait un rendu que l'application n'affiche pas, et l'ecart lu melangeait
 * deux causes sans permettre de les separer: c'est comme ca que la Nettete 40
 * de `cn17` est restee invisible plusieurs jours, lue comme un vague ecart sur
 * les contours de la roche.
 *
 * Le script rend donc maintenant DEUX fois:
 *   - COULEUR SEULE, la LUT en Node, comme avant;
 *   - RENDU COMPLET, `renderStudio` dans un Chromium avec les `spatialFilters`
 *     du preset — exactement ce que /creer/vision affiche.
 *
 * Les deux chiffres cote a cote donnent l'ATTRIBUTION: si le complet est
 * meilleur que la couleur seule, les effets vont dans le bon sens; s'il est
 * pire, c'est un reglage avance qui diverge, et on sait lequel chercher.
 *
 * `--sans-effets` revient au comportement d'avant (aucun navigateur lance).
 *
 * LE GRAIN EST TOUJOURS MIS A 0 des deux cotes. Deux bruits aleatoires ne se
 * comparent pas pixel a pixel: le laisser ajouterait son ecart-type a l'ecart
 * mesure et ferait passer un rendu juste pour un rendu faux. La force du grain
 * se verifie sur la mire A (`mesure-grain-lightroom.mjs`), pas ici.
 */

import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import { getPresetLut, VISION_PRESET_BY_ID } from '../src/features/vibefx-studio/utils/visionPresets.js';

/*
 * ═══ RAMENER LES ENTREES EN sRVB, COMME LE FAIT L'APPLICATION ═══
 *
 * Ajoute le 2026-08-17, apres avoir trouve que l'INSTRUMENT et le PRODUIT ne
 * lisaient pas les memes pixels.
 *
 * Les nombres d'un fichier image ne sont pas des couleurs: ils ne le deviennent
 * qu'accompagnes d'un PROFIL, qui dit quelle couleur reelle vaut « 255 de
 * rouge ». Les JPEG de telephone recents ne sont plus en sRVB — ceux du Galaxy
 * S24 Ultra portent « DCI-P3 D65 Gamut with sRGB Transfer », dont les primaires
 * sont plus saturees.
 *
 * L'APPLICATION dessine dans un <canvas>, qui est en sRVB par defaut: le
 * navigateur applique le profil et convertit AVANT que notre moteur voie un
 * pixel. Ce script, lui, lisait les nombres bruts. Nos deux cotes appliquaient
 * donc la meme LUT a des entrees differentes — de 0,80/255 en moyenne (max 13)
 * sur la photo de plage qui a servi a valider cn17.
 *
 * Ce n'est pas grand-chose, mais ce n'est pas rien NON PLUS: on annoncait une
 * fidelite de 1,73/255 mesuree avec un instrument decale de 0,80. La moitie de
 * la precision annoncee etait de l'incertitude d'appareil.
 *
 * POURQUOI ColorSync ET PAS sharp. Sept variantes de sharp ont ete essayees
 * contre une verite ColorSync (`toColourspace('srgb')`, `withIccProfile`,
 * `pipelineColourspace('rgb16')`, passage par png()...): AUCUNE ne fait la
 * transformation ICC — toutes rendent les memes nombres bruts. libvips ne
 * l'applique que sur demande explicite, et sharp n'expose pas `icc_transform`.
 * ColorSync est de toute facon le bon choix: c'est le moteur couleur que macOS
 * — donc Safari — utilise reellement.
 *
 * On convertit meme quand le profil est deja sRVB: c'est alors une operation
 * neutre, et ca evite d'avoir a reconnaitre les mille noms du sRVB.
 */
const PROFIL_SRGB = '/System/Library/ColorSync/Profiles/sRGB Profile.icc';

function versSrgb(fichier, etiquette) {
    const meta = sharp(fichier).metadata();
    return meta.then(({ icc }) => {
        if (!icc) return { chemin: fichier, note: 'aucun profil ICC, suppose sRVB' };
        if (!fs.existsSync(PROFIL_SRGB)) {
            console.warn(
                `\n! ${etiquette}: profil ICC present, mais ColorSync est introuvable`
                + ' (hors macOS ?).\n  La comparaison se fait sur les nombres BRUTS:'
                + ' elle ne reproduit pas ce que fait\n  le navigateur. Ecart attendu:'
                + ' ~1/255 sur une photo de telephone.',
            );
            return { chemin: fichier, note: 'NON CONVERTI — ColorSync absent' };
        }
        const sortie = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), 'vibefx-srgb-')),
            'srgb.png',
        );
        try {
            execFileSync('sips', ['--matchTo', PROFIL_SRGB, fichier, '--out', sortie], {
                stdio: 'ignore',
            });
        } catch {
            console.warn(`\n! ${etiquette}: la conversion sRVB a echoue, on garde le brut.`);
            return { chemin: fichier, note: 'NON CONVERTI — sips a echoue' };
        }
        return { chemin: sortie, note: 'converti en sRVB (ColorSync)' };
    });
}

const argv = process.argv.slice(2);
const sansEffets = argv.includes('--sans-effets');
const plancheIndex = argv.indexOf('--planche');
const planche = plancheIndex === -1 ? null : argv[plancheIndex + 1];
const sortieIndex = argv.indexOf('--sortie');
const sortie = sortieIndex === -1 ? null : argv[sortieIndex + 1];
const effetsSeulsIndex = argv.indexOf('--effets-seuls');
const effetsSeulsBruts = effetsSeulsIndex === -1 ? null : argv[effetsSeulsIndex + 1];
/*
 * Le `plancheIndex + 1` vaut 0 quand --planche est absent (index -1): sans le
 * garde ci-dessous, le filtre jetait le PREMIER argument, et le script ne
 * marchait qu'avec --planche. Corrige le 2026-08-17.
 */
const valeursDOptions = new Set([
    plancheIndex + 1,
    sortieIndex + 1,
    effetsSeulsIndex + 1,
].filter((i) => i > 0));
const [source, reference, presetId] = argv.filter((v, i) => (
    !v.startsWith('--') && !valeursDOptions.has(i)
));

if (!source || !reference || !presetId) {
    console.error(
        '\nUsage: node scripts/compare-preset-vs-lightroom.mjs <origine> <version-lightroom> <presetId>'
        + ' [--planche <p.png>] [--sortie <notre-rendu.png>] [--sans-effets]'
        + ' [--effets-seuls \'{"clarity":24}\']\n',
    );
    process.exit(1);
}
if (!VISION_PRESET_BY_ID[presetId]) {
    console.error(`\nPreset inconnu: ${presetId}\n`);
    process.exit(1);
}

/*
 * `.rotate()` sans argument applique l'orientation EXIF. Indispensable ici: un
 * JPEG de telephone est souvent stocke en paysage avec une balise « tourne-moi »,
 * et Lightroom, lui, ecrit la rotation dans les pixels a l'export. Sans ca les
 * deux images n'ont meme pas les memes dimensions.
 */
const srcSrgb = await versSrgb(source, 'Origine');
const refSrgb = await versSrgb(reference, 'Lightroom');

const srcImage = sharp(srcSrgb.chemin).rotate();
const refImage = sharp(refSrgb.chemin).rotate();
const srcMeta = await srcImage.png().toBuffer({ resolveWithObject: true }).then((r) => r.info);
const refMeta = await refImage.png().toBuffer({ resolveWithObject: true }).then((r) => r.info);

console.log(`\nOrigine    : ${source} (${srcMeta.width}x${srcMeta.height}) — ${srcSrgb.note}`);
console.log(`Lightroom  : ${reference} (${refMeta.width}x${refMeta.height}) — ${refSrgb.note}`);
console.log(`Preset     : ${VISION_PRESET_BY_ID[presetId].label}`);

if (srcMeta.width !== refMeta.width || srcMeta.height !== refMeta.height) {
    console.error(
        '\nECHEC: les deux images n\'ont pas la meme taille. Reexporte depuis Lightroom'
        + '\nen « Taille reelle », sans redimensionnement.\n',
    );
    process.exit(1);
}

const { data: src } = await srcImage.removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { data: ref } = await refImage.removeAlpha().raw().toBuffer({ resolveWithObject: true });

const pixelCount = src.length / 3;
const total = pixelCount * 3;

/* La COULEUR SEULE : la LUT du preset a pleine force, en Node. */
const couleurSeule = Buffer.alloc(pixelCount * 3);
{
    const rgba = new Uint8ClampedArray(pixelCount * 4);
    for (let i = 0; i < pixelCount; i += 1) {
        rgba[i * 4] = src[i * 3];
        rgba[i * 4 + 1] = src[i * 3 + 1];
        rgba[i * 4 + 2] = src[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
    }
    applyLut3dToData(rgba, getPresetLut(presetId), LUT_SIZE, 1);
    for (let i = 0; i < pixelCount; i += 1) {
        couleurSeule[i * 3] = rgba[i * 4];
        couleurSeule[i * 3 + 1] = rgba[i * 4 + 1];
        couleurSeule[i * 3 + 2] = rgba[i * 4 + 2];
    }
}

/*
 * LE RENDU COMPLET — la LUT ET les effets spatiaux du preset, dans le VRAI
 * moteur.
 *
 * Pourquoi un navigateur: `applyClarity`, `applyTexture`, `applySharpness`,
 * `applyVignette` et la halation s'appuient sur `ctx.filter = 'blur(Npx)'` et
 * sur les modes de fusion du canvas, qui n'existent que la. Les reimplementer
 * en Node donnerait un chiffre sur du code que personne n'execute — c'est le
 * meme raisonnement que `rendu-mire-c.mjs` et `planche-showcase.mjs`.
 *
 * La photo n'est JAMAIS redimensionnee: un effet de detail depend de la taille
 * des pixels, et c'est le rendu pleine resolution qu'on compare a celui de
 * Lightroom.
 */
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function rendreAvecLeMoteur(pngSource, filtres) {
    const MIME = { '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
    const serveur = createServer((requete, reponse) => {
        const url = decodeURIComponent(requete.url.split('?')[0]);
        if (url === '/') {
            reponse.writeHead(200, { 'content-type': 'text/html' });
            reponse.end('<!doctype html><meta charset="utf-8"><title>comparaison</title>');
            return;
        }
        if (url === '/__photo') {
            reponse.writeHead(200, { 'content-type': 'image/png' });
            reponse.end(pngSource);
            return;
        }
        /* Le moteur ecrit ses imports sans extension; le navigateur l'exige. */
        const brut = path.join(RACINE, url);
        const cible = brut.startsWith(RACINE) && fs.existsSync(brut) && !brut.endsWith('/')
            ? brut
            : (fs.existsSync(`${brut}.js`) ? `${brut}.js` : null);
        if (!cible) { reponse.writeHead(404).end('non'); return; }
        reponse.writeHead(200, { 'content-type': MIME[path.extname(cible)] || 'application/octet-stream' });
        reponse.end(fs.readFileSync(cible));
    });
    await new Promise((pret) => serveur.listen(0, '127.0.0.1', pret));

    const navigateur = await chromium.launch();
    try {
        const page = await navigateur.newPage();
        page.on('pageerror', (e) => console.error('  [page]', e.message));
        page.on('console', (m) => { if (m.type() === 'error') console.error('  [page]', m.text()); });
        await page.goto(`http://127.0.0.1:${serveur.address().port}/`);
        const dataUrl = await page.evaluate(async (f) => {
            const { renderStudio } = await import('/src/features/vibefx-studio/engine/studioRenderer.js');
            const img = new Image();
            await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = '/__photo'; });
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            /* `high`: la qualite `low` saute relief, nettete, voile et grain —
               ce sont precisement les etages qu'on veut mesurer. */
            renderStudio(ctx, canvas, img.width, img.height, false, 'high', {
                images: [img], cropRatio: 'original', cropPos: { x: 0, y: 0 }, cropScale: 1,
                isCropping: false, filters: f,
            });
            return canvas.toDataURL('image/png');
        }, filtres);
        return Buffer.from(dataUrl.split(',')[1], 'base64');
    } finally {
        await navigateur.close();
        serveur.close();
    }
}

const preset = VISION_PRESET_BY_ID[presetId];
let effetsDuPreset = { ...(preset.spatialFilters || {}) };
if (effetsSeulsBruts !== null) {
    try {
        effetsDuPreset = JSON.parse(effetsSeulsBruts);
    } catch (error) {
        console.error(`\nJSON invalide pour --effets-seuls: ${error.message}\n`);
        process.exit(1);
    }
}
const grainDuPreset = effetsDuPreset.grain || 0;
delete effetsDuPreset.grain;

let rendu = couleurSeule;
let renduComplet = null;
if (!sansEffets) {
    const png = await srcImage.png().toBuffer();
    const sortie = await rendreAvecLeMoteur(png, {
        presetId,
        filterIntensity: 100,
        safeSmartphone: false,
        ...effetsDuPreset,
        grain: 0,
    });
    const { data, info } = await sharp(sortie).removeAlpha().raw()
        .toBuffer({ resolveWithObject: true });
    if (info.width !== srcMeta.width || info.height !== srcMeta.height) {
        console.error('\nECHEC: le moteur a rendu une taille inattendue.\n');
        process.exit(1);
    }
    renduComplet = data;
    rendu = data;
}

/* Ecart par canal, plus l'histogramme qui donne les centiles. */
function mesurer(notre) {
    const histogramme = new Int32Array(256);
    let somme = 0;
    let maximum = 0;
    for (let i = 0; i < total; i += 1) {
        const d = Math.abs(notre[i] - ref[i]);
        somme += d;
        histogramme[d] += 1;
        if (d > maximum) maximum = d;
    }
    const centile = (part) => {
        const cible = total * part;
        let vus = 0;
        for (let d = 0; d < 256; d += 1) {
            vus += histogramme[d];
            if (vus >= cible) return d;
        }
        return 255;
    };
    return { mean: somme / total, max: maximum, centile };
}

/*
 * LA COULEUR, LE GRAIN MIS DE COTE.
 *
 * Quand le preset porte du GRAIN, l'ecart pixel a pixel ne peut pas etre nul,
 * meme si la couleur est parfaite: son grain et le notre sont deux tirages
 * aleatoires qui ne tombent jamais aux memes endroits. Sur CN14 (grain 25) ca
 * pesait a soi seul 4 a 5/255, assez pour faire croire a une capture ratee.
 *
 * Moyenner par blocs de 8x8 avant de comparer efface ce bruit — il se divise
 * par 8 — et laisse la COULEUR, qui est justement ce qu'une Hald CLUT doit
 * capturer au 1/255 pres. Un ecart qui reste ELEVE apres ce moyennage n'est
 * plus imputable au grain: c'est la table qui est fausse, et la premiere
 * suspecte est un reglage « Auto » dans le preset.
 */
const BLOC = 8;

function mesureParBlocs(notre) {
    const { width: W, height: H } = srcMeta;
    const blocsX = Math.floor(W / BLOC);
    const blocsY = Math.floor(H / BLOC);
    let somme = 0;
    let compte = 0;
    let maximum = 0;
    for (let by = 0; by < blocsY; by += 1) {
        for (let bx = 0; bx < blocsX; bx += 1) {
            for (let c = 0; c < 3; c += 1) {
                let sNotre = 0;
                let sRef = 0;
                for (let y = 0; y < BLOC; y += 1) {
                    for (let x = 0; x < BLOC; x += 1) {
                        const i = (((by * BLOC + y) * W) + bx * BLOC + x) * 3 + c;
                        sNotre += notre[i];
                        sRef += ref[i];
                    }
                }
                const d = Math.abs(sNotre - sRef) / (BLOC * BLOC);
                somme += d;
                if (d > maximum) maximum = d;
                compte += 1;
            }
        }
    }
    return { mean: somme / compte, max: maximum };
}

/*
 * LA MATIERE PRESENTE — la deuxieme question, et elle n'est pas la meme.
 *
 * L'ecart pixel a pixel demande « nos pixels tombent-ils au meme endroit que
 * les siens ». Un effet spatial peut avoir exactement la bonne force et
 * repondre a cette question un peu MOINS bien qu'en ne faisant rien: accentuer
 * un contour deplace des pixels des deux cotes de l'arete, donc un noyau
 * legerement different du sien coute quelques 1/255 la ou ne rien faire n'en
 * coutait aucun — tout en laissant l'image plus molle que la sienne. C'est
 * exactement le piege qui avait cache la Nettete 40 de `cn17` pendant des
 * jours: l'ecart moyen etait excellent, et il manquait de la matiere.
 *
 * ET ON SEPARE LES CONTOURS DES ZONES PLATES, parce qu'une moyenne de gradient
 * sur toute l'image melange deux choses opposees: la matiere qu'on veut
 * reproduire, et le BRUIT qu'un masque flou amplifie sans qu'on le lui demande.
 * Un rapport global de 1,2 peut vouloir dire « nos aretes sont trop dures » ou
 * « on accentue le grain du JPEG »: ce ne sont pas les memes reparations.
 *
 * Le masque vient de LIGHTROOM (les 20 % de pixels ou SON gradient est le plus
 * fort), jamais de notre rendu: sinon le masque bougerait avec ce qu'on mesure.
 */
function gradients(rgb) {
    const { width: W, height: H } = srcMeta;
    const luma = new Float32Array(W * H);
    for (let i = 0; i < W * H; i += 1) {
        luma[i] = 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2];
    }
    const g = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y += 1) {
        for (let x = 1; x < W - 1; x += 1) {
            const i = y * W + x;
            g[i] = Math.abs(luma[i + 1] - luma[i - 1]) + Math.abs(luma[i + W] - luma[i - W]);
        }
    }
    return g;
}

/* Le masque des contours, defini une fois pour toutes sur l'image Lightroom. */
function masqueDesContours(gradientRef) {
    const histogramme = new Int32Array(1024);
    for (let i = 0; i < gradientRef.length; i += 1) {
        histogramme[Math.min(1023, Math.round(gradientRef[i]))] += 1;
    }
    let vus = 0;
    let seuil = 0;
    for (let v = 1023; v >= 0; v -= 1) {
        vus += histogramme[v];
        if (vus >= gradientRef.length * 0.2) { seuil = v; break; }
    }
    return seuil;
}

function matiere(rgb, gradientRef, seuil) {
    const g = gradients(rgb);
    let contours = 0;
    let plat = 0;
    let nContours = 0;
    let nPlat = 0;
    for (let i = 0; i < g.length; i += 1) {
        if (gradientRef[i] >= seuil) { contours += g[i]; nContours += 1; } else { plat += g[i]; nPlat += 1; }
    }
    return { contours: contours / (nContours || 1), plat: plat / (nPlat || 1) };
}

const mesureCouleur = mesurer(couleurSeule);
const mesureComplet = renduComplet ? mesurer(renduComplet) : null;
const retenue = mesureComplet || mesureCouleur;
const { mean, max } = retenue;
const percentile = retenue.centile;

/* Le meme calcul entre l'origine et Lightroom : de combien le preset change la photo. */
let effectSum = 0;
for (let i = 0; i < pixelCount; i += 1) {
    for (let c = 0; c < 3; c += 1) effectSum += Math.abs(src[i * 3 + c] - ref[i * 3 + c]);
}
const effect = effectSum / total;

const effetsLisibles = Object.entries(effetsDuPreset).map(([k, v]) => `${k}=${v}`).join(', ');
console.log(`Effets     : ${sansEffets
    ? 'IGNORES (--sans-effets): couleur seule'
    : (effetsLisibles || 'aucun dans ce preset')}`);
if (grainDuPreset) {
    console.log(`             grain ${grainDuPreset} MIS A 0 pour la comparaison (deux bruits`
        + ' aleatoires ne se comparent pas pixel a pixel).');
    console.log('             Sa force se verifie sur la mire A: mesure-grain-lightroom.mjs');
}

console.log(`\nECART entre notre rendu et Lightroom${renduComplet ? ' (rendu COMPLET)' : ''}`);
console.log(`  moyen            ${mean.toFixed(2)}/255`);
console.log(`  median           ${percentile(0.5)}/255`);
console.log(`  90e centile      ${percentile(0.9)}/255`);
console.log(`  99e centile      ${percentile(0.99)}/255`);
console.log(`  max              ${max}/255  (zones brulees ou bouchees)`);

console.log('\nA COMPARER A');
console.log(`  effet du preset  ${effect.toFixed(2)}/255  (ecart entre la photo d'origine et Lightroom)`);
console.log(`  -> notre rendu reproduit ${(100 * (1 - mean / effect)).toFixed(1)} % de l'effet du preset`);

/*
 * L'ATTRIBUTION. Deux chiffres cote a cote disent d'ou vient l'ecart, ce qu'un
 * chiffre seul ne peut pas faire: la couleur est capturee au 1/255 pres par
 * construction, donc si le rendu complet est PIRE que la couleur seule, ce sont
 * les effets spatiaux qui divergent — et il n'y a qu'eux a aller regarder.
 */
if (mesureComplet && Object.keys(effetsDuPreset).length) {
    const gain = mesureCouleur.mean - mesureComplet.mean;
    console.log('\nD\'OU VIENT L\'ECART');
    console.log(`  couleur seule (LUT)      ${mesureCouleur.mean.toFixed(2)}/255`);
    console.log(`  avec les effets          ${mesureComplet.mean.toFixed(2)}/255`);
    /* Le grain de Lightroom est dans SA photo et ne peut pas s'apparier au
       notre: on le met de cote en moyennant par blocs. */
    if (grainDuPreset) {
        const parBlocs = mesureParBlocs(couleurSeule);
        console.log(`  couleur seule, par blocs ${parBlocs.mean.toFixed(2)}/255  <- SON GRAIN MIS DE COTE`);
        console.log(`     (blocs de ${BLOC}x${BLOC}: deux grains aleatoires ne tombent jamais aux memes`);
        console.log('      endroits, moyenner les efface et laisse la couleur seule)');
    }
    if (gain > 0.05) {
        console.log(`  -> les effets RAPPROCHENT de Lightroom (${gain.toFixed(2)}/255 gagnes):`);
        console.log('     les valeurs relevees dans ses panneaux sont les bonnes.');
    } else if (gain < -0.05) {
        console.log(`  -> les effets ELOIGNENT de Lightroom (${(-gain).toFixed(2)}/255 perdus).`);
        console.log(`     Un reglage avance diverge: ${effetsLisibles}.`);
        console.log('     Verifie le releve des panneaux Effets et Detail, puis les limites');
        console.log('     connues: docs/lightroom/5-audit-fiabilite-2026-08-19.md');
    } else {
        console.log('  -> les effets ne changent presque rien a cette photo:');
        console.log('     elle n\'a pas la matiere qui les rendrait visibles (ou ils sont petits).');
    }

    const gradientRef = gradients(ref);
    const seuil = masqueDesContours(gradientRef);
    const lr = matiere(ref, gradientRef, seuil);
    const avant = matiere(couleurSeule, gradientRef, seuil);
    const apres = matiere(renduComplet, gradientRef, seuil);
    console.log('\nMATIERE PRESENTE (cible x1,00 — mesuree sur le gradient)');
    console.log(`  sur les CONTOURS (20 % du cadre)   couleur seule x${(avant.contours / lr.contours).toFixed(3)}`
        + `   avec les effets x${(apres.contours / lr.contours).toFixed(3)}`);
    console.log(`  sur les zones PLATES (bruit)       couleur seule x${(avant.plat / lr.plat).toFixed(3)}`
        + `   avec les effets x${(apres.plat / lr.plat).toFixed(3)}`);
    const ecartAvantC = Math.abs(avant.contours / lr.contours - 1);
    const ecartApresC = Math.abs(apres.contours / lr.contours - 1);
    if (ecartApresC < ecartAvantC) {
        console.log('  -> sur les contours, les effets remettent la BONNE QUANTITE de matiere.');
        console.log('     Si l\'ecart pixel a pixel monte quand meme, c\'est le NOYAU qui differe,');
        console.log('     pas la force: a juger a l\'oeil sur la planche, pas au chiffre.');
    } else if (ecartApresC > ecartAvantC + 0.02) {
        console.log('  -> sur les contours, les effets en mettent trop (ou pas assez): la valeur');
        console.log('     relevee dans son panneau est a revoir.');
    }
    if (apres.plat / lr.plat > 1.15) {
        console.log('  -> sur les zones plates, nous avons plus de grain que lui: nos effets de');
        console.log('     matiere accentuent le BRUIT du JPEG, la ou il developpe depuis du RAW.');
    }
} else if (!mesureComplet) {
    console.log('\n  (--sans-effets: seule la COULEUR est comparee. Un ecart sur les contours');
    console.log('   ou dans les coins ne serait PAS attribuable sans le rendu complet.)');
} else {
    console.log('\n  Ce preset ne porte aucun effet spatial: couleur seule et rendu complet');
    console.log('  sont la meme chose.');
}

if (sortie) {
    await sharp(rendu, { raw: { width: srcMeta.width, height: srcMeta.height, channels: 3 } })
        .png().toFile(sortie);
    console.log(`\nNotre rendu ecrit: ${sortie}`);
}

const verdict = mean <= 2 ? 'identique a l\'oeil'
    : mean <= 5 ? 'meme rendu, ecart invisible en pratique'
        : mean <= 10 ? 'meme look, ecart visible en comparant cote a cote'
            : 'CE N\'EST PLUS LE MEME RENDU';
console.log(`\nVERDICT: ${verdict}.\n`);

/*
 * LA PLANCHE. Un ecart moyen est un resume, et un resume peut cacher un defaut
 * localise: une bande dans un ciel, un contour, une teinte qui part sur une
 * seule matiere. D'ou deux choses a regarder.
 *
 *   Ligne 1  les trois images entieres, plus la CARTE DES ECARTS (x8, pour
 *            qu'un ecart de 3/255 soit visible). Un defaut de LUT s'y lit comme
 *            une forme: une zone, une bande, un aplat — pas comme du bruit.
 *   Ligne 2  la zone du PIRE ecart, a 1:1 et non redimensionnee, la ou il faut
 *            aller voir si le chiffre moyen ment.
 */
if (planche) {
    const { width: W, height: H } = srcMeta;

    /* La carte, en niveaux de gris, avant tout redimensionnement. */
    const carte = Buffer.alloc(W * H);
    /* Et le pire bloc, pour savoir ou couper la ligne du bas. */
    const BLOC = 128;
    const blocsX = Math.ceil(W / BLOC);
    const sommes = new Float64Array(blocsX * Math.ceil(H / BLOC));
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const i = y * W + x;
            const d = (Math.abs(rendu[i * 3] - ref[i * 3])
                + Math.abs(rendu[i * 3 + 1] - ref[i * 3 + 1])
                + Math.abs(rendu[i * 3 + 2] - ref[i * 3 + 2])) / 3;
            carte[i] = Math.min(255, Math.round(d * 8));
            sommes[Math.floor(y / BLOC) * blocsX + Math.floor(x / BLOC)] += d;
        }
    }
    let pire = 0;
    for (let b = 1; b < sommes.length; b += 1) if (sommes[b] > sommes[pire]) pire = b;
    const COTE = Math.min(560, W, H);
    const centreX = (pire % blocsX) * BLOC + BLOC / 2;
    const centreY = Math.floor(pire / blocsX) * BLOC + BLOC / 2;
    const gauche = Math.max(0, Math.min(W - COTE, Math.round(centreX - COTE / 2)));
    const haut = Math.max(0, Math.min(H - COTE, Math.round(centreY - COTE / 2)));

    const notreRaw = rendu;

    const brut = (data, channels = 3) => sharp(data, { raw: { width: W, height: H, channels } });
    const LARGEUR = 520;
    const reduire = (img) => img.resize({ width: LARGEUR, fit: 'inside' }).png().toBuffer();
    const couper = (img) => img.extract({
        left: gauche, top: haut, width: COTE, height: COTE,
    }).png().toBuffer();

    const haut1 = await Promise.all([
        reduire(brut(src)), reduire(brut(notreRaw)), reduire(brut(ref)), reduire(brut(carte, 1)),
    ]);
    const bas = await Promise.all([
        couper(brut(src)), couper(brut(notreRaw)), couper(brut(ref)), couper(brut(carte, 1)),
    ]);

    const MARGE = 10;
    const BANDEAU = 30;
    const hHaut = (await sharp(haut1[0]).metadata()).height;
    const colonne = Math.max(LARGEUR, COTE);
    const largeurTotale = 4 * (colonne + MARGE) - MARGE;
    const titres = [
        'origine',
        renduComplet ? 'notre rendu (LUT + effets)' : 'notre rendu (LUT seule)',
        'Lightroom',
        `ecart x8 (moyen ${mean.toFixed(2)}/255)`,
    ];
    const legende = Buffer.from(`<svg width="${largeurTotale}" height="${BANDEAU}">${
        titres.map((t, i) => `<text x="${i * (colonne + MARGE) + 8}" y="20" font-family="sans-serif"
            font-size="15" fill="#e8e8e8">${t}</text>`).join('')
    }</svg>`);
    const legende2 = Buffer.from(`<svg width="${largeurTotale}" height="${BANDEAU}"><text x="8" y="20"
        font-family="sans-serif" font-size="15" fill="#e8e8e8">zone du PIRE ecart, a 1:1 (x=${gauche}, y=${haut})</text></svg>`);

    await sharp({
        create: {
            width: largeurTotale,
            height: BANDEAU + hHaut + MARGE + BANDEAU + COTE,
            channels: 3,
            background: '#0c0c0c',
        },
    }).composite([
        { input: legende, top: 0, left: 0 },
        ...haut1.map((b, i) => ({ input: b, top: BANDEAU, left: i * (colonne + MARGE) })),
        { input: legende2, top: BANDEAU + hHaut + MARGE, left: 0 },
        ...bas.map((b, i) => ({
            input: b, top: BANDEAU + hHaut + MARGE + BANDEAU, left: i * (colonne + MARGE),
        })),
    ]).png().toFile(planche);

    console.log(`Planche ecrite: ${planche}`);
    console.log('La carte des ecarts est amplifiee x8: du NOIR = identique.\n');
}
