# Archive — points d'etape du 2026-08-27 au 2026-09-04

Sorti de `todo.md` le 2026-09-04, quand le fichier a depasse 550 lignes. Ces
lots sont clos : ne rouvrir ce fichier que si on retravaille exactement la zone
concernee (Layout, apercu Instagram, catalogue musical, presets Vision).

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
> **Point d'étape : 2026-09-03 — l'aperçu Instagram passe en plein cadre, avec la musique dedans.**
>
> L'aperçu quitte le panneau latéral pour le **mode `immersive`** de `Sheet` : le
> bandeau VibeOS reste, tout le dessous est donné à l'aperçu, et le titre et son
> filet disparaissent. Trois colonnes : **images du post** (clic sur une vignette
> = le téléphone y saute) / **iPhone en grand** / **ambiance sonore**. La carte
> `Portrait (4:5)` et la phrase interne sur « Seconde Vie » deviennent une ligne
> de légende sous le téléphone. La musique réutilise le moteur de `/creer/son` et
> le lecteur global : une piste lancée depuis l'aperçu **continue quand on
> referme**. Pas encore : masquer/réordonner les images — ça casserait un
> panorama tant que `useLayoutEditor` est mono-grille, donc ça vient avec le
> multi-grilles, qui est la prochaine mission. Gates : lint 0 erreur (5
> avertissements préexistants), build Node 22 vert. Aucun déploiement. Reprise :
> [docs/prompt-reprise-2026-09-03-apercu-immersif-musique.md](docs/prompt-reprise-2026-09-03-apercu-immersif-musique.md).
>
> **Point d'étape : 2026-09-04 — catalogue musical maison, gratuit pour de bon.**
>
> Aucune API musique gratuite n'autorise l'usage commercial (vérifié : Jamendo
> facture, Openverse se réserve le droit de facturer, FMA et ccMixter ont fermé,
> Pixabay interdit la redistribution et bloque les serveurs). Une **licence
> CC-BY est irrévocable** et autorise l'usage commercial : on constitue donc un
> catalogue maison. **262 morceaux de Scott Buckley** moissonnés avec sa propre
> taxonomie, rangés en **7 ambiances Insta**, embarqués dans le build et servis
> par `/api/music/catalogue`. Le panneau de l'aperçu Instagram lit ce catalogue
> avec les vraies pochettes, et l'attribution CC-BY est affichée en permanence —
> c'est la contrepartie du droit d'usage, pas une décoration. Reste : Kevin
> MacLeod, les durées, l'hébergement des fichiers. Gates : lint 0 erreur, build
> vert. Aucun déploiement.
>
> **Point d'étape : 2026-09-04 — mode écoute et barre de lecture.**
>
> L'aperçu Instagram a une bascule **Grand / Écoute**. En « grand » la barre de
> lecture n'existe pas : le téléphone fait **771 px**. En « écoute », une barre
> de **72 px** apparaît sous la légende de format et le téléphone descend à
> **687 px** — 11 %, payés seulement quand on les demande. La barre reprend la
> structure d'un lecteur de bureau : identité à gauche, aléatoire / précédent /
> lecture / suivant / boucle au centre avec l'avancement dessous, volume à
> droite. `AudioProvider` gagne la répétition. Pas implémentés et assumés : le
> cœur « garder » et la file d'attente — ils n'auraient rien où ranger tant que
> le morceau choisi ne voyage pas jusqu'à la publication. Gates : lint 0 erreur,
> build vert. Aucun déploiement.
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
