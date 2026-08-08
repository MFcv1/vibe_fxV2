# Plan maître — Redesign VibeOS « Incubateur de création »

Date : 2026-08-08
Statut : plan validé par l'utilisateur, prêt à exécuter.
Périmètre : Studio, Layout, Soundtrack, Vision (l'actuel `/studio` et ses onglets).
Hors périmètre : VibeCut (déjà reconstruit sous `/video`, il sert de RÉFÉRENCE de design), pages publiques SEO, backoffice, publication Meta (le flux existant est conservé tel quel).

Ce document est autosuffisant : un agent qui ne connaît rien au projet doit pouvoir exécuter le travail en le lisant, avec `AGENTS.md`, `plan.md`, `todo.md` et `map.md` comme contexte général.

---

## 1. Décisions produit validées (ne pas re-débattre)

Ces choix ont été validés explicitement par l'utilisateur le 2026-08-08 :

1. **Vraies pages séparées** : chaque section devient une page avec sa propre URL. Un accueil « incubateur » présente les espaces.
2. **Hub unique** : l'accueil inclut aussi VibeCut (lien vers `/video` existant). Une seule porte d'entrée pour toute la création.
3. **Deux niveaux partout** : interface simple par défaut (peu de réglages, gros parti pris), panneau « Réglages avancés » qui révèle tout le reste. Rien n'est supprimé, tout est ré-hiérarchisé.
4. **Projet commun qui circule** : l'image importée et les réglages suivent l'utilisateur entre Layout, Studio et Vision. Soundtrack partage le même shell mais gère sa bibliothèque musicale.
5. **Vision = auto-magique + looks réduits** : un bouton « Améliorer » qui analyse la photo et corrige automatiquement, plus une collection courte (10-15) de looks forts et sûrs, adaptés à la photo.
6. **Studio = redesign + 3-4 features fortes** (ambiances en un clic, aléatoire intelligent, historique de variantes, styles perso).
7. **Soundtrack = Spotify classique complet** : colonne gauche bibliothèque/playlists, zone centrale avec rangées et recherche, lecteur fixe en bas.
8. **Mini-lecteur global** : un petit lecteur discret dans le header commun, visible sur toutes les pages de création ; clic → retour à Soundtrack.
9. **Transition en side-build** : nouvelles routes propres sous `/creer/...`, l'ancien `/studio` reste intact jusqu'à la bascule, puis redirections + suppression de l'ancien design. **Ne jamais poser de rustines sur les anciennes pages.**
10. **Ordre de construction** : Fondations → Layout → Vision → Studio → Soundtrack.
11. **Desktop + mobile sérieux** : chaque page doit être réellement utilisable sur téléphone dès ce lot (pas seulement « consultable »).
12. **Direction artistique** : « épuré à la VibeCut » — même âme Apple que `/video` (voir §3). Pas de récupération du style cyber-terminal actuel (`STUDIO V2.0`, `UPLOAD RAW SOURCE DATA`, monospace uppercase partout).

---

## 2. État des lieux — ce qui existe et ce qu'on garde

### 2.1 Montage actuel

- `src/app/studio/page.js` → `StudioClient.jsx` → `StudioAuthGate` → `PublicationsManager` (`initialMode="layout"`) qui monte `src/features/vibefx-studio/VibeFxStudio.jsx` (~1550 lignes).
- `VibeFxStudio.jsx` orchestre TOUT : un state `view` bascule entre `studio`, `layout`, `vision-pro`, `soundtrack`, `library`. Un seul canvas partagé (`useCanvasRenderer`), un seul jeu d'images, un seul jeu de filtres.
- Workspaces reconnus par l'URL : `/studio?workspace=studio|layout|library|soundtrack|vision-pro`.
- Le flux « importer vers publication » (`onImportToPublication`) part du canvas vers `PublicationsManager` : **ce flux doit survivre à l'identique** (c'est le cœur produit : image → publication → Meta).

### 2.2 Contrainte technique majeure : Tailwind statique

L'UI actuelle de `/studio` utilise des classes Tailwind servies par un **bundle statique figé** : toute classe absente du bundle ne fait rien, et il ne faut pas le régénérer. Conséquence ferme :

> **Les nouvelles pages n'utilisent PAS Tailwind. Tout le nouveau design est en CSS Modules + un fichier de tokens scopé, exactement comme VibeCut** (`src/features/vibecut/styles/vibecut.css` + `*.module.css`).

### 2.3 Inventaire fonctionnel à préserver (rien ne se perd)

