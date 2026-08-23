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
Bureau : `GRAIN - 3 EXPORTS A FAIRE`.

**Les 5 % de la vraie photo etaient l'exposant de largeur.** `(largeur/1620)^0,577`
etait ajuste sur 1620/3240/6480 et se trompait de 5,8 % a 9720. Remplace par une
TABLE mesuree (1620 / 3240 / 6480 / 9720) interpolee en log-log. Sur le ciel de
`photo-test-2` en CN14, bruit de fond de sa chaine retire en quadrature :

| | son grain seul | le notre | ecart |
|---|---|---|---|
| avant | 4,83 / 4,04 / 4,02 | 4,57 / 3,85 / 3,84 | -5 % |
| apres | 4,83 / 4,04 / 4,02 | **4,77 / 4,01 / 4,00** | **-1 %** |

**La Taille 40 est mesuree** : echelle 1,1716 (on l'interpolait a 1,183).

## LA MISSION SUIVANTE : le PETIT format

A 1620 px, sa **Taille 10 rend exactement sa Taille 25** — 18,37 et 1,01 px
contre 18,37 et 1,02 — alors que les deux exports different sur 98 % de leurs
pixels (ce sont bien deux tirages distincts, verifie). La vraie photo dit
l'inverse a 9180 px.

Ce qui reconcilie les deux : **un grain ne se dessine pas plus fin qu'un
pixel**, et Lightroom n'augmente PAS sa force pour compenser. Notre moteur, lui,
le fait — 13 % de trop des que l'echelle passe sous 1.

Sans consequence sur une photo. Mais **un export social fait 1080 px de large**,
et rien n'est mesure sous 1620. A cette taille notre grain est probablement
25 % trop fort.

> **L'export a demander** : la mire A **reduite a 1080 px de large** (a
> fabriquer : `sharp(mire).resize(1080)` en plus proche voisin ne marche pas,
> 1080 n'est pas un diviseur entier de 1620 — refaire la mire A directement a
> 1080x720 en adaptant `scripts/make-mire-effets.mjs`), Grain **50**,
> Taille **25**, Cassure 50. Puis
> `node scripts/mesure-taille-grain.mjs <fichier> --valeur 50` — mais attention,
> ce script n'accepte que des multiples ENTIERS de 1620x1080 : il faudra lui
> apprendre les reductions, ou mesurer avec `mesure-grain-canaux.mjs`.

(La **Taille 0** echappe a cette regle : elle descend bien sous le pixel, avec
une autocorrelation au voisin NEGATIVE — signe d'une structure plus fine que le
pixel qui se replie. C'est un autre mecanisme, laisse tel quel.)

## L'AUTRE ECART, nouveau et non resolu

**Sa force et sa grosseur cessent d'etre le meme nombre quand l'image grandit.**
A 9720 px sa force donne une echelle de 2,66 alors que sa longueur de
correlation vaut 3,35 — 26 % d'ecart. A 1620 et 3240 px les deux coincidaient.
Sa FORME de grain change avec l'echelle, pas seulement sa taille.

Nous posons la bonne FORCE (0,4 % pres aux quatre tailles mesurees) et des
grains un peu **trop fins** : 2,92 contre 3,35 a 9720 px, 2,21 contre 2,29 sur
la photo. Corriger demande de remodeler le spectre du bruit
(`GROSSEUR_PAR_PAS` dans `grainField.js`), et deux points de mesure ne
suffisent pas a le dessiner. Il en faudrait un balayage.

## Les trous restants, par ordre

1. Le **petit format** (voir plus haut) : rien n'est mesure sous 1620 px, et
   un export social en fait 1080.
2. La **forme** de son grain aux grandes tailles (voir plus haut).
3. La **Cassure**, jamais mesuree, laissee a 50 partout. **A verifier au releve
   de chaque import** : si un preset la change, la mesurer avant de la recopier.
4. Le **recadrage** : `renderStudio` prend `largeurImage = sWidth`, ce qui est
   le bon choix, mais aucun test ne le verifie.
5. L'**attenuation sur une couleur sombre saturee** : elle est lue sur la
   luminance sRVB et n'a ete mesuree que sur des gris. Rien dans la mire A ne
   permet de trancher.
6. La **reduction du bruit** de Lightroom nous manque (ses presets Cinema II
   posent Luminance 20 / Couleur 50). A traiter le jour ou un preset sert sur
   une photo bruitee.

## Les commandes

```bash
npm run preset:mire-effets            # fabrique les mires (dont la mire A)
node scripts/mesure-grain-canaux.mjs --reference <sans> --lightroom <avec> --valeur 50
node scripts/mesure-grain-photo.mjs <sa-photo.png> --grain 25 --taille 10 \
  --clair 90 --sansgrain <meme-photo-sans-grain.png>
node scripts/mesure-grain-lightroom.mjs --reference <a> --lightroom <b> --valeur 50
node scripts/mesure-taille-grain.mjs <mire...> --valeur 50
npm run test:vision-preset            # 82 verifications, ~2 s
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
