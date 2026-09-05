'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Music2, Pause, Play, Search } from 'lucide-react';
import { useVibeOsAudio } from '../audio/AudioProvider';
import { EmptyState, IconButton, SearchField, Spinner } from '../primitives';
import styles from './layout.module.css';

/*
 * Colonne droite de l'apercu immersif: choisir une ambiance sans quitter la vue.
 *
 * La source est le catalogue maison sous licence CC BY 4.0 (route
 * /api/music/catalogue, constitue par scripts/moisson-musique-cc.mjs). Ce n'est
 * pas un choix esthetique: aucune API musique gratuite n'autorise l'usage
 * commercial, une licence CC-BY si - et elle est irrevocable.
 *
 * Contrepartie: l'attribution est OBLIGATOIRE. Le bloc artiste en bas de
 * colonne et le champ `attribution` de la piste ne sont pas decoratifs, ils
 * sont la contrepartie du droit d'usage. Ne pas les retirer.
 *
 * La lecture passe par le lecteur global (VibeOsAudioProvider): une piste
 * lancee ici continue quand on referme l'apercu et se retrouve dans le
 * MiniPlayer du bandeau.
 */

/* Les visuels de l'artiste sont des bandeaux 700x329 avec le titre au centre.
   Les recadrer en carre tombe sur le cartouche pale et donne une vignette
   blanche: on garde donc le format large, qui montre l'illustration entiere. */
function Pochette({ piste, largeur = 64, hauteur = 36 }) {
    const [rate, setRate] = useState(false);
    if (!piste?.pochetteUrl || rate) {
        return (
            <span className={styles.soundArtFallback} style={{ width: largeur, height: hauteur }} aria-hidden="true">
                <Music2 size={Math.max(12, Math.round(hauteur * 0.5))} />
            </span>
        );
    }
    return (
        <img
            className={styles.soundArt}
            style={{ width: largeur, height: hauteur }}
            src={piste.pochetteUrl}
            alt=""
            loading="lazy"
            onError={() => setRate(true)}
        />
    );
}

function SoundRow({ piste, playing, isPlaying, onPlay }) {
    const tags = [...piste.ambiances, ...piste.instruments].slice(0, 3).join(' · ');
    return (
        <button
            type="button"
            className={styles.soundRow}
            data-active={playing}
            onClick={() => onPlay(piste)}
            aria-label={playing && isPlaying ? `Mettre en pause ${piste.titre}` : `Lire ${piste.titre}`}
        >
            <span className={styles.soundRowArt}>
                <Pochette piste={piste} />
                <span className={styles.soundRowArtIcon}>
                    {playing && isPlaying ? <Pause size={13} /> : <Play size={13} />}
                </span>
            </span>
            <span className={styles.soundRowMain}>
                <span className={styles.soundRowTitle}>{piste.titre}</span>
                <span className={styles.soundRowArtist}>{tags || piste.artiste}</span>
            </span>
        </button>
    );
}

/* `onPisteJouee` remonte la piste complete a l'apercu: le lecteur global ne
   retient que titre/artiste/pochette, la barre du mode ecoute a besoin de la
   fiche entiere. */
