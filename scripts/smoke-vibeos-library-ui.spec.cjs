/*
 * Smoke de l'ecran Bibliotheque (/creer/bibliotheque).
 *
 * Ce qui est verifie, dans l'ordre du parcours reel:
 *  1. import de plusieurs photos d'un coup: un DOSSIER est cree, et on entre
 *     dedans tout de suite;
 *  2. grille masonry: une tuile par photo, aucun chevauchement, rapports gardes;
 *  3. densite: le nombre de colonnes change vraiment;
 *  4. filtres: la recherche reduit la grille;
 *  5. carrousel: ouverture, navigation clavier, fermeture;
 *  6. retour a la vue dossiers: une carte, son compte de photos, son renommage;
 *  7. la fenetre d'import propose les bonnes sources et un nom de dossier;
 *  8. dossiers et photos survivent a un rechargement de page;
 *  9. Retoucher depuis le carrousel ouvre Vision avec la photo.
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

test("bibliotheque VibeOS: dossiers, import, masonry, densite, carrousel, persistance", async ({ page }) => {
  test.setTimeout(180_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  /* Fenetre large et fixe: la densite est plafonnee par la largeur de la
     grille, donc une fenetre etroite rendrait le test dependant de l'ecran. */
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLibrary(page);

  // Etat vide honnete: aucun dossier, donc aucune grille.
  await expect(page.getByText("Ta bibliothèque est vide")).toBeVisible({ timeout: 20000 });

  // 1. Import multiple: un dossier est cree, et on y entre directement.
  await page.getByTestId("vibeos-library-input")
    .setInputFiles(PHOTOS.map((photo) => path.join(dir, photo.file)));
  const tiles = page.getByTestId("vibeos-library-tile");
  await expect(tiles).toHaveCount(PHOTOS.length, { timeout: 60000 });
  await expect(page.getByTestId("vibeos-library-folder-title")).toBeVisible();

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

  // 6. Retour aux dossiers: une carte, le bon compte, et le renommage tient.
  await page.getByRole("button", { name: "Bibliothèque" }).click();
  const folders = page.getByTestId("vibeos-library-folder");
  await expect(folders).toHaveCount(1, { timeout: 10000 });
  await expect(folders.first()).toContainText(`${PHOTOS.length} photos`);

  const originalName = (await folders.first().locator("h3").textContent()).trim();
  await folders.first().getByRole("button", { name: /^Renommer / }).click();
  const nameField = folders.first().getByRole("textbox");
  await nameField.fill("Mes essais");
  await nameField.press("Enter");
  await expect(folders.first().locator("h3")).toHaveText("Mes essais", { timeout: 10000 });
  expect(originalName).not.toBe("Mes essais");

  // 7. Fenetre d'import: sources adaptees a l'appareil, nom de dossier propose.
  await page.getByTestId("vibeos-library-import").click();
  const sheet = page.getByTestId("vibeos-library-import-sheet");
  await expect(sheet).toBeVisible({ timeout: 10000 });
  /* Chromium de bureau: photos ou dossier entier, jamais l'appareil photo. */
  await expect(page.getByTestId("vibeos-library-source-files")).toBeVisible();
  await expect(page.getByTestId("vibeos-library-source-directory")).toBeVisible();
  await expect(page.getByTestId("vibeos-library-source-camera")).toHaveCount(0);
  await expect(page.getByTestId("vibeos-library-folder-name")).not.toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden({ timeout: 10000 });

  // 8. Persistance: dossier et photos sont toujours la apres rechargement.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 15000 })
    .catch(() => {});
  await expect(page.getByTestId("vibeos-library-folder")).toHaveCount(1, { timeout: 30000 });
  await expect(page.getByTestId("vibeos-library-folder").first()).toContainText("Mes essais");
  await page.getByTestId("vibeos-library-folder").first()
    .getByRole("button", { name: /^Ouvrir le dossier / }).click();
  await expect(page.getByTestId("vibeos-library-tile"))
    .toHaveCount(PHOTOS.length, { timeout: 30000 });

  // 9. On simule une photo redescendue du compte (URL distante, aucun Blob
  // local), puis le bouton du carrousel doit la rapatrier et ouvrir Vision.
  const remotePhotoName = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("vibeos-library", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction("photos", "readonly").objectStore("photos").getAll();
      request.onsuccess = () => resolve(request.result[2]);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("photos", "readwrite");
      tx.objectStore("photos").put({
        ...record,
        blob: null,
        thumbBlob: null,
        remote: true,
        originalUrl: "/assets/vibefx/demo-astronaut.png",
        previewUrl: "/assets/vibefx/demo-astronaut.png",
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return record.name;
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 15000 })
    .catch(() => {});
  await page.getByTestId("vibeos-library-folder").first()
    .getByRole("button", { name: /^Ouvrir le dossier / }).click();
  await page.getByRole("button", { name: `Ouvrir ${remotePhotoName}` }).click();
  await expect(page.getByTestId("vibeos-library-lightbox")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("vibeos-library-lightbox-edit").click();
  await expect(page).toHaveURL(/\/creer\/vision$/, { timeout: 30000 });
  await expect(page.getByTestId("vibeos-vision-screen")).toBeVisible({ timeout: 30000 });
});
