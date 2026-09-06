"use client";

import { listRoomItems } from './roomDb';
import { fetchRoomBlob } from './roomCloud';
import {
    createFolderId, listFolders, listPhotos, putFolder, putPhoto,
} from '../library/libraryDb';
import { buildPhotoRecord } from '../library/photoImport';
import { sanitizeFolderName, uniqueFolderName } from '../library/folderNaming';
import { checkImport } from '../library/libraryQuota';

/*
 * Mettre la Room a l'abri : ses rendus deviennent de vraies photos.
 *
 * La Room vit dans IndexedDB, c'est-a-dire DANS CE NAVIGATEUR et nulle part
 * ailleurs. Elle ne connait pas le compte de l'utilisateur : vider les donnees
 * du site, changer d'ordinateur ou passer en navigation privee, et dix rendus
 * disparaissent. Tant qu'un rendu n'est qu'un element de Room, il n'est pas
 * sauvegarde - il est juste en attente.
 *
 * Ce module fait le pont : chaque rendu entre dans la bibliotheque comme une
 * photo normale, dans un dossier neuf ou existant. A partir de la, c'est la
 * synchronisation de la bibliotheque qui l'envoie dans le compte, avec le meme
 * chemin que n'importe quel import - donc dans Storage, donc recuperable
 * ailleurs.
 *
 * La Room n'est PAS videe au passage : on met a l'abri, on ne deplace pas. Le
 * post en cours reste intact, et l'utilisateur decide seul quand vider sa file.
 */

/* Un rendu de Room est un PNG ou un JPEG deja fabrique par l'export social. */
function fileFromItem(item, index, blob) {
    const type = blob?.type || 'image/jpeg';
    const ext = type.includes('png') ? 'png' : 'jpg';
    const base = sanitizeFolderName(item.projectTitle || item.sourceLabel || 'Room') || 'Room';
    const nom = `${base} ${String(index + 1).padStart(2, '0')}.${ext}`;
    return new File([blob], nom, { type, lastModified: item.createdAt || Date.now() });
}

/*
 * Le fichier d'une image de Room.
 *
 * Sur l'appareil qui l'a fabriquee, il est dans IndexedDB. Sur un autre, la
 * Room est arrivee par le compte et ne porte qu'une URL Storage: on rapatrie
 * alors l'image, sinon « enregistrer » ne marcherait que la ou on l'a creee.
 */
async function blobOf(item) {
    if (item.blob) return item.blob;
    return fetchRoomBlob(item.cloud?.url, item.cloud?.path);
}

