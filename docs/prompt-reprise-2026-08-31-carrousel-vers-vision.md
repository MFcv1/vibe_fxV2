# Reprise — carrousel Bibliothèque vers Vision — 2026-08-31

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

Lire `AGENTS.md`, le début de `todo.md`, puis seulement les zones Bibliothèque
de `plan.md` et `map.md`. Ne pas ouvrir les archives ni les anciens prompts.

## Lot terminé localement

Le bouton « Retoucher » du carrousel semblait inactif sur Safari pour les
photos présentes seulement dans Firebase. La cause était l'attente du décodage
plein format, de la nouvelle vignette et de sa persistance IndexedDB avant la
navigation.

`useLibrarySync.hydrate` rend désormais le Blob dès son téléchargement et finit
la vignette/cache en arrière-plan. Il retente l'aperçu si l'original distant
échoue. `LibraryScreen` protège contre les doubles clics et remonte une erreur
utile ; `Lightbox` affiche « Ouverture… ».

Le smoke Bibliothèque simule une photo distante sans Blob local et vérifie que
le bouton du carrousel atteint `/creer/vision` avec l'écran Vision visible.

## Gates

- `npm run test:vibeos-library` : 36/36 hors navigateur + 1/1 navigateur ;
- `npm run lint` : zéro erreur, cinq avertissements préexistants ;
- `npm run build` sous Node 22 : vert, avertissement NFT préexistant.

## État de livraison

Le correctif n'est pas encore déployé. Ne lancer Firebase App Hosting que sur
demande explicite, après vérification de l'arbre Git et des gates ciblés.

La connexion Google Safari reste un chantier distinct : ne pas supposer qu'elle
est close uniquement à partir des notes précédentes ; la retester sur le live
si l'utilisateur la remet dans le scope.
