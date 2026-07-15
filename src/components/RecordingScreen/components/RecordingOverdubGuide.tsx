import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { AudioReel } from "../../common/AudioReel";
import { OverdubLayerLanes, type OverdubLayerLane } from "../../common/OverdubLayerLanes";
import { useTransportClock } from "../../../hooks/useTransportClock";
import { buildSectionBands } from "../../../domain/playerSections";
import { fmtDuration } from "../../../utils";
import { styles } from "../../../styles";
import type { ClipSection, PracticeMarker } from "../../../types";

/**
 * The master ("guide") while recording a layer: the same smooth scrolling reel as the
 * player — section bands, pins, and existing layer lanes ride the waveform — with the
 * playhead at the guide's REAL position (a punch take opens mid-song, exactly where the
 * layer will sit). Read-only: seeking the guide mid-take would break the measured
 * alignment, so the reel is display-only here.
 */

type RecordingOverdubGuideProps = {
  title: string;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  waveformPeaks?: number[];
  sections?: ClipSection[];
  practiceMarkers?: PracticeMarker[];
  /** Already-recorded layers on this master, drawn as slim lanes under the reel. */
  layerLanes?: OverdubLayerLane[];
};

const GUIDE_FOLLOW_WINDOW_MS = 20000;

function noop() {}

export function RecordingOverdubGuide({
  title,
  durationMs,
  positionMs,
  isPlaying,
  waveformPeaks,
  sections,
  practiceMarkers,
  layerLanes,
}: RecordingOverdubGuideProps) {
  // Interpolates the 250ms-interval position updates on the UI thread — the tape glides
  // instead of stepping.
  const transportClock = useTransportClock({
    positionMs,
    durationMs,
    isPlaying,
    playbackRate: 1,
  });

  const sectionBands = useMemo(
    () => buildSectionBands(sections ?? [], durationMs),
    [sections, durationMs]
  );

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

      <View pointerEvents="none">
        <AudioReel
          waveformPeaks={waveformPeaks ?? []}
          durationMs={durationMs}
          currentTimeMs={0}
          sharedCurrentTimeMs={transportClock.sharedCurrentTimeMs}
          sharedDurationMs={transportClock.sharedDurationMs}
          sharedTransportUpdateToken={transportClock.sharedUpdateToken}
          isPlaying={isPlaying}
          sharedIsPlaying={transportClock.sharedIsPlaying}
          playbackRate={1}
          sharedPlaybackRate={transportClock.sharedPlaybackRate}
          chrome="light"
          showTransportControls={false}
          showExpandToggle={false}
          showZoomControls={false}
          showTimingRow={false}
          defaultExpanded={false}
          surfaceRadius={4}
          timelineHorizontalPadding={0}
          collapsedHeightOverride={84}
          showMinimapMode="never"
          initialZoomMultiple={durationMs > 0 ? durationMs / GUIDE_FOLLOW_WINDOW_MS : undefined}
          sectionBands={sectionBands}
          practiceMarkers={practiceMarkers}
          renderBelowSurface={({ pixelsPerMs, timelineTranslateX, timelineScale }) =>
            layerLanes && layerLanes.length > 0 ? (
              <OverdubLayerLanes
                lanes={layerLanes}
                pixelsPerMs={pixelsPerMs}
                timelineTranslateX={timelineTranslateX}
                timelineScale={timelineScale}
              />
            ) : null
          }
          onSeek={noop}
          onTogglePlay={noop}
          onSeekToStart={noop}
          onSeekToEnd={noop}
        />
      </View>
    </View>
  );
}
