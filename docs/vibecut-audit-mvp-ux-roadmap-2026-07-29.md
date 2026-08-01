# VibeCut — Audit produit/UX du MVP et roadmap d'implémentation

- Date : 2026-07-29
- Périmètre : éditeur vidéo VibeCut, montage social photo + vidéo, timeline, transitions, effets, export local et Google Cloud.
- Cible produit : vidéos sociales jusqu'à 10 minutes, priorité Reels/Stories/Shorts/TikTok, 1080p et jusqu'à 60 FPS.
- Statut : audit du code exécutable et test réel de l'interface locale. Ce document est une feuille de route, pas une validation de release.

## 1. Verdict exécutif

VibeCut possède déjà une base technique plus riche qu'un simple prototype : preview Canvas, timeline multi-pistes, trims, réordonnancement, transitions, filtres, texte, audio, presets de sortie, manifest d'export et renderer FFmpeg. Le problème principal n'est pas l'absence de fonctionnalités. C'est l'absence d'un parcours produit cohérent entre ce que l'interface promet, ce que le modèle de projet représente et ce que l'export professionnel sait réellement rendre.

Aujourd'hui, je peux utiliser l'éditeur pour importer deux vidéos valides, les voir sur une timeline et produire un montage très simple. Je ne peux pas encore l'utiliser de façon fiable pour le cas d'usage demandé :

- les photos ne sont pas importables dans l'éditeur vidéo ;
- aucun modèle Ken Burns/zoom/pan animé n'existe pour les images ;
- l'interface montre des transitions et animations qui bloquent ensuite l'export Pro ;
- un WebM annoncé comme supporté peut faire planter toute la timeline ;
- l'écran vide affiche déjà sept pistes et plusieurs commandes concurrentes ;
- l'interface est extrêmement dense et peu lisible sur un écran 1280 × 720 ;
- le renderer cloud actuel ne reproduit qu'un sous-ensemble du montage visible.

La bonne stratégie n'est donc pas d'ajouter encore plus de panneaux. Il faut construire une tranche verticale fiable :

> Importer 10 photos et 2 vidéos, choisir un preset Reel, appliquer automatiquement des mouvements et transitions, corriger quelques scènes, puis exporter un MP4 1080 × 1920 propre sans rencontrer une fonction non exportable.

Cette tranche verticale doit devenir la référence produit et la fixture de test centrale.

## 2. Comment l'audit a été réalisé

Les constats fonctionnels de ce document viennent du code exécutable et d'un test réel du studio local. Les anciens documents du dépôt n'ont pas servi de preuve pour juger l'éditeur.

Vérifications réalisées :

- lecture des composants éditeur, preview, timeline, store, outils rapides et panneaux ;
- lecture du compilateur de manifest, des Functions export et du renderer FFmpeg ;
- lancement du studio local avec le mode d'export simulé ;
- import de deux MP4 valides générés pour le test ;
- import de deux WebM présents dans le dépôt ;
- ajout réel d'une transition Cross Zoom ;
- ouverture réelle du panneau d'export ;
- mesure de la densité visuelle de l'écran ;
- exécution des tests du modèle de timeline, du store et de la suite d'export.

Résultats observés :

| Test | Résultat |
|---|---|
| Import de deux MP4 720 × 1280, 30 FPS, 3 s | Réussi |
| Import des deux WebM de test du dépôt | Crash complet de la timeline |
| Ajout de Cross Zoom depuis « Outils rapides » | Réussi dans l'éditeur |
| Export Pro après Cross Zoom | Bloqué : transition non rendue serveur |
| Import de photos | Impossible : sélecteur et handler limités à `video/*` |
| Suite `test:vibecut-export` | Passe, mais confirme explicitement les fonctions bloquées |
| Tests timeline/store | Passent, mais ne couvrent pas les durées `Infinity`/`NaN` |

Mesure de l'écran après import, sur un viewport 1280 × 720 :

