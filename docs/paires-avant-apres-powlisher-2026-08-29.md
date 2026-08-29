# Les trois paires « avant / après » de `@powl_d`, et ce qu'elles disent

> **2026-08-29.** Source du preset `powlishermain`. C'est la première fois que le
> projet mesure une retouche dont il connaît **les deux bouts**. Tous les autres
> presets de la famille sont déduits de photos FINIES : on voit où il arrive,
> jamais d'où il part.

## La source

Le 12 novembre 2025, un lecteur (`@Misu_on_X`) lui demande un avant/après. Il
répond par trois posts, chacun portant deux captures d'écran de Lightroom
mobile : la même photo avant, puis après son traitement.

| Post | Scène | Ce qu'on y voit |
|---|---|---|
| `1988715650794287456` | Station-service de nuit, moto rouge | ciel violet → teal, sol écrasé |
| `1988715687783919978` | Autoroute dans le brouillard, intérieur de voiture | brume grise → crème |
| `1988715756461179091` | Table de restaurant, nappe à carreaux | plus dense, plus chaud |

**Ce n'est pas la paire écartée le 2026-08-12** (`1997328906508960039`, passée
par une IA générative, cause de la suppression de trois presets). Celles-ci sont
des captures de son écran d'édition : la même image des deux côtés, sans autre
intermédiaire que la dalle du téléphone et le JPEG de X.

## La chaîne de mesure

```bash
# 1. télécharger en résolution d'origine
printf '1988715650794287456\n1988715687783919978\n1988715756461179091\n' \
  | node scripts/moissonner-powlisher.mjs - --sortie ~/Desktop/paires-powlisher

# 2. aligner (le cadre de l'image ne tombe pas au même endroit d'une capture
#    à l'autre ; la première est en plus recadrée de 2,6 %)
node scripts/aligner-paire-avant-apres.mjs <avant> <apres> ~/Desktop/paires-powlisher/p1

# 3. mesurer
node scripts/mesurer-paires-powlisher.mjs ~/Desktop/paires-powlisher/p1 ...

# 4. confronter les presets à la vérité terrain
node scripts/verifier-presets-sur-paires.mjs ~/Desktop/paires-powlisher
```

**On mesure par BLOCS de 8×8, jamais au pixel.** Deux captures rejouées portent
du bruit JPEG, et l'une des trois a dû être ré-échantillonnée pour être alignée :
au pixel, chaque contour fabrique une fausse couleur. On garde les blocs plats
des deux côtés et on compare des moyennes. **43 691 blocs** au total.

Trois pièges attrapés en route, tous invisibles dans les moyennes :

- **Le fond de Lightroom est NOIR**, pas gris. Une photo qui n'a pas le format de
  l'écran laisse deux bandes noires : 5 300 blocs à zéro dans la paire du
  brouillard, qui écrasaient tout le bas de la courbe. Détectés comme la plus
  longue suite de lignes non noires — un balayage naïf depuis le bord s'arrête
  sur le mot « Avant » que Lightroom pose DANS la bande.
- **La bande de gris `#1D1D1D` sous l'image** entrait dans le cadre et donnait
  400 blocs parfaitement identiques des deux côtés (29 → 29).
- **Une des trois paires est recadrée** (échelle 1,026, décalage −29 px). Elle
  est trouvée par corrélation sur le GRADIENT, jamais sur la couleur : c'est
  précisément la couleur qui change entre les deux.

## Ce que ça dit

### 1. Sa courbe ne fait rien

En lumière linéaire, les trois retouches sont un simple **gain** :

| Paire | Gain | En EV |
|---|---|---|
| station de nuit | 0,277 | −1,85 |
| brouillard | 0,856 | −0,22 |
| restaurant | 0,680 | −0,56 |

Une fois ce gain retiré, la courbe qui reste est **l'identité à ±2 L\* près** sur
toute la plage. Trois valeurs aussi éloignées ne peuvent pas être un réglage de
preset : c'est son curseur d'exposition, photo par photo.

C'est la même chose que dit déjà `todo.md` sous « l'étage de tonalité
adaptatif » : sa luminance médiane va de 23 en ville de nuit à 124 en mer, et
aucune courbe fixe ne suit ça. Ici on le voit par l'autre bout — **il ne la suit
pas avec une courbe, il la suit à la main.**

### 2. Tout est dans le virage

Le a\* et le b\* d'une entrée neutre, en fonction du niveau de SORTIE, tombent sur
une seule courbe — et les trois photos, une nuit, un brouillard et une table
éclairée, y tombent ensemble :

| L\* | a\* | b\* | | L\* | a\* | b\* |
|---|---|---|---|---|---|---|
| 2,5 | −2,05 | −0,32 | | 52,5 | +2,54 | **+9,38** |
| 12,5 | −2,07 | +0,63 | | 62,5 | +2,08 | +8,07 |
| 22,5 | +1,89 | +3,69 | | 72,5 | +0,20 | +7,93 |
| 32,5 | +2,80 | +5,49 | | 82,5 | −0,36 | +6,93 |
| 42,5 | **+3,52** | +7,71 | | 92,5 | −0,36 | +6,44 |

