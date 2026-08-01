 # Vibe_CUT Export Pro - Production Runbook 2026-06-06

Ce runbook documente la source de verite deploiement Export Pro. Il ne contient aucun secret et ne remplace pas une confirmation avant action cloud mutante.

## Etat actuel

- App Hosting utilise `NEXT_PUBLIC_VIBECUT_EXPORT_MODE=firebase` dans `apphosting.yaml`.
- Functions exposent `createVideoExportJob`, `cancelVideoExportJob`, `retryVideoExportJob`, `getVideoExportDownloadUrl` et `getVideoExportAdminTelemetry`.
- Le renderer Cloud Run cible MP4 H.264/AAC avec trims, concat/xfade adjacent, rotations, textes fade/none, colorimetrie FFmpeg et mix audio.
- La signature renderer utilise `x-vibecut-timestamp` + `x-vibecut-signature = HMAC(timestamp.body)` en verification applicative par defaut.
- `EXPORT_RENDERER_AUTH_MODE=oidc` ou `hmac+oidc` prepare l'appel Cloud Run prive avec ID token; `hmac+oidc` garde la defense-in-depth HMAC.
- Le smoke direct renderer K1 a ete execute le 2026-06-07 sur Cloud Run et verifie localement; le smoke callable Firebase complet reste bloque tant qu'un token Auth/admin live valide n'est pas fourni.
- Toute nouvelle execution live reste interdite sans confirmation explicite.

## Variables publiques

App Hosting:

```yaml
NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION=europe-west9
NEXT_PUBLIC_VIBECUT_EXPORT_MODE=firebase
```

Client local/dev:

```bash
NEXT_PUBLIC_VIBECUT_EXPORT_MODE=localMock
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

## Secrets et variables serveur

Functions:

```bash
EXPORT_RENDERER_URL=https://<cloud-run-renderer-url>
EXPORT_RENDERER_AUTH_MODE=hmac
# hmac = signature applicative seule
# hmac+oidc = Cloud Run prive + signature applicative
# oidc = Cloud Run prive + verification renderer platform-iam
EXPORT_RENDER_ORCHESTRATION=sync
# ou taskQueue pour creer le job rapidement puis rendre via processVideoExportJob
firebase functions:secrets:set EXPORT_SIGNING_SECRET
```

Region backend:

- les callables utilisateur restent en `europe-west9`;
- `processVideoExportJob` est en `europe-west1`, car Cloud Tasks ne supporte pas `europe-west9`;
- `reconcileStaleAiReservations` est en `europe-west1`, car Cloud Scheduler ne supporte pas `europe-west9`;
- l'enqueue Cloud Tasks doit cibler `locations/europe-west1/functions/processVideoExportJob`;
- Artifact Registry `gcf-artifacts` en `europe-west1` garde une cleanup policy 7 jours.

Cloud Run renderer:

```bash
EXPORT_SIGNING_SECRET=<meme valeur Secret Manager>
EXPORT_RENDERER_VERIFY_MODE=hmac
# ou platform-iam seulement si Cloud Run est prive
EXPORT_RENDERER_PRIVATE_IAM_CONFIRMED=true
```

Admin backoffice:

```bash
ADMIN_EMAILS=admin@example.com
# ou custom claim admin=true
# ou document Firestore admins/{email} avec status="active"
```

Billing Export BigQuery pour le cout Google reel:

```bash
# Format compact
CLOUD_BILLING_EXPORT_TABLE=<PROJECT_ID>.<DATASET>.<TABLE_ID>

# ou format separe
CLOUD_BILLING_EXPORT_PROJECT_ID=<PROJECT_ID>
CLOUD_BILLING_EXPORT_DATASET=<DATASET>
CLOUD_BILLING_EXPORT_TABLE_ID=<TABLE_ID>

# optionnel: filtre explicite du projet facture a lire
CLOUD_BILLING_EXPORT_TARGET_PROJECT_ID=vibefx-v2
```

Sans ces variables, `getVideoExportAdminTelemetry` renvoie un statut `not_configured` et le backoffice affiche seulement l'estimation interne des jobs.

## Deploiement controle

Ne pas executer ces commandes sans confirmation explicite.

Verifier la cible:

```bash
set FIREBASE_PROJECT_ID=vibefx-v2
npm run check:deploy-target
```

Deploy rules + Functions via wrapper controle:

```bash
npm run firebase:deploy:backend
# ou seulement Functions
npm run firebase:deploy:functions
```

Si `EXPORT_RENDER_ORCHESTRATION=taskQueue` est active, deployer aussi la Function task queue `processVideoExportJob` exposee par `functions/index.js`. La callable `createVideoExportJob` cree alors le job Firestore et enqueue une tache Cloud Tasks; le worker relit le manifest Storage owner-scoped, appelle le renderer, respecte cancel/retry et ecrit la progression Firestore.

### Point de controle `/capabilities` — et pourquoi sa reponse est volontairement pauvre

Le renderer expose `GET /capabilities` (depuis le lot L6). Il interroge FFmpeg
**dans l'image qui tourne** et repond si les 15 cibles `xfade` du lot L1 sont
presentes. Lecture seule, aucun rendu, aucun cout de calcul.

```bash
VIBECUT_RENDERER_URL=https://vibecut-render-service-<hash>-od.a.run.app \
  node scripts/check-vibecut-renderer-image-capabilities.mjs
