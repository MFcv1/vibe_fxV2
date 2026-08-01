import { Firestore, FieldValue } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { pathToFileURL } from 'node:url';
import { renderJob, validateManifest } from './server.js';

const EXPORT_JOBS_COLLECTION = 'videoExportJobs';

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function publicLog(message, level = 'info') {
  return {
    level,
    message,
    createdAt: new Date(),
  };
}

const CLOUD_RUN_JOB_CPU_SECOND_USD = 0.000018;
const CLOUD_RUN_JOB_MEMORY_GIB_SECOND_USD = 0.000002;
const CLOUD_RUN_L4_SECOND_USD = 0.0001867;

export function estimateJobCost({ elapsedMs, vcpu, memoryGib, outputBytes, accelerator = null }) {
  const billableSeconds = Math.max(60, Math.ceil(Number(elapsedMs || 0) / 1000));
  const outputGib = Number(outputBytes || 0) / (1024 ** 3);
  const computeUsd = billableSeconds * (
    Number(vcpu || 2) * CLOUD_RUN_JOB_CPU_SECOND_USD +
    Number(memoryGib || 2) * CLOUD_RUN_JOB_MEMORY_GIB_SECOND_USD
  );
  const gpuUsd = accelerator === 'nvidia-l4'
    ? billableSeconds * CLOUD_RUN_L4_SECOND_USD
    : 0;
  const storageAndEgressUsd = outputGib * (0.026 + 0.12);
  const totalUsd = computeUsd + gpuUsd + storageAndEgressUsd;
  return {
    billableSeconds,
    estimatedComputeCost: Number(computeUsd.toFixed(6)),
    estimatedGpuCost: Number(gpuUsd.toFixed(6)),
    estimatedStorageCost: Number(storageAndEgressUsd.toFixed(6)),
    estimatedTotalCost: Number(totalUsd.toFixed(6)),
    estimatedTotalCostEur: Number((totalUsd * 0.92).toFixed(6)),
    currency: 'USD',
    indicativeOnly: true,
  };
}

function isCancelled(data = {}) {
  return data.status === 'cancelled' ||
    data.phase === 'cancelled' ||
    data.cancelRequested === true;
}

async function readManifest(storage, bucketName, storagePath) {
  const [buffer] = await storage.bucket(bucketName).file(storagePath).download();
  return JSON.parse(buffer.toString('utf8'));
}

function assertGpuExecutionMatchesProfile(renderProfile) {
  if (renderProfile !== 'gpu-turbo') return;
  if (String(process.env.VIBECUT_FFMPEG_ACCELERATOR || '').toLowerCase() !== 'nvidia') {
    throw new Error('gpu-turbo requires VIBECUT_FFMPEG_ACCELERATOR=nvidia.');
  }
}

