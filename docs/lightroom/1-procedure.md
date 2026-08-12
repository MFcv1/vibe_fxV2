# Capturer un preset Lightroom — la procédure

**C'est la marche à suivre exacte, celle qui a produit CN11 et CN17.** Suis-la
dans l'ordre : chaque étape existe parce qu'on s'est planté dessus au moins une
fois. Le *pourquoi* est dans [2-methode-et-pieges.md](2-methode-et-pieges.md).

Deux rôles, et ils ne se mélangent pas :

- **Toi (ou l'utilisateur)** : tout ce qui se passe **dans Lightroom**. Un agent
  ne peut pas le faire — Lightroom cloud n'est pas pilotable (vérifié :
  `NSAppleScriptEnabled = false`, aucun dictionnaire de script, pas de CLI).
- **L'agent** : générer, mesurer, importer, vérifier.

Compte 15 minutes pour un preset. Le contrôle (étape 0) ne se fait qu'**une fois
par machine**, pas à chaque preset.

---

## Étape 0 — Le contrôle. Une seule fois, et il ne se saute pas.

Prouver que Lightroom ne décale pas les couleurs **tout seul**. Sans ça, toutes
les captures seraient fausses **sans que rien ne le signale**.

```bash
npm run preset:mire
```

→ écrit `presets-lightroom/hald-clut-neutre-niveau8-bloc4.png` (2048×2048).

**Dans Lightroom :**

1. Importer la mire (glisser-déposer dans la fenêtre suffit).
2. **Ne lui appliquer RIEN.** Aucun preset, aucun curseur, pas de recadrage.
3. Exporter (icône partage en haut à droite → **Exporter en tant que…**) :

| Réglage | Valeur |
|---|---|
| Type d'image | **PNG** |
| Dimensions | **Taille réelle** |
| Espace colorimétrique | **sRVB** ⚠️ |
| Netteté de sortie | **Aucun** |
| Sortie HDR | décochée |
| Filigrane | décoché |

> ⚠️ **sRVB**, pas Adobe RVB. C'est le réglage qui a fait échouer notre premier
> essai, et il revient à chaque export. Vérifie-le à chaque fois.
>
> Destination : **pas** le dossier `presets-lightroom` — Lightroom garde le nom
> du fichier et écraserait la mire d'origine.

**Puis on mesure :**

```bash
npm run preset:controle -- <le-fichier-exporté.png>
```

| Écart à l'identité | Verdict |
|---|---|
| ≤ 2/255 | parfait, on capture |
| 3 à 8/255 | acceptable, mais à noter — ça se retrouvera dans chaque preset |
| > 8/255 | **stop** : espace d'export, profil appliqué à l'import, netteté de sortie |

> Mesuré le 2026-08-11 sur Lightroom cloud desktop (macOS) : **0,018/255 de
> moyenne, 2/255 au max**.

---

## Étape 1 — Capturer le preset

**Dans Lightroom, sur la même mire :**

