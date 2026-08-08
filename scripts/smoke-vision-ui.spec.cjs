const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const demoImage = path.join(process.cwd(), "public", "assets", "vibefx", "demo-astronaut.png");
const metricsPath = path.join(process.cwd(), "src", "features", "vibefx-studio", "utils", "visionMetrics.js");
const canvasUtilsPath = path.join(process.cwd(), "src", "features", "vibefx-studio", "utils", "canvasUtils.js");
const syntheticVisionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
  <defs>
    <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#78b8f2"/>
      <stop offset="1" stop-color="#eaf4ff"/>
    </linearGradient>
    <linearGradient id="neutral" x1="0" x2="1">
      <stop offset="0" stop-color="#101010"/>
      <stop offset=".18" stop-color="#343434"/>
      <stop offset=".5" stop-color="#888888"/>
      <stop offset=".82" stop-color="#d5d5d5"/>
      <stop offset="1" stop-color="#fbfbfb"/>
    </linearGradient>
    <linearGradient id="warmRoom" x1="0" x2="1">
      <stop offset="0" stop-color="#5c3b2d"/>
      <stop offset="1" stop-color="#e1b06f"/>
    </linearGradient>
  </defs>
  <rect width="960" height="640" fill="#151515"/>
  <rect x="0" y="0" width="960" height="170" fill="url(#sky)"/>
  <rect x="0" y="170" width="960" height="82" fill="url(#neutral)"/>
  <rect x="0" y="252" width="320" height="388" fill="#2d6f3a"/>
  <rect x="320" y="252" width="320" height="388" fill="url(#warmRoom)"/>
  <rect x="640" y="252" width="320" height="388" fill="#111623"/>
  <circle cx="418" cy="368" r="74" fill="#e8b18e"/>
  <circle cx="515" cy="368" r="74" fill="#9b5f47"/>
  <circle cx="611" cy="368" r="74" fill="#5a352b"/>
  <rect x="44" y="302" width="72" height="104" fill="#4aa34d"/>
  <rect x="132" y="302" width="72" height="104" fill="#74bb42"/>
  <rect x="220" y="302" width="72" height="104" fill="#205f2d"/>
  <rect x="688" y="306" width="72" height="108" fill="#ff2b78"/>
  <rect x="776" y="306" width="72" height="108" fill="#25d8ff"/>
  <rect x="864" y="306" width="72" height="108" fill="#ffe75a"/>
  <rect x="42" y="470" width="252" height="80" fill="#d64532"/>
  <rect x="354" y="470" width="252" height="80" fill="#eee7d8"/>
  <rect x="680" y="470" width="248" height="80" fill="#050505"/>
  <circle cx="804" cy="510" r="32" fill="#ffffff"/>
</svg>`;
const largeVisionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="4200" height="3200" viewBox="0 0 4200 3200">
  <defs>
    <linearGradient id="largeSky" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#67b8ff"/>
      <stop offset="1" stop-color="#f7fbff"/>
    </linearGradient>
    <linearGradient id="largeNeutral" x1="0" x2="1">
      <stop offset="0" stop-color="#111111"/>
      <stop offset=".5" stop-color="#8d8d8d"/>
      <stop offset="1" stop-color="#f8f8f8"/>
    </linearGradient>
  </defs>
  <rect width="4200" height="3200" fill="#121318"/>
  <rect width="4200" height="960" fill="url(#largeSky)"/>
  <rect x="0" y="960" width="4200" height="360" fill="url(#largeNeutral)"/>
  <rect x="0" y="1320" width="1400" height="1880" fill="#2f7b42"/>
  <rect x="1400" y="1320" width="1400" height="1880" fill="#c08a55"/>
  <rect x="2800" y="1320" width="1400" height="1880" fill="#10192c"/>
  <circle cx="1830" cy="1860" r="330" fill="#e4ae8d"/>
  <circle cx="2270" cy="1860" r="330" fill="#9c6048"/>
  <circle cx="3600" cy="1900" r="180" fill="#24d8ff"/>
  <circle cx="3290" cy="1900" r="180" fill="#ff317c"/>
  <rect x="220" y="2380" width="1020" height="360" fill="#d94734"/>
  <rect x="1490" y="2380" width="1020" height="360" fill="#f1e8da"/>
  <rect x="2940" y="2380" width="1020" height="360" fill="#060606"/>
</svg>`;

let measureVisionImageData;
let compareVisionMetrics;
let applySafeGlobalTint;

test.setTimeout(90000);

