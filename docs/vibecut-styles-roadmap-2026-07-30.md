# Roadmap — Presets de montage VibeCut

> Document d'implémentation spécifique, demandé le **2026-07-30**.
> Rattaché à [plan.md](../plan.md) § phase 3b et à [todo.md](../todo.md).
> **État : L1 à L5 livrés (L1-L3 le 2026-07-30, L4-L5 le 2026-08-01). Seul L6 — le rollout Cloud Run — reste, et il est outillé.** Voir § 9.

---

## 1. La demande

> « Je m'attendais surtout à ce que tu mettes plus de style, avec des compositions
> de transition plus variées. Pareil pour la partie rythme et mouvement. L'idée
> c'est que l'utilisateur ait le max de style, qu'on comprenne vite les presets,
> avec des animations modernes. Là c'est pas mal mais ça reste basique. Celui que
> je préfère c'est Cinéma doux, le reste rien d'incroyable. Et que la partie
> "règle le tempo du montage" synergise bien avec le style choisi, c'est
> important. **On priorise toujours la qualité à la quantité.** »

Référence visuelle fournie : maquette « Création guidée » montrant des presets
sous forme de **pellicules de trois vignettes photo réelles**, un curseur
**Intensité du mouvement**, un rythme en trois crans, et une action unique
« Créer le montage ».

---

## 1bis. Critère d'acceptation de la phase — validé avec le porteur le 2026-07-30

> **Appuyer sur lecture dans l'aperçu doit montrer, pour chaque preset, un montage
> visiblement différent des autres — ET ce que l'export produira réellement.**

C'est la finalité, pas un effet de bord. Un créateur choisit son style sur ce
qu'il voit ; si l'export diffère, l'outil ne sert à rien.

**Ce critère n'est pas rempli aujourd'hui**, et c'est ce qui commande l'ordre des
lots :

| | Aperçu (lecture navigateur) | Export serveur |
|---|---|---|
| Colorimétrie | rendue | rendue à l'identique ✅ |
| Mouvement photo | rendu | rendu à l'identique ✅ (courbe, intensité et décalage corrigés en L3) |
| **Transition** | les 27 du moteur | les 15 exportables, rendues à l'identique ✅ (L1) |

Conséquence opérationnelle, à ne pas contourner : **améliorer les presets avant
L1 rendrait l'aperçu plus beau et plus menteur.** On répare le canal (L1), puis
on peint (L2 → L5).

Corollaire sur le coût réel : le travail n'est pas la table de correspondance
`xfade`, qui est triviale. C'est de **réimplémenter chaque transition dans le
navigateur pour qu'elle corresponde à ce que `xfade` produit**. Une transition
dont l'aperçu ne ressemble pas à l'export ne doit pas être publiée — elle est
pire que son absence.

---

## 2. Pourquoi les presets actuels paraissent basiques — diagnostic honnête

Les quatre styles livrés en phase 3 ne se distinguent que par **trois nombres et
une teinte** :

| Style | Durée/photo | Transition | Look |
|---|---|---|---|
| Social dynamique | 2,4 s | crossfade 0,3 s | contraste + saturation |
| Cinéma doux | 4,2 s | crossfade 0,9 s | désaturé + vignette + fade |
| Souvenirs | 3,4 s | crossfade 0,55 s | chaud + vignette |
| Net et direct | 2,6 s | *aucune* | net + lumineux |

Trois d'entre eux sont **le même fondu enchaîné à trois vitesses**. C'est
exactement pourquoi seul « Cinéma doux » ressort : c'est le seul dont la
colorimétrie transforme visiblement l'image. Les autres ne changent qu'un tempo.

Trois manques structurels :

1. **Une seule transition, répétée à l'identique sur toutes les coupes.** Un vrai
   montage alterne : des coupes franches, puis un accent tous les trois ou quatre
   plans. Ici, la coupe n° 1 et la coupe n° 12 sont identiques.
2. **Une durée uniforme pour toutes les photos.** Aucun montage réel ne donne la
   même durée à chaque plan : il y a un plan d'ouverture plus long, un ventre
   rapide, une fin qui respire.
3. **Le rythme est un simple multiplicateur** (× 1,35 / × 1 / × 0,68) appliqué à
   l'identique à tous les styles. Il ne « synergise » avec rien : il étire ou
   comprime, point.

---

## 3. Faits vérifiés — la base technique de tout ce qui suit

Vérifiés sur cette machine le 2026-07-30. **Chaque affirmation est
re-vérifiable par la commande indiquée**, sans aucun coût Cloud.

