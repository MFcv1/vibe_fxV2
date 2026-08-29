# Prompt de reprise — 2026-08-29 (après la refonte du mouvement de la bibliothèque)

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`
Branche : `presets-mesures-sur-corpus`

## À lire, dans cet ordre

1. `AGENTS.md` — règles de travail, économie de contexte, rituel de fin de phase.
2. `todo.md` — chantier actif (les presets qui attendent un regard).
3. `map.md`, **journal du 2026-08-29 uniquement** — ce qui vient d'être fait sur
   la bibliothèque, et les quatre pièges trouvés en le faisant.

**Ne pas ouvrir** les archives (`docs/archive-*`) ni les autres prompts de
reprise, sauf à travailler exactement dans leur zone.

## État

- **La bibliothèque `/creer/bibliotheque` est livrée** : grille masonry avec
  apparition en vague à l'entrée dans le champ, carrousel plein écran à rail de
  largeur variable (une voisine visible de chaque côté), ouverture en fondu-zoom
  pendant que la grille recule et se floute derrière. En-tête VibeOS inchangé.
  Le clic sur la densité efface la grille et rejoue la vague. Les vignettes sont
  passées de 720 à 1600 px, et celles déjà stockées sont refabriquées à la
  demande quand une tuile réclame plus de pixels.
  Fichiers : `src/features/vibeos/library/{LibraryScreen.jsx,Lightbox.jsx,library.module.css,photoImport.js,useLibrary.js}`.
- **Le chantier actif reste les presets** : `couchant` et les six du 2026-08-27
  attendent un regard sur planches. Voir `todo.md`.

## Gates

```bash
npm run lint                 # vert
npm run test:vibeos-library  # vert : 8 EXIF + 8 masonry + 1 parcours navigateur
```

`npm run build` échoue **depuis la machine, pas depuis le code** :
`better-sqlite3` est compilé pour `NODE_MODULE_VERSION 127`, le Node installé
attend `147`. Correctif : `npm rebuild better-sqlite3`. C'est un échec
préexistant, documenté depuis le 2026-08-19.

## Interdits

- Ne jamais supprimer ni remplacer un preset de `docs/presets-valides.md`.
- Aucun déploiement sans demande explicite (Cloud Build coûte de l'argent réel).
- Pas de sous-agent sans demande explicite.
- Ne pas relire `map.md` en entier : `grep -n` puis `sed -n '<a>,<b>p'`.

## Si on retouche le mouvement de la bibliothèque

Quatre choses à ne pas défaire, chacune corrige un vrai bug mesuré :

1. La `figure` d'une tuile porte la mise en page, sa couche intérieure porte le
   mouvement. Les mélanger casse le glissement au changement de densité.
2. L'`IntersectionObserver` livre les tuiles **une par une et à l'envers** : les
   retards ne se décident qu'après accumulation sur une image, triés par
   `data-position`.
3. L'écart entre diapositives du carrousel vit dans `--vo-slide-gap`, lu à la
   fois par le calcul JS et par le `column-gap` du rail. Deux sources = photo
   décentrée.
4. Les animations d'entrée du carrousel ne durent que 1,2 s (`data-state`
   `open` → `idle`), sinon le zoom se rejoue à chaque changement de photo. Elles
   vivent sur `.slideEnter`, PAS sur `.slideFrame` : le cadre porte l'état de
   repos calculé depuis `--d`, et une animation qui finirait ailleurs qu'à
   l'identité ferait sauter les voisines quand elle est retirée.
5. La courbe des apparitions est une **cubique** sortante
   (`--vo-ease-reveal`), pas une exponentielle. Relevé sur la vidéo de
   référence : à 27 % de la durée, la tuile est à 66 % de sa course. Avec une
   exponentielle, elle y serait à 90 % et le mouvement se lirait comme un
   clignotement — c'était le premier reproche de l'utilisateur.
6. `ensurePreview` refabrique une vignette **à la demande d'une tuile
   affichée**, jamais en masse au démarrage.
7. Dans le carrousel, **seule la photo centrale charge la pleine résolution**.
   Trois originaux décodés en même temps font lâcher Safari sur des PNG de
   10 Mo : il rend des images cassées, et leur cadre gris passe pour un
   « contour blanc » autour des photos.
8. La position d'arrivée du trajet de fermeture vient de `getTileRect`, calculée
   depuis la masonry et l'origine de la grille relevée **à l'ouverture**. Ne pas
   la remplacer par un `getBoundingClientRect` sur la tuile : à cet instant la
   grille est en train de revenir de son agrandissement.
