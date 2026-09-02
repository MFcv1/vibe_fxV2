# Reprise — import HEIC/HEIF bibliothèque — 2026-09-01

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

Lire dans cet ordre : `AGENTS.md`, `docs/developpement-local-et-couts.md`,
`plan.md`, `todo.md`, puis seulement les extraits utiles de `map.md`, `seo.md`
et `MEGAPROMPT.md`. Ne pas ouvrir les archives ni les anciens prompts de
reprise. Ne pas relire les gros fichiers en entier.

## État livré

La bibliothèque `/creer/bibliotheque` accepte HEIC/HEIF. Le nouveau module
`src/features/vibeos/library/heicImport.js` détecte ces formats et charge
dynamiquement `heic-to/csp` pour convertir localement en JPEG qualité 0,94.
`photoImport.js` stocke ce JPEG dans IndexedDB et le transmet donc aussi à
Vision/Firebase ; `convertedFrom` garde le nom, le MIME et le poids source.
Les erreurs HEIC sont distinguées des images ordinaires illisibles.

Essai réel réussi dans Chromium avec
`/Users/matthis/Downloads/IMG_6469.HEIC` : JPEG 5712×4284 affiché et stocké.

## Gates

- `npm run test:vibeos-library` : 41/41 hors navigateur + 1/1 navigateur.
- `npm run lint` : 0 erreur, 5 avertissements préexistants.
- `npm run build` sous Node 22 : vert, avertissement NFT préexistant.
- App Hosting : Cloud Build `1156c620-b9c0-4b66-85ca-22da1f73e3f4` réussi,
  révision `vibefx-v2-web-build-2026-09-01-001` à 100 % du trafic.
- Route live 200 et bundle HEIC confirmé. Le smoke headless s'arrête au gate
  d'authentification, sans écrire dans le compte réel.

## Suite éventuelle

Le lot est déjà en ligne. Ne pas relancer de rollout pour ce même changement.
Aucun changement Functions/règles n'a été requis.

Préserver les changements déjà présents dans `AGENTS.md`, `map.md` et
`docs/developpement-local-et-couts.md`. Ne jamais modifier le projet source,
les presets validés, `node_modules/`, `.next/`, `.git/` ou `dist/`.
