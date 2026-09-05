"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Columns2, Download, ImageOff, ImagePlus, Images, Layers, Redo2, RotateCcw, Search,
    ShieldCheck, Sparkles, Star, Undo2, Upload, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import Link from 'next/link';
import {
    Badge, Button, Collapsible, IconButton, Segmented, Sheet, Slider, useToast,
} from '../primitives';
import { useRoom } from '../room/RoomProvider';
import { visionBoundsFor } from '../../vibefx-studio/utils/visionColorScience';
import BeforeAfter, { COMPARE_MODES } from '../shared/BeforeAfter';
import PipelineSourceNote from '../project/PipelineSourceNote';
import useVisionEditor from './useVisionEditor';
import { describeSignals } from './autoEnhance';
import {
    buildPresetCollections, filterAndGroupPresets, PRESET_COLLECTION_ALL,
} from './presetCollections';
import usePresetFavorites from './usePresetFavorites';
import styles from './vision.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

function PresetCard({
    preset, preview, active, favorite, favoritePending,
    onApply, onToggleFavorite, requestPreview, releasePreview,
}) {
    const cardRef = useRef(null);

    useEffect(() => {
        const card = cardRef.current;
        if (!card || typeof IntersectionObserver === 'undefined') {
            requestPreview(preset.id, 'urgent');
            return () => releasePreview(preset.id);
        }
        const root = card.closest(`.${styles.panel}`);
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) {
                releasePreview(preset.id);
                return;
            }
            const cardBox = entry.boundingClientRect;
            const rootBox = root?.getBoundingClientRect() || {
                top: 0, bottom: window.innerHeight,
            };
            const visibleNow = cardBox.bottom > rootBox.top && cardBox.top < rootBox.bottom;
            requestPreview(preset.id, visibleNow ? 'urgent' : 'idle');
        }, { root, rootMargin: '500px 0px' });
        observer.observe(card);
        return () => {
            observer.disconnect();
            releasePreview(preset.id);
        };
    }, [preset.id, requestPreview, releasePreview]);

    return (
        <article
            ref={cardRef}
            className={cx(styles.lookCard, active && styles.lookCardActive)}
            title={preset.description}
            data-preset-id={preset.id}
            data-preview-ready={preview ? 'true' : 'false'}
        >
            <button
                type="button"
                className={styles.lookCardApply}
                onClick={() => onApply(preset)}
                aria-label={`${preset.label} — ${preset.hint}`}
                aria-pressed={active}
                data-preset-apply
            >
                <span className={styles.lookThumb}>
                    {preview
                        ? <img src={preview} alt="" />
                        : <span className={styles.lookThumbEmpty} />}
                </span>
                <span className={styles.lookLabel}>{preset.label}</span>
                <span className={styles.lookHint}>{preset.hint}</span>
            </button>
            <button
                type="button"
                className={cx(styles.presetFavorite, favorite && styles.presetFavoriteActive)}
                onClick={() => onToggleFavorite(preset.id)}
                aria-label={`${favorite ? 'Retirer' : 'Ajouter'} ${preset.label} ${favorite ? 'des' : 'aux'} favoris`}
                aria-pressed={favorite}
                aria-busy={favoritePending}
                disabled={favoritePending}
                title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                data-preset-favorite
            >
                <Star size={14} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
        </article>
    );
}

/*
 * Reglages fins: exactement les cles supportees par le moteur Vision v3
 * (utils/visionColorScience.VISION_SUPPORTED_FILTER_KEYS).
 *
 * Les BORNES ne sont plus ecrites ici. Elles viennent du moteur
 * (`visionBoundsFor`), et elles changent avec les garde-fous: actifs, le
 * contraste s'arrete a 125 parce que c'est la que le moteur l'arrete de toute
 * facon. Avant, l'interface proposait d'aller jusqu'a 180 et le moteur ramenait
 * a 125 en silence — un tiers de la course ne faisait rien.
 */
