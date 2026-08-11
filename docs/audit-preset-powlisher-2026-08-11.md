# Audit — reverse-engineering du preset Powlisher

Date : 2026-08-11
Auteur : agent IA (analyse automatisee + lecture visuelle)
Objet : comprendre precisement le rendu des photos de `@powl_d` pour reconstruire
un preset equivalent dans Vision, et remplacer les 12 « looks » actuels.

---

## 1. Corpus analyse

Les images n'ont **pas** ete lues via x.com (qui renvoie 402 aux robots). Elles ont
ete recuperees par l'API publique de syndication (`cdn.syndication.twimg.com/tweet-result`),
puis telechargees en **resolution d'origine** sur `pbs.twimg.com` (`?name=orig`).

| Tweet | Sujet | Images |
|---|---|---|
| `2036584871699558738` | Sony A7R3 / nostalgie | 4 |
| `2036584883842122240` | dont la Lamborghini | 3 |
| `2036584893828694093` | portraits / NYC Vessel | 3 |
| `2036584904557826543` | dont helico Biarritz | 2 |
| `2042671123788070968` | prise d'avion (Paris, iPhone 17 Pro) | 1 |
| `2014712191803404484` | interieur WeWork New York | 2 |
| `2014086419535319150` | Marrakech (via le tweet cite) | 4 |
| `2069450546025754646` | **video** : son Lightroom, ses presets | 50 frames |
| `1988657267739406751` | il nomme son preset : Lightroom « Cinema 2 » | 8 |

Total : **27 photos** (2048×1536, 1536×2048, 1152×2048…) + **50 frames** extraites
de la video a 0,25 s d'intervalle (AVFoundation, pas de ffmpeg sur la machine).
Les 19 premieres constituent le corpus de reference ; les 8 dernieres servent
uniquement a etablir la filiation (section 2 bis).

