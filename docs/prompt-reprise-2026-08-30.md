# Prompt de reprise — 2026-08-30 (181 presets Lightroom/VibeFX)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2` — branche
`presets-mesures-sur-corpus`, base du lot `d2260b9`, changements non commités.

## Ordre de lecture

1. `AGENTS.md` (règles, économie de contexte, rituel de fin de phase).
2. `todo.md` (chantier actif seulement).
3. `docs/presets-valides.md` — **fait autorité** : ne jamais y supprimer ni
   remplacer un preset ; un variant s'ajoute.
4. `docs/lightroom/audit-cinema-2026-08-30.md`, puis
   `docs/lightroom/audit-cinema-II-2026-08-30.md`.
5. `map.md`, **par extraits seulement** : journal `2026-08-30 ter`.

**Ne pas lire** : `docs/archive-*`, les autres `docs/prompt-reprise-*`, ni le
reste de `map.md` sans besoin précis.

## État du lot

La bibliothèque Vision expose maintenant 181 presets. Aux familles Cinéma et
Cinéma II décrites ci-dessous s'ajoutent : Futuriste (FT01–FT12), Inspiré d’un
film (12 looks nommés), Noir et blanc (BW01–BW12), Vintage (VN01–VN10) et
Architecture urbaine (UA01–UA10), puis Paysage (LN01–LN10), Style de vie
(LF01–LF08), Voyage (TR01–TR10), Voyage II (TR11–TR18), Printemps (SP01–SP12),
Été (SM01–SM11), Automne (TM01–TM12) et Hiver (WN01–WN10). Tous sont capturés
depuis Lightroom Cloud, rangés dans leur collection et testés par des comptes
exacts. Le marqueur
`vignetteLightroomV2` active la courbe mesurée du moteur ; l'importeur convertit
la valeur Lightroom négative en force positive VibeFX ; les valeurs positives
gardent désormais leur sens clair. Le détail des saisons et du profil avancé
est dans `docs/lightroom/audit-saisons-2026-08-30.md`.

Les familles Lightroom Cloud sont désormais complètes : « Style : cinéma » va
de CN01 à CN10 et « Style : cinéma II » va de CN11 à CN18. VibeFX
possédait CN11, CN13, CN14, CN16 et CN17 ; CN12, CN15 et CN18 ont été capturés
par mires Hald sRGB 2048×2048 en blocs 4×4 puis ajoutés dans
`src/features/vibefx-studio/utils/presets/`.

CN02 à CN10 ont été capturés le 2026-08-30 par mires Hald propres. Ils ne portent
aucun grain ; Netteté 40 et réduction du bruit 20/50 sont reproduites. CN01 a
seulement reçu la collection `Cinéma` : sa LUT validée est inchangée octet pour
octet. Les contrôles CN02/CN10 sur téléphone et reflex valent 1,23–1,98/255 et
sont identiques à l'œil.

Réglages Cinéma II relevés et reproduits :

- toute la famille : Netteté 40 et réduction du bruit Luminance 20 / Couleur 50 ;
- CN14 : Grain 25 / Taille 10 / Cassure 50 ;
- CN17 : Grain 15 / Taille 40 / Cassure 50 ;
- CN18 : Grain 20 / Taille 40 / Cassure 50.

Le moteur possède maintenant une réduction du bruit luminance/chroma protégée
par les arêtes, appliquée avant la netteté. Les Tailles 10/40 sont calibrées par
soustraction directe des exports avec/sans grain sur quatre photos téléphone
jusqu'à 200 Mpx et trois reflex Canon EOS 200D de `~/Desktop/maroc`.

Résultat : force du grain à environ 2 % de Lightroom au pire sur téléphone,
grosseur à environ 3,5 % ; sur reflex, force −6,8 à +4,2 % sans biais. Les
planches finales LUT + effets valent 1,68–1,97/255 et ont été regardées à l'œil.
Références hors dépôt : `~/Desktop/VIBEFX-GRAIN-TESTS/`.

La grille Vision est maintenant organisée par collections : `Cinéma` contient
exactement CN01-CN10, `Cinéma II`
contient exactement CN11-CN18, les créations internes sont dans `VibeFX` et
les imports sans groupe dans `Imports`. Recherche, compteurs et état vide sont
en place. `presetCollections.js` porte le modèle pur ; l'importeur accepte
`--collection "Nom"` et reprend sinon le groupe du XMP.

Les nouveaux presets restent hors `docs/presets-valides.md` tant que Matthis ne
les a pas regardés et approuvés sur photos peu retouchées. Aucun déploiement.

Les vignettes de la bibliothèque ne sont plus une LUT seule :
`vision/presetPreview.js` appelle le pipeline complet du renderer, avec la
taille originale transmise au grain, puis `useVisionEditor.js` les calcule par
lots de quatre. Elles montrent donc aussi texture, clarté, voile, réduction du
bruit, netteté, vignetage et grain. L'import/moteur porte désormais le voile
négatif et les quatre sous-réglages Adobe du vignetage. Le profil radial mesuré
est réservé aux imports Lightroom ; les presets VibeFX validés gardent leur
ancien chemin bit-à-bit.

## Gates du lot

- `npm run test:vision-preset` : 408/408.
- `npm run audit:reglages-avances` : vert.
- `npm run test:vision-filters` : vert, 50 profils.
- `npm run test:reglages-avances` : vert, 1 test navigateur (1,9 min).
- `npm run lint` : bloqué par deux erreurs React hors lot dans le chantier
  VibeMask (`VisionScreen.jsx:177`, `useVisionEditor.js:415`), six warnings.
- `npm run test:vibeos-vision` : 3/3 ; le scénario exhaustif 181 × 5 demande
  désormais un timeout de 420 s et passe en 4,6 min.
- `npm run build` : compilation et TypeScript verts, échec de collecte de
  `/api/catalog/[jobId]` car `better-sqlite3` est compilé pour Node ABI 127 au
  lieu de 147.

## Mission suivante, dans l'ordre

1. Les onze collections Lightroom demandées sont complètes. Pour les prochains
   favoris, reprendre le même circuit Hald + relevé explicite des panneaux
   Effets/Détail ; les seuls favoris déjà cités mais pas encore importés sont
   VCR11 et VCR12.
2. Ne pas ajouter CN12, CN15 et CN18 à `docs/presets-valides.md` avant leur
   validation explicite par Matthis.
3. Pour un preset qui utilise une autre Taille de grain, une Cassure autre que
   50 ou d'autres valeurs de réduction du bruit, refaire une mesure dédiée : ne
   pas extrapoler cette validation à toute la course des curseurs.

## Interdits

- Aucun déploiement sans demande explicite.
- Aucun sous-agent sans demande explicite.
- Ne jamais modifier le projet source ni `node_modules`.
- Ne pas supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Ne pas annoncer toute la course des réglages avancés comme bit-identique : la
  validation actuelle porte sur les valeurs effectivement utilisées par CN11–CN18.
- Les tables/noms Adobe restent une référence de calibration tant que la
  décision de licence n'est pas tranchée.

## Rituel de fin de phase

Gates ciblés, puis `todo.md`, `plan.md`, `map.md` et un récap simple dans le
chat. Le prompt de reprise reste dans un fichier et ne se colle dans le chat
que si le porteur du projet l'a demandé au début de la session.
