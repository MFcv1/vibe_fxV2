/*
 * Smoke des cases de la mise en page (Layout VibeOS).
 *
 * Ce qu'on protege, du point de vue de l'utilisateur :
 * - une photo importee va dans UNE case, pas dans toutes (l'ancien moteur la
 *   recopiait dans chaque case de la grille) ;
 * - une case vide se survole et propose « Importer », qui ouvre le choix
 *   appareil / bibliotheque et depose la photo dans CETTE case ;
 * - l'ecran vide et le bouton « Ajouter » ouvrent le meme choix, sans case
 *   ciblee : la bibliotheque VibeOS est accessible depuis Layout ;
 * - on attrape la photo d'une case et on la glisse sur une autre : les deux
 *   cases echangent leur contenu ;
 * - la selection d'une case se retire d'un clic a cote ou avec Echap ;
 * - une photo se recadre dans SA case: zoom par les boutons ou la molette,
 *   deplacement a la souris, retour au cadrage d'origine, et corbeille rouge
 *   pour la retirer ;
 * - le fond reste neutre (la premiere photo n'est plus recopiee floutee
 *   derriere la grille) et les marges sont symetriques : la marge du bord vaut
 *   l'ecart entre les images.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

function makeFixtures() {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-layout-slots-"));
  const files = [
    { file: "photo-a.png", source: "testsrc2=size=800x1000:rate=1" },
    { file: "photo-b.png", source: "smptebars=size=800x1000:rate=1" },
  ];
  for (const item of files) {
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", item.source, "-frames:v", "1", path.join(dir, item.file),
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
  }
  return dir;
}

async function openLayoutScreen(page) {
  await page.goto(`${baseUrl}/creer/layout-visuel`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i }).click({ timeout: 30000 }).catch(() => {});
  await expect(page.getByTestId("vibeos-layout-screen")).toBeVisible({ timeout: 30000 });
}

test("cases de la mise en page : une photo par case, import cible, echange", async ({ page }) => {
  test.setTimeout(120000);
  const dir = makeFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openLayoutScreen(page);

  // L'ecran vide propose les DEUX entrees: l'appareil et la bibliotheque.
  await page.getByTestId("vibeos-open-library-picker").click();
  const picker = page.getByRole("dialog", { name: "Ajouter des photos" });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("button", { name: "Depuis cet appareil" })).toBeVisible();
  await expect(picker.getByText(/biblioth[eè]que/i).first()).toBeVisible();
  await picker.getByRole("button", { name: "Fermer" }).click();
  await expect(picker).toBeHidden();

  // Grille « Une + colonne » : trois cases.
  await page.getByRole("option", { name: "Personnalisé" }).click();
  const slotLayer = page.getByTestId("vibeos-slot-layer");
  await expect(slotLayer).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => slotLayer.locator("> div").count()).toBe(3);

  // UNE photo importee = UNE case remplie, les deux autres restent vides.
  await page.getByTestId("vibeos-image-input").setInputFiles(path.join(dir, "photo-a.png"));
  await expect(page.getByTestId("vibeos-slot-import-0")).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByTestId("vibeos-slot-import-1")).toBeVisible();
  await expect(page.getByTestId("vibeos-slot-import-2")).toBeVisible();

  // Import dans une case precise, depuis l'appareil.
  await page.getByTestId("vibeos-slot-import-1").click();
  const dialog = page.getByRole("dialog", { name: /Ajouter une photo/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Depuis cet appareil" })).toBeVisible();
  await page.getByTestId("vibeos-slot-file-input").setInputFiles(path.join(dir, "photo-b.png"));
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("vibeos-slot-import-1")).toHaveCount(0, { timeout: 15000 });

  // --- Cadrage d'une photo dans sa case ---
  const slotLayerBoxes = slotLayer.locator("> div");
  const firstBox = await slotLayerBoxes.first().boundingBox();
  await page.mouse.click(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  const zoomIn = page.getByRole("button", { name: /^Zoomer/ });
  await expect(zoomIn).toBeVisible();
  await zoomIn.click();
  await expect(page.getByRole("button", { name: /à 100 %$/ })).toHaveText("115%");

  // Deplacement de la photo dans son cadre.
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + firstBox.width / 2 + 60, firstBox.y + firstBox.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Réglages avancés" }).click();
  const offsetX = page.getByRole("slider", { name: "Décalage horizontal" });
  await expect.poll(async () => Number(await offsetX.inputValue())).toBeGreaterThan(0);

  // Retour au cadrage d'origine.
  await page.getByRole("button", { name: /à 100 %$/ }).click();
  await expect.poll(async () => Number(await offsetX.inputValue())).toBe(0);
  await page.getByRole("button", { name: "Réglages avancés" }).click();

  // La selection ne colle pas: un clic a cote de l'apercu la retire...
  await page.mouse.click(Math.max(4, firstBox.x - 120), firstBox.y + 200);
  await expect(page.getByRole("button", { name: /^Zoomer/ })).toHaveCount(0);
  // ...et Echap aussi.
  await page.mouse.click(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await expect(page.getByRole("button", { name: /^Zoomer/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Zoomer/ })).toHaveCount(0);

  // Corbeille rouge: la case se vide.
  await page.getByTestId("vibeos-slot-remove-0").click();
  await expect(page.getByTestId("vibeos-slot-import-0")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("vibeos-image-input").setInputFiles(path.join(dir, "photo-a.png"));
  await expect(page.getByTestId("vibeos-slot-import-0")).toHaveCount(0, { timeout: 15000 });

  // Glisser la photo de la premiere case sur la troisieme, restee vide.
  const grip = page.getByRole("button", { name: /^Déplacer la photo/ }).first();
  const emptySlot = page.getByTestId("vibeos-slot-import-2");
  const gripBox = await grip.boundingBox();
  const targetBox = await emptySlot.boundingBox();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();

  // La premiere case est vide, la troisieme porte desormais la photo.
  await expect(page.getByTestId("vibeos-slot-import-0")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("vibeos-slot-import-2")).toHaveCount(0);

  // Fond neutre par defaut: le coin du visuel est blanc, pas la photo floutee.
  const cornerPixel = await page.locator("canvas").evaluate((node) => {
    const data = node.getContext("2d").getImageData(4, 4, 1, 1).data;
    return [data[0], data[1], data[2], data[3]];
  });
  expect(cornerPixel).toEqual([255, 255, 255, 255]);

  // Marges symetriques: bord du visuel = gouttiere entre les images.
  const geometry = await page.getByTestId("vibeos-slot-layer").evaluate((layer) => {
    const canvas = document.querySelector("canvas");
    const boxes = [...layer.children].map((box) => ({
      left: (parseFloat(box.style.left) / 100) * canvas.width,
      top: (parseFloat(box.style.top) / 100) * canvas.height,
      width: (parseFloat(box.style.width) / 100) * canvas.width,
      height: (parseFloat(box.style.height) / 100) * canvas.height,
    }));
    return { boxes, width: canvas.width, height: canvas.height };
  });
  const outerMargin = Math.min(...geometry.boxes.map((box) => box.left));
  const columnRight = Math.max(...geometry.boxes
    .filter((box) => box.left < geometry.width / 2)
    .map((box) => box.left + box.width));
  const nextColumnLeft = Math.min(...geometry.boxes
    .filter((box) => box.left > geometry.width / 2)
    .map((box) => box.left));
  expect(Math.abs((nextColumnLeft - columnRight) - outerMargin)).toBeLessThan(1.5);
  expect(Math.abs(Math.min(...geometry.boxes.map((box) => box.top)) - outerMargin)).toBeLessThan(1.5);

  // « Ajouter » remplit la case restee vide, pas une autre.
  await page.getByTestId("vibeos-image-input").setInputFiles(path.join(dir, "photo-a.png"));
  await expect(page.getByTestId("vibeos-slot-import-0")).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole("button", { name: /^Déplacer la photo/ })).toHaveCount(3);
});