test.beforeAll(() => {
  const metricsSource = fs.readFileSync(metricsPath, "utf8")
    .replace(/export function measureVisionImageData/, "function measureVisionImageData")
    .replace(/export function compareVisionMetrics/, "function compareVisionMetrics");
  const metrics = new Function(`${metricsSource}; return { measureVisionImageData, compareVisionMetrics };`)();
  measureVisionImageData = metrics.measureVisionImageData;
  compareVisionMetrics = metrics.compareVisionMetrics;

  const canvasSource = fs.readFileSync(canvasUtilsPath, "utf8")
    .replace(/import\s+\{[\s\S]*?\}\s+from\s+['"]\.\/visionColorScience['"];?/, "")
    .replace(/export function/g, "function")
    .replace(/export const/g, "const");
  const canvasUtils = new Function(`${canvasSource}; return { applySafeGlobalTint };`)();
  applySafeGlobalTint = canvasUtils.applySafeGlobalTint;
});

async function openStudio(page) {
  await page.goto(`${baseUrl}/studio`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  /*
   * En dev, /studio est protege par le portail d'authentification: sans ce
   * contournement la suite ne pouvait plus entrer dans le studio (6 tests en
   * echec, corrige le 2026-08-08). Le bouton n'agit qu'une fois React hydrate,
   * et le serveur de dev peut recharger la page pendant la compilation: on
   * reclique jusqu'a ce que le studio soit la et le RESTE.
   */
  const visionTab = page.getByRole("button", { name: /^vision$/i });
  const bypass = page.getByRole("button", { name: /contourner.*authentification/i });
  let stable = 0;
  for (let attempt = 0; attempt < 40 && stable < 3; attempt += 1) {
    if (await visionTab.isVisible().catch(() => false)) {
      stable += 1;
    } else {
      stable = 0;
      if (await bypass.isVisible().catch(() => false)) await bypass.click().catch(() => {});
      const openPreferred = page.getByRole("button", { name: /ouvrir.*mise en page/i }).first();
      const openFallback = page.getByRole("button", { name: /creer.*mise en page/i }).first();
      if (await openPreferred.count()) await openPreferred.click().catch(() => {});
      else if (await openFallback.count()) await openFallback.click().catch(() => {});
    }
    await page.waitForTimeout(1000);
  }

  await expect(visionTab).toBeVisible({ timeout: 15000 });
}

async function uploadImage(page, file) {
  await page.locator('input[type=file][accept*="image"]').first().setInputFiles(file);
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    return canvas && canvas.width > 100 && canvas.height > 100;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(200);
}

async function openVision(page) {
  await page.getByRole("button", { name: /^vision$/i }).click();
  await expect(page.getByText("Inspirations optiques")).toBeVisible();
}

async function selectVisionBrand(page, brandName) {
  const backButton = page.getByRole("button", { name: /Retour/i }).first();
  if (await backButton.count()) await backButton.click();
  await page.getByRole("button", { name: new RegExp(brandName, "i") }).click();
  await expect(page.getByText("Safe smartphone", { exact: true })).toBeVisible();
}

async function applyVisionProfile(page, profileName) {
  const escaped = profileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const profileButton = page.getByRole("button", { name: new RegExp(`^${escaped}\\b`, "i") });
  await profileButton.click();
  await expect(profileButton).toContainText("Actif");
  await page.waitForTimeout(250);
}

async function canvasFingerprint(page) {
  return page.locator("canvas").evaluate((canvas) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const points = [
      [0.18, 0.18], [0.5, 0.18], [0.82, 0.18],
      [0.18, 0.5], [0.5, 0.5], [0.82, 0.5],
      [0.18, 0.82], [0.5, 0.82], [0.82, 0.82],
    ];
    return points.flatMap(([rx, ry]) => {
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * rx)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * ry)));
      return Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
    });
  });
}

async function canvasMetrics(page) {
  const sampled = await page.locator("canvas").evaluate((canvas) => {
    const sampleWidth = Math.max(1, Math.round(canvas.width * 0.25));
    const sampleHeight = Math.max(1, Math.round(canvas.height * 0.25));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    sampleCtx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    const imageData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight);
    return {
      width: sampleWidth,
      height: sampleHeight,
      data: Array.from(imageData.data),
    };
  });
  return measureVisionImageData(sampled, { step: 1 });
}

async function regionSaturation(page, region) {
  return page.locator("canvas").evaluate((canvas, regionArg) => {
    function rgbToHsl(r, g, b) {
      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const max = Math.max(rn, gn, bn);
      const min = Math.min(rn, gn, bn);
      const delta = max - min;
      const lightness = (max + min) / 2;
      const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
      return Math.max(0, Math.min(1, saturation || 0));
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const x = Math.round(canvas.width * regionArg.x);
    const y = Math.round(canvas.height * regionArg.y);
    const width = Math.max(1, Math.round(canvas.width * regionArg.width));
    const height = Math.max(1, Math.round(canvas.height * regionArg.height));
    const imageData = ctx.getImageData(x, y, width, height);
    let total = 0;
    let pixels = 0;
    for (let index = 0; index < imageData.data.length; index += 16) {
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      const alpha = imageData.data[index + 3];
      if (alpha === 0) continue;
      total += rgbToHsl(r, g, b);
      pixels += 1;
    }
    return pixels ? total / pixels : 0;
  }, region);
}

async function regionRgbAverage(page, region) {
  return page.locator("canvas").evaluate((canvas, regionArg) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const x = Math.round(canvas.width * regionArg.x);
    const y = Math.round(canvas.height * regionArg.y);
    const width = Math.max(1, Math.round(canvas.width * regionArg.width));
    const height = Math.max(1, Math.round(canvas.height * regionArg.height));
    const imageData = ctx.getImageData(x, y, width, height);
    let r = 0;
    let g = 0;
    let b = 0;
    let pixels = 0;
    for (let index = 0; index < imageData.data.length; index += 16) {
      const alpha = imageData.data[index + 3];
      if (alpha === 0) continue;
      r += imageData.data[index];
      g += imageData.data[index + 1];
      b += imageData.data[index + 2];
      pixels += 1;
    }
    return pixels ? { r: r / pixels, g: g / pixels, b: b / pixels } : { r: 0, g: 0, b: 0 };
  }, region);
}

