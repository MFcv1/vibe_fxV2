export const MEDIA_TYPES = Object.freeze({
    VIDEO: 'video',
    IMAGE: 'image',
});

export const DEFAULT_IMAGE_DURATION_SECONDS = 4;
export const MIN_IMAGE_DURATION_SECONDS = 0.5;
export const MAX_IMAGE_DURATION_SECONDS = 60;

export const IMAGE_MOTION_PRESETS = Object.freeze([
    {
        id: 'none',
        name: 'Fixe',
        description: 'Cadre stable',
        start: { scale: 1, x: 0, y: 0 },
        end: { scale: 1, x: 0, y: 0 },
    },
    {
        id: 'zoom-in',
        name: 'Zoom avant',
        description: 'Approche douce',
        start: { scale: 1, x: 0, y: 0 },
        end: { scale: 1.14, x: 0, y: 0 },
    },
    {
        id: 'zoom-out',
        name: 'Zoom arriere',
        description: 'Ouverture progressive',
        start: { scale: 1.14, x: 0, y: 0 },
        end: { scale: 1, x: 0, y: 0 },
    },
    {
        id: 'pan-left',
        name: 'Pan gauche',
        description: 'Glissement lateral',
        start: { scale: 1.12, x: 0.055, y: 0 },
        end: { scale: 1.12, x: -0.055, y: 0 },
    },
    {
        id: 'pan-right',
        name: 'Pan droite',
        description: 'Glissement lateral',
        start: { scale: 1.12, x: -0.055, y: 0 },
        end: { scale: 1.12, x: 0.055, y: 0 },
    },
    {
        id: 'drift-up',
        name: 'Montee',
        description: 'Mouvement vertical',
        start: { scale: 1.1, x: 0, y: 0.045 },
        end: { scale: 1.14, x: 0, y: -0.045 },
    },
    /*
     * LOT B3 (2026-08-03) - trois mouvements de plus, et DEUX GENERALISATIONS
     * du modele, chacune reprise a l'identique par `buildImageMotionFilter` du
     * renderer.
     *
     * Jusqu'ici un mouvement etait une DROITE entre deux cadrages, parcourue en
     * `smoothstep`. C'est ce qui rendait la parite demontrable par construction,
     * et il ne faut pas le perdre. Les deux ajouts gardent donc la meme forme -
     * deux cadrages, une courbe - et n'ajoutent qu'un nombre chacun :
     *
     *  - `arc`  : un ECART PERPENDICULAIRE au trajet, nul aux deux bouts et
     *             maximal au milieu (`sin(PI * eased)`). C'est ce qui distingue
     *             une orbite d'un simple panoramique : la trajectoire est
     *             courbe, pas droite.
     *  - `curve`: `overshoot` remplace le `smoothstep` par une courbe qui DEPASSE
     *             sa cible avant de se poser (back-out classique). C'est ce qui
     *             fait un rebond ; un `smoothstep` ne rebondit pas, il accoste.
     *
     * Les deux restent des POLYNOMES ou un sinus, donc s'ecrivent tels quels
     * dans une expression FFmpeg - c'est la condition qui a fait ecarter tout le
     * reste (voir le journal du lot B3 dans todo.md).
     *
     * PROBLEME I : chaque preset doit tenir |x| et |y| <= (zoom - 1) / 2 A TOUT
     * INSTANT, pas seulement aux deux bouts - un depassement ou une bosse
     * peuvent sortir du cadre en cours de route la ou les extremites sont
     * sages. `smoke-vibecut-motion-envelope.mjs` echantillonne la trajectoire
     * entiere de chaque preset et le verifie.
     */
    {
        id: 'drift-down',
        name: 'Descente',
        description: 'Mouvement vertical descendant',
        start: { scale: 1.14, x: 0, y: -0.045 },
        end: { scale: 1.1, x: 0, y: 0.045 },
    },
    {
        id: 'orbit',
        name: 'Orbite',
        description: 'Trajet courbe autour du sujet',
        start: { scale: 1.16, x: -0.05, y: 0 },
        end: { scale: 1.16, x: 0.05, y: 0 },
        // Bombement vers le HAUT au milieu du trajet: le cadre contourne le
        // sujet au lieu de le longer.
        arc: 0.045,
    },
    /*
     * ROTATION (2026-08-04). Le premier mouvement qui ne se ramene pas a un
     * recadrage: il fait BASCULER l'image, ce qui demande le filtre `rotate` du
     * renderer et un `ctx.rotate` a l'apercu.
     *
     * Une image qui bascule laisse des COINS VIDES. Il faut donc l'agrandir
     * assez pour que le cadre reste couvert - c'est `rotationCoverage`, calcule
     * a l'identique des deux cotes a partir de l'angle ET du format. En 16:9,
     * 3 degres coutent 9,2 % de zoom; en carre, 5,1 %. Ce facteur ne peut donc
     * pas etre une constante: il depend du format de sortie.
     */
    /*
     * APPARITION (2026-08-04). Le seul mouvement qui touche a l'OPACITE et pas
     * seulement au cadrage: l'image monte du noir en meme temps qu'elle se pose.
     *
     * `fadeInRatio` est une FRACTION du plan et non des secondes: sur un plan
     * court, une entree d'une demi-seconde mangerait la moitie du plan. Le
     * renderer la convertit en NUMEROS D'IMAGE (`fade=start_frame/nb_frames`)
     * plutot qu'en secondes, ce qui la rend independante des horodatages - les
     * memes qui ont fait perdre une image au lot B3b.
     *
     * Le zoom part de 1,06 et se pose a 1: l'image ne descend JAMAIS sous 1,
     * donc elle ne laisse pas de bord (contrairement au « scale 0,94 » que la
     * fiche d'origine promettait).
     */
    {
        id: 'appear',
        name: 'Apparition',
        description: 'Entree en fondu, l’image se pose',
        start: { scale: 1.06, x: 0, y: 0 },
        end: { scale: 1, x: 0, y: 0 },
        fadeInRatio: 0.3,
    },
    {
        id: 'rotate',
        name: 'Rotation',
        description: 'Legere bascule de l’image',
        start: { scale: 1, x: 0, y: 0, rotate: -3 },
        end: { scale: 1, x: 0, y: 0, rotate: 3 },
    },
    {
        id: 'bounce',
        name: 'Rebond',
        description: 'Arrivee qui depasse puis se pose',
        start: { scale: 1.18, x: 0, y: 0.05 },
        end: { scale: 1.04, x: 0, y: 0 },
        curve: 'overshoot',
    },
    /*
     * GLITCH (2026-08-04). Le seul mouvement qui NE PARCOURT RIEN: ses deux
     * cadrages sont identiques. Ce qui bouge est un DECROCHAGE - le cadre saute
     * lateralement, tient sa position quelques images, puis revient.
     *
     * POURQUOI UN ESCALIER ET NON UNE OSCILLATION. Une secousse (`shake`) est un
     * sinus: elle tremble en continu. Un decrochage numerique est DISCONTINU par
     * nature - l'image tient, saute d'un coup, tient encore. Ecrire un glitch
     * comme un sinus rapide donnait un flou de vibration, pas un decrochage.
     *
     * LE MOTIF EST EN MAJORITE A ZERO, et c'est ce qui le rend « bref »: sur huit
     * paliers, cinq laissent le cadre en place. Un motif dense se lit comme une
     * panne permanente, pas comme un accident.
     *
     * HORIZONTAL SEULEMENT. Un decrochage video decroche en ligne; ajouter du
     * vertical le fait ressembler a une secousse, ce que `shake` fait deja mieux.
     *
     * PROBLEME I: le zoom vaut 1,08 aux deux bouts, donc la marge est de 0,04
     * pour une amplitude de 0,03 (75 % de la marge). Contrairement aux autres
     * presets, ce zoom n'est pas la pour cadrer: il n'existe QUE pour payer le
     * decalage, exactement comme le `zoomBoost` de la secousse.
     */
    {
        id: 'glitch',
        name: 'Glitch',
        description: 'Decrochages horizontaux brefs',
        start: { scale: 1.08, x: 0, y: 0 },
        end: { scale: 1.08, x: 0, y: 0 },
        jitter: 0.03,
    },
]);