Ombres vert-cyan, bas-tons orange, crème du milieu jusqu'au blanc. C'est la
signature entière du preset.

### 3. Son ciel arrive à 192° en TSL

Le ciel de nuit part de **223°** et arrive à **192°**. C'est exactement la
fenêtre 190–199 trouvée le 2026-08-12 sur son corpus de 19 photos, par une
méthode qui n'a rien de commun avec celle-ci. **Deux sources indépendantes, le
même point d'arrivée** : la règle du ciel est bien une CONVERGENCE, et
`powlisher-ciel` avait raison contre `powlisher`.

En Lab : entrée 284,2° → sortie 227,5°, chroma ×0,85, sur 1 819 blocs.

### 4. Les verts tombent, les rouges non

Une fois le virage posé (sinon on compte deux fois ce qu'il fait déjà) :

| Teinte Lab | Rotation | Chroma | Mesuré sur |
|---|---|---|---|
| 0–45° (rouges, oranges) | +1,4 à −2,9° | ×1,03 à **×1,06** | nappe, moto, enseignes |
| 45–90° (jaunes) | −4,4 à +0,1° | ×0,87 à ×0,95 | pâtes, pain, bois |
| 90–135° (verts) | — | **×0,40 à ×0,53** | végétation du bas-côté, verre d'une bouteille |
| 270–285° (bleus) | **−56,7°** | ×0,85 | ciel de nuit |

Le point important : **le « coup de saturation sur les rouges » n'existe pas.**
En mesure brute il vaut ×1,38 — mais il disparaît quand on pose le virage
d'abord. Ajouter du b\* à un rouge le pousse vers l'orange ET lui ajoute de la
chroma ; c'est le virage qu'on voyait, pas un réglage de saturation.

### 5. Ce que les trois photos ne disent pas

Rien entre **135° et 250°** Lab (verts francs, cyans) et rien au-delà de **308°**
(magentas, roses). Le mélangeur de `powlishermain` y est à l'identité : là où on
n'a pas mesuré, on ne fait rien. Trois photos, c'est une source **certaine**, ce
n'est pas une source **large** — à ne pas confondre avec `powlisher-cine`, qui
couvre douze familles de sujet mais ne connaît aucune entrée.

## Le résultat

`node scripts/verifier-presets-sur-paires.mjs` — écart dE76 médian par paire, chaque
candidat ayant droit à **sa propre exposition libre** (sinon le classement
mesurerait surtout qui assombrit) :

| Preset | nuit | brouillard | restaurant | moyenne |
|---|---|---|---|---|
| aucun (exposition seule) | 6,98 | 6,37 | 7,08 | **6,81** |
| **`powlishermain`** | **4,60** | **1,73** | **3,12** | **3,15** |
| `powlisher-cine` | 7,48 | 3,49 | 5,32 | 5,43 |
| `ambre` | 6,98 | 2,22 | 7,27 | 5,49 |
| `powlisher` | 6,50 | 3,75 | 8,06 | 6,10 |
| `powlisher-ciel` | 6,45 | 3,83 | 8,06 | 6,11 |

**53,8 % de l'écart de couleur repris**, et le brouillard tombe à 1,73 — le
plancher de bruit des captures. Ce qui reste est du travail photo par photo : la
paire de nuit garde ses hautes lumières 17 L\* au-dessus de ce qu'un gain seul
prédit (la lampe de la station), et le restaurant a plus de contraste que le
gain seul. Deux compensations d'exposition locales, pas une couleur.

---

# `powV2` — la courbe, ajoutée le 2026-08-29 ter

## Le défaut de `powlishermain`, vu à l'œil

`powlishermain` ne touche pas à la luminosité, et la mesure lui donnait raison.
**Rejoué dans l'app sur ses trois AVANT, le rendu restait nettement plus clair et
plus plat que son APRÈS, sur les trois.** La leçon générale vaut d'être écrite :

> Un écart mesuré **à exposition libre** ne dit rien de ce que l'utilisateur
> voit. Il faut les deux chiffres.

## Ce qu'on a cherché

Aucune courbe ne peut passer par les trois paires. À L\* 42 d'entrée, il sort
**19,8** sur la nuit, **39,5** sur le brouillard et **34,9** sur le restaurant :
une fonction ne rend pas trois valeurs pour une entrée. On cherche donc le
meilleur compromis, en minimisant le dE76 médian des trois **sans exposition
libre**.

| Famille de courbe | dE76 moyen | Verdict |
|---|---|---|
| 21 nœuds libres | **3,21** | **refusée** — courbe en zigzag (plateaux et sauts) ; elle surapprend sur trois photos et poserait des bandes dans un dégradé |
| droite libre, `L = 1,05·L − 10` | **3,84** | **refusée** — envoie à zéro tout ce qui est sous L\* 9,5 : le volant et la console de la paire du brouillard perdent leur dessin |
| droite + pied doux, point noir mesuré, pente ≥ 0,30 | **4,51** | **retenue** |

**Le meilleur chiffre n'a pas gagné, et deux fois.** C'est le point de ce lot :
un preset n'a pas le droit de détruire de la matière pour gagner un dixième
d'écart, et une courbe à 21 nœuds libres ajustée sur trois photos n'est pas une
mesure.

Ce qui reste a **deux paramètres** : une droite en L\* — la forme même de ses
trois retouches, pentes 0,648 / 0,920 / 0,933 — posée sur un pied doux.

- Le **point noir** n'est pas un réglage : ses trois photos posent leur tranche
  L\* 0-5 à 2,4 / 3,2 / 0,1. La première ancre est ensuite ramenée à **0**,
  parce qu'un facteur commun aux trois canaux ne peut pas éclaircir un pixel
  déjà noir — prétendre le contraire fait exploser le gain près de zéro. Coût
  mesuré : **0,05 de dE76** sur une seule des trois paires.
- La **pente** ne descend nulle part sous 0,30, la borne du smoke.

La courbe s'applique **comme une exposition** — un facteur commun aux trois
canaux, en lumière linéaire — et pas sur le seul L\*. Ce n'est pas équivalent :
assombrir retire aussi de la chroma, alors que baisser le L\* en Lab la
laisserait intacte et rendrait des couleurs criardes. Le virage et le mélangeur
ont donc été **réajustés sous la courbe** : les rouges remontent de ×1,03 à
×1,14 (la courbe leur en retire), les verts descendent de ×0,40 à ×0,36.

## Le résultat

`node scripts/verifier-presets-sur-paires.mjs ~/Desktop/paires-powlisher`

**Sans exposition libre** — le preset appliqué tel quel, ce qu'on voit dans l'app :

| Preset | nuit | brouillard | restaurant | moyenne |
|---|---|---|---|---|
| aucun | 17,24 | 7,91 | 10,41 | **11,85** |
| **`powV2`** | **8,52** | **2,34** | **2,81** | **4,56** |
| `powlisher-cine` | 11,17 | 3,90 | 5,32 | 6,80 |
| `ambre` | 13,31 | 2,19 | 8,72 | 8,07 |
| `powlishermain` | 15,08 | 4,36 | 9,44 | 9,63 |
| `powlisher` | 15,91 | 4,48 | 12,52 | 10,97 |

**61,6 % de l'écart repris**, contre 18,8 % pour `powlishermain`. Le brouillard
et le restaurant tombent au niveau du bruit des captures.

**Avec exposition libre** — la couleur seule — `powV2` passe aussi devant
`powlishermain` (**2,61** contre 3,15) : le réajustement sous la courbe a
amélioré la couleur elle-même, pas seulement la densité.

## Ce qui reste, et pourquoi c'est irréductible

La paire de nuit reste à **8,52**. Son édit de nuit est **1,3 EV plus bas** que
ce qu'une courbe commune peut rendre, et aucune LUT 3D ne peut le rattraper :
une table n'a pas de mémoire, elle ne sait pas que la photo qu'on lui donne est
une scène de nuit. C'est exactement l'**étage de tonalité adaptatif** décrit dans
`todo.md`. Sur une scène de nuit, il faut poser l'exposition — comme lui.

---

# `powV3`, et surtout : ce que la photo de nuit contient vraiment

## La question

`powV2` rend les paires du brouillard et du restaurant quasi indiscernables des
siennes à l'œil. Sur la station-service de nuit, l'écart reste visible : son ciel
et son sol sont plus sombres, son rouge ressort plus, le plafond de la station et
le halo de la lampe sont plus éteints. **Peut-on aller chercher cette
troisième ?**

## La réponse : le test qui tranche

**Un preset est une FONCTION.** La même couleur d'entrée doit donner la même
couleur de sortie, où qu'elle soit dans l'image. On regroupe donc les pixels par
couleur d'entrée exacte (pas de 8 niveaux) et on compare leur sortie en haut et
en bas du cadre. Aucune hypothèse, aucun modèle.

| Photo | couleurs présentes des deux côtés | écart bas − haut |
|---|---|---|
| restaurant | 89 | **−0,0 L\*** |
| brouillard (gauche/droite¹) | 67 | **−0,3 L\*** |
| **nuit** | 30 | **−4,8 L\*** |

¹ *le haut et le bas de la photo de brouillard n'ont aucune couleur en commun —
la brume est à 90 de luminosité, l'habitacle à 10 ; le contrôle se fait donc
gauche/droite.*

Sur ses deux autres photos, son traitement est **une fonction de la couleur et
rien d'autre**. C'est un preset, et `powV2` peut le suivre.

Sur la nuit, non. Le cas extrême est sans appel :

> La couleur **204,188,164** (L\* 77), présente **3 027 fois** dans l'image,
> sort à **L\* 64,8 en haut du cadre** et à **L\* 2,8 en bas**.
> Même entrée. **62 L\* d'écart selon l'endroit.**

Aucune table de couleurs ne peut faire ça : une LUT ne sait pas *où* est le
pixel. Et aucun curseur des panneaux Lumière, Couleur ou Effets non plus — ils
sont tous globaux.

## Quel levier, exactement

La forme de ce qu'il a assombri, rapport L sortie / L entrée, cadre découpé en
dix-huit bandes :

```
    0,47 0,46 0,40 0,46 0,45 0,39 0,39 0,49 0,38   ← le ciel, le plafond
    0,48 0,47 0,47 0,46 0,68 0,70 0,38 0,46 0,44
    0,49 0,48 0,48 0,78 0,75 0,73 0,72 0,50 0,44
    0,40 0,44 0,48 0,78 0,79 0,82 0,71 0,81 0,43   ← la station : GARDÉE
    0,38 0,39 0,81 0,76 0,70 0,75 0,72 0,81 0,83
    0,39 0,44 0,47 0,73 0,82 0,75 0,68 0,51 0,78
    0,29 0,25 0,30 0,31 0,33 0,33 0,34 0,37 0,36
    0,14 0,14 0,17 0,19 0,22 0,25 0,30 0,32 0,32
    0,09 0,10 0,09 0,10 0,10 0,12 0,14 0,17 0,15   ← le sol : 0,09
```

La zone laissée à 0,7-0,8 **épouse le contour de la station** — l'arche, la
marquise, la pompe. Autour, tout tombe à 0,4. Et le sol descend en **rampe
continue** de 0,29 à 0,09.

C'est le panneau **Masquage** de Lightroom mobile — l'icône en pointillés
visible dans sa propre capture d'écran, entre les curseurs et la gomme :

- une **sélection du sujet / de l'arrière-plan** (Lightroom mobile la fait en un
  geste, elle détoure la station), avec l'exposition baissée sur l'arrière-plan ;
