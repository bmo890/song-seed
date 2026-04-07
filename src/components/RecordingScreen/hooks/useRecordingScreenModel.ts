import { useNavigation } from "@react-navigation/native";
import { Alert } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../lyrics";
import { useRecording } from "../../../hooks/useRecording";
import { useMetronome } from "../../../hooks/useMetronome";
import { useStore } from "../../../state/useStore";
import type { ClipVersion } from "../../../types";
import {
  buildDefaultIdeaTitle,
  ensureUniqueCountedTitle,
  genClipTitle,
} from "../../../utils";

export function useRecordingScreenModel() {
  const navigation = useNavigation();

  const recordingIdeaId = useStore((s) => s.recordingIdeaId);
  const recordingParentClipId = useStore((s) => s.recordingParentClipId);
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
  const setPreferredRecordingInputId = useStore((s) => s.setPreferredRecordingInputId);
  const updateIdeas = useStore((s) => s.updateIdeas);

  const recordingIdea = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId)?.ideas.find((i) => i.id === recordingIdeaId),
    [workspaces, activeWorkspaceId, recordingIdeaId]
  );
  const latestLyricsVersion = recordingIdea?.kind === "project" ? getLatestLyricsVersion(recordingIdea) : null;
  const latestLyricsText = lyricsDocumentToText(latestLyricsVersion?.document);
  const hasProjectLyrics = recordingIdea?.kind === "project" && latestLyricsText.trim().length > 0;

  const [isPrimaryDraft, setIsPrimaryDraft] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [recordingMetronomeEnabled, setRecordingMetronomeEnabled] = useState(false);
  const [isArmingRecording, setIsArmingRecording] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [lyricsAutoscrollMode, setLyricsAutoscrollMode] = useState<"off" | "follow" | "manual">("follow");
  const [lyricsAutoscrollSpeedMultiplier, setLyricsAutoscrollSpeedMultiplier] = useState(1);

  const handledSaveRequestRef = useRef<number | null>(null);
  const countInPendingRef = useRef(false);
  const initializedMetronomeRef = useRef(false);
  const metronome = useMetronome();

  const recording = useRecording(
    (payload) => {
      if (!recordingIdeaId || !recordingIdea) return;
      const parentClip = recordingParentClipId
        ? recordingIdea.clips.find((clip) => clip.id === recordingParentClipId) ?? null
        : null;
      const title = genClipTitle(recordingIdea.title, recordingIdea.clips.length + 1);

      const clip: ClipVersion = {
        id: `clip-${Date.now()}`,
        title,
        notes: "",
        createdAt: Date.now(),
        isPrimary: recordingIdea.kind === "project" ? isPrimaryDraft : true,
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

  const fallbackClipTitle = () => buildDefaultIdeaTitle();

  const recordingPlaceholderTitle =
    recordingIdea
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

  async function stopRecordingMetronome() {
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
    await stopRecordingMetronome();
    await recording.cancelPreparedRecording();
  }

  async function cancelRecording() {
    if (!recordingIdea) return;
    if (isArmingRecording) {
      await cancelPendingRecordingStart();
    } else {
      await stopRecordingMetronome();
      await recording.discardRecording();
    }
    if (recordingIdea.kind === "clip" && recordingIdea.clips.length === 0) {
      updateIdeas((prevIdeas) => prevIdeas.filter((idea) => idea.id !== recordingIdea.id));
    }
    useStore.getState().setRecordingParentClipId(null);
    useStore.getState().setRecordingIdeaId(null);
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
    if (!recording.isRecording && !recording.isPaused) return;
    if (recording.isRecording && !recording.isPaused) {
      await recording.pauseRecording();
      await stopRecordingMetronome();
    }

    setQuickNamingIdeaId(recordingIdea.id);
    setQuickNameDraft("");
    setIsPrimaryDraft(false);
    setQuickNameModalVisible(true);
  }

  async function saveQuickClipName() {
    if (!quickNamingIdeaId) return;
    const targetIdea = recordingIdea;
    const isStandaloneClipRecording = targetIdea?.kind === "clip";

    const saved = await recording.saveRecording();
    if (!saved) return;
    await stopRecordingMetronome();

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
    useStore.getState().setRecordingParentClipId(null);
    useStore.getState().setRecordingIdeaId(null);
  }

  useEffect(() => {
    if (recordingSaveRequestToken === handledSaveRequestRef.current) return;
    handledSaveRequestRef.current = recordingSaveRequestToken;
    if (!recordingSaveRequestToken) return;
    void requestSaveRecording();
  }, [recordingSaveRequestToken]);

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
      const started = await recording.startPreparedRecording();
      setIsArmingRecording(false);
      if (!started) {
        await stopRecordingMetronome();
      }
    })();
  }, [metronome.countInCompletionToken, recording, stopRecordingMetronome]);

  useEffect(() => {
    if (recording.interruptionToken === 0) {
      return;
    }

    countInPendingRef.current = false;
    setIsArmingRecording(false);

    void (async () => {
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

    setSettingsVisible(false);

    if (!recordingMetronomeEnabled || !metronome.isNativeAvailable) {
      await recording.startRecording();
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
        await metronome.startCountIn(metronome.countInBars, { manageAudioSession: false });
        return;
      }

      await metronome.start({ manageAudioSession: false });
      const started = await recording.startPreparedRecording();
      if (!started) {
        await stopRecordingMetronome();
      }
    } catch (error) {
      console.warn("Recording metronome start failed", error);
      countInPendingRef.current = false;
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
    await stopRecordingMetronome();
  }

  async function handleResumeRecording() {
    await recording.resumeRecording();
    if (recordingMetronomeEnabled && metronome.isNativeAvailable) {
      try {
        await metronome.start({ manageAudioSession: false });
      } catch (error) {
        console.warn("Recording metronome resume failed", error);
      }
    }
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

  return {
    recordingIdea,
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
    minimizeRecording,
    requestSaveRecording,
    saveQuickClipName,
    handlePauseRecording,
    handleResumeRecording,
    handleStartRecording,
  };
}
