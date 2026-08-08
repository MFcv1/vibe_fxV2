/*
 * Transitions minutees rendues A L'IDENTIQUE des deux cotes.
 *
 * Cote export, 33 d'entre elles sont une transition native `xfade` de FFmpeg
 * (cf. SERVER_XFADE_TRANSITION_MAP) et les 15 dernieres, livrees au lot B3b, sont
 * des SOUS-GRAPHES de filtres natifs poses sur la queue du plan sortant et la
 * tete du plan entrant (cf. SERVER_TRANSITION_EFFECTS). Ce module en est la
 * contrepartie canvas : c'est lui qui garantit que l'apercu montre ce que
 * l'export produira.
 *
 * L'aiguillage se fait donc sur l'ID pour les quinze, et seulement ensuite sur la
 * cible `xfade` : elles partagent toutes `fade`, `wiperight` ou `vertopen` comme
 * simple JOINTURE, et un aiguillage sur la cible les rendrait toutes en fondu.
 *
 * Deux regles tirees de la mesure du filtre `xfade` (2026-07-30, lot L1) :
 *
 * 1. `xfade` progresse de facon STRICTEMENT LINEAIRE. Le reste de
 *    VideoEngine.renderTransition applique un `easeInOut` : ces transitions-ci ne
 *    doivent donc jamais y passer, sinon l'apercu et l'export ne sont pas en phase.
 * 2. Les fondus par une couleur (`fadeblack`, `fadewhite`) et `fadegrays` ne sont
 *    pas symetriques : l'image sortante disparait sur les 20 premiers pour cent,
 *    l'image entrante revient sur tout le reste. Les courbes plus bas sont
 *    RELEVEES sur des rendus FFmpeg reels, canal par canal — pas devinees.
 *
 * Trois ecarts residuels sont assumes et documentes sur place : le grain de
 * `dissolve` (tire au hasard par pixel cote FFmpeg), le noyau de flou de `hblur`,
 * et les coefficients de luminance de `fadegrays` (Rec.709 dans le navigateur,
 * Rec.601 dans FFmpeg). Tout le reste est mesure a moins de 4/255 d'ecart.
 *
 * DEUX PROGRESSIONS, et les confondre fausse la comparaison (lot B3b) : ce que le
 * renderer rampe par PALIERS (chaine de douze filtres a valeur constante) doit
 * etre lu quantifie (`quantizeProgress`), ce qu'il pilote par une EXPRESSION
 * FFmpeg (`zoompan`, `drawbox` a x variable, `overlay=enable`, `geq` en T) doit
 * etre lu en continu.
 * La mesure est refaite a chaque execution de
 * scripts/smoke-vibecut-xfade-preview-parity.mjs, qui compare cette
 * implementation image par image a ce que `xfade` produit.
 */

import {
    SERVER_XFADE_TRANSITION_MAP,
    SERVER_TRANSITION_EFFECTS,
    TRANSITION_EFFECT_STEPS,
} from '../export/exportManifest.js';

export const XFADE_TRANSITION_IDS = Object.freeze(Object.keys(SERVER_XFADE_TRANSITION_MAP));

/*
 * Largeurs de bord adouci, relevees sur les images de reference FFmpeg (les
 * balayages `smooth*` ont une zone de degrade tres large, pas un bord net) et
 * verifiees par smoke-vibecut-xfade-preview-parity.
 */
const SOFT_EDGE = 0.42;
const CIRCLE_SOFT_EDGE = 0.34;
const VERTICAL_SOFT_EDGE = 0.22;
const DISSOLVE_STEPS = 16;
const DISSOLVE_MASK_SIZE = 256;

/*
 * `circlecrop` RELEVE le 2026-08-02 (lot B3a).
 *
 * Le rayon visible ne decroit pas lineairement : mesure faite en cherchant, sur
 * l'axe +x puis sur la diagonale, le dernier pixel non noir, a 21 instants.
 *   rayon = |1 - 2t|^3 x hypot(w/2, h/2)
 * Les rapports releves (0,717/0,8^3 = 1,40 ; 0,300/0,6^3 = 1,39 ; 0,175/0,5^3 = 1,40)
 * convergent vers racine(2), qui est exactement hypot(w/2,h/2)/(w/2) sur un carre.
 * `rectcrop` suit la meme forme SANS le cube : demi-cote = |1 - 2t| x (w/2, h/2).
 */
const CIRCLE_CROP_EXPONENT = 3;

/*
 * COURBES MESUREES, pas devinees.
 *
 * Relevees le 2026-07-30 en rendant `xfade` avec un plan rouge pur et un plan
 * vert pur, puis en lisant les moyennes RVB image par image : sur `fadeblack`,
 * le canal rouge donne directement le poids du plan sortant et le canal vert
 * celui du plan entrant. `fadewhite` donne EXACTEMENT les memes deux courbes,
 * la couleur occupant le complement — d'ou une seule paire de tables ici.
 *
 * Le plan sortant s'eteint sur les 20 premiers pour cent ; le plan entrant
 * remonte sur tout le reste, en accelerant d'abord puis en se calmant. C'est
 * cette asymetrie qui donne son caractere au passage par le noir, et c'est
 * precisement ce qu'une interpolation symetrique ratait.
 *
 * Pas d'echantillonnage : 0,05. Interpolation lineaire entre deux points.
 */
