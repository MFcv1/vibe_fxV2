"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Images, ImagePlus, Upload } from 'lucide-react';
import { listFolders, listPhotos } from '../library/libraryDb';
import { fetchBlob } from '../library/libraryCloud';
import { fallbackUrl, thumbUrl } from '../library/useLibrary';
import { layoutMasonry, resolveColumns } from '../library/masonry';
import { Button, Sheet, Spinner } from '../primitives';
import styles from './layout.module.css';

/*
 * « Importer » depuis une case de la mise en page: soit un fichier de
 * l'appareil, soit une photo de la bibliotheque VibeOS.
 *
 * La bibliotheque est lue directement dans IndexedDB, sans monter tout le
 * moteur `useLibrary` (quota, synchronisation compte): ici on a besoin d'une
 * liste et d'un Blob, rien de plus. Une photo qui n'existe que dans le compte
 * est redescendue a la demande.
 *
 * DEUX ETAPES, comme dans la bibliotheque: les DOSSIERS, puis les photos du
 * dossier choisi. La version precedente deversait toute la photothèque en
 * vignettes minuscules a ratio fixe - a six cents photos on ne distinguait plus
 * rien, et il fallait faire defiler des milliers de pixels pour trouver la
 * bonne. Les photos sont maintenant posees en maconnerie, chacune a son vrai
 * rapport de forme, dans la largeur reellement disponible.
 *
 * Les dossiers de TRI n'apparaissent pas: ils ne contiennent que des apercus,
 * pas de fichier utilisable pour une mise en page. Leurs photos deviennent
 * disponibles ici une fois passees par « Importer » depuis le tri.
 */

