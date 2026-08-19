# Importer un preset Lightroom dans Vibe_fx

Ce document explique comment récupérer **n'importe quel preset Lightroom**
(CN11, CN17, un preset acheté, un preset perso) et l'utiliser dans l'app —
sans réimplémenter les calculs d'Adobe, et sans approximation sur la couleur.

---

## L'idée

Un preset Lightroom n'est pas un mystère, mais reproduire son **résultat** l'est :
Lightroom applique ses réglages à du RAW linéaire, dans son espace de travail,
avec sa courbe de base et un profil calibré par appareil. Recopier les valeurs
des curseurs dans un autre moteur donne un rendu **différent**.

Alors on ne recopie pas. **On fait faire le calcul à Lightroom et on lit le
résultat.**

On lui donne une image qui contient **une fois chaque couleur** d'une grille
régulière de l'espace RVB — une *Hald CLUT*. On lui applique le preset. L'image
qui ressort donne, pour chaque couleur d'entrée, sa couleur de sortie.
**Cette image est la table de conversion du preset.** Il n'y a plus rien à
deviner.

C'est la même méthode que pour le preset `powlisher`, à ceci près qu'ici on
connaît aussi l'**entrée** — donc la capture est exacte, pas déduite.

---

## Marche à suivre

### 0. Le contrôle — ne pas le sauter

Avant de capturer quoi que ce soit, il faut prouver que Lightroom ne décale pas
les couleurs **tout seul**. Sinon toutes les captures seraient fausses sans que
rien ne le signale.

On fait passer la mire neutre dans Lightroom **sans lui appliquer le moindre
réglage**, on la réexporte, et on mesure :

```bash
npm run preset:mire
# ... aller-retour dans Lightroom, sans rien toucher ...
npm run preset:controle -- presets-lightroom/controle-sans-preset.png
```

| Écart à l'identité | Verdict |
|---|---|
| ≤ 2/255 | parfait, on capture |
| 3 à 8/255 | acceptable, mais à noter : ça se retrouvera dans chaque preset |
| > 8/255 | **stop** — espace colorimétrique d'export, profil appliqué à l'import, netteté de sortie |

> Mesuré le 2026-08-11 sur Lightroom cloud desktop (macOS) : **0,018/255 de
> moyenne, 2/255 au max**. La chaîne est propre.
>
> Le seul réglage qui a fait échouer le premier essai : l'export était en
> **Adobe RVB**. Un espace plus large, où les mêmes chiffres RVB désignent
> d'autres couleurs — la table aurait été fausse d'un bout à l'autre. **Vérifier
> `sRVB` à chaque export**, c'est le piège qui revient.

`preset:import` refuse volontairement une mire non traitée. Sur le contrôle, ce
refus est le comportement attendu, pas un bug.

### 1. Générer la mire

```bash
npm run preset:mire
```

Écrit `presets-lightroom/hald-clut-neutre-niveau8-bloc4.png` (2048×2048,
262 144 couleurs) et un `LISEZ-MOI.md`. Le dossier est ignoré par git.

L'image ressemble à un damier bizarre. C'est normal : ce n'est pas une photo.

#### Pourquoi la mire est en **blocs**, et pourquoi ça n'est pas négociable

La version naïve met **une couleur par pixel**. Deux pixels voisins y sont alors
deux couleurs sans aucun rapport — une situation qui n'existe dans aucune photo.
Résultat : tout traitement qui regarde le voisinage fait **baver les couleurs les
unes sur les autres**, et la table capturée est fausse.

L'erreur est sournoise, parce qu'elle est **proportionnelle en absolu et pas en
relatif** : négligeable dans les tons clairs, ruineuse dans les noirs où les
valeurs valent 4 ou 8 sur 255.

Mesuré sur CN11, mire à un pixel par couleur :

| entrée | mire 1 pixel | mire 4×4 | Lightroom sur une vraie photo |
|---|---|---|---|
| 4,4,4 | 0,**18**,4 | 11,5,4 | — |
| 26,17,14 | 5,**24**,6 | — | 23,15,14 |

Le vert n'était pas dans le preset. Il était dans notre méthode. Et il se voyait
à l'œil sur les photos : volets, ombres et pieds de meubles viraient au vert.

Même capture, même preset, avant/après correction :

| | mire 1 pixel | **mire 4×4** |
|---|---|---|
| écart à Lightroom, pixel à pixel | 4,53/255 | **2,67/255** |
| écart sur la **couleur seule** | 1,70/255 | **0,64/255** |
| écart dans les noirs (luminance < 20) | 8,06/255 | **1,32/255** |

