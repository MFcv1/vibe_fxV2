# TODO — Vibe_fx V2

> **Dernière mise à jour : 2026-08-11.**
>
> Ce fichier ne porte QUE le chantier actif : le **redesign VibeOS**
> (Studio / Layout / Vision / Soundtrack refaits en pages `/creer/*`).
>
> Il est volontairement **court**. Le détail de chaque phase livrée (décisions,
> bugs trouvés, mesures) vit dans les **journaux datés de [map.md](map.md)** —
> on n'y va que si on doit toucher au code de la phase concernée.
> Le chantier précédent (reconstruction VibeCut, clos le 2026-08-04) est dans
> **[docs/archive-vibecut-2026-08-04.md](docs/archive-vibecut-2026-08-04.md)** :
> on n'y touche plus, sauf reprise de `/video` ou de `render-service/`.

**Documents de référence, dans l'ordre de lecture :**

1. [AGENTS.md](AGENTS.md) — règles de travail, rituel de fin de phase, discipline de coûts.
2. **[docs/plan-vibeos-redesign-2026-08-08.md](docs/plan-vibeos-redesign-2026-08-08.md)** — LE plan maître : décisions produit validées, design system `.vibeos`, spec page par page, phases A-F, risques.
3. Ce fichier — où on en est, ce qui reste.
4. [map.md](map.md) — carte du projet + journaux datés, à tenir à jour.

---

## Où on en est

| Phase | Contenu | État |
|---|---|---|
| A — Fondations | design system `.vibeos`, primitives, shell + mini-lecteur, store projet IndexedDB, accueil `/creer` | ✅ 2026-08-08 |
| B — Layout | `/creer/layout-visuel` complet : 4 blocs, ~80 templates thématiques, fonds Mesh/Lumen/Flou pro, undo/redo, zones custom, export | ✅ 2026-08-08 |
| C — Vision | `/creer/vision` : « Améliorer ma photo » auto, intensité, presets, garde-fous smartphone | ✅ 2026-08-08 |
| D — Studio | `/creer/studio` : 10 ambiances 1 clic, intensité, « Surprends-moi », variantes, styles perso | ✅ 2026-08-08 |
| E — Soundtrack | `/creer/son` : interface Spotify complète, 4 sources en Sheet, lecteur global | ✅ 2026-08-08 |
| F — Bascule | pipeline chaîné, `/studio` → `/creer`, publication sur `/publier`, ancienne UI supprimée | ✅ 2026-08-08 |
| G — Photothèque | `/creer/bibliotheque` : masonry calculée, indexation EXIF par appareil, carrousel plein écran, vrai avant/après, sorties de secours sur l'image bloquée | ✅ 2026-08-11 |
| H — Presets Vision | les 12 looks et la bibliothèque par marque supprimés ; moteur LUT 3D + preset `powlisher` reconstruit par mesure | ✅ 2026-08-11 |
| I — Import Lightroom | capture exacte d'un preset externe par Hald CLUT + lecture du `.xmp` pour les réglages spatiaux | ✅ 2026-08-11 |

**Le redesign VibeOS est livré.** L'ancienne interface `/studio` n'existe plus.

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

### Lot du 2026-08-11 (2) — presets Vision, remplacement des 12 looks

**Le problème.** Les 12 looks dénaturaient les photos et rendaient l'écran lent :
chaque changement de photo relançait 12 vignettes, chacune repartant de l'image
**pleine résolution** avec 4 passes pixel et un encodage JPEG.

**Ce qui a été supprimé** : les 12 looks (`visionLooks.js`), la bibliothèque de
profils par marque et son panneau, le tri des looks par photo côté Vision, et
`guardLookForImage` devenu mort.

**Ce qui les remplace** : des presets compilés en **LUT 3D**. Le premier,
`powlisher`, est une reconstruction **mesurée** du rendu de `@powl_d` — pas une
imitation à l'œil. Méthode et chiffres complets dans
[docs/audit-preset-powlisher-2026-08-11.md](docs/audit-preset-powlisher-2026-08-11.md).

- **Le corpus** : 19 photos récupérées en résolution d'origine (x.com renvoie 402
  aux robots ; passage par l'API publique de syndication puis `pbs.twimg.com`),
  plus 50 frames extraites d'une vidéo où il montre ses réglages Lightroom.
- **Ce que la vidéo donne directement** : `Contraste −50`, `Hautes lumières −30`,
  HDR et corrections d'objectif désactivés, et les pastilles Lightroom qui
  marquent les modules touchés — Lumière, Couleur, Effets, Détail ; **rien** sur
  Flou ni Optique.
