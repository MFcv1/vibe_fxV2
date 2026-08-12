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

