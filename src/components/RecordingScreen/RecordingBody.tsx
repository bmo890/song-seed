import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { AudioAnalysis } from "@siteed/audio-studio";
import type { SongIdea } from "../../types";
import { styles } from "../../styles";
import { getLatestLyricsVersion } from "../../lyrics";
import { RecordingMeta } from "./RecordingMeta";
import { RecordingLyricsSection } from "./RecordingLyricsSection";
import { RecordingOverdubGuide } from "./RecordingOverdubGuide";

type RecordingBodyProps = {
  recordingIdea: SongIdea | null | undefined;
  recordingOverdubClip?: SongIdea["clips"][number] | null;
  guideMixIsPlaying: boolean;
  guideMixPositionMs: number;
  guideMixDurationMs: number;
  guideMixWaveformPeaks?: number[];
  isBluetoothRecordingInput: boolean;
  isBluetoothMonitoringOutput: boolean;
  recordingInputLabel: string | null;
  monitoringOutputLabel: string | null;
  activeBluetoothCalibrationMs: number | null;
  hasProjectLyrics: boolean;
  latestLyricsText: string;
  latestLyricsUpdatedAt: number | null;
  lyricsExpanded: boolean;
  lyricsAutoscrollMode: "off" | "follow" | "manual";
  lyricsAutoscrollSpeedMultiplier: number;
  isRecording: boolean;
  isPaused: boolean;
  elapsedMs: number;
  isCountIn: boolean;
  countInBars: number;
  countInCurrentBar: number;
  countInCurrentBeat: number;
  countInBeatsPerBar: number;
  guideJoin?: { joinAtEpochMs: number; beatMs: number } | null;
  waveformData?: Pick<AudioAnalysis, "dataPoints" | "segmentDurationMs">;
  metronomeEnabled: boolean;
  metronomeSummary: string;
  metronomeToggleDisabled?: boolean;
  onToggleMetronome?: () => void;
  onOpenMetronome: () => void;
  onToggleLyricsExpanded: (value: boolean) => void;
  onToggleLyricsAutoscroll: (enabled: boolean) => void;
  onLyricsAutoscrollInterrupted: () => void;
  onSelectLyricsAutoscrollSpeedMultiplier: (value: number) => void;
  onOpenBluetoothCalibration: () => void;
};

