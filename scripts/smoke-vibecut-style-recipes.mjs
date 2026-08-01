/*
 * Smoke pur du moteur de recettes de la creation guidee.
 *
 * Depuis le lot L2 (2026-07-30), un preset n'est plus « une duree + une
 * transition + une teinte » mais une PARTITION. Ce test verifie donc:
 *   1. la PARITE: chaque mouvement et chaque transition qu'un preset peut
 *      produire doit exister dans le moteur (mediaModel / xfadeTransitions) ET
 *      etre declare rendu par le serveur (SERVER_RENDER_CAPABILITIES);
 *   2. la STRUCTURE DE BATTEMENT: les durees suivent bien le motif du preset,
 *      avec un premier et un dernier plan traites a part;
 *   3. la PARTITION DE TRANSITIONS: la sequence tourne, les accents tombent tous
 *      les N plans, l'ouverture et la fermeture prennent le pas sur l'accent;
 *   4. le GARDE-FOU: une transition ne mange jamais plus de 45 % du plus court
 *      des deux plans qu'elle relie;
 *   5. la SYNERGIE rythme <-> preset: changer de rythme comprime le montage sans
 *      changer sa FORME (les rapports entre plans sont conserves);
 *   6. que les six presets produisent des montages reellement distincts.
 *
 * Aucun navigateur, aucun reseau. `styleRecipes.js` est volontairement sans
 * import: on le copie tel quel dans un module temporaire pour l'executer.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const recipesPath = path.join(root, "src", "features", "vibecut", "data", "styleRecipes.js");
const mediaModelPath = path.join(root, "src", "features", "vibefx-studio", "video", "model", "mediaModel.js");
const manifestPath = path.join(root, "src", "features", "vibefx-studio", "video", "export", "exportManifest.js");
const storePath = path.join(root, "src", "features", "vibefx-studio", "video", "store", "videoStore.js");

const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-style-recipes-"));
const tempModulePath = path.join(tempDir, "styleRecipes.mjs");

/*
 * Les capacites serveur sont LUES DU MODULE, plus extraites du source: depuis le
 * lot L1 la liste des transitions minutees est derivee de la table xfade et
 * n'est plus un litteral gele. Un test qui regexe le source aurait rate la
 * bascule.
 */
async function importAppModule(sourcePath, name) {
  const source = await readFile(sourcePath, "utf8");
  const target = path.join(tempDir, `${name}.mjs`);
  await writeFile(target, source, "utf8");
  return import(pathToFileURL(target).href);
}

const round2 = (value) => Math.round(value * 100) / 100;

