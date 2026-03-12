import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View, type EmitterSubscription } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useIsFocused } from "@react-navigation/native";
import { ExpoAudioStreamModule } from "@siteed/expo-audio-studio";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { ScreenHeader } from "../common/ScreenHeader";
import { colors, shadows, spacing, text as textTokens } from "../../design/tokens";
import { styles } from "../../styles";
import {
  buildTunerReading,
  getTunerMeterPercent,
  normalizePitchAgainstHistory,
  summarizePitchSamples,
} from "../../tuner";

type PitchyConfig = {
  bufferSize?: number;
  minVolume?: number;
  algorithm?: "ACF2+";
};

type PitchyModule = {
  init(config?: PitchyConfig): void;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  isRecording(): Promise<boolean>;
  addListener(callback: ({ pitch }: { pitch: number }) => void): EmitterSubscription;
};

type NoteCandidate = {
  eventCount: number;
  frequency: number;
  noteKey: string;
  samples: number[];
  startedAt: number;
};

const MAX_RECENT_PITCHES = 3;
const STALE_PITCH_MS = 700;
const PITCH_MIN_HZ = 40;
const PITCH_MAX_HZ = 1500;
const PITCHY_BUFFER_SIZE = 2048;
const PITCHY_MIN_VOLUME_DB = -46;
const INITIAL_LOCK_EVENT_COUNT = 2;
const SWITCH_LOCK_EVENT_COUNT = 3;
const INITIAL_LOCK_MS = 70;
const SWITCH_LOCK_MS = 135;
const DISPLAY_SMOOTHING_ALPHA = 0.18;
const DISPLAY_FAST_ALPHA = 0.34;
const IN_TUNE_GUIDE_CENTS = 5;
const MIN_DISPLAY_DELTA_HZ = 0.04;
const CANDIDATE_SAMPLE_WINDOW = 5;
const CANDIDATE_MAX_SPREAD_CENTS = 18;
const MAX_TRACKING_JUMP_CENTS = 42;
const ACTIVE_CENTS_WINDOW = 11;
const SIGN_SWITCH_HYSTERESIS_CENTS = 4;
const DRAMATIC_CHANGE_CENTS = 14;
const ENGINE_EVENT_TIMEOUT_MS = 2200;
const ENGINE_HEALTHCHECK_MS = 1600;
const ARC_STAGE_WIDTH = 332;
const ARC_STAGE_HEIGHT = 388;
const ARC_TRACK_SIZE = 260;
const ARC_TRACK_STROKE = 3;
const ARC_TRACK_TOP = 96;
const ARC_TRACK_LEFT = (ARC_STAGE_WIDTH - ARC_TRACK_SIZE) / 2;
const ARC_CUTOUT_WIDTH = 118;
const ARC_CUTOUT_HEIGHT = 82;
const ARC_CUTOUT_BOTTOM = 22;
const ARC_INDICATOR_SIZE = 22;
const ARC_NOTE_TOP = 152;
const ARC_SIDE_LABEL_TOP = ARC_TRACK_TOP + ARC_TRACK_SIZE / 2 - 16;

function loadPitchy(): PitchyModule | null {
  try {
    const module = require("react-native-pitchy") as { default?: PitchyModule };
    return module.default ?? null;
  } catch {
    return null;
  }
}

function formatFrequency(frequency: number) {
  return `${frequency.toFixed(1)} Hz`;
}

function formatDetuneBadge(centsOff: number | null, side: "flat" | "sharp") {
  if (centsOff === null) {
    return "--";
  }

  const rounded = Math.round(Math.abs(centsOff));
  if (rounded === 0) {
    return "0";
  }

  if (side === "flat") {
    return centsOff < 0 ? `-${rounded}` : "--";
  }

  return centsOff > 0 ? `+${rounded}` : "--";
}

function getReadingKey(noteName: string, octave: number) {
  return `${noteName}${octave}`;
}

