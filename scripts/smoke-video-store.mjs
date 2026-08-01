import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const modelSourcePath = path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "model", "timelineModel.js");
const mediaModelSourcePath = path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "model", "mediaModel.js");
const storeSourcePath = path.join(process.cwd(), "src", "features", "vibefx-studio", "video", "store", "videoStore.js");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "vibecut-store-"));
const tempModelPath = path.join(tempDir, "timelineModel.mjs");
const tempMediaModelPath = path.join(tempDir, "mediaModel.mjs");
const tempStorePath = path.join(tempDir, "videoStore.mjs");

try {
  const modelSource = await readFile(modelSourcePath, "utf8");
  const mediaModelSource = await readFile(mediaModelSourcePath, "utf8");
  const zustandModuleUrl = import.meta.resolve("zustand");
  const storeSource = (await readFile(storeSourcePath, "utf8"))
    .replace("from 'zustand'", `from '${zustandModuleUrl}'`)
    .replace("../model/timelineModel", "./timelineModel.mjs")
    .replace("../model/mediaModel", "./mediaModel.mjs");

  await writeFile(tempModelPath, modelSource, "utf8");
  await writeFile(tempMediaModelPath, mediaModelSource, "utf8");
  await writeFile(tempStorePath, storeSource, "utf8");

  const { getDefaultTracks, resolveTimelineRenderPlan, validateTimelineRenderPlan } = await import(pathToFileURL(tempModelPath).href);
  const { default: useVideoStore } = await import(pathToFileURL(tempStorePath).href);

  const resetStore = (overrides = {}) => {
    useVideoStore.setState({
      clips: [],
      transitions: {},
      transitionItems: [],
      audioTracks: [],
      textOverlays: [],
      tracks: getDefaultTracks(),
      selectedClipId: null,
      selectedTextId: null,
      selectedTransitionId: null,
      selectedAudioTrackId: null,
      totalDuration: 5,
      currentTime: 0,
      _history: [],
      _future: [],
      _historyIndex: -1,
      _historyTransaction: null,
      timelineEditNotice: null,
      ...overrides,
    });
  };

  resetStore({ totalDuration: 0 });
  const rejectedInfiniteClip = useVideoStore.getState().addClip({
    id: "invalid-infinite",
    name: "Invalid infinite",
    url: "/invalid.webm",
    duration: Infinity,
  });
  assert.equal(rejectedInfiniteClip, false, "clips with Infinity duration must be rejected before entering the store");
  assert.equal(useVideoStore.getState().clips.length, 0, "rejected clips must not mutate the timeline");
  assert.equal(useVideoStore.getState().totalDuration, 0, "rejected clips must keep a finite empty duration");
  assert.equal(useVideoStore.getState().timelineEditNotice?.code, "media-duration-invalid");

  const rejectedNanClip = useVideoStore.getState().addClip({
    id: "invalid-nan",
    name: "Invalid NaN",
    url: "/invalid-nan.webm",
    duration: Number.NaN,
  });
  assert.equal(rejectedNanClip, false, "clips with NaN duration must be rejected");
  assert.equal(useVideoStore.getState().clips.length, 0);

  const acceptedFiniteClip = useVideoStore.getState().addClip({
    id: "valid-duration",
    name: "Valid",
    url: "/valid.mp4",
    duration: 2.5,
  });
  assert.equal(acceptedFiniteClip, true, "finite positive media duration must be accepted");
  useVideoStore.getState().updateClip("valid-duration", { duration: Infinity, trimEnd: Infinity });
  assert.equal(useVideoStore.getState().clips[0].duration, 2.5, "invalid duration updates must preserve the last valid duration");
  assert.equal(useVideoStore.getState().clips[0].trimEnd, 2.5, "invalid trim updates must be clamped to the valid source duration");
  assert.equal(useVideoStore.getState().totalDuration, 2.5, "store duration must remain finite after invalid updates");

  resetStore({ totalDuration: 0 });
  const acceptedImage = useVideoStore.getState().addClip({
    id: "image-scene",
    name: "Image scene",
    url: "/scene.jpg",
    type: "image/jpeg",
    mediaType: "image",
    duration: 4,
    motion: "zoom-in",
    thumbnails: ["/scene.jpg"],
  });
  assert.equal(acceptedImage, true, "image scenes must use the same canonical clip lane");
  assert.equal(useVideoStore.getState().clips[0].mediaType, "image");
  assert.equal(useVideoStore.getState().clips[0].volume, 0, "image scenes must not expose source audio");
  assert.equal(useVideoStore.getState().clips[0].motion.preset, "zoom-in");
  useVideoStore.getState().updateClip("image-scene", { duration: 6.5, motion: "pan-left" }, { history: true });
  assert.equal(useVideoStore.getState().clips[0].trimEnd, 6.5, "changing an image scene duration must resize its canonical trim");
  assert.equal(useVideoStore.getState().clips[0].motion.preset, "pan-left");
  assert.equal(useVideoStore.getState().totalDuration, 6.5);

  resetStore({
    clips: [
      { id: "photo-a", name: "Photo A", mediaType: "image", type: "image/jpeg", url: "/a.jpg", trimStart: 0, trimEnd: 4, duration: 4, speed: 1, filters: {} },
      { id: "photo-b", name: "Photo B", mediaType: "image", type: "image/jpeg", url: "/b.jpg", trimStart: 0, trimEnd: 4, duration: 4, speed: 1, filters: {} },
      { id: "video-c", name: "Video C", mediaType: "video", type: "video/mp4", url: "/c.mp4", trimStart: 0, trimEnd: 2, duration: 2, speed: 1, volume: 100, filters: {} },
    ],
    totalDuration: 10,
  });
  const appliedGuidedTemplate = useVideoStore.getState().applyGuidedTemplate({
    id: "guided-smoke",
    sequencePreset: "instagram-reel",
    imageDuration: 3.5,
    motionPattern: ["zoom-in", "pan-left"],
    transition: { type: "crossfade", duration: 0.35, name: "Guided fade" },
    lookPatch: { contrast: 108 },
  });
  assert.equal(appliedGuidedTemplate, true, "guided creation must build a first cut in one transaction");
  assert.deepEqual(useVideoStore.getState().clips.slice(0, 2).map((clip) => clip.duration), [3.5, 3.5]);
  assert.deepEqual(useVideoStore.getState().clips.slice(0, 2).map((clip) => clip.motion.preset), ["zoom-in", "pan-left"]);
  assert.equal(useVideoStore.getState().clips[2].duration, 2, "guided creation must preserve video source duration");
  assert.equal(useVideoStore.getState().transitionItems.filter((item) => item.params?.placement === "cut").length, 2);
  assert.equal(useVideoStore.getState().sequencePreset, "instagram-reel");
  assert.equal(useVideoStore.getState().currentTime, 0);

  resetStore({
    clips: [
      { id: "clip-a", name: "Clip A", url: "/a.webm", trimStart: 0, trimEnd: 3, duration: 3, speed: 1, volume: 100 },
      { id: "clip-b", name: "Clip B", url: "/b.webm", trimStart: 0, trimEnd: 2, duration: 2, speed: 1, volume: 100 },
    ],
    totalDuration: 5,
  });
  useVideoStore.getState().addClip({
    id: "session-a",
    name: "Session A",
    url: "/session-a.webm",
    duration: 1,
    orientationRotation: 270,
    importSessionId: "import-test",
  });
  useVideoStore.getState().addClip({
    id: "session-b",
    name: "Session B",
    url: "/session-b.webm",
    duration: 1,
    orientationRotation: 0,
    importSessionId: "import-test",
  });
  useVideoStore.getState().addClip({
    id: "other-session",
    name: "Other",
    url: "/other.webm",
    duration: 1,
    orientationRotation: 90,
    importSessionId: "import-other",
  });
  useVideoStore.setState({ _history: [], _future: [], _historyIndex: -1 });
  const sessionRotationCount = useVideoStore.getState().applyClipRotationToImportSession("session-a");
  assert.equal(sessionRotationCount, 2, "session rotation should return the number of affected session clips");
  assert.equal(useVideoStore.getState().clips.find((clip) => clip.id === "session-a").orientationRotation, 270, "source clip rotation should stay unchanged");
  assert.equal(useVideoStore.getState().clips.find((clip) => clip.id === "session-b").orientationRotation, 270, "matching import session clip should receive source rotation");
  assert.equal(useVideoStore.getState().clips.find((clip) => clip.id === "other-session").orientationRotation, 90, "other import sessions must not be changed");
  assert.equal(useVideoStore.getState()._history.length, 1, "session rotation should create one undo snapshot");
  useVideoStore.getState().undo();
  assert.equal(useVideoStore.getState().clips.find((clip) => clip.id === "session-b").orientationRotation, 0, "undo should restore the previous session rotation");

  resetStore({
    clips: [
      { id: "clip-a", name: "Clip A", url: "/a.webm", trimStart: 0, trimEnd: 3, duration: 3, speed: 1, volume: 100 },
      { id: "clip-b", name: "Clip B", url: "/b.webm", trimStart: 0, trimEnd: 2, duration: 2, speed: 1, volume: 100 },
    ],
    totalDuration: 5,
  });
  useVideoStore.getState().setTransition("clip-a", "clip-b", { type: "crossfade", duration: 0.5, name: "Crossfade" });
  assert.deepEqual(useVideoStore.getState().transitions, {}, "setTransition must not write legacy transition maps");
  assert.equal(useVideoStore.getState().transitionItems.length, 1, "setTransition must write a canonical cut transition item");
  assert.equal(useVideoStore.getState().transitionItems[0].params.placement, "cut", "canonical cut transition must declare placement=cut");
  assert.equal(useVideoStore.getState().transitionItems[0].fromItemId, "clip-a");
  assert.equal(useVideoStore.getState().transitionItems[0].toItemId, "clip-b");
  assert.equal(useVideoStore.getState().totalDuration, 4.5, "canonical cut transition must affect total duration");
  const cutModel = useVideoStore.getState().getTimelineModel();
  assert.equal(cutModel.items.filter((item) => item.type === "transition").length, 1, "canonical cut transition must appear once in the timeline model");
  assert.equal(cutModel.items.filter((item) => item.type === "video")[1].start, 2.5, "canonical cut transition must control video overlap");
  useVideoStore.getState().removeTransition("clip-a", "clip-b");
  assert.equal(useVideoStore.getState().transitionItems.length, 0, "removeTransition must remove canonical cut transition items");
  assert.equal(useVideoStore.getState().totalDuration, 5, "removing canonical cut transition must restore total duration");

  resetStore({
    clips: [
      { id: "clip-a", name: "Clip A", url: "/a.webm", trimStart: 0, trimEnd: 3, duration: 3, speed: 1, volume: 100 },
      { id: "clip-b", name: "Clip B", url: "/b.webm", trimStart: 0, trimEnd: 2, duration: 2, speed: 1, volume: 100 },
      { id: "clip-c", name: "Clip C", url: "/c.webm", trimStart: 0, trimEnd: 1, duration: 1, speed: 1, volume: 100 },
    ],
    totalDuration: 6,
  });
  useVideoStore.getState().setTransition("clip-a", "clip-b", { type: "crossfade", duration: 0.5 });
  useVideoStore.getState().setTransition("clip-b", "clip-c", { type: "flash", duration: 0.25 });
  useVideoStore.getState().reorderClips(2, 0);
  assert.deepEqual(useVideoStore.getState().clips.map((clip) => clip.id), ["clip-c", "clip-a", "clip-b"], "reorder must move clips before reassigning cut slots");
  assert.deepEqual(useVideoStore.getState().transitions, {}, "reorder must not recreate legacy transition maps");
  assert.equal(useVideoStore.getState().transitionItems.length, 2, "reorder must preserve cut transition slots as canonical items");
  assert.ok(useVideoStore.getState().transitionItems.some((item) => item.fromItemId === "clip-c" && item.toItemId === "clip-a" && item.duration === 0.5));
  assert.ok(useVideoStore.getState().transitionItems.some((item) => item.fromItemId === "clip-a" && item.toItemId === "clip-b" && item.duration === 0.25));
  assert.equal(useVideoStore.getState().totalDuration, 5.25, "reassigned canonical cut slots must affect reordered duration");
  const reorderedCutModel = useVideoStore.getState().getTimelineModel();
  const reorderedVideos = reorderedCutModel.items.filter((item) => item.type === "video");
  assert.equal(reorderedVideos[1].start, 0.5, "first reassigned cut slot must overlap reordered clips");
  assert.equal(reorderedVideos[2].start, 3.25, "second reassigned cut slot must overlap reordered clips");

  resetStore();
  useVideoStore.getState().addTransitionItem({ id: "tr-a", type: "flash", startTime: 0, duration: 1, trackId: "transition-main" });
  useVideoStore.getState().addTransitionItem({ id: "tr-b", type: "fade", startTime: 0.5, duration: 1, trackId: "transition-main" });
  assert.equal(useVideoStore.getState().transitionItems.length, 1, "transition-main must reject overlapping transitions by default");
  assert.equal(useVideoStore.getState().timelineEditNotice?.code, "track-overlap", "transition overlap rejection must expose an edit notice");

  resetStore({
    tracks: getDefaultTracks().map((track) => track.id === "transition-main" ? { ...track, allowOverlap: true } : track),
  });
  useVideoStore.getState().addTransitionItem({ id: "tr-a", type: "flash", startTime: 0, duration: 1, trackId: "transition-main" });
  useVideoStore.getState().addTransitionItem({ id: "tr-b", type: "fade", startTime: 0.5, duration: 1, trackId: "transition-main" });
  assert.equal(useVideoStore.getState().transitionItems.length, 2, "allowOverlap=true should accept overlapping transitions");
  assert.equal(useVideoStore.getState().timelineEditNotice, null, "accepted transition edit must clear stale edit notices");
  useVideoStore.getState().updateTransitionItem("tr-b", { startTime: 0.2, endTime: 1.2 });
  assert.equal(useVideoStore.getState().transitionItems.find((item) => item.id === "tr-b").startTime, 0.2, "transition update should honor allowOverlap=true");

  resetStore({
    clips: [
      { id: "clip-a", name: "Clip A", url: "/a.webm", trimStart: 0, trimEnd: 3, duration: 3, speed: 1, volume: 100 },
      { id: "clip-b", name: "Clip B", url: "/b.webm", trimStart: 0, trimEnd: 2, duration: 2, speed: 1, volume: 100 },
    ],
    totalDuration: 5,
  });
  useVideoStore.getState().addTransitionItem({
    id: "intro-a",
    type: "intro-neon-doors",
    category: "intro",
    duration: 1.2,
    params: { placement: "intro", sequenceSlot: "intro", singleton: true },
  });
  assert.equal(useVideoStore.getState().transitionItems.length, 1, "intro sequence should create one transition item");
  assert.equal(useVideoStore.getState().transitionItems[0].trackId, "sequence-main", "intro sequence should stay on the dedicated sequence track");
  assert.equal(useVideoStore.getState().tracks.filter((track) => track.laneRole === "transition").length, 1, "intro sequence must not create an extra effects track");
  assert.equal(useVideoStore.getState().totalDuration, 6.2, "intro sequence must extend timeline duration before video");
  let introModel = useVideoStore.getState().getTimelineModel();
  assert.equal(introModel.items.find((item) => item.type === "video" && item.id === "clip-a").start, 1.2, "intro sequence must shift first video item");

  useVideoStore.getState().addTransitionItem({
    id: "intro-b",
    type: "intro-title-scan",
    category: "intro",
    duration: 0.8,
    params: { placement: "intro", sequenceSlot: "intro", singleton: true },
  });
  const introItems = useVideoStore.getState().transitionItems.filter((item) => item.params?.sequenceSlot === "intro");
  assert.equal(introItems.length, 1, "second intro sequence must replace the existing intro slot");
  assert.equal(introItems[0].id, "intro-b", "intro replacement must keep the newest intro item");
  assert.equal(introItems[0].trackId, "sequence-main", "intro replacement must keep the dedicated sequence track");
  assert.equal(useVideoStore.getState().tracks.filter((track) => track.laneRole === "transition").length, 1, "intro replacement must not create Effets 2");
  assert.equal(useVideoStore.getState().totalDuration, 5.8, "intro replacement must recompute duration with the new intro length");
  introModel = useVideoStore.getState().getTimelineModel();
  assert.equal(introModel.items.find((item) => item.type === "video" && item.id === "clip-a").start, 0.8, "replaced intro length must control video shift");
  useVideoStore.getState().updateTransitionItem("intro-b", { duration: 1.6 }, { history: true });
  introModel = useVideoStore.getState().getTimelineModel();
  assert.equal(useVideoStore.getState().totalDuration, 6.6, "intro duration edit must extend the total timeline duration");
  assert.equal(introModel.items.find((item) => item.type === "video" && item.id === "clip-a").start, 1.6, "intro duration edit must shift the video lane");

  useVideoStore.getState().addTransitionItem({
    id: "outro-a",
    type: "outro-neon-close",
    category: "outro",
    duration: 1,
    params: { placement: "outro", sequenceSlot: "outro", singleton: true },
  });
  useVideoStore.getState().addTransitionItem({
    id: "outro-b",
    type: "outro-signal-collapse",
    category: "outro",
    duration: 0.9,
    params: { placement: "outro", sequenceSlot: "outro", singleton: true },
  });
  const outroItems = useVideoStore.getState().transitionItems.filter((item) => item.params?.sequenceSlot === "outro");
  assert.equal(outroItems.length, 1, "outro sequence must also be a singleton slot");
  assert.equal(outroItems[0].id, "outro-b", "outro replacement must keep the newest outro item");
  assert.equal(outroItems[0].trackId, "sequence-main", "outro replacement must keep the dedicated sequence track");
  assert.equal(useVideoStore.getState().tracks.filter((track) => track.laneRole === "transition").length, 1, "outro replacement must not create extra effects tracks");
  const sequencePlan = resolveTimelineRenderPlan(useVideoStore.getState());
  assert.equal(sequencePlan.clips[0].start, 1.6, "render plan must keep videos after the intro segment");
  assert.equal(sequencePlan.allTransitions.find((item) => item.params?.sequenceSlot === "outro").start, 6.6, "outro must render after the shifted video segment");
  const sequenceAudit = validateTimelineRenderPlan({ plan: sequencePlan, totalDuration: useVideoStore.getState().totalDuration, frameDuration: 1 / 30 });
  assert.deepEqual(sequenceAudit.errors, [], "intro/outro slots must not create timeline validation errors");

  resetStore({
    tracks: getDefaultTracks().map((track) => track.id === "music-main" ? { ...track, locked: true } : track),
  });
  useVideoStore.getState().addAudioTrack({ id: "locked-music", name: "Locked Music", url: "/locked.mp3", startTime: 0, duration: 1, endTime: 1, trackId: "music-main" });
  assert.equal(useVideoStore.getState().audioTracks.length, 0, "locked music track must reject audio additions");
  assert.equal(useVideoStore.getState().timelineEditNotice?.code, "track-locked", "locked track rejection must expose an edit notice");
  useVideoStore.getState().clearTimelineEditNotice();
  assert.equal(useVideoStore.getState().timelineEditNotice, null, "timeline edit notices must be clearable");

  resetStore();
  useVideoStore.getState().addAudioTrack({ id: "music-a", name: "Music A", url: "/a.mp3", startTime: 0, duration: 2, endTime: 2, trackId: "music-main" });
  useVideoStore.getState().addAudioTrack({ id: "music-b", name: "Music B", url: "/b.mp3", startTime: 1, duration: 2, endTime: 3, trackId: "music-main" });
  assert.equal(useVideoStore.getState().audioTracks.length, 1, "music-main must reject overlapping audio by default");
  assert.equal(useVideoStore.getState().timelineEditNotice?.code, "track-overlap", "audio overlap rejection must expose an edit notice");

  resetStore();
  useVideoStore.getState().addAudioTrack({ id: "music-a", name: "Music A", url: "/a.mp3", startTime: 0, duration: 1, endTime: 1, trackId: "music-main" });
  useVideoStore.getState().addAudioTrack({ id: "music-b", name: "Music B", url: "/b.mp3", startTime: 1.2, duration: 1, endTime: 2.2, trackId: "music-main" });
  assert.equal(useVideoStore.getState().audioTracks.length, 2, "non-overlapping music items should be accepted");
  useVideoStore.getState().updateAudioTrack("music-b", { startTime: 0.5, endTime: 1.5 });
  assert.equal(useVideoStore.getState().audioTracks.find((track) => track.id === "music-b").startTime, 1.2, "music update must reject overlap");

  useVideoStore.setState({ _history: [], _future: [], _historyIndex: -1 });
  useVideoStore.getState().updateTimelineItem("music-b", { startTime: 0.5, endTime: 1.5 }, { history: true });
  assert.equal(useVideoStore.getState().audioTracks.find((track) => track.id === "music-b").startTime, 1.2, "timeline item update must reject overlap");
  assert.equal(useVideoStore.getState()._history.length, 0, "rejected timeline item update must not push undo history");
  assert.equal(useVideoStore.getState().timelineEditNotice?.code, "track-overlap", "rejected timeline item update must expose an edit notice");

  useVideoStore.getState().beginHistoryTransaction("invalid-music-drag");
  useVideoStore.getState().updateTimelineItem("music-b", { startTime: 0.5, endTime: 1.5 });
  useVideoStore.getState().commitHistoryTransaction();
  assert.equal(useVideoStore.getState().audioTracks.find((track) => track.id === "music-b").startTime, 1.2, "rejected drag transaction must keep audio unchanged");
  assert.equal(useVideoStore.getState()._history.length, 0, "rejected drag transaction must not leave an undo snapshot");
  assert.equal(useVideoStore.getState()._historyTransaction, null, "rejected drag transaction must close cleanly");

  useVideoStore.getState().beginHistoryTransaction("valid-music-drag");
  useVideoStore.getState().updateTimelineItem("music-b", { startTime: 2.5, endTime: 3.5 });
  useVideoStore.getState().commitHistoryTransaction();
  assert.equal(useVideoStore.getState().audioTracks.find((track) => track.id === "music-b").startTime, 2.5, "valid drag transaction must update audio");
  assert.equal(useVideoStore.getState()._history.length, 1, "valid drag transaction must keep one undo snapshot");
  assert.equal(useVideoStore.getState().timelineEditNotice, null, "valid drag transaction must clear stale edit notices");

  resetStore({
    tracks: getDefaultTracks().map((track) => track.id === "music-main" ? { ...track, allowOverlap: true } : track),
  });
  useVideoStore.getState().addAudioTrack({ id: "music-a", name: "Music A", url: "/a.mp3", startTime: 0, duration: 2, endTime: 2, trackId: "music-main" });
  useVideoStore.getState().addAudioTrack({ id: "music-b", name: "Music B", url: "/b.mp3", startTime: 1, duration: 2, endTime: 3, trackId: "music-main" });
  assert.equal(useVideoStore.getState().audioTracks.length, 2, "allowOverlap=true should accept overlapping music items");

  resetStore();
  const manualTransitionTrackId = useVideoStore.getState().addTimelineTrack("transition");
  assert.equal(manualTransitionTrackId, "transition-2", "manual transition timeline should create the next transition lane");
  assert.ok(useVideoStore.getState().tracks.some((track) => track.id === "transition-2" && track.type === "transition"), "manual transition timeline must be registered");
  assert.equal(useVideoStore.getState().removeTimelineTrack("transition-2"), true, "empty custom transition timeline should be removable");
  assert.equal(useVideoStore.getState().tracks.some((track) => track.id === "transition-2"), false, "removed custom transition timeline must leave track registry");
  assert.equal(useVideoStore.getState().removeTimelineTrack("transition-main"), false, "main transition timeline must be protected");
  assert.equal(useVideoStore.getState().timelineEditNotice?.code, "track-system", "protected timeline deletion must expose an edit notice");

  resetStore();
  useVideoStore.getState().addAudioTrack({ id: "music-a", name: "Music A", url: "/a.mp3", startTime: 0, duration: 2, endTime: 2 });
  useVideoStore.getState().addAudioTrack({ id: "music-b", name: "Music B", url: "/b.mp3", startTime: 1, duration: 2, endTime: 3 });
  assert.equal(useVideoStore.getState().audioTracks.length, 2, "implicit overlapping music imports should be placed on separate timelines");
  assert.equal(useVideoStore.getState().audioTracks[0].trackId, "music-main");
  assert.equal(useVideoStore.getState().audioTracks[1].trackId, "music-2");
  assert.ok(useVideoStore.getState().tracks.some((track) => track.id === "music-2" && track.laneRole === "music"), "implicit music lane must be registered");
  assert.equal(useVideoStore.getState().removeTimelineTrack("music-2"), false, "custom non-empty music timeline should not be removed");
  assert.equal(useVideoStore.getState().timelineEditNotice?.code, "track-not-empty", "non-empty timeline deletion must expose an edit notice");

  resetStore();
  const manualTextTrackId = useVideoStore.getState().addTextTrack();
  assert.equal(manualTextTrackId, "text-2", "manual text timeline button should create the next text lane");
  assert.ok(useVideoStore.getState().tracks.some((track) => track.id === "text-2" && track.type === "text"), "manual text timeline must be registered");
  assert.equal(useVideoStore.getState().textOverlays.length, 0, "manual text timeline creation must not create a text overlay");

  resetStore();
  useVideoStore.getState().addTextOverlay({ content: "A", startTime: 0, endTime: 2 });
  useVideoStore.getState().addTextOverlay({ content: "B", startTime: 1, endTime: 3 });
  assert.equal(useVideoStore.getState().textOverlays.length, 2, "overlapping text should create a stacked lane by default");
  assert.equal(useVideoStore.getState().textOverlays[0].trackId, "text-main");
  assert.equal(useVideoStore.getState().textOverlays[1].trackId, "text-2");
  assert.ok(useVideoStore.getState().tracks.some((track) => track.id === "text-2" && track.allowOverlap === false), "stacked text lane must be registered");

  resetStore();
  useVideoStore.getState().addTextOverlay({ content: "A", startTime: 0, endTime: 1, trackId: "text-main" });
  useVideoStore.getState().addTextOverlay({ content: "B", startTime: 0.5, endTime: 1.5, trackId: "text-main" });
  assert.equal(useVideoStore.getState().textOverlays.length, 1, "explicit same text track should reject overlap");

  /*
   * Lot L3 - l'intensite du mouvement doit ARRIVER JUSQU'AU CLIP.
   *
   * C'est le maillon entre le plan de montage (pur, teste par
   * smoke-vibecut-style-recipes) et le manifeste d'export, dont la parite avec
   * l'apercu est mesuree par smoke-vibecut-motion-preview-parity. Si le store
   * perdait l'intensite ici, l'aperçu et l'export seraient toujours d\'accord
   * entre eux — et tous les deux faux par rapport au choix de l\'utilisateur.
   */
  resetStore({ totalDuration: 0 });
  for (const id of ["photo-1", "photo-2"]) {
    useVideoStore.getState().addClip({
      id,
      name: id,
      url: `/${id}.jpg`,
      type: "image/jpeg",
      mediaType: "image",
      duration: 4,
      motion: "none",
      thumbnails: [`/${id}.jpg`],
    });
  }
  assert.equal(
    useVideoStore.getState().applyMontageScore({
      scenes: [
        { duration: 3, motion: { preset: "zoom-in", intensity: 0.4 } },
        { duration: 2, motion: { preset: "pan-right", intensity: 0.7 } },
      ],
      cuts: [{ index: 0, type: "crossfade", duration: 0.5, name: "Fondu" }],
      lookPatch: {},
    }),
    true,
    "applyMontageScore must apply a montage score on image scenes"
  );
  const scored = useVideoStore.getState().clips;
  assert.equal(scored[0].motion.preset, "zoom-in", "montage score must set the scene motion");
  assert.equal(scored[0].motion.intensity, 0.4, "montage score must carry the motion intensity to the clip");
  assert.equal(scored[1].motion.intensity, 0.7, "each scene keeps its own motion intensity");
  assert.equal(
    useVideoStore.getState().applyGuidedTemplate({ imageDuration: 3, motionPattern: ["zoom-in"] }),
    true,
    "the legacy guided template stays available until phase 7"
  );
  assert.equal(
    useVideoStore.getState().clips[0].motion.intensity,
    1,
    "a motion without a declared intensity keeps its full travel"
  );

  console.log("Video store smoke passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