const COLOR_FADE_FROM = [
    1, 0.794, 0.447, 0.135, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const COLOR_FADE_TO = [
    0, 0, 0.004, 0.012, 0.027, 0.057, 0.094, 0.141, 0.196, 0.264, 0.341,
    0.419, 0.506, 0.588, 0.667, 0.739, 0.8, 0.849, 0.898, 0.947, 1,
];

/*
 * `fadegrays` : le plan sortant perd sa couleur sur les 20 premiers pour cent
 * (meme courbe que le poids de `fadeblack`, soit un smoothstep sur 1-t), et le
 * plan entrant la retrouve bien plus tot qu'une symetrie ne le laisserait croire
 * — d'ou cette table, decomposee canal par canal a partir du meme releve.
 */
const GRAY_RECOLOR_TO = [
    0, 0, 0, 0, 0.049, 0.167, 0.285, 0.384, 0.482, 0.575, 0.668,
    0.747, 0.826, 0.88, 0.934, 0.964, 0.993, 1, 1, 1, 1,
];

// Deux ardoises distinctes: les masques travaillent en pleine taille, la
// pixellisation en taille reduite. Les melanger ferait recreer un canvas a
// chaque image, la taille des blocs changeant en continu.
const scratchCanvases = { mask: null, blocks: null };
let dissolveMasks = null;

export function isXfadeTransition(type) {
    return Object.hasOwn(SERVER_XFADE_TRANSITION_MAP, type);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} from - image sortante
 * @param {CanvasImageSource} to - image entrante
 * @param {number} t - progression LINEAIRE, 0 a 1
 * @param {string} type - id VibeCut (cle de SERVER_XFADE_TRANSITION_MAP)
 * @param {number} w
 * @param {number} h
 */
export function renderXfadeTransition(ctx, from, to, t, type, w, h) {
    const progress = clamp(t, 0, 1);
    // Aux deux extremites il n'y a plus de fondu: evite les bords adoucis qui
    // depasseraient du cadre sur la toute premiere / derniere image.
    if (progress <= 0) {
        ctx.globalAlpha = 1;
        ctx.drawImage(from, 0, 0, w, h);
        return undefined;
    }
    if (progress >= 1) {
        ctx.globalAlpha = 1;
        ctx.drawImage(to, 0, 0, w, h);
        return undefined;
    }

    /*
     * Lot B3b : ces transitions-la ne sont PAS une cible `xfade` native. Cote
     * export elles sont un sous-graphe - des filtres natifs rampes sur la queue
     * du plan sortant et la tete du plan entrant, puis une jointure `xfade`.
     * L'aiguillage se fait donc sur l'ID, pas sur la cible : elles partagent
     * toutes `fade` comme jointure, et un aiguillage sur la cible les rendrait
     * toutes en simple fondu.
     */
    const effect = SERVER_TRANSITION_EFFECTS[type];
    if (effect) return renderEffectTransition(ctx, from, to, progress, effect, type, w, h);

    return renderXfadeTarget(ctx, from, to, progress, SERVER_XFADE_TRANSITION_MAP[type] || 'fade', w, h);
}

function renderXfadeTarget(ctx, from, to, progress, target, w, h) {
    switch (target) {
        case 'fadeblack':
            return drawColorFade(ctx, from, to, progress, w, h, '0,0,0');
        case 'fadewhite':
            return drawColorFade(ctx, from, to, progress, w, h, '255,255,255');
        case 'fadegrays':
            return drawGrayFade(ctx, from, to, progress, w, h);
        case 'dissolve':
            return drawDissolve(ctx, from, to, progress, w, h);
        case 'smoothleft':
            return drawSoftWipe(ctx, from, to, progress, w, h, 'left');
        case 'smoothright':
            return drawSoftWipe(ctx, from, to, progress, w, h, 'right');
        case 'smoothup':
            return drawSoftWipe(ctx, from, to, progress, w, h, 'up');
        case 'smoothdown':
            return drawSoftWipe(ctx, from, to, progress, w, h, 'down');
        case 'slideup':
            return drawSlide(ctx, from, to, progress, w, h, 'up');
        case 'slidedown':
            return drawSlide(ctx, from, to, progress, w, h, 'down');
        case 'slideleft':
            return drawSlide(ctx, from, to, progress, w, h, 'left');
        case 'slideright':
            return drawSlide(ctx, from, to, progress, w, h, 'right');
        case 'wipeleft':
            return drawHardWipe(ctx, from, to, progress, w, h, 'left');
        case 'wiperight':
            return drawHardWipe(ctx, from, to, progress, w, h, 'right');
        case 'wipeup':
            return drawHardWipe(ctx, from, to, progress, w, h, 'up');
        case 'wipedown':
            return drawHardWipe(ctx, from, to, progress, w, h, 'down');
        case 'vertopen':
            return drawAxisBars(ctx, from, to, progress, w, h, 'x', 'open');
        case 'vertclose':
            return drawAxisBars(ctx, from, to, progress, w, h, 'x', 'close');
        case 'horzopen':
            return drawAxisBars(ctx, from, to, progress, w, h, 'y', 'open');
        case 'horzclose':
            return drawAxisBars(ctx, from, to, progress, w, h, 'y', 'close');
        case 'circlecrop':
            return drawCrop(ctx, from, to, progress, w, h, 'circle');
        case 'rectcrop':
            return drawCrop(ctx, from, to, progress, w, h, 'rect');
        case 'squeezeh':
            return drawSqueeze(ctx, from, to, progress, w, h, 'h');
        case 'squeezev':
            return drawSqueeze(ctx, from, to, progress, w, h, 'v');
        case 'circleopen':
            return drawCircle(ctx, from, to, progress, w, h, 'open');
        case 'circleclose':
            return drawCircle(ctx, from, to, progress, w, h, 'close');
        case 'pixelize':
            return drawPixelize(ctx, from, to, progress, w, h);
        case 'hblur':
            return drawHorizontalBlur(ctx, from, to, progress, w, h);
        case 'fade':
        default:
            return drawLinearFade(ctx, from, to, progress, w, h);
    }
}

/* ---------- lot B3b : filtres rampes sur la queue de A et la tete de B ---------- */

/*
 * La rampe cote FFmpeg est un ESCALIER (`sendcmd` change l'option a des instants
 * donnes), pas une droite. L'apercu prend donc le meme palier : sans cette
 * quantification, comparer les deux a q=0,4 comparerait le palier 4 (q=0,333)
 * cote export a la valeur continue 0,4 cote apercu, et l'ecart serait pris pour
 * une erreur de courbe.
 * Doit rester identique a `quantizeTransitionProgress` de
 * render-service/src/server.js.
 */
export function quantizeProgress(progress, steps = TRANSITION_EFFECT_STEPS) {
    const value = clamp(Number(progress) || 0, 0, 1);
    return Math.min(steps - 1, Math.floor(value * steps)) / steps;
}

/*
 * Les deux courbes du lot, ecrites une fois. Doit rester identique a
 * `transitionEffectCurve` de render-service/src/server.js.
 */
export function transitionEffectCurve(curve, progress, side) {
    const q = clamp(Number(progress) || 0, 0, 1);
    if (curve === 'bell') return Math.sin(Math.PI * q);
    const value = side === 'b' ? 1 - q : q;
    if (curve === 'cubic') return value * value * value;
    return value;
}

/*
 * Deux familles, et confondre les deux fausserait la comparaison :
 *  - ce qui est rampe par `sendcmd` est un ESCALIER -> progression quantifiee ;
 *  - ce qui est rampe par EXPRESSION (`zoompan`) est continu -> progression
 *    continue. Quantifier un zoom le ferait avancer par a-coups a l'apercu
 *    alors que l'export est lisse.
 */
/*
 * Deux progressions, et les confondre fausserait la mesure :
 *  - `qStep`, quantifiee, pour tout ce que `sendcmd` rampe par paliers ;
 *  - `qCont`, continue, pour tout ce qu'une EXPRESSION FFmpeg evalue par image
 *    (`zoompan`, `drawbox` a x variable, `overlay=enable`, `geq` en T).
 * Une meme transition peut avoir besoin des deux : `light-leak` deplace son halo
 * par expression mais rampe son opacite par `sendcmd`.
 */
function renderEffectTransition(ctx, from, to, t, effect, type, w, h) {
    const qCont = clamp(t, 0, 1);
    const qStep = quantizeProgress(t);
    const target = SERVER_XFADE_TRANSITION_MAP[type] || 'fade';
    switch (effect.effect) {
        case 'blur':
            return drawBlurJoin(ctx, from, to, t, qStep, effect, w, h);
        case 'motion-blur':
            return drawMotionBlurJoin(ctx, from, to, t, qStep, effect, w, h);
        case 'zoom':
            return drawZoomJoin(ctx, from, to, t, qCont, effect, w, h);
        /*
         * Effets POSES APRES LA JOINTURE : on rend d'abord la jointure native,
         * exactement comme le renderer, puis on pose le calque par-dessus.
         */
        case 'lift':
            renderXfadeTarget(ctx, from, to, t, target, w, h);
            return drawWhiteVeil(ctx, effect, qStep, w, h);
        case 'rgb-split':
            renderXfadeTarget(ctx, from, to, t, target, w, h);
            return drawChannelShift(ctx, effect, qStep, w, h);
        case 'chromatic':
            renderXfadeTarget(ctx, from, to, t, target, w, h);
            return drawChromaticFringe(ctx, effect, qCont, w, h);
        case 'edge-bar':
            renderXfadeTarget(ctx, from, to, t, target, w, h);
            return drawEdgeBars(ctx, effect, qCont, w, h);
        case 'light-leak':
            renderXfadeTarget(ctx, from, to, t, target, w, h);
            return drawLightLeak(ctx, effect, qCont, qStep, w, h);
        /*
         * Jointures REFAITES : le serveur ne passe pas par `xfade` pour celles-ci,
         * il choisit entre les deux plans image par image ou compose par masque.
         */
        case 'strobe':
            return drawStrobeJoin(ctx, from, to, qCont, effect, w, h);
        case 'grid-reveal':
            return drawGridReveal(ctx, from, to, qCont, effect, w, h);
        case 'glitch':
            return drawGlitchJoin(ctx, from, to, qCont, qStep, effect, w, h);
        default:
            return drawLinearFade(ctx, from, to, t, w, h);
    }
}

/*
 * STROBOSCOPE. Aucun melange : a chaque image on montre A ou B en entier, comme
 * l'`overlay=enable` du renderer. Le rapport cyclique CROIT avec la progression -
 * B ne fait d'abord que clignoter, puis finit par occuper presque tout le temps.
 * La formule ne depend que de q, jamais de la duree : l'apercu n'a donc pas
 * besoin de connaitre la cadence pour tomber juste.
 */
export function isStrobeShowingB(q, cycles) {
    const progress = clamp(q, 0, 1);
    return ((progress * cycles) % 1) < progress;
}

function drawStrobeJoin(ctx, from, to, q, effect, w, h) {
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(isStrobeShowingB(q, effect.cycles) ? to : from, 0, 0, w, h);
}

/*
 * REVELATION PAR BLOCS. Le seuil de chaque bloc est une fonction ENTIERE de ses
 * coordonnees - `mod(X*7+Y*11, cells)/cells` - donc identique au bit pres a celle
 * que `geq` evalue sur le masque du renderer. Jamais un tirage aleatoire : deux
 * tirages ne coincideraient pas et la parite serait invendable.
 */
export function gridRevealThreshold(col, row, cells) {
    /*
     * Decale d'un DEMI-CRAN: jamais 0 (un seuil nul revelerait son bloc des q=0,
     * donc avant le debut de la transition) et jamais pile sur une valeur de q
     * echantillonnee (une egalite entre deux flottants calcules par deux moteurs
     * differents ferait basculer un bloc d'un cote et pas de l'autre).
     */
    return (((col * 7 + row * 11) % cells) + 0.5) / cells;
}

function drawGridReveal(ctx, from, to, q, effect, w, h) {
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(from, 0, 0, w, h);
    const cells = effect.cols * effect.rows;
    ctx.save();
    ctx.beginPath();
    let revealed = 0;
    for (let row = 0; row < effect.rows; row += 1) {
        for (let col = 0; col < effect.cols; col += 1) {
            if (gridRevealThreshold(col, row, cells) > q) continue;
            const x0 = Math.round((col * w) / effect.cols);
            const x1 = Math.round(((col + 1) * w) / effect.cols);
            const y0 = Math.round((row * h) / effect.rows);
            const y1 = Math.round(((row + 1) * h) / effect.rows);
            ctx.rect(x0, y0, x1 - x0, y1 - y0);
            revealed += 1;
        }
    }
    if (revealed > 0) {
        ctx.clip();
        ctx.drawImage(to, 0, 0, w, h);
    }
    ctx.restore();
}

/*
 * GLITCH. Coupe FRANCHE au milieu de la fenetre, puis des bandes decalees
 * horizontalement (le `displace` du renderer, dont la carte est generee en
 * 1 x bandes puis agrandie en `neighbor`) et un leger decalage RVB.
 * Le decalage de chaque bande est une formule fixe, jamais un tirage.
 */
export function glitchBandShift(effect, width, curveValue, band) {
    return Math.round(effect.amount * width * curveValue * Math.sin(band * 2.399963 + 11));
}

function drawGlitchJoin(ctx, from, to, qCont, qStep, effect, w, h) {
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(qCont >= 0.5 ? to : from, 0, 0, w, h);
    /*
     * La carte de deplacement est une EXPRESSION `geq` en T, pas une rampe
     * `sendcmd` : sa progression est donc CONTINUE. Le decalage RVB qui suit,
     * lui, est bien rampe par paliers. Confondre les deux decalait les bandes
     * d'un pixel et faisait tripler l'ecart mesure.
     */
    const curve = transitionEffectCurve(effect.curve, qCont, 'a');
    const source = captureFrame(ctx, w, h, 'b3bGlitchSrc');
    if (source) {
        for (let band = 0; band < effect.bands; band += 1) {
            const y0 = Math.round((band * h) / effect.bands);
            const y1 = Math.round(((band + 1) * h) / effect.bands);
            const shift = glitchBandShift(effect, w, curve, band);
            if (shift === 0) continue;
            ctx.clearRect(0, y0, w, y1 - y0);
            ctx.drawImage(source, 0, y0, w, y1 - y0, shift, y0, w, y1 - y0);
            // Bord rabattu, comme `displace=edge=smear`.
            if (shift > 0) ctx.drawImage(source, 0, y0, 1, y1 - y0, 0, y0, shift, y1 - y0);
            if (shift < 0) ctx.drawImage(source, w - 1, y0, 1, y1 - y0, w + shift, y0, -shift, y1 - y0);
        }
    }
    drawChannelShift(ctx, { ...effect, amount: effect.shift }, qStep, w, h);
}

/*
 * FUITE LUMINEUSE. Halo chaud a decroissance LINEAIRE en rayon, ce qui est
 * exactement ce que fait un degrade radial a deux arrets - et exactement ce que
 * le `geq` du renderer ecrit dans le canal alpha. Sa position suit une expression
 * continue, son opacite les paliers de `sendcmd`.
 */
function drawLightLeak(ctx, effect, qCont, qStep, w, h) {
    const alpha = effect.amount * transitionEffectCurve('bell', qStep, 'a');
    if (!(alpha > 0.0005)) return;
    const size = Math.max(2, Math.round(effect.radius * w) * 2);
    const centerX = qCont * (w + size) - size / 2;
    const centerY = 0.35 * h;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size / 2);
    gradient.addColorStop(0, `rgba(255,180,50,${alpha.toFixed(4)})`);
    gradient.addColorStop(1, 'rgba(255,180,50,0)');
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
}

