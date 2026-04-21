import { useNavigation } from "@react-navigation/native";
import { useAudioPlayer } from "expo-audio";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { audioDeviceManager, type AudioDevice } from "@siteed/audio-studio";
import { PageIntro } from "../common/PageIntro";
import { ScreenHeader } from "../common/ScreenHeader";
import { styles as globalStyles } from "../../styles";
import { useStore } from "../../state/useStore";
import { ensureCalibrationClickTrackFile } from "../../services/metronomeLoop";
import SongseedMetronomeModule from "../../../modules/songseed-metronome";
import {
  MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS,
  MAX_BLUETOOTH_MONITORING_MANUAL_OFFSET_MS,
  buildBluetoothMonitoringRouteKey,
  buildBluetoothMonitoringRouteLabel,
  isBluetoothLikeAudioDevice,
  normalizeBluetoothMonitoringOffsetMs,
  normalizeBluetoothMonitoringSavedOffsetMs,
} from "../../bluetoothMonitoring";

const CALIBRATION_BPM = 90;
const CALIBRATION_BEAT_INTERVAL_MS = Math.round(60000 / CALIBRATION_BPM);
const CALIBRATION_BEAT_COUNT = 12;
const AUDIO_MIN_VALID_BEAT_TAPS = 7;
const IGNORED_LEAD_IN_BEATS = 2;
const AUDIO_TAP_OUTLIER_WINDOW_MS = MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS;
const AUDIO_MAX_ALLOWED_MAD_MS = 130;
const START_DELAY_MS = 1500;
const COUNTDOWN_STEP_MS = 500;
const TAP_DEDUPE_WINDOW_MS = 120;
const OFFSET_TWEAK_SMALL_MS = 10;
const OFFSET_TWEAK_LARGE_MS = 25;

type CalibrationPhase = "idle" | "bluetooth-running" | "result";

type RouteInfo = Pick<AudioDevice, "name" | "type">;

type PhaseAnalysis = {
  medianMs: number;
  madMs: number;
  tapCount: number;
};

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function medianAbsoluteDeviation(values: number[], center: number) {
  return median(values.map((value) => Math.abs(value - center)));
}

function analyzeAudioPhaseTaps(taps: number[], totalBeats: number): PhaseAnalysis | null {
  const sortedTaps = [...taps].sort((a, b) => a - b);
  const dedupedTaps: number[] = [];
  sortedTaps.forEach((tapTime) => {
    const previousTap = dedupedTaps[dedupedTaps.length - 1];
    if (previousTap != null && tapTime - previousTap < TAP_DEDUPE_WINDOW_MS) {
      return;
    }
    dedupedTaps.push(tapTime);
  });

  const residualByBeat = new Map<number, number>();

  dedupedTaps.forEach((tapTime) => {
    const beatIndex = Math.floor(tapTime / CALIBRATION_BEAT_INTERVAL_MS);
    if (beatIndex < 0 || beatIndex >= totalBeats || beatIndex < IGNORED_LEAD_IN_BEATS) {
      return;
    }

    const expectedTime = beatIndex * CALIBRATION_BEAT_INTERVAL_MS;
    const residual = tapTime - expectedTime;
    if (Math.abs(residual) > AUDIO_TAP_OUTLIER_WINDOW_MS) {
      return;
    }

    const existing = residualByBeat.get(beatIndex);
    if (existing == null || Math.abs(residual) < Math.abs(existing)) {
      residualByBeat.set(beatIndex, residual);
    }
  });

  const residuals = Array.from(residualByBeat.values());
  if (residuals.length < AUDIO_MIN_VALID_BEAT_TAPS) {
    return null;
  }

  const center = median(residuals);
  const mad = medianAbsoluteDeviation(residuals, center);
  if (mad > AUDIO_MAX_ALLOWED_MAD_MS) {
    return null;
  }

  return {
    medianMs: center,
    madMs: mad,
    tapCount: residuals.length,
  };
}

