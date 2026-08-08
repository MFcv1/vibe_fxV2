"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';
import { Button, EmptyState } from '../primitives';
import useFavorites from '../adapters/useFavorites';
import LibraryCard from './LibraryCard';
import LibraryFilterBar from './LibraryFilterBar';
import styles from './library.module.css';

/*
 * Ossature commune aux DEUX bibliotheques - lot B1.
 *
 * Avant ce lot, `/video/transitions` et `/video/mouvements` etaient deux ecrans
 * ecrits en parallele, avec le meme en-tete, la meme grille et le meme panneau,
 * dupliques. Ils auraient diverge des la premiere retouche. Ici l'ossature est
 * UNE, et les deux ecrans ne fournissent plus que:
 *
 *   - leurs donnees (entrees decorees de leur statut serveur reel),
 *   - la facon de dessiner une vignette (toujours par le moteur),
 *   - le contenu de leur panneau de reglages.
 *
 * DIRECTION ARTISTIQUE (plan.md § 4): le chassis est DISCRET et laisse les
 * apercus prendre la place. C'est l'ecran ou cette regle joue le plus en notre
 * faveur - ici le contenu, ce sont les animations elles-memes.
 */

/* Recherche insensible aux accents: « fondu desature » doit trouver « désaturé ». */
function fold(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export default function LibraryScreen({
    testId,
    kind,
    /*
     * LOT B2 - quel ETAGE de media alimente les vignettes: `video` (rush du
     * projet), `mixed`, `photo`, `demo` (clips de demonstration) ou `drawn`
     * (repli dessine).
     *
     * Ecrit dans le DOM parce que c'est la SEULE chose qui distingue une
     * bibliotheque vivante d'une bibliotheque retombee sur son dessin. Sans cet
     * attribut, la chaine de repli pourrait se casser et TOUS les tests
     * continueraient de passer: les vignettes bougent de toute facon, c'est la
     * transition qui les anime.
     */
    mediaKind,
    title,
    subtitle,
    backHref,
    groups = [],
    entries = [],
    selectedId,
    onSelect,
    renderCardPreview,
    cardTestId,
    stage = null,
    panel = null,
    contextStrip = null,
    panelLabel = 'Réglages',
    /*
     * Filtre transversal propre a l'ecran (en plus des familles et des favoris).
     * Les transitions s'en servent pour « Rendues à l'export »: c'est la question
     * la plus utile de cet ecran-la, puisque 23 des 38 entrees se degradent en
     * fondu au rendu final.
     */
    extraFilter = null,
    /*
     * Les entrees marquees `deferred` sortent des familles et vont dans une
     * section a part, EN BAS. Sur la bibliotheque de mouvements, sept des treize
     * entrees sont annoncees et non rendues: les laisser au milieu de la grille
     * revenait a donner la moitie de l'ecran a ce qui n'existe pas.
     */
    deferredLabel = 'Bientôt disponibles',
    deferredHint = null,
}) {
    const [query, setQuery] = useState('');
    const [activeGroup, setActiveGroup] = useState('all');
    const { favorites, isFavorite, toggle, count } = useFavorites(kind);

    const matching = useMemo(() => {
        const needle = fold(query).trim();
        if (!needle) return entries;
        return entries.filter((entry) => fold(`${entry.name} ${entry.description}`).includes(needle));
    }, [entries, query]);

    const visible = useMemo(() => {
        if (activeGroup === 'favorites') return matching.filter((entry) => favorites.includes(entry.id));
        if (extraFilter && activeGroup === extraFilter.id) return matching.filter(extraFilter.test);
        if (activeGroup === 'all') return matching;
        return matching.filter((entry) => entry.group === activeGroup);
    }, [activeGroup, extraFilter, favorites, matching]);

    /*
     * Trois regles d'ordre, et chacune repond a une question posee a l'usage:
     *
     *  1. LES FAVORIS EN TETE quand on regarde tout. C'est la moitie du besoin
     *     exprime: on juge une fois ici, on retrouve ses preferes partout.
     *  2. LES ENTREES ANNONCEES EN BAS, dans leur propre section. Melangees aux
     *     autres, elles donnaient a la bibliotheque de mouvements l'air d'un
     *     catalogue a moitie vide.
     *  3. Le reste suit l'ordre des familles.
     */
    const sections = useMemo(() => {
        const ready = visible.filter((entry) => !entry.deferred);
        const deferred = visible.filter((entry) => entry.deferred);
        const tail = deferred.length > 0
            ? [{ id: 'deferred', label: deferredLabel, hint: deferredHint, entries: deferred, muted: true }]
            : [];

        if (activeGroup === 'favorites') {
            return [{ id: 'favorites', label: 'Tes favoris', hint: null, entries: visible }];
        }
        if (activeGroup !== 'all') {
            const group = groups.find((entry) => entry.id === activeGroup);
            const label = group?.label
                || (extraFilter && activeGroup === extraFilter.id ? extraFilter.label : 'Résultats');
            return [
                ...(ready.length > 0
                    ? [{ id: activeGroup, label, hint: group?.hint || null, entries: ready }]
                    : []),
                ...tail,
            ];
        }

        const favoriteEntries = ready.filter((entry) => favorites.includes(entry.id));
        const byGroup = groups
            .map((group) => ({
                id: group.id,
                label: group.label,
                hint: group.hint || null,
                entries: ready.filter((entry) => entry.group === group.id),
            }))
            .filter((group) => group.entries.length > 0);
        return [
            ...(favoriteEntries.length > 0
                ? [{
                    id: 'favorites',
                    label: 'Tes favoris',
                    hint: 'Retrouvés en tête de liste dans les deux modes de montage.',
                    entries: favoriteEntries,
                }]
                : []),
            ...byGroup,
            ...tail,
        ];
    }, [activeGroup, deferredHint, deferredLabel, extraFilter, favorites, groups, visible]);

    let cardIndex = -1;

    return (
        <div className={styles.screen} data-testid={testId} data-media-kind={mediaKind}>
            <header className={styles.screenHead}>
                <div className={styles.screenTitles}>
                    <h1 className={styles.screenTitle}>{title}</h1>
                    <p className={styles.screenSubtitle}>{subtitle}</p>
                </div>
                <Link href={backHref} className={styles.screenAction} data-testid="vibecut-library-to-quick">
                    Retour au montage <ArrowRight size={15} />
                </Link>
            </header>

            <LibraryFilterBar
                query={query}
                onQueryChange={setQuery}
                groups={groups}
                activeGroup={activeGroup}
                onGroupChange={setActiveGroup}
                favoriteCount={count}
                extraFilter={extraFilter}
                resultCount={visible.length}
                totalCount={entries.length}
            />

            <div className={styles.body}>
                <div className={styles.catalog} data-testid={`${testId}-catalog`}>
                    {visible.length === 0 ? (
                        /*
                         * « Aucun resultat » dit QUOI FAIRE, et le bouton agit
                         * vraiment: un etat vide qui se contente de constater est
                         * une impasse.
                         */
                        <EmptyState
                            icon={<Star size={20} />}
                            title="Aucun résultat"
                            action={(
                                <Button
                                    variant="secondary"
                                    onClick={() => { setQuery(''); setActiveGroup('all'); }}
                                    data-testid={`${testId}-reset-filters`}
                                >
                                    Tout afficher
                                </Button>
                            )}
                        >
                            {activeGroup === 'favorites' && count === 0
                                ? 'Tu n’as encore mis aucun favori. Touche l’étoile d’une vignette : tu la retrouveras ici, et en tête de liste dans les deux modes de montage.'
                                : 'Aucune entrée ne correspond à cette recherche dans cette famille.'}
                        </EmptyState>
                    ) : sections.map((section) => (
                        <section
                            key={section.id}
                            className={[styles.group, section.muted ? styles.groupMuted : ''].filter(Boolean).join(' ')}
                            aria-labelledby={`${testId}-section-${section.id}`}
                            data-testid={`${testId}-section-${section.id}`}
                        >
                            <div className={styles.groupHead}>
                                <h2 className={styles.groupTitle} id={`${testId}-section-${section.id}`}>
                                    {section.label}
                                </h2>
                                {section.hint ? <p className={styles.groupHint}>{section.hint}</p> : null}
                            </div>
                            <div className={styles.cardGrid}>
                                {section.entries.map((entry) => {
                                    cardIndex += 1;
                                    return (
                                        <LibraryCard
                                            key={`${section.id}-${entry.id}`}
                                            entry={entry}
                                            index={cardIndex}
                                            peak={entry.peak}
                                            selected={entry.id === selectedId}
                                            favorite={isFavorite(entry.id)}
                                            onSelect={onSelect}
                                            onToggleFavorite={toggle}
                                            controlKey={`${kind}:${entry.id}`}
                                            renderPreview={(controlKey) => renderCardPreview(entry, controlKey)}
                                            testId={cardTestId?.(entry)}
                                        />
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>

                <aside className={styles.panel} aria-label={panelLabel}>
                    {stage}
                    {panel}
                    {contextStrip}
                </aside>
            </div>
        </div>
    );
}
