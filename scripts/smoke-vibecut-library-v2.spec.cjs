/*
 * Smoke des bibliotheques (phase 5) : /video/transitions et /video/mouvements.
 *
 * LECON DE METHODE APPLIQUEE (audit du 2026-07-31): les 24 tests de la phase 4
 * passaient alors que la colorimetrie « ne se voyait pas » et qu'aucune
 * transition n'etait posable - ils verifiaient que l'action ECRIT dans le
 * modele, jamais qu'elle SE VOIT.
 *
 * Ici on mesure donc les PIXELS des canvas d'apercu, et on verifie qu'un
 * controle absent est bien absent - pas qu'un libelle existe.
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
 * Deux photos de couleurs FRANCHEMENT differentes: une transition entre deux
 * images qui se ressemblent ne se mesure pas.
 */
function makeFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecut-library-"));
  ["0xff0000", "0x0000ff", "0x00ff00"].forEach((color, index) => {
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", `color=c=${color}:s=720x1280`,
      "-frames:v", "1", path.join(dir, `photo-${index + 1}.png`),
    ], { encoding: "utf8" });
    if (result.status !== 0) throw new Error("ffmpeg photo failed");
  });
  /*
   * Un CLIP VIDEO, pour le lot B3: les mouvements de camera s'appliquent
   * desormais aux videos, et rien ne le prouverait avec des photos seules.
   */
  const clip = spawnSync(ffmpegPath, [
    "-y", "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=2",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(dir, "clip.mp4"),
  ], { encoding: "utf8" });
  if (clip.status !== 0) throw new Error("ffmpeg clip failed");
  fixtureDir = dir;
  return dir;
}

function fixtures() {
  try {
    const dir = makeFixtures();
    if (!dir) return null;
    return {
      photos: [1, 2, 3].map((index) => path.join(dir, `photo-${index}.png`)),
      video: path.join(dir, "clip.mp4"),
    };
  } catch {
    return null;
  }
}

async function shot(page, name) {
  if (!shotDir) return;
  fs.mkdirSync(shotDir, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: false });
}

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

/*
 * Cree un projet reel via le montage rapide, puis renvoie son identifiant. Les
 * bibliotheques doivent s'ouvrir SUR CE PROJET pour montrer ses images.
 */
async function createProject(page, files) {
  await open(page, "/video/rapide");
  await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });
  await page.getByTestId("vibecut-media-input").setInputFiles(files.photos);
  await expect(page.getByTestId("vibecut-scene-2")).toBeVisible({ timeout: 45000 });
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get("project"), null, {
    timeout: 30000,
  });
  return new URL(page.url()).searchParams.get("project");
}

/* Moyenne RVB du canvas: c'est la mesure, pas la capture d'ecran. */
async function readCanvasAverage(locator) {
  return locator.evaluate((canvas) => {
    const ctx = canvas.getContext("2d");
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const pixels = data.length / 4;
    return { r: r / pixels, g: g / pixels, b: b / pixels };
  });
}