- 68 boutons visibles ;
- 85 nœuds de texte terminaux visibles ;
- 82 textes sous 11 px, soit 96 % ;
- plus petite taille mesurée : 7 px.

Ce n'est pas seulement une préférence esthétique : à cette densité, la hiérarchie visuelle disparaît et les cibles d'interaction deviennent difficiles à identifier.

## 3. Faiblesses bloquantes détectées

### P0 — Crash sur durée média non finie

Le test des deux WebM du dépôt a produit :

- `Failed to set currentTime ... value is non-finite` pendant l'extraction des miniatures ;
- `RangeError: Map maximum size exceeded` dans `buildTimelineSnapPoints`.

Chaîne de cause dans le code :

1. `loadVideoFile()` accepte directement `video.duration` sans vérifier qu'elle est finie.
2. Le clip reçoit cette durée dans le store.
3. `totalDuration` peut devenir `Infinity`.
4. `buildTimelineSnapPoints()` exécute une boucle d'une seconde jusqu'à `totalDuration`.
5. La boucle remplit une `Map` jusqu'au crash de React.

Code concerné :

- `src/features/vibefx-studio/video/engine/VideoEngine.js:15-67`
- `src/features/vibefx-studio/video/engine/VideoEngine.js:344-383`
- `src/features/vibefx-studio/video/model/timelineModel.js:265-335`
- `src/features/vibefx-studio/video/store/videoStore.js:1186-1218`

Correction :

- refuser toute durée non finie ou inférieure/égale à zéro avant `addClip` ;
- attendre une durée stabilisée pour les conteneurs qui exposent d'abord `Infinity` ;
- si nécessaire, lire la durée avec un parseur média/`ffprobe` côté serveur ou worker ;
- borner le nombre de snap points indépendamment de la durée ;
- afficher une erreur par fichier sans faire tomber le projet entier ;
- ajouter des tests `Infinity`, `NaN`, zéro, média tronqué et WebM à durée tardive.

Critère de sortie :

- un fichier invalide ou mal indexé affiche une erreur localisée ;
- aucun média ne peut rendre `totalDuration` non fini ;
- la timeline reste utilisable après l'échec d'un fichier dans un lot.

### P0 — L'éditeur vidéo ne sait pas créer une vidéo à partir de photos

L'import filtre explicitement `video/*` :

- `src/features/vibefx-studio/video/VideoEditor.jsx:74`
- `src/features/vibefx-studio/video/VideoEditor.jsx:126`
- `src/features/vibefx-studio/video/VideoEditor.jsx:592`

Il n'existe pas de type de clip image dans le store, dans le modèle de timeline ou dans le renderer. Le code `imageExport` du projet exporte une image fixe ; il ne transforme pas une photo en segment vidéo.

Correction :

- introduire un modèle d'asset unifié `image | video | audio` ;
- donner aux images une durée éditable, 3 secondes par défaut ;
- décoder l'image une seule fois pour la preview ;
- compiler une image en source vidéo à durée finie dans FFmpeg ;
- gérer EXIF/orientation, transparence, espaces colorimétriques et très grandes résolutions ;
- permettre l'import mélangé photo + vidéo dans une seule action.

### P0 — L'interface propose des fonctions qui bloquent l'export

Les outils rapides proposent notamment :

- Film Dissolve ;
- Dip to Black ;
- Smooth Cut ;
- Blur Dissolve ;
- Whip Pan ;
- Cross Zoom ;
- Light Leak.

Référence :

- `src/features/vibefx-studio/video/utils/quickTools.js:7-24`
- `src/features/vibefx-studio/video/engine/VideoEngine.js:2087`

Mais le manifest, les Functions et le renderer n'acceptent que :

- `cut` ;
- `fade` ;
- `crossfade`.

Références :

- `src/features/vibefx-studio/video/export/exportManifest.js:70-73`
- `src/features/vibefx-studio/video/export/exportManifest.js:483-517`
- `functions/src/videoExport.js:35-39`
- `render-service/src/server.js:13-16`

