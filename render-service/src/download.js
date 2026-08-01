import crypto from 'node:crypto';
import http from 'node:http';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

const PORT = Number(process.env.PORT || 8080);
const PROJECT_ID = process.env.VIBECUT_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';
const BUCKET_NAME = process.env.VIBECUT_STORAGE_BUCKET || `${PROJECT_ID}.firebasestorage.app`;
const SIGNING_SECRET = String(process.env.EXPORT_SIGNING_SECRET || '').trim();
const MAX_TOKEN_LENGTH = 4096;
const MAX_FUTURE_TOKEN_MS = 16 * 60 * 1000;
const firestore = new Firestore({ projectId: PROJECT_ID });
const storage = new Storage({ projectId: PROJECT_ID });

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true, service: 'vibecut-download-service' });
    return;
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendText(response, 405, 'Method Not Allowed');
    return;
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/download') {
    sendText(response, 404, 'Not Found');
    return;
  }

  let claims;
  try {
    claims = verifyDownloadToken(url.searchParams.get('token'));
  } catch (error) {
    console.warn(JSON.stringify({ event: 'download_token_rejected', reason: error.message }));
    sendText(response, 403, 'Lien de telechargement invalide ou expire.');
    return;
  }

  let stage = 'firestore';
  try {
    const snapshot = await firestore.collection('videoExportJobs').doc(claims.jobId).get();
    const data = snapshot.data();
    const currentStoragePath = data?.output?.storagePath || data?.outputStoragePath;
    if (
      !snapshot.exists ||
      data?.uid !== claims.uid ||
      data?.status !== 'ready' ||
      currentStoragePath !== claims.storagePath ||
      !isOwnerOutputStoragePath(claims.uid, currentStoragePath)
    ) {
      sendText(response, 404, 'Export indisponible.');
      return;
    }

    stage = 'storage-metadata';
    const file = storage.bucket(BUCKET_NAME).file(claims.storagePath);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size || data?.output?.sizeBytes || 0);
    const range = parseRange(request.headers.range, size);
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.setHeader('Content-Type', metadata.contentType || data?.output?.contentType || 'video/mp4');
    response.setHeader('Content-Disposition', `attachment; filename="vibecut-${claims.jobId}.mp4"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Accept-Ranges', 'bytes');

    const streamOptions = {};
    if (range) {
      response.statusCode = 206;
      response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      response.setHeader('Content-Length', String(range.end - range.start + 1));
      streamOptions.start = range.start;
      streamOptions.end = range.end;
    } else {
      response.statusCode = 200;
      // No Content-Length: Cloud Run uses chunked streaming for outputs larger than 32 MiB.
    }

    stage = 'storage-stream';
    const stream = file.createReadStream(streamOptions);
    stream.on('error', (error) => {
      console.error(JSON.stringify({
        event: 'download_stream_failed',
        jobId: claims.jobId,
        message: error.message,
      }));
      if (!response.headersSent) sendText(response, 500, 'Telechargement temporairement indisponible.');
      else response.destroy(error);
    });
    stream.pipe(response);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'download_request_failed',
      jobId: claims.jobId,
      stage,
      message: error.message,
    }));
    if (!response.headersSent) sendText(response, 500, 'Telechargement temporairement indisponible.');
    else response.destroy(error);
  }
});

server.listen(PORT, () => {
  console.log(`VibeCut download service listening on ${PORT}`);
});

function verifyDownloadToken(token) {
  if (!SIGNING_SECRET) throw new Error('service secret unavailable');
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) {
    throw new Error('invalid token');
  }
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('invalid token');
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(parts[0]).digest();
  const provided = Buffer.from(parts[1], 'base64url');
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error('invalid signature');
  }
  const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const expiresAt = Number(payload.exp);
  if (
    payload.v !== 1 ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    expiresAt > Date.now() + MAX_FUTURE_TOKEN_MS ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(payload.jobId || '') ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(payload.uid || '') ||
    !isOwnerOutputStoragePath(payload.uid, payload.storagePath)
  ) {
    throw new Error('invalid claims');
  }
  return {
    jobId: payload.jobId,
    uid: payload.uid,
    storagePath: payload.storagePath,
    expiresAt,
  };
}

function isOwnerOutputStoragePath(uid, storagePath) {
  if (typeof storagePath !== 'string' || storagePath.includes('..') || storagePath.includes('\\')) return false;
  const escapedUid = uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^users/${escapedUid}/exports/[^/]+/outputs/[^/]+$`).test(storagePath);
}

function parseRange(value, size) {
  if (!value || !Number.isFinite(size) || size <= 0) return null;
  const match = String(value).match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= size) {
    return null;
  }
  return { start, end };
}

function sendText(response, status, body) {
  response.statusCode = status;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end(body);
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}
