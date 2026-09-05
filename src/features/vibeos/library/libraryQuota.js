"use client";

/*
 * Quota de la bibliotheque.
 *
 * Deux plafonds, et il faut les deux: 1000 photos empeche la liste de devenir
 * ingerable et borne le nombre de documents Firestore; 5 Go borne la FACTURE
 * Storage, qui ne depend pas du nombre de fichiers mais de leur poids. Sans le
 * second, cinquante RAW de 80 Mo passeraient sans alerte.
 *
 * Le plafond est verifie AVANT l'import: refuser apres coup obligerait a
 * supprimer ce qu'on vient d'ecrire, et sur une serie de 200 photos on aurait
 * deja consomme le reseau. Un import trop gros est donc coupe net, avec le
 * nombre exact de places restantes.
 *
 * Module pur: aucune dependance navigateur, teste hors navigateur par
 * `scripts/smoke-vibeos-library.mjs`.
 */

export const LIBRARY_QUOTA = {
    photos: 1000,
    bytes: 5 * 1024 * 1024 * 1024,
};

/* Au-dela, la jauge passe en alerte: il reste de la place, mais il faut le dire
   avant que l'utilisateur se retrouve bloque en plein import. */
export const QUOTA_WARN_RATIO = 0.85;

export function quotaState({ photoCount = 0, bytes = 0, quota = LIBRARY_QUOTA } = {}) {
    const photoRatio = quota.photos ? photoCount / quota.photos : 0;
    const byteRatio = quota.bytes ? bytes / quota.bytes : 0;
    const ratio = Math.max(photoRatio, byteRatio);
    return {
        photoCount,
        bytes,
        quota,
        photosLeft: Math.max(0, quota.photos - photoCount),
        bytesLeft: Math.max(0, quota.bytes - bytes),
        ratio: Math.min(1, ratio),
        /* Quel plafond parle en premier: c'est lui qu'on montre. */
        driver: byteRatio > photoRatio ? 'bytes' : 'photos',
        warning: ratio >= QUOTA_WARN_RATIO && ratio < 1,
        full: ratio >= 1,
    };
}

/*
 * Combien de fichiers de cette selection on accepte.
 *
 * `files` est une liste d'objets porteurs d'une taille (des `File`, ou de
 * simples `{ size }` dans les tests). On coupe au premier des deux plafonds
 * atteint, et on dit lequel.
 */
export function checkImport({
    photoCount = 0, bytes = 0, files = [], quota = LIBRARY_QUOTA, scope = 'library',
} = {}) {
    const state = quotaState({ photoCount, bytes, quota });
    let accepted = 0;
    let acceptedBytes = 0;
    let blockedBy = null;

    for (const file of files) {
        const size = Number(file?.size || 0);
        if (photoCount + accepted + 1 > quota.photos) { blockedBy = 'photos'; break; }
        if (bytes + acceptedBytes + size > quota.bytes) { blockedBy = 'bytes'; break; }
        accepted += 1;
        acceptedBytes += size;
    }

    const rejected = files.length - accepted;
    return {
        ok: accepted > 0,
        accepted,
        acceptedBytes,
        rejected,
        blockedBy,
        state,
        message: buildMessage({ accepted, rejected, blockedBy, state, scope }),
    };
}

function buildMessage({ accepted, rejected, blockedBy, state, scope = 'library' }) {
    if (!rejected) return '';
    const limit = blockedBy === 'bytes'
        ? `${Math.round(state.quota.bytes / (1024 * 1024 * 1024))} Go`
        : `${state.quota.photos} photos`;
    if (!accepted) {
        return scope === 'scout'
            ? `Trop de photos d’un coup (${limit} au maximum). Termine ou supprime un tri en cours, puis recommence.`
            : `Quota atteint : ta bibliothèque est pleine (${limit}). Supprime un dossier pour importer à nouveau.`;
    }
    if (scope === 'scout') {
        return `Limite du tri à ${limit} : ${accepted} photo${accepted > 1 ? 's' : ''} à passer en revue, ${rejected} laissée${rejected > 1 ? 's' : ''} de côté.`;
    }
    return `Quota atteint à ${limit} : ${accepted} photo${accepted > 1 ? 's' : ''} importée${accepted > 1 ? 's' : ''}, ${rejected} laissée${rejected > 1 ? 's' : ''} de côté.`;
}
