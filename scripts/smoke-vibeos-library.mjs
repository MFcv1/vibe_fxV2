/*
 * Smoke de la bibliotheque photo VibeOS - la partie qui n'a pas besoin d'un
 * navigateur : le lecteur EXIF et le calcul de la masonry.
 *
 * Ces deux modules sont IMPORTES, jamais regexes: ce sont eux qui decident du
 * classement par appareil et de la place de chaque photo dans la grille. Une
 * regression ici ne se voit pas a l'oeil nu sur trois photos de test, mais
 * casse une photothèque entiere.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const p = (...parts) => path.join(root, ...parts);
const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibeos-library-"));

/* Les modules sont des ESM "use client" sans API navigateur au chargement: on
   les recopie en .mjs pour que Node les importe tels quels. */
async function importAppModule(sourcePath, name) {
    const source = await readFile(sourcePath, "utf8");
    const target = path.join(tempDir, `${name}.mjs`);
    await writeFile(target, source, "utf8");
    return import(pathToFileURL(target).href);
}

/* ---------------------------------------------------------------------------
 * Un JPEG minimal porteur d'un vrai bloc EXIF (little endian).
 * On fabrique les octets a la main: c'est la seule facon de tester le parseur
 * sur une structure connue, sans embarquer une photo binaire dans le depot.
 * ------------------------------------------------------------------------- */
function buildExifJpeg() {
    const HEADER = 8;
    const ifd0Entries = 3;
    const exifEntries = 4;

    const ifd0Size = 2 + ifd0Entries * 12 + 4;
    const exifIfdStart = HEADER + ifd0Size + 8 + 10; /* apres les donnees d'IFD0 */
    const makeOffset = HEADER + ifd0Size;            /* "Samsung\0" : 8 octets */
    const modelOffset = makeOffset + 8;              /* "SM-S911B\0" + padding */
    const exifDataStart = exifIfdStart + 2 + exifEntries * 12 + 4;
    const dateOffset = exifDataStart;                /* 20 octets */
    const fNumberOffset = dateOffset + 20;           /* rationnel: 8 octets */
    const focalOffset = fNumberOffset + 8;
    const tiffLength = focalOffset + 8;

    const tiff = Buffer.alloc(tiffLength, 0);
    tiff.write("II", 0, "ascii");
    tiff.writeUInt16LE(0x002a, 2);
    tiff.writeUInt32LE(HEADER, 4);

    const writeEntry = (base, slot, tag, type, count, value) => {
        const at = base + 2 + slot * 12;
        tiff.writeUInt16LE(tag, at);
        tiff.writeUInt16LE(type, at + 2);
        tiff.writeUInt32LE(count, at + 4);
        tiff.writeUInt32LE(value, at + 8);
    };

    /* IFD0: marque, modele, pointeur vers l'IFD Exif. */
    tiff.writeUInt16LE(ifd0Entries, HEADER);
    writeEntry(HEADER, 0, 0x010f, 2, 8, makeOffset);
    writeEntry(HEADER, 1, 0x0110, 2, 9, modelOffset);
    writeEntry(HEADER, 2, 0x8769, 4, 1, exifIfdStart);
    tiff.writeUInt32LE(0, HEADER + 2 + ifd0Entries * 12);
    tiff.write("Samsung\0", makeOffset, "ascii");
    tiff.write("SM-S911B\0", modelOffset, "ascii");

    /* IFD Exif: date de prise de vue, ISO, ouverture, focale. */
    tiff.writeUInt16LE(exifEntries, exifIfdStart);
    writeEntry(exifIfdStart, 0, 0x9003, 2, 20, dateOffset);
    writeEntry(exifIfdStart, 1, 0x8827, 3, 1, 400);
    writeEntry(exifIfdStart, 2, 0x829d, 5, 1, fNumberOffset);
    writeEntry(exifIfdStart, 3, 0x920a, 5, 1, focalOffset);
    tiff.writeUInt32LE(0, exifIfdStart + 2 + exifEntries * 12);
    tiff.write("2026:06:15 14:35:49\0", dateOffset, "ascii");
    tiff.writeUInt32LE(18, fNumberOffset);
    tiff.writeUInt32LE(10, fNumberOffset + 4);
    tiff.writeUInt32LE(24, focalOffset);
    tiff.writeUInt32LE(1, focalOffset + 4);

    const app1Length = 2 + 6 + tiff.length;
    /* SOI (2) + marqueur APP1 (2) + longueur (2) + "Exif\0\0" (6). */
    const head = Buffer.alloc(12);
    head.writeUInt16BE(0xffd8, 0);
    head.writeUInt16BE(0xffe1, 2);
    head.writeUInt16BE(app1Length, 4);
    head.write("Exif\0\0", 6, "binary");
    return Buffer.concat([head, tiff, Buffer.from([0xff, 0xd9])]);
}