/*
 * LE DECROCHAGE, ecrit une fois. `buildImageMotionFilter` du renderer le reecrit
 * en expression FFmpeg, et `smoke-vibecut-motion-preview-parity` compare les deux
 * sur des IMAGES.
 *
 * LA CADENCE EST EN HERTZ, comme les accents: un decrochage doit sauter a la
 * meme vitesse sur un plan de 2 s et sur un plan de 10 s.
 *
 * 11,37 Hz, ET CE NOMBRE N'EST PAS ROND EXPRES. Le palier se lit
 * `floor(secondes * cadence)`, donc une frontiere de palier qui tomberait
 * EXACTEMENT sur un instant d'image ferait dependre le resultat du dernier bit
 * du calcul flottant: l'apercu et l'export liraient alors des paliers voisins et
 * l'ecart vaudrait tout un saut, pas une fraction de pixel. Avec 11,37, aucune
 * frontiere ne coincide avec une image a 24, 25, 30 ni 60 im/s - c'est le meme
 * raisonnement qui a fait ecarter une cadence de 12 (a 30 im/s, une frontiere
 * tombe sur une image toutes les cinq).
 *
 * C'est aussi pour ca que le calcul part des SECONDES et non de la progression:
 * les secondes valent `on/fps` cote renderer et `progression x duree` cote
 * apercu, et ces deux ecritures coincident. La progression, elle, vaut
 * `on/(images-1)` cote renderer et `image/(fps x duree)` cote apercu - un ecart
 * d'une image, sans consequence sur une courbe lisse, fatal sur un escalier.
 */
export const GLITCH_RATE_HZ = 11.37;
export const GLITCH_PATTERN = Object.freeze([0, 0, 1, 0, -0.7, 0, 0.45, 0]);

