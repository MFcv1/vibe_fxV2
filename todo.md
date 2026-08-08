# TODO — Vibe_fx V2

> **Dernière mise à jour : 2026-08-08.**
>
> Ce fichier ne porte QUE le chantier actif : le **redesign VibeOS**
> (Studio / Layout / Vision / Soundtrack refaits en pages `/creer/*`).
>
> Le chantier précédent — la reconstruction de l'interface VibeCut, close le
> 2026-08-04 — a été sorti d'ici le 2026-08-08 et vit désormais dans
> **[docs/archive-vibecut-2026-08-04.md](docs/archive-vibecut-2026-08-04.md)**
> (bugs 1 à 59, leçons FFmpeg payées, commandes de test, problèmes connus).
> On n'y touche plus, sauf reprise de `/video` ou de `render-service/`.

**Documents de référence, dans l'ordre de lecture :**

1. [AGENTS.md](AGENTS.md) — règles de travail, rituel de fin de phase, discipline de coûts.
2. **[docs/plan-vibeos-redesign-2026-08-08.md](docs/plan-vibeos-redesign-2026-08-08.md)** — LE plan maître : décisions produit validées, design system `.vibeos`, spec page par page (§5.1 accueil, §5.2 Layout, §5.3 Vision, §5.4 Studio, §5.5 Soundtrack), phases A-F, risques.
3. Ce fichier — état d'avancement et reste à faire.
4. [map.md](map.md) — carte du projet, à tenir à jour.

---

## Vue d'ensemble des phases

| Phase | Contenu | État |
|---|---|---|
| A — Fondations | design system `.vibeos`, primitives, shell + mini-lecteur, store projet IndexedDB, accueil `/creer` | ✅ 2026-08-08 |
| B1 — Layout, cœur | canvas réel (moteurs importés), 4 blocs, templates thématiques, export, vignette | ✅ 2026-08-08 |
| B2 — Layout, créatif | fonds Mesh/Lumen/Flou pro en Sheet, undo/redo, réglages par zone | ✅ 2026-08-08 |
| B3 — Layout, finitions | textures, éditeur de zones custom, stickers, avant/après, aperçu Insta, persistance images, pixel-diff | ✅ 2026-08-08 |
| C — Vision | « Améliorer ma photo » auto (moteurs `visionMetrics` / `visionColorScience` existants), 12 looks triés par photo, avant/après, avancé | ✅ 2026-08-08 |
| D — Studio | ambiances 1 clic, intensité, « Surprends-moi », variantes visuelles, styles perso, mesh/lumen en Sheet | ⏳ **prochaine étape** |
| E — Soundtrack | interface Spotify complète (colonne gauche, rangées, lecteur bas), sources en Sheet, hooks/APIs existants inchangés | à faire |
| F — Bascule | redirections `/studio` → `/creer`, suppression de l'ancien UI, QA transverse desktop + mobile | à faire |

## Règles non négociables du chantier

- **Jamais de Tailwind dans le nouveau code.** Le bundle de `/studio` est un
  artefact statique figé : une classe absente ne fait rien. CSS Modules +
  tokens `--vo-*` uniquement.
- **Jamais réécrire un moteur existant** : on l'importe. Pattern de référence :
  [src/features/vibeos/layout/useLayoutEditor.js](src/features/vibeos/layout/useLayoutEditor.js).
- **Ne pas toucher** à `/studio`, à `src/features/vibefx-studio/` (hors imports
  en lecture) ni à `/video` avant la phase F.
- **Desktop ET mobile sérieux** sur chaque écran. Textes UI en français simple.
- **Aucun déploiement** pendant le chantier : tout se vérifie en local.
- **Fin de chaque tranche** : `npm run lint`, `npm run build`,
  `npm run test:vibeos-layout` (+ le smoke de la phase en cours), mise à jour de
  ce fichier et de `map.md`, prompt de relance réécrit, rapport honnête.
- **Clôture de phase dans le chat** (voir [AGENTS.md](AGENTS.md) § « Clôture de
  phase dans le chat ») : le dernier message d'un lot livré doit contenir le
  récap en langage simple **puis le prompt de reprise complet, écrit dans le
  chat, dans un bloc de code**, prêt pour un chat neuf à contexte zéro. Un lot
  n'est pas terminé tant que ce prompt n'a pas été affiché.

