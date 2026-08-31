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
 * MESURE: six valeurs de Taille (0, 10, 25, 40, 50, 100) et des formats de 810 a
 * 16 320 px. Les deux plus grands formats ont ete mesures directement sur les
 * Tailles 10 et 40, celles des presets Cinema II qui portent du grain.
 * INTERPOLE: tout ce qui est ENTRE ces valeurs.
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
 * ── LA CASSURE ───────────────────────────────────────────────────────────
 *
 * Le troisieme curseur du panneau Grain, sous la Taille. Elle vaut 50 par
 * defaut et TOUS les presets importes jusqu'ici la laissent la. Elle n'avait
 * jamais ete mesuree, et toute la calibration la supposait a 50 — un piege
 * silencieux: un preset qui la change aurait fausse le grain sans que rien ne
 * le signale.
 *
 * Mesure du 2026-08-22, mire A a 1620 px, Grain 50, Taille 25:
 *
 *   Cassure |  ecart-type  |  grosseur  |  ce que ca veut dire
 *   --------+--------------+------------+----------------------------------
 *      0    |    31,65     |   1,02 px  | 1,72x PLUS de grain, meme finesse
 *     50    |    18,37     |   1,02 px  | la reference
 *    100    |    18,23     |   1,58 px  | meme force, grains 1,5x plus gros
 *
 * Elle etait donc tout sauf negligeable: a 0 elle fait presque DOUBLER le
 * grain. Et elle agit sur les deux axes separement — la force d'un cote, la
 * grosseur de l'autre — ce qui confirme une derniere fois que ces deux
 * grandeurs sont independantes chez lui.
 *
 * RESERVE: mesuree a UNE seule largeur (1620 px) et UNE seule Taille (25).
 * Elle est appliquee ici comme un facteur, c'est-a-dire avec l'hypothese de
 * separabilite que la mesure a refutee pour la Taille. A prendre pour ce
 * qu'elle est: bien mieux que de l'ignorer, pas une loi complete.
 */
export const GRAIN_CASSURE_DEFAUT = 50;

const GRAIN_CASSURE_MESUREE = [
    { cassure: 0, force: 18.37 / 31.65, grosseur: 1.00 },   // 0,5804
    { cassure: 50, force: 1.0000, grosseur: 1.00 },         // la reference
    { cassure: 100, force: 18.37 / 18.23, grosseur: 1.55 }, // 1,0077 et 1,58/1,02
];

function lireCassure(cassure, champ) {
    const c = Math.max(0, Math.min(100, Number.isFinite(cassure) ? cassure : GRAIN_CASSURE_DEFAUT));
    const points = GRAIN_CASSURE_MESUREE;
    for (let i = 1; i < points.length; i += 1) {
        if (c <= points[i].cassure) {
            const a = points[i - 1];
            const b = points[i];
            const part = (c - a.cassure) / (b.cassure - a.cassure);
            return a[champ] + part * (b[champ] - a[champ]);
        }
    }
    return points[points.length - 1][champ];
}

/* Ce que la Cassure fait a la FORCE (via l'echelle) et a la GROSSEUR. */
export const grainCassureForce = (cassure) => lireCassure(cassure, 'force');
export const grainCassureGrosseur = (cassure) => lireCassure(cassure, 'grosseur');