try {
  const recipesSource = await readFile(recipesPath, "utf8");
  assert.doesNotMatch(
    recipesSource,
    /^\s*import\s/m,
    "styleRecipes.js doit rester sans import pour rester testable et pur"
  );
  await writeFile(tempModulePath, recipesSource, "utf8");

  const {
    MAX_RECIPE_IMAGE_DURATION,
    MAX_TRANSITION_SHARE,
    MIN_RECIPE_IMAGE_DURATION,
    MOTION_INTENSITIES,
    MOTION_MOODS,
    NEUTRAL_LOOK,
    RECIPE_FORMATS,
    RECIPE_MOTIONS,
    RECIPE_TRANSITIONS,
    RHYTHMS,
    STYLE_RECIPES,
    TRANSITION_NAMES,
    buildMontagePlan,
    describeMontagePlan,
    getDefaultGuidedChoices,
    getRecipeMotionIntensityId,
    getStyleTempo,
    lookToCssFilter,
    lookToOverlays,
  } = await import(pathToFileURL(tempModulePath).href);

  /* ---------- 1. Parite avec le moteur et avec le rendu serveur ---------- */

  const mediaModelSource = await readFile(mediaModelPath, "utf8");
  const { SERVER_RENDER_CAPABILITIES } = await importAppModule(manifestPath, "exportManifest");
  const serverMotions = [...SERVER_RENDER_CAPABILITIES.imageMotions];
  const serverTimedTransitions = [...SERVER_RENDER_CAPABILITIES.timedTransitions];
  const engineMotionIds = [...mediaModelSource.matchAll(/^\s{8}id:\s*'([^']+)'/gm)].map((m) => m[1]);

  for (const motion of RECIPE_MOTIONS) {
    assert.ok(engineMotionIds.includes(motion), `mouvement ${motion} absent de IMAGE_MOTION_PRESETS`);
    assert.ok(serverMotions.includes(motion), `mouvement ${motion} non rendu par le serveur`);
  }

  /*
   * Toute transition employable par un preset doit etre exportable. `cut` est la
   * seule exception: ce n'est pas une transition, c'est son absence.
   */
  for (const type of RECIPE_TRANSITIONS) {
    if (type === "cut") continue;
    assert.ok(
      serverTimedTransitions.includes(type),
      `transition ${type} non rendue par l'export serveur: un preset ne doit jamais produire un montage inexportable`
    );
    assert.ok(TRANSITION_NAMES[type], `transition ${type} sans nom lisible`);
  }

  for (const mood of MOTION_MOODS) {
    if (!mood.pattern) continue; // 'style' = la choregraphie du preset
    for (const motion of mood.pattern) {
      assert.ok(RECIPE_MOTIONS.includes(motion), `${mood.id} utilise un mouvement hors catalogue: ${motion}`);
    }
  }

  // Les bornes dupliquees dans le module pur doivent suivre le moteur.
  const minMatch = mediaModelSource.match(/MIN_IMAGE_DURATION_SECONDS\s*=\s*([\d.]+)/);
  const maxMatch = mediaModelSource.match(/MAX_IMAGE_DURATION_SECONDS\s*=\s*([\d.]+)/);
  assert.equal(MIN_RECIPE_IMAGE_DURATION, Number(minMatch[1]), "borne minimale desynchronisee de mediaModel");
  assert.equal(MAX_RECIPE_IMAGE_DURATION, Number(maxMatch[1]), "borne maximale desynchronisee de mediaModel");

  /*
   * Les six raccourcis de transition du montage rapide doivent tous etre
   * exportables: mettre en avant une transition « apercu uniquement » revient a
   * pousser l'utilisateur vers un montage qu'il ne pourra pas exporter.
   */
  const inspectorSource = await readFile(
    path.join(root, "src", "features", "vibecut", "quick", "SceneInspector.jsx"),
    "utf8",
  );
  const catalogSource = await readFile(
    path.join(root, "src", "features", "vibecut", "data", "transitionCatalog.js"),
    "utf8",
  );
  const quickIds = [...(/const QUICK_TRANSITION_IDS = \[([^\]]*)\]/.exec(inspectorSource)?.[1] || "")
    .matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.ok(quickIds.length >= 4, "raccourcis de transition introuvables dans SceneInspector");
  for (const id of quickIds) {
    const entry = new RegExp(`\\{ id: '${id}', engineId: '([^']+)'`).exec(catalogSource);
    assert.ok(entry, `raccourci ${id} absent du catalogue de transitions`);
    assert.ok(
      serverTimedTransitions.includes(entry[1]),
      `raccourci ${id} non exportable: le montage rapide ne doit pas mettre en avant une transition « apercu uniquement »`
    );
  }

  /*
   * L'action du store doit rester ADDITIVE: l'ancien front lit encore
   * `applyGuidedTemplate` jusqu'a la phase 7.
   */
  const storeSource = await readFile(storePath, "utf8");
  assert.match(storeSource, /applyMontageScore:/, "le store doit exposer applyMontageScore");
  assert.match(storeSource, /applyGuidedTemplate:/, "applyGuidedTemplate ne doit pas etre supprimee avant la phase 7");

  /* ---------- 2. Coherence du catalogue ---------- */

  assert.ok(STYLE_RECIPES.length >= 6, "six presets attendus au lot L2");
  const formatValues = RECIPE_FORMATS.map((format) => format.value);
  for (const recipe of STYLE_RECIPES) {
    const label = recipe.id;
    assert.ok(formatValues.includes(recipe.sequencePreset), `${label}: format inconnu`);
    assert.ok(recipe.name && recipe.description && recipe.bestFor, `${label}: presentation incomplete`);

    assert.ok(Array.isArray(recipe.beat?.pattern) && recipe.beat.pattern.length, `${label}: motif de battement manquant`);
    for (const weight of recipe.beat.pattern) {
      assert.ok(weight > 0 && weight <= 3, `${label}: poids de battement aberrant (${weight})`);
    }
    assert.ok(recipe.beat.base > 0, `${label}: cadence de base manquante`);

    const usedTransitions = [
      ...(recipe.transitionScore || []),
      recipe.accentTransition,
      recipe.openingTransition,
      recipe.closingTransition,
    ].filter(Boolean);
    for (const type of usedTransitions) {
      assert.ok(RECIPE_TRANSITIONS.includes(type), `${label}: transition hors catalogue exportable (${type})`);
    }
    for (const motion of recipe.motionScore) {
      assert.ok(RECIPE_MOTIONS.includes(motion), `${label}: mouvement hors catalogue (${motion})`);
    }
    /*
     * L'intensite d'un preset doit TOMBER SUR UN CRAN NOMME. Une valeur
     * intermediaire ne pourrait pas s'afficher a l'etape 3, et la carte
     * selectionnee mentirait sur ce que le montage applique.
     */
    assert.ok(
      MOTION_INTENSITIES.some((level) => level.value === recipe.motionIntensity),
      `${label}: intensite ${recipe.motionIntensity} hors des trois crans nommes`
    );
    assert.ok(recipe.titleStyle, `${label}: traitement de titre manquant`);
    assert.ok(recipe.audioProfile, `${label}: profil audio manquant`);
  }
  assert.ok(
    STYLE_RECIPES.some((recipe) => recipe.transitionScore.every((type) => type === "cut")),
    "au moins un preset doit couper franchement, sinon la generation ne teste jamais ce cas"
  );
  assert.ok(
    STYLE_RECIPES.some((recipe) => new Set(recipe.transitionScore).size > 1),
    "au moins un preset doit alterner plusieurs transitions: c'est tout l'objet du lot L2"
  );
  assert.ok(
    STYLE_RECIPES.some((recipe) => new Set(recipe.beat.pattern).size > 1),
    "au moins un preset doit avoir un battement irregulier"
  );

  /* ---------- 2bis. Intensite du mouvement (lot L3) ---------- */

  /*
   * L'intensite doit ARRIVER JUSQU'AU CLIP. Elle est portee par scene, parce que
   * c'est la valeur que `useGuidedMontage` pose sur le mouvement du clip, donc
   * celle qui part dans le manifeste, donc celle que le `zoompan` du renderer
   * applique. La parite pixel des deux cotes est prouvee a part, par
   * `scripts/smoke-vibecut-motion-preview-parity.mjs`.
   */
  const intensityScenes = Array.from({ length: 4 }, () => ({ isImage: true, duration: 4 }));
  for (const level of MOTION_INTENSITIES) {
    assert.ok(level.value > 0 && level.value <= 1, `cran ${level.id}: valeur hors bornes`);
    assert.ok(level.name && level.description, `cran ${level.id}: presentation incomplete`);
    const plan = buildMontagePlan({
      scenes: intensityScenes,
      styleId: "reel",
      rhythmId: "equilibre",
      motionMoodId: "doux",
      motionIntensityId: level.id,
    });
    assert.equal(plan.motionIntensityId, level.id, `${level.id}: cran non retenu par le plan`);
    assert.equal(plan.motionIntensity, level.value, `${level.id}: valeur non retenue par le plan`);
    for (const scene of plan.scenes) {
      assert.equal(scene.motionIntensity, level.value, `${level.id}: intensite absente d'une scene`);
    }
  }
  assert.equal(MOTION_INTENSITIES.length, 3, "trois crans nommes, pas un curseur continu");

  // Sans choix explicite, c'est le preset qui donne le cran.
  for (const recipe of STYLE_RECIPES) {
    const plan = buildMontagePlan({
      scenes: intensityScenes,
      styleId: recipe.id,
      rhythmId: "equilibre",
      motionMoodId: "style",
      motionIntensityId: null,
    });
    assert.equal(
      plan.motionIntensityId,
      getRecipeMotionIntensityId(recipe),
      `${recipe.id}: le cran par defaut doit etre celui du preset`
    );
    assert.equal(plan.motionIntensity, recipe.motionIntensity, `${recipe.id}: intensite du preset non appliquee`);
  }

  // Un mouvement 'none' ne porte pas d'intensite: il n'y a pas de course a doser.
  const stillPlan = buildMontagePlan({
    scenes: intensityScenes,
    styleId: "reel",
    rhythmId: "equilibre",
    motionMoodId: "aucun",
    motionIntensityId: "marque",
  });
  for (const scene of stillPlan.scenes) {
    assert.equal(scene.motion, "none", "le jeu 'aucun' doit laisser les photos fixes");
    assert.equal(scene.motionIntensity, null, "une photo fixe ne porte pas d'intensite");
  }

  /* ---------- 3. Generation sur plusieurs jeux de scenes ---------- */

  const photo = { isImage: true, duration: 4 };
  const video = { isImage: false, duration: 7.5 };
  const FIXTURES = [
    { id: "douze-photos", scenes: Array.from({ length: 12 }, () => ({ ...photo })) },
    { id: "six-photos", scenes: Array.from({ length: 6 }, () => ({ ...photo })) },
    { id: "trois-videos", scenes: Array.from({ length: 3 }, () => ({ ...video })) },
    { id: "mixte", scenes: [{ ...photo }, { ...video }, { ...photo }, { ...photo }, { ...video }] },
    { id: "une-photo", scenes: [{ ...photo }] },
    { id: "vide", scenes: [] },
  ];

  for (const fixture of FIXTURES) {
    for (const recipe of STYLE_RECIPES) {
      for (const rhythm of RHYTHMS) {
        const plan = buildMontagePlan({
          scenes: fixture.scenes,
          styleId: recipe.id,
          rhythmId: rhythm.id,
          motionMoodId: "style",
        });
        const label = `${fixture.id}/${recipe.id}/${rhythm.id}`;
        const count = fixture.scenes.length;

        assert.equal(plan.sceneCount, count, `${label}: nombre de scenes`);
        assert.equal(plan.imageCount, fixture.scenes.filter((s) => s.isImage).length, `${label}: photos`);
        assert.equal(plan.videoCount, fixture.scenes.filter((s) => !s.isImage).length, `${label}: videos`);
        assert.equal(plan.scenes.length, count, `${label}: une entree de partition par scene`);
        assert.equal(plan.cuts.length, Math.max(0, count - 1), `${label}: une coupe entre chaque paire`);

        /* --- Structure de battement --- */
        const beatBase = recipe.beat.base * rhythm.durationFactor;
        plan.scenes.forEach((scene, index) => {
          if (!scene.isImage) {
            assert.equal(scene.duration, fixture.scenes[index].duration, `${label}: la duree d'une video est intouchable`);
            assert.equal(scene.motion, null, `${label}: une video ne recoit pas de mouvement`);
            return;
          }
          let weight = recipe.beat.pattern[index % recipe.beat.pattern.length];
          if (index === 0) weight *= recipe.beat.openingHold;
          if (count > 1 && index === count - 1) weight *= recipe.beat.closingHold;
          const expected = round2(Math.min(
            MAX_RECIPE_IMAGE_DURATION,
            Math.max(MIN_RECIPE_IMAGE_DURATION, beatBase * weight)
          ));
          assert.equal(scene.duration, expected, `${label}: duree du plan ${index}`);
          assert.ok(
            scene.duration >= MIN_RECIPE_IMAGE_DURATION && scene.duration <= MAX_RECIPE_IMAGE_DURATION,
            `${label}: duree hors bornes du moteur`
          );
          assert.ok(RECIPE_MOTIONS.includes(scene.motion), `${label}: mouvement inconnu ${scene.motion}`);
        });

        /* --- Partition de transitions et placement des accents --- */
        plan.cuts.forEach((cut, cutIndex) => {
          assert.equal(cut.index, cutIndex, `${label}: index de coupe`);
          assert.ok(RECIPE_TRANSITIONS.includes(cut.type), `${label}: transition inconnue ${cut.type}`);

          const isOpening = cutIndex === 0 && recipe.openingTransition;
          const isClosing = cutIndex === plan.cuts.length - 1 && recipe.closingTransition;
          const isAccent = recipe.accentEvery > 0
            && recipe.accentTransition
            && (cutIndex + 1) % recipe.accentEvery === 0;
          const expectedType = isOpening
            ? recipe.openingTransition
            : isClosing
              ? recipe.closingTransition
              : isAccent
                ? recipe.accentTransition
                : recipe.transitionScore[cutIndex % recipe.transitionScore.length];
          assert.equal(cut.type, expectedType, `${label}: transition de la coupe ${cutIndex}`);

          if (cut.type === "cut") {
            assert.equal(cut.duration, 0, `${label}: une coupe franche n'a pas de duree`);
            return;
          }
          assert.ok(cut.duration >= 0.1, `${label}: transition trop courte`);
          // GARDE-FOU: jamais plus de 45 % du plus court des deux plans adjacents.
          const shortest = Math.min(plan.scenes[cutIndex].duration, plan.scenes[cutIndex + 1].duration);
          assert.ok(
            cut.duration <= shortest * MAX_TRANSITION_SHARE + 1e-9,
            `${label}: la transition (${cut.duration}s) mange plus de 45 % du plan le plus court (${shortest}s)`
          );
        });

        // Look: toujours complet, pour effacer la colorimetrie du preset precedent.
        assert.deepEqual(
          Object.keys(plan.look).sort(),
          Object.keys(NEUTRAL_LOOK).sort(),
          `${label}: le look doit couvrir tous les reglages`
        );

        // Duree estimee = somme des plans moins les recouvrements.
        const raw = plan.scenes.reduce((total, scene) => total + scene.duration, 0);
        const overlap = plan.cuts.reduce((total, cut) => total + cut.duration, 0);
        assert.equal(plan.estimatedDuration, round2(Math.max(0, raw - overlap)), `${label}: duree estimee`);
        assert.ok(plan.estimatedDuration >= 0, `${label}: duree negative`);
      }
    }
  }

  /* ---------- 4. Accents et alternance reellement visibles ---------- */

  const twelve = Array.from({ length: 12 }, () => ({ ...photo }));

  // « Recit » ouvre et ferme autrement que son corps.
  const recit = buildMontagePlan({ scenes: twelve, styleId: "recit" });
  assert.equal(recit.cuts[0].type, "iris-open", "Recit doit ouvrir sur un iris");
  assert.equal(recit.cuts.at(-1).type, "iris-close", "Recit doit fermer sur un iris");
  assert.ok(
    recit.cuts.slice(1, -1).every((cut) => cut.type === "crossfade"),
    "le corps de Recit doit rester en fondu enchaine"
  );
  // Sa structure raconte: les plans raccourcissent.
  assert.ok(
    recit.scenes[1].duration > recit.scenes[3].duration,
    "Recit doit resserrer ses plans au fil du montage"
  );

  // « Cinema » place un passage au noir tous les cinq plans.
  const cinema = buildMontagePlan({ scenes: twelve, styleId: "cinema" });
  const blackDips = cinema.cuts.filter((cut) => cut.type === "dip-black").map((cut) => cut.index);
  assert.deepEqual(blackDips, [4, 9], "les accents de Cinema doivent tomber tous les cinq plans");
  assert.ok(cinema.scenes[0].duration > cinema.scenes[1].duration, "Cinema doit ouvrir sur un plan qui respire");
  assert.ok(cinema.scenes.at(-1).duration > cinema.scenes[1].duration, "Cinema doit finir sur un plan qui tient");

  // « Mixed media » alterne reellement plusieurs transitions.
  const mixed = buildMontagePlan({ scenes: twelve, styleId: "mixed" });
  assert.ok(
    new Set(mixed.cuts.map((cut) => cut.type)).size >= 4,
    "Mixed media doit alterner au moins quatre traitements de coupe"
  );

  // « Produit » est metronomique: tous ses plans font la meme duree, sauf bouts.
  const produit = buildMontagePlan({ scenes: twelve, styleId: "produit" });
  const middleDurations = new Set(produit.scenes.slice(1, -1).map((scene) => scene.duration));
  assert.equal(middleDurations.size, 1, "Produit doit rester metronomique dans son ventre");

  /* ---------- 5. Synergie rythme <-> preset ---------- */

  /*
   * C'est la demande centrale du porteur du projet: le rythme doit accelerer le
   * montage SANS effacer le caractere du preset. On le verifie sur la FORME: les
   * rapports entre plans doivent etre identiques d'un rythme a l'autre.
   */
  for (const styleId of STYLE_RECIPES.map((recipe) => recipe.id)) {
    const calme = buildMontagePlan({ scenes: twelve, styleId, rhythmId: "calme" });
    const soutenu = buildMontagePlan({ scenes: twelve, styleId, rhythmId: "soutenu" });
    assert.ok(
      soutenu.estimatedDuration < calme.estimatedDuration,
      `${styleId}: un rythme soutenu doit raccourcir le montage`
    );
    /*
     * La forme = les rapports entre plans. On tolere 0,03: les durees sont
     * arrondies au centieme de seconde avant d'etre ecrites dans le projet, donc
     * deux cadences differentes ne peuvent pas donner des rapports strictement
     * egaux.
     */
    const shape = (plan) => plan.scenes.map((scene) => scene.duration / plan.scenes[0].duration);
    const fast = shape(soutenu);
    const slow = shape(calme);
    fast.forEach((ratio, index) => {
      assert.ok(
        Math.abs(ratio - slow[index]) < 0.03,
        `${styleId}: changer de rythme ne doit pas changer la FORME du montage (plan ${index}: ${round2(ratio)} vs ${round2(slow[index])})`
      );
    });
  }

  /*
   * ... et deux presets au meme rythme doivent, eux, avoir des formes
   * differentes: c'est ce qui manquait avant le lot L2.
   */
  const shapes = STYLE_RECIPES.map((recipe) => {
    const plan = buildMontagePlan({ scenes: twelve, styleId: recipe.id, rhythmId: "equilibre" });
    return JSON.stringify(plan.scenes.map((scene) => round2(scene.duration / plan.scenes[0].duration)));
  });
  assert.ok(new Set(shapes).size >= 4, "les presets doivent se distinguer par leur structure, pas seulement par leur teinte");

  /* ---------- 6. Les six presets produisent des montages distincts ---------- */

  const signatures = STYLE_RECIPES.map((recipe) => {
    const plan = buildMontagePlan({ scenes: twelve, styleId: recipe.id, rhythmId: "equilibre" });
    return JSON.stringify({
      durations: plan.scenes.map((scene) => scene.duration),
      cuts: plan.cuts.map((cut) => `${cut.type}:${cut.duration}`),
      motions: plan.scenes.map((scene) => scene.motion),
      look: plan.look,
    });
  });
  assert.equal(
    new Set(signatures).size,
    STYLE_RECIPES.length,
    "deux presets produisent exactement le meme montage"
  );

  /* ---------- 7. Valeurs par defaut et plan sans scene ---------- */

  const defaults = getDefaultGuidedChoices();
  assert.equal(defaults.styleId, STYLE_RECIPES[0].id);
  assert.equal(defaults.sequencePreset, STYLE_RECIPES[0].sequencePreset);
  assert.ok(RHYTHMS.some((rhythm) => rhythm.id === defaults.rhythmId), "rythme par defaut inconnu");
  assert.equal(defaults.motionMoodId, "style", "par defaut, la choregraphie du preset est conservee");

  const choiceOnly = buildMontagePlan(defaults);
  assert.equal(choiceOnly.sceneCount, 0);
  assert.equal(choiceOnly.scenes.length, 0);
  assert.equal(choiceOnly.cuts.length, 0);
  assert.ok(choiceOnly.motionPattern.length > 0, "un plan sans scene garde sa choregraphie");

  // Surcharge des mouvements par l'etape 3.
  const forcedStill = buildMontagePlan({ scenes: twelve, styleId: "mixed", motionMoodId: "aucun" });
  assert.ok(forcedStill.scenes.every((scene) => scene.motion === "none"), "le choix 'Aucun' doit figer toutes les photos");

  /* ---------- 8. Recapitulatif annonce a l'utilisateur ---------- */

  const planned = buildMontagePlan({ scenes: twelve, styleId: "souvenir", rhythmId: "equilibre" });
  const plannedRows = describeMontagePlan(planned);
  assert.ok(plannedRows.length >= 6, "recapitulatif trop pauvre");
  assert.equal(plannedRows.find((row) => row.id === "scenes").value, "12");
  assert.match(
    plannedRows.find((row) => row.id === "imageDuration").value,
    /à/,
    "le recapitulatif doit annoncer l'amplitude reelle des plans, pas une duree unique"
  );

  // L'etat reel du montage doit toujours l'emporter sur l'intention du plan.
  const measuredRows = describeMontagePlan(planned, {
    sceneCount: 7,
    totalDuration: 21.5,
    shortestImage: 2.1,
    longestImage: 3.4,
    transitionCount: 6,
    transitionTypes: ["film-dissolve"],
  });
  assert.equal(measuredRows.find((row) => row.id === "scenes").value, "7");
  assert.equal(measuredRows.find((row) => row.id === "duration").value, "21.5 s");
  assert.equal(measuredRows.find((row) => row.id === "imageDuration").value, "2.1 à 3.4 s");
  assert.match(measuredRows.find((row) => row.id === "transition").value, /^6 sur 11 coupes · Dissolution film$/);

  const cutOnly = buildMontagePlan({ scenes: [{ ...photo }, { ...photo }], styleId: "reel" });
  assert.equal(
    describeMontagePlan(cutOnly).find((row) => row.id === "transition").value,
    "Coupes franches",
    "un montage sans transition minutee doit l'annoncer"
  );

  /* ---------- 9. Apercu du look ---------- */

  for (const recipe of STYLE_RECIPES) {
    const filter = lookToCssFilter(recipe.look);
    assert.match(filter, /brightness\([\d.]+\) contrast\([\d.]+\) saturate\([\d.]+\)/, `${recipe.id}: filtre CSS invalide`);
    assert.doesNotMatch(filter, /NaN|undefined/, `${recipe.id}: filtre CSS non numerique`);
    const overlays = lookToOverlays(recipe.look);
    assert.ok(overlays.fade >= 0 && overlays.fade <= 1, `${recipe.id}: fade hors bornes`);
    assert.ok(overlays.vignette >= 0 && overlays.vignette <= 1, `${recipe.id}: vignette hors bornes`);
  }
  assert.equal(lookToCssFilter({}), lookToCssFilter(NEUTRAL_LOOK), "un look vide doit etre neutre");

  /* ---------- 10. Tempo des vignettes de demonstration ---------- */

  const paces = new Set();
  for (const recipe of STYLE_RECIPES) {
    const tempo = getStyleTempo(recipe);
    assert.ok(["cut", "fast", "soft", "long"].includes(tempo.pace), `${recipe.id}: allure inconnue ${tempo.pace}`);
    assert.ok(tempo.cycleSeconds >= 1.2 && tempo.cycleSeconds <= 5, `${recipe.id}: cycle hors bornes`);
    assert.equal(
      tempo.pace === "cut",
      recipe.transitionScore.every((type) => type === "cut"),
      `${recipe.id}: une coupe franche doit se demontrer comme une coupe franche`
    );
    paces.add(tempo.pace);
  }
  assert.ok(paces.size >= 3, "les presets doivent se distinguer par leur enchainement, pas seulement par leur texte");
  assert.equal(getStyleTempo("cinema").pace, getStyleTempo(STYLE_RECIPES.find((r) => r.id === "cinema")).pace);

  console.log(JSON.stringify({
    presets: STYLE_RECIPES.map((recipe) => {
      const plan = buildMontagePlan({ scenes: twelve, styleId: recipe.id, rhythmId: "equilibre" });
      return {
        id: recipe.id,
        durees: plan.scenes.map((scene) => scene.duration),
        coupes: plan.cuts.map((cut) => cut.type),
        montage: plan.estimatedDuration,
      };
    }),
  }, null, 2));
  console.log("smoke vibecut style recipes OK");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