### 3.1 Le renderer ignore purement et simplement le type de transition

`render-service/src/server.js:482` :

```js
filterParts.push(`${currentLabel}${nextLabel}xfade=transition=fade:duration=…`);
```

`transition=fade` est **écrit en dur**. Quel que soit le type choisi dans
l'interface, l'export serveur rend un fondu simple. C'est cohérent avec
`SERVER_RENDER_CAPABILITIES.timedTransitions = ['fade', 'crossfade']`, mais cela
signifie que **la richesse des transitions n'est aujourd'hui bornée par aucune
limite technique — seulement par une ligne non écrite.**

### 3.2 FFmpeg fournit 46 transitions natives, déjà disponibles

```bash
node -e "const p=require('ffmpeg-static');require('child_process').spawnSync(p,['-h','filter=xfade'],{stdio:'inherit'})"
```

Le build embarqué (`ffmpeg-static`) expose `transition` de **-1 à 45** :

```
fade  wipeleft  wiperight  wipeup  wipedown  slideleft  slideright  slideup
slidedown  circlecrop  rectcrop  distance  fadeblack  fadewhite  radial
smoothleft  smoothright  smoothup  smoothdown  circleopen  circleclose
vertopen  vertclose  horzopen  horzclose  dissolve  pixelize  diagtl  diagtr
diagbl  diagbr  hlslice  hrslice  vuslice  vdslice  hblur  fadegrays
wipetl  wipetr  wipebl  wipebr  squeezeh  squeezev  zoomin  fadefast  fadeslow
```

**Conséquence directe : le vocabulaire de transitions exportables peut passer de
1 à ~46 par une table de correspondance et un redéploiement.** Aucune technologie
nouvelle, aucun rendu image par image, aucun surcoût de calcul notable.

⚠️ La liste ci-dessus est celle du build **local**. Le build de l'image Cloud Run
doit être vérifié avec la même commande avant de s'engager sur un identifiant.

### 3.3 Défaut de parité découvert : le mouvement n'a pas la même courbe des deux côtés · ✅ corrigé en L3

- Navigateur — `model/mediaModel.js:104` : accélération **lissée**
  (`smoothstep`, `p²(3−2p)`), avec un champ `easing` (`ease-in-out` par défaut,
  `linear` possible).
- Serveur — `render-service/src/server.js:723` : interpolation **strictement
  linéaire**. `grep -c easing render-service/src/server.js` → **0**.

Un zoom part donc doucement dans l'aperçu et démarre sec à l'export. Le défaut
existe depuis l'origine et n'a jamais été relevé. Il doit être corrigé **dans le
même lot** que l'intensité du mouvement, puisque les deux touchent la même
expression `zoompan`.

**Corrigé au lot L3** (§ 9), avec un **troisième** écart trouvé au passage et
absent de ce diagnostic : le décalage de panoramique n'était pas divisé par le
zoom, et voyageait ~11 % trop loin à l'export.

### 3.4 L'intensité du mouvement est réalisable avec une parité exacte

Les deux côtés dérivent le mouvement du même couple `start` / `end`
(`scale`, `x`, `y`). Multiplier l'écart `end − start` par un facteur d'intensité
donne **la même formule des deux côtés**, donc une parité garantie par
construction et non par surveillance.

---

## 4. Le modèle de preset cible

Un preset cesse d'être « une durée + une transition + une teinte » pour devenir
une **partition de montage** à sept dimensions. C'est ce qui produit la
différence entre « trois fondus à trois vitesses » et quatre montages qui ne se
ressemblent pas.

```
preset = {
  // 1. STRUCTURE RYTHMIQUE — des poids, pas une durée fixe
  beatPattern: [1.5, 1, 1, 1.25],      // le 1er plan respire, le 4e réattaque
  openingHold: 1.3,                     // multiplicateur du tout premier plan
  closingHold: 1.4,                     // ... et du dernier

  // 2. PARTITION DE TRANSITIONS — une séquence, pas une valeur
  transitionScore: ['cut', 'cut', 'smoothleft', 'cut'],
  accentEvery: 4,                       // un accent toutes les N coupes
  accentTransition: 'zoomin',
  transitionBeatRatio: 0.18,            // durée du fondu = 18 % du plan

  // 3. CHORÉGRAPHIE DES MOUVEMENTS — une direction, pas un modulo
  motionScore: ['zoom-in', 'pan-right', 'zoom-out', 'pan-right'],
  motionIntensity: 0.75,                // 0–1, cf. § 6
  motionContinuity: 'alternate',        // 'alternate' | 'sustain' | 'still'

  // 4. COLORIMÉTRIE — déjà en place, à enrichir
  look: { …NEUTRAL_LOOK, contrast: 108, … },

  // 5. TYPOGRAPHIE — un traitement de titre par preset
  titleStyle: { fontSize, position, boxStyle, animation, casing },

  // 6. SON
  audioProfile: { fadeIn, fadeOut, duckUnderTitle },

  // 7. FORMAT recommandé
  sequencePreset: 'instagram-reel',
}
```

