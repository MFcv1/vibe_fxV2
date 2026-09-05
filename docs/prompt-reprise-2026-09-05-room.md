# Prompt de reprise — apres la Room (2026-09-05)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## Ordre de lecture

1. `AGENTS.md` — regles de travail, economie de contexte, rituel de fin de phase.
2. `todo.md` — chantier actif ; la Room y a son encadre en tete et sa section
   « Room — ce qui reste ».
3. `map.md` — **seulement** le journal `2026-09-05 sexies` et les deux zones
   `src/features/vibeos/room/` et `src/app/creer/room/`.

**Ne pas ouvrir** : `docs/archive-*`, les autres `docs/prompt-reprise-*`, le
reste de `map.md`.

## Etat livre

La Room est l'etape entre « une image finie » et « un post ». Layout et Vision
travaillent sur UNE image ; la Room est la file ou les rendus s'accumulent dans
l'ordre du carrousel Instagram.

- **`/creer/room`** (`src/features/vibeos/room/`) : file horizontale numerotee,
  reordonnable au glisser-deposer ET aux fleches, retrait par carte, vidage a
  double clic de confirmation. « Valider l'ordre » ouvre l'apercu Instagram
  existant (`layout/InstaPreviewSheet`) alimente par la file.
- **Bouton « Room »** a cote d'« Exporter » dans `LayoutScreen` et
  `VisionScreen`. Il envoie `renderExportCanvas()` — le rendu PLEINE
  DEFINITION, pas l'apercu — a `addFromCanvas`, qui passe par
  `buildSocialImages` : un panorama entre donc dans la file deja decoupe en 2 ou
  3 tranches, exactement celles que l'export produit.
- **Ce qui est stocke est un rendu fige**, pas des reglages. Retoucher ensuite
  ne change plus l'image envoyee ; c'est ce qui permet de mettre deux versions
  d'une meme photo dans un carrousel.
- **Persistance** : store `room` d'IndexedDB `vibeos`, passee en **v2**
  (`src/features/vibeos/project/projectDb.js`, qui expose maintenant
  `withStore`, `requestToPromise`, `readMeta`, `writeMeta`). Blobs, jamais de
  dataURL. Rien ne part au serveur.
- **Plafond 10 images** (`ROOM_MAX_ITEMS`), comme le carrousel de l'apercu.
- Le compteur d'images en attente s'affiche dans la navigation du shell.

## Etat des gates

- `npm run lint` : 0 erreur, 5 avertissements **preexistants**.
- `npm run build` : passe ; `/creer/room` est prerendu statique.
- `npm run test:vibeos-room` : **vert** (nouveau). Bout en bout : Layout -> Room,
  Vision -> Room, survie au rechargement, fleches, glisser-deposer, validation,
  puis relecture des COULEURS des images dans le carrousel de l'iPhone.
- `smoke-vibeos-layout-*` (5) et `smoke-vibeos-vision` (3) : **verts** joues
  serieusement un par un (`--workers=1`).

Echecs **preexistants**, verifies `git stash` a l'appui :

- `npm run test:scope` echoue sur
  `src/features/vibefx-studio/utils/presets/lf08.js`, qui contient encore
  « Chawi ».
- `npm run test:vibeos-layout` echoue quand ses 5 specs tournent en parallele
  sur un seul serveur de dev (aucune n'atteint l'ecran). Les memes passent une
  par une. C'est un probleme du harnais, pas du Layout.

## Mission suivante, dans l'ordre

1. **Brancher la Room sur « Publier »**. Aujourd'hui `PublishButton` envoie
   toujours le rendu du PROJET courant vers `/publier`. Faire accepter plusieurs
   images a `project/publishHandoff.js`, et les reprendre comme carrousel dans
   `PublierClient` / `PublicationsManager`.
2. **Titre et legende** : l'apercu affiche encore les textes de demonstration
   (« Ton visuel VibeFX »). Les rendre editables depuis la Room serait le
   prolongement naturel du « valider avant de voir ».
3. Voir `todo.md` § « Room — ce qui reste » pour le detail, dont la question
   d'une file unique contre une file par post.

## Interdits

- Ne pas toucher au projet source `jardin de chawi`.
- Ne pas supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Aucun deploiement sans demande explicite.
- Ne pas melanger les prefixes de tokens `--vo-`, `--vc-` et `--vf-`.
- Ne pas lancer de sous-agent sans demande explicite.

## Rituel de fin de phase

`npm run lint`, la ou les suites impactees, `npm run build` en fin de lot reel ;
puis `todo.md`, `plan.md`, `map.md` (arborescence + journal date), et un
`docs/prompt-reprise-<date>.md` — sans le coller dans le chat si l'utilisateur ne
l'a pas demande en debut de session.
