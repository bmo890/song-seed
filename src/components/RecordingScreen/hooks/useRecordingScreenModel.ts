import { useNavigation } from "@react-navigation/native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { audioDeviceManager, type AudioDevice } from "@siteed/audio-studio";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import {
  buildBluetoothMonitoringRouteKey,
  getBluetoothMonitoringCalibrationForRoute,
  isBluetoothLikeAudioDevice,
} from "../../../bluetoothMonitoring";
import { getClipPlaybackDurationMs, getClipPlaybackWaveformPeaks } from "../../../clipPresentation";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../lyrics";
import { useRecording } from "../../../hooks/useRecording";
import { useMetronome } from "../../../hooks/useMetronome";
import SongseedMetronomeModule from "../../../../modules/songseed-metronome";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";
import type { ClipVersion, RecordingGrid } from "../../../types";
import { getDefaultOverdubStemTitle } from "../../../overdub";
import { buildSaveDestinations, resolveSaveDestinationLabel, type SaveDestination } from "../../../collectionManagement";
import { authorizeIntentionalEmptyStateWrite } from "../../../services/stateIntegrity";
import {
  buildDefaultIdeaTitle,
  ensureUniqueCountedTitle,
  genChildClipTitle,
  genRootClipTitle,
  isDefaultIdeaTitle,
} from "../../../utils";

/** Trim slightly early rather than late: the capture-start estimate is biased late by
 *  bridge delivery latency (~10-20 ms), and cutting into the downbeat transient is worse
 *  than keeping a few ms of pre-roll. */
const HEAD_TRIM_SAFETY_EARLY_MS = 15;
/** Fallback lead for the guide's play() when its start latency couldn't be measured.
 *  The primary path measures the real latency with a muted warm-start instead. */
const GUIDE_DOWNBEAT_LEAD_MS = 80;

