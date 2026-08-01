/*
 * Smoke de la creation guidee (nouveau front, /video/guide).
 *
 * Parcours reel: import -> style -> rythme et mouvements -> son et texte ->
 * recapitulatif, puis reouverture du MEME projet dans le montage rapide.
 * Les valeurs verifiees sont celles du montage genere, pas celles annoncees.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const shotDir = process.env.VIBECUT_SHOT_DIR || null;

let fixtureDir = null;

/*
 * Les medias de `videotest/` sont des pointeurs Git LFS sur cette machine: le
 * smoke fabrique ses propres fichiers avec ffmpeg pour rester autonome et
 * tester un import reel (duree, miniatures, waveform).
 */
function makeFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecut-guided-"));
  const photos = ["#4a6c86", "#8a5a3c", "#3f6b4a", "#6b4a7a"];
  photos.forEach((color, index) => {
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", `color=c=${color.replace("#", "0x")}:s=720x1280`,
      "-frames:v", "1", path.join(dir, `photo-${index + 1}.png`),
    ], { encoding: "utf8" });
    if (result.status !== 0) throw new Error("ffmpeg photo failed");
  });
  const clip = spawnSync(ffmpegPath, [
    "-y", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=3",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(dir, "clip.mp4"),
  ], { encoding: "utf8" });
  if (clip.status !== 0) throw new Error("ffmpeg clip failed");
  const music = spawnSync(ffmpegPath, [
    "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=12",
    "-b:a", "96k", path.join(dir, "music.mp3"),
  ], { encoding: "utf8" });
  if (music.status !== 0) throw new Error("ffmpeg music failed");
  fixtureDir = dir;
  return dir;
}

function fixtures() {
  try {
    const dir = makeFixtures();
    if (!dir) return null;
    return {
      photos: [1, 2, 3, 4].map((index) => path.join(dir, `photo-${index}.png`)),
      clip: path.join(dir, "clip.mp4"),
      music: path.join(dir, "music.mp3"),
    };
  } catch {
    return null;
  }
}

async function shot(page, name) {
  if (!shotDir) return;
  fs.mkdirSync(shotDir, { recursive: true });
  // Les transitions du rail et des cartes durent jusqu'a 240 ms: on laisse
  // l'interface se poser, sinon la capture montre un etat intermediaire.
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: false });
}

/* Le rail doit toujours designer l'etape reellement affichee. */
async function expectStep(page, index, railId) {
  await expect(page.getByTestId("vibecut-guided-step-count")).toHaveText(`Étape ${index} sur 5`);
  await expect(page.getByTestId(`vibecut-guided-rail-${railId}`)).toHaveAttribute("aria-current", "step");
  // Et un seul a la fois.
  await expect(page.locator('[data-testid^="vibecut-guided-rail-"][aria-current="step"]')).toHaveCount(1);
  // Le haut de l'etape est visible: sa question n'est jamais hors champ.
  await expect(page.getByTestId("vibecut-guided-panel").locator("h1")).toBeInViewport();
}

