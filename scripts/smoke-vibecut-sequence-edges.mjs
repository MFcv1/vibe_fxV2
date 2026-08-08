/*
 * OUVERTURE ET FIN DE SEQUENCE, PROUVEES SUR UN VRAI MP4.
 *
 * Ce que ce test empeche, et qui etait vrai jusqu'au 2026-08-04 : sept entrees
 * du catalogue s'appelaient « Ouverture cinema », « Fin cinema »... et ne
 * pouvaient NI ouvrir NI finir. Une transition s'accroche entre deux plans; il
 * n'existait aucun emplacement avant le premier ni apres le dernier.
 *
 * TROIS CHOSES MESUREES, et aucune n'est declarative :
 *   1. LA DUREE, et l'ASYMETRIE des deux bords. Une ouverture n'a rien avant
 *      elle : elle CREE son temps en tete. Une fin, elle, a le dernier plan sous
 *      la main : elle le RECOUVRE et n'ajoute rien. Le premier jet ajoutait les
 *      deux, et l'image se figeait une seconde avant de s'eteindre - defaut
 *      trouve a l'essai, pas au test.
 *   2. LE NOIR DE DEPART. La premiere image doit etre sombre: une ouverture part
 *      du noir. Sans ce controle, un export qui ignorerait l'ouverture mais
 *      allongerait la duree passerait le point 1.
 *   3. LE NOIR DE FIN, et surtout le MILIEU qui doit rester clair - sinon un
 *      export entierement noir passerait les deux autres.
 *
 * Le graphe mesure est celui que LE RENDERER emet (`buildFfmpegArgs`), pas une
 * reecriture.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { buildFfmpegArgs } from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const ffmpeg = process.env.VIBECUT_FFMPEG_PATH || require("ffmpeg-static");
const W = 320, H = 320, FPS = 30, CLIP = 2, EDGE = 1;

const dir = await mkdtemp(path.join(os.tmpdir(), "seqexp-"));
const a = path.join(dir, "a.mp4");
await run(["-f", "lavfi", "-i", `testsrc2=s=${W}x${H}:r=${FPS}:d=${CLIP}`, "-pix_fmt", "yuv420p", a]);

function clip(id) {
  return { id, name: id, mediaType: "video", duration: CLIP, trimStart: 0, trimEnd: CLIP, localPreviewUrl: a, sourceStoragePath: a };
}
function manifest(withEdges) {
  const transitions = withEdges ? [
    { id: "i", type: "intro-cinematic-bars", startTime: 0, duration: EDGE, params: { placement: "intro" } },
    { id: "o", type: "outro-cinematic-fade", startTime: CLIP, duration: EDGE, params: { placement: "outro" } },
  ] : [];
  // SEULE l'ouverture allonge le montage: la fin RECOUVRE la queue du dernier
  // plan. C'est la difference de nature entre les deux, et le test la porte.
  const total = withEdges ? CLIP + EDGE : CLIP;
  return {
    version: 1,
    project: { id: "seq", name: "seq", duration: total, preset: "square" },
    render: { width: W, height: H, fps: FPS, format: "mp4", videoCodec: "h264", audioCodec: "aac", crf: 20, targetBitrate: 2e6, audioBitrate: 128000, qualityMode: "preview", fitMode: "cover" },
    clips: [clip("c1")],
    transitions,
    textOverlays: [],
  };
}
async function render(withEdges, out) {
  const m = manifest(withEdges);
  const args = buildFfmpegArgs({ manifest: m, videoInputs: [{ clip: m.clips[0], file: a }], audioInputs: [], outputFile: out, warnings: [] });
  await run(args.slice(1));
  const probe = await capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]);
  return Number(probe.trim());
}

const plain = path.join(dir, "plain.mp4");
const withE = path.join(dir, "edges.mp4");
const d0 = await render(false, plain);
const d1 = await render(true, withE);
console.log(`sans bords: ${d0.toFixed(2)} s`);
console.log(`avec bords: ${d1.toFixed(2)} s (attendu ~${(CLIP + EDGE).toFixed(2)})`);
assert.ok(
  Math.abs(d1 - (CLIP + EDGE)) < 0.25,
  `duree attendue ${CLIP + EDGE} (l'ouverture ajoute son temps, la fin RECOUVRE), obtenue ${d1}`,
);

// La premiere image doit etre NOIRE, la derniere aussi.
const first = await capture(ffmpeg, ["-v", "error", "-i", withE, "-vf", "select=eq(n\\,1),scale=8:8", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], true);
// Apres l'ouverture, AVANT que la fin ne commence a eteindre.
const mid = await capture(ffmpeg, ["-v", "error", "-i", withE, "-vf", `select=eq(n\\,${Math.round((EDGE + 0.3) * FPS)}),scale=8:8`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], true);
const last = await capture(ffmpeg, ["-v", "error", "-i", withE, "-vf", `select=eq(n\\,${Math.round((CLIP + EDGE) * FPS) - 2}),scale=8:8`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], true);
const mean = (b) => [...b].reduce((s, v) => s + v, 0) / b.length;
console.log(`luminance: debut ${mean(first).toFixed(0)} / milieu ${mean(mid).toFixed(0)} / fin ${mean(last).toFixed(0)}`);
assert.ok(mean(first) < 40, `l'ouverture ne demarre pas dans le noir (${mean(first).toFixed(0)})`);
assert.ok(mean(mid) > 60, `le milieu du montage est noir (${mean(mid).toFixed(0)})`);
assert.ok(mean(last) < 40, `la fin ne s'eteint pas (${mean(last).toFixed(0)})`);
console.log("smoke-vibecut-sequence-edges: ok");
await rm(dir, { recursive: true, force: true });

function run(args) {
  return new Promise((res, rej) => {
    const c = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let e = ""; c.stderr.on("data", (d) => { e += d; });
    c.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg ${code}: ${e.slice(-1500)}`))));
  });
}
function capture(bin, args, raw = false) {
  return new Promise((res, rej) => {
    const c = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out = []; let e = "";
    c.stdout.on("data", (d) => out.push(d)); c.stderr.on("data", (d) => { e += d; });
    c.on("close", (code) => (code === 0 ? res(raw ? Buffer.concat(out) : Buffer.concat(out).toString()) : rej(new Error(`${bin} ${code}: ${e.slice(-800)}`))));
  });
}
