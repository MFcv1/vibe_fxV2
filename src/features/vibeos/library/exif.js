"use client";

/*
 * Lecture EXIF minimale, sans dependance.
 *
 * Pourquoi maison plutot qu'une librairie: la bibliotheque n'a besoin que de
 * huit champs (appareil, objectif, date de prise de vue, ISO, ouverture, vitesse,
 * focale, orientation) et on ne lit que les premiers kilo-octets du fichier.
 * Ajouter un paquet npm pour ca ferait grossir le bundle client pour rien.
 *
 * Formats: JPEG (segment APP1 "Exif\0\0") et TIFF. HEIC/PNG/WebP retournent un
 * enregistrement vide - l'appelant retombe alors sur la date du fichier, et la
 * photo reste parfaitement utilisable.
 */

/* 128 Ko: l'APP1 d'une photo de telephone tient tres largement dedans, y compris
   avec sa vignette EXIF. Lire le fichier entier (8 Mo) serait du gaspillage. */
const HEAD_BYTES = 128 * 1024;

const TAGS_IFD0 = {
    0x010f: 'make',
    0x0110: 'model',
    0x0112: 'orientation',
    0x0132: 'dateTime',
    0x8769: 'exifOffset',
};

const TAGS_EXIF = {
    0x829a: 'exposureTime',
    0x829d: 'fNumber',
    0x8827: 'iso',
    0x9003: 'dateTimeOriginal',
    0x920a: 'focalLength',
    0xa002: 'pixelWidth',
    0xa003: 'pixelHeight',
    0xa434: 'lensModel',
};

/* Taille en octets d'une valeur, par type EXIF. */
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readValue(view, offset, type, count, little) {
    switch (type) {
        case 1:
        case 7:
            return view.getUint8(offset);
        case 2: {
            let out = '';
            for (let i = 0; i < count; i += 1) {
                const code = view.getUint8(offset + i);
                if (code === 0) break;
                out += String.fromCharCode(code);
            }
            return out.trim();
        }
        case 3:
            return view.getUint16(offset, little);
        case 4:
            return view.getUint32(offset, little);
        case 9:
            return view.getInt32(offset, little);
        case 5:
        case 10: {
            const numerator = type === 5
                ? view.getUint32(offset, little)
                : view.getInt32(offset, little);
            const denominator = type === 5
                ? view.getUint32(offset + 4, little)
                : view.getInt32(offset + 4, little);
            if (!denominator) return null;
            return numerator / denominator;
        }
        default:
            return null;
    }
}

/* Lit une IFD et remplit `out` avec les tags connus de `dictionary`. */
function readIfd(view, tiffStart, ifdOffset, little, dictionary, out) {
    const base = tiffStart + ifdOffset;
    if (base + 2 > view.byteLength) return;
    const entries = view.getUint16(base, little);
    for (let i = 0; i < entries; i += 1) {
        const entry = base + 2 + i * 12;
        if (entry + 12 > view.byteLength) return;
        const tag = view.getUint16(entry, little);
        const name = dictionary[tag];
        if (!name) continue;
        const type = view.getUint16(entry + 2, little);
        const count = view.getUint32(entry + 4, little);
        const size = (TYPE_SIZE[type] || 0) * count;
        if (!size) continue;
        /* Au-dela de 4 octets, l'entree contient un pointeur, pas la valeur. */
        const valueOffset = size <= 4
            ? entry + 8
            : tiffStart + view.getUint32(entry + 8, little);
        if (valueOffset < 0 || valueOffset + Math.min(size, 8) > view.byteLength) continue;
        const value = readValue(view, valueOffset, type, count, little);
        if (value !== null && value !== '') out[name] = value;
    }
}