```

**⚠️ Subtilite a connaitre avant de modifier cet endpoint (decidee le 2026-08-01).**

`/capabilities` est **sans authentification**, et `vibecut-render-service` est un
service Cloud Run **public** (`allUsers` a `roles/run.invoker` ; seul `/render`
est protege, par signature HMAC). Sa reponse est donc lisible par n'importe qui
sur Internet.

Par consequent, la reponse ne contient **ni la version de FFmpeg, ni le texte des
erreurs** — seulement `ok`, la revision, les cibles manquantes et un *compteur*
d'erreurs. Une banniere « FFmpeg 6.0, compile avec … » renseignerait gratuitement
quelqu'un qui cherche les CVE applicables a ce build precis ; un `stderr` recopie
tel quel pourrait fuiter des chemins internes.

Le detail complet part dans les **journaux Cloud Run** :

```bash
gcloud run services logs read vibecut-render-service \
  --region europe-west9 --project vibefx-v2 --limit 50 | grep capabilities
```

Si le service passe un jour en Cloud Run **prive** (IAM), cette precaution devient
facultative — mais la retirer ne rapporterait rien. Le smoke
`smoke-vibecut-library-parity.mjs` echoue si la version reapparait dans la reponse.

Build Cloud Run renderer:

```bash
gcloud builds submit render-service --tag europe-west9-docker.pkg.dev/<PROJECT_ID>/vibecut/vibecut-render-service:$(git rev-parse --short HEAD)
```

Deploy Cloud Run renderer public signe HMAC:

```bash
gcloud run deploy vibecut-render-service \
  --image europe-west9-docker.pkg.dev/<PROJECT_ID>/vibecut/vibecut-render-service:$(git rev-parse --short HEAD) \
  --region europe-west9 \
  --cpu 2 \
  --memory 2Gi \
  --max-instances 2 \
  --set-secrets EXPORT_SIGNING_SECRET=EXPORT_SIGNING_SECRET:latest
```

Passage Cloud Run prive:

```bash
gcloud run services add-iam-policy-binding vibecut-render-service \
  --region europe-west9 \
  --member serviceAccount:<FUNCTIONS_SERVICE_ACCOUNT> \
  --role roles/run.invoker

gcloud run services update vibecut-render-service \
  --region europe-west9 \
  --no-allow-unauthenticated
