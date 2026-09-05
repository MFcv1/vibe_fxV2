"use client";

/*
 * Mode TRI: regarder sept cents photos sans en copier une seule.
 *
 * L'import normal fait entrer la photo dans la bibliotheque: original converti,
 * stocke, puis sauvegarde dans le compte. C'est ce qu'on veut pour une photo
 * qu'on garde - et c'est beaucoup trop cher pour une photo qu'on va jeter.
 * Sur un dossier Telechargements de sept cents HEIC, ce serait plusieurs Go
 * dans le navigateur et une vingtaine de minutes de conversion, avant meme
 * d'avoir vu la premiere image.
 *
 * Le tri ne garde donc QUE l'apercu (~200 Ko), plus de quoi retrouver le
 * fichier d'origine sur le disque. L'original n'est lu pour de vrai qu'au
 * moment ou l'utilisateur decide de garder la photo.
 *
 * Ce que ca implique, et qui est assume:
 * - un `File` choisi dans un selecteur n'est PAS un fichier copie, c'est une
 *   poignee vers le disque. Elle vit tant que l'onglet vit, pas au-dela;
 * - donc apres un rechargement, on a encore les apercus et les favoris (ils
 *   sont dans IndexedDB), mais plus les poignees. Il faut re-designer le
 *   dossier source, et on retrouve chaque photo par sa signature.
 *
 * Chrome sait faire mieux (`showDirectoryPicker` rend une poignee persistante),
 * mais Safari ne l'a pas, et c'est le navigateur de la maison. Le
 * re-rattachement marche partout; l'optimisation Chrome pourra s'ajouter par
 * dessus sans rien changer ici.
 */

/*
 * Plafond du tri. Il ne protege pas la facture - un tri ne coute rien chez
 * Google - il protege l'onglet: au-dela, les apercus a eux seuls pesent trop
 * lourd pour IndexedDB et la grille devient poussive.
 */
export const SCOUT_QUOTA = {
    photos: 3000,
    bytes: 2 * 1024 * 1024 * 1024,
};

export const SCOUT_FOLDER_KIND = 'scout';

export function isScoutFolder(folder) {
    return folder?.kind === SCOUT_FOLDER_KIND;
}

export function isScoutPhoto(photo) {
    return Boolean(photo?.scout);
}

/*
 * Les poignees de fichiers de la session.
 *
 * Deux entrees pour la meme poignee: par identifiant de photo (le cas courant)
 * et par signature (pour retrouver le fichier apres un rechargement, quand les
 * identifiants sont encore la mais plus les poignees). Module-level et non un
 * state React: ces objets ne se rendent pas, et les recreer a chaque montage de
 * l'ecran ferait perdre le tri en cours a la moindre navigation interne.
 */
const filesById = new Map();
const filesBySignature = new Map();

/*
 * Signature d'un fichier: nom, taille, date de modification. Trois champs que
 * le navigateur donne sans lire un octet du disque, et dont la collision
 * demande deux fichiers de meme nom, meme poids, meme seconde. Le chemin
 * complet serait plus sur, mais le web ne le donne pas.
 */
export function fileSignature(file) {
    if (!file) return '';
    const name = String(file.name || '').split('/').pop();
    return `${name}|${file.size || 0}|${file.lastModified || 0}`;
}

export function rememberFile(photoId, file) {
    if (!photoId || !file) return;
    filesById.set(photoId, file);
    filesBySignature.set(fileSignature(file), file);
}

export function forgetFile(photoId) {
    const file = filesById.get(photoId);
    if (file) filesBySignature.delete(fileSignature(file));
    filesById.delete(photoId);
}

/* La poignee vers le fichier d'origine, ou `null` si la session l'a perdue. */
export function sourceFileOf(photo) {
    if (!photo) return null;
    const direct = filesById.get(photo.id);
    if (direct) return direct;
    const signature = photo.source?.signature;
    return (signature && filesBySignature.get(signature)) || null;
}

export function hasSourceFile(photo) {
    return Boolean(sourceFileOf(photo));
}

/*
 * Combien de photos d'un dossier de tri sont encore reliees a leur fichier.
 * C'est ce chiffre qui decide si l'ecran affiche "pret a importer" ou "redonne
 * moi le dossier" - jamais une supposition sur l'age de la session.
 */
export function countAttached(photos) {
    let attached = 0;
    for (const photo of photos || []) {
        if (hasSourceFile(photo)) attached += 1;
    }
    return attached;
}

/*
 * Re-rattache une selection de fichiers a des photos deja triees.
 *
 * Appele apres un rechargement: l'utilisateur redesigne son dossier source, et
 * on refait le lien par signature. Les fichiers qui ne correspondent a rien
 * sont ignores en silence - c'est le cas normal quand le dossier a bouge depuis.
 */
export function reattachFiles(photos, files) {
    const wanted = new Map();
    for (const photo of photos || []) {
        const signature = photo?.source?.signature;
        if (signature && !hasSourceFile(photo)) wanted.set(signature, photo.id);
    }
    let matched = 0;
    for (const file of files || []) {
        const id = wanted.get(fileSignature(file));
        if (!id) continue;
        rememberFile(id, file);
        wanted.delete(fileSignature(file));
        matched += 1;
    }
    return { matched, missing: wanted.size };
}
