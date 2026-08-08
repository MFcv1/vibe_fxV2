/*
 * GATE NAVIGATEUR DU LOT B2 - de vrais medias dans les aperçus.
 *
 * POURQUOI CE FICHIER EXISTE, alors que les 26 tests des lots B1 et phase 5
 * passaient DEJA avec des images fixes.
 *
 * C'est tout le sujet: une vignette de transition bouge de toute facon, c'est la
 * transition qui l'anime. Un test qui mesure « les pixels changent » passe donc
 * a l'identique que la source soit un rush anime ou un dessin fige. Le lot B2
 * pouvait etre entierement casse - chaine de repli inversee, clips absents,
 * videos jamais lues - sans qu'un seul test existant le voie.
 *
 * D'ou trois preuves qui ne peuvent PAS etre obtenues par accident :
 *
 *  1. L'ETAGE ATTEINT est lu dans le DOM (`data-media-kind`). Projet vide ->
 *     `demo`; projet avec des photos -> `photo`. C'est la seule facon de
 *     distinguer une bibliotheque vivante d'une bibliotheque retombee sur son
 *     dessin.
 *  2. LA SOURCE BOUGE TOUTE SEULE. On fige la transition (mode scrub, une seule
 *     position), et on regarde si l'image change quand meme. Sur un dessin, non.
 *     Sur un rush, oui - et c'est exactement ce que le lot devait apporter.
 *  3. FIGER FIGE VRAIMENT. Corollaire indispensable du point 2: une fois hors
 *     de la boucle, l'image ne doit PLUS bouger, sinon le scrub et le bypass
 *     comparent deux instants differents du rush et ne prouvent plus rien
 *     (voir `librarySourceFreeze.js`).
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

async function bypassAuth(page) {
  const devBypass = page.getByRole("button", { name: /dev mode.*contourner.*authentification/i });
  if (await devBypass.isVisible().catch(() => false)) {
    await devBypass.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
}

async function open(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await bypassAuth(page);
}

async function signature(locator) {
  return locator.evaluate((canvas) => {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const pixels = data.length / 4;
    const probe = (fx, fy) => {
      const x = Math.min(width - 1, Math.max(0, Math.round(width * fx)));
      const y = Math.min(height - 1, Math.max(0, Math.round(height * fy)));
      const o = (y * width + x) * 4;
      return [data[o], data[o + 1], data[o + 2]];
    };
    const grid = [];
    for (const fy of [0.15, 0.38, 0.62, 0.85]) {
      for (const fx of [0.12, 0.37, 0.63, 0.88]) grid.push(...probe(fx, fy));
    }
    return [r / pixels, g / pixels, b / pixels, ...grid];
  });
}

function distance(a, b) {
  return Math.max(...a.map((value, index) => Math.abs(value - b[index])));
}

test.describe("B2 - la source des vignettes", () => {
  test("projet vide: les vignettes tournent sur les CLIPS DE DEMONSTRATION, pas sur le dessin", async ({ page }) => {
    await open(page, "/video/transitions");
    const screen = page.getByTestId("vibecut-transition-library");
    await expect(screen).toBeVisible({ timeout: 20000 });

    /*
     * Le repli dessine est affiche d'abord - c'est voulu, il evite que
     * quarante-huit vignettes clignotent en attendant le reseau. On attend donc
     * que l'etage monte, plutot que de lire une fois et conclure.
     */
    await expect(screen).toHaveAttribute("data-media-kind", "demo", { timeout: 20000 });
  });

  test("la meme regle vaut pour la bibliotheque de mouvements", async ({ page }) => {
    await open(page, "/video/mouvements");
    const screen = page.getByTestId("vibecut-motion-library");
    await expect(screen).toBeVisible({ timeout: 20000 });
    await expect(screen).toHaveAttribute("data-media-kind", "demo", { timeout: 20000 });
  });

  test("le clip AVANCE tout seul: a progression figee, l'image change quand meme", async ({ page }) => {
    await open(page, "/video/transitions");
    const screen = page.getByTestId("vibecut-transition-library");
    await expect(screen).toBeVisible({ timeout: 20000 });
    await expect(screen).toHaveAttribute("data-media-kind", "demo", { timeout: 20000 });

    await page.getByTestId("vibecut-transition-card-crossfade").click();
    const canvas = page.getByTestId("vibecut-transition-panel-canvas");

    /*
     * On reste en BOUCLE et on echantillonne au meme instant du cycle... ce qui
     * est impossible a garantir. On prend donc le probleme par l'autre bout: en
     * boucle, l'image doit changer (transition + rush), et c'est deja couvert
     * ailleurs. Ce qui n'est couvert nulle part, c'est que la SOURCE elle-meme
     * porte du mouvement. On le mesure en comparant deux instants du clip a
     * progression EGALE - obtenue en revenant deux fois sur la meme position de
     * scrub, avec du temps entre les deux.
     */
    const slider = page.getByTestId("vibecut-transition-stage-time");
    await slider.fill("500");
    await page.waitForTimeout(150);
    const first = await signature(canvas);

    /*
     * On relache vers la boucle: le clip reprend sa lecture et avance.
     *
     * LA FENETRE EST LARGE, ET C'EST DELIBERE. L'ecart mesure depend de combien
     * le clip a avance entre les deux mesures - donc du temps CPU qu'il a
     * obtenu. En suite complete, avec plusieurs pages qui decodent en meme
     * temps, 700 ms de lecture pouvaient ne faire avancer le clip que d'une
     * image ou deux: mesure du 2026-08-03, un ecart de 2,0 pour un seuil de 2.
     * Deux secondes laissent la place a un mouvement franc meme sur une machine
     * chargee, sans rien concéder sur ce que le test affirme.
     */
    await page.getByTestId("vibecut-transition-stage-loop").click();
    await expect(canvas).toHaveAttribute("data-preview-mode", "loop");
    await page.waitForTimeout(2000);

    // Puis on revient EXACTEMENT a la meme progression.
    await slider.fill("500");
    await page.waitForTimeout(150);
    const second = await signature(canvas);

    expect(
      distance(first, second),
      "a progression identique, l'image est identique: la source ne bouge pas, "
      + "les vignettes sont retombees sur une image fixe",
    ).toBeGreaterThan(2);
  });

  test("hors de la boucle, l'image est FIGEE: le scrub et le bypass comparent le meme instant", async ({ page }) => {
    await open(page, "/video/transitions");
    const screen = page.getByTestId("vibecut-transition-library");
    await expect(screen).toBeVisible({ timeout: 20000 });
    await expect(screen).toHaveAttribute("data-media-kind", "demo", { timeout: 20000 });

    await page.getByTestId("vibecut-transition-card-crossfade").click();
    const canvas = page.getByTestId("vibecut-transition-panel-canvas");
    const slider = page.getByTestId("vibecut-transition-stage-time");

    await slider.fill("500");
    await page.waitForTimeout(150);
    const frozen = await signature(canvas);

    // Largement plus long qu'une image de clip: si la video continuait de
    // tourner sous la transition figee, ca se verrait ici.
    await page.waitForTimeout(900);
    expect(
      distance(frozen, await signature(canvas)),
      "l'image bouge alors que la progression est figee: le rush continue de "
      + "tourner sous le scrub, donc l'avant/apres du bypass ne prouve rien",
    ).toBeLessThan(2);
  });
});
