/*
 * PRE-VOL DU LOT L6 - « ffmpeg -h filter=xfade DANS L'IMAGE DEPLOYEE ».
 *
 * Le lot L1 a livre 15 transitions minutees, chacune mappee sur une cible native
 * du filtre `xfade`. Rien ne garantit qu'un build FFmpeg donne les expose toutes:
 * une cible absente fait echouer le rendu, ou le fait retomber sur `fade` sans
 * rien dire. C'est exactement le defaut que L1 a corrige cote code - il serait
 * absurde de le reintroduire par le build.
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
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

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

async function probeDeployed(url) {
  const endpoint = `${url.replace(/\/+$/, "")}/capabilities`;
  const response = await fetch(endpoint, { method: "GET" });
  const body = await response.json().catch(() => null);
  if (!body) throw new Error(`${endpoint}: reponse illisible (HTTP ${response.status})`);
  return { endpoint, status: response.status, body };
}

const required = await readRequiredXfadeTargets();
const deployedUrl = process.env.VIBECUT_RENDERER_URL || null;

if (deployedUrl) {
  const { endpoint, status, body } = await probeDeployed(deployedUrl);
  console.log(JSON.stringify({ mode: "deployed", endpoint, status, report: body }, null, 2));
  if (!body.ok) {
    console.error(
      "\nECHEC: l'image deployee ne rend pas toutes les transitions du lot L1.\n"
        + `Manquantes: ${(body.xfade?.missing || []).join(", ") || "?"}\n`
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
  console.log("\nOK: l'image deployee expose les 15 cibles xfade du lot L1.");
} else {
  const local = probeLocalFfmpeg(required);
  if (!local) {
    console.error("ECHEC: aucun FFmpeg exploitable trouve (ni ffmpeg-static, ni le PATH).");
    process.exit(1);
  }
  console.log(JSON.stringify({ mode: "local", required, ...local }, null, 2));
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