- plus un **dégradé linéaire** par le bas, qui donne la rampe régulière du sol.

Ce n'est donc pas un vignetage de son preset — ni un vignetage tout court : au
même rayon le sien vaut −1,4 en haut et −3,9 en bas, et un vignetage est
symétrique par construction.

## Ce qui restait, et qui se mesure : une densité

Dans la zone que le masque ne touche pas (rayon < 0,5), il reste un écart qui ne
dépend que du **niveau** : −0,3 à −0,6 diaphragme dans les médians, +0,2 dans les
noirs les plus profonds. **62 645 points.** C'est une courbe, et c'est elle que
porte `powV3` :

`L sortie = 0,840 × L entrée − 4,25`, même famille à deux paramètres que
`powV2` (droite, pied doux, point noir mesuré, pente jamais sous 0,30). Erreur
moyenne **0,85 L\*** sur dix-huit tranches. Plafond à **205** au lieu de 236,
comme `Ambre Nuit 1` (209) et `Ambre Nuit 2` (181).

**Sa couleur est celle de `powV2` au chiffre près** — vérifié dans le smoke, à
niveau de sortie égal, écart maximal **0,24** en a\*b\*. C'est la règle de la
famille : une déclinaison de densité ne corrige pas le style.

| Preset | nuit | brouillard | restaurant |
|---|---|---|---|
| `powV2` | 8,52 | **2,34** | **2,81** |
| `powV3` | **7,39** | 8,58 | 4,58 |

