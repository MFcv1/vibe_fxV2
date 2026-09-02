"use client";

/*
 * Les navigateurs n'ont pas tous de decodeur HEIC. Même quand Safari sait
 * afficher le fichier, le conserver tel quel rendrait la photo illisible plus
 * tard dans Chrome ou sur un autre appareil. Les HEIC/HEIF sont donc convertis
 * une fois, localement, en JPEG portable avant d'entrer dans la bibliothèque.
 *
 * Le decodeur est charge dynamiquement : son moteur libheif ne gonfle pas le
 * JavaScript initial de la bibliothèque pour les imports JPEG/PNG ordinaires.
 */

const HEIC_EXTENSION = /\.(heic|heif|heics|heifs)$/i;
const HEIC_MIME = /^image\/(heic|heif|heic-sequence|heif-sequence)$/i;
const JPEG_QUALITY = 0.94;

export function isHeicFile(file) {
    return Boolean(file && (
        HEIC_EXTENSION.test(String(file.name || ''))
        || HEIC_MIME.test(String(file.type || ''))
    ));
}

export function jpegNameFor(name = 'photo.heic') {
    const clean = String(name || 'photo.heic');
    if (HEIC_EXTENSION.test(clean)) return clean.replace(HEIC_EXTENSION, '.jpg');
    const dot = clean.lastIndexOf('.');
    return `${dot > 0 ? clean.slice(0, dot) : clean}.jpg`;
}

export async function convertHeicToJpeg(file) {
    if (!isHeicFile(file)) return file;

    /* La variante CSP évite `unsafe-eval`. Le module et son worker ne sont
       téléchargés qu'au premier HEIC de la session. */
    const { heicTo } = await import('heic-to/csp');
    const jpeg = await heicTo({
        blob: file,
        type: 'image/jpeg',
        quality: JPEG_QUALITY,
    });
    if (!(jpeg instanceof Blob) || !jpeg.size) {
        throw new Error('La conversion HEIC n’a produit aucune image.');
    }

    return new File([jpeg], jpegNameFor(file.name), {
        type: 'image/jpeg',
        lastModified: file.lastModified || Date.now(),
    });
}
