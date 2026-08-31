# Archive — presets Lightroom, Gradient Builder et Studio (jusqu'au 2026-08-30)

> Sorti de `todo.md` le 2026-08-31 : ces lots sont **clos**. Ne pas ouvrir ce
> fichier sauf si on travaille exactement dans la zone concernée (import de
> presets Lightroom, série `powV*`, Gradient Builder, recentrage du Studio).
> Les journaux datés correspondants vivent dans `map.md`.

> **2026-08-30 ter — Cinéma II complet.** Lightroom Cloud confirme que la
> famille Adobe va de CN11 à CN18. Les trois absents **CN12, CN15, CN18** sont
> importés par mires 2048 en blocs ; leurs réglages avancés sont relevés et
> verrouillés par le smoke. La réduction du bruit 20/50 est reproduite pour les
> huit presets, et le grain Taille 10/40 est recalé jusque 16 320 px sur quatre
> photos téléphone et trois reflex du dossier `~/Desktop/maroc`. Les contrôles
> finaux LUT + effets valent **1,68 à 1,97/255** et ont été regardés à l'œil.
> Vision rangeait alors les 35 presets en collections recherchables : les
> huit CN11-CN18 étaient ensemble dans `Cinéma II`, avec filtres Apple-dark,
> compteurs et état vide. Les prochains imports acceptent `--collection`.
> Audit complet :
> [docs/lightroom/audit-cinema-II-2026-08-30.md](docs/lightroom/audit-cinema-II-2026-08-30.md).
> Les gates ciblés passent. Deux réserves hors lot restent consignées dans
> l'audit : le smoke global `PowV3` sous son seuil de contraste, et le build
> bloqué après compilation par l'ABI locale de `better-sqlite3`.
>
> **2026-08-30 quater — Cinéma complet.** La famille Lightroom Cloud
> `Style : cinéma` est CN01–CN10. CN01 quitte `Imports` sans modification de sa
> LUT ; CN02–CN10 sont importés par mires propres et rangés dans `Cinéma`.
> Aucun ne porte de grain. CN02–CN10 reproduisent Netteté 40 et réduction du
> bruit 20/50. Les contrôles CN02/CN10 sur téléphone et reflex valent
> **1,23 à 1,98/255**, verdict identique à l'œil. Audit :
> [docs/lightroom/audit-cinema-2026-08-30.md](docs/lightroom/audit-cinema-2026-08-30.md).
>
> **2026-08-30 — neuf familles Premium supplémentaires.** Les 92 looks
> `Futuriste` (FT01–FT12), `Inspiré d’un film` (12), `Noir et blanc`
> (BW01–BW12), `Vintage` (VN01–VN10) et `Architecture urbaine` (UA01–UA10)
> ainsi que `Paysage` (LN01–LN10), `Style de vie` (LF01–LF08), `Voyage`
> (TR01–TR10) et `Voyage II` (TR11–TR18) sont capturés depuis Lightroom Cloud,
> indexés et visibles dans leurs filtres.
> Les valeurs avancées explicites sont conservées ; le vignetage Lightroom
> négatif est normalisé vers la force positive attendue par le moteur VibeFX.
> LF03 conserve notamment son voile à −28 grâce à une borne sûre étendue à −30.
> **Correction BW du 2026-08-31 :** la première capture BW01–BW12 avait exporté
> une mire encore colorée. Les douze Hald ont été recapturées après clic réel du
> preset dans Lightroom Cloud ; VibeFX retrouve désormais dans le bon ordre gris,
> sépia, rose, vert, gris neutres, brun et bleu. Un second audit dans
> l'application Lightroom a réparé les effets hors LUT : vignette -25 complète
> sur BW01–BW12, suppression du faux grain de BW03–BW09, retrait du faux voile
> de BW08 et restauration des trois groupes clarté/texture. Le moteur passe
> 433 vérifications, le smoke Vision 3/3 et les réglages avancés 1/1 ; lint reste
> à 0 erreur avec 5 avertissements préexistants. Le build compile puis rencontre
> toujours le blocage ABI local préexistant `better-sqlite3` (127 contre 147).
> Reprise : [docs/prompt-reprise-2026-08-31-bw-effets-lightroom.md](docs/prompt-reprise-2026-08-31-bw-effets-lightroom.md).
> les quatre nouvelles familles ont aussi été regardées sur une photo téléphone
> et une photo reflex du dossier `~/Desktop/maroc`.
>
> **2026-08-30 — quatre familles saisonnières.** Printemps SP01–SP12, Été
> SM01–SM11, Automne TM01–TM12 et Hiver WN01–WN10 ajoutent 45 presets, soit 181
> au total. Aucun ne porte de grain. Le contrôle téléphone + reflex a corrigé
> le vignettage positif, l'ordre du détail avant LUT, le dosage photo de la
> clarté et la protection des arêtes de la texture, sans modifier les anciens
> presets validés. Audit :
> [docs/lightroom/audit-saisons-2026-08-30.md](docs/lightroom/audit-saisons-2026-08-30.md).
>
> **2026-08-30 decies — Studio recentré.** `/creer/studio` est maintenant un
> lanceur Apple-dark avec seulement **Gradient** et **Lumen**. Les ambiances et
> Mesh ont quitté cette surface ; les presets photo restent dans Vision et Mesh
> reste dans Layout. Chaque mini-app s'ouvre bord à bord sous le bandeau VibeOS,
> jusqu'aux côtés et au bas, sur desktop comme mobile. Le pont `postMessage`
> persiste toujours le rendu en Blob dans le projet. Le smoke Studio passe 2/2.
>
> **2026-08-30 nonies — Gradient Builder : chantier clos.** Les quatre moteurs
> qui manquaient sont ecrits — **Glassy**, **Glint**, **Mist**, **Skyline** (5
> villes) — donc **les 28 types rendent leur vrai dessin**. Ajoutes aussi : le
> **panneau Forms complet** (35 silhouettes, 12 gammes, 13 fonds, transformation
> a la main sur le canvas, Form treatment), l'**onglet Image** (logo ou photo
> posee, taille/rotation/opacite/fusion), et les **exports PNG / SVG / CSS /
> JSON / video** dans une feuille dediee. L'animation couvre maintenant les
> types calcules pixel par pixel, en resolution reduite. Reste en dehors :
> la page « What's new », que tu n'as pas demandee. `npm run lint` passe.

