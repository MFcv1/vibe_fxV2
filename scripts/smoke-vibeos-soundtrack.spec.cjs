/*
 * Smoke de l'ecran Soundtrack VibeOS (/creer/son, phase E).
 *
 * Trois tests:
 *  1. Parcours reel: colonne de navigation -> Sheet « Fichier local » -> import
 *     d'un vrai WAV -> la piste apparait dans « Imports recents » et dans « Ma
 *     bibliotheque locale » -> lecture -> le lecteur du bas joue et avance.
 *  2. Le critere de la phase E: la lecture CONTINUE quand on change de page
 *     (mini-lecteur du bandeau sur /creer/studio), puis on revient et le
 *     lecteur est toujours sur la meme piste. Plus le lecteur mobile (mini-barre
 *     -> lecteur plein ecran) et l'absence de debordement horizontal.
 *  3. Vue Recherche: champ, themes rapides, et un etat vide honnete quand le
 *     reseau n'est pas disponible (cas normal en local).
 *
 * Le fichier importe est recopie par le serveur de dev dans
 * public/music/local-imports (dossier ignore par git): le test le retire, ainsi
 * que son entree de manifeste, pour ne pas polluer la bibliotheque locale des
 * lancements suivants.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

/* WAV PCM: le Chromium de Playwright n'embarque pas les codecs proprietaires
   (MP3/AAC), un WAV est donc le seul format sur lequel la duree, la forme
   d'onde et la lecture sont reellement testables. */
const FIXTURE_TITLE = "vibeos-smoke-piste";
const FIXTURE_FILE = `${FIXTURE_TITLE}.wav`;
const LOCAL_IMPORTS_DIR = path.join(process.cwd(), "public", "music", "local-imports");

/* Chaque test repart d'un contexte navigateur neuf (donc d'un IndexedDB vide):
   ceux qui ont besoin d'une piste la reimportent eux-memes. */

/* Chromium bloque l'autoplay hors geste utilisateur; nos lectures partent bien
   d'un clic, mais la resolution du Blob est asynchrone - on desamorce le sujet
   plutot que de tester une politique de navigateur. */
test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

let fixtureDir = null;

function getFixture() {
  if (fixtureDir) return path.join(fixtureDir, FIXTURE_FILE);
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-soundtrack-"));
  const result = spawnSync(
    ffmpegPath,
    [
      "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
      "-ac", "1", "-ar", "22050", "-c:a", "pcm_s16le",
      path.join(dir, FIXTURE_FILE),
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return null;
  fixtureDir = dir;
  return path.join(dir, FIXTURE_FILE);
}

/*
 * Le serveur de dev recopie tout import local dans public/music/local-imports et
 * l'inscrit dans son manifeste. Sans ce nettoyage, la piste de test reviendrait
 * dans la bibliotheque de tous les lancements suivants (et de la machine de
 * l'utilisateur): on retire le fichier ET l'entree du manifeste.
 */
test.afterAll(() => {
  if (!fs.existsSync(LOCAL_IMPORTS_DIR)) return;
  for (const entry of fs.readdirSync(LOCAL_IMPORTS_DIR)) {
    if (entry.toLowerCase().includes(FIXTURE_TITLE)) {
      fs.rmSync(path.join(LOCAL_IMPORTS_DIR, entry), { force: true });
    }
  }
  const manifestPath = path.join(LOCAL_IMPORTS_DIR, "vibefx-local-imports-manifest.json");
  if (!fs.existsSync(manifestPath)) return;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.tracks = (manifest.tracks || []).filter(
      (track) => !JSON.stringify(track).toLowerCase().includes(FIXTURE_TITLE),
    );
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  } catch {
    /* Manifeste illisible: le fichier audio a deja ete retire, on n'insiste pas. */
  }
});

async function openSoundtrack(page) {
  await page.goto(`${baseUrl}/creer/son`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 30000 })
    .catch(() => {});
  await expect(page.getByTestId("vibeos-soundtrack-screen")).toBeVisible({ timeout: 30000 });
}

/* Import de la fixture par le Sheet « Fichier local », comme un utilisateur. */
async function importFixture(page, fixture) {
  await page.getByTestId("vibeos-soundtrack-source-file").click();
  const sheet = page.getByRole("dialog", { name: "Fichier local" });
  await expect(sheet).toBeVisible();
  await page.getByTestId("vibeos-soundtrack-file-input").setInputFiles(fixture);
  await expect(sheet).toBeHidden({ timeout: 30000 });
  await expect(fixtureRow(page)).toBeVisible({ timeout: 30000 });
}

/* La bibliotheque locale de dev contient deja des pistes de demonstration: on
   cible toujours NOTRE piste, jamais « la premiere ligne ». */
function fixtureRow(page) {
  return page.getByTestId("vibeos-soundtrack-row").filter({ hasText: FIXTURE_TITLE }).first();
}