export function BluetoothCalibrationScreen() {
  const navigation = useNavigation();
  const calibrations = useStore((state) => state.bluetoothMonitoringCalibrations);
  const setCalibration = useStore((state) => state.setBluetoothMonitoringCalibration);
  const removeCalibration = useStore((state) => state.removeBluetoothMonitoringCalibration);

  const [currentDevice, setCurrentDevice] = useState<AudioDevice | null>(null);
  const [currentOutputRoute, setCurrentOutputRoute] = useState<RouteInfo | null>(null);
  const [phase, setPhase] = useState<CalibrationPhase>("idle");
  const [phaseElapsedMs, setPhaseElapsedMs] = useState(0);
  const [estimatedOffsetMs, setEstimatedOffsetMs] = useState<number | null>(null);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [lastAnalysisSummary, setLastAnalysisSummary] = useState<string | null>(null);
  const [audioLoopUri, setAudioLoopUri] = useState<string | null>(null);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [bluetoothTargetRoute, setBluetoothTargetRoute] = useState<{ routeKey: string; routeLabel: string } | null>(
    null
  );

  const timersRef = useRef<number[]>([]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseStartAtRef = useRef<number | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  const audioPlayer = useAudioPlayer(audioLoopUri ? { uri: audioLoopUri } : null, { updateInterval: 250 });

  const activeRoute = currentOutputRoute ?? currentDevice;
  const activeRouteKey = useMemo(() => buildBluetoothMonitoringRouteKey(activeRoute), [activeRoute]);
  const activeRouteLabel = useMemo(() => buildBluetoothMonitoringRouteLabel(activeRoute), [activeRoute]);
  const isBluetoothRoute = useMemo(() => isBluetoothLikeAudioDevice(activeRoute), [activeRoute]);
  const editableRouteKey = bluetoothTargetRoute?.routeKey ?? (isBluetoothRoute ? activeRouteKey : null);
  const editableRouteLabel = bluetoothTargetRoute?.routeLabel ?? (isBluetoothRoute ? activeRouteLabel : null);

  useEffect(() => {
    let cancelled = false;

    async function refreshCurrentDevice() {
      try {
        const device = await audioDeviceManager.getCurrentDevice();
        const outputRoute = await SongseedMetronomeModule?.getCurrentAudioOutputRoute?.();
        if (!cancelled) {
          setCurrentDevice(device ?? null);
          setCurrentOutputRoute(outputRoute ?? null);
        }
      } catch {
        if (!cancelled) {
          setCurrentDevice(null);
          setCurrentOutputRoute(null);
        }
      }
    }

    void refreshCurrentDevice();
    const removeListener = audioDeviceManager.addDeviceChangeListener(() => {
      void refreshCurrentDevice();
    });

    return () => {
      cancelled = true;
      removeListener();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsPreparingAudio(true);
    void ensureCalibrationClickTrackFile(CALIBRATION_BPM, CALIBRATION_BEAT_COUNT)
      .then((loop) => {
        if (!cancelled) {
          setAudioLoopUri(loop.uri);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAudioLoopUri(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreparingAudio(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      try {
        audioPlayer.pause();
      } catch {
        // ignore cleanup noise
      }
    };
  }, [audioPlayer]);

  function clearPhaseTimers() {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }

  function resetRunState(nextPhase: CalibrationPhase = "idle") {
    clearPhaseTimers();
    tapTimesRef.current = [];
    phaseStartAtRef.current = null;
    setPhase(nextPhase);
    setPhaseElapsedMs(0);
    setCountdownValue(null);
  }

  async function stopAudioPlayback() {
    try {
      audioPlayer.pause();
      await audioPlayer.seekTo(0);
    } catch {
      // ignore player cleanup failures
    }
  }

  async function startAudioPlayback() {
    if (!audioLoopUri) {
      return;
    }
    try {
      await audioPlayer.seekTo(0);
      audioPlayer.play();
    } catch {
      // Ignore calibration playback failures; analysis will likely fail and prompt retry.
    }
  }

  function setPhaseFailure(tappedBeatCount: number) {
    setLastAnalysisSummary(`Bluetooth phase captured ${tappedBeatCount} usable beats.`);
    setPhaseError(
      "Bluetooth phase was too inconsistent. Keep a steady pulse and try again."
    );
    resetRunState("idle");
  }

  function completePhase() {
    const analysis = analyzeAudioPhaseTaps(tapTimesRef.current, CALIBRATION_BEAT_COUNT);
    if (!analysis) {
      const analyzedTapCount = Math.max(
        0,
        [...new Set(tapTimesRef.current.map((tap) => Math.round(tap / CALIBRATION_BEAT_INTERVAL_MS)))].length -
          IGNORED_LEAD_IN_BEATS
      );
      setPhaseFailure(analyzedTapCount);
      return;
    }

    setLastAnalysisSummary(
      `Bluetooth phase: ${analysis.tapCount} valid beats, spread ${Math.round(analysis.madMs)} ms.`
    );
    setPhaseError(null);
    setEstimatedOffsetMs(normalizeBluetoothMonitoringOffsetMs(analysis.medianMs));
    resetRunState("result");
  }

  function schedulePhase() {
    if (isPreparingAudio) {
      return;
    }
    if (!isBluetoothRoute || !activeRouteKey) {
      setPhaseError("Switch audio output to the Bluetooth headphones you want to calibrate before starting.");
      return;
    }
    setBluetoothTargetRoute({
      routeKey: activeRouteKey,
      routeLabel: activeRouteLabel,
    });

    clearPhaseTimers();
    tapTimesRef.current = [];
    setPhase("bluetooth-running");
    setPhaseElapsedMs(0);
    setPhaseError(null);
    setLastAnalysisSummary(null);
    setCountdownValue(3);

    [3, 2, 1].forEach((value, index) => {
      const countdownTimer = setTimeout(() => {
        setCountdownValue(value);
      }, index * COUNTDOWN_STEP_MS);
      timersRef.current.push(countdownTimer as unknown as number);
    });

    const startTimer = setTimeout(() => {
      setCountdownValue(null);
      phaseStartAtRef.current = Date.now();
      progressIntervalRef.current = setInterval(() => {
        if (phaseStartAtRef.current == null) {
          return;
        }
        setPhaseElapsedMs(Date.now() - phaseStartAtRef.current);
      }, 33);

      void startAudioPlayback();

      const finishTimer = setTimeout(() => {
        void stopAudioPlayback().finally(() => {
          completePhase();
        });
      }, CALIBRATION_BEAT_COUNT * CALIBRATION_BEAT_INTERVAL_MS + 40);
      timersRef.current.push(finishTimer as unknown as number);
    }, START_DELAY_MS);

    timersRef.current.push(startTimer as unknown as number);
  }

  function handleTap() {
    if (phase !== "bluetooth-running") {
      return;
    }
    if (phaseStartAtRef.current == null) {
      return;
    }
    tapTimesRef.current.push(Date.now() - phaseStartAtRef.current);
  }

  function adjustDraftOffset(deltaMs: number) {
    setEstimatedOffsetMs((current) => {
      if (current == null) {
        return current;
      }
      return normalizeBluetoothMonitoringSavedOffsetMs(current + deltaMs);
    });
  }

  function adjustSavedCalibration(routeKeyToAdjust: string, routeLabelToAdjust: string, currentOffsetMs: number, deltaMs: number) {
    const nextOffsetMs = normalizeBluetoothMonitoringSavedOffsetMs(currentOffsetMs + deltaMs);
    setCalibration(routeKeyToAdjust, routeLabelToAdjust, nextOffsetMs);
  }

  const phaseDurationMs =
    phase === "bluetooth-running"
      ? CALIBRATION_BEAT_COUNT * CALIBRATION_BEAT_INTERVAL_MS
      : 0;
  const phaseProgress =
    phaseDurationMs > 0 ? Math.max(0, Math.min(1, phaseElapsedMs / phaseDurationMs)) : 0;

  function handleSaveCalibration() {
    if (!editableRouteKey || !editableRouteLabel || estimatedOffsetMs == null) {
      return;
    }
    setCalibration(editableRouteKey, editableRouteLabel, estimatedOffsetMs);
    Alert.alert("Calibration saved", `Bluetooth monitoring delay set to ${estimatedOffsetMs} ms for ${editableRouteLabel}.`);
    navigation.goBack();
  }

  function handleRemoveCalibration(routeKeyToRemove: string, routeLabelToRemove: string) {
    Alert.alert(
      "Remove calibration?",
      `Delete the saved Bluetooth monitoring calibration for ${routeLabelToRemove}?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeCalibration(routeKeyToRemove);
            if (routeKeyToRemove === editableRouteKey) {
              setEstimatedOffsetMs(null);
            }
          },
        },
      ]
    );
  }

  function resetCalibrationRun() {
    setEstimatedOffsetMs(null);
    setPhaseError(null);
    setLastAnalysisSummary(null);
    setBluetoothTargetRoute(null);
    resetRunState("idle");
  }

  return (
    <SafeAreaView style={globalStyles.screen}>
      <View style={globalStyles.transportHeaderZone}>
        <ScreenHeader title="Bluetooth Calibration" leftIcon="back" />
      </View>

      <ScrollView style={globalStyles.flexFill} contentContainerStyle={screenStyles.scrollContent}>
        <PageIntro
          title="Bluetooth Monitoring Calibration"
          subtitle="Measure Bluetooth monitoring delay directly on the headphones you want to use, then fine-tune the saved offset by ear. This affects recording flows only."
          titleNumberOfLines={2}
          subtitleNumberOfLines={4}
        />

        <View style={screenStyles.section}>
          <View style={globalStyles.settingsSectionHeaderRow}>
            <Text style={globalStyles.settingsSectionLabel}>Current output</Text>
            <Text style={globalStyles.settingsSectionMeta}>
              {isBluetoothRoute ? "Bluetooth" : "Other"}
            </Text>
          </View>
          <View style={screenStyles.routeCard}>
            <Text style={screenStyles.routeTitle}>{activeRouteLabel}</Text>
            <Text style={screenStyles.routeMeta}>
              {isBluetoothRoute
                ? "Ready for Bluetooth calibration."
                : "Switch audio output to the Bluetooth headphones you want to calibrate."}
            </Text>
          </View>
        </View>

        <View style={screenStyles.section}>
          <View style={globalStyles.settingsSectionHeaderRow}>
            <Text style={globalStyles.settingsSectionLabel}>Calibration</Text>
            <Text style={globalStyles.settingsSectionMeta}>90 BPM</Text>
          </View>

          <View style={screenStyles.phaseCard}>
            <Text style={screenStyles.phaseTitle}>
              {phase === "idle"
                ? "Bluetooth calibration"
                : phase === "result"
                    ? "Calibration result"
                    : "Bluetooth phase in progress"}
            </Text>
            <Text style={screenStyles.phaseText}>
              {phase === "result"
                  ? estimatedOffsetMs != null
                    ? estimatedOffsetMs >= MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS
                      ? `Estimated Bluetooth monitoring delay: ${estimatedOffsetMs} ms (capped)`
                      : `Estimated Bluetooth monitoring delay: ${estimatedOffsetMs} ms`
                    : "The calibration did not produce a stable result."
                  : countdownValue != null
                    ? `Starting in ${countdownValue}… Tap once per beat after the countdown.`
                    : "Listen to the click in your Bluetooth headphones and tap with what you hear."}
            </Text>

            {phase === "bluetooth-running" ? (
              <View style={screenStyles.progressBlock}>
                <View style={screenStyles.progressHeader}>
                  <Text style={screenStyles.phaseBeatLabel}>Bluetooth pass</Text>
                  <Text style={screenStyles.progressPercent}>{Math.round(phaseProgress * 100)}%</Text>
                </View>
                <View style={screenStyles.progressTrack}>
                  <View
                    style={[
                      screenStyles.progressFill,
                      { width: `${Math.round(phaseProgress * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            {phase === "bluetooth-running" ? (
              <Pressable style={screenStyles.tapSurface} onPress={handleTap}>
                <Text style={screenStyles.tapSurfaceLabel}>Tap</Text>
              </Pressable>
            ) : null}

            {phaseError ? <Text style={screenStyles.phaseError}>{phaseError}</Text> : null}
            {lastAnalysisSummary ? <Text style={screenStyles.phaseSummary}>{lastAnalysisSummary}</Text> : null}

            {isPreparingAudio ? (
              <View style={screenStyles.loadingRow}>
                <ActivityIndicator size="small" color="#824f3f" />
                <Text style={screenStyles.loadingText}>Preparing calibration click…</Text>
              </View>
            ) : null}

            {phase === "idle" ? (
              <Pressable
                style={({ pressed }) => [
                  screenStyles.primaryButton,
                  (!isBluetoothRoute || isPreparingAudio) ? screenStyles.buttonDisabled : null,
                  pressed ? globalStyles.pressDown : null,
                ]}
                onPress={schedulePhase}
                disabled={!isBluetoothRoute || isPreparingAudio}
              >
                <Text style={screenStyles.primaryButtonText}>Start Bluetooth calibration</Text>
              </Pressable>
            ) : null}

            {phase === "result" ? (
              <>
                <Text style={screenStyles.phaseBeatLabel}>
                  {editableRouteLabel ? `Final offset for ${editableRouteLabel}` : "Final offset"}
                </Text>
                <Text style={screenStyles.phaseSummary}>
                  Auto measurement caps at {MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS} ms. Manual tuning can reach{" "}
                  {MAX_BLUETOOTH_MONITORING_MANUAL_OFFSET_MS} ms.
                </Text>
                <View style={screenStyles.tweakRow}>
                  <Pressable
                    style={({ pressed }) => [
                      screenStyles.secondaryButton,
                      estimatedOffsetMs == null ? screenStyles.buttonDisabled : null,
                      pressed ? globalStyles.pressDown : null,
                    ]}
                    disabled={estimatedOffsetMs == null}
                    onPress={() => adjustDraftOffset(-OFFSET_TWEAK_LARGE_MS)}
                  >
                    <Text style={screenStyles.secondaryButtonText}>-25 ms</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      screenStyles.secondaryButton,
                      estimatedOffsetMs == null ? screenStyles.buttonDisabled : null,
                      pressed ? globalStyles.pressDown : null,
                    ]}
                    disabled={estimatedOffsetMs == null}
                    onPress={() => adjustDraftOffset(-OFFSET_TWEAK_SMALL_MS)}
                  >
                    <Text style={screenStyles.secondaryButtonText}>-10 ms</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      screenStyles.secondaryButton,
                      estimatedOffsetMs == null ? screenStyles.buttonDisabled : null,
                      pressed ? globalStyles.pressDown : null,
                    ]}
                    disabled={estimatedOffsetMs == null}
                    onPress={() => adjustDraftOffset(OFFSET_TWEAK_SMALL_MS)}
                  >
                    <Text style={screenStyles.secondaryButtonText}>+10 ms</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      screenStyles.secondaryButton,
                      estimatedOffsetMs == null ? screenStyles.buttonDisabled : null,
                      pressed ? globalStyles.pressDown : null,
                    ]}
                    disabled={estimatedOffsetMs == null}
                    onPress={() => adjustDraftOffset(OFFSET_TWEAK_LARGE_MS)}
                  >
                    <Text style={screenStyles.secondaryButtonText}>+25 ms</Text>
                  </Pressable>
                </View>
                <View style={screenStyles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      screenStyles.secondaryButton,
                      pressed ? globalStyles.pressDown : null,
                    ]}
                    onPress={resetCalibrationRun}
                  >
                    <Text style={screenStyles.secondaryButtonText}>Retry</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      screenStyles.primaryButton,
                      estimatedOffsetMs == null || !editableRouteKey || !editableRouteLabel
                        ? screenStyles.buttonDisabled
                        : null,
                      pressed ? globalStyles.pressDown : null,
                    ]}
                    onPress={handleSaveCalibration}
                    disabled={estimatedOffsetMs == null || !editableRouteKey || !editableRouteLabel}
                  >
                    <Text style={screenStyles.primaryButtonText}>Save calibration</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={screenStyles.section}>
          <View style={globalStyles.settingsSectionHeaderRow}>
            <Text style={globalStyles.settingsSectionLabel}>Saved calibrations</Text>
            <Text style={globalStyles.settingsSectionMeta}>{calibrations.length}</Text>
          </View>

          {calibrations.length === 0 ? (
            <Text style={globalStyles.settingsSectionHint}>No Bluetooth monitoring calibrations saved yet.</Text>
          ) : (
            <View style={screenStyles.savedList}>
              {calibrations.map((calibration) => (
                <View key={calibration.routeKey} style={screenStyles.savedRow}>
                  <View style={screenStyles.savedCopy}>
                    <Text style={screenStyles.savedTitle}>{calibration.routeLabel}</Text>
                    <Text style={screenStyles.savedMeta}>{calibration.offsetMs} ms</Text>
                  </View>
                  <View style={screenStyles.savedActionCluster}>
                    <Pressable
                      style={({ pressed }) => [
                        screenStyles.savedAdjustButton,
                        pressed ? globalStyles.pressDown : null,
                      ]}
                      onPress={() =>
                        adjustSavedCalibration(
                          calibration.routeKey,
                          calibration.routeLabel,
                          calibration.offsetMs,
                          -OFFSET_TWEAK_SMALL_MS
                        )
                      }
                    >
                      <Text style={screenStyles.savedAdjustButtonText}>-10</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        screenStyles.savedAdjustButton,
                        pressed ? globalStyles.pressDown : null,
                      ]}
                      onPress={() =>
                        adjustSavedCalibration(
                          calibration.routeKey,
                          calibration.routeLabel,
                          calibration.offsetMs,
                          OFFSET_TWEAK_SMALL_MS
                        )
                      }
                    >
                      <Text style={screenStyles.savedAdjustButtonText}>+10</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        screenStyles.removeButton,
                        pressed ? globalStyles.pressDown : null,
                      ]}
                      onPress={() => handleRemoveCalibration(calibration.routeKey, calibration.routeLabel)}
                    >
                      <Text style={screenStyles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  routeCard: {
    backgroundColor: "#efeeea",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  routeTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: "#1b1c1a",
    fontWeight: "700",
  },
  routeMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: "#5a4b45",
  },
  phaseCard: {
    backgroundColor: "#efeeea",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  phaseTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: "#1b1c1a",
    fontWeight: "700",
  },
  phaseText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#5a4b45",
  },
  phaseBeatLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "#6d5b55",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  progressBlock: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressPercent: {
    fontSize: 12,
    lineHeight: 16,
    color: "#6d5b55",
    fontWeight: "700",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#d7c2bd",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#824f3f",
  },
  tapSurface: {
    minHeight: 140,
    borderRadius: 6,
    backgroundColor: "#fffdf9",
    alignItems: "center",
    justifyContent: "center",
  },
  tapSurfaceLabel: {
    fontSize: 20,
    lineHeight: 24,
    color: "#1b1c1a",
    fontWeight: "700",
  },
  phaseError: {
    fontSize: 13,
    lineHeight: 18,
    color: "#824f3f",
  },
  phaseSummary: {
    fontSize: 12,
    lineHeight: 17,
    color: "#6d5b55",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#5a4b45",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  tweakRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 4,
    backgroundColor: "#824f3f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    flex: 1,
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 4,
    backgroundColor: "#e6e2dd",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: "#1b1c1a",
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  savedList: {
    gap: 8,
  },
  savedRow: {
    backgroundColor: "#efeeea",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  savedCopy: {
    gap: 2,
  },
  savedTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: "#1b1c1a",
    fontWeight: "700",
  },
  savedMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: "#5a4b45",
  },
  savedActionCluster: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  savedAdjustButton: {
    minHeight: 36,
    borderRadius: 4,
    backgroundColor: "#e6e2dd",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  savedAdjustButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#1b1c1a",
    fontWeight: "700",
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#824f3f",
    fontWeight: "700",
  },
});
