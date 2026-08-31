# Reprise — VibeFX Vision après optimisation des miniatures

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

Lire dans cet ordre : `AGENTS.md`, les sections actives de `plan.md` et
`todo.md`, puis uniquement les zones Vision et le dernier journal de `map.md`.
Ne pas lire les archives ni les anciens prompts de reprise. Lire
`docs/presets-valides.md` seulement si la mission touche aux presets ou à leur
rendu.

## État livré

- `/creer/vision` expose 261 presets inchangés.
- Les miniatures visibles sont prioritaires via `IntersectionObserver`; la
  marge suivante est préchargée au repos et les files hors collection sont
  annulées.
- Cache de session par photo + preset + intensité conseillée + version moteur,
  Promises partagées contre les doublons Strict Mode, sortie Blob URL.
- Source miniature 192×116 réduite une fois, avec le pipeline complet
  `applyFiltersPro`. Aucun retour à une LUT seule.
- Les options stables de `useCanvasRenderer` empêchent une miniature terminée
  de relancer la grande image ; aperçu écran plafonné à 1,25 Mpx, export intact.
- Banc : `npm run test:vision-preview-performance`.

## Gates au 2026-08-31

- performance/fidélité : 3/3 ; première miniature 454 ms, 10/10 visibles 852 ms,
  scroll 284 ms, 14 rendus initiaux, 0 doublon ; petite collection = 10 rendus ;
- moteur Vision : 426/426 ;
- smoke navigateur Vision : 3/3 ;
- lint : 0 erreur, 5 avertissements préexistants ;
- build : compilation réussie puis échec ABI local préexistant de
  `better-sqlite3` (module 127 contre Node 26/module 147). Ne pas modifier
  `node_modules` pour le contourner.

## Suite active

Reprendre les priorités écrites dans `todo.md`. Si une nouvelle modification
touche aux miniatures, garder les seuils du banc visible-first, vérifier CN14
(grain), BW01 (N&B) et CN01 (couleur), puis rejouer les gates ciblés.

Interdits : ne supprimer/remplacer aucun preset validé, ne pas altérer les LUT
ou la colorimétrie, ne pas déployer sans demande explicite, ne pas modifier le
projet source ni les dossiers générés.

Fin de lot : tests ciblés, lint, build, mise à jour de `todo.md`, `plan.md` et
`map.md`, puis nouveau prompt de reprise daté.