export function useRecordingScreenModel() {
  const navigation = useNavigation();

  const recordingIdeaId = useStore((s) => s.recordingIdeaId);
  const recordingParentClipId = useStore((s) => s.recordingParentClipId);
  const recordingOverdubClipId = useStore((s) => s.recordingOverdubClipId);
  const recordingGuideMixUri = useStore((s) => s.recordingGuideMixUri);
  const recordingSaveRequestToken = useStore((s) => s.recordingSaveRequestToken);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const quickNameModalVisible = useStore((s) => s.quickNameModalVisible);
  const quickNameDraft = useStore((s) => s.quickNameDraft);
  const quickNamingIdeaId = useStore((s) => s.quickNamingIdeaId);
  const setQuickNameModalVisible = useStore((s) => s.setQuickNameModalVisible);
  const setQuickNameDraft = useStore((s) => s.setQuickNameDraft);
  const setQuickNamingIdeaId = useStore((s) => s.setQuickNamingIdeaId);
  const preferredRecordingInputId = useStore((s) => s.preferredRecordingInputId);
  const bluetoothMonitoringCalibrations = useStore((s) => s.bluetoothMonitoringCalibrations);
  const setPreferredRecordingInputId = useStore((s) => s.setPreferredRecordingInputId);
  const updateIdeas = useStore((s) => s.updateIdeas);
  const clearRecordingContext = useStore((s) => s.clearRecordingContext);

  const recordingIdea = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId)?.ideas.find((i) => i.id === recordingIdeaId),
    [workspaces, activeWorkspaceId, recordingIdeaId]
  );
  const recordingOverdubClip = useMemo(
    () =>
      recordingOverdubClipId && recordingIdea
        ? recordingIdea.clips.find((clip) => clip.id === recordingOverdubClipId) ?? null
        : null,
    [recordingIdea, recordingOverdubClipId]
  );
  const headerTitlePlaceholder =
    !recordingOverdubClip && !!recordingIdea && isDefaultIdeaTitle(recordingIdea.title, recordingIdea.createdAt);
  const headerEyebrow = recordingOverdubClip
    ? "Overdub"
    : recordingIdea
      ? headerTitlePlaceholder
        ? "New recording"
        : "Recording into"
      : null;
  const latestLyricsVersion = recordingIdea?.kind === "project" ? getLatestLyricsVersion(recordingIdea) : null;
  const latestLyricsText = lyricsDocumentToText(latestLyricsVersion?.document);
  const hasProjectLyrics = recordingIdea?.kind === "project" && latestLyricsText.trim().length > 0;

  // A save-destination choice only makes sense for a fresh standalone take — overdubs and
  // project variations/children must attach to their existing parent idea/clip, so their
  // location is fixed.
  const canPickSaveDestination =
    !!recordingIdea && recordingIdea.kind === "clip" && !recordingOverdubClip && !recordingParentClipId;
  const saveDestinations = useMemo(
    () => (canPickSaveDestination ? buildSaveDestinations(workspaces, activeWorkspaceId) : []),
    [canPickSaveDestination, workspaces, activeWorkspaceId]
  );
  const defaultDestinationLabel = recordingIdea
    ? resolveSaveDestinationLabel(workspaces, activeWorkspaceId, recordingIdea.collectionId)
    : null;
  const guideMixSource = useMemo(
    () => (recordingGuideMixUri ? { uri: recordingGuideMixUri } : null),
    [recordingGuideMixUri]
  );
  const guideMixPlayer = useAudioPlayer(guideMixSource, { updateInterval: 250 });
  const guideMixStatus = useAudioPlayerStatus(guideMixPlayer);

  const [isPrimaryDraft, setIsPrimaryDraft] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [metronomeSheetVisible, setMetronomeSheetVisible] = useState(false);
  const [recordingMetronomeEnabled, setRecordingMetronomeEnabled] = useState(false);
  const [isArmingRecording, setIsArmingRecording] = useState(false);
  const [currentRecordingInput, setCurrentRecordingInput] = useState<AudioDevice | null>(null);
  const [currentMonitoringOutput, setCurrentMonitoringOutput] = useState<{ name: string; type: string } | null>(null);
  const [guideMonitoringLeadInMs, setGuideMonitoringLeadInMs] = useState(0);
  const [overdubReviewLocked, setOverdubReviewLocked] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [lyricsAutoscrollMode, setLyricsAutoscrollMode] = useState<"off" | "follow" | "manual">("off");
  const [lyricsAutoscrollSpeedMultiplier, setLyricsAutoscrollSpeedMultiplier] = useState(1);
  const [saveDestinationOverride, setSaveDestinationOverride] = useState<SaveDestination | null>(null);
  const [saveDestinationPickerVisible, setSaveDestinationPickerVisible] = useState(false);

  const effectiveDestinationWorkspaceTitle =
    saveDestinationOverride?.workspaceTitle ?? defaultDestinationLabel?.workspaceTitle ?? undefined;
  const effectiveDestinationCollectionLabel =
    saveDestinationOverride?.pathLabel ??
    saveDestinationOverride?.label ??
    defaultDestinationLabel?.collectionLabel ??
    undefined;

  const handledSaveRequestRef = useRef<number | null>(null);
  // Beat grid the in-flight take is being recorded against, snapshotted when the take
  // starts (the global metronome settings can change afterwards). Attached to the saved
  // clip/stem as `recordingGrid`; null when the take doesn't use the metronome at all.
  const takeGridRef = useRef<RecordingGrid | null>(null);
  const countInPendingRef = useRef(false);
  const countInModeRef = useRef<"start" | "resume">("start");
  const initializedMetronomeRef = useRef(false);
  const pendingOverdubSaveRef = useRef<{ ideaId: string; clipId: string; title: string } | null>(null);
  const autoStoppingOverdubRef = useRef(false);
  const abandonedPlaceholderCleanupRef = useRef<() => void>(() => {});
  const metronome = useMetronome();
  const monitoringDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Phase-locked guide start scheduled during the count-in (overdubs). The token
  // invalidates an in-flight schedule when the guide is stopped/cancelled; the promise
  // resolves with the guide's measured start epoch for the head-trim math.
  const guideScheduleRef = useRef<{ token: number; promise: Promise<number | null> | null }>({
    token: 0,
    promise: null,
  });

  const recording = useRecording(
    async (payload) => {
      // A trimmed head means the file now STARTS at the musical start (downbeat for solo
      // takes, guide t=0 for overdubs) — record that certainty in the grid metadata.
      const takeGrid = takeGridRef.current
        ? {
            ...takeGridRef.current,
            firstDownbeatMs:
              payload.headTrimmedMs != null && payload.headTrimmedMs > 0
                ? 0
                : takeGridRef.current.firstDownbeatMs,
          }
        : undefined;

      const pendingOverdubSave = pendingOverdubSaveRef.current;
      if (pendingOverdubSave) {
        await appActions.attachRecordedOverdubStem(
          pendingOverdubSave.ideaId,
          pendingOverdubSave.clipId,
          { ...payload, recordingGrid: takeGrid },
          pendingOverdubSave.title
        );
        return;
      }

      const state = useStore.getState();
      const currentWorkspaceId = state.activeWorkspaceId;
      const targetIdea =
        recordingIdeaId && currentWorkspaceId
          ? state.workspaces
              .find((workspace) => workspace.id === currentWorkspaceId)
              ?.ideas.find((idea) => idea.id === recordingIdeaId) ?? null
          : null;
      // Signal non-attachment so saveRecording preserves the take for recovery instead of
      // clearing the session and silently orphaning the audio.
      if (!recordingIdeaId || !targetIdea) return false;

      const parentClip = recordingParentClipId
        ? targetIdea.clips.find((clip) => clip.id === recordingParentClipId) ?? null
        : null;

      const title = parentClip
        ? genChildClipTitle(targetIdea.clips, parentClip)
        : genRootClipTitle(targetIdea.clips);

      const clip: ClipVersion = {
        id: `clip-${Date.now()}`,
        title,
        isTitleAutoGenerated: true,
        notes: "",
        createdAt: Date.now(),
        isPrimary: targetIdea.kind === "project" ? isPrimaryDraft : true,
        parentClipId: recordingParentClipId ?? undefined,
        audioUri: payload.audioUri,
        durationMs: payload.durationMs,
        waveformPeaks: payload.waveformPeaks,
        recordingGrid: takeGrid,
        tags: parentClip?.tags?.length ? [...parentClip.tags] : undefined,
      };

      updateIdeas((ideas) =>
        ideas.map((idea) => {
          if (idea.id !== recordingIdeaId) return idea;

          const nextClips = idea.clips.map((existingClip) =>
            isPrimaryDraft ? { ...existingClip, isPrimary: false } : existingClip
          );

          return { ...idea, clips: [clip, ...nextClips] };
        })
      );
    },
    preferredRecordingInputId
  );

  const recordingControlsDisabled = isArmingRecording || (recording.isRecording && !recording.isPaused);
  const guideMixDurationMs =
    Math.round((guideMixStatus.duration ?? 0) * 1000) ||
    (recordingOverdubClip ? getClipPlaybackDurationMs(recordingOverdubClip) ?? 0 : 0);
  const rawGuideMixPositionMs = Math.round((guideMixStatus.currentTime ?? 0) * 1000);
  const guideMixPositionMs = Math.max(0, rawGuideMixPositionMs - guideMonitoringLeadInMs);
  const guideMixWaveformPeaks = recordingOverdubClip
    ? getClipPlaybackWaveformPeaks(recordingOverdubClip)
    : undefined;
  const isBluetoothRecordingInput = useMemo(() => isBluetoothLikeAudioDevice(currentRecordingInput), [currentRecordingInput]);
  const isBluetoothMonitoringOutput = useMemo(
    () => isBluetoothLikeAudioDevice(currentMonitoringOutput),
    [currentMonitoringOutput]
  );
  const bluetoothRouteKey = useMemo(
    () => buildBluetoothMonitoringRouteKey(currentMonitoringOutput),
    [currentMonitoringOutput]
  );
  const activeBluetoothCalibration = useMemo(
    () =>
      getBluetoothMonitoringCalibrationForRoute(
        bluetoothMonitoringCalibrations,
        isBluetoothMonitoringOutput ? bluetoothRouteKey : null
      ),
    [bluetoothMonitoringCalibrations, bluetoothRouteKey, isBluetoothMonitoringOutput]
  );
  const activeBluetoothCalibrationMs = activeBluetoothCalibration?.offsetMs ?? null;
  const monitoringCompensationMs =
    isBluetoothMonitoringOutput && activeBluetoothCalibrationMs != null ? activeBluetoothCalibrationMs : 0;
  const activeMonitoringCompensationMs =
    monitoringCompensationMs > 0 &&
    (Boolean(recordingGuideMixUri) || (recordingMetronomeEnabled && metronome.isNativeAvailable))
      ? monitoringCompensationMs
      : 0;

  const recordingInputLabel = currentRecordingInput?.name?.trim() || null;
  const monitoringOutputLabel = currentMonitoringOutput?.name?.trim() || null;

  const fallbackClipTitle = () => buildDefaultIdeaTitle();

  const recordingPlaceholderTitle =
    recordingOverdubClip
      ? getDefaultOverdubStemTitle(recordingOverdubClip)
      : recordingIdea
      ? recordingIdea.kind === "project"
        ? (() => {
            const parentClip = recordingParentClipId
              ? recordingIdea.clips.find((c) => c.id === recordingParentClipId) ?? null
              : null;
            const suggested = parentClip
              ? genChildClipTitle(recordingIdea.clips, parentClip)
              : genRootClipTitle(recordingIdea.clips);
            return ensureUniqueCountedTitle(suggested, recordingIdea.clips.map((c) => c.title));
          })()
        : ensureUniqueCountedTitle(
            recordingIdea.title || fallbackClipTitle(),
            (workspaces.find((w) => w.id === activeWorkspaceId)?.ideas ?? [])
              .filter((idea) => idea.kind === "clip" && idea.id !== recordingIdea.id)
              .map((idea) => idea.title)
          )
      : fallbackClipTitle();

  function clearMonitoringDelayTimer() {
    if (monitoringDelayTimeoutRef.current) {
      clearTimeout(monitoringDelayTimeoutRef.current);
      monitoringDelayTimeoutRef.current = null;
    }
  }

  async function waitForMonitoringCompensation(delayMs: number) {
    if (delayMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      monitoringDelayTimeoutRef.current = setTimeout(() => {
        monitoringDelayTimeoutRef.current = null;
        resolve();
      }, delayMs);
    });
  }

  async function waitForGuideMixPlaybackStart() {
    if (!recordingGuideMixUri) {
      return;
    }

    const activationDeadline = Date.now() + 1200;

    while (Date.now() < activationDeadline) {
      if (guideMixPlayer.playing && !guideMixPlayer.isBuffering) {
        return;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 16);
      });
    }
  }

  async function stopGuideMix() {
    guideScheduleRef.current.token += 1;
    guideScheduleRef.current.promise = null;
    clearMonitoringDelayTimer();
    setGuideMonitoringLeadInMs(0);
    if (!recordingGuideMixUri) return;
    try {
      guideMixPlayer.volume = 1;
      await guideMixPlayer.pause();
      await guideMixPlayer.seekTo(0);
    } catch (error) {
      console.warn("Guide mix stop failed", error);
    }
  }

  async function startGuideMixFromBeginning() {
    if (!recordingGuideMixUri) return;
    try {
      setGuideMonitoringLeadInMs(activeMonitoringCompensationMs);
      await guideMixPlayer.seekTo(0);
      guideMixPlayer.play();
      await waitForGuideMixPlaybackStart();
    } catch (error) {
      console.warn("Guide mix start failed", error);
    }
  }

  async function waitPlainMs(ms: number) {
    if (ms <= 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /** Epoch time the guide's audio started, anchored off its reported position. */
  async function measureGuideAnchorEpochMs(timeoutMs: number): Promise<number | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const positionSec = guideMixPlayer.currentTime ?? 0;
      if (guideMixPlayer.playing && !guideMixPlayer.isBuffering && positionSec > 0) {
        return Date.now() - positionSec * 1000;
      }
      await waitPlainMs(16);
    }
    return null;
  }

  /**
   * Phase-lock the guide to the live metronome grid without any mid-flight seek (device
   * logs showed a corrective seek stalls playback 50–200 ms — worse than the error it
   * fixed). Instead, during the count-in: warm-start the guide MUTED to measure this
   * device's real play() latency, rewind, then fire the audible start pre-compensated by
   * the measured latency so the guide's recorded clicks land on the grid. Resolves with
   * the guide's measured start epoch (what the head-trim math needs), or null on failure.
   */
  function schedulePhaseLockedGuideStart(targetStartEpochMs: number): Promise<number | null> {
    const token = ++guideScheduleRef.current.token;
    const task = (async (): Promise<number | null> => {
      try {
        setGuideMonitoringLeadInMs(activeMonitoringCompensationMs);
        guideMixPlayer.volume = 0;
        await guideMixPlayer.seekTo(0);
        const playCallAtMs = Date.now();
        guideMixPlayer.play();
        const warmAnchorEpochMs = await measureGuideAnchorEpochMs(1200);
        if (guideScheduleRef.current.token !== token) return null;
        const startLatencyMs =
          warmAnchorEpochMs != null
            ? Math.max(0, Math.min(600, warmAnchorEpochMs - playCallAtMs))
            : GUIDE_DOWNBEAT_LEAD_MS;
        await guideMixPlayer.pause();
        await guideMixPlayer.seekTo(0);
        if (guideScheduleRef.current.token !== token) return null;
        console.log(`[timing] guide warm-start latency: ${Math.round(startLatencyMs)}ms`);

        await waitPlainMs(targetStartEpochMs - startLatencyMs - Date.now());
        if (guideScheduleRef.current.token !== token) return null;
        guideMixPlayer.volume = 1;
        guideMixPlayer.play();
        const anchorEpochMs = await measureGuideAnchorEpochMs(1500);
        if (guideScheduleRef.current.token !== token) return null;
        if (anchorEpochMs != null) {
          console.log(
            `[timing] guide phase vs metronome grid: ${Math.round(
              anchorEpochMs - targetStartEpochMs
            )}ms (+ = guide late)`
          );
        }
        return anchorEpochMs;
      } catch (error) {
        console.warn("Phase-locked guide start failed", error);
        try {
          guideMixPlayer.volume = 1;
        } catch {
          // Player may already be released during teardown.
        }
        return null;
      }
    })();
    guideScheduleRef.current.promise = task;
    return task;
  }

  /** Start the guide from t=0 and return the epoch time its audio actually started
   *  (anchored off the player's reported position, same technique as the calibration
   *  baseline fix). Null when the anchor couldn't be established. */
  async function startGuideMixFromBeginningAnchored(): Promise<number | null> {
    if (!recordingGuideMixUri) return null;
    try {
      setGuideMonitoringLeadInMs(activeMonitoringCompensationMs);
      await guideMixPlayer.seekTo(0);
      guideMixPlayer.play();

      const anchorDeadline = Date.now() + 1500;
      while (Date.now() < anchorDeadline) {
        const positionSec = guideMixPlayer.currentTime ?? 0;
        if (guideMixPlayer.playing && !guideMixPlayer.isBuffering && positionSec > 0) {
          return Date.now() - positionSec * 1000;
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 16);
        });
      }
    } catch (error) {
      console.warn("Guide mix anchored start failed", error);
    }
    return null;
  }

  async function resumeGuideMix() {
    if (!recordingGuideMixUri) return;
    try {
      setGuideMonitoringLeadInMs(activeMonitoringCompensationMs);
      guideMixPlayer.play();
      await waitForGuideMixPlaybackStart();
    } catch (error) {
      console.warn("Guide mix resume failed", error);
    }
  }

  async function pauseGuideMix() {
    guideScheduleRef.current.token += 1;
    guideScheduleRef.current.promise = null;
    clearMonitoringDelayTimer();
    if (!recordingGuideMixUri) return;
    try {
      await guideMixPlayer.pause();
    } catch (error) {
      console.warn("Guide mix pause failed", error);
    }
  }

  async function stopRecordingMetronome() {
    clearMonitoringDelayTimer();
    if (!metronome.isRunning && !metronome.isCountIn) {
      return;
    }

    try {
      await metronome.stop();
    } catch (error) {
      console.warn("Recording metronome stop failed", error);
    }
  }

  // Persistent "use the metronome in the take" flag. Stays put regardless of
  // whether the preview is currently sounding — stopping the preview must not
  // disable the click during recording. Turning it off silences any preview.
  function setMetronomeEnabledForTake(nextEnabled: boolean) {
    setRecordingMetronomeEnabled(nextEnabled);
    if (!nextEnabled && !isArmingRecording && !recording.isRecording && !recording.isPaused) {
      void stopRecordingMetronome();
    }
  }

  // Start/stop only the audible preview while idle, without changing whether the
  // metronome is enabled for the take. Lets you silence the preview but still
  // have the click during recording (or audition without committing).
  async function toggleMetronomeSound() {
    if (isArmingRecording || recording.isRecording || recording.isPaused) {
      return;
    }
    if (!metronome.isNativeAvailable) {
      return;
    }

    if (metronome.isRunning && !metronome.isCountIn) {
      await stopRecordingMetronome();
      return;
    }

    try {
      await metronome.start({ manageAudioSession: true });
    } catch (error) {
      console.warn("Metronome preview start failed", error);
    }
  }

  async function cancelPendingRecordingStart() {
    takeGridRef.current = null;
    countInPendingRef.current = false;
    setIsArmingRecording(false);
    setOverdubReviewLocked(false);
    clearMonitoringDelayTimer();
    await stopGuideMix();
    await stopRecordingMetronome();
    await recording.cancelPreparedRecording();
  }

  async function cancelRecording() {
    if (!recordingIdea) return;
    if (isArmingRecording) {
      await cancelPendingRecordingStart();
    } else {
      takeGridRef.current = null;
      setOverdubReviewLocked(false);
      clearMonitoringDelayTimer();
      await stopGuideMix();
      await stopRecordingMetronome();
      await recording.discardRecording();
    }
    if (recordingIdea.kind === "clip" && recordingIdea.clips.length === 0) {
      updateIdeas((prevIdeas) => prevIdeas.filter((idea) => idea.id !== recordingIdea.id));
    }
    clearRecordingContext();
  }

  function confirmDiscardAndExit() {
    const hasRecordingToDiscard =
      isArmingRecording || recording.isRecording || recording.isPaused || recording.elapsedMs > 0;
    if (!hasRecordingToDiscard) {
      navigation.goBack();
      return;
    }

    AppAlert.destructive(
      "Discard recording?",
      "This recording has not been saved yet. If you leave now, it will be deleted.",
      () => {
        cancelRecording().then(() => navigation.goBack());
      },
      { confirmLabel: "Discard", cancelLabel: "Keep recording", icon: actionIcons.discard }
    );
  }

  async function requestSaveRecording() {
    if (!recordingIdea) return;
    if (isArmingRecording) return;
    if (quickNameModalVisible) return;
    if (!recording.isRecording && !recording.isPaused) return;
    if (recording.isRecording && !recording.isPaused) {
      await recording.pauseRecording();
      await pauseGuideMix();
      await stopRecordingMetronome();
    }

    setQuickNamingIdeaId(recordingIdea.id);
    setQuickNameDraft("");
    setIsPrimaryDraft(false);
    setSaveDestinationOverride(null);
    setQuickNameModalVisible(true);
  }

  function handleSelectSaveDestination(destination: SaveDestination) {
    setSaveDestinationOverride(destination);
    setSaveDestinationPickerVisible(false);
  }

  async function redoOverdubRecording() {
    takeGridRef.current = null;
    setQuickNameModalVisible(false);
    setQuickNameDraft("");
    setQuickNamingIdeaId(null);
    setOverdubReviewLocked(false);
    await stopGuideMix();
    await stopRecordingMetronome();
    await recording.discardRecording();
  }

  function handleQuickNameCancel() {
    if (recordingOverdubClip && overdubReviewLocked) {
      AppAlert.destructive(
        "Review overdub",
        "This overdub already reached the end of the guide. You can save it now or discard it and record again.",
        () => {
          void redoOverdubRecording();
        },
        { confirmLabel: "Redo overdub", cancelLabel: "Keep take", icon: actionIcons.restore }
      );
      return;
    }

    setQuickNameModalVisible(false);
  }

  async function saveQuickClipName() {
    if (!quickNamingIdeaId) return false;
    const targetIdea = recordingIdea;
    const isStandaloneClipRecording = targetIdea?.kind === "clip";
    const overdubSaveTarget =
      recordingIdeaId && recordingOverdubClipId
        ? {
            ideaId: recordingIdeaId,
            clipId: recordingOverdubClipId,
            title:
              quickNameDraft.trim() ||
              (recordingOverdubClip ? getDefaultOverdubStemTitle(recordingOverdubClip) : "Layer 1"),
          }
        : null;

    pendingOverdubSaveRef.current = overdubSaveTarget;

    const saved = await recording.saveRecording();
    pendingOverdubSaveRef.current = null;
    if (!saved) {
      if (overdubSaveTarget) {
        setQuickNameModalVisible(false);
        setQuickNameDraft("");
        setQuickNamingIdeaId(null);
        setSaveDestinationOverride(null);
        clearRecordingContext();
      }
      return false;
    }
    await stopGuideMix();
    await stopRecordingMetronome();

    if (recordingOverdubClip) {
      setQuickNameModalVisible(false);
      setQuickNameDraft("");
      setQuickNamingIdeaId(null);
      setOverdubReviewLocked(false);
      setSaveDestinationOverride(null);
      clearRecordingContext();
      return true;
    }

    const suggestedTitle =
      recordingIdea?.kind === "project"
        ? (() => {
            const parentClip = recordingParentClipId
              ? recordingIdea.clips.find((c) => c.id === recordingParentClipId) ?? null
              : null;
            const suggested = parentClip
              ? genChildClipTitle(recordingIdea.clips, parentClip)
              : genRootClipTitle(recordingIdea.clips);
            return ensureUniqueCountedTitle(suggested, recordingIdea.clips.map((c) => c.title));
          })()
        : ensureUniqueCountedTitle(
            recordingIdea?.title || fallbackClipTitle(),
            (workspaces.find((w) => w.id === activeWorkspaceId)?.ideas ?? [])
              .filter((idea) => idea.kind === "clip" && idea.id !== recordingIdea?.id)
              .map((idea) => idea.title)
          );
    const nextTitle = quickNameDraft.trim() || suggestedTitle;

    updateIdeas((prevIdeas) =>
      prevIdeas.map((idea) => {
        if (idea.id !== quickNamingIdeaId) return idea;
        const firstClipId = idea.clips[0]?.id;
        if (!firstClipId) return idea;

        if (idea.kind === "clip") {
          return {
            ...idea,
            title: nextTitle,
            clips: idea.clips.map((clip) =>
              clip.id === firstClipId ? { ...clip, title: nextTitle } : clip
            ),
          };
        }

        return {
          ...idea,
          clips: idea.clips.map((clip) =>
            clip.id === firstClipId ? { ...clip, title: nextTitle } : clip
          ),
        };
      })
    );

    const savedIdeaBeforeRelocation = useStore
      .getState()
      .workspaces.find((workspace) => workspace.id === activeWorkspaceId)
      ?.ideas.find((idea) => idea.id === quickNamingIdeaId);

    if (
      isStandaloneClipRecording &&
      saveDestinationOverride &&
      activeWorkspaceId &&
      (saveDestinationOverride.workspaceId !== activeWorkspaceId ||
        saveDestinationOverride.collectionId !== savedIdeaBeforeRelocation?.collectionId)
    ) {
      appActions.relocateIdeaToCollection(
        quickNamingIdeaId,
        activeWorkspaceId,
        saveDestinationOverride.workspaceId,
        saveDestinationOverride.collectionId
      );
    }

    const finalWorkspaceId = saveDestinationOverride?.workspaceId ?? activeWorkspaceId;
    const savedIdea = useStore
      .getState()
      .workspaces.find((workspace) => workspace.id === finalWorkspaceId)
      ?.ideas.find((idea) => idea.id === quickNamingIdeaId);
    const savedClipId = savedIdea?.clips[0]?.id ?? null;
    if (savedIdea) {
      useStore
        .getState()
        .logIdeaActivity(
          savedIdea.id,
          isStandaloneClipRecording ? "created" : "updated",
          "recording",
          savedClipId
        );
    }

    setQuickNameModalVisible(false);
    setQuickNameDraft("");
    setQuickNamingIdeaId(null);
    setOverdubReviewLocked(false);
    setSaveDestinationOverride(null);
    clearRecordingContext();
    return true;
  }

  useEffect(() => {
    if (recordingSaveRequestToken === handledSaveRequestRef.current) return;
    handledSaveRequestRef.current = recordingSaveRequestToken;
    if (!recordingSaveRequestToken) return;
    void requestSaveRecording();
  }, [recordingSaveRequestToken]);

  useEffect(() => {
    let cancelled = false;

    async function refreshCurrentRecordingInput() {
      try {
        const device = await audioDeviceManager.getCurrentDevice();
        const outputRoute = await SongseedMetronomeModule?.getCurrentAudioOutputRoute?.();
        if (!cancelled) {
          setCurrentRecordingInput(device ?? null);
          setCurrentMonitoringOutput(outputRoute ?? null);
        }
      } catch {
        if (!cancelled) {
          setCurrentRecordingInput(null);
          setCurrentMonitoringOutput(null);
        }
      }
    }

    void refreshCurrentRecordingInput();
    const removeListener = audioDeviceManager.addDeviceChangeListener(() => {
      void refreshCurrentRecordingInput();
    });

    return () => {
      cancelled = true;
      removeListener();
    };
  }, []);

  useEffect(() => {
    if (!recordingOverdubClip) {
      return;
    }
    if (!recording.isRecording || recording.isPaused || isArmingRecording || quickNameModalVisible) {
      return;
    }
    if (!guideMixDurationMs || guideMixDurationMs <= 0) {
      return;
    }
    if (recording.elapsedMs < guideMixDurationMs) {
      return;
    }
    if (autoStoppingOverdubRef.current) {
      return;
    }

    autoStoppingOverdubRef.current = true;
    setOverdubReviewLocked(true);
    void requestSaveRecording().finally(() => {
      autoStoppingOverdubRef.current = false;
    });
  }, [
    guideMixDurationMs,
    isArmingRecording,
    quickNameModalVisible,
    recording.elapsedMs,
    recording.isPaused,
    recording.isRecording,
    recordingOverdubClip,
  ]);

  // Preset the metronome from the target clip's saved recording grid so overdubs and
  // variations line up with the tempo/meter the original take was actually recorded
  // against — regardless of what the global metronome was changed to since. Count-in
  // stays the user's global preference. Runs once per target clip.
  const takeGridSourceClip = useMemo(
    () =>
      recordingOverdubClip ??
      (recordingParentClipId && recordingIdea
        ? recordingIdea.clips.find((clip) => clip.id === recordingParentClipId) ?? null
        : null),
    [recordingIdea, recordingOverdubClip, recordingParentClipId]
  );
  const restoredGridLabel = takeGridSourceClip?.recordingGrid
    ? `Original take: ${takeGridSourceClip.recordingGrid.bpm} BPM · ${takeGridSourceClip.recordingGrid.meterId}`
    : null;
  const restoredGridClipIdRef = useRef<string | null>(null);
  useEffect(() => {
    const grid = takeGridSourceClip?.recordingGrid;
    if (!takeGridSourceClip || !grid) {
      return;
    }
    if (restoredGridClipIdRef.current === takeGridSourceClip.id) {
      return;
    }
    restoredGridClipIdRef.current = takeGridSourceClip.id;
    metronome.setBpmValue(grid.bpm);
    metronome.setMeterIdValue(grid.meterId);
  }, [metronome, takeGridSourceClip]);

  useEffect(() => {
    if (initializedMetronomeRef.current) {
      return;
    }
    initializedMetronomeRef.current = true;

    if (!recording.isRecording && !recording.isPaused && (metronome.isRunning || metronome.isCountIn)) {
      void stopRecordingMetronome();
    }
  }, [metronome.isCountIn, metronome.isRunning, recording.isPaused, recording.isRecording]);

  useEffect(() => {
    if (!countInPendingRef.current || metronome.countInCompletionToken === 0) {
      return;
    }

    countInPendingRef.current = false;
    const mode = countInModeRef.current;
    void (async () => {
      const delayMs = activeMonitoringCompensationMs;
      let started = false;

      if (mode === "resume") {
        await resumeGuideMix();
        await waitForMonitoringCompensation(delayMs);
        await recording.resumeRecording();
        started = true;
      } else {
        // Capture has been rolling since before the count-in (record-through). Nothing to
        // start here — instead, measure where the musical start lands in the capture and
        // commit that head for trimming at save. The completion event fires ON the last
        // count-in click, one beat interval before the actual downbeat, so the downbeat
        // epoch computed from the grid anchor is (correctly) in the near future.
        started = recording.isRecording;
        const captureStartEpochMs = recording.getCaptureStartEpochMs();
        const anchor = await SongseedMetronomeModule?.getGridAnchor?.().catch(() => null);

        // CRITICAL time-domain correction: the grid anchor and player positions live in
        // the RENDER domain, but what the mic recorded is the AUDIBLE event — later by
        // the route's output latency (150–250ms on Android speakers — half a beat at
        // ~118 BPM) plus the mic path's input latency. Trim to the audible downbeat, not
        // the render-domain one, or every take's clicks sit that far into the file. For
        // calibrated BT routes the monitoring compensation already measures the output
        // side by ear — take the larger of the two, never both.
        const routeLatency = await SongseedMetronomeModule?.getCurrentAudioRouteLatencyMs?.().catch(
          () => null
        );
        let outputLatencyMs =
          typeof routeLatency?.outputMs === "number" && routeLatency.outputMs > 0
            ? routeLatency.outputMs
            : 0;
        // Android's hidden AudioTrack#getLatency on the metronome's MODE_STATIC loop
        // reports the track's entire one-bar buffer PLUS the real sink latency (device
        // logs: 2142ms at 118 BPM = 2034ms bar + 108ms sink). Strip the bar when the
        // value is clearly buffer-inflated; anything still implausible is unknown, and
        // an unknown must be 0 — a wrong correction is worse than none.
        const barMs =
          anchor?.msPerPulse != null
            ? anchor.msPerPulse * (anchor.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar)
            : null;
        if (outputLatencyMs > 600 && barMs != null && outputLatencyMs > barMs) {
          const strippedMs = outputLatencyMs - barMs;
          console.log(
            `[timing] output latency ${Math.round(outputLatencyMs)}ms includes the click ` +
              `loop buffer — using ${Math.round(strippedMs)}ms`
          );
          outputLatencyMs = strippedMs;
        }
        if (!(outputLatencyMs > 0 && outputLatencyMs <= 600)) {
          outputLatencyMs = 0;
        }
        const inputLatencyMs =
          typeof routeLatency?.inputMs === "number" &&
          routeLatency.inputMs > 0 &&
          routeLatency.inputMs <= 600
            ? routeLatency.inputMs
            : 0;
        const audibleCorrectionMs = Math.max(outputLatencyMs, delayMs) + inputLatencyMs;
        console.log(
          `[timing] route latency: out=${Math.round(outputLatencyMs)}ms in=${Math.round(
            inputLatencyMs
          )}ms → audible correction ${Math.round(audibleCorrectionMs)}ms` +
            (outputLatencyMs === 0 ? " (OUTPUT LATENCY UNKNOWN — trim stays render-domain)" : "")
        );
        const grid = takeGridRef.current;
        const countInPulses =
          (grid?.countInBars ?? 0) * (anchor?.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar);
        const downbeatEpochMs =
          anchor?.isRunning && anchor.anchorEpochMs != null && anchor.msPerPulse != null
            ? anchor.anchorEpochMs + countInPulses * anchor.msPerPulse
            : null;

        let headMs = 0;
        if (recordingGuideMixUri) {
          // The guide start was phase-locked and scheduled during the count-in (measured
          // play() latency, no seek). Await its measured start epoch for the trim math.
          let guideStartEpochMs: number | null = null;
          const scheduledGuideStart = guideScheduleRef.current.promise;
          if (scheduledGuideStart) {
            guideStartEpochMs = await scheduledGuideStart;
          }
          if (guideStartEpochMs == null) {
            // Fallback (anchor unavailable / schedule invalidated): aim at the downbeat
            // with the fixed lead and measure after the fact — alignment of the RECORDED
            // stem stays exact either way; only live-click phase is coarser here.
            if (downbeatEpochMs != null) {
              const aimWaitMs = downbeatEpochMs - Date.now() - GUIDE_DOWNBEAT_LEAD_MS;
              if (aimWaitMs > 0) {
                await waitForMonitoringCompensation(aimWaitMs);
              }
            }
            guideStartEpochMs = await startGuideMixFromBeginningAnchored();
          }

          if (captureStartEpochMs != null && guideStartEpochMs != null) {
            headMs =
              guideStartEpochMs -
              captureStartEpochMs +
              audibleCorrectionMs -
              HEAD_TRIM_SAFETY_EARLY_MS;
          }
        } else if (captureStartEpochMs != null && downbeatEpochMs != null) {
          headMs =
            downbeatEpochMs -
            captureStartEpochMs +
            audibleCorrectionMs -
            HEAD_TRIM_SAFETY_EARLY_MS;
        }
        // headMs <= 0 or unmeasurable → commit 0: the take keeps its pre-roll instead of
        // guessing a cut (never trim on a guess).
        console.log(
          `[timing] head trim committed: ${Math.round(headMs)}ms ` +
            `(captureStart=${captureStartEpochMs != null ? "measured" : "MISSING"}, ` +
            `anchor=${downbeatEpochMs != null ? "measured" : "MISSING"})`
        );
        recording.commitHeadTrim(headMs);
      }

      setIsArmingRecording(false);
      if (!started) {
        await stopRecordingMetronome();
        await stopGuideMix();
        await recording.cancelPreparedRecording();
        return;
      }

      // Count-in is one-shot: clear it so the next take doesn't auto-count-in unless the
      // user explicitly re-enables it.
      metronome.setCountInBarsValue(0);

      // If the metronome wasn't meant to click through the take, silence it now that the
      // count-in is done and recording has begun.
      if (!recordingMetronomeEnabled) {
        await stopRecordingMetronome();
      }
    })();
  }, [
    activeMonitoringCompensationMs,
    metronome.countInCompletionToken,
    metronome.meterPreset.pulsesPerBar,
    metronome.setCountInBarsValue,
    recording,
    recordingGuideMixUri,
    recordingMetronomeEnabled,
    recordingOverdubClip,
  ]);

  useEffect(() => {
    if (recording.interruptionToken === 0) {
      return;
    }

    countInPendingRef.current = false;
    setIsArmingRecording(false);

    void (async () => {
      await stopGuideMix();
      if (metronome.isRunning || metronome.isCountIn) {
        try {
          await metronome.stop();
        } catch (error) {
          console.warn("Recording metronome stop after interruption failed", error);
        }
      }
    })();
  }, [metronome.isCountIn, metronome.isRunning, metronome.stop, recording.interruptionToken]);

  async function handleStartRecording() {
    if (isArmingRecording) {
      return;
    }
    if (overdubReviewLocked) {
      return;
    }

    autoStoppingOverdubRef.current = false;
    setSettingsVisible(false);
    setMetronomeSheetVisible(false);

    // Count-in is independent of whether the metronome clicks through the take: a count-in
    // can run (using the metronome's bpm/meter/cues) even when the metronome itself is "off",
    // in which case the click is silenced the moment recording begins (see the count-in
    // completion effect). The click only continues into the take when the metronome is enabled.
    const wantsCountIn = metronome.countInBars > 0 && metronome.isNativeAvailable;
    const wantsClickDuringTake = recordingMetronomeEnabled && metronome.isNativeAvailable;

    // Snapshot the beat grid this take is recorded against before anything can mutate the
    // global metronome settings (the count-in completion effect resets countInBars to 0).
    takeGridRef.current =
      wantsCountIn || wantsClickDuringTake
        ? {
            bpm: metronome.bpm,
            meterId: metronome.meterId,
            countInBars: wantsCountIn ? metronome.countInBars : 0,
            clickThroughTake: wantsClickDuringTake,
            firstDownbeatMs: null,
            source: "metronome",
          }
        : null;

    if (wantsCountIn) {
      const prepared = await recording.prepareRecording();
      if (!prepared) {
        return;
      }

      setIsArmingRecording(true);
      try {
        // If the metronome was already clicking as a pre-recording preview, restart it cleanly
        // for the count-in rather than layering the count-in on top of the running loop.
        const alreadyPreviewing = metronome.isRunning && !metronome.isCountIn;
        if (alreadyPreviewing) {
          await metronome.stop();
          await new Promise((resolve) => setTimeout(resolve, 180));
        }

        // Record THROUGH the count-in: capture rolls before the first click, the count-in
        // completion effect measures where the musical start (downbeat / guide start)
        // landed in the capture, and the head is trimmed at save. Starting capture at the
        // completion event instead used to leave a random ~half-beat of pre-roll (the JS
        // chain raced the final count-in beat).
        const started = await recording.startPreparedRecording();
        if (!started) {
          setIsArmingRecording(false);
          return;
        }
        recording.armHeadTrim();

        countInModeRef.current = "start";
        countInPendingRef.current = true;
        await metronome.startCountIn(metronome.countInBars, {
          manageAudioSession: false,
          cueDelayMs: activeMonitoringCompensationMs,
        });

        // Overdub: use the count-in itself to phase-lock the guide — measure its play()
        // latency muted, then schedule the audible start pre-compensated to land the
        // guide's t=0 (its measured downbeat) exactly on the live metronome's downbeat.
        if (recordingGuideMixUri) {
          void (async () => {
            await waitPlainMs(120); // let the engine's audio clock settle before anchoring
            const anchor = await SongseedMetronomeModule?.getGridAnchor?.().catch(() => null);
            if (!anchor?.isRunning || anchor.anchorEpochMs == null || anchor.msPerPulse == null) {
              console.log("[timing] grid anchor unavailable — guide falls back to aim-at-completion");
              return;
            }
            const grid = takeGridRef.current;
            const countInPulses =
              (grid?.countInBars ?? 0) * (anchor.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar);
            const downbeatEpochMs = anchor.anchorEpochMs + countInPulses * anchor.msPerPulse;
            const masterFirstDownbeatMs =
              recordingOverdubClip?.recordingGrid?.firstDownbeatMs ?? null;
            if (masterFirstDownbeatMs == null) {
              console.log(
                "[timing] master has no measured downbeat (recorded before trimming) — " +
                  "starting guide at the live downbeat; its internal pre-roll cannot be locked"
              );
            }
            void schedulePhaseLockedGuideStart(downbeatEpochMs - (masterFirstDownbeatMs ?? 0));
          })();
        }
      } catch (error) {
        console.warn("Recording count-in start failed", error);
        countInPendingRef.current = false;
        await stopGuideMix();
        await stopRecordingMetronome();
        await recording.cancelPreparedRecording();
        setIsArmingRecording(false);
      }
      return;
    }

    if (!wantsClickDuringTake) {
      if (activeMonitoringCompensationMs > 0 && recordingGuideMixUri) {
        const prepared = await recording.prepareRecording();
        if (!prepared) {
          return;
        }

        setIsArmingRecording(true);
        try {
          await startGuideMixFromBeginning();
          await waitForMonitoringCompensation(activeMonitoringCompensationMs);
          const started = await recording.startPreparedRecording();
          if (!started) {
            await stopGuideMix();
          }
        } finally {
          setIsArmingRecording(false);
        }
        return;
      }

      const started = await recording.startRecording();
      if (!started) {
        return;
      }
      await startGuideMixFromBeginning();
      return;
    }

    const prepared = await recording.prepareRecording();
    if (!prepared) {
      return;
    }

    setIsArmingRecording(true);

    try {
      const alreadyPreviewing = metronome.isRunning && !metronome.isCountIn;
      if (!alreadyPreviewing) {
        await metronome.start({
          manageAudioSession: false,
          cueDelayMs: activeMonitoringCompensationMs,
        });
      }
      await startGuideMixFromBeginning();
      await waitForMonitoringCompensation(activeMonitoringCompensationMs);
      const started = await recording.startPreparedRecording();
      if (!started) {
        await stopRecordingMetronome();
        await stopGuideMix();
        return;
      }
    } catch (error) {
      console.warn("Recording metronome start failed", error);
      await stopGuideMix();
      await stopRecordingMetronome();
      await recording.cancelPreparedRecording();
    } finally {
      setIsArmingRecording(false);
    }
  }

  async function handlePauseRecording() {
    await recording.pauseRecording();
    await pauseGuideMix();
    await stopRecordingMetronome();
  }

  async function handleResumeRecording() {
    if (overdubReviewLocked) {
      return;
    }
    autoStoppingOverdubRef.current = false;

    // If count-in was (re)enabled while paused, run a fresh count-in before resuming. The
    // completion effect handles the actual resume (mode "resume") and one-shot reset.
    const wantsCountIn = metronome.countInBars > 0 && metronome.isNativeAvailable;
    if (wantsCountIn) {
      setIsArmingRecording(true);
      try {
        const alreadyPreviewing = metronome.isRunning && !metronome.isCountIn;
        if (alreadyPreviewing) {
          await metronome.stop();
          await new Promise((resolve) => setTimeout(resolve, 180));
        }
        countInModeRef.current = "resume";
        countInPendingRef.current = true;
        await metronome.startCountIn(metronome.countInBars, {
          manageAudioSession: false,
          cueDelayMs: activeMonitoringCompensationMs,
        });
      } catch (error) {
        console.warn("Recording count-in resume failed", error);
        countInPendingRef.current = false;
        await stopRecordingMetronome();
        setIsArmingRecording(false);
      }
      return;
    }

    await resumeGuideMix();
    if (recordingMetronomeEnabled && metronome.isNativeAvailable) {
      try {
        await metronome.start({
          manageAudioSession: false,
          cueDelayMs: activeMonitoringCompensationMs,
        });
      } catch (error) {
        console.warn("Recording metronome resume failed", error);
      }
    }
    await waitForMonitoringCompensation(activeMonitoringCompensationMs);
    await recording.resumeRecording();
  }

  function minimizeRecording() {
    if (isArmingRecording) {
      void cancelPendingRecordingStart().then(() => navigation.goBack());
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home" as never);
  }

  // Keep an always-current cleanup closure so the unmount effect (which runs with empty deps)
  // sees the latest state instead of a stale snapshot from first render.
  useEffect(() => {
    abandonedPlaceholderCleanupRef.current = () => {
      // Quick Record inserts an empty placeholder "clip" idea up front, before any audio is
      // captured. If the screen is left without ever recording (back button, minimize, hardware
      // back, or swipe gesture), remove that placeholder so it doesn't linger in the collection
      // as a ghost clip. Guarded to only touch an empty standalone-clip placeholder with no take
      // in progress — never a project or an idea that already has clips.
      if (!recordingIdea) return;
      if (recordingIdea.kind !== "clip" || recordingIdea.clips.length > 0) return;
      if (recording.isRecording || recording.isPaused || isArmingRecording || recording.elapsedMs > 0) {
        return;
      }
      if (quickNameModalVisible) return;

      // This can legitimately take the library from one idea to zero (e.g. the user's very
      // first quick-record, abandoned before anything was captured) — authorize it so the
      // persist guard doesn't mistake it for unannounced data loss.
      authorizeIntentionalEmptyStateWrite(6);
      updateIdeas((prevIdeas) => prevIdeas.filter((idea) => idea.id !== recordingIdea.id));
      clearRecordingContext();
    };
  });

  useEffect(() => {
    return () => {
      try {
        guideMixPlayer.pause();
      } catch {
        // Ignore teardown noise during unmount.
      }
      clearMonitoringDelayTimer();
    };
  }, [guideMixPlayer]);

  // Unmount-only: drop an abandoned empty placeholder idea. Empty deps so it fires solely on
  // screen teardown, not when guideMixPlayer is recreated mid-session.
  useEffect(() => {
    return () => {
      abandonedPlaceholderCleanupRef.current();
    };
  }, []);

  return {
    recordingIdea,
    recordingOverdubClip,
    headerEyebrow,
    headerTitlePlaceholder,
    latestLyricsVersion,
    latestLyricsText,
    hasProjectLyrics,
    recording,
    recordingControlsDisabled,
    recordingPlaceholderTitle,
    quickNameModalVisible,
    quickNameDraft,
    isPrimaryDraft,
    settingsVisible,
    metronomeSheetVisible,
    preferredRecordingInputId,
    recordingMetronomeEnabled,
    isArmingRecording,
    overdubReviewLocked,
    guideMixIsPlaying: !!guideMixStatus.playing,
    guideMixPositionMs,
    guideMixDurationMs,
    guideMixWaveformPeaks,
    isBluetoothRecordingInput,
    isBluetoothMonitoringOutput,
    recordingInputLabel,
    monitoringOutputLabel,
    activeBluetoothCalibrationMs,
    lyricsExpanded,
    lyricsAutoscrollMode,
    lyricsAutoscrollSpeedMultiplier,
    metronome,
    restoredGridLabel,
    canPickSaveDestination,
    saveDestinations,
    saveDestinationPickerVisible,
    saveDestinationOverride,
    effectiveDestinationWorkspaceTitle,
    effectiveDestinationCollectionLabel,
    setSaveDestinationPickerVisible,
    handleSelectSaveDestination,
    setQuickNameDraft,
    setQuickNameModalVisible,
    setIsPrimaryDraft,
    setSettingsVisible,
    setMetronomeSheetVisible,
    setPreferredRecordingInputId,
    setRecordingMetronomeEnabled,
    setMetronomeEnabledForTake,
    toggleMetronomeSound,
    setLyricsExpanded,
    setLyricsAutoscrollMode,
    setLyricsAutoscrollSpeedMultiplier,
    confirmDiscardAndExit,
    handleQuickNameCancel,
    minimizeRecording,
    requestSaveRecording,
    saveQuickClipName,
    handlePauseRecording,
    handleResumeRecording,
    handleStartRecording,
  };
}
