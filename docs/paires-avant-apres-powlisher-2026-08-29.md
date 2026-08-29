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
