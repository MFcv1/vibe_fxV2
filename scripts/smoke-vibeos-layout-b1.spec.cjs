/*
 * Smoke de l'ecran Layout VibeOS (/creer/layout-visuel, phase B tranche 1).
 * Parcours reel: contournement dev -> import de deux images -> canvas rendu ->
 * changement de format et de modele -> template thematique applique ->
 * export JPG telecharge.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

let fixtureDir = null;

function getPhotoFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-layout-"));
  const photos = [
    { file: "photo-a.png", color: "0x4a6c86" },
    { file: "photo-b.png", color: "0x86584a" },
  ];
  for (const photo of photos) {
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", `color=c=${photo.color}:s=640x800`,
      "-frames:v", "1", path.join(dir, photo.file),
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
  }
  fixtureDir = dir;
  return dir;
}

async function openLayoutScreen(page) {
  await page.goto(`${baseUrl}/creer/layout-visuel`, { waitUntil: "domcontentloaded" });
  /* Premiere compilation dev parfois lente: on attend le portail OU l'ecran. */
  const devBypass = page.getByRole("button", { name: /contourner.*authentification/i });
  await devBypass.click({ timeout: 30000 }).catch(() => {});
  await expect(page.getByTestId("vibeos-layout-screen")).toBeVisible({ timeout: 30000 });
}

test("layout VibeOS: import, composition, template, export", async ({ page }) => {
  const dir = getPhotoFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openLayoutScreen(page);

  // Etat vide honnete puis import global (2 images).
  await expect(page.getByRole("button", { name: "Importer des images" })).toBeVisible();
  const globalInput = page.locator('input[type="file"][multiple]');
  await globalInput.setInputFiles([
    path.join(dir, "photo-a.png"),
    path.join(dir, "photo-b.png"),
  ]);

  // Le canvas apparait et rend quelque chose (dimensions du format actif).
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => canvas.evaluate((node) => node.width), { timeout: 10000 }).toBeGreaterThan(0);

  // Format carre -> le canvas suit (1080x1080).
  await page.getByRole("option", { name: /Carré/ }).click();
  await expect.poll(async () => canvas.evaluate((node) => `${node.width}x${node.height}`)).toBe("1080x1080");

  // Desktop: la page ne scrolle JAMAIS (apercu fixe, seul le panneau scrolle)
  // et le canvas tient entier dans la fenetre, y compris en Story 9:16.
  await page.getByRole("option", { name: /Story/ }).click();
  await expect.poll(async () => canvas.evaluate((node) => node.height)).toBe(1920);
  await page.mouse.wheel(0, 800);
  const layoutMetrics = await page.evaluate(() => {
    const shell = document.querySelector('[data-vibeos-shell="true"]');
    return {
      pageScrollable: document.scrollingElement.scrollHeight > window.innerHeight + 1,
      shellHeight: shell.getBoundingClientRect().height,
      shellTop: shell.getBoundingClientRect().top,
      canvasBottom: document.querySelector("canvas").getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
    };
  });
  expect(layoutMetrics.pageScrollable).toBe(false);
  expect(layoutMetrics.shellTop).toBe(0);
  expect(layoutMetrics.shellHeight).toBeLessThanOrEqual(layoutMetrics.viewportHeight + 1);
  expect(layoutMetrics.canvasBottom).toBeLessThanOrEqual(layoutMetrics.viewportHeight + 1);
  await page.getByRole("option", { name: /Carré/ }).click();

  // Modele Double (2 zones) -> deux slots listes.
  await page.getByRole("option", { name: /Double/ }).click();
  await expect(page.getByRole("button", { name: "Image 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Image 2" })).toBeVisible();

  // Template thematique: ouverture du sheet, application, toast.
  await page.getByRole("button", { name: "Parcourir les templates" }).click();
  await expect(page.getByRole("dialog", { name: "Templates prêts à poster" })).toBeVisible();
  await page.getByRole("button", { name: /Vitrine Collection/ }).click();
  await expect(page.getByText(/Template « Vitrine Collection » appliqué/)).toBeVisible();

  // Fond genere Mesh: segmented "Généré" -> sheet -> appliquer.
  await page.getByRole("tab", { name: "Généré" }).click();
  await expect(page.getByRole("dialog", { name: "Fond Mesh gradient" })).toBeVisible();
  await page.getByRole("button", { name: "Utiliser comme fond" }).click();
  const meshButton = page.getByRole("button", { name: "Mesh", exact: true });
  await expect(meshButton).toBeVisible();

  // Undo: l'application du mesh se defait (le choix Mesh/Lumen disparait).
  await page.waitForTimeout(600); // debounce historique 400ms
  await page.getByRole("button", { name: /Annuler \(Cmd\+Z\)/ }).click();
  await expect(meshButton).toBeHidden();
  await page.getByRole("button", { name: /Rétablir/ }).click();
  await expect(meshButton).toBeVisible();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Annuler \(Cmd\+Z\)/ }).click();
  await expect(meshButton).toBeHidden();

  // Export JPG reel: le telechargement part.
  await page.getByRole("button", { name: "Exporter" }).click();
  await expect(page.getByRole("dialog", { name: "Exporter le visuel" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("button", { name: "Télécharger" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.jpg$/);
});
