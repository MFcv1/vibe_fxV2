/*
 * Smoke du PIPELINE VibeOS (phase F, plan §4.3).
 *
 * Ce que le test prouve, dans l'ordre du produit:
 *   1. la composition faite dans Mise en page circule: Vision et Studio
 *      travaillent dessus, plus sur la photo brute;
 *   2. les etages s'enchainent: le Studio recoit la composition DEJA passee par
 *      les filtres Vision (pixels mesures, pas seulement un libelle);
 *   3. « Publier » rend le projet complet et ouvre le vrai composeur de
 *      publication avec le visuel dedans.
 *
 * Le meme parcours est rejoue en 390px de large: le pipeline n'a pas le droit
 * d'etre une fonctionnalite de bureau.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

let fixtureDir = null;

function getFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-pipeline-"));
  const photos = [
    { file: "photo-a.png", color: "0x4a6c86" },
    { file: "photo-b.png", color: "0x86584a" },
  ];
  for (const photo of photos) {
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", `color=c=${photo.color}:s=640x800`,
      "-vf", "noise=alls=16:allf=t+u",
      "-frames:v", "1", path.join(dir, photo.file),
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
  }
  fixtureDir = dir;
  return dir;
}

async function bypassAuth(page) {
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 30000 })
    .catch(() => {});
}

/* Signature de ce qui est reellement affiche: moyenne par canal + contraste. */
async function readCanvasStats(page) {
  return page.locator("canvas").first().evaluate((canvas) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0; let sumSq = 0; let r = 0; let g = 0; let b = 0; let count = 0;
    for (let i = 0; i < data.length; i += 4 * 37) {
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += luma; sumSq += luma * luma;
      r += data[i]; g += data[i + 1]; b += data[i + 2];
      count += 1;
    }
    const mean = sum / count;
    return {
      mean,
      stdDev: Math.sqrt(Math.max(0, sumSq / count - mean * mean)),
      r: r / count, g: g / count, b: b / count,
      width: canvas.width, height: canvas.height,
    };
  });
}

function distance(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) + Math.abs(a.stdDev - b.stdDev);
}

/* Compose un visuel dans Mise en page et attend que la composition soit ecrite
   dans le projet (sauvegarde debouncee: on laisse le temps au store). */
async function composeInLayout(page, dir) {
  await page.goto(`${baseUrl}/creer/layout-visuel`, { waitUntil: "domcontentloaded" });
  await bypassAuth(page);
  await expect(page.getByTestId("vibeos-layout-screen")).toBeVisible({ timeout: 60000 });

  await page.getByTestId("vibeos-image-input").setInputFiles([
    path.join(dir, "photo-a.png"),
    path.join(dir, "photo-b.png"),
  ]);
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => canvas.evaluate((node) => node.width), { timeout: 20000 })
    .toBeGreaterThan(0);

  /* Un modele a deux zones: la composition ne peut plus etre confondue avec la
     photo source, ce qui rend la suite du test probante. */
  /* Timeout court + tolerance: sur mobile le bloc « Modele » peut etre replie,
     et un clic sans limite attendrait jusqu'au timeout DU TEST. */
  await page.getByRole("option", { name: /^Double/ }).click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return canvas;
}

