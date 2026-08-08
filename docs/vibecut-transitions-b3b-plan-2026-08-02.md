# Plan d'implémentation — Lot B3b : les 15 dernières transitions

> Écrit le **2026-08-02**, après le lot B3a (15 → 33 transitions exportables,
> déployé en révision `00007-b5c`).
> Rattaché à [plan.md](../plan.md) § 8 (parité) et à
> [docs/vibecut-bibliotheques-roadmap-2026-08-02.md](vibecut-bibliotheques-roadmap-2026-08-02.md) § 6.
> **État : ✅ TERMINÉ le 2026-08-03.** Les quinze transitions sont exportables,
> le catalogue est à **48 sur 48**, plus aucune entrée n'est « aperçu
> uniquement », `smoke-vibecut-xfade-preview-parity` est **vert**, les **cinq**
> sentinelles sont attrapées, et le rollout Cloud Run est fait
> (révision `00008-8gr`). Ce qui a été mesuré en route, et qui contredit le plan,
> est consigné au § 10 — c'est la partie du document qui a de la valeur pour la
> suite, et le § 10.9 est celle qui coûte le plus cher à réapprendre.

---

## 1. Ce qu'il reste, et pourquoi c'est différent de B3a

B3a a refermé l'écart d'export en **branchant** des entrées du catalogue sur des
transitions `xfade` **natives** de FFmpeg. C'était de la table de correspondance :
la cible existait déjà, il fallait la trouver, la mesurer et l'implémenter au
canvas.

Les **15 qui restent n'ont aucun équivalent natif.** Il faut les **construire**.

| # | Id | Nom affiché | Famille |
|---|---|---|---|
| 1 | `blur-dissolve` | Fondu flouté | Douces |
| 2 | `cross-blur` | Flou croisé | Douces |
| 3 | `motion-blur` | Flou de mouvement | Dynamiques |
| 4 | `cross-zoom` | Zoom croisé | Dynamiques |
| 5 | `snap-zoom` | Zoom sec | Dynamiques |
| 6 | `parallax-zoom` | Zoom parallaxe | Dynamiques |
| 7 | `additive-dissolve` | Dissolution lumineuse | Douces |
| 8 | `light-leak` | Fuite lumineuse | Lumière |
| 9 | `strobe-cut` | Stroboscope | Lumière |
| 10 | `glitch` | Glitch | Stylisées |
| 11 | `rgb-split` | Décalage RVB | Stylisées |
| 12 | `chromatic` | Aberration chromatique | Stylisées |
| 13 | `intro-title-scan` | Ouverture titre | Ouverture & fin |
| 14 | `intro-grid-reveal` | Révélation mosaïque | Ouverture & fin |
| 15 | `intro-neon-doors` | Ouverture en volets | Ouverture & fin |

Aboutir donne **48 transitions exportables sur 48** : plus aucune entrée
« Aperçu uniquement » dans la bibliothèque.

---

## 2. La décision d'architecture — et pourquoi la voie évidente est écartée

### 2.1 Ce qui a été mesuré le 2026-08-02

`xfade` accepte `transition=custom:expr='…'`, une formule évaluée **par pixel et
par plan**. Tout est atteignable ainsi : échantillonnage à coordonnées
arbitraires (`a0/a1/a2`, `b0/b1/b2`), mélange additif, conditions par ligne.
**Le problème est le coût.**

Mesures faites sur un Mac (machine rapide), une transition de **0,6 s** :

