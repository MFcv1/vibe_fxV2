"use client";

/*
 * A quelle vitesse le carrousel doit-il glisser ?
 *
 * Reponse: a la vitesse de celui qui appuie.
 *
 * Une seule fleche, apres une pause, c'est quelqu'un qui REGARDE: la photo
 * glisse en 620 ms, les voisines respirent, on prend son temps. Mais trier sept
 * cents photos, c'est enchainer les fleches — et une animation de 620 ms qui
 * refuse tout pendant qu'elle joue plafonne a une photo et demie par seconde en
 * jetant les appuis en trop. L'utilisateur croit alors que son clavier ne
 * repond pas ; c'est exactement ce qui a ete constate sur un dossier de 264
 * photos.
 *
 * La regle tenue ici, et c'est la seule: LE GLISSEMENT DOIT ETRE FINI AVANT
 * L'APPUI SUIVANT. On mesure l'ecart entre deux appuis, on taille la duree
 * dedans, et en rafale — touche maintenue, quelques dizaines de millisecondes
 * entre deux repetitions — on ne glisse plus du tout : on bascule sec, comme
 * l'apercu du Finder. Aucun appui n'est jamais perdu, dans aucun regime.
 *
 * Module pur, sans dependance navigateur, teste hors navigateur par
 * `scripts/smoke-vibeos-library.mjs`.
 */

/* Le glissement de reference, celui qu'on voit quand on prend son temps. */
export const SLIDE_MS = 620;

/*
 * Le plancher animé. En dessous, un glissement ne se lit plus comme un
 * mouvement mais comme un tremblement : autant basculer franchement.
 */
export const SLIDE_MIN = 130;

/* Au-dela de cet ecart entre deux appuis, on considere que la personne
   regarde, pas qu'elle parcourt. */
export const CADENCE_CALME = 520;

/* En deca, c'est une rafale (typiquement une touche maintenue, qui se repete
   toutes les 30 a 40 ms) : plus d'animation du tout. */
export const CADENCE_RAFALE = 150;

/*
 * Marge de securite dans le regime rapide : on ne consomme que 90% de l'ecart
 * mesure. Une interpolation lineaire entre les deux seuils paraissait plus
 * elegante, mais elle donnait 215 ms d'animation pour 214 ms d'ecart — le
 * defaut meme qu'on essaie de corriger. Le test le montre.
 */
const MARGE = 0.9;

/*
 * `gap` est l'ecart en millisecondes avec l'appui precedent. Le premier appui
 * d'une session n'en a pas: il obtient le glissement complet.
 *
 * Le regime calme est volontairement exempt de la marge : a plus d'une demie
 * seconde entre deux appuis, la personne regarde ses photos, et un glissement
 * de 620 ms qui deborde un peu ne gene personne — d'autant qu'un appui pendant
 * l'animation l'interrompt proprement au lieu d'etre perdu.
 */
export function slideDuration(gap) {
    if (!Number.isFinite(gap) || gap >= CADENCE_CALME) return SLIDE_MS;
    if (gap <= CADENCE_RAFALE) return 0;
    const taille = Math.round(Math.min(SLIDE_MS, gap * MARGE));
    /* Trop court pour se lire comme un mouvement : on bascule franchement. */
    return taille < SLIDE_MIN ? 0 : taille;
}
