# Reprise — preview Instagram Layout

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## Lecture obligatoire

Lire dans cet ordre : `AGENTS.md`, `docs/developpement-local-et-couts.md`, les
premières sections de `plan.md` et `todo.md`, puis uniquement les extraits de
`map.md` concernant `src/features/vibeos/layout/` et les smokes Layout. Ne pas
ouvrir les autres archives ou prompts de reprise.

## État livré localement

- `PublicationPhoneShell.jsx` et `InstagramPublicationPreview.jsx` portent le
  téléphone de `/Users/matthis/Desktop/mes projets mac/secondevienextjsSSR` avec
  ses mesures exactes. Les classes Tailwind ont été traduites en CSS Modules,
  car la route VibeOS ne charge pas Tailwind.
- La preview appelle `renderExportCanvas()` puis `buildSocialImages()` : elle
  montre les mêmes pixels pleine définition que Publication.
- Portrait 1080×1350, carré 1080×1080, story 1080×1920 et paysage 1080×566 sont
  des JPEG. Pano x2/x3 donnent 2/3 tranches JPEG 1080×1350 continues.
- Le carrousel fonctionne au clic, au swipe horizontal et au trackpad.
- La normalisation Publication connaît maintenant `insta-land` comme paysage
  1,91:1 ; le validateur Story refuse toute dimension autre que 1080×1920.
- Aucun déploiement n'a été fait ni autorisé.

## Gates au 2026-09-01

- `npm run test:publication-flow` : vert.
- Smoke ciblé `smoke-vibeos-layout-instagram-preview.spec.cjs` : vert, 1/1 en
  exécution seule, les six formats sont contrôlés.
- `npm run lint` : zéro erreur, cinq avertissements préexistants.
- `npm run build` : vert sous Node 22.23.2, version imposée par `package.json`.
  Un essai sous Node 26 rejetait normalement le binaire Node 22 de
  `better-sqlite3` ; aucun changement de `node_modules` n'a été nécessaire.
- `npm run test:vibeos-layout` : les trois fichiers lancés en parallèle restent
  bloqués sur le contournement Dev Auth préexistant. Le nouveau fichier passe
  lorsqu'il est lancé seul.

## Suite utile

Faire valider visuellement la preview en local avec une vraie composition, puis
traiter séparément la fiabilité du bypass Auth des smokes parallèles si
l'utilisateur demande ce nettoyage. Conserver le
téléphone Second Vie sans réinterprétation graphique et ne pas déployer sans
demande explicite.
