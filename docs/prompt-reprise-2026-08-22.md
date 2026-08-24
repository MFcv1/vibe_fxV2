# Prompt de reprise — 2026-08-22 : le grain, apres l'espace de travail

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## A lire, dans cet ordre

1. `AGENTS.md` — regles de travail.
2. `todo.md` — chantier actif.
3. `src/features/vibefx-studio/utils/grainField.js` — **le plus important** :
   la loi du grain, ses mesures, et ce qui n'est PAS mesure.
4. `docs/lightroom/1-procedure.md` — si tu importes un preset.

**Ne PAS lire** : les archives (`docs/archive-*`, `docs/prompt-reprise-*`) ni
`map.md` en entier (`grep -n` sur la zone touchee).

## Ce qui a ete fait le 2026-08-22

**Le grain de couleur est resolu.** Lightroom pose un delta MONOCHROME (sa
correlation entre canaux vaut 0,95 a 1,00 — la piste « trois bruits par canal »
etait fausse et est enterree) mais il le pose **dans son espace de travail** :
primaires ProPhoto, courbe de transfert sRVB. Le retour en sRVB fait tout le
reste, y compris l'ecretage a 0 qui rend deux canaux du meme aplat inegaux.
Aucun parametre ajuste.

| mire A, valeurs 15 / 50 / 100 | avant | apres |
|---|---|---|
| ecart max sur les GRIS | 6,4 % | **0,7 %** |
| ecart max sur les COULEURS | 27 % | **1,2 %** |

Les gris sont intouches **par construction** : les lignes des deux matrices
somment a 1, donc un neutre est un point fixe (chemin rapide explicite).

**L'attenuation aux deux bouts a ete recalee** au passage : son exposant tenait
sur UN point lu apres ecretage. Reajuste sur 12 mesures, il passe de 0,364 a
**0,420**, pire ecart 6,4 % -> 0,68 %.

**Cout maitrise** : le detour valait 9 `Math.pow` par pixel (2,2 s / 12 Mpx).
Deux tables interpolees le ramenent a **430 ms**, avec un test qui borne leur
erreur a 0,01/255 contre les fonctions exactes.

## Les trois exports du 2026-08-22, et ce qu'ils ont donne

Matthis a exporte la mire A en **Taille 10** et en **Taille 40** (1620 px), plus
une mire agrandie x6 (**9720 px**) en Taille 25. Dossier de depot sur le
Bureau : `✅ FAIT - grain, exports du 22 aout`.

**Les 5 % de la vraie photo etaient l'exposant de largeur.** `(largeur/1620)^0,577`
etait ajuste sur 1620/3240/6480 et se trompait de 5,8 % a 9720. Remplace par une
TABLE mesuree (1620 / 3240 / 6480 / 9720) interpolee en log-log. Sur le ciel de
`photo-test-2` en CN14, bruit de fond de sa chaine retire en quadrature :

| | son grain seul | le notre | ecart |
|---|---|---|---|
| avant | 4,83 / 4,04 / 4,02 | 4,57 / 3,85 / 3,84 | -5 % |
| apres | 4,83 / 4,04 / 4,02 | **4,77 / 4,01 / 4,00** | **-1 %** |

**La Taille 40 est mesuree** : echelle 1,1716 (on l'interpolait a 1,183).

## Le PETIT format : REGLE le meme jour (3 exports de plus)

Mires A **dessinees** a 1080 et 810 px (`scripts/make-mire-largeur.mjs` —
dessinees, jamais reduites, sinon les bords des carres bavent), plus un temoin a
Taille 100.

**Un grain ne se dessine pas plus fin qu'un pixel.** Sous 1 px son motif SE
REPLIE sur la grille et son ecart-type monte MOINS VITE que 1/echelle. Nous
suivions 1/echelle jusqu'en bas: **+23 % a 810 px, +10 % a 1080** — la taille
d'un export social. Corrige par `GRAIN_REPLI_MESURE`, qui n'agit QUE sous 1.

**La table des Tailles est desormais en echelles VOULUES**, pas effectives. La
Taille 0 y vaut 0,5825 (pour que le repli la ramene sur ses 0,802 a 1620 px) et
la Taille 10 y vaut 0,879 — lue sur la VRAIE photo a 9180 px, ou le repli ne
s'applique pas. C'est la seule facon de lire une Taille basse proprement.

**Etat des lieux, 10 exports Lightroom (6 largeurs x 5 Tailles) : 0,13 %
d'ecart au pire.** La vraie photo : **-1 %**.

## LA FORME DU GRAIN : reglee le meme jour

Trois choses etaient confondues en une: l'ECHELLE (qui pilote la force), la
GROSSEUR de ses grains (qui n'est pas cette echelle au-dela de 2 px), et le PAS
d'interpolation (qui n'est ni l'une ni l'autre). Table mesuree sur douze
exports, `GRAIN_GROSSEUR_MESUREE`.

**Un bug trouve en chemin, et il coutait cher.** Aux pas ENTIERS et
DEMI-ENTIERS le reseau tombe sur la grille des pixels et le champ perd son
ecart-type de 1: a pas 2,00 c'est **12,7 % de grain en trop**. L'ancienne table
avait un point a pas 2,00 exactement. `eviterResonance` l'ecarte desormais, et
un test balaye toute la plage.

**LE RECADRAGE est teste**, ce qui n'avait jamais ete fait: la loi et le
cablage (le moteur passe `sWidth`, lu dans la source parce que
`studioRenderer.js` est du code navigateur).

## LE PRODUIT EST MORT, LA SURFACE LE REMPLACE (8 exports de plus)

Le modele multipliait une echelle de Taille par une echelle de largeur. Il etait
exact sur les DEUX AXES mesures — la Taille a 1620 px, la Taille 25 a toutes les
largeurs — et personne n'avait regarde ENTRE les deux. Six exports (Tailles 10
et 40 a 1080/3240/6480 px) ont donne des ecarts de **-32 % a +13 %**.

