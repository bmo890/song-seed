import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { ExpoAudioStreamModule } from "@siteed/audio-studio";
import { AppState, type EmitterSubscription } from "react-native";
import { haptic } from "../../../design/haptics";
import {
  TRACKER_CONFIG,
  createTrackerState,
  isTrackerStale,
  trackPitchFrame,
  type TrackerOutput,
  type TrackerState,
} from "../../../domain/tunerTracker";

type PitchyConfig = {
  bufferSize?: number;
  minVolume?: number;
  algorithm?: "ACF2+";
};

type PitchEvent = {
  pitch: number;
  /** Periodicity 0..1 from the patched native detector; absent on older builds. */
  clarity?: number;
  /** Input level in dBFS. */
  level?: number;
};

type PitchyModule = {
  init(config?: PitchyConfig): void;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  isRecording(): Promise<boolean>;
  addListener(callback: (event: PitchEvent) => void): EmitterSubscription;
};

/**
 * Frames per detection pass. On Android this is the read hop (~46 ms at
 * 44.1 kHz); iOS taps deliver ~100 ms regardless and the native side analyses
 * the newest 4096 frames of each buffer.
 */
const PITCHY_HOP_FRAMES = 2048;
// Measurement mode disables iOS input AGC, so raw mic levels run low — a decaying
// pluck sits well under -46 dBFS mid-note. The detector's clarity gate rejects
// noise-derived pitches, so the level gate only needs to drop true silence.
const PITCHY_MIN_VOLUME_DB = -60;
const STALE_CHECK_MS = 100;
const IN_TUNE_HOLD_MS = 480;
/** After leaving in-tune, wait this long before the lock haptic can fire again. */
const IN_TUNE_HAPTIC_REARM_MS = 300;
const IN_TUNE_EXIT_CENTS = 10;
const ENGINE_EVENT_TIMEOUT_MS = 2200;
const ENGINE_HEALTHCHECK_MS = 1600;

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

function getDetuneTone(absCents: number) {
  if (absCents <= TRACKER_CONFIG.inTuneCents) {
    return "in_tune";
  }
  if (absCents <= 16) {
    return "near";
  }
  return "far";
}

