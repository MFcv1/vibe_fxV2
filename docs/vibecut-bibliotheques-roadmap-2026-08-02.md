# Roadmap — Les deux bibliothèques VibeCut

> Document d'implémentation, demandé le **2026-08-02**.
> Rattaché à [plan.md](../plan.md) § 4 (direction artistique) et § 7 (phase 5),
> et à [todo.md](../todo.md).
> **État : lots B1 et B3a ✅ LIVRÉS le 2026-08-02. Prochain : B2.**
> Ordre modifié le 2026-08-02 **par décision du porteur du projet** : l'écart
> d'export (§ 6, lot B3a) est traité avant B2. Voir « Recommandation d'ordre »
> au § 7.
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
5. **Le bypass.** Un cadre franc et une pastille « Sans l'effet » : on doit savoir
   en un coup d'œil que ce qu'on regarde n'est *pas* l'effet.
   *(Ce point disait « le séparateur Avant/Après » avant la révision du § 3.3 ;
   le séparateur est écarté, voir § 9.)*

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

### B1 — Fondation du design des deux bibliothèques ✅ **livré le 2026-08-02**

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

**Résultat au 2026-08-02** — les dix points du gate sont couverts par
`scripts/smoke-vibecut-library-b1.spec.cjs` (**17 tests**, suite navigateur portée
à **60**). Ils mesurent les **pixels** des aperçus (`getImageData` : moyenne RVB
plus une grille de 16 sondes) et les attributs que le rendu écrit dans le DOM
(`data-preview-mode`, `data-preview-progress`, `data-preview-bypass`), jamais un
libellé.

Trois écarts par rapport au plan écrit ici, tous assumés et dits :

1. **`useFavorites` vit dans `adapters/`, pas dans `library/`.** La règle d'or de
   `plan.md` § 5.3 — aucun composant n'atteint IndexedDB directement, tout passe
   par un adaptateur — est plus forte que le rangement proposé au § 5.1.
2. **Les flèches scrubent, elles ne naviguent pas entre vignettes** (le § 5.3 les
   voulait pour les deux). La navigation d'une carte à l'autre reste au **Tab**,
   qui la fait déjà : détourner les flèches aurait retiré le **seul** accès
   clavier au temps, qui est la fonction centrale de l'écran.
3. **Le hover scrub ne s'arme pas sur pointeur tactile.** Un scrub au doigt
   avalerait le tap de sélection. Sur téléphone la vignette continue de boucler,
   et le jugement précis se fait dans le grand aperçu, qui a son curseur.

**Seconde passe, après relecture de l'écran fini** — cinq corrections :
la page Mouvements ouvre désormais sur les **six qui marchent**, les sept
annoncées passant dans une **annexe en bas** ; le tri « exportables d'abord »
(perdu au passage à l'ossature commune) est **rétabli**, complété d'un filtre
**Export Pro** et d'un **avertissement au moment où l'on applique** une transition
qui se dégradera ; les six curseurs de trajectoire sont **repliés par défaut** ;
les images par seconde sont **mesurées** (60,2 au repos, 60,1 avec un scrub, sur
38 vignettes) et le restent par un test ; les scènes de repli ont gagné du
**relief** — un dégradé lisse zoomé à 116 % reste le même dégradé, la moitié des
effets ne se voyaient donc pas avant d'avoir importé ses propres médias.

**Deux défauts d'interaction trouvés par le test, pas par la relecture** (todo.md,
bugs 41 à 43) : écrire `input.value` directement neutralise `onChange` côté React
— le curseur de temps était mort une fois sur deux ; et le garde « ne pas
déclencher B quand on tape » ignorait *tout* `INPUT`, donc le bypass devenait
sourd juste après avoir déplacé ce curseur. Les deux étaient **silencieux**.

### B3a — Fermeture de l'écart d'export ✅ **livré le 2026-08-02**

