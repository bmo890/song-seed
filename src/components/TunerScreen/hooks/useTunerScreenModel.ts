import { useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { ExpoAudioStreamModule } from "@siteed/audio-studio";
import type { EmitterSubscription } from "react-native";
import {
  buildTunerReading,
  getTunerMeterPercent,
  normalizePitchAgainstHistory,
  summarizePitchSamples,
} from "../../../tuner";

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
const DISPLAY_SMOOTHING_ALPHA = 0.10;
const DISPLAY_FAST_ALPHA = 0.22;
const IN_TUNE_GUIDE_CENTS = 5;
const IN_TUNE_HOLD_MS = 480;
const IN_TUNE_EXIT_CENTS = 10;
const MIN_DISPLAY_DELTA_HZ = 0.04;
const CANDIDATE_SAMPLE_WINDOW = 5;
const CANDIDATE_MAX_SPREAD_CENTS = 18;
const MAX_TRACKING_JUMP_CENTS = 42;
const ACTIVE_CENTS_WINDOW = 14;
const SIGN_SWITCH_HYSTERESIS_CENTS = 4;
const DRAMATIC_CHANGE_CENTS = 18;
const ENGINE_EVENT_TIMEOUT_MS = 2200;
const ENGINE_HEALTHCHECK_MS = 1600;

const ARC_STAGE_WIDTH = 300;
const ARC_TRACK_SIZE = 240;
const ARC_TRACK_STROKE = 4;
const ARC_TRACK_TOP = 20;
const ARC_TRACK_LEFT = (ARC_STAGE_WIDTH - ARC_TRACK_SIZE) / 2;
const ARC_INDICATOR_SIZE = 16;

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
  let alpha = delta > DRAMATIC_CHANGE_CENTS ? DISPLAY_FAST_ALPHA : DISPLAY_SMOOTHING_ALPHA;

  // Center gravity — extra smoothing when both values are near in-tune
  if (
    Math.abs(current) <= IN_TUNE_GUIDE_CENTS + 3 &&
    Math.abs(adjustedTarget) <= IN_TUNE_GUIDE_CENTS + 3
  ) {
    alpha *= 0.4;
  }

  const next = current + (adjustedTarget - current) * alpha;

  return Math.abs(adjustedTarget - next) <= 0.2
    ? adjustedTarget
    : clampValue(next, -50, 50);
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

export function useTunerScreenModel() {
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
  const lastInTuneTsRef = useRef(0);

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

    return () => clearInterval(intervalId);
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

    return () => clearInterval(intervalId);
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
    lastInTuneTsRef.current = 0;

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
        frequency:
          currentCandidate.frequency + (nextFrequency - currentCandidate.frequency) * 0.35,
        samples: [
          ...currentCandidate.samples.slice(-(CANDIDATE_SAMPLE_WINDOW - 1)),
          nextFrequency,
        ],
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

    const normalizedPitch = normalizePitchAgainstHistory(
      pitch,
      recentPitchWindowRef.current
    );
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
    const referenceFrequency =
      activeReferenceFrequencyRef.current ?? nextReading.nearestNoteFrequency;
    activeReferenceFrequencyRef.current = referenceFrequency;
    activeCentsWindowRef.current = [
      ...activeCentsWindowRef.current.slice(-(ACTIVE_CENTS_WINDOW - 1)),
      nextReading.centsOff,
    ];
    const targetCents =
      summarizePitchSamples(activeCentsWindowRef.current) ?? nextReading.centsOff;
    const currentDisplayCents = displayCentsRef.current;

    if (
      currentDisplayCents !== null &&
      Math.abs(targetCents - currentDisplayCents) > MAX_TRACKING_JUMP_CENTS
    ) {
      return;
    }

    publishSettledPitch(
      referenceFrequency,
      smoothDisplayedCents(currentDisplayCents, targetCents)
    );
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
        setErrorMessage(
          "Pitch detector is unavailable. Rebuild the native app to use the tuner."
        );
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
  const rawDetuneTone = reading ? getDetuneTone(Math.abs(centsOff)) : "idle";

  // In-tune hold — once locked green, stay green briefly even if cents drift
  let effectiveTone = rawDetuneTone;
  if (rawDetuneTone === "in_tune") {
    lastInTuneTsRef.current = Date.now();
  } else if (
    signalActive &&
    reading &&
    lastInTuneTsRef.current > 0 &&
    Date.now() - lastInTuneTsRef.current < IN_TUNE_HOLD_MS &&
    Math.abs(centsOff) <= IN_TUNE_EXIT_CENTS
  ) {
    effectiveTone = "in_tune";
  }

  const showFlatDetune = Boolean(reading && reading.centsOff < -IN_TUNE_GUIDE_CENTS);
  const showSharpDetune = Boolean(reading && reading.centsOff > IN_TUNE_GUIDE_CENTS);

  return {
    isListening,
    reading,
    signalActive,
    errorMessage,
    permissionBlocked,
    indicatorPosition,
    meterTone: signalActive && !reading ? "active" : effectiveTone,
    showFlatDetune,
    showSharpDetune,
    flatDetuneValue: formatDetuneBadge(reading?.centsOff ?? null, "flat"),
    sharpDetuneValue: formatDetuneBadge(reading?.centsOff ?? null, "sharp"),
    noteText: reading ? reading.noteName : "--",
    octaveText: reading ? String(reading.octave) : "",
    frequencyLabel: reading ? formatFrequency(reading.detectedFrequency) : "--",
  };
}
