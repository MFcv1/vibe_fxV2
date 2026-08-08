/*
 * GATE DU LOT B1 - la fondation du design des deux bibliotheques.
 *
 * LECON DE METHODE, ET C'EST LA PLUS IMPORTANTE DU PROJET.
 * Les 24 tests de la phase 4 passaient tous alors que la colorimetrie « ne se
 * voyait pas » et qu'aucune transition n'etait posable: ils verifiaient que
 * l'action ECRIT dans le modele, jamais qu'elle SE VOIT. Corollaire trouve en
 * phase 7: l'onglet VIBECUT du studio etait mort et aucun des 42 tests ne
 * cliquait dessus (bug 39).
 *
 * Donc ici, RIEN n'est verifie par un libelle. Tout est mesure:
 *   - les PIXELS des canvas (`getImageData`), pour prouver que le temps bouge;
 *   - les attributs que le rendu ECRIT DANS LE DOM (`data-preview-mode`,
 *     `data-preview-progress`), pour prouver QUI tient le temps;
 *   - l'ABSENCE d'un controle, quand il ne doit pas exister.
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

function makeFixtures() {
  if (fixtureDir) return fixtureDir;
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecut-b1-"));
  /*
   * Deux mires DETAILLEES puis un aplat. Le detail n'est pas un caprice: un
   * aplat de couleur zoome a 116 % reste exactement le meme aplat, et le test du
   * bypass d'un mouvement ne prouverait alors rien du tout.
   */
  ["testsrc=size=720x1280", "smptebars=size=720x1280", "color=c=0x00ff00:s=720x1280"]
    .forEach((source, index) => {
      const result = spawnSync(ffmpegPath, [
        "-y", "-f", "lavfi", "-i", source,
        "-frames:v", "1", path.join(dir, `photo-${index + 1}.png`),
      ], { encoding: "utf8" });
      if (result.status !== 0) throw new Error("ffmpeg photo failed");
    });
  fixtureDir = dir;
  return dir;
}

function fixtures() {
  try {
    const dir = makeFixtures();
    if (!dir) return null;
    return { photos: [1, 2, 3].map((index) => path.join(dir, `photo-${index}.png`)) };
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
  await settle(page);
}

/*
 * RECHARGER PASSE PAR LA MEME SEQUENCE QU'OUVRIR, et c'est tout l'objet de ce
 * helper (2026-08-04, probleme L).
 *
 * `bypassAuth` clique le bouton de contournement S'IL EST VISIBLE A CET INSTANT.
 * Or `domcontentloaded` se declenche AVANT l'hydratation React : a cet instant
 * le bouton n'existe pas encore, meme sur une page qui va afficher l'ecran de
 * connexion. Un rechargement suivi d'un `bypassAuth` immediat ne contournait
 * donc rien, et le test continuait sur l'ecran de connexion - l'element attendu
 * restait introuvable pendant vingt secondes, sans que le message dise pourquoi.
 *
 * `open()` ne souffrait pas du defaut parce qu'il attend le reseau AVANT de
 * contourner. Les deux chemins partagent maintenant cette attente, pour que
 * l'oubli ne puisse pas se reproduire a la prochaine ecriture.
 */
async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await bypassAuth(page);
}

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

/*
 * La SIGNATURE d'un canvas: moyenne RVB plus quatre sondes reparties. Deux
 * images qui ne different que par une bande (un balayage a 20 % contre 80 %)
 * peuvent avoir la MEME moyenne - les sondes attrapent ce que la moyenne rate.
 */
async function signature(locator) {
  return locator.evaluate((canvas) => {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const pixels = data.length / 4;
    const probe = (fx, fy) => {
      const x = Math.min(width - 1, Math.max(0, Math.round(width * fx)));
      const y = Math.min(height - 1, Math.max(0, Math.round(height * fy)));
      const o = (y * width + x) * 4;
      return [data[o], data[o + 1], data[o + 2]];
    };
    const grid = [];
    for (const fy of [0.15, 0.38, 0.62, 0.85]) {
      for (const fx of [0.12, 0.37, 0.63, 0.88]) grid.push(...probe(fx, fy));
    }
    return [r / pixels, g / pixels, b / pixels, ...grid];
  });
}

