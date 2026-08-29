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