/*
 * ── LA TAILLE ET LA LARGEUR NE SE MULTIPLIENT PAS ────────────────────────
 *
 * Le modele etait un PRODUIT: une echelle de Taille, multipliee par une echelle
 * de largeur. Il etait exact sur les deux axes ou l'on avait mesure — la Taille
 * a 1620 px, la Taille 25 a toutes les largeurs — et personne n'avait regarde
 * ENTRE les deux.
 *
 * Six exports du 2026-08-22 (Tailles 10 et 40 a 1080, 3240 et 6480 px) ont
 * montre l'ecart. A Grain 50, ecart-type de son grain contre celui que le
 * produit predisait:
 *
 *   cas                 lui     le produit    ecart
 *   --------------------+-------+-----------+--------
 *   Taille 10, 1080 px  | 22,09 |   21,56   |  -2 %
 *   Taille 40, 1080 px  | 19,22 |   18,99   |  -1 %
 *   Taille 10, 3240 px  | 18,50 |   14,42   | -22 %
 *   Taille 40, 3240 px  |  9,53 |   10,79   | +13 %
 *   Taille 10, 6480 px  | 13,63 |    9,28   | -32 %
 *   Taille 40, 6480 px  |  6,83 |    6,96   |  +2 %
 *
 * L'effet du curseur Taille GRANDIT avec l'image. Le rapport entre sa Taille 10
 * et sa Taille 25 vaut 1,07 a 1080 px, 1,00 a 1620, 1,46 a 3240 et 1,67 a
 * 6480: sur une petite image les Tailles basses se ressemblent toutes — elles
 * butent sur le pixel — et sur une grande elles s'ecartent franchement. Aucun
 * produit ne peut rendre ca, et le « repli sous le pixel » qui remplacait cette
 * loi n'en etait qu'une moitie.
 *
 * D'ou une SURFACE mesuree, et non plus deux courbes multipliees. On interpole
 * DROIT ENTRE LES MESURES — en log-log sur la largeur, lineairement sur la
 * Taille — parce qu'entre deux mesures on ne sait rien de mieux.
 *
 * ── CE QUI EST MESURE, ET CE QUI EST DEDUIT ──────────────────────────────
 *
 * MESURE d'un bout a l'autre: les rangs Taille 10, 25 et 40 — ceux ou vivent
 * TOUS les presets livres (CN14 a 10, CN17 et CN18 a 40, le reste au defaut de
 * 25). Le rang Taille 100 a deux points mesures.
 *
 * DEDUIT: les rangs Taille 0 et Taille 50, qui n'ont qu'un point (a 1620 px) et
 * empruntent la forme du rang voisin. RESERVE: c'est exactement l'hypothese de
 * separabilite que la mesure vient de refuter — a prendre pour ce que c'est, un
 * pis-aller hors du domaine utile.
 */
const GRAIN_SURFACE_MESUREE = [
    {
        taille: 0,
        deduitDe: { taille: 10, facteur: 0.8020 }, // 18,37 / 22,91 a 1620 px
        points: [{ largeur: 1620, echelle: 0.8020 }],
    },
    {
        taille: 10,
        points: [
            { largeur: 1080, echelle: 0.8316 }, // 22,09
            { largeur: 1620, echelle: 1.0000 }, // 18,37
            { largeur: 3240, echelle: 0.9930 }, // 18,50
            { largeur: 6480, echelle: 1.3478 }, // 13,63
            /* Soustraction directe des exports CN14 avec/sans grain sur deux
               photos Samsung. Ces points ferment l'ancienne extrapolation qui
               etait encore 14 % trop forte sur le fichier 200 MP. */
            { largeur: 8160, echelle: 1.5241 }, // 6,10/255 observe a Grain 25
            { largeur: 16320, echelle: 2.2462 }, // 4,09/255 observe a Grain 25
        ],
    },
    {
        taille: 25,
        points: [
            { largeur: 810, echelle: 0.8454 },  // 21,73
            { largeur: 1080, echelle: 0.8879 }, // 20,69
            { largeur: 1620, echelle: 1.0000 }, // 18,37 — la reference
            { largeur: 3240, echelle: 1.4533 }, // 12,64
            { largeur: 6480, echelle: 2.2540 }, //  8,15
            { largeur: 9720, echelle: 2.6585 }, //  6,91
        ],
    },
    {
        taille: 40,
        points: [
            { largeur: 1080, echelle: 0.9558 }, // 19,22
            { largeur: 1620, echelle: 1.1716 }, // 15,68
            { largeur: 3240, echelle: 1.9276 }, //  9,53
            { largeur: 6480, echelle: 2.6896 }, //  6,83
            /* Deux photos Samsung 50/200 MP, exportees avec et sans grain sur
               CN17 et CN18. La difference directe des deux PNG isole le grain
               sans bruit de capteur. Les deux presets, ramenes a une valeur
               50, donnent respectivement 6,75 et 5,52/255. */
            { largeur: 8160, echelle: 2.7545 }, // 6,75/255 observe — moyenne CN17/CN18
            { largeur: 16320, echelle: 3.3237 }, // 5,62/255 observe — moyenne CN17/CN18
        ],
    },
    {
        taille: 50,
        deduitDe: { taille: 40, facteur: 1.3050 / 1.1716 },
        points: [{ largeur: 1620, echelle: 1.3050 }], // 14,08
    },
    {
        taille: 100,
        points: [
            { largeur: 1080, echelle: 1.3254 }, // 13,86
            { largeur: 1620, echelle: 1.9600 }, //  9,37
        ],
    },
];

