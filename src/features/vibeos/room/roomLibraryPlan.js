/*
 * Le contrat entre la Room et son dossier de bibliotheque.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Pendant des semaines, « Enregistrer » depuis la Room a fabrique des doublons.
 * La cause n'etait pas un bug isole mais un modele: chaque enregistrement
 * creait des fiches avec un identifiant TIRE AU HASARD, puis on essayait, apres
 * coup, de deviner si l'image etait deja la. Deviner juste a 100%, a travers
 * deux bases (IndexedDB et Firestore), deux appareils et des envois qui se
 * croisent, c'est impossible. Il suffisait d'une reconnaissance ratee pour
 * qu'une copie de plus s'installe - et elle ne repartait plus.
 *
 * Le modele est donc inverse ici. Une image de Room rangee dans un dossier a un
 * identifiant DEDUIT de (dossier, element de Room). Il ne depend ni de l'heure,
 * ni du hasard, ni de l'appareil, ni de ce que le cache croit savoir.
 * Enregistrer deux fois la meme image dans le meme dossier, c'est ecrire deux
 * fois la meme cle: la deuxieme ecriture remplace la premiere. Le doublon n'est
 * plus « detecte puis filtre », il est IMPOSSIBLE A FABRIQUER.
 *
 * Ce module ne touche a rien: il calcule un plan a partir de deux listes. Il
 * n'a besoin ni de navigateur, ni de reseau, ni d'IndexedDB - c'est ce qui
 * permet de le tester pour de vrai (`scripts/smoke-room-library-sync.mjs`).
 */

/* Hash court et stable d'une chaine (FNV-1a 32 bits). Sert uniquement a ce que
   l'identifiant reste lisible: le dossier tient en huit caracteres. */
