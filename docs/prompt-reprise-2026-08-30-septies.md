# Prompt de reprise — Gradient Builder (2026-08-30 septies)

Chemin absolu du projet :
`/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## Ordre de lecture

1. `AGENTS.md` — regles de travail (economie de contexte, gates, rituel).
2. Ce fichier.
3. `map.md`, **uniquement** le journal « 2026-08-30 septies » et l'arborescence
   de `public/vendor/gradient-builder/`. Ne PAS lire map.md en entier (4 900 lignes).
4. Le code de l'app : `public/vendor/gradient-builder/js/`.

**Ne pas lire** : les archives `docs/archive-*`, les autres
`docs/prompt-reprise-*`, tout ce qui touche Lightroom / Vision / presets — c'est
un autre chantier.

## Ce qu'est le chantier

Reconstruire a l'identique l'app **Gradient Builder** de `feralui.dev/gradients`
(un generateur de degrades), et l'integrer dans VibeOS comme generateur de fond.
Demande de l'utilisateur : **tout sauf la page « What's new »**, donc les 28
types, les onglets Design / Text / Image, et les pages Gallery / Palette / Saved.

Le code est **reecrit**, pas copie : seules les donnees (presets, nuancier) et
les mesures de style sont reprises du bundle public.

## Etat livre (tranche 1)

App autonome dans `public/vendor/gradient-builder/` — HTML + ES modules, aucune
dependance, aucun build. Elle s'ouvre en iframe plein ecran depuis le Studio.

- `index.html` — coquille.
- `styles.css` — feuille reecrite d'apres les mesures du site (tokens `--jg-*`,
  themes clair et sombre).
- `js/color.js` — sRGB <-> OKLab, melange, bandes, echantillonnage.
- `js/names.js` + `js/data/colornames.json` — nuancier de 102 couleurs
  traditionnelles + repli par famille de teinte, note WCAG.
- `js/data/types.js` — 28 types, 4 familles + Popular.
- `js/data/presets.json` — 208 presets de panneau, 69 degrades de galerie,
  12 gammes de palette, defaut par type.
- `js/render/flow.js` — moteur Flow.
- `js/render/fields.js` — Mesh, Linear, iOS, Radial, Conic, Waves.
- `js/render/strips.js` — Stripes, Bars, Columns.
- `js/render/index.js` — aiguillage, rendu deux temps (brouillon 260 px puis
  pleine resolution plafonnee a 1600 px), grain.
- `js/ui/controls.js` — segments a pastille glissante, dials, lignes de reglage.
- `js/app.js` — etat, panneau, canvas, bandes, pages, export, pont postMessage.

Cote VibeOS :

- `src/features/vibeos/shared/GradientSheet.jsx` — iframe + protocole.
- `src/features/vibeos/studio/StudioScreen.jsx` — bouton `Gradient` dans
  « Fond genere ».
- `src/features/vibeos/studio/useStudioEditor.js` — `lumenMode` retient quel
  generateur a produit le fond actif.
- `src/features/vibeos/primitives/` — `Sheet` gagne la variante `full`.

Le fond genere par Gradient Builder reutilise l'emplacement projet
`background.lumen` (meme nature : une image rendue), avec `mode: 'gradient'`.

## Ce qui reste

1. **Les 18 moteurs manquants**, par ordre d'interet :
   `LINE` (Lines) et `SHAPES` (Forms) — ils sont dans Popular, donc les plus
   visibles ; puis `SKY` (WebGL, shader de nuages), `AURORA` (WebGL + repli 2D),
   `PRISM`, `RING`, `GLASSY`, `PIXEL`, `CUBE`, `SMESH`, `RETRO`, `CNOISE`,
   `MIST`, `GLINT`, `SKYLINE`, `ARCH`, `BEEHIVE`, `BALLS`.
   Tant qu'un moteur manque, le type retombe sur la rampe lineaire ; la liste
   des moteurs ecrits est `READY` dans `js/render/index.js`.
2. **Onglet Image** (import, logo, recadrage) — l'onglet existe et le dit.
3. **Exports** SVG, CSS, JSON, MP4 (le site utilise un muxer mp4).
4. **Page Saved** : elle marche en `localStorage` mais n'a ni suppression ni
   renommage.
5. **Les reglages par type** dans le panneau : seuls Flow, Stripes et Bars ont
   leur groupe « Field ». Les autres types en ont aussi sur le site.

## Methode qui a marche pour extraire

Le bundle public du site (`JapaneseGradients-*.js`, 613 Ko minifie) sert de
**reference de lecture**, jamais de source a copier. Deux outils ont ete ecrits
dans le scratchpad de session (non versionnes, a refaire si besoin) :

- un extracteur de fonction par appariement d'accolades, pour lire un moteur a
  la fois sans charger tout le fichier ;
- un parseur de litteral JS **sans `eval`** (l'`eval` sur du code telecharge est
  refuse par le bac a sable), pour sortir les tables de donnees en JSON.

Travailler **par extraits ciples** (`grep -n`, fenetres de caracteres autour
d'un identifiant). Ne jamais charger le bundle entier dans le contexte.

## Interdits

- Ne pas copier le bundle ni la feuille de style du site dans le depot : on
  reecrit.
- Ne pas toucher aux presets valides de `docs/presets-valides.md` (autre
  chantier, sans rapport).
- Aucun deploiement sans demande explicite.
- Pas de sous-agent sans demande explicite.

## Gates

- `npm run lint` (passe, 0 erreur, 5 avertissements preexistants).
- Verification a l'oeil dans le navigateur : `http://localhost:3000/vendor/gradient-builder/index.html`
  pour l'app seule, et `http://localhost:3000/creer/studio` (importer une image,
  puis « Fond genere » > `Gradient`) pour l'integration.
- `npm run build` echoue depuis la machine et non depuis le code
  (`better-sqlite3` compile pour un autre Node) — voir la fin de `todo.md`.

## Rituel de fin de tranche

Mettre a jour `todo.md`, `map.md` (arborescence + journal date), ecrire le
prochain `docs/prompt-reprise-<date>.md` et son lien dans `todo.md`. Le recap de
chat reste en langage simple, sans jargon en tete.
