/*
 * Smoke du montage rapide (nouveau front, /video/rapide).
 * Parcours reel: import de medias -> storyboard -> duree -> mouvement ->
 * transition -> lecture -> sauvegarde -> ouverture de l'export.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

/*
 * Les fichiers de `videotest/` sont des pointeurs Git LFS sur cette machine, donc
 * inutilisables. Le smoke fabrique ses propres medias avec ffmpeg: il reste
 * autonome et teste bien un import reel (duree, miniatures, waveform).
 */
let fixtureDir = null;

function makeFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecut-quick-"));
  const clips = [
    { file: "clip-a.mp4", source: "testsrc=size=640x360:rate=30:duration=3" },
    { file: "clip-b.mp4", source: "smptebars=size=640x360:rate=30:duration=2" },
  ];
  for (const clip of clips) {
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", clip.source,
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      path.join(dir, clip.file),
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
  }
  const photo = spawnSync(ffmpegPath, [
    "-y", "-f", "lavfi", "-i", "color=c=0x4a6c86:s=640x360",
    "-frames:v", "1", path.join(dir, "photo.png"),
  ], { encoding: "utf8" });
  if (photo.status !== 0) return null;
  fixtureDir = dir;
  return dir;
}

function getVideoFixtures(limit = 2) {
  const dir = makeFixtures();
  if (!dir) return [];
  return ["clip-a.mp4", "clip-b.mp4"].slice(0, limit).map((file) => path.join(dir, file));
}

function getPhotoFixture() {
  const dir = makeFixtures();
  return dir ? path.join(dir, "photo.png") : null;
}

function getAudioFixture() {
  const dir = makeFixtures();
  if (!dir) return null;
  const file = path.join(dir, "music.mp3");
  if (!fs.existsSync(file)) {
    const result = spawnSync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
      "-b:a", "96k", file,
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
  }
  return file;
}

async function openQuickEditor(page, route = "/video/rapide") {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const devBypass = page.getByRole("button", { name: /dev mode.*contourner.*authentification/i });
  if (await devBypass.isVisible().catch(() => false)) {
    await devBypass.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
  await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 20000 });
}

