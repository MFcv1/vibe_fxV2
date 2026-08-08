import React, { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, UploadCloud } from 'lucide-react';
import { AI_AUDIO_PROVIDERS } from '../services/soundtrackDownloads';
import {
    AITRA_FREE_TRACKS_URL,
    SOUNDTRACK_PROVIDERS,
    getSoundtrackProviderQuickTagGroups,
    getSoundtrackProviderQuickTags,
} from '../data/soundtrackDefaults';
/*
 * Les flux d'import vivent dans `services/soundtrackImportFlows.js` depuis la
 * phase E VibeOS: ce composant et le nouvel ecran /creer/son appellent le meme
 * code, il n'existe donc qu'une seule verite sur les metadonnees et licences.
 */
import {
    cleanHttpsUrl,
    importAiAudioUrl,
    importAiThemeBatch,
    normalizeImportUrlDraft,
} from '../services/soundtrackImportFlows';

const FREE_AI_SOURCE_LINKS = [
    {
        id: 'aitra-free',
        label: 'Aitra Free',
        href: AITRA_FREE_TRACKS_URL,
        badge: 'full gratuit',
        note: 'Selection automatique depuis le catalogue gratuit.',
    },
    {
        id: 'pixabay',
        label: 'Pixabay Music',
        href: 'https://pixabay.com/music/',
        badge: 'gratuit manuel',
        note: 'Catalogue musical complet adapte aux videos Vibe_fx.',
    },
];


