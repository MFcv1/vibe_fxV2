# Corpus de référence de `powlisher`

Les photos dont le preset `powlisher` a été déduit — **38** après tri. Elles ne sont pas dans
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
| **Le ciel n'est jamais bleu** | atterrit entre **178° et 194°** (un ciel neutre est à 210–225°) | 178–196° |
| **Verts olive** | feuillage à 84–107°, saturation ≤ 0,35 | 85–105° |
| **Peau préservée** | 26–36°, jamais tirée vers l'orange | 27–36° |
| **Hautes lumières crème** | sur la moitié du corpus, le point blanc ne monte **jamais** à 255 | pas d'écrêtage |

## Les images, 38 au 2026-08-12

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
| **47–48** | **PAIRE avant/après** : sa photo brute d'iPhone, puis son édit final | **la pièce maîtresse** — voir ci-dessous |

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

### La paire avant/après (img47 → img48), et ce qu'elle révèle

Il a publié sa photo **brute** à côté de son **édit final**. On connaît donc son
entrée ET sa sortie sur la même image — la seule façon de mesurer ce qu'il fait,
au lieu de le déduire d'une photo finie.

| ciel | teinte | saturation |
|---|---|---|
| son avant (brut iPhone) | 211,0° | 0,20 |
| **son après** | **207,6°** | **0,11** |
| notre `powlisher` | **172,3°** | 0,15 |

**Sur un ciel pâle et couvert, il ne fait presque pas de teal** : −3° de teinte,
et il **désature** (0,20 → 0,11). Nous décalons de −39°.

Cause identifiée dans `powlisherTransform` : la pondération est
`smoothstep(0, 0.12, s)`. Au-delà de s = 0,12, le décalage s'applique **à
fond** — un ciel pâle d'hiver (s = 0,20) reçoit donc exactement le même −39°
qu'un ciel franc de Biarritz (s = 0,45). C'est le premier correctif d'un
`powlisher` V2, et il est vérifiable sur cette paire.

**Ce qui vaudrait le plus cher maintenant** : d'autres paires avant/après. C'est
la seule vérité terrain sur son traitement.

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
