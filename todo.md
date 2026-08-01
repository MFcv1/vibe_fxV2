# TODO — Reconstruction de l'interface VibeCut

> État d'avancement. Plan complet et direction artistique : [plan.md](plan.md).
> **Dernière mise à jour : 2026-08-02.**

---

## Où on en est

**La reconstruction est terminée. Toutes les phases, du 0 au 7.**
Il n'y a plus qu'une interface VibeCut, sur `/video`, et la production rend ce
que l'aperçu montre.

**Livré le 2026-08-01 : L4, L5 et toute la phase 5.**
- **L4** — les cartes de preset sont bâties sur les **miniatures réelles** du
  projet : trois panneaux enchaînés par la vraie transition du preset, à son vrai
  tempo. Repli SVG conservé pour l'état où l'extraction n'est pas finie.
- **L5** — la **partition est visible** (un bloc par plan, largeur = durée), et le
  **problème H est fermé** : `titleStyle` et `audioProfile` sont réellement
  appliqués, la mise en capitales restant réversible.
- **Phase 5** — `/video/transitions` et `/video/mouvements` existent vraiment.
  Décision structurante : **les aperçus sont dessinés par le moteur**, pas imités
  en CSS, donc une carte ne peut pas diverger du rendu qu'elle annonce.

**`npm run test:scope` est vert pour la première fois** : le problème A est
corrigé (le garde interdisait le mot « jardin » tout court), et trois assertions
périmées de la même famille sont alignées.

**L6 est déployé (2026-08-01).** La production tourne sur la révision
`00006-6fw` : **15 transitions sur 15** vérifiées sur le service réel. Ce que
l'aperçu montre est enfin ce que l'export produit. Le problème E est clos.

