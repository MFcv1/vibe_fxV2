# Prompt de reprise — 2026-08-27 (la famille cine, deux axes)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

Lis dans cet ordre : `AGENTS.md`, `docs/presets-valides.md`, puis **uniquement**
les journaux `map.md` du 2026-08-27 et du 2026-08-26. N'ouvre ni les archives ni les autres prompts
de reprise.

## Où on en est

`powlisher-cine` (le tronc) est validé. Quatre variantes viennent d'être livrées
et **attendent le regard du porteur du projet** :

| id | ce qu'il est |
|---|---|
| `powlisher-cine-net` | pôle ouvert de l'axe des NIVEAUX : lève tout, épaule à 245 |
| `powlisher-chaud` | pôle chaud de l'axe des COULEURS : a\* à 0 dans les clairs, b\* +9,3 |
| `powlisher-froid` | l'autre bout : étalonnage le plus vert, bleu tourné de 16° |
| `powlisher-mer` | famille « mer » : teal le plus profond, plafond le plus haut (252) |
| `powlisher-nuit` | famille « ville de nuit » : lampadaires tenus à 187 |
| `ambre` | tiré d'un modèle de 10 photos désignées à la main : **split-tone**, b\* +1 dans les ombres → +8,2 dans les reflets |
| `ambre-nuit` | même couleur, densité basse : blanc à 181, contraste 129 |

`powlisher-cine-doux` a été **construit puis retiré** le 2026-08-27 : il saturait.
Les deux erreurs de mesure qu'il a révélées sont dans le journal `map.md` du
2026-08-27 — les relire avant de mesurer quoi que ce soit de nouveau.

Tout est mesuré : `scripts/axe-developpement.mjs` (l'axe),
`scripts/mesurer-variante.mjs` (la recette d'un sous-ensemble),
`scripts/courbes-variantes.mjs` (les courbes), `scripts/mesurer-familles.mjs`
(le portrait chiffré de chaque famille). Les mesures vivent hors dépôt dans
`~/Desktop/powlisher-biblio/`.

`npm run test:vision-preset` : **167 vérifications**, toutes passent.

Deux instruments neufs, à utiliser avant tout nouveau preset :
`scripts/voisins-du-modele.mjs` (étendre une poignée de photos-modèle à un tas
mesurable) et `scripts/juger-vers-modele.mjs` (dire en % si un rendu tend
vraiment vers le modèle visé).

## Mission suivante, dans l'ordre

1. **Faire valider les quatre à l'œil.** Planches déjà faites dans
   `~/Desktop/powlisher-biblio/` : `AMBRE-VS-MODELE.jpg`, `AMBRE-DEUX-DENSITES.jpg`,
   `DUEL-COULEUR.jpg`, `DUEL-SUJETS.jpg`, `CIEL-1-1.jpg`. Celles qui sont gardées
   entrent dans `docs/presets-valides.md`.
2. **L'étage de tonalité adaptatif.** Le vrai gros reste, détaillé dans
   `todo.md`. Ce n'est pas une modification de preset mais de moteur : une LUT
   n'a pas de mémoire, il faut un étage avant elle qui mesure l'histogramme de la
   photo et l'amène sur l'exposition de référence du preset.
3. **Archiver `todo.md`** : il fait 485 lignes, la règle dit ~200.

## Interdits

- Ne jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- N'utiliser que des opérations que Lightroom sait faire : courbe, rotations
  d'angle **fixe**, saturation par plage, étalonnage. Pas d'attracteur (ça fait
  converger deux teintes et fabrique une bande). Pas de seuil dur.
- Juger sur les photos **neutres**, jamais sur les siennes (déjà développées).
- Pas de sous-agent, pas de déploiement, pas de lecture de fichiers entiers.

## Rituel de fin de phase

`npm run lint`, les suites touchées, puis `todo.md`, `plan.md`, `map.md` (journal
daté), et un récap en langage simple dans le chat.