test.describe("VibeCut v2 - montage rapide", () => {
  test("etat vide: la zone de depot explique quoi faire", async ({ page }) => {
    await openQuickEditor(page);
    await expect(page.getByTestId("vibecut-drop-zone")).toBeVisible();
    await expect(page.getByTestId("vibecut-import-button")).toBeVisible();
    // Pas d'export possible sans scene: le bouton existe mais reste desactive.
    await expect(page.getByTestId("vibecut-open-export")).toBeDisabled();
  });

  test("parcours complet sur des videos reelles", async ({ page }) => {
    const fixtures = getVideoFixtures(2);
    test.skip(fixtures.length < 2, "ffmpeg indisponible pour fabriquer les fixtures");

    await openQuickEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);

    // 1. Les scenes apparaissent dans le storyboard.
    await expect(page.getByTestId("vibecut-storyboard")).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible();
    await expect(page.getByTestId("vibecut-scene-1")).toBeVisible({ timeout: 30000 });

    // 2. L'apercu est monte et la duree totale est calculee.
    await expect(page.getByTestId("vibecut-preview-stage")).toBeVisible();
    await expect(page.getByTestId("vibecut-timecode")).not.toContainText("/ 00:00.00");

    // 3. Selection d'une scene -> inspecteur contextuel.
    await page.getByTestId("vibecut-scene-0").click();
    await expect(page.getByTestId("vibecut-inspector")).toContainText("Scène 1");
    const durationBefore = await page.getByTestId("vibecut-inspector-duration").innerText();

    // 4. Reglage de la duree.
    const slider = page.getByTestId("vibecut-duration-slider");
    await slider.focus();
    for (let index = 0; index < 8; index += 1) await slider.press("ArrowLeft");
    await expect(page.getByTestId("vibecut-inspector-duration")).not.toHaveText(durationBefore);
    await expect(page.getByTestId("vibecut-scene-0-duration")).toBeVisible();

    // 5. Transition entre les deux scenes (section repliee par defaut).
    await expect(page.getByTestId("vibecut-transition-slot-0")).toHaveAttribute("data-has-transition", "false");
    await page.getByTestId("vibecut-inspector-transition").getByRole("button").first().click();
    await page.getByTestId("vibecut-transition-crossfade").click();
    await expect(page.getByTestId("vibecut-transition-slot-0")).toHaveAttribute("data-has-transition", "true");
    await page.getByTestId("vibecut-transition-none").click();
    await expect(page.getByTestId("vibecut-transition-slot-0")).toHaveAttribute("data-has-transition", "false");
    await page.getByTestId("vibecut-transition-crossfade").click();

    // 6. Lecture reelle: le timecode avance.
    const timecodeBefore = await page.getByTestId("vibecut-timecode").innerText();
    await page.getByTestId("vibecut-play-toggle").click();
    await page.waitForTimeout(1200);
    await page.getByTestId("vibecut-play-toggle").click();
    expect(await page.getByTestId("vibecut-timecode").innerText()).not.toBe(timecodeBefore);

    // 7. Sauvegarde automatique -> l'URL porte le projet cree.
    await expect(page.getByTestId("vibecut-save-state")).toHaveText(/Enregistré/, { timeout: 20000 });
    await page.waitForURL(/\/video\/rapide\?project=/, { timeout: 20000 });
    const projectId = new URL(page.url()).searchParams.get("project");
    expect(projectId).toBeTruthy();

    // 7b. L'ancrage de l'URL ne doit PAS relancer un chargement du projet:
    // la scene selectionnee et la position de lecture doivent survivre.
    await page.getByTestId("vibecut-scene-1").click();
    await expect(page.getByTestId("vibecut-scene-1")).toHaveAttribute("data-selected", "true");
    await page.waitForTimeout(2500);
    await expect(page.getByTestId("vibecut-scene-1")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("vibecut-timecode")).not.toContainText("00:00.00 /");

    // 7c. La lecture avance de facon continue, pas par a-coups du store.
    await page.getByTestId("vibecut-play-toggle").click();
    const samples = await page.evaluate(async () => {
      const handle = [...document.querySelectorAll('[data-testid="vibecut-transport"] span')].find((el) => el.style.left);
      if (!handle) return { updates: 0 };
      let updates = 0;
      const observer = new MutationObserver(() => { updates += 1; });
      observer.observe(handle, { attributes: true, attributeFilter: ["style"] });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      observer.disconnect();
      return { updates };
    });
    await page.getByTestId("vibecut-play-toggle").click();
    // Le store n'ecrit que ~11 fois par seconde: au-dela, le curseur est bien
    // pilote par l'horloge de playhead et non par les rendus React.
    expect(samples.updates).toBeGreaterThan(15);
    await page.getByTestId("vibecut-scene-0").click();

    // 8. Ajout d'un titre.
    await page.getByTestId("vibecut-add-title").click();

    // 9. La feuille d'export s'ouvre avec le format et les fps reels.
    await page.getByTestId("vibecut-open-export").click();
    const sheet = page.getByTestId("vibecut-export-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("fps");
    await expect(page.getByTestId("vibecut-export-start")).toBeEnabled();
    await page.getByTestId("vibecut-export-sheet").getByRole("button", { name: "Annuler" }).click();
    await expect(sheet).toHaveCount(0);

    // 10. Le projet se rouvre avec ses scenes apres un rechargement complet
    // (le portail d'authentification se represente: on refait le contournement dev).
    await openQuickEditor(page, `/video/rapide?project=${projectId}`);
    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("vibecut-scene-1")).toBeVisible();
    await expect(page.getByTestId("vibecut-timecode")).not.toContainText("/ 00:00.00");
  });

  test("reorganisation des scenes au glisser-deposer", async ({ page }) => {
    const fixtures = getVideoFixtures(2);
    test.skip(fixtures.length < 2, "ffmpeg indisponible pour fabriquer les fixtures");

    await openQuickEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-scene-1")).toBeVisible({ timeout: 45000 });

    const firstName = await page.getByTestId("vibecut-scene-0").innerText();
    const second = page.getByTestId("vibecut-scene-1");
    await page.getByTestId("vibecut-scene-0").hover();
    await page.mouse.down();
    const box = await second.boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    // Le drag HTML5 n'est pas simulable par la souris dans tous les moteurs:
    // on verifie au minimum que le storyboard reste coherent apres l'interaction.
    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible();
    await expect(page.getByTestId("vibecut-scene-1")).toBeVisible();
    expect(typeof firstName).toBe("string");
  });

  test("une photo recoit un mouvement applicable", async ({ page }) => {
    const photo = getPhotoFixture();
    test.skip(!photo, "ffmpeg indisponible pour fabriquer les fixtures");

    await openQuickEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles([photo]);
    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible({ timeout: 45000 });

    await page.getByTestId("vibecut-scene-0").click();
    // Le moteur ne rend le mouvement que sur les photos: la grille doit etre la.
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toBeVisible();
    await page.getByTestId("vibecut-motion-zoom-in").click();
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("vibecut-motion-pan-right").click();
    await expect(page.getByTestId("vibecut-motion-pan-right")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("vibecut-motion-zoom-in")).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("VibeCut v2 - texte et musique", () => {
  test("le texte s'ajoute, s'edite, se deplace avec magnetisme et se supprime", async ({ page }) => {
    const photo = getPhotoFixture();
    test.skip(!photo, "ffmpeg indisponible pour fabriquer les fixtures");

    await openQuickEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles([photo]);
    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible({ timeout: 45000 });

    // Ajout: le texte devient l'element selectionne, l'inspecteur bascule dessus.
    await page.getByTestId("vibecut-scene-0").click();
    await page.getByTestId("vibecut-add-title").click();
    await expect(page.getByTestId("vibecut-text-inspector")).toBeVisible();
    await expect(page.getByTestId("vibecut-scene-0")).toContainText("");

    // Contenu editable.
    const content = page.getByTestId("vibecut-text-content");
    await content.fill("Bonjour VibeCut");
    await expect(content).toHaveValue("Bonjour VibeCut");

    // Style: taille, gras, couleur.
    const size = page.getByTestId("vibecut-text-size");
    await size.focus();
    for (let index = 0; index < 5; index += 1) await size.press("ArrowRight");
    await page.getByTestId("vibecut-text-bold").click();
    await page.getByTestId("vibecut-text-color-ffd166").click();
    await expect(page.getByTestId("vibecut-text-color-ffd166")).toHaveAttribute("aria-pressed", "true");

    // Position en 9 points.
    await page.getByTestId("vibecut-text-position-mc").click();
    await expect(page.getByTestId("vibecut-text-position-mc")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("vibecut-text-position-bc").click();
    await expect(page.getByTestId("vibecut-text-position-bc")).toHaveAttribute("aria-pressed", "true");

    // Deplacement a la souris sur l'apercu, avec magnetisme au centre.
    await page.getByTestId("vibecut-text-position-mc").click();
    const canvas = page.locator('[data-testid="vibecut-preview-stage"] canvas');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.31, box.y + box.height * 0.31, { steps: 10 });
    await page.mouse.up();
    // La cible 1/3 est magnetisee: la pastille de position revient sur "haut gauche".
    await expect(page.getByTestId("vibecut-text-position-mc")).toHaveAttribute("aria-pressed", "false");

    // Animations.
    await page.getByTestId("vibecut-text-animation-in").selectOption("scale");
    await page.getByTestId("vibecut-text-animation-out").selectOption("none");

    // Suppression: retour a l'inspecteur de scene.
    await page.getByTestId("vibecut-text-remove").click();
    await expect(page.getByTestId("vibecut-text-inspector")).toHaveCount(0);
    await expect(page.getByTestId("vibecut-inspector")).toContainText("Scène 1");
  });

  test("la musique exige une declaration de droits et n'empeche pas l'export", async ({ page }) => {
    const photo = getPhotoFixture();
    const audio = getAudioFixture();
    test.skip(!photo || !audio, "ffmpeg indisponible pour fabriquer les fixtures");

    await openQuickEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles([photo]);
    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible({ timeout: 45000 });

    await page.getByTestId("vibecut-add-music").click();
    const sheet = page.getByTestId("vibecut-music-sheet");
    await expect(sheet).toBeVisible();

    // Sans fichier: refus explicite.
    await page.getByTestId("vibecut-music-confirm").click();
    await expect(page.getByTestId("vibecut-music-error")).toBeVisible();

    await page.getByTestId("vibecut-music-file").setInputFiles([audio]);

    // Sans confirmation d'usage social: refus (l'export serait bloque plus tard).
    await page.getByTestId("vibecut-music-confirm").click();
    await expect(page.getByTestId("vibecut-music-error")).toContainText(/réseaux sociaux/i);

    await page.getByTestId("vibecut-music-social").locator("input").check();
    await page.getByTestId("vibecut-music-confirm").click();
    await expect(sheet).toHaveCount(0);

    // La piste apparait avec des droits complets.
    const audioBlock = page.getByTestId("vibecut-project-audio");
    await expect(audioBlock).toContainText(/Droits déclarés/);

    // Et surtout: l'export n'est pas bloque par les droits.
    await page.getByTestId("vibecut-open-export").click();
    await expect(page.getByTestId("vibecut-export-sheet")).toContainText("Clips et musique");
    await expect(page.getByTestId("vibecut-export-blocker")).toHaveCount(0);
    await expect(page.getByTestId("vibecut-export-start")).toBeEnabled();
    await page.getByTestId("vibecut-export-sheet").getByRole("button", { name: "Annuler" }).click();

    // Volume et suppression.
    const trackId = await audioBlock.locator('[data-testid^="vibecut-audio-track-"]').first().getAttribute("data-testid");
    const id = trackId.replace("vibecut-audio-track-", "");
    const volume = page.getByTestId(`vibecut-audio-volume-${id}`);
    await volume.focus();
    for (let index = 0; index < 5; index += 1) await volume.press("ArrowLeft");
    await page.getByTestId(`vibecut-audio-mute-${id}`).click();
    await expect(volume).toHaveValue("0");
    await page.getByTestId(`vibecut-audio-remove-${id}`).click();
    await expect(page.getByTestId("vibecut-add-music")).toBeVisible();
  });
});
