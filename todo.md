# TODO — Vibe_fx V2

> **Point d'étape : 2026-08-27 ter.**
>
> Ce fichier ne porte QUE le chantier **actif**. Il est court **exprès** : un
> agent le relit à chaque session. Le détail de ce qui est clos vit dans les
> archives et dans les journaux datés de `map.md`.
>
> **Ce qui est livré** — redesign VibeOS (`/creer`, `/publier`, `/video`), moteur
> de LUT 3D 33³, chaîne d'import Lightroom, six réglages avancés alignés, et
> **31 presets** dont les douze derniers — `couchant`, `powlishermain` et la série
> `powV2` à `powV11` — attendent un regard. Le détail est
> dans [l'archive du 2026-08-27](docs/archive-calages-lightroom-2026-08-27.md).
>
> **2026-08-29** — la **bibliothèque** (`/creer/bibliotheque`) a le mouvement de
> la référence `@powl_d` : apparition des tuiles en vague lente, rejeu complet au
> changement de densité, carrousel à rail de largeur variable dont les voisines
> suivent le doigt en continu, ouverture en fondu-zoom pendant que la grille
> recule et se floute derrière. La photo est **cueillie sur sa tuile et rendue à
> sa tuile**. Vignettes passées de 720 à **1600 px**, celles déjà stockées
> refabriquées à la demande. En-tête VibeOS inchangé. Détail et pièges : journal
> du 2026-08-29 dans `map.md`.

> **2026-08-30 bis** — **`powV12`**. Ma mesure de la veille etait la mauvaise :
> j'avais regardé la variation entre pixels **voisins**, or une tache est un
> défaut de **basse fréquence**. En blocs 4×4 : source 5,4 %, lui 8,0 %,
> `powV11` **12,4 %**. Trois causes, deux réparables — le relèvement était
> multiplicatif (donc il multipliait les écarts), la courbe amplifiait ×1,29 au
> niveau du lettrage, et la bande de relèvement ne se refermait qu'**après** le
> poteau blanc. `powV12` : taches **9,6 %**, poteau 60,4 → **50,6**. Les dix
> points qui restent sur le poteau ne sont **pas reproductibles** : ni règle de
> teinte (il descend les warm-neutres *moins* que les autres, sur les trois
> paires), ni vignetage (plat sur le restaurant, non monotone sur la station).
> Peint à la main. 340 contrôles.

> **2026-08-30** — le lettrage des enseignes **cessait d'être net** : nos lettres
> mouchetées là où les siennes sont lisses, visible sans zoomer. Cause mesurée :
> dans un blanc, la chroma qui reste vient du rouge qui bave dans le JPEG et sa
> **teinte est du bruit** (jusqu'à 92° entre deux voisins), or le mélangeur donne
> un gain de luminance de **1,569 entre 15 et 45°** et 1,000 au-delà — deux
> voisins identiques sortaient **11,29 L\* d'écart**. Corrigé **dans `powV11`** :
> option `blancsBruites`, fermée par défaut donc inerte pour `powV2`..`powV10`,
> qui remplace ce traitement erratique par un gain **constant**. Lettrage à
> L\* 46,6 contre ses 46,6 ; moucheture ×1,80 → ×1,33 (= la pente de la courbe).
> dE76 : p3 15,52 → **12,90**. Deux fautes attrapées par la fumée, pas par moi —
> le gain fuyait sur les gris neutres, et la bande n'avait pas de bord haut donc
> elle écrêtait. 330 contrôles.


> **2026-08-29 terdecies** — le blanc des enseignes, **corrigé dans `powV11`
> lui-même** (pas de preset de plus). Ce n'était ni la LUT ni le garde-fou —
> deux hypothèses écartées par la mesure — mais une **désaturation** : chroma
> 14,2 contre ses 18,6. Ma correction du sol passait par les secteurs chauds du
> mélangeur, et les enseignes partagent ces secteurs. **Sa règle à lui dépend du
> niveau** (mesuré sur 122 000 pixels) : sous L 55 il désature le chaud de
> moitié, au-dessus il l'enrichit d'un quart. Le mélangeur a donc deux jeux.
> Blancs à chroma **18,7** contre ses 18,6, et le sol ne bouge pas d'un degré.

> **2026-08-29 duodecies** — **`powV11`** : il restait **+1,2 point de blanc**
> sur les enseignes, et ce n'était pas son masque comme je l'avais annoncé —
> c'était ma grille de recherche, trop grossière. Les artefacts restent **sous
> les siens** (7,95 contre 8,14). **Le reste — 2,3 points — est cette fois
> démontré** : au même niveau d'entrée, sa sortie vaut 48,6 en haut du cadre,
> 62,1 sur les enseignes et 60,8 en bas. Une courbe rend une valeur par niveau ;
> ces 2,3 points sont ce que la médiane coûte.

> **2026-08-29 undecies** — **`powV10`** : le blanc des enseignes et les
> « fissures » autour du panneau ESSO avaient **la même cause** — une épaule de
> courbe trop tardive et trop raide (pente 1,83), qui posait les blancs 8 L\*
> trop bas *et* amplifiait le bruit JPEG 1,38× quand lui ne l'amplifie que 1,19×.
> Derrière : une 4e erreur de mesure de ma part — la cible n'avait pas notre
> dégradé retiré avant l'ajustement de la courbe. Corrigée, **la pente optimale
> tombe à 1,52 toute seule**, les blancs remontent et l'amplification disparaît
> (7,67, sous ses 8,14).

> **2026-08-29 decies** — **`powV9`** : le sol enfin gris-bleu (teinte 123 contre
> sa cible 122, au lieu de 90). `powV8` l'annonçait « calé » et il ne l'était
> pas : **deux erreurs de mesure de ma part**, écrites dans les pièges connus.
> (1) le filtre « blocs plats » ne garde, sur du béton mouillé, que les flaques
> lisses — il jetait l'essentiel de ce que l'œil voit ; (2) la correction était
> indexée sur le niveau mesuré à l'arrivée au lieu de celui où elle s'applique.
> **Et l'ordre des leviers compte** : résolu après le virage, le mélangeur
> demande la moitié de ce qu'il demandait avant, et le garde-fou du projet n'a
> pas eu à bouger. Sur sa photo de nuit : **2,12**, le meilleur de la série.

> **2026-08-29 nonies** — **`powV8`** : le rouge et le sol. Son rouge était
> **1,5× plus lumineux** que le nôtre alors que son ciel bleu était à 0,99 — donc
> pas une erreur de courbe, mais **une luminance par teinte**, le 3e curseur du
> mélangeur de Lightroom que le nôtre n'avait pas. Ajouté (aucun preset existant
> ne bouge). Et le sol passe du marron au gris-bleu : a\* −1,68 contre ses
> −1,63. Au passage, l'invariant « le noir pur reste noir » a gagné contre le
> chiffre brut de l'ajustement, et l'ancre suivante a été **résolue** pour rendre
> au sol ce que ça lui prenait.

> **2026-08-29 octies** — **`powV7`** : les LED rallumées. À un niveau d'entrée
> de 75-85, son image était **22,6 L\* plus claire** que `powV6` alors qu'à 55-65
> l'écart n'était que de 1,0 — un seul endroit de l'échelle, et c'est celui que
> l'œil regarde. Deux changements : la courbe s'ajuste sur la **correspondance
> de niveaux** (une médiane ne voit pas 3,5 % de l'image) et un relevé des
> hautes lumières au-dessus de L 62. Écart ramené à **+9,3** — et pas plus bas,
> parce que le test de contour du projet a **refusé** la version à +4,1
> (3,71× contre 3,63 autorisé). **Le sol reste plus chaud que le sien** et c'est
> assumé : cette différence-là est encore positionnelle.

> **2026-08-29 septies** — **`powV6`** et un **nouvel effet dans le moteur** :
> le **dégradé du bas**. Après `powV5`, ce qui restait sur sa photo de nuit
> n'était plus une couleur mais un dégradé vertical — plafond juste, sol 2,5
> diaphragmes trop clair. Le vignetage ne peut pas le faire (il est radial : il
> assombrit aussi le haut, et **mesure à l'appui il empire le rendu à toutes les
> doses**). Une courbe plus contrastée non plus. Le dégradé fait passer l'écart
> de 5,41 à **3,03**. Sa forme comme sa force sont mesurées.

> **2026-08-29 sexies** — **`powV5`**, et la correction d'une erreur : `powV4`
> prenait son NIVEAU sur la zone que le masque ne touche pas. C'était une
> décision déguisée en mesure. Pour ressembler à son image, il faut ajuster sur
> le **cadre entier** : écart **2,92** contre 7,09. Même couleur que `powV4` —
> elle, mesurée au bon endroit — seule la courbe change. **La leçon** : choisir
> la zone sur laquelle on ajuste, c'est déjà choisir le résultat, et ça ne se
> voit pas dans les chiffres, seulement à l'œil.

> **2026-08-29 quinquies** — **`powV4`** : sa photo de nuit, avec la COULEUR
> remesurée dessus (et non plus reprise de `powV2`). Il a fallu retirer son
> masque du calcul d'abord, et n'ajuster la couleur que là où cette correction
> reste faible. **La trouvaille** : ses bas-tons de nuit sont bien moins chauds
> que sur ses deux photos de jour (b\* +2,96 contre +4,67) et son ciel de nuit
> est plus sourd (chroma 0,61 contre 0,85). Une scène de LED n'est pas une scène
> de jour. Sur la zone jugeable : **3,68** contre 4,19 (`powV3`) et 4,68
> (`powV2`). RÉSERVE : une seule photo — `powV2` reste la mesure de son style.

> **2026-08-29 quater** — **`powV3`**, la déclinaison NUIT de `powV2` (même
> couleur au chiffre près, seule la courbe bouge — la règle de la famille). Mais
> **la vraie trouvaille du lot est ailleurs** : sur sa photo de nuit, l'essentiel
> de ce qui manquait n'est pas un preset, c'est un **masque qu'il a peint à la
> main**. Au centre du cadre `powV2` est déjà juste (−0,03 diaphragme) ; en bas
> il est **quatre diaphragmes** plus sombre. Ses deux autres photos n'ont rien de
> tel (0,00 et 0,06 d'écart centre-bords), donc ce n'est pas son preset — et une
> LUT ne sait pas où est le pixel. **Ce qu'il faudrait : un outil de dégradé
> local dans Vision**, pas un preset de plus.

> **2026-08-29 ter** — **`powV2`**, 22e preset : `powlishermain` plus **la
> courbe**. Le refus de toucher à la lumière était juste sur le papier et faux à
> l'écran — rejoué sur ses trois AVANT, le rendu restait plus clair et plus plat
> que son APRÈS. Écart dE76 **sans exposition libre** (ce qu'on voit dans l'app) :
> 11,85 → **4,56**, soit **61,6 % repris** contre 18,8 % pour `powlishermain`.
> Deux courbes meilleures en chiffres ont été **refusées** : l'une part en zigzag
> (elle surapprend sur trois photos), l'autre efface le volant d'une des photos.
> Reste à la nuit 8,52 : son édit de nuit est 1,3 EV plus bas que ce qu'une
> courbe commune peut rendre. Aucun preset existant touché.

> **2026-08-29 bis** — `powlishermain`, **21e preset et le premier calé sur des
> avant/après CERTAINS** : trois captures de son écran Lightroom (la même photo
> avant et après), publiées par `@powl_d` le 12 novembre 2025. 43 691 blocs
> mesurés. Trois trouvailles : **sa courbe ne fait rien** (ses trois retouches
> sont un simple gain, −1,85 / −0,22 / −0,56 EV — c'est son curseur, pas un
> preset), le **coup de saturation sur les rouges n'existe pas** (c'était le
> virage qu'on voyait), et **`powlisher-ciel` avait raison** : son ciel arrive à
> 192° TSL, la fenêtre trouvée en 2026-08-12 par une méthode sans rapport.
> Résultat : dE76 médian 6,81 → **3,15**, contre 5,43 au meilleur des autres.
> Aucun preset existant touché. Détail :
> [docs/paires-avant-apres-powlisher-2026-08-29.md](docs/paires-avant-apres-powlisher-2026-08-29.md).

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
[**après la correction du lettrage de `powV11`** — 2026-08-30](docs/prompt-reprise-2026-08-30.md),
[après le mouvement de la bibliothèque — 2026-08-29](docs/prompt-reprise-2026-08-29.md),
[après `couchant` — 2026-08-27 ter](docs/prompt-reprise-2026-08-27-ter.md),
[la famille cine et `ambre` — 2026-08-27](docs/prompt-reprise-2026-08-27.md),
[les presets mesures sur corpus — 2026-08-25](docs/prompt-reprise-2026-08-25.md),
[le grain, apres l'espace de travail — 2026-08-22](docs/prompt-reprise-2026-08-22.md),
[la série d'imports Lightroom — 2026-08-20](docs/prompt-reprise-2026-08-20.md).

Archives, à ouvrir **seulement** si on travaille dans la zone concernée :
[VibeOS](docs/archive-vibeos-2026-08-11.md) ·
[VibeCut](docs/archive-vibecut-2026-08-04.md) ·
[presets, lots H/I/J](docs/archive-presets-vision-2026-08-12.md) ·
[état livré + calages Lightroom](docs/archive-calages-lightroom-2026-08-27.md).

---

## Ce qui reste

### D'ABORD — regarder les presets qui attendent un regard

Ils sont livrés et testés ; il manque **le regard**. Ouvrir les planches de
`~/Desktop/powlisher-biblio/` et dire, un par un, gardé ou pas. Ceux qui sont
gardés entrent dans [docs/presets-valides.md](docs/presets-valides.md).

| Preset | Livré | Ce qu'il faut regarder |
|---|---|---|
| `couchant` | 2026-08-27 ter | **Le seul preset du projet mesuré contre des COUCHANTS.** Il retire la saturation « carte postale » (×0,71 dans les médians) : sur un ciel magenta c'est net, sur un soleil doré il éteint l'or. C'est le point à trancher à l'œil. |
| `powV11` | 2026-08-29 duodecies, corrigé les terdecies et 2026-08-30 |  Blancs des enseignes crème comme les siens (chroma 18,7 contre 18,6). Lettrage des enseignes lisse depuis le 2026-08-30 (option `blancsBruites`). Réserve : il verdit l'ocre, mais **seulement dans les niveaux sombres** depuis la correction. |
| `powV12` | 2026-08-30 bis | **Le bout de la série.** Corrige deux défauts vus à l'œil sur `powV11` : les **taches** de gris dans le lettrage des enseignes (dispersion en blocs 4×4 : 12,4 % → **9,6 %**, la sienne est à 8,0 %) et le **poteau blanc** qui sortait à 60,4 pour un sien à 39,5 (**50,6** maintenant). Réserve mesurée : les dix points qui restent sur le poteau ne sont pas reproductibles par un preset — ni règle de teinte, ni vignetage, c'est peint à la main. |
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

**Série en cours (favoris de Matthis)** : faits `cn01`, `cn11`, `cn13`, `cn14`,
`cn16`, `cn17`. Restent CN18, FT01, FT11, LN02, LN05, LN06, TR04, TR13,
TR14, TR15, VCR11, VCR12. Le circuit de dossiers est décrit dans le prompt de
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

**Hors chantier** — du choix produit, pas de la dette cachée : rail agents IA et
bibliothèque Midjourney (routes et ledger intacts, cf. `src/config/aiLaunch.js`) ;
synchro Google Drive de la photothèque (la bibliothèque est locale en IndexedDB) ;
couverture émulateurs du parcours publication, à réécrire sur `/publier`.

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
npm run test:vision-preset     # 98 vérifications (Node, 3 s)
npm run test:vision-filters
npm run test:vibeos-vision     # rejoue test:vision-preset, puis le navigateur
npm run test:vibeos-pipeline   # composition -> Vision -> Studio -> publication
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

**`npm run build` échoue depuis la machine, pas depuis le code** (vu le
2026-08-19, reproduit sans aucune modification) : le code compile, mais la
collecte de page casse sur `/api/catalog/[jobId]` parce que `better-sqlite3` a
été compilé pour un autre Node (NODE_MODULE_VERSION 127 contre 147). Correctif :
`npm rebuild better-sqlite3`.
