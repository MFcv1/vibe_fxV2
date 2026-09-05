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
    const heicModule = await importAppModule(
        p("src", "features", "vibeos", "library", "heicImport.js"), "heicImport",
    );
    const scoutModule = await importAppModule(
        p("src", "features", "vibeos", "library", "libraryScout.js"), "libraryScout",
    );
    const cadenceModule = await importAppModule(
        p("src", "features", "vibeos", "library", "carouselCadence.js"), "carouselCadence",
    );

    /* ---------- 0. Reconnaissance HEIC ---------- */
    console.log("HEIC");
    check("HEIC est reconnu par extension, sans distinction de casse", () => {
        assert.equal(heicModule.isHeicFile({ name: "IMG_6469.HEIC", type: "" }), true);
        assert.equal(heicModule.isHeicFile({ name: "portrait.heifs", type: "" }), true);
    });
    check("HEIC est reconnu par MIME quand le nom est trompeur", () => {
        assert.equal(heicModule.isHeicFile({ name: "photo", type: "image/heic" }), true);
        assert.equal(heicModule.isHeicFile({ name: "photo.bin", type: "image/heif-sequence" }), true);
    });
    check("un format web ordinaire n'est pas converti", () => {
        assert.equal(heicModule.isHeicFile({ name: "photo.jpeg", type: "image/jpeg" }), false);
    });
    check("le nom converti devient un vrai nom JPEG", () => {
        assert.equal(heicModule.jpegNameFor("IMG_6469.HEIC"), "IMG_6469.jpg");
        assert.equal(heicModule.jpegNameFor("portrait"), "portrait.jpg");
    });

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

    /* ---------- 6. Tri local ----------
     * Le tri promet deux choses: rien n'est copie, et le lien vers le fichier
     * d'origine se retrouve apres un rechargement. La deuxieme est la seule
     * fragile - elle repose sur une signature - donc c'est elle qu'on teste.
     */
    console.log("Tri local");
    const {
        countAttached, fileSignature, forgetFile, hasSourceFile, isScoutFolder,
        isScoutPhoto, reattachFiles, rememberFile, SCOUT_QUOTA,
    } = scoutModule;

    check("la signature d'un fichier ne depend que de ce que le web donne", () => {
        const file = { name: "IMG_6330.HEIC", size: 2_481_920, lastModified: 1_756_000_000_000 };
        assert.equal(fileSignature(file), "IMG_6330.HEIC|2481920|1756000000000");
        /* Un selecteur de dossier renvoie un chemin relatif: seul le nom compte,
           sinon la meme photo ne se retrouverait plus apres un rechargement. */
        assert.equal(
            fileSignature({ ...file, name: "Telechargements/IMG_6330.HEIC" }),
            fileSignature(file),
        );
    });

    check("deux photos differentes n'ont pas la meme signature", () => {
        const a = { name: "a.jpg", size: 100, lastModified: 1 };
        assert.notEqual(fileSignature(a), fileSignature({ ...a, size: 101 }));
        assert.notEqual(fileSignature(a), fileSignature({ ...a, lastModified: 2 }));
        assert.notEqual(fileSignature(a), fileSignature({ ...a, name: "b.jpg" }));
    });

    check("une photo de tri se reconnait, un dossier de tri aussi", () => {
        assert.equal(isScoutPhoto({ scout: true }), true);
        assert.equal(isScoutPhoto({ blob: {} }), false);
        assert.equal(isScoutFolder({ kind: "scout" }), true);
        assert.equal(isScoutFolder({ kind: "library" }), false);
    });

    check("une poignee retenue rend la photo prete a importer", () => {
        const file = { name: "keep.jpg", size: 42, lastModified: 7 };
        const photo = { id: "ph-1", scout: true, source: { signature: fileSignature(file) } };
        assert.equal(hasSourceFile(photo), false);
        rememberFile(photo.id, file);
        assert.equal(hasSourceFile(photo), true);
        assert.equal(countAttached([photo, { id: "ph-2", source: { signature: "x|0|0" } }]), 1);
        forgetFile(photo.id);
        assert.equal(hasSourceFile(photo), false);
    });

    check("apres un rechargement, redonner le dossier relie les memes photos", () => {
        const files = [
            { name: "un.jpg", size: 10, lastModified: 1 },
            { name: "deux.jpg", size: 20, lastModified: 2 },
            { name: "trois.jpg", size: 30, lastModified: 3 },
        ];
        /* Les identifiants survivent (IndexedDB), les poignees non: c'est
           exactement l'etat d'un onglet rouvert. */
        const photos = files.map((file, index) => ({
            id: `ph-reload-${index}`,
            scout: true,
            source: { signature: fileSignature(file) },
        }));
        assert.equal(countAttached(photos), 0);

        /* Le dossier a bouge: une photo a disparu, une intruse s'est ajoutee. */
        const picked = [files[0], { name: "autre.jpg", size: 99, lastModified: 9 }, files[2]];
        const result = reattachFiles(photos, picked);
        assert.equal(result.matched, 2);
        assert.equal(result.missing, 1);
        assert.equal(countAttached(photos), 2);
        assert.equal(hasSourceFile(photos[1]), false);
        photos.forEach((photo) => forgetFile(photo.id));
    });

    check("le tri a son propre plafond, bien plus haut que la bibliotheque", () => {
        assert.ok(SCOUT_QUOTA.photos > quotaModule.LIBRARY_QUOTA.photos);
        /* Sept cents photos passent le tri sans toucher au quota du compte. */
        const files = Array.from({ length: 700 }, () => ({ size: 200 * 1024 }));
        const gate = quotaModule.checkImport({
            photoCount: 0, bytes: 0, files, quota: SCOUT_QUOTA, scope: "scout",
        });
        assert.equal(gate.accepted, 700);
        assert.equal(gate.rejected, 0);
    });

    check("depasser le plafond du tri le dit avec les mots du tri", () => {
        const files = Array.from({ length: 5 }, () => ({ size: 1 }));
        const gate = quotaModule.checkImport({
            photoCount: SCOUT_QUOTA.photos - 2, bytes: 0, files, quota: SCOUT_QUOTA, scope: "scout",
        });
        assert.equal(gate.accepted, 2);
        assert.match(gate.message, /tri/i);
        assert.doesNotMatch(gate.message, /biblioth/i);
    });


    /* ---------- 7. Cadence du carrousel ----------
     * La promesse est verifiable en une phrase: le glissement doit etre fini
     * avant l'appui suivant. Si ce n'est pas vrai, les appuis se marchent
     * dessus et le carrousel a l'air casse — c'est le defaut constate sur un
     * dossier de 264 photos.
     */
    console.log("Cadence du carrousel");
    const {
        slideDuration, SLIDE_MS, SLIDE_MIN, CADENCE_CALME, CADENCE_RAFALE,
    } = cadenceModule;

    check("le premier appui, sans passe, obtient le glissement complet", () => {
        assert.equal(slideDuration(Number.NaN), SLIDE_MS);
        assert.equal(slideDuration(Infinity), SLIDE_MS);
        assert.equal(slideDuration(5000), SLIDE_MS);
    });

    check("qui prend son temps garde le glissement complet", () => {
        assert.equal(slideDuration(CADENCE_CALME), SLIDE_MS);
        assert.equal(slideDuration(CADENCE_CALME + 200), SLIDE_MS);
    });

    check("une touche maintenue garde du mouvement, jamais un gel", () => {
        /* Une repetition clavier tombe vers 30-40 ms. Une bascule sans
           mouvement au milieu d'un defilement se lit comme un blocage: c'est
           le reproche exact fait a la premiere version. */
        assert.equal(slideDuration(33), SLIDE_MIN);
        assert.equal(slideDuration(CADENCE_RAFALE), SLIDE_MIN);
        assert.ok(SLIDE_MIN > 0);
    });

    check("aucun ecart ne produit d'animation nulle", () => {
        for (let gap = 0; gap <= 2000; gap += 1) {
            assert.ok(slideDuration(gap) >= SLIDE_MIN, `animation nulle a ${gap} ms`);
        }
        assert.equal(slideDuration(Number.NaN), SLIDE_MS);
    });

    check("en regime soutenu, le glissement finit avant l'appui suivant", () => {
        /* En rafale, c'est l'INTERRUPTION qui prend le relais: chaque appui
           relance le trajet depuis la position reelle du rail. Le regime calme
           en est exempt par choix. */
        for (let gap = SLIDE_MIN + 1; gap < CADENCE_CALME; gap += 1) {
            const duree = slideDuration(gap);
            assert.ok(
                duree <= gap,
                `a ${gap} ms d'ecart le glissement dure ${duree} ms : il deborde sur l'appui suivant`,
            );
        }
    });

    check("entre les deux, la duree ne fait que monter avec l'ecart", () => {
        let precedent = -1;
        for (let gap = 0; gap <= CADENCE_CALME + 50; gap += 5) {
            const duree = slideDuration(gap);
            assert.ok(duree >= precedent, `duree en baisse a ${gap} ms`);
            precedent = duree;
        }
    });

    check("la duree reste dans ses bornes", () => {
        for (let gap = 0; gap <= 2000; gap += 1) {
            const duree = slideDuration(gap);
            assert.ok(duree >= SLIDE_MIN && duree <= SLIDE_MS, `duree hors bornes ${duree} ms a ${gap} ms`);
        }
    });

} finally {
    await rm(tempDir, { recursive: true, force: true });
}

if (failures) {
    console.error(`\n${failures} verification(s) en echec.`);
    process.exit(1);
}
console.log("\nBibliotheque VibeOS: toutes les verifications passent.");
