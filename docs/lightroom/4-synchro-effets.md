# Synchroniser nos effets avec Lightroom — le protocole

**Pourquoi ce document existe.** La capture Hald CLUT donne la **couleur** au
1/255 près. Elle est aveugle à tout ce qui dépend des **pixels voisins** (grain,
clarté, texture, netteté) ou de la **position** (vignetage). Ces réglages-là, on
les recopie à la main — et nos chiffres ne voulaient pas dire les siens.

## GRAIN — réglé le 2026-08-15

**Notre échelle de grain est désormais celle de Lightroom.** « Grain 15 » veut
dire la même chose des deux côtés, vérifié sur 24 aplats et 3 valeurs de
curseur. Le détail est dans
[`applyFilmGrain`](../../src/features/vibefx-studio/utils/canvasUtils.js).

Ce que la mesure a donné, et ce qu'elle a corrigé :

- **Le « ×8 » annoncé était faux.** Il avait été mesuré sur la mire Hald, dont
  les pastilles font 4×4 px de couleurs sans rapport : la bavure entre voisins
  y était comptée comme du grain. Le vrai rapport sur le ton moyen était
  **×2,66**.
- **Le vrai problème n'était pas le facteur, c'était la forme.** Le grain de
  Lightroom est **plat du noir au blanc** (5,52 · 5,52 · 5,52…). Le nôtre était
  une **cloche** : 2,07 au ton moyen, 0,45 dans les ombres, 0,57 dans les
  hautes lumières — parce que la fusion `overlay` n'a plus d'effet près de 0 et
  de 255. Notre grain disparaissait exactement là où un grain de film se voit.
- **Son curseur est une droite** : écart-type = **0,367 × valeur**
  (5,52 à 15 · 18,35 à 50 · 36,67 à 100). Aucune courbe cachée.
- **Son grain est monochrome** : corrélation 1,00 entre R, V et B.
- **Il s'éteint aux deux bouts** : ×0,67 aux niveaux 8 et 247, et ce n'est
  **pas** de l'écrêtage (une gaussienne σ 5,5 sur un niveau 8 coupée à 0 rendrait
  5,20 ; on mesure 3,48).

Après correction, notre moteur donne **×1,00 à ×1,01** sur tous les gris, les
peaux, le ciel, le feuillage et le béton, aux trois valeurs de curseur.

> **Résidu assumé** : sur des primaires très saturées, Lightroom donne 1,1 à
> 1,4× le plat, inégalement entre canaux — signe qu'il ajoute son bruit avant
> une transformation d'espace. Sur la matière où un grain se juge, l'écart est
> nul.

**Conséquences déjà appliquées** : `cn17` porte enfin son `grain: 15` ;
`powlisher-showcase` passe de 20 à **8** (même force au ton moyen) ; les
ambiances du Studio et les profils de `constants.jsx` sont divisés par 2,663 ;
les bornes passent à 40 (sûr) et 100 (libre, le maximum de Lightroom).

---

## Les mires

```bash
npm run preset:mire-effets      # → presets-lightroom/mires-effets/ (4 PNG, 1620×1080)
```

| Mire | Ce qu'elle contient | Ce qu'elle mesure |
|---|---|---|
| **A — aplats** | 24 carrés parfaitement unis, du noir au blanc + couleurs | **Grain** (sur un aplat uni, toute variation *est* le grain) |
| **B — vignette** | 3 bandes unies pleine largeur (64, 128, 192) | **Vignetage** : profil radial, forme, et multiplie-t-il ou soustrait-il |
| **C — détails** | barres 40 px fort et faible contraste, bord doux 120 px, réseaux sinusoïdaux 8 / 24 / 64 px | **Netteté** (fin), **Texture** (moyen), **Clarté** (large) |
| **D — voile** | image délavée : dégradé brumeux + carrés au contraste écrasé | **Correction du voile** |

**1620×1080, et jamais redimensionné.** Le grain et la netteté dépendent de la
résolution : réduire une image *moyenne* son grain. On calibre à la taille où
l'on publie, sinon on étalonne sur une taille qu'on n'utilise jamais.

