# Prompt de reprise — 2026-08-12 (lot M, `powlisher-ciel`)

À coller tel quel dans un chat neuf, contexte à zéro.

---

Tu reprends le projet **Vibe_fx V2**, à `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

**Lis dans cet ordre, et rien d'autre :**

1. `AGENTS.md` — règles de travail et rituel de fin de phase.
2. `todo.md` — le chantier actif (presets de Vision). Court exprès.
3. `docs/presets-valides.md` — **la liste des presets qui ne se suppriment
   jamais**, et ce qu'un preset doit passer pour y entrer. Fait autorité.
4. `docs/lightroom/corpus-powlisher/README.md` — **si tu touches au ciel**.
5. `docs/audit-preset-powlisher-2026-08-11.md` — **si tu touches à `powlisher`**.
6. `map.md` — arbre du projet. Ses journaux datés : **ne lis que la zone que tu
   touches**.

**Ne lis pas** : `docs/archive-*.md`, sauf si tu travailles dans la zone qu'ils
couvrent.

## Où en est le livre

Le redesign VibeOS est livré (phases A→G, archivées). Le chantier actif, c'est la
**colorimétrie de Vision** : des presets compilés en LUT 3D 33³
(`src/features/vibefx-studio/utils/lut3d.js`).

Quatre presets exposés, dans `src/features/vibefx-studio/utils/visionPresets.js` :

- `powlisher` — reconstruit par mesure sur son corpus. Le repère, non touché.
- **`powlisher-ciel`** — le dernier livré, **validé à l'œil par le porteur du
  projet** sur ses photos, à côté de `powlisher` et de CN17. Le ciel **converge**
  vers la teinte où atterrissent ses ciels (190–199°) au lieu d'être tourné d'un
  angle fixe. Hors du bleu, identique à `powlisher` **au bit près**.
  **Il ne se supprime pas** : un futur variant du ciel s'ajoute, il ne le
  remplace pas.
- **`powlisher-showcase`** — le clair-obscur de ses photos de voiture : un
  **creux de saturation** vide le décor et laisse le sujet seul coloré (écart
  mesuré chez lui : ×2,1 à ×3,8). Porte aussi des effets non-LUT
  (`spatialFilters` : grain 20, vignetage 22, relief 14). Preset de **situation**,
  pas look universel : la règle se déclenche sur la saturation, pas sur le sujet.
- `cn11`, `cn17` — captures exactes de Lightroom par Hald CLUT.

**Un preset peut porter des effets non-LUT.** Le panneau les affiche en couleur
d'accent et le preset annonce ce qu'il pose. Les bornes des réglages vivent en un
seul endroit (`VISION_SAFE_BOUNDS` / `VISION_FREE_BOUNDS`) : l'interface les lit,
elle ne les redéclare jamais.

**Trois presets ont été supprimés le 2026-08-12** (`powlisher-ville`,
`powlisher-v2`, `powlisher-v2-dore`). Ils passaient toutes leurs mesures et
étaient faux quand même. Les deux raisons sont les leçons du lot :

1. **Source biaisée** : ils étaient calés sur la « paire avant/après » du
   photographe, passée par une **IA générative**. On ne cale pas un preset sur
   une source dont on ne sait pas ce qu'elle mesure. La paire est retirée du
   corpus, du script de récupération et du script de mesure.
2. **Ils traçaient un trait dans le ciel** : leur règle se déclenchait sur la
   **teinte** d'un pixel sans vérifier que cette teinte veuille dire quelque
   chose. Dans un voile quasi blanc, la teinte est du bruit. Invisible dans
   toutes les moyennes, évident à l'écran.

## L'état des gates au moment où on s'arrête

Tous verts au 2026-08-12 :

```bash
npm run lint                   # 0 erreur (5 warnings préexistants)
npm run build
npm run test:scope
npm run test:vision-preset     # 67 vérifications
npm run test:vibeos-vision     # 2 tests navigateur, 9 s
```

**Échecs préexistants, hors chantier** : `smoke-vibecut-media-safety.spec.cjs` (3)
et `test:vibecut-export-local-mp4` — fixtures manquantes, chemins Windows
d'origine, pointeurs Git LFS.

## Les outils de mesure

```bash
node scripts/mesure-ciel-powlisher.mjs                    # où SON ciel atterrit
node scripts/mesure-ciel-powlisher.mjs --photo <fichier>  # une de NOS photos
node scripts/audit-vision-presets.mjs
node scripts/compare-vision-presets-on-photos.mjs <photo...>
node scripts/compare-preset-vs-lightroom.mjs <src> <lr> <id>
```

Le corpus n'est pas versionné (`node scripts/fetch-powlisher-corpus.mjs` le
récupère). Sous-dossier `ciel/` : les photos où le ciel est mesurable — c'est lui
qui porte la cible.

## La mission suivante (lot K), dans l'ordre

1. **Brancher la Netteté 40** que Lightroom applique par défaut
   (`filters.sharpness`). Dernier écart mesurable avec Lightroom.
2. **Trancher la licence** avant toute mise en ligne : CN11 et CN17 sont dans le
   bundle sous leurs noms Adobe.
3. **Construire nos propres looks**, calibrés sur CN11 qui est une référence
   exacte.

Deux réglages de `powlisher-showcase` sont posés **au jugement**, et c'est
assumé : son vignetage (22), faute de surface uniforme mesurable dans ses photos,
et son grain (20). Pour le grain, la mesure disait 35 — mais le ~2,5/255 de
référence avait été mesuré sur ses JPEG réduits à 900 px, alors que notre grain
est posé à la résolution de la photo : réduire une image **moyenne** son grain,
les deux chiffres ne sont pas comparables. À l'œil, 35 passe sur une voiture
(cadre plein de matière) et se voit trop sur un paysage (grand ciel lisse). 20
tient sur les deux.

## Les interdits du chantier

- **Jamais de Tailwind** dans le nouveau code : CSS Modules + tokens `--vo-*`.
- **Jamais réécrire un moteur existant** : on l'importe, ou on l'extrait.
- **IndexedDB** : des Blobs, jamais de dataURL.
- **Aucun déploiement** sans demande explicite : tout se vérifie en local.
- **Une règle qui dépend de la teinte doit s'éteindre quand le pixel n'a plus de
  teinte** — sinon elle trace un contour dans le premier voile venu.
- **Juger un preset à l'œil, sur une vraie photo, avant de le livrer.** Les trois
  presets supprimés passaient toutes leurs mesures.
- Les autres pièges connus sont listés dans `todo.md`, section « Pièges connus ».

## Le rituel de fin de phase, à rejouer

Gates ci-dessus, puis mise à jour de `todo.md` (**qui doit rester court** — sous
200 lignes, archiver sinon) et de `map.md` (arborescence + entrée de journal
datée). Puis, **dans le chat** : le récap en langage simple **et** le prompt de
reprise complet, écrit en entier, dans un bloc de code.
