"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, ArrowRight, Check, Eye, FolderPlus, Images, LayoutGrid, Save, Smartphone, Trash2,
} from 'lucide-react';
import { Badge, Button, EmptyState, IconButton, Sheet, useToast } from '../primitives';
import InstaPreviewSheet from '../layout/InstaPreviewSheet';
import { ROOM_CAROUSEL_MAX, useRoom } from './RoomProvider';
import {
    listTargetFolders, roomItemsLeftFor, saveRoomToLibrary, suggestRoomFolderName,
} from './roomToLibrary';
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
    const {
        items, count, status, overCarousel, validatedAt, syncEnabled, syncBanner,
        removeItem, moveItem, clear, validateOrder,
    } = useRoom();
    const toast = useToast();
    const router = useRouter();
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

    /*
     * Mettre la Room a l'abri.
     *
     * Tant qu'un rendu n'est qu'un element de Room, il vit dans CE navigateur
     * et nulle part ailleurs. L'enregistrer dans la bibliotheque le fait entrer
     * dans le circuit normal - donc dans le compte, donc dans Storage.
     */
    const [saveOpen, setSaveOpen] = useState(false);
    const [folders, setFolders] = useState([]);
    const [destination, setDestination] = useState('new');
    const [folderName, setFolderName] = useState('');
    const [folderId, setFolderId] = useState('');
    const [saving, setSaving] = useState(null); // { done, total }
    /* Ce qui reste vraiment a enregistrer dans la destination choisie. */
    const [reste, setReste] = useState(null); // { total, restants, deja }

    const openSave = useCallback(async () => {
        const liste = await listTargetFolders();
        setFolders(liste);
        setFolderId(liste[0]?.id || '');
        setDestination(liste.length ? 'new' : 'new');
        setFolderName(suggestRoomFolderName(items, liste.map((folder) => folder.name)));
        setReste(null);
        setSaveOpen(true);
    }, [items]);

    /*
     * Recompte a chaque changement de destination: un dossier deja servi ne
     * reprend que les images ajoutees depuis, un dossier neuf prend tout.
     */
    useEffect(() => {
        if (!saveOpen) return undefined;
        let vivant = true;
        const cible = destination === 'existing' ? folderId : null;
        roomItemsLeftFor(cible).then((valeur) => { if (vivant) setReste(valeur); });
        return () => { vivant = false; };
    }, [saveOpen, destination, folderId, count]);

    const aEnregistrer = reste ? reste.restants : count;

    const handleSave = useCallback(async () => {
        setSaving({ done: 0, total: aEnregistrer });
        const result = await saveRoomToLibrary({
            folderId: destination === 'existing' ? folderId : null,
            folderName: destination === 'new' ? folderName : null,
            onProgress: (done, total) => setSaving({ done, total }),
        });
        setSaving(null);
        setSaveOpen(false);
        if (result.blocked) {
            toast.push(result.message, { tone: 'danger', duration: 6000 });
            return;
        }
        if (!result.added) {
            toast.push('Aucune image n’a pu être enregistrée.', { tone: 'danger' });
            return;
        }
        toast.push(
            `${result.added} image${result.added > 1 ? 's' : ''} enregistrée${result.added > 1 ? 's' : ''} dans « ${result.folderName} ». La sauvegarde dans ton compte démarre.`,
            { tone: 'success', duration: 6000 },
        );
        /* On emmene l'utilisateur dans la bibliotheque: c'est cet ecran qui
           porte la synchronisation, donc c'est en y arrivant que la montee
           vers le compte commence vraiment. */
        router.push('/creer/bibliotheque');
    }, [aEnregistrer, destination, folderId, folderName, router, toast]);

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
                        size="sm"
                        icon={<Save size={13} />}
                        onClick={openSave}
                        disabled={!count || Boolean(saving)}
                        title="Enregistrer ces images dans la bibliothèque, et donc dans ton compte"
                        data-testid="vibeos-room-save"
                    >
                        {saving ? `Enregistrement ${saving.done}/${saving.total}` : 'Enregistrer'}
                    </Button>
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

            {/* L'etat de la sauvegarde se lit sans avoir a le chercher: c'est la
                seule facon de savoir si la file existe ailleurs que dans ce
                navigateur. */}
            {syncBanner ? (
                <div className={styles.syncBar} role="status" data-tone={syncBanner.tone}>
                    {syncBanner.label}
                </div>
            ) : null}

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
                                    {/*
                                      * Filet de securite: si l'adresse locale ne
                                      * repond plus, on bascule sur la copie du
                                      * compte plutot que de laisser un point
                                      * d'interrogation. Une vignette cassee sur
                                      * une file de dix images fait douter de tout
                                      * le reste.
                                      */}
                                    <img
                                        src={item.url || item.cloud?.url || undefined}
                                        alt={`Image ${index + 1} du post`}
                                        draggable={false}
                                        onError={(event) => {
                                            const secours = item.cloud?.url;
                                            if (!secours || event.currentTarget.src === secours) return;
                                            event.currentTarget.src = secours;
                                        }}
                                    />
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
                        {count} image{count > 1 ? 's' : ''}
                        {overCarousel
                            ? ` · un carrousel Instagram en prend ${ROOM_CAROUSEL_MAX}, les ${count - ROOM_CAROUSEL_MAX} dernières attendront un autre post`
                            : ''}
                    </span>
                </footer>
            ) : null}

            <Sheet
                open={saveOpen}
                onClose={() => (saving ? null : setSaveOpen(false))}
                title="Enregistrer dans la bibliothèque"
            >
                <div className={styles.saveBody}>
                    <p className={styles.saveIntro}>
                        {syncEnabled
                            ? `Ces ${count} image${count > 1 ? 's' : ''} sont déjà sauvegardées dans ton compte, mais la Room est une file d’attente : elle se vide quand le post part.`
                            : `Ces ${count} image${count > 1 ? 's' : ''} ne vivent aujourd’hui que dans ce navigateur.`}{' '}
                        Les enregistrer les range dans ta bibliothèque, où elles deviennent des
                        photos comme les autres — retrouvables partout, réutilisables, et qu’une
                        retouche de preset n’effacera pas.{' '}
                        <strong>La Room n’est pas vidée</strong> : ton post en cours reste tel quel.
                    </p>

                    {/* Ce qui est deja dans le dossier vise n'y retourne pas: sans
                        ca, ajouter quatre images a une file de trente-six
                        proposait de reimporter les trente-six. */}
                    {reste && reste.deja ? (
                        <p className={styles.saveIntro}>
                            {reste.restants ? (
                                <>
                                    <strong data-numeric>{reste.deja}</strong> de ces images sont
                                    déjà dans ce dossier : seule{reste.restants > 1 ? 's' : ''} l
                                    {reste.restants > 1 ? 'es ' : 'a '}
                                    <strong data-numeric>{reste.restants}</strong> ajoutée
                                    {reste.restants > 1 ? 's' : ''} depuis sera
                                    {reste.restants > 1 ? 'ont' : ''} enregistrée
                                    {reste.restants > 1 ? 's' : ''}.
                                </>
                            ) : (
                                <>Toutes ces images sont déjà dans ce dossier. Choisis un autre
                                dossier, ou ajoute d’abord des images à la Room.</>
                            )}
                        </p>
                    ) : null}

                    <div className={styles.saveField} role="radiogroup" aria-label="Destination">
                        <button
                            type="button"
                            role="radio"
                            aria-checked={destination === 'new'}
                            data-active={destination === 'new' ? 'true' : 'false'}
                            className={styles.saveChoice}
                            onClick={() => setDestination('new')}
                        >
                            <FolderPlus size={14} />
                            Nouveau dossier
                        </button>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={destination === 'existing'}
                            data-active={destination === 'existing' ? 'true' : 'false'}
                            className={styles.saveChoice}
                            onClick={() => setDestination('existing')}
                            disabled={!folders.length}
                        >
                            <Images size={14} />
                            Dossier existant
                        </button>
                    </div>

                    {destination === 'new' ? (
                        <input
                            className={styles.saveInput}
                            value={folderName}
                            maxLength={60}
                            onChange={(event) => setFolderName(event.target.value)}
                            aria-label="Nom du dossier"
                            placeholder="Nom du dossier"
                            data-testid="vibeos-room-folder-name"
                        />
                    ) : (
                        <select
                            className={styles.saveInput}
                            value={folderId}
                            onChange={(event) => setFolderId(event.target.value)}
                            aria-label="Dossier existant"
                        >
                            {folders.map((folder) => (
                                <option key={folder.id} value={folder.id}>{folder.name}</option>
                            ))}
                        </select>
                    )}

                    <div className={styles.saveFoot}>
                        <Button variant="ghost" size="sm" onClick={() => setSaveOpen(false)} disabled={Boolean(saving)}>
                            Annuler
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            icon={<Save size={13} />}
                            onClick={handleSave}
                            disabled={Boolean(saving) || !aEnregistrer || (destination === 'existing' && !folderId)}
                            data-testid="vibeos-room-save-confirm"
                        >
                            {saving
                                ? `Enregistrement ${saving.done}/${saving.total}`
                                : aEnregistrer
                                    ? `Enregistrer ${aEnregistrer} image${aEnregistrer > 1 ? 's' : ''}`
                                    : 'Déjà tout enregistré'}
                        </Button>
                    </div>
                </div>
            </Sheet>

            <InstaPreviewSheet
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                slides={slides}
                format={previewFormat}
            />
        </div>
    );
}
