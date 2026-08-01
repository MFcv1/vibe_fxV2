"use client";

/*
 * Recuperation du MP4 rendu: nommage, regeneration d'URL signee, et
 * enregistrement direct dans un dossier du PC.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CE MODULE EXISTE (phase 7, 2026-08-01)
 *
 * Cette logique vivait dans `panels/ExportVideoPanel.jsx`, le panneau d'export
 * de l'ANCIEN front. La phase 7 supprime ce panneau - mais il portait des
 * comportements que le nouveau front n'avait pas:
 *
 *   - le choix d'un DOSSIER de destination (File System Access API), et sa
 *     memorisation d'une session a l'autre;
 *   - un nom de fichier DETERMINISTE (`vibecut-<projet>-<horodatage>.mp4`)
 *     plutot qu'un `<projet>.mp4` qui ecrase le fichier precedent;
 *   - la regeneration d'URL signee par Storage AVANT de retomber sur la
 *     callable, ce qui evite un aller-retour serveur quand le chemin suffit.
 *
 * Les supprimer avec le panneau aurait ete une perte de fonction silencieuse.
 * Ils sont donc DEPLACES ici, dans la couche export ou ils auraient toujours du
 * etre: c'est de la logique, pas du rendu. Les deux feuilles d'export du
 * nouveau front s'en servent, et `smoke-vibecut-export-jobs` lit ce fichier.
 * ---------------------------------------------------------------------------
 */

import { getVideoExportDownloadUrl } from './exportJobService';

export const EXPORT_DESTINATION_PREF_KEY = 'vibecut-export-destination-v1';

/* ---------- Nom de fichier ---------- */

function sanitizeExportFilePart(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
}

function formatExportFileDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}`;
}

/*
 * L'horodatage n'est pas decoratif: sans lui, deux exports du meme projet
 * portent le meme nom et le second ecrase le premier dans le dossier choisi.
 */
export function buildExportFileName({ projectName = '', jobId = '' } = {}) {
    const stamp = formatExportFileDate(new Date());
    const safeProjectName = sanitizeExportFilePart(projectName);
    if (safeProjectName) return `vibecut-${safeProjectName}-${stamp}.mp4`;
    return `vibecut-export-${sanitizeExportFilePart(jobId) || stamp}.mp4`;
}

/* ---------- URL de telechargement ---------- */

/*
 * Les URL signees sont courtes: on les regenere au moment du clic plutot que de
 * garder un lien perime dans l'interface.
 *
 * Ordre volontaire: URL directe si le job en porte une, puis Storage a partir du
 * chemin (pas d'aller-retour serveur), puis la callable en dernier recours.
 */
export async function resolveExportOutputDownloadUrl(job = {}) {
    if (job?.output?.downloadUrl) return job.output.downloadUrl;
    if (!job?.output?.storagePath && !job?.id) throw new Error('Chemin Storage output absent.');

    if (job?.output?.storagePath) {
        try {
            const [{ firebaseReady, storage }, { getDownloadURL, ref }] = await Promise.all([
                import('@/lib/firebase'),
                import('firebase/storage'),
            ]);
            if (!firebaseReady || !storage) {
                throw new Error('Firebase Storage non configure pour regenerer une URL de download.');
            }
            return await getDownloadURL(ref(storage, job.output.storagePath));
        } catch (error) {
            // Sans identifiant de job, il n'y a pas de second chemin: on remonte.
            if (!job?.id) throw error;
        }
    }

    const download = await getVideoExportDownloadUrl({ jobId: job.id });
    if (!download?.downloadUrl) throw new Error('URL de telechargement MP4 absente.');
    return download.downloadUrl;
}

/* ---------- Destination sur le PC ---------- */

export function supportsDirectoryPicker() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export function readDestinationPreference() {
    if (typeof window === 'undefined') return { mode: 'downloads', label: '' };
    try {
        const saved = JSON.parse(window.localStorage.getItem(EXPORT_DESTINATION_PREF_KEY) || '{}');
        if (saved.mode === 'folder' && supportsDirectoryPicker()) {
            return { mode: 'folder', label: saved.label || '' };
        }
    } catch {
        // Preference locale non critique: on retombe sur le dossier de telechargements.
    }
    return { mode: 'downloads', label: '' };
}

export function persistDestinationPreference(mode, label = '') {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(EXPORT_DESTINATION_PREF_KEY, JSON.stringify({ mode, label }));
    } catch {
        // Best-effort: ne jamais faire echouer un export pour une preference.
    }
}

/*
 * Ouvre le selecteur de dossier. Renvoie `null` si l'utilisateur annule ou si le
 * navigateur ne sait pas faire - jamais une exception: annuler un choix de
 * dossier n'est pas une erreur.
 */
export async function chooseExportDirectory() {
    if (!supportsDirectoryPicker()) return null;
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        persistDestinationPreference('folder', handle?.name || 'Dossier choisi');
        return handle;
    } catch {
        return null;
    }
}

/* Ecrit le MP4 dans le dossier choisi. */
export async function saveExportToDirectory({ directoryHandle, url, fileName }) {
    if (!directoryHandle) throw new Error('Aucun dossier de destination.');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Telechargement Storage refuse (${response.status}).`);
    const blob = await response.blob();
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return fileName;
}
