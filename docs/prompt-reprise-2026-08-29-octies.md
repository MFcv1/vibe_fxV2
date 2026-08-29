# Prompt de reprise — 2026-08-29 octies (après la série `powV2` … `powV7`)

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

27 presets Vision. Les sept derniers — **`powlishermain`**, **`powV2`**,
**`powV3`**, **`powV4`**, **`powV5`**, **`powV6`** et **`powV7`** — sont les premiers du projet calés sur des avant/après **certains** : trois captures de
l'écran Lightroom de `@powl_d` (posts `1988715650794287456`,
`1988715687783919978`, `1988715756461179091`, du 12 novembre 2025), la même photo
avant et après. 43 691 blocs de 8×8 mesurés.

**La couleur, commune aux deux** : ombres vert-cyan, bas-tons orange, crème du
milieu au blanc, verts qui perdent la moitié de leur chroma, jaunes un cinquième,
rouges rien (le « coup de saturation sur les rouges » était le virage), et un
ciel qui **converge** vers 192° TSL — la fenêtre déjà trouvée en 2026-08-12 par
une méthode sans rapport. Rien entre 135 et 250° Lab ni au-delà de 308° : les
trois photos y sont muettes, le mélangeur y est à l'identité.

**La série `powV2` → `powV6` va du plus général au plus spécifique** :
`powV2` (trois photos, le style), `powV3` (sa densité de nuit), `powV4` (la
couleur de nuit remesurée), `powV5` (le niveau de son image), `powV6` (plus le
dégradé du bas), `powV7` (plus le relevé des hautes lumières). Chacun bat le
précédent sur la photo de nuit et perd ailleurs : 8,52 → 7,39 → 7,09 → 2,92 →
2,48 → **2,42**. `powV2` reste la mesure de son STYLE ; le reste de la série
reproduit UNE image.

**Trois fois dans cette série, le meilleur chiffre a été refusé** — une courbe à
21 nœuds qui partait en zigzag, une droite qui effaçait le volant d'une photo, un
relevé de hautes lumières qui faisait échouer le test de contour. C'est la
culture du projet, et elle a eu raison chaque fois.

**La différence entre les deux premiers, c'est la LUMIÈRE :**

- **`powlishermain`** n'y touche pas. Ses trois retouches ne diffèrent que par un
  gain (−1,85 / −0,22 / −0,56 EV), donc un curseur d'exposition, pas un preset.
- **`powV2`** ajoute la meilleure courbe commune aux trois. Le refus de
  `powlishermain` était juste sur le papier et faux à l'écran : appliqué à ses
  AVANT, le rendu restait plus clair et plus plat que son APRÈS.

- **`powV3`** est la déclinaison NUIT de `powV2` : même couleur au chiffre près
  (vérifié dans le smoke à niveau de sortie égal, 0,24 en a\*b\*), seule la
  courbe bouge — la règle de la famille, déjà appliquée à `Ambre Nuit 1/2`.
- **`powV4`** va plus loin : il remesure la COULEUR sur la seule paire de nuit,
  une fois son masque retiré. Ses bas-tons y sont bien moins chauds (b\* +2,96
  contre +4,67) et son ciel plus sourd (chroma 0,61 contre 0,85). Sur la zone
  jugeable : 3,68 contre 4,19 et 4,68. **Une seule photo** : c'est `powV2` qui
  reste la mesure de son style.

**DEUX leçons du lot, à ne pas perdre.**

1. Un écart mesuré à **exposition libre** ne dit rien de ce que l'utilisateur
   voit. Il faut les deux chiffres, et `scripts/verifier-presets-sur-paires.mjs`
   sort désormais les deux tableaux.
2. Sur sa photo de nuit, l'essentiel de ce qui manque n'est **pas un preset**,
   c'est un **masque peint à la main** : au centre `powV2` est déjà juste
   (−0,03 diaphragme), en bas il est **quatre diaphragmes** plus sombre. Ses
   deux autres photos n'ont rien de tel (0,00 et 0,06 d'écart centre-bords),
   donc ce n'est pas son preset. Avant de fabriquer un preset de plus pour
   rattraper un écart, **regarder s'il est spatial**.

Deux courbes **meilleures en chiffres ont été refusées** : 21 nœuds libres (3,21
de dE76) part en zigzag et surapprend sur trois photos ; la droite libre (3,84)
efface le volant d'une des photos. La retenue fait 4,51 et ne détruit rien.

**Les deux attendent le regard du porteur du projet.** Tant qu'ils ne l'ont pas
eu, ils n'entrent pas dans `docs/presets-valides.md`.

## État des gates

- `npm run lint` : vert (5 warnings préexistants, sans rapport).
- `npm run test:vision-preset` : **284/284**, dont 17 pour `powlishermain`, 17
  pour `powV2`, 9 pour `powV3` et 13 pour `powV4` (y compris un contrôle de non-
  régression sur `powV3`, qui partage désormais la même fabrique).
- `npm run build` : **échec PRÉEXISTANT et sans rapport** — `better-sqlite3` est
  compilé pour `NODE_MODULE_VERSION 127` alors que le Node installé en demande
  147. La compilation Next elle-même passe (« Compiled successfully ») ; ça
  casse à la collecte de `/api/catalog/[jobId]`. `npm rebuild better-sqlite3`
  devrait le régler, ça n'a pas été fait ici (ça touche `node_modules/`).

## Mission suivante, dans l'ordre

1. **Faire regarder les presets qui attendent** (`couchant`, `powlishermain`, et
   les six du 2026-08-27). C'est la seule étape que les mesures ne remplacent
   pas — trois presets supprimés le 2026-08-12 passaient toutes leurs mesures.
2. **Le masquage local dans Vision** (sélection du sujet, dégradés orientables).
   Le **dégradé du bas** existe depuis le 2026-08-29 septies et couvre déjà le
   cas mesuré ; ce qui manque encore, c'est de pouvoir le POSER — orientation,
   position, et une sélection du sujet. C'est le geste qu'il a utilisé.
3. **L'étage de tonalité adaptatif.** C'est le vrai gros reste, et `powV2` vient
   d'en montrer la limite en dur : sa paire de nuit reste à 8,52 de dE76 parce
   que l'édit de nuit est 1,3 EV plus bas que ce qu'une courbe commune peut
   rendre. Le lot du 2026-08-29 bis en a fourni la preuve directe : il suit la densité de
   la scène à la main, pas avec une courbe. Une LUT 3D n'a pas de mémoire ; il
   faut un étage AVANT elle, dans `studioRenderer.js`, qui mesure l'histogramme
   et ramène la photo sur l'exposition de référence du preset. À trancher : où
   il vit, comment il se désactive, comment le figer dans un smoke.
4. **`todo.md` dépasse ~278 lignes** alors que la règle du projet est ~200.
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
- Ne pas fabriquer un preset pour rattraper un écart **spatial** : vérifier
  d'abord si l'écart dépend de la POSITION dans le cadre.
- Ne pas mesurer une couleur à travers un masque, ni dans une zone qu'on vient
  de rebrillanter de plusieurs diaphragmes.
- Une valeur attendue de test se **relève**, elle ne s'invente pas.

## Rituel de fin de phase

`npm run lint`, les suites touchées, puis `todo.md`, `plan.md`, `map.md`
(arborescence + journal daté), et un fichier `docs/prompt-reprise-<date>.md`.
Le récap du chat est en langage simple : ce qui marche et se teste tout de
suite, ce qui a été laissé de côté et pourquoi, les bugs trouvés en route, les
échecs de tests préexistants.
