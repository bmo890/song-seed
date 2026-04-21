import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import { PlayerTransportDock } from "../PlayerTransportDock";
import { playerScreenStyles } from "../styles";

type PlayerFooterSectionProps = {
  mode: "player" | "practice";
  speedPanelVisible: boolean;
  playbackSpeed: number;
  playDisabled?: boolean;
  speedPresets: readonly number[];
  speedMin: number;
  speedMax: number;
  isPlaying: boolean;
  hasPreviousTrack: boolean;
  hasNextTrack: boolean;
  queueEntryCount: number;
  practiceLoopEnabled: boolean;
  queueExpanded: boolean;
  onToggleSpeedPanel: () => void;
  onSpeedSliding: (value: number) => void;
  onSpeedSlideStart: (value: number) => void;
  onSpeedSlideEnd: (value: number) => void;
  onSpeedTap: (value: number) => void;
  onPreviousTrack: () => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onTogglePracticeLoop: () => void;
  onToggleQueueExpanded: () => void;
};

export function PlayerFooterSection({
  mode,
  speedPanelVisible,
  playbackSpeed,
  playDisabled = false,
  speedPresets,
  speedMin,
  speedMax,
  isPlaying,
  hasPreviousTrack,
  hasNextTrack,
  queueEntryCount,
  practiceLoopEnabled,
  queueExpanded,
  onToggleSpeedPanel,
  onSpeedSliding,
  onSpeedSlideStart,
  onSpeedSlideEnd,
  onSpeedTap,
  onPreviousTrack,
  onTogglePlay,
  onNextTrack,
  onTogglePracticeLoop,
  onToggleQueueExpanded,
}: PlayerFooterSectionProps) {
  return (
    <View style={playerScreenStyles.footerStack}>
      {mode === "practice" && speedPanelVisible ? (
        <View style={playerScreenStyles.speedPopover}>
          <Slider
            style={playerScreenStyles.speedPopoverSlider}
            minimumValue={speedMin}
            maximumValue={speedMax}
            step={0.05}
            value={playbackSpeed}
            onValueChange={onSpeedSliding}
            onSlidingStart={onSpeedSlideStart}
            onSlidingComplete={onSpeedSlideEnd}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#d1d5db"
            thumbTintColor="#ffffff"
          />
          <View style={playerScreenStyles.speedPopoverTicks}>
            {speedPresets.map((tick) => {
              const isActive = Math.abs(playbackSpeed - tick) < 0.01;
              return (
                <TouchableOpacity key={tick} onPress={() => onSpeedTap(tick)} hitSlop={4}>
                  <Text
                    style={[
                      playerScreenStyles.speedTickText,
                      isActive && playerScreenStyles.speedTickTextActive,
                    ]}
                  >
                    {tick}x
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <PlayerTransportDock
        isPlaying={isPlaying}
        playDisabled={playDisabled}
        canGoPrevious={hasPreviousTrack}
        canGoNext={hasNextTrack}
        onPrevious={onPreviousTrack}
        onTogglePlay={onTogglePlay}
        onNext={onNextTrack}
        trailingIcon={mode === "practice" ? "repeat" : queueEntryCount > 1 ? "list-outline" : undefined}
        trailingActive={mode === "practice" ? practiceLoopEnabled : queueExpanded}
        trailingDisabled={mode === "practice" ? false : queueEntryCount <= 1}
        onTrailingPress={
          mode === "practice"
            ? onTogglePracticeLoop
            : queueEntryCount > 1
              ? onToggleQueueExpanded
              : undefined
        }
        speedBadge={mode === "practice" ? `${playbackSpeed}x` : undefined}
        speedActive={mode === "practice" && speedPanelVisible}
        onSpeedPress={mode === "practice" ? onToggleSpeedPanel : undefined}
      />
    </View>
  );
}
