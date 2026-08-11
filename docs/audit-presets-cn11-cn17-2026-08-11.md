# CN11, CN17 et `powlisher` — mesures et verdict (2026-08-11)

Capture réelle des presets Adobe « Style : cinéma II » depuis Lightroom cloud
desktop, par Hald CLUT. Méthode et pièges : [importer-un-preset-lightroom.md](importer-un-preset-lightroom.md).

---

## Ce que la capture a coûté en fidélité

| | rugosité brute | après `--lisser 1` | bandes (pire cas) |
|---|---|---|---|
| CN11 | 1,66/255 | 0,89 | 5/255 |
| CN17 | **15,60/255** | 1,73 | 5/255 |

CN17 contient du **grain marqué** : sa table capturée était du bruit autant
qu'une transformation. Sans lissage, elle aurait donné des bandes visibles.

Sur les 5/255 de bandes restants, la moitié n'est **pas** de notre fait : dans
la mesure Lightroom brute, le même dégradé saute déjà de 2,8/255 (CN11, ciel) et
5,9/255 (CN17, gris). Le reste (~2/255) est le prix de la table 33³.

## Fidélité à Lightroom, sur une vraie photo

CN11 sur une terrasse plein soleil (2252×4000), contre l'export Lightroom :
**1,70/255 sur la couleur** (blocs 16×16), 4,53/255 pixel à pixel. L'écart
résiduel est de la haute fréquence — grain, clarté, netteté — qu'une table de
couleurs ne peut pas porter. La couleur, elle, est exacte.

## Ce que chaque preset fait à de vraies photos

Sur 8 photos, 1 pixel sur 7 :

| | force du look | **écrêtage ajouté** | écrêtage total | ciel | végétation |
|---|---|---|---|---|---|
| `powlisher` | 6,79/255 | **−6,47 %** | **0,32 %** | −35,7° −5,9 % sat | −5,0° −7,3 % sat |
| CN11 | 14,81/255 | +3,97 % | 10,76 % | −20,9° **+23,9 % sat** | +17,4° +3,1 % sat |
| CN17 | 13,39/255 | **+12,51 %** | **19,30 %** | **−61,9°** +18,8 % sat | +11,1° +19,7 % sat |

> ⚠️ **Ce tableau a d'abord été mal lu, deux fois.** Il se lit avec les deux
> sections qui suivent, pas seul. L'écrêtage n'est **pas** une mesure de qualité
> tant qu'on ne l'a pas comparé à celui de Lightroom sur la même photo.

`powlisher` est nettement plus doux et **retire** de l'écrêtage (il rattrape des
pixels déjà brûlés dans l'original). CN11 et CN17 en ajoutent — mais Lightroom
aussi, exactement autant (voir plus bas).

### Première erreur de lecture : blancs contre noirs

La première version de cet audit disait que CN17 « détruit les blancs ». **C'est
faux.** En séparant les deux bouts de l'échelle :

| | ≥1 canal à 255 | ≥1 canal à 0 | blanc mort | noir mort |
|---|---|---|---|---|
| original | 2,10 % | 5,50 % | 0,01 % | 0,00 % |
| `powlisher` | 0,00 % | 0,26 % | 0,00 % | 0,00 % |
| CN11 | 2,43 % | 4,66 % | 0,00 % | 0,00 % |
| CN17 | **1,07 %** | **18,40 %** | 0,00 % | 0,00 % |

CN17 écrête **moins** les blancs que la photo d'origine. Ce qui était compté,
c'était du **noir** — précisément le canal bleu écrasé dans les tons chauds. Et
aucun pixel n'est réellement mort (les trois canaux à 0 ou 255 : 0,00 % partout).

Leçon de méthode : une métrique d'écrêtage qui additionne 0 et 255 ne veut rien
dire. `compare-vision-presets-on-photos.mjs` les compte encore ensemble — lire
le détail avec le tableau ci-dessus avant de conclure quoi que ce soit.

