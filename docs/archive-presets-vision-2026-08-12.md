# Archive — presets de Vision, lots H / I / J

> Sorti de `todo.md` le **2026-08-12**, parce que ces trois lots sont **clos**.
> `todo.md` est relu à chaque session par chaque agent : tout ce qui y traîne
> coûte du contexte à tout le monde, à chaque fois.
>
> À ouvrir seulement si on touche au **moteur de LUT** ou à la **chaîne d'import
> Lightroom**. L'état courant et les pièges à ne pas réintroduire restent, eux,
> dans [todo.md](../todo.md).

| Lot | Contenu | État |
|---|---|---|
| H — Presets | 12 « looks » supprimés ; moteur LUT 3D + preset `powlisher` reconstruit par mesure | ✅ 2026-08-11 |
| I — Import Lightroom | capture exacte par Hald CLUT + lecture du `.xmp` | ✅ 2026-08-11 |
| J — Capture réelle CN11 / CN17 | chaîne validée sur un vrai Lightroom cloud | ✅ 2026-08-11 |
| L — Powlisher V2 + doré | 3 presets bâtis sur une source biaisée | ❌ **supprimés** 2026-08-12 |
| M — `powlisher-ciel` | le ciel **converge** au lieu d'être tourné d'un angle fixe | ✅ 2026-08-12 |
| N — `powlisher-showcase` + interface | clair-obscur pour la voiture, et 4 bugs de réglages | ✅ 2026-08-12 |

---

### Lot H — pourquoi les looks ont sauté

Ils dénaturaient les photos, et ils étaient lents : chaque changement de photo
relançait 12 vignettes, chacune repartant de l'image **pleine résolution** avec
4 passes pixel et un encodage JPEG.

À la place, des presets compilés en **LUT 3D** :

- [lut3d.js](src/features/vibefx-studio/utils/lut3d.js) — une fonction de preset
  est évaluée **une fois** sur une grille 33³, puis appliquée en **une passe**.
  Coût de rendu **constant** : ajouter un preset ne coûte rien.
- [visionPresets.js](src/features/vibefx-studio/utils/visionPresets.js) — les
  presets. Deux formes possibles, indiscernables au rendu : `transform` (fonction
  pure écrite à la main) ou `getLut` (table importée de Lightroom).
- [presetPreview.js](src/features/vibeos/vision/presetPreview.js) — la photo est
  réduite **une seule fois** dans un canvas partagé.

Un seul preset existe : `powlisher`, reconstruit **par mesure** sur 19 photos
(ciel tiré vers le teal 178–194°, verts olive, peau préservée, hautes lumières
crème, noirs denses). Chiffres et réserves dans
[l'audit](docs/audit-preset-powlisher-2026-08-11.md).

### Lot I — capturer un preset externe sans approximer

Recopier les curseurs d'un `.xmp` donnerait un rendu **différent** : Lightroom
travaille sur du RAW linéaire, nous sur du JPEG 8 bits déjà développé. Donc on
ne recopie pas — on fait faire le calcul à Lightroom et on lit le résultat, via
une **Hald CLUT**. Aller-retour vérifié en simulation : **0,24/255 d'écart
moyen**. Mode d'emploi complet :
[docs/lightroom/2-methode-et-pieges.md](docs/lightroom/2-methode-et-pieges.md).

### Lot J — la chaîne a tourné sur un vrai Lightroom

CN11 et CN17 capturés et importés. Fidélité de CN11 sur une vraie photo :
**0,64/255 sur la couleur**, 2,67/255 au pixel (médiane 1). Contrôle à vide
0,018/255.

Quatre choses apprises, toutes documentées et toutes codées :

- **La mire doit être en BLOCS de 4×4 pixels.** Avec une couleur par pixel, les
  couleurs bavent les unes sur les autres — invisible dans les clairs, ruineux
  dans les noirs, qui viraient au **vert** de façon visible sur les photos.
  Corrigé : `preset:mire` génère du 2048×2048 par défaut, l'import lit le cœur
  de chaque carré. Écart aux noirs : 8,06 → **1,32/255**.
- L'export Lightroom part en **Adobe RVB**. Il FAUT **sRVB**, sinon la table est
  fausse d'un bout à l'autre sans que rien ne le signale.
- Un preset avec du **grain** bruite quand même la table (CN17 : rugosité 4,70).
  `--lisser 1` la ramène à 0,69, et ne déplace une table déjà lisse que de 0,05.
- **Tout preset reste à `recommendedIntensity: 100`.** Baisser l'intensité ne
  réduit pas le contraste : ça mélange l'image traitée avec l'originale, ce qui
  délave les couleurs et éloigne de la référence. Essayé sur CN11/CN17, mesuré,
  annulé. `powlisher` était à 85 sans justification : ça lui coûtait sa
  signature (ciel profond à 201° au lieu de 193,7°, donc hors de sa fourchette
  teal 178–196°). Remis à 100.

Procédure reproductible, chiffres, verdict, **question de licence** et le détail
des trois erreurs de mesure commises en route : [docs/lightroom/](docs/lightroom/).



---

### Lots L, M, N — 2026-08-12

Le détail chiffré est dans les **journaux datés de `map.md`** (entrées
« lot M » et « lot N »), pas ici : c'est là qu'il a été écrit au moment du
travail, avec les mesures. Ce qu'il faut en retenir tient en cinq points, tous
déjà repris dans « Pièges connus » de `todo.md` :

1. **Trois presets supprimés.** Ils passaient toutes leurs mesures et étaient
   faux quand même : source biaisée (la « paire avant/après » du photographe est
   passée par une IA générative) et **trait de contour** dans le ciel, invisible
   dans les moyennes, évident à l'écran.
2. **`powlisher-ciel`** : ses ciels francs atterrissent tous entre 190 et 199°
   alors que leurs entrées n'ont aucune raison d'être groupées — ça décrit une
   **convergence**, pas une rotation. Appliqué à ses propres photos, `powlisher`
   leur retire encore 22,6° en moyenne, `powlisher-ciel` 5,5°.
3. **`powlisher-showcase`** : un **creux de saturation** vide le décor et laisse
   le sujet seul coloré (écart mesuré chez lui ×2,1 à ×3,8). Porte aussi des
   effets non-LUT.
4. **Quatre bugs d'interface** : bornes déclarées deux fois (un tiers de la
   course ne faisait rien), curseurs au repos non alignés, aperçu qui calculait
   1,9 Mpx par cran de curseur, et **grain qui plafonnait à 0,9/255** —
   invisible.
5. **La méthode** : mesurer, puis **regarder**. Les trois défauts qui ont coûté
   le plus n'ont été vus qu'à l'écran.
