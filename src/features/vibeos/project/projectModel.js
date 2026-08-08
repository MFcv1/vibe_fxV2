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
        images: [],
        texts: [],
        assets: [],
        geometry: { padding: 0, gap: 12, radius: 0, customLayoutGap: 12 },
        background: {
            color: '#000000',
            blur: false,
            textures: [],
            mesh: null,
            lumen: null,
            smoothBlur: null,
        },
        vision: { profileId: null, intensity: 80, filters: null },
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
        vision: { ...base.vision, ...(raw.vision || {}) },
        studio: { ...base.studio, ...(raw.studio || {}) },
        images: Array.isArray(raw.images) ? raw.images : [],
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
