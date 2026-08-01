import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "model", "videoProjectModel.js");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-project-model-"));
const tempModulePath = path.join(tempDir, "videoProjectModel.mjs");

try {
  await writeFile(tempModulePath, await readFile(sourcePath, "utf8"), "utf8");
  const { createVideoProjectSnapshot, restoreVideoProjectSnapshot } = await import(pathToFileURL(tempModulePath).href);
  const imageBlob = new Blob(["image-bytes"], { type: "image/jpeg" });
  const videoBlob = new Blob(["video-bytes"], { type: "video/mp4" });
  const snapshot = createVideoProjectSnapshot({
    projectName: "Round trip",
    clips: [
      { id: "photo", name: "Photo", mediaType: "image", mimeType: "image/jpeg", file: imageBlob, url: "blob:old-photo", duration: 4, trimStart: 0, trimEnd: 4, motion: { preset: "zoom-in" }, thumbnails: ["blob:old-photo"] },
      { id: "video", name: "Video", mediaType: "video", mimeType: "video/mp4", file: videoBlob, url: "blob:old-video", duration: 2, trimStart: 0, trimEnd: 2, thumbnails: ["data:image/jpeg;base64,thumb"] },
    ],
    transitions: {},
    transitionItems: [{ id: "fade", type: "crossfade", fromItemId: "photo", toItemId: "video", duration: 0.4, params: { placement: "cut" } }],
    textOverlays: [{ id: "title", content: "Test", startTime: 0, endTime: 2 }],
    audioTracks: [],
    tracks: [{ id: "video-main", laneRole: "video" }],
    sequencePreset: "instagram-reel",
  }, { savedAt: "2026-07-29T10:00:00.000Z" });

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.project.clips[0].url, null, "ephemeral blob URLs must never be persisted");
  assert.equal(snapshot.project.clips[0].sourceBlob, imageBlob, "original image blob must be persisted");
  assert.deepEqual(snapshot.project.clips[1].thumbnails, ["data:image/jpeg;base64,thumb"], "persistent data thumbnails may survive");

  const urls = [];
  const restored = restoreVideoProjectSnapshot(snapshot, {
    createObjectUrl(blob) {
      const url = `blob:restored-${urls.length + 1}-${blob.type}`;
      urls.push(url);
      return url;
    },
  });
  assert.deepEqual(restored.warnings, []);
  assert.equal(restored.state.clips[0].url, urls[0]);
  assert.deepEqual(restored.state.clips[0].thumbnails, [urls[0]], "restored photos must immediately regain a thumbnail");
  assert.equal(restored.state.clips[0].motion.preset, "zoom-in");
  assert.equal(restored.state.transitionItems[0].type, "crossfade");
  assert.equal(restored.state.sequencePreset, "instagram-reel");
  console.log("smoke-video-project-persistence: ok");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
