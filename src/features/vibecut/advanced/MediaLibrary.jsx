"use client";

import React, { useMemo, useState } from 'react';
import { Film, ImageIcon, ImagePlus, Music, Search } from 'lucide-react';
import { Button, EmptyState } from '../primitives';
import styles from './advanced.module.css';

/*
 * Bibliotheque de medias du projet.
 *
 * Elle montre ce que le projet contient REELLEMENT: les medias importes, dans
 * l'ordre du montage, plus les musiques. Il n'existe pas de reserve separee de
 * la timeline dans le modele - inventer une bibliotheque «hors montage» ici
 * afficherait des medias que l'export ne connaitrait pas.
 */

const SORTS = [
    { value: 'timeline', label: 'Ordre du montage' },
    { value: 'name', label: 'Nom' },
    { value: 'duration', label: 'Durée' },
];

function formatDuration(seconds = 0) {
    const safe = Math.max(0, Number(seconds) || 0);
    return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
}

export default function MediaLibrary({ entries = [], onSelect, onImport, isImporting = false }) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('timeline');

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const filtered = needle
            ? entries.filter((entry) => entry.name.toLowerCase().includes(needle))
            : entries;
        const sorted = [...filtered];
        if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        if (sort === 'duration') sorted.sort((a, b) => b.duration - a.duration);
        return sorted;
    }, [entries, query, sort]);

    return (
        <aside className={styles.library} data-testid="vibecut-media-library" aria-label="Bibliothèque de médias">
            <div className={styles.libraryHead}>
                <h2 className={styles.panelTitle}>Médias</h2>
                <Button
                    size="sm"
                    icon={<ImagePlus size={15} />}
                    onClick={onImport}
                    disabled={isImporting}
                    data-testid="vibecut-library-import"
                >
                    Importer
                </Button>
            </div>

            <div className={styles.libraryFilters}>
                <label className={styles.searchField}>
                    <Search size={14} aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Rechercher un média"
                        aria-label="Rechercher un média"
                        data-testid="vibecut-library-search"
                    />
                </label>
                <label className={styles.sortField}>
                    <span className="vibecut-visually-hidden">Trier les médias</span>
                    <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value)}
                        aria-label="Trier les médias"
                        data-testid="vibecut-library-sort"
                    >
                        {SORTS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div className={styles.libraryList} data-testid="vibecut-library-list">
                {visible.length === 0 ? (
                    <EmptyState
                        title={entries.length === 0 ? 'Aucun média' : 'Aucun résultat'}
                        action={entries.length === 0 ? (
                            <Button variant="primary" size="sm" icon={<ImagePlus size={15} />} onClick={onImport}>
                                Choisir des médias
                            </Button>
                        ) : null}
                    >
                        {entries.length === 0
                            ? 'Importe des photos, des vidéos ou une musique pour commencer.'
                            : 'Aucun média ne porte ce nom.'}
                    </EmptyState>
                ) : visible.map((entry, index) => (
                    <button
                        key={entry.id}
                        type="button"
                        className={styles.libraryItem}
                        onClick={() => onSelect?.(entry)}
                        data-selected={entry.selected ? 'true' : 'false'}
                        data-testid={`vibecut-library-item-${index}`}
                    >
                        <span className={styles.libraryThumb} data-kind={entry.kind}>
                            {entry.thumbnail ? (
                                <img src={entry.thumbnail} alt="" />
                            ) : entry.kind === 'audio' ? (
                                <Music size={16} />
                            ) : entry.kind === 'image' ? (
                                <ImageIcon size={16} />
                            ) : (
                                <Film size={16} />
                            )}
                        </span>
                        <span className={styles.libraryMeta}>
                            <span className={styles.libraryName}>{entry.name}</span>
                            <span className={styles.libraryDetail} data-numeric="true">
                                {formatDuration(entry.duration)}
                            </span>
                        </span>
                    </button>
                ))}
            </div>
        </aside>
    );
}