let failures = 0;
const check = (label, run) => {
    try {
        run();
        console.log(`  ok   ${label}`);
    } catch (error) {
        failures += 1;
        console.error(`  FAIL ${label}\n       ${error.message}`);
    }
};

try {
    const exifModule = await importAppModule(
        p("src", "features", "vibeos", "library", "exif.js"), "exif",
    );
    const masonryModule = await importAppModule(
        p("src", "features", "vibeos", "library", "masonry.js"), "masonry",
    );
    const namingModule = await importAppModule(
        p("src", "features", "vibeos", "library", "folderNaming.js"), "folderNaming",
    );
    const quotaModule = await importAppModule(
        p("src", "features", "vibeos", "library", "libraryQuota.js"), "libraryQuota",
    );
    const platformModule = await importAppModule(
        p("src", "features", "vibeos", "library", "platform.js"), "platform",
    );

    /* ---------- 1. Lecture EXIF ---------- */
    console.log("EXIF");
    const jpeg = new Blob([buildExifJpeg()], { type: "image/jpeg" });
    const exif = await exifModule.readExif(jpeg);

    check("la marque et le modele sont fusionnes sans doublon", () => {
        assert.equal(exif.device, "Samsung SM-S911B");
    });
    check("la sensibilite est lue", () => assert.equal(exif.iso, 400));
    check("l'ouverture est formatee", () => assert.equal(exif.aperture, "f/1.8"));
    check("la focale est formatee", () => assert.equal(exif.focal, "24mm"));
    check("la date de prise de vue est convertie", () => {
        const date = new Date(exif.takenAt);
        assert.equal(date.getFullYear(), 2026);
        assert.equal(date.getMonth(), 5);
        assert.equal(date.getDate(), 15);
    });
    check("la ligne de metadonnees ne montre que les champs presents", () => {
        const line = exifModule.describeExif(exif);
        assert.deepEqual(line, ["24mm", "f/1.8", "ISO 400"]);
    });

    check("un fichier sans EXIF ne fait jamais echouer l'import", async () => {
        const png = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]);
        return exifModule.readExif(png).then((empty) => {
            assert.equal(empty.device, null);
            assert.equal(empty.takenAt, null);
        });
    });

    const emptyExif = await exifModule.readExif(
        new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]),
    );
    check("un PNG rend un enregistrement vide, pas une erreur", () => {
        assert.equal(emptyExif.device, null);
        assert.equal(emptyExif.orientation, 1);
    });

    /* ---------- 2. Masonry ---------- */
    console.log("Masonry");
    const items = [
        { id: "a", ratio: 0.75 }, { id: "b", ratio: 1.5 }, { id: "c", ratio: 1 },
        { id: "d", ratio: 0.66 }, { id: "e", ratio: 1.77 }, { id: "f", ratio: 0.8 },
        { id: "g", ratio: 1.2 },
    ];
    const gap = 8;
    const containerWidth = 1000;
    const columns = 4;
    const { rects, height } = masonryModule.layoutMasonry(items, { containerWidth, columns, gap });

    check("chaque photo recoit un rectangle", () => {
        assert.equal(rects.size, items.length);
    });

    check("les colonnes tiennent exactement dans la largeur", () => {
        const xs = [...new Set([...rects.values()].map((rect) => rect.x))].sort((a, b) => a - b);
        assert.equal(xs.length, columns);
        const last = [...rects.values()].find((rect) => rect.x === xs[xs.length - 1]);
        assert.ok(last.x + last.width <= containerWidth + 1, "la derniere colonne deborde");
    });

    check("le rapport de chaque photo est respecte", () => {
        for (const item of items) {
            const rect = rects.get(item.id);
            const drawn = rect.width / rect.height;
            assert.ok(Math.abs(drawn - item.ratio) < 0.05, `rapport casse pour ${item.id}`);
        }
    });

    check("aucune tuile n'en chevauche une autre", () => {
        const all = [...rects.values()];
        for (let i = 0; i < all.length; i += 1) {
            for (let j = i + 1; j < all.length; j += 1) {
                const a = all[i];
                const b = all[j];
                const overlap = a.x < b.x + b.width && b.x < a.x + a.width
                    && a.y < b.y + b.height && b.y < a.y + a.height;
                assert.ok(!overlap, "deux photos se superposent");
            }
        }
    });

    check("les quatre premieres photos remplissent les quatre colonnes", () => {
        const firstRow = items.slice(0, columns).map((item) => rects.get(item.id).x);
        assert.equal(new Set(firstRow).size, columns);
        assert.deepEqual(firstRow, [...firstRow].sort((a, b) => a - b));
    });

    check("la hauteur totale correspond a la colonne la plus longue", () => {
        const bottom = Math.max(...[...rects.values()].map((rect) => rect.y + rect.height));
        assert.equal(height, bottom);
    });

    check("une liste vide ne casse rien", () => {
        const empty = masonryModule.layoutMasonry([], { containerWidth, columns, gap });
        assert.equal(empty.rects.size, 0);
        assert.equal(empty.height, 0);
    });

    check("la densite est bornee par la largeur reelle", () => {
        assert.equal(masonryModule.resolveColumns(8, 360), 3);
        assert.equal(masonryModule.resolveColumns(4, 1200), 4);
        assert.equal(masonryModule.resolveColumns(8, 0), 8);
    });

    /* ---------- 3. Nommage des dossiers ---------- */
    console.log("Dossiers");
    const { directoryNameOf, sanitizeFolderName, suggestFolderName, uniqueFolderName } = namingModule;

    check("un dossier choisi donne son nom", () => {
        assert.equal(directoryNameOf([
            { webkitRelativePath: "Vacances 2026/a.jpg" },
            { webkitRelativePath: "Vacances 2026/b.jpg" },
        ]), "Vacances 2026");
    });

    check("des fichiers isoles n'inventent aucun nom de dossier", () => {
        assert.equal(directoryNameOf([{ name: "a.jpg" }, { name: "b.jpg" }]), "");
    });

    check("deux dossiers sources differents ne se melangent pas", () => {
        assert.equal(directoryNameOf([
            { webkitRelativePath: "ete/a.jpg" },
            { webkitRelativePath: "hiver/b.jpg" },
        ]), "");
    });

    check("un nom saisi est nettoye, jamais recopie tel quel", () => {
        assert.equal(sanitizeFolderName("  mes/photos:2026  "), "mes photos 2026");
        assert.equal(sanitizeFolderName("a".repeat(120)).length, 60);
        assert.equal(sanitizeFolderName("   "), "");
    });

    check("un nom deja pris recoit un suffixe, comme sur un bureau", () => {
        assert.equal(uniqueFolderName("Ete", ["Ete"]), "Ete (2)");
        assert.equal(uniqueFolderName("Ete", ["Ete", "Ete (2)"]), "Ete (3)");
        assert.equal(uniqueFolderName("Ete", ["Autre"]), "Ete");
    });

    check("la comparaison des noms ignore la casse et les accents", () => {
        assert.equal(uniqueFolderName("Été", ["ete"]), "Été (2)");
    });

    check("sans dossier source, le nom propose est la date du jour", () => {
        const at = new Date(2026, 7, 31, 12).getTime();
        assert.equal(suggestFolderName({ files: [{ name: "a.jpg" }], taken: [], at }), "31 août 2026");
    });

    /* ---------- 4. Quota ---------- */
    console.log("Quota");
    const { LIBRARY_QUOTA, checkImport, quotaState } = quotaModule;

    check("une bibliotheque vide n'est ni pleine ni en alerte", () => {
        const state = quotaState({ photoCount: 0, bytes: 0 });
        assert.equal(state.full, false);
        assert.equal(state.warning, false);
        assert.equal(state.photosLeft, LIBRARY_QUOTA.photos);
    });

    check("le plafond qui parle est celui qui est le plus proche", () => {
        const state = quotaState({ photoCount: 10, bytes: LIBRARY_QUOTA.bytes * 0.9 });
        assert.equal(state.driver, "bytes");
        assert.equal(state.warning, true);
    });

    check("un import qui depasse le nombre de photos est coupe net", () => {
        const files = Array.from({ length: 5 }, () => ({ size: 1024 }));
        const gate = checkImport({ photoCount: LIBRARY_QUOTA.photos - 2, bytes: 0, files });
        assert.equal(gate.accepted, 2);
        assert.equal(gate.rejected, 3);
        assert.equal(gate.blockedBy, "photos");
        assert.match(gate.message, /1000 photos/);
    });

    check("un import qui depasse le volume est coupe net", () => {
        const files = Array.from({ length: 3 }, () => ({ size: LIBRARY_QUOTA.bytes / 2 }));
        const gate = checkImport({ photoCount: 0, bytes: 0, files });
        assert.equal(gate.accepted, 2);
        assert.equal(gate.blockedBy, "bytes");
    });

    check("bibliotheque pleine: rien ne passe, et on le dit", () => {
        const gate = checkImport({ photoCount: LIBRARY_QUOTA.photos, bytes: 0, files: [{ size: 10 }] });
        assert.equal(gate.ok, false);
        assert.equal(gate.accepted, 0);
        assert.match(gate.message, /pleine/);
    });

    /* ---------- 5. Reconnaissance de l'appareil ---------- */
    console.log("Appareil");
    const { detectPlatform, importSources, isMobilePlatform } = platformModule;

    const asNav = (userAgent, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints });

    check("un iPhone est reconnu", () => {
        assert.equal(detectPlatform(asNav("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).id, "ios");
    });

    check("un Android est reconnu", () => {
        assert.equal(detectPlatform(asNav("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).id, "android");
    });

    check("un Mac est reconnu", () => {
        assert.equal(detectPlatform(asNav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).id, "macos");
    });

    check("un iPad qui se declare Macintosh est rattrape par le tactile", () => {
        assert.equal(detectPlatform(asNav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).id, "ios");
    });

    check("Windows est reconnu", () => {
        assert.equal(detectPlatform(asNav("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).id, "windows");
    });

    check("le telephone se voit proposer la photothèque et l'appareil photo", () => {
        const sources = importSources(detectPlatform(asNav("iPhone")));
        assert.deepEqual(sources.map((source) => source.id), ["gallery", "camera", "files"]);
        assert.equal(sources[1].input.capture, "environment");
    });

    check("l'ordinateur se voit proposer le dossier entier, pas l'appareil photo", () => {
        const platform = detectPlatform(asNav("Mozilla/5.0 (Windows NT 10.0)"));
        const sources = importSources(platform);
        assert.deepEqual(sources.map((source) => source.id), ["files", "directory"]);
        assert.equal(sources[1].input.webkitdirectory, true);
        assert.equal(isMobilePlatform(platform), false);
    });
} finally {
    await rm(tempDir, { recursive: true, force: true });
}

if (failures) {
    console.error(`\n${failures} verification(s) en echec.`);
    process.exit(1);
}
console.log("\nBibliotheque VibeOS: toutes les verifications passent.");
