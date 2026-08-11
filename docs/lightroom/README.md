# Lightroom → Vibe_fx

Tout ce qui concerne l'import d'un preset Lightroom dans l'app. Trois documents,
dans l'ordre où on en a besoin.

| | Quoi | Quand le lire |
|---|---|---|
| **[1-procedure.md](1-procedure.md)** | La marche à suivre, clic par clic, plus une check-list | **À chaque import.** C'est le seul dont on a besoin en pratique. |
| [2-methode-et-pieges.md](2-methode-et-pieges.md) | Pourquoi ça marche, ce que la méthode ne peut pas capturer, et les pièges mesurés | Quand un chiffre surprend, ou pour toucher à la chaîne |
| [3-cn11-cn17-mesures.md](3-cn11-cn17-mesures.md) | Les mesures de CN11, CN17 et `powlisher`, le verdict, la licence, et les erreurs commises | Pour comparer des presets, ou avant une mise en ligne |

---

## L'idée, en trois phrases

Reproduire un preset Lightroom en recopiant ses curseurs donne un rendu
**différent** : Lightroom travaille sur du RAW linéaire, nous sur du JPEG déjà
développé. Alors on ne recopie pas — **on fait faire le calcul à Lightroom et on
lit le résultat**.

On lui donne une image contenant **une fois chaque couleur** (une *Hald CLUT*),
on lui applique le preset, et l'image qui ressort **est** la table de conversion
du preset. Il n'y a plus rien à deviner.

## Les commandes

```bash
npm run preset:mire                                  # génère la mire (2048×2048)
npm run preset:controle -- <mire-réexportée.png>     # contrôle à vide de Lightroom
npm run preset:import -- --hald <x.png> --id <id> --label <L> [--lisser 1]

node scripts/audit-vision-presets.mjs [id...]                   # bandes, dominante
node scripts/compare-vision-presets-on-photos.mjs <photo...>    # écrêtage, force
node scripts/compare-preset-vs-lightroom.mjs <src> <lr> <id>    # fidélité réelle
```

## Les cinq règles qui ont coûté cher

1. **La mire est en blocs de 4×4 pixels.** Une couleur par pixel fait baver les
   couleurs entre voisines : invisible dans les clairs, ruineux dans les noirs,
   qui virent au **vert**.
2. **Export en sRVB.** Lightroom propose Adobe RVB par défaut. En Adobe RVB, la
   table est fausse d'un bout à l'autre **sans aucun signe**.
3. **Le contrôle à vide se fait avant toute capture.** Une fois par machine.
4. **Tout preset reste à `recommendedIntensity: 100`** — importé comme écrit à
   la main. Baisser l'intensité ne réduit pas le contraste, ça mélange l'image
   traitée avec l'originale : ça délave les couleurs et ça éloigne de la
   référence. Le curseur est un choix esthétique offert à l'utilisateur, jamais
   un correctif technique.
5. **Un chiffre d'écrêtage ne veut rien dire seul.** Il se compare à celui de
   Lightroom sur la même photo, jamais dans l'absolu.

## Ce qui est capturé, et ce qui ne l'est pas

| | |
|---|---|
| **Capturé exactement** | exposition, contraste, courbes, mélangeur TSL, étalonnage, virage, saturation — la quasi-totalité d'un *look* |
| **Pas capturable** | clarté, texture, netteté, grain, vignetage — tout ce qui dépend des pixels voisins. Récupéré séparément via le `.xmp`, en effets spatiaux |
| **Hors périmètre** | masques, corrections locales, corrections d'objectif |

## État au 2026-08-11

Trois presets dans `/creer/vision`, tous à 100 % d'intensité :

| Preset | Origine | Fidélité couleur | Rugosité |
|---|---|---|---|
| `powlisher` | écrit à la main, mesuré sur 19 photos | cibles atteintes à 100 % | — |
| `cn11` | capturé de Lightroom | **0,64/255** | 0,89 |
| `cn17` | capturé de Lightroom | — | 4,70 → 0,69 (`--lisser 1`) |

⚠️ **CN11 et CN17 portent leurs noms Adobe.** Sain pour calibrer en interne ;
à trancher avant toute mise en ligne publique. Voir
[3-cn11-cn17-mesures.md](3-cn11-cn17-mesures.md#licence--à-trancher-avant-toute-mise-en-ligne).
