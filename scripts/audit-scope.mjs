import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function blocked(...parts) {
  return new RegExp(parts.join(""), "i");
}

/*
 * PROBLEME A, corrige le 2026-08-01.
 *
 * Le garde interdisait le mot « jardin » tout court. Il attrapait donc un texte
 * immobilier parfaitement legitime de `themedTemplates.jsx` (« jardin » y decrit
 * un bien a vendre), et `npm run test:scope` echouait en permanence - au point
 * d'etre documente comme un echec « preexistant » a ignorer, ce qui est la pire
 * chose qui puisse arriver a un garde: on cesse de le lire.
 *
 * Ce qu'il faut interdire est le NOM COMPLET du projet source, pas un mot du
 * dictionnaire. Les separateurs sont tolerants (espace, tiret, souligne, ou
 * rien), donc toutes les graphies du nom source tombent, et le mot seul passe.
 *
 * Le nom n'est jamais ecrit d'un bloc dans ce fichier - pas meme en commentaire:
 * `blocked()` assemble ses morceaux precisement pour que le garde ne s'attrape
 * pas lui-meme en scannant `scripts/`.
 */
const forbiddenPatterns = [
  blocked("jar", "dins?", "[\\s_-]*", "de", "[\\s_-]*", "cha", "wi"),
  blocked("Cha", "wi"),
  blocked("paysa", "gisme"),
  blocked("Fl", "ers"),
  blocked("create", "Quote", "Request"),
  blocked("create", "Order"),
  blocked("STATIC", "_PRODUCTS"),
  blocked("quote", "_requests"),
  blocked("pick", "up", "_slots"),
];

const scannedFiles = [
  "src",
  "functions",
  "firestore.rules",
  "storage.rules",
  "docs",
  "scripts",
  "package.json",
  "map.md",
];

function listFiles(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [path];
  return readdirSync(absolute)
    .flatMap((entry) => listFiles(join(path, entry)))
    .filter((file) => !file.includes("node_modules") && !file.includes(".next"));
}

for (const file of scannedFiles.flatMap((path) => listFiles(path))) {
  const content = read(file);
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(content, pattern, `${file} should not contain ${pattern}`);
  }
}

const functionsIndex = read("functions/index.js");
const functionsAccount = read("functions/src/account.js");
const functionsBilling = read("functions/src/billing.js");
const functionsBillingEvents = read("functions/src/billingEvents.js");
const functionsBillingSession = read("functions/src/billingSession.js");
const functionsAppCheck = read("functions/src/appCheck.js");
const functionsAiJobs = read("functions/src/ai/jobs.js");
const functionsAiJobUtils = read("functions/src/ai/jobUtils.js");
const functionsAiReconciliation = read("functions/src/ai/reconciliation.js");
const functionsAiPolicies = read("functions/src/ai/policies.js");
const functionsAiRouter = read("functions/src/ai/router.js");
const functionsAiProviderRegistry = read("functions/src/ai/providerRegistry.js");
const functionsPackage = JSON.parse(read("functions/package.json"));
assert.equal(functionsPackage.type, "commonjs");
/*
 * Node 22. Le projet a migre (`.nvmrc`, `package.json` racine et
 * `functions/package.json` le declarent tous les trois); seule cette assertion
 * etait restee sur 20, ce qui faisait echouer `npm run test:scope` en
 * permanence. On l'aligne, et on verifie que les TROIS declarations concordent -
 * une seule d'entre elles qui deriverait ferait echouer le deploiement.
 */
assert.equal(functionsPackage.engines?.node, "22");
assert.equal(
  JSON.parse(read("package.json")).engines?.node,
  functionsPackage.engines?.node,
  "la version de Node doit etre la meme a la racine et dans functions/",
);
assert.equal(
  read(".nvmrc").trim(),
  functionsPackage.engines?.node,
  ".nvmrc doit declarer la meme version de Node que functions/package.json",
);
/*
 * Les SDK Firebase ont ete montes de major (functions 6 -> 7, admin 13 -> 14)
 * en meme temps que Node 22. Les assertions etaient restees sur les anciens
 * majors, deuxieme cause de l'echec permanent de `npm run test:scope`.
 *
 * On garde une assertion de MAJOR - le but est de detecter une montee de version
 * non voulue, pas de figer un correctif - et on l'aligne sur ce qui est
 * reellement installe.
 */
