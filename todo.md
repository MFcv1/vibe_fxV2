# TODO — Vibe_fx V2

> **Dernière mise à jour : 2026-08-08.**
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
| C — Vision | `/creer/vision` : « Améliorer ma photo » auto, intensité, 12 looks triés par photo, garde-fous smartphone | ✅ 2026-08-08 |
| D — Studio | `/creer/studio` : 10 ambiances 1 clic, intensité, « Surprends-moi », variantes, styles perso | ✅ 2026-08-08 |
| E — Soundtrack | `/creer/son` : interface Spotify complète, 4 sources en Sheet, lecteur global | ✅ 2026-08-08 |
| F — Bascule | pipeline chaîné, `/studio` → `/creer`, publication sur `/publier`, ancienne UI supprimée | ✅ 2026-08-08 |

**Le redesign VibeOS est livré.** L'ancienne interface `/studio` n'existe plus.

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

## Reste à faire

Rien de bloquant : les six phases sont livrées et vertes. Ce qui suit est du
choix produit, pas de la dette cachée.

1. **Rail agents IA et bibliothèque Midjourney** — ces deux surfaces vivaient
   dans l'ancienne interface et sont parties avec elle. Les routes API et le
   ledger IA sont intacts ; `src/config/aiLaunch.js` les marque « à porter dans
   VibeOS ». À porter dans `/creer` si on les veut.
2. **Couverture émulateurs du parcours publication** — `smoke-studio-emulator-ui`
   pilotait l'ancienne UI ; il a été retiré. `test:publication-flow` et
   `test:emulators` couvrent toujours la logique et les règles, mais plus le
   parcours navigateur bout en bout. À réécrire sur `/publier` si on y tient.
3. **Corpus Vision réel** — `check:vision-corpus` reste non bloquant et le
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
npm run test:vibeos-layout        # B1 + B3
npm run test:vibeos-vision        # parcours + 12 looks sur 5 photos types
npm run test:vibeos-studio        # parcours + 10 ambiances distinctes sur 3 photos types
npm run test:vibeos-soundtrack    # import + lecture, lecture qui survit au changement de page, mobile
npm run test:vibeos-pipeline      # composition -> Vision -> Studio -> publication, desktop + mobile
npm run test:routes               # redirections /studio, noindex /creer et /publier (serveur build+start)
npm run test:publication-flow
```

Tous verts au 2026-08-08. Les suites `test:vibecut-*` ne concernent pas ce
chantier ([archive](docs/archive-vibecut-2026-08-04.md#commandes)).

### Échecs préexistants (hors chantier VibeOS)

| Test | Nature |
|---|---|
| `smoke-vibecut-media-safety.spec.cjs` (3), `test:vibecut-export-local-mp4`, `.mp4` de `videotest/` | fixtures manquantes, chemins Windows d'origine, pointeurs Git LFS. |

Les échecs de `test:vision-ui` (2) et `test:soundtrack-ui` (11) ont disparu avec
les suites elles-mêmes : elles pilotaient l'ancienne interface, supprimée à la
phase F.

---

## Prompt de reprise (après la phase F)

> À copier tel quel dans un nouveau chat, contexte à zéro.

Reprends le projet Vibe_fx V2. Le chantier VIBEOS (redesign complet de
l'interface de création) est TERMINÉ : phases A à F livrées et vertes.

PROJET : /Users/matthis/Desktop/mes projets mac/vibe_fxV2 (branche
vibecut/phases-3b-5-6-7)

LIS DANS CET ORDRE, avant d'écrire la moindre ligne :
1. AGENTS.md — règles de travail, rituel de fin de phase, clôture de phase dans
   le chat, discipline de coûts.
2. todo.md — court : l'état livré, ce qui reste au choix, les limites assumées,
   les gates. C'est ta feuille de route.
3. docs/plan-vibeos-redesign-2026-08-08.md — le plan maître du redesign, si tu
   touches à un écran /creer.
4. map.md — arbre du projet. Ses journaux datés du 2026-08-08 contiennent le
   détail de chaque phase : ne les lis QUE pour la zone que tu touches (le
   journal « phase F » explique le pipeline et la suppression de l'ancien UI).
NE LIS PAS docs/archive-vibecut-2026-08-04.md : archive d'un chantier clos,
utile seulement si tu touches à /video ou à render-service/.

ÉTAT EXACT :
- Toute la création vit sous /creer : accueil incubateur /creer, Layout
  /creer/layout-visuel, Studio /creer/studio, Vision /creer/vision, Soundtrack
  /creer/son. Vidéo : /video (chantier précédent, intact).
- La publication vit sous /publier (PublicationsManager existant, non réécrit).
- /studio ne rend plus rien : redirection serveur vers /creer, avec le mapping
  des anciens ?workspace=.
- Le pipeline est chaîné : composition Layout → filtres Vision → effets Studio
  → export, écrit dans src/features/vibeos/project/pipeline.js.
- L'ancienne interface (VibeFxStudio.jsx, components/, ai/, soundtrack/components/)
  a été supprimée dans un commit séparé et réversible. Les moteurs, hooks, utils,
  data et services de vibefx-studio/ sont restés et sont importés par vibeos/.

NON PORTÉ, ASSUMÉ (voir todo.md) : le rail agents IA et l'onglet bibliothèque
Midjourney sont partis avec l'ancienne UI ; les APIs et le ledger IA sont
intacts. La couverture émulateurs du parcours publication et le smoke corpus
Vision ont été retirés avec les écrans qu'ils pilotaient.

RÈGLES NON NÉGOCIABLES :
- Jamais de Tailwind dans le nouveau code : CSS Modules + tokens --vo-*.
  Le bundle Tailwind statique n'est chargé que par /publier.
- Jamais réécrire un moteur existant : l'importer. Si la logique utile est
  enfermée dans un composant, l'EXTRAIRE dans un module partagé.
- Desktop + mobile sérieux. Textes UI en français simple.
- Aucun déploiement sans demande explicite : tout se vérifie en local.

GATES à rejouer en fin de tranche :
npm run lint, npm run build, npm run test:scope, npm run test:vibeos-layout,
npm run test:vibeos-vision, npm run test:vibeos-studio,
npm run test:vibeos-soundtrack, npm run test:vibeos-pipeline,
et npm run test:routes si tu touches aux routes (il demande un build + start).
Puis mise à jour de todo.md (qui doit RESTER court) et de map.md (arbre +
journal daté), rapport honnête de ce qui marche et de ce qui est laissé de
côté — ET, dans le chat, le récap en langage simple suivi du prompt de reprise
complet dans un bloc de code, prêt pour un chat neuf à contexte zéro.