/* Contrepartie de `drawbox=color=white@a` : melange lineaire vers le blanc. */
function drawWhiteVeil(ctx, effect, q, w, h) {
    const alpha = effect.amount * transitionEffectCurve(effect.curve, q, 'a');
    if (!(alpha > 0.0005)) return;
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(4)})`;
    ctx.fillRect(0, 0, w, h);
}

/*
 * Contrepartie de `drawbox` a position exprimee en t : bord net, donc un
 * fillRect suffit et coincide au pixel pres.
 */
function drawEdgeBars(ctx, effect, q, w, h) {
    const barWidth = Math.max(1, Math.round(effect.width * w));
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255,255,255,${Number(effect.amount).toFixed(4)})`;
    if (effect.edges === 2) {
        ctx.fillRect(Math.round(w / 2 - q * w / 2 - barWidth / 2), 0, barWidth, h);
        ctx.fillRect(Math.round(w / 2 + q * w / 2 - barWidth / 2), 0, barWidth, h);
        return;
    }
    ctx.fillRect(Math.round(q * w - barWidth / 2), 0, barWidth, h);
}

/*
 * Contrepartie de `rgbashift=rh=-K:bh=K` : rouge a gauche, bleu a droite, vert
 * immobile, et surtout BORDS RABATTUS (`edge=smear`) - sans quoi l'apercu
 * laisserait deux bandes vides que l'export n'a pas.
 */
