"use client";

import React, { useEffect, useState } from 'react';
import { Search, Star, X } from 'lucide-react';
import styles from './library.module.css';

/*
 * Barre de filtres - lot B1.
 *
 * Les familles sont une BARRE HORIZONTALE, pas un rail lateral. Un rail a
 * gauche aurait fait un second systeme de navigation a cote du bandeau VibeCut,
 * ce que `plan.md` § 4.4 interdit explicitement - et c'est justement ce qu'on a
 * rejete de la capture de reference.
 *
 * Sous 720 px, les familles deviennent un menu deroulant: une rangee de huit
 * pastilles sur un telephone se lit mal et deborde. On rend l'UN OU L'AUTRE,
 * jamais les deux - deux jeux de commandes pour la meme fonction donneraient
 * des libelles d'accessibilite en double (plan.md § 4.6).
 */

const NARROW_QUERY = '(max-width: 720px)';

function useNarrow() {
    const [narrow, setNarrow] = useState(false);
    useEffect(() => {
        if (!window.matchMedia) return undefined;
        const media = window.matchMedia(NARROW_QUERY);
        const sync = () => setNarrow(media.matches);
        sync();
        media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);
    return narrow;
}

export default function LibraryFilterBar({
    query,
    onQueryChange,
    groups = [],
    activeGroup = 'all',
    onGroupChange,
    favoriteCount = 0,
    extraFilter = null,
    resultCount = 0,
    totalCount = 0,
    testId = 'vibecut-library-filters',
}) {
    const narrow = useNarrow();

    /*
     * « Favoris » n'est pas une famille: c'est un filtre transversal. Il est
     * dans la meme rangee parce qu'il repond a la meme question - « montre-moi
     * moins de choses » - mais il est separe par un trait.
     */
    const options = [
        { id: 'all', label: 'Toutes' },
        ...groups.map((group) => ({ id: group.id, label: group.label })),
    ];

    return (
        <div className={styles.filters} data-testid={testId}>
            <div className={styles.searchField}>
                <Search size={14} className={styles.searchIcon} aria-hidden="true" />
                <input
                    type="search"
                    className={styles.searchInput}
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Rechercher"
                    aria-label="Rechercher dans la bibliothèque"
                    data-testid={`${testId}-search`}
                />
                {query ? (
                    <button
                        type="button"
                        className={styles.searchClear}
                        aria-label="Effacer la recherche"
                        onClick={() => onQueryChange('')}
                        data-testid={`${testId}-clear`}
                    >
                        <X size={13} />
                    </button>
                ) : null}
            </div>

            {narrow ? (
                <select
                    className={styles.filterSelect}
                    value={activeGroup}
                    onChange={(event) => onGroupChange(event.target.value)}
                    aria-label="Famille affichée"
                    data-testid={`${testId}-group-select`}
                >
                    {options.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                    <option value="favorites">★ Favoris ({favoriteCount})</option>
                    {extraFilter ? (
                        <option value={extraFilter.id}>{extraFilter.label}</option>
                    ) : null}
                </select>
            ) : (
                <>
                    {/*
                      * Seules les FAMILLES defilent. « Favoris » et le compteur
                      * restent dehors: un filtre qu'on doit aller chercher en
                      * faisant defiler une rangee est un filtre qu'on n'utilise
                      * pas - et c'etait le cas au premier jet.
                      */}
                    <div className={styles.filterChips} role="group" aria-label="Filtrer par famille">
                        {options.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                className={[
                                    styles.filterChip,
                                    activeGroup === option.id ? styles.filterChipActive : '',
                                ].filter(Boolean).join(' ')}
                                aria-pressed={activeGroup === option.id}
                                onClick={() => onGroupChange(option.id)}
                                data-testid={`${testId}-group-${option.id}`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <span className={styles.filterDivider} aria-hidden="true" />
                    <button
                        type="button"
                        className={[
                            styles.filterChip,
                            styles.filterChipStar,
                            activeGroup === 'favorites' ? styles.filterChipActive : '',
                        ].filter(Boolean).join(' ')}
                        aria-pressed={activeGroup === 'favorites'}
                        onClick={() => onGroupChange('favorites')}
                        data-testid={`${testId}-group-favorites`}
                    >
                        <Star size={12} fill={favoriteCount > 0 ? 'currentColor' : 'none'} />
                        Favoris
                        {favoriteCount > 0 ? <span className={styles.filterCount}>{favoriteCount}</span> : null}
                    </button>
                    {extraFilter ? (
                        <button
                            type="button"
                            className={[
                                styles.filterChip,
                                activeGroup === extraFilter.id ? styles.filterChipActive : '',
                            ].filter(Boolean).join(' ')}
                            aria-pressed={activeGroup === extraFilter.id}
                            title={extraFilter.hint}
                            onClick={() => onGroupChange(extraFilter.id)}
                            data-testid={`${testId}-group-${extraFilter.id}`}
                        >
                            {extraFilter.label}
                        </button>
                    ) : null}
                </>
            )}

            {/* Un « 38 sur 38 » permanent serait du bruit: on ne compte que
              * quand la grille est reellement reduite. */}
            <p className={styles.filterResult} role="status" data-testid={`${testId}-count`}>
                {resultCount === totalCount ? `${totalCount}` : `${resultCount} sur ${totalCount}`}
            </p>
        </div>
    );
}
