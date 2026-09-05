# Prompt de reprise — 2026-09-03 (aperçu Instagram plein cadre + musique)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2` (macOS, branche `master`).

## Ordre de lecture

1. `AGENTS.md` — **attention, une partie est périmée** (voir « Pièges » plus bas).
2. `docs/developpement-local-et-couts.md` — boucle locale, aucun déploiement sans demande explicite.
3. `todo.md` — chantier actif seulement.
4. `map.md` — **par extraits uniquement** (`grep -n`, `sed -n`), 5400+ lignes.

Ne pas ouvrir : `docs/archive-*`, les autres `docs/prompt-reprise-*`.

## Pièges qui font perdre du temps

- **`AGENTS.md` dit « direction principale cyber-neon » et présente
  `src/features/vibefx-layout/` comme le moteur de la page mise en page. Les
  deux sont faux.** L'app vivante est `src/features/vibeos/` et son design est
  Apple OS épuré (tokens dans `src/features/vibeos/styles/vibeos.css`).
  `src/features/vibefx-layout/` et `src/features/vibefx-studio/*/` (hors
  `soundtrack/`) sont du code de référence importé. Ce ménage de docs reste à
  faire.
- Le build peut échouer sur `better-sqlite3` compilé pour une autre version de
  Node (`ERR_DLOPEN_FAILED` sur `/api/catalog`). C'est l'environnement, pas le
  code : `npm rebuild better-sqlite3`.
- Le smoke navigateur reste bloqué avant Layout par le contournement
  d'authentification Dev qui ne ferme pas la modale — échec préexistant, documenté.

## État livré

L'aperçu Instagram de Layout (`InstaPreviewSheet.jsx`) est passé du panneau
latéral au **mode `immersive` de `Sheet`** : bandeau VibeOS conservé, tout le
dessous donné à l'aperçu, pas d'en-tête de sheet. Trois colonnes :

- `PostImagesRail.jsx` — une vignette par image du post, clic = saut du carrousel.
- l'iPhone au centre, avec une **ligne de légende** (format · pixels · compatibilité)
  à la place de l'ancienne carte `Portrait (4:5)`.
- `PreviewSoundPanel.jsx` — recherche + thèmes + résultats, branchés sur
  `useVibeOsSoundtrack` et le lecteur global `VibeOsAudioProvider`. Aucun second
  lecteur : une piste lancée ici continue quand on referme l'aperçu.

`InstagramPublicationPreview` accepte désormais `activeIndex` /
`onActiveIndexChange` (état interne conservé si les props sont absentes).

Vérifié à l'écran en 1440×900 : Portrait (1 image) et Pano x3 (3 vignettes,
clic sur la 3 → 3/3 dans le téléphone), recherche « lofi piano », lecture.
Gates : lint 0 erreur (5 avertissements préexistants), `npm run build` vert.
Aucun déploiement.

## Mission suivante, dans l'ordre

1. **Multi-grilles.** `useLayoutEditor.js` est mono-grille (`images`, une grille
   active, pas de `grids[]`). Tant que ça ne bouge pas, un post = un rendu
   découpé en tranches, et la pellicule ne peut ni masquer ni réordonner sans
   casser un panorama. C'est le vrai chantier structurant : modèle + persistance
   (`layoutPersistence.js`, `projectModel.js`), puis `slides` = les grilles.
2. **Masquer / réordonner** dans `PostImagesRail`, une fois (1) fait.
3. **Spotify en écoute seule** : troisième segment dans `PreviewSoundPanel`,
   route `api/music/spotify-search` (client credentials, token caché serveur, sur
   le modèle de `api/music/free-search/route.js`), lecture par iframe embed.
   **Arbitre obligatoire** dans `AudioProvider` : l'iframe Spotify et la balise
   `<audio>` doivent se mettre en pause l'une l'autre.
   Contrainte de droits : Spotify = écoute seule, jamais dans un export (les
   Developer Terms interdisent la synchronisation avec du visuel). Le morceau
   choisi voyage vers la publication comme fiche `{titre, artiste, lien,
   exportable:false}`, à retrouver dans la bibliothèque Instagram au moment de
   publier.
4. **Ménage des docs** : corriger `AGENTS.md` (design system + code importé),
   et archiver `todo.md` qui dépasse largement les ~200 lignes de la règle.

## Interdits

- Ne pas déployer (App Hosting, Cloud Run, Functions) sans demande explicite.
- Ne pas lancer de sous-agent sans demande explicite.
- Ne pas supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Ne pas toucher `node_modules/`, `.next/`, `.git/`, `dist/`.

## Rituel de fin de phase

`npm run lint`, `npm run build`, suites impactées ; mettre à jour `todo.md`,
`plan.md`, `map.md` (arborescence + journal daté) ; écrire le prompt de reprise
suivant dans `docs/` sans le coller dans le chat, sauf demande faite en début de
session.