Le test réel confirme l'écart : Cross Zoom est ajouté sans avertissement, puis le panneau d'export affiche « Transition non rendue serveur: cross-zoom » et désactive Export Pro.

Le même problème existe pour les animations de texte :

- les presets rapides utilisent `scale`, `slide-up`, `blur-in`, `neon-scan`, `tracking-in`, `reveal-up`, `glitch-out`, etc. ;
- le renderer serveur ne supporte que `none` et `fade`.

Références :

- `src/features/vibefx-studio/video/utils/quickTools.js:61-132`
- `src/features/vibefx-studio/video/export/exportManifest.js:438-445`
- `functions/src/videoExport.js:471-479`
- `render-service/src/server.js:229-237`

Correction :

- créer un registre unique de capacités, versionné ;
- une fonction ne peut être marquée `published` que si preview, manifest, renderer et tests dorés sont verts ;
- masquer les fonctions non publiées dans le produit normal ;
- conserver éventuellement un mode `Lab` explicitement non exportable pour les développeurs ;
- afficher la compatibilité au moment du choix, jamais seulement à la fin.

Règle produit :

> Tout effet visible dans le parcours MVP doit être exportable en qualité Pro avec le même résultat perceptuel.

### P0 — Pas de modèle de mouvement pour les photos

La preview possède des zooms utilisés à l'intérieur de certaines transitions, mais aucun clip ne contient de mouvement animé propre à sa durée.

Il manque :

- transform de départ ;
- transform de fin ;
- interpolation/easing ;
- point d'intérêt ;
- mode cover sécurisé ;
- aperçu des trajectoires ;
- compilation FFmpeg équivalente.

Modèle minimal recommandé :

```js
motion: {
  preset: 'zoom-in',
  start: { scale: 1.00, x: 0.50, y: 0.50 },
  end:   { scale: 1.10, x: 0.50, y: 0.48 },
  easing: 'ease-in-out'
}
```

Presets MVP :

- Aucun ;
- Zoom avant ;
- Zoom arrière ;
- Pan gauche ;
- Pan droite ;
- Pan haut ;
- Pan bas ;
- Drift doux.

Le scale doit toujours conserver une couverture suffisante pour ne jamais révéler de bord noir pendant le mouvement.

### P0 — Le modèle de timeline et le renderer ne décrivent pas la même chose

L'interface donne l'impression d'un mini NLE multi-pistes, mais :

- les clips vidéo principaux forment surtout une séquence ripple ;
- le glisser-déposer vidéo réordonne un index, il ne place pas librement un clip ;
- la position est recalculée séquentiellement ;
- les effets visibles sur la piste Effets sont essentiellement les filtres du clip source ;
- le renderer concatène principalement les clips dans l'ordre du tableau ;
- plusieurs propriétés du plan ne sont pas compilées fidèlement côté serveur.

Références :

- `src/features/vibefx-studio/video/store/videoStore.js:258-282`
- `src/features/vibefx-studio/video/timeline/Timeline.jsx:400-449`
- `src/features/vibefx-studio/video/model/timelineModel.js:1-9`

Ce décalage crée de la complexité sans offrir encore la liberté d'un DaVinci Resolve. Pour le MVP, le bon choix est d'assumer une story line magnétique principale et de réserver le multi-pistes avancé à une étape suivante.

### P1 — Interface trop dense et hiérarchie insuffisante

L'état vide affiche déjà :

- Volets ;
- Vidéo ;
- Transitions ;
- Effets ;
- Texte ;
- Audio ;
- Musique.

Il ajoute en parallèle :

- un panneau Outils rapides ;
- une toolbar inférieure ;
- les boutons `+` des pistes ;
- des réglages au-dessus de la timeline.

Les transitions sont donc accessibles par au moins trois chemins concurrents. L'utilisateur ne sait pas lequel est principal.

Le code utilise fréquemment des tailles de 7 à 10 px et des boutons de piste 20 × 20 px :

- `src/features/vibefx-studio/video/timeline/Timeline.jsx:12-19`
- `src/features/vibefx-studio/video/timeline/Timeline.jsx:748-820`
- `src/features/vibefx-studio/video/timeline/Timeline.jsx:884-1000`

