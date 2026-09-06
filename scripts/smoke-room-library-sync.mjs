/*
 * GATE - la Room et son dossier de bibliotheque restent d'accord.
 *
 * Ce que ce test protege, en une phrase: on doit pouvoir appuyer sur
 * « Synchroniser » autant de fois qu'on veut sans jamais fabriquer une copie
 * de plus, et sans jamais perdre une image qui n'existe qu'en un exemplaire.
 *
 * Le contexte, parce qu'il explique chaque cas ci-dessous: pendant des
 * semaines, enregistrer la Room dans un dossier deja servi reimportait toute la
 * file. Cent six images de Room avaient rempli un dossier de cent cinquante-
 * quatre photos, et supprimer les doublons ne tenait pas d'une session a
 * l'autre. La cause etait un identifiant tire au hasard a chaque ecriture, donc
 * une reconnaissance « au jugé » qu'il suffisait de rater une fois.
 *
 * Les six verifications:
 *
 *  1. IDENTITE DEDUITE - le meme couple (dossier, element de Room) donne
 *     toujours la meme cle; deux dossiers differents donnent des cles
 *     differentes. C'est ce qui rend le doublon impossible a ECRIRE.
 *  2. DOSSIER NEUF - tout est a creer, rien a supprimer.
 *  3. IDEMPOTENCE - rejouer le plan sur son propre resultat ne donne plus rien.
 *  4. LE CAS REEL - 106 elements, un dossier a 154 photos melangeant liens,
 *     fiches d'avant sans lien et copies multiples: on retombe sur 106, et le
 *     deuxieme passage ne fait rien.
 *  5. AJOUT INCREMENTAL - quatre images de plus dans la Room ne font ajouter
 *     que ces quatre-la.
 *  6. ON NE PERD RIEN - une photo unique dont l'element de Room a disparu (file
 *     videe apres publication) reste dans le dossier.
 *  7. LE PRESET DES FICHES D'AVANT - le nom du look n'a commence a suivre la
 *     photo que le 2026-09-06; avant, la vignette s'affichait sans etiquette
 *     alors que l'information existait toujours dans la Room. La synchro la
 *     recopie, et seulement pour les rendus de Vision: le `formatLabel` d'un
 *     rendu de Layout est un format d'export, pas un preset.
 *  9. LE NOM DU FICHIER TELECHARGE - il doit se ranger dans l'ordre du
 *     carrousel et survivre a macOS, Windows et iOS. Un nom refuse par le
 *     systeme, c'est un telechargement qui echoue sans rien dire.
 */

import assert from 'node:assert/strict';
import { planReconcile, planVide, presetDe, roomPhotoId } from '../src/features/vibeos/room/roomLibraryPlan.js';
import { roomFileName } from '../src/features/vibeos/room/roomFileName.js';

const echecs = [];
function verifier(titre, run) {
    try {
        run();
        console.log(`  ok   ${titre}`);
    } catch (error) {
        echecs.push({ titre, error });
        console.log(`  FAIL ${titre}\n       ${error.message}`);
    }
}

/* Un element de Room: des pixels, un poids, rien d'autre ne compte ici. */
function roomItem(n) {
    return {
        id: `room-${n}`, width: 1080, height: 1350, bytes: 1000 + n, order: n,
    };
}

/* Applique un plan a un dossier, comme le fait `syncRoomToFolder`. */
function appliquer(folderPhotos, plan, folderId) {
    const supprimes = new Set(plan.aSupprimer);
    const repares = new Map(plan.aReparer.map((photo) => [photo.id, photo]));
    const restantes = folderPhotos
        .filter((photo) => !supprimes.has(photo.id))
        .map((photo) => repares.get(photo.id) || photo);
    const creees = plan.aCreer.map(({ item, photoId }) => ({
        id: photoId,
        folderId,
        fromRoomId: item.id,
        width: item.width,
        height: item.height,
        bytes: item.bytes,
        addedAt: Date.now(),
        blob: {},
        cloud: { state: 'local' },
    }));
    return [...restantes, ...creees];
}

console.log('\nRoom -> bibliotheque : synchronisation');

verifier('1. l identifiant est deduit du couple (dossier, element)', () => {
    assert.equal(roomPhotoId('fd-a', 'room-1'), roomPhotoId('fd-a', 'room-1'));
    assert.notEqual(roomPhotoId('fd-a', 'room-1'), roomPhotoId('fd-b', 'room-1'));
    assert.notEqual(roomPhotoId('fd-a', 'room-1'), roomPhotoId('fd-a', 'room-2'));
    assert.equal(roomPhotoId(null, 'room-1'), null);
    assert.match(roomPhotoId('fd-a', 'room-1'), /^ph-r-[0-9a-f]{8}-room-1$/);
});

