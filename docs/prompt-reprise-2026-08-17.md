# Prompt de reprise — 2026-08-17 (après l'audit des réglages avancés)

À copier tel quel dans un chat neuf.

---

Tu reprends le projet **Vibe_fx V2**, à `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

**Lis dans cet ordre, et rien d'autre :** `AGENTS.md` (règles de travail et rituel
de fin de phase), `todo.md` (chantier actif, court exprès), `docs/lightroom/`
(les quatre documents : procédure, méthode et pièges, mesures, synchro des
effets), `map.md` — mais dans `map.md` **ne lis que la zone que tu touches** et
son journal le plus récent. **N'ouvre AUCUNE archive** (`docs/archive-*.md`)
sauf si tu travailles précisément dans la zone concernée.

## Où en est le livre

La colorimétrie de Vision tourne sur une LUT 3D 33³ plus une chaîne d'import qui
capture un preset Lightroom exactement, par Hald CLUT. Cinq presets validés
(`docs/presets-valides.md` fait autorité : **on n'en supprime ni n'en remplace
jamais un**, un variant s'ajoute à côté).

Le lot « caler les réglages avancés sur Lightroom » est **terminé** :

- Grain, vignetage, netteté, clarté, texture (les deux côtés) sont **à l'échelle
  de Lightroom** : un même nombre veut dire la même chose des deux côtés.
- `cn17` a été validé sur une vraie photo développée des deux côtés :
  **1,95/255** d'écart moyen, identique à l'œil.
- Le 2026-08-17, un **audit complet des réglages avancés** a vérifié que chaque
  curseur fait vraiment quelque chose. Les 17 réglages du panneau Vision
  marchent. Trois choses ont été corrigées : les bornes de `/creer/studio` (la
  moitié de la course ne faisait rien), le garde-fou de gamut (l'image sautait
  au premier cran d'un réglage de couleur), et la façon de juger un effet local.

Ce qui tourne, et où : création sous `/creer` (`/creer/vision`, `/creer/studio`,
`/creer/bibliotheque`, mise en page), publication sous `/publier`, vidéo sous
`/video`. Le moteur d'image est dans
`src/features/vibefx-studio/` (`engine/studioRenderer.js`,
`utils/canvasUtils.js`, `utils/visionColorScience.js`, `utils/lut3d.js`,
`utils/visionPresets.js`). Les écrans sont dans `src/features/vibeos/`.

## État des gates au moment où on s'arrête

Tous verts au 2026-08-17 :

```bash
npm run lint                   # 0 erreur, 5 warnings préexistants
npm run build
npm run test:scope
npm run test:vision-preset     # 67 vérifications
npm run test:vision-filters
npm run test:vibeos-vision
npm run test:vibeos-studio
npm run test:vibeos-pipeline
npm run audit:reglages-avances # chaque réglage fait-il quelque chose ? (moteur)
npm run test:reglages-avances  # ...et en poussant les vrais curseurs (interface)
```

Échecs **préexistants et hors chantier** : `smoke-vibecut-media-safety.spec.cjs`
(3) et `test:vibecut-export-local-mp4` — fixtures manquantes, chemins Windows
d'origine, pointeurs Git LFS.

## La mission suivante, dans l'ordre

**Importer d'autres presets Lightroom.** Familles paysage (LN01–LN08),
architecture urbaine (UA01–UA04), voyage, cinéma, film. La procédure clic par
clic est dans `docs/lightroom/1-procedure.md`.

1. **Demander à Matthis** les exports : les captures Lightroom sont faites **à la
   main par lui**, tu ne peux ni lire ses panneaux ni exporter à sa place.
2. Pour chaque preset, lui demander de **relever les panneaux Effets et Détail**,
   et de **mettre le grain à 0 avant d'exporter la mire** (un grain figé dans une
   table de couleurs n'est plus du grain, c'est une erreur).
3. Vérifier les **deux pièges qui rendent un preset non capturable** sans que
   rien ne le signale : un réglage **« Auto »** non nul, et un panneau
   **Masquage** non vide.
4. Importer avec `npm run preset:import`, en passant les valeurs relevées :
   `--grain`, `--vignette`, `--clarity`, `--texture`, `--sharpness`, `--dehaze`.
   **Les nombres se recopient tels quels** : nos échelles sont les siennes.
5. **Juger le résultat à l'œil**, sur des photos **peu retouchées** (Unsplash,
   hors dépôt dans `~/Desktop/devimage/`) : `node scripts/planche-presets.mjs`
   pour la couleur, `node scripts/planche-showcase.mjs` pour les effets.

Restent ouverts, non bloquants : le **voile** (à mesurer sur photo réelle, pas
sur mire), la **texture sur contours francs** (la sienne épargne les arêtes, la
nôtre non — demande un masque de contours), **CN11 à remesurer** avec
l'instrument corrigé si sa photo réapparaît, et la **licence** de CN11/CN17,
à trancher avant toute mise en ligne.

## Les interdits du chantier

- **Jamais supprimer ni remplacer** un preset de `docs/presets-valides.md`.
- **Jamais de Tailwind** dans le nouveau code : CSS Modules + tokens `--vo-*`.
- **Jamais réécrire un moteur existant** : on l'importe, ou on l'extrait.
- **IndexedDB** : des Blobs, jamais de dataURL.
- **Aucun déploiement** sans demande explicite : tout se vérifie en local.
- Les bornes d'un réglage ont **une seule source, côté moteur**. L'interface les
  lit, jamais l'inverse.

## Le rituel de fin de phase, à rejouer

Gates ci-dessus, mise à jour de `todo.md` (qui doit **rester court** : sous
200 lignes, on archive avant d'ajouter) et de `map.md` (arbre + journal daté),
rapport honnête de ce qui marche, de ce qui est laissé de côté et pourquoi. Puis,
**dans le chat** : un récap en langage simple, et le prompt de reprise complet
écrit en entier dans un bloc de code.
