/*
 * AUDIT DES REGLAGES AVANCES, AU NIVEAU DE L'INTERFACE.
 *
 *   npm run test:reglages-avances
 *
 * CE QUE CELUI-CI PROUVE, ET QUE `audit-reglages-avances.mjs` NE PROUVE PAS.
 * L'autre script appelle `renderStudio` directement: il repond a « le moteur
 * sait-il faire ce reglage ». Celui-ci saisit le VRAI curseur de la VRAIE page,
 * et repond a la seule question qui compte pour l'utilisateur: « quand je
 * pousse ce curseur, est-ce que l'image change ». Entre les deux il y a tout ce
 * qui peut casser sans que le moteur bouge d'un pixel: une borne d'interface
 * plus large que celle du moteur (la course ne fait rien sur son dernier
 * tiers), un `onChange` qui n'ecrit pas la bonne cle, un rendu qui ne se
 * redeclenche pas, une qualite d'apercu qui saute l'etage.
 *
 * COMMENT ON MESURE. On lit les pixels du canvas d'apercu avant et apres, et on
 * compte l'ecart moyen. Le canvas est celui de la page — pas une re-execution
 * du moteur a cote.
 *
 * DEUX PIEGES DE MESURE, tous les deux rencontres:
 *  - Le rendu est DIFFERE (raf + debounce): sans attente explicite, on relit le
 *    canvas d'avant et tout parait mort.
 *  - Le grain est ALEATOIRE: son image change a chaque rendu, meme sans
 *    toucher au curseur. On mesure donc aussi un « temoin » — deux lectures
 *    sans rien bouger — et un reglage doit faire mieux que ce temoin.
 */

const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

/* Ce seuil est celui de l'oeil, pas celui de la machine: 0,3/255 de moyenne sur
   une image entiere ne se voit pas. En dessous, on considere que le curseur ne
   sert a rien, meme s'il fait bouger trois pixels. */
const SEUIL_VISIBLE = 0.3;
/*
 * ...ou un effet LOCAL. Meme regle que `scripts/audit-reglages-avances.mjs`,
 * volontairement: deux instruments qui repondent a la meme question ne doivent
 * pas avoir deux baremes. Un halo autour d'un neon pese 0,1/255 en moyenne et
 * se voit tres bien; ce qui le rend reel, c'est un ecart FRANC sur une part non
 * negligeable du cadre.
 */
const LOCAL_ECART = 8;
const LOCAL_PART = 0.01;

/*
 * La photo de test doit contenir de quoi mordre pour TOUS les reglages: une
 * plage tonale complete (luminosite, contraste, courbes), des couleurs que le
 * moteur reconnait specifiquement (peau, ciel, feuillage), du detail fin
 * (nettete, texture) et des hautes lumieres (halation). Un aplat bruite ne
 * declencherait ni les masques selectifs ni les etages spatiaux.
 */
function fabriquerPhoto() {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeos-reglages-"));
  const fichier = path.join(dir, "mire.png");
  const filtre = [
    "color=c=0x808080:s=900x600",
    "drawbox=x=0:y=0:w=900:h=90:color=0xe8b89a@1:t=fill",      /* peau */
    "drawbox=x=0:y=90:w=900:h=90:color=0x5b8fd6@1:t=fill",      /* ciel */
    "drawbox=x=0:y=180:w=900:h=90:color=0x4f8a3a@1:t=fill",     /* feuillage */
    "drawbox=x=0:y=270:w=900:h=90:color=0xd97a2b@1:t=fill",     /* orange chaud */
    "drawbox=x=0:y=360:w=300:h=90:color=0x101010@1:t=fill",     /* noir profond */
    "drawbox=x=300:y=360:w=300:h=90:color=0xffffff@1:t=fill",   /* blanc spéculaire */
    /* Une haute lumiere COLOREE. Sans elle le halo paraissait mort: son
       garde-fou l'eteint volontairement sur un blanc neutre, et ce qu'il vise
       c'est un neon. Un audit sans neon accuse un reglage qui marche. */
    "drawbox=x=600:y=360:w=300:h=90:color=0xfff05a@1:t=fill",   /* néon jaune */
    "geq=r='if(gt(Y,450),128+90*sin(2*PI*X/9),r(X,Y))':g='if(gt(Y,450),128+90*sin(2*PI*X/9),g(X,Y))':b='if(gt(Y,450),128+90*sin(2*PI*X/9),b(X,Y))'", /* détail fin */
    "noise=alls=10:allf=t+u",
  ].join(",");
  const result = spawnSync(ffmpegPath, ["-y", "-f", "lavfi", "-i", "color=c=0x808080:s=900x600", "-vf", filtre.split(",").slice(1).join(","), "-frames:v", "1", fichier], { encoding: "utf8" });
  if (result.status !== 0 || !fs.existsSync(fichier)) return null;
  return fichier;
}

