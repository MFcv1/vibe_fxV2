# Prompt de reprise — 2026-09-05, après le tri local de la bibliothèque

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2` (macOS).

## Ordre de lecture

1. `AGENTS.md` — règles de travail, économie de contexte, discipline de déploiement.
2. `todo.md` — le chantier actif et ce qui reste.
3. `map.md` — **seulement la zone touchée** (`grep -n`, `sed -n '<a>,<b>p'`).
   Le journal de ce lot : « Journal — 2026-09-05 septies ».

**Ne PAS lire** : les archives `docs/archive-*`, les autres
`docs/prompt-reprise-*`, sauf si on retourne exactement dans leur chantier.

## Ce qui vient d'être livré

Un deuxième geste dans la Bibliothèque, à côté de l'import : **Trier**.

- On désigne un dossier entier (Téléchargements et ses centaines de photos).
- Seul l'**aperçu WebP 1600 px** (~200 Ko) est stocké. Aucun original n'entre en
  base ; la poignée `File` reste en mémoire pour la session.
- Le dossier créé porte `kind: 'scout'` et `localOnly: true` : la synchronisation
  le saute et il ne compte pas dans le quota du compte.
- On garde au cœur (bouton sur la tuile, touche **F** dans le carrousel).
- Un bandeau flottant importe pour de vrai les gardées, dans un NOUVEAU dossier,
  en relisant les fichiers d'origine. Le dossier de tri reste intact.
- Après un rechargement d'onglet, les aperçus et les favoris survivent mais pas
  les poignées : le bandeau propose « Retrouver les fichiers » et rapproche par
  signature `nom|taille|dateDeModification`.

Module central : `src/features/vibeos/library/libraryScout.js`.

## État des gates

- `npm run lint` : passe (avertissements préexistants ailleurs seulement).
- `npm run test:vibeos-library` : passe, 7 vérifications ajoutées pour le tri.
- Vérifié dans un navigateur Chromium sur 41 puis 12 photos générées plus un
  vrai HEIC de 665 Ko.

## Non vérifié, à faire en premier

1. **Safari sur Mac**, où le HEIC se décode NATIVEMENT (chemin
   `source.decodedFrom === 'native'` de `buildScoutRecord`). C'est le chemin
   rapide et c'est le navigateur de Matthis ; il n'a jamais été joué.
2. **Un vrai lot de plusieurs centaines de photos** : durée réelle, poids réel
   dans IndexedDB, fluidité de la grille.
3. **Le carrousel avale les flèches pendant son animation** (`slideTo` refuse
   pendant un glissement). Sur sept cents photos ça saute des images, et c'est
   LE geste du tri : à corriger en premier.
4. **Pas de touche « je jette »** : une touche X qui retire du tri et avance
   d'un cran manque.

## Interdits

- Ne jamais toucher au projet source `jardin de chawi`.
- Ne jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Aucun déploiement sans demande explicite (ça coûte de l'argent réel).
- Ne pas relancer tous les gates : seulement ceux que le changement touche.

## Rituel de fin de phase

`npm run lint`, les suites touchées, puis mise à jour de `todo.md`, `plan.md`,
`map.md` (arbre + entrée de journal datée), et ce fichier de reprise.