function distance(a, b) {
  return Math.max(...a.map((value, index) => Math.abs(value - b[index])));
}

/* Deplace le pointeur a une fraction de la largeur de la vignette. */
async function hoverAt(page, locator, fraction) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
}

test.describe("B1 - auditionner: le hover scrub", () => {
  test("la position du pointeur EST le temps: deux positions, deux images", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    // Un balayage: la difference entre 25 % et 75 % de course est franche.
    const card = page.getByTestId("vibecut-transition-card-swipe-left");
    const canvas = page.getByTestId("vibecut-transition-canvas-swipe-left");
    await card.scrollIntoViewIfNeeded();

    await hoverAt(page, card, 0.25);
    // Le survol PREND LA MAIN: l'horloge ne pilote plus cette vignette.
    await expect(canvas).toHaveAttribute("data-preview-mode", "scrub");
    await page.waitForTimeout(120);
    const left = await signature(canvas);

    // Et il la garde: deux mesures au meme endroit donnent la meme image.
    await page.waitForTimeout(250);
    const leftAgain = await signature(canvas);
    expect(distance(left, leftAgain), "le survol ne fige pas la vignette").toBeLessThan(2);

    await hoverAt(page, card, 0.75);
    await page.waitForTimeout(120);
    const right = await signature(canvas);

    expect(
      distance(left, right),
      "deux positions du pointeur donnent la meme image: le hover scrub ne pilote rien",
    ).toBeGreaterThan(12);

    await shot(page, "b1-01-hover-scrub");
  });

  test("sortir de la vignette RELANCE la boucle", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    const card = page.getByTestId("vibecut-transition-card-crossfade");
    const canvas = page.getByTestId("vibecut-transition-canvas-crossfade");

    await hoverAt(page, card, 0.5);
    await expect(canvas).toHaveAttribute("data-preview-mode", "scrub");

    // On sort par le haut de la page, loin de toute carte.
    await page.mouse.move(5, 5);
    await expect(canvas).toHaveAttribute("data-preview-mode", "loop");

    // Et la boucle tourne vraiment: la progression change toute seule.
    const samples = [];
    for (let index = 0; index < 8; index += 1) {
      samples.push(Number(await canvas.getAttribute("data-preview-progress")));
      await page.waitForTimeout(160);
    }
    const spread = Math.max(...samples) - Math.min(...samples);
    expect(spread, `la boucle n'est pas repartie (${samples.join(", ")})`).toBeGreaterThan(0.1);
  });

  test("EQUIVALENT CLAVIER: une vignette au focus se scrube aux fleches", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    const canvas = page.getByTestId("vibecut-transition-canvas-swipe-left");
    await page.getByTestId("vibecut-transition-card-swipe-left-select").focus();

    await page.keyboard.press("ArrowRight");
    await expect(canvas).toHaveAttribute("data-preview-mode", "scrub");
    const start = Number(await canvas.getAttribute("data-preview-progress"));
    const first = await signature(canvas);

    for (let index = 0; index < 5; index += 1) {
      await page.keyboard.press("ArrowRight");
    }
    const end = Number(await canvas.getAttribute("data-preview-progress"));
    const later = await signature(canvas);

    expect(end, "les fleches ne deplacent pas le temps").toBeGreaterThan(start);
    expect(
      distance(first, later),
      "le scrub clavier ne change pas l'image: l'ecran est inutilisable sans souris",
    ).toBeGreaterThan(12);
  });
});