function l1Distance(a, b) {
  return a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0);
}

function buildGreyVeilMetricFixture({ veiled = false } = {}) {
  const width = 64;
  const height = 32;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const t = x / (width - 1);
      const warmStripe = y < height / 2;
      let r = warmStripe ? 22 + t * 225 : 18 + t * 200;
      let g = warmStripe ? 18 + t * 178 : 22 + t * 218;
      let b = warmStripe ? 14 + t * 120 : 28 + t * 156;
      if (veiled) {
        r = 72 + (r - 72) * 0.48;
        g = 74 + (g - 74) * 0.48;
        b = 76 + (b - 76) * 0.48;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = luma + (r - luma) * 0.58;
        g = luma + (g - luma) * 0.58;
        b = luma + (b - luma) * 0.58;
      }
      data[index] = Math.round(r);
      data[index + 1] = Math.round(g);
      data[index + 2] = Math.round(b);
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

function buildSkinMetricFixture({ shifted = false } = {}) {
  const width = 72;
  const height = 36;
  const data = new Uint8ClampedArray(width * height * 4);
  const skinRows = [
    shifted ? [214, 189, 128] : [232, 177, 142],
    shifted ? [142, 113, 62] : [155, 95, 71],
    shifted ? [82, 65, 43] : [90, 53, 43],
  ];
  const distractorRows = [
    [80, 130, 206],
    [52, 118, 58],
    [136, 136, 136],
  ];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const row = Math.min(2, Math.floor(y / 12));
      const isSkinPatch = x < width / 2;
      const base = isSkinPatch ? skinRows[row] : distractorRows[row];
      const shade = 0.92 + (x % 12) / 120;
      data[index] = Math.round(base[0] * shade);
      data[index + 1] = Math.round(base[1] * shade);
      data[index + 2] = Math.round(base[2] * shade);
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

test("Vision applies a safe smartphone profile with active state and intensity reset", async ({ page }) => {
  const consoleIssues = [];
  page.on("console", (message) => {
    if (
      ["error", "warning"].includes(message.type())
      && !message.text().includes("Download the React DevTools")
      && !message.text().includes("willReadFrequently")
    ) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await openStudio(page);
  await uploadImage(page, demoImage);

  const sourceFingerprint = await canvasFingerprint(page);
  const sourceMetrics = await canvasMetrics(page);

  await openVision(page);
  await selectVisionBrand(page, "Fujifilm");

  const velviaPreview = page.getByTestId("vision-preview-fujifilm:Velvia");
  const astiaPreview = page.getByTestId("vision-preview-fujifilm:Astia");
  await expect(velviaPreview).toBeVisible({ timeout: 10000 });
  await expect(astiaPreview).toBeVisible({ timeout: 10000 });
  const velviaPreviewSrc = await velviaPreview.getAttribute("src");
  const astiaPreviewSrc = await astiaPreview.getAttribute("src");
  expect(velviaPreviewSrc).toMatch(/^data:image\/jpeg/);
  expect(astiaPreviewSrc).toMatch(/^data:image\/jpeg/);
  expect(velviaPreviewSrc).not.toEqual(astiaPreviewSrc);
  await expect(page.getByTestId("vision-image-recommendations-rail")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("vision-image-signal-tags")).toContainText(/peau|ciel|verts|basse|saturee|plate|chauds|neutres|polyvalent/i);
  const firstImageRecommendation = page.locator('[data-testid^="vision-image-recommendation-"]').first();
  await expect(firstImageRecommendation).toContainText(/%/);
  const recommendedPercent = await firstImageRecommendation.locator("span").last().innerText();
  await firstImageRecommendation.click();
  await expect(page.getByText("Actif")).toBeVisible();
  await expect(page.getByTestId("vision-intensity-number")).toHaveValue(recommendedPercent.replace("%", ""));
  await page.getByTestId("vision-undo").click();
  await expect(page.getByText("Actif")).toHaveCount(0);

  await expect(page.getByTestId("vision-profile-search")).toBeVisible();
  await page.getByTestId("vision-profile-search").fill("velvia");
  await expect(page.getByRole("button", { name: /^Velvia\b/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Astia\b/i })).toHaveCount(0);
  await page.getByTestId("vision-profile-search").fill("");

  await page.getByTestId("vision-family-landscape-vivid-safe").click();
  await expect(page.getByRole("button", { name: /^Velvia\b/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Astia\b/i })).toHaveCount(0);
  await page.getByTestId("vision-family-all").click();

  await page.getByTestId("vision-favorite-fujifilm:Velvia").click();
  await expect(page.getByTestId("vision-favorite-fujifilm:Velvia")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("vibefx.vision.favoriteProfiles") || "[]"))).toContain("fujifilm:Velvia");
  await page.getByTestId("vision-favorite-filter").click();
  await expect(page.getByRole("button", { name: /^Velvia\b/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Astia\b/i })).toHaveCount(0);
  await page.getByTestId("vision-favorite-filter").click();
  await expect(page.getByTestId("vision-favorite-compare-rail")).toBeVisible();
  await page.getByTestId("vision-favorite-fujifilm:Astia").click();
  await expect(page.getByTestId("vision-favorite-fujifilm:Astia")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("vision-favorite-compare-fujifilm:Velvia")).toBeVisible();
  await expect(page.getByTestId("vision-favorite-compare-fujifilm:Astia")).toBeVisible();
  await page.getByTestId("vision-favorite-compare-fujifilm:Astia").click();
  await expect(page.getByRole("button", { name: /^Astia\b/i })).toContainText("Actif");
  await page.getByTestId("vision-undo").click();
  await expect(page.getByText("Actif")).toHaveCount(0);

  await expect(page.getByTestId("vision-simple-controls")).toBeVisible();
  await page.getByTestId("vision-simple-warmth-number").fill("12");
  await expect(page.getByTestId("vision-simple-warmth-number")).toHaveValue("12");
  await page.getByTestId("vision-mode-expert").click();
  await expect(page.getByTestId("vision-expert-controls")).toBeVisible();
  await page.getByTestId("vision-expert-clarity-number").fill("18");
  await expect(page.getByTestId("vision-expert-clarity-number")).toHaveValue("18");
  await page.getByTestId("vision-expert-halation-number").fill("16");
  await expect(page.getByTestId("vision-expert-halation-number")).toHaveValue("16");
  await page.getByTestId("vision-expert-faded-blacks-number").fill("6");
  await expect(page.getByTestId("vision-expert-faded-blacks-number")).toHaveValue("6");
  await page.getByTestId("vision-expert-shadow-tint-number").fill("9");
  await expect(page.getByTestId("vision-expert-shadow-tint-number")).toHaveValue("9");
  await page.getByTestId("vision-expert-highlight-tint-number").fill("7");
  await expect(page.getByTestId("vision-expert-highlight-tint-number")).toHaveValue("7");
  await expect(page.getByTestId("vision-expert-tone-curve")).toBeVisible();
  await page.getByTestId("vision-expert-curve-mids-number").fill("12");
  await expect(page.getByTestId("vision-expert-curve-mids-number")).toHaveValue("12");
  await page.getByTestId("vision-expert-curve-whites-number").fill("-10");
  await expect(page.getByTestId("vision-expert-curve-whites-number")).toHaveValue("-10");
  await expect(page.getByTestId("vision-expert-curve-reset")).toBeEnabled();
  await page.getByTestId("vision-expert-curve-reset").click();
  await expect(page.getByTestId("vision-expert-curve-mids-number")).toHaveValue("0");
  await expect(page.getByTestId("vision-expert-curve-whites-number")).toHaveValue("0");
  await page.getByTestId("vision-expert-skin-saturation-number").fill("8");
  await expect(page.getByTestId("vision-expert-skin-saturation-number")).toHaveValue("8");
  await page.getByTestId("vision-expert-warm-saturation-number").fill("-14");
  await expect(page.getByTestId("vision-expert-warm-saturation-number")).toHaveValue("-14");
  await page.getByTestId("vision-expert-sky-saturation-number").fill("-12");
  await expect(page.getByTestId("vision-expert-sky-saturation-number")).toHaveValue("-12");
  await page.getByTestId("vision-expert-foliage-saturation-number").fill("-10");
  await expect(page.getByTestId("vision-expert-foliage-saturation-number")).toHaveValue("-10");
  await page.getByTestId("vision-expert-shadow-color").fill("#123456");
  await expect(page.getByTestId("vision-expert-shadow-color")).toHaveValue("#123456");
  await page.getByTestId("vision-mode-simple").click();
  await expect(page.getByTestId("vision-simple-controls")).toBeVisible();

  await applyVisionProfile(page, "Velvia");
  await expect(page.getByRole("button", { name: /^Velvia\b/i })).toContainText("Landscape Vivid Safe");
  await expect(page.getByTestId("vision-profile-intent-fujifilm:Velvia")).toContainText(/couleur paysage/i);
  await expect(page.getByTestId("vision-profile-inspiration-fujifilm:Velvia")).toContainText(/Inspire par Fujifilm/i);
  await expect(page.getByTestId("vision-profile-inspiration-fujifilm:Velvia")).toContainText(/pas reproduction exacte/i);
  await expect(page.getByTestId("vision-profile-safety-fujifilm:Velvia")).toContainText(/safeSmartphone/i);
  await expect(page.getByTestId("vision-profile-technical-fujifilm:Velvia")).toContainText(/saturation 145->120/i);
  await expect(page.getByTestId("vision-profile-intensity-fujifilm:Velvia")).toContainText(/70%/i);
  await expect(page.getByTestId("vision-recommended-intensity")).toContainText(/70%/i);
  await page.getByTestId("vision-mode-expert").click();
  await expect(page.getByTestId("vision-expert-saturation-number")).toHaveValue("120");
  await page.getByTestId("vision-mode-simple").click();
  await expect(page.getByTestId("vision-diagnostics")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("vision-diagnostics-status")).toContainText(/OK safe/i);
  await expect(page.getByTestId("vision-diagnostics-performance")).toContainText(/Perf/i);
  await expect(page.getByTestId("vision-diagnostics-performance")).toContainText(/\d+ms/i);
  await expect(page.getByTestId("vision-diagnostics-performance-detail")).toContainText(/Render src/i);
  await expect(page.getByTestId("vision-diagnostics-grey-veil")).toContainText(/Voile/i);
  await expect(page.getByTestId("vision-diagnostics-hue-zones")).toContainText(/Zones hue/i);
  const fullFingerprint = await canvasFingerprint(page);
  const fullMetrics = await canvasMetrics(page);
  const fullDelta = compareVisionMetrics(sourceMetrics, fullMetrics);
  expect(l1Distance(sourceFingerprint, fullFingerprint)).toBeGreaterThan(20);
  expect(fullDelta.greyVeilRisk).toBe(false);
  expect(fullDelta.channelClipHighDelta).toBeLessThan(0.035);
  expect(fullDelta.crushedBlackDelta).toBeLessThan(0.06);
  expect(fullDelta.highSaturationDelta).toBeLessThan(0.12);
  expect(fullDelta.skinHueShiftDeg).toBeLessThan(24);
  expect(Math.abs(fullDelta.skinSaturationDelta)).toBeLessThan(0.18);
  expect(fullDelta.protectedNeutralBiasDelta).toBeLessThan(26);

  const qualityProbe = await page.evaluate(() => window.__vibefxVisionQualityProbe?.());
  expect(qualityProbe, "Vision quality probe should be available in dev smoke").toBeTruthy();
  expect(qualityProbe.delta.greyVeilRisk).toBe(false);
  expect(Math.abs(qualityProbe.delta.meanLumaDelta)).toBeLessThan(1.5);
  expect(Math.abs(qualityProbe.delta.saturationDelta)).toBeLessThan(0.02);
  expect(Math.abs(qualityProbe.delta.highSaturationDelta)).toBeLessThan(0.025);
  expect(qualityProbe.delta.protectedNeutralBiasDelta).toBeLessThan(8);

  await page.getByTestId("vision-undo").click();
  await expect(page.getByText("Actif")).toHaveCount(0);
  await page.waitForTimeout(250);
  const undoneFingerprint = await canvasFingerprint(page);
  expect(l1Distance(fullFingerprint, undoneFingerprint)).toBeGreaterThan(8);
  await expect(page.getByTestId("vision-redo")).toBeEnabled();
  await page.getByTestId("vision-redo").click();
  await expect(page.getByRole("button", { name: /^Velvia\b/i })).toContainText("Actif");
  await page.waitForTimeout(250);
  const redoneFingerprint = await canvasFingerprint(page);
  expect(l1Distance(fullFingerprint, redoneFingerprint)).toBeLessThan(8);

  await page.getByTestId("vision-apply-recommended-intensity").click();
  await expect(page.getByTestId("vision-intensity-number")).toHaveValue("70");
  await page.getByTestId("vision-intensity-number").fill("100");
  await expect(page.getByTestId("vision-intensity-range-warning")).toContainText(/80%/i);
  await expect(page.getByTestId("vision-diagnostics-mitigation")).toContainText(/80%/i);
  await expect(page.getByTestId("vision-diagnostics-safety-actions")).toContainText(/Dose sure/i);
  await page.getByTestId("vision-apply-safety-action-dose").click();
  await expect(page.getByTestId("vision-intensity-number")).toHaveValue("80");
  await page.getByTestId("vision-intensity-number").fill("100");
  await page.getByTestId("vision-apply-diagnostics-mitigation").click();
  await expect(page.getByTestId("vision-intensity-number")).toHaveValue("80");
  await page.getByTestId("vision-intensity-number").fill("100");
  await expect(page.getByTestId("vision-intensity-range-warning")).toContainText(/80%/i);
  await page.getByTestId("vision-apply-safe-range-intensity").click();
  await expect(page.getByTestId("vision-intensity-number")).toHaveValue("80");
  await page.getByTestId("vision-intensity-number").fill("100");
  await page.waitForTimeout(250);

  await page.getByTestId("vision-custom-profile-name").fill("Golden Night Safe");
  await page.getByTestId("vision-save-profile").click();
  await expect.poll(async () => page.evaluate(() => {
    const profiles = JSON.parse(localStorage.getItem("vibefx.vision.customProfiles") || "[]");
    const favorites = JSON.parse(localStorage.getItem("vibefx.vision.favoriteProfiles") || "[]");
    return {
      name: profiles[0]?.name,
      family: profiles[0]?.family,
      isFavorite: profiles[0]?.id ? favorites.includes(profiles[0].id) : false,
    };
  })).toMatchObject({
    name: "Golden Night Safe",
    family: "Custom Safe",
    isFavorite: true,
  });
  await expect(page.getByTestId("vision-custom-profile-name")).toHaveValue("");
  await page.getByTestId("vision-profile-search").fill("golden night safe");
  await expect(page.getByRole("button", { name: /^Golden Night Safe\b/i })).toBeVisible();
  await page.locator('[data-testid^="vision-delete-custom:"]').first().click();
  await expect.poll(async () => page.evaluate(() => {
    const profiles = JSON.parse(localStorage.getItem("vibefx.vision.customProfiles") || "[]");
    const favorites = JSON.parse(localStorage.getItem("vibefx.vision.favoriteProfiles") || "[]");
    return {
      profilesCount: profiles.length,
      customFavorites: favorites.filter((item) => item.startsWith("custom:")).length,
    };
  })).toEqual({
    profilesCount: 0,
    customFavorites: 0,
  });
  await expect(page.getByRole("button", { name: /^Golden Night Safe\b/i })).toHaveCount(0);
  await page.getByTestId("vision-profile-search").fill("");

  await page.getByTestId("vision-split-toggle").click();
  await expect(page.getByTestId("vision-split-controls")).toBeVisible();
  await expect(page.getByTestId("vision-split-overlay")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("vision-split-range").fill("65");
  await expect(page.getByTestId("vision-split-range")).toHaveValue("65");

  const beforeButton = page.getByTestId("vision-before-hold");
  await beforeButton.hover();
  await page.mouse.down();
  await expect(beforeButton).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(250);
  const heldBeforeFingerprint = await canvasFingerprint(page);
  expect(l1Distance(sourceFingerprint, heldBeforeFingerprint)).toBeLessThan(8);

  await page.mouse.up();
  await expect(beforeButton).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(250);
  const restoredFingerprint = await canvasFingerprint(page);
  expect(l1Distance(fullFingerprint, restoredFingerprint)).toBeLessThan(8);

  await page.getByTestId("vision-intensity-number").fill("50");
  await page.waitForTimeout(250);
  const midFingerprint = await canvasFingerprint(page);
  expect(l1Distance(sourceFingerprint, midFingerprint)).toBeGreaterThan(10);
  expect(l1Distance(sourceFingerprint, midFingerprint)).toBeLessThan(l1Distance(sourceFingerprint, fullFingerprint));
  expect(l1Distance(fullFingerprint, midFingerprint)).toBeGreaterThan(6);

  await page.getByTestId("vision-intensity-number").fill("0");
  await page.waitForTimeout(250);
  const zeroFingerprint = await canvasFingerprint(page);
  const zeroMetrics = await canvasMetrics(page);
  const zeroDelta = compareVisionMetrics(sourceMetrics, zeroMetrics);
  expect(l1Distance(sourceFingerprint, zeroFingerprint)).toBeLessThan(8);
  expect(Math.abs(zeroDelta.meanLumaDelta)).toBeLessThan(1.2);
  expect(Math.abs(zeroDelta.saturationDelta)).toBeLessThan(0.015);
  expect(Math.abs(zeroDelta.channelClipHighDelta)).toBeLessThan(0.006);

  await page.getByRole("button", { name: /Reset Vision/i }).click({ force: true });
  await expect(page.getByText("Actif")).toHaveCount(0);
  await expect(page.getByTestId("vision-split-overlay")).toHaveCount(0);

  expect(consoleIssues).toEqual([]);
});

test("Vision caps large interactive previews while keeping full-resolution render dimensions available", async ({ page }) => {
  await openStudio(page);
  await uploadImage(page, {
    name: "vision-large-smartphone.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(largeVisionSvg),
  });

  await openVision(page);
  await selectVisionBrand(page, "Fujifilm");
  await applyVisionProfile(page, "Velvia");

  const previewCanvas = await page.locator("canvas").evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    pixels: canvas.width * canvas.height,
  }));
  expect(previewCanvas.pixels).toBeLessThanOrEqual(3050000);

  const qualityProbe = await page.evaluate(() => window.__vibefxVisionQualityProbe?.());
  expect(qualityProbe, "Vision quality probe should expose preview and full dimensions").toBeTruthy();
  expect(qualityProbe.fullWidth).toBe(4200);
  expect(qualityProbe.fullHeight).toBe(3200);
  expect(qualityProbe.previewWidth * qualityProbe.previewHeight).toBeLessThanOrEqual(3050000);
  expect(qualityProbe.isPreviewCapped).toBe(true);
  expect(qualityProbe.previewScale).toBeLessThan(1);

  await expect(page.getByTestId("vision-diagnostics-performance-detail")).toContainText(/preview/i);
  await expect(page.getByTestId("vision-diagnostics-performance-detail")).toContainText(/cap/i);
});

