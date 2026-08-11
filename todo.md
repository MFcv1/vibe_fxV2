# TODO — Vibe_fx V2

> **Dernière mise à jour : 2026-08-11.**
>
> Ce fichier ne porte QUE le chantier **actif** : les **presets de Vision**.
> Il est court **exprès** — un agent le relit à chaque session, tout ce qui
> traîne ici coûte du contexte à chaque fois.
>
> Tout ce qui est livré et clos vit dans des archives, à ouvrir **seulement**
> si on touche à la zone concernée :
> - [docs/archive-vibeos-2026-08-11.md](docs/archive-vibeos-2026-08-11.md) —
>   redesign VibeOS, phases A à G.
> - [docs/archive-vibecut-2026-08-04.md](docs/archive-vibecut-2026-08-04.md) —
>   reconstruction VibeCut (`/video`, `render-service/`).

**À lire avant de coder, dans cet ordre :**

1. [AGENTS.md](AGENTS.md) — règles de travail, rituel de fin de phase.
2. Ce fichier.
3. [docs/lightroom/](docs/lightroom/) — **tout ce qui concerne l'import d'un
   preset Lightroom** : la procédure clic par clic, la méthode et ses pièges, les
   mesures de CN11/CN17. Commencer par son `README.md`.
4. [docs/audit-preset-powlisher-2026-08-11.md](docs/audit-preset-powlisher-2026-08-11.md)
   — si tu touches à `powlisher`.
5. [map.md](map.md) — arbre du projet. Ses journaux datés : **ne lis que la
   zone que tu touches**, pas le fichier entier.

---

## Où on en est

Le redesign VibeOS est **livré** (phases A→G, archivées). Toute la création vit
sous `/creer`, la publication sous `/publier`, la vidéo sous `/video`.

Le chantier actif, c'est **la colorimétrie de Vision** :

| Lot | Contenu | État |
|---|---|---|
| H — Presets | 12 « looks » et bibliothèque par marque supprimés ; moteur LUT 3D + preset `powlisher` reconstruit par mesure | ✅ 2026-08-11 |
| I — Import Lightroom | capture exacte d'un preset externe par Hald CLUT + lecture du `.xmp` | ✅ 2026-08-11 |
| J — Capture réelle CN11 / CN17 | chaîne validée sur un vrai Lightroom cloud, contrôle + 2 presets + verdict | ✅ 2026-08-11 |
| **K — Presets maison** | **construire nos propres looks en se calibrant sur CN11** | **← à faire** |

### Lot H — pourquoi les looks ont sauté

Ils dénaturaient les photos, et ils étaient lents : chaque changement de photo
relançait 12 vignettes, chacune repartant de l'image **pleine résolution** avec
4 passes pixel et un encodage JPEG.

À la place, des presets compilés en **LUT 3D** :

- [lut3d.js](src/features/vibefx-studio/utils/lut3d.js) — une fonction de preset
  est évaluée **une fois** sur une grille 33³, puis appliquée en **une passe**.
  Coût de rendu **constant** : ajouter un preset ne coûte rien.
- [visionPresets.js](src/features/vibefx-studio/utils/visionPresets.js) — les
  presets. Deux formes possibles, indiscernables au rendu : `transform` (fonction
  pure écrite à la main) ou `getLut` (table importée de Lightroom).
- [presetPreview.js](src/features/vibeos/vision/presetPreview.js) — la photo est
  réduite **une seule fois** dans un canvas partagé.

