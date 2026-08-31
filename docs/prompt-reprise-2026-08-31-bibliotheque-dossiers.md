# Prompt de reprise — 2026-08-31, bibliothèque en dossiers

Colle ce texte dans un chat neuf pour repartir sans rien relire d'autre.

---

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2` (macOS, branche
`presets-mesures-sur-corpus`, distante GitHub à jour, Node 22 pour builder —
Node 26 casse `better-sqlite3` au moment de `Collecting page data`, c'est un
blocage local connu et sans rapport avec le code).

## Ordre de lecture

1. `AGENTS.md` — règles de travail, économie de contexte, rituel de fin de phase.
2. `todo.md` — chantier actif seulement.
3. `map.md` — **ne lire que la zone touchée** (`grep -n`, `sed -n`).
4. `docs/presets-valides.md` — seulement si tu touches aux presets.

Ne PAS ouvrir : `docs/archive-*`, `docs/prompt-reprise-*` (sauf celui-ci), les
journaux de `map.md` hors de ta zone.

## Ce qui vient d'être livré

`/creer/bibliotheque` s'ouvre sur des **dossiers**. Un import crée un dossier,
nommé comme sur un OS ; cliquer dessus ouvre la grille masonry existante, qui
n'a pas bougé (vagues d'apparition, carrousel, filtres, densité). Une fenêtre
d'import reconnaît l'appareil et propose les bonnes sources. Quota 1000 photos
et 5 Go vérifié avant l'import. Quand un compte réel est connecté, chaque photo
part vers Firebase (aperçu 1600 px + original) et redescend sur un autre
appareil.

Fichiers ajoutés dans `src/features/vibeos/library/` : `platform.js`,
`folderNaming.js`, `libraryQuota.js`, `FolderCard.jsx`, `ImportSheet.jsx`,
`libraryCloud.js`, `useLibrarySync.js`. Modifiés : `libraryDb.js` (IndexedDB v2,
store `folders`, migration des photos existantes), `useLibrary.js`,
`photoImport.js`, `LibraryScreen.jsx`, `library.module.css`. Règles :
`firestore.rules` (`users/{uid}/libraryFolders|libraryPhotos`), `storage.rules`
(`users/{uid}/library/{photoId}/…`, 25 Mo par fichier).

## État des gates

- `npm run test:vibeos-library` : 37 vérifications hors navigateur + smoke
  navigateur 1/1. Vert.
- `npm run lint` : 0 erreur, 5 avertissements préexistants.
- `npm run build` : vert sous Node 22.
- Émulateurs Firebase (auth + Firestore + Storage) : montée et descente
  vérifiées à la main, IndexedDB effacé puis tout revenu.
- **Aucun déploiement.** Les règles ajoutées ne sont pas en ligne.

## Mission suivante, dans l'ordre

1. **Déployer quand l'utilisateur le demande** : `firebase deploy --only
   firestore:rules,storage:rules` avant tout usage réel de la sauvegarde,
   sinon chaque envoi sera refusé en production.
2. **Compteur de quota serveur** : aujourd'hui le plafond est tenu côté client.
   Une Function `onFinalize` sur `users/{uid}/library/**` qui agrège
   photos + octets dans `users/{uid}` rendrait le plafond étanche. À faire avant
   d'ouvrir à d'autres comptes.
3. **Redescendre les renommages** : un dossier déjà présent en local n'est plus
   relu depuis le compte.
4. Le reste du chantier presets est intact dans `todo.md`.

## Interdits

- Ne jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Aucun déploiement sans demande explicite (ça coûte de l'argent réel).
- Pas de sous-agent sauf demande explicite.
- Ne pas casser l'ergonomie déjà validée de la grille et du carrousel.

## Rituel de fin de phase

Gates ciblés, puis `todo.md`, `plan.md`, `map.md` (arbre + journal daté), puis le
fichier `docs/prompt-reprise-<date>.md` et son lien dans `todo.md`. Récap en
langage simple dans le chat ; le prompt de reprise ne se colle dans le chat que
si l'utilisateur l'a demandé au début de la session.