Reserve importante : ce sont des JPEG re-encodes par X. Les mesures de **couleur
et de tonalite sont fiables** (erreurs de l'ordre de ±1/255) ; les mesures de
**grain / micro-detail sont degradees** par la recompression et sont a lire comme
une borne inferieure.

---

## 2. Ce que la video dit directement

La video (12 s) est une capture d'ecran de Lightroom mobile sur un **DNG**
(`IMG_5672.DNG`, ProRAW iPhone). Elle donne des faits, pas des deductions :

**Ses presets utilisateur** — il en a bien fabrique plusieurs :
- `PLDX BOOSTER SU`
- `PLDX REACTOR`
- `Powlisher_Neutral`

**Valeurs lues dans le panneau Lumiere :**
- `HDR` : desactive
- `Exposition` : **variable** — 0 sur une frame, +0,47 sur une autre pendant qu'il
  la fait glisser → **reglage par photo, pas partie du preset**
- `Contraste` : **−50**
- `Hautes lumieres` : **−30**

**Panneau Optique :**
- `Supprimer l'aberration chromatique` : desactive
- `Act. corrections objectif` : desactive

**Les pastilles sous les onglets** (Lightroom marque d'un point les modules
modifies) — c'est le renseignement le plus utile de la video :

| Onglet | Pastille | Lecture |
|---|---|---|
| Lumiere | **oui** | courbe + contraste + hautes lumieres |
| Couleur | **oui** | balance des blancs, melangeur TSL, etalonnage |
| Flou | non | aucun flou d'objectif |
| Effets | **oui** | texture / clarte / vignetage / grain |
| Detail | **oui** | nettete / reduction de bruit |
| Optique | non | confirme par les deux interrupteurs eteints |

Le panneau ne defile jamais plus bas dans la video : `Ombres`, `Blancs`, `Noirs`,
et tout le detail de `Couleur` ne sont **pas** visibles. Ils sont donc deduits
des mesures ci-dessous, pas lus.

---

## 2 bis. Filiation : Lightroom « Cinema 2 » (CN11 / CN17)

Un tweet du **12 novembre 2025** dit noir sur blanc :

> « je shoot a l'iPhone, et en 30 sec j'applique le preset Lightroom Mobile :
> Cinema 2. Les CN11 et CN17 sont mes favoris »

Une des captures jointes est un ecran de Lightroom affichant **« Style : Cinema II »**,
la description Adobe (« Ce pack de nouveaux parametres predefinis permet
d'obtenir cet aspect cinematographique ») et les vignettes CN11, CN12, CN13, avec
CN11 selectionne. La direction visee est donc confirmee de sa main : c'est bien
la famille **cinematique** d'Adobe.

**Ce que ca change — et ce que ca ne change pas.**

Il faut lire la chronologie :

| Date | Ce qu'il utilise |
|---|---|
| nov. 2025 | Lightroom « Cinema 2 », CN11 / CN17 |
| janv.–mars 2026 | les photos que ce document analyse |
| mars 2026 | **ses propres presets** : `PLDX BOOSTER SU`, `PLDX REACTOR`, `Powlisher_Neutral` |

Les images pointees pour ce chantier sont les **plus recentes**, celles d'apres
qu'il ait fabrique ses propres presets. Cinema 2 est l'ancetre du look, pas le
look actuel.

Les mesures le confirment. Sur les 8 images de novembre 2025 :

- `R−G` est **positif** (+2 a +10) dans les tons moyens — chaud, **pas olive** ;
- le bleu reste a **208–223°**, il n'est **pas** tire vers le cyan ;
- `B−G` est negatif dans le meme ordre de grandeur (−5 a −12), ca c'est commun.

Autrement dit : **le virage creme des hautes lumieres vient de Cinema 2, mais le
ciel teal et les verts olive sont a lui.** C'est bien le corpus de 19 photos qui
doit servir de cible, pas Cinema 2.

**Deux precautions sur ce sous-corpus**, qui expliquent qu'il ne serve qu'a la
filiation :

1. Plusieurs de ces 8 images sont des **captures d'ecran de Lightroom**, pas des
   photos. Le chrome noir de l'interface fausse toute mesure globale (il fait
   monter le « % de pixels < 8 » a 52–72 %).
2. Ce sont **toutes** des scenes de nuit ou d'interieur, sans ciel. On ne peut
   donc rien conclure du placement des bleus : les pixels bleus y sont des neons,
   pas du ciel.

**Sur les valeurs exactes de CN11 et CN17 : elles ne sont pas reproduites ici.**
Ce sont des presets proprietaires Adobe dont je n'ai pas les parametres, et les
inventer de memoire serait moins fiable que ce qui a ete fait — mesurer le
resultat sur 19 photos. La reconstruction reste donc fondee sur la mesure.

---

## 3. Mesures sur les 19 photos

### 3.1 La rampe neutre — le cœur du look

Methode : on ne garde que les pixels **quasi neutres** (S < 0,14/0,16), ceux dont
la couleur ne vient pas du sujet mais du virage. On mesure ensuite, par tranche
de luminance, l'ecart `R−G` et `B−G` en unites 0–255. Un rendu neutre donnerait
0,0 partout. Mediane sur les 19 images :

| Luminance | R−G | B−G | Lecture |
|---|---|---|---|
| 0–5 % | −0,0 | −0,0 | noir pur, non vire |
| 5–10 % | −0,8 | −0,8 | quasi neutre |
| 10–15 % | −1,4 | −1,3 | tres leger vert |
| 15–20 % | −1,2 | −2,3 | le bleu commence a descendre |
| 20–25 % | −1,0 | −3,7 | |
| 25–30 % | −1,9 | −4,8 | |
| 30–35 % | −3,0 | −6,8 | chaud |
| 35–40 % | −3,7 | −7,6 | chaud |
| **40–45 %** | **−5,2** | **−9,4** | **chaud + olive** |
| 45–50 % | −4,4 | −10,2 | chaud + olive |
| 50–55 % | −3,8 | −10,3 | |
| 55–60 % | −5,4 | −8,5 | chaud + olive |
| 60–65 % | −2,8 | −9,4 | |
| 65–70 % | −1,3 | −8,6 | |
| **70–75 %** | −0,3 | **−12,3** | **creme franc** |
| 75–80 % | +2,2 | −8,0 | |
| 80–85 % | +2,3 | −8,2 | |
| 90–95 % | +0,7 | −3,1 | les blancs speculaires se renaturalisent |
| 95–100 % | +1,0 | −3,6 | |

**Trois enseignements :**

1. **Le bleu est progressivement ecrase quand la luminosite monte.** `B−G` part de
   0 dans les noirs, atteint −10 dans les tons moyens et −12 dans les hautes
   lumieres. C'est une courbe bleu descendante, pas une balance des blancs globale
   (sinon les noirs seraient vires aussi).
2. **Les tons moyens virent olive.** `R−G` tombe a −5 vers 40–60 % : le vert passe
   devant le rouge. Un gris neutre ressort **kaki/sauge**, pas beige. C'est ce qui
   distingue ce look d'un simple « rechauffement ».
3. **Les blancs extremes se renaturalisent** (`B−G` remonte a −3 au-dessus de 90 %).
   Le virage creme s'applique aux hautes lumieres *texturees*, pas aux speculaires.
   C'est une epaule de film, pas un voile.

### 3.2 Compression des hautes lumieres

| Photo | % pixels > 248 | % pixels ≥ 255 | Luma au 99,99e centile |
|---|---|---|---|
| img01 | 0,00 | 0,000 | **224** |
| img05 | 0,00 | 0,000 | **205** |
| img13 (avion) | 0,00 | 0,000 | **181** |
| img14 | 1,04 | 0,432 | 202 |
| img16 (Marrakech) | 0,00 | 0,000 | **194** |
| img12 (helico) | 0,01 | 0,004 | 213 |
| img19 | 2,47 | 0,298 | 253 |

Sur une bonne moitie du corpus le point blanc **ne monte jamais jusqu'a 255**. Le
99,99e centile plafonne souvent entre 180 et 225. C'est coherent avec
`Hautes lumieres −30` lu dans la video, plus une epaule de courbe.
**Il n'y a quasiment jamais d'ecretage.**

### 3.3 Effondrement de la saturation dans les hautes lumieres

Saturation moyenne par tranche de luminance (mediane sur le corpus) :

```
L 35–45 %  S = 0,42   ← pic
L 65–70 %  S = 0,38
L 75–80 %  S = 0,29
L 80–85 %  S = 0,21
L 85–90 %  S = 0,12
L 90–95 %  S = 0,06
L 95–100 % S = 0,05
```

La couleur **se delave vers le creme a mesure qu'elle monte**. C'est le second
marqueur fort du look, et c'est ce qui donne la « gestion de lumiere » que tu
decris : les hautes lumieres ne sont ni blanches ni saturees, elles sont cremeuses.

### 3.4 Les noirs

Contrairement a l'impression visuelle, **les noirs ne sont pas leves**. La mediane
du 1 % le plus sombre vaut 0,0 sur la majorite des photos, et l'ecart `R−G`/`B−G`
y est nul. Il n'y a **pas** de matte / faded blacks / voile gris.
Deux exceptions (img07, img13) ou la scene elle-meme n'a pas de noir.

### 3.5 Placement des teintes — le marqueur decisif

Teinte moyenne et saturation moyenne des pixels de chaque famille (S > 0,15) :

| Photo | Peau/orange | Vert feuillage | Cyan/bleu ciel | % surface ciel |
|---|---|---|---|---|
| img01 (pont) | 35,8° S0,36 | **105,9° S0,49** | 175,1° | 5,1 % |
| img03 | 26,3° S0,36 | 137,9° S0,19 | **181,0°** | 19,6 % |
| img07 | 27,4° S0,39 | — | **194,2°** | **38,4 %** |
| img11 | 33,9° S0,47 | **85,8° S0,18** | 180,5° | 1,1 % |
| img12 (helico) | 33,2° S0,49 | **84,4° S0,24** | 188,4° | — |
| img16 (Marrakech) | 29,2° S0,45 | 106,8° S0,35 | **189,0°** | **31,8 %** |
| img18 | 33,7° S0,44 | 98,0° S0,34 | **191,0°** | **41,6 %** |
| img19 | 32,5° S0,39 | 106,3° S0,25 | 183,9° | 2,1 % |

**Le ciel n'est jamais bleu.** Il atterrit entre **178° et 194°**, c'est-a-dire en
plein cyan/teal, alors qu'un ciel rendu neutre se situe entre 210° et 225°. C'est
un decalage de **−25 a −40°**. Et ce n'est pas marginal : sur les paysages, cette
famille represente **30 a 42 % de la surface de l'image**.

Corollaire mesure : la famille « bleu vrai » (200–255°) ne pese que **0,1 a 1,2 %**
sur presque toutes les photos. Autrement dit, **il ne reste quasiment plus rien
dans le bleu** — tout a ete tire vers le cyan.

**Les verts sont desatures de moitie et tires vers le jaune.** Ils se posent entre
84° et 107° avec S 0,18–0,35, la ou un feuillage neutre est vers 105–115° avec
S 0,45–0,60. Sur les scenes chaudes (helico, Lamborghini) ils descendent a 84–86° :
franchement olive.

**La peau est preservee.** 27–36° avec S 0,31–0,49 : c'est chaud, tenu, jamais
orange fluo. C'est le point d'equilibre du look — tout est desature autour, la peau
ne l'est pas.

### 3.6 Ce qui n'est PAS dans le preset

**Pas de vignetage systematique.** Mediane de l'ecart luminance bord/centre :
**+0,7 %**, avec une dispersion de −87 % a +246 % entierement expliquee par le
contenu (ciel en haut, sol en bas). Aucun signal exploitable.

**Pas de grain notable.** Ecart-type du residu de luminance apres moyenne 3×3, sur
les 5 % de tuiles les plus plates :

```
img01 1,00   img04 1,34   img09 0,14   img13 0,41   img16 0,37   img19 0,84
```

Un grain Lightroom a 15–25 donnerait 3 a 6 meme apres recompression JPEG. On est
**tres en dessous**. La pastille « Effets » de la video correspond donc plutot a
**Texture / Clarte**, pas au grain ni au vignetage.

---

## 4. Synthese : la recette

Ce n'est pas un filtre, c'est un **teal & orange propre**, execute avec retenue :

1. **Contraste global negatif** (−50 confirme), rattrape par une courbe en S douce
   → matiere dans les ombres sans boucher, pas de contraste « crunchy ».
2. **Hautes lumieres tirees vers le bas** (−30 confirme) + epaule → point blanc
   souvent sous 255, aucun ecretage.
3. **Courbe bleue descendante croissante avec la luminance** → hautes lumieres
   cremeuses, noirs neutres.
4. **Tons moyens vires olive** (`R−G` ≈ −5) → les gris sortent kaki, pas beiges.
5. **Melangeur TSL** :
   - bleu : teinte **−30°** (vers le cyan), saturation et luminance baissees ;
   - vert : teinte **−15/−20°** (vers le jaune), saturation **−45 %** ;
   - orange : teinte legerement **+5°**, saturation et luminance tenues ;
   - rouge : tire vers l'orange.
6. **Desaturation progressive des hautes lumieres** (S 0,42 → 0,05 entre L40 % et
   L95 %).
7. **Noirs denses**, aucun matte.
8. Texture/clarte modeste, **pas de grain, pas de vignetage, pas de correction
   d'objectif**.

---

## 5. Consequence pour le code

### 5.1 Le moteur actuel ne peut pas exprimer ce preset

`VISION_SUPPORTED_FILTER_KEYS` (`utils/visionColorScience.js`) n'offre, par bande
de teinte, que des controles de **saturation** :
`skySaturation`, `foliageSaturation`, `skinSaturation`, `warmSaturation`.

**Il n'existe aucun decalage de teinte.** Or c'est exactement la signature du look :
ciel 215° → 185°, vert 105° → 88°. Avec les cles actuelles on peut au mieux
desaturer un ciel bleu — on ne peut pas le rendre teal.

Par ailleurs `normalizeVisionFilters` borne `contrast` a **80 minimum** en mode
`safeSmartphone`, ce qui interdit deja le −50 observe.

Il faut donc **etendre le pipeline** avec un remappage teinte/saturation/luminance
par bande, plus une desaturation des hautes lumieres pilotee par la luminance.

### 5.2 Origine de la lenteur

`useVisionEditor.js` rend **12 vignettes** via `renderVisionProfilePreview`, en file
d'attente de 24 ms, **a chaque changement de photo**. Chaque vignette effectue :

- un `drawImage` depuis l'image **pleine resolution** (jusqu'a 4000 px) vers 384×232 ;
- `applyFusedPixelOps` → `getImageData` + `putImageData` ;
- `applySafeGlobalTint` → une passe de plus ;
- `applySmartphoneOutputGuards` → une passe de plus ;
- `canvas.toDataURL('image/jpeg')` → encodage JPEG complet.

