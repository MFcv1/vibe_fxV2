# Prompt de reprise — après le lot J (2026-08-11)

À copier tel quel dans un chat NEUF, contexte à zéro.

---

```
Projet : /Users/matthis/Desktop/mes projets mac/vibe_fxV2   (macOS, npm, Next.js)
Branche : vibecut/phases-3b-5-6-7

À LIRE, DANS CET ORDRE, ET RIEN D'AUTRE
1. AGENTS.md
2. todo.md
3. docs/lightroom/2-methode-et-pieges.md
4. docs/lightroom/3-cn11-cn17-mesures.md
5. map.md — seulement la zone que tu touches, PAS le fichier entier
NE LIS PAS les archives (docs/archive-*.md) sauf si tu touches à leur zone.

OÙ EN EST LE CHANTIER (presets photo de /creer/vision)
Le lot J est livré : la chaîne d'import de presets Lightroom a tourné sur un
vrai Lightroom cloud, de bout en bout, et la méthode elle-même a été corrigée.

- Trois presets : powlisher (écrit à la main), cn11 et cn17 (capturés).
- Fidélité de CN11 face à Lightroom sur une vraie photo : 0,64/255 sur la
  couleur, 2,67/255 au pixel (médiane 1). C'est indiscernable.
- Tous à recommendedIntensity 100.

QUATRE CHOSES APPRISES — ne les redécouvre pas, elles ont coûté cher
1. La mire Hald doit être en BLOCS de 4×4 pixels par couleur. Avec une couleur
   par pixel, les couleurs bavent entre voisines : invisible dans les clairs,
   ruineux dans les noirs, qui viraient au VERT visiblement sur les photos.
   Corrigé : `preset:mire` sort du 2048×2048, l'import lit le cœur des carrés.
2. L'export Lightroom part en Adobe RVB par défaut. Il FAUT sRVB.
3. Un preset avec du grain bruite quand même la table → `--lisser 1`.
4. Un preset importé reste à recommendedIntensity 100. Baisser l'intensité ne
   réduit pas le contraste, ça mélange l'image traitée avec l'originale : ça
   délave les couleurs et ça éloigne de Lightroom.

ET UNE RÈGLE DE MÉTHODE, née de trois erreurs de mesure
Un chiffre d'écrêtage ne veut RIEN dire tant qu'on ne l'a pas comparé à celui
de Lightroom sur la même photo. Lightroom écrête 22,74 % des pixels sous CN11 ;
nous 24,10 %. Ces ombres denses sont le look, pas un défaut. Le détail des trois
erreurs est en bas de docs/lightroom/3-cn11-cn17-mesures.md — lis-le, elles
sont toutes crédibles et tu les referais.

ÉTAT DES GATES AU MOMENT OÙ ON S'ARRÊTE — tous verts
npm run lint            0 erreur (5 warnings préexistants)
npm run build           OK
npm run test:scope      OK
npm run test:vision-preset    40/40
npm run test:vibeos-vision    40/40 + 2 tests navigateur
Échecs préexistants hors chantier : smoke-vibecut-media-safety.spec.cjs (3) et
test:vibecut-export-local-mp4 — fixtures manquantes, chemins Windows d'origine.

LA MISSION SUIVANTE — lot K, dans cet ordre
1. Brancher la NETTETÉ 40 que Lightroom applique par défaut à toute image, via
   filters.sharpness sur cn11 et cn17. C'est le dernier écart mesurable avec
   Lightroom (les ~2/255 restants au niveau du pixel) et le seul gain qui reste
   sur la fidélité. Vérifier avec :
     node scripts/compare-preset-vs-lightroom.mjs <origine.jpg> <lightroom.png> cn11
   Les fichiers de test ont été supprimés du Bureau ; en redemander une paire.
2. Trancher la licence AVANT toute mise en ligne : CN11 et CN17 sont dans le
   bundle sous leurs noms Adobe. Sain pour calibrer en interne, PAS pour un
   produit public. Demander à l'utilisateur : on les retire, ou on les garde
   derrière un drapeau dev ?
3. Construire nos propres looks, sous nos propres noms, calibrés sur CN11 qui
   est maintenant une référence exacte. Contexte produit : les photos que
   l'utilisateur trouve incroyables sont RÉCENTES et faites avec les presets
   personnels du photographe, pas avec CN11/CN17 (2025).

LES OUTILS QUI EXISTENT DÉJÀ — ne les réécris pas
npm run preset:mire                                  mire Hald 2048×2048, blocs 4×4
npm run preset:controle -- <mire-réexportée.png>     contrôle à vide
npm run preset:import -- --hald <x.png> --id <id> --label <L> [--lisser 1]
node scripts/audit-vision-presets.mjs [id...]
node scripts/compare-vision-presets-on-photos.mjs <photo...>
node scripts/compare-preset-vs-lightroom.mjs <src.jpg> <lightroom.png> <id>

TU NE PEUX PAS PILOTER LIGHTROOM. Vérifié : Lightroom cloud a
NSAppleScriptEnabled = false, aucun dictionnaire de script, pas de CLI. Si une
capture est nécessaire, donne à l'utilisateur des instructions COURTES, UNE
ÉTAPE À LA FOIS, et attends le chemin du fichier avant de continuer. Il fait
tout ce qui se passe dans Lightroom ; toi tu mesures, tu importes, tu vérifies.

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