export async function runCloudJob() {
  const jobId = requiredEnv('VIBECUT_EXPORT_JOB_ID');
  const uid = requiredEnv('VIBECUT_EXPORT_UID');
  const projectId = requiredEnv('FIREBASE_PROJECT_ID');
  const bucketName = requiredEnv('STORAGE_BUCKET');
  const manifestStoragePath = requiredEnv('MANIFEST_STORAGE_PATH');
  const outputStoragePath = requiredEnv('OUTPUT_STORAGE_PATH');
  const renderProfile = requiredEnv('RENDER_PROFILE');
  assertGpuExecutionMatchesProfile(renderProfile);
  const executionName = String(process.env.CLOUD_RUN_EXECUTION || '').trim() || null;
  const vcpu = Number(process.env.EXPORT_RENDERER_ALLOCATED_VCPU || 2);
  const memoryGib = Number(process.env.EXPORT_RENDERER_ALLOCATED_MEMORY_GIB || 2);
  const firestore = new Firestore({ projectId });
  const storage = new Storage({ projectId });
  const ref = firestore.collection(EXPORT_JOBS_COLLECTION).doc(jobId);
  const initialSnapshot = await ref.get();

  if (!initialSnapshot.exists) throw new Error(`Export job ${jobId} does not exist.`);
  const initialData = initialSnapshot.data() || {};
  if (initialData.ownerUid !== uid) throw new Error('Export job owner mismatch.');
  if (isCancelled(initialData)) return { status: 'cancelled', skipped: true };

  await ref.set({
    status: 'rendering',
    phase: 'rendering',
    progress: 35,
    renderProfile,
    cloudRun: {
      jobName: process.env.CLOUD_RUN_JOB || initialData.cloudRun?.jobName || null,
      executionName,
      taskIndex: process.env.CLOUD_RUN_TASK_INDEX || '0',
      region: process.env.EXPORT_RENDERER_REGION || initialData.cloudRun?.region || null,
      startedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
    logs: FieldValue.arrayUnion(publicLog(`Rendu ${renderProfile} demarre dans Cloud Run Jobs.`)),
  }, { merge: true });

  try {
    const manifest = await readManifest(storage, bucketName, manifestStoragePath);
    const validation = validateManifest(manifest);
    if (validation.errors.length) {
      throw new Error(`Invalid render manifest: ${validation.errors.join(' | ')}`);
    }

    const result = await renderJob({
      jobId,
      bucketName,
      outputStoragePath,
      manifest,
    });
    const latestSnapshot = await ref.get();
    const latestData = latestSnapshot.data() || {};
    if (isCancelled(latestData)) {
      await ref.set({
        status: 'cancelled',
        phase: 'cancelled',
        cancelledOutput: {
          storagePath: result.output.storagePath,
          sizeBytes: result.output.sizeBytes,
          ignored: true,
        },
        updatedAt: FieldValue.serverTimestamp(),
        logs: FieldValue.arrayUnion(publicLog('Sortie ignoree car le job a ete annule pendant le rendu.', 'warning')),
      }, { merge: true });
      return { status: 'cancelled', outputIgnored: true };
    }

    const costEstimate = estimateJobCost({
      elapsedMs: result.elapsedMs,
      vcpu,
      memoryGib,
      outputBytes: result.output.sizeBytes,
      accelerator: renderProfile === 'gpu-turbo' ? 'nvidia-l4' : null,
    });
    await ref.set({
      status: 'ready',
      phase: 'ready',
      progress: 100,
      output: {
        ...result.output,
        contentType: 'video/mp4',
      },
      warnings: [...validation.warnings, ...result.warnings],
      rendererResult: {
        mode: 'cloud-run-job-ffmpeg',
        renderProfile,
        elapsedMs: result.elapsedMs,
        phaseMs: result.phaseMs,
        service: process.env.CLOUD_RUN_JOB || result.service,
        executionName,
        region: result.region,
        allocatedVcpu: vcpu,
        allocatedMemoryGib: memoryGib,
      },
      costEstimate,
      estimatedComputeCost: costEstimate.estimatedComputeCost,
      estimatedGpuCost: costEstimate.estimatedGpuCost,
      estimatedStorageCost: costEstimate.estimatedStorageCost,
      estimatedTotalCost: costEstimate.estimatedTotalCost,
      estimatedTotalCostEur: costEstimate.estimatedTotalCostEur,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      logs: FieldValue.arrayUnion(publicLog('MP4 final rendu et charge dans Firebase Storage.')),
    }, { merge: true });
    return { status: 'ready', output: result.output, costEstimate };
  } catch (error) {
    const latestSnapshot = await ref.get();
    const latestData = latestSnapshot.data() || {};
    if (!isCancelled(latestData)) {
      await ref.set({
        status: 'failed',
        phase: 'failed',
        error: {
          code: error.code || 'cloud-run-job-failed',
          message: error.message || 'Cloud Run render job failed.',
        },
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        logs: FieldValue.arrayUnion(publicLog(error.message || 'Cloud Run render job failed.', 'error')),
      }, { merge: true });
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCloudJob()
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
