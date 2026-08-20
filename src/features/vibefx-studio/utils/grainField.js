/*
 * LE CHAMP DE GRAIN — sa force, et sa GROSSEUR.
 *
 * Ce module ne dessine rien. Il porte la loi du grain, et seulement elle, pour
 * que le moteur (`canvasUtils.applyFilmGrain`) et les scripts de mesure lisent
 * exactement le meme code. Il n'importe rien: c'est ce qui permet a Node de le
 * charger tel quel, sans que la mesure ait a RECOPIER le rendu — une copie qui
 * derive est une mesure qui ment.
 *
 * ── CE QUI ETAIT DEJA JUSTE ──────────────────────────────────────────────
 *
 * La FORCE. Mesure du 2026-08-15 sur la mire A (24 aplats unis, 1620x1080):
 * l'ecart-type du grain de Lightroom vaut 0,367 x la valeur du curseur, a 15,
 * 50 et 100, du noir au blanc. Revérifié le 2026-08-20: x1,00 sur les gris.
 *
 * ── CE QUI MANQUAIT, ET QUI SE VOYAIT ────────────────────────────────────
 *
 * Notre grain etait tire PIXEL PAR PIXEL: il faisait 1 pixel, toujours. Celui
 * de Lightroom, non. Deux choses le font grossir, et aucune n'etait branchee.
 *
 * 1. SON SOUS-REGLAGE « TAILLE » (25 par defaut, 40 sur CN17).
 * 2. LA TAILLE DE L'IMAGE. C'est le plus surprenant, et le plus visible: a
 *    reglage identique, son grain grossit quand l'image grandit.
 *
 * Mesures du 2026-08-20, mire A exportee de Lightroom a Grain 50, Cassure 50
 * (son defaut, jamais touchee) — `scripts/mesure-taille-grain.mjs`:
 *
 *   Taille | image     | ecart-type | grosseur des grains
 *   -------+-----------+------------+--------------------
 *      0   | 1620x1080 |   22,91    | 1,05 px
 *     25   | 1620x1080 |   18,37    | 1,02 px
 *     50   | 1620x1080 |   14,08    | 1,27 px
 *    100   | 1620x1080 |    9,37    | 1,96 px
 *     25   | 3240x2160 |   12,64    | 1,44 px
 *     25   | 6480x4320 |    8,15    | 2,44 px
 *
 * Ces ecarts-types sont ceux des aplats GRIS. Les carres colores sont ecartes:
 * Lightroom y pose un grain plus fort (22 a 23/255 sur le rouge, le vert et le
 * bleu contre 18,4 sur les gris) la ou le notre est monochrome. Les melanger
 * dans une moyenne faisait croire a 6 % d'ecart de force qui n'existe pas —
 * sur les gris, nos deux moteurs donnent 18,37 et 18,38.
 *
 * DEUX FAITS S'Y LISENT, et le second explique l'ecart vu sur photo.
 *
 * a. La force et la grosseur sont LE MEME NOMBRE, vu de deux cotes. L'echelle
 *    deduite de la force (18,37 / ecart-type) tombe sur la grosseur mesuree,
 *    ligne par ligne: 1,31 contre 1,27 px, 1,96 contre 1,96 px, 2,25 contre
 *    2,44 px. Lightroom etale une quantite FIXE de grain sur des
 *    grains plus ou moins gros. Un grain deux fois plus gros bruite deux fois
 *    moins chaque pixel. C'est pour ca qu'une mesure d'ecart-type seule ne
 *    voyait pas passer le sous-reglage Taille — elle lisait sa consequence en
 *    croyant lire la force.
 *
 * b. La grosseur suit a peu pres la RACINE de la largeur de l'image. Une image
 *    2x plus large donne des grains 1,45x plus gros, une image 4x plus large
 *    2,25x — soit un exposant de 0,58 environ sur les trois tailles mesurees.
 *
 * Consequence concrete, celle qui se voyait a l'oeil sur CN14: sur une photo de
 * 9180 px de large, ses grains font ~2,4 px et pesent 3,99/255, la ou nous
 * posions 1 px et 9,2/255 — 2,3 fois trop fort, et trop fin. « Sable numerique »
 * contre « argentique ».
 *
 * ── LA LOI, TELLE QU'ELLE EST IMPLEMENTEE ────────────────────────────────
 *
 * Une seule echelle `e` porte les deux effets:
 *
 *   e = taille(Taille) x (largeur / 1620) ^ 0,577
 *
 * puis, exactement comme lui:
 *
 *   - les grains font `e` pixels (bruit tire tous les `e` pixels, interpole);
 *   - leur ecart-type vaut 0,367 x valeur / e.
 *
 * Le second point n'est PAS une consequence automatique du premier: il est pose
 * explicitement, et le champ est renormalise pour que l'interpolation ne change
 * que la grosseur, jamais la force. Sans ca, deux lois se melangeraient et
 * aucune ne serait verifiable.
 *
 * ── CE QUI EST MESURE, ET CE QUI NE L'EST PAS ────────────────────────────
 *
 * MESURE: les quatre valeurs de Taille ci-dessus, et deux tailles d'image.
 * INTERPOLE: tout ce qui est ENTRE ces valeurs (dont la Taille 40 de CN17).
 * PAS MESURE: la « Cassure », laissee a son defaut de 50 partout — si un preset
 * a importer la change, il faudra la mesurer avant de la recopier.
 */

