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
 * MESURE: cinq valeurs de Taille (0, 25, 40, 50, 100) et quatre tailles
 * d'image (1620, 3240, 6480, 9720).
 * INTERPOLE: tout ce qui est ENTRE ces valeurs (dont la Taille 10 de CN14, que
 * la vraie photo confirme a 0,2 % pres — voir la note sur le plancher).
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
 * ── LA LARGEUR DE L'IMAGE: UNE TABLE, PLUS UNE LOI DE PUISSANCE ──────────
 *
 * C'etait un exposant unique, 0,577, ajuste sur trois tailles. Il tenait a
 * 2,6 % pres sur ces trois-la et se trompait de 5,8 % des qu'on sortait de
 * leur intervalle — ce qui est exactement le cas des vraies photos.
 *
 * Mesures (mire A, Grain 50, Taille 25, `scripts/mesure-taille-grain.mjs`;
 * le point 9720 est du 2026-08-22, les trois autres du 2026-08-20):
 *
 *   largeur | ecart-type | echelle mesuree | l'ancienne loi | ecart
 *   --------+------------+-----------------+----------------+-------
 *     1620  |   18,37    |     1,000       |     1,000      |   0 %
 *     3240  |   12,64    |     1,453       |     1,492      | +2,6 %
 *     6480  |    8,15    |     2,254       |     2,225      | -1,3 %
 *     9720  |    6,91    |     2,658       |     2,812      | +5,8 %
 *
 * Ce n'est pas une loi de puissance: les pentes locales valent 0,539, puis
 * 0,633, puis 0,407. Aucun exposant unique ne passe par les quatre points, et
 * en inventer un revient a choisir ou se tromper. On interpole donc DROIT
 * ENTRE LES MESURES, en log-log — c'est-a-dire par la loi de puissance locale,
 * la seule qu'on ait le droit d'ecrire.
 *
 * C'EST CE QUI FERMAIT LES 5 % DE LA VRAIE PHOTO. A 9180 px l'ancienne loi
 * donnait une echelle de 2,721 la ou la mesure interpolee donne 2,597: notre
 * grain etait etale 4,7 % trop large, donc 4,7 % trop faible. C'est, au dixieme
 * pres, l'ecart qu'on lisait sur le ciel de `photo-test-2`.
 */
const GRAIN_LARGEUR_MESUREE = [
    { largeur: 1620, echelle: 1.0000 },  // la reference
    { largeur: 3240, echelle: 1.4533 },  // 18,37 / 12,64
    { largeur: 6480, echelle: 2.2540 },  // 18,37 /  8,15
    { largeur: 9720, echelle: 2.6585 },  // 18,37 /  6,91
];

/*
 * L'echelle due a la seule largeur. Interpolation en log-log entre les points
 * mesures; au-dela du dernier, prolongee par sa pente finale (0,407).
 *
 * RESERVE: rien n'est mesure EN DESSOUS de 1620 px, et c'est le trou qui reste
 * le plus genant — un export social fait 1080 px de large, ou l'echelle
 * tomberait sous 1 (voir la note sur la Taille 10 plus bas).
 */
export function grainEchelleDeLargeur(largeur) {
    const l = Math.max(1, Number.isFinite(largeur) ? largeur : GRAIN_LARGEUR_REFERENCE);
    const points = GRAIN_LARGEUR_MESUREE;
    const lnL = Math.log(l);
    for (let i = 1; i < points.length; i += 1) {
        if (l <= points[i].largeur || i === points.length - 1) {
            const a = points[i - 1];
            const b = points[i];
            const pente = Math.log(b.echelle / a.echelle) / Math.log(b.largeur / a.largeur);
            return a.echelle * Math.exp(pente * (lnL - Math.log(a.largeur)));
        }
    }
    return 1;
}

/*
 * La grosseur des grains selon le sous-reglage « Taille », a la largeur de
 * reference. Lue dans le tableau de mesures ci-dessus: chaque point est le
 * rapport de l'ecart-type de la Taille 25 a celui de la Taille voulue, ce qui
 * est la meme chose que le rapport des grosseurs (voir le fait « a. »).
 */