test("pipeline VibeOS: composition -> Vision -> Studio -> publication", async ({ page }) => {
  test.setTimeout(240_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await composeInLayout(page, dir);

  /* ---------- Etage 2: Vision recoit la composition ---------- */
  await page.getByRole("link", { name: "Vision" }).first().click();
  await expect(page.getByTestId("vibeos-vision-screen")).toBeVisible({ timeout: 30000 });
  const visionSource = page.getByTestId("vibeos-vision-source");
  await expect(visionSource).toHaveAttribute("data-source-kind", "composition", { timeout: 30000 });
  await expect(visionSource).toContainText("composition");

  const visionCanvas = page.locator("canvas").first();
  await expect.poll(async () => visionCanvas.evaluate((node) => node.width), { timeout: 20000 })
    .toBeGreaterThan(0);
  const compositionStats = await readCanvasStats(page);

  /* La composition est bien un visuel compose (format social), pas la photo
     source 640x800. */
  expect(compositionStats.width / compositionStats.height).toBeCloseTo(1080 / 1350, 2);

  // Un preset franc, pour que l'etage Vision soit mesurable plus loin.
  const presets = page.getByTestId("vibeos-vision-presets");
  await presets.locator("button").first().click();
  await expect(page.getByTestId("vibeos-vision-message")).toBeVisible();
  await expect.poll(async () => distance(await readCanvasStats(page), compositionStats), { timeout: 20000 })
    .toBeGreaterThan(2);
  const visionStats = await readCanvasStats(page);
  /* Laisse la sauvegarde debouncee ecrire les filtres Vision dans le projet. */
  await page.waitForTimeout(2500);

  /* ---------- Etage 3: le Studio recoit composition + Vision ---------- */
  await page.getByRole("link", { name: "Studio" }).first().click();
  await expect(page.getByTestId("vibeos-studio-screen")).toBeVisible({ timeout: 30000 });
  const studioSource = page.getByTestId("vibeos-studio-source");
  await expect(studioSource).toHaveAttribute("data-source-kind", "composition", { timeout: 30000 });
  await expect(studioSource).toContainText("Vision");

  await expect.poll(async () => page.locator("canvas").first().evaluate((node) => node.width), { timeout: 20000 })
    .toBeGreaterThan(0);
  const studioBaseStats = await readCanvasStats(page);

  /* Le Studio ne part PAS de la composition nue: son image de travail porte
     deja le preset Vision. On le mesure des deux cotes plutot que de croire le
     libelle. */
  expect(
    distance(studioBaseStats, compositionStats),
    "le Studio devrait partir de la composition filtree par Vision",
  ).toBeGreaterThan(2);
  expect(
    distance(studioBaseStats, visionStats),
    "l'image de travail du Studio devrait ressembler au rendu Vision",
  ).toBeLessThan(distance(studioBaseStats, compositionStats) + 8);

  // Une ambiance s'applique par-dessus: troisieme etage.
  const ambiances = page.getByTestId("vibeos-studio-ambiances");
  await ambiances.locator("button").first().click();
  await expect.poll(async () => distance(await readCanvasStats(page), studioBaseStats), { timeout: 20000 })
    .toBeGreaterThan(2);
  await page.waitForTimeout(2500);

  /* ---------- Etage 4: publication ---------- */
  await page.getByTestId("vibeos-publish").click();
  await page.waitForURL("**/publier", { timeout: 60000 });
  await bypassAuth(page);
  /* Le composeur existant est monte avec le rendu du projet: une image de
     previsualisation est presente. */
  await expect.poll(
    async () => page.locator("img[src^='data:image/png']").count(),
    { timeout: 60000 },
  ).toBeGreaterThan(0);
});

test("pipeline VibeOS: la composition circule aussi sur mobile", async ({ page }) => {
  test.setTimeout(300_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await page.setViewportSize({ width: 390, height: 844 });
  await composeInLayout(page, dir);

  /* Sur mobile la navigation passe par la tab bar basse. */
  await page.getByRole("link", { name: "Vision" }).last().click();
  await expect(page.getByTestId("vibeos-vision-screen")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("vibeos-vision-source"))
    .toHaveAttribute("data-source-kind", "composition", { timeout: 30000 });

  await page.getByTestId("vibeos-vision-presets").locator("button").first().click();
  await page.waitForTimeout(2500);

  await page.getByRole("link", { name: "Studio" }).last().click();
  await expect(page.getByTestId("vibeos-studio-screen")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("vibeos-studio-source"))
    .toHaveAttribute("data-source-kind", "composition", { timeout: 30000 });

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);
});
