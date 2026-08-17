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

Mesurées sur la mire C, en lisant l'amplification zone par zone (l'intérêt des
réseaux **sinusoïdaux** : chacun ne contient qu'une seule échelle).

**Clarté : notre dosage était déjà juste.** Sur les réseaux, Clarté 50 donne
1,49–1,54 chez lui et 1,50 chez nous ; Clarté 100 donne 1,91–2,00 contre 2,00.
C'est le **rayon** qui était faux : sur le bord doux de 120 px — la seule zone
qui teste les grandes structures — il amplifie ×1,79 et nous ne faisions ×1,03.
Rayon porté de 2,5 % à **11 % du petit côté**.

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

**Écart moyen 1,73/255. Verdict : identique à l'œil.** Médiane 1, 90ᵉ centile 4,
99ᵉ centile 10 — et le maximum (49) est dans l'écume brûlée, là où un JPEG n'a
plus la matière qu'avait le RAW.

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