> **2026-08-30 octies — Gradient Builder, tranche 2 : les moteurs.** Le retour
> etait : l'UI est bonne, les types ne valent pas ceux du site. C'etait juste —
> 18 types sur 28 retombaient sur une rampe lineaire. **Il en reste 4** :
> Glassy, Glint, Mist, Skyline. Ecrits dans cette tranche : **Sky** et
> **Aurora** en WebGL (vrais nuages, vraie aurore, et elles s'animent),
> **Lines** (13 formes de trait + les 8 arrangements du site), **Forms**
> (35 silhouettes SVG), **Still**, **Retro**, **Noise**, **Prism**, **Rings**,
> **Beehive**, **Blocks**, **Balls**, **Pixel**, **Arch**. Le **texte** accepte
> maintenant plusieurs boites deplacables, et les presets apportent les leurs.
> Chaque type a son groupe de reglages propre. `npm run lint` passe (0 erreur).

> **2026-08-30 septies — Gradient Builder, tranche 1.** Nouveau chantier, sans
> rapport avec Lightroom. Reconstruction de l'ecran Studio de
> `feralui.dev/gradients` en app autonome dans
> `public/vendor/gradient-builder/`, ouverte plein ecran depuis « Fond genere »
> du Studio (bouton `Gradient`, a cote de Mesh et Lumen) et rendue au parent par
> `postMessage`, comme Lumen. **Livre** : la coquille complete (entete, modes,
> panneau vitre, dock des 28 types en 5 familles, bandes, barre du bas, clair et
> sombre), les donnees du site (208 presets de panneau, 69 degrades de galerie,
> 12 gammes de palette, nuancier de 102 couleurs), et **10 moteurs de rendu
> ecrits** : Flow, Mesh, Linear, iOS, Radial, Conic, Waves, Stripes, Bars,
> Columns. **Reste** : les 18 autres types (dont Sky en WebGL, Lines, Forms,
> Glassy, Pixel, Prism, Blocks, Rings, Mist, Glint, Skyline...), l'onglet Image,
> et les exports SVG / CSS / JSON / MP4. Les types sans moteur apparaissent dans
> le dock et retombent sur la rampe lineaire. `npm run lint` passe (0 erreur).

> **2026-08-30 quinquies — miniatures et vignettage Lightroom.** Les cartes de
> presets ne rendent plus la LUT seule : elles passent par le même pipeline que
> la grande photo, donc texture, clarté, voile, réduction du bruit, netteté,
> vignetage et grain sont visibles avant le clic. Le calcul se fait par lots de
> quatre pour rester fluide au-delà de 100 presets. L'import porte aussi les
> quatre sous-réglages Adobe du vignetage (milieu, arrondi, contour progressif,
> hautes lumières), le voile négatif et un profil radial mesuré sur quatre
> exports Lightroom. Le chemin historique des presets déjà validés reste
> bit-à-bit inchangé. Les smokes ciblés et le lint passent ; le build compile
> puis reste bloqué par l'ABI locale préexistante de `better-sqlite3`.
>
> **2026-08-29** — la **bibliothèque** (`/creer/bibliotheque`) a le mouvement de
> la référence `@powl_d` : apparition des tuiles en vague lente, rejeu complet au
> changement de densité, carrousel à rail de largeur variable dont les voisines
> suivent le doigt en continu, ouverture en fondu-zoom pendant que la grille
> recule et se floute derrière. La photo est **cueillie sur sa tuile et rendue à
> sa tuile**. Vignettes passées de 720 à **1600 px**, celles déjà stockées
> refabriquées à la demande. En-tête VibeOS inchangé. Détail et pièges : journal
> du 2026-08-29 dans `map.md`.

> **2026-08-30 bis** — **`powV12`**. **Deux fois j'ai mesuré à côté.** D'abord
> entre pixels *voisins*, alors qu'une tache est un défaut de basse fréquence.
> Ensuite : ma correction améliorait la dispersion et **ne changeait rien à
> l'écran** — la carte des écarts lui a donné raison, le lettrage bougeait de
> **−0,60 L\*** et le **ciel de +5,28**. Le vrai défaut, cherché au bon endroit :
> son blanc est **crème** (L 46,1 / chroma 18,0), le nôtre **gris** (43,2 /
> 14,5). `powV12` les pose à **46,2 / 16,0**, et ne touche à rien d'autre
> (ciel +0,09, sol 0,00, moto 0,00). Poteau 60,4 → **50,6**. Écart connu non
> corrigé : il **désature le rouge** (moto 40,6 → 31,4), pas nous. 343 contrôles.

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
