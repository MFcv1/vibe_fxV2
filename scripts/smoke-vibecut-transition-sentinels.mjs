/*
 * SENTINELLES (plan.md § 10).
 *
 * « Un test de parite qui passe toujours ne prouve rien. » Ce script rejoue
 * VOLONTAIREMENT, sur le code de production, le defaut que chaque test est cense
 * attraper, et verifie que le test ECHOUE. S'il passe malgre le defaut, c'est le
 * test qui est devenu aveugle - et c'est ce script-la qui le dit.
 *
 * Le defaut est injecte en reecrivant temporairement le fichier de production,
 * puis le fichier est REMIS EN L'ETAT dans un `finally`. Rien n'est laisse
 * derriere, meme si une assertion echoue en route.
 *
 * ⚠️ NE MODIFIE PAS `render-service/src/server.js` NI `xfadeTransitions.js`
 * PENDANT QUE CE SCRIPT TOURNE, et ne l'interromps pas a la legere. Il garde en
 * memoire l'etat des fichiers a son demarrage et les y remet a la fin : une
 * edition faite entre-temps serait ECRASEE par cette remise en etat. C'est arrive
 * le 2026-08-03. Le script est long (sept rendus complets) : lance-le quand tu
 * n'as plus rien a editer sur ces deux fichiers.
 *
 * Chaque sentinelle vise un defaut PRECIS et PLAUSIBLE, pas un sabotage grossier :
 * un flou qui ne rampe pas, un decalage RVB dans le mauvais sens, une carte de
 * deplacement dont le signe est inverse, une fenetre de temps posee au mauvais
 * endroit. Ce sont exactement les erreurs commises pendant l'ecriture du lot.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SERVER = path.join(process.cwd(), "render-service", "src", "server.js");
const CANVAS = path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "engine", "xfadeTransitions.js");

const SENTINELS = [
  {
    name: "un flou qui ne rampe pas",
    file: SERVER,
    why: "l'intensite est figee a son maximum au lieu de suivre la courbe. Le fondu reste juste, seule la rampe est morte.",
    rewrite: (source) => replaceOnce(
      source,
      "function gaussianBlurStep(effect, side, width, q) {\n  const sigma = effect.amount * width * transitionEffectCurve(effect.curve, q, side);",
      "function gaussianBlurStep(effect, side, width, q) {\n  const sigma = effect.amount * width * 1;",
    ),
    test: "parity",
  },
  {
    name: "un decalage RVB dans le mauvais sens",
    file: SERVER,
    why: "rouge et bleu sont echanges. L'amplitude et la courbe restent exactes, seul le SENS est faux.",
    rewrite: (source) => replaceOnce(
      source,
      "  return `rgbashift=rh=${-shift}:bh=${shift}`;",
      "  return `rgbashift=rh=${shift}:bh=${-shift}`;",
    ),
    test: "parity",
  },
  {
    name: "une carte de deplacement de signe inverse",
    file: SERVER,
    why: "les bandes du glitch glissent du mauvais cote. C'est l'erreur exacte commise le 2026-08-03, avant de mesurer le sens de `displace`.",
    rewrite: (source) => replaceOnce(
      source,
      "  const band = `128-round((${amplitude})*sin(Y*2.399963+11))`;",
      "  const band = `128+round((${amplitude})*sin(Y*2.399963+11))`;",
    ),
    test: "parity",
  },
  {
    name: "un apercu qui ignore la quantification par paliers",
    file: CANVAS,
    why: "l'apercu lit la courbe en continu alors que l'export avance par douze paliers. C'est l'ecart qui se cache le mieux: il n'existe qu'entre deux paliers.",
    rewrite: (source) => replaceOnce(
      source,
      "    const qStep = quantizeProgress(t);",
      "    const qStep = clamp(t, 0, 1);",
    ),
    test: "parity",
  },
  {
    name: "une fenetre de temps posee au mauvais endroit",
    file: SERVER,
    why: "le cote A est rampe depuis le DEBUT du plan sortant au lieu de sa queue. Sur une transition isolee entre deux plans de meme longueur, le defaut passe presque inapercu; sur un enchainement il saute aux yeux.",
    rewrite: (source) => replaceOnce(
      source,
      "    parts.push(`${labelA}${steppedChain({ geometry, windowStart: offset, buildStep: (q) => stepped(effect, 'a', width, q) })}${tag('a')}`);",
      "    parts.push(`${labelA}${steppedChain({ geometry, windowStart: 0, buildStep: (q) => stepped(effect, 'a', width, q) })}${tag('a')}`);",
    ),
    test: "chain",
  },
];

const TESTS = {
  parity: {
    script: "scripts/smoke-vibecut-xfade-preview-parity.mjs",
    label: "smoke-vibecut-xfade-preview-parity",
  },
  chain: {
    script: "scripts/smoke-vibecut-transition-chain-mp4.mjs",
    label: "smoke-vibecut-transition-chain-mp4",
  },
};

const originals = new Map();
for (const file of new Set(SENTINELS.map((sentinel) => sentinel.file))) {
  originals.set(file, await readFile(file, "utf8"));
}

const results = [];
try {
  // Etat de depart: les deux tests doivent passer AVANT toute injection.
  for (const key of Object.keys(TESTS)) {
    const clean = await run(TESTS[key].script);
    assert.equal(clean.code, 0, `${TESTS[key].label} echoue AVANT toute injection: ${clean.tail}`);
  }

  for (const sentinel of SENTINELS) {
    const original = originals.get(sentinel.file);
    const patched = sentinel.rewrite(original);
    assert.notEqual(patched, original, `sentinelle « ${sentinel.name} »: le motif n'existe plus dans ${path.basename(sentinel.file)}`);
    await writeFile(sentinel.file, patched, "utf8");
    const outcome = await run(TESTS[sentinel.test].script);
    await writeFile(sentinel.file, original, "utf8");

    assert.notEqual(
      outcome.code,
      0,
      `SENTINELLE MUETTE - « ${sentinel.name} » n'a pas fait echouer ${TESTS[sentinel.test].label}. `
      + `${sentinel.why} Le test ne prouve donc rien sur ce point.`,
    );
    results.push({ sentinelle: sentinel.name, test: TESTS[sentinel.test].label, detectee: true });
  }
} finally {
  for (const [file, source] of originals) {
    await writeFile(file, source, "utf8");
  }
}

console.log(JSON.stringify({ sentinels: results }, null, 2));
console.log(`smoke-vibecut-transition-sentinels: ok (${results.length} defauts rejoues, ${results.length} attrapes)`);

function replaceOnce(source, from, to) {
  const index = source.indexOf(from);
  if (index < 0) return source;
  if (source.indexOf(from, index + 1) >= 0) return source;
  return source.slice(0, index) + to + source.slice(index + from.length);
}

function run(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("close", (code) => resolve({ code, tail: output.slice(-600) }));
  });
}