- **Ce que la mesure donne** : le bleu descend quand la luminance monte
  (`B−G` 0 → −12/255), les tons moyens virent olive (`R−G` ≈ −5), **le ciel
  atterrit à 178–194°** (cyan, jamais bleu — et c'est 30 à 42 % de la surface sur
  les paysages), le feuillage tombe à 85–105° avec S ≤ 0,35, la peau est
  préservée (27–36°), le point blanc reste sous 255, les noirs restent denses.
  **Ni grain ni vignetage** systématiques, mesures à l'appui.
- **Filiation** : un tweet de nov. 2025 le dit — il partait du preset Lightroom
  « Cinema 2 » (CN11/CN17). Mais les mesures sur ces images-là montrent des tons
  moyens **chauds** et un bleu qui **reste** bleu : le ciel teal et les verts
  olive sont bien à lui, arrivés avec ses propres presets (`PLDX BOOSTER SU`,
  `PLDX REACTOR`, `Powlisher_Neutral`). Les valeurs exactes de CN11/CN17 sont
  propriétaires Adobe et **n'ont pas été inventées**.

**Pourquoi une LUT.** Le moteur n'avait aucun décalage de teinte — seulement des
saturations par bande — donc il ne pouvait pas exprimer un ciel teal. Un preset
est maintenant une **fonction pure** évaluée une fois sur une grille 33³, puis
appliquée en une passe : **ajouter un preset ne coûte rien au rendu.**

**Perf** : la photo est réduite une seule fois dans un canvas partagé, chaque
vignette n'est plus qu'une passe LUT. Le smoke navigateur Vision passe en
**6,9 s**.

**Bug trouvé et corrigé en route** : `applyVisionStage`
([pipeline.js](src/features/vibeos/project/pipeline.js)) jugeait l'étage Vision
« neutre » et le **sautait** — un preset étant une LUT, il ne modifie aucune clé
de `filters`. Résultat : le preset ne descendait ni jusqu'au Studio ni jusqu'à
l'export. L'étage teste désormais `vision.presetId` séparément.

