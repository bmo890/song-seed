import React from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import type { SongIdea } from "../../../types";
import { styles } from "../../../styles";
import { getLatestLyricsVersion } from "../../../domain/lyrics";
import { looksMachineNamed } from "../../../domain/titleNaming";
import { RecordingMeta } from "./RecordingMeta";
import { RecordingLyricsSection } from "./RecordingLyricsSection";
import { RecordingOverdubGuide, type GuideCue } from "./RecordingOverdubGuide";

type RecordingBodyProps = {
  recordingIdea: SongIdea | null | undefined;
  recordingOverdubClip?: SongIdea["clips"][number] | null;
  guideMixIsPlaying: boolean;
  guideMixPositionMs: number;
  guideMixDurationMs: number;
  guideMixWaveformPeaks?: number[];
  /** Choosing where the layer starts, before the take. */
  guideCue?: GuideCue;
  hasProjectLyrics: boolean;
  latestLyricsText: string;
  latestLyricsUpdatedAt: number | null;
  lyricsExpanded: boolean;
  lyricsAutoscrollMode: "off" | "follow" | "manual";
  lyricsAutoscrollSpeedMultiplier: number;
  isRecording: boolean;
  /** The guide plays from the phone speaker (no headphones, no Bluetooth). */
  guideOnPhoneSpeaker?: boolean;
  isPaused: boolean;
  elapsedMs: number;
  isCountIn: boolean;
  /** A punched layer's run-up toward its start point. */
  isPreRoll?: boolean;
  layerTimeLeftMs?: number | null;
  countInBars: number;
  countInCurrentBar: number;
  countInCurrentBeat: number;
  countInBeatsPerBar: number;
  guideJoin?: { joinAtEpochMs: number; beatMs: number } | null;
  metronomeEnabled: boolean;
  metronomeSummary: string;
  metronomeToggleDisabled?: boolean;
  liveTakeGrid?: { firstBeatCaptureMs: number; beatMs: number; pulsesPerBar: number } | null;
  onToggleMetronome?: () => void;
  onOpenMetronome: () => void;
  /** Pins dropped so far in this take (capture ms) and the one-tap drop. */
  livePins?: { atMs: number }[];
  onAddPin?: () => void;
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
  guideCue,
  hasProjectLyrics,
  latestLyricsText,
  latestLyricsUpdatedAt,
  lyricsExpanded,
  lyricsAutoscrollMode,
  lyricsAutoscrollSpeedMultiplier,
  isRecording,
  guideOnPhoneSpeaker = false,
  isPaused,
  elapsedMs,
  isCountIn,
  isPreRoll,
  layerTimeLeftMs,
  countInBars,
  countInCurrentBar,
  countInCurrentBeat,
  countInBeatsPerBar,
  guideJoin,
  metronomeEnabled,
  metronomeSummary,
  metronomeToggleDisabled,
  liveTakeGrid,
  onToggleMetronome,
  onOpenMetronome,
  livePins,
  onAddPin,
  onToggleLyricsExpanded,
  onToggleLyricsAutoscroll,
  onLyricsAutoscrollInterrupted,
  onSelectLyricsAutoscrollSpeedMultiplier,
}: RecordingBodyProps) {
  // Stable for the same pins: the take register memoises its marks on it.
  const livePinTimes = React.useMemo(() => livePins?.map((pin) => pin.atMs) ?? [], [livePins]);
  // A layer's reel fills what the page has left. Everything here is measured from the
  // visible area and the parts beside the reel, never from a box the reel sits in.
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const [metaHeight, setMetaHeight] = React.useState(0);
  const [lyricsHeight, setLyricsHeight] = React.useState(0);
  const showsLyrics = hasProjectLyrics && latestLyricsUpdatedAt !== null;
  const guideAvailableHeight =
    viewportHeight -
    (hasProjectLyrics && !lyricsExpanded ? COLLAPSED_LYRICS_BOTTOM_PAD : BODY_BOTTOM_PAD) -
    metaHeight -
    BODY_GAP -
    (showsLyrics ? lyricsHeight + BODY_GAP : 0);
  const measure = (set: (value: number) => void) => (event: LayoutChangeEvent) =>
    set(Math.round(event.nativeEvent.layout.height));
  const bodyContent = (
      <View
        style={[
          styles.recordingContentBody,
          hasProjectLyrics && !lyricsExpanded ? styles.recordingContentBodyCollapsedLyrics : null,
        ]}
      >
        {recordingOverdubClip ? (
          <>
            <RecordingOverdubGuide
              durationMs={guideMixDurationMs}
              positionMs={guideMixPositionMs}
              isPlaying={guideMixIsPlaying}
              waveformPeaks={guideMixWaveformPeaks}
              cue={guideCue}
              sections={recordingOverdubClip.sections}
              practiceMarkers={recordingOverdubClip.practiceMarkers}
              showHeadphonesHint={guideOnPhoneSpeaker && !isRecording}
              compact={lyricsExpanded}
              availableHeight={guideAvailableHeight}
              take={{
                active: isRecording || isPaused || elapsedMs > 0,
                isRecording,
                isPaused,
                isCountIn,
                pins: livePinTimes,
                onAddPin,
              }}
              layerLanes={(recordingOverdubClip.overdub?.stems ?? []).map((stem) => ({
                id: stem.id,
                title: stem.title,
                offsetMs: stem.offsetMs,
                durationMs: stem.durationMs ?? 0,
                isMuted: stem.isMuted,
                peaks: stem.waveformPeaks,
                readsAsName: !looksMachineNamed(stem.title),
              }))}
            />
          </>
        ) : null}

        <View onLayout={measure(setMetaHeight)}>
        <RecordingMeta
          // The header already says LAYER · <clip>; this used to repeat it as
          // "Layer on <clip>" directly underneath.
          ideaTitle=""
          isRecording={isRecording}
          isPaused={isPaused}
          elapsedMs={elapsedMs}
          isCountIn={isCountIn}
          isPreRoll={isPreRoll}
          layerTimeLeftMs={layerTimeLeftMs}
          countInBars={countInBars}
          countInCurrentBar={countInCurrentBar}
          countInCurrentBeat={countInCurrentBeat}
          countInBeatsPerBar={countInBeatsPerBar}
          guideJoin={guideJoin}
          compact={lyricsExpanded}
          // A layer's reel fills the page instead (RecordingOverdubGuide).
          fill={!lyricsExpanded && !recordingOverdubClip}
          hasLyrics={hasProjectLyrics}
          hasGuide={!!recordingOverdubClip}
          metronomeEnabled={metronomeEnabled}
          metronomeSummary={metronomeSummary}
          metronomeToggleDisabled={metronomeToggleDisabled}
          liveTakeGrid={liveTakeGrid}
          onToggleMetronome={onToggleMetronome}
          onOpenMetronome={onOpenMetronome}
          livePins={livePins}
          onAddPin={onAddPin}
        />
        </View>

        {hasProjectLyrics && latestLyricsUpdatedAt !== null ? (
          (() => {
            const recLines =
              (recordingIdea?.kind === "project"
                ? getLatestLyricsVersion(recordingIdea)?.document.lines
                : null) ?? [];
            const recChordLines = recLines.some((line) => line.chords.length > 0) ? recLines : undefined;
            return (
          <View onLayout={measure(setLyricsHeight)} style={lyricsExpanded ? bodyStyles.fill : null}>
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
            ideaId={recordingIdea?.id ?? null}
          />
          </View>
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
      onLayout={measure(setViewportHeight)}
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

/** recordingScrollContent's bottom padding (8 with collapsed lyrics) and the body's gap. */
const BODY_BOTTOM_PAD = 12;
const COLLAPSED_LYRICS_BOTTOM_PAD = 8;
const BODY_GAP = 12;

const bodyStyles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
