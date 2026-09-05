# TODO — Vibe_fx V2

> **Motion Studio — 3e mini-app du Studio, livre le 2026-09-05.** 68 animations
> en 10 familles (les 9 de la reference a leurs comptes exacts + 6 signatures),
> finition video (flou de mouvement, vignetage, grain) et export MP4. Moteur WebGL2,
> editeur complet, **les 62 animations des 9 familles**, timeline de keyframes,
> et un export MP4 image par image (720p a 8K, 1x a 4x boucles) plus rapide que
> le temps reel. Les 62 bouclent sans raccord. L'export est verifie avec
> AVFoundation — le decodeur de QuickTime — et protege par
> `npm run verifier:mp4`.
>
> Les points d'etape du 2026-08-27 au 2026-09-04 — Layout, apercu Instagram,
> catalogue musical, barre de lecture — sont clos et archives :
> [docs/archive-points-etape-2026-09-04.md](docs/archive-points-etape-2026-09-04.md).

> **Tri local de la bibliotheque — livre le 2026-09-05.** Un deuxieme geste a
> cote de l'import : **Trier**. On designe un dossier entier (Telechargements et
> ses centaines de photos), on ne stocke QUE l'apercu 1600 px, on garde au coeur
> (bouton sur la tuile, touche **F** dans le carrousel), et un seul bouton
> importe pour de vrai les gardees dans un nouveau dossier. Le dossier de tri est
> `localOnly` : la synchronisation le saute, et il ne compte pas dans le quota du
> compte. Module `src/features/vibeos/library/libraryScout.js`.
> Gate : `npm run test:vibeos-library`.

> **Room — livree le 2026-09-05.** Nouvel ecran `/creer/room` : la file d'attente
> d'un post. Layout et Vision ont un bouton **Room** a cote d'« Exporter » qui y
> envoie le rendu pleine definition (un panorama y entre deja decoupe en
> tranches). On reordonne a la souris ou aux fleches, on valide l'ordre, et
> l'apercu Instagram existant montre le carrousel dans l'iPhone. Stockage local
> (IndexedDB `vibeos` v2, store `room`, Blobs), rien n'est envoye au serveur.
> Gate : `npm run test:vibeos-room`.

**À lire avant de coder, dans cet ordre :**

1. [AGENTS.md](AGENTS.md) — règles de travail, rituel de fin de phase.
2. Ce fichier.
3. [docs/presets-valides.md](docs/presets-valides.md) — **si tu touches aux
   presets** : ceux qui ne se suppriment jamais, et ce qu'un preset doit passer
   pour y entrer.
4. [docs/lightroom/](docs/lightroom/) — **si tu importes un preset** : la
   procédure clic par clic, la méthode et ses pièges, le corpus de `powlisher`.
5. [docs/pieges-connus.md](docs/pieges-connus.md) — **avant de toucher aux
   presets, à la couleur ou au rendu** : ce qui a déjà cassé une fois.
6. [map.md](map.md) — arbre du projet. Ses journaux datés : **ne lis que la
   zone que tu touches**.