function drawChannelShift(ctx, effect, q, w, h) {
    const shift = resolveChannelShift(effect, w, transitionEffectCurve(effect.curve, q, 'a'));
    if (shift === 0) return;
    const source = captureFrame(ctx, w, h, 'b3bShiftSrc');
    if (!source) return;
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    drawChannelCopy(ctx, source, 'red', -shift, 1, w, h);
    drawChannelCopy(ctx, source, 'green', 0, 1, w, h);
    drawChannelCopy(ctx, source, 'blue', shift, 1, w, h);
    ctx.globalCompositeOperation = 'source-over';
}

/*
 * Aberration RADIALE, pas une translation : le rouge est AGRANDI par rapport au
 * vert et au bleu, donc la frange nait sur les bords et le centre reste propre.
 * C'est ce qui la distingue de `rgb-split`, qui decale les trois couches en bloc
 * sur tout le cadre.
 */
function drawChromaticFringe(ctx, effect, q, w, h) {
    const spread = effect.amount * transitionEffectCurve(effect.curve, q, 'a');
    if (!(spread > 0.0005)) return;
    const source = captureFrame(ctx, w, h, 'b3bShiftSrc');
    if (!source) return;
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    drawChannelCopy(ctx, source, 'green', 0, 1, w, h);
    drawChannelCopy(ctx, source, 'blue', 0, 1, w, h);
    drawChannelCopy(ctx, source, 'red', 0, 1 + spread, w, h);
    ctx.globalCompositeOperation = 'source-over';
}

/* Une couche de couleur isolee, decalee et/ou mise a l'echelle autour du centre. */
function drawChannelCopy(ctx, source, channel, shift, scale, w, h) {
    const isolated = getScratchCanvas(w, h, `b3bChannel${channel}`);
    if (!isolated) return;
    const layer = isolated.ctx;
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.filter = 'none';
    layer.globalAlpha = 1;
    layer.globalCompositeOperation = 'source-over';
    layer.clearRect(0, 0, w, h);
    layer.drawImage(source, 0, 0, w, h);
    layer.globalCompositeOperation = 'multiply';
    layer.fillStyle = channel === 'red' ? '#ff0000' : channel === 'green' ? '#00ff00' : '#0000ff';
    layer.fillRect(0, 0, w, h);
    layer.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(w / 2 + shift, h / 2);
    ctx.scale(scale, scale);
    ctx.drawImage(isolated.canvas, -w / 2, -h / 2, w, h);
    ctx.restore();
    /*
     * BORD RABATTU. `rgbashift` prolonge la colonne de bord (`edge=smear`, son
     * defaut) ; un canvas laisserait une bande VIDE de la largeur du decalage,
     * soit jusqu'a 35 px en 1080p. On etire la colonne a la main. Inutile quand
     * la couche est AGRANDIE (chromatic) : il n'y a alors aucune zone decouverte.
     */
    if (shift > 0) ctx.drawImage(isolated.canvas, 0, 0, 1, h, 0, 0, shift, h);
    if (shift < 0) ctx.drawImage(isolated.canvas, w - 1, 0, 1, h, w + shift, 0, -shift, h);
}