`powV3` gagne sur la nuit et perd ailleurs — c'est ce qu'on attend d'un registre.
Le gain est modeste (8,52 → 7,39) précisément parce que le reste est le masque,
et qu'assombrir tout le cadre corrige le sol en abîmant le centre.

**RÉSERVE, et elle est lourde : une seule photo.** `powV2` est calé sur trois,
`powV3` sur une, et sur sa partie non masquée. C'est assez pour une DENSITÉ — la
question « combien plus sombre » n'a de toute façon qu'une réponse par photo —
ce ne serait pas assez pour une couleur. C'est pourquoi la couleur n'y touche
pas.

## Ce qu'il faudrait vraiment

Un **outil de masquage local**, par photo, dans Vision : sélection du sujet et
dégradé linéaire. C'est ce qu'il a utilisé,
et c'est un geste d'édition, pas un preset. À rapprocher de l'étage de tonalité
adaptatif déjà listé dans `todo.md` : les deux disent la même chose sous deux
angles — une table de couleurs n'a pas de mémoire, et elle n'a pas de carte.

---

# `powV4` — la couleur de la nuit, remesurée sous son masque

`powV3` reprend la couleur de `powV2` et n'en change que la densité. `powV4` va
plus loin : il **remesure la couleur elle-même** sur la seule paire de nuit.

## Il faut d'abord retirer son masque

Mesurer la couleur à travers un assombrissement local, c'est prendre cet
assombrissement pour un virage. La chaîne
(`scripts/ajuster-preset-sur-paire.mjs`) boucle donc :

1. estimer le masque, cellule par cellule, contre un preset de référence ;
2. le ramener à son **plateau** — la zone qu'il n'a pas touchée ;
3. corriger son rendu de cet écart ;
4. ajuster le preset ;
5. re-estimer le masque avec le résultat. Trois tours.

**Et une règle qui compte autant : la couleur ne s'ajuste que là où la
correction reste faible** (un diaphragme au plus). Rebrillanter de quatre
diaphragmes un JPEG quasi noir ne restitue pas sa couleur, ça amplifie son
bruit. Sans cette règle, le mélangeur voulait tourner l'orange de **+32 degrés**
sur la foi de **1 065 blocs** — qui n'étaient que du sol remonté. Avec, il en
reste **44**, et le secteur est écarté faute de matière. **5 645 blocs sur
10 751** servent à la couleur.

