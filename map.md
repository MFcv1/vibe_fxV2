# map.md - Carte vivante Vibe_fx V2

Derniere mise a jour : 2026-07-29

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
|   |   `-- lumen/                    # Copie integree de Leonxlnx/lumenshaders pour generer des fonds shader dans Layout, mode safe desktop WebGL
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
|   |   |   |-- layout-visuel/page.js   # Espace Layout — ecran reel depuis la phase B tranche 1 (LayoutScreen)
|   |   |   |-- studio/page.js          # Espace Studio — placeholder jusqu'a la phase D
|   |   |   |-- vision/page.js          # Espace Vision — placeholder jusqu'a la phase C
|   |   |   `-- son/page.js             # Espace Soundtrack — placeholder jusqu'a la phase E
|   |   |-- studio/
|   |   |   |-- layout.js               # CSS lourds du studio scopes a /studio, incluant le rail IA
|   |   |   |-- page.js                 # Page studio noindex + deep-link `?workspace=layout`
|   |   |   `-- StudioClient.jsx        # Client wrapper du studio
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
|   |   |   |   |-- useCanvasRenderer.js
|   |   |   |   |-- useImageUpload.js
|   |   |   |   `-- useLayoutHelpers.js
|   |   |   |-- utils/
|   |   |   |   `-- canvasUtils.js
|   |   |   |-- index.js
|   |   |   |-- VibeFxLayout.jsx
|   |   |   |-- vibefx-layout.css
|   |   |   `-- vibefx-tailwind.css
|   |-- vibefx-studio/                 # Dossier reel : src/features/vibefx-studio/
|   |   |-- ai/                         # Catalogue/actions/payload/client/hook du rail IA studio, gateway Functions uniquement
|   |   |-- components/                 # Header, tabs Studio/Layout/Library/Soundtrack/Vision/Video et panneaux source Vibe_fx ; le header embarque le mini-player Soundtrack global
|   |   |   `-- ai/                     # Rail IA contextuel : actions, prompt, credits, trace job, outputs
|   |   |-- data/                       # Constantes, presets et donnees UI importees
|   |   |-- engine/                     # Rendu canvas/physics importes depuis Vibe_fx
|   |   |-- hooks/                      # Hooks interaction, renderer, bibliotheque et assets
|   |   |-- soundtrack/                 # Onglet Soundtrack full page V2 : page Import IA gratuit par defaut + bibliotheque Vibe_fx en popup desktop/fullscreen mobile, Firebase projet ou local-first
|   |   |   |-- components/               # ProjectLibraryPanel popup avec import fichier, suppression/playlists/classement local/projet, AiMusicImportAssistant en pleine page Soundtrack, Search provider-specifique conserve pour composants legacy, results/rows/player et SoundtrackHeaderMiniPlayer global
|   |   |   |-- data/                     # Providers/filtres/defaults Soundtrack reutilisant musicCatalog
|   |   |   |-- hooks/                    # Recherche API, player preview, controller global Soundtrack, bibliotheque projet Firebase et bibliotheque locale IndexedDB/dossier
|   |   |   |-- services/                 # Modele/client Firestore/Storage projet (tracks + playlists), cache/search provider, IndexedDB, manifest, File System Access, import dev public/music/local-imports, downloads locaux et audit droits
|   |   |   |-- SoundtrackPage.jsx        # Experience full page Soundtrack dans le studio, sans canvas/sidebar, import IA gratuit par defaut sans pistes starter injectees, consomme le controller audio global
|   |   |   `-- soundtrack.css          # CSS dark-ui/technical-ui scope Soundtrack charge par /studio/layout, incluant le player bas et le mini-player header
|   |   |-- utils/                      # Utilitaires canvas/image + color science Vision (`visionColorScience.js`, `visionMetrics.js`, `visionRecommendation.js` — signaux image, scoring profil<->photo et rendu des vignettes, partages entre l'ancien VisionPanel et l'ecran Vision VibeOS)
|   |   |-- video/                      # Module Vibe_CUT importe, dont `export/useExportController.js` (logique d'export extraite du panneau), `engine/textOverlayRenderer.js` (rendu canvas des textes extrait de VideoPreview) et `engine/xfadeTransitions.js` (contrepartie canvas exacte des transitions natives `xfade` de FFmpeg, courbes relevees sur des rendus reels), `export/` pour ExportManifest + services localMock/Firebase future, `store/videoStore.js` dont l'action additive `applyMontageScore` (partition de montage, lot L2), `data/musicCatalog.js` pour catalogue/sources/licences, `data/musicRights.js` pour audit/manifeste droits musique, `services/exportRightsManifestClient.js` pour persistance Firestore owner-scoped, `model/timelineModel.js` pour le modele canonique tracks/items, `model/mediaModel.js` (SANS AUCUN IMPORT) pour les mouvements photo, leur intensite et `applyImageMotionTransform` — la transformation d'apercu que le test de parite charge telle quelle, `utils/audioWaveform.js` pour l'extraction waveform client, `utils/quickTools.js` pour la palette rapide drag/drop, et `panels/VibeCutQuickPanel.jsx` pour le panneau droit VibeCut
|   |   |-- index.js
|   |   |-- components/modals/LumenShaderModal.jsx # Modal iframe Lumen Shader Studio + pont postMessage pour appliquer le shader comme fond Layout
|   |   |-- VibeFxStudio.jsx            # Shell studio Vibe_fx + import publication V2 + vue Soundtrack full page + controller audio global persistant entre onglets studio
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
|   |   |   `-- AudioProvider.jsx       # Audio global : l'element <audio> vit dans le layout /creer et survit aux navigations (mini-lecteur du header)
|   |   |-- home/
|   |   |   |-- HomeScreen.jsx          # Accueil incubateur : reprise du projet courant, 5 cartes d'espaces (Layout/Studio/Vision/Soundtrack/VibeCut), recents avec dupliquer/supprimer
|   |   |   `-- home.module.css
|   |   |-- layout/                     # Ecran Layout reel (phase B tranches 1+2+3) - moteurs vibefx-studio importes, jamais reecrits
|   |   |   |-- useLayoutEditor.js      # Composition des moteurs existants (useLayoutState/CanvasRenderer/CanvasEvents/LayoutHelpers/ImageUpload/Export) + fonds generes (applyLayoutMesh/applyLumenBackground/clearGeneratedBackground, smoothBlur), textures multiples + opacite, zones custom (add/update/delete/clear via utils/customLayout), historique undo/redo 30 etats (miroir VibeFxStudio) + Cmd+Z/Shift+Cmd+Z, import par slot, templates thematiques, reprise et sauvegarde du projet (Blobs IndexedDB) + vignette 256px
|   |   |   |-- layoutPersistence.js    # Traduction etat editeur <-> projet VibeOS : images/textures/Lumen en **Blobs** (jamais des dataURL), zones custom, slots, textes, stickers, fond ; restauration en elements Image
|   |   |   |-- LayoutScreen.jsx        # Apercu canvas (drag & drop, plein ecran, undo/redo, comparer, apercu Insta) + panneau 4 blocs (Format, Modele, Images, Habillage avec fond Couleur/Flou/Genere + Flou pro) + reglages avances (textes, stickers, zones custom, textures, zone selectionnee, geometrie) + sheet d'export
|   |   |   |-- ZoneOverlay.jsx         # Editeur de zones du modele personnalise pose sur l'apercu : deplacement, poignee de redimension, suppression (geometrie d'interface uniquement, le rendu reste au moteur)
|   |   |   |-- InstaPreviewSheet.jsx   # Apercu Instagram du visuel exporte : post, story, carrousel panorama (maquette CSS Modules, aucune donnee reelle)
|   |   |   |-- TemplateSheet.jsx       # Bibliotheque des ~80 templates thematiques (17 categories), apercus dessines depuis les vraies zones/textes
|   |   |   |-- TemplatePreviewSvg.jsx  # Apercu SVG d'un template : zones custom reelles ou silhouettes des 8 modeles integres
|   |   |   |-- MeshSheet.jsx           # Fond Mesh gradient : 4 couleurs editables, 6 palettes, melange, apercu CSS ; rendu final par renderLayoutMeshBackground (moteur existant)
|   |   |   |-- LumenSheet.jsx          # Fond Lumen : meme app embarquee /vendor/lumen + protocole postMessage que l'ancien modal, habillage VibeOS
|   |   |   |-- SmoothBlurSheet.jsx     # Flou pro : pilote la config du moteur partage vibefx-shared/smoothBlur (looks rapides, aleatoire safe, direction/hauteur/intensite/finesse)
|   |   |   `-- layout.module.css
|   |   |-- primitives/
|   |   |   |-- index.jsx               # Button, IconButton, Segmented, Card, Badge, Spinner, Progress, EmptyState, Collapsible, Slider (double-clic reset), TileGrid/Tile, Sheet (lateral desktop / bottom sheet mobile), SearchField, ToastProvider/useToast
|   |   |   `-- primitives.module.css
|   |   |-- project/
|   |   |   |-- projectModel.js         # Modele projet v1 (format, template, images, vision, studio, soundtrackTrackId, thumbnail) + normalisation defensive
|   |   |   |-- projectDb.js            # IndexedDB `vibeos` (stores projects + meta), degrade en no-op si indisponible, recents limites a 8
|   |   |   `-- VibeOsProjectProvider.jsx # Contexte du projet qui circule : autosauvegarde debouncee 800ms, flush sur pagehide, create/open/duplicate/remove/ensureProject
|   |   |-- shell/
|   |   |   |-- VibeOsShell.jsx         # Bandeau superieur unique (nav espaces + mini-lecteur + Publier vers /studio jusqu'a la phase F) + tab bar basse mobile safe-area
|   |   |   |-- MiniPlayer.jsx          # Mini-lecteur du header, visible seulement si une piste est chargee, clic titre -> /creer/son
|   |   |   |-- SpacePlaceholder.jsx    # Ecran provisoire des espaces en construction (phases D et E)
|   |   |   `-- shell.module.css
|   |   |-- vision/                     # Ecran Vision reel (phase C) - science des couleurs existante importee, jamais reecrite
|   |   |   |-- useVisionEditor.js      # Orchestration : rendu photo (useCanvasRenderer vue vision-pro), export, mesure de l'image (visionMetrics), tri des looks (scoreProfileForImage), vignettes en file d'attente, historique 30 etats, lien avec le projet commun
|   |   |   |-- visionLooks.js          # Les 12 looks du premier niveau : pointeurs vers de vrais profils CAMERA_BRANDS, resolus par buildVisionProfileModel, renommes en francais + bibliotheque complete par marque pour les avances
|   |   |   |-- autoEnhance.js          # « Ameliorer ma photo » : correction deduite des mesures + phrase humaine, et garde-fou par image (guardLookForImage) qui empeche un look de fermer une photo de nuit
|   |   |   |-- VisionScreen.jsx        # Bouton Ameliorer, intensite 0-100, 12 looks tries avec badges « Conseille » et raisons, comparer (maintien = original), avances (lumiere/couleur/matiere, garde-fous, bibliotheque par marque), sheet d'export
|   |   |   `-- vision.module.css
|   |   `-- styles/
|   |       `-- vibeos.css              # Tokens `--vo-*` copies de vibecut.css, scope strict `.vibeos` (sombre, theme clair pret)
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
|-- fav.md                              # Tache et plan favoris permanents de la bibliotheque
|-- CLAUDE.md                           # Fichier genere, non encore enrichi
|-- eslint.config.mjs
|-- firebase.json                       # Config Firebase backend + emulateurs, sans Hosting classique
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
|   |-- audit-vision-filters.mjs        # Audit statique des profils Vision et du branchement safe smartphone, incluant temperature/halation/tint global masques
|   |-- firebase-deploy.mjs             # Wrapper cross-platform deploy backend/functions avec cible controlee, firebase-tools local et timeout discovery 60s
|   |-- run-vision-corpus-test.mjs      # Lance Next local puis Playwright sur le corpus smartphone Vision local
|   |-- run-vision-ui-test.mjs          # Lance un serveur Next local dedie puis Playwright Vision avec SMOKE_BASE_URL controle
|   |-- run-video-ui-test.mjs           # Lance un serveur Next local dedie puis les smokes Playwright Vibe_CUT fonctionnel + securite media/capacites avec SMOKE_BASE_URL controle
|   |-- smoke-smooth-blur-ui.mjs        # Smoke Playwright Flou lisse pro : bypass dev, sliders, directions, presets, reverse et appliquer
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
|   |-- smoke-studio-emulator-ui.mjs    # Smoke test navigateur studio + sauvegarde Firestore/Storage emulateurs
|   |-- smoke-studio-ai-rail.spec.cjs   # Smoke Playwright du rail IA studio : ouverture, actions par onglet, prompt, cout, gateway/error, mobile
|   |-- fixtures/
|   |   `-- pixabay-music-search.html   # Fixture HTML locale pour parsing provider Pixabay Music importable + metadata-only
|   |-- smoke-soundtrack-core.mjs       # Smoke pur Soundtrack V2 : mapping ProviderTrack -> ProjectSoundTrack, droits, cache key provider, parsing historique Pixabay, manifest sans Blob/File
|   |-- smoke-soundtrack-ui.spec.cjs    # Smoke Playwright onglet Soundtrack V2 : provider-first Pixabay manuel + Openverse social-first, Archive/Wikimedia retires, aucun fallback Vibe_CUT dans le scan, popup bibliotheque, import fichier local, playlists/suppression locaux, manifest, providers/API, responsive
|   |-- smoke-studio-ui.spec.cjs        # Smoke test Playwright du flux studio -> import publication
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
|   |-- smoke-vibecut-ui-v2.spec.cjs   # Smoke Playwright nouveau front : accueil, isolation CSS, regle typographique, cycle projet, noindex des six routes
|   |-- smoke-vibecut-quick-v2.spec.cjs # Smoke Playwright montage rapide : import reel, storyboard, duree, mouvement, transition, texte, musique, export
|   |-- smoke-vibecut-style-recipes.mjs # Smoke pur du moteur de recettes phase 3 : generation sur 5 jeux de scenes x 4 styles x 3 rythmes, et parite mouvements/transitions moteur <-> SERVER_RENDER_CAPABILITIES
|   |-- smoke-vibecut-advanced-v2.spec.cjs # Smoke Playwright montage avance : ordre des sept pistes, bascules de piste, rognage/reorder/deplacement au pointeur, annuler-retablir, tete de lecture, decoupe, zoom, magnetisme, inspecteur, bibliotheque, export 60 fps, responsive 390 px et preuve du moteur d'apercu unique
|   |-- smoke-vibecut-guided-v2.spec.cjs # Smoke Playwright creation guidee : parcours 5 etapes, generation verifiee dans l'apercu, reouverture du meme projet en montage rapide, zero erreur console
|   |-- smoke-vision-corpus.spec.cjs    # Smoke test Playwright optionnel sur les fixtures smartphone Vision locales, avec gates metriques par profil
|   |-- smoke-vision-ui.spec.cjs        # Smoke test Playwright Vision : miniatures image courante, mode simple/expert, recherche/familles/favoris, recettes correctives diagnostic, import demo + fixture synthetique, profils a risque, halation/tint global safe sur blancs/neons/neutres, avant/apres maintenu, intensity 0/100, metriques clipping/saturation/voile, mobile, reset
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

