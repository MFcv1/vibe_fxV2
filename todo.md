# TODO — Vibe_fx V2

> **Point d'étape : 2026-08-16.**
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

Reprendre dans un chat neuf :
[prompt de reprise du 2026-08-16](docs/prompt-reprise-2026-08-16.md).

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
qui capture un preset Lightroom **exactement**, par Hald CLUT. Cinq presets :

| Preset | Ce qu'il est | Effets non-LUT |
|---|---|---|
| `powlisher` | le look de `@powl_d`, reconstruit par mesure sur 19 photos | — |
| `powlisher-ciel` | le ciel **converge** vers sa teinte (190–199°) au lieu d'être tourné d'un angle fixe | — |
| `powlisher-showcase` | clair-obscur : le décor est vidé, le sujet reste seul coloré | grain 8, vignetage 8, relief 14 |
| `cn11`, `cn17` | captures **exactes** de Lightroom (pack Adobe « Cinéma II ») | netteté 40 ; `cn17` : grain 15 |

**Les cinq sont dans [docs/presets-valides.md](docs/presets-valides.md) : ils ne
se suppriment pas et ne se remplacent pas** — un variant s'ajoute à côté. Trois
autres ont été **supprimés** le 2026-08-12 (source biaisée, trait de contour dans
le ciel).

Un preset peut porter des **`spatialFilters`** (grain, vignetage, relief,
texture, netteté, voile) : ils dépendent des pixels voisins ou de la position, donc
**aucune table de couleurs ne les contient**. Le panneau les affiche en couleur
d'accent et les remonte en tête dans « Modifiés ».

**L'interface des réglages** a été reprise le même jour : bornes lues depuis le
moteur, réglages au repos alignés, section « Modifiés » en tête, aperçu en
résolution / 2 pendant le geste, **grain réparé** (il plafonnait à 0,9/255).

> Détail chiffré : journaux datés de [map.md](map.md) et
> [l'archive](docs/archive-presets-vision-2026-08-12.md). Ce qui sert au
> quotidien est dans « Pièges connus » plus bas.

---

## Ce qui reste

### LOT ACTIF — finir de caler les réglages avancés sur Lightroom

**Il passe AVANT tout nouvel import.** Le protocole, les mesures et les
commandes : [docs/lightroom/4-synchro-effets.md](docs/lightroom/4-synchro-effets.md).
Mires : `npm run preset:mire-effets`. Les exports Lightroom sont faits **à la
main par Matthis** (dossiers prêts dans `~/Desktop/vibefx-lightroom/`) — l'agent
ne peut ni lire ses panneaux ni exporter à sa place.

| Réglage | État |
|---|---|
| **Grain** | **ALIGNÉ** — ×1,00 sur toute la plage tonale, à 15 / 50 / 100 |
| **Vignetage** | **ALIGNÉ** — 2,4/255. Multiplie en lumière **linéaire**, rayon **elliptique**, dosage en **exposant**, protège les hautes lumières |
| **Netteté** | **ALIGNÉE** — échelle 0–150 comme la sienne, dosage saturant. Revérifiée **sur photo** : ×0,986 à 40 |
| **Clarté** | **ALIGNÉE** — le dosage collait déjà ; le **rayon** était 4× trop petit |
| **Texture** | **ALIGNÉE côté positif** — ×1,176/1,120/1,096 contre ses ×1,175/1,120/1,096. **Négatif non implémenté** : ses 2 exports manquent |
| Voile | mesuré, **pas capturable par une mire** : Lightroom l'estime depuis le contenu de l'image |

**Fait le 2026-08-16 — le lot est débloqué, on peut réimporter :**

1. `powlisher-showcase` **revalidé à l'œil** (`planche-showcase.mjs`, quatre
   photos, vrai moteur) : grain 8 et relief 14 gardés, **vignetage 3 → 8**.
2. `cn17` **validé sur une vraie photo** développée des deux côtés :
   **1,73/255** d'écart moyen, « identique à l'œil ».
3. Cette planche a révélé une **Netteté 40** que Lightroom pose sur toute photo
   et que nos presets n'avaient pas — nous rendions 1,40× plus mou. `cn11` et
   `cn17` la portent désormais.
4. **Texture branchée** dans le moteur, calée sur ses mesures.

**Ce qui reste sur ce lot :**

1. **Texture négative** : les 2 exports (−50, −100) manquent encore — ceux qui
   sont là sont le positif exporté deux fois, revérifié. L'import **refuse** un
   `--texture` négatif tant que ce n'est pas mesuré.
2. **Voile** : ne pas le mesurer sur mire. Cas à part, sur photo réelle.
3. **Grain Taille 40** : CN17 la met à 40, tout est calibré pour 25. À mesurer
   si l'aspect du grain d'un preset importé ne colle pas.

**Pas bloquant pour importer** : les **sous-réglages** (Grain Taille 25 /
Cassure 50, Vignette Milieu 50 / Arrondi 0 / Contour 50 / Hautes lumières 0)
sont relevés mais non branchés. Tout est calibré **pour ces défauts**. Décision
prise : on ne les branche que si un preset à importer les change vraiment — donc
**les vérifier au relevé, à chaque import**.

**Ce que ces quatre calages ont appris, et qui vaut pour les suivants :**

- **Ne jamais mesurer un effet spatial sur la mire Hald.** Ses pastilles de 4×4 px
  font baver les voisins : c'est ce qui avait produit le faux « ×8 » du grain
  (le vrai écart était ×2,66).
- **Chercher la loi, pas un coefficient.** Les quatre fois, le facteur d'échelle
  n'était pas le vrai problème : cloche contre plat, sRVB contre linéaire, rayon
  4× trop petit, linéaire contre saturant.
