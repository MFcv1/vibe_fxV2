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
4. Réexporter avec **exactement** les réglages de l'étape 0.

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
