# Reprise — Vision sans VibeMask

Travaille dans `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

Lis dans cet ordre : `AGENTS.md`, le début de `plan.md`, le début et les
commandes de `todo.md`, puis uniquement les zones utiles de `map.md`. Ne lis
pas les archives ni les anciens prompts de reprise.

État : l'expérimentation de détection intelligente ciel/eau a été retirée
proprement le 2026-08-31. Il ne doit plus exister de moteur DeepLab/TFJS, de
Worker, de masque, d'overlay, de preset ciel local, de champ projet `smart*` ni
de test VibeMask. Vision conserve les presets classiques, l'amélioration
automatique, les réglages, l'historique, l'aperçu et l'export.

Pour toute suite sur Vision, préserver strictement les presets validés de
`docs/presets-valides.md` et ne pas réintroduire de segmentation intelligente
sans nouvelle demande explicite. Développer et tester en local ; aucun
déploiement sans demande. À la fin d'un lot, lancer les gates ciblées puis
`npm run lint` et `npm run build` avec Node 22, et mettre à jour `todo.md`,
`plan.md` et `map.md` selon le rituel d'`AGENTS.md`.