async function openGuided(page, route = "/video/guide") {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const devBypass = page.getByRole("button", { name: /dev mode.*contourner.*authentification/i });
  if (await devBypass.isVisible().catch(() => false)) {
    await devBypass.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
  await expect(page.getByTestId("vibecut-guided-flow")).toBeVisible({ timeout: 20000 });
}

/* Lit la duree totale annoncee par le transport ("00:00.00 / 00:12.40"). */
async function readTotalDuration(page) {
  const text = await page.getByTestId("vibecut-timecode").innerText();
  const total = text.split("/")[1].trim();
  const [minutes, rest] = total.split(":");
  return Number(minutes) * 60 + Number(rest);
}

test.describe("VibeCut v2 - creation guidee", () => {
  test("etape 1: sans media, impossible de continuer", async ({ page }) => {
    const consoleErrors = [];
    // L'URL est indispensable: « Failed to load resource » sans elle ne dit rien.
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      consoleErrors.push(`${message.text()} :: ${message.location()?.url || "?"}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await openGuided(page);

    await expectStep(page, 1, "medias");
    await expect(page.getByTestId("vibecut-guided-drop-zone")).toBeVisible();
    await expect(page.getByTestId("vibecut-guided-next")).toBeDisabled();
    await expect(page.getByTestId("vibecut-guided-back")).toBeDisabled();
    // Les etapes suivantes ne sont pas atteignables tant que rien n'est importe.
    await expect(page.getByTestId("vibecut-guided-rail-final")).toBeDisabled();
    // Pas d'apercu tant qu'il n'y a rien a montrer.
    await expect(page.getByTestId("vibecut-guided-preview")).toHaveCount(0);
    await shot(page, "guide-01-medias-vide");

    // Firebase n'est pas configure dans le smoke: ses erreurs reseau sont attendues.
    const unexpected = consoleErrors.filter((text) => !/firebase|app ?check|auth\/|net::ERR/i.test(text));
    expect(unexpected, `erreurs console: ${unexpected.join(" | ")}`).toEqual([]);
  });

  test("parcours complet: la generation produit un montage verifiable", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    const consoleErrors = [];
    // L'URL est indispensable: « Failed to load resource » sans elle ne dit rien.
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      consoleErrors.push(`${message.text()} :: ${message.location()?.url || "?"}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await openGuided(page);

    /* --- Etape 1: medias --- */
    await page.getByTestId("vibecut-guided-media-input").setInputFiles([...files.photos, files.clip]);
    await expect(page.getByTestId("vibecut-guided-media-grid")).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId("vibecut-guided-media-4")).toBeVisible({ timeout: 45000 });
    await shot(page, "guide-02-medias-importes");

    // Une scene de trop se retire ici, avant tout reglage.
    await page.getByTestId("vibecut-guided-media-remove-4").click();
    await expect(page.getByTestId("vibecut-guided-media-4")).toHaveCount(0);
    await expect(page.getByTestId("vibecut-guided-media-3")).toBeVisible();

    await page.getByTestId("vibecut-guided-next").click();

    /* --- Etape 2: format et style --- */
    await expectStep(page, 2, "style");
    await expect(page.getByTestId("vibecut-guided-preview")).toBeVisible();
    await expect(page.getByTestId("vibecut-preview-stage")).toBeVisible();

    // Le style par defaut est deja applique: le montage a une duree reelle.
    await expect(page.getByTestId("vibecut-timecode")).not.toContainText("/ 00:00.00");
    const reelDuration = await readTotalDuration(page);
    await shot(page, "guide-03-style");

    // Changer de preset change vraiment le montage (durees + transitions).
    await page.getByTestId("vibecut-guided-style-cinema").click();
    await expect(page.getByTestId("vibecut-guided-style-cinema")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("vibecut-guided-style-reel")).toHaveAttribute("aria-checked", "false");
    await expect
      .poll(() => readTotalDuration(page), { timeout: 15000 })
      .not.toBe(reelDuration);
    const cinemaDuration = await readTotalDuration(page);
    expect(cinemaDuration).toBeGreaterThan(reelDuration);

    // Le format est un reglage secondaire de la meme etape.
    await page.getByRole("tab", { name: "1:1" }).click();
    await expect(page.getByRole("tab", { name: "1:1" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "9:16" }).click();

    await page.getByTestId("vibecut-guided-next").click();

    /* --- Etape 3: rythme et mouvements --- */
    await expectStep(page, 3, "rythme");
    await expect(page.getByTestId("vibecut-guided-rhythm-equilibre")).toHaveAttribute("aria-checked", "true");
    await shot(page, "guide-04-rythme");

    await page.getByTestId("vibecut-guided-rhythm-soutenu").click();
    await expect(page.getByTestId("vibecut-guided-rhythm-soutenu")).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(() => readTotalDuration(page), { timeout: 15000 })
      .toBeLessThan(cinemaDuration);
    const fastDuration = await readTotalDuration(page);

    await page.getByTestId("vibecut-guided-motion-varie").click();
    await expect(page.getByTestId("vibecut-guided-motion-varie")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("vibecut-guided-motion-doux")).toHaveAttribute("aria-checked", "false");

    /*
     * Intensite du mouvement (lot L3): trois crans nommes. Tant que rien n'est
     * choisi, c'est le preset qui donne le cran — « Cinema » est en Naturel.
     * Une fois pose, le choix tient, comme le rythme depuis le lot L2.
     */
    await expect(page.getByTestId("vibecut-guided-intensity-naturel")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("vibecut-guided-intensity-discret").click();
    await expect(page.getByTestId("vibecut-guided-intensity-discret")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("vibecut-guided-intensity-naturel")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("vibecut-guided-intensity-marque")).toHaveAttribute("aria-checked", "false");
    await shot(page, "guide-04b-intensite");

    await page.getByTestId("vibecut-guided-next").click();

    /* --- Etape 4: son et textes --- */
    await expectStep(page, 4, "son");

    await page.getByTestId("vibecut-guided-title-input").fill("Notre été");
    await page.getByTestId("vibecut-guided-title-add").click();
    await expect(page.getByTestId("vibecut-guided-title-remove")).toBeVisible();
    await expect(page.getByTestId("vibecut-guided-title-input")).toHaveValue("Notre été");

    await page.getByTestId("vibecut-guided-add-music").click();
    await page.getByTestId("vibecut-music-file").setInputFiles([files.music]);
    await page.getByTestId("vibecut-music-social").locator("input").check();
    await page.getByTestId("vibecut-music-confirm").click();
    await expect(page.getByTestId("vibecut-music-sheet")).toHaveCount(0);
    await expect(page.getByTestId("vibecut-guided-music")).toContainText("Droits déclarés");
    await shot(page, "guide-05-son");

    await page.getByTestId("vibecut-guided-next").click();

    /* --- Etape 5: recapitulatif --- */
    await expectStep(page, 5, "final");
    const summary = page.getByTestId("vibecut-guided-summary");
    await expect(summary).toBeVisible();

    // Le recapitulatif decrit le montage reel: 4 scenes, 3 fondus, un titre, une musique.
    // Depuis le lot L2 il annonce combien de coupes sur combien sont fondues, et
    // avec quels traitements: une valeur unique ne decrirait plus la partition.
    await expect(page.getByTestId("vibecut-guided-summary-scenes")).toContainText("4");
    await expect(page.getByTestId("vibecut-guided-summary-transition")).toContainText("3 sur 3 coupes");
    await expect(page.getByTestId("vibecut-guided-summary-transition")).toContainText("Fondu enchaîné");
    await expect(page.getByTestId("vibecut-guided-summary-motion")).toContainText("Varié");
    await expect(summary).toContainText("Notre été");
    await expect(page.getByTestId("vibecut-guided-export-note")).toBeVisible();

    // La duree annoncee est celle du montage joue par l'apercu.
    const summaryDuration = Number(
      (await page.getByTestId("vibecut-guided-summary-duration").innerText()).match(/([\d.]+)\s*s/)[1]
    );
    expect(Math.abs(summaryDuration - fastDuration)).toBeLessThan(0.6);
    await shot(page, "guide-06-final");

    /* --- Le projet est enregistre et partage avec les autres modes --- */
    await expect(page.getByTestId("vibecut-guided-save-state")).toHaveText(/Enregistré/, { timeout: 20000 });
    await page.waitForURL(/\/video\/guide\?project=/, { timeout: 20000 });
    const projectId = new URL(page.url()).searchParams.get("project");
    expect(projectId).toBeTruthy();

    const quickHref = await page.getByTestId("vibecut-guided-open-quick").getAttribute("href");
    expect(quickHref).toBe(`/video/rapide?project=${projectId}`);
    const advancedHref = await page.getByTestId("vibecut-guided-open-advanced").getAttribute("href");
    expect(advancedHref).toBe(`/video/avance?project=${projectId}`);

    /* --- Reouverture dans le montage rapide: tout est modifiable --- */
    await page.goto(`${baseUrl}${quickHref}`, { waitUntil: "domcontentloaded" });
    // En dev, /video/rapide peut etre compile a la volee: on laisse le reseau se
    // calmer avant de chercher l'editeur, sinon le smoke echoue sur la compilation.
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    const devBypass = page.getByRole("button", { name: /dev mode.*contourner.*authentification/i });
    if (await devBypass.isVisible().catch(() => false)) {
      await devBypass.click();
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    }
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });

    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("vibecut-scene-3")).toBeVisible();
    // Les fondus generes apparaissent bien entre les scenes du storyboard.
    await expect(page.getByTestId("vibecut-transition-slot-0")).toHaveAttribute("data-has-transition", "true");
    // Le mouvement genere est celui du motif varie: la premiere photo zoome.
    await page.getByTestId("vibecut-scene-0").click();
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");
    await shot(page, "guide-07-rouvert-en-rapide");

    /*
     * Generation puis reouverture: aucune erreur ne doit rester dans la console.
     * Firebase n'est pas configure dans le smoke, ses erreurs reseau sont attendues.
     */
    const unexpected = consoleErrors.filter((text) => !/firebase|app ?check|auth\/|net::ERR/i.test(text));
    expect(unexpected, `erreurs console: ${unexpected.join(" | ")}`).toEqual([]);
  });

  test("retour arriere: un choix se change sans perdre le montage", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    await openGuided(page);
    await page.getByTestId("vibecut-guided-media-input").setInputFiles(files.photos.slice(0, 3));
    await expect(page.getByTestId("vibecut-guided-media-2")).toBeVisible({ timeout: 45000 });

    await page.getByTestId("vibecut-guided-next").click();
    await page.getByTestId("vibecut-guided-style-reel").click();
    await page.getByTestId("vibecut-guided-next").click();
    await page.getByTestId("vibecut-guided-next").click();
    await page.getByTestId("vibecut-guided-next").click();

    // « Reel dynamique » coupe franchement: sur trois plans, son accent (tous les
    // quatre) ne tombe jamais, donc aucune transition minutee.
    await expect(page.getByTestId("vibecut-guided-summary-transition")).toHaveText(/Coupes franches/);

    // Retour libre par le rail, puis changement de style: le recapitulatif suit.
    await page.getByTestId("vibecut-guided-rail-style").click();
    await expectStep(page, 2, "style");
    await page.getByTestId("vibecut-guided-style-souvenir").click();
    await page.getByTestId("vibecut-guided-rail-final").click();
    await expect(page.getByTestId("vibecut-guided-summary-transition")).toContainText("2 sur 2 coupes");
    await expect(page.getByTestId("vibecut-guided-summary-transition")).toContainText("Dissolution film");
    await expect(page.getByTestId("vibecut-guided-summary-scenes")).toContainText("3");
  });

  /* ---------- Lot L4: cartes de preset sur les miniatures reelles ---------- */

  test("L4: sans media, les vignettes de preset retombent sur l'illustration", async ({ page }) => {
    await openGuided(page);
    /*
     * On atteint l'etape 2 sans rien importer: impossible par le bouton
     * « Continuer », donc on verifie le REPLI la ou il vit vraiment - la carte
     * doit rester demonstrative quand aucune miniature n'existe. On importe une
     * photo, on va a l'etape 2, puis on la retire.
     */
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    await page.getByTestId("vibecut-guided-media-input").setInputFiles(files.photos.slice(0, 1));
    await expect(page.getByTestId("vibecut-guided-media-0")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-guided-next").click();
    await expectStep(page, 2, "style");

    // Avec une miniature: la pellicule reelle est montee.
    await expect(
      page.getByTestId("vibecut-guided-style-reel").getByTestId("vibecut-preset-filmstrip")
    ).toHaveAttribute("data-source", "thumbnails");

    // Sans miniature: le repli SVG, et surtout PAS une carte vide.
    await page.getByTestId("vibecut-guided-rail-medias").click();
    await page.getByTestId("vibecut-guided-media-remove-0").click();
    await page.getByTestId("vibecut-guided-rail-style").click();
    await expectStep(page, 2, "style");
    const card = page.getByTestId("vibecut-guided-style-reel");
    await expect(card.getByTestId("vibecut-preset-filmstrip")).toHaveCount(0);
    await expect(card.locator("svg").first()).toBeVisible();
  });

  test("L4: les vignettes de preset utilisent les vraies miniatures", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    await openGuided(page);
    await page.getByTestId("vibecut-guided-media-input").setInputFiles(files.photos.slice(0, 3));
    await expect(page.getByTestId("vibecut-guided-media-2")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-guided-next").click();
    await expectStep(page, 2, "style");

    // Les six presets montrent tous une pellicule batie sur les photos importees.
    await expect(page.getByTestId("vibecut-preset-filmstrip")).toHaveCount(6);

    const strip = page.getByTestId("vibecut-guided-style-cinema").getByTestId("vibecut-preset-filmstrip");
    await expect(strip).toHaveAttribute("data-source", "thumbnails");
    // Trois panneaux, et leurs sources sont bien des miniatures du projet.
    const sources = await strip.locator("img").evaluateAll((nodes) => nodes.map((node) => node.src));
    expect(sources).toHaveLength(3);
    expect(sources.every((src) => src.startsWith("data:") || src.startsWith("blob:"))).toBe(true);

    /*
     * Deux presets voisins ne doivent pas montrer la MEME photo au meme instant:
     * sinon seul le look les separerait. Le decalage par carte est mesure, pas
     * suppose.
     */
    const first = await page.getByTestId("vibecut-guided-style-reel")
      .getByTestId("vibecut-preset-filmstrip").locator("img").first().getAttribute("src");
    const second = await page.getByTestId("vibecut-guided-style-cinema")
      .getByTestId("vibecut-preset-filmstrip").locator("img").first().getAttribute("src");
    expect(first).not.toEqual(second);

    await shot(page, "guide-L4-pellicules-reelles");
  });

  /* ---------- Lot L5: partition visible, titre et musique habilles ---------- */

  test("L5: la forme du montage se voit, et le rythme la comprime sans la deformer", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    await openGuided(page);
    await page.getByTestId("vibecut-guided-media-input").setInputFiles(files.photos);
    await expect(page.getByTestId("vibecut-guided-media-3")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-guided-next").click();

    // « Récit » est le preset dont les plans RACCOURCISSENT: c'est le cas le plus
    // lisible pour verifier que la pellicule montre bien une forme.
    await page.getByTestId("vibecut-guided-style-recit").click();
    await page.getByTestId("vibecut-guided-next").click();
    await expectStep(page, 3, "rythme");

    const strip = page.getByTestId("vibecut-guided-beatstrip");
    await expect(strip).toBeVisible();
    await expect(strip).toHaveAttribute("data-block-count", "4");

    const readShares = async () => strip.locator("[data-share]")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.dataset.share)));

    const shares = await readShares();
    expect(shares).toHaveLength(4);
    // La somme des parts fait bien 100 %: la pellicule represente tout le montage.
    expect(Math.abs(shares.reduce((total, share) => total + share, 0) - 100)).toBeLessThan(0.5);
    // Et « Récit » raccourcit: le plan 2 est plus court que le plan 1.
    expect(shares[1]).toBeLessThan(shares[0]);

    // Changer de rythme comprime le montage SANS changer sa forme: les PARTS
    // (donc les rapports entre plans) sont conservees.
    await page.getByTestId("vibecut-guided-rhythm-soutenu").click();
    const fastShares = await readShares();
    fastShares.forEach((share, index) => {
      expect(Math.abs(share - shares[index])).toBeLessThan(0.6);
    });

    await shot(page, "guide-L5-partition-visible");
  });

  test("L5: le preset habille vraiment le titre et la musique", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    await openGuided(page);
    await page.getByTestId("vibecut-guided-media-input").setInputFiles(files.photos.slice(0, 3));
    await expect(page.getByTestId("vibecut-guided-media-2")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-guided-next").click();

    // « Reel dynamique »: titre grand, centre, sur bloc, EN CAPITALES.
    await page.getByTestId("vibecut-guided-style-reel").click();
    await page.getByTestId("vibecut-guided-next").click();
    await page.getByTestId("vibecut-guided-next").click();
    await expectStep(page, 4, "son");

    // L'ecran ANNONCE le traitement: un reglage applique sans etre dit se lit
    // comme un bug.
    await expect(page.getByTestId("vibecut-guided-title-treatment")).toContainText("en capitales");
    await expect(page.getByTestId("vibecut-guided-audio-profile")).toContainText("0.8 s de fondu de sortie");

    await page.getByTestId("vibecut-guided-title-input").fill("mon titre");
    await page.getByTestId("vibecut-guided-title-add").click();

    // Et il l'APPLIQUE: le montage porte le titre en capitales, pas le texte brut.
    await page.getByTestId("vibecut-guided-next").click();
    await expect(page.getByTestId("vibecut-guided-summary-title")).toContainText("MON TITRE");
    await expect(page.getByTestId("vibecut-guided-summary-title")).toContainText("Grand");

    /*
     * Changer de preset re-style le titre DEJA pose - c'est tout l'objet du lot
     * L5 - et la mise en capitales reste REVERSIBLE, parce que le champ garde le
     * texte brut.
     */
    await page.getByTestId("vibecut-guided-rail-style").click();
    await page.getByTestId("vibecut-guided-style-cinema").click();
    await page.getByTestId("vibecut-guided-rail-final").click();
    await expect(page.getByTestId("vibecut-guided-summary-title")).toContainText("mon titre");
    await expect(page.getByTestId("vibecut-guided-summary-title")).toContainText("en bas");

    await shot(page, "guide-L5-titre-habille");
  });
});