test("Vision metrics detect grey veil from lifted shadows and compressed range", async () => {
  const sourceMetrics = measureVisionImageData(buildGreyVeilMetricFixture(), { step: 1 });
  const veiledMetrics = measureVisionImageData(buildGreyVeilMetricFixture({ veiled: true }), { step: 1 });
  const delta = compareVisionMetrics(sourceMetrics, veiledMetrics);
  expect(delta.greyVeilRisk).toBe(true);
  expect(delta.greyVeilScore).toBeGreaterThan(0.52);
  expect(delta.tonalRangeRatio).toBeLessThan(0.72);
  expect(delta.shadowLiftDelta).toBeGreaterThan(8);
  expect(delta.saturationRatio).toBeLessThan(0.9);
});

test("Vision metrics keep skin samples across light, medium and dark tones", async () => {
  const sourceMetrics = measureVisionImageData(buildSkinMetricFixture(), { step: 1 });
  const shiftedMetrics = measureVisionImageData(buildSkinMetricFixture({ shifted: true }), { step: 1 });
  const delta = compareVisionMetrics(sourceMetrics, shiftedMetrics);
  expect(sourceMetrics.skinToneRatio).toBeGreaterThan(0.24);
  expect(shiftedMetrics.skinToneRatio).toBeGreaterThan(0.18);
  expect(delta.skinHueShiftDeg).toBeGreaterThan(8);
  expect(delta.skinToneRatioDelta).toBeGreaterThan(-0.16);
});