**Décision du porteur du projet, prise le 2026-08-02** : traiter d'abord la part
de B3 qui ferme l'écart d'export (cf. « Recommandation d'ordre », § 7). B2 passe
après.

**Le point de départ** : 23 des 38 transitions jouaient dans l'aperçu et
repartaient en simple fondu à l'export. Quelqu'un pouvait mettre un glitch en
favori, le poser sur son montage, et récupérer un fondu dans sa vidéo.

**Ce qui a été fait** — les 31 cibles `xfade` natives inutilisées ont été
**rendues et mesurées**, pas jugées sur leur nom :

- **8 entrées existantes** pointent désormais sur la cible native qui tient
  vraiment leur promesse : `smooth-cut` et `non-additive-dissolve` → `fade`
  (elles étaient *déjà* dessinées comme un fondu simple dans l'aperçu, seule la
  table de capacités l'ignorait), `whip-pan` → `slideleft`, `flash` →
  `fadewhite`, `intro-cinematic-bars` → `horzopen`, `outro-cinematic-fade` →
  `fadeblack`, `outro-neon-close` → `vertclose`, `outro-signal-collapse` →
  `squeezev`.
- **10 entrées nouvelles** ouvrent les sens qui manquaient et deux formes que le
  catalogue n'avait pas du tout : volets et balayages dans les quatre
  directions (`wiperight`, `wipeup`, `wipedown`, `slideright`, `smoothup`,
  `smoothdown`), fermeture horizontale (`horzclose`), **rognage par le noir** en
  cercle et en rectangle (`circlecrop`, `rectcrop`), **compression** (`squeezeh`).

**Résultat : 15 → 33 transitions exportables, sur un catalogue passé de 38 à 48.
Les « aperçu uniquement » tombent de 23 à 15.**

**Trois courbes ont été RELEVÉES, pas devinées** (méthode du lot L1) :
`circlecrop` suit `rayon = |1−2t|³ × hypot(w/2, h/2)` — le cube n'était pas
devinable, et une décroissance linéaire aurait donné un tout autre effet ;
`rectcrop` suit la même forme *sans* le cube ; `squeezeh`/`squeezev` compriment
le plan sortant d'un facteur `1 − t` exactement, et le **mettent à l'échelle**
plutôt que de le rogner (vérifié en comptant les bandes de couleur du plan
source dans le résultat).

**Trois cibles ont été ÉCARTÉES après mesure**, et c'est le vrai travail :

| Écartée | Pourquoi |
|---|---|
| `fadefast`, `fadeslow` | Leur poids de mélange dépend de la **valeur du pixel**, pas seulement du temps : mesuré sur quatre gris, le poids va de 0,703 à 0,612 au même instant. Une table de courbe ne peut pas les reproduire, donc l'aperçu mentirait. `fadeslow` est de surcroît **indistinguable de `fade`** sur les couleurs saturées. |
| `zoomin` | Déjà écarté au lot L1 (problème F), confirmé sur la planche de contact : le plan entrant arrive délavé. |
| `distance`, `radial`, les 4 `diag*`, les 4 `wipe*` de coin, les 4 `*slice` | Pas de défaut mesuré — simplement pas retenues. Les `*slice` demandent de reconstituer le motif de lamelles de FFmpeg au pixel près pour un gain visuel modeste ; `radial` demande un dégradé conique à calibrer. À rouvrir si le besoin se fait sentir : les 10 cibles restantes sont documentées ici. |

**Gate B3a** — tout mesuré, rien de déclaratif :
1. `test:vibecut-xfade-preview-parity` : **29 cibles natives**, chacune comparée
   image par image au rendu FFmpeg. Les rognages et compressions sont
   échantillonnés **plus densément** (10 points au lieu de 4) parce que c'est
   leur *courbe* qu'il faut prouver, pas seulement leur sens.
2. `test:vibecut-xfade-local-mp4` : **34 MP4 réels**, construits par le
   `buildFfmpegArgs` **du renderer lui-même**, pas par une commande réécrite.
3. `test:vibecut-library` : 48 au catalogue, 33 exportables, 15 en aperçu seul —
   les trois nombres écrits en dur, pour qu'une baisse se voie.
4. Plus : `lint`, `build`, `test:scope`, `test:vibecut-ui-v2`,
   `test:vibecut-export`.

**Deux pièges payés, tous deux invisibles à la relecture** :

- Un point d'échantillonnage qui **ne tombe pas sur une image entière** fait
  comparer deux instants différents. `0,05 × 50 = 2,5` est arrondi à l'image 3,
  soit `t = 0,06` côté FFmpeg contre `0,05` côté canvas ; sur une courbe aussi
  raide que le rayon de `circlecrop`, ce centième suffit à faire échouer un test
  pourtant juste. Le test **refuse** désormais un point hors grille.
- Le test de rendu local exigeait que l'image du milieu **ne soit pas noire** —
  or pour les deux rognages, être noir à mi-parcours **est** l'effet. L'assertion
  a été inversée pour eux (noir au milieu **et** image encore présente au quart),
  ce qui est plus fort que le contrôle générique : un rendu entièrement noir ne
  passerait pas.

**✅ DÉPLOYÉ le 2026-08-02** — révision **`00007-b5c`**, image
`b3a-7ff9c28-20260802`. Pré-vol sur le service réel : **29 cibles `xfade` sur
29**, `missing: []`, `errorCount: 0`, et `/render` répond toujours 401 sans
signature. La révision `00006-6fw` reste disponible pour un retour arrière
immédiat. **Le badge « Export Pro » ne devance plus la production.**

**Ce qui reste « aperçu uniquement » (15)**, et pourquoi c'est le bon compte :
`additive-dissolve`, `blur-dissolve`, `cross-blur`, `motion-blur`, `cross-zoom`,
`snap-zoom`, `parallax-zoom`, `light-leak`, `strobe-cut`, `glitch`, `rgb-split`,
`chromatic`, `intro-title-scan`, `intro-grid-reveal`, `intro-neon-doors`.
**Aucune cible `xfade` native ne les rend.** Les faire passer demanderait
d'écrire de vraies chaînes de filtres FFmpeg (flou directionnel animé, décalage
de couches, bruit) — c'est du B3 complet, pas de la table de correspondance.

### B2 — De vraies vidéos dans les aperçus ✅ **livré le 2026-08-03**

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

**✅ Livré le 2026-08-03 — et sur un point, autrement que prévu.**

- `useLibraryImages` → **`useLibraryMedia`**, avec les quatre étages. Les
  **vidéos passent devant les photos** même quand une photo arrive plus tôt dans
  le montage : c'est tout l'objet du lot.
- **Les clips ne viennent pas d'une banque d'images, ils sont GÉNÉRÉS.** Le plan
  prévoyait Mixkit ou Pexels. Deux raisons ont fait choisir autrement.
  **Les droits** : ces clips sont servis à *tous* les visiteurs, pas seulement à
  celui qui les importe, et le projet bloque déjà l'export d'une musique sans
  déclaration de droits — il aurait fallu une licence lue et validée avant de
  committer quoi que ce soit. **La cohérence** : en rejouant les deux scènes
  dessinées du repli (`libraryFallbackScene.js`) dans un Chromium sans fenêtre,
  les clips ont *par construction* l'aspect exact du repli, donc on ne voit pas
  l'étage changer sous ses pieds. `build-vibecut-library-demo-clips.mjs` les
  reproduit à l'identique. **77 Ko pour les deux**, contre un plafond de 1,5 Mo.
  Passer à du vrai rush reste un changement de **données**, pas de code.
- **Une décision de conception imposée par un test** : hors de la boucle, la
  vignette dessine désormais une **copie figée** de la source
  (`librarySourceFreeze.js`). Sans elle, le rush continuait de tourner sous un
  scrub arrêté — donc le hover scrub comparait deux instants différents du plan,
  et surtout le **bypass ne prouvait plus rien** : les deux états différaient par
  l'effet *et* par le contenu. C'est l'assertion « le relâchement rend l'effet »
  du lot B1 qui l'a trouvé, en se mettant à échouer dès l'arrivée des clips.
- **Cadence tenue** : 60,3 images/seconde grille au repos, 60,1 avec un scrub en
  cours, sur des sources vidéo — contre 60,2 sur images fixes. Plancher de test
  à 24.
- **Gate** : `smoke-vibecut-library-media.mjs` (droits, présence des fichiers,
  poids, 6 règles d'ordre) + `smoke-vibecut-library-b2.spec.cjs` (4 tests
  navigateur). Suite portée de 60 à **64 tests**.

### B3b — Les 15 dernières transitions ✅ **terminé le 2026-08-03**

> Parité verte, sentinelles 5/5, rollout fait (révision `00008-8gr`).

Plan et retour d'expérience complets, séparés parce que c'est long :
**[vibecut-transitions-b3b-plan-2026-08-02.md](vibecut-transitions-b3b-plan-2026-08-02.md)**
— le **§ 10** est la partie utile pour la suite : il consigne ce que la mesure a
contredit.

Décision du porteur du projet le 2026-08-02 : les traiter **d'un bloc**. Aucune
cible `xfade` native ne les rend — chacune est donc **construite** avec des
filtres natifs posés sur la queue du plan sortant et la tête du plan entrant.
La voie par expression par pixel reste **écartée** (facteur ~40 sur le temps de
rendu). Résultat : **48 exportables sur 48**, plus aucune entrée « Aperçu
uniquement ».

**Le fait marquant, à retenir pour tout ajout futur** : `sendcmd` — la façon
évidente de faire varier une option dans le temps — **diffuse ses commandes à
tous les filtres du graphe** portant le nom visé, et le nommage d'instance
(`gblur@…`) ne fonctionne pas dans le build FFmpeg déployé. Conséquence mesurée :
sur un montage à deux coupes, **la deuxième coupe rendait un fondu simple**. Les
rampes sont donc des **chaînes de douze filtres à valeur constante**, chacun
ouvert sur un douzième de la fenêtre par sa porte `enable`. **Un test sur deux
plans n'aurait rien vu** : le gate exige désormais un enchaînement de trois.

Deuxième leçon de coût : la dépense n'était pas l'effet mais l'aller-retour
`yuv420p ↔ gbrp`, **1,1 s à lui seul** sur tout un montage. Le confiner à la
fenêtre fait tomber l'aberration chromatique de 2,20 s à 0,83 s.

**Conséquence sur l'écran** : le badge « Export Pro » aurait été sur les 48
cartes et le filtre du même nom ne retirait plus rien — un contrôle qui ne filtre
jamais est un bouton mort. Les deux portent maintenant l'usage
(**ouverture / fin de séquence**), et le filtre devient « Entre deux plans »
(41 sur 48). L'avertissement d'export subsiste, lu à l'exécution : il
reviendrait de lui-même si une capacité serveur disparaissait.

### B3 — Le contenu qui manque

Le vrai chantier, et le plus long. **Chaque ajout coûte deux implémentations**
(navigateur **et** expression FFmpeg) plus une preuve de parité image par image.

- **Mouvements** : les 7 `planned` (descente, orbite, parallaxe, rotation,
  apparition, rebond, glitch), puis les **mouvements sur vidéo**.
- **Effets pendant le rush** — c'est là que le retard sur Premiere/DaVinci est
  réel : secousse, flou directionnel animé, fuite de lumière, vignettage animé,
  grain animé, zoom pulsé sur le rythme.
- ~~**Transitions**~~ — **fait** : 29 cibles `xfade` natives employées au lot B3a,
  puis les 15 sans équivalent natif construites au lot B3b. Le catalogue est
  complet et **entièrement exportable**.
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

### Recommandation d'ordre, écrite après avoir livré B1 — décision au porteur du projet

L'ordre ci-dessus tient toujours pour B1. Pour la suite, ce que la livraison a
rendu visible mérite d'être posé noir sur blanc :

> **23 des 38 transitions ne survivent pas à l'export.** Elles jouent dans
> l'aperçu, et le serveur les remplace par un fondu. B1 l'a rendu impossible à
> ignorer (tri, filtre, avertissement à l'application), mais **le trou reste
> entier**, et il est du ressort de B3.

Or B2 rend la page **plus séduisante** — de vraies vidéos dans les vignettes —
tandis que faire passer une partie de ces 23 du côté « vraiment rendue » rend la
bibliothèque **fiable**. Aujourd'hui, quelqu'un peut mettre un glitch en favori,
le poser sur son montage, et récupérer un fondu dans sa vidéo finale.

**Ma recommandation** : traiter en premier la part de B3 qui ferme cet écart
(trier les 31 cibles `xfade` natives inutilisées, en retenir celles qui valent la
peine, prouver la parité), puis faire B2.

**L'argument contraire, qui est réel** : chaque transition ajoutée coûte **deux**
implémentations — navigateur et expression FFmpeg — plus une preuve de parité
image par image et un rollout Cloud Run. B2 est bien plus rapide et donne
immédiatement quelque chose à montrer. Si l'objectif court terme est de
démontrer le produit, B2 d'abord est le bon choix.

**La décision appartient au porteur du projet ; rien n'a été réordonné sans lui.**

> **TRANCHÉ le 2026-08-02 : fermer d'abord l'écart d'export.** Le lot **B3a**
> (§ 6) en est le résultat — 15 → 33 transitions exportables. **B2 vient
> ensuite.** Le trou n'est pas entièrement comblé : 15 entrées restent en aperçu
> seul faute de cible `xfade` native, et elles relèvent de vraies chaînes de
> filtres FFmpeg, donc du B3 complet.

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
