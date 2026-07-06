import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ensureWaveformSidecar } from "../../../services/waveformSidecar";
import { formatClipOverdubStemOffsetLabel } from "../../../overdub";
import { fmtDuration } from "../../../utils";
import { getMetronomeMeterPreset } from "../../../metronome";
import type { RecordingGrid } from "../../../types";

/**
 * Superimposed master + stem waveforms on one shared time axis, with the stem shifted by
 * its live offset — makes nudges visible instead of ear-only. Two zoom levels: the full
 * clip for coarse placement, and the first few seconds (where the downbeat lives) where a
 * 10–25 ms nudge actually moves pixels. Detail peaks come from the self-healing waveform
 * sidecars; the inline thumbnails are the fallback while they load.
 */

const DISPLAY_BARS = 72;
const BAR_WIDTH = 3;
const BAR_GAP = 1;
const CONTENT_WIDTH = DISPLAY_BARS * BAR_WIDTH + (DISPLAY_BARS - 1) * BAR_GAP;
const VIEW_HEIGHT = 46;
const MASTER_AMPLITUDE = 40;
const STEM_AMPLITUDE = 26;
const ZOOM_WINDOW_MS = 4000;
/** Above this many ticks the grid is visual noise — thin it out (or drop it). */
const MAX_GRID_TICKS = 96;

type Props = {
  masterAudioUri: string | null;
  masterDurationMs: number;
  masterFallbackPeaks?: number[];
  stemAudioUri: string | null;
  stemDurationMs: number;
  stemFallbackPeaks?: number[];
  offsetMs: number;
  /** This layer's color key — drives its waveform bars and legend swatch, so the
   *  overlay reads as "this specific layer" rather than one generic terracotta stem. */
  stemColor: string;
  /** The MASTER's beat grid. Ticks are drawn only when its downbeat anchor was actually
   *  measured (firstDownbeatMs != null) — never guessed onto the timeline. */
  recordingGrid?: RecordingGrid | null;
};

/** Max of `peaks` over the time range [fromMs, toMs) of an audio lasting durationMs. */
function samplePeakRange(peaks: number[], durationMs: number, fromMs: number, toMs: number) {
  if (!peaks.length || durationMs <= 0 || toMs <= 0 || fromMs >= durationMs) {
    return 0;
  }
  const startIndex = Math.max(0, Math.floor((fromMs / durationMs) * peaks.length));
  const endIndex = Math.min(peaks.length, Math.max(startIndex + 1, Math.ceil((toMs / durationMs) * peaks.length)));
  let max = 0;
  for (let cursor = startIndex; cursor < endIndex; cursor += 1) {
    max = Math.max(max, peaks[cursor] ?? 0);
  }
  return max;
}

