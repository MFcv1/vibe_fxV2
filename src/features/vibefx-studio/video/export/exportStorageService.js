export const EXPORT_STORAGE_MODES = {
    localMock: 'localMock',
    firebase: 'firebase',
};

const MAX_FIREBASE_SOURCE_BYTES = 750 * 1024 * 1024;

export function resolveExportStorageMode() {
    const requestedMode = process.env.NEXT_PUBLIC_VIBECUT_EXPORT_MODE;
    if (requestedMode === EXPORT_STORAGE_MODES.firebase || requestedMode === 'server') return EXPORT_STORAGE_MODES.firebase;
    return EXPORT_STORAGE_MODES.localMock;
}

export async function prepareExportSources({ manifest, mode = resolveExportStorageMode(), onProgress } = {}) {
    const clips = manifest?.clips || [];
    const audioTracks = manifest?.audioTracks || [];
    const sources = [...clips, ...audioTracks];

    onProgress?.({
        phase: 'preparing_sources',
        phaseLabel: 'Preparation des sources',
        stepLabel: mode === EXPORT_STORAGE_MODES.firebase ? 'Verification Storage Firebase' : 'Verification sources locales',
        progress: 6,
    });

    if (mode === EXPORT_STORAGE_MODES.firebase) {
        return prepareFirebaseSources({ manifest, sources, onProgress });
    }

    return prepareLocalMockSources({ manifest, sources, onProgress });
}

async function prepareLocalMockSources({ manifest, sources, onProgress }) {
    await wait(180);
    const missing = sources.filter(source => !source.localPreviewUrl && !source.sourceStoragePath);
    if (missing.length > 0) {
        const labels = missing.map(source => source.name || source.id || 'source').join(', ');
        throw createExportServiceError({
            code: 'source-missing',
            message: `Source originale introuvable: ${labels}.`,
            action: 'Reimporte les fichiers avant de relancer le mock export.',
        });
    }

    const warnings = sources
        .filter(source => !source.sourceStoragePath)
        .map(source => `${source.name || source.id}: source locale non uploadee`);

    onProgress?.({
        phase: 'preparing_sources',
        phaseLabel: 'Preparation des sources',
        stepLabel: warnings.length ? 'Sources locales acceptees pour le mock' : 'Sources deja referencees',
        progress: 14,
        warnings,
    });

    return {
        manifest,
        warnings,
        mode: EXPORT_STORAGE_MODES.localMock,
    };
}

