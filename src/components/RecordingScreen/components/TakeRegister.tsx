import React from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Canvas, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { runOnJS, useAnimatedReaction, useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { DataPoint } from "@siteed/audio-studio";
import { colors } from "../../../design/tokens";
import { REEL_SURFACE_COLOR } from "../../common/AudioReel";
import {
  getActiveRecordingTakeSession,
  RECORDING_TAKE_SHAPE,
  useTakeLiveWaveform,
} from "../../../services/recordingTakeSession";

/**
 * The lower register of the one reel (founder, 2026-10-22: "make it look like we are
 * actually recording on top of the main reel"). The song is the reel above; your take is
 * written here, under it, on the SAME timeline: the reel's own scale and offset place
 * every bar, so the two scroll as one tape and the take's newest bar meets the song at
 * the playhead.
 *
 * The take is addressed by age: a bar captured `a` ms ago sits `a` ms of song behind the
 * playhead. That holds while recording (both clocks run) and while paused (both hold).
 * The run-up and a count-in never reach here: the live waveform drops them
 * (`hideBeforeMs`, `retainPoints: false`).
 *
 * The live tape only holds its last 12 s, while the reel above shows far more once
 * zoomed out; the register folds every window into its own whole-take history
 * (`TakeHistory`), so the take stays written from its first bar (sweep R3, 2026-10-23).
 */

const NOISE_FLOOR_DB = -55;
/** Bars as wide as the song's above them reads as one picture. */
const BAR_PX = 3;
const GAP_PX = 2;

function barScale(point: DataPoint): number {
  const db = Number.isFinite(point.dB)
    ? point.dB
    : 20 * Math.log10(Math.max(0.00001, point.rms || point.amplitude || 0));
  const normalized = Math.min(1, Math.max(0, (db - NOISE_FLOOR_DB) / Math.abs(NOISE_FLOOR_DB)));
  return point.silent ? 0.01 : Math.max(0.02, Math.pow(normalized, 1.35));
}

/** The whole take, one loudness per tape segment, indexed by segment number on the
 *  capture clock. The live waveform drops what leaves its window; this keeps it. */
export type TakeHistory = { segmentMs: number; heights: number[]; lastNowMs: number };

export function createTakeHistory(segmentMs: number): TakeHistory {
  return { segmentMs, heights: [], lastNowMs: 0 };
}

export function resetTakeHistory(history: TakeHistory) {
  history.heights = [];
  history.lastNowMs = 0;
}

/** Fold the window's points in, each segment keeping its loudest reading, so folding
 *  the same window twice changes nothing. A capture clock that went back is a new take
 *  (Redo): the old one is cleared first. */
export function foldIntoTakeHistory(history: TakeHistory, points: DataPoint[], captureNowMs: number) {
  if (captureNowMs < history.lastNowMs) resetTakeHistory(history);
  history.lastNowMs = captureNowMs;
  for (const point of points) {
    const segment = Math.floor((point.startTime ?? 0) / history.segmentMs);
    if (segment < 0) continue;
    const height = barScale(point);
    const held = history.heights[segment];
    if (held === undefined || height > held) history.heights[segment] = height;
  }
}

/** Bars on the capture clock (so they don't reshuffle as audio arrives), each the
 *  loudest of its segments; only those younger than `maxAgeMs` (the rest is off the
 *  register's left edge). Returns [ageMs of the bar's start, height 0..1]. */
export function takeBars(
  history: TakeHistory,
  captureNowMs: number,
  msPerBar: number,
  maxAgeMs = Infinity
): [number, number][] {
  const { heights, segmentMs } = history;
  if (!(msPerBar > 0) || heights.length === 0) return [];
  const first = Math.max(0, Math.floor((captureNowMs - maxAgeMs - msPerBar) / segmentMs));
  const buckets = new Map<number, number>();
  for (let segment = first; segment < heights.length; segment += 1) {
    const height = heights[segment];
    if (height === undefined) continue;
    const key = Math.floor((segment * segmentMs) / msPerBar);
    const held = buckets.get(key);
    if (held == null || height > held) buckets.set(key, height);
  }
  const bars: [number, number][] = [];
  for (const [key, height] of buckets) bars.push([captureNowMs - key * msPerBar, height]);
  return bars;
}

type Props = {
  height: number;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  /** The song position the reel's playhead stands on. */
  sharedSongMs: SharedValue<number>;
  /** Where the layer starts on the song; 0 = the top. */
  startMs: number;
  /** A take exists (recording, paused, or awaiting its name). */
  active: boolean;
  recording: boolean;
  /** Pins dropped in this take, capture ms. */
  pins?: number[];
  /** Laid over the register's corner (the pin key). */
  children?: React.ReactNode;
};

export function TakeRegister({
  height,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  sharedSongMs,
  startMs,
  active,
  recording,
  pins,
  children,
}: Props) {
  const waveform = useTakeLiveWaveform(getActiveRecordingTakeSession());
  const [width, setWidth] = React.useState(0);
  // The reel's zoom is fixed while a layer records; follow it anyway (set from the
  // reaction, never read in render).
  const [zoom, setZoom] = React.useState(1);
  useAnimatedReaction(
    () => timelineScale.value,
    (next, previous) => {
      if (previous == null || Math.abs(next - previous) > 0.001) runOnJS(setZoom)(next);
    }
  );
  const pxPerMs = pixelsPerMs * zoom;
  const msPerBar = pxPerMs > 0 ? (BAR_PX + GAP_PX) / pxPerMs : 0;
  const mid = height / 2;
  const half = Math.max(4, mid - 6);

  const captureNowMs = waveform.durationMs ?? 0;
  const points = active ? waveform.dataPoints ?? [] : [];
  const historyRef = React.useRef<TakeHistory | null>(null);
  if (!historyRef.current) historyRef.current = createTakeHistory(RECORDING_TAKE_SHAPE.segmentDurationMs);
  const history = historyRef.current;
  const path = React.useMemo(() => {
    // Folding is idempotent (each segment keeps its max), so a repeated run is harmless.
    if (active) foldIntoTakeHistory(history, points, captureNowMs);
    else resetTakeHistory(history);
    const built = Skia.Path.Make();
    const maxAgeMs = width > 0 && pxPerMs > 0 ? width / pxPerMs : Infinity;
    for (const [ageMs, scale] of takeBars(history, captureNowMs, msPerBar, maxAgeMs)) {
      const x = -ageMs * pxPerMs;
      const h = Math.max(1, scale * half);
      built.addRect(Skia.XYWHRect(x, mid - h, BAR_PX, h * 2));
    }
    return built;
  }, [active, history, points, captureNowMs, msPerBar, pxPerMs, half, mid, width]);

  const pinPath = React.useMemo(() => {
    const built = Skia.Path.Make();
    if (!active) return built;
    for (const pinMs of pins ?? []) {
      const x = -(captureNowMs - pinMs) * pxPerMs;
      built.addRect(Skia.XYWHRect(x - 0.5, 4, 1, height - 8));
    }
    return built;
  }, [active, pins, captureNowMs, pxPerMs, height]);

  // The playhead's x on the shared timeline: the newest audio sits exactly there.
  const playheadTransform = useDerivedValue(() => [
    { translateX: sharedSongMs.value * pixelsPerMs * timelineScale.value + timelineTranslateX.value },
  ]);
  const flagX = useDerivedValue(() => startMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value - 0.75);

  return (
    <View
      style={[registerStyles.wrap, { height }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      pointerEvents="box-none"
    >
      {width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Rect x={0} y={mid - 0.5} width={width} height={1} color={colors.borderMuted} />
          {startMs > 0 ? <Rect x={flagX} y={0} width={1.5} height={height} color={colors.textStrong} opacity={0.55} /> : null}
          <Group transform={playheadTransform}>
            <Path path={path} color={colors.record} opacity={recording ? 0.95 : 0.7} />
            <Path path={pinPath} color={colors.textStrong} />
            {active ? <Rect x={-1} y={0} width={2} height={height} color={colors.record} /> : null}
          </Group>
        </Canvas>
      ) : null}
      {children}
    </View>
  );
}

const registerStyles = StyleSheet.create({
  wrap: {
    backgroundColor: REEL_SURFACE_COLOR,
    overflow: "hidden",
  },
});
