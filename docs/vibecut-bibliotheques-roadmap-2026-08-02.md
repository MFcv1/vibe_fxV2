# Roadmap — Les deux bibliothèques VibeCut

> Document d'implémentation, demandé le **2026-08-02**.
> Rattaché à [plan.md](../plan.md) § 4 (direction artistique) et § 7 (phase 5),
> et à [todo.md](../todo.md).
> **État : à faire. Lot B1 en premier.**
> **Révisé le 2026-08-02** après recherche sur DaVinci Resolve, Final Cut Pro et
> CapCut : le séparateur avant/après est remplacé par le **hover scrub** et le
> **bypass** (§ 3.3 à 3.5).

---

## 1. La demande

> « L'idée c'est de créer la **fondation du design des deux bibliothèques** avec
> les avant/après. On reste sur le thème **OS Apple ultra moderne** comme pour les
> 3 modes, mais cette fois-ci il faut **blinder le design** : c'est important que
> ça claque, pour que l'utilisateur passe du temps à apprécier les animations. La
> page doit vraiment **donner envie de cliquer et de parcourir** les animations.
>
> Tu peux créer les bibliothèques avec les animations / mouvements et transitions
> **déjà en place**. On verra plus tard, une fois que tout ça sera calé, pour
> ajouter des mouvements / effets — en sachant qu'on a **très peu d'effets** à
> mettre pendant les rushs comparé à Premiere Pro ou DaVinci Resolve, donc il
> faudra travailler là-dessus — et d'autres transitions, même si là on a plus de
> contenu. »

**Deux bibliothèques distinctes, et la distinction est produit, pas technique :**

| Bibliothèque | Quand ça intervient | Ce que ça modifie |
|---|---|---|
| **Mouvements & effets** | **PENDANT** un rush | Le plan lui-même : son cadrage, sa couleur, sa vitesse |
| **Transitions** | **ENTRE** deux rushs | La jointure : la fin de l'un et le début de l'autre |

Référence visuelle fournie (capture d'une bibliothèque de transitions) : à lire
pour les **idées d'ergonomie**, explicitement **pas pour le style graphique**.

---

## 2. Ce qui existe vraiment aujourd'hui — inventaire vérifié le 2026-08-02

Aucune ligne du plan ne doit reposer sur du contenu qui n'existe pas.

### 2.1 Transitions — 38 entrées, 7 familles

| Famille | Nombre | Exemples |
|---|---|---|
| Essentielles | 4 | Fondu enchaîné, Coupe adoucie, Passage au noir, Passage au blanc |
| Douces | 6 | Dissolution film, Fondu désaturé, Fondu flouté, Flou croisé… |
| Dynamiques | 5 | Balayage rapide, Flou de mouvement, Zoom croisé, Zoom sec… |
| Glissements & volets | 10 | Balayages, poussées, volets, iris, coupe pixellisée, coupe floutée |
| Lumière | 3 | Flash, Fuite lumineuse, Stroboscope |
| Stylisées | 3 | Glitch, Décalage RVB, Aberration chromatique |
| Ouverture & fin | 7 | Ouverture cinéma, Révélation mosaïque, Fin cinéma… |

**15 sont rendues à l'export** (les natives `xfade` du lot L1, déployées en
production depuis le 2026-08-01). **23 sont « Aperçu uniquement ».**

### 2.2 Mouvements — 13 entrées, dont **6 réelles**

| État | Entrées |
|---|---|
| **Disponibles** (aperçu **et** export, parité prouvée au pixel) | Fixe, Zoom avant, Zoom arrière, Panoramique gauche, Panoramique droite, Montée douce |
| **Prévues** (listées, marquées « Bientôt », aucun réglage exposé) | Descente douce, Orbite, Parallaxe, Rotation, Apparition, Rebond, Glitch |

⚠️ Les 6 mouvements réels ne s'appliquent **qu'aux photos**. Le moteur ne les
applique pas encore aux vidéos.

### 2.3 Autres effets « pendant le rush »