test("soundtrack VibeOS: navigation, import fichier local, lecture", async ({ page }) => {
  test.setTimeout(150_000);
  const fixture = getFixture();
  test.skip(!fixture, "ffmpeg-static indisponible: fixture audio impossible");

  await openSoundtrack(page);

  // Colonne gauche complete: navigation + bibliotheque + les 4 sources.
  const sidebar = page.getByRole("complementary", { name: "Navigation Soundtrack" });
  for (const label of ["Rechercher", "Accueil", "Pistes du projet", "Ma bibliothèque locale", "Imports récents"]) {
    await expect(sidebar.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  for (const source of ["ai", "pixabay", "file", "url"]) {
    await expect(page.getByTestId(`vibeos-soundtrack-source-${source}`)).toBeVisible();
  }

  // La vue Accueil est bien la vue par defaut.
  await expect(page.locator("h1")).toHaveText("Accueil");

  // Import « Fichier local » en Sheet: la vue bascule sur « Imports recents ».
  await importFixture(page, fixture);
  await expect(page.locator("h1")).toHaveText("Imports récents");

  // La meme piste est bien en bibliotheque locale, avec sa duree lue du fichier.
  await sidebar.getByRole("button", { name: "Ma bibliothèque locale", exact: true }).click();
  const row = fixtureRow(page);
  await expect(row).toBeVisible({ timeout: 30000 });
  await expect(row).toContainText(/0:0[456]/);

  // Lecture: le lecteur du bas apparait et le temps avance vraiment.
  await row.getByRole("button", { name: new RegExp(`^Lire ${FIXTURE_TITLE}`) }).click();
  const player = page.getByTestId("vibeos-soundtrack-player");
  await expect(player).toBeVisible({ timeout: 15000 });
  await expect(player).toContainText(FIXTURE_TITLE);
  await expect(page.getByTestId("vibeos-soundtrack-play")).toHaveAttribute("aria-label", "Mettre en pause", { timeout: 15000 });

  const readElapsed = async () => page.locator(
    '[data-testid="vibeos-soundtrack-player"] input[type="range"][aria-label="Position dans la piste"]',
  ).inputValue();
  const startedAt = Number(await readElapsed());
  await expect.poll(async () => Number(await readElapsed()), { timeout: 15000 })
    .toBeGreaterThan(startedAt);

  // La piste en lecture est teintee et porte l'egaliseur (3 barres).
  await expect(fixtureRow(page)).toHaveClass(/rowPlaying/);
});

test("soundtrack VibeOS: la lecture survit au changement de page, et le mobile tient", async ({ page }) => {
  test.setTimeout(180_000);
  const fixture = getFixture();
  test.skip(!fixture, "ffmpeg-static indisponible: fixture audio impossible");

  await openSoundtrack(page);
  await importFixture(page, fixture);

  const row = fixtureRow(page);
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.getByRole("button", { name: new RegExp(`^Lire ${FIXTURE_TITLE}`) }).click();
  await expect(page.getByTestId("vibeos-soundtrack-play")).toHaveAttribute("aria-label", "Mettre en pause", { timeout: 15000 });

  /* Le coeur de la phase E: l'element <audio> vit dans le provider du layout
     /creer, donc changer d'espace ne coupe pas la musique. */
  await page.getByRole("link", { name: "Studio" }).first().click();
  await expect(page.getByTestId("vibeos-studio-screen")).toBeVisible({ timeout: 30000 });
  const miniPlayer = page.getByTestId("vibeos-mini-player");
  await expect(miniPlayer).toBeVisible();
  await expect(miniPlayer).toContainText(FIXTURE_TITLE);
  await expect(miniPlayer.getByRole("button", { name: "Mettre en pause" })).toBeVisible();

  // Retour a Soundtrack: meme piste, lecteur intact.
  await miniPlayer.getByRole("button", { name: FIXTURE_TITLE }).click();
  await expect(page.getByTestId("vibeos-soundtrack-player")).toContainText(FIXTURE_TITLE, { timeout: 30000 });

  // Mobile: mini-barre au-dessus de la tab bar, puis lecteur plein ecran.
  await page.setViewportSize({ width: 390, height: 844 });
  const mini = page.getByTestId("vibeos-soundtrack-mini");
  await expect(mini).toBeVisible();
  await mini.click();
  const fullPlayer = page.getByRole("dialog", { name: "Lecteur" });
  await expect(fullPlayer).toBeVisible();
  await expect(fullPlayer).toContainText(FIXTURE_TITLE);
  await fullPlayer.getByRole("button", { name: "Fermer le lecteur" }).click();
  await expect(fullPlayer).toBeHidden();

  // Onglets internes mobiles + bouton « + » vers les sources.
  await page.getByRole("tab", { name: "Rechercher" }).click();
  await expect(page.locator("h1")).toHaveText("Rechercher");
  await page.getByRole("button", { name: "Ajouter de la musique" }).click();
  await expect(page.getByRole("dialog", { name: "Ajouter de la musique" })).toBeVisible();
  await page.keyboard.press("Escape");

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);
});

test("soundtrack VibeOS: la vue Recherche est utilisable et honnete", async ({ page }) => {
  test.setTimeout(120_000);

  await openSoundtrack(page);
  await page.getByRole("complementary", { name: "Navigation Soundtrack" })
    .getByRole("button", { name: "Rechercher", exact: true }).click();

  const field = page.getByTestId("vibeos-soundtrack-search");
  await expect(field).toBeVisible();
  await expect(page.getByRole("button", { name: "cinematic" })).toBeVisible();

  await field.fill("piano");
  await field.press("Enter");

  /* Sans reseau, la recherche doit dire ce qui se passe au lieu d'afficher un
     panneau muet: on accepte les deux issues, jamais l'ecran vide. */
  await expect.poll(async () => {
    const hasResults = await page.getByTestId("vibeos-soundtrack-results").isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/Cherche une ambiance|n’a rien renvoyé/).isVisible().catch(() => false);
    return hasResults || hasEmptyState;
  }, { timeout: 45000 }).toBe(true);
});