/* La reference: la taille d'image ou la calibration a ete faite, et ou notre
   grain tombe deja a x1,00 de Lightroom. */
export const GRAIN_LARGEUR_REFERENCE = 1620;

/* Ecart-type du grain de Lightroom par unite de curseur, a l'echelle 1. */
export const GRAIN_SIGMA_PAR_UNITE = 0.367;

/* La Taille que Lightroom pose par defaut, et sur laquelle tout le reste a ete
   calibre. Un preset qui ne dit rien vaut celle-ci. */
export const GRAIN_TAILLE_DEFAUT = 25;

/*
 * L'exposant de la largeur, ajuste sur TROIS tailles d'image (1620, 3240,
 * 6480). Ce n'est pas exactement une loi de puissance — prise deux a deux, la
 * pente vaut 0,539 puis 0,586 — donc 0,577 est le meilleur compromis sur les
 * trois points, a 2,6 % du pire d'entre eux. RESERVE: rien n'est mesure
 * au-dela de 6480 px ni en dessous de 1620.
 */
export const GRAIN_EXPOSANT_LARGEUR = 0.577;

/*
 * La grosseur des grains selon le sous-reglage « Taille », a la largeur de
 * reference. Lue dans le tableau de mesures ci-dessus: chaque point est le
 * rapport de l'ecart-type de la Taille 25 a celui de la Taille voulue, ce qui
 * est la meme chose que le rapport des grosseurs (voir le fait « a. »).
 */
const GRAIN_TAILLE_MESUREE = [
    { taille: 0, echelle: 0.802 },   // 18,37 / 22,91
    { taille: 25, echelle: 1.000 },  // la reference
    { taille: 50, echelle: 1.305 },  // 18,37 / 14,08
    { taille: 100, echelle: 1.960 }, // 18,37 /  9,37
];

/* Interpolation lineaire entre les points mesures. Entre deux mesures on ne
   sait rien de mieux qu'une droite, et le dire vaut mieux qu'une courbe
   inventee qui aurait l'air plus savante. */
export function grainEchelleDeTaille(taille = GRAIN_TAILLE_DEFAUT) {
    const t = Math.max(0, Math.min(100, Number.isFinite(taille) ? taille : GRAIN_TAILLE_DEFAUT));
    const points = GRAIN_TAILLE_MESUREE;
    if (t <= points[0].taille) return points[0].echelle;
    for (let i = 1; i < points.length; i += 1) {
        if (t <= points[i].taille) {
            const a = points[i - 1];
            const b = points[i];
            const part = (t - a.taille) / (b.taille - a.taille);
            return a.echelle + part * (b.echelle - a.echelle);
        }
    }
    return points[points.length - 1].echelle;
}

