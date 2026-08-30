# Pieges connus — ne pas les reintroduire

> Sorti de [todo.md](../todo.md) le 2026-08-27. Ce n'est PAS une archive: c'est
> une **reference active**, a relire avant de toucher aux presets, a la couleur
> ou au rendu. Elle a ete deplacee parce que `todo.md` doit rester court — la
> regle du projet est ~200 lignes — pas parce qu'elle serait perimee.

## Pièges connus — ne pas les réintroduire

**Presets et couleur**

- **Une règle qui dépend de la teinte doit s'éteindre quand le pixel n'a plus de
  teinte.** Dans un voile quasi blanc, la teinte est du bruit : une règle qui s'y
  fie trace un **trait de contour**, invisible dans les moyennes et évident à
  l'écran. Le test « amplification dans un voile » le garde.
- **Juger un preset à l'œil, sur une vraie photo, avant de le livrer.** Les trois
  presets supprimés passaient toutes leurs mesures ; le ciel kaki du showcase
  s'est vu à l'écran, pas dans les chiffres.
- **Photos de test : Unsplash**, parce qu'elles sont **peu retouchées**. Celles
  d'un corpus de référence sont déjà des édits finis : les repasser dans un
  preset étale deux fois le même traitement. Hors du dépôt
  (`~/Desktop/devimage/`). `node scripts/planche-presets.mjs <photo...>` pour la
  couleur, `node scripts/planche-showcase.mjs` pour les effets (grain, vignetage,
  relief) — le premier ne montre que la LUT.
- **« C'est le masque » se DEMONTRE, ca ne s'invoque pas.** La demonstration
  tient en une mesure: MEME niveau d'entree, sorties differentes selon
  l'endroit (48,6 en haut du cadre, 62,1 sur les enseignes, 60,8 en bas). Sans
  cette mesure, l'explication sert a couvrir un ajustement qui plafonne pour
  une autre raison — ici une grille de recherche trop grossiere, qui cachait
  un cinquieme du gain encore disponible.
- **Retirer NOS etages spatiaux de SA cible avant d'ajuster une courbe.** La
  correspondance de niveaux etait comparee a son image telle quelle, degrade du
  bas compris: la courbe essayait de rattraper un assombrissement qu'on applique
  soi-meme ensuite, et choisissait pour ca une epaule raide. Cible corrigee, la
  pente optimale tombe de 1,83 a 1,52 toute seule, les blancs remontent de 8 L*
  et l'amplification du bruit disparait. **Une courbe trop raide est souvent le
  symptome d'une cible mal preparee, pas d'un choix de style.**
- **Le filtre « blocs plats a faible chroma » fabrique son propre biais sur une
  matiere texturee.** Sur du beton MOUILLE il ne garde que les flaques lisses et
  jette l'essentiel de ce que l'oeil voit: il annoncait le sol « cale » (a* -1,68
  contre -1,63) quand la mesure sur TOUS les pixels donnait 0,00 contre -1,99.
  Verifier une couleur de MATIERE sur toute sa surface, pas sur ce qui passe le
  filtre a contours.
- **Une correction s'indexe au niveau ou elle S'APPLIQUE, pas a celui qu'on
  mesure a l'arrivee.** Le virage se pose avant le degrade du bas, qui divise
  ensuite la luminosite par trois: indexer sur la sortie envoyait toute la
  correction dans la mauvaise ancre. Trois tentatives ont echoue sur ce point.
- **L'ORDRE DES LEVIERS CHANGE LEUR VALEUR.** Resolu avant le virage, le
  melangeur demandait +40 et +55 degres de rotation; resolu apres, +18,8 et
  +33,5. Et une valeur de melangeur ne veut pas dire la meme chose selon la
  chroma: le garde-fou n'en laisse passer qu'un sixieme sur une matiere peu
  coloree, mais l'applique EN ENTIER a une couleur franche. **Etre tente de
  baisser un garde-fou est le signe qu'on corrige au mauvais endroit.**
- **Un ecart de LUMIERE sur une seule teinte n'est pas une erreur de courbe.**
  Sur la photo de nuit, ses rouges etaient 1,5x plus lumineux que les notres
  alors que son ciel bleu, mesure au meme moment, etait a 0,99. Une courbe
  aurait touche les deux: c'etait une luminance par TEINTE, le troisieme
  curseur du melangeur de Lightroom. Toujours mesurer un SECTEUR TEMOIN avant
  de conclure a un probleme global.
- **La mediane d'une image n'est pas le regard de celui qui la regarde.** Les
  LED d'une station-service pesent 3,5 % des blocs: une mediane de dE ne les
  voit pas, et l'oeil ne voit qu'elles. Pour une COURBE, ajuster sur la
  correspondance de NIVEAUX (chaque tranche comptant pareil) et non sur la
  mediane de l'image.
