/*
 * GATE DU LOT B2 - les medias des bibliotheques.
 *
 * Trois choses, et chacune correspond a une facon precise dont ce lot pouvait
 * mal tourner :
 *
 *  1. LES DROITS. C'est la raison d'etre du test. Le projet bloque deja l'export
 *     d'une musique sans declaration de droits ; poser des videos dans une page
 *     servie a tous les visiteurs sans provenance serait exactement le laxisme
 *     qu'on a refuse sur la musique. Un clip declare doit exister sur le disque,
 *     porter une licence et une source, sinon ce test echoue.
 *  2. L'ORDRE DE CHOIX. Videos du projet -> photos du projet -> clips de
 *     demonstration -> repli dessine. Le lot ne sert a rien si une photo passe
 *     devant une video : l'ecran resterait fixe alors qu'un rush anime est
 *     disponible.
 *  3. LE POIDS. Des clips charges par tous les visiteurs doivent rester sous le
 *     plafond decide AVANT de les produire (1,5 Mo), pas apres.
 *
 * Sans navigateur : c'est de la logique pure et un controle de fichiers.
 */

import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOTAL_BUDGET_BYTES = 1_500_000;

const { LIBRARY_DEMO_CLIPS, getPlayableDemoClips } = await import(
  path.join(root, "src/features/vibecut/library/libraryMediaManifest.js")
);
const { selectProjectSources } = await import(
  path.join(root, "src/features/vibecut/library/librarySourceOrder.js")
);

/* 1. DROITS ET FICHIERS ---------------------------------------------------- */

assert.ok(LIBRARY_DEMO_CLIPS.length > 0, "Aucun clip de demonstration declare");

let totalBytes = 0;
const clips = [];
for (const clip of LIBRARY_DEMO_CLIPS) {
  assert.ok(clip.id, "Un clip sans id");
  assert.ok(clip.file?.startsWith("/assets/"), `${clip.id}: le fichier doit etre sous /assets/`);
  assert.ok(clip.license, `${clip.id}: AUCUNE LICENCE DECLAREE. Un media sans provenance ne va pas dans l'interface.`);
  assert.ok(clip.source, `${clip.id}: aucune source declaree`);

  const onDisk = path.join(root, "public", clip.file.replace(/^\//, ""));
  const info = await stat(onDisk).catch(() => null);
  assert.ok(info, `${clip.id}: declare dans le manifeste mais ABSENT du disque (${clip.file}). `
    + "Regenerer avec: node scripts/build-vibecut-library-demo-clips.mjs");
  assert.ok(info.size > 1024, `${clip.id}: fichier suspect (${info.size} octets) - pointeur Git LFS ?`);
  totalBytes += info.size;
  clips.push({ id: clip.id, bytes: info.size });
}

assert.ok(
  totalBytes <= TOTAL_BUDGET_BYTES,
  `Les clips pesent ${totalBytes} octets pour un plafond de ${TOTAL_BUDGET_BYTES}. `
  + "Recompresser plutot que relever le plafond.",
);

/*
 * Un clip dont les droits ne sont pas verifies ne doit JAMAIS etre servi.
 * On le prouve en soumettant un jeu FABRIQUE - chaque entree a un defaut
 * different - et en verifiant que seule la valide ressort. Filtrer la vraie
 * liste ne prouverait rien : elle est entierement valide, le filtre pourrait
 * etre l'identite sans que ca se voie.
 */
const forged = [
  { id: "ok", file: "/assets/a.mp4", license: "CC0", source: "test", rightsCleared: true },
  { id: "sans-droits", file: "/assets/b.mp4", license: "CC0", source: "test", rightsCleared: false },
  { id: "sans-licence", file: "/assets/c.mp4", license: "", source: "test", rightsCleared: true },
  { id: "sans-fichier", file: "", license: "CC0", source: "test", rightsCleared: true },
];
assert.deepEqual(
  getPlayableDemoClips(forged).map((clip) => clip.id),
  ["ok"],
  "getPlayableDemoClips laisse passer un clip sans droits, sans licence ou sans fichier",
);

/* 2. ORDRE DE CHOIX -------------------------------------------------------- */

const photo = (id) => ({ id, isImage: true, thumbnail: `blob:${id}`, mediaUrl: null });
const video = (id) => ({ id, isImage: false, thumbnail: `blob:${id}-thumb`, mediaUrl: `blob:${id}-src` });

const cases = [
  {
    name: "deux videos: on prend les deux videos",
    scenes: [video("a"), video("b"), photo("c")],
    expect: ["video:blob:a-src", "video:blob:b-src"],
  },
  {
    name: "une photo AVANT une video: la video passe devant",
    scenes: [photo("p"), video("v")],
    expect: ["video:blob:v-src", "photo:blob:p"],
  },
  {
    name: "que des photos: on prend les deux premieres",
    scenes: [photo("p1"), photo("p2"), photo("p3")],
    expect: ["photo:blob:p1", "photo:blob:p2"],
  },
  {
    name: "une seule source: une seule, l'appelant complete avec le repli",
    scenes: [photo("seule")],
    expect: ["photo:blob:seule"],
  },
  {
    name: "projet vide: rien, donc les clips de demonstration",
    scenes: [],
    expect: [],
  },
  {
    name: "une video sans URL n'est pas utilisable",
    scenes: [{ id: "x", isImage: false, mediaUrl: null, thumbnail: null }],
    expect: [],
  },
];

for (const testCase of cases) {
  const got = selectProjectSources(testCase.scenes).map((item) => `${item.kind}:${item.src}`);
  assert.deepEqual(got, testCase.expect, `ordre de choix - ${testCase.name}`);
}

/* 3. RAPPORT --------------------------------------------------------------- */

console.log(JSON.stringify({
  clips,
  totalBytes,
  budgetBytes: TOTAL_BUDGET_BYTES,
  ordreVerifie: cases.length,
}, null, 2));
console.log(`smoke-vibecut-library-media: ok (${clips.length} clips declares et presents, ${cases.length} regles d'ordre)`);
