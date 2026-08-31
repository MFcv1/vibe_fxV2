/*
 * Organisation de la bibliotheque Vision.
 *
 * Les nouveaux imports portent `collection: { id, label }`. Les anciens
 * Cinema II n'avaient pas encore cette metadonnee : on les reconnait ici pour
 * ne jamais disperser CN11-CN18 dans la bibliotheque pendant la migration.
 */

export const PRESET_COLLECTION_ALL = 'all';

const BUILTIN_COLLECTIONS = {
    cinema: { id: 'cinema', label: 'Cinéma', order: 5 },
    'cinema-ii': { id: 'cinema-ii', label: 'Cinéma II', order: 10 },
    vibefx: { id: 'vibefx', label: 'VibeFX', order: 20 },
    imports: { id: 'imports', label: 'Imports', order: 30 },
};

const normaliser = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function resolvePresetCollection(preset = {}) {
    const declared = preset.collection;
    if (declared?.id && declared?.label) {
        const builtin = BUILTIN_COLLECTIONS[String(declared.id)];
        return {
            id: String(declared.id),
            label: String(declared.label),
            order: Number.isFinite(declared.order) ? declared.order : (builtin?.order ?? 15),
        };
    }

    if (/^cn1[1-8]$/i.test(String(preset.id || ''))) {
        return BUILTIN_COLLECTIONS['cinema-ii'];
    }

    /* Une table importee expose getLut, les creations VibeFX une transform. */
    if (typeof preset.getLut === 'function') return BUILTIN_COLLECTIONS.imports;
    return BUILTIN_COLLECTIONS.vibefx;
}

export function buildPresetCollections(presets = []) {
    const byId = new Map();
    for (const preset of presets) {
        const collection = resolvePresetCollection(preset);
        const current = byId.get(collection.id);
        if (current) current.count += 1;
        else byId.set(collection.id, { ...collection, count: 1 });
    }

    return [...byId.values()].sort((a, b) => (
        (a.order ?? 50) - (b.order ?? 50)
        || a.label.localeCompare(b.label, 'fr')
    ));
}

export function filterAndGroupPresets(presets = [], {
    collectionId = PRESET_COLLECTION_ALL,
    query = '',
    favoriteIds = null,
    favoritesOnly = false,
} = {}) {
    const needle = normaliser(query);
    const favoriteSet = favoriteIds instanceof Set ? favoriteIds : new Set(favoriteIds || []);
    const groups = new Map();

    for (const preset of presets) {
        const collection = resolvePresetCollection(preset);
        if (collectionId !== PRESET_COLLECTION_ALL && collection.id !== collectionId) continue;
        if (favoritesOnly && !favoriteSet.has(preset.id)) continue;

        if (needle) {
            const haystack = normaliser([
                preset.label,
                preset.hint,
                preset.description,
                preset.bestFor,
                collection.label,
            ].join(' '));
            if (!haystack.includes(needle)) continue;
        }

        if (!groups.has(collection.id)) groups.set(collection.id, { collection, presets: [] });
        groups.get(collection.id).presets.push(preset);
    }

    return [...groups.values()].sort((a, b) => (
        (a.collection.order ?? 50) - (b.collection.order ?? 50)
        || a.collection.label.localeCompare(b.collection.label, 'fr')
    ));
}
