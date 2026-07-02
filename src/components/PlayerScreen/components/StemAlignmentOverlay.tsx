import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ensureWaveformSidecar } from "../../../services/waveformSidecar";
import { formatClipOverdubStemOffsetLabel } from "../../../overdub";

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
const VIEW_HEIGHT = 46;
const MASTER_AMPLITUDE = 40;
const STEM_AMPLITUDE = 26;
const ZOOM_WINDOW_MS = 4000;

type Props = {
  masterAudioUri: string | null;
  masterDurationMs: number;
  masterFallbackPeaks?: number[];
  stemAudioUri: string | null;
  stemDurationMs: number;
  stemFallbackPeaks?: number[];
  offsetMs: number;
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
}: Props) {
  const [zoomed, setZoomed] = useState(true);
  const masterPeaks = useDetailPeaks(masterAudioUri, masterFallbackPeaks);
  const stemPeaks = useDetailPeaks(stemAudioUri, stemFallbackPeaks);

  const bars = useMemo(() => {
    if (masterDurationMs <= 0 && stemDurationMs <= 0) {
      return [];
    }
    // Timeline t=0 is the master's start. The stem occupies [offsetMs, offsetMs + stemDur];
    // a negative offset drops the stem's head (mirrors the mixers' behavior).
    const fullTimelineMs = Math.max(masterDurationMs, offsetMs + stemDurationMs, 1);
    const timelineMs = zoomed ? Math.min(ZOOM_WINDOW_MS, fullTimelineMs) : fullTimelineMs;
    const barDurationMs = timelineMs / DISPLAY_BARS;

    return Array.from({ length: DISPLAY_BARS }, (_, index) => {
      const fromMs = index * barDurationMs;
      const toMs = fromMs + barDurationMs;
      return {
        master: samplePeakRange(masterPeaks, masterDurationMs, fromMs, toMs),
        stem: samplePeakRange(stemPeaks, stemDurationMs, fromMs - offsetMs, toMs - offsetMs),
      };
    });
  }, [masterDurationMs, masterPeaks, offsetMs, stemDurationMs, stemPeaks, zoomed]);

  if (!bars.length) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.legend}>
          <Text style={styles.legendMaster}>▮ master</Text>
          {"   "}
          <Text style={styles.legendStem}>▮ this layer</Text>
          {"   "}
          {formatClipOverdubStemOffsetLabel(offsetMs)}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.zoomChip, pressed ? styles.pressed : null]}
          onPress={() => setZoomed((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={zoomed ? "Show the full clip" : "Zoom to the first seconds"}
        >
          <Text style={styles.zoomChipText}>{zoomed ? `First ${ZOOM_WINDOW_MS / 1000}s` : "Full clip"}</Text>
        </Pressable>
      </View>
      <View style={styles.stage}>
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
                    { height: stemHeight, top: (VIEW_HEIGHT - stemHeight) / 2 },
                  ]}
                />
              ) : null}
            </View>
          );
        })}
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
  legendStem: {
    color: "#824f3f",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: BAR_GAP,
    paddingHorizontal: 6,
    overflow: "hidden",
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
    backgroundColor: "#b4675a",
    opacity: 0.9,
  },
});
