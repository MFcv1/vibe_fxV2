/*
 * Smoke de l'ecran Vision VibeOS (/creer/vision, phase C).
 *
 * Deux tests:
 *  1. Parcours reel: import -> « Ameliorer ma photo » (phrase humaine + pixels
 *     qui changent) -> intensite -> application d'un look -> comparaison
 *     avant/apres -> garde-fous smartphone -> bibliotheque par marque.
 *  2. Critere du plan §6 (phase C): sur 5 photos types (portrait, paysage,
 *     nuit, plate, deja saturee), AUCUN des 12 looks ne produit d'image grise
 *     ou cassee, et le tri ne recommande pas la meme chose pour toutes.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

/*
 * Photos de test fabriquees avec ffmpeg. Chacune vise un signal precis de
 * `visionMetrics`: teinte peau, ciel+verdure, nuit, image plate, saturation
 * deja poussee.
 */
const PHOTOS = [
  { id: "portrait", file: "portrait.png", filter: "color=c=0xd8a880:s=480x600" },
  { id: "paysage", file: "paysage.png", filter: "color=c=0x4a90d9:s=600x400" },
  {
    id: "nuit",
    file: "nuit.png",
    filter: "color=c=0x101828:s=600x400",
    /* Une vraie photo de nuit a des sources lumineuses: sans elles, la mesure
       ne teste qu'un rectangle noir. */
    extraFilter: "drawbox=x=400:y=80:w=110:h=110:color=0xffd08a@0.95:t=fill,drawbox=x=90:y=250:w=70:h=70:color=0x66d9ff@0.8:t=fill,gblur=sigma=14",
  },
  { id: "plate", file: "plate.png", filter: "color=c=0x8a8f92:s=600x400" },
  { id: "saturee", file: "saturee.png", filter: "color=c=0xff1e00:s=600x400" },
];

let fixtureDir = null;

function getFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-vision-"));
  for (const photo of PHOTOS) {
    /* Un degrade + du bruit leger: une aplat pur n'a aucune plage tonale et ne
       represente aucune photo reelle. */
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", photo.filter,
      "-vf", [photo.extraFilter, "noise=alls=18:allf=t+u", "gradfun"].filter(Boolean).join(","),
      "-frames:v", "1", path.join(dir, photo.file),
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
  }
  fixtureDir = dir;
  return dir;
}

async function openVisionScreen(page) {
  await page.goto(`${baseUrl}/creer/vision`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 30000 })
    .catch(() => {});
  await expect(page.getByTestId("vibeos-vision-screen")).toBeVisible({ timeout: 30000 });
}

/* Signature de l'image affichee: moyenne + ecart-type par canal. Sert a dire
   « l'image a change » et « l'image n'est pas grise/plate ». */
async function readCanvasStats(page) {
  return page.locator("canvas").first().evaluate((canvas) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    let maxChannelSpread = 0;
    for (let i = 0; i < data.length; i += 4 * 37) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += luma;
      sumSq += luma * luma;
      count += 1;
      maxChannelSpread = Math.max(maxChannelSpread, Math.max(r, g, b) - Math.min(r, g, b));
    }
    const mean = sum / count;
    return {
      mean,
      stdDev: Math.sqrt(Math.max(0, sumSq / count - mean * mean)),
      maxChannelSpread,
    };
  });
}