const GAP = 8;
const DENSITY = 4;
export default function SlotImportSheet({
    open, slotLabel = '', targetsSlot = true, title = null,
    onClose, onPickFile, onPickBlob, onPickDevice,
}) {
    const [photos, setPhotos] = useState(null);
    const [folders, setFolders] = useState([]);
    /*
     * Le dossier ouvert SURVIT a la fermeture du panneau, et c'est voulu: on
     * pioche presque toujours plusieurs photos de suite dans le meme dossier.
     * « Tous les dossiers » ramene en arriere, et un dossier disparu retombe
     * tout seul sur la liste.
     */
    const [openFolderId, setOpenFolderId] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');
    const [gridWidth, setGridWidth] = useState(0);
    const fileRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        let alive = true;
        Promise.all([listPhotos(), listFolders()])
            .then(([list, dossiers]) => {
                if (!alive) return;
                setPhotos(list);
                setFolders(dossiers.filter((folder) => folder.kind !== 'scout'));
                setError('');
            })
            .catch(() => {
                if (alive) { setPhotos([]); setFolders([]); }
            });
        return () => { alive = false; };
    }, [open]);

    /* Largeur reellement disponible: la maconnerie s'y adapte, plutot que des
       colonnes fixes qui laissent du vide ou ecrasent les photos. */
    const attachGrid = useCallback((node) => {
        if (!node) return;
        setGridWidth(node.clientWidth);
        const observer = new ResizeObserver((entries) => {
            setGridWidth(entries[0].contentRect.width);
        });
        observer.observe(node);
    }, []);

    const dossiers = useMemo(() => {
        const parDossier = new Map();
        (photos || []).forEach((photo) => {
            const key = photo.folderId || 'sans-dossier';
            if (!parDossier.has(key)) parDossier.set(key, []);
            parDossier.get(key).push(photo);
        });
        return folders
            .map((folder) => {
                const dedans = (parDossier.get(folder.id) || [])
                    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
                return { ...folder, photos: dedans, cover: dedans[0] || null };
            })
            .filter((folder) => folder.photos.length)
            .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    }, [photos, folders]);

    const dossierOuvert = useMemo(
        () => dossiers.find((folder) => folder.id === openFolderId) || null,
        [dossiers, openFolderId],
    );

    const grille = useMemo(() => {
        const liste = dossierOuvert?.photos || [];
        const colonnes = resolveColumns(DENSITY, gridWidth);
        return { liste, ...layoutMasonry(liste, { containerWidth: gridWidth, columns: colonnes, gap: GAP }) };
    }, [dossierOuvert, gridWidth]);

    const pickPhoto = useCallback(async (photo) => {
        setBusyId(photo.id);
        setError('');
        try {
            let blob = photo.blob || null;
            if (!blob) {
                blob = await fetchBlob(photo.originalUrl || photo.previewUrl, photo.cloud?.originalPath)
                    .catch(() => null);
            }
            if (!blob) {
                setError('Cette photo n’est pas disponible hors ligne. Ouvre-la une fois dans la Bibliothèque.');
                return;
            }
            onPickBlob?.(blob, photo.name || 'photo.jpg');
            /* Import cible: la case est servie, on referme. Import general: on
               reste ouvert pour en choisir plusieurs d'affilee. */
            if (targetsSlot) onClose?.();
        } finally {
            setBusyId(null);
        }
    }, [onClose, onPickBlob, targetsSlot]);

    if (!open) return null;

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={title || (targetsSlot ? `Ajouter une photo — ${slotLabel}` : 'Ajouter des photos')}
            wide
        >
            <div className={styles.slotImportActions}>
                <Button
                    variant="primary"
                    icon={<Upload size={14} />}
                    onClick={() => {
                        /* L'import general reutilise le champ de fichiers du
                           panneau: un seul point d'entree, et il accepte
                           plusieurs photos d'un coup. */
                        if (onPickDevice) {
                            onPickDevice();
                            onClose?.();
                            return;
                        }
                        fileRef.current?.click();
                    }}
                >
                    Depuis cet appareil
                </Button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className={styles.hiddenInput}
                    data-testid="vibeos-slot-file-input"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        onPickFile?.(file);
                        onClose?.();
                    }}
                />
                <span className={styles.sheetIntro}>ou choisis dans ta bibliothèque</span>
            </div>

            {photos === null ? (
                <div className={styles.previewState}><Spinner label="Lecture de la bibliothèque" /></div>
            ) : null}
            {error ? <div className={`${styles.previewState} ${styles.previewStateError}`}>{error}</div> : null}

            {photos && !dossiers.length ? (
                <p className={styles.sheetIntro}>
                    Ta bibliothèque est vide pour l’instant. Importe des photos depuis l’onglet
                    Bibliothèque, elles apparaîtront ici.
                </p>
            ) : null}

            {/* Etape 1: les dossiers. On ne deverse plus toute la photothèque. */}
            {photos && dossiers.length && !dossierOuvert ? (
                <div className={styles.pickerFolders} data-testid="vibeos-slot-folders">
                    {dossiers.map((folder) => (
                        <button
                            key={folder.id}
                            type="button"
                            className={styles.pickerFolder}
                            onClick={() => setOpenFolderId(folder.id)}
                            title={folder.name}
                        >
                            <span className={styles.pickerFolderCover}>
                                {folder.cover && (thumbUrl(folder.cover) || fallbackUrl(folder.cover)) ? (
                                    <img
                                        src={thumbUrl(folder.cover) || fallbackUrl(folder.cover)}
                                        alt=""
                                        onError={(event) => {
                                            const secours = fallbackUrl(folder.cover);
                                            if (secours && event.currentTarget.src !== secours) {
                                                event.currentTarget.src = secours;
                                            }
                                        }}
                                    />
                                ) : <Images size={18} />}
                                <span className={styles.pickerFolderCount} data-numeric>
                                    {folder.photos.length}
                                </span>
                            </span>
                            <span className={styles.pickerFolderName}>{folder.name}</span>
                        </button>
                    ))}
                </div>
            ) : null}

            {/* Etape 2: les photos du dossier, a leur vrai rapport de forme. */}
            {dossierOuvert ? (
                <div className={styles.pickerInside}>
                    <button
                        type="button"
                        className={styles.pickerBack}
                        onClick={() => setOpenFolderId(null)}
                        data-testid="vibeos-slot-back"
                    >
                        <ChevronLeft size={14} />
                        Tous les dossiers
                    </button>
                    <span className={styles.pickerFolderTitle}>
                        {dossierOuvert.name}
                        <span data-numeric> · {dossierOuvert.photos.length} photo{dossierOuvert.photos.length > 1 ? 's' : ''}</span>
                    </span>

                    <div
                        ref={attachGrid}
                        className={styles.pickerGrid}
                        style={{ height: grille.height }}
                        data-testid="vibeos-slot-grid"
                    >
                        {grille.liste.map((photo) => {
                            const rect = grille.rects.get(photo.id);
                            if (!rect) return null;
                            return (
                                <button
                                    key={photo.id}
                                    type="button"
                                    className={styles.pickerPhoto}
                                    style={{
                                        transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
                                        width: rect.width,
                                        height: rect.height,
                                    }}
                                    onClick={() => pickPhoto(photo)}
                                    disabled={busyId === photo.id}
                                    title={photo.name || 'Photo'}
                                >
                                    {/* Meme filet que dans la grille: ce panneau
                                        partage le cache d'adresses, il subissait
                                        donc les memes vignettes cassees. */}
                                    {thumbUrl(photo) || fallbackUrl(photo) ? (
                                        <img
                                            src={thumbUrl(photo) || fallbackUrl(photo)}
                                            alt={photo.name || 'Photo de la bibliothèque'}
                                            onError={(event) => {
                                                const secours = fallbackUrl(photo);
                                                if (secours && event.currentTarget.src !== secours) {
                                                    event.currentTarget.src = secours;
                                                }
                                            }}
                                        />
                                    ) : <ImagePlus size={16} />}
                                    {busyId === photo.id
                                        ? <span className={styles.slotLibraryBusy}><Spinner label="Ouverture" /></span>
                                        : null}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </Sheet>
    );
}
