# Audit Lightroom — saisons — 2026-08-30

## Périmètre livré

45 presets Premium Lightroom Cloud ont été capturés par mire Hald propre puis
importés dans Vision : Printemps SP01–SP12 (12), Été SM01–SM11 (11), Automne
TM01–TM12 (12) et Hiver WN01–WN10 (10). La bibliothèque atteint 181 presets.
Aucun des 45 presets saisonniers ne porte de grain.

Les panneaux Effets et Détail ont été relevés avant de remettre les effets
spatiaux à zéro pour l'export de la mire. Les valeurs non nulles rencontrées
sont : Texture −30…+30, Clarté −30…+35, Voile +6/+24 et Vignettage +3…+9 ou
−20/−32. Netteté et réductions du bruit restent à zéro dans ces quatre familles.

## Corrections moteur issues du contrôle

- Le montant positif du vignettage Lightroom éclaire les bords. Il a maintenant
  son propre sens (`vignetteLighten`) au lieu d'être appliqué comme un
  assombrissement. Sa force a été croisée sur SP01/SP08, téléphone et reflex.
- Les imports Lightroom appliquent le détail avant la LUT finale, sans changer
  l'ordre historique des presets VibeFX déjà validés.
- La Clarté garde la valeur Lightroom affichée mais utilise un coefficient de
  rendu mesuré sur photos JPEG : 0,35 au positif, 0,18 au négatif.
- La Texture importée protège les arêtes franches. Cette variante est opt-in et
  ne modifie pas les anciens presets.
- Les bornes sûres acceptent désormais Clarté +35 (TM09) et Vignettage 32
  (TM07), sans troncature silencieuse.

## Comparaisons réelles

Le comparateur exécute le vrai renderer Chromium à pleine définition. Deux
photos ont été utilisées : une photo reflex 4000×6000 et une photo téléphone
2252×4000 au coucher de soleil. Le grain est forcé à zéro pendant la mesure —
les presets saisonniers n'en contiennent de toute façon aucun.

Écarts moyens finaux sur la photo reflex, en niveaux sur 255 : SP01 7,38 ; SP11
5,71 ; SM04 2,83 ; SM08 2,60 ; TM03 4,25 ; TM07 5,80 ; TM09 6,24 ; WN07 2,51 ;
WN06 4,50. Sur téléphone : SP01 6,88 ; SM08 2,71 ; TM03 3,30 ; TM07 4,08 ; WN06
3,96.

À taille d'affichage normale, les planches VibeFX/Lightroom présentent le même
look. Les écarts les plus élevés restent localisés dans les hautes lumières
écrêtées et dans les différences RAW-vers-JPEG : ils deviennent visibles en
comparaison côte à côte ou sur la carte d'écart amplifiée, pas en regardant un
rendu isolé. Il ne faut donc pas annoncer une identité pixel à pixel.

## Gates

- `npm run test:vision-preset` : 408/408.
- `npm run audit:reglages-avances` : vert.
- `npm run test:reglages-avances` : 1/1.
- `npm run test:vibeos-vision` : le smoke pur passe ; le test exhaustif
  181 presets × 5 photos a nécessité de relever son timeout de 240 à 420 s,
  puis passe 1/1 (les deux autres scénarios passaient déjà).
- `npm run lint` : les fichiers du lot sont propres, mais la commande globale
  échoue sur deux effets React préexistants du chantier de masque intelligent
  (`VisionScreen.jsx:177`, `useVisionEditor.js:415`) et conserve six warnings.
- `npm run build` : compilation et TypeScript verts, puis échec préexistant de
  collecte sur l'ABI `better-sqlite3` 127 au lieu de 147.
- Aucun déploiement.

Ces presets restent hors `docs/presets-valides.md` jusqu'à validation explicite
de Matthis sur les planches ou dans l'application.
