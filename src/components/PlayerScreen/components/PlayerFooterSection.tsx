import React from "react";
import { View } from "react-native";
import { TransportBar } from "../../common/TransportBar";
import { useStore } from "../../../state/useStore";
import { playerScreenStyles } from "../styles";

type PlayerFooterSectionProps = {
  mode: "player" | "practice" | "playalong";
  playDisabled?: boolean;
  isPlaying: boolean;
  hasPreviousTrack: boolean;
  hasNextTrack: boolean;
  repeatEnabled: boolean;
  queueExpanded: boolean;
  onPreviousTrack: () => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onToggleRepeat: () => void;
  onToggleQueueExpanded: () => void;
  /** Ends the whole playback session (matches the mini dock's ✕). */
  onClose: () => void;
};

export function PlayerFooterSection({
  mode,
  playDisabled = false,
  isPlaying,
  hasPreviousTrack,
  hasNextTrack,
  repeatEnabled,
  queueExpanded,
  onPreviousTrack,
  onTogglePlay,
  onNextTrack,
  onToggleRepeat,
  onToggleQueueExpanded,
  onClose,
}: PlayerFooterSectionProps) {
  const queueIndex = useStore((s) => s.playerQueueIndex);
  const queueLength = useStore((s) => s.playerQueue.length);
  // Queue "n / n" beneath the list button — matches the mini dock. Only shown for
  // a real multi-item queue and only in player mode (practice/play-along reuse the
  // trailing slot for repeat).
  const queueCaption =
    mode === "player" && queueLength > 1
      ? `${Math.min(queueIndex + 1, queueLength)}/${queueLength}`
      : undefined;

  // A single hairline (from the footer zone) is enough — no second bordered
  // surface. Slim padding keeps the bar a touch bigger than the dock but tight.
  return (
    <View style={playerScreenStyles.footerStack}>
      <TransportBar
        isPlaying={isPlaying}
        playDisabled={playDisabled}
        onClose={onClose}
        canGoPrevious={hasPreviousTrack}
        canGoNext={hasNextTrack}
        onPrevious={onPreviousTrack}
        onTogglePlay={onTogglePlay}
        onNext={onNextTrack}
        trailingIcon={mode !== "player" ? "repeat" : "list-outline"}
        trailingActive={mode !== "player" ? repeatEnabled : queueExpanded}
        trailingDisabled={false}
        trailingCaption={queueCaption}
        onTrailingPress={mode !== "player" ? onToggleRepeat : onToggleQueueExpanded}
      />
    </View>
  );
}
