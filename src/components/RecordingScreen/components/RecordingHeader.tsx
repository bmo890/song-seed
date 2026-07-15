import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../../../design/tokens";

type RecordingHeaderProps = {
  eyebrow: string | null;
  title: string;
  titleIsPlaceholder: boolean;
  controlsDisabled: boolean;
  /** Slim down to just the nav row (drop eyebrow + title) — used when the lyrics
   * panel is expanded so the lyrics get the reclaimed height. */
  collapsed?: boolean;
  onBack: () => void;
  onMinimize: () => void;
  onOpenSettings: () => void;
  onHelp: () => void;
};

export function RecordingHeader({
  eyebrow,
  title,
  titleIsPlaceholder,
  controlsDisabled,
  collapsed = false,
  onBack,
  onMinimize,
  onOpenSettings,
  onHelp,
}: RecordingHeaderProps) {
  return (
    <View style={[localStyles.zone, collapsed ? localStyles.zoneCollapsed : null]}>
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
            onPress={onHelp}
            accessibilityRole="button"
            accessibilityLabel="Recording help"
          >
            <Ionicons name="help-circle-outline" size={18} color={colors.textStrong} />
          </Pressable>

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

      {!collapsed && eyebrow ? (
        <View style={localStyles.eyebrowRow}>
          <View style={localStyles.eyebrowDot} />
          <Text style={localStyles.eyebrowText}>{eyebrow}</Text>
        </View>
      ) : null}

      {!collapsed ? (
        <Text
          style={titleIsPlaceholder ? localStyles.titlePlaceholder : localStyles.title}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  zone: {
    gap: 6,
    marginBottom: 12,
  },
  zoneCollapsed: {
    gap: 0,
    marginBottom: 6,
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
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  actionBtnDisabled: {
    opacity: 0.55,
  },
  pressDown: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
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
