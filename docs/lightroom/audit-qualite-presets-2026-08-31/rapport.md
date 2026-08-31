# Audit qualité des presets Lightroom — 31 août 2026

## Conclusion

Après correction du 31 août, les 22 familles conservent l’identité attendue sur l’échantillon testé. Quatorze sont classées **Conformes** et huit **À surveiller** pour des écarts faibles ou ciblés, visibles surtout côte à côte. **Vintage** et **Noir et blanc**, qui concentraient les deux anomalies de l’audit initial, sont désormais conformes sur leurs quatre variantes de contrôle respectives.

La correction a réimporté `VN01` à `VN10` depuis des mires Lightroom explicitement réinitialisées et a retiré de `BW01` à `BW12` un vignettage absent des XMP Adobe. Aucun déploiement n’a été effectué.

### Vérification après correction

- **Vintage** : `vn03`, `vn04`, `vn05` et `vn09` retombent à 5,30–7,24/255 en mesure brute, grain Lightroom compris, et à 2,04–4,32/255 après moyenne par blocs isolant la couleur. Les quatre planches montrent le même look que Lightroom, sans l’ancienne dérive jaune/cyan.
- **Noir et blanc** : `bw01`, `bw04` et `bw05` sont à 2,64–3,32/255. `bw10`, dont le grain 75 est aléatoire, est à 3,87/255 après moyenne par blocs. La densité, la monochromie et le centre/coins sont alignés.
- Les preuves après correction sont conservées dans `corrections-vintage-bw/`. Le comparateur accepte désormais `AUDIT_OUTPUT_VARIANT` pour produire un lot séparé sans écraser l’audit initial.

## Périmètre et inventaire

- Registre audité : 235 presets importés de Lightroom, répartis dans 22 familles.
- Hors périmètre : 26 presets VibeFX internes, explicitement séparés des imports Lightroom.
- Échantillon initial : 44 presets, soit deux par famille.
- Extension après vérification : 6 presets supplémentaires dans trois familles suspectes. `CN16` a aussi été réexporté après correction d’une mauvaise sélection Lightroom, soit 50 couples Lightroom/VibeFX définitifs.
- Intensité : 100 % dans Lightroom et dans le comparateur VibeFX.
- Export Lightroom : PNG, taille complète, sRGB, sans accentuation de sortie, HDR ni filigrane.
- Avant chaque rendu : réinitialisation des modifications, application explicite du preset, même source, même orientation, même cadrage et mêmes dimensions.

## Échantillonnage reproductible

- Graine : `vibefx-lightroom-quality-audit-2026-08-31`.
- Méthode : `SHA-256(seed + "\\0" + collectionId + "\\0" + presetId)`, tri croissant des empreintes, puis sélection des deux premiers presets de chaque famille.
- L’échantillon initial a été gelé avant la première comparaison et n’a pas été modifié après lecture des résultats.
- Les tirages, empreintes et effectifs sont enregistrés dans [echantillon.json](./echantillon.json). Le générateur reproductible est [echantillonnage.mjs](./echantillonnage.mjs).

## Images sources

| Fichier | Origine et usage | Dimensions | SHA-256 |
|---|---|---:|---|
| `telephone-architecture-37134.jpg` | Téléchargements, téléphone ; architecture et Futuriste | 4080 × 2296 | `312c2a9fb1b4f130555610757e6199e255ec2b3171907181e7141f880c476d14` |
| `telephone-chat-37131.jpg` | Téléchargements, téléphone ; pelage, détail, film et noir et blanc | 8160 × 4592 | `13834cb6662fd13888a53599193815c90bed10eb08e8d9caa1141dd9b743c8f2` |
| `reflex-paysage-IMG_0349.JPG` | `/Users/matthis/Desktop/maroc`, reflex ; paysage, saisons, cinéma et voyage | 6000 × 4000 | `89e06e72b17ccb3ecd89906a348e1f6452f7e6c70242f94134df27ce493d32b9` |
| `unsplash-portrait-groupe-q1jHh0MWTFk.jpg` | Portrait de groupe réel ; familles Portrait et Style de vie | 3000 × 1688 | `d7e2ed30bafde8605507f2187e7806547ae67809ea3be8e5a0c72f382c5eab79` |
| `unsplash-auto-tqR4EzIwtLM.jpg` | Automobile ancienne ; Auto rétro et Vintage | 2848 × 4288 | `fef3a78b4d17116a46d1bbf74dfd5da4ca0977b166f03dec37232a05b37f4364` |

Les fichiers utilisateur n’ont pas été modifiés : des copies ont été placées dans `sources/`. Le même fichier source a été utilisé des deux côtés de chaque comparaison.

