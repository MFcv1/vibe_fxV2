"use client";

import React, {
    useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
    Camera, Check, ChevronLeft, FolderPlus, Grid2x2, Images, Minus, Plus, Trash2, Upload, Wand2, X,
} from 'lucide-react';
import { Button, SearchField, useToast } from '../primitives';
import { useVibeOsProject } from '../project/VibeOsProjectProvider';
import Lightbox from './Lightbox';
import FolderCard from './FolderCard';
import ImportSheet, { QuotaBar } from './ImportSheet';
import useLibrarySync from './useLibrarySync';
import { DENSITY_MAX, DENSITY_MIN, layoutMasonry, resolveColumns } from './masonry';
import { formatBytes, totalBytes } from './libraryDb';
import { ACCEPTED_TYPES, deviceLabel } from './photoImport';
import useLibrary, { SORTS, thumbUrl } from './useLibrary';
import styles from './library.module.css';

/*
 * Bibliotheque photo VibeOS - dossiers, puis grille masonry.
 *
 * Deux vues dans un seul ecran, parce que c'est un seul lieu: la vue DOSSIERS
 * (ce qu'on possede, range par import) et la vue GRILLE (l'interieur d'un
 * dossier). Entrer dans un dossier ne change pas de page: la barre d'outils
 * change de role, la grille prend la place des cartes, et le carrousel reste
 * exactement le meme.
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

const GAP = 10;
const DENSITY_KEY = 'vibeos.library.density';

/* Apparition des tuiles.
   Le decalage est plafonne: sur une rangee, l'oeil lit une vague; passe une
   quinzaine de tuiles, attendre plus longtemps ne se lit plus comme une vague
   mais comme une page qui rame. */
const REVEAL_STEP = 70;
const REVEAL_MAX = 16;
/* Deux tuiles reperees a moins de 60 ms d'ecart font partie de la meme bouffee,
   donc de la meme vague. La fenetre est courte exprès: un chargement de page
   revele tout en une ou deux images, alors qu'un import ajoute les photos une
   par une, a 100 ms d'intervalle. Sans cette coupure, la seizieme photo
   importee attendrait le retard cumule des quinze precedentes avant de
   s'afficher - elle doit au contraire arriver tout de suite. */
const REVEAL_BURST = 60;

/*
 * Revelateur de tuiles.
 *
 * Pourquoi un observateur plutot qu'une animation CSS a la volee: une tuile
 * doit apparaitre quand elle ENTRE dans le champ, pas quand elle est montee.
 * Avec cent photos, tout animer au montage revient a jouer cent animations
 * hors ecran - c'est exactement ce qui fait tomber la cadence.
 *
 * Renvoie `null` quand il n'y a rien a animer (rendu serveur, navigateur sans
 * IntersectionObserver, ou mouvement reduit): les tuiles se posent alors
 * directement a leur place, sans transition.
 */
function createRevealer() {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return null;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;

    const burst = { at: 0, count: 0 };
    /* L'observateur ne promet aucun ordre, et il livre souvent les tuiles UNE
       PAR UNE, dans le desordre - la vague remontait alors du bas a droite.
       On accumule donc les arrivees de l'image en cours, et on ne decide des
       retards qu'a la fin, une fois qu'on sait qui est la et dans quel rang. */
    let waiting = [];
    let scheduled = false;

    function flush() {
        scheduled = false;
        const nodes = waiting.sort((a, b) => (
            Number(a.dataset.position) - Number(b.dataset.position)
        ));
        waiting = [];
        if (!nodes.length) return;
        const now = performance.now();
        if (now - burst.at > REVEAL_BURST) burst.count = 0;
        burst.at = now;
        nodes.forEach((node) => {
            const delay = Math.min(burst.count, REVEAL_MAX) * REVEAL_STEP;
            burst.count += 1;
            node.style.setProperty('--vo-reveal-delay', `${delay}ms`);
            node.dataset.in = 'true';
        });
    }

    return new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            /* Une tuile ne se revele qu'une fois: revenir en arriere dans la
               grille ne doit pas refaire clignoter ce qu'on a deja vu. */
            observer.unobserve(entry.target);
            waiting.push(entry.target);
        });
        if (waiting.length && !scheduled) {
            scheduled = true;
            window.requestAnimationFrame(flush);
        }
    }, { rootMargin: '280px 0px 340px' });
}

