# Prompt de reprise — grilles éditoriales du Layout (2026-09-01)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`
Node : **22** (`nvm use 22` — sous Node 26, `better-sqlite3` casse le build).

## Ordre de lecture

1. `AGENTS.md` (règles, économie de contexte, discipline de déploiement).
2. `docs/developpement-local-et-couts.md`.
3. Ce fichier.
4. `map.md` : journal du 2026-09-01 « grilles editoriales du Layout » + bloc
   `src/features/vibeos/layout/` de l'arborescence (**par extraits**, jamais en
   entier).

Ne PAS ouvrir les archives ni les autres prompts de reprise.

## État livré

- `src/features/vibeos/layout/gridLibrary.js` : 24 grilles éditoriales écrites
  comme un arbre `rows`/`cols` compilé en zones normalisées. Chaque grille a
  deux variantes (`portrait` 4:5 et `square` 1:1) de **même longueur** et même
  ordre de lecture ; `void: true` = vide assumé (marge, bandeau de titre).
- `gridCatalog.js` : liste unique (24 grilles + 3 historiques en
  « Classiques ») partagée par le panneau et la bibliothèque.
- `GridCategoryMenu.jsx` : dans le panneau, le nom de la grille est un menu de
  familles ; le panneau affiche toute la famille choisie. La famille est
  **dérivée au rendu** (`browsedCategory` attaché au `presetId` actif), jamais
  posée dans un effet — le lint interdit `setState` dans un effet.
- `GridLibrarySheet.jsx` : bibliothèque (6 familles + recherche), chaque carte
  montre la grille en 4:5 ET en 1:1.
- `useLayoutEditor.js` : `applyGridPreset`, `transformGrid` (miroir H, miroir V,
  rotation des photos) et re-compilation de la grille au changement de format.
  Une grille déplacée à la main est marquée `customLayout.dirty` et n'est plus
  recompilée. `transform` et `dirty` sont persistés (`layoutPersistence.js`).
- `InstagramPublicationPreview.jsx` : la hauteur du média suit le vrai ratio du
  post, borné 4:5 ↔ 1,91:1 comme Instagram (402 px en 1:1, 503 px en 4:5).
- **Une photo par case** : `renderSlot` ne boucle plus sur les images
  (`imgIndex % images.length`), `image: null` dans `slotConfigs` = case vidée à
  la main (persistée via `slots[].imageCleared`), et l'import global remplit les
  cases vides dans l'ordre de lecture (`importImagesIntoSlots`).
- **Fond et marges** : `useLayoutState` démarre sur un fond blanc uni
  (`layoutBgBlur: false`) et sur `padding = gap = customLayoutGap = 24`. Le
  mode « Marges égales » (`linkedMargins`, actif par défaut, persisté dans
  `geometry`) pilote les trois ensemble ; « Libres » sépare marge extérieure et
  écart entre les images. L'aperçu est à angles droits (`.canvas`,
  `.compareOverlay` : `border-radius: 0`).
- **Cadrage par case** : `zoomSlot` / `panSlot` / `resetSlotFraming` dans
  `useLayoutEditor` écrivent `zoom` (borné [1,4]), `x`, `y` (en % de la case)
  dans `slotConfigs` — les mêmes champs que lit le moteur. Seule la case
  sélectionnée capte la souris dans `SlotOverlay`, sinon le canvas perdrait la
  sélection, les textes et les stickers.
- `SlotOverlay.jsx` + `SlotImportSheet.jsx` : « Importer » au survol d'une case
  vide (appareil ou bibliothèque VibeOS) et glisser-déposer d'une case à
  l'autre. La couche doit rester `pointer-events: none` sauf ses commandes,
  sinon elle vole les clics du canvas et de la barre d'outils de l'aperçu.
  Sa géométrie vient du moteur (`setSlotRectsState` publie
  `{ rects, width, height }` pour l'aperçu uniquement).

## Gates joués

- `npm run lint` : 0 erreur.
- `npm run build` (Node 22) : vert.
- `node scripts/smoke-vibeos-layout-grids.mjs` : géométrie des 48 variantes.
- `scripts/smoke-vibeos-layout-slots.spec.cjs` : une photo par case, import
  ciblé, échange au glisser-déposer.
- Playwright, contre un vrai `npm run dev` :
  `SMOKE_BASE_URL=http://localhost:3000 npx playwright test scripts/smoke-vibeos-layout-grids.spec.cjs scripts/smoke-vibeos-layout-b1.spec.cjs scripts/smoke-vibeos-layout-b3.spec.cjs scripts/smoke-vibeos-layout-instagram-preview.spec.cjs --workers=1`
  → 4/4. **`--workers=1` est nécessaire** : en parallèle, les quatre specs
  échouent (elles se marchent dessus sur le même dev server), défaut
  préexistant déjà noté dans `todo.md`.

## Piège connu (préexistant, à corriger un jour)

`scripts/run-video-ui-test.mjs` démarre son propre `next dev` avec toutes les
variables `NEXT_PUBLIC_FIREBASE_*` **vides**. Sur ce serveur, la page n'hydrate
pas du tout (`window.__next_f` reste vide, aucun clic React ne répond, y compris
sur `/`) : le bouton « Contourner l'authentification » ne fait donc rien et tous
les smokes VibeOS échouent avant l'écran. Contre un `npm run dev` normal (avec
`.env.local`), tout passe. Tant que ce n'est pas réparé, jouer les specs Layout
avec `SMOKE_BASE_URL` pointé sur le dev server du projet.

## Mission suivante possible

1. Réparer le serveur du runner de smokes (cause ci-dessus) pour rendre
   `npm run test:vibeos-layout` utilisable tel quel.
2. Grilles : rendre le nombre de zones ajustable sur une grille de la
   bibliothèque (ajouter/retirer une rangée) sans repasser en mode manuel.
3. Archiver `todo.md` : il dépasse largement les ~200 lignes prescrites.

## Interdits

- Pas de déploiement sans demande explicite.
- Ne jamais supprimer un preset de `docs/presets-valides.md`.
- Ne pas toucher au projet source `jardin de chawi`.
