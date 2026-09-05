"use client";

import { createPhotoId } from './libraryDb';
import { EMPTY_EXIF, readExif } from './exif';
import { convertHeicToJpeg, isHeicFile } from './heicImport';
import { fileSignature } from './libraryScout';

/*
 * Entree de la bibliotheque: un fichier -> un enregistrement complet
 * (original + vignette + EXIF).
 *
 * La vignette est generee une fois a l'import et stockee. C'est ce qui permet a
 * la grille d'afficher deux cents photos sans decoder deux cents JPEG de 8 Mo:
 * on ne touche l'original qu'a l'ouverture en plein ecran ou a l'edition.
 */

/*
 * Taille de la vignette.
 *
 * 720 px etait trop court: sur un ecran Retina, une tuile de densite 4 fait
 * ~370 px CSS, donc 740 px reels, et la vignette etait etiree. La grille avait
 * l'air floue alors que la photo, elle, etait nette. 1600 px couvre toutes les
 * densites jusqu'a 2 colonnes sur un ecran Retina, pour ~150 a 250 Ko par photo
 * dans IndexedDB.
 */
export const PREVIEW_MAX = 1600;
const THUMB_QUALITY = 0.86;

export const ACCEPTED_TYPES = 'image/*,.heic,.heif,.heics,.heifs';

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

async function makeThumbnail(source, width, height, maxSide = PREVIEW_MAX) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
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
 * Refabrique la vignette d'une photo deja stockee.
 *
 * Sert aux photos importees quand la vignette plafonnait a 720 px: plutot
 * qu'une migration qui redecoderait toute la bibliotheque au demarrage, on ne
 * refait la vignette QUE des photos dont une tuile a reellement besoin (voir
 * `ensurePreview` dans `useLibrary.js`). Renvoie `null` si le fichier ne se
 * decode pas - la vignette existante reste alors en place.
 */
export async function makePreview(blob, maxSide = PREVIEW_MAX) {
    let bitmap = null;
    try {
        bitmap = await decode(blob);
    } catch {
        return null;
    }
    const width = bitmap.width || bitmap.naturalWidth;
    const height = bitmap.height || bitmap.naturalHeight;
    if (!width || !height) return null;
    const side = Math.min(maxSide, Math.max(width, height));
    const thumbBlob = await makeThumbnail(bitmap, width, height, side);
    if (typeof bitmap.close === 'function') bitmap.close();
    if (!thumbBlob) return null;
    const scale = Math.min(1, side / Math.max(width, height));
    return {
        thumbBlob,
        thumbWidth: Math.max(1, Math.round(width * scale)),
        thumbHeight: Math.max(1, Math.round(height * scale)),
    };
}

/*
 * Rend un enregistrement pret a stocker, ou `null` si le fichier n'est pas une
 * image decodable par ce navigateur (cas typique: HEIC hors Safari).
 */
export async function buildPhotoRecord(file, { folderId = null } = {}) {
    const sourceFile = file;
    let portableFile = file;
    if (isHeicFile(file)) {
        try {
            portableFile = await convertHeicToJpeg(file);
        } catch {
            return null;
        }
    }

    let bitmap = null;
    try {
        bitmap = await decode(portableFile);
    } catch {
        return null;
    }

    const width = bitmap.width || bitmap.naturalWidth;
    const height = bitmap.height || bitmap.naturalHeight;
    if (!width || !height) return null;

    const [exif, thumbBlob] = await Promise.all([
        /* Le fichier source porte les metadonnees de prise de vue. Le JPEG
           converti sert aux pixels, pas a remplacer cette source de verite. */
        readExif(sourceFile),
        makeThumbnail(bitmap, width, height),
    ]);
    if (typeof bitmap.close === 'function') bitmap.close();

    const now = Date.now();
    return {
        id: createPhotoId(),
        /* Le selecteur de dossier renvoie un chemin relatif ("ete/img.jpg"):
           on garde le nom du fichier, le dossier est porte par `folderId`. */
        name: (portableFile.name || 'photo').split('/').pop(),
        folderId,
        blob: portableFile,
        thumbBlob: thumbBlob || portableFile,
        bytes: portableFile.size || 0,
        type: portableFile.type || '',
        width,
        height,
        ratio: width / height,
        /* Taille reelle de la vignette: sans elle, on ne peut pas savoir si une
           tuile a besoin de plus de pixels que ce qui est stocke. */
        thumbWidth: Math.max(1, Math.round(width * Math.min(1, PREVIEW_MAX / Math.max(width, height)))),
        thumbHeight: Math.max(1, Math.round(height * Math.min(1, PREVIEW_MAX / Math.max(width, height)))),
        addedAt: now,
        /* Date de prise de vue si l'EXIF la donne, sinon date du fichier: la
           frise chronologique reste juste meme sans metadonnees. */
        takenAt: exif.takenAt || sourceFile.lastModified || now,
        exif: exif || { ...EMPTY_EXIF },
        /* Rempli quand la photo revient de Vision avec un preset applique. */
        preset: null,
        favorite: false,
        /* Etat de sauvegarde dans le compte utilisateur. `local` tant que rien
           n'est parti; voir `libraryCloud.js`. */
        cloud: { state: 'local' },
        /* Trace utile pour expliquer le nom .jpg sans conserver le HEIC, qui
           serait inutilisable dans certains navigateurs. */
        convertedFrom: isHeicFile(sourceFile) ? {
            name: sourceFile.name || null,
            type: sourceFile.type || 'image/heic',
            bytes: sourceFile.size || 0,
        } : null,
    };
}