- **Colorimétrie** : 6 réglages exposés (exposition, contraste, saturation,
  température, vignettage, grain), rendus des deux côtés.
- **Vitesse** : jouée par l'aperçu, **pas rendue par le serveur** → badge
  « Aperçu uniquement », et le pré-vol de l'export la refuse.
- **Transformation** : rotation 0/90/180/270, rendue des deux côtés.

**Constat honnête, qui commande le lot B3** : côté « pendant le rush », VibeCut
a *6 mouvements + 6 réglages de couleur*. Premiere et DaVinci en ont des
centaines. Le porteur du projet l'a lui-même relevé. **Le lot B1 ne doit donc pas
être dimensionné comme une vitrine de catalogue géant** : il doit être
dimensionné pour rendre *désirable* un contenu encore restreint, et pouvoir
absorber le contenu à venir sans être redessiné.

### 2.4 Ce qui est déjà construit (phase 5, 2026-08-01)

```
src/features/vibecut/library/
├── TransitionLibrary.jsx     écran transitions
├── MotionLibrary.jsx         écran mouvements
├── TransitionPreview.jsx     canvas piloté par renderTransition DU MOTEUR
├── MotionPreview.jsx         canvas piloté par applyImageMotionTransform
├── previewTicker.js          UNE horloge partagée + prefers-reduced-motion
├── useLibraryImages.js       miniatures réelles du projet, repli dessiné
└── library.module.css
```

**Acquis à ne pas casser** : les vignettes sont dessinées **par le moteur**, pas
imitées en CSS. C'est ce qui interdit à une carte de mentir sur le rendu, et ça
les fait couvrir gratuitement par les tests de parité L1 et L3. **Toute
refonte du design doit conserver ce chemin.**

---

## 3. Ce qu'on prend de la référence — et ce qu'on jette

### 3.1 On prend (idées d'ergonomie)

| Idée | Pourquoi |
|---|---|
| **L'idée avant / après** | On ne comprend un effet qu'en le comparant à son absence. ⚠️ On garde l'**idée**, pas la **forme** : le séparateur déplaçable est écarté au profit d'un **bypass** — voir § 3.3. |
| Grande zone d'aperçu + panneau de réglages à côté | Sépare « regarder » de « régler ». |
| **Favoris (étoile) sur chaque carte** | Réponse directe au besoin : retrouver ses préférés dans le montage avancé, où il n'y a pas la place d'afficher des aperçus. |
| Familles + recherche | 38 transitions, ça se cherche. |
| Bande de contexte en bas (Scène 04 → transition → Scène 05) | Montre **où** ça s'applique. Sans elle, « Appliquer » est abstrait. |
| Badge de compatibilité export | Déjà en place, à mettre plus en valeur. |

### 3.2 On jette (style graphique)

- Le rail latéral gauche à 9 entrées : VibeCut a **un seul bandeau supérieur**
  (`plan.md` § 4.4). On n'ajoute pas un second système de navigation.
- Les fonds bleutés, les icônes en pastille sur chaque vignette, la densité.
- Les intitulés anglais.

### 3.3 Ce que font vraiment les outils professionnels — vérifié le 2026-08-02

Le premier jet de ce document proposait un **avant/après avec séparateur
déplaçable**. Le porteur du projet a demandé si c'était le bon outil quand la
bibliothèque est grande. Recherche faite : **non**, et les trois références font
toutes autre chose.

| Outil | Ce qu'il fait dans la grille | Après le clic |
|---|---|---|
| **DaVinci Resolve** | **« Hover Scrub Preview »** : on survole la vignette et on **balaye horizontalement**, la position du curseur *est* le temps | Aperçu dans le viewer, sur **les deux plans les plus proches du point de montage** |
| **Final Cut Pro** | **« Skimming »** : identique, avec une barre verticale rouge qui suit le pointeur. Ne déplace pas la tête de lecture | Idem |
| **CapCut** | Mini-aperçu animé au survol de la tuile | Aperçu plein cadre **avec le contenu de l'utilisateur** |

