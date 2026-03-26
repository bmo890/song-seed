import { useSharedAudioRecorder, ExpoAudioStreamModule, audioDeviceManager } from "@siteed/audio-studio";
import * as FileSystem from "expo-file-system/legacy";
import { Alert, Linking } from "react-native";
import { metersToWaveformPeaks } from "../utils";
import { activateRecordingAudioSession } from "../services/audioSession";
import { importRecordedAudioAsset } from "../services/audioStorage";
import {
  clearPendingRecordingSession,
  persistPendingRecordingSession,
} from "../services/recordingRecovery";
import { useRecordingDisplayElapsed } from "./useRecordingDisplayElapsed";
type OnRecorded = (payload: { audioUri: string; durationMs?: number; waveformPeaks?: number[] }) => void;

export function useRecording(onRecorded: OnRecorded, preferredInputId: string | null) {
  const recorder = useSharedAudioRecorder();
  const displayElapsedMs = useRecordingDisplayElapsed({
    durationMs: recorder.durationMs,
    isRecording: recorder.isRecording,
    isPaused: recorder.isPaused,
  });

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

      if (preferredInputId) {
        try {
          await audioDeviceManager.selectDevice(preferredInputId);
        } catch (selectionError) {
          console.warn("Preferred input selection failed", selectionError);
        }
      } else {
        try {
          await audioDeviceManager.resetToDefaultDevice();
        } catch (resetError) {
          console.warn("Recording input reset failed", resetError);
        }
      }

      await activateRecordingAudioSession();

      const recordingStartedAt = Date.now();
      const startResult = await recorder.startRecording({
        sampleRate: 44100,    // Standard CD-quality sample rate
        channels: 1,          // Mono is standard for voice memos and guarantees clear single-source audio
        // In dev (emulator), run the visualizer at 10fps to prevent audio crackle. 
        // In production (real phone), run it at 20fps for smoother visuals.
        intervalAnalysis: __DEV__ ? 150 : 75,
        segmentDurationMs: __DEV__ ? 150 : 75,
        enableProcessing: true,
        features: { energy: true, rms: true },
        autoResumeAfterInterruption: true,
        bufferDurationSeconds: __DEV__ ? 0.25 : 0.15,
        keepAwake: true,
        android: {
          audioFocusStrategy: "background",
        },
        ios: {
          audioSession: {
            category: "PlayAndRecord",
            mode: "Measurement",
            categoryOptions: ["MixWithOthers", "AllowBluetooth", "AllowBluetoothA2DP", "DefaultToSpeaker"]
          }
        },
        onAudioStream: async ({ fileUri }) => {
          if (!fileUri) return;
          await persistPendingRecordingSession(fileUri, recordingStartedAt);
        },
        onRecordingInterrupted: () => {},
        onAudioAnalysis: async () => {}
      });
      if (startResult?.fileUri) {
        await persistPendingRecordingSession(startResult.fileUri, recordingStartedAt);
      }
    } catch (err) {
      console.warn("Recording start failed", err);
      Alert.alert("Recording failed", "Could not start recording.");
    }
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
      if (preferredInputId) {
        try {
          await audioDeviceManager.selectDevice(preferredInputId);
        } catch (selectionError) {
          console.warn("Input switch before resume failed", selectionError);
        }
      } else {
        try {
          await audioDeviceManager.resetToDefaultDevice();
        } catch (resetError) {
          console.warn("Input reset before resume failed", resetError);
        }
      }
      await recorder.resumeRecording();
    } catch {
      Alert.alert("Resume failed", "Could not continue recording.");
    }
  }

  async function saveRecording() {
    try {
      const recordingData = await recorder.stopRecording();
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
        metersToWaveformPeaks(levelsAsDb, 96);

      onRecorded({
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
    }
  }

  async function discardRecording() {
    try {
      const recordingData = await recorder.stopRecording();
      if (recordingData?.fileUri) {
        // Discard should clean up the recorder output because the app never imports it into
        // managed storage or stores metadata for later recovery.
        await FileSystem.deleteAsync(recordingData.fileUri, { idempotent: true }).catch(() => {});
      }
      await clearPendingRecordingSession();
    } catch {
      // ignore
    }
  }

  return {
    isRecording: recorder.isRecording,
    isPaused: recorder.isPaused,
    elapsedMs: displayElapsedMs,
    analysisData: recorder.analysisData,
    startRecording,
    pauseRecording,
    resumeRecording,
    saveRecording,
    discardRecording,
  };
}
