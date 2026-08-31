/*
 * Smoke du Studio VibeOS recentré sur ses deux mini-apps créatives.
 *
 * Il verrouille le contrat produit : seulement Gradient + Lumen dans le hub,
 * ouverture plein écran, retour Échap, fond généré persisté et mobile sans
 * débordement. Le moteur de presets photo vit désormais dans Vision.
 */

const { test, expect } = require("@playwright/test");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgQIA6fptVQAAAABJRU5ErkJggg==";

async function openStudio(page) {
  await page.goto(`${baseUrl}/creer/studio`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 30000 })
    .catch(() => {});
  await expect(page.getByTestId("vibeos-studio-screen")).toBeVisible({ timeout: 30000 });
}

async function expectFullscreen(page, dialog) {
  /* La feuille part volontairement de scale(.985) pendant 320 ms : mesurer
     avant la fin de la continuité Apple ferait passer 98,5 % pour un layout. */
  await page.waitForTimeout(380);
  const viewport = page.viewportSize();
  const box = await dialog.boundingBox();
  const topbarHeight = await page.evaluate(() => {
    const root = document.querySelector('.vibeos');
    return Number.parseFloat(getComputedStyle(root).getPropertyValue('--vo-topbar-height')) || 56;
  });
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
  expect(box.y).toBeGreaterThanOrEqual(topbarHeight - 1);
  expect(box.y).toBeLessThanOrEqual(topbarHeight + 1);
  expect(box.height).toBeGreaterThanOrEqual(viewport.height - topbarHeight - 2);
}

test("studio VibeOS: Gradient et Lumen s'ouvrent en plein écran", async ({ page }) => {
  await openStudio(page);

  const screen = page.getByTestId("vibeos-studio-screen");
  await expect(screen.getByRole("heading", { name: "Crée tes fonds, en grand." })).toBeVisible();
  await expect(screen.getByTestId("vibeos-studio-module-gradient")).toBeVisible();
  await expect(screen.getByTestId("vibeos-studio-module-lumen")).toBeVisible();
  await expect(screen.getByText("Mesh", { exact: true })).toHaveCount(0);
  await expect(screen.getByText("Ambiances", { exact: true })).toHaveCount(0);

  await screen.getByTestId("vibeos-studio-module-gradient").click();
  const gradient = page.getByRole("dialog", { name: "Gradient" });
  await expect(gradient).toBeVisible();
  await expect(gradient.locator("iframe")).toHaveAttribute("src", /gradient-builder/);
  await expectFullscreen(page, gradient);
  await expect(page.getByRole("link", { name: "Studio" }).first()).toBeVisible();

  /* Le message est celui de la vraie mini-app. On le rejoue ici pour tester le
     pont iframe -> Blob IndexedDB -> projet sans dépendre d'un clic interne. */
  await page.evaluate(({ pixel }) => {
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        source: "gradient-builder",
        type: "gradient:use-background",
        payload: { dataUrl: pixel, title: "Nuage irisé" },
      },
    }));
  }, { pixel: PIXEL });

  await expect(gradient).toBeHidden();
  const active = screen.getByTestId("vibeos-studio-active-background");
  await expect(active).toContainText("Nuage irisé");
  await expect(active).toContainText("Gradient est actif");
  await expect(screen.getByTestId("vibeos-studio-module-gradient")).toHaveAttribute("data-active", "true");

  await active.getByRole("button", { name: "Retirer" }).click();
  await expect(active).toBeHidden();

  await screen.getByTestId("vibeos-studio-module-lumen").click();
  const lumen = page.getByRole("dialog", { name: "Lumen" });
  await expect(lumen).toBeVisible();
  await expect(lumen.locator("iframe")).toHaveAttribute("src", /vendor\/lumen/);
  await expectFullscreen(page, lumen);
  await page.keyboard.press("Escape");
  await expect(lumen).toBeHidden();
});

test("studio VibeOS: le hub et les mini-apps restent plein écran sur mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStudio(page);

  const screen = page.getByTestId("vibeos-studio-screen");
  await expect(screen.getByTestId("vibeos-studio-module-gradient")).toBeVisible();
  await expect(screen.getByTestId("vibeos-studio-module-lumen")).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);

  await screen.getByTestId("vibeos-studio-module-lumen").click();
  const lumen = page.getByRole("dialog", { name: "Lumen" });
  await expect(lumen).toBeVisible();
  await expectFullscreen(page, lumen);
});