/* Lecture des pixels du canvas d'apercu de la page, sous-echantillonnee: on
   cherche un ecart moyen, pas une empreinte au pixel pres. */
async function lirePixels(canvas) {
  return canvas.evaluate((el) => {
    const c = document.createElement("canvas");
    const L = 260;
    const H = Math.max(1, Math.round((L * el.height) / el.width));
    c.width = L;
    c.height = H;
    c.getContext("2d").drawImage(el, 0, 0, L, H);
    return Array.from(c.getContext("2d").getImageData(0, 0, L, H).data);
  });
}

/*
 * Ecart moyen ET part de l'image franchement touchee. Les deux, parce qu'un
 * effet LOCAL (un halo autour d'un neon, un vignetage dans les coins) a une
 * moyenne minuscule sans etre invisible: le juger a la moyenne seule le
 * declarerait mort a tort.
 */
function ecart(a, b) {
  let somme = 0;
  let n = 0;
  let touches = 0;
  let pixels = 0;
  let ecartMax = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
    );
    somme += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    n += 3;
    if (d >= 1) touches += 1;
    if (d > ecartMax) ecartMax = d;
    pixels += 1;
  }
  return { moyenne: somme / n, part: touches / pixels, ecartMax };
}

/* Le rendu passe par requestAnimationFrame et par des etats React: deux frames
   ne suffisent pas toujours, et une attente fixe trop courte ferait passer un
   reglage vivant pour mort. */
async function attendreRendu(page) {
  await page.waitForTimeout(420);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/*
 * Regler un curseur DESIGNE PAR SON LABEL, jamais par son rang.
 *
 * Le panneau Vision remonte en tete les reglages qui ne sont plus au repos:
 * bouger le premier curseur DEPLACE les suivants. Un audit qui parcourt
 * `nth(i)` lit alors les bornes d'un curseur et ecrit dans un autre — c'est ce
 * qui est arrive ici, avec un « Malformed value » pour seul symptome.
 *
 * On passe donc par une seule evaluation qui retrouve l'element, lit ses
 * bornes et ecrit sa valeur d'un bloc. Le setter natif + un evenement `input`
 * est ce que React ecoute: `fill()` refuserait de sortir des bornes, alors
 * qu'on veut justement pouvoir demander le bout de la course.
 */
async function reglerParLabel(page, advancedTestId, label, cible) {
  return page.evaluate(({ advancedTestId, label, cible }) => {
    const root = document.querySelector(`[data-testid="${advancedTestId}"]`);
    if (!root) return null;
    const els = [...root.querySelectorAll('input[type="range"]:not(:disabled)')];
    const nomDe = (el) => (el.closest("div")?.querySelector("label")?.textContent || "").trim().split(" · ")[0];
    const el = els.find((e) => nomDe(e) === label);
    if (!el) return null;
    const min = Number(el.min);
    const max = Number(el.max);
    const valeur = Number(el.value);
    const v = cible === "max" ? max : cible === "min" ? min : cible;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return { min, max, valeur, demande: v };
  }, { advancedTestId, label, cible });
}

/* Les labels presents dans le panneau, dans l'ordre d'affichage initial. */
async function listerCurseurs(page, advancedTestId) {
  return page.evaluate((id) => {
    const root = document.querySelector(`[data-testid="${id}"]`);
    return [...root.querySelectorAll('input[type="range"]:not(:disabled)')].map((el) => ({
      label: (el.closest("div")?.querySelector("label")?.textContent || "").trim().split(" · ")[0],
      min: Number(el.min),
      max: Number(el.max),
      repos: Number(el.value),
    }));
  }, advancedTestId);
}

/*
 * Pousser un curseur a fond, dans les deux sens, et garder le mouvement qui
 * change le plus l'image. Un reglage borne d'un seul cote (grain, nettete)
 * n'aurait rien donne si on ne testait qu'une direction.
 */
async function pousserEtMesurer(page, canvas, advancedTestId, curseur) {
  const avant = await lirePixels(canvas);
  let meilleur = { moyenne: 0, part: 0, ecartMax: 0 };
  let position = null;
  for (const cible of ["max", "min"]) {
    const etat = await reglerParLabel(page, advancedTestId, curseur.label, cible);
    if (!etat || etat.demande === curseur.repos) continue;
    await attendreRendu(page);
    const apres = await lirePixels(canvas);
    const mesure = ecart(avant, apres);
    if (mesure.moyenne > meilleur.moyenne) { meilleur = mesure; position = etat.demande; }
    /* Retour au repos entre les deux sens: sinon le second ecart se mesure
       depuis l'extremite opposee et vaut le double. */
    await reglerParLabel(page, advancedTestId, curseur.label, curseur.repos);
    await attendreRendu(page);
  }
  /* `curseur.max` est la borne du CURSEUR, `ecartMax` l'ecart mesure: les deux
     tenaient le meme nom, et l'un ecrasait l'autre a l'affichage comme dans le
     verdict — un halo « max 32 » etait en fait la position du curseur. */
  return { ...meilleur, position, min: curseur.min, max: curseur.max, repos: curseur.repos };
}

async function importerPhoto(page, testId, fichier) {
  await page.locator(`[data-testid="${testId}"]`).setInputFiles(fichier);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20000 });
  await attendreRendu(page);
}

