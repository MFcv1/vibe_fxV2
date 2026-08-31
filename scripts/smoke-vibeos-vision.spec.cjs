/*
 * Smoke de l'ecran Vision VibeOS (/creer/vision, phase C).
 *
 * Deux tests:
 *  1. Parcours reel: import -> « Ameliorer ma photo » (phrase humaine + pixels
 *     qui changent) -> intensite -> application du preset, puis retrait par un
 *     second clic -> comparaison avant/apres -> garde-fous smartphone.
 *  2. Critere du plan §6 (phase C): sur 5 photos types (portrait, paysage,
 *     nuit, plate, deja saturee), AUCUN preset ne produit d'image grise ou
 *     cassee.
 *
 * Depuis le 2026-08-11 les 12 « looks » et la bibliotheque par marque n'existent
 * plus: Vision expose des presets compiles en LUT 3D
 * (`utils/visionPresets.js`). La science du preset lui-meme est verifiee a part,
 * sans navigateur, par `scripts/smoke-vision-preset.mjs`.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

/*
 * Photos de test fabriquees avec ffmpeg. Chacune vise un signal precis de
 * `visionMetrics`: teinte peau, ciel+verdure, nuit, image plate, saturation
 * deja poussee.
 */
const PHOTOS = [
  { id: "portrait", file: "portrait.png", filter: "color=c=0xd8a880:s=480x600" },
  { id: "paysage", file: "paysage.png", filter: "color=c=0x4a90d9:s=600x400" },
  {
    id: "nuit",
    file: "nuit.png",
    filter: "color=c=0x101828:s=600x400",
    /* Une vraie photo de nuit a des sources lumineuses: sans elles, la mesure
       ne teste qu'un rectangle noir. */
    extraFilter: "drawbox=x=400:y=80:w=110:h=110:color=0xffd08a@0.95:t=fill,drawbox=x=90:y=250:w=70:h=70:color=0x66d9ff@0.8:t=fill,gblur=sigma=14",
  },
  { id: "plate", file: "plate.png", filter: "color=c=0x8a8f92:s=600x400" },
  { id: "saturee", file: "saturee.png", filter: "color=c=0xff1e00:s=600x400" },
];

/*
 * Un GRAND aplat, sans bruit ajoute: c'est la fixture du test de zoom. Il faut
 * qu'elle soit large (4000 px) pour que l'apercu la REDUISE vraiment, et unie
 * pour que tout ce qui varie a l'ecran soit du grain et rien d'autre.
 */
const APLAT_ZOOM = { file: "aplat-large.png", filter: "color=c=0x808080:s=4000x2600" };

let fixtureDir = null;

function getFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-vision-"));
  for (const photo of PHOTOS) {
    /* Un degrade + du bruit leger: une aplat pur n'a aucune plage tonale et ne
       represente aucune photo reelle. */
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", photo.filter,
      "-vf", [photo.extraFilter, "noise=alls=18:allf=t+u", "gradfun"].filter(Boolean).join(","),
      "-frames:v", "1", path.join(dir, photo.file),
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
  }
  const aplat = spawnSync(ffmpegPath, [
    "-y", "-f", "lavfi", "-i", APLAT_ZOOM.filter,
    "-frames:v", "1", path.join(dir, APLAT_ZOOM.file),
  ], { encoding: "utf8" });
  if (aplat.status !== 0) return null;
  fixtureDir = dir;
  return dir;
}

async function openVisionScreen(page) {
  await page.goto(`${baseUrl}/creer/vision`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 30000 })
    .catch(() => {});
  await expect(page.getByTestId("vibeos-vision-screen")).toBeVisible({ timeout: 30000 });
}

/* Signature de l'image affichee: moyenne + ecart-type par canal. Sert a dire
   « l'image a change » et « l'image n'est pas grise/plate ». */
async function readCanvasStats(page) {
  return page.locator("canvas").first().evaluate((canvas) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    let maxChannelSpread = 0;
    for (let i = 0; i < data.length; i += 4 * 37) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += luma;
      sumSq += luma * luma;
      count += 1;
      maxChannelSpread = Math.max(maxChannelSpread, Math.max(r, g, b) - Math.min(r, g, b));
    }
    const mean = sum / count;
    return {
      mean,
      stdDev: Math.sqrt(Math.max(0, sumSq / count - mean * mean)),
      maxChannelSpread,
    };
  });
}