/*
 * Une tuile.
 *
 * Deux couches, et c'est la seule chose qui compte ici: la `figure` porte la
 * MISE EN PAGE (position et taille calculees par la masonry), la couche
 * interieure porte le MOUVEMENT (apparition, survol). Melanger les deux ferait
 * que changer la densite pendant qu'une tuile apparait ecraserait l'une des
 * deux transformations.
 */
const Tile = React.memo(function Tile({
    photo, position, rect, selected, revealer, onOpen, onEdit, onDelete, onToggle, onNeedPixels,
}) {
    const nodeRef = useRef(null);
    const [loaded, setLoaded] = useState(false);

    /*
     * Une vignette de 720 px etiree dans une tuile Retina de 740 px, ca se voit:
     * la grille a l'air floue alors que la photo est nette. On compare donc ce
     * que la vignette contient VRAIMENT (`naturalWidth`) a ce que la tuile
     * demande en pixels ecran, et on refabrique la vignette si l'ecart est
     * reel. Les photos importees apres ce changement n'y passent jamais.
     */
    const checkPixels = useCallback((event) => {
        setLoaded(true);
        const img = event.currentTarget;
        const dpr = typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1);
        const needed = Math.round(Math.max(rect.width, rect.height) * dpr);
        if (img.naturalWidth && Math.max(img.naturalWidth, img.naturalHeight) < needed * 0.85) {
            onNeedPixels?.(photo, needed);
        }
    }, [rect.width, rect.height, onNeedPixels, photo]);

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

    return (
        <figure
            ref={nodeRef}
            className={styles.tile}
            data-selected={selected ? 'true' : 'false'}
            data-position={position}
            data-testid="vibeos-library-tile"
            style={{
                transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
                width: rect.width,
                height: rect.height,
            }}
        >
            <div className={styles.tileInner}>
                <button
                    type="button"
                    className={styles.tileOpen}
                    onClick={() => onOpen(position)}
                    aria-label={`Ouvrir ${photo.name}`}
                >
                    {/* La photo se fond une fois decodee: on ne voit jamais un
                        rectangle vide monter puis se remplir. */}
                    <img
                        src={thumbUrl(photo)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        data-loaded={loaded ? 'true' : 'false'}
                        onLoad={checkPixels}
                        onError={() => setLoaded(true)}
                    />
                </button>

                <span className={styles.tileScrim} aria-hidden="true" />

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
                        onClick={() => onEdit(photo)}
                        aria-label="Retoucher dans Vision"
                        title="Retoucher dans Vision"
                    >
                        <Wand2 size={14} />
                    </button>
                    <button
                        type="button"
                        className={styles.tileTool}
                        onClick={() => onDelete(photo)}
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
                    onClick={() => onToggle(photo.id)}
                    aria-pressed={selected}
                    aria-label={selected ? 'Retirer de la sélection' : 'Sélectionner'}
                >
                    <Check size={12} />
                </button>

                <span className={styles.tileRing} aria-hidden="true" />
            </div>
        </figure>
    );
});


