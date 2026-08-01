#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CLOUDSDK_PYTHON:-}" ]] && command -v python3.11 >/dev/null 2>&1; then
  export CLOUDSDK_PYTHON
  CLOUDSDK_PYTHON="$(command -v python3.11)"
fi

PROJECT_ID="${1:-}"
RENDER_SERVICE_ACCOUNT="${2:-}"
APPLY_MODE="${3:-}"
REGION="${VIBECUT_RENDER_REGION:-europe-west1}"
REPOSITORY="${VIBECUT_ARTIFACT_REPOSITORY:-vibecut}"
IMAGE_TAG="${VIBECUT_IMAGE_TAG:-$(date -u +%Y%m%d-%H%M%S)}"

if [[ -z "${PROJECT_ID}" || -z "${RENDER_SERVICE_ACCOUNT}" ]]; then
  echo "Usage: deploy.sh PROJECT_ID RENDER_SERVICE_ACCOUNT [--apply]"
  exit 64
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/vibecut-render-job:${IMAGE_TAG}"

run() {
  if [[ "${APPLY_MODE}" == "--apply" ]]; then
    "$@"
  else
    printf 'DRY-RUN'
    printf ' %q' "$@"
    printf '\n'
  fi
}

run gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project "${PROJECT_ID}"

if [[ "${APPLY_MODE}" == "--apply" ]]; then
  gcloud artifacts repositories describe "${REPOSITORY}" \
    --location "${REGION}" \
    --project "${PROJECT_ID}" >/dev/null 2>&1 ||
    gcloud artifacts repositories create "${REPOSITORY}" \
      --repository-format docker \
      --location "${REGION}" \
      --project "${PROJECT_ID}"
else
  echo "DRY-RUN create Artifact Registry repository ${REPOSITORY} only if absent"
fi

run gcloud builds submit render-service \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --config render-service/cloudbuild.job.yaml \
  --substitutions "_IMAGE=${IMAGE}"

run gcloud run jobs deploy vibecut-render-cpu-standard \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --service-account "${RENDER_SERVICE_ACCOUNT}" \
  --cpu 4 \
  --memory 8Gi \
  --tasks 1 \
  --parallelism 1 \
  --max-retries 0 \
  --task-timeout 2h \
  --set-env-vars "EXPORT_RENDERER_REGION=${REGION}"

run gcloud run jobs deploy vibecut-render-cpu-pro60 \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --service-account "${RENDER_SERVICE_ACCOUNT}" \
  --cpu 8 \
  --memory 16Gi \
  --tasks 1 \
  --parallelism 1 \
  --max-retries 0 \
  --task-timeout 2h \
  --set-env-vars "EXPORT_RENDERER_REGION=${REGION}"

echo "Image: ${IMAGE}"
echo "Mode: $([[ "${APPLY_MODE}" == "--apply" ]] && echo applied || echo dry-run)"
