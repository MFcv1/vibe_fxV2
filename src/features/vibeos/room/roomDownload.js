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
 * Declenche l'enregistrement du fichier par un lien.
 *
 * On passe TOUJOURS par un Blob local, jamais par l'adresse Storage: sur une
 * adresse d'un autre domaine, le navigateur ignore l'attribut `download` et
 * ouvre l'image dans un onglet au lieu de l'enregistrer.
 */
function enregistrerParLien(nom, blob) {
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
}

export async function downloadRoomItem(itemId, index = 0) {
    const rows = await listRoomItems();
    const item = rows.find((row) => row.id === itemId);
    if (!item) return { ok: false, message: 'Image introuvable dans la Room.' };

    const blob = item.blob || await fetchRoomBlob(item.cloud?.url, item.cloud?.path);
    if (!blob) {
        return { ok: false, message: 'Image indisponible : elle n’est ni sur cet appareil, ni dans ton compte.' };
    }

    const nom = roomFileName(item, index, blob.type || item.type);
    enregistrerParLien(nom, blob);
    return { ok: true, name: nom, bytes: blob.size || 0 };
}

/* ---------- Tout recuperer d'un coup ---------- */

/*
 * Choisir un vrai dossier de destination, ou pas.
 *
 * Chrome et Edge savent rendre une poignee de DOSSIER inscriptible
 * (`showDirectoryPicker`): on ecrit alors les cent trente-deux fichiers dedans,
 * l'utilisateur choisit l'endroit UNE fois, et le navigateur ne pose aucune
 * question de plus. Safari et Firefox ne l'ont pas; la, chaque image passe par
 * un telechargement classique et atterrit dans le dossier de telechargements du
 * navigateur. Les deux chemins existent parce que le second, meme moins beau,
 * marche partout - et c'est celui du telephone.
 */
export function canPickDirectory() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function pickDownloadDirectory() {
    if (!canPickDirectory()) return null;
    try {
        return await window.showDirectoryPicker({ id: 'vibeos-room', mode: 'readwrite' });
    } catch {
        /* L'utilisateur a ferme la fenetre: ce n'est pas une erreur. */
        return null;
    }
}

/* Ce qu'il y a a recuperer, avant de lancer quoi que ce soit: l'ecran doit
   pouvoir annoncer un nombre et un poids, pas demarrer dans le noir. */
export async function roomDownloadPlan() {
    const rows = await listRoomItems();
    const bytes = rows.reduce((sum, row) => sum + (row.bytes || row.blob?.size || 0), 0);
    /* Celles qui ne sont pas sur cet appareil devront redescendre du compte:
       c'est la difference entre « trois secondes » et « plusieurs minutes ». */
    const aRapatrier = rows.filter((row) => !row.blob).length;
    return { total: rows.length, bytes, aRapatrier };
}

/*
 * Ecrit une image dans le dossier choisi.
 *
 * `create: true` sur un nom deja pris rend la poignee du fichier EXISTANT, que
 * l'on tronque en ecrivant: relancer un telechargement remplace donc les
 * fichiers au lieu d'en empiler des copies numerotees.
 */
async function ecrireDansDossier(directory, nom, blob) {
    const fichier = await directory.getFileHandle(nom, { create: true });
    const flux = await fichier.createWritable();
    await flux.write(blob);
    await flux.close();
}

/*
 * Recupere toute la Room, dans l'ordre du carrousel.
 *
 * Une image a la fois, jamais toutes en memoire: cent trente-deux rendus pleine
 * definition, c'est plusieurs centaines de megaoctets, et les tenir ensemble
 * ferait tomber l'onglet - surtout sur telephone.
 *
 * `onProgress(fait, total, nom)` nourrit l'ecran, et `shouldStop()` permet
 * d'arreter en cours de route: un lot de cette taille prend plusieurs minutes
 * s'il faut le rapatrier du compte, et rester coince dedans serait pire que de
 * ne pas l'avoir propose.
 */
export async function downloadRoomAll({
    directory = null, onProgress = null, shouldStop = null,
} = {}) {
    const rows = await listRoomItems();
    if (!rows.length) return { ok: false, message: 'La Room est vide.' };

    let done = 0;
    let failed = 0;
    let stopped = false;
    for (let index = 0; index < rows.length; index += 1) {
        if (shouldStop?.()) { stopped = true; break; }
        const item = rows[index];
        const blob = item.blob || await fetchRoomBlob(item.cloud?.url, item.cloud?.path);
        if (!blob) { failed += 1; onProgress?.(done + failed, rows.length, null); continue; }
        const nom = roomFileName(item, index, blob.type || item.type);
        try {
            if (directory) {
                await ecrireDansDossier(directory, nom, blob);
            } else {
                enregistrerParLien(nom, blob);
                /* Sans cette pause, Chrome prend la rafale pour un abus et
                   bloque tout apres le dixieme fichier. */
                await new Promise((resolve) => { window.setTimeout(resolve, 350); });
            }
            done += 1;
        } catch {
            failed += 1;
        }
        onProgress?.(done + failed, rows.length, nom);
    }
    return {
        ok: true, done, failed, stopped, total: rows.length,
    };
}
