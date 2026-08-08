import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, UploadCloud } from 'lucide-react';
import {
    PIXABAY_MUSIC_URL,
    buildPixabayMusicSearchUrl,
    getSoundtrackProviderQuickTags,
} from '../data/soundtrackDefaults';
/* Flux partage avec l'ecran Soundtrack VibeOS (phase E) - voir le module. */
import {
    cleanPixabaySourceUrl as cleanSourceUrl,
    importPixabayLocalFiles,
} from '../services/soundtrackImportFlows';

export default function PixabayImportAssistant({
    search,
    localLibrary,
    projectLibrary,
    onSelectTrack,
    onImportComplete,
}) {
    const inputRef = useRef(null);
    const [sourceDraft, setSourceDraft] = useState('');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const quickTags = getSoundtrackProviderQuickTags('pixabay');
    const selectedTag = quickTags.find((tag) => tag.id === search.category)
        || quickTags.find((tag) => tag.query === search.query)
        || quickTags[0];
    const officialUrl = useMemo(() => (
        search.sourceUrl || buildPixabayMusicSearchUrl(selectedTag) || PIXABAY_MUSIC_URL
    ), [search.sourceUrl, selectedTag]);
    const sourceUrl = cleanSourceUrl(sourceDraft) || officialUrl;
    const targetLabel = projectLibrary.capability?.ready ? 'Projet Firebase' : 'Bibliotheque locale';

    if (search.provider !== 'pixabay') return null;

    const importFiles = async (event) => {
        const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('audio/'));
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
            onSelectTrack?.(imported[0]);
            onImportComplete?.(imported[0], imported);
            setStatus('ready');
            setMessage(`${imported.length} piste${imported.length > 1 ? 's' : ''} ajoutee${imported.length > 1 ? 's' : ''} a la bibliotheque Vibe_fx.`);
        } catch (error) {
            setStatus('error');
            setMessage(error.message || 'Import Pixabay impossible.');
        }
    };

    return (
        <section className="soundtrack-pixabay-assistant" data-state={status} data-testid="pixabay-import-assistant" aria-label="Assistant import Pixabay">
            <div className="soundtrack-pixabay-assistant__head">
                <div>
                    <p>Source gratuite Pixabay</p>
                    <strong>{selectedTag?.label || 'Pixabay Music'}</strong>
                </div>
                <span>{targetLabel}</span>
            </div>
            <p className="soundtrack-pixabay-assistant__explain">
                Ce bloc sert seulement a importer une piste telechargee depuis Pixabay Music. Pour creer une piste IA par theme, utilise le bouton Musique IA par theme en haut.
            </p>
            <div className="soundtrack-pixabay-assistant__flow">
                <a href={officialUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={13} />
                    Ouvrir Pixabay
                </a>
                <label>
                    <span>Page source piste</span>
                    <input
                        value={sourceDraft}
                        onChange={(event) => setSourceDraft(event.target.value)}
                        placeholder="https://pixabay.com/music/..."
                        aria-label="Page source Pixabay"
                    />
                </label>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={status === 'loading'}>
                    {status === 'loading' ? <Loader2 size={13} className="soundtrack-spin" /> : <UploadCloud size={13} />}
                    Importer fichier telecharge
                </button>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                multiple
                className="soundtrack-hidden-input"
                data-testid="pixabay-assisted-file-input"
                onChange={importFiles}
            />
            <div className="soundtrack-pixabay-assistant__meta">
                <span>Source Pixabay</span>
                <span>Licence pre-remplie</span>
                <span>Categorie {selectedTag?.label || 'Pixabay'}</span>
                {status === 'ready' && <span data-state="ready"><CheckCircle2 size={12} /> importe</span>}
                {message && <small data-state={status}>{message}</small>}
            </div>
        </section>
    );
}
