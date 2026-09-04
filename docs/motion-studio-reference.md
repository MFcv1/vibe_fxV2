# Motion Studio — mini-app d'animation (3e module du Studio)

Reference capturee le 2026-09-04 depuis `https://animos.app/editor` (produit
commercial, BETA, 9 $/mois). Ce fichier sert de **cahier des charges**, pas de
copie : les templates d'animos sont leur travail creatif proprietaire. On
reconstruit ici nos propres implementations des memes familles d'effets, qui
sont des techniques de motion standard (anneau de cartes, cover flow, grille
qui se revele...). On ne reprend ni leur code ni leurs assets.

## Pattern d'integration (identique a Gradient et Lumen)

Les deux mini-apps existantes du Studio sont des apps autonomes servies depuis
`public/vendor/<app>/index.html`, montees en iframe plein ecran par une Sheet,
qui dialoguent avec VibeOS par `postMessage` (voir
`src/features/vibeos/shared/GradientSheet.jsx` et `LumenSheet.jsx`, listees dans
`MODULES` de `src/features/vibeos/studio/StudioScreen.jsx`).

Motion Studio suit exactement le meme chemin :

- `public/vendor/motion-studio/` — l'app autonome (moteur + editeur).
- `src/features/vibeos/shared/MotionSheet.jsx` — la Sheet + le protocole.
- entree `03 / Motion` dans `MODULES` de `StudioScreen.jsx`.

Difference avec Gradient et Lumen : ces deux-la renvoient **une image de fond**.
Motion renvoie **une video** (MP4/WebM) ou une sequence, donc le protocole
postMessage et l'emplacement projet ne peuvent pas etre les memes ; ca doit
sortir vers Soundtrack / VibeCut, pas vers `applyGeneratedBackground`.

## Architecture moteur retenue

Un seul renderer, deterministe : `render(target, t)` ou `t` est le temps
normalise dans la boucle. La meme fonction sert trois usages, donc pas de derive
entre ce qu'on voit et ce qu'on exporte :

1. l'apercu live (rAF sur le canvas principal) ;
2. les vignettes du catalogue (meme rendu en 256 px, animees) ;
3. l'export image par image (on force `t`, on rend, on encode).

Les familles a perspective (anneaux, tunnels, globes) demandent des quads
textures projetes : WebGL2 brut, sans librairie, pour rester leger et
fonctionner hors-ligne dans l'iframe. Export via WebCodecs
(`VideoEncoder`) + muxer MP4, fallback `MediaRecorder`/WebM.

## Catalogue de reference — 62 templates, 9 familles

| Famille | N | Templates |
| --- | --- | --- |
| 3D & Perspective | 12 | Showcase Stream, Sphere Wall, Card Globe, Orbit Globe, Sphere Cascade, Totem Wall, Parallax Totem, Card Tunnel, Spiral Stream, Depth Stack Scroll, Cover Ring, Cover Ring Vertical |
| Multiscene | 6 | Triple Scene, Collage Reel, Fan Shuffle, Grid Zoom Strip, Spread Rows, Spread Columns |
| Isometric | 3 | Iso Cascade, Iso Focus, Iso Orbit |
| Orbit | 8 | Orbit Showcase, Orbit Bloom, Orbit Carousel, Photo Orbit, Focus Orbit, Vortex Spin, Wheel Spin, Wheel Spin Bottom |
| Carousel & Flow | 10 | Card Totem, Film Strip, Wheel Carousel, Cover Flow, Cover Flow Vertical, Carousel Flow, Diagonal Carousel, Focus Slider, Mosaic Marquee, Hero Reel |
| Grid | 8 | Grid Reveal, Spotlight Zoom, Flip Grid, Pop Grid, Ticker Loop, Ticker Tilt, Column Drift, Feed Scroll |
| Spotlight & Focus | 4 | Center Stage, Focus Shift, Deck Peel, Zoom Parallax |
| Reveal & Wipe | 4 | Diagonal Wipe, Stripe Reveal, Split Reveal, Mosaic Wipe |
| Stack & Scatter | 7 | Stack Slide, Cascade Drop, Cascade Deck, Image Trail, Poster Burst, Card Toss, Position Dance |