assert.match(functionsPackage.dependencies?.["firebase-functions"] || "", /^\^7\./);
assert.match(functionsPackage.dependencies?.["firebase-admin"] || "", /^\^14\./);
assert.match(functionsPackage.scripts?.lint || "", /src\/account\.js/);
assert.match(functionsPackage.scripts?.lint || "", /src\/appCheck\.js/);
assert.match(functionsPackage.scripts?.lint || "", /src\/ai\/reconciliation\.js/);

assert.doesNotMatch(functionsIndex, /matthis\.fradin/i);
assert.match(functionsIndex, /process\.env\.ADMIN_EMAILS/);
assert.match(functionsIndex, /shouldEnforceAppCheck\("ENFORCE_META_APP_CHECK"\)/);
assert.match(functionsAccount, /shouldEnforceAppCheck\("ENFORCE_ACCOUNT_APP_CHECK"\)/);
assert.match(functionsAccount, /requestAccountDeletion/);
assert.match(functionsAccount, /deleteAccountData/);
assert.match(functionsAccount, /assertRecentAuthentication/);
assert.match(functionsAccount, /RECENT_AUTH_MAX_AGE_MS/);
assert.match(functionsAccount, /deleteUser\(uid\)/);
assert.match(functionsAccount, /deleteFiles\(\{ prefix, force: true \}\)/);
assert.match(functionsAccount, /collection\("accountDeletionRequests"\)/);
assert.match(functionsAccount, /collection\("publications"\)\.where\("ownerUid", "==", uid\)/);
assert.match(functionsAccount, /collection\("aiJobs"\)\.where\("uid", "==", uid\)/);
assert.match(functionsAccount, /collection\("checkoutSessions"\)\.where\("uid", "==", uid\)/);
assert.match(functionsBilling, /shouldEnforceAppCheck\("ENFORCE_BILLING_APP_CHECK"\)/);
assert.match(functionsAiJobs, /shouldEnforceAppCheck\("ENFORCE_AI_APP_CHECK"\)/);
assert.match(functionsAppCheck, /FUNCTIONS_EMULATOR/);
assert.match(functionsAppCheck, /value === "false"/);
assert.match(functionsAppCheck, /return true/);
assert.match(functionsIndex, /reserveMetaOAuthState/);
assert.match(functionsIndex, /status: "processing"/);
assert.match(functionsIndex, /callbackStateRef/);
assert.match(functionsIndex, /status: "failed"/);
assert.match(functionsIndex, /isExpiredTimestamp/);
assert.match(functionsIndex, /status: "expired"/);
assert.match(functionsIndex, /Selectionne au moins une plateforme Meta/);
assert.match(functionsIndex, /Secrets META_APP_ID, META_APP_SECRET ou META_OAUTH_REDIRECT_URI manquants/);
assert.match(functionsIndex, /if \(ownerUid && data\.ownerUid !== ownerUid\)/);
assert.match(functionsIndex, /data\.metaSync\?\.status === "running" && lockUntil > now/);
assert.match(functionsIndex, /lockUntil: admin\.firestore\.Timestamp\.fromMillis\(now \+ 10 \* 60 \* 1000\)/);
assert.match(functionsIndex, /await releaseMetaLock\(ref, "failed"\)\.catch/);
assert.match(functionsIndex, /await releaseMetaLock\(ref, "done"\)/);