## Pages cible a creer plus tard

- `/legal/confidentialite`
- `/legal/conditions`

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
- `firebase.json` ne declare pas de cible Firebase Hosting classique : l'application Next.js passe par Firebase App Hosting via `apphosting.yaml`; `firebase:deploy:backend` et `firebase:deploy:functions` passent par `scripts/firebase-deploy.mjs`, exigent `FIREBASE_PROJECT_ID`, refusent les cibles `demo-*` et limitent les ressources deployees.
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
- `npm run test:vision-ui` lance `scripts/audit-vision-filters.mjs`, demarre un serveur Next local via `scripts/run-vision-ui-test.mjs`, puis execute `scripts/smoke-vision-ui.spec.cjs` ; l'audit verifie les cles de profils Vision, le branchement `safeSmartphone`, la normalisation du renderer, le garde-fou final `applySmartphoneOutputGuards`, le blend d'intensite perceptuel, le mode preview `low` fidele sur la passe couleur pixel avec saturation CSS neutralisee, le cap preview interactif 3 MP dans `useCanvasRenderer.js`, la sonde dev/test `__vibefxVisionQualityProbe`, les cles/defaults/masques pixel/controles UI de saturation selective peau/rouges-oranges/ciel/verts, le masque temperature safe pour neutres/hautes lumieres, le masque halation safe pour limiter les glows rouges sur blancs neutres, le tint global safe qui remplace l'overlay legacy en mode smartphone, le rail `Recommandes image`, les alertes `Profil actif vs image`, les recettes correctives diagnostic, le rail `Comparer favoris`, le signal UI performance du diagnostic, le score anti-voile gris, la detection peau ponderee, les metriques hue-zone ciel/vegetation/rouges-oranges, la mitigation de dosage depuis le diagnostic et le modele canonique `id/name/family/intent/bestFor/avoidFor/strength/parameters/recommendedIntensity/intensityRange/safetyRules/previewTags/technicalNotes/inspirationLabel` genere pour chaque profil, puis confirme que l'UI consomme ces `parameters` normalises et affiche le libelle d'inspiration sans promettre de reproduction constructeur. Il echoue si un profil brut a risque n'a pas de metadonnees explicites `strength`, `bestFor` et `avoidFor`. Le smoke navigateur importe l'asset demo, verifie les miniatures calculees sur l'image courante, le rail de recommandations image avec application/undo, mode simple/expert avec courbe master safe, saturation selective peau/rouges-oranges/ciel/verts, halation/noirs leves/teintes tonales, recherche, filtre famille, favoris persistants localStorage, rail de comparaison rapide Velvia/Astia, applique Velvia, verifie le profil actif, expose l'intention/l'inspiration/garde-fous/notes techniques/dosage conseille du profil, verifie que Velvia applique la saturation normalisee `120` dans les controles experts, verifie le bouton dosage conseille `70%`, verifie l'avertissement hors plage a `100%`, la mitigation diagnostic vers `80%`, la recette `Dose sure` vers `80%` et le retour manuel a `80%`, expose le diagnostic image avec temps/taille source, taille preview cappee, score de voile et zones hue, compare un rendu `low` et `high` hors ecran via la sonde runtime, mesure clipping/saturation/voile/peau/neutres proteges/ciel/verts/rouges-oranges via `visionMetrics.js`, verifie undo/redo sur le profil applique, sauvegarde un profil personnel local nomme, le retrouve par recherche, le supprime et nettoie ses favoris, verifie le split avant/apres reglable, verifie le bouton maintenu avant/apres, verifie une intensite 50 intermediaire, le retour source a intensite 0, teste une fixture synthetique smartphone-like sur Velvia/Ektar/Sepia avec alerte contenu/profil et recette corrective contextuelle, teste une fixture 4200x3200 pour verifier que la preview Vision reste sous 3,05 MP tout en gardant `fullWidth/fullHeight` dans la sonde, teste une fixture metrique delavee pour declencher `greyVeilRisk`, teste une fixture metrique peau claire/medium/foncee, mesure par regions que les saturations selectives ciblent peau/rouges-oranges/ciel/verts sans polluer les neutres ni la peau pour le controle chaud, verifie que la chaleur maximale affecte moins la bande neutre que la zone chaude coloree, verifie que la halation safe affecte moins un blanc speculaire neutre qu'une zone neon coloree, verifie par test moteur extrait que le tint global safe affecte moins un pixel neutre qu'un pixel colore, verifie le mobile sans overflow horizontal et le reset.
- `npm run check:vision-corpus` verifie la presence des 12 fixtures smartphone locales ignorees par Git dans `test-fixtures/vision-corpus`; il reste non bloquant par defaut, devient strict avec `VISION_CORPUS_REQUIRED=1`, et rappelle que Vision ne peut pas etre declaree stable finale tant que le corpus reel est absent/incomplet. `npm run test:vision-corpus` ajoute un smoke Playwright metrique sur les fixtures presentes et passe en skip si le corpus local est vide.
- L'onglet Vision applique les profils via `normalizeVisionFilters` et `buildVisionProfileModel`, et les miniatures comme l'application profil consomment les `vision.parameters` normalises plutot que les anciens `filters` bruts. Il expose des miniatures de profils calculees sur l'image courante, un rail `Recommandes image` classe par metriques source (peau, ciel/verts, basse lumiere, saturation deja haute, image plate, neutres) avec badges de signaux detectes et application directe au dosage conseille, des alertes `Profil actif vs image` quand le profil actif est probablement risqué pour le contenu source, avec bouton `Essayer` vers la meilleure alternative recommandee au dosage conseille, un diagnostic image visible (clipping, saturation forte, zones hue ciel/verts/rouges-oranges, noirs, range tonal P95-P05, score de voile gris, peau via score pondere hue/RGB/YCbCr, neutres proteges, temps de diagnostic, taille source, taille preview cappee et echantillon) avec action de mitigation vers le dosage conseille ou le bord sur de la plage active et bloc `Recettes correctives` qui applique des patches limites pour intensite, chroma, voile gris, hautes lumieres, ombres, peau ou neutres, les badges d'usage/risque/famille, l'intention, le libelle d'inspiration, les garde-fous, les notes techniques, le dosage conseille et la plage de dosage de chaque profil, un bouton d'application du dosage conseille pour le profil actif, un avertissement si l'intensite active sort de la plage conseillee avec bouton de retour au bord sur, un mode simple/createur (chaleur, contraste, peau, grain), un mode expert (lumiere, hautes lumieres, ombres, courbe master 5 points safe, saturation, vibrance, saturation selective peau/rouges-oranges/ciel/verts, clarte, nettete, anti-brume, vignette, grain, noirs leves, halation, teintes et couleurs tonales), recherche de profils, filtre par famille, favoris locaux persistants, rail de comparaison rapide des favoris avec miniatures et dosage conseille, profils personnels locaux nommables/persistants et supprimables en section `Perso`, undo/redo local des reglages Vision, un reset Vision, le profil actif, une intensite globale visible, un split avant/apres reglable sur le canvas et un bouton maintenu `Avant` qui restaure temporairement l'image source sans perdre le dosage courant. Les profils camera-inspired bruts a risque declarent maintenant leur `strength` et leurs cas d'usage/evitement. Le moteur Vision protege les saturations smartphone avec ceiling adaptatif, temperature masquee sur neutres/blancs/ombres, halation masquee sur blancs neutres/speculaires, tint global legacy masque en pixels, saturation selective hue/luma, vibrance protegee, protection tons peau/neutres/hautes lumieres, split toning limite, clamp des courbes/teintes/sepia/blur/hueRotate, garde-fou final anti-crush des ombres couleur et blend linear-light ; la preview interactive studio/Vision est plafonnee a 3 MP sans toucher l'export/import publication pleine resolution, et la preview `low` pendant drag conserve ces protections colorimetriques et ne coupe plus que les effets spatiaux lourds.
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