En blocs de 4×4, la bavure se mange sur le bord du carré ; l'import ne lit que le
**cœur** (2×2 moyennés, bord écarté). Le seul coût est une image 16 fois plus
grande, que Lightroom avale sans broncher.

> Autre correctif au passage : la mire porte désormais un **profil sRVB
> explicite**. Sans lui, l'éditeur doit deviner l'espace du fichier.

### 2. Dans Lightroom

1. Importer la mire.
2. Lui appliquer le preset à capturer — **et rien d'autre**. Pas de recadrage,
   pas de correction d'objectif, pas de réglage manuel par-dessus.
3. Exporter en **PNG**, **taille d'origine** (2048×2048), en **sRVB**, sans
   netteté de sortie, sans filigrane, **sans redimensionnement**.

> Deux pièges, et un seul est détecté automatiquement.
>
> Le **redimensionnement** mélange des couleurs voisines et rend la table
> fausse : l'import le détecte à la taille du fichier et refuse.
>
> L'**espace colorimétrique** ne se détecte pas. Lightroom propose Adobe RVB par
> défaut ; il faut **sRVB**. En Adobe RVB, les mêmes chiffres RVB désignent
> d'autres couleurs : la table serait fausse d'un bout à l'autre sans que rien ne
> le signale. À vérifier à **chaque** export.

### 3. Importer

```bash
npm run preset:import -- \
  --hald  presets-lightroom/cn11.png \
  --xmp   presets-lightroom/CN11.xmp \
  --id    cn11 \
  --label "CN11"
```

Le preset apparaît immédiatement dans `/creer/vision`.

Options : `--hint`, `--bestFor`, `--avoidFor`, `--intensity`, `--level`,
`--force` (écraser un preset existant), `--lisser` (voir juste en dessous).

### 4. Le grain

Un preset qui contient du **grain** ajoute du bruit **aléatoire pixel par
pixel**. Les blocs n'y peuvent rien : le grain frappe chaque pixel
individuellement, y compris au cœur du carré. Moyenner le cœur 2×2 divise ce
bruit par deux, ce que l'import fait déjà — mais ça ne suffit pas toujours.

L'import mesure donc la **rugosité** de la table et le dit. Ordres de grandeur,
tous mesurés avec la mire en blocs :

| Cas | Rugosité |
|---|---|
| aller-retour sans preset | 0,09/255 |
| CN11 (aucun grain) | 0,89/255 |
| **CN17 (grain marqué)** | **4,70/255** |

Au-delà de ~3/255, réimporter avec `--lisser 1` : un noyau [1,2,1] sur chaque axe
du cube, soit ±4 valeurs sur 255 en entrée. Assez pour effacer un bruit aléatoire
de moyenne nulle, trop peu pour aplatir une vraie courbe. Sur CN17 : 4,70 → 0,69.

**La preuve que le filtre ne casse rien** : appliqué à la mire de contrôle (déjà
lisse), il ne déplace la table que de **0,05/255**.

Le grain se récupère à sa vraie place, en **effet spatial**, via le `.xmp` →
`filters.grain`. Un grain figé dans une table de couleurs n'est plus du grain :
c'est juste une erreur.

> Avec la mire à un pixel, CN11 affichait 1,66/255 de rugosité et CN17 15,60 — on
> a d'abord cru que les deux avaient du grain. C'était la bavure entre voisines.
> Seul CN17 en a vraiment.

---

## Pourquoi fournir aussi le `.xmp`

Une Hald CLUT capture **parfaitement** tout ce qui est une fonction pixel à
pixel : exposition, contraste, courbes, mélangeur TSL, étalonnage, virage,
saturation. C'est-à-dire la quasi-totalité d'un preset « look ».

Elle ne peut capturer **aucun** réglage qui dépend des pixels voisins ou de la
position dans l'image, parce que ces réglages ne laissent aucune trace sur une
mire :

| Réglage | Dans la Hald CLUT ? | Récupéré par le `.xmp` |
|---|---|---|
| Exposition, contraste, courbes | **oui, exact** | — |
| Mélangeur TSL, étalonnage, virage | **oui, exact** | — |
| Clarté, texture | non | oui → `clarity` |
| Voile (dehaze) | non | oui → `dehaze` |
| Netteté | non | oui → `sharpness` |
| Grain | non | oui → `grain` |
| Vignetage | non | oui → `vignette` |
| Masques, corrections locales, objectif | non | **non** — hors périmètre |

Les échelles diffèrent (Lightroom va de −100 à +100, notre moteur borne plus
serré) : la conversion est proportionnelle, puis `normalizeVisionFilters` borne.
Mieux vaut un effet un peu plus doux qu'un rendu cassé.

### Où trouver les `.xmp`

