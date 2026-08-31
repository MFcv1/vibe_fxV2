"use client";

/*
 * Reconnaissance de l'appareil, pour l'ecran d'import.
 *
 * Le web n'ouvre PAS la galerie d'un telephone ni le dossier Telechargements
 * d'un ordinateur: il n'existe aucune API pour ca, et c'est voulu - une page
 * ne doit pas pouvoir lire le disque. Ce qu'on peut faire, c'est demander au
 * systeme le bon selecteur:
 *
 * - `accept="image/*"` sur iOS et Android ouvre directement le selecteur de
 *   PHOTOS du systeme (Photothèque sur iPhone, Google Photos / Galerie sur
 *   Android), pas l'explorateur de fichiers;
 * - `capture="environment"` ouvre l'appareil photo;
 * - sans `accept` restrictif, on tombe sur l'explorateur de fichiers (Fichiers,
 *   Finder, Explorateur), la ou vivent Telechargements et Bureau;
 * - `webkitdirectory` demande un DOSSIER entier - Chrome, Edge, Safari 11.1+ et
 *   Firefox 50+ sur ordinateur. Inutile sur telephone, ou il est ignore ou
 *   renvoie un selecteur vide: on ne le propose donc pas la.
 *
 * D'ou cette detection: elle ne sert pas a changer le comportement, elle sert a
 * NOMMER les boutons avec les mots du systeme de l'utilisateur.
 */

export const PLATFORMS = {
    ios: { id: 'ios', label: 'iPhone', files: 'Fichiers', gallery: 'Photothèque' },
    android: { id: 'android', label: 'Android', files: 'Fichiers', gallery: 'Galerie' },
    macos: { id: 'macos', label: 'Mac', files: 'Finder', gallery: 'Photos' },
    windows: { id: 'windows', label: 'Windows', files: 'Explorateur', gallery: 'Images' },
    linux: { id: 'linux', label: 'Linux', files: 'Fichiers', gallery: 'Images' },
    unknown: { id: 'unknown', label: 'cet appareil', files: 'Fichiers', gallery: 'Photos' },
};

/*
 * `navigator.userAgentData` d'abord (Chromium), `userAgent` ensuite. L'iPad
 * moderne se declare "Macintosh": on le rattrape par le tactile, sinon un iPad
 * se verrait proposer l'import de dossier, qui n'existe pas chez lui.
 */
export function detectPlatform(nav = typeof navigator === 'undefined' ? null : navigator) {
    if (!nav) return PLATFORMS.unknown;
    const hint = String(nav.userAgentData?.platform || '').toLowerCase();
    const agent = String(nav.userAgent || '').toLowerCase();
    const touchPoints = Number(nav.maxTouchPoints || 0);

    if (/iphone|ipod/.test(agent)) return PLATFORMS.ios;
    if (/ipad/.test(agent)) return PLATFORMS.ios;
    if (/android/.test(agent) || hint === 'android') return PLATFORMS.android;
    if (/macintosh|mac os x/.test(agent) || hint === 'macos') {
        /* iPadOS en mode "site pour ordinateur". */
        return touchPoints > 1 ? PLATFORMS.ios : PLATFORMS.macos;
    }
    if (/windows/.test(agent) || hint === 'windows') return PLATFORMS.windows;
    if (/linux|x11|cros/.test(agent) || hint === 'linux' || hint === 'chrome os') return PLATFORMS.linux;
    return PLATFORMS.unknown;
}

export function isMobilePlatform(platform) {
    return platform?.id === 'ios' || platform?.id === 'android';
}

/*
 * Les sources d'import proposees, dans l'ordre d'evidence pour la plateforme.
 * Chaque source decrit exactement les attributs a poser sur l'input fichier;
 * l'ecran n'a plus qu'a les appliquer et a ouvrir le selecteur.
 */
export function importSources(platform) {
    const mobile = isMobilePlatform(platform);
    if (mobile) {
        return [
            {
                id: 'gallery',
                title: platform.gallery,
                hint: 'Tes photos, telles que le téléphone les range',
                icon: 'images',
                input: { accept: 'image/*,.heic,.heif', multiple: true },
            },
            {
                id: 'camera',
                title: 'Appareil photo',
                hint: 'Prendre une photo maintenant',
                icon: 'camera',
                input: { accept: 'image/*', multiple: false, capture: 'environment' },
            },
            {
                id: 'files',
                title: platform.files,
                hint: 'Téléchargements, iCloud, Drive…',
                icon: 'folder',
                input: { accept: 'image/*,.heic,.heif', multiple: true },
            },
        ];
    }
    return [
        {
            id: 'files',
            title: 'Choisir des photos',
            hint: `Depuis ${platform.files} : Téléchargements, Bureau, Images…`,
            icon: 'images',
            input: { accept: 'image/*,.heic,.heif', multiple: true },
        },
        {
            id: 'directory',
            title: 'Choisir un dossier',
            hint: 'Tout le dossier d’un coup, son nom devient celui de l’album',
            icon: 'folder',
            input: { accept: '', multiple: true, webkitdirectory: true },
        },
    ];
}

/* Le selecteur de dossier n'existe que sur ordinateur. */
export function supportsDirectoryPicker(platform, doc = typeof document === 'undefined' ? null : document) {
    if (isMobilePlatform(platform)) return false;
    if (!doc) return true;
    return 'webkitdirectory' in doc.createElement('input');
}
