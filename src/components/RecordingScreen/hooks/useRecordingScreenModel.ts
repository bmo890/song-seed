import { useNavigation } from "@react-navigation/native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { audioDeviceManager, type AudioDevice } from "@siteed/audio-studio";
import { Alert } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { ClipVersion } from "../../../types";
import { getDefaultOverdubStemTitle } from "../../../overdub";
import {
  buildDefaultIdeaTitle,
  ensureUniqueCountedTitle,
  genClipTitle,
} from "../../../utils";

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
  const latestLyricsVersion = recordingIdea?.kind === "project" ? getLatestLyricsVersion(recordingIdea) : null;
  const latestLyricsText = lyricsDocumentToText(latestLyricsVersion?.document);
  const hasProjectLyrics = recordingIdea?.kind === "project" && latestLyricsText.trim().length > 0;
  const guideMixSource = useMemo(
    () => (recordingGuideMixUri ? { uri: recordingGuideMixUri } : null),
    [recordingGuideMixUri]
  );
  const guideMixPlayer = useAudioPlayer(guideMixSource, { updateInterval: 250 });
  const guideMixStatus = useAudioPlayerStatus(guideMixPlayer);

  const [isPrimaryDraft, setIsPrimaryDraft] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [recordingMetronomeEnabled, setRecordingMetronomeEnabled] = useState(false);
  const [isArmingRecording, setIsArmingRecording] = useState(false);
  const [currentRecordingInput, setCurrentRecordingInput] = useState<AudioDevice | null>(null);
  const [currentMonitoringOutput, setCurrentMonitoringOutput] = useState<{ name: string; type: string } | null>(null);
  const [guideMonitoringLeadInMs, setGuideMonitoringLeadInMs] = useState(0);
  const [overdubReviewLocked, setOverdubReviewLocked] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [lyricsAutoscrollMode, setLyricsAutoscrollMode] = useState<"off" | "follow" | "manual">("follow");
  const [lyricsAutoscrollSpeedMultiplier, setLyricsAutoscrollSpeedMultiplier] = useState(1);

  const handledSaveRequestRef = useRef<number | null>(null);
  const countInPendingRef = useRef(false);
  const initializedMetronomeRef = useRef(false);
  const pendingOverdubSaveRef = useRef<{ ideaId: string; clipId: string; title: string } | null>(null);
  const autoStoppingOverdubRef = useRef(false);
  const metronome = useMetronome();
  const monitoringDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recording = useRecording(
    async (payload) => {
      const pendingOverdubSave = pendingOverdubSaveRef.current;
      if (pendingOverdubSave) {
        await appActions.attachRecordedOverdubStem(
          pendingOverdubSave.ideaId,
          pendingOverdubSave.clipId,
          payload,
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
      if (!recordingIdeaId || !targetIdea) return;

      const parentClip = recordingParentClipId
        ? targetIdea.clips.find((clip) => clip.id === recordingParentClipId) ?? null
        : null;
      const title = genClipTitle(targetIdea.title, targetIdea.clips.length + 1);

      const clip: ClipVersion = {
        id: `clip-${Date.now()}`,
        title,
        notes: "",
        createdAt: Date.now(),
        isPrimary: targetIdea.kind === "project" ? isPrimaryDraft : true,
        parentClipId: recordingParentClipId ?? undefined,
        audioUri: payload.audioUri,
        durationMs: payload.durationMs,
        waveformPeaks: payload.waveformPeaks,
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
        ? ensureUniqueCountedTitle(
            genClipTitle(recordingIdea.title, recordingIdea.clips.length + 1),
            recordingIdea.clips.map((clip) => clip.title)
          )
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
    clearMonitoringDelayTimer();
    setGuideMonitoringLeadInMs(0);
    if (!recordingGuideMixUri) return;
    try {
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

  async function cancelPendingRecordingStart() {
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

    Alert.alert(
      "Discard recording?",
      "This recording has not been saved yet. If you leave now, it will be deleted.",
      [
        { text: "Keep recording", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            cancelRecording().then(() => navigation.goBack());
          },
        },
      ]
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
    setQuickNameModalVisible(true);
  }

  async function redoOverdubRecording() {
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
      Alert.alert(
        "Review overdub",
        "This overdub already reached the end of the guide. You can save it now or discard it and record again.",
        [
          { text: "Keep take", style: "cancel" },
          {
            text: "Redo overdub",
            style: "destructive",
            onPress: () => {
              void redoOverdubRecording();
            },
          },
        ]
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
      clearRecordingContext();
      return true;
    }

    const suggestedTitle =
      recordingIdea?.kind === "project"
        ? ensureUniqueCountedTitle(
            genClipTitle(recordingIdea.title, recordingIdea.clips.length + 1),
            recordingIdea.clips.map((clip) => clip.title)
          )
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

    const savedIdea = useStore
      .getState()
      .workspaces.find((workspace) => workspace.id === activeWorkspaceId)
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
    void (async () => {
      const delayMs = activeMonitoringCompensationMs;
      if (recordingGuideMixUri) {
        await startGuideMixFromBeginning();
      }
      await waitForMonitoringCompensation(delayMs);
      const started = await recording.startPreparedRecording();
      setIsArmingRecording(false);
      if (!started) {
        await stopRecordingMetronome();
        await stopGuideMix();
        return;
      }
    })();
  }, [activeMonitoringCompensationMs, metronome.countInCompletionToken, recording, recordingGuideMixUri]);

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

    if (!recordingMetronomeEnabled || !metronome.isNativeAvailable) {
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

      await recording.startRecording();
      await startGuideMixFromBeginning();
      return;
    }

    const prepared = await recording.prepareRecording();
    if (!prepared) {
      return;
    }

    setIsArmingRecording(true);

    try {
      if (metronome.countInBars > 0) {
        countInPendingRef.current = true;
        await metronome.startCountIn(metronome.countInBars, {
          manageAudioSession: false,
          cueDelayMs: activeMonitoringCompensationMs,
        });
        return;
      }

      await metronome.start({
        manageAudioSession: false,
        cueDelayMs: activeMonitoringCompensationMs,
      });
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
      countInPendingRef.current = false;
      await stopGuideMix();
      await stopRecordingMetronome();
      await recording.cancelPreparedRecording();
    } finally {
      if (!countInPendingRef.current) {
        setIsArmingRecording(false);
      }
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

  return {
    recordingIdea,
    recordingOverdubClip,
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
    setQuickNameDraft,
    setQuickNameModalVisible,
    setIsPrimaryDraft,
    setSettingsVisible,
    setPreferredRecordingInputId,
    setRecordingMetronomeEnabled,
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
