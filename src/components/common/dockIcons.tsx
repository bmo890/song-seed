import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../design/tokens";

/**
 * Composite glyphs for selection-dock buttons that can't be a single Ionicon.
 * Each takes the dock's resolved `color`/`size` (and `disabled`) so it tints
 * exactly like a normal dock icon; the terracotta "add" badge greys out with
 * the rest of the button when the action is disabled.
 */

type BadgeProps = {
  /** Base Ionicon the "+" badge sits on (e.g. "play" for Queue, "book-outline"). */
  base: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  disabled?: boolean;
};

/** Destination icon with a small "+" badge — the shared language for "add to …".
 *  Queue is just this on the play glyph, so Play → Queue reads as one family. */
export function DockAddBadgeIcon({ base, color, size, disabled }: BadgeProps) {
  const badge = Math.round(size * 0.6);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={base} size={size} color={color} />
      <View
        style={{
          position: "absolute",
          top: -3,
          right: -4,
          width: badge,
          height: badge,
          borderRadius: badge / 2,
          backgroundColor: disabled ? color : colors.primaryDeep,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="add" size={Math.round(badge * 0.82)} color={colors.page} />
      </View>
    </View>
  );
}
