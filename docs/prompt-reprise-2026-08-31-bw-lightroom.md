# Reprise — VibeFX / imports Lightroom après correction BW

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

Lire dans cet ordre : `AGENTS.md`, les premières sections de `plan.md`, les
sections actives de `todo.md`, puis seulement les zones utiles de `map.md` et
`docs/lightroom/1-procedure.md`. Ne pas ouvrir les autres archives ou prompts de
reprise sans besoin précis.

État : Vision expose 261 presets organisés en collections. La famille
`Noir et blanc` BW01–BW12 a été corrigée le 2026-08-31. Les premières Hald
avaient été exportées sans clic effectif sur le preset Lightroom et restaient
RVB ; les douze conversions ont été recapturées dans Lightroom Cloud puis les
modules `src/features/vibefx-studio/utils/presets/bw01.js` à `bw12.js` ont été
regénérés. Ne pas ajouter une simple désaturation : le mélange N&B et les
virages colorés doivent rester dans la LUT capturée.

Contrôle livré : BW01 gris, BW02 sépia, BW03 rosé, BW04 vert, BW05–BW10
monochromes, BW11 brun chaud, BW12 bleu. `npm run test:vision-preset` passe
426/426 avec un garde-fou contre la chroma résiduelle et des signatures de
virage. `npm run lint` passe sans erreur (5 avertissements préexistants).
`npm run build` compile, puis échoue sur le binaire local `better-sqlite3`
compilé pour NODE_MODULE_VERSION 127 alors que le Node courant demande 147 ; ne
pas modifier `node_modules` pour contourner cela.

Mission suivante : poursuivre les imports Lightroom demandés par l'utilisateur
avec la même méthode, en contrôlant chaque famille sur une photo réelle et en
séparant grain/texture/vignetage de la Hald. Pour tout preset N&B, vérifier avant
export que la mire Lightroom est visiblement monochrome ou teintée.

Interdits : ne jamais supprimer ou remplacer un preset de
`docs/presets-valides.md`, ne pas déployer sans demande explicite, ne pas toucher
au projet source ni à `node_modules`, `.next`, `.git` ou `dist`.

Fin de lot : tests ciblés, lint/build si lot réel, mise à jour de `todo.md`,
`plan.md`, `map.md`, puis nouveau prompt de reprise dans `docs/`.