```

Puis configurer Functions:

```bash
EXPORT_RENDERER_AUTH_MODE=hmac+oidc
```

Pour retirer HMAC cote application apres validation privee, configurer ensuite:

```bash
EXPORT_RENDERER_AUTH_MODE=oidc
EXPORT_RENDERER_VERIFY_MODE=platform-iam
EXPORT_RENDERER_PRIVATE_IAM_CONFIRMED=true
```

## Gates locaux

```bash
npm run test:vibecut-export
npm run test:backoffice-export-telemetry
npm --prefix functions run lint
node --check render-service/src/server.js
npm run lint
npm run build
git diff --check
```

`npm run test:emulators` est requis pour `Go release beta`, mais il demande Java disponible dans le PATH local.

## Smoke K1

Dry-run local sans Cloud:

```bash
npm run prepare:vibecut-k1-smoke
npm run prepare:vibecut-pro-fixtures
```

Plan attendu actuel:

- sources: `K1/MVI_0126.MP4` + `K1/MVI_0117.MP4`;
- sortie: MP4 H.264/AAC, 1080x1920, 30 FPS, environ 5.5s;
- features: deux clips, trim court, rotation gauche `270`, crossfade adjacent, texte fade, audio source;
- cout estime dry-run: environ `0.0010 EUR`.

Le smoke live ne doit etre lance qu'apres confirmation:

```text
OK pour smoke live Cloud Run K1
```

Avant toute execution live, armer le garde-fou local avec la confirmation exacte. Cette commande ne mute pas le Cloud et doit rester bloquee tant que les gates locaux, Java 21+ ou les variables live manquent:

```bash
set "VIBECUT_LIVE_CONFIRM=OK pour smoke live Cloud Run K1"
npm run guard:vibecut-k1-live
```

Ne pas définir `VIBECUT_EXECUTE_LIVE=1` sur ce garde-fou : il refuse volontairement l'execution live et sert seulement de sas avant une action humaine unique via le runbook.

Smoke live direct renderer, utile pour prouver Cloud Run sans dependre de Firebase Auth callable:

```bash
set "VIBECUT_LIVE_CONFIRM=OK pour smoke live Cloud Run K1"
set "VIBECUT_EXECUTE_LIVE=1"
set "EXPORT_RENDERER_URL=<cloud-run-url>"
set "EXPORT_SIGNING_SECRET=<secret Secret Manager localement seulement>"
npm run smoke:vibecut-k1-cloud-run-direct
```

Smoke live callable Firebase complet, a preferer pour valider le produit de bout en bout quand un token Auth live est disponible:

```bash
set "VIBECUT_LIVE_CONFIRM=OK pour smoke live Cloud Run K1"
set "VIBECUT_EXECUTE_LIVE=1"
set "VIBECUT_FIREBASE_ID_TOKEN=<id-token-utilisateur-admin-ou-test>"
npm run smoke:vibecut-k1-cloud-run-live
```

## Fixtures pro dry-run

`npm run prepare:vibecut-pro-fixtures` genere et valide les manifests suivants sans appel Cloud:

- `static-text`: exportable serveur;
- `advanced-text-animation`: bloque, car `neon-scan` n'est pas encore rendu serveur;
- `crossfade-transition`: exportable serveur;
- `color-filters`: exportable serveur;
- `external-audio`: exportable serveur;
- `combined-supported`: exportable serveur avec deux clips, transition, texte fade, colorimetrie et audio.

Ces fixtures ne remplacent pas les MP4 finaux exiges avant release beta. Elles figent seulement le contrat de couverture avant smoke live.

## Verification post-smoke live

- job Firestore `ready`;
- output Storage present;
- download desktop/PC fonctionne;
- fichier local lisible;
- duree environ 5.5s;
- resolution `1080x1920`;
- container MP4;
- codec video H.264;
- audio present si les sources contiennent audio;
- cout estime visible dans le panneau export et le backoffice;
- aucun warning de feature visible ignoree silencieusement.

Verifier le fichier MP4 telecharge avec le gate local post-smoke. Cette commande ne lance pas d'export et n'appelle pas le Cloud:

```bash
set "VIBECUT_CLOUD_OUTPUT_FILE=C:\chemin\vers\vibecut-k1-final.mp4"
npm run verify:vibecut-k1-cloud-output
```

Par defaut, le verificateur attend MP4-compatible, H.264, AAC, 1080x1920, 30 FPS, environ 5.5s, audio present et frames non noires. Les attentes peuvent etre ajustees seulement pour une fixture explicitement differente via `VIBECUT_EXPECT_WIDTH`, `VIBECUT_EXPECT_HEIGHT`, `VIBECUT_EXPECT_FPS`, `VIBECUT_EXPECT_DURATION`, `VIBECUT_EXPECT_VIDEO_CODEC`, `VIBECUT_EXPECT_AUDIO_CODEC` et `VIBECUT_EXPECT_AUDIO`.

## Rotation et hygiene

- Tourner `EXPORT_SIGNING_SECRET` apres tests manuels ou partage de logs.
- Ne jamais commiter `EXPORT_SIGNING_SECRET`, URLs signees Storage, tokens Meta/Firebase ou logs contenant headers.
- Nettoyer les outputs Storage de smoke si non utiles.
- Surveiller Artifact Registry et supprimer les images renderer obsoletes apres release.

## Limites encore no-go release beta

- Le smoke live direct renderer deux videos K1 a ete execute le 2026-06-07 et verifie, mais le smoke callable Firebase complet reste bloque par l'auth locale tant qu'un `VIBECUT_FIREBASE_ID_TOKEN` valide ou une configuration service account capable de signer un custom token n'est pas fourni.
- Les fixtures pro doivent encore produire des MP4 verifies. Le dry-run actuel confirme que texte statique, fade/crossfade, colorimetrie FFmpeg, audio externe et pile combinee sont exportables, mais l'animation texte avancee reste bloquee tant qu'un renderer frame-by-frame n'est pas implemente.
- L'orchestration reste callable synchrone pendant le rendu; un worker async/Cloud Tasks reste la cible production longue.
