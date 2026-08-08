/*
 * PRE-VOL DU RENDERER - « ce que l'IMAGE DEPLOYEE sait vraiment faire ».
 *
 * Deux controles, pas un :
 *
 *  1. LES CIBLES `xfade`. Le lot L1 en a livre 15, le lot B3a a porte le total a
 *     33 transitions sur 29 cibles natives. Rien ne garantit qu'un build FFmpeg
 *     donne les expose toutes : une cible absente fait echouer le rendu, ou le
 *     fait retomber sur `fade` sans rien dire.
 *  2. LES FILTRES. Depuis le lot B3b (2026-08-03), les 15 dernieres transitions
 *     ne sont plus des cibles `xfade` mais des SOUS-GRAPHES de filtres natifs
 *     (`gblur`, `zoompan`, `displace`, `rgbashift`, `mergeplanes`, `tpad`...).
 *     Verifier les cibles ne dit donc plus rien d'elles : un build ou `displace`
 *     manquerait passerait le premier controle et ferait echouer le rendu entier
 *     en production. La liste est RELEVEE sur les sous-graphes que le renderer
 *     emet, jamais recopiee a la main.
 *
 * Ce script se lance de DEUX facons:
 *
 *   node scripts/check-vibecut-renderer-image-capabilities.mjs
 *       -> verifie le FFmpeg LOCAL (celui de `ffmpeg-static`, puis celui du
 *          PATH). A lancer AVANT le rollout: si les cibles manquent deja ici,
 *          inutile de payer un build.
 *
 *   VIBECUT_RENDERER_URL=https://... node scripts/...
 *       -> interroge le point de controle `/capabilities` du service DEPLOYE.
 *          A lancer APRES le rollout: c'est la seule verification qui porte sur
 *          l'image reellement en production.
 *
 * AUCUN DEPLOIEMENT n'est declenche ici, et aucun rendu: le point de controle
 * est en lecture seule.
 *
 * -------------------------------------------------------------------------
 * POURQUOI LA REPONSE DEPLOYEE EST SI PAUVRE (decide le 2026-08-01)
 *
 * `/capabilities` est SANS AUTHENTIFICATION sur un service Cloud Run PUBLIC:
 * sa reponse est lisible par n'importe qui. Elle ne porte donc NI la version de
 * FFmpeg NI le texte des erreurs — seulement `ok`, la revision, les cibles
 * manquantes et un COMPTEUR d'erreurs. Une banniere de version renseignerait
 * gratuitement quelqu'un qui cherche les CVE de ce build precis.
 *
 * Si ce script signale `errorCount > 0` sans dire pourquoi, le detail est dans
 * les journaux Cloud Run:
 *
 *   gcloud run services logs read vibecut-render-service \
 *     --region europe-west9 --project vibefx-v2 --limit 50 | grep capabilities
 *
 * En mode LOCAL, aucune de ces precautions ne s'applique: rien n'est expose,
 * donc on affiche la version FFmpeg, qui est utile au diagnostic.
 * -------------------------------------------------------------------------
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

import { SERVER_TRANSITION_EFFECTS, buildTransitionSubgraph } from "../render-service/src/server.js";

const require = createRequire(import.meta.url);
const root = process.cwd();

/*
 * La liste des cibles est LUE du renderer, jamais recopiee: c'est la meme table
 * que `exportManifest.js` et `functions/src/videoExport.js` portent, et
 * `smoke-vibecut-transition-parity` echoue deja si les trois divergent.
 */
async function readRequiredXfadeTargets() {
  const source = await readFile(path.join(root, "render-service", "src", "server.js"), "utf8");
  const block = source.match(/SERVER_XFADE_TRANSITION_MAP\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
  if (!block) throw new Error("SERVER_XFADE_TRANSITION_MAP introuvable dans le renderer");
  const targets = [...block[1].matchAll(/:\s*'([a-z0-9]+)'/g)].map((match) => match[1]);
  if (targets.length === 0) throw new Error("aucune cible xfade lue dans le renderer");
  return [...new Set(targets)].sort();
}

/*
 * Les filtres employes par les sous-graphes de transition, releves sur ce que le
 * renderer emet vraiment. Une liste ecrite a la main deriverait au premier effet
 * ajoute - et un point de controle qui derive ne controle plus rien.
 */
function readRequiredFilters() {
  const names = new Set();
  Object.keys(SERVER_TRANSITION_EFFECTS).forEach((type) => {
    buildTransitionSubgraph({
      type,
      index: 1,
      duration: 0.6,
      durationA: 2,
      durationB: 2,
      width: 1920,
      height: 1080,
      fps: 30,
      labelA: "[a]",
      labelB: "[b]",
      labelOut: "[x]",
    }).forEach((part) => {
      part.split(/[;,]/).forEach((chunk) => {
        const match = /(?:^|\])\s*([a-z][a-z0-9_]*)\s*(?:=|$)/.exec(chunk.trim());
        if (match) names.add(match[1]);
      });
    });
  });
  return [...names].sort();
}

