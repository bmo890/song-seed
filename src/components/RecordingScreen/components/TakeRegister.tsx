import React from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Canvas, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { runOnJS, useAnimatedReaction, useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { DataPoint } from "@siteed/audio-studio";
import { colors } from "../../../design/tokens";
import { REEL_SURFACE_COLOR } from "../../common/AudioReel";
import { getActiveRecordingTakeSession, useTakeLiveWaveform } from "../../../services/recordingTakeSession";

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

/** Buckets on the capture clock (so bars don't reshuffle as audio arrives), each the
 *  loudest of its segments. Returns [ageMs of the bucket's start, height 0..1]. */
export function takeBars(points: DataPoint[], captureNowMs: number, msPerBar: number): [number, number][] {
  if (!(msPerBar > 0) || points.length === 0) return [];
  const buckets = new Map<number, number>();
  for (const point of points) {
    const start = point.startTime ?? 0;
    const key = Math.floor(start / msPerBar);
    const height = barScale(point);
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
  const path = React.useMemo(() => {
    const built = Skia.Path.Make();
    for (const [ageMs, scale] of takeBars(points, captureNowMs, msPerBar)) {
      const x = -ageMs * pxPerMs;
      const h = Math.max(1, scale * half);
      built.addRect(Skia.XYWHRect(x, mid - h, BAR_PX, h * 2));
    }
    return built;
  }, [points, captureNowMs, msPerBar, pxPerMs, half, mid]);

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