export function RecordingBody({
  recordingIdea,
  recordingOverdubClip,
  guideMixIsPlaying,
  guideMixPositionMs,
  guideMixDurationMs,
  guideMixWaveformPeaks,
  isBluetoothRecordingInput,
  isBluetoothMonitoringOutput,
  recordingInputLabel,
  monitoringOutputLabel,
  activeBluetoothCalibrationMs,
  hasProjectLyrics,
  latestLyricsText,
  latestLyricsUpdatedAt,
  lyricsExpanded,
  lyricsAutoscrollMode,
  lyricsAutoscrollSpeedMultiplier,
  isRecording,
  isPaused,
  elapsedMs,
  isCountIn,
  countInBars,
  countInCurrentBar,
  countInCurrentBeat,
  countInBeatsPerBar,
  guideJoin,
  waveformData,
  metronomeEnabled,
  metronomeSummary,
  metronomeToggleDisabled,
  onToggleMetronome,
  onOpenMetronome,
  onToggleLyricsExpanded,
  onToggleLyricsAutoscroll,
  onLyricsAutoscrollInterrupted,
  onSelectLyricsAutoscrollSpeedMultiplier,
  onOpenBluetoothCalibration,
}: RecordingBodyProps) {
  const bodyContent = (
      <View
        style={[
          styles.recordingContentBody,
          hasProjectLyrics && !lyricsExpanded ? styles.recordingContentBodyCollapsedLyrics : null,
        ]}
      >
        {isBluetoothMonitoringOutput ? (
          <View style={styles.recordingBluetoothWarning}>
            <Text style={styles.recordingBluetoothWarningLabel}>Bluetooth monitoring detected</Text>
            <Text style={styles.recordingBluetoothWarningText}>
              {monitoringOutputLabel
                ? `${monitoringOutputLabel} may add enough delay to make recording cues feel late. Wired headphones are recommended.`
                : "Wireless audio may add enough delay to make recording cues feel late. Wired headphones are recommended."}
            </Text>
            <Text style={styles.recordingBluetoothWarningMeta}>
              {activeBluetoothCalibrationMs != null
                ? `Applied monitoring offset: ${activeBluetoothCalibrationMs} ms${
                    monitoringOutputLabel ? ` on ${monitoringOutputLabel}` : ""
                  }.`
                : "No saved Bluetooth monitoring offset is applied yet."}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.recordingBluetoothWarningButton,
                pressed ? styles.pressDown : null,
              ]}
              onPress={onOpenBluetoothCalibration}
            >
              <Text style={styles.recordingBluetoothWarningButtonText}>
                {activeBluetoothCalibrationMs != null
                  ? `Recalibrate (${activeBluetoothCalibrationMs} ms)`
                  : "Calibrate Bluetooth"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {recordingOverdubClip ? (
          <>
            <RecordingOverdubGuide
              title={recordingOverdubClip.title}
              durationMs={guideMixDurationMs}
              positionMs={guideMixPositionMs}
              isPlaying={guideMixIsPlaying}
              waveformPeaks={guideMixWaveformPeaks}
              sections={recordingOverdubClip.sections}
              practiceMarkers={recordingOverdubClip.practiceMarkers}
              layerLanes={(recordingOverdubClip.overdub?.stems ?? []).map((stem) => ({
                id: stem.id,
                offsetMs: stem.offsetMs,
                durationMs: stem.durationMs ?? 0,
              }))}
            />
          </>
        ) : null}

        <RecordingMeta
          ideaTitle={recordingOverdubClip ? `Layer on ${recordingOverdubClip.title}` : ""}
          isRecording={isRecording}
          isPaused={isPaused}
          elapsedMs={elapsedMs}
          isCountIn={isCountIn}
          countInBars={countInBars}
          countInCurrentBar={countInCurrentBar}
          countInCurrentBeat={countInCurrentBeat}
          countInBeatsPerBar={countInBeatsPerBar}
          guideJoin={guideJoin}
          waveformData={waveformData}
          compact={lyricsExpanded}
          fill={!lyricsExpanded}
          hasLyrics={hasProjectLyrics}
          metronomeEnabled={metronomeEnabled}
          metronomeSummary={metronomeSummary}
          metronomeToggleDisabled={metronomeToggleDisabled}
          onToggleMetronome={onToggleMetronome}
          onOpenMetronome={onOpenMetronome}
        />

        {hasProjectLyrics && latestLyricsUpdatedAt !== null ? (
          (() => {
            const recLines =
              (recordingIdea?.kind === "project"
                ? getLatestLyricsVersion(recordingIdea)?.document.lines
                : null) ?? [];
            const recChordLines = recLines.some((line) => line.chords.length > 0) ? recLines : undefined;
            return (
          <RecordingLyricsSection
            text={latestLyricsText}
            chordLines={recChordLines}
            versionCount={recordingIdea?.kind === "project" ? recordingIdea.lyrics?.versions.length ?? 1 : 1}
            updatedAt={latestLyricsUpdatedAt}
            elapsedMs={elapsedMs}
            isRecording={isRecording}
            isPaused={isPaused}
            expanded={lyricsExpanded}
            autoscrollMode={lyricsAutoscrollMode}
            autoscrollSpeedMultiplier={lyricsAutoscrollSpeedMultiplier}
            onToggleExpanded={onToggleLyricsExpanded}
            onToggleAutoscroll={onToggleLyricsAutoscroll}
            onAutoscrollInterrupted={onLyricsAutoscrollInterrupted}
            onSelectAutoscrollSpeedMultiplier={onSelectLyricsAutoscrollSpeedMultiplier}
          />
            );
          })()
        ) : null}
      </View>
  );

  // Perform mode: a plain flex container (not a ScrollView) so the lyrics
  // ScrollView gets a bounded height and fills to the bottom. The outer scroll
  // is only needed for the no-lyrics / collapsed layouts.
  if (lyricsExpanded) {
    return <View style={styles.recordingPerformBody}>{bodyContent}</View>;
  }

  return (
    <ScrollView
      style={styles.recordingScroll}
      contentContainerStyle={[
        styles.recordingScrollContent,
        hasProjectLyrics && !lyricsExpanded ? styles.recordingScrollContentWithCollapsedLyrics : null,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {bodyContent}
    </ScrollView>
  );
}
