# Reprise — favoris de presets Vision — 2026-08-31

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

Lire dans cet ordre : `AGENTS.md`, le début de `todo.md`, les zones utiles de
`plan.md` et `map.md`. Ne pas ouvrir les archives ni les anciens prompts de
reprise. Lire `docs/presets-valides.md` seulement si un preset ou son rendu doit
être modifié.

## État livré

Vision propose une étoile sur chaque preset et un filtre Favoris combinable
avec la recherche. Les favoris sont propres au compte Firebase et synchronisés
en direct dans :

`users/{uid}/visionPresetFavorites/{presetId}`

Chaque document contient uniquement `ownerUid`, `presetId`, `createdAt` et
`updatedAt`. Les règles Firestore refusent les lectures/écritures inter-comptes
et les documents dont l'identifiant ne correspond pas à `presetId`.

Fichiers principaux :

- `src/features/vibeos/vision/usePresetFavorites.js`
- `src/features/vibeos/vision/VisionScreen.jsx`
- `src/features/vibeos/vision/presetCollections.js`
- `src/features/vibeos/vision/vision.module.css`
- `firestore.rules`
- `scripts/smoke-vision-preset.mjs`
- `scripts/smoke-vibeos-vision.spec.cjs`

## Gates du lot

- `npm run test:vision-preset` : 438/438.
- smoke navigateur Vision : 3/3.
- scénario navigateur ciblé après refactor : 1/1.
- règles Firestore : émulateur avec deux comptes, propriétaire autorisé et
  second compte refusé en lecture/écriture.
- `npm run lint` : 0 erreur, 5 avertissements préexistants.
- `npm run build` sous Node 22 : vert, avertissement NFT préexistant.

## Invariants

- Ne jamais supprimer ni remplacer un preset validé.
- Ne jamais persister les favoris d'un vrai utilisateur uniquement en local.
- Ne jamais laisser l'étoile appliquer le preset.
- Ne jamais afficher les favoris d'un UID pendant le chargement d'un autre UID.
- Aucun secret Firebase dans le client.

## Suite suggérée

Vérifier le parcours live avec deux comptes réels si deux identités sont
disponibles : ajouter un favori avec A, recharger, confirmer sa présence, puis
ouvrir B et confirmer son absence. Pour tout nouveau lot, rejouer les gates
ciblés et le rituel de fin de phase d'`AGENTS.md`.
