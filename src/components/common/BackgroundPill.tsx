import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "./Press";
import { colors, radii, shadows } from "../../design/tokens";
import { riseIn, riseOut } from "../../design/motion";

/**
 * The monitor for something running behind the app: a library backup or
 * export, a SongNook Send seal. One pill, floating above the dock, that owns
 * only its own pixels (the wrapper is box-none, so the record key and the
 * page beneath keep every tap outside it).
 *
 * `fraction` draws the ring; `terminal` swaps the ring for a filled dot with
 * a check or a cross. Tap opens whatever surface owns the work.
 */
export type BackgroundPillProps = {
  title: string;
  subtitle?: string;
  /** 0–1 while running. */
  fraction: number | null;
  /** The work ended: the dot wears the outcome. */
  terminal?: "success" | "error" | null;
  bottom: number;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
};

const R = 13;
const CIRC = 2 * Math.PI * R;
/** Height the pill adds to the stack when another pill must sit above it. */
export const BACKGROUND_PILL_STACK = 58;

export function BackgroundPill({
  title,
  subtitle,
  fraction,
  terminal,
  bottom,
  onPress,
  accessibilityLabel,
  testID,
}: BackgroundPillProps) {
  const pct = Math.max(0.04, Math.min(1, fraction ?? 0));
  const terminalColor = terminal === "success" ? colors.tuneIn : colors.danger;
  return (
    <Animated.View style={[s.wrap, { bottom }]} pointerEvents="box-none" entering={riseIn} exiting={riseOut}>
      <Press
        // Haptics (Press default): `tap` — an acknowledged press.
        style={s.pill}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <View style={s.ring}>
          {terminal ? (
            <View style={[s.terminalDot, { backgroundColor: terminalColor }]}>
              <Ionicons name={terminal === "success" ? "checkmark" : "close"} size={16} color={colors.onPrimary} />
            </View>
          ) : (
            <Svg width={30} height={30}>
              <Circle cx={15} cy={15} r={R} stroke={colors.surfaceHigh} strokeWidth={4} fill="none" />
              <Circle
                cx={15}
                cy={15}
                r={R}
                stroke={colors.primary}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - pct)}
                transform="rotate(-90 15 15)"
              />
            </Svg>
          )}
        </View>
        <View style={s.copy}>
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={s.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-up" size={16} color={colors.textStrong} />
      </Press>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 55, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.xl,
    paddingVertical: 9,
    paddingHorizontal: 12,
    ...shadows.cardActive,
  },
  ring: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  terminalDot: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flexShrink: 1, minWidth: 0 },
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.textSecondary,
  },
});
