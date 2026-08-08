/*
 * Flux d'import Soundtrack — logique EXTRAITE telle quelle de
 * `components/AiMusicImportAssistant.jsx` et `components/PixabayImportAssistant.jsx`.
 *
 * Pourquoi: l'ecran Soundtrack VibeOS (`src/features/vibeos/soundtrack/`) a
 * besoin des memes imports (Aitra Free par theme, Pixabay par theme, fichier
 * telecharge, URL directe) avec une autre interface. La regle du chantier est
 * d'extraire plutot que de dupliquer — les deux UI appellent donc exactement le
 * meme code, et l'ancien /studio garde un comportement identique au caractere
 * pres (memes metadonnees, memes messages d'erreur, memes garde-fous).
 *
 * Ce module ne contient AUCUN state React et ne connait aucune UI: il recoit
 * les bibliotheques (locale / projet) et rend les pistes importees, ou leve une
 * Error dont le message est affichable tel quel.
 */

import {
    AITRA_FREE_TRACKS_URL,
    PIXABAY_CONTENT_LICENSE_URL,
} from '../data/soundtrackDefaults';

const PIXABAY_CLIENT_TIMEOUT_BASE_MS = 70000;
const PIXABAY_CLIENT_TIMEOUT_PER_EXTRA_TRACK_MS = 12000;
const PIXABAY_CLIENT_TIMEOUT_MAX_MS = 125000;

/* Compteur d'import monotone: sert uniquement a rendre uniques les ids des
   pistes d'un meme lot Aitra (ancien `importCounterRef` du composant). */
let aiImportCounter = 0;

export const cleanHttpsUrl = (value = '') => {
    const trimmed = String(value || '').trim();
    try {
        const url = new URL(trimmed);
        return url.protocol === 'https:' ? url.toString() : '';
    } catch {
        return '';
    }
};

export const buildManualTrackId = (providerId = 'ai', audioUrl = '') => (
    `${providerId}-${String(audioUrl || 'manual-audio')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72) || 'manual-audio'}`
);

export const extractAitraTrackId = (value = '') => {
    const trimmed = String(value || '').trim();
    if (/^\d{1,8}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^https:\/\/aitrafree\.com\/(?:en\/|ja\/)?tracks\/(\d+)/i);
    return match?.[1] || '';
};

export const normalizeImportUrlDraft = (providerId, value = '') => {
    const cleaned = cleanHttpsUrl(value);
    if (cleaned) return cleaned;
    const aitraTrackId = providerId === 'aitra-free' ? extractAitraTrackId(value) : '';
    return aitraTrackId ? `https://aitrafree.com/en/tracks/${aitraTrackId}` : '';
};

export const buildAiImportMetadata = ({ file, provider, selectedTag, proofUrl, licenseUrl, commercialUse = true }) => ({
    title: file?.name?.replace(/\.[a-z0-9]+$/i, '') || '',
    provider: provider.id,
    sourceProvider: provider.id,
    sourceName: provider.label,
    sourceUrl: proofUrl || provider.officialDocsUrl || '',
    sourcePageUrl: proofUrl || provider.officialDocsUrl || '',
    license: provider.id === 'pixabay' ? 'Pixabay Content License' : provider.licenseLabel || `${provider.label} generated audio license`,
    licenseUrl: provider.id === 'pixabay' ? PIXABAY_CONTENT_LICENSE_URL : licenseUrl || provider.licenseUrl || provider.officialDocsUrl || '',
    attribution: '',
    rightsStatus: provider.id === 'pixabay' ? 'needs-review' : 'ai-generated',
    socialUse: true,
    commercialUse,
    category: selectedTag?.label || selectedTag?.id || 'AI music',
    genre: selectedTag?.label || '',
    mood: selectedTag?.label || '',
    tags: provider.id === 'pixabay'
        ? ['pixabay', selectedTag?.group, selectedTag?.id].filter(Boolean)
        : ['ai-generated', provider.id, selectedTag?.id].filter(Boolean),
    licenseSnapshotVersion: `${provider.id}-manual-current`,
    contentIdWarning: provider.id === 'pixabay'
        ? 'Pixabay signale des droits tiers possibles et des risques Content ID. Conserver la page source et verifier avant publication.'
        : provider.id === 'aitra-free'
        ? 'Aitra Free interdit la revente du son brut, la fausse attribution, la distribution streaming comme morceau et Content ID.'
        : `Musique IA ${provider.label}: verifier les conditions du provider avant publication si necessaire.`,
    importEvent: `Import IA termine: ${provider.label}.`,
});