## Méthode de contrôle

Chaque planche montre l’original, le rendu Lightroom, le rendu VibeFX et une carte de différence amplifiée ×8. Les contrôles visuels ont porté sur la vue entière puis sur les détails : luminosité, contraste, noirs/blancs, ombres/hautes lumières, balance et saturation, ciel, végétation, carnations, monochromie, virages colorés, vignettage, grain, texture, clarté, netteté, bruit, halos, banding, écrêtage et artefacts de LUT.

Les panneaux Lightroom **Profil, Lumière, Couleur, Effets et Détail** ont été contrôlés selon les réglages portés par chaque preset. **Optique, Géométrie et Masquage** ont été vérifiés comme non actifs dans l’échantillon. Les traitements spatiaux ont été comparés séparément aux `spatialFilters` ; ils ne sont pas considérés comme capturés par la Hald CLUT. Pour Auto rétro, le ton automatique recalculé a été distingué des réglages fixes.

Mesures enregistrées : écart RVB moyen et P95, écart de luminance moyen et P95, ΔE76 moyen et P95, SSIM global de luminance, différence centre/coins, écrêtage et heatmap. Le SSIM global est indicatif et ne remplace pas l’inspection locale. Les métriques détaillées se trouvent dans [metriques-detaillees.json](./metriques-detaillees.json).

## Résultats par famille

Dans la colonne « Mesures », `m` est l’écart RVB moyen sur 255 et `ΔE` la moyenne CIE76. Les plages couvrent les deux presets initiaux et, quand indiqué, les extensions. `P/L/C/E/D` signifie Profil, Lumière, Couleur, Effets et Détail ; `O/G/M Ø` signifie qu’aucun réglage actif n’a été trouvé dans Optique, Géométrie ou Masquage.