test.describe("B1 - au repos, le point culminant", () => {
  /*
   * L'etat de REPOS est celui ou la boucle est coupee. On l'obtient franchement
   * avec `prefers-reduced-motion`, qui est aussi l'exigence d'accessibilite:
   * la boucle s'arrete, les commandes restent.
   */
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("deux vignettes au repos montrent DEUX IMAGES DIFFERENTES", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(600);

    const ids = ["crossfade", "dip-black", "iris-open", "swipe-left"];
    const shots = {};
    for (const id of ids) {
      const canvas = page.getByTestId(`vibecut-transition-canvas-${id}`);
      await canvas.scrollIntoViewIfNeeded();
      // Au repos, la vignette est figee - jamais a l'instant 0.
      await expect(canvas).toHaveAttribute("data-preview-mode", "freeze");
      expect(Number(await canvas.getAttribute("data-preview-progress"))).toBeGreaterThan(0);
      shots[id] = await signature(canvas);
    }

    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        expect(
          distance(shots[ids[i]], shots[ids[j]]),
          `${ids[i]} et ${ids[j]} montrent la meme image au repos: `
            + "la grille serait 48 fois la meme vignette",
        ).toBeGreaterThan(10);
      }
    }

    await shot(page, "b1-02-repos-point-culminant");
  });

  test("mouvement reduit: la boucle est coupee mais les commandes repondent", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    const canvas = page.getByTestId("vibecut-transition-canvas-swipe-left");
    const card = page.getByTestId("vibecut-transition-card-swipe-left");
    await card.scrollIntoViewIfNeeded();

    // La boucle ne tourne pas: la progression ne bouge pas d'elle-meme.
    const before = Number(await canvas.getAttribute("data-preview-progress"));
    await page.waitForTimeout(700);
    expect(Number(await canvas.getAttribute("data-preview-progress"))).toBe(before);

    // Mais le scrub, lui, reste utilisable: le reglage arrete le mouvement, il ne
    // retire pas les commandes.
    await hoverAt(page, card, 0.2);
    const left = await signature(canvas);
    await hoverAt(page, card, 0.8);
    const right = await signature(canvas);
    expect(
      distance(left, right),
      "sous prefers-reduced-motion, le scrub ne repond plus: les commandes ont ete retirees",
    ).toBeGreaterThan(12);

    // Le grand apercu aussi garde ses commandes.
    await expect(page.getByTestId("vibecut-transition-stage-time")).toBeEnabled();
    await expect(page.getByTestId("vibecut-transition-stage-bypass")).toBeEnabled();
  });
});

test.describe("B1 - juger: le grand apercu", () => {
  test("le curseur de temps fige et deplace l'animation", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    await page.getByTestId("vibecut-transition-card-swipe-left").click();
    const canvas = page.getByTestId("vibecut-transition-panel-canvas");
    const slider = page.getByTestId("vibecut-transition-stage-time");

    await page.getByTestId("vibecut-transition-stage-loop").click();
    await slider.fill("250");
    await expect(canvas).toHaveAttribute("data-preview-mode", "scrub");
    await page.waitForTimeout(120);
    const quarter = await signature(canvas);

    // FIGE: deux mesures espacees donnent la meme image.
    await page.waitForTimeout(400);
    expect(distance(quarter, await signature(canvas)), "le curseur ne fige pas l'apercu").toBeLessThan(2);

    await slider.fill("750");
    await page.waitForTimeout(120);
    expect(
      distance(quarter, await signature(canvas)),
      "deplacer le curseur ne change pas l'image",
    ).toBeGreaterThan(12);

    // La bascule rend la main a l'horloge (la boucle etait en pause depuis le
    // debut du test: un seul clic la relance).
    await page.getByTestId("vibecut-transition-stage-loop").click();
    await expect(canvas).toHaveAttribute("data-preview-mode", "loop");
    /*
     * Et elle repart bien: la progression change toute seule.
     *
     * ON ATTEND PLUS LONGTEMPS QUE LA TENUE, et c'est le fond du sujet. La
     * boucle marque un arret de 0,7 s a chaque bout (`transitionLoopPhase`),
     * dans un cycle de 3 s: echantillonner sur 400 ms pouvait tomber en plein
     * dans cette tenue et lire deux fois la meme valeur alors que la boucle
     * tournait tres bien.
     *
     * Le defaut existait avant le lot B2 mais restait cache: le cache de rendu
     * ne redessinait pas pendant la tenue, donc l'attribut gardait la valeur
     * PERIMEE du scrub et paraissait avoir change. Des que la source est une
     * video, chaque image force le redessin et la vraie valeur - 0 pendant la
     * tenue - s'affiche aussitot. Le test lisait donc un artefact de cache.
     */
    const running = Number(await canvas.getAttribute("data-preview-progress"));
    await expect
      .poll(
        async () => Number(await canvas.getAttribute("data-preview-progress")),
        { timeout: 4000, message: "la boucle ne repart pas: la progression n'avance plus" },
      )
      .not.toBe(running);
  });

  test("BYPASS: la touche maintenue change les pixels, et les rend au relachement", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    await page.getByTestId("vibecut-transition-card-crossfade").click();
    const canvas = page.getByTestId("vibecut-transition-panel-canvas");
    const slider = page.getByTestId("vibecut-transition-stage-time");

    // On se pose en plein fondu: c'est la que « sans l'effet » se voit le plus.
    await page.getByTestId("vibecut-transition-stage-loop").click();
    await slider.fill("500");
    await page.waitForTimeout(150);
    const withEffect = await signature(canvas);

    await page.keyboard.down("b");
    await expect(canvas).toHaveAttribute("data-preview-bypass", "true");
    await expect(page.getByTestId("vibecut-transition-stage-bypass-flag")).toBeVisible();
    await page.waitForTimeout(120);
    const without = await signature(canvas);

    expect(
      distance(withEffect, without),
      "le bypass ne change pas les pixels: il n'y a pas d'avant/apres",
    ).toBeGreaterThan(20);

    await shot(page, "b1-03-bypass");

    await page.keyboard.up("b");
    await expect(canvas).toHaveAttribute("data-preview-bypass", "false");
    await page.waitForTimeout(120);
    expect(
      distance(withEffect, await signature(canvas)),
      "le relachement ne rend pas l'effet",
    ).toBeLessThan(3);
  });

  test("taper « b » dans la recherche ne declenche pas le bypass", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    await page.getByTestId("vibecut-library-filters-search").fill("b");
    await expect(page.getByTestId("vibecut-transition-panel-canvas"))
      .toHaveAttribute("data-preview-bypass", "false");
  });
});

