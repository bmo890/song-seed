import React, { useEffect, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { Press } from "./Press";
import { dirIcon } from "../../design/directionalIcons";

/**
 * A pair of detented keys: nudge a mark, step a speed, tick a tempo.
 *
 * One key per direction, 28 pt, on `surface`. Each step is a `tick`
 * (haptics.ts: a detent crossed), owned here so no caller fires its own.
 * Holding a key repeats the step with the same tick, the way a physical
 * stepper rattles under a held thumb. A key at its bound dims and goes
 * quiet.
 *
 * Use it as two halves around something (`children`, e.g. a slider) or on
 * its own as a tight pair.
 */
export type StepperProps = {
  onStep: (direction: -1 | 1) => void;
  canDecrement?: boolean;
  canIncrement?: boolean;
  decrementLabel: string;
  incrementLabel: string;
  /** Glyph pair. Chevrons for a position on time (never mirrored: the axis
   *  stays put in RTL); remove/add for a value. */
  glyphs?: "chevrons" | "plusMinus";
  /** `large` beside a hero value (the metronome's tempo): 24 pt glyph in a
   *  48 pt target. Default is the 17 pt glyph in 36 pt. */
  size?: "default" | "large";
  /** Rendered between the two keys. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 110;

function StepKey({
  direction,
  enabled,
  label,
  glyph,
  large = false,
  onStep,
  testID,
}: {
  direction: -1 | 1;
  enabled: boolean;
  label: string;
  glyph: keyof typeof Ionicons.glyphMap;
  large?: boolean;
  onStep: (direction: -1 | 1) => void;
  testID?: string;
}) {
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (repeat.current) {
      clearInterval(repeat.current);
      repeat.current = null;
    }
  };
  useEffect(() => stop, []);

  const step = () => {
    // Haptics: `tick` — a detent crossed.
    haptic.tick();
    onStep(direction);
  };

  return (
    <Press
      haptic="none"
      feel="glyph"
      style={large ? s.keyLarge : s.key}
      disabled={!enabled}
      onPress={step}
      onLongPress={() => {
        stop();
        repeat.current = setInterval(step, REPEAT_EVERY_MS);
      }}
      delayLongPress={REPEAT_DELAY_MS}
      onPressOut={stop}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Ionicons name={glyph} size={large ? 24 : 17} color={colors.textStrong} />
    </Press>
  );
}

export function Stepper({
  onStep,
  canDecrement = true,
  canIncrement = true,
  decrementLabel,
  incrementLabel,
  glyphs = "chevrons",
  size = "default",
  children,
  style,
  testID,
}: StepperProps) {
  const [down, up]: [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap] =
    glyphs === "chevrons" ? [dirIcon("chevron-back"), dirIcon("chevron-forward")] : ["remove", "add"];
  return (
    <View style={[s.row, style]}>
      <StepKey
        direction={-1}
        enabled={canDecrement}
        label={decrementLabel}
        glyph={down}
        large={size === "large"}
        onStep={onStep}
        testID={testID ? `${testID}-down` : undefined}
      />
      {children}
      <StepKey
        direction={1}
        enabled={canIncrement}
        label={incrementLabel}
        glyph={up}
        large={size === "large"}
        onStep={onStep}
        testID={testID ? `${testID}-up` : undefined}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // A bare ink glyph in a 36 pt target (2026-10-15): no white disc.
  key: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  keyLarge: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