/*
 * Le temoin: deux lectures sans rien toucher. Il vaut 0 partout, SAUF quand un
 * grain aleatoire est actif — auquel cas il donne la barre a franchir.
 */
async function mesurerTemoin(page, canvas) {
  const a = await lirePixels(canvas);
  await attendreRendu(page);
  const b = await lirePixels(canvas);
  return ecart(a, b).moyenne;
}

async function auditerEcran(page, { route, inputTestId, advancedTestId, screenTestId, nom }, fichier) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  /* Hors emulateurs, la page demande une identite: le smoke passe par la meme
     sortie de secours que les autres suites VibeOS. */
  await page.getByRole("button", { name: /contourner.*authentification/i })
    .click({ timeout: 30000 })
    .catch(() => {});
  await expect(page.getByTestId(screenTestId)).toBeVisible({ timeout: 30000 });
  await importerPhoto(page, inputTestId, fichier);

  const advanced = page.locator(`[data-testid="${advancedTestId}"]`);
  await advanced.getByRole("button", { name: /Réglages avancés/i }).click();
  await page.waitForTimeout(200);

  const canvas = page.locator("canvas").first();
  const temoin = await mesurerTemoin(page, canvas);

  const curseurs = await listerCurseurs(page, advancedTestId);
  expect(curseurs.length, `${nom}: aucun curseur trouvé dans les réglages avancés`).toBeGreaterThan(0);

  const resultats = [];
  for (const curseur of curseurs) {
    const mesure = await pousserEtMesurer(page, canvas, advancedTestId, curseur);
    resultats.push({ label: curseur.label, ...mesure });
  }

  /* Vivant = visible sur toute l'image, OU franc sur une part non negligeable.
     Le temoin (deux lectures sans rien toucher) donne le plancher: avec un
     grain aleatoire actif, l'image change d'elle-meme. */
  const estVivant = (r) => r.moyenne > Math.max(SEUIL_VISIBLE, temoin * 3)
    || (r.ecartMax >= LOCAL_ECART && r.part >= LOCAL_PART);

  console.log(`\n── ${nom} (${route}) ── témoin: ${temoin.toFixed(3)}/255`);
  for (const r of resultats) {
    console.log(
      `  ${estVivant(r) ? "✓" : "✗"} ${r.label.padEnd(30)} course ${String(r.min).padStart(5)}…${String(r.max).padEnd(5)} ` +
      `repos ${String(r.repos).padStart(4)}  →  ${r.moyenne.toFixed(2).padStart(6)}/255 moy, ` +
      `max ${String(r.ecartMax).padStart(3)}, ${(r.part * 100).toFixed(1).padStart(5)} % touché (poussé à ${r.position})`,
    );
  }

  const morts = resultats.filter((r) => !estVivant(r));
  return { resultats, morts, temoin };
}

test.describe("Réglages avancés Vision — chaque curseur change-t-il l'image ?", () => {
  test.setTimeout(300000);

  test("Vision: aucun curseur mort", async ({ page }) => {
    const fichier = fabriquerPhoto();
    test.skip(!fichier, "ffmpeg indisponible: impossible de fabriquer la mire.");

    const vision = await auditerEcran(page, {
      route: "/creer/vision",
      inputTestId: "vibeos-vision-input",
      advancedTestId: "vibeos-vision-advanced",
      screenTestId: "vibeos-vision-screen",
      nom: "VISION",
    }, fichier);

    const morts = vision.morts.map((r) => `Vision · ${r.label}`);
    expect(morts, `Curseurs sans effet visible: ${morts.join(", ")}`).toEqual([]);
  });
});