test.describe("B1 - le cout du mouvement permanent", () => {
  /*
   * LE CHIFFRE QUI MANQUAIT. Le risque « quarante canvas animes + deux apercus
   * = page qui rame » etait ecrit dans la feuille de route et n'avait jamais ete
   * MESURE - seulement atenue par construction (horloge unique,
   * IntersectionObserver, et aucun redessin quand la progression n'a pas change).
   *
   * On compte donc les trames reellement servies pendant deux secondes, sur la
   * grille complete, en survolant une vignette (donc avec un scrub en cours).
   * Le plancher est volontairement bas: ce test doit attraper un effondrement,
   * pas mesurer la machine de quelqu'un. Le chiffre reel est imprime.
   */
  test("la grille complete tourne sans effondrer la cadence", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });
    await expect(page.locator('article[data-testid^="vibecut-transition-card-"]')).toHaveCount(48);

    const measure = async (label) => {
      const fps = await page.evaluate(() => new Promise((resolve) => {
        let frames = 0;
        const startedAt = performance.now();
        const tick = () => {
          frames += 1;
          if (performance.now() - startedAt >= 2000) {
            resolve((frames * 1000) / (performance.now() - startedAt));
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }));
      console.log(`[B1] images par seconde (${label}): ${fps.toFixed(1)}`);
      return fps;
    };

    const idle = await measure("grille au repos");
    await hoverAt(page, page.getByTestId("vibecut-transition-card-crossfade"), 0.5);
    const hovering = await measure("grille + scrub en cours");

    expect(idle, "la grille seule effondre la cadence").toBeGreaterThan(24);
    expect(hovering, "le hover scrub effondre la cadence").toBeGreaterThan(24);
  });
});

