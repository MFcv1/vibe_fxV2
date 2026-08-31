# Prompt de reprise — Gradient Builder, moteurs (2026-08-30 octies)

Chemin absolu du projet :
`/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## Ordre de lecture

1. `AGENTS.md` — regles de travail (economie de contexte, gates, rituel).
2. Ce fichier.
3. `map.md`, **uniquement** les journaux « 2026-08-30 octies » et « septies »,
   plus l'arborescence de `public/vendor/gradient-builder/`. Ne PAS lire map.md
   en entier (4 900 lignes).
4. `public/vendor/gradient-builder/js/render/index.js` — l'aiguillage et la
   liste `READY` des moteurs ecrits.

**Ne pas lire** : les archives `docs/archive-*`, les autres
`docs/prompt-reprise-*`, tout ce qui touche Lightroom / Vision / presets.

## Le chantier

Reconstruire a l'identique l'app **Gradient Builder** de `feralui.dev/gradients`
et l'integrer dans VibeOS comme generateur de fond. Demande : **tout sauf la
page « What's new »**. Le code est **reecrit** ; seules les donnees (presets,
nuancier, silhouettes SVG) et les mesures de style viennent du bundle public.

L'app vit dans `public/vendor/gradient-builder/` (HTML + ES modules, aucune
dependance, aucun build). Elle s'ouvre en iframe plein ecran depuis « Fond
genere » du Studio et rend son image au parent par `postMessage`.

## Etat

**24 des 28 types ont leur moteur.** La liste fait foi dans `READY`
(`js/render/index.js`). Un fichier par moteur :

- `flow.js` Flow · `sky.js` Sky (WebGL) · `aurora.js` Aurora (WebGL)
- `gl.js` socle WebGL partage (Perlin, fbm, rampe de tons)
- `fields.js` Mesh, Linear, iOS, Radial, Conic, Waves
- `strips.js` Stripes, Bars, Columns · `prism.js` Prism
- `still.js` Still · `retro.js` Retro · `noise.js` Noise
- `lines.js` Lines (13 formes + arrangements) · `shapes.js` Forms (35 SVG)
- `tiles.js` Beehive, Blocks, Balls · `rings.js` Rings · `arch.js` Arch
- `pixel.js` Pixel

**Il reste 4 moteurs a ecrire** : `GLASSY`, `GLINT`, `MIST`, `SKYLINE`.
Ils retombent aujourd'hui sur la rampe lineaire. Reperes dans le bundle :

- GLASSY → `Q2` (~2,7 Ko) ;
- GLINT → branche `i==="GLINT"` de `la`, helpers `E5`, `O0`, `T0`, `sa`, `P0` ;
- MIST → branche `i==="MIST"`, helpers `z0`, `us`, `va`, `G0`, `U0`, `H0`,
  `Us`, `K0`, `V0`, `W0`, `Uo`, `_0` ;
- SKYLINE → branche `i==="SKYLINE"`, table de villes `ha` (donnees de chemins
  SVG a extraire, comme `Ct` pour Forms) et `Y0`, `X0`.

## Aussi a faire

1. **Onglet Image** (import, logo, recadrage) — l'onglet existe et le dit.
2. **Exports** SVG, CSS, JSON, MP4.
3. **Page Saved** : marche en `localStorage`, sans suppression ni renommage.
4. Panneau **Forms** : le site propose une grille de silhouettes, des
   « colourways », un backdrop et une transformation de canvas ; on n'a que la
   liste de presets et la liste de couleurs.
5. Le bouton **Contrast** du canvas (mode lisibilite) n'existe pas.

## Methode d'extraction

Le bundle `JapaneseGradients-*.js` (613 Ko minifie) sert de **reference de
lecture**, jamais de source a copier. Outils ecrits dans le scratchpad de
session (non versionnes, a refaire) :

- extracteur de fonction par appariement d'accolades, pour lire un moteur a la
  fois sans charger tout le fichier ;
- parseur de litteral JS **sans `eval`** (refuse par le bac a sable), qui gere
  `!0`/`!1`, les gabarits entre accents graves et les appels d'aide
  `tn({...})`, pour sortir les tables de donnees en JSON.

Travailler **par extraits ciples** (`grep -n`, fenetres autour d'un
identifiant). Ne jamais charger le bundle entier dans le contexte.

Deux verifications qui ont paye :

- comparer les **pixels** plutot que les impressions (lire le canvas des deux
  cotes) ;
- inspecter le **DOM du site** : pour Forms, l'affichage passe par du SVG dont
  les degrades sont en `objectBoundingBox` — c'est ce qui a revele que mes
  degrades etaient calcules dans le mauvais repere.

## Interdits

- Ne pas copier le bundle ni la feuille de style du site : on reecrit.
- Ne pas toucher aux presets valides de `docs/presets-valides.md` (autre
  chantier).
- Aucun deploiement sans demande explicite. Pas de sous-agent sans demande.

## Gates

- `npm run lint` (passe : 0 erreur, 5 avertissements preexistants).
- A l'oeil : `http://localhost:3000/vendor/gradient-builder/index.html` pour
  l'app seule ; `http://localhost:3000/creer/studio` (importer une image, puis
  « Fond genere » > `Gradient`) pour l'integration.
- `npm run build` echoue depuis la machine et non depuis le code
  (`better-sqlite3` compile pour un autre Node) — voir la fin de `todo.md`.

## Rituel de fin de tranche

Mettre a jour `todo.md`, `map.md` (arborescence + journal date), ecrire le
prochain `docs/prompt-reprise-<date>.md` et son lien dans `todo.md`. Le recap de
chat reste en langage simple, sans jargon en tete.
