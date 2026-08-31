# Audit Lightroom Cloud — « Style : cinéma II » — 2026-08-30

## Périmètre réel

La famille Adobe affichée dans Lightroom Cloud va de **CN11 à CN18**. Elle ne
contient ni CN19 ni CN20.

Déjà présents dans VibeFX : CN11, CN13, CN14, CN16, CN17. Importés dans ce lot :
**CN12, CN15 et CN18**. La famille est donc complète dans VibeFX.

Les captures de panneaux, les mires exportées et les planches de travail vivent
hors du dépôt dans `~/Desktop/📸 VIBEFX-IMPORTS/`.

## Relevé des réglages Lightroom

| Preset | Lumière / Auto | Effets hors LUT | Détail | Masques |
|---|---|---|---|---|
| CN12 | six curseurs à 0, Auto non appliqué | Texture 0, Clarté 0, Voile 0, Vignette 0, Grain 0 | Netteté 40, réduction du bruit Luminance 20 / Couleur 50 | aucun |
| CN15 | six curseurs à 0, Auto non appliqué | Texture 0, Clarté 0, Voile 0, Vignette 0, Grain 0 | Netteté 40, réduction du bruit Luminance 20 / Couleur 50 | aucun |
| CN18 | six curseurs à 0, Auto non appliqué | Texture 0, Clarté 0, Voile 0, Vignette 0, **Grain 20 / Taille 40 / Cassure 50** | Netteté 40, réduction du bruit Luminance 20 / Couleur 50 | aucun |

Le grain de CN18 a été remis à 0 **uniquement pendant l’export de la mire** : il
est déclaré séparément dans `spatialFilters`, comme il doit l’être. Les trois
mires sont des PNG sRGB 2048×2048, taille réelle, sans netteté de sortie.

## Imports obtenus

| Preset | Écart du look à l’identité | Rugosité de la mire | Effets VibeFX déclarés |
|---|---:|---:|---|
| CN12 | 15,46/255, max 155 | 0,69/255 | NR luminance 20 / couleur 50, Netteté 40 |
| CN15 | 25,93/255, max 170 | 0,73/255 | NR luminance 20 / couleur 50, Netteté 40 |
| CN18 | 22,65/255, max 152 | 0,69/255 | Grain 20, Taille 40, Cassure 50, NR 20/50, Netteté 40 |

La rugosité inférieure à 1/255 confirme que le grain n’a pas contaminé les LUT.
Le smoke verrouille désormais CN11–CN18 et les valeurs avancées de CN12, CN15 et
CN18.

Une planche LUT sur quatre photos Unsplash peu retouchées est disponible dans
`~/Desktop/📸 VIBEFX-IMPORTS/planche-cinema-II-vibefx.png`. De gauche à droite :
CN01 témoin, puis CN11, CN12, CN13, CN14, CN15, CN16, CN17, CN18. Aucun défaut de
bande, d’écrêtage ou de dominante accidentelle n’a été vu. Cela ne suffit pas à
faire entrer les trois nouveaux presets dans `docs/presets-valides.md` : Matthis
doit encore confirmer le goût du rendu.

## Grain : calibration sur téléphone et reflex

### CN14

Une soustraction directe entre la même photo exportée avec et sans grain isole
le champ Adobe sans le confondre avec le bruit du téléphone. CN14 est maintenant
calé aux deux grands formats réellement demandés :

| Grand côté | Lightroom | VibeFX | Grosseur Lightroom / VibeFX |
|---:|---:|---:|---:|
| 8160 px | 6,10/255 | 6,10/255 (-0,1 %) | 1,39 / 1,40 px |
| 16 320 px | 4,09/255 | 4,09/255 (+0,2 %) | 2,27 / 2,35 px |

Le moteur garde donc la force à environ 1 % et la forme à 3,5 % jusque sur le
JPEG Samsung 200 Mpx. La petite réserve de forme vient de la garde
anti-résonance du champ interpolé : chercher 0,00 px ferait gonfler la force.