/* Nom propose pour le dossier: le projet s'il est unique, la date sinon. */
export function suggestRoomFolderName(items = [], taken = []) {
    const titres = [...new Set(items.map((item) => item.projectTitle).filter(Boolean))];
    const base = titres.length === 1 ? titres[0] : 'Room';
    const date = new Date();
    const jour = `${date.getDate()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    return uniqueFolderName(sanitizeFolderName(`${base} ${jour}`), taken);
}

/* Les dossiers ou l'on peut deposer: pas les tris, qui ne stockent rien. */
export async function listTargetFolders() {
    const folders = await listFolders();
    return folders.filter((folder) => !folder.localOnly);
}

/*
 * Signature d'un rendu: ses dimensions et son poids exact.
 *
 * Elle sert UNIQUEMENT a rattraper les dossiers remplis avant que le lien
 * `fromRoomId` n'existe. Deux rendus differents de la meme photo n'ont pas le
 * meme poids a l'octet pres - un preset change forcement quelques milliers
 * d'octets de JPEG - donc la confusion demanderait deux images identiques, qui
 * sont de toute facon interchangeables.
 */
function empreinte(largeur, hauteur, octets) {
    return `${largeur || 0}x${hauteur || 0}:${octets || 0}`;
}

/*
 * Ce qui est deja dans un dossier, et par quoi on le sait.
 *
 * La photo creee garde l'identifiant de l'element de Room dont elle vient
 * (`fromRoomId`). « Deja enregistree ici » se lit donc dans le dossier lui-meme,
 * pas dans une marque posee sur la Room: c'est la seule version qui reste vraie
 * si on enregistre depuis un autre appareil, puisque la bibliotheque, elle, se
 * synchronise.
 *
 * Les dossiers remplis AVANT l'existence de ce lien n'en ont pas. Sans
 * rattrapage, ils reproposeraient indefiniment de tout reimporter — c'est
 * exactement ce qui a ete constate. On les reconnait donc a l'empreinte, et on
 * en profite pour ECRIRE le lien manquant: la fois d'apres, c'est exact.
 */
async function dejaDansLeDossier(folderId, items) {
    if (!folderId) return { ids: new Set(), aReparer: [] };
    const photos = (await listPhotos()).filter((photo) => photo.folderId === folderId);
    const ids = new Set();
    photos.forEach((photo) => { if (photo.fromRoomId) ids.add(photo.fromRoomId); });

    const orphelines = photos.filter((photo) => !photo.fromRoomId);
    const aReparer = [];
    if (orphelines.length) {
        const parEmpreinte = new Map();
        items.forEach((item) => {
            if (ids.has(item.id)) return;
            const cle = empreinte(item.width, item.height, item.bytes || item.blob?.size);
            if (!parEmpreinte.has(cle)) parEmpreinte.set(cle, []);
            parEmpreinte.get(cle).push(item.id);
        });
        orphelines.forEach((photo) => {
            const file = parEmpreinte.get(empreinte(photo.width, photo.height, photo.bytes));
            const id = file?.shift();
            if (!id) return;
            ids.add(id);
            aReparer.push({ ...photo, fromRoomId: id });
        });
    }
    return { ids, aReparer };
}

/*
 * Ce qui reste vraiment a enregistrer dans un dossier.
 *
 * Un dossier NEUF ne filtre rien: le choisir est un geste explicite, on veut y
 * mettre toute la file.
 */
export async function roomItemsLeftFor(folderId) {
    const items = await listRoomItems();
    if (!folderId) return { total: items.length, restants: items.length, deja: 0 };
    const { ids } = await dejaDansLeDossier(folderId, items);
    const restants = items.filter((item) => !ids.has(item.id)).length;
    return { total: items.length, restants, deja: items.length - restants };
}

/*
 * Enregistre la Room dans la bibliotheque.
 *
 * `onProgress(fait, total)` sert a l'ecran: une dizaine de rendus pleine
 * definition prennent plusieurs secondes a decoder, et un bouton muet pendant
 * ce temps passe pour un bouton casse.
 */
export async function saveRoomToLibrary({ folderId = null, folderName = null, onProgress = null } = {}) {
    /* Les blobs ne sont pas dans l'etat React - il n'y garde que des URLs -
       donc on relit la file depuis IndexedDB. */
    const tous = await listRoomItems();
    if (!tous.length) return { added: 0, folderId: null, message: 'La Room est vide.' };

    /*
     * On ne repasse pas ce qui est deja dans le dossier vise. Sans ca, ajouter
     * quatre images a une file de trente-six proposait de reimporter les
     * trente-six, et le dossier se remplissait de doublons.
     */
    const { ids: dejaLa, aReparer } = await dejaDansLeDossier(folderId, tous);
    /* On pose le lien manquant sur les photos d'avant: la prochaine fois, la
       reconnaissance sera exacte et ne dependra plus d'une empreinte. */
    for (const photo of aReparer) await putPhoto(photo);
    const items = tous.filter((item) => !dejaLa.has(item.id));
    const ignorees = tous.length - items.length;
    if (!items.length) {
        return {
            added: 0, ignorees, folderId, message: 'Tout est déjà dans ce dossier.',
        };
    }

    const blobs = await Promise.all(items.map(blobOf));
    const paires = items
        .map((item, index) => ({ item, blob: blobs[index] }))
        .filter((paire) => paire.blob);
    if (!paires.length) {
        return { added: 0, folderId: null, message: 'Aucune image de la Room n’a pu être lue.' };
    }
    const introuvables = items.length - paires.length;
    const files = paires.map((paire, index) => fileFromItem(paire.item, index, paire.blob));
    const existing = await listPhotos();
    const gardees = existing.filter((photo) => !photo.scout);
    const gate = checkImport({
        photoCount: gardees.length,
        bytes: gardees.reduce((sum, photo) => sum + (photo.bytes || 0), 0),
        files,
    });
    if (!gate.ok) return { added: 0, folderId: null, blocked: true, message: gate.message };
    const retenus = files.slice(0, gate.accepted);

    let cible = folderId;
    let nom = folderName;
    if (!cible) {
        const folders = await listFolders();
        const propre = uniqueFolderName(
            sanitizeFolderName(folderName) || suggestRoomFolderName(items, folders.map((f) => f.name)),
            folders.map((f) => f.name),
        );
        const folder = {
            id: createFolderId(),
            name: propre,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: 'room',
            kind: 'library',
            localOnly: false,
            coverId: null,
        };
        await putFolder(folder);
        cible = folder.id;
        nom = folder.name;
    } else {
        const folders = await listFolders();
        nom = folders.find((folder) => folder.id === cible)?.name || '';
    }

    let added = 0;
    let cover = null;
    for (let index = 0; index < retenus.length; index += 1) {
        const record = await buildPhotoRecord(retenus[index], { folderId: cible });
        if (record) {
            /* Le lien avec l'element de Room: c'est lui qui evitera de
               reimporter cette image la prochaine fois. */
            const source = paires[index]?.item || null;
            record.fromRoomId = source?.id || null;
            /*
             * Le preset appliqué suit la photo dans la bibliotheque.
             *
             * Vision range son nom de preset dans `formatLabel` au moment de
             * l'envoi vers la Room; sans cette reprise, l'information se perdait
             * a l'enregistrement et la grille ne pouvait plus afficher quel look
             * avait ete pose. Les rendus de Layout ne sont pas concernes: leur
             * `formatLabel` est un format, pas un preset.
             */
            if (source?.source === 'vision' && source.formatLabel && source.formatLabel !== 'Photo') {
                record.preset = { label: source.formatLabel };
            }
            await putPhoto(record);
            if (!cover) cover = record.id;
            added += 1;
        }
        onProgress?.(index + 1, retenus.length);
    }

    /* Le dossier retient sa couverture et sa date, comme apres un import. */
    const folders = await listFolders();
    const base = folders.find((folder) => folder.id === cible);
    if (base) await putFolder({ ...base, updatedAt: Date.now(), coverId: base.coverId || cover });

    return {
        added,
        failed: retenus.length - added,
        rejected: files.length - retenus.length,
        introuvables,
        ignorees,
        folderId: cible,
        folderName: nom,
        message: gate.message,
    };
}