test("Vision guardrails keep synthetic smartphone-like colors usable across risky profiles", async ({ page }) => {
  await openStudio(page);
  await uploadImage(page, {
    name: "vision-synthetic-smartphone.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(syntheticVisionSvg),
  });

  const sourceMetrics = await canvasMetrics(page);
  await openVision(page);

  const profileChecks = [
    { brand: "Fujifilm", profile: "Velvia" },
    { brand: "Kodak", profile: "Ektar 100" },
    { brand: "Leica", profile: "Sepia" },
  ];

  for (const check of profileChecks) {
    await selectVisionBrand(page, check.brand);
    await applyVisionProfile(page, check.profile);
    if (check.profile === "Velvia") {
      await expect(page.getByTestId("vision-active-content-warnings")).toContainText(/saturee|peau|ombres|neutres/i, { timeout: 10000 });
      await expect(page.getByTestId("vision-apply-content-safe-alternative")).toBeVisible();
      await expect(page.getByTestId("vision-diagnostics-safety-actions")).toContainText(/Calmer chroma|Proteger peau|Nettoyer neutres|Ouvrir ombres/i);
    }
    const metrics = await canvasMetrics(page);
    const delta = compareVisionMetrics(sourceMetrics, metrics);
    expect(delta.greyVeilRisk, `${check.brand} ${check.profile} should not create grey veil`).toBe(false);
    expect(delta.channelClipHighDelta, `${check.brand} ${check.profile} highlight clipping`).toBeLessThan(0.08);
    expect(delta.channelClipLowDelta, `${check.brand} ${check.profile} black clipping`).toBeLessThan(0.12);
    expect(delta.highSaturationDelta, `${check.brand} ${check.profile} high saturation growth`).toBeLessThan(0.2);
    expect(Math.abs(delta.neutralChromaDelta), `${check.brand} ${check.profile} neutral pollution`).toBeLessThan(24);
    expect(delta.protectedNeutralBiasDelta, `${check.brand} ${check.profile} protected neutral bias`).toBeLessThan(28);
    expect(delta.skinHueShiftDeg, `${check.brand} ${check.profile} skin hue shift`).toBeLessThan(26);
    expect(Math.abs(delta.skinSaturationDelta), `${check.brand} ${check.profile} skin saturation shift`).toBeLessThan(0.2);
    expect(delta.skyClipHighDelta, `${check.brand} ${check.profile} sky clipping`).toBeLessThan(0.08);
    expect(delta.skyHighSaturationDelta, `${check.brand} ${check.profile} sky high saturation growth`).toBeLessThan(0.24);
    expect(delta.foliageHighSaturationDelta, `${check.brand} ${check.profile} foliage high saturation growth`).toBeLessThan(0.24);
    expect(delta.warmClipHighDelta, `${check.brand} ${check.profile} warm red/orange clipping`).toBeLessThan(0.08);
    expect(delta.warmHighSaturationDelta, `${check.brand} ${check.profile} warm high saturation growth`).toBeLessThan(0.24);
  }
});

