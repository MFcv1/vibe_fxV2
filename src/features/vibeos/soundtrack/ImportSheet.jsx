"use client";

import React, { useMemo, useRef, useState } from 'react';
import { ExternalLink, FolderOpen, Loader2, UploadCloud } from 'lucide-react';
import {
    PIXABAY_MUSIC_URL,
    SOUNDTRACK_PROVIDERS,
    buildPixabayMusicSearchUrl,
    getSoundtrackProviderQuickTagGroups,
    getSoundtrackProviderQuickTags,
} from '@/features/vibefx-studio/soundtrack/data/soundtrackDefaults';
import { filePickerAccept } from '@/features/vibefx-studio/soundtrack/services/soundtrackDownloads';
import {
    cleanPixabaySourceUrl,
    importAiThemeBatch,
    importPixabayLocalFiles,
} from '@/features/vibefx-studio/soundtrack/services/soundtrackImportFlows';
import { Badge, Button, Sheet } from '../primitives';
import styles from './soundtrack.module.css';

/*
 * Les quatre sources d'import, en Sheet VibeOS (plan §5.5).
 * Toute la mecanique d'import vient de `soundtrackImportFlows` et des hooks de
 * bibliotheque: ce fichier n'est que le formulaire.
 */

export const IMPORT_SOURCES = [
    { id: 'ai', label: 'Import IA', title: 'Musique IA par thème' },
    { id: 'pixabay', label: 'Pixabay', title: 'Pixabay Music' },
    { id: 'file', label: 'Fichier local', title: 'Fichier local' },
    { id: 'url', label: 'URL', title: 'Import par URL' },
];

const AI_PROVIDER_IDS = ['aitra-free', 'pixabay'];

function Status({ status, message }) {
    if (!message) return null;
    return (
        <p className={styles.importStatus} data-state={status} role="status">
            {message}
        </p>
    );
}

function AiImportBody({ localLibrary, projectLibrary, onImported }) {
    const [providerId, setProviderId] = useState('aitra-free');
    const [tagId, setTagId] = useState('');
    const [groupId, setGroupId] = useState('');
    const [count, setCount] = useState(1);
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    const provider = useMemo(
        () => SOUNDTRACK_PROVIDERS.find((item) => item.id === providerId),
        [providerId],
    );
    const quickTags = getSoundtrackProviderQuickTags(providerId);
    const quickTagGroups = getSoundtrackProviderQuickTagGroups(providerId);
    const selectedTag = quickTags.find((tag) => tag.id === tagId) || quickTags[0];
    const activeGroupId = providerId === 'pixabay'
        ? groupId || selectedTag?.group || quickTagGroups[0]?.id || ''
        : '';
    const visibleTags = providerId === 'pixabay' && activeGroupId
        ? quickTags.filter((tag) => tag.group === activeGroupId)
        : quickTags.slice(0, 12);

    const run = async () => {
        if (!provider) return;
        setStatus('loading');
        setMessage(providerId === 'pixabay'
            ? `Recherche Pixabay ${selectedTag?.label || 'musique'}…`
            : `Recherche Aitra ${selectedTag?.label || 'thème'}…`);
        try {
            const imported = await importAiThemeBatch({
                provider,
                selectedTag,
                count,
                proofUrl: provider.officialDocsUrl || '',
                licenseUrl: provider.licenseUrl || '',
                localLibrary,
                projectLibrary,
            });
            setStatus('ready');
            setMessage(`${imported.length} piste${imported.length > 1 ? 's' : ''} ajoutée${imported.length > 1 ? 's' : ''}.`);
            onImported?.(imported);
        } catch (error) {
            setStatus('error');
            setMessage(error?.message || 'Import impossible.');
        }
    };

    return (
        <div className={styles.importBody}>
            <p className={styles.importIntro}>
                Choisis une banque gratuite et un thème : Vibe_fx importe les pistes
                directement dans ta bibliothèque, avec leur licence.
            </p>

            <div className={styles.chips} role="tablist" aria-label="Banque musicale">
                {AI_PROVIDER_IDS.map((id) => {
                    const definition = SOUNDTRACK_PROVIDERS.find((item) => item.id === id);
                    if (!definition) return null;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={providerId === id}
                            className={styles.chip}
                            data-active={providerId === id}
                            onClick={() => {
                                setProviderId(id);
                                setTagId('');
                                setGroupId('');
                                setStatus('idle');
                                setMessage('');
                            }}
                        >
                            {definition.label}
                        </button>
                    );
                })}
            </div>

            {quickTagGroups.length > 0 && (
                <div className={styles.chips} aria-label="Familles de thèmes">
                    {quickTagGroups.map((group) => (
                        <button
                            key={group.id}
                            type="button"
                            className={styles.chip}
                            data-active={group.id === activeGroupId}
                            onClick={() => {
                                const [firstTag] = quickTags.filter((tag) => tag.group === group.id);
                                setGroupId(group.id);
                                setTagId(firstTag?.id || tagId);
                            }}
                        >
                            {group.label}
                        </button>
                    ))}
                </div>
            )}

            <div className={styles.chips} aria-label="Thèmes">
                {visibleTags.map((tag) => (
                    <button
                        key={tag.id}
                        type="button"
                        className={styles.chip}
                        data-active={selectedTag?.id === tag.id}
                        onClick={() => {
                            setTagId(tag.id);
                            setGroupId(tag.group || activeGroupId);
                        }}
                    >
                        {tag.label}
                    </button>
                ))}
            </div>

            <div className={styles.importRow}>
                <label className={styles.importField}>
                    <span>Nombre de pistes</span>
                    <input
                        type="number"
                        min={1}
                        max={5}
                        value={count}
                        data-numeric
                        data-testid="vibeos-soundtrack-ai-count"
                        onChange={(event) => setCount(event.target.value)}
                    />
                </label>
                <Button
                    variant="primary"
                    icon={status === 'loading' ? <Loader2 size={14} className={styles.spin} /> : <UploadCloud size={14} />}
                    disabled={status === 'loading'}
                    onClick={run}
                    data-testid="vibeos-soundtrack-ai-run"
                >
                    Importer
                </Button>
            </div>

            {provider?.officialDocsUrl ? (
                <a className={styles.importLink} href={provider.officialDocsUrl} target="_blank" rel="noreferrer">
                    Ouvrir {provider.label} <ExternalLink size={12} />
                </a>
            ) : null}

            <Status status={status} message={message} />
        </div>
    );
}