**Le motif convergent, et c'est celui qu'on adopte :**

> La position horizontale du pointeur sur la vignette **est** le curseur de temps.
> Aucun clic, aucun bouton lecture. On balaye la grille et on a auditionné vingt
> effets en cinq secondes.

**Pourquoi le séparateur avant/après était un mauvais choix ici** — et la raison
vaut d'être écrite, parce qu'elle vaut pour tout ce genre d'écran :

- Un séparateur compare deux états d'un **même instant**, coupés dans l'**espace**.
- Or un mouvement et une transition sont des différences dans le **temps**.
- Sur un mouvement, les deux moitiés montreraient deux cadrages différents de la
  même photo : une image **cassée en deux**, pas une démonstration.
- Sur une transition, pendant 80 % de la durée les deux moitiés sont
  **identiques** — il n'y a rien à comparer avant la coupe.

**Où le séparateur reste le bon outil** : la **colorimétrie**. Un étalonnage est
une différence spatiale sur une image figée. À garder en réserve pour une future
bibliothèque de looks — l'idée n'est pas jetée, elle est rangée au bon endroit.

### 3.4 Les deux moments, et pourquoi ils demandent deux outils différents

L'erreur du premier jet était de traiter la bibliothèque comme **un** écran. Il y
en a deux, superposés :

| Moment | Ce qu'il faut | Outil |
|---|---|---|
| **Auditionner** — 38 entrées à balayer | La **vitesse**, zéro friction, zéro clic | **Hover scrub sur chaque vignette** |
| **Juger** — une entrée retenue | La **précision** : voir grand, sur son vrai montage, avec et sans | **Grand aperçu + bypass + réglages** |

### 3.5 Ce que VibeCut peut faire mieux que les trois — et qui ne coûte rien

**1. Chaque vignette montre déjà les rushs de l'utilisateur.**
DaVinci met du contenu générique dans la vignette et n'affiche le vrai montage
qu'après le clic, parce qu'il ne sait pas où on en est. VibeCut le sait : on est
sur une coupe précise. **Les 38 vignettes peuvent toutes jouer cette coupe.**
Aucun des trois outils ne fait ça.

**2. Le « avant » devient une touche, pas une moitié d'écran.**
C'est ainsi que travaillent les étalonneurs : un *bypass* qu'on presse pour voir
sans l'effet, **en plein cadre**. On maintient, l'effet disparaît ; on relâche, il
revient. Bien plus lisible qu'une image coupée en deux, et ça ne coûte aucune
place à l'écran.

**3. La vignette au repos s'arrête au moment le plus caractéristique.**
Détail petit et décisif : un fondu enchaîné à l'instant 0 ne ressemble à rien, et
une grille où chaque vignette montre l'image de départ serait une grille de
**vignettes identiques**. Au repos, chaque vignette se fige au **point culminant**
de son effet (mi-parcours pour la plupart). La grille devient lisible même à
l'arrêt.

## 4. Direction artistique de ces deux écrans

Rappel de `plan.md` § 4 : calme, précis, hiérarchie forte, espacements généreux,
profondeur subtile. **L'impact visuel est concentré sur le contenu**, jamais sur
le châssis. Ici le contenu, ce sont les animations elles-mêmes — donc c'est
exactement l'écran où cette règle joue en notre faveur : **on fait un châssis
discret et on laisse les aperçus occuper la place.**

Ce qui doit « claquer », dans l'ordre d'importance :

1. **La taille et la qualité des aperçus.** Une vignette de 196 px ne fait pas
   rêver. On monte les cartes, on donne à l'aperçu principal une place franche.
2. **Le mouvement permanent, décalé.** Les vignettes tournent déjà en boucle
   (décision du 2026-07-30). Décalage du départ carte par carte : la grille
   respire au lieu de battre à l'unisson.
3. **L'entrée en scène.** Les cartes arrivent en cascade au défilement
   (`IntersectionObserver`, déjà présent pour le dessin — on le réutilise).
