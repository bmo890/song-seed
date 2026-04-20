import React from "react";
import { ScrollView, Text, View } from "react-native";
import type { AudioAnalysis } from "@siteed/audio-studio";
import type { SongIdea } from "../../types";
import { styles } from "../../styles";
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
  recordingInputLabel: string | null;
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
  waveformData?: Pick<AudioAnalysis, "dataPoints" | "segmentDurationMs">;
  onToggleLyricsExpanded: (value: boolean) => void;
  onToggleLyricsAutoscroll: (enabled: boolean) => void;
  onLyricsAutoscrollInterrupted: () => void;
  onSelectLyricsAutoscrollSpeedMultiplier: (value: number) => void;
};

export function RecordingBody({
  recordingIdea,
  recordingOverdubClip,
  guideMixIsPlaying,
  guideMixPositionMs,
  guideMixDurationMs,
  guideMixWaveformPeaks,
  isBluetoothRecordingInput,
  recordingInputLabel,
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
  waveformData,
  onToggleLyricsExpanded,
  onToggleLyricsAutoscroll,
  onLyricsAutoscrollInterrupted,
  onSelectLyricsAutoscrollSpeedMultiplier,
}: RecordingBodyProps) {
  return (
    <ScrollView
      style={styles.recordingScroll}
      contentContainerStyle={[
        styles.recordingScrollContent,
        hasProjectLyrics && !lyricsExpanded ? styles.recordingScrollContentWithCollapsedLyrics : null,
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.recordingContentBody,
          hasProjectLyrics && !lyricsExpanded ? styles.recordingContentBodyCollapsedLyrics : null,
        ]}
      >
        {recordingOverdubClip ? (
          <>
            {isBluetoothRecordingInput ? (
              <View style={styles.recordingBluetoothWarning}>
                <Text style={styles.recordingBluetoothWarningLabel}>Bluetooth monitoring detected</Text>
                <Text style={styles.recordingBluetoothWarningText}>
                  {recordingInputLabel
                    ? `${recordingInputLabel} may add enough delay to make overdubs feel late. Wired headphones are recommended.`
                    : "Wireless audio may add enough delay to make overdubs feel late. Wired headphones are recommended."}
                </Text>
              </View>
            ) : null}

            <RecordingOverdubGuide
              title={recordingOverdubClip.title}
              durationMs={guideMixDurationMs}
              positionMs={guideMixPositionMs}
              isPlaying={guideMixIsPlaying}
              waveformPeaks={guideMixWaveformPeaks}
            />
          </>
        ) : null}

        <RecordingMeta
          ideaTitle={recordingOverdubClip ? `Overdub on ${recordingOverdubClip.title}` : ""}
          isRecording={isRecording}
          isPaused={isPaused}
          elapsedMs={elapsedMs}
          isCountIn={isCountIn}
          countInBars={countInBars}
          countInCurrentBar={countInCurrentBar}
          countInCurrentBeat={countInCurrentBeat}
          countInBeatsPerBar={countInBeatsPerBar}
          waveformData={waveformData}
          compact={lyricsExpanded}
        />

        {hasProjectLyrics && latestLyricsUpdatedAt !== null ? (
          <RecordingLyricsSection
            text={latestLyricsText}
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
        ) : null}
      </View>
    </ScrollView>
  );
}
