import { useMemo, useRef, useState } from "react";
import {
  useSharedAudioRecorder,
  ExpoAudioStreamModule,
  audioDeviceManager,
  type RecordingInterruptionEvent,
  type RecordingConfig,
  type SampleRate,
} from "@siteed/audio-studio";
import * as FileSystem from "expo-file-system/legacy";
import { Alert, Linking } from "react-native";
import { metersToWaveformPeaks } from "../utils";
import {
  activateRecordingAudioSession,
  createAudioSessionOwner,
  releaseAudioSessionOwner,
} from "../services/audioSession";
import { importRecordedAudioAsset, MANAGED_WAVEFORM_PEAK_COUNT } from "../services/audioStorage";
import {
  clearPendingRecordingSession,
  persistPendingRecordingSession,
} from "../services/recordingRecovery";
import { useRecordingDisplayElapsed } from "./useRecordingDisplayElapsed";
import { useLiveRecordingWaveform } from "./useLiveRecordingWaveform";
import { useStore } from "../state/useStore";

type OnRecorded = (
  payload: { audioUri: string; durationMs?: number; waveformPeaks?: number[] }
) => void | Promise<void>;

const LIVE_WAVEFORM_SEGMENT_MS = __DEV__ ? 60 : 40;
const LIVE_STREAM_INTERVAL_MS = __DEV__ ? 120 : 40;

function trimNotificationLabel(label: string | null | undefined, fallback: string) {
  const value = label?.trim();
  return value && value.length > 0 ? value : fallback;
}