const publicMetaConnectionBody = /function publicMetaConnection\(data = \{\}\) \{([\s\S]*?)\n\}/.exec(functionsIndex)?.[1] || "";
assert.ok(publicMetaConnectionBody, "publicMetaConnection should exist");
assert.doesNotMatch(publicMetaConnectionBody, /encryptedPageAccessToken|accessToken|token:|secret/i);
assert.match(functionsIndex, /return publicMetaConnection\(snapshot\.data\(\)\)/);
assert.match(functionsIndex, /const token = decryptMetaToken\(connection\.encryptedPageAccessToken\)/);
assert.match(functionsIndex, /encryptedPageAccessToken: admin\.firestore\.FieldValue\.delete\(\)/);
assert.match(functionsBilling, /stripe\.webhooks\.constructEvent/);
assert.match(functionsBilling, /checkout\.sessions\.create/);
assert.match(functionsBilling, /idempotencyKey/);
assert.match(functionsBilling, /collection\("stripeEvents"\)/);
assert.match(functionsBilling, /collection\("payments"\)/);
assert.match(functionsBilling, /collection\("checkoutSessions"\)/);
assert.match(functionsBilling, /status: "fulfilled"/);
assert.doesNotMatch(functionsBilling, /allow_promotion_codes\s*:\s*true/);
assert.match(functionsBillingEvents, /checkout\.session\.async_payment_succeeded/);
assert.match(functionsBillingEvents, /checkout\.session\.async_payment_failed/);
assert.match(functionsBillingEvents, /checkout\.session\.expired/);
assert.match(functionsBillingSession, /metadata_credit_amount_mismatch/);
assert.match(functionsAiJobs, /collection\("aiJobs"\)/);
assert.match(functionsAiJobs, /collection\("aiRateLimits"\)/);
assert.match(functionsAiJobs, /collection\("securityEvents"\)/);
assert.match(functionsAiJobs, /requestIpHash/);
assert.match(functionsAiJobs, /ipHash/);
assert.match(functionsAiJobs, /creditLedger/);
assert.match(functionsAiJobs, /reservedCreditBalance/);
assert.match(functionsAiJobs, /createAiJob/);
assert.match(functionsAiJobs, /buildAiRouteAudit/);
assert.match(functionsAiJobs, /routeAudit/);
assert.match(functionsAiJobs, /routeScores/);
assert.match(functionsAiJobs, /rejectedCandidates/);
assert.match(functionsAiJobs, /estimatedGrossMargin/);
assert.match(functionsAiJobs, /margin_below_threshold/);
assert.match(functionsAiJobUtils, /normalizeIpHash/);
assert.match(functionsAiJobUtils, /rateLimitDocId/);
assert.match(functionsAiReconciliation, /onSchedule/);
assert.match(functionsAiReconciliation, /every 15 minutes/);
assert.match(functionsAiReconciliation, /releaseStaleAiReservation/);
assert.match(functionsAiReconciliation, /ai_reservation_stale_released/);
assert.match(functionsAiReconciliation, /reserved|running/);
assert.match(functionsAiPolicies, /aiPricingPolicies/);
assert.match(functionsAiPolicies, /calculatePricingPolicyEconomics/);
assert.match(functionsAiPolicies, /normalizeRouteCandidates/);
assert.match(functionsAiPolicies, /qualityScore/);
assert.match(functionsAiPolicies, /latencyScore/);
assert.match(functionsAiPolicies, /reliabilityScore/);
assert.match(functionsAiPolicies, /legalSafetyScore/);
assert.match(functionsAiPolicies, /estimatedProviderCostUsd/);
assert.match(functionsAiPolicies, /margin_below_threshold/);
assert.match(functionsAiPolicies, /minCreditsForTargetMargin/);
assert.match(functionsAiPolicies, /VIBEFX_ENABLE_MOCK_AI_GATEWAY/);
assert.match(functionsAiRouter, /ROUTER_WEIGHTS/);
assert.match(functionsAiRouter, /quality: 0\.35/);
assert.match(functionsAiRouter, /margin: 0\.25/);
assert.match(functionsAiRouter, /latency: 0\.15/);
assert.match(functionsAiRouter, /reliability: 0\.15/);
assert.match(functionsAiRouter, /legalSafety: 0\.10/);
assert.match(functionsAiRouter, /scoreRouteCandidate/);
assert.match(functionsAiRouter, /rejectedCandidates/);
assert.match(functionsAiProviderRegistry, /midjourney/);
assert.match(functionsAiProviderRegistry, /provider_not_allowed_in_production/);
assert.match(functionsAiProviderRegistry, /status: "blocked"/);
assert.match(functionsAiProviderRegistry, /civitai/);
assert.match(functionsAiProviderRegistry, /bytedance_seed/);
assert.match(functionsAiProviderRegistry, /openrouter/);
assert.doesNotMatch(functionsAiProviderRegistry, /productionAllowed: true/);

