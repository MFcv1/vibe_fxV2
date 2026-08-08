/*
 * Smoke du montage avance (nouveau front, /video/avance).
 *
 * Porte les assertions de l'ancien `smoke-video-ui.spec.cjs` sur les nouveaux
 * `data-testid`: ordre des pistes, bascules visible/muet/verrouille, rognage au
 * pointeur, annuler/retablir, tete de lecture (glisse + clavier), decoupe,
 * vitesse, colorimetrie, transitions, magnetisme, audio, export.
 * S'y ajoute ce que l'ancien front ne pouvait pas verifier: un SEUL moteur
 * d'apercu pour les trois modes.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const shotDir = process.env.VIBECUT_SHOT_DIR || "";

let fixtureDir = null;

function makeFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecut-advanced-"));
  const clips = [
    { file: "prise-a.mp4", source: "testsrc=size=640x360:rate=30:duration=4" },
    { file: "prise-b.mp4", source: "smptebars=size=640x360:rate=30:duration=3" },
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
    "-frames:v", "1", path.join(dir, "photo-studio.png"),
  ], { encoding: "utf8" });
  if (photo.status !== 0) return null;
  fixtureDir = dir;
  return dir;
}

function getVideoFixtures(limit = 2) {
  const dir = makeFixtures();
  if (!dir) return [];
  return ["prise-a.mp4", "prise-b.mp4"].slice(0, limit).map((file) => path.join(dir, file));
}

function getPhotoFixture() {
  const dir = makeFixtures();
  return dir ? path.join(dir, "photo-studio.png") : null;
}

async function bypassAuth(page) {
  const devBypass = page.getByRole("button", { name: /dev mode.*contourner.*authentification/i });
  if (await devBypass.isVisible().catch(() => false)) {
    await devBypass.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
}

async function openAdvancedEditor(page, route = "/video/avance") {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await bypassAuth(page);
  await expect(page.getByTestId("vibecut-advanced-editor")).toBeVisible({ timeout: 20000 });
}

async function shoot(page, name) {
  if (!shotDir) return;
  fs.mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: false });
}

async function dragBy(page, locator, deltaX) {
  const box = await locator.boundingBox();
  expect(box, "l'element doit etre visible pour etre attrape").toBeTruthy();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + deltaX, y, { steps: 12 });
  await page.mouse.up();
}

test.describe("VibeCut v2 - montage avance", () => {
  /*
   * DEUX DEFAUTS TROUVES LE 2026-08-04 EN PILOTANT LE MONTAGE AVANCE SUR DE
   * VRAIS RUSHS, et pas par relecture. Ce test les verrouille.
   *
   *  1. Le bloc « Mouvement » etait pose sous `isImage` : un plan VIDEO n'en
   *     proposait aucun. Le garde n'avait plus lieu d'etre depuis le lot B3, qui
   *     a leve la restriction photo dans le moteur - le mode rapide et la
   *     bibliotheque avaient suivi, l'inspecteur avance non. L'interface la plus
   *     complete du produit etait donc la moins capable.
   *  2. Les cinq effets pendant le plan n'existaient QUE dans le mode rapide.
   *
   * Le troisieme controle est le plus subtil et n'a jamais echoue en production:
   * `setClipMotion` REMPLACE l'objet mouvement entier, donc choisir un preset
   * effacait l'accent pose a cote. Le mode rapide avait deja paye exactement ce
   * defaut (voir useScenes.js). On le verrouille ici avant qu'il ne se produise.
   */
  test("un plan VIDEO recoit mouvement ET effet, et choisir l'un n'efface pas l'autre", async ({ page }) => {
    const videos = getVideoFixtures(2);
    test.skip(videos.length < 2, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(videos);
    await expect(page.getByTestId("vibecut-item-video-1")).toBeVisible({ timeout: 45000 });

    await page.getByTestId("vibecut-item-video-0").click();

    // 1. Le bloc mouvement existe SUR UNE VIDEO.
    await expect(
      page.getByTestId("vibecut-inspector-motion"),
      "un plan video doit proposer les mouvements: le moteur les rend depuis le lot B3",
    ).toBeVisible();
    await page.getByTestId("vibecut-adv-motion-zoom-in").click();
    await expect(page.getByTestId("vibecut-adv-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");

    // 2. Les effets pendant le plan sont la, tous.
    await expect(page.getByTestId("vibecut-accent-row")).toBeVisible();
    for (const id of ["none", "shake", "pulse", "leak", "grain", "softness"]) {
      await expect(
        page.getByTestId(`vibecut-accent-${id}`),
        `l'effet « ${id} » doit etre proposable dans le montage avance`,
      ).toBeVisible();
    }

    // 3. Poser un effet NE DOIT PAS defaire le mouvement...
    await page.getByTestId("vibecut-accent-grain").click();
    await expect(page.getByTestId("vibecut-accent-grain")).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByTestId("vibecut-adv-motion-zoom-in"),
      "poser un effet a efface le mouvement",
    ).toHaveAttribute("aria-pressed", "true");

    // ... et changer de mouvement NE DOIT PAS defaire l'effet.
    await page.getByTestId("vibecut-adv-motion-pan-right").click();
    await expect(page.getByTestId("vibecut-adv-motion-pan-right")).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByTestId("vibecut-accent-grain"),
      "changer de mouvement a efface l'effet pose a cote",
    ).toHaveAttribute("aria-pressed", "true");

    await shoot(page, "advanced-motion-accent-video");
  });

  test("etat vide: l'ecran explique quoi faire, l'export reste ferme", async ({ page }) => {
    await openAdvancedEditor(page);
    await expect(page.getByTestId("vibecut-advanced-empty")).toBeVisible();
    await expect(page.getByTestId("vibecut-media-library")).toBeVisible();
    await expect(page.getByTestId("vibecut-timeline")).toBeVisible();
    await expect(page.getByTestId("vibecut-open-export")).toBeDisabled();
    await expect(page.getByTestId("vibecut-inspector-empty")).toBeVisible();
    await shoot(page, "advanced-empty");
  });

  /*
   * Timeline V2: quatre rangees REELLES au lieu de sept. Le modele canonique
   * garde ses sept pistes - c'est le contrat d'export - mais transitions,
   * effets et son des plans ne sont pas des pistes de montage: ils vivent SUR
   * le plan, comme dans DaVinci et Premiere.
   */
  test("les rangees d'affichage sont celles d'un vrai montage", async ({ page }) => {
    const fixtures = getVideoFixtures(1);
    test.skip(fixtures.length < 1, "ffmpeg indisponible pour fabriquer les fixtures");
    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-item-video-0")).toBeVisible({ timeout: 45000 });

    const visualOrder = await page.locator("[data-track-area]").evaluateAll((nodes) => nodes
      .map((node) => ({
        area: node.getAttribute("data-track-area"),
        order: Number(node.getAttribute("data-track-order")),
        top: node.getBoundingClientRect().top,
      }))
      .sort((a, b) => a.top - b.top));

    // La rangee des volets ne s'affiche que si elle porte quelque chose: une
    // rangee vide en permanence n'apprend rien et coute de la hauteur.
    expect(visualOrder.map((track) => track.area)).toEqual(["video", "text", "music"]);
    expect(visualOrder.map((track) => track.order)).toEqual([0, 1, 2]);

    // Aucune fausse piste ne subsiste.
    await expect(page.locator('[data-track-area="transition"]')).toHaveCount(0);
    await expect(page.locator('[data-track-area="effect"]')).toHaveCount(0);
    await expect(page.locator('[data-track-area="clip-audio"]')).toHaveCount(0);
  });

  test("bascules visible / muet / verrouille de chaque rangee", async ({ page }) => {
    await openAdvancedEditor(page);

    const textVisible = page.getByTestId("vibecut-track-text-main-visible");
    await expect(textVisible).toHaveAttribute("aria-pressed", "true");
    await textVisible.click();
    await expect(textVisible).toHaveAttribute("aria-pressed", "false");
    await textVisible.click();
    await expect(textVisible).toHaveAttribute("aria-pressed", "true");

    const musicMute = page.getByTestId("vibecut-track-music-main-mute");
    await expect(musicMute).toHaveAttribute("aria-pressed", "true");
    await musicMute.click();
    await expect(musicMute).toHaveAttribute("aria-pressed", "false");
    await musicMute.click();

    const videoLock = page.getByTestId("vibecut-track-video-main-lock");
    await videoLock.click();
    await expect(videoLock).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-track-area="video"]')).toHaveAttribute("data-track-locked", "true");
    await videoLock.click();
    await expect(page.locator('[data-track-area="video"]')).toHaveAttribute("data-track-locked", "false");
  });

  /*
   * Replier trois pistes ne doit rien RETIRER: masquer les transitions,
   * contourner la colorimetrie et couper le son des plans restent pilotables,
   * depuis la barre d'outils. Un bouton mort serait interdit (plan.md § 4.2).
   */
  test("les pistes repliees gardent leurs commandes", async ({ page }) => {
    const fixtures = getVideoFixtures(2);
    test.skip(fixtures.length < 2, "ffmpeg indisponible pour fabriquer les fixtures");
    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-item-video-1")).toBeVisible({ timeout: 45000 });

    for (const role of ["transition", "effect", "clip-audio"]) {
      await expect(page.getByTestId(`vibecut-fold-${role}`)).toBeVisible();
    }

    await page.getByTestId("vibecut-item-video-0").click();
    await page.getByTestId("vibecut-inspector-transition-next").getByRole("button").first().click();
    await page.getByTestId("vibecut-adv-transition-crossfade").click();
    await expect(page.locator('[data-track-item-type="transition"]')).toHaveCount(1);

    // Masquer les transitions les masque VRAIMENT.
    await page.getByTestId("vibecut-fold-transition").click();
    await expect(page.locator('[data-track-item-type="transition"]')).toHaveCount(0);
    await page.getByTestId("vibecut-fold-transition").click();
    await expect(page.locator('[data-track-item-type="transition"]')).toHaveCount(1);
  });

  test("parcours complet: import, rognage, annuler, decoupe, tete de lecture", async ({ page }) => {
    test.setTimeout(180000);
    const fixtures = getVideoFixtures(2);
    test.skip(fixtures.length < 2, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);

    // 1. Les clips arrivent sur la piste video, la bibliotheque les liste.
    await expect(page.getByTestId("vibecut-item-video-0")).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId("vibecut-item-video-1")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("vibecut-library-item-1")).toBeVisible();
    await expect(page.getByTestId("vibecut-timeline-total")).not.toHaveText("00:00.00");
    await shoot(page, "advanced-loaded");

    // 2. Selection -> inspecteur contextuel.
    await page.getByTestId("vibecut-item-video-0").click();
    await expect(page.getByTestId("vibecut-advanced-inspector")).toBeVisible();
    await expect(page.getByTestId("vibecut-inspector-speed")).toBeVisible();

    // 3. Rognage au pointeur sur la poignee de droite.
    const clipZero = page.locator('[data-track-item-type="video"]').first();
    const durationBefore = Number(await clipZero.getAttribute("data-track-item-duration"));
    await dragBy(page, page.getByTestId("vibecut-item-video-0-trim-end"), -90);
    await expect
      .poll(async () => Number(await clipZero.getAttribute("data-track-item-duration")))
      .toBeLessThan(durationBefore);

    // 4. Annuler / retablir remettent la duree d'avant, puis celle d'apres.
    const trimmed = Number(await clipZero.getAttribute("data-track-item-duration"));
    await page.getByTestId("vibecut-undo").click();
    await expect
      .poll(async () => Number(await clipZero.getAttribute("data-track-item-duration")))
      .toBeCloseTo(durationBefore, 2);
    await page.getByTestId("vibecut-redo").click();
    await expect
      .poll(async () => Number(await clipZero.getAttribute("data-track-item-duration")))
      .toBeCloseTo(trimmed, 2);

    // 5. Tete de lecture: glissement sur la reglette puis nudge clavier.
    const ruler = page.getByTestId("vibecut-timeline-ruler");
    const rulerBox = await ruler.boundingBox();
    await page.mouse.click(rulerBox.x + rulerBox.width * 0.35, rulerBox.y + rulerBox.height / 2);
    const playhead = page.getByTestId("vibecut-timeline-playhead");
    await expect.poll(async () => Number(await playhead.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    const afterDrag = Number(await playhead.getAttribute("aria-valuenow"));
    await playhead.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => Number(await playhead.getAttribute("aria-valuenow")))
      .toBeLessThan(afterDrag);

    // 6. Decoupe a la tete de lecture: un clip de plus.
    const clipsBefore = await page.locator('[data-track-item-type="video"]').count();
    await page.getByTestId("vibecut-item-video-0").click();
    await page.mouse.click(rulerBox.x + rulerBox.width * 0.12, rulerBox.y + rulerBox.height / 2);
    await page.getByTestId("vibecut-timeline-split").click();
    await expect(page.locator('[data-track-item-type="video"]')).toHaveCount(clipsBefore + 1);

    // 7. Zoom: la timeline s'etire vraiment.
    const widthBefore = (await page.locator('[data-track-item-type="video"]').first().boundingBox()).width;
    await page.getByTestId("vibecut-timeline-zoom-in").click();
    await expect
      .poll(async () => (await page.locator('[data-track-item-type="video"]').first().boundingBox()).width)
      .toBeGreaterThan(widthBefore);
    await page.getByTestId("vibecut-timeline-fit").click();

    // 8. Magnetisme: la bascule dit son etat.
    const snap = page.getByTestId("vibecut-timeline-snap");
    await expect(snap).toHaveAttribute("aria-pressed", "false");
    await snap.click();
    await expect(snap).toHaveAttribute("aria-pressed", "true");

    // 9. Sauvegarde automatique -> l'URL porte le projet.
    await expect(page.getByTestId("vibecut-save-state")).toHaveText(/Enregistré/, { timeout: 25000 });
    await page.waitForURL(/\/video\/avance\?project=/, { timeout: 25000 });
    await shoot(page, "advanced-edited");
  });

  test("piste video: glisser un clip le reordonne, un texte se deplace librement", async ({ page }) => {
    test.setTimeout(180000);
    const fixtures = getVideoFixtures(2);
    test.skip(fixtures.length < 2, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-item-video-1")).toBeVisible({ timeout: 45000 });

    // Sur la piste video, le modele pose les clips bout a bout: on ne les
    // deplace pas librement, on les REORDONNE. C'est ce que le glissement fait.
    const firstLabel = await page.getByTestId("vibecut-item-video-0").getAttribute("aria-label");
    const secondBox = await page.getByTestId("vibecut-item-video-1").boundingBox();
    const firstBox = await page.getByTestId("vibecut-item-video-0").boundingBox();
    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(secondBox.x + secondBox.width * 0.9, secondBox.y + secondBox.height / 2, { steps: 14 });
    await expect(page.getByTestId("vibecut-timeline-drop-indicator")).toBeVisible();
    await page.mouse.up();
    await expect
      .poll(async () => page.getByTestId("vibecut-item-video-0").getAttribute("aria-label"))
      .not.toBe(firstLabel);

    // Un texte, lui, a un debut qui est une DONNEE: il se deplace vraiment.
    await page.getByTestId("vibecut-item-video-0").click();
    await page.getByTestId("vibecut-add-title").click();
    const textItem = page.locator('[data-track-item-type="text"]').first();
    await expect(textItem).toBeVisible();
    const startBefore = Number(await textItem.getAttribute("data-track-item-start"));
    await dragBy(page, page.getByTestId("vibecut-item-text-0"), 120);
    await expect
      .poll(async () => Number(await textItem.getAttribute("data-track-item-start")))
      .toBeGreaterThan(startBefore);
    await shoot(page, "advanced-reorder");
  });

  test("inspecteur: vitesse annoncee apercu seulement, colorimetrie exportable", async ({ page }) => {
    test.setTimeout(150000);
    const fixtures = getVideoFixtures(1);
    test.skip(fixtures.length < 1, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-item-video-0")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-item-video-0").click();

    // Vitesse: le moteur d'apercu la joue, le renderer serveur non. On le DIT.
    await page.getByTestId("vibecut-inspector-speed").getByRole("button").first().click();
    await page.getByTestId("vibecut-speed-2").click();
    await expect(page.getByTestId("vibecut-speed-2")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("vibecut-speed-warning")).toBeVisible();
    await expect(page.getByTestId("vibecut-inspector-speed")).toContainText(/Apercu uniquement|Aperçu uniquement/i);
    // ... et l'export refuse explicitement, il ne rend pas autre chose en silence.
    await page.getByTestId("vibecut-open-export").click();
    await expect(page.getByTestId("vibecut-export-preflight")).toHaveAttribute("data-preflight-status", "blocked");
    await expect(page.getByTestId("vibecut-export-pro-blocker")).toContainText(/Vitesse/i);
    await page.getByTestId("vibecut-export-pro-sheet").getByRole("button", { name: "Annuler" }).click();
    await page.getByTestId("vibecut-speed-1").click();

    // Colorimetrie: un badge apparait SUR le plan - elle est un attribut du
    // plan, pas une piste. L'absence de badge au depart compte autant que sa
    // presence ensuite.
    await expect(page.getByTestId("vibecut-clip-0-badge-color")).toHaveCount(0);
    await page.getByTestId("vibecut-inspector-color").getByRole("button").first().click();
    const contrast = page.getByTestId("vibecut-color-contrast");
    await contrast.focus();
    for (let index = 0; index < 6; index += 1) await contrast.press("ArrowRight");
    await expect(page.getByTestId("vibecut-clip-0-badge-color")).toBeVisible();
    await shoot(page, "advanced-inspector");
  });

  test("mouvement d'une photo: curseur d'intensite continu", async ({ page }) => {
    test.setTimeout(150000);
    const photo = getPhotoFixture();
    test.skip(!photo, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles([photo]);
    await expect(page.getByTestId("vibecut-item-video-0")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-item-video-0").click();

    // Le moteur ne rend le mouvement que sur les photos: la grille doit etre la.
    await expect(page.getByTestId("vibecut-inspector-motion")).toBeVisible();
    await page.getByTestId("vibecut-adv-motion-zoom-in").click();
    await expect(page.getByTestId("vibecut-adv-motion-zoom-in")).toHaveAttribute("aria-pressed", "true");

    // Le curseur continu est la nouveaute du montage avance (les trois crans
    // nommes restent a la creation guidee).
    const intensity = page.getByTestId("vibecut-motion-intensity");
    await expect(intensity).toBeEnabled();
    await expect(page.getByTestId("vibecut-motion-intensity-value")).toHaveText("100 %");
    await intensity.focus();
    for (let index = 0; index < 4; index += 1) await intensity.press("ArrowLeft");
    await expect(page.getByTestId("vibecut-motion-intensity-value")).toHaveText("80 %");

    // Aucun mouvement -> le curseur n'a plus de sens et le dit.
    await page.getByTestId("vibecut-adv-motion-none").click();
    await expect(intensity).toBeDisabled();
    // Un seul mouvement actif: revenir a « Fixe » doit VRAIMENT relacher le zoom,
    // pas seulement changer l'etiquette.
    await expect(page.getByTestId("vibecut-adv-motion-none")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("vibecut-adv-motion-zoom-in")).toHaveAttribute("aria-pressed", "false");
    const frames = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="vibecut-preview-canvas"]');
      return canvas ? canvas.dataset.empty : "absent";
    });
    expect(frames).toBe("false");
    await shoot(page, "advanced-motion");
  });

  /*
   * Audit du 2026-07-31: on pouvait regler la colorimetrie, le mouvement ou la
   * rotation d'un plan que l'apercu n'affichait pas. Le reglage s'appliquait,
   * mais rien ne le montrait - « ca ne se voit pas ». La tete de lecture
   * rejoint donc l'element choisi quand elle n'est pas deja dedans.
   */
  test("selectionner un element amene la tete de lecture dessus", async ({ page }) => {
    test.setTimeout(150000);
    const fixtures = getVideoFixtures(2);
    test.skip(fixtures.length < 2, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-item-video-1")).toBeVisible({ timeout: 45000 });

    const playheadTime = () => page.getByTestId("vibecut-timeline-playhead").getAttribute("aria-valuenow");
    // `data-track-item-start` vit sur l'enveloppe de l'element, pas sur le
    // bouton qui porte le testid.
    const secondStart = Number(
      await page.locator('[data-track-item-type="video"]').nth(1).getAttribute("data-track-item-start"),
    );
    expect(secondStart).toBeGreaterThan(0);

    await page.getByTestId("vibecut-item-video-0").click();
    expect(Number(await playheadTime())).toBeLessThan(secondStart);

    await page.getByTestId("vibecut-item-video-1").click();
    const onSecond = Number(await playheadTime());
    expect(onSecond).toBeGreaterThanOrEqual(secondStart);

    // Deja dans l'element: on ne rejoue pas le saut, sinon chaque clic
    // reperdrait la position de travail.
    await page.getByTestId("vibecut-item-video-1").click();
    expect(Number(await playheadTime())).toBeCloseTo(onSecond, 2);
  });

  /*
   * Un element de la piste Effets EST la colorimetrie d'un clip: il n'a pas
   * d'inspecteur propre. Le clic vidait donc toute la selection, ce qui donnait
   * un element mort. Il renvoie desormais vers son clip.
   */
  /*
   * Les badges remplacent les fausses pistes. Un badge n'est pas une decoration:
   * il selectionne son plan ET ouvre le reglage qu'il annonce.
   */
  test("un badge de plan ouvre le reglage qu'il annonce", async ({ page }) => {
    const fixtures = getVideoFixtures(2);
    test.skip(fixtures.length < 2, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-item-video-1")).toBeVisible({ timeout: 45000 });

    await page.getByTestId("vibecut-item-video-1").click();
    await page.getByTestId("vibecut-inspector-color").getByRole("button").first().click();
    const contrast = page.getByTestId("vibecut-color-contrast");
    await contrast.focus();
    for (let index = 0; index < 6; index += 1) await contrast.press("ArrowRight");

    const badge = page.getByTestId("vibecut-clip-1-badge-color");
    await expect(badge).toBeVisible();

    // On part sur un AUTRE plan, puis on revient par le badge.
    await page.getByTestId("vibecut-item-video-0").click();
    await expect(page.getByTestId("vibecut-inspector-title")).toContainText("prise-a");

    await badge.click();
    await expect(page.getByTestId("vibecut-inspector-empty")).toHaveCount(0);
    await expect(page.getByTestId("vibecut-inspector-kind")).toHaveText("Plan vidéo");
    await expect(page.getByTestId("vibecut-inspector-title")).toContainText("prise-b");
    // ...et la section annoncee par le badge est ouverte.
    await expect(
      page.getByTestId("vibecut-inspector-color").getByRole("button").first(),
    ).toHaveAttribute("aria-expanded", "true");
  });

  /*
   * Le trou du montage avance: la piste Transitions existait, aucun controle ne
   * permettait d'en poser une. Elle se regle desormais sur le plan qui la
   * precede, par la meme action `applyTransition` que le montage rapide.
   */
  test("transitions: on peut en poser une, la doser et l'appliquer partout", async ({ page }) => {
    test.setTimeout(180000);
    const fixtures = getVideoFixtures(2);
    const photo = getPhotoFixture();
    test.skip(fixtures.length < 2 || !photo, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles([...fixtures, photo]);
    await expect(page.getByTestId("vibecut-item-video-2")).toBeVisible({ timeout: 45000 });

    // Aucune transition au depart: la piste est vide, pas « pleine par defaut ».
    await expect(page.locator('[data-track-item-type="transition"]')).toHaveCount(0);

    await page.getByTestId("vibecut-item-video-0").click();
    const panel = page.getByTestId("vibecut-inspector-transition-next");
    await expect(panel).toBeVisible();
    await panel.getByRole("button").first().click();

    await page.getByTestId("vibecut-adv-transition-dip-black").click();
    await expect(page.getByTestId("vibecut-adv-transition-dip-black")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-track-item-type="transition"]')).toHaveCount(1);

    // La duree choisie se retrouve sur l'element de la piste.
    await page.getByTestId("vibecut-adv-transition-duration").fill("1.2");
    await expect(page.locator('[data-track-item-type="transition"]').first())
      .toHaveAttribute("data-track-item-duration", /^1\.2/);

    await page.getByTestId("vibecut-adv-transition-all").click();
    await expect(page.locator('[data-track-item-type="transition"]')).toHaveCount(2);

    // Retour a la coupe franche: la transition disparait vraiment.
    await page.getByTestId("vibecut-adv-transition-none").click();
    await expect(page.locator('[data-track-item-type="transition"]')).toHaveCount(1);

    // Le dernier plan n'a pas de suivant: pas de section, donc pas de promesse.
    await page.getByTestId("vibecut-item-video-2").click();
    await expect(page.getByTestId("vibecut-inspector-transition-next")).toHaveCount(0);
    await shoot(page, "advanced-transitions");
  });

  test("bibliotheque: recherche et tri", async ({ page }) => {
    test.setTimeout(150000);
    const fixtures = getVideoFixtures(2);
    test.skip(fixtures.length < 2, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-library-item-1")).toBeVisible({ timeout: 45000 });

    await page.getByTestId("vibecut-library-search").fill("prise-b");
    await expect(page.getByTestId("vibecut-library-item-0")).toContainText("prise-b");
    await expect(page.getByTestId("vibecut-library-item-1")).toHaveCount(0);

    await page.getByTestId("vibecut-library-search").fill("introuvable");
    await expect(page.getByTestId("vibecut-library-list")).toContainText("Aucun résultat");

    await page.getByTestId("vibecut-library-search").fill("");
    await page.getByTestId("vibecut-library-sort").selectOption("duration");
    // prise-a dure 4 s, prise-b 3 s: la plus longue passe en tete.
    await expect(page.getByTestId("vibecut-library-item-0")).toContainText("prise-a");

    // Cliquer un media selectionne son clip: l'inspecteur suit.
    await page.getByTestId("vibecut-library-item-0").click();
    await expect(page.getByTestId("vibecut-inspector-title")).toContainText("prise-a");
  });

  test("export professionnel: cadence jusqu'a 60 fps et pre-vol reel", async ({ page }) => {
    test.setTimeout(150000);
    const fixtures = getVideoFixtures(1);
    test.skip(fixtures.length < 1, "ffmpeg indisponible pour fabriquer les fixtures");

    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-item-video-0")).toBeVisible({ timeout: 45000 });

    await page.getByTestId("vibecut-open-export").click();
    const sheet = page.getByTestId("vibecut-export-pro-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("vibecut-export-pro-format")).toContainText("1080×1920");
    await expect(page.getByTestId("vibecut-export-audio-mix")).toHaveText("Clips et musique");
    await expect(page.getByTestId("vibecut-export-preflight"))
      .toHaveAttribute("data-preflight-status", /^(ready|warning)$/);

    await page.getByTestId("vibecut-export-fps-60").click();
    await expect(page.getByTestId("vibecut-export-effective-fps")).toContainText("60 fps");
    // Un seul choix actif a la fois: deux pastilles enfoncees mentiraient sur la cadence.
    await expect(page.getByTestId("vibecut-export-fps-60")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("vibecut-export-fps-auto")).toHaveAttribute("aria-pressed", "false");
    await page.getByTestId("vibecut-export-quality-master").click();
    await expect(page.getByTestId("vibecut-export-quality-master")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("vibecut-export-pro-start")).toBeEnabled();
    await shoot(page, "advanced-export");
    await sheet.getByRole("button", { name: "Annuler" }).click();
    await expect(sheet).toHaveCount(0);
  });
});

test.describe("VibeCut v2 - montage avance responsive", () => {
  test("en 390 px de large, rien ne deborde et l'export reste atteignable", async ({ page }) => {
    test.setTimeout(150000);
    const fixtures = getVideoFixtures(1);
    test.skip(fixtures.length < 1, "ffmpeg indisponible pour fabriquer les fixtures");

    await page.setViewportSize({ width: 390, height: 720 });
    await openAdvancedEditor(page);
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-item-video-0")).toBeVisible({ timeout: 45000 });

    const exportButton = page.getByTestId("vibecut-open-export");
    await expect(exportButton).toBeVisible();
    const box = await exportButton.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);

    // Les outils de timeline restent tous atteignables: un bouton hors champ et
    // non defilable serait un bouton mort.
    const fit = page.getByTestId("vibecut-timeline-fit");
    await fit.scrollIntoViewIfNeeded();
    const fitBox = await fit.boundingBox();
    expect(fitBox.x + fitBox.width).toBeLessThanOrEqual(391);

    // La page elle-meme ne defile jamais horizontalement: ce sont les zones
    // internes (bibliotheque, timeline) qui portent leur propre defilement.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
    await shoot(page, "advanced-mobile");
  });
});

test.describe("VibeCut v2 - moteur d'apercu unique", () => {
  test("changer de mode ne recree pas le canvas d'apercu", async ({ page }) => {
    test.setTimeout(180000);
    const fixtures = getVideoFixtures(1);
    test.skip(fixtures.length < 1, "ffmpeg indisponible pour fabriquer les fixtures");

    // On part du montage rapide, avec un media reel charge dans le moteur.
    await page.goto(`${baseUrl}/video/rapide`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await bypassAuth(page);
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 20000 });
    await page.getByTestId("vibecut-media-input").setInputFiles(fixtures);
    await expect(page.getByTestId("vibecut-scene-0")).toBeVisible({ timeout: 45000 });

    // Marquage du canvas courant. S'il etait recree a chaque ecran, la marque
    // disparaitrait - c'etait exactement le constat n° 8 du plan.
    const marked = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="vibecut-preview-canvas"]');
      if (!canvas) return false;
      canvas.dataset.smokeMark = "engine-hoist";
      return true;
    });
    expect(marked).toBe(true);

    // Navigation CLIENT (pas de rechargement): rapide -> accueil -> avance.
    await page.getByTestId("vibecut-brand-home").click();
    await expect(page.getByTestId("vibecut-home")).toBeVisible({ timeout: 20000 });
    await page.getByTestId("vibecut-mode-avance").click();
    await expect(page.getByTestId("vibecut-advanced-editor")).toBeVisible({ timeout: 20000 });

    const stillThere = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="vibecut-preview-canvas"]');
      return canvas ? canvas.dataset.smokeMark || "" : "absent";
    });
    expect(stillThere).toBe("engine-hoist");

    // Et le canvas est bien pose dans l'apercu du montage avance.
    const insideStage = await page.evaluate(() => {
      const stage = document.querySelector('[data-testid="vibecut-preview-stage"]');
      const canvas = document.querySelector('[data-testid="vibecut-preview-canvas"]');
      return Boolean(stage && canvas && stage.contains(canvas));
    });
    expect(insideStage).toBe(true);
    await shoot(page, "advanced-engine-hoist");
  });
});
