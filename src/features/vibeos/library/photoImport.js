"use client";

import { createPhotoId } from './libraryDb';
import { EMPTY_EXIF, readExif } from './exif';

/*
 * Entree de la bibliotheque: un fichier -> un enregistrement complet
 * (original + vignette + EXIF).
 *
 * La vignette est generee une fois a l'import et stockee. C'est ce qui permet a
 * la grille d'afficher deux cents photos sans decoder deux cents JPEG de 8 Mo:
 * on ne touche l'original qu'a l'ouverture en plein ecran ou a l'edition.
 */

const THUMB_MAX = 720;
const THUMB_QUALITY = 0.82;

export const ACCEPTED_TYPES = 'image/*,.heic,.heif';

/* Decodage oriente: `from-image` applique la rotation EXIF, donc les photos
   prises a la verticale ne se retrouvent pas couchees dans la grille. */
async function decode(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
            /* Safari refuse certains HEIC ici: on retombe sur <img>. */
        }
    }
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image illisible'));
        };
        img.src = url;
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
    });
}

async function makeThumbnail(source, width, height) {
    const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    return canvasToBlob(canvas, 'image/webp', THUMB_QUALITY);
}

/*
 * Rend un enregistrement pret a stocker, ou `null` si le fichier n'est pas une
 * image decodable par ce navigateur (cas typique: HEIC hors Safari).
 */
export async function buildPhotoRecord(file) {
    let bitmap = null;
    try {
        bitmap = await decode(file);
    } catch {
        return null;
    }

    const width = bitmap.width || bitmap.naturalWidth;
    const height = bitmap.height || bitmap.naturalHeight;
    if (!width || !height) return null;

    const [exif, thumbBlob] = await Promise.all([
        readExif(file),
        makeThumbnail(bitmap, width, height),
    ]);
    if (typeof bitmap.close === 'function') bitmap.close();

    const now = Date.now();
    return {
        id: createPhotoId(),
        name: file.name || 'photo',
        blob: file,
        thumbBlob: thumbBlob || file,
        bytes: file.size || 0,
        type: file.type || '',
        width,
        height,
        ratio: width / height,
        addedAt: now,
        /* Date de prise de vue si l'EXIF la donne, sinon date du fichier: la
           frise chronologique reste juste meme sans metadonnees. */
        takenAt: exif.takenAt || file.lastModified || now,
        exif: exif || { ...EMPTY_EXIF },
        /* Rempli quand la photo revient de Vision avec un preset applique. */
        preset: null,
        favorite: false,
    };
}

/* Nom d'appareil affichable dans la grille, meme sans EXIF. */
export function deviceLabel(photo) {
    return photo?.exif?.device || 'Appareil inconnu';
}
