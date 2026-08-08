"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
    Clock3,
    FolderOpen,
    Home,
    Library,
    Link2,
    Music2,
    Play,
    Plus,
    Search,
    Sparkles,
    Waves,
} from 'lucide-react';
import { getSoundtrackProviderQuickTags } from '@/features/vibefx-studio/soundtrack/data/soundtrackDefaults';
import { Button, EmptyState, SearchField, Sheet, Spinner, useToast } from '../primitives';
import ImportSheet, { IMPORT_SOURCES } from './ImportSheet';
import PlayerBar from './PlayerBar';
import { ArtworkMosaic, TrackCard, TrackList } from './TrackList';
import { useVibeOsSoundtrack } from './useVibeOsSoundtrack';
import styles from './soundtrack.module.css';

/*
 * Espace Soundtrack VibeOS (plan §5.5) - un vrai lecteur, pas un panneau
 * d'import. Colonne gauche de navigation, zone centrale a vues (accueil,
 * recherche, bibliotheques), lecteur fixe en bas.
 *
 * Aucune logique metier ici: tout vient de `useVibeOsSoundtrack`, qui assemble
 * les hooks existants de vibefx-studio et le provider audio global.
 */

const cx = (...values) => values.filter(Boolean).join(' ');

const VIEWS = {
    accueil: { title: 'Accueil', subtitle: 'Ta musique, prête à poser sur tes créations.' },
    recherche: { title: 'Rechercher', subtitle: 'Fouille les banques gratuites connectées.' },
    projet: { title: 'Pistes du projet', subtitle: 'Ce que tu as retenu pour ce projet.' },
    locale: { title: 'Ma bibliothèque locale', subtitle: 'Tes fichiers, stockés sur cette machine.' },
    recents: { title: 'Imports récents', subtitle: 'Les dernières pistes arrivées.' },
};

const SOURCE_ICONS = {
    ai: Sparkles,
    pixabay: Waves,
    file: FolderOpen,
    url: Link2,
};

const MOBILE_TABS = [
    { id: 'accueil', label: 'Accueil', icon: Home },
    { id: 'recherche', label: 'Rechercher', icon: Search },
    { id: 'projet', label: 'Bibliothèque', icon: Library },
];

function Row({ title, children, testId }) {
    return (
        <section className={styles.rowBlock} data-testid={testId}>
            <h3 className={styles.rowBlockTitle}>{title}</h3>
            <div className={styles.rail}>{children}</div>
        </section>
    );
}