/* Barre du dessus, vue DOSSIERS: ce qu'on possede et par ou on entre. */
function FolderToolbar({ folderCount, photoCount, weight, quota, search, onSearch, onImport }) {
    return (
        <header className={styles.toolbar}>
            <div className={styles.toolbarLead}>
                <span className={styles.wordmark}>Bibliothèque</span>
                <span className={styles.toolbarCount} data-numeric>
                    {folderCount} dossier{folderCount > 1 ? 's' : ''} · {photoCount} photo{photoCount > 1 ? 's' : ''} · {weight}
                </span>
            </div>

            <div className={styles.toolbarMain}>
                <SearchField
                    value={search}
                    onChange={onSearch}
                    placeholder="Chercher un dossier"
                    label="Chercher un dossier"
                    className={styles.toolbarSearch}
                />
                <QuotaBar quota={quota} compact />
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

/* Barre du dessus, vue GRILLE: on est dans un dossier, on le dit, et on garde
   tous les reglages de lecture de la grille. */
function Toolbar({
    folder, count, weight, density, onDensity, devices, deviceFilter, onDeviceFilter,
    presets, presetFilter, onPresetFilter, sort, onSort, search, onSearch, onImport, onBack,
}) {
    return (
        <header className={styles.toolbar}>
            <div className={styles.toolbarLead}>
                <button type="button" className={styles.backLink} onClick={onBack}>
                    <ChevronLeft size={14} />
                    Bibliothèque
                </button>
                <span className={styles.wordmark} data-testid="vibeos-library-folder-title">
                    {folder ? folder.name : 'Toutes les photos'}
                </span>
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
        visible, photos, folders, folderCards, folderPhotos, status, importState,
        devices, presets, quota,
        activeFolderId, setActiveFolderId, activeFolder,
        search, setSearch, deviceFilter, setDeviceFilter,
        presetFilter, setPresetFilter, sort, setSort,
        importFiles, renameFolder, removeFolder,
        removePhoto, removeAll, ensurePreview,
    } = library;

    /* Sauvegarde dans le compte utilisateur. Le hook ne fait rien tant que
       personne n'est connecte: la bibliotheque reste utilisable hors ligne. */
    const sync = useLibrarySync(library);

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
    /* Etat distinct de `lightboxIndex`: la grille doit repartir vers l'avant
       DES le debut de la fermeture, alors que le carrousel est encore monte le
       temps de son fondu. */
    const [zoomedOut, setZoomedOut] = useState(false);
    const [selection, setSelection] = useState(() => new Set());
    const [isDropping, setIsDropping] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    const gridRef = useRef(null);
    const gridObserver = useRef(null);
    const inputRef = useRef(null);
    const dragDepth = useRef(0);

    const inFolder = Boolean(activeFolderId);

    /* Un seul observateur pour toute la grille, cree au premier rendu client. */
    const [revealer] = useState(createRevealer);
    useEffect(() => () => revealer?.disconnect(), [revealer]);

    /*
     * Rejeu de la vague au changement de densite.
     *
     * Redimensionner la grille, c'est la reconstruire: toutes les photos
     * changent de taille et de place en meme temps. Les faire glisser une par
     * une vers leur nouvelle case donne une bouillie; la reference, elle,
     * efface tout et refait la vague. C'est aussi plus honnete: la grille
     * qu'on regarde n'est plus la meme.
     *
     * L'ordre compte. On cache les tuiles AVANT que le navigateur peigne la
     * nouvelle mise en page (d'ou `useLayoutEffect`), transitions coupees pour
     * que la disparition soit instantanee, puis on rend les transitions et on
     * remet les tuiles sous l'observateur a l'image suivante.
     */
    const replayedOnce = useRef(false);
    useLayoutEffect(() => {
        if (!replayedOnce.current) { replayedOnce.current = true; return; }
        const grid = gridRef.current;
        if (!grid || !revealer) return;
        const nodes = [...grid.querySelectorAll('[data-testid="vibeos-library-tile"]')];
        if (!nodes.length) return;
        grid.dataset.replay = 'true';
        nodes.forEach((node) => {
            delete node.dataset.in;
            node.style.removeProperty('--vo-reveal-delay');
            revealer.unobserve(node);
        });
        const first = window.requestAnimationFrame(() => {
            delete grid.dataset.replay;
            window.requestAnimationFrame(() => {
                nodes.forEach((node) => revealer.observe(node));
            });
        });
        return () => window.cancelAnimationFrame(first);
    }, [density, revealer]);

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

    /*
     * Pastille de sauvegarde des dossiers. Elle n'existe que si un compte est
     * connecte: sans compte, annoncer "non sauvegarde" sur chaque dossier
     * serait un reproche permanent pour un service que l'utilisateur n'a pas
     * demande.
     */
    const cards = useMemo(() => folderCards.map((folder) => {
        if (!sync.enabled || !folder.count) return folder;
        if (folder.errorCount) {
            return { ...folder, cloudBadge: { state: 'error', label: 'Échec', title: 'La sauvegarde a échoué' } };
        }
        if (folder.syncedCount >= folder.count) {
            return { ...folder, cloudBadge: { state: 'synced', label: 'Sauvegardé', title: 'Copié dans ton compte' } };
        }
        return {
            ...folder,
            cloudBadge: {
                state: 'syncing',
                label: `${folder.syncedCount}/${folder.count}`,
                title: 'Sauvegarde en cours',
            },
        };
    }), [folderCards, sync.enabled]);

    const columns = resolveColumns(density, containerWidth);
    const { rects, height } = useMemo(
        () => layoutMasonry(visible, { containerWidth, columns, gap: GAP }),
        [visible, containerWidth, columns],
    );

    /* ---------- Import ---------- */
    const handleFiles = useCallback(async (files, options = {}) => {
        const result = await importFiles(files, options);
        const { added, skipped, message, folderId } = result;
        if (result.blocked) {
            push(message, { tone: 'danger', duration: 6000 });
            return result;
        }
        /* On entre dans le dossier des la fin de l'import: on veut voir ce
           qu'on vient d'importer, pas une carte de plus. */
        if (added && folderId) setActiveFolderId(folderId);
        if (message) {
            push(message, { tone: 'danger', duration: 6000 });
        } else if (added && skipped) {
            push(`${added} photo(s) ajoutée(s), ${skipped} illisible(s) par ce navigateur.`, { tone: 'success' });
        } else if (added) {
            push(`${added} photo${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}.`, { tone: 'success' });
        } else if (skipped) {
            push(`${skipped} fichier(s) illisible(s) : essaie en JPEG ou PNG.`, { tone: 'danger' });
        }
        return result;
    }, [importFiles, push, setActiveFolderId]);

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
    /* Un depot dans un dossier ouvert y ajoute les photos; un depot sur la vue
       dossiers en cree un nouveau, date du jour. */
    const onDrop = (event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setIsDropping(false);
        if (event.dataTransfer?.files?.length) {
            handleFiles(event.dataTransfer.files, activeFolderId ? { folderId: activeFolderId } : {});
        }
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
        await sync.forgetPhotos(ids);
        setSelection(new Set());
        push('Photos supprimées.');
    }, [selection, removeAll, sync, push]);

    /* ---------- Dossiers ---------- */
    const openFolder = useCallback((folderId) => {
        setSearch('');
        setDeviceFilter('all');
        setPresetFilter('all');
        setSelection(new Set());
        setActiveFolderId(folderId);
    }, [setActiveFolderId, setSearch, setDeviceFilter, setPresetFilter]);

    const backToFolders = useCallback(() => {
        setSearch('');
        setSelection(new Set());
        setActiveFolderId(null);
    }, [setActiveFolderId, setSearch]);

    const handleFolderDelete = useCallback(async (folder) => {
        const label = folder.count
            ? `Supprimer « ${folder.name} » et ses ${folder.count} photo(s) ?`
            : `Supprimer « ${folder.name} » ?`;
        if (!window.confirm(label)) return;
        const removed = await removeFolder(folder.id);
        await sync.forgetFolder(folder.id, removed);
        push('Dossier supprimé.');
    }, [removeFolder, sync, push]);

    /* ---------- Retouche ---------- */
    const openInVision = useCallback(async (photo) => {
        /* Une photo encore uniquement dans le compte n'a pas de fichier ici: on
           le rapatrie avant d'ouvrir Vision, sinon l'editeur ouvrirait du vide. */
        const ready = photo.blob ? photo : await sync.hydrate(photo);
        if (!ready?.blob) {
            push('Photo indisponible hors ligne.', { tone: 'danger' });
            return;
        }
        /* Un nouvel espace par photo: retoucher une photo ne doit jamais ecraser
           la composition en cours dans Layout. */
        await createProject({
            title: ready.name,
            images: [{ id: ready.id, name: ready.name, slotId: null, blob: ready.blob }],
            thumbnail: null,
        });
        router.push('/creer/vision');
    }, [createProject, router, sync, push]);

    const handleDelete = useCallback(async (photo) => {
        if (!window.confirm(`Supprimer « ${photo.name} » ?`)) return;
        await removePhoto(photo.id);
        await sync.forgetPhotos([photo.id]);
        /* Si le carrousel est ouvert: il se ferme sur la derniere photo, sinon
           il reste sur la place liberee (donc sur la photo suivante). */
        setLightboxIndex((current) => {
            if (current < 0) return current;
            if (visible.length <= 1) {
                /* Derniere photo supprimee: le carrousel disparait, la grille
                   doit revenir au premier plan avec lui. */
                setZoomedOut(false);
                return -1;
            }
            return Math.min(current, visible.length - 2);
        });
    }, [removePhoto, sync, visible.length]);

    /*
     * Position de la grille relevee A L'OUVERTURE, quand elle est encore a
     * l'echelle 1.
     *
     * C'est ce qui permet au carrousel de renvoyer la photo exactement sur sa
     * tuile a la fermeture: a cet instant-la, la grille est en train de revenir
     * de son agrandissement, donc lire le rectangle de la tuile a l'ecran
     * donnerait une position fausse - celle d'une image intermediaire de
     * l'animation. Ici on additionne un rectangle de mise en page (la masonry)
     * a une origine mesuree hors animation: le resultat ne depend d'aucun
     * mouvement en cours. La page ne defile pas pendant que le carrousel est
     * ouvert, donc l'origine reste valable.
     */
    const gridOriginRef = useRef(null);

    const openLightbox = useCallback((position) => {
        gridOriginRef.current = gridRef.current?.getBoundingClientRect() || null;
        setLightboxIndex(position);
        setZoomedOut(true);
    }, []);

    const getTileRect = useCallback((id) => {
        const origin = gridOriginRef.current;
        const rect = rects.get(id);
        if (!origin || !rect) return null;
        return {
            left: origin.left + rect.x,
            top: origin.top + rect.y,
            width: rect.width,
            height: rect.height,
        };
    }, [rects]);

    const closeLightbox = useCallback(() => setLightboxIndex(-1), []);

    const weight = formatBytes(totalBytes(inFolder ? folderPhotos : photos));
    const noFolder = status === 'ready' && !folders.length;

    return (
        <div
            className={styles.screen}
            data-testid="vibeos-library-screen"
            data-view={inFolder ? 'gallery' : 'folders'}
            data-lightbox={zoomedOut ? 'true' : 'false'}
            onDragEnter={onDragEnter}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Entree directe, sans fenetre: le depot de fichiers et les tests
                passent par ici. La fenetre d'import a son propre input, parce
                qu'elle doit changer ses attributs selon la source choisie. */}
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className={styles.hiddenInput}
                onChange={(event) => {
                    handleFiles(event.target.files, activeFolderId ? { folderId: activeFolderId } : {});
                    event.target.value = '';
                }}
                data-testid="vibeos-library-input"
            />

            {inFolder ? (
                <Toolbar
                    folder={activeFolder}
                    count={folderPhotos.length}
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
                    onImport={() => setImportOpen(true)}
                    onBack={backToFolders}
                />
            ) : (
                <FolderToolbar
                    folderCount={folders.length}
                    photoCount={photos.length}
                    weight={weight}
                    quota={quota}
                    search={search}
                    onSearch={setSearch}
                    onImport={() => setImportOpen(true)}
                />
            )}

            {importState ? (
                <div className={styles.importBar} role="status">
                    <span
                        className={styles.importFill}
                        style={{ width: `${Math.round((importState.done / importState.total) * 100)}%` }}
                    />
                    <span className={styles.importLabel} data-numeric>
                        Import {importState.done}/{importState.total}
                        {importState.folderName ? ` · ${importState.folderName}` : ''}
                    </span>
                </div>
            ) : null}

            {sync.banner ? (
                <div className={styles.syncBar} role="status" data-tone={sync.banner.tone}>
                    {sync.banner.icon}
                    <span>{sync.banner.label}</span>
                </div>
            ) : null}

            <div className={styles.bodyWrap}>
                {/* La grille se dissout sous la barre d'outils au lieu d'y buter. */}
                <span className={styles.topVeil} aria-hidden="true" />

                <div className={styles.body}>
                    {!inFolder && noFolder ? (
                        <div className={styles.empty}>
                            <span className={styles.emptyIcon} aria-hidden="true"><Images size={26} /></span>
                            <h2 className={styles.emptyTitle}>Ta bibliothèque est vide</h2>
                            <p className={styles.emptyBody}>
                                Chaque import crée un dossier, avec son nom et son compte de photos.
                                Dépose tes photos ici, ou choisis-les dans ton appareil : elles restent
                                enregistrées, tu les retrouves à chaque ouverture.
                            </p>
                            <Button
                                variant="primary"
                                size="lg"
                                icon={<Upload size={15} />}
                                onClick={() => setImportOpen(true)}
                            >
                                Importer des photos
                            </Button>
                        </div>
                    ) : null}

                    {!inFolder && !noFolder ? (
                        <div className={styles.folderGrid} data-testid="vibeos-library-folders">
                            {cards.map((folder, folderIndex) => (
                                <FolderCard
                                    key={folder.id}
                                    folder={folder}
                                    position={folderIndex}
                                    revealer={revealer}
                                    onOpen={openFolder}
                                    onRename={renameFolder}
                                    onDelete={handleFolderDelete}
                                />
                            ))}
                            <button
                                type="button"
                                className={styles.folderNew}
                                onClick={() => setImportOpen(true)}
                                data-testid="vibeos-library-new-folder"
                            >
                                <span className={styles.folderNewIcon}><FolderPlus size={20} /></span>
                                <span>Nouveau dossier</span>
                            </button>
                        </div>
                    ) : null}

                    {inFolder ? (
                        <div
                            ref={attachGrid}
                            className={styles.grid}
                            style={{ height }}
                            data-testid="vibeos-library-grid"
                        >
                            {visible.map((photo, photoIndex) => {
                                const rect = rects.get(photo.id);
                                if (!rect) return null;
                                return (
                                    <Tile
                                        key={photo.id}
                                        photo={photo}
                                        position={photoIndex}
                                        rect={rect}
                                        selected={selection.has(photo.id)}
                                        revealer={revealer}
                                        onOpen={openLightbox}
                                        onEdit={openInVision}
                                        onDelete={handleDelete}
                                        onToggle={toggleSelect}
                                        onNeedPixels={ensurePreview}
                                    />
                                );
                            })}
                        </div>
                    ) : null}

                    {inFolder && folderPhotos.length > 0 && visible.length === 0 ? (
                        <p className={styles.noMatch}>Aucune photo ne correspond à ce filtre.</p>
                    ) : null}

                    {inFolder && status === 'ready' && folderPhotos.length === 0 ? (
                        <div className={styles.empty}>
                            <span className={styles.emptyIcon} aria-hidden="true"><Images size={26} /></span>
                            <h2 className={styles.emptyTitle}>Ce dossier est vide</h2>
                            <p className={styles.emptyBody}>
                                Ajoute des photos ici : elles rejoindront « {activeFolder?.name} ».
                            </p>
                            <Button
                                variant="primary"
                                size="lg"
                                icon={<Upload size={15} />}
                                onClick={() => setImportOpen(true)}
                            >
                                Importer des photos
                            </Button>
                        </div>
                    ) : null}

                    {!inFolder && !noFolder && folderCards.length === 0 ? (
                        <p className={styles.noMatch}>Aucun dossier ne correspond à cette recherche.</p>
                    ) : null}
                </div>
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
                    <span>
                        <Upload size={20} />
                        {activeFolder ? `Ajouter à « ${activeFolder.name} »` : 'Dépose tes photos'}
                    </span>
                </div>
            ) : null}

            <ImportSheet
                open={importOpen}
                onClose={() => setImportOpen(false)}
                folders={folderCards}
                quota={quota}
                defaultFolderId={activeFolderId}
                onFiles={handleFiles}
            />

            {lightboxIndex >= 0 && visible[lightboxIndex] ? (
                <Lightbox
                    photos={visible}
                    index={lightboxIndex}
                    onIndexChange={setLightboxIndex}
                    onCloseStart={() => setZoomedOut(false)}
                    onClose={closeLightbox}
                    onEdit={openInVision}
                    onDelete={handleDelete}
                    getTileRect={getTileRect}
                    onNeedPixels={ensurePreview}
                />
            ) : null}
        </div>
    );
}
