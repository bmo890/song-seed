import React from "react";
import { StyleSheet, TextInput, type StyleProp, type TextInputProps, type TextStyle } from "react-native";
import Animated, { useAnimatedProps, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { fmtDuration } from "../../utils";

// `text` is the native field's content prop (what `value` becomes), settable from
// the UI thread without a React render.
type LiveTextInputProps = TextInputProps & { text?: string };
const AnimatedTextInput = Animated.createAnimatedComponent(
  TextInput as unknown as React.ComponentType<LiveTextInputProps>
);
Animated.addWhitelistedNativeProps({ text: true });

type LiveTimeReadoutProps = {
  /** The tape's playhead, 0..1 — the same shared value the reel draws from, so the
   *  readout and the playhead can never disagree: playing, paused, or mid-drag. */
  sharedProgress: SharedValue<number>;
  sharedDurationMs: SharedValue<number>;
  /** React-side duration, used only to reserve the readout's width. */
  durationMs: number;
  style?: StyleProp<TextStyle>;
};

/** "0:12 / 3:40" that follows the reel on the UI thread. A non-editable text
 *  input whose `text` is set by an animated prop: the string updates once per
 *  second tick with no React render, which is what keeps the reel's overlays
 *  glued to its canvas (docs/product-plan/reel-smoothness-findings.md). */
export function LiveTimeReadout({ sharedProgress, sharedDurationMs, durationMs, style }: LiveTimeReadoutProps) {
  const label = useDerivedValue(() => {
    const duration = sharedDurationMs.value;
    const positionMs = Math.max(0, Math.min(1, sharedProgress.value)) * duration;
    return `${fmtDuration(positionMs)} / ${fmtDuration(duration)}`;
  });
  const animatedProps = useAnimatedProps<LiveTextInputProps>(() => ({ text: label.value }));
  // Native text set through an animated prop does not re-measure the field, so
  // the width is reserved up front from the longest string this clip can show.
  const total = fmtDuration(durationMs);
  const widest = `${fmtDuration(0).padStart(total.length, "0")} / ${total}`;
  // The animated prop only lands on a CHANGE, so a (re)mount must start from
  // where the playhead already is — the JS-side copy of the shared values is
  // exact enough for that first frame.
  const initial = `${fmtDuration(sharedProgress.value * sharedDurationMs.value)} / ${fmtDuration(sharedDurationMs.value || durationMs)}`;

  return (
    <AnimatedTextInput
      animatedProps={animatedProps}
      defaultValue={initial}
      editable={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      allowFontScaling={false}
      style={[style, local.input, { minWidth: widest.length * CHAR_WIDTH }]}
    />
  );
}

// Tabular digits in Jakarta 500 at 12pt sit near this advance; the row's spacer
// absorbs any slack, so a slight over-reservation never shows.
const CHAR_WIDTH = 6.6;

const local = StyleSheet.create({
  input: {
    padding: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    height: 16,
    textAlign: "right",
    writingDirection: "ltr",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