export function resolveGlitchOffset(amount, intensity, seconds) {
    const reach = finiteNumber(amount, 0);
    if (!reach) return 0;
    const gain = clamp(finiteNumber(intensity, 1), 0, 1);
    const time = Math.max(0, finiteNumber(seconds, 0));
    const index = Math.floor(time * GLITCH_RATE_HZ);
    const slot = index % GLITCH_PATTERN.length;
    return reach * gain * GLITCH_PATTERN[slot];
}

/*
 * Le depassement du `rebond`. Constantes du back-out classique: la courbe vaut
 * 0 en 0, 1 en 1, et culmine a ~1,099 vers p = 0,63. C'est ce depassement de
 * ~10 % qui fait passer le cadrage AU-DELA de sa cible avant qu'il ne revienne.
 * Doit rester identique a `buildImageMotionFilter` du renderer.
 */
export const OVERSHOOT_C1 = 1.70158;
export const OVERSHOOT_C3 = OVERSHOOT_C1 + 1;

/*
 * LES ACCENTS - les premiers "effets pendant le plan" (lot B3, 2026-08-04).
 *
 * Un mouvement va d'un cadrage a un autre. Un ACCENT, lui, ne va nulle part: il
 * OSCILLE pendant toute la duree du plan. C'est ce qui manquait au produit -
 * secousse, respiration - et c'est ce que Premiere et DaVinci ont depuis
 * toujours.
 *
 * POURQUOI CES DEUX-LA D'ABORD, et pas le grain ou le flou anime. Les deux
 * s'expriment comme un decalage du CADRAGE, donc ils entrent dans l'expression
 * `zoompan` qui existe deja et dont la parite est prouvee image par image. Le
 * grain (bruit tire par pixel) et le flou anime (chaine de filtres) demandent
 * chacun une autre mecanique et une autre preuve : ils viendront apres.
 *
 * LA FREQUENCE EST EN HERTZ, pas en cycles par plan. Une secousse doit trembler
 * a la meme vitesse sur un plan de 2 s et sur un plan de 10 s ; en cycles par
 * plan, le plan long tremblerait au ralenti. C'est pour ca que le calcul a
 * besoin de la DUREE et pas seulement de la progression.
 *
 * DEUX FREQUENCES DIFFERENTES sur x et y, et un dephasage: avec une seule
 * frequence, le cadre oscillerait sur une DIAGONALE parfaite, ce qui se lit
 * comme un glissement et pas comme une secousse.
 *
 * 3,7 et 4,9 Hz, ET C'EST MESURE. Le premier jet etait a 7,5 et 9,1 Hz: a
 * 30 images par seconde, cela ne fait que 4,0 et 3,3 echantillons par cycle -
 * la secousse se lit alors comme un saut a quatre positions, pas comme un
 * tremblement, et elle depend de la cadence choisie a l'export. A 3,7 et
 * 4,9 Hz on est a 8,1 et 6,1 echantillons par cycle a 30 images/s, le double a
 * 60. C'est aussi la plage d'une vraie camera portee (1 a 5 Hz).
 */