function probeLocalFilters(binary, required) {
  const list = spawnSync(binary, ["-hide_banner", "-filters"], { encoding: "utf8" });
  const text = `${list.stdout || ""}\n${list.stderr || ""}`;
  return required.filter((name) => !new RegExp(`\\s${name}\\s`).test(text));
}

function probeLocalFfmpeg(required) {
  const candidates = [];
  try {
    const staticPath = require("ffmpeg-static");
    if (staticPath) candidates.push(staticPath);
  } catch {
    /* ffmpeg-static absent: on se rabat sur le PATH. */
  }
  candidates.push("ffmpeg");

  for (const binary of candidates) {
    const version = spawnSync(binary, ["-version"], { encoding: "utf8" });
    if (version.status !== 0) continue;
    const help = spawnSync(binary, ["-hide_banner", "-h", "filter=xfade"], { encoding: "utf8" });
    // Selon les builds, `-h filter` ecrit sur stdout ou sur stderr: on lit les deux.
    const text = `${help.stdout || ""}\n${help.stderr || ""}`;
    if (!text.includes("xfade")) continue;
    const available = required.filter((name) => new RegExp(`\\b${name}\\b`).test(text));
    return {
      binary,
      ffmpeg: (version.stdout || "").split("\n")[0],
      available,
      missing: required.filter((name) => !available.includes(name)),
    };
  }
  return null;
}

/*
 * Les mouvements ATTENDUS sont lus de `mediaModel.js` - la table de l'apercu -
 * et non de la liste du renderer. Lire le renderer pour verifier le renderer ne
 * prouverait rien: les deux seraient d'accord meme en etant tous les deux
 * perimes par rapport a ce que l'interface propose.
 */
function readRequiredImageMotions() {
  const source = readFileSync(
    path.join(root, "src/features/vibefx-studio/video/model/mediaModel.js"),
    "utf8",
  );
  /*
   * La borne est OVERSHOOT_C1 et non IMAGE_MOTION_BY_ID: cette derniere est
   * declaree APRES les accents, donc la tranche avalait leurs ids et le pre-vol
   * annoncait « mouvements absents: shake, pulse ».
   */
  const block = source.slice(
    source.indexOf("IMAGE_MOTION_PRESETS"),
    source.indexOf("export const OVERSHOOT_C1"),
  );
  const ids = [...block.matchAll(/id:\s*'([a-z-]+)'/g)].map((match) => match[1]);
  if (ids.length === 0) throw new Error("aucun mouvement lu dans mediaModel.js");
  return ids;
}

function readRequiredAccents() {
  const source = readFileSync(
    path.join(root, "src/features/vibefx-studio/video/model/mediaModel.js"),
    "utf8",
  );
  const block = source.slice(
    source.indexOf("IMAGE_MOTION_ACCENTS"),
    source.indexOf("const ACCENT_BY_ID"),
  );
  const ids = [...block.matchAll(/id:\s*'([a-z-]+)'/g)].map((match) => match[1]);
  if (ids.length === 0) throw new Error("aucun accent lu dans mediaModel.js");
  return ids;
}

async function probeDeployed(url) {
  const endpoint = `${url.replace(/\/+$/, "")}/capabilities`;
  const response = await fetch(endpoint, { method: "GET" });
  const body = await response.json().catch(() => null);
  if (!body) throw new Error(`${endpoint}: reponse illisible (HTTP ${response.status})`);
  return { endpoint, status: response.status, body };
}

const required = await readRequiredXfadeTargets();
const requiredFilters = readRequiredFilters();
const requiredMotions = readRequiredImageMotions();
const requiredAccents = readRequiredAccents();
const deployedUrl = process.env.VIBECUT_RENDERER_URL || null;

