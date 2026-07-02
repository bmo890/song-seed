import { Platform } from "react-native";
import SongseedMetronomeModule from "../../modules/songseed-metronome";
import {
  getBluetoothMonitoringCalibrationForRoute,
  buildBluetoothMonitoringRouteKey,
  isBluetoothLikeAudioDevice,
} from "../bluetoothMonitoring";
import type { BluetoothMonitoringCalibration, RecordingGridSource } from "../types";
import type { MetronomeOutputs } from "../metronome";

/**
 * SINGLE SOURCE OF TRUTH for every latency number in the metronome/recording system.
 *
 * The model: there is one grid (the native engine's beat timeline), and every surface a
 * human experiences arrives late by a route- and modality-dependent amount — audible
 * click by the route's output latency, visual pulse by bridge+render+display, haptic by
 * bridge+motor spin-up, and the mic stamps everything it hears another input-latency
 * later. The performer plays to what they PERCEIVE, so recording alignment must reference
 * the perceived beat of whichever modality leads their attention (audible > haptic >
 * visual — humans sync worst to visual).
 *
 * Consumers: the record-through head-trim math, the metronome cue delays/leads, the
 * calibration screen, the alignment audition, and (eventually) the timed-take capture
 * engine. Nothing outside this file may invent or combine latency numbers.
 */

export type LatencySource = "calibration" | "os" | "default" | "unknown";

export type CueReferenceModality = "audible" | "haptic" | "visual" | "none";

export type RouteLatencyProfile = {
  /** Audible path: grid → transducer, ms. BT ear-calibration wins over OS reports. */
  outputMs: number;
  /** Mic path: sound → capture buffer, ms. 0 when the platform can't say. */
  inputMs: number;
  /** Estimated latency of the visual pulse pipeline (bridge → render → display). */
  visualLatencyMs: number;
  /** Estimated latency of the haptic pipeline (bridge → motor spin-up). */
  hapticLatencyMs: number;
  /** Fire the visual cue this many ms relative to the audible beat event so it LANDS
   *  with the click (negative = must fire early — needs anchor scheduling, Stage B). */
  visualLeadMs: number;
  /** Same for haptics. */
  hapticLeadMs: number;
  /** What the performer is actually playing to, given the active cue outputs. */
  referenceModality: CueReferenceModality;
  /** ms to add to the record-through head trim so the saved file's t=0 is the beat as
   *  the performer PERCEIVED it, as stamped by the mic. */
  recordingCorrectionMs: number;
  sources: {
    output: LatencySource;
    input: LatencySource;
  };
};

/** Above this an OS-reported output latency is either buffer-inflated or garbage. */
const MAX_PLAUSIBLE_OUTPUT_LATENCY_MS = 600;
const MAX_PLAUSIBLE_INPUT_LATENCY_MS = 600;

/** Bridge → React render → display scan-out for the visual pulse. Perceptual default —
 *  refined per-device later; an error here only skews cue feel, never saved audio when
 *  an audible reference exists. */
const VISUAL_PIPELINE_LATENCY_MS = 50;

/** Bridge → vibrator motor spin-up. LRA motors (iPhones) are quick; Android ERM motors
 *  and their vibrator services are slower. */
const HAPTIC_PIPELINE_LATENCY_MS = Platform.OS === "ios" ? 35 : 60;

/**
 * Sanitize a raw OS-reported output latency. Android's hidden AudioTrack#getLatency on a
 * MODE_STATIC loop folds the track's whole buffer (one bar) into the number — strip it
 * when the value is clearly buffer-inflated. Anything still implausible is unknown, and
 * unknown MUST resolve to 0: a wrong correction is worse than none.
 */
export function sanitizeOsOutputLatencyMs(
  rawOutputMs: number | null | undefined,
  clickLoopBarMs: number | null
): { outputMs: number; source: LatencySource } {
  let value = typeof rawOutputMs === "number" && rawOutputMs > 0 ? rawOutputMs : 0;
  if (
    value > MAX_PLAUSIBLE_OUTPUT_LATENCY_MS &&
    clickLoopBarMs != null &&
    clickLoopBarMs > 0 &&
    value > clickLoopBarMs
  ) {
    value -= clickLoopBarMs;
  }
  if (value > 0 && value <= MAX_PLAUSIBLE_OUTPUT_LATENCY_MS) {
    return { outputMs: value, source: "os" };
  }
  return { outputMs: 0, source: "unknown" };
}

