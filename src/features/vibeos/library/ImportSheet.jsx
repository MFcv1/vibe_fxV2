"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
    Camera, FolderOpen, Images, Upload, X,
} from 'lucide-react';
import { Button } from '../primitives';
import { formatBytes } from './libraryDb';
import { detectPlatform, importSources, isMobilePlatform } from './platform';
import { FOLDER_NAME_MAX, directoryNameOf, suggestFolderName } from './folderNaming';
import styles from './library.module.css';

/*
 * Fenetre d'import.
 *
 * Elle repond a une seule question: OU vont les photos, et D'OU viennent-elles.
 *
 * Le "d'ou" est adapte a l'appareil (voir `platform.js`): sur telephone on
 * propose la photothèque, l'appareil photo et les fichiers; sur ordinateur, des
 * photos ou un dossier entier. Ce ne sont pas des chemins d'acces - le web n'en
 * a pas - mais les bons selecteurs systeme, avec les mots du systeme.
 *
 * Le "ou" est un dossier: nouveau (nom propose, modifiable) ou existant. C'est
 * la seule decision demandee, et elle a toujours une reponse par defaut - on
 * peut lancer l'import sans rien lire.
 */

const ICONS = {
    images: Images,
    camera: Camera,
    folder: FolderOpen,
};

export function QuotaBar({ quota, compact = false }) {
    const percent = Math.round(quota.ratio * 100);
    return (
        <div
            className={styles.quota}
            data-compact={compact ? 'true' : 'false'}
            data-tone={quota.full ? 'full' : quota.warning ? 'warn' : 'ok'}
        >
            <span className={styles.quotaTrack} aria-hidden="true">
                <span className={styles.quotaFill} style={{ width: `${Math.max(2, percent)}%` }} />
            </span>
            <span className={styles.quotaLabel} data-numeric>
                {quota.photoCount} / {quota.quota.photos} photos
                <span className={styles.quotaDot}>·</span>
                {formatBytes(quota.bytes)} / {formatBytes(quota.quota.bytes)}
            </span>
        </div>
    );
}

/*
 * La fenetre n'est montee que lorsqu'elle est ouverte, et le corps du dialogue
 * est un composant a part: ses valeurs de depart (nom propose, destination,
 * plateforme) se calculent alors une seule fois, a l'ouverture, dans les
 * initialiseurs d'etat. C'est ce qui evite d'avoir a les "remettre a jour" par
 * effet a chaque ouverture - et les rendus en cascade qui vont avec.
 */
export default function ImportSheet({ open, ...rest }) {
    if (!open) return null;
    return <ImportDialog {...rest} />;
}