test.describe("B1 - favoris", () => {
  test("un favori se retrouve dans le filtre, survit au rechargement, et revient dans LES DEUX modes", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    const projectId = await createProject(page, files);
    await open(page, `/video/transitions?project=${projectId}`);
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    /*
     * `swipe-right` est exportable et n'est PAS dans les six raccourcis ecrits en
     * dur du montage rapide: le retrouver la-bas prouve que ce sont bien les
     * favoris qui les remplacent, et pas un hasard.
     */
    const star = page.getByTestId("vibecut-transition-card-swipe-right-star");
    await star.scrollIntoViewIfNeeded();
    await star.click();
    // La carte apparait DEUX fois - dans « Tes favoris » et dans sa famille -
    // et c'est voulu: la section de tete rappelle, elle ne deplace pas.
    await expect(page.getByTestId("vibecut-transition-card-swipe-right").first())
      .toHaveAttribute("data-favorite", "true");
    await expect(page.getByTestId("vibecut-transition-card-swipe-right")).toHaveCount(2);

    // Section « Tes favoris » en tete de grille.
    await expect(page.getByRole("heading", { name: "Tes favoris" })).toBeVisible();

    // Le filtre etoile ne montre plus que lui.
    await page.getByTestId("vibecut-library-filters-group-favorites").click();
    await expect(page.locator('article[data-testid^="vibecut-transition-card-"]')).toHaveCount(1);
    await shot(page, "b1-04-favoris");

    // SURVIT AU RECHARGEMENT (IndexedDB, pas un etat de page).
    await reload(page);
    await expect(page.getByTestId("vibecut-transition-card-swipe-right").first())
      .toHaveAttribute("data-favorite", "true", { timeout: 20000 });

    // MONTAGE AVANCE: les favoris remontent en tete de l'inspecteur.
    await open(page, `/video/avance?project=${projectId}`);
    await expect(page.getByTestId("vibecut-advanced-editor")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-item-video-0").click();
    const advPanel = page.getByTestId("vibecut-inspector-transition-next");
    await expect(advPanel).toBeVisible();
    await advPanel.getByRole("button").first().click();
    await expect(page.getByTestId("vibecut-adv-transition-favorites")).toBeVisible();
    await expect(page.getByTestId("vibecut-adv-transition-swipe-right")).toBeVisible();

    // MONTAGE RAPIDE: les six raccourcis ecrits en dur deviennent les favoris.
    await open(page, `/video/rapide?project=${projectId}`);
    await expect(page.getByTestId("vibecut-quick-editor")).toBeVisible({ timeout: 45000 });
    await page.getByTestId("vibecut-scene-0").click();
    await page.getByTestId("vibecut-inspector-transition").getByRole("button").first().click();
    await expect(page.getByTestId("vibecut-transition-swipe-right")).toBeVisible();
    // Et une des six d'origine a bien cede la place.
    await expect(page.getByTestId("vibecut-transition-film-dissolve")).toHaveCount(0);
    await expect(page.getByTestId("vibecut-quick-transition-source")).toContainText("favoris");
  });
});

