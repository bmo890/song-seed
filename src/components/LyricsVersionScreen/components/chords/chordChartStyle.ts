import { Platform } from "react-native";
import { colors } from "../../../../design/tokens";

/** Monospace so every character has a uniform advance width — that's what lets
 * chords anchor to an exact character index and read like a real chord chart. */
export const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })!;

export const LYRIC_FONT_SIZE = 15;
export const LYRIC_LINE_HEIGHT = 22;
export const CHORD_FONT_SIZE = 13;
export const CHORD_ROW_HEIGHT = 22;

/** Reference string length used to measure the monospace advance width. */
export const MEASURE_SAMPLE = "0".repeat(40);

export const chordChartColors = {
  chord: colors.primary,
  chordText: colors.onPrimary,
  lyric: "#1b1c1a",
  faint: colors.borderMuted,
  addHint: colors.textMuted,
};
