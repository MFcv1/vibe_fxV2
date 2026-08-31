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

Le commit `a8b6993` est poussé sur `master` et le rollout Firebase App Hosting
est terminé. L'URL live répond 200 et sert le nouveau bundle. Avec le compte
réel, `IMG_0421.JPG` a été ouverte dans le carrousel puis « Retoucher » a mené
à `/creer/vision`, écran Vision visible.

La connexion Google Safari reste un chantier distinct : ne pas supposer qu'elle
est close uniquement à partir des notes précédentes ; la retester sur le live
si l'utilisateur la remet dans le scope.

## Correctif Safari Storage ajouté ensuite

Le premier rollout ne suffisait pas sur un navigateur sans copie locale : le
bucket n'avait aucun CORS. Les 37 originaux et 37 aperçus étaient intacts et
répondaient 200, mais Safari refusait `fetch()` depuis App Hosting.

`storage.cors.json` est appliqué au bucket et l'en-tête CORS exact a été vérifié
sur `IMG_0421.JPG`. Le client lit désormais par chemin Firebase Storage
authentifié avant l'URL tokenisée. Le carrousel retente l'original si l'aperçu
échoue et démonte l'image après deux échecs, donc plus d'icône « ? ».

Gates locales : bibliothèque 36/36, navigateur 1/1 avec aperçu 404 volontaire,
lint sans erreur, build Node 22 vert. Le front de ce second correctif doit être
déployé puis retesté dans Safari après rechargement.