test.describe("B1 - ce que l'ecran met en avant", () => {
  test("l'annexe des mouvements annonces a DISPARU, faute d'entree a y mettre", async ({ page }) => {
    await open(page, "/video/mouvements");
    await expect(page.getByTestId("vibecut-motion-library")).toBeVisible({ timeout: 20000 });

    /*
     * HISTOIRE DE CETTE ASSERTION, parce qu'elle a change de sens deux fois.
     *
     * Sept des treize entrees n'etaient pas rendues par le moteur: elles
     * occupaient plus de la moitie de la grille et faisaient passer le catalogue
     * pour a moitie vide. D'ou l'annexe - on ne cache pas ce qui arrive, on
     * arrete juste de lui donner la meme place. Le lot B3 a ramene ce nombre a
     * un, puis le glitch a ete livre le 2026-08-04: il n'en reste AUCUN.
     *
     * Une annexe vide n'a pas a s'afficher - ce serait un titre de section sans
     * contenu, exactement le genre de coquille morte que `plan.md` § 4.2
     * interdit. On verifie donc son ABSENCE, et surtout qu'aucune carte degradee
     * ne s'est repliee dans les familles a la place.
     */
    await expect(page.getByTestId("vibecut-motion-library-section-deferred")).toHaveCount(0);
    await expect(page.locator('[data-testid^="vibecut-motion-card-"][data-available="false"]'))
      .toHaveCount(0);

    /*
     * LE TRI QUI PORTAIT L'ANNEXE DOIT RESTER EN ETAT. C'est le vrai risque du
     * jour ou une entree annoncee reviendra: si les familles avaient absorbe
     * l'annexe, plus rien ne la remettrait a sa place. On verifie donc que les
     * sections restantes sont bien les FAMILLES, dans leur ordre, et qu'aucune
     * n'est vide.
     */
    const order = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[data-testid^="vibecut-motion-library-section-"]')];
      return nodes.map((node) => node.dataset.testid);
    });
    expect(order).toEqual([
      "vibecut-motion-library-section-camera",
      "vibecut-motion-library-section-depth",
      "vibecut-motion-library-section-accent",
    ]);
    for (const section of order) {
      await expect(
        page.getByTestId(section).locator('article[data-testid^="vibecut-motion-card-"]'),
      ).not.toHaveCount(0);
    }
    await shot(page, "b1-08-mouvements-haut");
  });

  test("plus aucune carte ne se degrade a l'export, et le tri qui le garantissait tient toujours", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    /*
     * Le lot B1 triait les exportables en tete de chaque famille, parce que la
     * moitie du catalogue se degradait en fondu au rendu final. Depuis le lot
     * B3b il n'y a plus de seconde categorie. Le tri reste en place - il servira
     * de nouveau si une capacite serveur disparaissait - mais ce qui se verifie
     * ici est plus fort : AUCUNE carte, dans AUCUNE famille, n'annonce autre
     * chose que ce que l'export produit.
     */
    const flags = await page.locator('article[data-testid^="vibecut-transition-card-"]')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.exportable));
    expect(flags.length).toBe(48);
    expect(flags.filter((flag) => flag !== "true"), "des cartes se degradent encore a l'export").toEqual([]);
  });

  test("le filtre « Entre deux plans » ecarte les ouvertures et les fins de sequence", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    /*
     * Le filtre « Export Pro » du lot B1 ne retirait plus rien depuis que les 48
     * entrees sont rendues : un controle qui ne filtre jamais est un bouton mort.
     * Il pose donc la question qui partage encore le catalogue.
     */
    await page.getByTestId("vibecut-library-filters-group-cut-only").click();
    const cards = page.locator('article[data-testid^="vibecut-transition-card-"]');
    // 48 entrees moins les quatre ouvertures et les trois fins de sequence.
    await expect(cards).toHaveCount(41);
    await expect(page.locator('article[data-testid^="vibecut-transition-card-"][data-usage="opening"]'))
      .toHaveCount(0);
    await expect(page.locator('article[data-testid^="vibecut-transition-card-"][data-usage="closing"]'))
      .toHaveCount(0);
    await shot(page, "b1-07-filtre-usage");
  });

  test("poser une OUVERTURE ailleurs qu'au debut le DIT au moment ou on la pose", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    const projectId = await createProject(page, files);
    await open(page, `/video/transitions?project=${projectId}`);
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    /*
     * Le badge sur la carte se regarde une fois ; la remarque doit arriver au
     * moment ou la decision est prise. Elle N'INTERDIT RIEN - le montage reste
     * celui de l'utilisateur - elle dit seulement ce pour quoi l'entree est faite.
     */
    const opening = page.getByTestId("vibecut-transition-card-intro-grid-reveal");
    await opening.scrollIntoViewIfNeeded();
    await opening.click();
    await page.getByTestId("vibecut-transition-apply-all").click();
    await expect(page.getByTestId("vibecut-transition-notice")).toContainText("ouvrir une séquence");

    // Une transition de coupe ordinaire ne raconte pas d'histoire inutile.
    await page.getByTestId("vibecut-transition-card-dip-black").click();
    await page.getByTestId("vibecut-transition-apply").click();
    await expect(page.getByTestId("vibecut-transition-notice")).not.toContainText("séquence");
  });
});

