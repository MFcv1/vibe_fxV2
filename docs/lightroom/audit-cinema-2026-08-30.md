# Audit Lightroom Cloud — famille Cinéma (CN01–CN10)

Date : 2026-08-30. Source contrôlée directement dans Lightroom Cloud sur Mac.

## Périmètre

La catégorie Premium Adobe **« Style : cinéma »** contient exactement CN01 à
CN10. Elle est distincte de **« Style : cinéma II »**, qui contient CN11 à
CN18.

CN01 existait déjà et avait été validé sur de vraies photos. Sa table LUT a été
conservée **octet pour octet** ; seul son classement explicite dans la
collection `Cinéma` a été ajouté. CN02 à CN10 ont été capturés avec la mire Hald
sRGB 2048 × 2048 en blocs 4 × 4, puis importés dans VibeFX.

## Réglages avancés relevés

Pour CN02 à CN10, les panneaux Lightroom donnent :

- Texture 0, Clarté 0, Correction du voile 0 ;
- Vignette 0 ;
- Grain 0, donc aucun grain à reproduire pour cette famille ;
- Netteté 40, Réduction du bruit Luminance 20 et Couleur 50 sur la photo JPEG
  de contrôle ;
- aucun Auto, aucun noir et blanc et aucun masque actif.

La Taille de grain affichée quand Grain vaut 0 n'est pas une consigne du
preset : elle varie selon l'image et reste désactivée. Elle n'est donc pas
importée. CN01 conserve ses réglages spatiaux déjà validés, sans ajout par
inférence.

## Contrôle des captures

Les neuf mires CN02–CN10 ont une rugosité comprise entre 0,60 et 0,80/255,
nettement sous le seuil de contamination par du grain (3/255). Les écarts à la
mire neutre sont :

- CN02 35,78/255 ; CN03 41,01 ; CN04 44,82 ; CN05 47,39 ;
- CN06 33,89/255 ; CN07 40,61 ; CN08 47,55 ; CN09 37,13 ; CN10 35,51.

## Comparaisons sur vraies photos

Deux extrémités de la famille, CN02 et CN10, ont été exportées depuis Lightroom
et comparées au moteur complet VibeFX sur :

- `37131.jpg`, photo téléphone de 4592 × 8160 ;
- `IMG_0349.JPG`, photo reflex Canon du dossier `~/Desktop/maroc`, 4000 × 6000.

Résultats, avec LUT + Netteté 40 + réduction du bruit 20/50 :

| Preset | Photo | Écart moyen | P99 | Verdict |
|---|---|---:|---:|---|
| CN02 | téléphone | 1,52/255 | 9/255 | identique à l'œil |
| CN02 | reflex | 1,23/255 | 6/255 | identique à l'œil |
| CN10 | téléphone | 1,98/255 | 11/255 | identique à l'œil |
| CN10 | reflex | 1,38/255 | 7/255 | identique à l'œil |

Les quatre planches, y compris leurs crops 1:1 sur le pelage et les détails de
la plage, ont été regardées. Aucun écart gênant de couleur ou de matière n'est
visible. Les fichiers de travail restent hors dépôt dans
`~/Desktop/📸 VIBEFX-IMPORTS/CN02` et `CN10`.

## Résultat produit

Vision expose maintenant une collection **Cinéma** contenant exactement CN01 à
CN10, à côté de **Cinéma II** (CN11–CN18). Aucun de ces dix presets n'apparaît
dans `Imports`. Les nouveaux CN02–CN10 restent hors de
`docs/presets-valides.md` tant que Matthis ne les a pas validés lui-même.