const exports = [...functionsIndex.matchAll(/exports\.([A-Za-z0-9_]+)\s*=/g)].map((match) => match[1]).sort();
assert.deepEqual(exports, [
  "cancelVideoExportJob",
  "createAiJob",
  "createCheckoutSession",
  "createMetaOAuthConnectUrl",
  "createVideoExportJob",
  "disconnectMetaOAuth",
  "getMetaOAuthStatus",
  "getVideoExportAdminTelemetry",
  "getVideoExportDownloadUrl",
  "metaOAuthCallback",
  "processVideoExportJob",
  "publishPublicationToConnectedMeta",
  "publishPublicationToMeta",
  "reconcileStaleAiReservations",
  "requestAccountDeletion",
  "retryVideoExportJob",
  "stripeWebhook",
].sort());

for (const path of [
  ".env.example",
  ".env.emulators.example",
  "functions/src/account.js",
  "functions/src/appCheck.js",
  "functions/src/billing.js",
  "functions/src/billingEvents.js",
  "functions/src/billingProducts.js",
  "functions/src/billingSession.js",
  "src/features/publications/components/PublicationComposer.jsx",
  "src/features/publications/components/PublicationDashboard.jsx",
  "src/features/publications/components/PublicationPreview.jsx",
  "functions/src/ai/jobs.js",
  "functions/src/ai/jobUtils.js",
  "functions/src/ai/mockProvider.js",
  "functions/src/ai/policies.js",
  "functions/src/ai/providerRegistry.js",
  "functions/src/ai/reconciliation.js",
  "functions/src/ai/router.js",
  "scripts/smoke-app-check.mjs",
  "scripts/smoke-account-deletion.mjs",
  "scripts/smoke-ai-gateway.mjs",
  "scripts/smoke-ai-ledger.mjs",
  "scripts/smoke-billing-ledger.mjs",
  "src/features/publications/components/MetaOAuthPanel.jsx",
  "src/features/publications/components/PublicationList.jsx",
  "src/features/publications/helpers/publicationHelpers.js",
  "scripts/smoke-studio-emulator-ui.mjs",
]) {
  assert.ok(existsSync(join(root, path)), `${path} should exist`);
}

const gitignore = read(".gitignore");
assert.match(gitignore, /!\.env\.example/);
assert.match(gitignore, /!\.env\.emulators\.example/);

const firestoreRules = read("firestore.rules");
assert.match(firestoreRules, /request\.resource\.data\.ownerUid == request\.auth\.uid/);
assert.match(firestoreRules, /request\.resource\.data\.ownerUid == resource\.data\.ownerUid/);
assert.match(firestoreRules, /isUserProfileCreateValid/);
assert.match(firestoreRules, /isUserProfileUpdateValid/);
assert.match(firestoreRules, /displayName/);
assert.doesNotMatch(firestoreRules, /allow read, create, update: if ownsUserDoc/);
assert.match(firestoreRules, /platformStatus/);
assert.match(firestoreRules, /metaSync/);
assert.match(firestoreRules, /affectedKeys\(\)\.hasAny/);
assert.match(firestoreRules, /accountDeletionRequests/);

const firebaseJson = JSON.parse(read("firebase.json"));
assert.equal(firebaseJson.hosting, undefined, "firebase.json should not configure classic Hosting for the App Hosting Next.js app");

const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.scripts["firebase:deploy"], undefined, "package.json should not expose a broad firebase deploy script");
assert.match(packageJson.scripts["test:studio-emulators"], /smoke-studio-emulator-ui\.mjs/);
assert.match(packageJson.scripts["test:account-deletion"], /smoke-account-deletion\.mjs/);
assert.match(packageJson.scripts["test:app-check"], /smoke-app-check\.mjs/);
assert.match(packageJson.scripts["test:ai-gateway"], /smoke-ai-gateway\.mjs/);
assert.match(packageJson.scripts["test:ai-ledger"], /smoke-ai-ledger\.mjs/);
assert.match(packageJson.scripts["test:billing-ledger"], /smoke-billing-ledger\.mjs/);
assert.match(packageJson.scripts["verify:local"], /test:billing-ledger/);
assert.match(packageJson.scripts["verify:local"], /test:account-deletion/);
assert.match(packageJson.scripts["verify:local"], /test:app-check/);
assert.match(packageJson.scripts["firebase:deploy:backend"], /firebase-deploy\.mjs backend/);
assert.match(packageJson.scripts["firebase:deploy:functions"], /firebase-deploy\.mjs functions/);
assert.match(packageJson.scripts["check:deploy-target"], /check-deploy-target\.mjs/);