/* Copie de l'image deja composee, pour pouvoir la redessiner autrement. */
function captureFrame(ctx, w, h, slot) {
    const frame = getScratchCanvas(w, h, slot);
    if (!frame) return null;
    const inner = frame.ctx;
    inner.setTransform(1, 0, 0, 1, 0, 0);
    inner.filter = 'none';
    inner.globalAlpha = 1;
    inner.globalCompositeOperation = 'source-over';
    inner.clearRect(0, 0, w, h);
    inner.drawImage(ctx.canvas, 0, 0, w, h);
    return frame.canvas;
}

/* Le MEME entier que resolveChannelShift de render-service/src/server.js. */
export function resolveChannelShift(effect, width, curveValue) {
    return Math.round(effect.amount * width * curveValue);
}

/*
 * Contrepartie exacte de `zoompan` : une fenetre de largeur w/zoom, centree,
 * decalee de pan x (zoom - 1) / 2 en coordonnees d'ENTREE. Le decalage est donc
 * borne par construction (probleme I), et la fenetre ne peut pas sortir du cadre.
 */
function drawZoomJoin(ctx, from, to, t, q, effect, w, h) {
    drawZoomedFrame(ctx, from, effect, 'a', q, w, h, 1);
    drawZoomedFrame(ctx, to, effect, 'b', q, w, h, t);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
}

function drawZoomedFrame(ctx, source, effect, side, q, w, h, alpha) {
    const zoom = 1 + effect.amount * transitionEffectCurve(effect.curve, q, side);
    const pan = Number(effect.pan || 0) * (side === 'b' ? 1 : -1) * (zoom - 1) / 2;
    const centerX = w / 2 - pan * w / zoom;
    ctx.save();
    ctx.filter = 'none';
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-centerX, -h / 2);
    ctx.drawImage(source, 0, 0, w, h);
    ctx.restore();
}

/*
 * `gblur` sur la queue de A et sur la tete de B, puis `xfade=fade`. Le poids du
 * fondu reste la progression CONTINUE (c'est `xfade` qui melange, et lui n'est
 * pas quantifie) ; seule l'intensite du flou suit les paliers.
 */
function drawBlurJoin(ctx, from, to, t, q, effect, w, h) {
    const sigma = effect.amount * w;
    drawGaussianBlurred(ctx, from, sigma * transitionEffectCurve(effect.curve, q, 'a'), w, h, 1);
    drawGaussianBlurred(ctx, to, sigma * transitionEffectCurve(effect.curve, q, 'b'), w, h, t);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
}

/*
 * `avgblur=sizeX=N:sizeY=0` : une moyenne de BOITE sur 2N+1 pixels horizontaux,
 * pas un flou gaussien. C'est ce qui distingue `motion-blur` de `cross-blur` -
 * une trainee directionnelle contre un flou isotrope - et c'est reproduit ici
 * aux memes decalages ENTIERS, pas approche par un `blur()` du navigateur.
 */
function drawMotionBlurJoin(ctx, from, to, t, q, effect, w, h) {
    drawBoxBlurred(ctx, from, resolveBoxBlurSize(effect, w, transitionEffectCurve(effect.curve, q, 'a')), w, h, 1);
    drawBoxBlurred(ctx, to, resolveBoxBlurSize(effect, w, transitionEffectCurve(effect.curve, q, 'b')), w, h, t);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
}

/*
 * Doit rendre le MEME entier que `resolveBoxBlurSize` de
 * render-service/src/server.js : deux arrondis differents feraient porter les
 * deux moyennes sur deux largeurs differentes.
 */
export function resolveBoxBlurSize(effect, width, curveValue) {
    return Math.max(1, Math.round(effect.amount * width * curveValue));
}

/*
 * PIEGE STRUCTUREL, corrige ici (fait etabli le 2026-08-02) : FFmpeg echantillonne
 * HORS CADRE en RABATTANT SUR LE BORD, le canvas en prenant du transparent. Un
 * `ctx.filter = blur()` applique tel quel delave donc les quatre bords de
 * l'image, sur une bande de ~3 sigma - jusqu'a 25 px de chaque cote pour
 * `cross-blur`. On reconstruit d'abord une image bordee par etirement du bord,
 * puis on la floute : ce que fait FFmpeg.
 */
function drawGaussianBlurred(ctx, source, sigma, w, h, alpha) {
    if (!(sigma > 0.05)) {
        ctx.filter = 'none';
        ctx.globalAlpha = alpha;
        ctx.drawImage(source, 0, 0, w, h);
        return;
    }
    const margin = Math.ceil(sigma * 3) + 1;
    const padded = buildEdgeClampedFrame(source, w, h, margin);
    ctx.filter = `blur(${sigma.toFixed(3)}px)`;
    ctx.globalAlpha = alpha;
    if (!padded) {
        ctx.drawImage(source, 0, 0, w, h);
        return;
    }
    ctx.drawImage(padded, -margin, -margin);
}

/*
 * Moyenne de boite horizontale, decalages entiers, bord rabattu comme `avgblur`.
 * Au-dela de MAX_BOX_TAPS points on echantillonne la MEME boite plus grossierement
 * plutot que d'ouvrir des centaines de dessins par image : la moyenne reste celle
 * de la meme largeur, seul le grain haute frequence differe. A la taille du banc
 * d'essai de parite (320 px) la boite est prise en entier.
 */
const MAX_BOX_TAPS = 33;