function PixabayImportBody({ localLibrary, projectLibrary, onImported }) {
    const inputRef = useRef(null);
    const [sourceDraft, setSourceDraft] = useState('');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const quickTags = getSoundtrackProviderQuickTags('pixabay');
    const [tagId, setTagId] = useState(quickTags[0]?.id || '');
    const selectedTag = quickTags.find((tag) => tag.id === tagId) || quickTags[0];
    const officialUrl = buildPixabayMusicSearchUrl(selectedTag) || PIXABAY_MUSIC_URL;
    const sourceUrl = cleanPixabaySourceUrl(sourceDraft) || officialUrl;

    const handleFiles = async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!files.length) return;
        setStatus('loading');
        setMessage('');
        try {
            const imported = await importPixabayLocalFiles({
                files,
                selectedTag,
                sourceUrl,
                localLibrary,
                projectLibrary,
            });
            setStatus('ready');
            setMessage(`${imported.length} piste${imported.length > 1 ? 's' : ''} ajoutée${imported.length > 1 ? 's' : ''} avec la licence Pixabay.`);
            onImported?.(imported);
        } catch (error) {
            setStatus('error');
            setMessage(error?.message || 'Import Pixabay impossible.');
        }
    };

    return (
        <div className={styles.importBody}>
            <p className={styles.importIntro}>
                Télécharge une piste depuis Pixabay Music, puis dépose le fichier ici :
                la licence et la page source sont enregistrées avec la piste.
            </p>

            <div className={styles.chips} aria-label="Thèmes Pixabay">
                {quickTags.slice(0, 10).map((tag) => (
                    <button
                        key={tag.id}
                        type="button"
                        className={styles.chip}
                        data-active={selectedTag?.id === tag.id}
                        onClick={() => setTagId(tag.id)}
                    >
                        {tag.label}
                    </button>
                ))}
            </div>

            <label className={styles.importField}>
                <span>Page source de la piste</span>
                <input
                    value={sourceDraft}
                    onChange={(event) => setSourceDraft(event.target.value)}
                    placeholder="https://pixabay.com/music/…"
                />
            </label>

            <div className={styles.importRow}>
                <a className={styles.importLink} href={officialUrl} target="_blank" rel="noreferrer">
                    Ouvrir Pixabay <ExternalLink size={12} />
                </a>
                <Button
                    variant="primary"
                    icon={status === 'loading' ? <Loader2 size={14} className={styles.spin} /> : <UploadCloud size={14} />}
                    disabled={status === 'loading'}
                    onClick={() => inputRef.current?.click()}
                >
                    Choisir le fichier
                </Button>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                multiple
                className={styles.hiddenInput}
                data-testid="vibeos-soundtrack-pixabay-input"
                onChange={handleFiles}
            />

            <Status status={status} message={message} />
        </div>
    );
}

