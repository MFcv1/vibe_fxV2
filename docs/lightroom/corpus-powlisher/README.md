# Corpus de référence de `powlisher`

Les **27 photos** dont le preset `powlisher` a été déduit. Elles ne sont pas dans
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

## Les images, une par une

Numérotation **identique** à celle de
[l'audit](../../audit-preset-powlisher-2026-08-11.md), qui cite les photos par
leur numéro. Le script la verrouille et prévient si un tweet ne rend plus le même
nombre d'images.

| # | Sujet | Rôle | Mesures de l'audit |
|---|---|---|---|
| 01–04 | Sony A7R3 / nostalgie | référence | img01 (pont) : peau 35,8° · feuillage 105,9° · ciel 175,1° · blanc plafonné à 224 |
| 05–07 | dont la Lamborghini | référence | img05 : blanc plafonné à 205 · img07 : ciel **194,2°** sur 38 % du cadre |
| 08–10 | portraits / NYC Vessel | référence | img03 : ciel 181,0° |
| 11–12 | dont hélico Biarritz | référence | img11 : feuillage **85,8° S0,18** · img12 : peau 33,2° · feuillage 84,4° · ciel 188,4° |
| 13 | prise d'avion (Paris, iPhone 17 Pro) | référence | blanc plafonné à **181**, aucun pixel ≥ 255 |
| 14–15 | intérieur WeWork New York | référence | img14 : seule photo à écrêter franchement (0,43 % ≥ 255) |
| 16–19 | Marrakech (via le tweet cité) | référence | img16 : ciel **189,0°** sur 32 % du cadre · img18 : ciel 191,0° sur 42 % · img19 : ciel 183,9° |
| 20–27 | il nomme son preset : Lightroom « Cinéma 2 » | **filiation** | pas mesurées — elles servent uniquement à établir d'où vient le look |

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