- **macOS** : `~/Library/Application Support/Adobe/CameraRaw/Settings`
- **Windows** : `%AppData%\Adobe\CameraRaw\Settings`

Dans Lightroom, clic droit sur un preset → **Exporter**.

---

## Ce que ça ne résout pas

**Le RAW.** Les photos de référence sont des DNG ProRAW ; l'app travaille sur
des JPEG déjà développés. Un `Hautes lumières −30` **récupère de la matière**
dans un RAW ; dans un JPEG cramé, cette matière n'existe plus. La capture Hald
reproduit exactement ce que Lightroom fait **à une image 8 bits** — ce qui est
précisément notre domaine, donc c'est le bon compromis. Mais un preset conçu
pour du RAW ne rendra pas pareil sur un JPEG, dans Lightroom comme chez nous.

**La taille.** Chaque preset importé pèse ~144 ko de base64 dans le bundle
(table 33³). Ça compresse très bien (les tables sont lisses), mais au-delà d'une
dizaine de presets il faudra passer à un chargement paresseux depuis
`public/assets/`.

---

## Point produit à ne pas ignorer

Vibe_fx V2 est destiné à être un **outil web public**. Embarquer la table d'un
preset Adobe sous son nom dans un produit commercial est un risque réel : un
*look* ne s'approprie pas, une bibliothèque de presets sous licence si.

L'usage sain : s'en servir comme **référence de calibration** pour construire et
régler ses propres presets, publiés sous ses propres noms. Pour un usage
personnel ou une comparaison en interne, il n'y a pas de sujet.

---

## Vérification

```bash
npm run test:vision-preset
```

40 vérifications, dont l'aller-retour complet de la chaîne d'import : une mire
neutre passée dans un preset puis relue doit redonner ce preset. Mesuré sur le
preset `powlisher` : **0,24/255 d'écart moyen, 1,8 max sur des couleurs
réelles** — soit une capture fidèle.

### La vérification qui compte vraiment : sur une vraie photo

Un test synthétique ne prouve pas qu'on rend comme Lightroom. Pour ça, il faut
la même photo développée des deux côtés :

```bash
node scripts/compare-preset-vs-lightroom.mjs <origine.jpg> <version-lightroom.png> cn11
```

Mesuré le 2026-08-11, CN11 sur une photo de terrasse plein soleil (2252×4000),
capture avec la mire en blocs :

| Échelle | Écart avec Lightroom |
|---|---|
| pixel par pixel | 2,67/255 (médiane **1**) |
| blocs 4×4 | 1,25/255 |
| **blocs 16×16 (couleur pure)** | **0,64/255** |

Lecture : la **couleur** est reproduite à 0,64/255 — indiscernable. Les ~2/255
restants sont de la haute fréquence : Lightroom applique par défaut une
**Netteté de 40** à toute image, que par construction une table de couleurs ne
peut pas porter.

> ⚠️ **Ces trois chiffres datent de l'instrument NON corrigé** (avant le
> 2026-08-17 : le script comparait les nombres bruts du JPEG au lieu de les
> convertir en sRVB comme le fait le navigateur — voir
> [4-synchro-effets.md](4-synchro-effets.md#la-validation-sur-une-vraie-photo--2026-08-16)).
> Sur `cn17`, la correction a déplacé le résultat de 1,73 à **1,95/255**. CN11
> n'a **pas** été remesuré : sa photo de terrasse n'est plus sur le disque. Le
> vrai chiffre est donc probablement un peu moins bon que 0,64, sans que ça
> change la conclusion. À refaire si la photo réapparaît.

C'est aussi ce test qui a révélé que la mire à un pixel par couleur était
fausse : l'écart y était de 4,53/255 au pixel, 1,70 sur la couleur, et **8,06
dans les noirs** contre 1,32 aujourd'hui.

> Piège rencontré : une photo de téléphone est souvent stockée en paysage avec
> une balise EXIF « tourne-moi », alors que Lightroom écrit la rotation dans les
> pixels à l'export. Sans `.rotate()`, les deux images n'ont même pas les mêmes
> dimensions. Le script s'en charge.

### Comparer des presets entre eux

```bash
node scripts/audit-vision-presets.mjs              # bandes, dominante, couleurs témoins
node scripts/compare-vision-presets-on-photos.mjs <photo...>   # sur de vraies photos
```

Le second est le plus décisif : il mesure l'**écrêtage ajouté**, c'est-à-dire le
pourcentage de pixels poussés à 0 ou 255 — de la matière **détruite**. Un preset
conçu pour du RAW se permet d'écraser les noirs parce que le RAW a de la
réserve ; sur un JPEG déjà développé, il bouche.
