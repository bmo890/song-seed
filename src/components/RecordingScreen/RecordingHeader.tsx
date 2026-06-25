import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../design/tokens";

type RecordingHeaderProps = {
  eyebrow: string | null;
  title: string;
  titleIsPlaceholder: boolean;
  controlsDisabled: boolean;
  onBack: () => void;
  onMinimize: () => void;
  onOpenSettings: () => void;
};

export function RecordingHeader({
  eyebrow,
  title,
  titleIsPlaceholder,
  controlsDisabled,
  onBack,
  onMinimize,
  onOpenSettings,
}: RecordingHeaderProps) {
  return (
    <View style={localStyles.zone}>
      <View style={localStyles.topRow}>
        <Pressable
          style={({ pressed }) => [localStyles.backBtn, pressed ? localStyles.pressDown : null]}
          onPress={onBack}
        >
          <Ionicons name="chevron-back" size={14} color={colors.textStrong} />
          <Text style={localStyles.backBtnText}>Back</Text>
        </Pressable>

        <View style={localStyles.actionRow}>
          <Pressable
            style={({ pressed }) => [localStyles.actionBtn, pressed ? localStyles.pressDown : null]}
            onPress={onMinimize}
            accessibilityRole="button"
            accessibilityLabel="Minimize recorder"
          >
            <Ionicons name="remove" size={18} color={colors.textStrong} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              localStyles.actionBtn,
              controlsDisabled ? localStyles.actionBtnDisabled : null,
              pressed ? localStyles.pressDown : null,
            ]}
            onPress={onOpenSettings}
            disabled={controlsDisabled}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={16}
              color={controlsDisabled ? colors.textMuted : colors.textPrimary}
            />
          </Pressable>
        </View>
      </View>

      {eyebrow ? (
        <View style={localStyles.eyebrowRow}>
          <View style={localStyles.eyebrowDot} />
          <Text style={localStyles.eyebrowText}>{eyebrow}</Text>
        </View>
      ) : null}

      <Text
        style={titleIsPlaceholder ? localStyles.titlePlaceholder : localStyles.title}
        numberOfLines={1}
      >
        {title}
      </Text>
    </View>
  );
}

const localStyles = StyleSheet.create({
  zone: {
    gap: 6,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 4,
  },
  backBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  actionBtnDisabled: {
    opacity: 0.55,
  },
  pressDown: {
    opacity: 0.7,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  eyebrowText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 21,
    color: colors.textPrimary,
  },
  titlePlaceholder: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
});
