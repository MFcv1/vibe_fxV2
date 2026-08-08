/*
 * Parite de rendu: ancien Layout (/studio) vs nouveau Layout VibeOS
 * (/creer/layout-visuel).
 *
 * La parite est garantie par construction (les deux ecrans appellent le MEME
 * `renderPipeline` de vibefx-studio), mais elle n'etait pas mesuree. Ce smoke
 * la mesure vraiment: meme photo, meme format, meme modele, meme reglages des
 * deux cotes, puis comparaison pixel a pixel des deux canvas de composition.
 *
 * Deux precautions indispensables:
 *  - le grain est mis a 0 partout: le motif de bruit est tire au hasard a
 *    chaque chargement de page (`createNoisePattern`), il ne peut donc PAS etre
 *    identique entre deux onglets - meme entre deux visites de l'ancien ecran.
 *  - le texte de demonstration « Vibe_fx » de l'ancien ecran est supprime: le
 *    nouvel ecran demarre volontairement sans lui.
 */

const { test, expect } = require("@playwright/test");
const path = require("node:path");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const photoPath = path.join(process.cwd(), "public", "assets", "vibefx", "demo-astronaut.png");

/* Tolerance: 0 pixel d'ecart attendu. On garde un seuil de comparaison par
   canal (>2/255) pour ne pas transformer un arrondi de compositing en echec. */
const CHANNEL_TOLERANCE = 2;

/*
 * Le portail d'authentification est un composant client: en dev, le bouton de
 * contournement n'a d'effet qu'une fois React hydrate, et le serveur de dev
 * peut recharger la page en cours de compilation (l'utilisateur de dev est
 * alors perdu). On reclique donc jusqu'a ce que l'ecran vise soit visible et
 * le RESTE plusieurs secondes.
 */
async function passAuthGate(page, target, stableSeconds = 4) {
  const bypass = page.getByRole("button", { name: /contourner.*authentification/i });
  let stable = 0;
  for (let attempt = 0; attempt < 60 && stable < stableSeconds; attempt += 1) {
    if (await target.isVisible().catch(() => false)) {
      stable += 1;
    } else {
      stable = 0;
      if (await bypass.isVisible().catch(() => false)) await bypass.click().catch(() => {});
    }
    await page.waitForTimeout(1000);
  }
  await expect(target).toBeVisible();
}

async function readCanvasPng(page) {
  return page.locator("canvas").first().evaluate((canvas) => canvas.toDataURL("image/png"));
}

async function captureLegacyLayout(page) {
  await page.goto(`${baseUrl}/studio`, { waitUntil: "domcontentloaded" });
  /* Selon l'etat du compte, /studio ouvre soit le hall des publications, soit
     directement l'espace Layout. On traite les deux. */
  const entry = page.getByRole("button", { name: "Creer une mise en page", exact: true });
  const legacyRail = page.getByRole("complementary", { name: "Raccourcis de mise en page" });
  await passAuthGate(page, entry.or(legacyRail).first());
  if (await entry.isVisible().catch(() => false)) await entry.click();
  await passAuthGate(page, legacyRail);

  await page.locator('input[type="file"][multiple]').first().setInputFiles(photoPath);
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => canvas.evaluate((node) => node.width), { timeout: 20000 })
    .toBe(1080);

  /* Suppression du texte de demonstration: on le selectionne sur le canvas
     (il est ancre a x=0.5 / y=0.85) puis on utilise le bouton du panneau. */
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.85);
  const deleteText = page.getByRole("button", { name: /Supprimer ce module/ });
  await expect(deleteText).toBeVisible({ timeout: 10000 });
  await deleteText.click();

  /* Grain a 0 (« Texture Film »), dans l'accordeon Fond Global. */
  await page.getByRole("button", { name: "Ouvrir Fond Global" }).click();
  const grain = page.getByLabel("Texture Film (Grain visuel) valeur");
  await expect(grain).toBeVisible({ timeout: 10000 });
  await grain.fill("0");
  await grain.blur();
  await expect.poll(async () => grain.inputValue()).toBe("0");

  await page.waitForTimeout(600);
  return readCanvasPng(page);
}

async function captureVibeOsLayout(page) {
  await page.goto(`${baseUrl}/creer/layout-visuel`, { waitUntil: "domcontentloaded" });
  await passAuthGate(page, page.getByTestId("vibeos-layout-screen"));

  await page.getByTestId("vibeos-image-input").setInputFiles(photoPath);
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => canvas.evaluate((node) => node.width), { timeout: 20000 })
    .toBe(1080);

  const grain = page.getByRole("slider", { name: "Grain du fond" });
  await grain.fill("0");
  await expect(grain).toHaveValue("0");

  await page.waitForTimeout(600);
  return readCanvasPng(page);
}

test("layout VibeOS: parite pixel avec l'ancien ecran", async ({ page, context }) => {
  /* Deux applications a piloter, dont l'ancienne qui compile a la demande. */
  test.setTimeout(180_000);

  const legacyPng = await captureLegacyLayout(page);

  /* Contexte neuf: le projet VibeOS enregistre ne doit pas polluer la mesure. */
  const vibeosPage = await context.newPage();
  const vibeosPng = await captureVibeOsLayout(vibeosPage);

  const diff = await page.evaluate(async ([aUrl, bUrl, tolerance]) => {
    const load = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const [a, b] = await Promise.all([load(aUrl), load(bUrl)]);
    if (a.width !== b.width || a.height !== b.height) {
      return { sameSize: false, width: a.width, height: a.height, otherWidth: b.width, otherHeight: b.height };
    }
    const draw = (img) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, img.width, img.height).data;
    };
    const dataA = draw(a);
    const dataB = draw(b);
    let differing = 0;
    let maxChannelDelta = 0;
    for (let i = 0; i < dataA.length; i += 4) {
      let pixelDelta = 0;
      for (let c = 0; c < 4; c += 1) {
        pixelDelta = Math.max(pixelDelta, Math.abs(dataA[i + c] - dataB[i + c]));
      }
      if (pixelDelta > maxChannelDelta) maxChannelDelta = pixelDelta;
      if (pixelDelta > tolerance) differing += 1;
    }
    return {
      sameSize: true,
      width: a.width,
      height: a.height,
      differing,
      total: dataA.length / 4,
      maxChannelDelta,
    };
  }, [legacyPng, vibeosPng, CHANNEL_TOLERANCE]);

  expect(diff.sameSize).toBe(true);
  expect(diff.width).toBe(1080);
  expect(diff.height).toBe(1350);
  /* Le message d'echec porte l'ecart mesure: c'est la valeur qu'on veut lire. */
  expect(
    diff.differing,
    `pixels differents: ${diff.differing}/${diff.total} (ecart canal max ${diff.maxChannelDelta})`,
  ).toBe(0);

  await vibeosPage.close();
});
