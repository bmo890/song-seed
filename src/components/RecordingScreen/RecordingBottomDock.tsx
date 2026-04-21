import React from "react";
import type { MetronomeMeterId, MetronomeOutputs } from "../../metronome";
import { View } from "react-native";
import { styles } from "../../styles";
import { RecordingControls } from "./RecordingControls";
import { RecordingMetronomeSection } from "./RecordingMetronomeSection";

type RecordingBottomDockProps = {
  metronomeEnabled: boolean;
  metronomeControlsDisabled: boolean;
  metronome: {
    bpm: number;
    meterId: MetronomeMeterId;
    countInBars: number;
    outputs: MetronomeOutputs;
    tapCount: number;
    isNativeAvailable: boolean;
    onToggleEnabled: (value: boolean) => void;
    onNudgeBpm: (delta: number) => void;
    onSetBpmValue: (value: number) => void;
    onTapTempo: () => number | null;
    onResetTapTempo: () => void;
    onSelectMeter: (meterId: MetronomeMeterId) => void;
    onSelectCountInBars: (bars: number) => void;
    onToggleOutput: (key: keyof MetronomeOutputs) => void;
  };
  recording: {
    isRecording: boolean;
    isPaused: boolean;
    isArming: boolean;
    isReviewLocked?: boolean;
    onOpenInput: () => void;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStart: () => Promise<void>;
    onRequestSave: () => void;
  };
};

export function RecordingBottomDock({
  metronomeEnabled,
  metronomeControlsDisabled,
  metronome,
  recording,
}: RecordingBottomDockProps) {
  return (
    <View style={styles.recordingBottomDock}>
      <RecordingMetronomeSection
        enabled={metronomeEnabled}
        disabled={metronomeControlsDisabled}
        bpm={metronome.bpm}
        meterId={metronome.meterId}
        countInBars={metronome.countInBars}
        outputs={metronome.outputs}
        tapCount={metronome.tapCount}
        isNativeAvailable={metronome.isNativeAvailable}
        onToggleEnabled={metronome.onToggleEnabled}
        onNudgeBpm={metronome.onNudgeBpm}
        onSetBpmValue={metronome.onSetBpmValue}
        onTapTempo={metronome.onTapTempo}
        onResetTapTempo={metronome.onResetTapTempo}
        onSelectMeter={metronome.onSelectMeter}
        onSelectCountInBars={metronome.onSelectCountInBars}
        onToggleOutput={metronome.onToggleOutput}
      />

      <RecordingControls
        isRecording={recording.isRecording}
        isPaused={recording.isPaused}
        isArming={recording.isArming}
        recordToggleDisabled={recording.isReviewLocked}
        compact={false}
        canSave={recording.isRecording || recording.isPaused}
        onOpenInput={recording.onOpenInput}
        onPause={recording.onPause}
        onResume={recording.onResume}
        onStart={recording.onStart}
        onRequestSave={recording.onRequestSave}
      />
    </View>
  );
}
