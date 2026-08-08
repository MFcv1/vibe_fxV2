/*
 * Smoke de l'ecran Studio VibeOS (/creer/studio, phase D).
 *
 * Deux tests:
 *  1. Parcours reel: import -> ambiances rendues sur la vraie image ->
 *     application d'une ambiance -> curseur d'intensite -> « Surprends-moi » ->
 *     variantes cliquables -> comparaison avant/apres -> fond genere en Sheet ->
 *     reglages avances (garde-fous, recadrage, style perso).
 *  2. Critere de la phase D: sur 3 photos types, les 10 ambiances produisent des
 *     rendus REELLEMENT differents les uns des autres, et aucune ne donne une
 *     image grise, noire ou cramee.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

const AMBIANCE_COUNT = 10;

/* Memes fixtures que le smoke Vision: chacune vise un signal precis de
   `visionMetrics` (teinte peau, ciel/verdure, nuit). */
const PHOTOS = [
  { id: "portrait", file: "portrait.png", filter: "color=c=0xd8a880:s=480x600" },
  { id: "paysage", file: "paysage.png", filter: "color=c=0x4a90d9:s=600x400" },
  {
    id: "nuit",
    file: "nuit.png",
    filter: "color=c=0x101828:s=600x400",
    extraFilter:
      "drawbox=x=400:y=80:w=110:h=110:color=0xffd08a@0.95:t=fill,drawbox=x=90:y=250:w=70:h=70:color=0x66d9ff@0.8:t=fill,gblur=sigma=14",
  },
];

let fixtureDir = null;

function getFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-studio-"));
  for (const photo of PHOTOS) {
    const result = spawnSync(
      ffmpegPath,
      [
        "-y", "-f", "lavfi", "-i", photo.filter,
        "-vf", [photo.extraFilter, "noise=alls=18:allf=t+u", "gradfun"].filter(Boolean).join(","),
        "-frames:v", "1", path.join(dir, photo.file),
      ],
      { encoding: "utf8" },
    );
    if (result.status !== 0) return null;
  }
  fixtureDir = dir;
  return dir;
}

async function openStudioScreen(page) {
  await page.goto(`${baseUrl}/creer/studio`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 30000 })
    .catch(() => {});
  await expect(page.getByTestId("vibeos-studio-screen")).toBeVisible({ timeout: 30000 });
}

/* Signature de l'image affichee: moyenne et ecart-type de luminance, plus la
   moyenne par canal. Sert a dire « l'image a change », « l'image n'est pas
   grise » et « ces deux ambiances ne donnent pas le meme resultat ». */
async function readCanvasStats(page) {
  return page.locator("canvas").first().evaluate((canvas) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    let sumSq = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4 * 37) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += luma;
      sumSq += luma * luma;
      sumR += r;
      sumG += g;
      sumB += b;
      count += 1;
    }
    const mean = sum / count;
    return {
      mean,
      stdDev: Math.sqrt(Math.max(0, sumSq / count - mean * mean)),
      r: sumR / count,
      g: sumG / count,
      b: sumB / count,
    };
  });
}

function signatureDistance(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) + Math.abs(a.stdDev - b.stdDev);
}