export const IMAGE_MOTION_ACCENTS = Object.freeze([
    { id: 'none', name: 'Aucun', description: 'Pas d’accent' },
    {
        id: 'shake',
        name: 'Secousse',
        description: 'Tremblement continu, caméra portée',
        amplitude: 0.012,
        freqX: 3.7,
        freqY: 4.9,
        phaseY: 1.7,
        /*
         * PROBLEME I. Un decalage exige de la marge: |x| <= (zoom - 1) / 2. A
         * zoom 1 la marge est NULLE, donc une secousse posee sur un plan fixe
         * sortirait du cadre. On s'octroie donc le zoom qu'il faut - 0,03 donne
         * une marge de 0,015 pour une amplitude de 0,012. C'est exactement ce
         * qu'on fait en tournage: on cadre plus large avant de stabiliser.
         */
        zoomBoost: 0.03,
    },
    {
        id: 'pulse',
        name: 'Respiration',
        description: 'Zoom qui pulse doucement',
        amplitude: 0.05,
        freq: 1.2,
        zoomBoost: 0,
    },
    /*
     * LES ACCENTS D'IMAGE (2026-08-04) - la deuxieme famille d'effets pendant le
     * plan, et elle ne marche PAS comme la premiere.
     *
     * `shake` et `pulse` sont des accents de CADRAGE : ils se ramenent a un
     * decalage de la fenetre, donc ils entrent dans l'expression `zoompan` qui
     * existe deja et dont la parite est prouvee image par image. C'est pour ca
     * qu'ils ont ete livres en premier.
     *
     * Ces trois-la ne se ramenent a aucun cadrage : ils modifient l'IMAGE
     * elle-meme, apres le recadrage. Ils ont donc leur propre chemin des deux
     * cotes - un calque pose sur le canvas a l'apercu, une chaine de filtres
     * apres le `zoompan` a l'export - et c'est `kind: 'image'` qui les distingue.
     *
     * LA FREQUENCE RESTE EN HERTZ, pour la meme raison que les deux premiers :
     * une respiration de flou doit battre a la meme vitesse sur un plan de 2 s
     * et sur un plan de 10 s.
     */
    {
        id: 'leak',
        kind: 'image',
        name: 'Fuite de lumière',
        description: 'Halo chaud qui traverse et respire',
        /*
         * Deux mouvements INDEPENDANTS, et c'est ce qui fait qu'une fuite de
         * lumiere ne se lit pas comme un clignotant : le halo TRAVERSE le cadre
         * (`sweepFreq`) pendant que son intensite RESPIRE (`freq`). Avec une
         * seule frequence, les deux seraient synchronises et l'oeil verrait un
         * motif qui se repete.
         */
        amount: 0.45,
        freq: 0.55,
        sweepFreq: 0.23,
        radius: 0.85,
        tint: '0xffb432',
        // (1-cos)/2 reste dans [0,1] : l'alpha ne devient jamais negatif.
        zoomBoost: 0,
    },
    {
        id: 'grain',
        kind: 'image',
        name: 'Grain',
        description: 'Grain argentique animé',
        /*
         * LE GRAIN EST LE SEUL EFFET DU PRODUIT DONT LA PARITE NE PEUT PAS ETRE
         * EXACTE, et il faut le dire ici plutot que de le decouvrir au test.
         * FFmpeg (`noise`) tire un nombre aleatoire PAR PIXEL ET PAR IMAGE, avec
         * son propre generateur. Aucun canvas ne reproduira cette suite. Le meme
         * ecart existe deja, documente et borne, sur le grain de
         * `film-dissolve`.
         * Ce qui est prouvable, et ce que le test mesure : que les deux cotes
         * ajoutent la MEME QUANTITE de bruit, via l'ecart-type des pixels.
         */
        amount: 14,
        zoomBoost: 0,
    },
    {
        id: 'softness',
        kind: 'image',
        name: 'Flou animé',
        description: 'Netteté qui respire',
        /*
         * Sigma exprime en FRACTION DE LA LARGEUR et non en pixels : un flou de
         * 6 px sur une vignette de 320 et sur un export 1080p ne sont pas le
         * meme flou. C'est la meme regle que les flous des transitions.
         */
        amount: 0.006,
        freq: 0.7,
        zoomBoost: 0,
    },
]);

/*
 * Les accents d'IMAGE ne passent pas par `zoompan`. Les separer ici evite que
 * chaque appelant reecrive le test, et surtout que l'un des deux cotes l'oublie.
 */
export function isImageAccent(id) {
    return getMotionAccent(id).kind === 'image';
}

const ACCENT_BY_ID = new Map(IMAGE_MOTION_ACCENTS.map((accent) => [accent.id, accent]));

export function getMotionAccent(id) {
    return ACCENT_BY_ID.get(id) || ACCENT_BY_ID.get('none');
}

/*
 * L'oscillation, ecrite UNE fois. `buildImageMotionFilter` du renderer la
 * reecrit en expression FFmpeg, et `smoke-vibecut-motion-preview-parity` compare
 * les deux sur des images, pas sur les formules.
 *
 * `seconds` est le temps ECOULE DANS LE PLAN, pas la progression: c'est ce qui
 * rend la frequence independante de la duree.
 */
/*
 * LES ACCENTS D'IMAGE, resolus une fois. Le renderer reecrit exactement ces
 * memes formules en expressions FFmpeg, et `smoke-vibecut-motion-preview-parity`
 * compare des IMAGES.
 *
 * Retourne toujours les trois grandeurs, a zero pour les accents qui ne les
 * portent pas : un appelant n'a donc jamais a savoir QUEL accent est pose.
 */
/*
 * LE FLOU DE L'EXPORT EST UN ESCALIER, pas une rampe. `gblur` n'accepte pas
 * d'expression pour son sigma et `sendcmd` est proscrit (il diffuse a tous les
 * filtres du meme nom - lecon du lot B3b) : le renderer pose donc une chaine de
 * flous a valeur CONSTANTE, un par palier, gates par `enable`.
 * L'apercu lit le MEME palier, exactement comme `quantizeProgress` le fait pour
 * les transitions. Sans ca, il montrerait un flou plus lisse que l'export -
 * mesure du 2026-08-04 : rapport d'amplitude 0,74 au lieu de 1.
 * Doit rester identique a ACCENT_BLUR_STEPS de render-service/src/server.js.
 */
export const ACCENT_BLUR_STEPS = 24;

