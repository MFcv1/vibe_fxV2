# Plan — Reconstruction de l'interface VibeCut

> Document de référence de la reconstruction complète de l'interface VibeCut.
> État d'avancement : voir [todo.md](todo.md).
> Carte du projet : voir [map.md](map.md). Règles de travail : voir [AGENTS.md](AGENTS.md).

---

## 1. Objet et périmètre

VibeCut est le module de montage vidéo de Vibe_fx V2. Son interface est **entièrement reconstruite**, sans reprendre un seul pixel de l'existant.

**Dans le périmètre**
- Toute l'interface de montage vidéo : accueil, trois modes de montage, bibliothèques créatives.
- Un design system propre à VibeCut, isolé du reste du produit.
- Le raccordement au moteur vidéo, au store, à la persistance et au pipeline d'export existants.

**Hors périmètre — ne pas toucher**
- `/studio` (layout, publications, soundtrack, vision), backoffice, pages publiques SEO.
- Le terme « VibeOS » employé par le porteur du projet désigne tout ce qui n'est pas VibeCut.
- Le bundle Tailwind statique `src/features/vibefx-layout/vibefx-tailwind.css` : ne pas le régénérer, l'ancien front en dépend tel quel.

**Principe de migration** : reconstruction **parallèle**. L'ancien front (`/studio?workspace=video`) reste fonctionnel et inchangé jusqu'à la bascule finale (phase 7).

---

## 2. Diagnostic de l'existant (audit du 2026-07-30)

| # | Constat | Conséquence |
|---|---|---|
| 1 | VibeCut n'a **aucune route** : `/studio?workspace=video` → `PublicationsManager` → `VibeFxStudio` → `VideoApp` | Hérite du CSS de `/studio`, aucun deep-link, aucune isolation |
| 2 | Le CSS Tailwind de `/studio` est un **artefact statique de 93 Ko** sans config, sans script de régénération | Toute classe absente du bundle est inerte. `min-h-16`, `min-h-32`, `size-*`, `gap-7`, `grid-cols-12` sont absents **et déjà utilisés** |
| 3 | **Doubles headers** et contrôles répétés : le format est réglable à 4 endroits, la rotation à 2, les outils dans 2 barres | Charge cognitive, incohérence |
| 4 | Densité typographique `text-[7px]` à `text-[10px]` + `font-mono uppercase tracking-widest` partout | Origine du rendu « cyberpunk / généré par IA » |
| 5 | Les modes existants (`create`, `storyboard`, `pro`) ne correspondent pas aux trois modes demandés, et **il n'y a pas de page d'accueil** | Parcours produit absent |
| 6 | 6 mouvements seulement, appliqués **aux images uniquement** | Bibliothèque de mouvements quasi vide |
| 7 | 27 transitions dans le moteur, mais toutes ne sont pas rendues côté serveur | Risque d'écart aperçu/export |
| 8 | Un `PlaybackEngine` créé/détruit par écran | Rechargement de tous les médias à chaque changement de mode — ✅ **résolu en phase 4** : moteur et canvas hissés dans le shell (`preview/PreviewEngineHost.jsx`) |
| 9 | Les tests UI sont couplés à l'ancien front (~60 `data-testid`) | Suite parallèle nécessaire |
| 10 | `audit-scope.mjs` verrouille le layout `/studio` | Toute nouvelle surface doit ajouter ses propres assertions |

---

## 3. Réutilisé / adapté / remplacé

| Couche | Fichier | Verdict |
|---|---|---|
| Modèle timeline (pur, 0 React) | `video/model/timelineModel.js` | **Garder tel quel** |
| Modèle média | `video/model/mediaModel.js` | Garder, étendre le catalogue de mouvements |
| Moteur canvas | `video/engine/VideoEngine.js` | Garder, étendre (mouvements, audio) |
| Rendu texte canvas | `video/engine/textOverlayRenderer.js` | **Extrait** de `preview/VideoPreview.jsx` en phase 2 |
| Contrôleur d'export | `video/export/useExportController.js` | **Extrait** de `panels/ExportVideoPanel.jsx` en phase 2 |
| Services export | `video/export/*` | Garder |
| Persistance | `video/services/videoProjectPersistence.js` | Garder + index multi-projets |
| Store | `video/store/videoStore.js` | Garder le domaine ; ne jamais l'appeler directement depuis le nouveau front |
| Tout le rendu de l'ancien front | `VideoApp`, `VideoEditor`, `panels/*`, `timeline/*`, `vibecut-premium.css`, classes `vbc-*` | **Remplacé, supprimé en phase 7** |

