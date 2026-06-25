import React from "react";
import { View } from "react-native";
import { styles } from "../../styles";
import { RecordingControls } from "./RecordingControls";
import { RecordingMetronomeButton } from "./RecordingMetronomeButton";
import { RecordingCountInButton } from "./RecordingCountInButton";
import { RecordingInputButton } from "./RecordingInputButton";
import { RecordingBeatPulse } from "./RecordingBeatPulse";
import type { MetronomeMeterId } from "../../metronome";

type RecordingBottomDockProps = {
  metronomeEnabled: boolean;
  metronomeControlsDisabled: boolean;
  metronome: {
    isNativeAvailable: boolean;
    bpm: number;
    meterId: MetronomeMeterId;
    countInBars: number;
    beatToken: number;
    beatInBar: number;
    isCountIn: boolean;
    isRunning: boolean;
    onToggleEnabled: (value: boolean) => void;
    onOpenSheet: () => void;
    onSelectCountInBars: (bars: number) => void;
  };
  onOpenInput: () => void;
  inputLabel?: string | null;
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
  };
};

export function RecordingBottomDock({
  metronomeEnabled,
  metronomeControlsDisabled,
  metronome,
  onOpenInput,
  inputLabel,
  recording,
}: RecordingBottomDockProps) {
  return (
    <View style={styles.recordingBottomDock}>
      <RecordingBeatPulse
        beatToken={metronome.beatToken}
        isDownbeat={metronome.beatInBar === 1}
        active={metronome.isCountIn || metronome.isRunning}
        style={localStyles.secondaryRow}
      >
        <RecordingMetronomeButton
          enabled={metronomeEnabled}
          disabled={metronomeControlsDisabled}
          isNativeAvailable={metronome.isNativeAvailable}
          bpm={metronome.bpm}
          meterId={metronome.meterId}
          onToggleEnabled={metronome.onToggleEnabled}
          onOpenSettings={metronome.onOpenSheet}
        />
        <RecordingCountInButton
          countInBars={metronome.countInBars}
          disabled={metronomeControlsDisabled}
          onSelectCountInBars={metronome.onSelectCountInBars}
        />
        <RecordingInputButton
          disabled={metronomeControlsDisabled}
          inputLabel={inputLabel}
          onPress={onOpenInput}
        />
      </RecordingBeatPulse>

      <View style={localStyles.divider} />

      <RecordingControls
        isRecording={recording.isRecording}
        isPaused={recording.isPaused}
        isArming={recording.isArming}
        recordToggleDisabled={recording.isReviewLocked}
        compact={false}
        canSave={recording.isRecording || recording.isPaused}
        canDiscard={recording.isRecording || recording.isPaused}
        onPause={recording.onPause}
        onResume={recording.onResume}
        onStart={recording.onStart}
        onRequestSave={recording.onRequestSave}
        onDiscard={recording.onDiscard}
      />
    </View>
  );
}

const localStyles = {
  secondaryRow: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 12,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#E8E4DF",
    marginBottom: 14,
  },
};