function drawBoxBlurred(ctx, source, size, w, h, alpha) {
    const taps = Math.min(MAX_BOX_TAPS, size * 2 + 1);
    const accumulator = getScratchCanvas(w, h, 'b3bBox');
    const padded = buildEdgeClampedFrame(source, w, h, size);
    if (!accumulator || !padded || taps <= 1) {
        ctx.filter = 'none';
        ctx.globalAlpha = alpha;
        ctx.drawImage(source, 0, 0, w, h);
        return;
    }
    const target = accumulator.ctx;
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.filter = 'none';
    target.globalCompositeOperation = 'source-over';
    target.globalAlpha = 1;
    target.clearRect(0, 0, w, h);
    // Fond noir opaque: 'lighter' ADDITIONNE, il lui faut une base definie.
    target.fillStyle = '#000';
    target.fillRect(0, 0, w, h);
    target.globalCompositeOperation = 'lighter';
    target.globalAlpha = 1 / taps;
    for (let tap = 0; tap < taps; tap += 1) {
        const offset = Math.round(-size + (tap * 2 * size) / (taps - 1));
        target.drawImage(padded, offset - size, -size);
    }
    target.globalCompositeOperation = 'source-over';
    target.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.globalAlpha = alpha;
    ctx.drawImage(accumulator.canvas, 0, 0, w, h);
}

/*
 * Image mise a l'echelle w x h, entouree d'une marge remplie par ETIREMENT des
 * bords - quatre cotes et quatre coins. Deux etapes plutot qu'une parce que la
 * taille intrinseque de la source (video, image, canvas) n'est pas forcement
 * w x h : on la normalise d'abord, ensuite les coordonnees sont connues.
 */
function buildEdgeClampedFrame(source, w, h, margin) {
    const frame = getScratchCanvas(w, h, 'b3bFrame');
    const padded = getScratchCanvas(w + margin * 2, h + margin * 2, 'b3bPad');
    if (!frame || !padded) return null;
    const inner = frame.ctx;
    inner.setTransform(1, 0, 0, 1, 0, 0);
    inner.filter = 'none';
    inner.globalAlpha = 1;
    inner.globalCompositeOperation = 'source-over';
    inner.clearRect(0, 0, w, h);
    inner.drawImage(source, 0, 0, w, h);

    const out = padded.ctx;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.filter = 'none';
    out.globalAlpha = 1;
    out.globalCompositeOperation = 'source-over';
    out.clearRect(0, 0, w + margin * 2, h + margin * 2);
    out.drawImage(frame.canvas, margin, margin);
    out.drawImage(frame.canvas, 0, 0, 1, h, 0, margin, margin, h);
    out.drawImage(frame.canvas, w - 1, 0, 1, h, margin + w, margin, margin, h);
    out.drawImage(frame.canvas, 0, 0, w, 1, margin, 0, w, margin);
    out.drawImage(frame.canvas, 0, h - 1, w, 1, margin, margin + h, w, margin);
    out.drawImage(frame.canvas, 0, 0, 1, 1, 0, 0, margin, margin);
    out.drawImage(frame.canvas, w - 1, 0, 1, 1, margin + w, 0, margin, margin);
    out.drawImage(frame.canvas, 0, h - 1, 1, 1, 0, margin + h, margin, margin);
    out.drawImage(frame.canvas, w - 1, h - 1, 1, 1, margin + w, margin + h, margin, margin);
    return padded.canvas;
}

/* ---------- fondus ---------- */

function drawLinearFade(ctx, from, to, t, w, h) {
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    ctx.globalAlpha = t;
    ctx.drawImage(to, 0, 0, w, h);
    ctx.globalAlpha = 1;
}

/*
 * Les deux poids ne se recouvrent quasiment pas (le sortant est nul des t=0,2,
 * l'entrant negligeable avant) : empiler les deux dessins sur l'aplat de couleur
 * suffit, sans avoir a composer les poids a la main.
 */
function drawColorFade(ctx, from, to, t, w, h, rgb) {
    const weightFrom = sampleCurve(COLOR_FADE_FROM, t);
    const weightTo = sampleCurve(COLOR_FADE_TO, t);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.fillRect(0, 0, w, h);
    if (weightFrom > 0.002) {
        ctx.globalAlpha = weightFrom;
        ctx.drawImage(from, 0, 0, w, h);
    }
    if (weightTo > 0.002) {
        ctx.globalAlpha = weightTo;
        ctx.drawImage(to, 0, 0, w, h);
    }
    ctx.globalAlpha = 1;
}

/*
 * Melange lineaire (luminance mesuree lineaire) mais les deux images perdent puis
 * retrouvent leur couleur: A est grise des t≈0,2, B reste grise jusqu'a t≈0,25
 * puis se recolore progressivement.
 */
function drawGrayFade(ctx, from, to, t, w, h) {
    const colorFrom = smoothstep(0.8, 1, 1 - t);
    const colorTo = sampleCurve(GRAY_RECOLOR_TO, t);
    ctx.globalAlpha = 1;
    ctx.filter = `grayscale(${(1 - colorFrom).toFixed(3)})`;
    ctx.drawImage(from, 0, 0, w, h);
    ctx.globalAlpha = t;
    ctx.filter = `grayscale(${(1 - colorTo).toFixed(3)})`;
    ctx.drawImage(to, 0, 0, w, h);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
}

/*
 * FFmpeg tire un bruit par pixel: non reproductible a l'identique. On approche
 * avec des masques binaires pre-calcules, dont la densite suit la progression.
 * Le grain est fige d'une lecture a l'autre, ce qui est preferable ici: un bruit
 * different a chaque image ferait scintiller l'apercu.
 */
function drawDissolve(ctx, from, to, t, w, h) {
    const masks = getDissolveMasks();
    const index = Math.round(clamp(t, 0, 1) * (masks.length - 1));
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    const layer = getScratchCanvas(w, h);
    if (!layer) return drawLinearFade(ctx, from, to, t, w, h);
    const layerCtx = layer.ctx;
    layerCtx.globalCompositeOperation = 'source-over';
    layerCtx.clearRect(0, 0, w, h);
    layerCtx.drawImage(to, 0, 0, w, h);
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.imageSmoothingEnabled = false;
    layerCtx.drawImage(masks[index], 0, 0, w, h);
    layerCtx.imageSmoothingEnabled = true;
    layerCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer.canvas, 0, 0);
    return undefined;
}

/* ---------- geometrie ---------- */