test.describe("VibeCut v2 - bibliotheque de transitions", () => {
  test("le catalogue dit la verite sur l'export, et rien de plus", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      consoleErrors.push(`${message.text()} :: ${message.location()?.url || "?"}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    // Ce n'est plus un ecran d'attente.
    await expect(page.getByTestId("vibecut-phase-placeholder")).toHaveCount(0);

    /*
     * LOT B3b : les 48 entrees du catalogue sont rendues a l'export, et il n'en
     * reste AUCUNE en « aperçu uniquement ». C'etait 15 sur 38 au lot L1, 33 sur
     * 48 au lot B3a.
     */
    await expect(page.locator('[data-testid^="vibecut-transition-card-"][data-exportable="true"]'))
      .toHaveCount(48);
    await expect(page.locator('[data-testid^="vibecut-transition-card-"][data-exportable="false"]'))
      .toHaveCount(0);

    /*
     * LES CINQ ENTREES DONT LE STATUT A CHANGE AU LOT B3b, une par famille
     * d'effet: un flou, un zoom, un stroboscope, une revelation par blocs, un
     * glitch. Verifier `crossfade`, exportable depuis toujours, ne prouverait
     * rien de ce lot-ci.
     */
    for (const id of ["blur-dissolve", "cross-zoom", "strobe-cut", "intro-grid-reveal", "glitch"]) {
      await expect(page.getByTestId(`vibecut-transition-card-${id}`)).toHaveAttribute("data-exportable", "true");
      await page.getByTestId(`vibecut-transition-card-${id}`).scrollIntoViewIfNeeded();
      await page.getByTestId(`vibecut-transition-card-${id}`).click();
      await expect(page.getByTestId("vibecut-transition-warning")).toHaveCount(0);
    }

    /*
     * LE BADGE A CHANGE DE ROLE. Il ne dit plus « Export Pro » - il le dirait de
     * quarante-huit cartes sur quarante-huit et ne distinguerait plus rien. Il
     * dit desormais ce qui varie encore: cette entree est-elle une OUVERTURE ou
     * une FIN de sequence ? (Decision produit du 2026-08-03.)
     */
    await expect(page.getByTestId("vibecut-transition-card-intro-grid-reveal")).toContainText("Ouverture");
    await expect(page.getByTestId("vibecut-transition-card-outro-neon-close")).toContainText("Fin");
    await expect(page.getByTestId("vibecut-transition-card-crossfade")).not.toContainText("Ouverture");

    // Et l'ecran EXPLIQUE l'usage, il ne se contente pas de l'etiqueter.
    await page.getByTestId("vibecut-transition-card-intro-title-scan").scrollIntoViewIfNeeded();
    await page.getByTestId("vibecut-transition-card-intro-title-scan").click();
    await expect(page.getByTestId("vibecut-transition-selected")).toHaveText("Ouverture titre");
    await expect(page.getByTestId("vibecut-transition-usage-note")).toContainText("démarrer une séquence");

    // Une transition de coupe ordinaire ne raconte pas d'histoire inutile.
    await page.getByTestId("vibecut-transition-card-dip-black").click();
    await expect(page.getByTestId("vibecut-transition-usage-note")).toHaveCount(0);
    await expect(page.getByTestId("vibecut-transition-warning")).toHaveCount(0);

    await shot(page, "lib-transitions-01-catalogue");

    const unexpected = consoleErrors.filter((text) => !/firebase|app ?check|auth\/|net::ERR/i.test(text));
    expect(unexpected, `erreurs console: ${unexpected.join(" | ")}`).toEqual([]);
  });

  test("sans projet, aucune coupe n'est proposee - et on le dit", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    /*
     * Verification par l'ABSENCE, pas par un libelle: sans deux plans il n'y a
     * aucune coupe, donc aucun bouton d'application ne doit exister. Un bouton
     * mort serait interdit (plan.md § 4.2).
     */
    await expect(page.getByTestId("vibecut-transition-apply")).toHaveCount(0);
    await expect(page.getByTestId("vibecut-transition-cut")).toHaveCount(0);
    await expect(page.getByText("Aucune coupe à traiter")).toBeVisible();
  });

  test("l'apercu est DESSINE par le moteur, et il bouge", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    const projectId = await createProject(page, files);
    await open(page, `/video/transitions?project=${projectId}`);
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    await page.getByTestId("vibecut-transition-card-crossfade").click();
    const canvas = page.getByTestId("vibecut-transition-panel-canvas");
    await expect(canvas).toBeVisible();

    /*
     * MESURE, pas capture: on lit la moyenne du canvas a deux instants. Un
     * apercu qui ne jouerait pas donnerait deux fois la meme valeur - c'est
     * exactement le defaut « ça ne se voit pas » de l'audit de la phase 4.
     */
    const samples = [];
    for (let index = 0; index < 8; index += 1) {
      samples.push(await readCanvasAverage(canvas));
      await page.waitForTimeout(180);
    }
    const reds = samples.map((sample) => sample.r);
    const spread = Math.max(...reds) - Math.min(...reds);
    expect(spread, `le canal rouge n'a pas bouge (${reds.join(", ")})`).toBeGreaterThan(8);

    // Les images viennent du projet: le rouge et le bleu importes se retrouvent.
    const maxRed = Math.max(...samples.map((sample) => sample.r));
    const maxBlue = Math.max(...samples.map((sample) => sample.b));
    expect(maxRed).toBeGreaterThan(80);
    expect(maxBlue).toBeGreaterThan(80);

    await shot(page, "lib-transitions-02-apercu-reel");
  });

  test("appliquer passe par le montage, et se voit dans le montage", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    const projectId = await createProject(page, files);
    await open(page, `/video/transitions?project=${projectId}`);
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    // Trois plans, donc deux coupes.
    const cutOptions = page.getByTestId("vibecut-transition-cut").locator("option");
    await expect(cutOptions).toHaveCount(2);

    await page.getByTestId("vibecut-transition-card-dip-black").click();
    await page.getByTestId("vibecut-transition-apply").click();
    await expect(page.getByTestId("vibecut-transition-notice")).toContainText("Passage au noir");

    // Le plafond des 45 % est annonce, et c'est la MEME regle que partout.
    await expect(page.getByTestId("vibecut-transition-ceiling")).toContainText("45 %");

    // Puis on le VERIFIE dans le montage rapide: le modele porte bien la coupe.
    await open(page, `/video/rapide?project=${projectId}`);
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId("vibecut-transition-slot-0"))
      .toHaveAttribute("data-has-transition", "true");
    // La seconde coupe, elle, n'a pas ete touchee.
    await expect(page.getByTestId("vibecut-transition-slot-1"))
      .toHaveAttribute("data-has-transition", "false");

    // Retour, application a TOUTES les coupes.
    await open(page, `/video/transitions?project=${projectId}`);
    await page.getByTestId("vibecut-transition-card-crossfade").click();
    await page.getByTestId("vibecut-transition-apply-all").click();
    await expect(page.getByTestId("vibecut-transition-notice")).toContainText("2 coupes");

    await open(page, `/video/rapide?project=${projectId}`);
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId("vibecut-transition-slot-1"))
      .toHaveAttribute("data-has-transition", "true");
  });
});

