"use client";

import { listRoomItems } from './roomDb';
import { fetchRoomBlob } from './roomCloud';
import { roomFileName } from './roomFileName';

/*
 * Recuperer une image de la Room sur son appareil.
 *
 * Ce qui part n'est PAS la vignette affichee a l'ecran, mais le rendu tel que
 * l'atelier l'a fabrique: pleine definition, preset deja cuit dans les pixels
 * (JPEG qualite 0.95 sorti de `buildSocialImages`). Il n'y a rien a
 * reappliquer au telechargement - l'image du disque est exactement celle du
 * carrousel.
 *
 * Deux endroits possibles pour ce fichier, et il faut les deux:
 * - sur l'appareil qui l'a fabrique, il est dans IndexedDB;
 * - ailleurs, la Room est arrivee par le compte et ne porte qu'une adresse
 *   Storage. On rapatrie alors l'image, sinon le bouton ne marcherait que la
 *   ou l'image a ete creee - exactement le defaut qu'on a passe la journee a
 *   corriger sur l'enregistrement.
 *
 * L'etat React de la Room ne garde pas les Blobs (il n'en garde que des
 * adresses d'affichage), d'ou la relecture par identifiant.
 */

/*
 * Declenche l'enregistrement du fichier.
 *
 * On passe TOUJOURS par un Blob local, jamais par l'adresse Storage: sur une
 * adresse d'un autre domaine, le navigateur ignore l'attribut `download` et
 * ouvre l'image dans un onglet au lieu de l'enregistrer.
 */
export async function downloadRoomItem(itemId, index = 0) {
    const rows = await listRoomItems();
    const item = rows.find((row) => row.id === itemId);
    if (!item) return { ok: false, message: 'Image introuvable dans la Room.' };

    const blob = item.blob || await fetchRoomBlob(item.cloud?.url, item.cloud?.path);
    if (!blob) {
        return { ok: false, message: 'Image indisponible : elle n’est ni sur cet appareil, ni dans ton compte.' };
    }

    const nom = roomFileName(item, index, blob.type || item.type);
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    lien.rel = 'noopener';
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    /* Revoquer tout de suite couperait l'enregistrement en cours sur certains
       navigateurs: on laisse le temps a la requete de partir. */
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { ok: true, name: nom, bytes: blob.size || 0 };
}
