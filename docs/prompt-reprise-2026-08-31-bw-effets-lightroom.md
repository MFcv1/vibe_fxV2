# Reprise — effets Lightroom des presets BW

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## Lecture au démarrage

1. `AGENTS.md`
2. Les premières sections de `plan.md` et `todo.md`
3. La fin du journal de `map.md` autour de « effets spatiaux BW »
4. Les fichiers de la zone réellement touchée

Ne pas ouvrir les archives ni les anciens prompts de reprise. Ne pas relire les
grosses LUT Base64 : les métadonnées utiles sont dans `spatialFilters` de
`src/features/vibefx-studio/utils/presets/bw01.js` à `bw12.js`.

## État livré

- Les LUT N&B et leurs virages couleur restent celles recapturées le 2026-08-31.
- BW01–BW12 portent la vignette Lightroom -25 complète : milieu 50, arrondi 0,
  contour progressif 50, hautes lumières 0, profil `vignetteLightroomV2`.
- BW01–BW09 ont grain 0 ; BW10–BW12 ont grain 75, taille 10, cassure 60.
- BW01–BW04 : clarté -10, texture -10.
- BW05–BW06 : clarté +10, texture 0.
- BW07–BW09 : clarté 0, texture +20, voile 0.
- BW10–BW12 : clarté 0, texture +30.
- BW08 n'a plus son faux voile +14 ni sa texture -15.
- `scripts/smoke-vision-preset.mjs` verrouille ces valeurs.

## Gates

- `npm run test:vision-preset` : 433/433.
- `npm run test:vibeos-vision` : 3/3.
- `npm run test:reglages-avances` : 1/1.
- `npm run lint` : 0 erreur, 5 avertissements préexistants.
- `npm run build` : compilation réussie, puis échec préexistant de collecte de
  pages car `better-sqlite3` est compilé pour ABI 127 alors que Node demande 147.
- Contrôle navigateur sur `~/Desktop/maroc/IMG_0216.JPG` : BW04 montre la
  vignette sur la grande image et les cartes, sans grain ajouté.
- Aucun déploiement.

## Suite conseillée

Faire valider visuellement BW01–BW12 par le porteur sur ses photos habituelles.
Si un écart subsiste, comparer le même fichier source et la même taille de
rendu dans Lightroom et Vision avant de modifier le moteur global.

## Interdits

- Ne jamais supprimer ni remplacer un preset déclaré valide dans
  `docs/presets-valides.md`.
- Ne pas toucher au projet source Jardin de Chawi.
- Ne pas déployer sans demande explicite.
- Préserver les changements déjà présents dans le worktree.

## Rituel de fin de lot

Exécuter uniquement les gates touchés, puis lint et build pour un vrai lot ;
mettre à jour `todo.md`, `plan.md` et `map.md`, écrire un nouveau prompt de
reprise dans `docs/`, et rapporter honnêtement les échecs préexistants.
