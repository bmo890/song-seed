import { useAudioRecorder, ExpoAudioStreamModule, audioDeviceManager } from "@siteed/expo-audio-studio";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { metersToWaveformPeaks } from "../utils";
import { activateRecordingAudioSession } from "../services/audioSession";
type OnRecorded = (payload: { audioUri: string; durationMs?: number; waveformPeaks?: number[] }) => void;

export function useRecording(onRecorded: OnRecorded, preferredInputId: string | null) {
  const recorder = useAudioRecorder();
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);

  useEffect(() => {
    // Dedicated Cleanup hook if unmounted mid-recording to prevent Native Bridge panics
    return () => {
      if (isRecordingRef.current || isPausedRef.current) {
        recorder.stopRecording().catch(() => { });
      }
    };
  }, []);

  useEffect(() => {
    isRecordingRef.current = recorder.isRecording;
    isPausedRef.current = recorder.isPaused;
  }, [recorder.isPaused, recorder.isRecording]);


  async function startRecording() {
    if (recorder.isRecording) return;
    try {
      // Force microphone permission check before spinning up the audio stream.
      // A missing permission prompt is a well-known cause of the iOS Simulator "Abandoning I/O cycle" CoreAudio crash.
      await ExpoAudioStreamModule.requestPermissionsAsync();

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

      await recorder.startRecording({
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
        onRecordingInterrupted: () => {},
        onAudioAnalysis: async () => {}
      });
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

      // Convert peaks for existing basic renderers (while we migrate the rest)
      const dataPoints = recordingData.analysisData?.dataPoints ?? [];
      const levelsAsDb = dataPoints.map((p) =>
        Number.isFinite(p.dB) ? p.dB : p.amplitude > 0 ? 20 * Math.log10(p.amplitude) : -60
      );
      const waveformPeaks = metersToWaveformPeaks(levelsAsDb, 96);

      onRecorded({
        audioUri: recordingData.fileUri,
        durationMs: recordingData.durationMs,
        waveformPeaks,
      });
      return true;
    } catch {
      Alert.alert("Recording failed", "Could not save recording.");
      return false;
    }
  }

  async function discardRecording() {
    try {
      await recorder.stopRecording();
    } catch {
      // ignore
    }
  }

  return {
    isRecording: recorder.isRecording,
    isPaused: recorder.isPaused,
    elapsedMs: recorder.durationMs,
    analysisData: recorder.analysisData,
    startRecording,
    pauseRecording,
    resumeRecording,
    saveRecording,
    discardRecording,
  };
}
