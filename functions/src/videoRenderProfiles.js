"use strict";

const RENDER_PROFILES = Object.freeze({
  "cpu-standard": Object.freeze({
    id: "cpu-standard",
    jobName: "vibecut-render-cpu-standard",
    vcpu: 4,
    memoryGib: 8,
    accelerator: null,
    maxDurationSeconds: 15 * 60,
  }),
  "cpu-pro60": Object.freeze({
    id: "cpu-pro60",
    jobName: "vibecut-render-cpu-pro60",
    vcpu: 8,
    memoryGib: 16,
    accelerator: null,
    maxDurationSeconds: 15 * 60,
  }),
  "gpu-turbo": Object.freeze({
    id: "gpu-turbo",
    jobName: "vibecut-render-gpu-turbo",
    vcpu: 8,
    memoryGib: 32,
    accelerator: "nvidia-l4",
    maxDurationSeconds: 15 * 60,
  }),
});

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function selectRenderProfile(manifest = {}, options = {}) {
  const render = manifest.render || {};
  const duration = finiteNumber(manifest.project?.duration, 0);
  const fps = finiteNumber(render.fps, 30);
  const width = finiteNumber(render.width, 1920);
  const height = finiteNumber(render.height, 1080);
  const clips = Array.isArray(manifest.clips) ? manifest.clips : [];
  const audioTracks = Array.isArray(manifest.audioTracks) ? manifest.audioTracks : [];
  const layerPressure = clips.length + audioTracks.length * 2;
  const gpuEnabled = options.gpuEnabled === true;
  const explicitProfile = String(options.explicitProfile || "").trim();

  if (explicitProfile && RENDER_PROFILES[explicitProfile]) {
    if (explicitProfile !== "gpu-turbo" || gpuEnabled) {
      return RENDER_PROFILES[explicitProfile];
    }
  }

  const wantsGpu = gpuEnabled && (
    render.acceleration === "gpu" ||
    (fps >= 60 && duration >= 8 * 60 && width * height >= 1920 * 1080)
  );
  if (wantsGpu) return RENDER_PROFILES["gpu-turbo"];

  const wantsPro60 = (
    fps >= 50 ||
    duration > 5 * 60 ||
    width * height > 1920 * 1080 ||
    layerPressure > 40
  );
  return wantsPro60
    ? RENDER_PROFILES["cpu-pro60"]
    : RENDER_PROFILES["cpu-standard"];
}

module.exports = {
  RENDER_PROFILES,
  selectRenderProfile,
};
