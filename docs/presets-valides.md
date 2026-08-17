# Presets validés — à ne jamais supprimer

> **Ce fichier fait autorité.** Un preset qui y figure a été **regardé et validé
> par le porteur du projet**, sur de vraies photos. Il ne se supprime pas, il ne
> se remplace pas, et on ne le « corrige » pas sans demande explicite.
>
> Un nouveau variant **s'ajoute à côté**. Il ne prend jamais la place d'un preset
> validé, même s'il est censé faire mieux.

Lié depuis [AGENTS.md](../AGENTS.md) et [todo.md](../todo.md). Le code vit dans
[visionPresets.js](../src/features/vibefx-studio/utils/visionPresets.js), les
vérifications dans `npm run test:vision-preset`.

---

## La liste

| Preset | Validé le | Ce qu'il fait | Effets non-LUT |
|---|---|---|---|
| **`powlisher`** | 2026-08-11 | Le look de `@powl_d`, reconstruit par mesure sur 19 photos : ciel teal, verts olive, peau préservée, hautes lumières crème, noirs denses. **C'est le repère** de toute la famille. | — |
| **`powlisher-ciel`** | 2026-08-12 | Le même look, mais le ciel **converge** vers la teinte où atterrissent ses ciels (190–199°) au lieu d'être tourné d'un angle fixe. Verdict : « un ciel plus naturel sans perdre le reste de powlisher ». | — |
| **`powlisher-showcase`** | 2026-08-12, effets revalidés le **2026-08-16** | Le clair-obscur de ses photos de voiture : un **creux de saturation** vide le décor et laisse le sujet seul coloré (écart ×2,1 à ×3,8 chez lui). Testé sur des photos Unsplash. | grain **8**, vignetage **8**, relief 14 |
| **`cn11`**, **`cn17`** | 2026-08-11, `cn17` validé **sur une vraie photo** le 2026-08-16 (écart moyen **1,73/255**) | Captures **exactes** de deux presets Adobe (pack « Cinéma II ») par Hald CLUT. Ce ne sont pas des approximations : c'est le résultat mesuré du moteur d'Adobe. **Réserve licence** : ils portent leurs noms Adobe, à trancher avant toute mise en ligne. | netteté **40** sur les deux ; `cn17` : grain 15 |

> **Nos échelles d'effets sont celles de Lightroom** depuis les 15 et 16 août
> 2026 (mesures dans [lightroom/4-synchro-effets.md](lightroom/4-synchro-effets.md)).
> Les trois effets de `powlisher-showcase` ont donc été reconvertis, puis
> **revalidés à l'œil le 2026-08-16** sur quatre photos peu retouchées, avec le
> vrai moteur (`node scripts/planche-showcase.mjs`) : grain **8** et relief
> **14** gardés, **vignetage monté de 3 à 8** — le 3 reproduisait fidèlement un
> réglage cassé, il ne fermait rien.
>
> **`cn11` et `cn17` portent désormais `sharpness: 40`.** C'est la netteté que
> Lightroom pose par défaut sur toute photo, et notre moteur n'en a aucune :
> sans elle, le même preset rendait 1,40× plus mou que chez lui, mesuré sur la
> roche d'une vraie photo.

---

## Ce qu'un preset doit passer pour entrer dans cette liste

**Les mesures ne suffisent pas.** Les trois presets supprimés le 2026-08-12
(`powlisher-ville`, `powlisher-v2`, `powlisher-v2-dore`) passaient toutes leurs
vérifications chiffrées, et ils étaient faux quand même.

1. **Ses cibles sont mesurées**, pas choisies au jugement — et sur une source
   dont on sait ce qu'elle mesure. La « paire avant/après » du photographe est
   **écartée** : elle est passée par une IA générative.
2. **Il est regardé à l'œil**, sur de vraies photos, à côté des presets existants.
   Trois défauts ont été attrapés uniquement comme ça : le trait diagonal de
   `powlisher-v2` dans un ciel voilé, le ciel menthe de `powlisher` sur une photo
   déjà cyan, et le ciel kaki du premier jet de `powlisher-showcase`.
3. **Son smoke existe** et fige ses cibles dans `npm run test:vision-preset`.
4. **Il n'ajoute pas de contour** : le test « amplification dans un voile » borne
   chaque preset au niveau de `powlisher` (3,03×).

## Les photos de test

**Unsplash** ([unsplash.com](https://unsplash.com)) est la bonne source : photos
de qualité, souvent **peu retouchées**, libres d'usage. C'est le point clé — les
photos du corpus `@powl_d` sont **déjà ses édits finis**, donc les repasser dans
un preset revient à étaler deux fois le même traitement. Pour juger un preset, il
faut une entrée honnête.

Les photos de test ne vont **pas dans le dépôt**. On les garde en local
(`~/Desktop/devimage/` par exemple) et on regarde :

```bash
node scripts/planche-presets.mjs ~/Desktop/devimage/*.jpg
node scripts/mesure-ciel-powlisher.mjs --photo <photo>
node scripts/compare-vision-presets-on-photos.mjs <photo...>
```

`planche-presets.mjs` montre la **LUT seule**. Pour juger les effets non-LUT
(grain, vignetage, relief, texture), il faut le vrai moteur :

```bash
node scripts/planche-showcase.mjs        # rend dans un Chromium, effets compris
```

Elle sort deux planches : le **cadre entier** (pour le vignetage et le look) et
un carré **à 1:1, jamais redimensionné** — parce que réduire une image *moyenne*
son grain, et qu'une planche réduite mentirait sur ce qu'elle montre.

## Où la règle est inscrite

- Ce fichier (la liste).
- L'en-tête de chaque preset validé dans `visionPresets.js`.
- [todo.md](../todo.md), tableau des presets.
- [AGENTS.md](../AGENTS.md), règles de modification.
- Le journal daté de [map.md](../map.md).