const pixabayClientTimeoutMs = (count) => Math.min(
    PIXABAY_CLIENT_TIMEOUT_MAX_MS,
    PIXABAY_CLIENT_TIMEOUT_BASE_MS + Math.max(0, count - 1) * PIXABAY_CLIENT_TIMEOUT_PER_EXTRA_TRACK_MS,
);

const normalizePixabayTrackId = (value = '') => {
    const match = String(value || '').toLowerCase().match(/(?:pixabay-ai-)?pixabay-(\d+)/);
    return match?.[1] ? `pixabay-${match[1]}` : '';
};

const collectPixabayExclusions = (...trackGroups) => {
    const excludeIds = new Set();
    const excludeUrls = new Set();
    trackGroups.flat().filter(Boolean).forEach((track) => {
        const provider = String(track.provider || track.sourceProvider || '').toLowerCase();
        const looksPixabay = provider.includes('pixabay')
            || String(track.id || '').includes('pixabay')
            || String(track.sourceUrl || track.sourcePageUrl || '').includes('pixabay.com/music/');
        if (!looksPixabay) return;
        [
            track.providerTrackId,
            track.id,
            track.sourceTrackId,
        ].forEach((value) => {
            const id = normalizePixabayTrackId(value);
            if (id) excludeIds.add(id);
        });
        [
            track.sourcePageUrl,
            track.sourceUrl,
        ].forEach((value) => {
            const url = cleanHttpsUrl(value);
            if (url && url.includes('pixabay.com/music/')) excludeUrls.add(url.replace(/\/$/, ''));
        });
    });
    return {
        excludeIds: Array.from(excludeIds),
        excludeUrls: Array.from(excludeUrls),
    };
};

const mergePixabayExclusions = (current = {}, ignored = {}) => ({
    excludeIds: Array.from(new Set([...(current.excludeIds || []), ...(ignored.ids || [])].map(normalizePixabayTrackId).filter(Boolean))),
    excludeUrls: Array.from(new Set([...(current.excludeUrls || []), ...(ignored.urls || [])].map((url) => String(url || '').replace(/\/$/, '')).filter(Boolean))),
});

/*
 * Import Pixabay par theme: passe par /api/music/pixabay-local-import, exclut ce
 * qui est deja en bibliotheque (et ce que l'utilisateur a ignore) puis pousse
 * chaque piste vers le projet Firebase si disponible, sinon en local.
 */