export function resolveAccentImage(accentId, intensity, seconds, durationSeconds) {
    const accent = getMotionAccent(accentId);
    const none = { leakAlpha: 0, leakSweep: 0, leakRadius: 0, grain: 0, blurRatio: 0 };
    if (accent.kind !== 'image') return none;
    const gain = clamp(finiteNumber(intensity, 1), 0, 1);
    const time = Math.max(0, finiteNumber(seconds, 0));
    if (accent.id === 'leak') {
        // (1-cos)/2 dans [0,1] : le halo s'eteint completement mais ne devient
        // jamais un trou noir, ce qu'un sinus signe ferait.
        const breath = (1 - Math.cos(2 * Math.PI * accent.freq * time)) / 2;
        return {
            ...none,
            leakAlpha: accent.amount * gain * breath,
            // Balayage cyclique de 0 a 1, independant de la respiration.
            leakSweep: (accent.sweepFreq * time) % 1,
            leakRadius: accent.radius,
        };
    }
    if (accent.id === 'grain') return { ...none, grain: accent.amount * gain };
    if (accent.id === 'softness') {
        // Le sigma est celui du MILIEU du palier, comme cote renderer: prendre
        // son debut decalerait tout le flou d'un demi-palier.
        const duration = Math.max(0.001, finiteNumber(durationSeconds, DEFAULT_IMAGE_DURATION_SECONDS));
        const step = Math.min(
            ACCENT_BLUR_STEPS - 1,
            Math.floor((time / duration) * ACCENT_BLUR_STEPS),
        );
        const midTime = ((step + 0.5) / ACCENT_BLUR_STEPS) * duration;
        const breath = (1 - Math.cos(2 * Math.PI * accent.freq * midTime)) / 2;
        return { ...none, blurRatio: accent.amount * gain * breath };
    }
    return none;
}

export function resolveAccentOffset(accentId, intensity, seconds) {
    const accent = getMotionAccent(accentId);
    const gain = clamp(finiteNumber(intensity, 1), 0, 1);
    const time = Math.max(0, finiteNumber(seconds, 0));
    if (accent.id === 'shake') {
        const amount = accent.amplitude * gain;
        return {
            scale: accent.zoomBoost * gain,
            x: amount * Math.sin(2 * Math.PI * accent.freqX * time),
            y: amount * Math.sin(2 * Math.PI * accent.freqY * time + accent.phaseY),
        };
    }
    if (accent.id === 'pulse') {
        // (1 - cos)/2 va de 0 a 1 sans jamais devenir negatif: le zoom ne passe
        // donc jamais SOUS son cadrage de base, et l'image ne montre pas de bord.
        const breath = (1 - Math.cos(2 * Math.PI * accent.freq * time)) / 2;
        return { scale: accent.amplitude * gain * breath, x: 0, y: 0 };
    }
    return { scale: 0, x: 0, y: 0 };
}

const IMAGE_MOTION_BY_ID = new Map(IMAGE_MOTION_PRESETS.map((preset) => [preset.id, preset]));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finiteNumber = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export function normalizeMediaType(source = {}) {
    if (source.mediaType === MEDIA_TYPES.IMAGE || source.mediaType === MEDIA_TYPES.VIDEO) {
        return source.mediaType;
    }
    const mimeType = String(source.mimeType || source.type || source.file?.type || '').toLowerCase();
    return mimeType.startsWith('image/') ? MEDIA_TYPES.IMAGE : MEDIA_TYPES.VIDEO;
}

export function isImageMedia(source = {}) {
    return normalizeMediaType(source) === MEDIA_TYPES.IMAGE;
}

export function normalizeImageDuration(value, fallback = DEFAULT_IMAGE_DURATION_SECONDS) {
    return clamp(
        finiteNumber(value, fallback),
        MIN_IMAGE_DURATION_SECONDS,
        MAX_IMAGE_DURATION_SECONDS
    );
}

/*
 * Intensite du mouvement (lot L3, 2026-07-30).
 *
 * Un seul facteur applique a l'ECART start -> end. C'est volontairement la
 * formule la plus pauvre possible, parce que c'est celle que le renderer peut
 * ecrire a l'identique dans son expression `zoompan`: la parite apercu/export
 * est alors garantie par construction, pas par surveillance.
 * Le cadrage de DEPART ne bouge pas: baisser l'intensite raccourcit la course,
 * il ne recadre pas la photo.
 */
export const MIN_IMAGE_MOTION_INTENSITY = 0;
export const MAX_IMAGE_MOTION_INTENSITY = 1;
export const DEFAULT_IMAGE_MOTION_INTENSITY = 1;

export function normalizeImageMotionIntensity(value, fallback = DEFAULT_IMAGE_MOTION_INTENSITY) {
    return clamp(
        finiteNumber(value, fallback),
        MIN_IMAGE_MOTION_INTENSITY,
        MAX_IMAGE_MOTION_INTENSITY
    );
}