Correction :

- un seul appel principal par action ;
- minimum 12 px pour le texte secondaire, 14 px pour les commandes ;
- cibles d'interaction 36 × 36 px minimum sur desktop ;
- contraste plus élevé ;
- pistes vides masquées ou repliées ;
- inspector contextuel uniquement quand un élément est sélectionné ;
- toolbar secondaire réduite aux actions universelles.

### P1 — Composants trop volumineux

Plusieurs fichiers critiques concentrent une forte complexité :

- `VideoEngine.js` : plus de 2 000 lignes ;
- `ExportVideoPanel.jsx` : plus de 1 800 lignes ;
- `Timeline.jsx` : plus de 1 700 lignes ;
- `videoStore.js` : plus de 1 200 lignes.

Ce n'est pas un défaut esthétique du code : cela rend les changements UX risqués, augmente les rerenders et mélange modèle, interaction, rendu et présentation.

Découpage recommandé :

```text
video/
  domain/
    assetModel
    projectModel
    timelineCompiler
    capabilityRegistry
  preview/
    playbackController
    canvasRenderer
    sceneRenderer
  editor/
    QuickEditor
    Storyboard
    AdvancedTimeline
    Inspector
  export/
    manifestCompiler
    preflight
    jobClient
```

## 4. Architecture UX cible

### 4.1 Trois niveaux de complexité

#### Niveau 1 — Création rapide, affiché par défaut

Écran de départ :

1. Déposer photos et vidéos.
2. Choisir le format : Reel/Story, TikTok/Short, carré ou paysage.
3. Choisir un style : Clean, Dynamique, Cinématique, Produit.
4. Choisir une durée ou « Adapter à la musique ».
5. Cliquer « Créer le montage ».

Le système :

- ordonne les médias ;
- crée une scène par média ;
- donne une durée aux photos ;
- applique des mouvements sans répéter deux fois le même ;
- ajoute des transitions compatibles ;
- adapte le projet au format choisi ;
- laisse l'utilisateur modifier chaque scène.

#### Niveau 2 — Storyboard simple

Le montage principal est une suite de cartes :

```text
[Photo 1 · Zoom +] --Dissolve-- [Photo 2 · Pan D] --Cut-- [Vidéo 1] ...
```

Chaque carte montre :

- miniature ;
- durée ;
- type photo/vidéo ;
- mouvement ;
- filtre ;
- bouton remplacer ;
- poignée de réordonnancement.

La transition se place entre les cartes, pas sur une piste abstraite.

Actions de masse :

- appliquer ce mouvement à toutes les photos ;
- alterner Zoom avant/Zoom arrière ;
- appliquer une transition à toutes les coupures ;
- supprimer tous les filtres ;
- ajuster toutes les photos à 2,5 s ;
- réorganiser aléatoirement avec annulation.

#### Niveau 3 — Timeline avancée

La timeline détaillée reste disponible derrière « Timeline avancée » :

- vidéo principale ;
- overlays ;
- texte ;
- audio clip ;
- musique.

Elle ne doit pas être le premier écran d'un utilisateur qui veut simplement créer un Reel à partir de photos.

### 4.2 Organisation de l'écran

```text
┌──────── Bibliothèque ────────┬──────── Preview ────────┬──── Inspector ────┐
│ Médias / Presets / Audio     │                         │ Mouvement          │
│ photos + vidéos             │      vidéo 9:16         │ Style              │
│                              │                         │ Ajuster            │
│                              │                         │ Durée               │
├──────────────────────────────┴─────────────────────────┴────────────────────┤
│ Storyboard magnétique par défaut / Timeline avancée à la demande           │
└─────────────────────────────────────────────────────────────────────────────┘
```

Règles :

- la preview doit garder au moins 40 % de la hauteur utile ;
- la timeline ne doit pas prendre plus de 35 % au chargement ;
- un seul panneau latéral principal ouvert ;
- les panneaux flottants ne doivent jamais recouvrir les commandes d'export ;
- l'inspector change selon la sélection : Scène, Transition, Texte, Audio.