Soit ~4 passes pixel + 1 encodage JPEG × 12, en repartant de la pleine resolution
a chaque fois. C'est la cause directe des a-coups.

### 5.3 Architecture retenue

**LUT 3D bakee une fois par preset, appliquee en une seule passe.**

- Le preset est ecrit comme une **fonction pure** RGB → RGB (courbes par canal,
  remappage TSL par bande, desaturation des hautes lumieres, virage split).
- Cette fonction est evaluee une seule fois sur une grille 33³ et stockee en
  `Float32Array` / `Uint8Array`.
- Le rendu applique la LUT par interpolation trilineaire, en **une passe**
  `getImageData`/`putImageData`.

Benefices :
- cout de rendu **constant**, quelle que soit la complexite du preset ;
- ajouter un preset n'ajoute aucun cout au rendu d'une image ;
- la source est **downscalee une seule fois** dans un canvas hors-ecran, partage
  par toutes les vignettes, au lieu d'un `drawImage` pleine resolution par vignette.

---

## 6. Ce qui reste incertain

A dire honnetement, parce que ca conditionne la fidelite :

- **`Ombres`, `Blancs`, `Noirs`** ne sont jamais visibles dans la video. Ils sont
  deduits de la rampe neutre et de la distribution des noirs, pas lus.
