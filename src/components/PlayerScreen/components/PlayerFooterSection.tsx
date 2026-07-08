import React from "react";
import { StyleSheet, View } from "react-native";
import { TransportBar } from "../../common/TransportBar";
import { colors } from "../../../design/tokens";
import { playerScreenStyles } from "../styles";

type PlayerFooterSectionProps = {
  mode: "player" | "practice" | "playalong";
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
      <View style={footerStyles.surface}>
        <TransportBar
          isPlaying={isPlaying}
          playDisabled={playDisabled}
          canGoPrevious={hasPreviousTrack}
          canGoNext={hasNextTrack}
          onPrevious={onPreviousTrack}
          onTogglePlay={onTogglePlay}
          onNext={onNextTrack}
          trailingIcon={mode !== "player" ? "repeat" : queueEntryCount > 1 ? "list-outline" : undefined}
          trailingActive={mode !== "player" ? repeatEnabled : queueExpanded}
          trailingDisabled={mode !== "player" ? false : queueEntryCount <= 1}
          onTrailingPress={
            mode !== "player"
              ? onToggleRepeat
              : queueEntryCount > 1
                ? onToggleQueueExpanded
                : undefined
          }
        />
      </View>
    </View>
  );
}

const footerStyles = StyleSheet.create({
  surface: {
    backgroundColor: "#FDFBF7",
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