### 4.3 Bibliothèques MVP

Transitions publiées en premier :

1. Cut ;
2. Cross Dissolve ;
3. Dip to Black ;
4. Slide ;
5. Wipe ;
6. Cross Zoom.

Les six doivent être implémentées et testées de bout en bout. Whip Pan, Light Leak, Glitch et Motion Blur restent en Lab tant que la parité n'est pas prouvée.

Filtres MVP :

- Clean ;
- Vivid ;
- Warm Film ;
- Cool ;
- Mono ;
- Soft.

Les réglages avancés restent accessibles dans un sous-panneau.

Presets de montage MVP :

- `Reel photos dynamique` : photos courtes, mouvements alternés, transitions énergiques ;
- `Souvenirs cinématiques` : mouvements lents, dissolves, Warm Film ;
- `Produit clean` : cuts/dissolves courts, contraste propre, textes simples ;
- `Mixed media social` : photos + rushes, rythme équilibré ;
- `Sans style` : aucune décision automatique hormis fit et durée.

## 5. Modèle de données cible

### 5.1 Asset source immuable

```js
Asset {
  id,
  kind: 'image' | 'video' | 'audio',
  fileName,
  mimeType,
  width,
  height,
  duration,        // null pour une image
  frameRate,       // null pour une image
  orientation,
  colorInfo,
  sourceStoragePath,
  generation,
  crc32c
}
```

Un même asset peut être utilisé par plusieurs clips sans être uploadé plusieurs fois. Cela résout aussi le problème de duplication des sources après split.

### 5.2 SceneClip

```js
SceneClip {
  id,
  sourceAssetId,
  mediaKind: 'image' | 'video',
  start,
  duration,
  trimIn,
  trimOut,
  speed,
  fit: 'cover' | 'contain',
  crop,
  rotation,
  opacity,
  motion,
  filters,
  audio
}
```

Pour une image :

- `duration` vaut 3 s par défaut ;
- `trimIn/trimOut` sont nuls ;
- `motion` peut être animé.

Pour une vidéo :

- `duration` dérive du trim et de la vitesse ;
- `motion` est optionnel ;
- l'audio source peut être activé, muté ou baissé.

### 5.3 Transition canonique

```js
Transition {
  id,
  fromClipId,
  toClipId,
  type,
  duration,
  params,
  capabilityVersion
}
```

Une transition MVP ne flotte pas librement. Elle appartient à une coupure adjacente. Cela simplifie l'UX, le compilateur et FFmpeg.

### 5.4 Registre de capacités

```js
Capability {
  id: 'transition.cross-zoom',
  status: 'lab' | 'published',
  preview: true,
  localRenderer: true,
  cloudCpuRenderer: true,
  cloudGpuRenderer: false,
  tests: ['visual-golden', 'duration', 'audio-sync']
}
```

Le menu utilisateur ne montre que `published`.

## 6. Architecture de rendu recommandée

### 6.1 Compilateur unique

Créer un `renderPlanCompiler` pur qui transforme le projet en segments explicites :

```text
Project
  -> validation domaine
  -> RenderPlan canonique
  -> preview navigateur
  -> manifest immuable
  -> FFmpeg CPU/GPU
```

Chaque segment doit préciser :

- source asset ;
- start/end ;
- trim ;
- transform ;
- mouvement ;
- filtres ;
- transition entrante/sortante ;
- audio ;
- z-index.

La preview et FFmpeg peuvent utiliser des implémentations différentes, mais elles doivent consommer le même plan et les mêmes paramètres.

### 6.2 Rendu des photos

Pour une image :

- décoder une fois ;
- appliquer orientation ;
- mettre à l'échelle au-dessus de la taille de sortie ;
- animer crop/scale/position avec le temps ;
- produire une durée et un framerate constants ;
- appliquer transition et filtres ensuite.

