import React from "react";
import { Text, View } from "react-native";
import { WaveformMiniPreview } from "../common/WaveformMiniPreview";
import { fmtDuration } from "../../utils";
import { styles } from "../../styles";

type RecordingOverdubGuideProps = {
  title: string;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  waveformPeaks?: number[];
};

export function RecordingOverdubGuide({
  title,
  durationMs,
  positionMs,
  isPlaying,
  waveformPeaks,
}: RecordingOverdubGuideProps) {
  const progressRatio =
    durationMs > 0 ? Math.max(0, Math.min(1, positionMs / durationMs)) : 0;

  return (
    <View style={styles.recordingGuideCard}>
      <View style={styles.recordingGuideHeader}>
        <View style={styles.recordingGuideCopy}>
          <Text style={styles.recordingGuideEyebrow}>Guide mix</Text>
          <Text style={styles.recordingGuideTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.recordingGuideTiming}>
          <Text style={styles.recordingGuideTimingText}>
            {fmtDuration(positionMs)} / {fmtDuration(durationMs)}
          </Text>
          <Text style={styles.recordingGuideState}>{isPlaying ? "Playing" : "Ready"}</Text>
        </View>
      </View>

      <View style={styles.recordingGuideWaveWrap}>
        <WaveformMiniPreview peaks={waveformPeaks} bars={84} />
        <View
          pointerEvents="none"
          style={[
            styles.recordingGuidePlayhead,
            { left: `${Math.max(0, Math.min(100, progressRatio * 100))}%` },
          ]}
        />
      </View>
    </View>
  );
}
