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
import { Linking, Platform } from "react-native";
import { AppAlert } from "../components/common/AppAlert";
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
import { deleteManagedAudioUris } from "../services/managedMedia";

type OnRecorded = (
  payload: { audioUri: string; durationMs?: number; waveformPeaks?: number[] }
) => void | boolean | Promise<void | boolean>;

const LIVE_WAVEFORM_SEGMENT_MS = __DEV__ ? 60 : 40;
const LIVE_STREAM_INTERVAL_MS = __DEV__ ? 120 : 40;

function trimNotificationLabel(label: string | null | undefined, fallback: string) {
  const value = label?.trim();
  return value && value.length > 0 ? value : fallback;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isNotificationPermissionError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("notification permission") || message.includes("post_notifications");
}

export function useRecording(onRecorded: OnRecorded, preferredInputId: string | null) {
  const recorder = useSharedAudioRecorder();
  const audioSessionOwnerIdRef = useRef(createAudioSessionOwner("recording"));
  const persistedSessionRef = useRef(false);
  const preparedRecordingRef = useRef(false);
  const expectedStopReasonRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const permissionRequestRef = useRef<Promise<boolean> | null>(null);
  const prepareInFlightRef = useRef(false);
  const startInFlightRef = useRef(false);
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

    if (permission?.canAskAgain === false) {
      AppAlert.custom(
        "Microphone access needed",
        "Song Seed does not currently have microphone access. Enable it in system settings to record.",
        [
          { label: "Cancel", style: "cancel" },
          {
            label: "Open Settings",
            style: "default",
            icon: "settings-outline",
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ]
      );
    } else {
      AppAlert.info("Microphone access needed", "Song Seed needs microphone access to start recording.");
    }

    return false;
  }

  function showNotificationPermissionAlert(blocked: boolean) {
    const message = blocked
      ? "Song Seed cannot show the required active-recording notification. Enable notifications in system settings to record."
      : "Android requires Song Seed to show an active notification while recording. Allow notifications to start recording.";

    if (!blocked) {
      AppAlert.info("Notification access needed", message);
      return;
    }

    AppAlert.custom("Notification access needed", message, [
      { label: "Cancel", style: "cancel" },
      {
        label: "Open Settings",
        style: "default",
        icon: "settings-outline",
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ]);
  }

  async function requestRecordingNotificationPermission() {
    if (Platform.OS !== "android") {
      return true;
    }

    const currentPermission = await ExpoAudioStreamModule.getNotificationPermissionsAsync();
    const alreadyGranted =
      currentPermission?.granted ?? currentPermission?.status === "granted";
    if (alreadyGranted) {
      return true;
    }

    const permission = await ExpoAudioStreamModule.requestNotificationPermissionsAsync();
    const granted = permission?.granted ?? permission?.status === "granted";
    if (granted) {
      return true;
    }

    showNotificationPermissionAlert(permission?.canAskAgain === false);
    return false;
  }

  async function requestRecordingPermissions() {
    if (permissionRequestRef.current) {
      return permissionRequestRef.current;
    }

    const request = (async () => {
      if (!(await requestMicrophonePermission())) {
        return false;
      }
      return requestRecordingNotificationPermission();
    })();
    permissionRequestRef.current = request;

    try {
      return await request;
    } finally {
      if (permissionRequestRef.current === request) {
        permissionRequestRef.current = null;
      }
    }
  }

  function showRecordingFailure(error: unknown, fallback: string) {
    if (isNotificationPermissionError(error)) {
      showNotificationPermissionAlert(true);
      return;
    }
    AppAlert.info("Recording failed", fallback);
  }

  async function rollbackFailedRecordingStart(
    nativeStartAttempted: boolean,
    audioSessionClaimed: boolean
  ) {
    preparedRecordingRef.current = false;
    recordingStartedAtRef.current = null;
    persistedSessionRef.current = false;

    if (nativeStartAttempted || recorder.isRecording || recorder.isPaused) {
      try {
        expectedStopReasonRef.current = true;
        await recorder.stopRecording();
      } catch (stopError) {
        expectedStopReasonRef.current = false;
        console.warn("Recording rollback stop failed", stopError);
      }
    }

    if (nativeStartAttempted) {
      await clearPendingRecordingSession().catch((error) => {
        console.warn("Recording rollback recovery cleanup failed", error);
      });
    }
    if (audioSessionClaimed) {
      await releaseRecordingAudioSession().catch((error) => {
        console.warn("Recording audio session release after start failure failed", error);
      });
    }
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
        const isExpectedStoppedEvent =
          event.reason === "recordingStopped" && expectedStopReasonRef.current;
        expectedStopReasonRef.current = false;
        if (isExpectedStoppedEvent) {
          return;
        }
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
    if (recorder.isRecording || recorder.isPaused || prepareInFlightRef.current) return false;
    prepareInFlightRef.current = true;
    try {
      const hasPermission = await requestRecordingPermissions();
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
      showRecordingFailure(err, "Could not prepare recording.");
      return false;
    } finally {
      prepareInFlightRef.current = false;
    }
  }


  async function startRecording() {
    if (recorder.isRecording || recorder.isPaused || startInFlightRef.current) return false;
    startInFlightRef.current = true;
    let nativeStartAttempted = false;
    let audioSessionClaimed = false;
    try {
      const hasPermission = await requestRecordingPermissions();
      if (!hasPermission) {
        return false;
      }

      try {
        if (recorder.isRecording || recorder.isPaused) {
          expectedStopReasonRef.current = true;
          await recorder.stopRecording();
          await new Promise(r => setTimeout(r, 150));
        }
      } catch {}

      await applyPreferredInput();

      await claimRecordingAudioSession();
      audioSessionClaimed = true;
      persistedSessionRef.current = false;
      preparedRecordingRef.current = false;
      recordingStartedAtRef.current = null;
      resetLiveWaveform();

      const recordingStartedAt = Date.now();
      recordingStartedAtRef.current = recordingStartedAt;
      nativeStartAttempted = true;
      const startResult = await recorder.startRecording(buildRecordingConfig());
      if (startResult?.fileUri) {
        persistedSessionRef.current = true;
        await persistPendingRecordingSession(startResult.fileUri, recordingStartedAt);
      }
      return true;
    } catch (err) {
      await rollbackFailedRecordingStart(nativeStartAttempted, audioSessionClaimed);
      console.warn("Recording start failed", err);
      showRecordingFailure(err, "Could not start recording.");
      return false;
    } finally {
      startInFlightRef.current = false;
    }
  }

  async function startPreparedRecording() {
    if (recorder.isRecording || recorder.isPaused || startInFlightRef.current) return false;
    startInFlightRef.current = true;
    let nativeStartAttempted = false;
    let audioSessionClaimed = preparedRecordingRef.current;
    try {
      if (!(await requestRecordingPermissions())) {
        return false;
      }
      if (!preparedRecordingRef.current) {
        const prepared = await prepareRecording();
        if (!prepared) {
          return false;
        }
        audioSessionClaimed = true;
      }

      const recordingStartedAt = Date.now();
      recordingStartedAtRef.current = recordingStartedAt;
      nativeStartAttempted = true;
      const startResult = await recorder.startRecording(buildRecordingConfig());
      preparedRecordingRef.current = false;
      if (startResult?.fileUri) {
        persistedSessionRef.current = true;
        await persistPendingRecordingSession(startResult.fileUri, recordingStartedAt);
      }
      return true;
    } catch (err) {
      await rollbackFailedRecordingStart(nativeStartAttempted, audioSessionClaimed);
      console.warn("Prepared recording start failed", err);
      showRecordingFailure(err, "Could not start recording.");
      return false;
    } finally {
      startInFlightRef.current = false;
    }
  }

  async function cancelPreparedRecording() {
    preparedRecordingRef.current = false;
    recordingStartedAtRef.current = null;
    persistedSessionRef.current = false;
    resetLiveWaveform();
    try {
      expectedStopReasonRef.current = true;
      await recorder.stopRecording();
    } catch {
      expectedStopReasonRef.current = false;
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
      AppAlert.info("Pause failed", "Could not pause recording.");
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
      AppAlert.info("Resume failed", "Could not continue recording.");
    }
  }

  async function saveRecording() {
    let managedAudioUriToCleanup: string | null = null;
    let recorderTempUriToCleanup: string | null = null;
    try {
      expectedStopReasonRef.current = true;
      const recordingData = await recorder.stopRecording();
      preparedRecordingRef.current = false;
      recordingStartedAtRef.current = null;
      resetLiveWaveform();
      if (!recordingData || !recordingData.fileUri) {
        AppAlert.info("Recording failed", "No audio file was generated.");
        return false;
      }

      const clipId = `clip-${Date.now()}`;
      const managedAudio = await importRecordedAudioAsset(recordingData.fileUri, clipId);
      managedAudioUriToCleanup = managedAudio.audioUri;
      recorderTempUriToCleanup = recordingData.fileUri;

      // Convert peaks for existing basic renderers (while we migrate the rest)
      const dataPoints = recordingData.analysisData?.dataPoints ?? [];
      const levelsAsDb = dataPoints.map((p) =>
        Number.isFinite(p.dB) ? p.dB : p.amplitude > 0 ? 20 * Math.log10(p.amplitude) : -60
      );
      const waveformPeaks =
        managedAudio.waveformPeaks ??
        metersToWaveformPeaks(levelsAsDb, MANAGED_WAVEFORM_PEAK_COUNT);

      const attached = await onRecorded({
        audioUri: managedAudio.audioUri,
        durationMs: managedAudio.durationMs ?? recordingData.durationMs,
        waveformPeaks,
      });

      if (attached === false) {
        // The take could not be attached (e.g. its project was removed mid-recording).
        // Preserve the recording rather than silently orphaning it: keep the recorder temp
        // file AND the pending-session marker so the next launch salvages it into the Inbox.
        // Drop only the redundant managed copy.
        if (managedAudioUriToCleanup) {
          await deleteManagedAudioUris([managedAudioUriToCleanup]).catch(() => {});
          managedAudioUriToCleanup = null;
        }
        AppAlert.info(
          "Recording kept for recovery",
          "We couldn't attach this take to its project, so it's been saved safely. Reopen Song Seed to restore it."
        );
        return false;
      }

      managedAudioUriToCleanup = null;
      if (recordingData.fileUri && recordingData.fileUri !== managedAudio.audioUri) {
        // The managed import succeeded, so the recorder temp output is now redundant and should
        // be removed instead of silently accumulating across saves.
        await FileSystem.deleteAsync(recordingData.fileUri, { idempotent: true }).catch(() => {});
        recorderTempUriToCleanup = null;
      }
      await clearPendingRecordingSession();
      return true;
    } catch {
      expectedStopReasonRef.current = false;
      if (managedAudioUriToCleanup) {
        await deleteManagedAudioUris([managedAudioUriToCleanup]).catch(() => {});
      }
      if (recorderTempUriToCleanup) {
        await FileSystem.deleteAsync(recorderTempUriToCleanup, { idempotent: true }).catch(() => {});
      }
      AppAlert.info("Recording failed", "Could not save recording.");
      return false;
    } finally {
      await releaseRecordingAudioSession().catch((error) => {
        console.warn("Recording audio session release after save failed", error);
      });
    }
  }

  async function discardRecording() {
    try {
      expectedStopReasonRef.current = true;
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
      expectedStopReasonRef.current = false;
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