---

## Ce qui est demandé à Lightroom

**Avant tout, une fois :** ouvrir le panneau **Détail** et mettre **Netteté à
0**. Lightroom en pose par défaut, et elle contaminerait chaque mesure.

Puis, pour chaque ligne du tableau : **un seul curseur bougé**, tous les autres
à 0, et export.

**Réglages d'export, identiques à chaque fois** (les mêmes que la procédure Hald) :

| Réglage | Valeur |
|---|---|
| Type d'image | PNG |
| Dimensions | **Taille réelle** |
| Espace colorimétrique | **sRVB** ⚠️ pas Adobe RVB |
| Netteté de sortie | **Aucun** |
| Sortie HDR / Filigrane | décochés |

Le **nom du fichier n'a aucune importance** : c'est le **dossier de destination**
qui dit de quel réglage il s'agit.

### Lot 1 — grain : FAIT

Exports fournis : mire A sans rien, puis Grain 15, 50 et 100. Mesure :

```bash
node scripts/mesure-grain-lightroom.mjs \
  --reference <mire-A-sans-rien.png> --lightroom <mire-A-grain-N.png> \
  --valeur N [--planche <sortie.png>]

node scripts/planche-grain.mjs <photo.jpg> --sortie <planche.png>
```

> **Reste à vérifier sur le grain** : ses sous-réglages **Taille** et
> **Rugosité** ont été laissés par défaut. Un preset qui les change ne sera pas
> reproduit — il faudra les relever, et sans doute les mesurer aussi.

## VIGNETAGE — réglé le 2026-08-16

**Il multiplie en lumière LINÉAIRE**, pas en sRVB comme nous le faisions. C'est
la mire à 3 bandes qui l'a tranché : à rayon égal, sous Vignette −100, les trois
bandes donnent trois ratios différents en sRVB (0,291 · 0,351 · 0,430) et le
même en linéaire (0,123 · 0,121 · 0,162). C'est physique — un vignetage, c'est
de la lumière qui manque.

- **Rayon elliptique**, normalisé par la demi-largeur et la demi-hauteur : le
  vignetage suit le cadre. Le nôtre dessinait un cercle dans un rectangle.
- **Le dosage agit comme un exposant**, pas comme un facteur : ln(gain à −50) /
  ln(gain à −100) vaut 0,57, constant sur tout le rayon.
- **Il protège les hautes lumières** : la bande claire est assombrie ~30 % moins
  que la loi multiplicative ne le voudrait, et ce n'est pas son curseur
  « Hautes lumières » (il était à 0).

Écart final : **2,4/255 en moyenne**, dont l'essentiel dans la bande claire.

> **Le nôtre ne faisait presque rien.** Mesuré : `vignette: 22` assombrissait
> l'image de 3,3/255 en moyenne. Sur la nouvelle échelle ça vaut **3**. Toutes
> les valeurs existantes ont été converties dans ce rapport (5→1, 20→2, 30→4,
> 60→9) — `powlisher-showcase` inclus.

## NETTETÉ et CLARTÉ — réglées le 2026-08-16

