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
- `npm run test:vibeos-library` : passe, 13 vérifications ajoutées (7 pour le
  tri, 6 pour la cadence du carrousel).
- `npm run build` : passe.
- Vérifié dans un navigateur Chromium sur 41, 12 puis 60 photos générées, plus
  un vrai HEIC de 665 Ko.

## Déploiement — à savoir

Le rollout automatique est **désactivé** sur le backend App Hosting
(`ABIU: Disabled`) : pousser sur `master` ne déploie rien, contrairement à ce
que laisse croire `docs/developpement-local-et-couts.md`. Le rollout se lance à
la main :

    npx firebase-tools@latest apphosting:rollouts:create vibefx-v2-web --project vibefx-v2 -g <commit>

La CI GitHub « Verify » est rouge depuis plusieurs commits, sur une fausse
alerte : l'audit interdit le mot « Chawi » et le trouve à l'intérieur du LUT
base64 de `src/features/vibefx-studio/utils/presets/lf08.js`. Ne pas toucher au
preset ; c'est l'audit qu'il faut rendre aveugle aux charges encodées.

## Le carrousel, corrigé dans la foulée

Constaté sur 264 vraies photos : « lent et à moitié buggué si on veut aller
vite ». `slideTo` verrouillait 620 ms et **jetait** les appuis reçus pendant ce
temps. Remplacé par une photo visée qui avance à chaque appui, et une durée
d'animation taillée dans le rythme (`carouselCadence.js`) : 620 ms au calme,
90 % de l'écart en rythme soutenu, bascule sèche en rafale. Clavier élargi
(4 flèches, Espace, Page, Début/Fin), répétition comprise.

## Non vérifié, à faire en premier

1. **Safari sur Mac**, où le HEIC se décode NATIVEMENT (chemin
   `source.decodedFrom === 'native'` de `buildScoutRecord`). C'est le chemin
   rapide et c'est le navigateur de Matthis ; il n'a jamais été joué par un
   agent.
2. **Un vrai lot de plusieurs centaines de photos** : durée réelle, poids réel
   dans IndexedDB, fluidité de la grille.
3. **La sensation du carrousel à 60 images/seconde.** La cadence est mesurée
   (durées écrites dans le DOM, aucun appui perdu sur 15 frappes enchaînées),
   la fluidité perçue ne l'est pas.
4. **Pas de touche « je jette »** : une touche X manque, et il faut trancher ce
   qu'elle fait — supprimer l'aperçu, ou marquer « écartée » et masquer.

## Interdits

- Ne jamais toucher au projet source `jardin de chawi`.
- Ne jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Aucun déploiement sans demande explicite (ça coûte de l'argent réel).
- Ne pas relancer tous les gates : seulement ceux que le changement touche.

## Rituel de fin de phase

`npm run lint`, les suites touchées, puis mise à jour de `todo.md`, `plan.md`,
`map.md` (arbre + entrée de journal datée), et ce fichier de reprise.