## Ce que la mesure donne

| | `powV2` (trois photos) | `powV4` (la nuit) |
|---|---|---|
| courbe | `0,99·L − 6,5` | `0,87·L − 5,0` |
| plafond du blanc | 239 | 210 |
| b\* des bas-tons (L 30) | **+4,67** | **+2,96** |
| chroma du ciel | **0,85** | **0,611** |
| point d'arrivée du ciel | 192° TSL | 192° TSL |

**La trouvaille** : ses bas-tons de nuit sont nettement moins chauds que sur ses
deux photos de jour, et son ciel de nuit est plus sourd. Une scène éclairée aux
LED n'est pas une scène de jour, et son traitement ne la réchauffe pas pareil.
Le *point d'arrivée* du ciel, lui, ne bouge pas — c'est bien le même regard.

Trois secteurs de teinte seulement (22,5 / 37,5 / 82,5° Lab, soit 263 / 175 /
434 blocs) ont assez de matière pour bouger. Les autres gardent `powV2`.

## Le résultat

dE76 médian contre son rendu tel quel, **sur la zone que son masque ne touche
pas** — la seule où un preset puisse être jugé :

| preset | zone jugeable | cadre entier |
|---|---|---|
| **`powV4`** | **3,68** | 7,09 |
| `powV3` | 4,19 | 7,39 |
| `powV2` | 4,68 | 8,52 |
| `powlishermain` | 9,62 | 15,08 |

Sur le **cadre entier**, l'écart se resserre : `powV3` y gagne des points pour
une mauvaise raison — il assombrit tout, donc il se trompe moins là où l'autre a
noirci à la main. Ce n'est pas une meilleure ressemblance, c'est une erreur qui
en compense une autre.

**RÉSERVE, la plus lourde du projet** : une photo, un sujet, une lumière.
`powV2` tient sur trois scènes sans rapport ; `powV4` ne tient que sur celle-là,
et ne doit pas être lu comme une mesure de son style.

---

# `powV6` — le dégradé du bas, premier effet de POSITION mesuré

## Ce qui restait après `powV5`

Écart en diaphragmes entre son rendu et le nôtre, du haut vers le bas du cadre :

```
    +0,05   ← le plafond de la station : juste au centième près
    +1,0    ← la station et la moto : il est plus CLAIR
    -1,1
    -2,5    ← le sol : il est BIEN plus sombre
```

Ce n'est plus une couleur. C'est un **dégradé vertical**.

## Pourquoi le vignetage ne peut pas le faire — mesuré, pas supposé

Le vignetage est **radial** : il assombrirait aussi le haut du cadre, qui est
déjà juste. Le chiffre le dit sans ambiguïté :

| | dE76 médian |
|---|---|
| `powV5` seul | **5,41** |
| `powV5` + vignetage 10 | 5,56 |
| `powV5` + vignetage 20 → 100 | 5,46 → 5,99 |

**Le vignetage empire le rendu à toutes les doses.** Et poser le vignetage sur
une courbe plus claire (`powV4`, qui matche le sujet) ne rattrape pas non plus :
son meilleur réglage donne 5,86, toujours au-dessus de `powV5` seul.

Une **courbe plus contrastée** ne fait pas mieux non plus : une recherche large
sur trois paramètres (pente de 0,40 à 1,60, décalage de −30 à +2, épaule de 0,50
à 1,80) retombe sur **3,08** — exactement le chiffre de `powV5`. **3,08 est le
plancher d'une table de couleurs sur cette image.**

## L'effet ajouté

`applyDegradeBas` dans `canvasUtils.js`, étage 7 bis du renderer. Une rampe
verticale qui part du **milieu du cadre** et descend jusqu'en bas, en lumière
linéaire, **sans** la protection des hautes lumières que porte le vignetage — un
dégradé de Lightroom est un curseur d'exposition posé sur un masque, il
n'épargne rien.

Un seul curseur : **100 = quatre diaphragmes** au bas du cadre. Le réglage de
`powV6` vaut **66**.

Le point de départ de la rampe a été **cherché, pas choisi** :

| départ | meilleure force | dE76 |
|---|---|---|
| 0,40 | ×0,17 | 3,10 |
| **0,50** | **×0,16** | **3,03** |
| 0,55 | ×0,15 | 3,03 |
| 0,65 | ×0,11 | 3,18 |

La courbe est plate entre 0,40 et 0,60 : le milieu du cadre est aussi bon que le
meilleur point. **Un paramètre de moins, et rien de perdu.**

## Un piège attrapé par son propre test

La première version quantifiait le gain en **64 paliers**, comme le fait le
vignetage. Mesure sur un aplat : **4/255** d'écart entre deux lignes voisines —
et **ce chiffre ne baissait pas quand l'image grandissait** (4/255 à 101 lignes
comme à 1 200). Ce n'était donc pas la pente du dégradé, c'était la marche de la
quantification. Une bande, exactement ce que le projet refuse partout ailleurs.

