"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, ArrowRight, Check, Eye, FolderPlus, Images, LayoutGrid, RefreshCw, Save,
    Smartphone, Trash2,
} from 'lucide-react';
import { Badge, Button, EmptyState, IconButton, Sheet, useToast } from '../primitives';
import InstaPreviewSheet from '../layout/InstaPreviewSheet';
import { ROOM_CAROUSEL_MAX, useRoom } from './RoomProvider';
import {
    listTargetFolders, previewRoomFolderSync, suggestRoomFolderName, syncRoomToFolder,
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
    /* Ce que la synchronisation ferait sur la destination choisie, annonce
       AVANT le clic: ce bouton peut supprimer des dizaines de fiches. */
    const [plan, setPlan] = useState(null);

    const openSave = useCallback(async () => {
        const liste = await listTargetFolders();
        setFolders(liste);
        setFolderId(liste[0]?.id || '');
        setDestination(liste.length ? 'new' : 'new');
        setFolderName(suggestRoomFolderName(items, liste.map((folder) => folder.name)));
        /* Le plan de la fois d'avant ne vaut plus rien: la Room a pu changer. */
        setPlan(null);
        setSaveOpen(true);
    }, [items]);

    /*
     * Recompte a chaque changement de destination: un dossier deja servi ne
     * reprend que les images ajoutees depuis, un dossier neuf prend tout.
     */
    /* La destination a laquelle un plan se rapporte. Le plan porte cette cle
       avec lui: sans elle, changer de dossier laisserait afficher les chiffres
       du precedent pendant la lecture du suivant - donc des chiffres faux. */
    const cible = destination === 'existing' ? folderId : null;
    useEffect(() => {
        if (!saveOpen) return undefined;
        let vivant = true;
        previewRoomFolderSync(cible).then((valeur) => {
            if (vivant) setPlan({ ...valeur, cle: cible || 'new' });
        });
        return () => { vivant = false; };
    }, [saveOpen, cible, count]);

    const planCourant = plan && plan.cle === (cible || 'new') ? plan : null;
    const aEnregistrer = planCourant ? planCourant.aCreer : count;
    const rienAFaire = Boolean(planCourant?.rienAFaire);

    /*
     * Aligner le dossier sur la Room.
     *
     * Ce n'est plus « ajouter ce qui manque » mais « rendre les deux d'accord »:
     * ajouter, retirer les copies en trop, reparer les liens des fiches
     * d'avant. Rejouable: la deuxieme fois, il n'y a plus rien a faire, et le
     * bouton le dit.
     */
    const handleSave = useCallback(async () => {
        setSaving({ done: 0, total: aEnregistrer });
        const result = await syncRoomToFolder({
            folderId: cible,
            folderName: destination === 'new' ? folderName : null,
            onProgress: (done, total) => setSaving({ done, total }),
        });
        setSaving(null);
        setSaveOpen(false);
        if (!result.ok) {
            toast.push(result.message || 'Rien à enregistrer.', { tone: 'danger' });
            return;
        }
        /* On raconte ce qui a ete fait, pas ce qui aurait du l'etre. */
        const faits = [];
        if (result.added) faits.push(`${result.added} ajoutée${result.added > 1 ? 's' : ''}`);
        if (result.supprimees) faits.push(`${result.supprimees} doublon${result.supprimees > 1 ? 's' : ''} supprimé${result.supprimees > 1 ? 's' : ''}`);
        if (result.reparees) faits.push(`${result.reparees} fiche${result.reparees > 1 ? 's' : ''} réparée${result.reparees > 1 ? 's' : ''}`);
        if (result.introuvables) faits.push(`${result.introuvables} image${result.introuvables > 1 ? 's' : ''} illisible${result.introuvables > 1 ? 's' : ''}`);
        toast.push(
            faits.length
                ? `« ${result.folderName} » · ${faits.join(', ')} · ${result.totalDossier} photo${result.totalDossier > 1 ? 's' : ''} dans le dossier.`
                : `« ${result.folderName} » était déjà à jour · ${result.totalDossier} photo${result.totalDossier > 1 ? 's' : ''}.`,
            { tone: result.message ? 'warn' : 'success', duration: 7000 },
        );
        if (result.message) toast.push(result.message, { tone: 'danger', duration: 7000 });
        /* On emmene l'utilisateur dans la bibliotheque: c'est cet ecran qui
           porte la synchronisation avec le compte, donc c'est en y arrivant que
           les suppressions et les envois partent vraiment vers le serveur. */
        router.push('/creer/bibliotheque');
    }, [aEnregistrer, cible, destination, folderName, router, toast]);

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

                    {/* Ce que le bouton va faire, en clair et avant le clic. Il
                        peut supprimer des dizaines de fiches: l'annoncer n'est
                        pas une politesse, c'est la condition pour oser cliquer. */}
                    {planCourant && destination === 'existing' ? (
                        <ul className={styles.planList} data-testid="vibeos-room-sync-plan">
                            <li>
                                <strong data-numeric>{planCourant.dejaLa}</strong> de ces{' '}
                                {planCourant.total} image{planCourant.total > 1 ? 's' : ''} sont déjà dans ce
                                dossier, bien rangées.
                            </li>
                            {planCourant.aCreer ? (
                                <li data-tone="add">
                                    <strong data-numeric>{planCourant.aCreer}</strong> à ajouter.
                                </li>
                            ) : null}
                            {planCourant.aSupprimer ? (
                                <li data-tone="drop">
                                    <strong data-numeric>{planCourant.aSupprimer}</strong>{' '}
                                    copie{planCourant.aSupprimer > 1 ? 's' : ''} en trop à supprimer, ici
                                    et dans ton compte.
                                </li>
                            ) : null}
                            {planCourant.aReparer ? (
                                <li>
                                    <strong data-numeric>{planCourant.aReparer}</strong> fiche
                                    {planCourant.aReparer > 1 ? 's' : ''} d’avant à rattacher à leur image
                                    — elles ne seront plus jamais réimportées.
                                </li>
                            ) : null}
                            {planCourant.horsRoom ? (
                                <li>
                                    <strong data-numeric>{planCourant.horsRoom}</strong> photo
                                    {planCourant.horsRoom > 1 ? 's' : ''} de ce dossier ne vien
                                    {planCourant.horsRoom > 1 ? 'nent' : 't'} pas de la Room : on n’y
                                    touche pas.
                                </li>
                            ) : null}
                            {planCourant.rienAFaire ? (
                                <li data-tone="ok">Tout est déjà calé. Rien à faire.</li>
                            ) : null}
                        </ul>
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
                            icon={destination === 'existing' ? <RefreshCw size={13} /> : <Save size={13} />}
                            onClick={handleSave}
                            disabled={
                                Boolean(saving)
                                || (destination === 'existing' && (!folderId || rienAFaire))
                                || (destination === 'new' && !count)
                            }
                            data-testid="vibeos-room-save-confirm"
                        >
                            {(() => {
                                if (saving) return `Enregistrement ${saving.done}/${saving.total}`;
                                if (destination === 'new') {
                                    return `Enregistrer ${count} image${count > 1 ? 's' : ''}`;
                                }
                                if (rienAFaire) return 'Tout est déjà calé';
                                return 'Synchroniser ce dossier';
                            })()}
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