/* Le rang guide: le seul mesure de 810 a 9720 px. C'est lui qui prete sa FORME
   aux autres quand on sort de leur domaine. */
const RANG_GUIDE = GRAIN_SURFACE_MESUREE.find((rang) => rang.taille === 25).points;

const penteEntre = (a, b) => Math.log(b.echelle / a.echelle) / Math.log(b.largeur / a.largeur);

/* Interpolation en log-log — la loi de puissance locale, la seule qu'on ait le
   droit d'ecrire entre deux mesures. Au-dela des bornes, la pente du segment
   terminal. */
function lireCourbe(points, largeur) {
    const lnL = Math.log(largeur);
    const n = points.length;
    if (n === 1) return points[0].echelle;
    if (largeur <= points[0].largeur) {
        const a = points[0];
        return a.echelle * Math.exp(penteEntre(a, points[1]) * (lnL - Math.log(a.largeur)));
    }
    for (let i = 1; i < n; i += 1) {
        if (largeur <= points[i].largeur) {
            const a = points[i - 1];
            return a.echelle * Math.exp(penteEntre(a, points[i]) * (lnL - Math.log(a.largeur)));
        }
    }
    const b = points[n - 1];
    return b.echelle * Math.exp(penteEntre(points[n - 2], b) * (lnL - Math.log(b.largeur)));
}

/*
 * Hors du domaine mesure d'un rang, il grandit COMME LE RANG GUIDE — on
 * applique la croissance relative du guide entre le bord du rang et la largeur
 * voulue. C'est continu par construction: au bord exact, le rapport vaut 1.
 *
 * (La version d'avant prenait une PENTE du guide, choisie selon les points qui
 * tombaient dans l'intervalle. Elle changeait par sauts des qu'un point de plus
 * entrait dans le compte, et l'echelle RECULAIT de 6,7 % en franchissant
 * 9720 px. Un test balaye desormais toute la plage pour l'interdire.)
 */
function echelleDansRang(points, largeur) {
    const premier = points[0];
    const dernier = points[points.length - 1];
    if (largeur >= premier.largeur && largeur <= dernier.largeur) return lireCourbe(points, largeur);
    const bord = largeur < premier.largeur ? premier : dernier;
    return bord.echelle * (lireCourbe(RANG_GUIDE, largeur) / lireCourbe(RANG_GUIDE, bord.largeur));
}

function echelleDuRang(rang, largeur) {
    if (!rang.deduitDe) return echelleDansRang(rang.points, largeur);
    const porteur = GRAIN_SURFACE_MESUREE.find((r) => r.taille === rang.deduitDe.taille);
    return echelleDansRang(porteur.points, largeur) * rang.deduitDe.facteur;
}

/*
 * L'echelle complete: on LIT la surface. Lineaire sur la Taille entre deux
 * rangs, log-log sur la largeur a l'interieur d'un rang.
 */
