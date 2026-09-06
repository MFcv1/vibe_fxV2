# Prompt de reprise — 2026-09-06, Room <-> bibliotheque

Colle ce texte tel quel dans un chat neuf.

---

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2` (macOS, branche
`master`). App Next.js App Router + Firebase App Hosting, deployee sur
`https://vibefx-v2-web--vibefx-v2.europe-west4.hosted.app`.

## Ordre de lecture

1. `AGENTS.md` — regles de travail, economie de contexte, rituel de fin de phase.
2. `docs/developpement-local-et-couts.md` — **aucun deploiement sans demande
   explicite**.
3. `todo.md` — chantier actif.
4. `map.md` — **par extraits seulement** (`grep -n`, `sed -n`), il fait plus de
   6000 lignes.

**Ne PAS lire** : `docs/archive-*`, les autres `docs/prompt-reprise-*`, les
dossiers `vibefx-*` sauf si on touche a un moteur precis.

## Etat du lot livre

Le pont Room -> bibliotheque fabriquait des doublons a chaque « Enregistrer »
(106 images de Room -> 154 photos dans le dossier) et les suppressions ne
tenaient pas d'une session a l'autre. Le modele a ete refait :

- `src/features/vibeos/room/roomLibraryPlan.js` (nouveau, module PUR) :
  `roomPhotoId(folderId, roomItemId)` donne une identite **deduite** du couple
  (dossier, element). Deux enregistrements de la meme image ecrivent la meme
  cle : le doublon n'est plus detecte apres coup, il est impossible a fabriquer.
  `planReconcile({ roomItems, folderPhotos, folderId })` renvoie
  `{ aCreer, aReparer, aSupprimer, gardees, horsRoom }`. Deux invariants a ne
  jamais casser : **on ne supprime jamais une image unique**, et **un element de
  Room = au plus une photo dans le dossier**.
- `roomToLibrary.js` : `previewRoomFolderSync(folderId)` annonce le plan,
  `syncRoomToFolder({ folderId, folderName, onProgress })` l'applique.
  Idempotent.
- `libraryDb.js` : base `vibeos-library` **v3**, store `tombstones`
  (`putTombstones`, `listTombstones`, `markTombstoneDone`, `dropTombstones`,
  `purgeTombstones`). Une suppression est ecrite sur le disque : elle interdit le
  retour tout de suite ET reste une tache a finir tant que le compte n'a pas
  suivi.
- `useLibrarySync.js` : pierres tombales persistantes chargees AVANT l'ecoute
  Firestore, drain des suppressions distantes 4 de front, echecs d'envoi comptes
  **par photo** (3 essais -> photo mise de cote, la file continue), bandeau
  « Réessayer », repercussion des suppressions faites ailleurs pour les photos
  sans fichier local.
- `libraryCloud.deletePhotoRemote` ne masque plus l'echec de la suppression
  Firestore (le masquer reprogrammait le retour de la photo).
- `RoomScreen.jsx` : la feuille annonce le plan ligne par ligne avant le clic ;
  le bouton dit « Synchroniser ce dossier » ou « Tout est deja cale ».

## Gates

- `npm run test:room-library` — 6 cas, dont le cas reel 106/154. **Passe.**
- `npm run lint` — 0 erreur, 5 avertissements preexistants. **Passe.**
- `npm run build` — **Passe.**
- `npm run test:scope` — **echec PREEXISTANT** :
  `src/features/vibefx-studio/utils/presets/lf08.js` contient « Chawi »
  (commit `7401cd0`, sans rapport avec ce lot).

## Ce qui n'a PAS ete verifie

Le parcours dans le navigateur connecte : la session locale s'arrete a l'ecran
de connexion (le contournement dev ne passe pas sans configuration). Le
comportement est demontre au niveau du plan, pas a l'ecran.

Le lot n'est **pas commite** et **pas deploye**.

## Interdits

- Ne jamais modifier `~/Desktop/jardin de chawi`.
- Ne jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Aucun deploiement sans demande explicite de l'utilisateur.
- Pas de sous-agent sans demande explicite.

## Rituel de fin de phase

`npm run lint`, gates cibles, puis mise a jour de `todo.md`, `plan.md`,
`map.md` (arborescence + journal date), et ecriture d'un
`docs/prompt-reprise-<date>.md`. Recap final en langage simple, sans jargon.
