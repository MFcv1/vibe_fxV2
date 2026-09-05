"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, ArrowRight, Check, Eye, Images, LayoutGrid, Smartphone, Trash2,
} from 'lucide-react';
import { Badge, Button, EmptyState, IconButton, useToast } from '../primitives';
import InstaPreviewSheet from '../layout/InstaPreviewSheet';
import { ROOM_MAX_ITEMS, useRoom } from './RoomProvider';
import styles from './room.module.css';

/*
 * Room - l'etape entre « une image finie » et « un post ».
 *
 * Layout et Vision travaillent sur UNE image a la fois. Le post Instagram, lui,
 * en compte souvent plusieurs. Cet ecran est la file d'attente: les rendus
 * envoyes depuis les deux ateliers s'y rangent en ligne, dans l'ordre du
 * carrousel, on les reordonne, on valide, et seulement ensuite on regarde le
 * post dans l'iPhone.
 *
 * L'ordre est la seule chose que cet ecran modifie. Aucune retouche ici: une
 * image qui ne va pas se refait dans son atelier, puis se renvoie.
 */

const cx = (...values) => values.filter(Boolean).join(' ');

export default function RoomScreen() {
    const { items, count, status, isFull, validatedAt, removeItem, moveItem, clear, validateOrder } = useRoom();
    const toast = useToast();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);
    const [dropIndex, setDropIndex] = useState(null);
    const railRef = useRef(null);

    /* L'apercu Instagram consomme les memes « slides » que le Layout: le
       carrousel adopte le ratio de la premiere image, comme chez Instagram. */
    const slides = useMemo(() => items.map((item, index) => ({
        url: item.url,
        width: item.width,
        height: item.height,
        index,
    })), [items]);

    const previewFormat = useMemo(() => {
        const first = items[0];
        return {
            id: 'room',
            label: count > 1 ? `Carrousel · ${count} images` : 'Publication',
            w: first?.width || 0,
            h: first?.height || 0,
        };
    }, [count, items]);

    const openPreview = useCallback(async () => {
        if (!count) return;
        if (!validatedAt) await validateOrder();
        setPreviewOpen(true);
    }, [count, validateOrder, validatedAt]);

    /* Vider est destructif et sans annulation: le bouton demande confirmation
       sur place plutot que d'ouvrir une boite de dialogue. */
    const handleClear = useCallback(async () => {
        if (!count) return;
        if (!confirmClear) {
            setConfirmClear(true);
            return;
        }
        setConfirmClear(false);
        await clear();
        toast.push('Room vidée.', { tone: 'neutral' });
    }, [clear, confirmClear, count, toast]);

    /* La demande de confirmation retombe toute seule: un bouton rouge oublie la
       ne peut pas etre clique par accident dix minutes plus tard. */
    useEffect(() => {
        if (!confirmClear) return undefined;
        const timer = window.setTimeout(() => setConfirmClear(false), 5000);
        return () => window.clearTimeout(timer);
    }, [confirmClear]);

    const handleRemove = useCallback(async (item) => {
        await removeItem(item.id);
        toast.push('Image retirée de la Room.', { tone: 'neutral' });
    }, [removeItem, toast]);

    const endDrag = useCallback(() => {
        setDragIndex(null);
        setDropIndex(null);
    }, []);

    const handleDrop = useCallback((targetIndex) => {
        if (dragIndex === null) return;
        moveItem(dragIndex, targetIndex);
        endDrag();
    }, [dragIndex, endDrag, moveItem]);

    if (status === 'loading') {
        return (
            <div className={styles.screen} data-testid="vibeos-room-screen">
                <p className={styles.loading}>Ouverture de la Room…</p>
            </div>
        );
    }

    return (
        <div className={styles.screen} data-testid="vibeos-room-screen">
            <header className={styles.head}>
                <div className={styles.headText}>
                    <h1 className={styles.title}>Room</h1>
                    <p className={styles.subtitle} data-testid="vibeos-room-count">
                        {count === 0
                            ? 'Aucune image en attente'
                            : `${count} image${count > 1 ? 's' : ''} · ordre du carrousel, de gauche à droite`}
                    </p>
                </div>
                <div className={styles.headActions}>
                    {validatedAt && count ? (
                        <Badge tone="accent" icon={<Check size={12} />}>Ordre validé</Badge>
                    ) : null}
                    <Button
                        variant={confirmClear ? 'danger' : 'ghost'}
                        size="sm"
                        icon={<Trash2 size={13} />}
                        onClick={handleClear}
                        disabled={!count}
                        data-testid="vibeos-room-clear"
                    >
                        {confirmClear ? 'Confirmer' : 'Vider'}
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={validatedAt ? <Smartphone size={13} /> : <Check size={13} />}
                        onClick={openPreview}
                        disabled={!count}
                        data-testid="vibeos-room-validate"
                    >
                        {validatedAt ? 'Aperçu Instagram' : "Valider l'ordre"}
                    </Button>
                </div>
            </header>

            {count === 0 ? (
                <div className={styles.emptyWrap}>
                    <EmptyState
                        icon={<Images size={22} />}
                        title="La Room est vide"
                        action={(
                            <div className={styles.emptyActions}>
                                <Button as={Link} href="/creer/layout-visuel" size="sm" icon={<LayoutGrid size={13} />}>
                                    Ouvrir Layout
                                </Button>
                                <Button as={Link} href="/creer/vision" size="sm" icon={<Eye size={13} />}>
                                    Ouvrir Vision
                                </Button>
                            </div>
                        )}
                    >
                        Dans Layout ou Vision, le bouton <strong>Room</strong>, à côté d’Exporter,
                        met le rendu de côté ici. Les images s’empilent dans l’ordre du carrousel
                        jusqu’à ce que le post soit complet.
                    </EmptyState>
                </div>
            ) : (
                <div className={styles.railWrap}>
                    <ol className={styles.rail} ref={railRef} data-testid="vibeos-room-rail">
                        {items.map((item, index) => (
                            <li
                                key={item.id}
                                className={cx(styles.card, dragIndex === index && styles.cardDragging)}
                                data-drop={dropIndex === index && dragIndex !== index ? 'true' : undefined}
                                data-testid="vibeos-room-card"
                                draggable
                                onDragStart={(event) => {
                                    setDragIndex(index);
                                    event.dataTransfer.effectAllowed = 'move';
                                    /* Firefox n'emet pas de drag sans charge utile. */
                                    event.dataTransfer.setData('text/plain', item.id);
                                }}
                                onDragEnd={endDrag}
                                onDragOver={(event) => {
                                    if (dragIndex === null) return;
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'move';
                                    setDropIndex(index);
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    handleDrop(index);
                                }}
                            >
                                <div className={styles.cardTop}>
                                    <span className={styles.cardIndex} data-numeric>{index + 1}</span>
                                    <span className={styles.cardSource}>
                                        {item.sourceLabel}
                                        {item.formatLabel ? ` · ${item.formatLabel}` : ''}
                                    </span>
                                    <IconButton
                                        label={`Retirer l’image ${index + 1}`}
                                        className={styles.cardRemove}
                                        onClick={() => handleRemove(item)}
                                    >
                                        <Trash2 size={14} />
                                    </IconButton>
                                </div>

                                <div className={styles.cardThumb}>
                                    <img src={item.url} alt={`Image ${index + 1} du post`} draggable={false} />
                                </div>

                                <div className={styles.cardBottom}>
                                    <IconButton
                                        label={`Déplacer l’image ${index + 1} vers la gauche`}
                                        disabled={index === 0}
                                        onClick={() => moveItem(index, index - 1)}
                                        data-testid="vibeos-room-move-left"
                                    >
                                        <ArrowLeft size={14} />
                                    </IconButton>
                                    <span className={styles.cardDims} data-numeric>
                                        {item.width}×{item.height}
                                    </span>
                                    <IconButton
                                        label={`Déplacer l’image ${index + 1} vers la droite`}
                                        disabled={index === items.length - 1}
                                        onClick={() => moveItem(index, index + 1)}
                                        data-testid="vibeos-room-move-right"
                                    >
                                        <ArrowRight size={14} />
                                    </IconButton>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {count ? (
                <footer className={styles.foot}>
                    <span>Glisse une vignette pour changer l’ordre, ou utilise les flèches.</span>
                    <span className={styles.footCount} data-numeric>
                        {count}/{ROOM_MAX_ITEMS}
                        {isFull ? ' · limite du carrousel atteinte' : ''}
                    </span>
                </footer>
            ) : null}

            <InstaPreviewSheet
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                slides={slides}
                format={previewFormat}
            />
        </div>
    );
}