export default function AiMusicImportAssistant({
    search = null,
    localLibrary,
    projectLibrary,
    onSelectTrack,
    onImportComplete,
    providerDefinitions,
    defaultProviderId = 'aitra-free',
    compact = false,
}) {
    const availableProviders = useMemo(() => {
        const definitions = providerDefinitions || search?.providerDefinitions || SOUNDTRACK_PROVIDERS;
        const providerMap = new Map();
        definitions.forEach((item) => {
            if (AI_AUDIO_PROVIDERS.includes(item.id) || item.id === 'pixabay') providerMap.set(item.id, item);
        });
        SOUNDTRACK_PROVIDERS.forEach((item) => {
            if ((AI_AUDIO_PROVIDERS.includes(item.id) || item.id === 'pixabay') && !providerMap.has(item.id)) providerMap.set(item.id, item);
        });
        return Array.from(providerMap.values());
    }, [providerDefinitions, search?.providerDefinitions]);
    const initialProviderId = search?.provider && AI_AUDIO_PROVIDERS.includes(search.provider)
        ? search.provider
        : defaultProviderId;
    const [manualProviderId, setManualProviderId] = useState(initialProviderId);
    const [audioUrlDraft, setAudioUrlDraft] = useState('');
    const [proofUrlDraft, setProofUrlDraft] = useState('');
    const [licenseUrlDraft, setLicenseUrlDraft] = useState('');
    const [selectedTagId, setSelectedTagId] = useState(search?.category || '');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [batchCount, setBatchCount] = useState(1);
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const activeProviderId = search?.provider && AI_AUDIO_PROVIDERS.includes(search.provider)
        ? search.provider
        : manualProviderId;
    const provider = useMemo(() => (
        availableProviders.find((item) => item.id === activeProviderId)
    ), [activeProviderId, availableProviders]);
    const quickTags = getSoundtrackProviderQuickTags(activeProviderId);
    const quickTagGroups = getSoundtrackProviderQuickTagGroups(activeProviderId);
    const selectedTag = quickTags.find((tag) => tag.id === selectedTagId)
        || quickTags.find((tag) => tag.id === search?.category)
        || quickTags.find((tag) => tag.query === search?.query)
        || quickTags[0];
    const activeGroupId = activeProviderId === 'pixabay'
        ? selectedGroupId || selectedTag?.group || quickTagGroups[0]?.id || ''
        : '';
    const visibleQuickTags = activeProviderId === 'pixabay' && activeGroupId
        ? quickTags.filter((tag) => tag.group === activeGroupId)
        : quickTags.slice(0, 12);
    const proofUrl = cleanHttpsUrl(proofUrlDraft) || provider?.officialDocsUrl || '';
    const licenseUrl = cleanHttpsUrl(licenseUrlDraft) || provider?.licenseUrl || provider?.officialDocsUrl || '';
    const audioUrl = normalizeImportUrlDraft(provider?.id, audioUrlDraft);
    const targetLabel = projectLibrary.capability?.ready ? 'Projet Firebase' : 'Bibliotheque locale';

    if (!provider || (!AI_AUDIO_PROVIDERS.includes(provider.id) && provider.id !== 'pixabay')) return null;

    const generateAndImport = async () => {
        const count = Math.max(1, Math.min(5, Number(batchCount) || 1));
        setStatus('loading');
        setMessage(provider.id === 'pixabay'
            ? `Recherche Pixabay ${selectedTag?.label || 'AI generated'}...`
            : `Recherche Aitra ${selectedTag?.label || 'theme'}...`);
        try {
            const imported = await importAiThemeBatch({
                provider,
                selectedTag,
                count,
                proofUrl,
                licenseUrl,
                localLibrary,
                projectLibrary,
            });
            onSelectTrack?.(imported[0]);
            onImportComplete?.(imported[0], imported);
            setStatus('ready');
            setMessage(provider.id === 'pixabay'
                ? `${imported.length} piste${imported.length > 1 ? 's' : ''} Pixabay ajoutee${imported.length > 1 ? 's' : ''}.`
                : `${imported.length} piste${imported.length > 1 ? 's' : ''} Aitra ajoutee${imported.length > 1 ? 's' : ''}.`);
        } catch (error) {
            setStatus('error');
            setMessage(error.message || (provider.id === 'pixabay'
                ? 'Import Pixabay impossible.'
                : 'Generation/import Aitra impossible.'));
        }
    };

    const importUrl = async () => {
        if (!audioUrl) {
            setStatus('error');
            setMessage('URL audio HTTPS requise.');
            return;
        }
        setStatus('loading');
        setMessage('');
        try {
            const imported = await importAiAudioUrl({
                provider,
                selectedTag,
                audioUrl,
                audioUrlDraft,
                proofUrl,
                licenseUrl,
                localLibrary,
                projectLibrary,
            });
            onSelectTrack?.(imported);
            onImportComplete?.(imported, [imported]);
            setStatus('ready');
            setMessage('URL audio IA importee dans la bibliotheque Vibe_fx.');
        } catch (error) {
            setStatus('error');
            setMessage(error.message || 'Import URL IA impossible.');
        }
    };

    return (
        <section
            className={`soundtrack-pixabay-assistant soundtrack-ai-import-assistant${compact ? ' soundtrack-ai-import-assistant--compact' : ''}`}
            data-state={status}
            data-testid="ai-music-import-assistant"
            aria-label="Assistant import generation IA"
        >
            <div className="soundtrack-pixabay-assistant__head">
                <div>
                    <p>{provider.id === 'pixabay' ? 'Import musique gratuite' : 'Import banque IA gratuite'}</p>
                    <strong>{provider.label}</strong>
                </div>
                <span>{targetLabel}</span>
            </div>
            <div className="soundtrack-ai-source-grid" aria-label="Sources musicales gratuites">
                {FREE_AI_SOURCE_LINKS.map((source) => (
                    <article
                        key={source.id}
                        data-active={provider.id === source.id ? 'true' : 'false'}
                        role="button"
                        tabIndex={0}
                        aria-pressed={provider.id === source.id}
                        onClick={() => {
                            setManualProviderId(source.id);
                            setSelectedTagId(source.id === 'pixabay' ? 'background-music' : selectedTagId);
                            setSelectedGroupId(source.id === 'pixabay' ? 'video' : '');
                            setStatus('idle');
                            setMessage('');
                        }}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            setManualProviderId(source.id);
                            setSelectedTagId(source.id === 'pixabay' ? 'background-music' : selectedTagId);
                            setSelectedGroupId(source.id === 'pixabay' ? 'video' : '');
                            setStatus('idle');
                            setMessage('');
                        }}
                    >
                        <div>
                            <strong>{source.label}</strong>
                            <span>{source.badge}</span>
                        </div>
                        <p>{source.note}</p>
                        <nav aria-label={`Liens ${source.label}`}>
                            <a
                                href={source.href}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                            >
                                Ouvrir
                                <ExternalLink size={11} />
                            </a>
                        </nav>
                    </article>
                ))}
            </div>
            {quickTagGroups.length > 0 && (
                <div className="soundtrack-ai-theme-groups" aria-label="Familles Pixabay Music">
                    {quickTagGroups.map((group) => {
                        const active = group.id === activeGroupId;
                        return (
                            <button
                                key={group.id}
                                type="button"
                                data-active={active ? 'true' : 'false'}
                                onClick={() => {
                                    const [firstTag] = quickTags.filter((tag) => tag.group === group.id);
                                    setSelectedGroupId(group.id);
                                    setSelectedTagId(firstTag?.id || selectedTagId);
                                    setStatus('idle');
                                    setMessage('');
                                }}
                            >
                                {group.label}
                            </button>
                        );
                    })}
                </div>
            )}
            <div className="soundtrack-ai-theme-picker" aria-label={provider.id === 'pixabay' ? 'Themes Pixabay Music' : 'Themes musique IA'}>
                {visibleQuickTags.map((tag) => (
                    <button
                        key={tag.id}
                        type="button"
                        data-active={selectedTag?.id === tag.id ? 'true' : 'false'}
                        onClick={() => {
                            setSelectedTagId(tag.id);
                            setSelectedGroupId(tag.group || activeGroupId);
                            setStatus('idle');
                            setMessage('');
                        }}
                    >
                        {tag.label}
                    </button>
                ))}
            </div>
            <div className="soundtrack-ai-generate-panel">
                {!search?.provider && (
                    <label>
                        <span>Provider</span>
                        <select
                            value={manualProviderId}
                            onChange={(event) => {
                                const nextProvider = event.target.value;
                                const [nextTag] = getSoundtrackProviderQuickTags(nextProvider);
                                setManualProviderId(nextProvider);
                                setSelectedTagId(nextTag?.id || '');
                                setSelectedGroupId(nextTag?.group || '');
                                setStatus('idle');
                                setMessage('');
                            }}
                            aria-label="Provider musique IA"
                        >
                            {availableProviders.map((item) => (
                                <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                        </select>
                    </label>
                )}
                <label>
                    <span>Nombre</span>
                    <input
                        type="number"
                        min={1}
                        max={5}
                        value={batchCount}
                        onChange={(event) => setBatchCount(event.target.value)}
                        aria-label="Nombre de pistes a importer"
                    />
                </label>
                <button type="button" onClick={generateAndImport} disabled={status === 'loading'}>
                    {status === 'loading' ? <Loader2 size={13} className="soundtrack-spin" /> : <UploadCloud size={13} />}
                    {provider.id === 'pixabay' ? 'Chercher / importer' : 'Generer / importer'}
                </button>
            </div>
            <details className="soundtrack-ai-manual-import">
                <summary>Import manuel avance</summary>
                <div className="soundtrack-pixabay-assistant__flow soundtrack-ai-import-assistant__flow">
                    <a href={provider.officialDocsUrl || '#'} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} />
                        Docs provider
                    </a>
                    <label>
                        <span>{provider.id === 'aitra-free' ? 'Page Aitra / ID / URL audio' : 'URL audio directe'}</span>
                        <input
                            value={audioUrlDraft}
                            onChange={(event) => setAudioUrlDraft(event.target.value)}
                            placeholder={provider.id === 'aitra-free' ? 'https://aitrafree.com/en/tracks/103 ou 103' : 'https://.../audio.mp3'}
                            aria-label="URL audio directe IA"
                        />
                    </label>
                    <button type="button" onClick={importUrl} disabled={status === 'loading' || !audioUrl}>
                        {status === 'loading' ? <Loader2 size={13} className="soundtrack-spin" /> : <UploadCloud size={13} />}
                        {provider.id === 'aitra-free' ? 'Importer Aitra' : 'Importer URL'}
                    </button>
                    <label>
                        <span>Page provider optionnelle</span>
                        <input
                            value={proofUrlDraft}
                            onChange={(event) => setProofUrlDraft(event.target.value)}
                            placeholder={provider.officialDocsUrl || 'https://...'}
                            aria-label="URL source optionnelle IA"
                        />
                    </label>
                    <label>
                        <span>Info provider optionnelle</span>
                        <input
                            value={licenseUrlDraft}
                            onChange={(event) => setLicenseUrlDraft(event.target.value)}
                            placeholder={provider.licenseUrl || provider.officialDocsUrl || 'https://...'}
                            aria-label="URL information fournisseur IA"
                        />
                    </label>
                </div>
            </details>
            <div className="soundtrack-pixabay-assistant__meta">
                <span>{provider.id === 'aitra-free' ? 'Aitra Free' : provider.id === 'pixabay' ? 'Pixabay Music' : 'Provider IA'}</span>
                <span>Import auto bibliotheque</span>
                <span>{selectedTag?.label || 'prompt libre'}</span>
                {status === 'ready' && <span data-state="ready"><CheckCircle2 size={12} /> importe</span>}
                {message && <small data-state={status}>{message}</small>}
            </div>
        </section>
    );
}