/* Position du bloc TIFF dans le fichier, ou -1. */
function findTiffStart(view) {
    if (view.byteLength < 4) return -1;
    const first = view.getUint16(0, false);
    /* TIFF brut (DNG, .tif): le fichier commence par l'entete d'octet. */
    if (first === 0x4949 || first === 0x4d4d) return 0;
    /* JPEG: on parcourt les segments jusqu'a APP1. */
    if (first !== 0xffd8) return -1;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
        if (view.getUint8(offset) !== 0xff) return -1;
        const marker = view.getUint8(offset + 1);
        /* Debut des donnees image: plus aucun segment de metadonnees apres. */
        if (marker === 0xda) return -1;
        const length = view.getUint16(offset + 2, false);
        if (marker === 0xe1 && offset + 10 <= view.byteLength) {
            const tag = String.fromCharCode(
                view.getUint8(offset + 4), view.getUint8(offset + 5),
                view.getUint8(offset + 6), view.getUint8(offset + 7),
            );
            if (tag === 'Exif') return offset + 10;
        }
        offset += 2 + length;
    }
    return -1;
}

function formatExposure(seconds) {
    if (!seconds || seconds <= 0) return null;
    if (seconds >= 1) return `${Number(seconds.toFixed(1))}s`;
    return `1/${Math.round(1 / seconds)}s`;
}

/* "SM-S911B" + "samsung" -> "Samsung SM-S911B", sans repeter la marque. */
function buildDeviceLabel(make, model) {
    const cleanMake = (make || '').replace(/corporation|corp\.?|company/gi, '').trim();
    const cleanModel = (model || '').trim();
    if (!cleanMake && !cleanModel) return null;
    if (!cleanModel) return cleanMake;
    if (!cleanMake) return cleanModel;
    if (cleanModel.toLowerCase().startsWith(cleanMake.toLowerCase())) return cleanModel;
    const prettyMake = cleanMake.charAt(0).toUpperCase() + cleanMake.slice(1);
    return `${prettyMake} ${cleanModel}`;
}

/* "2026:06:15 14:35:49" -> timestamp, ou null. */
function parseExifDate(value) {
    if (typeof value !== 'string') return null;
    const match = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;
    const [, y, mo, d, h, mi, s] = match.map(Number);
    const time = new Date(y, mo - 1, d, h, mi, s).getTime();
    return Number.isFinite(time) ? time : null;
}

export const EMPTY_EXIF = {
    device: null,
    make: null,
    model: null,
    lens: null,
    iso: null,
    aperture: null,
    shutter: null,
    focal: null,
    orientation: 1,
    takenAt: null,
};

/*
 * Lit l'EXIF d'un File/Blob. Ne rejette jamais: un fichier illisible rend
 * `EMPTY_EXIF`, la photo entre quand meme dans la bibliotheque.
 */
export async function readExif(file) {
    try {
        const head = file.slice(0, Math.min(HEAD_BYTES, file.size));
        const buffer = await head.arrayBuffer();
        const view = new DataView(buffer);
        const tiffStart = findTiffStart(view);
        if (tiffStart < 0) return { ...EMPTY_EXIF };

        const endian = view.getUint16(tiffStart, false);
        const little = endian === 0x4949;
        if (!little && endian !== 0x4d4d) return { ...EMPTY_EXIF };

        const raw = {};
        const ifd0Offset = view.getUint32(tiffStart + 4, little);
        readIfd(view, tiffStart, ifd0Offset, little, TAGS_IFD0, raw);
        if (raw.exifOffset) {
            readIfd(view, tiffStart, raw.exifOffset, little, TAGS_EXIF, raw);
        }

        return {
            device: buildDeviceLabel(raw.make, raw.model),
            make: raw.make || null,
            model: raw.model || null,
            lens: raw.lensModel || null,
            iso: raw.iso || null,
            aperture: raw.fNumber ? `f/${Number(raw.fNumber.toFixed(1))}` : null,
            shutter: formatExposure(raw.exposureTime),
            focal: raw.focalLength ? `${Math.round(raw.focalLength)}mm` : null,
            orientation: raw.orientation || 1,
            takenAt: parseExifDate(raw.dateTimeOriginal || raw.dateTime),
        };
    } catch {
        return { ...EMPTY_EXIF };
    }
}

/* Ligne de metadonnees affichable sous une photo, sans les champs manquants. */
export function describeExif(exif) {
    if (!exif) return [];
    return [exif.focal, exif.aperture, exif.shutter, exif.iso ? `ISO ${exif.iso}` : null]
        .filter(Boolean);
}
