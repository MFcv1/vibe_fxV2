# VibeCut Render Service

Cloud Run FFmpeg renderer for Vibe_CUT Export Pro.

Current scope:

- accepts signed `POST /render` requests from Firebase Functions;
- verifies `x-vibecut-timestamp` and `x-vibecut-signature` using `HMAC(timestamp.body)` with an anti-replay tolerance window by default;
- validates the MP4/H.264/AAC `ExportManifest` contract and rejects manifest features the renderer cannot faithfully encode yet;
- downloads clip/audio sources from Firebase Storage through `sourceStoragePath`;
- trims clips, applies cover/contain sizing, 90/180/270 degree rotations and supported FFmpeg color filters;
- renders the 15 timed transitions of lot L1 with `xfade`, resolved through `SERVER_XFADE_TRANSITION_MAP` (never hardcoded to `fade`), with a fallback to `fade` for any unknown id;
- renders Ken Burns image motion with the SAME `smoothstep` curve, intensity factor and zoom-divided offset as the browser preview (lot L3);
- exposes `GET /capabilities`, which asks the running image's FFmpeg which `xfade` targets it actually supports (read-only, no render). **This endpoint is unauthenticated on a public Cloud Run service, so its response deliberately carries no FFmpeg version banner and no raw error text** — only `ok`, the revision, the missing targets and an error *count*. A version banner would hand anyone the exact build to look up CVEs for. The full detail (version, failure messages) goes to the Cloud Run logs instead:

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
- only ADJACENT transitions are rendered; non-adjacent transitions are rejected. Since lot L1 the 15 timed transitions (including wipes, slides and iris) ARE rendered — the 27 preview-only engine transitions are not;
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
