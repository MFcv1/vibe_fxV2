# Prompt de reprise — apres le lot 1 de Motion Studio (2026-09-04)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## Ordre de lecture

1. `AGENTS.md` — regles de travail, economie de contexte, rituel de fin de phase.
2. `todo.md` — chantier actif : Motion Studio, familles restantes.
3. `docs/motion-studio-reference.md` — le cahier des charges : les 62 templates
   cibles, leurs geometries et leurs parametres releves un par un.
4. `map.md` — **seulement** le journal du 2026-09-04 et les deux zones
   `public/vendor/motion-studio/` et `src/features/vibeos/shared/`.

**Ne pas ouvrir** : `docs/archive-*`, les autres `docs/prompt-reprise-*`, le
reste de `map.md`.

## Etat livre

Motion est la troisieme mini-app du Studio VibeOS, a cote de Gradient et Lumen.
Elle vit dans `public/vendor/motion-studio/` (app autonome, ES modules, zero
dependance) et s'ouvre plein ecran depuis `/creer/studio` via
`src/features/vibeos/shared/MotionSheet.jsx`.

Livre :

- moteur WebGL2 de quads textures projetes (`js/engine/gl.js`), rendu pur en
  fonction du temps (`js/engine/stage.js`) ;
- editeur complet : catalogue a vignettes animees, scene au ratio choisi, barre
  de transport, inspecteur (cadre, emplacements medias reordonnables, duree de
  boucle, calques texte, logo, reglages du template, ombre, reinitialisation),
  fond couleur / degrade / image, annuler-retablir ;
- **les 62 templates des 9 familles** (3D & Perspective 12, Multiscene 6,
  Isometric 3, Orbit 8, Carousel & Flow 10, Grid 8, Spotlight & Focus 4,
  Reveal & Wipe 4, Stack & Scatter 7) ; les 62 bouclent sans raccord, verifie
  par un balayage automatique ;
- **la timeline de keyframes** (`js/engine/keyframes.js`) : un losange a cote de
  chaque curseur et de chaque couleur, un tiroir sous la scene avec une piste par
  reglage anime. Les pistes sont circulaires, donc un reglage anime ne casse pas
  la boucle ;
- export MP4 image par image (WebCodecs + muxer maison `js/mp4.js`), repli
  MediaRecorder/WebM, 720p a 8K, 24/30/60 images par seconde, 1x a 4x boucles
  enchainees, recapitulatif et avertissement slots vides ; les definitions que
  le navigateur ne sait pas encoder sont grisees. **Valide avec AVFoundation**,
  pas seulement dans un navigateur.

## Etat des gates

- `npm run lint` : 0 erreur, 5 avertissements **preexistants** (images `<img>`
  dans AccountClient et AuthButton, `react-hooks/exhaustive-deps` dans
  TimelineView et useCanvasRenderer). Aucun ne vient de Motion.
- `npm run build` : vert.
- Verifications navigateur faites : les **62** templates rendent une image non
  vide et bouclent sans raccord (ecart mesure entre t=0 et t=1 inferieur a 6 sur
  255, balayage automatique sur les 62) ; export MP4 valide en 720p, 4K, 9:16 et
  sur 2 boucles enchainees, relu et decode dans un `<video>` avec la bonne duree
  et les bonnes dimensions, et le fichier arrive bien dans le dossier
  Telechargements ; le module s'ouvre depuis `/creer/studio`.
- Aucun deploiement.

## Mission suivante, dans l'ordre

1. **La timeline de keyframes.** L'inspecteur doit poser un losange a cote de
   chaque slider et de chaque couleur, et le tiroir sous la scene doit montrer
   une piste par reglage anime. `Stage.render` prend deja `t` : il suffit
   d'interpoler `state.params` juste avant l'appel.
3. **Le flou de profondeur reel** de Depth Stack Scroll. Il est aujourd'hui
   approche en empilant cinq copies translucides ; un vrai flou demande une
   passe separee dans le shader.

## Interdits

- Ne pas recuperer le code ni les assets d'animos.app : c'est un produit
  commercial. On reconstruit nos propres implementations des memes familles
  d'effets, qui sont des techniques de motion standard, et on les regle a l'oeil
  contre la reference.
- Ne pas deployer sans demande explicite.
- Ne pas melanger les prefixes de tokens : Motion a les siens (`--ms-*`), parce
  qu'il tourne en iframe et ne peut pas importer `vibeos.css`.

## Rituel de fin de phase

Gates cibles, puis mise a jour de `todo.md`, `plan.md`, `map.md`, et un fichier
`docs/prompt-reprise-<date>.md`. Recap en langage simple dans le chat. Le prompt
de reprise ne se colle dans le chat que si l'utilisateur l'a demande au debut de
la session.

## Pieges rencontres, a ne pas refaire

- **Le tri de profondeur.** Il se fait sur la projection le long de l'axe de
  visee, PAS sur la distance a l'oeil. Avec la distance, deux cartes coplanaires
  a des hauteurs differentes se rangent l'une derriere l'autre et une revelation
  en bandes se casse. C'est dans `engine/stage.js`.
- **Un fondu entre deux plans exige des quads identiques.** Si l'un est zoome par
  sa geometrie, il deborde de l'autre et reste visible tout autour. Le zoom passe
  par `zoomedUv()` (fenetre de texture), jamais par la taille du quad.
- **Une boucle ne se referme que si le parcours est un nombre ENTIER de cartes**,
  et si l'indice de texture est periodique de cette meme periode. Un mur qui
  avance de 2,5 cartes par tour saute a chaque raccord.
- **Le serveur de test met les modules en cache.** Pendant la mise au point,
  relancer `python3 -m http.server` sur un port different plutot que de croire
  qu'un correctif n'a pas marche.
- **`Array.prototype.flat()` n'aplatit pas un `Uint8Array`.** C'est ce qui a
  produit des MP4 illisibles par QuickTime alors que Chrome les ouvrait. Toute
  ecriture binaire passe par `bytes()` dans `js/mp4.js`.
- **Un export video ne se valide pas dans un navigateur.** Chrome et ffmpeg sont
  permissifs. Lancer `npm run verifier:mp4`, et pour un fichier reel le charger
  dans un `AVURLAsset` (AVFoundation) — c'est le decodeur de QuickTime.
