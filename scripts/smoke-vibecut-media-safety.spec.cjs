const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3218";
const videoDir = path.join(process.cwd(), "videotest");

async function openVibeCut(page) {
  await page.goto(`${baseUrl}/studio`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  const devBypass = page.getByRole("button", { name: /dev mode.*contourner.*authentification/i });
  if (await devBypass.isVisible().catch(() => false)) {
    await devBypass.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }

  const openPreferred = page.getByRole("button", { name: /ouvrir.*mise en page/i }).first();
  const openFallback = page.getByRole("button", { name: /creer.*mise en page/i }).first();
  if (await openPreferred.count()) await openPreferred.click();
  else if (await openFallback.count()) await openFallback.click();

  const vibeCutTab = page.getByRole("button", { name: /^(video|vibecut)$/i });
  await expect(vibeCutTab).toBeVisible({ timeout: 15000 });
  await vibeCutTab.click();
}

test("WebM with unstable metadata never crashes the timeline", async ({ page }) => {
  test.setTimeout(120000);
  const fixtures = [
    path.join(videoDir, "vibecut-premiere-audit-final.webm"),
    path.join(videoDir, "vibecut-smoke-export.webm"),
  ];
  test.skip(fixtures.some((file) => !fs.existsSync(file)), "WebM audit fixtures are unavailable");

  const fatalIssues = [];
  page.on("pageerror", (error) => fatalIssues.push(error.message));
  page.on("console", (message) => {
    if (/Map maximum size exceeded|non-finite|not finite|currentTime/i.test(message.text())) {
      fatalIssues.push(message.text());
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await openVibeCut(page);
  await page.locator('input[type=file][accept*="video"]').setInputFiles(fixtures);

  const notice = page.getByTestId("vibecut-import-notice");
  await expect(notice).toBeVisible({ timeout: 30000 });
  await expect(notice).not.toHaveAttribute("data-import-state", "progress", { timeout: 30000 });
  const terminalState = await notice.getAttribute("data-import-state");
  expect(["success", "warning", "error"]).toContain(terminalState);
  await expect(page.locator("body")).not.toContainText("Map maximum size exceeded");
  expect(fatalIssues).toEqual([]);
});

test("preview-only creative tools are visible but cannot enter an exportable project", async ({ page }) => {
  test.setTimeout(120000);
  const fixtures = [path.join(videoDir, "vibecut-premiere-audit-final.webm")];
  test.skip(fixtures.some((file) => !fs.existsSync(file)), "Browser-compatible audit fixture is unavailable");

  await page.setViewportSize({ width: 1440, height: 900 });
  await openVibeCut(page);
  await page.locator('input[type=file][accept*="video"]').setInputFiles(fixtures);
  await expect(page.getByTestId("vibecut-import-notice")).toHaveAttribute("data-import-state", "success", { timeout: 120000 });
  await page.getByTestId("vibecut-mode-pro").click();

  await page.getByTestId("quick-tool-group-transitions").click();
  const crossDissolve = page.getByRole("button", { name: "Cross Dissolve", exact: true });
  await expect(crossDissolve).toBeEnabled();
  await expect(crossDissolve).toHaveAttribute("data-export-capability", "ready");

  await page.getByRole("button", { name: "Zoom", exact: true }).click();
  const crossZoom = page.getByRole("button", { name: "Cross Zoom", exact: true });
  await expect(crossZoom).toBeVisible();
  await expect(crossZoom).toBeDisabled();
  await expect(crossZoom).toHaveAttribute("data-export-capability", "preview-only");
});

test("photo storyboard imports, changes duration and applies exportable motion", async ({ page }) => {
  test.setTimeout(120000);
  const fixtures = [
    path.join(process.cwd(), "public", "assets", "vibefx", "demo-astronaut.png"),
    path.join(process.cwd(), "public", "assets", "vibecut-concepts", "04-module-mouvements-animations.png"),
    path.join(process.cwd(), "public", "assets", "vibecut-concepts", "05-module-transitions.png"),
  ];
  test.skip(fixtures.some((file) => !fs.existsSync(file)), "Photo storyboard fixtures are unavailable");

  await page.setViewportSize({ width: 1440, height: 900 });
  await openVibeCut(page);
  await page.locator('input[type=file][accept*="image"]').setInputFiles(fixtures);
  await expect(page.getByTestId("vibecut-import-notice")).toHaveAttribute("data-import-state", "success", { timeout: 30000 });
  await page.getByTestId("vibecut-guided-template-photo-cinematic").click();
  await page.getByTestId("vibecut-guided-create-button").click();
  await expect(page.getByTestId("vibecut-guided-success")).toBeVisible();
  await page.getByTestId("vibecut-guided-open-storyboard").click();
  await expect(page.getByTestId("vibecut-storyboard-scenes")).toBeVisible();
  await expect(page.getByTestId("vibecut-story-scene-2")).toBeVisible();
  await page.getByTestId("vibecut-story-tab-transition").click();
  await page.getByRole("button", { name: /Fondu cinema/i }).click();
  await page.getByTestId("vibecut-story-tab-look").click();
  await page.getByTestId("vibecut-story-before").click();
  await page.getByTestId("vibecut-story-after").click();
  await page.getByRole("button", { name: /Social pop/i }).click();
  await page.getByTestId("vibecut-mode-pro").click();
  await expect(page.getByTestId("video-clip-0")).toBeVisible();
  await expect(page.getByTestId("video-clip-2")).toBeVisible();

  await page.getByTestId("video-clip-0").click();
  await page.getByTestId("video-tool-motion").click();
  const motionPanel = page.getByTestId("vibecut-unified-panel");
  await expect(motionPanel.getByTestId("vibecut-motion-presets")).toBeVisible();
  await motionPanel.getByTestId("vibecut-motion-zoom-in").click();
  await expect(motionPanel.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");
  await motionPanel.getByTestId("vibecut-image-duration").fill("6.5");
  await expect(motionPanel.getByText("6.5 s", { exact: true })).toBeVisible();

  await page.getByTestId("vibecut-save-project").click();
  await expect(page.getByTestId("vibecut-import-notice")).toContainText("Projet sauvegarde", { timeout: 15000 });

  await openVibeCut(page);
  await expect(page.getByTestId("vibecut-restore-project")).toBeEnabled({ timeout: 15000 });
  await page.getByTestId("vibecut-restore-project").click();
  await expect(page.getByTestId("vibecut-import-notice")).toContainText("Projet et medias repris", { timeout: 15000 });
  const restoredMediaStrip = page.getByTestId("vibecut-guided-media-strip");
  await expect(restoredMediaStrip).toBeVisible();
  await expect(restoredMediaStrip.locator("img")).toHaveCount(3);
});