const ADVANCED_GROUPS = [
    {
        id: 'light',
        title: 'Lumière',
        controls: [
            { key: 'brightness', label: 'Luminosité', unit: '%' },
            { key: 'contrast', label: 'Contraste', unit: '%' },
            { key: 'highlights', label: 'Hautes lumières' },
            { key: 'shadows', label: 'Ombres' },
        ],
    },
    {
        id: 'color',
        title: 'Couleur',
        controls: [
            { key: 'temperature', label: 'Température' },
            { key: 'saturation', label: 'Saturation', unit: '%' },
            { key: 'vibrance', label: 'Éclat des couleurs' },
            { key: 'skinSaturation', label: 'Teintes de peau' },
            { key: 'skySaturation', label: 'Ciel / Eau' },
            { key: 'foliageSaturation', label: 'Végétation' },
            { key: 'warmSaturation', label: 'Tons chauds' },
        ],
    },
    {
        id: 'texture',
        title: 'Matière',
        controls: [
            { key: 'texture', label: 'Texture' },
            { key: 'clarity', label: 'Relief' },
            { key: 'sharpness', label: 'Netteté' },
            { key: 'dehaze', label: 'Voile atmosphérique' },
            { key: 'grain', label: 'Grain' },
            { key: 'grainSize', label: 'Taille du grain', requires: 'grain' },
            { key: 'grainRoughness', label: 'Cassure du grain', requires: 'grain' },
            { key: 'vignette', label: 'Vignettage' },
            { key: 'vignetteMidpoint', label: 'Milieu du vignettage', requires: 'vignette' },
            { key: 'vignetteRoundness', label: 'Arrondi du vignettage', requires: 'vignette' },
            { key: 'vignetteFeather', label: 'Contour progressif', requires: 'vignette' },
            { key: 'vignetteHighlights', label: 'Hautes lumières du vignettage', requires: 'vignette' },
        ],
    },
];

