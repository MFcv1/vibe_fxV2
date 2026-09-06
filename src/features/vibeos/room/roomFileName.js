/*
 * Le nom du fichier qu'on retrouve dans ses telechargements.
 *
 * Module pur, sans navigateur: c'est la seule partie du telechargement qui
 * contienne une decision, donc la seule qu'on puisse tester pour de vrai
 * (`scripts/smoke-room-library-sync.mjs`). Le reste - fabriquer une adresse
 * locale et cliquer sur un lien - est du cablage.
 *
 * Trois exigences, et elles se contredisent un peu:
 * - ORDRE. Le numero en tete, sur trois chiffres: les fichiers se rangent alors
 *   dans l'ordre du carrousel, meme au-dela de la centieme image, meme dans un
 *   Finder qui trie caractere par caractere.
 * - RECONNAISSANCE. Le projet et le preset suivent, parce que « 042.jpg » ne
 *   dit rien trois jours plus tard.
 * - SURVIE. Aucun caractere que macOS, Windows ou iOS refuseraient. Un nom
 *   rejete, c'est un telechargement qui echoue en silence.
 */

/*
 * Interdits par au moins un des trois systemes. Le deux-points est celui qui
 * mord en pratique: Vision et Layout fabriquent des libelles comme « 4:5 ».
 */
const INTERDITS = /[\\/:*?"<>|]+/g;

export function roomFileName(item, index = 0, type = '') {
    const ext = String(type || item?.type || '').includes('png') ? 'png' : 'jpg';
    const base = [
        String(index + 1).padStart(3, '0'),
        item?.projectTitle || null,
        /* Vision range le nom du preset ici; pour Layout c'est un format
           d'export. Dans les deux cas, c'est ce qui distingue ce rendu. */
        item?.formatLabel || null,
    ]
        .filter(Boolean)
        .join(' - ')
        .replace(INTERDITS, ' ')
        .replace(/\s+/g, ' ')
        /* Un point ou une espace en fin de nom fait disparaitre l'extension
           sur Windows, et se fait manger silencieusement ailleurs. */
        .replace(/[.\s]+$/g, '')
        .trim();
    /* Les systemes de fichiers plafonnent le nom vers 255 octets; on reste tres
       en dessous, et on ne coupe jamais l'extension. */
    return `${(base || `room-${index + 1}`).slice(0, 120)}.${ext}`;
}