### Règle de composition des durées

```
durée(scène i) = beatBase(rythme) × beatPattern[i % n] × holds(premier/dernier)
```

`beatBase` vient du **rythme**, `beatPattern` vient du **style**. Les deux
réglages deviennent orthogonaux *et* solidaires : changer de rythme accélère le
montage **sans effacer le caractère long/court du style**. C'est exactement la
« synergie » demandée.

### Garde-fou non négociable

Une transition ne peut jamais dépasser **45 % du plus court des deux plans
adjacents**. Sinon le fondu mange la scène — c'est déjà le cas aujourd'hui avec
« Cinéma doux » en rythme soutenu, où le fondu de 0,9 s est silencieusement
rogné et le style perd son caractère sans que rien ne le dise.

---

## 5. Vocabulaire de transitions retenu — la parité d'abord

**Principe : le catalogue de la création guidée est bâti sur le vocabulaire
`xfade`, pas l'inverse.** Chaque entrée est donc exportable par construction. Les
27 transitions « maison » de `VideoEngine.renderTransition` qui n'ont pas
d'équivalent (`glitch`, `rgb-split`, `light-leak`, intros/outros) **restent
disponibles dans le montage rapide et avancé, marquées « Aperçu uniquement »,
mais ne sont jamais employées par un preset guidé.**

Sélection resserrée — **qualité, pas quantité** — 16 entrées :

| Famille | id VibeCut | `xfade` | Intention |
|---|---|---|---|
| Fondu | `crossfade` | `fade` | Le neutre, la valeur sûre |
| Fondu | `dip-black` | `fadeblack` | Respiration, changement de chapitre |
| Fondu | `dip-white` | `fadewhite` | Rupture lumineuse, souvenir |
| Fondu | `film-dissolve` | `dissolve` | Dissolution texturée, argentique |
| Fondu | `desat-fade` | `fadegrays` | Passage désaturé, mélancolie |
| Glissement | `swipe-left` | `smoothleft` | Balayage organique, très social |
| Glissement | `swipe-right` | `smoothright` | Idem, sens inverse |
| Glissement | `push-up` | `slideup` | Enchaînement vertical, format 9:16 |
| Glissement | `push-down` | `slidedown` | Retour en arrière narratif |
| Volet | `wipe-left` | `wipeleft` | Coupe nette assumée |
| Volet | `blinds-open` | `vertopen` | Ouverture de séquence |
| Forme | `iris-open` | `circleopen` | Focalisation sur un sujet |
| Forme | `iris-close` | `circleclose` | Fermeture, fin de partie |
| Accent | `zoom-punch` | `zoomin` | Accent rythmique fort |
| Accent | `pixel-cut` | `pixelize` | Accent numérique, mixed media |
| Accent | `blur-cut` | `hblur` | Accent doux, produit |

Chaque entrée doit être **implémentée à l'identique dans le navigateur**. C'est
le vrai coût du lot : `renderTransition` doit apprendre 16 comportements qui
correspondent au pixel près à ceux de `xfade`. Une transition dont l'aperçu ne
ressemble pas à l'export est pire que pas de transition du tout.

---

## 6. Intensité du mouvement

Le curseur de la maquette (« Intensité du mouvement — 75 % ») se ramène à un
facteur unique appliqué à l'écart :

```
scale(t) = start.scale + (end.scale − start.scale) × intensité × eased(t)
```

- Navigateur : `resolveImageMotionFrame` (`model/mediaModel.js`).
- Serveur : `normalizeImageMotionForRender` + `buildImageMotionFilter`
  (`render-service/src/server.js`).
- **Et dans le même geste**, corriger le défaut § 3.3 en portant le `smoothstep`
  dans l'expression `zoompan` :
  `p = min(on/(N−1),1)` puis `eased = p*p*(3−2*p)`.
  Les deux côtés partagent alors la même courbe.

