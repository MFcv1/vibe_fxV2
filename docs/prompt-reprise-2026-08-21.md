# Prompt de reprise — 2026-08-21 : FINIR LE GRAIN

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`

## A lire, dans cet ordre

1. `AGENTS.md` — regles de travail.
2. `todo.md` — chantier actif.
3. `src/features/vibefx-studio/utils/grainField.js` — **le plus important** : la
   loi du grain, ses mesures, et ce qui n'est PAS mesure. Tout ce prompt en part.
4. `docs/lightroom/1-procedure.md` — si tu importes un preset.

**Ne PAS lire** : les archives (`docs/archive-*`, `docs/prompt-reprise-*`) ni
`map.md` en entier (`grep -n` sur la zone touchee).

## La mission

**Rendre notre grain indiscernable de celui de Lightroom, sur tous les presets,
actuels et futurs.** Pas « proche » : indiscernable, et prouve par la mesure.

C'est un objectif produit, pas de la coquetterie : un preset importe capture la
couleur *exactement* (Hald CLUT). Le grain est le dernier endroit ou notre rendu
peut trahir sa copie.

## Ou on en est

Le grain est **calibre et verifie**, deux fois :

- **sur mire** (aplats unis, 6 exports Lightroom du 2026-08-20) : x1,00 sur les
  gris ;
- **sur vraie photo** (ciel de `photo-test-2`, CN14, grain 25 Taille 10) : son
  grain 4,05/255, le notre 3,83 — **5 % d'ecart, explique** (voir trou n°1).

La loi vit dans `grainField.js` : une seule echelle `e` porte la grosseur ET la
force, `e = taille(Taille) x (largeur/1620)^0,577`, et l'ecart-type vaut
`0,367 x valeur / e`. Le module n'importe rien, donc Node le charge tel quel :
les scripts de mesure appellent LE code du rendu, jamais une copie.

Vision a un **zoom** (Adapter / 100 % / 200 % / 400 %) — sans lui, on ne peut pas
juger un grain a l'oeil : a « Adapter » l'ecran moyenne les grains.

## Les trous, par ordre d'importance

### 1. SON GRAIN N'EST PAS MONOCHROME, LE NOTRE SI

**C'est le vrai chantier, et c'est lui qui reste entre nous et « indiscernable ».**

Mesure du 2026-08-20 (mire A, grain 50, `mesure-grain-lightroom.mjs`) :

| aplat | son ecart-type |
|---|---|
| gris (tous niveaux) | 18,4 |
| rouge, magenta | 23,3 |
| cyan, vert | 22,1 a 22,4 |
| bleu | 21,7 |
| jaune | 19,5 |
| peau, feuillage, beton | 18,1 a 18,9 |

Notre grain pose le meme ecart sur les trois canaux, donc la meme chose partout.
D'ou les 5 % manquants sur un ciel teal sature.

A faire :
- comprendre la LOI (est-ce la saturation ? la chroma ? un grain par canal
  partiellement decorrele ? un grain applique avant la conversion couleur ?) —
  les nombres ci-dessus sont deja dans le rapport de `mesure-grain-lightroom.mjs`,
  colonne par colonne ;
- l'implementer dans `grainField.js` / `applyFilmGrain` ;
- **verifier que les gris ne bougent pas** : ils sont a x1,00, c'est acquis.

Piste a tester en premier : un grain tire independamment par canal donnerait,
apres passage en luminance, un ecart-type plus fort sur les couleurs saturees
(ou un seul canal porte l'essentiel de la luminance) et inchange sur les gris.
C'est exactement la forme du tableau. A mesurer, pas a supposer.

### 2. La Taille 40 n'est pas mesuree

CN17 et CN18 la portent. Elle est **interpolee** entre la Taille 25 et la
Taille 50, toutes deux mesurees. Un seul export la leverait :

> mire `~/Desktop/📸 VIBEFX-IMPORTS/0-GRAIN-A-MESURER/A-IMPORTER-DANS-LIGHTROOM/mire-PETITE-1620px.png`,
> Grain **50**, Taille **40**, Cassure 50 → `0-GRAIN-A-MESURER/taille-40/`

Puis `node scripts/mesure-taille-grain.mjs <fichier> --valeur 50` et ajouter le
point dans `GRAIN_TAILLE_MESUREE`.

### 3. La « Cassure » n'a jamais ete mesuree

Elle vaut 50 partout (son defaut) sur tous les presets importes jusqu'ici, et
toute la calibration suppose cette valeur. **A verifier au releve de chaque
import** : si un preset la change, il faut la mesurer avant de la recopier.

### 4. L'exposant de largeur ne tient que sur trois tailles

0,577, ajuste sur 1620 / 3240 / 6480. **Rien n'est mesure en dessous de 1620 ni
au-dessus de 6480**, alors que les photos reelles montent a 9180. Un export de
mire a 9180 px confirmerait l'extrapolation la ou elle sert vraiment.

### 5. Le recadrage n'est pas teste

`renderStudio` prend `largeurImage = sWidth` (la portion echantillonnee), ce qui
est le bon choix — l'image finale est celle qui est exportee. Mais aucun test ne
le verifie. Un recadrage serre doit changer le grain, comme chez lui.

### 6. La reduction du bruit de Lightroom nous manque

Ses presets Cinema II posent Luminance 20 / Couleur 50. Nous n'avons rien. Sur
une photo bruitee (ISO eleve), notre rendu gardera un bruit numerique qu'il
lisse, et ce bruit s'ajoute au grain. Invisible a bas ISO, a traiter le jour ou
un preset sert sur une photo sombre.

## Les commandes

```bash
npm run preset:mire-effets            # fabrique les mires (dont la mire A)
node scripts/mesure-taille-grain.mjs <mire...> --valeur 50
node scripts/mesure-grain-lightroom.mjs --reference <a> --lightroom <b> --valeur 50
npm run test:vision-preset            # 78 verifications, ~1 s
npm run test:vibeos-vision            # 3 tests navigateur, dont le zoom
npm run test:reglages-avances         # ~2 min
npm run lint                          # 0 erreur (5 warnings preexistants)
```

## Deux pieges de mesure, payes en temps

- **Ne jamais mesurer un grain avec un voisinage etroit.** Retirer la tendance
  locale sur 3 px sous-estime un grain de 2,4 px : une partie du grain entre dans
  la moyenne et se retrouve soustraite. Un premier passage annoncait « 10 %
  d'ecart » qui n'existait pas. Elargir jusqu'a ce que la mesure se stabilise.
- **Ne pas melanger gris et couleurs dans une moyenne.** Son grain est plus fort
  sur les aplats colores : les moyenner avec les gris fait croire a 6 % d'ecart
  de force qui n'existe pas.

## Interdits

- Jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Jamais de Tailwind : CSS Modules + tokens `--vo-*`.
- Aucun deploiement, aucun sous-agent sans demande explicite.
- Les exports Lightroom sont faits **a la main par Matthis** : l'agent ne peut ni
  lire ses panneaux ni exporter a sa place. Il DEMANDE, dans le chat.

## Et apres

12 presets restent a importer : CN18, FT01, FT11, LN02, LN05, LN06, TR04, TR13,
TR14, TR15, VCR11, VCR12. Le circuit est dans
`docs/prompt-reprise-2026-08-20.md` (section « Le circuit de travail »).
`FT01`/`FT11` sont de la famille « inspire d'un film », ou des reglages **Auto**
ont deja ete vus : les tester sur deux photos avant de capturer.