4. **La réponse au survol.** Élévation subtile (`--vc-shadow-2`), et le nom qui
   passe en pleine opacité. Rien de plus : l'animation joue déjà.
5. **Le séparateur Avant/Après.** Trait fin, poignée ronde, ombre douce. Il doit
   avoir l'air d'un objet physique qu'on attrape.

**Interdits rappelés** : pas de néon, pas de glassmorphism généralisé, pas de
texte sous 12 px, pas d'`uppercase` + `letter-spacing` sur les libellés
courants, pas de dégradé violet décoratif, **aucun bouton mort**.

---

## 5. Architecture cible

### 5.1 Le squelette, partagé par les deux écrans

Les deux bibliothèques ont la même ossature. Elle vit dans des composants
partagés, pas dupliquée — sans quoi elles divergeront dès la première retouche.

```
src/features/vibecut/library/
├── LibraryScreen.jsx          ← NOUVEAU. Ossature commune : en-tête, filtres,
│                                grille, panneau. Reçoit ses données en props.
├── LibraryFilterBar.jsx       ← NOUVEAU. Recherche + familles + Favoris + tri.
├── LibraryCard.jsx            ← NOUVEAU. Vignette : HOVER SCRUB, nom, badge,
│                                étoile, image de repos au point culminant.
├── LibraryStage.jsx           ← NOUVEAU. Grand aperçu sur la vraie coupe :
│                                bypass, curseur de temps, boucle.
├── LibraryContextStrip.jsx    ← NOUVEAU. « Scène 4 → [ici] → Scène 5 ».
├── useFavorites.js            ← NOUVEAU. Favoris persistés, partagés.
├── TransitionLibrary.jsx      ← REMANIÉ : ne fait plus que fournir ses données.
├── MotionLibrary.jsx          ← REMANIÉ : idem.
├── TransitionPreview.jsx      ← conservé, c'est le canvas moteur.
├── MotionPreview.jsx          ← conservé, idem.
├── previewTicker.js           ← conservé.
├── useLibraryImages.js        ← conservé, étendu (vidéos, lot B2).
└── library.module.css
```

### 5.2 Disposition

**Deux colonnes**, pas trois. Un rail de familles à gauche ferait un second
système de navigation à côté du bandeau VibeCut — interdit par `plan.md` § 4.4.
Les familles deviennent une **barre de filtres** horizontale, qui se replie en
menu déroulant sous 720 px.

```
┌──────────────────────────────────────────────────────────────┐
│ Transitions                          [Retour au montage →]   │  en-tête
│ Survole une vignette et balaye pour dérouler la transition.  │
├──────────────────────────────────────────────────────────────┤
│ [Rechercher…]  ( Toutes )( ★ Favoris )( Essentielles )( … )  │  filtres
├───────────────────────────────────┬──────────────────────────┤
│  ESSENTIELLES                     │  ┌────────────────────┐  │
│  ┌───────┐ ┌───────┐ ┌───────┐    │  │                    │  │
│  │  ★    │ │  ★    │ │  ★    │    │  │   TA vraie coupe   │  │  grand aperçu
│  │ ↔ ▓▓░ │ │       │ │       │    │  │  Scène 4 → 5       │  │
│  └───────┘ └───────┘ └───────┘    │  │                    │  │
│   Fondu     Coupe     Au noir     │  └────────────────────┘  │
│   ↑ survolée : la souris          │  ├───── temps ──────┤    │  s'arrêter où
│     pilote le temps               │  [▶] 0,42 s  ↻  [B] │    │  on veut
│                                   │      maintenir B =        │
│  DOUCES                           │      voir SANS l'effet    │  ← le « avant »
│  ┌───────┐ ┌───────┐ ┌───────┐    │                          │
│  │       │ │       │ │       │    │  ✓ Export Pro            │  badge parité
│  └───────┘ └───────┘ └───────┘    │  Durée      ▓▓▓▓░░ 0,8 s │  réglages live
│                                   │  Intensité  ▓▓▓▓▓░ 100 % │
│  DYNAMIQUES              ↓ défile │                          │
│                                   │  [Appliquer à la coupe]  │
│                                   │  [Appliquer aux 4 coupes]│
│                                   │  Sc.4 → [ici] → Sc.5     │  contexte
└───────────────────────────────────┴──────────────────────────┘

Au repos, chaque vignette se fige au POINT CULMINANT de son effet — jamais à
l'instant 0, sinon la grille serait 38 fois la même image.
```

