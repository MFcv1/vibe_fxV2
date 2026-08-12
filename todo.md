# TODO — Vibe_fx V2

> **Point d'étape : 2026-08-12.**
>
> Ce fichier ne porte QUE le chantier **actif**. Il est court **exprès** : un
> agent le relit à chaque session. Le détail de ce qui est clos vit dans les
> archives et dans les journaux datés de `map.md`.

**À lire avant de coder, dans cet ordre :**

1. [AGENTS.md](AGENTS.md) — règles de travail, rituel de fin de phase.
2. Ce fichier.
3. [docs/presets-valides.md](docs/presets-valides.md) — **si tu touches aux
   presets** : ceux qui ne se suppriment jamais, et ce qu'un preset doit passer
   pour y entrer.
4. [docs/lightroom/](docs/lightroom/) — **si tu importes un preset** : la
   procédure clic par clic, la méthode et ses pièges, le corpus de `powlisher`.
5. [map.md](map.md) — arbre du projet. Ses journaux datés : **ne lis que la
   zone que tu touches**.

Archives, à ouvrir **seulement** si on travaille dans la zone concernée :
[VibeOS](docs/archive-vibeos-2026-08-11.md) ·
[VibeCut](docs/archive-vibecut-2026-08-04.md) ·
[presets, lots H/I/J](docs/archive-presets-vision-2026-08-12.md).

---

## Ce qui est fait

Le **redesign VibeOS** est livré : création sous `/creer`, publication sous
`/publier`, vidéo sous `/video`.

**La colorimétrie de Vision** tourne sur un moteur de LUT 3D 33³
([lut3d.js](src/features/vibefx-studio/utils/lut3d.js)), plus une chaîne d'import
qui capture un preset Lightroom **exactement**, par Hald CLUT.

### Les cinq presets

| Preset | Ce qu'il est | Effets non-LUT |
|---|---|---|
| `powlisher` | le look de `@powl_d`, reconstruit par mesure sur 19 photos | — |
| `powlisher-ciel` | le ciel **converge** vers sa teinte (190–199°) au lieu d'être tourné d'un angle fixe | — |
| `powlisher-showcase` | clair-obscur : le décor est vidé de sa couleur, le sujet reste seul coloré | grain 20, vignetage 22, relief 14 |
| `cn11`, `cn17` | captures **exactes** de Lightroom (pack Adobe « Cinéma II ») | — |

**Tous les cinq sont dans [docs/presets-valides.md](docs/presets-valides.md) :
ils ne se suppriment pas et ne se remplacent pas.** Un nouveau variant s'ajoute à
côté.

Trois presets ont été **supprimés** le 2026-08-12 (`powlisher-ville`,
`powlisher-v2`, `powlisher-v2-dore`) : source biaisée et trait de contour visible
dans le ciel. Les leçons sont dans « Pièges connus ».

### Ce qu'un preset peut porter en plus de sa couleur

`spatialFilters` : grain, vignetage, relief, netteté, voile. Ils dépendent des
pixels voisins ou de la position, donc **aucune table de couleurs ne les
contient**. Le panneau les affiche **en couleur d'accent**, les remonte en tête
dans « Modifiés », et le preset annonce ce qu'il pose.

### L'interface des réglages (corrigée le 2026-08-12)

Bornes lues depuis le moteur (avant, un tiers de la course ne faisait rien) ·
réglages au repos **alignés** · les modifiés et ceux qu'un preset pilote
remontent dans **« Modifiés »** · aperçu en **résolution / 2** pendant le geste ·
**grain réparé** (il plafonnait à 0,9/255, invisible ; 20 donne 1,05, 42 donne
2,84). Le détail est dans le journal de [map.md](map.md).

---

## Ce qui reste

### Lot suivant — importer d'autres presets Lightroom

Objectif : élargir la bibliothèque avec les familles **paysage, architecture
urbaine, voyage, cinéma, film**, par la méthode Hald CLUT déjà validée.

**Le point à ne pas rater, et il est nouveau :** un preset Lightroom n'est pas
que de la couleur. Constaté sur « Cinéma II » — **CN11 n'a aucun effet, CN17 pose
un Grain 15**, la Netteté reste à 40 sur les deux. D'autres familles bougent la
texture, la clarté ou le noir et blanc.

**Donc, à chaque import :** relever les panneaux **Effets** et **Détail** de
Lightroom AVANT d'exporter la mire, remettre le grain à 0 pour que la table soit
propre, puis redéclarer les valeurs dans `spatialFilters`. La procédure et le
tableau des réglages à relever sont dans
[docs/lightroom/1-procedure.md](docs/lightroom/1-procedure.md), étape 1 bis.

> **Lightroom n'est pas pilotable** : l'agent ne peut pas lire ces valeurs. Il
> doit **les demander** — c'est une étape du protocole, à rappeler à chaque
> import.

### Reste ouvert

1. **Brancher la Netteté 40** que Lightroom applique par défaut
   (`filters.sharpness`) — dernier écart mesurable avec Lightroom.
2. **Trancher la licence** : CN11 et CN17 sont dans le bundle sous leurs noms
   Adobe. À régler avant toute mise en ligne.
3. **Construire nos propres looks**, calibrés sur CN11 qui est une référence
   exacte.

**Hors chantier** — du choix produit, pas de la dette cachée : rail agents IA et
bibliothèque Midjourney (partis avec l'ancienne UI, routes et ledger intacts,
cf. `src/config/aiLaunch.js`) ; synchro Google Drive de la photothèque (demandée,
pas faite — la bibliothèque est locale en IndexedDB) ; couverture émulateurs du
parcours publication, à réécrire sur `/publier`.

---

## Pièges connus — ne pas les réintroduire