async function visiblePresetState(presetGrid) {
  return presetGrid.locator('[data-preset-id]').evaluateAll((cards) => {
    const visible = cards.filter((card) => {
      const box = card.getBoundingClientRect();
      const panel = card.closest('[class*="panel"]')?.getBoundingClientRect();
      const top = panel?.top ?? 0;
      const bottom = panel?.bottom ?? innerHeight;
      return box.bottom > top && box.top < bottom;
    });
    return {
      count: visible.length,
      ready: visible.filter((card) => card.dataset.previewReady === 'true').length,
    };
  });
}

test("vision VibeOS: analyse, amelioration, preset, comparaison", async ({ page }) => {
  test.setTimeout(120_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openVisionScreen(page);

  // Etat vide honnete.
  await expect(page.getByRole("button", { name: "Importer une photo" })).toBeVisible();
  await page.getByTestId("vibeos-vision-input").setInputFiles(path.join(dir, "portrait.png"));

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => canvas.evaluate((node) => node.width), { timeout: 15000 })
    .toBeGreaterThan(0);

  // Les presets sont rendus sur la VRAIE photo (vignettes en <img>).
  const presetGrid = page.getByTestId("vibeos-vision-presets");
  await presetGrid.scrollIntoViewIfNeeded();
  const presetCount = await presetGrid.locator("[data-preset-apply]").count();
  expect(presetCount).toBeGreaterThan(0);
  /* Contrat utile: les cartes sont la tout de suite, puis seul le viewport et
     sa zone de prechargement travaillent. Les 261 cartes hors ecran n'ont pas
     a etre calculees pour que la premiere rangee soit utilisable. */
  await expect.poll(async () => (await visiblePresetState(presetGrid)).ready, { timeout: 5000 })
    .toBeGreaterThan(0);
  await expect.poll(async () => {
    const state = await visiblePresetState(presetGrid);
    return state.count > 0 && state.ready === state.count;
  }, { timeout: 5000 }).toBe(true);
  expect(await presetGrid.locator("img").count()).toBeLessThan(presetCount);

  // La bibliotheque reste navigable quand les imports s'accumulent.
  const collectionTabs = page.getByTestId("vibeos-vision-preset-collections");
  const cinemaTab = collectionTabs.getByRole("tab", { name: /^Cinéma 10$/ });
  await expect(cinemaTab).toBeVisible();
  await cinemaTab.click();
  await expect(presetGrid.locator("[data-preset-apply]")).toHaveCount(10);
  await expect.poll(async () => presetGrid.locator("img").count(), { timeout: 5000 }).toBe(10);
  const presetSearch = page.getByTestId("vibeos-vision-preset-search");
  await presetSearch.fill("CN01");
  await expect(presetGrid.locator("[data-preset-apply]")).toHaveCount(1);
  await expect(presetGrid.locator('[data-preset-apply][aria-label^="CN01 "]')).toBeVisible();
  await presetSearch.fill("");

  const cinemaIITab = collectionTabs.getByRole("tab", { name: /Cinéma II/ });
  await expect(cinemaIITab).toBeVisible();
  await cinemaIITab.click();
  await expect(presetGrid.locator("[data-preset-apply]")).toHaveCount(8);
  await expect.poll(async () => presetGrid.locator("img").count(), { timeout: 5000 }).toBe(8);
  await presetSearch.fill("CN17");
  await expect(presetGrid.locator("[data-preset-apply]")).toHaveCount(1);
  await expect(presetGrid.locator('[data-preset-apply][aria-label^="CN17 "]')).toBeVisible();
  await presetSearch.fill("");
  const cn17Card = presetGrid.locator('[data-preset-id="cn17"]');
  const cn17Favorite = cn17Card.getByRole("button", { name: /Ajouter CN17 aux favoris/ });
  await cn17Favorite.click();
  await expect(cn17Card.getByRole("button", { name: /Retirer CN17 des favoris/ })).toHaveAttribute("aria-pressed", "true");
  const favoriteTab = collectionTabs.getByRole("tab", { name: /^Favoris 1$/ });
  await favoriteTab.click();
  await expect(presetGrid.locator("[data-preset-apply]")).toHaveCount(1);
  await expect(presetGrid.locator('[data-preset-apply][aria-label^="CN17 "]')).toBeVisible();
  await expect(presetGrid.locator('[data-preset-apply][aria-label^="CN17 "]')).toHaveAttribute("aria-pressed", "false");
  await collectionTabs.getByRole("tab", { name: /Tous/ }).click();
  await cinemaTab.click();
  /* Retour sur une collection deja visitee: les URLs du cache sont publiees
     sans repasser par le moteur. */
  await expect(presetGrid.locator("img")).toHaveCount(10, { timeout: 500 });
  await collectionTabs.getByRole("tab", { name: /Tous/ }).click();
  await expect(presetGrid.locator("[data-preset-apply]")).toHaveCount(presetCount);
  if (process.env.VIBEFX_PRESET_UI_SCREENSHOT) {
    await page.screenshot({ path: process.env.VIBEFX_PRESET_UI_SCREENSHOT });
  }
  if (process.env.VIBEFX_PRESET_UI_MOBILE_SCREENSHOT) {
    await page.setViewportSize({ width: 390, height: 844 });
    await presetSearch.scrollIntoViewIfNeeded();
    await page.screenshot({ path: process.env.VIBEFX_PRESET_UI_MOBILE_SCREENSHOT });
    await page.setViewportSize({ width: 1280, height: 720 });
  }

  // « Ameliorer ma photo »: phrase humaine + pixels reellement modifies.
  const before = await readCanvasStats(page);
  await page.getByTestId("vibeos-vision-auto").click();
  const message = page.getByTestId("vibeos-vision-message");
  await expect(message).toBeVisible();
  await expect(message).toContainText(/j’ai|j'ai/);
  await expect.poll(async () => {
    const after = await readCanvasStats(page);
    return Math.abs(after.mean - before.mean) + Math.abs(after.stdDev - before.stdDev);
  }, { timeout: 15000 }).toBeGreaterThan(0.5);

  // Intensite: a 0, le rendu revient a l'original.
  const intensity = page.getByRole("slider", { name: "Intensité" });
  await expect(intensity).toHaveValue("80");
  await intensity.fill("0");
  await expect.poll(async () => {
    const stats = await readCanvasStats(page);
    return Math.abs(stats.mean - before.mean);
  }, { timeout: 15000 }).toBeLessThan(1.5);
  await intensity.fill("80");

  /* Application du preset: la carte devient active et l'image change encore.
     Un second clic le retire — c'est la comparaison la plus directe. */
  const firstPreset = presetGrid.locator("[data-preset-apply]").first();
  const presetName = (await firstPreset.innerText()).split("\n")[0];
  const beforePreset = await readCanvasStats(page);
  await firstPreset.click();
  await expect(message).toContainText(presetName);
  await expect(firstPreset).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => {
    const after = await readCanvasStats(page);
    return Math.abs(after.mean - beforePreset.mean) + Math.abs(after.stdDev - beforePreset.stdDev);
  }, { timeout: 15000 }).toBeGreaterThan(0.5);

  await firstPreset.click();
  await expect(firstPreset).toHaveAttribute("aria-pressed", "false");
  await expect(message).toContainText("retiré");
  await firstPreset.click();

  /*
   * Un preset peut porter des effets qu'une LUT ne peut pas contenir (grain,
   * vignetage, relief). Deux choses doivent alors etre vraies, et elles se
   * verifient ici parce qu'aucune mesure de couleur ne les verrait:
   *   - le preset le DIT, au lieu de faire bouger des reglages en silence;
   *   - les reglages concernes portent vraiment la valeur du preset.
   */
  const showcase = presetGrid.locator("[data-preset-apply]").filter({ hasText: "Showcase" });
  if (await showcase.count()) {
    await showcase.first().click();
    await expect(message).toContainText("Il pose aussi");
    await page.getByTestId("vibeos-vision-advanced").getByRole("button").first().click();
    /* Les reglages qui ont bouge remontent en tete du panneau, dans « Modifiés ».
       Sans ca, il faut parcourir seize curseurs pour voir ce que le preset a
       pose. Le compteur doit couvrir au moins les trois cles du showcase. */
    const modifies = page.getByTestId("vibeos-vision-modifies");
    await expect(modifies).toBeVisible();
    expect(await modifies.getByRole("slider").count()).toBeGreaterThanOrEqual(3);
    const grain = page.getByRole("slider", { name: /^Grain/ });
    await expect(grain).toBeVisible();
    expect(Number(await grain.inputValue())).toBeGreaterThan(0);
    /* Retire le preset pour laisser l'ecran dans l'etat attendu par la suite. */
    await showcase.first().click();
    await page.getByTestId("vibeos-vision-advanced").getByRole("button").first().click();
    await firstPreset.click();
  }

  /* Comparaison: le rideau reste affiche sans maintenir le clic (c'etait le
     defaut de l'ancienne version), la poignee se deplace au clavier, et les
     trois modes existent. */
  const compareToggle = page.getByTestId("vibeos-vision-compare-toggle");
  await compareToggle.click();
  const original = page.getByTestId("vibeos-vision-compare-before");
  await expect(original).toBeVisible();
  const curtain = page.getByRole("slider", { name: "Position du rideau avant/après" });
  await expect(curtain).toHaveAttribute("aria-valuenow", "50");
  await curtain.focus();
  await page.keyboard.press("ArrowRight");
  await expect(curtain).toHaveAttribute("aria-valuenow", "52");

  await page.getByRole("tab", { name: "Côte à côte" }).click();
  await expect(original).toBeVisible();
  await page.getByRole("tab", { name: "Maintien" }).click();
  /* En mode maintien, l'original n'apparait que pendant l'appui. */
  await expect(original).toBeHidden();

  await page.getByRole("tab", { name: "Rideau" }).click();

  /* Regression : sur une photo VERTICALE, le cadre de comparaison doit garder
     exactement la place et le format de l'apercu normal. Il prenait toute la
     largeur de la scene et debordait en hauteur (« l'image passait en
     paysage »). */
  await page.getByTestId("vibeos-vision-input").setInputFiles(path.join(dir, "portrait.png"));
  await expect.poll(async () => page.locator("canvas").first().evaluate((node) => node.width),
    { timeout: 20000 }).toBeGreaterThan(0);
  const stage = await page.getByTestId("vibeos-vision-screen")
    .locator("section").first().boundingBox();
  const compared = await page.getByTestId("vibeos-vision-compare").boundingBox();
  /* Format d'origine conservé (la fixture portrait fait 480x600)... */
  expect(compared.width / compared.height).toBeCloseTo(0.8, 1);
  /* ...et le cadre reste DANS la scène, sans déborder. */
  expect(compared.height).toBeLessThanOrEqual(stage.height + 1);
  expect(compared.width).toBeLessThanOrEqual(stage.width + 1);

  await compareToggle.click();
  await expect(original).toBeHidden();

  /* « Retirer » vide l'apercu sans rien supprimer ailleurs. */
  await page.getByTestId("vibeos-vision-clear").click();
  await expect(page.getByRole("button", { name: "Importer une photo" })).toBeVisible();

  // Avances: garde-fous actifs par defaut.
  await page.getByRole("button", { name: "Réglages avancés" }).click();
  const guards = page.getByRole("tab", { name: "Actifs" });
  await expect(guards).toHaveAttribute("aria-selected", "true");

  // Garde anti-scroll desktop, panneau avance deplie.
  const pageScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(pageScrollable).toBe(false);
});