export default function VisionScreen() {
    const editor = useVisionEditor();
    const {
        favoriteIds, pendingIds: favoritePendingIds,
        toggleFavorite, error: favoriteError,
    } = usePresetFavorites();
    const {
        image, metrics, signals, sourceKind,
        filters, setFilters,
        intensity, setIntensity,
        presets, previews, requestPresetPreview, releasePresetPreview, activePresetId,
        autoMessage, isLoadingImage,
        canvasRef, handleImageUpload, detachComposition, clearImage,
        autoEnhance, applyPreset, resetFilters,
        startAdjusting, stopAdjusting, isAdjusting, adjustBaseline, presetDrivenKeys, activePresetLabel,
        undo, redo, canUndo, canRedo,
        zoom, setZoom, resetZoom, panZoom,
        exportController,
    } = editor;

    /*
     * LE ZOOM DE L'APERCU, et pourquoi il porte un pourcentage plutot qu'un « x2 ».
     *
     * « 100 % » veut dire une chose precise: un pixel de la PHOTO pour un pixel
     * du canvas. C'est la seule echelle ou un grain, une nettete ou une texture
     * se jugent — en dessous, l'image est reduite et la matiere est moyennee.
     * Le multiplicateur qui y mene depend donc de la taille du canvas, donc de
     * la fenetre: il se calcule ici, pas dans le moteur.
     */

    /*
     * `unPourUn` est le multiplicateur qui met un pixel de la photo sur un pixel
     * du canvas. Il se MESURE, et il change avec la fenetre: un premier jet le
     * lisait une seule fois, au montage, et l'etiquette annoncait « 5 % » puis
     * « 566 % » pour le meme geste — le canvas n'avait pas fini de se
     * dimensionner. D'ou l'observateur de taille.
     */
    const [unPourUn, setUnPourUn] = useState(1);
    useEffect(() => {
        const canvas = canvasRef.current;
        const largeurPhoto = image?.naturalWidth || image?.width;
        if (!canvas || !largeurPhoto) return undefined;
        const relire = () => {
            if (!canvas.width) return;
            setUnPourUn(Math.max(1, largeurPhoto / canvas.width));
        };
        relire();
        const observateur = new ResizeObserver(relire);
        observateur.observe(canvas);
        return () => observateur.disconnect();
    }, [canvasRef, image, isLoadingImage]);

    /* Les paliers de Lightroom. « Adapter » montre la photo entiere; a partir de
       100 %, un pixel de la photo vaut un pixel d'ecran — c'est la seule echelle
       ou le grain et la nettete se jugent. */
    const PALIERS = useMemo(() => [1, unPourUn, unPourUn * 2, unPourUn * 4], [unPourUn]);
    const zoomPourCent = Math.round((zoom * 100) / unPourUn);
    const paliersSuivant = useCallback((sens) => {
        const index = PALIERS.findIndex((p) => p > zoom * 1.01);
        if (sens > 0) setZoom(index === -1 ? PALIERS[PALIERS.length - 1] : PALIERS[index]);
        else {
            const avant = [...PALIERS].reverse().find((p) => p < zoom * 0.99);
            setZoom(avant ?? 1);
        }
    }, [PALIERS, zoom, setZoom]);

    /* Deplacer la loupe a la souris. Le deplacement est rapporte a la taille du
       canvas ET au zoom: sans ca, un geste d'un centimetre traverse la photo des
       qu'on grossit. */
    const glisse = useRef(null);
    const onPointerDown = useCallback((event) => {
        if (zoom <= 1) return;
        glisse.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }, [zoom]);
    const onPointerMove = useCallback((event) => {
        if (!glisse.current || zoom <= 1) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dx = (event.clientX - glisse.current.x) / rect.width / zoom;
        const dy = (event.clientY - glisse.current.y) / rect.height / zoom;
        glisse.current = { x: event.clientX, y: event.clientY };
        panZoom(dx, dy);
    }, [zoom, panZoom, canvasRef]);
    const onPointerUp = useCallback(() => { glisse.current = null; }, []);

    /* Comparaison: elle reste allumee tant qu'on ne l'eteint pas, et le mode
       choisi (rideau / cote a cote / maintien) est un reglage a part entiere. */
    const [isComparing, setIsComparing] = useState(false);
    const [compareMode, setCompareMode] = useState('slider');
    const [presetCollection, setPresetCollection] = useState(PRESET_COLLECTION_ALL);
    const [presetQuery, setPresetQuery] = useState('');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const importRef = useRef(null);

    const {
        exportName, setExportName, exportFormat, setExportFormat,
        exportQuality, setExportQuality, estimatedSize,
        isExportModalOpen, setIsExportModalOpen, handleDownload, performExport, renderExportCanvas,
    } = exportController;

    const { addFromCanvas: addToRoom, isFull: isRoomFull } = useRoom();
    const toast = useToast();
    const [isSendingToRoom, setIsSendingToRoom] = useState(false);

    /*
     * « Room »: la photo telle qu'elle sortirait de l'export part dans la file
     * du post. C'est un RENDU fige: continuer a retoucher ici ne changera plus
     * l'image envoyee - c'est ce qui permet d'envoyer deux versions de la meme
     * photo dans un meme carrousel.
     */
    const sendToRoom = async () => {
        if (isSendingToRoom) return;
        setIsSendingToRoom(true);
        try {
            const exportCanvas = renderExportCanvas();
            if (!exportCanvas) throw new Error('Le rendu pleine définition n’est pas disponible.');
            const result = await addToRoom(exportCanvas, {
                source: 'vision',
                sourceLabel: 'Vision',
                formatLabel: activePresetLabel || 'Photo',
            });
            if (!result.added) {
                toast.push(
                    result.reason === 'full'
                        ? 'La Room est pleine : un carrousel Instagram s’arrête à 10 images.'
                        : 'Rien n’a pu être envoyé dans la Room.',
                    { tone: 'danger' },
                );
                return;
            }
            toast.push(`Photo envoyée dans la Room · ${result.total} au total`, { tone: 'success' });
        } catch (error) {
            toast.push(error?.message || 'Envoi dans la Room impossible.', { tone: 'danger' });
        } finally {
            setIsSendingToRoom(false);
        }
    };

    const signalTags = useMemo(() => (signals ? describeSignals(signals) : []), [signals]);
    const presetCollections = useMemo(() => buildPresetCollections(presets), [presets]);
    const presetGroups = useMemo(() => filterAndGroupPresets(presets, {
        collectionId: presetCollection,
        query: presetQuery,
        favoriteIds,
        favoritesOnly,
    }), [presets, presetCollection, presetQuery, favoriteIds, favoritesOnly]);
    const favoriteCount = useMemo(
        () => presets.reduce((total, preset) => total + (favoriteIds.has(preset.id) ? 1 : 0), 0),
        [presets, favoriteIds],
    );
    const visiblePresetCount = useMemo(
        () => presetGroups.reduce((total, group) => total + group.presets.length, 0),
        [presetGroups],
    );
    const safeSmartphone = filters.safeSmartphone !== false;
    const isMono = (filters.saturation ?? 100) === 0;

    /*
     * Les reglages qui ne sont plus au repos remontent EN HAUT du panneau, dans
     * leur propre section. Sans ca, il faut parcourir seize curseurs pour
     * retrouver les trois qui ont bouge — et on ne voit pas ce qu'un preset
     * vient de poser.
     */
    const boundsOf = useCallback(
        (key) => visionBoundsFor(key, { safe: safeSmartphone, mono: isMono }),
        [safeSmartphone, isMono],
    );

    /*
     * L'ordre est GELE pendant qu'on tient un curseur: on classe d'apres l'etat
     * du panneau au DEBUT du geste (`adjustBaseline`). Sinon le curseur qu'on
     * bouge sauterait dans « Modifiés » au premier cran, sous le doigt, et le
     * geste serait coupe net.
     */
    const classement = isAdjusting && adjustBaseline ? adjustBaseline : filters;

    const remontes = useMemo(() => {
        const out = [];
        for (const group of ADVANCED_GROUPS) {
            for (const control of group.controls) {
                const bounds = boundsOf(control.key);
                if (!bounds) continue;
                /*
                 * Un reglage que le PRESET pilote reste en haut tant que le
                 * preset est actif, quelle que soit sa valeur — meme ramene au
                 * repos. Sinon il redescend des qu'on le remet a zero puis
                 * remonte des qu'on y retouche: le panneau saute sous la main a
                 * chaque aller-retour, et on perd de vue les reglages du preset
                 * au moment precis ou on est en train de les regler.
                 */
                if (presetDrivenKeys.has(control.key)) {
                    out.push({ ...control, group: group.title });
                    continue;
                }
                const value = classement[control.key] ?? bounds.neutre;
                if (value !== bounds.neutre) out.push({ ...control, group: group.title });
            }
        }
        return out;
    }, [classement, boundsOf, presetDrivenKeys]);

    const remontesKeys = useMemo(() => new Set(remontes.map((c) => c.key)), [remontes]);

    /* Un curseur se rend pareil ou qu'il soit: dans « Modifiés » en haut, ou
       dans son groupe d'origine. Seul le rappel du groupe change. */
    const renderSlider = (control, groupe = null) => {
        const bounds = boundsOf(control.key);
        if (!bounds) return null;
        const pilote = presetDrivenKeys.has(control.key);
        return (
            <Slider
                key={control.key}
                label={groupe ? `${control.label} · ${groupe}` : control.label}
                value={filters[control.key] ?? bounds.neutre}
                onChange={(value) => setFilters(control.key, value)}
                min={bounds.min}
                max={bounds.max}
                neutral={bounds.neutre}
                defaultValue={bounds.neutre}
                accent={pilote}
                accentTitle={pilote ? `Réglage posé par le preset « ${activePresetLabel} »` : null}
                onInteractStart={startAdjusting}
                onInteractEnd={stopAdjusting}
                disabled={Boolean(control.requires && !(Number(filters[control.requires]) > 0))}
                formatValue={(value) => `${value}${control.unit || ''}`}
            />
        );
    };

    return (
        <div className={styles.screen} data-testid="vibeos-vision-screen">
            {/* ---------- Aperçu ---------- */}
            <section className={styles.stage} aria-label="Aperçu de la photo">
                {image ? (
                    <>
                        <div className={styles.stageActions}>
                            {/* Les modes vivent sur la meme ligne que les autres
                                actions de l'apercu, a gauche des fleches. */}
                            {isComparing ? (
                                <Segmented
                                    label="Mode de comparaison"
                                    value={compareMode}
                                    onChange={setCompareMode}
                                    options={COMPARE_MODES}
                                    className={styles.compareModes}
                                />
                            ) : null}
                            <div className={styles.zoomGroup}>
                                <IconButton
                                    label="Réduire"
                                    disabled={zoom <= 1}
                                    onClick={() => paliersSuivant(-1)}
                                    data-testid="vibeos-vision-zoom-out"
                                >
                                    <ZoomOut size={15} />
                                </IconButton>
                                <button
                                    type="button"
                                    className={styles.zoomLabel}
                                    onClick={() => (zoom > 1 ? resetZoom() : setZoom(unPourUn))}
                                    title="Voir la photo pixel pour pixel — c'est là que le grain et la netteté se jugent"
                                    data-testid="vibeos-vision-zoom-label"
                                >
                                    {zoom <= 1 ? 'Adapter' : `${zoomPourCent} %`}
                                </button>
                                <IconButton
                                    label="Agrandir"
                                    disabled={zoom >= PALIERS[PALIERS.length - 1]}
                                    onClick={() => paliersSuivant(1)}
                                    data-testid="vibeos-vision-zoom-in"
                                >
                                    <ZoomIn size={15} />
                                </IconButton>
                            </div>
                            <IconButton label="Annuler" disabled={!canUndo} onClick={undo}>
                                <Undo2 size={15} />
                            </IconButton>
                            <IconButton label="Rétablir" disabled={!canRedo} onClick={redo}>
                                <Redo2 size={15} />
                            </IconButton>
                            <IconButton
                                label={isComparing ? 'Masquer la comparaison' : "Comparer avec l'original"}
                                active={isComparing}
                                onClick={() => setIsComparing((current) => !current)}
                                data-testid="vibeos-vision-compare-toggle"
                            >
                                <Columns2 size={15} />
                            </IconButton>
                            <IconButton
                                label="Changer de photo"
                                onClick={() => importRef.current?.click()}
                                data-testid="vibeos-vision-change-photo"
                            >
                                <ImagePlus size={15} />
                            </IconButton>
                            <Button
                                size="sm"
                                icon={<Layers size={13} />}
                                onClick={sendToRoom}
                                disabled={isSendingToRoom || isRoomFull}
                                title={isRoomFull
                                    ? 'La Room est pleine (10 images)'
                                    : 'Envoyer cette photo dans la Room, la file du post'}
                                data-testid="vibeos-vision-send-room"
                            >
                                Room
                            </Button>
                            <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={handleDownload}>
                                Exporter
                            </Button>
                        </div>

                        <div className={styles.canvasWrap}>
                            <BeforeAfter
                                beforeSrc={image.src}
                                ratio={(image.naturalWidth || image.width) / (image.naturalHeight || image.height)}
                                mode={compareMode}
                                active={isComparing}
                                testId="vibeos-vision-compare"
                            >
                                <canvas
                                    ref={canvasRef}
                                    className={cx(styles.canvas, zoom > 1 && styles.canvasZoome)}
                                    onPointerDown={onPointerDown}
                                    onPointerMove={onPointerMove}
                                    onPointerUp={onPointerUp}
                                    onPointerCancel={onPointerUp}
                                />
                            </BeforeAfter>
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyStage}>
                        <h2 className={styles.emptyStageTitle}>Choisis une photo</h2>
                        <p className={styles.emptyStageBody}>
                            Importe une photo de téléphone : Vision l&apos;analyse et te propose
                            des améliorations qui ne la cassent jamais.
                        </p>
                        <div className={styles.emptyActions}>
                            <Button
                                variant="primary"
                                size="lg"
                                icon={<Upload size={15} />}
                                onClick={() => importRef.current?.click()}
                            >
                                Importer une photo
                            </Button>
                            <Button
                                as={Link}
                                href="/creer/bibliotheque"
                                variant="secondary"
                                size="lg"
                                icon={<Images size={15} />}
                            >
                                Ouvrir la bibliothèque
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            {/* ---------- Panneau ---------- */}
            <aside className={styles.panel} aria-label="Réglages Vision">
                <input
                    ref={importRef}
                    type="file"
                    accept="image/*"
                    className={styles.hiddenInput}
                    onChange={handleImageUpload}
                    data-testid="vibeos-vision-input"
                />

                <section className={styles.block}>
                    <PipelineSourceNote
                        kind={sourceKind}
                        stage="vision"
                        testId="vibeos-vision-source"
                    />
                    {/* Sortie de secours: la composition Layout est prioritaire sur
                        la photo, donc sans ce bouton on ne pouvait plus revenir a
                        une simple photo une fois une composition publiee. */}
                    {image ? (
                        <div className={styles.sourceActions}>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<ImagePlus size={13} />}
                                onClick={() => importRef.current?.click()}
                            >
                                Changer de photo
                            </Button>
                            {/* Deselection, pas suppression: la photo reste dans
                                la bibliotheque, on vide juste l'apercu. */}
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<ImageOff size={13} />}
                                onClick={clearImage}
                                title="Vide l'aperçu — la photo reste dans ta bibliothèque"
                                data-testid="vibeos-vision-clear"
                            >
                                Retirer
                            </Button>
                            {sourceKind === 'composition' ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={<RotateCcw size={13} />}
                                    onClick={detachComposition}
                                    data-testid="vibeos-vision-detach"
                                >
                                    Quitter la composition
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                    <Button
                        variant="primary"
                        size="lg"
                        block
                        icon={<Sparkles size={16} />}
                        disabled={!image || !metrics || isLoadingImage}
                        onClick={autoEnhance}
                        data-testid="vibeos-vision-auto"
                    >
                        Améliorer ma photo
                    </Button>
                    {autoMessage ? (
                        <p className={styles.autoMessage} data-testid="vibeos-vision-message">{autoMessage}</p>
                    ) : (
                        <p className={styles.blockHint}>
                            Un bouton, une analyse : lumière, relief, couleurs et teints sont corrigés
                            en gardant la photo naturelle.
                        </p>
                    )}
                    {signalTags.length ? (
                        <div className={styles.tagRow}>
                            {signalTags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                        </div>
                    ) : null}
                    <Slider
                        label="Intensité"
                        value={intensity}
                        onChange={setIntensity}
                        min={0}
                        max={100}
                        defaultValue={80}
                        formatValue={(value) => `${value}%`}
                    />
                </section>

                {/* Presets */}
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3 className={styles.blockTitle}>Presets</h3>
                        <span className={styles.blockHint}>
                            {activePresetId ? 'Reclique pour comparer' : 'Le look de base'}
                        </span>
                    </div>
                    <div className={styles.presetTools}>
                        <div className={styles.presetSearch}>
                            <Search size={14} aria-hidden="true" />
                            <label className={styles.srOnly} htmlFor="vision-preset-search">
                                Rechercher un preset
                            </label>
                            <input
                                id="vision-preset-search"
                                type="search"
                                value={presetQuery}
                                onChange={(event) => setPresetQuery(event.target.value)}
                                placeholder="Rechercher un preset"
                                data-testid="vibeos-vision-preset-search"
                            />
                            {presetQuery ? (
                                <button
                                    type="button"
                                    className={styles.presetSearchClear}
                                    onClick={() => setPresetQuery('')}
                                    aria-label="Effacer la recherche"
                                >
                                    <X size={13} />
                                </button>
                            ) : null}
                        </div>

                        <div
                            className={styles.presetCollectionRail}
                            role="tablist"
                            aria-label="Collections de presets"
                            data-testid="vibeos-vision-preset-collections"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={favoritesOnly}
                                className={cx(
                                    styles.presetCollectionChip,
                                    styles.presetFavoriteChip,
                                    favoritesOnly && styles.presetCollectionChipActive,
                                )}
                                onClick={() => {
                                    setFavoritesOnly(true);
                                    setPresetCollection(PRESET_COLLECTION_ALL);
                                }}
                            >
                                <Star size={12} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />
                                Favoris <span>{favoriteCount}</span>
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={!favoritesOnly && presetCollection === PRESET_COLLECTION_ALL}
                                className={cx(
                                    styles.presetCollectionChip,
                                    !favoritesOnly && presetCollection === PRESET_COLLECTION_ALL
                                        && styles.presetCollectionChipActive,
                                )}
                                onClick={() => {
                                    setFavoritesOnly(false);
                                    setPresetCollection(PRESET_COLLECTION_ALL);
                                }}
                            >
                                Tous <span>{presets.length}</span>
                            </button>
                            {presetCollections.map((collection) => (
                                <button
                                    key={collection.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={!favoritesOnly && presetCollection === collection.id}
                                    className={cx(
                                        styles.presetCollectionChip,
                                        !favoritesOnly && presetCollection === collection.id
                                            && styles.presetCollectionChipActive,
                                    )}
                                    onClick={() => {
                                        setFavoritesOnly(false);
                                        setPresetCollection(collection.id);
                                    }}
                                >
                                    {collection.label} <span>{collection.count}</span>
                                </button>
                            ))}
                        </div>

                        <div className={styles.presetResultMeta} aria-live="polite">
                            <span>{visiblePresetCount} preset{visiblePresetCount > 1 ? 's' : ''}</span>
                            {(favoritesOnly || presetCollection !== PRESET_COLLECTION_ALL || presetQuery) ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPresetCollection(PRESET_COLLECTION_ALL);
                                        setPresetQuery('');
                                        setFavoritesOnly(false);
                                    }}
                                >
                                    Tout afficher
                                </button>
                            ) : null}
                        </div>
                        {favoriteError ? (
                            <p className={styles.presetFavoriteError} role="alert">{favoriteError}</p>
                        ) : null}
                    </div>

                    <div className={styles.presetGroups} data-testid="vibeos-vision-presets">
                        {presetGroups.length ? presetGroups.map((group) => (
                            <section className={styles.presetGroup} key={group.collection.id}>
                                <div className={styles.presetGroupHead}>
                                    <h4>{group.collection.label}</h4>
                                    <span>{group.presets.length}</span>
                                </div>
                                <div className={styles.lookGrid}>
                                    {group.presets.map((preset) => (
                                        <PresetCard
                                            key={preset.id}
                                            preset={preset}
                                            preview={previews[preset.id]}
                                            active={preset.id === activePresetId}
                                            favorite={favoriteIds.has(preset.id)}
                                            favoritePending={favoritePendingIds.has(preset.id)}
                                            onApply={applyPreset}
                                            onToggleFavorite={toggleFavorite}
                                            requestPreview={requestPresetPreview}
                                            releasePreview={releasePresetPreview}
                                        />
                                    ))}
                                </div>
                            </section>
                        )) : (
                            <div className={styles.presetEmpty}>
                                {favoritesOnly
                                    ? <Star size={17} aria-hidden="true" />
                                    : <Search size={17} aria-hidden="true" />}
                                <strong>{favoritesOnly ? 'Aucun favori' : 'Aucun preset trouvé'}</strong>
                                <span>
                                    {favoritesOnly
                                        ? 'Clique sur l’étoile d’un preset pour le retrouver ici.'
                                        : 'Essaie un autre nom ou affiche toutes les collections.'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPresetCollection(PRESET_COLLECTION_ALL);
                                        setPresetQuery('');
                                        setFavoritesOnly(false);
                                    }}
                                >
                                    Réinitialiser
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Réglages avancés */}
                <Collapsible title="Réglages avancés" defaultOpen={false} testId="vibeos-vision-advanced">
                    <section className={styles.block}>
                        <div className={styles.rowSplit}>
                            <span className={styles.rowLabel}>
                                <ShieldCheck size={13} /> Garde-fous smartphone
                            </span>
                            <Segmented
                                label="Garde-fous smartphone"
                                value={safeSmartphone ? 'on' : 'off'}
                                onChange={(value) => setFilters('safeSmartphone', value === 'on')}
                                options={[
                                    { value: 'on', label: 'Actifs' },
                                    { value: 'off', label: 'Libres' },
                                ]}
                            />
                        </div>
                        <p className={styles.blockHint}>
                            Actifs, ils empêchent les peaux orange, les ciels fluo et les noirs bouchés.
                            À couper seulement si tu sais ce que tu fais.
                        </p>
                    </section>

                    {remontes.length ? (
                        <section className={styles.block} data-testid="vibeos-vision-modifies">
                            <h3 className={styles.blockTitle}>
                                Modifiés
                                <span className={styles.blockCount}>{remontes.length}</span>
                            </h3>
                            {remontes.map((control) => renderSlider(control, control.group))}
                        </section>
                    ) : null}

                    {ADVANCED_GROUPS.map((group) => {
                        const restants = group.controls.filter((c) => !remontesKeys.has(c.key));
                        if (!restants.length) return null;
                        return (
                            <section key={group.id} className={styles.block}>
                                <h3 className={styles.blockTitle}>{group.title}</h3>
                                {restants.map((control) => renderSlider(control))}
                            </section>
                        );
                    })}

                    <section className={styles.block}>
                        <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={resetFilters}>
                            Tout remettre à zéro
                        </Button>
                    </section>
                </Collapsible>
            </aside>

            {/* ---------- Sheets ---------- */}

            <Sheet
                open={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                title="Exporter la photo"
            >
                <div className={styles.exportRow}>
                    <span className={styles.rowLabel}>Nom du fichier</span>
                    <input
                        type="text"
                        className={styles.textInput}
                        value={exportName}
                        aria-label="Nom du fichier"
                        onChange={(event) => setExportName(event.target.value)}
                    />
                </div>
                <div className={styles.rowSplit}>
                    <span className={styles.rowLabel}>Format</span>
                    <Segmented
                        label="Format d'export"
                        value={exportFormat}
                        onChange={setExportFormat}
                        options={[
                            { value: 'jpg', label: 'JPG' },
                            { value: 'png', label: 'PNG' },
                            { value: 'webp', label: 'WebP' },
                        ]}
                    />
                </div>
                {exportFormat !== 'png' ? (
                    <Slider
                        label="Qualité"
                        value={exportQuality}
                        onChange={setExportQuality}
                        min={40}
                        max={100}
                        defaultValue={90}
                        formatValue={(value) => `${value}%`}
                    />
                ) : null}
                <p className={styles.exportEstimate}>
                    Poids estimé : <span data-numeric>{estimatedSize || '—'}</span>
                </p>
                <Button variant="primary" size="lg" block icon={<Download size={15} />} onClick={performExport}>
                    Télécharger
                </Button>
            </Sheet>
        </div>
    );
}