export async function importPixabayThemeBatch({
    provider,
    selectedTag,
    count = 1,
    proofUrl = '',
    localLibrary,
    projectLibrary,
}) {
    const safeCount = Math.max(1, Math.min(5, Number(count) || 1));
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), pixabayClientTimeoutMs(safeCount));
    try {
        const pixabayExclusions = collectPixabayExclusions(
            localLibrary?.tracks || [],
            projectLibrary?.tracks || [],
        );
        const mergedExclusions = mergePixabayExclusions(pixabayExclusions, localLibrary?.ignoredPixabayTracks);
        const response = await fetch('/api/music/pixabay-local-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                query: selectedTag?.query || 'ai-generated',
                category: selectedTag?.id || 'ai-generated',
                limit: safeCount,
                pages: safeCount > 4 ? 2 : 1,
                scanLimit: Math.min(30, safeCount + Math.max(10, mergedExclusions.excludeIds.length + 4)),
                excludeIds: mergedExclusions.excludeIds,
                excludeUrls: mergedExclusions.excludeUrls,
            }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error || 'Import local Pixabay impossible.');
        }
        const manifestTracks = Array.isArray(payload?.tracks)
            ? payload.tracks.filter((track) => track.importStatus === 'importable' && (track.downloadUrl || track.previewUrl))
            : [];
        if (!manifestTracks.length) throw new Error('Aucune piste Pixabay importable trouvee pour ce theme.');
        const imported = [];
        for (const track of manifestTracks.slice(0, safeCount)) {
            const metadata = {
                ...buildAiImportMetadata({
                    provider,
                    selectedTag,
                    proofUrl: track.sourceUrl || proofUrl,
                    licenseUrl: track.licenseUrl || PIXABAY_CONTENT_LICENSE_URL,
                    commercialUse: true,
                }),
                ...track,
                id: `pixabay-ai-${track.id}`,
                provider: 'pixabay',
                sourceProvider: 'pixabay',
                sourceName: 'Pixabay Music',
                sourceUrl: track.sourceUrl || track.sourcePageUrl || provider.officialDocsUrl,
                sourcePageUrl: track.sourcePageUrl || track.sourceUrl || provider.officialDocsUrl,
                license: 'Pixabay Content License',
                licenseUrl: track.licenseUrl || PIXABAY_CONTENT_LICENSE_URL,
                rightsStatus: 'needs-review',
                socialUse: true,
                commercialUse: true,
                tags: Array.from(new Set([...(track.tags || []), 'pixabay', selectedTag?.group, selectedTag?.id].filter(Boolean))),
            };
            const importedTrack = projectLibrary.capability?.ready
                ? await projectLibrary.importTrackToProject(metadata)
                : await localLibrary.importRemoteTrack({ audioUrl: track.downloadUrl || track.previewUrl, metadata });
            if (importedTrack) imported.push(importedTrack);
        }
        if (!imported.length) throw new Error('Import Pixabay refuse par la bibliotheque.');
        return imported;
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('Pixabay met trop longtemps a repondre. Relance le theme ou choisis un autre tag.');
        }
        throw error instanceof Error ? error : new Error('Import Pixabay impossible.');
    } finally {
        window.clearTimeout(timeoutId);
    }
}

/*
 * Import Aitra Free par theme: chaque tour demande une piste du catalogue
 * gratuit en excluant celles deja obtenues dans le meme lot.
 */
export async function importAitraThemeBatch({
    provider,
    selectedTag,
    count = 1,
    proofUrl = '',
    licenseUrl = '',
    localLibrary,
}) {
    const safeCount = Math.max(1, Math.min(5, Number(count) || 1));
    const imported = [];
    const excludeTrackIds = [];
    for (let index = 0; index < safeCount; index += 1) {
        aiImportCounter += 1;
        const draftTrack = {
            ...buildAiImportMetadata({
                provider,
                selectedTag,
                proofUrl,
                licenseUrl,
                commercialUse: true,
            }),
            id: buildManualTrackId(provider.id, `${selectedTag?.id || 'theme'}-${aiImportCounter}-${index}`),
            title: `Aitra Free - ${selectedTag?.label || 'selection'}`,
            downloadUrl: AITRA_FREE_TRACKS_URL,
            previewUrl: AITRA_FREE_TRACKS_URL,
            audioUrl: AITRA_FREE_TRACKS_URL,
            themeId: selectedTag?.id || '',
            query: selectedTag?.query || selectedTag?.label || '',
            excludeTrackIds: [...excludeTrackIds],
            importStatus: 'importable',
        };
        const track = await localLibrary.importRemoteTrack({ audioUrl: AITRA_FREE_TRACKS_URL, metadata: draftTrack });
        if (track) {
            imported.push(track);
            if (track.providerTrackId) excludeTrackIds.push(track.providerTrackId);
            await new Promise((resolve) => window.setTimeout(resolve, 650));
        }
    }
    if (!imported.length) throw new Error('Aucune piste Aitra Free importee.');
    return imported;
}