Reprendre dans un chat neuf :
[**après le tri local de la bibliothèque** — 2026-09-05](docs/prompt-reprise-2026-09-05-tri-local.md),
[après la Room — 2026-09-05](docs/prompt-reprise-2026-09-05-room.md),
[après le lot 1 de Motion Studio — 2026-09-04](docs/prompt-reprise-2026-09-04-motion-studio.md),
[après l'import HEIC/HEIF — 2026-09-01](docs/prompt-reprise-2026-09-01-import-heic.md).
Les plus anciens (2026-08-20 à 2026-08-31) sont dans `docs/prompt-reprise-2026-08-*.md` :
les ouvrir seulement si on retourne dans leur chantier.

Archives, à ouvrir **seulement** si on travaille dans la zone concernée :
[VibeOS](docs/archive-vibeos-2026-08-11.md) ·
[VibeCut](docs/archive-vibecut-2026-08-04.md) ·
[presets, lots H/I/J](docs/archive-presets-vision-2026-08-12.md) ·
[état livré + calages Lightroom](docs/archive-calages-lightroom-2026-08-27.md).

---

## Ce qui reste

### Motion Studio — ce qui reste

Les 62 animations sont livrees et bouclent, la timeline de keyframes est en
place, l'export est valide par AVFoundation. Reste :

- **Le flou de profondeur** de Depth Stack Scroll est approche en empilant cinq
  copies translucides ; un vrai flou demande une passe separee dans le shader.
- **Comparer le MOUVEMENT, pas seulement une image fixe.** Les deux audits ont
  compare des images arretees ; la vitesse, les courbes et l'ordre d'entree n'ont
  jamais ete confrontes a la reference.
- **Passer les templates sur de VRAIES photos.** L'audit du 2026-09-05 les a
  regardees avec les vignettes de demonstration ; il reste a verifier qu'un
  cadrage de vraie photo tient dans chaque geometrie.
- **Orbit Bloom** ouvre sa corolle mais ne reproduit pas la forme en papillon de
  la reference.
- **Le mouvement n'a pas ete compare image par image** avec la reference : seule
  une image fixe par template l'a ete.
- **Regle de verification a ne pas oublier** : un export video ne se valide PAS
  en l'ouvrant dans un `<video>` de navigateur — Chrome lit des fichiers que
  QuickTime refuse. Utiliser `npm run verifier:mp4`, et pour un fichier reel,
  AVFoundation (le decodeur du Mac).

Le cahier des charges, les geometries et les parametres releves famille par
famille sont dans
[docs/motion-studio-reference.md](docs/motion-studio-reference.md). Ajouter un
template ne touche pas au moteur : c'est un objet avec un schema `params` et une
fonction `build(ctx)` qui rend des quads 3D, depose dans
`public/vendor/motion-studio/js/templates/` et inscrit dans `templates/index.js`.

### Room — ce qui reste

- **La Room ne nourrit pas encore « Publier ».** Le bouton Publier du bandeau
  envoie toujours le rendu du PROJET courant vers `/publier`, pas la file. Le
  branchement naturel : `publishHandoff` accepte plusieurs images, et `/publier`
  les reprend comme carrousel.
- **Une seule file pour tout le monde**, pas une par projet : c'est voulu (on
  cumule des images venues de projets differents), mais si un jour il faut
  plusieurs posts en parallele, il faudra une cle de post dans `roomDb`.
- **La legende et le titre** de l'apercu restent les textes de demonstration.

### D'ABORD — regarder les presets qui attendent un regard

Ils sont livrés et testés ; il manque **le regard**. Ouvrir les planches de
`~/Desktop/powlisher-biblio/` et dire, un par un, gardé ou pas. Ceux qui sont
gardés entrent dans [docs/presets-valides.md](docs/presets-valides.md).