verifier('2. un dossier neuf prend toute la file, et rien d autre', () => {
    const roomItems = Array.from({ length: 10 }, (unused, n) => roomItem(n));
    const plan = planReconcile({ roomItems, folderPhotos: [], folderId: 'fd-neuf' });
    assert.equal(plan.aCreer.length, 10);
    assert.equal(plan.aSupprimer.length, 0);
    assert.equal(plan.aReparer.length, 0);
    /* L ordre du carrousel est conserve: la premiere image reste la premiere. */
    assert.equal(plan.aCreer[0].item.id, 'room-0');
});

verifier('3. rejouer le plan ne donne plus rien a faire', () => {
    const roomItems = Array.from({ length: 10 }, (unused, n) => roomItem(n));
    const premier = planReconcile({ roomItems, folderPhotos: [], folderId: 'fd-1' });
    const apres = appliquer([], premier, 'fd-1');
    const second = planReconcile({ roomItems, folderPhotos: apres, folderId: 'fd-1' });
    assert.ok(planVide(second), 'le deuxieme passage devrait etre vide');
    assert.equal(second.gardees.length, 10);
});

verifier('4. le cas reel : 106 images, un dossier a 154 photos', () => {
    const roomItems = Array.from({ length: 106 }, (unused, n) => roomItem(n));
    const folderPhotos = [];
    roomItems.forEach((item, index) => {
        const commun = {
            folderId: 'fd-room', width: item.width, height: item.height, bytes: item.bytes,
        };
        /* Un tiers des fiches est d avant: pas de lien, seulement une empreinte. */
        const lien = index % 3 === 0 ? null : item.id;
        folderPhotos.push({
            ...commun, id: `vieux-${index}`, fromRoomId: lien, addedAt: 1000 + index, blob: {},
        });
        /* Quarante-huit d entre elles ont ete enregistrees une deuxieme fois. */
        if (index < 48) {
            folderPhotos.push({
                ...commun, id: `copie-${index}`, fromRoomId: null, addedAt: 2000 + index,
            });
        }
    });
    assert.equal(folderPhotos.length, 154, 'le dossier de depart doit bien peser 154 fiches');

    const plan = planReconcile({ roomItems, folderPhotos, folderId: 'fd-room' });
    assert.equal(plan.aCreer.length, 0, 'tout est deja la, rien a creer');
    assert.equal(plan.aSupprimer.length, 48, 'les 48 copies partent');

    const apres = appliquer(folderPhotos, plan, 'fd-room');
    assert.equal(apres.length, 106, 'le dossier retombe sur le compte de la Room');
    /* Chaque element de Room a exactement une photo. */
    const parRoom = new Map();
    apres.forEach((photo) => {
        parRoom.set(photo.fromRoomId, (parRoom.get(photo.fromRoomId) || 0) + 1);
    });
    assert.equal(parRoom.size, 106);
    assert.ok([...parRoom.values()].every((n) => n === 1), 'une seule photo par element');

    const second = planReconcile({ roomItems, folderPhotos: apres, folderId: 'fd-room' });
    assert.ok(planVide(second), 'le deuxieme passage ne doit plus rien trouver');
});

verifier('5. quatre images de plus n en font ajouter que quatre', () => {
    const debut = Array.from({ length: 36 }, (unused, n) => roomItem(n));
    const range = appliquer([], planReconcile({ roomItems: debut, folderPhotos: [], folderId: 'fd-2' }), 'fd-2');
    const suite = [...debut, ...Array.from({ length: 4 }, (unused, n) => roomItem(100 + n))];
    const plan = planReconcile({ roomItems: suite, folderPhotos: range, folderId: 'fd-2' });
    assert.equal(plan.aCreer.length, 4);
    assert.equal(plan.aSupprimer.length, 0);
});

verifier('6. une photo unique ne disparait jamais', () => {
    const roomItems = [roomItem(1)];
    const folderPhotos = [
        {
            id: 'ph-vieux', folderId: 'fd-3', fromRoomId: 'room-99', width: 1080, height: 1350, bytes: 42, addedAt: 1, blob: {},
        },
        {
            id: 'ph-import', folderId: 'fd-3', fromRoomId: null, width: 4000, height: 6000, bytes: 900, addedAt: 2, blob: {},
        },
    ];
    const plan = planReconcile({ roomItems, folderPhotos, folderId: 'fd-3' });
    assert.equal(plan.aSupprimer.length, 0, 'aucune des deux ne doit partir');
    assert.equal(plan.aCreer.length, 1, 'seule l image de la Room manque');
    const apres = appliquer(folderPhotos, plan, 'fd-3');
    assert.equal(apres.length, 3);
    assert.ok(planVide(planReconcile({ roomItems, folderPhotos: apres, folderId: 'fd-3' })));
});

