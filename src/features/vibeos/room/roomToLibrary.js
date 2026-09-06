"use client";

import { listRoomItems } from './roomDb';
import { fetchRoomBlob } from './roomCloud';
import { planReconcile, planVide, presetDe, roomPhotoId } from './roomLibraryPlan';
import {
    createFolderId, deletePhoto, dropTombstones, listFolders, listPhotos, putFolder, putPhoto,
    putTombstones,
} from '../library/libraryDb';
import { buildPhotoRecord } from '../library/photoImport';
import { sanitizeFolderName, uniqueFolderName } from '../library/folderNaming';
import { checkImport } from '../library/libraryQuota';

/*
 * Le pont entre la Room et la bibliotheque.
 *
 * La Room est une FILE D'ATTENTE: elle se vide quand le post part. La
 * bibliotheque est un LIEU OU L'ON GARDE. Ce module fait passer les rendus de
 * l'une a l'autre, et surtout: il maintient les deux d'accord.
 *
 * Ce n'est plus une operation d'ajout, c'est une SYNCHRONISATION. On ne
 * demande plus « qu'est-ce qui est nouveau ? » - question a laquelle on
 * repondait mal - mais « a quoi ce dossier doit-il ressembler ? », et on
 * corrige l'ecart. La regle tient en une phrase: un element de Room = au plus
 * une photo dans le dossier. Le calcul est dans `roomLibraryPlan.js`, teste a
 * part; ici il n'y a que les ecritures.
 *
 * La Room n'est PAS videe au passage: on met a l'abri, on ne deplace pas.
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

async function photosDuDossier(folderId) {
    if (!folderId) return [];
    return (await listPhotos()).filter((photo) => photo.folderId === folderId);
}

/*
 * Ce que la synchronisation ferait, sans rien faire.
 *
 * L'ecran l'affiche AVANT le clic. Un bouton destructeur qui n'annonce pas ce
 * qu'il va detruire est un piege, et ici il peut supprimer des dizaines de
 * fiches d'un coup.
 */
export async function previewRoomFolderSync(folderId) {
    const roomItems = await listRoomItems();
    if (!folderId) {
        return {
            total: roomItems.length,
            aCreer: roomItems.length,
            aSupprimer: 0,
            aReparer: 0,
            aPreset: 0,
            dejaLa: 0,
            horsRoom: 0,
            rienAFaire: !roomItems.length,
        };
    }
    const folderPhotos = await photosDuDossier(folderId);
    const plan = planReconcile({ roomItems, folderPhotos, folderId });
    return {
        total: plan.total,
        aCreer: plan.aCreer.length,
        aSupprimer: plan.aSupprimer.length,
        /* Les liens seuls: le rattrapage des presets se dit a part, parce que
           c'est ce que l'utilisateur VOIT changer sur ses vignettes. */
        aReparer: plan.aReparer.length - plan.aPreset,
        aPreset: plan.aPreset,
        dejaLa: plan.gardees.length,
        horsRoom: plan.horsRoom,
        rienAFaire: planVide(plan),
    };
}

/* Le dossier vise, cree si besoin. Fait AVANT le plan: l'identifiant canonique
   d'une photo depend du dossier, donc le dossier doit exister d'abord. */
