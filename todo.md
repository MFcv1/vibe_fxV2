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
[**les presets mesures sur corpus** — prompt du 2026-08-25](docs/prompt-reprise-2026-08-25.md),
[le grain, apres l'espace de travail — 2026-08-22](docs/prompt-reprise-2026-08-22.md),
[la série d'imports Lightroom — 2026-08-20](docs/prompt-reprise-2026-08-20.md).

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
qui capture un preset Lightroom **exactement**, par Hald CLUT. Neuf presets :

| Preset | Ce qu'il est | Effets non-LUT |
|---|---|---|
| `powlisher` | le look de `@powl_d`, reconstruit par mesure sur 19 photos | — |
| `powlisher-ciel` | le ciel **converge** vers sa teinte (190–199°) au lieu d'être tourné d'un angle fixe | — |
| `powlisher-showcase` | clair-obscur : le décor est vidé, le sujet reste seul coloré | grain 8, vignetage 8, relief 14 |
| `cn11`, `cn17` | captures **exactes** de Lightroom (pack Adobe « Cinéma II ») | netteté 40 ; `cn17` : grain 15 |
| `cn01` | capture **exacte** (importée le 2026-08-20, validée sur 2 photos : 1,56 et 1,28/255) | — (tout à 0 dans Lightroom) |
| `cn13` | capture **exacte** (importée le 2026-08-20, validée sur 2 photos : 2,27 et 1,67/255) | netteté 40 |
| `cn14` | capture **exacte** (importée le 2026-08-20, validée sur 2 photos : 1,49 et 1,48/255 **par blocs**) | netteté 40, grain 25 grosseur 10 |
| `cn16` | capture **exacte** (importée le 2026-08-20, validée sur 2 photos : 2,25 et 1,31/255) | netteté 40 |

**Les neuf sont dans [docs/presets-valides.md](docs/presets-valides.md) : ils ne
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
| **Grain** | **Force 0,13 % sur 18 exports** Lightroom (810 → 9720 px, Tailles 0 → 100), grosseur 2,2 %, Cassure 0,11 %, couleurs 1,2 %. Le grain se calcule sur le **GRAND CÔTÉ**, pas la largeur (mesuré). Vraie photo de taille normale : **−4 %**. Au-delà de 9720 px on extrapole (+17 % sur une image de 150 Mpx) |
| **Vignetage** | **ALIGNÉ** — 2,4/255. Multiplie en lumière **linéaire**, rayon **elliptique**, dosage en **exposant**, protège les hautes lumières |
| **Netteté** | **ALIGNÉE** — échelle 0–150 comme la sienne, dosage saturant. Revérifiée **sur photo** : ×0,986 à 40 |
| **Clarté** | **ALIGNÉE** — le dosage collait déjà ; le **rayon** était 4× trop petit |
| **Texture** | **ALIGNÉE des deux côtés** (négatif fait le 2026-08-17) — même couple de rayons, dosage propre en `N^0,733`. Écart max 1,3 % |
| Voile | mesuré, **pas capturable par une mire** : Lightroom l'estime depuis le contenu de l'image |

**Ce qui est fait, en une ligne chacun** — le détail chiffré vit dans les
journaux datés de [map.md](map.md), pas ici :

1. `powlisher-showcase` **revalidé à l'œil** sur le vrai moteur : vignetage 3 → 8.
2. `cn17` **validé sur une vraie photo** développée des deux côtés : **1,95/255**.
3. **Netteté 40** : la plupart des presets la portent, `cn11`/`cn17` compris.
   `cn01` est une **exception** : il pose 0 (confirmé par Matthis le 2026-08-20).
   Règle : **on recopie ce que le panneau affiche, le preset appliqué**, sans
   interpréter.
4. **Texture branchée**, les deux côtés (le négatif a son propre dosage).
5. **Instrument corrigé** : `compare-preset-vs-lightroom.mjs` convertit en sRVB
   par ColorSync — les JPEG Samsung sont en P3, on annonçait 1,73 avec un
   appareil décalé de 0,80.
6. **Audit des réglages avancés (2026-08-17)** : les **17 réglages du panneau
   Vision marchent tous**, vérifié dans le moteur ET en poussant les vrais
   curseurs. Trois choses corrigées au passage :
   - **Studio : la moitié de la course ne faisait rien** (Luminosité affichée
     60–140 pour 85–115 retenus, Grain 0–100 pour 0–40…). Le nombre affiché
     mentait — « la luminosité ne marche pas » était **juste**. Les bornes
     écrites en dur dans `normalizeVisionFilters` ont rejoint
     `VISION_SAFE_BOUNDS` ; Studio les lit, comme Vision le fait déjà.
   - **L'image sautait au premier cran d'un réglage de couleur** :
     `fitRgbToGamut` désaturait des couleurs valides (« Ciel » à 1 déplaçait
     2,6 % de l'image). Corrigé : marge par canal, 0,00/255.
   - **La halation n'est pas morte**, elle est locale et ne mord que sur une
     haute lumière **colorée**. C'était la mire qui manquait de néon.

**Ce qui reste sur ce lot** — tout remesuré le 2026-08-19 sur les vrais exports
Lightroom : [audit de fiabilité](docs/lightroom/5-audit-fiabilite-2026-08-19.md).
Grain, vignetage, texture (deux sens), clarté positive et netteté 40 sont
confirmés à quelques pourcents. Les trous, par ordre d'importance :

**Deux trous bouchés le 2026-08-19, dans la foulée de l'audit :**

- **Clarté négative CALÉE.** Elle n'avait jamais été mesurée : notre dosage
  linéaire donnait à −100 exactement l'image floue. Loi `0,01409 × N^0,777`
  (le sien sature, comme sa texture négative). Mesuré après : **0,707 à −50**
  et **0,494 à −100**, contre 0,695–0,723 et 0,476–0,526 chez lui. Le positif
  n'a pas bougé. Borne sûre ouverte à −30, ambiances converties (−18 → −27,
  −6 → −7).
- **L'import ne jette plus rien en silence.** `verifierDomaineSpatial`
  (`xmpPreset.js`) liste ce qui ne sera pas reproduit — vignetage positif et
  voile négatif jetés, voile hors échelle, netteté ≥ 80, halo sur les arêtes —
  et `preset:import` l'affiche. Gardé par `npm run test:vision-preset`.

**Ce qui reste :**

1. **Voile** : 11,8/255 d'écart à 50 — hors tolérance. Pas mesurable sur mire :
   cas à part, sur photo réelle. Notre plafond est 50, le sien 100.
2. **Texture ET clarté sur contours francs** : il épargne les arêtes marquées
   (1,006 / 1,014 à +50), nous non (1,100 / 1,143). Demande un masque de
   contours, pas un coefficient.
3. **Notre netteté amplifie le bruit du JPEG** ×1,46 sur les zones plates
   (mesuré sur `cn17`), là où Lightroom développe depuis du RAW et a un curseur
   **Masquage** que nous n'avons pas. Sur les contours, la valeur relevée est la
   bonne (0,874 sans netteté, 1,118 avec). Invisible sur la photo de plage ; à
   surveiller sur une photo bruitée à grand ciel uni.
4. **Netteté ≥ 80** : sur les larges structures il raidit ×1,58 à 150, nous
   ×1,00. À 40 (la valeur par défaut, celle qui compte) l'écart est nul.
5. **Grain — les 5 % de la vraie photo : RÉGLÉ le 2026-08-22.** C'était
   l'exposant de largeur, pas la couleur. L'ancienne loi `(largeur/1620)^0,577`
   se trompait de 5,8 % dès qu'on sortait des trois tailles sur lesquelles elle
   était ajustée. Remplacée par une **table mesurée** (1620 / 3240 / 6480 /
   **9720**, ce dernier exporté le 2026-08-22), interpolée en log-log. Sur la
   vraie photo : de −5 % à **−1 %**. La **Taille 40** est mesurée elle aussi
   (1,1716, on l'interpolait à 1,183).
6. **Grain — l'état après 21 exports Lightroom.** La journée a corrigé, dans
   l'ordre : la **couleur** (il pose son grain dans son espace de travail
   ProPhoto, pas en sRVB), la **loi de largeur**, le **repli sous le pixel**,
   la **forme** (force et grosseur sont deux nombres, pas un), puis — le plus
   gros — le fait que **la Taille et la largeur ne se multiplient pas**.

   | | écart |
   |---|---|
   | Force, **18 exports** (Tailles 0→100 × largeurs 810→9720) | **0,13 %** |
   | Grosseur des grains, 6 exports | 2,2 % |
   | Cassure, 3 exports | 0,11 % |
   | Gris / couleurs (mire, 3 forces) | 0,7 % / 1,2 % |

   **Le modèle en produit est mort.** Six exports (Tailles 10 et 40 à 1080,
   3240, 6480 px) ont montré des écarts de **−32 % à +13 %** *entre* les deux
   axes mesurés, là où personne n'avait regardé. Remplacé par une **surface**
   mesurée, interpolée. Le rapport entre sa Taille 10 et sa Taille 25 vaut 1,07
   à 1080 px et **1,67** à 6480 : sur une petite image les Tailles basses se
   confondent, sur une grande elles s'écartent.

   **La Cassure n'était pas négligeable** : à 0 elle pose **1,72×** plus de
   grain, à 100 elle grossit les grains de moitié sans changer la force. C'était
   le piège silencieux ; elle est mesurée, branchée (`grainRoughness`) et
   passable à l'import (`--grainRoughness`).

   Deux bugs trouvés en route : l'atténuation dans les noirs et les blancs était
   calée sur **un seul** point lu après écrêtage (6,4 % → 0,68 %) ; et à certains
   pas d'interpolation le bruit se calait sur la grille de pixels et gagnait
   **13 % de force** — l'ancienne table avait un point sur l'un d'eux.

7. **Grain — LE GRAND CÔTÉ, pas la largeur : RÉGLÉ le 2026-08-22.** Une mire de
   2160×3240 exportée **en portrait** rend 12,62, exactement comme la même mire
   en paysage 3240×2160 (12,64). Si Lightroom lisait la largeur elle aurait
   rendu 15,73. Notre moteur lisait la largeur : **47 % d'écart sur le grain de
   toute photo verticale**. Corrigé (`grandCoteImage` dans
   [studioRenderer.js](src/features/vibefx-studio/engine/studioRenderer.js)),
   gardé par un test.

8. **Grain — sur de vraies photos, et ce qui reste.** Deux photos développées
   des deux côtés en CN14 (**Grain 25, Taille 10, Cassure 50 — relevé confirmé
   dans son panneau** le 2026-08-22), ciel, bruit de fond retiré en quadrature :

   | photo | grand côté | son grain | le nôtre | écart |
   |---|---|---|---|---|
   | `photo-test-1` | 5 392 | 7,73 | 7,41 | **−4 %** |
   | `photo-test-2` | 16 320 | 4,03 | 4,71 | **+17 %** |

   La première est **dans** le domaine mesuré (810 → 9720 px), la seconde non :
   elle fait 150 Mpx, 1,7× au-delà de notre plus grande mire. C'est la seule
   différence entre les deux, et elle explique tout l'écart.

   **Sur une photo normale, on y est.** Au-delà de 9720 px de grand côté on
   extrapole, et ça coûte 17 % sur une image de 150 Mpx. Une mire de 16320 px,
   à Taille 10 **et** Taille 25, le fermerait — 2 exports, seulement si une
   photo de plus de 100 Mpx doit vraiment être servie.

   Le **recadrage** est désormais testé (la loi et le câblage).
8. **CN11 à remesurer** avec l'instrument corrigé si sa photo de validation
   réapparaît — ses 0,64/2,67 datent de l'ancien.
9. **Une seule résolution vérifiée** (1620×1080) **pour la texture et la
   clarté** : leur rayon est en pixels fixes, la clarté en % du cadre.
   Hypothèse non mesurée sur une autre taille. (Le **grain**, lui, est
   désormais mesuré à quatre tailles.)

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

**Série en cours (favoris de Matthis)** : faits `cn01`, `cn11`, `cn13`, `cn14`,
`cn16`, `cn17`. Restent CN18, FT01, FT11, LN02, LN05, LN06, TR04, TR13,
TR14, TR15, VCR11, VCR12. Le circuit de dossiers est décrit dans le prompt de
reprise.

**À chaque preset qui porte du grain** : ouvrir le triangle du panneau Grain et
relever la **Taille**. Elle ne se passe à l'import (`--grainSize`) que si elle
s'écarte de 25.

Familles **paysage** (LN01–LN08), **architecture urbaine** (UA01–UA04),
**voyage, cinéma, film**, par la méthode Hald CLUT
([1-procedure.md](docs/lightroom/1-procedure.md)).

**Un preset Lightroom n'est pas que de la couleur.** À chaque import : relever
les panneaux **Effets** et **Détail** (l'agent doit les **demander**) — dont la
**Réduction du bruit**, que notre moteur n'a pas : un preset qui en porte gardera
chez nous un grain numérique que Lightroom lisse (invisible à bas ISO, visible
sur une photo prise dans le sombre), remettre
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
- **Un preset qui porte du GRAIN ne se juge pas au pixel.** Son grain et le
  nôtre sont deux tirages aléatoires : ils ne tombent jamais aux mêmes endroits,
  et l'écart pixel à pixel ne peut pas être nul même avec une table parfaite.
  Sur `cn14` ça pesait 4 à 5/255 — assez pour accuser la mire à tort. La ligne
  « couleur seule, par blocs » du comparateur donne la vraie mesure.
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
  jamais l'inverse. Une borne d'interface plus large que celle du moteur produit
  exactement le symptôme « ce réglage ne marche pas » : la course ne fait rien
  sur sa fin, et le nombre affiché ment. C'était le cas de Studio jusqu'au
  2026-08-17. `npm run test:reglages-avances` le rattrape désormais.
- **Un effet LOCAL ne se juge pas à sa moyenne.** Un halo pèse 0,13/255 sur
  l'image entière et se voit très bien (26/255 sur 20 % du cadre). Juger à la
  moyenne seule fait « réparer » un réglage qui marche.
- **Un réglage à 1 doit faire un effet de 1.** Si le moteur a un étage qui ne
  s'allume qu'au-delà du repos, l'image saute au premier cran et ne bouge plus
  ensuite. C'était le cas du garde-fou de gamut.
- **Un curseur recentré ne convertit JAMAIS position ↔ valeur** : l'arrondi crée
  une **zone morte** et le curseur se bloque. Course élargie symétriquement,
  valeur bornée à la sortie.
- **Un effet de matiere ne se juge pas sur une image reduite.** A « Adapter »,
  l'ecran moyenne le grain et on croit que le reglage ne fait rien : Vision a un
  **zoom** (Adapter / 100 % / 200 % / 400 %) pour ca, comme Lightroom. Et une
  MESURE de grain a le meme piege : retirer un voisinage trop etroit sous-estime
  un grain plus gros qu'un pixel.
- **Toujours exporter un TÉMOIN avec la mesure.** Pour le petit format, la mire
  à Taille 100 servait de contrôle : ses grains restent gros même sur une petite
  image, donc **hors** du mécanisme suspecté. C'est elle qui a montré que la
  Taille et la largeur ne sont pas séparables — sans elle, on aurait mis son
  écart sur le dos du repli et « corrigé » au mauvais endroit.
- **Un écart UNIFORME sur les trois canaux n'est jamais un effet de couleur.**
  Les 5 % qui restent sur une vraie photo étaient attribués au grain de couleur ;
  une fois la couleur réparée, ils étaient toujours là, identiques sur R, G et B.
- **Un rapport lu après écrêtage n'est pas la grandeur qu'on croit lire.**
  L'exposant de l'atténuation du grain était calé sur un seul rapport mesuré à
  faible force : il ne pouvait pas tenir aux fortes, où un quart des pixels
  tombe à 0.
- **Le grain se calcule sur la taille de l'IMAGE, jamais du canvas.** Un aperçu
  qui dessine à 800 px une photo de 9180 doit montrer le grain **réduit**, pas
  le grain d'une image de 800 px — sinon le ciel part en bouillie (15,6/255 au
  lieu de 0,8). C'est ce que fait l'écran de Lightroom. Corollaire : **un aperçu
  montre moins de grain qu'un export**, et c'est normal.
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
  **récap en langage simple** seulement. Le prompt de reprise s'écrit dans
  `docs/prompt-reprise-<date>.md` et n'est collé dans le chat **que sur
  demande** (cf. AGENTS.md, « Économie de contexte et de quota »).

---

## Gates

```bash
npm run dev                    # http://localhost:3000 -> /creer
npm run lint                   # 0 erreur (5 warnings préexistants)
npm run build
npm run test:scope
npm run test:vision-preset     # 98 vérifications (Node, 3 s)
npm run test:vision-filters
npm run test:vibeos-vision     # rejoue test:vision-preset, puis le navigateur
npm run test:vibeos-pipeline   # composition -> Vision -> Studio -> publication
npm run test:vibeos-library / -layout / -studio / -soundtrack   # si tu y touches
npm run audit:reglages-avances # chaque réglage fait-il quelque chose ? (moteur)
npm run test:reglages-avances  # ...et en poussant les vrais curseurs (interface)
npm run test:routes            # si tu touches aux routes (build + start)

# outils des presets
npm run preset:mire / preset:controle / preset:import          # capturer un preset Lightroom
node scripts/planche-presets.mjs <photo...>                    # planche : LUT seule
node scripts/planche-showcase.mjs                             # planche : EFFETS COMPRIS
node scripts/mesure-ciel-powlisher.mjs [--photo <f>]           # où le ciel atterrit
node scripts/audit-vision-presets.mjs                          # bandes, dominante, témoins
node scripts/compare-vision-presets-on-photos.mjs <photo...>   # écrêtage et force
node scripts/mesure-grain-canaux.mjs --reference <sans> --lightroom <avec> --valeur 50
#   -> son grain CANAL PAR CANAL : corrélation entre canaux, et pixels écrêtés
node scripts/mesure-grain-photo.mjs <sa-photo> --grain 25 --taille 10 --sansgrain <sans>
#   -> le grain sur une VRAIE photo, même flou des deux côtés
node scripts/make-mire-largeur.mjs 1080 810 --sortie <dossier>
#   -> la mire A DESSINÉE à une largeur (jamais réduite : ça ferait baver les bords)
node scripts/compare-preset-vs-lightroom.mjs <src> <lr> <id> [--planche <p>] [--sortie <p>]
#   -> rendu COMPLET (LUT + effets) dans le vrai moteur ; --sans-effets = couleur seule
node scripts/rendu-mire-c.mjs --texture 50 --sortie <png>      # notre moteur sur la mire C
node scripts/mesure-mire-c.mjs --reference <a> --lightroom <b> # netteté / texture / clarté
```

Tous verts au 2026-08-17, les deux audits de réglages compris.

**Échecs préexistants, hors chantier** : `smoke-vibecut-media-safety.spec.cjs`
(3) et `test:vibecut-export-local-mp4` — fixtures manquantes, chemins Windows
d'origine, pointeurs Git LFS ([archive](docs/archive-vibecut-2026-08-04.md#commandes)).

**`npm run build` échoue depuis la machine, pas depuis le code** (vu le
2026-08-19, reproduit sans aucune modification) : le code compile, mais la
collecte de page casse sur `/api/catalog/[jobId]` parce que `better-sqlite3` a
été compilé pour un autre Node (NODE_MODULE_VERSION 127 contre 147). Correctif :
`npm rebuild better-sqlite3`.
