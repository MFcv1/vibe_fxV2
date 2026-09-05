/*
 * Smoke de la Room VibeOS (/creer/room).
 *
 * Le parcours reel, de bout en bout:
 *   Layout -> « Room »  |  Vision -> « Room »  ->  /creer/room
 *   -> l'ordre se change (fleches ET glisser-deposer)
 *   -> « Valider l'ordre » -> le carrousel de l'iPhone montre les memes images,
 *      dans le meme ordre.
 *
 * Ce que ce test verifie vraiment, et qu'aucun test unitaire ne verrait: que les
 * pixels envoyes par les deux ateliers arrivent bien dans la file, que l'ordre
 * affiche est celui du carrousel Instagram, et qu'un rechargement de page ne
 * perd rien (IndexedDB).
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

/* Deux photos franchement differentes: c'est a la couleur dominante qu'on
   reconnait quelle image est a quelle place dans le carrousel. */
const PHOTOS = [
  { id: "rouge", file: "room-rouge.png", filter: "color=c=0xd23b3b:s=800x1000" },
  { id: "bleu", file: "room-bleu.png", filter: "color=c=0x2b6fd2:s=800x1000" },
];

function makeFixtures() {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-room-"));
  const made = {};
  for (const photo of PHOTOS) {
    const file = path.join(dir, photo.file);
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", photo.filter, "-frames:v", "1", file,
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
    made[photo.id] = file;
  }
  return made;
}

/*
 * Ouvrir un ecran /creer, en passant le portail d'authentification.
 *
 * Deux lenteurs se cumulent sur un cache `.next` froid: la compilation de la
 * route, puis l'hydratation. Un clic pose sur le bouton encore non hydrate ne
 * declenche rien - d'ou la boucle, plutot qu'un clic unique a gros timeout.
 */
async function openScreen(page, path, testId) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  const screen = page.getByTestId(testId);
  const bypass = page.getByRole("button", { name: /contourner.*authentification/i });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await screen.isVisible().catch(() => false)) return;
    await bypass.click({ timeout: 20000 }).catch(() => {});
    await screen.waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  }
  await expect(screen).toBeVisible({ timeout: 30000 });
}

const openRoom = (page) => openScreen(page, "/creer/room", "vibeos-room-screen");

/* La couleur au centre de chaque vignette: la seule facon honnete de dire
   « c'est bien cette image-la, a cette place-la ». */
async function railColors(page) {
  return page.getByTestId("vibeos-room-card").locator("img").evaluateAll((nodes) => nodes.map((node) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.getContext("2d").drawImage(node, node.naturalWidth / 2, node.naturalHeight / 2, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = canvas.getContext("2d").getImageData(0, 0, 1, 1).data;
    return r > b + 40 ? "rouge" : b > r + 40 ? "bleu" : "autre";
  }));
}

test("Room: Layout et Vision remplissent la file, l'ordre se change et se retrouve dans l'iPhone", async ({ page }) => {
  test.setTimeout(420000);
  const fixtures = makeFixtures();
  test.skip(!fixtures, "ffmpeg-static indisponible: fixtures impossibles");

  /* La Room survit d'une session a l'autre: on part d'une file vide. */
  await openRoom(page);
  const clearButton = page.getByTestId("vibeos-room-clear");
  if (await clearButton.isEnabled()) {
    await clearButton.click();
    await clearButton.click();
  }
  await expect(page.getByTestId("vibeos-room-count")).toHaveText(/Aucune image/);

  // --- 1. Layout envoie son rendu ---
  await openScreen(page, "/creer/layout-visuel", "vibeos-layout-screen");
  await page.getByTestId("vibeos-image-input").setInputFiles(fixtures.rouge);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("vibeos-layout-send-room").click();
  await expect(page.getByTestId("vibeos-room-counter").first()).toHaveText("1", { timeout: 15000 });

  // --- 2. Vision envoie la sienne ---
  await openScreen(page, "/creer/vision", "vibeos-vision-screen");
  await page.getByTestId("vibeos-vision-input").setInputFiles(fixtures.bleu);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15000 });
  await page.getByTestId("vibeos-vision-send-room").click();
  await expect(page.getByTestId("vibeos-room-counter").first()).toHaveText("2", { timeout: 15000 });

  // --- 3. La file, dans l'ordre d'arrivee, apres un vrai rechargement ---
  await openRoom(page);
  await expect(page.getByTestId("vibeos-room-card")).toHaveCount(2);
  expect(await railColors(page)).toEqual(["rouge", "bleu"]);

  // --- 4. Reordonner a la fleche ---
  await page.getByTestId("vibeos-room-move-left").nth(1).click();
  await expect.poll(() => railColors(page)).toEqual(["bleu", "rouge"]);

  // --- 5. Reordonner au glisser-deposer (retour a l'ordre d'origine) ---
  const cards = page.getByTestId("vibeos-room-card");
  await cards.nth(0).dragTo(cards.nth(1));
  await expect.poll(() => railColors(page)).toEqual(["rouge", "bleu"]);

  // --- 6. Valider l'ordre, puis le carrousel de l'iPhone ---
  await page.getByTestId("vibeos-room-validate").click();
  const dialog = page.getByRole("dialog", { name: "Aperçu Instagram" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Aperçu Instagram sur iPhone 17 Pro")).toBeVisible();

  const first = dialog.getByRole("img", { name: "Visuel 1 de la publication Instagram" });
  await expect(first).toBeVisible({ timeout: 20000 });
  await expect(dialog.getByText("1/2")).toBeVisible();
  await dialog.getByRole("button", { name: "Image suivante" }).click();
  await expect(dialog.getByRole("img", { name: "Visuel 2 de la publication Instagram" })).toBeVisible();

  /* La 2e image du carrousel est bien la 2e image de la file - pas seulement
     « une image ». Le visuel du carrousel, pas la vignette de la pellicule. */
  const carouselColor = async (index) => dialog
    .getByRole("img", { name: `Visuel ${index} de la publication Instagram` })
    .evaluate((node) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      canvas.getContext("2d").drawImage(node, node.naturalWidth / 2, node.naturalHeight / 2, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = canvas.getContext("2d").getImageData(0, 0, 1, 1).data;
      return r > b + 40 ? "rouge" : b > r + 40 ? "bleu" : "autre";
    });
  expect(await carouselColor(2)).toBe("bleu");
  await dialog.getByRole("button", { name: "Image précédente" }).click();
  await expect(dialog.getByRole("img", { name: "Visuel 1 de la publication Instagram" })).toBeVisible();
  expect(await carouselColor(1)).toBe("rouge");

  await dialog.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByText("Ordre validé")).toBeVisible();

  // --- 7. Vider laisse la Room propre pour la prochaine execution ---
  await page.getByTestId("vibeos-room-clear").click();
  await page.getByTestId("vibeos-room-clear").click();
  await expect(page.getByTestId("vibeos-room-card")).toHaveCount(0);
});
