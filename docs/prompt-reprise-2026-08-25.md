# Prompt de reprise — 2026-08-25

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## À lire, dans cet ordre

1. `AGENTS.md`
2. `docs/presets-valides.md` — **la liste fait autorité, un preset ne s'y
   supprime ni ne s'y remplace jamais.**
3. Le journal `map.md` du **2026-08-24** (la bibliothèque) et du **2026-08-25**
   (le preset). Rien d'autre dans `map.md`.

**Ne pas lire** : les archives, les autres prompts de reprise, le reste de
`map.md`.

## Où en est le chantier

Reconstruire le rendu de `@powl_d` (Powlisher) par la mesure, sur un corpus
large au lieu des 36 photos d'origine.

**Fait.**

- **Bibliothèque** : `~/Desktop/powlisher-biblio/` (hors dépôt — ce ne sont pas
  nos photos). 807 posts lus, 1 587 photos téléchargées, **324 retenues** et
  rangées à l'œil en 12 familles dans `par-sujet/` : auto 67, interieur 48,
  architecture 37, mer 37, ville-nuit 30, rue 27, paysage 18, moto 17, aerien 13,
  avion 12, soiree 8, portrait 7. Tout est de mai à août 2026, donc son
  traitement actuel, sans mélange d'époques.
- **Tas neutre** : `~/Desktop/powlisher-biblio/neutre/`, 374 photos de Wikimedia
  Commons, **une requête par famille**. Il sert à donner la *direction* du
  traitement — sans lui, on ne voit que le point d'arrivée.
- **`powlisher-cine`** : livré, validé à l'œil, dans `docs/presets-valides.md`.
  Premier preset du projet dont aucun nombre n'a été choisi à la main.
- **Outils** (tous dans `scripts/`) : `moissonner-powlisher.mjs`,
  `trier-biblio.mjs`, `categoriser.mjs`, `profil-corpus.mjs`,
  `densite-corpus.mjs`, `transport-corpus.mjs`, `mesurer-etalonnage.mjs`,
  `variantes.mjs`, `sous-groupes.mjs`, `grouper-corpus.mjs`, `planche-duel.mjs`.

**Gates au vert** : `npm run lint` (0 erreur, 5 warnings préexistants),
`npm run test:vision-preset` (105 vérifications).

## Ce qui reste à faire

L'objectif du porteur du projet, dit avec ses mots : *« tester avec toute notre
biblio d'image et créer un max de presets intéressants, avec du caractère, du
style, uniques »*, chacun jugé à l'œil avant d'être déclaré stable.

1. **Les variantes du tronc.** La mesure dit qu'il n'y a **pas** de
   sous-traitements distincts : le corpus est un nuage continu. Mais trois
   familles (`auto`, `interieur`, `mer`) se découpent selon **le même axe** —
   `refletB`, `pointBlanc`, `contraste`, c'est-à-dire *jusqu'où il retient ses
   hautes lumières et laisse ses reflets jaunir*. Fabriquer **2 à 3 positions**
   sur cet axe : `-doux`, le tronc, `-net`. Ce sont des points d'un dégradé, pas
   des espèces séparées — donc cohérents entre eux par construction.
2. **Deux déclinaisons par sujet, mesurées** : `ville-nuit` (point blanc 183
   contre 242 pour `mer`) et `mer` (chroma la plus haute). `architecture` n'en a
   **pas** : son découpage sépare le jour de la nuit, pas deux réglages.
3. **Les défauts connus de `powlisher-cine`**, à traiter dans les variantes
   plutôt qu'en le modifiant : moins bon sur les très forts contrastes ; la
   couleur d'un sujet jaune tourne un peu (vu sur une Lamborghini).
4. **L'étage de tonalité adaptatif**, jamais construit. C'est la plus grosse
   part de l'écart restant : chez lui la luminance médiane va de **23**
   (ville-nuit) à **124** (mer). Un preset à courbe fixe ne peut pas suivre ça.

## Comment travailler

- **Juger à l'œil avant de livrer**, sur les photos du tas neutre — jamais sur
  les siennes, qui sont déjà développées : repasser un preset dessus étale deux
  fois le même traitement.
  `node scripts/planche-duel.mjs --presets a,b,c --familles mer,auto --par-famille 1`
- **Tout seuil dur devient une bande** après interpolation de la LUT. Les trois
  erreurs de ce lot viennent toutes de là ; le journal du 2026-08-25 les détaille.
- **N'utiliser que des opérations que Lightroom sait faire** — courbe, rotations
  TSL d'angle fixe, saturation par plage, étalonnage. Un attracteur qui *tire
  vers* une cible fait converger deux teintes et fabrique une bande. Ses photos
  ont été faites dans Lightroom.
- **Ne jamais supprimer ni remplacer** un preset de `docs/presets-valides.md`.
  Un variant s'ajoute à côté.
- **Aucun déploiement** sans demande explicite.