export function grainEchelle(taille, largeur, cassure = GRAIN_CASSURE_DEFAUT) {
    const l = Math.max(1, Number.isFinite(largeur) ? largeur : GRAIN_LARGEUR_REFERENCE);
    const t = Math.max(0, Math.min(100, Number.isFinite(taille) ? taille : GRAIN_TAILLE_DEFAUT));
    const rangs = GRAIN_SURFACE_MESUREE;
    const force = grainCassureForce(cassure);
    if (t <= rangs[0].taille) return echelleDuRang(rangs[0], l) * force;
    for (let i = 1; i < rangs.length; i += 1) {
        if (t <= rangs[i].taille) {
            const a = echelleDuRang(rangs[i - 1], l);
            const b = echelleDuRang(rangs[i], l);
            const part = (t - rangs[i - 1].taille) / (rangs[i].taille - rangs[i - 1].taille);
            return (a + part * (b - a)) * force;
        }
    }
    return echelleDuRang(rangs[rangs.length - 1], l) * force;
}

/* L'ecart-type a poser, en /255. Il BAISSE quand les grains grossissent: la
   quantite de grain est la meme, elle est etalee sur plus de pixels. */
export function grainSigma(valeur, taille, largeur, cassure = GRAIN_CASSURE_DEFAUT) {
    return (GRAIN_SIGMA_PAR_UNITE * valeur) / grainEchelle(taille, largeur, cassure);
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
export function grainPourRendu(valeur, taille, grandCoteSource, grandCoteRendu, cassure = GRAIN_CASSURE_DEFAUT) {
    const source = Math.max(1, Number.isFinite(grandCoteSource) ? grandCoteSource : grandCoteRendu);
    const rendu = Math.max(1, Number.isFinite(grandCoteRendu) ? grandCoteRendu : source);
    const echelleSource = grainEchelle(taille, source, cassure);
    const grosseurSource = grainGrosseurCalibree(taille, source, echelleSource, cassure);
    const sigmaSource = grainSigma(valeur, taille, source, cassure);
    const reduction = source / rendu;
    if (reduction <= 1) return { echelle: echelleSource, grosseur: grosseurSource, sigma: sigmaSource };
    const survie = Math.min(1, grosseurSource / reduction);
    return {
        echelle: Math.max(1, echelleSource / reduction),
        grosseur: Math.max(1, grosseurSource / reduction),
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
 * ── LA FORME DU GRAIN: TROIS CHOSES A NE PAS CONFONDRE ───────────────────
 *
 * 1. L'ECHELLE (`grainEchelle`) pilote la FORCE, et elle seule. Elle est
 *    mesuree sur dix exports, a 0,13 % pres. On n'y touche pas ici.
 * 2. LA GROSSEUR de ses grains n'est PAS cette echelle. Les deux coincident
 *    jusqu'a 2 px puis divergent — c'est mesure (voir la table ci-dessous).
 * 3. LE PAS d'interpolation n'est pas la grosseur non plus: un bruit interpole
 *    tous les `p` pixels ne rend pas des grains de `p` pixels.
 *
 * Le code melangeait 1 et 2: il visait une grosseur egale a l'echelle. Sur une
 * photo de 9180 px ca donnait des grains de 2,19 px la ou il en fait 2,29, et
 * sur une mire de 9720 px 2,92 contre 3,35.
 *
 * ── CE QU'IL FAIT, MESURE ────────────────────────────────────────────────
 *
 * Longueur de correlation de SON grain (metrique de `mesure-taille-grain.mjs`:
 * 1 + 2 x la somme des autocorrelations), en face de l'echelle que sa FORCE
 * implique. Douze exports, du 2026-08-20 au 2026-08-22:
 *
 *   son echelle | sa grosseur | d'ou
 *   ------------+-------------+------------------------------
 *      0,80     |    1,05     | Taille 0 a 1620 px
 *      0,85     |    1,05     | Taille 25 a 810 px
 *      0,89     |    1,04     | Taille 25 a 1080 px
 *      1,00     |    1,02     | Taille 25 a 1620 px
 *      1,17     |    1,12     | Taille 40 a 1620 px
 *      1,31     |    1,27     | Taille 50 a 1620 px
 *      1,33     |    1,31     | Taille 100 a 1080 px
 *      1,45     |    1,44     | Taille 25 a 3240 px
 *      1,96     |    1,96     | Taille 100 a 1620 px
 *      2,25     |    2,44     | Taille 25 a 6480 px
 *      2,66     |    3,35     | Taille 25 a 9720 px
 *
 * Deux choses s'y lisent. Sous 1, la grosseur PLAFONNE a un pixel — c'est le
 * repli, deja traite plus haut. Au-dessus de 2, elle DEPASSE l'echelle, et de
 * plus en plus: sa forme de grain change avec la taille de l'image, elle ne
 * fait pas que grandir.
 *
 * Que la Taille 100 a 1080 px (1,33 -> 1,31) tombe pile entre les points de la
 * serie de largeur n'etait pas acquis: ca dit que la grosseur est bien une
 * fonction de la seule echelle, quelle que soit la facon dont on y arrive.
 */
const GRAIN_GROSSEUR_MESUREE = [
    { echelle: 1.0000, grosseur: 1.02 },
    { echelle: 1.1716, grosseur: 1.12 },
    { echelle: 1.3050, grosseur: 1.27 },
    { echelle: 1.4533, grosseur: 1.44 },
    { echelle: 1.9600, grosseur: 1.96 },
    { echelle: 2.2540, grosseur: 2.44 },
    { echelle: 2.6585, grosseur: 3.35 },
];

/*
 * La grosseur a viser pour une echelle donnee. Sous 1, un pixel: on ne dessine
 * pas plus fin, et c'est ce qu'il fait aussi.
 *
 * RESERVE: au-dela de 2,66 (soit une image de plus de 9720 px), on prolonge
 * PROPORTIONNELLEMENT et non par la pente locale. Cette pente vaut 1,9 mais
 * elle n'est ajustee que sur UN intervalle; la prolonger doublerait la grosseur
 * a 12 000 px sur la foi de deux points. Le proportionnel est le choix prudent,
 * et il est marque comme tel.
 */
export function grainGrosseurCible(echelle, cassure = GRAIN_CASSURE_DEFAUT) {
    const parCassure = grainCassureGrosseur(cassure);
    if (!(echelle > 1)) return parCassure;
    const points = GRAIN_GROSSEUR_MESUREE;
    const dernier = points[points.length - 1];
    if (echelle >= dernier.echelle) return dernier.grosseur * (echelle / dernier.echelle) * parCassure;
    for (let i = 1; i < points.length; i += 1) {
        if (echelle <= points[i].echelle) {
            const a = points[i - 1];
            const b = points[i];
            const part = (echelle - a.echelle) / (b.echelle - a.echelle);
            return (a.grosseur + part * (b.grosseur - a.grosseur)) * parCassure;
        }
    }
    return dernier.grosseur * parCassure;
}

/*
 * Le 200 MP a revele que la forme et la force cessent de suivre la meme loi
 * au-dela du domaine des mires. Une soustraction directe des exports avec/sans
 * grain donne :
 *
 *   grand cote   Lightroom   ancien moteur   facteur de forme
 *      8160 px      3,86 px      3,52 px          1,096
 *     16320 px      6,80 px      4,17 px          1,633
 *
 * A Taille 10 (CN14), la correction de force ci-dessus grossirait au contraire
 * un peu trop la correlation : 1,53 px au lieu de 1,39 a 8160, et 2,45 au lieu
 * de 2,27 a 16320. La petite correction de forme mesuree vaut donc 0,912 puis
 * 0,928 (2,35 px rendus, soit +3,5 %, a cause de la garde anti-resonance).
 *
 * La force est portee par `grainEchelle`; ces facteurs ne changent QUE la
 * correlation spatiale. Ils demarrent apres le dernier format synthetique
 * valide (6480 px), et restent strictement limites aux Tailles 10 et 40.
 */
export function grainGrosseurCalibree(taille, largeur, echelle, cassure = GRAIN_CASSURE_DEFAUT) {
    const base = grainGrosseurCible(echelle, cassure);
    if (largeur <= 6480) return base;
    let points;
    if (Math.abs(taille - 10) <= 1e-9) {
        points = [
            { largeur: 6480, facteur: 1.000 },
            { largeur: 8160, facteur: 0.912 },
            { largeur: 16320, facteur: 0.928 },
        ];
    } else if (Math.abs(taille - 40) <= 1e-9) {
        points = [
            { largeur: 6480, facteur: 1.000 },
            { largeur: 8160, facteur: 1.096 },
            { largeur: 16320, facteur: 1.633 },
        ];
    } else {
        return base;
    }
    if (largeur >= points[points.length - 1].largeur) return base * points[points.length - 1].facteur;
    for (let i = 1; i < points.length; i += 1) {
        if (largeur <= points[i].largeur) {
            const a = points[i - 1];
            const b = points[i];
            const part = Math.log(largeur / a.largeur) / Math.log(b.largeur / a.largeur);
            return base * (a.facteur + part * (b.facteur - a.facteur));
        }
    }
    return base;
}

/*
 * ── LE PAS QUI DONNE UNE GROSSEUR, ET LES PAS INTERDITS ──────────────────
 *
 * Balayage du 2026-08-22 sur NOTRE champ, avec la metrique ci-dessus:
 *
 *   pas       1,10  1,30  1,55  1,80  2,05  2,30  2,55  2,80  3,05  3,30  3,80
 *   grosseur  1,68  1,96  2,37  2,71  3,09  3,47  3,85  4,21  4,58  4,93  5,72
 *
 * PAS INTERDITS. Aux pas ENTIERS et DEMI-ENTIERS, les points du reseau tombent
 * sur la grille des pixels et le champ cesse d'avoir un ecart-type de 1:
 *
 *   pas       1,50   2,00   2,50   3,00   4,00
 *   ecart-type 1,057  1,127  1,021  1,054  1,027
 *
 * A pas 2,00 c'est 12,7 % de grain en trop — et l'ancienne table avait
 * justement un point a pas 2,00 exactement. Une image de la bonne taille
 * tombait dessus et recevait 13 % de grain de trop, sans que rien ne le dise.
 * `eviterResonance` ecarte desormais le pas de ces valeurs.
 */
const PAS_MIN = 1.10;
const GROSSEUR_AU_PAS_MIN = 1.678;

const GROSSEUR_PAR_PAS = [
    { pas: 1.10, grosseur: 1.678 },
    { pas: 1.30, grosseur: 1.963 },
    { pas: 1.55, grosseur: 2.371 },
    { pas: 1.80, grosseur: 2.713 },
    { pas: 2.05, grosseur: 3.086 },
    { pas: 2.30, grosseur: 3.466 },
    { pas: 2.55, grosseur: 3.849 },
    { pas: 2.80, grosseur: 4.214 },
    { pas: 3.05, grosseur: 4.577 },
    { pas: 3.30, grosseur: 4.925 },
    { pas: 3.80, grosseur: 5.719 },
];

/* Ecarte le pas des valeurs entieres et demi-entieres, ou le reseau se cale sur
   la grille des pixels et gonfle l'ecart-type jusqu'a 13 %. */
function eviterResonance(pas) {
    const double = pas * 2;
    const proche = Math.round(double);
    return Math.abs(double - proche) < 0.12 ? (proche + 0.12) / 2 : pas;
}

export function grainPasInterpolation(grosseur) {
    const points = GROSSEUR_PAR_PAS;
    if (grosseur <= points[0].grosseur) return eviterResonance(PAS_MIN);
    for (let i = 1; i < points.length; i += 1) {
        if (grosseur <= points[i].grosseur) {
            const a = points[i - 1];
            const b = points[i];
            const part = (grosseur - a.grosseur) / (b.grosseur - a.grosseur);
            return eviterResonance(a.pas + part * (b.pas - a.pas));
        }
    }
    /* Au-dela du dernier point mesure, prolonge par sa pente finale. RESERVE:
       rien n'est mesure au-dessus d'une grosseur de 5,72 px. */
    const dernier = points[points.length - 1];
    const avant = points[points.length - 2];
    const pente = (dernier.pas - avant.pas) / (dernier.grosseur - avant.grosseur);
    return eviterResonance(dernier.pas + (grosseur - dernier.grosseur) * pente);
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
export function grainValeurEn(x, y, echelle, cassure = GRAIN_CASSURE_DEFAUT, grosseurForcee = null) {
    /* La FORME vise sa grosseur a lui, pas l'echelle: les deux ne sont pas le
       meme nombre au-dela de 2 px. La FORCE, elle, reste pilotee par
       `grainSigma` a partir de l'echelle — et ce champ garde un ecart-type de
       1 quel que soit le pas, c'est ce que `eviterResonance` protege. */
    const grosseur = grosseurForcee ?? grainGrosseurCible(echelle, cassure);
    /* Un pixel est le plus fin qu'on puisse dessiner. C'est le cas de la
       Taille 0, dont les grains sont plus fins que ca et qui se manifeste
       alors uniquement par un ecart-type plus fort. */
    if (grosseur <= 1.02) return bruitBlanc(x, y, 0);
    if (grosseur < GROSSEUR_AU_PAS_MIN) {
        /* Entre 1 et 1,68 px: melange, en quadrature, du bruit d'un pixel et du
           bruit interpole au pas minimal. */
        const part = (grosseur - 1) / (GROSSEUR_AU_PAS_MIN - 1);
        return Math.sqrt(1 - part) * bruitBlanc(x, y, DECALAGE_INDEPENDANT)
            + Math.sqrt(part) * bruitInterpole(x, y, PAS_MIN);
    }
    return bruitInterpole(x, y, grainPasInterpolation(grosseur));
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
 * ── LE GRAND COTE, PAS LA LARGEUR ────────────────────────────────────────
 *
 * Mesure du 2026-08-22: une mire de 2160x3240 exportee de Lightroom en
 * PORTRAIT rend un grain de 12,62 — exactement celui de la MEME mire en
 * paysage 3240x2160 (12,64). Si Lightroom lisait la largeur, la version
 * portrait aurait rendu 15,73.
 *
 * C'est donc le GRAND COTE de l'image qui compte, et l'orientation n'y change
 * rien. Une photo verticale de 9180x16320 est pour lui une image de 16320.
 * Notre moteur lisait 9180: 47 % d'ecart sur le grain de toute photo verticale.
 * Corrige dans `studioRenderer.js` (`grandCoteImage`).
 *
 * ── LES VRAIES PHOTOS ────────────────────────────────────────────────────
 *
 * CN14 (Grain 25, Taille 10, Cassure 50) a ete exporte avec et sans grain sur
 * deux photos Samsung. La soustraction directe des PNG retire le bruit de la
 * chaine sans approximation en quadrature :
 *
 *   grand cote | son grain | le notre | grosseur son/notre
 *   -----------+-----------+----------+--------------------
 *      8160 px |    6,10   |   6,10   | 1,39 / 1,40 px
 *     16320 px |    4,09   |   4,09   | 2,27 / 2,35 px
 *
 * La force tient a environ 1 %; la forme a +3,5 % au pire. Le petit ecart de
 * forme est la garde anti-resonance documentee plus haut, pas une extrapolation.
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