Le filtre FFmpeg peut partir de `loop`, `scale`, `crop` et expressions temporelles/`zoompan`, mais la formule doit être générée par le compilateur et couverte par des tests visuels.

### 6.3 60 FPS

Règles :

- un projet peut sortir en 60 FPS ;
- une photo peut être animée nativement à 60 FPS ;
- une vidéo source 60 FPS conserve ses frames ;
- une vidéo 30 FPS dans une timeline 60 FPS répète proprement les frames ;
- aucune interpolation de mouvement n'est activée silencieusement ;
- l'UI doit indiquer « 30 FPS source dans un projet 60 FPS ».

### 6.4 CPU/GPU et Firebase

La cible infrastructure détaillée reste :

- Firebase Auth + App Check ;
- Firestore comme machine d'état ;
- Cloud Storage pour sources/manifests/outputs ;
- Cloud Tasks pour un lancement court ;
- Cloud Run Jobs pour le rendu asynchrone ;
- `cpu-standard` 4 vCPU / 8 Gio ;
- `cpu-pro60` 8 vCPU / 16 Gio ;
- `gpu-turbo` L4 / 8 vCPU / 32 Gio seulement après benchmark ;
- région de rendu `europe-west1` ;
- H.264/AAC MP4, SDR Rec.709, CFR.

Le document `docs/vibecut-social-export-pro-architecture-2026-07-29.md` contient le détail de la migration infra, des buckets, du retry, de l'annulation et des gates GPU.

Décision d'ordre :

1. le MVP fonctionnel doit d'abord être reproductible avec le renderer CPU ;
2. le chemin cloud CPU doit ensuite devenir asynchrone et robuste ;
3. le GPU ne devient une route produit que s'il gagne objectivement en temps/coût avec une qualité acceptée ;
4. l'absence de GPU ne bloque pas le test du MVP.

## 7. Roadmap d'implémentation proposée

Les estimations ci-dessous sont des ordres de grandeur pour une personne connaissant déjà le dépôt. Les critères de sortie priment sur les jours.

### Lot 0 — Stabiliser et rendre l'interface honnête

Ordre de grandeur : 3 à 5 jours.

Travaux :

- corriger les durées non finies et le crash WebM ;
- ajouter les tests de médias invalides ;
- introduire le registre de capacités ;
- masquer les transitions/textes/volets non exportables ;
- réduire les choix redondants ;
- augmenter taille et contraste des commandes ;
- masquer les pistes vides par défaut ;
- ajouter une erreur d'import par fichier.

Sortie :

- aucun import ne peut faire tomber React ;
- toute fonction visible est exportable ;
- l'écran vide présente moins de 20 actions visibles.

### Lot 1 — Asset unifié et montage photo + vidéo

Ordre de grandeur : 5 à 8 jours.

Travaux :

- introduire `Asset` et `sourceAssetId` ;
- migrer les clips vidéo existants ;
- importer photos et vidéos ensemble ;
- créer les `SceneClip` image ;
- définir durée, fit, orientation et miniature ;
- dédupliquer l'upload par asset ;
- compiler une image fixe côté renderer CPU ;
- ajouter un projet de migration/version du store.

Sortie :

- 10 photos et 2 vidéos apparaissent dans un même storyboard ;
- réordonner, supprimer, remplacer et changer la durée fonctionne ;
- l'export d'images fixes sans animation est valide.

### Lot 2 — Mouvements Ken Burns et transitions publiées

Ordre de grandeur : 6 à 10 jours.

Travaux :

- ajouter le modèle `motion.start/end/easing` ;
- créer 8 presets de mouvement ;
- preview 30/60 FPS ;
- rendu FFmpeg équivalent ;
- implémenter les 6 transitions MVP de bout en bout ;
- ajouter mini-previews dans les bibliothèques ;
- ajouter « appliquer à toutes » et « alterner » ;
- tests visuels dorés.

Sortie :

- le projet de référence exporte sans fonction dégradée ;
- preview et export ont la même trajectoire, le même cadrage et les mêmes durées ;
- aucun bord noir pendant les mouvements.