export default function PreviewSoundPanel({ onPisteJouee }) {
    const audio = useVibeOsAudio();
    const [categorie, setCategorie] = useState('cinematique');
    const [query, setQuery] = useState('');
    const listeRef = useRef(null);

    /* Une seule cle decrit ce qui doit etre affiche. L'etat charge porte la
       cle qu'il represente: le chargement se DEDUIT de l'ecart entre les deux,
       plutot que d'etre pose par un setState synchrone dans l'effet. */
    const cle = query.trim() ? `q:${query.trim()}` : `c:${categorie}`;
    const [etat, setEtat] = useState({
        cle: null, categories: [], pistes: [], source: null, erreur: '',
    });
    const chargement = etat.cle !== cle;
    const donnees = etat;
    const erreur = etat.erreur;

    /* Les pistes du catalogue portent leur URL: le resolveur du lecteur global
       n'a qu'a la rendre. Il reste en place apres fermeture, ce qui est sans
       effet - l'ecran Soundtrack repose le sien a son montage. */
    useEffect(() => {
        audio.setSourceResolver(async (entry) => entry?.src || '');
    }, [audio]);

    useEffect(() => {
        const controleur = new AbortController();
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        else if (categorie) params.set('categorie', categorie);

        fetch(`/api/music/catalogue?${params}`, { signal: controleur.signal })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Catalogue indisponible.'))))
            .then((payload) => {
                setEtat({ cle, ...payload, erreur: '' });
                if (listeRef.current) listeRef.current.scrollTop = 0;
            })
            .catch((error) => {
                if (error.name === 'AbortError') return;
                setEtat((courant) => ({ ...courant, cle, pistes: [], erreur: error.message }));
            });

        return () => controleur.abort();
    }, [categorie, cle, query]);

    /* La file suit ce qui est affiche: l'enchainement automatique reste dans
       l'ambiance qu'on vient de choisir. */
    const entrees = useMemo(() => donnees.pistes.map((p) => ({
        id: p.id,
        title: p.titre,
        artist: p.artiste,
        artworkUrl: p.pochetteUrl,
        src: p.audioUrl,
    })), [donnees.pistes]);

    useEffect(() => {
        audio.setQueue(entrees);
    }, [audio, entrees]);

    const lire = useCallback((piste) => {
        onPisteJouee?.(piste);
        if (audio.track?.id === piste.id && audio.status !== 'error') {
            audio.toggle();
            return;
        }
        audio.playTrack({
            id: piste.id,
            title: piste.titre,
            artist: piste.artiste,
            artworkUrl: piste.pochetteUrl,
            src: piste.audioUrl,
        });
    }, [audio, onPisteJouee]);

    const source = donnees.source;
    const enCours = audio.track;
    const pisteEnCours = donnees.pistes.find((p) => p.id === enCours?.id);

    return (
        <aside className={styles.soundPanel} aria-label="Ambiance sonore">
            <div className={styles.soundPanelBody}>
                <SearchField
                    value={query}
                    onChange={setQuery}
                    onClear={() => setQuery('')}
                    loading={chargement}
                    placeholder="Un titre, une ambiance, un instrument…"
                    label="Chercher une musique"
                    data-testid="vibeos-preview-sound-search"
                />

                <div className={styles.soundChips} aria-label="Ambiances">
                    {donnees.categories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            className={styles.soundChip}
                            data-active={!query.trim() && categorie === cat.id}
                            title={cat.resume}
                            onClick={() => { setQuery(''); setCategorie(cat.id); }}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div className={styles.soundResults} ref={listeRef}>
                    {chargement && !donnees.pistes.length ? (
                        <div className={styles.soundLoading}><Spinner label="Chargement" /> Chargement…</div>
                    ) : erreur ? (
                        <EmptyState icon={<Search size={18} />} title="Catalogue indisponible">{erreur}</EmptyState>
                    ) : donnees.pistes.length ? (
                        donnees.pistes.map((piste) => (
                            <SoundRow
                                key={piste.id}
                                piste={piste}
                                playing={enCours?.id === piste.id}
                                isPlaying={audio.isPlaying}
                                onPlay={lire}
                            />
                        ))
                    ) : (
                        <EmptyState icon={<Search size={18} />} title="Rien sous ce mot">
                            Essaie une ambiance : « épique », « piano », « nostalgique ».
                        </EmptyState>
                    )}
                </div>
            </div>

            {enCours ? (
                <div className={styles.soundNowPlaying} data-testid="vibeos-preview-now-playing">
                    <Pochette piste={pisteEnCours || { pochetteUrl: enCours.artworkUrl }} largeur={56} hauteur={32} />
                    <span className={styles.soundNowMain}>
                        <span className={styles.soundNowTitle}>{enCours.title}</span>
                        <span className={styles.soundNowArtist}>
                            {enCours.artist}
                            {source ? <> · <a href={source.soutien} target="_blank" rel="noopener noreferrer">le soutenir</a></> : null}
                        </span>
                    </span>
                    <IconButton label={audio.isPlaying ? 'Mettre en pause' : 'Lire'} onClick={audio.toggle}>
                        {audio.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </IconButton>
                </div>
            ) : source ? (
                /* Attribution CC BY 4.0: c'est la contrepartie du droit d'usage,
                   pas une mention decorative. */
                <p className={styles.soundHint}>
                    <Music2 size={13} aria-hidden="true" />
                    <span>
                        Musique de <a href={source.site} target="_blank" rel="noopener noreferrer">{source.artiste}</a>
                        {' '}—{' '}
                        <a href={source.licenceUrl} target="_blank" rel="noopener noreferrer">{source.licence}</a>
                        , libre même en usage commercial.
                    </span>
                    <ExternalLink size={11} aria-hidden="true" />
                </p>
            ) : null}
        </aside>
    );
}