| Chemin | 1080p | 720p | 1080×1920 |
|---|---|---|---|
| `xfade` natif (ce qui tourne aujourd'hui) | **0,2 s** | — | — |
| `xfade=custom` — zoom croisé | **8,6 s** | 4,0 s | 8,4 s |

Et le **plancher** de la voie par expression, mesuré avec la formule la plus
triviale possible (un simple fondu réécrit en expression) : **4,0 s** pour 1 s en
1080p, contre 0,1 s en natif. Le facteur ~40 est **inhérent** à l'évaluateur
d'expressions de FFmpeg, il ne vient pas de la complexité des formules.

> **Conséquence** : un montage à 6 transitions de ce type ajouterait **2 à 4
> minutes** à chaque export sur un Mac, davantage sur Cloud Run (2 vCPU, plus
> lent), qui est **facturé à la seconde**. Cette voie est **écartée**.

### 2.2 La voie retenue : filtres natifs sur la QUEUE de A et la TÊTE de B

Un « fondu flouté » n'est pas une formule par pixel : c'est **un flou qui monte
sur la fin du premier plan, un fondu, et un flou qui redescend sur le début du
second**. La même remarque vaut pour presque tous les 15.

```
[A]  …filtre(s) rampé(s) sur les d dernières secondes…  [A']
[B]  …filtre(s) rampé(s) sur les d premières secondes… [B']
[A'][B']  xfade=transition=<natif>:duration=d:offset=…   [sortie]
         └─ éventuellement suivi d'un overlay / blend pour les halos
```

Mesures de la même transition de 0,6 s en 1080p par cette voie :

| Brique | Temps |
|---|---|
| `gblur` avec rampe `sendcmd` | **0,4 s** |
| `zoompan` avec rampe | **0,2 s** |
| `rgbashift` | **0,4 s** |
| `scale`+`crop` | 0,2 s |

**20 à 40 fois plus rapide, pour le même effet.** Et bénéfice secondaire décisif :
cette forme **correspond à ce que le canvas fait déjà** — `renderTransition`
dessine A et B séparément avant de les composer. La parité devient directe au
lieu d'exiger de réécrire la formule FFmpeg en JavaScript.

### 2.3 Faire varier un filtre dans le temps

Deux mécanismes, tous deux vérifiés :

- **`sendcmd`** : `sendcmd=c='1.000 gblur sigma 4.6;1.050 gblur sigma 9.2;…'`
  Change une option à des instants donnés. **Par paliers**, donc il faut assez de
  paliers (12 sur 0,6 s = un palier toutes les 50 ms, suffisant). Les horodatages
  sont sur le **PTS de l'entrée concernée** : pour A la fenêtre est
  `[durée_A − d, durée_A]`, pour B c'est `[0, d]`.
- **Filtres à expression de temps** : `zoompan` (`z='…on…'`), `overlay`
  (`x='…t…'`, `enable='between(t,…)'`), `crop` (`x`/`y` par image).

---

## 3. Faits techniques établis le 2026-08-02 — à ne pas re-découvrir

1. **`a0()` échantillonne TOUJOURS le plan 0.** Pour lire le plan courant il faut
   aiguiller : `if(eq(PLANE,0), a0(x,y), if(eq(PLANE,1), a1(x,y), a2(x,y)))`.
   Sans cet aiguillage on obtient une image verte en YUV, noire en RGB.
   *(Utile si une expression reste nécessaire quelque part.)*
2. **Les coordonnées se comportent à l'identique en `yuv420p` et en `gbrp`.** Le
   sous-échantillonnage de chroma est géré par FFmpeg : pas besoin de convertir
   en RGB pour les effets géométriques.
3. **Un échantillonnage hors cadre est RABATTU sur le bord** (`a0(X-40,Y)` en
   x=0 rend le pixel de gauche), pas transparent. Le canvas ne fait pas ça
   spontanément : à reproduire.
4. **`displace` prend TROIS entrées** (source, carte X, carte Y). Le test du
   2026-08-02 a échoué sur l'arité du graphe, **pas** sur la disponibilité du
   filtre.
5. Chaque plan est déjà normalisé en `format=yuv420p` avant la transition
   (`server.js` ligne ~451) et la sortie force `-pix_fmt yuv420p`.

---

## 4. Le chantier structurel dans le renderer

`buildFfmpegArgs` n'émet aujourd'hui **qu'une seule ligne** par transition :

```js
filterParts.push(`${currentLabel}${nextLabel}xfade=transition=${xfadeName}:duration=…:offset=…${outputLabel}`);
```

Il faut pouvoir émettre un **sous-graphe** : des étiquettes intermédiaires
uniques, des filtres sur chaque entrée, et éventuellement un `overlay`/`blend`
après le `xfade`.

**Forme cible**

```js
// render-service/src/server.js
const spec = resolveTransitionSpec(transition.type, { duration, offsetInA, index });
// spec = {
//   pre:  [ '[in]filtre…[a1]', … ],   // sous-graphe appliqué à A et/ou B
//   xfade: 'fade',                     // cible native utilisée pour la jointure
//   post: [ '…overlay…' ],             // après la jointure, optionnel
// }
```

**Trois contraintes à respecter**

- Les étiquettes intermédiaires doivent être **uniques** (le graphe enchaîne
  plusieurs transitions) : préfixer par l'index de la coupe.
- Les horodatages `sendcmd` de A sont **relatifs à la fin de A**, ceux de B au
  début de B. Se tromper décale l'effet hors de la fenêtre — et ça ne se voit pas
  sur une transition isolée, seulement au milieu d'un montage. **Le test doit
  porter sur un enchaînement d'au moins trois plans.**
- La table doit rester **dupliquée à l'identique** entre `exportManifest.js`,
  `functions/src/videoExport.js` et `render-service/src/server.js` :
  `smoke-vibecut-transition-parity` le vérifie, et c'est voulu.

---

## 5. Les 15, une par une

`d` = durée de la transition, `q` = progression 0 → 1 sur la fenêtre.
Les valeurs d'intensité sont des **points de départ à régler à la mesure**, pas
des constantes sacrées.

### Groupe 1 — Flous *(valide le mécanisme `sendcmd`)*

| Id | Serveur | Canvas | Parité attendue |
|---|---|---|---|
| `blur-dissolve` | A : `gblur` σ 0→S ; B : σ S→0 ; `xfade=fade`. S ≈ 0,012×largeur | `ctx.filter = blur(Npx)` sur chaque dessin | **Écart structurel** : le noyau canvas n'est pas celui de `gblur`. Même classe que `blur-cut`/`hblur`, déjà toléré à 30 de `meanPixel`. |
| `cross-blur` | Idem mais σ monte sur **les deux** vers le milieu (A : 0→S, B : S→0, S plus fort) + `xfade=fade` | idem | idem |
| `motion-blur` | Flou **directionnel** : `avgblur=sizeX=N:sizeY=1` rampé + léger glissement ; `xfade=fade` | Accumulation de dessins décalés horizontalement (le `blur()` du canvas est isotrope) | idem |

⚠️ **À trancher à l'implémentation** : `blur-dissolve` et `cross-blur` risquent de
se ressembler. Les distinguer vraiment (intensité **et** courbe) ou fusionner et
l'assumer — mais **pas** deux entrées identiques à un nom près (c'est le reproche
fait aux presets au lot L2).

