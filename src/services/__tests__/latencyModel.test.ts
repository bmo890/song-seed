jest.mock("../../../modules/songseed-metronome", () => ({
  __esModule: true,
  default: null,
}));

import {
  resolveRouteLatencyProfile,
  sanitizeOsOutputLatencyMs,
} from "../latencyModel";
import type { BluetoothMonitoringCalibration } from "../../types";

const SPEAKER = { name: "Built-in speaker", type: "speaker" };
const BT_BUDS = { name: "WH-1000XM5", type: "bluetooth" };

const ALL_CUES = { beep: true, visual: true, haptic: true };
const HAPTIC_ONLY = { beep: false, visual: false, haptic: true };
const VISUAL_ONLY = { beep: false, visual: true, haptic: false };
const NO_CUES = { beep: false, visual: false, haptic: false };

function btCalibration(offsetMs: number, clickOffsetMs?: number): BluetoothMonitoringCalibration {
  return {
    routeKey: "bluetooth:wh-1000xm5",
    routeLabel: "WH-1000XM5",
    offsetMs,
    clickOffsetMs,
    updatedAt: 1,
  };
}

describe("sanitizeOsOutputLatencyMs", () => {
  it("passes plausible values through as os-sourced", () => {
    expect(sanitizeOsOutputLatencyMs(108, null)).toEqual({ outputMs: 108, source: "os" });
  });

  it("strips the click-loop bar from buffer-inflated Android values", () => {
    // Device log case: 2142ms reported = 2034ms bar buffer + 108ms real sink latency.
    expect(sanitizeOsOutputLatencyMs(2142, 2034)).toEqual({ outputMs: 108, source: "os" });
  });

  it("treats implausible values with no bar to strip as unknown", () => {
    expect(sanitizeOsOutputLatencyMs(2142, null)).toEqual({ outputMs: 0, source: "unknown" });
  });

  it("treats still-implausible values after stripping as unknown", () => {
    expect(sanitizeOsOutputLatencyMs(5000, 2034)).toEqual({ outputMs: 0, source: "unknown" });
  });

  it("treats missing/zero as unknown", () => {
    expect(sanitizeOsOutputLatencyMs(null, 2034).source).toBe("unknown");
    expect(sanitizeOsOutputLatencyMs(0, 2034).source).toBe("unknown");
  });
});