test("vision VibeOS: presets surs sur 5 photos types", async ({ page }) => {
  /* 181 presets × 5 photos depuis l'ajout des quatre saisons. Le test fait un
     vrai rendu canvas pour chacun: 240 s suffisait a 136 presets, plus depuis
     ce lot. La couverture reste exhaustive, seul le plafond suit le volume. */
  test.setTimeout(420_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openVisionScreen(page);

  const presetGrid = page.getByTestId("vibeos-vision-presets");

  for (const photo of PHOTOS) {
    await page.getByTestId("vibeos-vision-input").setInputFiles(path.join(dir, photo.file));
    await expect.poll(
      async () => page.locator("canvas").first().evaluate((node) => node.width),
      { timeout: 20000 },
    ).toBeGreaterThan(0);
    const count = await presetGrid.locator("[data-preset-apply]").count();
    expect(count).toBeGreaterThan(0);

    // Chaque preset est applique, puis mesure: ni gris plat, ni ecrase.
    for (let index = 0; index < count; index += 1) {
      const card = presetGrid.locator("[data-preset-apply]").nth(index);
      if ((await card.getAttribute("aria-pressed")) !== "true") await card.click();
      const label = (await card.innerText()).split("\n")[0];
      /* Le rendu passe par requestAnimationFrame: on attend que le canvas se
         stabilise avant de mesurer. */
      await page.waitForTimeout(120);
      const stats = await readCanvasStats(page);
      const context = `${photo.id} / ${label}`;
      expect(stats.mean, `${context}: image trop sombre`).toBeGreaterThan(8);
      expect(stats.mean, `${context}: image cramee`).toBeLessThan(247);
      /* Une source rouge presque uniforme peut garder peu de variation de
         luminance tout en restant franchement colorée. Elle n'est « grise et
         plate » que si la variation spatiale ET l'écart entre canaux sont bas. */
      expect(
        stats.stdDev > 1.5 || stats.maxChannelSpread > 12,
        `${context}: image plate/grise`,
      ).toBe(true);
    }
  }
});

/*
 * LE ZOOM MONTRE-T-IL LA MATIERE QUE « ADAPTER » MOYENNE ?
 *
 * Ce test existe parce que la question s'est posee deux fois le meme jour, dans
 * les deux sens. D'abord le grain etait beaucoup TROP fort a l'apercu: il etait
 * calcule pour la largeur du canvas (~800 px) au lieu de celle de la photo
 * (9180), soit 15,6/255 la ou Lightroom en pose 3,8. Puis, une fois corrige, il
 * a fallu un zoom pour pouvoir le VERIFIER a l'oeil — sur une photo reduite,
 * l'ecran moyenne les grains et on croit que le reglage ne fait rien.
 *
 * Ce qui est fige ici, ce n'est pas une valeur, c'est un RAPPORT: a 100 %, la
 * matiere doit etre franchement plus presente qu'a « Adapter ». Une valeur
 * absolue dependrait de la fenetre du navigateur; ce rapport, non.
 */
test("vision VibeOS: le zoom montre le grain que « Adapter » moyenne", async ({ page }) => {
  test.setTimeout(120_000);
  const dir = getFixtures();
  test.skip(!dir, "ffmpeg-static indisponible: fixtures impossibles");

  await openVisionScreen(page);
  await page.getByTestId("vibeos-vision-input").setInputFiles(path.join(dir, APLAT_ZOOM.file));
  const canvas = page.locator("canvas").first();
  await expect.poll(async () => canvas.evaluate((node) => node.width), { timeout: 20000 })
    .toBeGreaterThan(0);

  /* CN14 porte un grain 25 de Taille 10: c'est le preset qui a revele le bug. */
  await page.locator('[data-preset-apply][aria-label^="CN14 "]').click();
  await page.waitForTimeout(1500);

  const etiquette = page.getByTestId("vibeos-vision-zoom-label");
  await expect(etiquette).toHaveText("Adapter");
  const adapte = await readCanvasStats(page);

  /* L'etiquette est un bouton: au repos elle emmene au 1 pour 1. */
  await etiquette.click();
  await expect(etiquette).toHaveText("100 %");
  await page.waitForTimeout(1500);
  const zoome = await readCanvasStats(page);

  expect(zoome.stdDev).toBeGreaterThan(adapte.stdDev * 1.2);

  /* Et le retour: « Adapter » redonne la photo entiere. */
  await etiquette.click();
  await expect(etiquette).toHaveText("Adapter");
});