export function normalizeImageMotion(motion = 'none') {
    const requested = typeof motion === 'string' ? motion : motion?.preset;
    const preset = IMAGE_MOTION_BY_ID.get(requested) || IMAGE_MOTION_BY_ID.get('none');
    const custom = typeof motion === 'object' && motion ? motion : {};
    const normalizeFrame = (frame, presetFrame) => ({
        scale: clamp(finiteNumber(frame?.scale, presetFrame.scale), 1, 2),
        x: clamp(finiteNumber(frame?.x, presetFrame.x), -0.35, 0.35),
        y: clamp(finiteNumber(frame?.y, presetFrame.y), -0.35, 0.35),
        // Degres. Borne serre: au-dela, le zoom de couverture mange l'image.
        rotate: clamp(finiteNumber(frame?.rotate, presetFrame.rotate || 0), -8, 8),
    });

    return {
        preset: preset.id,
        easing: custom.easing === 'linear' ? 'linear' : 'ease-in-out',
        intensity: normalizeImageMotionIntensity(custom.intensity),
        start: normalizeFrame(custom.start, preset.start),
        end: normalizeFrame(custom.end, preset.end),
        /*
         * `arc` et `curve` viennent du PRESET, jamais du reglage utilisateur.
         * L'editeur de trajectoire de /video/mouvements deplace les deux
         * cadrages, il ne redessine pas la forme du trajet - et surtout, le
         * manifeste d'export ne transporte que l'ID du preset : le renderer
         * relit `arc` et `curve` dans SA copie de la table. Les laisser
         * personnalisables les rendrait invisibles cote serveur, donc faux.
         */
        arc: Number(preset.arc) || 0,
        curve: preset.curve === 'overshoot' ? 'overshoot' : 'smoothstep',
        fadeInRatio: clamp(finiteNumber(preset.fadeInRatio, 0), 0, 0.9),
        // Comme `arc` et `curve`: propriete du PRESET, jamais du reglage. Le
        // manifeste ne transporte que l'id, le renderer relit la valeur chez lui.
        jitter: clamp(finiteNumber(preset.jitter, 0), 0, 0.2),
        /*
         * L'ACCENT, lui, est un REGLAGE et non une propriete du preset: il se
         * compose avec n'importe quel mouvement (une secousse sur un zoom
         * avant), et il voyage donc dans le manifeste.
         */
        accent: getMotionAccent(custom.accent).id,
        accentIntensity: normalizeImageMotionIntensity(custom.accentIntensity),
    };
}

/*
 * `durationSeconds` sert UNIQUEMENT aux accents, dont la frequence est en hertz.
 * Une valeur par defaut garde tous les appelants existants valides: sans accent,
 * le resultat ne depend pas de la duree.
 */
export function resolveImageMotionFrame(motion, progress = 0, durationSeconds = DEFAULT_IMAGE_DURATION_SECONDS) {
    const normalized = normalizeImageMotion(motion);
    const rawProgress = clamp(finiteNumber(progress, 0), 0, 1);
    // `smoothstep`. Le renderer porte la MEME courbe depuis le lot L3
    // (`buildImageMotionFilter`): un zoom qui part doucement ici partait sec
    // a l'export, et ce defaut existait depuis l'origine.
    let easedProgress;
    if (normalized.easing === 'linear') {
        easedProgress = rawProgress;
    } else if (normalized.curve === 'overshoot') {
        // Back-out: depasse la cible puis se pose. Voir OVERSHOOT_C1/C3.
        const back = rawProgress - 1;
        easedProgress = 1 + OVERSHOOT_C3 * back * back * back + OVERSHOOT_C1 * back * back;
    } else {
        easedProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);
    }
    const travel = easedProgress * normalized.intensity;
    const mix = (start, end) => start + (end - start) * travel;

    /*
     * Le bombement de l'orbite. Sa PHASE suit `easedProgress` et non `travel`:
     * sinon, a intensite reduite, le sinus n'aurait pas fini son demi-tour a la
     * fin du plan et le cadre resterait devie. Seule son AMPLITUDE suit
     * l'intensite - baisser l'intensite retrecit l'orbite, elle ne la coupe pas
     * en plein milieu.
     */
    const arc = normalized.arc
        ? normalized.arc * normalized.intensity * Math.sin(Math.PI * easedProgress)
        : 0;

    const duration = Math.max(0.001, finiteNumber(durationSeconds, DEFAULT_IMAGE_DURATION_SECONDS));
    const seconds = rawProgress * duration;
    const accent = resolveAccentOffset(normalized.accent, normalized.accentIntensity, seconds);
    /*
     * Le decrochage suit l'INTENSITE du mouvement et non celle de l'accent: il
     * appartient au preset, c'est donc le curseur du mouvement qui le dose.
     */
    const glitch = resolveGlitchOffset(normalized.jitter, normalized.intensity, seconds);

    return {
        preset: normalized.preset,
        intensity: normalized.intensity,
        progress: easedProgress,
        accent: normalized.accent,
        scale: mix(normalized.start.scale, normalized.end.scale) + accent.scale,
        x: mix(normalized.start.x, normalized.end.x) + accent.x + glitch,
        y: mix(normalized.start.y, normalized.end.y) - arc + accent.y,
        rotate: mix(normalized.start.rotate, normalized.end.rotate),
        /*
         * L'opacite monte LINEAIREMENT, comme le `fade` de FFmpeg - et non en
         * `smoothstep` comme le cadrage. Les deux cotes doivent lire la meme
         * rampe, et c'est celle du filtre qui fait foi.
         */
        opacity: normalized.fadeInRatio > 0
            ? clamp(rawProgress / normalized.fadeInRatio, 0, 1) * normalized.intensity
                + (1 - normalized.intensity)
            : 1,
    };
}