### Groupe 2 — Zooms *(l'inconnue technique principale)*

| Id | Serveur | Canvas |
|---|---|---|
| `cross-zoom` | A : zoom 1→1,6 ; B : zoom 1,6→1 ; `xfade=fade` | `drawImage` mis à l'échelle autour du centre — **exact** |
| `snap-zoom` | Idem, courbe `q³`, amplitude plus forte, fenêtre plus courte | exact |
| `parallax-zoom` | A : zoom avant + panoramique gauche ; B : zoom arrière + panoramique droite | exact |

⚠️ **À VÉRIFIER EN PREMIER** : `zoompan` est conçu pour des images fixes ; son
comportement sur une **entrée vidéo** doit être testé avant tout le reste.
Replis, dans l'ordre : `scale` + `crop` à `x`/`y` variables (mais `w`/`h` sont
figés à l'initialisation, donc pas de zoom rampé par ce biais seul), ou une
succession de segments. **Si aucun repli ne tient, ces trois-là sont les
candidats les plus sérieux à un abandon assumé.**

⚠️ **Problème I** : tout zoom doit tenir `|x| ≤ (zoom − 1) / 2`, sinon la fenêtre
sort du cadre et l'aperçu diverge de l'export.

### Groupe 3 — Lumière

| Id | Serveur | Canvas |
|---|---|---|
| `additive-dissolve` | `xfade=fade` puis `eq=brightness=` rampé en cloche (`sin(πq)`) | Mélange + blanc additif (`globalCompositeOperation='lighter'`) — **exact** |
| `light-leak` | Dégradé chaud **généré petit** puis `scale`, déplacé par `overlay` `x='…t…'`, composé en `blend=addition` | Dégradé additif | Petit écart sur la forme de la décroissance : tolérer et documenter |
| `strobe-cut` | **Ne rentre pas dans le modèle queue/tête** : c'est un effet de *temps*, pas d'espace. Piste : `overlay` de B sur A avec `enable='between(t,…)'` à fréquence et rapport cyclique croissants | Choix plein cadre entre A et B — **exact** |