if (deployedUrl) {
  const { endpoint, status, body } = await probeDeployed(deployedUrl);
  console.log(JSON.stringify({ mode: "deployed", endpoint, status, report: body }, null, 2));
  if (!body.ok) {
    console.error(
      "\nECHEC: l'image deployee ne rend pas tout ce que le renderer demande.\n"
        + `Cibles xfade manquantes: ${(body.xfade?.missing || []).join(", ") || "aucune"}\n`
        + `Filtres manquants: ${(body.filters?.missing || []).join(", ") || "aucune"}\n`
        + (body.errorCount
          ? `${body.errorCount} erreur(s) cote renderer. Le detail n'est VOLONTAIREMENT pas `
            + "dans la reponse (endpoint public); il est dans les journaux:\n"
            + "  gcloud run services logs read vibecut-render-service "
            + "--region europe-west9 --project vibefx-v2 --limit 50 | grep capabilities\n"
          : "")
        + "Ne pas basculer les exports serveur sur ces transitions tant que ce n'est pas vert."
    );
    process.exit(1);
  }
  /*
   * Le NOMBRE est lu de la reponse, jamais ecrit en dur: il a valu 15 au lot L1
   * puis 29 au lot B3a, et un texte fige aurait annonce « 15 » en rendant 29.
   */
  console.log(
    `\nOK: l'image deployee expose les ${(body.xfade?.available || []).length} cibles xfade`
      + ` et les ${(body.filters?.required || []).length} filtres attendus.`,
  );
  /*
   * Un renderer anterieur au lot B3b repond sans le bloc `filters`. Il aurait
   * l'air « vert » alors qu'il ne sait rien des quinze dernieres transitions:
   * c'est exactement l'ecart qu'on cherche a fermer apres un rollout.
   */
  /*
   * LOT B3 - les MOUVEMENTS PHOTO. Le verrou du renderer refuse tout id absent
   * de sa liste, donc une image d'avant le lot refuse `orbit`, `bounce` et
   * `drift-down`. Le controle des cibles et des filtres ne disait rien d'eux -
   * meme angle mort que celui referme au lot B3b pour les sous-graphes.
   */
  const deployedMotions = body.imageMotions?.supported || null;
  if (!deployedMotions) {
    console.error(
      "\nATTENTION: cette image ne rapporte AUCUN mouvement photo"
        + " (capabilitiesVersion < 6). Elle est anterieure au lot B3 (2026-08-03)"
        + " et REFUSERA l'export de toute photo animee par « descente », « orbite »"
        + " ou « rebond », que la bibliotheque annonce pourtant applicables."
        + " Le rollout n'a pas eu lieu."
    );
    process.exit(1);
  }
  const missingMotions = requiredMotions.filter((id) => !deployedMotions.includes(id));
  if (missingMotions.length) {
    console.error(
      `\nECHEC: mouvements absents de l'image deployee: ${missingMotions.join(", ")}.\n`
        + "L'export sera REFUSE pour toute photo qui les utilise."
    );
    process.exit(1);
  }
  console.log(`OK: les ${requiredMotions.length} mouvements photo sont acceptes par l'image deployee.`);

  /*
   * LES ACCENTS (effets pendant le plan). Meme raison que pour les mouvements:
   * une image d'avant le lot REFUSE l'export d'un plan qui en porte un, et rien
   * d'autre ne le dirait avant que l'utilisateur ne tombe dessus.
   */
  const deployedAccents = body.motionAccents?.supported || null;
  if (!deployedAccents) {
    console.error(
      "\nATTENTION: cette image ne rapporte AUCUN accent (capabilitiesVersion < 7)."
        + " Elle REFUSERA l'export de tout plan portant une secousse ou une"
        + " respiration, que l'interface propose pourtant. Le rollout n'a pas eu lieu."
    );
    process.exit(1);
  }
  const missingAccents = requiredAccents.filter((id) => !deployedAccents.includes(id));
  if (missingAccents.length) {
    console.error(`\nECHEC: accents absents de l'image deployee: ${missingAccents.join(", ")}.`);
    process.exit(1);
  }
  console.log(`OK: les ${requiredAccents.length} accents sont acceptes par l'image deployee.`);

  if (!body.filters) {
    console.error(
      "\nATTENTION: cette image ne rapporte AUCUN controle de filtres. Elle est"
        + " anterieure au lot B3b (2026-08-03) et rend un simple fondu pour les"
        + " 15 dernieres transitions du catalogue, que la bibliotheque annonce"
        + " pourtant exportables. Le rollout n'a pas eu lieu."
    );
    process.exit(1);
  }
} else {
  const local = probeLocalFfmpeg(required);
  if (!local) {
    console.error("ECHEC: aucun FFmpeg exploitable trouve (ni ffmpeg-static, ni le PATH).");
    process.exit(1);
  }
  const missingFilters = probeLocalFilters(local.binary, requiredFilters);
  console.log(JSON.stringify({ mode: "local", required, requiredFilters, missingFilters, ...local }, null, 2));
  if (missingFilters.length > 0) {
    console.error(
      `\nECHEC: filtres absents du FFmpeg local: ${missingFilters.join(", ")}.\n`
        + "Les transitions du lot B3b ne peuvent pas etre rendues sans eux."
    );
    process.exit(1);
  }
  if (local.missing.length > 0) {
    console.error(
      `\nECHEC: cibles xfade absentes du FFmpeg local: ${local.missing.join(", ")}.\n`
        + "Inutile de lancer un build Cloud Run avant d'avoir regle ca."
    );
    process.exit(1);
  }
  console.log(
    "\nOK localement. Ceci ne prouve RIEN sur la production: relancer avec\n"
      + "VIBECUT_RENDERER_URL=<url du service> APRES le rollout."
  );
}