**Layout** (`src/features/vibefx-layout/` + `LayoutSidebar.jsx` côté studio) :
- Formats : `FORMATS` (Portrait 4:5, Carré, Story 9:16, Paysage, Pano x2, Pano x3) — `data/constants.jsx`.
- Modèles : `TEMPLATES` (Standard, Polaroïd, Pic-in-Pic, Double, Pellicule, Mosaïque, Grille 4, Cinéma) + modèle personnalisé (`CUSTOM_LAYOUT_PRESETS` : Catalogue CF1, Feature + 4, Editorial 6, Personnalité) avec zones libres (`CUSTOM_SHAPE_LIBRARY`, édition/ajout/suppression de zones, gap dédié).
- Templates thématiques : `data/themedTemplates.jsx` (~1400 lignes) — 17 catégories (E-commerce, Promo, Voyage, Éditorial, Food, Mode, Branding, Photo, Déco, Immobilier, Art, Événement, Lifestyle, Carrousel, Saisons, Meuble) avec habillages complets (zones + textes + styles).
- Textes & boutons : `TextAssetsPanel` (ajout, styles, `FONT_OPTIONS` 15 polices), assets/stickers.
- Géométrie & marges : padding, gap, radius, guides (`GeometryPanel`).
- Fond : couleur, textures multiples avec opacité, flou du fond, Mesh gradient (`MeshGradientPopup`), Lumen (`LumenShaderModal`), Flou pro (`SmoothBlurPopup`).
- Accès rapides flottants sur le canvas (Mesh, Lumen, Flou pro, Flou fond, Texte, Fond, Marges) — à conserver en esprit, redessinés.
- Import par slot, remplacement, suppression, drag & drop, undo/redo, comparaison avant/après, aperçu Insta, plein écran.

**Studio** (onglet `studio` actuel) :
- `StylePanel` : `PRESET_CATEGORIES` (Argentique, Monochrome, Cyberpunk, Soft & Dreamy) avec profils (Portra 400, Tri-X, Blade Runner, Orton…).
- Filtres manuels : `DEFAULT_FILTERS` (brightness, contrast, saturation, sepia, blur, grain, vignette, tint, intensité…).
- Recadrage/crop, mêmes générateurs de fond (mesh/lumen) accessibles.

**Vision** (onglet `vision-pro`) :
- `VisionPanel.jsx` (1379 lignes) : marques caméra (`CAMERA_BRANDS` : Fujifilm, etc.) avec profils détaillés (tone curves par canal, tints ombres/hautes lumières, temperature, fadedBlacks…).
- **Moteur de science des couleurs déjà écrit** — c'est l'or du projet :
  - `utils/visionColorScience.js` : familles de profils (`Portrait Skin`, `Cinema Night`, `Landscape Vivid Safe`, `Chrome Street`, `Monochrome Rich`, `Editorial Matte`, `Film Soft`, `Natural Clean`, `Custom Safe`), bestFor/avoidFor, guidance d'intensité.
  - `utils/visionMetrics.js` : analyse d'image (luma P05/P95, ratio tons peau/ciel/feuillage, saturation, tons chauds, neutres protégés).
  - `VisionPanel` : `scoreProfileForImage()` — scoring de pertinence profil↔photo avec raisons lisibles ; garde-fous smartphone (`applySmartphoneOutputGuards`, `applySafeGlobalTint`), mode `safeSmartphone`, `profileStrength`.
  - Réglages fins v3 : highlights, shadows, vibrance, saturations sélectives (peau/ciel/feuillage/tons chauds), temperature, clarity, sharpness, dehaze.
  - Favoris + profils personnalisés (localStorage), historique 30 étapes, comparaison split.

**Soundtrack** (`src/features/vibefx-studio/soundtrack/`) :
- Hooks : `useSoundtrackController`, `useLocalSoundtrackLibrary` (IndexedDB + fichiers locaux), `useProjectSoundLibrary` (bibliothèque projet), `useSoundtrackPlayer` (lecture, file, modes), `useSoundtrackSearch`.
- Services : imports IA (`AiMusicImportAssistant`, providers via `/api/music/ai-providers`), Pixabay (`pixabay-local-import`), import URL, import fichier local, dossier local, droits/licences (`soundtrackRights`), manifest.
- Composants existants réutilisables en logique : `SoundtrackPlayer`, `SoundtrackTrackRow`, `SoundtrackPlaylists`, `SoundtrackResults`, `SoundtrackSearch`, `ProjectLibraryPanel`, `SoundtrackRightsPanel`.
- APIs : `src/app/api/music/*` — **aucune modification d'API nécessaire**, le redesign est purement front.
- Pont vers VibeCut : `onUseInVideo` (piste → projet vidéo). À conserver.

**À NE PAS reprendre** : `components/sidebar/HeroSidebar.jsx` (« Cockpit Editor », styles inline, localStorage `vibe_hero_positions`) est un outil de dev legacy, hors périmètre — ne pas le porter dans le nouveau design.

