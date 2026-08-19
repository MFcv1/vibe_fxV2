# Audit de fiabilité des réglages avancés face à Lightroom — 2026-08-19

**Pourquoi cet audit.** Avant d'importer de nouveaux presets, une question :
quand un preset Lightroom dit « Texture +30, Clarté −20, Voile +15 », est-ce que
notre rendu fait la même chose que le sien ? Tout a été **remesuré sur les vrais
exports Lightroom** de `~/Desktop/vibefx-lightroom/`, en repassant les mires dans
le **vrai moteur** (Chromium, `renderStudio`), sans faire confiance aux chiffres
déjà écrits dans les docs.

Méthode : chaque côté est comparé à **sa propre référence** (Lightroom à son
export « sans rien », nous à notre rendu neutre), donc ce qu'on lit est bien
l'effet du réglage et pas un décalage d'encodage. Contrôle : l'export « sans
rien » de Lightroom est à **0,00/255** de la mire d'origine — l'instrument ne
ment pas.

---

## 1. Ce qui est fiable, et à quel point

| Réglage | Valeurs remesurées | Écart nous ↔ Lightroom | Verdict |
|---|---|---|---|
| **Grain** | 15 · 50 · 100 | ×1,00 sur gris, peau, ciel, feuillage, béton | **fiable** |
| **Vignetage** | −50 · −100 | 2,45 et 2,62 /255 de moyenne | **fiable** |
| **Texture +** | +50 · +100 | ≤ 1 % sur les trois échelles | **fiable** |
| **Texture −** | −50 · −100 | ≤ 1,3 % | **fiable** |
| **Clarté +** | +50 · +100 | ≤ 1 % à 50 · +4 à 5 % à 100 | **fiable** |
| **Netteté** | 40 · 150 | +5,3 % à 40 · +10 % à 150 (détail fin) | **fiable à 40** |
| **Couleur (LUT)** | photo réelle, `cn17` | 1,95/255, 85,6 % de l'effet | **fiable** |

Détail utile :

