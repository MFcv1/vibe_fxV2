# CN11, CN17 et `powlisher` — mesures et verdict (2026-08-11)

Capture réelle des presets Adobe « Style : cinéma II » depuis Lightroom cloud
desktop, par Hald CLUT. Méthode et pièges :
[2-methode-et-pieges.md](2-methode-et-pieges.md).

> **Ce document a été refait après trois erreurs de mesure.** Elles sont
> conservées en bas, parce que chacune était crédible et qu'un prochain agent les
> referait. En particulier : **aucun chiffre d'écrêtage ne veut dire quoi que ce
> soit** tant qu'on ne l'a pas comparé à celui de Lightroom sur la même photo.

---

## Fidélité à Lightroom

CN11 sur une photo de terrasse plein soleil (2252×4000), contre l'export
Lightroom de la même photo :

| Échelle | Écart |
|---|---|
| pixel par pixel | 2,67/255 (médiane **1**) |
| blocs 4×4 | 1,25/255 |
| **blocs 16×16 — la couleur seule** | **0,64/255** |
| dans les noirs (luminance < 20) | 1,32/255 |

**La couleur est indiscernable de Lightroom.** Ce qui reste au niveau du pixel
est la **Netteté 40** que Lightroom applique par défaut à toute image, et qu'une
table de couleurs ne peut pas porter par construction.

## Qualité des captures

| | rugosité | bandes (pire cas) | lissage |
|---|---|---|---|
| CN11 | 0,89/255 | 5/255 | aucun |
| CN17 | 4,70 → **0,69** | 3/255 | `--lisser 1` |

CN17 contient du **grain** — un bruit aléatoire par pixel, que la mire en blocs
ne peut pas absorber. CN11 n'en a pas.

Sur les 5/255 de bandes de CN11, la moitié n'est **pas** de notre fait : dans la
mesure Lightroom brute, le même dégradé saute déjà de 2,8/255. Le reste est le
prix de la table 33³. Aucune bande visible sur les rendus réels.

## Ce que chaque preset fait à de vraies photos

Sur 3 photos (terrasses, ciel dégagé), 1 pixel sur 7 :

| | force du look | écrêtage ajouté | écrêtage total | ciel | végétation |
|---|---|---|---|---|---|
| `powlisher` | 7,50/255 | −7,97 % | 0,14 % | −28,8° −8,9 % sat | −5,8° −8,3 % sat |
| CN11 | 13,03/255 | +9,88 % | 17,99 % | −3,5° **+33,4 % sat** −16,1 % lum | +0,7° −17,0 % sat |
| CN17 | 12,58/255 | **−2,69 %** | 5,42 % | −16,9° +29,5 % sat −16,1 % lum | +11,0° +3,8 % sat |

Repère indispensable : sur cette photo, **Lightroom lui-même écrête 22,74 %** des
pixels sous CN11 (contre 24,10 % chez nous, et 9,54 % dans l'original). Les
ombres denses de CN11 sont donc **le preset**, pas un défaut de notre moteur.

`powlisher` est le plus doux et le seul à *retirer* de l'écrêtage : il rattrape
des pixels déjà brûlés dans l'original.

## Verdict

**Les trois sont bons, tous à 100 % d'intensité par défaut.** CN11 et CN17
rendent comme dans Lightroom, ombres denses comprises.

- `powlisher` : le plus doux, construit pour du JPEG 8 bits, ne détruit rien.
- CN11 : ciel très saturé (+33 %) et assombri, végétation désaturée. Look fort.
- CN17 : plus chaud (bleu −29 sur l'axe des gris), ciel tiré vers le teal, et
  c'est **celui qui écrête le moins** des deux.

Le seul écart restant avec Lightroom est **spatial** : la Netteté 40. Elle se
branche via `filters.sharpness` — c'est le prochain gain disponible, et le
dernier.

À garder en tête : les photos de référence les plus récentes ne sont pas faites
avec CN11/CN17 mais avec les presets personnels du photographe. CN11 est un point
de départ mesuré, pas la cible.

## Licence — à trancher avant toute mise en ligne

Vibe_fx V2 est destiné à être **public**. Embarquer la table d'un preset Adobe
sous son nom (« CN11 », « CN17 ») dans un produit commercial est un risque réel :
un *look* ne s'approprie pas, une bibliothèque de presets sous licence si.

Pour tester et calibrer en interne : aucun souci. Pour la production : soit on
retire ces deux presets, soit on s'en sert uniquement comme référence pour
construire les nôtres, publiés sous nos propres noms.

---

## Les trois erreurs, et ce qu'elles apprennent

**1. « CN17 détruit les blancs. »** Faux. La métrique additionnait les canaux à 0
et à 255. Séparés : CN17 écrête *moins* les blancs que la photo d'origine
(1,07 % contre 2,10 %) ; ce qui était compté, c'était du **noir**. Une métrique
d'écrêtage qui mélange les deux bouts de l'échelle ne veut rien dire.

**2. « Il faut baisser l'intensité par défaut. »** Faux. Baisser à 85/90 faisait
tomber l'écrêtage de 6,93/19,48 % à ~1,3 % — mais **Lightroom écrête autant que
nous**, donc on corrigeait un non-problème, et on s'*éloignait* de la référence
(4,64/255 contre 4,53). Pire, l'œil le voit : baisser l'intensité ne réduit pas
le contraste, ça **mélange l'image traitée avec l'originale**, donc les couleurs
du preset se diluent dans les couleurs neutres du JPEG — d'où une impression de
couleur délavée, tirant vers le vert dans les ombres. Signalé par le porteur du
projet en regardant les rendus, avant qu'on ait les chiffres.

**Règle** : `recommendedIntensity` d'un preset **importé** reste à **100**. Le
curseur est un choix esthétique offert à l'utilisateur, jamais un correctif
technique.

**3. « La mire à un pixel par couleur est fidèle. »** Faux, et c'est la plus
grosse. Les couleurs y bavaient les unes sur les autres, ce qui virait les ombres
au **vert** de façon visible. Détail et chiffres dans
[2-methode-et-pieges.md](2-methode-et-pieges.md#pourquoi-la-mire-est-en-blocs-et-pourquoi-ça-nest-pas-négociable).

Deux fausses pistes ont été éliminées en chemin, chacune par une mesure :
Clarté/Texture (tous à 0 dans CN11) et Netteté (la passer de 40 à 0 donnait une
mire **identique au bit près**). Ce qui a tranché : Lightroom appliquait bien une
fonction **pixel par pixel** à la photo (sortie stable à ±1,9/255 pour une même
couleur d'entrée) — donc le preset était capturable, et le coupable ne pouvait
être que la mire.

**Et une conséquence rétroactive** : les mesures qui condamnaient CN17
(« +12,51 % d'écrêtage ajouté, 19,3 % au total ») étaient l'artefact de cette
mire. Correctement capturé, CN17 en **retire** 2,69 %. Le jugement à l'œil du
porteur du projet — « CN17 est mon préféré, je ne vois pas les blancs cassés » —
était juste, et les chiffres avaient tort.
