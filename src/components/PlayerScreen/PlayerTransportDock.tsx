import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  isPlaying: boolean;
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
};

export function PlayerTransportDock({
  isPlaying,
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
}: Props) {
  return (
    <View style={styles.dock}>
      <View style={styles.row}>
        <View style={styles.leadingSlot}>
          {speedBadge ? (
            <View style={styles.speedBadge}>
              <Text style={styles.speedBadgeText}>{speedBadge}</Text>
            </View>
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

        <Pressable style={({ pressed }) => [styles.playButton, pressed ? styles.playPressed : null]} onPress={onTogglePlay}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#111827" />
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
  leadingSlot: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  speedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#dbeafe",
  },
  speedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
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
