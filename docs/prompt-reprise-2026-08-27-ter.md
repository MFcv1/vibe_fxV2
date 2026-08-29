# Prompt de reprise — après `couchant`

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`
Branche : `presets-mesures-sur-corpus`

## Lis, dans cet ordre, et rien d'autre

1. `AGENTS.md`
2. `todo.md` (224 lignes, il est à jour)
3. `docs/presets-valides.md`
4. `docs/pieges-connus.md`
5. `map.md`, **uniquement** le journal du 2026-08-27 ter
   (`grep -n "2026-08-27 ter" map.md`, puis `sed -n`)

N'ouvre ni les archives, ni les autres prompts de reprise, ni `map.md` en entier
(3 700 lignes). Le budget de contexte est la vraie contrainte du projet.

## Où on en est

Le moteur Vision porte **20 presets**. `npm run test:vision-preset` : **197**
vérifications, toutes vertes. `npm run lint` : 0 erreur (5 avertissements
préexistants, aucun dans les fichiers touchés).

Le dernier livré est **`couchant`**, et c'est le premier preset du projet mesuré
contre des **couchers de soleil** et non contre des scènes de plein jour.

## CE QUI ATTEND, ET C'EST LA PREMIÈRE CHOSE

**`couchant` n'est pas validé.** Il n'entre pas dans `docs/presets-valides.md`
tant que le porteur du projet ne l'a pas regardé. Le point à trancher est précis :

> il retire la saturation « carte postale » (×0,71 mesuré dans les médians).
> Sur un ciel magenta, le retrait du rose est net et c'est le but. Sur un soleil
> doré, il **éteint l'or**. Est-ce la sobriété visée, ou est-ce trop ?

```bash
node scripts/ciel-couchant-1-1.mjs couchant,ambre,powlisher-cine
node scripts/juger-vers-modele.mjs --presets couchant --modele ~/Desktop/powlisher-biblio/modele-couchant --n 3
```

## Ce qui a été construit et qui resservira

Un **tas neutre de couchants** — il manquait au projet, et sans lui rien de tout
ceci n'était mesurable. `~/Desktop/powlisher-biblio/neutre/` porte maintenant
`coucher-mer` (35), `coucher-paysage` (31), `coucher-ville` (31),
`heure-bleue` (43).

Trois défauts y ont été trouvés **à la planche**, chacun corrigé dans
`moissonner-neutre.mjs` — et le troisième est le plus instructif :

- Commons indexe par **lieu**, pas par heure → le titre doit nommer l'heure ;
- « sunset » titre des centaines de **toiles de musée** → filtre négatif + œil ;
- **vingt vues de la même ville depuis la même colline** → au plus 3 photos par
  téléverseur. Une détection par empreinte avait été essayée d'abord et **jetée** :
  sur des couchants, qui ont tous un ciel clair en haut et un sol sombre en bas,
  une empreinte 8×8 ne décrit presque plus rien.

## Les pièges déjà payés — ne les refais pas

Ils sont dans `docs/pieges-connus.md` et dans les journaux `map.md`. Les trois
qui touchent ce chantier :

1. **Un axe qui se mord la queue** — un axe se calcule sur un seul jeu de
   variables ; l'autre se mesure après coup sur les pôles ainsi formés.
2. **Un rapport de saturation qui mesure le décor** — teinte par teinte, jamais
   en brut. Aucun pôle de son corpus n'augmente la saturation.
3. **Un transport de quantiles emporte l'exposition du tas qui l'a produit** —
   **SAUF** si les deux tas montrent la même scène. C'est ce que `couchant` a
   établi : point blanc 215 côté couchants neutres contre 207 chez lui, l'écart
   d'exposition disparaît, et le transport redevient utilisable tel quel.

Et un quatrième, trouvé ici : **un étalonnage pris sur les quasi-gris d'un
couchant compte deux fois le virage du ciel**, parce que les quasi-gris du haut
sont du ciel pâle, déjà traité par la rotation de teinte.

## Mission suivante, par ordre

1. **Faire regarder `couchant`** (ci-dessus). S'il est gardé, l'ajouter à
   `docs/presets-valides.md` avec sa date.
2. **Les trois registres abandonnés** (`heure-bleue`, `contre-jour`,
   `heure-dorée` séparée). Ils ne manquent pas d'idée, ils manquent de
   **matière** : 23 couchants dans 320 photos, une seule photo d'heure bleue.
   Si le porteur du projet pose 40 couchants de plus dans un dossier, la chaîne
   se rejoue en trois commandes :
   ```bash
   node scripts/grouper-couchants.mjs
   node scripts/mesurer-variante.mjs --liste ~/Desktop/powlisher-biblio/couchants-lui.json --nom couchant --min 4
   node scripts/juger-vers-modele.mjs --presets couchant --modele ~/Desktop/powlisher-biblio/modele-couchant --n 3
   ```
   (`grouper-couchants.mjs` porte la sélection à l'œil en dur : c'est là qu'on
   ajoute les nouvelles photos.)
3. **La faiblesse mesurée de `couchant`** : il ne bouge presque pas la teinte du
   ciel (3 % du chemin contre 48 % à `powlisher-cine`). La cause est une
   interaction entre deux grandeurs **mesurées** — sa coupe de chroma désature le
   ciel sous le seuil où la rotation de teinte s'applique pleinement
   (`smoothstep(3, 14)`). La corriger veut dire écraser l'une des deux mesures :
   à ne faire que sciemment, et à écrire.
4. **L'étage de tonalité adaptatif** — le vrai gros reste, décrit dans `todo.md`.

## Interdits

- Ne supprime, ne remplace, ne « corrige » aucun preset de
  `docs/presets-valides.md`. Un variant s'**ajoute** à côté.
- N'utilise que des opérations que Lightroom sait faire : courbe, rotations de
  teinte d'angle fixe, saturation par plage, étalonnage. **Aucun attracteur**,
  aucun seuil dur.
- Aucune pente de courbe sous **1/8**, le pas d'entrée de la LUT.
- **Aucun écrêtage** : 0,00 % de pixels à 255.
- Juge à l'œil sur des photos **neutres**, jamais sur les siennes.
- Aucun sous-agent, aucun déploiement. Ne lis pas de fichiers entiers.

## Rituel de fin de phase

`npm run lint`, les suites touchées, puis `todo.md`, `map.md` (journal daté),
`docs/presets-valides.md` si un preset est validé, et un récap en langage simple
dans le chat. **Garde `todo.md` sous ~200 lignes** : il est à 224, la marge est
mince.
