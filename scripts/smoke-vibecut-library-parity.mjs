/*
 * GATE DE LA PHASE 5 - parite catalogue <-> moteur <-> capacites serveur.
 *
 * Les deux bibliotheques (`/video/transitions`, `/video/mouvements`) sont les
 * seuls ecrans qui listent EXHAUSTIVEMENT ce que le produit sait faire. Une
 * entree qui promettrait ce que ni l'apercu ni l'export ne rendent y serait donc
 * un mensonge affiche en grand, pas un detail.
 *
 * Ce test verifie, sans navigateur:
 *
 *  1. TRANSITIONS - chaque `engineId` du catalogue existe dans le moteur
 *     (`TRANSITIONS` de VideoEngine.js), et le statut d'export affiche est
 *     EXACTEMENT celui que `getServerRenderCapabilityStatus` renvoie. Les 15
 *     transitions minutees du lot L1 doivent toutes etre presentes et marquees
 *     exportables; aucune des 27 autres ne doit l'etre.
 *  2. MOUVEMENTS - une entree `availability: 'available'` doit avoir un
 *     `engineId` present dans `IMAGE_MOTION_PRESETS` ET declare par le serveur.
 *     Une entree `planned` ne doit PAS avoir d'engineId: sinon elle serait
 *     applicable tout en s'annoncant « Bientôt ».
 *  3. PROBLEME I - la contrainte |x| <= (zoom - 1) / 2 tient pour les six
 *     mouvements livres, et la fonction que l'editeur de trajectoire utilise
 *     pour la faire respecter (`maxOffsetForScale`) est bien la meme regle.
 *  4. COURBE - le renderer ecrit `smoothstep` en dur: la bibliotheque ne doit
 *     donc pas proposer une courbe lineaire APPLICABLE.
 *  5. CHEMIN D'ECRITURE UNIQUE - les deux bibliotheques passent par les actions
 *     de `useScenes`, jamais par le store directement.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const p = (...parts) => path.join(root, ...parts);

const transitionCatalogPath = p("src", "features", "vibecut", "data", "transitionCatalog.js");
const motionCatalogPath = p("src", "features", "vibecut", "data", "motionCatalog.js");
const mediaModelPath = p("src", "features", "vibefx-studio", "video", "model", "mediaModel.js");
const manifestPath = p("src", "features", "vibefx-studio", "video", "export", "exportManifest.js");
const enginePath = p("src", "features", "vibefx-studio", "video", "engine", "VideoEngine.js");
const rendererPath = p("render-service", "src", "server.js");
const transitionLibraryPath = p("src", "features", "vibecut", "library", "TransitionLibrary.jsx");
const motionLibraryPath = p("src", "features", "vibecut", "library", "MotionLibrary.jsx");

const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-library-parity-"));

/*
 * Les catalogues et le manifeste sont IMPORTES, pas regexes: le lot L1 a montre
 * qu'un test qui lit le source rate une liste devenue derivee. Le manifeste ne
 * depend que de lui-meme, les catalogues n'ont aucun import.
 */
async function importAppModule(sourcePath, name) {
  const source = await readFile(sourcePath, "utf8");
  const target = path.join(tempDir, `${name}.mjs`);
  await writeFile(target, source, "utf8");
  return import(pathToFileURL(target).href);
}

