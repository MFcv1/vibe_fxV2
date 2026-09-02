/*
 * Gate des formats Instagram du Layout VibeOS.
 * Chaque format est rendu en pleine definition dans le vrai iPhone; les
 * panoramas doivent fournir 2/3 JPEG distincts de 1080x1350 et se parcourir.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

function makeFixture() {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-instagram-preview-"));
  const file = path.join(dir, "format-source.png");
  const result = spawnSync(ffmpegPath, [
    "-y", "-f", "lavfi", "-i", "testsrc2=size=800x1000:rate=1",
    "-frames:v", "1", file,
  ], { encoding: "utf8" });
  return result.status === 0 ? file : null;
}

async function openLayout(page) {
  await page.goto(`${baseUrl}/creer/layout-visuel`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i }).click({ timeout: 30000 }).catch(() => {});
  await expect(page.getByTestId("vibeos-layout-screen")).toBeVisible({ timeout: 30000 });
}

test("preview Instagram: six formats, vraies tranches JPEG et carrousel", async ({ page }) => {
  test.setTimeout(120000);
  const fixture = makeFixture();
  test.skip(!fixture, "ffmpeg-static indisponible: fixture impossible");
  await openLayout(page);
  await page.getByTestId("vibeos-image-input").setInputFiles(fixture);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

  const cases = [
    { name: "Portrait 4:5", size: [1080, 1350], slides: 1 },
    { name: "Carré 1:1", size: [1080, 1080], slides: 1 },
    { name: "Story / Réel 9:16", size: [1080, 1920], slides: 1, alt: "Aperçu de la story" },
    { name: "Paysage 1,91:1", size: [1080, 566], slides: 1 },
    { name: "Pano x2", size: [1080, 1350], slides: 2 },
    { name: "Pano x3", size: [1080, 1350], slides: 3 },
  ];

  for (const formatCase of cases) {
    await page.getByRole("option", { name: formatCase.name, exact: true }).click();
    await page.getByRole("button", { name: "Aperçu Instagram" }).click();
    const dialog = page.getByRole("dialog", { name: "Aperçu Instagram" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Aperçu Instagram sur iPhone 17 Pro")).toBeVisible();
    for (let slideIndex = 0; slideIndex < formatCase.slides; slideIndex += 1) {
      const alt = formatCase.alt || `Visuel ${slideIndex + 1} de la publication Instagram`;
      const image = dialog.getByRole("img", { name: alt });
      await expect(image).toBeVisible({ timeout: 20000 });
      const dimensions = await image.evaluate((node) => ({
        width: node.naturalWidth,
        height: node.naturalHeight,
        jpeg: node.src.startsWith("data:image/jpeg"),
      }));
      expect(dimensions).toEqual({ width: formatCase.size[0], height: formatCase.size[1], jpeg: true });
      if (slideIndex < formatCase.slides - 1) await dialog.getByRole("button", { name: "Image suivante" }).click();
    }
    await dialog.getByRole("button", { name: "Fermer" }).click();
  }
});
