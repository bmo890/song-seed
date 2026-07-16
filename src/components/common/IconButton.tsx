import React from "react";
import { Pressable, StyleSheet, type GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { haptic } from "../../design/haptics";
import { colors } from "../../design/tokens";

/**
 * The app's bare icon button — a glyph sitting directly on the surface, no
 * border or fill, with a full-size invisible tap target and a felt press. This
 * is the shared treatment for header controls like the sheet-collapse chevron
 * and the overflow (⋯) menu: calm, content-first, and told apart by glyph +
 * tone rather than by matching chrome.
 *
 * Tone is the only lever once the container is gone:
 *   accent → the leading control (deep terracotta), e.g. a sheet's collapse
 *   muted  → a quiet utility (warm gray), e.g. an overflow menu
 *   strong → neutral, equal weight (warm charcoal)
 */
export type IconButtonTone = "accent" | "muted" | "strong";

const TONE_COLOR: Record<IconButtonTone, string> = {
  accent: colors.primaryDeep, // #824F3F
  muted: colors.textSecondary, // #84736f
  strong: colors.textStrong, // #524440
};

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  tone?: IconButtonTone;
  /** Glyph size in pt. Default 22 — the header / overflow standard. */
  size?: number;
  /** Explicit color; wins over `tone` when set (e.g. a destructive glyph). */
  color?: string;
  disabled?: boolean;
  /** Skip the built-in tap haptic when the caller fires its own. */
  noHaptic?: boolean;
  /** Extra touch padding around the glyph. Default 11 → a ~44 pt target for a
   *  22 pt glyph, without the visual box affecting row layout. */
  hitSlop?: number;
  /** Stop the press from bubbling to an enclosing Pressable (card rows). */
  stopPropagation?: boolean;
  testID?: string;
};

function IconButtonInner({
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
  tone = "strong",
  size = 22,
  color,
  disabled = false,
  noHaptic = false,
  hitSlop = 11,
  stopPropagation = false,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
      onPress={(event: GestureResponderEvent) => {
        if (stopPropagation) event.stopPropagation();
        if (disabled) return;
        if (!noHaptic) haptic.tap();
        onPress();
      }}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Ionicons name={icon} size={size} color={color ?? TONE_COLOR[tone]} />
    </Pressable>
  );
}

export const IconButton = React.memo(IconButtonInner);

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  // No fill to darken, so the glyph itself dims and dips — keeps the tap felt.
  pressed: {
    opacity: 0.5,
    transform: [{ scale: 0.9 }],
  },
  disabled: {
    opacity: 0.35,
  },
});
