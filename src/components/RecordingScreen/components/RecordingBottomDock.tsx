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
    /** Armed for this take. Reserves the beat bar's row so the dock's height stops
     *  changing at the exact moment recording starts. */
    enabled: boolean;
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
          The row is RESERVED as soon as the metronome is armed, not added when the click
          starts beating. Mounting it on the first beat grew the dock and squeezed the reel
          above it — a reshape at the one moment the performer is watching the reel. Arming
          the metronome is the honest moment for the layout to change; pressing record is
          not. (docs/design-system.md — layout stability: reserve, don't add.) */}
      {metronome.enabled ? (
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
      ) : null}
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
