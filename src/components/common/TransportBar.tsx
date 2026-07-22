import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CloseButton } from "./CloseButton";
import { haptic } from "../../design/haptics";
import { colors, radii } from "../../design/tokens";
import { useTranslation } from "react-i18next";

type TransportBarProps = {
  isPlaying: boolean;
  playDisabled?: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  /** "full" = the player sheet's footer; "compact" = the mini dock. Same layout
   *  and language, scaled. */
  size?: "full" | "compact";
  /** When provided, a ✕ close button fills the leading slot (mirroring the mini
   *  dock's far-left ✕) — ends the whole session, not just collapse. */
  onClose?: () => void;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  trailingActive?: boolean;
  trailingDisabled?: boolean;
  onTrailingPress?: () => void;
  /** Tiny readout under the trailing button (the queue's "n / n" position),
   *  mirroring the mini dock. */
  trailingCaption?: string;
  speedBadge?: string;
  speedActive?: boolean;
  onSpeedPress?: () => void;
};

/**
 * THE transport row — one component for the mini dock and the full player, so
 * prev/play/next (+ queue toggle, + speed) look and act identically at both
 * sizes. Nocturne styling: filled terracotta play circle, bare warm-gray skips,
 * quiet circular trailing button that fills terracotta when active.
 */
function TransportBarInner({
  isPlaying,
  playDisabled = false,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onTogglePlay,
  onNext,
  size = "full",
  onClose,
  trailingIcon,
  trailingActive = false,
  trailingDisabled = false,
  onTrailingPress,
  trailingCaption,
  speedBadge,
  speedActive = false,
  onSpeedPress,
}: TransportBarProps) {
  const { t } = useTranslation();
  const compact = size === "compact";
  const skipIconSize = compact ? 18 : 22;
  const playIconSize = compact ? 20 : 24;
  const sideBtnStyle = compact ? styles.sideButtonCompact : styles.sideButton;
  const slotStyle = compact ? styles.slotCompact : styles.slot;

  return (
    <View style={styles.row}>
      <View style={slotStyle}>
        {onClose ? (
          <CloseButton
            size={compact ? "sm" : "lg"}
            tone="onLight"
            onPress={onClose}
            accessibilityLabel={t("common.closePlayer")}
          />
        ) : speedBadge ? (
          <Pressable
            style={({ pressed }) => [
              styles.speedBadge,
              speedActive ? styles.speedBadgeActive : null,
              pressed ? styles.pressed : null,
            ]}
            onPress={() => {
              haptic.tap();
              onSpeedPress?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("common.playbackSpeed", { speed: speedBadge })}
          >
            <Text style={[styles.speedBadgeText, speedActive ? styles.speedBadgeTextActive : null]}>
              {speedBadge}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          sideBtnStyle,
          !canGoPrevious ? styles.buttonDisabled : null,
          pressed ? styles.pressed : null,
        ]}
        onPress={() => {
          haptic.tap();
          onPrevious();
        }}
        disabled={!canGoPrevious}
        accessibilityRole="button"
        accessibilityLabel={t("common.previous")}
      >
        <Ionicons
          name="play-skip-back"
          size={skipIconSize}
          color={canGoPrevious ? "#6b5a55" : "#c4b5b2"}
        />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          compact ? styles.playButtonCompact : styles.playButton,
          playDisabled ? styles.playButtonDisabled : null,
          pressed && !playDisabled ? styles.playPressed : null,
        ]}
        onPress={() => {
          haptic.tap();
          onTogglePlay();
        }}
        disabled={playDisabled}
        accessibilityRole="button"
        accessibilityLabel={t(isPlaying ? "common.pause" : "common.play")}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={playIconSize}
          color={colors.page}
          style={isPlaying ? null : styles.playIconNudge}
        />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          sideBtnStyle,
          !canGoNext ? styles.buttonDisabled : null,
          pressed ? styles.pressed : null,
        ]}
        onPress={() => {
          haptic.tap();
          onNext();
        }}
        disabled={!canGoNext}
        accessibilityRole="button"
        accessibilityLabel={t("common.next")}
      >
        <Ionicons
          name="play-skip-forward"
          size={skipIconSize}
          color={canGoNext ? "#6b5a55" : "#c4b5b2"}
        />
      </Pressable>

      <View style={slotStyle}>
        {trailingIcon ? (
          <View style={styles.trailingCol}>
            <Pressable
              style={({ pressed }) => [
                compact ? styles.trailingButtonCompact : styles.trailingButton,
                trailingActive ? styles.trailingButtonActive : null,
                trailingDisabled ? styles.buttonDisabled : null,
                pressed ? styles.pressed : null,
              ]}
              onPress={() => {
                haptic.tap();
                onTrailingPress?.();
              }}
              disabled={trailingDisabled}
              accessibilityRole="button"
              accessibilityLabel={t(trailingActive ? "common.hideQueue" : "common.showQueue")}
            >
              <Ionicons
                name={trailingIcon}
                size={compact ? 15 : 18}
                color={trailingActive ? colors.page : trailingDisabled ? "#c4b5b2" : "#6b5a55"}
              />
            </Pressable>
            {trailingCaption ? (
              <Text style={styles.trailingCaption}>{trailingCaption}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const TransportBar = React.memo(TransportBarInner);

const styles = StyleSheet.create({
  row: {
    // Prev/play/next is a tape transport: back is always on the left, forward on
    // the right. Pinned LTR so the cluster never mirrors under a Hebrew UI.
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  slot: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  slotCompact: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  sideButton: {
    width: 44,
    height: 44,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  sideButtonCompact: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: radii.round,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonCompact: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonDisabled: {
    backgroundColor: "#d3c1ba",
  },
  playIconNudge: {
    marginStart: 2,
  },
  speedBadge: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.md,
    backgroundColor: "#F4ECE9",
    alignItems: "center",
  },
  speedBadgeActive: {
    backgroundColor: colors.primaryDeep,
  },
  speedBadgeText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
  speedBadgeTextActive: {
    color: colors.page,
  },
  trailingButton: {
    width: 36,
    height: 36,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  trailingButtonCompact: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    backgroundColor: "#EAE5DF",
    alignItems: "center",
    justifyContent: "center",
  },
  trailingButtonActive: {
    backgroundColor: colors.primary,
  },
  trailingCol: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  trailingCaption: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 10,
    lineHeight: 11,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.78,
  },
  playPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
