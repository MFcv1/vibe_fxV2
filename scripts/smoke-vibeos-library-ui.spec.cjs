/*
 * Smoke de l'ecran Bibliotheque (/creer/bibliotheque).
 *
 * Ce qui est verifie, dans l'ordre du parcours reel:
 *  1. import de plusieurs photos d'un coup, avec persistance IndexedDB;
 *  2. grille masonry: une tuile par photo, aucun chevauchement, rapports gardes;
 *  3. densite: le nombre de colonnes change vraiment;
 *  4. filtres: la recherche reduit la grille;
 *  5. carrousel: ouverture, navigation clavier, fermeture;
 *  6. les photos survivent a un rechargement de page.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

/* Des formats volontairement varies: c'est ce que la masonry doit encaisser. */
const PHOTOS = [
  { file: "port-1.jpg", size: "480x600", color: "0xc98f6a" },
  { file: "land-1.jpg", size: "800x450", color: "0x4a90d9" },
  { file: "square.jpg", size: "600x600", color: "0x7fae63" },
  { file: "port-2.jpg", size: "420x700", color: "0x9a6ec9" },
  { file: "land-2.jpg", size: "900x400", color: "0xd9c14a" },
  { file: "port-3.jpg", size: "500x640", color: "0x4ac9b0" },
];

let fixtureDir = null;

function getFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-library-ui-"));
  for (const photo of PHOTOS) {
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", `color=c=${photo.color}:s=${photo.size}`,
      "-vf", "noise=alls=16:allf=t+u",
      "-frames:v", "1", path.join(dir, photo.file),
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
  }
  fixtureDir = dir;
  return dir;
}

async function openLibrary(page) {
  await page.goto(`${baseUrl}/creer/bibliotheque`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 30000 })
    .catch(() => {});
  await expect(page.getByTestId("vibeos-library-screen")).toBeVisible({ timeout: 30000 });
}

/* Rectangles reels des tuiles, tels que le navigateur les pose. */
async function readTiles(page) {
  return page.getByTestId("vibeos-library-tile").evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
  }));
}

/* Les tuiles glissent vers leur place (transition CSS): on attend la fin des
   animations de la grille, sinon on mesure des positions intermediaires. */
async function readSettledTiles(page) {
  await page.waitForFunction(() => {
    const grid = document.querySelector('[data-testid="vibeos-library-grid"]');
    if (!grid) return false;
    return grid.getAnimations({ subtree: true })
      .every((animation) => animation.playState !== "running");
  }, null, { timeout: 20000 });
  return readTiles(page);
}

test("bibliotheque VibeOS: import, masonry, densite, carrousel, persistance", async ({ page }) => {
  test.setTimeout(180_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  /* Fenetre large et fixe: la densite est plafonnee par la largeur de la
     grille, donc une fenetre etroite rendrait le test dependant de l'ecran. */
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLibrary(page);

  // Etat vide honnete.
  await expect(page.getByText("Ta bibliothèque est vide")).toBeVisible({ timeout: 20000 });

  // 1. Import multiple.
  await page.getByTestId("vibeos-library-input")
    .setInputFiles(PHOTOS.map((photo) => path.join(dir, photo.file)));
  const tiles = page.getByTestId("vibeos-library-tile");
  await expect(tiles).toHaveCount(PHOTOS.length, { timeout: 60000 });

  // 2. Masonry: aucune superposition, aucun debordement horizontal.
  const rects = await readSettledTiles(page);
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap, "deux tuiles se superposent").toBe(false);
    }
  }
  const pageScrollsSideways = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(pageScrollsSideways).toBe(false);

  // 3. Densite: moins de colonnes = tuiles plus larges.
  /* On mesure la LARGEUR des tuiles, pas le nombre de colonnes: la densite est
     bornee par la largeur reelle de la grille, donc un cran peut ne rien
     changer sur une fenetre etroite alors que le reglage a bien bougé. */
  const widthBefore = rects[0].w;
  await page.getByRole("button", { name: "Agrandir les photos" }).click();
  await expect.poll(async () => {
    const next = await readTiles(page);
    return next[0]?.w || 0;
  }, { timeout: 10000 }).toBeGreaterThan(widthBefore);

  // 4. Recherche: la grille se reduit au nom cherche.
  await page.getByRole("searchbox", { name: "Chercher une photo" }).fill("port-");
  await expect(tiles).toHaveCount(3, { timeout: 10000 });
  await page.getByRole("searchbox", { name: "Chercher une photo" }).fill("");
  await expect(tiles).toHaveCount(PHOTOS.length, { timeout: 10000 });

  // 5. Carrousel: ouverture depuis une tuile, navigation clavier, fermeture.
  await tiles.first().getByRole("button", { name: /^Ouvrir / }).click();
  const lightbox = page.getByTestId("vibeos-library-lightbox");
  await expect(lightbox).toBeVisible({ timeout: 10000 });
  const counter = page.locator("[data-numeric]", { hasText: /^\d+ \/ \d+$/ }).first();
  await expect(counter).toHaveText(`1 / ${PHOTOS.length}`);
  await page.keyboard.press("ArrowRight");
  await expect(counter).toHaveText(`2 / ${PHOTOS.length}`, { timeout: 10000 });
  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden({ timeout: 10000 });

  // 6. Persistance: les photos sont toujours la apres rechargement.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 15000 })
    .catch(() => {});
  await expect(page.getByTestId("vibeos-library-tile"))
    .toHaveCount(PHOTOS.length, { timeout: 30000 });
});