Sous **900 px** : le panneau passe **sous** la grille (déjà le cas aujourd'hui).
Sous **720 px** : les familles deviennent un menu, les cartes passent à 2 puis 1
colonne.

### 5.3 Le système d'aperçu — le cœur des deux écrans

Deux composants, un par moment (cf. § 3.4). Tous deux dessinés par **le moteur**,
sur les **médias réels du projet**, par **l'horloge partagée**.

#### `LibraryCard` — auditionner

- **Boucle quand la vignette est visible.** On n'arrive jamais sur une grille
  morte : c'est la décision produit du 2026-07-30, et elle tient.
- **Le survol prend la main.** La boucle s'arrête, et la position **horizontale**
  du pointeur pilote la progression 0 → 1. Un liseré fin sous la vignette montre
  où l'on en est. On quitte → la boucle repart.
  *C'est le « hover scrub » de DaVinci et le « skimming » de Final Cut.*
- **Au repos, la vignette se fige au point culminant** de l'effet, pas à
  l'instant 0 (cf. § 3.5).
- **Au clavier** : ← → naviguent entre vignettes, ↑ ↓ changent de famille, et la
  progression se pilote aussi aux flèches quand une vignette a le focus. Le hover
  scrub n'est pas atteignable au clavier : sans cette équivalence, l'écran serait
  inutilisable sans souris.
- Étoile (favori), badge de compatibilité export, nom.

#### `LibraryStage` — juger

- **Grand aperçu, sur la vraie coupe** que désigne la bande de contexte.
- **Bypass** : maintenir une touche (ou presser une bascule) montre le rendu
  **sans** l'effet, en plein cadre. C'est la comparaison avant/après, en
  séquence plutôt qu'en surface — la bonne forme pour une différence temporelle.
- **Curseur de temps** sous l'aperçu : on le tire pour s'arrêter sur l'instant
  exact. Le canvas est déjà dessiné à partir d'une progression 0 → 1, donc c'est
  **gratuit**. Bascule « boucle » à côté.
- Les réglages (durée, intensité) sont **live** : l'aperçu se met à jour pendant
  qu'on tire le curseur, sans avoir à appliquer.
- Actions : appliquer à cette coupe / à toutes.

#### Ce que « juger une animation » veut dire, concrètement

Six conditions. Les quatre premières manquent aujourd'hui.

| | Condition | État |
|---|---|---|
| 1 | C'est **mon** rush, pas une démo | partiel (images fixes) → B1 puis B2 |
| 2 | Je **contrôle le temps**, je peux m'arrêter où je veux | **à faire** (hover scrub + curseur) |
| 3 | Je peux voir **sans l'effet** instantanément | **à faire** (bypass) |
| 4 | C'est assez **grand** | **à faire** |
| 5 | C'est le **vrai moteur**, pas une imitation | ✅ acquis phase 5 |
| 6 | Je sais si ça **survit à l'export** | ✅ acquis phase 5 (badge lu du manifeste) |

### 5.4 Favoris

- Stockés en **IndexedDB**, via le service de bibliothèque de projets existant
  (`services/projectLibrary.js`), sous une clé dédiée `favorites:`.
  **Pas `localStorage`** : le projet stocke déjà tout le reste en IndexedDB, et
  mélanger les deux crée deux sources de vérité.
- `useFavorites.js` expose `{ isFavorite, toggle, favorites, count }`.
- Affichage : étoile en haut à droite de chaque carte, pleine si favori.
- Filtre **★ Favoris** dans la barre, et **section « Tes favoris » en tête** de
  la grille quand il y en a.
- **Rappel dans le montage avancé** : dans la section « Transition » de
  l'inspecteur, les favoris remontent en tête sous un intertitre « Tes favoris ».
  C'est le besoin exprimé : *« on n'a pas la place de mettre les aperçus dans le
  mode avancé »*.

### 5.5 Thèmes

En plus des familles techniques (qui décrivent *ce que fait* l'effet), un axe
**intention** (qui décrit *à quoi ça sert*) : `Réseaux sociaux`, `Voyage`,
`Produit`, `Récit`, `Souvenirs`, `Musique`.

Porté par les catalogues (`themes: ['social', 'recit']`), donc **une entrée peut
appartenir à plusieurs thèmes**. Filtre secondaire dans la barre.

⚠️ À faire **après** B1 : c'est de la donnée éditoriale à écrire à la main pour
51 entrées, et ça ne doit pas retarder la fondation du design.

---

## 6. Les lots

### B1 — Fondation du design des deux bibliothèques ⭐ **à faire en premier**

Le lot demandé. **Aucun contenu nouveau** : on présente à fond ce qui existe.
Objectif, dans les mots du porteur du projet : *« les meilleures bibliothèques
pour tester les animations, avec des aperçus qui permettent de JUGER, pouvoir les
mettre en favori, et donc les utiliser dans les modes en connaissance de cause »*.

**Le squelette**
- `LibraryScreen`, `LibraryFilterBar`, `LibraryCard`, `LibraryStage`,
  `LibraryContextStrip`, `useFavorites`.
- `TransitionLibrary` et `MotionLibrary` remaniées : elles ne fournissent plus
  que leurs **données**, l'ossature est commune.

**Auditionner — la grille**
- **Hover scrub** : la position horizontale du pointeur sur la vignette *est* le
  temps. Liseré de progression sous la vignette. C'est le motif de DaVinci et de
  Final Cut, et c'est ce qui permet de balayer 38 entrées en quelques secondes.
- Boucle quand la vignette est visible (jamais de grille morte), **le survol
  reprend la main**, la sortie relance la boucle.
- **Au repos, la vignette se fige au point culminant de l'effet**, jamais à
  l'instant 0 — sans quoi la grille est une grille d'images identiques.
- Équivalent clavier obligatoire : le hover scrub n'est pas atteignable sans
  souris.
- Chaque vignette joue **la coupe réelle** désignée par la bande de contexte.

**Juger — le grand aperçu**
- Grand canvas, sur la **vraie coupe** du projet.
- **Bypass** : maintenir une touche montre le rendu **sans** l'effet, en plein
  cadre. C'est la comparaison avant/après, en séquence plutôt qu'en surface.
- Curseur de temps + bascule boucle.
- Réglages **live** : durée, intensité, direction — l'aperçu suit pendant qu'on
  tire, sans avoir à appliquer.

**Favoris — et leur retour dans les modes**
- Persistés en **IndexedDB** (pas `localStorage` : le projet stocke déjà tout le
  reste là, deux stockages feraient deux sources de vérité).
- Étoile sur la vignette, filtre ★, section « Tes favoris » en tête.
- **Rappelés dans les modes**, et c'est la moitié du besoin exprimé :
  - **montage avancé** : les favoris remontent en tête de la liste de transitions
    de l'inspecteur, sous un intertitre. Il n'y a pas la place d'y afficher des
    aperçus — d'où l'intérêt d'avoir jugé en amont ;
  - **montage rapide** : `SceneInspector` propose aujourd'hui **six raccourcis
    écrits en dur**. Ils deviennent **les favoris de l'utilisateur**, avec repli
    sur les six actuels tant qu'il n'en a posé aucun. C'est le sens de « les
    utiliser dans les modes en connaissance de cause ».

**Le reste**
- Cartes agrandies, cascade à l'entrée, survol sobre, recherche + familles,
  responsive 390 px, `prefers-reduced-motion`.

**Ce qui ne bouge pas** : les canvas restent dessinés par `renderTransition` et
`applyImageMotionTransform`, l'horloge reste unique, les badges de parité restent
lus de `getServerRenderCapabilityStatus`, les mouvements `planned` restent sans
aucun réglage.

**Gate B1** — les tests portent sur le **visible**, pas sur l'écrit (leçon de
l'audit de la phase 4, et du bug 39 trouvé à l'usage) :
1. **Hover scrub** : deux positions horizontales différentes du pointeur sur la
   même vignette donnent **deux images différentes** (mesure `getImageData`).
2. Sortir de la vignette **relance** la boucle ; y entrer **la fige**.
3. **Au repos, deux vignettes différentes montrent deux images différentes** —
   c'est ce qui prouve que le point culminant est bien choisi et que la grille
   n'est pas 38 fois la même image.
4. **Bypass** : la touche maintenue change réellement les pixels, et les rend au
   relâchement.
5. Le curseur de temps du grand aperçu fige et déplace l'animation.
6. **Équivalent clavier** : une vignette au focus se scrube aux flèches.
7. Un favori posé se retrouve dans le filtre, **dans le montage avancé**, et
   **dans les raccourcis du montage rapide**.
8. Un favori **survit au rechargement**.
9. Recherche et filtres réduisent la grille (comptage) ; « aucun résultat » dit
   quoi faire.
10. Responsive 390 px sans débordement ; zéro erreur console ;
    `prefers-reduced-motion` arrête la boucle **sans** retirer les commandes.

Plus : `lint`, `build`, `test:scope`, `test:vibecut-ui-v2`, `test:vibecut-library`.

### B2 — De vraies vidéos dans les aperçus

Aujourd'hui les vignettes tournent sur des **images fixes** (miniatures). Un
mouvement de caméra sur une photo se voit ; une transition entre deux rushs
animés, c'est autre chose.

- Étendre `useLibraryImages.js` en `useLibraryMedia.js` : privilégier les
  **vidéos** du projet quand il y en a, retomber sur les photos, puis sur les
  clips de démo, puis sur le repli dessiné.
- **Clips de démo intégrés** (3 à 4, 2 s, 720p, ~1,5 Mo au total, chargés
  paresseusement) pour que la bibliothèque soit vivante avant tout import.
  Sources décidées avec le porteur du projet : **Mixkit** ou **Pexels**, licences
  libres et commerciales, **téléchargés et compressés par l'agent**, puis
  **validés par le porteur**.
- ⚠️ **Droits déclarés comme pour la musique** : le projet exige déjà une
  déclaration de droits explicite pour toute piste audio, et bloque l'export
  sinon. Les clips de démo doivent porter source, licence et URL dans un
  manifeste versionné. Introduire des médias sans provenance ici serait
  exactement le laxisme qu'on a refusé sur la musique.

**Gate B2** : le manifeste de droits des clips est complet et vérifié par un
smoke ; la sélection de média suit bien l'ordre vidéo → photo → démo → dessin ;
le poids ajouté au bundle est mesuré et sous le seuil décidé.

### B3 — Le contenu qui manque

Le vrai chantier, et le plus long. **Chaque ajout coûte deux implémentations**
(navigateur **et** expression FFmpeg) plus une preuve de parité image par image.

- **Mouvements** : les 7 `planned` (descente, orbite, parallaxe, rotation,
  apparition, rebond, glitch), puis les **mouvements sur vidéo**.
- **Effets pendant le rush** — c'est là que le retard sur Premiere/DaVinci est
  réel : secousse, flou directionnel animé, fuite de lumière, vignettage animé,
  grain animé, zoom pulsé sur le rythme.
- **Transitions** : le filtre `xfade` expose **46** cibles natives ; **15** sont
  employées. Les 31 restantes sont à trier — toutes ne méritent pas d'exister
  (`zoom-punch` a été écarté après mesure, cf. problème F).
- **Thèmes éditoriaux** sur les 51 entrées.

**Contraintes non négociables pour chaque ajout** :
- parité aperçu ↔ export prouvée par `test:vibecut-motion-parity` ou
  `test:vibecut-xfade-preview-parity` (MP4 réel, comparaison image par image) ;
- **problème I** : tout mouvement doit tenir `|x| ≤ (zoom − 1) / 2` ;
- un id ajouté dans une seule des trois tables (`exportManifest`,
  `functions/src/videoExport.js`, `render-service/src/server.js`) fait échouer
  `smoke-vibecut-transition-parity` — c'est voulu ;
- un **seul** rollout Cloud Run à la fin du lot, jamais un par ajout.

---

## 7. Ordre et raison de l'ordre

| | Lot | Pourquoi à ce rang |
|---|---|---|
| 1 | **B1 — design** | C'est ce qui a été demandé. Il ne dépend d'aucun contenu nouveau, et il définit le cadre que B2 et B3 rempliront. Le faire après B3 obligerait à tout redessiner. |
| 2 | **B2 — vraies vidéos** | Rend les aperçus crédibles. Indépendant de B3. |
| 3 | **B3 — contenu** | Le plus long et le plus risqué. Une fondation qui absorbe le contenu sans être redessinée est la condition pour que ce lot soit rentable. |

---

## 8. Risques identifiés

| Risque | Parade |
|---|---|
| **Le hover scrub demande un redessin à chaque mouvement de souris** | Le dessin est déjà hors React (horloge partagée). Le survol ne doit pas passer par un `setState` : la progression s'écrit dans une `ref` et le canvas se redessine directement, comme le playhead 60 fps du montage (bug 3). |
| **Quarante canvas animés + deux canvas d'aperçu = page qui rame** | L'horloge unique et l'`IntersectionObserver` existent déjà. Mesurer les images par seconde avant/après B1, et ne pas dépasser le budget. Si nécessaire : figer les cartes hors sélection et n'animer que la carte survolée + la sélectionnée. |
| **La refonte casse le chemin « dessiné par le moteur »** | `audit-scope.mjs` le verrouille déjà. Ne pas relâcher cette assertion. |
| **Les favoris deviennent une seconde source de vérité** | Un seul module (`useFavorites`), un seul stockage (IndexedDB), et l'inspecteur du montage avancé le **lit**, ne le duplique pas. |
| **On dessine une vitrine pour un contenu maigre** | Assumé et dit : B1 doit rendre désirable un contenu restreint. Éviter les grilles à 6 colonnes qui soulignent le vide. |
| **Les clips de démo alourdissent le bundle** | Chargement paresseux, mesure du poids dans le gate B2, seuil décidé avant téléchargement. |
| **Droits des clips de démo** | Manifeste versionné, même exigence que la musique. |

---

## 9. Ce qu'on ne fait pas, et pourquoi

| Écarté | Raison |
|---|---|
| Vidéos d'aperçu **pré-rendues**, une par animation (méthode DaVinci) | Casse la garantie que l'aperçu est dessiné par le moteur : une vidéo pré-rendue peut dériver en silence le jour où le moteur change. À rouvrir seulement si on les régénère automatiquement au build. |
| **Avant/après avec séparateur déplaçable** | Compare deux états d'un même instant coupés dans l'**espace**, alors que mouvements et transitions sont des différences dans le **temps**. Remplacé par le **bypass** (§ 3.3). À rouvrir pour une future bibliothèque de **looks colorimétriques**, où c'est le bon outil. |
| Rail de navigation latéral | Second système de navigation à côté du bandeau VibeCut, interdit par `plan.md` § 4.4. |
| Afficher des effets « à venir » avec des aperçus alléchants | Règle du projet : on ne propose jamais ce que le moteur ne rend pas. Les `planned` restent listés, marqués « Bientôt », **sans aucun réglage**. |
| Un troisième écran « Effets » séparé | La colorimétrie et la vitesse sont des attributs du plan, pas un catalogue. Elles vivent dans l'inspecteur. La bibliothèque « Mouvements & effets » les présentera, mais l'application reste dans l'inspecteur. |