- **Une pente de p amplifie le bruit de p.** Un releve de hautes lumieres laisse
  libre est monte a 3,62 L* par L* et a fait echouer le test d'amplification
  (3,71x contre 3,63 autorise). Borner la pente MAXIMALE d'une courbe, pas
  seulement la minimale.
- **Un virage se pose AVANT les effets spatiaux, qui l'attenuent ensuite.** Sur
  le sol assombri de quatre diaphragmes, un a* pose vaut six fois moins a
  l'arrivee: sans compenser cette attenuation, la correction n'arrive jamais.
  Et les blocs qui arrivent quasi eteints des DEUX cotes ont un residu nul par
  construction — nombreux, ils noient la mediane de leur tranche.
- **Une marche qui ne baisse pas quand l'image grandit est une QUANTIFICATION,
  pas une pente.** Le degrade du bas quantifiait son gain en 64 paliers: 4/255
  entre deux lignes voisines a 101 lignes comme a 1 200. Le test qui mesure ca
  doit tourner sur une image REALISTE — sur une image minuscule, la vraie pente
  suffit a produire le meme chiffre et le test ne dit plus rien.
- **Un vignetage ne remplace pas un degrade.** Le premier est radial, le second
  vertical. Sur la photo de nuit de `@powl_d`, ajouter du vignetage a `powV5`
  EMPIRE le rendu a toutes les doses (5,46 a 5,99 contre 5,41 sans), parce qu'il
  assombrit le haut du cadre, qui etait deja juste.
- **Choisir la zone sur laquelle on ajuste, c'est deja choisir le resultat.**
  `powV4` a pris son NIVEAU sur le plateau du masque — la ou l'on mesure
  justement la couleur. C'etait une decision deguisee en mesure: la meme photo
  se lit « il a assombri les bords » ou « il a tout assombri puis rattrape le
  sujet », et une seule image ne tranche pas. Ce qui tranche est le BUT. Pour
  ressembler a une image finie, ajuster sur le CADRE ENTIER: 3,08 de dE76 au
  lieu de 7,15. Une mesure impeccable sur la mauvaise zone reste une erreur, et
  elle ne se voit pas dans les chiffres — seulement a l'oeil.
- **Ne pas mesurer une couleur a travers un masque, ni dans une zone qu'on a
  rebrillantee.** Retirer d'abord le masque (le ramener a son plateau), puis
  n'ajuster la couleur que la ou la correction reste faible — un diaphragme au
  plus. Rebrillanter de quatre diaphragmes un JPEG quasi noir ne restitue pas sa
  couleur, ca amplifie son bruit: sur la paire de nuit, le melangeur voulait
  tourner l'orange de +32 degres sur la foi de 1 065 blocs qui n'etaient que du
  sol remonte. Avec la regle, il en reste 44 et le secteur est ecarte.
- **Une valeur attendue de test se RELEVE, elle ne s'invente pas.** Le controle
  de non-regression de `powV3` en portait une ecrite de tete: il a echoue alors
  que le code etait juste. Un test faux coute plus cher qu'un test absent.
- **Avant de fabriquer un preset pour rattraper un ecart, verifier qu'il n'est
  pas SPATIAL.** Un preset est une fonction: la meme couleur d'entree doit
  donner la meme sortie ou qu'elle soit dans l'image. Le test tient en une
  mesure — regrouper les pixels par couleur d'entree exacte et comparer leur
  sortie en haut et en bas du cadre. Sur la paire de nuit de `@powl_d`, la
  couleur 204,188,164 sort a L* 64,8 en haut et a L* 2,8 en bas: c'est un
  masque, pas un preset, et aucune LUT ne peut le porter. Sur ses deux autres
  photos le meme test donne -0,0 et -0,3 L*. **Un controle qui n'a pas
  d'echantillon dans la zone suspecte ne prouve rien** — c'etait le defaut du
  premier essai, qui n'avait quasi aucun bloc dans le bas du cadre.
- **Ne jamais se caler sur une source dont on ignore ce qu'elle mesure** (la
  « paire avant/après » est passée par une IA : écartée), et se méfier du **biais
  de sélection** quand on mesure un corpus.
- **Deux saturations, ne pas les confondre.** Le mélangeur travaille en HSL, où
  un ciel pâle ressort à 0,36 quand l'œil voit du blanc cassé ; les cibles du
  corpus sont en **chroma `(max−min)/max`**.
- **Ordre dans un preset écrit à la main** : le virage split vient **après** le
  mélangeur de teintes (ordre réel de Lightroom).
