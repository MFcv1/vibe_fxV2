"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Camera, Check, Grid2x2, Images, Minus, Plus, Trash2, Upload, Wand2, X,
} from 'lucide-react';
import { Button, SearchField, useToast } from '../primitives';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';
import Lightbox from './Lightbox';
import { DENSITY_MAX, DENSITY_MIN, layoutMasonry, resolveColumns } from './masonry';
import { formatBytes, totalBytes } from './libraryDb';
import { ACCEPTED_TYPES, deviceLabel } from './photoImport';
import useLibrary, { SORTS, thumbUrl } from './useLibrary';
import styles from './library.module.css';

/*
 * Bibliotheque photo - la grille masonry de VibeOS.
 *
 * Ce que l'ecran garantit :
 * - les photos importees restent (IndexedDB), on ne re-importe jamais deux fois;
 * - la grille est une vraie masonry calculee (voir `masonry.js`), pas des
 *   colonnes CSS: l'ordre de lecture est chronologique et les tuiles gardent le
 *   cadrage d'origine, jamais de recadrage centre;
 * - chaque tuile est positionnee en `transform`, donc changer la densite fait
 *   glisser les photos au lieu de recharger la page;
 * - l'indexation vient de l'EXIF: on filtre par appareil comme dans un vrai
 *   catalogue photo.
 */

const GAP = 8;
const DENSITY_KEY = 'vibeos.library.density';

