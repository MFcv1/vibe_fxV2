# Prompt de reprise — 2026-08-29 ter (après `powV2`)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2` (macOS, branche
`presets-mesures-sur-corpus`).

## À lire, dans cet ordre

1. `AGENTS.md` — règles de travail, économie de contexte, rituel de fin de phase.
2. `todo.md` — court exprès, il ne porte que le chantier actif.
3. `docs/presets-valides.md` — **si tu touches aux presets**. Un preset qui y
   figure ne se supprime pas et ne se remplace pas ; un variant s'ajoute à côté.
4. `docs/pieges-connus.md` — avant de toucher à la couleur ou au rendu.
5. `docs/paires-avant-apres-powlisher-2026-08-29.md` — la source et les chiffres
   de `powlishermain`.
6. `map.md` — **n'en lis que la zone que tu touches** (`grep -n`, `sed -n`).

**À NE PAS ouvrir** sauf si tu travailles exactement dedans : `docs/archive-*`,
les autres `docs/prompt-reprise-*`, `node_modules/`, `.next/`.

## Où en est le livre

22 presets Vision. Les deux derniers, **`powlishermain`** et **`powV2`**, sont
les premiers du projet calés sur des avant/après **certains** : trois captures de
l'écran Lightroom de `@powl_d` (posts `1988715650794287456`,
`1988715687783919978`, `1988715756461179091`, du 12 novembre 2025), la même photo
avant et après. 43 691 blocs de 8×8 mesurés.

**La couleur, commune aux deux** : ombres vert-cyan, bas-tons orange, crème du
milieu au blanc, verts qui perdent la moitié de leur chroma, jaunes un cinquième,
rouges rien (le « coup de saturation sur les rouges » était le virage), et un
ciel qui **converge** vers 192° TSL — la fenêtre déjà trouvée en 2026-08-12 par
une méthode sans rapport. Rien entre 135 et 250° Lab ni au-delà de 308° : les
trois photos y sont muettes, le mélangeur y est à l'identité.

**La différence entre les deux, c'est la LUMIÈRE :**

- **`powlishermain`** n'y touche pas. Ses trois retouches ne diffèrent que par un
  gain (−1,85 / −0,22 / −0,56 EV), donc un curseur d'exposition, pas un preset.
- **`powV2`** ajoute la meilleure courbe commune aux trois. Le refus de
  `powlishermain` était juste sur le papier et faux à l'écran : appliqué à ses
  AVANT, le rendu restait plus clair et plus plat que son APRÈS.

**La leçon du lot, à ne pas perdre** : un écart mesuré à **exposition libre** ne
dit rien de ce que l'utilisateur voit. Il faut les deux chiffres, et
`scripts/verifier-presets-sur-paires.mjs` sort désormais les deux tableaux.

Deux courbes **meilleures en chiffres ont été refusées** : 21 nœuds libres (3,21
de dE76) part en zigzag et surapprend sur trois photos ; la droite libre (3,84)
efface le volant d'une des photos. La retenue fait 4,51 et ne détruit rien.

**Les deux attendent le regard du porteur du projet.** Tant qu'ils ne l'ont pas
eu, ils n'entrent pas dans `docs/presets-valides.md`.

## État des gates

- `npm run lint` : vert (5 warnings préexistants, sans rapport).
- `npm run test:vision-preset` : **231/231**, dont 17 pour `powlishermain` et 17
  pour `powV2`.
- `npm run build` : **échec PRÉEXISTANT et sans rapport** — `better-sqlite3` est
  compilé pour `NODE_MODULE_VERSION 127` alors que le Node installé en demande
  147. La compilation Next elle-même passe (« Compiled successfully ») ; ça
  casse à la collecte de `/api/catalog/[jobId]`. `npm rebuild better-sqlite3`
  devrait le régler, ça n'a pas été fait ici (ça touche `node_modules/`).

## Mission suivante, dans l'ordre

1. **Faire regarder les presets qui attendent** (`couchant`, `powlishermain`, et
   les six du 2026-08-27). C'est la seule étape que les mesures ne remplacent
   pas — trois presets supprimés le 2026-08-12 passaient toutes leurs mesures.
2. **L'étage de tonalité adaptatif.** C'est le vrai gros reste, et `powV2` vient
   d'en montrer la limite en dur : sa paire de nuit reste à 8,52 de dE76 parce
   que l'édit de nuit est 1,3 EV plus bas que ce qu'une courbe commune peut
   rendre. Le lot du 2026-08-29 bis en a fourni la preuve directe : il suit la densité de
   la scène à la main, pas avec une courbe. Une LUT 3D n'a pas de mémoire ; il
   faut un étage AVANT elle, dans `studioRenderer.js`, qui mesure l'histogramme
   et ramène la photo sur l'exposition de référence du preset. À trancher : où
   il vit, comment il se désactive, comment le figer dans un smoke.
3. **`todo.md` dépasse ~258 lignes** alors que la règle du projet est ~200.
   Archiver avant d'ajouter le lot suivant.

## Interdits

- Ne jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Ne pas déployer sans demande explicite (ça coûte de l'argent réel).
- Ne pas lancer de sous-agent sans demande explicite.
- Ne pas juger un preset sur des photos d'un corpus de référence : ce sont déjà
  des édits finis. Unsplash, ou `~/Desktop/devimage/`.
- Ne pas mesurer une paire avant/après au pixel : blocs de 8×8, plats des deux
  côtés.
- Ne pas ajuster une courbe à 21 nœuds libres sur trois photos, et ne pas
  accepter un meilleur chiffre payé par de la matière détruite.

## Rituel de fin de phase

`npm run lint`, les suites touchées, puis `todo.md`, `plan.md`, `map.md`
(arborescence + journal daté), et un fichier `docs/prompt-reprise-<date>.md`.
Le récap du chat est en langage simple : ce qui marche et se teste tout de
suite, ce qui a été laissé de côté et pourquoi, les bugs trouvés en route, les
échecs de tests préexistants.
