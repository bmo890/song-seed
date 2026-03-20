import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";

type WaveformMiniPreviewProps = {
  peaks?: number[];
  bars?: number;
  compact?: boolean;
};

function samplePeaks(peaks: number[], bars: number) {
  if (peaks.length <= bars) return peaks;
  const sampled: number[] = [];
  for (let index = 0; index < bars; index += 1) {
    const start = Math.floor((index / bars) * peaks.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / bars) * peaks.length));
    let max = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      max = Math.max(max, peaks[cursor] ?? 0);
    }
    sampled.push(max);
  }
  return sampled;
}

export function WaveformMiniPreview({
  peaks,
  bars = 60,
  compact = false,
}: WaveformMiniPreviewProps) {
  const sampledPeaks = useMemo(() => {
    if (!peaks?.length) return [];
    return samplePeaks(peaks, bars);
  }, [bars, peaks]);

  if (!sampledPeaks.length) {
    return <View style={[styles.placeholder, compact ? styles.placeholderCompact : null]} />;
  }

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      {sampledPeaks.map((peak, index) => {
        const normalized = Math.max(0.08, Math.min(1, peak));
        const minHeight = compact ? 3 : 4;
        const amplitude = compact ? 12 : 18;
        return (
          <View
            key={`mini-wave-${index}`}
            style={[
              styles.bar,
              {
                height: minHeight + normalized * amplitude,
                opacity: 0.35 + normalized * 0.45,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 24,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  wrapCompact: {
    height: 18,
    borderRadius: 6,
    paddingHorizontal: 5,
    gap: 1.5,
  },
  bar: {
    width: 2,
    borderRadius: 2,
    backgroundColor: "#64748b",
  },
  placeholder: {
    height: 24,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  placeholderCompact: {
    height: 18,
    borderRadius: 6,
  },
});
