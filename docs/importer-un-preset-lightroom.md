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

### 1. Générer la mire

```bash
npm run preset:mire
```

Écrit `presets-lightroom/hald-clut-neutre-niveau8.png` (512×512, 262 144
couleurs) et un `LISEZ-MOI.md`. Le dossier est ignoré par git.

L'image ressemble à un damier bizarre. C'est normal : ce n'est pas une photo.

### 2. Dans Lightroom

1. Importer la mire.
2. Lui appliquer le preset à capturer — **et rien d'autre**. Pas de recadrage,
   pas de correction d'objectif, pas de réglage manuel par-dessus.
3. Exporter en **PNG**, **taille d'origine** (512×512), sans netteté de sortie,
   sans filigrane, **sans redimensionnement**.

> Le redimensionnement est le seul vrai piège : il mélange des couleurs voisines
> et rend la table fausse. L'import le détecte et refuse le fichier au lieu de
> produire un preset silencieusement faux.

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
`--force` (écraser un preset existant).

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
