/*
 * Smoke du NOUVEAU front VibeCut (route /video).
 * Vit en parallele de scripts/smoke-video-ui.spec.cjs, qui continue de couvrir
 * l'ancienne interface jusqu'a sa suppression.
 */

const { test, expect } = require("@playwright/test");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

async function openVibeCut(page, path = "/video") {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  const devBypass = page.getByRole("button", { name: /dev mode.*contourner.*authentification/i });
  if (await devBypass.isVisible().catch(() => false)) {
    await devBypass.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }

  await expect(page.locator('[data-vibecut-shell="true"]')).toBeVisible({ timeout: 20000 });
}

test.describe("VibeCut v2 - accueil", () => {
  test("l'accueil presente les trois modes, les bibliotheques et l'etat des projets", async ({ page }) => {
    await openVibeCut(page);

    const home = page.getByTestId("vibecut-home");
    await expect(home).toBeVisible();
    await expect(page.getByRole("heading", { name: "Créer une vidéo" })).toBeVisible();

    // Les trois modes demandes, nommes simplement.
    await expect(page.getByTestId("vibecut-mode-rapide")).toContainText("Montage rapide");
    await expect(page.getByTestId("vibecut-mode-guide")).toContainText("Création guidée");
    await expect(page.getByTestId("vibecut-mode-avance")).toContainText("Montage avancé");

    // Bibliotheques visibles depuis l'accueil.
    await expect(page.getByTestId("vibecut-open-motions")).toBeVisible();
    await expect(page.getByTestId("vibecut-open-transitions")).toBeVisible();
    await expect(page.getByTestId("vibecut-transition-tile-crossfade")).toBeVisible();
    await expect(page.getByTestId("vibecut-motion-tile-zoom-in")).toBeVisible();

    // Projets: soit la grille, soit un etat vide explicite. Jamais un ecran muet.
    const recent = page.getByTestId("vibecut-recent-projects");
    const emptyAction = page.getByRole("button", { name: /créer mon premier projet/i });
    await expect(page.getByTestId("vibecut-projects-loading")).toHaveCount(0, { timeout: 15000 });
    const hasProjects = await recent.isVisible().catch(() => false);
    if (!hasProjects) {
      await expect(emptyAction).toBeVisible();
    }
  });

  test("le design system VibeCut est isole et lisible", async ({ page }) => {
    await openVibeCut(page);

    const shell = page.locator('[data-vibecut-shell="true"]');

    // Un seul bandeau superieur dans toute la surface VibeCut.
    await expect(shell.locator("header")).toHaveCount(1);

    // Le CSS Tailwind statique de /studio ne doit pas etre charge sur /video.
    const studioSheets = await page.evaluate(() => (
      [...document.styleSheets]
        .map((sheet) => sheet.href || "")
        .filter((href) => href.includes("vibefx-tailwind") || href.includes("vibefx-layout"))
    ));
    expect(studioSheets).toEqual([]);

    // Aucun texte lisible sous 12px: c'est la regle typographique du nouveau design
    // system. Les maquettes decoratives (aria-hidden) simulent une interface en
    // miniature et sont donc exclues.
    const tinyText = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[data-vibecut-shell="true"] *')];
      return nodes.filter((node) => {
        if (!node.textContent?.trim()) return false;
        if (node.children.length > 0) return false;
        if (node.closest('[aria-hidden="true"]')) return false;
        return parseFloat(getComputedStyle(node).fontSize) < 12;
      }).map((node) => `${node.tagName}:${node.textContent.trim().slice(0, 20)}`);
    });
    expect(tinyText).toEqual([]);

    // La police doit etre la pile systeme du design system, pas Geist du site public.
    const fontFamily = await page.evaluate(() => (
      getComputedStyle(document.querySelector('[data-vibecut-shell="true"]')).fontFamily
    ));
    expect(fontFamily).toContain("system");
  });

  test("nouveau projet cree un projet reel, navigable et supprimable", async ({ page }) => {
    await openVibeCut(page);

    await page.getByTestId("vibecut-new-project").click();
    await page.waitForURL(/\/video\/rapide\?project=/, { timeout: 20000 });

    const projectId = new URL(page.url()).searchParams.get("project");
    expect(projectId).toBeTruthy();

    // Retour a l'accueil: le projet doit etre liste avec ses metadonnees.
    await page.getByTestId("vibecut-brand-home").click();
    await page.waitForURL(/\/video$/, { timeout: 20000 });
    const card = page.getByTestId(`vibecut-project-card-${projectId}`);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText("Vide");
    await expect(page.getByTestId(`vibecut-project-open-advanced-${projectId}`)).toBeVisible();

    // Suppression en deux temps, sans dialogue natif.
    await page.getByTestId(`vibecut-project-delete-${projectId}`).click();
    await page.getByTestId(`vibecut-project-delete-confirm-${projectId}`).click();
    await expect(card).toHaveCount(0, { timeout: 15000 });
  });

  test("les six routes VibeCut repondent et restent non indexables", async ({ page }) => {
    for (const path of ["/video", "/video/rapide", "/video/guide", "/video/avance", "/video/transitions", "/video/mouvements"]) {
      const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `status de ${path}`).toBeLessThan(400);
      const robots = await page.locator('meta[name="robots"]').first().getAttribute("content");
      expect(robots, `robots de ${path}`).toContain("noindex");
    }
  });
  /* ---------- Phase 7: la bascule ---------- */

  test("phase 7: /studio?workspace=video redirige vers le nouveau front", async ({ page }) => {
    /*
     * Le test le plus important de la phase 7. Un lien ou un favori existant ne
     * doit ni tomber sur une page vide ni rouvrir l'ancien editeur - il doit
     * arriver sur /video. La redirection est cote SERVEUR: on verifie donc
     * l'URL FINALE, pas un contenu qui pourrait venir d'une navigation cliente.
     */
    await page.goto(`${baseUrl}/studio?workspace=video`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const devBypass = page.getByRole("button", { name: /dev mode.*contourner.*authentification/i });
    if (await devBypass.isVisible().catch(() => false)) {
      await devBypass.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    }

    expect(new URL(page.url()).pathname).toBe("/video");
    await expect(page.getByTestId("vibecut-home")).toBeVisible({ timeout: 20000 });

    // Et l'ancienne interface n'est plus montee nulle part.
    await expect(page.locator(".vbc-shell, [data-testid='video-app']")).toHaveCount(0);
  });
  test("phase 7: l'onglet VIBECUT du studio mene vraiment a /video", async ({ page }) => {
    /*
     * Defaut trouve A L'USAGE, pas par les tests: apres la suppression de
     * l'ancien editeur, l'onglet appelait encore `setView('video')` - un etat que
     * plus rien ne rendait. Le clic ne faisait RIEN.
     *
     * On CLIQUE donc vraiment, et on verifie l'URL d'arrivee. Verifier que le
     * libelle existe n'aurait rien prouve: il existait deja quand il etait mort.
     */
    await page.goto(`${baseUrl}/studio`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});

    const devBypass = page.getByRole("button", { name: /dev mode.*contourner.*authentification/i });
    if (await devBypass.isVisible().catch(() => false)) {
      await devBypass.click();
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    }

    const tab = page.getByTestId("studio-tab-vibecut");
    await expect(tab).toBeVisible({ timeout: 20000 });
    await tab.click();

    await page.waitForURL(/\/video$/, { timeout: 20000 });
    await expect(page.getByTestId("vibecut-home")).toBeVisible({ timeout: 20000 });
  });
});
