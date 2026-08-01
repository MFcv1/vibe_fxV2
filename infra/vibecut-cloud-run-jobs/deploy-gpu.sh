#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CLOUDSDK_PYTHON:-}" ]] && command -v python3.11 >/dev/null 2>&1; then
  export CLOUDSDK_PYTHON
  CLOUDSDK_PYTHON="$(command -v python3.11)"
fi

PROJECT_ID="${1:-}"
RENDER_SERVICE_ACCOUNT="${2:-}"
APPLY_MODE="${3:-}"
REGION="${VIBECUT_GPU_REGION:-europe-west1}"
REPOSITORY="${VIBECUT_ARTIFACT_REPOSITORY:-vibecut}"
IMAGE_TAG="${VIBECUT_IMAGE_TAG:-$(date -u +%Y%m%d-%H%M%S)}"

if [[ -z "${PROJECT_ID}" || -z "${RENDER_SERVICE_ACCOUNT}" ]]; then
  echo "Usage: deploy-gpu.sh PROJECT_ID RENDER_SERVICE_ACCOUNT [--apply]"
  exit 64
fi
if [[ "${APPLY_MODE}" == "--apply" && "${VIBECUT_ENABLE_GPU_DEPLOY:-false}" != "true" ]]; then
  echo "Refus: définir VIBECUT_ENABLE_GPU_DEPLOY=true après validation quota et benchmark."
  exit 65
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/vibecut-render-gpu:${IMAGE_TAG}"

run() {
  if [[ "${APPLY_MODE}" == "--apply" ]]; then
    "$@"
  else
    printf 'DRY-RUN'
    printf ' %q' "$@"
    printf '\n'
  fi
}

run gcloud builds submit render-service \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --config render-service/cloudbuild.gpu.yaml \
  --substitutions "_IMAGE=${IMAGE}"

run gcloud run jobs deploy vibecut-render-gpu-turbo \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --service-account "${RENDER_SERVICE_ACCOUNT}" \
  --cpu 8 \
  --memory 32Gi \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --no-gpu-zonal-redundancy \
  --tasks 1 \
  --parallelism 1 \
  --max-retries 0 \
  --task-timeout 1h \
  --set-env-vars "EXPORT_RENDERER_REGION=${REGION},VIBECUT_FFMPEG_ACCELERATOR=nvidia"

echo "Image GPU: ${IMAGE}"
echo "Le routeur reste bloque tant que EXPORT_GPU_ENABLED n'est pas true dans les Functions."
