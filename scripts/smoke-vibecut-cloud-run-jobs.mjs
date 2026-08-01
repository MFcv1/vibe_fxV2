import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { RENDER_PROFILES, selectRenderProfile } = require('../functions/src/videoRenderProfiles.js');
const functionSource = fs.readFileSync(new URL('../functions/src/videoExport.js', import.meta.url), 'utf8');
const workerSource = fs.readFileSync(new URL('../render-service/src/job.js', import.meta.url), 'utf8');
const deploySource = fs.readFileSync(new URL('../infra/vibecut-cloud-run-jobs/deploy.sh', import.meta.url), 'utf8');
const downloadDeploySource = fs.readFileSync(new URL('../infra/vibecut-cloud-run-jobs/deploy-download.sh', import.meta.url), 'utf8');
const downloadSource = fs.readFileSync(new URL('../render-service/src/download.js', import.meta.url), 'utf8');
const { estimateJobCost } = await import('../render-service/src/job.js');

const baseManifest = {
  project: { duration: 60 },
  render: { width: 1080, height: 1920, fps: 30 },
  clips: Array.from({ length: 8 }, (_, index) => ({ id: `clip-${index}` })),
  audioTracks: [],
};

assert.equal(selectRenderProfile(baseManifest).id, 'cpu-standard');
assert.equal(selectRenderProfile({
  ...baseManifest,
  project: { duration: 360 },
}).id, 'cpu-pro60');
assert.equal(selectRenderProfile({
  ...baseManifest,
  render: { ...baseManifest.render, fps: 60 },
}).id, 'cpu-pro60');
assert.equal(selectRenderProfile({
  ...baseManifest,
  project: { duration: 600 },
  render: { ...baseManifest.render, fps: 60, acceleration: 'gpu' },
}, { gpuEnabled: false }).id, 'cpu-pro60');
assert.equal(selectRenderProfile({
  ...baseManifest,
  project: { duration: 600 },
  render: { ...baseManifest.render, fps: 60, acceleration: 'gpu' },
}, { gpuEnabled: true }).id, 'gpu-turbo');
assert.equal(RENDER_PROFILES['cpu-standard'].vcpu, 4);
assert.equal(RENDER_PROFILES['cpu-pro60'].memoryGib, 16);
assert.match(functionSource, /maxDurationSeconds:\s*15 \* 60/);
assert.match(functionSource, /launchCloudRunJobForExport/);
assert.match(functionSource, /cancelCloudRunExecution/);
assert.match(workerSource, /CLOUD_RUN_EXECUTION/);
assert.match(workerSource, /status: 'ready'/);
assert.match(deploySource, /DRY-RUN/);
assert.match(deploySource, /--task-timeout 2h/);
assert.match(downloadDeploySource, /--allow-unauthenticated/);
assert.match(downloadDeploySource, /--set-secrets "EXPORT_SIGNING_SECRET=EXPORT_SIGNING_SECRET:latest"/);
assert.match(downloadSource, /crypto\.timingSafeEqual/);
assert.match(downloadSource, /No Content-Length: Cloud Run uses chunked streaming/);
assert.equal(estimateJobCost({
  elapsedMs: 76_058,
  vcpu: 8,
  memoryGib: 16,
  outputBytes: 34_230_294,
}).billableSeconds, 77);
assert.ok(estimateJobCost({
  elapsedMs: 76_058,
  vcpu: 8,
  memoryGib: 16,
  outputBytes: 34_230_294,
}).estimatedTotalCost < 0.1);
const gpuCost = estimateJobCost({
  elapsedMs: 95_310,
  vcpu: 8,
  memoryGib: 32,
  outputBytes: 67_333_381,
  accelerator: 'nvidia-l4',
});
assert.equal(gpuCost.billableSeconds, 96);
assert.ok(gpuCost.estimatedGpuCost > 0);
assert.ok(gpuCost.estimatedTotalCost > gpuCost.estimatedComputeCost);

console.log('VibeCut Cloud Run Jobs profile/orchestration smoke passed.');
