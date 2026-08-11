# Archive — chantier VibeOS (phases A à G, closes le 2026-08-11)

> Ce fichier est une **archive**. On ne le lit QUE si on doit toucher au code
> d'une de ces phases. Le chantier actif vit dans [../todo.md](../todo.md), qui
> reste volontairement court.
>
> Sorti de `todo.md` le 2026-08-11 : il portait ~250 lignes d'historique livré
> qu'un agent relisait a chaque session sans en avoir besoin.

## Les phases livrées

| Phase | Contenu | État |
|---|---|---|
| A — Fondations | design system `.vibeos`, primitives, shell + mini-lecteur, store projet IndexedDB, accueil `/creer` | ✅ 2026-08-08 |
| B — Layout | `/creer/layout-visuel` complet : 4 blocs, ~80 templates thématiques, fonds Mesh/Lumen/Flou pro, undo/redo, zones custom, export | ✅ 2026-08-08 |
| C — Vision | `/creer/vision` : « Améliorer ma photo » auto, intensité, garde-fous smartphone | ✅ 2026-08-08 |
| D — Studio | `/creer/studio` : 10 ambiances 1 clic, intensité, « Surprends-moi », variantes, styles perso | ✅ 2026-08-08 |
| E — Soundtrack | `/creer/son` : interface Spotify complète, 4 sources en Sheet, lecteur global | ✅ 2026-08-08 |
| F — Bascule | pipeline chaîné, `/studio` → `/creer`, publication sur `/publier`, ancienne UI supprimée | ✅ 2026-08-08 |
| G — Photothèque | `/creer/bibliotheque` : masonry calculée, EXIF, carrousel plein écran, avant/après | ✅ 2026-08-11 |

L'ancienne interface `/studio` n'existe plus : redirection serveur vers `/creer`.

---

### Lot du 2026-08-11 — photothèque, carrousel, avant/après

- **`/creer/bibliotheque`** : les photos importées sont stockées pour de bon
  (IndexedDB `vibeos-library`, base **séparée** de celle des projets), avec
  vignette WebP et EXIF. On ne réimporte plus rien pour retoucher.
- **Masonry calculée** ([masonry.js](src/features/vibeos/library/masonry.js)) :
  placement dans la colonne la plus courte, ordre de lecture chronologique
  préservé, tuiles posées en `transform` — changer la densité les fait glisser.
- **Indexation EXIF sans dépendance**
  ([exif.js](src/features/vibeos/library/exif.js)) : appareil, objectif, focale,
  ouverture, vitesse, ISO, date de prise de vue. Filtre « appareils » alimenté
  par ces données. Vérifié sur photos réelles (Samsung Galaxy S24 Ultra, Canon
  EOS 200D).
- **Carrousel** ([Lightbox.jsx](src/features/vibeos/library/Lightbox.jsx)) : zoom
  partagé FLIP depuis la tuile, vignette d'abord puis pleine résolution en fondu,
  rail de trois diapositives, glissement au doigt, frise, clavier.
- **Avant/après refait**
  ([BeforeAfter.jsx](src/features/vibeos/shared/BeforeAfter.jsx)) : l'original
  est superposé au rendu et révélé par `clip-path`, trois modes (rideau, côte à
  côte, maintien). L'ancien bouton « maintiens le clic » perdait l'appui hors du
  bouton et démontait le canvas à chaque appui. Le cadre porte le **rapport de
  la photo** (prop `ratio`) : sans lui, une photo verticale s'étalait sur toute
  la largeur. Les modes vivent sur la ligne d'actions de l'aperçu, qui a
  désormais **sa propre ligne** au lieu d'être posée sur l'image.
- **« Retirer »**, à côté de « Changer de photo » : vide l'aperçu et l'espace de
  travail, **sans** toucher à la bibliothèque. C'est une désélection.
- **Image bloquée : corrigée à la racine.** La composition du Layout est
  prioritaire sur la photo dans `resolveProjectSource` ; importer une photo dans
  Vision efface maintenant cette composition, « Quitter la composition » revient
  à la photo brute, et l'accueil propose « Nouvel espace vierge ».
- **Retour de look vers la photothèque** : le look appliqué dans Vision est
  réécrit sur la fiche de la photo, donc filtrable dans la grille.

### Ce qu'il faut savoir avant de toucher au code