⚠️ `strobe-cut` demande une **conception à part**. Si la piste `overlay`+`enable`
ne tient pas, la solution propre est de découper la fenêtre en segments alternés
et de les concaténer — plus lourd dans le graphe, mais natif et rapide.

### Groupe 4 — Numérique *(le plus difficile)*

| Id | Serveur | Canvas |
|---|---|---|
| `rgb-split` | `rgbashift=rh=-K·q:bh=K·q` rampé sur A et B + `xfade=fade` | Trois dessins additifs masqués en rouge / vert / bleu, décalés — **exact** |
| `chromatic` | Aberration **radiale** : séparer les canaux, appliquer un zoom **légèrement différent** par canal, recomposer (`rgbashift` est uniforme, donc insuffisant) | Trois dessins à trois échelles légèrement différentes, additifs — **exact** |
| `glitch` | `displace` avec une carte de bruit **générée petite** (lignes décalées) + `rgbashift`, rampés, sur une coupe franche | Décalage de lignes + décalage de canaux | La carte doit être **déterministe et identique des deux côtés** : une formule fixe, jamais un tirage aléatoire |

### Groupe 5 — Ouvertures de séquence

| Id | Serveur | Canvas |
|---|---|---|
| `intro-title-scan` | `xfade=wiperight` + barre lumineuse additive suivant le bord (`overlay` `x='…t…'`) | Volet net + barre — exact |
| `intro-grid-reveal` | Masque de blocs **généré en petit** (ex. 16×9), seuillé par image avec `geq` **sur la petite image** (donc peu coûteux), agrandi en `neighbor`, servant d'alpha à un `overlay` | Même grille, même fonction de hachage — **exact** |
| `intro-neon-doors` | `xfade=vertopen` + deux barres lumineuses additives sur les bords des volets | exact |

⚠️ **Question produit à poser au porteur du projet** : ces trois-là sont des
**ouvertures**, conçues pour démarrer une séquence, pas pour joindre deux plans.
Faut-il les garder comme transitions, les déplacer ailleurs, ou les retirer ? Ça
peut réduire le lot de 15 à 12.

---

## 6. La parité, et ce qu'il faut changer au banc d'essai

`scripts/smoke-vibecut-xfade-preview-parity.mjs` compare aujourd'hui le canvas à
**une** transition native, en itérant sur les **cibles** `xfade`. Il faut :