const firebaseDeployScript = read("scripts/firebase-deploy.mjs");
assert.match(firebaseDeployScript, /backend: "firestore,storage,functions"/);
assert.match(firebaseDeployScript, /functions: "functions"/);
assert.match(firebaseDeployScript, /scripts\/check-deploy-target\.mjs/);
assert.match(firebaseDeployScript, /"--project"/);
assert.match(firebaseDeployScript, /"--only"/);

const deployTargetCheck = read("scripts/check-deploy-target.mjs");
assert.match(deployTargetCheck, /FIREBASE_PROJECT_ID/);
assert.match(deployTargetCheck, /\^demo-/);
assert.match(deployTargetCheck, /Refusing deploy target/);

const e2eReadinessCheck = read("scripts/check-e2e-readiness.mjs");
assert.match(e2eReadinessCheck, /ENFORCE_ACCOUNT_APP_CHECK/);

const accountClient = read("src/app/account/AccountClient.jsx");
assert.match(accountClient, /reauthenticateBeforeDeletion/);
assert.match(accountClient, /reauthenticateWithPopup/);
assert.match(accountClient, /reauthenticateWithCredential/);
assert.match(accountClient, /requestAccountDeletion/);

const storageRules = read("storage.rules");
assert.match(storageRules, /match \/users\/\{userId\}\/publications/);
assert.match(storageRules, /allow get: if true/);
assert.match(storageRules, /allow list: if false/);
assert.match(storageRules, /allow create, update: if ownsPath\(userId\)/);
assert.match(storageRules, /match \/publications\/\{allPaths=\*\*\}/);
assert.match(storageRules, /allow create, update, delete: if false/);

const emulatorSmoke = read("scripts/smoke-firebase-emulators.mjs");
assert.match(emulatorSmoke, /signInAnonymously/);
assert.doesNotMatch(emulatorSmoke, /createUserWithEmailAndPassword/);

const publicationsManager = read("src/features/publications/PublicationsManager.jsx");
assert.match(publicationsManager, /onAuthStateChanged/);
assert.match(publicationsManager, /signInAnonymously/);
assert.match(publicationsManager, /where\("ownerUid", "==", currentUid\)/);
assert.match(publicationsManager, /handleSavedPublication/);
assert.match(publicationsManager, /setPublications\(\(current\) =>/);

const rootLayout = read("src/app/layout.js");
assert.doesNotMatch(rootLayout, /features\/(?:vibefx-layout|publications)/);

const studioLayout = read("src/app/studio/layout.js");
assert.match(studioLayout, /features\/vibefx-layout\/vibefx-tailwind\.css/);
assert.match(studioLayout, /features\/vibefx-layout\/vibefx-layout\.css/);
assert.match(studioLayout, /features\/publications\/publications\.css/);

// --- VibeCut v2 (route /video): surface isolee ---
const vibeCutLayout = read("src/app/video/layout.js");
assert.match(vibeCutLayout, /features\/vibecut\/styles\/vibecut\.css/);
assert.match(vibeCutLayout, /StudioAuthGate/);
assert.match(vibeCutLayout, /index: false/);
// La feuille Tailwind statique de /studio ne doit jamais etre chargee sur /video.
assert.doesNotMatch(vibeCutLayout, /vibefx-tailwind|vibefx-layout|publications\.css/);

const vibeCutFiles = listFiles("src/features/vibecut");
for (const file of vibeCutFiles) {
  const source = read(file);
  // Le nouveau front ne consomme que des modeles/moteurs/services, jamais l'ancienne UI.
  assert.doesNotMatch(
    source,
    /vibefx-studio\/(?:VideoApp|VibeFxStudio|video\/(?:VideoEditor|panels|timeline|preview|vibecut-premium))/,
    `${file} importe l'ancienne interface VibeCut`
  );
  /*
   * PHASE 7 (2026-08-01): ces modules n'existent plus. L'assertion ci-dessus
   * devient donc un garde contre leur REAPPARITION, et celle ci-dessous verifie
   * qu'ils sont bien partis - sans quoi on pourrait croire le nettoyage fait
   * alors qu'un fichier serait resté sur le disque.
   */
  // Styles strictement scopes: pas de classes utilitaires Tailwind dans le nouveau front.
  assert.doesNotMatch(
    source,
    /className="[^"]*\b(?:flex-1|text-\[\d+px\]|bg-neutral-\d{3}|border-neutral-\d{3})\b/,
    `${file} utilise des classes Tailwind, or /video ne charge pas Tailwind`
  );
}