/* L'echelle complete: la Taille du curseur, agrandie par la taille de l'image. */
export function grainEchelle(taille, largeur) {
    const l = Math.max(1, Number.isFinite(largeur) ? largeur : GRAIN_LARGEUR_REFERENCE);
    const parLargeur = (l / GRAIN_LARGEUR_REFERENCE) ** GRAIN_EXPOSANT_LARGEUR;
    return grainEchelleDeTaille(taille) * parLargeur;
}

/* L'ecart-type a poser, en /255. Il BAISSE quand les grains grossissent: la
   quantite de grain est la meme, elle est etalee sur plus de pixels. */
export function grainSigma(valeur, taille, largeur) {
    return (GRAIN_SIGMA_PAR_UNITE * valeur) / grainEchelle(taille, largeur);
}

/*
 * ── LA TAILLE DE RENDU N'EST PAS LA TAILLE DE L'IMAGE ────────────────────
 *
 * Erreur commise le 2026-08-20, et visible immediatement a l'ecran: le grain
 * etait calcule pour la largeur du CANVAS. Or l'apercu de Vision rend a ~800 px
 * une photo qui en fait 9180. Le moteur posait donc le grain d'une image de
 * 800 px — 15,6/255 — la ou Lightroom en pose 3,83 sur la photo entiere. Le ciel
 * partait en bouillie de bruit.
 *
 * Lightroom, lui, calcule TOUJOURS son grain sur l'image entiere; ce que l'ecran
 * montre est cette image REDUITE, donc un grain moyenne, discret. C'est pour ca
 * qu'en mode « Adapter » son grain se devine a peine.
 *
 * On fait pareil, en deux temps:
 *
 *   1. la grosseur et la force sont celles de l'image FINALE;
 *   2. on applique ensuite ce que la reduction leur fait.
 *
 * Reduire d'un facteur `r` moyenne r x r pixels. Un bruit dont les grains sont
 * plus PETITS que `r` s'efface en proportion (son ecart-type est divise par
 * r/grosseur); des grains plus GROS que `r` survivent tels quels, simplement
 * retrecis. D'ou le `min(1, ...)` ci-dessous — et le fait qu'un apercu montre
 * peu de grain n'est pas un bug, c'est ce que montre son ecran a lui.
 */
export function grainPourRendu(valeur, taille, largeurSource, largeurRendu) {
    const source = Math.max(1, Number.isFinite(largeurSource) ? largeurSource : largeurRendu);
    const rendu = Math.max(1, Number.isFinite(largeurRendu) ? largeurRendu : source);
    const echelleSource = grainEchelle(taille, source);
    const sigmaSource = (GRAIN_SIGMA_PAR_UNITE * valeur) / echelleSource;
    const reduction = source / rendu;
    if (reduction <= 1) return { echelle: echelleSource, sigma: sigmaSource };
    const survie = Math.min(1, echelleSource / reduction);
    return {
        echelle: Math.max(1, echelleSource / reduction),
        sigma: sigmaSource * survie,
    };
}

export const GRAIN_NOISE_SIZE = 512;

/*
 * La table de bruit est TIREE UNE FOIS, et de facon DETERMINISTE.
 *
 * Elle l'etait par `Math.random()`, donc differente a chaque chargement de
 * page: deux rendus de la meme photo n'avaient pas le meme grain, et aucune
 * mesure ne pouvait etre rejouee a l'identique. Le generateur ci-dessous
 * (mulberry32) rend la meme suite a chaque fois, sur toutes les machines. La
 * statistique du grain ne change pas — c'est le motif qui cesse de bouger.
 */