/* Aiguillage commun: Pixabay ou Aitra Free, tout autre provider est refuse. */
export async function importAiThemeBatch(options) {
    const { provider } = options;
    if (provider.id === 'pixabay') return importPixabayThemeBatch(options);
    if (provider.id !== 'aitra-free') {
        throw new Error('Generation gratuite automatique disponible sur Aitra Free.');
    }
    return importAitraThemeBatch(options);
}

/* Import d'une URL audio directe (ou d'une page/ID de piste Aitra). */
export async function importAiAudioUrl({
    provider,
    selectedTag,
    audioUrl,
    audioUrlDraft = '',
    proofUrl = '',
    licenseUrl = '',
    localLibrary,
    projectLibrary,
}) {
    if (!audioUrl) throw new Error('URL audio HTTPS requise.');
    const aitraTrackId = provider.id === 'aitra-free' ? extractAitraTrackId(audioUrlDraft || audioUrl) : '';
    const draftTrack = {
        ...buildAiImportMetadata({
            provider,
            selectedTag,
            proofUrl,
            licenseUrl,
            commercialUse: true,
        }),
        id: buildManualTrackId(provider.id, audioUrl),
        title: aitraTrackId ? `Aitra Free track ${aitraTrackId}` : `${provider.label} import`,
        downloadUrl: audioUrl,
        previewUrl: audioUrl,
        audioUrl,
        importStatus: 'importable',
    };
    const imported = projectLibrary?.capability?.ready
        ? await projectLibrary.importTrackToProject(draftTrack)
        : await localLibrary.importRemoteTrack({ audioUrl, metadata: draftTrack });
    if (!imported) throw new Error('Import URL IA refuse.');
    return imported;
}

/* ---------- Import Pixabay manuel (fichier deja telecharge) ---------- */

export const cleanPixabaySourceUrl = (value = '') => {
    const trimmed = String(value || '').trim();
    return trimmed.startsWith('https://pixabay.com/music/') ? trimmed : '';
};

export const buildPixabayManualMetadata = ({ file, selectedTag, sourceUrl }) => ({
    title: file?.name?.replace(/\.[a-z0-9]+$/i, '') || '',
    provider: 'pixabay',
    sourceProvider: 'pixabay',
    sourceName: 'Pixabay Music',
    sourceUrl,
    sourcePageUrl: sourceUrl,
    license: 'Pixabay Content License',
    licenseUrl: PIXABAY_CONTENT_LICENSE_URL,
    attribution: '',
    rightsStatus: 'review',
    socialUse: true,
    commercialUse: true,
    category: selectedTag?.label || selectedTag?.id || 'Pixabay Music',
    genre: selectedTag?.label || '',
    mood: selectedTag?.label || '',
    tags: ['pixabay', selectedTag?.id, selectedTag?.query].filter(Boolean),
    licenseSnapshotVersion: 'pixabay-content-license-manual',
    contentIdWarning: 'Import manuel Pixabay: conserver la page source et verifier les risques Content ID avant publication sociale.',
    importEvent: `Import Pixabay termine: ${selectedTag?.label || 'musique'}.`,
});

/*
 * Import de fichiers audio deja telecharges depuis Pixabay, avec licence
 * pre-remplie. Vers le projet Firebase si disponible, sinon en local.
 */
export async function importPixabayLocalFiles({
    files,
    selectedTag,
    sourceUrl,
    localLibrary,
    projectLibrary,
}) {
    const audioFiles = Array.from(files || []).filter((file) => file.type.startsWith('audio/'));
    if (!audioFiles.length) return [];
    const imported = [];
    if (projectLibrary?.capability?.ready) {
        for (const file of audioFiles) {
            const track = await projectLibrary.importFileToProject(file, buildPixabayManualMetadata({ file, selectedTag, sourceUrl }));
            if (track) imported.push(track);
        }
    } else {
        imported.push(...(await localLibrary.importFiles(
            audioFiles,
            buildPixabayManualMetadata({ file: audioFiles[0], selectedTag, sourceUrl }),
        ) || []));
    }
    if (!imported.length) throw new Error('Aucun fichier audio importe.');
    return imported;
}