### 2.4 Référence design : VibeCut

- Tokens : `src/features/vibecut/styles/vibecut.css` (scope `.vibecut`, variables `--vc-*`).
- Primitives : `src/features/vibecut/primitives/index.jsx` + `primitives.module.css` (Button, IconButton, Segmented, Card, EmptyState, Spinner, Progress, Badge, Collapsible animé par `grid-template-rows`).
- Shell : `src/features/vibecut/shell/VibeCutShell.jsx` (topbar 56px, un seul header).
- Pages à imiter pour l'âme : `/video` (HomeScreen avec cartes de modes) et `/video/rapide`.

---

## 3. Design system « VibeOS » — spécification exacte

### 3.1 Principe

On crée un design system frère de VibeCut, dans `src/features/vibeos/styles/vibeos.css`, scopé `.vibeos`, avec variables `--vo-*`. **Copier les valeurs de VibeCut à l'identique** (mêmes couleurs, typo, espacements, rayons, ombres, durées) sauf mention contraire ci-dessous — l'utilisateur veut la MÊME atmosphère, pas une variation.

Pourquoi un scope séparé et pas réutiliser `.vibecut` : les deux surfaces vivent dans le même app Next ; un scope propre permet d'évoluer indépendamment sans risque de casser `/video`, et l'ancien `/studio` (Tailwind statique) reste intact pendant la transition. Interdiction de règles globales.

### 3.2 Tokens (valeurs exactes)

```css
.vibeos {
    /* Surfaces — neutres profondes, zéro teinte néon */
    --vo-bg: #0b0b0d;            --vo-bg-sunken: #070708;
    --vo-surface: #16161a;       --vo-surface-2: #1d1d22;   --vo-surface-3: #26262c;
    --vo-line: rgba(255,255,255,0.075);  --vo-line-strong: rgba(255,255,255,0.14);
    /* Texte — 3 niveaux, jamais < 12px */
    --vo-text: #f4f4f6;  --vo-text-2: #a2a2ab;  --vo-text-3: #6d6d77;
    /* Accent unique */
    --vo-accent: #5b7cfa; --vo-accent-hover: #6f8bff; --vo-accent-press: #4a68e0;
    --vo-accent-quiet: rgba(91,124,250,0.14); --vo-accent-line: rgba(91,124,250,0.42);
    /* Sémantiques */
    --vo-success: #3ecf8e; --vo-warning: #e8b339; --vo-danger: #ff5a5f;
    /* Typo : -apple-system / SF Pro Text stack, numérique en SF Mono (data-numeric) */
    /* Échelle : 12/13/14/16/20/26/34 — espacement base 4 (4→64) */
    /* Rayons : 8/12/16/20/999 — ombres 3 niveaux — durées 120/180/240/320ms */
    --vo-ease: cubic-bezier(0.4,0,0.2,1); --vo-ease-out: cubic-bezier(0.32,0.72,0,1);
    --vo-topbar-height: 56px;
}
```

Reprendre aussi de `vibecut.css` : resets `:where()` (spécificité zéro), `:focus-visible` accent 2px, titres `font-weight:600 / letter-spacing:-0.02em`, scrollbars discrètes scopées, bloc `prefers-reduced-motion` complet (durées ET délais à 0).

### 3.3 Langage visuel (règles fermes)

- **Sombre uniquement** (thème clair : tokens prêts mais non activés, comme VibeCut).
- **Un seul accent** (bleu `#5b7cfa`). Les couleurs sémantiques ne servent qu'aux statuts. Aucun dégradé décoratif dans le chrome (les dégradés vivent dans les CONTENUS : aperçus, vignettes, canvas).
- **Typographie** : phrases en français normal, casse de phrase. Interdiction du `UPPERCASE + letter-spacing + monospace` comme style de titre (c'est l'ancien design). Le mono est réservé aux valeurs numériques (`[data-numeric]`).
- **Cartes** : `--vo-surface`, bord `--vo-line`, radius 16, padding 16-20. Hover des cartes interactives : `transform: translateY(-2px)`, bord `--vo-line-strong`, ombre `--vo-shadow-2`, transition `180ms var(--vo-ease-out)` ; press : `translateY(0) scale(0.99)`. Sélection : bord `--vo-accent-line` + fond `--vo-accent-quiet` + coche discrète — jamais de glow.
- **Boutons** : primaire = fond accent plein, radius 12, hauteur 40 (36 sm, 48 lg), hover `--vo-accent-hover`, press `--vo-accent-press` + `scale(0.98)` ; secondaire = `--vo-surface-2` + bord `--vo-line` ; ghost = transparent, hover `--vo-surface-2` ; danger réservé aux suppressions.
- **Entrées de réglage** : sliders fins (piste 4px, pouce 16px, valeur numérique à droite en `[data-numeric]`), segmented controls (fond `--vo-surface-2`, segment actif `--vo-surface-3` + texte `--vo-text`), sections repliables `Collapsible` (chevron rotatif, animation `grid-template-rows`).
- **Mouvement** : apparitions en fondu + translation 8px, cascades avec délais 30-40ms par item, jamais plus de 320ms. Aucune animation en boucle décorative.
- **Vides** : `EmptyState` avec icône, phrase d'aide humaine et action — jamais un panneau blanc/noir muet.
- **Accessibilité** : focus visible partout, cibles tactiles ≥ 44px sur mobile, `aria-label` sur tous les boutons-icônes, contrastes AA sur `--vo-text-2` minimum pour le texte utile.

