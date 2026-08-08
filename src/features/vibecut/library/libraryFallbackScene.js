/*
 * LES QUATRE SCENES DESSINEES DU REPLI DES BIBLIOTHEQUES.
 *
 * Extrait de `useLibraryImages.js` au lot B2, sans changer un pixel : ce fichier
 * est maintenant lu par DEUX appelants, et c'est tout l'interet de l'extraction.
 *
 *  1. `useLibraryMedia.js` - le repli affiche quand il n'y a ni video ni photo ;
 *  2. `scripts/build-vibecut-library-demo-clips.mjs` - qui rejoue exactement ces
 *     memes scenes dans un Chromium sans fenetre pour en encoder des clips.
 *
 * Les clips de demonstration ont donc, par construction, l'aspect exact du
 * repli. Recopier le dessin dans le script aurait garanti l'inverse : deux
 * dessins qui divergent a la premiere retouche.
 *
 * AUCUN IMPORT, aucun `window` au chargement : le script doit pouvoir injecter
 * ce module tel quel dans une page vierge.
 */

export const FALLBACK_WIDTH = 640;
export const FALLBACK_HEIGHT = 400;

/*
 * Deux exigences, et la seconde a ete sous-estimee au premier jet:
 *
 *  1. Elles doivent etre FRANCHEMENT differentes (un couchant chaud, une nuit
 *     froide): une transition entre deux images qui se ressemblent ne se voit
 *     pas.
 *  2. Elles doivent avoir du DETAIL. Un degrade lisse zoome a 116 % reste le
 *     meme degrade: sur un aplat, la moitie des mouvements et des transitions
 *     ne montrent litteralement RIEN. D'ou les plans superposes, l'horizon,
 *     les reflets et le grain - ce sont eux qui rendent le mouvement lisible.
 */
export const FALLBACK_SCENES = [
    {
        sky: ['#fbd8a0', '#f0996a', '#c9505c'],
        ridges: ['#8a4a63', '#5d2f4c', '#33203a'],
        water: ['#e7a173', '#7b3f57'],
        disc: '#fff6dd',
        discGlow: 'rgba(255, 236, 190, 0.55)',
        discX: 0.66,
        discY: 0.42,
        horizon: 0.62,
        stars: 0,
    },
    {
        sky: ['#1b2a55', '#16203c', '#080c18'],
        ridges: ['#1d2846', '#121a30', '#070a14'],
        water: ['#26365f', '#0a0f1d'],
        disc: '#dce6ff',
        discGlow: 'rgba(200, 216, 255, 0.35)',
        discX: 0.3,
        discY: 0.24,
        horizon: 0.58,
        stars: 90,
    },
    /*
     * DEUX SCENES DE PLUS (2026-08-04), portant le lot a QUATRE clips comme son
     * plan le prevoyait.
     *
     * Ce qui les distingue n'est PAS seulement la palette. Deux clips qui ne
     * different que par leur teinte se comportent pareil sous une transition ou
     * un mouvement, donc ils n'ajoutent rien a ce que la bibliotheque donne a
     * juger. Chacune fait donc varier une propriete de STRUCTURE :
     *
     *  - `aube` remonte l'horizon a 0,74 : l'eau occupe les trois quarts du
     *    cadre, donc un mouvement vertical y traverse surtout du reflet, la ou
     *    les deux premieres traversent surtout du relief.
     *  - `orage` le descend a 0,44 avec un astre voile en haut a droite : le
     *    ciel domine, et c'est le seul des quatre ou le point le plus clair de
     *    l'image est dans un COIN. Un balayage ou un volet s'y lit tout
     *    autrement que sur un astre centre.
     *
     * En clair : le contraste et le detail sont conserves (voir les deux
     * exigences ci-dessus), et la composition change.
     */
    {
        // Aube claire et froide - l'oppose exact du couchant, qui est le plus
        // chaud et le plus sature des quatre.
        sky: ['#dfeae4', '#b8cfd2', '#8fa8bd'],
        ridges: ['#8fa3ab', '#63798a', '#3d4d61'],
        water: ['#c3d5d6', '#6b8496'],
        disc: '#fffdf4',
        discGlow: 'rgba(255, 252, 232, 0.5)',
        discX: 0.22,
        discY: 0.55,
        horizon: 0.74,
        stars: 0,
    },
    {
        // Orage : gris-violet dense. Distinct de `nuit` par sa CLARTE (elle est
        // sombre, celui-ci est mat) autant que par sa composition.
        sky: ['#6d6480', '#4a4358', '#2b2735'],
        ridges: ['#3b3547', '#292435', '#151220'],
        water: ['#4c465c', '#1a1724'],
        disc: '#cfc6de',
        discGlow: 'rgba(190, 180, 210, 0.4)',
        discX: 0.82,
        discY: 0.18,
        horizon: 0.44,
        stars: 0,
    },
];

/*
 * Une graine PAR SCENE. Le ternaire d'origine ne distinguait que 0 et 1, donc
 * les scenes 2 et 3 auraient rejoue exactement le relief, les reflets et le
 * grain de la scene 1 - quatre clips dont deux paires jumelles sous la peinture.
 */
const FALLBACK_SEEDS = [20260802, 19980417, 20260804, 17760704];

/* Suite deterministe: deux sessions doivent donner exactement la meme image,
 * sinon les tests de parite compareraient deux ciels differents - et deux
 * generations du meme clip de demonstration donneraient deux fichiers. */
