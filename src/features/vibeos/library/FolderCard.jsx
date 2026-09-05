"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Check, CloudOff, Cloud, FolderPlus, Heart, Laptop, Pencil, Trash2 } from 'lucide-react';
import { formatBytes } from './libraryDb';
import { thumbUrl } from './useLibrary';
import { FOLDER_NAME_MAX } from './folderNaming';
import styles from './library.module.css';

/*
 * Une carte de dossier.
 *
 * Le dessin dit ce qu'il y a dedans: les photos sont glissees dans une POCHE
 * translucide, comme des tirages dans une pochette. Trois epaisseurs au plus -
 * au-dela l'oeil ne compte plus, il voit juste du desordre - et la couverture
 * devant. Au survol, la pile s'ouvre legerement: c'est le seul mouvement, et il
 * ne touche que `transform`, donc il reste fluide meme avec cinquante dossiers
 * a l'ecran.
 *
 * Le nom se renomme sur place, comme sur un bureau: un clic sur le crayon, on
 * tape, Entree valide, Echap annule.
 *
 * Un dossier de TRI se lit d'un coup d'oeil comme different: sa poche est
 * hachuree, il porte "Sur cet appareil" au lieu de l'etat de sauvegarde, et sa
 * ligne de stats compte les photos gardees plutot que le poids. Rien de tout
 * cela n'est decoratif: c'est ce qui empeche de croire qu'un tri en cours est
 * une collection sauvegardee.
 */
const FolderCard = React.memo(function FolderCard({
    folder, position, revealer, onOpen, onRename, onDelete,
}) {
    const nodeRef = useRef(null);
    const inputRef = useRef(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(folder.name);

    useEffect(() => {
        const node = nodeRef.current;
        if (!node) return undefined;
        if (!revealer) {
            node.dataset.in = 'true';
            return undefined;
        }
        revealer.observe(node);
        return () => revealer.unobserve(node);
    }, [revealer]);

    useEffect(() => {
        if (!editing) return;
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [editing]);

    const startRename = () => {
        setDraft(folder.name);
        setEditing(true);
    };

    const commit = () => {
        setEditing(false);
        if (draft.trim() && draft.trim() !== folder.name) onRename(folder.id, draft);
    };

    const covers = folder.covers || [];
    const empty = covers.length === 0;

    return (
        <article
            ref={nodeRef}
            className={styles.folderCard}
            data-position={position}
            data-testid="vibeos-library-folder"
            data-folder-id={folder.id}
            data-scout={folder.scout ? 'true' : 'false'}
        >
            <button
                type="button"
                className={styles.folderOpen}
                onClick={() => onOpen(folder.id)}
                onDoubleClick={() => onOpen(folder.id)}
                aria-label={`Ouvrir le dossier ${folder.name}, ${folder.count} photo${folder.count > 1 ? 's' : ''}`}
            >
                <span className={styles.folderStack} aria-hidden="true">
                    {/* Le dos du dossier et son onglet: c'est cette couche, et
                        elle seule, qui fait lire "dossier" avant tout le reste. */}
                    <span className={styles.folderBack} />
                    {/* Les epaisseurs du dessous, de la plus lointaine a la plus
                        proche: elles ne sont la que pour donner l'epaisseur. */}
                    {covers.slice(1).reverse().map((photo, depth) => (
                        <span
                            key={photo.id}
                            className={styles.folderSheet}
                            data-depth={covers.length - 1 - depth}
                            style={{ backgroundImage: `url(${thumbUrl(photo)})` }}
                        />
                    ))}
                    {empty ? (
                        <span className={styles.folderEmpty}><FolderPlus size={22} /></span>
                    ) : (
                        <span
                            className={styles.folderCover}
                            style={{ backgroundImage: `url(${thumbUrl(covers[0])})` }}
                        />
                    )}
                    {/* La poche: c'est elle qui fait lire "dossier" et pas
                        "photo". Elle porte le compteur, comme une etiquette. */}
                    <span className={styles.folderPocket}>
                        <span className={styles.folderPocketCount} data-numeric>{folder.count}</span>
                    </span>
                    <span className={styles.folderGloss} />
                </span>
            </button>

            <div className={styles.folderMeta}>
                {editing ? (
                    <input
                        ref={inputRef}
                        className={styles.folderNameInput}
                        value={draft}
                        maxLength={FOLDER_NAME_MAX}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={commit}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') { event.preventDefault(); commit(); }
                            if (event.key === 'Escape') { event.preventDefault(); setEditing(false); }
                        }}
                        aria-label={`Renommer ${folder.name}`}
                    />
                ) : (
                    <h3 className={styles.folderName} title={folder.name}>{folder.name}</h3>
                )}
                <p className={styles.folderStats} data-numeric>
                    {folder.count} photo{folder.count > 1 ? 's' : ''}
                    {folder.scout
                        ? ` · ${folder.favoriteCount || 0} gardée${(folder.favoriteCount || 0) > 1 ? 's' : ''}`
                        : folder.count ? ` · ${formatBytes(folder.bytes)}` : ''}
                </p>
            </div>

            <div className={styles.folderTools}>
                <button
                    type="button"
                    className={styles.folderTool}
                    onClick={startRename}
                    aria-label={`Renommer ${folder.name}`}
                    title="Renommer"
                >
                    <Pencil size={13} />
                </button>
                <button
                    type="button"
                    className={styles.folderTool}
                    onClick={() => onDelete(folder)}
                    aria-label={`Supprimer ${folder.name}`}
                    title="Supprimer le dossier"
                >
                    <Trash2 size={13} />
                </button>
            </div>

            {folder.scout ? (
                <span className={styles.folderCloud} data-state="local" title="Ces photos ne sont pas sauvegardées : elles sont juste affichées depuis ton appareil.">
                    <Laptop size={11} />
                    <span>Sur cet appareil</span>
                </span>
            ) : null}

            {folder.scout && folder.favoriteCount ? (
                <span className={styles.folderKept} title={`${folder.favoriteCount} photo(s) gardée(s)`}>
                    <Heart size={10} fill="currentColor" />
                    <span data-numeric>{folder.favoriteCount}</span>
                </span>
            ) : null}

            {!folder.scout && folder.cloudBadge ? (
                <span
                    className={styles.folderCloud}
                    data-state={folder.cloudBadge.state}
                    title={folder.cloudBadge.title}
                >
                    {folder.cloudBadge.state === 'synced' ? <Check size={11} /> : null}
                    {folder.cloudBadge.state === 'syncing' ? <Cloud size={11} /> : null}
                    {folder.cloudBadge.state === 'error' ? <CloudOff size={11} /> : null}
                    <span>{folder.cloudBadge.label}</span>
                </span>
            ) : null}
        </article>
    );
});

export default FolderCard;