function useDetailPeaks(audioUri: string | null, fallbackPeaks?: number[]) {
  const [detailPeaks, setDetailPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetailPeaks(null);
    if (!audioUri) {
      return;
    }
    void ensureWaveformSidecar(audioUri)
      .then((peaks) => {
        if (!cancelled && peaks?.length) {
          setDetailPeaks(peaks);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [audioUri]);

  return detailPeaks ?? fallbackPeaks ?? [];
}

export function StemAlignmentOverlay({
  masterAudioUri,
  masterDurationMs,
  masterFallbackPeaks,
  stemAudioUri,
  stemDurationMs,
  stemFallbackPeaks,
  offsetMs,
  stemColor,
  recordingGrid,
}: Props) {
  const [zoomed, setZoomed] = useState(true);
  const masterPeaks = useDetailPeaks(masterAudioUri, masterFallbackPeaks);
  const stemPeaks = useDetailPeaks(stemAudioUri, stemFallbackPeaks);

  // Timeline t=0 is the master's start. The stem occupies [offsetMs, offsetMs + stemDur];
  // a negative offset drops the stem's head (mirrors the mixers' behavior).
  const fullTimelineMs = Math.max(masterDurationMs, offsetMs + stemDurationMs, 1);
  // The zoom window follows the LAYER, not the top of the song — a punched-in layer at
  // 1:23 zooms to 1:23 (with a second of master context in front), so the nudge view
  // always shows the layer against the master around it.
  const zoomStartMs = zoomed
    ? Math.max(0, Math.min(offsetMs - 1000, fullTimelineMs - ZOOM_WINDOW_MS))
    : 0;
  const timelineMs = zoomed ? Math.min(ZOOM_WINDOW_MS, fullTimelineMs - zoomStartMs) : fullTimelineMs;

  const bars = useMemo(() => {
    if (masterDurationMs <= 0 && stemDurationMs <= 0) {
      return [];
    }
    const barDurationMs = timelineMs / DISPLAY_BARS;

    return Array.from({ length: DISPLAY_BARS }, (_, index) => {
      const fromMs = zoomStartMs + index * barDurationMs;
      const toMs = fromMs + barDurationMs;
      return {
        master: samplePeakRange(masterPeaks, masterDurationMs, fromMs, toMs),
        stem: samplePeakRange(stemPeaks, stemDurationMs, fromMs - offsetMs, toMs - offsetMs),
      };
    });
  }, [masterDurationMs, masterPeaks, offsetMs, stemDurationMs, stemPeaks, timelineMs, zoomStartMs]);

  // Beat-grid ticks on the master's timeline: downbeats accented, other beats faint.
  // Density-limited — all beats when they fit, downbeats only when bars fit, then every
  // Nth bar. Anchored at the measured first downbeat, never at an assumed zero.
  const gridTicks = useMemo(() => {
    if (!recordingGrid || recordingGrid.firstDownbeatMs == null || recordingGrid.bpm <= 0) {
      return [];
    }
    const beatMs = 60000 / recordingGrid.bpm;
    const pulsesPerBar = Math.max(1, getMetronomeMeterPreset(recordingGrid.meterId).pulsesPerBar);
    const anchorMs = recordingGrid.firstDownbeatMs;

    const totalBeatsInView = Math.floor(timelineMs / beatMs) + 1;
    const totalBarsInView = totalBeatsInView / pulsesPerBar;
    const drawEveryBeat = totalBeatsInView <= MAX_GRID_TICKS;
    const barStep = drawEveryBeat ? 1 : Math.max(1, Math.ceil(totalBarsInView / MAX_GRID_TICKS));

    const ticks: { leftPx: number; isDownbeat: boolean }[] = [];
    const viewEndMs = zoomStartMs + timelineMs;
    // Cover pickup space before the anchor too (beats extend backwards to the view start).
    const firstBeatIndex = Math.floor((zoomStartMs - anchorMs) / beatMs);
    for (let beatIndex = firstBeatIndex; ; beatIndex += 1) {
      const timeMs = anchorMs + beatIndex * beatMs;
      if (timeMs > viewEndMs) {
        break;
      }
      if (timeMs < zoomStartMs || timeMs < 0) {
        continue;
      }
      const isDownbeat = ((beatIndex % pulsesPerBar) + pulsesPerBar) % pulsesPerBar === 0;
      if (!drawEveryBeat) {
        if (!isDownbeat) {
          continue;
        }
        const barIndex = Math.round(beatIndex / pulsesPerBar);
        if (((barIndex % barStep) + barStep) % barStep !== 0) {
          continue;
        }
      }
      ticks.push({ leftPx: ((timeMs - zoomStartMs) / timelineMs) * CONTENT_WIDTH, isDownbeat });
      if (ticks.length > MAX_GRID_TICKS) {
        break;
      }
    }
    return ticks;
  }, [recordingGrid, timelineMs, zoomStartMs]);

  if (!bars.length) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.legend}>
          <Text style={styles.legendMaster}>▮ master</Text>
          {"   "}
          <Text style={{ color: stemColor }}>▮ this layer</Text>
          {"   "}
          {formatClipOverdubStemOffsetLabel(offsetMs)}
          {gridTicks.length > 0 && recordingGrid ? `   · ${recordingGrid.bpm} BPM grid` : ""}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.zoomChip, pressed ? styles.pressed : null]}
          onPress={() => setZoomed((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={zoomed ? "Show the full clip" : "Zoom to this layer"}
        >
          <Text style={styles.zoomChipText}>
            {zoomed
              ? zoomStartMs > 0
                ? `At ${fmtDuration(offsetMs)}`
                : `First ${ZOOM_WINDOW_MS / 1000}s`
              : "Full clip"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.stage}>
        <View style={styles.content}>
          {gridTicks.map((tick, index) => (
            <View
              key={`grid-tick-${index}`}
              style={[
                tick.isDownbeat ? styles.downbeatTick : styles.beatTick,
                { left: tick.leftPx },
              ]}
            />
          ))}
          {bars.map((bar, index) => {
            const masterHeight = 3 + Math.max(0.05, Math.min(1, bar.master)) * MASTER_AMPLITUDE;
            const stemHeight = bar.stem > 0 ? 3 + Math.min(1, bar.stem) * STEM_AMPLITUDE : 0;
            return (
              <View key={`align-bar-${index}`} style={styles.column}>
                <View style={[styles.masterBar, { height: masterHeight }]} />
                {stemHeight > 0 ? (
                  <View
                    style={[
                      styles.stemBar,
                      {
                        height: stemHeight,
                        top: (VIEW_HEIGHT - stemHeight) / 2,
                        backgroundColor: stemColor,
                      },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  legend: {
    fontSize: 11,
    color: "#84736f",
  },
  legendMaster: {
    color: "#b5a89f",
  },
  zoomChip: {
    borderRadius: 4,
    backgroundColor: "#efeae4",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  zoomChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5a4b45",
  },
  pressed: {
    opacity: 0.7,
  },
  stage: {
    height: VIEW_HEIGHT,
    borderRadius: 4,
    backgroundColor: "#F7F4F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Fixed-width inner canvas: bars AND grid ticks share the same time→pixel mapping.
  content: {
    width: CONTENT_WIDTH,
    height: VIEW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: BAR_GAP,
  },
  beatTick: {
    position: "absolute",
    top: 8,
    bottom: 8,
    width: 1,
    backgroundColor: "#c8b8ac",
    opacity: 0.55,
  },
  downbeatTick: {
    position: "absolute",
    top: 2,
    bottom: 2,
    width: 1,
    backgroundColor: "#8a6f5f",
    opacity: 0.75,
  },
  column: {
    width: BAR_WIDTH,
    height: VIEW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  masterBar: {
    width: BAR_WIDTH,
    borderRadius: 2,
    backgroundColor: "#d8cec6",
  },
  stemBar: {
    position: "absolute",
    width: BAR_WIDTH,
    borderRadius: 2,
    opacity: 0.9,
  },
});