### Seconde erreur de lecture : l'intensité — la fausse bonne idée, annulée

Constatant que CN11/CN17 écrasent le canal bleu dans les ombres sur 7 à 19 % des
pixels, on a d'abord baissé leur intensité par défaut (85 et 90). L'écrêtage
tombait à ~1,3 % pour ~90 % du look. **C'était une erreur, et la vérification qui
manquait la démontre :**

| | pixels avec un canal à 0 ou 255 | écart à Lightroom |
|---|---|---|
| photo d'origine | 9,54 % | — |
| **Lightroom lui-même, CN11 à 100 %** | **22,74 %** | — |
| nous à 100 % | 24,10 % | **4,53/255** |
| nous à 85 % | 2,57 % | 4,64/255 |

**Lightroom écrase autant que nous.** Ces ombres denses ne sont pas un defaut de
notre moteur : c'est le preset, et c'est voulu. Baisser l'intensite « corrigeait »
donc quelque chose qui n'etait pas casse, et **eloignait** le rendu de Lightroom.

Pire, ca change le look d'une facon que l'oeil detecte tout de suite : baisser
l'intensite ne reduit pas le contraste, ca **melange l'image traitee avec
l'image d'origine**. Les couleurs du preset se diluent dans les couleurs neutres
du JPEG — d'ou une impression de couleur delavee, tirant vers le vert dans les
ombres. C'est ce qu'a signale le porteur du projet en regardant les rendus, avant
qu'on ait les chiffres.

**Regle qui en decoule** : `recommendedIntensity` d'un preset **importe** doit
rester a **100**. Le curseur reste disponible pour l'utilisateur, mais le defaut
d'un preset capture, c'est le preset. L'intensite est un choix esthetique offert
a l'utilisateur, pas un correctif technique.

(La metrique d'ecretage seule ne dit donc rien de la qualite : il faut la
comparer a celle de Lightroom sur la meme photo. Un preset qui ecrase moins que
sa reference n'est pas meilleur, il est juste different.)

Teste et ecarte aussi : un garde-fou relevant le pied de courbe avant le preset.
Meme a 6 % il ne descend qu'a 5,6 % d'ecretage et il delave les noirs.

## Verdict

**Les trois sont utilisables, tous à 100 % par défaut.** CN11 et CN17 rendent
comme dans Lightroom, ombres denses comprises — c'est leur look, pas un défaut.

`powlisher` reste le plus doux et le plus sûr sur du JPEG (il *récupère* des
pixels déjà brûlés au lieu d'en perdre), mais ce n'est plus un argument contre
les deux autres.

**Le seul écart qui reste avec Lightroom est spatial** : clarté, texture,
netteté, grain, vignetage — 2,8/255 des 4,53/255 mesurés. Une table de couleurs
ne peut pas les porter. Ils se récupèrent via le `.xmp` du preset, et c'est le
seul travail restant pour une reproduction complète.

Ce que CN11 apporte quand même, et ce n'est pas rien : une **référence de
calibration exacte**, mesurée, du rendu d'Adobe. C'est là-dessus qu'on peut
régler nos propres presets.

À garder en tête : les photos de référence les plus récentes ne sont pas faites
avec CN11/CN17 mais avec les presets personnels du photographe. CN11 n'est donc
probablement pas la cible — c'est un point de départ.

## Licence — à trancher avant toute mise en ligne

Vibe_fx V2 est destiné à être **public**. Embarquer la table d'un preset Adobe
sous son nom (« CN11 », « CN17 ») dans un produit commercial est un risque réel :
un *look* ne s'approprie pas, une bibliothèque de presets sous licence si.

Pour tester et calibrer en interne : aucun souci. Pour la production : soit on
retire ces deux presets, soit on s'en sert uniquement comme référence pour
construire les nôtres, publiés sous nos propres noms.
