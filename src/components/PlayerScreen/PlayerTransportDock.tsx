import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  isPlaying: boolean;
  playDisabled?: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  trailingActive?: boolean;
  trailingDisabled?: boolean;
  onTrailingPress?: () => void;
  speedBadge?: string;
  speedActive?: boolean;
  onSpeedPress?: () => void;
};

function PlayerTransportDockInner({
  isPlaying,
  playDisabled = false,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onTogglePlay,
  onNext,
  trailingIcon,
  trailingActive = false,
  trailingDisabled = false,
  onTrailingPress,
  speedBadge,
  speedActive = false,
  onSpeedPress,
}: Props) {
  return (
    <View style={styles.dock}>
      <View style={styles.row}>
        <View style={styles.leadingSlot}>
          {speedBadge ? (
            <Pressable
              style={({ pressed }) => [
                styles.speedBadge,
                speedActive ? styles.speedBadgeActive : null,
                pressed ? styles.pressed : null,
              ]}
              onPress={onSpeedPress}
            >
              <Text style={[styles.speedBadgeText, speedActive ? styles.speedBadgeTextActive : null]}>
                {speedBadge}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.sideButton,
            !canGoPrevious ? styles.buttonDisabled : null,
            pressed ? styles.pressed : null,
          ]}
          onPress={onPrevious}
          disabled={!canGoPrevious}
        >
          <Ionicons name="play-skip-back" size={22} color={canGoPrevious ? "#111827" : "#b6bcc7"} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.playButton,
            playDisabled ? styles.playButtonDisabled : null,
            pressed && !playDisabled ? styles.playPressed : null,
          ]}
          onPress={onTogglePlay}
          disabled={playDisabled}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={24} color={playDisabled ? "#8c837e" : "#111827"} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.sideButton,
            !canGoNext ? styles.buttonDisabled : null,
            pressed ? styles.pressed : null,
          ]}
          onPress={onNext}
          disabled={!canGoNext}
        >
          <Ionicons name="play-skip-forward" size={22} color={canGoNext ? "#111827" : "#b6bcc7"} />
        </Pressable>

        <View style={styles.trailingSlot}>
          {trailingIcon ? (
            <Pressable
              style={({ pressed }) => [
                styles.trailingButton,
                trailingActive ? styles.trailingButtonActive : null,
                trailingDisabled ? styles.buttonDisabled : null,
                pressed ? styles.pressed : null,
              ]}
              onPress={onTrailingPress}
              disabled={trailingDisabled}
            >
              <Ionicons
                name={trailingIcon}
                size={20}
                color={trailingActive ? "#3b82f6" : trailingDisabled ? "#b6bcc7" : "#7c8796"}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export const PlayerTransportDock = React.memo(PlayerTransportDockInner);

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: "rgba(248,248,249,0.98)",
    borderTopWidth: 1,
    borderTopColor: "#e6e8ed",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#111827",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  playButtonDisabled: {
    borderColor: "#b8a69f",
    backgroundColor: "#f3f1ee",
  },
  leadingSlot: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  speedBadge: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#dbeafe",
    alignItems: "center",
  },
  speedBadgeActive: {
    backgroundColor: "#bfdbfe",
  },
  speedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
  },
  speedBadgeTextActive: {
    color: "#1d4ed8",
  },
  trailingSlot: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  trailingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  trailingButtonActive: {
    backgroundColor: "#e6effc",
  },
  buttonDisabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.78,
  },
  playPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