test("studio VibeOS: ambiances, intensite, surprise, variantes, avance", async ({ page }) => {
  test.setTimeout(150_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openStudioScreen(page);

  // Etat vide honnete.
  await expect(page.getByRole("button", { name: "Importer une image" })).toBeVisible();
  await page.getByTestId("vibeos-studio-input").setInputFiles(path.join(dir, "portrait.png"));

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => canvas.evaluate((node) => node.width), { timeout: 15000 })
    .toBeGreaterThan(0);

  // Les 10 ambiances sont rendues sur la VRAIE image (vignettes en <img>).
  const grid = page.getByTestId("vibeos-studio-ambiances");
  await expect(grid.locator("button")).toHaveCount(AMBIANCE_COUNT);
  await expect.poll(async () => grid.locator("img").count(), { timeout: 25000 })
    .toBeGreaterThan(5);

  // Application d'une ambiance: message humain + pixels reellement modifies.
  const original = await readCanvasStats(page);
  const firstAmbiance = grid.locator("button").first();
  const firstName = (await firstAmbiance.innerText()).split("\n")[0];
  await firstAmbiance.click();
  const message = page.getByTestId("vibeos-studio-message");
  await expect(message).toContainText(firstName);
  await expect.poll(async () => {
    const after = await readCanvasStats(page);
    return signatureDistance(after, original);
  }, { timeout: 15000 }).toBeGreaterThan(1);

  // Intensite: a 0, le rendu revient a l'image d'origine.
  const intensity = page.getByRole("slider", { name: "Intensité" });
  await intensity.fill("0");
  await expect.poll(async () => {
    const stats = await readCanvasStats(page);
    return Math.abs(stats.mean - original.mean);
  }, { timeout: 15000 }).toBeLessThan(1.5);
  await intensity.fill("80");

  // Une variante a ete enregistree pour cette ambiance.
  const variants = page.getByTestId("vibeos-studio-variants");
  await expect(variants.locator("button")).toHaveCount(1);

  // « Surprends-moi »: tirage annonce + nouvelle variante.
  await page.getByTestId("vibeos-studio-surprise").click();
  await expect(message).toContainText("Tirage");
  await expect(variants.locator("button")).toHaveCount(2);

  // Retour sur la premiere variante: reapplication instantanee.
  await variants.locator("button").last().click();
  await expect(message).toContainText("réappliquée");

  // Comparaison: maintien = image d'origine.
  const compare = page.getByRole("button", { name: /Comparer avec l'original/ });
  const box = await compare.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId("vibeos-studio-compare")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("vibeos-studio-compare")).toBeHidden();

  // Fond genere: le Sheet Mesh partage applique une palette a la composition.
  await page.getByTestId("vibeos-studio-mesh").click();
  const meshSheet = page.getByRole("dialog", { name: "Fond Mesh gradient" });
  await expect(meshSheet).toBeVisible();
  await meshSheet.getByRole("button", { name: "Utiliser comme fond" }).click();
  await expect(page.getByTestId("vibeos-studio-mesh-preview")).toBeVisible();

  // Avances: garde-fous actifs par defaut, recadrage, style perso.
  await page.getByRole("button", { name: "Réglages avancés" }).click();
  await expect(page.getByRole("tab", { name: "Actifs" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Carré" }).click();
  await expect.poll(async () => canvas.evaluate((node) => node.width === node.height), { timeout: 15000 })
    .toBe(true);

  await page.getByTestId("vibeos-studio-style-name").fill("Mon look");
  await page.getByTestId("vibeos-studio-style-save").click();
  await expect(grid.locator("button")).toHaveCount(AMBIANCE_COUNT + 1);
  await expect(grid.locator("button").first()).toContainText("Mon look");
  const stored = await page.evaluate(() => window.localStorage.getItem("vibeos.studio.customStyles"));
  expect(stored).toContain("Mon look");

  // Garde anti-scroll desktop, panneau avance deplie.
  const pageScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(pageScrollable).toBe(false);

  // Mobile: l'ecran reste utilisable et ne deborde jamais horizontalement.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("vibeos-studio-screen")).toBeVisible();
  await expect(grid.locator("button").first()).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);
});

test("studio VibeOS: 10 ambiances distinctes et jamais cassees", async ({ page }) => {
  test.setTimeout(240_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openStudioScreen(page);
  const grid = page.getByTestId("vibeos-studio-ambiances");

  for (const photo of PHOTOS) {
    await page.getByTestId("vibeos-studio-input").setInputFiles(path.join(dir, photo.file));
    await expect.poll(
      async () => page.locator("canvas").first().evaluate((node) => node.width),
      { timeout: 20000 },
    ).toBeGreaterThan(0);
    await expect(grid.locator("button")).toHaveCount(AMBIANCE_COUNT);

    const signatures = [];
    for (let index = 0; index < AMBIANCE_COUNT; index += 1) {
      const tile = grid.locator("button").nth(index);
      const label = (await tile.innerText()).split("\n")[0];
      await tile.click();
      /* Le rendu passe par requestAnimationFrame: on laisse le canvas se
         stabiliser avant de mesurer. */
      await page.waitForTimeout(140);
      const stats = await readCanvasStats(page);
      const context = `${photo.id} / ${label}`;
      expect(stats.mean, `${context}: image trop sombre`).toBeGreaterThan(8);
      expect(stats.mean, `${context}: image cramee`).toBeLessThan(247);
      expect(stats.stdDev, `${context}: image plate/grise`).toBeGreaterThan(1.5);
      signatures.push({ label, stats });
    }

    /* Une ambiance qui rend comme sa voisine ne sert a rien: on verifie que les
       10 bundles donnent bien 10 rendus distincts. */
    for (let i = 0; i < signatures.length; i += 1) {
      for (let j = i + 1; j < signatures.length; j += 1) {
        const distance = signatureDistance(signatures[i].stats, signatures[j].stats);
        expect(
          distance,
          `${photo.id}: « ${signatures[i].label} » et « ${signatures[j].label} » rendent pareil`,
        ).toBeGreaterThan(6);
      }
    }
  }
});
