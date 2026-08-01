import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildVideoEncoderArgs } from '../render-service/src/server.js';

const cpuArgs = buildVideoEncoderArgs({ crf: 17, preset: 'slow' });
assert.deepEqual(cpuArgs, ['-c:v', 'libx264', '-preset', 'slow', '-crf', '17']);

const previous = process.env.VIBECUT_FFMPEG_ACCELERATOR;
process.env.VIBECUT_FFMPEG_ACCELERATOR = 'nvidia';
const gpuArgs = buildVideoEncoderArgs({ crf: 18, preset: 'slow' });
if (previous === undefined) delete process.env.VIBECUT_FFMPEG_ACCELERATOR;
else process.env.VIBECUT_FFMPEG_ACCELERATOR = previous;

assert.deepEqual(gpuArgs, [
  '-c:v', 'h264_nvenc',
  '-preset', 'p5',
  '-tune', 'hq',
  '-rc', 'vbr',
  '-cq', '18',
  '-b:v', '0',
]);

const deploySource = fs.readFileSync(new URL('../infra/vibecut-cloud-run-jobs/deploy-gpu.sh', import.meta.url), 'utf8');
const dockerSource = fs.readFileSync(new URL('../render-service/Dockerfile.gpu', import.meta.url), 'utf8');
assert.match(deploySource, /--gpu 1/);
assert.match(deploySource, /--gpu-type nvidia-l4/);
assert.match(deploySource, /--no-gpu-zonal-redundancy/);
assert.match(deploySource, /VIBECUT_ENABLE_GPU_DEPLOY/);
assert.match(dockerSource, /h264_nvenc/);

console.log('VibeCut GPU profile smoke passed.');