function ImportDialog({ onClose, folders, quota, defaultFolderId = null, onFiles }) {
    const inputRef = useRef(null);
    const [platform] = useState(() => detectPlatform());
    const [destination, setDestination] = useState(defaultFolderId ? 'existing' : 'new');
    const [folderId, setFolderId] = useState(defaultFolderId || folders[0]?.id || '');
    const [name, setName] = useState(() => suggestFolderName({
        taken: folders.map((folder) => folder.name),
    }));
    const [nameTouched, setNameTouched] = useState(false);

    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const resolved = platform;
    const sources = importSources(resolved);
    const mobile = isMobilePlatform(resolved);

    const pick = (source) => {
        const input = inputRef.current;
        if (!input) return;
        input.value = '';
        input.accept = source.input.accept || '';
        input.multiple = Boolean(source.input.multiple);
        if (source.input.capture) input.setAttribute('capture', source.input.capture);
        else input.removeAttribute('capture');
        /* `webkitdirectory` doit etre pose ET retire: un input qui l'a garde
           depuis un clic precedent ouvrirait le selecteur de dossier alors
           qu'on demande des photos. */
        input.webkitdirectory = Boolean(source.input.webkitdirectory);
        input.click();
    };

    const send = (fileList) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        /* Un dossier choisi impose son nom, sauf si l'utilisateur en a tape un. */
        const picked = directoryNameOf(files);
        const finalName = nameTouched || !picked ? name : picked;
        onFiles(files, destination === 'existing' && folderId
            ? { folderId }
            : { folderName: finalName, source: picked ? 'directory' : 'files' });
        onClose();
    };

    return (
        <div className={styles.modalBackdrop} onClick={onClose} data-testid="vibeos-library-import-sheet">
            <section
                role="dialog"
                aria-modal="true"
                aria-label="Importer des photos"
                className={styles.modal}
                onClick={(event) => event.stopPropagation()}
            >
                <header className={styles.modalHead}>
                    <div>
                        <h2 className={styles.modalTitle}>Importer des photos</h2>
                        <p className={styles.modalHint}>
                            Depuis {resolved.id === 'unknown' ? 'cet appareil' : resolved.label}
                        </p>
                    </div>
                    <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Fermer">
                        <X size={16} />
                    </button>
                </header>

                <div className={styles.modalBody}>
                    <fieldset className={styles.field}>
                        <legend className={styles.fieldLabel}>Ranger dans</legend>
                        <div className={styles.segment} role="radiogroup" aria-label="Dossier de destination">
                            <button
                                type="button"
                                role="radio"
                                aria-checked={destination === 'new'}
                                data-active={destination === 'new' ? 'true' : 'false'}
                                onClick={() => setDestination('new')}
                            >
                                Nouveau dossier
                            </button>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={destination === 'existing'}
                                data-active={destination === 'existing' ? 'true' : 'false'}
                                onClick={() => setDestination('existing')}
                                disabled={!folders.length}
                            >
                                Dossier existant
                            </button>
                        </div>

                        {destination === 'new' ? (
                            <input
                                className={styles.textInput}
                                value={name}
                                maxLength={FOLDER_NAME_MAX}
                                onChange={(event) => { setName(event.target.value); setNameTouched(true); }}
                                aria-label="Nom du dossier"
                                placeholder="Nom du dossier"
                                data-testid="vibeos-library-folder-name"
                            />
                        ) : (
                            <select
                                className={styles.textInput}
                                value={folderId}
                                onChange={(event) => setFolderId(event.target.value)}
                                aria-label="Dossier existant"
                            >
                                {folders.map((folder) => (
                                    <option key={folder.id} value={folder.id}>
                                        {folder.name} ({folder.count ?? 0})
                                    </option>
                                ))}
                            </select>
                        )}
                    </fieldset>

                    <div className={styles.field}>
                        <span className={styles.fieldLabel}>Prendre les photos dans</span>
                        <div className={styles.sourceList}>
                            {sources.map((source) => {
                                const Icon = ICONS[source.icon] || Images;
                                return (
                                    <button
                                        key={source.id}
                                        type="button"
                                        className={styles.source}
                                        onClick={() => pick(source)}
                                        data-testid={`vibeos-library-source-${source.id}`}
                                    >
                                        <span className={styles.sourceIcon}><Icon size={18} /></span>
                                        <span className={styles.sourceText}>
                                            <span className={styles.sourceTitle}>{source.title}</span>
                                            <span className={styles.sourceHint}>{source.hint}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {mobile ? null : (
                            <p className={styles.modalDrop}>
                                <Upload size={13} />
                                Ou dépose tes fichiers directement sur la bibliothèque.
                            </p>
                        )}
                    </div>

                    <div className={styles.field}>
                        <span className={styles.fieldLabel}>Espace utilisé</span>
                        <QuotaBar quota={quota} />
                        {quota.full ? (
                            <p className={styles.quotaAlert}>
                                Ta bibliothèque est pleine. Supprime un dossier pour importer à nouveau.
                            </p>
                        ) : null}
                    </div>
                </div>

                <footer className={styles.modalFoot}>
                    <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
                </footer>

                <input
                    ref={inputRef}
                    type="file"
                    className={styles.hiddenInput}
                    onChange={(event) => {
                        send(event.target.files);
                        event.target.value = '';
                    }}
                    data-testid="vibeos-library-sheet-input"
                />
            </section>
        </div>
    );
}