### CN17

CN17 et CN18 (Taille 40) ont été mesurés sur les mêmes exports avec/sans grain :

- à 8160 px : grosseur à 0,03 px de Lightroom ; force de -0,2 % (CN17) à +1,4 % (CN18) ;
- à 16 320 px : grosseur à 0,2 px ; force de +0,9 % (CN17) à +1,9 % (CN18) ;
- sur deux reflex Canon EOS 200D de 6000 px : grosseur à environ 3 % ; force
  variant de -6,8 à +4,2 %, sans biais systématique.

Le corpus réel utilisé est composé des photos téléphone `37125`, `37131`,
`37148`, `37270` et des reflex `IMG_0216`, `IMG_0349`, `IMG_0410` du dossier
`~/Desktop/maroc`. Les références et planches restent hors dépôt dans
`~/Desktop/VIBEFX-GRAIN-TESTS/`.

## Réduction du bruit et contrôle à l'œil

Le moteur reproduit maintenant le couple Lightroom Luminance 20 / Couleur 50
par un lissage luminance/chroma protégé par les arêtes, placé avant Netteté 40.
Sur les comparaisons finales LUT + réduction du bruit + netteté + grain :

- CN17 téléphone `37131` : **1,70/255** d'écart moyen ; contours ×0,930,
  zones plates ×1,024 ;
- CN18 téléphone `37131` : **1,68/255** ; contours ×0,927, zones plates ×1,039 ;
- CN17 reflex `IMG_0216` : **1,97/255** ; contours ×0,963, zones plates ×1,077 ;
- CN17 reflex paysage `IMG_0349` : **1,74/255** ; contours ×0,845, zones
  plates ×0,957. Le déficit de contour existait déjà dans la LUT seule (×0,859)
  et ne vient pas du nouveau lissage.

Les quatre planches ont été regardées à l'œil, y compris les crops 1:1 : aucune
différence de matière gênante ni dominante accidentelle n'est visible. Les
écarts amplifiés ×8 se concentrent surtout sur les micro-contours et le tirage
aléatoire du grain.

## Limites honnêtes

- La validation chiffrée porte sur les valeurs réellement utilisées par
  Cinéma II : grain Taille 10/40, Cassure 50, réduction du bruit 20/50 et
  Netteté 40. Elle ne rend pas toute la course de chaque curseur Lightroom
  bit-identique.
- La réduction de bruit Adobe dépend du dématriçage RAW. Depuis un JPEG déjà
  développé, VibeFX en reproduit l'effet visible, pas son algorithme interne.
- Les noms et tables des presets Adobe restent soumis à la décision de licence
  déjà ouverte avant toute mise en ligne publique.

## Contrôles exécutés

- `npm run test:vision-preset` : **365/365** vérifications, dont la transmission
  XMP de la Taille et de la Cassure du grain (valeur zéro comprise).
- `npm run audit:reglages-avances` : tous les réglages testés sont actifs.
- `npm run test:vision-filters` : **50** profils inspectés, audit vert.
- `npm run test:reglages-avances` : Vision et Studio passent dans le navigateur.
- `npm run lint` : 0 erreur, 5 avertissements hors de ce lot.
- `npm run test:vibeos-vision` : 2 scénarios sur 3 passent ; l'ancien cas
  `saturee / PowV3` échoue de façon reproductible avec un écart-type de 1,426
  pour un seuil de 1,5. Aucun code de PowV3 ou du moteur concerné n'a changé.
- `npm run build` : compilation et TypeScript passent, puis la collecte de
  `/api/catalog/[jobId]` échoue parce que `better-sqlite3` dans `node_modules` a été
  compilé pour Node ABI 127 alors que le Node courant demande ABI 147. Ce
  problème d'environnement n'a pas été contourné en modifiant `node_modules`.