function hash32(value) {
    let h = 0x811c9dc5;
    const texte = String(value || '');
    for (let index = 0; index < texte.length; index += 1) {
        h ^= texte.charCodeAt(index);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

/*
 * L'identifiant canonique d'une image de Room rangee dans un dossier.
 *
 * Deux appareils qui enregistrent la meme file dans le meme dossier, sans
 * jamais s'etre vus, produisent la MEME cle. C'est ce qui fait converger les
 * deux bases au lieu de les faire diverger.
 */
export function roomPhotoId(folderId, roomItemId) {
    if (!folderId || !roomItemId) return null;
    return `ph-r-${hash32(folderId)}-${roomItemId}`;
}

/*
 * Signature d'une image: dimensions et poids exact.
 *
 * Elle sert a rattraper les fiches d'avant, celles qui n'ont pas de lien vers
 * leur element de Room. Deux JPEG differents ne tombent pas sur le meme poids a
 * l'octet pres; et si deux images ont vraiment la meme signature, elles sont
 * interchangeables, donc se tromper entre elles ne change rien.
 */
export function empreinte(largeur, hauteur, octets) {
    if (!octets) return null;
    return `${largeur || 0}x${hauteur || 0}:${octets}`;
}

/* Poids d'une fiche, quel que soit le champ qui le porte. */
function poidsDe(row) {
    return row?.bytes || row?.blob?.size || 0;
}

/*
 * Laquelle de deux copies garder.
 *
 * Dans l'ordre: celle qui est deja dans le compte (la supprimer couterait un
 * re-envoi), celle qui a encore son fichier local, celle qui porte deja la cle
 * canonique, celle qui a une vignette. A egalite, la plus ancienne: c'est celle
 * que les autres ecrans ont pu referencer.
 */
function score(photo, canonique) {
    return (photo.cloud?.state === 'synced' ? 8 : 0)
        + (photo.blob ? 4 : 0)
        + (photo.id === canonique ? 2 : 0)
        + (photo.thumbBlob ? 1 : 0);
}

function meilleure(liste, canonique) {
    return [...liste].sort((a, b) => (
        score(b, canonique) - score(a, canonique)
        || (a.addedAt || 0) - (b.addedAt || 0)
        || String(a.id).localeCompare(String(b.id))
    ))[0];
}

/*
 * Le preset porte par une image de la Room, s'il y en a un.
 *
 * Vision range le nom du look applique dans `formatLabel` au moment d'envoyer
 * le rendu vers la Room. Les rendus de Layout ne sont PAS concernes: leur
 * `formatLabel` est un format d'export (« 4:5 », « Story »), pas un preset, et
 * l'afficher comme tel serait un mensonge sur la vignette.
 */
export function presetDe(item) {
    if (!item || item.source !== 'vision') return null;
    const label = item.formatLabel;
    if (!label || label === 'Photo') return null;
    return { label };
}

/*
 * Le plan de synchronisation d'un dossier avec la file de la Room.
 *
 * Trois garanties tenues ici, et elles sont le coeur du sujet:
 *
 * 1. ON NE SUPPRIME JAMAIS UNE IMAGE UNIQUE. Une photo sans jumelle reste,
 *    meme si son element de Room a disparu depuis: la Room est une file
 *    d'attente qui se vide, la bibliotheque est un lieu ou l'on garde.
 * 2. UN ELEMENT DE ROOM = AU PLUS UNE PHOTO DANS LE DOSSIER. C'est la seule
 *    regle qu'il faut retenir, et elle se verifie d'un coup d'oeil.
 * 3. LE PLAN EST IDEMPOTENT. Le rejouer sur son propre resultat ne donne plus
 *    rien a faire. C'est ce que le test verifie, parce que c'est exactement ce
 *    qui manquait avant: une operation qu'on peut relancer sans crainte.
 */
export function planReconcile({ roomItems = [], folderPhotos = [], folderId = null } = {}) {
    const canonique = (item) => roomPhotoId(folderId, item.id);

    /* Ce que le dossier contient, range par element de Room. */
    const parRoom = new Map();
    const sansLien = [];
    folderPhotos.forEach((photo) => {
        if (photo.fromRoomId) {
            if (!parRoom.has(photo.fromRoomId)) parRoom.set(photo.fromRoomId, []);
            parRoom.get(photo.fromRoomId).push(photo);
        } else {
            sansLien.push(photo);
        }
    });

    /*
     * Rattrapage des fiches d'avant. Elles n'ont pas de lien; sans ce passage,
     * elles seraient vues comme « pas encore la » et la file serait reimportee
     * en entier a chaque enregistrement - c'est litteralement ce qui a rempli
     * le dossier de cent cinquante-quatre photos pour cent six images.
     */
    /*
     * Les corrections a ecrire sur des fiches qui restent.
     *
     * Une meme photo peut en cumuler deux - retrouver son lien vers la Room ET
     * recuperer le nom de son preset - donc on les empile sur la MEME entree
     * plutot que d'ecrire deux fois la fiche, la seconde ecriture effacant la
     * premiere.
     */
    const patchs = new Map();
    const patcher = (photo, champs) => {
        const suivant = { ...(patchs.get(photo.id) || photo), ...champs };
        patchs.set(photo.id, suivant);
        return suivant;
    };
    const parEmpreinte = new Map();
    roomItems.forEach((item) => {
        if (parRoom.has(item.id)) return;
        const cle = empreinte(item.width, item.height, poidsDe(item));
        if (!cle) return;
        if (!parEmpreinte.has(cle)) parEmpreinte.set(cle, []);
        parEmpreinte.get(cle).push(item.id);
    });
    const orphelines = [];
    sansLien.forEach((photo) => {
        const cle = empreinte(photo.width, photo.height, poidsDe(photo));
        const file = cle ? parEmpreinte.get(cle) : null;
        const roomId = file?.shift();
        if (!roomId) { orphelines.push(photo); return; }
        const repare = patcher(photo, { fromRoomId: roomId });
        if (!parRoom.has(roomId)) parRoom.set(roomId, []);
        parRoom.get(roomId).push(repare);
    });

    /* Un element de Room, une photo. Le reste part. */
    const aSupprimer = [];
    const gardees = [];
    const retenues = [];
    const gardeParRoom = new Map();
    roomItems.forEach((item) => {
        const copies = parRoom.get(item.id);
        if (!copies?.length) return;
        const garde = meilleure(copies, canonique(item));
        gardees.push({ roomId: item.id, photoId: garde.id });
        retenues.push(garde);
        gardeParRoom.set(item.id, garde);
        copies.forEach((photo) => { if (photo.id !== garde.id) aSupprimer.push(photo.id); });
    });

    /*
     * Le preset des fiches d'avant.
     *
     * Le nom du look n'a commence a suivre la photo que le 2026-09-06: tout ce
     * qui avait ete range avant s'affiche sans etiquette, alors que
     * l'information existe toujours - dans la Room, sur l'image dont la photo
     * vient. On la recopie donc, tant que la Room la porte encore. Une fois la
     * file videe, elle est perdue: c'est la seule raison de faire ce
     * rattrapage MAINTENANT et pas plus tard.
     */
    const aPreset = [];
    roomItems.forEach((item) => {
        const preset = presetDe(item);
        if (!preset) return;
        const photo = gardeParRoom.get(item.id);
        if (!photo) return;
        const actuel = (patchs.get(photo.id) || photo).preset?.label || null;
        if (actuel === preset.label) return;
        patcher(photo, { preset });
        aPreset.push(photo.id);
    });

    /*
     * Les copies rattachees a un element que la Room ne contient plus. On ne
     * les jette pas - voir garantie 1 - mais on ne garde pas non plus trois
     * exemplaires de la meme: une seule reste.
     */
    const vivants = new Set(roomItems.map((item) => item.id));
    parRoom.forEach((copies, roomId) => {
        if (vivants.has(roomId)) return;
        const garde = meilleure(copies, null);
        retenues.push(garde);
        copies.forEach((photo) => { if (photo.id !== garde.id) aSupprimer.push(photo.id); });
    });

    /*
     * Les fiches restees sans lien.
     *
     * Le cas qui compte ici, et qui n'etait PAS traite: une copie sans lien
     * dont la jumelle, elle, en a un. Le rattrapage par empreinte ne l'attrape
     * pas - il ne s'occupe que des elements de Room qui n'ont encore aucune
     * photo - et comparer les orphelines entre elles ne suffisait pas non plus.
     * Resultat: sur cent six images deja rangees, quarante-huit copies
     * survivaient a chaque passage. On compare donc chaque orpheline a CE QUI
     * EST GARDE, puis les orphelines entre elles.
     */
    const parSignature = new Map();
    const signaturesGardees = new Set();
    retenues.forEach((photo) => {
        const cle = empreinte(photo.width, photo.height, poidsDe(photo));
        if (!cle) return;
        if (!parSignature.has(cle)) parSignature.set(cle, photo);
        signaturesGardees.add(cle);
    });
    const isolees = [];
    orphelines.forEach((photo) => {
        const cle = empreinte(photo.width, photo.height, poidsDe(photo));
        if (!cle) { isolees.push(photo); return; }
        /* Une photo deja retenue pour un element de Room gagne TOUJOURS: la
           depasser au score casserait l'invariant qu'on vient d'etablir - un
           element de Room, une photo - et laisserait cet element sans image. */
        if (signaturesGardees.has(cle)) { aSupprimer.push(photo.id); return; }
        const jumelle = parSignature.get(cle);
        if (!jumelle) { parSignature.set(cle, photo); isolees.push(photo); return; }
        /* Deux fiches sans lien, meme taille, meme poids a l'octet: c'est la
           meme image. On garde la meilleure, l'autre part. */
        const garde = meilleure([jumelle, photo], null);
        const partante = garde.id === jumelle.id ? photo : jumelle;
        aSupprimer.push(partante.id);
        if (partante.id === jumelle.id) {
            parSignature.set(cle, photo);
            const rang = isolees.findIndex((row) => row.id === jumelle.id);
            if (rang >= 0) isolees.splice(rang, 1, photo);
        }
    });

    /* Ce qui manque, dans l'ordre du carrousel. */
    const dejaLa = new Set(gardees.map((paire) => paire.roomId));
    const aCreer = roomItems
        .filter((item) => !dejaLa.has(item.id))
        .map((item) => ({ item, photoId: canonique(item) }));

    /* Une fiche corrigee puis jugee en trop ne doit pas etre reecrite avant
       d'etre effacee: on la retire des corrections. */
    const partantes = new Set(aSupprimer);
    const aReparer = [...patchs.values()].filter((photo) => !partantes.has(photo.id));

    return {
        aCreer,
        aReparer,
        aPreset: aPreset.filter((id) => !partantes.has(id)).length,
        aSupprimer: [...new Set(aSupprimer)],
        gardees,
        horsRoom: isolees.length,
        total: roomItems.length,
    };
}

/* Le plan a-t-il quelque chose a faire ? Sert a dire « tout est deja cale »
   sans faire semblant de travailler. */
export function planVide(plan) {
    return !plan.aCreer.length && !plan.aReparer.length && !plan.aSupprimer.length;
}
