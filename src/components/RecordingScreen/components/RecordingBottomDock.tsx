import React from "react";
import { View } from "react-native";
import { styles } from "../../../styles";
import { MetronomeBeatBar } from "../../common/metronome/MetronomeBeatBar";
import { RecordingControls } from "./RecordingControls";

type RecordingBottomDockProps = {
  compact?: boolean;
  metronome: {
    beatToken: number;
    beatInBar: number;
    pulsesPerBar: number;
    accentPattern?: readonly number[];
    grouping?: readonly number[];
    isCountIn: boolean;
    isRunning: boolean;
  };
  recording: {
    isRecording: boolean;
    isPaused: boolean;
    isArming: boolean;
    isReviewLocked?: boolean;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStart: () => Promise<void>;
    onRequestSave: () => void;
    onDiscard: () => void;
    onRedo?: () => void;
  };
};

export function RecordingBottomDock({ compact = false, metronome, recording }: RecordingBottomDockProps) {
  const beatActive = metronome.isCountIn || metronome.isRunning;

  return (
    <View style={[styles.recordingBottomDock, compact ? styles.recordingBottomDockCompact : null]}>
      {/* The visual metronome: bar-position dots above the transport, same component as
          the standalone Metronome page.
          The row is ALWAYS reserved — not when the click starts beating, and not when the
          metronome is armed either. Any of those makes the dock change height, which pushes
          the reel above it and reshapes the tape; tying it to the toggle just moved the
          reshape from pressing record to pressing the metronome. The page above the
          transport has to be the same size no matter what is switched on.
          (docs/design-system.md — layout stability: reserve, don't add.) */}
      <View style={[styles.recordingBeatBarSlot, { marginBottom: compact ? 4 : 8 }]}>
        {beatActive ? (
          <MetronomeBeatBar
            beatsPerBar={metronome.pulsesPerBar}
            accentPattern={metronome.accentPattern}
            grouping={metronome.grouping}
            currentBeat={metronome.beatInBar}
            pulseToken={metronome.beatToken}
            active={beatActive}
            variant="compact"
          />
        ) : null}
      </View>
      <RecordingControls
        isRecording={recording.isRecording}
        isPaused={recording.isPaused}
        isArming={recording.isArming}
        recordToggleDisabled={recording.isReviewLocked}
        compact={compact}
        canSave={recording.isRecording || recording.isPaused}
        canDiscard={recording.isRecording || recording.isPaused}
        canRedo={recording.isRecording || recording.isPaused || recording.isArming}
        onPause={recording.onPause}
        onResume={recording.onResume}
        onStart={recording.onStart}
        onRequestSave={recording.onRequestSave}
        onDiscard={recording.onDiscard}
        onRedo={recording.onRedo}
      />
    </View>
  );
}