// Phase 4: le montage avance est reel, plus un ecran d'attente.
const advancedRoute = read("src/app/video/avance/page.js");
assert.match(advancedRoute, /features\/vibecut\/advanced\/AdvancedEditor/);
assert.doesNotMatch(advancedRoute, /PhasePlaceholder/, "le montage avance ne doit plus etre un placeholder");

// Phase 4: UN SEUL moteur d'apercu, hisse dans le shell (constat n° 8 du plan).
const previewStage = read("src/features/vibecut/preview/PreviewStage.jsx");
assert.doesNotMatch(previewStage, /new PlaybackEngine/, "PreviewStage ne doit plus creer de moteur");
assert.match(previewStage, /usePreviewStageMount/);
const previewHost = read("src/features/vibecut/preview/PreviewEngineHost.jsx");
assert.match(previewHost, /new PlaybackEngine/);
const vibeCutShell = read("src/features/vibecut/shell/VibeCutShell.jsx");
assert.match(vibeCutShell, /PreviewEngineProvider/);

// Phase 4: la timeline multipiste se construit sur le modele canonique.
const timelineAdapter = read("src/features/vibecut/adapters/useTimeline.js");
assert.match(timelineAdapter, /buildTimelineModel/);

/*
 * Timeline V2. Le repliement sept pistes -> quatre rangees est une projection
 * d'AFFICHAGE: le modele canonique reste le contrat d'export, et l'ancien front
 * s'en sert jusqu'a la phase 7.
 */
assert.match(timelineAdapter, /buildDisplayLanes/, "la projection d'affichage doit exister");
assert.match(
  timelineAdapter,
  /MAX_TRANSITION_SHARE/,
  "le plafond d'une transition doit reutiliser la constante des presets guides, pas une copie",
);
const timelineView = read("src/features/vibecut/advanced/TimelineView.jsx");
assert.match(timelineView, /displayLanes/, "la timeline doit rendre les rangees d'affichage");
assert.doesNotMatch(
  timelineView,
  /TRACK_LABELS\[/,
  "les sept libelles de pistes n'ont plus a etre rendus tels quels",
);
assert.match(timelineAdapter, /buildTimelineSnapPoints/);
assert.match(packageJson.scripts["test:vibecut-ui-v2"], /smoke-vibecut-advanced-v2\.spec\.cjs/);

/* ---------- Phase 7: l'ancien front video n'existe plus ---------- */

/*
 * La bascule est faite: `/studio?workspace=video` redirige, et l'ancien editeur
 * est supprime. On verifie les DEUX, parce que l'un sans l'autre laisserait soit
 * un lien mort, soit du code mort.
 */
const studioRoute = read("src/app/studio/page.js");
assert.match(
  studioRoute,
  /redirect\("\/video"\)/,
  "/studio?workspace=video doit rediriger vers /video (phase 7)",
);
assert.doesNotMatch(
  studioRoute,
  /"video"\s*,?\s*\]\)/,
  "'video' ne doit plus faire partie des workspaces du studio",
);

for (const gone of [
  "src/features/vibefx-studio/VideoApp.jsx",
  "src/features/vibefx-studio/video/VideoEditor.jsx",
  "src/features/vibefx-studio/video/vibecut-premium.css",
  "src/features/vibefx-studio/video/panels",
  "src/features/vibefx-studio/video/timeline",
  "src/features/vibefx-studio/video/preview",
  "scripts/smoke-video-ui.spec.cjs",
]) {
  assert.equal(
    existsSync(join(root, gone)),
    false,
    `${gone} devait etre supprime en phase 7`,
  );
}

