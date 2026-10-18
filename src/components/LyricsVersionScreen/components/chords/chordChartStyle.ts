import { Platform } from "react-native";
import { colors } from "../../../../design/tokens";

/** Monospace so every character has a uniform advance width — that's what lets
 * chords anchor to an exact character index and read like a real chord chart. */
export const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })!;

export const LYRIC_FONT_SIZE = 15;
export const LYRIC_LINE_HEIGHT = 22;
export const CHORD_FONT_SIZE = 13;
export const CHORD_ROW_HEIGHT = 22;

/** The READING scale (2026-10-18): one size for words wherever a song is read,
 *  the player, the songbook reader, a setlist page and the lyric pages, with
 *  or without chords. Chords ride above in bold sans ink. Multiply by zoom. */
export const READING_LYRIC_SIZE = 19;
export const READING_LYRIC_LINE_HEIGHT = 30;
/** A word under a chord sits tighter: the chord row above already parts it. */
export const READING_CHORDED_LINE_HEIGHT = 26;
export const READING_CHORD_SIZE = 14;
export const READING_CHORD_ROW_HEIGHT = 20;

/** Reference string length used to measure the monospace advance width. */
export const MEASURE_SAMPLE = "0".repeat(40);

export const chordChartColors = {
  chord: colors.primary,
  // Deeper terracotta accent used while a chord is being dragged.
  chordActive: colors.primaryDeep,
  chordText: colors.onPrimary,
  lyric: colors.textPrimary,
  faint: colors.borderMuted,
  addHint: colors.textMuted,
};