async function prepareFirebaseSources({ manifest, onProgress }) {
    const [{ auth, firebaseReady, storage }, storageSdk] = await Promise.all([
        import('@/lib/firebase'),
        import('firebase/storage'),
    ]);

    if (!firebaseReady || !storage || !auth) {
        throw createExportServiceError({
            code: 'firebase-not-configured',
            message: 'Firebase n est pas configure pour l export serveur.',
            action: 'Renseigne les variables Firebase publiques puis relance en mode firebase.',
        });
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
        throw createExportServiceError({
            code: 'firebase-auth-required',
            message: 'Connexion requise pour uploader les sources export.',
            action: 'Connecte-toi avant de lancer un Export Pro Firebase.',
        });
    }

    const exportId = `vibecut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextManifest = {
        ...manifest,
        project: {
            ...(manifest.project || {}),
            userId: uid,
        },
        clips: [...(manifest.clips || [])],
        audioTracks: [...(manifest.audioTracks || [])],
    };
    const warnings = [];
    const uploadTargets = [
        ...nextManifest.clips.map((source, index) => ({
            kind: source.mediaType === 'image' ? 'image' : 'video',
            index,
            source,
        })),
        ...nextManifest.audioTracks.map((source, index) => ({ kind: 'audio', index, source })),
    ].filter(({ source }) => !source.sourceStoragePath);

    if (!uploadTargets.length) {
        onProgress?.({
            phase: 'preparing_sources',
            phaseLabel: 'Preparation des sources',
            stepLabel: 'Sources deja presentes dans Firebase Storage',
            progress: 14,
        });
        return {
            manifest: nextManifest,
            warnings,
            mode: EXPORT_STORAGE_MODES.firebase,
            exportId,
        };
    }

    let completed = 0;
    for (const target of uploadTargets) {
        const { blob, contentType } = await loadSourceBlob(target.source, target.kind);
        if (blob.size > MAX_FIREBASE_SOURCE_BYTES) {
            throw createExportServiceError({
                code: 'source-too-large',
                message: `Source trop volumineuse pour l export: ${target.source.name || target.source.id || 'source'}.`,
                action: 'Reduis la taille du fichier ou monte la limite Storage cote regles avant de relancer.',
            });
        }

        const storagePath = buildExportSourcePath({ uid, exportId, target, contentType });
        const storageRef = storageSdk.ref(storage, storagePath);
        await uploadBlobWithProgress({
            storageSdk,
            storageRef,
            blob,
            contentType,
            onProgress: (sourceProgress) => {
                const totalProgress = 6 + Math.round(((completed + sourceProgress) / uploadTargets.length) * 8);
                onProgress?.({
                    phase: 'uploading_sources',
                    phaseLabel: 'Upload sources',
                    stepLabel: `Upload Firebase ${completed + 1}/${uploadTargets.length}: ${target.source.name || target.source.id || target.kind}`,
                    progress: Math.min(14, totalProgress),
                });
            },
        });

        const patch = {
            ...target.source,
            sourceStoragePath: storagePath,
            localPreviewUrl: null,
            uploadedAt: new Date().toISOString(),
            storage: {
                path: storagePath,
                bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || null,
            },
        };
        if (target.kind === 'video' || target.kind === 'image') nextManifest.clips[target.index] = patch;
        if (target.kind === 'audio') nextManifest.audioTracks[target.index] = patch;
        completed += 1;
    }

    onProgress?.({
        phase: 'preparing_sources',
        phaseLabel: 'Preparation des sources',
        stepLabel: 'Sources uploadees dans Firebase Storage',
        progress: 14,
    });

    return {
        manifest: nextManifest,
        warnings,
        mode: EXPORT_STORAGE_MODES.firebase,
        exportId,
    };
}

export function createExportServiceError({ code, message, action, cause } = {}) {
    const error = new Error(message || 'Erreur export inconnue.');
    error.code = code || 'export-service-error';
    error.action = action || 'Reessaie apres verification du projet.';
    if (cause) error.cause = cause;
    return error;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadSourceBlob(source = {}, kind = 'video') {
    const sourceUrl = source.localPreviewUrl || source.url || source.previewUrl;
    if (!sourceUrl) {
        throw createExportServiceError({
            code: 'source-missing',
            message: `Source originale introuvable: ${source.name || source.id || 'source'}.`,
            action: 'Reimporte le fichier avant de relancer l export Firebase.',
        });
    }

    try {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return {
            blob,
            contentType: blob.type || inferContentType(source.name || sourceUrl, kind),
        };
    } catch (error) {
        throw createExportServiceError({
            code: 'source-fetch-failed',
            message: `Lecture source impossible: ${source.name || source.id || 'source'}.`,
            action: 'Verifie que le fichier local est encore disponible dans la session.',
            cause: error,
        });
    }
}

function uploadBlobWithProgress({ storageSdk, storageRef, blob, contentType, onProgress }) {
    return new Promise((resolve, reject) => {
        const task = storageSdk.uploadBytesResumable(storageRef, blob, {
            contentType,
            customMetadata: {
                product: 'vibecut',
                role: 'export-source',
            },
        });

        task.on('state_changed', (snapshot) => {
            const progress = snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
            onProgress?.(progress);
        }, reject, () => resolve(task.snapshot));
    });
}

function buildExportSourcePath({ uid, exportId, target, contentType }) {
    const extension = inferExtension(target.source.name, contentType, target.kind);
    const safeName = sanitizeFileName(target.source.name || `${target.kind}-${target.index + 1}.${extension}`);
    return `users/${uid}/exports/${exportId}/sources/${target.kind}/${String(target.index + 1).padStart(2, '0')}-${safeName}`;
}

function sanitizeFileName(value = '') {
    return String(value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'source';
}

function inferContentType(name = '', kind = 'video') {
    const lower = String(name).toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.webm')) return lower.includes('audio') ? 'audio/webm' : 'video/webm';
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.m4a')) return 'audio/mp4';
    if (lower.endsWith('.aac')) return 'audio/aac';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.avif')) return 'image/avif';
    if (kind === 'image') return 'image/jpeg';
    return kind === 'audio' ? 'audio/mp4' : 'video/mp4';
}

function inferExtension(name = '', contentType = '', kind = 'video') {
    const cleanName = String(name || '');
    const match = cleanName.match(/\.([A-Za-z0-9]{2,6})$/);
    if (match) return match[1].toLowerCase();
    if (contentType.includes('mp4')) return kind === 'audio' ? 'm4a' : 'mp4';
    if (contentType.includes('quicktime')) return 'mov';
    if (contentType.includes('webm')) return 'webm';
    if (contentType.includes('mpeg')) return 'mp3';
    if (contentType.includes('wav')) return 'wav';
    if (contentType.includes('aac')) return 'aac';
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('avif')) return 'avif';
    if (kind === 'image') return 'jpg';
    return kind === 'audio' ? 'm4a' : 'mp4';
}
