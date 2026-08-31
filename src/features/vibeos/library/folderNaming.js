"use client";

/*
 * Nommage des dossiers, a la maniere d'un systeme d'exploitation.
 *
 * Trois regles, dans cet ordre:
 *  1. si l'utilisateur a choisi un DOSSIER, on garde son nom - c'est le sien,
 *     il le reconnaitra dans la bibliotheque comme sur son disque;
 *  2. sinon, la date d'import en toutes lettres, comme le fait Photos;
 *  3. un nom deja pris recoit un suffixe " (2)", " (3)"... exactement comme
 *     Finder et l'Explorateur - jamais d'ecrasement silencieux.
 *
 * Fonctions pures et sans dependance navigateur: elles sont testees hors
 * navigateur par `scripts/smoke-vibeos-library.mjs`.
 */

export const FOLDER_NAME_MAX = 60;

const MONTHS = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/*
 * Nom du dossier choisi, lu sur `webkitRelativePath` ("vacances/img.jpg").
 * Renvoie `''` si les fichiers ne viennent pas d'un dossier, ou s'ils viennent
 * de plusieurs dossiers differents: dans ce cas on n'invente pas de nom.
 */
export function directoryNameOf(files) {
    const roots = new Set();
    for (const file of files || []) {
        const relative = file?.webkitRelativePath || '';
        if (!relative.includes('/')) return '';
        roots.add(relative.slice(0, relative.indexOf('/')));
        if (roots.size > 1) return '';
    }
    const [only] = [...roots];
    return only ? sanitizeFolderName(only) : '';
}

/* "31 août 2026" - la date telle qu'on la dit, pas un identifiant. */
export function dateFolderName(at = Date.now()) {
    const date = new Date(at);
    return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/*
 * Nettoie un nom saisi ou herite: pas de separateur de chemin, pas de retour a
 * la ligne, pas d'espaces en trop, longueur bornee. Un nom vide apres nettoyage
 * est refuse par l'appelant, jamais remplace en douce.
 */
export function sanitizeFolderName(raw) {
    return String(raw ?? '')
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, FOLDER_NAME_MAX)
        .trim();
}

/*
 * Rend le nom unique parmi `taken`. La comparaison ignore la casse et les
 * accents: "Ete" et "ete" sont le meme dossier pour l'oeil, donc pour nous.
 */
export function uniqueFolderName(name, taken = []) {
    const base = sanitizeFolderName(name);
    if (!base) return '';
    const key = (value) => sanitizeFolderName(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const used = new Set((taken || []).map(key));
    if (!used.has(key(base))) return base;
    for (let index = 2; index < 1000; index += 1) {
        const candidate = `${base} (${index})`;
        if (!used.has(key(candidate))) return candidate;
    }
    return `${base} (${Date.now()})`;
}

/*
 * Nom propose a l'ouverture de la fenetre d'import: le dossier choisi s'il y en
 * a un, la date sinon, toujours rendu unique.
 */
export function suggestFolderName({ files = [], taken = [], at = Date.now() } = {}) {
    return uniqueFolderName(directoryNameOf(files) || dateFolderName(at), taken);
}