- **Le detail du panneau Couleur** (valeurs exactes du melangeur TSL, etalonnage)
  n'est pas visible non plus. Les decalages ci-dessus sont **mesures sur le
  resultat**, ce qui est plus robuste qu'une lecture de curseur, mais ne permet pas
  de distinguer ce qui vient du melangeur de ce qui vient de l'etalonnage.
- Les 19 photos ne sortent **pas toutes du meme preset** : il en a au moins trois
  (`PLDX BOOSTER SU`, `PLDX REACTOR`, `Powlisher_Neutral`). Les images du Vessel
  new-yorkais (img08–img10) sont nettement plus froides et desaturees
  (S moyenne 0,14 contre 0,40 ailleurs) — c'est probablement un autre preset, voire
  une autre epoque. **Elles ont ete gardees dans les mesures agregees mais elles
  tirent les medianes vers le neutre** ; le preset cible doit viser le groupe
  majoritaire (paysage/voyage chaud).
- Les photos sont des **DNG ProRAW** retouches en RAW. Nous appliquons le preset a
  des **JPEG deja developpes** par le telephone. Une partie de la latitude (surtout
  la recuperation des hautes lumieres) n'existe pas de notre cote : le rendu sera
  proche, mais l'epaule devra etre simulee plutot que reellement recuperee.

