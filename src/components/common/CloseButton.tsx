import React from "react";
import { Pressable, StyleSheet, type GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { haptic } from "../../design/haptics";
import { colors, radii } from "../../design/tokens";

/** One shared "✕ close" affordance for every place a playback session (or a
 *  clip-card mini player) can be dismissed: the full player's control bar, the
 *  mini media dock, and the inline clip-card players. Same circular glyph
 *  everywhere — the ONLY thing that changes between contexts is the size. */
export type CloseButtonSize = "sm" | "md" | "lg";

/** `onLight` = paper surfaces (clip cards, the player control bar); `onDark` =
 *  the terracotta media dock, where the glyph inverts to cream. */
export type CloseButtonTone = "onLight" | "onDark";

const SIZES: Record<CloseButtonSize, { diameter: number; icon: number }> = {
  sm: { diameter: 26, icon: 14 }, // inline clip-card players
  md: { diameter: 28, icon: 16 }, // mini media dock
  lg: { diameter: 34, icon: 20 }, // full player control bar
};

type CloseButtonProps = {
  onPress: () => void;
  size?: CloseButtonSize;
  tone?: CloseButtonTone;
  accessibilityLabel?: string;
  /** Skip the built-in tap haptic when the caller fires its own. */
  noHaptic?: boolean;
  hitSlop?: number;
};

function CloseButtonInner({
  onPress,
  size = "md",
  tone = "onLight",
  accessibilityLabel = "Close",
  noHaptic = false,
  hitSlop = 8,
}: CloseButtonProps) {
  const { diameter, icon } = SIZES[size];
  const onDark = tone === "onDark";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        { width: diameter, height: diameter },
        onDark ? styles.onDark : styles.onLight,
        pressed ? styles.pressed : null,
      ]}
      onPress={(event: GestureResponderEvent) => {
        // These buttons often nest inside a card's own Pressable — stop the tap
        // from bubbling up and opening the card behind the ✕.
        event.stopPropagation();
        if (!noHaptic) haptic.tap();
        onPress();
      }}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="close" size={icon} color={onDark ? "#FDFBF7" : colors.textSecondary} />
    </Pressable>
  );
}

export const CloseButton = React.memo(CloseButtonInner);

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  // Soft warm chip on any paper/white surface — borderless so it reads as a
  // gentle, unobtrusive control rather than an outlined button. Every paper-side
  // close (clip cards, inline cards, the full player's control bar) shares it, so
  // they all match; only the diameter changes.
  onLight: {
    backgroundColor: colors.surfaceContainer,
  },
  // Translucent paper chip on the terracotta dock — same language as the dock's
  // queue button, so the ✕ reads as a real control rather than a bare glyph.
  onDark: {
    backgroundColor: "rgba(253,251,247,0.15)",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