try {
  const transitions = await importAppModule(transitionCatalogPath, "transitionCatalog");
  const motions = await importAppModule(motionCatalogPath, "motionCatalog");
  const mediaModel = await importAppModule(mediaModelPath, "mediaModel");
  const manifest = await importAppModule(manifestPath, "exportManifest");

  const engineSource = await readFile(enginePath, "utf8");
  const rendererSource = await readFile(rendererPath, "utf8");
  const transitionLibrarySource = await readFile(transitionLibraryPath, "utf8");
  const motionLibrarySource = await readFile(motionLibraryPath, "utf8");

  const {
    TRANSITION_CATALOG,
    TRANSITION_GROUPS,
  } = transitions;
  const { MOTION_CATALOG, MOTION_GROUPS } = motions;
  const { IMAGE_MOTION_PRESETS } = mediaModel;
  const {
    SERVER_RENDER_CAPABILITIES,
    SERVER_XFADE_TRANSITION_MAP,
    getServerRenderCapabilityStatus,
  } = manifest;

  /* ---------- 1. Transitions ---------- */

  assert.ok(TRANSITION_CATALOG.length > 0, "le catalogue de transitions ne doit pas etre vide");

  const groupIds = new Set(TRANSITION_GROUPS.map((group) => group.id));
  for (const entry of TRANSITION_CATALOG) {
    assert.ok(entry.engineId, `transition ${entry.id}: engineId manquant`);
    assert.ok(
      groupIds.has(entry.group),
      `transition ${entry.id}: famille « ${entry.group} » absente de TRANSITION_GROUPS`
    );
    /*
     * L'id doit exister dans le moteur. Deux endroits legitimes: le `switch` de
     * `renderTransition` pour les transitions maison, et la table xfade du lot L1
     * pour les 15 exportables - `renderTransition` y delegue AVANT son switch.
     * Une transition listee que ni l'un ni l'autre ne connait tomberait sur le
     * `default` du switch et jouerait un simple fondu, sans rien dire.
     */
    const idPattern = new RegExp(`['"\`]${entry.engineId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}['"\`]`);
    const knownToXfade = Object.hasOwn(SERVER_XFADE_TRANSITION_MAP, entry.engineId);
    assert.ok(
      knownToXfade || idPattern.test(engineSource),
      `transition ${entry.id}: « ${entry.engineId} » n'est ni dans la table xfade `
        + "ni dans le switch de VideoEngine.renderTransition — elle jouerait un simple fondu"
    );
  }

  const exportableIds = TRANSITION_CATALOG
    .filter((entry) => getServerRenderCapabilityStatus("timedTransition", entry.engineId).supported)
    .map((entry) => entry.engineId)
    .sort();

  const declaredTimed = [...SERVER_RENDER_CAPABILITIES.timedTransitions].sort();
  assert.deepEqual(
    exportableIds,
    declaredTimed.filter((id) => exportableIds.includes(id)),
    "les transitions marquees exportables doivent toutes etre declarees par le serveur"
  );

  /*
   * ALIAS HISTORIQUES. La table xfade compte SEIZE cles pour QUINZE transitions
   * visibles: `fade` et `crossfade` pointent tous deux sur le `fade` de FFmpeg.
   * `fade` est le nom porte par les projets anterieurs au lot L1; il doit rester
   * accepte a l'export, mais il n'a pas a etre propose deux fois dans la
   * bibliotheque sous deux noms differents.
   *
   * On le declare donc ICI plutot que de relacher les assertions: un futur alias
   * ajoute sans etre declare fera echouer ce test, ce qui est le but.
   */
  const TRANSITION_ALIASES = { fade: "crossfade" };

  const catalogEngineIds = new Set(TRANSITION_CATALOG.map((entry) => entry.engineId));
  for (const id of SERVER_RENDER_CAPABILITIES.timedTransitions) {
    const alias = TRANSITION_ALIASES[id];
    if (alias) {
      assert.ok(
        catalogEngineIds.has(alias),
        `« ${id} » est declare alias de « ${alias} », qui doit exister dans le catalogue`
      );
      assert.ok(
        SERVER_XFADE_TRANSITION_MAP[id] === SERVER_XFADE_TRANSITION_MAP[alias],
        `« ${id} » est declare alias de « ${alias} » mais les deux ne rendent pas la meme cible xfade`
      );
      continue;
    }
    assert.ok(
      catalogEngineIds.has(id),
      `transition exportable « ${id} » absente du catalogue: elle serait injoignable depuis la bibliotheque`
    );
  }

  const aliasCount = Object.keys(TRANSITION_ALIASES).length;
  assert.equal(
    exportableIds.length,
    SERVER_RENDER_CAPABILITIES.timedTransitions.length - aliasCount,
    "le catalogue doit exposer exactement les transitions minutees du serveur, alias exclus"
  );
  assert.equal(exportableIds.length, 15, "le lot L1 a livre 15 transitions exportables");

  /* ---------- 2. Mouvements ---------- */

  const motionGroupIds = new Set(MOTION_GROUPS.map((group) => group.id));
  const enginePresetIds = new Set(IMAGE_MOTION_PRESETS.map((preset) => preset.id));

  for (const entry of MOTION_CATALOG) {
    assert.ok(
      motionGroupIds.has(entry.group),
      `mouvement ${entry.id}: famille « ${entry.group} » absente de MOTION_GROUPS`
    );

    if (entry.availability === "available") {
      assert.ok(entry.engineId, `mouvement ${entry.id}: marque disponible sans engineId`);
      assert.ok(
        enginePresetIds.has(entry.engineId),
        `mouvement ${entry.id}: « ${entry.engineId} » absent de IMAGE_MOTION_PRESETS`
      );
      assert.ok(
        getServerRenderCapabilityStatus("imageMotion", entry.engineId).supported,
        `mouvement ${entry.id}: disponible a l'apercu mais non declare rendu par le serveur`
      );
      continue;
    }

    /*
     * Une entree « planned » NE DOIT PAS porter d'engineId. Si elle en portait
     * un, la bibliotheque la rendrait applicable tout en affichant « Bientôt » -
     * le badge et le bouton se contrediraient.
     */
    assert.equal(
      entry.engineId,
      null,
      `mouvement ${entry.id}: marque « planned » mais porte un engineId, il serait applicable`
    );
  }

  const availableCount = MOTION_CATALOG.filter((entry) => entry.availability === "available").length;
  assert.equal(
    availableCount,
    SERVER_RENDER_CAPABILITIES.imageMotions.length,
    "le catalogue doit exposer exactement les mouvements rendus par le serveur"
  );

  /* ---------- 3. Probleme I: fenetre de cadrage ---------- */

  const maxOffsetForScale = (scale) => Math.max(0, (Math.max(1, Number(scale) || 1) - 1) / 2);

  for (const preset of IMAGE_MOTION_PRESETS) {
    for (const [label, frame] of [["start", preset.start], ["end", preset.end]]) {
      const limit = maxOffsetForScale(frame.scale);
      assert.ok(
        Math.abs(frame.x) <= limit + 1e-9,
        `mouvement ${preset.id} (${label}): |x|=${Math.abs(frame.x)} depasse la limite ${limit} `
          + "(probleme I: zoompan bornerait la fenetre, le canvas non)"
      );
      assert.ok(
        Math.abs(frame.y) <= limit + 1e-9,
        `mouvement ${preset.id} (${label}): |y|=${Math.abs(frame.y)} depasse la limite ${limit}`
      );
    }
  }

  /*
   * L'editeur de trajectoire doit faire respecter CETTE regle, pas une variante.
   * On verifie que la formule est bien celle-la dans le source de la bibliotheque.
   */
  assert.match(
    motionLibrarySource,
    /export function maxOffsetForScale/,
    "MotionLibrary doit exposer maxOffsetForScale, la borne du probleme I"
  );
  assert.match(
    motionLibrarySource,
    /- 1\)\s*\/\s*2/,
    "la borne de l'editeur de trajectoire doit rester (zoom - 1) / 2"
  );

  /* ---------- 4. Courbe: pas de lineaire applicable ---------- */

  /*
   * Le manifeste declare UNE seule courbe rendue par le serveur. C'est cette
   * declaration qui fait autorite - pas une lecture du source du renderer. Le
   * jour ou `imageMotionEasing` gagnera 'linear', cette assertion tombera et
   * rappellera d'activer le controle au lieu de le laisser desactive pour rien.
   */
  assert.deepEqual(
    [...SERVER_RENDER_CAPABILITIES.imageMotionEasing],
    ["ease-in-out"],
    "tant que le serveur ne declare qu'une courbe, la bibliotheque ne doit pas en proposer deux"
  );
  assert.match(
    rendererSource,
    /smoothstep/,
    "le renderer doit toujours lisser la progression (lot L3)"
  );
  assert.match(
    motionLibrarySource,
    /data-testid="vibecut-motion-curve-linear"/,
    "la courbe lineaire doit rester visible, pour dire ce qui manque"
  );
  assert.match(
    motionLibrarySource,
    /disabled\s*\n\s*title="Le renderer serveur lisse toujours la progression"/,
    "la courbe lineaire doit rester DESACTIVEE tant que le renderer ne la rend pas"
  );

  /* ---------- 4bis. `/capabilities` ne doit rien divulguer ---------- */

  /*
   * SUBTILITE VERROUILLEE ICI (decidee le 2026-08-01).
   *
   * `GET /capabilities` est SANS AUTHENTIFICATION et `vibecut-render-service`
   * est un service Cloud Run PUBLIC: sa reponse est lisible par n'importe qui.
   * Elle ne doit donc porter NI la version de FFmpeg NI le texte des erreurs -
   * une banniere de version renseigne gratuitement quiconque cherche les CVE de
   * ce build precis, et un `stderr` recopie peut fuiter des chemins internes.
   *
   * Le detail EST releve, mais il part dans les journaux Cloud Run.
   *
   * Ce test existe parce que la precaution est INVISIBLE a la relecture: rien
   * dans le code ne signale qu'ajouter `report.ffmpeg = ...` serait une
   * regression. Il echouera si quelqu'un le refait.
   */
  assert.match(
    rendererSource,
    /const privateDiagnostics = \{/,
    "le detail de diagnostic doit rester dans un objet separe de la reponse HTTP",
  );
  assert.match(
    rendererSource,
    /console\.log\('\[capabilities\]'/,
    "la version FFmpeg doit partir dans les journaux Cloud Run",
  );

  const capabilitiesBlock = rendererSource.match(
    /async function describeRendererCapabilities\(\)[\s\S]*?\n\}/,
  );
  assert.ok(capabilitiesBlock, "describeRendererCapabilities introuvable dans le renderer");
  const reportLiteral = capabilitiesBlock[0].match(/const report = \{([\s\S]*?)\n  \};/);
  assert.ok(reportLiteral, "l'objet `report` de /capabilities est introuvable");
  assert.doesNotMatch(
    reportLiteral[1],
    /\bffmpeg\b/,
    "la reponse publique de /capabilities ne doit pas porter la version de FFmpeg "
      + "(endpoint sans authentification sur un service Cloud Run public) - "
      + "voir todo.md probleme J et le runbook",
  );
  assert.doesNotMatch(
    reportLiteral[1],
    /errors\s*:/,
    "la reponse publique ne doit porter qu'un COMPTEUR d'erreurs (`errorCount`), "
      + "jamais leurs messages: un stderr recopie peut fuiter des chemins internes",
  );
  assert.match(
    reportLiteral[1],
    /errorCount\s*:/,
    "la reponse doit tout de meme signaler qu'il y a eu des erreurs, sinon le pre-vol serait aveugle",
  );

  /* ---------- 5. Un seul chemin d'ecriture ---------- */

  for (const [name, source] of [
    ["TransitionLibrary", transitionLibrarySource],
    ["MotionLibrary", motionLibrarySource],
  ]) {
    assert.doesNotMatch(
      source,
      /from '@\/features\/vibefx-studio\/video\/store\/videoStore'/,
      `${name} ne doit jamais importer le store directement: tout passe par les adaptateurs`
    );
    assert.doesNotMatch(
      source,
      /from '@\/features\/vibefx-studio\/video\/panels\//,
      `${name} ne doit importer aucun panneau de l'ancien front`
    );
  }

  assert.match(
    transitionLibrarySource,
    /sceneActions\.applyTransition\(/,
    "la bibliotheque de transitions doit passer par sceneActions.applyTransition"
  );
  assert.match(
    transitionLibrarySource,
    /sceneActions\.applyTransitionToAll\(/,
    "la bibliotheque de transitions doit passer par sceneActions.applyTransitionToAll"
  );
  assert.match(
    motionLibrarySource,
    /sceneActions\.setSceneMotion\(/,
    "la bibliotheque de mouvements doit passer par sceneActions.setSceneMotion"
  );
  assert.match(
    motionLibrarySource,
    /sceneActions\.applyMotionToAllImages\(/,
    "la bibliotheque de mouvements doit passer par sceneActions.applyMotionToAllImages"
  );

  /*
   * Les apercus doivent etre dessines par le MOTEUR, pas imites en CSS: c'est ce
   * qui garantit qu'une carte ne peut pas deriver du rendu qu'elle annonce.
   */
  const transitionPreviewSource = await readFile(
    p("src", "features", "vibecut", "library", "TransitionPreview.jsx"),
    "utf8"
  );
  const motionPreviewSource = await readFile(
    p("src", "features", "vibecut", "library", "MotionPreview.jsx"),
    "utf8"
  );
  assert.match(
    transitionPreviewSource,
    /import \{ renderTransition \} from '@\/features\/vibefx-studio\/video\/engine\/VideoEngine'/,
    "l'apercu de transition doit appeler renderTransition du moteur"
  );
  assert.match(
    motionPreviewSource,
    /applyImageMotionTransform/,
    "l'apercu de mouvement doit appeler applyImageMotionTransform de mediaModel"
  );

  console.log(
    JSON.stringify(
      {
        transitions: {
          catalogue: TRANSITION_CATALOG.length,
          exportables: exportableIds.length,
          apercuSeulement: TRANSITION_CATALOG.length - exportableIds.length,
        },
        mouvements: {
          catalogue: MOTION_CATALOG.length,
          disponibles: availableCount,
          prevus: MOTION_CATALOG.length - availableCount,
        },
      },
      null,
      2
    )
  );
  console.log("smoke vibecut library parity OK");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