### Lot 3 — Quick Editor et presets

Ordre de grandeur : 7 à 12 jours.

Travaux :

- nouvel écran de démarrage ;
- format social, style, durée et musique ;
- génération déterministe du storyboard ;
- mode Storyboard par défaut ;
- inspector contextuel ;
- timeline avancée repliée ;
- actions de masse ;
- undo/redo pour chaque génération ou action globale.

Sortie :

- un utilisateur partant de zéro produit le projet de référence en moins de 5 minutes ;
- il n'a pas besoin d'ouvrir la timeline avancée ;
- une transition est modifiable directement entre deux cartes.

### Lot 4 — Robustesse et fluidité timeline

Ordre de grandeur : 5 à 8 jours.

Travaux :

- extraire contrôleur de drag, trim et snap ;
- virtualiser miniatures et items hors viewport ;
- limiter les rerenders au clip concerné ;
- insertion magnétique avec ghost explicite ;
- zoom centré sur le playhead ;
- shortcuts documentés ;
- sélection multiple limitée aux actions de masse utiles ;
- profiler avec 50 scènes.

Sortie :

- aucun blocage de plus de 100 ms pendant scrub/réordonnancement sur la machine de référence ;
- p95 interaction → rendu sous 50 ms ;
- au moins 50 FPS pendant un drag simple sur la machine de référence ;
- aucune désynchronisation entre playhead, preview et timecode.

### Lot 5 — Rendu cloud CPU prêt pour beta

Ordre de grandeur : 8 à 15 jours.

Travaux :

- manifest/RenderPlan canonique ;
- déduplication des assets ;
- buckets temporaires scellés ;
- Cloud Run Jobs asynchrone ;
- état Firestore, lease, heartbeat et idempotence ;
- annulation réelle ;
- retry applicatif borné ;
- progression FFmpeg ;
- validation du MP4 final ;
- profils `cpu-standard` et `cpu-pro60`.

Sortie :

- le projet de référence passe local puis cloud CPU avec le même résultat ;
- un refresh du navigateur ne perd pas le job ;
- cancel arrête FFmpeg ;
- aucun output partiel n'est marqué prêt ;
- 1080p60 jusqu'à 10 minutes respecte les gates définies dans le document infra.

### Lot 6 — Pilote GPU

Ordre de grandeur : 4 à 8 jours plus benchmark.

Travaux :

- image FFmpeg NVENC/NVDEC reproductible ;
- route `gpu-turbo` sur L4 ;
- corpus commun CPU/GPU ;
- mesure démarrage, débit, coût, VMAF/SSIM et inspection visuelle ;
- fallback CPU avant encodage si capacité indisponible.

Sortie :

- GPU publié uniquement s'il bat le CPU selon les gates qualité/coût ;
- sinon il reste désactivé sans bloquer le produit.

## 8. Vertical slice à construire en premier

Projet de référence : `MVP-Reel-10P-2V`.

Entrées :

- 10 photos portrait/paysage mélangées ;
- 2 vidéos courtes, une à 30 FPS et une à 60 FPS ;
- 1 musique ;
- 1 titre simple.

Configuration :

- 1080 × 1920 ;
- 45 secondes environ ;
- sortie 60 FPS ;
- 3 types de mouvements au minimum ;
- Cut, Cross Dissolve, Dip to Black et Cross Zoom ;
- filtre léger sur certaines scènes ;
- audio source de la vidéo et musique avec ducking simple.

Parcours cible :

1. Déposer les 12 médias.
2. Choisir `Reel photos dynamique`.
3. Prévisualiser le montage généré.
4. Réordonner deux scènes.
5. Remplacer un mouvement.
6. Changer une transition.
7. Modifier le titre.
8. Exporter en `Social Pro`.

Ce projet doit être conservé dans les fixtures et joué dans chaque gate locale/cloud.

## 9. Stratégie de test

### Niveau 1 — Domaine

