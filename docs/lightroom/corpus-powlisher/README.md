# Corpus de référence de `powlisher`

Les photos dont le preset `powlisher` a été déduit — **36** après tri. Elles ne sont pas dans
le dépôt — seul ce README l'est. Pour les récupérer :

```bash
node scripts/fetch-powlisher-corpus.mjs
```

Elles atterrissent ici même, à côté de ce fichier, avec un `manifeste.json`.

## Pourquoi elles ne sont pas versionnées

**Ce ne sont pas nos photos.** Ce sont celles de `@powl_d`, publiques sur X. Les
mesurer pour comprendre un rendu est une chose ; les embarquer dans un dépôt
destiné à devenir un produit public en serait une autre. On garde donc la
**recette** — les identifiants de tweets, publics, et la façon de les lire — et
chacun refait le téléchargement en local.

Le dossier est dans `.gitignore`, à l'exception de ce fichier.

## Ce que `powlisher` doit à ce corpus

Le preset n'a **pas** été copié : aucun `.xmp` n'était disponible. Il a été
**reconstruit par mesure** sur ces images, puis vérifié par un test qui rejoue
les cibles trouvées ici (`npm run test:vision-preset`).

Les trois signatures qui en sortent, et qui définissent le preset :

| Signature | Mesure sur le corpus | Cible du preset |
|---|---|---|
| **Le ciel atterrit toujours au même endroit** | **190–199°** sur six photos (un ciel neutre est à 210–225°) | `powlisher` 178–196°, `powlisher-ciel` 190–199° |
| **Verts olive** | feuillage à 84–107°, saturation ≤ 0,35 | 85–105° |
| **Peau préservée** | 26–36°, jamais tirée vers l'orange | 27–36° |
| **Hautes lumières crème** | sur la moitié du corpus, le point blanc ne monte **jamais** à 255 | pas d'écrêtage |

## Les images, 36 au 2026-08-12