function seeded(seed) {
    let value = seed;
    return () => {
        value = (value * 1664525 + 1013904223) % 4294967296;
        return value / 4294967296;
    };
}

function verticalGradient(ctx, stops, top, bottom) {
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    stops.forEach((color, index) => gradient.addColorStop(index / (stops.length - 1), color));
    return gradient;
}

function drawRidge(ctx, random, baseline, amplitude, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, FALLBACK_HEIGHT);
    ctx.lineTo(0, baseline);
    // Une crete en dents irregulieres: c'est ce relief qui rend un panoramique
    // ou un balayage lisible. Une ligne droite ne bougerait visiblement pas.
    for (let step = 0; step <= 8; step += 1) {
        const x = (FALLBACK_WIDTH / 8) * step;
        const y = baseline - amplitude * (0.35 + random() * 0.65);
        ctx.lineTo(x, y);
    }
    ctx.lineTo(FALLBACK_WIDTH, FALLBACK_HEIGHT);
    ctx.closePath();
    ctx.fill();
}

/**
 * Dessine la scene `index` dans `ctx`, en 640x400.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} index 0 = couchant, 1 = nuit, 2 = aube, 3 = orage
 */
export function paintFallbackScene(ctx, index) {
    const scene = FALLBACK_SCENES[index % FALLBACK_SCENES.length];
    const random = seeded(FALLBACK_SEEDS[index % FALLBACK_SEEDS.length]);
    const horizon = FALLBACK_HEIGHT * scene.horizon;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    // Ciel
    ctx.fillStyle = verticalGradient(ctx, scene.sky, 0, horizon);
    ctx.fillRect(0, 0, FALLBACK_WIDTH, horizon);

    // Etoiles (nuit seulement)
    ctx.fillStyle = '#ffffff';
    for (let star = 0; star < scene.stars; star += 1) {
        const x = random() * FALLBACK_WIDTH;
        const y = random() * horizon * 0.85;
        ctx.globalAlpha = 0.25 + random() * 0.6;
        ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // Halo puis astre
    const cx = FALLBACK_WIDTH * scene.discX;
    const cy = FALLBACK_HEIGHT * scene.discY;
    const radius = FALLBACK_HEIGHT * 0.11;
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 4);
    glow.addColorStop(0, scene.discGlow);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, FALLBACK_WIDTH, horizon);
    ctx.fillStyle = scene.disc;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Eau, avec le reflet de l'astre: un repere vertical franc, donc un
    // mouvement de camera vertical devient lisible.
    ctx.fillStyle = verticalGradient(ctx, scene.water, horizon, FALLBACK_HEIGHT);
    ctx.fillRect(0, horizon, FALLBACK_WIDTH, FALLBACK_HEIGHT - horizon);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = scene.disc;
    for (let band = 0; band < 14; band += 1) {
        const y = horizon + band * ((FALLBACK_HEIGHT - horizon) / 14);
        const width = radius * (2.1 - band * 0.11) * (0.6 + random() * 0.7);
        ctx.fillRect(cx - width / 2, y, width, 2);
    }
    ctx.globalAlpha = 1;

    // Trois plans de relief, du plus lointain au plus proche.
    drawRidge(ctx, random, horizon + 2, FALLBACK_HEIGHT * 0.16, scene.ridges[0]);
    drawRidge(ctx, random, horizon + FALLBACK_HEIGHT * 0.1, FALLBACK_HEIGHT * 0.13, scene.ridges[1]);
    drawRidge(ctx, random, FALLBACK_HEIGHT * 0.94, FALLBACK_HEIGHT * 0.1, scene.ridges[2]);

    // Grain fin: casse les aplats, et rend visible un zoom leger.
    ctx.globalAlpha = 0.05;
    for (let dot = 0; dot < 2200; dot += 1) {
        ctx.fillStyle = random() > 0.5 ? '#ffffff' : '#000000';
        ctx.fillRect(random() * FALLBACK_WIDTH, random() * FALLBACK_HEIGHT, 1, 1);
    }
    ctx.globalAlpha = 1;
}

/**
 * Le mouvement pose sur la scene pour en faire un CLIP.
 *
 * Il est ecrit ici, et pas dans le script, pour la meme raison que le dessin :
 * il doit rester reproductible et relisible. Une derive lente en diagonale plus
 * un leger rapprochement - assez pour que l'oeil voie que ca vit, assez peu pour
 * qu'on juge la TRANSITION et pas le mouvement de fond.
 *
 * `phase` va de 0 a 1 sur la boucle. Un aller-retour (triangle) plutot qu'une
 * rampe : un clip qui boucle doit revenir a son point de depart, sinon la
 * couture se voit a chaque tour.
 */
export function fallbackClipTransform(phase, index) {
    const triangle = 1 - Math.abs(2 * (phase % 1) - 1);
    // Une scene sur deux derive dans l'autre sens: quatre clips qui glissent tous
    // du meme cote donneraient l'impression d'une seule prise recoloriee.
    const direction = index % 2 === 0 ? 1 : -1;
    const zoom = 1.06 + 0.05 * triangle;
    return {
        zoom,
        // Borne a (zoom-1)/2 comme tout mouvement du produit (probleme I):
        // la fenetre ne sort jamais du cadre.
        offsetX: direction * (zoom - 1) * 0.5 * (triangle - 0.5) * 2 * 0.8,
        offsetY: (zoom - 1) * 0.5 * (0.5 - triangle) * 2 * 0.5,
    };
}