---

## Ce qui est livré

### Phase A — Fondations · ✅ 2026-08-08

- `src/features/vibeos/styles/vibeos.css` — tokens `--vo-*` copiés de VibeCut,
  scope strict `.vibeos`, zéro Tailwind.
- `src/features/vibeos/primitives/` — Button, IconButton, Segmented, Card,
  Badge, Spinner, Progress, EmptyState, Collapsible, Slider, TileGrid/Tile,
  Sheet (panneau latéral desktop / bottom sheet mobile), SearchField,
  ToastProvider/useToast.
- `src/features/vibeos/shell/` — VibeOsShell (topbar 56px unique, nav espaces,
  tab bar basse mobile avec safe-area), MiniPlayer (visible si piste chargée),
  SpacePlaceholder.
- `src/features/vibeos/audio/AudioProvider.jsx` — audio global : l'élément
  `<audio>` vit dans le layout `/creer` et survit aux navigations.
- `src/features/vibeos/project/` — modèle projet v1, IndexedDB (db `vibeos`,
  stores `projects` + `meta`), autosauvegarde débouncée 800ms, récents (8 max),
  dupliquer / supprimer / ouvrir / ensureProject.
- Routes `/creer`, `/creer/layout-visuel`, `/creer/studio`, `/creer/vision`,
  `/creer/son` — toutes noindex, derrière `StudioAuthGate`.

Vérifié : lint 0 erreur (12 warnings préexistants hors vibeos), build vert avec
les 5 routes, smoke HTTP 200 + noindex sur `/creer`. `/studio` et `/video`
intacts.

Assumé : le bouton « Publier » du shell pointe encore vers `/studio` (flux
actuel) jusqu'à la phase F.

### Phase B, tranche 1 — Layout, le cœur · ✅ 2026-08-08

Dans `src/features/vibeos/layout/`, monté sur `/creer/layout-visuel` :

- `useLayoutEditor.js` — composition des moteurs EXISTANTS de vibefx-studio
  (`useLayoutState`, `useCanvasRenderer`, `useCanvasEvents`, `useLayoutHelpers`,
  `useImageUpload`, `useExport`) : pipeline de rendu et export **identiques à
  l'ancien onglet Layout — parité par construction**.
