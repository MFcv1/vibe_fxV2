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
| B3 — Layout, finitions | textures, éditeur de zones custom, stickers, avant/après, aperçu Insta, persistance images, pixel-diff | ⏳ **prochaine étape** |
| C — Vision | « Améliorer ma photo » auto (moteurs `visionMetrics` / `visionColorScience` existants), 12 looks triés par photo, avant/après, avancé | à faire |
| D — Studio | ambiances 1 clic, intensité, « Surprends-moi », variantes visuelles, styles perso, mesh/lumen en Sheet | à faire |
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

## Reste à faire

### Tranche B3 — Layout, les finitions (prochaine étape, dans cet ordre)

1. **Textures multiples du fond + opacité** — les états sont encore neutres dans
   le hook ; le moteur existant les porte déjà.
2. **Éditeur de zones custom** — ajout, déplacement, redimension, avec
   `CUSTOM_SHAPE_LIBRARY`.
3. **Stickers / assets**, **comparaison avant/après** (maintien = original),
   **aperçu Insta**.
4. **Persistance des images du projet en Blobs IndexedDB** — aujourd'hui seuls
   format / template / géométrie / vignette sont synchronisés au store, les
   images ne survivent pas à un rechargement.
5. **Pixel-diff automatisé ancien vs nouveau Layout** — aujourd'hui la parité
   est *garantie par le partage du code de rendu*, elle n'est pas *mesurée*.

### Phase C — Vision (`/creer/vision`)

Spec complète : plan §5.3. Construite sur les moteurs EXISTANTS
`utils/visionMetrics.js` et `utils/visionColorScience.js` (analyse peau / ciel /
nuit / image plate déjà écrite) — rien à réécrire.

- [ ] Bouton **« ✨ Améliorer ma photo »** : `visionMetrics` analyse → correction
      ciblée (exposition si `meanLuma` bas, clarity/dehaze si plat, vibrance
      prudente, protection peau via `skinToneRatio`) + phrase humaine dérivée de
      `getImageRecommendationSignals`.
- [ ] **Slider d'intensité global** (0-100, défaut 80) pondérant la correction.
- [ ] **12 looks MAX au premier niveau**, rendus sur la vraie photo, renommés en
      français évocateur, triés pour la photo courante par `scoreProfileForImage`,
      badge « Conseillé » sur les 2 premiers, looks contre-indiqués en fin de
      liste (opacité réduite + raison).
- [ ] **Avant/après** : maintien = photo d'origine ; split `visionCompareSplit`
      en avancé.
- [ ] **Garde-fous smartphone actifs par défaut** (`applySmartphoneOutputGuards`,
      `safeSmartphone`), débrayables uniquement en avancé.
- [ ] **Réglages avancés** : lumière, couleur (saturations sélectives),
      texture, bibliothèque complète `CAMERA_BRANDS` avec bestFor/avoidFor,
      favoris, look perso, historique.
- [ ] **Nouveau smoke** `test:vibeos-vision` + critère du plan : sur 5 photos
      tests (portrait, paysage, nuit, plate, déjà saturée), aucun des 12 looks ne
      produit une image grise ou cassée, et le tri recommande des looks
      différents selon la photo.

### Phase D — Studio (`/creer/studio`)

Spec : plan §5.4. Ambiances en un clic (8-10 tuiles sur la vraie image),
slider d'intensité, « Surprends-moi » (tirage pondéré par les signaux image),
variantes (6 derniers états, historique visuel), fond généré Mesh/Lumen en
Sheet, avancé (filtres manuels, crop, styles perso en localStorage).

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

---

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

---

## Commandes

```bash
npm run dev                  # http://localhost:3000 (ou 3001)
npm run lint
npm run build
npm run test:scope           # isolation vis-à-vis du projet source
npm run test:vibeos-layout   # smoke navigateur Layout VibeOS (import → composition → mesh → undo/redo → export)
```

Les suites VibeCut (`test:vibecut-*`) ne concernent pas ce chantier ; leur liste
est dans l'[archive](docs/archive-vibecut-2026-08-04.md#commandes).

---

## Prompt de reprise (tranche B3, puis phase C Vision)

> À copier tel quel dans un nouveau chat, contexte à zéro.
> Ce texte est aussi affiché dans le chat à la fin de chaque lot livré
> (AGENTS.md § « Clôture de phase dans le chat »).

Reprends le chantier VIBEOS (redesign de Vibe_fx V2) là où il s'est arrêté.

Lis dans cet ordre : `AGENTS.md`, puis
`docs/plan-vibeos-redesign-2026-08-08.md` en entier (surtout §5.2 Layout et §5.3
Vision), puis `todo.md`, puis les journaux datés 2026-08-08 de `map.md`.
`docs/archive-vibecut-2026-08-04.md` est une archive : ne la lis que si tu
touches à `/video` ou à `render-service/`.

Livré à ce jour : phase A (fondations `/creer`) et phase B tranches 1 et 2 —
l'écran Layout réel tourne sur `/creer/layout-visuel`
(`src/features/vibeos/layout/`, moteurs vibefx-studio importés jamais réécrits,
fonds Mesh/Lumen/Flou pro, undo/redo, réglages par zone). Lint 0 erreur, build
vert, `npm run test:vibeos-layout` vert.

Ta mission, dans l'ordre :
1. **Tranche B3** (finitions Layout) : textures multiples du fond + opacité ;
   éditeur de zones custom (ajout/déplacement/redimension, `CUSTOM_SHAPE_LIBRARY`) ;
   stickers/assets ; comparaison avant/après ; aperçu Insta ; persistance des
   images du projet en Blobs IndexedDB ; pixel-diff automatisé ancien vs nouveau
   Layout.
2. **Phase C (Vision)** sur `/creer/vision` : bouton « Améliorer ma photo »
   construit sur les moteurs EXISTANTS `visionMetrics` / `visionColorScience`,
   slider d'intensité global, 12 looks MAX au premier niveau renommés en
   français et triés par `scoreProfileForImage` (badges « Conseillé », looks
   contre-indiqués en fin de liste), avant/après (maintien = original),
   garde-fous smartphone actifs par défaut, bibliothèque complète
   `CAMERA_BRANDS` en réglages avancés.

Interdits : Tailwind dans le nouveau code, réécrire un moteur existant, modifier
`/studio` ou `/video`, déployer quoi que ce soit. Termine chaque tranche par le
rituel : `npm run lint`, `npm run build`, `npm run test:vibeos-layout` (+ le
nouveau smoke Vision), mise à jour de `todo.md` et `map.md` (arbre + journal
daté), rapport honnête de ce qui marche et de ce qui est laissé de côté.