- **Un preset qui porte du GRAIN ne se juge pas au pixel.** Son grain et le
  nôtre sont deux tirages aléatoires : ils ne tombent jamais aux mêmes endroits,
  et l'écart pixel à pixel ne peut pas être nul même avec une table parfaite.
  Sur `cn14` ça pesait 4 à 5/255 — assez pour accuser la mire à tort. La ligne
  « couleur seule, par blocs » du comparateur donne la vraie mesure.
- **Le bruit s'ajoute en quadrature.** Pour mesurer un grain, extraire son
  écart-type (`√((total² − base²)/2)`), pas la différence brute.

**Import Lightroom** — le détail est dans
[1-procedure.md](docs/lightroom/1-procedure.md) et
[2-methode-et-pieges.md](docs/lightroom/2-methode-et-pieges.md). L'essentiel :
mire en **blocs**, export **sRVB**, `.rotate()` avant toute comparaison, **grain
à 0 avant de capturer** (il pourrit la table), **masques non capturables** — si
le panneau Masquage n'est pas vide, la capture est fausse sans le signaler. Et
chaque preset importé pèse ~144 ko : au-delà d'une dizaine, chargement paresseux.

**Interface et pipeline**

- **`resolveProjectSource`** : la composition du Layout est **prioritaire** sur
  la photo du projet. Tout écran qui laisse changer de photo doit effacer
  `project.composition`.
- **`applyVisionStage`** ([pipeline.js](src/features/vibeos/project/pipeline.js))
  : un preset peut ne modifier **aucune** clé de `filters`. Tester
  `vision.presetId` **séparément**, sinon l'étage Vision est sauté.
- **Bornes des réglages : une seule source**, côté moteur. L'interface les lit,
  jamais l'inverse. Une borne d'interface plus large que celle du moteur produit
  exactement le symptôme « ce réglage ne marche pas » : la course ne fait rien
  sur sa fin, et le nombre affiché ment. C'était le cas de Studio jusqu'au
  2026-08-17. `npm run test:reglages-avances` le rattrape désormais.
- **Un effet LOCAL ne se juge pas à sa moyenne.** Un halo pèse 0,13/255 sur
  l'image entière et se voit très bien (26/255 sur 20 % du cadre). Juger à la
  moyenne seule fait « réparer » un réglage qui marche.
- **Un réglage à 1 doit faire un effet de 1.** Si le moteur a un étage qui ne
  s'allume qu'au-delà du repos, l'image saute au premier cran et ne bouge plus
  ensuite. C'était le cas du garde-fou de gamut.
- **Un curseur recentré ne convertit JAMAIS position ↔ valeur** : l'arrondi crée
  une **zone morte** et le curseur se bloque. Course élargie symétriquement,
  valeur bornée à la sortie.
- **Un effet de matiere ne se juge pas sur une image reduite.** A « Adapter »,
  l'ecran moyenne le grain et on croit que le reglage ne fait rien : Vision a un
  **zoom** (Adapter / 100 % / 200 % / 400 %) pour ca, comme Lightroom. Et une
  MESURE de grain a le meme piege : retirer un voisinage trop etroit sous-estime
  un grain plus gros qu'un pixel.
- **Toujours exporter un TÉMOIN avec la mesure.** Pour le petit format, la mire
  à Taille 100 servait de contrôle : ses grains restent gros même sur une petite
  image, donc **hors** du mécanisme suspecté. C'est elle qui a montré que la
  Taille et la largeur ne sont pas séparables — sans elle, on aurait mis son
  écart sur le dos du repli et « corrigé » au mauvais endroit.
- **Un écart UNIFORME sur les trois canaux n'est jamais un effet de couleur.**
  Les 5 % qui restent sur une vraie photo étaient attribués au grain de couleur ;
  une fois la couleur réparée, ils étaient toujours là, identiques sur R, G et B.
- **Un rapport lu après écrêtage n'est pas la grandeur qu'on croit lire.**
  L'exposant de l'atténuation du grain était calé sur un seul rapport mesuré à
  faible force : il ne pouvait pas tenir aux fortes, où un quart des pixels
  tombe à 0.
- **Le grain se calcule sur la taille de l'IMAGE, jamais du canvas.** Un aperçu
  qui dessine à 800 px une photo de 9180 doit montrer le grain **réduit**, pas
  le grain d'une image de 800 px — sinon le ciel part en bouillie (15,6/255 au
  lieu de 0,8). C'est ce que fait l'écran de Lightroom. Corollaire : **un aperçu
  montre moins de grain qu'un export**, et c'est normal.
- **La qualité `low` saute relief, netteté, voile et grain.** Dans Vision le
  geste porte justement sur eux : Vision garde `high`.
- **Jamais** recalculer une vignette depuis l'image pleine résolution.

---