test("Vision selective saturation targets skin, warm, sky and foliage regions", async ({ page }) => {
  await openStudio(page);
  await uploadImage(page, {
    name: "vision-selective-saturation.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(syntheticVisionSvg),
  });

  await openVision(page);
  await selectVisionBrand(page, "Fujifilm");
  await page.getByTestId("vision-mode-expert").click();

  const regions = {
    sky: { x: 0.08, y: 0.05, width: 0.82, height: 0.14 },
    neutral: { x: 0.08, y: 0.29, width: 0.82, height: 0.06 },
    foliage: { x: 0.04, y: 0.46, width: 0.26, height: 0.16 },
    skin: { x: 0.37, y: 0.46, width: 0.28, height: 0.18 },
    warm: { x: 0.05, y: 0.75, width: 0.24, height: 0.1 },
  };

  const base = {
    sky: await regionSaturation(page, regions.sky),
    neutral: await regionSaturation(page, regions.neutral),
    foliage: await regionSaturation(page, regions.foliage),
    skin: await regionSaturation(page, regions.skin),
    warm: await regionSaturation(page, regions.warm),
  };
  const baseRgb = {
    neutral: await regionRgbAverage(page, regions.neutral),
    warm: await regionRgbAverage(page, regions.warm),
  };

  await page.getByTestId("vision-expert-skin-saturation-number").fill("15");
  await page.waitForTimeout(200);
  const skinBoost = {
    skin: await regionSaturation(page, regions.skin),
    neutral: await regionSaturation(page, regions.neutral),
  };
  expect(skinBoost.skin).toBeGreaterThan(base.skin + 0.008);
  expect(Math.abs(skinBoost.neutral - base.neutral)).toBeLessThan(0.012);

  await page.getByRole("button", { name: /Reset Vision/i }).click();
  await page.getByTestId("vision-mode-expert").click();
  await page.getByTestId("vision-expert-warm-saturation-number").fill("-30");
  await page.waitForTimeout(200);
  const warmPull = {
    warm: await regionSaturation(page, regions.warm),
    neutral: await regionSaturation(page, regions.neutral),
    skin: await regionSaturation(page, regions.skin),
  };
  expect(warmPull.warm).toBeLessThan(base.warm - 0.015);
  expect(Math.abs(warmPull.neutral - base.neutral)).toBeLessThan(0.012);
  expect(Math.abs(warmPull.skin - base.skin)).toBeLessThan(0.025);

  await page.getByRole("button", { name: /Reset Vision/i }).click();
  await page.getByTestId("vision-mode-expert").click();
  await page.getByTestId("vision-expert-sky-saturation-number").fill("-30");
  await page.waitForTimeout(200);
  const skyPull = {
    sky: await regionSaturation(page, regions.sky),
    neutral: await regionSaturation(page, regions.neutral),
  };
  expect(skyPull.sky).toBeLessThan(base.sky - 0.015);
  expect(Math.abs(skyPull.neutral - base.neutral)).toBeLessThan(0.012);

  await page.getByRole("button", { name: /Reset Vision/i }).click();
  await page.getByTestId("vision-mode-expert").click();
  await page.getByTestId("vision-expert-foliage-saturation-number").fill("-30");
  await page.waitForTimeout(200);
  const foliagePull = {
    foliage: await regionSaturation(page, regions.foliage),
    neutral: await regionSaturation(page, regions.neutral),
  };
  expect(foliagePull.foliage).toBeLessThan(base.foliage - 0.015);
  expect(Math.abs(foliagePull.neutral - base.neutral)).toBeLessThan(0.012);

  await page.getByRole("button", { name: /Reset Vision/i }).click();
  await page.getByTestId("vision-mode-simple").click();
  await page.getByTestId("vision-simple-warmth-number").fill("22");
  await page.waitForTimeout(200);
  const warmedRgb = {
    neutral: await regionRgbAverage(page, regions.neutral),
    warm: await regionRgbAverage(page, regions.warm),
  };
  const neutralBiasDelta = Math.abs((warmedRgb.neutral.r - warmedRgb.neutral.b) - (baseRgb.neutral.r - baseRgb.neutral.b));
  const neutralBlueDelta = Math.abs(warmedRgb.neutral.b - baseRgb.neutral.b);
  const warmBlueDelta = Math.abs(warmedRgb.warm.b - baseRgb.warm.b);
  expect(neutralBiasDelta).toBeLessThan(8);
  expect(neutralBlueDelta).toBeLessThan(warmBlueDelta);
});

