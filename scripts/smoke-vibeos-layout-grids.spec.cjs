/*
 * Smoke navigateur des grilles editoriales du Layout VibeOS.
 *
 * Ce que ca protege, du point de vue de l'utilisateur:
 * - la bibliotheque s'ouvre, se cherche et applique une grille;
 * - passer du 4:5 au 1:1 RECOMPOSE la grille (memes zones, autres proportions)
 *   au lieu de l'etirer;
 * - l'apercu iPhone montre le vrai ratio Instagram du format choisi.
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-layout-grids-"));
  const file = path.join(dir, "photo.png");
  const result = spawnSync(ffmpegPath, [
    "-y", "-f", "lavfi", "-i", "testsrc2=size=800x1000:rate=1",
    "-frames:v", "1", file,
  ], { encoding: "utf8" });
  return result.status === 0 ? file : null;
}

async function openLayoutScreen(page) {
  await page.goto(`${baseUrl}/creer/layout-visuel`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i }).click({ timeout: 30000 }).catch(() => {});
  await expect(page.getByTestId("vibeos-layout-screen")).toBeVisible({ timeout: 30000 });
}

const zoneGeometry = (page) => page.getByTestId("vibeos-zone-layer").locator("> div").evaluateAll(
  (nodes) => nodes.map((node) => `${node.style.left}|${node.style.top}|${node.style.width}|${node.style.height}`),
);

test("grilles editoriales: bibliotheque, adaptation 4:5 / 1:1, apercu Instagram", async ({ page }) => {
  test.setTimeout(120000);
  const fixture = makeFixture();
  test.skip(!fixture, "ffmpeg-static indisponible: fixture impossible");

  await openLayoutScreen(page);
  await page.getByTestId("vibeos-image-input").setInputFiles(fixture);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

  // Modele personnalise -> le selecteur de grilles apparait.
  await page.getByRole("option", { name: "Personnalisé" }).click();
  const libraryButton = page.getByTestId("vibeos-grid-library-open");
  await expect(libraryButton).toBeVisible();

  // Bibliotheque: recherche et application d'une grille asymetrique.
  await libraryButton.click();
  const library = page.getByRole("dialog", { name: "Bibliothèque de grilles" });
  await expect(library).toBeVisible();
  await library.getByLabel("Chercher une grille").fill("bento");
  const bentoCard = library.locator("button", { hasText: "Bento" }).first();
  await expect(bentoCard).toBeVisible();
  await bentoCard.click();
  await expect(library).toBeHidden();

  // Le panneau suit la famille de la grille appliquee...
  const categoryButton = page.getByTestId("vibeos-grid-category");
  await expect(categoryButton).toHaveText(/Asymétrique/);
  // ...et on change de famille sans rouvrir la bibliotheque.
  await categoryButton.click();
  await page.getByRole("option", { name: "Galerie" }).click();
  await expect(categoryButton).toHaveText(/Galerie/);
  await expect(page.getByRole("option", { name: /Planche contact/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Escalier/ })).toHaveCount(0);
  // La grille appliquee, elle, n'a pas bouge.
  await expect(page.getByText(/Bento · se recompose/)).toBeVisible();

  // Six zones dessinees, dans le format portrait par defaut.
  await page.getByRole("button", { name: "Réglages avancés" }).click();
  await page.getByTestId("vibeos-zone-edit-toggle").click();
  const zoneLayer = page.getByTestId("vibeos-zone-layer");
  await expect(zoneLayer).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => zoneLayer.locator("> div").count()).toBe(6);
  const portraitGeometry = await zoneGeometry(page);

  // Passage en carre: memes zones, proportions recomposees.
  await page.getByRole("option", { name: "Carré 1:1", exact: true }).click();
  await expect.poll(async () => zoneLayer.locator("> div").count()).toBe(6);
  await expect.poll(async () => (await zoneGeometry(page)).join(";")).not.toBe(portraitGeometry.join(";"));

  // Miroir horizontal: la composition bascule, le nombre de zones ne bouge pas.
  const squareGeometry = await zoneGeometry(page);
  await page.getByRole("button", { name: "Miroir horizontal" }).click();
  await expect.poll(async () => (await zoneGeometry(page)).join(";")).not.toBe(squareGeometry.join(";"));
  await expect.poll(async () => zoneLayer.locator("> div").count()).toBe(6);

  // Apercu iPhone: le carre s'affiche en 1:1 (402 px de large sur l'ecran).
  await page.getByTestId("vibeos-zone-edit-toggle").click();
  await page.getByRole("button", { name: "Aperçu Instagram" }).click();
  const dialog = page.getByRole("dialog", { name: "Aperçu Instagram" });
  await expect(dialog.locator("[data-media-height]")).toHaveAttribute("data-media-height", "402");
  await dialog.getByRole("button", { name: "Fermer" }).click();

  // Retour en 4:5: l'apercu passe a 503 px, le ratio portrait maximal d'Instagram.
  await page.getByRole("option", { name: "Portrait 4:5", exact: true }).click();
  await page.getByRole("button", { name: "Aperçu Instagram" }).click();
  await expect(dialog.locator("[data-media-height]")).toHaveAttribute("data-media-height", "503");
});
