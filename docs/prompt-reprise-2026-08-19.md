# Prompt de reprise — 2026-08-19 (audit de fiabilité, puis deux trous bouchés)

À copier tel quel dans un chat neuf.

---

Tu reprends le projet **Vibe_fx V2**, à `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

**Lis dans cet ordre, et rien d'autre :** `AGENTS.md` (règles de travail et rituel
de fin de phase), `todo.md` (chantier actif, court exprès),
`docs/lightroom/5-audit-fiabilite-2026-08-19.md` (**où en est notre fidélité à
Lightroom, réglage par réglage**), puis les autres documents de `docs/lightroom/`
selon ce que tu touches, et `map.md` — mais dans `map.md` **ne lis que la zone que
tu touches** et son journal le plus récent. **N'ouvre AUCUNE archive**
(`docs/archive-*.md`) sauf si tu travailles dans la zone concernée.

## Où en est le livre

La colorimétrie de Vision tourne sur une LUT 3D 33³ plus une chaîne d'import qui
capture un preset Lightroom exactement, par Hald CLUT. Cinq presets validés
(`docs/presets-valides.md` fait autorité : **on n'en supprime ni n'en remplace
jamais un**, un variant s'ajoute à côté).

Ce qui tourne, et où : création sous `/creer` (`/creer/vision`, `/creer/studio`,
`/creer/bibliotheque`, mise en page), publication sous `/publier`, vidéo sous
`/video`. Le moteur d'image est dans `src/features/vibefx-studio/`
(`engine/studioRenderer.js`, `utils/canvasUtils.js`, `utils/visionColorScience.js`,
`utils/lut3d.js`, `utils/visionPresets.js`, `utils/xmpPreset.js`). Les écrans sont
dans `src/features/vibeos/`.

**Le 2026-08-19, tout a été remesuré face aux vrais exports Lightroom** de
`~/Desktop/vibefx-lightroom/`, puis deux trous ont été bouchés dans la foulée.

Fiable, mesuré : **grain** (15/50/100, ×1,00), **vignetage** (−50/−100, 2,5/255),
**texture** dans les deux sens (≤ 1,3 %), **clarté** dans les deux sens
(positive ≤ 1 %, négative calée le 19 : 0,707 à −50 et 0,494 à −100 contre
0,695–0,723 et 0,476–0,526 chez lui), **netteté 40** (+5 %), et la **couleur** sur
vraie photo (`cn17` : 1,95/255).

L'import **dit maintenant ce qu'il ne sait pas reproduire**
(`verifierDomaineSpatial` dans `utils/xmpPreset.js`, affiché par
`scripts/import-lightroom-preset.mjs`) : vignetage positif et voile négatif jetés,
voile hors échelle, netteté ≥ 80, halo sur les arêtes.

Reste NON fiable, et c'est connu :

1. **Le voile** : 11,76/255 d'écart à 50, +18 % trop fort, loi non linéaire chez
   lui (28,2 à 50 → 71,3 à 100). Notre plafond est 50, le sien 100. Lightroom
   l'estime depuis le contenu de l'image : **à mesurer sur photo réelle, pas sur
   mire**, et il faut un export de Matthis.
2. **Texture et clarté halonnent les arêtes franches** : il les épargne
   (1,006 / 1,014 à +50), nous non (1,100 / 1,143). Demande un **masque de
   contours**, pas un coefficient.
3. **Netteté ≥ 80** : il raidit aussi les larges structures (×1,58 à 150), nous
   ×1,00. Sans importance à 40, la valeur qu'il pose par défaut.
4. **Sous-réglages non branchés** (grain Taille/Cassure, vignette
   Milieu/Arrondi/Contour/Hautes lumières) : tout est calibré pour leurs défauts.
   **À relever à chaque import.**
5. **Une seule résolution vérifiée** (1620×1080) : texture et grain ont un rayon
   en pixels fixes, la clarté en % du cadre. Hypothèse non mesurée ailleurs.

## État des gates au moment où on s'arrête

Verts au 2026-08-19 :

```bash
npm run lint                   # 0 erreur, 5 warnings préexistants
npm run test:vision-preset     # 78 vérifications
npm run test:vision-filters
npm run test:vibeos-studio
npm run audit:reglages-avances # chaque réglage fait-il quelque chose ? (moteur)
npm run test:reglages-avances  # ...et en poussant les vrais curseurs (interface)
```

**`npm run build` échoue, et ce n'est pas le code** : vérifié en remisant toutes
les modifications, il échoue pareil sans elles. Le code compile ; c'est la
collecte de page qui casse sur `/api/catalog/[jobId]` parce que `better-sqlite3`
a été compilé pour un autre Node (NODE_MODULE_VERSION 127 contre 147). Correctif :
`npm rebuild better-sqlite3` — non fait, `node_modules/` étant hors périmètre.

Échecs **préexistants et hors chantier** : `smoke-vibecut-media-safety.spec.cjs`
(3) et `test:vibecut-export-local-mp4` — fixtures manquantes, chemins Windows
d'origine, pointeurs Git LFS.

## La mission suivante, dans l'ordre

**Importer d'autres presets Lightroom.** Familles paysage (LN01–LN08),
architecture urbaine (UA01–UA04), voyage, cinéma, film. Procédure clic par clic :
`docs/lightroom/1-procedure.md`.

1. **Demander à Matthis** les exports : les captures Lightroom sont faites **à la
   main par lui**, tu ne peux ni lire ses panneaux ni exporter à sa place.
2. Lui faire **relever les panneaux Effets et Détail** (y compris les
   sous-réglages de grain et de vignette), et **mettre le grain à 0 avant
   d'exporter la mire**.
3. Vérifier les **deux pièges** qui rendent un preset non capturable sans que rien
   ne le signale : un réglage **« Auto »** non nul (le tester sur deux images très
   différentes), un panneau **Masquage** non vide.
4. Importer avec `npm run preset:import` et les valeurs relevées (`--grain`,
   `--vignette`, `--clarity`, `--texture`, `--sharpness`, `--dehaze`) : **les
   nombres se recopient tels quels**, nos échelles sont les siennes. **Lire les
   avertissements** que l'import affiche en fin de course.
5. **Juger à l'œil**, sur des photos **peu retouchées** (Unsplash, hors dépôt dans
   `~/Desktop/devimage/`) : `node scripts/planche-presets.mjs` pour la couleur,
   `node scripts/planche-showcase.mjs` pour les effets.

**Si un preset à importer porte un voile marqué**, c'est le voile qu'il faut
traiter d'abord : demander à Matthis une photo développée des deux côtés, et
mesurer avec `node scripts/compare-preset-vs-lightroom.mjs`.

Restent ouverts, non bloquants : le **masque de contours** de texture/clarté, la
**netteté haute**, **CN11 à remesurer** avec l'instrument corrigé si sa photo
réapparaît, et la **licence** de CN11/CN17 à trancher avant toute mise en ligne.

**Avant d'ajouter un lot à `todo.md`, l'archiver** : il dépasse 200 lignes (310 au
2026-08-19), et c'est le fichier que chaque agent relit à chaque session.

## Les interdits du chantier

- **Jamais supprimer ni remplacer** un preset de `docs/presets-valides.md`.
- **Jamais de Tailwind** dans le nouveau code : CSS Modules + tokens `--vo-*`.
- **Jamais réécrire un moteur existant** : on l'importe, ou on l'extrait.
- **IndexedDB** : des Blobs, jamais de dataURL.
- **Aucun déploiement** sans demande explicite : tout se vérifie en local.
- Les bornes d'un réglage ont **une seule source, côté moteur**. L'interface les
  lit, jamais l'inverse.
- **Ne jamais mesurer un effet spatial sur la mire Hald** (ses pastilles de 4×4 px
  bavent) ni juger un effet **local** à sa seule moyenne.
- **Toute valeur déjà écrite est à convertir** quand une échelle bouge — presets,
  ambiances et `constants.jsx` compris.

## Le rituel de fin de phase, à rejouer

Gates ci-dessus, mise à jour de `todo.md` (qui doit **rester court**) et de
`map.md` (arbre + journal daté), rapport honnête de ce qui marche, de ce qui est
laissé de côté et pourquoi. Puis, **dans le chat** : un récap en langage simple,
et le prompt de reprise complet écrit en entier dans un bloc de code.