/*
 * Transformation de cadrage d'une photo animee, telle que l'apercu la pose.
 *
 * Extraite de `VideoEngine.drawFilteredSource` au lot L3 pour que le test de
 * parite mesure le code de PRODUCTION et non une copie: ce module n'a aucun
 * import, il se charge donc tel quel dans un Chromium de test.
 *
 * Un point source (u, v) atterrit en X = s*(u - w/2) + w/2 + x*w, donc l'apercu
 * echantillonne u = X/s + (w - w/s)/2 - (x/s)*w. C'est cette derniere forme que
 * l'expression `zoompan` du renderer doit reproduire — le `/s` sur le decalage
 * inclus, sans lui un panoramique voyage ~11 % trop loin a l'export.
 */
/*
 * L'AGRANDISSEMENT QU'EXIGE UNE BASCULE.
 *
 * Une image tournee de `deg` ne couvre plus le cadre: il reste des coins vides.
 * Le facteur ci-dessous est le plus petit qui les remplit, et il DEPEND DU
 * FORMAT - en 16:9 trois degres coutent 9,2 % de zoom, en carre seulement 5,1 %.
 * Une constante serait donc soit insuffisante en 16:9, soit inutilement
 * destructrice en carre.
 *
 * Le renderer calcule exactement la meme chose a partir de ses dimensions de
 * sortie: c'est ce qui rend la parite exacte malgre un filtre different de
 * chaque cote.
 */
export function rotationCoverage(degrees, width, height) {
    const radians = (finiteNumber(degrees, 0) * Math.PI) / 180;
    if (!radians) return 1;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const w = Math.max(1, finiteNumber(width, 1));
    const h = Math.max(1, finiteNumber(height, 1));
    return Math.max((w * cos + h * sin) / w, (w * sin + h * cos) / h);
}

/*
 * LE BORD, ET POURQUOI IL FAUT LE FABRIQUER.
 *
 * Piege deja paye sur les flous des transitions le 2026-08-02, et repaye ici
 * faute d'y avoir pense : FFmpeg echantillonne HORS CADRE en RABATTANT SUR LE
 * BORD, le canvas en prenant du TRANSPARENT. Un `ctx.filter = blur()` pose tel
 * quel delave donc les quatre bords sur une bande de ~3 sigma, ce que l'export
 * ne fait pas.
 *
 * Mesure du 2026-08-04 : sans cette correction, l'amplitude du flou valait 3,66
 * a l'export contre 6,17 a l'apercu - un rapport de 0,59, tres au-dela de la
 * bande admise. L'ecart ne venait pas du sigma mais des bords.
 *
 * On reconstruit donc une image bordee par ETIREMENT du bord, puis on la floute:
 * c'est exactement ce que fait FFmpeg.
 */
function buildEdgeClampedFrame(source, width, height, margin) {
    const canvas = document.createElement('canvas');
    canvas.width = width + margin * 2;
    canvas.height = height + margin * 2;
    const ctx = canvas.getContext('2d');
    // Coeur, puis les quatre cotes etires, puis les quatre coins.
    ctx.drawImage(source, 0, 0, width, height, margin, margin, width, height);
    ctx.drawImage(source, 0, 0, width, 1, margin, 0, width, margin);
    ctx.drawImage(source, 0, height - 1, width, 1, margin, height + margin, width, margin);
    ctx.drawImage(source, 0, 0, 1, height, 0, margin, margin, height);
    ctx.drawImage(source, width - 1, 0, 1, height, width + margin, margin, margin, height);
    ctx.drawImage(source, 0, 0, 1, 1, 0, 0, margin, margin);
    ctx.drawImage(source, width - 1, 0, 1, 1, width + margin, 0, margin, margin);
    ctx.drawImage(source, 0, height - 1, 1, 1, 0, height + margin, margin, margin);
    ctx.drawImage(source, width - 1, height - 1, 1, 1, width + margin, height + margin, margin, margin);
    return canvas;
}

/*
 * Une TUILE DE BRUIT, fabriquee une fois. Regenerer un bruit plein cadre a
 * chaque image couterait, a 1080p, plus cher que tout le reste du dessin reuni;
 * une tuile de 128 posee en mosaique avec un decalage different a chaque image
 * donne le meme grain mouvant pour une fraction du prix.
 *
 * La parite de cet effet est STATISTIQUE et pas exacte - voir la note de
 * l'accent `grain`. Ce qui doit coincider est la QUANTITE de bruit ajoutee,
 * mesuree par l'ecart-type des pixels, pas la suite tiree.
 */
const GRAIN_TILE_SIZE = 128;
let grainTile = null;

