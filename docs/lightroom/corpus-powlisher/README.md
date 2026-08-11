# Corpus de référence de `powlisher`

Les photos dont le preset `powlisher` a été déduit — **24** après tri. Elles ne sont pas dans
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

## Les images, 24 au 2026-08-12

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

Écartées à la main : **04** et **09** (portraits studio/intérieur), et **20–27**
(captures d'écran de Lightroom mobile + station-service de nuit — elles
montraient d'où vient le look, pas une couleur à mesurer). Le script reproduit ce
tri ; `--tout` les récupère quand même.

### Le trou qui reste, mesuré

| | photos |
|---|---|
| avec du ciel (> 12 % du cadre) | 5 / 24 |
| **avec du bleu franc** (> 8 % du cadre) | **2 / 24** — img16 et img18 |

C'est le point faible du corpus, et il est structurel : la signature de
`powlisher` est un décalage du **bleu** vers le teal (178–196°), or elle ne
s'exprime que sur du bleu **saturé**. Les ciels blancs de brume de Shanghai
apportent de la surface, pas de la matière à mesurer.

**Ce qu'il faudrait** : ses photos de Biarritz, de plage, de mer, ou n'importe
quel extérieur plein soleil. Tant qu'on n'en a pas, tout réglage du ciel repose
sur deux photos, et il faut le dire au lieu de le maquiller.

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