**Phase 7 terminée (2026-08-01) : il n'y a plus qu'une seule interface.**
`/studio?workspace=video` redirige vers `/video`, et l'ancien front est
supprimé — **10 036 lignes**. Trois fonctions que seul l'ancien panneau d'export
portait ont été **déplacées** plutôt que perdues (enregistrement dans un dossier
du PC, nom de fichier horodaté, régénération d'URL signée), et un quatrième
oubli a été rattrapé au passage : le nouveau front annonçait « MP4 » sans jamais
relire ce que le rendu avait produit.

**Toutes les phases du plan de reconstruction sont terminées.**

**Prochain chantier, décidé le 2026-08-02 : les DEUX BIBLIOTHÈQUES.**
Elles existent depuis la phase 5 mais restent un catalogue fonctionnel, pas une
page où l'on a envie de rester. Le porteur du projet veut la **fondation du
design** des deux écrans — avec des **avant / après** — bâtie sur le contenu
**déjà en place**. Le contenu supplémentaire (nouveaux mouvements, effets
pendant le rush, transitions supplémentaires) vient **après**.

> **Feuille de route : [docs/vibecut-bibliotheques-roadmap-2026-08-02.md](docs/vibecut-bibliotheques-roadmap-2026-08-02.md)**
> Lot **B1** en premier (design), puis B2 (vraies vidéos), puis B3 (contenu).

| Phase | État |
|---|---|
| 0 · Fondations | ✅ |
| 1 · Accueil | ✅ |
| 2 · Montage rapide | ✅ |
| 3 · Création guidée | ✅ |
| 3b · Presets de montage | ✅ **terminée** — L1 à L6 livrés, rollout inclus |
| 4 · Montage avancé | ✅ 2026-07-31 |
| 5 · Bibliothèques | ✅ **2026-08-01** |
| 6 · Extensions moteur | ⬜ — devient le lot **B3** de la roadmap bibliothèques |
| B · Bibliothèques (design → contenu) | 🟡 **chantier en cours** — B1 à faire |
| 7 · Bascule et nettoyage | ✅ **terminée le 2026-08-01** |

---

## Fait

### Phase 0 — Fondations
- Route `/video` + layout `noindex` derrière `StudioAuthGate`, ne chargeant que `vibecut.css`.
- Design system scopé `.vibecut` : tokens sombres neutres, accent unique, typo système ≥ 12 px, monospace réservé aux timecodes, thème clair prêt mais inactif.
- Primitives : `Button`, `IconButton`, `Segmented`, `Card`, `EmptyState`, `Spinner`, `Progress`, `Badge`, `Collapsible`.
- Bibliothèque multi-projets IndexedDB (clés `project:` / `meta:`), **sans bump de version** pour cohabiter avec `videoProjectPersistence.js`.
- Assertions d'isolation dans `scripts/audit-scope.mjs`.

### Phase 1 — Accueil
- `HomeScreen` : titre, 3 cartes de mode avec maquettes CSS animées au survol, rangées Mouvements et Transitions, projets récents.
- Illustrations de scène **100 % SVG** (`media/SceneIllustration.jsx`) : montagne, ville, plage, forêt, portrait, produit. Aucun asset externe.
- Catalogues `motionCatalog` / `transitionCatalog` mappés sur les ids réels du moteur, statut `planned` pour ce qui n'est pas rendu.
- États vide / chargement / erreur, création et suppression de projet.

### Phase 2 — Montage rapide
- **Import** : bouton + glisser-déposer, progression, miniatures et forme d'onde via le pipeline existant.
- **Storyboard** : grandes cartes, réorganisation en **pointer events** (tactile, testable, cartes voisines qui s'écartent), puces de transition entre scènes, badges texte et mouvement.
- **Inspecteur de scène** : durée, mouvement (grille animée), transition + durée, volume, sections repliables.
- **Texte** : multiligne, taille, gras/italique, couleurs, fond ou contour, position 9 points, durée, animations, suppression. **Déplacement à la souris sur l'aperçu avec magnétisme** centre + tiers et repères dessinés sur le canvas.
- **Musique** : feuille d'ajout avec déclaration de droits obligatoire, volume, coupure, départ dans le morceau, fondu de sortie (1 s par défaut), badge d'état des droits.
- **Aperçu** : `PlaybackEngine` réel, transport avec scrub clavier, **playhead à 60 fps** piloté hors React.
- **Annuler / rétablir** (boutons + `Cmd+Z` / `Cmd+Maj+Z`), **découpe de scène** à la position de lecture.
- **Export** : feuille avec format, fps, durée, son, pré-vol réel, progression, état terminé, téléchargement (URL signée régénérée au clic), échec + réessayer.
- **Sauvegarde automatique** et réouverture par `?project=<id>`.

### Phase 3 — Création guidée
- **Moteur de recettes pur** `data/styleRecipes.js` — **aucun import**, donc testable directement en Node.
  4 styles (Social dynamique · Cinéma doux · Souvenirs · Net et direct) × 3 rythmes × 3 jeux de mouvements.
  `buildMontagePlan()` en dérive : durée par photo, motif de mouvements alterné, transition + durée, look
  colorimétrique **complet**, format. `describeMontagePlan(plan, applied)` est la source unique de ce qui
  est annoncé à l'utilisateur, et l'état réel du montage y prime sur l'intention du plan.
- **Application en une seule écriture** : `adapters/useGuidedMontage.js` passe par `applyGuidedTemplate`,
  donc une seule entrée d'historique et un seul recalcul de timeline par changement d'avis.
- **`guided/GuidedFlow.jsx`** : 5 étapes (Médias → Format & style → Rythme & mouvements → Son & textes →
  Finaliser), rail de progression, retour arrière libre par le rail, panneau remis en haut à chaque étape.
- **Génération live** : chaque choix réécrit le montage, la colonne d'aperçu joue le résultat réel.
  Chaque carte de rythme annonce la durée que son choix produira.
- **Étape Son & textes** : musique avec déclaration de droits (feuille partagée avec le montage rapide) et
  titre d'ouverture posé sur la première scène.
- **Étape Finaliser** : récapitulatif **relu du montage** (scènes, durée, durée par photo, nombre de fondus),
  export direct, et passage vers `/video/rapide` ou `/video/avance` sur le même `?project=`.
- **Parité tenue** : seuls les 6 mouvements et la seule transition minutée rendus par FFmpeg (`crossfade`)
  peuvent être produits ; la colorimétrie est rendue des deux côtés ; les mouvements sur vidéo restent
  annoncés « Bientôt ».
- **Mouvement qui démontre**, jamais qui décore (plan.md § 4.5) :
  - vignette de style = **deux plans qui s'enchaînent pour de vrai, en boucle permanente**, à la cadence
    réelle du style (`getStyleTempo` → `--vc-cycle`) et avec sa longueur de fondu (`data-pace`) ;
    « Net et direct » coupe franchement dans sa vignette parce qu'il coupera franchement dans la vidéo ;
  - vignette de mouvements = **deux mouvements consécutifs du motif**, donc « Doux » (zoom avant puis
    arrière) se distingue enfin de « Varié » (zoom avant puis panoramique) ;
  - départ de boucle décalé d'une carte à l'autre (`animation-delay` négatif) : la grille ne bascule
    jamais à l'unisson ;
  - entrée d'étape directionnelle (avancer pousse depuis la droite, revenir ramène depuis la gauche) ;
  - barre de progression du parcours, cascades sur les scènes importées / les lignes du récapitulatif /
    les deux sorties, liseré du rail, impulsion de la pastille cochée, colonne d'aperçu qui glisse à
    l'étape 2, bandeau d'import qui descend.

  **Historique de cette décision** : les démonstrations ont d'abord été déclenchées au survol, comme
  l'exigeait `plan.md` § 4.5. Résultat : on arrivait sur un écran figé, et comparer deux styles obligeait
  à les survoler l'un après l'autre — le porteur du projet a constaté « j'ai l'impression que rien n'a
  changé ». La règle a donc été **renversée le 2026-07-30** : boucle permanente. `plan.md` § 4.5 porte
  la décision et son motif.
  Une bande de tempo avait aussi été ajoutée sur les cartes de rythme, puis **retirée** : elle encodait
  une information réelle mais se lisait comme un égaliseur décoratif sur une carte déjà sélectionnée.

### Phase 3b · L1 — Parité des transitions (2026-07-30)
- **Le renderer n'écrit plus `xfade=transition=fade` en dur.** `SERVER_XFADE_TRANSITION_MAP`
  résout le type demandé, avec **repli sur `fade`** pour tout id inconnu (un identifiant absent
  du build FFmpeg déployé ferait échouer le rendu entier).
- **15 transitions distinctes** exportables : `crossfade` · `dip-black` · `dip-white` ·
  `film-dissolve` · `desat-fade` · `swipe-left` · `swipe-right` · `push-up` · `push-down` ·
  `wipe-left` · `blinds-open` · `iris-open` · `iris-close` · `pixel-cut` · `blur-cut`.
- **`engine/xfadeTransitions.js`** : contrepartie canvas de ces 15 transitions.
  `VideoEngine.renderTransition` y délègue **avant** son `easeInOut`.
- Table portée à l'identique par `exportManifest.js` (capacités **v3**) et
  `functions/src/videoExport.js` ; `smoke-vibecut-transition-parity` échoue si les trois
  divergent ou si une cible `xfade` manque au build local.
- **Preuves, pas déclarations** :
  - `test:vibecut-xfade-local-mp4` — un MP4 réel par transition, **commande construite par
    `buildFfmpegArgs` du renderer lui-même**, donc un `fade` en dur y serait attrapé ;
  - `test:vibecut-xfade-preview-parity` — l'aperçu canvas et le rendu FFmpeg comparés
    **image par image dans Chromium**, à 4 instants du fondu, seuil justifié par transition.
- Effet de bord voulu : `dip-black`, `dip-white`, `film-dissolve` passent de
  « Aperçu uniquement » à « Export Pro » dans le montage rapide.
- **`zoom-punch` écarté** (cf. § problèmes connus, ligne F).
- **Aucun déploiement** : le renderer en production rend toujours un fondu simple jusqu'à L6.

### Phase 3b · L2 — Le modèle de preset (2026-07-30)
- **Un preset est devenu une partition** à sept dimensions : `beat` (poids par plan +
  `openingHold`/`closingHold`), `transitionScore` + `accentEvery` + `accentTransition` +
  `openingTransition`/`closingTransition`, `motionScore` + `motionIntensity`, `look`,
  `titleStyle`, `audioProfile`, `sequencePreset`.
- **`buildMontagePlan()` produit un plan par scène** : `plan.scenes[]` (durée, mouvement)
  et `plan.cuts[]` (type, durée). Plus de valeurs globales.
- **Synergie rythme ↔ style** : `durée(scène i) = beatBase(rythme) × beatPattern[i] × holds`.
  Un test compare les **rapports** entre plans d'un rythme à l'autre : changer de rythme
  comprime le montage sans changer sa forme.
- **Garde-fou des 45 %** : une transition ne dépasse jamais 45 % du plus court des deux
  plans qu'elle relie. Avant, « Cinéma doux » en rythme soutenu se faisait rogner son
  fondu en silence et perdait son caractère.
- **Six presets** : Reel dynamique · Cinéma · Souvenirs · Produit · Mixed media · Récit.
  « Cinéma » — le seul qui plaisait — est conservé tel quel, seulement enrichi de structure.
  « Récit » est le seul dont la structure raconte : ses plans raccourcissent.
- **Action de store additive `applyMontageScore`**. `applyGuidedTemplate` n'est pas touchée
  (l'ancien front la lit jusqu'à la phase 7) et le smoke échoue si l'une des deux disparaît.
- **Interface remise en cohérence** : le récapitulatif et les cartes de rythme annoncent
  l'amplitude réelle des plans (« 2,72 à 4,57 s ») au lieu d'une durée unique qui n'existe
  plus, et le nombre de coupes fondues sur le total avec leurs traitements.
  Grille de styles à 3 colonnes fixes ≥ 720 px : six presets font deux rangées pleines.
- **Montage rapide remis à niveau après L1** : `transitionCatalog.js` gagne les onze
  transitions exportables qui lui manquaient (famille « Glissements & volets »), et
  **les six raccourcis de `SceneInspector` sont désormais tous exportables** — quatre des
  six n'existaient qu'à l'aperçu, l'interface poussait donc vers des montages inexportables.

### Phase 3b · L3 — Mouvement : intensité et courbe (2026-07-30)
- **Le mouvement des photos est enfin rendu à l'identique des deux côtés.** Le `smoothstep`
  de l'aperçu (`p²(3−2p)`) est écrit dans l'expression `zoompan` du renderer. Un zoom
  partait doucement à l'écran et sec à l'export **depuis l'origine**.
- **Intensité du mouvement** : un facteur unique multiplie l'écart `end − start`, avec la
  **même formule des deux côtés** — la parité est garantie par construction, pas par
  surveillance. Elle voyage jusqu'au clip, puis dans le manifeste (capacités **v4**), puis
  dans le renderer. Le cadrage de **départ** ne bouge pas : baisser l'intensité raccourcit
  la course, elle ne recadre pas la photo.
- **Trois crans nommés** à l'étape 3 : Discret 40 % · Naturel 70 % · Marqué 100 %. Pas de
  curseur continu — il appartient au montage avancé. Les six presets portent désormais
  **exactement l'un des trois crans** (0,55 et 0,9 ne pouvaient pas s'afficher). Tant que
  rien n'est choisi, le cran est celui du preset ; une fois choisi, il tient, comme le
  rythme depuis L2.
- **`applyImageMotionTransform`** extraite de `VideoEngine` vers `mediaModel.js` (module sans
  aucun import) : le test de parité charge donc le **code de production** tel quel.
- **Preuve, pas déclaration** — `test:vibecut-motion-parity` : des MP4 réels, rendus par la
  commande que **le renderer construit lui-même**, décodés et comparés image par image à
  l'aperçu dans Chromium, sur 6 mouvements/intensités + un cas amplifié, 5 instants chacun.
  Trois assertions, parce qu'une seule ne suffisait pas :
  1. **parité** — les deux images coïncident (pire écart mesuré : **7,3/255**) ;
  2. **effet réel** — baisser l'intensité change vraiment l'export ; deux côtés qui
     l'ignoreraient tous les deux seraient « en parité » et le test ne vaudrait rien ;
  3. **sentinelle** — un aperçu volontairement remis en linéaire doit **sortir** des seuils
     (22,2 contre un seuil de 12), sinon c'est le test qui est devenu aveugle.
  Vérifié en conditions : remettre le renderer en linéaire fait échouer le test **même en
  neutralisant la lecture de la commande FFmpeg**, donc par la seule comparaison d'images.
- **Aucun déploiement** : le renderer en production rend toujours un mouvement linéaire et
  un fondu simple jusqu'à L6.

### Phase 4 — Montage avancé (2026-07-31)
- **`/video/avance` n'est plus un `PhasePlaceholder`.** La carte de l'accueil promettait
  « timeline multipiste, inspecteur, colorimétrie, export jusqu'à 60 fps » sans badge
  « Bientôt » : la promesse est rendue vraie plutôt que retirée.
- **Quatre zones** (`features/vibecut/advanced/`) : bibliothèque de médias (recherche, tri
  ordre de montage / nom / durée, vignettes réelles), aperçu central, inspecteur contextuel,
  timeline multipiste. Un seul bandeau d'écran, les actions vivent à côté de son titre.
- **Timeline multipiste sur le modèle canonique**, via le nouvel adaptateur
  `adapters/useTimeline.js` : les **sept** pistes de `timelineModel.js` (Volets, Vidéo,
  Transitions, Effets, Texte, Son des clips, Musique) dans leur ordre déclaré, chacune avec
  **seulement les bascules qui font quelque chose** — une piste visuelle n'a pas de son à
  couper, une piste audio rien à montrer.
- **Ce que le modèle autorise, et rien de plus.** Sur la piste vidéo, les clips sont posés
  bout à bout et leur début est *calculé* : glisser un clip le **réordonne** (indicateur de
  dépôt), les poignées le **rognent**. Un texte, une musique ou une transition libre — dont
  le début est une **donnée** — se déplacent et se redimensionnent vraiment. Proposer un
  déplacement libre sur la piste vidéo aurait menti sur le montage.
- Découpe à la tête de lecture, **magnétisme** (`buildTimelineSnapPoints` +
  `snapTimeToPoints`, avec annonce du point atteint), **zoom** 4 → 480 px/s recadré
  automatiquement tant que personne n'a touché aux commandes, **playhead 60 fps** écrit
  directement dans le DOM via `playheadClock`. Interactions en pointer events et
  **commit au relâchement** : rien n'est écrit dans le store avant le `pointerup`.
- **Inspecteur contextuel** : mouvement avec le **curseur d'intensité continu** annoncé par
  L3 (les trois crans nommés restent à la création guidée), transformation (rotation
  0/90/180/270, rendue des deux côtés), vitesse, colorimétrie (six réglages pris dans les
  quinze clés que l'aperçu et `eq`/`colorbalance`/`vignette`/`noise` partagent), son du clip.
  Les textes sont délégués à `TextInspector`, les musiques à un panneau dédié.
- **La vitesse est le cas limite de la règle de parité** : l'aperçu la joue, le renderer
  serveur non (`clipSpeeds: [1]`). Elle porte donc son badge « Aperçu uniquement », et le
  **pré-vol de l'export la refuse explicitement** au lieu de rendre autre chose en silence.
  Le smoke vérifie les deux.
- **Export professionnel** : cadence Auto / 24 / 25 / 30 / 50 / 60, qualité Brouillon / Pro /
  Master, pré-vol réel du contrôleur d'export existant.
- **Un seul `PlaybackEngine` pour les trois modes** (constat n° 8 de `plan.md` § 2). Il était
  créé puis détruit par écran : tous les médias, décodage vidéo compris, se rechargeaient à
  chaque changement de mode. `preview/PreviewEngineHost.jsx` porte désormais moteur et canvas
  **au-dessus des routes**, dans `VibeCutShell` ; `PreviewStage` ne crée plus rien et déclare
  seulement **où** le canvas vient se poser. Le canvas est un **singleton de module déplacé**
  d'un écran à l'autre : un portail React n'aurait pas convenu, changer de conteneur démonte
  les enfants et en remonte de nouveaux — donc un canvas neuf à chaque navigation, exactement
  ce qu'on voulait éviter.
- **Gate** : `scripts/smoke-vibecut-advanced-v2.spec.cjs`, 11 tests, intégré à
  `test:vibecut-ui-v2` (13 → 24 tests navigateur). Il porte les assertions de l'ancien
  `smoke-video-ui.spec.cjs` sur les nouveaux testids (ordre et `data-track-order` des sept
  pistes, bascules par leur libellé d'accessibilité, rognage à la poignée puis annuler /
  rétablir, glissement et nudge clavier de la tête de lecture, découpe, zoom, magnétisme,
  volume, colorimétrie matérialisée par un élément sur la piste Effets, export), et y ajoute
  le responsive à 390 px et la **preuve** du moteur unique : le canvas est marqué sur
  `/video/rapide`, on navigue **côté client** jusqu'à `/video/avance`, la marque doit avoir
  survécu.
- `scripts/audit-scope.mjs` verrouille la surface : route plus placeholder, `PreviewStage`
  sans `new PlaybackEngine`, shell montant le fournisseur, adaptateur passant bien par
  `buildTimelineModel`, et suite v2 exécutant le nouveau smoke.

### Phase 4 · audit d'usage réel et reprise (2026-07-31)

Le porteur du projet a essayé le montage avancé et n'a **pas trouvé comment poser une
transition**, et a constaté que **« la colorimétrie ne se voit pas sur l'aperçu »**.
Un audit piloté au navigateur — on importe, on clique, et surtout on **mesure les pixels
du canvas** au lieu de croire le code — a confirmé les deux, et en a trouvé deux autres.
Les 24 tests de la phase 4 passaient pourtant : ils vérifiaient que chaque action
**écrit dans le modèle**, jamais qu'elle **se voit**.

| # | Constat mesuré | Correctif |
|---|---|---|
| 29 | **Aucun moyen d'ajouter une transition.** La piste Transitions existait, `applyTransition` existait dans `useScenes`, mais aucun contrôle ne les reliait : la piste restait « — » à vie. L'accueil promet pourtant des transitions. | Section **« Transition vers le plan N+1 »** dans l'inspecteur du clip, comme dans le montage rapide et par la **même** action `applyTransition`. Les 15 transitions exportables d'abord, les autres sous un intertitre « Aperçu uniquement ». Durée, retour à la coupe franche, « Appliquer à toutes les coupes ». Pas de section sur le dernier plan : il n'a pas de suivant. |
| 30 | **Sélectionner un clip ne déplaçait pas la tête de lecture.** Mesure : l'aperçu reste sur le plan 1 (rouge, `r=252`) alors qu'on règle le plan 3 (bleu). Le réglage s'appliquait, rien ne le montrait — c'est **exactement** le « ça ne se voit pas ». La bibliothèque de médias, elle, déplaçait bien le curseur : les deux chemins se contredisaient. | `selectItem(item, { seek: true })` amène la tête de lecture **dans** l'élément, seulement si elle n'y est pas déjà — sinon chaque clic reperdrait la position de travail. Vérifié par mesure : `{r:252,g:0,b:0}` → `{r:0,g:0,b:253}`. |
| 31 | **Cliquer un élément de la piste Effets vidait l'inspecteur.** `selectItem` recevait un type `effect` qu'il ne connaissait pas et mettait **toutes** les sélections à `null` : l'élément « Colorimétrie du clip 1 » se comportait comme un élément mort. | Un élément d'effet **est** la colorimétrie d'un clip : il renvoie vers son clip (`params.clipId`). |
| 32 | **Curseur d'intensité désactivé sans le moindre signe visuel** (`opacity: 1`, plein, à 100 %) tant qu'aucun mouvement n'est choisi : il avait l'air réglable et ne répondait pas. | `:disabled` en opacité 0,4 + `cursor: not-allowed`, et la note devient « Choisis d'abord un mouvement ». |
| 33 | **Timeline haute de 322 px en dur** : sur une fenêtre de 720 px, l'aperçu tombait à ~250 px, un timbre-poste au milieu du noir. | `clamp(232px, 42dvh, 322px)` — plancher pour garder les sept pistes atteignables, plafond pour ne rien changer sur grand écran. |

**Ce que l'audit a écarté**, pour ne pas corriger ce qui marche :
- la colorimétrie **est** bien rendue par l'aperçu (saturation 0 → saturation mesurée
  0,995 → 0 ; exposition +100 → 63/255 d'écart) — le défaut n'était pas le rendu mais
  le fait de régler un plan hors champ ;
- la rotation est bien appliquée (218/255 d'écart mesuré) ;
- **aucune boucle de rendu** au repos (0 dessin en 3 s après édition, mesuré en
  instrumentant `drawImage`) ;
- zéro erreur console sur tout le parcours.

**Gate** : 3 tests ajoutés à `smoke-vibecut-advanced-v2.spec.cjs` (14 tests), suite v2 à
**27 tests navigateur**. Ils ancrent le *visible*, pas seulement l'écrit : la tête de
lecture entre bien dans l'élément choisi et **n'y resaute pas** au second clic, la piste
Effets renvoie vers son clip, une transition se pose / se dose / s'applique partout /
se retire, et le dernier plan n'offre pas de transition.

### Phase 4 · Timeline V2 — la timeline d'un outil de montage (2026-07-31)

Constat du porteur après essai : « j'ai essayé de mettre des transitions mais y a
des chevauchements pas terrible », et « on ne sait pas qui est quoi » dans le
panneau de droite.

**Diagnostic mesuré sur ses captures.** Trois photos de 4,00 s, un fondu de
1,41 s, total 10,59 s (= 12 − 1,41 ✓). Le modèle applique donc la vraie
convention de montage — `cursor += durée − overlap` — et fait bien se
**chevaucher** les deux plans. L'ancienne vue, elle, dessinait chaque élément en
absolu avec un fond opaque : le plan 2 **recouvrait** la queue du plan 1, qui se
lisait donc **2,6 s à l'écran pendant que l'inspecteur annonçait 4,00 s**. Le
modèle avait raison ; c'est l'affichage qui mentait.

**Ce que font réellement DaVinci Resolve et Premiere Pro** (vérifié, pas supposé) :
une transition se dessine **sur la piste vidéo, à cheval sur la coupe** — jamais
sur une piste séparée ; la colorimétrie est un **attribut du plan** signalé par un
badge ; le son d'un plan est **attaché au plan**. L'intuition de départ (« que les
transitions aillent dans la ligne transition ») allait donc à l'inverse des
outils pros, pour une raison de fond : **une transition n'existe pas
indépendamment d'une coupe**.

| Avant | Après |
|---|---|
| 7 rangées, dont 3 qui ne sont pas des pistes | **4 rangées réelles** — Vidéo, Texte, Musique, et Volets seulement s'il y en a |
| Transition sur une piste séparée, déconnectée de sa coupe | **Pastille à cheval sur la jointure**, sur la piste vidéo |
| Plans opaques qui se recouvrent | Plans **jointifs au milieu de la transition** : la largeur dessinée redevient vraie |
| Colorimétrie = un bloc sur une piste « Effets » | **Badge sur le plan**, qui sélectionne le plan **et** ouvre son réglage |
| Son des plans = une rangée à part | **Forme d'onde attachée** sous le plan (A/V liés) |
| Une transition pouvait dévorer 100 % d'un plan | **Plafond à 45 %**, avec la raison affichée |
| « Transition vers le plan 2 », ordre flottant | **« Transition »**, ordre fixe image → cadre → temps → couleur → coupe → son, un sous-titre par section |
| En-tête « IMG_0161 », sans dire quel objet | **« PLAN VIDÉO » puis le nom** |

- **Le modèle canonique n'est pas touché** : `timelineModel.js` garde ses sept
  pistes, contrat d'export et ancien front intacts. Tout le repliement est une
  projection d'affichage, `buildDisplayLanes` dans `adapters/useTimeline.js`.
- **Rien n'est perdu au repliement** : masquer les transitions, contourner la
  colorimétrie et couper le son des plans restent pilotables depuis la barre
  d'outils — un bouton mort serait interdit (`plan.md` § 4.2). Le smoke vérifie
  que masquer les transitions les masque **vraiment**.
- **Un seul chemin d'écriture** : la pastille tirée à la souris et l'inspecteur
  appellent tous deux `sceneActions.applyTransition`.
- **Le plafond des 45 % réutilise `MAX_TRANSITION_SHARE`** de `styleRecipes.js` —
  la constante des presets guidés, pas une copie : une seule règle dans tout le
  produit. `audit-scope.mjs` échoue si une copie réapparaît.
- **Mesures après coup** : plan de 4 s dessiné 4,00 s (352 px à 88 px/s) ; poser
  un fondu retire **3 %** de largeur au lieu de 35 % ; plafond effectif 1,80 s
  sur des plans de 4 s ; aperçu passé de **35 % à 45 %** de la hauteur ; zéro
  erreur console.

**Bugs trouvés pendant cette réécriture :**

29. **`fromItemId` vit dans `params`**, pas à la racine de l'élément de modèle.
    La pastille de transition ne s'affichait donc pas du tout. Trouvé par le test,
    pas par la relecture.
30. **Une photo affichait un badge « son » et une forme d'onde** — une photo n'a
    pas de son. Vu à l'écran, sur la capture.
31. **`setPointerCapture` lève** si le pointeur n'est plus actif ; une exception
    dans un handler `pointerdown` interrompt l'interaction entière. Capture et
    libération passent par un helper qui n'explose pas.
32. **Masquer une piste repliée ne la masquait pas** : la bascule aurait été un
    bouton mort. La projection respecte désormais `visible`.

**Gate** : `smoke-vibecut-advanced-v2.spec.cjs` passe à **15 tests**, suite v2 à
**28 tests navigateur**. Les 4 tests qui décrivaient les 7 rangées ont été
**réécrits à couverture égale**, pas supprimés : ordre des rangées d'affichage +
absence des fausses pistes, bascules par `aria-pressed`, commandes repliées
réellement effectives, et le badge qui ouvre le réglage qu'il annonce.

### Phase 3b · L4 — Cartes de preset sur les miniatures réelles (2026-08-01)
- **`guided/PresetFilmstrip.jsx`** : trois panneaux tirés des **vraies photos du
  projet**, teintés par le look du preset, enchaînés par sa **vraie** transition à
  son **vrai** tempo (`getStyleTempo`).
- **Trois panneaux et pas deux, pour une raison** : une partition (L2) a une
  séquence *et* des accents. Avec deux plans, « Mixed media » (balayage, poussée,
  coupe) et « Reel dynamique » (coupe sèche) auraient montré la même unique
  jointure — on n'aurait rien gagné sur la phase 3.
- **Le repli n'a pas disparu** : tant qu'aucune miniature n'existe — l'extraction
  est asynchrone, et on peut revenir à l'étape 2 avant qu'elle finisse — la carte
  rend la vignette SVG de la phase 3. Une carte vide aurait été un mensonge de
  plus qu'une illustration générique.
- Cartes portées à 200 px, grille 1 → 2 → 3 colonnes. Le décalage de boucle par
  carte est conservé, mais posé **en ligne** : un `animation-delay` isolé dans la
  feuille aurait été annulé par tout raccourci `animation` déclaré plus bas
  (piège connu, `plan.md` § 4.7).
- **Gate** : 2 tests navigateur. Le cas nominal (3 panneaux, sources mesurées,
  décalage entre cartes vérifié) **et** le repli (on retire le dernier média, la
  carte doit retomber sur le SVG et pas se vider).

### Phase 3b · L5 — Partition visible, titre et musique habillés (2026-08-01)
- **`guided/BeatStrip.jsx`** : chaque plan est un bloc dont la **largeur est sa
  durée**, chaque coupe minutée une jointure posée à cheval. La géométrie vient de
  **`buildBeatStrip()`**, fonction pure de `styleRecipes.js` — donc testable sans
  navigateur, comme tout ce module.
- **Motif** : l'étape 3 annonçait « 2,72 à 4,57 s ». Deux presets de forme opposée
  peuvent afficher le même intervalle : « Récit », dont les plans raccourcissent,
  ne se distinguait donc pas de « Reel dynamique », dont ils alternent. La partition
  du lot L2 existait dans le modèle et restait invisible à l'écran.
- La pellicule est présente **trois fois** : sur le plan complet à l'étape 3, en
  version compacte sur **chaque carte de rythme** (on voit la compression sans
  changer d'écran), et à l'étape Finaliser — où elle est **relue du montage
  appliqué**, pas du plan espéré.
- **Problème H fermé.** `titleStyle` et `audioProfile` étaient portés par le modèle
  depuis L2 sans être appliqués : un preset annonçait un traitement de titre qui ne
  changeait rien. Trois résolveurs purs le traduisent désormais —
  `resolveTitleOverlayStyle`, `applyTitleCasing`, `resolveAudioProfile`.
- **Règle de parité tenue ici aussi** : on ne traduit un preset qu'en propriétés
  que l'aperçu **et** le renderer rendent tous les deux — taille/position/gras
  (`drawtext`), `boxStyle` (`SERVER_RENDER_CAPABILITIES.textStyles`), fondus
  (`audioFades`). La **casse** porte sur le *contenu*, donc le renderer reçoit
  exactement la chaîne affichée : parité par construction.
- **La mise en capitales reste réversible.** Le champ de l'étape 4 porte le texte
  **brut**, le montage porte le texte habillé. Sans ça, passer d'un preset en
  capitales à un preset sans casse n'aurait jamais pu retrouver la casse d'origine.
- Changer de preset **re-style le titre déjà posé** : sinon `titleStyle` n'aurait
  été appliqué qu'au premier ajout — une demi-mesure de plus, alors que le
  problème H portait précisément sur un réglage déclaré et jamais appliqué.
- **Gate** : 2 tests navigateur. La partition se voit et changer de rythme la
  **comprime sans la déformer** (les parts sont conservées à 0,6 % près) ; et le
  preset habille vraiment le titre — « mon titre » devient « MON TITRE » sous
  « Reel dynamique », puis redevient « mon titre » sous « Cinéma ».

### Phase 5 — Bibliothèques (2026-08-01)
- **`/video/transitions`** : les 38 entrées du catalogue, groupées par famille,
  chacune avec un **aperçu A/B animé entre deux scènes réelles du projet**. Badge
  de compatibilité **lu** de `getServerRenderCapabilityStatus` — 15 « Export Pro »,
  23 « Aperçu uniquement ». Durée bornée par le plafond des 45 %, application à une
  coupe ou à toutes.
- **`/video/mouvements`** : les 13 entrées, éditeur de trajectoire départ →
  arrivée, intensité, vitesse (= durée du plan), courbe d'accélération, application
  à une photo ou à toutes. Les 7 mouvements `planned` restent listés, marqués
  « Bientôt », et **n'offrent aucun réglage** — un curseur mort sur « Orbite »
  aurait rejoué le défaut n° 32 de l'audit de la phase 4.
- **Décision structurante : les aperçus sont dessinés par LE MOTEUR.**
  `renderTransition` a été **exportée** de `VideoEngine.js` (aucun changement de
  comportement, seule la visibilité du symbole change) et `MotionPreview` appelle
  `mediaModel.applyImageMotionTransform`. Une carte de bibliothèque montre donc la
  transition, pas une imitation CSS de la transition — et les tests de parité L1 et
  L3 la couvrent gratuitement. **Une imitation CSS n'aurait été couverte par rien.**
- **Une seule horloge** (`library/previewTicker.js`) sert toutes les vignettes,
  plus un `IntersectionObserver` par carte : une `requestAnimationFrame` par carte
  aurait ouvert quarante boucles concurrentes sur un écran de catalogue, et une
  bibliothèque qui défile n'a pas à payer le rendu de ce qui est hors champ.
- **Deux limites assumées, et dites à l'écran plutôt que masquées** :
  1. la **courbe linéaire** est affichée **désactivée**. Le renderer écrit
     `smoothstep` en dur (L3) : la proposer avec un simple badge aurait créé une
     dette de parité de plus, exactement ce que L1 à L3 ont mis trois sessions à
     résorber. Le manifeste ne déclare qu'une courbe, et le gate échouera le jour
     où il en déclarera deux — ce qui rappellera d'activer le contrôle ;
  2. l'éditeur de trajectoire **fait respecter** `|x| ≤ (zoom − 1) / 2`
     (**problème I**) au lieu de le documenter. On ne peut donc pas construire ici
     un mouvement qui divergerait entre aperçu et export.
- **Gates** : `smoke-vibecut-library-parity.mjs` (sans navigateur) +
  `smoke-vibecut-library-v2.spec.cjs` (**9 tests**). Suite v2 portée à
  **41 tests navigateur**. `audit-scope.mjs` verrouille la surface : routes plus
  placeholder, aperçus branchés sur le moteur, horloge partagée, aucun accès direct
  au store.
- **Le gate de parité a trouvé quelque chose dès sa première exécution** : la table
  `xfade` compte **seize** clés pour **quinze** transitions visibles — `fade` est
  l'alias historique de `crossfade`. Il est désormais **déclaré** comme tel dans le
  test, pas contourné : un futur alias ajouté sans être déclaré fera échouer le gate.

### Phase 3b · L6 — DÉPLOYÉ (2026-08-01)

**Le rollout a eu lieu.** La production rend enfin ce que l'aperçu montre.

| | Avant | Après |
|---|---|---|
| Image déployée | `telemetry-20260609` (9 juin) | `l6-af59e70-20260801` |
| Révision | `00006-6fw` (l'ancienne `00005-vf2` reste disponible pour un retour arrière immédiat) | |
| Transitions rendues à l'export | 1 (fondu simple) | **15** |
| Mouvement photo | linéaire | **`smoothstep` + intensité**, à l'identique de l'aperçu |
| Texte | sans fond ni multiligne | **fond, contour, multiligne** |
| Audio | sans fondus | **`fadeIn` / `fadeOut`** |

**Vérifié après coup, sur la production :**
- `check-vibecut-renderer-image-capabilities` avec l'URL réelle → **15/15 cibles `xfade`**, `errorCount: 0`
- `/health` → 200
- `/render` sans signature → **401** (la protection HMAC tient)
- `/capabilities` → ne renvoie **ni** `ffmpeg` **ni** `errors` (problème J respecté en conditions réelles)

**Coût** : un seul build Cloud Build (2 min 18 s), un seul déploiement. Aucune
machine ajoutée — la configuration (2 vCPU, 2 Gio, 2 instances max) est identique
à l'ancienne.

**Retour arrière si besoin, en une commande :**
```bash
gcloud run services update-traffic vibecut-render-service \
  --region europe-west9 --project vibefx-v2 --to-revisions vibecut-render-service-00005-vf2=100
```

#### Ce qui a mené à ce rollout (2026-08-01)
- Le pré-vol « `ffmpeg -h filter=xfade` **dans l'image déployée** » était jusqu'ici
  une étape **manuelle** de la feuille de route. Il devient un point de contrôle
  interrogeable : le renderer expose **`GET /capabilities`**, qui interroge FFmpeg
  dans l'image qui tourne et répond `ok: false` + la liste des cibles manquantes.
  Lecture seule, aucun rendu, aucun coût de calcul.
- **`scripts/check-vibecut-renderer-image-capabilities.mjs`** le pilote :
  sans variable il vérifie le FFmpeg **local** (à lancer *avant* le rollout — si les
  cibles manquent déjà là, inutile de payer un build) ; avec
  `VIBECUT_RENDERER_URL=…` il interroge le service **déployé** (à lancer *après*).
- **Vérifié localement le 2026-08-01** : **15/15** cibles présentes (FFmpeg 6.0).
- **Le rollout n'a pas été exécuté.** Il engage Cloud Build / Artifact Registry et
  relève d'une décision du porteur du projet (`AGENTS.md` § discipline de
  déploiement). Tant qu'il n'a pas eu lieu, la production rend encore un fondu
  simple et un mouvement linéaire — problème E, toujours ouvert.

### Phase 7 — Bascule et nettoyage (2026-08-01)

**Il n'y a plus qu'une seule interface VibeCut.**

- **`/studio?workspace=video` redirige vers `/video`**, côté **serveur**
  (`src/app/studio/page.js`) et non depuis un composant client : un lien ou un
  favori existant n'affiche jamais une page vide le temps qu'un composant décide
  de naviguer. `video` a quitté la liste des workspaces du studio, et
  `VibeFxStudio.jsx` ne monte plus d'éditeur vidéo.
- **Supprimé — 10 036 lignes** : `VideoApp.jsx`, `video/VideoEditor.jsx`, les
  **12 panneaux**, les **5** fichiers de timeline, les **2** d'aperçu,
  `vibecut-premium.css`, `guidedTemplates.js`, `storyboardLibrary.js`,
  `quickTools.js`, plus `smoke-video-ui.spec.cjs`,
  `smoke-vibecut-quick-tools.spec.cjs` et deux scripts de correctif orphelins.
- **Ce qui reste dans `vibefx-studio/video/` est exactement ce dont le nouveau
  front dépend** : modèles, moteurs, export, store, persistance, `musicRights`,
  `musicCatalog` (la bande-son du studio s'en sert), `audioWaveform`. Plus une
  seule ligne d'interface.

**Le vrai travail de cette phase : ne rien perdre en supprimant.**

L'ancien panneau d'export portait trois comportements que le nouveau front
n'avait **pas**. Les supprimer avec lui aurait été une perte de fonction
silencieuse — le genre de régression qu'aucun test n'aurait signalée parce que
plus rien ne l'aurait testée.

| Fonction | Pourquoi elle compte | Où elle vit maintenant |
|---|---|---|
| Enregistrer dans un **dossier du PC** (File System Access API) + mémorisation | Sans elle, tout export atterrit dans « Téléchargements » | `export/exportDownload.js` |
| Nom de fichier **horodaté** | Sans lui, deux exports du même projet portent le même nom et le second **écrase** le premier | idem |
| Régénération d'URL signée **par Storage** avant la callable | Évite un aller-retour serveur quand le chemin suffit | idem |

Elles sont **déplacées dans la couche export** — c'est de la logique, pas du
rendu, elle n'aurait jamais dû vivre dans un panneau. Les deux feuilles d'export
du nouveau front les utilisent via `adapters/useExportDownload.js`, et le bouton
« Enregistrer dans un dossier » n'apparaît **que** si le navigateur sait le faire
(un bouton mort serait interdit, `plan.md` § 4.2).

**Un quatrième oubli, trouvé en démontant le panneau** :
`resolveOutputMediaMetadata` se retrouvait **importé par le contrôleur sans être
appelé nulle part**. Autrement dit, depuis la construction du nouveau front,
l'interface annonçait « MP4 » sans jamais relire ce que le rendu avait vraiment
produit — et une simulation locale se serait annoncée comme un vrai fichier. Les
deux feuilles affichent désormais conteneur / codec / MIME **lus du job**
(`adapters/useExportOutputMeta.js`).

- Le passage **bande-son → vidéo** navigue vers `/video/rapide` par
  `router.push`, donc **côté client** : le module Zustand survit et la piste
  qu'on vient d'ajouter au store est bien là à l'arrivée. Un rechargement complet
  de la page l'aurait perdue.

**Gate** : `audit-scope.mjs` vérifie **les deux moitiés** de la bascule — que la
redirection existe *et* que les fichiers sont bien partis. L'une sans l'autre
laisserait soit un lien mort, soit du code mort ; et un fichier resté sur le
disque ferait croire le nettoyage fait. Il vérifie aussi que les quatre
comportements sauvés sont toujours présents. Plus un test navigateur qui suit la
redirection jusqu'à son **URL finale** (et non un contenu qui pourrait venir
d'une navigation cliente). Suite portée à **43 tests navigateur**.

### Extractions préparatoires (déplacements purs, aucun changement de comportement)
| Avant | Après | Compatibilité |
|---|---|---|
| `panels/ExportVideoPanel.jsx` (1857 l) | `export/useExportController.js` + panneau | le panneau ré-exporte, `VideoApp.jsx` inchangé |
| `preview/VideoPreview.jsx` | `engine/textOverlayRenderer.js` | `VideoPreview` ré-exporte |

Les smokes qui lisaient le source du panneau (`smoke-vibecut-export-jobs`, `audit-vibecut-export-hardening-requirements`) lisent désormais contrôleur **et** panneau.

### Extensions moteur livrées (parité navigateur ↔ serveur)
- Texte : multiligne, fond (`box=1`), contour (`borderw`), `line_spacing`.
- Audio : `trimStart` (départ dans le morceau), `fadeIn` / `fadeOut` (`afade`).
- `SERVER_RENDER_CAPABILITIES` déclare `textStyles` et `audioFades`.
- Filtres FFmpeg **validés localement par un rendu MP4 réel**.

---

## Bugs trouvés et corrigés en route

1. **Reset CSS trop spécifique** — `.vibecut button` (0,1,1) écrasait les CSS Modules (0,1,0) : aucun bouton primaire n'avait son fond accent. Resets passés en `:where()`.
2. **Rechargement du projet en pleine édition** — l'ancrage de l'URL par la sauvegarde auto relançait un chargement IndexedDB 1,2 s après la première modification : lecture remise à zéro. L'identifiant est désormais figé au montage.
3. **Playhead saccadé** — le curseur suivait les ~11 écritures/seconde du store. Découplé (`playheadClock`) + interpolation 60 fps recalée en continu : 6,5 → 48,5 mises à jour/s.
4. **Musique cassait l'export** — `rightsStatus: 'user-provided'` n'existe pas → 6 blocages de droits. Remplacé par une déclaration explicite.
5. **Texte invisible à l'édition** — ajouter un titre laissait la tête de lecture en plein fondu d'entrée. Elle se place maintenant au milieu du texte.
6. **Section repliée cliquable** — `display: flex` écrasait l'attribut `hidden`.
7. **`aspect-ratio` inopérant** sur les vignettes (span inline).
8. **Repères de centrage invisibles** — traits trop fins une fois le canvas réduit en CSS.
9. **Libellés « Annuler » en double** — collision entre le bouton d'historique et celui de la feuille d'export.
10. **`saveNow()` n'ancrait pas l'URL** alors que la sauvegarde automatique le faisait. L'appeler juste avant
    elle lui volait la création du projet : le lien de sortie du parcours guidé restait sans `?project=`
    alors que le projet existait. Les deux chemins ancrent désormais l'URL de la même façon.
11. **Bouton imbriqué dans un bouton** — la primitive `Collapsible` rendait son `value` **à l'intérieur** du
    bouton de repli. HTML invalide, signalé par le navigateur, et surtout : cliquer « Appliquer à toutes »
    dans le montage rapide repliait aussi la section. Le `value` est maintenant rendu à côté du bouton.
    Détecté par la nouvelle assertion « zéro erreur console » du smoke guidé.
12. **Panneau qui gardait son défilement** en changeant d'étape : on arrivait au milieu de l'écran suivant,
    sa question déjà hors champ. Le panneau revient en haut à chaque étape, et le test le vérifie
    (`toBeInViewport` sur le titre de l'étape).
13. **`prefers-reduced-motion` ne neutralisait pas les délais**. Les entrées en cascade utilisent
    `animation-fill-mode: both` : un délai qui survit laisse le contenu **invisible** pendant sa durée —
    exactement l'inverse du but. `animation-delay` et `transition-delay` sont désormais remis à 0 avec
    les durées, dans `vibecut.css`.
14. **« Failed to load resource » sans URL** dans l'assertion console du smoke guidé : un 403 Firebase
    intermittent passait le filtre et faisait échouer le test au hasard. Le message porte maintenant
    l'URL, donc le filtre peut faire son travail.
15. **Conflit de cascade sur le second plan des vignettes de mouvement.** Ce plan porte deux classes,
    `.motionArt` et `.styleArtB`, de spécificité égale ; `.motionArt` étant déclarée plus bas, son
    raccourci `animation` annulait le fondu, et le plan restait à `opacity: 0`. « Doux » et « Varié »
    se seraient donc animées exactement pareil — le défaut qu'on venait de corriger. Résolu par une
    règle `.motionArt.styleArtB` de spécificité supérieure.
16. **Décalages de boucle annulés par les raccourcis `animation`.** Un `animation-delay` isolé est remis
    à zéro par tout raccourci `animation` déclaré après lui : le bloc de décalage doit rester le
    **dernier** du fichier. Vérifié dans le navigateur, pas seulement à la lecture.

17. **`xfade` progresse linéairement, le moteur non.** `renderTransition` appliquait un
    `easeInOut` à *toutes* les transitions, y compris au simple fondu enchaîné — le plus
    utilisé de tous. L'aperçu et l'export n'étaient donc pas en phase depuis l'origine,
    sur la transition la plus courante. Corrigé : les transitions exportables sont
    routées avant l'`easeInOut`.
18. **Les fondus par couleur ne sont pas symétriques.** Une implémentation « intuitive »
    (poids symétriques autour du milieu) donnait 19/255 d'écart. La mesure réelle — rendre
    `xfade` avec un plan rouge pur et un plan vert pur, le canal rouge donnant le poids du
    plan sortant et le vert celui de l'entrant — montre que le sortant s'éteint sur les
    **20 premiers pour cent** et que l'entrant remonte sur tout le reste. Les courbes
    relevées sont stockées telles quelles : écart ramené sous **1/255**.
19. **`addColorStop` refuse un offset hors [0,1].** Les masques de balayage débordent
    volontairement du cadre (c'est ce qui fait sortir le bord adouci de l'image en fin de
    transition) : leurs offsets doivent être bornés **et rendus monotones** à l'ajout,
    sinon le dégradé lève une exception ou s'inverse.

20. **Le rythme ne pouvait plus appartenir au preset.** Chaque style portait un
    `recipe.rhythm` que choisir un style réécrivait. Avec la formule
    `beatBase(rythme) × beatPattern(preset)`, les deux réglages sont orthogonaux :
    changer de preset ne doit plus écraser un rythme déjà choisi. Corrigé dans
    `GuidedFlow.handleStyleChange`, et le test navigateur le vérifie.
21. **Le plan appliqué devait connaître les scènes.** Il était volontairement calculé
    « à vide » pour éviter la boucle *appliquer → les durées changent → le plan change →
    appliquer*. Impossible désormais : la durée dépend de la **place** du plan dans le
    montage. Ce n'est pas une boucle pour autant, parce que `buildMontagePlan` ne **lit**
    jamais la durée d'une photo — il la **produit**. Le garde reste sur les identifiants
    de scènes.
22. **Arrondi et cohérence des durées.** La durée estimée se calculait sur les durées non
    arrondies, alors que ce sont les durées arrondies au centième qui sont écrites dans le
    projet. Un écart de 0,01 s en découlait. La somme part maintenant des valeurs
    réellement appliquées.

---

23. **Le décalage de panoramique n'était pas divisé par le zoom** — troisième écart de
    parité du mouvement, jamais relevé jusqu'ici. L'aperçu translate l'image **après**
    l'avoir agrandie, son décalage vaut donc `x/zoom` en coordonnées source ; le renderer
    écrivait `-(x)*iw`. Les panoramiques voyageaient **~11 % trop loin à l'export**
    (zoom 1,12). Corrigé en `-(x)*iw/zoom`. Il n'a été vu que parce que le test de parité
    compare des images : aucune relecture de code ne l'avait attrapé en trois lots.
24. **Les intensités des presets ne tombaient pas sur les crans affichables.** Deux presets
    portaient 0,55 et 0,9, valeurs qu'aucune des trois cartes ne peut représenter : la carte
    sélectionnée aurait annoncé autre chose que ce que le montage applique. Les six presets
    sont recalés sur 0,4 / 0,7 / 1, et le smoke échoue si une valeur intermédiaire revient.
25. **Un test de parité peut être aveugle sans le dire.** Aux amplitudes des presets, l'écart
    entre courbe lissée et courbe linéaire vaut ~2 px, **moins que le bruit de
    rééchantillonnage** (~7/255). Le premier jet du test déclarait « ok » sur un renderer
    resté linéaire. Corrigé par un cas à **course amplifiée** (même chemin de code, cinq fois
    la course) et par une assertion sentinelle explicite.

26. **Masquage d'aperçu perdu dans la cascade — trouvé à l'écran.** En état vide, le montage
    avancé masque l'aperçu avec `.stageHidden`, mais `.stage` vient d'un **autre module CSS**
    et l'ordre d'injection des modules n'est pas garanti : à spécificité égale, le masquage
    pouvait perdre. Résolu par une double classe `.stageHidden.stageHidden` (0,2,0).
27. **Bouton injoignable en 390 px.** « Afficher tout le montage » sortait du cadre de la
    barre de timeline, elle-même dans un conteneur `overflow: hidden` : un bouton mort, donc.
    La barre devient défilante et le total de durée — déjà lisible sur la réglette — est
    masqué sous 720 px. Le smoke mesure désormais que le bouton tient dans la fenêtre.
28. **Changer de mouvement gardait l'ancien.** L'inspecteur étalait le mouvement courant
    (`{...motion, preset}`), donc `start` et `end` survivaient au changement de preset : la
    photo aurait continué de zoomer alors que l'interface annonçait « Fixe ». On ne transmet
    plus que `preset`, `easing` et `intensity`, et `normalizeImageMotion` reprend les cadrages
    du preset. Le smoke le vérifie par `aria-pressed`.

---

33. **Appliquer depuis une bibliothèque puis repartir perdait l'édition.** La
    sauvegarde automatique est debouncée à 1,2 s, et une bibliothèque est
    précisément l'écran où l'on applique **puis où l'on part aussitôt** : revenir
    au montage juste après avoir posé une transition la trouvait absente. Les deux
    bibliothèques appellent maintenant `saveNow()` après chaque application.
    **Trouvé par le test, pas par la relecture** — et c'est exactement la classe de
    défaut que l'audit de la phase 4 avait mise en évidence : l'action écrivait bien
    dans le modèle, elle ne se voyait simplement pas ensuite.
34. **L'étape Finaliser annonçait encore le montage avancé « en construction,
    disponible bientôt »** alors qu'il est livré depuis le 2026-07-31. Vu en relisant
    l'écran, pas signalé par un test : aucune assertion ne portait sur ce texte.
35. **Le garde anti-projet-source s'est attrapé lui-même.** En resserrant la regex du
    problème A, le commentaire qui l'expliquait épelait le nom interdit — et
    `audit-scope.mjs` scanne `scripts/`. Comportement correct du garde ; le
    commentaire ne nomme plus la chose, comme `blocked()` le fait déjà pour le code.
36. **Un `assert.doesNotMatch(/requestAnimationFrame/)` interdisait d'en parler.**
    Le garde de la phase 5 échouait sur les commentaires qui expliquent *pourquoi*
    les aperçus n'ouvrent pas leur propre boucle. Il cherche désormais un **appel**
    (`requestAnimationFrame\s*\(`) : un garde qui interdit de documenter une règle
    est un garde qui la fait oublier.

---

37. **Le nouveau front annonçait « MP4 » sans jamais relire ce que le rendu avait
    produit.** `resolveOutputMediaMetadata` était importé par le contrôleur d'export
    et **appelé nulle part** : c'était l'ancien panneau qui s'en servait, et la
    reconstruction ne l'a jamais rebranché. Une simulation locale se serait donc
    annoncée comme un vrai fichier. Trouvé en démontant le panneau pour la phase 7,
    pas par un test — aucun ne portait dessus.
38. **Trois fonctions d'export allaient disparaître sans bruit avec le panneau
    supprimé** : enregistrement dans un dossier du PC, nom de fichier horodaté,
    régénération d'URL signée par Storage. Aucun test navigateur ne les couvrait
    (elles vivaient dans le front qu'on supprimait) — seuls les smokes qui lisent
    le *source* les protégeaient. C'est ce qui les a sauvées : `audit-scope` et
    `smoke-vibecut-export-jobs` ont échoué à la suppression, au lieu de laisser
    passer la perte. Déplacées dans `export/exportDownload.js`.

---

39. **L'onglet VIBECUT de l'en-tête studio ne faisait plus rien.** Après la
    suppression de l'ancien éditeur, il appelait toujours `setView('video')` — un
    état que plus rien ne rendait. Le clic changeait une variable et l'écran ne
    bougeait pas. **Trouvé à l'usage par le porteur du projet, pas par les 42 tests**
    de la phase 7 : aucun ne cliquait dessus. C'est le bouton mort que `plan.md`
    § 4.2 interdit. L'onglet est devenu un vrai `Link` vers `/video`.
40. **Le lien Backoffice était devenu injoignable.** Il était conditionné à
    `view === 'video' && isAdmin` : la vue ayant disparu, aucun admin n'avait plus
    d'entrée vers le backoffice depuis l'en-tête studio. La condition ne porte plus
    que sur le rôle. Trouvé en cherchant s'il restait d'autres résidus après le
    bug 39 — la bonne réaction à un défaut est de chercher ses frères.

**Leçon de ces deux-là** : supprimer un écran ne suffit pas, il faut supprimer ou
rebrancher **tout ce qui y menait**. Les tests vérifiaient que l'ancienne
adresse redirigeait ; aucun ne cliquait sur ce qui pointait vers l'ancien écran.
Deux tests l'ancrent désormais (l'onglet mène vraiment à `/video`), et
`audit-scope` refuse le retour de `view === 'video'` comme condition de rendu.

---

## Problèmes connus, non résolus

| # | Problème | Nature |
|---|---|---|
| ~~A~~ | ~~`npm run test:scope` échoue sur le mot « jardin » dans un texte immobilier.~~ | ✅ **Résolu le 2026-08-01.** Le garde porte désormais sur le **nom complet** du projet source, séparateurs tolérants. Deux assertions périmées de la même famille sont alignées au passage (Node 20 → 22 ; firebase-functions 6 → 7, firebase-admin 13 → 14), et la cohérence des trois déclarations de version de Node (`.nvmrc`, racine, `functions/`) est maintenant vérifiée. **`npm run test:scope` est vert.** |
| B | `scripts/smoke-vibecut-media-safety.spec.cjs` : 3 échecs. Les captures Playwright montrent « This page couldn't load » → **crash du moteur de rendu** sur les fixtures WebM de 7 Mo. | Préexistant, fichier non commité (WIP d'une session antérieure). |
| C | `npm run test:vibecut-export-local-mp4` échoue : ses fixtures pointent `C:\Users\pcpor\…`. | Environnement (machine Windows d'origine). |
| D | Les `.mp4` de `videotest/` sont des **pointeurs Git LFS de 132 octets**. | Les smokes du nouveau front fabriquent leurs médias avec `ffmpeg-static`. |
| ~~E~~ | ~~Le renderer Cloud Run doit être redéployé pour que les 15 transitions de L1 et la courbe + l'intensité de L3 apparaissent dans les exports serveur.~~ | ✅ **Résolu le 2026-08-01.** Rollout effectué : révision `00006-6fw`, image `l6-af59e70-20260801`. Vérifié sur la production : 15/15 cibles `xfade`, `errorCount: 0`, `/render` toujours protégé (401 sans signature). L'ancienne révision `00005-vf2` reste disponible pour un retour arrière immédiat. **Ce que l'aperçu montre est désormais ce que l'export produit.** |
| F | **`zoom-punch` (`xfade=zoomin`) écarté du vocabulaire.** Les images de référence montrent une magnification extrême jusqu'à un aplat uniforme au milieu du fondu : laid sur photo, et disproportionné à reproduire au canvas. | Décision produit du 2026-07-30. 15 transitions au lieu des 16 prévues. Si un accent de zoom est voulu, il viendra du **mouvement (L3)**, pas d'une transition. |
| ~~H~~ | ~~`titleStyle` et `audioProfile` portés par le modèle mais pas appliqués.~~ | ✅ **Résolu le 2026-08-01 (lot L5).** Trois résolveurs purs les traduisent en propriétés rendues des deux côtés, et changer de preset re-style le titre déjà posé. |
| I | **`zoompan` borne sa fenêtre à l'image, le canvas non.** *(Depuis la phase 5, l'éditeur de trajectoire de `/video/mouvements` fait respecter la condition au lieu de la documenter : on ne peut plus construire un mouvement inexportable depuis l'interface. La contrainte reste à vérifier pour tout ajout au catalogue en phase 6.)* Un mouvement dont la fenêtre sort du cadre diverge franchement entre aperçu et export (74/255 mesurés sur un cas volontairement débordant). La condition à tenir est `\|x\| ≤ (zoom − 1) / 2`. | Les six mouvements livrés la respectent (le plus tendu : `drift-up`, 0,045 pour une limite de 0,05). À vérifier avant tout ajout au catalogue en **phase 6**. Rien à corriger aujourd'hui. |
| J | **`GET /capabilities` du renderer est sans authentification, sur un service Cloud Run public.** Sa réponse ne porte donc **ni la version de FFmpeg ni le texte des erreurs** — seulement `ok`, la révision, les cibles manquantes et un compteur d'erreurs. | **Choix délibéré du 2026-08-01, pas un oubli.** Une bannière de version renseignerait gratuitement quelqu'un qui cherche les CVE de ce build. Le détail va dans les journaux Cloud Run (`gcloud run services logs read vibecut-render-service --region europe-west9 --project vibefx-v2 \| grep capabilities`). Documenté dans `render-service/src/server.js`, `render-service/README.md`, le runbook et verrouillé par `smoke-vibecut-library-parity.mjs`. Si le service passe en Cloud Run privé, la précaution devient facultative. |
| G | Trois écarts de parité **structurels** subsistent, bornés par test : le grain de `film-dissolve` (FFmpeg tire un bruit par pixel), le noyau de flou de `blur-cut`, et `desat-fade` (le `grayscale()` du navigateur utilise Rec.709, FFmpeg Rec.601 → un rouge saturé ressort plus clair à l'export). | Assumés et documentés dans `xfadeTransitions.js`. Les seuils du test servent à détecter une **dérive**, pas à prétendre à l'exactitude. |

---

## Reste à faire

> **Chantier en cours : les deux bibliothèques.**
> Feuille de route complète : **[docs/vibecut-bibliotheques-roadmap-2026-08-02.md](docs/vibecut-bibliotheques-roadmap-2026-08-02.md)**

### Lot B1 — Fondation du design des deux bibliothèques · **prioritaire**

Le lot demandé le 2026-08-02. **Aucun contenu nouveau** : on présente à fond ce
qui existe déjà (38 transitions, 6 mouvements réels + 7 annoncés).

- [ ] Squelette commun : `LibraryScreen`, `LibraryFilterBar`, `LibraryCard`,
      `BeforeAfterStage`, `LibraryContextStrip`, `useFavorites`.
      Les deux écrans ne fournissent plus que leurs **données**.
- [ ] **`BeforeAfterStage`** — le cœur. Deux canvas superposés, le second découpé
      par un **séparateur déplaçable**. Pour une transition : « avant » = la
      **coupe franche**, « après » = la transition. Pour un mouvement :
      « avant » = le plan **fixe**, « après » = le plan animé. On ne montre pas un
      effet, on montre **ce qu'il change**.
- [ ] **Défilement manuel de l'animation** (image par image). Le canvas est déjà
      dessiné à partir d'une progression 0 → 1 : exposer un curseur qui la pilote
      est **gratuit**, et c'est ce qui fait passer la page de « joli » à « on y
      reste ». Plus une bascule « Aperçu en boucle ».
- [ ] **Favoris** persistés en **IndexedDB** (pas `localStorage` : le projet
      stocke déjà tout le reste là), filtre ★, section « Tes favoris » en tête,
      **et rappel dans l'inspecteur du montage avancé** — c'est le besoin exprimé,
      puisqu'il n'y a pas la place d'y afficher des aperçus.
- [ ] Cartes agrandies, cascade à l'entrée, boucle décalée carte par carte,
      survol sobre. Recherche + familles. Responsive 390 px. Clavier.
      `prefers-reduced-motion` arrête la boucle **sans** retirer les commandes.

**Ce qui ne bouge pas** — acquis de la phase 5, verrouillés par `audit-scope` :
les canvas restent dessinés par `renderTransition` et
`applyImageMotionTransform` (jamais imités en CSS), l'horloge reste **unique**,
les badges de parité restent **lus** du manifeste, et les mouvements `planned`
restent listés **sans aucun réglage**.

**Gate B1** — sur le **visible**, pas sur l'écrit (leçon de l'audit de phase 4) :
déplacer le séparateur change réellement les pixels ; « avant » et « après »
diffèrent à la mesure ; le curseur de progression fige et déplace l'animation ;
un favori se retrouve dans le filtre **et dans le montage avancé** ; il survit au
rechargement ; recherche et filtres réduisent la grille ; 390 px sans
débordement ; zéro erreur console.

### Lot B2 — De vraies vidéos dans les aperçus
- [ ] `useLibraryMedia` : vidéos du projet → photos → clips de démo → repli dessiné.
- [ ] 3-4 clips de démo (2 s, 720p, ~1,5 Mo au total, chargés paresseusement).
      **Sources décidées : Mixkit ou Pexels**, téléchargés et compressés par
      l'agent, **validés par le porteur du projet**.
- [ ] ⚠️ **Droits déclarés comme pour la musique** : manifeste versionné avec
      source, licence et URL. Le projet refuse déjà toute piste audio sans
      déclaration ; introduire des médias sans provenance ici serait le laxisme
      qu'on a précisément évité.

### Lot B3 — Le contenu qui manque (ex-phase 6)
- [ ] Les 7 mouvements `planned` : descente, orbite, parallaxe, rotation,
      apparition, rebond, glitch.
- [ ] **Mouvements applicables aux vidéos** (aujourd'hui : photos seulement).
- [ ] **Effets pendant le rush** — c'est là que le retard sur Premiere et DaVinci
      est réel, et le porteur du projet l'a relevé lui-même : secousse, flou
      directionnel animé, fuite de lumière, vignettage animé, grain animé, zoom
      pulsé. **Aucun n'existe aujourd'hui.**
- [ ] Transitions supplémentaires : `xfade` expose **46** cibles natives, **15**
      sont employées. Trier les 31 restantes — toutes ne méritent pas d'exister
      (`zoom-punch` a été écarté après mesure, problème F).
- [ ] **Thèmes éditoriaux** sur les 51 entrées (`Réseaux sociaux`, `Voyage`,
      `Produit`, `Récit`, `Souvenirs`, `Musique`), en plus des familles techniques.
- [ ] **Courbe d'accélération libre** : le contrôle existe déjà, désactivé.
      L'activer demande que le renderer lise `motion.easing` **et** que
      `SERVER_RENDER_CAPABILITIES.imageMotionEasing` déclare la courbe.

**Pour chaque ajout, sans exception** : parité prouvée par MP4 réel comparé image
par image ; `|x| ≤ (zoom − 1) / 2` (problème I) ; un id ajouté dans une seule des
trois tables fait échouer `smoke-vibecut-transition-parity` ; **un seul** rollout
Cloud Run à la fin du lot.

### Reste ouvert sur le montage avancé, volontairement hors MVP
- [ ] **Texte petit en portrait** : le facteur d'échelle vaut `fontSize × largeur/1920`.
      En 9:16 un titre à 64 pt fait 36 px. L'aperçu **et** `drawtext` appliquent la
      **même** formule : la parité est intacte, mais le réglage par défaut est
      petit. Le corriger demande de changer les **deux** côtés et de relancer la
      parité. *Atténué par L5* : les crans de titre partent de 56/80/112 pt.
- [ ] Pas d'inspecteur propre pour la piste Volets (`sequence`).

### Améliorations transverses en attente
- [ ] Rail IA (`StudioAiRail`) en panneau latéral optionnel, derrière `aiInterfacesEnabled`.
- [ ] Thème clair : activer la bascule (tokens déjà écrits).
- [ ] Alignement horizontal des textes (gauche / centre / droite) — demande une
      extension du rendu et de `drawtext`.

---

## Commandes

```bash
npm run dev                     # http://localhost:3000 (ou 3001)
npm run lint
npm run build
npm run test:scope              # isolation — VERT depuis le 2026-08-01
npm run test:vibecut-ui-v2      # recettes + parités + 43 tests navigateur
npm run test:vibecut-recipes    # moteur de recettes seul, sans navigateur
npm run test:vibecut-library    # parité catalogue ↔ moteur ↔ capacités serveur
npm run test:vibecut-export     # chaîne d'export (exit 0 attendu)
npm run test:vibecut-xfade-preview-parity   # aperçu canvas vs FFmpeg, image par image
npm run test:vibecut-motion-parity          # mouvement : MP4 réel vs aperçu

# Pré-vol du lot L6 — aucun déploiement, aucun rendu
node scripts/check-vibecut-renderer-image-capabilities.mjs                 # FFmpeg local
VIBECUT_RENDERER_URL=<url> node scripts/check-vibecut-renderer-image-capabilities.mjs   # image déployée
```

---

## Prompt de relance — lot B1 (fondation du design des deux bibliothèques)

> À copier tel quel dans un nouveau chat.
> **Toute la reconstruction est terminée** (phases 0 à 7, rollout Cloud Run
> inclus, le 2026-08-01). Ce qui suit est le chantier suivant.

```
Tu reprends le développement de VibeCut dans le projet Vibe_fx V2
(/Users/matthis/Desktop/mes projets mac/vibe_fxV2).

AVANT TOUTE CHOSE, lis dans cet ordre :
1. AGENTS.md   — règles de travail, discipline de déploiement et de coûts
2. plan.md     — architecture et DIRECTION ARTISTIQUE (§ 4 en entier : interdits
                 § 4.2, composition § 4.4, mouvement § 4.5, accessibilité § 4.6,
                 pièges techniques § 4.7) et parité § 8
3. docs/vibecut-bibliotheques-roadmap-2026-08-02.md — TA FEUILLE DE ROUTE.
                 Ta mission est le lot B1, décrit en § 6.
4. todo.md     — état exact, bugs 1 à 40, problèmes connus B, C, D, F, G, I, J
5. map.md      — carte du projet

CONTEXTE — l'état réel du produit
Une seule interface VibeCut, sur /video :
  /video, /video/rapide, /video/guide, /video/avance,
  /video/transitions, /video/mouvements
L'ancien front est SUPPRIMÉ ; /studio?workspace=video redirige côté serveur.
La production tourne sur la révision Cloud Run 00006-6fw : les 15 transitions
et le mouvement lissé sont rendus à l'export. L'aperçu ne ment plus.

Gates au vert au 2026-08-01 : lint (0 erreur), build, test:scope,
test:vibecut-ui-v2 (43 tests navigateur), test:vibecut-export, test:video-ui,
lint Functions.

TA MISSION : lot B1 — LA FONDATION DU DESIGN DES DEUX BIBLIOTHÈQUES.

Demande exacte du porteur du projet (2026-08-02) :
« Créer la fondation du design des deux bibliothèques avec les avant/après. On
reste sur le thème OS Apple ultra moderne comme pour les 3 modes, mais cette
fois il faut BLINDER le design : c'est important que ça claque, pour que
l'utilisateur passe du temps à apprécier les animations. La page doit vraiment
donner envie de cliquer et de parcourir. Tu peux les créer avec les animations,
mouvements et transitions DÉJÀ EN PLACE. »

⚠️ AUCUN CONTENU NOUVEAU DANS CE LOT. On présente à fond ce qui existe :
38 transitions (15 exportables, 23 « aperçu uniquement ») et 13 mouvements
(6 réels, 7 marqués « Bientôt »). Ajouter des mouvements ou des effets est le
lot B3, explicitement plus tard.

CE QUI EXISTE DÉJÀ ET QU'IL FAUT REMANIER, PAS JETER
src/features/vibecut/library/ contient déjà TransitionLibrary, MotionLibrary,
TransitionPreview, MotionPreview, previewTicker, useLibraryImages,
library.module.css. Le lot B1 en extrait un squelette commun (LibraryScreen,
LibraryFilterBar, LibraryCard, BeforeAfterStage, LibraryContextStrip,
useFavorites) pour que les deux écrans ne fournissent plus que leurs données.

ACQUIS À NE PAS CASSER — audit-scope les verrouille
- Les vignettes sont DESSINÉES PAR LE MOTEUR : `renderTransition` (exportée de
  VideoEngine.js) et `mediaModel.applyImageMotionTransform`. JAMAIS une
  imitation CSS. C'est ce qui interdit à une carte de mentir sur le rendu, et ce
  qui la fait couvrir gratuitement par les tests de parité L1 et L3.
- UNE SEULE horloge (library/previewTicker.js) pour toutes les vignettes, plus
  un IntersectionObserver par carte. N'ouvre pas de requestAnimationFrame par
  carte : ce serait quarante boucles concurrentes.
- Les badges de compatibilité sont LUS de getServerRenderCapabilityStatus,
  jamais écrits en dur.
- Les mouvements `planned` restent listés, marqués « Bientôt », et n'exposent
  AUCUN réglage (un curseur mort serait le défaut n° 32 de l'audit de phase 4).
- La courbe linéaire reste affichée DÉSACTIVÉE tant que le renderer écrit
  smoothstep en dur.
- L'éditeur de trajectoire FAIT RESPECTER |x| <= (zoom-1)/2 (problème I).
- Les bibliothèques passent par sceneActions (applyTransition, setSceneMotion…),
  jamais par le store, et appellent saveNow() après chaque application
  (l'autosave est debouncée à 1,2 s et on quitte l'écran aussitôt — bug 33).

LE CŒUR DU LOT : BeforeAfterStage
Deux canvas superposés, le second découpé par un SÉPARATEUR DÉPLAÇABLE
(clip-path: inset). Les deux dessinés par le moteur, à la même progression, par
la même horloge.
  - transition : « avant » = LA COUPE FRANCHE, « après » = la transition
  - mouvement  : « avant » = le plan FIXE,     « après » = le plan animé
On ne montre pas un effet, on montre CE QU'IL CHANGE. C'est ce couple qui rend
la page pédagogique.
Plus un CURSEUR DE PROGRESSION qui fait défiler l'animation à la main, image par
image : le canvas est déjà dessiné à partir d'une progression 0 → 1, donc c'est
gratuit — et c'est le détail qui fait passer la page de « joli » à « on y reste ».
Pointer events, et `setPointerCapture` via le helper qui n'explose pas (bug 31).

FAVORIS
Stockés en IndexedDB via services/projectLibrary.js sous une clé dédiée.
PAS localStorage : le projet stocke déjà tout le reste en IndexedDB, deux
stockages feraient deux sources de vérité. Étoile sur chaque carte, filtre ★,
section « Tes favoris » en tête, ET RAPPEL DANS L'INSPECTEUR DU MONTAGE AVANCÉ —
c'est le besoin exprimé : il n'y a pas la place d'y afficher des aperçus.

DESIGN — ce qui doit « claquer », dans l'ordre
1. La TAILLE et la qualité des aperçus. Une vignette de 196 px ne fait pas rêver.
2. Le mouvement permanent, DÉCALÉ carte par carte (la grille respire au lieu de
   battre à l'unisson). Acquis du 2026-07-30, à conserver.
3. L'entrée en cascade au défilement.
4. La réponse au survol : élévation subtile, rien de plus — l'animation joue déjà.
5. Le séparateur : trait fin, poignée ronde, ombre douce. Il doit avoir l'air
   d'un objet physique qu'on attrape.
Le châssis reste DISCRET et laisse les aperçus occuper la place : c'est
exactement la règle de plan.md § 4 (« l'impact visuel est concentré sur le
contenu, jamais sur le châssis »), et ici elle joue en notre faveur.

DISPOSITION : DEUX colonnes, pas trois. Un rail de familles à gauche ferait un
second système de navigation à côté du bandeau VibeCut — interdit (§ 4.4). Les
familles deviennent une barre de filtres horizontale, repliée en menu sous 720 px.

RÈGLES NON NÉGOCIABLES
- Ne propose jamais une fonction que le moteur ne rend pas : « Bientôt », et
  AUCUN réglage dessus.
- Aucun composant de features/vibecut/ n'importe le store ni IndexedDB
  directement : tout passe par features/vibecut/adapters/.
- Zéro Tailwind sur /video. CSS Modules + tokens de styles/vibecut.css.
- Aucun bouton mort. Aucun texte sous 12 px. Pas de néon, pas de glassmorphism
  généralisé, pas de dégradé violet décoratif.
- prefers-reduced-motion arrête la boucle SANS retirer les commandes : le
  séparateur et le curseur restent utilisables.
- NE DÉPLOIE PAS. Ce lot ne touche pas au renderer.

GATE DU LOT — sur le VISIBLE, pas sur l'écrit
La leçon la plus importante du projet : les 24 tests de la phase 4 passaient tous
alors que la colorimétrie « ne se voyait pas » et qu'aucune transition n'était
posable. Ils vérifiaient que l'action ÉCRIT dans le modèle, jamais qu'elle SE
VOIT. Corollaire trouvé en phase 7 : l'onglet VIBECUT du studio était mort et
aucun des 42 tests ne cliquait dessus (bug 39).
Donc, pour B1 :
1. déplacer le séparateur change RÉELLEMENT les pixels affichés (getImageData) ;
2. « avant » et « après » DIFFÈRENT à la mesure ;
3. le curseur de progression fige et déplace l'animation ;
4. un favori se retrouve dans le filtre ET dans le montage avancé ;
5. il survit au rechargement de la page ;
6. recherche et filtres réduisent la grille (comptage), « aucun résultat » dit
   quoi faire ;
7. responsive 390 px sans débordement horizontal ;
8. zéro erreur console ;
9. prefers-reduced-motion : boucle arrêtée, séparateur toujours utilisable.
Plus : lint, build, test:scope, test:vibecut-ui-v2, test:vibecut-library.

RISQUE À SURVEILLER
Quarante canvas animés plus deux canvas d'aperçu peuvent faire ramer la page.
MESURE les images par seconde avant et après. Si nécessaire : n'animer que les
cartes visibles, la carte survolée et la carte sélectionnée. L'horloge unique et
l'IntersectionObserver sont déjà là pour ça.

APRÈS B1 — ne l'anticipe pas
B2 : de vraies vidéos dans les aperçus (médias du projet d'abord, puis 3-4 clips
de démo Mixkit/Pexels, avec droits déclarés comme pour la musique).
B3 : le contenu qui manque — les 7 mouvements « planned », les mouvements sur
vidéo, les VRAIS effets pendant le rush (secousse, flou animé, fuite de lumière…
aucun n'existe aujourd'hui), les transitions supplémentaires parmi les 46 cibles
xfade natives, et les thèmes éditoriaux.

ÉCHECS DE TESTS PRÉEXISTANTS, à ne pas confondre avec tes régressions
- scripts/smoke-vibecut-media-safety.spec.cjs : 3 échecs, crash Chromium sur des
  fixtures WebM de 7 Mo (problème B).
- npm run test:vibecut-export-local-mp4 : fixtures pointant une machine Windows
  (problème C).
- Les .mp4 de videotest/ sont des pointeurs Git LFS de 132 octets (problème D).
- La suite navigateur peut être INSTABLE sous charge : deux tests ont échoué une
  fois puis repassé au vert seuls le 2026-08-01. Relance avant de conclure.
- test:scope est VERT depuis le 2026-08-01. S'il échoue, c'est une régression.

MÉTHODE
1. Vérifie l'état de départ : npm run lint && npm run build
   && npm run test:scope && npm run test:vibecut-ui-v2
2. Petits incréments testables. La logique pure se vérifie sans navigateur.
3. Teste RÉELLEMENT dans le navigateur et REGARDE les captures :
   VIBECUT_SHOT_DIR=/tmp/shots node scripts/run-video-ui-test.mjs <spec>
   Les captures 720p compressées trompent : quand un doute porte sur un état,
   MESURE-le (aria-pressed, getComputedStyle, getImageData).
4. Rituel de fin de lot (plan.md § 9) : todo.md, plan.md, map.md, la roadmap des
   bibliothèques, puis un nouveau prompt de relance en fin de todo.md.
5. Rapporte honnêtement : ce qui marche, ce qui est laissé de côté et pourquoi,
   et les échecs PRÉEXISTANTS.

COMMANDES
npm run dev                     # http://localhost:3000/video
npm run lint && npm run build
npm run test:scope
npm run test:vibecut-ui-v2      # recettes + parités + 43 tests navigateur
npm run test:vibecut-library    # parité catalogue ↔ moteur ↔ capacités serveur
npm run test:vibecut-export
npm run test:video-ui           # modèles et store
```