Numérotation **figée** : les numéros 1 à 27 restent sur le corpus d'origine,
parce que [l'audit](../../audit-preset-powlisher-2026-08-11.md) cite les photos
par leur numéro (« img12 (hélico) », « img16 (Marrakech) »). Les ajouts partent
donc de 28. Le script verrouille le compte attendu par tweet et prévient si un
tweet ne rend plus le même nombre d'images.

| # | Sujet | Apport |
|---|---|---|
| 01–03 | portraits extérieurs, rivière, rue | peau, verts |
| 05–07 | Lamborghini jaune, garage, quai | jaune saturé, noirs denses |
| 08, 10 | portrait urbain de nuit, voiture dans le brouillard | tons froids délavés |
| 11–12 | plage au coucher, **hélico Biarritz** | peau 33°, feuillage 84°, ciel 188° |
| 13 | hublot d'avion sur Paris | blanc plafonné à **181**, aucun pixel ≥ 255 |
| 14–15 | intérieurs WeWork New York | img14 : seule photo à écrêter (0,43 % ≥ 255) |
| 16–19 | Marrakech | **le vrai bleu du corpus** : img16 ciel 189° sur 32 %, img18 ciel 191° sur 42 % |
| 28–31 | Shanghai de nuit, gratte-ciel | architecture, néons, contre-jour |
| 32–33 | Shanghai depuis la tour | grande surface de ciel, mais **blanc de brume** |
| 34 | Ducati rouge | rouge saturé, asphalte, horizon |
| 35–38 | **Biarritz** : Porsche, terrasse sur mer, côte, plage vue d'en haut | **le ciel bleu et la mer** |
| 39–42 | fin de journée : foule au coucher, littoral, bar, table | lumière rasante, peau au soleil couchant |
| 43–46 | extérieur : plage, escalier sur la côte, piscine, coucher sur mer | turquoise, contre-jour, soleil dans le cadre |

Le sous-dossier **`ciel/`** rassemble à la main les photos où le ciel occupe
assez de cadre pour être mesuré (12, 13, 16, 18, 35, 36, 37, 39, 46). C'est ce
tas-là qui porte la cible du ciel, et les scripts le regardent en priorité.

Écartées à la main : **04** et **09** (portraits studio/intérieur), et **20–27**
(captures d'écran de Lightroom mobile + station-service de nuit — elles
montraient d'où vient le look, pas une couleur à mesurer). Le script reproduit ce
tri ; `--tout` les récupère quand même.

### Le ciel, comblé le 2026-08-12

| | avant | après |
|---|---|---|
| photos | 24 | **36** |
| avec du ciel (> 12 % du cadre) | 5 | **10** |
| **avec du bleu franc** (> 8 %) | 2 | **7** |

Et ces ajouts ont fait mieux que combler un trou : ils ont **validé le preset de
façon indépendante**. La cible « le ciel atterrit entre 178 et 196° » avait été
déduite de **deux** photos (img16, img18). Les nouvelles n'ont servi à rien
construire, et pourtant :

| photo | teinte du ciel |
|---|---|
| img35 (Porsche) | 189,0° ✔ |
| img36 (terrasse sur mer) | 195,8° ✔ |
| img37 (côte de Biarritz) | 192,9° ✔ |
| img40 (littoral) | 193,5° ✔ |
| img45 (piscine) | 175,0° — c'est le turquoise de l'eau qui domine, pas le ciel |

Moyenne sur les 7 photos à ciel mesurable : **189,7°**, étendue 175–196°. La
signature centrale de `powlisher` tient donc sur 7 photos au lieu de 2.

### La paire avant/après (ex-img47/48) — ÉCARTÉE le 2026-08-12

Il avait publié sa photo **brute** à côté de son **édit final**. C'était, sur le
papier, la pièce maîtresse : le seul endroit où on connaissait son entrée ET sa
sortie sur la même image.

**Elle ne vaut rien comme mesure, et elle a coûté cher.** Il dit lui-même avoir
fait passer l'image par une **IA générative** pour « booster la résolution et le
traitement ». Ce qui sépare les deux images n'est donc pas sa colorimétrie :
c'est sa colorimétrie **plus ce qu'une IA a inventé**, qui est spatial et hors de
portée de toute table de couleurs. Le signe était là dès le départ : pour une
même couleur d'entrée, sa sortie variait de **± 22,3/255**, contre 1,9 à 4,8 sur
une vraie paire Lightroom.

Trois presets ont été construits en partie sur elle. Ils ont tous été supprimés.
La règle : **on ne cale pas un preset sur une source dont on ne sait pas ce
qu'elle mesure.** Les photos et les chiffres qui en venaient ont été retirés de
ce document, du script de récupération et du script de mesure — pour qu'ils ne
reviennent pas par la fenêtre à la prochaine session.

Ce qui la remplace : **nos propres avant/après**, sur nos photos, dont on connaît
l'origine.

```bash
node scripts/mesure-ciel-powlisher.mjs --photo <notre-photo.jpg>
```

### Où son ciel ATTERRIT — la mesure qui porte le preset

C'est le résultat le plus utile du corpus, et il est simple : **tous ses ciels
francs finissent dans une fenêtre étroite**, quelle que soit la photo.

| photo | teinte | chroma | part partie au blanc |
|---|---|---|---|
| img16 (Marrakech) | 190,5° | 0,32 | 1 % |
| img18 (Marrakech) | 195,0° | 0,39 | 17 % |
| img35 (Porsche) | 189,8° | 0,39 | 11 % |
| img36 (terrasse sur mer) | 198,1° | 0,49 | 0 % |
| img37 (côte de Biarritz) | 193,6° | 0,19 | 20 % |
| img40 (littoral) | 193,8° | 0,39 | 15 % |

**Fenêtre : 190–199°.** Un ciel voilé, lui, part largement au blanc (img32 :
95 % de la zone claire sous chroma 0,10) — il ne cherche pas à le rendre bleu.

```bash
node scripts/mesure-ciel-powlisher.mjs                    # où son ciel atterrit
node scripts/mesure-ciel-powlisher.mjs --photo <photo>    # une de NOS photos
```

### Ce que cette fenêtre dit, et que `powlisher` V1 ratait

Ses entrées, elles, n'ont aucune raison d'être groupées : un ciel de Marrakech,
un ciel de Biarritz et un ciel de zénith ne partent pas de la même couleur. Des
entrées dispersées, des sorties groupées — **ça ne décrit pas une rotation, ça
décrit une convergence.**

V1 faisait l'autre chose : il retirait un **angle fixe** (−38° au plus fort du
mélangeur). La preuve la plus parlante s'obtient en appliquant le preset à **ses
propres photos**, qui sont déjà ses édits finis, donc déjà à la bonne couleur —
un preset juste ne devrait presque pas les bouger :

| appliqué à ses photos | img16 | img18 | img35 | img36 | img37 | moyenne |
|---|---|---|---|---|---|---|
| `powlisher` V1 | −21,3 | −21,5 | −17,9 | −21,4 | −31,1 | **22,6°** |
| `powlisher-ciel` | −6,1 | −4,1 | −1,8 | −6,1 | −9,4 | **5,5°** |

Et sur une photo à nous (crique méditerranéenne, ciel d'entrée à **214,2°**,
chroma 0,58) : V1 la pose à **185,7°**, sous sa propre fenêtre, dans un menthe
qu'il ne produit sur aucune de ses photos. `powlisher-ciel` la pose à **195,4°**.

### Le piège qui a coûté trois presets

Une première tentative (`powlisher-v2`, supprimée) déclenchait sa règle sur la
**teinte** d'un pixel sans vérifier que cette teinte veuille dire quelque chose.
Or dans un voile quasi blanc, la teinte est du **bruit** : deux pixels que l'œil
voit identiques peuvent être à 40° l'un de l'autre. La règle basculait donc d'un
pixel à l'autre au milieu d'un dégradé lisse et **dessinait un trait de contour
en plein ciel**.

Ça ne se voyait dans **aucune moyenne** — seulement à l'écran. D'où la mesure qui
le rend visible, et le test qui la garde (`npm run test:vision-preset`) :
l'amplification, soit l'écart de sortie divisé par l'écart d'entrée, mesurée sur
des pixels quasi neutres dont la teinte bruite.

| preset | amplification dans un voile |
|---|---|
| `powlisher` | 3,03× (n'a jamais montré de trait) |
| la version supprimée | **7,32×** (trait visible à l'écran) |
| `powlisher-ciel` | 3,03× — n'ajoute rien |

**La règle à retenir** : toute règle qui dépend de la teinte doit s'éteindre
quand le pixel n'en a plus.

### Ne jamais conclure d'une seule source

On s'est fait avoir deux fois, en sens opposés. Le corpus seul disait « il tire
les bleus pâles PLUS vers le cyan » (182,5° contre 194,3°) : **biais de
sélection**, on ne mesurait que les pixels restés bleus, alors que ceux qu'il
désature jusqu'au blanc — l'essentiel d'un ciel voilé — sortaient de la mesure.
C'est pour ça que `mesure-ciel-powlisher.mjs` affiche la part partie au blanc
**à côté** de la teinte. Et la paire avant/après, elle, disait l'inverse — mais
elle était passée par une IA (voir plus haut).

**Ce qui vaudrait le plus cher maintenant** : d'autres avant/après **à nous**,
sur des sujets différents (portrait, nuit, contre-jour). C'est la seule vérité
terrain dont on maîtrise l'origine.

**Ce qui manque encore** : rien de criant côté ciel. Le corpus reste en revanche
pauvre en **portrait rapproché** (la peau n'est mesurée que sur quelques
images) et en **scènes de nuit colorées** hors Shanghai.

## Deux choses qui manquent, et pourquoi

**Les 50 frames vidéo.** Le corpus d'origine comprenait 50 images extraites d'une
vidéo où il montre ses réglages Lightroom à l'écran (tweet
`2069450546025754646`, une image toutes les 0,25 s). Elles ont servi à **lire ses
curseurs**, pas à mesurer des couleurs — le chrome sombre de l'interface fausse
toute mesure globale. Le script ne les récupère pas : il faudrait rejouer une
extraction vidéo, et elles n'apportent rien à la colorimétrie. Ce qu'on y a lu
est retranscrit dans l'audit (Contraste −30, Hautes lumières −30, HDR et
corrections d'objectif désactivés).

**Le `.xmp` de son preset.** Il ne l'a jamais publié. C'est toute la raison
d'être de cette reconstruction par mesure — et, plus tard, de la capture par Hald
CLUT documentée dans [1-procedure.md](../1-procedure.md), qui elle donne un
résultat *exact* quand on a le preset sous la main.

## Filiation

Dans le tweet `1988657267739406751`, il nomme son preset : Lightroom
**« Cinéma 2 »**. C'est le pack Adobe dont viennent CN11 et CN17, capturés depuis
Lightroom et documentés dans [3-cn11-cn17-mesures.md](../3-cn11-cn17-mesures.md).

Attention à ne pas en conclure trop vite : les photos ci-dessus datent de
janvier–mars 2026, et **le ciel teal et les verts olive sont à lui**, pas au
pack. Un preset Adobe est un point de départ qu'il a retravaillé. C'est
exactement pourquoi `powlisher` et CN11 ne rendent pas pareil, alors que l'un
descend de l'autre.
