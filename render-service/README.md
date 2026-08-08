# VibeCut Render Service

Cloud Run FFmpeg renderer for Vibe_CUT Export Pro.

Current scope:

- accepts signed `POST /render` requests from Firebase Functions;
- verifies `x-vibecut-timestamp` and `x-vibecut-signature` using `HMAC(timestamp.body)` with an anti-replay tolerance window by default;
- validates the MP4/H.264/AAC `ExportManifest` contract and rejects manifest features the renderer cannot faithfully encode yet;
- downloads clip/audio sources from Firebase Storage through `sourceStoragePath`;
- trims clips, applies cover/contain sizing, 90/180/270 degree rotations and supported FFmpeg color filters;
- renders **all 48 timed transitions of the catalogue**, resolved through `SERVER_XFADE_TRANSITION_MAP` (never hardcoded to `fade`), with a fallback to `fade` for any unknown id. Lot L1 delivered 15; lot B3a (2026-08-02) added 18 more, covering 29 distinct native `xfade` targets; lot B3b (2026-08-03) added the last 15, which have **no native `xfade` equivalent at all**;
- for those last 15, `buildTransitionSubgraph` emits a **sub-graph** rather than a single line: native filters ramped over the **tail of the outgoing clip** and the **head of the incoming one**, then a join. Twelve join with a native `xfade`; three rebuild the join by hand (`tpad` + conditional `overlay`) because they must *choose* between the two clips rather than blend them — strobe, the glitch hard cut, and the block reveal. The `xfade=transition=custom:expr=` route was **rejected after measurement**: 8.6 s for a 0.6 s transition in 1080p against 0.2 s native, a ~40x factor inherent to FFmpeg's expression evaluator, on a per-second-billed service;
- ⚠️ **do not use `sendcmd` to ramp a filter option here.** It broadcasts its commands to *every* filter in the graph bearing the target name, not to the one that follows it — on a two-cut edit, the command closing the first cut overwrote the second cut's ramp and **the second cut rendered a plain crossfade**. Naming the instance (`gblur@name`) is accepted but the command never arrives in the deployed FFmpeg 6.0 build. Ramps are therefore **chains of twelve constant-value filter instances**, each opened over one twelfth of the window by its own `enable` gate (`steppedChain`). Only a **three-clip** render exposes this; `scripts/smoke-vibecut-transition-chain-mp4.mjs` guards it;
- renders Ken Burns image motion with the SAME `smoothstep` curve, intensity factor and zoom-divided offset as the browser preview (lot L3);
- exposes `GET /capabilities`, which asks the running image's FFmpeg which `xfade` targets **and which filters** it actually supports (read-only, no render). The filter list is **derived from the sub-graphs the renderer really emits**, never hand-copied — since lot B3b the last 15 transitions are filter sub-graphs, so checking `xfade` targets alone would say nothing about them, and a build missing `displace` would pass the check and then fail every render. **This endpoint is unauthenticated on a public Cloud Run service, so its response deliberately carries no FFmpeg version banner and no raw error text** — only `ok`, the revision, the missing targets and an error *count*. A version banner would hand anyone the exact build to look up CVEs for. The full detail (version, failure messages) goes to the Cloud Run logs instead:

  ```bash
  gcloud run services logs read vibecut-render-service \
    --region europe-west9 --project vibefx-v2 --limit 50 | grep capabilities
  ```

- renders supported text overlays with `drawtext`, including static and fade animation modes;
- mixes source clip audio and external audio tracks, with timeline trims, delays and volume gain;
- encodes H.264/AAC MP4 with network-friendly fast start flags;
- uploads `output.mp4` to the requested Firebase Storage path.

Known limits:

- clip speed changes are rejected until time remapping is implemented in the FFmpeg graph;
- only ADJACENT transitions are rendered; non-adjacent transitions are rejected. Since lot L1 the timed transitions (wipes, slides, iris, bars, crops, squeezes) ARE rendered — 15 at L1, 33 since lot B3a. The 15 remaining preview-only catalog transitions are not: no native `xfade` target reproduces them;
- image motion easing is always `smoothstep`: a `linear` easing declared in the manifest is ignored, which is why the motion library shows that control disabled;
- text animations are limited to static and fade modes;
- only the supported color filter keys are mapped to FFmpeg; unknown filter keys are rejected;
- the service currently targets MP4/H.264/AAC output; ProRes, DNxHR, HEVC, AV1, MOV and WebM require explicit encoder adapters;
- progress is coarse because Firestore updates are owned by the calling Function, not by this service.
- cancellation is cooperative at the job layer but the renderer process does not yet expose a dedicated cancellation endpoint.

Required environment:

```bash
EXPORT_SIGNING_SECRET=shared-secret-with-functions
EXPORT_RENDERER_VERIFY_MODE=hmac
```

Optional Functions environment:

```bash
EXPORT_RENDERER_AUTH_MODE=oidc
```

`EXPORT_RENDERER_VERIFY_MODE=hmac` is the default and keeps the public signed endpoint mode. `EXPORT_RENDERER_AUTH_MODE=hmac+oidc` makes Firebase Functions attach a Google Cloud ID token for the renderer URL as audience while keeping the timestamped HMAC headers. Use this as the first private Cloud Run step after granting `roles/run.invoker` to the Functions service account.

For a private Cloud Run service where platform IAM is the only app-level gate, the renderer can be configured with:

```bash
EXPORT_RENDERER_VERIFY_MODE=platform-iam
EXPORT_RENDERER_PRIVATE_IAM_CONFIRMED=true
```

In that mode, Functions must use `EXPORT_RENDERER_AUTH_MODE=oidc`. Do not use `platform-iam` while Cloud Run allows unauthenticated invocation.

Local smoke:

```bash
docker build -t vibecut-render-service render-service
docker run --rm -e EXPORT_SIGNING_SECRET=dev-secret -p 8080:8080 vibecut-render-service
```

Next production steps:

1. Add time remapping for clip speed changes and expand transition adapters beyond fade/crossfade.
2. Parse FFmpeg stderr `time=...` and expose progress to Firestore through a trusted callback or queue worker.
3. Add cancellation, retry leases and renderer concurrency limits.
4. Add integration tests against Firebase emulators plus a local FFmpeg fixture.
5. Switch Cloud Run to authenticated/private invocation and set `EXPORT_RENDERER_AUTH_MODE=oidc` after granting `roles/run.invoker` to the Functions service account.