### 3.4 Primitives à créer (`src/features/vibeos/primitives/`)

Copier le pattern de `src/features/vibecut/primitives/index.jsx` puis étendre :

| Primitive | Notes |
|---|---|
| `Button`, `IconButton`, `Segmented`, `Card`, `Badge`, `Spinner`, `Progress`, `EmptyState`, `Collapsible` | port direct de VibeCut (mêmes APIs) |
| `Slider` | slider stylé avec label + valeur numérique + double-clic = reset à la valeur par défaut |
| `TileGrid` / `Tile` | grille de choix visuels (formats, modèles, looks) : vignette + label + état sélectionné |
| `Sheet` | panneau latéral (desktop) / bottom sheet (mobile) pour les « Réglages avancés » et les popups Mesh/Lumen/Flou |
| `Toolbar` | barre d'outils flottante du canvas (undo/redo, zoom, comparer, plein écran) |
| `SearchField` | champ de recherche avec raccourci `/`, clear, état chargement |
| `Toast` | confirmations discrètes (export prêt, look appliqué…) en bas de l'écran |

### 3.5 Shell commun (`src/features/vibeos/shell/VibeOsShell.jsx`)

- Topbar 56px unique : à gauche wordmark « VibeOS » (retour à `/creer`), au centre navigation par espaces (Layout · Studio · Vision · Soundtrack · VibeCut) en segmented discret, à droite : mini-lecteur musique + bouton « Publier » (primaire) + avatar/compte.
- **Mini-lecteur global** : pochette 28px + titre tronqué + play/pause ; n'apparaît que si une piste est chargée ; clic sur le titre → `/creer/son`. L'audio est possédé par un provider React au niveau du layout `/creer` (l'élément `<audio>` ne doit JAMAIS être démonté lors des navigations internes — d'où l'importance du layout Next partagé).
- Mobile (< 768px) : topbar réduite (wordmark + Publier + lecteur), navigation par espaces dans une tab bar basse fixe (5 icônes + labels 11px), safe-area iOS respectée.
- Le shell porte la classe `.vibeos` et impose `min-height: 100dvh`.

---

## 4. Architecture technique cible

### 4.1 Routes nouvelles (App Router)

```
src/app/creer/
  layout.js            → monte StudioAuthGate + VibeOsShell + VibeOsProjectProvider + AudioProvider ; noindex
  page.js              → Accueil incubateur
  layout-visuel/page.js → espace Layout        (nom de dossier ≠ layout.js Next, d'où « layout-visuel »)
  studio/page.js        → espace Studio
  vision/page.js        → espace Vision
  son/page.js           → espace Soundtrack
```

Toutes ces pages : `robots: { index: false, follow: false }` (surface app privée, règle AGENTS.md). Chaque `page.js` est un server component minimal qui monte un client component de `src/features/vibeos/`.

### 4.2 Nouveau code front (`src/features/vibeos/`)

```
src/features/vibeos/
  styles/vibeos.css          tokens + base (scope .vibeos)
  primitives/                index.jsx + primitives.module.css
  shell/                     VibeOsShell.jsx, MiniPlayer.jsx, shell.module.css
  project/                   store projet commun (voir 4.3)
  home/                      HomeScreen.jsx (+ module.css)
  layout/                    écran Layout (+ sous-composants + module.css)
  studio/                    écran Studio
  vision/                    écran Vision
  soundtrack/                écran Soundtrack (UI seulement — la logique reste dans vibefx-studio/soundtrack/hooks+services)
  engine/                    RÉEXPORTS/adaptateurs vers les moteurs existants (pas de copie)
```

**Règle d'or : la logique métier existante (moteurs canvas, science des couleurs, hooks soundtrack, export, publication) n'est PAS réécrite — elle est importée.** Le nouveau code est une couche UI + un store. Si un hook existant mélange trop UI et logique, extraire la logique dans un module partagé plutôt que dupliquer. Les moteurs concernés : `vibefx-layout/engine/*`, `vibefx-studio/engine/*`, `vibefx-studio/utils/{canvasUtils,visionColorScience,visionMetrics,customLayout}.js`, `vibefx-studio/hooks/{useCanvasRenderer,useCanvasEvents,useImageUpload,useExport,useLayoutHelpers}.js`, tout `vibefx-studio/soundtrack/{hooks,services}`.

### 4.3 Projet commun (`src/features/vibeos/project/`)

Un store unique (React context + reducer, pas de nouvelle dépendance) qui matérialise « le projet qui circule » :

```js
// forme du state (v1)
{
  version: 1,
  id, createdAt, updatedAt,
  format,                    // id FORMATS
  template,                  // id TEMPLATES ou custom {presetId, zones}
  images: [...],             // sources par slot + transforms (zoom/pan/crop)
  texts: [...], assets: [...],
  geometry: { padding, gap, radius, customLayoutGap },
  background: { color, blur, textures, mesh, lumen, smoothBlur },
  vision: { profileId|null, intensity, filters },   // filtres Vision appliqués
  studio: { presetRef|null, filters, variants: [...] },
  soundtrackTrackId: null,
}
```

- Persistance : autosauvegarde débouncée (800ms) dans IndexedDB (les dataURLs d'images sont trop lourdes pour localStorage). Une seule entrée « projet courant » en v1 + une liste « récents » (métadonnées + vignette 256px) pour l'accueil.
- Chaque page lit/écrit ce store ; l'aperçu est cohérent partout : Layout compose, Studio et Vision affichent le rendu composé avec leurs filtres.
- Pipeline de rendu (ordre fixe, documenté dans le code) : composition Layout (zones, fonds, textes) → filtres Vision (couleur) → effets Studio (grain, vignette, tint, blur créatif) → export. C'est déjà l'ordre de fait dans `useCanvasRenderer` ; le formaliser.
- Le bouton « Publier » du shell exporte le canvas courant et appelle le flux existant `onImportToPublication` → `PublicationsManager`. En v1, la page `/creer` réutilise `PublicationsManager` monté en mode publication via la route existante ; ne pas réécrire la publication.

### 4.4 Transition et bascule (phase finale)

1. Pendant toute la construction : `/studio` intact, `/creer` en parallèle. Aucun import de `vibeos/` depuis `vibefx-studio/` ni l'inverse (hors moteurs listés en 4.2).
2. Bascule, une fois les 5 pages validées :
   - `/studio` → `redirect('/creer')` côté serveur ; `?workspace=layout|studio|vision-pro|soundtrack` → route correspondante (`vision-pro`→`/creer/vision`, `soundtrack`→`/creer/son`).
   - Retirer l'entrée VibeOS de l'ancien header, supprimer `VibeFxStudio.jsx` et tous les composants UI morts (garder moteurs/hooks/services importés par `vibeos/`), supprimer `HeroSidebar`, l'onglet library legacy si non porté.
   - Vérifier qu'aucun smoke/test ne référence les anciens sélecteurs ; adapter.
3. La suppression est un commit séparé et réversible.

---

## 5. Spécification page par page

Chaque page suit le même squelette responsive :
- **Desktop (≥ 1024px)** : zone d'aperçu à gauche (fluide), panneau droit 360-400px.
- **Tablette (768-1023px)** : aperçu en haut, panneau dessous en pleine largeur.
- **Mobile (< 768px)** : aperçu sticky en haut (45-55dvh), contrôles en dessous en flux vertical ; toute action secondaire passe en `Sheet` (bottom sheet) ; tab bar basse du shell.

### 5.1 Accueil incubateur — `/creer`

But : « où est-ce que je crée quoi » en 5 secondes.

- Héro sobre : « Que veux-tu créer aujourd'hui ? » (`--vo-text-2xl`), sous-titre une ligne.
- **Reprise** : si un projet courant existe, première carte large « Reprendre — [vignette] · modifié il y a X » → dernière page visitée du projet.
- **5 cartes d'espaces** (grille 2-3 colonnes desktop, 1 colonne mobile, cascade d'apparition 40ms) :
  - *Layout* — « Compose tes visuels » : mini-mosaïque de formats en vignette.
  - *Studio* — « Ambiances & effets » : vignette dégradé mesh.
  - *Vision* — « Sublime tes photos » : vignette avant/après.
  - *Soundtrack* — « Trouve ta musique » : vignette pochette + onde.
  - *VibeCut* — « Monte tes vidéos » → `/video` (badge « Vidéo »).
  Chaque carte : icône, titre, une phrase bénéfice, hover VibeCut-like. S'inspirer de `src/features/vibecut/home/HomeScreen.jsx` et `home.module.css`.
- **Récents** : rangée de vignettes de projets (max 8) avec format + date ; menu ⋯ (dupliquer, supprimer avec confirmation).
- Pas de statistiques, pas de bruit. C'est un hall d'accueil, pas un dashboard.

### 5.2 Layout — `/creer/layout-visuel`

But : composer un visuel multi-images sans se perdre. Toutes les features de §2.3 conservées, ré-hiérarchisées en **mode simple / avancé**.

**Mode simple (par défaut), panneau droit en 4 blocs dans l'ordre de création :**
1. **Format** : `TileGrid` de 6 tuiles avec silhouettes proportionnelles réelles (pas d'icônes abstraites) ; libellés courts « Portrait · 4:5 ».
2. **Modèle** : tuiles des 8 `TEMPLATES` avec schéma des zones dessiné en SVG (rectangles), + tuile « Personnalisé » qui ouvre l'éditeur de zones.
3. **Images** : liste des slots du modèle actif avec vignette ou bouton d'import ; drag & drop global sur le canvas ; le slot vide affiche « Ajouter une image ».
4. **Habillage** : le choix qui fait 80% du rendu — sélecteur de template thématique (voir ci-dessous) + 3 réglages : marge (slider), arrondi (slider), fond (3 boutons : Couleur / Flou de l'image / Généré → ouvre Mesh/Lumen en `Sheet`).

**Templates thématiques** : le point fort caché de l'app (17 catégories, ~80 habillages). Leur donner une vraie surface :
- Bouton « Parcourir les templates » → `Sheet` plein écran : rail de catégories à gauche (chips scrollables sur mobile), grille de cartes-aperçus À DROITE **rendues avec le vrai moteur** (mini-canvas ou rendu SVG fidèle des zones + textes), pas des pavés de couleur.
- Un clic applique le template (format + zones + textes) et ferme ; toast « Template appliqué — remplace les images ».

**Réglages avancés (Collapsible « Réglages avancés » en bas du panneau)** : Textes & boutons (panel complet actuel : ajout, polices, styles), Géométrie fine (gap, gap custom, guides), Texture (textures multiples + opacité), Fond global détaillé, Flou pro, édition de zones custom (ajout/suppression/redimension, `CUSTOM_SHAPE_LIBRARY`).

**Canvas** : toolbar flottante en bas du canvas (undo/redo, comparer avant/après en maintien du doigt/clic, aperçu Insta, plein écran). Les « accès rapides » actuels deviennent 3 boutons contextuels discrets en haut du canvas (Fond généré, Flou pro, Texte) — visibles au hover desktop, toujours visibles mobile.

**Mobile** : blocs 1-4 en accordéon vertical, import d'images en premier contact (gros bouton si canvas vide), édition de texte dans un `Sheet` avec le clavier géré (le canvas remonte).

### 5.3 Vision — `/creer/vision`

But : « ma photo de téléphone devient superbe en un geste, sans jamais être cassée ».

**Écran simple :**
1. En vedette : bouton **« ✨ Améliorer ma photo »** (primaire, lg). Il exécute une correction automatique construite sur l'existant : `visionMetrics` analyse l'image → correction ciblée (exposition si `meanLuma` bas, dehaze/clarity si plat via `tonalRange`, vibrance prudente si peu saturé, protection peau via `skinToneRatio`, garde-fous `applySmartphoneOutputGuards`). Afficher ensuite une ligne humaine : « Photo un peu sombre et plate — j'ai relevé la lumière et le relief. » (dérivée des signaux `getImageRecommendationSignals`).
2. **Slider d'intensité global** (0-100, défaut 80) qui pondère la correction — implémente une interpolation `DEFAULT_FILTERS → filtres cibles`.
3. **Looks** : une rangée horizontale de 12 tuiles-aperçus max, **rendues sur la vraie photo** (le mécanisme de miniatures de `VisionPanel` existe déjà : `PREVIEW_RENDER_WIDTH`, `applyFusedPixelOps`). Les 12 looks sont une curation des familles existantes : 2 Natural Clean, 2 Portrait Skin, 2 Landscape Vivid Safe, 2 Cinema Night, 1 Chrome Street, 1 Monochrome Rich, 1 Editorial Matte, 1 Film Soft — choisis parmi les profils `CAMERA_BRANDS` les mieux notés, renommés en français évocateur (« Peau douce », « Nuit néon », « Ciel profond »… — PAS les noms de pellicules en premier niveau).
   - **Tri intelligent** : `scoreProfileForImage()` ordonne les tuiles pour CETTE photo ; badge « Conseillé » sur les 2 premiers ; les looks contre-indiqués (score négatif) passent en fin avec opacité réduite + tooltip « Peu adapté : [raison] ».
   - Chaque look s'applique avec son intensité recommandée (`inferIntensityGuidance`), modulée par le slider.
4. **Avant/après** : bouton « Comparer » (maintien = photo d'origine) + le split existant `visionCompareSplit` en avancé.

**Réglages avancés (Collapsible)** : lumière (highlights/shadows/brightness/contrast), couleur (temperature, vibrance, saturations sélectives peau/ciel/feuillage/chaud), texture (clarity, sharpness, dehaze, grain), la bibliothèque complète par marques `CAMERA_BRANDS` (pour les connaisseurs, avec bestFor/avoidFor affichés), favoris, sauvegarde d'un look perso (repris de l'existant : localStorage `vibefx.vision.customProfiles`), historique undo/redo.

**Garde-fous produit** (la « plus-value insane » c'est surtout : impossible de rater) :
- `safeSmartphone` reste actif par défaut et n'est débrayable qu'en avancé.
- Un look appliqué sur une photo sans image = état vide avec explication et bouton d'import.
- Jamais plus de 12 tuiles au premier niveau. La diversité vit en avancé.

### 5.4 Studio — `/creer/studio`

But : l'espace « ambiance créative » — presets artistiques, grain, effets, fonds génératifs.

**Écran simple :**
1. **Ambiances en un clic** (feature nouvelle n°1) : 8-10 tuiles-aperçus sur la vraie image, chacune = un bundle cohérent filtres + grain + vignette + éventuel fond généré assorti. Construites en curant `PRESET_CATEGORIES` (Portra, Gold, Tri-X, Blade Runner, Orton…) + 3-4 nouvelles combinaisons (ex. « Polaroid délavé », « VHS chaud », « Éclat doux »). Données dans `vibeos/studio/ambianceCatalog.js` (même format que `PRESET_CATEGORIES.profiles`, moteur d'application inchangé).
2. **Slider d'intensité** de l'ambiance (comme Vision — même composant).
3. **« Surprends-moi »** (feature nouvelle n°2) : bouton qui tire une variation plausible — choisit une ambiance pondérée par les signaux image (réutiliser `getImageRecommendationSignals` : photo de nuit → ambiances nuit favorisées) et jitter ±10% sur 3 paramètres max. Chaque tirage est ajouté aux variantes.
4. **Variantes** (feature nouvelle n°3) : rangée de vignettes des 6 derniers états appliqués (ambiance/réglage/surprise) ; clic = re-application instantanée ; c'est un historique VISUEL, complémentaire de l'undo.
5. **Fond généré** : accès direct Mesh / Lumen (les modales existantes re-skinées en `Sheet` VibeOS).

**Réglages avancés** : tous les filtres manuels actuels (brightness, contrast, saturation, sepia, blur, grain, vignette, tint couleur + intensité), crop/recadrage, **enregistrer comme style perso** (feature nouvelle n°4 : nom + vignette, localStorage `vibeos.studio.customStyles`, réapparaît en tête des ambiances).

### 5.5 Soundtrack — `/creer/son`

But : un vrai Spotify. AUCUNE nouvelle feature de fond — même logique (hooks/services intacts), interface refaite.

**Structure (desktop) :**
- **Colonne gauche 260px** : « Rechercher », « Accueil », puis Bibliothèque : Pistes du projet, Ma bibliothèque locale, Imports récents ; en bas, Sources : Import IA, Pixabay, Fichier local, URL. Sur mobile : la colonne devient la tab bar interne (Accueil / Recherche / Bibliothèque) + bouton « + » pour les sources.
- **Zone centrale** :
  - *Accueil* : rangées horizontales de cartes (pochette carrée radius 12, hover : léger lift + bouton play rond accent en overlay, exactement le pattern Spotify) — « Reprendre l'écoute », « Dans ce projet », « Importées récemment », « Explorer par thème » (les thèmes de l'agrégateur IA deviennent des cartes-mosaïques colorées).
  - *Recherche* : `SearchField` géant en haut, résultats en liste (lignes : pochette 40px, titre `--vo-text`, artiste/source `--vo-text-2`, durée `[data-numeric]`, badge licence, actions au hover : play, + bibliothèque, « Utiliser dans VibeCut »). La recherche interroge les sources existantes (`useSoundtrackSearch`, free-search, Pixabay).
  - *Vue bibliothèque/playlist* : en-tête (grosse pochette-mosaïque, titre, n pistes, bouton Play rond accent) + liste de pistes numérotées ; la piste en lecture est teintée accent avec égaliseur animé discret (3 barres).
- **Lecteur fixe en bas 72px** (desktop) : gauche pochette + titre + artiste ; centre transport (précédent, play 40px, suivant, mode lecture) + barre de progression fine avec temps `[data-numeric]` ; droite : volume + bouton « Utiliser dans VibeCut ». Mobile : mini-barre au-dessus de la tab bar (pochette, titre défilant, play), tap → `Sheet` lecteur plein écran.
- Les imports (IA, Pixabay, URL, fichier) s'ouvrent en `Sheet` par-dessus, avec les composants logiques existants re-skinés ; à la fin d'un import : toast + la rangée « Importées récemment » se met à jour.
- **Droits/licences** : le badge licence reste visible sur chaque piste (données `soundtrackRights` existantes) ; détail au clic.
- Le provider audio global (cf. §3.5) est branché ici ; la lecture continue sur les autres pages via le mini-lecteur du header.

---

## 6. Phases d'exécution

Rituel de fin de CHAQUE phase (AGENTS.md) : `npm run lint`, `npm run build`, smokes impactés, mise à jour `todo.md` + `map.md` (+ `plan.md` si structure), rapport honnête, prompt de relance en fin de `todo.md`. Pas de deploy avant la fin (discipline coûts) ; tout se valide en local `npm run dev`.

**Phase A — Fondations (1 lot)**
- `vibeos.css` (tokens §3.2-3.3), primitives (§3.4), `VibeOsShell` + mini-lecteur (provider audio), routes `/creer/*` squelettes (pages vides avec EmptyState), store projet + persistance IndexedDB + récents.
- Accueil `/creer` complet (§5.1).
- Livrable vérifiable : navigation entre les 5 pages, projet créé/repris, build vert.

**Phase B — Layout (le plus gros lot, il valide le système)**
- Écran simple 4 blocs, canvas branché sur les moteurs existants, sheet templates thématiques avec vrais aperçus, réglages avancés, mobile complet.
- Critères : reproduire n'importe quel visuel faisable dans l'ancien Layout ; export identique au pixel près (comparer avec un export de référence de l'ancien onglet).

**Phase C — Vision**
- Améliorer auto + intensité + 12 looks triés + avant/après + avancé.
- Critères : sur 5 photos tests (portrait, paysage, nuit, plate, déjà saturée), aucun des 12 looks ne produit d'image « grise »/cassée ; le tri recommande des looks différents selon la photo.

**Phase D — Studio**
- Ambiances, intensité, Surprends-moi, variantes, styles perso, mesh/lumen en Sheet, avancé.

**Phase E — Soundtrack**
- Shell Spotify complet (§5.5), sources en Sheet, lecteur global.

**Phase F — Bascule**
- Redirections `/studio` → `/creer` (+ mapping workspaces), suppression de l'ancien UI (§4.4), nettoyage, passe QA transverse : parcours complet « importer → composer → Vision → Studio → musique → publier » sur desktop ET mobile, `npm run lint && npm run build` + toutes les suites.

Chaque phase = une PR/un lot cohérent. Ne pas commencer une phase si la précédente a des critères rouges.

---

## 7. Ce qui peut mal tourner (à surveiller)

- **Perf des tuiles-aperçus** (Vision/Studio/Layout templates) : rendre les miniatures en différé (`requestIdleCallback`/file d'attente, déjà pratiqué dans `VisionPanel`), cache par hash image+filtres, taille 384px max.
- **IndexedDB + images lourdes** : stocker des Blobs, pas des dataURLs ; plafonner les récents à 8 avec vignettes 256px ; gérer le quota (try/catch + dégradation en mémoire).
- **Provider audio et App Router** : l'élément `<audio>` doit vivre dans `creer/layout.js` (client boundary) pour survivre aux navigations ; tester le passage de page pendant la lecture.
- **Double design system** : pendant la transition, `.vibecut` et `.vibeos` coexistent — aucun style global, vérifier qu'aucune page publique ne charge `vibeos.css`.
- **Parité d'export** : tout écart de rendu entre ancien et nouveau Layout est un bug bloquant de la phase B, pas un « détail à noter ».
- **Textes français** : toute l'UI nouvelle est en français, ton simple et humain (pas de jargon « RAW SOURCE DATA »).

---

## 8. Prompt de relance pour l'agent exécutant

> Lis `AGENTS.md`, puis `docs/plan-vibeos-redesign-2026-08-08.md` en entier. Exécute la phase A (Fondations) exactement comme spécifiée : design system `.vibeos` copié des tokens VibeCut (`src/features/vibecut/styles/vibecut.css`), primitives, shell + mini-lecteur, routes `/creer/*`, store projet IndexedDB, accueil incubateur. Ne touche pas à `/studio` ni à `src/features/vibefx-studio/` (sauf imports en lecture). Pas de Tailwind dans le nouveau code, CSS Modules uniquement. Termine par le rituel de fin de phase (lint, build, todo.md, map.md, prompt de relance).