Un seul preset existe : `powlisher`, reconstruit **par mesure** sur 19 photos
(ciel tiré vers le teal 178–194°, verts olive, peau préservée, hautes lumières
crème, noirs denses). Chiffres et réserves dans
[l'audit](docs/audit-preset-powlisher-2026-08-11.md).

### Lot I — capturer un preset externe sans approximer

Recopier les curseurs d'un `.xmp` donnerait un rendu **différent** : Lightroom
travaille sur du RAW linéaire, nous sur du JPEG 8 bits déjà développé. Donc on
ne recopie pas — on fait faire le calcul à Lightroom et on lit le résultat, via
une **Hald CLUT**. Aller-retour vérifié en simulation : **0,24/255 d'écart
moyen**. Mode d'emploi complet :
[docs/lightroom/2-methode-et-pieges.md](docs/lightroom/2-methode-et-pieges.md).

### Lot J — la chaîne a tourné sur un vrai Lightroom

CN11 et CN17 capturés et importés. Fidélité de CN11 sur une vraie photo :
**0,64/255 sur la couleur**, 2,67/255 au pixel (médiane 1). Contrôle à vide
0,018/255.

Quatre choses apprises, toutes documentées et toutes codées :

- **La mire doit être en BLOCS de 4×4 pixels.** Avec une couleur par pixel, les
  couleurs bavent les unes sur les autres — invisible dans les clairs, ruineux
  dans les noirs, qui viraient au **vert** de façon visible sur les photos.
  Corrigé : `preset:mire` génère du 2048×2048 par défaut, l'import lit le cœur
  de chaque carré. Écart aux noirs : 8,06 → **1,32/255**.
- L'export Lightroom part en **Adobe RVB**. Il FAUT **sRVB**, sinon la table est
  fausse d'un bout à l'autre sans que rien ne le signale.
- Un preset avec du **grain** bruite quand même la table (CN17 : rugosité 4,70).
  `--lisser 1` la ramène à 0,69, et ne déplace une table déjà lisse que de 0,05.
- **Tout preset reste à `recommendedIntensity: 100`.** Baisser l'intensité ne
  réduit pas le contraste : ça mélange l'image traitée avec l'originale, ce qui
  délave les couleurs et éloigne de la référence. Essayé sur CN11/CN17, mesuré,
  annulé. `powlisher` était à 85 sans justification : ça lui coûtait sa
  signature (ciel profond à 201° au lieu de 193,7°, donc hors de sa fourchette
  teal 178–196°). Remis à 100.

Procédure reproductible, chiffres, verdict, **question de licence** et le détail
des trois erreurs de mesure commises en route : [docs/lightroom/](docs/lightroom/).

### Lot K — la suite

1. **Brancher la Netteté 40** que Lightroom applique par défaut (`filters.sharpness`).
   C'est le dernier écart mesurable avec Lightroom, et le seul gain qui reste.
2. **Trancher la licence** avant toute mise en ligne : CN11 et CN17 sont dans le
   bundle sous leurs noms Adobe.
3. **Construire nos propres looks**, calibrés sur CN11 qui est maintenant une
   référence exacte.

---

## Pièges connus — ne pas les réintroduire

- **`resolveProjectSource`** : la composition du Layout est **prioritaire** sur
  la photo du projet. Tout écran qui laisse changer de photo doit effacer
  `project.composition`, sinon l'ancienne image revient au rechargement.
- **`applyVisionStage`** ([pipeline.js](src/features/vibeos/project/pipeline.js))
  : un preset ne modifie **aucune** clé de `filters`. Il faut tester
  `vision.presetId` **séparément**, sinon l'étage Vision est jugé « neutre » et
  sauté — le preset ne descend alors ni jusqu'au Studio ni jusqu'à l'export.
- **Ordre dans un preset écrit à la main** : le virage split vient **après** le
  mélangeur de teintes (ordre réel de Lightroom). Avant, le mélangeur le
  désature et l'écart visé retombe d'un quart.
- **Décalage de teinte** : toujours pondéré par la saturation
  (`smoothstep(0, 0.12, s)`). Un pixel quasi gris n'a pas de teinte définie ; le
  décaler crée des bandes visibles après interpolation de la LUT.
- **Jamais** recalculer une vignette depuis l'image pleine résolution.
- **Taille** : chaque preset importé pèse ~144 ko de base64. Au-delà d'une
  dizaine, passer à un chargement paresseux depuis `public/`.
- **Mire Hald** : toujours en **blocs** (4×4 par défaut). Une mire à un pixel par
  couleur donne une table fausse dans les noirs, sans aucun signe visible avant
  de regarder une photo.
- **Export Lightroom** : toujours **sRVB**, jamais Adobe RVB, et toujours
  vérifier la **rugosité** au retour d'import (grain → `--lisser 1`).
- **Ne jamais juger un preset sur son écrêtage seul** : il faut le comparer à
  celui de Lightroom sur la même photo. Sinon on « corrige » le look voulu.
- **EXIF** : une photo de téléphone est stockée en paysage avec une balise de
  rotation ; Lightroom l'écrit dans les pixels. Comparer sans `.rotate()` donne
  deux images de dimensions différentes.

---

## Reste à faire (hors chantier presets)

Rien de bloquant — du choix produit, pas de la dette cachée.

1. **Rail agents IA et bibliothèque Midjourney** — partis avec l'ancienne UI.
   Routes API et ledger intacts ; `src/config/aiLaunch.js` les marque « à
   porter ». À reposer dans `/creer` si on les veut.
2. **Synchronisation Google Drive de la photothèque** — demandée, **pas faite**.
   La bibliothèque est locale (IndexedDB), rien ne part sur un serveur. Demande
   un vrai OAuth Google + un aller-retour serveur : lot backend à part entière.
3. **Couverture émulateurs du parcours publication** — le smoke pilotait
   l'ancienne UI. `test:publication-flow` couvre encore la logique, plus le
   parcours navigateur. À réécrire sur `/publier` si on y tient.
4. **Corpus Vision réel** — `check:vision-corpus` est non bloquant et le corpus
   est absent. À faire **le jour où le corpus existe**, pas avant.

---

## Règles non négociables

- **Jamais de Tailwind** dans le nouveau code : CSS Modules + tokens `--vo-*`.
- **Jamais réécrire un moteur existant** : on l'importe. Si la logique utile est
  enfermée dans un composant, on l'**extrait**.
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
npm run test:vision-preset     # 40 vérifications : preset + chaîne d'import (Node, 1 s)
npm run preset:mire / preset:controle / preset:import          # capture d'un preset Lightroom
node scripts/audit-vision-presets.mjs                          # bandes, dominante, couleurs témoins
node scripts/compare-vision-presets-on-photos.mjs <photo...>   # écrêtage et force, sur de vraies photos
node scripts/compare-preset-vs-lightroom.mjs <src> <lr> <id>   # fidélité réelle à Lightroom
npm run test:vision-filters
npm run test:vibeos-vision     # rejoue test:vision-preset, puis le navigateur
npm run test:vibeos-pipeline   # composition -> Vision -> Studio -> publication
npm run test:vibeos-library / -layout / -studio / -soundtrack   # si tu y touches
npm run test:routes            # si tu touches aux routes (build + start)
```

Tous verts au 2026-08-11.

**Échecs préexistants, hors chantier** : `smoke-vibecut-media-safety.spec.cjs`
(3) et `test:vibecut-export-local-mp4` — fixtures manquantes, chemins Windows
d'origine, pointeurs Git LFS. Les suites `test:vibecut-*` ne concernent pas ce
chantier ([archive](docs/archive-vibecut-2026-08-04.md#commandes)).
