/*
 * Controleur d'export VibeCut.
 * Extrait tel quel de `panels/ExportVideoPanel.jsx` (deplacement, aucun changement
 * de comportement) pour que les interfaces - ancienne comme nouvelle - consomment
 * la meme logique d'export sans dependre d'un composant d'UI.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import useVideoStore from '../store/videoStore';
import { EXPORT_PRESETS, PlaybackEngine } from '../engine/VideoEngine';
import { drawTextOverlays } from '../engine/textOverlayRenderer';
import { buildExportRightsManifest, getRightsAudit } from '../data/musicRights';
import { buildExportFrameSchedule, resolveTimelineRenderPlan, validateExportAudioMix, validateExportFrameCoverage, validateExportTimeline, validateTimelineRenderPlan } from '../model/timelineModel';
import { persistExportRightsManifest } from '../services/exportRightsManifestClient';
import { buildExportManifest, validateExportManifest, validateExportRenderCoverage } from './exportManifest';
import { getVideoExportDownloadUrl, retryVideoExportJob, startVideoExportJob, subscribeLatestVideoExportJob } from './exportJobService';
import { resolveOutputMediaMetadata } from './exportMediaMetadata';
import { resolveExportRenderMode } from './exportRenderService';
import { buildProfessionalRenderOverrides, createDefaultProfessionalExportSettings, createRenderQueueItem, exportCanvasImage } from '../../../export';

const MIME_CANDIDATES = {
    webm: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'],
    mp4: ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=h264', 'video/mp4'],
};

export const EXPORT_FRAME_RATE_OPTIONS = [
    { value: 'auto', label: 'Auto' },
    { value: 24, label: '24' },
    { value: 25, label: '25' },
    { value: 30, label: '30' },
    { value: 50, label: '50' },
    { value: 60, label: '60' },
];

export function useVideoExportController() {
    const [exportMessage, setExportMessage] = useState('');
    const [proExportMessage, setProExportMessage] = useState('');
    const [exportQualityMode, setExportQualityMode] = useState('pro');
    const [exportFitMode, setExportFitMode] = useState('cover');
    const [activeExportJob, setActiveExportJob] = useState(null);
    const [exportJobHistory, setExportJobHistory] = useState([]);
    const [professionalRenderQueue, setProfessionalRenderQueue] = useState([]);
    const [isExportJobModalOpen, setIsExportJobModalOpen] = useState(false);
    const exportJobAbortRef = useRef(null);
    const [mimeSupport, setMimeSupport] = useState({ webm: false, mp4: false });
    const exportRenderMode = useMemo(() => resolveExportRenderMode(), []);
    const exportModeCopy = useMemo(() => resolveExportModeCopy(exportRenderMode), [exportRenderMode]);
    const {
        sequencePreset, setSequencePreset,
        exportFormat, setExportFormat,
        exportFrameRate, setExportFrameRate,
        isExporting, exportProgress,
        setActivePanel, totalDuration, clips, transitions, transitionItems,
        audioTracks, textOverlays, setIsExporting, setExportProgress,
        projectName, tracks, previewCanvas
    } = useVideoStore();
    const [professionalExportSettings, setProfessionalExportSettings] = useState(() => createDefaultProfessionalExportSettings({
        fileName: projectName || 'vibecut-export',
        presetId: 'instagram-story-reels',
        timelineFps: 30,
    }));

    const preset = EXPORT_PRESETS[sequencePreset] || EXPORT_PRESETS.youtube;
    const exportPlan = useMemo(() => resolveTimelineRenderPlan({
        clips,
        transitions,
        transitionItems,
        textOverlays,
        audioTracks,
        tracks,
        totalDuration,
    }), [audioTracks, clips, textOverlays, totalDuration, tracks, transitions, transitionItems]);
    const hasClips = exportPlan.clips.length > 0;
    const exportClips = exportPlan.clips;
    const sourceFpsMax = useMemo(() => resolveSourceFpsMax(exportClips), [exportClips]);
    const exportFps = useMemo(() => resolveExportFps(preset?.fps, sourceFpsMax, exportFrameRate), [exportFrameRate, preset?.fps, sourceFpsMax]);
    const exportAllTransitions = exportPlan.allTransitions;
    const exportTextOverlays = exportPlan.textOverlays;
    const exportAudioTracks = exportPlan.audioTracks;
    const exportPlaybackClips = exportPlan.playbackClips;
    const hasAudibleClipAudio = exportPlaybackClips.some(clip => Number(clip.volume ?? 100) > 0);
    const shouldMixAudio = hasAudibleClipAudio || exportAudioTracks.length > 0;
    const rightsAudit = useMemo(() => getRightsAudit(exportAudioTracks), [exportAudioTracks]);
    const rightsBlockers = useMemo(() => (
        rightsAudit.flatMap(({ track, issues }) => issues.map(issue => ({ track, issue })))
    ), [rightsAudit]);
    const rightsManifest = useMemo(() => buildExportRightsManifest(exportAudioTracks), [exportAudioTracks]);
    const effectiveExportFormat = exportFormat === 'mp4' && !mimeSupport.mp4 ? 'webm' : exportFormat;
    const formatFallbackActive = exportFormat !== effectiveExportFormat;
    const proExportManifest = useMemo(() => buildExportManifest({
        projectName,
        userId: 'local-user',
        renderPlan: {
            ...exportPlan,
            totalDuration,
        },
        preset,
        sequencePreset,
        exportFps,
        qualityMode: exportQualityMode,
        fitMode: exportFitMode,
        renderSettings: buildProfessionalRenderOverrides(professionalExportSettings),
        rightsManifest,
        frameSchedule: buildExportFrameSchedule({ totalDuration, fps: exportFps }),
        generatedAt: 'local-preflight',
    }), [exportFitMode, exportFps, exportPlan, exportQualityMode, preset, professionalExportSettings, projectName, rightsManifest, sequencePreset, totalDuration]);
    const proExportPreflight = useMemo(() => {
        const fps = exportFps;
        const frameSchedule = buildExportFrameSchedule({ totalDuration, fps });
        const timelineAudit = validateExportTimeline({
            clips: exportClips,
            audioTracks: exportAudioTracks,
            transitionItems: exportAllTransitions,
            totalDuration,
            fps,
            mimeType: 'video/mp4',
        });
        const audioMixAudit = validateExportAudioMix({
            playbackClips: exportPlaybackClips,
            audioTracks: exportAudioTracks,
            shouldMixAudio,
            totalDuration,
        });
        const renderPlanAudit = validateTimelineRenderPlan({
            plan: exportPlan,
            totalDuration,
            frameDuration: frameSchedule.frameDuration || (1 / fps),
        });
        const frameCoverageAudit = validateExportFrameCoverage({
            frameSchedule,
            transitionItems: exportAllTransitions,
            totalDuration,
        });
        const manifestAudit = validateExportManifest(proExportManifest, {
            mode: exportRenderMode,
            allowClientUpload: exportRenderMode === 'firebase',
        });
        const renderCoverage = validateExportRenderCoverage(proExportManifest);
        const rightsErrors = rightsBlockers.map(({ track, issue }) => `${track.name || track.id}: ${issue}.`);
        const errors = [
            ...rightsErrors,
            ...renderCoverage.blockingErrors,
            ...timelineAudit.errors,
            ...audioMixAudit.errors,
            ...renderPlanAudit.errors,
            ...frameCoverageAudit.errors,
            ...manifestAudit.errors,
        ];
        const warnings = [
            ...timelineAudit.warnings,
            ...audioMixAudit.warnings,
            ...renderPlanAudit.warnings,
            ...frameCoverageAudit.warnings,
            ...renderCoverage.degradedWarnings,
            ...manifestAudit.warnings,
        ];

        return {
            errors: Array.from(new Set(errors)),
            warnings: Array.from(new Set(warnings)),
            frameSchedule,
            fps,
            manifest: proExportManifest,
            mode: exportRenderMode,
            modeLabel: exportModeCopy.label,
            renderCoverage,
            status: errors.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'ready',
        };
    }, [exportAllTransitions, exportAudioTracks, exportClips, exportFps, exportModeCopy.label, exportPlaybackClips, exportPlan, exportRenderMode, proExportManifest, rightsBlockers, shouldMixAudio, totalDuration]);
    const exportPreflight = useMemo(() => {
        const fps = exportFps;
        const frameSchedule = buildExportFrameSchedule({ totalDuration, fps });
        const mimeType = getSupportedMimeType(effectiveExportFormat);
        const timelineAudit = validateExportTimeline({
            clips: exportClips,
            audioTracks: exportAudioTracks,
            transitionItems: exportAllTransitions,
            totalDuration,
            fps,
            mimeType,
        });
        const audioMixAudit = validateExportAudioMix({
            playbackClips: exportPlaybackClips,
            audioTracks: exportAudioTracks,
            shouldMixAudio,
            totalDuration,
        });
        const renderPlanAudit = validateTimelineRenderPlan({
            plan: exportPlan,
            totalDuration,
            frameDuration: frameSchedule.frameDuration || (1 / fps),
        });
        const frameCoverageAudit = validateExportFrameCoverage({
            frameSchedule,
            transitionItems: exportAllTransitions,
            totalDuration,
        });
        const browserErrors = typeof MediaRecorder === 'undefined'
            ? ['Export navigateur indisponible sur cette session.']
            : [];
        const AudioContextCtor = typeof window !== 'undefined'
            ? (window.AudioContext || window.webkitAudioContext)
            : null;
        const audioMixErrors = shouldMixAudio && !AudioContextCtor
            ? ['Mix audio export indisponible: AudioContext non supporte par ce navigateur.']
            : [];
        const rightsErrors = rightsBlockers.map(({ track, issue }) => `${track.name || track.id}: ${issue}.`);
        const errors = [
            ...browserErrors,
            ...audioMixErrors,
            ...rightsErrors,
            ...timelineAudit.errors,
            ...audioMixAudit.errors,
            ...renderPlanAudit.errors,
            ...frameCoverageAudit.errors,
        ];
        const warnings = [
            ...timelineAudit.warnings,
            ...audioMixAudit.warnings,
            ...renderPlanAudit.warnings,
            ...frameCoverageAudit.warnings,
        ];

        return {
            errors,
            warnings,
            frameSchedule,
            fps,
            mimeType,
            status: errors.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'ready',
        };
    }, [effectiveExportFormat, exportAllTransitions, exportAudioTracks, exportClips, exportFps, exportPlaybackClips, exportPlan, rightsBlockers, shouldMixAudio, totalDuration]);

    useEffect(() => {
        if (typeof MediaRecorder === 'undefined') return;
        setMimeSupport({
            webm: [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm',
            ].some((candidate) => MediaRecorder.isTypeSupported(candidate)),
            mp4: [
                'video/mp4;codecs=h264,aac',
                'video/mp4;codecs=h264',
                'video/mp4',
            ].some((candidate) => MediaRecorder.isTypeSupported(candidate)),
        });
    }, []);

    useEffect(() => {
        if (exportRenderMode !== 'firebase') return undefined;
        let cleanup = () => {};
        let disposed = false;
        subscribeLatestVideoExportJob({
            onUpdate: (job) => {
                if (disposed || !job) return;
                setActiveExportJob(job);
                setExportProgress(job.progress || 0);
                setIsExporting(!['ready', 'failed', 'cancelled'].includes(job.status));
                setExportJobHistory((history) => upsertExportJobHistory(history, job));
            },
            onError: (error) => {
                if (disposed) return;
                setProExportMessage(`Suivi Firestore indisponible: ${error.message || 'lecture du job impossible'}`);
            },
        }).then((unsubscribe) => {
            cleanup = unsubscribe;
            if (disposed) cleanup();
        });
        return () => {
            disposed = true;
            cleanup();
        };
    }, [exportRenderMode, setExportProgress, setIsExporting]);

    const handleProExport = async () => {
        if (proExportPreflight.errors.length > 0) {
            setProExportMessage(`Export Pro bloque: ${proExportPreflight.errors.join(' ')}`);
            setIsExportJobModalOpen(true);
            return;
        }

        exportJobAbortRef.current?.abort?.();
        const abortController = new AbortController();
        exportJobAbortRef.current = abortController;
        setIsExportJobModalOpen(true);
        setProExportMessage(`Export Pro MP4 lance: ${exportModeCopy.label}.`);

        const manifest = buildExportManifest({
            projectName,
            userId: 'local-user',
            renderPlan: {
                ...exportPlan,
                totalDuration,
            },
            preset,
            sequencePreset,
            exportFps,
            qualityMode: exportQualityMode,
            fitMode: exportFitMode,
            renderSettings: buildProfessionalRenderOverrides(professionalExportSettings),
            rightsManifest,
            frameSchedule: proExportPreflight.frameSchedule,
        });

        const updateJob = (job) => {
            setActiveExportJob(job);
            setExportProgress(job.progress || 0);
            setIsExporting(!['ready', 'failed', 'cancelled'].includes(job.status));
            setExportJobHistory((history) => upsertExportJobHistory(history, job));
        };

        setExportProgress(0);
        setIsExporting(true);
        const finalJob = await startVideoExportJob({
            manifest,
            mode: exportRenderMode,
            signal: abortController.signal,
            onUpdate: updateJob,
        });
        updateJob(finalJob);
        setIsExporting(false);
        setProExportMessage(resolveJobMessage(finalJob));
    };

    const cancelProExport = () => {
        exportJobAbortRef.current?.abort?.();
    };

    const retryProExport = async (job = activeExportJob) => {
        const manifest = job?.manifest || buildExportManifest({
            projectName,
            userId: 'local-user',
            renderPlan: {
                ...exportPlan,
                totalDuration,
            },
            preset,
            sequencePreset,
            exportFps,
            qualityMode: exportQualityMode,
            fitMode: exportFitMode,
            renderSettings: buildProfessionalRenderOverrides(professionalExportSettings),
            rightsManifest,
        });
        exportJobAbortRef.current?.abort?.();
        const abortController = new AbortController();
        exportJobAbortRef.current = abortController;
        setIsExportJobModalOpen(true);
        setIsExporting(true);
        if (job?.id) {
            const retryingJob = {
                ...job,
                status: 'retrying',
                phase: 'retrying',
                phaseLabel: 'Relance export',
                stepLabel: 'Nouveau job export en preparation',
                progress: Math.max(0, Math.min(18, Number(job.progress || 0))),
            };
            setActiveExportJob(retryingJob);
            setExportProgress(retryingJob.progress);
            setExportJobHistory((history) => upsertExportJobHistory(history, retryingJob));
        }
        try {
            const finalJob = await retryVideoExportJob({
                jobId: job?.id,
                manifest,
                mode: exportRenderMode,
                signal: abortController.signal,
                onUpdate: (nextJob) => {
                    setActiveExportJob(nextJob);
                    setExportProgress(nextJob.progress || 0);
                    setExportJobHistory((history) => upsertExportJobHistory(history, nextJob));
                },
            });
            setActiveExportJob(finalJob);
            setExportJobHistory((history) => upsertExportJobHistory(history, finalJob));
            setProExportMessage(resolveJobMessage(finalJob));
        } catch (error) {
            const failedJob = {
                ...(job || {}),
                status: 'failed',
                phase: 'failed',
                phaseLabel: 'Echec relance',
                stepLabel: error.message || 'Relance export impossible',
                progress: Math.max(0, Math.min(35, Number(job?.progress || 0))),
                error: {
                    code: error.code || 'export-retry-failed',
                    message: error.message || 'Relance export impossible.',
                    action: error.action || 'Verifie le job export et relance.',
                },
            };
            setActiveExportJob(failedJob);
            setExportJobHistory((history) => upsertExportJobHistory(history, failedJob));
            setProExportMessage(resolveJobMessage(failedJob));
        } finally {
            setIsExporting(false);
        }
    };

    const removeExportJobFromHistory = (jobId) => {
        setExportJobHistory((history) => history.filter(job => job.id !== jobId));
    };

    const addProfessionalRenderQueueItem = ({ settings, validation, size } = {}) => {
        if (validation?.status === 'blocked') {
            setProExportMessage(`Render queue bloque: ${[...(validation.errors || []), ...(validation.blockers || [])].slice(0, 2).join(' ')}`);
            return;
        }
        const queueItem = createRenderQueueItem({
            settings,
            manifest: proExportManifest,
            source: 'professional-export-panel',
        });
        setProfessionalRenderQueue((queue) => [queueItem, ...queue].slice(0, 8));
        setProExportMessage(`Ajoute a la render queue: ${settings?.file?.fileName || 'export'} (${size?.label || proExportManifest.estimates.outputSize.label}).`);
    };

    const handleImageSnapshotExport = async () => {
        if (!previewCanvas) {
            setProExportMessage('Export image bloque: canvas preview indisponible.');
            return;
        }
        const requestedFormat = professionalExportSettings.video?.format;
        const format = ['png', 'jpeg', 'webp'].includes(requestedFormat)
            ? requestedFormat
            : professionalExportSettings.image?.format || 'png';
        try {
            const result = await exportCanvasImage(previewCanvas, {
                format,
                quality: professionalExportSettings.image?.quality ?? 0.92,
                fileName: professionalExportSettings.file?.fileName || projectName || 'vibefx-export',
                transparentBackground: professionalExportSettings.image?.transparentBackground === true,
            });
            const url = URL.createObjectURL(result.blob);
            triggerBrowserDownload(url, result.fileName);
            URL.revokeObjectURL(url);
            setProExportMessage(`Export image termine: ${result.fileName} (${(result.blob.size / 1024 / 1024).toFixed(2)} Mo).`);
        } catch (error) {
            setProExportMessage(`Export image echoue: ${error.message || 'erreur inconnue'}`);
        }
    };

    const handleBrowserDraftExport = async () => {
        if (exportPreflight.errors.length > 0) {
            setExportMessage(`Export brouillon bloque: ${exportPreflight.errors.join(' ')}`);
            return;
        }

            const requestedFormat = effectiveExportFormat;
            if (formatFallbackActive) {
                setExportFormat('webm');
            }

        const { fps, frameSchedule, mimeType } = exportPreflight;
        const warningNote = exportPreflight.warnings.length > 0 ? ` Checks: ${exportPreflight.warnings.join(' ')}` : '';
        const exportId = `export-${Date.now()}`;
        if (exportPreflight.warnings.length > 0) setExportMessage(`Export brouillon prepare avec corrections.${warningNote}`);

        const recordCanvas = document.createElement('canvas');
        if (!recordCanvas.captureStream) {
            setExportMessage('Export brouillon canvas indisponible sur cette session.');
            return;
        }

        recordCanvas.width = preset?.width || 1920;
        recordCanvas.height = preset?.height || 1080;
        recordCanvas.style.width = `${recordCanvas.width}px`;
        recordCanvas.style.height = `${recordCanvas.height}px`;
        recordCanvas.style.position = 'fixed';
        recordCanvas.style.left = '-100000px';
        recordCanvas.style.top = '0';
        recordCanvas.style.pointerEvents = 'none';
        document.body.appendChild(recordCanvas);

        const exportEngine = new PlaybackEngine(recordCanvas);
        const chunks = [];
        const stream = recordCanvas.captureStream(0);
        let disconnectAudio = null;
        let recordStream = stream;
        let progressTimer = null;
        let renderTimer = null;
        let stopTimer = null;
        let renderStopped = false;
        let exportFailureMessage = '';

        const cleanupBeforeRecord = () => {
            recordStream.getTracks().forEach((track) => track.stop());
            stream.getTracks().forEach((track) => track.stop());
            disconnectAudio?.();
            exportEngine.dispose();
            recordCanvas.remove();
        };

        const clipLoadResults = await exportEngine.loadAllClips(exportClips);
        const audioLoadResults = await exportEngine.loadAllAudioTracks(exportAudioTracks);
        const mediaLoadErrors = [
            ...getRejectedMediaMessages(clipLoadResults, 'Clip video illisible'),
            ...getRejectedMediaMessages(audioLoadResults, 'Piste audio illisible'),
        ];

        if (mediaLoadErrors.length > 0) {
            cleanupBeforeRecord();
            setExportMessage(`Export brouillon bloque: ${mediaLoadErrors.join(' ')}`);
            return;
        }

        try {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (shouldMixAudio) {
                if (!AudioContextCtor || !exportEngine.connectAudioToDestination) {
                    throw new Error('mix audio navigateur indisponible');
                }
                try {
                    const audioContext = exportEngine.getOrCreateAudioContext(AudioContextCtor);
                    await audioContext.resume();
                    const destination = audioContext.createMediaStreamDestination();
                    disconnectAudio = exportEngine.connectAudioToDestination(audioContext, destination);
                    recordStream = new MediaStream([
                        ...stream.getVideoTracks(),
                        ...destination.stream.getAudioTracks(),
                    ]);
                    if (destination.stream.getAudioTracks().length === 0) {
                        throw new Error('aucune piste audio en sortie');
                    }
                } catch (error) {
                    disconnectAudio?.();
                    throw error;
                }
            }
        } catch (error) {
            console.warn('Audio export mix unavailable:', error);
            cleanupBeforeRecord();
            setExportMessage(`Export brouillon bloque: impossible de mixer l'audio (${error.message}).`);
            return;
        }

        let recorder;
        try {
            const videoBitsPerSecond = resolveQualityVideoBitrate(recordCanvas.width, recordCanvas.height, fps);
            const audioBitsPerSecond = 256_000;
            recorder = new MediaRecorder(recordStream, {
                mimeType,
                bitsPerSecond: videoBitsPerSecond + audioBitsPerSecond,
                videoBitsPerSecond,
                audioBitsPerSecond,
            });
        } catch (error) {
            recordStream.getTracks().forEach((track) => track.stop());
            stream.getTracks().forEach((track) => track.stop());
            disconnectAudio?.();
            exportEngine.dispose();
            recordCanvas.remove();
            setExportMessage(`Export brouillon impossible: ${error.message}`);
            return;
        }

        const durationMs = Math.max(1000, frameSchedule.expectedDuration * 1000 + 1500);
        const startedAt = performance.now();
        let renderTime = 0;
        let renderedFrameCount = 0;
        let blankFrameStreak = 0;
        const frameDuration = frameSchedule.frameDuration;
        const maxBlankFrameStreak = Math.max(3, Math.ceil(fps * 0.15));

        setExportMessage(`${mimeType.includes('mp4') ? 'Export rapide navigateur (brouillon) MP4 en cours.' : 'Export rapide navigateur (brouillon) WebM en cours. MP4 natif indisponible dans ce navigateur.'}${warningNote}`);
        setExportProgress(0);
        setIsExporting(true);

        const cleanup = () => {
            window.clearInterval(progressTimer);
            window.clearInterval(renderTimer);
            window.clearTimeout(stopTimer);
            renderStopped = true;
            recordStream.getTracks().forEach((track) => track.stop());
            stream.getTracks().forEach((track) => track.stop());
            disconnectAudio?.();
            exportEngine.dispose();
            recordCanvas.remove();
        };

        const stopRecording = () => {
            if (recorder.state === 'inactive') return;
            renderStopped = true;
            exportEngine.stopPlayback();
            recorder.stop();
        };

        const failExport = (message) => {
            if (exportFailureMessage) return;
            exportFailureMessage = message;
            setExportMessage(message);
            stopRecording();
        };

        recorder.ondataavailable = (event) => {
            if (event.data?.size) chunks.push(event.data);
        };

        recorder.onerror = (event) => {
            failExport(`Export interrompu: ${event.error?.message || 'erreur MediaRecorder'}`);
        };

        recorder.onstop = async () => {
            cleanup();
            setIsExporting(false);
            if (exportFailureMessage) {
                setExportMessage(exportFailureMessage);
                return;
            }
            setExportProgress(100);

            const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size === 0) {
                setExportMessage('Export echoue: fichier vide, aucune frame enregistree.');
                return;
            }
            if (renderedFrameCount === 0) {
                setExportMessage('Export echoue: aucune frame video rendue.');
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${(projectName || 'vibecut').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}-${Date.now()}.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            let manifestNote = '';
            if (rightsManifest.length > 0) {
                try {
                    const persistResult = await persistExportRightsManifest({
                        audioTracks: exportAudioTracks,
                        context: {
                            exportId,
                            projectName,
                            exportFormat: extension,
                            sequencePreset,
                        },
                    });
                    manifestNote = persistResult.persisted
                        ? ` Manifeste droits sauvegarde: ${persistResult.manifest.id}.`
                        : ` Manifeste droits pret: ${persistResult.manifest.trackCount} piste(s), non sauvegarde (${persistResult.reason}).`;
                } catch (error) {
                    manifestNote = ` Manifeste droits pret: ${rightsManifest.length} piste(s), sauvegarde impossible (${error.message}).`;
                }
            }
            setExportMessage(`Export termine (${extension.toUpperCase()}, ${(blob.size / 1024 / 1024).toFixed(1)} Mo).${manifestNote}`);
        };

        progressTimer = window.setInterval(() => {
            const elapsed = performance.now() - startedAt;
            const timeProgress = totalDuration > 0 ? (renderTime / totalDuration) * 100 : 0;
            setExportProgress(Math.min(99, Math.max(Math.round((elapsed / durationMs) * 100), Math.round(timeProgress))));
        }, 200);

        setExportMessage(`${mimeType.includes('mp4') ? 'Encodage brouillon MP4 navigateur.' : 'Encodage brouillon WebM navigateur.'} MediaRecorder ne garantit pas un rendu final pro.${warningNote}`);
        recorder.start(250);
        const videoTracks = stream.getVideoTracks();
        let frameIndex = 0;
        const totalFrames = frameSchedule.totalFrames;

        const renderExportFrame = (time) => {
            const frameResult = exportEngine.renderFrame(exportClips, transitions, time, exportAllTransitions);
            const frameShouldContainVideo = exportClips.length > 0 && time < totalDuration - (frameDuration / 2);
            if (frameShouldContainVideo && !frameResult?.rendered) {
                failExport(`Export interrompu: frame video non rendue a ${time.toFixed(2)}s (${frameResult?.reason || 'aucun clip actif'})`);
                return false;
            }
            drawTextOverlays(recordCanvas, exportTextOverlays, time, null);
            exportEngine.syncClipAudio(exportPlaybackClips, transitions, time, 1, exportAllTransitions);
            exportEngine.syncExternalAudio(exportAudioTracks, time, 1);
            videoTracks.forEach((track) => track.requestFrame?.());
            renderedFrameCount += 1;
            if (frameShouldContainVideo) {
                const frameHealth = sampleCanvasFrameHealth(recordCanvas);
                if (frameHealth.checkable && frameHealth.blank) {
                    blankFrameStreak += 1;
                    if (blankFrameStreak >= maxBlankFrameStreak) {
                        failExport(`Export interrompu: frames noires consecutives a ${time.toFixed(2)}s`);
                        return false;
                    }
                } else {
                    blankFrameStreak = 0;
                }
            }
            return true;
        };

        renderExportFrame(0);

        renderTimer = window.setInterval(() => {
            if (renderStopped || recorder.state === 'inactive' || exportFailureMessage) return;
            frameIndex += 1;
            renderTime = Math.min(totalDuration, frameIndex * frameDuration);
            if (!renderExportFrame(renderTime)) return;
            setExportProgress(Math.min(99, Math.round((frameIndex / Math.max(totalFrames, 1)) * 100)));
            if (frameIndex >= totalFrames || renderTime >= totalDuration - (frameDuration / 2)) {
                stopRecording();
            }
        }, 1000 / fps);
        stopTimer = window.setTimeout(stopRecording, durationMs);
    };

    return {
        activeExportJob,
        audioTracks: exportAudioTracks,
        cancelProExport,
        effectiveExportFormat,
        exportAudioTracks,
        exportFps,
        exportFormat,
        exportFrameRate,
        exportFitMode,
        exportModeCopy,
        exportRenderMode,
        exportJobHistory,
        exportMessage,
        exportPreflight,
        exportProgress,
        exportQualityMode,
        formatFallbackActive,
        handleBrowserDraftExport,
        handleExport: handleProExport,
        handleProExport,
        hasAudibleClipAudio,
        hasClips,
        isExportJobModalOpen,
        isExporting,
        mimeSupport,
        preset,
        proExportManifest,
        proExportMessage,
        proExportPreflight,
        professionalExportSettings,
        professionalRenderQueue,
        projectName,
        addProfessionalRenderQueueItem,
        handleImageSnapshotExport,
        removeExportJobFromHistory,
        retryProExport,
        rightsAudit,
        rightsBlockers,
        sequencePreset,
        setActivePanel,
        setExportFormat,
        setExportFrameRate,
        setExportFitMode,
        setExportJobHistory,
        setExportJobModalOpen: setIsExportJobModalOpen,
        setExportQualityMode,
        setProfessionalExportSettings,
        setSequencePreset,
        shouldMixAudio,
        sourceFpsMax,
        totalDuration,
        previewCanvas,
    };
}

function upsertExportJobHistory(history = [], job = {}) {
    if (!job?.id) return history;
    return [job, ...history.filter(item => item.id !== job.id)].slice(0, 8);
}

function resolveJobMessage(job = {}) {
    if (job.status === 'ready' && job.mode === 'localMock') return 'Export Pro localMock termine: workflow valide, aucun MP4 reel genere.';
    if (job.status === 'ready') return 'Export Pro Firebase termine: MP4 final disponible.';
    if (job.status === 'cancelled') return 'Export Pro annule.';
    if (job.status === 'failed') return `Export Pro echoue: ${job.error?.message || 'erreur inconnue'}`;
    return job.stepLabel || 'Export Pro en cours.';
}

export function resolveExportModeCopy(mode = 'localMock') {
    if (mode === 'firebase') {
        return {
            label: 'Rendu Cloud Firebase',
            description: 'Mode Firebase actif: sources uploadees dans Storage, job cree par callable, rendu final produit par le renderer Cloud Run.',
            className: 'border border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
        };
    }
    return {
        label: 'Simulation locale',
        description: 'Simulation locale active: valide le workflow Cloud Run/FFmpeg sans generer de faux MP4.',
        className: 'border border-amber-400/25 bg-amber-500/10 text-amber-200',
    };
}

export function triggerBrowserDownload(url, fileName) {
    if (typeof document === 'undefined') return;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function getRejectedMediaMessages(results = [], fallback = 'Media illisible') {
    return results
        .filter(result => result.status === 'rejected')
        .map((result) => {
            const name = result.media?.name || result.media?.id || 'media';
            const reason = result.reason?.message || fallback;
            return `${fallback}: ${name} (${reason}).`;
        });
}

function getSupportedMimeType(format = 'webm') {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = MIME_CANDIDATES[format] || MIME_CANDIDATES.webm;
    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

function resolveSourceFpsMax(clips = []) {
    const detected = clips
        .map((clip) => Number(clip.sourceFrameRate || clip.importFrameRate || 0))
        .filter((fps) => Number.isFinite(fps) && fps > 0);
    if (!detected.length) return 0;
    return Math.min(60, Math.max(...detected.map((fps) => Math.round(fps))));
}

function resolveQualityVideoBitrate(width = 1920, height = 1080, fps = 30) {
    const pixels = Math.max(1, Number(width) * Number(height));
    const normalizedFps = Math.max(24, Math.min(60, Number(fps) || 30));
    const bitsPerPixelFrame = 0.28;
    return Math.round(Math.min(90_000_000, Math.max(24_000_000, pixels * normalizedFps * bitsPerPixelFrame)));
}

export function resolveExportFps(presetFps, sourceFpsMax, override = 'auto') {
    const requestedFps = Number(override);
    if (override !== 'auto' && Number.isFinite(requestedFps) && requestedFps > 0) {
        return Math.min(60, Math.max(1, Math.round(requestedFps)));
    }
    const baseFps = Number.isFinite(Number(presetFps)) ? Number(presetFps) : 30;
    const sourceFps = Number.isFinite(Number(sourceFpsMax)) ? Number(sourceFpsMax) : 0;
    return Math.min(60, Math.max(baseFps, sourceFps || baseFps));
}

function sampleCanvasFrameHealth(canvas) {
    try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx || canvas.width <= 0 || canvas.height <= 0) return { checkable: false, blank: false };

        const points = [
            [0.5, 0.5], [0.35, 0.5], [0.65, 0.5],
            [0.5, 0.35], [0.5, 0.65], [0.2, 0.2],
            [0.8, 0.2], [0.2, 0.8], [0.8, 0.8],
        ];
        const lumas = points.map(([rx, ry]) => {
            const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * rx)));
            const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * ry)));
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            return (pixel[0] + pixel[1] + pixel[2]) / 3;
        });
        const max = Math.max(...lumas);
        const min = Math.min(...lumas);
        const mean = lumas.reduce((sum, value) => sum + value, 0) / lumas.length;

        return {
            checkable: true,
            blank: max <= 3 && mean <= 2 && (max - min) <= 3,
            mean,
            spread: max - min,
        };
    } catch {
        return { checkable: false, blank: false };
    }
}
