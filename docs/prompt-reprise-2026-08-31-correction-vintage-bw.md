# Reprise — après correction Vintage et Noir et blanc (31 août 2026)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

Lire dans cet ordre : `AGENTS.md`, `plan.md`, `todo.md`, puis uniquement les extraits utiles de `map.md`. Pour les presets, lire `docs/presets-valides.md`, `docs/pieges-connus.md` et `docs/lightroom/audit-qualite-presets-2026-08-31/rapport.md`. Ne pas ouvrir les autres archives ni prompts de reprise.

État : les 235 imports Lightroom des 22 familles ont été audités. Les dix Vintage ont été recapturés depuis une mire explicitement réinitialisée avant chaque preset, puis réimportés avec les XMP Adobe. Les douze Noir et blanc ne portent plus le faux vignettage 25, absent des XMP. Les preuves après correction sont dans `docs/lightroom/audit-qualite-presets-2026-08-31/corrections-vintage-bw/`.

Gates : `npm run test:vision-preset` passe 436/436 ; `npm run lint` passe avec cinq avertissements préexistants ; le build passe sous Node 22 avec l'avertissement NFT préexistant. `test:vibeos-vision` et `test:reglages-avances` restent bloqués avant l'écran Vision : le bouton Dev ne ferme plus la modale d'authentification. Ne pas attribuer cet échec aux presets sans nouvelle preuve.

Mission suivante : reprendre le chantier actif décrit dans `todo.md`. Si un lot navigateur Vision est ouvert, diagnostiquer séparément le contournement d'authentification Dev avant de relancer les smokes. Ne modifier aucun preset validé sans planche visuelle sur photo peu retouchée. Aucun déploiement sans demande explicite.

À la fin d'un lot : gates ciblés, puis lint/build si vraie clôture ; mettre à jour `todo.md`, `plan.md`, `map.md` et écrire le nouveau prompt de reprise sans le coller dans le chat sauf demande explicite.
