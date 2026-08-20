# Prompt de reprise — 2026-08-20 (serie d'imports Lightroom en cours)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## A lire, dans cet ordre

1. `AGENTS.md` — regles de travail. Note : le prompt de reprise ne s'ecrit dans
   le chat QUE si l'utilisateur le demande au debut de la session.
2. `todo.md` — chantier actif.
3. `docs/presets-valides.md` — si tu touches aux presets.
4. `docs/lightroom/1-procedure.md` — si tu importes un preset.

**Ne PAS lire** : les archives (`docs/archive-*`, `docs/prompt-reprise-*`) ni
`map.md` en entier (des milliers de lignes — `grep -n` sur la zone touchee).

## Ou on en est

La chaine d'import Lightroom **marche de bout en bout**, prouvee sur CN01 le
2026-08-20. Neuf presets valides : `powlisher`, `powlisher-ciel`,
`powlisher-showcase`, `cn01`, `cn11`, `cn13`, `cn14`, `cn16`, `cn17`.

**Un preset a grain ne se juge pas au pixel** : son grain et le notre sont deux
tirages aleatoires. Lire la ligne « couleur seule, par blocs » du comparateur.

**CN13, importe et valide le 2026-08-20** : Effets tout a 0, Nettete 40,
Masquage vide ; ecarts **2,27/255** et **1,67/255** sur les deux photos de test.
Sa Reduction du bruit (20/50) n'est pas reproductible chez nous.

**CN01, importe et valide** : aucun effet spatial (tout a 0 dans Lightroom),
donc la table capture 100 % du preset. Compare a Lightroom sur deux vraies
photos : **1,56/255** et **1,28/255** — « identique a l'oeil ».

## Le circuit de travail (a ne pas reinventer)

Dossier `~/Desktop/📸 VIBEFX-IMPORTS/`, une case par preset :

- `0-A-IMPORTER-DANS-LIGHTROOM/` — mire neutre + 2 photos de test, importees une
  seule fois dans Lightroom.
- `<PRESET>/1-photos-des-panneaux/` — captures Effets, Detail, Masquage.
- `<PRESET>/2-mire-exportee/` — la mire AVEC le preset applique, grain a 0.
- `<PRESET>/3-photo-test-version-lightroom/` — les 2 photos avec le preset.
- `<PRESET>/4-resultat-claude/` — l'agent y range les planches de comparaison.

Les instructions se donnent **dans le chat**, pas dans des fichiers a lire.

## La suite : importer les favoris restants

CN18, FT01, FT11, LN02, LN05, LN06, TR04, TR13, TR14, TR15,
VCR11, VCR12. (CN01, CN11, CN13 et CN17 sont deja faits.)

Pour chacun, quand les dossiers sont remplis :

```bash
cp "~/Desktop/📸 VIBEFX-IMPORTS/<ID>/2-mire-exportee/<fichier>.png" presets-lightroom/<id>-bloc4.png
npm run preset:import -- --hald presets-lightroom/<id>-bloc4.png --id <id> --label "<ID>" \
  --hint "<...>" --bestFor "<...>" [--grain N --vignette N --clarity N --texture N --sharpness N --dehaze N]
npm run test:vision-preset
node scripts/compare-preset-vs-lightroom.mjs <origine> <version-LR> <id> --planche <sortie>
```

Les valeurs des panneaux se recopient **telles quelles** : nos echelles sont les
siennes. Attention : `FT01`/`FT11` sont de la famille « inspire d'un film », ou
des reglages **Auto** ont deja ete vus — les tester sur deux photos avant de
capturer.

## Le grain est cale sur Lightroom (2026-08-20)

Force ET grosseur. La loi vit dans `src/features/vibefx-studio/utils/grainField.js`,
l'instrument dans `scripts/mesure-taille-grain.mjs`. Sa grosseur suit son
sous-reglage « Taille » ET la largeur de l'image. Ecart max sur six cas mesures:
force 2,1 %, grosseur 5 %. A chaque import qui porte du grain, **ouvrir le
triangle du panneau Grain** et relever la Taille (`--grainSize` si elle s'ecarte
de 25). `grainSize` n'est PAS dans le panneau Vision: decision d'interface non
prise.

## Ce qui est ouvert

1. **Voile** non calibre (11,8/255 d'ecart a 50). A traiter seulement si un
   preset a importer en porte.
2. **Masque de contours** pour texture/clarte, et **nettete >= 80** : vrai
   chantier de moteur, pas un coefficient.
3. **Reduction du bruit** : Lightroom en a une, nous non. Un preset qui en porte
   gardera chez nous un grain numerique. Visible seulement sur photo bruitee.
4. **Licence** : cn01/cn11/cn17 portent leurs noms Adobe. A trancher avant toute
   mise en ligne.

Un preset importe **ne se perime pas** : il stocke la table de couleurs exacte
plus les nombres bruts de Lightroom. Toute amelioration future du moteur
s'applique retroactivement, sans re-import.

## Interdits

- Jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Jamais de Tailwind : CSS Modules + tokens `--vo-*`.
- Aucun deploiement sans demande explicite.
- Pas de sous-agent sans demande explicite.

## Gates

```bash
npm run lint                   # 0 erreur (5 warnings preexistants)
npm run test:vision-preset     # 78 verifications, ~1 s
npm run test:reglages-avances  # navigateur, ~2 min
```

`npm run build` echoue depuis la machine, pas depuis le code :
`npm rebuild better-sqlite3` (NODE_MODULE_VERSION 127 contre 147).