## Chassis d'editeur (commun a tous les templates)

- **Catalogue** a gauche : familles repliables, vignettes animees en direct.
- **Scene** au centre : canvas au ratio choisi, barre de transport (play/pause,
  retour debut, scrubber, `t / duree`).
- **Keyframes** : tiroir sous la scene, une piste par parametre anime, le
  losange a cote d'un slider ou d'une couleur cree la piste.
- **Inspecteur** a droite, sections fixes :
  - `FRAME` — 16:9, 4:3, 1:1, 4:5, 3:4, 9:16
  - `MEDIA · N SLOTS` — nombre d'images reglable, slots reordonnables par
    glisser-deposer, drop ou clic pour remplir, « Clear images »
  - `TIMING` — duree de boucle (5 / 10 / 15 / 20 / 30 s + slider)
  - `TEXT` — calques de texte ajoutables
  - `LOGO` — upload (max 5 Mo)
  - bloc de parametres **propre au template** (exemple Showcase Stream :
    Padding, Corner radius, Ring tilt, Ring opening, Ring size, Card size,
    Back fade, Perspective, Card ratio)
  - `SHADOW`, puis « Reset settings »
- **Fond** : couleur unie / degrade / image.
- **Export** : MP4 ou WebM, 720p a 8K, boucle sans couture.

## Lot 1 — 3D & Perspective : geometrie et parametres releves

Releve le 2026-09-04 dans l'editeur de reference. `slots` = nombre d'images par
defaut, `loop` = duree de boucle par defaut. Les parametres listes sont ceux du
bloc propre au template (en plus du fond couleur/degrade/image commun a tous).

| Template | slots | loop | Geometrie | Parametres |
| --- | --- | --- | --- | --- |
| Showcase Stream | 12 | 16s | anneau de cartes tangentes, incline, ouvert | Padding, Corner radius, Ring tilt, Ring opening, Ring size, Card size, Back fade, Perspective, Card ratio, Shadow |
| Sphere Wall | 8 | 20s | mur en grille courbe (cylindre), defile horizontal | Zoom, Tilt, Padding, Corner radius, Curvature, Gap, Edge fade, Card ratio, Motion (Continuous / Waypoints / Waypoints no zoom), Direction (L/R/Alt) |
| Card Globe | 12 | 20s | cartes tangentes reparties sur une sphere | Corner radius, Globe size, Card size, Gap, Back fade, Tilt, Card ratio, Motion, Direction |
| Orbit Globe | 12 | 20s | idem sphere, cartes plus grandes, sphere plus petite, inclinee 27 deg | Corner radius, Globe size, Card size, Gap, Back fade, Tilt, Card ratio, Motion (Continuous / Waypoints), Direction |
| Sphere Cascade | 8 | 20s | mur courbe, defile vertical | Zoom, Tilt, Padding, Corner radius, Curvature, Gap, Edge fade, Card ratio, Motion, Direction (Up/Down/Alt) |
| Totem Wall | 8 | 20s | mur courbe, defile vertical, zoom 33% | Zoom, Tilt, Padding, Corner radius, Curvature, Gap, Edge fade, Card ratio, Direction |
| Parallax Totem | 8 | 20s | colonnes a profondeurs et vitesses differentes, tailles variables | Zoom, Scatter, Size variation, Parallax depth, Padding, Corner radius, Curvature, Gap, Edge fade, Card ratio, Direction |
| Card Tunnel | 8 | 20s | 4 parois de cartes formant un couloir, avance vers le fond | Corner radius, Tunnel size, Card length, Gap, Depth fade, Direction (Forward/Backward) |
| Spiral Stream | 12 | 28s | helice de cartes autour d'un axe vertical | Padding, Corner radius, Spiral turns, Card count, Spiral size, Taper, Card size, Back fade, Perspective, Ring tilt, Card gap, Scale pulse, Easing, Direction, Motion, Card ratio, Card style (Curved / Upright), Shadow |
| Depth Stack Scroll | 12 | 14s | cartes dispersees en profondeur qui viennent vers la camera | Corner radius, Card size, Card count, Depth gap, Spread, Wobble, Depth fade, Depth blur, Layout (Fan/Scatter), Direction, Card ratio, Shadow |
| Cover Ring | 8 | 14s | anneau de tres grand rayon : arc peu marque, une carte a la fois | Padding, Corner radius, Card size, Ring size, Tilt, Perspective, Back fade, Easing (11 courbes), Card ratio, Direction, Motion (Step per card / Continuous) |
| Cover Ring Vertical | 8 | 14s | idem, axe vertical | Padding, Corner radius, Card size, Ring size, Rotate, Tilt, Perspective, Back fade, Easing, Card ratio, Direction, Motion |