/*
 * Balayages a bord adouci, sur SOFT_EDGE de la dimension balayee.
 *
 * `smoothleft` devoile l'image entrante depuis le bord DROIT, le bord du
 * balayage progressant vers la gauche ; `smoothright` est son miroir.
 * `smoothup` / `smoothdown` sont les MEMES deux formules sur l'axe vertical -
 * verifie le 2026-08-02 en sondant le rendu FFmpeg : a t=0,25 `smoothup` fait
 * apparaitre l'entrante par le BAS, `smoothdown` par le HAUT, exactement comme
 * `smoothleft` par la droite et `smoothright` par la gauche.
 */
function drawSoftWipe(ctx, from, to, t, w, h, direction) {
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    const reveal = t * (1 + SOFT_EDGE);
    const towardsStart = direction === 'left' || direction === 'up';
    const stops = towardsStart
        ? [[1 - reveal, 0], [1 - reveal + SOFT_EDGE, 1]]
        : [[reveal - SOFT_EDGE, 1], [reveal, 0]];
    const axis = (direction === 'left' || direction === 'right') ? 'x' : 'y';
    paintMasked(ctx, to, w, h, makeAxisMask(ctx, w, h, axis, stops));
}

/* `slide*`: l'image entrante pousse la sortante hors cadre. */
function drawSlide(ctx, from, to, t, w, h, direction) {
    const vertical = direction === 'up' || direction === 'down';
    const span = vertical ? h : w;
    const offset = Math.round(t * span);
    // `up` et `left` chassent la sortante vers les valeurs decroissantes.
    const back = direction === 'up' || direction === 'left' ? -offset : offset;
    const front = back + (back < 0 ? span : -span);
    ctx.globalAlpha = 1;
    if (vertical) {
        ctx.drawImage(from, 0, back, w, h);
        ctx.drawImage(to, 0, front, w, h);
    } else {
        ctx.drawImage(from, back, 0, w, h);
        ctx.drawImage(to, front, 0, w, h);
    }
}

/*
 * `wipe*`: bord net. `left` devoile l'entrante depuis la droite (le bord recule
 * vers la gauche), `right` depuis la gauche, `up` depuis le bas, `down` depuis
 * le haut - les quatre sens releves sur le rendu FFmpeg le 2026-08-02.
 */
function drawHardWipe(ctx, from, to, t, w, h, direction) {
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    const vertical = direction === 'up' || direction === 'down';
    const span = vertical ? h : w;
    // `left` et `up`: l'entrante occupe la fin de l'axe, la coupe recule.
    const fromEnd = direction === 'left' || direction === 'up';
    const edge = Math.round((fromEnd ? 1 - t : t) * span);
    const start = fromEnd ? edge : 0;
    const size = fromEnd ? span - edge : edge;
    if (size <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(vertical ? 0 : start, vertical ? start : 0, vertical ? w : size, vertical ? size : h);
    ctx.clip();
    ctx.drawImage(to, 0, 0, w, h);
    ctx.restore();
}

/*
 * Volets sur un axe. Quatre cibles pour une seule routine :
 *   vertopen / vertclose  -> axe X (les volets bougent horizontalement)
 *   horzopen / horzclose  -> axe Y
 * `open` fait naitre l'entrante sur l'axe CENTRAL et l'etend vers les deux
 * bords ; `close` la fait entrer par les DEUX BORDS vers le centre. Les quatre
 * sens ont ete sondes sur le rendu FFmpeg avant d'ecrire ces bornes.
 */
function drawAxisBars(ctx, from, to, t, w, h, axis, mode) {
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    const edge = VERTICAL_SOFT_EDGE;
    let stops;
    if (mode === 'open') {
        // L'ouverture doit etre totale a t=1, bord adouci compris: d'ou le depassement.
        const inner = 0.5 - t * (0.5 + edge);
        stops = [[inner, 0], [inner + edge, 1], [1 - inner - edge, 1], [1 - inner, 0]];
    } else {
        const band = t * (0.5 + edge);
        stops = [[band - edge, 1], [band, 0], [1 - band, 0], [1 - band + edge, 1]];
    }
    paintMasked(ctx, to, w, h, makeAxisMask(ctx, w, h, axis, stops));
}

/*
 * `circlecrop` / `rectcrop`: le plan sortant se retracte vers le centre jusqu'a
 * disparaitre a mi-parcours, sur du NOIR, puis le plan entrant grandit depuis le
 * centre. Ce n'est pas un fondu: c'est un rognage, le contenu ne bouge pas.
 * Voir CIRCLE_CROP_EXPONENT pour la courbe de rayon, relevee et non devinee.
 */
function drawCrop(ctx, from, to, t, w, h, shape) {
    const z = Math.abs(1 - 2 * t);
    const source = t < 0.5 ? from : to;
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (z <= 0) return;
    ctx.save();
    ctx.beginPath();
    if (shape === 'circle') {
        const radius = (z ** CIRCLE_CROP_EXPONENT) * Math.hypot(w / 2, h / 2);
        ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    } else {
        ctx.rect((w - w * z) / 2, (h - h * z) / 2, w * z, h * z);
    }
    ctx.clip();
    ctx.drawImage(source, 0, 0, w, h);
    ctx.restore();
}

/*
 * `squeezeh` / `squeezev`: le plan sortant est COMPRIME (mis a l'echelle, pas
 * rogne - verifie en comptant les bandes de couleur du plan source dans le
 * resultat) vers une ligne centrale, sur le plan entrant deja affiche en plein
 * cadre. `squeezeh` ecrase la HAUTEUR, `squeezev` la LARGEUR. L'echelle est
 * lineaire en 1 - t, relevee a 21 instants.
 */
function drawSqueeze(ctx, from, to, t, w, h, axis) {
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.drawImage(to, 0, 0, w, h);
    const scale = 1 - t;
    if (scale <= 0) return;
    if (axis === 'h') {
        const height = h * scale;
        ctx.drawImage(from, 0, (h - height) / 2, w, height);
    } else {
        const width = w * scale;
        ctx.drawImage(from, (w - width) / 2, 0, width, h);
    }
}

/* `circleopen` / `circleclose`: iris circulaire a bord adouci. */
function drawCircle(ctx, from, to, t, w, h, mode) {
    ctx.globalAlpha = 1;
    ctx.drawImage(from, 0, 0, w, h);
    const maxRadius = Math.hypot(w, h) / 2;
    const radial = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, maxRadius);
    if (mode === 'open') {
        const edge = t * (1 + CIRCLE_SOFT_EDGE);
        radial.addColorStop(0, 'rgba(255,255,255,1)');
        radial.addColorStop(clamp(edge - CIRCLE_SOFT_EDGE, 0, 0.999), 'rgba(255,255,255,1)');
        radial.addColorStop(clamp(edge, 0.001, 1), 'rgba(255,255,255,0)');
        radial.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
        const edge = 1 - t * (1 + CIRCLE_SOFT_EDGE);
        radial.addColorStop(0, 'rgba(255,255,255,0)');
        radial.addColorStop(clamp(edge, 0, 0.999), 'rgba(255,255,255,0)');
        radial.addColorStop(clamp(edge + CIRCLE_SOFT_EDGE, 0.001, 1), 'rgba(255,255,255,1)');
        radial.addColorStop(1, 'rgba(255,255,255,1)');
    }
    paintMasked(ctx, to, w, h, radial);
}