export type ResolveRouteLatencyProfileArgs = {
  /** The active monitoring output route ({name, type}), null when unknown. */
  route: { name: string; type: string } | null;
  /** Raw OS-reported latency (getCurrentAudioRouteLatencyMs result), null when absent. */
  osLatency: { outputMs?: number; inputMs?: number } | null;
  /** Saved BT ear-calibrations. */
  calibrations: BluetoothMonitoringCalibration[];
  /** Cue outputs active for the take/preview. */
  activeOutputs: Pick<MetronomeOutputs, "beep" | "visual" | "haptic">;
  /** Bar duration of the RUNNING click loop (for the Android buffer-strip), null when
   *  the metronome isn't running or the value is unknown. */
  clickLoopBarMs?: number | null;
};

export function resolveRouteLatencyProfile({
  route,
  osLatency,
  calibrations,
  activeOutputs,
  clickLoopBarMs = null,
}: ResolveRouteLatencyProfileArgs): RouteLatencyProfile {
  const sanitizedOutput = sanitizeOsOutputLatencyMs(osLatency?.outputMs, clickLoopBarMs);

  // Bluetooth: the ear calibration measured the whole audible path on this exact
  // headphone — it beats OS reports (which on Android BT often exclude the sink buffer).
  let outputMs = sanitizedOutput.outputMs;
  let outputSource = sanitizedOutput.source;
  if (route && isBluetoothLikeAudioDevice(route)) {
    const routeKey = buildBluetoothMonitoringRouteKey(route);
    const calibration = getBluetoothMonitoringCalibrationForRoute(calibrations, routeKey);
    if (calibration && calibration.offsetMs > outputMs) {
      outputMs = calibration.offsetMs;
      outputSource = "calibration";
    }
  }

  const rawInputMs = typeof osLatency?.inputMs === "number" ? osLatency.inputMs : 0;
  const inputKnown = rawInputMs > 0 && rawInputMs <= MAX_PLAUSIBLE_INPUT_LATENCY_MS;
  const inputMs = inputKnown ? rawInputMs : 0;

  // The performer's reference: what they're most likely locking to among active cues.
  const referenceModality: CueReferenceModality = activeOutputs.beep
    ? "audible"
    : activeOutputs.haptic
      ? "haptic"
      : activeOutputs.visual
        ? "visual"
        : "none";

  // Perceived-beat latency of the reference — this is what the head trim must add so the
  // saved file's t=0 is the beat as the performer experienced (and the mic stamped) it.
  const perceivedBeatLatencyMs =
    referenceModality === "audible"
      ? outputMs
      : referenceModality === "haptic"
        ? HAPTIC_PIPELINE_LATENCY_MS
        : referenceModality === "visual"
          ? VISUAL_PIPELINE_LATENCY_MS
          : 0;

  return {
    outputMs,
    inputMs,
    visualLatencyMs: VISUAL_PIPELINE_LATENCY_MS,
    hapticLatencyMs: HAPTIC_PIPELINE_LATENCY_MS,
    visualLeadMs: outputMs - VISUAL_PIPELINE_LATENCY_MS,
    hapticLeadMs: outputMs - HAPTIC_PIPELINE_LATENCY_MS,
    referenceModality,
    recordingCorrectionMs: perceivedBeatLatencyMs + inputMs,
    sources: {
      output: outputSource,
      input: inputKnown ? "os" : "unknown",
    },
  };
}

/**
 * Convenience: query the native module for the live route + OS latency and resolve the
 * profile in one call. Safe on binaries lacking the native functions (falls back to an
 * all-unknown profile).
 */
export async function resolveCurrentRouteLatencyProfile(args: {
  calibrations: BluetoothMonitoringCalibration[];
  activeOutputs: Pick<MetronomeOutputs, "beep" | "visual" | "haptic">;
  clickLoopBarMs?: number | null;
}): Promise<RouteLatencyProfile> {
  const [route, osLatency] = await Promise.all([
    SongseedMetronomeModule?.getCurrentAudioOutputRoute?.().catch(() => null) ??
      Promise.resolve(null),
    SongseedMetronomeModule?.getCurrentAudioRouteLatencyMs?.().catch(() => null) ??
      Promise.resolve(null),
  ]);

  return resolveRouteLatencyProfile({
    route: route ?? null,
    osLatency: osLatency ?? null,
    calibrations: args.calibrations,
    activeOutputs: args.activeOutputs,
    clickLoopBarMs: args.clickLoopBarMs ?? null,
  });
}

export function formatLatencyProfileLog(profile: RouteLatencyProfile) {
  return (
    `out=${Math.round(profile.outputMs)}ms(${profile.sources.output}) ` +
    `in=${Math.round(profile.inputMs)}ms(${profile.sources.input}) ` +
    `ref=${profile.referenceModality} → correction ${Math.round(profile.recordingCorrectionMs)}ms`
  );
}

// Re-exported so callers annotating persisted grids don't need a second import.
export type { RecordingGridSource };