/* Nom d'appareil affichable dans la grille, meme sans EXIF. */
export function deviceLabel(photo) {
    return photo?.exif?.device || 'Appareil inconnu';
}

/*
 * Enregistrement LEGER, pour le mode tri (voir `libraryScout.js`).
 *
 * Deux differences avec `buildPhotoRecord`, et elles font tout:
 *
 * 1. AUCUN original n'est conserve. La fiche ne porte que l'apercu et de quoi
 *    retrouver le fichier sur le disque. C'est ce qui fait tenir sept cents
 *    photos dans ~150 Mo au lieu de plusieurs Go.
 * 2. LE HEIC N'EST PAS CONVERTI si le navigateur sait deja le decoder. Safari
 *    sur Mac affiche le HEIC nativement: lui imposer libheif ajouterait une
 *    seconde par photo - une vingtaine de minutes sur un dossier entier - pour
 *    un JPEG qu'on jetterait aussitot. La conversion reste le filet de secours
 *    des navigateurs qui ne savent pas (Chrome, Firefox), et elle a lieu pour
 *    de bon au moment ou la photo est gardee.
 */
export async function buildScoutRecord(file, { folderId = null, addedAt = null } = {}) {
    let bitmap = null;
    let decodedFrom = 'native';
    try {
        bitmap = await decode(file);
    } catch {
        if (!isHeicFile(file)) return null;
        try {
            bitmap = await decode(await convertHeicToJpeg(file));
            decodedFrom = 'converted';
        } catch {
            return null;
        }
    }

    const width = bitmap.width || bitmap.naturalWidth;
    const height = bitmap.height || bitmap.naturalHeight;
    if (!width || !height) return null;

    const [exif, thumbBlob] = await Promise.all([
        readExif(file),
        makeThumbnail(bitmap, width, height),
    ]);
    if (typeof bitmap.close === 'function') bitmap.close();
    if (!thumbBlob) return null;

    const now = addedAt || Date.now();
    const scale = Math.min(1, PREVIEW_MAX / Math.max(width, height));
    return {
        id: createPhotoId(),
        name: (file.name || 'photo').split('/').pop(),
        folderId,
        /* Le coeur du mode tri: pas d'original en base. */
        blob: null,
        thumbBlob,
        /* Le poids REELLEMENT occupe par la fiche, pas celui du fichier source:
           c'est l'apercu qu'on stocke, c'est lui qu'on compte. Le poids du
           fichier d'origine reste lisible dans `source.size`. */
        bytes: thumbBlob.size || 0,
        type: file.type || '',
        width,
        height,
        ratio: width / height,
        thumbWidth: Math.max(1, Math.round(width * scale)),
        thumbHeight: Math.max(1, Math.round(height * scale)),
        addedAt: now,
        takenAt: exif.takenAt || file.lastModified || now,
        exif: exif || { ...EMPTY_EXIF },
        preset: null,
        favorite: false,
        /* Une photo de tri ne part jamais dans le compte: elle n'a pas
           d'original a envoyer, et son dossier est marque local. */
        cloud: { state: 'local' },
        convertedFrom: null,
        scout: true,
        /* De quoi retrouver le fichier d'origine sur le disque apres un
           rechargement (voir `reattachFiles`). */
        source: {
            signature: fileSignature(file),
            name: (file.name || 'photo').split('/').pop(),
            size: file.size || 0,
            lastModified: file.lastModified || 0,
            decodedFrom,
        },
    };
}