L'effet du curseur Taille GRANDIT avec l'image: le rapport Taille 10 / Taille 25
vaut 1,07 a 1080 px et **1,67** a 6480. Sur une petite image les Tailles basses
se confondent (elles butent sur le pixel), sur une grande elles s'ecartent.

Remplace par `GRAIN_SURFACE_MESUREE`: rangs Taille 10, 25 et 40 mesures d'un
bout a l'autre, deux points sur le rang 100, interpoles log-log sur la largeur
et lineairement sur la Taille. **Pire ecart sur les 18 exports: 0,13 %.**

**LA CASSURE ETAIT LE PIEGE SILENCIEUX, et elle est levee.** Mesuree (1620 px,
Grain 50, Taille 25): a **0** elle pose **1,72x plus de grain**, a **100** elle
grossit les grains de moitie sans changer la force. Un preset qui l'aurait
changee aurait fausse le grain de 72 % sans que rien ne le signale. Elle est
branchee de bout en bout (`grainRoughness`) et passable a l'import
(`--grainRoughness`). **A relever a chaque import**, comme la Taille.

## ETAT ACTUEL

| | ecart avec Lightroom |
|---|---|
| Force, **18 exports** (Tailles 0->100 x largeurs 810->9720) | **0,13 %** |
| Grosseur des grains, 6 exports | 2,2 % |
| Cassure, 3 exports | 0,11 % |
| Gris / couleurs sur mire, 3 forces | 0,7 % / 1,2 % |

## LE GRAND COTE, PAS LA LARGEUR (regle — 1 export)

Une mire de 2160x3240 exportee **en portrait** rend **12,62**, exactement comme
la meme mire en paysage 3240x2160 (**12,64**). La largeur aurait donne 15,73.

C'est donc le **GRAND COTE** qui fixe le grain, l'orientation n'y change rien.
Notre moteur lisait la largeur: une photo verticale de 9180x16320 comptait pour
9180 la ou Lightroom voit 16320 — **47 % d'ecart sur toute photo verticale**.
Corrige (`grandCoteImage` dans `studioRenderer.js`), garde par deux tests.

## LES VRAIES PHOTOS — ET POURQUOI LE GRAIN EST CLOS

Deux photos developpees des deux cotes en CN14 (**Grain 25, Taille 10,
Cassure 50 — releve CONFIRME dans son panneau**, le releve d'import etait
juste). Ciel, 40 blocs plats, bruit de fond retire en quadrature (lu sur la
MEME photo en CN13: meme nettete, aucun grain).

| photo | grand cote | son grain | le notre | ecart |
|---|---|---|---|---|
| `photo-test-1` | 5 392 | 7,73 | 7,41 | **-4 %** |
| `photo-test-2` | 16 320 | 4,03 | 4,71 | **+17 %** |

La premiere est DANS le domaine mesure (810 -> 9720 px), la seconde non: elle
fait 150 Mpx, 1,7x au-dela de la plus grande mire. C'est la SEULE difference
entre les deux, et elle explique tout l'ecart.

**Sur une photo normale, on y est.** Au-dela de 9720 px de grand cote on
extrapole — le rang Taille 10 s'y prolonge par la croissance du rang guide, ce
qui n'est pas une mesure — et ca coute 17 % sur une image de 150 Mpx.

### LA REGLE DE REOUVERTURE

Le grain est **clos**. On ne le rouvre que dans **deux** cas:

1. une image sort **sous 810 px** ou **au-dela de 9720 px** de grand cote. Pour
   le second, deux exports le fermeraient: une mire de **16320 px**
   (`node scripts/make-mire-largeur.mjs 16320`) a Taille **10** et Taille
   **25**, Grain 50 Cassure 50. A ne demander que si une photo de plus de
   100 Mpx doit vraiment etre servie ;
