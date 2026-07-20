import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
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
        <Ionicons name="add" size={Math.round(badge * 0.82)} color="#FBF6EE" />
      </View>
    </View>
  );
}

/** "Merge → box": strands merging into one arrow flowing into a project box —
 *  the visual for "gather these takes into a sketch". */
export function DockMergeBoxIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2.5 6.5C6.5 6.5 7 12 9.5 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M2.5 17.5C6.5 17.5 7 12 9.5 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.5 12H13.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11.7 10L13.7 12L11.7 14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={15} y={6.5} width={6.5} height={11} rx={2} stroke={color} strokeWidth={2} />
    </Svg>
  );
}
