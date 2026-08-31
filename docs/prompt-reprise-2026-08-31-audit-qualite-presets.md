# Reprise — audit qualité Lightroom terminé

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

Lire dans l'ordre : `AGENTS.md`, début de `plan.md`, début de `todo.md`, zones pertinentes de `map.md`, puis `docs/lightroom/audit-qualite-presets-2026-08-31/rapport.md`. Ne pas ouvrir les archives ni les anciens prompts de reprise.

## État du lot

L'audit qualité représentatif est terminé sans patch du moteur ou des presets et sans déploiement. Il couvre les 22 familles Lightroom : 44 presets tirés avec une graine reproductible, puis 6 extensions et une réexportation corrigée, soit 50 couples définitifs. Les sources, exports Lightroom, rendus VibeFX, planches, heatmaps, journaux et métriques sont sous `docs/lightroom/audit-qualite-presets-2026-08-31/`.

Verdict : douze familles conformes, neuf à surveiller, Vintage non conforme. La dérive Vintage est colorimétrique et confirmée sur VN03, VN04 et VN05 ; VN09 est plus proche. Noir et blanc conserve la bonne identité mais présente un écart spatial/luminance répété, à isoler sur mires avant toute correction. Le faux positif CN16 a été corrigé et Cinéma II est conforme.

## Mission suivante ordonnée

1. Attendre une demande explicite avant de modifier quoi que ce soit.
2. Si la correction Vintage est demandée, recapturer VN03/VN04/VN05 depuis les XMP originaux après vérification visible du preset, du profil et de l'intensité 100 %, puis contrôler toute la famille avant remplacement.
3. Si le lot Noir et blanc est demandé, séparer LUT, vignette, texture/clarté et grain sur les mires dédiées ; vérifier l'ordre `presetSpatialBeforeLut` et le noyau spatial.
4. Respecter `docs/presets-valides.md` : aucune suppression ni substitution d'un preset validé sans planche visuelle sur photos peu retouchées.
5. En fin de lot, lancer uniquement les gates ciblés, puis mettre à jour `todo.md`, `plan.md`, `map.md` et ce prompt de reprise.

Interdits : ne pas modifier `jardin de chawi`, ne pas toucher à `.git/`, `.next/`, `node_modules/` ou `dist/`, ne pas déployer sans demande explicite, ne pas écraser les modifications existantes du worktree.
