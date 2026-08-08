"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocalSoundtrackLibrary } from '@/features/vibefx-studio/soundtrack/hooks/useLocalSoundtrackLibrary';
import { useProjectSoundLibrary } from '@/features/vibefx-studio/soundtrack/hooks/useProjectSoundLibrary';
import { useSoundtrackSearch } from '@/features/vibefx-studio/soundtrack/hooks/useSoundtrackSearch';
import { getSoundtrackPlayableUrl } from '@/features/vibefx-studio/soundtrack/hooks/useSoundtrackController';
import { fetchAudioBlobForTrack } from '@/features/vibefx-studio/soundtrack/services/soundtrackDownloads';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';
import { useVibeOsAudio } from '../audio/AudioProvider';

/*
 * Couche VibeOS de l'espace Soundtrack.
 *
 * Elle ne reecrit AUCUNE logique metier: elle assemble les hooks existants de
 * `vibefx-studio/soundtrack` (bibliotheque locale, bibliotheque projet,
 * recherche fournisseurs) et branche la lecture sur le provider audio global de
 * VibeOS. C'est la seule difference d'architecture avec l'ancien ecran, et elle
 * est voulue: `useSoundtrackPlayer`/`useSoundtrackController` possedent leur
 * propre element <audio>, qui mourrait a chaque changement de page. Ces deux
 * hooks restent intacts pour l'ancien /studio.
 */

const RECENT_IMPORTS_LIMIT = 12;

const getTrackImportTime = (track = {}) => {
    const timestamps = [track.importedAt, track.updatedAt, track.addedAt, track.createdAt, track.acquiredAt]
        .map((value) => Date.parse(value))
        .filter(Number.isFinite);
    return timestamps.length ? Math.max(...timestamps) : 0;
};

/* Pochette deterministe: pas d'illustration dans les manifests, on derive une
   teinte stable de l'identite de la piste pour que la grille reste lisible. */
export function getTrackHue(track = {}) {
    const key = String(track.id || track.title || 'piste');
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) {
        hash = (hash * 31 + key.charCodeAt(index)) % 360;
    }
    return hash;
}

/*
 * Beaucoup de manifests recopient le titre dans `attribution`: afficher la
 * meme phrase deux fois ne renseigne personne, on retombe alors sur la source.
 */
export function getTrackArtist(track = {}) {
    const title = String(track.title || '').trim().toLowerCase();
    const candidate = track.artist || track.attribution || '';
    if (candidate && candidate.trim().toLowerCase() !== title) return candidate;
    return track.sourceName || track.provider || 'Source inconnue';
}

export function formatTime(seconds = 0) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) return '--:--';
    const minutes = Math.floor(value / 60);
    const rest = Math.floor(value % 60);
    return `${minutes}:${String(rest).padStart(2, '0')}`;
}

const toEntry = (track) => ({
    id: track.id,
    title: track.title || 'Piste sans titre',
    artist: getTrackArtist(track),
    duration: Number(track.duration) || 0,
    hue: getTrackHue(track),
});