function Toolbar({
    count, weight, density, onDensity, devices, deviceFilter, onDeviceFilter,
    presets, presetFilter, onPresetFilter, sort, onSort, search, onSearch, onImport,
}) {
    return (
        <header className={styles.toolbar}>
            <div className={styles.toolbarLead}>
                <span className={styles.wordmark}>Bibliothèque</span>
                <span className={styles.toolbarCount} data-numeric>
                    {count} photo{count > 1 ? 's' : ''} · {weight}
                </span>
            </div>

            <div className={styles.toolbarMain}>
                <SearchField
                    value={search}
                    onChange={onSearch}
                    placeholder="Chercher une photo"
                    label="Chercher une photo"
                    className={styles.toolbarSearch}
                />

                <label className={styles.select}>
                    <Camera size={13} />
                    <select
                        value={deviceFilter}
                        onChange={(event) => onDeviceFilter(event.target.value)}
                        aria-label="Filtrer par appareil"
                    >
                        <option value="all">Tous les appareils</option>
                        {devices.map((device) => (
                            <option key={device.id} value={device.id}>
                                {device.label} ({device.count})
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.select}>
                    <Wand2 size={13} />
                    <select
                        value={presetFilter}
                        onChange={(event) => onPresetFilter(event.target.value)}
                        aria-label="Filtrer par preset"
                    >
                        <option value="all">Tous les presets</option>
                        <option value="none">Sans preset</option>
                        {presets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                                {preset.label} ({preset.count})
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.select}>
                    <select
                        value={sort}
                        onChange={(event) => onSort(event.target.value)}
                        aria-label="Trier"
                    >
                        {SORTS.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                    </select>
                </label>

                <div className={styles.density} role="group" aria-label="Densité de la grille">
                    <button
                        type="button"
                        onClick={() => onDensity(density - 1)}
                        disabled={density <= DENSITY_MIN}
                        aria-label="Agrandir les photos"
                    >
                        <Minus size={13} />
                    </button>
                    <span className={styles.densityValue}>
                        <Grid2x2 size={12} />
                        <span data-numeric>{density}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => onDensity(density + 1)}
                        disabled={density >= DENSITY_MAX}
                        aria-label="Réduire les photos"
                    >
                        <Plus size={13} />
                    </button>
                </div>
            </div>

            <Button
                variant="primary"
                size="sm"
                icon={<Upload size={13} />}
                onClick={onImport}
                data-testid="vibeos-library-import"
            >
                Importer
            </Button>
        </header>
    );
}

export default function LibraryScreen() {
    const router = useRouter();
    const { push } = useToast();
    const { createProject } = useVibeOsProject();
    const library = useLibrary();
    const {
        visible, photos, status, importState, devices, presets,
        search, setSearch, deviceFilter, setDeviceFilter,
        presetFilter, setPresetFilter, sort, setSort,
        importFiles, removePhoto, removeAll,
    } = library;

    /* Densite relue au premier rendu client. Le rendu serveur part de 4: sans
       photo ni largeur mesuree, la grille est vide des deux cotes, donc aucune
       difference d'hydratation. */
    const [density, setDensity] = useState(() => {
        if (typeof window === 'undefined') return 4;
        const stored = Number(window.localStorage.getItem(DENSITY_KEY));
        return stored >= DENSITY_MIN && stored <= DENSITY_MAX ? stored : 4;
    });
    const [containerWidth, setContainerWidth] = useState(0);
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [selection, setSelection] = useState(() => new Set());
    const [isDropping, setIsDropping] = useState(false);

    const gridRef = useRef(null);
    const gridObserver = useRef(null);
    const inputRef = useRef(null);
    const tileNodes = useRef(new Map());
    const dragDepth = useRef(0);

    /* La densite choisie survit au rechargement: c'est un reglage de confort,
       pas une donnee de projet. */
    const changeDensity = useCallback((next) => {
        const clamped = Math.max(DENSITY_MIN, Math.min(DENSITY_MAX, next));
        setDensity(clamped);
        try {
            window.localStorage.setItem(DENSITY_KEY, String(clamped));
        } catch {
            /* Navigation privee: la densite ne sera juste pas memorisee. */
        }
    }, []);

    /*
     * Largeur reelle de la grille, mesuree par un ref de rappel plutot que par
     * un effet: la grille n'existe PAS tant que la bibliotheque est vide, et un
     * effet ne se rejouerait pas au moment ou elle apparait apres le premier
     * import — la masonry restait alors calee sur une largeur perimee.
     */
    const attachGrid = useCallback((node) => {
        if (gridObserver.current) {
            gridObserver.current.disconnect();
            gridObserver.current = null;
        }
        gridRef.current = node;
        if (!node) return;
        setContainerWidth(node.clientWidth);
        const observer = new ResizeObserver((entries) => {
            setContainerWidth(entries[0].contentRect.width);
        });
        observer.observe(node);
        gridObserver.current = observer;
    }, []);

    const columns = resolveColumns(density, containerWidth);
    const { rects, height } = useMemo(
        () => layoutMasonry(visible, { containerWidth, columns, gap: GAP }),
        [visible, containerWidth, columns],
    );

    /* ---------- Import ---------- */
    const handleFiles = useCallback(async (files) => {
        const { added, skipped } = await importFiles(files);
        if (added && skipped) {
            push(`${added} photo(s) ajoutée(s), ${skipped} illisible(s) par ce navigateur.`, { tone: 'success' });
        } else if (added) {
            push(`${added} photo${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}.`, { tone: 'success' });
        } else if (skipped) {
            push(`${skipped} fichier(s) illisible(s) : essaie en JPEG ou PNG.`, { tone: 'danger' });
        }
    }, [importFiles, push]);

    /* Depot de fichiers n'importe ou sur l'ecran. Le compteur de profondeur
       evite le clignotement quand le curseur passe au-dessus d'un enfant. */
    const onDragEnter = (event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setIsDropping(true);
    };
    const onDragLeave = (event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setIsDropping(false);
    };
    const onDrop = (event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setIsDropping(false);
        if (event.dataTransfer?.files?.length) handleFiles(event.dataTransfer.files);
    };

    /* ---------- Selection ---------- */
    const toggleSelect = useCallback((id) => {
        setSelection((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const deleteSelection = useCallback(async () => {
        const ids = [...selection];
        if (!ids.length) return;
        if (!window.confirm(`Supprimer ${ids.length} photo(s) de la bibliothèque ?`)) return;
        await removeAll(ids);
        setSelection(new Set());
        push('Photos supprimées.');
    }, [selection, removeAll, push]);

    /* ---------- Retouche ---------- */
    const openInVision = useCallback(async (photo) => {
        /* Un nouvel espace par photo: retoucher une photo ne doit jamais ecraser
           la composition en cours dans Layout. */
        await createProject({
            title: photo.name,
            images: [{ id: photo.id, name: photo.name, slotId: null, blob: photo.blob }],
            thumbnail: null,
        });
        router.push('/creer/vision');
    }, [createProject, router]);

    const handleDelete = useCallback(async (photo) => {
        if (!window.confirm(`Supprimer « ${photo.name} » ?`)) return;
        await removePhoto(photo.id);
        /* Si le carrousel est ouvert: il se ferme sur la derniere photo, sinon
           il reste sur la place liberee (donc sur la photo suivante). */
        setLightboxIndex((current) => {
            if (current < 0) return current;
            if (visible.length <= 1) return -1;
            return Math.min(current, visible.length - 2);
        });
    }, [removePhoto, visible.length]);

    const getTileRect = useCallback((id) => {
        const node = tileNodes.current.get(id);
        return node ? node.getBoundingClientRect() : null;
    }, []);

    const weight = formatBytes(totalBytes(photos));
    const isEmpty = status === 'ready' && !photos.length;

    return (
        <div
            className={styles.screen}
            data-testid="vibeos-library-screen"
            onDragEnter={onDragEnter}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className={styles.hiddenInput}
                onChange={(event) => {
                    handleFiles(event.target.files);
                    event.target.value = '';
                }}
                data-testid="vibeos-library-input"
            />

            <Toolbar
                count={photos.length}
                weight={weight}
                density={density}
                onDensity={changeDensity}
                devices={devices}
                deviceFilter={deviceFilter}
                onDeviceFilter={setDeviceFilter}
                presets={presets}
                presetFilter={presetFilter}
                onPresetFilter={setPresetFilter}
                sort={sort}
                onSort={setSort}
                search={search}
                onSearch={setSearch}
                onImport={() => inputRef.current?.click()}
            />

            {importState ? (
                <div className={styles.importBar} role="status">
                    <span
                        className={styles.importFill}
                        style={{ width: `${Math.round((importState.done / importState.total) * 100)}%` }}
                    />
                    <span className={styles.importLabel} data-numeric>
                        Import {importState.done}/{importState.total}
                    </span>
                </div>
            ) : null}

            <div className={styles.body}>
                {isEmpty ? (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon} aria-hidden="true"><Images size={26} /></span>
                        <h2 className={styles.emptyTitle}>Ta bibliothèque est vide</h2>
                        <p className={styles.emptyBody}>
                            Dépose tes photos ici, ou importe un dossier entier. Elles restent
                            enregistrées sur cet appareil : tu les retrouves à chaque ouverture,
                            sans jamais les réimporter.
                        </p>
                        <Button
                            variant="primary"
                            size="lg"
                            icon={<Upload size={15} />}
                            onClick={() => inputRef.current?.click()}
                        >
                            Importer des photos
                        </Button>
                    </div>
                ) : (
                    <div
                        ref={attachGrid}
                        className={styles.grid}
                        style={{ height }}
                        data-testid="vibeos-library-grid"
                    >
                        {visible.map((photo, photoIndex) => {
                            const rect = rects.get(photo.id);
                            if (!rect) return null;
                            const selected = selection.has(photo.id);
                            return (
                                <figure
                                    key={photo.id}
                                    ref={(node) => {
                                        if (node) tileNodes.current.set(photo.id, node);
                                        else tileNodes.current.delete(photo.id);
                                    }}
                                    className={styles.tile}
                                    data-selected={selected ? 'true' : 'false'}
                                    data-testid="vibeos-library-tile"
                                    style={{
                                        transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
                                        width: rect.width,
                                        height: rect.height,
                                    }}
                                >
                                    <button
                                        type="button"
                                        className={styles.tileOpen}
                                        onClick={() => setLightboxIndex(photoIndex)}
                                        aria-label={`Ouvrir ${photo.name}`}
                                    >
                                        <img src={thumbUrl(photo)} alt="" loading="lazy" decoding="async" />
                                    </button>

                                    <figcaption className={styles.tileChips}>
                                        <span className={styles.chip}>{deviceLabel(photo)}</span>
                                        {photo.preset ? (
                                            <span className={`${styles.chip} ${styles.chipPreset}`}>
                                                {photo.preset.label}
                                            </span>
                                        ) : null}
                                    </figcaption>

                                    <div className={styles.tileTools}>
                                        <button
                                            type="button"
                                            className={styles.tileTool}
                                            onClick={() => openInVision(photo)}
                                            aria-label="Retoucher dans Vision"
                                            title="Retoucher dans Vision"
                                        >
                                            <Wand2 size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.tileTool}
                                            onClick={() => handleDelete(photo)}
                                            aria-label="Supprimer"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        className={styles.tileSelect}
                                        data-selected={selected ? 'true' : 'false'}
                                        onClick={() => toggleSelect(photo.id)}
                                        aria-pressed={selected}
                                        aria-label={selected ? 'Retirer de la sélection' : 'Sélectionner'}
                                    >
                                        <Check size={12} />
                                    </button>
                                </figure>
                            );
                        })}
                    </div>
                )}

                {status === 'ready' && photos.length > 0 && visible.length === 0 ? (
                    <p className={styles.noMatch}>Aucune photo ne correspond à ce filtre.</p>
                ) : null}
            </div>

            {selection.size ? (
                <div className={styles.selectionBar} role="status">
                    <span data-numeric>{selection.size} sélectionnée{selection.size > 1 ? 's' : ''}</span>
                    <button type="button" onClick={deleteSelection} className={styles.selectionDanger}>
                        <Trash2 size={14} />
                        Supprimer
                    </button>
                    <button type="button" onClick={() => setSelection(new Set())}>
                        <X size={14} />
                        Annuler
                    </button>
                </div>
            ) : null}

            {isDropping ? (
                <div className={styles.dropVeil} aria-hidden="true">
                    <span><Upload size={20} /> Dépose tes photos</span>
                </div>
            ) : null}

            {lightboxIndex >= 0 && visible[lightboxIndex] ? (
                <Lightbox
                    photos={visible}
                    index={lightboxIndex}
                    onIndexChange={setLightboxIndex}
                    onClose={() => setLightboxIndex(-1)}
                    onEdit={(photo) => openInVision(photo)}
                    onDelete={handleDelete}
                    getTileRect={getTileRect}
                />
            ) : null}
        </div>
    );
}
