# TODO — Reconstruction de l'interface VibeCut

> État d'avancement. Plan complet et direction artistique : [plan.md](plan.md).
> **Dernière mise à jour : 2026-08-08.**

---

## CHANTIER VIBEOS — redesign Studio/Layout/Soundtrack/Vision (2026-08-08)

Plan maître : `docs/plan-vibeos-redesign-2026-08-08.md` (décisions validées,
inventaire, design system, specs page par page, phases A-F).

**Phase A (Fondations) : ✅ terminée le 2026-08-08.**

Livré :
- `src/features/vibeos/styles/vibeos.css` — tokens `--vo-*` copiés de VibeCut,
  scope strict `.vibeos`, zéro Tailwind (le bundle de /studio est statique).
- `src/features/vibeos/primitives/` — Button, IconButton, Segmented, Card,
  Badge, Spinner, Progress, EmptyState, Collapsible, Slider, TileGrid/Tile,
  Sheet (panneau latéral desktop / bottom sheet mobile), SearchField,
  ToastProvider/useToast.
- `src/features/vibeos/shell/` — VibeOsShell (topbar 56px unique, nav espaces,
  tab bar basse mobile avec safe-area), MiniPlayer (visible si piste chargée),
  SpacePlaceholder.
- `src/features/vibeos/audio/AudioProvider.jsx` — audio global : l'élément
  `<audio>` vit dans le layout /creer et survit aux navigations.
- `src/features/vibeos/project/` — modèle projet v1, IndexedDB (`vibeos` db,
  stores `projects` + `meta`), provider avec autosauvegarde débouncée 800ms,
  récents (8 max), dupliquer/supprimer/ouvrir/ensureProject.
- Routes : `/creer` (accueil incubateur complet : reprise, 5 cartes d'espaces,
  récents avec menu), `/creer/layout-visuel`, `/creer/studio`, `/creer/vision`,
  `/creer/son` (placeholders phase B-E). Toutes noindex, derrière StudioAuthGate.

Vérifié : `npm run lint` 0 erreur (12 warnings préexistants hors vibeos),
`npm run build` vert avec les 5 routes, smoke HTTP 200 + noindex sur /creer.
`/studio` intact, `/video` intact.