**Bug préexistant corrigé au passage** : `npm run test:vision-filters` plantait
depuis le commit `ee19c8c` (il lisait `VisionPanel.jsx` et `VibeFxStudio.jsx`,
supprimés avec l'ancienne interface `/studio`). Ces contrôles sont retirés, le
reste de l'audit est intact.

**Réserve honnête** : le preset est validé contre 20 cibles chiffrées et sur une
mire teinte × luminance, mais **pas** sur un corpus de photos smartphone brutes,
faute d'en avoir. Le premier vrai test se fera avec de vraies photos.

---

## Reste à faire

Rien de bloquant : les six phases sont livrées et vertes. Ce qui suit est du
choix produit, pas de la dette cachée.

1. **Rail agents IA et bibliothèque Midjourney** — ces deux surfaces vivaient
   dans l'ancienne interface et sont parties avec elle. Les routes API et le
   ledger IA sont intacts ; `src/config/aiLaunch.js` les marque « à porter dans
   VibeOS ». À porter dans `/creer` si on les veut.
2. **Importer des presets Lightroom** — la chaîne est prête et vérifiée, il ne
   manque que Lightroom installé. Trois commandes, décrites dans
   [docs/importer-un-preset-lightroom.md](docs/importer-un-preset-lightroom.md) :
   `npm run preset:mire`, on applique le preset à la mire dans Lightroom, puis
   `npm run preset:import`. La couleur est capturée **exactement** (aller-retour
   mesuré à 0,24/255), le `.xmp` complète les réglages spatiaux. Marche pour
   CN11, CN17, un pack acheté ou un preset perso.
3. **Couverture émulateurs du parcours publication** — `smoke-studio-emulator-ui`
   pilotait l'ancienne UI ; il a été retiré. `test:publication-flow` et
   `test:emulators` couvrent toujours la logique et les règles, mais plus le
   parcours navigateur bout en bout. À réécrire sur `/publier` si on y tient.
3. **Synchronisation Google Drive de la photothèque** — demandée le 2026-08-11,
   **pas faite**. La bibliothèque est aujourd'hui **locale à l'appareil**
   (IndexedDB) : rien ne part sur un serveur. Envoyer les photos vers Drive
   demande un vrai parcours OAuth Google (écran de consentement, identifiants
   client, scope `drive.file`), un aller-retour serveur pour le jeton et une
   règle de résolution de conflits — c'est un lot backend à part entière, pas
   une case à cocher. À cadrer avec les identifiants Google du projet.
4. **Corpus Vision réel** — `check:vision-corpus` reste non bloquant et le
   corpus local est absent ; le smoke navigateur qui l'exploitait pilotait
   l'ancien panneau et a été retiré. À réécrire sur `/creer/vision` **le jour où
   le corpus existe**, pas avant.

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

## Règles non négociables du chantier

- **Jamais de Tailwind dans le nouveau code.** CSS Modules + tokens `--vo-*`
  uniquement. Le bundle Tailwind statique n'est chargé que par `/publier`.
- **Jamais réécrire un moteur existant** : on l'importe. Si la logique utile est
  enfermée dans un composant, on l'**extrait** dans un module partagé.
- **Desktop ET mobile sérieux** sur chaque écran. Textes UI en français simple.
- **Aucun déploiement** pendant le chantier : tout se vérifie en local.
- **Fin de chaque tranche** : lint, build, les smokes VibeOS, mise à jour de ce
  fichier et de `map.md` (arbre + journal daté), rapport honnête.
- **Clôture de phase dans le chat** ([AGENTS.md](AGENTS.md)) : le dernier message
  d'un lot doit contenir le récap en langage simple **puis le prompt de reprise
  complet dans un bloc de code**. Un lot n'est pas terminé sans ça.

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

## Gates

```bash
npm run dev                       # http://localhost:3000 -> /creer
npm run lint                      # 0 erreur attendue (5 warnings préexistants)
npm run build
npm run test:scope                # isolation + fichiers supprimés / fichiers à garder
npm run test:vibeos-library       # EXIF + masonry (Node), puis import/grille/carrousel/persistance (navigateur)
npm run test:vibeos-layout        # B1 + B3
npm run test:vision-preset        # 40 vérifications : science du preset + chaîne d'import (Node)
npm run test:vibeos-vision        # le preset ci-dessus, puis parcours + presets sûrs sur 5 photos types
npm run test:vision-filters       # audit du vocabulaire de filtres et du renderer
npm run test:vibeos-studio        # parcours + 10 ambiances distinctes sur 3 photos types
npm run test:vibeos-soundtrack    # import + lecture, lecture qui survit au changement de page, mobile
npm run test:vibeos-pipeline      # composition -> Vision -> Studio -> publication, desktop + mobile
npm run test:routes               # redirections /studio, noindex /creer et /publier (serveur build+start)
npm run test:publication-flow
```

Tous verts au 2026-08-11. Les suites `test:vibecut-*` ne concernent pas ce
chantier ([archive](docs/archive-vibecut-2026-08-04.md#commandes)).

### Échecs préexistants (hors chantier VibeOS)

| Test | Nature |
|---|---|
| `smoke-vibecut-media-safety.spec.cjs` (3), `test:vibecut-export-local-mp4`, `.mp4` de `videotest/` | fixtures manquantes, chemins Windows d'origine, pointeurs Git LFS. |

Les échecs de `test:vision-ui` (2) et `test:soundtrack-ui` (11) ont disparu avec
les suites elles-mêmes : elles pilotaient l'ancienne interface, supprimée à la
phase F.

---


## Prompt de reprise (après le lot presets Vision du 2026-08-11)

> À copier tel quel dans un nouveau chat, contexte à zéro.

Reprends le projet Vibe_fx V2. Le chantier VIBEOS (redesign complet de
l'interface de création) est TERMINÉ : phases A à F livrées et vertes, plus le
lot G (photothèque, carrousel, avant/après) et le lot H (presets Vision), tous
deux du 2026-08-11.

PROJET : /Users/matthis/Desktop/mes projets mac/vibe_fxV2 (branche
vibecut/phases-3b-5-6-7)

LIS DANS CET ORDRE, avant d'écrire la moindre ligne :
1. AGENTS.md — règles de travail, rituel de fin de phase, clôture de phase dans
   le chat, discipline de coûts.
2. todo.md — court : l'état livré, ce qui reste au choix, les limites assumées,
   les gates. C'est ta feuille de route.
3. docs/plan-vibeos-redesign-2026-08-08.md — le plan maître du redesign, si tu
   touches à un écran /creer.
4. map.md — arbre du projet. Ses journaux datés contiennent le détail de chaque
   phase : ne les lis QUE pour la zone que tu touches (journal « phase F » pour
   le pipeline, journaux « 2026-08-11 » pour la photothèque et pour les presets).
5. docs/audit-preset-powlisher-2026-08-11.md — UNIQUEMENT si tu touches à la
   colorimétrie de Vision : méthode de mesure, chiffres cibles, réserves.
NE LIS PAS docs/archive-vibecut-2026-08-04.md : archive d'un chantier clos,
utile seulement si tu touches à /video ou à render-service/.

ÉTAT EXACT :
- Toute la création vit sous /creer : accueil /creer, Photothèque
  /creer/bibliotheque, Layout /creer/layout-visuel, Studio /creer/studio,
  Vision /creer/vision, Soundtrack /creer/son. Vidéo : /video (intact).
- La publication vit sous /publier (PublicationsManager existant, non réécrit).
- /studio ne rend plus rien : redirection serveur vers /creer.
- Pipeline chaîné : composition Layout → filtres Vision → effets Studio →
  export, dans src/features/vibeos/project/pipeline.js.
- La photothèque vit dans src/features/vibeos/library/ : base IndexedDB
  `vibeos-library` SÉPARÉE de la base des projets `vibeos`, lecteur EXIF maison
  (exif.js), masonry calculée (masonry.js), carrousel FLIP (Lightbox.jsx).
  « Retoucher » crée un NOUVEL espace monté sur la photo, pour ne jamais
  écraser une composition en cours.
- L'avant/après est un composant partagé : src/features/vibeos/shared/
  BeforeAfter.jsx (rideau / côte à côte / maintien), utilisé par Vision.
- Vision n'a PLUS de « looks » ni de bibliothèque de profils par marque
  (supprimés le 2026-08-11 : ils dénaturaient les photos et rendaient l'écran
  lent). Il a des PRESETS compilés en LUT 3D :
  * src/features/vibefx-studio/utils/lut3d.js — moteur générique : une fonction
    de preset est évaluée une fois sur une grille 33³, puis appliquée en UNE
    passe par interpolation trilinéaire. Coût de rendu CONSTANT : ajouter un
    preset ne coûte rien.
  * src/features/vibefx-studio/utils/visionPresets.js — les presets, écrits
    comme des fonctions pures sRGB→sRGB dans l'ordre Lightroom (courbe maître →
    mélangeur TSL → désaturation des hautes lumières → virage split EN DERNIER).
  * src/features/vibeos/vision/presetPreview.js — vignettes : la photo est
    réduite UNE fois dans un canvas partagé, chaque vignette n'est qu'une passe.
  Il n'y a qu'un preset pour l'instant : `powlisher`, reconstruit par mesure sur
  19 photos de @powl_d.

PIÈGES CONNUS, NE PAS LES RÉINTRODUIRE :
- Dans resolveProjectSource, la composition du Layout est PRIORITAIRE sur la
  photo du projet. Tout écran qui laisse l'utilisateur changer de photo doit
  donc effacer `project.composition`, sinon l'ancienne image revient au
  rechargement.
- Dans un preset, le virage split doit venir APRÈS le mélangeur de teintes.
  Placé avant, le mélangeur le désature et l'écart B−G visé dans les hautes
  lumières retombe d'un quart (−8,8 au lieu de −12,0). C'est aussi l'ordre réel
  de Lightroom.
- Tout décalage de teinte dans un preset doit être pondéré par la saturation
  (`smoothstep(0, 0.12, s)`). Un pixel quasi gris n'a pas de teinte définie : le
  décaler crée une discontinuité que l'interpolation de la LUT transforme en
  bandes visibles.
- Ne jamais recalculer une vignette depuis l'image pleine résolution. C'était la
  cause directe des saccades de Vision.

NON FAIT, ASSUMÉ (voir todo.md) : la synchronisation Google Drive de la
photothèque (elle est locale à l'appareil, rien ne part sur un serveur ; Drive
demande un vrai OAuth Google + un aller-retour serveur). Le rail agents IA et
la bibliothèque Midjourney sont partis avec l'ancienne UI. La couverture
émulateurs du parcours publication et le smoke corpus Vision ont été retirés
avec les écrans qu'ils pilotaient. Le preset `powlisher` est validé contre 20
cibles chiffrées et sur une mire, mais PAS encore sur un corpus de photos
smartphone brutes — faute d'en avoir eu sous la main.

RÈGLES NON NÉGOCIABLES :
- Jamais de Tailwind dans le nouveau code : CSS Modules + tokens --vo-*.
  Le bundle Tailwind statique n'est chargé que par /publier.
- Jamais réécrire un moteur existant : l'importer. Si la logique utile est
  enfermée dans un composant, l'EXTRAIRE dans un module partagé.
- IndexedDB : des Blobs, jamais de dataURL.
- Desktop + mobile sérieux. Textes UI en français simple.
- Aucun déploiement sans demande explicite : tout se vérifie en local.

GATES à rejouer en fin de tranche :
npm run lint, npm run build, npm run test:scope, npm run test:vibeos-library,
npm run test:vibeos-layout, npm run test:vibeos-vision (il rejoue d'abord
test:vision-preset), npm run test:vibeos-studio, npm run test:vibeos-soundtrack,
npm run test:vibeos-pipeline, npm run test:vision-filters, et
npm run test:routes si tu touches aux routes (il demande un build + start).
Si tu touches à la colorimétrie : npm run test:vision-preset en boucle courte,
c'est du Node pur et ça répond en une seconde.
Puis mise à jour de todo.md (qui doit RESTER court) et de map.md (arbre +
journal daté), rapport honnête de ce qui marche et de ce qui est laissé de
côté — ET, dans le chat, le récap en langage simple suivi du prompt de reprise
complet dans un bloc de code, prêt pour un chat neuf à contexte zéro.
