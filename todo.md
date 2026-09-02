# TODO — Vibe_fx V2

> **Point d'étape : 2026-09-01 — la bibliothèque entre dans Layout.**
>
> Layout ne proposait que l'import de fichiers ; la bibliothèque VibeOS est
> maintenant accessible au même rang, sur l'écran vide (**« Depuis ma
> bibliothèque »**) et depuis le bouton **« Ajouter »** du bloc Images — en plus
> du bouton « Importer » d'une case vide, qui existait déjà. En import général,
> la fenêtre reste ouverte pour choisir plusieurs photos d'affilée, et elles
> remplissent les cases vides dans l'ordre de lecture. Gates : lint 0 erreur,
> build Node 22 vert, 5 smokes navigateur verts.
>
> **Point d'étape : 2026-09-01 — plus de bande d'images importées.**
>
> La bande de vignettes en bas du bloc Images empilait toutes les photos
> importées, même retirées d'une case : supprimée, la liste des cases fait foi.
> **Retirer une photo d'une case la retire vraiment du projet** quand aucune
> autre case ne s'en sert (chaque image pèse un Blob à chaque sauvegarde). Deux
> défauts trouvés en route et corrigés : changer de modèle **perdait** une photo
> (elle restait épinglée à une case disparue) — elles suivent maintenant dans
> l'ordre de lecture, et une grille plus large sert en plus les photos en
> réserve ; et le bouton « mélanger » ne déplaçait plus rien depuis que chaque
> case porte son image explicitement. Gates : lint 0 erreur, build Node 22 vert,
> 5 smokes navigateur verts.
>
> **Point d'étape : 2026-09-01 — sélection rouge et qui ne colle plus.**
>
> Le liseré de sélection est passé au **rouge système avec un halo**, plus
> visible sur une photo claire comme sombre, et son épaisseur suit la
> résolution de l'aperçu. Surtout, il ne reste plus collé : **Échap** le
> retire, un **clic à côté de l'aperçu** aussi, et le **plein écran** s'ouvre
> toujours sans lui. Gates : lint 0 erreur, build Node 22 vert, 5 smokes
> navigateur verts (celui des cases couvre les deux façons de désélectionner).
>
> **Point d'étape : 2026-09-01 — cadrage photo par photo.**
>
> Chaque photo se recadre dans sa case : **zoom** (boutons ou molette),
> **déplacement à la souris**, retour au cadrage d'origine (double-clic ou
> bouton central). Une **corbeille rouge** en haut à droite vide la case, en
> face de la poignée de déplacement en haut à gauche. Les commandes sont en
> verre dépoli, invisibles tant que la souris n'entre pas dans l'aperçu, et
> s'adaptent à la taille de la case. Gates : lint 0 erreur, build Node 22 vert,
> 5 smokes navigateur verts — celui des cases couvre maintenant zoom,
> déplacement, remise à zéro et corbeille. Aucun déploiement.
>
> **Point d'étape : 2026-09-01 — fond neutre et marges symétriques.**
>
> Le fond ne se remplit plus tout seul avec la première photo floutée : par
> défaut c'est un **blanc uni**, et Couleur / Flou / Généré restent au choix.
> Les marges partent **égales** — même respiration au bord du visuel et entre
> les images (24 px partout) — avec un mode « Marges égales » activé par défaut ;
> en « Libres », deux curseurs séparés : *Marge extérieure* et *Écart entre les
> images*. L'aperçu est repassé en **angles droits** (Instagram n'arrondit pas).
> Gates : lint 0 erreur, build Node 22 vert, smoke géométrie vert, 5 smokes
> navigateur verts en `--workers=1` — celui des cases vérifie maintenant le coin
> blanc du visuel et l'égalité marge extérieure / gouttière. Aucun déploiement.
>
> **Point d'étape : 2026-09-01 — une photo par case dans le Layout.**
>
> Importer une photo la posait dans **toutes** les cases de la grille : le
> moteur bouclait sur la liste d'images. Corrigé — une photo va dans une case,
> les autres restent vides. Sur l'aperçu, survoler une case vide affiche
> **« Importer »** : fichier de l'appareil ou photo de la bibliothèque VibeOS.
> Une case pleine porte une poignée qu'on **glisse sur une autre case** pour
> échanger les deux photos, et un fichier lâché directement sur une case y va.
> Le bouton « Ajouter » remplit les cases vides dans l'ordre de lecture. Le menu
> de familles a été réduit aux seuls noms. Gates : lint 0 erreur, build Node 22
> vert, smoke géométrie vert, 5 smokes navigateur Layout verts en `--workers=1`
> (dont le nouveau `smoke-vibeos-layout-slots.spec.cjs`). Aucun déploiement.
>
> **Point d'étape : 2026-09-01 — grilles éditoriales du Layout.**
>
> Le modèle « Personnalisé » ne propose plus 3 découpes mais **27 grilles**
> (24 nouvelles + les 3 historiques, rangées en « Classiques »), en 6 familles.
> Dans le panneau, le nom de la grille est devenu un menu de familles : on
> choisit la famille et le panneau affiche ses grilles directement, sans ouvrir
> la bibliothèque — celle-ci reste la vue de découverte, avec recherche et
> aperçu côte à côte en 4:5 et en 1:1. Une grille n'est plus une liste de
> rectangles : c'est un arbre rangées/colonnes compilé (`gridLibrary.js`), avec
> deux variantes par grille — même nombre de zones, même ordre de lecture — donc
> passer du portrait au carré **recompose** la mise en page au lieu de l'étirer,
> et chaque photo reste dans sa zone. Trois variantes par grille : miroir
> horizontal, miroir vertical, rotation des photos ; elles survivent au
> changement de format et à la reprise du projet. Une grille déplacée à la main
> est marquée « retouchée » et n'est plus recompilée. L'aperçu iPhone affiche
> enfin le vrai ratio Instagram (402 px en 1:1, 503 px en 4:5) au lieu d'une
> boîte fixe. Gates : lint 0 erreur, build Node 22 vert, smoke géométrie des 48
> variantes vert, 4 smokes Playwright Layout verts **contre un `npm run dev`
> réel, en `--workers=1`** (en parallèle ils se marchent dessus : défaut déjà
> connu). Le serveur du runner de smokes (`run-video-ui-test.mjs`) reste cassé —
> cause identifiée : avec les variables Firebase vides qu'il injecte, la page
> n'hydrate plus du tout, ce qui explique le « blocage Dev Auth » documenté
> depuis plusieurs lots. Aucun déploiement. Reprise :
> [docs/prompt-reprise-2026-09-01-grilles-layout.md](docs/prompt-reprise-2026-09-01-grilles-layout.md).
>
> **Point d'étape : 2026-09-01 — preview Instagram Layout fidèle à Second Vie.**
>
> L'iPhone du back-office `secondevienextjsSSR` est porté dans Layout avec ses
> dimensions et son chrome exacts (430×910, écran 402×874). La preview utilise
> désormais le rendu pleine définition destiné à la publication : JPEG pour
> portrait, carré, paysage et story, vraies tranches 1080×1350 pour les pano x2
> et x3, parcourables au clic, au swipe et au trackpad. Le paysage est normalisé
> en 1,91:1 jusque dans Publication. Smoke ciblé 6 formats vert, flux
> publication vert, lint sans erreur et build Node 22 vert. Un premier essai
> sous Node 26 avait logiquement rejeté le binaire Node 22 de `better-sqlite3` ;
> la relance avec la version déclarée par le projet est complète. La suite
> Layout groupée garde son blocage Dev Auth préexistant en exécution
> parallèle ; le nouveau smoke passe seul. Aucun déploiement. Reprise :
> [docs/prompt-reprise-2026-09-01-preview-instagram-layout.md](docs/prompt-reprise-2026-09-01-preview-instagram-layout.md).
>
> **Point d'étape : 2026-09-01 — synchronisation Vision → Layout.**
>
> Ce fichier ne porte QUE le chantier **actif**. Il est court **exprès** : un
> agent le relit à chaque session. Le détail de ce qui est clos vit dans les
> archives et dans les journaux datés de `map.md`.
>
> **2026-09-01 — synchronisation Vision → Layout livrée localement.** Vision
> travaille désormais sur la photo source et écrit immédiatement ses réglages
> dans le projet partagé. Layout reconstruit ses images avec le preset actif,
> tout en conservant les Blobs bruts pour éviter toute cuisson cumulative. La
> composition porte une révision Vision : Studio et l'export ne réappliquent
> donc jamais le même preset. Build Node 22 vert ; lint sans erreur (5
> avertissements préexistants). Le smoke ciblé reste bloqué avant Layout par le
> contournement d'authentification Dev qui ne ferme pas la modale, problème
> préexistant déjà documenté.
> Aucun déploiement. Reprise :
> [docs/prompt-reprise-2026-09-01-sync-vision-layout.md](docs/prompt-reprise-2026-09-01-sync-vision-layout.md).
>
> **2026-09-01 — import HEIC/HEIF livré localement.** La bibliothèque convertit
> désormais les photos iPhone haute efficacité en JPEG dans le navigateur,
> avant IndexedDB, Vision et la sauvegarde Firebase. Le convertisseur n'est
> chargé qu'au premier HEIC et les imports restent séquentiels. Essai réel avec
> `/Users/matthis/Downloads/IMG_6469.HEIC` : JPEG 5712×4284 affiché et stocké,
> provenance source conservée. Gates : bibliothèque 41/41 + navigateur 1/1,
> lint sans erreur (5 avertissements préexistants), build Node 22 vert.
> **Déployé** sur App Hosting : build Cloud Build `1156c620…`, révision
> `vibefx-v2-web-build-2026-09-01-001`, 100 % du trafic, route live 200 et
> bundle HEIC confirmé sur l'URL publique.
>
> **2026-08-31 — régression Safari Storage diagnostiquée et corrigée.** Le
> bucket `vibefx-v2.firebasestorage.app` n'avait aucune configuration CORS :
> les objets et leurs URLs étaient valides (37 originaux + 37 aperçus, HTTP
> 200), mais Safari interdisait leur téléchargement JavaScript depuis App
> Hosting. Le CORS explicite est maintenant appliqué au bucket et vérifié sur
> `IMG_0421.JPG`. Le code télécharge d'abord par le chemin Firebase Storage
> owner-scoped, garde l'URL tokenisée en repli, et le carrousel remplace un
> aperçu cassé par une requête versionnée, puis l'original, avant de démonter
> l'image si tout échoue : plus d'icône « ? » ni de cache négatif Safari. Gates : bibliothèque 36/36 + navigateur 1/1 avec aperçu
> volontairement absent, lint sans erreur (5 avertissements préexistants),
> build Node 22 vert. CORS Storage appliqué ; commits `32b63d1` et `45de224`
> poussés sur `master`, puis rollout App Hosting terminé. Dans Safari avec le
> compte réel, « Retoucher » télécharge `IMG_0421.JPG`, ouvre `/creer/vision`
> et la photo apparaît dans Vision.
>
> **2026-08-31 — carrousel Bibliothèque vers Vision corrigé localement.** Pour
> une photo présente seulement dans le compte, « Retoucher » attendait le
> décodage, la nouvelle vignette et sa copie IndexedDB avant de naviguer ; sur
> Safari le bouton semblait donc mort. Vision reçoit désormais le Blob dès son
> téléchargement, tandis que le cache local se termine en arrière-plan. L'UI
> affiche « Ouverture… », empêche le double clic, retente l'aperçu si l'original
> distant est indisponible et montre une erreur utile si aucun fichier ne peut
> être chargé. Le smoke simule maintenant une photo sans Blob local et vérifie
> le passage réel du carrousel à `/creer/vision`. Gates : bibliothèque 36/36 +
> navigateur 1/1, lint sans erreur (5 avertissements préexistants), build Node
> 22 vert. **Déployé** depuis le commit `a8b6993` sur App Hosting. Le contrôle
> live avec le compte réel ouvre `IMG_0421.JPG` dans le carrousel, clique
> « Retoucher » et retrouve `/creer/vision` avec l'écran Vision visible.
>
> **2026-08-31 — connexion Google Safari corrigée, publication en cours.** Le
> popup s'ouvrait sur le helper Firebase avec `fac={error: UNKNOWN_ERROR}` : la
> clé reCAPTCHA App Check n'autorisait pas le domaine App Hosting réellement
> utilisé. Le domaine `vibefx-v2-web--vibefx-v2.europe-west4.hosted.app` est
> désormais autorisé sans désactiver App Check. Un second défaut Safari a été
> reproduit : au premier clic, Firebase initialisait son resolver trop tard et
> Safari classait l'ouverture comme popup bloqué. `AuthContext` prépare
> maintenant le resolver avec `getRedirectResult()` au chargement et le bouton
> Google reste désactivé jusqu'à sa disponibilité. Les erreurs Firebase ne sont
> plus masquées. Gates : smoke Studio/Vision ciblé 1/1, lint sans erreur (5
> avertissements préexistants), build Node 22 vert.
>
> **2026-08-31 — favoris de presets Vision prêts à publier.** Chaque carte de
> `/creer/vision` porte une étoile indépendante du bouton qui applique le
> preset. Le filtre « Favoris » se combine avec la recherche et affiche le
> compte exact. Les choix sont synchronisés en direct dans
> `users/{uid}/visionPresetFavorites/{presetId}` ; aucun favori d'un compte ne
> peut apparaître ou être écrit dans un autre. L'interface reste optimiste mais
> annule proprement une étoile si Firebase refuse l'écriture. Vérifications :
> moteur 438/438, smoke Vision 3/3, scénario ciblé 1/1 après refactor, règles
> Firestore sur émulateur avec deux comptes, lint sans erreur (5 avertissements
> préexistants), build Node 22 vert. Règles publiées, commit `4f8336f` poussé
> sur `master`, puis rollout App Hosting `build-2026-08-31-005` réussi. Le smoke
> live voit les 261 étoiles, sélectionne le filtre et ne relève aucune erreur
> console ; aucune donnée factice n'a été laissée dans le compte réel.
>
> **2026-08-31 — bibliothèque : dossiers, fenêtre d'import et sauvegarde compte.**
> `/creer/bibliotheque` s'ouvre désormais sur des **dossiers**, pas sur un tas de
> photos. Un import crée un dossier — nommé comme sur un OS : le nom du dossier
> choisi, sinon la date en toutes lettres, suffixe « (2) » si le nom est pris —
> et on entre dedans tout de suite. Cliquer sur un dossier ouvre la grille
> masonry **inchangée** : mêmes vagues d'apparition, même carrousel, mêmes
> filtres. La fenêtre d'import reconnaît l'appareil et propose les bonnes
> sources : photothèque / appareil photo / fichiers sur téléphone, photos ou
> dossier entier sur ordinateur. Quota **1000 photos et 5 Go**, vérifié avant
> l'import. Quand un compte est connecté, chaque photo part en arrière-plan vers
> Firebase (aperçu 1600 px **et** original), une à la fois, et redescend sur un
> autre appareil : vérifié sur les émulateurs en effaçant IndexedDB — les deux
> dossiers et leurs neuf photos reviennent, s'ouvrent, et « Retoucher » rapatrie
> l'original dans Vision. Gates : `test:vibeos-library` (37 vérifications hors
> navigateur, smoke navigateur 1/1), lint 0 erreur (5 avertissements
> préexistants), build Node 22 vert. **Déployé le 2026-08-31** : règles
> Firestore/Storage d'abord, puis commit `6030055` sur `master` et rollout App
> Hosting `build-2026-08-31-004`. Les refus inter-comptes passent sur les
> émulateurs. La page live s'ouvre avec un compte réel ; l'import live de trois
> images reste à finir après autorisation d'accès aux fichiers dans l'extension
> Chrome.
> Détail : journal `map.md` du 2026-08-31 (bibliothèque).
>
> > **2026-08-31 — corrections Vintage et Noir et blanc livrées.** Les dix
> Vintage ont été recapturés depuis une mire réinitialisée avant chaque preset :
> l'ancienne mire avait conservé un état noir et blanc. Les douze Noir et blanc
> ne portent plus le vignettage 25 absent de leurs XMP Adobe. Sur les contrôles
> réels, Vintage tombe à 2,04–4,32/255 sur la couleur seule ; BW01/BW04/BW05 à
> 2,64–3,32/255 et BW10 à 3,87/255 hors hasard du grain. Les 22 familles sont
> maintenant cohérentes : quatorze conformes et huit à surveiller pour de petits
> écarts. `test:vision-preset` passe 436/436, lint passe avec cinq avertissements
> préexistants et le build Node 22 passe. Les smokes navigateur restent bloqués
> par le contournement d'authentification Dev qui ne ferme plus la modale, sans
> rapport avec les presets. Release `7401cd0` poussée sur GitHub et mise en
> ligne le 2026-08-31 avec le backend Firebase complet sur
> `https://vibefx-v2-web--vibefx-v2.europe-west4.hosted.app`. Rapport :
> [docs/lightroom/audit-qualite-presets-2026-08-31/rapport.md](docs/lightroom/audit-qualite-presets-2026-08-31/rapport.md).
> Reprise : [docs/prompt-reprise-2026-08-31-correction-vintage-bw.md](docs/prompt-reprise-2026-08-31-correction-vintage-bw.md).
>
> **2026-08-31 — performance des miniatures Vision livrée.** Les cartes dans
> le viewport passent avant tout le reste via `IntersectionObserver`; la marge
> suivante est préchargée au repos, une file devenue inutile est annulée, et le
> cache photo + preset + intensité conseillée + version moteur survit aux
> changements de collection. La source 192×116 est réduite une fois, le rendu
> reste le pipeline complet (LUT + effets), et les JPEG sont des Blob URLs.
> Cause principale corrigée : chaque miniature terminée recréait des objets du
> renderer et relançait aussi la grande image jusqu'à 3 Mpx.
> Mesure reproductible : première miniature 454 ms depuis l'import (23 ms après
> disponibilité de la photo), 10/10 visibles en 852 ms (421 ms après photo),
> scroll rapide 284 ms, 14 rendus lancés avant scroll, 0 doublon React, 4,7 ms
> de pipeline moyen par preset. Une collection Cinéma n'en lance que 10.
> Gates : performance 3/3, smoke Vision navigateur 3/3, moteur 426/426, lint
> sans erreur (5 avertissements préexistants). Le build compile puis garde son
> blocage ABI local `better-sqlite3` (127 contre Node 26/147). Aucun déploiement.
> Reprise : [docs/prompt-reprise-2026-08-31-performance-miniatures-vision.md](docs/prompt-reprise-2026-08-31-performance-miniatures-vision.md).
>
> **2026-08-31 — retrait propre de VibeMask.** La segmentation ciel/eau,
> l'overlay de masque, les presets ciel locaux, le Worker DeepLab et les
> dépendances TensorFlow.js ont été retirés : leur résultat n'était pas assez
> fiable pour ce stade du produit. Vision conserve ses presets classiques,
> l'amélioration automatique, les réglages, l'historique et le même pipeline
> pour l'aperçu et l'export.
> Gates du retrait : pipeline 2/2, lint 0 erreur (5 avertissements déjà
> présents), build Node 22 vert. Le smoke moteur Vision conservait son unique
> échec antérieur sur 12 presets hors garde-fous. Le plafond navigateur de
> 173/261 miniatures en 20 s a été résolu par le lot performance ci-dessus.
>
> **Ce qui est livré** — redesign VibeOS (`/creer`, `/publier`, `/video`), moteur
> de LUT 3D 33³, chaîne d'import Lightroom, six réglages avancés alignés, et
> **261 presets** dont les douze derniers VibeFX — `couchant`, `powlishermain` et la série
> `powV2` à `powV11` — attendent un regard. Le détail est
> dans [l'archive du 2026-08-27](docs/archive-calages-lightroom-2026-08-27.md).
>
> Les lots **clos** du 2026-08-29 au 2026-08-30 — import des familles Lightroom,
> série `powV2` à `powV12`, Gradient Builder, recentrage du Studio — sont sortis
> de ce fichier le 2026-08-31 :
> [docs/archive-presets-et-studio-2026-08-30.md](docs/archive-presets-et-studio-2026-08-30.md).

**À lire avant de coder, dans cet ordre :**

1. [AGENTS.md](AGENTS.md) — règles de travail, rituel de fin de phase.
2. Ce fichier.
3. [docs/presets-valides.md](docs/presets-valides.md) — **si tu touches aux
   presets** : ceux qui ne se suppriment jamais, et ce qu'un preset doit passer
   pour y entrer.
4. [docs/lightroom/](docs/lightroom/) — **si tu importes un preset** : la
   procédure clic par clic, la méthode et ses pièges, le corpus de `powlisher`.
5. [docs/pieges-connus.md](docs/pieges-connus.md) — **avant de toucher aux
   presets, à la couleur ou au rendu** : ce qui a déjà cassé une fois.
6. [map.md](map.md) — arbre du projet. Ses journaux datés : **ne lis que la
   zone que tu touches**.

Reprendre dans un chat neuf :
[**après l'import HEIC/HEIF** — 2026-09-01](docs/prompt-reprise-2026-09-01-import-heic.md),
[**après la correction Retoucher du carrousel** — 2026-08-31](docs/prompt-reprise-2026-08-31-carrousel-vers-vision.md),
[**après la correction Google Safari** — 2026-08-31](docs/prompt-reprise-2026-08-31-auth-google-safari.md),
[**après les favoris de presets Vision** — 2026-08-31](docs/prompt-reprise-2026-08-31-favoris-presets-vision.md),
[**après les dossiers de la bibliothèque** — 2026-08-31](docs/prompt-reprise-2026-08-31-bibliotheque-dossiers.md),
[après le recentrage du Studio — 2026-08-30 decies](docs/prompt-reprise-2026-08-30-decies.md),
[**après la clôture du Gradient Builder** — 2026-08-30 nonies](docs/prompt-reprise-2026-08-30-nonies.md),
[après les moteurs du Gradient Builder — 2026-08-30 octies](docs/prompt-reprise-2026-08-30-octies.md),
[après la tranche 1 du Gradient Builder — 2026-08-30 septies](docs/prompt-reprise-2026-08-30-septies.md),
[après l'import des quatre saisons — 2026-08-30](docs/prompt-reprise-2026-08-30.md),
[après le mouvement de la bibliothèque — 2026-08-29](docs/prompt-reprise-2026-08-29.md),
[après `couchant` — 2026-08-27 ter](docs/prompt-reprise-2026-08-27-ter.md),
[la famille cine et `ambre` — 2026-08-27](docs/prompt-reprise-2026-08-27.md),
[les presets mesures sur corpus — 2026-08-25](docs/prompt-reprise-2026-08-25.md),
[le grain, apres l'espace de travail — 2026-08-22](docs/prompt-reprise-2026-08-22.md),
[la série d'imports Lightroom — 2026-08-20](docs/prompt-reprise-2026-08-20.md).

Archives, à ouvrir **seulement** si on travaille dans la zone concernée :
[VibeOS](docs/archive-vibeos-2026-08-11.md) ·
[VibeCut](docs/archive-vibecut-2026-08-04.md) ·
[presets, lots H/I/J](docs/archive-presets-vision-2026-08-12.md) ·
[état livré + calages Lightroom](docs/archive-calages-lightroom-2026-08-27.md).

---

## Ce qui reste

### D'ABORD — regarder les presets qui attendent un regard

Ils sont livrés et testés ; il manque **le regard**. Ouvrir les planches de
`~/Desktop/powlisher-biblio/` et dire, un par un, gardé ou pas. Ceux qui sont
gardés entrent dans [docs/presets-valides.md](docs/presets-valides.md).

| Preset | Livré | Ce qu'il faut regarder |
|---|---|---|
| `couchant` | 2026-08-27 ter | **Le seul preset du projet mesuré contre des COUCHANTS.** Il retire la saturation « carte postale » (×0,71 dans les médians) : sur un ciel magenta c'est net, sur un soleil doré il éteint l'or. C'est le point à trancher à l'œil. |
| `powV11` | 2026-08-29 duodecies, corrigé les terdecies et 2026-08-30 |  Blancs des enseignes crème comme les siens (chroma 18,7 contre 18,6). Lettrage des enseignes lisse depuis le 2026-08-30 (option `blancsBruites`). Réserve : il verdit l'ocre, mais **seulement dans les niveaux sombres** depuis la correction. |
| `powV12` | 2026-08-30 bis | **Le bout de la série.** Le blanc du logo passe de **gris à crème** comme le sien (L 46,2 / chroma 16,0 contre ses 46,1 / 18,0), et le **poteau** redescend de 60,4 à **50,6**. Rien d'autre ne bouge : ciel +0,09, sol 0,00, moto 0,00. Réserves mesurées : les onze points qui restent sur le poteau sont peints à la main chez lui (ni règle de teinte, ni vignetage), et il **désature le rouge** quand nous ne le faisons pas. |
| `powV10` | 2026-08-29 undecies | **Le dernier de la série.** Mêmes couleurs que `powV9`, courbe plus douce : blancs plus clairs, plus d'artefacts autour des enseignes. Même réserve — il verdit l'ocre. |
| `powV9` | 2026-08-29 decies | **Le plus proche de sa photo de nuit** (2,12). Ses deux secteurs chauds sont tournés de 19 à 33° et désaturés de moitié : sur un ocre franc la rotation vaut +46° — **il verdit le sable, le bois, les murs**. À regarder en gardant ça en tête. |
| `powV8` | 2026-08-29 nonies | **Le bout de la série.** Rouge et sol calés sur les siens. Sa luminance ×1,57 sur les rouges et son a\* −3,2 dans les ombres sont les leviers les plus forts de la famille : sur une autre photo, ça se verra. |
| `powV7` | 2026-08-29 octies | **Le bout de la série** (2,42 sur sa photo de nuit). Son relevé des hautes lumières éclaircit TOUT ce qui dépasse L 62 : en plein jour il brûle. À regarder sur une scène nocturne au sujet éclairé. |
| `powV6` | 2026-08-29 septies | **`powV5` plus le dégradé du bas.** Le plus proche de sa photo de nuit (3,03). Le dégradé est un geste de COMPOSITION : il suppose que le bas du cadre est un premier plan à faire taire. À regarder sur une photo dont le sujet est en bas — il l'éteindra. |
| `powV5` | 2026-08-29 sexies | **Le plus proche de sa photo de nuit** (2,92 contre 7,09). Il descend très bas : un blanc pur atterrit à 141. À regarder sur une scène nocturne photographiée trop claire. Sur une photo déjà sombre il la détruit — c'est assumé, il reproduit UNE image. |
| `powV4` | 2026-08-29 quinquies | **Sa photo de nuit, poussée au maximum.** À regarder sur une vraie scène nocturne aux LED. Son ciel est plus sourd et ses bas-tons plus froids que le reste de la famille : sur une lumière chaude ou en plein jour, il aura tort. Calé sur **une seule** photo. |
| `powV3` | 2026-08-29 quater | **La nuit de `powV2`**, même couleur. À regarder sur de vraies scènes nocturnes. Son plafond à 205 empêche un lampadaire de percer un trou blanc. Calé sur **une seule** photo : c'est assez pour une densité, pas pour une couleur — et sa couleur ne bouge donc pas. |
| `powV2` | 2026-08-29 ter | **Le plus proche de ses photos que le projet sache faire** : couleur ET densité. À regarder : est-ce qu'il assombrit trop sur une photo déjà sombre ? (Si oui, `powlishermain` fait la même couleur sans toucher à la lumière.) `node scripts/verifier-presets-sur-paires.mjs ~/Desktop/paires-powlisher` rejoue les chiffres. |
| `powlishermain` | 2026-08-29 bis | **Le seul mesuré sur des avant/après certains.** Il ne touche PAS à la luminosité (c'est mesuré : sa courbe à lui ne fait rien), donc il se pose sur une photo déjà exposée et ne la sauve pas. À regarder : le ciel, qui converge fort vers le teal, et les verts, qui perdent la moitié de leur couleur. Il ne touche pas à la lumière, contrairement à `powV2`. |
| les six du 2026-08-27 | 2026-08-27 | `ambre`, `ambre-nuit-1/2`, `powlisher-chaud`, `powlisher-froid`, et la famille cine |

Refaire une planche à volonté :

```bash
node scripts/planche-duel.mjs --presets couchant,ambre,powlisher-cine --familles mer,auto --par-famille 2
```

Vérifier qu'un preset tend vraiment vers son modèle :

```bash
node scripts/juger-vers-modele.mjs --presets couchant --modele ~/Desktop/powlisher-biblio/modele-couchant --n 3
```

Et le contrôle le plus dur, le dégradé de ciel **à 1:1** :

```bash
node scripts/ciel-couchant-1-1.mjs couchant,ambre,powlisher-cine
```

### Les trois registres de couchant ABANDONNÉS

`heure-bleue` (une seule photo dans son corpus), `contre-jour` (4 ou 5, sous le
plancher du projet) et `heure-dorée` séparée de `sunset-sobre` (son point blanc
s'étale de 123 à 238 **en continu**, sans coupure nette) n'ont pas pu être
mesurés. Le détail est dans le journal du **2026-08-27 ter** de `map.md`.
**Ce qui débloquerait la suite** : d'autres couchants à lui. La chaîne se rejoue
en trois commandes (`grouper-couchants`, `mesurer-variante`, `juger-vers-modele`).

### Ensuite — l'étage de tonalité adaptatif (le vrai gros reste)

Chez `@powl_d`, la luminance médiane va de **23 en ville de nuit à 124 en mer**.
Aucune courbe fixe ne suit ça, et c'est la dernière part de l'écart ressenti
entre nos presets et ses photos. C'est aussi la raison pour laquelle
`powlisher-nuit-2` et `ambre-nuit-2` coûtent une exposition : leur registre
est shooté sombre, et une LUT ne sait pas dire « sombre par rapport à cette
photo-ci ».

**Le 2026-08-29 bis a fourni la preuve directe** : ses trois avant/après ne
diffèrent, en lumière linéaire, que par un gain — −1,85, −0,22 et −0,56 EV sur
trois photos. Il ne suit pas la densité de la scène avec une courbe, il la suit
**à la main**. C'est exactement l'étage qui manque ici.

**Ce n'est pas une modification de preset, c'est une modification de moteur.** Un
preset est compilé en LUT 3D (`getPresetLut`), c'est-à-dire une table sans
mémoire : elle ne peut pas savoir ce qu'il y a dans l'image. Il faut un étage
AVANT la LUT, qui mesure l'histogramme de la photo et l'amène sur l'exposition de
référence du preset — exactement ce que fait le curseur Exposition de Lightroom,
réglé photo par photo. Points à trancher : où il vit dans `studioRenderer.js`,
comment il se désactive, et comment le figer dans un smoke.

### Puis — importer d'autres presets Lightroom

**Série en cours (favoris de Matthis)** : les familles **Cinéma, Cinéma II,
Futuriste, Inspiré d’un film, Noir et blanc, Vintage, Architecture urbaine,
Paysage, Style de vie, Voyage, Voyage II, Printemps, Été, Automne et Hiver sont
complètes**. Restent hors de ces
familles : VCR11 et VCR12. Le circuit de dossiers est décrit dans le prompt de
reprise.

**À chaque preset qui porte du grain** : ouvrir le triangle du panneau Grain et
relever la **Taille**. Elle ne se passe à l'import (`--grainSize`) que si elle
s'écarte de 25.

Familles **paysage** (LN01–LN08), **architecture urbaine** (UA01–UA04),
**voyage, cinéma, film**, par la méthode Hald CLUT
([1-procedure.md](docs/lightroom/1-procedure.md)).

**Un preset Lightroom n'est pas que de la couleur.** À chaque import : relever
les panneaux **Effets** et **Détail** (l'agent doit les **demander**) — dont la
**Réduction du bruit**, que notre moteur n'a pas : un preset qui en porte gardera
chez nous un grain numérique que Lightroom lisse (invisible à bas ISO, visible
sur une photo prise dans le sombre), remettre
le grain à 0 avant d'exporter la mire, puis passer les valeurs relevées à
l'import — `--grain`, `--vignette`, `--clarity`, `--texture`, `--sharpness`,
`--dehaze`. **Le
nombre se recopie tel quel** : nos échelles sont les siennes.

**Déjà capturé, à ne pas relever** : tout ce qui dépend de la seule couleur du
pixel — exposition, contraste, hautes lumières, ombres, blancs, noirs, courbe,
TSL, étalonnage, virage, N&B, et le **profil**.

**⚠️ Deux pièges qui rendent un preset non capturable**, sans que rien ne le
signale : un réglage **« Auto »** non nul (calculé depuis la photo — le tester
sur deux images très différentes), et un panneau **Masquage** non vide.

### Reste ouvert

1. **Trancher la licence** : CN11 et CN17 sont dans le bundle sous leurs noms
   Adobe. À régler avant toute mise en ligne.
2. **Construire nos propres looks**, calibrés sur CN11 qui est une référence
   exacte.

### Bibliothèque — ce qui est su et laissé de côté

1. **Le quota est tenu côté client.** Les règles Firestore/Storage garantissent
   la propriété et la taille d'UN fichier (25 Mo), pas le total. Un plafond
   vraiment étanche demande un compteur serveur (Function `onFinalize` qui
   agrège dans `users/{uid}`). À faire avant d'ouvrir à d'autres comptes.
2. **Les règles sont en ligne.** `firestore.rules` et `storage.rules` portent
   `libraryFolders`, `libraryPhotos` et `users/{uid}/library/…`. Les lectures et
   écritures inter-comptes ont été refusées sur les émulateurs avant publication.
3. **Une suppression faite hors ligne peut revenir.** La photo est effacée en
   local et à distance dans la foulée ; si le réseau manque au moment du geste,
   l'écoute Firestore la remontera à la reconnexion. Pas de corbeille ni de
   pierre tombale pour l'instant.
4. **Un renommage n'est pas redescendu.** Un dossier déjà présent en local n'est
   plus relu depuis le compte : renommer sur un appareil ne renomme pas sur
   l'autre tant que la fiche locale existe.
5. **Au-delà de 25 Mo, seul l'aperçu part.** L'original reste sur l'appareil et
   la photo le dit (`originalSkipped`). À revoir si des RAW entrent un jour.

**Hors chantier** — du choix produit, pas de la dette cachée : rail agents IA et
bibliothèque Midjourney (routes et ledger intacts, cf. `src/config/aiLaunch.js`) ;
synchro Google Drive de la photothèque ; couverture émulateurs du parcours
publication, à réécrire sur `/publier`.

---

## Pièges connus

Ils ont déménagé dans **[docs/pieges-connus.md](docs/pieges-connus.md)** —
c'est une référence active, à relire avant de toucher aux presets ou au rendu.

---

## Règles non négociables

- **Jamais supprimer ni remplacer un preset** de `docs/presets-valides.md`.
- **Jamais de Tailwind** dans le nouveau code : CSS Modules + tokens `--vo-*`.
- **Jamais réécrire un moteur existant** : on l'importe, ou on l'**extrait**.
- **IndexedDB** : des Blobs, jamais de dataURL.
- **Desktop ET mobile** sérieux. Textes UI en français simple.
- **Aucun déploiement** sans demande explicite : tout se vérifie en local.
- **Fin de tranche** : gates ci-dessous, mise à jour de ce fichier (qui doit
  **rester court**) et de `map.md`, rapport honnête — puis, dans le chat, le
  **récap en langage simple** seulement. Le prompt de reprise s'écrit dans
  `docs/prompt-reprise-<date>.md` et n'est collé dans le chat **que sur
  demande** (cf. AGENTS.md, « Économie de contexte et de quota »).

---

## Gates

```bash
npm run dev                    # http://localhost:3000 -> /creer
npm run lint                   # 0 erreur (5 warnings préexistants)
npm run build
npm run test:scope
npm run test:vision-preset     # 426 vérifications (Node)
npm run test:vision-filters
npm run test:vibeos-vision     # rejoue test:vision-preset, puis le navigateur
npm run test:vibeos-pipeline   # composition -> Vision -> Studio -> publication
npm run test:vibeos-library / -layout / -studio / -soundtrack   # si tu y touches
npm run audit:reglages-avances # chaque réglage fait-il quelque chose ? (moteur)
npm run test:reglages-avances  # ...et en poussant les vrais curseurs (interface)
npm run test:routes            # si tu touches aux routes (build + start)

# outils des presets
npm run preset:mire / preset:controle / preset:import          # capturer un preset Lightroom
node scripts/planche-presets.mjs <photo...>                    # planche : LUT seule
node scripts/planche-showcase.mjs                             # planche : EFFETS COMPRIS
node scripts/mesure-ciel-powlisher.mjs [--photo <f>]           # où le ciel atterrit
node scripts/audit-vision-presets.mjs                          # bandes, dominante, témoins
node scripts/compare-vision-presets-on-photos.mjs <photo...>   # écrêtage et force
node scripts/mesure-grain-canaux.mjs --reference <sans> --lightroom <avec> --valeur 50
#   -> son grain CANAL PAR CANAL : corrélation entre canaux, et pixels écrêtés
node scripts/mesure-grain-photo.mjs <sa-photo> --grain 25 --taille 10 --sansgrain <sans>
#   -> le grain sur une VRAIE photo, même flou des deux côtés
node scripts/make-mire-largeur.mjs 1080 810 --sortie <dossier>
#   -> la mire A DESSINÉE à une largeur (jamais réduite : ça ferait baver les bords)
node scripts/compare-preset-vs-lightroom.mjs <src> <lr> <id> [--planche <p>] [--sortie <p>]
#   -> rendu COMPLET (LUT + effets) dans le vrai moteur ; --sans-effets = couleur seule
node scripts/rendu-mire-c.mjs --texture 50 --sortie <png>      # notre moteur sur la mire C
node scripts/mesure-mire-c.mjs --reference <a> --lightroom <b> # netteté / texture / clarté
```

Tous verts au 2026-08-17, les deux audits de réglages compris.

**Échecs préexistants, hors chantier** : `smoke-vibecut-media-safety.spec.cjs`
(3) et `test:vibecut-export-local-mp4` — fixtures manquantes, chemins Windows
d'origine, pointeurs Git LFS ([archive](docs/archive-vibecut-2026-08-04.md#commandes)).

**Node 22 est requis.** Le build passe sous Node 22. Sous un Node plus récent,
`better-sqlite3` peut encore échouer sur une incompatibilité ABI ; revenir à la
version du projet avant d'en conclure à une erreur applicative.
