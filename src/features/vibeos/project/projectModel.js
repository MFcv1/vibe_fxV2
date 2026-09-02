/*
 * Modele du projet VibeOS - la forme validee par le plan §4.3.
 * Un projet unique circule entre Layout, Studio et Vision. Les pages lisent et
 * ecrivent ce modele; les moteurs existants (vibefx-layout / vibefx-studio)
 * restent la source de verite du rendu.
 */

export const PROJECT_VERSION = 1;

export function createProjectId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `vo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyProject(overrides = {}) {
    const now = Date.now();
    return {
        version: PROJECT_VERSION,
        id: createProjectId(),
        title: 'Sans titre',
        createdAt: now,
        updatedAt: now,
        /* Id du FORMATS de vibefx-layout (portrait 4:5 par defaut, comme l'existant). */
        format: 'insta-port',
        /* Id TEMPLATES, ou objet { id: 'custom', presetId, zones } pour le personnalise. */
        template: 'minimal',
        overlayMode: 'landscape',
        /* Images de la composition: [{ id, name, slotId, blob }] - des Blobs,
           jamais des dataURLs (plan §7). */
        images: [],
        /* Reglages par zone: { [slotId]: { imageId, zoom, x, y, border, blur } }. */
        slots: {},
        texts: [],
        assets: [],
        geometry: { padding: 0, gap: 12, radius: 0, customLayoutGap: 12 },
        background: {
            color: '#000000',
            blur: false,
            grain: 15,
            textures: [],
            activeTextureId: null,
            textureOpacity: 60,
            mesh: null,
            lumen: null,
            smoothBlur: null,
        },
        /* Rendu de la composition Layout, publie par l'ecran Mise en page:
           { blob, width, height, updatedAt, visionRevision }. Le marqueur dit
           que les pixels Vision sont deja dans la composition. */
        composition: null,
        vision: {
            presetId: null,
            intensity: 80,
            filters: null,
            /* Revision des reglages photo. Layout la copie dans sa composition
               pour que Studio/export sachent que le rendu Vision y est deja. */
            updatedAt: null,
        },
        studio: { presetRef: null, filters: null, variants: [] },
        soundtrackTrackId: null,
        /* Vignette 256px (dataURL) pour l'accueil - ecrite par les pages d'edition. */
        thumbnail: null,
        ...overrides,
    };
}

/*
 * Normalisation defensive: tout projet relu depuis IndexedDB repasse par ici,
 * pour que l'ajout de champs dans les phases suivantes ne casse jamais un
 * projet enregistre avant.
 */
export function normalizeProject(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const base = createEmptyProject();
    return {
        ...base,
        ...raw,
        version: PROJECT_VERSION,
        geometry: { ...base.geometry, ...(raw.geometry || {}) },
        background: { ...base.background, ...(raw.background || {}) },
        composition: raw.composition?.blob ? raw.composition : null,
        vision: {
            presetId: raw.vision?.presetId ?? base.vision.presetId,
            intensity: raw.vision?.intensity ?? base.vision.intensity,
            filters: raw.vision?.filters ?? base.vision.filters,
            updatedAt: raw.vision?.updatedAt ?? base.vision.updatedAt,
        },
        studio: { ...base.studio, ...(raw.studio || {}) },
        images: Array.isArray(raw.images) ? raw.images : [],
        slots: raw.slots && typeof raw.slots === 'object' ? raw.slots : {},
        texts: Array.isArray(raw.texts) ? raw.texts : [],
        assets: Array.isArray(raw.assets) ? raw.assets : [],
    };
}

/* Metadonnees legeres pour la liste des recents (jamais le projet complet). */
export function projectToRecentMeta(project) {
    return {
        id: project.id,
        title: project.title,
        format: project.format,
        updatedAt: project.updatedAt,
        thumbnail: project.thumbnail || null,
    };
}