const GRAIN_TAILLE_MESUREE = [
    { taille: 0, echelle: 0.802 },    // 18,37 / 22,91  — regime a part, voir ci-dessous
    { taille: 25, echelle: 1.000 },   // la reference
    { taille: 40, echelle: 1.1716 },  // 18,37 / 15,68  — mesure le 2026-08-22
    { taille: 50, echelle: 1.305 },   // 18,37 / 14,08
    { taille: 100, echelle: 1.960 },  // 18,37 /  9,37
];

/*
 * ── LA TAILLE 10, ET LE PLANCHER D'UN PIXEL ──────────────────────────────
 *
 * Export du 2026-08-22, mire de 1620 px, Grain 50, Taille 10: ecart-type
 * 18,37 et grains de 1,01 px — soit EXACTEMENT la Taille 25 (18,37 et 1,02).
 * Les deux fichiers different pourtant sur 98 % de leurs pixels: ce sont bien
 * deux tirages distincts, pas le meme export en double.
 *
 * Et pourtant la vraie photo dit l'inverse. `photo-test-2` en CN14 (Taille 10,
 * 9180 px de large) porte un grain de 4,02/255 et de 2,29 px. Avec une echelle
 * de Taille de 1,000 on lui poserait 3,53 et 2,45 px; avec 0,879 on lui pose
 * 4,01 et 2,30. La photo tranche donc pour 0,879 — et l'interpolation lineaire
 * entre la Taille 0 et la Taille 25 donne 0,881, a 0,2 % pres.
 *
 * CE QUI RECONCILIE LES DEUX: un grain ne peut pas etre dessine plus fin qu'un
 * pixel. A 1620 px, la Taille 10 demande 0,88 px — Lightroom rend alors 1,00 px
 * et n'augmente PAS son ecart-type pour compenser. A 9180 px, la meme Taille 10
 * demande 2,29 px, largement au-dessus du plancher, et elle se distingue de la
 * Taille 25.
 *
 * CE QUI RESTE INEXPLIQUE: la Taille 0 au meme 1620 px NE se plafonne pas —
 * elle donne 22,91, donc 0,802 px, sous le plancher. Son autocorrelation au
 * pixel voisin est negative (-0,17 contre -0,05), signe d'une structure plus
 * fine que le pixel qui se replie: c'est un autre mecanisme, pas le meme
 * curseur pousse plus loin.
 *
 * DECISION: on garde la table telle quelle, sans plancher. Elle est juste
 * partout ou l'echelle depasse 1, c'est-a-dire sur toutes les images reelles.
 * En dessous, elle est probablement 13 % trop forte — mais RIEN n'est mesure
 * sous 1620 px de large, et un export social en fait 1080. C'est le prochain
 * export a demander: la mire A reduite a 1080 px, Grain 50, Taille 25.
 */

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
    return grainEchelleDeTaille(taille) * grainEchelleDeLargeur(largeur);
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
 * L'EXPOSANT A ETE REAJUSTE le 2026-08-22, et il valait la peine de le refaire.
 * Il etait cale sur UN seul rapport (0,67 au niveau 8), lu a la valeur 15. Or ce
 * rapport est lu APRES ecretage — au niveau 8 avec un grain 50, un quart des
 * pixels tombe a 0 — et l'ecretage ne se comporte pas pareil selon la force du
 * grain. Un exposant cale sur un seul point ne pouvait donc pas tenir aux
 * trois.
 *
 * Il est desormais ajuste sur DOUZE mesures: les quatre carres de bord (gris 8,
 * 24, 224, 247) aux trois valeurs de curseur exportees (15, 50, 100), le rendu
 * complet passe dans notre moteur et compare a son export. Pire ecart:
 *
 *      exposant 0,364 (l'ancien)  -> 6,4 %
 *      exposant 0,420 (celui-ci)  -> 0,68 %
 *
 * RESERVE: cela reste une courbe a UN parametre, calee sur les seuls niveaux 8
 * et 247. La forme entre 0 et 24 est une interpolation, pas une mesure, et rien
 * n'est mesure sur une COULEUR sombre saturee — l'attenuation est lue sur la
 * luminance sRVB du pixel, ce qui n'est verifie que sur des gris.
 */
export const GRAIN_BORD = 24;
export const GRAIN_BORD_EXPOSANT = 0.420; // ajuste sur 12 mesures, 2026-08-22

export const GRAIN_ATTENUATION = (() => {
    const table = new Float32Array(256);
    for (let v = 0; v < 256; v += 1) {
        const distance = Math.min(v, 255 - v);
        table[v] = distance >= GRAIN_BORD ? 1 : (distance / GRAIN_BORD) ** GRAIN_BORD_EXPOSANT;
    }
    return table;
})();

/*
 * ── L'ESPACE OU IL POSE SON GRAIN ────────────────────────────────────────
 *
 * Mesure du 2026-08-22, mire A, grain 50, `scripts/mesure-grain-canaux.mjs`.
 * On soustrait l'export SANS RIEN de l'export AVEC GRAIN, pixel a pixel: la
 * difference EST son champ de grain, canal par canal. Deux choses en sortent.
 *
 * 1. SON GRAIN EST BIEN MONOCHROME. La correlation entre canaux vaut 0,95 a
 *    1,00 sur les 24 aplats. Un grain tire par canal donnerait 0,00. La piste
 *    « trois bruits independants » etait donc fausse, et elle est enterree.
 *
 * 2. MAIS IL NE LE POSE PAS EN sRVB. Sur les gris, son ecart-type vaut 18,4
 *    partout. Sur les aplats satures, il se repartit tres inegalement:
 *
 *      aplat      sigma R   sigma G   sigma B
 *      rouge       21,21     25,54     19,69
 *      vert        29,18     18,54     22,50
 *      bleu        29,47     18,60     18,78
 *      cyan        32,12     18,45     18,31
 *      magenta     20,06     26,15     18,88
 *      jaune       18,56     18,22     27,69
 *      peau, ciel, feuillage, beton: 17,9 a 20,9 (proches du plat)
 *
 *    Un seul et meme bruit, mais qui arrive amplifie differemment selon le
 *    canal ET selon la couleur du carre. C'est la signature d'un bruit ajoute
 *    AVANT un changement d'espace couleur.
 *
 * L'ESPACE, C'EST CELUI DE LIGHTROOM: primaires ProPhoto, courbe de transfert
 * sRVB (ce que la doc Adobe appelle son espace de travail interne). Le grain y
 * est ajoute a l'identique sur les trois canaux, puis l'image revient en sRVB.
 *
 * Ce modele n'a AUCUN parametre libre — ni coefficient ajuste, ni table. Il
 * predit les 72 ecarts-types mesures a 1,8 % pres au pire, et il predit aussi
 * la PROPORTION DE PIXELS ECRETES a 0, qui est ce qui explique l'inegalite
 * entre canaux du meme carre:
 *
 *      aplat/canal   mesure   modele      pixels a 0: mesure -> modele
 *      cyan R         32,12    32,21          28,9 %  ->  28,6 %
 *      vert R         29,18    29,43          23,4 %  ->  23,9 %
 *      bleu R         29,47    29,68          24,2 %  ->  24,3 %
 *      jaune B        27,69    27,99          20,7 %  ->  21,0 %
 *      magenta G      26,15    26,28           9,3 %  ->   9,7 %
 *      rouge G        25,54    25,63          16,2 %  ->  16,0 %
 *
 *    (le rouge du cyan est le meme carre que son vert et son bleu, et il porte
 *    pourtant 1,7x plus de grain: parce qu'en revenant en sRVB il tombe a 40,
 *    ou il ecrete a 0 une fois sur trois. Rien de tout ca n'est ajustable.)
 *
 * ET LES GRIS NE BOUGENT PAS, par construction et non par chance: les lignes
 * des deux matrices somment a 1,000000000000, donc un pixel neutre traverse
 * l'espace de travail sans changer et ressort a `valeur + delta` exactement.
 * C'est le chemin rapide ci-dessous. La calibration sur les gris — x1,00, deux
 * fois verifiee — est donc intouchee au sens strict du mot.
 *
 * RESERVE: l'attenuation aux deux bouts (`GRAIN_ATTENUATION`) reste lue sur la
 * luminance sRVB du pixel. Elle n'a ete mesuree que sur des gris (niveaux 8 et
 * 247); rien ne dit ou elle s'applique sur une couleur sombre saturee, et rien
 * dans la mire A ne permet de le trancher.
 *
 * ── LA VRAIE PHOTO, ET CE QUI RESTE ─────────────────────────────────────
 *
 * Sur le ciel de `photo-test-2` en CN14 (Taille 10, 9180 px de large), mesure
 * du 2026-08-22 par `scripts/mesure-grain-photo.mjs`, 40 blocs plats de 64 px,
 * bruit de fond de sa chaine retire en quadrature (lu sur la MEME photo
 * developpee en CN01, qui ne pose aucun grain):
 *
 *      son grain seul   4,83  4,04  4,02   (R, G, B)
 *      le notre         4,77  4,01  4,00
 *      ecart             -1%   -1%   -1%
 *      grosseur des grains: 2,29 px chez lui, 2,21 chez nous
 *
 * On etait a -5 % UNIFORMES sur les trois canaux avant la table de largeur
 * ci-dessus. Ce n'etait donc pas la couleur — un ecart uniforme n'est jamais un
 * effet de couleur — mais bien l'extrapolation de l'ancienne loi de puissance
 * au-dela de 6480 px.
 *
 * CE QUI RESTE, ET QUI EST NOUVEAU: sa FORCE et sa GROSSEUR cessent d'etre le
 * meme nombre quand l'image grandit. Sur la mire de 9720 px, sa force donne une
 * echelle de 2,66 alors que sa longueur de correlation vaut 3,35 — 26 % d'ecart.
 * A 1620 et 3240 px les deux coincidaient (1,00/1,02 et 1,45/1,44). Autrement
 * dit son grain ne se contente pas d'etre le meme bruit agrandi: sa FORME
 * change avec l'echelle. Nous posons la bonne force (0,4 % pres a toutes les
 * tailles mesurees) et des grains un peu trop fins (2,92 contre 3,35 a 9720 px,
 * 2,21 contre 2,29 sur la photo). Corriger cela demanderait de remodeler le
 * spectre du bruit, et deux points de mesure ne suffisent pas a le dessiner.
 */

/* sRVB lineaire -> ProPhoto lineaire (les deux adaptes a D50, comme les
   matrices ICC). Les lignes somment a 1: le neutre est un point fixe. */
export const GRAIN_SRGB_VERS_TRAVAIL = [
    [0.529345927, 0.330072799, 0.140581274],
    [0.098374342, 0.873461024, 0.028164634],
    [0.016883218, 0.117672471, 0.865444311],
];

/* ProPhoto lineaire -> sRVB lineaire. Lignes a 1 elles aussi. */
export const GRAIN_TRAVAIL_VERS_SRGB = [
    [2.034075937, -0.727334207, -0.306741730],
    [-0.228813320, 1.231730157, -0.002916838],
    [-0.008569838, -0.153286570, 1.161856408],
];

/*
 * La courbe de transfert sRVB, celle que l'espace de travail utilise aussi.
 * Sous zero, on prolonge par la droite du bas plutot que d'ecreter: le grain
 * doit pouvoir pousser un canal DANS le negatif et l'en ramener, sinon il
 * s'ecrete deux fois et la mesure ne colle plus.
 *
 * Ces deux fonctions sont la REFERENCE — exactes, lentes, et c'est a elles que
 * le test compare les tables ci-dessous.
 */
export function grainTransfertEncode(l) {
    if (l <= 0.0031308) return 12.92 * l;
    return 1.055 * (l ** (1 / 2.4)) - 0.055;
}

export function grainTransfertDecode(c) {
    if (c <= 0.04045) return c / 12.92;
    return ((c + 0.055) / 1.055) ** 2.4;
}

/*
 * ── POURQUOI DES TABLES, ET PAS `Math.pow` ───────────────────────────────
 *
 * Le detour par l'espace de travail demande NEUF exponentiations par pixel:
 * trois pour y entrer, trois pour en sortir, trois pour reencoder en sRVB.
 * Mesure: 2,2 s pour 12 Mpx, et une photo de 9180 px en fait 56 — dix secondes
 * rien que pour poser le grain, a chaque export.
 *
 * Les deux tables ci-dessous, lues par interpolation lineaire, rendent la meme
 * chose. Leur pas est assez fin pour que l'erreur reste tres au-dessous du
 * demi-niveau d'affichage: `test:vision-preset` la mesure contre les fonctions
 * exactes ci-dessus et la borne a 0,01/255, sur toute la plage utile.
 */
const PAS_ENC = 1 / 8192;
const TABLE_ENC = (() => {
    const t = new Float64Array(8194);
    for (let i = 0; i < t.length; i += 1) t[i] = grainTransfertEncode(i * PAS_ENC);
    return t;
})();

const DEC_MIN = -1;
const PAS_DEC = 1 / 4096;
const TABLE_DEC = (() => {
    const t = new Float64Array(12290);
    for (let i = 0; i < t.length; i += 1) t[i] = grainTransfertDecode(DEC_MIN + i * PAS_DEC);
    return t;
})();

/* Encode une valeur lineaire, ecretee a [0, 1] — ce qui EST l'ecretage de
   sortie: un canal negatif rend 0, un canal au-dela de 1 rend 255. */
function encode(l) {
    if (l <= 0) return 0;
    if (l >= 1) return 1;
    const u = l / PAS_ENC;
    const i = u | 0;
    const f = u - i;
    return TABLE_ENC[i] + (TABLE_ENC[i + 1] - TABLE_ENC[i]) * f;
}

/* Decode une valeur encodee, grain compris — donc possiblement hors de [0, 1].
   Au-dela de la table, on repasse par la fonction exacte: c'est rarissime (il
   faudrait un grain de plus de 255 niveaux) et ca ne doit pas mentir. */
function decode(c) {
    const u = (c - DEC_MIN) / PAS_DEC;
    if (u < 0 || u >= 12288) return grainTransfertDecode(c);
    const i = u | 0;
    const f = u - i;
    return TABLE_DEC[i] + (TABLE_DEC[i + 1] - TABLE_DEC[i]) * f;
}

const SRGB_VERS_LINEAIRE = (() => {
    const table = new Float64Array(256);
    for (let v = 0; v < 256; v += 1) table[v] = grainTransfertDecode(v / 255);
    return table;
})();

/*
 * Les deux matrices, a plat: dans une boucle qui tourne des dizaines de
 * millions de fois, lire `M[c][0]` coute deux dereferencements par coefficient.
 * Les memes nombres, ecrits une seule fois, vivent dans les tableaux exportes
 * ci-dessus — ce sont eux que la mesure et le test lisent.
 */
const A00 = 0.529345927, A01 = 0.330072799, A02 = 0.140581274;
const A10 = 0.098374342, A11 = 0.873461024, A12 = 0.028164634;
const A20 = 0.016883218, A21 = 0.117672471, A22 = 0.865444311;
const B00 = 2.034075937, B01 = -0.727334207, B02 = -0.306741730;
const B10 = -0.228813320, B11 = 1.231730157, B12 = -0.002916838;
const B20 = -0.008569838, B21 = -0.153286570, B22 = 1.161856408;

/*
 * Pose `delta` (en niveaux d'affichage, /255) sur un pixel, DANS SON ESPACE DE
 * TRAVAIL, et rend le pixel sRVB qui en resulte, ecrete.
 *
 * `sortie` est un tableau de 3 fourni par l'appelant, pour ne rien allouer.
 */
export function grainPoserDelta(r, g, b, delta, sortie) {
    /* Un pixel neutre est un point fixe des deux matrices — leurs lignes
       somment a 1 — donc le detour ne changerait rien, au bit pres. C'est ce
       qui garantit que la calibration sur les gris ne bouge pas, et c'est
       aussi le chemin le plus court. */
    if (r === g && g === b) {
        const v = r + delta;
        const c = v < 0 ? 0 : (v > 255 ? 255 : v);
        sortie[0] = c;
        sortie[1] = c;
        sortie[2] = c;
        return sortie;
    }
    const lr = SRGB_VERS_LINEAIRE[r];
    const lg = SRGB_VERS_LINEAIRE[g];
    const lb = SRGB_VERS_LINEAIRE[b];
    const d = delta * (1 / 255);
    /* Vers l'espace de travail, ou le grain se pose — le meme delta sur les
       trois canaux. */
    const t0 = decode(encode(A00 * lr + A01 * lg + A02 * lb) + d);
    const t1 = decode(encode(A10 * lr + A11 * lg + A12 * lb) + d);
    const t2 = decode(encode(A20 * lr + A21 * lg + A22 * lb) + d);
    /* ...et retour en sRVB, ou il s'ecrete. */
    sortie[0] = encode(B00 * t0 + B01 * t1 + B02 * t2) * 255;
    sortie[1] = encode(B10 * t0 + B11 * t1 + B12 * t2) * 255;
    sortie[2] = encode(B20 * t0 + B21 * t1 + B22 * t2) * 255;
    return sortie;
}
