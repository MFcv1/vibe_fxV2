# Roadmap — Les deux bibliothèques VibeCut

> Document d'implémentation, demandé le **2026-08-02**.
> Rattaché à [plan.md](../plan.md) § 4 (direction artistique) et § 7 (phase 5),
> et à [todo.md](../todo.md).
> **État : à faire. Lot B1 en premier.**

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
| **Avant / Après avec séparateur déplaçable** | C'est *la* trouvaille. On ne comprend un effet qu'en le comparant à son absence. |
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

### 3.3 Ce que la référence **ne fait pas** et qu'on fera

- **Le défilement image par image dans l'animation.** Le canvas est déjà dessiné
  à partir d'une progression 0 → 1. Exposer un curseur qui la pilote à la main
  donne l'inspection frame par frame que les monteurs cherchent — **gratuit,
  puisque le moteur est déjà branché.** C'est le détail qui fait passer la page
  de « joli » à « on y reste ».
- **Avant/Après honnête pour les transitions.** « Avant » = **la coupe franche**,
  « Après » = la transition. On montre ce que la transition *apporte*, pas juste
  ce qu'elle *est*.
- **Les vignettes tournent sur les médias de l'utilisateur.** DaVinci montre des
  rushs génériques parce qu'il ne sait pas ce que tu montes. VibeCut, si.

---

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
├── LibraryCard.jsx            ← NOUVEAU. Carte : aperçu, nom, badge, étoile.
├── BeforeAfterStage.jsx       ← NOUVEAU. Avant/Après + séparateur déplaçable
│                                + curseur de progression + boucle.
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
│ Transitions                          [Retour au montage →]   │  en-tête d'écran
│ Chaque vignette enchaîne deux scènes de ton projet.          │
├──────────────────────────────────────────────────────────────┤
│ [Rechercher…]  ( Toutes )( ★ Favoris )( Essentielles )( … )  │  barre de filtres
├───────────────────────────────────┬──────────────────────────┤
│  ESSENTIELLES                     │  ┌────────────────────┐  │
│  ┌──────┐ ┌──────┐ ┌──────┐       │  │  AVANT  ┃  APRÈS   │  │  aperçu principal
│  │ ★    │ │ ★    │ │ ★    │       │  │      ┃(o)┃         │  │  + séparateur
│  │anim. │ │anim. │ │anim. │       │  └────────────────────┘  │
│  └──────┘ └──────┘ └──────┘       │  ├──── progression ────┤  │  défilement manuel
│  Fondu    Coupe    Au noir        │  [▶] 0,42 s   ↻ boucle   │
│                                   │                          │
│  DOUCES                           │  ✓ Export Pro            │  badge parité
│  ┌──────┐ ┌──────┐ …              │  Durée      ▓▓▓▓░░ 0,8 s │  réglages
│  …                                │  Intensité  ▓▓▓▓▓░ 100 % │
│                                   │                          │
│                                   │  [Appliquer à la coupe]  │  actions
│                                   │  [Appliquer aux 4 coupes]│
│                                   │  ┌──────────────────┐    │
│                                   │  │Sc.4 → [ici] → Sc.5│   │  contexte
│                                   │  └──────────────────┘    │
└───────────────────────────────────┴──────────────────────────┘
```

Sous **900 px** : le panneau passe **sous** la grille (déjà le cas aujourd'hui).
Sous **720 px** : les familles deviennent un menu, les cartes passent à 2 puis 1
colonne.

### 5.3 `BeforeAfterStage` — le cœur de l'écran

Deux canvas superposés, le second **découpé** par la position du séparateur
(`clip-path: inset(0 0 0 X%)`). Les deux sont dessinés par le moteur, à la même
progression, par la même horloge partagée.

| | Transitions | Mouvements |
|---|---|---|
| **Avant** | La **coupe franche** : plan A jusqu'au milieu, plan B après | Le plan **fixe**, sans mouvement |
| **Après** | La transition choisie | Le plan **animé** |

C'est ce couple qui rend la page pédagogique : on ne montre pas un effet, on
montre **ce qu'il change**.

Interactions :
- **Glisser le séparateur** (pointer events, `setPointerCapture` via le helper
  qui n'explose pas — bug 31).
- **Curseur de progression** : fait défiler l'animation à la main, image par
  image. Quand on le lâche, la boucle reprend.
- **Bascule « Aperçu en boucle »** : arrêter la boucle et rester sur une image.
- **Clavier** : ← → déplacent la progression de 2 %, ⇧← ⇧→ de 10 %.
- `prefers-reduced-motion` : pas de boucle, image fixe à mi-parcours, séparateur
  et curseur **toujours utilisables** (le réglage arrête le mouvement, il ne
  retire pas les commandes).

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

- `LibraryScreen`, `LibraryFilterBar`, `LibraryCard`, `BeforeAfterStage`,
  `LibraryContextStrip`, `useFavorites`.
- `TransitionLibrary` et `MotionLibrary` remaniées pour n'être plus que des
  fournisseurs de données au squelette commun.
- Cartes agrandies, cascade à l'entrée, boucle décalée, survol sobre.
- Avant/Après avec séparateur déplaçable + défilement manuel de l'animation.
- Favoris persistés, filtre, section en tête, **et rappel dans l'inspecteur du
  montage avancé**.
- Recherche + familles, responsive 390 px, clavier, `prefers-reduced-motion`.

**Ce qui ne bouge pas** : les canvas restent dessinés par `renderTransition` et
`applyImageMotionTransform`, l'horloge reste unique, les badges de parité restent
lus de `getServerRenderCapabilityStatus`, les mouvements `planned` restent sans
aucun réglage.

**Gate B1** — les tests doivent porter sur le **visible**, pas sur l'écrit
(leçon de l'audit de la phase 4) :
1. Le séparateur déplacé change **réellement** ce qui est affiché : on mesure les
   pixels des deux moitiés du canvas, ils diffèrent.
2. « Avant » et « Après » **diffèrent** : sur une transition, la coupe franche et
   la transition ne donnent pas la même image à mi-parcours (mesure).
3. Le curseur de progression **fige et déplace** l'animation : deux positions
   distinctes donnent deux images distinctes, et l'image ne bouge plus quand la
   boucle est coupée.
4. Un favori posé se **retrouve** : dans la section en tête, dans le filtre, et
   **dans l'inspecteur du montage avancé** après navigation.
5. Un favori **survit au rechargement** de la page.
6. Recherche et filtres réduisent la grille (comptage de cartes), et « aucun
   résultat » affiche un état vide qui dit quoi faire.
7. Responsive 390 px : aucun débordement horizontal, panneau atteignable.
8. Zéro erreur console sur tout le parcours.
9. `prefers-reduced-motion` : la boucle s'arrête **et** le séparateur reste
   utilisable.

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
| Rail de navigation latéral | Second système de navigation à côté du bandeau VibeCut, interdit par `plan.md` § 4.4. |
| Afficher des effets « à venir » avec des aperçus alléchants | Règle du projet : on ne propose jamais ce que le moteur ne rend pas. Les `planned` restent listés, marqués « Bientôt », **sans aucun réglage**. |
| Un troisième écran « Effets » séparé | La colorimétrie et la vitesse sont des attributs du plan, pas un catalogue. Elles vivent dans l'inspecteur. La bibliothèque « Mouvements & effets » les présentera, mais l'application reste dans l'inspecteur. |