test.describe("B1 - recherche, filtres et chassis", () => {
  test("la recherche et les familles reduisent la grille, et l'etat vide dit quoi faire", async ({ page }) => {
    await open(page, "/video/transitions");
    await expect(page.getByTestId("vibecut-transition-library")).toBeVisible({ timeout: 20000 });

    const cards = page.locator('article[data-testid^="vibecut-transition-card-"]');
    await expect(cards).toHaveCount(48);

    // Recherche insensible aux accents: « desature » doit trouver « désaturé ».
    await page.getByTestId("vibecut-library-filters-search").fill("desature");
    await expect(cards).toHaveCount(1);

    // Famille: on retombe sur le compte du catalogue.
    await page.getByTestId("vibecut-library-filters-clear").click();
    await page.getByTestId("vibecut-library-filters-group-light").click();
    await expect(cards).toHaveCount(3);

    // Aucun resultat: on dit quoi faire, et le bouton AGIT vraiment.
    await page.getByTestId("vibecut-library-filters-search").fill("zzzz");
    await expect(cards).toHaveCount(0);
    await page.getByTestId("vibecut-transition-library-reset-filters").click();
    await expect(cards).toHaveCount(48);
  });

  test("390 px: rien ne deborde, et zero erreur console sur les deux ecrans", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      consoleErrors.push(`${message.text()} :: ${message.location()?.url || "?"}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.setViewportSize({ width: 390, height: 780 });

    for (const [route, testId] of [
      ["/video/transitions", "vibecut-transition-library"],
      ["/video/mouvements", "vibecut-motion-library"],
    ]) {
      await open(page, route);
      await expect(page.getByTestId(testId)).toBeVisible({ timeout: 20000 });
      // Sous 720 px les familles sont un MENU, pas une rangee de pastilles.
      await expect(page.getByTestId("vibecut-library-filters-group-select")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth
        - document.documentElement.clientWidth);
      expect(overflow, `${route} deborde horizontalement`).toBeLessThanOrEqual(1);
      await shot(page, `b1-05-390px-${testId}`);
    }

    const unexpected = consoleErrors.filter((text) => !/firebase|app ?check|auth\/|net::ERR/i.test(text));
    expect(unexpected, `erreurs console: ${unexpected.join(" | ")}`).toEqual([]);
  });

  test("la bibliotheque de mouvements a le meme chassis et le meme scrub", async ({ page }) => {
    const files = fixtures();
    test.skip(!files, "ffmpeg indisponible pour fabriquer les fixtures");

    const projectId = await createProject(page, files);
    await open(page, `/video/mouvements?project=${projectId}`);
    await expect(page.getByTestId("vibecut-motion-library")).toBeVisible({ timeout: 20000 });

    const card = page.getByTestId("vibecut-motion-card-pan-right");
    const canvas = page.getByTestId("vibecut-motion-canvas-pan-right");
    await card.scrollIntoViewIfNeeded();

    await hoverAt(page, card, 0.1);
    await expect(canvas).toHaveAttribute("data-preview-mode", "scrub");
    await page.waitForTimeout(120);
    const start = await signature(canvas);

    await hoverAt(page, card, 0.9);
    await page.waitForTimeout(120);
    expect(
      distance(start, await signature(canvas)),
      "le hover scrub ne pilote pas la bibliotheque de mouvements",
    ).toBeGreaterThan(6);

    // Le bypass du mouvement: la photo SANS aucun mouvement, en plein cadre.
    await page.getByTestId("vibecut-motion-card-zoom-in").click();
    const stageCanvas = page.getByTestId("vibecut-motion-panel-canvas");
    await page.getByTestId("vibecut-motion-stage-loop").click();
    await page.getByTestId("vibecut-motion-stage-time").fill("980");
    await page.waitForTimeout(150);
    const zoomed = await signature(stageCanvas);
    await page.keyboard.down("b");
    await page.waitForTimeout(150);
    const flat = await signature(stageCanvas);
    await page.keyboard.up("b");
    expect(distance(zoomed, flat), "le bypass du mouvement ne montre rien de different")
      .toBeGreaterThan(12);
    await page.waitForTimeout(150);
    expect(distance(zoomed, await signature(stageCanvas)), "le relachement ne rend pas le mouvement")
      .toBeLessThan(3);

    await shot(page, "b1-06-mouvements");
  });
});