- durée/trim/vitesse toujours finis ;
- projet versionné et migrable ;
- assets dédupliqués ;
- transitions uniquement entre clips adjacents dans le mode Storyboard ;
- mouvement toujours compatible avec le crop de sortie ;
- aucune capability `published` incomplète.

### Niveau 2 — Renderer

- fixture par mouvement ;
- fixture par transition ;
- fixture photo + vidéo mélangées ;
- frame count attendu à 30 et 60 FPS ;
- durée audio/vidéo ;
- rotation EXIF ;
- image alpha ;
- grande image ;
- média invalide ;
- source 24/25/30/50/60 FPS.

### Niveau 3 — Tests visuels

- images dorées à 10 %, 50 % et 90 % de chaque mouvement ;
- comparaison de cadrage avec tolérance ;
- détection de frame noire ;
- transition au début/milieu/fin ;
- preview navigateur comparée à l'export CPU.

### Niveau 4 — UX automatisée

Scénario obligatoire :

- ouvrir studio ;
- importer 10 photos + 2 vidéos ;
- choisir preset ;
- réordonner ;
- changer mouvement et transition ;
- exporter ;
- vérifier qu'aucun bouton visible ne crée un blocker d'export.

Cas négatifs :

- WebM durée `Infinity` ;
- fichier tronqué ;
- photo non décodable ;
- abandon d'un import sur douze ;
- refresh pendant upload ;
- refresh pendant export ;
- réseau coupé ;
- annulation ;
- quota dépassé.

### Niveau 5 — Cloud

- CPU standard, CPU Pro 60 ;
- job réessayé une fois sur erreur transitoire ;
- job non réessayé sur manifest invalide ;
- lease expiré récupéré par reconciler ;
- source scellée non remplaçable ;
- output créé une seule fois ;
- progression et coût enregistrés ;
- GPU A/B uniquement après les gates CPU.

## 10. Gates d'acceptation du MVP

### Go pour test interne

- import mélangé photo + vidéo ;
- aucun crash sur média invalide ;
- projet de référence éditable et exportable localement ;
- toutes les fonctions visibles exportables ;
- Storyboard utilisable sans timeline avancée ;
- texte secondaire au moins 12 px ;
- cibles principales au moins 36 × 36 px ;
- aucune superposition de panneau à 1280 × 720 ;
- export MP4 H.264/AAC valide ;
- frame count 60 FPS correct à ±1 frame ;
- dérive audio/vidéo sous 40 ms ;
- test complet en moins de 5 minutes par un nouvel utilisateur.

### Go pour beta cloud

- toutes les gates internes ;
- Cloud Run Jobs asynchrone ;
- déduplication des assets ;
- cancel effectif ;
- refresh/reprise d'état ;
- contrôle quota et coût ;
- 10 minutes 1080p60 testées sur CPU Pro ;
- aucun output partiel marqué `ready` ;
- sécurité IAM et App Check vérifiées.

### No-go

- une fonction publiée bloque l'export ;
- média invalide fait tomber l'éditeur ;
- une photo révèle des bords pendant un mouvement ;
- preview et export ont un cadrage ou une transition perceptiblement différents ;
- la création du montage exige la timeline avancée ;
- un split duplique l'upload de la source ;
- le navigateur doit rester ouvert pendant le rendu cloud ;
- GPU activé sans benchmark reproductible.

## 11. Décision recommandée

Commencer par les lots 0, 1 et 2, puis tester immédiatement le vertical slice `MVP-Reel-10P-2V` en local.

Ensuite :

1. construire le Quick Editor et les presets autour de ce vertical slice ;
2. faire passer le même projet dans le renderer cloud CPU asynchrone ;
3. ouvrir une beta interne ;
4. seulement après, comparer CPU Pro et GPU L4.

Cette séquence donne rapidement un produit démontrable sans accumuler une nouvelle couche d'interface au-dessus d'un moteur incomplet. Elle garde aussi la voie ouverte vers une architecture professionnelle et scalable jusqu'aux vidéos sociales de 10 minutes.