1. Ouvrir le panneau **Paramètres prédéfinis**. Il n'est **pas** dans la colonne
   des réglages : c'est l'icône **« … »** de la barre verticale tout à droite, ou
   **Maj + P**.
   > Ne pas confondre avec **Profil → Parcourir**, qui montre des *profils*
   > (« Inspiré d'un film 01… »). Ce n'est pas la même chose.
2. Onglet **Premium** → groupe **Style : cinéma II** → cliquer **CN11**
   (survoler ne fait qu'un aperçu, il faut cliquer).
3. **Rien d'autre.** Aucun curseur touché par-dessus.
4. **RELEVER LES EFFETS NON-LUT** — étape obligatoire, voir juste en dessous.
5. Réexporter avec **exactement** les réglages de l'étape 0.

### Étape 1 bis — Relever ce qu'une table de couleurs ne peut pas contenir

**Un preset Lightroom n'est pas que de la couleur.** Constaté sur le pack
« Cinéma II » : **CN11 n'a aucun effet**, mais **CN17 pose un Grain 15**, et la
**Netteté reste à 40** sur les deux (c'est le défaut de Lightroom, pas le
preset). D'autres familles bougent la texture, la clarté ou le noir et blanc.

Ces réglages dépendent des **pixels voisins** ou de la **position** dans
l'image : une Hald CLUT ne les voit pas, et pire, **le grain POURRIT la
capture** — il bruite chaque pastille de la mire, donc la table mesurée devient
fausse. (C'est ce que détecte la « rugosité » du rapport d'import, et à quoi sert
`--lisser`.)

**La bonne méthode, dans l'ordre :**

1. Appliquer le preset à la mire.
2. **Relever** les valeurs des panneaux ci-dessous.
3. **Remettre à 0** dans Lightroom tout ce qui est spatial (Grain surtout) avant
   d'exporter la mire → la table capturée est propre, sans `--lisser`.
4. Redéclarer ces valeurs dans `spatialFilters` du preset importé.

**Les panneaux à ouvrir et à relever, à chaque preset :**

| Panneau Lightroom | Réglage | Notre clé |
|---|---|---|
| **Effets** | Texture | (pas encore branché) |
| **Effets** | Clarté | `clarity` |
| **Effets** | Correction du voile | `dehaze` |
| **Effets** | Vignette | `vignette` |
| **Effets** | **Grain** | `grain` |
| **Détail** | Netteté | `sharpness` |
| **Détail** | Réduction du bruit | (pas branché) |
| En-tête | **N&B** activé ? | `saturation: 0` |
| En-tête | Profil (Couleur / autre) | — noter, ça change la base |

> ⚠️ **Lightroom n'est pas pilotable** (pas d'AppleScript, pas de CLI sur la
> version cloud). L'agent ne peut donc PAS lire ces valeurs lui-même : il doit
> **les demander**, capture d'écran des panneaux à l'appui. C'est une étape du
> protocole, pas un détail — un preset importé sans ce relevé rend une couleur
> juste et un rendu incomplet.

**Le `.xmp`, quand il est disponible**, porte déjà ces valeurs
(`crs:GrainAmount`, `crs:Texture`, `crs:Clarity2012`, `crs:Dehaze`,
`crs:PostCropVignetteAmount`, `crs:Sharpness`) et
[xmpPreset.js](../../src/features/vibefx-studio/utils/xmpPreset.js) les lit déjà.
Les presets **Premium** d'Adobe ne s'exportent pas en `.xmp` : pour eux, c'est le
relevé à l'écran qui fait foi.

**Ce qui n'est capturable d'AUCUNE façon** : les **masques** (ciel, sujet,
dégradés, masques IA). Ils dépendent du contenu de la photo — une mire de
couleurs n'a ni ciel ni sujet. Si le panneau **Masquage** d'un preset n'est pas
vide, la capture sera fausse **sans le signaler**. À vérifier avant d'importer.

### Ce qui EST capturé, et qu'on n'a donc pas à relever

Tout ce qui transforme un pixel **en fonction de sa seule couleur** est déjà dans
la table, fondu dedans. Inutile de le noter, inutile de le rejouer :

> Exposition, Contraste, Hautes lumières, Ombres, **Blancs, Noirs**, la **Courbe**
> (maître et par canal), le mélangeur **TSL**, l'**étalonnage**, le **virage
> partiel**, la conversion **N&B**, et le **Profil** (« Moderne 01 », « Adobe
> Couleur »…). Un profil est lui-même une table de couleurs : la mire l'avale
> sans rien de plus.

C'est la force de la méthode : elle capture le **résultat**, pas la liste des
curseurs. La question qui trie, à chaque réglage : *a-t-il besoin de regarder les
pixels voisins ou la position dans l'image ?* Non → la mire s'en occupe. Oui →
c'est un effet spatial, à relever. Ça dépend du sujet → non capturable.

### ⚠️ Le piège des réglages « Auto »

Certains presets Premium n'affichent pas « Exposition » mais « **Auto**
Exposition », « **Auto** Blancs », « **Auto** Noirs », avec des valeurs non
nulles (vu sur la famille **FT / « inspiré d'un film »** : Auto Blancs +14, Auto
Noirs +35).

Un réglage « Auto » est **calculé à partir de la photo elle-même**. Or
l'histogramme de la mire — un damier de 262 144 couleurs réparties uniformément —
ne ressemble à aucune photo : l'Auto y calculerait tout autre chose que sur une
vraie image. **La table capturée serait fausse, sans que rien ne le signale.**

**Le test, trente secondes :** appliquer le preset à deux photos très
différentes (une sombre, une claire) et regarder ces nombres. S'ils **changent**,
le preset s'adapte à l'image et n'est pas capturable tel quel.

Deux issues, au choix : **écarter** ces presets, ou les capturer **Auto remis à
0** — en sachant qu'on fige alors une version qui ne s'adapte plus. C'est un
choix produit, à trancher avant d'en importer une série.

**Puis on importe :**

```bash
npm run preset:import -- \
  --hald  presets-lightroom/cn11.png \
  --id    cn11 \
  --label "CN11" \
  --hint  "Ciel bleu profond, verts sobres" \
  --bestFor "paysage, mer, ciel dégagé, architecture"
```

Le preset apparaît immédiatement dans `/creer/vision`.

**Lire le rapport d'import, deux chiffres comptent :**

- **écart mesuré** — s'il est nul, aucun preset n'était appliqué. L'import refuse.
- **rugosité** — au-dessus de **3/255**, le preset contient du **grain**.
  Réimporter en ajoutant `--lisser 1`, et récupérer le grain à sa vraie place
  (effet spatial) plutôt que figé dans la table.

---

## Étape 2 — Vérifier. Pas se contenter de « import réussi ».

```bash
npm run test:vision-preset          # 40 vérifications
node scripts/audit-vision-presets.mjs cn11
```

Dans l'audit, la ligne qui compte est **BANDES** : c'est le risque n°1 d'une
table de couleurs. Au-dessus de 5/255, regarder un grand ciel lisse à l'œil.

**Et la seule validation qui tranche vraiment** — la même photo développée des
deux côtés :

1. Choisir une photo **JPEG** avec du ciel (le pire cas).
2. Dans Lightroom : lui appliquer le preset, exporter en **JPEG qualité max**,
   Taille réelle, sRVB, netteté « Aucun ».
3. Mesurer :

```bash
node scripts/compare-preset-vs-lightroom.mjs <origine.jpg> <version-lightroom.jpg> cn11
```

| Écart moyen | Lecture |
|---|---|
| ≤ 2/255 | identique à l'œil |
| 3 à 5/255 | même rendu, écart invisible en pratique |
| 6 à 10/255 | même look, visible en comparant côte à côte |
| > 10/255 | ce n'est plus le même rendu — chercher l'erreur |

L'écart ne sera **jamais nul**, et il ne doit pas l'être : Lightroom applique une
**Netteté 40** par défaut, qu'une table de couleurs ne peut pas porter. Regarde
la ligne « blocs 16×16 » du rapport : c'est la **couleur seule**, et c'est là
qu'on doit être quasi parfait.

> Sur CN11 : **0,64/255 sur la couleur**, 2,67/255 au pixel.

---

## Étape 3 — Comparer aux presets existants

```bash
node scripts/compare-vision-presets-on-photos.mjs <photo...>
```

**Attention au piège de lecture** : la colonne « écrêtage » ne veut **rien dire**
seule. Un preset qui écrête n'est pas mauvais — Lightroom écrête 22,74 % des
pixels sous CN11. Il faut comparer à Lightroom **sur la même photo**, sinon on
« corrige » le look voulu.

---

## La check-list, en une page

- [ ] `npm run preset:mire`
- [ ] Contrôle à vide fait **une fois** sur cette machine, ≤ 2/255
- [ ] Preset appliqué dans Lightroom, **et rien d'autre**
- [ ] Export : PNG · Taille réelle · **sRVB** · Netteté de sortie « Aucun »
- [ ] Exporté **ailleurs** que dans `presets-lightroom/`
- [ ] `npm run preset:import` — écart non nul, rugosité < 3 (sinon `--lisser 1`)
- [ ] `npm run test:vision-preset` vert
- [ ] `audit-vision-presets.mjs` — bandes ≤ 5/255
- [ ] `compare-preset-vs-lightroom.mjs` sur une vraie photo — couleur < 1/255
- [ ] `recommendedIntensity` laissé à **100**
- [ ] Vignettes regardées dans `/creer/vision`, sur une photo avec grand ciel