| Famille | Presets et image | Verdict | Différences visuelles et mesures | Panneaux contrôlés | Confiance |
|---|---|---|---|---|---|
| Architecture urbaine | `ua02`, `ua01` — téléphone architecture | **À surveiller** | Même identité. `ua01` présente un léger écart côte à côte. m 1,86–6,07 ; ΔE 1,55–3,06 ; SSIM 0,9989–0,9994. | P/L/C/E/D ; O/G/M Ø | Moyenne |
| Auto rétro | `ar07`, `ar04` — auto | **À surveiller** | Rendu cohérent ; `ar04` diffère légèrement en luminosité et dans les verts. m 4,23–9,90 ; ΔE 3,00–4,78 ; SSIM 0,9851–0,9970. Ton auto et réglages fixes distingués. | P/L/C/E/D + auto tone ; O/G/M Ø | Moyenne |
| Automne | `tm10`, `tm05` — reflex paysage | **À surveiller** | Même look ; petit écart sur `tm10`. m 3,28–5,55 ; ΔE 2,18–3,28 ; SSIM 0,9966–0,9983. | P/L/C/E/D ; spatialFilters ; O/G/M Ø | Moyenne |
| Cinéma | `cn10`, `cn09` — reflex paysage | **Conforme** | Aucun écart significatif à l’œil. m 1,38–1,59 ; ΔE 1,08–1,18 ; SSIM 0,9986. | P/L/C/E/D ; O/G/M Ø | Haute |
| Cinéma II | `cn16`, `cn15` — reflex paysage ; extension `cn14`, `cn18` | **Conforme** | Le premier export `cn16` était un faux positif de sélection. Après réexport : m 1,76. Les quatre contrôles restent cohérents ; `cn14` n’a qu’un écart de grain visible côte à côte. m 1,76–5,87 ; ΔE 1,34–2,45 ; SSIM 0,9725–0,9987. | P/L/C/E/D, netteté/réduction du bruit/grain ; O/G/M Ø | Haute |
| Été | `sm05`, `sm06` — reflex paysage | **Conforme** | Aucun écart significatif à l’œil. m 1,92–2,08 ; ΔE 1,85–2,03 ; SSIM 0,9997. | P/L/C/E/D ; O/G/M Ø | Haute |
| Futuriste | `ft11`, `ft05` — téléphone architecture | **À surveiller** | Même look, faible dérive colorimétrique visible uniquement côte à côte. m 5,79–6,74 ; ΔE 5,02–5,64 ; SSIM 0,9962–0,9974. | P/L/C/E/D, voile/bruit ; O/G/M Ø | Moyenne |
| Hiver | `wn02`, `wn01` — reflex paysage | **À surveiller** | `wn01` est très proche ; `wn02` est un peu plus clair/froid dans VibeFX. m 2,09–9,27 ; ΔE 1,00–4,87 ; SSIM 0,9956–0,9990. | P/L/C/E/D, texture/clarté ; O/G/M Ø | Moyenne |
| Inspiré d’un film | `film-or-riche`, `film-braise-puissante` — téléphone chat | **À surveiller** | Même intention, différence de densité et de chaleur visible côte à côte. m 5,55–8,32 ; ΔE 4,59–5,56 ; SSIM 0,9904–0,9962. | P/L/C/E/D, grain/vignette selon preset ; O/G/M Ø | Moyenne |
| Noir et blanc | `bw01`, `bw10` — téléphone chat ; extension `bw04`, `bw05` | **Conforme après correction** | Les XMP Adobe ne portent aucun vignettage : le faux vignettage commun a été retiré. `bw01`, `bw04`, `bw05` : m 2,64–3,32. `bw10` : couleur seule 3,87 après neutralisation statistique du grain 75. Monochromie, virages, texture et densité cohérents à l’œil. | Profil Monochrome, L/C/E/D, grain/texture ; O/G/M Ø | Haute |
| Paysage | `ln01`, `ln06` — reflex paysage | **Conforme** | Écarts invisibles en pratique. m 3,37–3,79 ; ΔE 2,00–2,02 ; SSIM 0,9961–0,9971. | P/L/C/E/D, grain/clarté/voile selon preset ; O/G/M Ø | Haute |
| Portrait audacieux | `pe05`, `pe10` — portrait groupe | **Conforme** | Carnations et contraste cohérents. m 1,62–1,95 ; ΔE 1,93–2,30 ; SSIM 0,9998–0,9999. | P/L/C/E/D ; O/G/M Ø | Haute |
| Portrait groupe | `pg08`, `pg01` — portrait groupe | **Conforme** | Carnations multiples et rendu global cohérents. m 1,28–2,70 ; ΔE 1,50–2,22 ; SSIM 0,9990–0,9997. | P/L/C/E/D ; O/G/M Ø | Haute |
| Portrait noir et blanc | `pb12`, `pb10` — portrait groupe | **Conforme** | Conversion monochrome et matière cohérentes. m 1,94–2,20 ; ΔE 1,04–1,12 ; SSIM 0,9986–0,9987. | Profil Monochrome, L/C/E/D ; O/G/M Ø | Haute |
| Portrait peau claire | `pl11`, `pl01` — portrait groupe | **Conforme** | Aucun écart significatif sur les carnations testées. m 1,09–1,41 ; ΔE 0,94–1,46 ; SSIM 0,9997–0,9998. | P/L/C/E/D ; O/G/M Ø | Haute |
| Portrait peau foncée | `pd04-orange`, `pd01-rouge` — portrait groupe | **À surveiller** | `pd01-rouge` est très proche ; `pd04-orange` montre un petit écart de tonalité. m 2,02–5,11 ; ΔE 2,46–3,45 ; SSIM 0,9959–0,9999. | P/L/C/E/D, texture ; O/G/M Ø | Moyenne |
| Portrait peau intermédiaire | `pm10`, `pm01` — portrait groupe | **À surveiller** | Même rendu général ; `pm01` diffère légèrement côte à côte. m 3,16–6,92 ; ΔE 1,26–4,23 ; SSIM 0,9900–0,9970. | P/L/C/E/D, grain/vignette selon preset ; O/G/M Ø | Moyenne |
| Printemps | `sp05`, `sp11` — reflex paysage | **Conforme** | Couleurs et lumière cohérentes. m 2,39–3,73 ; ΔE 2,11–2,31 ; SSIM 0,9917–0,9983. | P/L/C/E/D, clarté/voile/vignette selon preset ; O/G/M Ø | Haute |
| Style de vie | `lf01`, `lf04` — portrait groupe | **Conforme** | Aucun écart significatif à l’œil. m 2,29–3,24 ; ΔE 1,53–2,69 ; SSIM 0,9979–0,9988. | P/L/C/E/D ; O/G/M Ø | Haute |
| Vintage | `vn04`, `vn03` — auto ; extension `vn05`, `vn09` | **Conforme après correction** | Les dix variantes ont été recapturées depuis une mire réinitialisée avant chaque preset. Sur les quatre contrôles : m brut 5,30–7,24, couleur seule 2,04–4,32. Même palette, même densité et même contraste que Lightroom ; le reliquat visible à 1:1 est principalement le grain stochastique. | P/L/C/E/D selon XMP ; O/G/M Ø | Haute |
| Voyage | `tr08`, `tr03` — reflex paysage | **Conforme** | Rendus pratiquement identiques. m 0,94 ; ΔE 0,88–1,00 ; SSIM 0,9997–0,9998. | P/L/C/E/D ; O/G/M Ø | Haute |
| Voyage II | `tr13`, `tr18` — reflex paysage | **Conforme** | Aucun écart significatif à l’œil. m 0,81–3,45 ; ΔE 0,84–1,72 ; SSIM 0,9990–0,9992. | P/L/C/E/D, clarté selon preset ; O/G/M Ø | Haute |