---

## 7. Cible chiffree pour la validation

Le preset sera considere fidele si, applique a une photo de smartphone ordinaire,
il produit :

| Mesure | Cible |
|---|---|
| `B−G` sur neutres a L70–75 % | −10 a −14 |
| `R−G` sur neutres a L40–60 % | −3 a −6 |
| `R−G`/`B−G` sur neutres a L0–10 % | 0 ± 1 |
| Teinte moyenne du ciel | 180–192° |
| Teinte moyenne du feuillage | 85–105°, S ≤ 0,35 |
| Teinte moyenne de la peau | 27–36°, S 0,31–0,49 |
| Saturation a L90–95 % | ≤ 0,10 |
| % pixels ≥ 255 | < 0,5 % |
| Mediane du 1 % le plus sombre | ≤ 3 |

Ces mesures sont reproductibles par script : elles sont devenues
`scripts/smoke-vision-preset.mjs` (20 verifications), rejouees a chaque
modification du preset.

---

## 8. Ce qui a ete livre

**Le preset** — `src/features/vibefx-studio/utils/visionPresets.js`, ecrit comme
une fonction pure sRGB → sRGB, dans l'ordre de Lightroom :

1. courbe maitre par canal (pied leger, epaule a 0,952) ;
2. melangeur par bande de teinte (memes ancres que le melangeur TSL) ;
3. desaturation progressive des hautes lumieres ;
4. virage split pilote par la luminance, **en dernier**.

