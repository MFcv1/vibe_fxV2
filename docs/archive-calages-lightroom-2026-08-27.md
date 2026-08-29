# Archive — l'etat livre et les calages Lightroom (clos le 2026-08-27)

> Sorti de [todo.md](../todo.md) le 2026-08-27, parce que tout y est **termine**.
> Les six reglages avances sont alignes sur Lightroom; il ne restait que `Voile`,
> qui n'est pas capturable par une mire (Lightroom l'estime depuis le contenu de
> l'image) et qui est documente comme tel.
>
> A rouvrir seulement si on retouche un effet non-LUT ou si on reprend un import
> Lightroom. Le detail chiffre vit dans
> [docs/lightroom/4-synchro-effets.md](lightroom/4-synchro-effets.md).

---

## Ce qui est fait

Le **redesign VibeOS** est livré : création sous `/creer`, publication sous
`/publier`, vidéo sous `/video`.

**La colorimétrie de Vision** tourne sur un moteur de LUT 3D 33³
([lut3d.js](src/features/vibefx-studio/utils/lut3d.js)), plus une chaîne d'import
qui capture un preset Lightroom **exactement**, par Hald CLUT. Neuf presets :

| Preset | Ce qu'il est | Effets non-LUT |
|---|---|---|
| `ambre` | tiré d'un **modèle de 10 photos désignées à la main** : split-tone, b\* +1 dans les ombres → +8,2 dans les reflets | — |
| `ambre-nuit-1` | le point milieu entre les deux : blanc 209, gris moyen 105 | — |
| `ambre-nuit-2` | même couleur, densité basse : blanc à 181, contraste 129 | — |
| `powlisher-cine` | **le tronc** : le fond commun à 324 de ses photos, aucun nombre choisi à la main | — |
| `powlisher-cine-net` | pôle **ouvert** de l'axe des niveaux : lève tout, épaule à 245 | — |
| `powlisher-chaud` | pôle **chaud** de l'axe des couleurs : a\* à 0 dans les clairs, b\* +9,3 | — |
| `powlisher-froid` | l'autre bout : étalonnage le plus vert, bleu tourné de 16° | — |
| `powlisher-mer` | la famille « mer » entière : teal le plus profond (−16°), plafond le plus haut (252) | — |
| `powlisher-nuit-1` | le point milieu entre le tronc et la nuit : blanc 213, gris moyen 98 | — |
| `powlisher-nuit-2` | la famille « ville de nuit » : lampadaires tenus à 187 | — |
| `powlisher` | le look de `@powl_d`, reconstruit par mesure sur 19 photos | — |
| `powlisher-ciel` | le ciel **converge** vers sa teinte (190–199°) au lieu d'être tourné d'un angle fixe | — |
| `powlisher-showcase` | clair-obscur : le décor est vidé, le sujet reste seul coloré | grain 8, vignetage 8, relief 14 |
| `cn11`, `cn17` | captures **exactes** de Lightroom (pack Adobe « Cinéma II ») | netteté 40 ; `cn17` : grain 15 |
| `cn01` | capture **exacte** (importée le 2026-08-20, validée sur 2 photos : 1,56 et 1,28/255) | — (tout à 0 dans Lightroom) |
| `cn13` | capture **exacte** (importée le 2026-08-20, validée sur 2 photos : 2,27 et 1,67/255) | netteté 40 |
| `cn14` | capture **exacte** (importée le 2026-08-20, validée sur 2 photos : 1,49 et 1,48/255 **par blocs**) | netteté 40, grain 25 grosseur 10 |
| `cn16` | capture **exacte** (importée le 2026-08-20, validée sur 2 photos : 2,25 et 1,31/255) | netteté 40 |

**Les dix validés sont dans [docs/presets-valides.md](docs/presets-valides.md) :
ils ne se suppriment pas et ne se remplacent pas** — un variant s'ajoute à côté.
Trois autres ont été **supprimés** le 2026-08-12 (source biaisée, trait de contour
dans le ciel).

> **Les six presets du 2026-08-27 attendent le regard du porteur du projet.**
> Ils ont leurs mesures, leurs 62 vérifications dans `npm run test:vision-preset`,
> et ont été regardés sur des photos neutres — mais c'est lui qui décide de leur
> entrée dans la liste des validés. Planches dans `~/Desktop/powlisher-biblio/` :
> `AMBRE-VS-MODELE.jpg`, `AMBRE-DEUX-DENSITES.jpg`, `DUEL-COULEUR.jpg`,
> `DUEL-SUJETS.jpg`, `CIEL-1-1.jpg`.
>
> **`powlisher-cine-doux` a été construit puis retiré** le 2026-08-27 : il
> saturait les murs ocres d'une cour marocaine. Les deux erreurs de mesure qu'il
> a révélées sont dans le journal `map.md` du 2026-08-27 — **à relire avant de
> mesurer quoi que ce soit de nouveau.**

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


---

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

