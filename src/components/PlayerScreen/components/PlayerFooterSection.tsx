import React from "react";
import { View } from "react-native";
import { PlayerTransportDock } from "../PlayerTransportDock";
import { playerScreenStyles } from "../styles";

type PlayerFooterSectionProps = {
  mode: "player" | "practice";
  playDisabled?: boolean;
  isPlaying: boolean;
  hasPreviousTrack: boolean;
  hasNextTrack: boolean;
  queueEntryCount: number;
  repeatEnabled: boolean;
  queueExpanded: boolean;
  onPreviousTrack: () => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onToggleRepeat: () => void;
  onToggleQueueExpanded: () => void;
};

export function PlayerFooterSection({
  mode,
  playDisabled = false,
  isPlaying,
  hasPreviousTrack,
  hasNextTrack,
  queueEntryCount,
  repeatEnabled,
  queueExpanded,
  onPreviousTrack,
  onTogglePlay,
  onNextTrack,
  onToggleRepeat,
  onToggleQueueExpanded,
}: PlayerFooterSectionProps) {
  return (
    <View style={playerScreenStyles.footerStack}>
      <PlayerTransportDock
        isPlaying={isPlaying}
        playDisabled={playDisabled}
        canGoPrevious={hasPreviousTrack}
        canGoNext={hasNextTrack}
        onPrevious={onPreviousTrack}
        onTogglePlay={onTogglePlay}
        onNext={onNextTrack}
        trailingIcon={mode === "practice" ? "repeat" : queueEntryCount > 1 ? "list-outline" : undefined}
        trailingActive={mode === "practice" ? repeatEnabled : queueExpanded}
        trailingDisabled={mode === "practice" ? false : queueEntryCount <= 1}
        onTrailingPress={
          mode === "practice"
            ? onToggleRepeat
            : queueEntryCount > 1
              ? onToggleQueueExpanded
              : undefined
        }
      />
    </View>
  );
}