| Preset | Livré | Ce qu'il faut regarder |
|---|---|---|
| `couchant` | 2026-08-27 ter | **Le seul preset du projet mesuré contre des COUCHANTS.** Il retire la saturation « carte postale » (×0,71 dans les médians) : sur un ciel magenta c'est net, sur un soleil doré il éteint l'or. C'est le point à trancher à l'œil. |
| `powV11` | 2026-08-29 duodecies, corrigé les terdecies et 2026-08-30 |  Blancs des enseignes crème comme les siens (chroma 18,7 contre 18,6). Lettrage des enseignes lisse depuis le 2026-08-30 (option `blancsBruites`). Réserve : il verdit l'ocre, mais **seulement dans les niveaux sombres** depuis la correction. |
| `powV12` | 2026-08-30 bis | **Le bout de la série.** Le blanc du logo passe de **gris à crème** comme le sien (L 46,2 / chroma 16,0 contre ses 46,1 / 18,0), et le **poteau** redescend de 60,4 à **50,6**. Rien d'autre ne bouge : ciel +0,09, sol 0,00, moto 0,00. Réserves mesurées : les onze points qui restent sur le poteau sont peints à la main chez lui (ni règle de teinte, ni vignetage), et il **désature le rouge** quand nous ne le faisons pas. |
| `powV10` | 2026-08-29 undecies | **Le dernier de la série.** Mêmes couleurs que `powV9`, courbe plus douce : blancs plus clairs, plus d'artefacts autour des enseignes. Même réserve — il verdit l'ocre. |
| `powV9` | 2026-08-29 decies | **Le plus proche de sa photo de nuit** (2,12). Ses deux secteurs chauds sont tournés de 19 à 33° et désaturés de moitié : sur un ocre franc la rotation vaut +46° — **il verdit le sable, le bois, les murs**. À regarder en gardant ça en tête. |
| `powV8` | 2026-08-29 nonies | **Le bout de la série.** Rouge et sol calés sur les siens. Sa luminance ×1,57 sur les rouges et son a\* −3,2 dans les ombres sont les leviers les plus forts de la famille : sur une autre photo, ça se verra. |
| `powV7` | 2026-08-29 octies | **Le bout de la série** (2,42 sur sa photo de nuit). Son relevé des hautes lumières éclaircit TOUT ce qui dépasse L 62 : en plein jour il brûle. À regarder sur une scène nocturne au sujet éclairé. |
| `powV6` | 2026-08-29 septies | **`powV5` plus le dégradé du bas.** Le plus proche de sa photo de nuit (3,03). Le dégradé est un geste de COMPOSITION : il suppose que le bas du cadre est un premier plan à faire taire. À regarder sur une photo dont le sujet est en bas — il l'éteindra. |
| `powV5` | 2026-08-29 sexies | **Le plus proche de sa photo de nuit** (2,92 contre 7,09). Il descend très bas : un blanc pur atterrit à 141. À regarder sur une scène nocturne photographiée trop claire. Sur une photo déjà sombre il la détruit — c'est assumé, il reproduit UNE image. |
| `powV4` | 2026-08-29 quinquies | **Sa photo de nuit, poussée au maximum.** À regarder sur une vraie scène nocturne aux LED. Son ciel est plus sourd et ses bas-tons plus froids que le reste de la famille : sur une lumière chaude ou en plein jour, il aura tort. Calé sur **une seule** photo. |
| `powV3` | 2026-08-29 quater | **La nuit de `powV2`**, même couleur. À regarder sur de vraies scènes nocturnes. Son plafond à 205 empêche un lampadaire de percer un trou blanc. Calé sur **une seule** photo : c'est assez pour une densité, pas pour une couleur — et sa couleur ne bouge donc pas. |
| `powV2` | 2026-08-29 ter | **Le plus proche de ses photos que le projet sache faire** : couleur ET densité. À regarder : est-ce qu'il assombrit trop sur une photo déjà sombre ? (Si oui, `powlishermain` fait la même couleur sans toucher à la lumière.) `node scripts/verifier-presets-sur-paires.mjs ~/Desktop/paires-powlisher` rejoue les chiffres. |
| `powlishermain` | 2026-08-29 bis | **Le seul mesuré sur des avant/après certains.** Il ne touche PAS à la luminosité (c'est mesuré : sa courbe à lui ne fait rien), donc il se pose sur une photo déjà exposée et ne la sauve pas. À regarder : le ciel, qui converge fort vers le teal, et les verts, qui perdent la moitié de leur couleur. Il ne touche pas à la lumière, contrairement à `powV2`. |
| les six du 2026-08-27 | 2026-08-27 | `ambre`, `ambre-nuit-1/2`, `powlisher-chaud`, `powlisher-froid`, et la famille cine |

Refaire une planche à volonté :

```bash
node scripts/planche-duel.mjs --presets couchant,ambre,powlisher-cine --familles mer,auto --par-famille 2
```

Vérifier qu'un preset tend vraiment vers son modèle :

```bash
node scripts/juger-vers-modele.mjs --presets couchant --modele ~/Desktop/powlisher-biblio/modele-couchant --n 3
```

Et le contrôle le plus dur, le dégradé de ciel **à 1:1** :

```bash
node scripts/ciel-couchant-1-1.mjs couchant,ambre,powlisher-cine
```

### Les trois registres de couchant ABANDONNÉS

`heure-bleue` (une seule photo dans son corpus), `contre-jour` (4 ou 5, sous le
plancher du projet) et `heure-dorée` séparée de `sunset-sobre` (son point blanc
s'étale de 123 à 238 **en continu**, sans coupure nette) n'ont pas pu être
mesurés. Le détail est dans le journal du **2026-08-27 ter** de `map.md`.
**Ce qui débloquerait la suite** : d'autres couchants à lui. La chaîne se rejoue
en trois commandes (`grouper-couchants`, `mesurer-variante`, `juger-vers-modele`).

### Ensuite — l'étage de tonalité adaptatif (le vrai gros reste)

Chez `@powl_d`, la luminance médiane va de **23 en ville de nuit à 124 en mer**.
Aucune courbe fixe ne suit ça, et c'est la dernière part de l'écart ressenti
entre nos presets et ses photos. C'est aussi la raison pour laquelle
`powlisher-nuit-2` et `ambre-nuit-2` coûtent une exposition : leur registre
est shooté sombre, et une LUT ne sait pas dire « sombre par rapport à cette
photo-ci ».

**Le 2026-08-29 bis a fourni la preuve directe** : ses trois avant/après ne
diffèrent, en lumière linéaire, que par un gain — −1,85, −0,22 et −0,56 EV sur
trois photos. Il ne suit pas la densité de la scène avec une courbe, il la suit
**à la main**. C'est exactement l'étage qui manque ici.

**Ce n'est pas une modification de preset, c'est une modification de moteur.** Un
preset est compilé en LUT 3D (`getPresetLut`), c'est-à-dire une table sans
mémoire : elle ne peut pas savoir ce qu'il y a dans l'image. Il faut un étage
AVANT la LUT, qui mesure l'histogramme de la photo et l'amène sur l'exposition de
référence du preset — exactement ce que fait le curseur Exposition de Lightroom,
réglé photo par photo. Points à trancher : où il vit dans `studioRenderer.js`,
comment il se désactive, et comment le figer dans un smoke.

### Puis — importer d'autres presets Lightroom

**Série en cours (favoris de Matthis)** : les familles **Cinéma, Cinéma II,
Futuriste, Inspiré d’un film, Noir et blanc, Vintage, Architecture urbaine,
Paysage, Style de vie, Voyage, Voyage II, Printemps, Été, Automne et Hiver sont
complètes**. Restent hors de ces
familles : VCR11 et VCR12. Le circuit de dossiers est décrit dans le prompt de
reprise.

**À chaque preset qui porte du grain** : ouvrir le triangle du panneau Grain et
relever la **Taille**. Elle ne se passe à l'import (`--grainSize`) que si elle
s'écarte de 25.

Familles **paysage** (LN01–LN08), **architecture urbaine** (UA01–UA04),
**voyage, cinéma, film**, par la méthode Hald CLUT
([1-procedure.md](docs/lightroom/1-procedure.md)).

**Un preset Lightroom n'est pas que de la couleur.** À chaque import : relever
les panneaux **Effets** et **Détail** (l'agent doit les **demander**) — dont la
**Réduction du bruit**, que notre moteur n'a pas : un preset qui en porte gardera
chez nous un grain numérique que Lightroom lisse (invisible à bas ISO, visible
sur une photo prise dans le sombre), remettre
le grain à 0 avant d'exporter la mire, puis passer les valeurs relevées à
l'import — `--grain`, `--vignette`, `--clarity`, `--texture`, `--sharpness`,
`--dehaze`. **Le
nombre se recopie tel quel** : nos échelles sont les siennes.

**Déjà capturé, à ne pas relever** : tout ce qui dépend de la seule couleur du
pixel — exposition, contraste, hautes lumières, ombres, blancs, noirs, courbe,
TSL, étalonnage, virage, N&B, et le **profil**.

**⚠️ Deux pièges qui rendent un preset non capturable**, sans que rien ne le
signale : un réglage **« Auto »** non nul (calculé depuis la photo — le tester
sur deux images très différentes), et un panneau **Masquage** non vide.

### Reste ouvert

1. **Trancher la licence** : CN11 et CN17 sont dans le bundle sous leurs noms
   Adobe. À régler avant toute mise en ligne.
2. **Construire nos propres looks**, calibrés sur CN11 qui est une référence
   exacte.

### Bibliothèque — ce qui est su et laissé de côté

1. **Le quota est tenu côté client.** Les règles Firestore/Storage garantissent
   la propriété et la taille d'UN fichier (25 Mo), pas le total. Un plafond
   vraiment étanche demande un compteur serveur (Function `onFinalize` qui
   agrège dans `users/{uid}`). À faire avant d'ouvrir à d'autres comptes.
2. **Les règles sont en ligne.** `firestore.rules` et `storage.rules` portent
   `libraryFolders`, `libraryPhotos` et `users/{uid}/library/…`. Les lectures et
   écritures inter-comptes ont été refusées sur les émulateurs avant publication.
3. **Une suppression faite hors ligne peut revenir.** La photo est effacée en
   local et à distance dans la foulée ; si le réseau manque au moment du geste,
   l'écoute Firestore la remontera à la reconnexion. Pas de corbeille ni de
   pierre tombale pour l'instant.
4. **Un renommage n'est pas redescendu.** Un dossier déjà présent en local n'est
   plus relu depuis le compte : renommer sur un appareil ne renomme pas sur
   l'autre tant que la fiche locale existe.
5. **Au-delà de 25 Mo, seul l'aperçu part.** L'original reste sur l'appareil et
   la photo le dit (`originalSkipped`). À revoir si des RAW entrent un jour.

### Tri local — ce qui reste

1. **Pas de touche « je jette ».** Aujourd'hui : **F** garde, la corbeille de la
   tuile retire. Une touche X manque — et il faut trancher ce qu'elle fait :
   supprimer l'aperçu (irréversible sans re-scanner le dossier) ou marquer la
   photo « écartée » et la masquer du parcours (réversible, mais demande un
   filtre). La suppression actuelle passe par un `window.confirm`, incompatible
   avec un tri rapide.
2. **Poignées de fichiers perdues au rechargement.** Le bandeau le dit et propose
   « Retrouver les fichiers » (rapprochement par nom + taille + date de
   modification). Chrome pourrait faire mieux avec `showDirectoryPicker` et une
   poignée persistante ; Safari ne l'a pas, donc le rattachement reste la
   solution qui marche partout.
3. **Un tri de plusieurs centaines de photos n'a pas été mesuré en vrai.** Vérifié
   à 41 puis 60 photos dans un navigateur Chromium. Sur Safari, le HEIC se
   décode nativement (chemin `decodedFrom: 'native'`) — ce chemin-là n'a pas été
   joué par un agent.
4. **La sensation du carrousel à 60 images/seconde n'est pas mesurable ici.** La
   cadence est vérifiée (durées, aucun appui perdu) ; la fluidité perçue sous
   Safari reste un jugement d'œil.

**Hors chantier** — du choix produit, pas de la dette cachée : rail agents IA et
bibliothèque Midjourney (routes et ledger intacts, cf. `src/config/aiLaunch.js`) ;
synchro Google Drive de la photothèque ; couverture émulateurs du parcours
publication, à réécrire sur `/publier`.

---

## Pièges connus

Ils ont déménagé dans **[docs/pieges-connus.md](docs/pieges-connus.md)** —
c'est une référence active, à relire avant de toucher aux presets ou au rendu.

---

## Règles non négociables

- **Jamais supprimer ni remplacer un preset** de `docs/presets-valides.md`.
- **Jamais de Tailwind** dans le nouveau code : CSS Modules + tokens `--vo-*`.
- **Jamais réécrire un moteur existant** : on l'importe, ou on l'**extrait**.
- **IndexedDB** : des Blobs, jamais de dataURL.
- **Desktop ET mobile** sérieux. Textes UI en français simple.
- **Aucun déploiement** sans demande explicite : tout se vérifie en local.
- **Fin de tranche** : gates ci-dessous, mise à jour de ce fichier (qui doit
  **rester court**) et de `map.md`, rapport honnête — puis, dans le chat, le
  **récap en langage simple** seulement. Le prompt de reprise s'écrit dans
  `docs/prompt-reprise-<date>.md` et n'est collé dans le chat **que sur
  demande** (cf. AGENTS.md, « Économie de contexte et de quota »).

---

## Gates

```bash
npm run dev                    # http://localhost:3000 -> /creer
npm run lint                   # 0 erreur (5 warnings préexistants)
npm run build
npm run test:scope
npm run test:vision-preset     # 426 vérifications (Node)
npm run test:vision-filters
npm run test:vibeos-vision     # rejoue test:vision-preset, puis le navigateur
npm run test:vibeos-pipeline   # composition -> Vision -> Studio -> publication
npm run test:vibeos-room       # Layout/Vision -> Room -> ordre -> carrousel iPhone
npm run test:vibeos-library / -layout / -studio / -soundtrack   # si tu y touches
npm run audit:reglages-avances # chaque réglage fait-il quelque chose ? (moteur)
npm run test:reglages-avances  # ...et en poussant les vrais curseurs (interface)
npm run test:routes            # si tu touches aux routes (build + start)

# outils des presets
npm run preset:mire / preset:controle / preset:import          # capturer un preset Lightroom
node scripts/planche-presets.mjs <photo...>                    # planche : LUT seule
node scripts/planche-showcase.mjs                             # planche : EFFETS COMPRIS
node scripts/mesure-ciel-powlisher.mjs [--photo <f>]           # où le ciel atterrit
node scripts/audit-vision-presets.mjs                          # bandes, dominante, témoins
node scripts/compare-vision-presets-on-photos.mjs <photo...>   # écrêtage et force
node scripts/mesure-grain-canaux.mjs --reference <sans> --lightroom <avec> --valeur 50
#   -> son grain CANAL PAR CANAL : corrélation entre canaux, et pixels écrêtés
node scripts/mesure-grain-photo.mjs <sa-photo> --grain 25 --taille 10 --sansgrain <sans>
#   -> le grain sur une VRAIE photo, même flou des deux côtés
node scripts/make-mire-largeur.mjs 1080 810 --sortie <dossier>
#   -> la mire A DESSINÉE à une largeur (jamais réduite : ça ferait baver les bords)
node scripts/compare-preset-vs-lightroom.mjs <src> <lr> <id> [--planche <p>] [--sortie <p>]
#   -> rendu COMPLET (LUT + effets) dans le vrai moteur ; --sans-effets = couleur seule
node scripts/rendu-mire-c.mjs --texture 50 --sortie <png>      # notre moteur sur la mire C
node scripts/mesure-mire-c.mjs --reference <a> --lightroom <b> # netteté / texture / clarté
```

Tous verts au 2026-08-17, les deux audits de réglages compris.

**Échecs préexistants, hors chantier** : `smoke-vibecut-media-safety.spec.cjs`
(3) et `test:vibecut-export-local-mp4` — fixtures manquantes, chemins Windows
d'origine, pointeurs Git LFS ([archive](docs/archive-vibecut-2026-08-04.md#commandes)).
Constatés aussi le 2026-09-05, **sans rapport avec la Room** (vérifiés `git
stash` à l'appui) : `npm run test:scope` échoue sur
`src/features/vibefx-studio/utils/presets/lf08.js` qui contient encore « Chawi »,
et `npm run test:vibeos-layout` échoue quand ses 5 specs tournent en parallèle
sur un seul serveur de dev — les mêmes passent une par une (`--workers=1`).

**Node 22 est requis.** Le build passe sous Node 22. Sous un Node plus récent,
`better-sqlite3` peut encore échouer sur une incompatibilité ABI ; revenir à la
version du projet avant d'en conclure à une erreur applicative.