test("vision VibeOS: analyse, amelioration, look, comparaison", async ({ page }) => {
  test.setTimeout(120_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openVisionScreen(page);

  // Etat vide honnete.
  await expect(page.getByRole("button", { name: "Importer une photo" })).toBeVisible();
  await page.getByTestId("vibeos-vision-input").setInputFiles(path.join(dir, "portrait.png"));

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => canvas.evaluate((node) => node.width), { timeout: 15000 })
    .toBeGreaterThan(0);

  // Les 12 looks sont rendus sur la VRAIE photo (vignettes en <img>).
  const lookGrid = page.getByTestId("vibeos-vision-looks");
  await expect(lookGrid.locator("button")).toHaveCount(12);
  await expect.poll(async () => lookGrid.locator("img").count(), { timeout: 20000 })
    .toBeGreaterThan(6);

  // « Ameliorer ma photo »: phrase humaine + pixels reellement modifies.
  const before = await readCanvasStats(page);
  await page.getByTestId("vibeos-vision-auto").click();
  const message = page.getByTestId("vibeos-vision-message");
  await expect(message).toBeVisible();
  await expect(message).toContainText(/j’ai|j'ai/);
  await expect.poll(async () => {
    const after = await readCanvasStats(page);
    return Math.abs(after.mean - before.mean) + Math.abs(after.stdDev - before.stdDev);
  }, { timeout: 15000 }).toBeGreaterThan(0.5);

  // Intensite: a 0, le rendu revient a l'original.
  const intensity = page.getByRole("slider", { name: "Intensité" });
  await expect(intensity).toHaveValue("80");
  await intensity.fill("0");
  await expect.poll(async () => {
    const stats = await readCanvasStats(page);
    return Math.abs(stats.mean - before.mean);
  }, { timeout: 15000 }).toBeLessThan(1.5);
  await intensity.fill("80");

  // Application d'un look: la carte devient active et l'image change encore.
  const firstLook = lookGrid.locator("button").first();
  const lookName = (await firstLook.innerText()).split("\n")[0];
  await firstLook.click();
  await expect(message).toContainText(lookName);

  // Comparaison: maintien = photo d'origine.
  const compare = page.getByRole("button", { name: /Comparer avec l'original/ });
  const compareBox = await compare.boundingBox();
  await page.mouse.move(compareBox.x + compareBox.width / 2, compareBox.y + compareBox.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId("vibeos-vision-compare")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("vibeos-vision-compare")).toBeHidden();

  // Avances: garde-fous actifs par defaut, bibliotheque complete accessible.
  await page.getByRole("button", { name: "Réglages avancés" }).click();
  const guards = page.getByRole("tab", { name: "Actifs" });
  await expect(guards).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Parcourir par marque" }).click();
  const library = page.getByRole("dialog", { name: "Bibliothèque de profils" });
  await expect(library).toBeVisible();
  await expect(library.getByRole("button", { name: /Velvia/ })).toBeVisible();
  await library.getByRole("button", { name: "Fermer" }).click();

  // Garde anti-scroll desktop, panneau avance deplie.
  const pageScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(pageScrollable).toBe(false);
});

test("vision VibeOS: 12 looks surs sur 5 photos types", async ({ page }) => {
  test.setTimeout(240_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openVisionScreen(page);

  const lookGrid = page.getByTestId("vibeos-vision-looks");
  const recommendations = {};

  for (const photo of PHOTOS) {
    await page.getByTestId("vibeos-vision-input").setInputFiles(path.join(dir, photo.file));
    await expect.poll(
      async () => page.locator("canvas").first().evaluate((node) => node.width),
      { timeout: 20000 },
    ).toBeGreaterThan(0);
    await expect(lookGrid.locator("button")).toHaveCount(12);

    // Le premier look propose pour cette photo (le mieux note).
    recommendations[photo.id] = (await lookGrid.locator("button").first().innerText()).split("\n")[0];

    // Chaque look est applique, puis mesure: ni gris plat, ni ecrase.
    for (let index = 0; index < 12; index += 1) {
      await lookGrid.locator("button").nth(index).click();
      const label = (await lookGrid.locator("button").nth(index).innerText()).split("\n")[0];
      /* Le rendu passe par requestAnimationFrame: on attend que le canvas se
         stabilise avant de mesurer. */
      await page.waitForTimeout(120);
      const stats = await readCanvasStats(page);
      const context = `${photo.id} / ${label}`;
      expect(stats.mean, `${context}: image trop sombre`).toBeGreaterThan(8);
      expect(stats.mean, `${context}: image cramee`).toBeLessThan(247);
      expect(stats.stdDev, `${context}: image plate/grise`).toBeGreaterThan(1.5);
    }
  }

  // Le tri doit vraiment dependre de la photo, pas proposer la meme chose.
  const distinct = new Set(Object.values(recommendations));
  expect(distinct.size, `recommandations: ${JSON.stringify(recommendations)}`).toBeGreaterThan(1);
});