export function useVibeOsSoundtrack() {
    const localLibrary = useLocalSoundtrackLibrary();
    const projectLibrary = useProjectSoundLibrary();
    const search = useSoundtrackSearch();
    const audio = useVibeOsAudio();
    const router = useRouter();

    const [recentImportIds, setRecentImportIds] = useState([]);
    const [busy, setBusy] = useState('');
    const [notice, setNotice] = useState('');

    /*
     * Le resolveur de source est donne UNE fois au provider audio: il doit donc
     * lire les bibliotheques a travers des refs, sinon il figerait la version du
     * premier rendu.
     */
    const localLibraryRef = useRef(localLibrary);
    useEffect(() => {
        localLibraryRef.current = localLibrary;
    }, [localLibrary]);

    const projectTracks = projectLibrary.tracks;
    const localTracks = localLibrary.tracks;

    /* Index unique de toutes les pistes connues: sert au resolveur de source du
       provider audio, qui ne recoit que des identifiants. */
    const trackById = useMemo(() => {
        const map = new Map();
        [...localTracks, ...projectTracks, ...search.results].forEach((track) => {
            if (track?.id && !map.has(track.id)) map.set(track.id, track);
        });
        return map;
    }, [localTracks, projectTracks, search.results]);
    const trackByIdRef = useRef(trackById);
    useEffect(() => {
        trackByIdRef.current = trackById;
    }, [trackById]);

    const libraryTracks = useMemo(() => {
        const map = new Map();
        [...projectTracks, ...localTracks].forEach((track) => {
            if (track?.id && !map.has(track.id)) map.set(track.id, track);
        });
        return Array.from(map.values());
    }, [localTracks, projectTracks]);

    const recentImports = useMemo(() => {
        const flagged = libraryTracks.filter((track) => recentImportIds.includes(track.id));
        const rest = libraryTracks
            .filter((track) => !recentImportIds.includes(track.id))
            .sort((a, b) => getTrackImportTime(b) - getTrackImportTime(a));
        return [...flagged, ...rest].slice(0, RECENT_IMPORTS_LIMIT);
    }, [libraryTracks, recentImportIds]);

    const playableTracks = useMemo(
        () => libraryTracks.filter((track) => getSoundtrackPlayableUrl(track) || track.fileAvailable),
        [libraryTracks],
    );

    /*
     * Resolveur de source du provider audio. Il prefere TOUJOURS le fichier
     * local (Blob) a une URL d'objet: ces URLs sont revoquees quand cet ecran
     * est demonte, alors qu'un Blob relu ici donne au provider une source dont
     * il garde la propriete - c'est ce qui fait tenir la lecture d'une page a
     * l'autre.
     */
    const resolveSource = useCallback(async (entry) => {
        const track = trackByIdRef.current.get(entry.id);
        if (!track) return '';
        try {
            const file = await localLibraryRef.current.getTrackFile(track);
            if (file) return file;
        } catch {
            /* Pas de fichier local: on tentera l'URL distante ci-dessous. */
        }
        const remoteUrl = getSoundtrackPlayableUrl(track);
        if (remoteUrl) return remoteUrl;
        try {
            const fetched = await fetchAudioBlobForTrack(track);
            return fetched?.blob || '';
        } catch {
            return '';
        }
    }, []);

    useEffect(() => {
        audio.setSourceResolver(resolveSource);
    }, [audio, resolveSource]);

    /* La file suit la bibliotheque: l'enchainement automatique continue meme
       quand on quitte /creer/son (la file vit dans le provider). */
    useEffect(() => {
        audio.setQueue(playableTracks.map(toEntry));
    }, [audio, playableTracks]);

    const playTrack = useCallback((track) => {
        if (!track?.id) return;
        if (audio.track?.id === track.id && audio.status !== 'error') {
            audio.toggle();
            return;
        }
        audio.playTrack(toEntry(track));
    }, [audio]);

    const playList = useCallback((tracks = []) => {
        const first = tracks.find((track) => track?.id);
        if (first) audio.playTrack(toEntry(first));
    }, [audio]);

    const markImported = useCallback((tracks = []) => {
        const ids = tracks.map((track) => track?.id).filter(Boolean);
        if (ids.length) setRecentImportIds((current) => Array.from(new Set([...ids, ...current])).slice(0, RECENT_IMPORTS_LIMIT));
    }, []);

    /* « + Bibliotheque » sur un resultat de recherche: telechargement local (ou
       import projet si Firebase est pret), exactement comme l'ancien ecran. */
    const addToLibrary = useCallback(async (track) => {
        if (!track?.id) return null;
        setBusy(track.id);
        try {
            const imported = projectLibrary.capability?.ready
                ? await projectLibrary.importTrackToProject(track)
                : await localLibrary.downloadTrackLocally(track);
            if (imported) markImported([imported]);
            setNotice(imported ? `« ${track.title} » ajoutée à ta bibliothèque.` : 'Import refusé par la bibliothèque.');
            return imported;
        } catch (error) {
            setNotice(error?.message || 'Import impossible.');
            return null;
        } finally {
            setBusy('');
        }
    }, [localLibrary, markImported, projectLibrary]);

    /*
     * « Utiliser dans VibeCut »: meme chaine que l'ancien ecran (fichier local,
     * sinon Storage, sinon telechargement), puis ajout dans le store video
     * partage avec /video, et navigation.
     */
    const useInVibeCut = useCallback(async (track) => {
        if (!track?.id) return;
        setBusy(track.id);
        try {
            let file = await localLibrary.getTrackFile(track);
            if (!file && track.storagePath && track.downloadUrl) {
                const response = await fetch(track.downloadUrl);
                file = await response.blob();
            }
            if (!file && (track.downloadUrl || track.previewUrl || track.url)) {
                const fetched = await fetchAudioBlobForTrack(track);
                file = fetched.blob;
            }
            if (!file) {
                await localLibrary.checkMissingFiles();
                setNotice('Fichier audio introuvable. Réimporte la piste avant de l\'envoyer dans VibeCut.');
                return;
            }
            await projectLibrary.markUsed(track);
            const url = URL.createObjectURL(file);
            const videoRightsStatus = track.rightsStatus === 'verified-free'
                ? 'credit-required'
                : track.rightsStatus === 'needs-review'
                    ? 'review'
                    : track.rightsStatus;
            useVideoStore.getState().addAudioTrack({
                id: `soundtrack-${track.id}-${Date.now()}`,
                name: track.title,
                file,
                url,
                duration: track.duration || 10,
                startTime: useVideoStore.getState().currentTime || 0,
                source: 'soundtrack-local',
                provider: track.provider,
                sourceName: track.sourceName,
                sourceUrl: track.sourceUrl,
                license: track.license,
                licenseUrl: track.licenseUrl,
                attribution: track.attribution,
                rightsStatus: videoRightsStatus,
                commercialUse: track.commercialUse === true,
                socialUse: track.socialUse === true,
            });
            setNotice(`« ${track.title} » envoyée dans VibeCut.`);
            router.push('/video');
        } catch (error) {
            setNotice(error?.message || 'Envoi vers VibeCut impossible.');
        } finally {
            setBusy('');
        }
    }, [localLibrary, projectLibrary, router]);

    return {
        localLibrary,
        projectLibrary,
        search,
        audio,
        projectTracks,
        localTracks,
        libraryTracks,
        recentImports,
        playableTracks,
        busy,
        notice,
        setNotice,
        playTrack,
        playList,
        addToLibrary,
        useInVibeCut,
        markImported,
    };
}