Exposition dans l'interface : trois crans nommés plutôt qu'un curseur continu
(**Discret 40 % · Naturel 70 % · Marqué 100 %**), pour rester dans la logique
« une décision lisible par écran ». Le curseur continu appartient au montage
avancé.

**Livré au lot L3.** Deux précisions venues de l'implémentation :
- l'intensité s'applique à l'écart, **pas au cadrage de départ** : la baisser
  raccourcit la course, elle ne recadre pas la photo ;
- les six presets portent maintenant **exactement l'un des trois crans**. Une
  valeur intermédiaire (0,55, 0,9) ne pouvait pas s'afficher, donc la carte
  sélectionnée aurait menti sur ce que le montage applique.

---

## 7. Les cartes de preset — la pièce maîtresse de l'interface

C'est le point qui ferait le plus de différence perçue, et il est réalisable
dès maintenant : **à l'étape 2, les médias sont déjà importés et leurs
miniatures extraites.**

Aujourd'hui les vignettes montrent des illustrations SVG génériques (montagne,
ville, plage). La maquette montre des pellicules composées de **vraies photos**.

**`PresetFilmstrip`** : trois panneaux tirés des miniatures réelles du projet,
teintés par le look du preset, animés par la **vraie transition** du preset entre
les panneaux, au **vrai tempo** du preset.