- Écran simple en 4 blocs : Format (6 tuiles silhouettes proportionnelles),
  Modèle (8 modèles + Personnalisé avec les 3 préréglages de zones), Images
  (import par zone, ajout global, bande des importées, drag & drop sur
  l'aperçu), Habillage (marge, arrondi, fond couleur/flou, grain).
- Sheet « Templates prêts à poster » : 17 catégories, aperçus SVG dessinés
  depuis les VRAIES zones et textes des templates, application complète
  (format + zones + textes + fond), toast de confirmation.
- Réglages avancés : textes (ajout, contenu, 15 polices, gras/italique, couleur,
  taille, suppression, drag + snap sur le canvas via le moteur existant),
  géométrie fine (écarts, orientation pellicule).
- Export réel JPG/PNG/WebP (qualité, estimation du poids, découpe panorama) via
  `useExport` inchangé. Vignette 256px + métadonnées écrites dans le projet
  VibeOS (debounce 1,5s).

### Phase B, tranche 2 — Layout, le créatif · ✅ 2026-08-08

- Fonds générés réels : `MeshSheet` (4 couleurs, 6 palettes, mélange, aperçu
  CSS, retirer), `LumenSheet` (même app embarquée `/vendor/lumen` + postMessage
  que l'ancien modal, habillage VibeOS), `SmoothBlurSheet` (moteur partagé
  `vibefx-shared/smoothBlur`). Séquences d'application identiques à
  `VibeFxStudio` (mesh coupe lumen/flou et réciproquement).
- Le bloc Habillage passe à 3 modes de fond : Couleur / Flou / Généré, + bouton
  Flou pro avec état visible.
- Undo/redo : historique 30 états (miroir exact de `VibeFxStudio` : capture,
  restauration, égalité d'états, debounce 400ms), boutons sur l'aperçu +
  raccourcis Cmd+Z / Shift+Cmd+Z (inactifs pendant une saisie).
- Réglages par zone (avancé, quand une zone est sélectionnée) : zoom, décalages
  H/V, bordure, flou — via `updateSlotConfig` existant.

**Smoke navigateur vert** : `npm run test:vibeos-layout`
([scripts/smoke-vibeos-layout-b1.spec.cjs](scripts/smoke-vibeos-layout-b1.spec.cjs)) —
bypass dev → import 2 images → canvas 1080×1080 → modèle Double → template
thématique → mesh appliqué depuis le Sheet → annuler/rétablir → export JPG
téléchargé, plus les gardes anti-scroll (la page ne scrolle jamais sur desktop,
seul le panneau droit scrolle). 5,5 s. Lint 0 erreur, build vert.

---

### Phase B, tranche 3 — Layout, les finitions · ✅ 2026-08-08

- **Textures du fond** : import multiple, texture active, opacité — le moteur
  `renderLayoutImageTexture` existait déjà, seul l'état manquait. Les textures
  entrent dans l'historique undo/redo.
- **Éditeur de zones du modèle personnalisé** : palette `CUSTOM_SHAPE_LIBRARY`
  (clic ou glisser-déposer sur l'aperçu), déplacement à la souris/au doigt et
  poignée de redimension posées exactement sur le canvas
  ([ZoneOverlay.jsx](src/features/vibeos/layout/ZoneOverlay.jsx)), réglages
  fins (largeur, hauteur, position, arrondi), suppression, « Vider le canevas ».
  Toute la géométrie reste celle de `utils/customLayout.js`.
- **Stickers** : le moteur d'assets existant ne fournit qu'un élément, le
  scotch. Il est exposé tel quel (ajout, rotation, opacité, glisser sur
  l'aperçu) — pas de moteur inventé.
- **Comparaison avant/après** : maintien du clic = photo d'origine, cadrée au
  pixel sur le canvas. **Aperçu Instagram** : post, story, carrousel panorama.
- **Le projet survit au rechargement** :
  [layoutPersistence.js](src/features/vibeos/layout/layoutPersistence.js)
  écrit images, textures et fond Lumen en **Blobs** IndexedDB (jamais des
  dataURL), plus zones, slots, textes, stickers, géométrie et fond ; au retour
  sur la page, tout est rechargé.
- **Parité d'export mesurée** : `npm run test:vibeos-layout-parity` pilote
  l'ancien Layout et le nouveau avec la même photo et les mêmes réglages, puis
  compare les deux canvas pixel à pixel → **0 pixel d'écart** sur 1080×1350.
  Le grain est mis à 0 des deux côtés (son motif de bruit est tiré au hasard à
  chaque chargement de page : aucune comparaison exacte n'est possible avec).

**Bug trouvé et corrigé en route** : dès que « Réglages avancés » était ouvert,
la page entière se mettait à scroller sur desktop. Les champs de fichier cachés
sont en `position: absolute` et, sans bloc conteneur, se rattachaient au bloc
initial — ils allongeaient la zone scrollable du document au lieu d'être clipés
par le panneau. Corrigé par `position: relative` sur le panneau et sur le label
d'import ; garde ajoutée au smoke.

### Phase C — Vision · ✅ 2026-08-08

Dans `src/features/vibeos/vision/`, monté sur `/creer/vision` :

- **Aucun moteur réécrit.** Rendu (`useCanvasRenderer` en vue photo), export,
  mesure (`visionMetrics`), bornes (`normalizeVisionFilters`), scoring
  (`scoreProfileForImage`) et vignettes (`renderVisionProfilePreview`) sont
  importés.
- **Extraction, pas duplication** : les fonctions de recommandation vivaient
  *dans* `components/panels/VisionPanel.jsx` sans être exportées. Elles ont été
  sorties telles quelles dans
  `src/features/vibefx-studio/utils/visionRecommendation.js`, et l'ancien
  panneau les importe (plan §4.2). Zéro changement de comportement.
- **« ✨ Améliorer ma photo »** : mesure de l'image → correction déduite des
  signaux (sombre, plate, fade, déjà saturée, visages), repassée par les
  garde-fous smartphone, plus une phrase humaine (« Photo un peu sombre et
  plate — j'ai relevé la lumière et remis du relief. »).
- **Slider d'intensité 0-100 (défaut 80)** branché sur `filterIntensity`, le
  mélange linéaire déjà implémenté par le pipeline : à 0, on revoit exactement
  l'original.
- **12 looks maximum**, rendus sur la vraie photo, renommés en français, triés
  pour la photo courante, badge « Conseillé » sur les deux premiers, looks
  contre-indiqués en fin de liste avec la raison.
- **Avant/après** (maintien = original), **garde-fous smartphone actifs par
  défaut** (débrayables en avancé), **réglages fins** lumière / couleur /
  matière, **bibliothèque complète `CAMERA_BRANDS`** avec « idéal pour » et
  « à éviter ».

**Bug produit trouvé et corrigé en route** : sur une photo de nuit, un look
contrasté + vignette pouvait fermer l'image (luminance moyenne mesurée à
4/255). `normalizeVisionFilters` borne dans l'absolu mais ne regarde pas
l'image ; `guardLookForImage` croise maintenant le look ET les signaux de la
photo (vignette plafonnée, ombres relevées, contraste limité en basse lumière).

**Smoke `npm run test:vibeos-vision`** : parcours réel + le critère du plan §6
— sur 5 photos types (portrait, paysage, nuit, plate, déjà saturée), les 12
looks sont appliqués et mesurés ; aucun ne produit une image grise, noire ou
cramée, et le tri ne recommande pas la même chose pour toutes.

**Limite assumée** : Vision travaille sur **la photo** du projet (la première
image importée), pas encore sur la composition Layout. Le chaînage complet
composition → Vision → Studio est prévu à la phase F (plan §4.3).

---

## Reste à faire

### Phase D — Studio (`/creer/studio`) — prochaine étape

Spec : plan §5.4.

- [ ] **Ambiances en un clic** : 8-10 tuiles-aperçus rendues sur la vraie image,
      chacune un bundle cohérent (filtres + grain + vignette + fond assorti),
      curées depuis `PRESET_CATEGORIES` + 3-4 combinaisons nouvelles, dans
      `vibeos/studio/ambianceCatalog.js` (même format que
      `PRESET_CATEGORIES.profiles`, moteur d'application inchangé).
- [ ] **Slider d'intensité** — réutiliser exactement le mécanisme de Vision
      (`filterIntensity`).
- [ ] **« Surprends-moi »** : tirage pondéré par les signaux image
      (`getImageRecommendationSignals`, déjà partagé dans
      `utils/visionRecommendation.js`) + jitter ±10 % sur 3 paramètres max.
- [ ] **Variantes** : les 6 derniers états appliqués en vignettes, clic =
      réapplication (historique visuel, complémentaire de l'undo).
- [ ] **Fond généré** : réutiliser `MeshSheet` / `LumenSheet` de
      `vibeos/layout/` (les sortir dans un dossier partagé plutôt que copier).
- [ ] **Avancé** : filtres manuels, crop, **styles perso**
      (`localStorage vibeos.studio.customStyles`).
- [ ] Nouveau smoke `test:vibeos-studio`.

### Phase E — Soundtrack (`/creer/son`)

Spec : plan §5.5. **Aucune nouvelle feature de fond** — hooks et services
existants intacts, interface refaite : colonne gauche 260px, rangées type
Spotify, recherche, vues bibliothèque/playlist, lecteur fixe 72px, sources en
Sheet, badges de licence, pont « Utiliser dans VibeCut ».

### Phase F — Bascule

Spec : plan §4.4. `/studio` → `redirect('/creer')` avec mapping des
`?workspace=`, suppression de `VibeFxStudio.jsx` et des composants UI morts
(garder les moteurs importés), suppression de `HeroSidebar`, adaptation des
smokes qui référencent les anciens sélecteurs, QA transverse du parcours complet
sur desktop et mobile. La suppression est un commit séparé et réversible.

C'est aussi là que se chaîne le pipeline complet du plan §4.3 : composition
Layout → filtres Vision → effets Studio → export (aujourd'hui Vision travaille
sur la photo source, pas sur la composition).

## Points d'attention (plan §7)

- **Perf des tuiles-aperçus** (looks Vision, ambiances Studio, templates
  Layout) : rendu différé + cache par hash image+filtres, 384px max.
- **IndexedDB et images lourdes** : stocker des **Blobs**, pas des dataURLs ;
  récents plafonnés à 8 avec vignettes 256px ; gérer le quota (try/catch +
  dégradation en mémoire).
- **Provider audio et App Router** : l'élément `<audio>` doit rester dans
  `creer/layout.js` ; tester un changement de page pendant la lecture.
- **Double design system** : `.vibecut` et `.vibeos` coexistent pendant la
  transition. Aucun style global, aucune page publique ne doit charger
  `vibeos.css`.
- **Parité d'export** : tout écart de rendu entre ancien et nouveau Layout est
  un bug bloquant, pas un détail à noter.

## Échecs de tests préexistants (hors chantier VibeOS)

Ils datent d'avant ce chantier, ne sont pas causés par lui, et ne bloquent pas
les gates VibeOS (`lint`, `build`, `test:vibeos-layout`). Détail complet dans
l'[archive VibeCut](docs/archive-vibecut-2026-08-04.md#problèmes-connus-non-résolus).

| Test | Nature |
|---|---|
| `scripts/smoke-vibecut-media-safety.spec.cjs` (3 échecs) | crash du moteur de rendu sur des fixtures WebM de 7 Mo — fichier non commité, WIP d'une session antérieure |
| `npm run test:vibecut-export-local-mp4` | ses fixtures pointent `C:\Users\pcpor\…` — environnement Windows d'origine |
| `.mp4` de `videotest/` | pointeurs Git LFS de 132 octets ; les smokes récents fabriquent leurs médias avec `ffmpeg-static` |
| `npm run test:vision-ui` — 2 échecs sur 9 | ancien panneau Vision : `Kodak Ektar 100` dépasse le seuil de clipping chaud (0,0869 pour < 0,08) et un redo ne redonne pas exactement la même empreinte canvas. **Vérifié le 2026-08-08 : identiques avec ou sans l'extraction de `visionRecommendation.js`** (test refait en revenant au fichier d'origine). Les 7 autres tests passent — avant ce lot, 6 d'entre eux échouaient simplement parce que le smoke ne franchissait pas le portail d'authentification de dev ; c'est corrigé. |

---

## Commandes

```bash
npm run dev                  # http://localhost:3000 (ou 3001)
npm run lint
npm run build
npm run test:scope           # isolation vis-à-vis du projet source
npm run test:vibeos-layout        # Layout VibeOS : B1 (import → composition → mesh → undo/redo → export) + B3 (textures, zones, stickers, comparer, aperçu Insta, reprise après rechargement, mobile)
npm run test:vibeos-vision        # Vision VibeOS : parcours réel + 12 looks mesurés sur 5 photos types
npm run test:vibeos-layout-parity # pixel-diff ancien Layout (/studio) vs nouveau (/creer/layout-visuel) — 0 pixel d'écart attendu
```

Les suites VibeCut (`test:vibecut-*`) ne concernent pas ce chantier ; leur liste
est dans l'[archive](docs/archive-vibecut-2026-08-04.md#commandes).

---

## Prompt de reprise (phase D — Studio)

> À copier tel quel dans un nouveau chat, contexte à zéro.
> Ce texte est aussi affiché dans le chat à la fin de chaque lot livré
> (AGENTS.md § « Clôture de phase dans le chat »).

Reprends le chantier VIBEOS (redesign de Vibe_fx V2) exactement là où il s'est
arrêté.

PROJET : /Users/matthis/Desktop/mes projets mac/vibe_fxV2 (branche
vibecut/phases-3b-5-6-7)

LIS DANS CET ORDRE, avant d'écrire la moindre ligne :
1. AGENTS.md — règles de travail, rituel de fin de phase, clôture de phase dans
   le chat, discipline de coûts.
2. docs/plan-vibeos-redesign-2026-08-08.md — LE plan maître : décisions produit
   validées, design system .vibeos, specs page par page (§5.4 Studio,
   §5.5 Soundtrack), phases A-F, risques §7.
3. todo.md — état d'avancement, reste à faire, points d'attention.
4. map.md — journaux datés 2026-08-08 (VibeOS phases A, B1, B2, B3, C).
NE LIS PAS docs/archive-vibecut-2026-08-04.md : archive d'un chantier clos,
utile seulement si tu touches à /video ou à render-service/.

ÉTAT ACTUEL (tout vérifié : lint 0 erreur, build vert, smokes verts) :
- Phase A : design system .vibeos, primitives, shell + mini-lecteur audio
  global, store projet IndexedDB, accueil incubateur sur /creer.
- Phase B (tranches 1, 2, 3) : l'écran Layout complet tourne sur
  /creer/layout-visuel (src/features/vibeos/layout/). 4 blocs, ~80 templates
  thématiques, fonds Mesh/Lumen/Flou pro, undo/redo, textures, éditeur de zones
  custom (déplacement + redimension sur l'aperçu), stickers, comparaison
  avant/après, aperçu Instagram, export, et le projet complet (images en Blobs
  IndexedDB) survit à un rechargement.
- Phase C : l'écran Vision tourne sur /creer/vision
  (src/features/vibeos/vision/) : « Améliorer ma photo » construit sur
  visionMetrics/visionColorScience, intensité 0-100 (défaut 80) branchée sur
  filterIntensity, 12 looks français triés par photo avec badges « Conseillé »
  et raisons, avant/après, garde-fous smartphone, bibliothèque CAMERA_BRANDS en
  avancé.
- Les moteurs de vibefx-studio sont IMPORTÉS, jamais réécrits. La parité
  d'export du Layout est MESURÉE : 0 pixel d'écart avec l'ancien écran
  (npm run test:vibeos-layout-parity).

GATES AU MOMENT DE L'ARRÊT :
- npm run lint → 0 erreur (12 warnings préexistants, aucun dans vibeos)
- npm run build → vert, routes /creer/* générées
- npm run test:vibeos-layout → 2 tests verts
- npm run test:vibeos-vision → 2 tests verts
- npm run test:vibeos-layout-parity → vert (0 pixel d'écart)
- npm run test:vision-ui → 7/9 (2 échecs préexistants documentés dans todo.md)

TA MISSION : phase D (Studio) sur /creer/studio, spec plan §5.4, dans l'ordre :
1. Ambiances en un clic : 8-10 tuiles-aperçus rendues sur la vraie image,
   chacune un bundle cohérent (filtres + grain + vignette + fond assorti),
   curées depuis PRESET_CATEGORIES + 3-4 combinaisons nouvelles, dans
   vibeos/studio/ambianceCatalog.js (même format que PRESET_CATEGORIES.profiles,
   moteur d'application inchangé).
2. Slider d'intensité — réutilise le mécanisme de Vision (filterIntensity).
3. « Surprends-moi » : tirage pondéré par les signaux image
   (getImageRecommendationSignals, déjà partagé dans
   src/features/vibefx-studio/utils/visionRecommendation.js) + jitter ±10 % sur
   3 paramètres max.
4. Variantes : les 6 derniers états appliqués en vignettes, clic =
   réapplication instantanée (historique visuel, complémentaire de l'undo).
5. Fond généré : réutilise MeshSheet / LumenSheet de vibeos/layout/ (sors-les
   dans un dossier partagé plutôt que de les copier).
6. Avancé : filtres manuels, crop, styles perso
   (localStorage vibeos.studio.customStyles).

RÈGLES NON NÉGOCIABLES :
- Jamais de Tailwind dans le nouveau code (le bundle de /studio est un artefact
  statique figé : une classe absente ne fait rien) : CSS Modules + tokens
  --vo-* uniquement.
- Jamais réécrire un moteur existant : l'importer (pattern de
  src/features/vibeos/layout/useLayoutEditor.js et
  src/features/vibeos/vision/useVisionEditor.js). Si la logique utile est
  enfermée dans un composant, l'EXTRAIRE dans un module partagé (comme
  utils/visionRecommendation.js) plutôt que la dupliquer.
- Ne pas toucher à /studio, à src/features/vibefx-studio (hors imports en
  lecture et extractions sans changement de comportement) ni à /video avant la
  phase F.
- Desktop + mobile sérieux sur chaque écran. Textes UI en français simple.
- Aucun déploiement : tout se vérifie en local.

FIN DE TRANCHE (rituel obligatoire) :
npm run lint, npm run build, npm run test:vibeos-layout,
npm run test:vibeos-vision (+ un nouveau smoke pour Studio), mise à jour de
todo.md et de map.md (arbre + journal daté), rapport honnête de ce qui marche
et de ce qui est laissé de côté — ET, dans le chat, le récap en langage simple
suivi du prompt de reprise complet dans un bloc de code, prêt pour un chat neuf
à contexte zéro.