function centsDistance(frequency: number, referenceFrequency: number) {
  return Math.abs(1200 * Math.log2(frequency / referenceFrequency));
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function frequencyFromCents(referenceFrequency: number, centsOff: number) {
  return referenceFrequency * Math.pow(2, centsOff / 1200);
}

function smoothDisplayedCents(current: number | null, target: number) {
  const adjustedTarget = clampValue(target, -50, 50);

  if (current === null) {
    return adjustedTarget;
  }

  if (
    Math.sign(current) !== 0 &&
    Math.sign(adjustedTarget) !== 0 &&
    Math.sign(current) !== Math.sign(adjustedTarget) &&
    Math.abs(adjustedTarget) < SIGN_SWITCH_HYSTERESIS_CENTS
  ) {
    const decayed = current * 0.82;
    return Math.abs(decayed) < 0.35 ? adjustedTarget : decayed;
  }

  const delta = Math.abs(adjustedTarget - current);
  const alpha = delta > DRAMATIC_CHANGE_CENTS ? DISPLAY_FAST_ALPHA : DISPLAY_SMOOTHING_ALPHA;
  const next = current + (adjustedTarget - current) * alpha;

  return Math.abs(adjustedTarget - next) <= 0.2 ? adjustedTarget : clampValue(next, -50, 50);
}

function isCandidateStable(candidate: NoteCandidate) {
  const center = summarizePitchSamples(candidate.samples);
  if (!center) {
    return false;
  }

  const maxSpread = candidate.samples.reduce((largestSpread, sample) => {
    return Math.max(largestSpread, centsDistance(sample, center));
  }, 0);

  return maxSpread <= CANDIDATE_MAX_SPREAD_CENTS;
}

function getArcIndicatorPosition(centsOff: number) {
  const progress = getTunerMeterPercent(centsOff) / 100;
  const angle = Math.PI - progress * Math.PI;
  const centerX = ARC_TRACK_LEFT + ARC_TRACK_SIZE / 2;
  const centerY = ARC_TRACK_TOP + ARC_TRACK_SIZE / 2;
  const radius = ARC_TRACK_SIZE / 2 - ARC_TRACK_STROKE / 2;

  return {
    left: centerX + radius * Math.cos(angle) - ARC_INDICATOR_SIZE / 2,
    top: centerY - radius * Math.sin(angle) - ARC_INDICATOR_SIZE / 2,
  };
}

function getDetuneTone(absCents: number) {
  if (absCents <= IN_TUNE_GUIDE_CENTS) {
    return "in_tune";
  }

  if (absCents <= 16) {
    return "near";
  }

  return "far";
}

export function TunerScreen() {
  const isFocused = useIsFocused();

  const pitchyRef = useRef<PitchyModule | null>(null);
  const subscriptionRef = useRef<EmitterSubscription | null>(null);
  const isMountedRef = useRef(true);
  const isFocusedRef = useRef(isFocused);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isRestartingRef = useRef(false);
  const isListeningRef = useRef(false);
  const recentPitchWindowRef = useRef<number[]>([]);
  const lastPitchTsRef = useRef(0);
  const lastEngineEventTsRef = useRef(0);
  const displayFrequencyRef = useRef<number | null>(null);
  const activeNoteKeyRef = useRef<string | null>(null);
  const candidateNoteRef = useRef<NoteCandidate | null>(null);
  const activeReferenceFrequencyRef = useRef<number | null>(null);
  const displayCentsRef = useRef<number | null>(null);
  const activeCentsWindowRef = useRef<number[]>([]);

  const [frequency, setFrequency] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [signalActive, setSignalActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const reading = useMemo(() => buildTunerReading(frequency), [frequency]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      const pitchy = pitchyRef.current;
      if (pitchy) {
        pitchy.stop().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const isFresh = Date.now() - lastPitchTsRef.current <= STALE_PITCH_MS;

      if (isMountedRef.current) {
        setSignalActive((current) => (current === isFresh ? current : isFresh));
      }

      if (!isFresh) {
        recentPitchWindowRef.current = [];
        candidateNoteRef.current = null;
        activeNoteKeyRef.current = null;
        displayFrequencyRef.current = null;
        activeReferenceFrequencyRef.current = null;
        displayCentsRef.current = null;
        activeCentsWindowRef.current = [];
        if (isMountedRef.current) {
          setFrequency((current) => (current === null ? current : null));
        }
      }
    }, 80);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (
        !isFocusedRef.current ||
        !isListeningRef.current ||
        isStartingRef.current ||
        isStoppingRef.current ||
        isRestartingRef.current
      ) {
        return;
      }

      const pitchy = pitchyRef.current;
      if (!pitchy) {
        return;
      }

      const engineTimedOut =
        lastEngineEventTsRef.current > 0 &&
        Date.now() - lastEngineEventTsRef.current > ENGINE_EVENT_TIMEOUT_MS;

      void pitchy
        .isRecording()
        .then((isRecording) => {
          if (
            (!isRecording || engineTimedOut) &&
            isFocusedRef.current &&
            isListeningRef.current &&
            !isStartingRef.current &&
            !isStoppingRef.current &&
            !isRestartingRef.current
          ) {
            void restartListening();
          }
        })
        .catch(() => {
          if (
            isFocusedRef.current &&
            isListeningRef.current &&
            !isStartingRef.current &&
            !isStoppingRef.current &&
            !isRestartingRef.current
          ) {
            void restartListening();
          }
        });
    }, ENGINE_HEALTHCHECK_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  async function requestMicrophonePermission() {
    const permission = await ExpoAudioStreamModule.requestPermissionsAsync();
    const granted = permission?.granted ?? permission?.status === "granted";

    if (granted) {
      setPermissionBlocked(false);
      return true;
    }

    setPermissionBlocked(permission?.canAskAgain === false);
    setErrorMessage(
      permission?.canAskAgain === false
        ? "Microphone access is disabled in system settings."
        : "Song Seed needs microphone access to tune."
    );
    return false;
  }

  function resetLiveState() {
    recentPitchWindowRef.current = [];
    lastPitchTsRef.current = 0;
    lastEngineEventTsRef.current = 0;
    displayFrequencyRef.current = null;
    activeNoteKeyRef.current = null;
    candidateNoteRef.current = null;
    activeReferenceFrequencyRef.current = null;
    displayCentsRef.current = null;
    activeCentsWindowRef.current = [];

    if (isMountedRef.current) {
      setFrequency(null);
      setSignalActive(false);
    }
  }

  function publishFrequency(nextFrequency: number | null) {
    displayFrequencyRef.current = nextFrequency;

    if (nextFrequency !== null) {
      lastPitchTsRef.current = Date.now();
    }

    if (!isMountedRef.current) {
      return;
    }

    if (nextFrequency !== null) {
      setSignalActive((current) => (current ? current : true));
    }

    setFrequency((current) => {
      if (nextFrequency === null) {
        return current === null ? current : null;
      }

      if (current !== null && Math.abs(current - nextFrequency) <= MIN_DISPLAY_DELTA_HZ) {
        return current;
      }

      return nextFrequency;
    });
  }

  function publishSettledPitch(referenceFrequency: number, centsOff: number | null) {
    displayCentsRef.current = centsOff;

    if (centsOff === null) {
      publishFrequency(null);
      return;
    }

    publishFrequency(frequencyFromCents(referenceFrequency, centsOff));
  }

  function updateCandidate(noteKey: string, nextFrequency: number, now: number) {
    const currentCandidate = candidateNoteRef.current;
    if (currentCandidate?.noteKey === noteKey) {
      const updatedCandidate = {
        ...currentCandidate,
        eventCount: currentCandidate.eventCount + 1,
        frequency: currentCandidate.frequency + (nextFrequency - currentCandidate.frequency) * 0.35,
        samples: [...currentCandidate.samples.slice(-(CANDIDATE_SAMPLE_WINDOW - 1)), nextFrequency],
      };

      candidateNoteRef.current = updatedCandidate;
      return updatedCandidate;
    }

    const nextCandidate = {
      noteKey,
      frequency: nextFrequency,
      eventCount: 1,
      samples: [nextFrequency],
      startedAt: now,
    };

    candidateNoteRef.current = nextCandidate;
    return nextCandidate;
  }

  function handlePitchDetected({ pitch }: { pitch: number }) {
    lastEngineEventTsRef.current = Date.now();

    if (!Number.isFinite(pitch) || pitch < PITCH_MIN_HZ || pitch > PITCH_MAX_HZ) {
      return;
    }

    const normalizedPitch = normalizePitchAgainstHistory(pitch, recentPitchWindowRef.current);
    recentPitchWindowRef.current = [
      ...recentPitchWindowRef.current.slice(-(MAX_RECENT_PITCHES - 1)),
      normalizedPitch,
    ];

    const stabilizedPitch = summarizePitchSamples(recentPitchWindowRef.current);
    if (!stabilizedPitch) {
      return;
    }

    const nextReading = buildTunerReading(stabilizedPitch);
    if (!nextReading) {
      return;
    }

    const now = Date.now();
    const noteKey = getReadingKey(nextReading.noteName, nextReading.octave);

    const activeNoteKey = activeNoteKeyRef.current;

    if (!activeNoteKey) {
      const candidate = updateCandidate(noteKey, stabilizedPitch, now);

      if (
        candidate.eventCount < INITIAL_LOCK_EVENT_COUNT ||
        now - candidate.startedAt < INITIAL_LOCK_MS ||
        !isCandidateStable(candidate)
      ) {
        return;
      }

      activeNoteKeyRef.current = noteKey;
      candidateNoteRef.current = null;
      activeReferenceFrequencyRef.current = nextReading.nearestNoteFrequency;
      activeCentsWindowRef.current = [nextReading.centsOff];
      publishSettledPitch(
        nextReading.nearestNoteFrequency,
        smoothDisplayedCents(null, nextReading.centsOff)
      );
      return;
    }

    if (noteKey !== activeNoteKey) {
      const candidate = updateCandidate(noteKey, stabilizedPitch, now);

      if (
        candidate.eventCount < SWITCH_LOCK_EVENT_COUNT ||
        now - candidate.startedAt < SWITCH_LOCK_MS ||
        !isCandidateStable(candidate)
      ) {
        return;
      }

      activeNoteKeyRef.current = noteKey;
      candidateNoteRef.current = null;
      activeReferenceFrequencyRef.current = nextReading.nearestNoteFrequency;
      activeCentsWindowRef.current = [nextReading.centsOff];
      publishSettledPitch(
        nextReading.nearestNoteFrequency,
        smoothDisplayedCents(null, nextReading.centsOff)
      );
      return;
    }

    candidateNoteRef.current = null;
    const referenceFrequency = activeReferenceFrequencyRef.current ?? nextReading.nearestNoteFrequency;
    activeReferenceFrequencyRef.current = referenceFrequency;
    activeCentsWindowRef.current = [
      ...activeCentsWindowRef.current.slice(-(ACTIVE_CENTS_WINDOW - 1)),
      nextReading.centsOff,
    ];
    const targetCents = summarizePitchSamples(activeCentsWindowRef.current) ?? nextReading.centsOff;
    const currentDisplayCents = displayCentsRef.current;

    if (
      currentDisplayCents !== null &&
      Math.abs(targetCents - currentDisplayCents) > MAX_TRACKING_JUMP_CENTS
    ) {
      return;
    }

    publishSettledPitch(referenceFrequency, smoothDisplayedCents(currentDisplayCents, targetCents));
  }

  async function startListening() {
    if (!isFocusedRef.current || isStartingRef.current || isListeningRef.current) {
      return;
    }

    isStartingRef.current = true;

    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        return;
      }

      const pitchy = loadPitchy();
      if (!pitchy) {
        setErrorMessage("Pitch detector is unavailable. Rebuild the native app to use the tuner.");
        return;
      }

      pitchyRef.current = pitchy;
      resetLiveState();
      setErrorMessage(null);
      lastEngineEventTsRef.current = Date.now();

      subscriptionRef.current?.remove();
      subscriptionRef.current = pitchy.addListener(handlePitchDetected);
      pitchy.init({
        bufferSize: PITCHY_BUFFER_SIZE,
        minVolume: PITCHY_MIN_VOLUME_DB,
        algorithm: "ACF2+",
      });

      await pitchy.start();
      isListeningRef.current = true;

      if (isMountedRef.current) {
        setIsListening(true);
      }

      if (!isFocusedRef.current) {
        await stopListening();
      }
    } catch (error) {
      console.warn("Tuner start failed", error);
      isListeningRef.current = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      if (isMountedRef.current) {
        setIsListening(false);
        setErrorMessage("Could not start the tuner.");
      }
    } finally {
      isStartingRef.current = false;
    }
  }

  async function restartListening() {
    if (
      isRestartingRef.current ||
      isStartingRef.current ||
      isStoppingRef.current ||
      !isFocusedRef.current
    ) {
      return;
    }

    isRestartingRef.current = true;
    try {
      const pitchy = pitchyRef.current;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;

      if (pitchy) {
        const isRecording = await pitchy.isRecording().catch(() => false);
        if (isRecording) {
          await pitchy.stop().catch(() => {});
        }
      }

      isListeningRef.current = false;
      if (isMountedRef.current) {
        setIsListening(false);
      }

      await startListening();
    } finally {
      isRestartingRef.current = false;
    }
  }

  async function stopListening() {
    if (isStoppingRef.current) {
      return;
    }

    isStoppingRef.current = true;
    try {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;

      const pitchy = pitchyRef.current;
      if (pitchy) {
        const isRecording = await pitchy.isRecording().catch(() => false);
        if (isRecording) {
          await pitchy.stop().catch(() => {});
        }
      }
    } finally {
      isListeningRef.current = false;
      resetLiveState();
      if (isMountedRef.current) {
        setIsListening(false);
      }
      isStoppingRef.current = false;
    }
  }

  useEffect(() => {
    if (isFocused) {
      void startListening();
    } else {
      void stopListening();
    }
  }, [isFocused]);

  const centsOff = reading?.centsOff ?? 0;
  const indicatorPosition = getArcIndicatorPosition(centsOff);
  const inTuneLeftPosition = getArcIndicatorPosition(-IN_TUNE_GUIDE_CENTS);
  const inTuneRightPosition = getArcIndicatorPosition(IN_TUNE_GUIDE_CENTS);
  const inTuneRangeLeft = inTuneLeftPosition.left + ARC_INDICATOR_SIZE / 2;
  const inTuneRangeRight = inTuneRightPosition.left + ARC_INDICATOR_SIZE / 2;
  const inTuneRangeTop = Math.min(inTuneLeftPosition.top, inTuneRightPosition.top) + ARC_INDICATOR_SIZE / 2 - 1;
  const detuneTone = reading ? getDetuneTone(Math.abs(centsOff)) : "idle";
  const meterToneStyle =
    detuneTone === "in_tune"
      ? localStyles.indicatorInTune
      : detuneTone === "near"
        ? localStyles.indicatorNear
        : detuneTone === "far"
          ? localStyles.indicatorFar
          : signalActive
            ? localStyles.indicatorActive
            : localStyles.indicatorIdle;
  const showFlatDetune = Boolean(reading && reading.centsOff < -IN_TUNE_GUIDE_CENTS);
  const showSharpDetune = Boolean(reading && reading.centsOff > IN_TUNE_GUIDE_CENTS);
  const flatDetuneValue = formatDetuneBadge(reading?.centsOff ?? null, "flat");
  const sharpDetuneValue = formatDetuneBadge(reading?.centsOff ?? null, "sharp");
  const noteText = reading ? reading.noteName : "--";
  const octaveText = reading ? String(reading.octave) : "";

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Tuner" leftIcon="hamburger" />
      <AppBreadcrumbs
        items={[
          { key: "home", label: "Home", level: "home" },
          { key: "tuner", label: "Tuner", level: "tuner", active: true },
        ]}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={localStyles.pageContent}>
        <View style={localStyles.contextBlock}>
          <Text style={localStyles.kicker}>Auto Detect</Text>
        </View>

        <View style={localStyles.dialSection}>
          <View style={localStyles.detuneRow}>
            <View style={localStyles.detuneSlot}>
              {showFlatDetune ? (
                <View
                  style={[
                    localStyles.detuneChip,
                    detuneTone === "far" ? localStyles.detuneChipFar : localStyles.detuneChipNear,
                  ]}
                >
                  <Text style={localStyles.detuneChipValue}>{flatDetuneValue}</Text>
                </View>
              ) : null}
            </View>
            <View style={localStyles.detuneSlot}>
              {showSharpDetune ? (
                <View
                  style={[
                    localStyles.detuneChip,
                    detuneTone === "far" ? localStyles.detuneChipFar : localStyles.detuneChipNear,
                  ]}
                >
                  <Text style={localStyles.detuneChipValue}>{sharpDetuneValue}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={localStyles.arcStage}>
            <View style={localStyles.arcTrack} />
            <View style={localStyles.arcCutout} />
            <View
              style={[
                localStyles.inTuneRange,
                { left: inTuneRangeLeft, top: inTuneRangeTop, width: Math.max(0, inTuneRangeRight - inTuneRangeLeft) },
              ]}
            />
            <View
              style={[
                localStyles.inTuneTick,
                { left: inTuneRangeLeft - 1, top: inTuneRangeTop - 6 },
              ]}
            />
            <View
              style={[
                localStyles.inTuneTick,
                { left: inTuneRangeRight - 1, top: inTuneRangeTop - 6 },
              ]}
            />
            <Text style={localStyles.flatLabel}>-</Text>
            <Text style={localStyles.sharpLabel}>+</Text>
            <View style={[localStyles.arcIndicator, meterToneStyle, indicatorPosition]} />

            <View style={localStyles.noteBlock}>
              <View style={localStyles.noteRow}>
                <Text style={localStyles.noteText}>{noteText}</Text>
                <Text style={localStyles.octaveText}>{octaveText}</Text>
              </View>
              <Text style={localStyles.hzInlineValue}>
                {reading ? formatFrequency(reading.detectedFrequency) : "--"}
              </Text>
              <Text style={localStyles.nearestText}>
                {reading ? `Nearest note • ${formatFrequency(reading.nearestNoteFrequency)}` : "Waiting for pitch"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={localStyles.helperText}>
          Keep the phone near the instrument, mute nearby noise, and let one string ring at a time.
        </Text>

        {errorMessage ? (
          <Text
            style={localStyles.errorText}
            onPress={() => {
              if (permissionBlocked) {
                void Linking.openSettings();
              }
            }}
          >
            {errorMessage}
          </Text>
        ) : null}
      </ScrollView>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  pageContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl + spacing.lg,
    alignItems: "center",
    gap: spacing.lg,
  },
  contextBlock: {
    alignItems: "center",
    minHeight: 28,
    justifyContent: "center",
    paddingTop: spacing.xs,
  },
  kicker: {
    ...textTokens.caption,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  dialSection: {
    width: "100%",
    alignItems: "center",
    gap: spacing.sm,
  },
  detuneRow: {
    width: ARC_TRACK_SIZE + 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: -spacing.sm,
  },
  detuneSlot: {
    width: 60,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  arcStage: {
    width: ARC_STAGE_WIDTH,
    height: ARC_STAGE_HEIGHT,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  arcTrack: {
    position: "absolute",
    top: ARC_TRACK_TOP,
    left: ARC_TRACK_LEFT,
    width: ARC_TRACK_SIZE,
    height: ARC_TRACK_SIZE,
    borderRadius: ARC_TRACK_SIZE / 2,
    borderWidth: ARC_TRACK_STROKE,
    borderColor: colors.borderMuted,
    backgroundColor: "transparent",
  },
  arcCutout: {
    position: "absolute",
    left: (ARC_STAGE_WIDTH - ARC_CUTOUT_WIDTH) / 2,
    bottom: ARC_CUTOUT_BOTTOM,
    width: ARC_CUTOUT_WIDTH,
    height: ARC_CUTOUT_HEIGHT,
    borderTopLeftRadius: ARC_CUTOUT_WIDTH / 2,
    borderTopRightRadius: ARC_CUTOUT_WIDTH / 2,
    backgroundColor: colors.page,
  },
  inTuneRange: {
    position: "absolute",
    height: 4,
    borderRadius: 999,
    backgroundColor: "#16a34a",
  },
  inTuneTick: {
    position: "absolute",
    width: 3,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#16a34a",
  },
  arcIndicator: {
    position: "absolute",
    width: ARC_INDICATOR_SIZE,
    height: ARC_INDICATOR_SIZE,
    borderRadius: ARC_INDICATOR_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.page,
    ...shadows.control,
  },
  indicatorIdle: {
    backgroundColor: colors.textMuted,
  },
  indicatorActive: {
    backgroundColor: "#60a5fa",
  },
  indicatorNear: {
    backgroundColor: "#d97706",
  },
  indicatorFar: {
    backgroundColor: "#dc2626",
  },
  indicatorInTune: {
    backgroundColor: "#16a34a",
  },
  flatLabel: {
    position: "absolute",
    left: 2,
    top: ARC_SIDE_LABEL_TOP,
    width: 28,
    height: 28,
    textAlign: "center",
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  sharpLabel: {
    position: "absolute",
    right: 2,
    top: ARC_SIDE_LABEL_TOP,
    width: 28,
    height: 28,
    textAlign: "center",
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  noteBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ARC_NOTE_TOP,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  noteText: {
    fontSize: 104,
    lineHeight: 104,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -3,
  },
  octaveText: {
    marginTop: -16,
    marginLeft: 6,
    fontSize: 26,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  hzInlineValue: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  nearestText: {
    marginTop: spacing.xs,
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
  },
  detuneChip: {
    minWidth: 60,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  detuneChipNear: {
    backgroundColor: "#fff3e6",
    borderColor: "#d97706",
  },
  detuneChipFar: {
    backgroundColor: "#fef0f0",
    borderColor: "#dc2626",
  },
  detuneChipValue: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
    color: colors.textStrong,
  },
  helperText: {
    ...textTokens.supporting,
    textAlign: "center",
    maxWidth: 280,
  },
  errorText: {
    ...textTokens.supporting,
    color: "#b91c1c",
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 300,
  },
});