/*
 * BOUTONS MORTS LAISSES PAR LA SUPPRESSION - trouves A L'USAGE, pas par les tests.
 *
 * Supprimer un ecran ne suffit pas: il faut aussi supprimer, ou rebrancher, tout
 * ce qui y menait. Deux defauts sont passes entre les mailles de la premiere
 * passe de la phase 7:
 *   1. l'onglet VIBECUT de l'en-tete appelait encore `setView('video')`, un etat
 *      que plus rien ne rendait: le clic ne faisait RIEN;
 *   2. le lien Backoffice etait conditionne a `view === 'video'`, devenu
 *      impossible: un admin n'avait plus aucune entree vers le backoffice.
 *
 * Ces deux assertions existent pour que la regression ne revienne pas.
 */
const studioHeader = read("src/features/vibefx-studio/components/Header.jsx");
assert.match(
  studioHeader,
  /label: 'VibeCut', href: '\/video'/,
  "l'onglet VibeCut de l'en-tete studio doit etre un LIEN vers /video, pas un setView",
);
/*
 * On cherche une CONDITION DE RENDU, pas une mention: le fichier explique en
 * commentaire pourquoi cette condition a disparu, et un garde qui interdirait
 * d'en parler interdirait surtout de le documenter (meme piege que le garde
 * `requestAnimationFrame` de la phase 5).
 */