test("Vision halation protects neutral white highlights while keeping colored glow", async ({ page }) => {
  await openStudio(page);
  await uploadImage(page, {
    name: "vision-halation.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(syntheticVisionSvg),
  });
  await openVision(page);
  await selectVisionBrand(page, "Fujifilm");

  const regions = {
    neon: { x: 0.72, y: 0.48, width: 0.23, height: 0.16 },
    whiteHighlight: { x: 0.805, y: 0.748, width: 0.07, height: 0.1 },
  };
  const base = {
    neon: await regionRgbAverage(page, regions.neon),
    whiteHighlight: await regionRgbAverage(page, regions.whiteHighlight),
  };

  await page.getByTestId("vision-mode-expert").click();
  await page.getByTestId("vision-expert-halation-number").fill("32");
  await page.waitForTimeout(250);

  const halated = {
    neon: await regionRgbAverage(page, regions.neon),
    whiteHighlight: await regionRgbAverage(page, regions.whiteHighlight),
  };
  const whiteRedDelta = halated.whiteHighlight.r - base.whiteHighlight.r;
  const neonRedDelta = halated.neon.r - base.neon.r;
  const whiteWarmBiasDelta = Math.abs((halated.whiteHighlight.r - halated.whiteHighlight.b) - (base.whiteHighlight.r - base.whiteHighlight.b));

  expect(whiteRedDelta).toBeLessThan(6);
  expect(whiteWarmBiasDelta).toBeLessThan(7);
  expect(neonRedDelta).toBeGreaterThan(whiteRedDelta);
});