export const GRAIN_NOISE_TABLE = (() => {
    let graine = 20260820;
    const suivant = () => {
        graine |= 0;
        graine = (graine + 0x6D2B79F5) | 0;
        let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const table = new Float32Array(GRAIN_NOISE_SIZE * GRAIN_NOISE_SIZE);
    for (let i = 0; i < table.length; i += 1) {
        const u1 = suivant() || 0.0001;
        const u2 = suivant();
        table[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    return table;
})();

/*
 * L'interpolation bilineaire d'un bruit blanc divise son ecart-type par 3/2,
 * quelle que soit l'echelle: sur une cellule, la moyenne de (1-f)^2 + f^2 vaut
 * 2/3 par axe, donc 4/9 en variance. On remultiplie par l'inverse pour que le
 * champ rendu ait toujours un ecart-type de 1 — la force reste pilotee par
 * `grainSigma`, et par elle seule.
 */
const CORRECTION_BILINEAIRE = 1.5;

/*
 * ET LE PAS D'INTERPOLATION N'EST PAS LA GROSSEUR.
 *
 * Un bruit interpole sur un pas de `p` pixels ne rend pas des grains de `p`
 * pixels, et la relation n'est meme pas continue. Mesuree (balayage du
 * 2026-08-20):
 *
 *   pas       1,00   1,10   1,20   1,30   1,50   1,75   2,00   2,50   3,00
 *   grosseur  1,02   1,66   1,80   1,97   2,18   2,60   2,68   3,71   4,27
 *
 * A pas 1,00 les points du reseau tombent exactement sur les pixels: il n'y a
 * rien a interpoler, et le grain fait 1 pixel. Des qu'on s'en ecarte, chaque
 * pixel devient une moyenne de deux voisins du reseau et la grosseur SAUTE a
 * 1,66. Entre les deux, ce mecanisme seul ne sait rien produire.
 *
 * Or c'est justement la que tombent les cas les plus courants: la Taille 50
 * (1,27) et toute image entre 1620 et 3240 px de large (1,44 a 3240). Sans
 * quoi notre grain y garderait la bonne force mais resterait trop fin — ce que
 * la mesure montrait: 1,01 contre 1,44 chez lui.
 *
 * D'ou le MELANGE: sous 1,66, on additionne du bruit d'un pixel et du bruit
 * interpole au pas minimal, dans la proportion qui donne la grosseur voulue.
 * Les deux sont lus dans la meme table a des endroits eloignes, donc
 * independants, et les poids sont en RACINE pour que les variances s'ajoutent
 * a 1 (le bruit s'ajoute en quadrature, jamais en somme).
 */
const PAS_MIN = 1.1;
const GROSSEUR_AU_PAS_MIN = 1.66;

/* La courbe ci-dessus, lue a l'envers: quel pas donne la grosseur voulue. */
const GROSSEUR_PAR_PAS = [
    { pas: 1.10, grosseur: 1.66 },
    { pas: 1.20, grosseur: 1.80 },
    { pas: 1.30, grosseur: 1.97 },
    { pas: 1.50, grosseur: 2.18 },
    { pas: 1.75, grosseur: 2.60 },
    { pas: 2.00, grosseur: 2.68 },
    { pas: 2.50, grosseur: 3.71 },
    { pas: 3.00, grosseur: 4.27 },
];

export function grainPasInterpolation(grosseur) {
    const points = GROSSEUR_PAR_PAS;
    if (grosseur <= points[0].grosseur) return PAS_MIN;
    for (let i = 1; i < points.length; i += 1) {
        if (grosseur <= points[i].grosseur) {
            const a = points[i - 1];
            const b = points[i];
            const part = (grosseur - a.grosseur) / (b.grosseur - a.grosseur);
            return a.pas + part * (b.pas - a.pas);
        }
    }
    /* Au-dela du dernier point mesure, la courbe est prolongee par sa pente
       finale. RESERVE: rien n'est mesure au-dessus d'une grosseur de 4,27 px,
       ce qui demanderait une image de plus de 20 000 px de large. */
    const dernier = points[points.length - 1];
    const avant = points[points.length - 2];
    const pente = (dernier.pas - avant.pas) / (dernier.grosseur - avant.grosseur);
    return dernier.pas + (grosseur - dernier.grosseur) * pente;
}

/* Un demi-tour de table: assez loin pour que les deux lectures soient
   independantes, ce qu'exige l'addition en quadrature du melange. */
const DECALAGE_INDEPENDANT = GRAIN_NOISE_SIZE >> 1;

function bruitBlanc(x, y, decalage) {
    const cy = (y + decalage) % GRAIN_NOISE_SIZE;
    const cx = (x + decalage) % GRAIN_NOISE_SIZE;
    return GRAIN_NOISE_TABLE[cy * GRAIN_NOISE_SIZE + cx];
}

function bruitInterpole(x, y, pas) {
    const u = x / pas;
    const v = y / pas;
    const x0 = Math.floor(u);
    const y0 = Math.floor(v);
    const fx = u - x0;
    const fy = v - y0;
    const cx0 = ((x0 % GRAIN_NOISE_SIZE) + GRAIN_NOISE_SIZE) % GRAIN_NOISE_SIZE;
    const cy0 = ((y0 % GRAIN_NOISE_SIZE) + GRAIN_NOISE_SIZE) % GRAIN_NOISE_SIZE;
    const cx1 = (cx0 + 1) % GRAIN_NOISE_SIZE;
    const cy1 = (cy0 + 1) % GRAIN_NOISE_SIZE;
    const h0 = GRAIN_NOISE_TABLE[cy0 * GRAIN_NOISE_SIZE + cx0] * (1 - fx)
        + GRAIN_NOISE_TABLE[cy0 * GRAIN_NOISE_SIZE + cx1] * fx;
    const h1 = GRAIN_NOISE_TABLE[cy1 * GRAIN_NOISE_SIZE + cx0] * (1 - fx)
        + GRAIN_NOISE_TABLE[cy1 * GRAIN_NOISE_SIZE + cx1] * fx;
    return (h0 * (1 - fy) + h1 * fy) * CORRECTION_BILINEAIRE;
}

/* Une deviation du champ, en (x, y), pour des grains de `echelle` pixels.
   Ecart-type 1, quelle que soit l'echelle. */
export function grainValeurEn(x, y, echelle) {
    /* Un pixel est le plus fin qu'on puisse dessiner. C'est le cas de la
       Taille 0, dont les grains sont plus fins que ca et qui se manifeste
       alors uniquement par un ecart-type plus fort. */
    if (echelle <= 1.02) return bruitBlanc(x, y, 0);
    if (echelle < GROSSEUR_AU_PAS_MIN) {
        /* Entre 1 et 1,66 px: melange, en quadrature, du bruit d'un pixel et du
           bruit interpole au pas minimal. */
        const part = (echelle - 1) / (GROSSEUR_AU_PAS_MIN - 1);
        return Math.sqrt(1 - part) * bruitBlanc(x, y, DECALAGE_INDEPENDANT)
            + Math.sqrt(part) * bruitInterpole(x, y, PAS_MIN);
    }
    return bruitInterpole(x, y, grainPasInterpolation(echelle));
}

/*
 * L'EXTINCTION AUX DEUX BOUTS, mesuree elle aussi (2026-08-15).
 *
 * Le plat de Lightroom n'en est pas tout a fait un: au niveau 8 et au niveau
 * 247, son grain ne vaut plus que 0,67 de sa valeur courante. Ce n'est PAS un
 * simple ecretage: une gaussienne d'ecart-type 5,5 posee sur un niveau 8 et
 * coupee a 0 rendrait 5,20, or on mesure 3,48. Et le rapport vaut 0,67 aux
 * trois valeurs de curseur testees comme aux deux bouts — c'est donc une
 * attenuation qui depend du NIVEAU, pas de la force.
 *
 * RESERVE: seuls les niveaux 8 (0,67) et 24 (1,00) ont ete mesures. L'exposant
 * passe exactement par ces deux points et s'eteint a 0 sur le noir pur; la
 * forme ENTRE les deux est une interpolation, pas une mesure.
 */
export const GRAIN_BORD = 24;
export const GRAIN_BORD_EXPOSANT = 0.364; // (8/24)^0,364 = 0,67, le rapport mesure

export const GRAIN_ATTENUATION = (() => {
    const table = new Float32Array(256);
    for (let v = 0; v < 256; v += 1) {
        const distance = Math.min(v, 255 - v);
        table[v] = distance >= GRAIN_BORD ? 1 : (distance / GRAIN_BORD) ** GRAIN_BORD_EXPOSANT;
    }
    return table;
})();