describe("resolveRouteLatencyProfile", () => {
  it("audible reference on speaker: correction = output + input", () => {
    const profile = resolveRouteLatencyProfile({
      route: SPEAKER,
      osLatency: { outputMs: 108, inputMs: 25 },
      calibrations: [],
      activeOutputs: ALL_CUES,
    });
    expect(profile.referenceModality).toBe("audible");
    expect(profile.outputMs).toBe(108);
    expect(profile.inputMs).toBe(25);
    expect(profile.recordingCorrectionMs).toBe(133);
    expect(profile.sources).toEqual({ output: "os", input: "os" });
  });

  it("splits pipelines: click pass drives outputMs, player pass drives the guide", () => {
    // Device-log case: click path ~200ms (raw track), player path ~500ms (ExoPlayer).
    const profile = resolveRouteLatencyProfile({
      route: BT_BUDS,
      osLatency: { outputMs: 180 },
      calibrations: [btCalibration(500, 200)],
      activeOutputs: ALL_CUES,
    });
    expect(profile.outputMs).toBe(200);
    expect(profile.sources.output).toBe("calibration");
    expect(profile.guidePlayerOutputMs).toBe(500);
    expect(profile.guideStartAdvanceMs).toBe(300);
    // Cues and trims reference the CLICK path, never the player path.
    expect(profile.recordingCorrectionMs).toBe(200);
  });

  it("legacy calibration (player-only): OS report keeps the click path honest", () => {
    const profile = resolveRouteLatencyProfile({
      route: BT_BUDS,
      osLatency: { outputMs: 180 },
      calibrations: [btCalibration(500)],
      activeOutputs: ALL_CUES,
    });
    expect(profile.outputMs).toBe(180);
    expect(profile.sources.output).toBe("os");
    expect(profile.guidePlayerOutputMs).toBe(500);
    expect(profile.guideStartAdvanceMs).toBe(320);
  });

  it("legacy calibration with no OS report: player number beats zero for the click", () => {
    const profile = resolveRouteLatencyProfile({
      route: BT_BUDS,
      osLatency: null,
      calibrations: [btCalibration(220)],
      activeOutputs: ALL_CUES,
    });
    expect(profile.outputMs).toBe(220);
    expect(profile.sources.output).toBe("calibration");
    expect(profile.guideStartAdvanceMs).toBe(0);
  });

  it("an HFP (mic-active) session never consumes the A2DP calibration", () => {
    // Same headphones, but the phone-call profile is active because their mic is in use:
    // the A2DP ear numbers are wrong for this link, so the profile must fall back to the
    // OS report and flag the guide path as uncalibrated rather than apply them.
    const profile = resolveRouteLatencyProfile({
      route: { ...BT_BUDS, profile: "hfp" },
      osLatency: { outputMs: 120 },
      calibrations: [btCalibration(500, 200)],
      activeOutputs: ALL_CUES,
    });
    expect(profile.outputMs).toBe(120);
    expect(profile.sources.output).toBe("os");
    expect(profile.guidePlayerOutputMs).toBe(120);
  });

  it("ignores calibrations on non-BT routes", () => {
    const profile = resolveRouteLatencyProfile({
      route: SPEAKER,
      osLatency: { outputMs: 90 },
      calibrations: [btCalibration(220)],
      activeOutputs: ALL_CUES,
    });
    expect(profile.outputMs).toBe(90);
  });

  it("silent-click takes reference the haptic pipeline, NOT the audible route", () => {
    const profile = resolveRouteLatencyProfile({
      route: BT_BUDS,
      osLatency: { outputMs: 250 },
      calibrations: [],
      activeOutputs: HAPTIC_ONLY,
    });
    expect(profile.referenceModality).toBe("haptic");
    // Correction is the haptic pipeline latency, not the 250ms BT output latency.
    expect(profile.recordingCorrectionMs).toBe(profile.hapticLatencyMs);
    expect(profile.recordingCorrectionMs).toBeLessThan(120);
  });

  it("visual-only takes reference the visual pipeline", () => {
    const profile = resolveRouteLatencyProfile({
      route: SPEAKER,
      osLatency: { outputMs: 100, inputMs: 20 },
      calibrations: [],
      activeOutputs: VISUAL_ONLY,
    });
    expect(profile.referenceModality).toBe("visual");
    expect(profile.recordingCorrectionMs).toBe(profile.visualLatencyMs + 20);
  });

  it("no cues at all → no reference, zero correction", () => {
    const profile = resolveRouteLatencyProfile({
      route: SPEAKER,
      osLatency: { outputMs: 100 },
      calibrations: [],
      activeOutputs: NO_CUES,
    });
    expect(profile.referenceModality).toBe("none");
    expect(profile.recordingCorrectionMs).toBe(0);
  });

  it("unknown output stays 0 with an explicit unknown source (never guess)", () => {
    const profile = resolveRouteLatencyProfile({
      route: SPEAKER,
      osLatency: null,
      calibrations: [],
      activeOutputs: ALL_CUES,
    });
    expect(profile.outputMs).toBe(0);
    expect(profile.sources.output).toBe("unknown");
    expect(profile.recordingCorrectionMs).toBe(0);
  });

  it("applies per-connection BT drift as a bias on the ear calibration", () => {
    // Calibrated when the OS reported 200; this connection reports 260 → +60 drift.
    const calibration = { ...btCalibration(500, 370), osOutputAtCalibrationMs: 200 };
    const profile = resolveRouteLatencyProfile({
      route: BT_BUDS,
      osLatency: { outputMs: 260 },
      calibrations: [calibration],
      activeOutputs: ALL_CUES,
    });
    expect(profile.btDriftMs).toBe(60);
    expect(profile.outputMs).toBe(430); // 370 + 60
    expect(profile.guidePlayerOutputMs).toBe(560); // 500 + 60
  });

  it("no drift is applied when either OS report is missing", () => {
    const calibration = { ...btCalibration(500, 370), osOutputAtCalibrationMs: 200 };
    const profile = resolveRouteLatencyProfile({
      route: BT_BUDS,
      osLatency: null,
      calibrations: [calibration],
      activeOutputs: ALL_CUES,
    });
    expect(profile.btDriftMs).toBe(0);
    expect(profile.outputMs).toBe(370);
  });

  it("cue leads are signed: BT delays cues, speaker demands early fire", () => {
    const bt = resolveRouteLatencyProfile({
      route: BT_BUDS,
      osLatency: null,
      calibrations: [btCalibration(250)],
      activeOutputs: ALL_CUES,
    });
    expect(bt.visualLeadMs).toBeGreaterThan(0);
    expect(bt.hapticLeadMs).toBeGreaterThan(0);

    const speaker = resolveRouteLatencyProfile({
      route: SPEAKER,
      osLatency: { outputMs: 15 },
      calibrations: [],
      activeOutputs: ALL_CUES,
    });
    // Cue pipelines are slower than a 15ms speaker: the cue must fire EARLY.
    expect(speaker.visualLeadMs).toBeLessThan(0);
    expect(speaker.hapticLeadMs).toBeLessThan(0);
  });
});
