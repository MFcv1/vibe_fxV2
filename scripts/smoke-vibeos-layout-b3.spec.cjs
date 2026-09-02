/*
 * Smoke des finitions Layout VibeOS (/creer/layout-visuel, phase B tranche 3).
 * Parcours reel: import -> texture de fond -> sticker -> zones du modele
 * personnalise (ajout + deplacement) -> comparaison avant/apres -> apercu
 * Instagram -> rechargement de la page: le projet revient (images en Blobs
 * IndexedDB).
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-layout-b3-"));
  const files = [
    { file: "photo-a.png", color: "0x4a6c86", size: "640x800" },
    { file: "photo-b.png", color: "0x86584a", size: "640x800" },
    { file: "texture.png", color: "0x3a3a3a", size: "400x400" },
  ];
  for (const item of files) {
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", `color=c=${item.color}:s=${item.size}`,
      "-frames:v", "1", path.join(dir, item.file),
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
  }
  fixtureDir = dir;
  return dir;
}

async function openLayoutScreen(page) {
  await page.goto(`${baseUrl}/creer/layout-visuel`, { waitUntil: "domcontentloaded" });
  const devBypass = page.getByRole("button", { name: /contourner.*authentification/i });
  await devBypass.click({ timeout: 30000 }).catch(() => {});
  await expect(page.getByTestId("vibeos-layout-screen")).toBeVisible({ timeout: 30000 });
}

test("layout VibeOS B3: textures, zones, stickers, comparaison, apercu, reprise", async ({ page }) => {
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openLayoutScreen(page);

  // Import de deux photos.
  await page.getByTestId("vibeos-image-input").setInputFiles([
    path.join(dir, "photo-a.png"),
    path.join(dir, "photo-b.png"),
  ]);
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => canvas.evaluate((node) => node.width), { timeout: 10000 }).toBeGreaterThan(0);

  // Reglages avances.
  await page.getByRole("button", { name: "Réglages avancés" }).click();

  // Garde anti-scroll: meme panneau avance deplie, la PAGE ne scrolle pas
  // (les champs de fichier caches doivent rester dans le panneau).
  const pageScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(pageScrollable).toBe(false);

  // --- Texture du fond: import, selection, opacite ---
  await expect(page.getByText("Aucune texture. Importe un papier")).toBeVisible();
  await page.getByTestId("vibeos-texture-input").setInputFiles(path.join(dir, "texture.png"));
  const textureButton = page.getByRole("button", { name: /^Utiliser texture\.png$/ });
  await expect(textureButton).toBeVisible({ timeout: 10000 });
  await expect(textureButton).toHaveAttribute("aria-pressed", "true");
  const textureOpacity = page.getByRole("slider", { name: "Opacité de la texture" });
  await expect(textureOpacity).toBeVisible();
  await textureOpacity.fill("35");
  await expect(textureOpacity).toHaveValue("35");

  // --- Sticker: ajout du scotch + reglages ---
  await page.getByRole("button", { name: "Scotch", exact: true }).click();
  await expect(page.getByRole("button", { name: "Scotch 1" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rotation" })).toBeVisible();

  // --- Zones du modele personnalise: ajout, selection, deplacement ---
  await page.getByRole("option", { name: "Personnalisé" }).click();
  await page.getByTestId("vibeos-zone-edit-toggle").click();
  const zoneLayer = page.getByTestId("vibeos-zone-layer");
  await expect(zoneLayer).toBeVisible({ timeout: 10000 });
  const zonesBefore = await zoneLayer.locator("> div").count();

  await page.getByRole("button", { name: /^Carre/ }).click();
  await expect.poll(async () => zoneLayer.locator("> div").count()).toBe(zonesBefore + 1);

  // Deplacement a la souris de la zone selectionnee: sa position change vraiment.
  const zoneBox = zoneLayer.locator("> div").last();
  const before = await zoneBox.boundingBox();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 - 60, before.y + before.height / 2 - 40, { steps: 8 });
  await page.mouse.up();
  const after = await zoneBox.boundingBox();
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(10);

  // Retour a un modele standard pour la suite.
  await page.getByRole("option", { name: "Standard" }).click();

  // --- Comparaison avant/apres: maintien = photo d'origine ---
  const compareButton = page.getByRole("button", { name: /Comparer avec l'original/ });
  const compareOverlay = page.getByTestId("vibeos-compare-overlay");
  await expect(compareOverlay).toBeHidden();
  const compareBox = await compareButton.boundingBox();
  await page.mouse.move(compareBox.x + compareBox.width / 2, compareBox.y + compareBox.height / 2);
  await page.mouse.down();
  await expect(compareOverlay).toBeVisible();
  await page.mouse.up();
  await expect(compareOverlay).toBeHidden();

  // --- Apercu Instagram ---
  await page.getByRole("button", { name: "Aperçu Instagram" }).click();
  const instaDialog = page.getByRole("dialog", { name: "Aperçu Instagram" });
  await expect(instaDialog).toBeVisible();
  await expect(instaDialog.getByRole("img", { name: "Visuel 1 de la publication Instagram" })).toBeVisible();
  await instaDialog.getByRole("button", { name: "Fermer" }).click();
  await expect(instaDialog).toBeHidden();

  // --- Reprise du projet: rechargement, les images reviennent d'IndexedDB ---
  // On note ce qui est pose dans les cases: c'est ce qui doit revenir a
  // l'identique (la bande des images importees a ete supprimee, une photo vit
  // desormais dans une case).
  const filledSlotsBefore = await page.getByTestId("vibeos-slot-list").locator("img").count();
  expect(filledSlotsBefore).toBeGreaterThan(0);
  // Sauvegarde: 1,5 s de debounce d'ecriture + 0,8 s d'autosauvegarde du store.
  await page.waitForTimeout(3500);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 30000 })
    .catch(() => {});
  await expect(page.getByTestId("vibeos-layout-screen")).toBeVisible({ timeout: 30000 });

  // Le canvas rend a nouveau (donc les images sont revenues), pas l'etat vide.
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect.poll(
    async () => page.locator("canvas").evaluate((node) => node.width),
    { timeout: 15000 },
  ).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Importer des images" })).toBeHidden();

  // Les photos sont revenues dans les memes cases.
  await expect.poll(
    async () => page.getByTestId("vibeos-slot-list").locator("img").count(),
    { timeout: 15000 },
  ).toBe(filledSlotsBefore);

  // La texture et le sticker ont survecu au rechargement.
  await page.getByRole("button", { name: "Réglages avancés" }).click();
  await expect(page.getByRole("button", { name: /^Utiliser texture\.png$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scotch 1" })).toBeVisible();

  // --- Mobile: la barre d'outils de l'apercu tient dans l'ecran ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const toolbar = await page.evaluate(() => {
    const compare = document.querySelector('[title^="Comparer avec"]');
    const rect = compare.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      height: rect.height,
      docWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(toolbar.left).toBeGreaterThanOrEqual(0);
  expect(toolbar.right).toBeLessThanOrEqual(toolbar.viewportWidth);
  expect(toolbar.docWidth).toBeLessThanOrEqual(toolbar.viewportWidth + 1);

  // L'apercu Instagram s'ouvre aussi au doigt (bottom sheet).
  await page.getByRole("button", { name: "Aperçu Instagram" }).click();
  await expect(page.getByRole("dialog", { name: "Aperçu Instagram" })).toBeVisible();
});
