import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "model", "timelineModel.js");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-timeline-model-"));
const tempModulePath = path.join(tempDir, "timelineModel.mjs");

try {
  const source = await readFile(sourcePath, "utf8");
  await writeFile(tempModulePath, source, "utf8");

  const {
    buildTimelineModel,
    buildExportFrameSchedule,
    buildTimelineSnapPoints,
    clampVolumePercent,
    findTransitionItemOverlap,
    getDefaultTracks,
    getNearestExportFrameSample,
    resolveActiveTransition,
    resolveTimelineRenderPlan,
    resolveTimelineTransitions,
    snapTimelineRange,
    validateExportAudioMix,
    validateExportFrameCoverage,
    validateExportTimeline,
    validateTimelineRenderPlan,
  } = await import(pathToFileURL(tempModulePath).href);

  const clips = [
    { id: "clip-a", name: "Clip A", url: "/a.webm", trimStart: 0, trimEnd: 3, duration: 3, speed: 1, volume: 80, filters: { brightness: 95, contrast: 125, saturation: 130, temperature: -15, vignette: 20, grain: 5 } },
    { id: "clip-b", name: "Clip B", url: "/b.webm", trimStart: 0, trimEnd: 2, duration: 2, speed: 1, volume: 80 },
  ];
  const transitions = {
    "clip-a->clip-b": { type: "crossfade", duration: 0.5 },
  };
  const transitionItems = [
    { id: "tr-free", type: "flash", start: 1.2, duration: 0.4, trackId: "transition-main" },
  ];
  const textOverlays = [
    { id: "txt-1", content: "Intro", startTime: 0.1, endTime: 1.4, trackId: "text-main" },
  ];
  const audioTracks = [
    { id: "music-1", name: "Music", url: "/music.mp3", startTime: 0, duration: 6, endTime: 6, volume: 70, trackId: "music-main" },
  ];
  const totalDuration = 4.5;

  const model = buildTimelineModel({ clips, transitions, transitionItems, textOverlays, audioTracks, totalDuration });
  assert.ok(getDefaultTracks().some((track) => track.id === "effect-main" && track.type === "effect"));
  assert.equal(getDefaultTracks().find((track) => track.id === "transition-main").allowOverlap, false);
  assert.equal(getDefaultTracks().find((track) => track.id === "text-main").allowOverlap, false);
  assert.equal(getDefaultTracks().find((track) => track.id === "music-main").allowOverlap, false);
  assert.ok(model.tracks.some((track) => track.id === "effect-main" && track.type === "effect"));
  const videoItems = model.items.filter((item) => item.type === "video");
  assert.equal(videoItems.length, 2);
  assert.equal(videoItems[0].start, 0);
  assert.equal(videoItems[0].duration, 3);
  assert.equal(videoItems[1].start, 2.5);
  assert.equal(videoItems[1].duration, 2);
  const embeddedAudioItems = model.items.filter((item) => item.type === "audio" && item.trackId === "audio-main");
  assert.equal(embeddedAudioItems.length, 2);
  assert.equal(embeddedAudioItems[0].id, "clip-a:audio");
  assert.equal(embeddedAudioItems[0].sourceId, "clip-a");
  assert.equal(embeddedAudioItems[0].params.embedded, true);
  assert.equal(embeddedAudioItems[0].start, videoItems[0].start);
  assert.equal(embeddedAudioItems[1].start, videoItems[1].start);
  const musicModelItems = model.items.filter((item) => item.type === "audio" && item.trackId === "music-main");
  assert.equal(musicModelItems.length, 1);
  const effectModelItems = model.items.filter((item) => item.type === "effect" && item.trackId === "effect-main");
  assert.equal(effectModelItems.length, 1);
  assert.equal(effectModelItems[0].id, "clip-a:effect:filters");
  assert.equal(effectModelItems[0].sourceId, "clip-a");
  assert.equal(effectModelItems[0].params.effectType, "clip-filters");
  assert.equal(effectModelItems[0].params.filters.contrast, 125);
  assert.equal(effectModelItems[0].start, videoItems[0].start);
  assert.equal(effectModelItems[0].duration, videoItems[0].duration);
  const transitionModelItems = model.items.filter((item) => item.type === "transition");
  const modelCutTransition = transitionModelItems.find((item) => item.params.placement === "cut");
  const modelFreeTransition = transitionModelItems.find((item) => item.params.placement === "free");
  assert.equal(transitionModelItems.length, 2);
  assert.equal(modelCutTransition.params.editable, false);
  assert.equal(modelCutTransition.start, 2.5);
  assert.equal(modelFreeTransition.params.editable, true);
  assert.equal(modelFreeTransition.start, 1.2);

  const canonicalTransitions = resolveTimelineTransitions({ clips, transitions, transitionItems, totalDuration });
  const cutTransition = canonicalTransitions.find((transition) => transition.params.placement === "cut");
  const freeTransition = canonicalTransitions.find((transition) => transition.params.placement === "free");
  assert.equal(canonicalTransitions.length, 2);
  assert.equal(cutTransition.fromItemId, "clip-a");
  assert.equal(cutTransition.toItemId, "clip-b");
  assert.equal(cutTransition.start, 2.5);
  assert.equal(cutTransition.duration, 0.5);
  assert.equal(freeTransition.id, "tr-free");

  assert.equal(resolveActiveTransition(transitionItems, 1.3, totalDuration).id, "tr-free");
  assert.equal(resolveActiveTransition(transitionItems, 2.0, totalDuration), null);
  assert.equal(resolveActiveTransition(canonicalTransitions, 2.6, totalDuration).fromItemId, "clip-a");
  assert.equal(resolveActiveTransition(canonicalTransitions, 2.6, totalDuration).toItemId, "clip-b");

  const canonicalCutOnlyItems = [
    { id: "cut-canonical-a-b", type: "crossfade", start: 2.5, duration: 0.5, fromItemId: "clip-a", toItemId: "clip-b", trackId: "transition-main", params: { placement: "cut" } },
    ...transitionItems,
  ];
  const canonicalCutOnlyModel = buildTimelineModel({ clips, transitions: {}, transitionItems: canonicalCutOnlyItems, textOverlays, audioTracks, totalDuration });
  const canonicalCutOnlyVideoItems = canonicalCutOnlyModel.items.filter((item) => item.type === "video");
  assert.equal(canonicalCutOnlyVideoItems[1].start, 2.5, "canonical cut transition items must control clip overlap without legacy transitions");
  const canonicalCutOnlyTransitions = resolveTimelineTransitions({ clips, transitions: {}, transitionItems: canonicalCutOnlyItems, totalDuration });
  assert.equal(canonicalCutOnlyTransitions.length, 2, "canonical cut transition items must not be duplicated as free transitions");
  assert.equal(canonicalCutOnlyTransitions.find((transition) => transition.params.placement === "cut").id, "cut-canonical-a-b");

  const snapPoints = buildTimelineSnapPoints({
    clips,
    transitions,
    transitionItems,
    textOverlays,
    audioTracks: [
      ...audioTracks,
      { id: "music-cue", name: "Cue", url: "/cue.mp3", startTime: 0.75, duration: 0.4, endTime: 1.15, trackId: "music-main" },
    ],
    totalDuration,
    currentTime: 1.37,
  });
  assert.ok(snapPoints.some((point) => point.type === "transition-start" && point.time === 1.2));
  assert.ok(snapPoints.some((point) => point.type === "transition-end" && point.time === 1.6));
  assert.ok(snapPoints.some((point) => point.type === "text-start" && point.time === 0.1));
  assert.ok(snapPoints.some((point) => point.type === "audio-start" && point.time === 0.75));
  assert.ok(snapPoints.some((point) => point.type === "audio-end" && point.time === 1.15));
  const snappedToFreeTransition = snapTimelineRange({
    start: 1.19,
    end: 1.49,
    mode: "move",
    points: snapPoints,
    threshold: 0.08,
    totalDuration,
    minDuration: 0.2,
  });
  assert.equal(snappedToFreeTransition.start, 1.2);
  assert.equal(snappedToFreeTransition.snap.point.type, "transition-start");

  const nonFiniteSnapPoints = buildTimelineSnapPoints({
    clips: [{ id: "invalid-duration", name: "Invalid", duration: Infinity, trimStart: 0, trimEnd: Infinity }],
    totalDuration: Infinity,
    currentTime: Infinity,
  });
  assert.deepEqual(nonFiniteSnapPoints, [
    { time: 0, type: "start", label: "Timeline start" },
  ], "non-finite media/timeline durations must collapse to a safe empty snap grid");

  const longTimelineSnapPoints = buildTimelineSnapPoints({
    clips: [{ id: "long", name: "Long", duration: 6 * 60 * 60, trimStart: 0, trimEnd: 6 * 60 * 60 }],
    totalDuration: 6 * 60 * 60,
  });
  assert.ok(longTimelineSnapPoints.length <= 3610, "long timelines must keep the snap grid bounded");
  assert.equal(longTimelineSnapPoints.at(-1).time, 6 * 60 * 60, "bounded snap grids must retain the timeline end");

  const plan = resolveTimelineRenderPlan({ clips, transitions, transitionItems, textOverlays, audioTracks, totalDuration });
  assert.equal(plan.clips.length, 2);
  assert.equal(plan.transitionItems.length, 1);
  assert.equal(plan.allTransitions.length, 2);
  assert.equal(plan.effectItems.length, 1);
  assert.equal(plan.textOverlays.length, 1);
  assert.equal(plan.audioClipItems.length, 2);
  assert.equal(plan.audioTracks.length, 1);
  assert.equal(plan.playbackClips[0].volume, 80);

  const multiTimelinePlan = resolveTimelineRenderPlan({
    clips,
    transitions,
    transitionItems: [
      ...transitionItems,
      { id: "tr-free-2", type: "glitch", start: 2.1, duration: 0.4, trackId: "transition-2" },
    ],
    textOverlays,
    audioTracks: [
      ...audioTracks,
      { id: "music-2", name: "Music 2", url: "/music-2.mp3", startTime: 1, duration: 2, endTime: 3, volume: 60, trackId: "music-2" },
    ],
    tracks: [
      ...getDefaultTracks(),
      { id: "transition-2", type: "transition", laneRole: "transition", name: "Effets 2", locked: false, muted: false, visible: true, allowOverlap: false, order: 20.1 },
      { id: "music-2", type: "audio", laneRole: "music", name: "Musique 2", locked: false, muted: false, visible: true, allowOverlap: false, order: 60.1 },
    ],
    totalDuration,
  });
  assert.equal(multiTimelinePlan.transitionItems.length, 2, "all visible transition timelines must render");
  assert.ok(multiTimelinePlan.transitionItems.some((item) => item.trackId === "transition-2"));
  assert.equal(multiTimelinePlan.audioTracks.length, 2, "all visible music timelines must render");
  assert.ok(multiTimelinePlan.audioTracks.some((item) => item.trackId === "music-2"));

  const mutedExtraMusicPlan = resolveTimelineRenderPlan({
    clips,
    transitions,
    transitionItems,
    textOverlays,
    audioTracks: [
      ...audioTracks,
      { id: "music-2", name: "Music 2", url: "/music-2.mp3", startTime: 1, duration: 2, endTime: 3, volume: 60, trackId: "music-2" },
    ],
    tracks: [
      ...getDefaultTracks(),
      { id: "music-2", type: "audio", laneRole: "music", name: "Musique 2", locked: false, muted: true, visible: true, allowOverlap: false, order: 60.1 },
    ],
    totalDuration,
  });
  assert.equal(mutedExtraMusicPlan.audioTracks.length, 1, "muting one music timeline must not mute every music lane");
  assert.equal(mutedExtraMusicPlan.audioTracks[0].trackId, "music-main");

  assert.equal(clampVolumePercent(-20), 0);
  assert.equal(clampVolumePercent(250), 100);
  const clampedVolumePlan = resolveTimelineRenderPlan({
    clips: [{ ...clips[0], volume: -20 }],
    transitions: {},
    transitionItems: [],
    textOverlays: [],
    audioTracks: [{ ...audioTracks[0], volume: 250, endTime: 2, duration: 2 }],
    totalDuration: 3,
  });
  assert.equal(clampedVolumePlan.playbackClips[0].volume, 0);
  assert.equal(clampedVolumePlan.audioTracks[0].volume, 100);

  const silentAudioAudit = validateExportAudioMix({
    playbackClips: [{ ...clips[0], start: 0, duration: 2, volume: 0 }],
    audioTracks: [{ ...audioTracks[0], volume: 0, startTime: 0, duration: 2, endTime: 2 }],
    shouldMixAudio: true,
    totalDuration: 3,
  });
  assert.deepEqual(silentAudioAudit.errors, []);
  assert.ok(silentAudioAudit.warnings.some((warning) => warning.includes("Export audio muet")));
  assert.ok(silentAudioAudit.warnings.some((warning) => warning.includes("Piste audio muette")));
  assert.ok(silentAudioAudit.warnings.some((warning) => warning.includes("Audio clip muet")));

  const missingAudioAudit = validateExportAudioMix({
    playbackClips: [],
    audioTracks: [],
    shouldMixAudio: true,
    totalDuration: 3,
  });
  assert.ok(missingAudioAudit.errors.some((error) => error.includes("sans source audio active")));

  const badAudioAudit = validateExportAudioMix({
    playbackClips: [],
    audioTracks: [{ id: "bad-audio", name: "Bad Audio", startTime: 4, duration: 1, endTime: 5, volume: 50 }],
    shouldMixAudio: true,
    totalDuration: 3,
  });
  assert.ok(badAudioAudit.errors.some((error) => error.includes("sans URL")));
  assert.ok(badAudioAudit.errors.some((error) => error.includes("hors timeline")));

  const mutedPlan = resolveTimelineRenderPlan({
    clips,
    transitions,
    transitionItems,
    textOverlays,
    audioTracks,
    totalDuration,
    tracks: [
      { id: "video-main", type: "video", visible: true, muted: false, locked: false, order: 10 },
      { id: "transition-main", type: "transition", visible: true, muted: false, locked: false, order: 20 },
      { id: "text-main", type: "text", visible: false, muted: false, locked: false, order: 30 },
      { id: "audio-main", type: "audio", visible: true, muted: true, locked: false, order: 40 },
      { id: "music-main", type: "audio", visible: true, muted: true, locked: false, order: 50 },
    ],
  });
  assert.equal(mutedPlan.textOverlays.length, 0);
  assert.equal(mutedPlan.audioClipItems.length, 2);
  assert.equal(mutedPlan.audioTracks.length, 0);
  assert.equal(mutedPlan.playbackClips[0].volume, 0);

  const cleanAudit = validateTimelineRenderPlan({ plan, totalDuration, frameDuration: 1 / 30 });
  assert.deepEqual(cleanAudit.errors, []);
  assert.ok(cleanAudit.warnings.some((warning) => warning.includes("Piste audio tronquee")));

  const gapAudit = validateTimelineRenderPlan({
    totalDuration: 3,
    plan: {
      clips: [
        { id: "a", name: "A", url: "/a.webm", start: 0, duration: 1, trimStart: 0, trimEnd: 1 },
        { id: "b", name: "B", url: "/b.webm", start: 2, duration: 1, trimStart: 0, trimEnd: 1 },
      ],
      transitions: {},
      transitionItems: [],
      audioTracks: [],
    },
  });
  assert.ok(gapAudit.errors.some((error) => error.includes("Trou video")));

  const overlapAudit = validateTimelineRenderPlan({
    totalDuration: 3,
    plan: {
      clips: [
        { id: "a", name: "A", url: "/a.webm", start: 0, duration: 2, trimStart: 0, trimEnd: 2 },
        { id: "b", name: "B", url: "/b.webm", start: 1, duration: 2, trimStart: 0, trimEnd: 2 },
      ],
      transitions: {},
      transitionItems: [],
      audioTracks: [],
    },
  });
  assert.ok(overlapAudit.errors.some((error) => error.includes("Overlap video non couvert")));

  const canonicalCutOverlapAudit = validateTimelineRenderPlan({
    totalDuration: 3,
    plan: {
      clips: [
        { id: "a", name: "A", url: "/a.webm", start: 0, duration: 2, trimStart: 0, trimEnd: 2 },
        { id: "b", name: "B", url: "/b.webm", start: 1.5, duration: 1.5, trimStart: 0, trimEnd: 1.5 },
      ],
      transitions: {},
      transitionItems: [],
      allTransitions: [
        { id: "cut-a-b", type: "crossfade", start: 1.5, duration: 0.5, fromItemId: "a", toItemId: "b", trackId: "transition-main", params: { placement: "cut" } },
      ],
      audioTracks: [],
    },
  });
  assert.deepEqual(canonicalCutOverlapAudit.errors, []);

  const transitionOverlap = findTransitionItemOverlap([
    { id: "tr-a", type: "flash", start: 0.5, duration: 1, trackId: "transition-main" },
    { id: "tr-b", type: "fade", start: 1.2, duration: 0.5, trackId: "transition-main" },
  ], 3);
  assert.equal(transitionOverlap.trackId, "transition-main");
  assert.equal(transitionOverlap.current.id, "tr-a");
  assert.equal(transitionOverlap.next.id, "tr-b");

  const transitionOverlapAudit = validateTimelineRenderPlan({
    totalDuration: 3,
    plan: {
      clips: [
        { id: "a", name: "A", url: "/a.webm", start: 0, duration: 3, trimStart: 0, trimEnd: 3 },
      ],
      transitions: {},
      transitionItems: [
        { id: "tr-a", type: "flash", start: 0.5, duration: 1, trackId: "transition-main" },
        { id: "tr-b", type: "fade", start: 1.2, duration: 0.5, trackId: "transition-main" },
      ],
      audioTracks: [],
    },
  });
  assert.ok(transitionOverlapAudit.errors.some((error) => error.includes("Overlap transition")));

  const audioOverlapAudit = validateTimelineRenderPlan({
    totalDuration: 4,
    plan: {
      clips: [
        { id: "a", name: "A", url: "/a.webm", start: 0, duration: 4, trimStart: 0, trimEnd: 4 },
      ],
      transitions: {},
      transitionItems: [],
      audioTracks: [
        { id: "music-a", name: "Music A", url: "/a.mp3", trackId: "music-main", start: 0, duration: 2, startTime: 0, endTime: 2 },
        { id: "music-b", name: "Music B", url: "/b.mp3", trackId: "music-main", start: 1.5, duration: 2, startTime: 1.5, endTime: 3.5 },
      ],
    },
  });
  assert.ok(audioOverlapAudit.errors.some((error) => error.includes("Overlap audio interdit")));

  const overlappingTextPlan = {
    clips: [
      { id: "a", name: "A", url: "/a.webm", start: 0, duration: 4, trimStart: 0, trimEnd: 4 },
    ],
    transitions: {},
    transitionItems: [],
    audioTracks: [],
    textOverlays: [
      { id: "txt-a", content: "A", trackId: "text-main", startTime: 0, endTime: 2 },
      { id: "txt-b", content: "B", trackId: "text-main", startTime: 1, endTime: 3 },
    ],
  };
  const overlappingTextBlockedAudit = validateTimelineRenderPlan({
    totalDuration: 4,
    plan: overlappingTextPlan,
  });
  assert.ok(overlappingTextBlockedAudit.errors.some((error) => error.includes("Overlap interdit sur piste Texte")));

  const stackedTextPlan = {
    ...overlappingTextPlan,
    tracks: [
      ...getDefaultTracks(),
      { id: "text-2", type: "text", name: "Texte 2", locked: false, muted: false, visible: true, allowOverlap: false, order: 40.1 },
    ],
    textOverlays: [
      { id: "txt-a", content: "A", trackId: "text-main", startTime: 0, endTime: 2 },
      { id: "txt-b", content: "B", trackId: "text-2", startTime: 1, endTime: 3 },
    ],
  };
  const overlappingTextAllowedAudit = validateTimelineRenderPlan({
    totalDuration: 4,
    plan: stackedTextPlan,
  });
  assert.deepEqual(overlappingTextAllowedAudit.errors, []);
  const stackedTextRenderPlan = resolveTimelineRenderPlan(stackedTextPlan);
  assert.equal(stackedTextRenderPlan.textOverlays.length, 2, "stacked text lanes must all render");

  const detachedItemAudit = validateTimelineRenderPlan({
    totalDuration: 3,
    plan: {
      clips: [
        { id: "a", name: "A", url: "/a.webm", start: 0, duration: 3, trimStart: 0, trimEnd: 3 },
      ],
      transitions: {},
      transitionItems: [],
      audioTracks: [],
      audioClipItems: [
        { id: "orphan-audio", sourceId: "missing", trackId: "audio-main", start: 0, duration: 1 },
      ],
      effectItems: [
        { id: "late-effect", sourceId: "a", trackId: "effect-main", start: 0.4, duration: 1, params: { clipId: "a" } },
      ],
    },
  });
  assert.ok(detachedItemAudit.errors.some((error) => error.includes("Audio clip sans clip source actif")));
  assert.ok(detachedItemAudit.warnings.some((warning) => warning.includes("Effet clip desynchronise")));

  const exportAudit = validateExportTimeline({
    clips: plan.clips,
    audioTracks: plan.audioTracks,
    transitionItems: plan.allTransitions,
    totalDuration,
    fps: 8,
    mimeType: "",
  });
  assert.ok(exportAudit.errors.some((error) => error.includes("FPS invalide")));
  assert.ok(exportAudit.errors.some((error) => error.includes("codec")));

  const exactFrameSchedule = buildExportFrameSchedule({ totalDuration: 4.5, fps: 30 });
  assert.equal(exactFrameSchedule.totalFrames, 135);
  assert.equal(exactFrameSchedule.frameDuration, 1 / 30);
  assert.equal(exactFrameSchedule.lastFrameTime, 134 / 30);
  const transitionFrameCoverage = validateExportFrameCoverage({
    frameSchedule: exactFrameSchedule,
    transitionItems: canonicalTransitions,
    totalDuration,
  });
  assert.deepEqual(transitionFrameCoverage.errors, []);
  assert.ok(transitionFrameCoverage.samples.some((sample) => sample.label.includes("transition:crossfade")));
  const cutMidpointSample = getNearestExportFrameSample({
    frameSchedule: exactFrameSchedule,
    time: cutTransition.start + cutTransition.duration / 2,
    label: "cut-midpoint",
  });
  assert.equal(cutMidpointSample.index, 83);
  assert.ok(Math.abs(cutMidpointSample.time - (83 / 30)) < 0.000001);

  const fractionalFrameSchedule = buildExportFrameSchedule({ totalDuration: 4.52, fps: 30 });
  assert.equal(fractionalFrameSchedule.totalFrames, 136);
  assert.ok(fractionalFrameSchedule.lastFrameTime < fractionalFrameSchedule.totalDuration);
  assert.ok(fractionalFrameSchedule.expectedDuration >= fractionalFrameSchedule.totalDuration);
  const uncoveredTransitionAudit = validateExportFrameCoverage({
    frameSchedule: buildExportFrameSchedule({ totalDuration: 1, fps: 5 }),
    transitionItems: [{ id: "tiny-transition", type: "flash", start: 0.05, duration: 0.1 }],
    totalDuration: 1,
  });
  assert.ok(uncoveredTransitionAudit.errors.some((error) => error.includes("sans frame export")));

  console.log("Video timeline model smoke passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
