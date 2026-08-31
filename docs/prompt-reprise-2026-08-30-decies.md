# Prompt de reprise — 2026-08-30 (Studio Gradient + Lumen)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2` — branche
`presets-mesures-sur-corpus`, changements non commités et partagés avec les
lots Lightroom/Gradient du 2026-08-30.

## Ordre de lecture

1. `AGENTS.md`.
2. `todo.md` — seulement l'état actif et le lot « decies ».
3. `map.md`, uniquement le journal « 2026-08-30 decies » et l'arbre
   `src/features/vibeos/studio/`.
4. Si la mission touche aux presets : `docs/presets-valides.md`, puis les
   audits Lightroom explicitement concernés.

Ne pas lire `docs/archive-*`, les autres `docs/prompt-reprise-*` ni le reste de
`map.md` sans besoin précis.

## État livré

`/creer/studio` est un hub Apple-dark à deux cartes. Gradient et Lumen ouvrent
leur app autonome bord à bord sous le bandeau VibeOS ; Mesh et les anciennes
ambiances n'y sont plus. Le bandeau reste visible, les côtés et le bas n'ont
aucune marge, et le mode mobile couvre la tab bar. Les boutons internes des
deux apps renvoient le rendu par `postMessage`; `useStudioGenerators.js` le
convertit en Blob et l'écrit dans le fond du projet. Les anciens fichiers
d'ambiances restent dans l'arbre pour ne pas détruire de logique ou de données.

## Gates

- ESLint ciblé et `npm run lint` : verts, 5 avertissements préexistants.
- `npm run test:vibeos-studio` : 2/2 vert.
- `npm run test:vibeos-pipeline` : 2/2 vert.
- `npm run test:reglages-avances` : 1/1 vert, 17 curseurs Vision vivants.
- `npm run build` compile et passe TypeScript, puis retrouve le blocage local
  préexistant : `better-sqlite3` ABI 127 contre Node ABI 147 pendant la collecte
  de `/api/catalog`. Ce n'est pas une erreur du lot Studio.

## Mission suivante

1. Continuer le chantier actif indiqué dans `todo.md` ; ne pas ajouter
   d'ambiances photo dans Studio, elles appartiennent à Vision.

## Interdits

- Ne supprimer ni remplacer aucun preset de `docs/presets-valides.md`.
- Ne pas retirer Mesh de Layout.
- Ne pas persister de dataURL ; les fonds restent des Blobs IndexedDB.
- Aucun déploiement sans demande explicite.
- En fin de lot : mettre à jour `todo.md`, `plan.md`, `map.md`, ce prompt, puis
  rapporter les gates et limites honnêtement.
