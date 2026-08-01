import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { buildFfmpegArgs, validateManifest } from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");
const workDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-image-render-"));

try {
  const imageA = path.join(workDir, "photo-a.png");
  const imageB = path.join(workDir, "photo-b.png");
  const output = path.join(workDir, "photo-motion.mp4");
  await run(ffmpeg, ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=s=960x540:r=1", "-frames:v", "1", imageA]);
  await run(ffmpeg, ["-hide_banner", "-y", "-f", "lavfi", "-i", "smptebars=s=540x960:r=1", "-frames:v", "1", imageB]);

  const manifest = {
    version: 1,
    project: { id: "photo-motion", name: "Photo Motion", duration: 2.7 },
    render: {
      width: 540,
      height: 960,
      fps: 30,
      format: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      crf: 22,
      preset: "veryfast",
      audioBitrate: 128000,
      fitMode: "cover",
    },
    clips: [
      {
        id: "photo-a",
        name: "Photo A",
        mediaType: "image",
        sourceStoragePath: "users/local/exports/photo-motion/sources/image/photo-a.png",
        duration: 1.5,
        trimStart: 0,
        trimEnd: 1.5,
        speed: 1,
        volume: 0,
        motion: { preset: "zoom-in" },
      },
      {
        id: "photo-b",
        name: "Photo B",
        mediaType: "image",
        sourceStoragePath: "users/local/exports/photo-motion/sources/image/photo-b.png",
        duration: 1.5,
        trimStart: 0,
        trimEnd: 1.5,
        speed: 1,
        volume: 0,
        motion: { preset: "pan-left" },
      },
    ],
    transitions: [
      { id: "photo-fade", type: "crossfade", duration: 0.3, fromItemId: "photo-a", toItemId: "photo-b", params: { placement: "cut" } },
    ],
    textOverlays: [],
    audioTracks: [],
  };

  assert.deepEqual(validateManifest(manifest).errors, []);
  const warnings = [];
  const args = buildFfmpegArgs({
    manifest,
    videoInputs: [
      { clip: manifest.clips[0], file: imageA, hasAudioStream: false },
      { clip: manifest.clips[1], file: imageB, hasAudioStream: false },
    ],
    audioInputs: [],
    outputFile: output,
    warnings,
  });
  assert.ok(args.includes("-loop"), "still image inputs must be looped for their scene duration");
  assert.match(args.join(" "), /zoompan=/, "Ken Burns presets must be translated to FFmpeg zoompan");
  await run(ffmpeg, args);
  assert.ok((await stat(output)).size > 10_000, "photo motion MP4 must be non-empty");
  console.log("smoke-vibecut-image-render: ok");
} finally {
  await rm(workDir, { recursive: true, force: true });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-8000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${code}): ${stderr}`));
    });
  });
}