Laissé de côté (assumé) : le bouton « Publier » du shell pointe vers /studio
(flux actuel) jusqu'à la phase F ; pas de vignette projet tant que Layout
(phase B) n'écrit pas `project.thumbnail` ; pas de tests navigateur dédiés
vibeos (les placeholders n'ont pas de logique).

**Prochaine étape : phase B (Layout)** — voir le prompt de relance VibeOS en
fin de fichier.

---

## POINT SITUATIONNEL — 2026-08-03

**Où en est VibeCut, en une page.**

| Surface | État | Ce qui manque |
|---|---|---|
| `/video` accueil, `/video/rapide`, `/video/guide`, `/video/avance` | ✅ | rien de bloquant |
| `/video/transitions` | ✅ **complet** | rien |
| `/video/mouvements` | ✅ **12 sur 12 rendus** (2026-08-04), photos **et vidéos** | rien |
| Export serveur | ✅ **déployé** `00016-thk` (2026-08-04) | rien — aucun écart aperçu ↔ production |

**Chiffres relevés par les tests, pas déclarés :**

| | Transitions | Mouvements |
|---|---|---|
| Entrées au catalogue | 48 | 12 |
| Réellement rendues à l'export | **48** | **12** |
| Annoncées « Bientôt », sans réglage | 0 | **0** |

**Ce qui est testable tout de suite** — `npm run dev`, puis `http://localhost:3000/video` :
- les deux bibliothèques tournent sur de **vraies vidéos** (clips de démo avant
  tout import, tes propres rushs dès que tu en importes) ;
- les 48 transitions s'appliquent **et s'exportent** réellement ;
- le survol scrube, la touche **B** montre la coupe sans l'effet, les favoris
  reviennent dans les deux modes de montage.

> **MISE À JOUR 2026-08-04 — les deux bibliothèques sont closes.**
> `glitch` est livré comme mouvement : **48 transitions sur 48** et **12
> mouvements sur 12**, plus une seule entrée « Bientôt » nulle part. Les clips de
> démonstration passent de **2 à 4**. Le point 1 ci-dessous est donc caduc, sauf
> pour ce qu'il dit de la parallaxe (retirée) — voir la section « Lot glitch ».

**Ce qui reste, dans l'ordre où je le ferais :**

1. ~~**Les 4 mouvements restants.**~~ ✅ **Réglé.** Rotation et Apparition
   livrées, Parallaxe retirée (impossible sur une image plate), **Glitch livré le
   2026-08-04**. Texte d'origine conservé ci-dessous parce qu'il dit pourquoi
   chacun coûtait cher.
   - **Rotation** — demande le filtre `rotate` côté serveur et un `ctx.rotate`
     côté aperçu. Faisable, mais c'est une nouvelle capacité à mesurer.
   - **Apparition** — demande l'**opacité**, que le modèle de mouvement ne porte
     pas du tout, et un zoom **sous 1** qui laisserait un bord à l'image.
   - **Parallaxe** — « plans avant et arrière à vitesses différentes » est
     **impossible sur une photo plate** sans estimation de profondeur. À
     renommer ou à retirer : c'est une décision produit, pas un développement.
   - **Glitch** — ce n'est pas un mouvement de caméra mais un **effet**. Il
     relève du point 3.
2. ~~**Les mouvements sur vidéo**~~ — ✅ **fait le 2026-08-03.**
3. ~~**Les effets pendant le plan**~~ — ✅ **terminé le 2026-08-04.** Les cinq
   accents sont livrés et rendus : secousse, respiration, **grain animé**, **flou
   animé** et **fuite de lumière**. Voir « Lot effets pendant le plan ».

**Coût de chacun de ces ajouts, pour fixer les attentes** : deux
implémentations (canvas **et** expression FFmpeg), une preuve de parité image par
image sur un MP4 réel, la contrainte `|x| ≤ (zoom − 1) / 2`, et **un seul**
rollout Cloud Run en fin de lot.

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

**Lot B1 livré le 2026-08-02 : la fondation du design des deux bibliothèques.**
`/video/transitions` et `/video/mouvements` partagent une **ossature commune**,
chaque vignette se **scrube au survol** (la position du pointeur *est* le temps),
se **fige au point culminant** au repos, le grand aperçu a un **bypass** à la
touche **B**, et les **favoris** persistés en IndexedDB **reviennent dans les deux
modes de montage**. Suite navigateur portée de 43 à **60 tests**, qui mesurent les
**pixels** et non les libellés.

**Lot B3a livré le 2026-08-02 : l'écart d'export est refermé aux trois quarts.**
Le porteur du projet a tranché la recommandation d'ordre laissée en fin de B1 :
**fermer l'écart d'export d'abord, B2 ensuite.** Les 31 cibles `xfade` natives
inutilisées ont été **rendues et mesurées** une par une. Huit entrées existantes
pointent désormais sur la cible qui tient vraiment leur promesse, dix entrées
nouvelles ouvrent les sens manquants et deux formes absentes du catalogue.
**15 → 33 transitions exportables** ; catalogue 38 → **48** ; « aperçu
uniquement » 23 → **15**.
✅ **Déployé le 2026-08-02** : révision **`00007-b5c`**, image
`b3a-7ff9c28-20260802`. Vérifié sur le service réel : **29 cibles `xfade` sur
29**, `missing: []`, `errorCount: 0`, `/render` toujours protégé (401 sans
signature). L'ancienne révision `00006-6fw` reste disponible pour un retour
arrière immédiat. **Ce que la bibliothèque annonce est ce que l'export produit.**

**Lot B3 (4ᵉ tranche) ✅ LIVRÉ le 2026-08-04 : le catalogue de mouvements est terminé.**
**Rotation** et **Apparition** livrées, **Parallaxe retirée**. Il reste une seule
entrée annoncée — le glitch, qui est un effet et non un mouvement de caméra.
**11 mouvements rendus sur 12.** Déployé : révision **`00012-xht`**.
Ces deux-là sortent du modèle de recadrage, et chacun a coûté sa propre leçon :
- **Rotation** — une image qui bascule laisse des **coins vides**. Le premier jet
  agrandissait puis tournait : faux, parce que `zoompan` rend une image **déjà
  ajustée au cadre**, sans rien au-delà de ses bords. Écart mesuré : 4,6/255,
  *identique* à 40 % et à 100 % d'intensité — un défaut constant, donc pas une
  erreur d'angle. Corrigé en faisant rendre un cadre **plus grand**, en tournant
  celui-là, puis en recadrant au centre : l'écart tombe à **1,47**.
- **Rotation, deuxième piège** : `on` (le numéro d'image) n'existe **que** dans
  `zoompan`. Donné au filtre `rotate`, il fait échouer le graphe à la
  configuration sans jamais dire quelle variable manque. L'angle est donc écrit
  **deux fois**, avec la variable de temps de chaque filtre.
- **Apparition** — le fondu est en **numéros d'image** et non en secondes : en
  secondes il lirait les horodatages, qui ne sont remis à zéro qu'après cette
  chaîne. C'est exactement le décalage qui avait coûté une image au lot B3b.
**Quatre sentinelles vérifiées** (sens de bascule inversé, couverture retirée,
fondu supprimé, fondu deux fois trop long).

**Lot B3 (3ᵉ tranche) ✅ LIVRÉ le 2026-08-04 : les premiers EFFETS PENDANT LE PLAN.**
**Secousse** (caméra portée) et **Respiration** (zoom qui pulse) existent enfin.
Ce sont les deux premiers effets qui durent pendant tout le plan, là où un
mouvement va d'un cadrage à un autre et où une transition joint deux plans.
Ils se **composent** avec un mouvement — une secousse sur un zoom avant — d'où
une rangée à part dans l'inspecteur et non une carte de plus.
Choisis en premier **parce qu'ils se ramènent à un décalage du cadrage** : ils
entrent donc dans l'expression `zoompan` existante, dont la parité est déjà
prouvée image par image. Le grain et le flou animé n'ont pas cette propriété.
⚠️ **Deux erreurs trouvées à la mesure, pas à la relecture** (bugs 58 et 59) :
la fréquence choisie au premier jet n'était échantillonnée que **4 fois par
cycle** à 30 images/s — la secousse aurait sauté entre quatre positions au lieu
de trembler — et **le test de parité était aveugle** à un accent d'amplitude
fausse, parce qu'un décalage de 2 px passe sous le seuil toléré pour le
rééchantillonnage. Le test compare désormais **l'amplitude du mouvement** de
chaque côté, et non plus seulement les images. **Quatre sentinelles vérifiées.**
Déployé : révision **`00011-6nb`**, `capabilitiesVersion 7`. Suite navigateur
portée à **66 tests**.

**Lot B3 (2ᵉ tranche) ✅ LIVRÉ le 2026-08-03 : les mouvements s'appliquent aux VIDÉOS.**
Un rush peut enfin recevoir un mouvement de caméra. Ce n'était pas un manque du
moteur : le recadrage animé est un simple recadrage, `getClipVisualProgress`
mesure la course sur le segment rogné quel que soit le média, et **`zoompan` sur
entrée vidéo avait déjà été mesuré sans réserve au lot B3b**. C'était un garde
`isImageMedia` posé à **six endroits** — moteur canvas, renderer, manifeste,
store (à l'import **et** à la mise à jour), adaptateur, interface — dont plus
aucun n'avait de justification. Deux d'entre eux ne se voyaient pas à l'écran :
le store remettait le mouvement à `null` à l'import, et le manifeste le perdait
en route, si bien que l'interface pouvait très bien l'afficher sans qu'il
survive.
⚠️ **Aucun test existant ne pouvait le voir** : les onze tests de mouvement
utilisent des **photos**. D'où deux ajouts — un cas de parité sur une **source
vidéo rognée à 0,5 s** (qui prouve aussi que la course se mesure sur le segment
et non sur la source entière), et un test navigateur qui importe une vraie vidéo
et vérifie que la carte reste active après rechargement. **Sentinelle vérifiée** :
remettre le garde du renderer fait bien échouer le cas vidéo.
Déployé : révision **`00010-trj`**. Suite navigateur portée à **65 tests**.

**Lot B3 (1ʳᵉ tranche) ✅ LIVRÉ le 2026-08-03 : la bibliothèque de mouvements passe de 6 à 9.**
**Descente**, **orbite** et **rebond** sont désormais rendus des deux côtés et
**déployés** (révision **`00009-8b7`**). Il restait 7 promesses, il en reste **4**.
Le modèle de mouvement — une droite `start → end` parcourue en `smoothstep` —
a été **généralisé une fois**, en gardant la forme qui rend la parité démontrable
par construction :
- **`arc`** : un écart *perpendiculaire* au trajet, nul aux deux bouts, maximal
  au milieu. C'est ce qui fait qu'une orbite **contourne** au lieu de longer.
- **`curve: 'overshoot'`** : une courbe qui **dépasse** sa cible avant de se
  poser. Un `smoothstep` accoste, il ne rebondit pas.
Les deux restent un polynôme ou un sinus, donc s'écrivent telles quelles dans
l'expression `zoompan` — c'est **le critère** qui a fait retenir ces trois
mouvements-là et écarter les quatre autres (voir *Reste à faire*).
⚠️ **Un nouveau gate, et il a trouvé sa raison d'être tout de suite.**
`smoke-vibecut-motion-envelope` échantillonne la trajectoire **entière** de
chaque preset à quatre intensités. Jusqu'ici le **problème I** (`|x| ≤ (zoom−1)/2`)
était vérifié **à la main sur les deux extrémités** — ce qui suffit tant qu'un
mouvement est une droite, puisque le pire point est alors forcément un bout.
Ce n'est plus vrai : la bosse de l'orbite culmine **au milieu**, et le
dépassement du rebond va **au-delà** de sa cible. Un preset peut donc être sage
aux deux bouts et sortir du cadre en route. Le même test vérifie que les
**quatre** tables de presets disent la même chose. Trois sentinelles vérifiées.
`/capabilities` passe en **version 6** et rapporte les mouvements : le pré-vol
refusait bien la production d'avant le lot, vérifié **avant** de déployer.

**Lot B2 ✅ LIVRÉ le 2026-08-03 : les bibliothèques tournent sur de vraies vidéos.**
`useLibraryImages` devient **`useLibraryMedia`** et descend quatre étages :
**vidéos du projet → photos du projet → clips de démonstration → repli dessiné**.
Les vidéos passent devant les photos même quand une photo arrive plus tôt dans le
montage — c'est tout l'objet du lot.
Les **clips de démonstration ne viennent pas d'une banque d'images : ils sont
générés** par `scripts/build-vibecut-library-demo-clips.mjs`, qui rejoue les deux
scènes dessinées du repli dans un Chromium sans fenêtre. Motif : ces clips sont
servis à *tous* les visiteurs, et le projet bloque déjà l'export d'une musique
sans déclaration de droits — du rush tiers aurait exigé une licence validée avant
tout commit. Bénéfice au passage : ils ont **par construction** l'aspect du repli,
donc on ne voit pas l'étage changer sous ses pieds. **77 Ko pour les deux**,
plafond 1,5 Mo. Passer à du vrai rush Mixkit/Pexels reste un changement de
**données**, pas de code.
⚠️ **Un test a imposé une décision de conception** : hors de la boucle, la
vignette dessine maintenant une **copie figée** de la source
(`librarySourceFreeze.js`). Sans elle le rush continuait de tourner sous un scrub
arrêté, donc le **bypass ne prouvait plus rien** — les deux états différaient par
l'effet *et* par le contenu. Voir bug 53.
Cadence tenue : **60,3 img/s** au repos et **60,1** avec un scrub, sur des sources
vidéo. Suite navigateur portée de 60 à **64 tests**.

**Lot B3b ✅ TERMINÉ le 2026-08-03, rollout inclus.**
`test:vibecut-xfade-preview-parity` est **vert**, les **5 sentinelles sur 5** sont
attrapées pour la première fois, et le renderer est **déployé** :
révision **`00008-8gr`**, image `b3b-21b8030-20260803`, `capabilitiesVersion 5`,
**29 cibles `xfade` sur 29** et **20 filtres sur 20** vérifiés sur le service
réel, `missing: []`, `errorCount: 0`, `/render` toujours protégé (401 sans
signature). **Il n'y a plus aucun écart aperçu ↔ production.** Retour arrière :
`00007-b5c`.


---

## Lot ouverture et fin de séquence — 2026-08-04. Terminé.

**Rollout : révision `vibecut-render-service-00016-thk`**, image
`sequence2-20260804`. Vérifié sur le service réel : 29 cibles `xfade`, 20 filtres,
12 mouvements, 6 accents, `errorCount: 0`. Retour arrière : `00014-gq9`.

**Le problème.** Une transition s'accroche **entre deux plans** — `applyTransition`
refuse s'il n'y a pas de plan suivant, et le dernier plan n'affiche aucun panneau.
Les sept entrées « Ouverture / Fin de séquence » ne pouvaient donc **ni ouvrir ni
finir** : « Fin cinéma » ne savait se poser qu'à une coupe interne. Sept noms
promettaient un rôle impossible.

**Le modèle savait déjà le faire.** Le magasin porte `placement: 'intro' | 'outro'`
sur une piste `sequence-main`, en exemplaire unique, et `getIntroOffset` décale
tous les plans d'autant. Ce qui manquait n'était pas la mécanique mais le
**chemin** : rien dans VibeCut n'appelait `addTransitionItem` avec un placement.

**Livré :**
- **Le panneau de droite range par usage** — « Ouverture de séquence », « Entre
  deux plans », « Fin de séquence ». Les sept étaient noyées au milieu de 48.
- Panneau « Ouverture et fin de séquence », **toujours visible en bas** de
  l'inspecteur. Premier jet : il n'apparaissait que si rien n'était sélectionné,
  or un plan l'est d'office après un import. Un réglage qu'on ne trouve pas
  n'existe pas.
- **Une ouverture ALLONGE le montage** au lieu de rogner le premier plan :
  mesuré 20,01 s → 21,01 s. C'est ce qui la distingue d'une transition de coupe,
  laquelle fait chevaucher deux plans et raccourcit (30,01 → 29,21).
- **Rendu à l'aperçu** (`renderSequenceEdge`) : avant, tout instant sans plan
  actif était peint en noir — or une ouverture occupe justement un temps où
  aucun plan n'existe encore.
- **Rendu à l'export** (`appendSequenceEdges`). Prouvé sur un vrai MP4 :
  2,00 s sans les bords, **2,97 s avec**, luminance début 0, milieu 126, fin 0.

⚠️ **LES DEUX BORDS NE SONT PAS SYMÉTRIQUES, et c'est le porteur du projet qui
l'a vu à l'essai** — pas un test. Premier jet : les deux ajoutaient leur durée.
À l'écran, la dernière image se **figeait** une seconde puis s'éteignait. Verdict
de l'essai : « elle se met quand tout est terminé, ça n'a pas de logique. »
C'était exact, et la raison est simple : **une ouverture n'a rien avant elle**,
elle doit donc créer son temps ; **une fermeture a le dernier plan sous la main**,
elle doit l'éteindre PENDANT qu'il joue. Corrigé des trois côtés — magasin
(la durée totale n'ajoute plus la fin), aperçu (le fondu se pose sur le plan
actif), export (le montage est coupé en deux, la queue est éteinte sur place).

**Deux bugs corrigés en chemin :**
- **La fin était posée à `total − durée`** alors que `computeTotalDuration`
  **ajoute** sa durée après les plans : elle chevauchait le dernier plan et
  laissait une seconde vide en queue. `updateTransitionItem` avait raison,
  `resolveTransitionStartTime` avait tort — deux chemins d'écriture qui
  disaient deux choses différentes.
- **Le lecteur n'était pas repositionné** avant de figer l'image : une vidéo
  jamais lue n'a aucune image décodée à donner.

⚠️ **Leçon de méthode, et elle a coûté une heure.** J'ai cru la fin cassée parce
que ma mesure était une **moyenne de luminance** : le dernier plan était un fond
noir, et une moyenne ne distingue pas « vidéo sombre qui s'éteint » de « écran
noir ». L'instrumentation disait pourtant que tout allait bien — image source à
193, progression correcte. **Regarder la capture d'écran a tranché en dix
secondes.** Quand la mesure contredit l'instrumentation, c'est la mesure qu'il
faut suspecter d'abord.

**Choix technique à ne pas repayer.** On ne peut pas réutiliser l'étiquette d'un
plan pour en figer la première image : dans un graphe FFmpeg une étiquette se
consomme **une fois**, et le composite l'a déjà prise. On part donc du composite,
qu'on `split`. `tpad=stop_mode=clone` fabrique le gel sans `reverse`, lequel
bufferise tout le montage en mémoire pour retrouver une seule image. La longueur
d'un `xfade` vaut `duréeA + duréeB − duréeTransition` : avec deux morceaux de
durée `d` et une transition de `d`, le segment sort à exactement `d`.

---

## Lot effets pendant le plan — 2026-08-04. Les trois derniers sont livrés.

**Rollout fait, une seule fois : révision `vibecut-render-service-00014-gq9`**,
image `accents-20260804`. Vérifié sur le service réel : 29 cibles `xfade`,
20 filtres, **12 mouvements sur 12**, **6 accents sur 6**, `errorCount: 0`.
Retour arrière : `00013-szb` (glitch sans les accents), puis `00012-xht`.

**Ce qui est livré.** Grain animé, flou animé et fuite de lumière. C'était le
vrai retard sur Premiere et DaVinci, et c'est comblé. Les accents passent de
**2 à 5** (`shake`, `pulse`, `leak`, `grain`, `softness`).

**Pourquoi ils n'avaient pas pu être livrés avec la secousse et la respiration.**
Ces deux-là se ramènent à un décalage du **cadrage** : ils entrent dans
l'expression `zoompan` qui existait déjà et dont la parité était prouvée. Les
trois nouveaux modifient l'**image elle-même**, après le recadrage. Ils ont donc
leur propre chemin des deux côtés — une chaîne de filtres après le `zoompan` à
l'export, un filtre de contexte et des calques à l'aperçu — et c'est
`kind: 'image'` qui les distingue dans le modèle.

**Trois mécaniques différentes, une par effet :**

- **Fuite de lumière** — un halo chaud qui traverse le cadre pendant que son
  intensité respire, à **deux fréquences indépendantes** : avec une seule, les
  deux seraient synchronisés et l'œil verrait un motif se répéter. Rendu par
  `geq` sur l'image et non par un halo posé en `overlay` comme le fait la
  transition du même nom — un `overlay` demande une **seconde entrée**, donc un
  vrai graphe, alors que la chaîne d'un plan est linéaire. **Parité exacte :
  rapport d'amplitude 0,99, et 0,96 à 40 % d'intensité.**
- **Flou animé** — `gblur` n'accepte **pas** d'expression pour son sigma, et
  `sendcmd` est proscrit depuis le lot B3b (il diffuse à tous les filtres du même
  nom). On pose donc une **chaîne de flous à valeur constante**, un par palier,
  gatés par `enable` — 24 paliers et non 12, parce que sur un plan de plusieurs
  secondes la quantification des transitions se verrait avancer par à-coups.
- **Grain** — un seul filtre `noise`, temporel (`allf=t`) : sans ça il serait
  figé, et un grain figé se lit comme une salissure d'écran.

**Ce que la mesure a contredit, et c'est là qu'est la valeur :**

- **Le flou était à 0,59 au lieu de 1, et ce n'était pas le sigma.** C'était les
  **bords** : FFmpeg échantillonne hors cadre en **rabattant sur le bord**, le
  canvas en prenant du **transparent**. Un `blur()` CSS posé tel quel délave les
  quatre bords sur une bande de ~3 sigma. Piège déjà payé sur les transitions le
  2026-08-02, repayé ici faute d'y avoir pensé. Corrigé en floutant une image
  bordée par étirement : **0,59 → 0,74**.
- **La quantification n'était PAS la cause du reste.** Aligner l'aperçu sur les
  mêmes 24 paliers que l'export n'a rien changé à la mesure — ce qui a permis de
  l'écarter au lieu de la soupçonner. Reste un écart de **noyau** : Chromium
  approxime la gaussienne par des flous de boîte, et l'écart est maximal aux
  **petits sigmas** — celui-ci culmine à 1,9 px. C'est le même écart structurel
  que le noyau de `blur-cut`, déjà documenté (problème G). Bande posée à
  0,65-1,45 avec sa mesure datée, **après** les deux corrections et pas à leur
  place.
- **Le grain de l'aperçu était 4,9 fois trop faible.** `noise=alls=N` ajoute un
  écart d'amplitude N ; un mélange `overlay` à l'opacité *a* ajoute environ
  *a* × 0,58 × luminance. Les deux ne se correspondent pas terme à terme. Le
  diviseur (45) est **mesuré**, pas deviné : **export +1,424 d'écart-type contre
  aperçu +1,391**, rapport **1,02**.

**Le grain est jugé autrement que les autres, et c'est assumé.** FFmpeg tire un
nombre aléatoire par pixel et par image avec **son** générateur : aucun canvas ne
reproduira cette suite, et comparer les pixels reviendrait à comparer deux
tirages de dés. Ce qui est prouvé est la **quantité** de grain ajoutée, via
l'écart-type. `meanFrame` reste exigé — il porte sur la couleur moyenne, que le
grain ne doit pas déplacer, et c'est exactement ce qu'un grain mal centré
casserait.

**Un plancher d'existence par accent.** Le halo est un effet doux : son amplitude
vaut ~3 là où une secousse en fait 12. Exiger le même plancher pour tous
reviendrait à refuser un effet correct parce qu'il est discret.

---

## Lot glitch — 2026-08-04. Les deux bibliothèques sont closes.

**Ce qui est livré.** `glitch` était la dernière entrée « Bientôt » du produit.
Il est maintenant un **mouvement rendu**, dans l'aperçu comme à l'export :
48 transitions sur 48, **12 mouvements sur 12**, zéro promesse non tenue.

**Ce qu'il fait, et pourquoi ce n'est pas une secousse.** Le cadre saute
latéralement, tient sa position quelques images, puis revient. C'est un
**escalier**, pas une oscillation : une secousse (`shake`) est un sinus, elle
tremble en continu ; un décrochage numérique est discontinu par nature. Le motif
fait huit paliers dont **cinq à zéro** — c'est ce qui le rend *bref* plutôt que
permanent. Horizontal seulement : un décrochage vidéo décroche en ligne, et
ajouter du vertical le ferait ressembler à `shake`, qui le fait déjà mieux.

**Les deux pièges payés ici, à ne pas repayer.**

- **La cadence de 11,37 Hz n'est pas ronde exprès.** Le palier se lit
  `floor(secondes × cadence)`. Une frontière de palier qui tomberait *exactement*
  sur un instant d'image ferait dépendre `floor` du dernier bit du calcul
  flottant : l'aperçu et l'export liraient alors des paliers voisins, et l'écart
  vaudrait **un saut entier**, pas une fraction de pixel. À 12 Hz et 30 im/s, une
  frontière tombe sur une image toutes les cinq. Avec 11,37, aucune ne coïncide à
  24, 25, 30 ni 60 im/s.
- **Le calcul part des SECONDES et jamais de la progression.** Les secondes sont
  la seule grandeur que les deux côtés écrivent pareil (`on/fps` au rendu,
  `progression × durée` à l'aperçu). La progression, elle, vaut `on/(images−1)`
  d'un côté et `image/(fps × durée)` de l'autre — **un écart d'une image**, sans
  conséquence sur une courbe lisse, fatal sur un escalier.

**Un bug trouvé en chemin, antérieur au glitch.** `buildImageMotionFilter`
n'écrivait **aucun `zoompan` à intensité zéro**, alors que l'aperçu garde le
cadrage de départ du preset. Sur `zoom-out` (départ 1,14), `bounce` (1,18) ou
`glitch` (1,08), l'aperçu montrait donc une image agrandie et l'export l'image
entière. Personne ne l'avait vu parce que la parité n'avait jamais été mesurée à
intensité nulle. Le garde ne teste plus l'intensité.

**Le test a été renforcé, pas seulement étendu.** Les deux cadrages du glitch
étant identiques, **tout** ce qui bouge vient du décrochage : un renderer qui
l'oublierait rendrait un plan fixe, et un plan fixe des deux côtés est
parfaitement « en parité ». La comparaison image par image ne pouvait donc rien
prouver. Le glitch passe désormais par la mesure d'**amplitude** créée pour les
accents (export 30,6 contre aperçu 28,5 à pleine intensité ; 13,1 contre 12,4 à
40 %, ce qui prouve aussi que l'intensité est appliquée), plus une assertion que
l'expression `zoompan` **porte** bien un palier.

**Les clips de démonstration passent de 2 à 4** (`aube.mp4`, `orage.mp4`), comme
le plan du lot B2 le prévoyait. Ce qui les distingue n'est pas la palette mais la
**structure** : `aube` remonte l'horizon à 0,74 (l'eau occupe les trois quarts du
cadre), `orage` le descend à 0,44 avec le point le plus clair dans un **coin**.
Deux clips qui ne diffèrent que par leur teinte se comportent pareil sous une
transition — ils n'ajouteraient rien à juger. Une graine par scène, sinon les
scènes 2 et 3 rejouaient le relief, les reflets et le grain de la scène 1.
**132 Ko** pour quatre clips, plafond du lot 1,5 Mo.

⚠️ **Ces clips restent GÉNÉRÉS et non filmés.** Ils ne viennent ni de Mixkit ni
de Pexels. Choix confirmé par le porteur du projet le 2026-08-04 : aucune licence
tierce à faire valider, et l'écran garde le même aspect qu'un clip soit chargé ou
non. Passer à du vrai rush reste un changement de **données** — déposer les
fichiers, ajouter leur entrée dans `libraryMediaManifest.js` avec licence et URL
d'origine. Aucun code ne bouge.

---

**Re-vérifié le 2026-08-04**, sans modifier une ligne de code, parce qu'un prompt
de relance périmé annonçait ces deux points comme encore ouverts :
- `test:vibecut-xfade-preview-parity` **vert deux fois de suite**, 202
  échantillons. `additive-dissolve` retombe sur sa mesure inscrite : pire
  `meanFrame` **2,9**, pire `meanPixel` **1,4**, pour des seuils de 5 et 10. Le
  seuil n'a pas eu besoin d'être touché, et `qStep = quantizeProgress(t)` est bien
  à l'état sain.
- `test:vibecut-transition-sentinels` **mené au bout à nouveau : 5 sur 5**, et les
  deux fichiers patchés restaurés à l'octet près (empreintes comparées à un
  instantané pris avant le lancement).
- **Aucun rollout.** Le service réel est déjà en **`00012-xht`**,
  `capabilitiesVersion 7`, 29 cibles `xfade` et 20 filtres, `missing: []`,
  `errorCount: 0` — soit deux lots devant la révision que le prompt croyait en
  production. Redéployer n'aurait rien changé et aurait coûté un build.

⚠️ **Ce qui bloquait la parité n'était pas du bruit, c'était un défaut de
sentinelle laissé dans le code** (bug 52). `smoke-vibecut-transition-sentinels`
écrit de vrais défauts dans la production puis les restaure ; **interrompu, il en
laisse un derrière lui**. `xfadeTransitions.js` portait encore la charge de la
4ᵉ sentinelle — l'aperçu lisait la courbe en continu au lieu des douze paliers.
Le symptôme avait été pris pour de la rasterisation Chromium, et **le seuil monté
deux fois pour l'absorber**. Deux mesures consécutives sans rien changer ont rendu
des valeurs **identiques au dixième** : il n'y avait aucun bruit. L'écart se
prédisait même au dixième (6,5 / 1,1 / 9,1 attendus contre 6,0 / 2,0 / 8,9
mesurés). Détail complet et signes de reconnaissance :
[docs/vibecut-transitions-b3b-plan-2026-08-02.md](docs/vibecut-transitions-b3b-plan-2026-08-02.md) § 10.9.

Les 15 transitions qui n'avaient **aucune** cible `xfade` native sont construites
comme des **sous-graphes de filtres natifs** posés sur la queue du plan sortant et
la tête du plan entrant. **48 transitions exportables sur 48** ; il n'y a plus une
seule entrée « Aperçu uniquement » dans la bibliothèque.
Plan et retour d'expérience : **[docs/vibecut-transitions-b3b-plan-2026-08-02.md](docs/vibecut-transitions-b3b-plan-2026-08-02.md)** (§ 10).

⚠️ **Le fait marquant du lot, à retenir avant tout ajout FFmpeg futur.**
`sendcmd` — la façon évidente de faire varier une option dans le temps, et celle
que le plan prévoyait — **diffuse ses commandes à TOUS les filtres du graphe**
portant le nom visé, pas à celui qui le suit. Sur un montage à deux coupes, la
commande qui clôt la première écrasait la rampe de la seconde : **la deuxième
coupe rendait un fondu simple**, et rien ne le signalait. La parade documentée
(nommer l'instance, `gblur@…`) **ne fonctionne pas** dans le build FFmpeg déployé.
Les rampes sont donc des **chaînes de douze filtres à valeur constante**, chacun
ouvert sur un douzième de la fenêtre par sa porte `enable`.
**Seul un test à TROIS plans pouvait le voir.** Un test sur deux plans passait.

⚠️ **Une architecture a été écartée après mesure, et c'est le cœur du plan.**
`xfade=transition=custom:expr=` permet tout, mais coûte **8,6 s pour une
transition de 0,6 s en 1080p** contre **0,2 s** en natif — un facteur ~40
inhérent à l'évaluateur d'expressions de FFmpeg, pas à la complexité des
formules. Un montage à 6 transitions ajouterait 2 à 4 minutes par export, sur un
service facturé à la seconde. **La voie retenue** est d'appliquer de vrais
filtres natifs sur la **queue de A** et la **tête de B** puis une jointure
`xfade` native : même effet, **0,2 à 0,4 s**, et une forme qui correspond à ce
que le canvas fait déjà.

**Chantier en cours, décidé le 2026-08-02 : les DEUX BIBLIOTHÈQUES.**
Elles existent depuis la phase 5 mais restent un catalogue fonctionnel, pas une
page où l'on a envie de rester. Le porteur du projet veut la **fondation du
design** des deux écrans — avec des **avant / après** — bâtie sur le contenu
**déjà en place**. Le contenu supplémentaire (nouveaux mouvements, effets
pendant le rush, transitions supplémentaires) vient **après**.

> **Feuille de route : [docs/vibecut-bibliotheques-roadmap-2026-08-02.md](docs/vibecut-bibliotheques-roadmap-2026-08-02.md)**
> Lots **B1** et **B3a** ✅ livrés le 2026-08-02, **B3b** ✅ livré le 2026-08-03.
> **Prochain : B2** (vraies vidéos dans les aperçus), puis le reste de B3
> (contenu). L'ordre a été modifié **par décision du porteur du projet** : B3a est
> passé devant B2.

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
| B · Bibliothèques (design → contenu) | 🟡 **chantier en cours** — **B1 ✅**, **B3a ✅**, **B3b ✅** (rollout inclus), **B2 ✅ 2026-08-03**. Reste **B3 — le contenu** : 7 mouvements, mouvements sur vidéo, effets pendant le plan |
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

### Lot B1 — Fondation du design des deux bibliothèques (2026-08-02)

**Ce que le lot devait produire, dans les mots du porteur du projet** : *« les
meilleures bibliothèques pour tester les animations, avec des aperçus qui
permettent de juger, pouvoir les mettre en favori, et donc les utiliser dans les
modes en connaissance de cause »*. **Aucun contenu nouveau** : 38 transitions et
6 mouvements réels, présentés à fond.

**L'ossature est désormais UNE, pas deux.** `LibraryScreen`, `LibraryFilterBar`,
`LibraryCard`, `LibraryStage`, `LibraryContextStrip` et `useFavorites` sont
partagés ; `TransitionLibrary` et `MotionLibrary` ne fournissent plus que leurs
**données**, leur façon de dessiner une vignette et le contenu de leur panneau.
Les deux écrans étaient jusqu'ici écrits en parallèle et auraient divergé dès la
première retouche.

**AUDITIONNER — le hover scrub.** La position **horizontale** du pointeur sur une
vignette *est* le curseur de temps : on balaye la grille et on a auditionné 38
transitions en quelques secondes. C'est le motif de DaVinci Resolve et de Final
Cut Pro. Liseré de progression sous la vignette, la boucle reprend à la sortie, et
**les flèches gauche/droite font la même chose au clavier** — sans quoi l'écran
serait inutilisable sans souris. La navigation d'une carte à l'autre reste au Tab :
détourner les flèches pour ça aurait retiré le seul accès clavier au temps.

**Au repos, la vignette se fige au POINT CULMINANT**, jamais à l'instant 0. Un
champ `peak` est arrivé dans le catalogue de transitions, parce que le milieu ne
convient pas à tout : un passage au noir à mi-course est un **cadre noir**, qui ne
dit rien de la transition — ceux-là s'arrêtent à 30 %. Pour un mouvement, le point
culminant est la **fin** de la course. Le test le prouve en comparant quatre
vignettes deux à deux.

**JUGER — le grand aperçu et le bypass.** Maintenir **B** montre le rendu **sans**
l'effet, en plein cadre : coupe franche pour une transition, photo immobile pour un
mouvement. C'est l'avant/après **en séquence** plutôt qu'en surface, la forme juste
pour une différence temporelle. Plus un curseur de temps et une bascule boucle. Le
séparateur déplaçable reste écarté (roadmap § 3.3) — il est le bon outil pour la
colorimétrie, pas ici.

**Le temps ne passe jamais par React.** Les contrôleurs de progression vivent dans
un **registre de module** (`previewController.js`), comme `preview/playheadClock.js`.
Le survol écrit dans un objet mutable et redessine le canvas directement : aucun
`setState` à la cadence du pointeur sur une grille de quarante canvas. C'est le
correctif du bug 3 rejoué. Une seule horloge partagée, un `IntersectionObserver`
par carte, et **aucun redessin quand rien n'a changé**.

**FAVORIS, et leur retour dans les modes** — c'est la moitié du besoin exprimé.
Persistés en **IndexedDB** sous `favorites:v1`, dans la même base que les projets
(pas `localStorage` : deux stockages feraient deux vérités). **Une seule source de
vérité** : `adapters/useFavorites.js`, cache de module + `useSyncExternalStore`,
lu par les deux bibliothèques **et** par les deux inspecteurs.
- **montage avancé** : section « Tes favoris » **en tête** de la liste de
  transitions de l'inspecteur ;
- **montage rapide** : les **six raccourcis écrits en dur** deviennent les favoris
  de l'utilisateur, avec repli sur les six d'origine tant qu'aucun n'est posé.
  ⚠️ Un favori peut être « aperçu uniquement » : on le rend quand même — c'est le
  choix de l'utilisateur — mais **avec la mention « Aperçu »**, comme dans le
  montage avancé. Le retirer en silence aurait été pire que de le montrer.

**Le châssis** : cartes agrandies (248 px au lieu de 196), cascade à l'entrée,
survol sobre, recherche insensible aux accents, familles en **barre horizontale**
(jamais un rail latéral, `plan.md` § 4.4) repliée en menu sous 720 px, bande de
contexte « Scène 4 → [ici] → Scène 5 », et un état « aucun résultat » qui **dit
quoi faire** avec un bouton qui agit vraiment.

**Ce qui n'a pas bougé** : les canvas restent dessinés par `renderTransition` et
`applyImageMotionTransform`, l'horloge reste unique, les badges de parité restent
lus de `getServerRenderCapabilityStatus`, les mouvements `planned` n'exposent
toujours aucun réglage, et la courbe linéaire reste affichée désactivée.

**Gate** : `smoke-vibecut-library-b1.spec.cjs`, **17 tests qui mesurent les
pixels** (`getImageData` : moyenne RVB + grille de 16 sondes) et les attributs que
le rendu écrit dans le DOM, jamais un libellé. Suite navigateur portée à **60**.

#### Seconde passe — ce que la relecture de l'écran a changé (même jour)

Cinq points relevés à l'usage, tous corrigés dans la foulée :

1. **La page Mouvements ouvrait sur ce qui n'existe pas.** Sept des treize
   entrées sont annoncées et non rendues : mélangées aux six qui marchent, elles
   occupaient plus de la moitié de la grille et faisaient passer le catalogue pour
   à moitié vide. Elles sont désormais dans une **section annexe en bas**, trait de
   séparation, titre en retrait, cartes atténuées. On ne les cache pas — la règle
   reste de dire ce qui arrive — on arrête de leur donner la même place.
2. **Les transitions non exportables passaient devant.** Le tri « exportables
   d'abord dans chaque famille » existait avant le lot et **avait été perdu** au
   passage à l'ossature commune : les familles ouvraient sur des entrées qui se
   dégradent en fondu à l'export. Tri rétabli, plus un filtre **« Export Pro »**
   dans la barre (les 15 qui survivent, sur 38), plus — et c'est le plus utile —
   **un avertissement au moment où l'on applique** : *« À l'export, le serveur la
   remplacera par un fondu enchaîné. »* Un badge se regarde une fois ; cette
   phrase arrive quand la décision est prise.
3. **Le panneau des mouvements ne respirait pas.** Six curseurs de trajectoire
   empilés sous l'intensité. Ils sont **repliés par défaut** sous « Cadrage
   précis » : la précision reste pour qui la cherche, sans encombrer qui veut
   juste choisir un mouvement et le doser.
4. **Les images par seconde n'avaient pas été mesurées.** C'était un risque écrit
   dans la feuille de route et jamais chiffré. Mesuré : **60,2 im/s** sur la grille
   complète de 38 vignettes, **60,1 im/s** avec un scrub en cours. Aucun
   effondrement. La mesure est devenue un **test permanent** avec un plancher à
   24 im/s — assez bas pour ne pas dépendre de la machine, assez haut pour
   attraper un effondrement.
5. **Les scènes de repli étaient trop lisses.** Ce sont elles qu'on voit avant
   d'avoir importé quoi que ce soit, donc la première impression de l'écran — et
   surtout, **un dégradé lisse zoomé à 116 % reste le même dégradé** : sur un
   aplat, la moitié des mouvements et des transitions ne montraient littéralement
   rien. Elles ont maintenant trois plans de relief, un halo, un reflet sur l'eau
   et un grain fin. Le grain de « Dissolution film » et la désaturation de
   « Fondu désaturé » se voient enfin. Toujours **dessinées**, aucun asset externe,
   et déterministes pour que deux sessions donnent la même image.

---

### Lot B3b — Les 15 dernières transitions (2026-08-03)

- **Le catalogue est entièrement exportable : 48 sur 48.** Il n'y a plus une
  seule entrée « Aperçu uniquement ». C'était 15 sur 38 au lot L1, 33 sur 48 au
  lot B3a.
- **Chaque transition est un sous-graphe**, pas une ligne. `buildTransitionSubgraph`
  (exporté par le renderer) pose des filtres sur la **queue du plan sortant** et
  la **tête du plan entrant**, puis joint. Douze joignent par un `xfade` natif ;
  **trois refont la jointure à la main** parce qu'elles doivent *choisir* entre
  les deux plans plutôt que les mélanger — stroboscope, coupe franche du glitch,
  révélation par blocs. Les deux flux sont alors alignés par `tpad` et composés
  par un `overlay` conditionnel.
- **La table d'effets est PUREMENT DÉCLARATIVE et triplement recopiée**
  (`exportManifest.js`, `functions/src/videoExport.js`,
  `render-service/src/server.js`). Les **mêmes nombres** sont lus par le renderer
  et par l'aperçu canvas : aucune constante d'effet n'est écrite deux fois, donc
  l'aperçu ne peut pas diverger par recopie fautive.
  `smoke-vibecut-transition-parity` échoue si les trois copies divergent.
- **`blur-dissolve` et `cross-blur` sont vraiment séparés**, pas deux noms pour
  le même réglage : `ramp` (A part net et se floute, B arrive floue et se résout
  — à aucun instant les deux ne sont flous) contre `bell` (les deux culminent
  ensemble au milieu, deux fois plus fort — il y a donc un instant où toute
  l'image est illisible).
- **Décision produit du porteur du projet** : les ouvertures de séquence
  (`intro-title-scan`, `intro-grid-reveal`, `intro-neon-doors`, plus
  `intro-cinematic-bars`) restent des transitions et sont rendues à l'export,
  mais la bibliothèque **dit** désormais qu'elles sont pensées pour démarrer une
  séquence — badge, note dans le panneau, et remarque au moment où on les pose
  ailleurs qu'à la première coupe. Trois `outro-*` portent le pendant « Fin ».
- **Le badge et le filtre ont changé de rôle.** « Export Pro » aurait été sur les
  48 cartes et le filtre du même nom ne retirait plus rien : un badge que tout le
  monde porte ne distingue rien, un contrôle qui ne filtre jamais est un bouton
  mort (`plan.md` § 4.2). Ils portent maintenant l'usage, et le filtre devient
  « Entre deux plans » (41 sur 48). **L'avertissement d'export n'est pas
  supprimé** : il est lu à l'exécution, donc il reviendrait de lui-même si une
  capacité serveur disparaissait.

**Ce que la mesure a contredit — le vrai contenu du lot** (détail au § 10 du plan) :

1. **`zoompan` sur vidéo : aucune réserve** (l'inconnue n° 1 du plan). `d=1` ne
   fige rien, ne duplique aucune image, et `on` est exact à l'image près. Les
   trois zooms étaient les plus sûrs du lot, pas les plus risqués. Fausse alerte
   au passage : une géométrie qui semblait fausse de 20 % n'était que la **plage
   limitée** du YUV relue en `gray`.
2. **`sendcmd` est inutilisable** (voir l'encadré plus haut). Remplacé par des
   chaînes de douze filtres à valeur constante, chacun ouvert par `enable`.
3. **Le découpage en segments dérive.** Premier remplacement essayé : douze
   segments concaténés. `concat` déduit le décalage de chaque segment de la durée
   du précédent, **et cette déduction dérive** — huit images de trop sur 108. Avec
   des bornes en *secondes* plutôt qu'en numéros d'image, c'était une image
   *perdue* sur 102. Le découpage survit **limité à trois morceaux**, pour
   confiner les quatre effets qui doivent sortir du `yuv420p`.
4. **La dépense n'est pas l'effet, c'est l'espace colorimétrique.** L'aller-retour
   `yuv420p → gbrp → yuv420p` posé sur tout le flux coûte **1,1 s** pour une
   transition de 0,6 s en 1080p — quatre fois l'effet. Une porte `enable` n'y
   change rien : elle empêche l'effet, pas la conversion. Confiner la fenêtre fait
   tomber l'aberration chromatique de **2,20 s à 0,83 s** et le glitch de
   **1,77 s à 0,64 s**.
5. **Trois faits FFmpeg relevés à la mesure** : `displace` lit
   `out(x) = in(x + carte − 128)` (une carte > 128 décale vers la gauche) ;
   `extractplanes=r+g+b` sort le rouge en 0 ; le sous-échantillonnage de chroma du
   `yuv420p` étale les franges sur deux pixels, ce que l'aperçu en RVB plein ne
   peut pas reproduire — forcer `gbrp` fait tomber l'écart du glitch de 23 à 4.

**Coût mesuré, plafond 1,2 s** pour une transition de 0,6 s en 1080p (natif :
0,23 s) : le plus cher est `chromatic` à **0,83 s**. Tous les autres sont entre
0,15 s et 0,64 s.

⚠️ **LE LOT N'EST PAS FINI. Deux choses restent ouvertes** (détail dans
*Reste à faire*) : un seuil de parité qui n'est pas calé sur `additive-dissolve`,
et le rollout Cloud Run.

**Gate du lot :**
- `smoke-vibecut-xfade-preview-parity` — **44 transitions × 4 instants**, dont les
  15 nouvelles, avec un seuil justifié par id. Le côté FFmpeg est construit par
  `buildTransitionSubgraph`, le code du renderer lui-même.
- `smoke-vibecut-transition-chain-mp4` — **trois plans enchaînés**, en MP4 réel :
  compte d'images exact, les **deux** coupes portent l'effet, et **hors fenêtre
  rien ne bouge**.
- `smoke-vibecut-transition-cost` — plafond de coût, mesuré en 1080p.
- `smoke-vibecut-transition-sentinels` — **cinq défauts rejoués** sur le code de
  production, cinq échecs exigés.
- `smoke-vibecut-library-parity` — 48 exportables, 0 en aperçu seul.
- **`GET /capabilities` du renderer vérifie désormais les FILTRES**, pas seulement
  les cibles `xfade`. Les 15 nouvelles ne sont plus des cibles : un build où
  `displace` ou `zoompan` manquerait passait le contrôle et faisait échouer tous
  les rendus. La liste est **relevée sur les sous-graphes que le renderer émet**,
  jamais recopiée. `capabilitiesVersion` passe à **5**, et le pré-vol refuse
  explicitement une image antérieure au lot (elle ne rapporte aucun bloc
  `filters`) — c'est ce qui rend la vérification post-rollout utile.
- Suite navigateur : les tests de la bibliothèque réécrits pour la nouvelle
  réalité (48/48, badge d'usage, filtre « Entre deux plans »).

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

41. **Le curseur de temps du grand aperçu était mort une fois sur deux.** Le
    premier jet écrivait `slider.value` **directement** pendant la boucle, pour
    éviter des rendus React. Effet de bord : React garde une trace de la dernière
    valeur d'un champ, et une écriture directe la met à jour **sans** déclencher
    `onChange`. Amener ensuite le curseur exactement là où la boucle venait de le
    laisser ne produisait donc **aucun événement**. Le transport est devenu un
    champ contrôlé, rafraîchi 8 fois par seconde — assez pour lire un temps, et le
    dessin des canvas reste entièrement hors de React. **Trouvé par le test, pas
    par la relecture** : le symptôme était silencieux.
42. **Le bypass devenait sourd juste après avoir déplacé le curseur.** Le garde
    « ne pas déclencher B quand on tape » ignorait **tout** `INPUT`. Or le curseur
    de temps en est un, et il garde le focus : la comparaison avant/après ne
    répondait plus exactement au moment où l'on veut comparer. Le garde ne porte
    plus que sur les champs où l'on **tape** vraiment (texte, recherche, nombre…).
43. **Deux clics rapides sur la bascule boucle retombaient dans la même branche.**
    Le handler lisait l'état React capturé au rendu, et faisait ses effets de bord
    **dans un `setState` updater** — que StrictMode invoque deux fois. La bascule
    lit désormais le **mode du contrôleur**, qui est synchrone, et les effets sont
    sortis de l'updater.
44. **Un smoke lisait le catalogue avec une regex positionnelle.**
    `smoke-vibecut-style-recipes` exigeait `{ id: '…', engineId: '…'` **collés** :
    ajouter le champ `peak` a cassé le test sans que rien ne soit faux. La regex
    cherche maintenant l'`engineId` **de cette entrée**, pas une position dans la
    ligne. Bon réflexe du test (il a bien vu un changement), mauvaise formulation.
45. **Un point de parité qui ne tombait pas sur une image entière comparait deux
    instants différents.** En densifiant l'échantillonnage des rognages (lot
    B3a), `0,05` a été pris comme point de mesure — or `0,05 × 50 images/s = 2,5`,
    arrondi à l'image 3, soit `t = 0,06` côté FFmpeg contre `0,05` côté canvas.
    Sur une courbe aussi raide que le rayon de `circlecrop` (dérivée ≈ 5), ce
    centième suffisait à faire échouer un test **pourtant juste** : une heure
    perdue à soupçonner la formule. `smoke-vibecut-xfade-preview-parity` **refuse**
    désormais un point hors grille, avec le message qui explique pourquoi.
46. **Le test de rendu local interdisait l'effet qu'on venait d'ajouter.** Il
    exigeait que l'image du milieu du fondu ne soit pas noire — bonne assertion
    (elle attrape un rendu qui a échoué), sauf que pour `circlecrop` et
    `rectcrop`, **être noir à mi-parcours est l'effet même**. L'assertion est
    inversée pour ces deux-là, et **renforcée** : noir au milieu *et* image encore
    présente au quart, avec un seuil **relatif au fondu de référence** plutôt
    qu'absolu (la lecture ne retombe pas toujours pile sur l'image du milieu). Un
    rendu entièrement noir ne passe donc pas.

---

### Bugs du lot B3b (2026-08-03)

45. **La deuxième coupe d'un montage rendait un fondu simple.** `sendcmd` diffuse
    ses commandes à tous les filtres du graphe portant le nom visé : la commande
    « sigma 0 » qui clôt la première coupe arrivait au milieu de la rampe de la
    seconde et l'écrasait. Mesuré : écart-type 52,7 avec les deux coupes contre
    42,9 avec la seconde seule. **Trouvé par le test à trois plans, et par lui
    seul** — sur deux plans le défaut n'existe pas. Corrigé en remplaçant
    `sendcmd` par des chaînes de filtres à valeur constante.
46. **Le montage perdait des images au recollage.** Bornes de découpe en secondes :
    une image perdue sur 102. Puis, avec treize segments concaténés : huit images
    **de trop** sur 108. Corrigé en passant les bornes en numéros d'image et en
    limitant le recollage à trois morceaux. Le test à trois plans compte les
    images à chaque exécution.
47. **`xfade` refusait de joindre un flux recollé à un flux intact** : `concat`
    sort en base de temps 1/1000000, les autres sont en 1/fps. Un montage mêlant
    une transition confinée et une transition simple ne se rendait pas du tout.
    Corrigé par un `settb=1/fps` derrière le recollage.
48. **Un bloc de `intro-grid-reveal` était révélé dès q = 0**, donc avant le début
    de la transition : son seuil valait exactement 0 et `gte(0, 0)` est vrai. Les
    seuils vont maintenant de 1/40 à 1. **Trouvé par l'assertion « hors fenêtre,
    rien ne bouge »** — elle-même ajoutée parce qu'une **sentinelle** avait montré
    que le test à trois plans ne portait pas cette garantie.
49. **Le signe de `displace` était inversé.** `displace` lit
    `out(x) = in(x + carte − 128)`, donc une carte supérieure à 128 décale l'image
    vers la **gauche**, alors que l'aperçu dessine à un décalage de *destination*.
    Écart mesuré avant correction : 39 sur 255.
50. **Le glitch était plus mou à l'export qu'à l'aperçu.** En `yuv420p`, le
    sous-échantillonnage de chroma étale les franges de couleur sur deux pixels ;
    l'aperçu travaille en RVB plein et ne peut pas le reproduire. Forcer `gbrp`
    autour du sous-graphe fait tomber l'écart de **23 à 4** sur 255.
51. **La courbe des bandes du glitch était quantifiée d'un côté et continue de
    l'autre.** La carte de déplacement est une expression `geq` en T (continue),
    le décalage RVB une rampe par paliers : l'aperçu appliquait les paliers aux
    deux. Les bandes se décalaient d'un pixel et l'écart mesuré triplait.
52. **L'outil qui injecte des défauts en avait laissé un dans le code.**
    `smoke-vibecut-transition-sentinels` patche la production puis la restaure ;
    l'exécution interrompue du 2026-08-03 a laissé en place la charge de sa
    4ᵉ sentinelle — `const qStep = clamp(t, 0, 1);` au lieu de
    `quantizeProgress(t)`. L'aperçu lisait donc la courbe **en continu** quand
    l'export avance par **douze paliers**. C'est ce qui faisait échouer
    `additive-dissolve`, et l'écart a été pris pour du bruit de rasterisation
    Chromium — **le seuil a été monté deux fois** pour l'absorber. Deux exécutions
    consécutives, sans rien changer entre les deux, ont rendu des mesures
    **identiques au dixième** sur les quinze transitions : il n'y avait aucun
    bruit. L'écart se prédisait au dixième à partir de α = 0,30 × sin(π q).
    Trois signes le disaient avant toute mesure : `quantizeProgress` était
    **exportée et appelée nulle part**, le motif que la sentinelle *cherche* était
    absent du fichier et celui qu'elle *écrit* présent, et `additive-dissolve` est
    la seule des quinze dont l'effet soit une pure intensité rampée — donc le seul
    **détecteur** possible, les quatorze autres cachant le même défaut sous leur
    écart géométrique. Corrigé, seuils **resserrés** sur la mesure réelle
    (`meanFrame` de 8 à 4-6 pour douze des quinze) et la fausse justification
    remplacée par ce qui s'est réellement passé.

### Bugs du lot B2 (2026-08-03)

53. **Le bypass a cessé de prouver quoi que ce soit dès l'arrivée des vidéos.**
    « Figer l'aperçu » arrêtait la *progression*, pas la *source*. Tant que les
    vignettes tournaient sur des images fixes, les deux revenaient au même. Avec
    un rush qui avance, plus du tout : le scrub comparait deux instants
    différents du plan, et surtout l'avant/après du bypass différait par l'effet
    **et** par le contenu. Trouvé par l'assertion « le relâchement rend l'effet »
    du lot B1, qui s'est mise à échouer. Corrigé par `librarySourceFreeze.js` :
    hors de la boucle, la vignette dessine une **copie** prise au moment où elle
    a quitté la boucle.
54. **Une assertion du lot B1 était fragile par construction, et le lot B2 l'a
    révélée.** « la progression change toute seule » échantillonnait sur 400 ms
    alors que la boucle marque une tenue de **700 ms** à chaque bout, dans un
    cycle de 3 s. Elle ne passait que grâce à un **artefact de cache** : sans
    redessin pendant la tenue, l'attribut gardait la valeur périmée du scrub et
    *paraissait* avoir changé. Dès qu'une vidéo force le redessin à chaque image,
    la vraie valeur — 0 pendant la tenue — s'affiche et l'assertion tombait deux
    fois sur trois. Remplacée par une attente active de 4 s. Mesuré : 2 échecs
    sur 3 avant, 3 succès sur 3 après.
55. **Une assertion de cadence tenait sur cinq unités de marge.** « la lecture
    avance de façon continue » comptait les écritures du curseur pendant une
    seconde et exigeait plus de 15 : le store en écrit ~11, l'horloge ~16. Le
    décodage vidéo concurrent qu'ajoutent les bibliothèques depuis le lot B2 a
    suffi à la faire passer sous la barre — **14, puis 12** — environ deux fois
    sur cinq en suite complète, jamais en isolation. **Une première correction
    a échoué sur une hypothèse fausse** : je pensais que `MutationObserver`
    regroupait ses appels et que compter les mutations donnerait ~60 au lieu de
    ~16. Mesuré : aucun changement. Le curseur écrit réellement ~16 fois par
    seconde ici. Corrigé en mesurant **trois fois et en gardant la meilleure** :
    l'assertion porte sur une capacité, pas sur l'ordonnancement du pire cas, et
    un vrai retour aux rendus React resterait rouge aux trois mesures.
58. **La secousse aurait sauté au lieu de trembler.** Choisie à 7,5 Hz, elle
    n'est échantillonnée que **4 fois par cycle** à 30 images/s (3,3 pour l'axe
    vertical à 9,1 Hz) : elle se serait lue comme un saut entre quatre positions,
    et son aspect aurait changé avec la cadence d'export. Ramenée à 3,7 et
    4,9 Hz — 8,1 et 6,1 échantillons par cycle, et c'est aussi la plage d'une
    vraie caméra portée. Trouvé en cherchant pourquoi deux sentinelles restaient
    muettes.
59. **Le test de parité était aveugle aux accents.** Un accent ne déplace le
    cadre que de ±3,8 px sur 320, soit **sous le seuil de 12/255** qu'il faut
    tolérer pour le rééchantillonnage. Un renderer qui aurait divisé l'amplitude
    par deux serait donc resté « en parité ». Pire, trois des cinq images
    échantillonnées tombaient **pile sur les passages à zéro** de l'oscillation.
    Corrigé sur les deux plans : des points de mesure propres aux accents, et
    surtout une comparaison de **l'amplitude du mouvement** de chaque côté plutôt
    que des images seules. Quatre sentinelles vérifiées après correction, dont
    deux qui ne l'étaient pas avant.
57. **Le mouvement d'une vidéo était perdu à deux endroits invisibles.** En
    ouvrant les mouvements aux vidéos, l'interface les proposait et le clic ne
    prenait pas. Deux gardes `isImageMedia` restants, tous deux dans le store :
    `motion` était remis à `null` **à l'import** et **à chaque mise à jour**. Le
    manifeste d'export en avait un troisième, qui aurait perdu le mouvement en
    route même une fois l'écran corrigé. Trouvé par le test navigateur ajouté
    exprès — les onze tests de mouvement existants utilisent des photos et
    n'auraient jamais rien vu.
56. **L'assertion B2 « le clip avance tout seul » avait la même faiblesse** :
    un écart de 2,0 pour un seuil de 2. Sous charge, 700 ms de lecture ne
    faisaient avancer le clip que d'une image ou deux. Fenêtre portée à 2 s.
    Cinq exécutions complètes de suite après correction : **64/64 à chaque
    fois**.


---

## Problèmes connus, non résolus

| # | Problème | Nature |
|---|---|---|
| ~~A~~ | ~~`npm run test:scope` échoue sur le mot « jardin » dans un texte immobilier.~~ | ✅ **Résolu le 2026-08-01.** Le garde porte désormais sur le **nom complet** du projet source, séparateurs tolérants. Deux assertions périmées de la même famille sont alignées au passage (Node 20 → 22 ; firebase-functions 6 → 7, firebase-admin 13 → 14), et la cohérence des trois déclarations de version de Node (`.nvmrc`, racine, `functions/`) est maintenant vérifiée. **`npm run test:scope` est vert.** |
| ~~K~~ | ~~`test:vibecut-transition-cost` échoue sur `rgb-split` (1,23 s pour un plafond de 1,2 s).~~ | ✅ **Résolu le 2026-08-04.** Ce n'était pas une régression : le rapport au natif TOMBAIT de ×3,5 à ×2,9 — l'effet était devenu moins cher. Ce qui avait bougé, c'est la machine (référence native 0,43 s contre 0,23 s quand le plafond a été posé, et 0,16 à 0,45 s d'une exécution à l'autre dans la même session). **Le plafond n'a pas été relevé : il a changé d'UNITÉ.** Il s'exprime désormais en multiples du natif (×6), ce qui est exactement ce que « 1,2 s pour un natif de 0,2 s » voulait dire — le chiffre ne change pas. Corrige au passage une incohérence d'origine : le fichier mesurait sa référence à chaque exécution en disant « c'est le RAPPORT qui a un sens », puis assertait en secondes absolues. La voie par expression coûte ~40× le natif : elle reste refusée avec la même marge. Vérifié : deux exécutions vertes, et sur une machine reposée `rgb-split` retombe **exactement** sur sa mesure documentée du 2026-08-03 (0,81 s, ×3,5). |
| ~~L~~ | ~~`smoke-vibecut-library-b1.spec.cjs` : le test des favoris échoue après le rechargement de page, sur un écran de connexion.~~ | ✅ **Résolu le 2026-08-04.** Cause réelle : `bypassAuth` clique le bouton de contournement **s'il est visible à cet instant**, or `page.reload({ waitUntil: "domcontentloaded" })` rend la main **avant l'hydratation React** — le bouton n'existe pas encore, le contournement ne se fait pas, et le test poursuit sur l'écran de connexion. `open()` ne souffrait pas du défaut parce qu'il attend le réseau **avant** de contourner. Les deux chemins partagent maintenant la même séquence (`settle`), pour que l'oubli ne puisse pas se reproduire. Vérifié : **trois exécutions consécutives, 17/17 à chaque fois**. À noter pour la méthode : l'échec a d'abord été exonéré à tort comme « environnemental » — il se reproduisait à l'identique avec le code du lot d'accents neutralisé, ce qui prouvait seulement qu'il n'était pas **causé** par ce lot, pas qu'il était hors du code. |
| B | `scripts/smoke-vibecut-media-safety.spec.cjs` : 3 échecs. Les captures Playwright montrent « This page couldn't load » → **crash du moteur de rendu** sur les fixtures WebM de 7 Mo. | Préexistant, fichier non commité (WIP d'une session antérieure). |
| C | `npm run test:vibecut-export-local-mp4` échoue : ses fixtures pointent `C:\Users\pcpor\…`. | Environnement (machine Windows d'origine). |
| D | Les `.mp4` de `videotest/` sont des **pointeurs Git LFS de 132 octets**. | Les smokes du nouveau front fabriquent leurs médias avec `ffmpeg-static`. |
| ~~E~~ | ~~Le renderer Cloud Run doit être redéployé pour que les 15 transitions de L1 et la courbe + l'intensité de L3 apparaissent dans les exports serveur.~~ | ✅ **Résolu le 2026-08-01.** Rollout effectué : révision `00006-6fw`, image `l6-af59e70-20260801`. Vérifié sur la production : 15/15 cibles `xfade`, `errorCount: 0`, `/render` toujours protégé (401 sans signature). L'ancienne révision `00005-vf2` reste disponible pour un retour arrière immédiat. **Ce que l'aperçu montre est désormais ce que l'export produit.** |
| F | **`zoom-punch` (`xfade=zoomin`) écarté du vocabulaire.** Les images de référence montrent une magnification extrême jusqu'à un aplat uniforme au milieu du fondu : laid sur photo, et disproportionné à reproduire au canvas. | Décision produit du 2026-07-30. 15 transitions au lieu des 16 prévues. Si un accent de zoom est voulu, il viendra du **mouvement (L3)**, pas d'une transition. |
| ~~H~~ | ~~`titleStyle` et `audioProfile` portés par le modèle mais pas appliqués.~~ | ✅ **Résolu le 2026-08-01 (lot L5).** Trois résolveurs purs les traduisent en propriétés rendues des deux côtés, et changer de preset re-style le titre déjà posé. |
| I | ✅ **Vérifié automatiquement depuis le 2026-08-03 (lot B3)** : `smoke-vibecut-motion-envelope` échantillonne la trajectoire **entière** de chaque preset à quatre intensités et refuse tout dépassement, ainsi que tout zoom passant sous 1. Le contrôle manuel sur les deux extrémités ne suffisait plus dès qu'un trajet cesse d'être une droite. **`zoompan` borne sa fenêtre à l'image, le canvas non.** *(Depuis la phase 5, l'éditeur de trajectoire de `/video/mouvements` fait respecter la condition au lieu de la documenter : on ne peut plus construire un mouvement inexportable depuis l'interface. La contrainte reste à vérifier pour tout ajout au catalogue en phase 6.)* Un mouvement dont la fenêtre sort du cadre diverge franchement entre aperçu et export (74/255 mesurés sur un cas volontairement débordant). La condition à tenir est `\|x\| ≤ (zoom − 1) / 2`. | Les **11 mouvements** et les **2 accents** livrés la respectent : marge la plus tendue relevée le 2026-08-04 — `pan-left`/`pan-right` à 91,7 %, la secousse à 80,0 %. Vérifié automatiquement à chaque exécution, plus rien à faire à la main. |
| J | **`GET /capabilities` du renderer est sans authentification, sur un service Cloud Run public.** Sa réponse ne porte donc **ni la version de FFmpeg ni le texte des erreurs** — seulement `ok`, la révision, les cibles manquantes et un compteur d'erreurs. | **Choix délibéré du 2026-08-01, pas un oubli.** Une bannière de version renseignerait gratuitement quelqu'un qui cherche les CVE de ce build. Le détail va dans les journaux Cloud Run (`gcloud run services logs read vibecut-render-service --region europe-west9 --project vibefx-v2 \| grep capabilities`). Documenté dans `render-service/src/server.js`, `render-service/README.md`, le runbook et verrouillé par `smoke-vibecut-library-parity.mjs`. Si le service passe en Cloud Run privé, la précaution devient facultative. |
| G | Trois écarts de parité **structurels** subsistent, bornés par test : le grain de `film-dissolve` (FFmpeg tire un bruit par pixel), le noyau de flou de `blur-cut`, et `desat-fade` (le `grayscale()` du navigateur utilise Rec.709, FFmpeg Rec.601 → un rouge saturé ressort plus clair à l'export). | Assumés et documentés dans `xfadeTransitions.js`. Les seuils du test servent à détecter une **dérive**, pas à prétendre à l'exactitude. |

---

## Reste à faire

> **Chantier en cours : les deux bibliothèques.**
> Feuille de route complète : **[docs/vibecut-bibliotheques-roadmap-2026-08-02.md](docs/vibecut-bibliotheques-roadmap-2026-08-02.md)**

### Lot B1 — Fondation du design · ✅ **livré le 2026-08-02**

Voir la section « Lot B1 » plus haut dans *Fait*. Reste volontairement **hors**
de ce lot, et c'est assumé :

- [ ] **Thèmes éditoriaux** (`Réseaux sociaux`, `Voyage`, `Produit`, `Récit`,
      `Souvenirs`, `Musique`) : c'est de la donnée éditoriale à écrire à la main
      pour 51 entrées, et la roadmap la range **après** B1 (§ 5.5).
- [ ] **Hover scrub au doigt** : sur pointeur tactile, la vignette continue de
      boucler et le tap sélectionne. Un scrub au doigt avalerait le tap. Le
      jugement précis se fait alors dans le grand aperçu, qui a son curseur. Le
      sous-titre qui décrit le survol est masqué sous 720 px pour ne pas promettre
      une interaction qui n'existe pas là.
- [x] ~~**Mesure d'images par seconde**~~ — **fait** : 60,2 im/s au repos et
      60,1 im/s avec un scrub, sur les 38 vignettes. Test permanent, plancher à
      24 im/s. **À refaire au lot B2** : c'est l'arrivée de vraies vidéos dans les
      aperçus qui changera réellement la charge, pas le nombre de canvas.
- [x] ~~**Le fond du problème des 23 transitions « aperçu uniquement »**~~ —
      **traité au lot B3a le 2026-08-02**, le porteur du projet ayant tranché la
      recommandation d'ordre en faveur de cet écart. Il en reste **15**, et pour
      celles-là aucune cible `xfade` native ne rend l'effet : les faire passer
      demande de vraies chaînes de filtres FFmpeg, donc du B3 complet.

### Lot B3a — Fermeture de l'écart d'export · ✅ **livré le 2026-08-02**
- [x] Les 31 cibles `xfade` natives inutilisées **rendues et mesurées** une par une.
- [x] **8 entrées existantes** re-affectées à la cible qui tient leur promesse,
      **10 entrées nouvelles**. Exportables **15 → 33**, catalogue 38 → **48**,
      « aperçu uniquement » 23 → **15**.
- [x] Parité prouvée : 29 cibles comparées image par image, **34 MP4 réels**
      construits par le `buildFfmpegArgs` du renderer lui-même.
- [x] ~~Rollout Cloud Run~~ — **fait le 2026-08-02**, révision **`00007-b5c`**.
      29 cibles `xfade` sur 29 vérifiées sur le service réel, `errorCount: 0`,
      `/render` toujours protégé. Le badge « Export Pro » ne devance plus la
      production.

### Lot B3b — Les 15 dernières transitions · ✅ **terminé le 2026-08-03, rollout inclus**

> Plan et retour d'expérience : **[docs/vibecut-transitions-b3b-plan-2026-08-02.md](docs/vibecut-transitions-b3b-plan-2026-08-02.md)** (§ 10)
> Le détail de ce qui a été livré est dans la section « Lot B3b » plus haut, dans *Fait*.

**Fait :**
- [x] **Étape 0** — `zoompan` sur entrée vidéo : **levé sans réserve**. Pas de gel,
      pas d'image dupliquée, compteur `on` exact à l'image près.
- [x] **Étape 1** — `buildTransitionSubgraph` émet un vrai sous-graphe, étiquettes
      préfixées par l'index de la coupe. Le banc d'essai de parité itère sur les
      **ids** et construit le côté FFmpeg **avec le code du renderer**.
- [x] **Étapes 2 à 6** — les 15 transitions, implémentées des deux côtés.
- [x] **`blur-dissolve` vs `cross-blur`** — tranché : séparés par la **courbe**
      autant que par l'intensité (`ramp` contre `bell`).
- [x] **Question produit sur les ouvertures** — tranchée par le porteur du projet :
      gardées comme transitions, rendues à l'export, **et marquées** dans la
      bibliothèque. Le lot est resté à 15.
- [x] **48 exportables sur 48**, 0 en aperçu seul (`smoke-vibecut-library-parity`).
- [x] **Coût plafonné et mesuré** (`test:vibecut-transition-cost`) : le plus cher
      est `chromatic` à 0,83 s pour un plafond de 1,2 s (natif : 0,23 s).
- [x] **MP4 réel sur trois plans enchaînés** (`test:vibecut-transition-chain-mp4`) :
      compte d'images exact, les deux coupes portent l'effet, hors fenêtre rien ne
      bouge. C'est ce test qui a trouvé les bugs 45, 46, 47 et 48.
- [x] `test:vibecut-xfade-local-mp4` (49 rendus), `test:vibecut-export`,
      `test:scope`, `lint`, `build`, `npm --prefix functions run lint`.
- [x] Les 26 tests navigateur des deux bibliothèques, réécrits pour la nouvelle
      réalité (48/48, badge d'usage, filtre « Entre deux plans »).

**Fait aussi, et c'est ce qui restait ouvert :**

- [x] **`test:vibecut-xfade-preview-parity` est VERT.** La cause n'était pas
      `additive-dissolve` : c'était un **défaut de sentinelle laissé dans
      `xfadeTransitions.js`** par une exécution interrompue (bug 52). Deux mesures
      consécutives sans rien changer ont rendu des valeurs identiques au dixième,
      donc pas de bruit, donc un bug. Corrigé, et les seuils **resserrés** sur la
      mesure réelle au lieu d'être montés : `meanFrame` passe de 8 à **4-6** pour
      douze des quinze, chaque entrée portant sa pire mesure datée.
- [x] **`test:vibecut-transition-sentinels` mené au bout** pour la première fois :
      **5 défauts rejoués, 5 attrapés.**
- [x] **Rollout Cloud Run fait, une seule fois.** Image
      `b3b-21b8030-20260803`, révision **`00008-8gr`**. Vérifié sur le service
      réel : `capabilitiesVersion 5`, **29 cibles `xfade` sur 29**, **20 filtres
      sur 20**, `missing: []`, `errorCount: 0`, `/render` toujours protégé
      (401 sans signature). Retour arrière : `00007-b5c`.

**Ce que ce lot laisse comme règle de travail :**
- Après toute exécution de `smoke-vibecut-transition-sentinels`, **et surtout
  après une interruption**, faire un `git diff` sur `render-service/src/server.js`
  et `src/features/vibefx-studio/video/engine/xfadeTransitions.js` avant de
  conclure quoi que ce soit d'un test.
- **Ne jamais monter un seuil de parité pour faire passer un test.** Mesurer deux
  fois d'abord ; si les deux mesures coïncident, l'écart est un bug. Ici le seuil
  qui échouait avait raison, et le monter revenait à faire taire le seul test qui
  disait vrai.
- Une justification de seuil doit citer **une mesure datée**, pas un mécanisme
  plausible.

### Lot B2 — De vraies vidéos dans les aperçus · ✅ **livré le 2026-08-03**
- [x] `useLibraryMedia` : vidéos du projet → photos → clips de démo → repli dessiné.
      Les vidéos passent **devant** les photos, vérifié par 6 règles d'ordre.
- [x] Clips de démo : **2 clips, 2 s, 720p, 77 Ko au total** (plafond 1,5 Mo),
      **générés** et non téléchargés — droits déclarés dans
      `libraryMediaManifest.js`, reproductibles par
      `npm run build:vibecut-demo-clips`.
- [x] Copie figée hors boucle (`librarySourceFreeze.js`) — sans elle le bypass
      ne prouvait plus rien (bug 53).
- [x] Cadence re-mesurée sur sources vidéo : **60,3 / 60,1 img/s**, plancher 24.
- [x] Gates : `smoke-vibecut-library-media.mjs` + `smoke-vibecut-library-b2.spec.cjs`
      (4 tests, vérifiés **en échec** quand on casse la chaîne de repli).
- [ ] **Décision laissée au porteur du projet** : remplacer les clips générés par
      du vrai rush (Mixkit / Pexels). C'est un changement de **données** —
      déposer les fichiers dans `public/assets/vibecut-demo/`, ajouter leur
      entrée avec licence et URL d'origine. Aucun code ne bouge.
      **Sources décidées : Mixkit ou Pexels**, téléchargés et compressés par
      l'agent, **validés par le porteur du projet**.
- [ ] ⚠️ **Droits déclarés comme pour la musique** : manifeste versionné avec
      source, licence et URL. Le projet refuse déjà toute piste audio sans
      déclaration ; introduire des médias sans provenance ici serait le laxisme
      qu'on a précisément évité.

### Lot B3 · 1ʳᵉ tranche — Trois mouvements de plus · ✅ **livré le 2026-08-03**

- [x] **Descente**, **orbite**, **rebond** rendus des deux côtés. Catalogue :
      **9 disponibles, 4 annoncés** (contre 6 et 7).
- [x] **Deux généralisations du modèle**, reprises à l'identique par le renderer :
      `arc` (écart perpendiculaire, nul aux bouts) et `curve: 'overshoot'`
      (dépassement avant de se poser). Les deux restent un polynôme ou un sinus,
      donc évaluables sans surcoût par `zoompan`.
- [x] **`smoke-vibecut-motion-envelope`** : problème I sur la trajectoire
      **entière** (9 presets × 4 intensités × 201 points) + concordance des
      **quatre** tables de presets. **Trois sentinelles vérifiées** : bosse trop
      grande, zoom passant sous 1, table serveur divergente.
- [x] **Parité image par image sur MP4 réel** étendue : 12 cas × 5 images, chaque
      nouveau mouvement mesuré à **deux intensités** — la bosse et le dépassement
      sont mis à l'échelle par l'intensité, une des deux écritures pouvait
      l'oublier.
- [x] **`/capabilities` version 6** : rapporte les mouvements acceptés. Le
      pré-vol refuse une image antérieure au lot, **vérifié contre la production
      avant de déployer**.
- [x] **Rollout** : image `b3-motions-20260803`, révision **`00009-8b7`**,
      9 mouvements sur 9 acceptés, `errorCount: 0`, `/render` à 401.

### Lot B3 · 2ᵉ tranche — Les mouvements sur vidéo · ✅ **livré le 2026-08-03**

- [x] Garde `isImageMedia` levé aux **six** endroits (canvas, renderer,
      manifeste, store ×2, adaptateur, interface).
- [x] Cas de parité sur **source vidéo rognée à 0,5 s** — prouve aussi que la
      course se mesure sur le segment. **Sentinelle vérifiée.**
- [x] Test navigateur sur une vraie vidéo, avec persistance après rechargement.
- [x] Libellés corrigés (« N plans » et non « N photos »).
- [x] **Rollout** : `b3-video-motion-20260803`, révision **`00010-trj`**.

**Les 4 mouvements restants, et ce qui les bloque exactement** — aucun n'est « à finir » :
- [ ] **Rotation** — demande le filtre `rotate` (serveur) et `ctx.rotate`
      (aperçu). Faisable, mais c'est une capacité nouvelle à mesurer et à
      déclarer.
- [ ] **Apparition** — demande l'**opacité**, absente du modèle de mouvement, et
      un zoom **sous 1** qui laisserait un bord à l'image.
- [ ] **Parallaxe** — « plans avant et arrière à vitesses différentes » est
      **impossible sur une photo plate** sans estimation de profondeur. Le livrer
      en zoom+panoramique renommé serait exactement la promesse non tenue que
      `plan.md` § 6 interdit. **Décision produit à prendre : renommer ou retirer.**
- [ ] **Glitch** — ce n'est pas un mouvement de caméra mais un **effet pendant le
      plan**. Il relève du lot ci-dessous.

### Lot B3 — Le contenu qui manque (ex-phase 6)
- [ ] Les 7 mouvements `planned` : descente, orbite, parallaxe, rotation,
      apparition, rebond, glitch.
- [ ] **Mouvements applicables aux vidéos** (aujourd'hui : photos seulement).
- [ ] **Effets pendant le rush** — c'est là que le retard sur Premiere et DaVinci
      est réel, et le porteur du projet l'a relevé lui-même : secousse, flou
      directionnel animé, fuite de lumière, vignettage animé, grain animé, zoom
      pulsé. **Aucun n'existe aujourd'hui.**
- [x] ~~Transitions supplémentaires parmi les 46 cibles `xfade` natives~~ —
      **fait au lot B3a** : **29** cibles employées sur 46. Écartées après
      mesure : `zoomin` (problème F), `fadefast` et `fadeslow` (leur poids de
      mélange dépend de la valeur du pixel, pas seulement du temps — aucune table
      de courbe ne peut les reproduire sans que l'aperçu mente). Non retenues
      faute d'intérêt suffisant pour leur coût : `distance`, `radial`, les quatre
      `diag*`, les quatre `wipe*` de coin, les quatre `*slice`.
- [ ] Les **15 transitions restées « aperçu uniquement »** : c'est le **lot B3b**,
      cadré et planifié le 2026-08-02 →
      **[docs/vibecut-transitions-b3b-plan-2026-08-02.md](docs/vibecut-transitions-b3b-plan-2026-08-02.md)**.
      Aucune cible `xfade` native ne les rend : il faut construire des chaînes de
      filtres natifs rampés sur la queue de A et la tête de B.
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
npm run test:vibecut-ui-v2      # recettes + parités + chaîne 3 plans + coût + 60 tests navigateur
npm run test:vibecut-recipes    # moteur de recettes seul, sans navigateur
npm run test:vibecut-library    # parité catalogue ↔ moteur ↔ capacités serveur
npm run test:vibecut-export     # chaîne d'export (exit 0 attendu)
npm run test:vibecut-xfade-preview-parity   # aperçu canvas vs FFmpeg, image par image
npm run test:vibecut-motion-parity          # mouvement : MP4 réel vs aperçu
npm run test:vibecut-transition-chain-mp4   # TROIS plans enchaînés : repères de temps, compte d'images
npm run test:vibecut-transition-cost        # plafond 1,2 s pour 0,6 s en 1080p
npm run test:vibecut-transition-sentinels   # rejoue 5 défauts, exige 5 échecs (lourd : 7 rendus)

# Pré-vol du lot L6 — aucun déploiement, aucun rendu
node scripts/check-vibecut-renderer-image-capabilities.mjs                 # FFmpeg local
VIBECUT_RENDERER_URL=<url> node scripts/check-vibecut-renderer-image-capabilities.mjs   # image déployée
```

---

## Prompt de relance — finir le contenu (grain, flou animé, fuite de lumière, glitch)

> À copier tel quel dans un nouveau chat.

Tu reprends le développement de VibeCut dans le projet Vibe_fx V2
(`/Users/matthis/Desktop/mes projets mac/vibe_fxV2`).

AVANT TOUTE CHOSE, lis dans cet ordre :
1. `AGENTS.md` — règles de travail, discipline de déploiement et de coûts
2. `plan.md` — DIRECTION ARTISTIQUE (§ 4 en entier), parité § 8, risques § 10
3. `todo.md` — le **POINT SITUATIONNEL** en tête, puis les bugs 1 à 59
4. `docs/vibecut-transitions-b3b-plan-2026-08-02.md` — **§ 10, surtout § 10.9**
5. `map.md` — carte du projet

## CE QUI EST FAIT

- **Transitions : terminées.** 48 au catalogue, 48 exportables.
- **Mouvements : terminés.** 11 rendus sur 12, sur photos **et** vidéos.
- **Effets pendant le plan : commencés.** Secousse et Respiration livrées.
- **Bibliothèques** : vraies vidéos dans les aperçus, hover scrub, favoris.
- **Déployé** : révision **`00012-xht`**, `capabilitiesVersion 7`. Vérifié sur le
  service réel : 29 cibles `xfade`, 20 filtres, 11 mouvements, 3 accents,
  `errorCount: 0`, `/render` à 401. **Aucun écart aperçu ↔ production.**
  Retour arrière : `00011-6nb`.

Sont verts : `lint`, `build`, `test:scope`, `test:vibecut-export`,
`test:vibecut-library`, `test:vibecut-motion-parity` (20 cas),
`test:vibecut-xfade-preview-parity`, `test:vibecut-transition-chain-mp4`,
`test:vibecut-transition-cost`, `test:vibecut-transition-sentinels` (5/5),
`npm --prefix functions run lint`, et **66 tests navigateur**.

## TA MISSION : les derniers effets pendant le plan

Il reste **quatre** effets, et c'est tout ce qui reste du produit :
**grain animé**, **flou animé**, **fuite de lumière**, **glitch**.

⚠️ **Ils ne ressemblent PAS aux deux premiers, et c'est le point à comprendre
avant d'écrire une ligne.** Secousse et Respiration ont été faciles parce
qu'elles se ramènent à un **décalage du cadrage** : elles entrent donc dans
l'expression `zoompan` qui existait déjà et dont la parité était déjà prouvée
image par image. Les quatre restants n'ont pas cette propriété. Chacun demande
sa propre mécanique **et sa propre preuve** :

- **Grain animé** — `noise=alls=N:allf=t+u` côté serveur. Le bruit est **tiré au
  hasard par pixel** : il ne sera JAMAIS reproductible au canvas. Même situation
  que la transition `film-dissolve` (problème G) : seule la **moyenne** est
  comparable, la géométrie ne l'est pas. Écris-le dans la tolérance, avec la
  mesure, et ne prétends pas à l'exactitude.
- **Flou animé** — `gblur` à sigma variable. `sendcmd` est **inutilisable** (il
  diffuse à tout le graphe, cf. § 10.2 du doc B3b) : utilise une **chaîne de
  filtres à valeur constante gatés par `enable`**, comme `steppedChain` dans
  `render-service/src/server.js`. Et l'aperçu devra **quantifier** sa progression
  de la même façon (`quantizeProgress`), sinon l'écart se lit comme du bruit.
- **Fuite de lumière** — un dégradé chaud généré petit puis agrandi, composé en
  addition. Le code existe déjà pour la **transition** `light-leak` : regarde
  comment elle est faite avant de repartir de zéro.
- **Glitch** — même remarque : la transition `glitch` existe et fait déjà des
  bandes décalées (`displace`) plus un décalage RVB. **Attention** : `displace`
  lit `out(x) = in(x + carte − 128)`, et le sous-échantillonnage de chroma du
  `yuv420p` étale les franges sur deux pixels — il faut forcer `gbrp` autour de
  l'effet (l'écart tombe de 23 à 4).

**Le glitch est aussi la dernière carte « Bientôt »** de `/video/mouvements` :
le livrer ferme le catalogue à 12 sur 12.

## COMMENT AJOUTER UN EFFET (le chemin est rodé)

Un ajout touche **cinq** endroits, et en oublier un fait échouer un test — c'est
voulu : `mediaModel.js`, `render-service/src/server.js` (table **et** verrou),
`functions/src/videoExport.js`, `exportManifest.js`, `data/motionCatalog.js`.
Puis `test:vibecut-motion-envelope`, `test:vibecut-motion-parity`, un test
navigateur, et **un seul** rollout en fin de lot.

**Le critère qui a tout décidé jusqu'ici** : si l'effet s'écrit comme un
polynôme ou un sinus, il entre dans `zoompan` et il est presque gratuit. Sinon,
c'est une mécanique à part — dis-le, et prévois la preuve qui va avec.

## RÈGLES NON NÉGOCIABLES

- **Problème I** : `|x| ≤ (zoom − 1) / 2` **à tout instant**.
  `smoke-vibecut-motion-envelope` le vérifie sur 201 points × 4 intensités.
- Ne propose jamais une fonction que le moteur ne rend pas : « Bientôt », et
  AUCUN réglage dessus.
- Les aperçus restent **DESSINÉS PAR LE MOTEUR**. JAMAIS une imitation CSS.
- Aucun composant de `features/vibecut/` n'importe le store ni IndexedDB.
- Zéro Tailwind sur `/video`. CSS Modules + tokens de `styles/vibecut.css`.
- Le temps ne passe **JAMAIS** par un `setState` dans les bibliothèques.
- **Ne me réponds pas en pavés.** Trois blocs courts : ce qui marche · ce qui
  reste · ce que j'attends de toi. ~15 lignes. Le détail va dans `todo.md`.

## LEÇONS DÉJÀ PAYÉES — ne les repaie pas

**Sur les tests, et c'est le plus cher :**
- **Ne monte JAMAIS un seuil pour faire passer un test.** Mesure deux fois sans
  rien changer. Si les deux mesures coïncident, c'est un **bug** (bug 52).
- **`smoke-vibecut-transition-sentinels` patche le code de production** puis le
  restaure. **Interrompu, il laisse son défaut.** `git diff` après chaque
  exécution, et n'édite pas `server.js` / `xfadeTransitions.js` pendant.
- **Un test qui passerait aussi bien si la fonction n'existait pas ne prouve
  rien** (bugs 53, 54, 59). Vérifie qu'il **échoue** quand tu casses la fonction.
- **Un effet de faible amplitude passe sous le seuil du test qui le surveille.**
  Un accent bouge de ±3,8 px sur 320, sous les 12/255 tolérés pour le
  rééchantillonnage : la comparaison image par image le déclarait « en parité »
  même quand le renderer en rendait la moitié. Mesure une grandeur
  **différentielle** (bug 59).
- **Vérifie le rapport cadence / fréquence** avant de choisir une oscillation :
  à 7,5 Hz et 30 img/s il n'y a que 4 échantillons par cycle, l'effet saccade et
  les points de mesure tombent sur ses zéros (bug 58).

**Sur FFmpeg :**
- **Une variable d'un filtre n'appartient pas au suivant.** `on` n'existe que
  dans `zoompan` ; donné à `rotate`, il fait échouer le graphe à la
  configuration sans dire ce qui manque (lot B3, 4ᵉ tranche).
- **`zoompan` ne laisse rien au-delà de ses bords** : tout ce qui fait sortir du
  cadre (bascule, déplacement) exige de rendre un cadre **plus grand** puis de
  recadrer, pas seulement d'agrandir le zoom.
- **Préfère les NUMÉROS D'IMAGE aux secondes.** `fade` en secondes lit des
  horodatages qui ne sont pas encore remis à zéro ; `concat` en secondes perdait
  une image sur 102 (lot B3b).
- `sendcmd` diffuse à **TOUS** les filtres du graphe. Utilise `steppedChain`.
  **Un test sur deux plans ne voit rien.**
- L'aller-retour `yuv420p ↔ gbrp` coûte 1,1 s sur tout un montage : confine la
  fenêtre (`isolateWindow`).
- `zoompan` sur vidéo : **sans réserve**. Son expression accepte `pow`, `sin`,
  `cos`, `PI`, `abs`. Ne le re-teste pas.

## ÉCHECS DE TESTS PRÉEXISTANTS

- `smoke-vibecut-media-safety.spec.cjs` : 3 échecs, crash Chromium (problème B).
- `test:vibecut-export-local-mp4` : fixtures Windows (problème C).
- Les `.mp4` de `videotest/` sont des pointeurs Git LFS (problème D).
- **N'ouvre pas `npm run dev` avant de lancer la suite** : il occupe le port
  3000, les tests tapent dessus au lieu du build, et la suite passe de 55 s à
  17 min avec des échecs fantômes. Mesuré le 2026-08-03.
- La suite est sensible à la charge : relance en isolation avant de conclure.

## COMMANDES

```bash
npm run dev                     # http://localhost:3000/video (à COUPER avant les tests)
npm run lint && npm run build
npm run test:scope
npm run test:vibecut-ui-v2      # tout + 66 tests navigateur
npm run test:vibecut-library    # catalogue + médias/droits + enveloppe des mouvements
npm run test:vibecut-motion-envelope   # problème I sur toute la trajectoire
npm run test:vibecut-motion-parity     # MP4 réel vs aperçu, image par image
npm run test:vibecut-transition-sentinels   # lourd, ne rien éditer pendant

VIBECUT_MOTION_REPORT_ONLY=1 npm run test:vibecut-motion-parity   # mesurer sans échouer
VIBECUT_MOTION_SHOT_DIR=/tmp/shots npm run test:vibecut-motion-parity  # garder les images
```

**Discipline de coûts** : le renderer est déployé (`00012-xht`). Ne redéploie que
si `render-service/` change, **une seule fois en fin de lot**, après le pré-vol
`node scripts/check-vibecut-renderer-image-capabilities.mjs`, puis vérifie sur le
service réel avec `VIBECUT_RENDERER_URL=` et reporte la révision.

---

## PROMPT DE RELANCE — CHANTIER VIBEOS (phase B, Layout)

> Lis `AGENTS.md`, puis `docs/plan-vibeos-redesign-2026-08-08.md` en entier
> (surtout §5.2 Layout et §4.2/4.3). La phase A est livrée : design system
> `.vibeos`, primitives, shell, store projet et accueil sur `/creer`. Exécute la
> phase B : remplace le placeholder de `/creer/layout-visuel` par le vrai écran
> Layout — mode simple en 4 blocs (Format, Modèle, Images, Habillage), canvas
> branché sur les moteurs EXISTANTS (`vibefx-layout/engine`,
> `vibefx-studio/hooks/useCanvasRenderer` & co, importés, jamais réécrits),
> sheet des templates thématiques avec vrais aperçus, réglages avancés en
> Collapsible, écriture de `project.thumbnail`, mobile sérieux. Interdits :
> Tailwind dans le nouveau code, toute modification de `/studio` et de
> `src/features/vibefx-studio` (hors extraction de logique partagée). Critère
> bloquant : export identique au pixel près à l'ancien onglet Layout. Termine
> par le rituel de fin de phase (lint, build, smokes, todo.md, map.md, prompt
> de relance phase C).