Le gain ne dépend que de la **ligne** : on calcule donc une table par ligne (256
puissances, 2 ms sur 1 200 lignes) et la quantification **disparaît** au lieu
d'être réduite. Après correction : **1/255** à 401 comme à 1 200 lignes.

## Le résultat

Chaîne complète de l'app (LUT + effets spatiaux), sur sa photo de nuit :

| preset | dE76 médian |
|---|---|
| `powV2` | 10,37 |
| `powV4` | 8,94 |
| `powV5` | 5,41 |
| **`powV6`** | **3,03** |

**RÉSERVE** : le dégradé est un geste de **composition**. Il suppose que le bas
du cadre est un premier plan qu'on veut faire taire. Sur une photo dont le sujet
est en bas, il l'efface. C'est le premier preset du projet à porter un effet de
position dont la **forme** comme la **force** sortent d'une mesure —
`powlisher-showcase` en portait un aussi (vignetage 8), mais choisi à l'œil.

---

# `powV7` — les LED rallumées, et un résidu qu'on nomme au lieu de le forcer

Deux défauts restaient à `powV6`, **tous deux vus à l'œil avant d'être
mesurés** — c'est la quatrième fois de la série.

## 1. Les LED

À un niveau d'entrée de 75-85, son image est **22,6 L\* plus claire** que
`powV6`. À 55-65, l'écart n'est que de **1,0**.

| entrée | `powV6` | lui | écart |
|---|---|---|---|
| 55-65 | 30,7 | 31,7 | +1,0 |
| 65-75 | 36,1 | 40,9 | +4,8 |
| **75-85** | **39,0** | **61,6** | **+22,6** |

Un seul endroit de l'échelle, et c'est celui que l'œil regarde. Deux changements
pour y répondre :

**a) La courbe s'ajuste désormais sur la correspondance de NIVEAUX**, chaque
tranche comptant pareil (pondérée par la racine de son effectif), et non plus
sur la médiane du dE de l'image. Ces LED pèsent **3,5 % des blocs** : une médiane
ne les voit pas, et l'œil ne voit qu'elles.

> **La médiane d'une image n'est pas le regard de celui qui la regarde.**

**b) Un paramètre de plus** : un relevé des hautes lumières qui n'agit
qu'au-dessus d'un seuil (0,75 à partir de L 62, sur 38 L\* de large). Une épaule
globale relève tout, elle ne sait pas faire ce virage-là.

### Et une borne qui a servi

Laissé libre, ce relevé montait à une pente de **3,62 L\* par L\*** et ramenait
l'écart des LED à **+4,1**. Mais il faisait **échouer le test « amplification
dans un voile »** du projet : **3,71× contre 3,63 autorisé**. Une pente de p
amplifie le bruit de p.

Pente bornée à 2,2 → amplification **2,39×** (sous les 3,03× de `powlisher`), et
l'écart des LED s'arrête à **+9,3** au lieu de +4,1.

**Le chiffre parfait n'a pas gagné. Troisième fois dans cette série.**

## 2. Le sol — non corrigé, et voici pourquoi

| | a\* | b\* | chroma | teinte |
|---|---|---|---|---|
| lui | −1,99 | +2,76 | 3,4 | 126° |
| nous | −0,37 | +3,40 | 3,7 | 97° |

À chroma quasi égale, c'est une différence de **teinte de 29°** : le sien plus
vert, le nôtre plus jaune. Deux raisons, mesurées :

- **le mélangeur ne le voit pas** : à chroma 3,7 le garde-fou du projet
  (smoothstep 4 → 11) est à zéro, et l'ouvrir réveillerait la teinte dans les
  voiles — le trait de contour que trois presets ont déjà payé en 2026-08-12 ;
- **le virage est une fonction du NIVEAU** : corriger le sol veut dire corriger
  toute sa tranche de luminosité, et le reste de cette tranche ne le demande
  pas. Deux passes ont été tentées pour l'y forcer — compenser l'atténuation du
  dégradé (le virage se pose **avant** lui, qui le divise ensuite par six) et
  exclure les blocs quasi éteints (résidu nul par construction, ils noyaient la
  médiane de leur tranche). Le b\* est passé de 3,66 à 3,40 et s'est arrêté là.

**Cette différence-là est encore positionnelle** : elle appartient à son masque,
pas à une table de couleurs. 1,7 en Lab sur une zone sombre — c'est le résidu, et
il est nommé plutôt que forcé.

## Un garde-fou a servi aussi

L'ajustement voulait un dégradé de **82**, or le plafond du mode sûr est **80**.
Un preset qui demande plus que le plafond se fait ramener **en silence** par le
moteur : il n'annoncerait pas ce qu'il rend. Le smoke l'a attrapé. Coût nul — sur
les trois tours la force est passée par 76, 82 et 84, la courbe est plate là.

## Le résultat

dE76 médian contre son rendu, chaîne complète (le vérificateur rejoue le
dégradé) :

