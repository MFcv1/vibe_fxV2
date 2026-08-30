# Prompt de reprise — 2026-08-30 (après la correction du lettrage de `powV11`)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2` — branche
`presets-mesures-sur-corpus`, dernier commit `052d1fa`.

## Ordre de lecture

1. `AGENTS.md` (règles, économie de contexte, rituel de fin de phase).
2. `todo.md` (chantier actif, tableau des presets `powV2`..`powV11`).
3. `docs/presets-valides.md` — **fait autorité** : on n'y supprime ni ne remplace
   jamais un preset ; un variant s'ajoute.
4. `map.md`, **par extraits seulement** (`grep -n`) : le journal du 2026-08-30
   raconte la correction en cours.

**Ne pas lire** : `docs/archive-*`, les autres `docs/prompt-reprise-*`.

## Où en est le lot

`powV11` est le bout de la série calée sur les trois paires avant/après
certaines de `@powl_d` (dossier `~/Desktop/paires-powlisher`, aligné en
`p1/p2/p3-avant.png` et `-apres.png`).

Dernière correction, faite **en place dans `powV11`** à la demande du porteur du
projet (« ne recréer pas de preset, reste sur le v11 ») : le lettrage des
enseignes mouchetait, parce que la teinte d'un blanc est du bruit et que le
mélangeur y accroche un gain de luminance de 1,569 d'un côté d'une frontière de
teinte et 1,000 de l'autre. Option `blancsBruites` dans `construirePowV2`,
fermée par défaut donc **inerte pour `powV2`..`powV10`**.

dE76 médian de `powV11` : p1 2,36 · p2 8,13 · p3 12,90.

## État des gates

- `npm run lint` — vert (5 avertissements préexistants).
- `npm run test:vision-preset` — 330/330.
- `npm run build` — non rejoué sur ce lot (aucun changement de rendu React).

## Mission suivante, dans l'ordre

1. **Faire regarder `powV11` à l'œil sur des photos peu retouchées** (Unsplash),
   avec `node scripts/planche-presets.mjs <photo...>`. Les mesures sur ses
   paires sont saturées : son rendu de nuit porte un masque peint à la main,
   prouvé, qu'aucune fonction ne reproduit.
2. Si `powV11` tient à l'œil, l'inscrire dans `docs/presets-valides.md`.
3. Réserve connue : `powV11` verdit l'ocre, mais seulement dans les niveaux
   sombres.

## Interdits

- Aucun déploiement sans demande explicite (argent réel).
- Aucun sous-agent sans demande explicite.
- Ne pas supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Ne jamais inventer une valeur attendue de test : elle se relève.
  (`docs/pieges-connus.md`.)

## Rituel de fin de phase

Gates ciblés, puis `todo.md`, `plan.md`, `map.md` (journal daté), puis un récap
en langage simple dans le chat. Le prompt de reprise s'écrit dans un fichier ;
il ne se colle dans le chat que si le porteur du projet l'a demandé au début de
la session.