function FileImportBody({ localLibrary, onImported }) {
    const inputRef = useRef(null);
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const folderState = localLibrary.folderState;

    const handleFiles = async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!files.length) return;
        setStatus('loading');
        setMessage('');
        try {
            const imported = (await localLibrary.importFiles(files)) || [];
            setStatus(imported.length ? 'ready' : 'error');
            setMessage(imported.length
                ? `${imported.length} piste${imported.length > 1 ? 's' : ''} ajoutée${imported.length > 1 ? 's' : ''} à ta bibliothèque.`
                : 'Aucun fichier audio exploitable dans la sélection.');
            if (imported.length) onImported?.(imported);
        } catch (error) {
            setStatus('error');
            setMessage(error?.message || 'Import impossible.');
        }
    };

    return (
        <div className={styles.importBody}>
            <p className={styles.importIntro}>
                Ajoute tes propres fichiers audio (ou un manifeste Vibe_fx exporté).
                Ils restent sur ta machine, dans le stockage local du navigateur.
            </p>

            <div className={styles.importRow}>
                <Button
                    variant="primary"
                    icon={status === 'loading' ? <Loader2 size={14} className={styles.spin} /> : <UploadCloud size={14} />}
                    disabled={status === 'loading'}
                    onClick={() => inputRef.current?.click()}
                >
                    Choisir des fichiers
                </Button>
                <Button
                    icon={<FolderOpen size={14} />}
                    onClick={localLibrary.connectFolder}
                    disabled={folderState.capability === 'fallback'}
                >
                    Connecter un dossier
                </Button>
            </div>

            <input
                ref={inputRef}
                type="file"
                multiple
                accept={filePickerAccept()}
                className={styles.hiddenInput}
                data-testid="vibeos-soundtrack-file-input"
                onChange={handleFiles}
            />

            <p className={styles.importNote}>
                <Badge>{folderState.status}</Badge> {folderState.message}
            </p>

            <Status status={status} message={message} />
        </div>
    );
}

function UrlImportBody({ localLibrary, onImported }) {
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [sourcePage, setSourcePage] = useState('');
    const [license, setLicense] = useState('Licence à vérifier');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    const run = async () => {
        if (!url.trim()) return;
        setStatus('loading');
        setMessage('');
        try {
            const imported = await localLibrary.importRemoteTrack({
                audioUrl: url,
                metadata: {
                    title: title || 'Piste importée',
                    sourceUrl: sourcePage || url,
                    license,
                    rightsStatus: 'needs-review',
                },
            });
            if (!imported) throw new Error('Import refusé : URL audio inaccessible.');
            setStatus('ready');
            setMessage(`« ${imported.title} » ajoutée à ta bibliothèque.`);
            setUrl('');
            setTitle('');
            setSourcePage('');
            onImported?.([imported]);
        } catch (error) {
            setStatus('error');
            setMessage(error?.message || 'Import URL impossible.');
        }
    };

    return (
        <div className={styles.importBody}>
            <p className={styles.importIntro}>
                Colle l&apos;URL directe d&apos;un fichier audio. La piste est téléchargée
                localement, avec la licence que tu déclares.
            </p>

            <label className={styles.importField}>
                <span>URL audio directe</span>
                <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://…/piste.mp3"
                    data-testid="vibeos-soundtrack-url-input"
                />
            </label>
            <label className={styles.importField}>
                <span>Titre</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nom de la piste" />
            </label>
            <label className={styles.importField}>
                <span>Page source</span>
                <input value={sourcePage} onChange={(event) => setSourcePage(event.target.value)} placeholder="https://…" />
            </label>
            <label className={styles.importField}>
                <span>Licence</span>
                <input value={license} onChange={(event) => setLicense(event.target.value)} />
            </label>

            <div className={styles.importRow}>
                <Button
                    variant="primary"
                    icon={status === 'loading' ? <Loader2 size={14} className={styles.spin} /> : <UploadCloud size={14} />}
                    disabled={status === 'loading' || !url.trim()}
                    onClick={run}
                    data-testid="vibeos-soundtrack-url-run"
                >
                    Importer
                </Button>
            </div>

            <Status status={status} message={message} />
        </div>
    );
}

export default function ImportSheet({ source, onClose, localLibrary, projectLibrary, onImported }) {
    const definition = IMPORT_SOURCES.find((item) => item.id === source);
    if (!definition) return null;

    return (
        <Sheet open onClose={onClose} title={definition.title} wide>
            {source === 'ai' ? (
                <AiImportBody localLibrary={localLibrary} projectLibrary={projectLibrary} onImported={onImported} />
            ) : null}
            {source === 'pixabay' ? (
                <PixabayImportBody localLibrary={localLibrary} projectLibrary={projectLibrary} onImported={onImported} />
            ) : null}
            {source === 'file' ? (
                <FileImportBody localLibrary={localLibrary} onImported={onImported} />
            ) : null}
            {source === 'url' ? (
                <UrlImportBody localLibrary={localLibrary} onImported={onImported} />
            ) : null}
        </Sheet>
    );
}