| preset | nuit | brouillard | restaurant |
|---|---|---|---|
| rien | 17,24 | 7,91 | 10,41 |
| `powV2` | 8,52 | **2,34** | **2,81** |
| `powV5` | 2,92 | 23,17 | 21,57 |
| `powV6` | 2,48 | 26,12 | 24,58 |
| **`powV7`** | **2,42** | 5,18 | 17,64 |

**RÉSERVE** : le relevé des hautes lumières éclaircit **tout** ce qui dépasse
L 62. En plein jour, il brûle. C'est le bout de la série — une photo, un sujet,
une lumière.

---

# `powV8` — le rouge, le sol, et le curseur qui manquait au mélangeur

Deux écarts restaient à `powV7`, **vus à l'œil puis mesurés**. Aucun ne se
corrigeait avec les leviers existants.

## 1. Son rouge est plus vif

Sur **656 blocs** de la moto et de l'élément Synergy (chroma d'entrée > 25,
teinte Lab < 50) :

| | L | chroma |
|---|---|---|
| son rendu | **19,0** | **46,3** |
| `powV7` | 13,2 | 39,6 |

**L'écart est d'abord une affaire de lumière**, pas de saturation.

### Et ce n'est pas la courbe — le secteur témoin le prouve

Mesuré au même moment sur **2 799 blocs**, son ciel bleu est à **0,99** fois
notre luminance. Une courbe aurait touché les deux.

> **Un écart de lumière sur une seule teinte n'est pas une erreur de courbe.**
> Toujours mesurer un secteur témoin avant de conclure à un problème global.

C'est donc une **luminance par teinte** — le troisième curseur du mélangeur de
Lightroom, que le nôtre n'avait pas. Ajouté à `melangeurLab` : chaque ancre
porte maintenant `[rotation, chroma, LUMINANCE]`, et les tables à deux valeurs
valent 1 par défaut — **aucun preset existant ne bouge**, un test le vérifie.
Sous le même garde-fou de chroma que le reste : un pixel sans teinte fiable ne
change pas de niveau, sinon la règle trace un contour.

Mesure retenue : **×1,57** sur les rouges et oranges à forte chroma.
Résultat : **L 18,3 / chroma 47,9** contre ses 19,0 / 46,3.

## 2. Son sol est gris-bleu, le nôtre tirait au marron

`powV7` le laissait à la teinte 105 quand la sienne est à 127. Ici le virage se
mesure sur la sortie **finale** — dégradé compris — contre son image telle
quelle, et par niveau de **sortie**. Ce qu'il demandait était net :

| L sortie | Δa\* | Δb\* | blocs |
|---|---|---|---|
| 0-4 | **−1,02** | +1,05 | 1 568 |
| 4-8 | −0,73 | −0,09 | 1 088 |
| 8-12 | −0,40 | −0,47 | 996 |

### Un arbitrage à l'intérieur, et l'invariant a gagné

Les valeurs brutes de l'ajustement mettaient la première ancre du virage à
(−1,96 / +2,00), ce qui faisait ressortir un **noir pur à 1,34/255** au lieu de
0. L'invariant du projet a gagné : ancre ramenée à 0.

Mais le fondu vers zéro reprenait la moitié du gain (sol à 110 au lieu de 120).
L'ancre L=5 a donc été **résolue** sous la contrainte : **−5,90** au lieu de
−2,90. Ce n'est pas un chiffre choisi, c'est la solution d'une équation à une
inconnue. Coût : **0,03 de dE76**.

Résultat : sol à **a\* −1,68** contre ses −1,63.

## Le résultat

| preset | nuit | brouillard | restaurant |
|---|---|---|---|
| `powV7` | **2,42** | 5,18 | 17,64 |
| `powV8` | 2,45 | 5,17 | **13,88** |

Le dE76 de la nuit bouge à peine (2,42 → 2,45), et **c'est le point** : ce lot ne
cherchait pas à baisser une moyenne, il corrigeait deux choses que l'œil voit et
qu'une moyenne noie. Le restaurant gagne 3,8 au passage — la correction des
ombres lui profite.

**RÉSERVE** : la luminance ×1,57 sur les rouges est le levier le plus fort de la
famille, et le a\* −3,2 des ombres se verra sur toute autre photo. `powV8`
reproduit **une** image.

---

# `powV9` — le sol dégrisé, et deux erreurs de mesure que j'avais faites

`powV8` annonçait le sol « calé » et il ne l'était pas. Son sol est gris-bleu
(teinte Lab **122**), le nôtre restait à **90** — marron, et l'œil le voyait tout
de suite. **Les deux causes sont des erreurs de mesure, pas de réglage.**

## Erreur 1 — un sous-ensemble qui n'en était pas un

Toutes les mesures de couleur du projet passent par des **blocs plats à faible
chroma**, pour ne pas compter les contours. Sur du béton **mouillé**, ce filtre
ne garde que les flaques lisses et jette tout le reste — c'est-à-dire
l'essentiel de ce que l'œil voit.

| mesure du sol | a\* | verdict |
|---|---|---|
| sur les blocs plats | −1,68 (lui : −1,63) | « calé » |
| **sur tous les pixels** | **0,00** (lui : −1,99) | faux |