test("Vision safe global tint protects neutral pixels while tinting colored pixels", async () => {
  const source = new Uint8ClampedArray([
    220, 220, 220, 255,
    255, 43, 120, 255,
  ]);
  let output;
  const ctx = {
    getImageData: () => ({ data: new Uint8ClampedArray(source) }),
    putImageData: (imageData) => { output = imageData.data; },
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    set globalCompositeOperation(value) { this._globalCompositeOperation = value; },
    set fillStyle(value) { this._fillStyle = value; },
    set globalAlpha(value) { this._globalAlpha = value; },
  };

  applySafeGlobalTint(ctx, 2, 1, "#004968", 30, true);

  const neutral = { r: output[0], g: output[1], b: output[2] };
  const colored = { r: output[4], g: output[5], b: output[6] };
  const neutralBiasDelta = Math.abs((neutral.b - neutral.r) - (source[2] - source[0]));
  const coloredBiasDelta = Math.abs((colored.b - colored.r) - (source[6] - source[4]));
  const neutralBlueDelta = Math.abs(neutral.b - source[2]);
  const coloredBlueDelta = Math.abs(colored.b - source[6]);

  expect(neutralBiasDelta).toBeLessThan(5);
  expect(neutralBlueDelta).toBeLessThan(coloredBlueDelta);
  expect(coloredBiasDelta).toBeGreaterThan(neutralBiasDelta);
});

test("Vision remains usable on mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStudio(page);
  await uploadImage(page, demoImage);
  await openVision(page);
  await selectVisionBrand(page, "Fujifilm");
  await applyVisionProfile(page, "Velvia");

  await expect(page.getByTestId("vision-before-hold")).toBeVisible();
  await expect(page.getByTestId("vision-intensity-range")).toBeVisible();

  const overflow = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = document.documentElement.clientWidth;
    const overflowingElements = Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -2 || rect.right > viewportWidth + 2);
      })
      .slice(0, 5)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        text: element.textContent?.trim().slice(0, 80),
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
      }));

    return {
      documentWidth,
      viewportWidth,
      overflowingElements,
    };
  });

  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 2);
  expect(overflow.overflowingElements).toEqual([]);
});