export default function SoundtrackScreen() {
    const soundtrack = useVibeOsSoundtrack();
    const {
        localLibrary,
        projectLibrary,
        search,
        audio,
        projectTracks,
        localTracks,
        libraryTracks,
        recentImports,
        busy,
        notice,
        setNotice,
        playTrack,
        playList,
        addToLibrary,
        useInVibeCut,
        markImported,
    } = soundtrack;

    const [view, setView] = useState('accueil');
    const [importSource, setImportSource] = useState('');
    const [mobileSources, setMobileSources] = useState(false);
    const [query, setQuery] = useState('');
    const toast = useToast();

    /* Les messages du hook (import, envoi VibeCut, erreurs) passent en toast:
       une seule surface de confirmation pour tout l'ecran. */
    useEffect(() => {
        if (!notice) return;
        toast.push(notice);
        setNotice('');
    }, [notice, setNotice, toast]);

    /*
     * Les toasts sont rendus par le shell, donc AU-DESSUS de cet ecran dans le
     * DOM: une variable posee ici ne remonterait pas. On la pose sur le shell le
     * temps de la visite, pour que les confirmations ne tombent pas pile sur les
     * commandes du lecteur.
     */
    useEffect(() => {
        const shell = document.querySelector('[data-vibeos-shell]');
        if (!shell) return undefined;
        shell.style.setProperty('--vo-toast-offset', '76px');
        return () => shell.style.removeProperty('--vo-toast-offset');
    }, []);

    const currentTrack = useMemo(
        () => libraryTracks.find((track) => track.id === audio.track?.id)
            || search.results.find((track) => track.id === audio.track?.id)
            || null,
        [audio.track?.id, libraryTracks, search.results],
    );

    const libraryTrackIds = useMemo(
        () => new Set(libraryTracks.map((track) => track.id)),
        [libraryTracks],
    );

    const themes = useMemo(() => getSoundtrackProviderQuickTags('openverse').slice(0, 10), []);

    const handleImported = (imported = []) => {
        markImported(imported);
        setImportSource('');
        toast.push(`${imported.length} piste${imported.length > 1 ? 's' : ''} ajoutée${imported.length > 1 ? 's' : ''} à ta bibliothèque.`, { tone: 'success' });
        setView('recents');
    };

    const runSearch = (nextQuery) => {
        const value = String(nextQuery ?? query).trim();
        if (!value) return;
        setView('recherche');
        search.setQuery(value);
        search.search({ query: value, pages: 1 });
    };

    const openSource = (sourceId) => {
        setMobileSources(false);
        setImportSource(sourceId);
    };

    const viewTracks = view === 'projet' ? projectTracks
        : view === 'locale' ? localTracks
        : view === 'recents' ? recentImports
        : [];

    const navButton = (id, label, Icon) => (
        <button
            key={id}
            type="button"
            className={cx(styles.navItem, view === id && styles.navItemActive)}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id)}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className={styles.screen} data-testid="vibeos-soundtrack-screen">
            <aside className={styles.sidebar} aria-label="Navigation Soundtrack">
                <nav className={styles.navGroup}>
                    {navButton('recherche', 'Rechercher', Search)}
                    {navButton('accueil', 'Accueil', Home)}
                </nav>

                <nav className={styles.navGroup}>
                    <p className={styles.navLabel}>Bibliothèque</p>
                    {navButton('projet', 'Pistes du projet', Music2)}
                    {navButton('locale', 'Ma bibliothèque locale', Library)}
                    {navButton('recents', 'Imports récents', Clock3)}
                </nav>

                <nav className={cx(styles.navGroup, styles.navGroupBottom)}>
                    <p className={styles.navLabel}>Sources</p>
                    {IMPORT_SOURCES.map((source) => {
                        const Icon = SOURCE_ICONS[source.id];
                        return (
                            <button
                                key={source.id}
                                type="button"
                                className={styles.navItem}
                                onClick={() => openSource(source.id)}
                                data-testid={`vibeos-soundtrack-source-${source.id}`}
                            >
                                <Icon size={16} />
                                {source.label}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Mobile: la colonne devient une barre d'onglets + un bouton « + ». */}
            <div className={styles.mobileTabs} role="tablist" aria-label="Vues Soundtrack">
                {MOBILE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = tab.id === 'projet'
                        ? ['projet', 'locale', 'recents'].includes(view)
                        : view === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={cx(styles.mobileTab, active && styles.mobileTabActive)}
                            onClick={() => setView(tab.id)}
                        >
                            <Icon size={15} />
                            {tab.label}
                        </button>
                    );
                })}
                <button
                    type="button"
                    className={styles.mobileAdd}
                    aria-label="Ajouter de la musique"
                    onClick={() => setMobileSources(true)}
                >
                    <Plus size={16} />
                </button>
            </div>

            <main className={styles.main}>
                <header className={styles.mainHead}>
                    <div>
                        <h1 className={styles.mainTitle}>{VIEWS[view].title}</h1>
                        <p className={styles.mainSubtitle}>{VIEWS[view].subtitle}</p>
                    </div>
                </header>

                {view === 'recherche' ? (
                    <div className={styles.searchBlock}>
                        <SearchField
                            value={query}
                            onChange={setQuery}
                            onClear={() => setQuery('')}
                            loading={search.status === 'loading'}
                            placeholder="Une ambiance, un instrument, un style…"
                            label="Rechercher une musique"
                            className={styles.searchField}
                            data-testid="vibeos-soundtrack-search"
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') runSearch();
                            }}
                        />
                        <div className={styles.chips} aria-label="Thèmes rapides">
                            {themes.map((theme) => (
                                <button
                                    key={theme.id}
                                    type="button"
                                    className={styles.chip}
                                    data-active={search.category === theme.id}
                                    onClick={() => {
                                        setQuery(theme.query);
                                        setView('recherche');
                                        search.scanCategory(theme);
                                    }}
                                >
                                    {theme.label}
                                </button>
                            ))}
                        </div>

                        {search.status === 'loading' ? (
                            <div className={styles.loading}><Spinner label="Recherche en cours" /> Recherche en cours…</div>
                        ) : search.results.length ? (
                            <TrackList
                                tracks={search.results}
                                numbered={false}
                                currentTrackId={audio.track?.id || ''}
                                isPlaying={audio.isPlaying}
                                busyId={busy}
                                inLibrary={false}
                                onPlay={playTrack}
                                onAdd={(track) => (libraryTrackIds.has(track.id) ? null : addToLibrary(track))}
                                onUseInVideo={useInVibeCut}
                                testId="vibeos-soundtrack-results"
                            />
                        ) : (
                            <EmptyState
                                icon={<Search size={20} />}
                                title={search.error ? 'La recherche n’a rien renvoyé' : 'Cherche une ambiance'}
                            >
                                {search.error
                                    ? search.error
                                    : 'Tape un mot (« cinématique », « lofi », « piano ») ou choisis un thème ci-dessus.'}
                            </EmptyState>
                        )}
                    </div>
                ) : null}

                {view === 'accueil' ? (
                    <div className={styles.home}>
                        {audio.track ? (
                            <Row title="Reprendre l'écoute" testId="vibeos-soundtrack-resume">
                                {currentTrack ? (
                                    <TrackCard
                                        track={currentTrack}
                                        playing
                                        isPlaying={audio.isPlaying}
                                        onPlay={playTrack}
                                    />
                                ) : null}
                            </Row>
                        ) : null}

                        {projectTracks.length ? (
                            <Row title="Dans ce projet" testId="vibeos-soundtrack-project-row">
                                {projectTracks.slice(0, 10).map((track) => (
                                    <TrackCard
                                        key={track.id}
                                        track={track}
                                        playing={audio.track?.id === track.id}
                                        isPlaying={audio.isPlaying}
                                        onPlay={playTrack}
                                    />
                                ))}
                            </Row>
                        ) : null}

                        {recentImports.length ? (
                            <Row title="Importées récemment" testId="vibeos-soundtrack-recent-row">
                                {recentImports.map((track) => (
                                    <TrackCard
                                        key={track.id}
                                        track={track}
                                        playing={audio.track?.id === track.id}
                                        isPlaying={audio.isPlaying}
                                        onPlay={playTrack}
                                    />
                                ))}
                            </Row>
                        ) : null}

                        <Row title="Explorer par thème" testId="vibeos-soundtrack-themes">
                            {themes.map((theme, index) => (
                                <button
                                    key={theme.id}
                                    type="button"
                                    className={styles.themeCard}
                                    style={{ '--vo-art-hue': (index * 37) % 360 }}
                                    onClick={() => {
                                        setQuery(theme.query);
                                        setView('recherche');
                                        search.scanCategory(theme);
                                    }}
                                >
                                    {theme.label}
                                </button>
                            ))}
                        </Row>

                        {!libraryTracks.length ? (
                            <EmptyState
                                icon={<Music2 size={20} />}
                                title="Ta bibliothèque est vide"
                                action={(
                                    <Button variant="primary" icon={<Sparkles size={14} />} onClick={() => openSource('ai')}>
                                        Importer de la musique
                                    </Button>
                                )}
                            >
                                Importe quelques pistes gratuites : elles resteront disponibles dans
                                tous tes projets, et la lecture continue quand tu changes de page.
                            </EmptyState>
                        ) : null}
                    </div>
                ) : null}

                {['projet', 'locale', 'recents'].includes(view) ? (
                    <div className={styles.playlist}>
                        <header className={styles.playlistHead}>
                            <ArtworkMosaic tracks={viewTracks} />
                            <div className={styles.playlistMeta}>
                                <p className={styles.playlistKicker}>Bibliothèque</p>
                                <h2 className={styles.playlistTitle}>{VIEWS[view].title}</h2>
                                <p className={styles.playlistCount}>
                                    <span data-numeric>{viewTracks.length}</span>
                                    {` piste${viewTracks.length > 1 ? 's' : ''}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                className={styles.playlistPlay}
                                onClick={() => playList(viewTracks)}
                                disabled={!viewTracks.length}
                                aria-label={`Lire ${VIEWS[view].title}`}
                                data-testid="vibeos-soundtrack-playlist-play"
                            >
                                <Play size={20} />
                            </button>
                        </header>

                        {viewTracks.length ? (
                            <TrackList
                                tracks={viewTracks}
                                currentTrackId={audio.track?.id || ''}
                                isPlaying={audio.isPlaying}
                                busyId={busy}
                                onPlay={playTrack}
                                onUseInVideo={useInVibeCut}
                                testId="vibeos-soundtrack-list"
                            />
                        ) : (
                            <EmptyState
                                icon={<Library size={20} />}
                                title="Rien ici pour l'instant"
                                action={(
                                    <Button variant="primary" icon={<Plus size={14} />} onClick={() => openSource('ai')}>
                                        Ajouter de la musique
                                    </Button>
                                )}
                            >
                                {view === 'projet'
                                    ? 'Les pistes que tu gardes pour ce projet apparaîtront ici.'
                                    : view === 'locale'
                                        ? 'Importe des fichiers ou connecte un dossier pour les retrouver ici.'
                                        : 'Tes derniers imports s’afficheront ici.'}
                            </EmptyState>
                        )}
                    </div>
                ) : null}
            </main>

            <PlayerBar audio={audio} currentTrack={currentTrack} onUseInVideo={useInVibeCut} />

            {importSource ? (
                <ImportSheet
                    source={importSource}
                    onClose={() => setImportSource('')}
                    localLibrary={localLibrary}
                    projectLibrary={projectLibrary}
                    onImported={handleImported}
                />
            ) : null}

            <Sheet open={mobileSources} onClose={() => setMobileSources(false)} title="Ajouter de la musique">
                <div className={styles.sourceList}>
                    {IMPORT_SOURCES.map((source) => {
                        const Icon = SOURCE_ICONS[source.id];
                        return (
                            <button
                                key={source.id}
                                type="button"
                                className={styles.sourceItem}
                                onClick={() => openSource(source.id)}
                            >
                                <Icon size={16} />
                                {source.title}
                            </button>
                        );
                    })}
                </div>
            </Sheet>
        </div>
    );
}
