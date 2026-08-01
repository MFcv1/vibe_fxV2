import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const serverPath = path.join(process.cwd(), "render-service", "src", "server.js");
const readmePath = path.join(process.cwd(), "render-service", "README.md");
const source = await readFile(serverPath, "utf8");
const readme = await readFile(readmePath, "utf8");

assert.match(source, /function validateRendererCoverage/, "render service must validate renderer feature coverage");
assert.match(source, /export function validateManifest/, "render service must export validateManifest for local canonical smokes");
assert.match(source, /export function buildFfmpegArgs/, "render service must export buildFfmpegArgs for local canonical smokes");
assert.match(source, /isMainModule/, "render service must not start the HTTP server when imported by local smokes");
assert.match(source, /await import\('@google-cloud\/storage'\)/, "render service must lazy-load Cloud Storage so local FFmpeg smokes do not require cloud deps");
assert.match(source, /function verifyRendererRequest/, "render service must centralize renderer request verification");
assert.match(source, /EXPORT_RENDERER_VERIFY_MODE/, "render service must expose an explicit verification mode");
assert.match(source, /EXPORT_RENDERER_PRIVATE_IAM_CONFIRMED/, "render service must require an explicit private IAM confirmation before skipping HMAC");
assert.match(source, /x-vibecut-timestamp/, "render service must support timestamped renderer signatures");
assert.match(source, /SIGNATURE_TOLERANCE_MS/, "render service must enforce an anti-replay signature window");
assert.match(source, /\$\{timestamp\}\.\$\{rawBody\}/, "render service must bind HMAC signatures to timestamp and body");
assert.match(source, /verifyMode === 'hmac'[\s\S]*verifySignature/, "render service must verify HMAC by default");
assert.match(source, /verifyMode === 'platform-iam'[\s\S]*EXPORT_RENDERER_PRIVATE_IAM_CONFIRMED/, "render service must allow platform IAM mode only after explicit confirmation");
assert.match(source, /xfade=transition=\$\{xfadeName\}/, "render service must render the requested transition type with FFmpeg xfade, not a hard-coded fade");
assert.match(source, /SERVER_XFADE_TRANSITION_MAP/, "render service must map VibeCut transition ids to native xfade transitions");
assert.match(source, /resolveXfadeTransitionName/, "render service must fall back to fade for unknown transition ids");
assert.match(source, /findAdjacentTransition/, "render service must bind xfade transitions to adjacent clip ids");
assert.match(source, /Non-adjacent transition not rendered/, "render service must reject non-adjacent transition items");
assert.match(source, /drawtext/, "render service must render supported text overlays with FFmpeg drawtext");
assert.match(source, /buildDrawTextFilter/, "render service must build deterministic text overlay filters");
assert.match(source, /Text animation is not rendered/, "render service must reject unsupported text animations");
assert.match(source, /buildColorFilterChain/, "render service must build deterministic color filter chains");
assert.match(source, /eq=brightness=/, "render service must map exposure/brightness/contrast/saturation to FFmpeg eq");
assert.match(source, /colorbalance=/, "render service must map temperature/tint/ranges to FFmpeg colorbalance");
assert.match(source, /vignette=angle=/, "render service must map vignette to FFmpeg vignette");
assert.match(source, /noise=alls=/, "render service must map grain to FFmpeg noise");
assert.match(source, /atrim=start=/, "render service must trim external audio tracks");
assert.match(source, /adelay=.*:all=1/, "render service must place external audio tracks on the timeline");
assert.match(source, /amix=inputs=/, "render service must mix multiple external audio tracks");
assert.match(source, /Color filter is not supported/, "render service must reject unsupported color filter keys");
assert.match(source, /\[aclip\$\{index\}\]/, "render service must create source clip audio labels");
assert.match(source, /Clip source audio requested but no audio stream was detected/, "render service must warn when a source clip has no audio stream");
assert.equal(
  /Source clip audio is not mixed[\s\S]*errors\.push/.test(source),
  false,
  "render service must not reject source clip audio after FFmpeg mix support",
);
assert.equal(
  /External audio tracks are not mixed faithfully[\s\S]*errors\.push/.test(source),
  false,
  "render service must not reject external audio tracks after FFmpeg mix support",
);
assert.equal(
  /Text overlays and text animations are not rendered[\s\S]*errors\.push/.test(source),
  false,
  "render service must not reject every text overlay after drawtext support",
);
assert.equal(
  /Color filters are not rendered[\s\S]*errors\.push/.test(source),
  false,
  "render service must not reject known color filters after FFmpeg color support",
);
assert.equal(
  /Text overlays are declared but not rendered[\s\S]*warnings\.push/.test(source),
  false,
  "render service must not downgrade missing text rendering to a warning",
);
assert.equal(
  /Transitions are declared but not rendered[\s\S]*warnings\.push/.test(source),
  false,
  "render service must not downgrade missing transition rendering to a warning",
);

assert.match(readme, /HMAC\(timestamp\.body\)/, "render service README must document timestamp-bound request signing");
assert.match(readme, /EXPORT_RENDERER_VERIFY_MODE=hmac/, "render service README must document default HMAC verification");
assert.match(readme, /EXPORT_RENDERER_VERIFY_MODE=platform-iam/, "render service README must document private platform IAM verification");
assert.match(readme, /anti-replay/, "render service README must document the signature anti-replay window");
/*
 * Cette assertion figeait « adjacent fade/crossfade transitions », la description
 * d'AVANT le lot L1 (2026-07-30) - le renderer rend desormais les 15 transitions
 * minutees, pas seulement le fondu. Elle verifie donc maintenant les deux faits
 * qui font vraiment le contrat:
 *   1. l'ADJACENCE reste la contrainte (une transition non adjacente est rejetee);
 *   2. les 15 transitions du lot L1 sont bien annoncees comme rendues.
 */
assert.match(readme, /ADJACENT transitions are rendered/, "render service README must document the adjacency constraint");
assert.match(readme, /15 timed transitions/, "render service README must document the 15 timed transitions delivered by lot L1");

/*
 * Le point de controle du lot L6 et la raison pour laquelle sa reponse ne porte
 * pas la version de FFmpeg (endpoint sans authentification sur un service Cloud
 * Run public). Voir todo.md probleme J.
 */
assert.match(readme, /GET `?\/capabilities`?/, "render service README must document the /capabilities checkpoint");
assert.match(
  readme,
  /no FFmpeg version banner/,
  "render service README must explain why /capabilities hides the FFmpeg version",
);
assert.match(readme, /drawtext/, "render service README must document supported text overlay rendering");
assert.match(readme, /mixes source clip audio and external audio tracks/, "render service README must document audio mix support");
assert.equal(
  /transitions are stored in the manifest but not rendered yet/i.test(readme),
  false,
  "render service README must not claim transitions are entirely unrendered",
);
assert.equal(
  /text overlays are stored in the manifest but not rendered yet/i.test(readme),
  false,
  "render service README must not claim text overlays are entirely unrendered",
);
assert.equal(
  /rotation and detailed audio mixing still need full FFmpeg filter mapping/i.test(readme),
  false,
  "render service README must not claim rotation and audio mixing are unimplemented",
);

console.log("smoke-vibecut-render-service-contract: ok");