## Anomalies confirmées

### P1 résolue — Vintage : capture colorimétrique contaminée

- Cause confirmée : la photo Hald avait conservé la conversion noir et blanc d’un preset précédemment appliqué. Changer de famille dans Lightroom ne réinitialise pas nécessairement les réglages que le nouveau preset ne remplace pas.
- Correction : réinitialisation explicite de la mire avant chacune des dix applications, export PNG sRGB à 100 %, puis réimport des LUT avec les XMP Premium Adobe.
- Résultat : `vn03`, `vn04`, `vn05`, `vn09` passent de 8,36–27,46/255 à 5,30–7,24/255 brut et 2,04–4,32/255 sur la couleur seule.

### P2 résolue — Noir et blanc : faux vignettage importé

- Cause confirmée : les douze modules portaient un vignettage 25 relevé dans une interface Lightroom dont l’état était contaminé. Aucun des XMP `BW01` à `BW12` ne contient `PostCropVignetteAmount`.
- Correction : retrait du vignettage et de sa géométrie dans les douze presets ; conservation des valeurs XMP réelles de clarté, texture et grain.
- Résultat : `bw01`, `bw04`, `bw05` passent à 2,64–3,32/255 ; `bw10` est à 3,87/255 sur la couleur seule malgré son grain 75.

## Familles dont l’échantillon a été élargi

- **Cinéma II** : `cn14` et `cn18` ajoutés après le faux positif initial de `cn16`. La configuration a été corrigée, `cn16` a été réexporté, et la famille est conforme.
- **Noir et blanc** : `bw04` et `bw05` ont permis d’isoler le faux vignettage commun, maintenant retiré des douze variantes.
- **Vintage** : `vn05` et `vn09` ont confirmé que la capture initiale était contaminée ; les dix variantes ont ensuite été recapturées proprement.

## Corrections recommandées

1. **P1 et P2 sont closes** par le lot `corrections-vintage-bw/`.
2. **Revoir seulement si un lot de fidélité est ouvert** les écarts faibles de `ar04`, `tm10`, `ft05/ft11`, `wn02`, `film-or-riche`, `pd04-orange` et `pm01`. Ils ne justifient pas seuls une modification immédiate.

Aucune correction ne doit remplacer un preset validé sans nouvelle comparaison visuelle conforme aux règles de `docs/presets-valides.md`.

## Limites

- Deux images par famille ne couvrent pas toutes les distributions de lumière et de couleur. L’extension réduit ce risque seulement pour les familles suspectes.
- Le portrait Unsplash et l’automobile sont des JPEG déjà développés, même s’ils ne sont pas fortement étalonnés ; les deux sources locales téléphone/reflex apportent un contrepoint moins édité.
- Une Hald CLUT ne reproduit pas les traitements dépendant de la position ou du voisinage. Leur analyse repose sur les relevés Lightroom, les `spatialFilters`, les planches et les mesures locales.
- Le grain est stochastique : l’écart pixel à pixel surestime nécessairement la différence entre deux réalisations aléatoires. Il doit être jugé à 100 % et sur mire.
- Le SSIM calculé est global sur la luminance ; il peut masquer une dérive locale ou colorée. Le ΔE, les percentiles, la heatmap et le contrôle visuel ont priorité.
- Les verdicts « Conforme » valent pour l’échantillon testé, pas comme preuve mathématique que chaque preset de la famille est identique dans toute situation.

## Preuves enregistrées

- 50 exports Lightroom : `lightroom/<preset>/`.
- 50 rendus VibeFX : `vibefx/<preset>/rendu.png`.
- 50 planches et 50 journaux détaillés : `comparaisons/<preset>/`.
- Résultats initiaux : [resultats-comparaisons.json](./resultats-comparaisons.json).
- Vérifications étendues et réexport corrigé : [resultats-comparaisons-extension.json](./resultats-comparaisons-extension.json).
- Vérifications après correction Vintage/BW : [corrections-vintage-bw/resultats-comparaisons-extension.json](./corrections-vintage-bw/resultats-comparaisons-extension.json), avec rendus et planches dans le même dossier.
- Mesures complètes : [metriques-detaillees.json](./metriques-detaillees.json).
- Scripts de reproduction : [executer-comparaisons.mjs](./executer-comparaisons.mjs) et [analyser-metriques.mjs](./analyser-metriques.mjs).