- **Une mire peut mentir sur elle-même.** Le bord doux de la mire C est cerné par
  ses zones voisines : au-delà d'un certain rayon de flou, la mesure lit ses
  propres bords.
- **Toute valeur déjà écrite est à convertir** quand une échelle bouge —
  presets, ambiances et `constants.jsx` compris.

### Puis — importer d'autres presets Lightroom

Familles **paysage** (LN01–LN08), **architecture urbaine** (UA01–UA04),
**voyage, cinéma, film**, par la méthode Hald CLUT
([1-procedure.md](docs/lightroom/1-procedure.md)).

**Un preset Lightroom n'est pas que de la couleur.** À chaque import : relever
les panneaux **Effets** et **Détail** (l'agent doit les **demander**), remettre
le grain à 0 avant d'exporter la mire, puis passer les valeurs relevées à
l'import — `--grain`, `--vignette`, `--clarity`, `--texture`, `--sharpness`,
`--dehaze`. **Le
nombre se recopie tel quel** : nos échelles sont les siennes.

**Déjà capturé, à ne pas relever** : tout ce qui dépend de la seule couleur du
pixel — exposition, contraste, hautes lumières, ombres, blancs, noirs, courbe,
TSL, étalonnage, virage, N&B, et le **profil**.

**⚠️ Deux pièges qui rendent un preset non capturable**, sans que rien ne le
signale : un réglage **« Auto »** non nul (calculé depuis la photo — le tester
sur deux images très différentes), et un panneau **Masquage** non vide.

### Reste ouvert

1. **Trancher la licence** : CN11 et CN17 sont dans le bundle sous leurs noms
   Adobe. À régler avant toute mise en ligne.
2. **Construire nos propres looks**, calibrés sur CN11 qui est une référence
   exacte.

**Hors chantier** — du choix produit, pas de la dette cachée : rail agents IA et
bibliothèque Midjourney (routes et ledger intacts, cf. `src/config/aiLaunch.js`) ;
synchro Google Drive de la photothèque (la bibliothèque est locale en IndexedDB) ;
couverture émulateurs du parcours publication, à réécrire sur `/publier`.

---

## Pièges connus — ne pas les réintroduire

**Presets et couleur**

- **Une règle qui dépend de la teinte doit s'éteindre quand le pixel n'a plus de
  teinte.** Dans un voile quasi blanc, la teinte est du bruit : une règle qui s'y
  fie trace un **trait de contour**, invisible dans les moyennes et évident à
  l'écran. Le test « amplification dans un voile » le garde.
- **Juger un preset à l'œil, sur une vraie photo, avant de le livrer.** Les trois
  presets supprimés passaient toutes leurs mesures ; le ciel kaki du showcase
  s'est vu à l'écran, pas dans les chiffres.
- **Photos de test : Unsplash**, parce qu'elles sont **peu retouchées**. Celles
  d'un corpus de référence sont déjà des édits finis : les repasser dans un
  preset étale deux fois le même traitement. Hors du dépôt
  (`~/Desktop/devimage/`). `node scripts/planche-presets.mjs <photo...>` pour la
  couleur, `node scripts/planche-showcase.mjs` pour les effets (grain, vignetage,
  relief) — le premier ne montre que la LUT.
- **Ne jamais se caler sur une source dont on ignore ce qu'elle mesure** (la
  « paire avant/après » est passée par une IA : écartée), et se méfier du **biais
  de sélection** quand on mesure un corpus.
- **Deux saturations, ne pas les confondre.** Le mélangeur travaille en HSL, où
  un ciel pâle ressort à 0,36 quand l'œil voit du blanc cassé ; les cibles du
  corpus sont en **chroma `(max−min)/max`**.
- **Ordre dans un preset écrit à la main** : le virage split vient **après** le
  mélangeur de teintes (ordre réel de Lightroom).
- **Le bruit s'ajoute en quadrature.** Pour mesurer un grain, extraire son
  écart-type (`√((total² − base²)/2)`), pas la différence brute.

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
  `vision.presetId` **séparément**, sinon l'étage Vision est sauté.
- **Bornes des réglages : une seule source**, côté moteur. L'interface les lit,
  jamais l'inverse.
- **Un curseur recentré ne convertit JAMAIS position ↔ valeur** : l'arrondi crée
  une **zone morte** et le curseur se bloque. Course élargie symétriquement,
  valeur bornée à la sortie.
- **La qualité `low` saute relief, netteté, voile et grain.** Dans Vision le
  geste porte justement sur eux : Vision garde `high`.
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

# outils des presets
npm run preset:mire / preset:controle / preset:import          # capturer un preset Lightroom
node scripts/planche-presets.mjs <photo...>                    # planche : LUT seule
node scripts/planche-showcase.mjs                             # planche : EFFETS COMPRIS
node scripts/mesure-ciel-powlisher.mjs [--photo <f>]           # où le ciel atterrit
node scripts/audit-vision-presets.mjs                          # bandes, dominante, témoins
node scripts/compare-vision-presets-on-photos.mjs <photo...>   # écrêtage et force
node scripts/compare-preset-vs-lightroom.mjs <src> <lr> <id> [--planche <png>]
node scripts/rendu-mire-c.mjs --texture 50 --sortie <png>      # notre moteur sur la mire C
node scripts/mesure-mire-c.mjs --reference <a> --lightroom <b> # netteté / texture / clarté
```

Tous verts au 2026-08-16, `test:vibeos-vision` compris.

**Échecs préexistants, hors chantier** : `smoke-vibecut-media-safety.spec.cjs`
(3) et `test:vibecut-export-local-mp4` — fixtures manquantes, chemins Windows
d'origine, pointeurs Git LFS ([archive](docs/archive-vibecut-2026-08-04.md#commandes)).