- **Le pipeline est écrit une fois**, dans
  [pipeline.js](src/features/vibeos/project/pipeline.js) :
  **composition Layout → filtres Vision → effets Studio → export**. Le Layout
  publie sa composition dans le projet (`project.composition`, un Blob PNG) ;
  Vision et Studio la prennent en entrée ; le Studio la reçoit déjà filtrée par
  Vision. Chaque étage passe par `renderStudio`, le moteur des écrans — un
  étage neutre est sauté (aucune recopie, aucune perte).
- **Les moteurs sont importés, jamais réécrits.** Pattern de référence :
  `useLayoutEditor.js`, `useVisionEditor.js`, `useStudioEditor.js`,
  `useVibeOsSoundtrack.js` dans `src/features/vibeos/*/`. Ce qui reste dans
  `vibefx-studio/` est de la logique pure (engine, hooks, utils, data,
  soundtrack/services) : `scripts/audit-scope.mjs` échoue si l'un de ces
  fichiers disparaît.
- **Quatre extractions sans changement de comportement** ont été faites plutôt
  que dupliquer du code enfermé dans des composants :
  [visionRecommendation.js](src/features/vibefx-studio/utils/visionRecommendation.js),
  [soundtrackImportFlows.js](src/features/vibefx-studio/soundtrack/services/soundtrackImportFlows.js),
  [socialExport.js](src/features/vibefx-studio/utils/socialExport.js) (découpage
  carrousel + PNG de publication) et les Sheets Mesh/Lumen/Flou pro sortis vers
  [vibeos/shared/](src/features/vibeos/shared/).
- **L'audio de VibeOS vit dans
  [AudioProvider.jsx](src/features/vibeos/audio/AudioProvider.jsx)** : élément
  `<audio>` du layout `/creer`, file, aléatoire, volume, enchaînement
  automatique, et un résolveur qui redemande le Blob à la bibliothèque.
- **Publier** rend le projet complet, dépose la charge utile dans
  [publishHandoff.js](src/features/vibeos/project/publishHandoff.js) et ouvre
  `/publier`, qui monte le `PublicationsManager` **existant**.

---


---

### Limites assumées

- Le relais de publication (`publishHandoff`) est un singleton de module : il
  survit à une navigation client, pas à un rechargement complet de `/publier`.
  Même limite que « Utiliser dans VibeCut » (`video/store/videoStore.js`).
- « Publier » utilise le **dernier état enregistré** du projet : la sauvegarde
  du Layout est débouncée à 1,5 s, donc publier dans la seconde qui suit une
  retouche publie la version d'avant. Attendre une seconde suffit.
- Le fond généré du Studio est écrit dans le projet commun et rendu par Mise en
  page ; le Studio l'affiche en aperçu mais ne le compose pas sous la photo.
- Le moteur d'assets ne fournit qu'un sticker (le scotch) : c'est ce qui est
  exposé.
- `src/features/vibefx-layout/` reste du **code de référence importé, non
  monté** (sauf ses CSS et `data/themedTemplates.jsx`). Dette antérieure à ce
  chantier, laissée telle quelle.


---

### Points d'attention techniques (plan §7)

- Tuiles-aperçus (looks, ambiances, templates) : rendu différé + cache par hash,
  384px max.
- IndexedDB : des **Blobs**, jamais de dataURL ; récents plafonnés à 8 ; quota
  géré en try/catch.
- `.vibecut` et `.vibeos` coexistent : aucun style global, aucune page publique
  ne charge `vibeos.css`.
- Le smoke Soundtrack importe un WAV que le serveur de dev recopie dans
  `public/music/local-imports` (ignoré par git) **et inscrit dans son
  manifeste** : il nettoie les deux. Tout script qui importe des pistes doit
  faire pareil, sinon la bibliothèque locale se pollue.


---

### Échecs préexistants (hors chantier VibeOS)

| Test | Nature |
|---|---|
| `smoke-vibecut-media-safety.spec.cjs` (3), `test:vibecut-export-local-mp4`, `.mp4` de `videotest/` | fixtures manquantes, chemins Windows d'origine, pointeurs Git LFS. |

Les échecs de `test:vision-ui` (2) et `test:soundtrack-ui` (11) ont disparu avec
les suites elles-mêmes : elles pilotaient l'ancienne interface, supprimée à la
phase F.

