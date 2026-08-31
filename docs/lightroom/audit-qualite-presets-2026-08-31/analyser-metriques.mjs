import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const auditRoot = path.dirname(fileURLToPath(import.meta.url));
const lightroomRoot = path.join(auditRoot, 'lightroom');
const vibefxRoot = path.join(auditRoot, 'vibefx');

const srgbToLinear = (value) => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const rgbToLab = (r, g, b) => {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / 0.95047;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl;
  const z = (0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl) / 1.08883;
  const f = (v) => (v > 216 / 24389 ? Math.cbrt(v) : (841 / 108) * v + 4 / 29);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

const percentile = (values, ratio) => {
  values.sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.floor(values.length * ratio))];
};

const candidateIds = (await readdir(lightroomRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const ids = [];
for (const id of candidateIds) {
  if ((await readdir(path.join(vibefxRoot, id))).includes('rendu.png')) ids.push(id);
}

const results = [];
for (const presetId of ids) {
  const referenceName = (await readdir(path.join(lightroomRoot, presetId))).find((name) => /\.png$/i.test(name));
  const referencePath = path.join(lightroomRoot, presetId, referenceName);
  const renderPath = path.join(vibefxRoot, presetId, 'rendu.png');
  const reference = await sharp(referencePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const render = await sharp(renderPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (reference.info.width !== render.info.width || reference.info.height !== render.info.height) {
    throw new Error(`Dimensions incompatibles pour ${presetId}`);
  }

  const { width, height, channels } = reference.info;
  const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / 500_000)));
  const rgbDiffs = [];
  const luminanceDiffs = [];
  const deltaEs = [];
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumYRef = 0;
  let sumYRender = 0;
  let sumYRef2 = 0;
  let sumYRender2 = 0;
  let sumCross = 0;
  let centerSum = 0;
  let centerCount = 0;
  let cornerSum = 0;
  let cornerCount = 0;
  let clippedReference = 0;
  let clippedRender = 0;
  let count = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * channels;
      const rr = reference.data[offset];
      const rg = reference.data[offset + 1];
      const rb = reference.data[offset + 2];
      const vr = render.data[offset];
      const vg = render.data[offset + 1];
      const vb = render.data[offset + 2];
      const dr = Math.abs(vr - rr);
      const dg = Math.abs(vg - rg);
      const db = Math.abs(vb - rb);
      const rgb = (dr + dg + db) / 3;
      const yr = 0.2126 * rr + 0.7152 * rg + 0.0722 * rb;
      const yv = 0.2126 * vr + 0.7152 * vg + 0.0722 * vb;
      const labR = rgbToLab(rr, rg, rb);
      const labV = rgbToLab(vr, vg, vb);
      const deltaE = Math.hypot(labV[0] - labR[0], labV[1] - labR[1], labV[2] - labR[2]);
      rgbDiffs.push(rgb);
      luminanceDiffs.push(Math.abs(yv - yr));
      deltaEs.push(deltaE);
      sumR += dr;
      sumG += dg;
      sumB += db;
      sumYRef += yr;
      sumYRender += yv;
      sumYRef2 += yr * yr;
      sumYRender2 += yv * yv;
      sumCross += yr * yv;
      const inCenter = x >= width * 0.25 && x < width * 0.75 && y >= height * 0.25 && y < height * 0.75;
      const inCorner = (x < width * 0.25 || x >= width * 0.75) && (y < height * 0.25 || y >= height * 0.75);
      if (inCenter) { centerSum += rgb; centerCount += 1; }
      if (inCorner) { cornerSum += rgb; cornerCount += 1; }
      if (rr <= 1 || rg <= 1 || rb <= 1 || rr >= 254 || rg >= 254 || rb >= 254) clippedReference += 1;
      if (vr <= 1 || vg <= 1 || vb <= 1 || vr >= 254 || vg >= 254 || vb >= 254) clippedRender += 1;
      count += 1;
    }
  }

  const meanYRef = sumYRef / count;
  const meanYRender = sumYRender / count;
  const varianceRef = sumYRef2 / count - meanYRef ** 2;
  const varianceRender = sumYRender2 / count - meanYRender ** 2;
  const covariance = sumCross / count - meanYRef * meanYRender;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const ssim = ((2 * meanYRef * meanYRender + c1) * (2 * covariance + c2))
    / ((meanYRef ** 2 + meanYRender ** 2 + c1) * (varianceRef + varianceRender + c2));

  results.push({
    presetId,
    sampledPixels: count,
    rgbMean: { r: sumR / count, g: sumG / count, b: sumB / count, overall: (sumR + sumG + sumB) / (3 * count) },
    rgbP95: percentile(rgbDiffs, 0.95),
    luminanceMean: luminanceDiffs.reduce((sum, value) => sum + value, 0) / count,
    luminanceP95: percentile(luminanceDiffs, 0.95),
    deltaE76Mean: deltaEs.reduce((sum, value) => sum + value, 0) / count,
    deltaE76P95: percentile(deltaEs, 0.95),
    ssimGlobalLuminance: ssim,
    centerRgbMean: centerSum / centerCount,
    cornersRgbMean: cornerSum / cornerCount,
    cornersMinusCenter: cornerSum / cornerCount - centerSum / centerCount,
    clippedPercent: { reference: 100 * clippedReference / count, vibefx: 100 * clippedRender / count },
  });
  console.log(`${presetId}: ΔE ${results.at(-1).deltaE76Mean.toFixed(2)}, SSIM ${ssim.toFixed(4)}`);
}

await writeFile(path.join(auditRoot, 'metriques-detaillees.json'), `${JSON.stringify(results, null, 2)}\n`);
