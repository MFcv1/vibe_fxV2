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

## LA MISSION SUIVANTE : les −5 % de la vraie photo

Sur le ciel de `photo-test-2` en CN14 (9180 px), son grain vaut 4,84/4,07/4,07
et le notre 4,57/3,85/3,84 : **−5 % IDENTIQUES sur les trois canaux**.

Ce qui est deja elimine, mesure a l'appui :

- **ce n'est pas la couleur** : le rapport entre canaux colle a 0,1 %, et un
  ecart uniforme n'est par definition pas un effet de couleur ;
- **ce n'est pas le bruit de sa chaine** : la meme photo developpee en CN01
  (aucun grain), lue sur les MEMES blocs, ne porte que 0,23 / 0,51 / 0,58.

Restent deux suspects, tous deux non mesures, et **aucun ne se tranche sans un
export de Lightroom fait a la main par Matthis** :

### Export 1 — la Taille 10

CN14 la porte, et notre echelle (0,881) est INTERPOLEE entre la Taille 0 (0,802)
et la Taille 25 (1,000). Si la courbe est convexe, notre grain est trop faible
d'a peu pres ce qu'on mesure.

> mire `~/Desktop/📸 VIBEFX-IMPORTS/0-GRAIN-A-MESURER/A-IMPORTER-DANS-LIGHTROOM/mire-PETITE-1620px.png`
> Grain **50**, Taille **10**, Cassure 50 -> `0-GRAIN-A-MESURER/taille-10/`

### Export 2 — la largeur au-dela de 6480 px

L'exposant 0,577 est ajuste sur 1620 / 3240 / 6480. La photo fait 9180. Un
exposant de **0,549** fermerait exactement l'ecart, et il tombe dans
l'intervalle des pentes mesurees deux a deux (0,539 puis 0,586).

> une mire de **9180 px** de large (a fabriquer : `npm run preset:mire-effets`
> ne sort que 1620 / 3240 / 6480, il faut ajouter la taille dans
> `scripts/make-mire-effets.mjs`), Grain **50**, Taille **25**, Cassure 50.

### Export 3 — la Taille 40 (CN17 et CN18 la portent)

Toujours interpolee, toujours pas mesuree.

> meme mire 1620 px, Grain **50**, Taille **40**, Cassure 50
> -> `0-GRAIN-A-MESURER/taille-40/`

Pour chacun : `node scripts/mesure-taille-grain.mjs <fichier> --valeur 50`, puis
ajouter le point dans `GRAIN_TAILLE_MESUREE` (ou reajuster
`GRAIN_EXPOSANT_LARGEUR`) dans `grainField.js`.

## Les trous restants, par ordre

1. Les deux exports ci-dessus (Taille 10, largeur 9180) — c'est le −5 %.
2. La **Taille 40**, interpolee, portee par CN17/CN18.
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
