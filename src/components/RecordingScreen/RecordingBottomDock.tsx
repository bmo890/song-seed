import React from "react";
import { View } from "react-native";
import { styles } from "../../styles";
import { RecordingControls } from "./RecordingControls";

type RecordingBottomDockProps = {
  compact?: boolean;
  metronome: {
    beatToken: number;
    beatInBar: number;
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
  return (
    <View style={[styles.recordingBottomDock, compact ? styles.recordingBottomDockCompact : null]}>
      <RecordingControls
        isRecording={recording.isRecording}
        isPaused={recording.isPaused}
        isArming={recording.isArming}
        recordToggleDisabled={recording.isReviewLocked}
        compact={compact}
        canSave={recording.isRecording || recording.isPaused}
        canDiscard={recording.isRecording || recording.isPaused}
        canRedo={recording.isRecording || recording.isPaused || recording.isArming}
        beatToken={metronome.beatToken}
        isDownbeat={metronome.beatInBar === 1}
        beatActive={metronome.isCountIn || metronome.isRunning}
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