/* `pixelize`: les deux images se pixellisent vers le milieu du fondu. */
function drawPixelize(ctx, from, to, t, w, h) {
    const strength = Math.min(t, 1 - t) * 2;
    const blocks = Math.max(1, Math.round(1 + strength * 48));
    const smallW = Math.max(1, Math.round(w / blocks));
    const smallH = Math.max(1, Math.round(h / blocks));
    const layer = getScratchCanvas(smallW, smallH, 'blocks');
    if (!layer) return drawLinearFade(ctx, from, to, t, w, h);
    const layerCtx = layer.ctx;
    layerCtx.globalCompositeOperation = 'source-over';
    layerCtx.globalAlpha = 1;
    layerCtx.clearRect(0, 0, smallW, smallH);
    layerCtx.drawImage(from, 0, 0, smallW, smallH);
    layerCtx.globalAlpha = t;
    layerCtx.drawImage(to, 0, 0, smallW, smallH);
    layerCtx.globalAlpha = 1;
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layer.canvas, 0, 0, smallW, smallH, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    return undefined;
}

/* `hblur`: flou horizontal qui monte puis redescend pendant le melange. */
function drawHorizontalBlur(ctx, from, to, t, w, h) {
    const strength = Math.min(t, 1 - t) * 2;
    const radius = strength * Math.max(2, w * 0.02);
    ctx.globalAlpha = 1;
    ctx.filter = radius > 0.5 ? `blur(${radius.toFixed(2)}px)` : 'none';
    ctx.drawImage(from, 0, 0, w, h);
    ctx.globalAlpha = t;
    ctx.drawImage(to, 0, 0, w, h);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
}

/* ---------- utilitaires ---------- */

function paintMasked(ctx, source, w, h, mask) {
    const layer = getScratchCanvas(w, h);
    if (!layer) {
        ctx.globalAlpha = 1;
        ctx.drawImage(source, 0, 0, w, h);
        return;
    }
    const layerCtx = layer.ctx;
    layerCtx.globalCompositeOperation = 'source-over';
    layerCtx.globalAlpha = 1;
    layerCtx.filter = 'none';
    layerCtx.clearRect(0, 0, w, h);
    layerCtx.drawImage(source, 0, 0, w, h);
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.fillStyle = mask;
    layerCtx.fillRect(0, 0, w, h);
    layerCtx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(layer.canvas, 0, 0);
}

/*
 * Masque le long d'un axe: 'x' de gauche a droite, 'y' de haut en bas. Les
 * offsets sont donnes en fraction de la dimension balayee et peuvent deborder de
 * [0,1] (le balayage depasse volontairement le cadre pour que le bord adouci
 * sorte de l'image) : ils sont ramenes dans les bornes, et l'ordre croissant est
 * garanti en decalant chaque arret sur le precedent.
 */
function makeAxisMask(ctx, w, h, axis, stops) {
    const gradient = axis === 'y'
        ? ctx.createLinearGradient(0, 0, 0, h)
        : ctx.createLinearGradient(0, 0, w, 0);
    let lastOffset = -1;
    stops.forEach(([offset, alpha]) => {
        const position = Math.max(clamp(offset, 0, 1), lastOffset);
        lastOffset = position;
        gradient.addColorStop(position, `rgba(255,255,255,${alpha})`);
    });
    return gradient;
}

function getScratchCanvas(w, h, slot = 'mask') {
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    const current = scratchCanvases[slot];
    if (current && current.canvas.width === width && current.canvas.height === height) return current;
    const canvas = createCanvas(width, height);
    if (!canvas) return null;
    const context = canvas.getContext('2d');
    if (!context) return null;
    scratchCanvases[slot] = { canvas, ctx: context };
    return scratchCanvases[slot];
}

function getDissolveMasks() {
    if (dissolveMasks) return dissolveMasks;
    const size = DISSOLVE_MASK_SIZE;
    const noise = new Float32Array(size * size);
    // Bruit deterministe: le grain doit etre le meme d'une lecture a l'autre.
    let seed = 0x9e3779b9;
    for (let i = 0; i < noise.length; i += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        noise[i] = seed / 0xffffffff;
    }
    dissolveMasks = [];
    for (let step = 0; step < DISSOLVE_STEPS; step += 1) {
        const threshold = step / (DISSOLVE_STEPS - 1);
        const canvas = createCanvas(size, size);
        if (!canvas) {
            dissolveMasks = [];
            return [];
        }
        const context = canvas.getContext('2d');
        const image = context.createImageData(size, size);
        for (let i = 0; i < noise.length; i += 1) {
            const opaque = noise[i] < threshold;
            image.data[i * 4] = 255;
            image.data[i * 4 + 1] = 255;
            image.data[i * 4 + 2] = 255;
            image.data[i * 4 + 3] = opaque ? 255 : 0;
        }
        context.putImageData(image, 0, 0);
        dissolveMasks.push(canvas);
    }
    return dissolveMasks;
}

function createCanvas(width, height) {
    if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

/* Lecture d'une courbe mesuree, echantillonnee a pas constant sur [0,1]. */
function sampleCurve(curve, t) {
    const position = clamp(t, 0, 1) * (curve.length - 1);
    const index = Math.min(curve.length - 2, Math.floor(position));
    const fraction = position - index;
    return curve[index] + (curve[index + 1] - curve[index]) * fraction;
}

function smoothstep(edge0, edge1, x) {
    const value = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return value * value * (3 - 2 * value);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