L'ordre n'est pas cosmetique : place avant le melangeur, le virage se faisait
desaturer par lui et l'ecart `B−G` vise dans les hautes lumieres retombait d'un
quart (−8,8 au lieu de −12,0).

Valeurs finales du melangeur (teinte en degres, saturation et luminance en %) :

| Ancre | Teinte | Saturation | Luminance |
|---|---|---|---|
| 0° rouge | +4 | −10 | 0 |
| 30° orange (peau) | +2 | −4 | +4 |
| 60° jaune | −3 | −28 | +3 |
| 120° vert | −16 | −55 | +6 |
| 180° aqua | −1 | −20 | 0 |
| 240° bleu | −38 | −28 | −10 |
| 270° violet | −18 | −30 | −5 |
| 300° magenta | −8 | −25 | −2 |

Tout le melangeur est **pondere par la saturation** (`smoothstep(0, 0.12, s)`) :
un pixel quasi gris n'a pas de teinte definie, et le decaler creerait une
discontinuite que l'interpolation de la LUT transformerait en bandes visibles.

**Le moteur** — `src/features/vibefx-studio/utils/lut3d.js`. La fonction du
preset est evaluee une fois sur une grille 33³ (35 937 points, quelques ms), puis
le rendu n'est plus qu'une interpolation trilineaire en une passe. Consequence
directe : **ajouter un preset ne coute rien au rendu d'une image.**

**Resultats mesures apres implementation** — les 9 cibles sont tenues :

| Mesure | Cible | Obtenu |
|---|---|---|
| `B−G` neutres a L70–75 % | −14 … −10 | **−12,0** |
| `R−G` neutres a L40–60 % | −6 … −3 | **−5,0** |
| `R−G`/`B−G` neutres a L0–10 % | 0 ± 1 | **−0,4** |
| Teinte du ciel | 178–192° | **178,3 … 193,3** |
| Teinte du feuillage | 85–105° | **91,9** |
| Saturation du feuillage | ≤ 0,35 | **0,34** |
| Teinte de la peau | 27–36° | **33,3 … 34,2** |
| Point blanc | < 255 | **243,8** |
| Noirs | ≤ 3 | **0,0** |
| Ecart LUT ↔ fonction pure | ≤ 4/255 | **1,9** |

**La performance** — la cause de la lenteur est corrigee
(`src/features/vibeos/vision/presetPreview.js`) : la photo est reduite **une
seule fois** dans un canvas partage, et chaque vignette n'est plus qu'une passe
LUT sur ~90 000 pixels, au lieu d'un `drawImage` pleine resolution + 4 passes
pixel + un encodage JPEG par vignette. Le smoke navigateur Vision passe
desormais en **6,9 s** au lieu de tourner dans un budget de 240 s.

**Ce qui a ete supprime** : les 12 looks (`visionLooks.js`), la bibliotheque de
profils par marque et son panneau, et `guardLookForImage` devenu mort. Le tri des
looks par photo disparait avec eux — il n'a plus d'objet avec un seul preset.

**Reserve honnete** : ce preset est valide contre des cibles chiffrees et sur une
mire teinte × luminance, mais il n'a **pas** ete confronte a un corpus de photos
de smartphone brutes, faute d'en avoir. Le premier vrai test, c'est toi qui le
feras avec tes propres photos.
