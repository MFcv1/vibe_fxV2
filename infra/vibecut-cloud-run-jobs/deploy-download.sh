#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-}"
SERVICE_ACCOUNT="${2:-}"
APPLY_MODE="${3:-}"
REGION="${VIBECUT_RENDER_REGION:-europe-west1}"
REPOSITORY="${VIBECUT_ARTIFACT_REPOSITORY:-vibecut}"
IMAGE_TAG="${VIBECUT_IMAGE_TAG:-$(date -u +%Y%m%d-%H%M%S)}"

if [[ -z "${PROJECT_ID}" || -z "${SERVICE_ACCOUNT}" ]]; then
  echo "Usage: deploy-download.sh PROJECT_ID SERVICE_ACCOUNT [--apply]"
  exit 64
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/vibecut-download-service:${IMAGE_TAG}"

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
  --config render-service/cloudbuild.download.yaml \
  --substitutions "_IMAGE=${IMAGE}"

run gcloud run deploy vibecut-download-service \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 20 \
  --min-instances 0 \
  --max-instances 20 \
  --timeout 3600 \
  --allow-unauthenticated \
  --set-env-vars "VIBECUT_PROJECT_ID=${PROJECT_ID},VIBECUT_STORAGE_BUCKET=${PROJECT_ID}.firebasestorage.app" \
  --set-secrets "EXPORT_SIGNING_SECRET=EXPORT_SIGNING_SECRET:latest"

echo "Image: ${IMAGE}"
echo "Mode: $([[ "${APPLY_MODE}" == "--apply" ]] && echo applied || echo dry-run)"