export function useRecording(onRecorded: OnRecorded, preferredInputId: string | null) {
  const recorder = useSharedAudioRecorder();
  const audioSessionOwnerIdRef = useRef(createAudioSessionOwner("recording"));
  const persistedSessionRef = useRef(false);
  const preparedRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const recordingIdeaId = useStore((s) => s.recordingIdeaId);
  const recordingParentClipId = useStore((s) => s.recordingParentClipId);
  const recordingOverdubClipId = useStore((s) => s.recordingOverdubClipId);
  const setPreferredRecordingInputId = useStore((s) => s.setPreferredRecordingInputId);
  const displayElapsedMs = useRecordingDisplayElapsed({
    durationMs: recorder.durationMs,
    isRecording: recorder.isRecording,
    isPaused: recorder.isPaused,
  });
  const { waveform: liveWaveformData, appendAudioStream, reset: resetLiveWaveform } =
    useLiveRecordingWaveform({
      channels: 1,
      sampleRate: 44100,
      segmentDurationMs: LIVE_WAVEFORM_SEGMENT_MS,
    });
  const recordingIdea = useMemo(
    () =>
      workspaces
        .find((workspace) => workspace.id === activeWorkspaceId)
        ?.ideas.find((idea) => idea.id === recordingIdeaId) ?? null,
    [activeWorkspaceId, recordingIdeaId, workspaces]
  );
  const recordingParentClip = useMemo(
    () =>
      recordingParentClipId && recordingIdea
        ? recordingIdea.clips.find((clip) => clip.id === recordingParentClipId) ?? null
        : null,
    [recordingIdea, recordingParentClipId]
  );
  const recordingOverdubClip = useMemo(
    () =>
      recordingOverdubClipId && recordingIdea
        ? recordingIdea.clips.find((clip) => clip.id === recordingOverdubClipId) ?? null
        : null,
    [recordingIdea, recordingOverdubClipId]
  );
  const recordingNotification = useMemo(() => {
    const targetTitle = trimNotificationLabel(recordingIdea?.title, "Song Seed");

    if (!recordingIdea) {
      return {
        title: "Recording in progress",
        text: "Song Seed is recording in the background.",
      };
    }

    if (recordingIdea.kind === "project") {
      if (recordingOverdubClip) {
        return {
          title: "Recording overdub",
          text: `Recording into ${trimNotificationLabel(recordingOverdubClip.title, targetTitle)}.`,
        };
      }

      if (recordingParentClip) {
        return {
          title: `Recording variation`,
          text: `Recording into ${targetTitle} from ${trimNotificationLabel(
            recordingParentClip.title,
            "current take"
          )}.`,
        };
      }

      return {
        title: `Recording take`,
        text: `Recording into ${targetTitle}.`,
      };
    }

    return {
      title: "Recording clip",
      text: `Recording ${targetTitle}.`,
    };
  }, [recordingIdea, recordingOverdubClip, recordingParentClip]);
  const [lastInterruptionReason, setLastInterruptionReason] =
    useState<RecordingInterruptionEvent["reason"] | null>(null);
  const [interruptionToken, setInterruptionToken] = useState(0);

  async function claimRecordingAudioSession() {
    await activateRecordingAudioSession({ ownerId: audioSessionOwnerIdRef.current });
  }

  async function releaseRecordingAudioSession() {
    await releaseAudioSessionOwner(audioSessionOwnerIdRef.current);
  }

  async function applyPreferredInput() {
    if (preferredInputId) {
      try {
        const selectionResult = await audioDeviceManager.selectDevice(preferredInputId);
        if (selectionResult !== false) {
          return;
        }
      } catch (selectionError) {
        console.warn("Preferred input selection failed", selectionError);
      }

      try {
        await audioDeviceManager.resetToDefaultDevice();
      } catch (resetError) {
        console.warn("Recording input reset after stale preference failed", resetError);
      }
      setPreferredRecordingInputId(null);
      return;
    }

    try {
      await audioDeviceManager.resetToDefaultDevice();
    } catch (resetError) {
      console.warn("Recording input reset failed", resetError);
    }
  }

  async function requestMicrophonePermission() {
    const permission = await ExpoAudioStreamModule.requestPermissionsAsync();
    const granted = permission?.granted ?? permission?.status === "granted";

    if (granted) {
      return true;
    }

    Alert.alert(
      "Microphone access needed",
      permission?.canAskAgain === false
        ? "Song Seed does not currently have microphone access. Enable it in system settings to record."
        : "Song Seed needs microphone access to start recording.",
      permission?.canAskAgain === false
        ? [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        : [{ text: "OK", style: "default" }]
    );

    return false;
  }

  function buildRecordingConfig(): RecordingConfig {
    return {
      sampleRate: 44100 as SampleRate,
      channels: 1 as const,
      interval: LIVE_STREAM_INTERVAL_MS,
      intervalAnalysis: __DEV__ ? 150 : 75,
      segmentDurationMs: __DEV__ ? 150 : 75,
      streamFormat: "float32" as const,
      enableProcessing: true,
      features: { energy: true, rms: true },
      autoResumeAfterInterruption: true,
      bufferDurationSeconds: __DEV__ ? 0.25 : 0.15,
      keepAwake: true,
      showNotification: true,
      showWaveformInNotification: true,
      notification: {
        title: recordingNotification.title,
        text: recordingNotification.text,
        android: {
          channelId: "songseed-recording",
          channelName: "Recording",
          channelDescription: "Background recording status and controls",
          notificationId: 4101,
          priority: "high" as const,
          accentColor: "#d81f28",
          showPauseResumeActions: true,
          waveform: {
            color: "#d81f28",
            opacity: 0.9,
            strokeWidth: 1.5,
            style: "stroke" as const,
            mirror: true,
            height: 44,
          },
        },
        ios: {
          categoryIdentifier: "songseed-recording",
        },
      },
      android: {
        audioFocusStrategy: "background" as const,
      },
      ios: {
        audioSession: {
          category: "PlayAndRecord" as const,
          mode: "Measurement" as const,
          categoryOptions: ["MixWithOthers", "AllowBluetooth", "AllowBluetoothA2DP", "DefaultToSpeaker"] as const,
        },
      },
      onAudioStream: async (event: any) => {
        appendAudioStream(event);
        if (!event.fileUri || persistedSessionRef.current) return;
        persistedSessionRef.current = true;
        const recordingStartedAt = recordingStartedAtRef.current ?? Date.now();
        void persistPendingRecordingSession(event.fileUri, recordingStartedAt);
      },
      onRecordingInterrupted: (event) => {
        preparedRecordingRef.current = false;
        setLastInterruptionReason(event.reason);
        setInterruptionToken((current) => current + 1);
        void releaseAudioSessionOwner(audioSessionOwnerIdRef.current).catch((error) => {
          console.warn("Recording audio session release after interruption failed", error);
        });
      },
      onAudioAnalysis: async () => {},
    };
  }

  async function prepareRecording() {
    if (recorder.isRecording || recorder.isPaused) return false;
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        return false;
      }

      await applyPreferredInput();

      await claimRecordingAudioSession();
      persistedSessionRef.current = false;
      recordingStartedAtRef.current = null;
      resetLiveWaveform();
      await recorder.prepareRecording(buildRecordingConfig());
      preparedRecordingRef.current = true;
      return true;
    } catch (err) {
      await releaseRecordingAudioSession().catch((error) => {
        console.warn("Recording audio session release after prepare failure failed", error);
      });
      console.warn("Recording prepare failed", err);
      Alert.alert("Recording failed", "Could not prepare recording.");
      return false;
    }
  }


  async function startRecording() {
    if (recorder.isRecording) return;
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        return;
      }

      try {
        if (recorder.isRecording || recorder.isPaused) {
          await recorder.stopRecording();
          await new Promise(r => setTimeout(r, 150));
        }
      } catch {}

      await applyPreferredInput();

      await claimRecordingAudioSession();
      persistedSessionRef.current = false;
      preparedRecordingRef.current = false;
      recordingStartedAtRef.current = null;
      resetLiveWaveform();

      const recordingStartedAt = Date.now();
      recordingStartedAtRef.current = recordingStartedAt;
      const startResult = await recorder.startRecording(buildRecordingConfig());
      if (startResult?.fileUri) {
        persistedSessionRef.current = true;
        await persistPendingRecordingSession(startResult.fileUri, recordingStartedAt);
      }
    } catch (err) {
      await releaseRecordingAudioSession().catch((error) => {
        console.warn("Recording audio session release after start failure failed", error);
      });
      console.warn("Recording start failed", err);
      Alert.alert("Recording failed", "Could not start recording.");
    }
  }

  async function startPreparedRecording() {
    if (recorder.isRecording || recorder.isPaused) return false;
    try {
      if (!preparedRecordingRef.current) {
        const prepared = await prepareRecording();
        if (!prepared) {
          return false;
        }
      }

      const recordingStartedAt = Date.now();
      recordingStartedAtRef.current = recordingStartedAt;
      const startResult = await recorder.startRecording(buildRecordingConfig());
      preparedRecordingRef.current = false;
      if (startResult?.fileUri) {
        persistedSessionRef.current = true;
        await persistPendingRecordingSession(startResult.fileUri, recordingStartedAt);
      }
      return true;
    } catch (err) {
      preparedRecordingRef.current = false;
      await releaseRecordingAudioSession().catch((error) => {
        console.warn("Recording audio session release after prepared start failure failed", error);
      });
      console.warn("Prepared recording start failed", err);
      Alert.alert("Recording failed", "Could not start recording.");
      return false;
    }
  }

  async function cancelPreparedRecording() {
    preparedRecordingRef.current = false;
    recordingStartedAtRef.current = null;
    persistedSessionRef.current = false;
    resetLiveWaveform();
    try {
      await recorder.stopRecording();
    } catch {
      // Ignore cleanup failures when a prepared recorder is canceled before capture begins.
    }
    await clearPendingRecordingSession();
    await releaseRecordingAudioSession().catch((error) => {
      console.warn("Recording audio session release after prepare cancel failed", error);
    });
  }

  async function pauseRecording() {
    if (!recorder.isRecording || recorder.isPaused) return;
    try {
      await recorder.pauseRecording();
    } catch {
      Alert.alert("Pause failed", "Could not pause recording.");
    }
  }

  async function resumeRecording() {
    if (!recorder.isPaused) return;
    try {
      // Apply any input change the user made while paused.
      await applyPreferredInput();
      await claimRecordingAudioSession();
      await recorder.resumeRecording();
    } catch {
      Alert.alert("Resume failed", "Could not continue recording.");
    }
  }

  async function saveRecording() {
    try {
      const recordingData = await recorder.stopRecording();
      preparedRecordingRef.current = false;
      recordingStartedAtRef.current = null;
      resetLiveWaveform();
      if (!recordingData || !recordingData.fileUri) {
        Alert.alert("Recording failed", "No audio file was generated.");
        return false;
      }

      const clipId = `clip-${Date.now()}`;
      const managedAudio = await importRecordedAudioAsset(recordingData.fileUri, clipId);

      // Convert peaks for existing basic renderers (while we migrate the rest)
      const dataPoints = recordingData.analysisData?.dataPoints ?? [];
      const levelsAsDb = dataPoints.map((p) =>
        Number.isFinite(p.dB) ? p.dB : p.amplitude > 0 ? 20 * Math.log10(p.amplitude) : -60
      );
      const waveformPeaks =
        managedAudio.waveformPeaks ??
        metersToWaveformPeaks(levelsAsDb, MANAGED_WAVEFORM_PEAK_COUNT);

      await onRecorded({
        audioUri: managedAudio.audioUri,
        durationMs: managedAudio.durationMs ?? recordingData.durationMs,
        waveformPeaks,
      });
      if (recordingData.fileUri && recordingData.fileUri !== managedAudio.audioUri) {
        // The managed import succeeded, so the recorder temp output is now redundant and should
        // be removed instead of silently accumulating across saves.
        await FileSystem.deleteAsync(recordingData.fileUri, { idempotent: true }).catch(() => {});
      }
      await clearPendingRecordingSession();
      return true;
    } catch {
      Alert.alert("Recording failed", "Could not save recording.");
      return false;
    } finally {
      await releaseRecordingAudioSession().catch((error) => {
        console.warn("Recording audio session release after save failed", error);
      });
    }
  }

  async function discardRecording() {
    try {
      const recordingData = await recorder.stopRecording();
      preparedRecordingRef.current = false;
      recordingStartedAtRef.current = null;
      resetLiveWaveform();
      if (recordingData?.fileUri) {
        // Discard should clean up the recorder output because the app never imports it into
        // managed storage or stores metadata for later recovery.
        await FileSystem.deleteAsync(recordingData.fileUri, { idempotent: true }).catch(() => {});
      }
      await clearPendingRecordingSession();
    } catch {
      // ignore
    } finally {
      await releaseRecordingAudioSession().catch((error) => {
        console.warn("Recording audio session release after discard failed", error);
      });
    }
  }

  return {
    isRecording: recorder.isRecording,
    isPaused: recorder.isPaused,
    elapsedMs: displayElapsedMs,
    analysisData: recorder.analysisData,
    liveWaveformData,
    lastInterruptionReason,
    interruptionToken,
    prepareRecording,
    startRecording,
    startPreparedRecording,
    cancelPreparedRecording,
    pauseRecording,
    resumeRecording,
    saveRecording,
    discardRecording,
  };
}
