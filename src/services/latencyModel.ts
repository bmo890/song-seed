import { Platform } from "react-native";
import SongseedMetronomeModule from "../../modules/songseed-metronome";
import {
  getBluetoothMonitoringCalibrationForRoute,
  buildBluetoothMonitoringRouteKey,
  isBluetoothLikeAudioDevice,
} from "../domain/bluetoothMonitoring";
import type { BluetoothMonitoringCalibration, RecordingGridSource } from "../types";
import type { MetronomeOutputs } from "../domain/metronome";

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
  /** Audible latency of the METRONOME CLICK pipeline (raw audio track → transducer).
   *  This is the reference for cue leads and grid-referenced trims. */
  outputMs: number;
  /** Audible latency of the MEDIA PLAYER pipeline (guide/master playback). ExoPlayer
   *  buffering makes it substantially larger than the click path on many devices —
   *  device logs showed ~500ms player vs ~200ms click on Samsung + AirPods. */
  guidePlayerOutputMs: number;
  /** Start the guide this many ms EARLY (relative to the render-domain grid target) so
   *  its sound reaches the ear together with the click's. max(0, player − click). */
  guideStartAdvanceMs: number;
  /** Per-connection BT drift applied to the ear calibration (current OS report minus the
   *  calibration-time OS report). 0 when unknown or not on BT. */
  btDriftMs: number;
  /** True when drift was actually measurable (OS report present now AND stamped at
   *  calibration time) — distinguishes a genuine 0 from "couldn't measure". */
  btDriftKnown: boolean;
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

  // Two audible pipelines, calibrated separately: the tap test's player pass measures the
  // media-player path (offsetMs); its click pass measures the metronome path
  // (clickOffsetMs). Legacy calibrations only carry offsetMs — for the click path prefer
  // the OS report then, since applying a player-pipeline number to the click was exactly
  // the failure device testing exposed (550ms cue leads against a ~200ms click).
  let outputMs = sanitizedOutput.outputMs;
  let outputSource = sanitizedOutput.source;
  let guidePlayerOutputMs = sanitizedOutput.outputMs;
  let btDriftMs = 0;
  let btDriftKnown = false;
  if (route && isBluetoothLikeAudioDevice(route)) {
    const routeKey = buildBluetoothMonitoringRouteKey(route);
    const calibration = getBluetoothMonitoringCalibrationForRoute(calibrations, routeKey);
    if (calibration) {
      // BT sink latency renegotiates per connection. When both the calibration-time and
      // current OS reports are known, the difference is exactly that drift — apply the
      // ear-measured numbers as a bias on top of it, so a calibration taken during one
      // connection stays valid in the next instead of needing a re-run per session.
      if (
        sanitizedOutput.source === "os" &&
        calibration.osOutputAtCalibrationMs != null &&
        calibration.osOutputAtCalibrationMs > 0
      ) {
        btDriftMs = sanitizedOutput.outputMs - calibration.osOutputAtCalibrationMs;
        btDriftKnown = true;
      }
      const driftedPlayerMs = Math.max(0, Math.min(1000, calibration.offsetMs + btDriftMs));
      guidePlayerOutputMs = Math.max(guidePlayerOutputMs, driftedPlayerMs);
      if (calibration.clickOffsetMs != null && calibration.clickOffsetMs > 0) {
        outputMs = Math.max(0, Math.min(1000, calibration.clickOffsetMs + btDriftMs));
        outputSource = "calibration";
      } else if (outputMs === 0 && calibration.offsetMs > 0) {
        // No click measurement and no OS report: the player number is a better guess
        // than zero, but it is a guess — keep the source honest.
        outputMs = calibration.offsetMs;
        outputSource = "calibration";
      }
    }
  }
  guidePlayerOutputMs = Math.max(guidePlayerOutputMs, outputMs);

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
    guidePlayerOutputMs,
    guideStartAdvanceMs: Math.max(0, guidePlayerOutputMs - outputMs),
    btDriftMs,
    btDriftKnown,
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
    `click=${Math.round(profile.outputMs)}ms(${profile.sources.output}) ` +
    `player=${Math.round(profile.guidePlayerOutputMs)}ms ` +
    `guideAdvance=${Math.round(profile.guideStartAdvanceMs)}ms ` +
    (profile.btDriftKnown || profile.btDriftMs !== 0
      ? `btDrift=${Math.round(profile.btDriftMs)}ms `
      : "") +
    `in=${Math.round(profile.inputMs)}ms(${profile.sources.input}) ` +
    `ref=${profile.referenceModality} → correction ${Math.round(profile.recordingCorrectionMs)}ms`
  );
}

// Re-exported so callers annotating persisted grids don't need a second import.
export type { RecordingGridSource };