export function useTunerScreenModel() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  const pitchyRef = useRef<PitchyModule | null>(null);
  const subscriptionRef = useRef<EmitterSubscription | null>(null);
  const isMountedRef = useRef(true);
  const isFocusedRef = useRef(isFocused);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isRestartingRef = useRef(false);
  const isListeningRef = useRef(false);
  const trackerRef = useRef<TrackerState>(createTrackerState());
  const lastEngineEventTsRef = useRef(0);
  const lastInTuneTsRef = useRef(0);
  const wasInTuneRef = useRef(false);
  const leftInTuneTsRef = useRef(0);

  const [output, setOutput] = useState<TrackerOutput | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [signalActive, setSignalActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

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

  // Hold the last reading briefly after the string stops sounding, then clear.
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isMountedRef.current) {
        return;
      }
      if (isTrackerStale(trackerRef.current, Date.now())) {
        if (trackerRef.current.activeNoteKey !== null || trackerRef.current.pending) {
          trackerRef.current = createTrackerState();
        }
        setOutput((current) => (current === null ? current : null));
        setSignalActive((current) => (current ? false : current));
      }
    }, STALE_CHECK_MS);

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

      const canRestart = () =>
        isFocusedRef.current &&
        isListeningRef.current &&
        !isStartingRef.current &&
        !isStoppingRef.current &&
        !isRestartingRef.current;

      void pitchy
        .isRecording()
        .then((isRecording) => {
          if ((!isRecording || engineTimedOut) && canRestart()) {
            void restartListening();
          }
        })
        .catch(() => {
          if (canRestart()) {
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
        ? t("tuner.micDisabled")
        : t("tuner.micNeeded")
    );
    return false;
  }

  function resetLiveState() {
    trackerRef.current = createTrackerState();
    lastEngineEventTsRef.current = 0;
    lastInTuneTsRef.current = 0;

    if (isMountedRef.current) {
      setOutput(null);
      setSignalActive(false);
    }
  }

  function handlePitchDetected(event: PitchEvent) {
    const now = Date.now();
    lastEngineEventTsRef.current = now;

    const result = trackPitchFrame(trackerRef.current, {
      pitch: event.pitch,
      clarity: event.clarity,
      level: event.level,
      timestamp: now,
    });
    trackerRef.current = result.state;

    if (!isMountedRef.current || result.state.lastUpdateAt !== now) {
      return;
    }

    setSignalActive((current) => (current ? current : true));
    setOutput(result.output);
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
        setErrorMessage(t("tuner.detectorUnavailable"));
        return;
      }

      pitchyRef.current = pitchy;
      resetLiveState();
      setErrorMessage(null);
      lastEngineEventTsRef.current = Date.now();

      subscriptionRef.current?.remove();
      subscriptionRef.current = pitchy.addListener(handlePitchDetected);
      pitchy.init({
        bufferSize: PITCHY_HOP_FRAMES,
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
        setErrorMessage(t("tuner.startFailed"));
      }
      // Failure surfaced to the user: docs/haptics-vocabulary.md → error.
      haptic.error();
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
        // stop() rejects when the engine already died; that is the state we want.
        await pitchy.stop().catch(() => {});
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
        await pitchy.stop().catch(() => {});
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

  // The mic belongs to the foreground. Backgrounding releases it (no orange
  // recording pip while the phone sits in a pocket); returning re-arms. This
  // also covers coming back from system Settings after enabling the mic there,
  // which never re-fires navigation focus.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (isFocusedRef.current && !isListeningRef.current) {
          void startListening();
        }
      } else if (state === "background") {
        if (isListeningRef.current || isStartingRef.current) {
          void stopListening();
        }
      }
    });
    return () => subscription.remove();
  }, []);

  const reading = output;
  const centsOff = reading?.centsOff ?? 0;
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

  const showFlatDetune = Boolean(reading && reading.centsOff < -TRACKER_CONFIG.inTuneCents);
  const showSharpDetune = Boolean(reading && reading.centsOff > TRACKER_CONFIG.inTuneCents);

  // In-tune buzz: one success pulse when the needle locks green — the canonical
  // tuner delight. Fires on the TRANSITION only and re-arms after the tone has
  // left in_tune for a beat, so a note held on the line doesn't machine-gun and
  // wobble across the boundary doesn't re-fire (docs/haptics-vocabulary.md).
  useEffect(() => {
    if (effectiveTone === "in_tune") {
      if (!wasInTuneRef.current && Date.now() - leftInTuneTsRef.current > IN_TUNE_HAPTIC_REARM_MS) {
        haptic.success();
      }
      wasInTuneRef.current = true;
    } else {
      if (wasInTuneRef.current) {
        leftInTuneTsRef.current = Date.now();
      }
      wasInTuneRef.current = false;
    }
  }, [effectiveTone]);

  return {
    isListening,
    reading,
    signalActive,
    errorMessage,
    permissionBlocked,
    // Retry affordance for the re-askable denial (canAskAgain): tapping the error
    // re-runs the permission request rather than dead-ending.
    retry: startListening,
    /** Needle target in cents (−50…50); 0 when idle so the needle rests centered. */
    needleCents: centsOff,
    meterTone: signalActive && !reading ? "active" : effectiveTone,
    showFlatDetune,
    showSharpDetune,
    flatDetuneValue: formatDetuneBadge(reading?.centsOff ?? null, "flat"),
    sharpDetuneValue: formatDetuneBadge(reading?.centsOff ?? null, "sharp"),
    noteText: reading ? reading.noteName : "--",
    octaveText: reading ? String(reading.octave) : "",
    frequencyLabel: reading ? formatFrequency(reading.frequency) : "--",
  };
}