verifier('7. le preset des fiches d avant est repris sur la Room', () => {
    const vision = { ...roomItem(1), source: 'vision', formatLabel: 'Powlisher Main' };
    const layout = { ...roomItem(2), source: 'layout', formatLabel: '4:5' };
    const sansLook = { ...roomItem(3), source: 'vision', formatLabel: 'Photo' };
    const roomItems = [vision, layout, sansLook];

    assert.deepEqual(presetDe(vision), { label: 'Powlisher Main' });
    assert.equal(presetDe(layout), null, 'un format d export n est pas un preset');
    assert.equal(presetDe(sansLook), null);

    /* Trois fiches rangees avant la feature: lien present, preset absent. */
    const folderPhotos = roomItems.map((item, index) => ({
        id: `vieux-${index}`,
        folderId: 'fd-preset',
        fromRoomId: item.id,
        width: item.width,
        height: item.height,
        bytes: item.bytes,
        preset: null,
        addedAt: 100 + index,
        blob: {},
    }));

    const plan = planReconcile({ roomItems, folderPhotos, folderId: 'fd-preset' });
    assert.equal(plan.aCreer.length, 0);
    assert.equal(plan.aSupprimer.length, 0, 'un rattrapage de preset ne supprime rien');
    assert.equal(plan.aPreset, 1, 'seul le rendu Vision recupere une etiquette');
    const repare = plan.aReparer.find((photo) => photo.fromRoomId === 'room-1');
    assert.deepEqual(repare.preset, { label: 'Powlisher Main' });
    /* Le reste de la fiche est intact: on complete, on ne reecrit pas. */
    assert.equal(repare.id, 'vieux-0');
    assert.equal(repare.blob, folderPhotos[0].blob);

    const apres = appliquer(folderPhotos, plan, 'fd-preset');
    const second = planReconcile({ roomItems, folderPhotos: apres, folderId: 'fd-preset' });
    assert.equal(second.aPreset, 0, 'deuxieme passage: plus rien a recopier');
    assert.ok(planVide(second));
});

verifier('8. un lien ET un preset manquants tiennent sur une seule ecriture', () => {
    const item = { ...roomItem(1), source: 'vision', formatLabel: 'CN02' };
    /* Fiche d avant: ni lien vers la Room, ni preset. */
    const folderPhotos = [{
        id: 'vieux', folderId: 'fd-2', fromRoomId: null, preset: null,
        width: item.width, height: item.height, bytes: item.bytes, addedAt: 1, blob: {},
    }];
    const plan = planReconcile({ roomItems: [item], folderPhotos, folderId: 'fd-2' });
    assert.equal(plan.aReparer.length, 1, 'une seule fiche ecrite, pas deux');
    assert.equal(plan.aReparer[0].fromRoomId, 'room-1');
    assert.deepEqual(plan.aReparer[0].preset, { label: 'CN02' });
    assert.equal(plan.aCreer.length, 0);
});

verifier('9. le nom du fichier telecharge tient sur les trois systemes', () => {
    const item = { projectTitle: 'Agadir', formatLabel: 'Powlisher Main', type: 'image/jpeg' };

    /* Numero sur trois chiffres: 010 se range apres 009, pas apres 001. */
    assert.equal(roomFileName(item, 0), '001 - Agadir - Powlisher Main.jpg');
    assert.equal(roomFileName(item, 9), '010 - Agadir - Powlisher Main.jpg');
    assert.equal(roomFileName(item, 105), '106 - Agadir - Powlisher Main.jpg');

    /* Les caracteres que macOS, Windows ou iOS refusent ne passent jamais. */
    const sale = { projectTitle: 'Ete 2026 : le "sud"', formatLabel: '4:5 / carre*', type: 'image/jpeg' };
    const nom = roomFileName(sale, 0);
    assert.ok(!/[\\/:*?"<>|]/.test(nom), `nom encore interdit : ${nom}`);
    assert.ok(nom.endsWith('.jpg'));
    assert.ok(!/[.\s]\.jpg$/.test(nom), 'ni point ni espace juste avant l extension');

    /* Le PNG reste un PNG. */
    assert.ok(roomFileName(item, 0, 'image/png').endsWith('.png'));

    /* Sans titre ni preset, il reste un nom utilisable. */
    assert.equal(roomFileName({}, 3), '004.jpg');
    assert.equal(roomFileName(null, 3), '004.jpg');

    /* Un titre a rallonge ne fait pas un nom que le systeme refuse. */
    const long = roomFileName({ projectTitle: 'x'.repeat(400) }, 0);
    assert.ok(long.length <= 124, `nom trop long : ${long.length}`);
    assert.ok(long.endsWith('.jpg'));
});

if (echecs.length) {
    console.error(`\n${echecs.length} verification(s) en echec.`);
    process.exit(1);
}
console.log('\nTout passe.\n');