assert.doesNotMatch(
  studioHeader,
  /\{\s*view === 'video'/,
  "plus rien dans l'en-tete studio ne doit dependre d'une vue 'video' qui n'existe plus",
);

const studioShell = read("src/features/vibefx-studio/VibeFxStudio.jsx");
assert.doesNotMatch(studioShell, /VideoApp/, "le shell studio ne doit plus monter l'ancien editeur video");
assert.match(
  studioShell,
  /router\.push\('\/video\/rapide'\)/,
  "le passage bande-son -> video doit naviguer vers le nouveau front",
);

/*
 * Ce que le panneau supprime portait et que le nouveau front doit conserver:
 * destination PC, nom de fichier horodate, regeneration d'URL signee. Deplace
 * dans la couche export plutot que perdu.
 */
const exportDownload = read("src/features/vibefx-studio/video/export/exportDownload.js");
for (const symbol of [
  "showDirectoryPicker",
  "vibecut-export-destination-v1",
  "buildExportFileName",
  "resolveExportOutputDownloadUrl",
]) {
  assert.match(exportDownload, new RegExp(symbol), `${symbol} perdu avec l'ancien panneau d'export`);
}

/* ---------- Phase 5: les bibliotheques sont reelles ---------- */

for (const [route, component] of [
  ["src/app/video/transitions/page.js", "library/TransitionLibrary"],
  ["src/app/video/mouvements/page.js", "library/MotionLibrary"],
]) {
  const source = read(route);
  assert.match(source, new RegExp(component.replace("/", "\\/")));
  assert.doesNotMatch(
    source,
    /PhasePlaceholder/,
    `${route} ne doit plus etre un ecran d'attente: la phase 5 est livree`,
  );
}

/*
 * Les apercus des bibliotheques sont dessines par LE MOTEUR, jamais imites en
 * CSS. C'est ce qui interdit a une carte de deriver du rendu qu'elle annonce:
 * une imitation, elle, ne serait couverte par aucun test de parite.
 */
const transitionPreview = read("src/features/vibecut/library/TransitionPreview.jsx");
assert.match(
  transitionPreview,
  /import \{ renderTransition \} from '@\/features\/vibefx-studio\/video\/engine\/VideoEngine'/,
  "l'apercu de transition doit appeler le moteur, pas imiter la transition en CSS",
);
const motionPreview = read("src/features/vibecut/library/MotionPreview.jsx");
assert.match(
  motionPreview,
  /applyImageMotionTransform/,
  "l'apercu de mouvement doit appeler la transformation de production (mediaModel)",
);

/*
 * Une seule horloge pour toutes les vignettes: une `requestAnimationFrame` par
 * carte donnerait quarante boucles concurrentes sur un ecran de catalogue.
 */
for (const file of [
  "src/features/vibecut/library/TransitionPreview.jsx",
  "src/features/vibecut/library/MotionPreview.jsx",
]) {
  assert.match(read(file), /subscribeToPreviewTicker/, `${file} doit passer par l'horloge partagee`);
  /*
   * On cherche un APPEL, pas une mention: les deux fichiers expliquent en
   * commentaire pourquoi ils n'ouvrent pas leur propre boucle, et un garde qui
   * interdirait d'en parler interdirait surtout de le documenter.
   */
  assert.doesNotMatch(
    read(file),
    /requestAnimationFrame\s*\(/,
    `${file} ne doit pas ouvrir sa propre boucle d'animation`,
  );
}

/* Chemin d'ecriture unique: les bibliotheques n'atteignent jamais le store. */
for (const file of [
  "src/features/vibecut/library/TransitionLibrary.jsx",
  "src/features/vibecut/library/MotionLibrary.jsx",
]) {
  const source = read(file);
  assert.doesNotMatch(
    source,
    /video\/store\/videoStore/,
    `${file} doit passer par les adaptateurs, jamais par le store`,
  );
  assert.doesNotMatch(
    source,
    /video\/panels\//,
    `${file} ne doit importer aucun panneau de l'ancien front`,
  );
}

assert.match(packageJson.scripts["test:vibecut-ui-v2"], /smoke-vibecut-library-parity\.mjs/);
assert.match(packageJson.scripts["test:vibecut-ui-v2"], /smoke-vibecut-library-v2\.spec\.cjs/);

/* ---------- Lots L4 et L5 ---------- */

/*
 * L4: les cartes de preset sont baties sur les miniatures reelles, avec un repli
 * qui ne doit PAS disparaitre - l'extraction est asynchrone.
 */
const stepStyle = read("src/features/vibecut/guided/StepStyle.jsx");
assert.match(stepStyle, /PresetFilmstrip/, "l'etape 2 doit monter la pellicule du lot L4");
const filmstrip = read("src/features/vibecut/library/../guided/PresetFilmstrip.jsx");
assert.match(filmstrip, /StylePreview/, "le repli sur la vignette SVG doit rester");
assert.match(filmstrip, /data-source="thumbnails"/);

/*
 * L5: `titleStyle` et `audioProfile` etaient portes par le modele sans etre
 * appliques (probleme H). Les resolveurs vivent dans le module PUR, et le
 * parcours guide les appelle vraiment.
 */
const styleRecipes = read("src/features/vibecut/data/styleRecipes.js");
assert.doesNotMatch(
  styleRecipes,
  /^\s*import\s/m,
  "styleRecipes.js doit rester sans import",
);
for (const symbol of [
  "resolveTitleOverlayStyle",
  "applyTitleCasing",
  "resolveAudioProfile",
  "buildBeatStrip",
]) {
  assert.match(styleRecipes, new RegExp(`export function ${symbol}`), `${symbol} manquant (lot L5)`);
}
const guidedFlow = read("src/features/vibecut/guided/GuidedFlow.jsx");
for (const symbol of ["resolveTitleOverlayStyle", "applyTitleCasing", "resolveAudioProfile"]) {
  assert.match(guidedFlow, new RegExp(symbol), `le parcours guide doit appliquer ${symbol}`);
}
const stepRhythm = read("src/features/vibecut/guided/StepRhythm.jsx");
assert.match(stepRhythm, /BeatStrip/, "l'etape 3 doit montrer la partition (lot L5)");

const vibeFxLayout = read("src/features/vibefx-layout/VibeFxLayout.jsx");
assert.doesNotMatch(vibeFxLayout, new RegExp(">J" + "C<"));
assert.match(vibeFxLayout, />VF</);
assert.match(vibeFxLayout, /const buildSocialImages = async/);
assert.match(vibeFxLayout, /const payload = \{/);
assert.match(vibeFxLayout, /blob,/);
assert.match(vibeFxLayout, /socialImages,/);
assert.match(vibeFxLayout, /format: activeFormat/);
assert.match(vibeFxLayout, /template: activeTemplate/);
assert.match(vibeFxLayout, /settings: \{/);
assert.match(vibeFxLayout, /onImportToPublication\(payload\)/);

console.log("scope audit OK");