1. **Itérer sur les ids VibeCut**, pas sur les cibles (plusieurs ids partagent une
   cible, et les 15 nouvelles n'ont pas de cible unique).
2. Construire le côté FFmpeg **avec le même code que le renderer** — exporter un
   `buildTransitionSubgraph()` depuis `render-service/src/server.js` et l'appeler
   dans le test. Réécrire le graphe dans le test ne prouverait rien : c'est
   exactement le défaut que le lot L1 a corrigé.
3. Garder la règle du lot B3a : **tout point d'échantillonnage doit tomber sur une
   image entière** (l'assertion existe déjà, ne pas la retirer).
4. Déclarer une tolérance par id, **avec sa raison**, comme aujourd'hui.

**Sentinelle** (exigée par `plan.md` § 10) : pour chaque effet, rejouer
volontairement le défaut que le test doit attraper — par exemple un flou qui ne
rampe pas, un décalage RVB dans le mauvais sens — et vérifier que le test
**échoue**. Un test de parité qui passe toujours ne prouve rien.

---

## 7. Le gate du lot

1. **Parité image par image** sur les 15, tolérance justifiée par id.
2. **Temps de rendu mesuré et plafonné.** Repère : une transition native de 0,6 s
   en 1080p coûte **0,2 s**. **Plafond décidé AVANT l'implémentation : 1,2 s**
   (six fois le natif) pour une transition de 0,6 s en 1080p, sur la machine de
   développement. Au-delà, l'effet est refusé ou simplifié — c'est ce plafond qui
   empêche de retomber par glissement dans la voie par expression.
3. **Un enchaînement d'au moins trois plans** rendu en MP4 réel, pour attraper les
   erreurs d'horodatage `sendcmd` qu'une transition isolée ne révèle pas.
4. `smoke-vibecut-library-parity` : **48 exportables, 0 en aperçu seul.**
5. `lint`, `build`, `test:scope`, `test:vibecut-ui-v2`, `test:vibecut-library`,
   `test:vibecut-export`, `test:vibecut-xfade-local-mp4`.
6. **UN seul rollout Cloud Run**, à la toute fin, puis vérification de
   `/capabilities` sur le service réel et report de la révision.

---

## 8. Ordre de travail conseillé

| Étape | Contenu | Pourquoi à ce rang |
|---|---|---|
| **0** | Tester `zoompan` sur une entrée **vidéo** | C'est l'inconnue qui peut coûter trois transitions. À lever avant d'écrire quoi que ce soit. |
| **1** | Chantier structurel du renderer (sous-graphes, étiquettes, `sendcmd`) + banc d'essai de parité par id | Rien n'est vérifiable avant. |
| **2** | Groupe 1 — flous | Valide `sendcmd` de bout en bout sur le cas le plus simple. |
| **3** | Groupe 2 — zooms | Le plus payant visuellement, et exact des deux côtés. |
| **4** | Groupe 3 — lumière | `strobe-cut` demande sa propre conception. |
| **5** | Groupe 5 — séquence | Après la question produit du § 5. |
| **6** | Groupe 4 — numérique | Le plus difficile, à faire quand tout le reste est rodé. |
| **7** | Catalogue, compteurs, gates, **rollout unique** | |

---

## 9. Risques

| Risque | Parade |
|---|---|
| **Retomber dans la voie par expression** parce qu'elle est plus simple à écrire | Le plafond de temps du § 7.2, mesuré par un test. |
| `zoompan` inutilisable sur vidéo | Étape 0. Si aucun repli ne tient, abandonner les trois zooms **explicitement** plutôt que de livrer un effet faux. |
| Horodatages `sendcmd` décalés au milieu d'un montage | Le test à trois plans du § 7.3. |
| Les flous ne coïncideront jamais au pixel près | Écart structurel assumé et borné, comme `blur-cut` aujourd'hui (problème G). |
| `blur-dissolve` et `cross-blur` indiscernables | Les distinguer vraiment ou fusionner — décision à prendre, pas à éviter. |
| Le graphe devient illisible | Un `resolveTransitionSpec` par transition, testé isolément. |

---

## 10. Ce que l'implémentation a appris — écrits le 2026-08-03

Le plan tenait sur l'essentiel : la voie par expression est bien trop chère, les
filtres natifs rampés font le travail, et `zoompan` marche sur une entrée vidéo.
Trois choses se sont passées autrement, et ce sont elles qu'il faut retenir.

### 10.1 `zoompan` sur vidéo : levé, et sans réserve (étape 0)

Mesuré le 2026-08-03 : sur une entrée vidéo, `zoompan` avec `d=1` ne fige pas le
contenu, ne duplique aucune image (100 images entrées, 100 sorties), et son
compteur `on` est **exact à l'image près** — vérifié avec une marche
(`z = 1 + 0,5·gte(on,50)`), qui bascule exactement à l'image 50. Les trois zooms
étaient donc les moins risqués du lot, pas les plus risqués.

Une fausse alerte au passage, notée pour ne pas la repayer : la géométrie
semblait fausse de ~20 %. Ce n'était pas `zoompan`, c'était la **plage limitée**
du YUV encodé (16-235) relue en `gray`. Le modèle de fenêtre du renderer, hérité
du lot L3, était juste depuis le début.

### 10.2 `sendcmd` est inutilisable ici — et seul un montage à trois plans le disait

C'était la voie prévue par le plan pour rampe toute intensité. Elle est
**condamnée**, pour deux raisons mesurées :

1. **`sendcmd` diffuse à tous les filtres du graphe qui portent le nom visé**, pas
   à celui qui le suit. Un montage à deux coupes a quatre `sendcmd` et quatre
   `gblur`, et chacun des quatre pilotait les quatre. La commande « sigma 0 » qui
   clôt la première coupe arrivait au milieu de la rampe de la seconde et
   l'écrasait : **la deuxième coupe rendait un fondu simple**, sans que rien ne le
   signale. Écart-type mesuré au milieu de la deuxième coupe : **52,7 avec les
   deux coupes, 42,9 avec la deuxième seule.**
2. La parade documentée — nommer l'instance, `gblur@b3b2a` — **ne fonctionne pas**
   dans le build FFmpeg 6.0 de référence : la déclaration est acceptée, la
   commande n'arrive jamais. Vérifié en visant `gblur`, puis `gblur@z`, puis `@z`.

**Ce qui remplace `sendcmd`** : une **chaîne de douze instances** du même filtre,
chacune à valeur constante et ouverte sur un douzième de la fenêtre par sa propre
porte `enable`. Une seule agit par image, les onze autres laissent passer. Aucune
commande ne circule, donc rien ne peut se télescoper — et la quantification
devient *exactement* celle que l'aperçu modélise, au lieu d'en dépendre.

Le plan disait « le test doit porter sur un enchaînement d'au moins trois plans ».
Il avait raison pour la mauvaise raison : ce n'est pas un horodatage mal calculé
qui a mordu, c'est un mécanisme qui ne fait pas ce que sa documentation annonce.
**Un test sur deux plans n'aurait rien vu.**

### 10.3 Le découpage en segments dérive — trois morceaux, pas treize

Le premier remplacement de `sendcmd` découpait la fenêtre en douze segments
concaténés. **`concat` déduit le décalage de chaque segment de la durée du
précédent, et cette déduction dérive** : huit images de trop sur cent huit avec
treize morceaux par côté. Avec des bornes en **secondes** plutôt qu'en numéros
d'image, c'était une image *perdue* sur 102 — donc tout le montage décalé d'un
trentième de seconde et l'audio désynchronisé.

Le découpage survit, mais **limité à trois morceaux** (avant / fenêtre / après) et
**en numéros d'image**, pour confiner les quatre effets qui doivent sortir du
`yuv420p`. À trois morceaux, il est exact — le test à trois plans compte les
images à chaque exécution. Il faut aussi un `settb=1/fps` derrière, sinon `xfade`
refuse de joindre un flux recollé (base 1/1000000) à un flux intact (base 1/fps).

### 10.4 Le coût : la vraie dépense n'est pas l'effet, c'est l'espace colorimétrique

Mesuré sur une transition de 0,6 s en 1080p : l'aller-retour
`yuv420p → gbrp → yuv420p`, posé sur tout le flux, coûte **1,1 s à lui seul** —
quatre fois l'effet. Une porte `enable` n'y change rien : elle empêche l'effet,
pas la conversion. C'est en confinant la fenêtre que l'aberration chromatique
tombe de **2,20 s à 0,83 s** et le glitch de **1,77 s à 0,64 s**.

Résultat final, plafond fixé à 1,2 s :

| Transition | Temps | Rapport au natif |
|---|---|---|
| *(référence native `crossfade`)* | *0,23 s* | *×1,0* |
| strobe-cut | 0,15 s | ×0,6 |
| intro-title-scan · intro-grid-reveal · intro-neon-doors | 0,22 – 0,27 s | ×1,0 – 1,1 |
| cross-zoom · snap-zoom · parallax-zoom · additive-dissolve | 0,28 – 0,30 s | ×1,2 – 1,3 |
| light-leak · motion-blur · blur-dissolve · cross-blur | 0,42 – 0,49 s | ×1,8 – 2,1 |
| glitch | 0,64 s | ×2,7 |
| rgb-split · chromatic | 0,82 – 0,84 s | ×3,5 – 3,6 |

### 10.5 Trois faits FFmpeg relevés à la mesure, pas déduits

- **`displace` lit `out(x) = in(x + carte − 128)`** : une carte supérieure à 128
  fait glisser l'image vers la **gauche**. L'aperçu, lui, dessine à un décalage de
  *destination* — les deux écritures sont donc inverses l'une de l'autre.
- **`extractplanes=r+g+b` sort le rouge en 0, le vert en 1, le bleu en 2**, et
  `[vert][bleu][rouge]mergeplanes=0x001020:gbrp` est l'identité exacte
  (255,128,0 rendu 255,128,0). Vérifié en éteignant chaque sortie à tour de rôle.
- **Le sous-échantillonnage de chroma du `yuv420p` étale les franges de couleur
  sur deux pixels** et l'aperçu, qui travaille en RVB plein, ne peut pas le
  reproduire. Forcer `gbrp` autour du glitch fait tomber l'écart de **23 à 4** sur
  255. Ce n'était pas un réglage raté, c'était l'espace colorimétrique.

### 10.6 Les deux questions laissées ouvertes, et leur réponse

- **`blur-dissolve` et `cross-blur` indiscernables** — tranché en les séparant
  vraiment : `ramp` (A part net et se floute, B arrive floue et se résout — à
  aucun instant les deux ne sont flous) contre `bell` (les deux culminent
  ensemble au milieu, deux fois plus fort — il y a donc un instant où toute
  l'image est illisible). Différence de **courbe autant que d'intensité**.
- **Les trois ouvertures de séquence** — décision du porteur du projet le
  2026-08-03 : **gardées comme transitions et rendues à l'export**, mais la
  bibliothèque **dit** désormais qu'elles sont pensées pour le début d'une
  séquence. Le lot est resté à 15.

### 10.7 Le badge de la bibliothèque a changé de rôle

Il disait « Export Pro » ou « Aperçu uniquement ». Les quarante-huit entrées
étant maintenant rendues, le premier libellé serait sur **toutes** les cartes : un
badge que tout le monde porte ne distingue rien. Même chose pour le filtre
« Export Pro », qui ne retirait plus une seule entrée — un contrôle qui ne filtre
jamais est un bouton mort, interdit par `plan.md` § 4.2.

Les deux portent donc l'information qui, elle, partage encore le catalogue :
**ouverture / fin de séquence**, et le filtre « Entre deux plans » (41 sur 48).
L'avertissement d'export n'est pas supprimé : il est lu **à l'exécution**, donc il
reviendrait de lui-même si une capacité serveur disparaissait.

### 10.8 Deux bugs trouvés par les tests, pas par la relecture

- **La deuxième coupe rendait un fondu simple** (§ 10.2) — trouvé par
  `smoke-vibecut-transition-chain-mp4`, invisible sur deux plans.
- **Un bloc de `intro-grid-reveal` était révélé dès q = 0**, donc avant le début
  de la transition : le seuil du bloc valait exactement 0 et `gte(0, 0)` est vrai.
  Trouvé par l'assertion « hors fenêtre, rien ne bouge », elle-même ajoutée
  **parce qu'une sentinelle avait montré que le test ne la portait pas**.

### 10.9 L'outil qui injecte des défauts en laisse un derrière lui — écrit le 2026-08-03

C'est le fait le plus coûteux du lot, et il n'est pas dans FFmpeg.

`smoke-vibecut-transition-sentinels` **écrit de vrais défauts dans le code de
production**, relance le test, puis restaure les fichiers depuis un instantané
pris à son démarrage. C'est ce qui lui donne sa valeur — il patche la production,
donc il prouve quelque chose sur la production. C'est aussi ce qui le rend
dangereux : **interrompu, il laisse son défaut en place.**

C'est ce qui s'est passé. La session du 2026-08-03 s'est terminée avec, dans
`xfadeTransitions.js`, la charge exacte de la quatrième sentinelle :

```js
const qStep = clamp(t, 0, 1);      // le défaut injecté
const qStep = quantizeProgress(t); // ce que la production doit dire
```

L'aperçu lisait donc la courbe **en continu** alors que l'export avance par
**douze paliers**. Et le symptôme n'a pas été lu comme un bug : il a été lu comme
du **bruit de rasterisation Chromium**, et le seuil a été monté deux fois pour
l'absorber. La table de tolérances portait une justification écrite — « 1,1 à vide
contre 5,3 sous charge, pour un effet strictement identique » — qui décrivait un
phénomène qui n'existe pas.

**Ce qui a tranché, et qui aurait tranché à la première minute** : mesurer deux
fois de suite sans rien changer entre les deux. Les deux exécutions ont rendu des
valeurs **identiques au dixième** sur les quinze transitions. Il n'y avait aucun
bruit à absorber.

Et l'écart se **prédisait**. Sur `additive-dissolve`, α = 0,30 × sin(π q) :

| Point | q quantifié | Δα × 255 **prédit** | meanFrame **mesuré** |
|---|---|---|---|
| 0,4 | 4/12 | 6,5 | 6,0 |
| 0,6 | 7/12 | 1,1 | 2,0 |
| 0,8 | 9/12 | 9,1 | 8,9 |

Une erreur qu'on sait prédire au dixième n'est pas du bruit.

**Trois signes de reconnaissance**, dans l'ordre où ils auraient dû être vus :

1. `quantizeProgress` était **exportée et appelée nulle part** dans tout le dépôt.
   Une fonction morte dont un commentaire voisin dit qu'elle est indispensable est
   un aveu.
2. Le motif que la sentinelle **cherche** (`const qStep = quantizeProgress(t);`)
   était absent du fichier, et celui qu'elle **écrit** était présent. Le script
   dit lui-même quel est l'état sain.
3. `additive-dissolve` est la seule des quinze dont l'effet est *purement* une
   intensité rampée sans géométrie : c'est donc la seule dont l'écart se lit
   entièrement dans `meanFrame`. Elle n'était pas la transition fragile, elle était
   le **détecteur** — les quatorze autres cachaient le même défaut sous leur écart
   géométrique.

**Trois règles qui en sortent :**

- Après toute exécution de `smoke-vibecut-transition-sentinels`, et **surtout
  après une interruption**, vérifier `git diff` sur les deux fichiers qu'il patche
  avant de conclure quoi que ce soit d'un test.
- **Ne jamais monter un seuil de parité pour faire passer un test.** Mesurer deux
  fois d'abord. Si les deux mesures coïncident, l'écart est un bug. Le seuil de 8
  qui échouait avait raison, et le monter revenait à faire taire le seul test qui
  disait vrai.
- Une justification de seuil doit citer **une mesure datée**, pas un mécanisme
  plausible. « Chromium rasterise différemment sous charge » se lit comme une
  explication ; ce n'en était pas une, et rien dans la table ne permettait de le
  voir. Les seuils du lot portent maintenant leur pire mesure réelle, et ont été
  **resserrés** en conséquence (`meanFrame` de 8 à 4-6 pour douze des quinze).