function getGrainTile() {
    if (grainTile) return grainTile;
    const canvas = document.createElement('canvas');
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    for (let i = 0; i < image.data.length; i += 4) {
        const value = Math.random() * 255;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    grainTile = canvas;
    return grainTile;
}

/*
 * LES CALQUES D'ACCENT, poses APRES le dessin du plan et hors du recadrage -
 * exactement ou le renderer les pose, c'est-a-dire apres son `zoompan`. Les
 * poser avant les ferait zoomer avec l'image, et un grain qui zoome n'est plus
 * du grain.
 */
export function drawImageAccent(ctx, motion, progress, width, height, durationSeconds) {
    const normalized = normalizeImageMotion(motion);
    if (!isImageAccent(normalized.accent)) return;
    const duration = Math.max(0.001, finiteNumber(durationSeconds, DEFAULT_IMAGE_DURATION_SECONDS));
    const seconds = clamp(finiteNumber(progress, 0), 0, 1) * duration;
    const values = resolveAccentImage(normalized.accent, normalized.accentIntensity, seconds, duration);

    ctx.save();
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    /*
     * LE FLOU EN PREMIER, et sur le contenu DEJA DESSINE. Il floute l'image
     * elle-meme; le poser en calque ajouterait un voile au lieu de la flouter.
     * Il passe avant le halo et le grain parce que l'export fait pareil - un
     * grain flouté ne serait plus du grain.
     */
    if (values.blurRatio > 0) {
        const sigma = values.blurRatio * Math.max(1, width);
        if (sigma > 0.05) {
            const margin = Math.ceil(sigma * 3) + 1;
            const padded = buildEdgeClampedFrame(ctx.canvas, width, height, margin);
            ctx.filter = `blur(${sigma.toFixed(3)}px)`;
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(padded, -margin, -margin);
            ctx.filter = 'none';
        }
    }

    if (values.leakAlpha > 0.0005) {
        /*
         * Meme geometrie que le halo de la transition `light-leak` : un disque
         * degrade dont le centre traverse le cadre de gauche a droite, en
         * entrant et sortant completement (d'ou le `-taille/2` et le `+taille`).
         */
        const size = Math.max(2, Math.round(values.leakRadius * width) * 2);
        const centerX = values.leakSweep * (width + size) - size / 2;
        const centerY = 0.35 * height;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size / 2);
        gradient.addColorStop(0, `rgba(255,180,50,${values.leakAlpha.toFixed(4)})`);
        gradient.addColorStop(1, 'rgba(255,180,50,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    if (values.grain > 0.0005) {
        /*
         * `overlay` et non `source-over` : le grain doit ECLAIRCIR ET ASSOMBRIR
         * autour du gris moyen, comme le fait `noise` de FFmpeg. Pose en
         * `source-over`, il ne ferait qu'ajouter un voile clair.
         * Le decalage change a chaque image : c'est ce qui rend le grain ANIME
         * plutot que fixe, et un grain fixe se lit comme une salissure d'ecran.
         */
        const tile = getGrainTile();
        const offsetX = Math.floor(Math.random() * GRAIN_TILE_SIZE);
        const offsetY = Math.floor(Math.random() * GRAIN_TILE_SIZE);
        /*
         * LE DIVISEUR EST MESURE, PAS DEVINE. `noise=alls=N` ajoute a chaque
         * pixel un ecart d'amplitude N; un melange `overlay` a l'opacite a
         * ajoute, lui, environ a x 0,58 x luminance. Les deux ne se
         * correspondent pas terme a terme.
         * Mesure du 2026-08-04 sur le banc de parite : a `amount/100`, l'apercu
         * n'ajoutait que 0,29 d'ecart-type contre 1,42 a l'export - un facteur
         * 4,9 sur l'ecart-type, donc ~2,2 sur l'amplitude du bruit. D'ou 45.
         */
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = clamp(values.grain / 45, 0, 1);
        for (let y = -offsetY; y < height; y += GRAIN_TILE_SIZE) {
            for (let x = -offsetX; x < width; x += GRAIN_TILE_SIZE) {
                ctx.drawImage(tile, x, y);
            }
        }
    }

    ctx.restore();
}

export function applyImageMotionTransform(ctx, motion, progress, width, height, durationSeconds) {
    const frame = resolveImageMotionFrame(motion, progress, durationSeconds);
    const scale = frame.scale * rotationCoverage(frame.rotate, width, height);
    /*
     * La BASCULE est posee autour du centre du CADRE DE SORTIE, avant le
     * recadrage - c'est l'ordre du renderer, qui recadre (`zoompan`) puis fait
     * tourner (`rotate`). L'inverser ferait tourner autour du point recadre et
     * les deux cotes divergeraient des qu'un panoramique est en jeu.
     */
    // L'opacite est posee AVANT le cadrage: elle porte sur l'image entiere.
    if (frame.opacity < 1) ctx.globalAlpha = frame.opacity;
    if (frame.rotate) {
        ctx.translate(width / 2, height / 2);
        ctx.rotate((frame.rotate * Math.PI) / 180);
        ctx.translate(-width / 2, -height / 2);
    }
    ctx.translate(width / 2 + frame.x * width, height / 2 + frame.y * height);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);
    return frame;
}