Courbes d'easing proposees (Cover Ring, Spiral Stream) : Custom, Smooth,
Natural, Slow down, Snappy, Accelerate, Elastic, Bounce, Overshoot, Impulse,
Swing, Linear.

## Etat au 2026-09-04 — les 62 animations sont livrees

Les neuf familles sont implementees, verifiees une par une : chaque template
rend une image non vide, et **les 62 bouclent sans raccord** (l'image a t = 1
est identique a celle de t = 0, ecart mesure inferieur a 6 sur 255).

| Famille | N | Templates |
| --- | --- | --- |
| 3D & Perspective | 12 | livre |
| Multiscene | 6 | livre |
| Isometric | 3 | livre |
| Orbit | 8 | livre |
| Carousel & Flow | 10 | livre |
| Grid | 8 | livre |
| Spotlight & Focus | 4 | livre |
| Reveal & Wipe | 4 | livre |
| Stack & Scatter | 7 | livre |

### Export : ou on en est par rapport a la reference

| | Reference | Motion |
| --- | --- | --- |
| Formats | MP4 H.264, WebM VP9 | MP4 H.264 (WebCodecs), WebM VP9 en repli |
| Definitions | 720p a 8K, **HD payante** | 720p a 8K, **tout gratuit**, les definitions que la machine ne sait pas encoder sont grisees |
| Images / seconde | 30, 60 | 24, 30, 60 |
| Boucles enchainees | 1x a 4x | 1x a 4x |
| Recapitulatif | definition, duree, debit, poids | idem |
| Avertissement slots vides | oui | oui |
| Progression | barre pendant le rendu | idem |
| Vitesse | rendu serveur | image par image en local, plus rapide que le temps reel (1080p 6 s encode en 1,5 s) |

Le fichier part dans le dossier Telechargements et s'ouvre dans QuickTime,
exactement comme les exports de la reference.

### Keyframes

Livre. Un losange a cote de chaque curseur et de chaque couleur pose ou retire un
point a l'instant courant ; un tiroir sous la scene montre une piste par reglage
anime, avec sa regle temporelle, sa tete de lecture, ses points cliquables et un
bouton pour supprimer la piste.

Les pistes sont **circulaires** : apres le dernier point on repart vers le
premier. Un reglage anime ne peut donc pas casser le raccord de boucle, ce qui
serait arrive avec une interpolation ouverte.

### Verifier un export : la seule methode qui vaut

Un fichier video ne se valide **pas** en l'ouvrant dans un `<video>` de
navigateur. Chrome et ffmpeg lisent des MP4 que QuickTime refuse : c'est
exactement ce qui est arrive ici, un `ftyp` tronque a 17 octets au lieu de 32
passait partout sauf sur macOS.

- `npm run verifier:mp4` fabrique un fichier a partir de faux echantillons et
  compare la taille de chaque boite a la norme. C'est le garde-fou permanent.
- Pour un fichier reel, passer par **AVFoundation** — le decodeur de QuickTime et
  de l'apercu du Finder. Un petit script Swift qui charge l'`AVURLAsset`, lit sa
  duree et en extrait une image suffit, et il echoue exactement la ou QuickTime
  echoue.

## Audit visuel du 2026-09-05

Les 62 ont ete regardees une par une, en planches contact (deux instants par
template), puis comparees a la reference pour celles qui posaient question.
**14 ne correspondaient pas** et ont ete corrigees. Trois etaient des erreurs de
STRUCTURE, pas de reglage — le genre d'ecart qu'aucun test automatique ne voit :

