# Prompt de reprise — presets « coucher de soleil »

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`
Branche : `presets-mesures-sur-corpus`

## Lis, dans cet ordre, et rien d'autre

1. `AGENTS.md`
2. `docs/presets-valides.md`
3. `map.md`, **uniquement** les journaux du **2026-08-27** et du **2026-08-27 bis**
   (`grep -n "2026-08-27" map.md` puis `sed -n`)

N'ouvre ni les archives, ni les autres prompts de reprise, ni `map.md` en entier
(3 500 lignes). Le budget de contexte est la vraie contrainte du projet.

## Où on en est

Le moteur Vision porte **17 presets**. `npm run test:vision-preset` : **167
vérifications**, toutes vertes.

Les deux derniers livrés, `ambre` et `ambre-nuit`, ont été tirés d'un **modèle** :
le porteur du projet a posé dix photos dans un dossier, on a étendu ce modèle aux
60 photos du corpus qui lui ressemblent le plus, et on a mesuré. C'est ce
workflow qu'il faut refaire ici, pour le coucher de soleil.

## Ta mission

**Trois ou quatre presets de coucher de soleil**, dans la même dynamique :
cinématique, épuré, propre — « à la Apple ». Des couleurs justes, aucun effet
carte postale, aucun artefact.

---

## LES TROIS PIÈGES DÉJÀ PAYÉS. Ne les refais pas.

Ils ont chacun coûté un preset. Ils sont détaillés dans le journal `map.md` du
2026-08-27.

### 1. Un axe qui se mord la queue

Si tu cherches une direction dans le nuage de ses photos, **ne mélange jamais des
variables de tonalité et de couleur dans le même calcul**. Un pôle défini en
partie par « ses reflets sont chauds » ne peut rien t'apprendre d'autre que : ses
reflets sont chauds.

Un axe se calcule sur **un seul jeu de variables**, et l'autre se mesure **après
coup**, sur les pôles ainsi formés. `scripts/axe-developpement.mjs --sur ton` et
`--sur couleur` font exactement ça.

Et **centre toujours chaque photo sur la médiane de SA famille de sujet** avant
tout calcul. Sans ce centrage, la première direction trouvée est « jour contre
nuit », c'est-à-dire le sujet.

### 2. Un rapport de saturation qui mesure le décor

Comparer « sa bande claire » à « leur bande claire » répond à *« sa bande claire
est-elle plus colorée que la leur ? »*. La réponse est oui — parce qu'il
photographie des couchants et que le tas neutre a des ciels blancs. Ça avait sorti
un ×2,03 qui a fait partir des murs ocres au rouge.

Mesuré **teinte par teinte** puis médiané, le même chiffre tombe à **1,01**.

> **Aucun pôle de son corpus n'augmente la saturation.** Les mesures corrigées
> tombent toutes entre 0,77 et 1,23. Ce look **retire** de la couleur.
> **Ce piège te guette encore plus qu'aux autres : un coucher de soleil EST une
> scène saturée.** Tout ce que tu mesureras en brut te dira « il sature ». Ce
> sera faux.

### 3. Un transport de quantiles emporte l'exposition du tas qui l'a produit

Les photos de coucher de soleil sont sombres parce qu'elles sont **shootées à
contre-jour**, pas parce qu'un réglage les assombrit. Un transport brut te rendra
une courbe qui coûte une exposition et demie, et qui écrasera toutes les photos
de tes utilisateurs.

Garde du transport sa **forme**, et cale ses repères sur ce que le modèle fait
vraiment, avec `scripts/juger-vers-modele.mjs`. `ambre` utilise **une seule
puissance en lumière linéaire** (`y = 1,11 x^0,865`) — deux nombres, deux cibles
mesurées, aucun degré de liberté qui traîne. Une puissance ne peut ni s'inverser
ni s'aplatir. Les trois rattrapages par morceaux essayés avant elle fabriquaient
tous un plateau quelque part, et un plateau bande.

---

## PREMIÈRE CHOSE À FAIRE : le tas d'en face

**Tu ne peux rien mesurer sans photos neutres de couchers de soleil.**
`~/Desktop/powlisher-biblio/neutre/` contient 480 photos rangées en 12 familles
de sujet, mais **presque aucun coucher de soleil**. Vérifie-le avant tout :

```bash
node scripts/mesurer-familles.mjs
```

S'il manque, moissonne une famille `coucher` (Wikimedia Commons,
`scripts/moissonner-neutre.mjs`), 40 photos minimum, **de sources et d'auteurs
variés** — « neutre » ne veut pas dire « non retouché », ça veut dire *non
corrélé à lui* : des centaines de retouches individuelles qui s'annulent en
moyenne.

Ensuite, demande au porteur du projet de poser ses photos-modèle dans
`~/Desktop/sunset/` (comme il l'a fait pour `~/Desktop/lumierejaune`), puis :

```bash
node scripts/voisins-du-modele.mjs --modele ~/Desktop/sunset --nom sunset --n 60
node scripts/mesurer-variante.mjs --liste ~/Desktop/powlisher-biblio/voisins-sunset.json --nom sunset --min 5
```

`voisins-du-modele` te dira de quelles familles viennent les voisins. **S'ils
viennent tous de la même, la ressemblance était du décor : le groupe ne vaut
rien.**

---

## LES QUATRE REGISTRES À VÉRIFIER PUIS CONSTRUIRE

Ce sont des **hypothèses**, pas des commandes. Ton premier travail est de vérifier
qu'elles se séparent vraiment dans le corpus. Celles qui ne se séparent pas, tu
les abandonnes et tu le dis — c'est exactement ce qui est arrivé à
`powlisher-cine-doux`.

Le fondement physique commun, qui justifie de traiter le coucher à part : **au
coucher, la lumière principale est chaude et la lumière d'appoint est le ciel,
donc bleue.** Le split-tone n'est pas un style, c'est ce que fait la scène. C'est
pour ça que ces presets ont le droit d'exister à côté d'`ambre`.

### 1. `contre-jour` — le soleil est dans le cadre

Le seul registre où **le plafond EST le preset**. Le disque et son halo doivent
rester une forme, pas un trou blanc. Ce qui le définit se mesure sur les 1 % les
plus lumineux : où ils atterrissent, et quelle teinte ils gardent.

À mesurer : `pointBlanc`, `refletLuma`, et surtout la **bande des reflets** que
`mesurer-variante.mjs` sort depuis le 2026-08-27 (les 10 % du haut, sur leurs
seuls quasi-gris). Sur `ambre` elle vaut a\* −0,36 / b\* +8,23 — le blanc y est
ivoire, pas blanc.

### 2. `heure-doree` — le soleil est bas mais hors champ

Tout baigne. Ce qui le sépare du précédent : **la chaleur est dans les MÉDIANS**,
pas seulement dans les hautes lumières. C'est vérifiable directement — regarde si
`mediansB` se détache, et pas seulement `hautesB`.

Deux dangers propres à ce registre :
- **la peau**. Sous une lumière déjà chaude, un preset chaud la pousse à l'orange.
  Cible mesurée sur le corpus : la peau part de **29,2°** (tas neutre) et arrive à
  **35,8°** chez lui. Pas plus.
- **le vert**. Un feuillage éclairé au couchant vire au citron si le secteur
  105° n'est pas retenu. `ambre` le tire de −3,83 exprès pour ça.

### 3. `heure-bleue` — après que le soleil est passé

Le complément exact du précédent : ciel bleu-magenta profond, lumières
artificielles qui s'allument, chaleur réduite à des **points** dans un champ
froid. **Vérifie d'abord qu'il ne double pas `ambre-nuit`** (blanc 181, contraste
129, même étalonnage qu'`ambre`) — s'il n'en est pas mesurablement différent, ne
le construis pas.

### 4. `sunset-sobre` — le coucher retenu

L'anti-cliché, et probablement le plus « Apple » des quatre : un coucher rendu
**sobre**, une seule note chaude, tout le reste tenu. C'est celui qui a le plus de
chances d'être unique — tous les presets de coucher du marché sont orange.

Le corpus a de quoi le fonder : l'axe des couleurs sort un pôle `froid`
(étalonnage a\* −4,28 / −3,38 / −4,07). Un coucher passé dans ce registre, c'est
exactement ça.

---

## CE QUI VA TE CASSER, ET COMMENT LE VOIR AVANT L'UTILISATEUR

**Le dégradé de ciel de coucher est le gradient le plus difficile de toute la
photographie pour une LUT.** Il court de l'orange à l'horizon au bleu au zénith,
et il passe par la chroma quasi nulle — exactement l'endroit où un décalage de
split-tone devient plus long que le rayon de teinte et **comprime** les teintes
voisines.

Sur `ambre` cette compression existe et **elle est inoffensive** : le test à
contour donne **1,24×**, contre 1,58× pour le tronc et 3,03× pour `powlisher`,
qui est le plancher du projet. Une compression rapproche ; une bande sépare. Ne
confonds pas les deux, et **ne rattrape pas une compression** : tu casserais le
split-tone pour rien.

Ce que tu dois vérifier, dans cet ordre :

1. `npm run test:vision-preset` — le test de dégradé et le test à contour y sont.
2. **Regarde un vrai ciel de coucher à 1:1, jamais redimensionné.** Une planche
   réduite moyenne les pixels et ment sur les bandes.
3. `node scripts/juger-vers-modele.mjs --presets <tes presets> --n 3` — il te dira
   en pourcentage si tu tends vers le modèle ou si tu le dépasses.

---

## Les règles du projet, non négociables

- **Ne supprime, ne remplace, ne « corrige » aucun preset de
  `docs/presets-valides.md`.** Un variant s'ajoute à côté. Donne aux tiens des
  **noms neufs**, distincts de `powlisher-*` et d'`ambre*`.
- **N'utilise que des opérations que Lightroom sait faire** : courbe, rotations de
  teinte d'**angle fixe**, saturation par plage, étalonnage. **Aucun attracteur**
  (ça fait converger deux teintes et fabrique une bande). **Aucun seuil dur.**
- **Aucune pente de courbe sous 1/8**, le pas d'entrée de la LUT. En dessous, plus
  de huit niveaux d'entrée tombent dans un seul, et rien ne les fait revenir.
  `scripts/courbes-variantes.mjs` le vérifie.
- **Aucun écrêtage.** C'est la règle la plus ferme du corpus : 0,00 % de pixels à
  255 dans les douze familles.
- **Juge à l'œil sur des photos NEUTRES**, jamais sur les siennes — elles portent
  déjà son traitement, tu étalerais deux couches.
- **Aucun sous-agent, aucun déploiement.** Ne lis pas de fichiers entiers.
- Chaque preset livré porte ses vérifications dans `npm run test:vision-preset`,
  et **n'entre dans `docs/presets-valides.md` que sur le regard du porteur du
  projet.**

## Une dette à régler en passant

`todo.md` fait **497 lignes**, la règle du projet en dit ~200. Archive ce qui est
clos dans `docs/archive-<chantier>-<date>.md` **avant** d'ajouter ton lot.

## Rituel de fin

`npm run lint`, les suites touchées, puis `todo.md`, `map.md` (journal daté),
`docs/presets-valides.md` si un preset est validé, et un **récap en langage
simple** dans le chat : ce qui marche et se teste tout de suite, ce qui a été
laissé de côté et pourquoi, les défauts trouvés et corrigés en route.

**N'écris le prompt de reprise dans le chat que si on te l'a demandé au début de
la session.** Sinon, écris seulement le fichier.