- **Grain.** Écart-type mesuré aplat par aplat, aux trois valeurs de curseur :
  identique au 1 % près partout où un grain se juge. Reste le résidu déjà connu :
  sur des **primaires très saturées**, Lightroom donne 1,1 à 1,46× notre valeur
  (il ajoute son bruit avant une transformation d'espace). Sur la mire entière,
  qui est pleine de primaires, ça fait une moyenne à ×1,08 — sur de la matière
  photographique, ×1,00.
- **Vignetage.** 2,45/255 à −50, 2,62/255 à −100 ; force globale 25,6 contre
  24,8 et 38,8 contre 41,4. Le 99ᵉ centile monte à 28 à −50 : l'écart est
  localisé (la bande claire), pas étalé.
- **Netteté 40** — la valeur qui compte, puisque c'est celle que Lightroom pose
  par défaut sur tout preset : +5,3 % sur le détail fin, négligeable ailleurs.

---

## 2. Les trous — par ordre d'importance pour un import

### 2.1 La clarté NÉGATIVE est fausse, et personne ne l'avait mesurée

> ✅ **CORRIGÉ le jour même.** Loi de puissance `0,01409 × N^0,777` posée dans
> `applyClarity`, mesurée après coup : **0,707 à −50** (lui 0,695–0,723) et
> **0,494 à −100** (lui 0,476–0,526). Le positif est inchangé (contrôle :
> 1,496 / 1,498 / 1,500). Bornes sûres ouvertes à −30, ambiances converties.
> Résidu : notre filtre à un seul rayon est plat, le sien mord moins sur le très
> large — jusqu'à 6 % d'écart sur le réseau de 64 px à −100.

Ce qui suit décrit l'état **avant** la correction.

La clarté n'avait été calée que du **côté positif**. Le négatif est le seul
réglage de matière dont la loi n'a jamais été vérifiée, et il ne tient pas :

| Curseur | amplification du détail, Lightroom | **nous** |
|---|---|---|
| −25 (plafond du panneau) | *(pas d'export ; ~0,84 par interpolation)* | **0,750** |
| −50 | 0,70 | **0,502** |
| −100 | 0,48 | **0,012** |

À −50, Lightroom enlève 30 % du détail et nous en enlevons 50 : **1,66× trop
adouci**. À −100 notre image **devient le flou pur** — il ne reste plus rien.

**Cause, lue dans le code** ([canvasUtils.js](../../src/features/vibefx-studio/utils/canvasUtils.js),
`applyClarity`) : le dosage est un mélange linéaire, `amount = clarity / 100`.
À −100, `pixel + (pixel − flou) × (−1) = flou`. Le sien **sature**, exactement
comme sa texture négative — qui, elle, a été calibrée en `N^0,733` le 2026-08-17.
La clarté a la même maladie que la texture avait, et le même remède existe déjà.

**C'est atteignable par l'utilisateur** : le mode créatif de l'écran Vision ouvre
les bornes libres (clarté −100), et l'import recopie tel quel un `Clarity2012`
négatif d'un `.xmp`.

### 2.2 Le voile (Correction du voile) n'est pas calibré du tout

C'était déjà écrit ; le voici chiffré. Sur la mire D, à 50 :

- écart nous ↔ Lightroom : **11,76/255 de moyenne**, médiane 8, 90ᵉ centile 29 ;
- force de l'effet : **33,2** chez nous contre **28,2** chez lui (+18 % trop
  fort), et surtout pas répartie pareil sur les tons ;
- sa loi n'est pas linéaire : 28,2 à 50 et **71,3 à 100** (×2,5 pour ×2).

Sur l'échelle de lecture du projet (≤ 2 invisible, > 10 « ce n'est plus le même
rendu »), **11,76 est hors tolérance**. Un preset avec un voile marqué ne rendra
pas comme chez lui. En prime, notre plafond libre est **50** alors que le sien
monte à **100**, et le **voile négatif** (jusqu'à −100 chez lui) n'existe pas
chez nous.

### 2.3 Nos effets de matière laissent un halo sur les arêtes franches

Connu pour la texture, **jamais relevé pour la clarté** :

| Zone « barres 40 px, fort contraste » | Lightroom | nous |
|---|---|---|
| Texture +50 / +100 | 1,006 / 1,010 | **1,100 / 1,143** |
| Texture −50 / −100 | 0,995 / 0,991 | **0,916 / 0,859** |
| Clarté +50 / +100 | 1,014 / 1,026 | **1,143 / 1,143** |

Lightroom laisse les contours nets **intacts** et ne travaille que la matière ;
nous traitons les deux pareil. Concrètement : sur un toit contre le ciel ou un
poteau, nos texture et clarté positives posent un halo qu'il n'a pas, et la
texture négative ramollit un contour qu'il garde net. Ça demande un **masque de
contours**, pas un coefficient.

### 2.4 La netteté diverge au-delà de ~80

Sur le bord doux de 120 px, à 150 : Lightroom raidit ×1,58, nous ×1,00 — sa
netteté mord sur des structures bien plus larges que la nôtre quand on la pousse.
À 40, l'écart est de 1,053 contre 1,000 : sans importance. **Un preset avec
Netteté ≥ 80 ne sera pas reproduit fidèlement.**

### 2.5 Ce que l'import jette en silence

> ✅ **CORRIGÉ le jour même.** `verifierDomaineSpatial` (dans `xmpPreset.js`)
> liste ce que le moteur ne reproduira pas, et `preset:import` l'affiche en fin
> d'import : vignetage positif et voile négatif jetés, voile hors échelle,
> netteté ≥ 80, halo de texture/clarté sur les arêtes. Gardé par sept
> vérifications de `npm run test:vision-preset`.

Ce qui suit décrit l'état **avant** la correction.

Dans [`xmpPreset.js`](../../src/features/vibefx-studio/utils/xmpPreset.js),
`toSpatialFilters` :

- **vignetage positif** (coins éclaircis) : ignoré — le moteur n'assombrit que ;
- **voile négatif** : ignoré ;
- **clarté négative** : recopiée telle quelle… dans un moteur qui la sur-applique
  (§ 2.1).

Rien n'est **affiché** au moment de l'import : le preset s'installe et rend
faux sans le dire. Un avertissement en fin d'import coûterait trois lignes.

### 2.6 Les sous-réglages, et la résolution

- **Sous-réglages non branchés** : grain (Taille, Cassure), vignette (Milieu,
  Arrondi, Contour, Hautes lumières), netteté (Rayon, Détail, Masquage). Tout est
  calibré **pour leurs valeurs par défaut**. `cn17` met déjà Grain Taille **40**
  au lieu de 25 : son grain a la bonne force et pas forcément le bon aspect.
  → **À relever à chaque import**, comme le dit déjà `todo.md`.
- **Une seule résolution vérifiée.** Tout le calage est fait à **1620×1080**.
  Notre clarté a un rayon en **% du petit côté** (elle suit la taille) mais notre
  texture et notre grain sont en **pixels fixes** (3 px et 40 px). Sur une photo
  de 5392 px, si sa texture à lui suit la taille de l'image, la nôtre travaille à
  une autre échelle. **C'est une hypothèse, pas une mesure** : la vérifier
  demande un export de la mire à une autre taille. Seules la couleur et la
  netteté ont été validées sur une vraie photo pleine résolution.

---

## 3. Les curseurs marchent tous — c'est une autre question, et elle est verte

`npm run audit:reglages-avances` (le moteur) et `npm run test:reglages-avances`
(les vrais curseurs des vraies pages) sont **verts** : les 31 réglages du moteur
et les 17 du panneau Vision déplacent bien des pixels. « Ça marche » et « ça fait
la même chose que Lightroom » sont deux questions distinctes ; la première est
réglée, la seconde est ce document.

---

## 4. Réponse courte : peut-on lancer les imports ?

**Oui, pour un preset dont les panneaux Effets et Détail ne contiennent que :**
grain, vignetage négatif, texture (les deux sens), clarté **positive**, netteté
≤ 60. Là, on est à quelques pourcents de Lightroom, et la couleur est exacte par
construction.

**Non, sans correction préalable, pour un preset qui porte :** une **clarté
négative**, un **voile** marqué, un **vignetage positif**, une **netteté ≥ 80**,
ou un sous-réglage de grain/vignette/netteté hors défaut.

À faire dans cet ordre, si on veut fermer les trous avant d'importer :

1. ~~Calibrer la clarté négative~~ — **fait le 2026-08-19** (§ 2.1).
2. ~~Avertir à l'import~~ — **fait le 2026-08-19** (§ 2.5).
3. **Le voile**, si un preset de la liste en porte : à mesurer sur photo réelle,
   pas sur mire.
4. **Le masque de contours** de texture/clarté, et la **netteté haute**, qui sont
   du vrai chantier de moteur.

Après les deux corrections, **un preset qui porte une clarté négative s'importe
lui aussi sans réserve**. Restent hors domaine : voile marqué, vignetage positif,
netteté ≥ 80 — et l'import le dit maintenant tout seul.

---

## 5. L'instrument de comparaison passe par le vrai moteur (2026-08-19)

`compare-preset-vs-lightroom.mjs` n'appliquait que la **LUT** : il mesurait la
couleur et rien d'autre. Comme un preset Lightroom porte aussi des effets
qu'aucune table ne contient, l'écart lu mélangeait deux causes sans permettre de
les séparer — c'est comme ça que la Netteté 40 de `cn17` est restée invisible
plusieurs jours.

Il rend maintenant **deux fois** : la couleur seule en Node, et le **rendu
complet** (`renderStudio` dans un Chromium, avec les `spatialFilters` du preset).
Le grain est mis à 0 des deux côtés — deux bruits aléatoires ne se comparent pas
pixel à pixel. Coût : **9 secondes** sur une photo de 16 Mpx.

Et il répond à **deux questions différentes**, ce qui est le vrai apport :

| Question | Mesure |
|---|---|
| « nos pixels tombent-ils au même endroit ? » | écart moyen /255 |
| « y a-t-il autant de matière que chez lui ? » | énergie de gradient, **contours et zones plates séparés** |

La seconde existe parce qu'un effet spatial peut avoir la bonne force et faire
*monter* l'écart pixel à pixel : accentuer une arête déplace des pixels des deux
côtés, donc un noyau légèrement différent du sien coûte quelques 1/255 là où ne
rien faire n'en coûtait aucun — tout en laissant l'image plus molle que la
sienne. Et on sépare les contours des zones plates parce qu'une moyenne globale
mélange la matière qu'on veut reproduire et le **bruit** qu'un masque flou
amplifie sans qu'on le lui demande.

**Ce que ça donne sur `cn17`, et c'est une mesure neuve :**

```
D'OU VIENT L'ECART
  couleur seule (LUT)      1.95/255
  avec les effets          2.18/255

MATIERE PRESENTE (cible x1,00)
  sur les CONTOURS (20 % du cadre)   couleur seule x0,874   avec les effets x1,118
  sur les zones PLATES (bruit)       couleur seule x1,019   avec les effets x1,464
```

Autrement dit : sans la Netteté 40, notre rendu est **12,6 % trop mou** sur les
contours ; avec, il est **11,8 % trop dur** — la valeur relevée est la bonne, le
noyau diffère un peu. Et sur les zones plates, notre netteté **amplifie le bruit
du JPEG ×1,46** là où Lightroom développe depuis du RAW, où il n'y a presque pas
de bruit à amplifier. Sa netteté a un curseur **Masquage** pour ça ; la nôtre
n'en a pas. À l'œil, sur la planche à 1:1, ça ne se voit pas sur cette photo —
mais sur un ciel uni d'une photo bruitée, ça se verrait.

## Comment rejouer cet audit

```bash
# mire C — texture, clarté, netteté
node scripts/rendu-mire-c.mjs --texture 50 --safeSmartphone false --sortie /tmp/nous.png
node scripts/mesure-mire-c.mjs --reference <0-ref-C> --lightroom <export-LR>
node scripts/mesure-mire-c.mjs --reference /tmp/nous-neutre.png --lightroom /tmp/nous.png

# mire A — grain (les deux côtés, puis on compare les tableaux)
node scripts/mesure-grain-lightroom.mjs --reference <ref> --lightroom <mesure> --valeur 15

# mires B et D — vignetage et voile : rendu par notre moteur, puis diff pixel
node scripts/rendu-mire-c.mjs --mire presets-lightroom/mires-effets/mire-B-vignette.png \
  --vignette 50 --safeSmartphone false --sortie /tmp/nous-vignette-50.png

# photo réelle — rendu COMPLET (LUT + effets), 9 s sur 16 Mpx
node scripts/compare-preset-vs-lightroom.mjs <origine> <version-LR> cn17 \
  --planche /tmp/planche.png --sortie /tmp/notre-rendu.png
#   --sans-effets  revient a la couleur seule (aucun navigateur lance)
```
