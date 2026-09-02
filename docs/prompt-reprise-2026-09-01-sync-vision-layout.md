# Reprise — synchronisation Vision → Layout — 2026-09-01

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

Lire dans cet ordre : `AGENTS.md`, `docs/developpement-local-et-couts.md`, puis
les premières sections de `plan.md` et `todo.md`. Dans `map.md`, lire seulement
le journal « synchronisation Vision → Layout ». Ne pas ouvrir les autres
archives ni prompts de reprise.

Le lot local synchronise les réglages Vision dans le provider, rend les photos
traitées dans Layout tout en conservant les Blobs bruts, marque la composition
avec `visionRevision`, et évite la double application dans Studio/export. Le
smoke `scripts/smoke-vibeos-pipeline.spec.cjs` couvre ce contrat en desktop et
mobile.

État des gates : lint global vert avec 5 avertissements préexistants ; build
Node 22 vert avec l'avertissement NFT préexistant. Le smoke navigateur est
bloqué avant Layout : le bouton Dev de `StudioAuthGate` est cliqué, mais ne
ferme pas la modale. Cet échec préexistant est déjà documenté dans `todo.md`.

Mission suivante : réparer ou contourner proprement le gate Dev du smoke, puis
rejouer `npm run test:vibeos-pipeline` et contrôler manuellement le trajet
Vision → Layout → Studio. Ne pas déployer sans demande explicite. Préserver les
changements HEIC et les autres modifications non commitées présentes dans le
worktree.