> **Le côté NÉGATIF de la clarté a été calé le 2026-08-19**, et il était faux
> jusque-là : notre dosage linéaire donnait à −100 exactement l'image floue
> (0,012 d'amplification contre 0,476 chez lui), et à −50 il enlevait 50 % du
> détail là où Lightroom en enlève 30 %. Le sien **sature**, comme sa texture
> négative. Loi retenue, `0,01409 × N^0,777` — voir le tableau plus bas et
> [l'audit du 2026-08-19](5-audit-fiabilite-2026-08-19.md).


Mesurées sur la mire C, en lisant l'amplification zone par zone (l'intérêt des
réseaux **sinusoïdaux** : chacun ne contient qu'une seule échelle).

**Clarté : notre dosage était déjà juste.** Sur les réseaux, Clarté 50 donne
1,49–1,54 chez lui et 1,50 chez nous ; Clarté 100 donne 1,91–2,00 contre 2,00.
C'est le **rayon** qui était faux : sur le bord doux de 120 px — la seule zone
qui teste les grandes structures — il amplifie ×1,79 et nous ne faisions ×1,03.
Rayon porté de 2,5 % à **11 % du petit côté**.

**Clarté négative : réglée le 2026-08-19, huit jours après le positif.** Elle
n'avait jamais été mesurée — le lot s'était arrêté au côté qui accentue.

| curseur | 8 px | 24 px | 64 px |
|---|---|---|---|
| −50, Lightroom | 0,695 | 0,699 | 0,723 |
| −50, **nous** | **0,707** | **0,706** | **0,706** |
| −100, Lightroom | 0,476 | 0,485 | 0,526 |
| −100, **nous** | **0,494** | **0,494** | **0,494** |

*(avant correction : 0,502 à −50 et **0,012** à −100 — l'image devenait le flou
pur, parce que `pixel + (pixel − flou) × (−1) = flou`.)*

**Résidu assumé, plus gros que celui de la texture négative** : 5 % d'écart
entre le 8 px et le 64 px chez lui, contre 0,5 % pour la texture. Son
adoucissement mord un peu moins sur le très large, alors que notre masque flou à
**un seul rayon est plat** au-dessus de son rayon. On cale sur la moyenne des
trois réseaux : +1,7 % sur le fin, −2,4 % sur le large à −50 ; +3,8 % et −6,1 %
à −100. Y toucher demanderait un second rayon, comme la texture en a un — ce qui
remettrait en cause le positif, lui validé à 1 %. **Le positif n'a pas bougé**
(1,496 / 1,498 / 1,500, contrôle refait après la correction).

Conséquence sur les valeurs déjà écrites : les deux ambiances qui portaient une
clarté négative ont été **converties** pour garder le même rendu à l'écran
(« Aube laiteuse » −18 → −27, « Brume matin » −6 → −7), et la borne sûre passe de
−25 à **−30** — le négatif est désormais beaucoup plus doux à curseur égal.

**Netteté : notre réponse était trop forte, et de plus en plus haut.** Sur le
réseau de 8 px : 1,22 chez lui contre 1,29 chez nous à 40, mais 1,63 contre
**2,13** à 150 — son curseur sature, le nôtre était linéaire. Dosage passé en
loi de puissance (`0,035 × N^0,766`), échelle portée à **0 – 150** comme la
sienne, dont le **40 par défaut**.

## La validation sur une VRAIE photo — 2026-08-16

Une mire prouve qu'un réglage a la bonne force. Elle ne prouve pas qu'une photo
rend pareil. Ce test-là a été fait : plage, ciel, mer, roche, écume brûlante,
5392 × 3032, développée des deux côtés sous `cn17` (grain mis à 0 des deux
côtés — deux bruits aléatoires différents ne se comparent pas pixel à pixel).

```bash
node scripts/compare-preset-vs-lightroom.mjs <origine> <version-LR> cn17 \
  --planche <sortie.png>
```

**Écart moyen 1,95/255. Verdict : identique à l'œil.** Médiane 1, 90ᵉ centile 4,
99ᵉ centile 11 — et le maximum (50) est dans l'écume brûlée, là où un JPEG n'a
plus la matière qu'avait le RAW. Notre rendu reproduit **85,6 %** de l'effet du
preset, qui pèse lui-même 13,54/255 sur cette photo.

> **Ce chiffre valait 1,73 jusqu'au 2026-08-17, et c'était l'instrument qui se
> trompait, pas le moteur.** Le script lisait les nombres bruts du JPEG, alors
> que l'application les reçoit **convertis en sRVB** par le navigateur — les
> JPEG du Galaxy S24 Ultra sont en « DCI-P3 D65 Gamut with sRGB Transfer ». Les
> deux côtés appliquaient donc la même LUT à des entrées distantes de 0,80/255.
> On annonçait une fidélité de 1,73 avec un appareil décalé de 0,80 : presque la
> moitié de la précision annoncée était de l'incertitude d'instrument. Le script
> convertit désormais par **ColorSync** (voir l'en-tête de
> `compare-preset-vs-lightroom.mjs` : aucune des sept variantes de sharp
> essayées ne fait la transformation ICC). **1,95 est le vrai chiffre**, mesuré
> sur les mêmes fichiers.

**Et la planche a trouvé ce que la moyenne cachait.** La carte des écarts (×8)
ne montrait pas une zone ni une bande, mais **les contours de la roche** — la
signature d'une différence de netteté, pas de couleur. Mesuré sur cette
zone : luminance moyenne identique (132,84 contre 132,81), mais **1,40× plus
d'énergie de contours chez Lightroom**. C'est la Netteté 40 de son panneau
Détail, que nos presets ne portaient pas.

En rejouant notre propre netteté sur la même zone : ×1,083 à 25, **×0,986 à 40**,
×0,890 à 60. Notre loi, calibrée sur la mire C, tombe donc **à 1,4 % de la
sienne sur une photo réelle** — et `cn11`/`cn17` portent désormais
`sharpness: 40`. Le raisonnement complet est dans
[1-procedure.md](1-procedure.md#la-netteté-40--on-la-recopie-même-si-elle-nest-pas--dans--le-preset).

> **Ce que ce test ne couvre toujours pas** : le grain (éteint des deux côtés,
> par construction) et le vignetage (à 0 dans `cn17`). Les deux restent validés
> sur mire, pas sur photo.

## L'AUDIT DES RÉGLAGES — 2026-08-17

Avant d'importer d'autres presets, une question qu'on n'avait jamais posée
franchement : **est-ce que chaque réglage fait vraiment quelque chose ?** Caler
un dosage sur Lightroom ne sert à rien si le curseur qui le porte est mort, et
un réglage mort ne se signale pas — il rend juste une image un peu moins forte
que prévu.

```bash
npm run audit:reglages-avances   # le moteur : renderStudio, 31 réglages
npm run test:reglages-avances    # l'interface : les vrais curseurs des vraies pages
```

Les deux ne posent pas la même question, et il faut les deux. Le premier répond
à « le moteur sait-il faire ce réglage ». Le second saisit le curseur de la page
et relit son canvas : il attrape ce que le premier ne peut pas voir — une borne
d'interface plus large que celle du moteur, un `onChange` qui écrit la mauvaise
clé, un rendu qui ne se redéclenche pas.

**Verdict : les 17 réglages du panneau Vision marchent tous.** Du plus gros
(relief −30 : 8,4/255) au plus discret (tons chauds : 1,2/255 de moyenne, mais
35 % du cadre touché). Ce qui était cassé était ailleurs.

- **Studio proposait une course que le moteur n'honorait pas** : Luminosité
  affichée 60–140 pour 85–115 retenus, Sépia 0–100 pour 0–12, Grain 0–100 pour
  0–40. Poussée à 60, l'image était **identique** à 85. Corrigé en déplaçant les
  bornes écrites en dur vers `VISION_SAFE_BOUNDS`, que le panneau lit.
- **Le garde-fou de gamut désaturait des couleurs valides**, et seulement quand
  un réglage de couleur n'était pas au repos : « Ciel » à 1 déplaçait 2,6 % de
  l'image jusqu'à 45/255. Après correction : 0,00.
- **La halation a été déclarée morte à tort**, deux fois : la mire n'avait pas
  de haute lumière **colorée** (son garde-fou l'éteint sur un blanc neutre — 0,014
  sur du blanc pur — et c'est voulu), et un halo se juge mal à la moyenne.

> **Ce que ça change pour un import.** Les valeurs relevées dans les panneaux
> Effets et Détail de Lightroom se recopient telles quelles, et on peut
> maintenant affirmer qu'elles arrivent jusqu'aux pixels. À relancer après tout
> changement du moteur ou d'un panneau.

## Ce qui reste

- **TEXTURE** : **branchée et alignée le 2026-08-16**, côté positif seulement.

  | curseur | 8 px | 24 px | 64 px |
  |---|---|---|---|
  | +50, Lightroom | 1,175 | 1,120 | 1,096 |
  | +50, **nous** | **1,176** | **1,120** | **1,096** |
  | +100, Lightroom | 1,272 | 1,187 | 1,150 |
  | +100, **nous** | **1,283** | **1,183** | **1,146** |

  Deux choses se lisaient dans ses chiffres, et aucune n'était un facteur : son
  excès d'amplification décroît **lentement** avec l'échelle (≈ P^−0,34), ce
  qu'un masque flou à un seul rayon ne peut pas faire — d'où **deux rayons**,
  3 px et 40 px, à gain égal. Et son dosage **sature** : doubler le curseur ne
  donne que ×1,56, soit une loi en N^0,644, comme la netteté.

  **Résidu assumé** : sur le bord doux de 120 px il raidit ×1,03 et nous ×1,07 —
  on accentue un peu plus que lui le très large, l'échelle où la texture n'est
  pas censée travailler. C'est le prix du second rayon.

  **Second résidu, trouvé le 2026-08-17 et jamais relevé avant : sa texture est
  EDGE-AWARE, la nôtre non.** En mesurant le négatif, la zone « barres 40 px à
  fort contraste » a montré quelque chose que le positif seul n'avait pas fait
  regarder. Lightroom laisse les contours francs **intacts des deux côtés**
  (1,006 à +50, 0,995 à −50, 0,991 à −100) alors qu'il travaille franchement les
  barres à faible contraste (1,146 / 0,881 / 0,804). Il lisse la matière sans
  raboter les arêtes. Nous traitons les deux pareil :

  | barres 40 px, fort contraste | +50 | −50 |
  |---|---|---|
  | Lightroom | 1,006 | 0,995 |
  | nous | **1,095** | **0,916** |

  Ce n'est **pas** une régression du négatif : l'écart existe au positif depuis
  le premier calage, il n'avait simplement pas été mesuré sur cette zone.
  Concrètement, sur une arête très marquée — un toit sur le ciel, un poteau —
  notre texture positive laisse un halo qu'il n'a pas, et notre texture négative
  ramollit un contour qu'il garde net. **C'est le prochain vrai chantier de la
  texture**, et il demande un masque de contours, pas un coefficient.

  **Le côté NÉGATIF est réglé le 2026-08-17.** Les exports manquaient encore la
  veille — les fichiers présents étaient le positif exporté deux fois, et
  `mesure-mire-c.mjs` leur trouvait exactement les mêmes 1,175 / 1,120 / 1,096.
  Les vrais exports donnent :

  | curseur | 8 px | 24 px | 64 px |
  |---|---|---|---|
  | −50, Lightroom | 0,851 | 0,899 | 0,919 |
  | −50, **nous** | **0,849** | **0,905** | **0,918** |
  | −100, Lightroom | 0,752 | 0,832 | 0,866 |
  | −100, **nous** | **0,742** | **0,836** | **0,867** |

  **On craignait une autre loi, c'est le même filtre.** La crainte était
  légitime : un adoucissement n'a aucune raison d'être la symétrie d'un
  renforcement. Mais en résolvant le gain à partir de **chacun** des trois
  réseaux, avec les deux rayons déjà en place, on retombe trois fois sur le même
  nombre — −0,0765 / −0,0760 / −0,0762 à −50, et −0,1272 / −0,1264 / −0,1261 à
  −100. Trois échelles, 0,5 % d'écart : la signature spatiale ne change pas de
  signe.

  **Seul le dosage diffère, et il ne se devinait pas.** À curseur égal le
  négatif est plus *faible* que le positif (×0,84 à 50) mais il *rattrape* en
  montant (×0,90 à 100) : sa saturation est moins forte, **N^0,733** contre
  N^0,644. Reprendre le dosage positif au signe près aurait sur-adouci de 18 %
  à −50. Bornes ouvertes à −50 (sûr) et −100 (libre) ; l'import accepte
  désormais un `--texture` négatif.

  Les deux instruments, symétriques, sont désormais des scripts :

  ```bash
  node scripts/rendu-mire-c.mjs --texture 50 --sortie /tmp/nous.png   # notre moteur
  node scripts/mesure-mire-c.mjs --reference <ref.png> --lightroom <f.png>
  ```

  > **Un piège de mesure trouvé en route** : la raideur du bord doux se lisait
  > d'abord comme un max de différence pixel à pixel — donc comme un **max de
  > bruit**. Elle donnait 2,00 sur la mire de référence là où la transition n'en
  > vaut que 1,26, et faisait passer du bruit ajouté pour un bord raidi. Elle se
  > mesure maintenant sur le profil lissé.
- **VOILE** : mesuré, mais **pas capturable proprement par une mire**. C'est une
  expansion de contraste et de saturation ancrée sur le point clair (192 → 187 →
  182 tandis que 148 → 110 → 53), et surtout Lightroom l'estime **à partir du
  contenu de l'image**. Sur une mire quasi uniforme, on ne capture que la part
  globale. À traiter comme un cas à part, pas comme les autres réglages.
- **Sous-réglages** (Grain : Taille / Cassure ; Vignette : Milieu / Arrondi /
  Contour / Hautes lumières) : relevés à leurs valeurs par défaut (25/50 et
  50/0/50/0), non branchés. Tout est donc calibré **pour ces défauts**.

### Lot 1 bis — vignetage (4 exports)

| Mire | Panneau | Curseur | Valeurs | Dossier |
|---|---|---|---|---|
| B | — | rien, tout à 0 | — | `00-reference/ref-B-vignette` |
| B | Effets | **Vignette** | −25, −50, −75, −100 | `02-vignette-(mire-B)/…` |

> Sous-réglages à relever aussi : Milieu, Rondeur, Contour, Hautes lumières.

### Lot 2 — ensuite (16 exports)

| Mire | Panneau | Curseur | Valeurs |
|---|---|---|---|
| C | — | rien, tout à 0 | référence |
| D | — | rien, tout à 0 | référence |
| C | Détail | **Netteté** | 40, 80, 150 |
| C | Effets | **Clarté** | +25, +50, +100, −50 |
| C | Effets | **Texture** | +25, +50, +100, −50 |
| D | Effets | **Correction du voile** | +25, +50, +100 |

---

## La méthode, réglage par réglage

1. **Mesurer les deux côtés** — même mire, même valeur — et en tirer la loi, pas
   seulement un facteur. Le grain l'a montré : le facteur d'échelle n'était que
   la moitié visible du problème, la **forme** comptait davantage.
2. **Aligner notre moteur** pour qu'un même chiffre donne le même effet, plutôt
   que de convertir à l'import. Réajuster les bornes de
   [`VISION_SAFE_BOUNDS`](../../src/features/vibefx-studio/utils/visionColorScience.js).
3. **Convertir les valeurs déjà écrites** dans les presets et les ambiances —
   l'échelle a changé sous elles.
4. **Regarder une vraie photo**, pas seulement le tableau.

> **`powlisher-showcase`, revalidé à l'œil le 2026-08-16.** Ses trois effets ont
> été regardés sur quatre photos de voiture peu retouchées, avec le VRAI moteur
> (`node scripts/planche-showcase.mjs`, qui rend dans un Chromium — contrairement
> à `planche-presets.mjs`, qui ne montre que la LUT). Grain 8 et relief 14
> gardés tels quels. **Vignetage monté de 3 à 8** : le 3 reproduisait fidèlement
> un réglage cassé, il ne fermait rien. Réserve honnête : aucune de ces quatre
> photos n'a de grand ciel, le cas où un grain plat se voit le plus.

## Pièges de mesure

- **Le bruit s'ajoute en quadrature.** L'écart-type du grain seul s'extrait :
  `√((total² − base²))`, jamais la différence brute.
- **Mesurer le cœur des carrés**, pas leurs bords : tout effet spatial bave sur
  quelques pixels au bord d'un aplat.
- **Une barre nette contient toutes les fréquences à la fois.** C'est pour ça
  que la mire C porte aussi des réseaux **sinusoïdaux** : un sinus n'en contient
  qu'une, donc l'amplification lue est bien celle de cette échelle-là.