- L'utilisateur voit ses propres photos dans chacun des quatre styles.
- La comparaison devient immédiate, sans imagination requise.
- Repli sur `SceneIllustration` tant qu'aucune miniature n'est disponible
  (l'extraction des miniatures vidéo est asynchrone) — l'état de repli existe
  déjà et ne doit pas être supprimé.

Reste acquis de la phase 3 : boucle permanente, départ décalé d'une carte à
l'autre, `prefers-reduced-motion` qui arrête tout.

---

## 8. Les presets proposés — six, pas douze

Qualité avant quantité. Chacun doit être **reconnaissable en une seconde** et
justifier son existence par une intention distincte, pas par une variation de
réglage.

| Preset | Structure | Transitions | Mouvement | Look |
|---|---|---|---|---|
| **Reel dynamique** | battements courts et irréguliers `[1, .7, .7, 1]` | coupes franches + `zoom-punch` tous les 4 | zoom marqué, alterné | contraste et saturation soutenus |
| **Cinéma** *(le seul qui plaît aujourd'hui — à conserver, pas à refondre)* | plans longs `[1.4, 1, 1, 1.2]`, ouverture et fin qui tiennent | `crossfade` amples + `dip-black` en fin de chapitre | zooms lents, continuité de direction | désaturé, vignette, noirs relevés |
| **Souvenirs** | régulier et posé `[1.2, 1, 1]` | `film-dissolve` + `dip-white` en accent | panoramiques doux | chaud, halo, grain léger |
| **Produit** | métronomique `[1, 1, 1]` | coupes franches + `blur-cut` | quasi fixe, très léger zoom | net, lumineux, hautes lumières tenues |
| **Mixed media** | syncopé `[1, .6, 1.3, .6]` | `swipe-left` / `push-up` / `pixel-cut` | directions contrastées | saturé, contraste dur |
| **Récit** | croissant `[1.6, 1.2, 1, .8]` | `iris-open` en ouverture, `crossfade`, `iris-close` en fin | zoom avant continu | neutre, légèrement froid |

Note produit : **« Récit » est le seul dont la structure raconte quelque chose**
(des plans qui raccourcissent = tension qui monte). S'il faut n'en garder que
cinq, c'est celui-là qui justifie le mieux le mot « preset » plutôt que « filtre ».

---

## 9. Lots d'implémentation

Chaque lot est livrable seul et se termine par le rituel de fin de phase
(`plan.md` § 9). **Un seul redéploiement Cloud Run, en L6.**

### L1 — Parité des transitions côté serveur · ✅ **livré le 2026-07-30**

Fait :
- Table `SERVER_XFADE_TRANSITION_MAP` dans le renderer, en remplacement du `fade`
  en dur, avec **repli volontaire sur `fade`** pour tout id inconnu (un identifiant
  absent du build FFmpeg déployé ferait échouer le rendu entier).
- Table portée à l'identique par `exportManifest.js` (capacités **v3**,
  `timedTransitions` dérivé de la table) et `functions/src/videoExport.js`.
- **`engine/xfadeTransitions.js`** : contrepartie canvas des 15 transitions.
  `VideoEngine.renderTransition` y délègue **avant** son `easeInOut`.

Trois choses apprises en chemin, qui n'étaient pas dans le plan :
1. **`xfade` progresse linéairement.** L'`easeInOut` du moteur était donc lui-même
   un écart de parité — y compris sur le simple fondu, la transition la plus
   utilisée. Ce défaut n'avait jamais été relevé.
2. **Les fondus par couleur sont franchement asymétriques.** Mesurés en rendant
   `xfade` avec un plan rouge pur et un plan vert pur (le canal rouge donne le
   poids du plan sortant, le vert celui de l'entrant) : le sortant s'éteint sur
   les 20 premiers pour cent, l'entrant remonte sur tout le reste. `fadewhite`
   partage exactement les mêmes deux courbes que `fadeblack`. Ces courbes sont
   **relevées et stockées telles quelles**, pas approximées — ce qui a fait passer
   l'écart de 19/255 à moins de 1/255.
3. **`zoom-punch` (`xfade=zoomin`) est écarté.** Les images de référence montrent
   une magnification qui devient extrême jusqu'à un aplat uniforme au milieu du
   fondu : laid sur photo, et disproportionné à reproduire au canvas. La règle
   « une transition dont l'aperçu ne ressemble pas à l'export est pire que pas de
   transition » s'applique à elle. **15 transitions distinctes, pas 16.**
   Si un accent de zoom est voulu, il viendra du mouvement (L3), pas d'ici.

Écart mesuré aperçu ↔ export, sur 0-255 :

| Famille | Écart moyen par pixel | Statut |
|---|---|---|
| `crossfade`, `dip-black`, `dip-white`, `wipe-left` | < 4 | exact |
| `push-up`, `push-down` | ≤ 12 | arrondi au pixel |
| `swipe-*`, `blinds-open` | ≤ 14 | largeur du bord adouci approchée |
| `iris-open`, `iris-close` | ≤ 22 | bord très étalé, rayon approché |
| `blur-cut` | ≤ 30 | mélange exact, noyau de flou différent |
| `pixel-cut` | ≤ 50 | taille et alignement des blocs approchés |
| `film-dissolve` | ≤ 60 par pixel, **< 4 en moyenne d'image** | grain tiré au hasard par FFmpeg, non reproductible |
| `desat-fade` | ≤ 55 | `grayscale()` du navigateur en Rec.709, FFmpeg en Rec.601 |

Les trois derniers sont des écarts **structurels assumés**, documentés dans le
code et bornés par le test pour qu'une *dérive* soit détectée.

**Gates tenus** : `test:vibecut-export` (exit 0, dont le nouveau
`smoke-vibecut-transition-parity`), `test:vibecut-xfade-local-mp4` (un MP4 réel
par transition, commande construite par `buildFfmpegArgs` du renderer lui-même —
un `fade` en dur y serait attrapé), `test:vibecut-xfade-preview-parity`
(comparaison image par image dans Chromium), `lint`, `build`, `test:vibecut-ui-v2`
(13 tests navigateur).

Effet de bord voulu : `dip-black`, `dip-white` et `film-dissolve`, jusque-là
marquées « Aperçu uniquement » dans le montage rapide, passent en « Export Pro ».

**Non fait volontairement** : aucun rollout Cloud Run. Le renderer déployé rend
donc encore un fondu simple ; c'est L6 qui rendra L1 effectif en production.

### L2 — Le modèle de preset · ✅ **livré le 2026-07-30**

Fait, conforme au modèle § 4 :
- `data/styleRecipes.js` porte `beat` (poids par plan + `openingHold`/`closingHold`),
  `transitionScore`, `accentEvery`, `accentTransition`, `openingTransition` /
  `closingTransition`, `transitionBeatRatio`, `motionScore`, `motionIntensity`,
  `motionContinuity`, `look`, `titleStyle`, `audioProfile`, `sequencePreset`.
- `buildMontagePlan()` produit `plan.scenes[]` (durée + mouvement) et
  `plan.cuts[]` (type + durée) : un plan **par scène**, plus des valeurs globales.
- Action **additive** `applyMontageScore` dans le store. `applyGuidedTemplate`
  n'est pas touchée et le smoke échoue si l'une des deux disparaît.
- Les six presets du § 8 existent : Reel dynamique, Cinéma, Souvenirs, Produit,
  Mixed media, Récit.

Montages produits sur 12 photos, rythme équilibré — ils ne se ressemblent plus :

| Preset | Durées des 6 premiers plans | Coupes |
|---|---|---|
| Reel dynamique | 2,53 · 1,54 · 1,54 · 2,2 · 2,2 · 1,54 | franches, `swipe-left` tous les 4 |
| Cinéma | 6,72 · 4 · 4 · 4,8 · 5,6 · 4 | `crossfade`, `dip-black` tous les 5 |
| Souvenirs | 4,42 · 3,2 · 3,2 · 3,84 · 3,2 · 3,2 | `film-dissolve`, `dip-white` tous les 4 |
| Produit | 2,64 · 2,4 · 2,4 · 2,4 · 2,4 · 2,4 | franches, `blur-cut` tous les 3 |
| Mixed media | 2,42 · 1,32 · 2,86 · 1,32 · 2,2 · 1,32 | `swipe-left` / `push-up` / franche / `pixel-cut` |
| Récit | 5,98 · 4,08 · 3,4 · 2,72 · 5,44 · 4,08 | `iris-open`, `crossfade`, `iris-close` |

Deux choses apprises en chemin :
1. **Le rythme ne pouvait plus appartenir au preset.** Il portait jusque-là un
   `recipe.rhythm` que choisir un style réécrivait. Avec la nouvelle formule, le
   rythme est la **cadence de base** et le preset la **forme** : changer de preset
   ne doit donc plus écraser un rythme déjà choisi. Corrigé dans `GuidedFlow`.
2. **Une « durée par photo » n'existe plus.** Le récapitulatif et les cartes de
   rythme annonçaient une valeur unique ; ils annoncent maintenant l'amplitude
   réelle (« 2,72 à 4,57 s »), ce qui rend la structure de battement visible dès
   maintenant, sans attendre L5.

Écarté volontairement : `titleStyle` et `audioProfile` sont **portés par le
modèle mais pas encore appliqués** — ils relèvent de l'étape Son & textes, donc
de L5. Les déclarer sans les appliquer est assumé et documenté plutôt que masqué.

**Gates tenus** : `test:vibecut-recipes` réécrit autour du nouveau modèle
(structure de battement, partition, placement des accents, priorité
ouverture/fermeture sur accent, garde-fou des 45 %, conservation de la forme d'un
rythme à l'autre, six montages distincts), `lint`, `build`, `test:vibecut-ui-v2`
(13 tests navigateur), `test:vibecut-export`.

Effet de bord du lot L1 enfin exploité : `transitionCatalog.js` gagne les onze
transitions exportables qui lui manquaient, et **les six raccourcis du montage
rapide sont désormais tous exportables** — quatre des six n'existaient qu'à
l'aperçu, l'interface poussait donc vers des montages inexportables.

### L3 — Mouvement : intensité + correction de la courbe · ✅ **livré le 2026-07-30**

Fait :
- **La courbe est la même des deux côtés.** Le `smoothstep` de l'aperçu est écrit
  dans l'expression `zoompan` : `p = min(on/(N−1),1)` puis `p*p*(3−2*p)`. Le
  défaut du § 3.3, présent depuis l'origine, est corrigé.
- **Intensité du mouvement**, facteur unique appliqué à l'écart `end − start`,
  de la même façon dans `resolveImageMotionFrame` et dans `zoompan`. Elle
  voyage dans le clip, puis dans le manifeste (capacités **v4**), puis dans le
  renderer. Le cadrage de **départ** ne bouge pas : baisser l'intensité
  raccourcit la course, elle ne recadre pas la photo.
- **Trois crans nommés** à l'étape 3 — Discret 40 % · Naturel 70 % · Marqué
  100 %. Les six presets portent désormais exactement l'un de ces trois crans
  (plus de 0,55 ni 0,9 qui ne pouvaient pas s'afficher). Tant que l'utilisateur
  n'a rien choisi, le cran est celui du preset ; une fois choisi, il tient —
  même règle que le rythme depuis L2.
- **`applyImageMotionTransform`** extraite de `VideoEngine` vers `mediaModel.js`
  (qui n'a aucun import) : le test de parité mesure donc le code de production
  chargé tel quel, pas une copie.

Trois choses apprises en chemin, qui n'étaient pas dans le plan :

1. **Un troisième écart de parité, jamais relevé : le décalage n'était pas
   divisé par le zoom.** L'aperçu translate l'image *après* l'avoir agrandie,
   son décalage vaut donc `x/zoom` en coordonnées source ; le renderer écrivait
   `-(x)*iw`. Les panoramiques voyageaient **~11 % trop loin à l'export**
   (zoom 1,12). Corrigé en `-(x)*iw/zoom`.
2. **`zoompan` borne sa fenêtre à l'image, le canvas non.** Un mouvement dont
   la fenêtre sort du cadre diverge franchement entre aperçu et export (74/255
   mesurés sur un cas volontairement débordant). La condition à tenir est
   `|x| ≤ (zoom − 1) / 2` ; les six mouvements livrés la respectent, le plus
   tendu étant `drift-up` (0,045 pour une limite de 0,05). C'est une contrainte
   à connaître avant d'élargir le catalogue en phase 6.
3. **Aux amplitudes des presets, l'erreur de courbe est sous le bruit de
   rééchantillonnage** (~2 px contre ~7/255 de bruit). Aucun seuil sur l'image
   entière ne peut l'y distinguer. Le test embarque donc un cas à **course
   amplifiée** — même chemin de code, cinq fois la course — qui lui donne le
   levier qui lui manquait. Sans lui, le test aurait déclaré « ok » sur un
   renderer resté linéaire.

Écart mesuré aperçu ↔ export après correction, sur 0-255 : **7,3 au pire**
(moyenne par pixel), **2,7 au pire** sur la couleur moyenne d'image. Le reste
est structurel : `zoompan` positionne sa fenêtre sur des pixels entiers, le
canvas non.

**Gate tenu** : `scripts/smoke-vibecut-motion-preview-parity.mjs` — MP4 réels
rendus par la commande que **le renderer construit lui-même**, décodés, comparés
image par image à l'aperçu dans Chromium, sur 6 mouvements/intensités plus le
cas amplifié, à 5 instants chacun. Il porte trois assertions, pas une :

| | Ce qu'elle empêche |
|---|---|
| **Parité** | l'aperçu et l'export divergent |
| **Effet réel** | les deux côtés ignorent l'intensité — ils seraient « en parité » et le test ne vaudrait rien |
| **Sentinelle** | le test devient aveugle : un aperçu volontairement remis en linéaire doit sortir des seuils (mesuré à 22,2 contre un seuil de 12) |

Vérifié en conditions : remettre le renderer en interpolation linéaire fait
échouer le test **même en désactivant la lecture de la commande FFmpeg**, donc
par la seule comparaison d'images.

Plus : `lint`, `build`, `test:vibecut-recipes`, `test:vibecut-ui-v2` (13 tests
navigateur), `test:vibecut-export`, `test:vibecut-xfade-local-mp4`,
`smoke-video-store` (l'intensité arrive bien jusqu'au clip).

**Non fait volontairement** : aucun rollout Cloud Run. Le renderer déployé rend
donc encore un mouvement linéaire *et* un fondu simple ; c'est L6 qui rendra L1
et L3 effectifs en production.

### L4 — Cartes de preset sur médias réels · ✅ livré le 2026-08-01
- `guided/PresetFilmstrip.jsx` : **trois panneaux** tirés des miniatures réelles
  du projet, teintés par le look du preset, enchaînés par sa **vraie** transition
  à son **vrai** tempo (`getStyleTempo`).
- **Trois panneaux et pas deux** : une partition (L2) a une séquence *et* des
  accents. Avec deux plans, « Mixed media » (balayage, poussée, coupe) et
  « Reel dynamique » (coupe sèche) auraient montré la même unique jointure.
- **Repli conservé** : tant qu'aucune miniature n'existe — l'extraction est
  asynchrone — on rend la vignette SVG de la phase 3. Une carte vide aurait été
  un mensonge de plus qu'une illustration générique.
- Cartes plus grandes (200 px), grille 1 → 2 → 3 colonnes. Départ décalé par
  carte conservé, posé **en ligne** pour échapper au piège du raccourci
  `animation` (§ pièges techniques).
- **Gate** : 2 tests navigateur — les vignettes utilisent bien les miniatures
  réelles (3 panneaux, sources mesurées, décalage entre cartes vérifié), **et**
  le repli fonctionne quand on retire le dernier média.

### L5 — Étape rythme visible + traitement titre/audio · ✅ livré le 2026-08-01
- **`guided/BeatStrip.jsx`** : chaque plan est un bloc dont la **largeur est sa
  durée**, chaque coupe minutée une jointure. La géométrie vient de
  `buildBeatStrip()`, **fonction pure** de `styleRecipes.js` — donc testable sans
  navigateur. Présente à l'étape 3 (plan complet + version compacte sur chaque
  carte de rythme) et à l'étape Finaliser (**relue du montage appliqué**).
- **Motif** : l'écran annonçait « 2,72 à 4,57 s ». Deux presets de forme opposée
  peuvent afficher le même intervalle — « Récit », dont les plans raccourcissent,
  ne se distinguait donc pas de « Reel dynamique », dont ils alternent.
- **Problème H fermé** : `titleStyle` et `audioProfile` sont **appliqués**.
  Trois résolveurs purs (`resolveTitleOverlayStyle`, `applyTitleCasing`,
  `resolveAudioProfile`) traduisent le preset en propriétés que l'aperçu **et**
  `drawtext`/`afade` rendent tous les deux — rien d'inventé, aucun réglage
  « aperçu seulement ».
- **La mise en capitales reste réversible** : le champ de l'étape 4 porte le
  texte **brut**, le montage porte le texte habillé. Changer de preset re-style
  le titre déjà posé au lieu de ne l'habiller qu'à la création.
- **Gate** : 2 tests navigateur — la partition se voit et changer de rythme la
  **comprime sans la déformer** (les parts sont conservées à 0,6 % près) ; le
  preset habille vraiment le titre (« mon titre » → « MON TITRE » sous « Reel
  dynamique », retour à « mon titre » sous « Cinéma »).

### L6 — Redéploiement et vérification live · 🟡 **outillé, non déployé**
- **Le pré-vol existe maintenant, il n'est plus manuel.** Le renderer expose
  `GET /capabilities` : il interroge `ffmpeg -h filter=xfade` **dans l'image qui
  tourne** et répond `ok: false` + la liste des cibles manquantes. Lecture seule,
  aucun rendu, aucun coût de calcul.
- `scripts/check-vibecut-renderer-image-capabilities.mjs` le pilote :
  - sans variable → vérifie le FFmpeg **local** (à lancer *avant* le rollout : si
    les cibles manquent déjà ici, inutile de payer un build) ;
  - `VIBECUT_RENDERER_URL=…` → interroge le service **déployé** (à lancer
    *après* le rollout : seule vérification qui porte sur la production).
- **Vérifié localement le 2026-08-01** : 15/15 cibles présentes (FFmpeg 6.0).
- **Reste à faire, et c'est la seule chose** : le rollout lui-même. Il n'a pas
  été exécuté — un déploiement engage des coûts Cloud Build / Artifact Registry
  et relève d'une décision du porteur du projet (AGENTS.md § discipline de
  déploiement).
- **Gate après rollout** : `check-vibecut-renderer-image-capabilities` avec
  l'URL, puis `guard:vibecut-k1-live`, puis un export réel par famille de
  transition vérifié avec `verify:vibecut-k1-cloud-output`.

---

## 10. Ce qu'on ne fait pas, et pourquoi

| Écarté | Raison |
|---|---|
| Les 46 transitions `xfade` | Quantité sans intention. 15 retenues valent mieux, et chacune doit être implémentée à l'identique dans le navigateur — c'est ça, le coût réel. |
| `glitch`, `rgb-split`, `light-leak`, intros/outros dans les presets guidés | Aucun équivalent `xfade`. Exigeraient un rendu image par image. Restent « Aperçu uniquement » dans les autres modes. |
| Curseur d'intensité continu à l'étape 3 | Contraire à « une décision lisible par écran ». Trois crans nommés ici, curseur continu en montage avancé. |
| Détection de tempo musical (battements) | Vraie valeur, mais c'est un projet à part entière. À rouvrir après L6, une fois la structure de battement en place — elle est le socle nécessaire. |
| Douze presets | La demande dit l'inverse : qualité avant quantité. |

---

## 11. Risques

| Risque | Parade |
|---|---|
| Un id `xfade` absent du build Cloud Run casse tous les exports | Vérifier `ffmpeg -h filter=xfade` **dans l'image déployée** avant L6, et garder un repli sur `fade` par transition inconnue |
| L'aperçu navigateur diverge de `xfade` | Chaque transition livrée avec un rendu MP4 local et une comparaison visuelle ; une transition non conforme n'est pas publiée |
| `applyGuidedTemplate` modifié casse l'ancien front | Action **additive** `applyMontageScore`, l'existante n'est pas touchée jusqu'à la phase 7 |
| Coût Cloud Run | Un seul rollout, en L6, après validation locale complète |
| Six pellicules animées en boucle sur médias réels | Miniatures déjà en mémoire, animation CSS composite ; mesurer sur mobile, sinon limiter la boucle aux cartes visibles |