---

## 4. Direction artistique — la trajectoire « OS Apple »

C'est la section à respecter à la lettre pour toute nouvelle interface VibeCut.

### 4.1 Intention

Un logiciel **calme, précis, immédiatement compréhensible**. Le soin d'un OS Apple : hiérarchie forte, typographie lisible, espacements généreux, profondeur subtile, animations qui expliquent au lieu de décorer. L'impact visuel est concentré sur **le contenu** (miniatures, aperçus animés, trajectoires, formes d'ondes, états de sélection), jamais sur le châssis.

### 4.2 Interdits explicites

- Cyberpunk, néons, grilles décoratives, glassmorphism généralisé.
- Textes sous **12 px** (les maquettes décoratives `aria-hidden` sont la seule exception).
- `uppercase` + `letter-spacing` sur les libellés courants.
- Gros dégradés violets génériques. Les dégradés ne servent **qu'à simuler un média**.
- Doubles headers, contrôles dupliqués, boutons morts, éléments décoratifs sans fonction.
- Icônes sans libellé quand le sens est ambigu.
- Classes utilitaires Tailwind (elles ne sont pas compilées sur `/video`).

### 4.3 Tokens — `src/features/vibecut/styles/vibecut.css`

Tout est scopé sous `.vibecut`. Un thème clair est déjà écrit (`[data-theme="light"]`), non activé.

```
Surfaces      --vc-bg #0b0b0d · --vc-bg-sunken #070708
              --vc-surface #16161a · --vc-surface-2 #1d1d22 · --vc-surface-3 #26262c
Lignes        --vc-line rgba(255,255,255,.075) · --vc-line-strong rgba(255,255,255,.14)
Texte         --vc-text #f4f4f6 · --vc-text-2 #a2a2ab · --vc-text-3 #6d6d77
Accent unique --vc-accent #5b7cfa (+ hover, press, quiet, line)
Sémantiques   --vc-success #3ecf8e · --vc-warning #e8b339 · --vc-danger #ff5a5f
Typo          pile système (-apple-system, BlinkMacSystemFont, SF Pro Text, …)
              12 / 13 / 14 (corps) / 16 / 20 / 26 / 34
              monospace RÉSERVÉ aux timecodes, via [data-numeric]
Espacement    base 4 : 4 8 12 16 20 24 32 40 48 64
Rayons        8 / 12 / 16 / 20 / pill
Élévation     3 niveaux maximum (--vc-shadow-1/2/3)
Mouvement     120 / 180 / 240 / 320 ms
              --vc-ease cubic-bezier(.4,0,.2,1) · --vc-ease-out cubic-bezier(.32,.72,0,1)
```

### 4.4 Règles de composition

- **Un seul bandeau supérieur** pour toute la surface VibeCut (`shell/VibeCutShell.jsx`). Les actions propres à un écran vivent **dans l'écran**, à côté de son titre.
- Un éditeur occupe exactement `100dvh − hauteur du bandeau` : ce sont les zones internes qui défilent, **jamais la page**.
- Une action n'existe qu'à **un seul endroit**.
- Chaque écran couvre les 4 états : vide, chargement, erreur, rempli.
- Responsive : grilles qui retombent à 2 puis 1 colonne ; sur mobile, les rangées de vignettes défilent horizontalement plutôt que de s'empiler à l'infini.

### 4.5 Règles de mouvement

- L'animation sert la compréhension : survol d'une carte de mode = démonstration de ce que le mode fait.
- **Décision du porteur du projet, 2026-07-30 — cette règle est renversée** : les vignettes de démonstration (styles, mouvements) tournent **en boucle permanente**, sans attendre le survol. Motif : les démonstrations déclenchées au survol restaient invisibles, on arrivait sur un écran figé et comparer deux styles obligeait à les survoler l'un après l'autre. Le départ de chaque boucle est décalé (`animation-delay` négatif) pour qu'une grille ne bascule pas à l'unisson.
- Reste vrai pour tout le reste : une animation qui ne démontre rien n'a pas sa place. Les barres de tempo ajoutées puis retirées le 2026-07-30 en sont l'exemple — elles encodaient une information réelle mais se lisaient comme un égaliseur décoratif sur une carte déjà sélectionnée.
- `prefers-reduced-motion: reduce` coupe animations et transitions, **et leurs délais** : une cascade en `animation-fill-mode: both` dont le délai survit laisserait le contenu invisible.
- Ce qui doit être fluide à 60 fps ne passe pas par React : voir `preview/playheadClock.js`, écriture directe dans le DOM.

### 4.6 Accessibilité

- Focus visible partout (`:focus-visible`, anneau 2 px accent).
- `aria-pressed` sur les bascules, `aria-label` sur toute icône seule, `role="slider"` + valeurs sur le scrub.
- Libellés d'accessibilité **uniques** dans une même vue : `getByRole(name:)` fait une correspondance partielle, deux « Annuler » cassent les tests et la navigation vocale.

### 4.7 Pièges techniques déjà rencontrés (à ne pas refaire)

1. **Spécificité CSS** : `.vibecut button { background: none }` (0,1,1) écrase les classes des CSS Modules (0,1,0). Tous les resets d'éléments doivent être en `:where()` (spécificité 0).
2. **Attribut `hidden`** : une règle `display: flex` l'écrase. Prévoir `.classe[hidden] { display: none }`.
3. **`aspect-ratio` sur un `<span>` inline** ne s'applique pas : passer le parent en `display: flex` ou l'élément en `display: block`.
4. **Canvas plein format réduit en CSS** : les traits d'aide doivent être épais dans l'espace canvas (`width * 0.005`) pour rester nets à l'écran.
5. **URL et état** : ne jamais relire `searchParams` après le montage si la sauvegarde automatique y écrit — sinon le projet se recharge en pleine édition.

---

## 5. Architecture cible

### 5.1 Routes (toutes `noindex`, derrière `StudioAuthGate`)

```
/video                  Accueil : 3 modes, bibliothèques, projets récents
/video/rapide           Montage rapide          (+ ?project=<id>)
/video/guide            Création guidée         (+ ?project=<id>)
/video/avance           Montage avancé          (+ ?project=<id>)
/video/transitions      Bibliothèque de transitions
/video/mouvements       Bibliothèque de mouvements
```

`src/app/video/layout.js` n'importe **que** `features/vibecut/styles/vibecut.css`. Le bundle Tailwind de `/studio` n'est jamais chargé ici.

### 5.2 Arborescence

```
src/features/vibecut/
  adapters/     useProjectLibrary, useVibeCutProject, useScenes, useMediaImport,
                useGuidedMontage
  data/         motionCatalog, transitionCatalog, styleRecipes
  home/         HomeScreen, ModeMockups, LibraryTiles, RecentProjects
  media/        SceneIllustration (illustrations SVG, aucun asset externe)
  preview/      PreviewStage, TransportBar, playheadClock
  primitives/   Button, IconButton, Segmented, Card, EmptyState, Spinner,
                Progress, Badge, Collapsible
  guided/       GuidedFlow, StepMedia, StepStyle, StepRhythm, StepSound,
                StepFinish, LookPreview
  quick/        QuickEditor, Storyboard, SceneInspector, TextInspector,
                ProjectAudio, MusicSheet, ExportSheet
  advanced/     AdvancedEditor, MediaLibrary, TimelineView, Inspector,
                ExportProSheet
  shell/        VibeCutShell, PhasePlaceholder
  styles/       vibecut.css
```

### 5.3 Règle d'or

> **Aucun composant de `features/vibecut/` n'importe `videoStore`, IndexedDB ou un panneau de l'ancien front.**
> Tout passe par `features/vibecut/adapters/`. `scripts/audit-scope.mjs` le vérifie.

### 5.4 Isolation vérifiée automatiquement

`audit-scope.mjs` contrôle que `/video/layout.js` charge `vibecut.css`, est `noindex`, passe par `StudioAuthGate`, et que **aucun** fichier de `features/vibecut/` n'importe `VideoApp | VibeFxStudio | video/VideoEditor | video/panels | video/timeline | video/preview | vibecut-premium`, ni n'utilise de classe Tailwind.

---

## 6. Références visuelles

Maquettes générées, versionnées dans `public/assets/vibecut-concepts/` (identiques au dossier `~/Desktop/image vibecut/`).

| Écran | Fichier repo | Nom d'origine | Ce qu'on garde | Ce qu'on rejette |
|---|---|---|---|---|
| Accueil | [07-vibecut-accueil-os-premium.png](public/assets/vibecut-concepts/07-vibecut-accueil-os-premium.png) | `Image générée 1.png` | Structure 3 modes + rangées bibliothèques + projets récents | Aplats de couleur en guise de médias |
| Accueil (variante) | [06-vibecut-accueil-modes.png](public/assets/vibecut-concepts/06-vibecut-accueil-modes.png) | — | Cartes de mode avec aperçu de l'écran cible | Libellés marketing |
| Montage rapide | [09-vibecut-montage-rapide-os-polished.png](public/assets/vibecut-concepts/09-vibecut-montage-rapide-os-polished.png) | — | Storyboard en grandes cartes, puces de transition entre scènes | Rail d'icônes sans libellé |
| Flow storyboard | [01-vibecut-flow-storyboard.png](public/assets/vibecut-concepts/01-vibecut-flow-storyboard.png) | `Flow Storyboard.png` | Enchaînement scène → transition → scène | Densité, mono majuscules |
| Création guidée | [02-vibecut-create-guide.png](public/assets/vibecut-concepts/02-vibecut-create-guide.png) | `Création guidée.png` | Étapes numérotées, choix de style visuel, aperçu vertical | 3 colonnes simultanées : trop de charge |
| Montage avancé | [08-vibecut-montage-avance-os-premium.png](public/assets/vibecut-concepts/08-vibecut-montage-avance-os-premium.png) | — | Bibliothèque / aperçu / inspecteur / timeline multipiste | Scopes et vumètres décoratifs |
| Studio hybride | [03-vibecut-studio-hybride.png](public/assets/vibecut-concepts/03-vibecut-studio-hybride.png) | `Studio hybride.png` | Bascule storyboard ↔ timeline | Deux headers |
| Mouvements | [04-module-mouvements-animations.png](public/assets/vibecut-concepts/04-module-mouvements-animations.png) | `Mouvements et animations.png` | Trajectoire départ → arrivée, courbe d'accélération, intensité | Promesses non rendues par le moteur |
| Transitions | [05-module-transitions.png](public/assets/vibecut-concepts/05-module-transitions.png) | `Bibliothèque de transitions.png` | A/B avant/après, badge de compatibilité export, réglage de durée | Catégories « expérimentales » fourre-tout |

**Règle** : ces images sont des intentions, pas des cibles pixel. Toute amélioration est bienvenue si elle reste fonctionnelle, implémentable et cohérente entre écrans. Aucune fonction ne doit être montrée si le moteur ne la rend pas : marquer « Bientôt » plutôt que promettre.

---

## 7. Phases

Chaque phase se termine par le **rituel de fin de phase** (§ 9).

### Phase 0 — Fondations · ✅ terminée
Route `/video` isolée · tokens + base CSS · primitives · adaptateurs · extraction du contrôleur d'export · bibliothèque multi-projets IndexedDB · squelette de tests · assertions d'isolation.
**Gate** : `lint`, `build`, suites existantes vertes.

### Phase 1 — Accueil · ✅ terminée
Page d'accueil réelle : 3 cartes de mode avec maquettes CSS animées, rangées Mouvements et Transitions avec aperçus animés au survol, projets récents (états vide / chargement / erreur), création et suppression de projet.
**Gate** : accueil, isolation CSS, règle typographique, cycle projet, `noindex` des 6 routes.

### Phase 2 — Montage rapide · ✅ terminée
Import (bouton + glisser-déposer), storyboard en grandes cartes réordonnables en pointer events, inspecteur contextuel (durée, mouvement, transition, volume), texte complet (multiligne, fond/contour, magnétisme sur l'aperçu), musique avec déclaration de droits, aperçu réel, transport fluide, annuler/rétablir, découpe de scène, sauvegarde automatique, feuille d'export avec téléchargement.
**Gate** : 10 tests navigateur, `test:vibecut-export` vert, filtres FFmpeg validés localement.

### Phase 3 — Création guidée · ✅ terminée
Assistant pas à pas sur `/video/guide`, partageant le même projet que les autres modes.
- Étapes livrées : **Médias → Format & style → Rythme & mouvements → Son & textes → Finaliser**.
- Une décision par écran, rail de progression, retour arrière libre par le rail, panneau remis en haut à chaque étape.
- Moteur de recettes **pur** (`data/styleRecipes.js`, zéro import) : 4 styles × 3 rythmes × 3 jeux de mouvements → durée par photo, alternance des mouvements, transition et sa durée, look colorimétrique complet, format.
- Génération **live** : chaque choix réécrit le montage en une seule opération du store, l'aperçu de droite joue le résultat réel.
- **Mouvement qui démontre** (§ 4.5) : chaque vignette — style ou mouvement — joue **deux plans qui s'enchaînent en boucle**, à la cadence réelle du réglage et avec sa longueur de fondu réelle. « Net et direct » coupe franchement dans sa vignette comme il coupera dans la vidéo ; « Doux » (zoom avant puis arrière) se distingue de « Varié » (zoom avant puis panoramique). Le contenu d'étape entre du côté d'où il vient, la barre de progression suit.
- Sorties : export direct, « Ouvrir en montage rapide », « Ouvrir en montage avancé » sur le même `?project=`.
**Gate** : `smoke-vibecut-style-recipes` (5 jeux de scènes × 4 styles × 3 rythmes + parité moteur/serveur) et `smoke-vibecut-guided-v2` (parcours navigateur + réouverture dans le montage rapide + zéro erreur console).

### Phase 3b — Presets de montage · 🟡 **en cours** — L1, L2 et L3 livrés le 2026-07-30, L4 à L6 restants
Les quatre styles de la phase 3 ne se distinguent que par **trois nombres et une teinte** : trois d'entre eux sont le même fondu enchaîné à trois vitesses. Cette phase les transforme en vraies partitions de montage.
- **Feuille de route détaillée : [docs/vibecut-styles-roadmap-2026-07-30.md](docs/vibecut-styles-roadmap-2026-07-30.md)** — diagnostic, faits vérifiés, modèle cible, vocabulaire de transitions, lots L1 à L6, risques.
- Un preset devient une partition à 7 dimensions : structure rythmique (poids, pas durée fixe), **partition de transitions** (séquence + accents, pas une valeur répétée), chorégraphie des mouvements, colorimétrie, typographie de titre, profil audio, format.
- **L1 ✅ livré** : le `xfade=transition=fade` écrit en dur dans le renderer est remplacé par une table de correspondance. Le vocabulaire exportable passe de **1 à 15 transitions distinctes**, chacune réimplémentée au canvas et **comparée image par image au rendu FFmpeg** par un test automatique. Les courbes des fondus par couleur sont relevées sur des rendus réels, pas approximées. `zoom-punch` a été écarté (rendu `xfade=zoomin` inutilisable sur photo). Détail : roadmap § 9.
- **L2 ✅ livré** : un preset est désormais une **partition** — poids par plan, séquence de transitions avec accents, chorégraphie de mouvements, colorimétrie, titre, profil audio, format. `buildMontagePlan()` produit un plan **par scène**, appliqué par l'action **additive** `applyMontageScore` du store (`applyGuidedTemplate` reste intacte pour l'ancien front). Six presets remplacent les quatre anciens.
- Synergie rythme ↔ style tenue : `durée(scène i) = beatBase(rythme) × beatPattern[i](style) × holds`. Un test compare les **rapports** entre plans d'un rythme à l'autre — changer de rythme comprime le montage sans changer sa forme.
- Garde-fou en place : une transition ne dépasse jamais **45 %** du plus court des deux plans adjacents.
- Cartes de preset bâties sur les **miniatures réelles du projet**, plus sur des illustrations génériques.
- **L3 ✅ livré** : le mouvement des photos est enfin rendu à l'identique des deux côtés. Le `smoothstep` de l'aperçu est porté dans l'expression `zoompan`, un facteur d'**intensité** multiplie l'écart `end − start` de la même façon des deux côtés, et un **troisième** écart jamais relevé est corrigé au passage — le décalage de panoramique n'était pas divisé par le zoom et voyageait ~11 % trop loin à l'export. Trois crans nommés à l'étape 3 (Discret 40 % · Naturel 70 % · Marqué 100 %). Détail : roadmap § 9.
**Gate** : un rendu MP4 local réel par transition ✅, structure de battement et placement des accents vérifiés par test pur ✅, mouvement comparé image par image sur un MP4 réel ✅, un **seul** rollout Cloud Run en fin de phase (L6, non fait).
**Reste** : L4 cartes sur miniatures réelles · L5 étape rythme visible · L6 rollout.

### Phase 4 — Montage avancé · ✅ terminée (2026-07-31)
- **Quatre zones** sur `/video/avance` : bibliothèque de médias (recherche, tri, vignettes réelles), aperçu central, inspecteur contextuel, timeline multipiste.
- **Timeline multipiste** bâtie sur `timelineModel.js` *tel quel*, via `adapters/useTimeline.js`. Les sept pistes du modèle sont rendues dans leur ordre déclaré, avec les seules bascules qui font quelque chose (une piste visuelle n'a pas de son à couper).
- **Ce que le modèle autorise, et rien de plus** : sur la piste vidéo les clips sont posés bout à bout et leur début est *calculé*, donc glisser un clip le **réordonne** (avec indicateur de dépôt) et les poignées le **rognent** ; un texte, une musique ou une transition libre — dont le début est une donnée — se déplacent et se redimensionnent vraiment. Proposer un déplacement libre sur la piste vidéo aurait menti sur le modèle.
- Découpe à la tête de lecture, magnétisme (`buildTimelineSnapPoints` + `snapTimeToPoints`, avec annonce du point atteint), zoom 4 → 480 px/s recadré automatiquement tant que personne n'a touché au zoom, playhead 60 fps écrit directement dans le DOM. Interactions en pointer events, **commit au relâchement**.
- **Inspecteur contextuel** : mouvement avec le **curseur d'intensité continu** annoncé par L3 (les trois crans nommés restent à la création guidée), transformation (rotation 0/90/180/270), vitesse, colorimétrie, son du clip ; délégation à `TextInspector` pour les textes.
- **Export professionnel** : cadence Auto/24/25/30/50/60, qualité Brouillon/Pro/Master, pré-vol réel du contrôleur d'export existant.
- **Moteur d'aperçu hissé dans le layout** : `preview/PreviewEngineHost.jsx` porte un `PlaybackEngine` et un canvas **singleton** au-dessus des routes ; `PreviewStage` déclare seulement où le canvas vient se poser. Le canvas est **déplacé**, pas re-créé — un portail React aurait démonté puis remonté les enfants à chaque changement de conteneur, donc un canvas neuf par navigation, exactement ce qu'on voulait éviter.
**Gate** : `scripts/smoke-vibecut-advanced-v2.spec.cjs` (11 tests) porte les assertions de l'ancien `smoke-video-ui.spec.cjs` sur les nouveaux testids, plus le responsive à 390 px et la **preuve** du moteur unique (canvas marqué sur `/video/rapide`, retrouvé marqué sur `/video/avance` après navigation client). Intégré à `test:vibecut-ui-v2` (13 → 24 tests navigateur).

### Phase 5 — Bibliothèques · ✅ terminée le 2026-08-01
- **Transitions** (`/video/transitions`) : les 38 entrées du catalogue, groupées, chacune avec un aperçu **A/B animé entre deux scènes réelles du projet**, réglage de durée borné par les 45 %, application à une coupe ou à toutes, **badge de compatibilité export** lu de `getServerRenderCapabilityStatus` — 15 « Export Pro », 23 « Aperçu uniquement ».
- **Mouvements** (`/video/mouvements`) : trajectoire départ → arrivée éditable, intensité, vitesse (= durée du plan), courbe d'accélération, application à une photo ou à toutes. Les 7 mouvements `planned` restent listés, marqués « Bientôt », et **n'offrent aucun réglage**.
- **Décision structurante : les aperçus sont dessinés par le moteur, pas imités en CSS.** `renderTransition` de `VideoEngine.js` (rendue exportée) et `applyImageMotionTransform` de `mediaModel.js` pilotent les canvas des cartes. Une carte ne peut donc plus diverger du rendu qu'elle annonce — et les tests de parité L1/L3 la couvrent gratuitement. Une imitation CSS n'aurait été couverte par rien.
- **Une seule horloge** (`library/previewTicker.js`) pour toutes les vignettes, + `IntersectionObserver` : une `requestAnimationFrame` par carte aurait ouvert quarante boucles concurrentes sur un écran de catalogue.
- **Deux limites assumées et dites à l'écran** : la courbe **linéaire** est affichée *désactivée* (le renderer écrit `smoothstep` en dur — la proposer aurait créé une dette de parité de plus) ; et l'éditeur de trajectoire **fait respecter** `|x| ≤ (zoom − 1) / 2` (problème I) au lieu de le documenter, donc on ne peut pas construire ici un mouvement inexportable.
**Gate** : `scripts/smoke-vibecut-library-parity.mjs` (parité catalogue ↔ moteur ↔ capacités serveur, sans navigateur) + `scripts/smoke-vibecut-library-v2.spec.cjs` (9 tests navigateur qui **mesurent les pixels** des canvas et vérifient les contrôles par leur *absence*). Les deux sont dans `test:vibecut-ui-v2`, et `audit-scope.mjs` verrouille la surface.

### Phase 6 — Extensions moteur · ⬜ à faire
Orbite, parallaxe, rotation, apparition, rebond, glitch · mouvements sur vidéo · courbes d'intensité et trajectoires personnalisées · parité navigateur ↔ serveur pour chaque ajout.
**Gate** : `smoke-vibecut-export-coverage-parity` étendu + rendus MP4 locaux.

### Phase 7 — Bascule et nettoyage · ✅ terminée le 2026-08-01
- **`/studio?workspace=video` redirige vers `/video`**, côté **serveur** et non depuis un composant client : un lien ou un favori existant n'affiche jamais une page vide le temps qu'un composant décide de naviguer. `video` a quitté la liste des workspaces du studio.
- **L'ancien front vidéo est supprimé** : `VideoApp`, `VideoEditor`, les 12 panneaux, les 5 fichiers de timeline, les 2 d'aperçu, `vibecut-premium.css`, `guidedTemplates.js`, `storyboardLibrary.js`, `quickTools.js`, et les specs `smoke-video-ui` / `smoke-vibecut-quick-tools`. **10 036 lignes.**
- **Ce qui est resté est ce dont le nouveau front dépend** : modèles (`timelineModel`, `mediaModel`, `videoProjectModel`), moteurs (`VideoEngine`, `xfadeTransitions`, `textOverlayRenderer`), export, store, persistance, `musicRights`, `musicCatalog` (la bande-son s'en sert), `audioWaveform`.
- **Trois fonctions du panneau supprimé ont été DÉPLACÉES, pas perdues** — c'est le vrai travail de cette phase. Le panneau portait l'enregistrement direct dans un dossier du PC (File System Access API) et sa mémorisation, un nom de fichier **horodaté** (sans quoi deux exports du même projet s'écrasent), et la régénération d'URL signée par Storage avant de retomber sur la callable. Elles vivent désormais dans `export/exportDownload.js` — de la logique, dans la couche logique — et les deux feuilles d'export du nouveau front les utilisent via `adapters/useExportDownload.js`.
- **Un quatrième oubli rattrapé au passage** : `resolveOutputMediaMetadata` se retrouvait importé par le contrôleur sans être appelé nulle part. Le nouveau front annonçait donc « MP4 » sans jamais relire ce que le rendu avait produit. Les deux feuilles affichent maintenant conteneur / codec / MIME **lus du job**, et une simulation locale annonce « simulation ».
- Le passage **bande-son → vidéo** navigue vers `/video/rapide` par `router.push` : une navigation cliente, donc le store Zustand survit et la piste qu'on vient d'ajouter est bien là à l'arrivée. Un rechargement complet l'aurait perdue.
**Gate** : `audit-scope.mjs` vérifie **les deux moitiés** — que la redirection existe *et* que les fichiers sont bien partis (un fichier resté sur le disque ferait croire le nettoyage fait). Plus un test navigateur qui suit la redirection jusqu'à son **URL finale**. Suite portée à **43 tests navigateur**.

---

## 8. Parité aperçu ↔ export

Règle absolue : **rien n'est proposé dans l'interface si l'export ne sait pas le rendre**, sauf mention explicite « aperçu seulement ».

| Fonction | Aperçu navigateur | Export serveur (FFmpeg) |
|---|---|---|
| Mouvements photo | `applyImageMotionTransform` | `zoompan` — 6 presets déclarés |
| Courbe du mouvement | `smoothstep` (`p²(3−2p)`) | ✅ **résolu en L3** : même `smoothstep` écrit dans l'expression `zoompan` |
| Intensité du mouvement | facteur sur l'écart `end − start` | ✅ **résolu en L3** : même facteur, même formule, mesuré sur un MP4 réel |
| Type de transition | `renderXfadeTransition` | ✅ **résolu en L1** : `SERVER_XFADE_TRANSITION_MAP`, repli sur `fade` si l'id est inconnu |
| Transitions minutées | `engine/xfadeTransitions.js` (15) | `xfade` natif (15), mesuré image par image par `smoke-vibecut-xfade-preview-parity` |
| Transitions « aperçu seulement » | `renderTransition` (les 27 autres) | non rendues — jamais employées par un preset guidé |
| Texte multiligne | découpe sur `\n` | `line_spacing` |
| Fond de texte | rectangle arrondi | `box=1:boxcolor=…@0.78` |
| Contour de texte | `strokeText` | `borderw` + `bordercolor` |
| Départ dans le morceau | `trimStart` | `atrim=start=` |
| Fondus audio | `resolveAudioFadeVolume` | `afade` in/out |
| Look colorimétrique | `ctx.filter` + calques | `eq`, `colorbalance`, `vignette`, `noise` |
| Rotation d'orientation | `orientationRotation` | `transpose` / `hflip,vflip` — 90/180/270 |
| Vitesse de clip | `speed` joué par le moteur | ❌ **non rendue** (`clipSpeeds: [1]`) — exposée avec le badge « Aperçu uniquement », et le **pré-vol de l'export la refuse** explicitement |

⚠️ Toute modification de `render-service/` exige un **redéploiement Cloud Run** pour être effective. Discipline de coûts : valider d'abord en local (`test:vibecut-export`, rendu FFmpeg direct), ne déployer que sur demande explicite.

---

## 9. Rituel de fin de phase — obligatoire

À la fin de **chaque grande phase et de chaque module livré**, avant de passer à la suite :

1. **Vérifier** : `npm run lint`, `npm run build`, la suite de tests du nouveau front, et les suites impactées (`test:vibecut-export` si l'export a bougé).
2. **Mettre à jour [todo.md](todo.md)** : ce qui est fait, ce qui reste, les bugs trouvés et corrigés, les problèmes connus.
3. **Mettre à jour ce `plan.md`** : marquer la phase ✅, ajuster les phases suivantes si l'audit a changé la donne.
4. **Mettre à jour [map.md](map.md)** : arborescence et entrée de journal datée (exigence `AGENTS.md`).
5. **Produire un prompt de relance** en fin de `todo.md` : contexte minimal, état, prochaine étape, commandes, pièges — pour repartir dans un chat neuf sans rien relire.
6. **Rapporter honnêtement** : ce qui marche, ce qui est laissé de côté et pourquoi, les échecs de tests préexistants.

---

## 10. Risques suivis

| Risque | Parade |
|---|---|
| Écart aperçu / export | Tableau § 8 tenu à jour, badges de capacité, tests de parité |
| Écarts de parité non détectés par les badges | Les badges disent ce qui est *déclaré*, pas ce qui est *rendu* : **trois** écarts (type de transition, courbe du mouvement, décalage non divisé par le zoom) ont vécu sans être vus. Tout ajout moteur exige un rendu MP4 local comparé à l'aperçu, pas seulement une déclaration de capacité |
| Un test de parité qui ne prouve rien | Aux amplitudes réelles, une erreur de courbe peut passer sous le bruit de rééchantillonnage. Chaque test de parité embarque une **sentinelle** : le défaut qu'il est censé attraper, rejoué volontairement, doit le faire échouer |
| Mouvement dont la fenêtre sort du cadre | `zoompan` borne sa fenêtre à l'image, le canvas non : la condition `\|x\| ≤ (zoom − 1) / 2` doit tenir pour tout mouvement ajouté (phase 6) |
| Bundle Tailwind statique | Zéro Tailwind dans `features/vibecut/`, vérifié par `audit-scope` |
| Slices UI du store lues par l'ancien front | Extractions **additives** jusqu'à la phase 7 |
| Blob URLs et multi-projets | Réhydratation par l'adaptateur, jamais dans les composants |
| Fluidité timeline | Interactions en pointer/transform, commit au relâchement |
| Coûts Cloud Run | Validation locale obligatoire, déploiement sur demande |

---

## 11. Commandes

```bash
npm run dev                     # serveur local
npm run lint
npm run build
npm run test:vibecut-ui-v2      # nouveau front : recettes + accueil + rapide + guidé
npm run test:vibecut-recipes    # moteur de recettes seul (pur, sans navigateur) — gate du lot L2
npm run test:vibecut-export     # chaîne d'export complète (dont la parité des tables de transitions)
npm run test:vibecut-xfade-preview-parity   # aperçu canvas vs rendu FFmpeg, image par image
npm run test:vibecut-motion-parity          # mouvement photo : MP4 réel vs aperçu, image par image
npm run test:vibecut-xfade-local-mp4        # un MP4 réel par transition (lourd)
npm run test:video-ui           # ancien front (référence)
npm run test:scope              # isolation des surfaces
```