| Template | Ce qui n'allait pas |
| --- | --- |
| Iso Cascade | cartes couchees au sol ; la reference les garde DEBOUT et les cisaille |
| Iso Focus | idem |
| Grid Zoom Strip | rendu en bande lineaire ; c'est une GRILLE qui plonge sur une case |
| Iso Orbit | cartes projetees en losanges pointus : leurs cotes doivent suivre les axes de la camera, pas ceux du sol |
| Focus Orbit | anneau decale d'un rayon vers le bas, moitie des cartes hors cadre |
| Spread Rows / Columns | la pose "empilee" ramenait tout sur un point : on ne voyait qu'une carte |
| Spiral Stream | rayon trop large et hauteur trop etiree : eparpillement au lieu d'une helice |
| Orbit Bloom | anneau plat, sans l'ouverture en corolle |
| Image Trail | trainee tassee autour du curseur au lieu de traverser le cadre |
| Card Toss | cartes trop petites et groupees |
| Feed Scroll | deux vignettes perdues dans un cadre vide |
| Wheel Carousel | roue trop petite, cartes coupees en bas |
| Collage Reel | couronne trop ajouree |

Ecart connu et assume : **Orbit Bloom** ouvre bien sa corolle mais ne reproduit
pas exactement la forme en papillon de la reference.

## Finition et famille Signature (2026-09-05)

Trois reglages globaux, dans le bloc **FINITION** de l'inspecteur, actifs par
defaut :

- **Flou de mouvement** — plusieurs sous-images moyennees autour de l'instant
  demande. C'est le reglage qui fait basculer le rendu de la diapositive a la
  video ; sans lui, chaque image est nette et le deplacement saute a l'oeil.
- **Vignetage** — assombrit les bords, recentre le regard.
- **Grain** — casse la proprete numerique. Sa graine suit le temps de boucle,
  donc il bouge d'une image a l'autre sans casser le raccord.

L'ombre portee est elle aussi active par defaut, discrete.

**Signature VibeOS**, six animations a nous, dans leur propre famille pour que
les comptes des neuf familles de la reference restent exacts : Beat Punch,
Push Cut, Swipe Stack, Split Slide, Kinetic Wave, Depth Pop. Elles visent la
story et le reel : mouvements courts, temps de lecture sur chaque image, entrees
qui depassent leur cible avant de se poser.

## Etat des ecarts avec la reference

Ce qui est **aligne** : les 62 noms, leur ordre, leurs familles, le nombre
d'emplacements et la duree de boucle par defaut, les parametres de chaque
template avec leurs valeurs par defaut, le chassis de l'editeur, le catalogue
repliable, l'export.

Ce qui **ne peut pas etre garanti** : l'egalite au pixel. On n'a pas leur code ;
chaque geometrie est reconstruite d'apres des captures et les valeurs affichees
dans leur inspecteur. Les proportions par defaut peuvent differer de quelques
pourcents, et le mouvement lui-meme (vitesse, courbe, ordre d'entree) n'a pas ete
compare image par image.

### Non fait, et assume

- **Le flou de profondeur** de Depth Stack Scroll est approche en empilant des
  copies translucides, pas calcule dans le shader.
- Les templates sont regles a l'oeil contre la reference, pas mesures : les
  proportions par defaut peuvent differer de quelques pourcents. Tous les
  reglages sont exposes, donc rattrapables sans toucher au code.
- L'audit a compare UNE image par template. Le mouvement lui-meme (vitesse,
  courbe d'acceleration, ordre d'entree) n'a pas ete compare image par image
  avec la reference.

### Comment refaire cet audit

Un test qui verifie « ca rend une image non vide et ca boucle » ne dit RIEN sur
la ressemblance : les 62 passaient ce test alors que 14 etaient fausses. Pour
juger, il faut regarder.

1. Dans l'app, fabriquer des planches contact : pour chaque template, rendre
   deux instants dans un canvas en grille, puis `PUT` le PNG vers un petit
   serveur local et l'ouvrir en pleine resolution.
2. Pour la reference, la capture programmee ne marche pas : son canvas ne se
   redessine pas quand le volet navigateur n'est pas au premier plan, et sa page
   bloque tout envoi vers un serveur local. Il faut cliquer le template puis
   prendre une capture d'ecran, un template a la fois.
