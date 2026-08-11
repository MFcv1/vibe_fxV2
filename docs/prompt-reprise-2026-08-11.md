# Prompt de reprise — après le lot J (2026-08-11)

À copier tel quel dans un chat NEUF, contexte à zéro.

---

```
Projet : /Users/matthis/Desktop/mes projets mac/vibe_fxV2   (macOS, npm, Next.js)
Branche : vibecut/phases-3b-5-6-7

À LIRE, DANS CET ORDRE, ET RIEN D'AUTRE
1. AGENTS.md
2. todo.md
3. docs/importer-un-preset-lightroom.md
4. docs/audit-presets-cn11-cn17-2026-08-11.md
5. map.md — seulement la zone que tu touches, PAS le fichier entier
NE LIS PAS les archives (docs/archive-*.md) sauf si tu touches à leur zone.

OÙ EN EST LE CHANTIER (presets photo de /creer/vision)
Le lot J est livré : la chaîne d'import de presets Lightroom a tourné sur un
vrai Lightroom cloud, de bout en bout.

- Contrôle à vide de Lightroom : 0,018/255. La chaîne ne décale rien.
- CN11 et CN17 (pack Adobe « Style : cinéma II ») capturés par Hald CLUT et
  importés : src/features/vibefx-studio/utils/presets/cn11.js et cn17.js
- Fidélité réelle de CN11 face à Lightroom, sur une vraie photo :
  1,70/255 sur la couleur (blocs 16×16), 4,53/255 pixel à pixel.
- Trois presets existent : powlisher (principal), cn11, cn17.

Trois choses apprises, toutes déjà codées et documentées :
- L'export Lightroom part par défaut en Adobe RVB. Il FAUT sRVB.
- Un preset qui contient du grain BRUITE la table capturée (CN17 : rugosité
  15,6/255 contre 0,09 à vide) → option --lisser à l'import.
- CN11/CN17 sont réglés pour du RAW : sur JPEG ils ÉCRÊTENT (CN17 détruit
  19,3 % des pixels). powlisher, lui, en récupère.

ÉTAT DES GATES AU MOMENT OÙ ON S'ARRÊTE — tous verts
npm run lint            0 erreur (5 warnings préexistants)
npm run build           OK
npm run test:scope      OK
npm run test:vision-preset    40/40
npm run test:vibeos-vision    40/40 + 2 tests navigateur
Échecs préexistants hors chantier : smoke-vibecut-media-safety.spec.cjs (3) et
test:vibecut-export-local-mp4 — fixtures manquantes, chemins Windows d'origine.

LA MISSION SUIVANTE — lot K, construire nos propres presets
1. Trancher d'abord la question de licence : CN11 et CN17 sont dans le bundle
   sous leurs noms Adobe. C'est sain pour calibrer en interne, PAS pour une
   mise en ligne publique. Demande à l'utilisateur : on les retire du bundle,
   ou on les garde derrière un drapeau dev ?
2. Construire un ou deux looks maison, sous nos propres noms, en se calibrant
   sur CN11 (qui est maintenant une référence mesurée exacte) mais SANS son
   écrêtage — la cible est du JPEG 8 bits, pas du RAW.
3. Les valider avec les outils qui existent déjà :
     node scripts/audit-vision-presets.mjs
     node scripts/compare-vision-presets-on-photos.mjs <photo...>
   La colonne décisive est l'écrêtage ajouté : il doit rester ≤ 0 %.
4. Contexte produit utile : les photos que l'utilisateur trouve incroyables
   sont RÉCENTES et faites avec les presets personnels du photographe, pas
   avec CN11/CN17 (qui datent de 2025). CN11 est un point de départ, pas la
   cible.

LES OUTILS QUI EXISTENT DÉJÀ — ne les réécris pas
npm run preset:mire                                  génère la mire Hald
npm run preset:controle -- <mire-réexportée.png>     contrôle à vide
npm run preset:import -- --hald <x.png> --id <id> --label <L> [--lisser 1]
node scripts/audit-vision-presets.mjs [id...]
node scripts/compare-vision-presets-on-photos.mjs <photo...>
node scripts/compare-preset-vs-lightroom.mjs <src.jpg> <lightroom.png> <id>

TU NE PEUX PAS PILOTER LIGHTROOM. Vérifié : Lightroom cloud a
NSAppleScriptEnabled = false, aucun dictionnaire de script, pas de CLI. Si une
capture est nécessaire, donne à l'utilisateur des instructions COURTES, UNE
ÉTAPE À LA FOIS, et attends le chemin du fichier avant de continuer.

LES INTERDITS
- Jamais de Tailwind : CSS Modules + tokens --vo-*.
- Jamais réécrire un moteur existant : on l'importe, ou on l'extrait.
- IndexedDB : des Blobs, jamais de dataURL.
- Jamais recalculer une vignette depuis l'image pleine résolution.
- Aucun déploiement sans demande explicite.
- Ne touche pas au reste de l'app : le sujet, ce sont les presets de Vision.

RITUEL DE FIN DE PHASE (obligatoire, sans qu'on te le demande)
Gates : npm run lint && npm run build && npm run test:scope
        npm run test:vision-preset && npm run test:vibeos-vision
Puis mise à jour de todo.md (il doit RESTER COURT, < 200 lignes) et de map.md
(arbre + entrée de journal datée). Puis, DANS LE CHAT : un récap en langage
simple, et le prompt de reprise complet écrit en entier dans un bloc de code.
```