**Presets et couleur**

- **Une règle qui dépend de la teinte doit s'éteindre quand le pixel n'a plus de
  teinte.** Dans un voile quasi blanc, la teinte est du bruit : deux pixels
  identiques à l'œil peuvent être à 40° l'un de l'autre. Une règle qui s'y fie
  trace un **trait de contour** — invisible dans les moyennes, évident à
  l'écran. Le test « amplification dans un voile » le garde.
- **Juger un preset à l'œil, sur une vraie photo, avant de le livrer.** Les trois
  presets supprimés passaient toutes leurs mesures ; le ciel kaki du showcase
  s'est vu à l'écran, pas dans les chiffres.
- **Photos de test : Unsplash**, parce qu'elles sont **peu retouchées**. Celles
  d'un corpus de référence sont déjà des édits finis : les repasser dans un
  preset étale deux fois le même traitement. Elles restent **hors du dépôt**
  (`~/Desktop/devimage/`). `node scripts/planche-presets.mjs <photo...>`.
- **Ne jamais se caler sur une source dont on ignore ce qu'elle mesure.** La
  « paire avant/après » du photographe est passée par une IA générative :
  écartée. Le corpus seul induit en erreur par **biais de sélection**.
- **Deux saturations, ne pas les confondre.** Le mélangeur travaille en HSL, où
  un ciel pâle ressort à 0,36 quand l'œil voit du blanc cassé. Les cibles du
  corpus sont en **chroma `(max−min)/max`**.
- **Ordre dans un preset écrit à la main** : le virage split vient **après** le
  mélangeur de teintes (ordre réel de Lightroom).
- **Le bruit s'ajoute en quadrature.** Pour mesurer un grain, extraire son
  écart-type (`√((total² − base²)/2)`) au lieu de lire la différence brute.

**Import Lightroom** — le détail est dans
[1-procedure.md](docs/lightroom/1-procedure.md) et
[2-methode-et-pieges.md](docs/lightroom/2-methode-et-pieges.md). L'essentiel :
mire en **blocs**, export **sRVB**, `.rotate()` avant toute comparaison, **grain
à 0 avant de capturer** (il pourrit la table), **masques non capturables** — si
le panneau Masquage n'est pas vide, la capture est fausse sans le signaler. Et
chaque preset importé pèse ~144 ko : au-delà d'une dizaine, chargement paresseux.

**Interface et pipeline**

- **`resolveProjectSource`** : la composition du Layout est **prioritaire** sur
  la photo du projet. Tout écran qui laisse changer de photo doit effacer
  `project.composition`.
- **`applyVisionStage`** ([pipeline.js](src/features/vibeos/project/pipeline.js))
  : un preset peut ne modifier **aucune** clé de `filters`. Tester
  `vision.presetId` **séparément**, sinon l'étage Vision est jugé « neutre » et
  sauté.
- **Bornes des réglages : une seule source**, côté moteur. L'interface les lit,
  elle ne les redéclare jamais.
- **Un curseur recentré ne convertit JAMAIS position ↔ valeur** : l'arrondi crée
  une **zone morte** et le curseur se bloque. On élargit la course
  symétriquement et on borne la valeur à la sortie.
- **La qualité `low` saute relief, netteté, voile et grain.** Dans Vision, le
  geste porte justement sur ces réglages : y passer en `low` les rend sans effet
  visible. Vision garde `high`.
- **Jamais** recalculer une vignette depuis l'image pleine résolution.

---

## Règles non négociables

- **Jamais supprimer ni remplacer un preset** de `docs/presets-valides.md`.
- **Jamais de Tailwind** dans le nouveau code : CSS Modules + tokens `--vo-*`.
- **Jamais réécrire un moteur existant** : on l'importe, ou on l'**extrait**.
- **IndexedDB** : des Blobs, jamais de dataURL.
- **Desktop ET mobile** sérieux. Textes UI en français simple.
- **Aucun déploiement** sans demande explicite : tout se vérifie en local.
- **Fin de tranche** : gates ci-dessous, mise à jour de ce fichier (qui doit
  **rester court**) et de `map.md`, rapport honnête — puis, dans le chat, le
  récap en langage simple **et** le prompt de reprise complet.

---

## Gates

```bash
npm run dev                    # http://localhost:3000 -> /creer
npm run lint                   # 0 erreur (5 warnings préexistants)
npm run build
npm run test:scope
npm run test:vision-preset     # 67 vérifications (Node, 1 s)
npm run test:vision-filters
npm run test:vibeos-vision     # rejoue test:vision-preset, puis le navigateur
npm run test:vibeos-pipeline   # composition -> Vision -> Studio -> publication
npm run test:vibeos-library / -layout / -studio / -soundtrack   # si tu y touches
npm run test:routes            # si tu touches aux routes (build + start)
```

Outils des presets :

```bash
npm run preset:mire / preset:controle / preset:import          # capturer un preset Lightroom
node scripts/planche-presets.mjs <photo...>                    # LA PLANCHE À REGARDER
node scripts/mesure-ciel-powlisher.mjs [--photo <f>]           # où le ciel atterrit
node scripts/audit-vision-presets.mjs                          # bandes, dominante, témoins
node scripts/compare-vision-presets-on-photos.mjs <photo...>   # écrêtage et force
node scripts/compare-preset-vs-lightroom.mjs <src> <lr> <id>   # fidélité réelle
```

Tous verts au 2026-08-12.

**Échecs préexistants, hors chantier** : `smoke-vibecut-media-safety.spec.cjs`
(3) et `test:vibecut-export-local-mp4` — fixtures manquantes, chemins Windows
d'origine, pointeurs Git LFS ([archive](docs/archive-vibecut-2026-08-04.md#commandes)).
