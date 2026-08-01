"use client";

import React, { useRef, useState } from 'react';
import { Check, Music, Upload, X } from 'lucide-react';
import { Button, IconButton } from '../primitives';
import styles from './quick.module.css';

/*
 * Ajout de musique.
 *
 * L'export exige un manifeste de droits complet (source, preuve, licence, usage
 * social). Plutot que d'inventer ces metadonnees - ce qui bloquerait l'export
 * plus tard sans que l'utilisateur comprenne pourquoi - on les demande ici, en
 * deux clics dans le cas courant.
 */

const ORIGINS = [
    {
        id: 'owned',
        label: 'Musique dont je détiens les droits',
        hint: 'Création personnelle, musique achetée, ou piste libre de droits que tu possèdes',
        rights: {
            sourceName: 'Fichier fourni par l’utilisateur',
            sourceUrl: 'local://import-utilisateur',
            license: 'Droits détenus ou acquis par l’utilisateur',
            licenseUrl: 'local://declaration-utilisateur',
            rightsStatus: 'user-declared',
            commercialUse: true,
        },
    },
    {
        id: 'licensed',
        label: 'Musique sous licence externe',
        hint: 'Bibliothèque en ligne, artiste tiers : renseigne la source et la licence',
        rights: {
            sourceName: '',
            sourceUrl: '',
            license: '',
            licenseUrl: '',
            rightsStatus: 'licensed-project',
            commercialUse: false,
        },
    },
];

export default function MusicSheet({ open, onClose, onConfirm }) {
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [originId, setOriginId] = useState('owned');
    const [fields, setFields] = useState({ sourceName: '', sourceUrl: '', license: '', licenseUrl: '', attribution: '' });
    const [socialUse, setSocialUse] = useState(false);
    const [error, setError] = useState('');

    if (!open) return null;

    const origin = ORIGINS.find((item) => item.id === originId) || ORIGINS[0];
    const needsFields = originId === 'licensed';

    // Duree du morceau: necessaire pour borner le curseur "debut dans le morceau".
    const readAudioDuration = (candidate) => new Promise((resolve) => {
        try {
            const audio = new Audio(URL.createObjectURL(candidate));
            const done = (value) => { audio.src = ''; resolve(value); };
            audio.addEventListener('loadedmetadata', () => done(Number.isFinite(audio.duration) ? audio.duration : 0));
            audio.addEventListener('error', () => done(0));
            window.setTimeout(() => done(0), 4000);
        } catch {
            resolve(0);
        }
    });

    const handleConfirm = async () => {
        if (!file) {
            setError('Choisis d’abord un fichier audio.');
            return;
        }
        if (!socialUse) {
            setError('Confirme que tu peux utiliser cette musique sur les réseaux sociaux.');
            return;
        }
        if (needsFields && (!fields.sourceName.trim() || !fields.sourceUrl.trim() || !fields.license.trim() || !fields.licenseUrl.trim())) {
            setError('Renseigne la source, sa preuve, la licence et son lien.');
            return;
        }
        const sourceDuration = await readAudioDuration(file);
        onConfirm({
            file,
            sourceDuration,
            rights: {
                ...origin.rights,
                ...(needsFields
                    ? {
                        sourceName: fields.sourceName.trim(),
                        sourceUrl: fields.sourceUrl.trim(),
                        license: fields.license.trim(),
                        licenseUrl: fields.licenseUrl.trim(),
                    }
                    : {}),
                attribution: fields.attribution.trim(),
                socialUse: true,
            },
        });
        setFile(null);
        setSocialUse(false);
        setError('');
    };

    return (
        <div
            className={styles.sheetBackdrop}
            role="dialog"
            aria-modal="true"
            aria-label="Ajouter une musique"
            data-testid="vibecut-music-sheet"
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
            <div className={styles.sheet}>
                <div className={styles.sheetHead}>
                    <h2 className={styles.sheetTitle}>Ajouter une musique</h2>
                    <IconButton label="Fermer" onClick={onClose}><X size={16} /></IconButton>
                </div>

                <div className={styles.sheetBody}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        hidden
                        onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); }}
                        data-testid="vibecut-music-file"
                    />
                    <button
                        type="button"
                        className={[styles.musicDrop, file ? styles.musicDropFilled : ''].filter(Boolean).join(' ')}
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="vibecut-music-pick"
                    >
                        <span className={styles.musicDropIcon}>{file ? <Music size={18} /> : <Upload size={18} />}</span>
                        <span>
                            <strong>{file ? file.name : 'Choisir un fichier audio'}</strong>
                            <small>MP3, WAV, M4A, OGG</small>
                        </span>
                    </button>

                    <div className={styles.group}>
                        <h3 className={styles.groupTitle}>Origine de la musique</h3>
                        {ORIGINS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                aria-pressed={originId === item.id}
                                onClick={() => { setOriginId(item.id); setError(''); }}
                                className={[styles.transitionOption, originId === item.id ? styles.transitionOptionActive : ''].filter(Boolean).join(' ')}
                                data-testid={`vibecut-music-origin-${item.id}`}
                            >
                                <span className={styles.transitionIcon}>{originId === item.id ? <Check size={14} /> : <Music size={14} />}</span>
                                <span className={styles.transitionText}>
                                    <span className={styles.transitionName}>{item.label}</span>
                                    <span className={styles.transitionHint}>{item.hint}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {needsFields ? (
                        <div className={styles.group}>
                            {[
                                { key: 'sourceName', label: 'Source', placeholder: 'Nom de la bibliothèque ou de l’artiste' },
                                { key: 'sourceUrl', label: 'Lien de la source', placeholder: 'https://…' },
                                { key: 'license', label: 'Licence', placeholder: 'Nom de la licence' },
                                { key: 'licenseUrl', label: 'Lien de la licence', placeholder: 'https://…' },
                                { key: 'attribution', label: 'Attribution (si demandée)', placeholder: 'Crédit à afficher' },
                            ].map((field) => (
                                <label key={field.key} className={styles.fieldLabel}>
                                    {field.label}
                                    <input
                                        className={styles.textInput}
                                        value={fields[field.key]}
                                        placeholder={field.placeholder}
                                        onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                                        data-testid={`vibecut-music-${field.key}`}
                                    />
                                </label>
                            ))}
                        </div>
                    ) : null}

                    <label className={styles.checkboxRow} data-testid="vibecut-music-social">
                        <input
                            type="checkbox"
                            checked={socialUse}
                            onChange={(event) => { setSocialUse(event.target.checked); setError(''); }}
                        />
                        <span>
                            Je confirme pouvoir utiliser cette musique dans une vidéo publiée sur les réseaux sociaux.
                        </span>
                    </label>

                    {error ? <p className={styles.sheetError} role="alert" data-testid="vibecut-music-error">{error}</p> : null}
                </div>

                <div className={styles.sheetFoot}>
                    <Button variant="ghost" onClick={onClose}>Annuler</Button>
                    <Button variant="primary" onClick={handleConfirm} data-testid="vibecut-music-confirm">
                        Ajouter la musique
                    </Button>
                </div>
            </div>
        </div>
    );
}
