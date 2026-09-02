"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload } from 'lucide-react';
import { listPhotos } from '../library/libraryDb';
import { fetchBlob } from '../library/libraryCloud';
import { thumbUrl } from '../library/useLibrary';
import { Button, Sheet, Spinner } from '../primitives';
import styles from './layout.module.css';

/*
 * « Importer » depuis une case de la mise en page: soit un fichier de
 * l'appareil, soit une photo de la bibliotheque VibeOS.
 *
 * La bibliotheque est lue directement dans IndexedDB (`listPhotos`), sans
 * monter tout le moteur `useLibrary` (dossiers, quota, synchronisation compte):
 * ici on a besoin d'une liste et d'un Blob, rien de plus. Une photo qui n'existe
 * que dans le compte est redescendue a la demande.
 */
export default function SlotImportSheet({
    open, slotLabel = '', targetsSlot = true, onClose, onPickFile, onPickBlob, onPickDevice,
}) {
    const [photos, setPhotos] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        let alive = true;
        listPhotos()
            .then((list) => {
                if (!alive) return;
                const sorted = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setPhotos(sorted);
                setError('');
            })
            .catch(() => {
                if (alive) setPhotos([]);
            });
        return () => { alive = false; };
    }, [open]);

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
            title={targetsSlot ? `Ajouter une photo — ${slotLabel}` : 'Ajouter des photos'}
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
            {photos && photos.length === 0 ? (
                <p className={styles.sheetIntro}>
                    Ta bibliothèque est vide pour l’instant. Importe des photos depuis l’onglet
                    Bibliothèque, elles apparaîtront ici.
                </p>
            ) : null}
            {photos && photos.length > 0 ? (
                <div className={styles.slotLibraryGrid}>
                    {photos.map((photo) => (
                        <button
                            key={photo.id}
                            type="button"
                            className={styles.slotLibraryItem}
                            onClick={() => pickPhoto(photo)}
                            disabled={busyId === photo.id}
                            title={photo.name || 'Photo'}
                        >
                            {thumbUrl(photo)
                                ? <img src={thumbUrl(photo)} alt={photo.name || 'Photo de la bibliothèque'} />
                                : <ImagePlus size={16} />}
                            {busyId === photo.id ? <span className={styles.slotLibraryBusy}><Spinner label="Ouverture" /></span> : null}
                        </button>
                    ))}
                </div>
            ) : null}
        </Sheet>
    );
}