**Le filtre qui protège d'un biais en fabriquait un autre.**

## Erreur 2 — la correction indexée au mauvais niveau

Le virage se pose **avant** le dégradé du bas, et le dégradé divise ensuite la
luminosité du sol par trois. En attribuant la correction au niveau mesuré **à
l'arrivée** (L 6,5) au lieu de celui où elle s'applique (**L 11,5**), elle
partait dans la mauvaise ancre. **Trois tentatives ont échoué sur ce seul
point.**

## Ce que `powV9` fait

Le **virage**, réajusté sur tous les pixels et indexé au bon niveau, monte le sol
de 90 à **102** — puis **plafonne**. La raison est structurelle : à ce niveau, le
sol partage son ancre avec le **ciel**, qui lui est déjà juste. *Un virage est
indexé par le niveau ; il ne sait pas séparer deux teintes qui partagent un
niveau.*

Le **mélangeur**, lui indexé par la teinte, finit le travail sur les deux
secteurs chauds : sol à **123** contre sa cible **122**.

## L'ordre des leviers change leur valeur

C'est l'enseignement du lot :

| mélangeur résolu… | rotation demandée |
|---|---|
| **avant** le virage | +40° et +55° |
| **après** le virage | **+18,8° et +33,5°** |

Et les premières valeurs sont **vides de sens** : le garde-fou de chroma
(smoothstep 4 → 11) n'en laisse passer qu'un sixième à la chroma du sol, mais les
appliquerait **en entier** à un jaune franc.

Résolu dans le bon ordre, **le garde-fou du projet n'a pas eu à bouger d'un
pouce** : l'amplification dans un voile reste à 2,39× pour une borne à 3,63×.

> **Être tenté de baisser un garde-fou est souvent le signe qu'on corrige au
> mauvais endroit.**

## Le résultat

| preset | nuit |
|---|---|
| rien | 17,24 |
| `powV2` | 8,52 |
| `powV5` | 2,92 |
| `powV7` | 2,42 |
| `powV8` | 2,45 |
| **`powV9`** | **2,12** |

Le rouge et le ciel sont vérifiés **inchangés** par test — sans quoi on ne
saurait pas si la correction a porté sur le sol ou sur toute l'image.

**RÉSERVE**, plus lourde que celle de `powV8` : ses deux secteurs chauds sont
tournés de 19 à 33° et désaturés de moitié. Sur un béton chaud à forte chroma la
rotation mesurée vaut **+46°** — sur une photo où l'ocre ou le jaune est le
sujet (sable, bois, mur), ce preset le **verdit**.

---

# `powV10` — le blanc des enseignes et les « fissures » : une seule cause

Deux défauts de `powV9`, vus à l'œil sur les enseignes de la station : le blanc
des lettres virait au **gris**, et autour du panneau ESSO apparaissaient des
**fissures** — de la matière absente de son rendu.

**Les deux ont la même cause**, et une seule mesure la montre. Sur les 13 247
pixels clairs de la photo (L d'entrée > 72) :

| | L médian | énergie de haute fréquence |
|---|---|---|
| la source | 76,5 | 6,82 |
| son rendu | 61,0 | 8,14 |
| `powV9` | **52,9** | **9,43** |
| **`powV10`** | **57,5** | **7,67** |

`powV9` posait ses blancs **8 L\* trop bas** *et* amplifiait le détail **1,38×**
la source quand lui ne l'amplifie que 1,19×. Les deux sortent de la même ligne
de sa courbe : son relevé des hautes lumières arrivait **trop tard et trop vite**
— pente 1,83 à L 75-80.

> **Une pente de p amplifie le bruit de p**, et le bruit d'un JPEG de capture
> d'écran autour d'une enseigne blanche, c'est exactement une fissure.

## L'erreur de mesure derrière — la quatrième de la même famille

La correspondance de niveaux sur laquelle la courbe s'ajuste était comparée à son
image **telle quelle, dégradé compris**. Or le dégradé est **notre** étage : il
fallait le retirer de sa cible avant d'ajuster la courbe, sinon la courbe essaie
de rattraper un assombrissement qu'on applique soi-même ensuite — et pour ça elle
choisit une épaule raide.

**Une fois la cible corrigée, l'optimum n'a plus besoin d'être raide** : sa pente
maximale tombe à **1,52 toute seule**, la borne de 2,2 ne mord même plus. La
correspondance de niveaux est meilleure (0,88 L\* contre 0,97), les blancs
montent, et l'amplification disparaît.

> **Une courbe trop raide est souvent le symptôme d'une cible mal préparée, pas
> d'un choix de style.**

## Ce qui reste

3,5 L\* sur les blancs. C'est encore son masque : il éclaircit le sujet, et les
enseignes en font partie.

Le dE76 médian passe de 2,12 à 2,37 — **la troisième fois de la série qu'une
médiane bouge dans le mauvais sens pendant que l'image s'améliore**. Les
enseignes pèsent 3,5 % des pixels, et l'œil ne regarde qu'elles.

Seule la **courbe** change : virage, mélangeur et règle du ciel sont ceux de
`powV9` au chiffre près, vérifié par test.