test.describe("VibeCut v2 - bibliotheque de mouvements", () => {
  test("les douze mouvements sont rendus, et le dernier annonce est devenu applicable", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      consoleErrors.push(`${message.text()} :: ${message.location()?.url || "?"}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await open(page, "/video/mouvements");
    await expect(page.getByTestId("vibecut-motion-library")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("vibecut-phase-placeholder")).toHaveCount(0);

    /*
     * DOUZE mouvements rendus des deux cotes, PLUS AUCUN annonce (2026-08-04).
     * Le lot B3 a fait passer descente, orbite, rebond, rotation et apparition
     * du cote rendu, la parallaxe a ete RETIREE - elle promettait une separation
     * des plans impossible sur une image plate - et le glitch a ete livre en
     * dernier.
     * Les nombres sont ecrits en clair et non deduits du catalogue: deduits, ils
     * suivraient n'importe quel ajout sans que personne ne se demande si le
     * moteur le rend vraiment.
     */
    await expect(page.locator('[data-testid^="vibecut-motion-card-"][data-available="true"]'))
      .toHaveCount(12);
    /*
     * ZERO entree non rendue. Cette assertion garde toute sa valeur maintenant
     * qu'elle attend zero: elle echouera le jour ou quelqu'un ajoutera au
     * catalogue une entree que le moteur ne rend pas, ce qui est exactement la
     * regle a proteger. Elle ne dit pas « il n'y en a plus », elle dit « il ne
     * doit pas y en avoir ».
     */
    await expect(page.locator('[data-testid^="vibecut-motion-card-"][data-available="false"]'))
      .toHaveCount(0);

    /*
     * `glitch` etait le DERNIER temoin de l'ancienne regle: annonce et non
     * applicable. Il est maintenant rendu, donc on verifie l'INVERSE de ce que
     * ce test verifiait avant - et c'est plus exigeant. Un mouvement rendu doit
     * porter ses reglages; les lui refuser serait un mouvement inutilisable, un
     * defaut symetrique du controle mort (defaut n° 32 de l'audit de phase 4).
     */
    await page.getByTestId("vibecut-motion-card-glitch").click();
    await expect(page.getByTestId("vibecut-motion-selected")).toHaveText("Glitch");
    await expect(page.getByTestId("vibecut-motion-warning")).toHaveCount(0);

    /*
     * LES REGLAGES SE VERIFIENT SUR UN PROJET QUI A DES PLANS, et ce detail a
     * ete paye: la version precedente de ce test affirmait que « Glitch n'offre
     * aucun reglage » en ouvrant la page SANS projet. Elle passait donc pour une
     * mauvaise raison - sans media, l'ecran montre un etat vide et AUCUN
     * mouvement n'affiche de reglage, rendu ou non. La preuve ne portait sur
     * rien. Un mouvement rendu doit porter ses reglages; les lui refuser serait
     * le defaut symetrique du controle mort (defaut n° 32 de l'audit de phase 4).
     */
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");
    const projectId = await createProject(page, files);
    await open(page, `/video/mouvements?project=${projectId}`);
    await expect(page.getByTestId("vibecut-motion-library")).toBeVisible({ timeout: 20000 });
    await page.getByTestId("vibecut-motion-card-glitch").click();
    await expect(page.getByTestId("vibecut-motion-intensity")).toBeVisible();
    await expect(page.getByTestId("vibecut-motion-apply")).toBeEnabled();

    const unexpected = consoleErrors.filter((text) => !/firebase|app ?check|auth\/|net::ERR/i.test(text));
    expect(unexpected, `erreurs console: ${unexpected.join(" | ")}`).toEqual([]);
  });

  test("la courbe lineaire est montree et desactivee, parce que l'export ne la rend pas", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    const projectId = await createProject(page, files);
    await open(page, `/video/mouvements?project=${projectId}`);
    await expect(page.getByTestId("vibecut-motion-library")).toBeVisible({ timeout: 20000 });

    await page.getByTestId("vibecut-motion-card-zoom-in").click();
    await expect(page.getByTestId("vibecut-motion-curve-smooth")).toHaveAttribute("aria-pressed", "true");
    // Visible - on dit ce qui manque - mais desactivee: aucune dette de parite.
    await expect(page.getByTestId("vibecut-motion-curve-linear")).toBeVisible();
    await expect(page.getByTestId("vibecut-motion-curve-linear")).toBeDisabled();
  });

  test("probleme I: le decalage reste borne par le zoom", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    const projectId = await createProject(page, files);
    await open(page, `/video/mouvements?project=${projectId}`);
    await expect(page.getByTestId("vibecut-motion-library")).toBeVisible({ timeout: 20000 });

    await page.getByTestId("vibecut-motion-card-pan-right").click();

    // Le cadrage precis est replie par defaut (lot B1) : six curseurs de
    // trajectoire n'ont pas a encombrer le panneau de qui veut juste choisir un
    // mouvement. On l'ouvre.
    await page.getByTestId("vibecut-motion-trajectory").getByRole("button").first().click();

    /*
     * On pousse le decalage au maximum du curseur (0,35) alors que le zoom ne
     * l'autorise pas: la valeur doit etre RAMENEE a (zoom - 1) / 2, sinon on
     * construirait ici un mouvement qui diverge entre apercu et export.
     */
    const scaleSlider = page.getByTestId("vibecut-motion-start-scale");
    // Playwright refuse « 1.10 » sur un `input[type=range]`: la valeur doit etre
    // ecrite exactement comme le champ la representerait.
    await scaleSlider.fill("1.1");
    const xSlider = page.getByTestId("vibecut-motion-start-x");
    await xSlider.fill("0.35");

    const applied = Number(await xSlider.inputValue());
    // (1,10 - 1) / 2 = 0,05
    expect(applied).toBeLessThanOrEqual(0.0501);

    // Sans zoom, le decalage n'a rien a aller chercher: le curseur est desactive.
    await scaleSlider.fill("1");
    await expect(page.getByTestId("vibecut-motion-start-x")).toBeDisabled();
    await expect(page.getByTestId("vibecut-motion-start-limit")).toContainText("Sans zoom");
  });

  test("appliquer un mouvement se voit dans le montage", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    const projectId = await createProject(page, files);
    await open(page, `/video/mouvements?project=${projectId}`);
    await expect(page.getByTestId("vibecut-motion-library")).toBeVisible({ timeout: 20000 });

    // L'apercu du panneau BOUGE: la transformation de production est bien jouee.
    await page.getByTestId("vibecut-motion-card-zoom-in").click();
    const canvas = page.getByTestId("vibecut-motion-panel-canvas");
    await expect(canvas).toBeVisible();

    await page.getByTestId("vibecut-motion-apply-all").click();
    /*
     * « plans » et non « photos » (lot B3): les mouvements de camera
     * s'appliquent desormais aux VIDEOS comme aux photos, et le libelle devait
     * cesser de dire le contraire.
     */
    await expect(page.getByTestId("vibecut-motion-notice")).toContainText("3 plans");

    // Verification dans le montage: les trois plans portent bien le zoom avant.
    await open(page, `/video/rapide?project=${projectId}`);
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-scene-0").click();
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("vibecut-scene-2").click();
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");

    await shot(page, "lib-mouvements-01-applique");
  });

  test("LOT B3: un mouvement s'applique aussi a une VIDEO", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    /*
     * Ce test existe parce que TOUS les autres tests de mouvement utilisent des
     * PHOTOS: le garde qui reservait le recadrage anime aux images pouvait donc
     * revenir sans qu'aucun ne le voie. On importe donc une vraie video, et on
     * verifie que la carte de mouvement est bien active dessus - pas seulement
     * que l'action a ete acceptee.
     */
    await open(page, "/video/rapide");
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-media-input").setInputFiles([files.video]);
    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible({ timeout: 45000 });

    await page.getByTestId("vibecut-scene-0").click();
    // La grille de mouvements EXISTE sur une video: avant le lot B3, cette
    // scene n'affichait qu'une phrase disant que c'etait reserve aux photos.
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toBeVisible();
    await page.getByTestId("vibecut-motion-zoom-in").click();
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");

    // Et il survit a un aller-retour: c'est le modele qui le porte, pas l'ecran.
    await page.waitForFunction(() => new URL(window.location.href).searchParams.get("project"), null, { timeout: 30000 });
    const projectId = new URL(page.url()).searchParams.get("project");
    await open(page, `/video/rapide?project=${projectId}`);
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-scene-0").click();
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");
  });

  test("LOT B3: un EFFET PENDANT LE PLAN se pose et se compose avec le mouvement", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    await open(page, "/video/rapide");
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-media-input").setInputFiles([files.photos[0]]);
    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-scene-0").click();

    // La secousse se pose sur un plan FIXE: c'est le cas le plus courant.
    await page.getByTestId("vibecut-accent-shake").click();
    await expect(page.getByTestId("vibecut-accent-shake")).toHaveAttribute("aria-pressed", "true");

    /*
     * PUIS on change de mouvement: l'accent doit SURVIVRE. C'est le piege exact
     * de cette fonction - envoyer le mouvement sous forme de chaine repasse par
     * le preset par defaut et efface l'accent, sans que rien ne le signale.
     */
    await page.getByTestId("vibecut-motion-zoom-in").click();
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("vibecut-accent-shake")).toHaveAttribute("aria-pressed", "true");

    // Et il survit au rechargement: c'est le modele qui le porte.
    await page.waitForFunction(() => new URL(window.location.href).searchParams.get("project"), null, { timeout: 30000 });
    const projectId = new URL(page.url()).searchParams.get("project");
    await open(page, `/video/rapide?project=${projectId}`);
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-scene-0").click();
    await expect(page.getByTestId("vibecut-accent-shake")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");
  });

  test("responsive 390 px: rien ne sort du cadre", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    // Le panneau reste atteignable, et la page ne defile jamais horizontalement.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth
      - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await shot(page, "lib-transitions-03-390px");
  });
});