async function resoudreDossier(folderId, folderName, roomItems) {
    const folders = await listFolders();
    if (folderId) {
        const trouve = folders.find((folder) => folder.id === folderId);
        return { id: folderId, name: trouve?.name || '', base: trouve || null, neuf: false };
    }
    const propre = uniqueFolderName(
        sanitizeFolderName(folderName) || suggestRoomFolderName(roomItems, folders.map((f) => f.name)),
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
    return {
        id: folder.id, name: folder.name, base: folder, neuf: true,
    };
}

/*
 * Aligne un dossier de bibliotheque sur la file de la Room.
 *
 * Rejouable autant de fois qu'on veut: la deuxieme execution ne trouve plus
 * rien a faire. C'est precisement ce qui manquait - une operation dont on peut
 * douter du resultat sans avoir a tout verifier a la main.
 *
 * `onProgress(fait, total)` sert a l'ecran: une centaine de rendus pleine
 * definition prennent plusieurs dizaines de secondes a decoder, et un bouton
 * muet pendant ce temps passe pour un bouton casse.
 */
export async function syncRoomToFolder({ folderId = null, folderName = null, onProgress = null } = {}) {
    const roomItems = await listRoomItems();
    if (!roomItems.length && !folderId) {
        return { ok: false, message: 'La Room est vide.' };
    }

    const dossier = await resoudreDossier(folderId, folderName, roomItems);
    const folderPhotos = await photosDuDossier(dossier.id);
    const plan = planReconcile({ roomItems, folderPhotos, folderId: dossier.id });

    /* 1. Les liens manquants, d'abord. Une fiche d'avant reconnue une fois
       n'aura plus jamais besoin de l'etre par son poids. */
    for (const photo of plan.aReparer) await putPhoto(photo);

    /*
     * 2. Les copies en trop. La fiche locale part, et une pierre tombale est
     * ecrite SUR LE DISQUE: c'est elle qui empechera le compte de les faire
     * revenir, et qui fera finir le travail cote serveur meme si l'onglet se
     * ferme maintenant. Voir `libraryDb.js`.
     */
    if (plan.aSupprimer.length) {
        const parId = new Map(folderPhotos.map((photo) => [photo.id, photo]));
        await putTombstones(plan.aSupprimer.map((id) => ({
            id,
            previewPath: parId.get(id)?.cloud?.previewPath || null,
            originalPath: parId.get(id)?.cloud?.originalPath || null,
        })));
        for (const id of plan.aSupprimer) await deletePhoto(id);
    }

    /* 3. Ce qui manque. */
    let added = 0;
    let cover = null;
    let bloque = null;
    let introuvables = 0;
    if (plan.aCreer.length) {
        const items = plan.aCreer.map((entree) => entree.item);
        const blobs = await Promise.all(items.map(blobOf));
        const paires = plan.aCreer
            .map((entree, index) => ({ ...entree, blob: blobs[index] }))
            .filter((paire) => paire.blob);
        introuvables = plan.aCreer.length - paires.length;

        /* Le plafond se calcule sur ce qui reste apres le menage: sinon les
           doublons qu'on vient de supprimer compteraient encore. */
        const restantes = (await listPhotos()).filter((photo) => !photo.scout);
        const files = paires.map((paire, index) => fileFromItem(paire.item, index, paire.blob));
        const gate = checkImport({
            photoCount: restantes.length,
            bytes: restantes.reduce((sum, photo) => sum + (photo.bytes || 0), 0),
            files,
        });
        if (!gate.ok) {
            bloque = gate.message;
        } else {
            const retenus = paires.slice(0, gate.accepted);
            /* Une cle canonique peut porter une pierre tombale d'une
               suppression precedente. On la leve ici, et seulement ici: c'est
               un ajout volontaire, pas un retour du compte. */
            await dropTombstones(retenus.map((paire) => paire.photoId));
            for (let index = 0; index < retenus.length; index += 1) {
                const paire = retenus[index];
                const record = await buildPhotoRecord(files[index], { folderId: dossier.id });
                if (record) {
                    /* L'identite deduite du couple (dossier, element de Room):
                       reenregistrer la meme image ecrit la meme cle, donc ne
                       peut pas fabriquer une copie. */
                    record.id = paire.photoId || record.id;
                    record.fromRoomId = paire.item.id;
                    /* Le preset applique suit la photo dans la bibliotheque.
                       Meme regle que pour le rattrapage des fiches d'avant -
                       une seule definition, dans `roomLibraryPlan`. */
                    record.preset = presetDe(paire.item);
                    await putPhoto(record);
                    if (!cover) cover = record.id;
                    added += 1;
                }
                onProgress?.(index + 1, retenus.length);
            }
            if (gate.accepted < paires.length) bloque = gate.message;
        }
    }

    /* Le dossier retient sa couverture et sa date, comme apres un import. */
    const folders = await listFolders();
    const base = folders.find((folder) => folder.id === dossier.id);
    if (base) await putFolder({ ...base, updatedAt: Date.now(), coverId: base.coverId || cover });

    const restantes = await photosDuDossier(dossier.id);
    return {
        ok: true,
        folderId: dossier.id,
        folderName: base?.name || dossier.name,
        neuf: dossier.neuf,
        added,
        supprimees: plan.aSupprimer.length,
        reparees: plan.aReparer.length - plan.aPreset,
        presets: plan.aPreset,
        introuvables,
        dejaLa: plan.gardees.length,
        /* Le compte final du dossier: c'est le chiffre que l'utilisateur va
           voir dans la bibliotheque, donc c'est celui qu'on lui annonce. */
        totalDossier: restantes.length,
        totalRoom: plan.total,
        message: bloque,
        rienAFaire: planVide(plan),
    };
}

export { roomPhotoId };
