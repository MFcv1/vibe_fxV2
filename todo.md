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
| **F — Bascule** | **chaînage du pipeline, redirections `/studio` → `/creer`, suppression de l'ancien UI, QA transverse** | ⏳ **prochaine étape** |

Les cinq écrans tournent. Détail de chacun : journaux `map.md` du 2026-08-08.

### Ce qu'il faut savoir avant de toucher au code

- **Les moteurs sont importés, jamais réécrits.** Pattern de référence :
  `useLayoutEditor.js`, `useVisionEditor.js`, `useStudioEditor.js`,
  `useVibeOsSoundtrack.js` dans `src/features/vibeos/*/`.
- **Trois extractions sans changement de comportement** ont été faites plutôt
  que dupliquer du code enfermé dans des composants :
  [visionRecommendation.js](src/features/vibefx-studio/utils/visionRecommendation.js)
  (recommandation Vision, partagée Vision + Studio),
  [soundtrackImportFlows.js](src/features/vibefx-studio/soundtrack/services/soundtrackImportFlows.js)
  (imports Aitra/Pixabay/URL/fichier, partagés ancien `/studio` + VibeOS), et
  les Sheets Mesh/Lumen/Flou pro sortis vers
  [vibeos/shared/](src/features/vibeos/shared/).
- **L'audio de VibeOS vit dans
  [AudioProvider.jsx](src/features/vibeos/audio/AudioProvider.jsx)** : élément
  `<audio>` du layout `/creer`, file, aléatoire, volume, enchaînement
  automatique, et un résolveur qui redemande le Blob à la bibliothèque (celle-ci
  révoque ses URLs d'objet au démontage). `useSoundtrackPlayer` et
  `useSoundtrackController` ne sont donc **pas** utilisés par VibeOS ; ils
  restent intacts pour l'ancien `/studio`.
- **Parité d'export du Layout mesurée** : 0 pixel d'écart avec l'ancien écran
  (`npm run test:vibeos-layout-parity`).

---

## Reste à faire — Phase F (Bascule)

Spec : plan §4.4 et §6, pipeline cible §4.3. Dans cet ordre :

1. **Chaîner le pipeline (plan §4.3).** Aujourd'hui Vision et Studio travaillent
   sur **la photo** du projet, pas sur la composition Layout. Faire circuler la
   composition : composition Layout → filtres Vision → effets Studio → export.
   C'est le vrai trou fonctionnel restant, à traiter **avant** toute
   suppression.
2. **Rediriger `/studio` → `/creer`** côté serveur, avec le mapping des
   workspaces (`layout` → `/creer/layout-visuel`, `studio` → `/creer/studio`,
   `vision-pro` → `/creer/vision`, `soundtrack` → `/creer/son`).
3. **Rebrancher « Publier »** du bandeau sur le vrai flux de publication (il
   pointe encore vers `/studio`), sans réécrire `PublicationsManager`.
4. **Supprimer l'ancienne UI dans un commit séparé et réversible** :
   `VibeFxStudio.jsx` et les composants UI morts (garder moteurs, hooks et
   services importés par `vibeos/`), `HeroSidebar`, l'onglet library legacy s'il
   n'est pas porté. Adapter les smokes qui référencent les anciens sélecteurs.
5. **QA transverse** : parcours complet « importer → composer → Vision → Studio
   → musique → publier », desktop **et** mobile, puis toutes les suites.

### Limites assumées à lever ou à assumer en phase F

- Vision et Studio travaillent sur la photo du projet, pas sur la composition
  (c'est le point 1 ci-dessus).
- Le fond généré du Studio est écrit dans le projet commun et rendu par Mise en
  page ; le Studio l'affiche en aperçu mais ne le compose pas sous la photo.
- Le moteur d'assets ne fournit qu'un sticker (le scotch) : c'est ce qui est
  exposé.
- « Utiliser dans VibeCut » passe par le store vidéo partagé
  (`vibefx-studio/video/store/videoStore.js`), singleton de module : le
  transfert survit à une navigation client, pas à un rechargement complet.

---

## Règles non négociables du chantier

- **Jamais de Tailwind dans le nouveau code.** Le bundle de `/studio` est un
  artefact statique figé : une classe absente ne fait rien. CSS Modules +
  tokens `--vo-*` uniquement.
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
- Tout écart de rendu entre ancien et nouveau Layout est un bug bloquant.
- Le smoke Soundtrack importe un WAV que le serveur de dev recopie dans
  `public/music/local-imports` (ignoré par git) **et inscrit dans son
  manifeste** : il nettoie les deux. Tout script qui importe des pistes doit
  faire pareil, sinon la bibliothèque locale se pollue.

---

## Gates

```bash
npm run dev                       # http://localhost:3000
npm run lint                      # 0 erreur attendue (12 warnings préexistants)
npm run build
npm run test:scope                # isolation vis-à-vis du projet source
npm run test:vibeos-layout        # B1 + B3
npm run test:vibeos-vision        # parcours + 12 looks sur 5 photos types
npm run test:vibeos-studio        # parcours + 10 ambiances distinctes sur 3 photos types
npm run test:vibeos-soundtrack    # import + lecture, lecture qui survit au changement de page, mobile, recherche
npm run test:vibeos-layout-parity # pixel-diff ancien vs nouveau Layout — 0 écart attendu
```

Tous verts au 2026-08-08. Les suites `test:vibecut-*` ne concernent pas ce
chantier ([archive](docs/archive-vibecut-2026-08-04.md#commandes)).

### Échecs préexistants (hors chantier VibeOS)

Antérieurs à ce chantier, non causés par lui, ne bloquent pas les gates VibeOS.
Détail dans l'[archive](docs/archive-vibecut-2026-08-04.md#problèmes-connus-non-résolus).

| Test | Nature |
|---|---|
| `npm run test:vision-ui` — 2 échecs sur 9 | ancien panneau Vision : `Kodak Ektar 100` dépasse le seuil de clipping chaud, et un redo ne redonne pas exactement la même empreinte canvas. Mesuré identique avec et sans l'extraction de `visionRecommendation.js`. |
| `npm run test:soundtrack-ui` — 11 échecs | ancien écran Soundtrack : APIs musique non configurées en local (`/api/music/ai-providers` en 404) et scénarios réseau. Mesuré identique avant/après l'extraction de `soundtrackImportFlows.js`. |
| `smoke-vibecut-media-safety.spec.cjs` (3), `test:vibecut-export-local-mp4`, `.mp4` de `videotest/` | fixtures manquantes, chemins Windows d'origine, pointeurs Git LFS. |

---

## Prompt de reprise (phase F — Bascule)

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
2. docs/plan-vibeos-redesign-2026-08-08.md — LE plan maître. Pour cette phase :
   §4.3 (pipeline de rendu cible), §4.4 (bascule), §6 (phase F), §7 (risques).
3. todo.md — court : où on en est, ce qui reste, les gates. C'est ta feuille de
   route.
4. map.md — arbre du projet. Ses journaux datés du 2026-08-08 contiennent le
   détail de chaque phase livrée : ne les lis QUE pour la zone que tu touches.
NE LIS PAS docs/archive-vibecut-2026-08-04.md : archive d'un chantier clos,
utile seulement si tu touches à /video ou à render-service/.

ÉTAT : les 5 écrans VibeOS sont livrés et verts (phases A à E). Layout sur
/creer/layout-visuel, Vision sur /creer/vision, Studio sur /creer/studio,
Soundtrack sur /creer/son, accueil incubateur sur /creer. L'ancien /studio est
toujours debout, intact. Le résumé et les points d'architecture à connaître
(moteurs importés, trois extractions faites, provider audio global) sont en tête
de todo.md — commence par là.

TA MISSION : phase F (Bascule), dans cet ordre :
1. Chaîner le pipeline du plan §4.3 : aujourd'hui Vision et Studio travaillent
   sur LA PHOTO du projet, pas sur la composition Layout. Faire circuler la
   composition : composition Layout → filtres Vision → effets Studio → export.
   C'est le vrai trou fonctionnel restant, à traiter AVANT toute suppression.
2. Rediriger /studio → /creer côté serveur, avec le mapping des workspaces
   (?workspace=layout → /creer/layout-visuel, studio → /creer/studio,
   vision-pro → /creer/vision, soundtrack → /creer/son).
3. Rebrancher le bouton « Publier » du bandeau sur le vrai flux de publication
   (il pointe encore vers /studio) sans réécrire PublicationsManager.
4. Supprimer l'ancienne UI dans un COMMIT SÉPARÉ ET RÉVERSIBLE :
   VibeFxStudio.jsx et les composants UI morts (garder les moteurs, hooks et
   services importés par vibeos/), HeroSidebar, l'onglet library legacy s'il
   n'est pas porté. Adapter les smokes qui référencent les anciens sélecteurs.
5. QA transverse : parcours complet « importer → composer → Vision → Studio →
   musique → publier » sur desktop ET mobile, puis toutes les suites.

RÈGLES NON NÉGOCIABLES (détaillées dans todo.md) :
- Jamais de Tailwind dans le nouveau code : CSS Modules + tokens --vo-*.
- Jamais réécrire un moteur existant : l'importer. Si la logique utile est
  enfermée dans un composant, l'EXTRAIRE dans un module partagé.
- La suppression de l'ancienne UI est un commit séparé et réversible, et elle
  vient APRÈS que le pipeline chaîné soit vert.
- Desktop + mobile sérieux. Textes UI en français simple.
- Aucun déploiement : tout se vérifie en local.

FIN DE TRANCHE (rituel obligatoire) :
npm run lint, npm run build, npm run test:vibeos-layout,
npm run test:vibeos-vision, npm run test:vibeos-studio,
npm run test:vibeos-soundtrack, npm run test:vibeos-layout-parity,
npm run test:scope, mise à jour de todo.md (qui doit RESTER court) et de map.md
(arbre + journal daté), rapport honnête de ce qui marche et de ce qui est
laissé de côté — ET, dans le chat, le récap en langage simple suivi du prompt
de reprise complet dans un bloc de code, prêt pour un chat neuf à contexte zéro.
