# map.md - Carte vivante Vibe_fx V2

Derniere mise a jour : 2026-09-01

## Regle

Mettre a jour ce fichier a chaque creation, suppression, renommage, deplacement ou modification structurelle.

## Arbre actuel

```text
.
|-- .github/
|   `-- workflows/
|       `-- verify.yml                  # CI GitHub Actions : verify local + emulateurs + smoke routes/UI + sauvegarde studio emulateurs
|-- .firebaserc                         # Projet Firebase par defaut : vibefx-v2
|-- .agents/
|   `-- skills/                         # Skills design importes + note locale Vibe_OS
|       |-- clean-saas/
|       |-- cyber-neon/                 # Direction visuelle marque / pages publiques
|       |-- dark-ui/                    # Direction visuelle surfaces produit
|       |-- design.md/
|       |   `-- skill.md                # Note de design system Vibe_OS Cockpit Mode ajoutee localement, a confirmer avant integration finale
|       |-- editorial-minimal/
|       |-- editorial-type/
|       |-- experimental-type/
|       |-- expressive-brand/
|       |-- geometric-modern/
|       |-- glossy-modern/
|       |-- high-contrast/
|       |-- high-end-design/
|       |-- light-ui/
|       |-- minimal-design/
|       |-- monochrome-ui/
|       |-- motion/
|       |-- pastel/
|       |-- playful-design/
|       |-- serif-display/
|       |-- soft-gradients/
|       |-- technical-sans/
|       |-- technical-ui/               # Direction controles/workflow
|       |-- utilitarian/
|       `-- vibrant-accents/
|-- docs/
|   |-- developpement-local-et-couts.md # Protocole obligatoire : boucle locale, autorisation et perimetre des deploys, branches live/staging, inventaire des ressources payantes
|   |-- lightroom/                     # TOUT l'import de presets Lightroom. `README.md` = point d'entree ; `1-procedure.md` = la marche a suivre clic par clic plus une check-list ; `2-methode-et-pieges.md` = pourquoi la Hald CLUT marche et ses pieges mesures ; `3-cn11-cn17-mesures.md` = mesures de CN11/CN17/powlisher et licence Adobe ; `4-synchro-effets.md` = protocole des effets hors LUT ; `5-audit-fiabilite-2026-08-19.md` = fiabilite reglage par reglage ; `audit-cinema-2026-08-30.md` = CN01-CN10 ; `audit-cinema-II-2026-08-30.md` = CN11-CN18 et diagnostic du grain CN14/CN17 ; `audit-saisons-2026-08-30.md` = SP/SM/TM/WN et comparaisons telephone/reflex
|   |-- prompt-reprise-2026-08-31-vision-sans-vibemask.md # Etat de reprise apres retrait de la segmentation intelligente, avec invariants Vision et gates
|   |-- prompt-reprise-2026-08-19.md      # Prompt de reprise pour un chat neuf, apres l'audit de fiabilite du 2026-08-19 : etat du livre, gates, mission (clarte negative, avertissement a l'import, puis les nouveaux imports), interdits
|   |-- plan-vibeos-redesign-2026-08-08.md # Plan maitre du redesign VibeOS « incubateur de creation » : decisions validees, inventaire des features a preserver, design system .vibeos (tokens copies de VibeCut), routes /creer/*, store projet commun, specs page par page (accueil, layout, vision, studio, soundtrack Spotify-like), phases A-F et bascule /studio -> /creer
|   |-- archive-vibecut-2026-08-04.md   # ARCHIVE du chantier VibeCut clos le 2026-08-04, sortie de todo.md le 2026-08-08 : point situationnel, lots B1/B2/B3a/B3b, effets pendant le plan, glitch, bugs 1 a 59 avec causes reelles, problemes connus non resolus, lecons FFmpeg payees, commandes test:vibecut-*. Reference a relire avant toute reprise de /video ou render-service/
|   |-- studio-ai-agents-megaprompt.md  # Prompt d'integration de la colonne d'agents IA contextualisee par onglet studio
|   |-- vibecut-bibliotheques-roadmap-2026-08-02.md # Feuille de route des deux bibliotheques : inventaire verifie du contenu existant, ce qu'on prend et ce qu'on jette de la reference, direction artistique, architecture cible (squelette commun, BeforeAfterStage, favoris IndexedDB), lots B1 design (hover scrub + bypass + favoris rappeles dans les modes) / B2 vraies videos / B3 contenu manquant, risques et ce qu'on ne fait pas
|   |-- vibecut-audit-mvp-ux-roadmap-2026-07-29.md # Audit code + test reel de l'editeur : crash WebM, ecarts preview/export, absence photo/Ken Burns, simplification Storyboard, modele media cible, roadmap vertical slice et gates MVP/cloud
|   |-- vibecut-cost-telemetry-architecture-2026-06-07.md # Architecture cible telemetry couts VibeCut : estimation live, Cloud Monitoring/Logging, Billing Export BigQuery, reconciliation, UX backoffice et discipline de deploiement
|   |-- vibecut-export-hardening-status-2026-06-06.md # Statut par phase Export Pro : done/partial/not done, blocages live K1, emulators Java, renderer frame-by-frame et fixtures MP4
|   |-- vibecut-export-pro-checkpoint-2026-06-06.md # Checkpoint de reprise : changements, tests executes, limites Cloud Run, backoffice couts et sequence demain
|   |-- vibecut-export-production-hardening-megaprompt.md # Megaprompt release Export Pro renderer-first : navigateur cockpit, machines serveur source de verite, textes/animations/transitions/colorimetrie/audio, destination PC et smoke final K1
|   |-- vibecut-export-production-runbook-2026-06-06.md # Runbook source de verite Export Pro : variables, secrets, deploy controle, Cloud Run prive/OIDC, gates, smoke K1 et rotation
|   |-- vibecut-mvp-master-checkpoint-implementation-2026-07-29.md # Checkpoint maitre approuve : synthese audit + 5 concepts UI, vertical slice, principes produit, phases 0-7, gates CPU/GPU et definition du MVP testable
|   `-- vibecut-social-export-pro-architecture-2026-07-29.md # Architecture cible exports sociaux <=10 min/60 FPS : Jobs async, data plane europe-west1, routage CPU/GPU, couts, qualite, fiabilite, benchmark et roadmap
|-- functions/
|   |-- index.js                        # Exports Functions Meta/OAuth/publication + billing Stripe + AI gateway + Export Pro video
|   |-- package.json                    # Firebase Functions Node 20 + stripe server SDK + BigQuery client Billing Export + checks modules src
|   |-- package-lock.json
|   `-- src/
|       |-- account.js                  # Callable suppression compte avec auth recente : purge Storage, publications, scrub jobs/checkouts, delete Auth
|       |-- ai/
|       |   |-- jobs.js                  # Callable createAiJob, reserve/capture/release credits, rate limit uid/feature/ipHash
|       |   |-- jobUtils.js              # Validation feature/requestId, hashes idempotence, IP et rate limit
|       |   |-- mockProvider.js          # Provider IA mock sans appel externe pour tests credits
|       |   |-- policies.js              # Policies IA bootstrap mock + lecture aiPricingPolicies + calcul cout/marge
|       |   |-- providerRegistry.js      # Registry providers IA global, tous productionAllowed=false par defaut
|       |   |-- reconciliation.js        # Scheduled reconciliation des reservations IA perimees en europe-west1, region compatible Cloud Scheduler
|       |   `-- router.js                # Router provider/model v1 avec scoring multi-candidats et blocage production mock
|       |-- billing.js                  # Checkout Session, webhook Stripe signe, fulfillment idempotent
|       |-- billingEvents.js            # Classification events Checkout Stripe fulfill/failed/ignored
|       |-- billingProducts.js          # Mapping serveur produits Stripe -> entitlements/credits
|       |-- billingSession.js           # Validation pure priceId/metadata des sessions Checkout
|       |-- videoExport.js              # Callables/worker Export Pro : create/cancel/retry/download/admin telemetry avec Billing Export BigQuery optionnel, taskQueue processVideoExportJob en europe-west1, validation manifeste/quotas/paths owner-scoped, manifest JSON Storage et App Check. Estimation cout serveur (estimateJobCostServer) ecrite sur chaque job ready : estimatedComputeCost/StorageCost/RequestCost/TotalCost/TotalCostEur. publicAdminExportJob expose devRun, source, costEstimate, retryCount, phase timings. ADMIN_EMAILS actif en env.
|       `-- appCheck.js                 # Politique App Check : enforce par defaut hors emulateurs
|-- public/
|   |-- assets/
|   |   |-- vibecut-concepts/           # Cinq maquettes ImageGen approuvees pour l'implementation Create, Storyboard, Pro, mouvements et transitions
|   |   |   |-- 01-vibecut-flow-storyboard.png
|   |   |   |-- 02-vibecut-create-guide.png
|   |   |   |-- 03-vibecut-studio-hybride.png
|   |   |   |-- 04-module-mouvements-animations.png
|   |   |   `-- 05-module-transitions.png
|   |   `-- vibefx/
|   |       `-- demo-astronaut.png      # Asset demo pour pages publiques et studio
|   |-- vendor/
|   |   |-- lumen/                    # Copie integree de Leonxlnx/lumenshaders pour generer des fonds shader dans Layout, mode safe desktop WebGL
|   |   `-- gradient-builder/         # Gradient Builder : reconstruction de l'ecran Studio de feralui.dev/gradients (app autonome ES modules, aucune dependance), ouverte plein ecran depuis Studio et rendue au parent par postMessage
|   |       |-- index.html            # Coquille : entete + modes, canvas, bandes, barre du bas, panneau
|   |       |-- styles.css            # Feuille reecrite d'apres les mesures du site (tokens --jg-*, clair/sombre)
|   |       `-- js/                   # color.js (OKLab), names.js (nuancier), export.js (PNG/SVG/CSS/JSON/video), data/ (28 types, 250 presets, 8 arrangements, 35 silhouettes SVG, 5 villes, 69 galerie, 102 noms), render/ (un moteur par type : flow, sky, aurora, fields, strips, prism, still, retro, noise, lines, shapes, tiles, rings, arch, pixel, glassy, glint, mist, skyline, gl), ui/controls.js
|   |-- music/                         # Pistes audio importees pour le module video Vibe_CUT
|   |   |-- local-imports/              # Copies audio locales dev Soundtrack (ignorees Git hors .gitkeep) + manifest genere par /api/music/local-file-import
|   |   `-- pixabay-ai/                # Import local genere par `npm run import:pixabay-ai` : MP3 + manifest droits Pixabay AI Generated
|   |-- file.svg
|   |-- globe.svg
|   |-- next.svg
|   |-- vercel.svg
|   `-- window.svg
|-- render-service/                    # Cloud Run FFmpeg Export Pro Vibe_CUT : verification HMAC timestamp ou platform-iam confirme, download Storage, trims/concat/xfade adjacent/rotation, textes fade/none, colorimetrie FFmpeg, mix audio source/externe, encode MP4 et upload output
|   |-- Dockerfile                     # Image Node 20 slim + ffmpeg + npm install deps renderer
|   |-- package.json                   # Service Node ESM + @google-cloud/storage
|   |-- README.md                      # Contrat renderer signe, perimetre FFmpeg reel, limites codecs/transitions/animations et prochaines etapes production
|   `-- src/
|       `-- server.js                  # Endpoints /health et /render, validation signature/manifeste, FFmpeg concat + fade/crossfade adjacent et upload Storage. Retourne phaseMs (downloadMs/ffmpegMs/uploadMs), service, revision, region, allocatedVcpu, allocatedMemoryGib dans la reponse /render.
|-- src/
|   |-- app/
|   |   |-- api/
|   |   |   |-- _midjourney/
|   |   |   |   `-- server.js           # Adaptateur serveur Next pour bibliotheque/scraper Midjourney, bloque en production par defaut
|   |   |   |-- catalog/
|   |   |   |   |-- [jobId]/
|   |   |   |   |   `-- route.js         # Suppression d'un item catalogue
|   |   |   |   `-- route.js            # Catalogue pagine et filtres
|   |   |   |-- image/
|   |   |   |   `-- [...path]/
|   |   |   |       `-- route.js        # Lecture image locale issue du scraper
|   |   |   |-- music/
|   |   |   |   |-- _providers/
|   |   |   |   |   |-- aiProviderRegistry.js # Registry serveur des providers IA musique : statuts par env, filtres natifs/prompt-presets, docs/licences et controles UI
|   |   |   |   |   |-- elevenLabsMusicAdapter.js # Adapter ElevenLabs Music API : generation serveur /v1/music/detailed, duration/instrumental/C2PA, audio normalise
|   |   |   |   |   |-- minimaxMusicAdapter.js # Adapter MiniMax Music API : /v1/music_generation, sortie hex/data URL, prompt + instrumental
|   |   |   |   |   |-- mubertAdapter.js # Adapter Mubert API v3 public/tracks : playlist_index, duree, intensity, mode, format, BPM et normalisation piste
|   |   |   |   |   |-- placeholderAiAdapter.js # Garde-fou providers experimentaux : key missing ou contrat requis, sans appel externe non documente
|   |   |   |   |   `-- pixabayAudioAdapter.js # Adapter provider-first pixabay-audio : q/category explicites, anciens filtres generiques ignores, URL Pixabay Music, parsing HTML borne, cache 24h, metadata-only ou provider-unavailable si URL audio non fiable/403
|   |   |   |   |-- _shared/
|   |   |   |   |   |-- audioImport.js # Validation/proxy audio URL allowlistee reutilisee par import local et import projet authentifie
|   |   |   |   |   `-- providerTrack.js # Normalisation commune des pistes et statuts des providers IA musique
|   |   |   |   |-- ai-generate/
|   |   |   |   |   `-- route.js        # Generation IA musique cote serveur via adapters isoles, validation prompt/duree/provider et refus sans secret
|   |   |   |   |-- ai-import/
|   |   |   |   |   `-- route.js        # Import audio IA via data URL serveur ou URL audio allowlistee, MIME/poids verifies
|   |   |   |   |-- ai-providers/
|   |   |   |   |   `-- route.js        # Metadata providers IA : API/EXPERIMENTAL/KEY MISSING, filtres natifs et presets Vibe_CUT
|   |   |   |   |-- free-search/
|   |   |   |   |   `-- route.js        # Agregateur serveur provider-first : Pixabay exception manuelle + Openverse social-first ; Archive/Wikimedia unsupported ; Jamendo/Freesound uniquement si cle serveur
|   |   |   |   |-- import/
|   |   |   |   |   `-- route.js        # Proxy serveur controle pour URL audio directe allowlistee, validation host final, sans scraping de catalogue
|   |   |   |   |-- local-file-import/
|   |   |   |   |   `-- route.js        # Import audio local dev vers public/music/local-imports avec manifest, purge demo et suppression fichier ; prod bascule Firebase Storage
|   |   |   |   |-- pixabay-local-import/
|   |   |   |   |   `-- route.js        # Lance localement le scraper Playwright Pixabay Music par theme depuis Soundtrack, bloque en production sauf flag explicite
|   |   |   |   |-- project/
|   |   |   |   |   `-- import-url/
|   |   |   |   |       `-- route.js    # Import projet authentifie d'une URL audio directe avec metadata droits obligatoires
|   |   |   |   `-- providers/
|   |   |   |       `-- route.js        # Metadata providers musique : Pixabay manuel, providers API searchEnabled, Jamendo/Freesound caches tant que leurs cles serveur manquent
|   |   |   |-- proxy-image/
|   |   |   |   `-- route.js            # Proxy image distant pour la bibliotheque
|   |   |   |-- reclassify/
|   |   |   |   |-- reset/
|   |   |   |   |   `-- route.js         # Reset job reclassification
|   |   |   |   |-- status/
|   |   |   |   |   `-- route.js         # Statut job reclassification
|   |   |   |   `-- route.js            # Lancement reclassification catalogue
|   |   |   |-- reset/
|   |   |   |   `-- route.js            # Reset catalogue scraper
|   |   |   |-- scrape/
|   |   |   |   `-- route.js            # Lancement scraping Midjourney
|   |   |   |-- status/
|   |   |   |   `-- route.js            # Statut scraping Midjourney
|   |   |   `-- themes/
|   |   |       `-- route.js            # Categories/themes bibliotheque
|   |   |-- components/
|   |   |   |-- PublicationRoutePipeline.jsx # Pipeline SVG animé partagé
|   |   |   |-- SeoLandingPage.jsx       # Gabarit SSR des pages SEO publiques
|   |   |   `-- StackLegoArchitecture.jsx # Section IA visuelle des stacks A-to-Z : frontend, hosting, auth, database, storage, paiements, backoffice, jobs/monitoring avec modules couplés Firebase/Vercel-Supabase-Stripe/Astro-Cloudflare-R2
|   |   |-- account/
|   |   |   |-- AccountClient.jsx        # Dashboard prive Auth/profil/acces lifetime/achats en client component, texte utilisateur nettoye hors jargon serveur
|   |   |   |-- billing/
|   |   |   |   `-- page.js               # Vue privee facturation noindex
|   |   |   |-- usage/
|   |   |   |   `-- page.js               # Vue privee usage/jobs IA noindex
|   |   |   `-- page.js                 # Dashboard compte noindex
|   |   |-- backoffice/
|   |   |   |-- BackofficeClient.jsx      # Backoffice noindex : switch IA + console telemetry couts VibeCut per architecture doc : 3 cartes KPI, rail alertes, table jobs 11 colonnes, regles anti-zero trompeurs
|   |   |   |-- exportTelemetry.js        # Helpers purs dashboard exports video : couts serveur estimatedTotalCostEur prioritaires sur estimation client, phaseMs/service/revision/region, agregats devRunJobs/serverCostJobs, facture BigQuery
|   |   |   `-- page.js                  # Metadata noindex du backoffice provisoire avant Firebase/admin claims
|   |   |-- editeur-image-instagram/
|   |   |   `-- page.js                 # Page SEO editeur image Instagram
|   |   |-- outil-publication-reseaux-sociaux/
|   |   |   `-- page.js                 # Page SEO outil publication reseaux sociaux
|   |   |-- pricing/
|   |   |   `-- page.js                 # Page SEO pricing lifetime 9,99 EUR pour l'interface visible du lancement
|   |   |-- publier-instagram-facebook/
|   |   |   `-- page.js                 # Page SEO publication Instagram/Facebook
|   |   |-- ressources/
|   |   |   |-- formats-instagram/
|   |   |   |   `-- page.js               # Guide SEO formats Instagram
|   |   |   `-- meta-oauth-publication-instagram-facebook/
|   |   |       `-- page.js             # Guide SEO Meta OAuth publication
|   |   |-- creer/                      # Surface VibeOS (redesign en side-build, phase A). Toutes les pages noindex, derriere StudioAuthGate
|   |   |   |-- layout.js               # Charge vibeos.css (seule feuille de style), monte StudioAuthGate + VibeOsShell (providers projet/audio/toasts)
|   |   |   |-- page.js                 # Accueil incubateur (HomeScreen)
|   |   |   |-- bibliotheque/page.js    # Photothèque VibeOS : monte `features/vibeos/library/LibraryScreen` (dossiers, grille masonry, carrousel)
|   |   |   |-- layout-visuel/page.js   # Espace Layout — ecran reel depuis la phase B tranche 1 (LayoutScreen)
|   |   |   |-- studio/page.js          # Espace Studio : monte `features/vibeos/studio/StudioScreen`
|   |   |   |-- vision/page.js          # Espace Vision : monte `features/vibeos/vision/VisionScreen`
|   |   |   `-- son/page.js             # Espace Soundtrack : monte `features/vibeos/soundtrack/SoundtrackScreen`
|   |   |-- publier/                    # Surface publication (phase F) : elle a repris les feuilles Tailwind/publications que /studio chargeait, sans jamais charger vibeos.css
|   |   |   |-- layout.js               # vibefx-tailwind.css + vibefx-layout.css + publications.css, scopees a /publier
|   |   |   |-- page.js                 # Page noindex
|   |   |   `-- PublierClient.jsx       # Reprend le rendu depose par « Publier » (publishHandoff) et monte PublicationsManager avec ce brouillon
|   |   |-- studio/
|   |   |   `-- page.js                 # PLUS AUCUNE INTERFACE depuis la phase F : redirection serveur vers /creer, avec le mapping des anciens `?workspace=` (layout -> /creer/layout-visuel, studio -> /creer/studio, vision-pro -> /creer/vision, soundtrack et library -> /creer/son, video -> /video)
|   |   |-- video/                      # Module Vibe_CUT. Depuis la PHASE 7 il ne contient plus AUCUNE interface : seulement les modeles, moteurs et services dont le nouveau front depend. `model/timelineModel.js` (modele canonique tracks/items), `model/mediaModel.js` (SANS AUCUN IMPORT : mouvements photo, intensite, `applyImageMotionTransform` que le test de parite charge tel quel), `engine/VideoEngine.js` (dont `renderTransition`, EXPORTEE en phase 5 pour que les vignettes de bibliotheque montrent la vraie transition), `engine/xfadeTransitions.js` (contrepartie canvas exacte des transitions natives `xfade`, courbes relevees sur des rendus reels), `engine/textOverlayRenderer.js`, `export/useExportController.js` (logique d'export), `export/exportDownload.js` (nom de fichier horodate, regeneration d'URL signee, enregistrement dans un dossier du PC — deplaces du panneau supprime en phase 7), `export/exportManifest.js`, `store/videoStore.js` (dont l'action additive `applyMontageScore`, lot L2), `data/musicCatalog.js` et `data/musicRights.js` (la bande-son du studio s'en sert), `services/videoProjectPersistence.js`, `utils/audioWaveform.js`
|   |   |   |-- avance/
|   |   |   |   `-- page.js             # Montage avance : bibliotheque, apercu, inspecteur, timeline multipiste (phase 4)
|   |   |   |-- guide/
|   |   |   |   `-- page.js             # Creation guidee : assistant 5 etapes branche sur GuidedFlow
|   |   |   |-- mouvements/
|   |   |   |   `-- page.js             # Bibliotheque de mouvements - en construction
|   |   |   |-- rapide/
|   |   |   |   `-- page.js             # Montage rapide : storyboard, apercu, inspecteur, export
|   |   |   |-- transitions/
|   |   |   |   `-- page.js             # Bibliotheque de transitions - en construction
|   |   |   |-- layout.js               # Layout noindex + StudioAuthGate + seule feuille vibecut.css (aucun CSS /studio)
|   |   |   `-- page.js                 # Accueil VibeCut : 3 modes, bibliotheques, projets recents
|   |   |-- favicon.ico
|   |   |-- globals.css                 # Base CSS + direction cyber/dark + page d'accueil + backoffice lancement IA/export telemetry
|   |   |-- layout.js                   # Metadata racine + imports CSS globaux
|   |   |-- page.js                     # Unique page d'accueil SSR optimisée (FAQ + Pipeline + Launch)
|   |   |-- robots.js                   # Robots Next.js
|   |   |-- seo-pages.js                # Donnees metadata/contenu JSON-LD des pages SEO publiques
|   |   `-- sitemap.js                  # Sitemap Next.js pour les pages publiques
|   |-- features/
|   |   |-- export/                    # Module partage Export Pro : presets sociaux/pro, validation support renderer, image canvas PNG/JPEG/WebP, queue locale et panneau Export Settings
|   |   |   |-- components/
|   |   |   |   `-- ExportSettingsPanel.jsx # Panneau dense type DaVinci adapte Vibe_fx : presets, tabs Video/Audio/File/Advanced, estimation, Add to Render Queue
|   |   |   |-- lib/
|   |   |   |   |-- exportSettings.js       # Settings pro, sanitization filename, validation supporte/bloque/futur, estimations et overrides manifest
|   |   |   |   `-- imageExport.js         # Export canvas PNG/JPEG/WebP + comparaison visuelle simple de canvas
|   |   |   |-- presets/
|   |   |   |   `-- exportPresets.js       # Presets sociaux rapides, formats/containers/codecs/audio/rate control/qualite
|   |   |   |-- renderQueue/
|   |   |   |   `-- renderQueue.js         # Modele local queue : queued/rendering/completed/failed/cancelled + logs
|   |   |   `-- index.js                 # Exports publics du module export
|   |   |-- publications/
|   |   |   |-- components/
|   |   |   |   |-- InstagramPhonePreview.jsx
|   |   |   |   |-- MetaOAuthPanel.jsx
|   |   |   |   |-- PublicationComposer.jsx
|   |   |   |   |-- PublicationDashboard.jsx
|   |   |   |   |-- PublicationList.jsx
|   |   |   |   `-- PublicationPreview.jsx
|   |   |   |-- helpers/
|   |   |   |   `-- publicationHelpers.js # slug, caption/checker, upload et payload publication
|   |   |   |-- PublicationsManager.jsx # Orchestrateur studio/publications + layout studio
|   |   |   `-- publications.css
|   |   |-- vibefx-layout/
|   |   |   |-- components/
|   |   |   |   |-- canvas/
|   |   |   |   |   `-- CanvasWorkspace.jsx
|   |   |   |   |-- panels/
|   |   |   |   |   |-- BackgroundPanel.jsx
|   |   |   |   |   |-- GeometryPanel.jsx
|   |   |   |   |   |-- SmoothBlurPopup.jsx
|   |   |   |   |   `-- TextAssetsPanel.jsx
|   |   |   |   |-- sidebar/
|   |   |   |   |   `-- LayoutSidebar.jsx
|   |   |   |   |-- tutorial/
|   |   |   |   |   |-- LayoutDemoOverlay.jsx
|   |   |   |   |   `-- LayoutTutorialOverlay.jsx
|   |   |   |   `-- ui/
|   |   |   |       |-- ControlGroup.jsx
|   |   |   |       `-- Select.jsx
|   |   |   |-- data/
|   |   |   |   |-- constants.jsx
|   |   |   |   `-- themedTemplates.jsx   # 69 templates prets a poster par theme (E-commerce, Promo, Voyage, Editorial, Food, Mode, Branding, Photo, Deco, Immobilier, Art, Evenement, Lifestyle, Carrousel, Saisons, Meuble) inspires de references Instagram et du catalogue client Tous a Table
|   |   |   |-- engine/
|   |   |   |   |-- assetRenderer.js
|   |   |   |   |-- layoutRenderer.js
|   |   |   |   `-- textRenderer.js
|   |   |   |-- hooks/
|   |   |   |   |-- useCanvasEvents.js
|   |   |   |   |-- useCanvasRenderer.js # Renderer canvas partagé ; aperçu Vision/Studio plafonné à 1,25 Mpx (export intact) pour libérer le thread principal
|   |   |   |   |-- useImageUpload.js
|   |   |   |   `-- useLayoutHelpers.js
|   |   |   |-- utils/
|   |   |   |   `-- canvasUtils.js
|   |   |   |-- index.js
|   |   |   |-- VibeFxLayout.jsx
|   |   |   |-- vibefx-layout.css
|   |   |   `-- vibefx-tailwind.css
|   |-- vibefx-studio/                 # Dossier reel : src/features/vibefx-studio/. Depuis la PHASE F il ne contient plus AUCUNE interface : seulement les moteurs, hooks, donnees et services que `vibeos/` importe. `ai/`, `components/` (dont le rail IA et l'onglet bibliotheque Midjourney), `soundtrack/components/`, `SoundtrackPage.jsx` et `VibeFxStudio.jsx` ont ete supprimes avec l'ancienne UI
|   |   |-- data/                       # Constantes, presets et donnees UI importees
|   |   |-- engine/                     # Rendu canvas/physics importes depuis Vibe_fx
|   |   |-- hooks/                      # Hooks interaction, renderer, bibliotheque et assets
|   |   |-- soundtrack/                 # Logique Soundtrack (l'UI vit dans vibeos/soundtrack/ depuis la phase E, les composants de l'ancien onglet ont ete supprimes en phase F)
|   |   |   |-- data/                     # Providers/filtres/defaults Soundtrack reutilisant musicCatalog
|   |   |   |-- hooks/                    # Recherche API, player preview, controller global Soundtrack, bibliotheque projet Firebase et bibliotheque locale IndexedDB/dossier
|   |   |   |-- services/                 # Modele/client Firestore/Storage projet (tracks + playlists), cache/search provider, IndexedDB, manifest, File System Access, import dev public/music/local-imports, downloads locaux, audit droits, et `soundtrackImportFlows.js` (flux d'import Aitra/Pixabay/URL/fichier extraits des assistants, partages entre l'ancien /studio et l'ecran Soundtrack VibeOS)
|   |   |-- utils/                      # Utilitaires canvas/image + `socialExport.js` (decoupage carrousel panorama + PNG de publication, extrait de VibeFxStudio.jsx en phase F et partage avec le bouton « Publier » de VibeOS) + color science Vision (`visionColorScience.js`, `visionMetrics.js`, `visionRecommendation.js` — signaux image, scoring profil<->photo et rendu des vignettes, partages entre l'ancien VisionPanel et l'ecran Vision VibeOS)
|   |   |-- video/                      # Module Vibe_CUT importe, dont `export/useExportController.js` (logique d'export extraite du panneau), `engine/textOverlayRenderer.js` (rendu canvas des textes extrait de VideoPreview) et `engine/xfadeTransitions.js` (contrepartie canvas exacte des transitions natives `xfade` de FFmpeg, courbes relevees sur des rendus reels), `export/` pour ExportManifest + services localMock/Firebase future, `store/videoStore.js` dont l'action additive `applyMontageScore` (partition de montage, lot L2), `data/musicCatalog.js` pour catalogue/sources/licences, `data/musicRights.js` pour audit/manifeste droits musique, `services/exportRightsManifestClient.js` pour persistance Firestore owner-scoped, `model/timelineModel.js` pour le modele canonique tracks/items, `model/mediaModel.js` (SANS AUCUN IMPORT) pour les mouvements photo, leur intensite et `applyImageMotionTransform` — la transformation d'apercu que le test de parite charge telle quelle, `utils/audioWaveform.js` pour l'extraction waveform client, `utils/quickTools.js` pour la palette rapide drag/drop, et `panels/VibeCutQuickPanel.jsx` pour le panneau droit VibeCut
|   |-- vibecut/                        # Nouveau front VibeCut (reconstruction UI). Aucun import de l'ancienne interface, aucune classe Tailwind.
|   |   |-- adapters/                   # Seule couche qui connait le store video et IndexedDB
|   |   |   |-- useMediaImport.js       # Import photos/videos : duree, orientation, miniatures, waveform, etat d'avancement
|   |   |   |-- useScenes.js            # Scenes ordonnees (position timeline, mouvement, transition) + actions d'edition
|   |   |   |-- useGuidedMontage.js      # Applique un plan de montage (styleRecipes) au projet en une seule ecriture du store, mouvement + intensite compris
|   |   |   |-- useTimeline.js          # Modele multipiste du montage avance : `buildTimelineModel` + `buildTimelineSnapPoints` exposes tels quels, selection unique, deplacement/redimensionnement/rognage/decoupe, etats de piste
|   |   |   |-- useVibeCutProject.js    # Ouverture `?project=`, sauvegarde auto debouncee + immediate (les deux ancrent l'URL), renommage
|   |   |   |-- useProjectLibrary.js    # Facade bibliotheque de projets : liste, creation, renommage, suppression
|   |   |   `-- useFavorites.js         # B1 : favoris des bibliotheques, UNE seule source de verite (cache de module + `useSyncExternalStore`), persistes en IndexedDB sous `favorites:v1`. Lu par les deux bibliotheques ET par les deux inspecteurs de montage
|   |   |-- data/
|   |   |   |-- motionCatalog.js        # Catalogue mouvements (presentation) mappe sur IMAGE_MOTION_PRESETS + statut `planned`
|   |   |   |-- styleRecipes.js         # Moteur de recettes de la creation guidee, PUR (aucun import) : six presets en partition, rythmes, jeux de mouvements, MOTION_INTENSITIES (trois crans nommes, lot L3), buildMontagePlan, describeMontagePlan, apercu CSS du look, et depuis le lot L5 les resolveurs de traitement du titre et des fondus audio (resolveTitleOverlayStyle, applyTitleCasing, resolveAudioProfile) + buildBeatStrip
|   |   |   `-- transitionCatalog.js    # Catalogue transitions (presentation) mappe sur les ids TRANSITIONS du moteur
|   |   |-- home/
|   |   |   |-- HomeScreen.jsx          # Accueil : 3 modes, mouvements, transitions, projets recents
|   |   |   |-- LibraryTiles.jsx        # Vignettes d'apercu animees (mouvement / transition), glyphe statique + animation au survol
|   |   |   |-- ModeMockups.jsx         # Maquettes CSS animees des trois modes
|   |   |   |-- RecentProjects.jsx      # Grille de projets locaux, ouverture rapide/avance, suppression en deux temps
|   |   |   |-- home.module.css
|   |   |   `-- mediaTones.js           # Degrades photographiques pour les placeholders media
|   |   |-- media/
|   |   |   `-- SceneIllustration.jsx   # Illustrations de scene 100 % SVG (montagne, ville, plage, foret, portrait, produit)
|   |   |-- library/                    # Bibliotheques : /video/transitions et /video/mouvements (phase 5, refondues au lot B1, vraies videos au lot B2)
|   |   |   |-- LibraryScreen.jsx       # B1 : OSSATURE COMMUNE aux deux ecrans (en-tete, filtres, grille par familles, section « Tes favoris » en tete, panneau). Les deux bibliotheques ne fournissent plus que leurs donnees
|   |   |   |-- LibraryFilterBar.jsx    # B1 : recherche insensible aux accents, familles en barre horizontale (jamais un rail lateral, plan.md § 4.4), filtre Favoris, repli en menu deroulant sous 720 px
|   |   |   |-- LibraryCard.jsx         # B1 : vignette a HOVER SCRUB (la position X du pointeur EST le temps), liseré de progression, equivalent clavier aux fleches, etoile de favori (frere du bouton, jamais imbriquee - bug 11), repos au POINT CULMINANT
|   |   |   |-- LibraryStage.jsx        # B1 : grand apercu — curseur de temps, bascule boucle, et BYPASS (maintenir B montre le rendu SANS l'effet, en plein cadre). Le separateur deplaçable a ete ecarte, ne pas le reintroduire
|   |   |   |-- LibraryContextStrip.jsx # B1 : « Scene 4 -> [ici] -> Scene 5 » — dit OU l'effet s'applique, sans rien commander
|   |   |   |-- previewController.js    # B1 : REGISTRE de controleurs de temps (loop / scrub / freeze) hors React, adresse par cle — le survol ecrit dans un objet mutable, jamais dans un setState (correctif du bug 3 rejoue)
|   |   |   |-- TransitionLibrary.jsx   # 48 transitions, toutes exportables : donnees + statut export lu du manifeste + panneau (duree bornee a 45 %, application a une coupe ou a toutes via sceneActions, flush saveNow)
|   |   |   |-- MotionLibrary.jsx       # 12 mouvements, 11 rendus : donnees + editeur de trajectoire borne par |x| <= (zoom-1)/2 (probleme I), intensite, vitesse = duree du plan, courbe lineaire affichee DESACTIVEE
|   |   |   |-- TransitionPreview.jsx   # Canvas pilote par `renderTransition` DU MOTEUR : la carte montre la transition, pas une imitation CSS. Bypass = coupe franche
|   |   |   |-- MotionPreview.jsx       # Canvas pilote par `mediaModel.applyImageMotionTransform` : meme transformation que l'apercu et que le `zoompan` du renderer. Bypass = mouvement neutre
|   |   |   |-- previewTicker.js        # UNE seule `requestAnimationFrame` pour toutes les vignettes + respect de `prefers-reduced-motion`
|   |   |   |-- useLibraryMedia.js      # (lot B2) Les deux sources enchainees, QUATRE ETAGES : videos du projet -> photos du projet -> clips de demonstration -> repli dessine. Les videos passent DEVANT les photos. Une seule paire pour tout l'ecran : 48 vignettes ne decodent pas 48 videos
|   |   |   |-- librarySourceOrder.js   # La regle d'ordre, module PUR zero import (comme styleRecipes) : c'est la seule decision du lot qui puisse etre fausse sans que l'ecran ait l'air casse
|   |   |   |-- libraryFallbackScene.js # Les deux scenes DESSINEES (aucun asset externe) — relief a trois plans, halo, reflet et grain, deterministe : un degrade lisse ne montrerait ni zoom ni grain. Lues AUSSI par le generateur de clips, d'ou l'extraction
|   |   |   |-- libraryMediaManifest.js # Droits des clips de demonstration : un clip non declare, sans licence ou sans fichier n'est jamais servi. Meme exigence que pour la musique
|   |   |   |-- librarySourceFreeze.js  # Hors de la boucle, la vignette dessine une COPIE de la source. Sans elle le rush tourne sous un scrub arrete, et le bypass compare deux instants differents du plan (bug 53)
|   |   |   `-- library.module.css
|   |   |-- preview/
|   |   |   |-- PreviewEngineHost.jsx   # UN SEUL `PlaybackEngine` pour tout VibeCut (phase 4) : canvas singleton hors React, monte dans le shell donc au-dessus des routes, deplace d'un ecran a l'autre sans etre recree
|   |   |   |-- PreviewStage.jsx        # Emplacement d'apercu : declare OU le canvas unique vient se poser, ne cree plus rien
|   |   |   |-- TransportBar.jsx        # Lecture, timecode, scrub clavier/souris
|   |   |   `-- preview.module.css
|   |   |-- advanced/                   # Montage avance (/video/avance)
|   |   |   |-- AdvancedEditor.jsx      # Orchestration : bibliotheque / apercu / inspecteur / timeline, import, historique, autosave, raccourcis
|   |   |   |-- MediaLibrary.jsx        # Medias du projet : recherche, tri, vignettes, selection
|   |   |   |-- TimelineView.jsx        # Timeline multipiste : reglette, tete de lecture 60 fps hors React, zoom, magnetisme, reorder/rognage/deplacement en pointer events avec commit au relachement
|   |   |   |-- Inspector.jsx           # Inspecteur contextuel : mouvement + curseur d'intensite continu, transformation, vitesse (badge apercu seulement), colorimetrie, son ; delegue au TextInspector et aux panneaux musique
|   |   |   |-- ExportProSheet.jsx      # Export professionnel : cadence jusqu'a 60 fps, niveau de qualite, pre-vol reel du controleur d'export
|   |   |   `-- advanced.module.css
|   |   |-- guided/                     # Creation guidee (/video/guide)
|   |   |   |-- GuidedFlow.jsx          # Orchestration : 5 etapes, rail de progression, generation live a chaque choix, apercu reel, sorties vers les autres modes
|   |   |   |-- StepMedia.jsx           # Etape 1 : import, grille des scenes, retrait d'une scene
|   |   |   |-- StepStyle.jsx           # Etape 2 : format + 6 presets, chacun avec sa pellicule batie sur les miniatures reelles (lot L4)
|   |   |   |-- StepRhythm.jsx          # Etape 3 : rythme avec la PARTITION visible (BeatStrip, lot L5) sur le plan complet et sur chaque carte, jeux de mouvements, trois crans d'intensite
|   |   |   |-- StepSound.jsx           # Etape 4 : musique avec declaration de droits, titre d'ouverture ; annonce et applique le traitement du preset (taille/position/lisibilite/casse, fondus audio) - lot L5
|   |   |   |-- StepFinish.jsx          # Etape 5 : recapitulatif relu du montage reel, export, passage rapide/avance
|   |   |   |-- LookPreview.jsx         # Vignette SVG + filtre CSS du look + animation du mouvement du style (repli du lot L4)
|   |   |   |-- PresetFilmstrip.jsx     # Lot L4 : trois panneaux tires des MINIATURES REELLES du projet, teintes par le look, enchaines par la vraie transition du preset a son vrai tempo ; repli SceneIllustration quand aucune miniature n'existe
|   |   |   |-- BeatStrip.jsx           # Lot L5 : la partition rendue visible - un bloc par plan dont la largeur est sa duree, une jointure par coupe minutee (geometrie produite par `buildBeatStrip`, fonction pure)
|   |   |   `-- guided.module.css
|   |   |-- quick/                      # Montage rapide
|   |   |   |-- QuickEditor.jsx         # Orchestration : import, glisser-deposer, format, raccourcis, autosave
|   |   |   |-- Storyboard.jsx          # Grandes cartes de scenes reordonnables + puces de transition
|   |   |   |-- SceneInspector.jsx      # Duree, mouvement, transition, volume, titre, musique
|   |   |   |-- ExportSheet.jsx         # Export simplifie branche sur useExportController
|   |   |   `-- quick.module.css
|   |   |-- primitives/                 # Button, IconButton, Segmented, Card, EmptyState, Spinner, Progress, Badge
|   |   |-- services/
|   |   |   `-- projectLibrary.js       # Multi-projets IndexedDB (cles `project:`/`meta:`), sans bump de version pour cohabiter avec l'ancien front
|   |   |-- shell/
|   |   |   |-- PhasePlaceholder.jsx    # Ecran d'attente honnete (plus utilise par aucune route /video depuis la phase 5 ; conserve pour les phases suivantes)
|   |   |   `-- VibeCutShell.jsx        # Bandeau superieur unique + racine `.vibecut`
|   |   `-- styles/
|   |       `-- vibecut.css             # Tokens + base du design system, scopes `.vibecut` (sombre, theme clair pret)
|   |-- vibeos/                          # Nouveau front VibeOS (redesign Studio/Layout/Soundtrack/Vision, plan docs/plan-vibeos-redesign-2026-08-08.md). CSS Modules uniquement, zero Tailwind, zero import de l'ancienne UI
|   |   |-- audio/
|   |   |   `-- AudioProvider.jsx       # Audio global ET moteur de lecture de VibeOS (phase E) : l'element <audio> vit dans le layout /creer et survit aux navigations, plus la file, l'aleatoire, le volume, l'enchainement automatique en fin de piste et un resolveur de source qui redemande le Blob et fabrique sa PROPRE URL d'objet (celles de useLocalSoundtrackLibrary sont revoquees au demontage)
|   |   |-- home/
|   |   |   |-- HomeScreen.jsx          # Accueil incubateur : reprise du projet courant + « Nouvel espace vierge », 6 cartes d'espaces (Bibliothèque/Layout/Studio/Vision/Soundtrack/VibeCut), recents avec dupliquer/supprimer
|   |   |   `-- home.module.css
|   |   |-- library/                    # Photothèque VibeOS (2026-08-11 ; dossiers + sauvegarde compte le 2026-08-31) : les photos importees vivent ici et ne sont jamais reimportees
|   |   |   |-- libraryDb.js            # IndexedDB `vibeos-library` v2 : stores `photos` (index addedAt, exif.device, folderId) et `folders`. Base separee de celle des projets. La migration v1 -> v2 range les photos deja presentes dans un dossier de reprise, et `deleteFolderDeep` supprime dossier + photos dans une seule transaction
|   |   |   |-- exif.js                 # Lecteur EXIF maison, sans dependance : APP1 JPEG / TIFF, marque, modele, objectif, ISO, ouverture, vitesse, focale, orientation, date de prise de vue. Ne lit que les 128 premiers Ko et ne rejette jamais
|   |   |   |-- photoImport.js          # Fichier -> enregistrement : decodage oriente (createImageBitmap `from-image`), vignette WebP 1600px stockee une fois pour toutes, EXIF, dimensions, `folderId`, etat de sauvegarde. Rend `null` si le navigateur ne sait pas decoder (HEIC hors Safari)
|   |   |   |-- platform.js             # Reconnaissance iPhone / Android / Mac / Windows / Linux et sources d'import qui vont avec (photothèque, appareil photo, fichiers, dossier entier). Module pur, teste hors navigateur
|   |   |   |-- folderNaming.js         # Nommage a la mode OS : nom du dossier choisi (webkitRelativePath), sinon la date en toutes lettres, suffixe « (2) » si le nom est pris, nettoyage des separateurs. Module pur, teste hors navigateur
|   |   |   |-- libraryQuota.js         # Plafonds 1000 photos ET 5 Go, verifies AVANT l'import : un import trop gros est coupe net avec le nombre de places restantes. Module pur, teste hors navigateur
|   |   |   |-- libraryCloud.js         # Firestore `users/{uid}/libraryFolders|libraryPhotos` + Storage `users/{uid}/library/{photoId}/{preview.webp,original.ext}`. Lecture Blob par chemin SDK authentifié puis URL tokenisée en repli ; la fiche Firestore est écrite EN DERNIER
|   |   |   |-- useLibrarySync.js       # Sauvegarde automatique dans le compte : file d'envoi UN par UN, ecoute des fiches distantes, rapatriement original puis aperçu à la retouche. Le Blob est rendu immédiatement à Vision ; vignette + cache IndexedDB finissent en arrière-plan. Arrêt après 3 échecs ; aucun cloud sans compte réel
|   |   |   |-- masonry.js              # Calcul de la grille en colonnes (placement dans la colonne la plus courte, ordre de lecture preserve) + bornage de la densite selon la largeur reelle
|   |   |   |-- useLibrary.js           # Etat : dossiers + photos, import sequentiel avec progression dans un dossier, renommage, suppression profonde, filtres appareil/look/recherche, tris, quota, cache des URLs d'objet
|   |   |   |-- LibraryScreen.jsx       # Deux vues dans un seul écran : cartes de DOSSIERS et GRILLE masonry. « Retoucher » crée un projet photo puis pousse /creer/vision, avec état Ouverture, verrou anti-double-clic et erreur explicite
|   |   |   |-- FolderCard.jsx          # Carte de dossier : dos + onglet, deux epaisseurs de tirages, couverture, rabat translucide portant le compteur ; renommage sur place, suppression, pastille de sauvegarde
|   |   |   |-- ImportSheet.jsx         # Fenetre d'import : destination (nouveau dossier nomme ou dossier existant), sources adaptees a l'appareil, jauge de quota. Montee seulement quand elle est ouverte
|   |   |   |-- Lightbox.jsx            # Carrousel plein écran : zoom partagé FLIP, vignette avant pleine résolution, rail de 3 diapositives, glissement, frise, clavier. Un aperçu cassé est relancé avec URL versionnée (cache Safari), puis retente l'original avant démontage : jamais d'icône « ? »
|   |   |   `-- library.module.css
|   |   |-- layout/                     # Ecran Layout reel (phase B tranches 1+2+3) - moteurs vibefx-studio importes, jamais reecrits
|   |   |   |-- useLayoutEditor.js      # Composition des moteurs existants (useLayoutState/CanvasRenderer/CanvasEvents/LayoutHelpers/ImageUpload/Export) + fonds generes (applyLayoutMesh/applyLumenBackground/clearGeneratedBackground, smoothBlur), textures multiples + opacite, zones custom (add/update/delete/clear via utils/customLayout), grilles editoriales (applyGridPreset/transformGrid + recompilation au changement de format, sauf grille retouchee a la main), historique undo/redo 30 etats (miroir VibeFxStudio) + Cmd+Z/Shift+Cmd+Z, import par slot, templates thematiques, reprise et sauvegarde du projet (Blobs IndexedDB) + vignette 256px
|   |   |   |-- layoutPersistence.js    # Traduction etat editeur <-> projet VibeOS : images/textures/Lumen en **Blobs** (jamais des dataURL), zones custom, slots, textes, stickers, fond ; restauration en elements Image
|   |   |   |-- LayoutScreen.jsx        # Apercu canvas (drag & drop, plein ecran, undo/redo, comparer, apercu Insta construit depuis le rendu d'export pleine definition) + panneau 4 blocs (Format, Modele, Images, Habillage avec fond Couleur/Flou/Genere + Flou pro) + reglages avances (textes, stickers, zones custom, textures, zone selectionnee, geometrie) + sheet d'export
|   |   |   |-- gridLibrary.js          # Bibliotheque de 24 grilles editoriales : grammaire rangees/colonnes compilee en zones normalisees, deux variantes par grille (portrait 4:5 / carre 1:1) de meme longueur, vides assumes (`void`), miroirs et rotation des photos
|   |   |   |-- gridCatalog.js          # Liste unique partagee par le panneau et la bibliotheque : 24 grilles compilees + les 3 grilles historiques rangees en famille "Classiques", avec le compte par famille
|   |   |   |-- GridCategoryMenu.jsx    # Selecteur de famille dans le panneau : le panneau affiche TOUTE la famille choisie, sans ouvrir la bibliotheque
|   |   |   |-- SlotOverlay.jsx         # Couche posee sur l'apercu, une boite par case : « Importer » au survol d'une case vide ; sur une case pleine, poignee d'echange (haut gauche), corbeille rouge (haut droite) et barre de cadrage (bas) ; case selectionnee = deplacement de la photo a la souris + zoom a la molette. Les commandes s'adaptent a la taille de la case
|   |   |   |-- SlotImportSheet.jsx     # « Ajouter des photos » : fichier de l'appareil ou photo de la bibliotheque VibeOS (lecture directe d'IndexedDB + rapatriement d'une photo qui n'existe que dans le compte). Deux modes : vers UNE case (elle se referme apres le choix) ou import general (elle reste ouverte pour en prendre plusieurs)
|   |   |   |-- GridLibrarySheet.jsx    # Navigateur des grilles (6 familles + recherche) ; chaque carte montre la meme grille en 4:5 ET en 1:1, le format actif encadre. Les 3 grilles historiques y entrent comme grilles figees
|   |   |   |-- ZoneOverlay.jsx         # Editeur de zones du modele personnalise pose sur l'apercu : deplacement, poignee de redimension, suppression (geometrie d'interface uniquement, le rendu reste au moteur)
|   |   |   |-- InstaPreviewSheet.jsx   # Relie les sorties JPEG exactes de Layout au téléphone Instagram (post, story, panorama)
|   |   |   |-- PublicationPhoneShell.jsx # Copie adaptee du châssis iPhone Second Vie : scène 430×910, écran 402×874, mise à l'échelle sans fausser les proportions
|   |   |   |-- InstagramPublicationPreview.jsx # Copie adaptee du feed Instagram Second Vie, alimentée par les rendus Layout ; carrousel clic/swipe/trackpad + story 9:16 ; hauteur du média calée sur le VRAI ratio du post (borné 4:5 ↔ 1,91:1 comme Instagram)
|   |   |   |-- instagramPhone.module.css # Traduction CSS pixel pour pixel des classes Tailwind du téléphone source
|   |   |   |-- TemplateSheet.jsx       # Bibliotheque des ~80 templates thematiques (17 categories), apercus dessines depuis les vraies zones/textes
|   |   |   |-- TemplatePreviewSvg.jsx  # Apercu SVG d'un template : zones custom reelles ou silhouettes des 8 modeles integres
|   |   |   `-- layout.module.css
|   |   |-- primitives/
|   |   |   |-- index.jsx               # Button, IconButton, Segmented, Card, Badge, Spinner, Progress, EmptyState, Collapsible, Slider (double-clic reset), TileGrid/Tile, Sheet (lateral desktop / bottom sheet mobile), SearchField, ToastProvider/useToast
|   |   |   `-- primitives.module.css
|   |   |-- project/                    # Le projet commun ET le pipeline de rendu (plan §4.3)
|   |   |   |-- pipeline.js             # Pipeline photo -> Vision -> Layout -> Studio -> export. Une composition marquee avec sa `visionRevision` saute la seconde application de Vision ; les anciens projets gardent le chainage historique
|   |   |   |-- publishProject.js       # Projet -> charge utile de publication : rendu final + `buildSocialImages` (tranches panorama), au format exact qu'attend `normalizeVibeFxDraft`
|   |   |   |-- publishHandoff.js       # Relais du bouton « Publier » vers /publier (singleton de module : des Blobs, donc pas de sessionStorage ; survit a une navigation client, pas a un rechargement)
|   |   |   |-- PipelineSourceNote.jsx  # La ligne « sur quoi tu travailles » affichee par Vision et Studio (composition / photo du projet / import), + le rappel « ton reglage Vision est deja applique »
|   |   |   |-- pipelineSourceNote.module.css
|   |   |   |-- projectModel.js         # Modele projet v1 (format, template, images, `composition` (Blob PNG publie par le Layout), vision, studio, soundtrackTrackId, thumbnail) + normalisation defensive
|   |   |   |-- projectDb.js            # IndexedDB `vibeos` (stores projects + meta), degrade en no-op si indisponible, recents limites a 8
|   |   |   `-- VibeOsProjectProvider.jsx # Contexte du projet qui circule : autosauvegarde debouncee 800ms, flush sur pagehide, create/open/duplicate/remove/ensureProject
|   |   |-- shell/
|   |   |   |-- VibeOsShell.jsx         # Bandeau superieur unique (nav espaces + mini-lecteur + Publier) + tab bar basse mobile safe-area
|   |   |   |-- MiniPlayer.jsx          # Mini-lecteur du header, visible seulement si une piste est chargee, clic titre -> /creer/son
|   |   |   |-- PublishButton.jsx       # « Publier » (phase F) : rend le projet via le pipeline, depose le resultat dans publishHandoff, ouvre /publier ; desactive tant qu'il n'y a ni composition ni photo
|   |   |   `-- shell.module.css
|   |   |-- shared/                     # Composants partages entre ecrans (sheets de fonds generes sortis de layout/ a la phase D, avant/apres ajoute le 2026-08-11)
|   |   |   |-- BeforeAfter.jsx         # Avant/apres reel : l'original superpose au rendu et revele par `clip-path` (rien n'est demonte, donc aucun clignotement), 3 modes (rideau deplacable souris/doigt/fleches, cote a cote, maintien), position ecrite directement sur le noeud DOM pendant le geste. Le cadre porte le **rapport de la photo** (prop `ratio` -> `aspect-ratio`) : sans lui, une photo verticale s'etalait sur toute la largeur de la scene
|   |   |   |-- beforeAfter.module.css
|   |   |   |-- MeshSheet.jsx           # Fond Mesh gradient : 4 couleurs editables, 6 palettes, melange, apercu CSS (meshPreviewStyle exporte) ; rendu final par renderLayoutMeshBackground (moteur existant)
|   |   |   |-- LumenSheet.jsx          # Fond Lumen : meme app embarquee /vendor/lumen + protocole postMessage que l'ancien modal, habillage VibeOS
|   |   |   |-- GradientSheet.jsx       # Fond Gradient Builder : iframe /vendor/gradient-builder en Sheet `full`, protocole postMessage (vibefx:capture-gradient -> gradient:use-background), reutilise l'emplacement background.lumen
|   |   |   |-- SmoothBlurSheet.jsx     # Flou pro : pilote la config du moteur partage vibefx-shared/smoothBlur (looks rapides, aleatoire safe, direction/hauteur/intensite/finesse)
|   |   |   `-- generators.module.css
|   |   |-- soundtrack/                 # Ecran Soundtrack reel (phase E) - hooks, services et APIs musique existants importes, jamais reecrits
|   |   |   |-- useVibeOsSoundtrack.js  # Assemblage : useLocalSoundtrackLibrary + useProjectSoundLibrary + useSoundtrackSearch (intacts) branches sur le provider audio global ; index des pistes, file de lecture, resolveur de source (Blob local prioritaire), « + bibliotheque » et « Utiliser dans VibeCut » (store video partage puis /video)
|   |   |   |-- SoundtrackScreen.jsx    # Colonne gauche 260px (Rechercher/Accueil, Bibliotheque projet/locale/imports recents, 4 Sources) ou tab bar interne + bouton « + » sur mobile ; vues Accueil (rangees de cartes), Recherche et bibliotheque/playlist
|   |   |   |-- TrackList.jsx           # Pochettes generees (teinte deterministe par piste), mosaique d'en-tete, lignes de piste (badge de licence traduit en francais, duree [data-numeric], actions au survol, egaliseur sur la piste en cours) et cartes de rangee
|   |   |   |-- PlayerBar.jsx           # Lecteur fixe 72px desktop (pochette, transport, progression, volume, « Utiliser dans VibeCut ») et mini-barre mobile ouvrant le lecteur plein ecran
|   |   |   |-- ImportSheet.jsx         # Les 4 sources en Sheet : Import IA (Aitra Free / Pixabay par theme), Pixabay (fichier telecharge + licence pre-remplie), Fichier local (fichiers ou dossier), URL directe - toute la mecanique vient de services/soundtrackImportFlows.js
|   |   |   `-- soundtrack.module.css
|   |   |-- studio/                     # Hub creatif Apple-dark : deux mini-apps de fond, Gradient et Lumen
|   |   |   |-- ambianceCatalog.js      # Ancien catalogue d'ambiances conserve pour compatibilite des projets, plus monte par StudioScreen
|   |   |   |-- customStyles.js         # Ancien stockage de styles perso, conserve pour ne pas detruire les donnees locales
|   |   |   |-- useStudioEditor.js      # Ancienne orchestration photo conservee pour compatibilite moteur, plus montee par /creer/studio
|   |   |   |-- useStudioGenerators.js  # Pont leger mini-app -> Blob IndexedDB -> background.lumen du projet, identification Gradient/Lumen et retrait
|   |   |   |-- StudioScreen.jsx        # Hero compact + deux grandes cartes Gradient/Lumen ; ouverture immersive bord a bord sous le bandeau VibeOS, Mesh absent
|   |   |   `-- studio.module.css
|   |   |-- vision/                     # Ecran Vision reel (phase C) - science des couleurs existante importee, jamais reecrite
|   |   |   |-- presetCollections.js    # Modele pur de classement/recherche des presets Vision : collections ordonnees, filtrage accent-insensible et filtre Favoris combinable avec la recherche
|   |   |   |-- useVisionEditor.js      # Orchestration Vision : catalogue Lightroom, historique, aperçu/export et ordonnanceur de miniatures visible-first avec annulation + cache de session
|   |   |   |-- usePresetFavorites.js   # Favoris Vision owner-scoped : listener Firestore temps reel sous users/{uid}/visionPresetFavorites, bascule optimiste et rollback sur refus
|   |   |   |-- presetPreview.js        # Miniatures 192x116 : source réduite une fois, même applyFiltersPro que canvas/export, sortie Blob plutôt que data URL
|   |   |   |-- autoEnhance.js          # « Ameliorer ma photo » : correction deduite des mesures + phrase humaine. Se cumule au preset, qui porte le look
|   |   |   |-- VisionScreen.jsx        # Vision complet + cartes observées par IntersectionObserver : viewport urgent, marge suivante préchargée, cache conservé entre collections
|   |   |   `-- vision.module.css
|   |   `-- styles/
|   |       `-- vibeos.css              # Tokens `--vo-*` copies de vibecut.css, scope strict `.vibeos` (sombre, theme clair pret)
|   |   |   |-- haldClut.js            # Capture d'un preset externe par Hald CLUT : mire identite, relecture d'une mire traitee vers une LUT 33^3, detection d'une mire non traitee, base64. Depuis le lot J : `measureHaldRoughness` (une table BRUITEE = du grain dans le preset, qui corrompt chaque couleur de la mire) et `smoothHaldCube` (noyau [1,2,1] par axe ; ne deplace une table deja lisse que de 0,05/255). C'est ce qui permet d'importer un preset Lightroom EXACTEMENT, sans reimplementer Camera Raw
|   |   |   |-- xmpPreset.js           # Lecture d'un .xmp Lightroom/Camera Raw : recupere les reglages SPATIAUX qu'une Hald CLUT ne peut pas capturer, dont clarte, texture, nettete, reduction du bruit luminance/couleur, grain et vignetage. La couleur ne vient PAS d'ici
|   |   |   |-- presets/               # Presets importes de Lightroom (GENERE par scripts/import-lightroom-preset.mjs) : un module par preset, portant sa table en base64 + ses reglages spatiaux. Familles Lightroom Cloud completes au 2026-08-30 : Cinema CN01-CN10, Cinema II CN11-CN18, Futuriste FT01-FT12, 12 looks film, Noir et blanc BW01-BW12, Vintage VN01-VN10, Architecture UA01-UA10, Paysage LN01-LN10, Style de vie LF01-LF08, Voyage TR01-TR18 et Saisons SP01-SP12 / SM01-SM11 / TM01-TM12 / WN01-WN10. REFERENCE DE CALIBRATION, pas des looks de production (licence Adobe, cf docs/lightroom/3-cn11-cn17-mesures.md)
|   |   |   |-- lut3d.js                # Moteur LUT 3D : buildLut3d evalue une fonction de preset sur une grille 33^3, applyLut3d l'applique par interpolation trilineaire en UNE passe. Cout de rendu constant : ajouter un preset ne coute rien
|   |   |   |-- visionPresets.js         # Les presets Vision, ecrits comme des fonctions pures sRGB->sRGB dans l ordre Lightroom (courbe -> melangeur TSL -> desaturation hautes lumieres -> virage split). `powlisher`, reconstruit par mesure (cf docs/audit-preset-powlisher-2026-08-11.md), `powlisher-ciel` (le ciel CONVERGE vers la teinte ou atterrissent ses ciels, 190-199 deg, au lieu d etre tourne d un angle fixe) et `powlisher-showcase` (clair-obscur: creux de saturation qui vide le decor et laisse le sujet seul colore, plus des effets non-LUT via `spatialFilters`). La regle du ciel est partagee (`regleDuCiel`)
|   |-- vibefx-shared/
|   |   `-- utils/
|   |       `-- smoothBlur.js           # Moteur partage du Flou lisse pro : normalisation, looks rapides, random safe, reset clean, courbes, masques preview et rendu canvas
|   |-- config/
|   |   `-- aiLaunch.js                 # Flag de lancement IA, registre surfaces IA, localStorage/cookie override backoffice
|   |-- hooks/
|   |   `-- useAiLaunchSettings.js      # Hook client useSyncExternalStore pour activer/masquer localement les surfaces IA
|   `-- lib/
|       `-- firebase.js                 # Client Firebase NEXT_PUBLIC_*
|-- .env.example                        # Variables publiques + secrets a creer, dont connecteurs musique serveur, IA, et Export Pro Vibe_CUT localMock/Cloud Run
|-- .env.emulators.example              # Variables demo pour brancher le client aux emulateurs + connecteurs musique optionnels
|-- .gitignore
|-- AGENTS.md                           # Regles agents du projet
|-- apphosting.yaml                     # Base Firebase App Hosting + variables publiques App Hosting, dont NEXT_PUBLIC_VIBECUT_EXPORT_MODE=firebase
|-- storage.cors.json                   # CORS du bucket Bibliothèque : App Hosting, domaines Firebase et localhost autorisés en GET/HEAD pour le rapatriement des originaux dans Vision
|-- fav.md                              # Tache et plan favoris permanents de la bibliotheque
|-- CLAUDE.md                           # Fichier genere, non encore enrichi
|-- eslint.config.mjs
|-- firebase.json                       # Config Firebase backend + emulateurs + source deploy App Hosting cible `vibefx-v2-web`
|-- firestore.indexes.json
|-- firestore.rules                     # Rules ownerUid + users/ledger/jobs/payments/videoExportJobs sensibles
|-- jsconfig.json
|-- MEGAPROMPT.md                       # Prompt maitre de conception/deploiement
|-- next.config.mjs
|-- package.json                        # Next.js + Firebase + lucide + three + commandes import:pixabay-ai, tests Vibe_CUT export et dry-run K1
|-- package-lock.json
|-- README.md
|-- seo.md                              # Agent SEO Google
|-- skills-lock.json                    # Lock des 23 skills importes
|-- test-fixtures/
|   `-- vision-corpus/
|       `-- README.md                   # Instructions de depot local des 12 images smartphone ignorees par Git
|-- vibecut-video-samples/
|   |-- HDRSample.mkv                   # Fixture video HDR Windows pour tests Vibe_CUT
|   `-- SDRSample.mkv                   # Fixture video SDR Windows pour tests Vibe_CUT
|-- scripts/
|   |-- audit-smooth-blur.mjs          # Audit statique du Flou lisse pro : bornes sliders, directions, presets, courbes et masques
|   |-- audit-secrets.mjs               # Audit anti-secrets hardcodes dans les fichiers versionnables
|   |-- audit-scope.mjs                 # Audit automatique scope Functions, SEO, modules et termes source
|   |-- audit-vibecut-export-hardening-requirements.mjs # Audit structure par exigences du megaprompt Export Pro : phase done/partial/blocked, preuves code/docs et no-go release
|   |-- check-deploy-target.mjs         # Refuse un deploiement sans projet Firebase dedie
|   |-- check-vibecut-export-local-prereqs.mjs # Check prerequis locaux Export Pro : K1, ffmpeg/ffprobe via PATH/env/chemins Windows, Java emulateurs
|   |-- check-vibecut-export-release-gate.mjs # Gate non mutant release Export Pro : echoue tant que K1 live, fixtures MP4, emulateurs Java et phases partial ne sont pas prouves
|   |-- guard-vibecut-k1-live-smoke.mjs # Sas non mutant avant smoke live K1 : exige confirmation exacte, refuse execution live directe et verifie gates/env/prerequis
|   |-- prepare-vibecut-k1-live-smoke.mjs # Dry-run non cloud du smoke final K1 : verifie deux sources locales, construit le manifest attendu MP4/H.264/AAC et rappelle la confirmation requise
|   |-- run-vibecut-k1-cloud-run-live-smoke.mjs # Smoke live callable Firebase K1 : upload Storage, createVideoExportJob, attente ready, URL de download et sauvegarde K1, bloque sans confirmation + VIBECUT_EXECUTE_LIVE=1
|   |-- run-vibecut-k1-cloud-run-direct-smoke.mjs # Smoke live direct renderer Cloud Run K1 : upload Storage, POST HMAC /render, rotation gauche 270, crossfade, texte fade et telechargement MP4 dans K1
|   |-- render-vibecut-xfade-transitions-local-smoke.mjs # Preuve locale L1 : un MP4 reel par transition minutee, commande construite par le renderer lui-meme
|   |-- smoke-vibecut-xfade-preview-parity.mjs # Compare image par image l'apercu canvas et le rendu FFmpeg de chaque transition (Chromium + ffmpeg-static) ; itere sur les IDS et construit le cote FFmpeg avec buildTransitionSubgraph du renderer
|   |-- smoke-vibecut-transition-chain-mp4.mjs # TROIS plans enchaines en MP4 reel : compte d'images exact, les deux coupes portent l'effet, hors fenetre rien ne bouge
|   |-- smoke-vibecut-transition-cost.mjs # Plafond de cout : 1,2 s pour une transition de 0,6 s en 1080p, graphe construit par le renderer
|   |-- smoke-vibecut-transition-sentinels.mjs # Rejoue 5 defauts sur le code de production et exige que les tests echouent
|   |-- smoke-vibecut-motion-preview-parity.mjs # Gate du lot L3 : MP4 reels rendus par la commande du renderer, compares image par image a `mediaModel.applyImageMotionTransform` dans Chromium. Trois assertions : parite, effet reel de l'intensite, et sentinelle (un apercu remis en lineaire DOIT echouer)
|   |-- smoke-vibecut-library-parity.mjs # Gate de la phase 5 : chaque entree de catalogue existe dans le moteur ET est declaree par le serveur ; alias xfade explicites, probleme I verifie sur les six mouvements, courbe lineaire interdite tant que le serveur ne la declare pas, chemin d'ecriture unique
|   |-- smoke-vibecut-library-v2.spec.cjs # 9 tests navigateur des bibliotheques : mesure des PIXELS du canvas d'apercu, verification des controles par leur ABSENCE, aller-retour bibliotheque -> montage
|   |-- check-vibecut-renderer-image-capabilities.mjs # Pre-vol du lot L6 : interroge `ffmpeg -h filter=xfade` localement, ou le point de controle `/capabilities` du service DEPLOYE. Aucun deploiement, aucun rendu
|   |-- smoke-vibecut-transition-parity.mjs # Verifie que renderer, manifeste, Functions et moteur d'apercu declarent le meme jeu de transitions
|   |-- render-vibecut-k1-local-mp4-smoke.mjs # Smoke local non Cloud FFmpeg : produit un MP4 K1 1080x1920 H.264/AAC avec rotation, crossfade, texte et verifie codec/duree/frames non noires
|   |-- render-vibecut-pro-fixtures-local-smoke.mjs # Smoke local non Cloud FFmpeg : genere les MP4 fixtures pro supportees, verifie H.264/resolution/duree/audio/frames et region texte
|   |-- render-vibecut-renderer-local-contract-smoke.mjs # Smoke local non Cloud du renderer canonique : importe buildFfmpegArgs du service Cloud Run, rend K1 + fixture combinee et verifie MP4
|   |-- prepare-vibecut-pro-fixtures.mjs # Dry-run non cloud des fixtures pro : texte statique, animation bloquee, crossfade, colorimetrie, audio externe et pile combinee
|   |-- smoke-backoffice-export-telemetry.mjs # Smoke test helpers dashboard exports video : estimations internes + couts Google Billing Export BigQuery sans Firebase live
|   |-- provision-admin-doc.mjs          # Script Node Admin SDK pour creer admins/{email} Firestore via service account ou ADC
|   |-- provision-admin-firestore-rest.mjs # Script REST Firestore pour creer admins/{email} via token firebase-tools cached (utilise pour matthis.fradin2@gmail.com)
|   |-- check-e2e-readiness.mjs         # Liste les prerequis Firebase/Meta manquants avant E2E reel
|   |-- check-emulator-readiness.mjs    # Verifie firebase-tools, Java 21+ et config emulators
|   |-- check-pixabay-provider.mjs      # Probe reseau Pixabay Music depuis Node : detecte 403/challenge et confirme si des URL audio CDN sont exposees
|   |-- import-pixabay-ai-music.mjs     # Scraper/import local Playwright pour https://pixabay.com/music/search/ai-generated/, limite, sans contournement challenge, avec manifest droits
|   |-- check-vision-corpus.mjs         # Verifie les 12 fixtures smartphone locales ignorees par Git
|   |-- audit-vision-presets.mjs        # Audit chiffre des presets Vision : BANDES (plus gros saut dans un degrade lisse, le risque n1 d'une LUT), dominante sur l'axe des gris, derive teinte/sat/lum sur des couleurs temoins
|   |-- check-hald-control.mjs         # Controle a vide de la chaine Lightroom AVANT toute capture : accepte la mire historique 512 et la mire de production 2048 en blocs 4x4, dont il moyenne le coeur exactement comme l'importeur; la mire neutre doit revenir a l'identite (<=2/255)
|   |-- make-hald-clut.mjs             # Genere la mire Hald. Depuis le lot J elle est en BLOCS de 4x4 pixels par couleur (2048x2048) avec profil sRGB explicite : une couleur par pixel faisait baver les couleurs entre voisines et virait les noirs au vert
|   |-- mesure-grain-lightroom.mjs     # Combien vaut le grain de Lightroom, et combien vaut le notre, carre par carre sur la mire A. Lit le COEUR des aplats (marge de 30 px: tout effet spatial bave sur les bords) et extrait le grain EN QUADRATURE (sqrt(total^2 - base^2), jamais la difference brute). C'est lui qui a montre que le « x8 » etait faux (x2,66) et, surtout, que l'ecart n'etait pas un facteur mais une FORME: plat chez lui, cloche chez nous. `--planche` sort les trois versions cote a cote a l'echelle 1:1
|   |-- make-mire-largeur.mjs          # La mire A DESSINEE a n'importe quelle largeur. Dessinee, jamais redimensionnee: agrandir au plus proche voisin marche (les aplats restent unis), mais REDUIRE melange les bords des carres et fabrique des pixels qui n'existent dans aucun aplat. C'est elle qui a permis de mesurer le grain a 810 et 1080 px, la ou sortent les images sociales
|   |-- mesure-grain-canaux.mjs        # Son grain CANAL PAR CANAL. Soustrait l'export SANS RIEN de l'export AVEC GRAIN pixel a pixel: la difference EST son champ de grain. Donne l'ecart-type de chaque canal, la CORRELATION entre canaux (1,00 = un seul bruit, 0,00 = trois bruits tires separement — c'est elle qui a tranche) et la proportion de pixels ECRETES, qui explique pourquoi deux canaux du meme aplat ne portent pas le meme grain
|   |-- mesure-grain-photo.mjs         # Le grain sur une VRAIE photo. Floute large (12 px, jamais 3: un voisinage etroit sous-estime un grain de 2,4 px), choisit les blocs les plus PLATS, et compare son residu au notre — chaque cote moins SON PROPRE flou. `--sansgrain <photo>` retire en quadrature le bruit de fond de sa chaine, lu sur les MEMES blocs d'une version developpee sans grain
|   |-- planche-grain.mjs              # La planche du grain sur une VRAIE photo: sans grain / ancien moteur a 20 / nouveau a 8, a l'echelle 1:1 et jamais redimensionnee (reduire une image MOYENNE son grain, une planche reduite mentirait sur ce qu'elle montre). Repond a ce qu'aucun ecart-type ne dit: est-ce que le recalage abime le rendu
|   |-- make-mire-effets.mjs           # Les mires d'EFFETS, l'exact oppose de la Hald : elles mesurent ce qui depend des pixels VOISINS (grain, clarte, texture, nettete) ou de la POSITION (vignetage), la ou une Hald est aveugle par construction. Quatre, parce que chaque effet a besoin d'un fond qui le rend lisible et que ces fonds s'excluent : A aplats unis (sur un aplat, toute variation EST le grain), B bandes unies plein cadre (le vignetage MULTIPLIE-t-il ou soustrait-il ?), C bords et reseaux SINUSOIDAUX 8/24/64 px (un bord net contient toutes les frequences a la fois, donc il ne separerait pas nettete/texture/clarte), D image delavee (le voile n'a rien a corriger sur une image nette). 1620x1080 = la taille ou l'on publie : le grain depend de la resolution. Protocole : docs/lightroom/4-synchro-effets.md
|   |-- compare-preset-vs-lightroom.mjs # La validation qui compte : notre rendu vs le rendu Lightroom sur une VRAIE photo, avec centiles. Applique l'orientation EXIF, sinon les deux images n'ont meme pas la meme taille. Convertit les deux cotes en sRVB par ColorSync (les JPEG recents sont en P3 : sans ca l'instrument est decale de 0,80/255). Depuis le 2026-08-19 il rend DEUX fois — couleur seule (LUT, en Node) et rendu COMPLET (renderStudio dans un Chromium, effets spatiaux compris) — ce qui donne l'ATTRIBUTION de l'ecart ; et il mesure la MATIERE (gradient) en separant contours et zones plates, parce qu'un effet peut avoir la bonne force ET faire monter l'ecart pixel a pixel. Grain force a 0 : deux bruits aleatoires ne se comparent pas. `--sans-effets` revient au comportement d'avant, `--sortie` ecrit notre rendu
|   |-- compare-vision-presets-on-photos.mjs # Comparaison des presets sur de vraies photos : ECRETAGE ajoute (matiere detruite), force du look, derive du ciel/vegetation/peau
|   |-- mesure-ciel-powlisher.mjs       # OU LE CIEL ATTERRIT, et le score des presets face a cette cible. Repond a ce qu aucun autre outil ne mesure : que devient le ciel Y COMPRIS les pixels desatures jusqu au blanc. Affiche expres la part partie au blanc A COTE de la teinte — c est en l oubliant qu on avait conclu l inverse de la verite (biais de selection). `--photo <f>` note les presets sur UNE DE NOS PHOTOS, dont on connait l origine (l ancienne paire avant/apres du photographe est ecartee : passee par une IA generative)
|   |-- aligner-paire-avant-apres.mjs # ALIGNE ses deux captures d'ecran « Avant / Apres » et en sort deux images superposables. Sans ca on comparerait le ciel d'une image au toit de l'autre : le cadre ne tombe pas au meme endroit d'une capture a l'autre, et une des trois paires est en plus RECADREE de 2,6 %. L'alignement se fait sur le GRADIENT, jamais sur la couleur — c'est justement la couleur qui change. Coupe le fond NOIR de Lightroom (5 300 blocs a zero dans une des paires) en cherchant la plus longue suite de lignes non noires, parce qu'un balayage depuis le bord s'arrete sur le mot « Avant » que Lightroom pose DANS la bande
|   |-- mesurer-paires-powlisher.mjs # Ce que son traitement fait, mesure sur des paires ALIGNEES : la seule source du projet ou l'on connait l'ENTREE ET la SORTIE de la meme image. Compare des BLOCS de 8x8 plats, jamais des pixels — deux captures rejouees ont du bruit JPEG, et au pixel chaque contour fabrique une fausse couleur. Sert aussi de bibliotheque (`blocs()`)
|   |-- ajuster-preset-sur-paire.mjs # (voir aussi `--cadre-entier`, et l'ajustement de la courbe sur la CORRESPONDANCE DE NIVEAUX plutot que sur la mediane du dE: les LED d'une station pesent 3,5 % des blocs, une mediane ne les voit pas et l'oeil ne voit qu'elles)
|   |-- ajuster-preset-sur-paire.mjs # AJUSTE un preset entier (courbe, virage, melangeur, ciel) sur UNE paire avant/apres, en retirant d'abord le MASQUE LOCAL de la photo. Sans ca on mesure un assombrissement local et on le prend pour un virage: sur la paire de nuit, la meme couleur d'entree sort a L* 64,8 en haut du cadre et a L* 2,8 en bas. Boucle: estimer le masque contre un preset de reference, le ramener a son plateau, corriger, ajuster, re-estimer. Et la couleur ne s'ajuste QUE la ou la correction est faible (un diaphragme au plus) — rebrillanter de quatre diaphragmes un JPEG quasi noir fabrique du bruit amplifie, pas de la couleur: c'est ce qui voulait tourner l'orange de +32 degres sur la foi de 1 065 blocs de sol remonte
|   |-- verifier-presets-sur-paires.mjs # LE CLASSEMENT DES PRESETS FACE A LA VERITE TERRAIN, en DEUX tableaux. SANS exposition libre: le preset applique tel quel, c'est ce qu'on voit dans l'app, et c'est le chiffre qui a fait naitre `powV2`. AVEC exposition libre: chaque candidat recoit le gain qui l'arrange et on ne compare plus que la COULEUR — utile parce que ses trois retouches sont a -1,85 / -0,22 / -0,56 EV, son curseur et pas un preset. Ecart dE76 median par paire
|   |-- planche-presets.mjs           # LA PLANCHE A REGARDER: chaque photo passee dans tous les presets, cote a cote, dans un seul PNG. Repond a la seule question qu aucune mesure ne couvre — « est-ce que ca a l air bien ? » — et qui a fait supprimer trois presets. Photos de test: Unsplash, parce qu elles sont PEU RETOUCHEES (celles d un corpus de reference sont deja des edits finis). Montre la LUT seule: grain, vignetage et relief s appliquent dans l app
|   |-- planche-showcase.mjs          # LA PLANCHE AVEC LES EFFETS. `planche-presets.mjs` ne montre que la LUT, et le dit; or grain, vignetage et relief ne SONT pas dans la LUT. Celle-ci lance donc le VRAI moteur (studioRenderer) dans un Chromium, en servant src/ en statique: ce qu'on regarde est ce que l'app affiche. Sort deux planches — le cadre entier (vignetage, look) et un carre a 1:1 JAMAIS redimensionne (grain, relief), parce que reduire une image MOYENNE son grain. Imprime aussi l'assombrissement du vignetage en niveaux /255
|   |-- verifier-neutre.mjs           # LE TRI DU TAS NEUTRE, et surtout ce qu'il NE fait PAS. `trier-biblio.mjs` pose trois questions; la troisieme (« porte-t-elle le meme traitement ? ») serait une FAUTE ici — dans le tas neutre l'heterogeneite est la qualite recherchee, et ecarter les photos atypiques reviendrait a lui fabriquer un style. Ne garde donc que « est-ce une photo ? », plus les quasi-doublons (dHash 16x16: l'empreinte 8x8 du projet a ete essayee et jetee, sur des couchants elle ne decrit plus rien). Sort une planche, parce que « est-ce vraiment un couchant ? » ne se tranche qu'a l'oeil
|   |-- grouper-couchants.mjs         # Range SES couchants en sous-familles appariees au tas neutre (`coucher-mer`, `coucher-paysage`, `coucher-ville`). Sans ca ils restent etiquetes `mer` ou `auto` et sont compares a des plages de MIDI: on mesurerait la scene et pas le traitement. La selection est faite A L'OEIL et c'est assume — aucun seuil ne separe « couchant » de « pas couchant » sans filtrer sur la chaleur, or c'est la chaleur qu'on va mesurer
|   |-- ciel-couchant-1-1.mjs         # LE DEGRADE DE CIEL A 1:1, JAMAIS REDIMENSIONNE. C'est le gradient le plus dur de la photographie pour une LUT: orange a l'horizon, bleu au zenith, en passant par la chroma quasi nulle — la ou un split-tone comprime les teintes voisines. Une planche reduite MOYENNE les pixels et cacherait une bande de deux niveaux qui se verra en plein chez l'utilisateur. Choisit seul le ciel le plus LISSE du tas neutre, celui qui revele une bande s'il y en a une, et montre le temoin non traite a cote
|   |-- mesure-mire-c.mjs             # L'instrument de la mire C: amplification zone par zone d'un export Lightroom (nettete, texture, clarte). Les trois reseaux SINUSOIDAUX font foi — un sinus ne contient qu'une echelle, une barre nette les contient toutes. Ne lit que le COEUR de chaque zone (marge 70 px). La raideur du bord doux se mesure sur profil LISSE: en brut, elle lisait le maximum du BRUIT (2,00 la ou la transition vaut 1,26) et faisait passer du bruit ajoute pour un bord raidi
|   |-- rendu-mire-c.mjs              # Le symetrique du precedent: passe la mire C dans NOTRE moteur, dans un Chromium (les etages spatiaux s'appuient sur ctx.filter = blur(), qui n'existe pas en Node — les reimplementer donnerait un chiffre sur du code que personne n'execute). `--safeSmartphone false` pour mesurer au-dela des bornes sures
|   |-- audit-reglages-avances.mjs     # LE BANC D'ESSAI DES REGLAGES: passe chacun des 31 reglages supportes dans le VRAI moteur (Chromium, renderStudio) a plusieurs valeurs, garde-fous actifs ET coupes, et mesure ce qui bouge a l'ecran. Repond a « ce reglage fait-il quelque chose », la question qu'aucun test statique ne pose. Mire batie expres: rampe de gris, peaux, ciel, feuillage, NEONS (sans haute lumiere COLOREE la halation parait morte alors qu'elle est faite pour ca), reseaux sinusoidaux, voile. Verdict a DEUX criteres — moyenne OU ecart franc sur une part du cadre — parce qu'un effet local a une moyenne minuscule sans etre invisible
|   |-- audit-vision-filters.mjs        # Audit statique des profils Vision et du branchement safe smartphone, incluant temperature/halation/tint global masques
|   |-- firebase-deploy.mjs             # Wrapper cross-platform deploy backend/functions avec cible controlee, firebase-tools local et timeout discovery 60s
|   |-- run-video-ui-test.mjs           # Lance un serveur Next local dedie puis les smokes Playwright Vibe_CUT fonctionnel + securite media/capacites avec SMOKE_BASE_URL controle
|   |-- run-firebase-emulators-test.mjs # Wrapper test:emulators : exige Java 21+ via VIBECUT_JAVA_HOME/JAVA_HOME/PATH/chemins Windows puis lance firebase emulators:exec
|   |-- smoke-firebase-emulators.mjs    # Smoke test Auth/Firestore/Storage rules sous emulateurs, incluant credits/jobs/payments
|   |-- smoke-export-professional-settings.mjs # Smoke pur du module Export Pro : presets sociaux/custom, PNG/JPEG/WebP, filename, estimation, queue, echec et comparaison canvas
|   |-- smoke-account-deletion.mjs      # Smoke test suppression compte serveur sans droits client sensibles
|   |-- smoke-billing-products.mjs      # Smoke test mapping produits Stripe sans exposer les price IDs cote public
|   |-- smoke-billing-ledger.mjs        # Smoke test fulfillment Stripe idempotent et ledger credits sans emulateur
|   |-- smoke-ai-gateway.mjs            # Smoke test policies/router/idempotence pure de la gateway IA mock
|   |-- smoke-ai-ledger.mjs             # Smoke test transactionnel reserve/capture/release IA + securityEvents sans emulateur
|   |-- smoke-app-check.mjs             # Smoke test de la politique App Check enforce par defaut hors emulateurs
|   |-- smoke-publication-flow.mjs      # Smoke test rejouable du parcours publication sans Firebase reel
|   |-- smoke-routes.mjs                # Smoke test HTTP des routes SEO/studio + noindex compte
|   |-- fixtures/
|   |   `-- pixabay-music-search.html   # Fixture HTML locale pour parsing provider Pixabay Music importable + metadata-only
|   |-- smoke-soundtrack-core.mjs       # Smoke pur Soundtrack V2 : mapping ProviderTrack -> ProjectSoundTrack, droits, cache key provider, parsing historique Pixabay, manifest sans Blob/File
|   |-- smoke-video-timeline-model.mjs  # Smoke test pur du modele timeline/export Vibe_CUT : tracks/items, render plan, trous/overlaps, fps/codec, plan de frames, durees non finies et grille snap bornee
|   |-- smoke-video-store.mjs           # Smoke test pur du store Vibe_CUT : mutations, overlaps, rejet Infinity/NaN et preservation d'une duree media valide
|   |-- smoke-vibecut-export-manifest.mjs # Smoke test pur ExportManifest : MP4/H.264/AAC, modes qualite, sources, couts, couverture renderer et registre central des capacites publiees
|   |-- smoke-vibecut-export-media-metadata.mjs # Smoke test pur metadata output front : mapping container/codec/MIME MP4/WebM/MOV/images et codecs H.264/H.265/VP9/AV1/ProRes/DNxHR
|   |-- smoke-vibecut-export-jobs.mjs   # Smoke test services Export Pro localMock + garde-fous UI contre localMock force, choix destination PC et fallback URL Storage
|   |-- smoke-vibecut-export-functions.mjs # Smoke test pur Functions Export Pro : quotas MVP, chemins sources owner-scoped, resume manifest et callable URL MP4
|   |-- smoke-vibecut-render-service-contract.mjs # Smoke statique renderer Cloud Run : signature timestamp, README coherent, drawtext fade/none, colorimetrie FFmpeg, mix audio et refus des features visibles non rendues
|   |-- smoke-vibecut-export-coverage-parity.mjs # Smoke parite coverage : compare client, Functions et renderer sur features supportees/bloquees pour eviter les derives silencieuses
|   |-- smoke-vibecut-export-runbook.mjs # Smoke statique du runbook Export Pro : variables, secrets, OIDC, deploy Cloud Run, gates et confirmation smoke live
|   |-- smoke-vibecut-export-status-audit.mjs # Smoke statique du statut Export Pro : empeche de masquer les phases partial/not done, Java/emulators, live K1 et renderer frame-by-frame
|   |-- verify-vibecut-k1-cloud-output.mjs # Verificateur post-smoke non Cloud du MP4 K1 telecharge : container/codec/resolution/fps/duree/audio/frames non noires
|   |-- smoke-vibecut-slowmo-samples.spec.cjs # Smoke Playwright HDR/SDR MKV : import des samples Windows, presets ralentis timeline 50%/Normal et duree projet
|   |-- smoke-vibecut-desktop-video-orientation.spec.cjs # Smoke Playwright MVI_0016 Bureau : preset 9:16, detection 60 FPS metadata, rotation header, forçage export 30 FPS et ralenti 50%
|   |-- smoke-vibecut-media-safety.spec.cjs # Smoke Playwright Phase 0 : les WebM a metadata instable ne crashent plus la timeline et les outils preview-only restent desactives
|   |-- smoke-vibeos-layout-b1.spec.cjs # Smoke Playwright Layout VibeOS : import, canvas, formats, modeles, template thematique, export
|   |-- smoke-vibeos-layout-b3.spec.cjs # Smoke Playwright Layout VibeOS : textures, zones custom, stickers, comparaison, apercu Insta, reprise du projet
|   |-- smoke-vibeos-layout-instagram-preview.spec.cjs # Six formats Instagram : dimensions JPEG, vrai châssis iPhone et navigation des 2/3 tranches panorama
|   |-- smoke-vibeos-layout-grids.mjs   # Geometrie des 24 grilles editoriales : pas de chevauchement, rien hors cadre, taille minimale du moteur, memes zones en 4:5 et en 1:1, miroirs et rotation
|   |-- smoke-vibeos-layout-grids.spec.cjs # Parcours reel : bibliotheque de grilles, application, recomposition 4:5 -> 1:1, miroir, hauteur du media dans l'iPhone
|   |-- smoke-vibeos-layout-slots.spec.cjs # Cases : une photo importee ne remplit qu'UNE case, import cible depuis une case vide, echange de deux cases au glisser-deposer, remplissage de la case restee vide
|   |-- smoke-vibeos-vision.spec.cjs   # Smoke Playwright Vision VibeOS : analyse, « Ameliorer ma photo », intensite, 12 looks surs sur 5 photos types
|   |-- vision-preview-performance.spec.cjs # Banc Playwright reproductible : première/dernière carte visible, scroll, petite collection, photo/intensité/cache, doublons, thread principal et fidélité CN01/CN14/BW01
|   |-- smoke-reglages-avances.spec.cjs # LE MEME AUDIT, MAIS PAR L'INTERFACE: saisit les vrais curseurs de /creer/vision et /creer/studio et relit le canvas de la page. Ce que le banc d'essai ne peut pas voir: une borne d'interface plus large que celle du moteur, un onChange qui ecrit la mauvaise cle, un rendu qui ne se redeclenche pas. C'est lui qui a trouve que la moitie de la course des curseurs de Studio ne faisait rien. Designe les curseurs par LEUR LABEL, jamais par leur rang: le panneau Vision remonte en tete ce qui n'est plus au repos, donc bouger un curseur DEPLACE les suivants
|   |-- smoke-vibeos-studio.spec.cjs   # Smoke Playwright Studio VibeOS : ambiances rendues sur la vraie image, intensite, « Surprends-moi », variantes, avances, 10 ambiances distinctes
|   |-- smoke-vibeos-soundtrack.spec.cjs # Smoke Playwright Soundtrack VibeOS : import, lecture qui survit au changement de page, recherche, mobile
|   |-- smoke-vibeos-pipeline.spec.cjs # Pipeline bout en bout : Vision modifie la photo, Layout reprend les pixels traites, Studio ne les traite pas deux fois, puis publication ; desktop et mobile
|   |-- smoke-vibecut-ui-v2.spec.cjs   # Smoke Playwright nouveau front : accueil, isolation CSS, regle typographique, cycle projet, noindex des six routes
|   |-- smoke-vibecut-quick-v2.spec.cjs # Smoke Playwright montage rapide : import reel, storyboard, duree, mouvement, transition, texte, musique, export
|   |-- smoke-vibecut-style-recipes.mjs # Smoke pur du moteur de recettes phase 3 : generation sur 5 jeux de scenes x 4 styles x 3 rythmes, et parite mouvements/transitions moteur <-> SERVER_RENDER_CAPABILITIES
|   |-- smoke-vibecut-advanced-v2.spec.cjs # Smoke Playwright montage avance : ordre des sept pistes, bascules de piste, rognage/reorder/deplacement au pointeur, annuler-retablir, tete de lecture, decoupe, zoom, magnetisme, inspecteur, bibliotheque, export 60 fps, responsive 390 px et preuve du moteur d'apercu unique
|   |-- smoke-vibecut-guided-v2.spec.cjs # Smoke Playwright creation guidee : parcours 5 etapes, generation verifiee dans l'apercu, reouverture du meme projet en montage rapide, zero erreur console
|   `-- midjourney-scraper/
|       |-- data/                       # Dossier de travail vide au depart, rempli par scraping local
|       |-- config.mjs                  # Configuration scraper importee depuis Vibe_fx
|       |-- database.mjs                # Catalogue SQLite/local du scraper
|       |-- enhance.mjs
|       |-- fast-scraper.mjs
|       |-- NOTICE.md
|       |-- README.md
|       |-- recover.mjs
|       |-- scraper.mjs                 # Runner scraping appele par les routes API Next
|       |-- server.mjs                  # Serveur source conserve comme reference
|       `-- test_classifier.mjs
`-- storage.rules                       # Rules Storage user-scoped uploads/publications/AI/exports, sources export owner-write et outputs owner-read
```

## Pages actuelles

- `/` : page d'accueil SSR unique avec hero cyber-neon/dark-ui, CTA `Launch app`, cartes de caractéristiques descriptives, FAQ complète, et pipeline de routage SVG animé (PublicationRoutePipeline).
- `/studio` : entree noindex vers le studio Vibe_fx importe.
- `/pricing` : page publique indexable pour l'offre lifetime 9,99 EUR, sans abonnement ni credits IA visibles au lancement.
- `/account`, `/account/billing`, `/account/usage` : surfaces privees noindex pour profil, facturation et usage ; les controles credits/jobs IA sont masques quand le lancement IA est desactive.
- `/backoffice` : surface temporaire noindex non securisee Firebase, expose la cartographie des surfaces IA, un switch localStorage/cookie pour remettre ou masquer les interfaces IA en un clic pendant les tests, et un dashboard exports video/couts estimes limite aux jobs lisibles par le compte connecte.
- `/outil-publication-reseaux-sociaux`, `/editeur-image-instagram`, `/publier-instagram-facebook`, `/templates`, `/ressources/meta-oauth-publication-instagram-facebook`, `/ressources/formats-instagram` : pages SEO SSR indexables avec metadata, canonical, JSON-LD et liens internes.
- `/api/themes`, `/api/catalog`, `/api/status`, `/api/scrape`, `/api/image/*`, `/api/proxy-image`, `/api/reclassify/*`, `/api/reset` : API internes pour la bibliotheque Midjourney et son scraping local.
- `/api/music/free-search` : API interne d'agregation provider-first. `provider=pixabay` est conserve comme exception manuelle avec scan borne/assistant import, `provider=openverse` reste actif sans cle et est resserre sur des recherches musicales Jamendo via Openverse par styles sociaux ; `provider=archive` et `provider=wikimedia` sont retires/unsupported car trop aleatoires pour la video reseaux sociaux. `provider=jamendo` et `provider=freesound` ne sont exposes que si `JAMENDO_CLIENT_ID` ou `FREESOUND_API_KEY` existent cote serveur.
- `/api/music/import` : API interne de telechargement serveur pour URL audio directe allowlistee, sans scraping de catalogue, utilisee par l'import musique verifie.
- `/api/music/local-file-import` : API locale dev pour copier les imports Soundtrack dans `public/music/local-imports`, relire un manifest serveur, purger les anciennes pistes demo demandees et supprimer le fichier local quand une piste est retiree ; en production le chemin vise Firebase/Google Storage.
- `/api/music/project/import-url` : API projet authentifiee pour proxy audio direct allowliste avec metadata droits/source/licence obligatoires avant upload Firebase Storage cote client.
- `/api/music/providers` : API interne de metadata providers musique ; expose Pixabay comme `manual-exception`, les fournisseurs API searchEnabled exploitables dans l'UI, cache Jamendo/Freesound tant que leurs cles manquent, et n'ajoute les providers IA que si le flag/cookie backoffice IA est actif.
- `/api/music/ai-providers` : API interne de metadata providers IA musique, filtres natifs/prompt-presets, controles supportes et besoins de cles serveur ; retourne 404 quand le lancement IA est desactive.
- `/api/music/ai-generate` : API interne de generation IA musique cote serveur ; branche MiniMax Music et ElevenLabs via adapters, conserve Mubert/Replicate et autres providers en experimental/placeholder quand le contrat de reponse n'est pas confirme, et ne fait aucun appel externe sans cle.
- `/api/music/ai-import` : API interne d'import audio IA pour data URL audio serveur ou URL audio allowlistee, avec verification MIME/poids.
- `/robots.txt` : genere par `src/app/robots.js`, disallow `/studio`, `/account`, `/api`, `/admin`, `/backoffice`.
- `/sitemap.xml` : genere par `src/app/sitemap.js` avec home + pages SEO publiques.

## Journal — 2026-09-01 (la bibliotheque VibeOS entre dans Layout)

- Layout n'offrait que l'import de fichiers, alors que Vision propose aussi la
  bibliotheque. Deux entrees desormais, au meme rang: l'ecran vide propose
  « Importer des images » et « Depuis ma bibliotheque », et le bouton
  « Ajouter » du bloc Images ouvre le meme choix.
- `SlotImportSheet` sert les deux cas: vers une case precise (elle se referme
  apres le choix) ou en import general (elle reste ouverte pour en prendre
  plusieurs d'affilee, et les photos remplissent les cases vides dans l'ordre).
  En import general, le bouton « Depuis cet appareil » declenche le champ de
  fichiers du panneau: un seul point d'entree, et il accepte plusieurs photos.

## Journal — 2026-09-01 (la bande des images importees disparait)

- La bande de vignettes sous la liste des cases empilait TOUTES les photos
  importees, y compris celles retirees d'une case: elle faisait doublon avec la
  liste des cases et montrait des photos qui n'etaient plus nulle part.
  Supprimee.
- Retirer la photo d'une case la retire desormais du projet quand aucune autre
  case ne s'en sert (chaque image est enregistree en Blob: la garder alourdit
  chaque sauvegarde). Avant de toucher au tableau, l'affectation de toutes les
  cases est figee: une case sans reglage explicite lit `images[index]`, donc
  retirer un element aurait fait glisser les photos d'une case a l'autre.
- Changer de modele ne perd plus de photo: elles suivent dans les nouvelles
  cases, dans l'ordre de lecture, et une grille plus large sert en plus les
  photos restees en reserve. Le panneau annonce cette reserve
  (« N en reserve ») au lieu de la cacher.
- Le decalage des photos (variante « melanger ») deplace maintenant les photos
  elles-memes: depuis que chaque case porte son image explicitement, changer
  l'ordre des zones ne suffisait plus.

## Journal — 2026-09-01 (selection d'une case : rouge, et qui ne colle plus)

- Le liseret de selection passe du violet au ROUGE systeme (#FF453A) avec un
  halo, en deux passes (halo puis trait net), et son epaisseur suit la
  resolution du canvas: l'apercu est dessine en 1080 px puis reduit, un trait
  fixe rendait un demi-pixel a l'ecran.
- La selection ne colle plus: Echap la retire, un clic a cote de l'apercu aussi,
  et le plein ecran s'ouvre toujours sans liseret. Elle n'a jamais atteint
  l'export (`renderSlotSelection` est deja derriere `isPreview`), mais elle
  restait affichee en plein ecran, ou l'on juge le visuel.

## Journal — 2026-09-01 (cadrage photo par photo)

- Chaque photo se recadre DANS sa case: zoom (boutons, molette sur la case
  selectionnee), deplacement a la souris, double-clic ou bouton central pour
  revenir au cadrage d'origine. Le zoom est borne a [1, 4]: en dessous de 1
  l'image ne remplirait plus son cadre. Jusqu'ici, seuls les curseurs des
  reglages avances permettaient de le faire.
- Corbeille rouge en haut a droite de chaque case pleine (rouge systeme Apple
  au survol), symetrique de la poignee d'echange en haut a gauche.
- Les commandes sont en verre depoli sombre, invisibles tant que la souris
  n'entre pas dans l'apercu, et s'adaptent a la taille de la case: une petite
  case ne garde que la poignee et la corbeille, en plus petit.
- Seule la case SELECTIONNEE capte la souris (deplacement, molette): les autres
  restent transparentes, donc le canvas garde la selection, les textes et les
  stickers.

## Journal — 2026-09-01 (fond neutre et marges symetriques)

- Fond par defaut neutre: `layoutBgBlur` demarrait a `true` et `layoutBgColor`
  a `#000000`, donc la premiere photo importee etait recopiee floutee derriere
  la grille sans que personne ne l'ait demande - la meme image apparaissait
  deux fois. Defaut desormais: blanc uni, et le dos d'une case suit la couleur
  de fond au lieu d'un noir en dur. Couleur / Flou / Genere restent au choix.
- Marges symetriques par defaut: `padding`, `gap` et `customLayoutGap`
  demarrent tous a 24. Nouveau mode « Marges egales » (actif par defaut) qui
  pilote les trois ensemble; en mode « Libres », deux curseurs distincts,
  « Marge exterieure » et « Ecart entre les images ». Les deux curseurs d'ecart
  qui trainaient dans « Geometrie fine » sont supprimes (ils faisaient doublon).
  Un habillage thematique qui impose des marges differentes sort du mode lie.
- Apercu a angles droits (canvas et calque de comparaison): Instagram
  n'arrondit pas le visuel publie.
- Le smoke des cases verifie en plus le coin blanc du visuel et l'egalite
  marge exterieure / gouttiere.

## Journal — 2026-09-01 (cases de la mise en page : une photo par case)

- Le moteur recopiait la meme photo dans toutes les cases
  (`imgIndex % images.length` dans `renderSlot`): une seule photo importee
  remplissait les cinq cases d'une grille. Une photo ne va plus que dans UNE
  case; les autres restent vides avec leur cadre pointille. Une case videe a la
  main porte `image: null` (et non plus une cle absente), sinon l'image
  "naturelle" de sa position revenait; ce vide est aussi persiste
  (`slots[].imageCleared`).
- L'import global remplit les cases VIDES dans l'ordre de lecture, une par
  case, au lieu d'empiler des images dans un tableau.
- Nouvelle couche `SlotOverlay` sur l'apercu: survol d'une case vide -> bouton
  « Importer » (feuille `SlotImportSheet`: fichier local OU photo de la
  bibliotheque VibeOS); case pleine -> poignee qu'on glisse sur une autre case
  pour echanger les deux photos. Un fichier lache directement sur une case y va.
  La couche est transparente aux evenements sauf ses commandes: le canvas garde
  le deplacement d'une photo dans son cadre, et la barre d'outils de l'apercu
  reste cliquable (elle a ete masquee un temps par l'hote de la couche).
- `useCanvasRenderer` publie desormais la geometrie des cases a React
  (`{ rects, width, height }`, apercu seulement), filtree pour ne re-rendre que
  si elle a vraiment change.
- Le menu de familles du panneau est reduit a la liste des noms (le compte et la
  phrase d'explication restaient dans la bibliotheque).
- Gate: `scripts/smoke-vibeos-layout-slots.spec.cjs`.

## Journal — 2026-09-01 (grilles editoriales du Layout)

- Ajout de `gridLibrary.js` : les grilles ne sont plus des listes de
  rectangles mais un ARBRE rangees/colonnes compile. 24 grilles editoriales en
  6 familles (Editorial, Asymetrique, Galerie, Bandes & duos, Narratif, plus
  les 3 grilles historiques en Classiques), avec vides assumes pour les marges
  et bandeaux de titre.
- Chaque grille existe en portrait 4:5 ET en carre 1:1, avec le meme nombre de
  zones et le meme ordre de lecture : changer de format RECOMPILE la grille au
  lieu de l'etirer, et les ids de zones stables gardent chaque photo en place.
  Une grille deplacee a la main est marquee `dirty` et n'est plus recompilee.
- Nouveau `GridLibrarySheet` (recherche + familles, apercu 4:5 et 1:1 cote a
  cote). Dans le panneau, le titre de la grille est devenu un SELECTEUR DE
  FAMILLE (`GridCategoryMenu`) : on choisit Editorial / Asymetrique / Galerie /
  Bandes & duos / Narratif / Classiques et le panneau affiche toute la famille,
  sans ouvrir la bibliotheque. La famille suit la grille appliquee, y compris
  quand elle vient de la bibliotheque ; elle est derivee au rendu, jamais dans
  un effet. Plus trois variantes : miroir horizontal, miroir vertical,
  rotation des photos. Le miroir et la rotation
  sont stockes dans `customLayout.transform` et survivent au changement de
  format et a la reprise du projet.
- Aperçu iPhone : la hauteur du media suit desormais le vrai ratio du post
  (402 px en 1:1, 503 px en 4:5) au lieu d'une boite fixe de 536 px, comme
  Instagram qui borne le feed entre 4:5 et 1,91:1.
- Gates : `npm run lint`, `npm run build`, `scripts/smoke-vibeos-layout-grids.mjs`
  (geometrie des 48 variantes) et le nouveau smoke Playwright
  `smoke-vibeos-layout-grids.spec.cjs`, plus les trois smokes Layout existants.
  Travail local uniquement, aucun deploiement.

## Journal — 2026-09-01 (preview Instagram Layout)

- Port du châssis `PublicationPhoneShell` et du feed
  `InstagramPublicationPreview` depuis `secondevienextjsSSR`, avec les mesures
  source 430×910 / 402×874 traduites en CSS Modules sans variation visuelle.
- L'aperçu Layout est désormais construit depuis le canvas d'export pleine
  définition et les mêmes JPEG que le flux Publication, plus depuis le petit
  canvas affiché à l'écran.
- Les formats feed sont audités et normalisés : portrait 4:5, carré 1:1,
  paysage 1,91:1 ; story 9:16. Pano x2/x3 produit 2/3 tranches 1080×1350 et le
  téléphone les parcourt au clic, au swipe et au trackpad.
- Ajout d'un smoke Playwright couvrant les six formats, les dimensions JPEG et
  la navigation panorama. Travail local uniquement, aucun déploiement.

## Journal — 2026-09-01 (developpement local et couts cloud)

- Ajout de `docs/developpement-local-et-couts.md` : le local devient la boucle
  de developpement par defaut ; le cloud sert a valider un lot coherent ou une
  release, avec un seul rollout attendu.
- `AGENTS.md` impose la lecture du protocole et precise qu'une demande de
  staging « reguliere » n'autorise pas les micro-deploiements successifs.
- Le guide couvre les emulateurs, les gates cibles, le perimetre minimal des
  deploys, les branches App Hosting, la declaration pre-deploiement et
  l'inventaire mensuel des ressources payantes.
- Aucun code applicatif, reglage Firebase ou ressource Google Cloud n'a ete
  modifie ou deploye dans ce lot documentaire.

## Journal — 2026-08-31 (Bibliothèque : carrousel vers Vision)

- Cause : pour une photo redescendue de Firebase, le clic « Retoucher »
  attendait le téléchargement, le décodage plein format, la création d'une
  vignette WebP et l'écriture IndexedDB avant `router.push`. Sur Safari, cette
  chaîne lourde donnait l'impression d'un bouton sans effet.
- `useLibrarySync.hydrate` rend maintenant le Blob dès qu'il est téléchargé.
  La vignette et le cache local terminent en arrière-plan. Si l'URL de
  l'original échoue, l'aperçu est essayé avant d'abandonner.
- `LibraryScreen` verrouille les doubles clics, expose une erreur utile et
  transmet l'état d'ouverture. `Lightbox` affiche « Ouverture… » pendant le
  rapatriement.
- Le smoke navigateur transforme une vraie photo importée en fiche distante
  sans Blob, clique « Retoucher » dans le carrousel et exige `/creer/vision` +
  l'écran Vision. Gates : bibliothèque pure 36/36, navigateur 1/1, lint 0
  erreur (5 avertissements préexistants), build Node 22 vert.
- Commit `a8b6993` poussé sur `master`, rollout App Hosting terminé. Contrôle
  live avec le compte réel : `IMG_0421.JPG` ouverte dans le carrousel,
  « Retoucher » mène à `/creer/vision` et l'écran Vision est visible.

### Correctif Safari Storage après contrôle réel

- Le contrôle Safari sur un second appareil ne retrouvait que les 37 photos
  déjà synchronisées et reproduisait deux symptômes liés : « Retoucher » ne
  quittait pas le carrousel et `IMG_0421.JPG` montrait l'icône « ? ».
- Les 74 objets Storage existent (original + aperçu pour chaque photo) et les
  URLs de `IMG_0421.JPG`/`IMG_0422.JPG` répondent 200. La cause était le bucket
  sans CORS (`cors_config: null`) : un `<img>` pouvait charger cross-origin,
  mais `fetch()` ne pouvait pas remettre le Blob à Vision.
- `storage.cors.json` est appliqué au bucket. Une requête avec l'Origin App
  Hosting reçoit désormais `access-control-allow-origin` exact.
- `libraryCloud.fetchBlob` privilégie `getBlob(ref(storage, path))`, donc les
  règles et l'identité Firebase, avant l'ancienne URL tokenisée. `Lightbox`
  force d'abord une nouvelle requête versionnée pour contourner le cache négatif
  Safari, essaie l'original si l'aperçu échoue et démonte l'élément en dernier.
- Le smoke navigateur force un aperçu 404 et exige le repli original avant le
  passage à Vision. Gates locales : 36/36 + 1/1, lint 0 erreur, build vert.
- Correctifs poussés sur `master` dans `32b63d1` (lecture Storage authentifiée,
  CORS et repli sans icône cassée) puis `45de224` (requêtes versionnées contre
  le cache négatif Safari). Le rollout App Hosting final est terminé. Contrôle
  Safari avec le compte réel : `IMG_0421.JPG` est téléchargée par « Retoucher »,
  `/creer/vision` s'ouvre et la photo réelle apparaît dans Vision.

## Pages cible a creer plus tard

- `/legal/confidentialite`
- `/legal/conditions`

## Journal — 2026-08-31 (bibliothèque : dossiers, import et sauvegarde compte)

La bibliothèque n'est plus un tas de photos : **elle s'ouvre sur des dossiers**.
Un import = un dossier, nommé comme sur un OS (le nom du dossier choisi, sinon
la date en toutes lettres, suffixe « (2) » si le nom est pris). Cliquer sur un
dossier ouvre la grille masonry existante, intacte — mêmes vagues d'apparition,
même carrousel, mêmes filtres.

Fichiers ajoutés : `platform.js`, `folderNaming.js`, `libraryQuota.js`,
`FolderCard.jsx`, `ImportSheet.jsx`, `libraryCloud.js`, `useLibrarySync.js`.
Fichiers touchés : `libraryDb.js` (v2, store `folders`, migration), `useLibrary.js`,
`photoImport.js`, `LibraryScreen.jsx`, `library.module.css`, `firestore.rules`,
`storage.rules`, `scripts/smoke-vibeos-library.mjs`,
`scripts/smoke-vibeos-library-ui.spec.cjs`.

- **Le web n'ouvre pas la galerie d'un téléphone.** Il n'existe aucune API pour
  ça. Ce qu'on peut faire — et ce que fait `platform.js` — c'est demander le bon
  SÉLECTEUR : `accept="image/*"` ouvre la photothèque système sur iOS/Android,
  `capture="environment"` l'appareil photo, `webkitdirectory` un dossier entier
  sur ordinateur. La détection d'appareil ne change donc pas le comportement,
  elle **nomme les boutons avec les mots du système** de l'utilisateur.
- **Le quota se vérifie AVANT l'import**, pas après : refuser en cours de route
  obligerait à effacer ce qu'on vient d'écrire. Deux plafonds, et il faut les
  deux — 1000 photos borne le nombre de documents, 5 Go borne la facture.
- **La carte de dossier est dessinée en quatre couches** (dos + onglet, deux
  épaisseurs de tirages, couverture, rabat translucide). Au survol comme à
  l'apparition, rien ne bouge d'autre que `transform` et `opacity`.
- **La sauvegarde envoie l'original ET l'aperçu.** L'aperçu 1600 px parce que
  sans lui la grille redescendrait des fichiers de 8 Mo par tuile ; l'original
  parce que le but est de ne plus jamais réimporter une photo depuis l'appareil
  pour la retoucher. La fiche Firestore est écrite en dernier : un envoi coupé
  ne laisse jamais de fiche pointant vers un fichier absent.
- **Un envoi à la fois.** Deux cents photos en parallèle saturent le lien
  montant pendant que l'import décode encore des images.
- **Rien ne part sans compte réel** : le contournement d'authentification de
  développement fabrique un utilisateur inconnu de Firebase, `cloudUid` le
  rejette au lieu de laisser les règles refuser une requête sur deux.

Vérifié bout en bout sur les émulateurs Firebase (auth + Firestore + Storage) :
9 photos et 2 dossiers montés dans le compte, puis **IndexedDB effacé** — les
deux dossiers et leurs photos redescendent, s'affichent, s'ouvrent en carrousel,
et « Retoucher » rapatrie l'original et ouvre Vision.

Gates : `test:vibeos-library` (37 vérifications hors navigateur + smoke
navigateur 1/1), `npm run lint` 0 erreur (5 avertissements préexistants),
`npm run build` vert sous Node 22. Les règles Firestore/Storage ont compilé et
été publiées avant le front ; un second compte est refusé en lecture et écriture
sur les deux services. Commit `6030055` poussé sur `master`, rollout App Hosting
`build-2026-08-31-004` réussi. La page live s'ouvre avec le compte réel déjà
connecté. L'import live de trois images de démonstration reste à conclure :
l'extension Chrome doit d'abord autoriser l'accès aux URL de fichiers.

## Journal — 2026-08-31 (performance des miniatures Vision)

- Diagnostic avant patch sur `/creer/vision` : première carte calculée en
  1,7–1,9 s mais 0/10 cartes du viewport après 20 s ; 30–31/261 terminées,
  47–48 rendus lancés, environ 30 s de tâches longues et un pic de 774 ms.
- Deux causes : file globale dans l'ordre des 261 presets via
  `requestIdleCallback`, sans notion du viewport ; chaque publication React de
  miniature recréait les options du renderer et relançait la grande image haute
  qualité. Les data URLs ne représentaient que ~40 ms sur 20 s.
- `VisionScreen` observe chaque carte dans le vrai panneau scrollable. Le
  viewport est urgent, une marge de 500 px est préchargée au repos, et quitter
  une collection retire les travaux non démarrés. Aucun rendu des 261 sans
  consultation réelle.
- `useVisionEditor` porte une file à concurrence 1, annule les générations
  obsolètes et met en cache les Promises/Blob URLs par photo, preset, intensité
  conseillée et version moteur. Le cache de Promise neutralise aussi le double
  montage React Strict Mode.
- `presetPreview` réduit une seule fois à 192×116, conserve `applyFiltersPro`
  complet (LUT, réduction du bruit, clarté, texture, netteté, vignette, grain,
  etc.) et remplace les data URLs par `toBlob`/object URL. L'aperçu principal
  est plafonné à 1,25 Mpx, sans toucher à l'export.
- Après patch, commande `npm run test:vision-preview-performance` : première
  miniature 454 ms depuis l'import (23 ms après disponibilité photo), 10/10
  visibles à 852 ms (421 ms après photo), scroll 284 ms, 14 rendus avant scroll,
  4,7 ms de pipeline moyen, LUT 1,07 ms en moyenne et 0 doublon. La collection
  Cinéma lance exactement 10 rendus. Parité visuelle automatisée sur CN01,
  CN14 avec grain et BW01 : écart moyen par canal inférieur à 1 niveau.
- Gates : performance 3/3, navigateur Vision 3/3, moteur 426/426, lint 0 erreur
  et 5 avertissements préexistants. Build compilé puis bloqué comme avant par
  l'ABI locale `better-sqlite3` (127, Node courant 26/module 147). Le seul bruit
  console est le 403 App Check debug attendu avec la configuration locale.
  Aucun déploiement.

## Journal — 2026-08-31 (retrait de la détection intelligente Vision)

- Suppression ciblée de VibeMask : moteur DeepLab/TensorFlow.js, Worker,
  modèle de masque ciel/eau, pinceau, overlay, presets ciel locaux, aperçus,
  persistance projet et test dédié.
- Les presets classiques, l'amélioration automatique, les réglages Vision,
  l'historique, le rendu commun et l'export restent en place. Les anciennes
  données `smart*` éventuellement présentes dans IndexedDB sont simplement
  ignorées par le modèle normalisé.
- Les dépendances TensorFlow.js propres à cette expérimentation et sa
  documentation d'architecture ont été retirées. Aucun déploiement.
- Gates : pipeline 2/2, lint 0 erreur avec 5 avertissements préexistants et
  build Node 22 vert. Restent hors lot l'échec moteur déjà présent sur 12
  presets hors garde-fous et le délai de génération des 261 miniatures Vision
  (173 disponibles dans la fenêtre de 20 s du smoke navigateur).

## Journal — 2026-08-30 duodecies (Lightroom : quatre saisons)

- Ajout des 45 presets Premium Printemps SP01–SP12, Été SM01–SM11, Automne
  TM01–TM12 et Hiver WN01–WN10. Vision expose 181 presets avec quatre nouveaux
  filtres de collection ; aucun preset saisonnier ne contient de grain.
- Le contrôle Lightroom sur une photo téléphone 2252×4000 et une reflex
  4000×6000 a corrigé le sens clair du vignettage positif, l'ordre du détail
  avant LUT, le dosage JPEG de la clarté et la protection des arêtes de la
  texture. Ces chemins sont opt-in pour les imports et préservent les anciens
  presets VibeFX.
- Audit et chiffres : `docs/lightroom/audit-saisons-2026-08-30.md`. Gates
  ciblés : 408/408 preset, audit réglages vert, smoke réglages 1/1. Aucun
  déploiement.

## Journal — 2026-08-30 decies (Studio : Gradient et Lumen en grand)

- `/creer/studio` ne monte plus l'ancien editeur photo ni ses dix ambiances :
  les presets de qualite vivent dans Vision. La surface montre deux modules,
  Gradient et Lumen, dans une coque Apple-dark responsive. Mesh n'y apparait
  plus ; son usage Layout reste intact.
- `useStudioGenerators.js` remplace le lourd `useStudioEditor` sur cette route.
  Il conserve le contrat existant : la mini-app renvoie une image par
  `postMessage`, convertie en Blob puis ecrite dans le fond du projet commun.
- Le mode `immersive` de `Sheet` garde le bandeau VibeOS visible et donne aux
  iframes tout le rectangle restant : zero padding, zero bord, zero rayon,
  jusqu'aux deux cotes et au bas. Un bouton de fermeture discret vit dans le
  bandeau ; Echap fonctionne aussi. La tab bar mobile est couverte.
- `smoke-vibeos-studio.spec.cjs` verrouille exactement cette geometrie sur
  desktop et mobile, les deux iframes, l'application/retrait d'un Gradient et
  l'absence de Mesh/ambiances. Resultat : 2/2 vert.

## Journal — 2026-08-30 nonies (Gradient Builder : le reste)

Cloture du chantier : **les 28 types ont leur moteur**, et les trois manques du
lot precedent sont combles.

- **Glassy** : grille de tuiles de verre. Le fond est peint a part puis floute ;
  chaque tuile le redecoupe avec un decalage — c'est ce decalage qui fait la
  refraction. Dix formes de tuile (carre, cercle, hexagone, trefle, fleur,
  feston, coeur, etoile, feuille, goutte), voile, reflet, ombre au pied,
  liseré, et une deformation en boule sur toute la grille.
- **Glint** : le soleil sur l'eau. Des rangees de vagues en perspective, une
  nappe de lumiere sous l'horizon, des trainees, puis jusqu'a 4 200 reflets
  semes selon une densite qui suit la colonne du soleil. Une toile en
  « soft-light » casse le lisse.
- **Mist** : des cretes de montagne en bruit de valeur, de plus en plus hautes
  et nettes a mesure qu'elles se rapprochent, separees par des nappes de brume
  elliptiques ; les cretes du fond sont floues et tirent vers la couleur du
  ciel.
- **Skyline** : cinq villes (San Francisco, New York, Paris, Londres, Sydney),
  tracés SVG extraits du bundle, empilees par plans du plus clair au plus
  sombre, calees en bas du cadre avec un halo de sol.
- **Panneau Forms** au complet, comme sur le site : grille des 35 silhouettes,
  12 gammes de couleur, 13 fonds + fond libre et un bouton « Match set »,
  transformation sur le canvas (cadre deplacable, coins qui redimensionnent,
  poignee de rotation, Fit / Fill / Reset), et le bloc « Form treatment »
  (Edge fade, Width, Height, Distort, Bloom).
- **Onglet Image** : import de logo ou de photo, place a la main sur le canvas,
  avec taille, rotation, opacite et mode de fusion. Les images partent aussi a
  l'export.
- **Exports** dans une feuille dediee : **PNG** (4 formats, avec apercu),
  **SVG** (vrais chemins pour Linear, Radial, Conic, Forms et Skyline ; rendu
  embarque en image pour les types calcules pixel par pixel, et le panneau le
  dit), **CSS** et **JSON** avec apercu du code et copie en un clic, et
  **video** par `MediaRecorder` sur le flux du canvas — MP4 quand le navigateur
  sait l'encoder, WebM sinon, l'etiquette suit.
- **L'animation** ne se limite plus au GPU : les types calcules pixel par pixel
  tournent aussi, en resolution reduite et a 24 images/s, quand leur curseur
  Speed est au-dessus de zero. Un trait sans `sway` ne declenche rien : son
  dessin ne depend pas du temps.

## Journal — 2026-08-30 octies (Gradient Builder : les moteurs de type)

L'UI etait juste, les types ne l'etaient pas : tout ce qui n'avait pas son
moteur retombait sur une rampe lineaire. Cette tranche ecrit les moteurs
manquants. **24 des 28 types rendent maintenant leur vrai dessin**, les quatre
familles du dock comprises.

- **Sky** et **Aurora** passent par le GPU (`js/render/gl.js` : socle WebGL,
  bruit de Perlin et fbm partages). Sky est un fbm a domaine deforme empile en
  trois couches d'altitude, fondu en « color burn » sur quatre tons — de vrais
  nuages. Aurora est une nuit noire ou deux brins paralleles sont modelises par
  une gaussienne asymetrique autour d'une colonne sinusoidale, avec stries de
  champ et etoiles sur grille. Les deux **s'animent** : le curseur Speed pilote
  une horloge qui ne tourne que pour ces types (le GPU encaisse, un champ par
  pixel non) et s'arrete quand l'onglet passe en arriere-plan.
- **Lines** : les 13 formes de trait (serpent, boucle, spirale, gribouillis,
  zigzag, gelule, anneau, arc…), spline Catmull-Rom centripete, re-echantil-
  lonnage a arc constant, tracé segment par segment avec un degrade local — la
  couleur court le long du trait. Les 8 arrangements du site (Snake, Drops,
  Loops, Ribbon, Doodle, Wander, Waves, Echo) sont extraits et leurs vignettes
  rendues par le meme moteur. La premiere couleur est le papier.
- **Forms** : les 35 silhouettes SVG de la bibliotheque, degrade et fondu
  calcules **dans le repere du dessin** et non dans celui de l'ecran — c'etait
  l'erreur qui coupait la forme en deux et la delavait.
- Ajoutes aussi : **Still** (champ fige, melange RGB a exposant reglable),
  **Retro** (taches gaussiennes sur fond domine, plan bouscule par du bruit),
  **Noise**, **Prism** (colonnes a largeur bruitee, coeur incandescent, reflets
  qui derivent), **Rings**, **Beehive**, **Blocks**, **Balls**, **Pixel**,
  **Arch**.
- **Texte** : plusieurs boites par composition, chacune deplacable au doigt sur
  le canvas, avec police, taille, interlettrage, rotation, alignement et encre.
  Les presets apportent leurs propres textes — le titre en serif et les
  mentions d'angle des affiches Forms arrivent avec eux.
- Chaque type a desormais son groupe de reglages (Weather pour Sky, Field pour
  les autres, Direction en quart de tour) et **son propre libelle de bandes**.
- Restent sans moteur : **Glassy, Glint, Mist, Skyline** (4 sur 28) ; ils
  retombent sur la rampe lineaire, et la liste vivante est `READY` dans
  `js/render/index.js`.

## Journal — 2026-08-30 septies (Gradient Builder : premiere tranche)

Nouveau generateur de fonds, reconstruit d'apres l'ecran Studio de
`feralui.dev/gradients`. L'app vit dans `public/vendor/gradient-builder/`
(HTML + ES modules, zero dependance), sur le meme principe que `vendor/lumen` :
elle s'ouvre dans une iframe et rend son image au parent par `postMessage`.

- **Coquille fidele** : entete + modes Studio/Gallery/Palette/Saved, bascule
  clair/sombre, panneau vitre a onglets Design/Text/Image, dock de types a cinq
  familles, barre de bandes, barre du bas. Les mesures (tokens `--jg-*`, rayons,
  ombres, typo Inter 13.5px) sont relevees sur le site ; le CSS est reecrit.
- **Donnees** : les 28 types et leurs 4 familles, 208 presets de panneau,
  69 degrades de galerie, 12 gammes de palette et le nuancier de 102 couleurs
  traditionnelles (avec repli par famille de teinte) sont extraits du bundle
  public par un parseur de litteral maison (`scripts` de travail hors depot).
- **Moteurs ecrits** : `FLOW` (champ de couleur en OKLab, ponderation en
  inverse de distance, double pli sinusoidal + rotation vers les bords),
  `AIR/Mesh`, `LINEAR`, `IOS`, `CIRCLE`, `ANGULAR`, `WAVE`, `STRIPE`,
  `BARS`/`COLS`. Les 18 autres types s'affichent dans le dock et retombent sur
  la rampe lineaire tant que leur moteur n'est pas ecrit.
- **Rendu en deux temps** : passe brouillon a 260 px pendant qu'on manipule un
  reglage, pleine resolution (plafond 1600 px) des que la main se leve.
- **Cote VibeOS** : bouton `Gradient` a cote de Mesh et Lumen dans « Fond
  genere » (Studio), `Sheet` gagne une variante `full` (min(1600px, 100vw)),
  et `useStudioEditor` retient desormais quel generateur a produit le fond
  (`lumenMode`) pour eclairer le bon bouton.
- **Deux defauts corriges en route** : `requestAnimationFrame` ne se declenche
  pas dans un onglet masque (le rendu ne repartait jamais — repli sur timer), et
  l'attribut `hidden` ne cachait pas les sections a `display` explicite.

## Journal — 2026-08-30 sexies (miniatures et vignettage Lightroom)

- `vision/presetPreview.js` appelle maintenant `applyFiltersPro`, exporté par
  `studioRenderer.js` : une carte rend la LUT et tous les effets spatiaux du
  preset, avec la vraie taille source transmise au moteur de grain.
- `useVisionEditor.js` calcule ces cartes par lots de quatre via le temps
  d'inactivité du navigateur. Le catalogue peut dépasser 100 entrées sans
  bloquer l'import, le scroll ou le premier affichage de la photo.
- Le moteur/import XMP porte le voile négatif et les réglages Milieu, Arrondi,
  Contour progressif et Hautes lumières du vignetage. Le nouveau profil radial
  Lightroom est opt-in pour les imports ; le chemin des presets validés reste
  inchangé. `scripts/mesure-vignette-lightroom.mjs` rejoue les mesures.
- Gates : 384 vérifications moteur, smoke Vision principal, smoke des réglages
  avancés Vision + Studio et lint verts. Le smoke global conserve son échec
  connu PowV3 (contraste 1,426 < 1,5) ; le build compile puis bute sur l'ABI
  locale préexistante de `better-sqlite3`. Aucun déploiement.

## Journal — 2026-08-30 quinquies (Lightroom Cloud : famille Cinéma complète)

- Audit direct de `Style : cinéma` : la famille va de CN01 à CN10. CN01 est
  reclassé dans `Cinéma` sans modifier sa table LUT validée ; ajout des modules
  générés `cn02.js` à `cn10.js` et régénération de l'index.
- Les neuf nouvelles mires Hald ont une rugosité de 0,60 à 0,80/255 : aucun
  grain n'est figé dans les tables. Les panneaux Lightroom confirment Grain 0,
  Texture/Clarté/Voile/Vignette 0, aucun Auto/masque/noir et blanc. Le rendu
  JPEG porte Netteté 40 et réduction du bruit Luminance 20 / Couleur 50.
- Contrôle réel CN02/CN10 sur `37131.jpg` (téléphone) et `IMG_0349.JPG`
  (reflex Maroc) : 1,23 à 1,98/255 d'écart moyen, P99 de 6 à 11/255, quatre
  verdicts identiques à l'œil après inspection des planches et crops 1:1.
- Vision contient désormais `Cinéma 10`, `Cinéma II 8`, `VibeFX 26` ; la
  collection vide `Imports` disparaît. Le smoke navigateur vérifie le filtre
  Cinéma et la recherche CN01. Aucun déploiement.
- Audit : `docs/lightroom/audit-cinema-2026-08-30.md`.

## Journal — 2026-08-30 quater (Vision : collections de presets)

- La grille plate devient une bibliothèque structurée : recherche, filtres en
  pilules `Tous`, `Cinéma`, `Cinéma II`, `VibeFX`, `Imports`, compteurs, groupes
  visibles et état vide. Le châssis reste celui de VibeOS, sombre et calme façon
  Apple OS ; focus clavier et reduced-motion sont couverts.
- `presetCollections.js` porte la logique pure. Les prochains imports peuvent déclarer
  `--collection "Nom"`, ou reprendre automatiquement le groupe du XMP.
- Le smoke navigateur vérifie Cinéma II = 8, recherche CN17 = 1 et retour à la
  bibliothèque complète. Contrôle visuel desktop/mobile effectué sur le vrai
  écran Vision. Aucun déploiement.

## Journal — 2026-08-30 ter (Lightroom Cloud : famille Cinéma II complète)

- Audit direct de Lightroom Cloud : « Style : cinéma II » va de **CN11 à
  CN18**, pas à CN20. VibeFX possédait CN11, CN13, CN14, CN16, CN17 ; ajout de
  `cn12.js`, `cn15.js` et `cn18.js`, puis régénération de `presets/index.js`.
- Les trois mires sont les exports sRGB 2048×2048 en blocs 4×4. CN18 porte
  Grain 20 / Taille 40 / Cassure 50 / Netteté 40 ; CN12 et CN15 portent
  Netteté 40. Toute la famille porte la réduction de bruit Lightroom Luminance
  20 / Couleur 50, maintenant reproduite avant la netteté par un lissage
  luminance/chroma qui protège les arêtes.
- `check-hald-control.mjs` rejetait à tort la mire de production 2048 en
  attendant l'ancienne 512. Il détecte maintenant la taille des blocs et
  moyenne leur cœur comme l'importeur. `import-lightroom-preset.mjs` ne prétend
  plus que les effets relevés à l'écran sont perdus quand aucun XMP n'existe.
- Le smoke verrouille CN11–CN18, leur réduction du bruit 20/50, le parseur XMP
  (quantité, Taille et Cassure du grain, même à zéro) et l'ordre du pipeline
  spatial.
  Contrôle à l'œil sur quatre photos Unsplash : aucun défaut accidentel vu ; les
  trois nouveaux restent hors `presets-valides.md` jusqu'au regard de Matthis.
- Corpus réel ajouté : quatre photos téléphone jusqu'à 200 Mpx et trois reflex
  Canon EOS 200D du dossier `~/Desktop/maroc`. Les exports avec/sans grain
  isolent directement le champ Lightroom. CN14 est à environ 1 % de force et
  +3,5 % de grosseur au pire ; CN17/CN18 restent à environ 2 % de force et 3 %
  de grosseur jusque 200 Mpx. Sur reflex, la force varie de −6,8 à +4,2 % sans
  biais systématique.
- Contrôle final LUT + NR + netteté + grain : 1,68–1,97/255 d'écart moyen sur
  téléphone, texture, portrait et paysage reflex. Les quatre planches et crops
  1:1 ont été regardés à l'œil, sans différence gênante.
- Audit complet : `docs/lightroom/audit-cinema-II-2026-08-30.md`. Aucun
  déploiement.
- Gates du lot : 373/373 vérifications preset après ajout de Cinéma, audit des réglages et smoke
  navigateur Vision/Studio verts, lint sans erreur. Le smoke VibeOS global
  conserve un échec hors lot sur `saturee / PowV3` (1,426 sous le seuil 1,5) ;
  le build compile puis s'arrête sur l'ABI locale incompatible de
  `better-sqlite3` dans `node_modules`.

## Journal — 2026-08-30 bis (`powV12` : le blanc du logo, et le poteau)

Nouveau preset. `powV11` n'est pas touche.

**DEUX FOIS J'AI MESURE A COTE, et c'est le porteur du projet qui a corrige.**

Premiere fois: j'avais mesure la variation entre pixels VOISINS et conclu que le
lettrage etait propre. Une tache est un defaut de BASSE frequence.

Deuxieme fois: la version suivante ameliorait la dispersion en blocs 4x4 (12,4
-> 9,6 %) et il n'a vu AUCUNE difference sur le logo. La carte des ecarts lui a
donne raison, sans appel: le lettrage bougeait de **-0,60 L\***, le CIEL de
**+5,28**. Ma bande attrapait le ciel et ratait les lettres.

**LE VRAI DEFAUT, une fois cherche au bon endroit.** Dans le trait des lettres:

| | L\* | chroma |
|---|---|---|
| la source | 62,1 | 10,0 |
| LUI | 46,1 | **18,0** |
| `powV11` | 43,2 | **14,5** |
| `powV12` | 46,2 | 16,0 |

Son blanc est CREME, le notre est GRIS: plus sombre et moins colore. C'est ca,
« le blanc melange avec du gris ».

**Ce que `powV12` change, et rien d'autre** (ecart mesure contre `powV11`):
lettrage +3,38 L\*, poteau -7,66, ciel +0,09, sol 0,00, moto 0,00, auvent 0,00.

Trois leviers:

1. relevement ADDITIF (16 L\*) et non multiplicatif — multiplier le niveau
   multiplie aussi les ecarts locaux;
2. fenetre de chroma 12-20, qui separe le lettrage (chroma 10) du ciel (20);
   c'est elle qui VISE, et c'est elle que j'avais mal posee;
3. courbe redressee aux noeuds L\* 55 et 60 (28,49/34,38 -> 31,0/36,3): elle
   amplifiait les ecarts locaux x1,29 au niveau du lettrage quand lui est a
   x1,05. Dispersion 12,4 -> 9,6 % (la sienne 8,0 %, la source 5,4 %).

**Le poteau**: 60,4 -> 50,6 pour un sien a 39,5. Dix des vingt points venaient de
la bande de `powV11`, qui ne se refermait qu'apres lui.

**CE QUI RESTE N'EST PAS REPRODUCTIBLE**, montre et non affirme: pas une regle de
teinte (a entree L\* 60-80 il descend les warm-neutres de 17,0 / 3,9 / 8,7 sur ses
trois paires et les autres teintes de 20,8 / 6,5 / 10,4 — il les descend MOINS);
pas un vignetage (plat du centre au bord sur le restaurant, -8 a -10; et -15,
-15, -14, -13, -16, -31, -16, -32, -31 sur la station, ce qui n'est pas monotone
avec le rayon); et la texture negative ne rattrape pas (a -50 la dispersion passe
de 4,50 a 4,11 pour une sienne a 3,36, et le contour se ramollit).

**Ecart connu, NON corrige**: il desature le rouge (moto 40,6 -> 31,4 de chroma)
quand nous le gardons a 39,0. Ce n'est pas dans la demande, et le changer
deplacerait le look entier.

dE76 median: p1 2,36 -> 2,39, p2 8,13 -> 8,14, p3 12,90 -> 13,85. Le cout est
sur p3, le restaurant, que ce preset ne vise pas.

Fichiers touches : `src/features/vibefx-studio/utils/visionPresets.js`,
`scripts/smoke-vision-preset.mjs` (343 controles),
`scripts/verifier-presets-sur-paires.mjs`. `npm run lint` vert.

## Journal — 2026-08-30 (`powV11` : les lettres des enseignes cessent de moucheter)

Corrige EN PLACE dans `powV11`, sans nouveau preset et sans toucher aux autres.

**Le defaut.** Sur le logo « Synergy » de sa station, nos lettres etaient
granuleuses la ou les siennes sont lisses — visible sans zoomer.

**La cause, mesuree.** Dans un blanc, la chroma qui reste (7 a 13 apres la
courbe) vient du panneau rouge qui bave dans le JPEG, et sa TEINTE est du
bruit : deux pixels voisins de la meme lettre pointent jusqu'a 92 degres l'un de
l'autre. Or `V9_MELANGEUR` donne un gain de LUMINANCE de 1,569 entre 15 et 45
degres et 1,000 au-dela. Deux voisins identiques sortaient donc 11,29 L*
d'ecart. Le garde-fou de chroma existant (`smoothstep(4, 11, c)`) ne les protege
pas : a chroma 10 il est deja grand ouvert.

**La correction.** `construirePowV2` accepte une option `blancsBruites`, fermee
par defaut, donc inerte pour `powV2`..`powV10`. Elle detourne une part du
garde-fou vers un traitement CONSTANT (gain de clarte et de chroma fixes, sans
teinte) pour les pixels a la fois clairs et peu colores. Erratique, le gain
mouchette ; constant, il eclaircit.

Deux precautions trouvees par la fumee, pas par moi :

- la part detournee se prend SUR le garde-fou, pas a cote — sinon un gris neutre
  recevait le gain, ce qui deformait la courbe (pente montee a 2,0) ;
- la bande de niveau se referme en haut — ouverte jusqu'a L* 100, elle poussait
  un blanc a 96,8 puis a l'ecretage.

**Reglage retenu** : `blancsBruites: [22, 34, 44, 60, 20, 34, 1.34, 1.18]`. Les
bornes sortent d'un releve : apres la courbe, le lettrage est a L* 27-39 pour
une chroma de 7 a 13, quand le sol est a L* 13-19, le ciel a L* 21 pour une
chroma de 20, l'auvent a L* 18.

**Resultat.** Lettrage a L* 46,6 contre ses 46,6 (avant : 48,8 et mouchete).
Variation de clarte entre voisins dans le trait : x1,80 la source avant, x1,33
apres, ce qui est exactement la pente de la courbe a ce niveau — le reste
releverait du debruitage, pas d'un preset. dE76 median sur ses trois paires :
p1 2,37 -> 2,36, p2 8,14 -> 8,13, p3 15,52 -> 12,90.

Fichiers touches : `src/features/vibefx-studio/utils/visionPresets.js`,
`scripts/smoke-vision-preset.mjs` (330 controles, +2). `npm run lint` vert.


## Journal — 2026-08-27 ter (`couchant` : un tas neutre de couchants, et trois registres abandonnes)

**Ce qui a change dans l'arbre** : `scripts/verifier-neutre.mjs`,
`scripts/grouper-couchants.mjs`, `scripts/ciel-couchant-1-1.mjs` ajoutes.
Modifies : `moissonner-neutre.mjs` (+4 familles, filtre de titre, rejet des
oeuvres d'art, plafond par auteur), `visionPresets.js` (**+1 preset, aucune
suppression**), `smoke-vision-preset.mjs` (185 -> **197**). `todo.md` ramene de
499 a 224 lignes; `docs/archive-calages-lightroom-2026-08-27.md` et
`docs/pieges-connus.md` crees.

**CE QUI MANQUAIT AU PROJET N'ETAIT PAS UN PRESET, C'ETAIT UN TAS D'EN FACE.**
Les douze familles neutres etaient toutes diurnes. Mesurer ses couchants contre
elles aurait repondu « couchant contre midi » — la scene, pas le traitement — et
rendu un preset qui rechauffe tout. Quatre familles de couchant ont donc ete
moissonnees sur Commons. Trois defauts ont ete trouves A LA PLANCHE, chacun
corrige dans le moissonneur :

| ce qu'on a vu | pourquoi c'est grave | remede |
|---|---|---|
| des rizieres de plein midi dans `coucher-paysage` | Commons indexe par LIEU, pas par heure | le TITRE doit nommer l'heure — l'auteur l'a ecrit, pas nous |
| des toiles de Friedrich, encadrees | une peinture n'a ni capteur, ni courbe, ni balance des blancs | filtre negatif, puis une passe a l'oeil |
| **vingt vues de la meme ville depuis la meme colline** | le tas neutre ne tient que si des retouches INDIVIDUELLES s'annulent | **au plus 3 photos par televerseur** |

Le troisieme est le plus instructif. Une detection par empreinte a ete essayee
d'abord et JETEE: sur des couchants, qui ont tous un ciel clair en haut et un sol
sombre en bas, une empreinte 8x8 ne decrit presque plus rien et ecartait 20
photos sans rapport sur 44. Ce sont les identifiants Commons qui ont trahi le
lot — ils se suivaient. Le bon critere n'etait pas dans les pixels.

**LE TRANSPORT REDEVIENT UTILISABLE QUAND LES DEUX TAS MONTRENT LA MEME SCENE.**
Partout ailleurs le projet refuse un transport de quantiles, parce qu'il emporte
l'exposition du tas qui l'a produit. Ici: point blanc **215** chez les couchants
neutres contre **207** chez lui, contraste 173 contre 182. L'ecart d'exposition a
disparu — et c'est la preuve, au passage, que ses couchants sont sombres a cause
du contre-jour et non d'un reglage. La courbe est donc le transport tel quel,
pente minimale 0,500, sommet ramene de 255 a 237 pour ne pas ecreter.

**LA TROUVAILLE** : le a\*. Chez `ambre` il finit a -0,36, donc a zero. Ici il
DESCEND vers les hautes lumieres, jusqu'a **-5,71**. Un couchant a un soleil
orange; il en retire le magenta et ne garde que le jaune. C'est l'ecart entre un
couchant de cinema et un couchant de carte postale, et aucun preset du projet ne
le faisait.

**MAIS IL A FALLU LE BRIDER, ET C'EST LE SEUL NOMBRE NON BRUT DU PRESET.** Pose
tel quel, -5,71 rend un blanc a RGB 232,**239**,220 — le vert devant le rouge,
exactement la panne deja payee une fois (un grand ciel a contre-jour vire au
vert-gris). Deux raisons de le brider, la seconde comptant plus que la premiere :

1. la regle dure du projet, verifiee sur toute la famille : a\* >= -2 dans le
   blanc ;
2. **le releve se compte deux fois.** L'etalonnage est pris sur les QUASI-GRIS;
   dans un couchant, les quasi-gris du haut sont du CIEL PALE — deja traite, et
   fortement, par la rotation du secteur bleu (-19,8 degres). Le meme virage vers
   le teal est mesure une fois comme rotation et une fois comme etalonnage. La
   rotation ne touche que ce qui a une teinte; le decalage fixe, lui, bave sur
   tous les gris, y compris ceux d'une photo sans ciel.

Premiere correction essayee puis JETEE: plafonner chaque bande separement. Le
critere « R - G >= 2 » applique aux ombres, dont le b\* est a +0,23, ramenait leur
a\* a zero, alors qu'`ambre` descend a -2,76 sans que personne n'y trouve rien a
redire — la regle dure ne porte que sur le BLANC. Retenu a la place: **un seul
facteur**, 1,90 / 5,71 = 0,3327, applique a toute la table. Le blanc tombe pile
sur le seuil et la FORME mesuree est intacte.

**TROIS REGISTRES SUR QUATRE SONT ABANDONNES**, et c'est le corpus qui le dit :

| registre | ce qu'on a trouve |
|---|---|
| `heure-bleue` | **UNE SEULE** photo dans tout son corpus. Ses nuits sont de la vraie nuit. |
| `contre-jour` | 4 ou 5 photos — sous le plancher « dix photos ne se mesurent pas ». |
| `heure-doree` / `sunset-sobre` separes | le point blanc s'etale de 123 a 238 **en continu**, sans la coupure nette qui avait justifie les deux densites d'`ambre`. |

Recensement fait a l'oeil sur les douze planches de familles: **23 couchants**
dans 320 photos. C'est la reserve principale de ce preset, et elle est ecrite
dans sa description.

**Verifie** : `test:vision-preset` **197** verifications. `juger-vers-modele`
donne **55 %** du chemin vers son modele, contre 34 % a `ambre` — le preset gagne
son existence sur son propre registre. Peau a 34,4 degres (la limite etait 35,8),
feuillage a 99,5 sans virer au citron, aucun contour (-1,86x). Le degrade de ciel
a **1:1, jamais redimensionne** (`ciel-couchant-1-1.mjs`, script neuf) ne montre
**aucune bande** sur trois ciels.

**FAIBLESSE HONNETE, mesuree et non cachee** : `couchant` ne bouge presque pas la
teinte du ciel (3 % du chemin) la ou `powlisher-cine` en fait 48 %. La cause est
une interaction entre deux grandeurs mesurees: sa coupe de chroma (x0,71 dans les
medians) desature le ciel SOUS le seuil ou la rotation de teinte s'applique
pleinement (`smoothstep(3, 14)`). La corriger voudrait dire ecraser l'une des
deux mesures. A l'oeil, le preset retire nettement le rose des ciels magenta —
ce qui est le but — mais eteint l'or des soleils dores. **C'est le point a
trancher par le porteur du projet**, et il n'entre pas dans
`docs/presets-valides.md` avant.

## Journal — 2026-08-28 (les presets de nuit a deux densites)

**Ce qui a change dans l'arbre** : rien d'ajoute. Modifies : `profil-corpus.mjs`
(+ `p25`), `juger-vers-modele.mjs` (+ trois mesures de lisibilite du bas),
`visionPresets.js` (**+2 presets, aucune suppression**), `smoke-vision-preset.mjs`
(167 -> **185**), `todo.md`, les deux prompts de reprise.

**RENOMMAGES** : `ambre-nuit` -> `ambre-nuit-2`, `powlisher-nuit` ->
`powlisher-nuit-2`. Aucun des deux n'est dans `docs/presets-valides.md` — la
regle tient. `ambre-nuit-1` et `powlisher-nuit-1` sont neufs.

**LE SYMPTOME** : « le voile sombre donne un style mais il est un peu fort, on
dirait une basse luminosite d'ecran de telephone ». Vu dans l'app sur un couchant
et une rue de nuit, pas par les tests.

**LA PREMIERE HYPOTHESE ETAIT FAUSSE, ET LA MESURE L'A DIT.** « Basse luminosite »
fait penser a des ombres ecrasees. Trois mesures ont donc ete ajoutees a
`juger-vers-modele.mjs` — `p05`, `p25` et la part de pixels tombes exactement a
zero — et elles disent l'inverse :

|  | tas neutre | modele | `ambre-nuit-2` |
|---|---|---|---|
| p05 | 21 | 5 | **17** |
| p25 | 55 | 21 | **41** |
| % bouche | 0,0 | 2,3 | **0,0** |

Il ne creuse pas trop: il creuse deux fois MOINS que le modele et ne bouche
aucun pixel. **Il ne casse rien, il pose trop bas.**

**LA VRAIE CAUSE, deja ecrite dans `todo.md`** : une LUT n'a pas de memoire. Sa
courbe est calee sur des scenes deja nocturnes; donnee a une photo correctement
exposee, elle la descend d'une exposition entiere. C'est exactement le manque que
l'etage de tonalite adaptatif doit combler, et qui n'existe pas encore.

**LA CORRECTION** : un point milieu, en lumiere lineaire, entre le preset clair
et le preset de nuit. Ce n'est pas un reglage au jugement — les deux bouts sont
mesures, et une moyenne geometrique entre deux courbes monotones reste monotone.

|  | clair | **milieu** | nuit |
|---|---|---|---|
| `ambre` gris moyen / plafond | 118 / 239 | **105 / 205** | 93 / 181 |
| `powlisher` gris moyen / plafond | 117 / 232 | **98 / 213** | 81 / 195 |

Pentes minimales 0,44 et 0,50, tres au-dessus du pas d'entree de la LUT.

**LA COULEUR NE BOUGE PAS D'UN CHIFFRE.** C'est elle qui fait le style, et ce
n'est pas elle qu'on corrige. Deux verifications neuves le figent: les deux
densites d'une meme paire doivent poser le meme gris a moins de 1,5 unite Lab
pres, et la version 1 doit tomber ENTRE les deux — sans quoi ce ne serait pas un
point milieu mais un troisieme reglage.

Mesure contre le modele de nuit: `ambre-nuit-1` parcourt **65 %** du chemin sur
le point blanc et **59 %** sur le contraste, `ambre-nuit-2` **104 %** et **103 %**.

**Verifie a l'oeil** : `NUIT-1-VS-2.jpg`. **Reste a valider par le porteur du
projet.**

## Journal — 2026-08-27 bis (`ambre` : un preset tire d'un modele designe a la main)

**Ce qui a change dans l'arbre** : `scripts/voisins-du-modele.mjs` et
`scripts/juger-vers-modele.mjs` ajoutes. Modifies : `mesurer-variante.mjs`
(+ bande des reflets), `courbes-variantes.mjs`, `visionPresets.js` (**+2 presets,
aucune suppression**), `smoke-vision-preset.mjs` (150 -> **167**).

**LE POINT DE DEPART** : dix photos designees a la main
(`~/Desktop/lumierejaune`), un registre precis — une source chaude posee dans un
cadre qui reste sobre.

**DIX PHOTOS NE SE MESURENT PAS**, mais elles designent une direction. Chaque
photo du corpus est decrite par son ecart a la mediane de SA famille, et on garde
les 60 plus proches du modele. Elles viennent de **dix familles** (auto 19,
interieur 10, mer 8, architecture 5, ville-nuit 5, rue 5...): la ressemblance
porte donc sur le traitement, pas sur le sujet.

**CE QUE LA MESURE TROUVE, et qui n'etait dans aucun preset du projet** :

| etalonnage | ombres | medians | clairs | **reflets** |
|---|---|---|---|---|
| a\* | -2,76 | -1,18 | -1,26 | **-0,36** |
| b\* | +1,05 | +5,11 | +8,38 | **+8,23** |

Le b\* monte de +1 a +8 du bas vers le haut: c'est un **split-tone**, la ou le
tronc pose un voile a peu pres uniforme. La chaleur est DANS la lumiere.

**LA BANDE DES REFLETS EST NEUVE.** Un tiers clair contient un mur au soleil;
ses 10 % du haut contiennent la lampe, et les deux ne portent pas la meme teinte.
Sans cette bande, le cinquieme point de la table retombait vers zero comme
partout ailleurs, et le preset ne parcourait que **16 %** du chemin vers le
modele sur la teinte des reflets. Avec, il en fait 37 %, et le blanc devient
l'ivoire mesure (245, 239, 223) au lieu d'un blanc neutre. Le a\* est a -0,36,
donc la regle « pas de vert dans les blancs » tient toujours.

**UN INSTRUMENT NEUF : `juger-vers-modele.mjs`.** Il manquait au projet. On
applique le preset a 36 photos neutres, on profile le resultat avec l'instrument
qui a profile le modele, et on rapporte le CHEMIN PARCOURU: 0 % = rien fait,
100 % = pile sur le modele, au-dela = depassement. C'est ce test qui a condamne
la premiere courbe d'`ambre` (point blanc 170 %, contraste 273 %) et qui a
mesure la reussite de la seconde (peau 101 %, point blanc 84 %, contraste
118 %, ombres 108 %).

Deux grandeurs en sortent explicitement: `reflets b*` et `chroma` sont menees par
le CONTENU des scenes — des couchants et des lampes. Un preset qui les
atteindrait poserait ce jaune sur tous les blancs.

**LA COURBE EST CALEE, PAS TRANSPORTEE.** Le transport brut emportait encore
l'exposition de ses soixante photos (sombres parce que shootees a contre-jour).
On garde sa forme et on cale ses deux reperes avec **une seule puissance en
lumiere lineaire**, `y = 1,11 x^0,865` — deux nombres, deux cibles mesurees. Une
puissance ne peut ni s'inverser ni s'aplatir: pente minimale 0,56, contre les
trois rattrapages par morceaux essayes avant, qui fabriquaient tous un plat.

**DEUX DENSITES.** Le modele se coupe sans ambiguite sur le point blanc: 7 photos
a 234 / contraste 208, et 3 photos a 161 / contraste 129. `ambre-nuit` reprend la
couleur d'`ambre` au mot pres et ne change que sa courbe. Sur son propre
registre il tombe a **97 % et 98 %** des deux reperes, la ou `ambre` n'en fait
que 20 et 11.

La cible de contraste du registre CLAIR (208) est, elle, **inatteignable sans
ecreter**. On ne la poursuit pas: elle vient des scenes, pas d'un reglage.

**UN REPLIEMENT DE TEINTE, ANALYSE PLUTOT QUE RATTRAPE.** A tres basse chroma, le
decalage de split-tone est plus long que le rayon de teinte et COMPRIME les
teintes voisines. Ce n'est pas le defaut deja vu deux fois: une compression
rapproche, une bande separe. Le test du voile tranche — `ambre` amplifie les
ecarts de **1,24×**, contre 1,58× pour le tronc et 3,03× pour `powlisher`, qui
est le plancher du projet. Aucun contour.

**Verifie a l'oeil** : `AMBRE-VS-MODELE.jpg`, `AMBRE-DEUX-DENSITES.jpg`.
**Reste a valider par le porteur du projet.**

## Journal — 2026-08-27 (le preset rate, et les deux erreurs de mesure qu'il cachait)

**Ce qui a change dans l'arbre** : rien d'ajoute. Modifies :
`scripts/mesurer-variante.mjs`, `scripts/axe-developpement.mjs`,
`scripts/courbes-variantes.mjs`, `visionPresets.js`, `smoke-vision-preset.mjs`.
**`powlisher-cine-doux` retire** (jamais valide, jamais entre dans
`docs/presets-valides.md`). **`powlisher-chaud` et `powlisher-froid` ajoutes.**

**LE SYMPTOME** : `powlisher-cine-doux` saturait les murs ocres d'une cour
marocaine jusqu'au rouge. Vu par le porteur du projet dans l'app, pas par les
tests — les 137 verifications passaient toutes.

**ERREUR 1 — l'axe se mordait la queue.** Il etait calcule sur des variables de
tonalite ET de couleur melangees (`refletA`, `refletB`, `hautesA`, `chroma`). Le
pole etait donc DEFINI par « ses reflets sont chauds et colores », et mesurer
ensuite la couleur de ce pole ne pouvait rendre qu'une chose: que ses reflets
etaient chauds et colores. Corrige: l'axe se calcule sur la seule tonalite, et la
couleur est une DECOUVERTE faite apres coup. La part de variance passe de 26 a
**45 %** — un axe qui ne porte qu'une question est bien plus net.

**ERREUR 2 — le rapport de chroma mesurait le decor.** Pris sur tous les pixels
d'une bande claire, il repondait a « sa bande claire est-elle plus coloree que la
leur ? ». La reponse etait oui, parce qu'il photographie des couchants la ou le
tas neutre a des ciels blancs. Pris **teinte par teinte** puis median, il repond a
« pour un jaune donne, le pose-t-il plus sature ? ».

    pole chaud, bande claire :  2,03 en brut  ->  1,01 teinte par teinte

Le ×2 etait entierement du contenu. **Aucun pole de son corpus n'augmente la
saturation** : les cinq mesures tombent entre 0,77 et 1,23. C'est un look qui
RETIRE de la couleur. Le tronc, mesure autrement des le depart, le disait deja
(0,85 / 0,83 / 0,99) — c'est la variante qui avait tort, pas lui.

Corrigee aussi au passage : les bandes etaient des tranches de L absolues. Ses
photos etant plus sombres, sa « bande L 66-101 » ne contient que quelques
speculaires la ou celle du tas neutre contient tout le ciel. Les bandes sont
maintenant des **tiers de pixels de chaque tas** — l'appariement de quantiles,
applique a la couleur.

**LES DEUX AXES, MAINTENANT SEPARES.** Chacun centre par famille de sujet,
chacun peuple aux deux poles par les DIX familles :

| axe | variance | poles |
|---|---|---|
| niveaux (`pointBlanc`, `refletLuma`, `contraste`, `partOmbres`...) | 45,1 % | `-net` / tronc / (`-doux`, abandonne) |
| couleurs (`hautesA/B`, `refletA/B`, `mediansA/B`, `lumiereA/B`) | 33,6 % | `froid` / tronc / `chaud` |

Ce que l'axe des couleurs trouve, **sans que la couleur ait servi a le former** :

|  | froid | tronc | chaud |
|---|---|---|---|
| a\* de la lumiere | -4,9 | -1,4 | -0,9 |
| b\* des reflets | +2,0 | +9,5 | +29,7 |
| a\* des hautes | -6,0 | +0,3 | +2,8 |
| etalonnage a\*, clairs | -4,07 | -2,3 | **+0,06** |

`chaud` est le seul membre de la famille dont la lumiere ne tire plus DU TOUT au
vert. C'etait la demande — et elle etait deja dans ses photos.

**`-doux` ABANDONNE, et pourquoi.** Son transport coute -1,79 EV au gris moyen
meme apres la correction, et son pied ecrase plus de huit niveaux d'entree dans
un seul niveau de sortie. Huit, c'est le pas d'entree de la LUT: en dessous, la
difference n'existe plus et aucune interpolation ne la fait revenir. Trois
facons de lui rendre son exposition ont ete construites puis jetees — les trois
deplacent le plat du bas vers le haut au lieu de le supprimer.
`courbes-variantes.mjs` verifie desormais cette pente minimale sur toutes les
courbes.

**Tests** : `test:vision-preset` passe a **150 verifications**, dont un garde-fou
neuf — aucune variante ne doit multiplier la chroma d'une ocre, d'un feuillage,
d'un ciel ou d'une peau par plus de 1,3.

**Verifie a l'oeil** : `DUEL-COULEUR.jpg`. Plus rien ne brule ; `chaud` est
chaud sans etre sature. **Reste a valider par le porteur du projet.**

## Journal — 2026-08-26 (la famille cine : quatre variantes mesurees)

**Ce qui a change dans l'arbre** : `scripts/mesurer-familles.mjs`,
`scripts/mesurer-variante.mjs`, `scripts/axe-developpement.mjs`,
`scripts/courbes-variantes.mjs` ajoutes. Modifies : `visionPresets.js`
(+4 presets, **aucune suppression**), `smoke-vision-preset.mjs` (+32
verifications, 105 -> 137), `todo.md`.

**L'AXE.** Ses 309 photos (les dix familles d'au moins douze) ont ete projetees
sur la direction principale de leur nuage, apres avoir retranche a chaque photo
la mediane de SA famille de sujet. Sans ce centrage la premiere direction serait
« jour contre nuit », c'est-a-dire le sujet. Avec, elle porte 26 % de ce qui
varie a sujet egal, et elle se lit d'un coup :

    + reflets jaunes, + hautes lumieres chaudes, + part d'ombre
    - point blanc,    - luminance des reflets,   - contraste

C'est exactement l'axe nomme a l'oeil par le porteur du projet. **Les DIX
familles peuplent les deux poles** (`architecture` 12 et 11, `auto` 10 et 10,
`interieur` 11 et 10, `mer` 6 et 6) : un pole qui serait un sujet deguise serait
peuple par une famille ou deux.

Mesure aux trois positions, en ecart a un tas neutre de meme composition :

| | net | tronc | doux |
|---|---|---|---|
| point blanc | -9 | -19 | -61,5 |
| luminance des reflets | -11 | -17 | -51,5 |
| reflets b\* | +0,93 | +9,30 | +28,86 |
| hautes a\* | -3,38 | -0,03 | +3,06 |
| ombres a\* | -4,20 | -2,76 | -2,69 |

Monotone sur les deux variables nommees. Et les ombres restent vertes aux trois
positions : c'est la constante du look, elle ne bouge pas avec l'axe.

**CE QUE L'AXE EST VRAIMENT, cote tonalite.** Une fois l'exposition retiree, les
deux poles se ressemblent : `doux` coute -1,46 EV au gris moyen et `net` en gagne
+0,65, mais leur FORME de courbe differe peu. **L'axe est donc, tonalement, un
axe d'exposition ; ce qui differe a exposition egale, c'est la COULEUR.** Trois
facons de rendre son exposition a `doux` ont ete construites puis jetees — gain
global, gain s'eteignant dans les clairs, epaule filmique en lumiere lineaire :
les trois fabriquent un PLATEAU dans les hautes lumieres suivi d'un saut vers le
plafond, parce qu'on demande a une courbe de monter au milieu et pas en haut. Un
plateau comprime, et ce qui est comprime bande. On garde donc les transports tels
qu'ils sont mesures, et le prix est annonce dans les `bestFor`.

**Un defaut attrape par le smoke, et sa vraie cause.** Les tables d'etalonnage
etaient indexees par L = 0..100 comme celles du tronc. Mais le tronc plafonne a
232 (L = 92,6) et pose son epaule a L = 100, soit 108 % de son propre blanc ;
`nuit` plafonne a 195 (L = 79) et se retrouvait avec -4,2 en a\* sur son propre
blanc — **le blanc virait au vert de 7,5 niveaux**, exactement le defaut que
l'epaule existe pour empecher. Les tables sont maintenant indexees par L rapporte
au blanc de la variante. Ce n'est pas un rattrapage : la bande « clairs » de
`nuit` a ete mesuree sur des photos dont le point blanc est a 149, donc sur le
haut de SA plage, pas sur le haut de l'echelle.

**Le limiteur de chroma.** `doux` mesure un rapport de 2,12 dans les clairs.
Applique tel quel a une couleur deja franche, il la pousse hors du gamut ou elle
s'ecrete canal par canal : la teinte tourne et la zone devient un aplat. Les
quatre variantes passent donc par `c' = P (1 - exp(-c g / P))`, qui rend le gain
mesure sur les couleurs discretes et sature vers P sur les franches — la
Vibrance de Lightroom. **P = 87 n'est pas choisi** : c'est le 99,9e centile de la
chroma Lab de ses 324 photos. Mesure sur 48 photos neutres : ecretage
0,00-0,05 % contre 1,72 % dans les originales.

**Verifie a l'oeil** (planches dans `~/Desktop/powlisher-biblio/`) : degrades de
ciel a 1:1 sans bande dans les quatre, peau tenue, ciels francs non vires au
menthe. **Reste a valider par le porteur du projet.**

## Journal — 2026-08-25 (`powlisher-cine` : un preset entierement mesure)

**Ce qui a change dans l'arbre** : `scripts/planche-duel.mjs`,
`scripts/mesurer-etalonnage.mjs`, `scripts/variantes.mjs` ajoutes. Modifies :
`visionPresets.js` (+1 preset, **aucune suppression**), `smoke-vision-preset.mjs`
(+7 verifications), `docs/presets-valides.md`.

**Le preset** : `powlisher-cine`. Trois etages, tous mesures.

| | mesure | source |
|---|---|---|
| rotation TSL du bleu | -6,7° dans les ombres, -11,8° dans les clairs | ecart de teinte moyenne, secteur par secteur, entre ses 324 photos et 374 neutres |
| jaune / vert / orange | +5,1° / +2,2° / +1,8° | idem |
| etalonnage | a\* -2,3 partout, b\* +2,0 / +5,6 / +4,7 | teinte des quasi-gris, **en ecart au tas neutre** |
| saturation par plage | 0,85 / 0,83 / 0,99 / 1,11 | rapport des chromas moyennes |
| courbe de tonalite | appariement de quantiles | histogrammes des deux corpus |

**Trois erreurs de fond, toutes vues a l'oeil avant d'etre comprises :**

1. **Les attracteurs.** Premiere version : chaque teinte etait TIREE VERS une
   cible mesuree. Ca passait toutes les mesures et c'etait faux — un attracteur
   fait CONVERGER deux teintes voisines, donc un ciel en degrade sortait avec
   une bande. Remplace par des rotations d'ANGLE FIXE, facon panneau TSL. La
   raison de fond : aucun preset Lightroom ne contient d'attracteur, et ses
   photos ont ete faites dans Lightroom.
2. **L'extrapolation dans les blancs.** La mesure de l'etalonnage ecarte les
   pixels au-dessus de L = 97 ; la prolonger jusqu'au blanc faisait virier au
   **vert-gris** un grand ciel a contre-jour. Les tables retombent maintenant
   vers zero au sommet.
3. **L'appariement de quantiles comme angle de rotation.** Il rendait -125° et
   +55°, ce qui n'a aucun sens pour un curseur TSL (Lightroom plafonne vers 30°).
   Le bon estimateur est l'ecart de teinte MOYENNE par secteur, qui rend 2 a 12
   degres.

**Ce que dit le corpus elargi, et que 36 photos ne pouvaient pas dire :**

- sa lumiere tire vers le **jaune-vert**, pas vers l'orange dore : a\* est
  NEGATIF dans les douze familles. C'est ce qui separe son rendu d'un filtre
  chaud ordinaire ;
- ses reflets (le 1 % le plus lumineux) sont **jaunes**, b\* de +3 a +31, et
  culminent entre 183 et 238 — jamais pres de 255 ;
- ses photos forment un **nuage continu**, pas des reglages distincts : sur huit
  familles assez fournies, aucune coupure ne separe les developpements mieux que
  les sujets, sauf `auto`, `interieur` et `mer` — et la, ce sont toujours les
  MEMES variables qui separent (`refletB`, `pointBlanc`, `contraste`). Il y a
  donc **un seul axe de variation**, pas neuf sous-traitements.

**Verdict a l'oeil du porteur du projet** : garde. Tres bien sur les images
fades ou plates, reanime les verts, interessant sur les sujets sombres ; moins
bien sur les tres forts contrastes, et la couleur d'un sujet jaune tourne un peu.

## Journal — 2026-08-24 (une bibliotheque de 324 photos de @powl_d, rangee par sujet)

**Ce qui a change dans l'arbre** : quatre scripts ajoutes dans `scripts/` —
`profil-corpus.mjs`, `grouper-corpus.mjs`, `moissonner-powlisher.mjs`,
`trier-biblio.mjs`, `categoriser.mjs`. Aucun preset touche, aucun code produit
modifie : ce lot est de la MESURE, pas de la livraison.

**Pourquoi** : les presets `powlisher*` ont ete deduits de 36 photos, et le
porteur du projet trouve que le rendu n'atteint pas celui de la source. Le
verrou n'etait pas la methode de mesure mais la TAILLE et la PURETE du corpus :
36 photos tous sujets confondus ne permettent pas de distinguer « son
developpement » de « son sujet ».

**Ce qui a ete fait** : 807 posts recuperes (mai-aout 2026, donc son traitement
actuel, aucun melange d'epoques), 1 587 photos telechargees en resolution
d'origine, 464 ecartees comme non photographiques, 19 doublons, puis les 1 114
restantes regardees une par une sur planches numerotees. **324 retenues**,
classees en 12 familles : auto 67, interieur 48, architecture 37, mer 37,
ville-nuit 30, rue 27, paysage 18, moto 17, aerien 13, avion 12, soiree 8,
portrait 7.

**Deux pieges attrapes, tous les deux du meme genre** — un indicateur qui prend
sa signature pour un defaut :

1. Le detecteur de captures d'ecran rejetait ses photos de cabine d'avion et ses
   vues de ville de nuit, sur un « aplat d'une seule couleur exacte » de 10 a
   41 %. Cet aplat, c'etait du noir bouche, c'est-a-dire la signature meme du
   look. Corrige : un aplat ne compte que s'il est CLAIR (`dominanteLuma > 24`).
2. Le test d'ecart au traitement dominant rejetait les gratte-ciels de Shanghai
   au-dessus des nuages et un coucher de soleil sur mer, parce qu'il comparait
   toutes les photos a une mediane TOUS SUJETS CONFONDUS. Retire du tri
   automatique (`--ecarter-hors-cadre` pour le revoir) : cet ecart ne se mesure
   qu'a l'interieur d'une famille.

**Ce que le corpus elargi dit** (medianes par famille, `profils-par-sujet.json`) :

- **aucune famille n'ecrete** : 0,00 % de pixels a 255 partout. Le point blanc
  se pose entre 197 et 234 selon la famille, jamais a 255. C'est la regle la plus
  ferme du look, et elle est maintenant verifiee sur 324 photos.
- le pied est a 0-2 sur presque tout (11 sur les portraits) : noirs denses.
- le ciel atterrit a **184-193°** sur les familles de jour. L'ancienne cible
  (178-196°) avait ete deduite de DEUX photos ; elle est ici confirmee sur 44.
- la chroma reste modeste : 11 a 17, et 6,9 en ville de nuit. Ce n'est pas un
  look sature.
- l'exposition, elle, varie enormement d'une famille a l'autre (luminance
  mediane de 23 en ville-nuit a 124 en mer). **Ca, aucun preset ne le fait** :
  c'est un reglage photo par photo, et c'est une part de l'ecart ressenti.

**Ou vivent les fichiers** : `~/Desktop/powlisher-biblio/` (hors depot, ce ne
sont pas nos photos) — `brut/` la moisson, `par-sujet/` la bibliotheque,
`posts.txt` les 807 identifiants, `labels.txt` le classement a l'oeil,
`PLANCHE-<famille>.jpg` et `CONTROLE-*.jpg` pour l'oeil.

## Journal — 2026-08-22 sexies (le grand cote, pas la largeur)

**Ce qui a change dans l'arbre** : rien. Modifies :
`engine/studioRenderer.js`, `utils/canvasUtils.js`, `utils/grainField.js`,
`scripts/mesure-grain-photo.mjs`, `scripts/smoke-vision-preset.mjs`, `todo.md`.

**UN SEUL EXPORT, ET IL TRANCHE.** Une mire de 2160x3240 exportee de Lightroom
en PORTRAIT rend un grain de **12,62** — exactement celui de la MEME mire en
paysage 3240x2160 (**12,64**). Si Lightroom lisait la LARGEUR, la version
portrait aurait rendu 15,73.

C'est donc le **GRAND COTE** de l'image qui fixe le grain, et l'orientation n'y
change rien. Notre moteur lisait la largeur: une photo verticale de 9180x16320
etait traitee comme une image de 9180 alors que Lightroom y voit 16320 —
**47 % d'ecart sur le grain de toute photo verticale**.

Corrige: `largeurImage`/`largeurRendu` deviennent `grandCoteImage`/
`grandCoteRendu` (`Math.max(sWidth, sHeight)`), de `renderStudio` jusqu'a
`applyFilmGrain`. Le nom dit desormais la verite, ce qui est la meilleure
protection contre la troisieme occurrence du meme bug. Deux tests le gardent.

**Sur la vraie photo**: l'ecart passe de **+47 % a +17 %**. La Taille de CN14 a
ete VERIFIEE dans son panneau le meme jour — Grain 25, Taille 10, Cassure 50,
le releve d'import etait juste. Reste donc la seule autre cause: l'extrapolation
au-dela de 9720 px.

**Et c'est confirme par la seconde photo.** `photo-test-1` fait 5392 de grand
cote, DANS le domaine mesure: son grain 7,73, le notre 7,41 — **-4 %**.
`photo-test-2` fait 16320, soit 150 Mpx et 1,7x au-dela de la plus grande mire:
**+17 %**. C'est la seule difference entre les deux. Sur une photo normale, on y
est; au-dela de 9720 px on extrapole, et ca se paie.

**Tests** : `test:vision-preset` passe a **98 verifications**.

## Journal — 2026-08-22 quinquies (le produit tombe, la surface le remplace)

**Ce qui a change dans l'arbre** : rien. Modifies :
`src/features/vibefx-studio/utils/grainField.js` (la loi),
`visionColorScience.js` (borne `grainRoughness`), `canvasUtils.js`,
`engine/studioRenderer.js`, `scripts/import-lightroom-preset.mjs`,
`scripts/smoke-vision-preset.mjs`, `todo.md`.

**Huit exports de plus** (dossier `🔴 GRAIN - A FAIRE (8 exports)` sur le
Bureau): Tailles 10 et 40 a 1080/3240/6480 px, plus Cassure 0 et 100 a 1620 px.

**LE MODELE EN PRODUIT EST MORT.** Il multipliait une echelle de Taille par une
echelle de largeur. Il etait exact sur les DEUX AXES ou l'on avait mesure — la
Taille a 1620 px, la Taille 25 a toutes les largeurs — et personne n'avait
regarde ENTRE les deux. Les six exports du lot A donnent:

| cas | lui | le produit | ecart |
|---|---|---|---|
| Taille 10, 1080 px | 22,09 | 21,56 | -2 % |
| Taille 40, 1080 px | 19,22 | 18,99 | -1 % |
| Taille 10, 3240 px | 18,50 | 14,42 | **-22 %** |
| Taille 40, 3240 px | 9,53 | 10,79 | **+13 %** |
| Taille 10, 6480 px | 13,63 | 9,28 | **-32 %** |
| Taille 40, 6480 px | 6,83 | 6,96 | +2 % |

L'effet du curseur Taille GRANDIT avec l'image: le rapport Taille 10 / Taille 25
vaut 1,07 a 1080 px, 1,00 a 1620, 1,46 a 3240 et 1,67 a 6480. Sur une petite
image les Tailles basses se confondent (elles butent sur le pixel), sur une
grande elles s'ecartent. Aucun produit ne peut rendre ca — et le « repli sous le
pixel » qu'on avait pose la veille n'en etait qu'une moitie.

Remplace par une **SURFACE mesuree** (`GRAIN_SURFACE_MESUREE`): rangs Taille 10,
25 et 40 mesures d'un bout a l'autre — ce sont ceux ou vivent tous les presets —
plus deux points sur le rang 100, interpoles log-log sur la largeur et
lineairement sur la Taille. **Pire ecart sur les 18 exports: 0,13 %.**

**LA CASSURE N'ETAIT PAS NEGLIGEABLE.** Mesuree pour la premiere fois (mire
1620 px, Grain 50, Taille 25):

| Cassure | ecart-type | grosseur | |
|---|---|---|---|
| 0 | 31,65 | 1,02 px | **1,72x plus de grain**, meme finesse |
| 50 | 18,37 | 1,02 px | la reference |
| 100 | 18,23 | 1,58 px | meme force, grains 1,5x plus gros |

C'etait le piege silencieux du projet: un preset qui l'aurait changee aurait
fausse le grain de 72 % sans que rien ne le signale. Elle est desormais mesuree,
branchee de bout en bout (`grainRoughness`: bornes du moteur, normalisation,
`applyFilmGrain`, `studioRenderer`) et passable a l'import
(`--grainRoughness`). Elle agit sur les deux axes SEPAREMENT — la force d'un
cote, la grosseur de l'autre — ce qui confirme une derniere fois que ces deux
grandeurs sont independantes chez lui.

**UN BUG D'EXTRAPOLATION, trouve par le test.** La premiere version de la
surface choisissait une PENTE du rang guide selon les points qui tombaient dans
l'intervalle: elle changeait par sauts, et l'echelle RECULAIT de 6,7 % en
franchissant 9720 px — une image plus grande recevait un grain plus fin.
Remplacee par la croissance RELATIVE du guide, continue par construction. Un
test balaye 600 a 12000 px pour l'interdire.

**LA QUESTION QUI RESTE: LES IMAGES EN PORTRAIT.** `photo-test-2` fait
9180x16320 a l'ecran mais son fichier source fait 16320x9180 — l'orientation
EXIF la tourne. Lightroom voit donc un GRAND COTE de 16320 la ou notre moteur
lit une largeur de 9180. Sur son grain mesure (4,03/255) la surface rend 5,91
avec 9180 (+47 %) et 4,67 avec 16320 (+16 %). Toutes nos mires sont en paysage:
aucune ne peut trancher. Il faut UNE mire tournee en portrait (2160x3240), plus
une relecture du panneau Grain de CN14 (le releve dit Taille 10; au grand cote,
12 a 13 collerait).

**Tests** : `test:vision-preset` passe de 87 a **96 verifications**.

## Journal — 2026-08-22 quater (la forme du grain, le recadrage, et la cloture)

**Ce qui a change dans l'arbre** : rien. Modifies :
`src/features/vibefx-studio/utils/grainField.js`,
`scripts/smoke-vision-preset.mjs`, `todo.md`.

**LA FORME. Trois choses etaient confondues en une.** L'ECHELLE pilote la
FORCE. La GROSSEUR de ses grains n'est pas cette echelle — les deux coincident
jusqu'a 2 px puis divergent. Et le PAS d'interpolation n'est ni l'une ni
l'autre. Le code visait une grosseur egale a l'echelle: sur une mire de 9720 px
ca donnait 2,92 px la ou il en fait 3,35.

Table mesuree sur douze exports (echelle -> sa grosseur): 1,00 -> 1,02;
1,17 -> 1,12; 1,31 -> 1,27; 1,45 -> 1,44; 1,96 -> 1,96; 2,25 -> 2,44;
2,66 -> 3,35. Que la Taille 100 a 1080 px (1,33 -> 1,31) tombe pile dans cette
serie n'etait pas acquis: ca dit que la grosseur est une fonction de la SEULE
echelle, quel que soit le chemin qui y mene.

**UN BUG TROUVE EN CHEMIN, et il coutait cher.** Aux pas ENTIERS et
DEMI-ENTIERS, les points du reseau tombent sur la grille des pixels et le champ
cesse d'avoir un ecart-type de 1:

  pas 1,50 -> 1,057 ; 2,00 -> **1,127** ; 2,50 -> 1,021 ; 3,00 -> 1,054

L'ancienne table `GROSSEUR_PAR_PAS` avait un point a **pas 2,00 exactement**:
une image de la bonne taille recevait 13 % de grain en trop, sans que rien ne le
dise. `eviterResonance` ecarte desormais le pas de ces valeurs, et un test
balaye toute la plage pour que ca ne revienne pas.

**Resultat, les dix exports Lightroom, force ET grosseur:**

| largeur / Taille | sa force | la notre | sa grosseur | la notre |
|---|---|---|---|---|
| 810 px, T25 | 21,73 | 21,74 | 1,05 | 1,01 |
| 1080 px, T25 | 20,69 | 20,69 | 1,04 | 1,01 |
| 1620 px, T25 | 18,37 | 18,38 | 1,02 | 1,01 |
| 3240 px, T25 | 12,64 | 12,69 | 1,44 | 1,43 |
| 6480 px, T25 | 8,15 | 8,16 | 2,44 | 2,42 |
| 9720 px, T25 | 6,91 | 6,92 | 3,35 | **3,35** |
| 1620 px, T40 | 15,68 | 15,69 | 1,12 | 1,13 |
| 1620 px, T100 | 9,37 | 9,37 | 1,96 | 1,96 |

Vraie photo : **-1 / -0 / -0 %**, grosseur 2,35 contre 2,29 (elle etait a 2,19).

**LE RECADRAGE est teste**, ce qui n'avait jamais ete fait: la LOI (un cadre 2x
plus serre rend exactement le grain d'une image 2x plus etroite; rendu 1:1 c'est
bien ce grain; reduit a l'ecran il en montre moins) et le CABLAGE (le moteur
passe `sWidth` et le transmet au grain — lu dans la source, `studioRenderer.js`
etant du code navigateur que Node ne charge pas).

**LE GRAIN EST CLOS.** La regle de reouverture est ecrite dans `todo.md` et en
tete de `grainField.js`: trois cas, pas un de plus (Cassure changee, Taille > 50
sur un export social, image hors de 810–9720 px). La reduction du bruit de
Lightroom, qui nous manque toujours, n'en fait PAS partie: ce n'est pas du
grain, c'est un etage qui manque avant lui.

**Tests** : `test:vision-preset` passe de 87 a **94 verifications**.

## Journal — 2026-08-22 ter (le petit format, et le repli sous le pixel)

**Ce qui a change dans l'arbre** : `scripts/make-mire-largeur.mjs` (nouveau).
Modifies : `src/features/vibefx-studio/utils/grainField.js`,
`scripts/mesure-taille-grain.mjs` (il accepte des mires non entieres),
`scripts/smoke-vision-preset.mjs`, `todo.md`.

**Trois exports de plus** (dossier `✅ FAIT - grain, petit format` sur le Bureau) : mire A
dessinee a 1080 px en Taille 25 puis en Taille 100, et a 810 px en Taille 25.

**Le trou du petit format.** Un grain ne se dessine pas plus fin qu'un pixel:
sous 1 px son motif SE REPLIE sur la grille et son ecart-type monte MOINS VITE
que 1/echelle. Nous suivions 1/echelle jusqu'en bas.

| cas | echelle voulue | son ecart-type | le notre (avant) | ecart |
|---|---|---|---|---|
| Taille 25, 810 px | 0,688 | 21,73 | 26,70 | **+23 %** |
| Taille 25, 1080 px | 0,804 | 20,69 | 22,86 | **+10 %** |
| Taille 25, 1620 px | 1,000 | 18,37 | 18,37 | 0 % |

1080 px, c'est la taille d'un export social: c'etait donc le trou le plus cher.
Corrige par une table `GRAIN_REPLI_MESURE` qui n'agit QUE sous 1 — rien de ce
qui etait cale sur les grandes images ne bouge.

**La table des Tailles change d'unite.** Elle est desormais ecrite en echelles
VOULUES et non effectives. La Taille 0 y vaut 0,5825 (choisie pour que le repli
la ramene sur les 0,802 mesures a 1620) et la **Taille 10 y vaut 0,879**, lue
sur la VRAIE photo a 9180 px — la seule facon de lire une Taille basse sans que
le repli la contamine.

**Le mystere de la Taille 10 est resolu.** A 1620 px elle rendait exactement la
Taille 25 alors que les deux exports different sur 98 % de leurs pixels: leurs
deux echelles voulues, 0,879 et 1,000, se replient presque au meme endroit. On
en rend 0,932 la ou il en rend 1,000 — 7 % de trop, contre 13 % avant.

**Resultat sur les DIX exports Lightroom** (6 largeurs x 5 Tailles): ecart le
pire **0,13 %**. La vraie photo: **-1 / -0 / -0 %** sur les trois canaux.

**Ce que le TEMOIN a appris, et qui n'etait pas prevu.** La mire de 1080 px a
Taille 100 servait de controle: ses grains restent gros meme sur une petite
image, donc hors du repli. Son ecart-type vaut 13,86 (echelle 1,325), le notre
11,66 (echelle 1,575) — **-16 %**, alors que le produit `Taille x largeur`
predit 1,575. Autrement dit **ses gros grains retrecissent PLUS que ses petits
quand l'image retrecit**: la Taille et la largeur ne sont pas separables en
petit format, et un modele en produit ne peut pas le rendre. Sans le temoin, on
aurait mis cet ecart sur le dos du repli et « corrige » au mauvais endroit.

**Tests** : `test:vision-preset` passe de 82 a 87 verifications. Les deux ecarts
connus (Taille 10 a 1620, Taille 100 a 1080) sont BORNES par un test, pour
qu'une derive se voie au lieu de passer pour normale.

## Journal — 2026-08-22 bis (trois exports, et la loi de largeur qui tombe)

**Ce qui a change dans l'arbre** : rien. Modifies :
`src/features/vibefx-studio/utils/grainField.js`, `todo.md`,
`scripts/mesure-grain-photo.mjs` (il mesure aussi la GROSSEUR des grains).

**Trois exports Lightroom demandes et faits le meme jour** : mire A a 1620 px en
Taille 10 et en Taille 40, et une mire A agrandie x6 (9720x6480) en Taille 25.
Le dossier de depot vit sur le Bureau (`✅ FAIT - grain, exports du 22 aout`).

**L'exposant de largeur etait faux hors de son intervalle.** `(largeur/1620)^0,577`
etait ajuste sur 1620/3240/6480 et se trompait de **5,8 %** a 9720 px. Ce n'est
pas une loi de puissance : les pentes locales valent 0,539 / 0,633 / 0,407.
Remplace par une TABLE mesuree interpolee en log-log.

| largeur | son ecart-type | echelle mesuree | l'ancienne loi |
|---|---|---|---|
| 1620 | 18,37 | 1,000 | 1,000 |
| 3240 | 12,64 | 1,453 | 1,492 |
| 6480 | 8,15 | 2,254 | 2,225 |
| **9720** | **6,91** | **2,658** | **2,812** |

**C'etait ca, les 5 % de la vraie photo** — pas la couleur. Sur le ciel de
`photo-test-2` en CN14, apres retrait en quadrature du bruit de fond de sa
chaine (lu sur la meme photo en CN01, sans grain) :

| | son grain seul | le notre | ecart |
|---|---|---|---|
| avant | 4,83 / 4,04 / 4,02 | 4,57 / 3,85 / 3,84 | -5 % |
| apres | 4,83 / 4,04 / 4,02 | **4,77 / 4,01 / 4,00** | **-1 %** |

Et la force colle a **0,4 %** aux quatre tailles de mire mesurees.

**La Taille 40 est mesuree** (echelle 1,1716 ; on l'interpolait a 1,183).

**La Taille 10 a livre un fait inattendu.** A 1620 px elle rend EXACTEMENT la
Taille 25 : 18,37 et 1,01 px contre 18,37 et 1,02. Les deux exports different
pourtant sur 98 % de leurs pixels — ce sont bien deux tirages distincts. La
vraie photo dit l'inverse (a 9180 px, la Taille 10 y demande une echelle de
0,879, que l'interpolation donnait deja a 0,2 % pres). Ce qui reconcilie les
deux : **un grain ne se dessine pas plus fin qu'un pixel**, et Lightroom
n'augmente pas sa force pour compenser. Notre moteur, lui, le fait — 13 % de
trop. Sans consequence sur une photo, mais un **export social fait 1080 px** et
rien n'est mesure sous 1620. C'est le prochain export a demander. (La Taille 0
echappe a la regle : elle descend bien sous le pixel, avec une autocorrelation
au voisin NEGATIVE — un autre mecanisme, laisse tel quel.)

**Un ecart nouveau, honnete a poser** : sa force et sa grosseur cessent d'etre le
meme nombre quand l'image grandit. A 9720 px sa force dit « echelle 2,66 », sa
longueur de correlation dit 3,35 — 26 % d'ecart, alors que les deux coincidaient
a 1620 et 3240. Sa FORME de grain change avec l'echelle. Nous posons la bonne
force et des grains un peu trop fins (2,92 contre 3,35 a 9720 ; 2,21 contre 2,29
sur la photo). Remodeler le spectre demanderait plus de deux points.

## Journal — 2026-08-22 (le grain, dans l'espace ou Lightroom le pose)

**Ce qui a change dans l'arbre** : `scripts/mesure-grain-canaux.mjs` et
`scripts/mesure-grain-photo.mjs` (nouveaux). Modifies :
`src/features/vibefx-studio/utils/grainField.js` (la loi),
`src/features/vibefx-studio/utils/canvasUtils.js` (`applyFilmGrain`),
`scripts/mesure-grain-lightroom.mjs`, `scripts/smoke-vision-preset.mjs`.

**Le trou qui restait.** Son grain posait 21,7 a 23,3/255 sur les aplats
colores contre 18,4 sur les gris; le notre posait 18,4 partout. La piste
inscrite dans le prompt de reprise — « trois bruits tires par canal » — etait
la premiere a tester. Elle est FAUSSE : la correlation entre canaux de son
champ de grain vaut 0,95 a 1,00 sur les 24 aplats. Trois bruits independants
donneraient 0,00. Son grain est bien monochrome.

**Ce qu'il fait vraiment.** Il pose son delta monochrome dans SON ESPACE DE
TRAVAIL — primaires ProPhoto, courbe de transfert sRVB — puis l'image revient
en sRVB. Tout le reste en decoule sans aucun parametre ajuste : l'amplification
inegale entre canaux, et l'ecretage a 0 qui explique pourquoi deux canaux du
meme carre ne portent pas le meme ecart-type. Le modele predit les 72
ecarts-types mesures a 1,8 % pres, ET les taux d'ecretage a 0,5 point pres
(cyan R : 28,9 % chez lui, 28,6 % predit).

**Les gris ne bougent pas, et c'est demontre, pas espere** : les lignes des deux
matrices somment a 1,000000000000, donc un pixel neutre est un point fixe. Le
moteur prend d'ailleurs un raccourci explicite sur ce cas.

**Resultat, mire A, trois valeurs de curseur exportees (15 / 50 / 100)** :

| | avant | apres |
|---|---|---|
| ecart max sur les GRIS | 6,4 % | **0,7 %** |
| ecart max sur les COULEURS | 27 % | **1,2 %** (5,5 % sur un seul cas, le cyan a Grain 100) |

**Deuxieme correction, trouvee en route : l'attenuation aux deux bouts.** Son
exposant etait cale sur UN seul rapport (0,67 au niveau 8, lu a la valeur 15).
Or ce rapport se lit APRES ecretage, et l'ecretage ne se comporte pas pareil
selon la force du grain : a Grain 50 un quart des pixels d'un gris 8 tombe a 0.
Reajuste sur DOUZE mesures (4 carres de bord x 3 valeurs de curseur), il passe
de 0,364 a **0,420**, et le pire ecart de 6,4 % a 0,68 %.

**Le cout, et ce qu'on en a fait.** Le detour demande neuf exponentiations par
pixel : 2,2 s pour 12 Mpx, soit dix secondes sur une photo de 9180 px. Deux
tables lues par interpolation lineaire rendent la meme chose en **430 ms**
(x5). `test:vision-preset` borne leur erreur a 0,01/255 contre les fonctions
exactes, qui restent dans le fichier.

**Ce que la vraie photo a appris, et qui corrige une conclusion precedente.**
On croyait que les 5 % manquants sur le ciel de `photo-test-2` (CN14) venaient
de la couleur. Non. La FORME est maintenant exacte — le rapport entre canaux
colle a 0,1 % — mais il reste 5 % UNIFORMES sur les trois canaux, et un ecart
uniforme n'est pas un effet de couleur. Ce n'est pas non plus le bruit de sa
chaine : la meme photo en CN01 (sans grain), lue sur les memes blocs, ne porte
que 0,23 / 0,51 / 0,58 de bruit de fond. Restent deux suspects, qui sont
exactement les deux points non mesures de `grainField.js` : la **Taille 10**
de CN14 (interpolee entre 0 et 25) et l'**exposant de largeur** (0,577, ajuste
jusqu'a 6480 px, extrapole a 9180). Un exposant de 0,549 fermerait l'ecart, et
0,549 tombe dans l'intervalle des pentes mesurees deux a deux. Aucun des deux
ne se tranche sans un nouvel export de Lightroom.

**Tests ajoutes** (`test:vision-preset`, 78 -> 82 verifications) : l'exactitude
des tables de transfert, le point fixe des neutres au bit pres, et l'ecart a
Lightroom sur les gris ET sur les couleurs — les nombres attendus venant de ses
exports, jamais d'un rendu de reference fabrique par nous.

## Journal — 2026-08-20 (premier import de la serie : CN01)

**Ce qui a change dans l'arbre** : `src/features/vibefx-studio/utils/presets/cn01.js`
(genere), `presets-lightroom/cn01-bloc4.png` (mire source).

**Circuit de travail cote utilisateur.** Un dossier `~/Desktop/📸 VIBEFX-IMPORTS/`
sert de boite aux lettres : un sous-dossier par preset, avec quatre cases
(`1-photos-des-panneaux`, `2-mire-exportee`, `3-photo-test-version-lightroom`,
`4-resultat-claude`). Un dossier `0-A-IMPORTER-DANS-LIGHTROOM` porte la mire
neutre et deux photos de test, importees une seule fois dans Lightroom. Les
instructions ne vivent PAS dans des fichiers a lire : elles sont donnees dans le
chat, les noms de dossiers portent le reste.

**CN01, mesures.** Mire exportee : ecart 35,98/255, rugosite 0,70 (aucun grain).
Panneaux releves : Texture 0, Clarte 0, Voile 0, Vignette 0 (sous-reglages aux
defauts), Grain 0, Nettete 0, Masquage vide. Donc **aucun effet spatial** :
`spatialFilters: {}`, la table capture 100 % du preset.

Rendu compare a Lightroom sur **deux** photos developpees des deux cotes :
**1,56/255** (90,5 % de l'effet reproduit) et **1,28/255** (95,6 %). Les deux
photos etant tres differentes, la coherence des deux mesures ecarte aussi
l'hypothese d'un reglage « Auto » cache. Verdict de l'instrument : « identique a
l'oeil ». Ajoute a `docs/presets-valides.md`.

**Question ouverte puis TRANCHEE le meme jour.** Le panneau Detail de CN01
affiche **Nettete 0** alors que CN11/CN17 portent **40** : l'hypothese posee
etait que 40 venait du FICHIER (defaut RAW) et non du preset. **Faux** — Matthis
a verifie : la majorite des presets affichent bien 40, CN01 est l'exception qui
pose 0. Rien a changer sur cn11/cn17. La regle reste : **on recopie ce que le
panneau affiche, le preset applique**, sans interpreter.

**Un manque du moteur repere au passage** : Lightroom a une **reduction du
bruit** (vue a Luminance 20 / Couleur 50 sur un autre preset) que notre moteur
n'a pas. Un preset qui en porte gardera chez nous un grain numerique que le sien
lisse — invisible a bas ISO, visible sur une photo prise dans le sombre. A
relever a l'import (c'est deja dans la capture du panneau Detail).

**Regles de travail assouplies (AGENTS.md).** Le prompt de reprise ne s'ecrit
plus dans le chat sauf demande explicite au debut de la session ; il reste ecrit
dans `docs/prompt-reprise-<date>.md`. Nouvelle section « Economie de contexte et
de quota » : lire par extraits, ne pas ouvrir les archives, pas de sous-agent
sans demande, gates cibles plutot que tous les gates.

## Journal — 2026-08-21 (zoom de l'apercu, et le grain verifie sur photo)

**Un zoom dans l'apercu de Vision**, aux paliers de Lightroom: Adapter, 100 %,
200 %, 400 %. Il ne recadre rien — `viewport { zoom, cx, cy }` traverse
`useCanvasRenderer` puis `renderStudio`, qui l'ignore hors apercu: un export ne
peut donc pas le recevoir par accident. Glisser deplace la loupe.

Il existe parce qu'un effet de MATIERE ne se juge pas sur une image reduite: a
« Adapter », une photo de 9180 px dessinee sur 800 montre un pixel sur onze, son
grain est moyenne, et on croit que le reglage ne fait rien. C'est la reponse de
Lightroom au meme probleme.

Au passage, un bug que le zoom a revele: `renderStudio` confondait **la largeur
de l'image finale** (qui fixe la grosseur du grain) et **la largeur de rendu**
(qui dit ce que l'affichage en montre). Sans recadrage les deux coincidaient;
des qu'on zoome, non. Elles sont desormais distinctes et nommees.

Deux defauts d'interface trouves en mesurant, pas en relisant:
- l'etiquette annoncait « 5 % » puis « 566 % » pour le meme geste — le canvas
  n'avait pas fini de se dimensionner quand elle etait calculee. Un
  `ResizeObserver` la tient a jour.
- les paliers x2 depassaient le 1 pour 1 sans rien montrer de plus. Ils sont
  desormais ancres sur le 100 % REEL, mesure sur le canvas.

**LE GRAIN VERIFIE SUR UNE VRAIE PHOTO**, ce qui n'avait jamais ete fait: toutes
nos comparaisons le mettaient a 0 des deux cotes (deux bruits aleatoires ne se
comparent pas pixel a pixel). Methode: zone plate du ciel de `photo-test-2`
(9180 px, CN14, grain 25 Taille 10), son grain retranche en quadrature du bruit
de la photo elle-meme.

| voisinage retire | son grain seul | ecart a notre loi (3,83) |
|---|---|---|
| 3 px | 3,81 | +0,4 % |
| 6 px | 4,00 | −4,3 % |
| 10 px | 4,05 | −5,5 % |
| 16 px | 4,06 | −5,7 % |

PIEGE DE MESURE, a retenir: un voisinage de 3 px SOUS-ESTIME un grain de 2,4 px
— une partie du grain entre dans la moyenne locale et se retrouve soustraite. La
mesure converge vers 4,05 quand le voisinage s'elargit. Un premier passage a 5x5
annoncait « 10 % d'ecart » qui n'existait pas.

Reste **5 % d'ecart, explique**: le ciel est teal sature, et son grain n'est pas
monochrome — sur les aplats colores il pose 22 a 23/255 contre 18,4 sur les gris,
la ou le notre pose la meme chose partout. Sur les gris, l'accord reste a x1,00.

Fige par un test: `smoke-vibeos-vision` verifie qu'a 100 % la matiere est
franchement plus presente qu'a « Adapter » (rapport, pas valeur absolue: une
valeur absolue dependrait de la fenetre).

## Journal — 2026-08-20 quinquies (deux corrections sur le grain, signalees a l'ecran)

Matthis a vu, dans l'apercu de Vision, un ciel CN14 couvert de bruit la ou
Lightroom est discret. Deux choses, dont une regression introduite le jour meme.

**1. REGRESSION: le grain etait calcule pour la taille du CANVAS.**
`applyFilmGrain` recevait la largeur du canvas de rendu. Or l'apercu de Vision
dessine a ~800 px une photo qui en fait 9180: le moteur posait donc le grain
d'une image de 800 px. Mesure a CN14 (grain 25, Taille 10):

| largeur de rendu | notre ecart-type |
|---|---|
| 800 px (apercu) | **15,64/255** |
| 9180 px (export) | 3,83/255 |

Lightroom calcule TOUJOURS son grain sur l'image entiere; son ecran montre cette
image reduite, donc un grain moyenne. C'est pour ca qu'en mode « Adapter » son
grain se devine a peine.

Corrige par `grainPourRendu(valeur, taille, largeurSource, largeurRendu)`: la
grosseur et la force sont celles de l'image FINALE, puis on applique ce que la
reduction leur fait — un bruit dont les grains sont plus petits que le facteur de
reduction s'efface en proportion, des grains plus gros survivent en retrecissant.
`studioRenderer` propage la largeur reellement echantillonnee (recadrage
compris). L'apercu passe de 15,64 a **0,80/255**; l'export ne bouge pas.

Consequence a connaitre: **un apercu montre desormais moins de grain qu'un
export**, et c'est le comportement juste — c'est celui de son ecran a lui.

**2. Le plafond du grain passe de 40 a 100**, l'echelle de Lightroom. Le 40
venait d'un garde-fou (« un grain de film credible vit entre 8 et 25 »). Mais un
garde-fou n'a de sens que contre un defaut qu'on ne peut pas rattraper — peau
orange, ciel fluo, noirs bouches; du grain trop fort se voit et se retire d'un
geste. Surtout, il ecretait EN SILENCE un preset importe qui aurait porte plus de
40, ce que cette chaine d'import doit precisement eviter.

## Journal — 2026-08-20 quater (CN16)

**Ce qui a change dans l'arbre** : `src/features/vibefx-studio/utils/presets/cn16.js`
(genere), `presets-lightroom/cn16-bloc4.png`.

**Releve** : Effets **tout a 0** (grain compris, Taille 25 / Cassure 50 aux
defauts), Detail Nettete 40 et Reduction du bruit 20/50, Masquage vide, profil
Couleur. Import sans `--lisser` (rugosite 0,66).

**Le look** : ombres FROIDES et hautes lumieres CHAUDES — un virage partiel
classique, lisible sur l'axe des gris (bleu −28 dans les gris sombres, −23 dans
les clairs). Ciel bleu profond conserve, mers plus saturees (+47 %).

**Mesures** : couleur **2,25** et **1,31/255** sur les deux photos, rendu complet
2,47 et 1,55. Coherence des deux photos: pas de reglage « Auto » cache.

**Un point regarde a l'oeil et pas seulement au chiffre** : l'audit annonce des
bandes a **4/255** (« a surveiller ») sur son degrade de ciel synthetique. Sur le
grand ciel reel de la photo 2 — un degrade bleu profond sur toute la hauteur du
cadre, le pire cas — rien n'est visible, ni chez nous ni chez lui.

## Journal — 2026-08-20 ter (le grain a enfin une GROSSEUR)

**Ce qui a change dans l'arbre** : `src/features/vibefx-studio/utils/grainField.js`
(nouveau, porte toute la loi du grain), `scripts/mesure-taille-grain.mjs`
(nouveau), `src/features/vibefx-studio/utils/presets/cn14.js` (nouveau, A VALIDER).

**Le probleme, tel que Matthis l'a vu.** « Le grain de CN17 n'est pas le meme que
sur Lightroom. » Deux hypotheses ont ete verifiees dans le code plutot que de
memoire, et une seule tenait.

FAUSSE PISTE, ecartee: le plafond 40 du curseur n'est PAS une echelle. Le nombre
veut dire la meme chose des deux cotes (ecart-type 0,367 x la valeur); 40 est un
garde-fou d'interface, le moteur va jusqu'a 100 comme lui. Un preset qui porterait
plus de 40 serait ecrete en silence — aucun des favoris n'est concerne.

VRAI PROBLEME: notre grain etait tire PIXEL PAR PIXEL, donc large de 1 px quelle
que soit la photo. Celui de Lightroom grossit avec la taille de l'image, et il a
un sous-reglage « Taille » (25 par defaut, **40 sur CN17**) qu'aucune mesure
d'ecart-type ne voyait passer.

**L'instrument.** `mesure-taille-grain.mjs` lit le bruit d'un aplat uni sans
aucun filtre (sur un aplat, tout ce qui varie EST le grain) et en tire deux
nombres: l'ecart-type et l'AUTOCORRELATION, qui donne la grosseur. Il sait
mesurer les deux moteurs — « nous:<taille>:<largeur> » appelle le vrai code du
rendu, jamais une copie.

**Six mires exportees par Matthis** (Grain 50, Cassure 50 partout) :

| Taille | image | ecart-type LR | grosseur LR |
|---|---|---|---|
| 0 | 1620x1080 | 22,91 | 1,05 px |
| 25 | 1620x1080 | 18,37 | 1,02 px |
| 50 | 1620x1080 | 14,08 | 1,27 px |
| 100 | 1620x1080 | 9,37 | 1,96 px |
| 25 | 3240x2160 | 12,64 | 1,44 px |
| 25 | 6480x4320 | 8,15 | 2,44 px |

**Ce que ces mesures disent**, et c'est le coeur de l'affaire : chez lui, la
force et la grosseur sont LE MEME NOMBRE vu de deux cotes. L'echelle deduite de
la force tombe sur la grosseur mesuree, ligne par ligne. Lightroom etale une
quantite FIXE de grain sur des grains plus ou moins gros — un grain deux fois
plus gros bruite deux fois moins chaque pixel. D'ou une seule loi :

    e = taille(Taille) x (largeur / 1620) ^ 0,577
    grains de `e` pixels, ecart-type 0,367 x valeur / e

L'exposant est ajuste sur les TROIS tailles d'image (pris deux a deux il vaut
0,539 puis 0,586); 0,577 est a 2,6 % du pire des trois points.

**Un piege d'instrument, attrape en route.** La premiere serie donnait 6 %
d'ecart de force entre nos deux moteurs, et la tentation etait de « corriger »
la constante 0,367, qui est validee depuis le 2026-08-15. C'etait la MESURE qui
etait fausse: elle moyennait les carres colores avec les gris, or Lightroom pose
un grain plus fort sur les couleurs saturees (22 a 23/255 sur le rouge, le vert
et le bleu, contre 18,4 sur les gris) la ou le notre est monochrome. Sur les gris
seuls: 18,37 chez lui, 18,38 chez nous. Rien a corriger.

**Un saut qu'il a fallu combler.** Interpoler un bruit ne sait pas produire de
grains entre 1,0 et 1,66 px: au pas 1,00 les points du reseau tombent sur les
pixels et rien ne s'interpole; des qu'on s'en ecarte, la grosseur SAUTE. Or c'est
justement la zone la plus courante (Taille 50, et toute image entre 1620 et
3240 px). Corrige par un MELANGE en quadrature de bruit d'un pixel et de bruit
interpole, lus a deux endroits eloignes de la table pour etre independants.

**Resultat, notre moteur face au sien sur les six cas** : force a **2,1 %** au
pire, grosseur a **5 %** au pire. Avant, sur une photo pleine resolution, notre
grain etait **2,3 fois trop fort et 2,4 fois trop fin**.

**Effets de bord assumes** :

- `cn17` reimporte avec `grainSize: 40`, sa vraie valeur. Table de couleurs
  **identique a l'octet pres** (verifie au `git diff`), seule la ligne du grain
  a bouge.
- La table de bruit passe de `Math.random()` a un tirage DETERMINISTE: deux
  rendus de la meme photo ont desormais le meme grain, et une mesure se rejoue.
- `grainSize` est branche dans le moteur, les bornes, les defauts et l'import
  (`--grainSize`), mais **PAS dans le panneau Vision**: un curseur qui ne fait
  rien tant que le grain vaut 0 demande une decision d'interface, pas un
  branchement en douce.
- `mesure-grain-lightroom.mjs`, `planche-grain.mjs` et `audit-vision-filters.mjs`
  lisent maintenant `grainField.js` au lieu de recopier le moteur ou de le lire
  par expression reguliere.

**Reserves** : la forme exacte de sa tache de grain n'est pas reproduite (son
autocorrelation est plus courte et plus piquee que celle d'une bilineaire) — ca
se verrait a la loupe, pas a l'oeil. La « Cassure » reste non mesuree. Rien n'est
mesure au-dela de 6480 px.

**CN14 : importe et VALIDE — apres une fausse piste qu'il faut raconter.**

Premier diagnostic, FAUX: sa mire ayant ete exportee avec son Grain 25 dessus
(rugosite 8,38 pour un seuil de 3), l'ecart de 6,74/255 sur photo a ete impute a
une table bruitee. Une mire reexportee Grain a 0 a donne exactement le meme
ecart: **6,72**. Le lissage avait donc parfaitement fait son travail, et la
cause etait ailleurs.

VRAIE CAUSE: **son grain est dans SES photos, et deux grains aleatoires ne
tombent jamais aux memes endroits.** L'ecart pixel a pixel ne peut donc pas etre
nul, meme avec une table parfaite. Mesure par blocs de 8x8 — qui divise ce bruit
par 8 et laisse la couleur — l'ecart tombe a **1,49** et **1,48/255** sur les
deux photos. Deux chiffres quasi identiques sur des photos tres differentes:
la capture est bonne, et l'hypothese d'un reglage « Auto » est ecartee.

Ce que ca change pour la suite: `compare-preset-vs-lightroom.mjs` affiche
desormais une ligne « couleur seule, par blocs » des que le preset porte du
grain. Sans elle, tout preset a grain aurait l'air rate. La lecon est inscrite
dans `docs/presets-valides.md`.

Releve complet de CN14: Effets tout a 0 sauf **Grain 25, Taille 10**,
Cassure 50; Detail Nettete 40, Reduction du bruit 20/50; Masquage vide.

## Journal — 2026-08-20 bis (deuxieme import de la serie : CN13)

**Ce qui a change dans l'arbre** : `src/features/vibefx-studio/utils/presets/cn13.js`
(genere), `presets-lightroom/cn13-bloc4.png` (mire source).

**Panneaux releves** (captures dans `~/Desktop/📸 VIBEFX-IMPORTS/CN13/1-photos-des-panneaux/`) :
Effets **tout a 0** (Texture, Clarte, Voile, Vignette, Grain), Detail **Nettete 40**
plus une **Reduction manuelle du bruit Luminance 20 / Couleur 50**, Masquage **vide**,
profil **Couleur**, N&B non actif. Seul `sharpness: 40` est reproductible : la
reduction du bruit n'existe pas dans notre moteur (limite deja notee).

**Mesures.** Mire : ecart 23,62/255, rugosite 0,70 — aucun grain, donc import
**sans `--lisser`**. Audit : bandes **3/255** (pire cas), invisible. Axe des gris
chaud (B −22 a 128, −31 a 200), ciel tourne de **−20°** vers le teal et assombri
de 21 %, verts assombris, peau a peine plus chaude (+4,8°, −7,3 % de luminosite).

**Compare a Lightroom sur les deux photos**, developpees des deux cotes :
**2,27/255** (86,6 % de l'effet reproduit ; couleur seule 2,08) et **1,67/255**
(90,4 % ; couleur seule 1,47). Verdicts de l'instrument : « meme rendu, ecart
invisible » et « identique a l'oeil ». Planches regardees a l'oeil, rangees dans
`4-resultat-claude/` : les deux versions sont indiscernables, la carte d'ecart x8
est quasi noire hors feuillage. La coherence des deux mesures sur des photos tres
differentes ecarte l'hypothese d'un reglage « Auto » cache.

**Ce que confirme cet import** : sur les zones plates, notre nettete 40 amplifie
le bruit du JPEG (x1,25 a x1,36 la ou la cible est x1,00) — c'est le trou n°3 du
lot en cours, pas une erreur de relevé. Sur les contours, la quantite de matiere
est bonne (x1,10 / x1,16). L'ecart « couleur seule » reste sous 2,1/255 : c'est
la ligne qui juge la capture, et elle est bonne.

Ajoute a `docs/presets-valides.md`.

## Journal — 2026-08-19 (l'instrument de comparaison passe par le vrai moteur)

**Le probleme**: `compare-preset-vs-lightroom.mjs` n'appliquait que la LUT. Il
mesurait donc la COULEUR et rien d'autre, alors qu'un preset Lightroom porte
aussi des effets qu'aucune table ne contient. L'ecart lu melangeait deux causes
sans permettre de les separer — c'est comme ca que la Nettete 40 de `cn17` est
restee invisible plusieurs jours, lue comme un vague ecart sur les contours de la
roche. Or la strategie pour la vague d'imports qui vient est justement « on
comparera les images en sortie »: il fallait que cette comparaison voie tout.

**Ce qu'il fait maintenant.** Deux rendus: couleur seule (LUT, en Node) et rendu
COMPLET (`renderStudio` dans un Chromium, avec les `spatialFilters` du preset,
qualite `high` — la qualite `low` saute justement relief, nettete, voile et
grain). Le GRAIN est force a 0 des deux cotes: deux bruits aleatoires ne se
comparent pas pixel a pixel, et le laisser ferait passer un rendu juste pour un
rendu faux. Cout: **9 s** sur 5392x3032. `--sans-effets` revient au comportement
d'avant, `--sortie` ecrit notre rendu sur disque.

**ET IL REPOND A DEUX QUESTIONS, pas une.** L'ecart pixel a pixel demande « nos
pixels tombent-ils au meme endroit ». Il ne suffit pas: un effet spatial peut
avoir exactement la bonne force et FAIRE MONTER cet ecart, parce qu'accentuer une
arete deplace des pixels des deux cotes — un noyau legerement different coute
quelques 1/255 la ou ne rien faire n'en coutait aucun, tout en laissant l'image
plus molle que la sienne. On mesure donc aussi la MATIERE presente (gradient), et
on separe les CONTOURS des ZONES PLATES: une moyenne globale melangerait la
matiere qu'on veut reproduire et le BRUIT qu'un masque flou amplifie sans qu'on
le lui demande. Le masque des contours (les 20 % de pixels au gradient le plus
fort) vient de LIGHTROOM, jamais de notre rendu — sinon il bougerait avec ce
qu'on mesure.

**PREMIERE MESURE, et elle est neuve** (`cn17`, photo de plage 16 Mpx):

  ecart pixel a pixel   couleur seule 1,95/255   avec les effets 2,18/255
  matiere, CONTOURS     couleur seule x0,874     avec les effets x1,118
  matiere, ZONES PLATES couleur seule x1,019     avec les effets x1,464

Lecture: sans la Nettete 40 nous sommes **12,6 % trop mous** sur les contours,
avec elle **11,8 % trop durs** — la valeur relevee dans son panneau est la bonne,
c'est le NOYAU qui differe un peu. Et sur les zones plates, notre nettete
**amplifie le bruit du JPEG x1,46**: sa nettete a un curseur **Masquage** et
travaille sur du RAW ou il n'y a presque pas de bruit a amplifier, la notre n'a
ni l'un ni l'autre. A l'oeil, sur la planche a 1:1, ca ne se voit pas sur cette
photo; sur un grand ciel uni d'une photo bruitee, ca se verrait.

Note honnete: la premiere version de la mesure de matiere ne separait pas
contours et zones plates. Elle affichait x1,207 global et concluait « la force
relevee est suspecte » — ce qui etait FAUX: la force est bonne, c'est le bruit
qui gonflait la moyenne. Le meme piege que « juger un effet local a sa moyenne ».

## Journal — 2026-08-19 (suite : la clarte negative calee, l'import qui avoue)

Les deux trous que l'audit du matin avait ouverts et qui se fermaient sans
attendre quoi que ce soit de Matthis (les exports Lightroom etaient deja sur le
disque). Les trois autres — voile, masque de contours, nettete haute — restent
ouverts: ils demandent soit un export, soit du vrai moteur.

**1. LA CLARTE NEGATIVE, calee** (`applyClarity`, canvasUtils.js).

Elle n'avait ete mesuree qu'au POSITIF le 2026-08-16. Le negatif gardait le
dosage lineaire d'origine, `amount = clarity / 100`, qui donne a -100 exactement
l'image floue: `pixel + (pixel - flou) x (-1) = flou`. Le curseur ne dosait pas
un adoucissement, il effacait le detail.

  curseur | Lightroom (8/24/64 px)      | nous AVANT | nous APRES
    -50   | 0,695 / 0,699 / 0,723       |   0,502    | 0,707 / 0,706 / 0,706
   -100   | 0,476 / 0,485 / 0,526       |   0,012    | 0,494 / 0,494 / 0,494

Loi retenue: `CLARITY_K_NEG = 0,014088`, `CLARITY_EXPOSANT_NEG = 0,7769`, soit
`0,01409 x N^0,777`. Le sien SATURE, comme sa texture negative (N^0,733) et
comme sa nettete (N^0,766) — c'est la troisieme fois que la loi est une puissance
et pas un facteur.

RESIDU, et il est plus gros que celui de la texture negative: 5 % d'ecart entre
le 8 px et le 64 px chez LUI (la texture tenait dans 0,5 %). Son adoucissement
mord moins sur le tres large; notre masque flou a UN SEUL rayon est plat au-dessus
de son rayon. Cale sur la moyenne des trois reseaux: +1,7 % / -2,4 % a -50,
+3,8 % / -6,1 % a -100. Un second rayon (comme la texture en a un) corrigerait
ca mais remettrait en cause le POSITIF, lui valide a 1 % — controle refait apres
la correction: 1,496 / 1,498 / 1,500, inchange.

CONSEQUENCES SUR CE QUI ETAIT DEJA ECRIT (la regle « toute valeur ecrite est a
convertir quand une echelle bouge »): les deux ambiances a clarte negative sont
converties pour rendre PAREIL a l'ecran — « Aube laiteuse » -18 -> -27, « Brume
matin » -6 -> -7 — et `VISION_SAFE_BOUNDS.clarity.min` passe de -25 a **-30**,
symetrique du plafond, parce que le negatif est desormais bien plus doux a
curseur egal (a -25 il n'enleve plus 25 % du detail mais 17 %).

**2. L'IMPORT AVOUE CE QU'IL NE SAIT PAS FAIRE** (`verifierDomaineSpatial`,
xmpPreset.js, affiche par `scripts/import-lightroom-preset.mjs`).

`toSpatialFilters` jetait DEUX reglages en silence — vignetage positif (il
eclaircit les coins, notre moteur ne sait qu'assombrir) et voile negatif — et en
recopiait trois autres dans des zones ou notre moteur s'ecarte du sien. Le preset
s'installait, la couleur etait juste, et le rendu etait faux sans qu'une ligne le
dise: le seul mode de panne que ce chantier n'a pas le droit de laisser passer.

La fonction ne corrige rien et ne borne rien (c'est `normalizeVisionFilters` qui
borne): elle ECRIT ce qu'un humain doit savoir avant de juger le preset a l'oeil.
Elle lit les valeurs FINALES, pas celles du `.xmp` — un releve passe en ligne de
commande (`--dehaze 40`) prime sur le fichier et compte autant.

**Gates**: `npm run test:vision-preset` passe de 67 a **78 verifications** (sept
sur le domaine de l'import, quatre sur la loi de la clarte negative, lue dans le
moteur pour qu'une regression ne puisse pas passer). Lint, `test:vision-filters`,
`audit:reglages-avances`, `test:reglages-avances` et `test:vibeos-studio` verts.

`npm run build` ECHOUE, et **pas a cause de ce lot**: verifie en remisant toutes
les modifications, il echoue pareil sur `master`. Le code COMPILE (« Compiled
successfully »); c'est la collecte des donnees de page qui casse sur
`/api/catalog/[jobId]`, parce que **`better-sqlite3` a ete compile pour un autre
Node** (NODE_MODULE_VERSION 127 contre 147 attendu par le Node installe). Un
`npm rebuild better-sqlite3` le reglera — non fait ici, `node_modules/` etant
hors perimetre.

## Journal — 2026-08-19 (audit de fiabilite face a Lightroom, avant les imports)

**La question posee**: avant d'importer d'autres presets, est-ce qu'un chiffre
du panneau Effets/Detail de Lightroom fait la MEME chose chez nous ? Tout a ete
**remesure** sur les vrais exports de `~/Desktop/vibefx-lightroom/`, en repassant
les mires dans le VRAI moteur (Chromium, `renderStudio`) — sans faire confiance
aux nombres deja ecrits dans les docs. Controle d'instrument: l'export « sans
rien » de Lightroom est a **0,00/255** de la mire d'origine.

**Confirme fiable** (chaque cote compare a SA propre reference):

- **Grain** 15/50/100: x1,00 sur gris, peau, ciel, feuillage, beton.
- **Vignetage** -50/-100: 2,45 et 2,62 /255 de moyenne.
- **Texture** +50/+100 et -50/-100: ecart <= 1,3 % sur les trois echelles.
- **Clarte positive** +50: <= 1 % ; +100: +4 a 5 %.
- **Nettete 40** (la valeur que Lightroom pose par defaut): +5,3 % sur le fin.
- **Couleur** sur vraie photo, `cn17`: **1,95/255**, 85,6 % de l'effet.

**CINQ TROUS, dont un jamais vu**:

1. **La clarte NEGATIVE est fausse.** Elle n'avait ete calee QUE du cote positif.
   `applyClarity` melange lineairement (`amount = clarity / 100`), donc a -100 le
   resultat EST l'image floue: amplification **0,012 contre 0,476** chez lui. A
   -50: 0,502 contre 0,700 — 1,66x trop adouci. A -25 (plafond du panneau):
   0,750. Le sien SATURE, exactement comme sa texture negative, calibree elle en
   N^0,733 le 2026-08-17. Atteignable par l'utilisateur (mode creatif) et
   recopiee telle quelle par l'import d'un `.xmp`.
2. **Le voile n'est pas calibre** — chiffre pour la premiere fois: 11,76/255
   d'ecart moyen a 50 (p90 29), force 33,2 contre 28,2 (+18 %), et sa loi n'est
   pas lineaire (28,2 a 50, 71,3 a 100). Notre plafond libre est 50, le sien 100.
3. **Nos effets de matiere halonnent les aretes franches** — connu pour la
   texture, **jamais releve pour la clarte**: sur les barres a fort contraste, il
   fait 1,014 a +50 et nous 1,143.
4. **L'import jette en silence** le vignetage positif et le voile negatif
   (`toSpatialFilters`), et recopie une clarte negative dans un moteur qui la
   sur-applique. Rien ne s'affiche a l'ecran au moment de l'import.
5. **Nettete >= 80**: sur les larges structures il raidit x1,58 a 150, nous
   x1,00. Sans importance a 40.

**Ce que l'audit N'A PAS trouve**: aucune regression. Les deux bancs d'essai des
reglages (`audit:reglages-avances`, `test:reglages-avances`) sont verts — les 31
reglages du moteur et les 17 du panneau bougent bien des pixels. « Ca marche » et
« ca fait la meme chose que Lightroom » sont deux questions differentes: la
premiere etait deja reglee le 2026-08-17, la seconde est ce lot.

**Verdict pour les imports**: un preset dont les panneaux Effets et Detail ne
portent que grain, vignetage negatif, texture (deux sens), clarte POSITIVE et
nettete <= 60 s'importe des maintenant. Les autres demandent d'abord le calage de
la clarte negative (une demi-journee: exports et methode existent) et
l'avertissement a l'import.

Ecrit dans **docs/lightroom/5-audit-fiabilite-2026-08-19.md** (avec les commandes
pour rejouer l'audit) ; `todo.md` porte la liste ordonnee de ce qui reste.

## Journal — 2026-08-17 (audit des reglages avances : ce qui marche, et trois pannes)

Objectif: avant d'importer de nouveaux presets Lightroom, verifier que CHAQUE
reglage avance fait vraiment quelque chose sur une image. Le doute etait fonde —
« la luminosite ne marche pas » avait ete observe a l'usage.

**Deux instruments neufs, et ils ne posent pas la meme question.**

- `scripts/audit-reglages-avances.mjs` (`npm run audit:reglages-avances`) :
  appelle `renderStudio` dans un Chromium sur une mire batie pour l'occasion, et
  mesure les 31 reglages supportes a 2 a 5 valeurs chacun, garde-fous actifs et
  coupes. Question: **le moteur sait-il faire ce reglage.**
- `scripts/smoke-reglages-avances.spec.cjs` (`npm run test:reglages-avances`) :
  saisit les VRAIS curseurs de `/creer/vision` et `/creer/studio` et relit le
  canvas de la page. Question: **quand je pousse ce curseur, l'image change-t-elle.**

**Resultat du moteur: les 17 reglages du panneau Vision marchent tous**, du plus
gros (relief -30: 8,4/255) au plus discret (tons chauds: 1,2/255 mais 35 % du
cadre touche). Aucun mort. Ce qui a casse, c'etait ailleurs.

**Panne 1 — la moitie de la course des curseurs de Studio ne faisait RIEN.**
`/creer/studio` ecrivait ses propres bornes, plus larges que celles du moteur.
Mesure par l'interface, image poussee a fond:

| curseur | course affichee | retenu par le moteur | image a fond |
|---|---|---|---|
| Luminosité | 60 – 140 | 85 – 115 | identique a 85 |
| Sépia | 0 – 100 | 0 – 12 | identique a 12 |
| Flou | 0 – 10 | 0 – 2 | identique a 2 |
| Grain | 0 – 100 | 0 – 40 | identique a 40 |
| Vignettage | 0 – 100 | 0 – 30 | identique a 30 |

Le nombre affiche mentait, et **« la luminosite ne marche pas » etait une
observation juste**: on la poussait de 100 vers 140 et rien ne se passait
au-dela de 115. Le meme bug avait ete corrige sur Vision le 2026-08-12; Studio
etait reste en arriere. Corrige de la seule facon qui empeche la rechute: les
huit bornes qui vivaient EN DUR dans `normalizeVisionFilters` (sepia, blur,
hueRotate, fadedBlacks, halation, et les trois teintes) rejoignent
`VISION_SAFE_BOUNDS` / `VISION_FREE_BOUNDS`, valeurs inchangees, et le panneau
Studio les LIT via `visionBoundsFor` — en suivant le mode creatif, qui ouvre la
course en meme temps qu'il coupe les garde-fous.

**Panne 2 — l'image SAUTAIT au premier cran d'un reglage de couleur.**
`fitRgbToGamut` comparait la place disponible au plus grand ecart en valeur
absolue, et exigeait qu'il tienne des DEUX cotes: une couleur parfaitement
valide se faisait desaturer sans qu'aucun canal ne deborde. Sur un neon jaune
`#fff05a`, R tombait de 255 a 229 alors que rien ne debordait. Et comme cet
etage ne tourne que si un reglage de couleur n'est pas au repos
(`applyFusedPixelOps` sort avant, sinon), mettre **« Ciel » a 1** — un geste que
personne ne compte comme un reglage — deplacait **2,6 % de l'image, jusqu'a
45/255**, sans rapport avec le ciel. Mesure apres correction (regle par canal,
chacun n'a besoin que de SA marge): **0,00/255, 0,0 % de l'image**. Et les
valeurs progressent enfin (0,22 a +12, 0,44 a +25) au lieu d'etre noyees sous ce
socle.

**Panne 3 — une fausse panne, et c'est l'instrument qui se trompait.** La
halation a d'abord ete declaree morte (0,00 a 0,07/255 de moyenne). Deux erreurs
de mesure, pas une:

1. **La mire n'avait pas de neon.** `getSafeHalationWeight` eteint volontairement
   le halo sur un blanc speculaire NEUTRE — il tombe a 0,014 sur du blanc pur,
   et c'est ce qui evite les aureoles sur les nuages. Ce qu'il vise, c'est une
   haute lumiere COLOREE. Mire corrigee des deux cotes (neon jaune, neon cyan).
2. **Juger un effet local a sa moyenne.** Un halo pese 0,13/255 sur l'image
   entiere et se voit tres bien: 26/255 sur 20 % du cadre. Les deux instruments
   ont donc desormais le meme verdict a deux criteres — moyenne OU ecart franc
   sur une part du cadre. Sans ca on « reparait » un reglage qui marche.

**Un bug attrape dans l'instrument lui-meme**, et il vaut d'etre note: le smoke
parcourait les curseurs par leur RANG. Or le panneau Vision remonte en tete ce
qui n'est plus au repos: bouger le premier curseur deplace les suivants, et on
lisait les bornes d'un curseur pour ecrire dans un autre. Symptome unique, un
« Malformed value ». Les curseurs sont maintenant designes par leur label. Idem
pour `curseur.max` (la borne) qui ecrasait `ecartMax` (la mesure) a l'affichage
comme dans le verdict — un halo « max 32 » etait en fait la position du curseur.

**Gates**: `lint` (0 erreur, 5 warnings preexistants), `build`, `test:scope`,
`test:vision-preset` (67), `test:vision-filters`, `test:vibeos-vision`,
`test:vibeos-studio`, `test:vibeos-pipeline`, et les deux nouveaux verts.

## Journal — 2026-08-16 (synchro Lightroom, fin : texture, nettete 40, revalidations)

- **`powlisher-showcase` REVALIDE A L'OEIL**, ce qui bloquait la cloture du lot.
  Quatre photos Unsplash peu retouchees, passees dans le VRAI moteur (nouvel
  outil `scripts/planche-showcase.mjs`). Grain 8 et relief 14 gardes tels quels;
  **vignetage 3 -> 8**. Le 3 reproduisait fidelement un reglage CASSE: il
  n'assombrissait le coin que de 8/255 sur la seule photo a fond clair, et de
  rien du tout ailleurs. A 8 il en retire 15/255. Choix d'oeil de Matthis, sur
  planche.
- **Un coin deja noir reste a 0,00**, quel que soit le vignetage: il MULTIPLIE
  la lumiere, il n'a rien a retirer d'un noir. C'est pour ca que trois des
  quatre photos ne bougent presque pas.
- **`cn17` VALIDE SUR UNE VRAIE PHOTO** (plage, ciel, mer, roche, ecume,
  5392x3032), developpee des deux cotes, grain eteint des deux cotes — deux
  bruits aleatoires differents ne se comparent pas pixel a pixel. **Ecart moyen
  1,73/255**, mediane 1, 99e centile 10: identique a l'oeil.
- **Et la planche a trouve ce que la moyenne cachait.** `compare-preset-vs-lightroom.mjs`
  gagne `--planche`: elle sort les trois images plus la CARTE DES ECARTS (x8) et
  la zone du PIRE ecart a 1:1. Cette carte ne montrait ni zone ni bande mais
  **les contours de la roche** — signature d'une difference de NETTETE, pas de
  couleur. Mesure sur cette zone: luminance moyenne identique (132,84 contre
  132,81), mais **x1,40 d'energie de contours chez lui**.
- **NETTETE 40 AJOUTEE A `cn11` ET `cn17`.** C'est le defaut de Lightroom,
  present avec ou sans preset — mais notre moteur n'a AUCUNE nettete de base, si
  bien que le meme preset rendait plus mou chez nous. En rejouant la notre sur
  la meme zone: x1,083 a 25, **x0,986 a 40**, x0,890 a 60. Notre loi, calibree
  sur la mire C, tombe donc a 1,4 % de la sienne sur une photo reelle.
- **Piege d'import trouve en route, et documente**: reimporter un preset sans le
  bon `--lisser` REECRIT SA LUT en silence. `cn17` exige `--lisser 1` (capturee
  avec son grain 15, donc bruitee), `cn11` exige de ne PAS lisser. Les deux
  commandes exactes sont dans `docs/lightroom/1-procedure.md`, avec le controle
  qui va avec: apres reimport, `LUT_BASE64` ne doit pas apparaitre dans le diff.
- **TEXTURE BRANCHEE** — nouvel etage `applyTexture` (canvasUtils.js), etage
  4 bis de studioRenderer.js, entre la clarte (large) et la nettete (fine).
  Le reglage n'existait pas: un preset qui en portait rendait moins de matiere,
  sans que rien ne le signale. Resultat mesure, nous / Lightroom:
  a +50 **1,176 / 1,175**, **1,120 / 1,120**, **1,096 / 1,096** (8, 24, 64 px);
  a +100 1,283 / 1,272, 1,183 / 1,187, 1,146 / 1,150.
- **Ce que sa texture est vraiment.** Son exces d'amplification decroit LENTEMENT
  avec l'echelle (~P^-0,34): un masque flou a un seul rayon ne peut pas faire ca,
  il laisserait passer 8 et 24 px a l'identique puis s'effondrerait. D'ou DEUX
  rayons, 3 px et 40 px, a gain egal. Et son dosage SATURE comme celui de la
  nettete: doubler le curseur ne donne que x1,56, soit N^0,644.
- **Texture NEGATIVE non implementee, volontairement.** Ses exports -50 et -100
  manquent toujours: les fichiers presents sont le positif exporte deux fois
  (revérifie — memes 1,175/1,120/1,096). Borne basse a 0, et l'import REFUSE un
  `--texture` negatif plutot que de le clamper en silence.
- **Deux instruments symetriques**, la ou tout etait fait a la main:
  `scripts/mesure-mire-c.mjs` (son export) et `scripts/rendu-mire-c.mjs` (notre
  moteur, dans un Chromium).
- **Une mesure fausse corrigee au passage.** La raideur du bord doux se lisait
  comme un maximum de difference pixel a pixel, donc comme un maximum de BRUIT:
  2,00 sur la mire de reference la ou la transition n'en vaut que 1,26. Elle
  faisait croire que sa texture raidissait le bord doux de x1,17; sur profil
  lisse, c'est x1,03 (et x1,07 chez nous).
- **`xmpPreset.js` ne convertit plus rien.** Il appliquait encore clarte x0,3,
  nettete x0,35, grain x0,42, vignetage x0,5 — des facteurs d'un moteur dont les
  echelles n'avaient rien a voir avec celles de Lightroom. Nos echelles SONT les
  siennes depuis les 15 et 16 aout: le nombre se recopie tel quel. La texture y
  a aussi sa propre cle, au lieu d'etre melangee a la clarte.
- **Cablage complet de `texture`**: cle supportee et bornes (`visionColorScience.js`,
  sure 0-50, libre 0-100), defaut (`useStudioFilters.js`), curseur du panneau
  (`VisionScreen.jsx`), cles spatiales d'un preset (`useVisionEditor.js`), et
  `--texture` a l'import.
- **Gates**: lint (0 erreur, 5 warnings preexistants), build, test:vision-preset
  (67), test:vision-filters, test:vibeos-vision — tous verts.

## Journal — 2026-08-16 (synchro Lightroom : vignetage, nettete, clarte)

- **VIGNETAGE ALIGNE.** Nouvel etage `applyLightroomVignette` (canvasUtils.js),
  qui remplace le degrade radial multiplie en sRVB de l'etage 7 de
  studioRenderer.js. Ecart final: **2,4/255** en moyenne.
- **Ce que la mire B a tranche, et pourquoi elle avait trois bandes.** A rayon
  egal sous Vignette -100, les trois bandes donnent trois ratios DIFFERENTS en
  sRVB (0,291 / 0,351 / 0,430) et le MEME en LINEAIRE (0,123 / 0,121 / 0,162).
  Un vignetage, c'est de la lumiere qui manque, et la lumiere s'additionne en
  lineaire. Une seule bande de gris n'aurait jamais pu le montrer.
- Trois autres faits mesures: le rayon est **elliptique** (normalise par la
  demi-largeur et la demi-hauteur, donc il suit le cadre — le notre dessinait un
  cercle dans un rectangle); le dosage agit comme un **exposant** et non comme un
  facteur (ln(gain -50)/ln(gain -100) = 0,57, constant sur tout le rayon); et il
  **protege les hautes lumieres** (la bande claire est assombrie ~30 % de moins
  que la loi ne le voudrait, curseur « Hautes lumieres » a 0). Ce dernier terme
  fait tomber l'ecart de la bande claire de 11,7 a 4,2/255.
- **NOTRE VIGNETAGE NE FAISAIT PRESQUE RIEN**: mesure, `vignette: 22`
  assombrissait l'image de 3,3/255 en moyenne, parce que son degrade circulaire
  n'atteignait sa pleine force qu'AU-DELA du cadre. Toutes les valeurs
  existantes sont converties dans ce rapport (5->1, 20->2, 30->4, 60->9);
  `powlisher-showcase` passe de 22 a **3**. A REGARDER: maintenant que le
  vignetage fonctionne, il vaut peut-etre la peine de le monter — choix d'oeil.
- **CLARTE: le dosage etait deja juste, le RAYON etait 4x trop petit.** Sur les
  reseaux sinusoidaux, Clarte 50 donne 1,49-1,54 chez lui et 1,50 chez nous;
  Clarte 100, 1,91-2,00 contre 2,00. Mais sur le bord doux de 120 px — la seule
  zone qui teste les GRANDES structures, celles que la clarte est censee creuser
  — il amplifie x1,79 et nous ne faisions **x1,03**. Rayon porte de 2,5 % a 11 %
  du petit cote. La cible n'est pas atteinte (x1,40) et c'est un defaut de la
  MIRE: au-dela, le flou deborde sur les zones voisines et la mesure lit ses
  propres bords.
- **NETTETE: notre reponse etait trop forte, et de plus en plus haut.** Sur le
  reseau de 8 px: 1,22 chez lui contre 1,29 chez nous a 40, mais 1,63 contre
  **2,13** a 150 — son curseur SATURE, le notre etait lineaire. Dosage passe en
  loi de puissance (0,035 x N^0,766, qui passe par les deux points mesures),
  echelle portee a 0-150 comme la sienne, dont le **40 par defaut**. Le rayon,
  lui, etait bon: la selectivite en frequence se superposait deja (1,12 contre
  1,15 a 24 px, 1,02 contre 1,01 a 64 px).
- **Bornes**: vignette 30 (sur) / 100 (libre), nettete 60 / 150, clarte
  inchangee en sur et +-100 en libre — les maximums de Lightroom, pour qu'aucune
  valeur d'un preset importe ne soit hors de portee.
- **TEXTURE, pas finie**: les 4 exports fournis sont en fait 2 (les fichiers
  « plus » et « moins » sont identiques PIXEL POUR PIXEL — le positif a ete
  exporte deux fois). Le positif est mesure (x1,17 a 8 px, x1,12 a 24, x1,10 a
  64 pour +50: plus fin et plus doux que la clarte), il manque les negatifs, et
  notre moteur n'a de toute facon aucun reglage Texture.
- **VOILE, mesure mais PAS CAPTURABLE par une mire**: c'est une expansion de
  contraste et de saturation ancree sur le point clair (192 -> 187 -> 182 quand
  148 -> 110 -> 53), et Lightroom l'estime A PARTIR DU CONTENU de l'image. Sur
  une mire quasi uniforme on ne capture que la part globale. A traiter comme un
  cas a part.
- **Sous-reglages releves et NON branches**: Grain (Taille 25, Cassure 50),
  Vignette (Milieu 50, Arrondi 0, Contour 50, Hautes lumieres 0). Tout est donc
  calibre POUR CES DEFAUTS; un preset qui les change ne sera pas reproduit.
- Gates: lint (0 erreur, 5 warnings preexistants), test:vision-preset (67),
  test:vision-filters — verts.

## Journal — 2026-08-15 (synchro Lightroom, etape 2 : le grain est ALIGNE)

- **« Grain 15 » veut maintenant dire la meme chose des deux cotes.** Mesure sur
  la mire A (24 aplats unis), trois valeurs de curseur exportees de Lightroom
  par le porteur du projet (15, 50, 100). Apres correction, notre moteur donne
  **x1,00 a x1,01** sur tous les gris, les peaux, le ciel, le feuillage et le
  beton, aux trois valeurs.
- **LE « x8 » ANNONCE ETAIT FAUX, et le doute du porteur du projet etait
  justifie.** Il avait ete mesure sur la mire HALD, dont les pastilles font 4x4
  px de couleurs sans rapport: la bavure entre voisins y etait comptee comme du
  grain. Deux erreurs dans le meme sens — Lightroom gonfle (6,27 au lieu de
  5,52) et nous ecrase (0,8 au lieu de 2,07). Vrai rapport: **x2,66**. Regle qui
  en sort: **ne jamais mesurer un effet spatial sur la mire Hald**, c'est
  precisement ce qu'elle ne peut pas voir.
- **Le facteur d'echelle n'etait que la moitie visible du probleme.** Le grain de
  Lightroom est **PLAT** du noir au blanc (5,52 partout). Le notre etait une
  **CLOCHE**: 2,07 au ton moyen, 0,45 dans les ombres, 0,57 dans les hautes
  lumieres — parce que la fusion `overlay` n'a plus d'effet quand le pixel
  approche 0 ou 255. Notre grain disparaissait donc exactement la ou un grain de
  film se voit: les ciels et les ombres lisses. Lecon pour les reglages suivants:
  **chercher la loi, pas un coefficient**.
- **Ce que la mesure a etabli** : son curseur est une DROITE (ecart-type = 0,367
  x valeur, verifie a 15/50/100); son grain est MONOCHROME (correlation 1,00
  entre canaux); il s'ETEINT aux deux bouts (x0,67 aux niveaux 8 et 247) et ce
  n'est PAS de l'ecretage — une gaussienne d'ecart-type 5,5 sur un niveau 8
  coupee a 0 rendrait 5,20, on mesure 3,48.
- **Nouvel etage `applyFilmGrain`** (`canvasUtils.js`), qui remplace la fusion
  `overlay` de l'etage 8 de `studioRenderer.js`: bruit gaussien monochrome
  ADDITIF d'ecart-type `GRAIN_SIGMA_PAR_UNITE x valeur`, attenue pres du noir et
  du blanc. `NOISE_PATTERN_CANVAS` reste exporte: les deux `layoutRenderer`
  l'utilisent pour la texture de FOND, qui n'a rien a voir.
- **Valeurs converties, parce que l'echelle a change sous elles** : `cn17` recoit
  enfin son `grain: 15` (table de couleurs bit-a-bit identique, seul
  `spatialFilters` bouge); `powlisher-showcase` passe de 20 a **8** (meme force
  au ton moyen: 2,76 contre 2,94) — **a revalider a l'oeil**, car le rendu n'est
  pas identique: le grain apparait maintenant dans les ciels et les ombres
  lisses; les 57 profils de `constants.jsx` et les 4 ambiances de
  `ambianceCatalog.js` divises par 2,663; bornes du grain a 40 (sur) et 100
  (libre, le maximum de Lightroom, pour qu'aucune valeur importee ne soit hors
  de portee).
- **`import-lightroom-preset.mjs` accepte `--grain`, `--vignette`, `--clarity`,
  `--sharpness`, `--dehaze`** — les reglages releves A LA MAIN dans les panneaux
  Effets et Detail, seule source possible pour les presets Premium d'Adobe, qui
  ne s'exportent pas en `.xmp`. Ils priment sur le `.xmp`: on a regarde l'ecran.
- **Garde-fou** : `audit-vision-filters.mjs` exige desormais
  `GRAIN_SIGMA_PAR_UNITE = 0.367` et `applyFilmGrain`. Un retour a la fusion
  `overlay` ferait cesser silencieusement l'alignement, et aucun test ne serait
  tombe.
- **Reserve honnete** : sur des primaires tres saturees, Lightroom donne 1,1 a
  1,4x le plat, inegalement entre canaux — signe qu'il ajoute son bruit avant une
  transformation d'espace, pas en sortie. Non reproduit. Sur les neutres, les
  peaux, les ciels et les betons — la matiere ou un grain se juge — l'ecart est
  nul. Et seuls les niveaux 8 et 24 contraignent la courbe d'extinction: sa forme
  ENTRE les deux est une interpolation, pas une mesure.
- Gates: `npm run lint` (0 erreur, 5 warnings preexistants), `npm run build`,
  `test:vision-preset` (67), `test:vision-filters` — tous verts.

## Journal — 2026-08-15 (synchro Lightroom, etape 1 : les mires d'effets)

- **`scripts/make-mire-effets.mjs` + `npm run preset:mire-effets`**, et
  `docs/lightroom/4-synchro-effets.md` (le protocole). Premiere etape du lot
  « synchroniser nos reglages avances avec Lightroom », qui passe AVANT tout
  nouvel import de preset : nos chiffres ne veulent pas dire les siens. Mesure
  qui declenche le lot : le Grain 15 de Lightroom vaut **6,27/255** d'ecart-type,
  notre Grain 15 vaut **0,8**, et notre curseur **a fond** (42) ne monte qu'a
  **2,84** — recopier « 15 » chez nous donne un grain invisible.
- **Quatre mires et pas une**, parce que chaque effet a besoin d'un fond qui le
  rend lisible et que ces fonds s'excluent : le grain ne se lit que sur un aplat
  parfaitement uni, le vignetage que sur une image pleine et unie (sinon on ne
  sait pas si un pixel est sombre a cause du coin ou du motif), la
  clarte/texture/nettete que sur des BORDS, le voile que sur une image deja
  delavee.
- **Les reseaux sinusoidaux de la mire C (periodes 8, 24, 64 px)** ne sont pas
  un ornement : une barre nette contient TOUTES les frequences a la fois, donc
  elle confondrait nettete (rayon ~1 px), texture (quelques px) et clarte
  (dizaines de px) — qui sont le meme geste a trois echelles. Un sinus n'en
  contient qu'une : l'amplification lue est celle de cette echelle-la.
- **1620x1080 et jamais redimensionne** : le grain et la nettete dependent de la
  resolution (reduire une image MOYENNE son grain), donc on etalonne a la taille
  ou l'on publie.
- **Bloque cote Lightroom** : l'agent ne peut pas piloter Lightroom. Dossiers
  d'export prets sur le bureau (`~/Desktop/vibefx-lightroom/`), un dossier par
  valeur de curseur pour que le nom de fichier n'ait pas d'importance. Lot 1 =
  grain + vignetage (10 exports), lot 2 = nettete/clarte/texture/voile (16).
  Sous-reglages caches a relever en capture d'ecran : Grain (Taille, Rugosite)
  et Vignette (Milieu, Rondeur, Contour, Hautes lumieres), plus ceux de CN17.

## Journal — 2026-08-12 (lot N — `powlisher-showcase`, et trois bugs d'interface)

- **`powlisher-showcase`, le clair-obscur de ses photos de voiture.** Mesure sur
  img05/06/07: 48 a 69 % des pixels sous 40/255, le 1 % le plus clair plafonne a
  183/170/137 (jamais pres du blanc), et surtout la voiture est LA SEULE CHOSE
  COLOREE — chroma sujet 0,69/1,00/0,76 contre 0,33/0,47/0,20 pour le decor, soit
  un ecart de x2,1 a x3,8. Le tout en chaud sur chaud (sujet 31-37°, decor
  34-60°), sans aucun contraste froid.

- **Le mecanisme: un CREUX de saturation.** On vide ce qui est moyennement
  colore (le decor: beton, tole, asphalte, herbe seche) et on laisse intact ce
  qui l'est deja beaucoup (le sujet). Une LUT sait le faire parce qu'elle lit la
  saturation du pixel lui-meme. Resultat mesure sur une photo a nous: ecart
  sujet/decor x1,7 avant, x3,5 apres, et le 1 % le plus clair passe de 208 a 161.

- **Ce que ce preset ne peut PAS faire, et c'est ecrit dans son en-tete.** La
  lumiere — voiture au soleil devant un hangar noir — est le lieu, l'heure et
  l'angle, pas la couleur. Sur notre photo de plein midi, la part de pixels
  sombres monte de 3 a 8 % la ou ses photos a lui sont a 48-69 %: le preset
  assombrit, il ne rembobine pas la prise de vue. Et la regle se declenche sur la
  SATURATION, pas sur le sujet: sur une photo ou le ciel est l'element le plus
  sature, c'est lui qui recoit le projecteur. Preset de SITUATION, pas look
  universel.

- **Deux corrections nees de l'oeil et du test, pas du plan.** Le premier jet
  peignait le ciel en KAKI (le melange vers l'ocre attrapait le bleu): l'ocre est
  desormais retire dans la bande bleue, le vidage non. Et son smoke a revele que
  le preset heritait du melangeur de V1, donc du ciel a 163° qu'on venait de
  corriger ailleurs — la regle du ciel est maintenant une fonction PARTAGEE
  (`regleDuCiel`), utilisee par `powlisher-ciel` et par lui.

- **Un preset porte desormais ses effets non-LUT, et ca se voit.** Le mecanisme
  existait deja (`spatialFilters`, pour les presets Lightroom importes) mais rien
  ne le montrait. Le showcase pose grain 20, vignetage 22, relief 14; le panneau
  affiche ces trois reglages en couleur d'accent avec une pastille, et le preset
  annonce « Il pose aussi : grain, vignettage, relief ». Le smoke navigateur le
  verifie.

- **BUG CORRIGE — le curseur Grain ne faisait quasiment rien.** Mesure dans
  l'app: a fond (42), il ajoutait un grain d'ecart-type **0,9/255**, la ou les
  photos de reference en portent ~2,5. Deux attenuations se multipliaient: la
  mire de bruit avait un canal alpha tire au hasard entre 0 et 70/255, PUIS le
  rendu la posait avec un `globalAlpha` de grain/100 x 0,5. La mire est
  desormais OPAQUE et le dosage tient en un seul endroit, cale sur la mesure:
  **grain 35 donne 2,39/255**, grain 42 donne 2,84. Piege de mesure a noter: le
  bruit s'ajoute en QUADRATURE au detail propre de la photo, donc l'ecart-type
  du grain seul s'extrait, il ne se lit pas dans la difference brute — la
  premiere lecture avait conclu « 50 fois trop faible » au lieu de « 3 fois ».

- **Et la mesure a ete corrigee par l'oeil sur la valeur du preset.** Le showcase
  visait 35, cale sur le ~2,5/255 mesure chez lui. Mais ce ~2,5 vient de ses
  JPEG publies REDUITS a 900 px, alors que notre grain est pose a la resolution
  de la photo — reduire une image MOYENNE son grain, les deux chiffres ne sont
  donc pas comparables directement, et la cible etait trop haute. A l'ecran, 35
  passe sur une photo de voiture (le cadre est plein de matiere qui le masque)
  et se voit trop sur un paysage (un grand ciel lisse ne masque rien). Retenu:
  **20** (1,05/255), teste sur une Lamborghini Unsplash sous structure beton,
  atmosphere proche de ses trois photos. Le curseur reste offert, en tete du
  panneau et en couleur d'accent.

- **BUG CORRIGE — « Relief » et « Grain » semblaient morts pendant le geste.**
  C'etait une consequence du correctif de latence: la qualite 'low' saute
  justement les operations qui lisent les pixels voisins (relief, nettete,
  voile, grain), et « Vignettage », qui n'a pas de garde de qualite, reagissait
  seul — d'ou l'impression que deux curseurs sur trois ne servaient a rien. Dans
  Vision, le geste porte precisement sur ces reglages: on y garde donc 'high',
  et la fluidite vient de la resolution divisee par deux. Layout, ou l'on fait
  glisser une image, garde 'low'. Mesures apres correction: relief 14 = +10 % de
  contraste local, relief 30 = +22 %.

- **BUG CORRIGE — le curseur recentre avait une ZONE MORTE.** La premiere
  version convertissait position <-> valeur; quand les deux cotes n'ont pas le
  meme nombre de crans, deux positions voisines retombent sur la meme valeur et
  l'arrondi renvoie la pastille en arriere: « Relief » refusait de descendre
  sous -2. Le champ reste desormais un curseur natif de bout en bout, avec une
  course ELARGIE symetriquement autour du repos et la valeur bornee a la sortie.
  Un cran de fleche = un cran de reglage, aucune conversion, donc aucune zone
  morte possible.

- **Les reglages pilotes par un preset restent EN HAUT tant que le preset est
  actif**, meme ramenes au repos. Sinon le grain remis a 0 redescendait dans son
  groupe et remontait des qu'on y retouchait: le panneau sautait sous la main au
  moment precis ou l'on reglait.

- **BUG CORRIGE — les curseurs a zero n'etaient pas alignes.** Les bornes ne sont
  pas symetriques (contraste 80..125 autour de 100, ombres -35..+45 autour de 0),
  et un `input[type=range]` place sa pastille a (valeur - min) / (max - min):
  deux reglages tous les deux au repos tombaient donc a des hauteurs
  differentes. Le `Slider` coupe maintenant la course en deux moities EGALES
  autour du repos. Les reglages additifs (grain, nettete, voile: leur repos EST
  le minimum) restent a gauche — c'est correct, et ca les distingue d'un coup
  d'oeil.

- **BUG CORRIGE — un tiers de la course ne faisait rien.** L'interface declarait
  ses propres bornes, plus larges que celles que le moteur applique: on poussait
  « Contraste » jusqu'a 180 alors que `normalizeVisionFilters` ramenait a 125,
  sans que rien ne l'indique. Les bornes vivent desormais en UN endroit
  (`VISION_SAFE_BOUNDS` / `VISION_FREE_BOUNDS`), le moteur les applique et
  l'interface les lit — et elles changent quand on coupe les garde-fous.

- **LATENCE CORRIGEE — l'apercu calculait 4 fois trop de pixels.** Vision passait
  `isDragging: false` en dur: le rendu restait donc en qualite 'high' et en
  pleine resolution (1,9 Mpx pour une photo de telephone) A CHAQUE cran de
  curseur, pour un apercu affiche sur ~550 px. Pendant le geste, la resolution
  est divisee par deux et la qualite passe en 'low' (qui saute relief, nettete,
  voile et grain — les operations qui lisent les pixels voisins), avec retour en
  pleine qualite des que le doigt se leve. Deux details qui comptent: la taille
  AFFICHEE est figee pendant le geste, sinon l'apercu retrecirait a l'ecran; et
  `canvas.width` n'est reaffecte que s'il change vraiment, au lieu d'une realloc
  par frame. L'export n'est pas concerne (canvas separe, toujours 'high').

- **VALIDE A L'OEIL le 2026-08-12**, teste par le porteur du projet sur des
  photos Unsplash (voiture orange en ville). `powlisher-showcase` rejoint donc
  la liste des presets qui NE SE SUPPRIMENT PAS.

- **Nouveau document `docs/presets-valides.md`**, et c'est le point d'autorite:
  la liste des presets valides a l'oeil, la regle (un variant s'AJOUTE, il ne
  remplace jamais) et ce qu'un preset doit passer pour y entrer. Lie depuis
  `AGENTS.md`, `todo.md` et l'en-tete de chaque preset concerne.

- **Les reglages modifies remontent EN TETE du panneau**, dans une section
  « Modifiés » avec un compteur, avant « Lumière ». Sans ca, il faut parcourir
  seize curseurs pour voir les trois qu'un preset vient de poser. Detail qui
  compte: l'ordre est GELE pendant qu'on tient un curseur (on classe d'apres
  l'etat au debut du geste), sinon celui qu'on bouge sauterait en haut au
  premier cran, sous le doigt, et le geste serait coupe net.

- **Nouvel outil `scripts/planche-presets.mjs`** : toutes les photos passees
  dans tous les presets, cote a cote, dans un seul PNG. Il repond a la seule
  question qu'aucune mesure ne couvre — « est-ce que ca a l'air bien ? » — et
  qui a fait supprimer trois presets. Il documente aussi OU trouver des photos
  de test: **Unsplash**, parce qu'elles sont PEU RETOUCHEES. Les photos du
  corpus `@powl_d` sont deja ses edits finis: les repasser dans un preset etale
  deux fois le meme traitement et fausse le jugement.

- **Ce qu'un preset Lightroom cache en plus de sa couleur, et c'est le cahier
  des charges du lot suivant.** Constate dans Lightroom sur le pack « Cinema
  II »: **CN11 ne pose aucun effet, CN17 pose un Grain 15**, et la Nettete reste
  a 40 sur les deux (defaut de Lightroom, pas du preset). D'autres familles
  bougent la texture, la clarte ou le noir et blanc.

  Une Hald CLUT ne voit rien de tout ca — pire, **le grain POURRIT la capture**:
  il bruite chaque pastille de la mire, donc la table mesuree devient fausse
  (c'est ce que detecte la « rugosite » du rapport d'import). La bonne methode
  est donc: relever les panneaux **Effets** et **Detail**, remettre le grain a 0
  dans Lightroom AVANT d'exporter la mire, puis redeclarer les valeurs en
  `spatialFilters`. Le tableau des reglages a relever est inscrit dans
  `docs/lightroom/1-procedure.md`, etape 1 bis.

  Et deux limites a connaitre: **Lightroom n'est pas pilotable**, donc l'agent ne
  peut pas lire ces valeurs — il doit LES DEMANDER, c'est une etape du protocole;
  et **les masques** (ciel, sujet, degrades, masques IA) ne sont capturables
  d'AUCUNE facon, puisqu'ils dependent du contenu de la photo. Si le panneau
  Masquage n'est pas vide, la capture est fausse sans le signaler.

- **Gates** : `lint` (0 erreur, 5 warnings preexistants), `build`,
  `test:vision-preset` (**67** verifications), `test:vibeos-vision` (2 tests
  navigateur, qui verifient aussi la section « Modifiés »). `powlisher`,
  `powlisher-ciel`, `cn11` et `cn17` non touches.

## Journal — 2026-08-12 (lot M — `powlisher-ciel`, et la suppression du lot L)

- **Trois presets supprimes** : `powlisher-ville`, `powlisher-v2`,
  `powlisher-v2-dore`. Ils passaient toutes leurs mesures, et ils etaient
  pourtant faux sur les deux plans qui comptent.

- **Leur source etait biaisee.** Ils etaient cales en partie sur la « paire
  avant/apres » du photographe (ex-img47/48), qui a fait passer son image par une
  IA generative avant de la publier. L'ecart entre les deux images n'etait donc
  pas sa colorimetrie, mais sa colorimetrie PLUS ce qu'une IA a invente — du
  spatial, hors de portee de toute table de couleurs. Le signe etait la des le
  depart : +/- 22,3/255 de dispersion en sortie pour une meme couleur d'entree,
  contre 1,9 a 4,8 sur une vraie paire Lightroom. La paire est retiree du README
  du corpus, du script de recuperation et du script de mesure.

- **Ils dessinaient un trait dans le ciel, et AUCUNE moyenne ne le voyait.**
  Leur regle se declenchait sur la TEINTE d'un pixel sans verifier que cette
  teinte veuille dire quelque chose. Dans un voile quasi blanc, la teinte est du
  bruit : deux pixels identiques a l'oeil peuvent etre a 40 deg l'un de l'autre.
  La regle basculait d'un pixel a l'autre en plein degrade et tracait un contour
  diagonal, parfaitement visible a l'ecran. Nouvelle mesure pour l'attraper :
  l'AMPLIFICATION dans un voile (ecart de sortie / ecart d'entree, sur des pixels
  quasi neutres a teinte bruitee). `powlisher` 3,03x — la version supprimee
  7,32x. Le test est desormais dans `test:vision-preset`, borne au niveau de
  `powlisher` : la regle du ciel n'a pas le droit d'ajouter du contour.

- **`powlisher-ciel`, et le raisonnement qui le fonde.** Ses ciels francs
  atterrissent TOUS entre 190 et 199 deg (six photos), alors que leurs entrees
  n'ont aucune raison d'etre groupees. Entrees dispersees, sorties groupees : ca
  ne decrit pas une rotation, ca decrit une CONVERGENCE. V1 fait l'autre chose —
  un angle fixe (-38 deg au plus fort du melangeur) — donc un ciel deja bleu-cyan
  finit trop loin, dans le menthe.

- **La mesure qui tranche : appliquer le preset a SES PROPRES PHOTOS**, qui sont
  deja ses edits finis, donc deja a la bonne couleur. Un preset juste ne devrait
  presque pas les bouger. V1 leur retire encore 22,6 deg en moyenne (jusqu'a
  -31,1 sur img37) ; `powlisher-ciel`, 5,5 deg. C'est la difference entre placer
  une couleur et la pousser.

- **Sur notre photo temoin** (crique mediterraneenne, ciel d'entree a 214,2 deg,
  chroma 0,58, avec sa version exportee par `powlisher` a cote) : V1 la pose a
  185,7 deg, SOUS sa propre fenetre, dans un menthe qu'il ne produit sur aucune
  de ses photos. `powlisher-ciel` la pose a 195,4 deg, chroma 0,52 — au centre de
  la fenetre, avec le degrade du ciel conserve.

- **Hors du bleu, c'est `powlisher` au bit pres** : feuillage, peau, gris,
  turquoise d'eau peu profonde, rouge sombre, point blanc et noirs — 0,0/255 de
  difference, verifie. Le domaine de la regle commence JUSTE EN DESSOUS de la
  cible (174-192 deg), pour ne pas pousser vers le cyan un turquoise qui y est
  deja.

- **Le corpus est reorganise** : sous-dossier `ciel/` (12, 13, 16, 18, 35, 36,
  37, 39, 46), les photos ou le ciel occupe assez de cadre pour etre mesure. Les
  scripts le regardent en priorite.

- **VALIDE A L'OEIL, et c'est l'etape qui manquait aux trois presets
  supprimes.** Le porteur du projet a compare `powlisher`, `powlisher-ciel` et
  CN17 sur ses propres photos, dans l'app : sur une terrasse en plein soleil,
  `powlisher` tire le ciel vers le menthe, CN17 le pousse vers un azur plus
  sature en rechauffant fort la terre cuite, et `powlisher-ciel` tient le milieu
  — un ciel credible, avec les verts et la terre cuite de `powlisher` intacts.
  Verdict : « un ciel plus naturel sans perdre le reste de powlisher ».
  **CE PRESET NE SE SUPPRIME PAS** (marque aussi dans `visionPresets.js` et
  `todo.md`). Un futur variant du ciel s'AJOUTE, il ne le remplace pas.

- **Gates** : `lint` (0 erreur, 5 warnings preexistants), `build`,
  `test:vision-preset` (**54** verifications, dont les 40 de V1 intactes). Bandes
  au pire 2/255 sur un degrade de ciel, soit invisible. `powlisher` V1, `cn11` et
  `cn17` non touches.

- **Archivage** : les lots H/I/J sortent de `todo.md` vers
  `docs/archive-presets-vision-2026-08-12.md`.

## Journal — 2026-08-11 (lot J — CN11 et CN17 captures sur un VRAI Lightroom)

- **La chaine d'import a enfin tourne pour de vrai.** Jusqu'ici elle n'avait ete
  verifiee qu'en simulation. Lightroom cloud desktop n'etant pas pilotable
  (`NSAppleScriptEnabled = false`, aucun dictionnaire de script, pas de CLI —
  seul Lightroom *Classic* a un SDK), l'aller-retour se fait a la main : l'agent
  genere, mesure et importe, l'utilisateur clique dans Lightroom.

- **Le controle a vide, et il a servi.** Nouveau `scripts/check-hald-control.mjs`
  (`npm run preset:controle`) : la mire neutre reexportee SANS preset doit
  revenir a l'identite. Premier essai refuse — l'export partait en **Adobe RVB**,
  un espace plus large ou les memes chiffres RVB designent d'autres couleurs. La
  table aurait ete fausse d'un bout a l'autre **sans que rien ne le signale**.
  En sRVB : **0,018/255 de moyenne, 2/255 au max**. C'est exactement le role de
  cette etape, et c'est pour ca qu'elle ne se saute pas.

- **LA MIRE ELLE-MEME ETAIT FAUSSE, et c'est la vraie lecon du lot.** Une mire
  Hald naive met UNE couleur par pixel : deux pixels voisins y sont donc deux
  couleurs sans aucun rapport, situation qui n'existe dans aucune photo. Tout
  traitement qui regarde le voisinage fait alors baver les couleurs les unes sur
  les autres. L'erreur est proportionnelle en ABSOLU, pas en relatif : negligeable
  dans les tons clairs, ruineuse dans les noirs ou les valeurs valent 4 ou 8 sur
  255. Mesure sur CN11 : l'entree 26,17,14 ressortait a 5,24,6 — un vert franc —
  la ou Lightroom donne 23,15,14. Sur les photos, volets, ombres et pieds de
  meubles viraient au vert, VISIBLEMENT. Signale par le porteur du projet en
  regardant l'ecran, pas par une metrique. Correction : la mire est desormais en
  BLOCS de 4x4 pixels par couleur (2048x2048, defaut de `preset:mire`), plus un
  profil sRGB explicite qui manquait ; l'import detecte la taille du bloc et ne
  lit que le COEUR de chaque carre (2x2 moyennes, bord ecarte — moyenner divise
  en prime le grain par deux). Resultat sur la meme photo : ecart a Lightroom
  4,53 -> **2,67/255** au pixel, 1,70 -> **0,64/255** sur la couleur seule, et
  8,06 -> **1,32/255** dans les noirs.

- **Deux fausses pistes eliminees avant celle-la, chacune par une mesure** :
  Clarte/Texture (verifie dans Lightroom : tous a 0 dans CN11) et Nettete (la
  passer de 40 a 0 donnait une mire IDENTIQUE au bit pres). Ce qui a tranche :
  verifier que Lightroom appliquait bien une fonction PIXEL PAR PIXEL a la photo
  (sortie stable a +/-1,9/255 pour une meme couleur d'entree). Le preset etait
  donc capturable, et le coupable ne pouvait etre que la mire.

- **Le grain, une fois la mire corrigee.** La rugosite mesuree tombe de 1,66 a
  0,89 pour CN11 (il n'a donc AUCUN grain : c'etait la bavure) et de 15,60 a 4,70
  pour CN17 (lui en a vraiment). `measureHaldRoughness` et `smoothHaldCube` dans
  `haldClut.js`, option `--lisser` a l'import, alerte au-dela de 3/255. Le filtre
  est valide par la mire de controle : sur une table DEJA lisse il ne deplace que
  0,05/255. CN17 : 4,70 -> 0,69 avec un passage.

- **La fidelite reelle a Lightroom, mesuree.** Nouveau
  `scripts/compare-preset-vs-lightroom.mjs` : meme photo, developpee des deux
  cotes. CN11 sur une terrasse plein soleil (2252x4000) : **4,53/255 pixel a
  pixel**, mais **1,70/255 en moyennant par blocs 16x16**, c'est-a-dire sur la
  COULEUR seule. Les ~2,8/255 restants sont de la haute frequence (grain,
  clarte, nettete) qu'une table de couleurs ne peut pas porter par construction.
  Piege rencontre : un JPEG de telephone est stocke en paysage avec une balise
  EXIF de rotation que Lightroom ecrit dans les pixels a l'export — sans
  `.rotate()`, les deux images n'ont meme pas les memes dimensions.

- **Le verdict, chiffre — et retracte une fois.** Nouveaux
  `scripts/audit-vision-presets.mjs` (bandes, dominante, couleurs temoins) et
  `scripts/compare-vision-presets-on-photos.mjs` (ecretage, force, derive des
  teintes). Les premieres mesures condamnaient CN17 (« +12,51 % d'ecretage
  ajoute, 19,3 % au total, il detruit les blancs ») : c'etait DOUBLEMENT faux.
  D'une part la metrique additionnait les canaux a 0 et a 255, alors que CN17
  ecrete MOINS les blancs que l'original ; d'autre part ces chiffres etaient
  l'artefact de la mire a un pixel. Correctement capture, CN17 RETIRE 2,69 %
  d'ecretage. Le jugement a l'oeil du porteur du projet — « CN17 est mon prefere,
  je ne vois pas les blancs casses » — etait juste, et les chiffres avaient tort.
  **Regle** : un chiffre d'ecretage ne veut rien dire tant qu'on ne l'a pas
  compare a celui de Lightroom sur la meme photo (22,74 % pour CN11, contre
  24,10 % chez nous). Les trois presets sont bons, a 100 % d'intensite.

- **Bandes : ce qui vient de nous, et ce qui vient d'Adobe.** Pire cas 5/255
  apres lissage pour les deux presets. Verification faite en relisant le
  degrade directement dans la mesure Lightroom 64^3 : elle saute deja de 2,8/255
  (CN11, ciel) et 5,9/255 (CN17, gris). Environ la moitie du residu est donc le
  preset lui-meme, l'autre moitie le prix de la table 33^3. Aucune bande visible
  sur les rendus reels.

- **Erreur de lecture corrigee dans la foulee.** L'audit disait d'abord que CN17
  « detruit les blancs ». Faux : la metrique additionnait les canaux a 0 et a
  255. Separes, CN17 ecrete MOINS les blancs que l'original (1,07 % contre
  2,10 %) ; ce qui etait compte, c'etait du NOIR — le canal bleu ecrase dans les
  tons chauds. Aucun pixel n'est reellement mort (3 canaux a 0 ou 255 : 0,00 %
  partout). L'utilisateur, qui trouvait CN17 tres bien a l'oeil, avait raison.

- **Seconde erreur, corrigee elle aussi : l'intensite.** Constatant l'ecrasement
  du canal bleu dans les ombres, l'intensite par defaut de CN11/CN17 a d'abord
  ete baissee a 85/90 — l'ecretage tombait de 6,93/19,48 % a ~1,3 %. La
  verification manquante l'a invalide : **Lightroom lui-meme ecrete 22,74 %** de
  cette photo sous CN11, contre 24,10 % chez nous. Ces ombres denses sont donc le
  PRESET, pas un defaut de notre moteur, et baisser l'intensite ELOIGNAIT le
  rendu de Lightroom (4,64/255 contre 4,53). Pire, ca change le look d'une facon
  que l'oeil detecte : baisser l'intensite ne reduit pas le contraste, ca melange
  l'image traitee avec l'image d'origine, donc les couleurs du preset se diluent
  dans les couleurs neutres du JPEG — d'ou une impression de couleur delavee,
  tirant vers le vert dans les ombres. Signale par le porteur du projet en
  regardant les rendus, AVANT qu'on ait les chiffres. Remis a 100. **Regle** :
  `recommendedIntensity` d'un preset IMPORTE reste a 100 ; le curseur est un
  choix esthetique offert a l'utilisateur, jamais un correctif technique. Teste
  et ecarte aussi : un garde-fou relevant le pied de courbe avant le preset (meme
  a 6 % il ne descend qu'a 5,6 % et il delave les noirs). Le seul ecart restant
  avec Lightroom est SPATIAL (clarte, texture, nettete, grain, vignetage :
  2,8/255 des 4,53/255), a recuperer via le `.xmp`.

- **Reserve produit maintenue.** Les tables de CN11 et CN17 sont dans le bundle
  sous leurs noms Adobe. Pour tester et calibrer en interne : aucun souci. Avant
  toute mise en ligne publique, il faut trancher — un *look* ne s'approprie pas,
  une bibliotheque de presets sous licence si.

## Journal — 2026-08-08 (VibeOS phase F — bascule : le pipeline, /studio, la suppression)

- **Le trou fonctionnel est bouche : la composition circule.** Jusqu'ici Vision
  et Studio travaillaient sur LA PHOTO du projet, jamais sur le visuel compose
  dans Mise en page — le pipeline du plan §4.3 n'existait que sur le papier. Il
  est maintenant ecrit une fois, dans
  `src/features/vibeos/project/pipeline.js`, dans l'ordre fixe **composition
  Layout -> filtres Vision -> effets Studio -> export**.
- **Comment il circule, concretement.** L'ecran Layout rendait deja sa
  composition en pleine resolution pour fabriquer la vignette de l'accueil : ce
  meme rendu est desormais enregistre dans le projet
  (`project.composition`, un **Blob PNG**, jamais une dataURL). Vision et Studio
  prennent cette composition en entree quand elle existe, et retombent sur la
  photo sinon. Le Studio, lui, recoit la composition **deja passee par l'etage
  Vision** : son image de travail est cuite par `applyVisionStage`, donc ses
  effets s'empilent au lieu de se substituer.
- **Aucun moteur reecrit, meme ici.** Chaque etage passe par `renderStudio`,
  exactement le moteur que les deux ecrans utilisent pour leur apercu — c'est
  ce qui garantit que le rendu final est ce que l'utilisateur a vu. Un etage
  dont les filtres valent les valeurs par defaut, ou dont l'intensite est
  nulle, est **saute** : la source traverse sans etre recopiee, donc sans
  perte.
- **L'utilisateur sait sur quoi il travaille.** `PipelineSourceNote` affiche une
  ligne, au meme endroit dans Vision et dans Studio : « Tu travailles sur ta
  composition Mise en page » (avec un lien pour y retourner), ou « sur la photo
  de ton projet », ou « sur la photo importee ici ». Le Studio ajoute « Ton
  reglage Vision est deja applique dessus ». Sans cette ligne, le chainage
  serait invisible, donc impossible a comprendre quand il surprend.
- **`/studio` ne rend plus rien : il redirige, cote serveur.** Mapping complet
  des anciens deep-links : `layout` -> `/creer/layout-visuel`, `studio` ->
  `/creer/studio`, `vision-pro` -> `/creer/vision`, `soundtrack` et `library`
  -> `/creer/son`, `video` -> `/video`, tout le reste -> `/creer`. Les liens
  des pages publiques, du compte, du backoffice et de VibeCut ont ete
  **repointes a la source** plutot que laisses vivre sur la redirection.
- **La publication a sa propre route : `/publier`.** C'est le meme
  `PublicationsManager`, avec les memes feuilles Tailwind/publications que
  `/studio` chargeait — deplacees dans `src/app/publier/layout.js`. Le bouton
  « Publier » du bandeau rend le projet complet via le pipeline, depose la
  charge utile dans `publishHandoff` (un singleton de module : elle contient
  des Blobs, sessionStorage ne sait pas les stocker) et navigue. Limite
  assumee et documentee : le relais survit a une navigation client, pas a un
  rechargement complet — meme mecanique que le pont « Utiliser dans VibeCut ».
- **Une extraction de plus, jamais une copie** : `buildSocialImages` (decoupage
  des panoramas en slides de carrousel) est sorti de `VibeFxStudio.jsx` vers
  `src/features/vibefx-studio/utils/socialExport.js` AVANT la suppression, pour
  que la charge utile de publication reste identique au bit pres.
- **Suppression de l'ancienne interface (commit separe et reversible).** Sont
  partis : `VibeFxStudio.jsx` et son `index.js`, tout `components/` (header,
  sidebars, panneaux Layout/Style/Vision, modales, onglet bibliotheque
  Midjourney, rail IA, HeroSidebar/HeroToolbar), tout `ai/`,
  `soundtrack/SoundtrackPage.jsx` + `soundtrack/components/` + `soundtrack.css`,
  `src/app/studio/StudioClient.jsx` et `src/app/studio/layout.js`. Sont restes,
  et c'est le point important : **tous les moteurs, hooks, donnees et services**
  que `vibeos/` importe. Un garde neuf dans `scripts/audit-scope.mjs` verifie
  les deux sens — la liste des fichiers qui doivent avoir disparu, et la liste
  de ceux qui doivent rester.
- **Ce que la suppression emporte vraiment** (dit franchement, ce n'est pas que
  du menage) : le **rail agents IA** et l'**onglet bibliotheque Midjourney**
  vivaient dans l'ancienne interface et ne sont pas portes dans VibeOS. Les
  routes API et le ledger IA sont intacts ; `src/config/aiLaunch.js` marque ces
  deux surfaces « a porter dans VibeOS » au lieu de pointer vers une page
  morte.
- **Tests retires avec ce qu'ils testaient** : `smoke-studio-ui`,
  `smoke-studio-ai-rail`, `smoke-soundtrack-ui`, `smoke-vision-ui`,
  `run-vision-ui-test`, `smoke-vision-corpus`, `run-vision-corpus-test`,
  `smoke-smooth-blur-ui`, `smoke-studio-emulator-ui` et
  `smoke-vibeos-layout-parity` (sa reference — l'ancien Layout — n'existe
  plus ; derniere mesure : 0 pixel d'ecart). Les audits purs qu'ils
  encadraient survivent : `test:vision-filters`, `test:smooth-blur`,
  `test:soundtrack-core`, `check:vision-corpus`.
- **Un smoke neuf, `test:vibeos-pipeline`** : il compose reellement dans Mise en
  page, passe a Vision, applique un look, passe au Studio et **mesure les
  pixels** pour verifier que l'image de travail du Studio est bien la
  composition filtree par Vision (et pas la composition nue), applique une
  ambiance, puis publie et verifie que `/publier` s'ouvre avec le visuel. Le
  meme parcours est rejoue en 390px.
- **Deux tests d'infrastructure mis a jour** : `smoke-routes` verifie desormais
  la redirection `/studio` (307 vers `/creer`, et `?workspace=vision-pro` vers
  `/creer/vision`) et le noindex de `/creer` et `/publier` ; le workflow CI ne
  lance plus les smokes de l'ancienne UI mais les cinq suites VibeOS.
- **Gates** : `npm run lint` (0 erreur, 5 warnings preexistants — 7 warnings
  sont partis avec les fichiers supprimes), `npm run build`, `test:scope`,
  `test:vibeos-layout`, `test:vibeos-vision`, `test:vibeos-studio`,
  `test:vibeos-soundtrack`, `test:vibeos-pipeline`, `test:routes` (serveur de
  production local) et `test:publication-flow` : tous verts.

## Journal — 2026-08-08 (VibeOS phase E — l'ecran Soundtrack reel)

- **`/creer/son` n'est plus un placeholder** : l'espace Soundtrack tourne, monte
  sur `src/features/vibeos/soundtrack/`, et c'est un vrai lecteur de musique et
  non un panneau d'import. Colonne gauche 260px (Rechercher, Accueil, puis
  Bibliotheque projet / bibliotheque locale / imports recents, et en bas les
  quatre Sources), vue Accueil en rangees horizontales de cartes-pochettes, vue
  Recherche en lignes avec badge de licence et actions au survol, vues
  bibliotheque a pochette-mosaique et liste numerotee, lecteur fixe de 72px en
  bas. Sur mobile la colonne devient une barre d'onglets interne avec un bouton
  « + », et le lecteur devient une mini-barre au-dessus de la tab bar du shell,
  qui ouvre un lecteur plein ecran.
- **Aucune logique metier reecrite.** `useLocalSoundtrackLibrary`,
  `useProjectSoundLibrary`, `useSoundtrackSearch`, les services de droits et de
  telechargement et les APIs `src/app/api/music/*` sont importes tels quels.
  `useVibeOsSoundtrack.js` ne fait que les assembler.
- **Le provider audio global devient le moteur de lecture.**
  `vibeos/audio/AudioProvider.jsx` porte desormais la file, l'aleatoire, le
  volume, l'enchainement automatique en fin de piste et un resolveur de source.
  Deux raisons structurelles, toutes deux verifiees a l'usage :
  `useSoundtrackPlayer` possede son propre `<audio>`, qui mourrait a chaque
  changement de page ; et `useLocalSoundtrackLibrary` **revoque ses URLs
  d'objet quand il est demonte**, donc le provider redemande le Blob et
  fabrique sa propre URL, dont il garde la propriete jusqu'a la piste suivante.
  Consequence assumee : `useSoundtrackPlayer` et `useSoundtrackController` ne
  sont pas utilises par VibeOS, et restent intacts pour l'ancien `/studio`.
- **Extraction sans changement de comportement** : les flux d'import etaient
  enfermes dans `AiMusicImportAssistant.jsx` (553 lignes) et
  `PixabayImportAssistant.jsx`. Ils vivent maintenant dans
  `soundtrack/services/soundtrackImportFlows.js` — import Aitra Free par theme,
  import Pixabay par theme, import de fichiers Pixabay telecharges, import
  d'URL audio, constructeurs de metadonnees et exclusions Pixabay. Les deux
  anciens composants appellent ce module et gardent leurs messages au caractere
  pres ; les Sheets VibeOS l'appellent aussi. Mesure : `smoke-soundtrack-ui`
  donne exactement les memes 11 echecs avant et apres (test refait en revenant
  aux fichiers d'origine, serveur de dev actif).
- **Nouveau smoke `npm run test:vibeos-soundtrack`**
  (`scripts/smoke-vibeos-soundtrack.spec.cjs`, 3 tests) : parcours reel (colonne
  complete, Sheet « Fichier local », import d'un vrai WAV fabrique par
  `ffmpeg-static`, la piste apparait dans Imports recents et en bibliotheque
  avec sa duree lue du fichier, lecture, le temps du lecteur avance vraiment,
  la ligne est teintee) ; **le critere de la phase E** — lancer une piste,
  partir sur `/creer/studio`, verifier que le mini-lecteur du bandeau montre la
  meme piste toujours en lecture, revenir et retrouver le lecteur intact — plus
  le lecteur mobile et l'absence de debordement horizontal en 390x844 ; et la
  vue Recherche, qui doit toujours dire quelque chose plutot que rester muette.
  Le WAV est un PCM : le Chromium de Playwright n'embarque pas les codecs
  proprietaires, un MP3 ne serait ni decode ni mesurable.
- **Nettoyage impose par ce test** : le serveur de dev recopie tout import local
  dans `public/music/local-imports` ET l'inscrit dans son manifeste. Sans
  nettoyage, la piste de test revenait dans la bibliotheque de tous les
  lancements suivants — le smoke retire donc le fichier et l'entree du
  manifeste, et il est verifie rejouable deux fois de suite.
- **Deux corrections trouvees en route** : les toasts du shell tombaient pile
  sur les commandes du lecteur (les primitives acceptent maintenant
  `--vo-toast-offset`, pose sur le shell par l'ecran Soundtrack le temps de sa
  visite) ; et beaucoup de manifests recopient le titre dans `attribution`, ce
  qui affichait la meme phrase deux fois par ligne — on retombe desormais sur
  la source.
- **Limite assumee** : « Utiliser dans VibeCut » pousse la piste dans le store
  video partage (`vibefx-studio/video/store/videoStore.js`) puis navigue vers
  `/video`. Ce store est un singleton de module : le passage ne survit qu'a une
  navigation client, pas a un rechargement complet. C'est deja le comportement
  de l'ancien ecran ; le pont durable est un sujet de la phase F.
- Gates : `npm run lint` 0 erreur (12 warnings preexistants), `npm run build`
  vert, `test:vibeos-soundtrack` 3/3, `test:vibeos-layout` 2/2,
  `test:vibeos-vision` 2/2, `test:vibeos-studio` 2/2,
  `test:vibeos-layout-parity` vert, `test:scope` vert.
- **`todo.md` allege dans la foulee** (563 -> 222 lignes) : il ne garde qu'un
  resume court de ce qui est livre, les points d'architecture a connaitre, la
  phase F detaillee, les regles, les gates et le prompt de reprise. Le detail
  par phase n'y est plus duplique — il vit ici, dans ces journaux dates, qu'on
  ne lit que pour la zone qu'on touche. C'est un choix de **contexte** : un
  agent qui reprend le chantier ne doit pas avaler 350 lignes d'historique
  avant d'ecrire sa premiere ligne de code.

## Journal — 2026-08-11 (photothèque VibeOS, vrai avant/apres, image bloquee)

- **L'image qu'on ne pouvait plus enlever : cause trouvee.** Vision (et Studio)
  prennent leur source dans `resolveProjectSource`, qui donne **la composition
  du Layout en priorite** sur la photo du projet. Importer une autre photo dans
  Vision ne changeait que l'etat local de l'ecran : au rechargement, la
  composition stockee en IndexedDB reprenait la main. Trois sorties ajoutees,
  aucune magie : `handleImageUpload` efface desormais la composition et remplace
  vraiment l'image du projet ; `detachComposition` (« Quitter la composition »)
  revient a la photo brute ; et l'accueil a un bouton « Nouvel espace vierge ».

- **Nouvel ecran `/creer/bibliotheque`** (`src/features/vibeos/library/`) : les
  photos importees sont stockees une fois pour toutes dans une base IndexedDB
  **separee** (`vibeos-library`), avec leur vignette WebP et leur EXIF. On ne
  reimporte plus une photo pour la retoucher : « Retoucher » ouvre un **nouvel
  espace** monte sur cette photo, ce qui evite d'ecraser une composition en
  cours.

- **Vraie masonry, pas des colonnes CSS.** `column-count` remplit la premiere
  colonne avant la suivante : l'ordre chronologique se lirait de haut en bas,
  colonne par colonne. `masonry.js` place donc chaque photo dans la colonne la
  plus courte en gardant l'ordre de la liste, et rend des rectangles absolus.
  Les tuiles sont posees en `transform`, donc changer la densite les fait
  **glisser** au lieu de reconstruire la grille.

- **Indexation EXIF maison, zero dependance** (`exif.js`, ~200 lignes) : on ne
  lit que les 128 premiers Ko du fichier (l'APP1 y tient largement) et on n'en
  sort que huit champs. Verifie sur les vraies photos : « Samsung Galaxy S24
  Ultra », « Canon EOS 200D », focale/ouverture/vitesse/ISO/date. Un fichier
  sans EXIF n'echoue jamais, il retombe sur la date du fichier.

- **HEIC : dit honnetement.** Chromium ne sait pas les decoder ; l'import les
  compte comme « illisibles par ce navigateur » au lieu d'echouer en silence
  (Safari, lui, les accepte).

- **Carrousel** (`Lightbox.jsx`) : rail a largeur variable (chaque diapositive
  fait la taille de SA photo), une voisine visible de chaque cote, ouverture en
  fondu-zoom, vignette deja decodee affichee au premier trait puis fondu vers la
  pleine resolution, glissement au doigt ecrit directement sur le DOM, fermeture
  par glissement vertical, frise escamotable, clavier. **Refait le 2026-08-29**
  — voir le journal du jour ; le zoom partage FLIP depuis la tuile n'existe
  plus.

- **Avant/apres refait** (`shared/BeforeAfter.jsx`). L'ancien bouton « maintiens
  le clic » avait trois defauts structurels : il perdait l'appui des que le
  curseur sortait du bouton, il faisait `display: none` sur le canvas (donc un
  saut de mise en page a chaque appui), et il ne comparait qu'en tout-ou-rien.
  L'original est maintenant superpose au rendu et revele par `clip-path` : rien
  n'est demonte. Trois modes (rideau, cote a cote, maintien), position ecrite
  sur le noeud pendant le geste, relachement global sur `blur` pour ne jamais
  rester bloque.

- **Trois bugs attrapes en verifiant** :
  1. en mode « cote a cote », l'original occupait tout le cadre — un element
     flex refuse de passer sous la largeur intrinseque de son contenu sans
     `min-width: 0`, et une photo de 6000 px poussait l'autre moitie hors ecran ;
  2. sur une photo **verticale**, la comparaison etalait l'image sur toute la
     largeur (elle avait l'air « passee en paysage »). En sortant le canvas de
     `canvasWrap` pour l'envelopper, son `max-height: 100%` ne resolvait plus
     contre une hauteur definie. Le cadre porte maintenant le **rapport de la
     photo** (`aspect-ratio`, variable `--ba-ratio`) : il epouse l'image et
     reste borne par la scene ;
  3. la barre d'actions de l'apercu etait posee en absolu **par-dessus** la
     photo : sur un portrait, elle tombait en plein milieu. La scene est
     devenue une colonne — barre d'actions sur sa propre ligne, puis la photo ;
  4. dans la bibliotheque, la largeur de la grille etait mesuree par un effet,
     alors que la grille **n'existe pas** tant qu'aucune photo n'est importee :
     l'observateur ne se rattachait donc jamais apres le premier import et la
     masonry restait calee sur une largeur perimee. La mesure passe maintenant
     par un ref de rappel, declenche au moment exact ou la grille apparait.

- **« Retirer » (à côté de « Changer de photo »)** : vide l'apercu et l'espace de
  travail sans toucher a la bibliotheque. C'est une deselection, pas une
  suppression.

- **Gates** : `npm run lint` (0 erreur), `npm run build`, `npm run
  test:vibeos-library` (nouveau : EXIF + masonry en Node, puis parcours complet
  au navigateur), `test:vibeos-vision`, `test:vibeos-pipeline`,
  `test:vibeos-layout`, `test:vibeos-studio`, `test:routes`, `test:scope`.

## Journal — 2026-08-08 (VibeOS phase D — l'ecran Studio reel)

- **`/creer/studio` n'est plus un placeholder** : l'ecran Studio tourne, monte
  sur `src/features/vibeos/studio/`. Comme Layout et Vision, **aucun moteur
  n'a ete reecrit** : le rendu passe par `useCanvasRenderer` en vue `studio`
  (donc `engine/studioRenderer.renderStudio`), le recadrage par
  `useCanvasEvents`, l'export par `useExport`, la mesure d'image par
  `visionMetrics`, le tri et les vignettes par `utils/visionRecommendation`.
- **10 ambiances en un clic** (`studio/ambianceCatalog.js`) : six curees depuis
  `PRESET_CATEGORIES` (Portra 400, Gold 200, Fuji Superia, CineStill 800T,
  Tri-X 400, Blade Runner) et quatre combinaisons nouvelles (Polaroid delave,
  VHS chaud, Eclat doux, Brume matin). Chaque ambiance est un bundle complet :
  filtres + grain + vignettage + une palette de fond mesh assortie. Le format
  est celui de `PRESET_CATEGORIES.profiles`, plus la famille et la force que
  `scoreProfileForImage` sait deja lire.
- **Les tuiles sont rendues sur la VRAIE image**, en file d'attente (plan §7),
  a l'intensite recommandee de l'ambiance : la tuile montre ce que fera le clic.
- **« Surprends-moi »** tire une ambiance ponderee par les signaux de la photo
  (`getImageRecommendationSignals`, deja partage avec Vision) puis decale 3
  parametres au maximum de ±10 %.
- **Variantes** : les 6 derniers etats appliques en vignettes cliquables,
  historique VISUEL complementaire de l'undo/redo (30 etats, meme forme que
  Layout et Vision).
- **Sheets de fonds generes sortis dans `vibeos/shared/`** : `MeshSheet`,
  `LumenSheet` et `SmoothBlurSheet` quittent `vibeos/layout/` et sont
  desormais partages avec Studio (CSS deplace dans `generators.module.css`,
  imports de `LayoutScreen` mis a jour, classes devenues mortes retirees de
  `layout.module.css`). Aucun changement de comportement pour Layout — la
  parite pixel reste verte.
- **`renderVisionProfilePreview` accepte un 3e argument optionnel**
  (`{ safeSmartphone, filterIntensity }`), avec des valeurs par defaut
  identiques a l'existant : les appelants Vision ne bougent pas d'un pixel,
  et le Studio peut afficher une vignette a l'intensite reelle et, en mode
  creatif, sans le bornage smartphone.
- **Reglages avances** : garde-fous smartphone / mode creatif, recadrage
  (proportions, zoom, deplacement a la souris via le moteur d'evenements
  existant), filtres manuels, teinte, et **styles perso** en localStorage
  `vibeos.studio.customStyles` qui remontent en tete des ambiances.
- **Nouveau smoke `npm run test:vibeos-studio`**
  (`scripts/smoke-vibeos-studio.spec.cjs`) : parcours reel (import, tuiles
  rendues, application, intensite 0 = original, Surprends-moi, variantes,
  comparaison, fond Mesh, avances, style perso ecrit en localStorage) plus le
  critere de la phase D — sur 3 photos types, les 10 ambiances donnent 10
  rendus REELLEMENT distincts deux a deux, et aucune ne produit d'image grise,
  noire ou cramee.
- **Limite assumee** : le fond genere habille la composition (il est ecrit dans
  le projet commun et rendu par Mise en page) ; le Studio l'affiche en apercu
  mais ne le compose pas sous la photo — la vue `studio` du moteur ne rend que
  l'image. Le chainage complet composition -> Vision -> Studio reste prevu en
  phase F (plan §4.3).
- Verifie : lint 0 erreur (12 warnings preexistants), build vert,
  `test:vibeos-studio` 2/2, `test:vibeos-layout` 2/2, `test:vibeos-vision` 2/2,
  `test:vibeos-layout-parity` vert, `test:scope` vert, `test:vision-ui` 7/9
  (les 2 memes echecs preexistants).

## Journal — 2026-08-08 (VibeOS phase C — l'ecran Vision reel)

- **`/creer/vision` n'est plus un placeholder** : l'ecran Vision tourne, monte
  sur `src/features/vibeos/vision/`. Comme pour Layout, **rien n'a ete
  reecrit** : rendu (`useCanvasRenderer` en vue photo), export (`useExport`),
  mesure d'image (`visionMetrics`), bornes de securite
  (`normalizeVisionFilters`) et scoring (`scoreProfileForImage`) sont importes.
- **Extraction, pas duplication** : `getImageRecommendationSignals`,
  `scoreProfileForImage`, `renderVisionProfilePreview` et les constantes
  d'apercu vivaient DANS `components/panels/VisionPanel.jsx` (non exportees).
  Elles sont sorties telles quelles dans
  `src/features/vibefx-studio/utils/visionRecommendation.js` ; l'ancien panneau
  les importe desormais. Aucun changement de comportement (plan §4.2 :
  « extraire la logique dans un module partage plutot que dupliquer »).
- **Un bouton « Ameliorer ma photo »** : `visionMetrics` mesure la photo, la
  correction est deduite des signaux (sombre, plate, fade, deja saturee,
  visages) et repasse par les garde-fous smartphone. Une phrase en francais dit
  ce qui a ete fait : « Photo un peu sombre et plate — j'ai relevé la lumière
  et remis du relief. »
- **Intensite 0-100 (defaut 80)** branchee sur `filterIntensity`, le melange
  lineaire deja implemente par le pipeline : a 0 on revoit exactement
  l'original (verifie par le smoke).
- **12 looks maximum**, rendus sur la VRAIE photo, renommes en francais
  (« Peau douce », « Nuit néon », « Ciel profond »...), tries pour la photo
  courante par `scoreProfileForImage`, badge « Conseillé » sur les deux
  premiers, looks contre-indiques rejetes en fin de liste avec la raison. La
  bibliotheque complete par marque reste en reglages avances.
- **Bug produit trouve et corrige en route** : sur une photo de nuit, un look
  contraste+vignette pouvait fermer l'image (luminance moyenne mesuree a
  4/255). `normalizeVisionFilters` borne dans l'absolu mais ne regarde pas
  l'image ; `guardLookForImage` croise desormais le look ET les signaux de la
  photo (vignette plafonnee, ombres relevees, contraste limite en basse
  lumiere).
- **Nouveau smoke `npm run test:vibeos-vision`** : parcours reel (import,
  amelioration, intensite, look, comparaison, garde-fous, bibliotheque) ET le
  critere du plan §6 — sur 5 photos types (portrait, paysage, nuit, plate,
  deja saturee), les 12 looks sont appliques et mesures : aucun ne produit une
  image grise, noire ou cramee, et le tri ne recommande pas la meme chose pour
  toutes.
- **Correctif de test** : `scripts/smoke-vision-ui.spec.cjs` (ancien panneau)
  n'entrait plus dans `/studio` — il ne franchissait pas le portail
  d'authentification de dev, et 6 de ses 9 tests echouaient avant meme de
  tester quoi que ce soit. Le contournement est desormais gere. Restent 2
  echecs de fond, identiques avec ou sans l'extraction ci-dessus (verifie en
  revenant au fichier d'origine).

## Journal — 2026-08-08 (VibeOS phase B tranche 3 — finitions Layout)

- **Textures de fond** : import multiple, selection de la texture active,
  opacite ; le moteur `renderLayoutImageTexture` etait deja la, seul l'etat
  manquait. Les textures entrent aussi dans l'historique undo/redo.
- **Editeur de zones du modele personnalise** : palette de formes
  (`CUSTOM_SHAPE_LIBRARY`) en clic ou en glisser-deposer sur l'apercu, puis
  deplacement a la souris/au doigt et poignee de redimension posees exactement
  sur le canvas (`ZoneOverlay.jsx`), plus les reglages fins (largeur, hauteur,
  position, arrondi), la suppression et « Vider le canevas ». Toute la
  geometrie de placement reste celle de `utils/customLayout.js`.
- **Stickers** : le moteur d'assets existant ne fournit qu'un element, le
  scotch — il est expose tel quel (ajout, rotation, opacite, glisser sur
  l'apercu) plutot que d'inventer un moteur.
- **Comparaison avant/apres** : maintien du clic = la photo d'origine, cadree
  exactement sur le canvas.
- **Apercu Instagram** (`InstaPreviewSheet.jsx`) : post, story et carrousel
  panorama, en CSS Modules.
- **Le projet survit au rechargement** : `layoutPersistence.js` traduit l'etat
  de l'editeur en enregistrement projet — images, textures et fond Lumen en
  **Blobs** IndexedDB (jamais des dataURL, plan §7), plus zones, slots, textes,
  stickers, geometrie et fond. Au retour sur la page, tout est recharge et
  l'edition reprend ou elle en etait.
- **Parite d'export enfin MESUREE** : `npm run test:vibeos-layout-parity`
  pilote l'ancien Layout (`/studio`) et le nouveau (`/creer/layout-visuel`)
  avec la meme photo et les memes reglages, puis compare les deux canvas pixel
  a pixel : **0 pixel d'ecart** sur 1080x1350. Le grain est mis a 0 des deux
  cotes — son motif de bruit est tire au hasard a chaque chargement de page,
  aucune comparaison exacte n'est possible avec.
- **Bug trouve et corrige en route** : des que « Reglages avances » etait
  ouvert, la PAGE entiere se mettait a scroller sur desktop (regression de
  l'invariant pose en tranche B1). Cause : les champs de fichier caches sont en
  `position: absolute` et, sans bloc conteneur, se rattachaient au bloc initial
  — ils allongeaient la zone scrollable du document au lieu d'etre clipes par
  le panneau. `position: relative` sur le panneau et sur le label d'import.
  Garde ajoutee au smoke.
- **Smokes** : `npm run test:vibeos-layout` execute desormais B1 + B3 ;
  `scripts/smoke-vibeos-layout-b3.spec.cjs` couvre textures, stickers, zones
  (dont un vrai deplacement a la souris), comparaison, apercu Insta,
  rechargement de page avec reprise du projet, et la barre d'outils sur
  mobile 390px.

## Journal — 2026-08-08 (menage documentaire — todo.md recentre sur VibeOS)

- **`todo.md` passe de 2133 a ~290 lignes.** Il ne portait plus seulement le
  chantier actif : les 1989 lignes de la reconstruction VibeCut (close le
  2026-08-04) occupaient 93 % du fichier et noyaient le redesign VibeOS.
- **Rien n'est perdu, tout est deplace** : le contenu VibeCut part dans
  `docs/archive-vibecut-2026-08-04.md` (point situationnel, tous les lots,
  bugs 1 a 59, problemes connus non resolus, commandes `test:vibecut-*`,
  lecons FFmpeg payees). L'archive porte un en-tete qui dit explicitement que
  ce n'est plus une liste de taches, et le prompt de relance VibeCut qu'elle
  contient est marque **PERIME** pour qu'aucun agent ne le rejoue.
- **`todo.md` devient un document de travail VibeOS** : ordre de lecture,
  tableau des phases A-F, regles non negociables, ce qui est livre (A, B1, B2),
  reste a faire (B3 ordonne, puis C avec ses criteres d'acceptation, D, E, F),
  points d'attention du plan §7, commandes utiles, prompt de relance.
- **Ce qui a ete garde dans `todo.md` bien que venant de VibeCut** : les trois
  echecs de tests preexistants (fixtures WebM 7 Mo, chemins Windows
  `C:\Users\pcpor\`, pointeurs Git LFS de `videotest/`), parce qu'un agent
  VibeOS peut les rencontrer et doit savoir qu'ils sont anterieurs au chantier
  et ne bloquent pas ses gates.
- Aucun code touche. `plan.md` (direction artistique VibeCut) reste en place,
  l'archive y renvoie.

## Journal — 2026-08-08 (VibeOS phase B tranche 2 — fonds generes, undo/redo, zones)

- **Les trois generateurs de fond sont revenus, en VibeOS.** Mesh gradient
  (sheet compact : 4 couleurs, 6 palettes, melange — le rendu final reste
  celui du moteur canvas existant), Lumen (meme app embarquee
  `/vendor/lumen` et meme protocole postMessage que l'ancien modal) et Flou
  pro (pilote du moteur partage `vibefx-shared/smoothBlur` : looks rapides,
  aleatoire toujours propre, direction/hauteur/intensite/finesse). Les
  sequences d'application sont copiees de VibeFxStudio : appliquer un mesh
  coupe lumen et le flou d'image, etc.
- Le bloc Habillage propose desormais trois modes de fond : Couleur / Flou /
  Genere (Mesh ou Lumen), plus un bouton Flou pro dont l'etat est visible.
- **Undo/redo complet** : historique 30 etats, miroir exact de l'ancien studio
  (capture/restauration/egalite, debounce 400ms), boutons sur l'apercu et
  raccourcis Cmd+Z / Shift+Cmd+Z (desactives pendant une saisie).
- Reglages par zone selectionnee (avance) : zoom, decalages, bordure, flou —
  brancher sur `updateSlotConfig` existant, rien de reecrit.
- Smoke etendu et vert (5,5s) : application du mesh via le sheet puis
  annuler/retablir verifies, gardes anti-scroll conservees. Lint 0 erreur
  (2 erreurs react-hooks corrigees en cours de route), build vert.
- Reste en tranche B3 : textures multiples, editeur de zones custom,
  stickers, avant/apres, apercu Insta, persistance images IndexedDB,
  pixel-diff automatise (liste ordonnee dans todo.md).

## Journal — 2026-08-08 (VibeOS phase B tranche 1 — l'ecran Layout reel)

- **`/creer/layout-visuel` n'est plus un placeholder.** L'ecran Layout VibeOS
  est branche sur les moteurs EXISTANTS de vibefx-studio (pipeline de rendu,
  evenements canvas, upload, export importes tels quels) : la parite d'export
  avec l'ancien onglet est garantie par le partage du code, pas par une copie.
- Mode simple en 4 blocs dans l'ordre de creation : Format (silhouettes
  proportionnelles), Modele (8 + Personnalise avec ses 3 prereglages de
  zones), Images (import par slot, ajout global, drag & drop), Habillage
  (marge, arrondi, fond couleur/flou, grain, acces aux templates).
- Le sheet « Templates prets a poster » donne enfin une vraie surface aux ~80
  habillages thematiques : apercus SVG dessines depuis les vraies zones et
  textes, application complete format+zones+textes+fond.
- Reglages avances en Collapsible : textes complets (dont drag + snap sur le
  canvas via le moteur existant), geometrie fine, orientation pellicule.
- Export reel JPG/PNG/WebP avec estimation du poids et decoupe panorama
  (useExport inchange). Vignette 256px ecrite dans le projet VibeOS.
- Nouveau smoke navigateur `npm run test:vibeos-layout`
  (`scripts/smoke-vibeos-layout-b1.spec.cjs`) : parcours reel import → canvas
  1080x1080 → modele Double → template applique → export telecharge. Vert.
- Reste en tranche B2 (liste ordonnee dans todo.md) : Mesh/Lumen/Flou pro en
  Sheet, textures, editeur de zones custom, stickers, undo/redo, persistance
  images IndexedDB, pixel-diff automatise.
- Correctif post-test utilisateur (meme jour, 2 passes) : la page entiere
  scrollait et le bandeau disparaissait. Cause racine : `overflow-x: hidden`
  sur html/body dans globals.css casse `position: sticky` pour tout descendant.
  Solution structurelle : le shell VibeOS devient une coquille d'application —
  `.root` fait exactement `100dvh` avec `overflow: hidden`, le bandeau vit HORS
  du scroll (il ne peut plus bouger), et `.content` est la SEULE zone
  scrollable. L'ecran Layout remplit ce conteneur et bloque son scroll : apercu
  fixe, seul le panneau droit scrolle ; le canvas garde son ratio et tient
  entier quel que soit le format (Story 9:16 comprise). Gardes anti-regression
  au smoke : wheel 800px puis `pageScrollable === false`, shell a `top: 0` et
  hauteur <= fenetre, canvas dans la fenetre.

## Journal — 2026-08-08 (VibeOS phase A — fondations livrees)

- **Le hall d'accueil de VibeOS existe.** `src/features/vibeos/` est cree :
  design system `.vibeos` (tokens `--vo-*` copies a l'identique de VibeCut),
  primitives completes (dont Slider avec double-clic reset, Sheet qui devient
  bottom sheet sous 768px, toasts), shell a bandeau unique avec navigation
  d'espaces, mini-lecteur audio global et tab bar basse mobile.
- **Le projet qui circule est en place** : modele v1 + IndexedDB (`vibeos`,
  stores `projects`/`meta`), autosauvegarde debouncee 800ms avec flush sur
  `pagehide`, recents (8 max), dupliquer/supprimer/ouvrir. Toute erreur
  IndexedDB degrade en memoire seule sans bloquer la creation.
- **Routes** : `/creer` (accueil incubateur complet : reprise, 5 cartes
  d'espaces dessinees en CSS, recents avec menu), plus `layout-visuel`,
  `studio`, `vision`, `son` en placeholders honnetes annoncant leur phase.
  Noindex partout, StudioAuthGate comme /video.
- **Rien d'ancien n'est touche** : `/studio`, `vibefx-studio/`, `vibefx-layout/`
  et `/video` sont inchanges. Le bouton « Publier » du shell renvoie au flux
  actuel de /studio jusqu'a la phase F.
- Verifie : lint 0 erreur (12 warnings preexistants hors vibeos), build vert
  avec les 5 routes, smoke HTTP 200 + meta noindex. Prompt de relance phase B
  (Layout) ecrit en fin de `todo.md`.

## Journal — 2026-08-08 (cadrage du redesign VibeOS)

- **Nouveau document** : `docs/plan-vibeos-redesign-2026-08-08.md` — plan maitre
  du redesign complet des surfaces Studio / Layout / Soundtrack / Vision.
  Decisions validees avec l'utilisateur : vraies pages separees sous `/creer/*`
  avec accueil incubateur (VibeCut inclus comme 5e espace), mode simple + expert
  partout, Vision auto-magique + 12 looks tries par pertinence photo, Studio
  redesign + 4 features (ambiances, surprends-moi, variantes, styles perso),
  Soundtrack refait en Spotify-like sans nouvelle feature, mini-lecteur global,
  desktop + mobile serieux, side-build puis bascule (redirections `/studio` ->
  `/creer` et suppression de l'ancien UI en phase F).
- Design system cible : `.vibeos` (tokens `--vo-*` copies de
  `src/features/vibecut/styles/vibecut.css`), CSS Modules uniquement — le
  bundle Tailwind statique de `/studio` n'est pas utilise par le nouveau code.
- Aucune modification de code applicatif dans ce lot : uniquement le plan,
  cette entree de journal et l'arbre docs/.

## Journal — 2026-08-04 (lot B3, 7e tranche — ouverture et fin de sequence, montage avance)

- **LES SEPT OUVERTURES ET FINS PEUVENT ENFIN OUVRIR ET FINIR.** Une transition
  ne s'accrochait qu'ENTRE DEUX PLANS : il n'existait aucun emplacement avant le
  premier ni apres le dernier. Sept entrees portaient un nom pour un role
  impossible.
- **Le modele savait deja le faire** : `placement: 'intro' | 'outro'` sur la
  piste `sequence-main`, et `getIntroOffset` decale tous les plans. Ce qui
  manquait etait le CHEMIN - rien n'appelait `addTransitionItem` avec un
  placement.
- **Une ouverture ALLONGE le montage** (20,01 -> 21,01 s) la ou une transition de
  coupe fait chevaucher et RACCOURCIT (30,01 -> 29,21 s).
- **Rendu des deux cotes** : `renderSequenceEdge` a l'apercu,
  `appendSequenceEdges` a l'export. Prouve sur un vrai MP4 : 2,00 s sans les
  bords, **3,97 s avec**, luminance debut 0 / milieu 126 / fin 0.
- **Le panneau de droite range par usage** : Ouverture / Entre deux plans / Fin.
- **DEUX BUGS CORRIGES** : la fin etait posee a `total - duree` alors que le
  calcul AJOUTE sa duree (elle chevauchait le dernier plan) ; et le lecteur
  n'etait pas repositionne avant de figer l'image.
- **MONTAGE AVANCE, deux defauts trouves en le pilotant sur de vrais rushs** : le
  bloc « Mouvement » etait sous `isImage` (un plan VIDEO n'en proposait aucun,
  alors que le lot B3 avait leve la restriction dans le moteur), et AUCUN des
  cinq effets pendant le plan n'y etait propose.
- **LECON DE METHODE** : la fin a ete crue cassee parce que la mesure etait une
  MOYENNE DE LUMINANCE et que le dernier plan avait un fond noir. Une moyenne ne
  distingue pas « video sombre qui s'eteint » de « ecran noir ». Regarder la
  capture a tranche en dix secondes.
- **Rollout** : revision `00015-r6x`, image `sequence-20260804`.

## Journal — 2026-08-04 (lot B3, 6e tranche — les trois derniers effets pendant le plan)

- **Grain anime, flou anime et fuite de lumiere livres.** Les accents passent de
  **2 a 5**. C'etait le vrai retard sur Premiere et DaVinci.
- **UNE DEUXIEME FAMILLE D'ACCENTS** (`kind: 'image'`). `shake` et `pulse` se
  ramenent a un decalage du CADRAGE et entrent dans le `zoompan` existant; ces
  trois-la modifient l'IMAGE apres le recadrage et ont leur propre chemin des
  deux cotes (chaine de filtres a l'export, filtre de contexte + calques a
  l'apercu).
- **Trois mecaniques, une par effet** : `geq` sur l'image pour le halo (un
  `overlay` demanderait une seconde entree, or la chaine d'un plan est
  lineaire); une chaine de flous a valeur constante gates par `enable` pour le
  flou (24 paliers, `gblur` n'accepte pas d'expression et `sendcmd` est
  proscrit); un `noise=allf=t` pour le grain.
- **CE QUE LA MESURE A CONTREDIT** :
  - le flou etait a 0,59 et ce n'etait PAS le sigma, c'etaient les **bords**
    (FFmpeg rabat sur le bord, le canvas prend du transparent) - piege deja paye
    sur les transitions le 2026-08-02. Corrige : 0,59 -> 0,74 ;
  - la **quantification n'etait pas** la cause du reste : l'aligner n'a rien
    change, ce qui l'a ecartee. Reste un ecart de NOYAU aux petits sigmas, meme
    famille que `blur-cut` (probleme G) ;
  - le grain de l'apercu etait **4,9 fois trop faible** : `noise=alls=N` et un
    melange `overlay` ne se correspondent pas terme a terme. Diviseur mesure
    (45), pas devine - export +1,424 contre apercu +1,391, rapport **1,02**.
- **Le grain est juge sur la QUANTITE de bruit et non sur les pixels** : FFmpeg
  tire sa suite aleatoire avec son propre generateur. `meanFrame` reste exige.

## Journal — 2026-08-04 (lot B3, 5e tranche — glitch, et les deux bibliotheques closes)

- **LES DEUX BIBLIOTHEQUES SONT COMPLETES** : 48 transitions sur 48 et
  **12 mouvements sur 12**, plus une seule entree « Bientot » nulle part.
- **`glitch` livre comme MOUVEMENT** (`mediaModel.js`, `server.js`,
  `videoExport.js`, `exportManifest.js`, `motionCatalog.js`). C'est le premier
  dont la valeur est un **escalier** et non une courbe : le cadre saute
  lateralement, tient quelques images, revient. Motif de huit paliers dont
  **cinq a zero** — c'est ce qui le rend « bref » plutot que permanent.
  - **La cadence (11,37 Hz) n'est pas ronde expres.** Une frontiere de palier qui
    tomberait exactement sur un instant d'image ferait dependre `floor` du dernier
    bit du flottant, et les deux cotes liraient des paliers voisins — un ecart
    d'un **saut entier**, pas d'une fraction de pixel. A 12 Hz et 30 im/s, une
    frontiere tombe sur une image toutes les cinq.
  - **Le calcul part des SECONDES et non de la progression**, parce que les
    secondes sont la seule grandeur que les deux cotes ecrivent pareil
    (`on/fps` au rendu, `progression x duree` a l'apercu). La progression, elle,
    differe d'une image entre les deux — sans consequence sur une courbe lisse,
    fatal sur un escalier.
- **BUG TROUVE EN CHEMIN** (anterieur au glitch) : `buildImageMotionFilter`
  n'ecrivait aucun `zoompan` a **intensite zero**, alors que l'apercu garde le
  cadrage de depart du preset. Sur `zoom-out` (depart 1,14), `bounce` (1,18) ou
  `glitch` (1,08), l'apercu montrait donc une image agrandie et l'export l'image
  entiere. Le garde ne teste plus l'intensite.
- **QUATRE clips de demonstration** au lieu de deux (`aube.mp4`, `orage.mp4`),
  comme le plan du lot B2 le prevoyait. Ce qui les distingue n'est pas la
  palette mais la **structure** : `aube` remonte l'horizon a 0,74 (l'eau occupe
  les trois quarts du cadre), `orage` le descend a 0,44 avec le point le plus
  clair dans un **coin**. Deux clips qui ne different que par leur teinte se
  comportent pareil sous une transition. Une graine par scene, sinon les scenes
  2 et 3 rejouaient le relief et le grain de la scene 1.
  Total : **132 Ko** pour quatre clips, plafond du lot 1,5 Mo.
- **Ce qui reste GENERE et non filme** : ces clips ne viennent toujours pas de
  Mixkit ni de Pexels. Choix confirme par le porteur du projet le 2026-08-04
  (aucune licence tierce a faire valider, et l'ecran garde le meme aspect avec ou
  sans clip charge). Passer a du vrai rush reste un changement de **donnees**.

## Journal — 2026-08-04 (lot B3, 4e tranche — rotation, apparition, parallaxe retiree)

- **Le catalogue de mouvements est TERMINE : 11 rendus sur 12.** Ne reste que le
  glitch, qui n'est pas un mouvement de camera mais un effet pendant le plan.
- **PARALLAXE RETIREE** (decision du porteur du projet, 2026-08-04). Elle
  promettait « plans avant et arriere a vitesses differentes », impossible sur
  une image plate sans estimation de profondeur - et pas davantage sur une video,
  ou la parallaxe est quelque chose qu'on FILME. La garder aurait ete une
  promesse qu'on ne pouvait pas tenir. Textes de `StepRhythm` et icone morte de
  `LibraryTiles` nettoyes au passage.
- **ROTATION** — premier mouvement qui ne se ramene pas a un recadrage: filtre
  `rotate` cote serveur, `ctx.rotate` cote apercu. Deux pieges payes :
  - **une image qui bascule laisse des coins vides.** Le premier jet agrandissait
    le zoom PUIS tournait: faux, `zoompan` rend une image deja ajustee au cadre,
    il n'y a rien au-dela de ses bords. Ecart mesure 4,6/255, IDENTIQUE a 40 % et
    a 100 % d'intensite - un defaut constant, donc pas une erreur d'angle.
    Corrige en faisant rendre un cadre PLUS GRAND, en tournant celui-la, puis en
    recadrant au centre. Ecart tombe a 1,47 ;
  - **`on` n'existe que dans `zoompan`.** Donne au filtre `rotate`, il fait
    echouer le graphe a la configuration (« Failed to configure output pad »)
    sans dire quelle variable manque. L'angle est donc genere DEUX FOIS, avec la
    variable de temps propre a chaque filtre.
- **APPARITION** — le seul mouvement qui touche a l'OPACITE. Le fondu est en
  NUMEROS D'IMAGE (`fade=start_frame/nb_frames`) et non en secondes: en secondes
  il lirait les horodatages, remis a zero seulement APRES cette chaine. C'est le
  meme decalage qui avait coute une image au lot B3b. Le zoom part de 1,06 et se
  pose a 1 - il ne descend jamais sous 1, donc pas de bord (contrairement au
  « scale 0,94 » que la fiche d'origine promettait).
- **Quatre sentinelles verifiees** : sens de bascule inverse, zoom de couverture
  retire, fondu supprime, fondu deux fois trop long.
- **`smoke-vibecut-motion-envelope.mjs`** : verifie desormais aussi que
  l'agrandissement couvre la bascule pour trois formats, et son parseur de
  cadrage est borne a l'accolade fermante - sans quoi il debordait sur le
  cadrage suivant de la meme ligne.
- **Rollout** : image `b3-rotate-appear-20260804`, revision **`00012-xht`**.
  Verifie sur le service reel : 11 mouvements, 3 accents, 29 cibles `xfade`,
  20 filtres, `errorCount: 0`, `/render` a 401.

## Journal — 2026-08-04 (lot B3, 3e tranche — les premiers effets pendant le plan)

- **`mediaModel.js`** : `IMAGE_MOTION_ACCENTS` et `resolveAccentOffset`. Un
  accent n'a pas de trajet, il OSCILLE pendant tout le plan. Sa frequence est en
  HERTZ et non en cycles par plan - une secousse doit trembler a la meme vitesse
  sur 2 s et sur 10 s - d'ou la DUREE ajoutee a `resolveImageMotionFrame` et a
  `applyImageMotionTransform`.
- **Deux accents seulement, et c'est un choix** : `shake` et `pulse` se ramenent
  a un decalage du CADRAGE, donc ils entrent dans l'expression `zoompan` dont la
  parite est deja prouvee. Grain, flou anime et fuite de lumiere n'ont pas cette
  propriete : chacun demandera sa propre mecanique.
- **`server.js`** : `SERVER_MOTION_ACCENTS`, meme oscillation en expression
  FFmpeg (temps = `on/fps`), un accent SEUL suffit desormais a demander un
  `zoompan`, et `/capabilities` passe en **version 7**.
- **PROBLEME I** : la secousse s'octroie son propre zoom (`zoomBoost` 0,03). A
  zoom 1 la marge est nulle, donc une secousse sur un plan fixe sortirait du
  cadre. C'est ce qu'on fait en tournage : cadrer plus large avant de stabiliser.
- **Deux erreurs trouvees a la mesure** :
  - la frequence du premier jet (7,5 et 9,1 Hz) ne donnait que **4,0 et 3,3
    echantillons par cycle** a 30 images/s. La secousse aurait saute entre
    quatre positions, et son aspect aurait dependu de la cadence d'export.
    Ramenee a 3,7 et 4,9 Hz ;
  - **le test de parite etait aveugle** : un accent ne deplace le cadre que de
    +-3,8 px sur 320, sous le seuil de 12/255 tolere pour le reechantillonnage.
    Il compare desormais **l'amplitude du mouvement** de chaque cote - l'ecart
    maximal entre deux images du meme rendu - et non plus seulement les images.
    Quatre sentinelles verifiees, dont deux muettes avant correction.
- **`smoke-vibecut-motion-envelope.mjs`** : les accents sont eprouves sur quatre
  durees, quatre intensites et quatre mouvements porteurs. Marge utilisee : 80 %
  pour la secousse, 62,5 % pour la respiration, zoom jamais sous 1.
- **`SceneInspector.jsx`** : rangee « Effet pendant le plan », separee de la
  grille de mouvements parce qu'un accent se COMPOSE avec un mouvement.
- **`useScenes.js`** : `setSceneMotion` envoie desormais un OBJET et non une
  chaine - une chaine repasse par le preset par defaut et EFFACE l'accent pose a
  cote. Le test navigateur ajoute verifie exactement ce piege.
- **Rollout** : image `b3-accents-20260804`, revision **`00011-6nb`**. Verifie
  sur le service reel : 3 accents, 9 mouvements, 29 cibles `xfade`, 20 filtres,
  `errorCount: 0`, `/render` a 401.

## Journal — 2026-08-03 (lot B3, 2e tranche — les mouvements sur video)

- **Le verrou etait a SIX endroits**, aucun n'ayant de justification technique :
  `VideoEngine.drawFilteredSource` (canvas), `buildImageMotionFilter`
  (renderer), `buildExportManifest` (le mouvement etait mis a `null` pour une
  video), `videoStore` **a l'import ET a la mise a jour**, `useScenes`
  (`motionPreset` valait `null`), et l'interface (`SceneInspector`,
  `MotionLibrary`). `zoompan` sur entree video avait deja ete mesure sans
  reserve au lot B3b : il n'y avait rien a construire, seulement a ouvrir.
- **Deux des six ne se voyaient pas a l'ecran** : le store remettait le
  mouvement a `null`, donc l'interface pouvait l'afficher sans qu'il survive.
  C'est le test navigateur ajoute pour l'occasion qui les a trouves.
- **`scripts/smoke-vibecut-motion-preview-parity.mjs`** : un cas sur une SOURCE
  VIDEO, rognee a 0,5 s. Le rognage n'est pas decoratif - il prouve que la
  course se mesure sur le segment et non sur la source entiere. Le contenu de la
  video est constant : ce qui est mesure ici est la GEOMETRIE du recadrage, et
  comparer deux decodages au meme instant mesurerait la synchronisation du
  decodeur, pas le mouvement. **Sentinelle verifiee** : remettre le garde du
  renderer fait echouer ce cas (« aucun zoompan demande »). 13 cas x 5 images.
- **`scripts/smoke-vibecut-library-v2.spec.cjs`** : fixture video ajoutee et
  test « un mouvement s'applique aussi a une VIDEO », qui verifie la carte
  active APRES rechargement - donc que c'est le modele qui le porte, pas
  l'ecran. Suite portee a **65 tests**.
- **Libelles corriges** : « appliquer aux N photos » devient « aux N plans »,
  et l'etat vide ne dit plus que les mouvements sont reserves aux photos.
- **Rollout** : image `b3-video-motion-20260803`, revision **`00010-trj`**.
  Verifie sur le service reel : 9 mouvements, 29 cibles `xfade`, 20 filtres,
  `errorCount: 0`, `/render` a 401.

## Journal — 2026-08-03 (lot B3, 1re tranche — trois mouvements de plus)

- **`src/features/vibefx-studio/video/model/mediaModel.js`** : trois presets de
  plus (`drift-down`, `orbit`, `bounce`) et **deux generalisations** du modele,
  qui gardent la forme « deux cadrages + une courbe » sur laquelle repose la
  parite : `arc` (ecart perpendiculaire au trajet, nul aux bouts, maximal au
  milieu) et `curve: 'overshoot'` (back-out, qui depasse sa cible avant de se
  poser). Les deux restent un polynome ou un sinus, donc s'ecrivent telles
  quelles dans `zoompan` — c'est le critere qui a fait retenir ces trois
  mouvements et ecarter les quatre autres.
- **`render-service/src/server.js`** : meme courbe et meme bombement en
  expression FFmpeg, table de presets etendue, verrou
  `SUPPORTED_SERVER_IMAGE_MOTIONS` etendu (un id absent fait REFUSER l'export, ce
  n'est pas un repli silencieux), et **`/capabilities` passe en version 6** en
  rapportant les mouvements acceptes.
- **`scripts/smoke-vibecut-motion-envelope.mjs`** (nouveau) : le probleme I
  verifie sur la trajectoire ENTIERE — 9 presets x 4 intensites x 201 points —
  et la concordance des QUATRE tables de presets. Necessaire parce que le
  controle manuel des deux extremites ne suffit que pour une DROITE : la bosse
  de l'orbite culmine au milieu, le depassement du rebond va au-dela de sa
  cible. Trois sentinelles verifiees.
- **`scripts/check-vibecut-renderer-image-capabilities.mjs`** : verifie desormais
  les mouvements en plus des cibles `xfade` et des filtres. Meme angle mort que
  celui referme au lot B3b — le controle precedent ne disait rien des nouveaux.
- **`scripts/smoke-vibecut-motion-preview-parity.mjs`** : 12 cas au lieu de 6,
  chaque nouveau mouvement a DEUX intensites, et l'assertion de courbe distingue
  maintenant le depassement du smoothstep au lieu d'exiger le smoothstep partout.
- **`src/features/vibecut/data/motionCatalog.js`** : les trois passent de
  `planned` a `available`. **9 disponibles, 4 annonces.**
- **`functions/src/videoExport.js`** et **`export/exportManifest.js`** : tables
  completees.
- **Rollout** : image `b3-motions-20260803`, revision **`00009-8b7`**. Verifie
  sur le service reel : `capabilitiesVersion 6`, 9 mouvements sur 9, 29 cibles
  `xfade`, 20 filtres, `errorCount: 0`, `/render` a 401.

## Journal — 2026-08-03 (lot B2 — de vraies videos dans les aperçus)

- **`src/features/vibecut/library/useLibraryMedia.js`** (remplace
  `useLibraryImages.js`, supprimé) : quatre étages, **vidéos du projet → photos
  du projet → clips de démonstration → repli dessiné**. Les vidéos passent devant
  les photos même quand une photo arrive plus tôt dans le montage.
- **`library/librarySourceOrder.js`** : la règle d'ordre, **module pur, zéro
  import**, comme `data/styleRecipes.js`. Isolée parce que c'est la seule
  décision du lot qui puisse être fausse sans que l'écran ait l'air cassé.
- **`library/libraryFallbackScene.js`** : les deux scènes dessinées, extraites
  sans changer un pixel. Elles ont maintenant **deux** lecteurs — le repli à
  l'écran et le générateur de clips — ce qui est tout l'intérêt de l'extraction.
- **`library/libraryMediaManifest.js`** : droits des clips. Un clip non déclaré
  n'est pas chargé, et un clip sans licence ni fichier est rejeté.
- **`library/librarySourceFreeze.js`** : hors de la boucle, la vignette dessine
  une **copie** de la source. Imposé par un test (bug 53) : sans elle, le rush
  continuait de tourner sous un scrub arrêté et le bypass comparait deux instants
  différents du plan.
- **`scripts/build-vibecut-library-demo-clips.mjs`** : rejoue les scènes du repli
  dans un Chromium sans fenêtre et les encode. **2 clips, 720p, 2 s, 77 Ko au
  total** pour un plafond de 1,5 Mo. Sortie dans
  **`public/assets/vibecut-demo/`**.
- **`scripts/smoke-vibecut-library-media.mjs`** : droits, présence des fichiers,
  poids, 6 règles d'ordre. Entré dans `test:vibecut-library` et
  `test:vibecut-ui-v2`.
- **`scripts/smoke-vibecut-library-b2.spec.cjs`** : 4 tests navigateur. Ils
  existent parce que les 26 tests précédents passaient **à l'identique** avec des
  images fixes — une vignette de transition bouge de toute façon. Vérifiés **en
  échec** (4 sur 4) quand on casse la chaîne de repli. Suite 60 → **64**.
- **`library/LibraryScreen.jsx`** : `data-media-kind` écrit dans le DOM — la
  seule chose qui distingue une bibliothèque vivante d'une bibliothèque retombée
  sur son dessin.
- **`adapters/useScenes.js`** : les scènes exposent `mediaUrl`, pas seulement
  leur miniature.
- **Décision qui s'écarte du plan** : les clips sont **générés**, pas pris chez
  Mixkit ou Pexels. Droits (ils sont servis à tous les visiteurs) et cohérence
  (ils ont par construction l'aspect du repli). Passer à du vrai rush est un
  changement de données.

## Journal — 2026-08-29 terdecies (le blanc des enseignes : `powV11` corrige EN PLACE)

**Ce qui a change dans l'arbre** : `visionPresets.js` (`construirePowV2` accepte
un SECOND melangeur pour les niveaux clairs ; `powV11` corrige en place, a la
demande du porteur du projet — aucun preset de plus),
`scripts/smoke-vision-preset.mjs` (+3 verifications, 328 au total).

**Le symptome**: « le blanc des enseignes tourne au gris, alors que le sien est
propre ». **Deux hypotheses ecartees par la mesure avant de trouver la bonne**:

- *la LUT 33^3 echantillonnerait mal une rotation forte pres du gris*: non — la
  fonction pure et la LUT donnent la meme dispersion (8,34 contre 8,13) ;
- *le garde-fou de chroma couperait en plein dans les blancs*: non plus — 8 %
  seulement de ces pixels sont dans sa zone de transition. Et surtout, **nos
  blancs ne sont pas plus taches que les siens**: ecart-type 8,1 contre 20,4.

**La vraie cause**: nos blancs sont DESATURES. Chroma 14,2 contre ses 18,6, a\*
-0,95 contre ses +1,83. Un blanc neutre et sombre se lit « gris »; un blanc
creme se lit « propre ». Et la cause de la desaturation, c'est **ma correction du
sol de `powV9`**: elle passe par les secteurs chauds du melangeur (rotation +19
et +33, chroma x0,50 et x0,65) — et les enseignes partagent ces memes secteurs.

**Sa regle a lui depend du NIVEAU.** Mesure sur 122 000 pixels (teinte Lab
55-105, chroma > 10, son degrade retire de sa sortie):

| L d'entree | teinte | chroma |
|---|---|---|
| 0 - 55 | 70 -> 125 | **x0,52** |
| 55 - 70 | 84 -> 73 | **x1,01** |
| 70 - 100 | 86 -> 84 | **x1,26** |

Le sol sombre est tourne de +50 degres et desature de moitie; les enseignes
claires ne sont pas tournees et gagnent un quart de chroma. **Une table indexee
par la seule teinte ne sait pas faire les deux.**

**Le melangeur a donc deux jeux**, un sombre et un clair, fondus entre L 45 et
65. Absent, le second vaut le premier: aucun preset existant ne bouge (verifie
par test). Ajuste sur les 14 174 pixels chauds et clairs de la photo, et sur les
deux SEULS secteurs que la mesure soutient — en ajuster trois depasse la cible
(chroma 19,4 contre 18,6) et demande -35 degres sur le troisieme sans aucun
appui.

**Controle croise**: les valeurs trouvees par l'ajustement (-19,4 / x1,00 et
-4,7 / x1,29) retombent d'elles-memes sur la mesure directe (-11 / x1,01 et
-2 / x1,26). Deux chemins independants, le meme resultat.

**Resultat**: blancs a chroma **18,7** contre ses 18,6 et a\* **+1,80** contre
ses +1,83 — et le sol ne bouge pas d'un degre (teinte 126, la sienne).

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 328/328.

## Journal — 2026-08-29 duodecies (`powV11` : le dernier point de blanc, et la preuve du reste)

**Ce qui a change dans l'arbre** : `visionPresets.js` (+`powV11`, 31e preset),
`scripts/smoke-vision-preset.mjs` (+10 verifications, 325 au total),
`scripts/verifier-presets-sur-paires.mjs`.

**La question posee**: reste-t-il du blanc a aller chercher ? J'avais repondu
« non, c'est son masque ». **La mesure dit: un cinquieme etait recuperable, et
c'etait ma grille de recherche qui l'avait manque.**

| | pente reelle | blancs | fissures | fidelite des niveaux |
|---|---|---|---|---|
| `powV10` | 1,52 | 57,5 | 7,67 | 0,88 L\* |
| **`powV11`** | **1,59** | **58,7** | **7,95** | 0,90 L\* |
| son rendu | — | **61,0** | **8,14** | — |
| la source | — | — | 6,82 | — |

+1,2 point de blanc, et les fissures restent SOUS les siennes. La borne de pente
n'a pas eu a bouger: au-dela de 1,6 l'optimum ne remonte plus — la fidelite des
niveaux se degraderait ailleurs plus qu'elle ne gagnerait ici.

**ET LE RESTE — 2,3 POINTS — EST BIEN SON MASQUE, CETTE FOIS DEMONTRE.** Au MEME
niveau d'entree (L > 72), sa sortie vaut:

    48,6  en haut du cadre
    62,1  sur la bande des enseignes
    60,8  en bas

**Treize points d'ecart pour une meme entree, selon l'endroit.** Une courbe rend
une valeur par niveau: elle prend la mediane, et les 2,3 points qui manquent
sont exactement ce que cette mediane coute. Aucune table de couleurs ne les
rendra.

**Lecon**: « c'est le masque » est une conclusion qui se DEMONTRE (meme entree,
sorties differentes selon l'endroit), pas une explication qu'on invoque quand
un ajustement plafonne. Ici elle etait vraie a 66 % et servait a couvrir une
grille de recherche trop grossiere.

Seule la COURBE change; virage, melangeur et ciel sont ceux de `powV9` et
`powV10` au chiffre pres (verifie par test).

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 325/325.
**`powV11` attend le regard du porteur du projet.**

## Journal — 2026-08-29 undecies (`powV10` : les blancs des enseignes, et les fissures)

**Ce qui a change dans l'arbre** : `visionPresets.js` (+`powV10`, 30e preset),
`scripts/smoke-vision-preset.mjs` (+10 verifications, 315 au total),
`scripts/verifier-presets-sur-paires.mjs`.

**Deux defauts de `powV9`, vus a l'oeil sur les enseignes**: le blanc des lettres
virait au gris, et autour du panneau ESSO apparaissaient des « fissures » — de la
matiere absente de son rendu a lui. **Les deux ont la meme cause**, et une seule
mesure la montre. Sur les pixels clairs de la photo (L d'entree > 72, 13 247
points):

| | L median | energie de haute frequence |
|---|---|---|
| la source | 76,5 | 6,82 |
| son rendu | 61,0 | 8,14 |
| `powV9` | **52,9** | **9,43** |
| `powV10` | **57,5** | **7,67** |

`powV9` posait ses blancs 8 L\* trop bas ET amplifiait le detail 1,38 fois la
source quand lui ne l'amplifie que 1,19 fois. Les deux sortent de la meme ligne
de sa courbe: son releve des hautes lumieres arrivait TROP TARD et TROP VITE —
pente 1,83 a L 75-80. **Une pente de p amplifie le bruit de p**, et le bruit d'un
JPEG de capture d'ecran autour d'une enseigne blanche, c'est exactement une
fissure.

**ET UNE ERREUR DE MESURE DERRIERE, la quatrieme de la meme famille**: la
correspondance de niveaux sur laquelle la courbe s'ajuste etait comparee a son
image TELLE QUELLE, degrade compris. Or le degrade est notre etage a nous — il
fallait le retirer de sa cible avant d'ajuster la courbe, sinon la courbe essaie
de rattraper un assombrissement qu'on applique nous-memes ensuite.

**Une fois la cible corrigee, l'optimum n'a plus besoin d'etre raide**: sa pente
maximale tombe a 1,52 TOUTE SEULE — la borne de 2,2 ne mord meme plus. La
correspondance de niveaux est meilleure (0,88 L\* contre 0,97), les blancs
montent a 57,5, et l'energie de haute frequence tombe SOUS la sienne.

Seule la COURBE change: virage, melangeur et regle du ciel sont ceux de `powV9`
au chiffre pres (verifie par test).

**Ce qui reste**: 3,5 L\* sur les blancs. C'est encore son masque — il eclaircit
le sujet, et les enseignes en font partie.

**Le dE76 median passe de 2,12 a 2,37**, et c'est la troisieme fois de la serie
qu'une mediane bouge dans le mauvais sens pendant que l'image s'ameliore: les
enseignes pesent 3,5 % des pixels, et l'oeil ne regarde qu'elles.

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 315/315.
**`powV10` attend le regard du porteur du projet.**

## Journal — 2026-08-29 decies (`powV9` : le sol degris, et deux erreurs de MESURE)

**Ce qui a change dans l'arbre** : `visionPresets.js` (+`powV9`, 29e preset),
`src/features/vibefx-studio/hooks/useStudioFilters.js` (+`degradeBas: 0` dans
`DEFAULT_FILTERS`, qui manquait), `scripts/smoke-vision-preset.mjs`
(+10 verifications, 305 au total), `scripts/verifier-presets-sur-paires.mjs`.

**`powV8` annoncait le sol « cale » et il ne l'etait pas.** Son sol a lui est
gris-bleu (teinte Lab 122), le notre restait a 90 — marron, et l'oeil le voyait
tout de suite. Les deux causes sont des erreurs de MESURE, pas de reglage, et
elles se reproduiront:

**ERREUR 1 — un sous-ensemble qui n'en etait pas un.** Toutes les mesures de
couleur du projet passent par des BLOCS PLATS a faible chroma, pour ne pas
compter les contours. Sur du beton MOUILLE, ce filtre garde les flaques lisses
et jette tout le reste — c'est-a-dire l'essentiel de ce que l'oeil voit. Mesure
sur ce sous-ensemble: a\* -1,68 contre ses -1,63, « cale ». Mesure sur TOUS les
pixels du sol: a\* 0,00 contre ses -1,99. **Le filtre qui protege d'un biais en
fabriquait un autre.**

**ERREUR 2 — la correction indexee au mauvais niveau.** Le virage se pose AVANT
le degrade du bas, et le degrade divise ensuite la luminosite du sol par trois.
En attribuant la correction au niveau mesure A L'ARRIVEE (L 6,5) au lieu de
celui ou elle s'applique (L 11,5), elle partait dans la mauvaise ancre. Trois
tentatives ont echoue sur ce seul point.

**CE QUE `powV9` FAIT, une fois les deux corrigees.** Le virage, reajuste sur
tous les pixels et indexe au bon niveau, monte le sol de 90 a 102 puis PLAFONNE:
a ce niveau il partage son ancre avec le CIEL, qui lui est deja juste, et un
virage indexe par le NIVEAU ne sait pas separer deux teintes qui partagent un
niveau. Le melangeur, indexe par la TEINTE, finit le travail sur les deux
secteurs chauds.

**L'ORDRE COMPTE, et c'est l'enseignement du lot.** Resolu AVANT le virage, le
melangeur demandait +40 et +55 degres. Ces valeurs sont vides de sens: le
garde-fou de chroma (smoothstep 4 -> 11) n'en laisse passer qu'un sixieme a la
chroma du sol, mais les appliquerait EN ENTIER a un jaune franc. Resolu APRES,
il demande +18,8 et +33,5 — la moitie — et **le garde-fou du projet n'a pas eu a
bouger d'un pouce**: l'amplification dans un voile reste a 2,39x pour une borne
a 3,63x. Un garde-fou qu'on est tente de baisser est souvent le signe qu'on
corrige au mauvais endroit.

**Resultat** : sol a la teinte 123 contre sa cible 122, rouge et ciel inchanges
(controles par test), et sur sa photo de nuit **2,12 de dE76** — le meilleur de
toute la serie:

| preset | nuit |
|---|---|
| rien | 17,24 |
| `powV2` | 8,52 |
| `powV5` | 2,92 |
| `powV7` | 2,42 |
| `powV8` | 2,45 |
| **`powV9`** | **2,12** |

**RESERVE**, plus lourde que celle de `powV8`: ses deux secteurs chauds sont
tournes de 19 a 33 degres et desatures de moitie. Sur un beton chaud a forte
chroma, la rotation mesuree vaut +46 degres — sur une photo ou l'ocre ou le
jaune est le sujet (sable, bois, mur), ce preset le verdit.

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 305/305.
**`powV9` attend le regard du porteur du projet.**

## Journal — 2026-08-29 nonies (`powV8` : le curseur qui manquait au melangeur)

**Ce qui a change dans l'arbre** : `visionPresets.js` (`melangeurLab` porte
desormais une LUMINANCE par teinte, +`powV8`, 28e preset),
`scripts/smoke-vision-preset.mjs` (+11 verifications, 295 au total),
`scripts/verifier-presets-sur-paires.mjs`.

**Deux ecarts restaient a `powV7`**, vus a l'oeil puis mesures. Aucun ne se
corrigeait avec les leviers existants, et c'est l'interet du lot.

**1. SON ROUGE EST PLUS VIF.** Sur 656 blocs de la moto et de l'element Synergy
(chroma d'entree > 25, teinte Lab < 50): son rendu est a L 19,0 / chroma 46,3,
`powV7` a L 13,2 / 39,6. **L'ecart est d'abord une affaire de LUMIERE.**

Et il ne vient pas de la courbe: mesure au meme moment sur 2 799 blocs, son ciel
bleu est a **0,99** fois notre luminance. Une courbe aurait touche les deux.
C'est donc une **luminance par TEINTE** — le troisieme curseur du melangeur de
Lightroom, que le notre n'avait pas.

Ajoute a `melangeurLab`: chaque ancre porte maintenant [rotation, chroma,
LUMINANCE], et les tables a deux valeurs valent 1 par defaut, donc **aucun
preset existant ne bouge** (verifie par test). Sous le meme garde-fou de chroma
que le reste: un pixel sans teinte fiable ne change pas de niveau, sinon la
regle trace un contour. Mesure: x1,57 sur les rouges et oranges a forte chroma.

Resultat: L 18,3 / chroma 47,9 contre ses 19,0 / 46,3.

**2. SON SOL EST GRIS-BLEU, LE NOTRE TIRAIT AU MARRON.** `powV7` le laissait a
la teinte 105 quand la sienne est a 127, et son commentaire disait deja pourquoi
la correction n'arrivait pas. Ici le virage se mesure sur la sortie FINALE —
degrade compris — contre son image telle quelle, par niveau de SORTIE. Ce qu'il
demandait etait net: a* -1,02 sur 1 568 blocs a L 0-4, -0,73 sur 1 088 a L 4-8.

**Et un arbitrage a l'interieur.** Les valeurs brutes de l'ajustement mettaient
la premiere ancre du virage a (-1,96 / +2,00), ce qui faisait ressortir un noir
PUR a 1,34/255 au lieu de 0. L'invariant du projet a gagne: ancre ramenee a 0.
Mais le fondu vers zero reprenait la moitie du gain (sol a 110 au lieu de 120),
alors l'ancre L=5 a ete **RESOLUE** sous la contrainte — -5,90 au lieu de -2,90.
Ce n'est pas un chiffre choisi, c'est la solution d'une equation a une inconnue.
Cout: 0,03 de dE76.

Resultat: sol a a* -1,68 contre ses -1,63.

**Resultat global**, dE76 median contre son rendu, chaine complete:

| preset | nuit | brouillard | restaurant |
|---|---|---|---|
| `powV7` | **2,42** | 5,18 | 17,64 |
| `powV8` | 2,45 | 5,17 | **13,88** |

Le dE76 de la nuit bouge a peine (2,42 -> 2,45) et c'est le point: ce lot ne
cherchait pas a baisser une moyenne, il corrigeait deux choses que l'oeil voit
et qu'une moyenne noie. Le restaurant, lui, gagne 3,8 au passage — la correction
des ombres lui profite.

**RESERVE**: la luminance x1,57 sur les rouges est le levier le plus fort de la
famille, et le a* -3,2 des ombres se verra sur toute autre photo. `powV8`
reproduit UNE image.

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 295/295.
**`powV8` attend le regard du porteur du projet.**

## Journal — 2026-08-29 octies (`powV7` : les LED rallumees, et un residu nomme)

**Ce qui a change dans l'arbre** : `visionPresets.js` (+`powV7`, 27e preset),
`scripts/smoke-vision-preset.mjs` (+12 verifications, 284 au total),
`scripts/verifier-presets-sur-paires.mjs` (il REJOUE desormais le degrade, sinon
`powV6` et `powV7` seraient juges sur la moitie de ce qu'ils font),
`scripts/mesurer-paires-powlisher.mjs` (les blocs portent leur position).

**Deux defauts restaient a `powV6`**, tous deux vus a l'oeil AVANT d'etre
mesures — c'est la quatrieme fois de la serie, et ca vaut d'etre note.

**1. LES LED.** A un niveau d'entree de 75-85, son image est **22,6 L\* plus
claire** que `powV6`; a 55-65 l'ecart n'est que de **1,0**. Un seul endroit de
l'echelle, et c'est celui que l'oeil regarde.

Deux changements pour y repondre:

- **la courbe s'ajuste desormais sur la CORRESPONDANCE DE NIVEAUX**, chaque
  tranche comptant pareil (ponderee par la racine de son effectif), et non plus
  sur la mediane du dE de l'image. Ces LED pesent 3,5 % des blocs: une mediane
  ne les voit pas. C'est une lecon generale — **la mediane d'une image n'est pas
  le regard de celui qui la regarde**;
- **un parametre de plus**: un releve des hautes lumieres qui n'agit qu'au-dessus
  d'un seuil (0,75 a partir de L 62, sur 38 L\* de large). Une epaule globale
  releve tout, elle ne sait pas faire ce virage-la.

**ET UNE BORNE QUI A SERVI.** Laisse libre, ce releve montait a une pente de
**3,62 L\* par L\*** et ramenait l'ecart des LED a +4,1 — mais il faisait
ECHOUER le test « amplification dans un voile »: **3,71x contre 3,63 autorise**.
Une pente de p amplifie le bruit de p. Pente bornee a 2,2: l'amplification
retombe a **2,39x** et l'ecart des LED s'arrete a **+9,3**. Le chiffre parfait
n'a pas gagne — troisieme fois dans cette serie.

**2. LE SOL, NON CORRIGE, et il faut dire pourquoi.** Son sol est a a\* -1,99 /
b\* +2,76, le notre a -0,37 / +3,40: a chroma quasi egale (3,4 contre 3,7),
c'est une difference de TEINTE de 29 degres — le sien plus vert, le notre plus
jaune. Deux raisons, mesurees:

- le melangeur ne le voit pas: a chroma 3,7 le garde-fou du projet
  (smoothstep 4 -> 11) est a zero, et l'ouvrir reveillerait la teinte dans les
  voiles — le contour que trois presets ont deja paye en 2026-08-12;
- le virage est une fonction du NIVEAU: corriger le sol veut dire corriger toute
  sa tranche, et le reste de cette tranche ne le demande pas. Deux passes ont
  ete tentees pour l'y forcer — compensation de l'attenuation du degrade (le
  virage se pose AVANT lui, qui le divise ensuite par six) et exclusion des
  blocs quasi eteints (residu nul par construction, ils noyaient la mediane).
  Le b\* est passe de 3,66 a 3,40 et s'est arrete la.

Cette difference-la est **encore positionnelle**: elle appartient a son masque.
1,7 en Lab sur une zone sombre — c'est le residu, et il est nomme.

**Un garde-fou a aussi servi**: l'ajustement voulait un degrade de 82, or le
plafond du mode sur est 80. Un preset qui demande plus se fait ramener EN
SILENCE et n'annonce pas ce qu'il rend; le smoke l'a attrape. Cout nul, la
courbe est plate a cet endroit (76 / 82 / 84 sur les trois tours).

**Resultat**, dE76 median contre son rendu, chaine complete (le verificateur
rejoue le degrade):

| preset | nuit | brouillard | restaurant |
|---|---|---|---|
| rien | 17,24 | 7,91 | 10,41 |
| `powV2` | 8,52 | **2,34** | **2,81** |
| `powV5` | 2,92 | 23,17 | 21,57 |
| `powV6` | 2,48 | 26,12 | 24,58 |
| **`powV7`** | **2,42** | 5,18 | 17,64 |

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 284/284.
**`powV7` attend le regard du porteur du projet.**

## Journal — 2026-08-29 septies (`powV6` : le premier effet de POSITION mesure)

**Ce qui a change dans l'arbre** : `src/features/vibefx-studio/utils/canvasUtils.js`
(+`applyDegradeBas`), `src/features/vibefx-studio/engine/studioRenderer.js`
(etage 7 bis), `src/features/vibefx-studio/utils/visionColorScience.js` (cle et
bornes `degradeBas`), `src/features/vibeos/vision/useVisionEditor.js` (le preset
peut le porter, et le panneau l'annonce), `visionPresets.js` (+`powV6`, 26e
preset), `scripts/smoke-vision-preset.mjs` (+9 verifications, 272 au total).

**La question.** Une fois `powV5` pose, ce qui restait sur sa photo de nuit
n'etait plus une couleur. Ecart en diaphragmes, du haut vers le bas du cadre:

      +0,05   <- le plafond de la station: juste au centieme pres
      +1,0    <- la station et la moto: il est plus CLAIR
      -1,1
      -2,5    <- le sol: il est BIEN plus sombre

**LE VIGNETAGE NE PEUT PAS REPONDRE A CA, et c'est mesure**: il est RADIAL, donc
il assombrirait aussi le haut, qui est deja juste. `powV5` seul fait 5,41 de
dE76; `powV5` plus vignetage fait 5,46 a 5,99 selon la dose, de 10 a 100. Le
vignetage EMPIRE le rendu, quelle que soit la force. Une courbe plus contrastee
ne fait pas mieux non plus: une recherche large sur trois parametres (pente,
decalage, epaule) retombe sur 3,08 — le meme chiffre que `powV5`. **3,08 est le
plancher d'une table de couleurs sur cette image.**

**L'effet ajoute.** `applyDegradeBas`: une rampe verticale qui part du MILIEU du
cadre et descend jusqu'en bas, en lumiere lineaire, sans la protection des
hautes lumieres du vignetage (un degrade de Lightroom est un curseur
d'exposition pose sur un masque, il n'epargne rien). Un seul curseur: 100 =
quatre diaphragmes au bas du cadre.

Le point de depart de la rampe a ete CHERCHE, pas choisi: de 0,40 a 0,60 de la
hauteur l'ecart obtenu va de 3,10 a 3,03. La courbe est plate, donc le milieu
est aussi bon que le meilleur — un parametre de moins, et rien de perdu.

**UN PIEGE ATTRAPE PAR SON PROPRE TEST.** La premiere version quantifiait le
gain en 64 paliers, comme le fait le vignetage. Mesure sur un aplat: 4/255
d'ecart entre deux lignes voisines, et **ce chiffre ne baissait pas quand
l'image grandissait** (4/255 a 101 lignes comme a 1 200). Ce n'etait donc pas la
pente du degrade, c'etait la marche de la quantification — une bande. Le gain ne
depend que de la LIGNE: on calcule donc une table par ligne (256 puissances,
2 ms sur 1 200 lignes) et la quantification disparait au lieu d'etre reduite.
Mesure apres correction: 1/255 a 401 comme a 1 200 lignes.

**Resultat**, chaine complete de l'app (LUT + effets spatiaux), sur sa photo de
nuit: `powV2` 10,37, `powV4` 8,94, `powV5` 5,41, **`powV6` 3,03**.

**RESERVE**: le degrade est un geste de COMPOSITION. Il suppose que le bas du
cadre est un premier plan qu'on veut faire taire. Sur une photo dont le sujet est
en bas, il l'efface. C'est aussi le premier preset du projet a porter un effet
de position: `powlisher-showcase` en portait un (vignetage 8), mais choisi a
l'oeil; celui-ci est mesure, forme comprise.

**Note d'hygiene**: `canvasUtils.js` et `visionRecommendation.js` importaient
`./visionColorScience` sans extension — valide pour le bundler, invalide pour
Node, ce qui empechait tout test d'importer le moteur (le smoke lisait le
fichier en TEXTE pour verifier la loi de la clarte). Extension ajoutee: le
degrade est teste en appelant la vraie fonction.

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 272/272,
`npm run test:vision-filters` vert. **`powV6` attend le regard du porteur du
projet.**

## Journal — 2026-08-29 sexies (`powV5`, et une erreur de niveau corrigee)

**Ce qui a change dans l'arbre** : `src/features/vibefx-studio/utils/visionPresets.js`
(+`powV5`, 25e preset), `scripts/smoke-vision-preset.mjs` (+10 verifications,
263 au total), `scripts/ajuster-preset-sur-paire.mjs` (option `--cadre-entier`),
`scripts/verifier-presets-sur-paires.mjs`.

**L'ERREUR, et elle est de moi.** `powV4` est ajuste sur le PLATEAU du masque —
la zone que son masque local ne touche pas. C'etait le bon endroit pour mesurer
sa COULEUR, et ca l'est toujours. Mais j'en avais aussi tire le NIVEAU du
preset, et la c'etait une DECISION deguisee en mesure. Les memes chiffres se
lisent de deux facons:

  A) il a assombri les BORDS               -> le niveau est celui du centre
  B) il a assombri TOUT puis rattrape le
     SUJET                                 -> le niveau est bien plus bas

Une seule photo ne tranche pas. Ce qui tranche, c'est le BUT: pour ressembler a
son image, il faut la courbe qui minimise l'ecart sur le CADRE ENTIER. Elle
donne 3,08 de dE76 median la ou `powV4` est a 7,15 — plus de deux fois mieux.
La lecture B est donc la bonne pour cet usage, et c'est ce que voyait l'oeil du
porteur du projet avant que la mesure ne le dise: « tout est plus sombre chez
lui, le sol comme le ciel ».

**LECON GENERALE, notee dans `pieges-connus.md`**: choisir la zone sur laquelle
on ajuste, c'est deja choisir le resultat. Une mesure impeccable sur la mauvaise
zone reste une erreur, et elle ne se voit pas dans les chiffres — seulement a
l'oeil.

**`powV5`** reprend donc les tables de couleur de `powV4` telles quelles (elles,
elles sont mesurees au bon endroit, masque retire) et ne change que la courbe:
droite en L*, pied doux, plus une EPAULE. a = 0,61, b = -2,0, epaule 1,15, pente
jamais sous 0,30, plafond 141.

  niveau median rendu   son image 8,6   powV5 10,3   powV4 17,4   powV2 19,0
  dE76 sur sa nuit      powV5 2,92      powV4 7,09   powV3 7,39   powV2 8,52

Sur ses deux autres photos `powV5` est a 23 et 21: c'est un preset de nuit
extreme, et il n'a rien a y faire.

**Ce qui reste et ne se rattrapera pas**: son sujet est plus lumineux que le
notre — c'est l'autre moitie de son masque, il a rattrape la station et la moto
apres avoir tout baisse. Un preset ne sait pas ou est le sujet.

**RESERVE**: `powV5` descend tres bas (un blanc pur atterrit a 141). Il est fait
pour une photo prise CLAIRE et rendue en nuit; sur une photo deja sombre il la
detruit.

**Et une faute d'ecriture, deux fois de suite**: les controles de non-regression
de `powV3` puis de `powV4` portaient des valeurs attendues INVENTEES au lieu
d'etre relevees. Les deux ont echoue alors que le code etait juste. La regle est
dans `pieges-connus.md` depuis le premier; elle vaut d'etre relue.

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 263/263.
**`powV5` attend le regard du porteur du projet.**

## Journal — 2026-08-29 quinquies (`powV4` : la couleur de la nuit, remesuree sous son masque)

**Ce qui a change dans l'arbre** : `scripts/ajuster-preset-sur-paire.mjs` ajoute.
Modifies : `src/features/vibefx-studio/utils/visionPresets.js` (+`powV4`, 24e
preset ; `construirePowV2` accepte maintenant toutes les tables, les trois
densites la partagent), `scripts/smoke-vision-preset.mjs` (+13 verifications,
253 au total), `scripts/verifier-presets-sur-paires.mjs`.

**Pourquoi.** `powV3` reprend la couleur de `powV2` et n'en change que la
densite. La demande etait d'aller plus loin sur cette photo precise: remesurer
la COULEUR dessus.

**Le probleme a resoudre d'abord.** Cette photo porte un masque local. Mesurer
la couleur a travers lui reviendrait a prendre un assombrissement local pour un
virage. La chaine estime donc le masque cellule par cellule contre un preset de
reference, le ramene a son PLATEAU, corrige son rendu de cet ecart, ajuste, puis
re-estime le masque avec le resultat. Trois tours.

**ET UNE REGLE QUI COMPTE AUTANT, notee dans `pieges-connus`:** la couleur ne
s'ajuste QUE la ou on a peu corrige (un diaphragme au plus). Rebrillanter de
quatre diaphragmes un JPEG quasi noir ne restitue pas sa couleur, ca fabrique du
bruit amplifie. Sans cette regle, le melangeur voulait tourner l'orange de +32
degres sur la foi de 1 065 blocs — qui n'etaient que du sol remonte. Avec, il
n'en reste 44, et le secteur est ecarte faute de matiere. 5 645 blocs sur 10 751
servent a la couleur.

**Ce que la mesure donne.** Courbe plus basse (`L = 0,87 L - 5,0` contre
`0,99 L - 6,5`), plafond 210. Un virage DIFFERENT, et c'est la trouvaille: ses
bas-tons de nuit sont beaucoup moins chauds que sur ses deux photos de jour —
b* +2,96 a L 30 contre +4,67. Un ciel plus SOURD: chroma 0,611 au lieu de 0,85,
sur 1 183 blocs, pour un point d'arrivee inchange (192 degres TSL). Une scene
eclairee aux LED n'est pas une scene de jour, et son traitement ne la rechauffe
pas pareil. Trois secteurs de teinte seulement (22,5 / 37,5 / 82,5 degres Lab,
263 / 175 / 434 blocs) ont assez de matiere pour bouger; les autres gardent
`powV2`.

**Resultat**, dE76 median contre son rendu tel quel, sur la zone que son masque
ne touche pas — la seule ou un preset puisse etre juge:

| preset | zone jugeable | cadre entier |
|---|---|---|
| **`powV4`** | **3,68** | 7,09 |
| `powV3` | 4,19 | 7,39 |
| `powV2` | 4,68 | 8,52 |
| `powlishermain` | 9,62 | 15,08 |

Sur le cadre ENTIER, l'ecart entre `powV4` et `powV3` se resserre: `powV3` y
gagne des points pour une mauvaise raison — il assombrit tout, donc il se trompe
moins la ou l'autre a noirci a la main. Ce n'est pas une meilleure ressemblance,
c'est une erreur qui en compense une autre.

**RESERVE, la plus lourde du projet**: UNE photo, UN sujet, UNE lumiere. `powV2`
tient sur trois scenes sans rapport; `powV4` ne tient que sur celle-la. Il
existe parce qu'il a ete demande explicitement, et il ne doit pas etre lu comme
une mesure de son style.

**Un test a attrape une faute d'ecriture pendant le lot**: le controle de non-
regression de `powV3` portait une valeur attendue INVENTEE au lieu d'etre
relevee. Il a echoue, et c'etait lui qui avait raison — `powV3` est bit a bit
identique avant et apres le partage de la fabrique.

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 253/253. Regarde a
l'oeil sur la paire de nuit. **`powV4` attend le regard du porteur du projet.**

## Journal — 2026-08-29 quater (`powV3`, et le masque qu'on a trouve sous la photo de nuit)

**Ce qui a change dans l'arbre** : `src/features/vibefx-studio/utils/visionPresets.js`
(+`powV3`, 23e preset ; `powV2Transform` devient la fabrique `construirePowV2`,
les deux densites la partagent — seule la courbe change),
`scripts/smoke-vision-preset.mjs` (+9 verifications, 240 au total),
`scripts/verifier-presets-sur-paires.mjs` (+`powV3` aux candidats),
`docs/paires-avant-apres-powlisher-2026-08-29.md`.

**La question posee.** `powV2` rend le brouillard et le restaurant quasi
indiscernables des siens a l'oeil; sur la station de nuit l'ecart reste visible.
Faut-il un preset de plus pour aller chercher celle-la ?

**LA TROUVAILLE DU LOT : ce qui reste n'est pas un preset, c'est un MASQUE.**

Le test qui tranche, et il ne demande aucune hypothese: un preset est une
FONCTION, donc la meme couleur d'entree doit donner la meme sortie ou qu'elle
soit. On regroupe les pixels par couleur d'entree exacte (pas de 8 niveaux) et
on compare haut contre bas: restaurant -0,0 L* sur 89 couleurs, brouillard
-0,3 L* sur 67 (gauche/droite: son haut et son bas n'ont aucune couleur commune),
NUIT -4,8 L* sur 30. Cas extreme: la couleur 204,188,164, presente 3 027 fois,
sort a L* 64,8 en haut du cadre et a L* 2,8 en bas. Meme entree, 62 L* d'ecart.

La FORME de ce qu'il a assombri epouse le contour de la station (l'arche, la
marquise, la pompe restent a 0,7-0,8 du niveau d'entree, tout le reste tombe a
0,4) et le sol descend en rampe continue de 0,29 a 0,09. C'est le panneau
MASQUAGE de Lightroom mobile — selection du sujet ou de l'arriere-plan, plus un
degrade lineaire par le bas.

PIEGE ATTRAPE EN ROUTE, note dans `docs/pieges-connus.md`: le premier controle
« meme couleur, hauteurs differentes » ne prouvait rien, parce qu'il n'avait
quasi aucun echantillon dans le bas du cadre (14 blocs sur une bande, 1 sur
l'autre). Un controle sans echantillon dans la zone suspecte ne controle rien.

Carte de l'ecart d'exposition entre son rendu et `powV2` sur cette photo, en
diaphragmes, huit bandes du haut vers le bas:

```
    -1,49  -1,44  -1,31  -0,98  -1,14     <- le plafond de la station
    -1,54  -1,46  -0,23  -0,25  -1,21
    -0,76  -0,42  -0,18  -0,25  -0,49
    -0,54  -0,30  -0,03  -0,03  -0,27     <- le centre: powV2 est JUSTE
    -1,50  -0,43  +0,14  -0,11  -0,51
    -2,35  -1,79  -1,18  -1,05  -1,09
    -3,20  -3,06  -2,39  -1,99  -1,50
    -3,94  -4,06  -3,93  -3,57  -3,04     <- le sol: QUATRE diaphragmes
```

Au centre l'ecart est nul, en bas il vaut quatre diaphragmes. Une LUT ne sait pas
OU est le pixel: elle ne peut pas porter ca.

**Et ce n'est pas un vignetage de son preset**: le meme calcul sur les deux
autres paires donne 0,00 et 0,06 diaphragme d'ecart centre-bords. Le degrade
n'existe que sur cette photo-la. Notre vignetage ne peut pas s'y substituer non
plus — profil incompatible (le notre est plat jusqu'au rayon 0,6, le sien tombe
des 0,45; 0,44 diaphragme d'erreur au meilleur reglage) et surtout ASYMETRIE:
au meme rayon le sien vaut -1,4 en haut et -3,9 en bas, ce qu'un vignetage
radial ne peut pas faire.

**Ce qui restait de mesurable**, dans la zone non masquee (rayon < 0,5): un ecart
qui ne depend que du NIVEAU, -0,3 a -0,6 diaphragme dans les medians et +0,2
dans les noirs profonds, sur 62 645 points. C'est une densite, et c'est
`powV3`: `L = 0,840 L - 4,25`, meme famille a deux parametres que `powV2`,
erreur moyenne 0,85 L*, plafond a 205 (contre 236 pour `powV2`, et a comparer
aux 209 et 181 d'`ambre-nuit-1` et `-2`).

**Sa couleur est celle de `powV2` au chiffre pres**, et le smoke le verifie a
NIVEAU DE SORTIE EGAL — sinon on mesurerait la courbe une seconde fois au lieu
de la couleur. Ecart maximal 0,24 en a*b*. C'est la regle de la famille, deja
appliquee a `ambre-nuit-1` et `ambre-nuit-2`.

| preset | nuit | brouillard | restaurant |
|---|---|---|---|
| `powV2` | 8,52 | **2,34** | **2,81** |
| `powV3` | **7,39** | 8,58 | 4,58 |

Le gain sur la nuit est modeste (8,52 -> 7,39) precisement parce que le reste est
le masque: assombrir tout le cadre corrige le sol en abimant le centre.

**RESERVE**: `powV2` est cale sur trois photos, `powV3` sur une seule, et sur sa
partie non masquee. Assez pour une DENSITE — « combien plus sombre » n'a qu'une
reponse par photo — pas pour une couleur.

**Ce qu'il faudrait vraiment**: un outil de degrade LOCAL, par photo, dans
Vision. Meme constat que l'etage de tonalite adaptatif deja au `todo.md`, vu
sous un autre angle: une table de couleurs n'a pas de memoire, et elle n'a pas
de carte.

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 240/240. Regarde a
l'oeil sur la paire de nuit. **`powV3` attend le regard du porteur du projet.**

## Journal — 2026-08-29 ter (`powV2` : la courbe qui manquait a `powlishermain`)

**Ce qui a change dans l'arbre** : `scripts/verifier-powlishermain.mjs` renomme
en `scripts/verifier-presets-sur-paires.mjs` (il sort desormais DEUX tableaux).
Modifies : `src/features/vibefx-studio/utils/visionPresets.js` (+`powV2`, 22e
preset ; `mainMelangeur`/`mainBandeCiel` factorises en `melangeurLab`/
`bandeCielLab`, partages par les deux ; aucun autre preset touche),
`scripts/smoke-vision-preset.mjs` (+17 verifications, 231 au total),
`docs/paires-avant-apres-powlisher-2026-08-29.md`.

**Pourquoi.** `powlishermain` refusait de toucher a la luminosite, et la mesure
lui donnait raison : les trois retouches ne different que par un gain (-1,85 /
-0,22 / -0,56 EV), donc un curseur d'exposition. **Regarde a l'ecran, ce refus
etait un defaut** : applique a ses trois AVANT, le rendu restait nettement plus
clair et plus plat que son APRES, sur les trois. Le porteur du projet l'a
constate en rejouant les trois paires dans l'app. Lecon generale : un ecart
mesure a exposition libre ne dit RIEN de ce que l'utilisateur voit.

**Ce qui a ete cherche.** Aucune courbe ne peut passer par les trois — a L* 42
d'entree il sort 19,8 / 39,5 / 34,9, et une fonction ne rend pas trois valeurs
pour une entree. On cherche donc le meilleur compromis, en minimisant le dE76
median des trois paires a la fois **sans exposition libre**. Trois familles
essayees :

| famille | dE76 moyen | verdict |
|---|---|---|
| 21 noeuds libres | 3,21 | **refusee** : courbe en zigzag (plateaux et sauts), surapprend sur trois photos, poserait des bandes |
| droite libre (L = 1,05 L - 10) | 3,84 | **refusee** : envoie a zero tout sous L* 9,5 — le volant et la console du brouillard perdent leur dessin |
| droite + pied doux, point noir mesure, pente >= 0,30 | 4,51 | **retenue** |

Le meilleur chiffre n'a pas gagne, deux fois. C'est le point du lot : **un
preset n'a pas le droit de detruire de la matiere pour gagner un dixieme
d'ecart**, et une courbe libre sur trois photos n'est pas une mesure.

Le point noir, lui, n'est pas un reglage : ses trois photos posent leur tranche
L* 0-5 a 2,4 / 3,2 / 0,1, et la premiere ancre est ramenee a 0 parce qu'un
facteur commun aux trois canaux ne peut pas eclaircir un pixel deja noir —
pretendre le contraire faisait exploser le gain pres de zero. Cout mesure de ce
choix : 0,05 de dE76 sur une seule paire.

La courbe s'applique comme une EXPOSITION — un facteur commun aux trois canaux
en lumiere lineaire — et pas sur le seul L\*. Ce n'est pas equivalent :
assombrir retire de la chroma, baisser le L* en Lab la laisserait intacte et
rendrait des couleurs criardes. Le virage et le melangeur ont donc ete
reajustes sous la courbe (les rouges remontent de x1,03 a x1,14, les verts
descendent de x0,40 a x0,36).

**Resultat**, dE76 median, **sans** exposition libre — ce qu'on voit dans l'app :

| preset | nuit | brouillard | restaurant | moyenne |
|---|---|---|---|---|
| rien | 17,24 | 7,91 | 10,41 | 11,85 |
| **`powV2`** | **8,52** | **2,34** | **2,81** | **4,56** |
| `powlisher-cine` | 11,17 | 3,90 | 5,32 | 6,80 |
| `powlishermain` | 15,08 | 4,36 | 9,44 | 9,63 |

**61,6 % de l'ecart repris**, contre 18,8 % pour `powlishermain`. Le brouillard
et le restaurant tombent au niveau du bruit des captures. La nuit reste a 8,52 :
son edit de nuit est 1,3 EV plus bas que ce qu'une courbe commune peut rendre,
et c'est irreductible sans etage de tonalite adaptatif. Avec exposition libre —
la couleur seule — `powV2` passe aussi devant `powlishermain` (2,61 contre
3,15) : le reajustement sous la courbe a ameliore la couleur elle-meme.

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 231/231. Regarde a
l'oeil sur les trois paires et sur quatre photos peu retouchees, plus un degrade
de ciel a 1:1 : l'ecart moyen entre deux lignes voisines passe de 0,76 a
0,79/255, donc aucune bande ajoutee. **`powV2` attend le regard du porteur du
projet avant d'entrer dans `docs/presets-valides.md`.**

## Journal — 2026-08-29 bis (`powlishermain` : le premier preset cale sur des avant/apres certains)

**Ce qui a change dans l'arbre** : `scripts/aligner-paire-avant-apres.mjs`,
`scripts/mesurer-paires-powlisher.mjs`, `scripts/verifier-powlishermain.mjs` et
`docs/paires-avant-apres-powlisher-2026-08-29.md` ajoutes. Modifies :
`src/features/vibefx-studio/utils/visionPresets.js` (+`powlishermain`, 21e
preset, aucun autre touche) et `scripts/smoke-vision-preset.mjs` (+17
verifications, 214 au total).

**La source.** Le 12 novembre 2025, `@powl_d` repond a un lecteur par trois
posts portant chacun deux captures de son ecran Lightroom : la meme photo avant
et apres. Station-service de nuit, autoroute dans le brouillard, table de
restaurant. **Ce n'est pas la paire ecartee le 2026-08-12** (celle-la etait
passee par une IA generative et avait coute trois presets) : ici la meme image
est des deux cotes, sans autre intermediaire que la dalle et le JPEG de X.
C'est la premiere fois que le projet connait une ENTREE.

**Trois pieges de mesure, tous invisibles dans les moyennes.** Le fond de
Lightroom est NOIR et pas gris : les bandes d'une photo qui n'a pas le format de
l'ecran donnaient 5 300 blocs a zero dans la paire du brouillard, qui ecrasaient
tout le bas de la courbe. La bande grise `#1D1D1D` sous l'image entrait dans le
cadre et donnait 400 blocs identiques des deux cotes. Et une des trois paires
est RECADREE (echelle 1,026, decalage -29 px) : trouvee par correlation sur le
gradient, parce que la couleur — la seule chose qui change — ne peut pas servir
de reference. 43 691 blocs de 8x8 apres nettoyage.

**Ce que la mesure a trouve, et qui contredit ce qu'on croyait.**

1. **Sa courbe ne fait rien.** En lumiere lineaire, les trois retouches sont un
   simple gain : 0,277 / 0,856 / 0,680, soit -1,85 / -0,22 / -0,56 EV. Une fois
   ce gain retire, la courbe qui reste est l'identite a +-2 L* pres sur toute la
   plage. Trois valeurs aussi eloignees ne sont pas un preset : c'est son
   curseur d'exposition. `powlishermain` ne touche donc PAS a la luminosite —
   et c'est la meme chose que dit `todo.md` sous « l'etage de tonalite
   adaptatif », vue par l'autre bout : il ne suit pas la densite de la scene
   avec une courbe, il la suit a la main.
2. **Le « coup de saturation sur les rouges » n'existe pas.** En mesure brute il
   vaut x1,38 ; il disparait des qu'on pose le virage d'abord. Ajouter du b* a
   un rouge le pousse vers l'orange ET lui ajoute de la chroma. C'est le virage
   qu'on voyait. Une fois pose, les rouges sont a x1,03-1,06 : rien.
3. **`powlisher-ciel` avait raison contre `powlisher`.** Son ciel de nuit part de
   223 degres TSL et arrive a 192. C'est exactement la fenetre 190-199 trouvee
   le 2026-08-12 sur son corpus, par une methode sans aucun rapport. Deux
   sources independantes, le meme point d'arrivee : c'est une CONVERGENCE.

**Ce qu'on n'a pas invente.** Rien entre 135 et 250 degres Lab (verts francs,
cyans) ni au-dela de 308 (magentas, roses) : les trois photos y sont muettes, le
melangeur y est a l'identite. Trois photos, c'est une source certaine, ce n'est
pas une source large.

**Resultat mesure**, chaque candidat ayant droit a sa propre exposition libre —
sans quoi le classement mesurerait surtout qui assombrit : dE76 median 6,81 sans
rien, **3,15 avec `powlishermain`**, contre 5,43 pour `powlisher-cine`, 5,49
pour `ambre` et 6,10 pour `powlisher`. **53,8 % de l'ecart de couleur repris**,
et la paire du brouillard tombe a 1,73 — le plancher de bruit des captures. Ce
qui reste est du travail photo par photo : la paire de nuit garde ses hautes
lumieres 17 L* au-dessus de ce qu'un gain seul predit.

**Gates** : `npm run lint` vert, `npm run test:vision-preset` 214/214. Regarde a
l'oeil sur les trois paires (avant / notre rendu / son apres) et sur quatre
photos peu retouchees, plus un degrade de ciel a 1:1 — aucune bande, aucun
contour, amplification dans un voile a -1,33x sous `powlisher`. **Le preset
attend le regard du porteur du projet avant d'entrer dans
`docs/presets-valides.md`.**

Detail chiffre : [docs/paires-avant-apres-powlisher-2026-08-29.md](docs/paires-avant-apres-powlisher-2026-08-29.md).

## Journal — 2026-08-29 (bibliothèque : la grille et le carrousel de la référence)

Refonte du **mouvement** de `/creer/bibliotheque` sur la référence donnée par
l'utilisateur (deux vidéos de `@powl_d`, la grille et la lightbox). L'en-tête
Apple-OS de VibeOS ne bouge pas : c'est l'atmosphère des photos qui change.
Fichiers touchés : `library/LibraryScreen.jsx`, `library/Lightbox.jsx`,
`library/library.module.css`.

**Règle tenue partout : pendant une animation, seuls `opacity` et `transform`
bougent.** Aucune largeur, aucun filtre, aucune ombre n'est animée image par
image — c'est ce qui tient les 60 im/s avec cent photos montées.

- **Les tuiles ont deux couches.** La `figure` porte la **mise en page** (le
  `translate3d` et la taille calculés par la masonry), une couche intérieure
  porte le **mouvement** (apparition, survol). Sans cette séparation, changer la
  densité pendant qu'une tuile apparaît écrase l'une des deux transformations.

- **Apparition en deux temps, comme la référence** : le cadre monte et se révèle
  (16 px, 460/620 ms, expo-out), puis la photo se fond dedans une fois **décodée**
  (`data-loaded`). On ne voit jamais un rectangle vide arriver puis se remplir.

- **La vague est ordonnée à la main.** Un `IntersectionObserver` révèle les
  tuiles à l'entrée dans le champ (`rootMargin` 280/340 px), pas au montage :
  avec cent photos, tout animer au montage revient à jouer cent animations hors
  écran. **Piège trouvé en mesurant** : l'observateur ne promet aucun ordre et
  livre en pratique les tuiles **une par une, à l'envers** — la vague remontait
  du bas à droite. On accumule donc les arrivées de l'image en cours
  (`requestAnimationFrame`) et on ne décide des retards qu'au moment de poser,
  triés par `data-position`. Vérifié sur un rechargement à 16 photos :
  `0, 26, 52 … 234 ms` dans l'ordre de lecture.

- **La bouffée dure 60 ms, pas 140.** Un chargement de page révèle tout en une
  ou deux images ; un **import** ajoute les photos une par une, à ~100 ms
  d'intervalle. Avec une fenêtre longue, la seizième photo importée héritait du
  retard cumulé des quinze précédentes (338 ms d'attente). Elle arrive
  maintenant tout de suite.

- **Le carrousel a un rail à largeur variable.** Chaque diapositive fait la
  taille de sa propre photo (70 % de la hauteur utile, au plus 50 % de la
  largeur ; 68 %/84 % sous 860 px). Un portrait laisse donc voir large de ses
  voisines, un panoramique les repousse presque hors champ — c'est exactement ce
  qui distingue la référence d'un carrousel à colonnes fixes.

- **Une voisine visible de chaque côté, pas deux.** Les diapositives à deux crans
  restent montées (il faut de la réserve quand le rail part) mais sont
  transparentes. Elles se révèlent **pendant** le glissement, parce que la
  réserve suit `visual`, l'index visé, qui bascule dès le début du geste.

- **Bug attrapé à la capture** : le rail calculait les positions avec un écart de
  44 px entre diapositives que le DOM n'appliquait pas — la photo courante était
  décentrée de 88 px, et de la moitié de l'écran sur téléphone. L'écart vit
  maintenant dans `--vo-slide-gap`, posé sur la racine du carrousel et lu par le
  `column-gap` du rail : une seule source pour le calcul et pour le DOM.

- **Ouverture : fondu puis zoom, pas de FLIP.** La photo arrive centrée à 90 %
  et se déplie (520 ms), les voisines suivent à 90 ms, l'habillage à 180 ms.
  Pendant ce temps **la grille recule** (`scale(1.07)`, opacité 0,55) au lieu de
  disparaître : c'est elle que le voile floute par `backdrop-filter`, et c'est ce
  qui donne le fond marbré de la référence. Un voile qui flouterait la photo
  courante ne donnerait pas du tout la même image.

- **Les animations d'entrée ne vivent que pendant l'entrée.** Passé 700 ms on
  repasse en `idle`. Sinon le sélecteur `data-active` se remettait à matcher à
  chaque changement de photo et le zoom d'ouverture se rejouait — le carrousel
  « sautait » à chaque flèche. Les voisines ont leurs propres images-clés, qui
  finissent sur **leur** état de repos : sinon elles sautaient au moment où
  l'animation d'entrée est retirée.

- **L'habillage suit la référence** : compteur monospace en haut à gauche, actions
  effacées et croix en haut à droite, ligne de métadonnées en petites capitales
  espacées en bas à gauche, nom de fichier en italique à droite, chevrons nus aux
  bords. **La frise n'est pas dans la référence** : elle ne remonte que quand la
  souris descend dans les 150 derniers pixels, ou au clavier — la fonction reste,
  elle ne s'impose plus.

### Deuxième passe, le même jour (retour de l'utilisateur)

Trois reproches, tous fondés : **trop rapide**, **images pas en pleine qualité**,
**carrousel pas assez travaillé**. Ce qui a changé :

- **La courbe d'apparition, d'abord.** Le problème n'était pas la durée mais
  l'amorti : une exponentielle sortante fait 90 % du chemin dans le premier
  quart, donc une animation d'une seconde se lisait comme un clignotement.
  Mesuré sur la vidéo de référence, image par image : à 27 % de la durée la
  tuile est à **66 %** de sa course, à 47 % elle est à **87 %**. C'est une
  cubique sortante, pas une exponentielle. D'où `--vo-ease-reveal:
  cubic-bezier(0.33, 1, 0.68, 1)`, et la tuile qui s'ouvre depuis
  **`scale(0.62)`** en 1 s, décalage de **70 ms** par tuile.

- **Le clic sur la densité refait la grille.** Redimensionner, c'est
  reconstruire : toutes les photos changent de case en même temps, et les faire
  glisser une par une donne une bouillie. On efface, on repose, on rejoue la
  vague — comme la référence. L'ordre compte : les tuiles sont cachées
  **avant** que le navigateur peigne la nouvelle mise en page (`useLayoutEffect`,
  transitions coupées), puis remises sous l'observateur à l'image suivante.

- **La vignette passe de 720 à 1600 px.** 720 px étirés dans une tuile Retina de
  740 px, ça se voit : la grille avait l'air floue alors que la photo était
  nette. Et les photos **déjà importées** ne sont pas laissées de côté : quand
  une tuile charge sa vignette, elle compare le `naturalWidth` réel à ce qu'elle
  demande en pixels écran et, si l'écart est vrai, `ensurePreview` refabrique la
  vignette et l'écrit dans IndexedDB. **À la demande, jamais en masse** — une
  migration au démarrage redécoderait deux cents JPEG de 8 Mo pour des tuiles
  que personne ne regardera. Vérifié de bout en bout : vignettes rabaissées à
  300 px dans IndexedDB, rechargement, elles remontent **et sont réécrites**.

- **Dans le carrousel, les voisines chargeaient en `lazy`.** Elles restaient sur
  leur vignette une seconde et passaient pour des photos molles. Toute
  diapositive visible charge maintenant sa pleine résolution tout de suite, et
  le `blur(1px)` posé sur la vignette d'attente a sauté.

- **La profondeur.** Le voile est passé de 0,84 à **0,74** d'opacité et la grille
  recule plus loin (`scale(1.16)`) en restant à **0,66** — il faut qu'il RESTE
  quelque chose à flouter derrière. Un fond noir uni ne donne pas de la
  profondeur, seulement un trou.

- **Le carrousel n'a plus de paliers.** Chaque diapositive porte `--d`, sa
  distance au centre en nombre de photos, et son échelle, son opacité et son
  voile en découlent par formule. Au repos, changer `--d` déclenche les
  transitions — le fondu croisé se fait tout seul. Pendant un geste, on écrit
  `--d` **en fraction** (0,37) et les voisines suivent le doigt en continu au
  lieu de basculer d'un cran à l'autre. C'est ce qui sépare un carrousel qui
  bascule d'un carrousel qu'on manipule.

- **Piège corrigé au passage** : l'animation d'entrée vivait sur le cadre, dont
  l'état de repos dépend maintenant de `--d`. Elle a sa propre couche
  (`.slideEnter`) qui finit toujours à l'identité — sinon les voisines sautaient
  au moment où l'animation était retirée.

### Troisième passe, le même jour (le carrousel, fini)

- **Le « contour blanc » autour des photos était un cadre d'image cassée.** Pas
  une bordure : Safari dessine un cadre gris, le nom du fichier et un point
  d'interrogation par-dessus une image qui n'a pas pu se décoder. En rendant les
  voisines `eager` à la passe précédente, on lançait le décodage de **trois
  originaux en même temps** — des PNG de 10 Mo dans la bibliothèque de
  l'utilisateur — et Safari lâchait. Correctif : **seule la photo centrale monte
  sa pleine résolution**, les voisines s'arrêtent à l'aperçu 1600 px (elles sont
  affichées à ~500 px CSS, l'aperçu les rend déjà nettes). Et l'original porte
  `alt=""` avec un `data-failed` qui le retire du flux : s'il échoue quand même,
  le navigateur ne dessine RIEN, l'aperçu en dessous fait le travail. Le fond
  clair du cadre (`rgba(255,255,255,0.03)`) est passé en `#0a0a0c` — le moindre
  liseré clair autour d'une photo se voit.

- **Le carrousel demande aussi ses pixels.** `ensurePreview` n'était appelé que
  par les tuiles de la grille ; les voisines du carrousel seraient restées sur
  un aperçu 720 px pour toujours.

- **On distingue mieux la galerie derrière** : voile 0,74 → **0,62**, flou 32 →
  26 px, grille à **0,82** d'opacité. C'est ce qui fait la profondeur.

- **La photo est cueillie sur sa tuile, et rendue à sa tuile.** Les deux sens,
  symétriques, en animation calculée (`Element.animate`) :
  - **la position d'arrivée ne peut pas être lue sur la tuile.** Au moment de la
    fermeture, la grille est en train de revenir de son agrandissement : son
    rectangle à l'écran est celui d'une image intermédiaire d'animation.
    `getTileRect` additionne donc le rectangle de mise en page de la masonry à
    l'origine de la grille **relevée à l'ouverture**, quand elle était encore à
    l'échelle 1. Exact, et indépendant de tout mouvement en cours.
  - **l'échelle du trajet est uniforme**, calculée sur la largeur : une tuile n'a
    pas toujours exactement le rapport de sa photo (la masonry borne les formats
    extrêmes), et une échelle à deux axes déformerait la photo en plein vol.
  - **tuile hors champ** (on a navigué loin dans la collection) : pas de trajet
    vers un point invisible, on recule sur place.
  - **piège** : l'effet d'ouverture ne peut pas avoir des dépendances vides. Au
    tout premier rendu la scène n'est pas mesurée, donc aucune diapositive
    n'existe — l'effet ne trouvait rien et le trajet ne se jouait jamais. Il
    attend `layout` et se protège par un drapeau.
  - le retour de la grille est plus court que l'aller (620 ms contre 900) pour
    qu'elle soit revenue au moment où la photo se repose.

- **Gates** : `npm run lint` vert, `npm run test:vibeos-library` vert (8 tests
  EXIF, 8 masonry, 1 parcours navigateur complet, rejeu de densité compris).
  `npm run build` **échoue pour une raison antérieure et étrangère au lot** :
  `better-sqlite3` est compilé pour `NODE_MODULE_VERSION 127` alors que le Node
  installé attend `147`, ce qui fait tomber `/api/reset`. Un
  `npm rebuild better-sqlite3` réglera ça, aucun fichier de ce lot n'est en
  cause.

## Journal — 2026-08-03 (lot B3b — les 15 dernières transitions)

- **Le catalogue est entièrement exportable : 48 transitions sur 48.** Plus une
  seule entrée « Aperçu uniquement ». Les 15 sans équivalent `xfade` natif sont
  désormais des **sous-graphes de filtres natifs** posés sur la queue du plan
  sortant et la tête du plan entrant.
- **`render-service/src/server.js`** : `buildTransitionSubgraph` (exporté) rend la
  liste complète des éléments de filtergraph d'une transition, plus
  `SERVER_TRANSITION_EFFECTS` (table déclarative des 15 effets),
  `steppedChain` (rampe sans `sendcmd`), `isolateWindow` / `sliceWindow`
  (confinement d'une fenêtre en trois morceaux), `alignedPairParts` (aligner deux
  flux sans `xfade`), et les jointures refaites à la main pour le stroboscope, le
  glitch et la révélation par blocs.
- **`src/features/vibefx-studio/video/engine/xfadeTransitions.js`** : la
  contrepartie canvas des 15, aiguillée sur l'**ID** et non sur la cible `xfade`
  (elles partagent toutes `fade`, `wiperight` ou `vertopen` comme simple
  jointure). Plus `quantizeProgress`, la reconstruction de bord rabattu, et
  l'isolation de couches de couleur.
- **`src/features/vibefx-studio/video/export/exportManifest.js`** et
  **`functions/src/videoExport.js`** : les deux copies de la table d'effets.
  Elles sont vérifiées identiques par `smoke-vibecut-transition-parity`.
- **`src/features/vibecut/data/transitionCatalog.js`** : champ `usage` et table
  `TRANSITION_USAGES` — décision produit du porteur du projet, les ouvertures et
  les fins de séquence sont marquées dans la bibliothèque.
- **`src/features/vibecut/library/TransitionLibrary.jsx`** : le badge et le filtre
  changent de rôle (« Export Pro » aurait été sur les 48 cartes), et un message
  arrive au moment où l'on pose une ouverture ailleurs qu'à la première coupe.
- **Trois scripts de test nouveaux** :
  `smoke-vibecut-transition-chain-mp4.mjs` (trois plans enchaînés),
  `smoke-vibecut-transition-cost.mjs` (plafond de coût),
  `smoke-vibecut-transition-sentinels.mjs` (cinq défauts rejoués). Les deux
  premiers entrent dans `test:vibecut-ui-v2` ; `audit-scope` verrouille les trois.
- **Ce que la mesure a contredit** (détail au § 10 du plan) : `zoompan` sur vidéo
  est sans réserve ; **`sendcmd` est inutilisable** (il diffuse à tout le graphe,
  et le nommage d'instance ne marche pas dans le build déployé — la deuxième
  coupe d'un montage rendait un fondu simple) ; `concat` dérive au-delà de trois
  morceaux ; la vraie dépense est l'aller-retour `yuv420p ↔ gbrp`, pas l'effet.
- **`GET /capabilities` vérifie maintenant les FILTRES** en plus des cibles
  `xfade` (`capabilitiesVersion` 5). Les 15 nouvelles n'étant plus des cibles, le
  contrôle précédent ne disait plus rien d'elles. La liste est relevée sur les
  sous-graphes émis, jamais recopiée, et le pré-vol refuse une image antérieure
  au lot.

## Journal — 2026-08-03 (lot B3b — clôture : parité verte, sentinelles 5/5, rollout)

- **`src/features/vibefx-studio/video/engine/xfadeTransitions.js`** : une seule
  ligne changée, et c'est le sujet de la journée. `renderEffectTransition` lisait
  `const qStep = clamp(t, 0, 1)` au lieu de `quantizeProgress(t)` — la **charge de
  la 4ᵉ sentinelle**, laissée en place par une exécution interrompue de
  `smoke-vibecut-transition-sentinels`, qui patche le code de production avant de
  le restaurer. L'aperçu lisait donc la courbe **en continu** quand l'export
  avance par **douze paliers**.
- **Le symptôme avait été diagnostiqué à l'envers** : l'écart de
  `additive-dissolve` avait été attribué à la rasterisation de Chromium, et le
  seuil **monté deux fois** pour l'absorber. Deux exécutions consécutives sans
  rien changer entre les deux ont rendu des valeurs **identiques au dixième** sur
  les quinze transitions — donc aucun bruit, donc un bug. L'écart se prédisait au
  dixième à partir de α = 0,30 × sin(π q) : 6,5 / 1,1 / 9,1 attendus contre
  6,0 / 2,0 / 8,9 mesurés.
- **`scripts/smoke-vibecut-xfade-preview-parity.mjs`** : la justification qui
  invoquait Chromium est remplacée par ce qui s'est réellement passé, et les
  seuils sont **resserrés sur la mesure** au lieu d'être montés — `meanFrame`
  passe de 8 à **4-6** pour douze des quinze, chaque entrée portant sa pire mesure
  datée. Le test est **vert** (44 transitions dont 15 à sous-graphe, × 4 points).
- **`smoke-vibecut-transition-sentinels` mené au bout pour la première fois** :
  **5 défauts rejoués, 5 attrapés.**
- **Rollout Cloud Run fait, une seule fois** : image
  `b3b-21b8030-20260803`, révision **`00008-8gr`**. Vérifié sur le service réel
  avec `VIBECUT_RENDERER_URL` : `capabilitiesVersion 5`, **29 cibles `xfade` sur
  29**, **20 filtres sur 20**, `missing: []`, `errorCount: 0`, `/render` toujours
  protégé (401 sans signature). Retour arrière : `00007-b5c`.
  **Il n'y a plus aucun écart aperçu ↔ production.**
- **Trois règles de travail en sortent**, consignées dans `plan.md` § 10 et
  `todo.md` : faire un `git diff` sur les deux fichiers patchés après toute
  exécution des sentinelles ; ne jamais monter un seuil de parité pour faire
  passer un test, mesurer deux fois d'abord ; et ne justifier un seuil que par une
  **mesure datée**, jamais par un mécanisme plausible.

## Journal — 2026-08-02 (cadrage du lot B3b — les 15 dernières transitions)

- **Nouveau document** : `docs/vibecut-transitions-b3b-plan-2026-08-02.md` — plan
  d'implémentation des 15 transitions restées « aperçu uniquement ».
  **Implémentation non commencée.**
- **Une architecture écartée après mesure.** `xfade=transition=custom:expr=`
  permet tout (échantillonnage à coordonnées arbitraires, mélange additif,
  conditions par ligne — vérifié), mais coûte **8,6 s pour une transition de
  0,6 s en 1080p** contre **0,2 s** en natif. Le facteur ~40 est **inhérent** à
  l'évaluateur d'expressions : mesuré à 4,0 s même avec la formule la plus
  triviale. Sur un service facturé à la seconde, c'est disqualifiant.
- **Voie retenue** : filtres natifs **rampés** (`sendcmd`, `zoompan`,
  `rgbashift`, `displace`) sur la **queue de A** et la **tête de B**, puis une
  jointure `xfade` native — 0,2 à 0,4 s, et une forme qui correspond à ce que
  `renderTransition` fait déjà côté canvas.
- **Faits techniques établis, à ne pas re-découvrir** : `a0()` échantillonne
  toujours le plan 0 (il faut aiguiller sur `PLANE`) ; les coordonnées se
  comportent à l'identique en `yuv420p` et en `gbrp` ; un échantillonnage hors
  cadre est **rabattu sur le bord** ; `displace` prend **trois** entrées.
- **Chantier structurel identifié** : `buildFfmpegArgs` n'émet qu'une ligne par
  transition, il devra émettre un **sous-graphe**.

## Journal — 2026-08-02 (lot B3a — fermeture de l'écart d'export)

- **Décision du porteur du projet** : traiter l'écart d'export **avant** B2. La
  recommandation d'ordre laissée en fin de B1 est donc tranchée.
- **Le problème** : 23 des 38 transitions jouaient dans l'aperçu et repartaient
  en simple fondu à l'export. Un glitch mis en favori et posé sur un montage
  ressortait en fondu dans la vidéo finale.
- **Ce qui change** : les 31 cibles `xfade` natives inutilisées ont été rendues
  et **mesurées** une par une, pas jugées sur leur nom. **8 entrées existantes**
  pointent désormais sur la cible qui tient vraiment leur promesse
  (`whip-pan` → `slideleft`, `flash` → `fadewhite`, `outro-neon-close` →
  `vertclose`, `outro-signal-collapse` → `squeezev`, …), et **10 entrées
  nouvelles** ouvrent les sens manquants (volets et balayages dans les quatre
  directions) et deux formes absentes du catalogue : **rognage par le noir**
  (`circlecrop`, `rectcrop`) et **compression** (`squeezeh`).
- **15 → 33 transitions exportables.** Catalogue 38 → **48**, « aperçu
  uniquement » 23 → **15**.
- **Trois courbes relevées, pas devinées** : `circlecrop` suit
  `rayon = |1−2t|³ × hypot(w/2, h/2)` — le cube n'était pas devinable et une
  décroissance linéaire aurait donné un tout autre effet ; `rectcrop` la même
  forme sans le cube ; `squeezeh`/`squeezev` un facteur `1 − t`, en **mettant à
  l'échelle** le plan sortant plutôt qu'en le rognant.
- **Deux cibles écartées après mesure** : `fadefast` et `fadeslow`. Leur poids de
  mélange dépend de la **valeur du pixel** (0,703 contre 0,612 au même instant,
  mesuré sur quatre gris), donc aucune table de courbe ne peut les reproduire
  sans que l'aperçu mente. `fadeslow` est en outre indistinguable de `fade` sur
  les couleurs saturées.
- **Fichiers touchés** : `engine/xfadeTransitions.js` (six routines nouvelles ou
  généralisées : masque sur les deux axes, volets ouvrants/fermants, rognages,
  compressions, balayages et volets dans les quatre sens), les **trois** tables
  de transitions (`export/exportManifest.js`, `functions/src/videoExport.js`,
  `render-service/src/server.js`), `data/transitionCatalog.js`,
  `render-service/README.md`.
- **Tests** : `smoke-vibecut-xfade-preview-parity` couvre **29 cibles natives**
  et refuse désormais un point d'échantillonnage qui ne tombe pas sur une image
  entière ; `render-vibecut-xfade-transitions-local-smoke` rend **34 MP4 réels**
  et traite à part les deux transitions dont le **noir à mi-parcours est
  l'effet** ; `smoke-vibecut-library-parity` fige 48 / 33 / 15.
- **Déployé** : révision **`00007-b5c`** (image `b3a-7ff9c28-20260802`), le
  2026-08-02. Pré-vol sur le service réel : 29 cibles `xfade` sur 29,
  `errorCount: 0`, `/render` toujours protégé. Retour arrière possible sur
  `00006-6fw`.

## Journal — 2026-08-02 (lot B1 — fondation du design des deux bibliothèques)

- **Livré.** `/video/transitions` et `/video/mouvements` partagent désormais une
  **ossature commune** (`LibraryScreen`, `LibraryFilterBar`, `LibraryCard`,
  `LibraryStage`, `LibraryContextStrip`) : les deux écrans ne fournissent plus
  que leurs **données**, leur façon de dessiner une vignette et leur panneau.
- **Hover scrub** sur chaque vignette : la position horizontale du pointeur *est*
  le curseur de temps, avec liseré de progression et **équivalent clavier** aux
  flèches. La boucle reprend à la sortie.
- **Au repos, chaque vignette se fige au point culminant** de son effet
  (`peak` dans le catalogue de transitions, fin de course pour les mouvements) :
  une grille figée à l'instant 0 aurait été 38 fois la même image.
- **Bypass** dans le grand aperçu : maintenir **B** montre le rendu **sans**
  l'effet, en plein cadre — coupe franche pour une transition, photo immobile
  pour un mouvement. C'est l'avant/après, en séquence et non en surface.
- **Favoris** persistés en **IndexedDB** (`favorites:v1`, même base que les
  projets), une seule source de vérité (`adapters/useFavorites.js`), **rappelés
  dans les deux modes** : en tête de l'inspecteur du montage avancé, et à la
  place des six raccourcis écrits en dur du montage rapide (repli sur les six
  d'origine tant qu'aucun favori n'est posé).
- **Le temps ne passe jamais par React** : les contrôleurs de progression vivent
  dans un registre de module (`previewController.js`), comme `playheadClock`.
- **Ce que l'écran met en avant** : les 7 mouvements annoncés passent dans une
  **annexe en bas** (ils occupaient plus de la moitié de la grille) ; dans chaque
  famille de transitions, les **exportables passent devant** — ce tri existait
  avant B1 et avait été perdu au passage à l'ossature commune ; filtre
  **Export Pro** (15 sur 38) et **avertissement à l'application** quand la
  transition posée se dégradera en fondu au rendu final.
- **Scènes de repli redessinées** (`useLibraryImages.js`) : trois plans de relief,
  halo, reflet et grain fin, déterministes. Un dégradé lisse zoomé à 116 % reste
  le même dégradé — la moitié des effets ne se voyaient pas avant import.
- **Cadence mesurée** : 60,2 images/seconde sur les 38 vignettes, 60,1 avec un
  scrub en cours. Devenu un test permanent (plancher 24).
- Gate : **17 nouveaux tests navigateur** (`smoke-vibecut-library-b1.spec.cjs`)
  qui mesurent les **pixels** des aperçus, pas les libellés. Suite portée à
  **60 tests**.

## Journal — 2026-08-02 (ouverture du chantier)

- **Nouveau chantier ouvert : les deux bibliothèques.** La reconstruction étant
  terminée, l'objectif devient de faire de `/video/transitions` et
  `/video/mouvements` des écrans où l'on a envie de rester. Feuille de route :
  `docs/vibecut-bibliotheques-roadmap-2026-08-02.md`, lot **B1** (design) en
  premier, sur le contenu **déjà en place**.
- **Décision de conception, après recherche sur DaVinci Resolve, Final Cut Pro et
  CapCut** : l'avant/après à séparateur déplaçable est **écarté** au profit du
  **hover scrub** (la position horizontale du pointeur sur la vignette *est* le
  temps) et d'un **bypass** au clavier. Motif : un séparateur compare deux états
  d'un même instant dans l'**espace**, or mouvements et transitions sont des
  différences dans le **temps**. Le séparateur est rangé pour une éventuelle
  bibliothèque de looks colorimétriques, où c'est le bon outil.
- Inventaire vérifié à cette date : **38 transitions** (15 exportables,
  23 « aperçu uniquement ») réparties en 7 familles, et **13 mouvements** dont
  **6 réels** — et applicables aux photos seulement. Côté « pendant le rush », le
  produit a 6 mouvements et 6 réglages de couleur : c'est le retard réel sur
  Premiere et DaVinci, et il est documenté comme tel plutôt que masqué.

## Journal — 2026-08-01 (phase 7)

- **L'ancien front vidéo est supprimé.** `VideoApp`, `VideoEditor`, `video/panels/`,
  `video/timeline/`, `video/preview/`, `vibecut-premium.css`, `guidedTemplates.js`,
  `storyboardLibrary.js`, `quickTools.js`, `smoke-video-ui.spec.cjs` et
  `smoke-vibecut-quick-tools.spec.cjs` — **10 036 lignes**. Une archive de l'état
  exact avant suppression a été déposée dans le scratchpad de la session.
- **`/studio?workspace=video` redirige vers `/video`**, côté serveur
  (`src/app/studio/page.js`). `video` ne fait plus partie des workspaces du studio,
  et `VibeFxStudio.jsx` ne monte plus d'éditeur vidéo.
- **Trois fonctions sauvées de la suppression** : le panneau d'export supprimé
  portait l'enregistrement dans un dossier du PC, le nom de fichier horodaté et la
  régénération d'URL signée. Elles vivent maintenant dans
  `video/export/exportDownload.js`, utilisées par les deux feuilles du nouveau front
  via `vibecut/adapters/useExportDownload.js`.
- **Un oubli rattrapé** : `resolveOutputMediaMetadata` était importé sans être
  appelé — le nouveau front annonçait « MP4 » sans relire ce que le rendu avait
  produit. `vibecut/adapters/useExportOutputMeta.js` le rebranche.
- **Deux boutons morts laissés par la suppression, trouvés à l'usage** : l'onglet
  VIBECUT de l'en-tête studio appelait encore `setView('video')` — un état que plus
  rien ne rendait, donc le clic ne faisait rien ; et le lien Backoffice, conditionné
  à cette même vue, était devenu injoignable pour les admins. L'onglet est un vrai
  `Link` vers `/video`, le Backoffice ne dépend plus que du rôle.
- Suite navigateur portée à **43 tests**, dont deux qui suivent la bascule jusqu'à
  son URL d'arrivée (redirection serveur, et clic réel sur l'onglet).
  `audit-scope.mjs` vérifie la redirection, l'absence des fichiers supprimés, et
  refuse le retour de `view === 'video'` comme condition de rendu.

## Journal — 2026-08-01

- **Lot L4 livré** : les cartes de preset de la création guidée sont bâties sur les
  **miniatures réelles** du projet (`guided/PresetFilmstrip.jsx`), trois panneaux
  enchaînés par la vraie transition du preset à son vrai tempo. Repli SVG conservé
  pour l'état où l'extraction n'est pas finie.
- **Lot L5 livré** : la **partition est visible** (`guided/BeatStrip.jsx`, géométrie
  produite par `buildBeatStrip`, fonction pure), et le **problème H est fermé** —
  `titleStyle` et `audioProfile` sont réellement appliqués par trois résolveurs purs.
  La mise en capitales d'un preset reste réversible.
- **Phase 5 livrée** : `/video/transitions` et `/video/mouvements` ne sont plus des
  écrans d'attente. Décision structurante : **les aperçus sont dessinés par le
  moteur** (`renderTransition` désormais exportée de `VideoEngine.js`,
  `applyImageMotionTransform` de `mediaModel.js`), jamais imités en CSS — une carte
  ne peut donc pas diverger du rendu qu'elle annonce.
- **L6 DÉPLOYÉ** : rollout Cloud Run effectué. Révision `00006-6fw`, image
  `l6-af59e70-20260801`, région europe-west9. La production passe d'un fondu simple
  à **15 transitions**, et d'un mouvement linéaire à `smoothstep` + intensité.
  Vérifié sur le service réel : 15/15 cibles `xfade`, `errorCount: 0`, `/render`
  toujours protégé (401 sans signature). L'ancienne révision `00005-vf2` reste
  disponible pour un retour arrière immédiat.
- **`GET /capabilities` du renderer ne divulgue ni la version de FFmpeg ni le texte
  des erreurs** — l'endpoint est sans authentification sur un service Cloud Run
  public. Choix délibéré (problème J de todo.md), documenté dans le renderer, son
  README, le runbook, et verrouillé par `smoke-vibecut-library-parity.mjs` — dont
  le garde a été vérifié par sentinelle (réintroduire la version FAIT échouer le test).
- **`npm run test:scope` est vert pour la première fois.** Le problème A est corrigé :
  le garde interdisait le mot « jardin » tout court et attrapait un texte immobilier
  légitime ; il porte désormais sur le **nom complet** du projet source. Deux
  assertions périmées de la même famille sont alignées (Node 20 → 22, firebase-functions
  6 → 7, firebase-admin 13 → 14), et la cohérence des trois déclarations de version de
  Node est maintenant vérifiée.
- **Deux défauts trouvés par les nouveaux tests, pas par la relecture** : appliquer
  depuis une bibliothèque puis repartir perdait l'édition (autosave debouncée à 1,2 s
  → flush `saveNow` explicite) ; et l'étape Finaliser annonçait encore le montage
  avancé « en construction » alors qu'il est livré depuis le 2026-07-31.

## Statut

- Projet cree dans `C:\Users\matth\Travail\vibe_fxV2`.
- Les 23 skills ont ete importes avec `npx skills add C:/Users/matth/Desktop/design-skills-db/publish/refero-design-skills`.
- Des dependances ont ete ajoutees : Next.js, React, Firebase, lucide-react, three, howler, zustand, better-sqlite3.
- `firebase-tools`, `@playwright/test`, `ffmpeg-static` et `ffprobe-static` sont des devDependencies pour rendre les commandes Firebase, les smokes UI et le smoke MP4 local K1 reproductibles sans installation FFmpeg globale.
- `firebase.json` ne declare pas de cible Firebase Hosting classique : l'application Next.js passe par Firebase App Hosting via `apphosting.yaml` et la cible source locale `vibefx-v2-web`; les exclusions gardent les caches, donnees locales et artefacts d'audit hors archive. `firebase:deploy:backend` et `firebase:deploy:functions` passent par `scripts/firebase-deploy.mjs`, exigent `FIREBASE_PROJECT_ID`, refusent les cibles `demo-*` et limitent les ressources deployees.
- `postcss` est force via `overrides` en `8.5.10` pour corriger l'audit npm sans downgrader Next.
- `.env.example` et `.env.emulators.example` sont explicitement exclus de l'ignore global `.env*` afin de rester versionnables.
- Les fichiers de cadrage racine sont presents et la home relie les premieres pages SEO.
- `npm run lint` passe sans erreur ; des avertissements herites restent dans le module importe `vibefx-studio`.
- `npm run build` passe et prerender les routes publiques SEO, le studio, `robots.txt` et `sitemap.xml`.
- `npm --prefix functions run lint` passe avec `node --check index.js`.
- Un smoke test Node des helpers du parcours publication passe : normalisation draft, checker, payload, slug et `ownerUid`.
- `npm run test:publication-flow` rejoue le smoke test publication sans Firebase reel et verifie aussi le chemin Storage `users/{uid}/publications/...`.
- `npm run test:routes` verifie les routes publiques/studio, JSON-LD, canonical, sitemap et noindex studio contre le serveur local.
- Le smoke Playwright du studio est aligne sur le shell actuel : il ouvre `/studio`, passe par `Creer une mise en page`, importe `public/assets/vibefx/demo-astronaut.png`, puis clique `Publication` pour verifier le passage studio/layout vers publication.
- `npm run test:studio-ui` passe contre un serveur Next dedie via `SMOKE_BASE_URL` et s'execute en un worker pour eviter les courses d'hydratation/compilation des smokes Playwright.
- `npm run test:scope` verifie automatiquement le perimetre Functions, l'absence de termes source, les pages SEO, les modules extraits et les rules multi-utilisateur.
- `npm run audit:secrets` bloque les signatures courantes de cles Firebase, tokens Meta, private keys et valeurs sensibles Meta hardcodees.
- `npm run check:e2e-readiness` formalise les variables/secrets manquants avant le test E2E Firebase/Meta reel.
- `npm run verify:local` rejoue les controles locaux principaux : lint, scope, audit secrets, parcours publication, build, lint Functions et audit dependances.
- `npm run emulators` lance les emulateurs Firebase locaux ; `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` connecte le client aux ports locaux.
- `npm run check:emulator-readiness` verifie les prerequis CLI/Java/config avant de lancer les emulateurs.
- `npm run test:emulators` a ete valide avec Java 21 et verifie Auth/Firestore/Storage rules sous emulateurs.
- `npm run test:studio-emulators` a ete valide avec Java 21 et verifie en navigateur `/studio` -> demo -> import -> sauvegarde brouillon contre Auth/Firestore/Storage/Functions emulateurs.
- `.github/workflows/verify.yml` rejoue les controles principaux sur push/PR, teste les routes, le smoke UI studio contre `next start`, puis la sauvegarde brouillon studio contre les emulateurs Firebase.
- `functions/index.js` expose le perimetre Meta/OAuth/publication et le debut Lot 2 Stripe : `createCheckoutSession` cree une Checkout Session `mode=payment`, `stripeWebhook` verifie la signature et fulfil premium/credits via transaction Firestore idempotente.
- Les routes API `_midjourney` sont bloquees en production par defaut via `VIBEFX_ENABLE_MIDJOURNEY_LIBRARY=false`; elles ne restent utilisables qu'en dev/local ou avec double opt-in explicite pour une session admin non SaaS.
- Les references d'identite source ont ete neutralisees dans les surfaces Vibe_fx auditees.
- `PublicationsManager.jsx` est reduit a l'orchestration layout/publication : `PublicationComposer`, `PublicationDashboard`, `PublicationPreview`, `MetaOAuthPanel`, `PublicationList` et les helpers publication sont extraits. L'ancien manager legacy, son editeur interne et le moteur canvas mort ont ete supprimes.
- Les publications studio sont chargees par `ownerUid`, les nouveaux uploads passent par `users/{uid}/publications/...`, et `firestore.rules`/`storage.rules` protegent l'ownership et bloquent l'ancien chemin Storage `/publications` en ecriture.
- Le studio initialise une session Firebase Auth anonyme quand Auth est disponible afin que les brouillons aient toujours un `ownerUid`.
- Apres sauvegarde, le manager publications met a jour la liste locale sans attendre un rechargement manuel Firestore.
- `VibeFxLayout` exporte vers publication un payload structure avec `blob`, `socialImages`, `format`, `template` et `settings`.
- `VibeFxStudio` remplace l'entree de mise en page dans `PublicationsManager.jsx` et porte les onglets Studio/Layout/Library/Soundtrack/Vision/Video importes depuis `C:\Users\matth\Travail\Vibe_fx`, avec export publication V2 conserve; l'ancienne page studio Credits/SaaS et la page Fusion ont ete supprimees du header, du deep-link workspace et du rendu studio. Les reliquats `FusionPanel.jsx` et `CanvasArea.jsx` ont aussi ete retires, tandis que les fonds Pro de Layout (`Mesh` et `Flou Pro`) restent portes par les etats Layout.
- La bibliotheque est cablee via routes API Next et scripts `scripts/midjourney-scraper/` ; aucune image source n'a ete importee, le catalogue local demarre vide et se remplit par scraping.
- Le module video Vibe_CUT, ses pistes `public/music/` et ses dependances audio/state ont ete portes ; la navigation React Router source a ete remplacee par l'etat d'onglet interne du studio, et les composants studio/video sont declares en client components pour eviter les bailouts SSR.
- Le module video Vibe_CUT accepte les imports lourds en ajoutant les clips immediatement puis en extrayant les thumbnails en arriere-plan ; les filtres colorimetriques sont appliques au rendu canvas, les textes restent visibles en lecture/export, les pistes musique locales `public/music/` sont importables/lisibles, les clips video se reordonnent par drag/drop pointer dans la timeline, une timeline `Effets` separee entre video et texte permet de placer/deplacer/redimensionner des transitions librement sans les melanger aux clips video, et l'export navigateur utilise un canvas dedie a la resolution du preset avec mix audio vers WebM/MP4 si supporte via `MediaRecorder`.
- ~~`npm run test:video-ui` lance le smoke Playwright de l'ancien front~~ **PHASE 7 (2026-08-01) : `smoke-video-ui.spec.cjs` est supprime avec l'ancien front.** `npm run test:video-ui` ne garde plus que les smokes de MODELE et de STORE (timeline, store, persistance, manifeste, jobs, rendu image), qui restent valables : ils ne testaient jamais l'interface. La couverture navigateur est desormais `npm run test:vibecut-ui-v2` (42 tests). Historique de ce que couvrait l'ancien smoke, conserve pour memoire : il demarrait un serveur Next local sur port libre ou reutilise le serveur dev Next deja actif, puis execute `scripts/smoke-video-ui.spec.cjs` contre `/studio` avec `SMOKE_BASE_URL` controle ; le smoke couvre import de deux videos courtes, reorder, trim par poignee, split/coupe, drag rapide du playhead violet pendant lecture, vitesse 2x, filtre Cyberpunk, transition Flash sur timeline `Effets` avec verification de luminance canvas, deplacement de l'item transition, synchronisation du panneau Transitions sur start/duration canonique, verrou de piste Effets bloquant input timecode, range du panneau Transitions et drag, verrou de piste Filtres bloquant presets/ranges du panneau Filtres, verrou de piste Musique bloquant le volume, modele pur avec transitions de coupe/libres presentes dans `items[]`, audio integre des clips expose comme items `audio-main`, filtres clips exposes comme items `effect-main`, overlap de transitions detecte, volumes bornes, couverture des frames export pour timestamps de transitions et rejet des transitions trop courtes pour le FPS, texte intro, bibliotheque musique locale avec source/licence White Bat Audio, volumes clip/musique, export WebM telecharge, echec MediaRecorder sans telechargement partiel, fallback MP4 indisponible vers format reel WebM visible, onglet musique ouvrant directement sur `Importer une nouvelle musique gratuite`, wizard `Sources -> Importer cette source` pre-rempli Pixabay, champ URL audio directe avec prechargement/ecoute, catalogue gratuit agrege visible/configurable, endpoint `/api/music/free-search` exposant Openverse/Pixabay et retire Archive/Wikimedia, rejet serveur d'un domaine non allowliste, et viewport mobile petite hauteur sans overflow avec lecture/export accessibles et panneau mobile compact basculable plein ecran.
- `npm run test:vision-ui` lance `scripts/audit-vision-filters.mjs`, demarre un serveur Next local via `scripts/run-vision-ui-test.mjs`, puis execute `scripts/smoke-vision-ui.spec.cjs` ; l'audit et le smoke historique couvrent le moteur et l'ancienne surface Vision. Le plafond d'aperçu partagé est désormais 1,25 Mpx dans `useCanvasRenderer.js` ; la couverture VibeOS actuelle vit dans `smoke-vibeos-vision.spec.cjs` et `vision-preview-performance.spec.cjs`.
- `npm run check:vision-corpus` verifie la presence des 12 fixtures smartphone locales ignorees par Git dans `test-fixtures/vision-corpus`; il reste non bloquant par defaut, devient strict avec `VISION_CORPUS_REQUIRED=1`, et rappelle que Vision ne peut pas etre declaree stable finale tant que le corpus reel est absent/incomplet. `npm run test:vision-corpus` ajoute un smoke Playwright metrique sur les fixtures presentes et passe en skip si le corpus local est vide.
- Le moteur Vision conserve ses protections colorimétriques ; l'aperçu interactif Studio/Vision est plafonné à 1,25 Mpx sans toucher l'export ni l'import publication en pleine résolution.
- Le playhead Vibe_CUT est saisissable sur toute sa ligne via pointer capture et met a jour immediatement le canvas/audio pendant le scrub, y compris pendant la lecture ; la preview texte utilise aussi pointer capture pour ne pas perdre le drag.
- Le header studio passe les onglets sur une deuxieme rangee pleine largeur en mobile afin que l'onglet Video reste cliquable sans etre recouvert par les actions de droite ou le player musique.
- La bibliotheque musique Vibe_CUT affiche les metadonnees de licence/source White Bat Audio, extrait son catalogue et ses fournisseurs cibles dans `src/features/vibefx-studio/video/data/musicCatalog.js`, documente la strategie premium/free/IA dans `docs/music-sourcing-and-import-plan.md`, garde l'import de nouvelles pistes en import fichier local verifie avec declaration de droits sans scraping externe, et son panneau a ete compacte pour que les boutons d'import restent cliquables sur les hauteurs studio courtes.
- L'onglet `Soundtrack` est ajoute au header studio apres `Library` et ouvre une page full screen sans canvas/sidebar. La feature `src/features/vibefx-studio/soundtrack/` reutilise `/api/music/free-search`, `/api/music/import`, `/api/music/ai-import`, `/api/music/project/import-url`, `/api/music/local-file-import`, `/api/music/providers`, `musicCatalog.js`, `musicRights.js` et `audioWaveform.js`; elle separe maintenant une bibliotheque projet Vibe_fx owner-scoped (`users/{uid}/soundtrackTracks/{trackId}` + Storage `users/{uid}/soundtrack/{trackId}/{fileName}`) de l'agregateur provider-first. L'agregateur est l'ecran par defaut sous le libelle `Sources gratuites`, affiche Pixabay comme seule exception manuelle conservee avec assistant import fichier/URL et texte explicatif distinguant Pixabay de la musique IA, puis Openverse resserre pour la musique video sociale. Internet Archive et Wikimedia Commons sont retires des providers actifs, de l'allowlist d'import direct et retournent `unsupported` dans `/api/music/free-search` car leurs corpus sont trop heterogenes/patrimoniaux pour garantir une qualite moderne de reseaux sociaux. Les providers IA sont ajoutes sous les providers existants via `/api/music/ai-providers` et `/api/music/ai-generate` : MiniMax Music est le premier connecteur API prototype avec `MINIMAX_API_KEY`, ElevenLabs reste branchable avec `ELEVENLABS_API_KEY`, Mureka/Replicate restent experimentaux en generation automatique, Mubert reste experimental avec credentials `MUBERT_CUSTOMER_ID`/`MUBERT_ACCESS_TOKEN`, et Stable Audio/Loudly/SOUNDRAW/Beatoven restent visibles comme experimentaux ou `KEY MISSING` sans appel externe tant que leurs endpoints/contrats ne sont pas confirmes. Le bouton principal `Musique IA par theme` ouvre une modale simple en 3 etapes : choisir un provider, cliquer un theme/filtre, puis `Generer et importer`; le flux appelle `/api/music/ai-generate`, importe automatiquement la piste retournee en bibliotheque projet ou locale, puis ouvre la bibliotheque. L'ancien import fichier/URL IA reste seulement en option avancee repliee. La bibliotheque projet expose aussi le raccourci `Musique IA` avec le meme assistant par theme. Les filtres Openverse sont maintenant orientes styles reels et stables via `source=jamendo` + `category=music` : cinematic, trailer/epic, action trailer, corporate/brand, electronic, house, jazz, ambient/lounge, lofi, hip hop, funk, rock et short commercial ; Freesound reste uniquement comme source Openverse pour impact/whoosh courts. Les filtres generiques Licence/BPM/genre/mood/duree/pages restent masques et les pistes locales Vibe_CUT ne sont plus fallback de scan. Les boutons compacts `generer plus` et `+ resultats` sont descendus sous les compteurs ; `generer plus` explore maintenant une page aleatoire du filtre actif au lieu de changer de categorie pour les scans et relance une variante pour l'IA. Les resultats de l'agregateur ouvrent aussi un panneau preview sous la piste selectionnee, avec waveform, play/pause, stop, temps courant/duree et curseur de seek branche sur le meme player Soundtrack que la bibliotheque. Le bouton `Bibliotheque` ouvre une vue bibliotheque en popup large desktop et fullscreen mobile, sans modes `Imports recents`/`A verifier`, avec import fichier local, musique IA par theme, suppression de pistes, classement par categorie/tags et playlists locales quand Firebase projet n'est pas disponible. L'import Pixabay envoie les IDs/URLs deja presents et les pistes supprimees localement au scraper local, augmente le nombre de candidats scannes et evite de reimporter la meme piste quand on relance le meme theme. Les filtres Pixabay sont structures en familles creatives (Usage video, Cinematique, Humeurs, Genres, Mouvement, Themes, Formats, Duree, Selection) avec des sous-themes mappes vers des recherches Pixabay Music compatibles scraper. La bibliotheque Soundtrack n'injecte plus automatiquement les pistes starter White Bat Audio ni le manifest Pixabay public dans `Toutes`, affiche le nombre de pistes par categorie dans le filtre, afin que l'utilisateur ne voie que ses imports locaux/projet reels ; un bouton `Vider locale` efface les pistes locales, leurs playlists, les blobs audio IndexedDB et les copies dev `public/music/local-imports`. La piste selectionnee dans la bibliotheque deploie un panneau waveform pleine largeur avec play/pause, stop, temps courant/duree et curseur de seek branche sur le player Soundtrack. Les imports locaux persistent maintenant leur blob audio dans IndexedDB et, en dev, une copie disque servie depuis `public/music/local-imports` avec manifest relu au chargement ; les anciennes pistes demo visibles (`Blooming Chill`, `Epic Action Hero`, `Journey in Space`, `Slim Shady`, `Old Movie Ragtime Piano`, `krasnoshchok...`) sont purgees au chargement local. Les favoris/playlists/manifest locaux restent disponibles via IndexedDB + `vibefx-soundtrack.json`, File System Access/fallback download et copie dev locale. L'action `Vibe_CUT` transmet un `Blob/File` local, une URL locale servie par Next ou un blob recupere depuis la piste projet avec manifeste droits.
- Mise a jour 2026-05-25 : le bouton et le panneau `Musique IA` ont ete retires de la popup bibliotheque ; l'assistant IA reste disponible sur la page principale Soundtrack pour eviter la duplication d'interface.
- Mise a jour 2026-05-25 : le bouton `Archives`, l'action d'archivage des pistes et le filtrage `archived` ont ete retires de la popup bibliotheque pour garder un flux importer/supprimer/vider locale explicite.
- Mise a jour 2026-05-25 : l'action playlist sur les lignes de la popup bibliotheque Soundtrack a ete remplacee par un bouton `Telecharger` qui recupere le blob local/URL audio et garde les playlists uniquement dans la colonne de gauche.
- Mise a jour 2026-05-25 : le player bas Soundtrack est remonte via tokens CSS `--soundtrack-player-bottom` / `--soundtrack-player-reserve` pour ne plus chevaucher la barre Next/devtools tout en restant proche du container d'import.
- Mise a jour 2026-05-25 : le player Soundtrack est pilote par un controller global au niveau `VibeFxStudio`, ce qui permet a la musique de continuer pendant les changements d'onglets studio. Le header remplace l'ancien petit MusicPlayer par `SoundtrackHeaderMiniPlayer`, une miniature compacte synchronisee avec le player bas (play/pause, precedent/suivant, auto next/aleatoire et progression segmentee).
- Mise a jour 2026-05-25 : le player Soundtrack gagne une barre de progression seekable, un bouton piste suivante, un mode `Auto next`/`Aleatoire` et l'autoplay de fin de piste. `/api/music/local-file-import` synchronise aussi les MP3 existants de `public/music` et `public/music/pixabay-ai` vers `public/music/local-imports` pour que toute la musique locale remonte dans la bibliotheque.
- Mise a jour 2026-05-25 : le player Soundtrack retire le bouton stop droit, ajoute `Piste precedente` a gauche et remplace le range natif par un scrubber cyber segmente cliquable/drag avec tete lumineuse et progression animee.
- Mise a jour 2026-05-25 : le scrubber Soundtrack est recentre avec FrontSymmetry via une grille player en trois zones symetriques gauche/centre/droite et un micro-ajustement vertical `translateY(-8px)`.
- Le module Vibe_CUT centralise maintenant l'audit et les manifests de droits musique dans `src/features/vibefx-studio/video/data/musicRights.js`; la bibliotheque musique ouvre par defaut sur l'onglet `Gratuit`, l'import audio passe par des presets de sources verifiees/licenciees/IA manuelle, les cartes sources gratuites/licenciees ouvrent le wizard d'import avec preset et lien officiel deja prets, le wizard peut rechercher Openverse, Jamendo et Freesound via `/api/music/free-search`, accepte soit un fichier local soit une URL audio directe via `/api/music/import` allowlistee/cote serveur, precharge l'URL distante pour ecoute avant import timeline, exige source/preuve/licence/usage social avant ajout timeline, supprime le bypass d'upload brut depuis `AudioPanel`, bloque l'export navigateur si le manifeste droits est incomplet, et sauvegarde apres export audio un manifeste droits owner-scoped dans `users/{uid}/rightsManifests/{exportId}` quand Firebase est configure.
- L'ecran vide Vibe_CUT presente la zone d'import video en pleine largeur responsive, alignee avec les marges studio et descendue sous le header pour garder le drop MP4/WebM/MOV lisible sur desktop sans changer le fonctionnement timeline.
- L'export Vibe_CUT borne les volumes media a la plage navigateur valide, desactive le choix MP4 si `MediaRecorder` ne le supporte pas, bascule explicitement vers WebM et affiche les metadonnees de droits/attribution des pistes audio avant export.
- Mise a jour 2026-06-02 : les samples Windows `HDRSample.mkv` et `SDRSample.mkv` ont ete copies dans `vibecut-video-samples/` a la racine pour servir de fixtures locales aux tests Vibe_CUT HDR/SDR.
- Mise a jour 2026-06-02 : l'onglet studio `Video` devient `VibeCut`; l'editeur video ajoute un panneau droit `Outils rapides` avec categories Effets/Texte/Animations cliquables et drag/drop vers la timeline, une action `Supprimer` en haut de timeline pour la selection courante, des presets timeline `Ralenti` 25%/50%/Normal pour le clip selectionne, `npm run test:vibecut-tools` (supprime en phase 7 avec le panneau qu'il testait) et `npm run test:vibecut-slowmo` lance le smoke HDR/SDR MKV `scripts/smoke-vibecut-slowmo-samples.spec.cjs`.
- Mise a jour 2026-06-02 : Vibe_CUT enrichit le moteur canvas `VideoEngine.js` avec de nouvelles transitions wipe/zoom/glitch/blur/lumiere, des categories `Intro` et `Outro`, des volets de debut/fin exportables, des presets rapides `Volets` qui posent transition + texte synchronise, et de nouvelles animations texte d'entree/sortie (`neon-scan`, `tracking-in`, `wipe-mask`, `glitch-out`, etc.).
- Mise a jour 2026-06-02 : l'import Vibe_CUT detecte best-effort la cadence source via les tables MP4 `mdhd/stts` puis fallback `requestVideoFrameCallback` a timestamps uniques, preserve les sources haute cadence jusqu'a 60 FPS au lieu de les normaliser en 30 FPS, lit best-effort la matrice d'orientation MP4, ajoute une rotation 90 deg gauche/droite par clip dans le header et dans la timeline pour corriger les fichiers encodes couches, expose les badges FPS/rotation sur les clips timeline, et le panneau export comme le header permettent de forcer `Auto/24/25/30/50/60 FPS`.
- Mise a jour 2026-06-02 : la preview Vibe_CUT retire les rings/bordures externes du canvas, garde les safe areas sans contour perimetrique blanc, rend le canvas a la resolution du preset export (`1080x1920`, `1920x1080`, etc.) plutot qu'a la petite taille CSS affichee, active le smoothing haute qualite, et en lecture suit le `currentTime` du media actif quand possible pour se rapprocher d'un lecteur video natif Windows.
- Mise a jour 2026-06-02 : la lecture Vibe_CUT reduit la pression React pendant playback : le moteur conserve un temps interne par frame pour le canvas/audio, tandis que `currentTime` du store et la timeline sont rafraichis a cadence reduite, ce qui libere plus de budget pour la preview video fluide.
- Mise a jour 2026-06-02 : le select FPS du header/panneau export pilote aussi la cadence preview. `Auto` garde la cadence native disponible, `30 FPS` cadence proprement la preview en drop/pacing regulier sans changer la vitesse, et le moteur bloque l'avance interne tant que le media actif n'a pas vraiment demarre pour eviter les petites accelerations.
- Mise a jour 2026-06-02 : la boucle live preview Vibe_CUT utilise `HTMLVideoElement.requestVideoFrameCallback` quand disponible pour dessiner au rythme des vraies frames decodees, avec fallback `requestAnimationFrame`; le bouton plein ecran cible maintenant le shell preview complet afin de garder la video et les controles dans le mode full view.
- Mise a jour 2026-06-02 : Vibe_CUT ajoute un mode `Preview grand format` depuis le canvas, avec lecteur preview agrandi, action `Lire tout`, select de format preview/export, rotation gauche/droite du clip selectionne, rail desktop de depot video + playlist sequencee, navigation par clip vers son timecode et tiroir mobile compact de depot/liste; la lecture reste celle de la timeline canonique pour enchainer tous les clips.
- Mise a jour 2026-06-03 : Vibe_CUT retire l'overlay `Safe areas` des previews normale et grand format, ajoute des primitives FrontSymmetry pour centrer les icones dans les boutons carres/frames (`vibecut-square-button`, `vibecut-icon-frame`, `vibecut-action-button`, `vibecut-upload-glyph`), recentre les actions import/export/PNG/publication, et met a jour le smoke test pour verrouiller l'absence de safe area.
- Mise a jour 2026-06-03 : Vibe_CUT expose le meme export navigateur depuis la preview grand format via `useVideoExportController`, avec telechargement du rendu final applique aux rotations, transitions, textes, audio et filtres; le panneau Filtres devient une colorimetrie avancee SDR social avec presets cinema, exposition, pivot, vibrance, temperature/teinte, hue, ombres/mediums/hautes lumieres, fade, vignette et grain, appliques dans `VideoEngine.js` a la preview comme a l'export. La preview grand format affiche maintenant aussi un bouton `Colorimetrie` qui ouvre ce panneau dans le rail droit desktop ou sous la preview mobile. L'export navigateur utilise une capture sequentielle du moteur a FPS cible, un bitrate adapte a la resolution/FPS et une barre de progression visible dans la preview grand format afin de limiter les exports saccades et la perte de qualite percue.
- La roadmap timeline/export Vibe_CUT introduit `src/features/vibefx-studio/video/model/timelineModel.js` comme adaptateur canonique `tracks[]`/`items[]`, avec resolver pur `resolveTimelineTransitions` unifiant transitions libres et transitions de coupe en objets `id/type/start/duration/fromItemId/toItemId/trackId/params`, plan de rendu commun `resolveTimelineRenderPlan` consomme par preview/export/scrub playhead/split toolbar, rendu moteur alimente par `allTransitions` unifiees, validation pure `validateTimelineRenderPlan` pour trous/overlaps video, overlap transitions libres, transitions hors bornes et audio hors timeline, moteur `PlaybackEngine` capable de selectionner les clips via `start/duration` resolus avec fallback legacy et de remonter les echecs decode/chargement media, rendu des lanes video/transitions/filtres/textes/audio integre/musique depuis `items[]` avec volumes canonises via `clampVolumePercent`, filtres clips exposes comme items `effect-main` de type `effect` et lane Filtres compacte verrouillable sans changer le rendu existant, transitions de coupe et transitions libres presentes dans `items[]` avec `params.placement` et `params.editable`, lane Effets limitee aux transitions libres editables et sans chevauchement via `findTransitionItemOverlap`, panneaux Transitions/Audio/Texte/Filtres/Vitesse relus sur l'etat `tracks` pour desactiver les controles des pistes verrouillees, routeur store `updateTimelineItem`, `updateClip`, `add/remove/updateAudioTrack`, `add/remove/updateTextOverlay`, `setTransition`, `add/update/removeTransitionItem` avec refus si la piste cible est verrouillee, validation export fps/duree/audio/codec, helper pur `buildExportFrameSchedule` pour figer `duration/fps -> totalFrames/frameDuration`, helper pur `validateExportFrameCoverage` pour verifier qu'une transition a au moins une frame planifiee au FPS export, helpers purs de snap magnetique, extraction waveform audio client dans `utils/audioWaveform.js`, transactions undo/redo pour edits timeline, selection audio timeline, rendu export par `seekAndDraw` async avec arret sur nombre de frames planifie, erreur lisible si une frame video attendue ne rend aucun clip et conservation de l'erreur sans telechargement partiel sur echec MediaRecorder/rendu, resume export affichant format demande et format reel apres fallback MP4/WebM, grain/glitch/pixel-scatter deterministes par timestamp, overlay safe areas verticales dans la preview, inputs timecode trim in/out pour le clip selectionne et start/duree pour transitions/textes/audio, controles lock/mute/visible sur les pistes, application des pistes mute/visible a la preview/export, indicateur de drop reorder, waveform timeline deterministe/reelle sur pistes musique importees, toolbar mobile avec export sticky, panneau mobile compact moins couvrant et mode plein ecran explicite, et smoke video renforce sur safe areas/timecode/timestamp de transition/timecode item/verrou pistes Effets/Filtres/etats de pistes/snap/drop/waveform/undo trim/echec export sans blob partiel/plan de frames/fallback MP4 vers WebM/mobile petite hauteur.
- Les dernieres passes Vibe_CUT renforcent encore l'export et la preview : mix audio export cree desormais un flux audio si les clips video sont audibles meme sans piste musique externe, resume export affiche `Audio export` et `Controle frames`, garde-fou de frames noires consecutives bloque les exports qui rendraient une video active en noir, `PlaybackEngine` consomme les transitions de coupe canoniques `allTransitions` pour preview/export/audio avec fallback legacy, les waveforms des clips video sont extraites best-effort a l'import avec fallback explicite, et le panneau Filtres propose un mode preview Avant/Apres qui neutralise les filtres uniquement dans la preview et se reinitialise a la fermeture/changement de panneau.
- Mise a jour 2026-06-03 : Vibe_CUT ajoute l'architecture Export Pro Cloud local-first. `src/features/vibefx-studio/video/export/exportManifest.js` cree un manifeste MP4/H.264/AAC versionne avec clips/transitions/textes/audio/droits/estimations, `exportStorageService.js`, `exportRenderService.js` et `exportJobService.js` simulent en localMock les phases Preparation/Mise en file/Rendu/Encodage/Finalisation avec annulation, retry, logs et historique, et basculent en mode `firebase` vers upload Storage + callable `createVideoExportJob`. `ExportVideoPanel.jsx` expose `Export Pro MP4` comme chemin principal et relabelise l'ancien MediaRecorder en `Export rapide navigateur (brouillon)`, `render-service/` contient un MVP Cloud Run FFmpeg signe qui telecharge les sources Storage, encode un MP4 simple et uploade l'output, `functions/src/videoExport.js` expose les callables create/cancel/retry avec validation manifeste serveur, App Check, statut Firestore et appel renderer, `.env.example` ajoute les variables Export Pro, `MusicLibrary.jsx` ajoute les pistes starter immediatement puis extrait la waveform en best-effort, et `npm run test:vibecut-export` couvre le manifeste/jobs mock tandis que `npm run test:video-ui` cible explicitement le fallback navigateur.
- Mise a jour 2026-05-25 : la timeline Vibe_CUT generalise les pistes empilables au-dela du texte. `timelineModel.js` distingue maintenant les roles `transition`, `effect`, `text`, `clip-audio` et `music`, et `resolveTimelineRenderPlan` rend toutes les timelines visibles de transitions, filtres, textes et musiques. `videoStore.js` ajoute `addTimelineTrack` / `removeTimelineTrack`, conserve `addTextTrack` comme alias, place automatiquement les imports musique qui chevauchent sur une timeline libre/nouvelle, bloque la suppression des pistes systeme et des pistes non vides, puis expose des notices lisibles. `Timeline.jsx` aligne les headers et lanes avec des ordres symetriques, ajoute les boutons +/suppression par piste, affiche les timelines supplementaires et remplace les anciennes lignes blanches par des separateurs sombres inline. `AudioPanel.jsx` permet de deplacer une piste musique entre timelines. Les smoke tests video couvrent les timelines supplementaires, le rendu multi-pistes et les suppressions protegees.
- `docs/production-ai-monetization-security-megaprompt.md` cadre la suite production : scouting fournisseurs IA globaux (US/EU/Chine/Asie/open-weight/aggregateurs/marketplaces), modele credits, Stripe Checkout/webhooks, dashboard utilisateur, securite anti-abus, Cloud Run/FFmpeg, model router et roadmap par lots.
- `docs/production-saas-audit.md` formalise la passe 0 du megaprompt production : etat Auth/Firestore/Storage/Functions, surfaces privees/noindex, schemas Firestore/Storage proposes, rules cible, mapping Stripe, `aiPricingPolicies`, router IA v1, registry providers avec statuts prudents, risque Midjourney/scraper et plan de tests emulateurs/Stripe CLI.
- Les pages SEO publiques prioritaires sont creees en Server Components via `src/app/components/SeoLandingPage.jsx` et `src/app/seo-pages.js`, avec canonical/metadata/JSON-LD et presence dans `sitemap.xml` sans importer le bundle studio.
- Lot 1 est amorce avec `/account` : Auth anonyme de test, liaison Google/email, profil `users/{uid}` minimal, lecture dashboard de `creditBalance`, `payments` et `aiJobs`, suppression compte via reauth client Google/email puis callable serveur `requestAccountDeletion` avec authentification recente obligatoire (purge Storage `users/{uid}/`, suppression publications owner, scrub jobs/checkouts, tombstone user, delete Auth), sans ecriture client sur credits, ledger, payments ou jobs.
- Lot 2 est amorce cote serveur avec `functions/src/billingProducts.js` pour le mapping `priceId -> entitlement`, `functions/src/billingSession.js` pour valider priceId/metadonnees Checkout, `functions/src/billingEvents.js` pour gerer `checkout.session.completed`, `async_payment_succeeded`, `async_payment_failed` et `expired`, `functions/src/billing.js` pour Checkout/webhook, et `/account/billing` pour lancer l'achat lifetime 9,99 EUR depuis un compte permanent puis afficher un historique d'achats simplifie. Le webhook marque aussi `checkoutSessions/{id}` en `fulfilled` ou `expired/failed` pour garder le suivi serveur coherent. `npm run test:billing-ledger` verifie le fulfillment premium/credits, le replay `event.id`, le replay d'une deuxieme event sur la meme session, le statut `checkoutSessions` succes/echec, et le marquage expired sans emulateur.
- Lot 3 est amorce cote serveur avec `createAiJob` : Auth obligatoire, App Check enforce par defaut hors emulateurs, policy serveur `aiPricingPolicies` ou bootstrap mock local, calcul cout/marge par policy (`estimatedProviderCostUsd`, buffers, `targetGrossMargin`, `minCreditsForTargetMargin`) avec blocage automatique sous seuil, registry providers IA global (`OpenAI`, `Anthropic`, `Gemini`, `Groq`, Chine/Asie, aggregateurs, marketplaces) tous `productionAllowed=false` tant que non verifies, router provider/model avec `routeCandidates` et score pondere `quality 0.35 + margin 0.25 + latency 0.15 + reliability 0.15 + legalSafety 0.10`, audit de selection persiste dans `aiJobs.routeAudit` (`routeScores`, `rejectedCandidates`, pricing/marge), reserve credits en transaction, ledger `reserve/capture/release`, rate limit par uid/feature/ipHash/minute, stockage de `requestIpHash` sans IP brute, provider mock sans appel externe, blocage production du mock, reconciliation planifiee `reconcileStaleAiReservations` toutes les 15 minutes pour liberer les reservations IA perimees, et journalisation serveur `securityEvents` des refus IA sensibles sans prompt brut. `/account/usage` expose un formulaire de lancement qui appelle le callable serveur et relit l'historique `aiJobs`; `npm run test:ai-gateway` couvre aussi l'economie des policies, le scoring/fallback multi-candidats, le rejet Midjourney et la normalisation IP, et `npm run test:ai-ledger` couvre reserve/capture/release, double appel, audit route, credit insuffisant, rate limit uid/feature/ipHash, liberation de reservation perimee et redaction des security events sans emulateur.
- Les callables Meta, Stripe Checkout, IA et Export Pro partagent `functions/src/appCheck.js` : App Check est actif par defaut en production, desactivable seulement par `ENFORCE_*_APP_CHECK=false` pour une session locale controlee; `npm run test:app-check` et `npm run test:scope` verrouillent ce comportement.
- `firestore.rules` interdit les ecritures client sur `users/{uid}/creditLedger`, `aiJobs`, `videoExportJobs`, `aiRateLimits`, `payments`, `checkoutSessions`, `accountDeletionRequests`, `stripeEvents`, `aiPricingPolicies`, `aiProviderPriceSnapshots`, `providerRegistry` et `securityEvents`; il autorise aussi les metadata owner-scoped `users/{uid}/soundtrackTracks/{trackId}` avec champs allowlistes. `storage.rules` ajoute uploads prives images/audio/video, fichiers projet Soundtrack `users/{uid}/soundtrack/...` limites aux MIME audio, autorise les sources d'export owner-scoped et bloque les outputs IA/export en ecriture client.
- La landing page unique `/` est optimisée pour le Server-Side Rendering (SSR) et regroupe le hero produit, 4 cartes de fonctionnalités descriptives, une section FAQ complète, et l'animation SVG de routage `PublicationRoutePipeline`.
- Le premier lancement prod sans IA est pilote par `src/config/aiLaunch.js` : `NEXT_PUBLIC_VIBEFX_AI_INTERFACES_ENABLED` vaut off par defaut, `/backoffice` ajoute un override localStorage/cookie, le header public pointe temporairement vers le backoffice, la page pricing expose seulement l'offre lifetime 9,99 EUR et l'espace compte masque les credits/jobs IA avec un wording utilisateur simplifie, le studio ne monte plus le rail agents IA ni les boutons AI clip, l'onglet Library/Midjourney et ses selectors sont masques, Soundtrack filtre les providers de generation IA, et `/api/music/ai-*` retourne 404 sauf flag/cookie actif.
- Mise a jour 2026-06-05 : le backoffice ajoute un bloc Export telemetry lisant `videoExportJobs` owner-scoped via Firebase client, avec agregats jour/semaine/mois, cout Cloud Run/Storage estime, table des jobs recents et smoke `npm run test:backoffice-export-telemetry`; une vraie vue admin globale reste a faire via callable serveur/admin claims.
- Mise a jour 2026-06-05 : le renderer Cloud Run Vibe_CUT applique maintenant `clips[].orientationRotation` via FFmpeg (`90`, `180`, `270`). Smoke live controle execute sur `K1/MVI_0126.MP4` avec rotation gauche `270`, trim 3s et sortie Storage `manual-k1-rotate-left-20260605-200305` : status renderer `ready`, output MP4 1080x1920, duree 3s, POST non signe refuse en 401.
- Mise a jour 2026-06-05 : `docs/vibecut-export-production-hardening-megaprompt.md` est recadre pour la release Export Pro : il retire les etapes obsoletes de preuve Cloud Run simple, conserve les gates deploy/live avec confirmation, ajoute le choix de destination desktop/PC via download ou File System Access API, impose une UX de progression export, et finit par un smoke live officiel avec deux videos K1 avant `Go release beta`.
- Mise a jour 2026-06-05 : le megaprompt Export Pro adopte une doctrine renderer-first : le navigateur devient cockpit de pilotage, le manifest canonique devient source contractuelle, le renderer serveur doit produire les textes, animations, transitions, colorimetrie, audio et video avant encodage FFmpeg, et toute feature visible non rendue serveur doit etre bloquee ou masquee avant export pro.
- Mise a jour 2026-06-05 : Phase 1 hardening Export Pro amorcee. `ExportVideoPanel.jsx` utilise maintenant `resolveExportRenderMode()` au preflight, launch et retry au lieu de forcer `localMock`, affiche le mode actif `Rendu Cloud Firebase` / `Simulation locale`, et accepte le preflight Firebase avec upload client avant callable; `exportRenderService.js` et `exportStorageService.js` centralisent l'alias `server -> firebase`, `apphosting.yaml` declare `NEXT_PUBLIC_VIBECUT_EXPORT_MODE=firebase`, et `npm run test:vibecut-export` echoue si le panneau force de nouveau `localMock`.
- Mise a jour 2026-06-05 : Phase 2 hardening Export Pro avancee. `exportManifest.js` ajoute estimations `sourceSize`/`cost` et `validateExportRenderCoverage()` pour bloquer les features visibles non rendues serveur (textes, transitions, vitesse, colorimetrie, audio clip/musique, fit non supporte) au lieu de les ignorer; `ExportVideoPanel.jsx` affiche compatibilite `Exportable pro`/`Bloque`, cout/taille source, etapes Preparation/Upload/Queue/Rendu/Encodage/Finalisation/Output, et details output Storage/MP4 une fois `ready`; `exportJobService.js` expose `subscribeLatestVideoExportJob()` pour restaurer le dernier job Firestore owner-scoped apres refresh en mode Firebase et l'UI expose aussi l'etat `retrying`.
- Mise a jour 2026-06-05 : Phase 3 hardening Export Pro ajoute la destination desktop/PC. `ExportVideoPanel.jsx` propose `Telechargements` ou `Dossier PC` quand un vrai MP4 Storage est pret, genere un nom `vibecut-{projet}-{yyyyMMdd-HHmm}.mp4`, recupere une URL via `getDownloadURL()` quand le job n'a que `output.storagePath`, et utilise File System Access API seulement apres clic utilisateur; `scripts/smoke-vibecut-export-jobs.mjs` verifie ces garde-fous statiques.
- Mise a jour 2026-06-05 : Phase 4 hardening Export Pro amorcee cote Functions. `functions/src/videoExport.js` valide les chemins `users/{uid}/exports/{job}/sources/video|audio`, applique des quotas MVP (duree, clips, audio tracks, resolution, FPS, bitrates, manifest et taille sources), stocke le manifest complet en JSON Storage avec un resume leger dans `videoExportJobs`, ajoute un stub explicite plan/credits, logge les rejets sans donnees sensibles et expose `getVideoExportDownloadUrl`; `npm run test:vibecut-export` inclut maintenant `scripts/smoke-vibecut-export-functions.mjs`.
- Mise a jour 2026-06-05 : Phase 5 renderer-first avancee. `render-service/src/server.js` mixe maintenant les pistes audio externes via FFmpeg avec `atrim`, `adelay`, volume et `amix`, tandis que `functions/src/videoExport.js`, `exportManifest.js` et le renderer refusent encore les features visibles non rendues serveur (animations texte complexes, transitions non supportees, vitesse, fit unsupported) au lieu de les passer en warnings; `scripts/smoke-vibecut-render-service-contract.mjs` verrouille ce comportement. Le renderer frame-by-frame pour les animations/transitions complexes reste a implementer avant release complete.
- Mise a jour 2026-06-05 : Phase 5 renderer-first ajoute le rendu serveur des textes basiques. `render-service/src/server.js` applique les overlays `textOverlays` avec FFmpeg `drawtext` (contenu, start/end, position normalisee, taille, couleur, fade in/out ou none), `functions/src/videoExport.js` et `exportManifest.js` autorisent ces textes fade/none et continuent de bloquer les animations texte complexes (`scale`, `slide`, `neon-scan`, etc.) jusqu'au renderer frame-by-frame; les smokes Export Pro couvrent texte supporte et animation texte refusee.
- Mise a jour 2026-06-05 : Phase 5 renderer-first ajoute une colorimetrie serveur explicite. `render-service/src/server.js` mappe les filtres Vibe_CUT connus vers FFmpeg (`eq` pour exposition/luminosite/contraste/saturation/vibrance, `hue`, `colorbalance` pour temperature/teinte/ranges, `colorlevels` pour fade, `vignette`, `noise` pour grain); `functions/src/videoExport.js` et `exportManifest.js` autorisent ces cles et refusent les filtres inconnus non nuls. Le rendu colorimetrie serveur reste une implementation FFmpeg controlee, pas une promesse pixel-perfect du canvas.
- Mise a jour 2026-06-05 : Phase 5 renderer-first ajoute les transitions serveur adjacentes `fade`/`crossfade`. `render-service/src/server.js` construit une chaine FFmpeg `xfade=transition=fade` entre clips adjacents en placement `cut`, conserve le concat pour les coupes franches et bloque les transitions non adjacentes/free ou les familles slide/wipe/zoom; `functions/src/videoExport.js`, `exportManifest.js` et les smokes valident la meme matrice.
- Mise a jour 2026-06-06 : hardening Export Pro post-audit. La validation Functions n'interdit plus l'audio source des clips puisque le renderer FFmpeg le mixe, `retryVideoExportJob` relance maintenant un vrai rendu Cloud Run au lieu de recreer seulement un job `queued`, le client passe le `jobId` au retry serveur pour reutiliser le manifest stocke apres refresh, les signatures renderer sont liees a `x-vibecut-timestamp` avec fenetre anti-replay, et `scripts/run-video-ui-test.mjs` neutralise Firebase/App Check/Meta live pour garder le smoke Vibe_CUT local et fiable.
- Mise a jour 2026-06-06 : `render-service/README.md` decrit maintenant le contrat reel du renderer Cloud Run (signature timestamp anti-replay, textes drawtext, transitions fade/crossfade adjacentes, colorimetrie FFmpeg, rotations et mix audio source/externe) et `scripts/smoke-vibecut-render-service-contract.mjs` verifie que la documentation ne retombe pas sur les anciennes limites concat-only.
- Mise a jour 2026-06-06 : le modal Export Pro derive maintenant le container, le codec et le MIME depuis `render`/`output` au lieu de hardcoder MP4/H.264, `exportRenderService.js` et `exportJobService.js` preservent les metadata `projectName`/`render`/`estimates` apres callable Firebase, retry et refresh Firestore, et les smokes `test:vibecut-export` + `test:video-ui` verrouillent ces informations de sortie visibles.
- Mise a jour 2026-06-06 : `scripts/prepare-vibecut-k1-live-smoke.mjs` prepare le smoke final K1 sans appel Cloud : verification de `MVI_0126.MP4` + `MVI_0117.MP4`, manifest 1080x1920 30fps MP4 H.264/AAC avec trim court, rotation, crossfade adjacent, texte fade et estimations source/output/cout; `npm run test:vibecut-export` l'execute en dry-run et rappelle que le live requiert `OK pour smoke live Cloud Run K1`.
- Mise a jour 2026-06-06 : `functions/src/videoExport.js` prepare le passage Cloud Run prive avec `EXPORT_RENDERER_AUTH_MODE=oidc` ou `hmac+oidc` : la Function peut recuperer un ID token via metadata server pour l'audience renderer et l'ajouter en `Authorization: Bearer`, tout en conservant les signatures HMAC timestamp; les smokes Functions verrouillent ce chemin sans deploy ni appel cloud.
- Mise a jour 2026-06-06 : `executeRendererForJob` relit maintenant le job Firestore apres le retour Cloud Run et conserve `cancelled` si l'utilisateur a annule pendant FFmpeg; l'output termine est trace dans `cancelledOutput` avec `ignoredAfterCancel` au lieu d'ecraser le job en `ready`, et le smoke Functions verrouille ce comportement.
- Mise a jour 2026-06-06 : les transitions Firestore `queued -> rendering` et `renderer error -> failed` sont maintenant protegees par transaction via `markJobRenderingUnlessCancelled` et `markJobFailedUnlessCancelled`, afin qu'un cancel concurrent ne puisse plus etre ecrase par `rendering` ou `failed`; le smoke Functions interdit les catchs renderer qui ecrivent `failed` directement.
- Mise a jour 2026-06-06 : `getVideoExportAdminTelemetry` ajoute une callable admin globale pour les jobs export video recents, protegee par custom claim `admin`, `ADMIN_EMAILS` ou `admins/{email}` actif; elle retourne des jobs sanitises, agregats statut/cout/taille/temps moyen sans fuite de paths Storage ni URLs signees. Le backoffice tente cette vue globale puis retombe sur la lecture owner-scoped, et `npm run test:backoffice-export-telemetry` verifie les deux chemins.
- Mise a jour 2026-06-06 : `docs/vibecut-export-production-runbook-2026-06-06.md` documente la source de verite deploy Export Pro (App Hosting, Functions, Secret Manager, Cloud Run public/HMAC puis prive/OIDC, gates locaux, dry-run/live K1, rotation du secret et limites no-go); `scripts/smoke-vibecut-export-runbook.mjs` est ajoute a `npm run test:vibecut-export`.
- Mise a jour 2026-06-06 : `scripts/prepare-vibecut-pro-fixtures.mjs` formalise les fixtures pro hors Cloud : texte statique, transition crossfade, colorimetrie FFmpeg, audio externe et pile combinee sont verifies exportables par manifest/coverage, tandis que l'animation texte avancee `neon-scan` reste explicitement bloquee jusqu'au renderer frame-by-frame; le runbook et `npm run test:vibecut-export` incluent ce constat.
- Mise a jour 2026-06-06 : `docs/vibecut-export-hardening-status-2026-06-06.md` consolide l'audit Export Pro par phase et garde le verdict en `pre-release hardening` sans `Go release beta` tant que le smoke live K1, les MP4 finaux des fixtures pro et `npm run test:emulators` ne sont pas valides; `scripts/smoke-vibecut-export-status-audit.mjs` est ajoute a `npm run test:vibecut-export` pour verrouiller ces blocages.
- Mise a jour 2026-06-06 : `scripts/check-vibecut-export-release-gate.mjs` ajoute un gate non mutant `npm run check:vibecut-export-release` qui echoue explicitement tant que les preuves release manquent (Phase 5/6/7 partielles, K1 live absent, Java emulateurs absent, fixtures MP4 non generees, deploy non execute).
- Mise a jour 2026-06-06 : `scripts/render-vibecut-k1-local-mp4-smoke.mjs` ajoute `npm run test:vibecut-k1-local-mp4`, un smoke local sans Cloud qui doit produire un MP4 K1 1080x1920 H.264/AAC avec rotation, crossfade, texte et verification ffprobe/blackdetect; il est separe des tests verts tant que `ffmpeg`/`ffprobe` ne sont pas disponibles dans le PATH local.
- Mise a jour 2026-06-06 : `scripts/check-vibecut-export-local-prereqs.mjs` ajoute `npm run check:vibecut-export-prereqs` pour verifier sans Cloud les sources K1, `ffmpeg`, `ffprobe` et Java; le smoke MP4 local accepte maintenant aussi `VIBECUT_FFMPEG_PATH`, `FFMPEG_PATH`, `VIBECUT_FFPROBE_PATH`, `FFPROBE_PATH` et des chemins Windows courants.
- Mise a jour 2026-06-06 : `ffmpeg-static` et `ffprobe-static` sont ajoutes en devDependencies pour lever le blocage FFmpeg local; `npm run test:vibecut-k1-local-mp4` produit maintenant un MP4 K1 local verifie 1080x1920 H.264, 30 fps, 5.5s, audio present et frames non noires. Java reste absent pour `npm run test:emulators`.
- Mise a jour 2026-06-06 : `scripts/render-vibecut-pro-fixtures-local-smoke.mjs` ajoute `npm run test:vibecut-pro-fixtures-local-mp4`, qui genere localement les MP4 des fixtures supportees `static-text`, `crossfade-transition`, `color-filters`, `external-audio` et `combined-supported`, puis verifie codec H.264, 1080x1920, duree, audio attendu, frames non noires et region texte lumineuse.
- Mise a jour 2026-06-06 : `docs/vibecut-export-hardening-status-2026-06-06.md` distingue maintenant les fixtures pro MP4 locales validees du blocage restant des fixtures finales via renderer canonique/Cloud Run, afin de ne pas confondre preuve FFmpeg locale et release beta serveur.
- Mise a jour 2026-06-06 : `npm run test:vibecut-export-local-mp4` regroupe les preuves MP4 locales lourdes (`test:vibecut-k1-local-mp4` + `test:vibecut-pro-fixtures-local-mp4` + `test:vibecut-renderer-local-contract`) a relancer juste avant tout smoke Cloud Run live.
- Mise a jour 2026-06-06 : `npm run test:emulators` passe maintenant par `scripts/run-firebase-emulators-test.mjs`, qui exige Java 21+ via `VIBECUT_JAVA_HOME`, `JAVA_HOME`, PATH ou chemins Windows courants avant de lancer `firebase emulators:exec`; la machine a montre un Java trop ancien pour `firebase-tools`, donc Java 21+ reste le blocage emulateurs.
- Mise a jour 2026-06-06 : le modal Export Pro normalise maintenant les codecs de sortie (`H.264`, `H.265/HEVC`, `VP9`, `AV1`, `AAC`, etc.) et mappe les formats futurs vers leur MIME (`video/webm`, `video/quicktime`, images) au lieu de presenter tout fallback comme MP4; `scripts/smoke-vibecut-export-jobs.mjs` verrouille ce comportement et `npm run test:video-ui` reste vert.
- Mise a jour 2026-06-06 : `render-service/src/server.js` exporte `validateManifest`, `validateRendererCoverage` et `buildFfmpegArgs`, ne demarre plus le serveur HTTP quand il est importe par un smoke local, et lazy-load `@google-cloud/storage`; `scripts/render-vibecut-renderer-local-contract-smoke.mjs` utilise ce contrat canonique pour rendre localement K1 + une fixture combinee avec le meme graphe FFmpeg que le service Cloud Run.
- Mise a jour 2026-06-06 : `scripts/audit-vibecut-export-hardening-requirements.mjs` ajoute une matrice locale non mutante des exigences `docs/vibecut-export-production-hardening-megaprompt.md` avec statuts `done`, `done_mvp`, `partial` et `blocked`; `npm run test:vibecut-export` l'execute pour verifier que les preuves code/docs restent coherentes et que le statut ne devient pas `Go release beta` tant que Java 21+, le smoke live K1 et les preuves Cloud Run finales manquent.
- Mise a jour 2026-06-06 : `scripts/guard-vibecut-k1-live-smoke.mjs` ajoute `npm run guard:vibecut-k1-live`, un sas non mutant avant smoke Cloud Run K1 qui refuse de s'armer sans `VIBECUT_LIVE_CONFIRM="OK pour smoke live Cloud Run K1"`, refuse `VIBECUT_EXECUTE_LIVE=1`, verifie les sources K1, les gates MP4 locaux, les emulateurs et les variables live, puis laisse l'action Cloud unique au runbook humain.
- Mise a jour 2026-06-06 : `scripts/verify-vibecut-k1-cloud-output.mjs` ajoute `npm run verify:vibecut-k1-cloud-output`, un gate post-smoke local qui prend `VIBECUT_CLOUD_OUTPUT_FILE` ou un chemin MP4 en argument et verifie le fichier telecharge Cloud Run : container MP4-compatible, H.264, AAC, 1080x1920, ~30 FPS, ~5.5s, audio present et frames non noires.
- Mise a jour 2026-06-06 : `src/features/vibefx-studio/video/export/exportMediaMetadata.js` centralise la resolution front des metadata output Export Pro (container, codec, MIME) pour eviter les hardcodes dans `ExportVideoPanel.jsx`; `scripts/smoke-vibecut-export-media-metadata.mjs` execute la matrice MP4/WebM/MOV/PNG/JPEG/WebP et codecs H.264/H.265/VP9/AV1/ProRes/DNxHR/AAC/Opus, y compris les exports image sans faux codec audio.
- Mise a jour 2026-06-06 : `functions/src/videoExport.js` ajoute l'orchestration async optionnelle `EXPORT_RENDER_ORCHESTRATION=taskQueue` avec `processVideoExportJob` en Task Queue Function; `createVideoExportJob` et `retryVideoExportJob` peuvent desormais creer le job Firestore, enqueue Cloud Tasks puis retourner `queued` rapidement, tandis que le worker relit le manifest Storage owner-scoped, respecte les jobs terminaux/cancel et lance le renderer.
- Mise a jour 2026-06-06 : la securite renderer distingue maintenant l'auth d'appel Functions (`EXPORT_RENDERER_AUTH_MODE=hmac`, `hmac+oidc`, `oidc`) et la verification applicative Cloud Run (`EXPORT_RENDERER_VERIFY_MODE=hmac` par defaut ou `platform-iam` seulement avec `EXPORT_RENDERER_PRIVATE_IAM_CONFIRMED=true`), pour eviter un endpoint public sans HMAC tout en preparant le passage prive IAM.
- Mise a jour 2026-06-07 : le backoffice Export telemetry separe maintenant l'estimation interne des jobs et le cout Google reel lu via Cloud Billing Export BigQuery (`CLOUD_BILLING_EXPORT_TABLE` ou variables projet/dataset/table), expose `cloudBilling` depuis `getVideoExportAdminTelemetry`, ajoute les cartes facture Cloud Run et garde un fallback explicite quand BigQuery n'est pas configure.
- Mise a jour 2026-06-07 : Vibe_CUT unifie les outils rapides et les panneaux detailles dans le panneau droit unique pour liberer la preview; les transitions visibles sont recentrees sur les passages entre clips (Film/Cross Dissolve, Smooth Cut, Blur Dissolve, Whip Pan, Cross Zoom, Light Leak), les transitions `placement=cut` reapparaissent sur la piste Transitions et dans la preview, les effets sont renommes en looks clip, et le backoffice ajoute une connexion dev + totaux couts exports/facture Google.
- Mise a jour 2026-06-07 : deux smokes live K1 sont ajoutes. `run-vibecut-k1-cloud-run-live-smoke.mjs` teste le chemin callable Firebase complet quand un token Auth valide est fourni, et `run-vibecut-k1-cloud-run-direct-smoke.mjs` teste directement le renderer Cloud Run signe HMAC. Le smoke direct a rendu `K1/MVI_0126.MP4` + `K1/MVI_0117.MP4` avec rotation gauche 270 et crossfade sur la revision Cloud Run `vibecut-render-service-00004-mz5`; le MP4 telecharge `C:\Users\pcpor\OneDrive\Bureau\K1\vibecut-k1-cloudrun-direct-20260607T105813.mp4` passe `npm run verify:vibecut-k1-cloud-output`.
- Mise a jour 2026-06-07 : deploy backend Firebase revalide. `scripts/firebase-deploy.mjs` utilise le binaire local `firebase-tools` via Node et augmente `FUNCTIONS_DISCOVERY_TIMEOUT`; `scripts/check-emulator-readiness.mjs` accepte `VIBECUT_JAVA_HOME`. Java 21 portable debloque `npm run test:emulators`. Les callables restent en `europe-west9`, tandis que `processVideoExportJob` et `reconcileStaleAiReservations` passent en `europe-west1` car Cloud Tasks/Scheduler ne supportent pas `europe-west9`; une cleanup policy Artifact Registry 7 jours est configuree en `europe-west1`.
- Mise a jour 2026-06-06 : `scripts/smoke-vibecut-export-coverage-parity.mjs` verrouille la parite client/Functions/renderer sur 12 cas de couverture Export Pro : textes fade, crossfade adjacent, filtres connus, audio externe acceptes; animation texte avancee, transition non supportee/non adjacente, slow motion, fit unsupported, filtre inconnu et texte vide bloques aux trois etages.
- Mise a jour 2026-06-06 : `scripts/render-vibecut-pro-fixtures-local-smoke.mjs` recree le dossier parent avant chaque sortie FFmpeg pour rendre le gate `npm run test:vibecut-export-local-mp4` robuste si `test-results` est nettoye pendant une passe de controles; le gate local MP4 repasse OK apres correction.
- Mise a jour 2026-06-06 : ajout d'un module `src/features/export/` pour structurer l'Export Pro facon panneau DaVinci/Premiere adapte web : presets sociaux, formats/codecs avec statuts ready/server_required/future, reglages Video/Audio/File/Advanced, estimation taille, sanitization filename, queue locale et export image canvas PNG/JPEG/WebP; `ExportVideoPanel.jsx` branche ce panneau et alimente le manifest par overrides sans masquer que le renderer final supporte seulement MP4 H.264/AAC aujourd'hui.
- Mise a jour 2026-06-07 : menage documentaire dans `docs/`. Les anciens prompts/audits et l'archive Export Pro legacy sont supprimes; les sources conservees sont `studio-ai-agents-megaprompt.md`, `vibecut-export-production-hardening-megaprompt.md`, `vibecut-export-hardening-status-2026-06-06.md`, `vibecut-export-production-runbook-2026-06-06.md` et `vibecut-export-pro-checkpoint-2026-06-06.md`.
- Mise a jour 2026-06-07 : `docs/vibecut-cost-telemetry-architecture-2026-06-07.md` formalise la telemetry couts cible VibeCut : estimation live par job, Monitoring/Logging Cloud Run, facture officielle Billing Export BigQuery differee, reconciliation, anti-zeros trompeurs, alertes et discipline anti-deploiements excessifs.
- Les CSS lourds de `vibefx-layout` et `publications` sont importes par `src/app/studio/layout.js`, pas par le layout racine, afin d'eviter de charger le studio sur les pages publiques.
- La page Layout ajoute une section `Modele personnalise` sous les modeles standards dans `src/features/vibefx-studio/components/sidebar/LayoutSidebar.jsx` et son equivalent `src/features/vibefx-layout/components/sidebar/LayoutSidebar.jsx`; les presets JSON normalises `CUSTOM_LAYOUT_PRESETS` / `DEFAULT_CUSTOM_TEMPLATE` et la palette `CUSTOM_SHAPE_LIBRARY` vivent dans les deux `data/constants.jsx`, le moteur Canvas 2D dessine les zones custom vides ou remplies par slot dans les deux `engine/layoutRenderer.js`, le canvas reste visible sans image source quand un modele custom est actif, et l'import par zone stocke l'image localement dans `slotConfigs` tout en serialisant le payload publication sans objet `Image`. Le mode edit personnalise ajoute les utilitaires `utils/customLayout.js` des deux modules pour creer, borner, redimensionner, pousser/scanner une position libre, reduire un voisin si necessaire et masquer automatiquement les zones sans placement propre; les zones masquees restent dans le JSON et redeviennent visibles quand la place revient. Les deplacements automatiques preservent une geometrie d'origine `homeX/homeY/homeW/homeH` pour eviter qu'un bloc revienne sous forme de lamelle apres reduction temporaire. Les voisins de meme rangee ne sont plus envoyes dans les rangees basses pour ne pas casser les vignettes existantes. La palette de formes drag/drop reste exposee dans `CanvasWorkspace`.
- Mise a jour 2026-06-02 : le dock images de la page Layout dans `src/features/vibefx-studio/components/canvas/CanvasWorkspace.jsx` expose un gros bouton `Ajouter image`, une action `Changer` par vignette, et `src/features/vibefx-studio/hooks/useImageUpload.js` gere maintenant l'ajout multi-image et le remplacement cible avec fallback FileReader. Le style Vibe_OS du dock est centralise dans `src/features/vibefx-layout/vibefx-layout.css`.
- Les actions Meta/OAuth cote client sont neutralisees quand Firebase Functions n'est pas initialise.
- La publication Meta manuelle cote Functions exige un admin via `ADMIN_EMAILS`, custom claim `admin`, ou document `admins/{email}` actif ; aucun email admin n'est hardcode.
- Le callback OAuth Meta reserve le state en transaction (`processing`) avant les appels Graph API pour eviter le rejeu concurrent, puis le marque `failed` en cas d'erreur.
- La publication OAuth connectee refuse un token Meta expire, marque la connexion `expired` et demande une reconnexion.
- Les Functions Meta refusent une synchronisation sans plateforme selectionnee.
- Le prompt maitre demande explicitement de reprendre comme base la logique publication/Firebase deja travaillee dans le projet source : moteur layout, `PublicationsManager.jsx`, Functions Meta/OAuth, verrous, statuts et rules Firestore/Storage.
- Reste a poursuivre avec configuration externe : test E2E navigateur complet du parcours studio, ecriture Firestore/Storage reelle et OAuth Meta.
- Mise a jour 2026-06-11 : la page Layout integre Lumen Shader Studio depuis `public/vendor/lumen` via `LumenShaderModal`; le bouton Lumen est ajoute aux acces rapides entre Mesh et Flou Pro, le shader peut etre applique comme fond Layout, et la copie vendor est adaptee en mode safe desktop (canvas non 0x0, DPR 1, WebGL low-power, FPS borne, exports/capture plafonnes) pour limiter les crashes Chrome desktop observes avec le site original.
- Mise a jour 2026-07-29 : `docs/vibecut-social-export-pro-architecture-2026-07-29.md` formalise l'architecture cible des exports sociaux jusqu'a 10 minutes/60 FPS a partir du code reel : Cloud Run Jobs asynchrones, data plane `europe-west1`, profils CPU 4/8 et 8/16, pilote GPU L4 8/32, stockage temporaire dedie, routage cout/performance, idempotence, annulation reelle, fidelite du renderer, validation output et plan de benchmark.
- Mise a jour 2026-07-29 : `docs/vibecut-audit-mvp-ux-roadmap-2026-07-29.md` consolide l'audit du code et le test interactif VibeCut : crash sur duree WebM non finie, fonctions UI non exportables, import photo/Ken Burns absents, densite mesuree, architecture Quick Editor + Storyboard, modele Asset/SceneClip, vertical slice 10 photos + 2 videos et ordre d'implementation CPU puis pilote GPU.
- Mise a jour 2026-07-29 : `docs/vibecut-mvp-master-checkpoint-implementation-2026-07-29.md` devient la reference d'execution du MVP hybride Create/Storyboard/Timeline Pro. Les cinq maquettes ImageGen approuvees sont archivees dans `public/assets/vibecut-concepts/`; le checkpoint fixe le vertical slice, les phases 0 a 7, les gates UX/export/cloud, la route CPU de reference, le pilote GPU L4 et la definition finale du MVP testable.
- Mise a jour 2026-07-29 : Phase 0 VibeCut securise les imports video et la verite d'export : `VideoEngine` resout ou rejette proprement les durees WebM non finies, le store refuse `Infinity`/`NaN`, `buildTimelineSnapPoints` borne sa grille, `exportManifest.js` publie le registre versionne des capacites serveur, et les panneaux Transitions/Texte/Outils rapides desactivent explicitement les fonctions `Apercu uniquement`. Les smokes purs couvrent ces invariants et `smoke-vibecut-media-safety.spec.cjs` les verifie dans le navigateur.
- Mise a jour 2026-07-29 : Phase 1 VibeCut unifie photos et videos sur la meme timeline. `mediaModel.js` porte les types, durees photo et presets Ken Burns; `MotionPanel.jsx` regle mouvement et duree; `VideoEngine` charge/rend les images et reserve le pilotage audio/frame callbacks aux videos. Le manifeste, Firebase Storage, Functions et `render-service` transportent `mediaType`/`motion`; FFmpeg boucle les images et applique `zoompan`. `smoke-vibecut-image-render.mjs` produit un vrai MP4 photo avec crossfade, et le smoke navigateur importe trois images puis applique un zoom exportable.
- Mise a jour 2026-07-29 : le vertical slice MVP VibeCut est live. `GuidedCreatePanel`, `StoryboardPanel`, `guidedTemplates.js` et `storyboardLibrary.js` portent le parcours Creer/Storyboard; `VideoEditor` expose Creer et Timeline Pro sur le meme projet persiste dans IndexedDB. Tailwind 4 est regenere par `styles:studio` depuis `vibefx-tailwind.input.css`. Firebase orchestre les jobs prives `vibecut-render-cpu-standard` et `vibecut-render-cpu-pro60`; `render-service/src/job.js` execute FFmpeg et telemetre les couts; `render-service/src/download.js` diffuse les outputs via jeton HMAC court et revalidation Firestore. Functions et conteneurs passent a Node 22, les audits production sont a zero vulnerabilite connue. Le pilote L4 `vibecut-render-gpu-turbo` reste deploye mais routeur desactive : 95,310 s et 67,3 Mo contre 76,058 s et 34,2 Mo sur CPU Pro pour le meme export 1080x1920 60 fps. Le smoke `test:vibecut-tools` lance desormais son propre serveur et teste le panneau Pro avec le corpus MP4 reel.
- Mise a jour 2026-07-30 : demarrage de la reconstruction complete de l'interface VibeCut (design system neuf, aucune reprise de l'ancien front). Phase 0 et 1 livrees : nouvelle route isolee `/video` (`/video/rapide`, `/video/guide`, `/video/avance`, `/video/transitions`, `/video/mouvements`) avec layout noindex qui ne charge que `src/features/vibecut/styles/vibecut.css` et jamais le bundle Tailwind statique de `/studio`; design system scope `.vibecut` (tokens sombres neutres, accent unique, typo systeme minimum 12px, monospace reserve aux timecodes, respect de `prefers-reduced-motion`); primitives maison en CSS Modules; bibliotheque de projets multi-projets dans IndexedDB via les prefixes de cle `project:`/`meta:` sans bump de version pour cohabiter avec `videoProjectPersistence.js`; accueil reel branche sur ces projets (3 modes, mouvements, transitions, projets recents, etats vide/chargement/erreur). Les catalogues `motionCatalog.js` et `transitionCatalog.js` sont mappes sur les ids reels du moteur et marquent `planned` ce qui n'est pas encore rendu. `scripts/smoke-vibecut-ui-v2.spec.cjs` (`npm run test:vibecut-ui-v2`) couvre l'accueil, l'isolation CSS, la regle typographique, le cycle creation/suppression de projet et le noindex des six routes; `scripts/audit-scope.mjs` verifie l'isolation de la surface. L'ancien front `/studio?workspace=video` reste en place et inchange jusqu'a la bascule finale.
- Mise a jour 2026-07-30 : phase 2 VibeCut livree, le montage rapide est fonctionnel sur `/video/rapide`. Import photos/videos par bouton ou glisser-deposer, storyboard en grandes cartes reordonnables au glisser-deposer avec puces de transition, inspecteur contextuel (duree, mouvement Ken Burns, transition et sa duree, volume, titre, musique), apercu reel via `PlaybackEngine`, barre de transport avec scrub clavier, sauvegarde automatique dans la bibliotheque de projets et reouverture par `?project=`, feuille d'export branchee sur le controleur d'export existant. Deux extractions preparatoires, sans changement de comportement : `useVideoExportController` passe de `panels/ExportVideoPanel.jsx` a `export/useExportController.js`, et `drawTextOverlays`/`loadGoogleFont` passent de `preview/VideoPreview.jsx` a `engine/textOverlayRenderer.js`; les deux anciens fichiers reexportent ces symboles pour ne rien casser, et `smoke-vibecut-export-jobs.mjs` + `audit-vibecut-export-hardening-requirements.mjs` lisent desormais controleur et panneau. `scripts/smoke-vibecut-quick-v2.spec.cjs` fabrique ses medias avec ffmpeg (les fichiers de `videotest/` sont des pointeurs LFS) et couvre etat vide, import reel, duree, transition posee/retiree, lecture, autosave, reouverture et ouverture de l'export.
- Mise a jour 2026-07-30 : fluidite du playhead VibeCut. Le curseur de lecture n'est plus pilote par les rendus React (le store reste throttle a ~11 ecritures/seconde pour ne pas re-rendre storyboard et inspecteur a chaque frame) : `preview/playheadClock.js` transporte le temps hors de React a la cadence du moteur, et `TransportBar` ecrit directement dans le DOM en interpolant a 60 fps avec correction continue sur le temps reel (saut immediat au-dela de 0,3 s d'ecart pour les seeks). Mesure headless : 6,5 -> 48,5 mises a jour par seconde sur video, pas maximum divise par deux. Corrige au passage un vrai bug de la sauvegarde automatique : l'ancrage de l'URL `?project=` relancait un chargement depuis IndexedDB 1,2 s apres la premiere modification, ce qui remettait la lecture a zero et figeait la progression sur les scenes photo. L'identifiant de projet est desormais fige au montage et l'URL n'est plus relue. Un garde-fou dans `smoke-vibecut-quick-v2.spec.cjs` verifie que la selection et le timecode survivent a l'ancrage et que le curseur depasse 15 mises a jour par seconde.
- Mise a jour 2026-07-30 : texte et musique du montage rapide termines, apres constat que les deux n'etaient que des amorces. Texte : inspecteur dedie (contenu, taille, gras/italique, couleurs, grille de position 9 points, duree, animations entree/sortie, suppression), deplacement a la souris sur l'apercu avec magnetisme sur le centre et la regle des tiers, reperes dessines sur le canvas pendant le glissement, badge sur les cartes de scene concernees, et retour automatique a l'inspecteur de scene apres suppression. Musique : l'ancienne version ecrivait `rightsStatus: 'user-provided'` - statut inexistant - ce qui produisait six blocages de droits et rendait l'export impossible; `MusicSheet` demande desormais une declaration explicite (droits detenus, ou source/licence renseignees) plus la confirmation d'usage social, et `ProjectAudio` affiche l'etat reel des droits, le volume, la coupure et la suppression. Corrige aussi un defaut de fond du design system : le reset `.vibecut button` (specificite 0,1,1) ecrasait les classes des CSS Modules (0,1,0), donc aucun bouton primaire n'avait son fond accent; les resets d'elements passent en `:where()`, specificite zero.
- Mise a jour 2026-07-30 : finition complete du montage rapide sur les sept manques identifies en revue. Interface : annuler/retablir (boutons + Cmd+Z / Cmd+Maj+Z, la suppression clavier vise le texte selectionne avant la scene), decoupe de la scene a la position de lecture (`splitSceneAtPlayhead` convertit le temps timeline en temps local au media), sections repliables dans l'inspecteur via la primitive `Collapsible` (mouvement ouvert, transition repliee), storyboard reecrit en pointer events - il fonctionne au doigt, se teste reellement et fait s'ecarter les cartes voisines pendant le glissement -, et feuille d'export completee (etat termine, telechargement avec regeneration d'URL signee, message d'echec et bouton reessayer, mention explicite du mode simule). Moteur, avec parite navigateur/serveur : le texte accepte les retours a la ligne et un fond ou un contour (`boxStyle`, `boxColor`) rendus a l'identique par `engine/textOverlayRenderer.js` et par `drawtext` (`box=1`/`borderw`, `line_spacing`); la musique accepte un point de depart dans le morceau (`trimStart`) et des fondus (`fadeIn`/`fadeOut`) appliques par `resolveAudioFadeVolume` a l'apercu et par `afade` a l'export, avec un fondu de sortie d'une seconde par defaut. `SERVER_RENDER_CAPABILITIES` declare `textStyles` et `audioFades`. Les filtres FFmpeg generes ont ete valides localement par un rendu MP4 reel. Corrige egalement une section repliee qui restait cliquable en hauteur zero (`display: flex` ecrasait l'attribut `hidden`).
- Mise a jour 2026-07-30 : la reconstruction VibeCut est desormais pilotee par deux documents racine. `plan.md` porte le plan complet (diagnostic, architecture cible, direction artistique OS Apple detaillee avec tokens/regles/interdits/pieges techniques, references visuelles liees a `public/assets/vibecut-concepts/`, phases 0 a 7, parite apercu/export, rituel de fin de phase). `todo.md` porte l'etat d'avancement, les bugs trouves et corriges, les problemes connus et le prompt de relance pour un chat neuf. `AGENTS.md` place ces deux fichiers en priorite de lecture 2 et 3 et formalise le rituel de fin de phase.
- Mise a jour 2026-07-30 : phase 3 VibeCut livree, la creation guidee existe reellement sur `/video/guide`. Le coeur est `src/features/vibecut/data/styleRecipes.js`, un module **pur sans aucun import** : il decrit 4 styles (Social dynamique, Cinema doux, Souvenirs, Net et direct), 3 rythmes et 3 jeux de mouvements, et `buildMontagePlan()` en derive la duree par photo, le motif de mouvements alterne, la transition et sa duree, le look colorimetrique et le format. Deux garde-fous d'honnetete y sont verrouilles par test : la duree d'une transition ne peut jamais depasser la moitie du plan le plus court, et le look est toujours **complet** (les quinze reglages) pour qu'un changement de style efface la colorimetrie du precedent au lieu de s'y ajouter. `adapters/useGuidedMontage.js` applique ce plan en **une seule ecriture** du store via `applyGuidedTemplate`, donc une seule entree d'historique. `guided/GuidedFlow.jsx` orchestre les cinq etapes Medias / Format & style / Rythme & mouvements / Son & textes / Finaliser avec un rail de progression, un retour arriere libre et une regeneration a chaque choix : la colonne d'apercu joue le montage reel, jamais une simulation. Le recapitulatif final est **relu du montage lui-meme** (nombre de scenes, duree, duree par photo, nombre de fondus), pas des intentions du plan. Sorties : export direct et passage vers `/video/rapide` ou `/video/avance` sur le meme `?project=`. Parite respectee : seuls les six mouvements et la seule transition minutee que FFmpeg rend (`crossfade`) peuvent etre produits, la colorimetrie etant rendue des deux cotes; les mouvements sur video restent annonces « Bientot ». Deux bugs corriges en route : `saveNow()` n'ancrait pas l'URL alors que la sauvegarde automatique le faisait, donc l'appeler juste avant elle lui volait la creation du projet et le lien de sortie restait sans `?project=`; et la primitive `Collapsible` rendait son `value` **dans** le bouton de repli, ce qui produisait un bouton imbrique dans un bouton (HTML invalide) et faisait replier la section quand on cliquait sur « Appliquer a toutes » dans le montage rapide - le `value` est desormais rendu a cote du bouton. Tests : `scripts/smoke-vibecut-style-recipes.mjs` (5 jeux de scenes x 4 styles x 3 rythmes, plus la parite mouvements/transitions entre le catalogue, `IMAGE_MOTION_PRESETS`, `TRANSITIONS` et `SERVER_RENDER_CAPABILITIES`) et `scripts/smoke-vibecut-guided-v2.spec.cjs` (parcours navigateur complet, generation verifiee par la duree jouee dans l'apercu, reouverture du meme projet en montage rapide, zero erreur console). `npm run test:vibecut-ui-v2` couvre maintenant 13 tests navigateur plus le smoke pur, `npm run test:vibecut-recipes` lance le moteur de recettes seul.
- Mise a jour 2026-07-30 : enrichissement du mouvement de la creation guidee, en tenant la regle `plan.md` 4.5 - une animation explique, elle ne decore pas. La vignette d'un style ne montre plus un plan fixe mais **deux plans qui s'enchainent reellement** : `getStyleTempo()` (dans `data/styleRecipes.js`) derive de la recette la cadence `--vc-cycle`, qui est la duree reelle d'une photo dans ce style, et une allure `data-pace` (`cut` / `fast` / `soft` / `long`) qui vient du rapport entre la duree du fondu et celle du plan. Consequence directe : « Net et direct » coupe franchement dans sa vignette parce qu'il coupera franchement dans la video, et « Cinema doux » fond longuement parce qu'il fondra longuement. Les deux plans portent des mouvements differents du motif, donc l'alternance se voit aussi. `guided/LookPreview.jsx` expose desormais `LookPreview` (une scene, pour les cartes de mouvement) et `StylePreview` (deux scenes enchainees, pour les cartes de style). Ajoutes egalement : une bande de tempo sur les cartes de rythme qui bat une fois par plan a la duree que le choix produira, une entree d'etape **directionnelle** (avancer pousse depuis la droite, revenir ramene depuis la gauche, via une `key` sur le contenu de l'etape et un `data-direction`), une barre de progression du parcours, des cascades sur les scenes importees, les lignes du recapitulatif et les deux sorties, un lisere sur l'etape courante du rail, une impulsion sur la pastille qui se coche, la colonne d'apercu qui glisse a son apparition et le bandeau d'import qui descend. Rien ne tourne en boucle au repos : survol, focus clavier ou selection uniquement. Corrige au passage un defaut du design system : `prefers-reduced-motion` neutralisait les durees mais pas les **delais**, or les entrees en cascade utilisent `animation-fill-mode: both` - un delai qui survit laisse le contenu invisible, exactement l'inverse du but; `animation-delay` et `transition-delay` sont remis a zero avec les durees dans `styles/vibecut.css`. Corrige aussi l'assertion console du smoke guide, qui n'enregistrait pas l'URL des ressources en echec : un 403 Firebase intermittent passait le filtre et faisait echouer le test au hasard. Le tempo des vignettes est verrouille par `scripts/smoke-vibecut-style-recipes.mjs` (allure coherente avec la recette, cycle egal a la duree par photo, au moins trois enchainements distincts entre les quatre styles), et les animations ont ete verifiees image par image au navigateur.
- Mise a jour 2026-07-30 : revirement assume sur les animations de la creation guidee, apres retour du porteur du projet (« j'ai l'impression que rien n'a change »). Les demonstrations etaient declenchees au survol, comme l'exigeait `plan.md` 4.5 : on arrivait donc sur un ecran fige, et comparer deux styles obligeait a les survoler l'un apres l'autre. La regle est **renversee** et documentee comme telle dans `plan.md` 4.5 : les vignettes de style et de mouvement tournent desormais **en boucle permanente**, avec un depart decale d'une carte a l'autre (`animation-delay` negatif) pour qu'une grille ne bascule pas a l'unisson. `prefers-reduced-motion` les arrete toujours toutes. Les barres de tempo ajoutees sur les cartes de rythme sont **retirees** : elles encodaient une information reelle mais se lisaient comme un egaliseur decoratif sur une carte deja selectionnee. Les vignettes de mouvement passent au meme principe que les vignettes de style, via `MotionPreview` : elles jouent **deux mouvements consecutifs du motif** au lieu de deux fois le premier, ce qui rend enfin « Doux » (zoom avant puis arriere) distinguable de « Varie » (zoom avant puis panoramique) - les deux cartes s'animaient jusque-la exactement pareil. `guided/LookPreview.jsx` est refactorise autour d'un composant interne `ScenePair`, dont `StylePreview` et `MotionPreview` sont deux specialisations. Deux pieges CSS rencontres et corriges, verifies dans le navigateur et non a la lecture : le second plan d'une vignette de mouvement porte a la fois `.motionArt` et `.styleArtB`, de specificite egale, et `.motionArt` etant declaree plus bas son raccourci `animation` annulait le fondu en laissant le plan invisible (resolu par une regle `.motionArt.styleArtB` plus specifique); et un `animation-delay` isole est remis a zero par tout raccourci `animation` declare apres lui, donc le bloc de decalage doit rester le dernier du fichier. Verification faite en lisant `getAnimations().playState` et les variables de mouvement de chaque couche dans le navigateur, souris volontairement eloignee des cartes.
- Mise a jour 2026-07-30 : phase 3b planifiee (presets de montage), sur demande du porteur du projet qui juge les quatre styles de la phase 3 « basiques » - constat exact : trois d'entre eux sont le MEME fondu enchaine a trois vitesses, seule la colorimetrie de « Cinema doux » transforme visiblement l'image. `docs/vibecut-styles-roadmap-2026-07-30.md` porte la feuille de route complete : diagnostic, faits verifies, modele de preset cible a sept dimensions, vocabulaire de transitions, lots L1 a L6, ce qu'on ecarte et pourquoi, risques. Trois faits ont ete etablis et sont re-verifiables sans aucun cout Cloud. (1) `render-service/src/server.js:482` ecrit `xfade=transition=fade` EN DUR : le type de transition choisi dans l'interface est purement ignore a l'export, ce qui explique que la richesse des transitions ne soit bornee par aucune limite technique, seulement par une ligne non ecrite. (2) Le filtre `xfade` de FFmpeg expose 46 transitions natives (`node -e "…-h filter=xfade"` avec `ffmpeg-static`), donc le vocabulaire exportable peut passer de 1 a ~16 par une table de correspondance, sans technologie nouvelle ni rendu image par image. (3) Defaut de parite jamais releve : le mouvement des photos est lisse (`smoothstep`) dans l'apercu et strictement LINEAIRE a l'export - `grep -c easing render-service/src/server.js` renvoie 0. Le modele cible remplace « une duree + une transition + une teinte » par une partition : structure rythmique en poids (`beatPattern`) plutot qu'en duree fixe, partition de transitions avec accents tous les N plans plutot qu'une valeur repetee, choregraphie des mouvements avec continuite de direction, colorimetrie, typographie de titre, profil audio et format. La synergie rythme/style demandee devient `duree(scene i) = beatBase(rythme) x beatPattern[i](style)`, ce qui rend les deux reglages orthogonaux tout en preservant le caractere long/court du style. Les cartes de preset doivent etre baties sur les miniatures REELLES du projet (disponibles des l'etape 2) au lieu d'illustrations SVG generiques. `plan.md` gagne une phase 3b inseree avant la phase 4 sans renumerotation, son tableau de parite consigne les deux ecarts trouves, et sa table des risques ajoute « ecarts de parite non detectes par les badges » - les badges disent ce qui est declare, pas ce qui est rendu. `todo.md` porte la liste de ce qui est a ameliorer et les six lots, et deux prompts de relance : phase 3b d'abord, phase 4 ensuite.
- Mise a jour 2026-07-30 : lot L1 de la phase 3b livre - la parite des transitions. C'est le lot qui « repare le canal avant de peindre » : ameliorer les presets avant lui aurait rendu l'apercu plus beau et plus menteur. `render-service/src/server.js` n'ecrit plus `xfade=transition=fade` en dur mais resout le type demande via `SERVER_XFADE_TRANSITION_MAP`, avec repli volontaire sur `fade` pour tout id inconnu (un identifiant absent du build FFmpeg deploye ferait echouer le rendu entier). Le vocabulaire exportable passe de 1 a 15 transitions distinctes : `crossfade`, `dip-black`, `dip-white`, `film-dissolve`, `desat-fade`, `swipe-left`, `swipe-right`, `push-up`, `push-down`, `wipe-left`, `blinds-open`, `iris-open`, `iris-close`, `pixel-cut`, `blur-cut`. La table est portee a l'identique par `exportManifest.js` (capacites v3, `timedTransitions` derive de la table) et `functions/src/videoExport.js`, et `scripts/smoke-vibecut-transition-parity.mjs` echoue si les trois divergent ou si une cible `xfade` manque au build local. Cote apercu, `src/features/vibefx-studio/video/engine/xfadeTransitions.js` implemente ces quinze transitions au canvas et `VideoEngine.renderTransition` y delegue AVANT son `easeInOut` historique : `xfade` progresse lineairement, l'accelere/decelere du moteur etait donc lui-meme un ecart de parite, sur le simple fondu compris. Les courbes des fondus par couleur ne sont pas devinees mais RELEVEES : en rendant `xfade` avec un plan rouge pur et un plan vert pur, le canal rouge donne le poids du plan sortant et le canal vert celui du plan entrant. Elles sont franchement asymetriques - le plan sortant s'eteint sur les 20 premiers pour cent, l'entrant remonte sur tout le reste - et `fadewhite` partage exactement les memes deux courbes que `fadeblack`. Deux nouveaux tests : `render-vibecut-xfade-transitions-local-smoke.mjs` produit un vrai MP4 par transition en faisant construire la commande par `buildFfmpegArgs` du renderer (un `fade` en dur y serait attrape), et `smoke-vibecut-xfade-preview-parity.mjs` compare image par image, dans Chromium, ce que le canvas dessine et ce que FFmpeg produit, a quatre instants du fondu, avec un seuil justifie par transition. Resultat mesure sur 0-255 : fondus par couleur, fondu simple et volet net sous 4 d'ecart moyen; balayages adoucis et iris entre 9 et 22; trois ecarts structurels assumes et documentes sur place - le grain de `film-dissolve` (FFmpeg tire un bruit par pixel, l'apercu utilise des masques pre-calculs deterministes), le noyau de flou de `blur-cut`, et les coefficients de luminance de `desat-fade` (Rec.709 dans le navigateur contre Rec.601 dans FFmpeg, donc un rouge sature ressort plus clair a l'export). `zoom-punch` (`xfade=zoomin`) etait prevu par la roadmap et a ete ECARTE apres inspection des images de reference : la magnification devient extreme jusqu'a un aplat uniforme au milieu du fondu, laide sur photo, et son cout de reproduction au canvas etait disproportionne - la regle « une transition dont l'apercu ne ressemble pas a l'export est pire que pas de transition » s'applique a elle. Effet de bord voulu : `dip-black`, `dip-white` et `film-dissolve`, jusque-la marquees « Apercu uniquement » dans le montage rapide, passent en « Export Pro ». Aucun deploiement Cloud Run n'a ete fait : le rollout unique reste prevu en L6, apres L2 a L5.
- Mise a jour 2026-07-30 : lot L2 de la phase 3b livre - le modele de preset. Un preset cesse d'etre « une duree + une transition + une teinte » pour devenir une PARTITION a sept dimensions, ce qui repond au constat du porteur du projet (« trois des quatre styles sont le meme fondu enchaine a trois vitesses »). `src/features/vibecut/data/styleRecipes.js` porte desormais, par preset : `beat` (des POIDS par plan plus `openingHold`/`closingHold`, au lieu d'une duree unique), `transitionScore` + `accentEvery` + `accentTransition` + `openingTransition`/`closingTransition` (une SEQUENCE de coupes avec des accents, au lieu d'une valeur repetee), `motionScore` + `motionIntensity` + `motionContinuity`, `look`, `titleStyle`, `audioProfile` et `sequencePreset`. `buildMontagePlan()` produit un plan PAR SCENE (`plan.scenes[]` avec duree et mouvement, `plan.cuts[]` avec type et duree) au lieu de valeurs globales. La synergie rythme/style demandee est exactement `duree(scene i) = beatBase(rythme) x beatPattern[i](preset) x holds` : le rythme ne porte plus qu'une cadence de base, la FORME appartient au preset, donc changer de rythme comprime le montage sans effacer son caractere - c'est verrouille par un test qui compare les RAPPORTS entre plans d'un rythme a l'autre. Le garde-fou `MAX_TRANSITION_SHARE` interdit qu'une transition depasse 45 % du plus court des deux plans qu'elle relie : avant, « Cinema doux » en rythme soutenu se faisait silencieusement rogner son fondu et perdait son caractere sans que rien ne le dise. Six presets remplacent les quatre anciens : Reel dynamique, Cinema (le seul qui plaisait, conserve tel quel et seulement enrichi de structure), Souvenirs, Produit, Mixed media, Recit - ce dernier est le seul dont la STRUCTURE raconte quelque chose, ses plans raccourcissant au fil du montage. Cote store, `applyMontageScore` est une action ADDITIVE de `videoStore.js` qui ecrit une duree et un mouvement par scene et une transition par coupe, en une seule ecriture donc une seule entree d'historique; `applyGuidedTemplate` n'est pas touchee, l'ancien front la lit encore jusqu'a la phase 7, et le smoke echoue si l'une des deux disparait. `useGuidedMontage` passe a la nouvelle action, `GuidedFlow` applique desormais le plan QUI CONNAIT LES SCENES (la duree depend de la place du plan dans le montage) sans risque de boucle, puisque `buildMontagePlan` ne LIT jamais la duree d'une photo mais la produit. Changer de preset n'ecrase plus le rythme choisi : le rythme est devenu un reglage orthogonal. Interface : le recapitulatif annonce l'amplitude reelle des plans (« 2.72 a 4.57 s ») au lieu d'une duree unique qui n'existe plus, et le nombre de coupes fondues sur le total avec leurs traitements (« 3 sur 3 coupes - Fondu enchaine »); les cartes de rythme annoncent la meme amplitude, ce qui rend la synergie visible; la grille de styles passe a trois colonnes fixes au-dela de 720 px pour que six presets forment deux rangees pleines au lieu d'une rangee orpheline. Effet de bord du lot L1 enfin exploite cote montage rapide : `transitionCatalog.js` gagne les onze transitions exportables qui lui manquaient dans une nouvelle famille « Glissements & volets », et les six raccourcis de `SceneInspector` sont desormais TOUS exportables - avant, quatre des six (`blur-dissolve`, `whip-pan`, `cross-zoom`, `flash`) n'existaient qu'a l'apercu, donc l'interface poussait vers des montages inexportables. `scripts/smoke-vibecut-style-recipes.mjs` est reecrit autour du nouveau modele : structure de battement, partition de transitions, placement des accents, priorite ouverture/fermeture sur accent, garde-fou des 45 %, conservation de la forme d'un rythme a l'autre, distinction des six presets, exportabilite des raccourcis rapides et survie de `applyGuidedTemplate`. Aucun deploiement : le rollout unique reste prevu en L6.
- Mise a jour 2026-07-30 : lot L3 de la phase 3b livre - mouvement, intensite et courbe. Le DERNIER ecart de parite connu du mouvement photo est ferme, et un TROISIEME, jamais releve, a ete trouve en chemin. (1) COURBE : l'apercu lissait la progression (`smoothstep`, p^2*(3-2p)) quand l'expression `zoompan` du renderer interpolait strictement lineairement - un zoom partait doucement a l'ecran et sec a l'export, depuis l'origine. Le `smoothstep` est desormais ecrit dans l'expression, pas approche. (2) INTENSITE : un facteur unique multiplie l'ecart start->end, avec la MEME formule des deux cotes (`mediaModel.resolveImageMotionFrame` et `zoompan`), donc une parite garantie par construction et non par surveillance; elle voyage jusqu'au clip, puis dans le manifeste (capacites v4, `imageMotionIntensity`), puis dans le renderer. Le cadrage de DEPART ne bouge pas : baisser l'intensite raccourcit la course, elle ne recadre pas la photo. (3) DECALAGE : l'apercu translate l'image APRES l'avoir agrandie, son decalage vaut donc `x/zoom` en coordonnees source, alors que le renderer ecrivait `-(x)*iw` - les panoramiques voyageaient environ 11 % trop loin a l'export. Corrige en `-(x)*iw/zoom`. Interface : trois crans nommes a l'etape 3 (Discret 40 %, Naturel 70 %, Marque 100 %), pas un curseur continu qui appartient au montage avance; les six presets sont recales sur ces trois valeurs exactes, parce qu'une valeur intermediaire (0,55, 0,9) ne pouvait pas s'afficher et aurait fait mentir la carte selectionnee. Tant que rien n'est choisi le cran est celui du preset; une fois choisi il tient, meme regle que le rythme depuis L2. `applyImageMotionTransform` est extraite de `VideoEngine` vers `mediaModel.js` (module sans aucun import) pour que le test de parite charge le CODE DE PRODUCTION tel quel dans Chromium, pas une copie. Nouveau gate `scripts/smoke-vibecut-motion-preview-parity.mjs` (`npm run test:vibecut-motion-parity`, integre a `test:vibecut-ui-v2`) : des MP4 reels rendus par la commande que `buildFfmpegArgs` du renderer construit lui-meme, decodes et compares image par image a l'apercu, sur six mouvements/intensites plus un cas a course amplifiee, cinq instants chacun. Il porte TROIS assertions et non une, chacune pour une raison apprise en l'ecrivant : parite (pire ecart mesure 7,3/255 par pixel, 2,7 sur la couleur moyenne d'image); effet reel de l'intensite (deux cotes qui l'ignoreraient tous les deux seraient « en parite » et le test ne vaudrait rien); et sentinelle - un apercu volontairement remis en lineaire DOIT sortir des seuils, sinon c'est le test qui est devenu aveugle. Cette derniere a d'ailleurs echoue au premier jet : aux amplitudes des presets, l'ecart entre courbe lissee et courbe lineaire vaut environ 2 pixels, soit MOINS que le bruit de reechantillonnage, et aucun seuil sur l'image entiere ne peut l'y distinguer; d'ou le cas a course amplifiee, meme chemin de code avec cinq fois la course, qui donne au test le levier qui lui manquait. Verifie en conditions : remettre le renderer en interpolation lineaire fait echouer le test meme en neutralisant la lecture de la commande FFmpeg, donc par la seule comparaison d'images. Contrainte decouverte et consignee (probleme I de `todo.md`) : `zoompan` BORNE sa fenetre a l'image, le canvas non, donc tout mouvement doit tenir |x| <= (zoom - 1) / 2 - les six mouvements livres la respectent, le plus tendu etant `drift-up` (0,045 pour une limite de 0,05), mais c'est a verifier avant tout ajout au catalogue en phase 6. `smoke-video-store.mjs` verifie que l'intensite arrive bien jusqu'au clip, et `smoke-vibecut-style-recipes.mjs` qu'elle est portee par chaque scene du plan et que chaque preset tombe sur un cran nomme. Aucun deploiement : le rollout unique reste prevu en L6.
- Mise a jour 2026-07-31 : phase 4 livree - le MONTAGE AVANCE existe reellement sur `/video/avance`, qui rendait jusqu'ici un `PhasePlaceholder`. La carte « Montage avance » de l'accueil promettait « timeline multipiste, inspecteur, colorimetrie, export jusqu'a 60 fps » sans badge « Bientot » : la promesse est desormais vraie plutot que retiree. Quatre zones (`src/features/vibecut/advanced/`) : bibliotheque de medias a gauche (recherche, tri par ordre de montage / nom / duree, vignettes reelles, selection qui pilote l'inspecteur), apercu au centre, inspecteur contextuel a droite, timeline multipiste en bas. La timeline est batie sur le modele canonique `video/model/timelineModel.js` **tel quel**, via un nouvel adaptateur `adapters/useTimeline.js` : les sept pistes du modele (Volets, Video, Transitions, Effets, Texte, Son des clips, Musique) sont rendues dans leur ordre declare, avec leurs bascules visible/muet/verrouille - et **seulement celles qui font quelque chose**, une piste visuelle n'ayant pas de son a couper et une piste audio rien a montrer (interdit des boutons morts, `plan.md` 4.2). Point de conception impose par le modele et assume plutot que masque : sur la piste video, les clips sont poses BOUT A BOUT et leur debut est CALCULE, donc glisser un clip le **reordonne** (avec indicateur de depot) au lieu de le deplacer librement, tandis qu'un texte, une musique ou une transition libre - dont le debut est une donnee - se deplacent et se redimensionnent vraiment. Proposer un deplacement libre sur la piste video aurait menti sur ce que le montage sait faire. Toutes les interactions sont en pointer events avec rendu local et **commit au relachement** (aucune ecriture dans le store avant le `pointerup`), le magnetisme reutilise `buildTimelineSnapPoints` + `snapTimeToPoints` et annonce sur quoi il s'est cale, le zoom va de 4 a 480 px/s et se recadre automatiquement sur le montage entier tant que personne n'a touche aux commandes de zoom. La tete de lecture passe par `preview/playheadClock.js` et s'ecrit directement dans le DOM, jamais par un rendu React. L'inspecteur apporte la nouveaute annoncee par le lot L3 : le **curseur d'intensite continu** du mouvement photo (les trois crans nommes restent a la creation guidee), branche sur `motion.intensity` que le clip portait deja; s'y ajoutent transformation (rotation 0/90/180/270, rendue des deux cotes), vitesse, colorimetrie (six reglages pris dans les quinze cles que l'apercu et `eq`/`colorbalance`/`vignette`/`noise` partagent) et son du clip. La **vitesse** est le cas limite de la regle de parite : l'apercu la joue, le renderer serveur non (`clipSpeeds: [1]`), elle porte donc son badge « Apercu uniquement » et le pre-vol de l'export la refuse explicitement au lieu de rendre autre chose en silence - le smoke le verifie. `ExportProSheet` expose ce que le montage rapide cache volontairement : cadence Auto/24/25/30/50/60, niveau de qualite Brouillon/Pro/Master, pre-vol reel du controleur d'export existant. Changement structurel le plus important : le `PlaybackEngine` est **hisse dans le layout** (constat n 8 de `plan.md` 2). Il etait cree puis detruit par ecran, donc tous les medias se rechargeaient - decodage video compris - a chaque changement de mode. `preview/PreviewEngineHost.jsx` porte desormais le moteur et son canvas au-dessus des routes, dans `VibeCutShell`; `PreviewStage` ne cree plus rien et declare seulement OU le canvas vient se poser. Le canvas est un singleton de module cree en imperatif et **deplace** d'un ecran a l'autre : un portail React n'aurait pas convenu, changer de conteneur demonte les enfants et en remonte de nouveaux, donc un canvas neuf a chaque navigation - exactement ce qu'on voulait eviter. Le smoke le prouve en marquant le canvas sur `/video/rapide`, en naviguant cote client jusqu'a `/video/avance` et en verifiant que la marque a survecu. Gate de la phase : `scripts/smoke-vibecut-advanced-v2.spec.cjs` (11 tests) porte les assertions de l'ancien `smoke-video-ui.spec.cjs` sur les nouveaux `data-testid` - ordre et `data-track-order` des sept pistes, bascules de piste par leur libelle d'accessibilite, rognage a la poignee puis annuler/retablir, glissement et nudge clavier de la tete de lecture, decoupe, zoom, magnetisme, volume, colorimetrie materialisee par un element sur la piste Effets, export - et y ajoute le responsive a 390 px (aucun debordement horizontal de la page, tous les outils de timeline atteignables) et la preuve du moteur unique. Il est integre a `npm run test:vibecut-ui-v2`, qui passe de 13 a 24 tests navigateur. `scripts/audit-scope.mjs` verrouille la nouvelle surface : la route n'est plus un placeholder, `PreviewStage` ne contient plus `new PlaybackEngine`, le shell monte le fournisseur de moteur, l'adaptateur passe bien par le modele canonique, et la suite v2 execute le nouveau smoke. Deux defauts trouves a l'ecran et non a la lecture, conformement a la methode du projet : le masquage de l'apercu en etat vide reposait sur deux classes de specificite egale venues de **deux modules CSS differents**, dont l'ordre d'injection n'est pas garanti (resolu par une double classe `.stageHidden.stageHidden`), et le bouton « Afficher tout le montage » sortait du cadre en 390 px dans une barre `overflow: hidden`, donc injoignable (barre rendue defilante, total de duree masque sous 720 px). Un troisieme defaut, trouve en relisant l'inspecteur : changer de preset de mouvement etalait l'ancien mouvement, donc `start` et `end` survivaient au changement et la photo aurait continue de zoomer alors que l'interface annoncait « Fixe ». Aucun deploiement.

- Mise a jour 2026-07-31 (audit d'usage du montage avance) : le porteur du projet a essaye `/video/avance` et n'a pas trouve comment poser une transition, en constatant par ailleurs que « la colorimetrie ne se voit pas sur l'apercu ». Un audit pilote au navigateur — on importe, on clique, et surtout on MESURE les pixels du canvas au lieu de croire le code — a confirme les deux et en a trouve trois autres. Les 24 tests de la phase 4 passaient pourtant : ils verifiaient que chaque action ECRIT dans le modele, jamais qu'elle SE VOIT. Cinq correctifs. (1) `advanced/Inspector.jsx` gagne une section « Transition vers le plan N+1 » qui appelle la meme action `applyTransition` que le montage rapide : les 15 transitions exportables d'abord, les autres sous un intertitre « Apercu uniquement », plus la duree, le retour a la coupe franche et « Appliquer a toutes les coupes » ; aucune section sur le dernier plan, qui n'a pas de suivant. Jusqu'ici la piste Transitions restait vide a vie alors que l'accueil promet des transitions. (2) `adapters/useTimeline.js` : `selectItem(item, { seek: true })` amene la tete de lecture DANS l'element choisi quand elle n'y est pas deja — mesure a l'appui, on reglait la colorimetrie du plan 3 pendant que l'apercu montrait le plan 1, et la bibliotheque de medias deplacait deja le curseur alors que la timeline non, donc les deux chemins se contredisaient. (3) le meme `selectItem` traite le type `effect`, qu'il ne connaissait pas et qui mettait TOUTES les selections a `null` : un element « Colorimetrie du clip N » renvoie desormais vers son clip au lieu de vider l'inspecteur. (4) `advanced.module.css` : un `input[type=range]:disabled` se voit desormais desactive (opacite 0,4, `cursor: not-allowed`), le curseur d'intensite du mouvement s'affichant jusqu'ici plein et a 100 % sans repondre. (5) la timeline passe de `height: 322px` en dur a `clamp(232px, 42dvh, 322px)` : sur une fenetre de 720 px l'apercu tombait a ~250 px. L'audit a aussi ECARTE des soupcons, pour ne pas corriger ce qui marche : la colorimetrie est bien rendue par l'apercu (saturation 0 -> saturation mesuree 0,995 puis 0 ; exposition +100 -> 63/255 d'ecart), la rotation aussi (218/255), il n'y a AUCUNE boucle de rendu au repos (0 dessin en 3 s apres edition, mesure en instrumentant `drawImage`) et zero erreur console sur tout le parcours. `scripts/smoke-vibecut-advanced-v2.spec.cjs` gagne 3 tests (14 au total) qui ancrent le VISIBLE et non l'ecrit : la tete de lecture entre dans l'element choisi et n'y resaute pas au second clic, la piste Effets renvoie vers son clip, une transition se pose / se dose / s'applique partout / se retire, et le dernier plan n'en propose pas. `npm run test:vibecut-ui-v2` passe de 24 a 27 tests navigateur. Reste ouvert et documente : le texte est petit en portrait parce que l'echelle vaut `fontSize x largeur/1920` des DEUX cotes (`render-service/src/server.js:593`) — la parite est intacte, la corriger demande de changer les deux cotes et de relancer la parite, c'est un lot a part. Aucun deploiement.

- Mise a jour 2026-07-31 (Timeline V2 du montage avance) : apres essai reel, le porteur du projet signale des « chevauchements pas terrible » en posant des transitions, et un panneau de droite ou « on ne sait pas qui est quoi ». Diagnostic mesure sur ses captures : trois photos de 4,00 s, un fondu de 1,41 s, total 10,59 s (= 12 - 1,41), donc le modele applique bien la vraie convention de montage (`cursor += duree - overlap`, timelineModel.js:223) et fait se CHEVAUCHER les deux plans. L'ancienne vue dessinait chaque element en absolu avec un fond opaque : le plan 2 recouvrait la queue du plan 1, qui se lisait 2,6 s a l'ecran pendant que l'inspecteur annoncait 4,00 s. Le modele avait raison, c'est l'affichage qui mentait. Audit des conventions de DaVinci Resolve et Premiere Pro : une transition se dessine SUR la piste video a cheval sur la coupe et jamais sur une piste separee, la colorimetrie est un attribut du plan signale par un badge, le son d'un plan est attache au plan, et l'inspecteur est organise par nature de selection. Refonte livree : `adapters/useTimeline.js` gagne `buildDisplayLanes`, une projection d'AFFICHAGE qui replie les sept pistes du modele en QUATRE rangees reelles (Video, Texte, Musique, et Volets seulement s'il porte quelque chose) ; `timelineModel.js` n'est PAS modifie, il reste le contrat d'export et l'ancien front s'en sert jusqu'a la phase 7. `advanced/TimelineView.jsx` est reecrit : les plans sont poses jointifs au MILIEU de leur transition (la largeur dessinee redevient vraie), la pastille de transition chevauche la jointure et ses deux bords sont des poignees qui changent la duree, la colorimetrie / le mouvement / la vitesse / le volume deviennent des badges sur le plan qui selectionnent le plan ET ouvrent leur section d'inspecteur, et le son d'un plan devient une forme d'onde attachee sous le plan. Les trois pistes repliees gardent leurs commandes dans la barre d'outils (masquer les transitions, contourner la colorimetrie, couper le son des plans) : un bouton mort serait interdit. Plafond d'une transition a 45 % du plus court des deux plans via `getMaxTransitionDuration`, qui REUTILISE `MAX_TRANSITION_SHARE` de `data/styleRecipes.js` — une seule regle dans tout le produit, et `audit-scope.mjs` refuse une copie ; auparavant `resolveCutTransitionOverlap` acceptait jusqu'a 100 %, une transition pouvait devorer un plan entier. `advanced/Inspector.jsx` : l'en-tete nomme la NATURE de la selection (« Plan video », « Transition », « Texte », « Musique ») avant son nom, l'ordre des sections est fixe (Mouvement, Transformation, Vitesse, Colorimetrie, Transition, Son du plan), chaque section porte un sous-titre d'une ligne, « Transition vers le plan 2 » devient « Transition » avec la mention « S'applique a la coupe entre ce plan et le plan N », et une transition selectionnee ouvre le MEME panneau que depuis le plan — un seul chemin d'ecriture, `sceneActions.applyTransition`. Quatre bugs trouves en chemin : `fromItemId` vit dans `item.params` et non a la racine, donc la pastille ne s'affichait pas du tout (trouve par le test, pas par la relecture) ; une photo affichait un badge « son » et une forme d'onde alors qu'une photo n'a pas de son (vu a l'ecran) ; `setPointerCapture` leve si le pointeur n'est plus actif et une exception dans un handler `pointerdown` interrompt l'interaction entiere (capture et liberation passent par un helper defensif) ; masquer une piste repliee ne la masquait pas, la bascule aurait ete un bouton mort. Mesures apres coup : plan de 4 s dessine 4,00 s (352 px a 88 px/s), poser un fondu retire 3 % de largeur au lieu de 35 %, plafond effectif 1,80 s sur des plans de 4 s, apercu passe de 35 % a 45 % de la hauteur de fenetre, zero erreur console. `scripts/smoke-vibecut-advanced-v2.spec.cjs` passe a 15 tests et `npm run test:vibecut-ui-v2` de 27 a 28 tests navigateur ; les quatre tests qui decrivaient les sept rangees ont ete REECRITS a couverture egale, pas supprimes. Aucun deploiement.

- Mise a jour 2026-08-11 (presets Vision, remplacement des 12 looks) : les 12 « looks » et la bibliotheque de profils par marque sont supprimes (`visionLooks.js`, le Sheet « Bibliotheque de profils », le tri `scoreProfileForImage` cote Vision, `guardLookForImage` devenu mort). A la place, Vision expose des presets compiles en LUT 3D. Le premier, `powlisher`, est une reconstruction MESUREE du rendu de @powl_d : 19 photos recuperees en resolution d'origine via l'API de syndication X, plus 50 frames extraites d'une video ou il montre ses reglages Lightroom (Contraste -50, Hautes lumieres -30, HDR et corrections d'objectif desactives, pastilles sur Lumiere/Couleur/Effets/Detail). Mesures cles : le bleu descend quand la luminance monte (B-G 0 -> -12/255), les tons moyens virent olive (R-G ~ -5), le ciel atterrit a 178-194 deg (cyan, jamais bleu), le feuillage tombe a 85-105 deg avec S <= 0.35, la peau est preservee (27-36 deg), le point blanc reste sous 255 et les noirs restent denses (aucun matte). Ni grain ni vignetage systematiques (mesures a l'appui). Nouveaux fichiers : `utils/lut3d.js`, `utils/visionPresets.js`, `vision/presetPreview.js`, `scripts/smoke-vision-preset.mjs` (20 verifications rejouant les cibles de l'audit). Perf : le smoke navigateur Vision passe en 6,9 s. Bug trouve et corrige en route : `applyVisionStage` (project/pipeline.js) jugeait l'etage Vision « neutre » et le SAUTAIT, parce qu'un preset est une LUT qui ne modifie aucune cle de `filters` — le preset ne descendait donc ni jusqu'au Studio ni jusqu'a l'export. L'etage teste desormais `vision.presetId` separement. Correction au passage d'un echec PREEXISTANT : `scripts/audit-vision-filters.mjs` plantait depuis le commit ee19c8c car il lisait `VisionPanel.jsx` et `VibeFxStudio.jsx`, supprimes avec l'ancienne interface /studio.

- Mise a jour 2026-08-11 (import de presets Lightroom, exact) : le porteur du projet demande d'integrer CN11/CN17 (pack Adobe « Cinema II »). Verification faite : leurs valeurs ne sont PAS publiees sur le web (les resultats ne sont que des packs tiers sans rapport) et Lightroom n'est pas installe sur la machine. Recopier des valeurs de curseurs serait de toute facon faux : Lightroom applique ses reglages a du RAW lineaire dans son espace de travail, l'app travaille sur du JPEG 8 bits deja developpe. Solution retenue, qui evite completement le probleme : la capture par **Hald CLUT**. On genere une mire contenant une fois chaque couleur d'une grille RVB, on la fait passer dans Lightroom avec le preset, et l'image qui ressort EST la table de conversion du preset. Aucune approximation sur la couleur. Nouveaux fichiers : `utils/haldClut.js`, `utils/xmpPreset.js`, `utils/presets/` (genere), `scripts/make-hald-clut.mjs`, `scripts/import-lightroom-preset.mjs`, `docs/lightroom/2-methode-et-pieges.md`. Le `.xmp` reste lu en complement, pour les seuls reglages qu'une Hald CLUT ne peut pas voir (clarte, texture, nettete, grain, vignetage — ils dependent des pixels voisins ou de la position). `visionPresets.js` accepte desormais deux formes de preset, indiscernables au rendu : une fonction pure (powlisher) ou une table importee (`getLut`). Aller-retour verifie de bout en bout : mire -> preset -> reimport -> comparaison, ecart moyen 0,24/255 et max 1,8/255 sur des couleurs reelles. Le smoke `test:vision-preset` passe de 20 a 40 verifications. Reserve produit notee dans la doc : embarquer une table de preset Adobe sous son nom dans un produit public est un risque de licence — l'usage sain est la calibration de presets maison.

- Mise a jour 2026-08-11 (elagage de `todo.md`) : le porteur du projet signale que `todo.md` (372 lignes) fait relire a chaque agent, a chaque session, l'historique complet de phases livrees et closes — du contexte paye pour rien. Correction : `todo.md` retombe a ~160 lignes et ne porte plus QUE le chantier actif (les presets de Vision). Le detail des phases A-G du redesign part dans `docs/archive-vibeos-2026-08-11.md`, et le prompt de reprise part dans `docs/prompt-reprise-2026-08-11.md` (il ne sert qu'une fois, a quelqu'un qui l'a deja recu en entier). `AGENTS.md` est aligne sur cette pratique : nouvelle regle « todo.md doit rester court », seuil d'archivage a ~200 lignes, et le prompt de reprise se range desormais dans `docs/` avec un lien depuis `todo.md` au lieu d'etre colle a la fin.
- Mise a jour 2026-08-30 (bibliotheque Vision a 136 presets) : ajout par capture Lightroom Cloud de 92 modules dans `src/features/vibefx-studio/utils/presets/` — FT01-FT12, 12 looks `film-*`, BW01-BW12, VN01-VN10, UA01-UA10, LN01-LN10, LF01-LF08 et TR01-TR18. `presets/index.js` les enregistre dans les collections Futuriste, Inspire d'un film, Noir et blanc, Vintage, Architecture urbaine, Paysage, Style de vie, Voyage et Voyage II ; l'UI `/creer/vision` expose les comptes exacts. `import-lightroom-preset.mjs` normalise le vignetage Adobe negatif vers la force positive du moteur ; LF03 conserve son voile −28 grace a la borne sure etendue a −30 ; `smoke-vision-preset.mjs` verrouille les 136 presets et chaque collection (394 verifications). Les quatre dernieres familles ont ete controlees a l'oeil sur une photo telephone et une photo reflex du dossier `~/Desktop/maroc` ; `test:vibeos-vision` passe 3/3 et `test:reglages-avances` passe 1/1.
- Mise a jour 2026-08-31 (correction BW Lightroom) : `utils/presets/bw01.js` a `bw12.js` sont regeneres depuis douze nouvelles Hald 2048 réellement passées dans `Style : Noir et blanc`. L'ancienne capture était restée RVB et produisait des photos couleur. Les LUT corrigées portent le mélange N&B Adobe et les virages attendus (BW01 gris, BW02 sépia, BW03 rose, BW04 vert, BW11 brun, BW12 bleu) ; BW10–BW12 séparent leur grain 75 de la table par un lissage mesuré et le rejouent via le moteur spatial. `scripts/smoke-vision-preset.mjs` refuse désormais une chroma résiduelle et verrouille les six signatures (426/426). Contrôle navigateur sur `37134.jpg` conforme aux miniatures Lightroom. Lint : 0 erreur, 5 avertissements préexistants. Build compilé puis bloqué par l'ABI locale préexistante de `better-sqlite3` (module 127, Node courant 147).
- Mise a jour 2026-08-31 (effets spatiaux BW alignes sur Lightroom) : audit direct de BW01 a BW12 dans l'application Adobe Lightroom. Les douze modules `utils/presets/bw*.js` portent maintenant la vignette commune -25 (force moteur 25, profil radial Lightroom V2, milieu 50, arrondi 0, contour 50, hautes lumieres 0). BW01-BW09 ont grain 0 ; BW10-BW12 conservent 75/10/60. Les familles de detail deviennent BW01-BW04 clarte/texture -10/-10, BW05-BW06 +10/0, BW07-BW09 0/+20, BW10-BW12 0/+30 ; le faux voile +14 et la texture -15 de BW08 disparaissent. `smoke-vision-preset.mjs` ajoute sept contrats de regression (433/433). Controle navigateur sur `~/Desktop/maroc/IMG_0216.JPG` : vignette visible dans la grande image et les miniatures, BW04 sans grain. Gates : Vision 3/3, reglages avances 1/1, lint 0 erreur (5 avertissements preexistants). Build compile puis reste bloque par l'ABI locale preexistante `better-sqlite3` 127/147. Aucun deploiement.
- Mise a jour 2026-08-31 (audit qualite representatif Lightroom) : nouveau dossier `docs/lightroom/audit-qualite-presets-2026-08-31/` avec cinq sources figees, tirage SHA-256 reproductible, 50 exports Lightroom, 50 rendus du vrai pipeline Vision, 50 planches/heatmaps, journaux, metriques RVB/Lab/luminance/SSIM et rapport famille par famille. Les 235 imports Lightroom des 22 collections sont separes des 26 presets VibeFX internes. Douze familles sont conformes, neuf a surveiller et Vintage non conforme ; Cinéma II a ete blanchi apres correction d'un faux positif de selection, tandis que Noir et blanc garde son identite avec un ecart spatial a recalibrer. Aucun fichier moteur/preset ni source utilisateur n'a ete modifie, aucun deploiement.
- Mise a jour 2026-08-31 (correction Vintage + Noir et blanc apres audit) : `presets-lightroom/recapture-vintage-corrected/` conserve les dix exports Hald obtenus apres une reinitialisation Lightroom explicite avant chaque VN01-VN10 ; l'ancien lot fautif est garde explicitement sous `presets-lightroom/recapture-vintage-contaminee/` pour ne pas etre reutilise par erreur. `utils/presets/vn01.js` a `vn10.js` sont regeneres depuis les captures corrigees et les XMP Premium Adobe, avec leur grain et les effets spatiaux de VN06. La capture precedente etait contaminee par l'etat noir et blanc reste sur la mire. `utils/presets/bw01.js` a `bw12.js` ne portent plus le vignettage 25 : aucun XMP Adobe BW ne declare `PostCropVignetteAmount`. `audit-qualite-presets-2026-08-31/corrections-vintage-bw/` garde huit comparaisons apres correction ; Vintage est a 2,04-4,32/255 sur la couleur seule, BW01/BW04/BW05 a 2,64-3,32/255 et BW10 a 3,87/255 hors grain aleatoire. Le runner accepte `AUDIT_OUTPUT_VARIANT` pour ne pas ecraser un lot precedent. `smoke-vision-preset.mjs` verrouille les valeurs XMP des deux familles (436/436). Lint : 0 erreur, 5 avertissements preexistants. Build Node 22 : passe, avec l'avertissement NFT preexistant. Les smokes navigateur echouent avant Vision parce que le bouton Dev ne ferme plus la modale d'authentification ; echec preexistant et hors lot. Aucun deploiement.
- Mise a jour 2026-08-31 (release VibeFX live) : le commit `7401cd0` publie les 261 presets Vision, les performances de miniatures et le Studio Gradient/Lumen sur GitHub `MFcv1/vibe_fxV2`. Firestore, Storage et les 17 Functions sont redeployes sur `vibefx-v2`. App Hosting utilise une archive source locale de 49,1 Mio vers le backend existant `vibefx-v2-web`, car son ancien lien `ECFN15/vibe_fxV2` est en lecture seule ; l'URL live est `https://vibefx-v2-web--vibefx-v2.europe-west4.hosted.app`. Les six routes controlees repondent 200 et le module live du Gradient Builder expose Glassy, Glint, Mist et Skyline.
- Mise a jour 2026-08-31 (favoris de presets Vision) : chaque carte de `/creer/vision` separe maintenant le bouton d'application du bouton etoile ; un clic sur l'etoile ne change donc jamais le rendu courant. Le filtre Favoris, son compte et la recherche composee sont portes par `presetCollections.js`. `usePresetFavorites.js` ecoute et ecrit la sous-collection `users/{uid}/visionPresetFavorites/{presetId}` en temps reel, avec etat separe par UID, mise a jour optimiste, verrou pendant l'ecriture et rollback lisible sur erreur. Les regles Firestore imposent le proprietaire, un identifiant de preset identique au document et un schema ferme ; l'emulateur confirme qu'un second compte ne peut ni lire ni ecrire les favoris du premier. Gates avant publication : 438/438 moteur, smoke navigateur Vision 3/3, test cible 1/1, lint sans erreur (5 avertissements preexistants), build Node 22 vert avec l'avertissement NFT preexistant. Les regles sont publiees avant le front ; commit `4f8336f` sur `master`, rollout App Hosting `build-2026-08-31-005` reussi. Sur l'URL live, les 261 etoiles et le filtre Favoris sont presents, l'etat vide fonctionne et la console reste sans erreur ; aucune donnee de test n'a ete ajoutee au compte reel.
- Mise a jour 2026-08-31 (connexion Google Safari) : le popup Firebase a ete reproduit dans Safari. Son URL portait `fac={error: UNKNOWN_ERROR}` avant meme Google : la cle reCAPTCHA App Check `vibefx-v2-web` autorisait localhost, firebaseapp.com et web.app, mais pas le domaine App Hosting live. Ce domaine est ajoute dans Google Cloud sans ouvrir la cle a tous les domaines et sans desactiver App Check. Une fois cette erreur retiree, Safari montrait aussi son blocage du premier popup : le resolver Firebase etait initialise apres le clic. `src/context/AuthContext.jsx` appelle desormais `getRedirectResult(auth)` au montage, expose `googleAuthReady`, et `StudioAuthGate` n'active Google qu'apres cette preparation. Le gate traduit aussi `popup-blocked`, `cancelled-popup-request` et `unauthorized-domain`, et journalise le vrai code au lieu de tout masquer. Gates avant publication : smoke cible 1/1, lint sans erreur (5 avertissements preexistants), build Node 22 vert avec avertissement NFT preexistant.

## Journal — 2026-09-01 (bibliothèque : import HEIC/HEIF iPhone)

- Nouveau `src/features/vibeos/library/heicImport.js` : reconnaissance des
  extensions et MIME HEIC/HEIF, conversion locale en JPEG qualité 0,94 avec
  `heic-to/csp`, et renommage portable `.jpg`. Le moteur libheif est importé
  dynamiquement au premier fichier concerné ; aucun serveur de conversion.
- `photoImport.js` normalise systématiquement le HEIC avant vignette, IndexedDB,
  Vision et Firebase. Le record conserve `convertedFrom` (nom, MIME et poids
  source), tandis que `blob`, `name`, `type` et `bytes` décrivent le JPEG réel.
- `useLibrary.js` et `LibraryScreen.jsx` distinguent maintenant un HEIC dont la
  conversion a échoué d'une image ordinaire illisible. Les sélecteurs acceptent
  aussi `.heics` et `.heifs`.
- Vérification réelle dans Chromium avec
  `/Users/matthis/Downloads/IMG_6469.HEIC` : `IMG_6469.jpg`, `image/jpeg`,
  5712×4284, 6 873 373 octets, tuile affichée et Blob IndexedDB décodable.
- Gates : 41 vérifications bibliothèque hors navigateur, smoke navigateur 1/1,
  lint global 0 erreur et 5 avertissements préexistants, build Node 22 vert
  avec l'avertissement NFT préexistant.
- Déploiement App Hosting demandé ensuite : cible unique `vibefx-v2` /
  `vibefx-v2-web` en `europe-west4`, Cloud Build
  `1156c620-b9c0-4b66-85ca-22da1f73e3f4` réussi, révision
  `vibefx-v2-web-build-2026-09-01-001` prête et à 100 % du trafic. La route
  `/creer/bibliotheque` répond 200 et son chunk live contient les nouveaux
  contrats `.heics/.heifs` et `convertedFrom`. Le smoke headless complet est
  arrêté proprement au gate d'authentification ; aucune donnée du compte réel
  n'a été créée pour le test.

## Journal — 2026-09-01 (synchronisation Vision → Layout)

- `useVisionEditor.js` ouvre désormais la première photo brute du projet et
  synchronise le preset, son intensité et les réglages immédiatement dans le
  provider partagé. Changer d'onglet juste après un clic ne dépend plus de la
  sauvegarde IndexedDB différée.
- `layoutPersistence.js` reconstruit pour Layout une image rendue par Vision,
  mais attache et republie son Blob source. Une succession de sauvegardes ne
  peut donc pas cuire le même preset plusieurs fois.
- `projectModel.js` donne une révision aux réglages Vision ; Layout la copie
  dans `composition.visionRevision`. `pipeline.js` et `useStudioEditor.js`
  reconnaissent ce marqueur et sautent la seconde application du preset.
  Les anciennes compositions sans marqueur restent compatibles.
- Le smoke pipeline mesure maintenant le rendu brut, le changement Vision, la
  reprise par Layout et l'absence de double traitement dans Studio, en desktop
  et mobile.
- Gates : build Node 22 vert avec l'avertissement NFT préexistant ; lint global
  sans erreur et 5 avertissements préexistants. Le smoke navigateur reste
  bloqué avant Layout par le contournement d'authentification Dev qui ne ferme
  pas la modale, échec préexistant déjà documenté. Aucun déploiement.