2. un preset porte une **Taille entre 50 et 100** sur une image loin de
   1620 px: ces deux rangs n'ont qu'un ou deux points mesures.

La **CASSURE** n'en fait plus partie — elle est mesuree et branchee. Elle reste
a **RELEVER A CHAQUE IMPORT** pour etre recopiee (`--grainRoughness`), comme la
Taille.

## Ce qui reste ouvert AUTOUR du grain (mais pas dedans)

1. La **REDUCTION DU BRUIT** de Lightroom nous manque (ses presets Cinema II
   posent Luminance 20 / Couleur 50). **Chantier separe, pas du grain**: il part
   du RAW et efface le bruit du capteur AVANT de poser son grain; nous partons
   d'un JPEG ou ce bruit est deja cuit. Invisible a bas ISO, visible dans le
   sombre. C'est le prochain vrai sujet si les photos sont prises en basse
   lumiere.
2. L'**attenuation aux deux bouts sur une COULEUR sombre saturee**: elle est lue
   sur la luminance sRVB et n'a ete mesuree que sur des gris (niveaux 8 et 247).
   Rien dans la mire A ne permet de trancher — il faudrait une mire portant des
   couleurs saturees TRES sombres et TRES claires.
3. Les rangs **Taille 50 et 100** loin de 1620 px: un ou deux points mesures
   seulement. Sans effet sur les presets livres (tous entre 10 et 40).

## Les commandes

```bash
npm run preset:mire-effets            # fabrique les mires (dont la mire A)
node scripts/mesure-grain-canaux.mjs --reference <sans> --lightroom <avec> --valeur 50
node scripts/mesure-grain-photo.mjs <sa-photo.png> --grain 25 --taille 10 \
  --clair 90 --sansgrain <meme-photo-sans-grain.png>
node scripts/mesure-grain-lightroom.mjs --reference <a> --lightroom <b> --valeur 50
node scripts/mesure-taille-grain.mjs <mire...> --valeur 50
node scripts/make-mire-largeur.mjs 1080 810 --sortie <dossier>
npm run test:vision-preset            # 98 verifications, ~3 s
npm run test:vibeos-vision            # 3 tests navigateur, dont le zoom
npm run lint                          # 0 erreur (5 warnings preexistants)
```

Les exports Lightroom disponibles :
`~/Desktop/vibefx-lightroom/ETAPE-1/2-export-SANS-RIEN/mire-A-aplats.png`
(reference), `ETAPE-1/3-export-GRAIN-15/`, `ETAPE-2/1-export-GRAIN-50/`,
`ETAPE-2/2-export-GRAIN-100/`, et la serie de tailles dans
`~/Desktop/📸 VIBEFX-IMPORTS/0-GRAIN-A-MESURER/`.

## Pieges de mesure, payes en temps

- **Ne jamais mesurer un grain avec un voisinage etroit.** Retirer la tendance
  locale sur 3 px sous-estime un grain de 2,4 px. Elargir jusqu'a stabilite
  (12 px sur une photo de 9180).
- **Ne pas melanger gris et couleurs dans une moyenne.**
- **Faire subir exactement le meme geste aux deux cotes.** Soustraire le flou de
  SA photo a NOTRE image donne notre grain entier d'un cote et son grain ampute
  de l'autre.
- **Toujours demander un TEMOIN avec la mesure**: un cas qui sort du mecanisme
  suspecte. La mire de 1080 px a Taille 100 en etait un — ses grains restent
  gros meme sur une petite image, donc hors du repli. C'est elle qui a montre
  que Taille et largeur ne sont pas separables; sans elle, on aurait mis son
  ecart sur le dos du repli et corrige au mauvais endroit.
- **Un ecart UNIFORME sur les trois canaux n'est jamais un effet de couleur.**
  C'est ce qui a evite de chercher au mauvais endroit apres coup.
- **Un rapport lu apres ecretage n'est pas la grandeur qu'on croit lire.** C'est
  ce qui avait fausse l'exposant de l'attenuation.

## Interdits

- Jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Jamais de Tailwind : CSS Modules + tokens `--vo-*`.
- Aucun deploiement, aucun sous-agent sans demande explicite.
- Les exports Lightroom sont faits **a la main par Matthis** : l'agent ne peut
  ni lire ses panneaux ni exporter a sa place. Il DEMANDE, dans le chat.

## Et apres

12 presets restent a importer : CN18, FT01, FT11, LN02, LN05, LN06, TR04, TR13,
TR14, TR15, VCR11, VCR12. Le circuit est dans
`docs/prompt-reprise-2026-08-20.md` (section « Le circuit de travail »).
`FT01`/`FT11` sont de la famille « inspire d'un film », ou des reglages **Auto**
ont deja ete vus : les tester sur deux photos avant de capturer.
